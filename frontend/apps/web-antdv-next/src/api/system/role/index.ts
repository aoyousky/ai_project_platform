import type {
  AuthUserCancel,
  AuthUserQuery,
  RoleDataScopeForm,
  RoleDeptTree,
  RoleForm,
  RoleMenuTree,
  RoleQuery,
  RoleStatusForm,
  RoleVO,
} from './types';

import type { Id, PageResult } from '#/api/system/common';
import type { UserVO } from '#/api/system/user/types';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 角色 API（SPEC-003 R-01 ~ R-14）。
 *
 * - 导出是二进制，失败仍可能 HTTP 200 + JSON，统一走 `downloadBlob`；
 * - 删除与批量授权使用逗号分隔 ID；
 * - 单个取消授权用 JSON body，批量用 query（后端契约 R-11/R-12/R-13）。
 */

/** R-01 分页列表 */
export async function getRoleListApi(
  query: RoleQuery,
): Promise<PageResult<RoleVO>> {
  return requestClient.get<PageResult<RoleVO>>('/system/role/list', {
    params: query,
  });
}

/** R-02 导出（参数必须放 query） */
export async function exportRoleApi(query: RoleQuery): Promise<void> {
  return downloadBlob('/system/role/export', {
    fileName: '角色数据.xlsx',
    params: query,
  });
}

/** R-03 详情 */
export async function getRoleApi(roleId: Id): Promise<RoleVO> {
  return requestClient.get<RoleVO>(`/system/role/${roleId}`);
}

/** R-04 新增 */
export async function addRoleApi(data: RoleForm): Promise<void> {
  return requestClient.post('/system/role', data);
}

/** R-05 修改（含菜单权限） */
export async function updateRoleApi(data: RoleForm): Promise<void> {
  return requestClient.put('/system/role', data);
}

/** R-06 数据权限 */
export async function updateRoleDataScopeApi(
  data: RoleDataScopeForm,
): Promise<void> {
  return requestClient.put('/system/role/dataScope', data);
}

/** R-07 状态开关 */
export async function changeRoleStatusApi(
  data: RoleStatusForm,
): Promise<void> {
  return requestClient.put('/system/role/changeStatus', data);
}

/** R-08 批量删除（逗号分隔） */
export async function deleteRoleApi(roleIds: Array<Id>): Promise<void> {
  return requestClient.delete(`/system/role/${normalizeIds(roleIds).join(',')}`);
}

/** R-09 已授权用户列表 */
export async function getAllocatedUserListApi(
  query: AuthUserQuery,
): Promise<PageResult<UserVO>> {
  return requestClient.get<PageResult<UserVO>>(
    '/system/role/authUser/allocatedList',
    { params: query },
  );
}

/** R-10 未授权用户列表 */
export async function getUnallocatedUserListApi(
  query: AuthUserQuery,
): Promise<PageResult<UserVO>> {
  return requestClient.get<PageResult<UserVO>>(
    '/system/role/authUser/unallocatedList',
    { params: query },
  );
}

/** R-11 单个取消授权（JSON body） */
export async function cancelAuthUserApi(data: AuthUserCancel): Promise<void> {
  return requestClient.put('/system/role/authUser/cancel', data);
}

/** R-12 批量取消授权（query + 逗号分隔 ID） */
export async function cancelAuthUserAllApi(
  roleId: Id,
  userIds: Array<Id>,
): Promise<void> {
  return requestClient.put('/system/role/authUser/cancelAll', null, {
    params: { roleId, userIds: normalizeIds(userIds).join(',') },
  });
}

/** R-13 批量选择用户授权（query + 逗号分隔 ID） */
export async function selectAuthUserAllApi(
  roleId: Id,
  userIds: Array<Id>,
): Promise<void> {
  return requestClient.put('/system/role/authUser/selectAll', null, {
    params: { roleId, userIds: normalizeIds(userIds).join(',') },
  });
}

/** R-14 角色菜单树（含 checkedKeys） */
export async function getRoleMenuTreeApi(roleId: Id): Promise<RoleMenuTree> {
  return requestClient.get<RoleMenuTree>(
    `/system/menu/roleMenuTreeselect/${roleId}`,
  );
}

/** R-14 角色部门树（数据权限，含 checkedKeys） */
export async function getRoleDeptTreeApi(roleId: Id): Promise<RoleDeptTree> {
  return requestClient.get<RoleDeptTree>(`/system/role/deptTree/${roleId}`);
}
