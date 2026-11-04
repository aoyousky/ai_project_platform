/**
 * 部门新增/编辑表单 schema（SPEC-003 A-10 / A-11）。
 * 上级部门候选项由页面通过 `/system/dept/list/exclude/{deptId}` 提供。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type { TreeSelectOption } from '#/utils/system/tree';

import { z } from '#/adapter/form';

export interface DeptFormSchemaContext {
  parentOptions: TreeSelectOption[];
}

/** 与用户手机号同口径（大陆 11 位） */
export const DEPT_PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function buildDeptFormSchema(
  context: DeptFormSchemaContext,
): VbenFormSchema[] {
  return [
    {
      component: 'TreeSelect',
      componentProps: {
        allowClear: true,
        treeData: context.parentOptions,
        placeholder: '请选择上级部门',
        showSearch: true,
        treeDefaultExpandAll: true,
      },
      defaultValue: '0',
      fieldName: 'parentId',
      label: '上级部门',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 30, placeholder: '请输入部门名称' },
      fieldName: 'deptName',
      label: '部门名称',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 1,
      fieldName: 'orderNum',
      label: '显示排序',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入负责人用户 ID' },
      fieldName: 'leader',
      label: '负责人',
      rules: z.string().max(32).optional(),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 11, placeholder: '请输入联系电话' },
      fieldName: 'phone',
      label: '联系电话',
      rules: z
        .string()
        .refine(
          (value) => value === '' || DEPT_PHONE_PATTERN.test(value),
          '请输入正确的手机号码',
        )
        .optional(),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 50, placeholder: '请输入邮箱' },
      fieldName: 'email',
      label: '邮箱',
      rules: z
        .string()
        .email('请输入正确的邮箱地址')
        .or(z.literal(''))
        .optional(),
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
      label: '部门状态',
    },
  ];
}
