import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  confirmDialog,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  searchGrid,
} from './helpers';

/**
 * SPEC-003 A-19：列表失败/空态与状态开关回滚。
 *
 * 用 `page.route` 把请求可控地打失败（HTTP 500 / 业务 code≠200），
 * 验证页面不会停留在无限加载，并把错误提示（后端 msg 原文）展示给用户。
 */

type ToastWindow = Window & { __toasts?: string[] };

/** 在每次页面加载时记录出现过的 toast 文案（toast 3s 后消失，事后断言会漏） */
const TOAST_RECORDER = () => {
  const w = window as ToastWindow;
  w.__toasts = [];
  const record = () => {
    for (const el of document.querySelectorAll(
      '.ant-message-notice-title, .ant-message-notice-content',
    )) {
      const text = el.textContent?.trim();
      if (text && !w.__toasts!.includes(text)) {
        w.__toasts!.push(text);
      }
    }
  };
  record();
  new MutationObserver(record).observe(document, {
    childList: true,
    subtree: true,
  });
};

function toasts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as ToastWindow).__toasts ?? []);
}

test.describe('系统管理 - 失败态', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('列表请求失败展示错误提示且不进入无限加载（A-19）', async ({
    page,
  }) => {
    await page.addInitScript(TOAST_RECORDER);
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    const cases = [
      { endpoint: '**/system/role/list*', msg: '模拟角色列表失败', path: '/system/role' },
      { endpoint: '**/system/menu/list*', msg: '模拟菜单列表失败', path: '/system/menu' },
      { endpoint: '**/system/dept/list*', msg: '模拟部门列表失败', path: '/system/dept' },
      { endpoint: '**/system/post/list*', msg: '模拟岗位列表失败', path: '/system/post' },
    ];

    for (const item of cases) {
      await page.route(item.endpoint, (route) =>
        route.fulfill({
          body: JSON.stringify({ code: 500, msg: item.msg }),
          contentType: 'application/json',
          status: 500,
        }),
      );
      await gotoAppPath(page, item.path);

      // 错误提示：后端 msg 原文
      await expect.poll(() => toasts(page), { timeout: APP_ENTRY_TIMEOUT }).toContain(
        item.msg,
      );
      // 不出现无限加载
      await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
        timeout: APP_ENTRY_TIMEOUT,
      });

      await page.unroute(item.endpoint);
    }
  });

  test('状态开关失败后回滚为原状态（A-19）', async ({ page }) => {
    await page.addInitScript(TOAST_RECORDER);
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/role');
    await searchGrid(page, {
      endpoint: '/system/role/list',
      param: 'roleName',
      placeholder: '请输入角色名称',
      value: 'Spec003 角色',
    });

    const row = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 角色' });
    const statusSwitch = row.locator('.ant-switch');
    // 夹具角色 status='0'（正常）
    await expect(statusSwitch).toHaveAttribute('aria-checked', 'true');

    await page.route('**/system/role/changeStatus*', (route) =>
      route.fulfill({
        body: JSON.stringify({ code: 500, msg: '模拟启停失败' }),
        contentType: 'application/json',
        status: 200,
      }),
    );
    const changed = page.waitForRequest((request) =>
      request.url().includes('/system/role/changeStatus'),
    );

    await statusSwitch.click();
    await confirmDialog(page);
    await changed;

    await expect.poll(() => toasts(page), { timeout: APP_ENTRY_TIMEOUT }).toContain(
      '模拟启停失败',
    );
    // 回滚：开关恢复为原状态，且列表未停留在错误态
    await expect(statusSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    await page.unroute('**/system/role/changeStatus*');
  });
});
