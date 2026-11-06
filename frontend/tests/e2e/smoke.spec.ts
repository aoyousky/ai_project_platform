import { expect, test } from '@playwright/test';

import { APP_ENTRY_TIMEOUT, isBackendUp, loginWithCaptcha } from './helpers';

/**
 * T009 冒烟：未登录访问根路径落到登录页；登录后落到 `/index`（FR-015、A-01）。
 * 依赖本地 Docker 后端栈（quickstart §1）。
 */
test.describe('冒烟', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isBackendUp()),
      '本地后端栈未启动（deploy/docker compose up -d）',
    );
  });

  test('未登录访问根路径落到登录页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
  });

  test('登录成功后落到 /index', async ({ page }) => {
    await loginWithCaptcha(page);

    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  });
});
