import type { MenuForm, MenuVO } from '#/api/system/menu/types';

import { toIdKey } from '#/utils/system/id';
import { buildTree } from '#/utils/system/tree';

export interface MenuTypeFieldFlags {
  /** M/C 必填路由地址；F 不渲染 */
  pathRequired: boolean;
  /** 隐藏菜单才需要“激活路由” */
  showActiveRoute: boolean;
  showComponent: boolean;
  showPath: boolean;
  showPerms: boolean;
}

export interface MenuManageContext {
  /** superadmin 或租户管理员 */
  hasAdminRole: boolean;
  permissions: string[];
}

/** 后端菜单接口仅放行 superadmin 与租户管理员（`admin`）角色 */
export function hasMenuAdminRole(roles: string[] | undefined): boolean {
  const owned = roles ?? [];
  return owned.includes('superadmin') || owned.includes('admin');
}

export type MenuPermissionAction = 'add' | 'edit' | 'query' | 'remove';

/** flat 列表 → 树；父节点缺失时提升为根（SPEC-003 A-07、E-14） */
export function buildMenuTableData(flat: MenuVO[]) {
  return buildTree(flat, 'menuId', 'parentId');
}

/**
 * 收集节点及全部后代 ID（含自身）。
 * 后端 `/system/menu/cascade/{ids}` 不递归，只传父节点会被拒绝（E-12）。
 */
export function collectMenuSubtreeIds(
  rootId: number | string,
  flat: MenuVO[],
): string[] {
  const known = new Set(flat.map((item) => toIdKey(item.menuId)));
  const rootKey = toIdKey(rootId);
  if (!known.has(rootKey)) {
    return [];
  }

  const byParent = new Map<string, string[]>();
  for (const item of flat) {
    const parentKey = toIdKey(item.parentId);
    const list = byParent.get(parentKey) ?? [];
    list.push(toIdKey(item.menuId));
    byParent.set(parentKey, list);
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [rootKey];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    result.push(current);
    queue.push(...(byParent.get(current) ?? []));
  }

  return result;
}

/** 单删只提交自身；级联删除提交节点及全部后代 ID */
export function buildMenuDeleteIds(
  menu: Pick<MenuVO, 'menuId'>,
  flat: MenuVO[],
  mode: 'cascade' | 'single',
): string[] {
  const self = toIdKey(menu.menuId);
  if (mode === 'single') {
    return [self];
  }
  const ids = collectMenuSubtreeIds(menu.menuId, flat);
  return ids.length > 0 ? ids : [self];
}

/** 按 menuType / visible 切换表单字段（SPEC-003 A-14） */
export function getMenuTypeFieldFlags(
  menuType: string,
  visible: string,
): MenuTypeFieldFlags {
  const isButton = menuType === 'F';
  return {
    pathRequired: !isButton,
    showActiveRoute: !isButton && visible === '1',
    showComponent: !isButton,
    showPath: !isButton,
    showPerms: isButton,
  };
}

function permit(granted: string, required: string): boolean {
  const grantedParts = granted.split(':');
  const requiredParts = required.split(':');
  if (grantedParts.length !== requiredParts.length) {
    return false;
  }
  return requiredParts.every(
    (part, index) => grantedParts[index] === '*' || grantedParts[index] === part,
  );
}

/**
 * 菜单读写接口要求 superadmin / 租户管理员角色，仅有权限码返回 403（A-09、E-13）。
 * 因此入口必须同时满足管理员角色与权限码，二者缺一不可。
 */
export function canManageMenu(
  context: MenuManageContext,
  action: MenuPermissionAction,
): boolean {
  if (!context.hasAdminRole) {
    return false;
  }
  const required = `system:menu:${action}`;
  return context.permissions.some((granted) => permit(granted, required));
}

/** 隐藏菜单把 remark 当作激活路由，必须以 / 开头（§4.3） */
export function isValidActiveRoute(value: null | string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('/');
}

/**
 * 表单值 → 提交体。
 * - 隐藏菜单的 `activeRoute` 写入 `remark`；
 * - 按钮不提交路由相关字段（§4.7 只对 M/C 约束 path/component）。
 */
/** 隐藏菜单的激活路由写在 `remark`；按钮没有激活路由概念 */
function resolveRemark(values: {
  activeRoute?: null | string;
  menuType: MenuForm['menuType'];
  remark?: null | string;
  visible: string;
}): string {
  const hidden = values.visible === '1' && values.menuType !== 'F';
  return (hidden ? values.activeRoute : values.remark) ?? '';
}

/** 按钮只提交权限标识（§4.7 路由字段仅对 M/C 约束） */
function buttonFields(values: Record<string, any>): Partial<MenuForm> {
  return { perms: values.perms ?? '' };
}

/** 目录/菜单提交路由相关字段 */
function routeFields(values: Record<string, any>): Partial<MenuForm> {
  return {
    component: values.component ?? '',
    isCache: values.isCache ?? '0',
    isFrame: values.isFrame ?? '1',
    path: values.path ?? '',
    queryParam: values.queryParam ?? '',
  };
}

export function buildMenuSubmitPayload(
  values: Record<string, any>,
  menuId?: number | string,
): MenuForm {
  const {
    activeRoute,
    menuId: formMenuId,
    remark,
    ...rest
  } = values as Record<string, any>;

  const menuType = rest.menuType as MenuForm['menuType'];
  const visible = (rest.visible as string) ?? '0';
  const effectiveMenuId = menuId ?? formMenuId;

  const payload: MenuForm = {
    icon: rest.icon ?? '',
    menuName: rest.menuName,
    menuType,
    orderNum: rest.orderNum,
    parentId: rest.parentId ?? '0',
    remark: resolveRemark({ activeRoute, menuType, remark, visible }),
    status: rest.status ?? '0',
    visible,
  };

  if (effectiveMenuId !== undefined && effectiveMenuId !== null) {
    payload.menuId = effectiveMenuId;
  }

  Object.assign(payload, menuType === 'F' ? buttonFields(rest) : routeFields(rest));

  return payload;
}

/** 菜单详情 → 表单回显；隐藏菜单的 remark 拆到 activeRoute */
export function toMenuFormValues(menu: MenuVO): Record<string, any> {
  const hidden = menu.visible === '1' && menu.menuType !== 'F';
  return {
    activeRoute: hidden ? (menu.remark ?? '') : '',
    component: menu.component ?? '',
    icon: menu.icon ?? '',
    isCache: menu.isCache ?? '0',
    isFrame: menu.isFrame ?? '1',
    menuId: menu.menuId,
    menuName: menu.menuName,
    menuType: menu.menuType,
    orderNum: menu.orderNum,
    parentId: String(menu.parentId),
    path: menu.path ?? '',
    perms: menu.perms ?? '',
    queryParam: menu.queryParam ?? '',
    remark: hidden ? '' : (menu.remark ?? ''),
    status: menu.status,
    visible: menu.visible,
  };
}
