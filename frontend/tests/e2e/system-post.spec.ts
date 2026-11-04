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
 * US5：岗位管理（SPEC-003 A-12、E-27）。
 *
 * 岗位没有独立状态端点，启停走 `PUT /system/post`；被引用岗位的拒绝删除
 * 需要专用夹具，由评测集 `specs/evals/REQ-20261104-003` 覆盖。
 */
test.describe('系统管理 - 岗位', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('新增 → 筛选 → 修改 → 启停 → 导出 → 删除', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/post');
    await expect(
      page.getByRole('button', { name: '新增', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    const suffix = Date.now();
    const postCode = `e2e_post_${suffix}`;
    const postName = `e2e岗位_${suffix}`;

    // 新增（选择所属部门；岗位必须挂在部门下）
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增岗位' });
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await createDialog.getByRole('combobox', { name: /所属部门/ }).click();
    await page
      .locator('.ant-select-dropdown')
      .getByText('研发部门', { exact: true })
      .first()
      .click();
    await createDialog.getByPlaceholder('请输入岗位编码').fill(postCode);
    await createDialog.getByPlaceholder('请输入岗位名称').fill(postName);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/post') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: 15_000 });

    // 筛选
    await searchGrid(page, {
      endpoint: '/system/post/list',
      param: 'postName',
      placeholder: '请输入岗位名称',
      value: postName,
    });

    // 修改名称
    let actions = await fixedActionRow(page, postName);
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改岗位' });
    await expect(editDialog).toBeVisible({ timeout: 15_000 });
    const renamed = `${postName}_改`;
    await editDialog.getByPlaceholder('请输入岗位名称').fill(renamed);
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/post') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 15_000 });

    // 启停：岗位无独立状态端点，提交 PUT /system/post
    const mainRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: renamed });
    const toggled = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/post') &&
        response.request().method() === 'PUT',
    );
    await mainRow.locator('.ant-switch').click();
    const toggledResponse = await toggled;
    expect(toggledResponse.status()).toBe(200);

    // 导出
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /导\s*出/ }).click();
    const downloadEvent = await download;
    expect(downloadEvent.suggestedFilename()).toMatch(/\.xlsx$/);

    // 删除
    actions = await fixedActionRow(page, renamed);
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/post\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const deletedResponse = await deleted;
    expect(deletedResponse.status()).toBe(200);
    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: renamed }),
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
