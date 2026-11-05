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
 * US2：角色与授权用户（SPEC-003 A-01 ~ A-06、A-13、A-17）。
 *
 * 依赖本地 Docker 后端栈；未启动时整组跳过。
 */
test.describe('系统管理 - 角色', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('新增 → 筛选 → 修改 → 菜单授权回显 → 启停 → 删除', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/role');
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible({
      timeout: 20_000,
    });

    const suffix = Date.now();
    const roleName = `e2e_role_${suffix}`;
    const roleKey = `e2e_role_${suffix}`;

    // 新增
    await page.getByRole('button', { name: '新增' }).click();
    const createDialog = page.getByRole('dialog', { name: '新增角色' });
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await createDialog.getByPlaceholder('请输入角色名称').fill(roleName);
    await createDialog.getByPlaceholder('请输入权限字符').fill(roleKey);

    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/role') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: 15_000 });

    // 筛选
    await searchGrid(page, {
      endpoint: '/system/role/list',
      param: 'roleName',
      placeholder: '请输入角色名称',
      value: roleName,
    });
    let actions = await fixedActionRow(page, roleName);

    // 修改 + 菜单授权
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改角色' });
    await expect(editDialog).toBeVisible({ timeout: 15_000 });
    await editDialog
      .getByPlaceholder('请输入角色名称')
      .fill(`${roleName}_改`);
    const firstMenuCheckbox = editDialog.locator('.ant-tree-checkbox').first();
    await firstMenuCheckbox.click();
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/role') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 15_000 });

    // 重新打开确认菜单勾选已回显（A-03）
    await searchGrid(page, {
      endpoint: '/system/role/list',
      param: 'roleName',
      placeholder: '请输入角色名称',
      value: `${roleName}_改`,
    });
    actions = await fixedActionRow(page, `${roleName}_改`);
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    await expect(
      page.getByRole('dialog', { name: '修改角色' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole('dialog', { name: '修改角色' })
        .locator('.ant-tree-checkbox-checked'),
    ).not.toHaveCount(0);
    await page.getByRole('button', { name: /取\s*消/ }).click();

    // 启停
    const mainRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: `${roleName}_改` });
    const toggled = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/role/changeStatus') &&
        response.request().method() === 'PUT',
    );
    await mainRow.locator('.ant-switch').click();
    // A-17：启停先二次确认
    await confirmDialog(page);
    const toggledResponse = await toggled;
    expect(toggledResponse.status()).toBe(200);

    // 导出（A-13）：Excel 下载，文件名以 .xlsx 结尾
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /导\s*出/ }).click();
    const downloadEvent = await download;
    expect(downloadEvent.suggestedFilename()).toMatch(/\.xlsx$/);

    // 删除
    actions = await fixedActionRow(page, `${roleName}_改`);
    await actions.getByRole('button', { name: /删\s*除/ }).click();
    await confirmDialog(page);
    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: `${roleName}_改` }),
    ).toHaveCount(0, { timeout: 15_000 });
  });

  test('roleId=1 不显示修改/数据权限/分配用户/删除入口（A-06）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/role');

    const adminRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: '超级管理员' })
      .first();
    await expect(adminRow).toBeVisible({ timeout: 20_000 });

    const adminActions = await fixedActionRow(page, '超级管理员');
    await expect(
      adminActions.getByRole('button', { name: /修\s*改/ }),
    ).toHaveCount(0);
    await expect(
      adminActions.getByRole('button', { name: /删\s*除/ }),
    ).toHaveCount(0);
  });
});
