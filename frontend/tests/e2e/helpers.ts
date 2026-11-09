import type { Locator, Page } from '@playwright/test';

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { expect } from '@playwright/test';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'awp-redis';
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD ?? 'aoyou123';

/**
 * 登录成功后进入应用（`/index`）的等待预算。
 *
 * 登录成功后前端还要拉取用户信息与菜单才会跳转；宿主 Docker/浏览器变慢时
 * 这段会超过 15s（实测 15s 时仍停在“加载菜单中…”）。用统一预算，
 * 避免把环境慢误判成登录失败；真实的登录失败依旧会超时失败。
 */
export const APP_ENTRY_TIMEOUT = 60_000;

/**
 * 后端是否可达。E2E 依赖 quickstart §1 的本地 Docker 栈；
 * 未起栈时用例应 skip，而不是误报失败。
 *
 * 探活走 `/auth/tenant/list`（公开、不限流）而不是 `/auth/code`：后者是
 * 10 次/60s/IP 的限流端点，每个 Playwright 进程的 beforeAll 探一次会白白吃掉
 * 整套 E2E 的取码预算。
 */
export async function isBackendUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/tenant/list`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 从 Redis 读取图形验证码明文（仅本地 E2E；验证码一次性，不能缓存复用）。
 * 键格式见 platform GlobalConstants：`global:captcha_codes:<uuid>`。
 */
export function readCaptchaCode(uuid: string): string {
  const raw = execFileSync(
    'docker',
    [
      'exec',
      REDIS_CONTAINER,
      'redis-cli',
      '--no-auth-warning',
      '-a',
      REDIS_PASSWORD,
      '--raw',
      'GET',
      `global:captcha_codes:${uuid}`,
    ],
    { encoding: 'utf8' },
  ).trim();
  const code = raw.replaceAll('"', '');
  if (!code) {
    // 空串说明该 uuid 在 Redis 中不存在（已过期或被上一次提交消费）。
    // 直接返回会让表单校验拦下请求，表现为“停在登录页”而看不出原因。
    throw new Error(`验证码 uuid=${uuid} 在 Redis 中没有对应明文（已过期或被消费）`);
  }
  return code;
}

/**
 * 重新写入 SPEC-004 评测夹具（幂等）。
 *
 * E2E 会删除并重建夹具（A-05 删除操作日志），单独重跑时必须先恢复数据，
 * 否则用例在“列表 total ≥ 1”处失败。夹具脚本同时会被 `scripts/ci-gate.sh`
 * 调用一次；这里设置 `EVAL_SKIP_RESTART=1`，避免在用例开始时重启后端
 * 造成数秒停机（OSS 端点缓存已由门禁阶段的首次 seed 刷新）。
 *
 * 路径解析覆盖两种执行目录：仓库根（CI 从根目录调用）与 `frontend/`
 * （本地 `pnpm exec playwright test`）。
 */
export function seedSpec004Fixtures(): void {
  if (process.env.E2E_SKIP_SEED === '1') {
    return;
  }
  const candidates = [
    process.env.E2E_SEED_SPEC004 ?? '',
    path.resolve(process.cwd(), '..', 'scripts', 'evals', 'seed_spec004.sh'),
    path.resolve(process.cwd(), 'scripts', 'evals', 'seed_spec004.sh'),
  ].filter(Boolean);
  const script = candidates.find((candidate) => existsSync(candidate));
  if (!script) {
    throw new Error(
      `找不到 SPEC-004 夹具脚本，已查找：${candidates.join(', ')}`,
    );
  }
  execFileSync('bash', [script], {
    env: { ...process.env, EVAL_SKIP_RESTART: '1' },
    stdio: 'ignore',
  });
}

/**
 * 从页面发出的 `/auth/code` 响应里收集 uuid（按响应完成顺序）。
 * 开发态前缀是 `/api`，生产构建（E2E 跑 preview）是 `/prod-api`，故按路径后缀匹配。
 */
function collectCaptchaCodes(page: Page) {
  const codes: Array<{ code: number; uuid: string }> = [];
  page.on('response', (response) => {
    if (!new URL(response.url()).pathname.endsWith('/auth/code')) {
      return;
    }
    void response
      .json()
      .then((body) => {
        codes.push({
          code: body?.code ?? -1,
          uuid: body?.data?.uuid ?? '',
        });
      })
      .catch(() => {});
  });
  return codes;
}

/**
 * `/auth/code` 限流预算：后端 10 次/60s/IP（CaptchaController @RateLimiter）。
 * 整套 E2E 每个用例都要登录，连续跑会挤爆窗口，故按 7 次/60s 排队，
 * 留 3 次余量给“登录失败自动刷新 / 点击图片刷新”等页面自发请求。
 *
 * 评测器会为每次运行设置 `E2E_CAPTCHA_LEDGER`（一个 JSON 时间戳文件），
 * 让多个 Playwright 进程与 HTTP 探针共享同一份预算——按 (spec, grep) 分组的
 * 每组都是一次独立的 `npx playwright test`，进程内状态无法跨进程生效。
 * 未设置该变量时（单独跑某条用例）退回进程内数组。
 */
const CAPTCHA_WINDOW_MS = 60_000;
// 5 次/60s：除了每个用例挂载取码，还有页面重挂载、登录失败自动刷新、
// 登录重试等**不受账本控制**的请求。实测账本 7 次时，刷新请求恰好是窗口内第 11 次
// 而被后端拒绝（A-02 因此失败）；压到 5 次后最坏情况 ≈ 5 + 3 次自发性请求 ≤ 10。
const CAPTCHA_BUDGET = 5;
const CAPTCHA_LEDGER = process.env.E2E_CAPTCHA_LEDGER;
const captchaRequestLog: number[] = [];

function readLedger(): number[] {
  if (!CAPTCHA_LEDGER) {
    return captchaRequestLog;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(CAPTCHA_LEDGER, 'utf8'));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : [];
  } catch {
    // 首次运行文件不存在：当作空账本
    return [];
  }
}

function writeLedger(entries: number[]): void {
  if (!CAPTCHA_LEDGER) {
    return;
  }
  try {
    writeFileSync(CAPTCHA_LEDGER, JSON.stringify(entries));
  } catch {
    // 记账失败只影响限流排队，不应让用例失败
  }
}

/**
 * 为页面自发请求预留一个取码名额（如登录失败后自动刷新验证码）。
 * 调用后账本占一个槽位，保证紧随其后的刷新不会被后端限流拒绝。
 */
export async function reserveCaptchaSlot(page: Page): Promise<void> {
  await paceCaptcha(page);
}

async function paceCaptcha(page: Page): Promise<void> {
  for (;;) {
    const now = Date.now();
    const log = readLedger().filter(
      (at) => now - at <= CAPTCHA_WINDOW_MS,
    );
    if (log.length < CAPTCHA_BUDGET) {
      log.push(now);
      if (CAPTCHA_LEDGER) {
        writeLedger(log);
      } else {
        captchaRequestLog.push(now);
      }
      return;
    }
    await page.waitForTimeout(log[0]! + CAPTCHA_WINDOW_MS - now + 500);
  }
}

/**
 * 打开登录页并返回页面当前验证码会话 uuid。
 *
 * 复用页面挂载时的 `/auth/code`，不额外点击刷新：后端对 `/auth/code` 有
 * 10 次/60s/IP 的限流（CaptchaController @RateLimiter），每个用例多取一次码
 * 会让整套 E2E 触发限流。验证码一次性，uuid 与对应明文只能用于一次登录提交。
 *
 * 初始化期间若发生重挂载会再次取码，因此等响应稳定后取最后一个（后到的响应
 * 一定会覆盖页面状态）。若首次取码被限流导致图片未渲染，等待窗口重置后重试。
 */
export async function waitForCaptchaUuid(page: Page): Promise<string> {
  const codes = collectCaptchaCodes(page);
  const captchaImage = page.locator('img[alt="验证码"]');

  for (let attempt = 0; attempt < 3; attempt++) {
    await paceCaptcha(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('请输入用户名').waitFor();

    try {
      await captchaImage.waitFor({ state: 'visible', timeout: 12_000 });
      break;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      // 限流窗口未重置：等待后重试（被拒绝的请求不消耗令牌）
      await page.waitForTimeout(15_000);
    }
  }

  // 给可能的重复挂载请求留出落地时间：等到取码响应在 1.5s 内不再新增，再取最后一个
  // 成功响应。慢宿主上重挂载的响应可能晚于 400ms 落地，填旧 uuid 的码而后端按新
  // uuid 校验，会得到“验证码错误”（表现为登录后停在登录页）。
  let stableSince = Date.now();
  let lastLength = codes.length;
  while (Date.now() - stableSince < 1500) {
    await page.waitForTimeout(200);
    if (codes.length !== lastLength) {
      lastLength = codes.length;
      stableSince = Date.now();
    }
  }
  const last = codes.findLast((item) => item.code === 200 && item.uuid);
  if (!last) {
    throw new Error('登录页未请求 /auth/code，拿不到验证码 uuid');
  }
  return last.uuid;
}

/**
 * 用真实后端账号登录：等待登录页自己请求 `/auth/code`，取 uuid 后从 Redis 取码。
 * 对应 US1（T023–T025）实现后的登录页；未实现前该用例应失败（T009 RED）。
 *
 * 慢宿主上取码与提交之间页面可能重挂载（表单被重置），或取到的 uuid 已过期/
 * 被消费，表现为“点了登录却停在登录页”。这里自检并整体重试一次；重试会重新
 * 导航取码，仍然受 `/auth/code` 限流排队约束。真实登录失败（非验证码问题）
 * 直接抛错，不掩盖。
 */
export async function loginWithCaptcha(
  page: Page,
  username = 'admin',
  password = 'admin123',
  attempts = 2,
): Promise<void> {
  const captchaInput = page.getByPlaceholder('验证码');
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const uuid = await waitForCaptchaUuid(page);
      const code = readCaptchaCode(uuid);

      await page.getByPlaceholder('请输入用户名').fill(username);
      await page.getByPlaceholder('密码').fill(password);
      await captchaInput.fill(code);
      if ((await captchaInput.inputValue()) !== code) {
        throw new Error('验证码输入在提交前被页面重置');
      }

      const responded = page.waitForResponse(
        (response) =>
          response.url().includes('/auth/login') &&
          response.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await page.locator('button[aria-label="login"]').click();
      const response = await responded;
      const body = await response.json();
      if (body?.code !== 200) {
        throw new Error(`登录被拒绝：${JSON.stringify(body)}`);
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('登录失败：未知原因');
}

/**
 * 打开应用内路径。
 *
 * 路由模式由 `VITE_ROUTER_HISTORY` 决定：开发态是 history，生产构建是 hash
 * （`.env.production`，E2E 跑 preview）。直接 `page.goto('/system/dept')`
 * 在 hash 模式下会落到首页，故按当前地址推断模式后拼接目标 URL。
 */
export async function gotoAppPath(page: Page, path: string): Promise<void> {
  const url = new URL(page.url());
  const target = url.hash.startsWith('#/')
    ? `${url.origin}/#${path}`
    : `${url.origin}${path}`;
  await page.goto(target);
  await waitForAppReady(page);
}

/**
 * 等启动屏（“加载菜单中…”）消失。
 *
 * `gotoAppPath` 是整页加载：路由守卫要重新拉取用户信息与菜单，慢宿主上这段
 * 会明显超过 15–20s，后续断言若落在启动期就会误报“元素不存在”。先给启动屏
 * 一个出现窗口（快速启动时窗口内它已消失），再等它消失。
 */
export async function waitForAppReady(page: Page): Promise<void> {
  const bootScreen = page.getByText('加载菜单中').first();
  await bootScreen
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
  await bootScreen.waitFor({ state: 'hidden', timeout: APP_ENTRY_TIMEOUT });
}

/**
 * 在 vxe 表格搜索框中输入并只等待本次搜索触发的响应。
 * 按参数匹配可避免在页面挂载请求的旧数据上取行号。
 *
 * 同一页面有多个表格（如字典双栏）时传 `root` 限定到对应面板，
 * 否则占位符与“搜索”按钮在 page 级会命中多个元素。
 */
export async function searchGrid(
  page: Page,
  options: {
    endpoint: string;
    param: string;
    placeholder: string;
    value: string;
  },
  root?: Locator,
): Promise<void> {
  const scope = root ?? page;
  await expect(scope.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await scope.getByPlaceholder(options.placeholder).last().fill(options.value);
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith(options.endpoint) &&
      url.searchParams.get(options.param) === options.value
    );
  });
  await scope.getByRole('button', { name: /搜\s*索/ }).click();
  await loaded;
  await expect(scope.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/**
 * 取带操作按钮的行。
 * 列宽溢出时操作列在固定区独立渲染，按主表行文本取同序号的固定区行；
 * 列宽未溢出时 vxe 不创建固定区，按钮就在主表行内。
 */
export async function actionRowFor(
  page: Page,
  mainRow: Locator,
): Promise<Locator> {
  const fixedWrapper = page.locator('.vxe-table--fixed-right-wrapper');
  if ((await fixedWrapper.count()) === 0) {
    return mainRow;
  }
  const index = await mainRow.evaluate((el) =>
    [...(el.parentElement?.children ?? [])].indexOf(el),
  );
  return fixedWrapper.locator('.vxe-body--row').nth(index);
}

/** 按行内文本定位唯一的操作行（文本必须在该主表行中唯一） */
export async function fixedActionRow(page: Page, text: string) {
  const mainRow = page
    .locator('.vxe-table--main-wrapper .vxe-body--row')
    .filter({ hasText: text });
  await expect(mainRow).toHaveCount(1, { timeout: 15_000 });
  return actionRowFor(page, mainRow);
}

/** 确认 Ant Modal.confirm 弹窗（确定按钮） */
export async function confirmDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: /确\s*定/ }).click();
}
