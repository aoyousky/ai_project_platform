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
const FIXTURE_PNG = 'spec004_upload.png';
const FIXTURE_TXT = 'spec004_upload.txt';
const OSS_LIMITED_USER =
  process.env.E2E_OSS_LIMITED_USER ?? 'spec004_oss_limited';
const PASSWORD = process.env.E2E_OSS_LIMITED_PASSWORD ?? 'admin123';
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';
const PREVIEW_CONFIG_KEY = 'sys.oss.previewListResource';

/** 1x1 PNG（最小有效图片，用于真实上传与预览断言） */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

/** 登录并截获 access_token（部分断言要直连后端接口） */
async function loginCapturingToken(
  page: Page,
  username = 'admin',
  password = 'admin123',
): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/login') &&
      response.request().method() === 'POST',
  );
  await loginWithCaptcha(page, username, password);
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

async function openOssPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
  await gotoAppPath(page, '/system/oss');
  // A-10：文件名表头可见，且不落到占位页 / 403 / 404
  await expect(
    page.getByRole('columnheader', { name: '文件名', exact: true }),
  ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  await expect(page.getByText('即将推出')).toHaveCount(0);
}

/** 通过上传入口上传一个内存文件，等待上传响应与列表重载 */
async function uploadVia(
  page: Page,
  buttonName: string,
  payload: { buffer: Buffer; mimeType: string; name: string },
): Promise<any> {
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith('/resource/oss/upload') &&
      response.request().method() === 'POST',
  );
  const reloaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    return new URL(response.url()).pathname.endsWith('/resource/oss/list');
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(payload);

  const uploadResponse = await uploaded;
  expect(uploadResponse.status()).toBe(200);
  const uploadBody = await uploadResponse.json();
  expect(uploadBody.code).toBe(200);
  await reloaded;
  await waitNoLoading(page);
  return uploadBody;
}

/** 按原名筛选并等待本次列表响应 */
async function searchByOriginalName(
  page: Page,
  name: string,
): Promise<any> {
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/resource/oss/list') &&
      url.searchParams.get('originalName') === name
    );
  });
  await page.getByPlaceholder('请输入原名').fill(name);
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  const response = await loaded;
  await waitNoLoading(page);
  return response.json();
}

function fixtureRow(page: Page, originalName: string): Locator {
  return bodyRows(page).filter({ hasText: originalName }).first();
}

test.describe('系统管理 - 文件管理', () => {
  test.beforeAll(async () => {
    const backendUp = await isBackendUp();
    test.skip(!backendUp, '本地后端栈未启动');
    if (!backendUp) {
      return;
    }
    // A-07 会删除上传夹具；单独重跑前先幂等补种
    seedSpec004Fixtures();
  });

  test('上传/预览开关/下载/删除（A-07、A-12、E-19、A-10）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    let uploadPosts = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/resource/oss/upload')
      ) {
        uploadPosts += 1;
      }
    });

    const token = await loginCapturingToken(page);
    await openOssPage(page);

    // A-07：上传 PNG 与 UTF-8 文本，两次上传 code=200
    const pngUpload = await uploadVia(page, '上传图片', {
      buffer: Buffer.from(PNG_BASE64, 'base64'),
      mimeType: 'image/png',
      name: FIXTURE_PNG,
    });
    expect(pngUpload.code).toBe(200);
    expect(String(pngUpload.data?.ossId ?? '')).not.toBe('');

    const txtUpload = await uploadVia(page, '上传文件', {
      buffer: Buffer.from('Spec004 上传文本', 'utf8'),
      mimeType: 'text/plain',
      name: FIXTURE_TXT,
    });
    expect(txtUpload.code).toBe(200);
    expect(uploadPosts).toBe(2);

    // A-07：列表出现两条记录，字段完整
    const pngList = await searchByOriginalName(page, FIXTURE_PNG);
    expect(pngList.total).toBeGreaterThanOrEqual(1);
    const pngRow = pngList.rows.find(
      (row: Record<string, any>) => row.originalName === FIXTURE_PNG,
    );
    expect(pngRow).toBeTruthy();
    expect(String(pngRow.fileSuffix ?? '')).not.toBe('');
    expect(String(pngRow.service ?? '')).not.toBe('');
    expect(String(pngRow.createByName ?? '')).not.toBe('');
    expect(String(pngRow.url ?? '')).not.toBe('');

    const txtList = await searchByOriginalName(page, FIXTURE_TXT);
    const txtRow = txtList.rows.find(
      (row: Record<string, any>) => row.originalName === FIXTURE_TXT,
    );
    expect(txtRow).toBeTruthy();
    expect(String(txtRow.fileSuffix ?? '')).not.toBe('');
    expect(String(txtRow.service ?? '')).not.toBe('');

    // A-12 需要 PNG 行在列表内：重新筛选 PNG（上一步筛选的是 TXT）
    await searchByOriginalName(page, FIXTURE_PNG);

    // A-12：预览开关为 true 时 PNG 行渲染 <img src=url>
    await expect(
      fixtureRow(page, FIXTURE_PNG).locator('img'),
    ).toHaveAttribute('src', String(pngRow.url), { timeout: 15_000 });

    // A-12：关闭预览 → 参数写入 false，图片行改为 URL 文本
    const firstTogglePut = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/system/config/updateByKey') &&
        response.request().method() === 'PUT',
    );
    const firstToggleReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/resource/oss/list') &&
        url.searchParams.get('originalName') === FIXTURE_PNG
      );
    });
    await page.getByRole('button', { name: /预览开关/ }).click();
    await confirmDialog(page);
    const togglePutResponse = await firstTogglePut;
    expect(togglePutResponse.status()).toBe(200);
    expect((await togglePutResponse.json()).code).toBe(200);
    await firstToggleReload;
    await waitNoLoading(page);

    const disabledConfig = await page.request.get(
      `${BACKEND_URL}/system/config/configKey/${PREVIEW_CONFIG_KEY}`,
      { headers: authHeaders(token) },
    );
    expect((await disabledConfig.json()).data).toBe('false');
    await expect(fixtureRow(page, FIXTURE_PNG).locator('img')).toHaveCount(0);
    await expect(fixtureRow(page, FIXTURE_PNG)).toContainText(
      String(pngRow.url),
    );

    // A-12：恢复 previewListResource='true'，图片行重新渲染缩略图
    const restorePut = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/system/config/updateByKey') &&
        response.request().method() === 'PUT',
    );
    const restoreReload = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/resource/oss/list') &&
        url.searchParams.get('originalName') === FIXTURE_PNG
      );
    });
    await page.getByRole('button', { name: /预览开关/ }).click();
    await confirmDialog(page);
    await restorePut;
    await restoreReload;
    await waitNoLoading(page);

    const enabledConfig = await page.request.get(
      `${BACKEND_URL}/system/config/configKey/${PREVIEW_CONFIG_KEY}`,
      { headers: authHeaders(token) },
    );
    expect((await enabledConfig.json()).data).toBe('true');
    await expect(
      fixtureRow(page, FIXTURE_PNG).locator('img'),
    ).toHaveAttribute('src', String(pngRow.url));

    // A-07：下载 PNG，HTTP 200、响应体非空、Content-Disposition 为附件
    const downloaded = page.waitForResponse(
      (response) =>
        response.url().includes('/resource/oss/download/') &&
        response.request().method() === 'GET',
    );
    const downloadEvent = page.waitForEvent('download');
    // 操作列在固定区独立渲染，按主表行同序号取固定区行
    const downloadRow = await fixedActionRow(page, FIXTURE_PNG);
    await downloadRow
      .getByRole('button', { name: /下\s*载/ })
      .click();
    const downloadResponse = await downloaded;
    const download = await downloadEvent;
    expect(downloadResponse.status()).toBe(200);
    expect((await downloadResponse.body()).byteLength).toBeGreaterThan(0);
    const contentDisposition = String(
      (await downloadResponse.allHeaders())['content-disposition'] ?? '',
    );
    expect(contentDisposition).toContain('attachment');
    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    // E-19：上传空文件 → 可理解错误，不发出上传请求，total 不增加
    const emptyChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '上传文件', exact: true }).click();
    const emptyChooser = await emptyChooserPromise;
    await emptyChooser.setFiles({
      buffer: Buffer.from(''),
      mimeType: 'text/plain',
      name: 'spec004_empty.txt',
    });
    await expect(page.getByText('不能上传空文件').first()).toBeVisible();
    expect(uploadPosts).toBe(2);

    // A-07：勾选两条记录并删除，响应 code=200 且两条从列表消失
    const prefixList = await searchByOriginalName(page, 'spec004_upload');
    expect(prefixList.total).toBe(2);
    const rows = bodyRows(page).filter({ hasText: 'spec004_upload' });
    await expect(rows).toHaveCount(2);
    await rows.nth(0).locator('.vxe-cell--checkbox .vxe-checkbox--icon').first().click();
    await rows.nth(1).locator('.vxe-cell--checkbox .vxe-checkbox--icon').first().click();

    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        // 浏览器请求经 /prod-api 代理，路径前缀不是 /resource/oss
        response.url().includes('/resource/oss/'),
    );
    await page.getByRole('button', { name: '删除', exact: true }).first().click();
    await confirmDialog(page);
    const deleteResponse = await deleted;
    expect(deleteResponse.status()).toBe(200);
    expect((await deleteResponse.json()).code).toBe(200);

    const remaining = await page.request.get(
      `${BACKEND_URL}/resource/oss/list?originalName=spec004_upload&pageNum=1&pageSize=10`,
      { headers: authHeaders(token) },
    );
    const remainingBody = await remaining.json();
    expect(remainingBody.total).toBe(0);
    await expect(
      bodyRows(page).filter({ hasText: 'spec004_upload' }),
    ).toHaveCount(0);

    // 配置管理入口按权限渲染并跳转到隐藏文件配置页
    await page.getByRole('button', { name: /配置管理/ }).click();
    await expect(page).toHaveURL(/\/system\/oss-config\/index/, {
      timeout: APP_ENTRY_TIMEOUT,
    });

    expect(pageErrors).toEqual([]);
  });

  test('无 system:oss:upload 权限：按钮不渲染，直连上传返回 403（E-20）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const token = await loginCapturingToken(page, OSS_LIMITED_USER, PASSWORD);
    await openOssPage(page);

    await expect(
      page.getByRole('button', { name: '上传文件', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '上传图片', exact: true }),
    ).toHaveCount(0);

    const denied = await page.request.post(
      `${BACKEND_URL}/resource/oss/upload`,
      {
        headers: authHeaders(token),
        multipart: {
          file: {
            buffer: Buffer.from('Spec004 denied', 'utf8'),
            mimeType: 'text/plain',
            name: 'spec004_denied.txt',
          },
        },
      },
    );
    const deniedBody = await denied.json();
    expect(deniedBody.code).toBe(403);
    expect(deniedBody.msg).toBe('没有访问权限，请联系管理员授权');

    expect(pageErrors).toEqual([]);
  });
});
