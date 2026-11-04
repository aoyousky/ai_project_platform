import type { PostForm, PostQuery, PostVO } from './types';

import type { Id, PageResult } from '#/api/system/common';
import type { DeptTreeOption } from '#/api/system/dept/types';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 岗位 API（SPEC-003 P-01 ~ P-07）。
 *
 * 岗位没有独立的状态端点，启停通过 `PUT /system/post` 提交 `status` 完成；
 * 被用户引用时后端拒绝删除与停用。
 */

/** P-01 分页列表 */
export async function getPostListApi(
  query: PostQuery,
): Promise<PageResult<PostVO>> {
  return requestClient.get<PageResult<PostVO>>('/system/post/list', {
    params: query,
  });
}

/** P-02 导出（参数必须放 query） */
export async function exportPostApi(query: PostQuery): Promise<void> {
  return downloadBlob('/system/post/export', {
    fileName: '岗位数据.xlsx',
    params: query,
  });
}

/** P-03 详情 */
export async function getPostApi(postId: Id): Promise<PostVO> {
  return requestClient.get<PostVO>(`/system/post/${postId}`);
}

/** P-04 新增 */
export async function addPostApi(data: PostForm): Promise<void> {
  return requestClient.post('/system/post', data);
}

/** P-05 修改（含启停） */
export async function updatePostApi(data: PostForm): Promise<void> {
  return requestClient.put('/system/post', data);
}

/** P-06 批量删除（逗号分隔） */
export async function deletePostApi(postIds: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/system/post/${normalizeIds(postIds).join(',')}`,
  );
}

/** P-07 岗位所属部门树 */
export async function getPostDeptTreeApi(): Promise<DeptTreeOption[]> {
  return requestClient.get<DeptTreeOption[]>('/system/post/deptTree');
}
