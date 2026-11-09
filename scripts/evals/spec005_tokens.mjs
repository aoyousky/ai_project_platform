#!/usr/bin/env node
/**
 * SPEC-005 令牌生成器。
 *
 * 走真实登录页取得 3 个夹具账号的 access_token，写入临时文件供
 * `run_eval.py` 以 EVAL_SPEC005_*_TOKEN 注入；令牌不打印到 stdout。
 *
 * 为什么不在 HTTP 探针里惰性登录：A-01/A-02/A-05 的登录日志与在线数断言
 * 要求确定值（213 条今日成功登录、48 个在线用户）。真实登录会插入
 * sys_logininfor 行与 online_tokens 键，故执行顺序固定为：
 *   seed 基础夹具 → 生成令牌 → volatile 重置日志/在线键（保留这 3 个令牌）
 *   → HTTP 探针（全程直取令牌，不再触发登录）。
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const frontendUrl = process.env.EVAL_FRONTEND_URL ?? 'http://localhost:5666';
const redisContainer = process.env.EVAL_REDIS_CONTAINER ?? 'awp-redis';
const redisPassword = process.env.EVAL_REDIS_PASSWORD ?? 'aoyou123';
const outFile = process.argv[2] ?? process.env.EVAL_SPEC005_TOKENS_FILE;
if (!outFile) {
  throw new Error('缺少令牌输出路径（argv[2] 或 EVAL_SPEC005_TOKENS_FILE）');
}

const accounts = {
  spec005Admin: {
    password: process.env.EVAL_SPEC005_ADMIN_PASSWORD ?? 'admin123',
    username: process.env.EVAL_SPEC005_ADMIN_USER ?? 'spec005_admin_a',
  },
  spec005Limited: {
    password: process.env.EVAL_SPEC005_LIMITED_PASSWORD ?? 'admin123',
    username: process.env.EVAL_SPEC005_LIMITED_USER ?? 'spec005_limited',
  },
  spec005TenantB: {
    password: process.env.EVAL_SPEC005_TENANT_B_PASSWORD ?? 'admin123',
    username: process.env.EVAL_SPEC005_TENANT_B_USER ?? 'spec005_admin_b',
  },
};

function readCaptcha(uuid) {
  const raw = execFileSync(
    'docker',
    [
      'exec',
      redisContainer,
      'redis-cli',
      '--no-auth-warning',
      '-a',
      redisPassword,
      '--raw',
      'GET',
      `global:captcha_codes:${uuid}`,
    ],
    { encoding: 'utf8' },
  ).trim();
  const code = raw.replaceAll('"', '');
  if (!code) {
    // 空串说明该 uuid 已过期或被上一次提交消费；继续填表会被前端表单拦截，
    // 表现为“点了登录却没有任何 POST”，最终只在 waitForResponse 处超时。
    throw new Error(`验证码 uuid=${uuid} 在 Redis 中没有对应明文`);
  }
  return code;
}

async function login(page, credential) {
  const captchaImage = page.locator('img[alt="验证码"]');
  const captchaUuids = [];
  page.on('response', (response) => {
    if (!new URL(response.url()).pathname.endsWith('/auth/code')) {
      return;
    }
    void response
      .json()
      .then((body) => {
        if (body?.code === 200 && body?.data?.uuid) {
          captchaUuids.push(body.data.uuid);
        }
      })
      .catch(() => {});
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    // 每次导航独立收集：上一次导航的晚到响应不得覆盖当前页面的 uuid。
    captchaUuids.length = 0;
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByPlaceholder('请输入用户名').waitFor({ timeout: 30_000 });
    try {
      // 慢宿主首次加载可能超过 15s；超时会触发整页重载并额外消耗
      // `/auth/code` 的 10 次/60s 限流预算，导致后续账号被误限流。
      await captchaImage.waitFor({ state: 'visible', timeout: 45_000 });
      break;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(15_000);
    }
  }

  // 挂载时可能重复请求 `/auth/code`；等 1.5s 内不再新增再取最后一个成功响应，
  // 与 E2E helpers.ts 同口径，避免填到已被页面重置的旧 uuid。
  let stableSince = Date.now();
  let lastLength = captchaUuids.length;
  while (Date.now() - stableSince < 1500) {
    await page.waitForTimeout(200);
    if (captchaUuids.length !== lastLength) {
      lastLength = captchaUuids.length;
      stableSince = Date.now();
    }
  }

  let uuid = captchaUuids.at(-1);
  if (!uuid) {
    const captchaResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/auth/code') &&
        response.request().method() === 'GET',
      { timeout: 30_000 },
    );
    await captchaImage.click();
    const captcha = await (await captchaResponse).json();
    uuid = captcha?.data?.uuid;
  }
  if (!uuid) {
    throw new Error('登录页未返回验证码 uuid');
  }

  await page.getByPlaceholder('请输入用户名').fill(credential.username);
  await page.getByPlaceholder('密码').fill(credential.password);
  const captchaInput = page.getByPlaceholder('验证码');
  const captchaCode = readCaptcha(uuid);
  await captchaInput.fill(captchaCode);
  // 挂载时的 /auth/code 响应晚到时可能重置输入；与 E2E helpers.ts 同一防护。
  if ((await captchaInput.inputValue()) !== captchaCode) {
    throw new Error('验证码输入在提交前被页面重置');
  }

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/login') && response.request().method() === 'POST',
    { timeout: 45_000 },
  );
  const loginButton = page.locator('button[aria-label="login"]');
  await loginButton.waitFor({ state: 'visible', timeout: 30_000 });
  await loginButton.click();
  const body = await (await loginResponse).json();
  if (body?.code !== 200) {
    throw new Error(`${credential.username} 登录失败：${body?.msg ?? '未知错误'}`);
  }
  const token = body?.data?.access_token ?? body?.data?.accessToken;
  if (!token) {
    throw new Error('登录响应未返回 access_token');
  }
  return token;
}

const browser = await chromium.launch({ headless: true });
const tokens = {};
try {
  for (const [kind, credential] of Object.entries(accounts)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      tokens[kind] = await login(page, credential);
    } finally {
      await context.close();
    }
    // 3 次登录远低于 10 次/60s，间隔只为避免同一窗口内与探针抢额度。
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
} finally {
  await browser.close();
}

writeFileSync(outFile, JSON.stringify(tokens), { encoding: 'utf8', mode: 0o600 });
