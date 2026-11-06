import { expect, test } from '@playwright/test';

import { APP_ENTRY_TIMEOUT, isBackendUp, loginWithCaptcha } from './helpers';

const ACCESS_STORE_KEY = 'vben-web-antdv-next-access';

async function readStoredAccessToken(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).accessToken : null;
  }, ACCESS_STORE_KEY);
}

/**
 * T021：会话生命周期（A-09、A-10、E-12、E-13）。
 */
test.describe('会话', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isBackendUp()),
      '本地后端栈未启动（deploy/docker compose up -d）',
    );
  });

  test('主动登出：清会话、回登录页、后退不回到已登录界面（A-09、E-13）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    // 用户菜单快捷键 Alt+Q 打开登出确认框
    await page.keyboard.press('Alt+Q');
    await page.getByRole('button', { name: /确\s*认/ }).click();

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: APP_ENTRY_TIMEOUT });
    expect(await readStoredAccessToken(page)).toBeFalsy();

    await page.goBack();
    // router.replace 会把当前历史项替换为 /auth/login；再后退可能落到浏览器初始的
    // about:blank。两者都不得是已登录界面，因此接受二者之一。
    const urlAfterBack = page.url();
    expect(
      urlAfterBack === 'about:blank' || urlAfterBack.includes('/auth/login'),
    ).toBe(true);
    if (urlAfterBack !== 'about:blank') {
      await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
    }
    await expect(page.getByText('首页', { exact: true })).toHaveCount(0);
  });

  test('令牌失效（业务 401）：清会话并回登录页，无未捕获异常（A-10、E-12）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    let pageErrors = 0;
    page.on('pageerror', () => {
      pageErrors += 1;
    });

    await page.route('**/system/user/getInfo', (route) =>
      route.fulfill({
        body: JSON.stringify({ code: 401, msg: '认证失败，无法访问系统资源' }),
        contentType: 'application/json',
        status: 200,
      }),
    );

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: APP_ENTRY_TIMEOUT });
    expect(await readStoredAccessToken(page)).toBeFalsy();
    expect(pageErrors).toBe(0);
  });
});
