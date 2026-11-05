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
    // A-17：启停先二次确认
    await confirmDialog(page);
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

  test('用户表单只列未停用岗位，保存后详情 postIds 一致（A-16）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/post');
    await expect(
      page.getByRole('button', { name: '新增', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    const suffix = Date.now();
    const enabledName = `e2e岗位启用_${suffix}`;
    const disabledName = `e2e岗位停用_${suffix}`;

    const createPost = async (postCode: string, postName: string) => {
      await page.getByRole('button', { name: '新增', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '新增岗位' });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await dialog.getByRole('combobox', { name: /所属部门/ }).click();
      await page
        .locator('.ant-select-dropdown')
        .getByText('研发部门', { exact: true })
        .first()
        .click();
      await dialog.getByPlaceholder('请输入岗位编码').fill(postCode);
      await dialog.getByPlaceholder('请输入岗位名称').fill(postName);
      const created = page.waitForResponse(
        (response) =>
          response.url().endsWith('/system/post') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: /确\s*认/ }).click();
      const createdResponse = await created;
      expect(createdResponse.status()).toBe(200);
      await expect(dialog).toBeHidden({ timeout: 15_000 });
    };

    await createPost(`e2e_post_on_${suffix}`, enabledName);
    await createPost(`e2e_post_off_${suffix}`, disabledName);

    // 停用第二个岗位（岗位无独立状态端点，PUT /system/post）
    await searchGrid(page, {
      endpoint: '/system/post/list',
      param: 'postName',
      placeholder: '请输入岗位名称',
      value: disabledName,
    });
    const disabledRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: disabledName });
    const toggled = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/post') &&
        response.request().method() === 'PUT',
    );
    await disabledRow.locator('.ant-switch').click();
    await confirmDialog(page);
    const toggledResponse = await toggled;
    expect(toggledResponse.status()).toBe(200);

    // 取启用岗位的 postId（按唯一 postName 筛选列表）
    const listLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/post/list') &&
        url.searchParams.get('postName') === enabledName
      );
    });
    await searchGrid(page, {
      endpoint: '/system/post/list',
      param: 'postName',
      placeholder: '请输入岗位名称',
      value: enabledName,
    });
    const listResponse = await listLoaded;
    const listBody = await listResponse.json();
    const enabledRow = (listBody.rows as Array<Record<string, unknown>>).find(
      (row) => row.postName === enabledName,
    );
    expect(enabledRow).toBeTruthy();
    const enabledPostId = String(enabledRow!.postId);

    // 用户新增页：岗位选择器只列未停用岗位
    await gotoAppPath(page, '/system/user');
    await page.getByRole('button', { name: '新增', exact: true }).first().click();
    const userDialog = page.getByRole('dialog', { name: '新增用户' });
    await expect(userDialog).toBeVisible({ timeout: 15_000 });

    await userDialog.getByRole('combobox', { name: '岗位' }).click();
    const postDropdown = page.locator('.ant-select-dropdown:visible').last();
    const readPostOptions = async () => {
      const texts = await postDropdown
        .locator('.ant-select-item-option')
        .allInnerTexts();
      return texts.map((text) => text.trim());
    };
    await expect.poll(readPostOptions).toContain(enabledName);
    expect(await readPostOptions()).not.toContain(disabledName);
    await postDropdown.getByText(enabledName, { exact: true }).click();
    await userDialog.getByPlaceholder('请输入用户名称').click();

    const userName = `e2e_post_user_${suffix}`;
    await userDialog.getByPlaceholder('请输入用户名称').fill(userName);
    await userDialog.getByPlaceholder('请输入用户昵称').fill(`岗位用户${suffix}`);
    await userDialog.getByPlaceholder('请输入用户密码').fill('E2e@123456');
    // 详情接口仅在用户有部门时回填 posts/postIds，故必须选择归属部门
    await userDialog.getByRole('combobox', { name: '归属部门' }).click();
    await page
      .locator('.ant-select-dropdown:visible')
      .last()
      .getByText('研发部门', { exact: true })
      .first()
      .click();
    await userDialog.getByPlaceholder('请输入用户名称').click();
    // 后端 roleIds @Size(min=1)
    await userDialog.getByRole('combobox', { name: '角色' }).click();
    await page
      .locator('.ant-select-dropdown:visible')
      .last()
      .locator('.ant-select-item-option')
      .first()
      .click();
    await userDialog.getByPlaceholder('请输入用户名称').click();

    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/user') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    await expect(userDialog).toBeHidden({ timeout: 15_000 });

    // 用户详情 postIds 与所选一致
    await searchGrid(page, {
      endpoint: '/system/user/list',
      param: 'userName',
      placeholder: '请输入用户名称',
      value: userName,
    });
    const actions = await fixedActionRow(page, userName);
    const detailLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return /\/system\/user\/\d+$/.test(new URL(response.url()).pathname);
    });
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const detailResponse = await detailLoaded;
    const detailBody = await detailResponse.json();
    expect((detailBody.data.postIds ?? []).map(String)).toEqual([enabledPostId]);
    await page.getByRole('button', { name: /取\s*消/ }).click();

    // 清理：先删用户（岗位被引用时不可删），再删岗位
    await page
      .locator('.vxe-table--main-wrapper .vxe-body--row', {
        hasText: userName,
      })
      .locator('.vxe-cell--checkbox .vxe-checkbox--icon')
      .first()
      .click();
    await page.getByRole('button', { name: /删\s*除/ }).first().click();
    await confirmDialog(page);
    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: userName }),
    ).toHaveCount(0, { timeout: 15_000 });

    await gotoAppPath(page, '/system/post');
    for (const name of [enabledName, disabledName]) {
      await searchGrid(page, {
        endpoint: '/system/post/list',
        param: 'postName',
        placeholder: '请输入岗位名称',
        value: name,
      });
      const postActions = await fixedActionRow(page, name);
      await postActions.getByRole('button', { name: /^删\s*除$/ }).click();
      await confirmDialog(page);
      await expect(
        page
          .locator('.vxe-table--main-wrapper .vxe-body--row')
          .filter({ hasText: name }),
      ).toHaveCount(0, { timeout: 15_000 });
    }
  });
});
