/**
 * 系统管理表单的公共 schema 片段（constraints VIII 重复率闸门）。
 *
 * 多页共用的必填文本规则与备注字段集中在这里，避免各表单复制同一段
 * zod 链与 Textarea 配置。
 */
import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';

/** 必填文本：不修剪首尾空白（与各页原实现一致），超长按字段名提示 */
export function requiredTextRule(label: string, max = 100) {
  return z
    .string()
    .min(1, `请输入${label}`)
    .max(max, `${label}不能超过 ${max} 个字符`);
}

/** 备注字段：各页一致的 Textarea 配置 */
export function createRemarkField(): VbenFormSchema {
  return {
    component: 'Textarea',
    componentProps: { placeholder: '请输入内容', rows: 3 },
    fieldName: 'remark',
    label: '备注',
  };
}
