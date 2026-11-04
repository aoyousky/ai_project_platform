import type {
  MenuForm,
  MenuQuery,
  MenuTreeOption,
  MenuVO,
} from './types';

import type { Id } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 菜单 API（SPEC-003 M-01 ~ M-08）。
 *
 * 后端事实（不得违背）：
 * - 全部读写接口要求 superadmin 或租户管理员角色，仅有权限码返回 403；
 * - `/system/menu/list` 返回 flat list，树由前端构建；
 * - 单删有子菜单或已分配给角色返回 `code=601`；
 * - 级联删除端点不递归，必须由前端收集节点及全部后代 ID 后一次提交。
 */

/** M-01 菜单列表（flat） */
export async function getMenuListApi(query: MenuQuery = {}): Promise<MenuVO[]> {
  return requestClient.get<MenuVO[]>('/system/menu/list', { params: query });
}

/** M-02 详情 */
export async function getMenuApi(menuId: Id): Promise<MenuVO> {
  return requestClient.get<MenuVO>(`/system/menu/${menuId}`);
}

/** M-03 完整菜单树（用于上级菜单与角色授权） */
export async function getMenuTreeSelectApi(
  query: MenuQuery = {},
): Promise<MenuTreeOption[]> {
  return requestClient.get<MenuTreeOption[]>('/system/menu/treeselect', {
    params: query,
  });
}

/** M-05 新增 */
export async function addMenuApi(data: MenuForm): Promise<void> {
  return requestClient.post('/system/menu', data);
}

/** M-06 修改 */
export async function updateMenuApi(data: MenuForm): Promise<void> {
  return requestClient.put('/system/menu', data);
}

/** M-07 单个删除（有子菜单/已分配时后端返回 code=601） */
export async function deleteMenuApi(menuId: Id): Promise<void> {
  return requestClient.delete(`/system/menu/${menuId}`);
}

/**
 * M-08 级联删除。
 * 调用方必须先展开节点及全部后代 ID；只传父节点会被后端拒绝（code=601）。
 */
export async function cascadeDeleteMenuApi(menuIds: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/system/menu/cascade/${normalizeIds(menuIds).join(',')}`,
  );
}
