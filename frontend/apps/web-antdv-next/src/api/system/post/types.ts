/**
 * 岗位域类型契约（SPEC-003 §4.5 / data-model §6）。
 */
import type { Id, PageQuery } from '#/api/system/common';

export interface AuditFields {
  createBy?: Id | null;
  createTime?: null | string;
  updateBy?: Id | null;
  updateTime?: null | string;
  /** 查询扩展参数；`null` 等价空对象（SPEC-003 §4.1） */
  params?: null | Record<string, unknown>;
}

export interface PostVO extends AuditFields {
  deptId: Id;
  deptName?: null | string;
  postCategory?: null | string;
  postCode: string;
  postId: Id;
  postName: string;
  postSort: number;
  remark?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
}

export interface PostForm {
  deptId: Id;
  postCategory?: null | string;
  postCode: string;
  postId?: Id;
  postName: string;
  postSort: number;
  remark?: null | string;
  status?: null | string;
}

export interface PostQuery extends PageQuery {
  belongDeptId?: Id;
  deptId?: Id;
  postCategory?: string;
  postCode?: string;
  postId?: Id;
  postName?: string;
  status?: string;
}
