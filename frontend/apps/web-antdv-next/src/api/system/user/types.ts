/**
 * 用户域类型契约（SPEC-002 §4 / data-model §1–§2）。
 * 字段名与可空性以后端 `SysUserVo` / `SysUserInfoVo` 序列化结果为准。
 */
import type {
  DateRangeParams,
  Id,
  PageQuery,
} from '#/api/system/common';

/** 五域共同返回的审计字段 */
export interface AuditFields {
  createTime?: null | string;
}

/** 角色（UserVO.roles 与授权页只读取这些字段，完整契约见 role/types.ts） */
export interface UserRoleOption {
  flag?: boolean;
  roleId: Id;
  roleKey: string;
  roleName: string;
  roleSort?: number;
  status?: string;
}

/** 岗位（用户表单的岗位选项） */
export interface UserPostOption {
  deptId?: Id;
  postId: Id;
  postName: string;
  postSort?: number;
  status?: string;
}

export interface UserVO extends AuditFields {
  avatar?: null | string;
  deptId?: Id | null;
  deptName?: null | string;
  /** 敏感字段：无 `system:user:edit` 时后端返回掩码 */
  email?: null | string;
  loginDate?: null | string;
  loginIp?: null | string;
  nickName: string;
  /** 敏感字段：无 `system:user:edit` 时后端返回掩码 */
  phonenumber?: null | string;
  postIds?: Id[] | null;
  remark?: null | string;
  roleId?: Id | null;
  roleIds?: Id[] | null;
  roles?: null | UserRoleOption[];
  /** '0' 男 / '1' 女 / '2' 未知 */
  sex?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
  tenantId?: null | string;
  userId: Id;
  userName: string;
  userType?: null | string;
}

/** 详情 / 授权回显 / 新增预处理共用的结构 */
export interface UserInfoVO {
  postIds?: Id[];
  posts?: UserPostOption[];
  roleIds?: Id[];
  roles?: UserRoleOption[];
  /** 无 ID 的新增预处理返回 null */
  user?: null | UserVO;
}

export interface UserForm {
  deptId?: Id | null;
  email?: null | string;
  nickName: string;
  /** 仅新增时提交 */
  password?: null | string;
  phonenumber?: null | string;
  postIds?: Id[] | null;
  remark?: null | string;
  roleIds?: Id[] | null;
  /** '0' 男 / '1' 女 / '2' 未知 */
  sex?: null | string;
  status?: null | string;
  userId?: Id;
  userName: string;
}

export interface UserQuery extends PageQuery {
  deptId?: Id;
  nickName?: string;
  params?: DateRangeParams;
  phonenumber?: string;
  /** 角色授权页的已授权/未授权列表 */
  roleId?: Id;
  status?: string;
  userId?: Id;
  userName?: string;
}

export interface ResetPwdForm {
  password: string;
  userId: Id;
}

export interface UserImportParams {
  file: File;
  updateSupport: boolean;
}

export interface UserStatusForm {
  status: string;
  userId: Id;
}

/** Hutool 部门树节点（`/system/user/deptTree`） */
export interface DeptTreeOption {
  children?: DeptTreeOption[];
  /** 后端按 status='1' 计算，表单选择时需过滤 */
  disabled?: boolean;
  id: Id;
  label: string;
  parentId: Id;
  weight?: number;
}

/** `POST /system/user/importData` 的响应体（需要 msg 里的导入统计） */
export interface ImportResult {
  code: number;
  data?: any;
  msg: string;
}

export type { DateRangeParams, Id };
