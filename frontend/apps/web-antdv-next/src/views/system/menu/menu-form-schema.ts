/**
 * 菜单新增/编辑表单 schema（SPEC-003 A-08 / A-14）。
 *
 * 字段按 `menuType` 切换：
 * - M/C：路由地址（必填）、组件路径、路由参数、外链、缓存；
 * - F：只保留权限标识；
 * - 隐藏菜单：remark 作为“激活路由”，必须以 `/` 开头。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type { TreeSelectOption } from '#/utils/system/tree';

import { z } from '#/adapter/form';

export interface MenuFormSchemaContext {
  parentOptions: TreeSelectOption[];
}

/** §4.7：`a:b:c` 形式，≤100 */
export const PERMS_PATTERN = /^[a-z][a-z0-9]*(:[a-z0-9]+)+$/;

const MENU_TYPE_OPTIONS = [
  { label: '目录', value: 'M' },
  { label: '菜单', value: 'C' },
  { label: '按钮', value: 'F' },
];

const VISIBLE_OPTIONS = [
  { label: '显示', value: '0' },
  { label: '隐藏', value: '1' },
];

const STATUS_OPTIONS = [
  { label: '正常', value: '0' },
  { label: '停用', value: '1' },
];

function isButton(values: Record<string, any>): boolean {
  return values.menuType === 'F';
}

function isHiddenRoute(values: Record<string, any>): boolean {
  return values.visible === '1' && values.menuType !== 'F';
}

export function buildMenuFormSchema(
  context: MenuFormSchemaContext,
): VbenFormSchema[] {
  return [
    {
      component: 'RadioGroup',
      componentProps: { buttonStyle: 'solid', optionType: 'button', options: MENU_TYPE_OPTIONS },
      defaultValue: 'M',
      fieldName: 'menuType',
      label: '菜单类型',
    },
    {
      component: 'TreeSelect',
      componentProps: {
        allowClear: true,
        treeData: context.parentOptions,
        placeholder: '请选择上级菜单',
        showSearch: true,
        treeDefaultExpandAll: true,
      },
      defaultValue: '0',
      fieldName: 'parentId',
      label: '上级菜单',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入菜单名称', maxlength: 50 },
      fieldName: 'menuName',
      label: '菜单名称',
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
      componentProps: { placeholder: '请输入图标名称' },
      fieldName: 'icon',
      label: '菜单图标',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入路由地址，如 user' },
      dependencies: {
        rules: (values) =>
          isButton(values) ? null : z.string().min(1, '请输入路由地址').max(200),
        show: (values) => !isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'path',
      label: '路由地址',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入组件路径，如 system/user/index' },
      dependencies: {
        show: (values) => !isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'component',
      label: '组件路径',
      rules: z.string().max(255).optional(),
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入路由参数，如 {"id": 1}' },
      dependencies: {
        show: (values) => !isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'queryParam',
      label: '路由参数',
      rules: z.string().max(255).optional(),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '是', value: '0' },
          { label: '否', value: '1' },
        ],
      },
      defaultValue: '1',
      dependencies: {
        show: (values) => !isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'isFrame',
      label: '是否外链',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '缓存', value: '0' },
          { label: '不缓存', value: '1' },
        ],
      },
      defaultValue: '0',
      dependencies: {
        show: (values) => !isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'isCache',
      label: '是否缓存',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入权限标识，如 system:user:add' },
      dependencies: {
        show: (values) => isButton(values),
        triggerFields: ['menuType'],
      },
      fieldName: 'perms',
      label: '权限标识',
      rules: z
        .string()
        .max(100)
        .refine(
          (value) => value === '' || PERMS_PATTERN.test(value),
          '权限标识格式必须为 a:b:c',
        )
        .optional(),
    },
    {
      component: 'RadioGroup',
      componentProps: { options: VISIBLE_OPTIONS },
      defaultValue: '0',
      fieldName: 'visible',
      label: '显示状态',
    },
    {
      component: 'RadioGroup',
      componentProps: { options: STATUS_OPTIONS },
      defaultValue: '0',
      fieldName: 'status',
      label: '菜单状态',
    },
    {
      component: 'Textarea',
      componentProps: { placeholder: '请输入内容', rows: 3 },
      dependencies: {
        show: (values) => !isHiddenRoute(values),
        triggerFields: ['menuType', 'visible'],
      },
      fieldName: 'remark',
      label: '备注',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入激活路由，必须以 / 开头' },
      dependencies: {
        show: isHiddenRoute,
        triggerFields: ['menuType', 'visible'],
      },
      fieldName: 'activeRoute',
      label: '激活路由',
      rules: z
        .string()
        .refine(
          (value) => value === '' || value.startsWith('/'),
          '激活路由必须以 / 开头',
        )
        .optional(),
    },
  ];
}
