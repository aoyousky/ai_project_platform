import { expect, test } from '@playwright/test';

import {
  confirmDialog,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  searchGrid,
} from './helpers';

/**
 * US3：菜单与权限标识（SPEC-003 A-07 ~ A-09、A-14、A-17）。
 *
 * 菜单接口只放行 superadmin / 租户管理员；用例使用 admin 登录。
 */
test.describe('系统管理 - 菜单', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('新增目录 → 新增子菜单 → 普通删除被拒(601) → 级联删除', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/menu');
    await expect(page.getByRole('button', { name: '新增', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const suffix = Date.now();
    const parentName = `e2e_menu_${suffix}`;
    const childName = `e2e_child_${suffix}`;

    // 新增目录
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增菜单' });
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await createDialog.getByPlaceholder('请输入菜单名称').fill(parentName);
    await createDialog
      .getByPlaceholder('请输入路由地址，如 user')
      .fill(`m_${suffix}`);
    const parentCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/menu') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const parentCreatedResponse = await parentCreated;
    expect(parentCreatedResponse.status()).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: 15_000 });

    // 筛选目录并新增下级菜单
    await searchGrid(page, {
      endpoint: '/system/menu/list',
      param: 'menuName',
      placeholder: '请输入菜单名称',
      value: parentName,
    });
    let actions = await fixedActionRow(page, parentName);
    await actions.getByRole('button', { name: /新增下级/ }).click();
    const childDialog = page.getByRole('dialog', { name: '新增菜单' });
    await expect(childDialog).toBeVisible({ timeout: 15_000 });
    await childDialog.getByText('菜单', { exact: true }).click();
    await childDialog.getByPlaceholder('请输入菜单名称').fill(childName);
    await childDialog
      .getByPlaceholder('请输入路由地址，如 user')
      .fill(`c_${suffix}`);
    await childDialog
      .getByPlaceholder('请输入组件路径，如 system/user/index')
      .fill('system/user/index');
    const childCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/menu') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const childCreatedResponse = await childCreated;
    expect(childCreatedResponse.status()).toBe(200);
    await expect(childDialog).toBeHidden({ timeout: 15_000 });

    // 重置筛选，拿到完整树后执行删除
    const reloaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/menu/list') &&
        !url.searchParams.has('menuName')
      );
    });
    await page.getByRole('button', { name: /重\s*置/ }).click();
    await reloaded;
    await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
      timeout: 15_000,
    });

    actions = await fixedActionRow(page, parentName);

    // 普通删除含子菜单 → 后端 601（HTTP 200）
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    const singleDelete = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/menu\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const singleDeleteResponse = await singleDelete;
    const singleBody = await singleDeleteResponse.json();
    expect(singleBody.code).toBe(601);
    // 失败时确认弹窗保持打开，先关闭再执行级联删除
    await page.getByRole('button', { name: /取\s*消/ }).click();
    await expect(page.locator('.ant-modal-confirm')).toBeHidden({
      timeout: 10_000,
    });

    // 级联删除必须提交父节点及全部后代 ID（E-12）
    actions = await fixedActionRow(page, parentName);
    await actions.getByRole('button', { name: /级联删除/ }).click();
    const cascadeDelete = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.includes('/system/menu/cascade/'),
    );
    await confirmDialog(page);
    const cascadeResponse = await cascadeDelete;
    const idSegments = new URL(cascadeResponse.url()).pathname
      .split('/')
      .pop()!
      .split(',');
    expect(idSegments.length).toBe(2);
    const cascadeBody = await cascadeResponse.json();
    expect(cascadeBody.code).toBe(200);

    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: parentName }),
    ).toHaveCount(0, { timeout: 15_000 });
  });

  test('菜单类型切换控制字段显隐（A-14）', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/menu');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '新增菜单' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const routePath = dialog.getByPlaceholder('请输入路由地址，如 user');
    const componentPath = dialog.getByPlaceholder(
      '请输入组件路径，如 system/user/index',
    );
    const perms = dialog.getByPlaceholder('请输入权限标识，如 system:user:add');
    const activeRoute = dialog.getByPlaceholder(
      '请输入激活路由，必须以 / 开头',
    );

    // 默认目录（M）：路由地址 + 组件路径可见，权限标识不可见
    await expect(routePath).toBeVisible();
    await expect(componentPath).toBeVisible();
    await expect(perms).toBeHidden();

    // 按钮（F）：只保留权限标识
    await dialog.getByText('按钮', { exact: true }).click();
    await expect(perms).toBeVisible();
    await expect(routePath).toBeHidden();
    await expect(componentPath).toBeHidden();

    // 菜单（C）+ 隐藏：出现激活路由
    await dialog.getByText('菜单', { exact: true }).click();
    await expect(routePath).toBeVisible();
    await expect(componentPath).toBeVisible();
    await dialog.getByText('隐藏', { exact: true }).click();
    await expect(activeRoute).toBeVisible();

    await page.getByRole('button', { name: /取\s*消/ }).click();
  });
});
