import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  confirmDialog,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  seedSpec004Fixtures,
} from './helpers';

/** 固定夹具（scripts/evals/seed_spec004.sh） */
const FIXTURE_TITLE = 'Spec004 操作';
const FIXTURE_OPER_NAME = 'spec004_operator';
const FIXTURE_OPER_ID = '900004000000000006';

async function waitNoLoading(page: import('@playwright/test').Page) {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function openOperLogPage(page: import('@playwright/test').Page) {
  await loginWithCaptcha(page);
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/log/operlog');
  // A-10：日志编号表头可见，且不落到占位页 / 403 / 404
  await expect(
    page.locator('thead').getByText('日志编号', { exact: true }).first(),
  ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  await expect(page.getByText('即将推出')).toHaveCount(0);
}

/** 同时按系统模块与操作人员筛选，等待本次列表响应 */
async function searchOperLog(
  page: import('@playwright/test').Page,
  title: string,
  operName: string,
): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/operlog/list') &&
      url.searchParams.get('title') === title &&
      url.searchParams.get('operName') === operName
    );
  });
  await page.getByPlaceholder('请输入系统模块').fill(title);
  await page.getByPlaceholder('请输入操作人员').fill(operName);
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

/** 清空筛选条件并等待无 title 条件的列表响应 */
async function resetFilters(page: import('@playwright/test').Page): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/operlog/list') &&
      !url.searchParams.has('title')
    );
  });
  await page.getByRole('button', { name: /重\s*置/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

/** 点表头排序并等待带排序参数的列表响应 */
async function sortByHeader(
  page: import('@playwright/test').Page,
  header: string,
  direction: 'asc' | 'desc',
): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/operlog/list') &&
      url.searchParams.get('orderByColumn') === 'operTime' &&
      url.searchParams.get('isAsc') === direction
    );
  });
  // vxe 会额外渲染隐藏的表头测量节点，按可访问的列头定位唯一目标
  await page
    .getByRole('columnheader', { name: new RegExp(header) })
    .click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

/** `YYYY-MM-DD HH:mm:ss` → 可比较毫秒值 */
function timeValue(raw: unknown): number {
  const text = String(raw ?? '');
  return Date.parse(text.replaceAll('-', '/'));
}

function assertAscending(rows: Array<Record<string, any>>, direction: string) {
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (let index = 1; index < rows.length; index++) {
    const previous = timeValue(rows[index - 1]?.operTime);
    const current = timeValue(rows[index]?.operTime);
    expect(Number.isNaN(previous) || Number.isNaN(current)).toBe(false);
    if (direction === 'asc') {
      expect(previous).toBeLessThanOrEqual(current);
    } else {
      expect(previous).toBeGreaterThanOrEqual(current);
    }
  }
}

test.describe('监控管理 - 操作日志', () => {
  test.beforeAll(async () => {
    const backendUp = await isBackendUp();
    test.skip(!backendUp, '本地后端栈未启动');
    if (!backendUp) {
      return;
    }
    // A-05 会删除夹具；单独重跑前先幂等补种
    seedSpec004Fixtures();
  });

  test('筛选/详情/导出/删除/排序（A-05、A-10、A-18）', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openOperLogPage(page);

    // A-05：按系统模块 + 操作人员筛选，列表行数据完整
    const list = await searchOperLog(page, FIXTURE_TITLE, FIXTURE_OPER_NAME);
    expect(list.total).toBeGreaterThanOrEqual(1);
    const fixture = list.rows.find(
      (row: Record<string, any>) => String(row.operId) === FIXTURE_OPER_ID,
    );
    expect(fixture).toBeTruthy();
    expect(fixture.title).toBe(FIXTURE_TITLE);
    expect(fixture.operName).toBe(FIXTURE_OPER_NAME);
    expect(fixture.operParam).toBe('{"key":"value"}');
    expect(fixture.jsonResult).toBe('{"code":200,"msg":"操作成功"}');
    expect(fixture.status).toBe(0);
    expect(fixture.costTime).toBe(123);
    expect(String(fixture.operTime ?? '')).not.toBe('');

    const fixtureRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row')
      .filter({ hasText: FIXTURE_TITLE })
      .first();
    await expect(fixtureRow).toHaveCount(1);
    await expect(fixtureRow).toContainText(FIXTURE_OPER_NAME);
    await expect(fixtureRow).toContainText('123');
    await expect(fixtureRow).toContainText('成功');

    // A-05：详情弹窗展示可读 JSON 的请求参数与返回参数，不展示 tenantId
    const fixtureActions = await fixedActionRow(page, FIXTURE_TITLE);
    await fixtureActions.getByRole('button', { name: /详\s*情/ }).click();
    const detailDialog = page.getByRole('dialog', { name: '操作日志详情' });
    await expect(detailDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(detailDialog).toContainText('请求参数');
    await expect(detailDialog).toContainText('返回参数');
    await expect(detailDialog).toContainText('"key": "value"');
    await expect(detailDialog).toContainText('"code": 200');
    await expect(detailDialog).toContainText('"msg": "操作成功"');
    await expect(detailDialog).not.toContainText('tenantId');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    // A-05：导出当前筛选结果，HTTP 200 且响应体非空
    const exported = page.waitForResponse(
      (response) =>
        response.url().includes('/monitor/operlog/export') &&
        response.request().method() === 'POST',
    );
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /导\s*出/ }).click();
    const exportResponse = await exported;
    const downloadEvent = await download;
    expect(exportResponse.status()).toBe(200);
    const contentType = String(
      (await exportResponse.allHeaders())['content-type'] ?? '',
    );
    expect(contentType).toMatch(/spreadsheetml|octet-stream/i);
    expect((await exportResponse.body()).byteLength).toBeGreaterThan(0);
    expect(downloadEvent.suggestedFilename()).toMatch(/\.xlsx$/i);

    // A-05：删除该条，响应 code=200 且当前筛选结果 total 归零
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.endsWith(
          `/monitor/operlog/${FIXTURE_OPER_ID}`,
        ),
    );
    const reloadedAfterDelete = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/monitor/operlog/list') &&
        url.searchParams.get('title') === FIXTURE_TITLE &&
        url.searchParams.get('operName') === FIXTURE_OPER_NAME
      );
    });
    await fixtureActions.getByRole('button', { name: /^删\s*除$/ }).click();
    await confirmDialog(page);
    const deleteResponse = await deleted;
    expect(deleteResponse.status()).toBe(200);
    expect((await deleteResponse.json()).code).toBe(200);
    const afterDelete = await (await reloadedAfterDelete).json();
    expect(afterDelete.total).toBe(0);
    await expect(page.getByText('共 0 条记录').first()).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });

    // A-18：操作时间表头切换排序，请求带 orderByColumn/isAsc，首行顺序随方向改变
    const resetList = await resetFilters(page);
    expect(resetList.total).toBeGreaterThanOrEqual(2);
    const ascList = await sortByHeader(page, '操作时间', 'asc');
    assertAscending(ascList.rows, 'asc');
    const descList = await sortByHeader(page, '操作时间', 'desc');
    assertAscending(descList.rows, 'desc');
    expect(ascList.rows[0]?.operId).not.toBe(descList.rows[0]?.operId);

    expect(pageErrors).toEqual([]);
  });
});
