import { execFileSync } from 'node:child_process';

import type { Page } from '@playwright/test';

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
  return raw.replace(/^"|"$/g, '');
}

/**
 * 用真实后端账号登录：等待登录页自己请求 `/api/auth/code`，取 uuid 后从 Redis 取码。
 * 对应 US1（T023–T025）实现后的登录页；未实现前该用例应失败（T009 RED）。
 */
export async function loginWithCaptcha(
  page: Page,
  username = 'admin',
  password = 'admin123',
): Promise<void> {
  let uuid: string | undefined;

  page.on('response', async (response) => {
    if (!response.url().includes('/api/auth/code')) {
      return;
    }
    try {
      const body = await response.json();
      uuid = body?.data?.uuid;
    } catch {
      // 响应非 JSON 时保持 uuid 未设置，由下面的轮询超时暴露
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').waitFor();

  for (let i = 0; i < 100 && !uuid; i += 1) {
    await page.waitForTimeout(100);
  }
  if (!uuid) {
    throw new Error('登录页未请求 /api/auth/code，拿不到验证码 uuid');
  }

  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByPlaceholder('请输入验证码').fill(readCaptchaCode(uuid));
  await page.locator('button[aria-label="login"]').click();
}
