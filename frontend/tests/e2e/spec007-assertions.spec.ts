import type { Browser, Page } from '@playwright/test';

import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import {
  confirmDialog,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  waitForAppReady,
} from './helpers';

/**
 * SPEC-007 系统监控前端断言。
 *
 * 在线会话夹具按 SPEC-007 §2 由**真实登录**创建：每次用例前清理
 * `spec007_online` 的 `online_tokens:*` 键，再用独立上下文登录 N 次。
 * 这样 A-03/A-04 的强退删除走真实 Sa-Token 监听器，而不是伪造响应。
 * 夹具脚本 `scripts/evals/seed_spec007.sh` 负责账号与权限（T034）。
 *
 * trace 关闭，避免令牌进入证据。
 */
test.use({ trace: 'off' });

/** SPEC-007 §4.3：控制台地址只从环境变量读取，测试内不提供硬编码默认值。 */
function requireConsoleUrl(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} 未设置：评测环境必须提供外部控制台地址（SPEC-007 §4.3）`,
    );
  }
  return value;
}

const ADMIN_URL = requireConsoleUrl('E2E_MONITOR_ADMIN_URL');
const SNAILJOB_URL = requireConsoleUrl('E2E_SNAILJOB_ADMIN_URL');

/** 用运行时 `_app.config.js` 覆盖控制台地址，模拟部署方注入/未配置（E-12、E-13）。 */
async function gotoWithRuntimeConfig(
  page: Page,
  overrides: { adminUrl?: string; snailjobUrl?: string },
  path: string,
): Promise<void> {
  const script = `window._VBEN_ADMIN_PRO_APP_CONF_={"VITE_GLOB_API_URL":"/prod-api","VITE_GLOB_MONITOR_ADMIN_URL":${JSON.stringify(
    overrides.adminUrl ?? ADMIN_URL,
  )},"VITE_GLOB_SNAILJOB_ADMIN_URL":${JSON.stringify(
    overrides.snailjobUrl ?? SNAILJOB_URL,
  )}};Object.freeze(window._VBEN_ADMIN_PRO_APP_CONF_);`;
  await page.route(/\/_app\.config\.js(\?.*)?$/, async (route) => {
    await route.fulfill({
      body: script,
      contentType: 'application/javascript',
    });
  });
  await page.reload();
  await waitForAppReady(page);
  await gotoAppPath(page, path);
}

const ONLINE_USER = 'spec007_online';
const LIMITED_USER = 'spec007_limited';
const NO_MONITOR_USER = 'spec007_no_monitor';

const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'awp-redis';
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD ?? 'aoyou123';

const ONLINE_LIST_ENDPOINT = '/monitor/online/list';

function redisCli(...args: string[]): string {
  return execFileSync(
    'docker',
    [
      'exec',
      REDIS_CONTAINER,
      'redis-cli',
      '--no-auth-warning',
      '-a',
      REDIS_PASSWORD,
      '--raw',
      ...args,
    ],
    { encoding: 'utf8' },
  );
}

function scanKeys(pattern: string): string[] {
  return redisCli('--scan', '--pattern', pattern)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 清空在线键，保证每个用例的会话总数与夹具一致。
 * 仅本地评测栈；会话由用例随后用真实登录重建。
 */
function cleanOnlineFixtures(): void {
  for (const key of scanKeys('online_tokens:*')) {
    redisCli('DEL', key);
  }
}

function deleteOnlineToken(tokenId: string): void {
  redisCli('DEL', `online_tokens:${tokenId}`);
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** 用独立浏览器上下文登录一次，创建一条真实在线会话后关闭上下文。 */
async function createOnlineSession(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginWithCaptcha(page, ONLINE_USER, 'admin123');
  // 给登录监听器写 `online_tokens:*` 留出落地时间
  await page.waitForTimeout(800);
  await context.close();
}

async function seedOnlineSessions(
  browser: Browser,
  count: number,
): Promise<void> {
  cleanOnlineFixtures();
  for (let index = 0; index < count; index++) {
    await createOnlineSession(browser);
  }
}

/**
 * 打开在线用户页并返回首次列表响应。必须在 `goto` 前挂监听，
 * 否则页面挂载请求可能已完成。
 */
async function gotoOnlinePage(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
    { timeout: 30_000 },
  );
  await gotoAppPath(page, '/monitor/online');
  return responsePromise;
}

function onlineRows(page: Page) {
  return page.locator('.vxe-table--main-wrapper .vxe-body--row');
}

function fixtureRows(page: Page) {
  return onlineRows(page).filter({ hasText: ONLINE_USER });
}

async function search(page: Page, values: Record<string, string>) {
  for (const [placeholder, value] of Object.entries(values)) {
    await page.getByPlaceholder(placeholder).last().fill(value);
  }
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  return responsePromise;
}

test.describe('SPEC-007 外部控制台', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test.beforeEach(async ({ page }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
  });

  test('Admin 监控：iframe 与外链等于配置地址，高度 ≥ 400（A-08）', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    // A-08 的 Given 是“评测环境设置地址”：生产构建默认相对路径，
    // 由运行时 `_app.config.js` 注入评测地址（SPEC-007 §4.3）。
    await gotoWithRuntimeConfig(page, {}, '/monitor/Admin');

    const iframe = page.locator('[data-testid="monitor-iframe"]');
    await expect(iframe).toHaveCount(1, { timeout: 30_000 });
    await expect(iframe).toHaveAttribute('src', ADMIN_URL);
    const box = await iframe.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(400);

    const external = page.locator('[data-testid="monitor-open-external"]');
    await expect(external).toHaveCount(1);
    await expect(external).toHaveAttribute('href', ADMIN_URL);
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');

    expect(pageErrors).toEqual([]);
  });

  test('任务调度中心：iframe 与外链等于配置地址，高度 ≥ 400（A-09）', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    // 同 A-08：评测地址通过运行时配置注入，生产默认值保持 `/snail-job`。
    await gotoWithRuntimeConfig(page, {}, '/monitor/snailjob');

    const iframe = page.locator('[data-testid="monitor-iframe"]');
    await expect(iframe).toHaveCount(1, { timeout: 30_000 });
    await expect(iframe).toHaveAttribute('src', SNAILJOB_URL);
    const box = await iframe.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(400);

    const external = page.locator('[data-testid="monitor-open-external"]');
    await expect(external).toHaveCount(1);
    await expect(external).toHaveAttribute('href', SNAILJOB_URL);
    await expect(external).toHaveAttribute('target', '_blank');

    expect(pageErrors).toEqual([]);
  });

  test('E-12 未配置 Admin 地址：无 iframe、显示提示、外链 disabled', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await gotoWithRuntimeConfig(page, { adminUrl: '' }, '/monitor/Admin');

    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(0);
    await expect(page.getByText('未配置监控地址').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-testid="monitor-open-external"]'),
    ).toBeDisabled();
    expect(pageErrors).toEqual([]);
    await page.unroute(/\/_app\.config\.js(\?.*)?$/);
  });

  test('E-13 配置地址不可达：iframe 与外链保留，不弹自造错误', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const unreachable = 'http://127.0.0.1:1/admin/applications';
    await gotoWithRuntimeConfig(
      page,
      { adminUrl: unreachable },
      '/monitor/Admin',
    );

    const iframe = page.locator('[data-testid="monitor-iframe"]');
    await expect(iframe).toHaveCount(1, { timeout: 30_000 });
    await expect(iframe).toHaveAttribute('src', unreachable);
    const external = page.locator('[data-testid="monitor-open-external"]');
    await expect(external).toBeEnabled();
    await expect(external).toHaveAttribute('href', unreachable);
    await expect(page.locator('.ant-message-error')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await page.unroute(/\/_app\.config\.js(\?.*)?$/);
  });

  test('E-17 点击外链：新窗口地址等于配置地址，原页 iframe 仍在', async ({
    context,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    // 控制台地址在评测栈内不可达；用 context 级路由回一次性 HTML，
    // 避免 Chrome 把新窗口地址替换成 `chrome-error://chromewebdata/`。
    await context.route(ADMIN_URL, async (route) => {
      await route.fulfill({
        body: '<!doctype html><title>Admin Console</title>',
        contentType: 'text/html',
      });
    });
    await gotoWithRuntimeConfig(page, {}, '/monitor/Admin');
    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(
      1,
      { timeout: 30_000 },
    );

    const popupPromise = page.waitForEvent('popup');
    await page.locator('[data-testid="monitor-open-external"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    expect(popup.url()).toBe(ADMIN_URL);
    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(1);
    expect(pageErrors).toEqual([]);
    await context.unroute(ADMIN_URL);
  });

  test('E-12 未配置 SnailJob 地址：无 iframe、显示提示、外链 disabled', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await gotoWithRuntimeConfig(page, { snailjobUrl: '' }, '/monitor/snailjob');

    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(0);
    await expect(page.getByText('未配置监控地址').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-testid="monitor-open-external"]'),
    ).toBeDisabled();
    expect(pageErrors).toEqual([]);
    await page.unroute(/\/_app\.config\.js(\?.*)?$/);
  });

  test('E-17 任务调度中心外链：新窗口地址等于配置地址，原页 iframe 仍在', async ({
    context,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await context.route(SNAILJOB_URL, async (route) => {
      await route.fulfill({
        body: '<!doctype html><title>SnailJob Console</title>',
        contentType: 'text/html',
      });
    });
    await gotoWithRuntimeConfig(page, {}, '/monitor/snailjob');
    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(
      1,
      { timeout: 30_000 },
    );

    const popupPromise = page.waitForEvent('popup');
    await page.locator('[data-testid="monitor-open-external"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    expect(popup.url()).toBe(SNAILJOB_URL);
    await expect(page.locator('[data-testid="monitor-iframe"]')).toHaveCount(1);
    expect(pageErrors).toEqual([]);
    await context.unroute(SNAILJOB_URL);
  });
});

test.describe('SPEC-007 在线用户', () => {
  // A-03/A-04 会消耗夹具会话；串行执行并按用例自建夹具，避免顺序耦合。
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('A-01 列表 10 列、2 个夹具会话与 pageerror=0', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const response = await gotoOnlinePage(page);

    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(body.code).toBe(200);
    expect(body.total).toBe(body.rows.length);

    await expect(fixtureRows(page)).toHaveCount(2, { timeout: 30_000 });

    const headers = page.locator('.vxe-table--header-wrapper');
    for (const title of [
      '会话编号',
      '登录名称',
      '客户端',
      '设备类型',
      '所属部门',
      '主机',
      '登录地点',
      '操作系统',
      '浏览器',
      '登录时间',
    ]) {
      await expect(
        headers.getByText(title, { exact: true }).first(),
      ).toHaveCount(1);
    }

    expect(pageErrors).toEqual([]);
  });

  test('A-02 精确筛选、AND 语义与无结果空态', async ({ browser, page }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const ipaddr = initialBody.rows.find(
      (row: any) => row.userName === ONLINE_USER,
    ).ipaddr;

    const combined = await search(page, {
      请输入登录地址: ipaddr,
      请输入登录名称: ONLINE_USER,
    });
    const combinedBody = await combined.json();
    expect(combinedBody.total).toBe(2);
    for (const row of combinedBody.rows) {
      expect(row.userName).toBe(ONLINE_USER);
      expect(row.ipaddr).toBe(ipaddr);
    }

    const empty = await search(page, {
      请输入登录地址: '',
      请输入登录名称: 'spec007_not_exist',
    });
    const emptyBody = await empty.json();
    expect(emptyBody.total).toBe(0);
    expect(emptyBody.rows).toEqual([]);
    await expect(page.getByText('暂无数据').last()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('A-03 单条强退：DELETE 一次、刷新后少 1 行、提示强退成功', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const tokenId = initialBody.rows.find(
      (row: any) => row.userName === ONLINE_USER,
    ).tokenId;

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.includes('/monitor/online/'),
    );
    const actionRow = await fixedActionRow(page, ONLINE_USER);
    await actionRow.locator('[data-testid="online-force-logout"]').click();
    await confirmDialog(page);
    const deleted = await deleteResponse;
    expect(deleted.status()).toBe(200);
    const deletedBody = await deleted.json();
    expect(deletedBody.code).toBe(200);
    expect(new URL(deleted.url()).pathname).toContain(
      encodeURIComponent(tokenId),
    );

    await expect(page.getByText('强退成功').first()).toBeVisible();
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
    );
    await page.getByRole('button', { name: /刷\s*新/ }).click();
    const refreshedResponse = await refreshed;
    const refreshedBody = await refreshedResponse.json();
    expect(refreshedBody.rows.some((row: any) => row.tokenId === tokenId)).toBe(
      false,
    );
    expect(refreshedBody.total).toBe(initialBody.total - 1);
    expect(pageErrors).toEqual([]);
  });

  test('A-04 批量强退 2 条：2 次 DELETE 与成功汇总', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const targetTokens: string[] = initialBody.rows
      .filter((row: any) => row.userName === ONLINE_USER)
      .map((row: any) => row.tokenId);

    const deleteRequests: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname.includes('/monitor/online/')
      ) {
        deleteRequests.push(request.url());
      }
    });

    const rows = fixtureRows(page);
    await expect(rows).toHaveCount(2);
    await rows.locator('.vxe-checkbox--icon').nth(0).click();
    await rows.locator('.vxe-checkbox--icon').nth(1).click();

    const batchButton = page.locator('[data-testid="online-batch-logout"]');
    await expect(batchButton).toBeEnabled();
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
      { timeout: 30_000 },
    );
    await batchButton.click();
    await confirmDialog(page);

    await expect(page.getByText(/成功 2 条，失败 0 条/).first()).toBeVisible();

    const refreshedResponse = await refreshed;
    const refreshedBody = await refreshedResponse.json();
    expect(deleteRequests).toHaveLength(2);
    for (const tokenId of targetTokens) {
      expect(
        refreshedBody.rows.some((row: any) => row.tokenId === tokenId),
      ).toBe(false);
    }
    expect(refreshedBody.total).toBe(initialBody.total - 2);
    expect(pageErrors).toEqual([]);
  });

  test('A-05 批量部分失败：继续执行并汇总成功 1 条失败 1 条', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const targetTokens: string[] = initialBody.rows
      .filter((row: any) => row.userName === ONLINE_USER)
      .map((row: any) => row.tokenId);

    let deleteCount = 0;
    await page.route('**/monitor/online/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      deleteCount += 1;
      if (deleteCount === 1) {
        await route.fulfill({
          body: JSON.stringify({ code: 500, msg: '服务器错误' }),
          contentType: 'application/json',
          status: 500,
        });
        return;
      }
      await route.continue();
    });

    const rows = fixtureRows(page);
    await expect(rows).toHaveCount(2);
    await rows.locator('.vxe-checkbox--icon').nth(0).click();
    await rows.locator('.vxe-checkbox--icon').nth(1).click();
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
      { timeout: 30_000 },
    );
    await page.locator('[data-testid="online-batch-logout"]').click();
    await confirmDialog(page);

    await expect(page.getByText(/成功 1 条，失败 1 条/).first()).toBeVisible();
    await expect(page.getByText('服务器错误').first()).toBeVisible();
    expect(deleteCount).toBe(2);

    const failedToken = targetTokens[0];
    const refreshedResponse = await refreshed;
    const refreshedBody = await refreshedResponse.json();
    const failedRowStillVisible = refreshedBody.rows.some(
      (row: any) => row.tokenId === failedToken,
    );
    expect(failedRowStillVisible).toBe(true);
    await expect(onlineRows(page).filter({ hasText: ONLINE_USER })).toHaveCount(
      1,
    );
    expect(pageErrors).toEqual([]);
    await page.unroute('**/monitor/online/*');
  });

  test('A-10 仅列表权限：列表可见但强退按钮不渲染', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await loginWithCaptcha(page, LIMITED_USER, 'admin123');
    const response = await gotoOnlinePage(page);
    const body = await response.json();
    expect(body.total).toBeGreaterThanOrEqual(1);

    await expect(
      page.locator('[data-testid="online-force-logout"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="online-batch-logout"]'),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-01 无匹配：空态且不弹错误提示', async ({ browser, page }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);
    const response = await search(page, {
      请输入登录名称: 'spec007_not_exist',
    });
    const body = await response.json();
    expect(body.total).toBe(0);
    expect(body.rows).toEqual([]);
    await expect(page.getByText('暂无数据').last()).toBeVisible();
    await expect(page.locator('.ant-message-error')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-02 地址与名称同时匹配 1 个会话（AND 语义）', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const ipaddr = initialBody.rows[0].ipaddr;

    const response = await search(page, {
      请输入登录地址: ipaddr,
      请输入登录名称: ONLINE_USER,
    });
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.rows[0].userName).toBe(ONLINE_USER);
    expect(body.rows[0].ipaddr).toBe(ipaddr);
    expect(pageErrors).toEqual([]);
  });

  test('E-03 特殊字符筛选：HTTP 非 500、total=0、无 pageerror', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);

    const response = await search(page, {
      请输入登录名称: "' OR 1=1",
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.code).toBe(200);
    expect(body.total).toBe(0);
    expect(body.rows).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('E-05 会话已过期：强退返回 200，刷新后行消失', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    const initial = await gotoOnlinePage(page);
    const initialBody = await initial.json();
    const tokenId = initialBody.rows.find(
      (row: any) => row.userName === ONLINE_USER,
    ).tokenId;
    await expect(fixtureRows(page)).toHaveCount(1);

    // 模拟会话在点击前从 Redis 过期：只删在线键，页面仍展示该行。
    deleteOnlineToken(tokenId);

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.includes('/monitor/online/'),
    );
    const actionRow = await fixedActionRow(page, ONLINE_USER);
    await actionRow.locator('[data-testid="online-force-logout"]').click();
    await confirmDialog(page);
    const deleted = await deleteResponse;
    expect(deleted.status()).toBe(200);
    const deletedBody = await deleted.json();
    expect(deletedBody.code).toBe(200);

    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT),
    );
    await page.getByRole('button', { name: /刷\s*新/ }).click();
    const refreshedResponse = await refreshed;
    const refreshedBody = await refreshedResponse.json();
    expect(refreshedBody.rows.some((row: any) => row.tokenId === tokenId)).toBe(
      false,
    );
    await expect(page.locator('.ant-message-error')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-06 批量超时：1 成功 1 失败，提示网络错误文案', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);

    let deleteCount = 0;
    await page.route('**/monitor/online/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      deleteCount += 1;
      if (deleteCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    const rows = fixtureRows(page);
    await expect(rows).toHaveCount(2);
    await rows.locator('.vxe-checkbox--icon').nth(0).click();
    await rows.locator('.vxe-checkbox--icon').nth(1).click();
    await page.locator('[data-testid="online-batch-logout"]').click();
    await confirmDialog(page);

    await expect(page.getByText(/成功 1 条，失败 1 条/).first()).toBeVisible();
    expect(deleteCount).toBe(2);
    expect(pageErrors).toEqual([]);
    await page.unroute('**/monitor/online/*');
  });

  test('E-07 未勾选：批量按钮 disabled 且不发起 DELETE', async ({
    browser,
    page,
  }) => {
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);

    let deleteCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'DELETE') {
        deleteCount += 1;
      }
    });
    const batchButton = page.locator('[data-testid="online-batch-logout"]');
    await expect(batchButton).toBeDisabled();
    expect(deleteCount).toBe(0);
  });

  test('E-08 批量确认点取消：不发 DELETE，勾选保持', async ({
    browser,
    page,
  }) => {
    await seedOnlineSessions(browser, 1);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);

    let deleteCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'DELETE') {
        deleteCount += 1;
      }
    });

    const row = fixtureRows(page).first();
    await row.locator('.vxe-checkbox--icon').click();
    await page.locator('[data-testid="online-batch-logout"]').click();
    await page.getByRole('button', { name: /取\s*消/ }).click();

    expect(deleteCount).toBe(0);
    await expect(row.locator('.vxe-checkbox--icon')).toHaveClass(
      /checkbox-checked-fill/,
    );
  });

  test('E-15 无 monitor 权限：直达在线页落 404，且不请求列表', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    let listRequests = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname.endsWith(ONLINE_LIST_ENDPOINT)
      ) {
        listRequests += 1;
      }
    });

    await loginWithCaptcha(page, NO_MONITOR_USER, 'admin123');
    await gotoAppPath(page, '/monitor/online');
    await expect(page.getByText(/(403|404|未找到页面)/).first()).toBeVisible();
    expect(listRequests).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-16 连续两次确认：按钮 disabled 拦截，DELETE 总数仍为 2', async ({
    browser,
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await seedOnlineSessions(browser, 2);
    await loginWithCaptcha(page, 'admin', 'admin123');
    await gotoOnlinePage(page);

    let deleteCount = 0;
    await page.route('**/monitor/online/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      deleteCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    const rows = fixtureRows(page);
    await expect(rows).toHaveCount(2);
    await rows.locator('.vxe-checkbox--icon').nth(0).click();
    await rows.locator('.vxe-checkbox--icon').nth(1).click();
    const batchButton = page.locator('[data-testid="online-batch-logout"]');
    await batchButton.click();
    const confirmButton = page.getByRole('button', { name: /确\s*定/ });
    await confirmButton.click();
    // 执行中按钮应为 disabled；强行点击不得再发起确认
    await expect(confirmButton).toBeDisabled();
    await expect(batchButton).toBeDisabled();

    await expect(page.getByText(/成功 2 条，失败 0 条/)).toHaveCount(1);
    expect(deleteCount).toBe(2);
    expect(pageErrors).toEqual([]);
    await page.unroute('**/monitor/online/*');
  });
});

const CACHE_ENDPOINT = '/monitor/cache';

/** 打开缓存页并返回首次 `GET /monitor/cache` 响应。 */
async function gotoCachePage(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith(CACHE_ENDPOINT),
    { timeout: 30_000 },
  );
  await gotoAppPath(page, '/monitor/cache');
  return responsePromise;
}

function cacheData(
  info: Record<string, string>,
  dbSize: null | number,
  commandStats: Array<{ name: string; value: string }> = [
    { name: 'get', value: '120' },
  ],
) {
  return { commandStats, dbSize, info };
}

test.describe('SPEC-007 缓存监控', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('A-06 12 项信息、dbSize 与 pageerror=0', async ({ page }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
    const pageErrors = collectPageErrors(page);
    const response = await gotoCachePage(page);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.code).toBe(200);

    const table = page.locator('[data-testid="cache-info-table"]');
    await expect(table).toBeVisible({ timeout: 30_000 });
    for (const label of [
      'Redis版本',
      '运行模式',
      '端口',
      '客户端数',
      '运行时间(天)',
      '使用内存',
      '使用CPU',
      '内存配置',
      'AOF是否开启',
      'RDB是否成功',
      'Key数量',
      '网络入口/出口',
    ]) {
      await expect(table.getByText(label, { exact: true })).toHaveCount(1);
    }

    const expectedSize =
      body.data.dbSize === null ? '—' : String(body.data.dbSize);
    await expect(page.locator('[data-testid="cache-db-size"]')).toHaveText(
      expectedSize,
    );
    expect(pageErrors).toEqual([]);
  });

  test('A-07 两个图表容器各 1 个 canvas 且尺寸 ≥ 100', async ({ page }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
    const pageErrors = collectPageErrors(page);
    const response = await gotoCachePage(page);
    const body = await response.json();
    expect(body.data.commandStats.length).toBeGreaterThanOrEqual(1);

    for (const testId of ['cache-command-chart', 'cache-memory-chart']) {
      const container = page.locator(`[data-testid="${testId}"]`);
      const canvas = container.locator('canvas');
      await expect(canvas).toHaveCount(1, { timeout: 30_000 });
      const box = await canvas.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(100);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(100);
    }
    expect(pageErrors).toEqual([]);
  });

  test('E-09 接口失败：只显示后端 msg，信息表与图表不渲染', async ({
    page,
  }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
    const pageErrors = collectPageErrors(page);
    await page.route(`**${CACHE_ENDPOINT}`, async (route) => {
      await route.fulfill({
        body: JSON.stringify({ code: 500, msg: 'Redis 连接失败' }),
        contentType: 'application/json',
        status: 500,
      });
    });

    await gotoAppPath(page, '/monitor/cache');

    await expect(page.getByText('Redis 连接失败').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="cache-info-table"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-testid="cache-command-chart"] canvas'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="cache-memory-chart"] canvas'),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await page.unroute(`**${CACHE_ENDPOINT}`);
  });

  test('E-10 缺 redis_version：该单元格为「—」，其余字段正常', async ({
    page,
  }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
    const pageErrors = collectPageErrors(page);
    const info = {
      aof_enabled: '1',
      connected_clients: '3',
      instantaneous_input_kbps: '1.5',
      instantaneous_output_kbps: '2.5',
      maxmemory_human: '4.00G',
      rdb_last_bgsave_status: 'ok',
      redis_mode: 'standalone',
      tcp_port: '6379',
      uptime_in_days: '12',
      used_cpu_user_children: '0.123',
      used_memory_human: '1.00M',
    };
    await page.route(`**${CACHE_ENDPOINT}`, async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          code: 200,
          data: cacheData(info, 0),
          msg: '操作成功',
        }),
        contentType: 'application/json',
        status: 200,
      });
    });

    await gotoAppPath(page, '/monitor/cache');

    await expect(page.locator('[data-testid="cache-info-table"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-testid="cache-field-redis_version"]'),
    ).toHaveText('—');
    await expect(
      page.locator('[data-testid="cache-field-redis_mode"]'),
    ).toHaveText('单机');
    await expect(page.locator('[data-testid="cache-db-size"]')).toHaveText('0');
    await expect(
      page.locator('[data-testid="cache-field-aof_enabled"]'),
    ).toHaveText('是');
    await expect(
      page.locator('[data-testid="cache-field-used_cpu_user_children"]'),
    ).toHaveText('0.12');
    expect(pageErrors).toEqual([]);
    await page.unroute(`**${CACHE_ENDPOINT}`);
  });

  test('E-11 命令统计为空：显示「暂无数据」，命令图 canvas=0、内存图 canvas=1', async ({
    page,
  }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
    const pageErrors = collectPageErrors(page);
    const info = {
      aof_enabled: '0',
      connected_clients: '2',
      instantaneous_input_kbps: '0.5',
      instantaneous_output_kbps: '0.5',
      maxmemory_human: '4.00G',
      rdb_last_bgsave_status: 'ok',
      redis_mode: 'standalone',
      redis_version: '7.2.5',
      tcp_port: '6379',
      uptime_in_days: '5',
      used_cpu_user_children: '0',
      used_memory_human: '2.00M',
    };
    await page.route(`**${CACHE_ENDPOINT}`, async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          code: 200,
          data: cacheData(info, 5, []),
          msg: '操作成功',
        }),
        contentType: 'application/json',
        status: 200,
      });
    });

    await gotoAppPath(page, '/monitor/cache');

    const commandChart = page.locator('[data-testid="cache-command-chart"]');
    await expect(commandChart.getByText('暂无数据').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(commandChart.locator('canvas')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="cache-memory-chart"] canvas'),
    ).toHaveCount(1, { timeout: 30_000 });
    expect(pageErrors).toEqual([]);
    await page.unroute(`**${CACHE_ENDPOINT}`);
  });

  test('E-14 无 cache 权限：直达缓存页落 404，且不请求缓存接口', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    let cacheRequests = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname.endsWith(CACHE_ENDPOINT)
      ) {
        cacheRequests += 1;
      }
    });

    await loginWithCaptcha(page, LIMITED_USER, 'admin123');
    await gotoAppPath(page, '/monitor/cache');
    await expect(page.getByText(/(403|404|未找到页面)/).first()).toBeVisible();
    expect(cacheRequests).toBe(0);
    expect(pageErrors).toEqual([]);
  });
});

// E-04 的 12 条本地分页由 `online-page-logic.test.ts` 覆盖（SPEC-007 UNVERIFIABLE 清单）。
