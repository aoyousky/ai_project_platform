import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  isBackendUp,
  loginWithCaptcha,
  readCaptchaCode,
  waitForCaptchaUuid,
} from './helpers';

/**
 * T020：登录页验收（A-01、A-02、E-01、E-02、E-14）。
 * 依赖本地 Docker 后端栈与可读取 Redis 的验证码（quickstart §1）。
 */
test.describe('登录', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isBackendUp()),
      '本地后端栈未启动（deploy/docker compose up -d）',
    );
  });

  test('验证码错误：展示后端 msg、刷新验证码、保留用户名（A-02、E-01）', async ({
    page,
  }) => {
    const uuid = await waitForCaptchaUuid(page);
    const realCode = readCaptchaCode(uuid).toLowerCase();
    const wrongCode = realCode === 'zzzz' ? 'yyyy' : 'zzzz';

    const captchaImage = page.locator('img[alt="验证码"]');
    const beforeSrc = await captchaImage.getAttribute('src');

    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('admin123');
    await page.getByPlaceholder('验证码').fill(wrongCode);

    // antdv 的 message 提示有固定存活时间，慢宿主上可能在断言开始轮询前就已消失，
    // 直接 `getByText(...).toBeVisible()` 会与提示的生命周期赛跑。点击前挂
    // MutationObserver 记录新渲染的文本，断言“后端 msg 确实展示过”。
    await page.evaluate(() => {
      const host = window as unknown as { __messages?: string[] };
      host.__messages = [];
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            const text = node.textContent?.trim();
            if (text) {
              host.__messages?.push(text);
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/auth/login'),
    );
    await page.locator('button[aria-label="login"]').click();
    const loginResponse = await responsePromise;
    const body = await loginResponse.json();

    expect(body.code).not.toBe(200);
    expect(typeof body.msg).toBe('string');
    expect(body.msg.length).toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const host = window as unknown as { __messages?: string[] };
            return (host.__messages ?? []).join('\n');
          }),
        { timeout: APP_ENTRY_TIMEOUT },
      )
      .toContain(body.msg);
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByPlaceholder('请输入用户名')).toHaveValue('admin');
    await expect
      .poll(async () => captchaImage.getAttribute('src'))
      .not.toBe(beforeSrc);
  });

  test('点击验证码图片可刷新', async ({ page }) => {
    await waitForCaptchaUuid(page);
    const captchaImage = page.locator('img[alt="验证码"]');
    const beforeSrc = await captchaImage.getAttribute('src');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/auth/code'),
    );
    await captchaImage.click();
    await responsePromise;

    await expect
      .poll(async () => captchaImage.getAttribute('src'))
      .not.toBe(beforeSrc);
  });

  test('登录成功后落到 /index（A-01）', async ({ page }) => {
    await loginWithCaptcha(page);

    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  });

  test('连续点击 3 次只发出 1 个登录请求（E-14）', async ({ page }) => {
    const uuid = await waitForCaptchaUuid(page);
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('admin123');
    await page.getByPlaceholder('验证码').fill(readCaptchaCode(uuid));

    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/auth/login')) {
        loginRequests += 1;
      }
    });

    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-label="login"]',
      );
      button?.click();
      button?.click();
      button?.click();
    });

    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    expect(loginRequests).toBe(1);
  });

  test('不渲染手机号/扫码/注册/忘记密码入口（US1）', async ({ page }) => {
    await waitForCaptchaUuid(page);

    await expect(page.getByText('手机登录')).toHaveCount(0);
    await expect(page.getByText('扫码登录')).toHaveCount(0);
    await expect(page.getByText('忘记密码?')).toHaveCount(0);
    await expect(page.getByText('创建账号')).toHaveCount(0);
    await expect(page.getByText('快速选择账号')).toHaveCount(0);
  });
});
