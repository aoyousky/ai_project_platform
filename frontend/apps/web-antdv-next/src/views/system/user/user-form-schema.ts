/**
 * 用户新增/编辑表单 schema（SPEC-002 A-02 / A-03 / A-08）。
 *
 * 编辑自己时部门/岗位/角色禁用且提交前会被剔除（见 `user-page-logic.ts`）；
 * 新增才渲染密码字段。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type { TreeSelectOption } from '#/utils/system/tree';

import { z } from '#/adapter/form';

export interface SelectOption {
  label: string;
  value: string;
}

export interface UserFormSchemaContext {
  deptOptions: TreeSelectOption[];
  isEdit: boolean;
  postOptions: SelectOption[];
  roleOptions: SelectOption[];
  selfEditing: boolean;
}

/** RuoYi 密码规则：5–20 位，且不能包含尖括号、引号、反斜杠、竖线 */
export const PASSWORD_PATTERN = /^[^<>"'|\\]+$/;
/** 大陆手机号（E-04）：11 位，1 开头，第二位 3–9 */
export const PHONE_PATTERN = /^1[3-9]\d{9}$/;
export const PASSWORD_MIN_LENGTH = 5;
export const PASSWORD_MAX_LENGTH = 20;

export function buildUserFormSchema(
  context: UserFormSchemaContext,
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'TreeSelect',
      componentProps: {
        allowClear: true,
        disabled: context.selfEditing,
        treeData: context.deptOptions,
        placeholder: '请选择归属部门',
        showSearch: true,
        treeDefaultExpandAll: true,
      },
      fieldName: 'deptId',
      label: '归属部门',
    },
    {
      component: 'Input',
      componentProps: {
        disabled: context.isEdit,
        placeholder: '请输入用户名称',
      },
      fieldName: 'userName',
      label: '用户名称',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入用户昵称' },
      fieldName: 'nickName',
      label: '用户昵称',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入手机号码' },
      fieldName: 'phonenumber',
      label: '手机号码',
      rules: z
        .string()
        .regex(PHONE_PATTERN, '请输入正确的手机号码')
        .or(z.literal(''))
        .optional(),
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入邮箱' },
      fieldName: 'email',
      label: '邮箱',
      rules: z
        .string()
        .email('请输入正确的邮箱地址')
        .or(z.literal(''))
        .optional(),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '男', value: '0' },
          { label: '女', value: '1' },
          { label: '未知', value: '2' },
        ],
        placeholder: '请选择用户性别',
      },
      defaultValue: '2',
      fieldName: 'sex',
      label: '用户性别',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '正常', value: '0' },
          { label: '停用', value: '1' },
        ],
      },
      defaultValue: '0',
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: {
        disabled: context.selfEditing,
        mode: 'multiple',
        options: context.postOptions,
        placeholder: '请选择岗位',
      },
      fieldName: 'postIds',
      label: '岗位',
    },
    {
      component: 'Select',
      componentProps: {
        disabled: context.selfEditing,
        mode: 'multiple',
        options: context.roleOptions,
        placeholder: '请选择角色',
      },
      fieldName: 'roleIds',
      label: '角色',
    },
  ];

  if (!context.isEdit) {
    schema.push({
      component: 'InputPassword',
      componentProps: { placeholder: '请输入用户密码' },
      fieldName: 'password',
      label: '用户密码',
      rules: z
        .string()
        .min(PASSWORD_MIN_LENGTH, `用户密码长度必须介于 5 和 20 之间`)
        .max(PASSWORD_MAX_LENGTH, `用户密码长度必须介于 5 和 20 之间`)
        .regex(PASSWORD_PATTERN, '用户密码不能包含非法字符'),
    });
  }

  schema.push({
    component: 'Textarea',
    componentProps: { placeholder: '请输入内容', rows: 3 },
    fieldName: 'remark',
    label: '备注',
  });

  return schema;
}
