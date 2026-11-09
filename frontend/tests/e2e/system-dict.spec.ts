import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  confirmDialog,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  searchGrid,
} from './helpers';

/** 固定夹具字典类型（scripts/evals/seed_spec004.sh） */
const DICT_TYPE = 'spec004_dict_type';

const typePanel = (page: Page) => page.locator('[data-panel="dict-type"]');
const dataPanel = (page: Page) => page.locator('[data-panel="dict-data"]');

function bodyRows(panel: Locator): Locator {
  return panel.locator('.vxe-table--main-wrapper .vxe-body--row');
}

async function waitNoLoading(panel: Locator): Promise<void> {
  await expect(panel.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/**
 * 操作列在固定区独立渲染时，按主表行同序号取固定区行。
 * 与 helpers.actionRowFor 相同，但限定在单个表格面板内（字典页有两个 grid）。
 */
async function actionRowIn(panel: Locator, mainRow: Locator): Promise<Locator> {
  const fixedWrapper = panel.locator('.vxe-table--fixed-right-wrapper');
  if ((await fixedWrapper.count()) === 0) {
    return mainRow;
  }
  const index = await mainRow.evaluate((el) =>
    [...(el.parentElement?.children ?? [])].indexOf(el),
  );
  return fixedWrapper.locator('.vxe-body--row').nth(index);
}

async function openDictPage(page: Page, dictType = DICT_TYPE): Promise<string> {
  await loginWithCaptcha(page);
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/dict');
  await expect(typePanel(page)).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });

  const typeListLoaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/system/dict/type/list') &&
      url.searchParams.get('dictType') === dictType
    );
  });
  await searchGrid(
    page,
    {
      endpoint: '/system/dict/type/list',
      param: 'dictType',
      placeholder: '请输入字典类型',
      value: dictType,
    },
    typePanel(page),
  );
  const listResponse = await typeListLoaded;
  const listBody = await listResponse.json();
  const row = (listBody.rows as Array<Record<string, unknown>>).find(
    (item) => item.dictType === dictType,
  );
  expect(row, `夹具 ${dictType} 不存在，请先运行 scripts/evals/seed_spec004.sh`)
    .toBeTruthy();
  return String(row!.dictId);
}

async function selectTypeRow(page: Page, dictType = DICT_TYPE): Promise<void> {
  const row = bodyRows(typePanel(page))
    .filter({ hasText: dictType })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByText(dictType, { exact: true }).click();
}

test.describe('系统管理 - 字典', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('双栏联动：新增/修改/删除数据，删除类型被拒（A-01、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openDictPage(page);
    await expect(
      typePanel(page).locator('thead').getByText('字典名称', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      typePanel(page).locator('thead').getByText('字典类型', { exact: true }).first(),
    ).toBeVisible();

    const dataLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/dict/data/list') &&
        url.searchParams.get('dictType') === DICT_TYPE
      );
    });
    await selectTypeRow(page);
    await dataLoaded;
    await waitNoLoading(dataPanel(page));

    await expect(
      dataPanel(page).locator('thead').getByText('字典标签', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      dataPanel(page).locator('thead').getByText('字典键值', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      dataPanel(page).locator('thead').getByText('字典排序', { exact: true }).first(),
    ).toBeVisible();
    await expect(bodyRows(dataPanel(page))).toHaveCount(2);

    const suffix = Date.now();
    const label = `E2E字典标签_${suffix}`;
    const renamed = `${label}_改`;

    // 新增（A-01：2 → 3）
    await dataPanel(page)
      .getByRole('button', { name: '新增', exact: true })
      .click();
    const createDialog = page.getByRole('dialog', { name: '新增字典数据' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await createDialog.getByPlaceholder('请输入字典标签').fill(label);
    await createDialog.getByPlaceholder('请输入字典键值').fill(`e2e_value_${suffix}`);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dict/data') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    expect((await created).status()).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    await expect(bodyRows(dataPanel(page))).toHaveCount(3, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    // 修改（A-01：3 → 3）
    const targetRow = bodyRows(dataPanel(page)).filter({ hasText: label }).first();
    const targetActions = await actionRowIn(dataPanel(page), targetRow);
    await targetActions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改字典数据' });
    await expect(editDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await editDialog.getByPlaceholder('请输入字典标签').fill(renamed);
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dict/data') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    expect((await updated).status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    await expect(bodyRows(dataPanel(page)).filter({ hasText: renamed })).toHaveCount(1);
    await expect(bodyRows(dataPanel(page))).toHaveCount(3);

    // 删除数据（A-01：3 → 2）
    const renamedRow = bodyRows(dataPanel(page)).filter({ hasText: renamed }).first();
    const renamedActions = await actionRowIn(dataPanel(page), renamedRow);
    await renamedActions.getByRole('button', { name: /^删\s*除$/ }).click();
    const deletedData = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/dict\/data\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    expect((await deletedData).status()).toBe(200);
    await expect(bodyRows(dataPanel(page))).toHaveCount(2, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    // 删除仍有数据的类型：后端拒绝，类型与数据保留（A-01 反例）
    const typeRow = bodyRows(typePanel(page)).filter({ hasText: DICT_TYPE }).first();
    const typeActions = await actionRowIn(typePanel(page), typeRow);
    await typeActions.getByRole('button', { name: /^删\s*除$/ }).click();
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/dict\/type\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const rejectedResponse = await rejected;
    expect(rejectedResponse.status()).toBe(200);
    const rejectedBody = await rejectedResponse.json();
    expect(rejectedBody.code).not.toBe(200);
    expect(String(rejectedBody.msg)).toContain('已分配');
    await expect(bodyRows(typePanel(page))).toHaveCount(1);
    await expect(bodyRows(dataPanel(page))).toHaveCount(2);

    expect(pageErrors).toEqual([]);
  });

  test('隐藏字典数据页：直连、修改标签、刷新保留（A-02、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const dictId = await openDictPage(page);

    const dataLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/dict/data/list') &&
        url.searchParams.get('dictType') === DICT_TYPE
      );
    });
    await gotoAppPath(page, `/system/dict-data/index/${dictId}`);
    const response = await dataLoaded;
    const body = await response.json();
    const first = (body.rows as Array<Record<string, unknown>>)[0];
    expect(first).toBeTruthy();
    const dictCode = String(first!.dictCode);
    const originalLabel = String(first!.dictLabel);

    await expect(dataPanel(page)).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(
      dataPanel(page).locator('thead').getByText('字典标签', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      dataPanel(page).locator('thead').getByText('字典键值', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('即将推出')).toHaveCount(0);
    await expect(bodyRows(dataPanel(page))).toHaveCount(2, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    const suffix = Date.now();
    const newLabel = `E2E隐藏页标签_${suffix}`;
    const firstRow = bodyRows(dataPanel(page)).filter({ hasText: originalLabel }).first();
    const actions = await actionRowIn(dataPanel(page), firstRow);
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const dialog = page.getByRole('dialog', { name: '修改字典数据' });
    await expect(dialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await dialog.getByPlaceholder('请输入字典标签').fill(newLabel);
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dict/data') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    expect((await updated).status()).toBe(200);
    await expect(dialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    // 刷新后仍显示新标签（A-02）
    await gotoAppPath(page, `/system/dict-data/index/${dictId}`);
    await expect(
      bodyRows(dataPanel(page)).filter({ hasText: newLabel }),
    ).toHaveCount(1, { timeout: APP_ENTRY_TIMEOUT });
    expect(dictCode).toBeTruthy();

    // 还原夹具标签，避免影响其他用例
    const newRow = bodyRows(dataPanel(page)).filter({ hasText: newLabel }).first();
    const newActions = await actionRowIn(dataPanel(page), newRow);
    await newActions.getByRole('button', { name: /修\s*改/ }).click();
    const revertDialog = page.getByRole('dialog', { name: '修改字典数据' });
    await expect(revertDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await revertDialog.getByPlaceholder('请输入字典标签').fill(originalLabel);
    const reverted = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/dict/data') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    expect((await reverted).status()).toBe(200);
    await expect(revertDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    expect(pageErrors).toEqual([]);
  });
});
