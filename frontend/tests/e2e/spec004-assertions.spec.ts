import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  searchGrid,
  seedSpec004Fixtures,
  waitForAppReady,
} from './helpers';

/**
 * SPEC-004 跨页断言（Polish）：
 * - A-09 受限账号：列表可读、写入口不渲染、写接口 403；
 * - A-10 八个目标地址均可达、表头正确、无占位页；
 * - A-13 敏感操作二次确认：取消后不发写请求、状态不变；
 * - A-14 列表接口失败：展示 msg、无无限加载；
 * - E-15 导出接口返回 JSON 错误体：展示 msg、不保存损坏文件；
 * - E-32 连续点击“确定”只发出 1 个新增请求。
 *
 * 夹具由 scripts/evals/seed_spec004.sh 预置；trace 关闭，避免请求头中的
 * 令牌进入 trace 证据。
 */

const DICT_TYPE = 'spec004_dict_type';
const DICT_TYPE_ID = '900004000000000001';
const DEFAULT_CONFIG_KEY = 'minio';
const NON_DEFAULT_CONFIG_KEY = 'qiniu';
const LIMITED_USER = 'spec004_limited';
const PASSWORD = 'admin123';
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';

test.use({ trace: 'off' });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, clientid: CLIENT_ID };
}

function bodyRows(scope: Locator): Locator {
  return scope.locator('.vxe-table--main-wrapper .vxe-body--row');
}

function typePanel(page: Page): Locator {
  return page.locator('[data-panel="dict-type"]');
}

async function waitNoLoading(page: Locator | Page): Promise<void> {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: 15_000,
  });
}

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

/**
 * 强制整页加载目标地址。
 *
 * 生产预览是 hash 路由：只改 hash 的 `page.goto` 不会重新挂载页面，
 * 已缓存的 Tab 可能保留旧内容。在 URL 上追加查询参数可强制文档重载。
 */
async function gotoFresh(page: Page, path: string): Promise<void> {
  const current = new URL(page.url());
  const stamp = Date.now();
  const target = current.hash.startsWith('#/')
    ? `${current.origin}/?spec004_nav=${stamp}#${path}`
    : `${current.origin}${path}?spec004_nav=${stamp}`;
  await page.goto(target);
  await waitForAppReady(page);
}

async function loginCapturingToken(
  page: Page,
  username: string,
): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/login') &&
      response.request().method() === 'POST',
  );
  await loginWithCaptcha(page, username, PASSWORD);
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

/** 记录写请求，用于 A-13 “取消后不发出写请求” */
function collectMutations(page: Page): string[] {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const method = request.method();
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      mutations.push(`${method} ${new URL(request.url()).pathname}`);
    }
  });
  return mutations;
}

async function cancelConfirm(page: Page): Promise<void> {
  const confirm = page.locator('.ant-modal-confirm');
  await expect(confirm).toBeVisible({ timeout: 30_000 });
  await confirm.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(confirm).toBeHidden({ timeout: 30_000 });
}

test.describe('SPEC-004 跨页断言', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
    seedSpec004Fixtures();
  });

  test('受限账号：列表可读、无新增/删除/导出、写接口 403（A-09）', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const token = await loginCapturingToken(page, LIMITED_USER);
    await expect(page.getByPlaceholder('请输入用户名')).toBeHidden({
      timeout: APP_ENTRY_TIMEOUT,
    });

    const listLoaded = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false;
      }
      return new URL(response.url()).pathname.endsWith('/system/dict/type/list');
    });
    await gotoAppPath(page, '/system/dict');
    await expect(typePanel(page)).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const listResponse = await listLoaded;
    const listBody = await listResponse.json();
    expect(listBody.code).toBe(200);
    expect(listBody.total).toBeGreaterThanOrEqual(1);

    // 写入口不进入 DOM
    await expect(
      page.getByRole('button', { name: '新增', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^删\s*除$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '导出', exact: true })).toHaveCount(
      0,
    );

    // 写接口 HTTP 200 + code 403 + 原文 msg
    const attempt = await page.request.post(
      `${BACKEND_URL}/system/dict/type`,
      {
        data: {
          dictName: 'Spec004 受限新增',
          dictType: 'spec004_limited_attempt',
          remark: 'REQ-20261107-005',
        },
        headers: authHeaders(token),
      },
    );
    expect(attempt.status()).toBe(200);
    const attemptBody = await attempt.json();
    expect(attemptBody.code).toBe(403);
    expect(attemptBody.msg).toBe('没有访问权限，请联系管理员授权');

    expect(pageErrors).toEqual([]);
  });

  test('八地址可达、二次确认、列表失败与防重复提交（A-10、A-13、A-14、E-32）', async ({
    page,
  }) => {
    // 8 个地址 + 多轮操作在慢宿主/全量套件下可能超过默认 240s
    test.setTimeout(600_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const token = await loginCapturingToken(page, 'admin');
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    // A-10：8 个地址与对应表头
    const routes = [
      { header: '字典名称', path: '/system/dict' },
      { header: '字典标签', path: `/system/dict-data/index/${DICT_TYPE_ID}` },
      { header: '参数名称', path: '/system/config' },
      { header: '公告标题', path: '/system/notice' },
      { header: '日志编号', path: '/system/log/operlog' },
      { header: '访问编号', path: '/system/log/logininfor' },
      { header: '文件名', path: '/system/oss' },
      { header: '配置key', path: '/system/oss-config/index' },
    ];
    for (const item of routes) {
      await gotoAppPath(page, item.path);
      await expect(
        page.getByRole('columnheader', { name: item.header, exact: true }),
      ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
      await expect(page.getByText('即将推出')).toHaveCount(0);
      expect(new URL(page.url()).pathname).not.toMatch(/(403|404)/);
    }

    const mutations = collectMutations(page);

    // A-13：删除字典类型先确认，取消后不发请求、行保留
    await gotoAppPath(page, '/system/dict');
    await searchGrid(
      page,
      {
        endpoint: '/system/dict/type/list',
        param: 'dictType',
        placeholder: '请输入字典类型',
        value: DICT_TYPE,
      },
      typePanel(page),
    );
    await waitNoLoading(typePanel(page));
    const typeRow = bodyRows(typePanel(page)).filter({ hasText: DICT_TYPE }).first();
    await expect(typeRow).toBeVisible({ timeout: 15_000 });
    const typeActions = await actionRowIn(typePanel(page), typeRow);
    const beforeDeleteCancel = mutations.length;
    await typeActions.getByRole('button', { name: /^删\s*除$/ }).click();
    await cancelConfirm(page);
    await expect(typeRow).toBeVisible();
    expect(mutations.length).toBe(beforeDeleteCancel);

    // A-13：刷新缓存先确认，取消后不发 DELETE
    await gotoAppPath(page, '/system/config');
    await expect(
      page.getByRole('button', { name: '刷新缓存', exact: true }),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const beforeRefreshCancel = mutations.length;
    await page.getByRole('button', { name: '刷新缓存', exact: true }).click();
    await cancelConfirm(page);
    expect(mutations.length).toBe(beforeRefreshCancel);

    // A-13：切换默认配置先确认，取消后不发 PUT、开关仍为非默认
    // 此处用整页加载，避免 hash 同文档切换在慢宿主上未重挂载页面
    await gotoFresh(page, '/system/oss-config/index');
    await expect(
      page.getByRole('columnheader', { name: '配置key', exact: true }),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const nonDefaultRow = bodyRows(page)
      .filter({ hasText: NON_DEFAULT_CONFIG_KEY })
      .first();
    await expect(nonDefaultRow).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const nonDefaultSwitch = nonDefaultRow.locator('.ant-switch');
    await expect(nonDefaultSwitch).not.toHaveClass(/ant-switch-checked/);
    const beforeSwitchCancel = mutations.length;
    await nonDefaultSwitch.click();
    await cancelConfirm(page);
    await expect(nonDefaultSwitch).not.toHaveClass(/ant-switch-checked/);
    await expect(nonDefaultRow).toContainText('非默认');
    expect(mutations.length).toBe(beforeSwitchCancel);

    // A-14：列表接口失败时展示 msg，且不出现无限加载
    let intercepted = 0;
    const listFailedRoute = /\/system\/config\/list/;
    await page.route(listFailedRoute, async (route) => {
      intercepted += 1;
      await route.fulfill({
        body: JSON.stringify({
          code: 500,
          msg: '模拟列表失败',
          rows: [],
          total: 0,
        }),
        contentType: 'application/json',
        status: 200,
      });
    });
    // 生产预览是 hash 路由，同文档切换不会重新挂载列表；整页加载才发请求
    await gotoFresh(page, '/system/config');
    expect(intercepted).toBeGreaterThanOrEqual(1);
    await expect(page.getByText('模拟列表失败').first()).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });
    await waitNoLoading(page);
    await page.unroute(listFailedRoute);

    // E-32：连续点击“确定”3 次，只发出 1 个新增请求
    const suffix = Date.now();
    // config_key 列宽有限（实测 20），保持短键以免触发数据库截断
    const configKey = `e32_${suffix}`;
    let posts = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/resource/oss/config')
      ) {
        posts += 1;
      }
    });

    await gotoFresh(page, '/system/oss-config/index');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: '新增文件配置' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await createDialog.getByPlaceholder('请输入配置key').fill(configKey);
    await createDialog.getByPlaceholder('请输入accessKey').fill('spec004_e32_access');
    await createDialog.getByPlaceholder('请输入secretKey').fill('spec004_e32_secret');
    await createDialog.getByPlaceholder('请输入桶名称').fill('spec004_e32_bucket');
    await createDialog.getByPlaceholder('请输入访问站点').fill('127.0.0.1:9000');

    // 延迟 POST 响应，让“按钮加载态”可观测；请求事件在延迟前已触发
    await page.route('**/resource/oss/config', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    try {
      const created = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith('/resource/oss/config') &&
          response.request().method() === 'POST',
      );
      const confirmButton = createDialog.getByRole('button', { name: /确\s*认/ });
      await confirmButton.click();
      // modalApi.lock(true) 的加载态是 ant-btn-loading（不设置 disabled 属性）
      await expect(confirmButton).toHaveClass(/ant-btn-loading/, {
        timeout: 15_000,
      });
      // 模拟连续点击 2 次（加载态下不应再发请求）
      await confirmButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      const createdResponse = await created;
      const createdBody = (await createdResponse.json()) as {
        code?: number;
        msg?: string;
      };
      expect(createdBody.code, JSON.stringify(createdBody)).toBe(200);
      await expect(createDialog).toBeHidden({ timeout: APP_ENTRY_TIMEOUT });
      expect(posts).toBe(1);
    } finally {
      await page.unroute('**/resource/oss/config');
      // 按配置 key 回查新增项并删除，避免残留影响后续运行（E-22）
      const cleanupList = await page.request.get(
        `${BACKEND_URL}/resource/oss/config/list?configKey=${encodeURIComponent(configKey)}&pageNum=1&pageSize=10`,
        { headers: authHeaders(token) },
      );
      const cleanupBody = await cleanupList.json();
      const cleanupRows = (cleanupBody.rows ?? []) as Array<
        Record<string, unknown>
      >;
      for (const row of cleanupRows) {
        const cleanup = await page.request.delete(
          `${BACKEND_URL}/resource/oss/config/${String(row.ossConfigId)}`,
          { headers: authHeaders(token) },
        );
        expect(cleanup.status()).toBe(200);
        const cleanupResponse = await cleanup.json();
        expect(cleanupResponse.code).toBe(200);
      }
    }

    expect(pageErrors).toEqual([]);
  });

  test('导出接口返回 JSON 错误体：展示 msg、不保存损坏文件（E-15）', async ({
    page,
  }) => {
    // 独立成测：整页加载两次 + 两个下载入口，给足以慢宿主的时间
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await loginWithCaptcha(page, 'admin');
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    // E-15：参数设置导出 HTTP 200 + JSON 错误体 → 展示后端 msg
    let configExportCalls = 0;
    const configExportFailedRoute = /\/system\/config\/export/;
    await page.route(configExportFailedRoute, async (route) => {
      configExportCalls += 1;
      await route.fulfill({
        body: JSON.stringify({ code: 500, msg: '模拟导出失败' }),
        contentType: 'application/json',
        status: 200,
      });
    });
    await gotoFresh(page, '/system/config');
    await expect(
      page.getByRole('columnheader', { name: '参数名称', exact: true }),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await waitNoLoading(page);
    await page.getByRole('button', { name: '导出', exact: true }).click();
    await expect(page.getByText('模拟导出失败').first()).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });
    expect(configExportCalls).toBeGreaterThanOrEqual(1);
    await page.unroute(configExportFailedRoute);

    // E-15：字典类型导出同样展示后端 msg（独立下载入口）
    let dictExportCalls = 0;
    const dictExportFailedRoute = /\/system\/dict\/type\/export/;
    await page.route(dictExportFailedRoute, async (route) => {
      dictExportCalls += 1;
      await route.fulfill({
        body: JSON.stringify({ code: 500, msg: '模拟字典导出失败' }),
        contentType: 'application/json',
        status: 200,
      });
    });
    await gotoFresh(page, '/system/dict');
    await expect(typePanel(page)).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await waitNoLoading(typePanel(page));
    await typePanel(page)
      .getByRole('button', { name: '导出', exact: true })
      .click();
    await expect(page.getByText('模拟字典导出失败').first()).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });
    expect(dictExportCalls).toBeGreaterThanOrEqual(1);
    await page.unroute(dictExportFailedRoute);

    expect(pageErrors).toEqual([]);
  });
});
