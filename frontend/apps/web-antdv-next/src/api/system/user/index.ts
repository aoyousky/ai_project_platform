import type {
  DeptTreeOption,
  ImportResult,
  ResetPwdForm,
  UserForm,
  UserImportParams,
  UserInfoVO,
  UserQuery,
  UserStatusForm,
  UserVO,
} from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
/**
 * 用户 API（SPEC-002 U-01 ~ U-13）。
 *
 * 后端契约见 `specs/002-system-management-core/contracts/backend-api-consumed.md`：
 * - 导出/模板是二进制，失败仍可能 HTTP 200 + JSON，统一走 `downloadBlob`；
 * - 删除与授权角色使用逗号分隔 ID；
 * - 重置密码带 `@ApiEncrypt`，必须携带 `isEncrypt` 头；
 * - 导入需要 `msg` 中的统计信息，因此取完整响应体而不是 `data`。
 */
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/** U-01 分页列表 */
export async function getUserListApi(
  query: UserQuery,
): Promise<PageResult<UserVO>> {
  return requestClient.get<PageResult<UserVO>>('/system/user/list', {
    params: query,
  });
}

/** U-02 导出（参数必须放 query） */
export async function exportUserApi(query: UserQuery): Promise<void> {
  return downloadBlob('/system/user/export', {
    fileName: '用户数据.xlsx',
    params: query,
  });
}

/** U-03 下载导入模板 */
export async function downloadUserImportTemplateApi(): Promise<void> {
  return downloadBlob('/system/user/importTemplate', {
    fileName: '用户导入模板.xlsx',
  });
}

/** U-04 导入（multipart，不手写 Content-Type） */
export async function importUserDataApi(
  params: UserImportParams,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', params.file);

  return requestClient.post<ImportResult>('/system/user/importData', formData, {
    params: { updateSupport: params.updateSupport },
    responseReturn: 'body',
  });
}

/**
 * U-05 详情 / 新增预处理。
 * 无 ID 时路径必须保留尾部 `/`（`GET /system/user/`），否则会命中集合 POST 路由。
 */
export async function getUserApi(userId?: Id | null): Promise<UserInfoVO> {
  if (userId === undefined || userId === null || userId === '') {
    return requestClient.get<UserInfoVO>('/system/user/');
  }
  return requestClient.get<UserInfoVO>(`/system/user/${userId}`);
}

/** U-06 新增 */
export async function addUserApi(data: UserForm): Promise<void> {
  return requestClient.post('/system/user', data);
}

/** U-07 修改 */
export async function updateUserApi(data: UserForm): Promise<void> {
  return requestClient.put('/system/user', data);
}

/** U-08 批量删除（逗号分隔） */
export async function deleteUserApi(userIds: Array<Id>): Promise<void> {
  return requestClient.delete(`/system/user/${normalizeIds(userIds).join(',')}`);
}

/** U-09 重置密码（`@ApiEncrypt`） */
export async function resetUserPwdApi(data: ResetPwdForm): Promise<void> {
  return requestClient.put('/system/user/resetPwd', data, {
    headers: { isEncrypt: 'true' },
  });
}

/** U-10 状态开关 */
export async function changeUserStatusApi(
  data: UserStatusForm,
): Promise<void> {
  return requestClient.put('/system/user/changeStatus', data);
}

/** U-11 分配角色回显 */
export async function getUserAuthRoleApi(userId: Id): Promise<UserInfoVO> {
  return requestClient.get<UserInfoVO>(`/system/user/authRole/${userId}`);
}

/** U-12 提交分配角色（query；提交空 roleIds 时后端为 no-op，见 E-21） */
export async function updateUserAuthRoleApi(
  userId: Id,
  roleIds: Id[],
): Promise<void> {
  return requestClient.put('/system/user/authRole', null, {
    params: { roleIds: normalizeIds(roleIds).join(','), userId },
  });
}

/** U-13 部门树（Hutool `label` 树，含 disabled 标记） */
export async function getUserDeptTreeApi(): Promise<DeptTreeOption[]> {
  return requestClient.get<DeptTreeOption[]>('/system/user/deptTree');
}
