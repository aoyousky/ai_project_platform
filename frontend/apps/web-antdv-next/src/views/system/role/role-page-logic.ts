/**
 * 角色页与授权用户页可测逻辑（SPEC-003 A-03 / A-04 / A-06 / A-08）。
 */
import type { Id } from '#/api/system/common';
import type { MenuVO } from '#/api/system/menu/types';
import type { RoleForm, RoleVO } from '#/api/system/role/types';

import { sameId, toIdKey } from '#/utils/system/id';

/** 后端内置超级管理员角色，前端不得渲染改/删/停用/授权入口 */
export const SUPER_ADMIN_ROLE_ID = 1;

/** A-06：受保护角色的操作入口是否可用 */
export function canModifyRole(roleId?: Id | null): boolean {
  return !sameId(roleId, SUPER_ADMIN_ROLE_ID);
}

/** 数据权限选项（顺序与 plus-ui 一致） */
export const DATA_SCOPE_OPTIONS = [
  { label: '全部数据权限', value: '1' },
  { label: '自定义数据权限', value: '2' },
  { label: '本部门数据权限', value: '3' },
  { label: '本部门及以下数据权限', value: '4' },
  { label: '仅本人数据权限', value: '5' },
  { label: '部门及以下或本人数据权限', value: '6' },
] as const;

/** A-04：仅自定义数据权限需要维护部门树 */
export function isCustomDataScope(scope?: null | string): boolean {
  return scope === '2';
}

/**
 * A-08：收集菜单节点及全部后代 ID（级联删除必须先展开）。
 *
 * 后端 `/system/menu/cascade/{ids}` 不递归；只提交父节点会被拒绝。
 * 采用 BFS 保留同层顺序，返回字符串 ID，不修改入参。
 */
export function collectDescendantMenuIds(
  menuId: Id,
  flatMenus: MenuVO[],
): string[] {
  const rootKey = toIdKey(menuId);
  if (!rootKey) {
    return [];
  }

  const children = new Map<string, string[]>();
  for (const item of flatMenus) {
    const parentKey = toIdKey(item.parentId);
    const key = toIdKey(item.menuId);
    if (!parentKey || !key) {
      continue;
    }
    const list = children.get(parentKey) ?? [];
    list.push(key);
    children.set(parentKey, list);
  }

  const known = new Set(flatMenus.map((item) => toIdKey(item.menuId)));
  if (!known.has(rootKey)) {
    return [];
  }

  const result: string[] = [];
  const queue = [rootKey];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
    queue.push(...(children.get(key) ?? []));
  }
  return result;
}

/** Ant Tree 勾选值 → 后端 ID 数组（统一字符串、剔除空值） */
export function normalizeCheckedKeys(
  keys?: Array<Id | null | undefined>,
): string[] {
  return (keys ?? [])
    .map((key) => toIdKey(key))
    .filter((key) => key !== '');
}

/**
 * 表单值 → 角色保存请求体（R-04/R-05）。
 * - `menuIds` 始终为数组：未勾选时提交 `[]`，表示清空菜单权限（E-09）；
 * - 编辑时补回 `roleId`；
 * - 数据权限走独立端点，不混入本请求体。
 */
export function buildRoleSubmitPayload(
  values: Partial<RoleForm>,
  roleId?: Id,
): RoleForm {
  const payload: RoleForm = {
    menuCheckStrictly: values.menuCheckStrictly ?? false,
    menuIds: normalizeCheckedKeys(values.menuIds),
    roleKey: values.roleKey ?? '',
    roleName: values.roleName ?? '',
    roleSort: values.roleSort ?? 0,
    status: values.status ?? '0',
    ...(values.remark === undefined || values.remark === null
      ? {}
      : { remark: values.remark }),
    ...(roleId === undefined ? {} : { roleId }),
  };
  return payload;
}

/** 角色详情 + 已勾选菜单 → 表单初始值 */
export function toRoleFormValues(
  role: RoleVO,
  checkedKeys?: Array<Id | null | undefined>,
): Partial<RoleForm> {
  return {
    menuCheckStrictly: role.menuCheckStrictly ?? false,
    menuIds: normalizeCheckedKeys(checkedKeys),
    remark: role.remark ?? '',
    roleId: role.roleId,
    roleKey: role.roleKey,
    roleName: role.roleName,
    roleSort: role.roleSort,
    status: role.status ?? '0',
  };
}
