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
const FIXTURE_TITLE = 'Spec004 公告';

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

async function openNoticePage(page: Page): Promise<void> {
  await loginWithCaptcha(page);
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/notice');
  await expect(
    page.locator('thead').getByText('公告标题', { exact: true }).first(),
  ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  // A-10：不得落到占位页或 403/404
  await expect(page.getByText('即将推出')).toHaveCount(0);
}

/** 按标题筛选并返回本次列表响应体 */
async function searchByTitle(page: Page, title: string): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/system/notice/list') &&
      url.searchParams.get('noticeTitle') === title
    );
  });
  await searchGrid(page, {
    endpoint: '/system/notice/list',
    param: 'noticeTitle',
    placeholder: '请输入公告标题',
    value: title,
  });
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

function rowId(rows: Array<Record<string, unknown>>, title: string) {
  return rows.find((row) => row.noticeTitle === title)?.noticeId;
}

test.describe('系统管理 - 通知公告', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('筛选/富文本回显/新增/修改状态/删除（A-04、A-11、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openNoticePage(page);

    // A-04：按标题筛选，total=1，类型与状态以中文标签显示
    const fixtureList = await searchByTitle(page, FIXTURE_TITLE);
    expect(fixtureList.total).toBe(1);
    expect(fixtureList.rows).toHaveLength(1);
    const fixtureRow = bodyRows(page).filter({ hasText: FIXTURE_TITLE }).first();
    await expect(fixtureRow).toHaveCount(1);
    await expect(fixtureRow).toContainText('通知');
    await expect(fixtureRow).toContainText('正常');

    // A-11：历史 ql-* 内容在编辑弹窗中正确回显
    const fixtureActions = await actionRow(page, fixtureRow);
    const fixtureDetailLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return new URL(response.url()).pathname.endsWith(
        `/system/notice/${rowId(fixtureList.rows, FIXTURE_TITLE)}`,
      );
    });
    await fixtureActions.getByRole('button', { name: /修\s*改/ }).click();
    const fixtureDetail = await (await fixtureDetailLoaded).json();
    expect(fixtureDetail.code).toBe(200);

    const fixtureDialog = page.getByRole('dialog', { name: '修改公告' });
    await expect(fixtureDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const fixtureContent = fixtureDialog.locator('.vben-tiptap-content');
    const centeredParagraph = fixtureContent
      .locator('p')
      .filter({ hasText: 'Spec004 居中正文' })
      .first();
    const largeText = fixtureContent
      .locator('h2, h3')
      .filter({ hasText: 'Spec004 大字号文本' })
      .first();
    const normalParagraph = fixtureContent
      .locator('p')
      .filter({ hasText: 'Spec004 普通正文' })
      .first();

    await expect(centeredParagraph).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(largeText).toBeVisible();
    await expect(fixtureContent).toContainText('Spec004 普通正文');
    expect(
      await centeredParagraph.evaluate(
        (element) => getComputedStyle(element).textAlign,
      ),
    ).toBe('center');
    const largeFontSize = await largeText.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    const baseFontSize = await normalParagraph.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(largeFontSize).toBeGreaterThan(baseFontSize);

    await page.keyboard.press('Escape');
    await expect(fixtureDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    const suffix = Date.now();
    const newTitle = `E2E公告_${suffix}`;
    const bodyText = `Spec004 E2E 公告正文 ${suffix}`;
    const headingText = `Spec004 E2E 大字号 ${suffix}`;

    // A-04：新增带居中与大字号格式的公告
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增公告' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await createDialog.getByPlaceholder('请输入公告标题').fill(newTitle);

    // 通过编辑器粘贴带格式 HTML：居中段落 + 三级标题（大字号）
    const createEditor = createDialog.locator('.vben-tiptap-content');
    await createEditor.click();
    await createEditor.evaluate(
      (element, payload) => {
        const data = new DataTransfer();
        data.setData(
          'text/html',
          `<p style="text-align:center">${payload.body}</p><h3>${payload.heading}</h3>`,
        );
        data.setData('text/plain', `${payload.body}\n${payload.heading}`);
        element.dispatchEvent(
          new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      },
      { body: bodyText, heading: headingText },
    );
    await expect(createEditor).toContainText(bodyText, {
      timeout: APP_ENTRY_TIMEOUT,
    });
    await expect(createEditor.locator('h3')).toContainText(headingText);

    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/notice') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    expect((await createdResponse.json()).code).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });

    // 新增行存在，默认类型/状态为中文标签
    const newList = await searchByTitle(page, newTitle);
    expect(newList.total).toBe(1);
    const newId = rowId(newList.rows, newTitle);
    expect(newId).toBeTruthy();
    const newRow = bodyRows(page).filter({ hasText: newTitle }).first();
    await expect(newRow).toHaveCount(1);
    await expect(newRow).toContainText('通知');
    await expect(newRow).toContainText('正常');

    // A-04：详情正文非空且包含新公告文本；编辑弹窗回显相同正文
    const newActions = await actionRow(page, newRow);
    const newDetailLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return new URL(response.url()).pathname.endsWith(
        `/system/notice/${newId}`,
      );
    });
    await newActions.getByRole('button', { name: /修\s*改/ }).click();
    const newDetail = await (await newDetailLoaded).json();
    expect(newDetail.code).toBe(200);
    const noticeContent = String(newDetail.data?.noticeContent ?? '');
    expect(noticeContent.length).toBeGreaterThan(0);
    expect(noticeContent).toContain(bodyText);

    const editDialog = page.getByRole('dialog', { name: '修改公告' });
    await expect(editDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const editContent = editDialog.locator('.vben-tiptap-content');
    await expect(editContent).toContainText(bodyText, {
      timeout: APP_ENTRY_TIMEOUT,
    });
    await expect(editContent).toContainText(headingText);

    // A-04：修改状态为关闭并保存，列表标签同步
    await editDialog.getByText('关闭', { exact: true }).click();
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/notice') &&
        response.request().method() === 'PUT',
    );
    const reloadedAfterUpdate = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/notice/list') &&
        url.searchParams.get('noticeTitle') === newTitle
      );
    });
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()).code).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    const updatedList = await (await reloadedAfterUpdate).json();
    expect(updatedList.total).toBe(1);
    await expect(
      bodyRows(page).filter({ hasText: newTitle }).first(),
    ).toContainText('关闭');

    // A-04：删除后 total 减 1（当前筛选下归零）
    const rowToDelete = bodyRows(page).filter({ hasText: newTitle }).first();
    const deleteActions = await actionRow(page, rowToDelete);
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.endsWith(`/system/notice/${newId}`),
    );
    const reloadedAfterDelete = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/notice/list') &&
        url.searchParams.get('noticeTitle') === newTitle
      );
    });
    await deleteActions.getByRole('button', { name: /^删\s*除$/ }).click();
    await confirmDialog(page);
    const deletedResponse = await deleted;
    expect(deletedResponse.status()).toBe(200);
    expect((await deletedResponse.json()).code).toBe(200);
    const deletedList = await (await reloadedAfterDelete).json();
    expect(deletedList.total).toBe(0);
    await expect(bodyRows(page)).toHaveCount(0);
    await expect(page.getByText('共 0 条记录').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
