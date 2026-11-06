import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { APP_ENTRY_TIMEOUT, isBackendUp, loginWithCaptcha } from './helpers';

/**
 * SPEC-003 A-18：`getRouters` 只返回已授权菜单。
 *
 * CLAR-009 裁决（1A/2A/3A）：
 * - 接口为 `/system/menu/getRouters`（`/getRouters` 实测 404）；
 * - `visible='1'` 的语义是“**返回但 `hidden=true`**”，故断言隐藏菜单存在且标记隐藏，
 *   同时不渲染为侧边栏可见入口；
 * - 夹具不预置 `spec003_router` 绑定（否则 A-05 的 `allocatedList.total=0` 不成立），
 *   本用例自行「绑定 → 断言 → 解绑」。
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';
const ROLE_ID = process.env.E2E_SPEC003_ROLE_ID ?? '900003000000000006';
const ROUTER_USER_ID =
  process.env.E2E_SPEC003_ROUTER_USER_ID ?? '900003000000000022';
const DIR_MENU_ID = process.env.E2E_SPEC003_DIR_MENU_ID ?? '900003000000000014';
const SUB_MENU_ID = process.env.E2E_SPEC003_SUB_MENU_ID ?? '900003000000000015';
const HIDDEN_MENU_ID =
  process.env.E2E_SPEC003_HIDDEN_MENU_ID ?? '900003000000000017';
const ROUTER_USER = process.env.E2E_SPEC003_ROUTER_USER ?? 'spec003_router';
const ROUTER_PASSWORD =
  process.env.E2E_SPEC003_ROUTER_PASSWORD ?? 'admin123';

interface LoginBody {
  code?: number;
  data?: { access_token?: string; accessToken?: string };
}

interface RouterNode {
  children?: RouterNode[];
  hidden?: boolean;
  path?: string;
}

interface RoutersBody {
  code?: number;
  data?: RouterNode[];
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, clientid: CLIENT_ID };
}

/** 登录并在响应体里取令牌（生产构建的 Pinia 持久化不可直接解读） */
async function loginCapturingToken(
  page: Page,
  username: string,
  password: string,
): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/login') &&
      response.request().method() === 'POST',
  );
  await loginWithCaptcha(page, username, password);
  const response = await loginResponse;
  const body = (await response.json()) as LoginBody;
  const token = body.data?.access_token ?? body.data?.accessToken;
  if (!token) {
    throw new Error(`登录未返回 access_token：${JSON.stringify(body)}`);
  }
  return token;
}

/** 清空本地会话但不调用 /auth/logout，保留已取得的令牌可用 */
async function resetSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

/**
 * 重现 A-18 的 Given：角色已授予目录、子菜单与隐藏菜单。
 *
 * 不能只依赖夹具——`system-role.spec.ts`（A-03）保存角色时只保留目录+子菜单，
 * 会把隐藏菜单的授权覆盖掉；本用例不依赖执行顺序，自行补齐。
 */
async function grantRouterMenus(page: Page, token: string): Promise<void> {
  const response = await page.request.put(`${BACKEND_URL}/system/role`, {
    data: {
      menuCheckStrictly: false,
      menuIds: [DIR_MENU_ID, SUB_MENU_ID, HIDDEN_MENU_ID],
      roleId: ROLE_ID,
      roleKey: 'spec003_role',
      roleName: 'Spec003 角色',
      roleSort: 1,
      status: '0',
    },
    headers: authHeaders(token),
  });
  const body = await response.json();
  expect(body.code, JSON.stringify(body)).toBe(200);
}

/**
 * 清掉遗留绑定（幂等）。用例被强杀时 `finally` 不会执行，残留绑定会让
 * `selectAll` 插入重复主键而 500；平台 `cancelAuthUser` 走 `toAjax(rows)`，
 * 0 行时返回 code=500，故这里只校验 HTTP 状态，不看业务码。
 */
async function clearRouterBinding(page: Page, token: string): Promise<void> {
  const response = await page.request.put(
    `${BACKEND_URL}/system/role/authUser/cancel`,
    {
      data: { roleId: ROLE_ID, userId: ROUTER_USER_ID },
      headers: authHeaders(token),
    },
  );
  expect(response.status()).toBe(200);
}

async function bindRouterUser(page: Page, token: string): Promise<void> {
  const response = await page.request.put(
    `${BACKEND_URL}/system/role/authUser/selectAll?roleId=${ROLE_ID}&userIds=${ROUTER_USER_ID}`,
    { headers: authHeaders(token) },
  );
  const body = await response.json();
  expect(body.code, JSON.stringify(body)).toBe(200);
}

async function unbindRouterUser(page: Page, token: string): Promise<void> {
  const response = await page.request.put(
    `${BACKEND_URL}/system/role/authUser/cancel`,
    {
      data: { roleId: ROLE_ID, userId: ROUTER_USER_ID },
      headers: authHeaders(token),
    },
  );
  const body = await response.json();
  expect(body.code, JSON.stringify(body)).toBe(200);
}

test.describe('系统管理 - 路由', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('getRouters 只返回已授权菜单，隐藏菜单标记 hidden 且不进侧边栏（A-18）', async ({
    page,
  }) => {
    const adminToken = await loginCapturingToken(page, 'admin', 'admin123');
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    await grantRouterMenus(page, adminToken);
    await clearRouterBinding(page, adminToken);
    await bindRouterUser(page, adminToken);
    try {
      await resetSession(page);

      const routersResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname.endsWith('/system/menu/getRouters') &&
          response.request().method() === 'GET'
        );
      });
      await loginCapturingToken(page, ROUTER_USER, ROUTER_PASSWORD);
      await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

      const routers = await routersResponse;
      const body = (await routers.json()) as RoutersBody;
      expect(body.code).toBe(200);
      const routes = body.data ?? [];

      // 已授权的目录与子菜单
      const dir = routes.find((route) => route.path === '/spec003');
      expect(dir, JSON.stringify(routes)).toBeTruthy();
      expect(dir?.hidden).toBe(false);
      const children = dir?.children ?? [];
      const menuRoute = children.find((route) => route.path === 'menu');
      expect(menuRoute, JSON.stringify(children)).toBeTruthy();
      expect(menuRoute?.hidden).toBe(false);

      // visible='1'：返回但 hidden=true（CLAR-009 裁决 1A）
      const hiddenRoute = children.find(
        (route) => route.path === 'spec003-hidden',
      );
      expect(hiddenRoute, JSON.stringify(children)).toBeTruthy();
      expect(hiddenRoute?.hidden).toBe(true);

      // 未授权的系统管理菜单不出现
      expect(routes.some((route) => route.path === '/system')).toBe(false);

      // 侧边栏：已授权菜单可见，隐藏菜单不渲染
      const dirTitle = page.getByText('Spec003 目录', { exact: true }).first();
      await expect(dirTitle).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
      await dirTitle.click();
      await expect(
        page.getByText('Spec003 菜单', { exact: true }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Spec003 隐藏菜单')).toHaveCount(0);
      await expect(page.getByText('系统管理', { exact: true })).toHaveCount(0);
    } finally {
      // 收尾解绑，避免污染 A-05 与后续用例
      await unbindRouterUser(page, adminToken);
    }
  });
});
