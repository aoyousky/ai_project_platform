/**
 * 用户页可测逻辑（SPEC-002 A-03 / A-05 / A-08 / A-09 / A-14）。
 *
 * 页面与弹窗只做装配，保护判定、表单转换、状态回滚与导入文案在这里实现，
 * 便于在没有 UI 运行时的环境下做组件级验证。
 */
import type { Id } from '#/api/system/common';
import type {
  DeptTreeOption,
  ImportResult,
  UserForm,
  UserInfoVO,
  UserVO,
} from '#/api/system/user/types';
import type { TreeNode, TreeSelectOption } from '#/utils/system/tree';

import { sameId } from '#/utils/system/id';
import { filterDisabledTree, toTreeSelectOptions } from '#/utils/system/tree';

// 跨页面复用：状态回滚与分页越界回退（SPEC-003 复用，不改变用户页行为）
export { resolveOutOfRangePage } from '#/utils/system/pagination';
export { runStatusToggle } from '#/utils/system/status';

/** 后端内置超级管理员，前端不得渲染改/删/重置密码/分配角色入口 */
export const SUPER_ADMIN_USER_ID = 1;

/** A-05：受保护用户的操作入口是否可用 */
export function canModifyUser(userId?: Id | null): boolean {
  return !sameId(userId, SUPER_ADMIN_USER_ID);
}

/** A-08：左侧部门树点击 → 查询条件；再次点击已选节点表示清除 */
export function withDeptFilter<T extends Record<string, any>>(
  query: T,
  deptId?: Id | null,
): T & { deptId?: Id } {
  const next: Record<string, any> = { ...query };
  if (deptId === null || deptId === undefined || deptId === '') {
    delete next.deptId;
  } else {
    next.deptId = deptId;
  }
  return next as T & { deptId?: Id };
}

function toTreeNodes(nodes: DeptTreeOption[]): Array<TreeNode<DeptTreeOption>> {
  return nodes.map((node) => ({
    ...node,
    children: toTreeNodes(node.children ?? []),
  }));
}

/** A-08：部门树 → TreeSelect 选项，停用部门整枝移除 */
export function buildDeptSelectOptions(
  nodes: DeptTreeOption[],
): TreeSelectOption[] {
  return toTreeSelectOptions(filterDisabledTree(toTreeNodes(nodes)), {
    labelKey: 'label',
    valueKey: 'id',
  });
}

export interface UserFormState {
  selfEditing: boolean;
  values: Partial<UserForm>;
}

/** 新增用户时的初始值 */
export function defaultUserFormValues(): Partial<UserForm> {
  return {
    deptId: null,
    email: '',
    nickName: '',
    phonenumber: '',
    postIds: [],
    remark: '',
    roleIds: [],
    sex: '2',
    status: '0',
    userName: '',
  };
}

/**
 * 详情响应 → 表单初始值。
 * 编辑自己时 `selfEditing = true`，提交前必须剔除部门/角色/岗位（A-03）。
 */
export function toUserFormState(
  info: UserInfoVO,
  currentUserId?: Id | null,
): UserFormState {
  const user: Partial<UserVO> = info.user ?? {};
  return {
    selfEditing: sameId(user.userId, currentUserId),
    values: {
      deptId: user.deptId ?? null,
      email: user.email ?? '',
      nickName: user.nickName,
      phonenumber: user.phonenumber ?? '',
      postIds: info.postIds ?? [],
      remark: user.remark ?? '',
      roleIds: info.roleIds ?? [],
      sex: user.sex ?? '2',
      status: user.status ?? '0',
      userId: user.userId,
      userName: user.userName,
    },
  };
}

/**
 * 表单值 → 提交体。
 * - 编辑自己：不提交 `deptId` / `roleIds` / `postIds`（后端禁止越权自改）；
 * - 编辑态：不提交 `password`；
 * - 其余字段原样提交。
 */
export function toUserSubmitPayload(
  values: Partial<UserForm>,
  options: { isEdit: boolean; selfEditing: boolean; userId?: Id },
): Partial<UserForm> {
  const payload: Partial<UserForm> = { ...values };

  if (options.selfEditing) {
    delete payload.deptId;
    delete payload.postIds;
    delete payload.roleIds;
  }

  if (options.isEdit) {
    delete payload.password;
    // userId 不在表单 schema 中，必须从打开弹窗时的上下文补回；
    // 缺失时后端按 userName 判重，会把正常编辑误判为重复账号。
    if (options.userId !== undefined) {
      payload.userId = options.userId;
    }
  }

  return payload;
}

/**
 * A-14：导入结果文案。后端在 `msg` 中返回成功/失败统计与失败原因。
 * 以纯文本返回，禁止拼接 HTML（避免导入内容造成注入）。
 */
export function importResultText(result: ImportResult): string {
  return result.msg;
}
