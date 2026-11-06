/**
 * 角色域类型契约（SPEC-003 §4.2 / data-model §3）。
 * 字段名与可空性以后端 `SysRoleVo` / `SysRoleBo` 序列化结果为准。
 */
import type { DateRangeParams, Id, PageQuery } from '#/api/system/common';
import type { DeptTreeOption } from '#/api/system/dept/types';
import type { MenuTreeOption } from '#/api/system/menu/types';

/** 五域共同返回的审计字段 */
export interface AuditFields {
  createBy?: Id | null;
  createTime?: null | string;
  updateBy?: Id | null;
  updateTime?: null | string;
  /** 查询扩展参数；`null` 等价空对象（SPEC-003 §4.1） */
  params?: null | Record<string, unknown>;
}

export interface RoleVO extends AuditFields {
  /** '1' 全部 / '2' 自定义 / '3' 本部门 / '4' 本部门及以下 / '5' 仅本人 / '6' 部门及以下或本人 */
  dataScope?: null | string;
  deptCheckStrictly?: boolean | null;
  /** 授权用户接口：true 表示当前用户已拥有该角色 */
  flag?: boolean;
  menuCheckStrictly?: boolean | null;
  remark?: null | string;
  roleId: Id;
  roleKey: string;
  roleName: string;
  roleSort: number;
  /** '0' 正常 / '1' 停用 */
  status: string;
  /** 后端 isSuperAdmin() 派生字段 */
  superAdmin?: boolean;
}

export interface RoleForm {
  dataScope?: null | string;
  deptCheckStrictly?: boolean;
  deptIds?: Id[];
  menuCheckStrictly?: boolean;
  menuIds?: Id[];
  remark?: null | string;
  roleId?: Id;
  roleKey: string;
  roleName: string;
  roleSort: number;
  status?: null | string;
}

export interface RoleQuery extends PageQuery {
  params?: DateRangeParams;
  roleId?: Id;
  roleKey?: string;
  roleName?: string;
  status?: string;
}

export interface RoleStatusForm {
  roleId: Id;
  status: string;
}

export interface RoleDataScopeForm {
  dataScope: string;
  deptCheckStrictly?: boolean;
  deptIds: Id[];
  roleId: Id;
}

export interface AuthUserQuery extends PageQuery {
  phonenumber?: string;
  roleId: Id;
  userName?: string;
}

export interface AuthUserCancel {
  roleId: Id;
  userId: Id;
}

export interface RoleMenuTree {
  checkedKeys: Id[];
  menus: MenuTreeOption[];
}

export interface RoleDeptTree {
  checkedKeys: Id[];
  depts: DeptTreeOption[];
}
