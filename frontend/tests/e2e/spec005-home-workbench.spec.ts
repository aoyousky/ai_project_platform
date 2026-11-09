import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
  waitForAppReady,
} from './helpers';
import { installSpec005Access, spec005Token } from './spec005-token';

/**
 * SPEC-005 A-01～A-12 的 DOM 面（评测集 `specs/evals/REQ-20261108-006`）。
 *
 * 数据由 `scripts/evals/seed_spec005.sh` 写入本地 Docker 测试栈；账号令牌由
 * `scripts/evals/run_spec005.sh` 生成并经 `EVAL_SPEC005_TOKENS_FILE` 传入。
 *
 * 路由模式是 hash（`.env.production`），因此断言落地路径时从 `#/...` 取路径，
 * 不能直接读 `window.location.pathname`（它恒为 `/`）。
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5666';

/** 页面未捕获异常（A-01～A-12 的 `pageerror 计数 = 0`） */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** 当前路由路径：hash 模式取 `#` 之后，history 模式取 pathname */
function routePath(url: string): string {
  const parsed = new URL(url);
  return parsed.hash.startsWith('#/') ? parsed.hash.slice(1) : parsed.pathname;
}

/** Asia/Shanghai 的 `YYYY-MM-DD`，offsetDays 可为负（D-6～D） */
function shanghaiDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

async function openAs(
  page: Page,
  kind: Parameters<typeof spec005Token>[0],
  hashPath: string,
): Promise<void> {
  await installSpec005Access(page, spec005Token(kind));
  await page.goto(`${BASE_URL}/#${hashPath}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForAppReady(page);
}

test.describe('SPEC-005 首页与工作台断言', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('A-01 首页 KPI 按契约数值展示', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/index');

    await expect(page.getByTestId('home-kpi-user-total')).toHaveText('1,286');
    await expect(page.getByTestId('home-kpi-online')).toHaveText('48');
    await expect(page.getByTestId('home-kpi-todo')).toHaveText('7');
    await expect(page.getByTestId('home-kpi-today-login')).toHaveText('213');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-02 登录趋势恰好 7 项且末值 213', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/index');

    await expect(page.getByTestId('home-login-trend')).toBeVisible();
    const rows = page.getByTestId('home-trend-table').locator('tbody tr');
    await expect(rows).toHaveCount(7);
    const dateCells = rows.locator('td:first-child');
    await expect(dateCells.first()).toHaveText(shanghaiDate(-6));
    await expect(dateCells.last()).toHaveText(shanghaiDate(0));
    await expect(page.getByTestId('home-trend-last-value')).toHaveText('213');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-03 部门 Top5 人数与顺序', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/index');

    const rows = page.getByTestId('home-dept-row');
    await expect(rows).toHaveCount(5);
    await expect(page.getByTestId('home-dept-value').first()).toHaveText('286');

    const expected = [
      '运营中心',
      '技术中心',
      '客户成功部',
      '财务部',
      '人力资源部',
    ];
    for (const [index, name] of expected.entries()) {
      await expect(rows.nth(index)).toContainText(name);
    }

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-04 系统健康状态与三项资源指标', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/index');

    await expect(page.getByTestId('home-health-status')).toHaveText(
      '部分服务状态未知',
    );
    await expect(page.getByTestId('home-meter')).toHaveCount(3);
    // 任务调度未配置探活：状态“未知”且不展示延迟
    const scheduler = page.locator('.health-service', { hasText: '任务调度' });
    await expect(scheduler).toContainText('未知');
    await expect(scheduler).not.toContainText('ms');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-05 公告与最近登录/操作列表', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/index');

    const notices = page.getByTestId('home-notice-row');
    await expect(notices).toHaveCount(3);
    const titles = ['系统升级通知', '安全提醒：请更新密码', '国庆值班安排'];
    for (const [index, title] of titles.entries()) {
      await expect(notices.nth(index)).toContainText(title);
    }
    await expect(page.getByTestId('home-recent-login-row')).toHaveCount(5);
    await expect(page.getByTestId('home-recent-oper-row')).toHaveCount(5);

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-06 受限用户只看到有权限的卡片', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Limited', '/index');

    await expect(page.getByTestId('home-system-card')).toHaveCount(0);
    await expect(page.getByTestId('home-health-card')).toHaveCount(0);
    await expect(page.getByTestId('home-dept-card')).toHaveCount(0);
    await expect(page.getByTestId('home-recent-login-card')).toHaveCount(0);
    await expect(page.getByTestId('home-recent-oper-card')).toHaveCount(0);
    await expect(page.getByTestId('home-notice-card')).toBeVisible();
    await expect(page.getByTestId('home-kpi-todo')).toHaveText('7');
    await expect(page.getByTestId('home-notice-row')).toHaveCount(3);

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-07 工作台页签、分组计数与待办行', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/dashboard/workspace');

    await expect(page.getByTestId('workbench-tab-todo')).toContainText('7');
    await expect(page.getByTestId('workbench-tab-done')).toContainText('32');
    await expect(page.getByTestId('workbench-tab-initiated')).toContainText('12');
    await expect(page.getByTestId('workbench-tab-copy')).toContainText('5');
    await expect(page.getByTestId('workbench-group-overdue')).toContainText('2');
    await expect(page.getByTestId('workbench-group-today')).toContainText('3');
    await expect(page.getByTestId('workbench-group-next7')).toContainText('2');
    await expect(page.getByTestId('workbench-task-row')).toHaveCount(7);

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-08 四个筛选入口只改变可见行', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/dashboard/workspace');

    const rows = page.getByTestId('workbench-task-row');
    await expect(rows).toHaveCount(7);

    const clicks = [
      { count: 2, testId: 'filter-overdue' },
      { count: 3, testId: 'filter-today' },
      { count: 2, testId: 'filter-next7' },
      { count: 7, testId: 'filter-clear' },
    ];
    for (const step of clicks) {
      await page.getByTestId(step.testId).click();
      await expect(rows).toHaveCount(step.count);
      // 页签计数来自 metrics，筛选不得改变它们
      await expect(page.getByTestId('workbench-tab-todo')).toContainText('7');
      await expect(page.getByTestId('workbench-tab-done')).toContainText('32');
      await expect(page.getByTestId('workbench-tab-initiated')).toContainText(
        '12',
      );
      await expect(page.getByTestId('workbench-tab-copy')).toContainText('5');
    }

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-09 近 7 天效率文案与 60% 进度条', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/dashboard/workspace');

    await expect(page.getByTestId('workbench-efficiency-text')).toHaveText(
      '已完成 12 / 20',
    );
    const width = await page
      .getByTestId('workbench-efficiency-bar')
      .evaluate((element) => (element as HTMLElement).style.width);
    expect(width).toBe('60%');

    const bodyText: string = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-10 登录后落到运营驾驶舱且工作台可达', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await loginWithCaptcha(page, 'spec005_admin_a', 'admin123');
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    expect(routePath(page.url())).toBe('/index');
    await expect(page.getByTestId('home-page-title')).toHaveText('运营驾驶舱', {
      timeout: APP_ENTRY_TIMEOUT,
    });
    await expect(page.getByText('即将推出')).toHaveCount(0);

    await gotoAppPath(page, '/dashboard/workspace');
    await expect(page.getByTestId('workbench-page-title')).toHaveText('工作台');
    await expect(page.getByText('即将推出')).toHaveCount(0);

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-11 租户 B 首页只展示本租户人数', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005TenantB', '/index');

    await expect(page.getByTestId('home-kpi-user-total')).toHaveText('42');
    await expect(page.getByTestId('home-dept-row')).toHaveCount(3);
    await expect(page.getByTestId('home-dept-card')).not.toContainText(
      '运营中心',
    );

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-12 登录趋势超时降级为错误态', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    const degraded = {
      code: 200,
      data: {
        deptDistribution: [],
        health: null,
        loginTrend: null,
        metrics: {
          onlineTotal: null,
          todoTotal: 7,
          todayErrorLogTotal: null,
          todayLoginTotal: null,
          userTotal: 1286,
        },
        notices: [
          {
            noticeId: '900005420000000001',
            noticeType: '1',
            noticeTypeLabel: '通知',
            publishTime: null,
            title: '系统升级通知',
          },
          {
            noticeId: '900005420000000002',
            noticeType: '2',
            noticeTypeLabel: '公告',
            publishTime: null,
            title: '安全提醒：请更新密码',
          },
          {
            noticeId: '900005420000000003',
            noticeType: '2',
            noticeTypeLabel: '公告',
            publishTime: null,
            title: '国庆值班安排',
          },
        ],
        recentLogins: null,
        recentOperations: null,
        serverTime: '2026-11-08T10:32:00+08:00',
        warnings: [
          { code: 'TIMEOUT', field: 'metrics.todayLoginTotal' },
          { code: 'TIMEOUT', field: 'loginTrend' },
        ],
      },
      msg: '操作成功',
    };

    await page.route('**/dashboard/home', (route) =>
      route.fulfill({
        body: JSON.stringify(degraded),
        contentType: 'application/json',
        status: 200,
      }),
    );
    await openAs(page, 'spec005Admin', '/index');

    await expect(page.getByTestId('home-trend-error')).toBeVisible();
    await expect(page.getByTestId('home-trend-error')).toHaveText(
      '加载失败，点击重试',
    );
    await expect(page.getByTestId('home-trend-chart')).toHaveCount(0);
    await expect(page.getByTestId('home-kpi-user-total')).toHaveText('1,286');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-13 流程进度：3 个运行中实例，null 进度不渲染进度条', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/dashboard/workspace');

    const rows = page.getByTestId('workbench-flow-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('费用报销');
    await expect(rows.nth(0)).toContainText('部门经理审批');
    await expect(rows.nth(1)).toContainText('费用报销');
    await expect(rows.nth(1)).toContainText('财务审批');
    await expect(rows.nth(2)).toContainText('合同审批');
    await expect(rows.nth(2)).toContainText('法务审批');

    // 前两个实例各完成 1/2 个审批节点 → 50%；合同审批无 node_type=1 节点
    // → progressPercent 为 null，渲染“进度未知”且不渲染进度条。
    await expect(page.getByTestId('workbench-flow-bar')).toHaveCount(2);
    await expect(rows.nth(2).getByTestId('workbench-flow-bar')).toHaveCount(0);
    await expect(rows.nth(2)).toContainText('进度未知');

    expect(pageErrors, 'pageerror').toEqual([]);
  });

  test('A-14 复选框、刷新在途与任务行去重', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await openAs(page, 'spec005Admin', '/dashboard/workspace');

    const rows = page.getByTestId('workbench-task-row');
    await expect(rows).toHaveCount(7);
    const batchAction = page.getByTestId('workbench-batch-action');
    await expect(batchAction).toBeDisabled();

    const firstCheckbox = rows.first().locator('input.task-checkbox');
    await firstCheckbox.check();
    await expect(batchAction).toBeEnabled();
    await firstCheckbox.uncheck();
    await expect(batchAction).toBeDisabled();

    // 等初始加载的 800ms 起始冷却过去，再验证刷新在途
    await page.waitForTimeout(1000);
    const workbenchRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/dashboard/workbench')) {
        workbenchRequests.push(request.url());
      }
    });
    await page.route('**/dashboard/workbench', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.getByTestId('workbench-refresh').click();
    await expect(page.getByTestId('workbench-loading')).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByTestId('workbench-refresh').click();
    expect(workbenchRequests).toHaveLength(1);

    await expect(page.getByTestId('workbench-loading')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(rows).toHaveCount(7);
    const taskIds = await rows.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.taskId ?? ''),
    );
    expect(taskIds).toHaveLength(7);
    expect(new Set(taskIds).size).toBe(7);

    expect(pageErrors, 'pageerror').toEqual([]);
  });
});
