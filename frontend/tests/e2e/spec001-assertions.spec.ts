import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
} from './helpers';

/**
 * SPEC-001 A-03 ~ A-06 的 DOM 面（评测集 `specs/evals/REQ-20261101-001` 的 e2e 步骤）。
 *
 * A-03 的侧栏计数：Vben 的菜单在 DOM 里是**全量渲染、折叠只影响可见性**，
 * 因此不展开也能统计。前端还有常量菜单（概览/演示/项目等），故按“后端标题多重集
 * 是否全部出现在侧栏”来断言“侧栏渲染的后端节点数 = 后端非 hidden 节点数”，
 * 而不是比较 DOM 节点总数。
 *
 * A-05 使用专用夹具 `spec001_postonly`（scripts/evals/seed_spec001.sh）：
 * 有岗位列表/查询权限、没有新增权限，且没有任何菜单管理授权。
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';
const POSTONLY_USER = process.env.E2E_SPEC001_POSTONLY_USER ?? 'spec001_postonly';
const POSTONLY_PASSWORD =
  process.env.E2E_SPEC001_POSTONLY_PASSWORD ?? 'admin123';

interface RouterNode {
  children?: RouterNode[];
  hidden?: boolean;
  meta?: { title?: string };
  path?: string;
}

interface RoutersBody {
  code?: number;
  data?: RouterNode[];
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, clientid: CLIENT_ID };
}

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
  const body = (await (await loginResponse).json()) as {
    data?: { access_token?: string; accessToken?: string };
  };
  const token = body.data?.access_token ?? body.data?.accessToken;
  if (!token) {
    throw new Error(`登录未返回 access_token：${JSON.stringify(body)}`);
  }
  return token;
}

/** 后端路由 → 非 hidden 节点的标题列表（含目录与叶子） */
function visibleTitles(nodes: RouterNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (!node.hidden) {
      out.push(node.meta?.title ?? node.path ?? '');
    }
    if (node.children?.length) {
      visibleTitles(node.children, out);
    }
  }
  return out;
}

async function sidebarTitles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const groups = [
      ...document.querySelectorAll('.vben-sub-menu-content__title'),
    ].map((el) => (el.textContent ?? '').trim());
    const items = [...document.querySelectorAll('.vben-menu-item')].map((el) =>
      (el.textContent ?? '').trim(),
    );
    return [...groups, ...items];
  });
}

/** 多重集匹配：返回后端标题里能在侧栏找到的条数 */
function matchedCount(backend: string[], sidebar: string[]): number {
  const pool = new Map<string, number>();
  for (const title of sidebar) {
    pool.set(title, (pool.get(title) ?? 0) + 1);
  }
  let matched = 0;
  for (const title of backend) {
    const left = pool.get(title) ?? 0;
    if (left > 0) {
      matched += 1;
      pool.set(title, left - 1);
    }
  }
  return matched;
}

// describe 标题不要含 A-xx：Playwright 的 `-g` 匹配完整标题，
// 评测器按断言编号 grep 时会把同组全部用例都跑一遍（多花 3 次登录与验证码）。
test.describe('SPEC-001 菜单与岗位页断言', () => {
  test.beforeAll(async () => {
    test.skip(!(await isBackendUp()), '本地后端栈未启动');
  });

  test('A-03 侧栏渲染的后端菜单节点数等于后端非 hidden 节点数', async ({
    page,
  }) => {
    const token = await loginCapturingToken(page, 'admin', 'admin123');
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    const response = await page.request.get(
      `${BACKEND_URL}/system/menu/getRouters`,
      { headers: authHeaders(token) },
    );
    const body = (await response.json()) as RoutersBody;
    expect(body.code).toBe(200);

    const backend = visibleTitles(body.data ?? []);
    const sidebar = await sidebarTitles(page);
    expect(
      {
        backendCount: backend.length,
        matched: matchedCount(backend, sidebar),
        missing: backend.filter((title) => !sidebar.includes(title)),
      },
      JSON.stringify({ backend, sidebar }),
    ).toMatchObject({
      backendCount: backend.length,
      matched: backend.length,
    });
  });

  test('A-04 admin 在岗位页可见新增与删除（工具栏批量删除）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/post');

    await expect(
      page.getByRole('button', { name: '新增', exact: true }).first(),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(
      page.getByRole('button', { name: '删除', exact: true }).first(),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  });

  test('A-05 无新增权限的账号看不到新增按钮，未授权路由落 403/404', async ({
    page,
  }) => {
    await loginWithCaptcha(page, POSTONLY_USER, POSTONLY_PASSWORD);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/post');

    // 能打开岗位页（有 list/query 权限），但没有新增
    await expect(
      page.getByRole('button', { name: '新增', exact: true }),
    ).toHaveCount(0, { timeout: APP_ENTRY_TIMEOUT });

    // 未授权地址：路由未注册 → 兜底未找到页（Vben 的 404 页，文案“哎呀！未找到页面”），
    // 不渲染业务表格。A-05 的「落 403 或 404 页面」按此判定：URL 不含 403/404，
    // 但渲染的是 not-found 组件而非业务页。
    await gotoAppPath(page, '/system/menu');
    await expect(
      page.getByText(/(403|404|未找到页面)/).first(),
    ).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await expect(page.locator('.vxe-table')).toHaveCount(0);
  });

  test('A-06 岗位列表总数与渲染行数一致（pageSize=10）', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });

    const listResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/post/list') &&
        response.request().method() === 'GET'
      );
    });
    await gotoAppPath(page, '/system/post');
    await listResponse; // 首屏请求，等表格挂载

    // A-06 的口径是 pageSize=10；Vben 网格默认 20，必须在分页器里切到 10。
    const tenResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/system/post/list') &&
        response.request().method() === 'GET' &&
        url.searchParams.get('pageSize') === '10'
      );
    });
    // vxe 的分页器不是原生 select：点开自定义下拉后选「10条/页」。
    await page.locator('.vxe-pager--sizes').first().click();
    await page
      .locator('.vxe-select-option')
      .filter({ hasText: /^10条\/页$/ })
      .first()
      .click();
    const response = await tenResponse;
    const body = (await response.json()) as {
      code?: number;
      rows?: unknown[];
      total?: number;
    };
    expect(body.code).toBe(200);
    const total = Number(body.total ?? 0);

    await expect(
      page.locator('.vxe-table--main-wrapper .vxe-body--row'),
    ).toHaveCount(Math.min(total, 10), {
      timeout: APP_ENTRY_TIMEOUT,
    });
    await expect(page.getByText(new RegExp(`共\\s*${total}\\s*条`)).first())
      .toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
  });
});
