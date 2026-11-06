import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  searchGrid,
} from './helpers';

/**
 * SPEC-003 A-17：权限码控制的写入口 + 敏感操作二次确认。
 *
 * - 只读账号 `spec003_readonly` 由 `scripts/evals/seed_spec003.sh` 预置：
 *   只有 role/menu/dept/post 的 list/query 权限码；其角色 key 为 `admin`，
 *   因为 `/system/menu/list` 额外要求 superadmin/admin 角色，普通角色进不了菜单页。
 * - 取消确认后断言“没有发出变更请求”，避免为了验证确认而真的删除夹具数据。
 */

const READONLY_USER = process.env.E2E_READONLY_USER ?? 'spec003_readonly';
const READONLY_PASSWORD = process.env.E2E_READONLY_PASSWORD ?? 'admin123';

/** 记录写请求，用于断言“取消确认后未发起请求” */
function collectMutations(page: Page): string[] {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const method = request.method();
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      mutations.push(`${method} ${new URL(request.url()).pathname}`);
    }
  });
  return mutations;
}

async function cancelConfirm(page: Page) {
  const confirm = page.locator('.ant-modal-confirm');
  await expect(confirm).toBeVisible({ timeout: 30_000 });
  // 页面里还有“批量取消授权/取消授权”按钮，必须限定在确认弹窗内且锚定全文
  await confirm.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(confirm).toBeHidden({ timeout: 30_000 });
}

test.describe('系统管理 - 权限与二次确认', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('只读账号不渲染新增/删除按钮（A-17）', async ({ page }) => {
    await loginWithCaptcha(page, READONLY_USER, READONLY_PASSWORD);
    await expect(page.getByPlaceholder('请输入用户名')).toBeHidden({
      timeout: APP_ENTRY_TIMEOUT,
    });

    const pages = [
      { path: '/system/role', placeholder: '请输入角色名称' },
      { path: '/system/menu', placeholder: '请输入菜单名称' },
      { path: '/system/dept', placeholder: '请输入部门名称' },
      { path: '/system/post', placeholder: '请输入岗位名称' },
    ];

    for (const item of pages) {
      await gotoAppPath(page, item.path);
      // 页面能渲染并加载出数据，排除“路由不可达所以没有按钮”的假阳性
      await expect(page.getByPlaceholder(item.placeholder).last()).toBeVisible({
        timeout: APP_ENTRY_TIMEOUT,
      });
      await expect(
        page.locator('.vxe-table--main-wrapper .vxe-body--row').first(),
      ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
      await expect(
        page.getByRole('button', { name: '新增', exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^删\s*除$/ })).toHaveCount(
        0,
      );
    }
  });

  test('删除/级联删除/取消授权先二次确认，取消后不发请求（A-17）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    const mutations = collectMutations(page);

    // 角色：行内删除
    await gotoAppPath(page, '/system/role');
    await searchGrid(page, {
      endpoint: '/system/role/list',
      param: 'roleName',
      placeholder: '请输入角色名称',
      value: 'Spec003 角色',
    });
    const roleRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 角色' });
    let actions = await fixedActionRow(page, 'Spec003 角色');
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    await cancelConfirm(page);
    await expect(roleRow).toBeVisible();

    // 菜单：级联删除（只对含子节点的行渲染，筛选后子节点被过滤掉，故用完整树）
    await gotoAppPath(page, '/system/menu');
    await expect(
      page.getByPlaceholder('请输入菜单名称').last(),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const menuRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 目录' });
    await expect(menuRow).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    actions = await fixedActionRow(page, 'Spec003 目录');
    await actions.getByRole('button', { name: /级联删除/ }).click();
    await cancelConfirm(page);
    await expect(menuRow).toBeVisible();

    // 部门：行内删除（部门筛选在前端完成，直接按行文本定位）
    await gotoAppPath(page, '/system/dept');
    await expect(
      page.getByPlaceholder('请输入部门名称').last(),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const deptRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 空部门' });
    actions = await fixedActionRow(page, 'Spec003 空部门');
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    await cancelConfirm(page);
    await expect(deptRow).toBeVisible();

    // 岗位：行内删除
    await gotoAppPath(page, '/system/post');
    await searchGrid(page, {
      endpoint: '/system/post/list',
      param: 'postName',
      placeholder: '请输入岗位名称',
      value: 'Spec003 引用岗位',
    });
    const postRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 引用岗位' });
    actions = await fixedActionRow(page, 'Spec003 引用岗位');
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    await cancelConfirm(page);
    await expect(postRow).toBeVisible();

    // 取消授权：spec003_assigned 绑定了 spec003_user
    await gotoAppPath(page, '/system/role-auth/user/900003000000000007');
    const authRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'spec003_user' });
    await expect(authRow).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    actions = await fixedActionRow(page, 'spec003_user');
    await actions.getByRole('button', { name: /取消授权/ }).click();
    await cancelConfirm(page);
    await expect(authRow).toBeVisible();

    // 期间没有任何写请求发出
    await page.waitForTimeout(500);
    expect(mutations).toEqual([]);
  });

  test('启停先二次确认，取消后不发状态变更请求（A-17）', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    const mutations = collectMutations(page);

    // 角色启停
    await gotoAppPath(page, '/system/role');
    await searchGrid(page, {
      endpoint: '/system/role/list',
      param: 'roleName',
      placeholder: '请输入角色名称',
      value: 'Spec003 角色',
    });
    const roleRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 角色' });
    await roleRow.locator('.ant-switch').click();
    await cancelConfirm(page);
    await expect(roleRow).toBeVisible();

    // 岗位启停
    await gotoAppPath(page, '/system/post');
    await searchGrid(page, {
      endpoint: '/system/post/list',
      param: 'postName',
      placeholder: '请输入岗位名称',
      value: 'Spec003 引用岗位',
    });
    const postRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: 'Spec003 引用岗位' });
    await postRow.locator('.ant-switch').click();
    await cancelConfirm(page);
    await expect(postRow).toBeVisible();

    await page.waitForTimeout(500);
    expect(mutations).toEqual([]);
  });
});
