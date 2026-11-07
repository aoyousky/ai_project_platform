/**
 * SPEC-001 E-09：后端菜单指向尚未移植的组件时，统一落到占位页（coming-soon）。
 *
 * `@vben/access` 的 `generateRoutesByBackend` 在 `pageMap` 命中不到组件时回落
 * not-found（404）。E-09 要求「显示统一占位页；侧栏其余菜单可用」，且 SC-002
 * 要求菜单可达率 100%，因此必须在进入 `generateAccessible` 之前把未移植的
 * 组件名替换为 `ComingSoon`（在 `layoutMap` 中注册为占位页组件）。
 */

export interface MenuRouteNode {
  children?: MenuRouteNode[];
  component?: string;
  [key: string]: unknown;
}

/** 这些组件名由 layoutMap 提供，不参与视图存在性判断。 */
const NON_PAGE_COMPONENTS = new Set([
  'ComingSoon',
  'IFrameView',
  'InnerLink',
  'Layout',
  'ParentView',
]);

/**
 * 把视图路径归一化成与 `generate-routes-backend` 相同的 pageMap 键：
 * 去掉 `./` / `../` 前缀、补前导 `/`、去掉 `/views` 前缀、补 `.vue`。
 * 例如 `system/user/index` 与 `../views/system/user/index.vue`
 * 都归一化为 `/system/user/index.vue`。
 */
export function normalizeViewComponent(component: string): string {
  const normalized = component.replace(/^(\.\/|\.\.\/)+/, '');
  const withSlash = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`;
  const viewPath = withSlash.replace(/^\/views/, '');
  return viewPath.endsWith('.vue') ? viewPath : `${viewPath}.vue`;
}

/**
 * 返回新的路由树：组件在本前端不存在的页面改为 `ComingSoon`。
 * 不修改入参，保证 `getAllMenusApi()` 的返回值不被污染。
 */
export function markUnportedMenus<T extends MenuRouteNode>(
  routes: T[],
  knownViews: Set<string>,
): T[] {
  return routes.map((route) => {
    const children = Array.isArray(route.children)
      ? markUnportedMenus(route.children, knownViews)
      : route.children;
    let component = route.component;
    if (
      component &&
      !NON_PAGE_COMPONENTS.has(component) &&
      !knownViews.has(normalizeViewComponent(component))
    ) {
      component = 'ComingSoon';
    }
    return {
      ...route,
      ...(children === route.children ? {} : { children }),
      ...(component === route.component ? {} : { component }),
    } as T;
  });
}
