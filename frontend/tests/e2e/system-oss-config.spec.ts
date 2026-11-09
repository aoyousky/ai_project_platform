import type { Locator, Page } from '@playwright/test';

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
const CONFIG_KEY = 'spec004_oss_config';
const BUCKET_NAME = 'spec004_bucket_name';
const BUCKET_NAME_V2 = 'spec004_bucket_name_v2';
const ACCESS_KEY = 'spec004_access_key';
const SECRET_KEY = 'spec004_secret_key';
const ENDPOINT = '127.0.0.1:9000';
const BUILTIN_CONFIG_KEY = 'qiniu';
const DEFAULT_CONFIG_KEY = 'minio';
const DEFAULT_CONFIG_ID = 1;
const PASSWORD = 'admin123';
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';

/** secretKey 只作为表单输入断言，不写入 trace / 报告 */
test.use({ trace: 'off' });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, clientid: CLIENT_ID };
}

function bodyRows(page: Page): Locator {
  return page.locator('.vxe-table--main-wrapper .vxe-body--row');
}

async function waitNoLoading(page: Page): Promise<void> {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function loginCapturingToken(page: Page): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/login') &&
      response.request().method() === 'POST',
  );
  await loginWithCaptcha(page, 'admin', PASSWORD);
  const response = await loginResponse;
  const body = (await response.json()) as {
    data?: { access_token?: string; accessToken?: string };
  };
  const token = body.data?.access_token ?? body.data?.accessToken;
  if (!token) {
    throw new Error('登录响应未返回 access_token');
  }
  return token;
}

async function openOssConfigPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/oss-config/index');
  // A-10：四个表头可见，且不落到占位页 / 403 / 404
  for (const header of ['配置key', '访问站点', '桶名称', '是否默认']) {
    await expect(
      page.getByRole('columnheader', { name: header, exact: true }),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  }
  await expect(page.getByText('即将推出')).toHaveCount(0);
}

async function searchByConfigKey(page: Page, value: string): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/resource/oss/config/list') &&
      url.searchParams.get('configKey') === value
    );
  });
  await page.getByPlaceholder('请输入配置key').fill(value);
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

async function defaultConfigs(page: Page, token: string): Promise<any> {
  const response = await page.request.get(
    `${BACKEND_URL}/resource/oss/config/list?status=0&pageNum=1&pageSize=10`,
    { headers: authHeaders(token) },
  );
  return response.json();
}

test.describe('系统管理 - 文件配置（隐藏页）', () => {
  test.beforeAll(async () => {
    const backendUp = await isBackendUp();
    test.skip(!backendUp, '本地后端栈未启动');
    if (!backendUp) {
      return;
    }
    seedSpec004Fixtures();
  });

  test('筛选/新增/修改/设为默认与失败回滚/删除（A-08、A-16、E-23、E-24、E-31、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const token = await loginCapturingToken(page);

    // 基线：默认项归一到 ossConfigId=1（同时刷新后端缓存）
    const normalize = await page.request.put(
      `${BACKEND_URL}/resource/oss/config/changeStatus`,
      {
        data: {
          configKey: DEFAULT_CONFIG_KEY,
          ossConfigId: DEFAULT_CONFIG_ID,
          status: '0',
        },
        headers: authHeaders(token),
      },
    );
    expect((await normalize.json()).code).toBe(200);

    await openOssConfigPage(page);

    // 筛选（A-08）：按配置 key 命中现有内置配置 minio
    const builtinList = await searchByConfigKey(page, DEFAULT_CONFIG_KEY);
    expect(builtinList.total).toBeGreaterThanOrEqual(1);
    await expect(
      bodyRows(page).filter({ hasText: DEFAULT_CONFIG_KEY }),
    ).toHaveCount(1);

    // 新增（A-08）：先验证 E-24 前端拦截，再提交合法值
    let addPosts = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/resource/oss/config')
      ) {
        addPosts += 1;
      }
    });

    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增文件配置' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });

    // E-24：长度 1 触发前端校验，不发出新增请求
    await createDialog.getByPlaceholder('请输入配置key').fill('x');
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect(
      createDialog.getByText('configKey长度必须介于2和100之间'),
    ).toBeVisible();
    expect(addPosts).toBe(0);

    await createDialog.getByPlaceholder('请输入配置key').fill(CONFIG_KEY);
    await createDialog.getByPlaceholder('请输入accessKey').fill(ACCESS_KEY);
    await createDialog.getByPlaceholder('请输入secretKey').fill(SECRET_KEY);
    await createDialog.getByPlaceholder('请输入桶名称').fill(BUCKET_NAME);
    await createDialog.getByPlaceholder('请输入访问站点').fill(ENDPOINT);

    // 协议前缀随 isHttps 切换：默认 http://，选“是”后变 https://
    await expect(createDialog.getByText('http://', { exact: true })).toBeVisible();
    await createDialog.getByText('是', { exact: true }).click();
    await expect(createDialog.getByText('https://', { exact: true })).toBeVisible();
    await createDialog.getByText('否', { exact: true }).click();
    await expect(createDialog.getByText('http://', { exact: true })).toBeVisible();

    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/resource/oss/config') &&
        response.request().method() === 'POST',
    );
    const createdReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return new URL(response.url()).pathname.endsWith(
        '/resource/oss/config/list',
      );
    });
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);
    expect((await createdResponse.json()).code).toBe(200);
    await expect(createDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    await createdReload;
    expect(addPosts).toBe(1);

    // 按 key 筛选，行字段完整且不展示 secretKey（E-31）
    const newList = await searchByConfigKey(page, CONFIG_KEY);
    expect(newList.total).toBe(1);
    const newRow = newList.rows[0];
    expect(newRow.configKey).toBe(CONFIG_KEY);
    expect(newRow.bucketName).toBe(BUCKET_NAME);
    await expect(
      page.getByRole('columnheader', { name: '私有密钥', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(SECRET_KEY)).toHaveCount(0);

    // 修改（A-08）：编辑表单 secretKey 为遮蔽输入，桶名称修改后提交 PUT
    const editActions = await fixedActionRow(page, CONFIG_KEY);
    await editActions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改文件配置' });
    await expect(editDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(editDialog.locator('input[type="password"]')).toHaveCount(1);
    await expect(editDialog.locator('input[type="password"]')).toHaveValue(
      SECRET_KEY,
    );
    await editDialog.getByPlaceholder('请输入桶名称').fill(BUCKET_NAME_V2);

    const updated = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/resource/oss/config') &&
        response.request().method() === 'PUT',
    );
    const updatedReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/resource/oss/config/list') &&
        url.searchParams.get('configKey') === CONFIG_KEY
      );
    });
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()).code).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
    await updatedReload;
    await waitNoLoading(page);
    await expect(
      bodyRows(page).filter({ hasText: BUCKET_NAME_V2 }),
    ).toHaveCount(1);
    await expect(page.getByText(SECRET_KEY)).toHaveCount(0);

    // A-08/A-16：将新增配置设为默认，成功后仅此一条 status='0'
    const switchOfNew = bodyRows(page)
      .filter({ hasText: CONFIG_KEY })
      .locator('.ant-switch');
    const changed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith(
          '/resource/oss/config/changeStatus',
        ) && response.request().method() === 'PUT',
    );
    const changedReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/resource/oss/config/list') &&
        url.searchParams.get('configKey') === CONFIG_KEY
      );
    });
    await switchOfNew.click();
    // A-13：切换默认配置先二次确认
    await confirmDialog(page);
    const changedResponse = await changed;
    expect(changedResponse.status()).toBe(200);
    expect((await changedResponse.json()).code).toBe(200);
    const changedBody = changedResponse.request().postDataJSON();
    expect(changedBody).toEqual({
      configKey: CONFIG_KEY,
      ossConfigId: newRow.ossConfigId,
      status: '0',
    });
    await changedReload;
    await waitNoLoading(page);

    const defaultAfterSwitch = await defaultConfigs(page, token);
    expect(defaultAfterSwitch.total).toBe(1);
    expect(defaultAfterSwitch.rows[0].configKey).toBe(CONFIG_KEY);
    await expect(switchOfNew).toHaveClass(/ant-switch-checked/);
    await expect(
      bodyRows(page).filter({ hasText: CONFIG_KEY }),
    ).toContainText('默认');

    // 恢复内置配置为默认，供 A-16 失败回滚场景使用
    const restore = await page.request.put(
      `${BACKEND_URL}/resource/oss/config/changeStatus`,
      {
        data: {
          configKey: DEFAULT_CONFIG_KEY,
          ossConfigId: DEFAULT_CONFIG_ID,
          status: '0',
        },
        headers: authHeaders(token),
      },
    );
    expect((await restore.json()).code).toBe(200);

    // 直接接口恢复不会刷新页面行状态，重新筛选让开关回到可点击的非默认态
    await searchByConfigKey(page, CONFIG_KEY);

    // A-16：拦截 changeStatus 使其失败，开关回滚为“非默认”，默认项仍为 minio
    let failChangeStatus = false;
    await page.route('**/resource/oss/config/changeStatus', async (route) => {
      if (!failChangeStatus) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        body: JSON.stringify({ code: 500, msg: '模拟切换失败' }),
        contentType: 'application/json',
        status: 200,
      });
    });

    const failed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith(
          '/resource/oss/config/changeStatus',
        ) && response.request().method() === 'PUT',
    );
    const failedReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/resource/oss/config/list') &&
        url.searchParams.get('configKey') === CONFIG_KEY
      );
    });
    failChangeStatus = true;
    await bodyRows(page)
      .filter({ hasText: CONFIG_KEY })
      .locator('.ant-switch')
      .click();
    await confirmDialog(page);
    const failedResponse = await failed;
    expect(failedResponse.status()).toBe(200);
    expect((await failedResponse.json()).code).toBe(500);
    await failedReload;
    await waitNoLoading(page);
    failChangeStatus = false;
    await page.unroute('**/resource/oss/config/changeStatus');

    const defaultAfterFailure = await defaultConfigs(page, token);
    expect(defaultAfterFailure.total).toBe(1);
    expect(defaultAfterFailure.rows[0].configKey).toBe(DEFAULT_CONFIG_KEY);
    await expect(
      bodyRows(page).filter({ hasText: CONFIG_KEY }).locator('.ant-switch'),
    ).not.toHaveClass(/ant-switch-checked/);
    await expect(
      bodyRows(page).filter({ hasText: CONFIG_KEY }),
    ).toContainText('非默认');

    // E-23：删除内置配置被拒，msg 原文展示且配置仍在
    const builtinLoaded = await searchByConfigKey(page, BUILTIN_CONFIG_KEY);
    expect(builtinLoaded.total).toBeGreaterThanOrEqual(1);
    const builtinActions = await fixedActionRow(page, BUILTIN_CONFIG_KEY);
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().includes('/resource/oss/config/'),
    );
    await builtinActions.getByRole('button', { name: /^删\s*除$/ }).click();
    await confirmDialog(page);
    const rejectedResponse = await rejected;
    expect(rejectedResponse.status()).toBe(200);
    const rejectedBody = await rejectedResponse.json();
    expect(rejectedBody.code).not.toBe(200);
    expect(rejectedBody.msg).toBe('系统内置, 不可删除!');
    await expect(page.getByText('系统内置, 不可删除!').first()).toBeVisible();
    await expect(
      bodyRows(page).filter({ hasText: BUILTIN_CONFIG_KEY }),
    ).toHaveCount(1);

    // A-08：删除新增配置成功，列表不再出现
    await searchByConfigKey(page, CONFIG_KEY);
    const newActions = await fixedActionRow(page, CONFIG_KEY);
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().includes('/resource/oss/config/'),
    );
    await newActions.getByRole('button', { name: /^删\s*除$/ }).click();
    await confirmDialog(page);
    const deletedResponse = await deleted;
    expect(deletedResponse.status()).toBe(200);
    expect((await deletedResponse.json()).code).toBe(200);
    await expect(
      bodyRows(page).filter({ hasText: CONFIG_KEY }),
    ).toHaveCount(0);

    // A-08：结束后默认项恢复为 ossConfigId=1
    const finalDefault = await defaultConfigs(page, token);
    expect(finalDefault.total).toBe(1);
    expect(finalDefault.rows[0].configKey).toBe(DEFAULT_CONFIG_KEY);

    expect(pageErrors).toEqual([]);
  });
});
