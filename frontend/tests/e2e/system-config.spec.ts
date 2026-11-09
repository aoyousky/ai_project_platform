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

/** 固定夹具（scripts/evals/seed_spec004.sh） */
const CONFIG_KEY = 'spec004.config.key';
const BUILTIN_KEY = 'sys.oss.previewListResource';

function bodyRows(page: Page): Locator {
  return page.locator('.vxe-table--main-wrapper .vxe-body--row');
}

async function waitNoLoading(page: Page): Promise<void> {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/** 操作列在固定区时，按主表行同序号取固定区行。 */
async function actionRow(page: Page, mainRow: Locator): Promise<Locator> {
  const fixedWrapper = page.locator('.vxe-table--fixed-right-wrapper');
  if ((await fixedWrapper.count()) === 0) {
    return mainRow;
  }
  const index = await mainRow.evaluate((el) =>
    [...(el.parentElement?.children ?? [])].indexOf(el),
  );
  return fixedWrapper.locator('.vxe-body--row').nth(index);
}

async function openConfigPage(page: Page): Promise<void> {
  await loginWithCaptcha(page);
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/config');
  await expect(
    page.locator('thead').getByText('参数名称', { exact: true }).first(),
  ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
}

test.describe('系统管理 - 参数设置', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('筛选/新增/修改/删除，内置参数删除被拒，刷新缓存（A-03、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openConfigPage(page);

    // A-03：按参数键名筛选，total 与命中行数一致
    const fixtureLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/config/list') &&
        url.searchParams.get('configKey') === CONFIG_KEY
      );
    });
    await searchGrid(
      page,
      {
        endpoint: '/system/config/list',
        param: 'configKey',
        placeholder: '请输入参数键名',
        value: CONFIG_KEY,
      },
      undefined,
    );
    const fixtureBody = await (await fixtureLoaded).json();
    expect(fixtureBody.total).toBeGreaterThanOrEqual(1);
    expect(fixtureBody.rows).toHaveLength(fixtureBody.total);
    expect(
      (fixtureBody.rows as Array<Record<string, unknown>>).some(
        (row) => row.configKey === CONFIG_KEY,
      ),
    ).toBeTruthy();
    await waitNoLoading(page);

    const suffix = Date.now();
    const configName = `E2E参数_${suffix}`;
    const newKey = `spec004.e2e.key_${suffix}`;
    const initialValue = `e2e_value_a_${suffix}`;
    const updatedValue = `e2e_value_b_${suffix}`;

    // 新增（A-03）：系统内置选“否”，保证后置删除不被内置保护拦截
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增参数' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await createDialog.getByPlaceholder('请输入参数名称').fill(configName);
    await createDialog.getByPlaceholder('请输入参数键名').fill(newKey);
    await createDialog.getByPlaceholder('请输入参数键值').fill(initialValue);
    await createDialog.getByText('否', { exact: true }).click();
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/config') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    expect((await createdResponse.json()).code).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    // 按新键名筛选，确认新增行存在
    const newLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/config/list') &&
        url.searchParams.get('configKey') === newKey
      );
    });
    await searchGrid(
      page,
      {
        endpoint: '/system/config/list',
        param: 'configKey',
        placeholder: '请输入参数键名',
        value: newKey,
      },
      undefined,
    );
    expect((await (await newLoaded).json()).total).toBe(1);
    await expect(bodyRows(page).filter({ hasText: newKey })).toHaveCount(1);

    // 修改参数值（A-03）
    const targetRow = bodyRows(page).filter({ hasText: newKey }).first();
    const targetActions = await actionRow(page, targetRow);
    await targetActions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改参数' });
    await expect(editDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await editDialog.getByPlaceholder('请输入参数键值').fill(updatedValue);
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/config') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()).code).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    await expect(
      bodyRows(page).filter({ hasText: updatedValue }),
    ).toHaveCount(1);

    // 删除新增参数（A-03）
    const updatedRow = bodyRows(page).filter({ hasText: newKey }).first();
    const updatedActions = await actionRow(page, updatedRow);
    await updatedActions.getByRole('button', { name: /^删\s*除$/ }).click();
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/config\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const deletedResponse = await deleted;
    expect(deletedResponse.status()).toBe(200);
    expect((await deletedResponse.json()).code).toBe(200);
    await expect(bodyRows(page)).toHaveCount(0, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    // 删除内置参数被拒（A-03/E-08）：响应 code≠200，行保留
    const builtinLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/config/list') &&
        url.searchParams.get('configKey') === BUILTIN_KEY
      );
    });
    await searchGrid(
      page,
      {
        endpoint: '/system/config/list',
        param: 'configKey',
        placeholder: '请输入参数键名',
        value: BUILTIN_KEY,
      },
      undefined,
    );
    expect((await (await builtinLoaded).json()).total).toBeGreaterThanOrEqual(1);
    const builtinRow = bodyRows(page).filter({ hasText: BUILTIN_KEY }).first();
    const builtinActions = await actionRow(page, builtinRow);
    await builtinActions.getByRole('button', { name: /^删\s*除$/ }).click();
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/system\/config\/\d+$/.test(new URL(response.url()).pathname),
    );
    await confirmDialog(page);
    const rejectedResponse = await rejected;
    expect(rejectedResponse.status()).toBe(200);
    const rejectedBody = await rejectedResponse.json();
    expect(rejectedBody.code).not.toBe(200);
    expect(String(rejectedBody.msg)).toContain('内置参数');
    expect(String(rejectedBody.msg)).toContain('不能删除');
    await expect(bodyRows(page).filter({ hasText: BUILTIN_KEY })).toHaveCount(1);

    // 刷新缓存（A-03）
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.endsWith(
          '/system/config/refreshCache',
        ),
    );
    await page.getByRole('button', { name: '刷新缓存', exact: true }).click();
    await confirmDialog(page);
    const refreshedResponse = await refreshed;
    expect(refreshedResponse.status()).toBe(200);
    expect((await refreshedResponse.json()).code).toBe(200);

    expect(pageErrors).toEqual([]);
  });
});
