import type { DeptForm, DeptQuery, DeptVO } from './types';

import type { Id } from '#/api/system/common';

import { requestClient } from '#/api/request';

export type * from './types';

/**
 * 部门 API（SPEC-003 D-01 ~ D-06）。
 *
 * `/system/dept/list` 返回 flat list；编辑时上级部门候选必须使用
 * `/system/dept/list/exclude/{deptId}`，由后端排除自身及全部下级。
 */

/** D-01 部门列表（flat） */
export async function getDeptListApi(
  query: DeptQuery = {},
): Promise<DeptVO[]> {
  return requestClient.get<DeptVO[]>('/system/dept/list', { params: query });
}

/** D-02 排除自身及下级的部门列表（编辑上级部门用） */
export async function getDeptExcludeChildApi(deptId: Id): Promise<DeptVO[]> {
  return requestClient.get<DeptVO[]>(`/system/dept/list/exclude/${deptId}`);
}

/** D-03 详情 */
export async function getDeptApi(deptId: Id): Promise<DeptVO> {
  return requestClient.get<DeptVO>(`/system/dept/${deptId}`);
}

/** D-04 新增 */
export async function addDeptApi(data: DeptForm): Promise<void> {
  return requestClient.post('/system/dept', data);
}

/** D-05 修改 */
export async function updateDeptApi(data: DeptForm): Promise<void> {
  return requestClient.put('/system/dept', data);
}

/** D-06 删除（默认部门/有下级/有用户/有岗位时后端返回 code=601） */
export async function deleteDeptApi(deptId: Id): Promise<void> {
  return requestClient.delete(`/system/dept/${deptId}`);
}
