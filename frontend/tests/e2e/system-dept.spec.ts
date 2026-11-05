import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  confirmDialog,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
} from './helpers';

/** 虚拟滚动的树/下拉：滚动页面并累计渲染出的标题 */
async function collectVirtualTitles(
  page: Page,
  container: Locator,
): Promise<string[]> {
  const seen = new Set<string>();
  const holder = container.locator('.ant-select-tree-list-holder').first();
  const hasHolder = (await holder.count()) > 0;
  for (let step = 0; step < 12; step += 1) {
    for (const title of await container
      .locator('.ant-select-tree-title, .ant-tree-title')
      .allInnerTexts()) {
      seen.add(title.trim());
    }
    if (!hasHolder) {
      break;
    }
    const atBottom = await holder.evaluate(
      (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
    );
    if (atBottom) {
      break;
    }
    await holder.evaluate((el) => {
      el.scrollTop += el.clientHeight;
    });
    await page.waitForTimeout(150);
  }
  return [...seen];
}

/**
 * 部门页的名称筛选在前端完成（保留祖先链，A-15），
 * 因此只等待一次列表请求，不按 deptName 查询参数匹配。
 */
async function searchDept(page: Page, deptName: string) {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.getByPlaceholder('请输入部门名称').last().fill(deptName);
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/system/dept/list') &&
      !url.searchParams.has('deptName')
    );
  });
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await loaded;
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/** US4：组织架构（SPEC-003 A-10、A-11、A-15、A-17） */
test.describe('系统管理 - 部门', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('部门页/用户选择器/角色数据权限树一致（A-15）', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/dept');

    const rows = page.locator('.vxe-table--main-wrapper .vxe-body--row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const readNames = async () => {
      const texts = await rows.allInnerTexts();
      return texts
        .map((text) => text.split('\n').map((s) => s.trim()).find(Boolean))
        .filter((name): name is string => !!name);
    };
    // 基线数据的层级：XXX科技 → 深圳总公司 → {研发部门, …, 长沙分公司}
    const baseline = ['XXX科技', '深圳总公司', '研发部门', '长沙分公司'] as const;
    const allNames = await readNames();
    for (const name of baseline) {
      expect(allNames).toContain(name);
    }

    // 筛选保留匹配节点的祖先链
    await searchDept(page, '研发部门');
    await expect
      .poll(readNames)
      .toEqual(['XXX科技', '深圳总公司', '研发部门']);

    // 折叠/展开不改变筛选结果
    const parentRow = rows.filter({ hasText: '深圳总公司' });
    await parentRow.locator('.vxe-cell--tree-btn').click();
    await parentRow.locator('.vxe-cell--tree-btn').click();
    await expect
      .poll(readNames)
      .toEqual(['XXX科技', '深圳总公司', '研发部门']);

    // 用户新增：归属部门选择器
    await gotoAppPath(page, '/system/user');
    await page.getByRole('button', { name: '新增', exact: true }).first().click();
    const userDialog = page.getByRole('dialog', { name: '新增用户' });
    await expect(userDialog).toBeVisible({ timeout: 15_000 });
    await userDialog.getByRole('combobox', { name: '归属部门' }).click();
    const userTitles = await collectVirtualTitles(
      page,
      page.locator('.ant-select-dropdown:visible').last(),
    );
    for (const name of baseline) {
      expect(userTitles).toContain(name);
    }
    // Escape 会先收起下拉；若弹窗（keyboard=true）随之关闭则无需再点取消
    await page.keyboard.press('Escape');
    try {
      await userDialog.waitFor({ state: 'hidden', timeout: 2000 });
    } catch {
      await userDialog.getByRole('button', { name: /取\s*消/ }).click();
    }
    await expect(userDialog).toBeHidden({ timeout: 15_000 });

    // 角色数据权限树
    await gotoAppPath(page, '/system/role');
    const roleRow = await fixedActionRow(page, 'test1');
    await roleRow.getByRole('button', { name: /数据权限/ }).click();
    const drawer = page.getByRole('dialog').last();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await drawer.getByText('自定义数据权限').click();
    await drawer.getByRole('button', { name: '展开' }).click();
    const roleTexts = await drawer.locator('.ant-tree-title').allInnerTexts();
    const roleTitles = roleTexts.map((title) => title.trim());
    for (const name of baseline) {
      expect(roleTitles).toContain(name);
    }
    await drawer.getByRole('button', { name: /取\s*消/ }).click();
  });

  test('新增一级/下级 → 修改 → 删除父部门被拒(601) → 删除子部门 → 删除父部门', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: 15_000 });
    await gotoAppPath(page, '/system/dept');
    await expect(
      page.getByRole('button', { name: '新增', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    const suffix = Date.now();
    const parentName = `e2e_dept_${suffix}`;
    const childName = `e2e_dept_child_${suffix}`;

    // 新增一级部门
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增部门' });
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await createDialog.getByPlaceholder('请输入部门名称').fill(parentName);
    // 后端 insertDept 依赖父部门记录，parentId=0 会抛异常；
    // 用例挂在既有“研发部门”下（SPEC-003 A-11 也只要求“在父部门下新增”）
    const parentSelect = createDialog.getByRole('combobox', {
      name: /上级部门/,
    });
    await parentSelect.click();
    await page
      .locator('.ant-select-dropdown')
      .getByText('研发部门', { exact: true })
      .first()
      .click();
    const parentCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dept') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const parentCreatedResponse = await parentCreated;
    expect(parentCreatedResponse.status()).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: 15_000 });

    // 新增下级
    await searchDept(page, parentName);
    let actions = await fixedActionRow(page, parentName);
    await actions.getByRole('button', { name: /新增下级/ }).click();
    const childDialog = page.getByRole('dialog', { name: '新增部门' });
    await expect(childDialog).toBeVisible({ timeout: 15_000 });
    await childDialog.getByPlaceholder('请输入部门名称').fill(childName);
    const childCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dept') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const childCreatedResponse = await childCreated;
    expect(childCreatedResponse.status()).toBe(200);
    await expect(childDialog).toBeHidden({ timeout: 15_000 });

    // 重置筛选，拿到完整树
    const reloaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return new URL(response.url()).pathname.endsWith('/system/dept/list');
    });
    await page.getByRole('button', { name: /重\s*置/ }).click();
    await reloaded;
    await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
      timeout: 15_000,
    });

    // 修改子部门名称与负责人
    actions = await fixedActionRow(page, childName);
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改部门' });
    await expect(editDialog).toBeVisible({ timeout: 15_000 });
    const renamed = `${childName}_改`;
    await editDialog.getByPlaceholder('请输入部门名称').fill(renamed);
    await editDialog.getByPlaceholder('请输入负责人用户 ID').fill('1');
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dept') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 15_000 });

    // 删除含下级的父部门 → 601
    actions = await fixedActionRow(page, parentName);
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/dept\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const rejectedResponse = await rejected;
    const rejectedBody = await rejectedResponse.json();
    expect(rejectedBody.code).toBe(601);
    await page.getByRole('button', { name: /取\s*消/ }).click();
    await expect(page.locator('.ant-modal-confirm')).toBeHidden({
      timeout: 10_000,
    });

    // 删除叶子子部门 → 200
    actions = await fixedActionRow(page, renamed);
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    const childDeleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/dept\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const childDeletedResponse = await childDeleted;
    expect(childDeletedResponse.status()).toBe(200);
    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: renamed }),
    ).toHaveCount(0, { timeout: 15_000 });

    // 删除父部门 → 200
    actions = await fixedActionRow(page, parentName);
    await actions.getByRole('button', { name: /^删\s*除$/ }).click();
    const parentDeleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/dept\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const parentDeletedResponse = await parentDeleted;
    expect(parentDeletedResponse.status()).toBe(200);
    await expect(
      page
        .locator('.vxe-table--main-wrapper .vxe-body--row')
        .filter({ hasText: parentName }),
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
