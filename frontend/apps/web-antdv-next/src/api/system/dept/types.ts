/**
 * 部门域类型契约（SPEC-003 §4.4 / data-model §5）。
 * `/system/dept/list` 返回 flat list，树由前端构建。
 */
import type { DateRangeParams, Id } from '#/api/system/common';

export interface AuditFields {
  createBy?: Id | null;
  createTime?: null | string;
  updateBy?: Id | null;
  updateTime?: null | string;
  /** 查询扩展参数；`null` 等价空对象（SPEC-003 §4.1） */
  params?: null | Record<string, unknown>;
}

export interface DeptVO extends AuditFields {
  /** 祖级列表，如 "0,100,101" */
  ancestors?: null | string;
  children?: DeptVO[];
  deptCategory?: null | string;
  deptId: Id;
  deptName: string;
  email?: null | string;
  leader?: Id | null;
  leaderName?: null | string;
  orderNum: number;
  parentId: Id;
  parentName?: null | string;
  phone?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
}

export interface DeptForm {
  deptCategory?: null | string;
  deptId?: Id;
  deptName: string;
  email?: null | string;
  leader?: Id | null;
  orderNum: number;
  parentId?: Id;
  phone?: null | string;
  status?: null | string;
}

export interface DeptQuery {
  belongDeptId?: Id;
  deptCategory?: string;
  deptId?: Id;
  deptName?: string;
  parentId?: Id;
  params?: DateRangeParams;
  status?: string;
}

/** Hutool 部门树节点（`/system/user/deptTree`、`/system/post/deptTree`、`/system/role/deptTree/{id}`） */
export interface DeptTreeOption {
  children?: DeptTreeOption[];
  /** 后端按 status='1' 计算 */
  disabled?: boolean;
  id: Id;
  label: string;
  parentId: Id;
  weight?: number;
}

export interface RoleDeptTree {
  checkedKeys: Id[];
  depts: DeptTreeOption[];
}
