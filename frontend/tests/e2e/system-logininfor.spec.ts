import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  confirmDialog,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  seedSpec004Fixtures,
} from './helpers';

/** 固定夹具（scripts/evals/seed_spec004.sh） */
const FIXTURE_USER = 'spec004_lock';
const FIXTURE_INFO_ID = '900004000000000007';

function bodyRows(page: Page): Locator {
  return page.locator('.vxe-table--main-wrapper .vxe-body--row');
}

async function waitNoLoading(page: Page): Promise<void> {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function openLogininforPage(page: Page): Promise<void> {
  await loginWithCaptcha(page);
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/log/logininfor');
  // A-10：访问编号表头可见，且不落到占位页 / 403 / 404
  await expect(
    page.locator('thead').getByText('访问编号', { exact: true }).first(),
  ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  await expect(page.getByText('即将推出')).toHaveCount(0);
}

/** 按用户名称 + 失败状态筛选，等待本次列表响应 */
async function searchLockedUser(page: Page): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/logininfor/list') &&
      url.searchParams.get('userName') === FIXTURE_USER &&
      url.searchParams.get('status') === '1'
    );
  });
  await page.getByPlaceholder('请输入用户名称').fill(FIXTURE_USER);
  await page.getByRole('combobox', { name: '登录状态' }).click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: '失败' })
    .first()
    .click();
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

/** 清空筛选条件并等待无 userName 条件的列表响应 */
async function resetFilters(page: Page): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/logininfor/list') &&
      !url.searchParams.has('userName')
    );
  });
  await page.getByRole('button', { name: /重\s*置/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

async function toggleRow(page: Page, index: number): Promise<void> {
  await bodyRows(page)
    .nth(index)
    .locator('.vxe-cell--checkbox .vxe-checkbox--icon')
    .first()
    .click();
}

/** 点表头排序并等待带排序参数的列表响应 */
async function sortByHeader(
  page: Page,
  header: string,
  direction: 'asc' | 'desc',
): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/monitor/logininfor/list') &&
      url.searchParams.get('orderByColumn') === 'loginTime' &&
      url.searchParams.get('isAsc') === direction
    );
  });
  // vxe 会额外渲染隐藏的表头测量节点，按可访问的列头定位唯一目标；
  // 直接点升序/降序图标，避免二次点击列头被当成“清除排序”
  await page
    .getByRole('columnheader', { name: new RegExp(header) })
    .locator(
      direction === 'asc' ? '.vxe-sort--asc-btn' : '.vxe-sort--desc-btn',
    )
    .click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

function timeValue(raw: unknown): number {
  return Date.parse(String(raw ?? '').replaceAll('-', '/'));
}

function assertAscending(rows: Array<Record<string, any>>, direction: string) {
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (let index = 1; index < rows.length; index++) {
    const previous = timeValue(rows[index - 1]?.loginTime);
    const current = timeValue(rows[index]?.loginTime);
    expect(Number.isNaN(previous) || Number.isNaN(current)).toBe(false);
    if (direction === 'asc') {
      expect(previous).toBeLessThanOrEqual(current);
    } else {
      expect(previous).toBeGreaterThanOrEqual(current);
    }
  }
}

test.describe('监控管理 - 登录日志', () => {
  test.beforeAll(async () => {
    const backendUp = await isBackendUp();
    test.skip(!backendUp, '本地后端栈未启动');
    if (!backendUp) {
      return;
    }
    // A-06 会删除夹具；单独重跑前先幂等补种
    seedSpec004Fixtures();
  });

  test('筛选/解锁单选/导出/删除/排序（A-06、A-15、A-18、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openLogininforPage(page);
    const unlockButton = page.getByRole('button', { name: /解\s*锁/ });

    // A-06：按用户名称 + 失败状态筛选，行数据完整
    const list = await searchLockedUser(page);
    expect(list.total).toBeGreaterThanOrEqual(1);
    const fixture = list.rows.find(
      (row: Record<string, any>) => String(row.infoId) === FIXTURE_INFO_ID,
    );
    expect(fixture).toBeTruthy();
    expect(fixture.userName).toBe(FIXTURE_USER);
    expect(String(fixture.ipaddr ?? '')).not.toBe('');
    expect(String(fixture.loginLocation ?? '')).not.toBe('');
    expect(String(fixture.browser ?? '')).not.toBe('');
    expect(String(fixture.os ?? '')).not.toBe('');
    expect(fixture.status).toBe('1');
    expect(String(fixture.loginTime ?? '')).not.toBe('');

    const fixtureRow = bodyRows(page).filter({ hasText: FIXTURE_USER }).first();
    await expect(fixtureRow).toHaveCount(1);
    await expect(fixtureRow).toContainText(String(fixture.ipaddr));
    await expect(fixtureRow).toContainText(String(fixture.browser));
    await expect(fixtureRow).toContainText(String(fixture.os));
    await expect(fixtureRow).toContainText('失败');

    // A-15 / E-16：0 条勾选时解锁不可用
    await expect(unlockButton).toBeDisabled();

    // A-06：仅勾选该行后解锁可用，解锁响应 code=200 且日志仍在列表
    await fixtureRow
      .locator('.vxe-cell--checkbox .vxe-checkbox--icon')
      .first()
      .click();
    await expect(unlockButton).toBeEnabled();
    const unlocked = page.waitForResponse(
      (response) =>
        response.url().includes('/monitor/logininfor/unlock/') &&
        response.request().method() === 'GET',
    );
    const reloadedAfterUnlock = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/monitor/logininfor/list') &&
        url.searchParams.get('userName') === FIXTURE_USER &&
        url.searchParams.get('status') === '1'
      );
    });
    await unlockButton.click();
    await confirmDialog(page);
    const unlockResponse = await unlocked;
    expect(unlockResponse.status()).toBe(200);
    expect((await unlockResponse.json()).code).toBe(200);
    const afterUnlock = await (await reloadedAfterUnlock).json();
    expect(afterUnlock.total).toBeGreaterThanOrEqual(1);
    await expect(fixtureRow).toHaveCount(1);

    // A-06：导出当前筛选结果，HTTP 200 且响应体非空
    const exported = page.waitForResponse(
      (response) =>
        response.url().includes('/monitor/logininfor/export') &&
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

    // 解锁后的列表重载会清空勾选；删除前重新勾选目标行
    await fixtureRow
      .locator('.vxe-cell--checkbox .vxe-checkbox--icon')
      .first()
      .click();
    await expect(unlockButton).toBeEnabled();

    // A-06：删除该行，响应 code=200 且当前筛选结果 total 归零
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.endsWith(
          `/monitor/logininfor/${FIXTURE_INFO_ID}`,
        ),
    );
    const reloadedAfterDelete = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/monitor/logininfor/list') &&
        url.searchParams.get('userName') === FIXTURE_USER &&
        url.searchParams.get('status') === '1'
      );
    });
    await page.getByRole('button', { name: '删除', exact: true }).first().click();
    await confirmDialog(page);
    const deleteResponse = await deleted;
    expect(deleteResponse.status()).toBe(200);
    expect((await deleteResponse.json()).code).toBe(200);
    const afterDelete = await (await reloadedAfterDelete).json();
    expect(afterDelete.total).toBe(0);
    await expect(page.getByText('共 0 条记录').first()).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });

    // A-15：0 / 1 / 2 条勾选时解锁入口的可用性
    await resetFilters(page);
    await expect(unlockButton).toBeDisabled();
    await toggleRow(page, 0);
    await expect(unlockButton).toBeEnabled();
    await toggleRow(page, 1);
    await expect(unlockButton).toBeDisabled();
    await toggleRow(page, 0);
    await expect(unlockButton).toBeEnabled();
    await toggleRow(page, 1);
    await expect(unlockButton).toBeDisabled();

    // A-18：访问时间表头切换排序，请求带 orderByColumn/isAsc，首行顺序随方向改变
    const ascList = await sortByHeader(page, '访问时间', 'asc');
    assertAscending(ascList.rows, 'asc');
    const descList = await sortByHeader(page, '访问时间', 'desc');
    assertAscending(descList.rows, 'desc');
    expect(ascList.rows[0]?.infoId).not.toBe(descList.rows[0]?.infoId);

    expect(pageErrors).toEqual([]);
  });
});
