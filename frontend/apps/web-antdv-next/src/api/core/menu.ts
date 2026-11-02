import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * RuoYi-Vue-Plus `RouterVo`（后端 `/system/menu/getRouters` 返回项）。
 * 字段语义见 specs/001-vben-frontend-replacement/contracts/backend-api-consumed.md。
 */
export interface RuoYiRouter {
  children?: RuoYiRouter[];
  component?: string;
  hidden?: boolean;
  meta?: {
    icon?: string;
    link?: string;
    noCache?: boolean;
    title?: string;
  };
  name?: string;
  path: string;
  query?: string;
  redirect?: string;
}

/** Vben 侧的路由 meta，运行期字段比 RouteMeta 更宽松 */
type RouteMetaRecord = Record<string, any>;

function isExternalPath(path?: string): boolean {
  return !!path && /^https?:\/\//i.test(path);
}

/**
 * 为外链合成一个内部路由路径（ADR-002 C2）。
 *
 * Vue Router 要求 path 以 `/` 开头，外链 URL 直接进路由表会让 `addRoute` 抛错、
 * 整张动态路由表加载失败。这里改成 `/iframe/<slug>-<hash>`：确定、稳定、无中文与协议字符，
 * 真实 URL 只存 `meta.iframeSrc`，由 `IFrameView` 渲染 iframe。
 */
export function externalPathToRoute(url: string): string {
  const slug =
    url
      .replace(/^https?:\/\//i, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'link';
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return `/iframe/${slug}-${hash.toString(36)}`;
}

/**
 * RuoYi RouterVo → Vben RouteRecordStringComponent
 *
 * 关键差异（SPEC E-04 ~ E-07、Golden Sample 2）：
 * - `redirect: "noRedirect"` 是 RuoYi 的占位值，必须丢弃，否则 Vue Router 会跳到字面量路径；
 * - `hidden: true` → `meta.hideInMenu`；
 * - `meta.noCache` → `meta.keepAlive`（语义相反，缺省即可缓存）；
 * - `icon: "#"` 是隐藏路由的占位图标，丢弃；
 * - 内链 `path` 原样保留，不做父子拼接（子路由相对路径由 Vue Router 自行解析）；
 * - `Layout` / `ParentView` 等组件名原样保留，落地到真实组件由 `layoutMap` 完成；
 * - 外链 `path` 合成为 `/iframe/<slug>-<hash>` + `component: 'IFrameView'`，**不写 `meta.link`**
 *   （Vben 的 useNavigation 见到 `link` 就新窗口打开，内嵌会失效）。
 */
export function convertRuoYiMenus(
  routers: RuoYiRouter[],
): RouteRecordStringComponent[] {
  return routers.map((route) => {
    // 外链：叶子节点，RuoYi 外链菜单不会有子级
    if (isExternalPath(route.path)) {
      const url = route.meta?.link ?? route.path;
      const externalMeta: RouteMetaRecord = {
        hideInMenu: route.hidden === true,
        iframeSrc: url,
        keepAlive: false,
        title: route.meta?.title ?? '',
      };
      if (route.meta?.icon && route.meta.icon !== '#') {
        externalMeta['icon'] = route.meta.icon;
      }
      return {
        component: 'IFrameView',
        meta: externalMeta,
        name: route.name,
        path: externalPathToRoute(url),
      } as RouteRecordStringComponent;
    }

    const meta: RouteMetaRecord = {
      hideInMenu: route.hidden === true,
      keepAlive: route.meta?.noCache !== true,
      title: route.meta?.title ?? '',
    };

    if (route.meta?.icon && route.meta.icon !== '#') {
      meta['icon'] = route.meta.icon;
    }

    if (route.component === 'InnerLink' && route.meta?.link) {
      // RuoYi 内链：path 是内部路径、meta.link 是真实地址。
      // 与 plus-ui 一致用 iframe 内嵌，因此同样要把 link 换成 iframeSrc 并丢弃 link。
      meta['iframeSrc'] = route.meta.link;
      meta['keepAlive'] = false;
    } else if (route.meta?.link) {
      meta['link'] = route.meta.link;
    }

    const result = {
      component: route.component ?? '',
      meta,
      name: route.name,
      path: route.path,
    } as RouteRecordStringComponent;

    if (route.redirect && route.redirect !== 'noRedirect') {
      result.redirect = route.redirect;
    }
    if (route.children?.length) {
      result.children = convertRuoYiMenus(route.children);
    }

    return result;
  });
}

/**
 * 获取当前用户的所有菜单（后端动态路由模式）。
 */
export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const routers = await requestClient.get<RuoYiRouter[]>(
    '/system/menu/getRouters',
  );
  return convertRuoYiMenus(routers);
}
