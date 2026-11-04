import type { Locator, Page } from '@playwright/test';

import { execFileSync } from 'node:child_process';
import process from 'node:process';

import { expect } from '@playwright/test';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'awp-redis';
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD ?? 'aoyou123';

/**
 * 后端是否可达。E2E 依赖 quickstart §1 的本地 Docker 栈；
 * 未起栈时用例应 skip，而不是误报失败。
 */
export async function isBackendUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/code`, {
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
  return raw.replaceAll('"', '');
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
 * workers=1 时模块状态在同一 worker 进程内跨用例共享。
 */
const CAPTCHA_WINDOW_MS = 60_000;
const CAPTCHA_BUDGET = 7;
const captchaRequestLog: number[] = [];

async function paceCaptcha(page: Page): Promise<void> {
  const now = Date.now();
  while (
    captchaRequestLog.length > 0 &&
    now - captchaRequestLog[0]! > CAPTCHA_WINDOW_MS
  ) {
    captchaRequestLog.shift();
  }
  if (captchaRequestLog.length >= CAPTCHA_BUDGET) {
    const wait = captchaRequestLog[0]! + CAPTCHA_WINDOW_MS - now + 500;
    await page.waitForTimeout(wait);
    return paceCaptcha(page);
  }
  captchaRequestLog.push(now);
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

  // 给可能的重复挂载请求留出落地时间，取最后一个成功的响应
  await page.waitForTimeout(400);
  const last = codes.findLast((item) => item.code === 200 && item.uuid);
  if (!last) {
    throw new Error('登录页未请求 /auth/code，拿不到验证码 uuid');
  }
  return last.uuid;
}

/**
 * 用真实后端账号登录：等待登录页自己请求 `/auth/code`，取 uuid 后从 Redis 取码。
 * 对应 US1（T023–T025）实现后的登录页；未实现前该用例应失败（T009 RED）。
 */
export async function loginWithCaptcha(
  page: Page,
  username = 'admin',
  password = 'admin123',
): Promise<void> {
  const uuid = await waitForCaptchaUuid(page);

  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByPlaceholder('验证码').fill(readCaptchaCode(uuid));
  await page.locator('button[aria-label="login"]').click();
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
}

/**
 * 在 vxe 表格搜索框中输入并只等待本次搜索触发的响应。
 * 按参数匹配可避免在页面挂载请求的旧数据上取行号。
 */
export async function searchGrid(
  page: Page,
  options: {
    endpoint: string;
    param: string;
    placeholder: string;
    value: string;
  },
): Promise<void> {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.getByPlaceholder(options.placeholder).last().fill(options.value);
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
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await loaded;
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
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
