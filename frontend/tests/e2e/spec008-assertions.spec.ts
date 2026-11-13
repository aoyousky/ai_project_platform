import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  waitForAppReady,
} from './helpers';

/**
 * SPEC-008 原生 Admin 监控 / 任务调度中心断言（REQ-20261112-008）。
 *
 * 控制台 REST API 由 `page.route` 提供夹具，避免依赖外部控制台进程；
 * 权限用例复用 SPEC-007 夹具账号（`spec007_limited` 仅有 `monitor:online:list`）。
 * trace 关闭，避免控制台令牌进入证据。
 */
test.use({ trace: 'off' });

const LIMITED_USER = 'spec007_limited';

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** 返回请求计数器；按路径后缀与 method 过滤。 */
function countRequests(
  page: Page,
  suffix: string,
  method = 'GET',
): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (
      request.method() === method &&
      new URL(request.url()).pathname.endsWith(suffix)
    ) {
      count += 1;
    }
  });
  return () => count;
}

function fulfillJson(page: Page, url: RegExp, body: unknown, status = 200) {
  return page.route(url, (route) =>
    route.fulfill({
      body: JSON.stringify(body),
      contentType: 'application/json',
      status,
    }),
  );
}

async function gotoAdminPage(page: Page): Promise<void> {
  await gotoAppPath(page, '/monitor/Admin');
}

async function gotoSnailJobPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('snailjob_token', 'jwt-test-token');
    sessionStorage.setItem('snailjob_namespace', 'dev');
  });
  // `gotoAppPath` 目标与当前地址只差 hash 时不会新建文档，init script 也就不会执行；
  // 先整页 reload 让 init script 在当前标签页写入控制台会话。
  await page.reload();
  await waitForAppReady(page);
  await gotoAppPath(page, '/monitor/snailjob');
}

const ADMIN_APPS = [
  {
    name: 'aoyou-admin',
    status: 'UP',
    statusTimestamp: '2026-11-12T00:30:57.753291Z',
    instances: [
      {
        id: 'i-1',
        metadata: { userpassword: 'raw-password-must-not-render' },
        statusInfo: { status: 'UP' },
      },
    ],
  },
  { name: 'demo-down', status: 'DOWN', instances: [] },
];

const JOBS = [
  {
    groupName: 'ruoyi_group',
    id: 1,
    jobName: 'demo-job',
    jobStatus: 1,
    nextTriggerAt: '2026-11-12 13:39:58',
  },
  {
    groupName: 'ruoyi_group',
    id: 2,
    jobName: 'other-job',
    jobStatus: 0,
    nextTriggerAt: null,
  },
];

const TASKS = [
  {
    createDt: '2026-11-12 10:00:00',
    status: 2,
    taskBatchId: 22,
  },
  {
    createDt: '2026-11-12 10:00:00',
    status: 4,
    taskBatchId: 33,
  },
];

function jobsResponse(list: unknown[], total = list.length) {
  return { data: list, page: 1, size: 10, status: 1, total };
}

function tasksResponse(list: unknown[], total = list.length) {
  return { data: list, page: 1, size: 10, status: 1, total };
}

test.describe('SPEC-008 Admin 监控', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test.beforeEach(async ({ page }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
  });

  test('A-01/A-02 应用列表行数与状态列等于响应', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await fulfillJson(page, /\/admin\/applications$/u, ADMIN_APPS);
    await gotoAdminPage(page);

    const rows = page.locator('[data-testid="admin-app-row"]');
    await expect(rows).toHaveCount(2, { timeout: 30_000 });

    const names = await page
      .locator('[data-testid="admin-app-name"]')
      .allInnerTexts();
    expect(names.toSorted()).toEqual(['aoyou-admin', 'demo-down']);

    const statuses = await page
      .locator('[data-testid="admin-app-status"]')
      .allInnerTexts();
    expect(statuses.toSorted()).toEqual(['DOWN', 'UP']);
    expect(pageErrors).toEqual([]);
  });

  test('A-03 环境表格行数等于 propertySources 且 ≤ 200，敏感值脱敏（A-11）', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const envCalls = countRequests(page, '/actuator/env');
    await fulfillJson(page, /\/admin\/applications$/u, ADMIN_APPS);
    await fulfillJson(page, /\/admin\/instances\/i-1\/actuator\/env$/u, {
      propertySources: [
        {
          name: 'systemEnvironment',
          properties: {
            DB_PASSWORD: 'raw-secret-value',
            'server.port': '8080',
          },
        },
        {
          name: 'applicationConfig',
          properties: { 'app.name': 'demo' },
        },
      ],
    });
    await gotoAdminPage(page);

    await page.locator('[data-testid="admin-instance-env"]').first().click();

    const envRows = page.locator('[data-testid="admin-env-source"]');
    await expect(envRows).toHaveCount(2);
    expect(envCalls()).toBe(1);

    // A-11：展开配置源后，敏感键值为 ***，原文不出现
    await page.locator('[data-testid="admin-env-toggle"]').first().click();
    await expect(
      page.locator('[data-testid="admin-env-property"]').first(),
    ).toBeVisible();
    await expect(page.getByText('***').first()).toBeVisible();
    await expect(page.getByText('raw-secret-value')).toHaveCount(0);
    await expect(page.getByText('raw-password-must-not-render')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('A-04 日志按纯文本渲染且 ≤ 200 行', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const logCalls = countRequests(page, '/actuator/logfile');
    const lines = Array.from(
      { length: 250 },
      (_, index) => `line-${index + 1}`,
    );
    await fulfillJson(page, /\/admin\/applications$/u, ADMIN_APPS);
    await page.route(/\/admin\/instances\/i-1\/actuator\/logfile$/u, (route) =>
      route.fulfill({
        body: lines.join('\n'),
        contentType: 'text/plain',
        status: 200,
      }),
    );
    await gotoAdminPage(page);

    await page.locator('[data-testid="admin-instance-log"]').first().click();

    const log = page.locator('[data-testid="admin-log"]');
    await expect(log).toBeVisible();
    const text = await log.innerText();
    const rendered = text.split(/\r?\n/u).filter(Boolean);
    expect(rendered.length).toBeLessThanOrEqual(200);
    expect(text).toContain('line-250');
    expect(logCalls()).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('A-05 未登录：显示登录提示、不渲染应用表（401）', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.route(/\/admin\/applications$/u, (route) =>
      route.fulfill({ status: 401 }),
    );
    await gotoAdminPage(page);

    const tip = page.locator('[data-testid="console-login-tip"]');
    await expect(tip).toBeVisible({ timeout: 30_000 });
    await expect(tip).toContainText('请先登录官方控制台');
    const link = page.locator('[data-testid="console-login-link"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/login');
    await expect(page.locator('[data-testid="admin-app-list"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-01 空应用列表：空态、不弹错误', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await fulfillJson(page, /\/admin\/applications$/u, []);
    await gotoAdminPage(page);

    await expect(page.locator('[data-testid="admin-empty"]')).toContainText(
      '暂无应用',
    );
    await expect(page.locator('[data-testid="admin-error"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-02 环境配置为空：暂无配置项且只请求一次', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const envCalls = countRequests(page, '/actuator/env');
    await fulfillJson(page, /\/admin\/applications$/u, ADMIN_APPS);
    await fulfillJson(page, /\/admin\/instances\/i-1\/actuator\/env$/u, {
      propertySources: [],
    });
    await gotoAdminPage(page);

    await page.locator('[data-testid="admin-instance-env"]').first().click();
    await expect(page.locator('[data-testid="admin-env-empty"]')).toContainText(
      '暂无配置项',
    );
    expect(envCalls()).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('E-03 环境配置超限：仅渲染前 200 条并提示截断', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const sources = Array.from({ length: 500 }, (_, index) => ({
      name: `source-${index + 1}`,
      properties: { 'server.port': '8080' },
    }));
    await fulfillJson(page, /\/admin\/applications$/u, ADMIN_APPS);
    await fulfillJson(page, /\/admin\/instances\/i-1\/actuator\/env$/u, {
      propertySources: sources,
    });
    await gotoAdminPage(page);

    await page.locator('[data-testid="admin-instance-env"]').first().click();

    await expect(page.locator('[data-testid="admin-env-source"]')).toHaveCount(
      200,
    );
    await expect(
      page.locator('[data-testid="admin-env-truncated"]'),
    ).toContainText('已截断，仅显示前 200 条');
    expect(pageErrors).toEqual([]);
  });

  test('E-11 反代 502 HTML：提示控制台不可用，不抛 pageerror', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await page.route(/\/admin\/applications$/u, (route) =>
      route.fulfill({
        body: '<html><body>bad gateway</body></html>',
        contentType: 'text/html',
        status: 502,
      }),
    );
    await gotoAdminPage(page);

    await expect(page.locator('[data-testid="admin-error"]')).toContainText(
      '控制台不可用',
    );
    await expect(page.locator('[data-testid="admin-app-list"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('SPEC-008 任务调度中心', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test.beforeEach(async ({ page }) => {
    await loginWithCaptcha(page, 'admin', 'admin123');
  });

  test('A-06 进入页面发出 1 次分页请求，列含任务名/组/状态/下次触发', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const listCalls = countRequests(page, '/snail-job/job/page/list');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await expect(page.locator('[data-testid="snailjob-job-row"]')).toHaveCount(
      2,
      { timeout: 30_000 },
    );
    expect(listCalls()).toBe(1);
    for (const title of ['任务名', '组', '状态', '下次触发']) {
      await expect(
        page.locator('[data-testid="snailjob-job-list"]').getByText(title),
      ).toBeVisible();
    }
    const statusTexts = await page
      .locator('[data-testid="snailjob-job-status"]')
      .allInnerTexts();
    expect(statusTexts.toSorted()).toEqual(['停用', '启用']);
    expect(pageErrors).toEqual([]);
  });

  test('A-07 执行记录：1 次请求、行数等于数组长度、空数组显示暂无数据', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const taskCalls = countRequests(page, '/snail-job/job/task/list');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/task\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(tasksResponse(TASKS)),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    const row = page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' });
    const taskRequest = page.waitForRequest(/\/snail-job\/job\/task\/list/u);
    await row.locator('[data-testid="snailjob-task-view"]').click();

    const taskRequestInstance = await taskRequest;
    const requestUrl = new URL(taskRequestInstance.url());
    expect(requestUrl.searchParams.get('jobId')).toBe('1');
    await expect(page.locator('[data-testid="snailjob-task-row"]')).toHaveCount(
      2,
    );
    expect(taskCalls()).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('A-07b 执行记录空数组：显示暂无数据', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/task\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(tasksResponse([])),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-task-view"]')
      .click();
    await expect(
      page.locator('[data-testid="snailjob-task-empty"]'),
    ).toContainText('暂无数据');
    expect(pageErrors).toEqual([]);
  });

  test('A-08 执行：确认后 1 次 trigger、提示执行成功并刷新列表', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const listCalls = countRequests(page, '/snail-job/job/page/list');
    const triggerCalls = countRequests(page, '/snail-job/job/trigger', 'POST');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/trigger$/u, (route) =>
      route.fulfill({
        body: JSON.stringify({ data: true, message: 'ok', status: 1 }),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-trigger"]')
      .click();
    await expect(
      page.locator('[data-testid="snailjob-confirm"]'),
    ).toBeVisible();
    const triggerRequest = page.waitForRequest(/\/snail-job\/job\/trigger$/u);
    await page.locator('[data-testid="snailjob-confirm-ok"]').click();

    await expect(page.locator('[data-testid="action-toast"]')).toContainText(
      '执行成功',
    );
    expect(triggerCalls()).toBe(1);
    const triggerRequestInstance = await triggerRequest;
    expect(triggerRequestInstance.postDataJSON()).toEqual({ jobId: 1 });
    await expect.poll(() => listCalls()).toBe(2);
    expect(pageErrors).toEqual([]);
  });

  test('A-09 停止 RUNNING 记录：1 次 stop、提示停止成功并刷新', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const stopCalls = countRequests(
      page,
      '/snail-job/job/batch/stop/22',
      'POST',
    );
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    let taskPayload: unknown[] = TASKS;
    await page.route(/\/snail-job\/job\/task\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(tasksResponse(taskPayload)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/batch\/stop\/22$/u, (route) => {
      taskPayload = [
        { createDt: '2026-11-12 10:00:00', status: 5, taskBatchId: 22 },
      ];
      return route.fulfill({
        body: JSON.stringify({ data: true, message: 'ok', status: 1 }),
        contentType: 'application/json',
      });
    });
    await gotoSnailJobPage(page);

    await page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-task-view"]')
      .click();
    const runningRow = page
      .locator('[data-testid="snailjob-task-row"]')
      .filter({ hasText: '22' });
    await expect(
      runningRow.locator('[data-testid="snailjob-stop"]'),
    ).toBeEnabled();
    await runningRow.locator('[data-testid="snailjob-stop"]').click();

    await expect(page.locator('[data-testid="action-toast"]')).toContainText(
      '停止成功',
    );
    expect(stopCalls()).toBe(1);
    await expect(
      page
        .locator('[data-testid="snailjob-task-row"]')
        .filter({ hasText: '22' }),
    ).toContainText('已停止');
    expect(pageErrors).toEqual([]);
  });

  test('A-10 重试 FAIL 记录：1 次 retry、提示重试成功', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const retryCalls = countRequests(
      page,
      '/snail-job/job/batch/retry/33',
      'POST',
    );
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/task\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(tasksResponse(TASKS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/batch\/retry\/33$/u, (route) =>
      route.fulfill({
        body: JSON.stringify({ data: true, message: 'ok', status: 1 }),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-task-view"]')
      .click();
    const failRow = page
      .locator('[data-testid="snailjob-task-row"]')
      .filter({ hasText: '33' });
    await failRow.locator('[data-testid="snailjob-retry"]').click();

    await expect(page.locator('[data-testid="action-toast"]')).toContainText(
      '重试成功',
    );
    expect(retryCalls()).toBe(1);
    await expect(
      page.locator('[data-testid="snailjob-task-row"]'),
    ).not.toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-08 未登录（5001）：登录提示与打开控制台链接', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify({ message: '未登录', status: 5001 }),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    const tip = page.locator('[data-testid="snailjob-login-tip"]');
    await expect(tip).toBeVisible({ timeout: 30_000 });
    await expect(tip).toContainText('请先登录任务调度中心');
    await expect(
      page.locator('[data-testid="snailjob-open-console"]'),
    ).toHaveAttribute('href', '/snail-job');
    await expect(page.locator('[data-testid="snailjob-job-list"]')).toHaveCount(
      0,
    );
    expect(pageErrors).toEqual([]);
  });

  test('E-09 连续点击执行：按钮 disabled，trigger 只发 1 次', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const triggerCalls = countRequests(page, '/snail-job/job/trigger', 'POST');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/trigger$/u, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        body: JSON.stringify({ data: true, message: 'ok', status: 1 }),
        contentType: 'application/json',
      });
    });
    await gotoSnailJobPage(page);

    const trigger = page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-trigger"]');
    await trigger.click();
    await page.locator('[data-testid="snailjob-confirm-ok"]').click();
    await expect(trigger).toBeDisabled();
    await trigger.click({ force: true }).catch(() => {});
    await expect.poll(() => triggerCalls()).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('E-10 SUCCESS 记录的停止按钮 disabled，不发 stop', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const stopCalls = countRequests(page, '/snail-job/job/batch/stop', 'POST');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse(JOBS)),
        contentType: 'application/json',
      }),
    );
    await page.route(/\/snail-job\/job\/task\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(
          tasksResponse([{ createDt: null, status: 3, taskBatchId: 44 }]),
        ),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await page
      .locator('[data-testid="snailjob-job-row"]')
      .filter({ hasText: 'demo-job' })
      .locator('[data-testid="snailjob-task-view"]')
      .click();
    await expect(page.locator('[data-testid="snailjob-stop"]')).toBeDisabled();
    expect(stopCalls()).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-12 任务总数 0：暂无任务、分页码 0、不请求执行记录', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const taskCalls = countRequests(page, '/snail-job/job/task/list');
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: JSON.stringify(jobsResponse([], 0)),
        contentType: 'application/json',
      }),
    );
    await gotoSnailJobPage(page);

    await expect(page.locator('[data-testid="snailjob-empty"]')).toContainText(
      '暂无任务',
    );
    await expect(
      page.locator('[data-testid="snailjob-pager"]'),
    ).toHaveAttribute('data-total', '0');
    expect(taskCalls()).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-11 (SnailJob) 502 HTML：控制台不可用', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.route(/\/snail-job\/job\/page\/list/u, (route) =>
      route.fulfill({
        body: '<html><body>502</body></html>',
        contentType: 'text/html',
        status: 502,
      }),
    );
    await gotoSnailJobPage(page);

    await expect(page.locator('[data-testid="snailjob-error"]')).toContainText(
      '控制台不可用',
    );
    await expect(page.locator('[data-testid="snailjob-job-list"]')).toHaveCount(
      0,
    );
    expect(pageErrors).toEqual([]);
  });
});

/**
 * 权限边界单独成组：组内不预登录 admin，用例自己以 `spec007_limited`
 * 登录（该账号仅有 `monitor:online:list`，无 admin/snailjob 权限）。
 */
test.describe('SPEC-008 权限边界', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('E-05 无 monitor:admin:list：直达 404 且不请求控制台', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    let adminRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/admin')) {
        adminRequests += 1;
      }
    });

    await loginWithCaptcha(page, LIMITED_USER, 'admin123');
    await gotoAppPath(page, '/monitor/Admin');
    await expect(page.getByText(/(403|404|未找到页面)/u).first()).toBeVisible();
    expect(adminRequests).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('E-06 无 monitor:snailjob:list：直达 404 且不请求控制台', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    let snailjobRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/snail-job')) {
        snailjobRequests += 1;
      }
    });

    await loginWithCaptcha(page, LIMITED_USER, 'admin123');
    await gotoAppPath(page, '/monitor/snailjob');
    await expect(page.getByText(/(403|404|未找到页面)/u).first()).toBeVisible();
    expect(snailjobRequests).toBe(0);
    expect(pageErrors).toEqual([]);
  });
});

// E-04（日志 5MB ≤ 200 行）与 E-07（30s 超时）由
// `admin-page-logic.test.ts`、`admin-api.test.ts` 覆盖（SPEC-008 UNVERIFIABLE 清单）。
