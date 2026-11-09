import type { Page } from '@playwright/test';

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

/**
 * SPEC-005 E2E 的身份注入。
 *
 * 评测栈的 3 个账号由 `scripts/evals/seed_spec005.sh` + `spec005_tokens.mjs` 预先
 * 生成令牌，再经 `EVAL_SPEC005_TOKENS_FILE` 传入。E2E 不重复走登录页：
 *
 * - `/auth/code` 是 10 次/60s/IP 的限流端点，整套 E2E 只有 A-10 需要真实登录；
 * - 真实登录会写入 `sys_logininfor`/在线会话，A-01/A-02 的确定值依赖“探针后无登录”。
 *
 * 生产预览构建把 Pinia 持久化在 SecureLS（AES + LZString）里，因此这里用与
 * `@vben/stores` 相同的参数加密出 `core-access` 的持久化值，并在页面脚本执行前
 * 同时写入 meta 与数据键：meta 让页面后续 `set` 新键时不会丢失已有键。
 */
export type Spec005TokenKind =
  | 'spec005Admin'
  | 'spec005Limited'
  | 'spec005TenantB';

const DIRECT_ENV: Record<Spec005TokenKind, string> = {
  spec005Admin: 'EVAL_SPEC005_ADMIN_TOKEN',
  spec005Limited: 'EVAL_SPEC005_LIMITED_TOKEN',
  spec005TenantB: 'EVAL_SPEC005_TENANT_B_TOKEN',
};

const FRONTEND_ROOT = process.cwd();
const APP_DIR = path.join(FRONTEND_ROOT, 'apps', 'web-antdv-next');

interface SecureLSInstance {
  get(key: string): any;
  set(key: string, value: string): void;
}

type SecureLSCtor = new (config: Record<string, unknown>) => SecureLSInstance;

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** 运行时推导生产预览的持久化命名空间（与 main.ts 完全一致） */
function proNamespace(): { namespace: string; secret: string } {
  const env = parseEnvFile(path.join(APP_DIR, '.env'));
  const pkg = JSON.parse(
    readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'),
  ) as { version?: string };
  const appNamespace = env.VITE_APP_NAMESPACE;
  const secret = env.VITE_APP_STORE_SECURE_KEY;
  if (!appNamespace || !secret || !pkg.version) {
    throw new Error(
      '无法从 apps/web-antdv-next/.env 与 package.json 推导 VITE_APP_NAMESPACE / VITE_APP_STORE_SECURE_KEY / version',
    );
  }
  return { namespace: `${appNamespace}-${pkg.version}-prod`, secret };
}

function secureLSConstructor(): SecureLSCtor {
  // secure-ls 是 @vben/stores 的依赖，pnpm 不保证提升到 frontend 根；
  // 从该包的解析上下文 require，和 packages/stores/src/setup.ts 用同一份模块。
  const storesRequire = createRequire(
    path.join(FRONTEND_ROOT, 'packages', 'stores', 'package.json'),
  );
  const moduleRef = storesRequire('secure-ls') as {
    SecureLS?: SecureLSCtor;
    default?: SecureLSCtor;
  };
  const ctor = moduleRef.default ?? moduleRef.SecureLS ?? (moduleRef as unknown as SecureLSCtor);
  if (typeof ctor !== 'function') {
    throw new Error('secure-ls 模块未导出构造函数');
  }
  return ctor;
}

/** 读取夹具令牌：优先直取环境变量，其次令牌 JSON（键名与 run_eval.py 一致） */
export function spec005Token(kind: Spec005TokenKind): string {
  const direct = process.env[DIRECT_ENV[kind]];
  if (direct) {
    return direct;
  }
  const tokensFile = process.env.EVAL_SPEC005_TOKENS_FILE;
  if (!tokensFile) {
    throw new Error(
      `缺少 ${DIRECT_ENV[kind]} 或 EVAL_SPEC005_TOKENS_FILE；请先运行 scripts/evals/run_spec005.sh 或生成令牌文件`,
    );
  }
  if (!existsSync(tokensFile)) {
    throw new Error(`EVAL_SPEC005_TOKENS_FILE 不存在: ${tokensFile}`);
  }
  const tokens = JSON.parse(readFileSync(tokensFile, 'utf8')) as Record<
    string,
    string
  >;
  const token = tokens[kind];
  if (!token) {
    throw new Error(`令牌文件缺少 ${kind}`);
  }
  return token;
}

/**
 * 把 accessToken 写进生产预览的 Pinia 持久化键。
 *
 * `page.addInitScript` 在每次导航、页面脚本执行前运行，因此守卫读 store 时
 * 令牌已经完成 hydration。
 */
export async function installSpec005Access(
  page: Page,
  token: string,
): Promise<void> {
  const { namespace, secret } = proNamespace();
  const dataKey = `${namespace}-core-access`;
  const metaKey = `${namespace}-secure-meta`;

  const captured: Record<string, string> = {};
  const fakeStorage = {
    getItem(_key: string) {
      return null;
    },
    removeItem(_key: string) {
      // SecureLS 初始化时可能清理旧键；捕获用的假存储无需真实删除
    },
    setItem(key: string, value: string) {
      captured[key] = value;
    },
  };
  const ls = new (secureLSConstructor())({
    encodingType: 'aes',
    encryptionSecret: secret,
    isCompression: true,
    metaKey,
    storage: fakeStorage,
  });
  // 与 access store 的 persist.pick 保持一致；Pinia 持久化即 JSON.stringify(state)
  ls.set(
    dataKey,
    JSON.stringify({
      accessCodes: [],
      accessToken: token,
      isLockScreen: false,
      lockScreenPassword: null,
      refreshToken: null,
    }),
  );

  const metaValue = captured[metaKey];
  const dataValue = captured[dataKey];
  if (!metaValue || !dataValue) {
    throw new Error(
      `SecureLS 未生成持久化值，实际写入键: ${Object.keys(captured).join(', ')}`,
    );
  }

  const entries = { dataKey, dataValue, metaKey, metaValue };
  await page.addInitScript(
    (payload: typeof entries) => {
      window.localStorage.setItem(payload.metaKey, payload.metaValue);
      window.localStorage.setItem(payload.dataKey, payload.dataValue);
    },
    entries,
  );
}
