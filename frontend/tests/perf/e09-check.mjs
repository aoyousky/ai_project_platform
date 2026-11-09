/**
 * SPEC-001 E-09 手工验证：未移植菜单（字典管理）应显示统一占位页「即将推出」，
 * 而不是 404，且侧栏其余菜单仍可用。
 *
 * 用法（前端目录，需已构建 + preview:5666 + 本地 Docker 栈）：
 *   node tests/perf/e09-check.mjs
 */
import { execFileSync } from 'node:child_process';

import { chromium } from 'playwright';

const BASE_URL = process.env.PERF_BASE_URL ?? 'http://localhost:5666';
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'awp-redis';
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD ?? 'aoyou123';

function readCaptchaCode(uuid) {
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
    throw new Error(`验证码 uuid=${uuid} 在 Redis 中没有对应明文`);
  }
  return code;
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  /** @type {string | undefined} */
  let captchaUuid;
  page.on('response', (response) => {
    if (!new URL(response.url()).pathname.endsWith('/auth/code')) {
      return;
    }
    void response
      .json()
      .then((body) => {
        if (body?.data?.uuid) {
          captchaUuid = body.data.uuid;
        }
      })
      .catch(() => {});
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('img[alt="验证码"]').waitFor({ timeout: 60_000 });
  const uuidDeadline = Date.now() + 10_000;
  while (!captchaUuid && Date.now() < uuidDeadline) {
    await page.waitForTimeout(200);
  }
  if (!captchaUuid) {
    throw new Error('10s 内未取得 /auth/code 的 uuid');
  }

  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('admin123');
  await page.getByPlaceholder('验证码').fill(readCaptchaCode(captchaUuid));
  await page.locator('button[aria-label="login"]').click();
  await page.waitForURL(/\/index/, { timeout: 60_000 });

  const sidebar = page.locator('aside');
  await page.getByText('系统管理', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await sidebar.getByText('字典管理', { exact: true }).first().click();
  await page.waitForURL('**/system/dict**', { timeout: 15_000 });
  await page.getByText('即将推出').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });

  const result = {
    url: page.url(),
    coming_soon_visible: true,
    sidebar_visible: await sidebar.isVisible(),
    console_errors: consoleErrors,
  };
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
