/**
 * 岗位新增/编辑表单 schema（SPEC-003 A-12）。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type { TreeSelectOption } from '#/utils/system/tree';

export interface PostFormSchemaContext {
  deptOptions: TreeSelectOption[];
}

export function buildPostFormSchema(
  context: PostFormSchemaContext,
): VbenFormSchema[] {
  return [
    {
      component: 'TreeSelect',
      componentProps: {
        allowClear: true,
        treeData: context.deptOptions,
        placeholder: '请选择所属部门',
        showSearch: true,
        treeDefaultExpandAll: true,
      },
      fieldName: 'deptId',
      label: '所属部门',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 64, placeholder: '请输入岗位编码' },
      fieldName: 'postCode',
      label: '岗位编码',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 50, placeholder: '请输入岗位名称' },
      fieldName: 'postName',
      label: '岗位名称',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 1,
      fieldName: 'postSort',
      label: '显示排序',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入岗位类别' },
      fieldName: 'postCategory',
      label: '岗位类别',
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
      label: '岗位状态',
    },
    {
      component: 'Textarea',
      componentProps: { placeholder: '请输入内容', rows: 3 },
      fieldName: 'remark',
      label: '备注',
    },
  ];
}
