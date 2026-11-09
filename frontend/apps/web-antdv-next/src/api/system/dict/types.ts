/**
 * 字典域类型契约（SPEC-004 §4.3 / §4.4、data-model §3–§4）。
 *
 * - `DictData` 通过 `dictType` 字符串关联父类型，不是 `dictId`；
 * - `dictSort` 后端缺省为 0，`listClass` 为 `null` 时按 `default` 渲染；
 * - `isDefault` 只读展示，表单不编辑、不提交。
 */
import type { DateRangeParams, Id, PageQuery } from '#/api/system/common';

export interface DictType {
  createTime?: null | string;
  dictId: Id;
  dictName: string;
  dictType: string;
  remark?: null | string;
}

export interface DictData {
  createTime?: null | string;
  cssClass?: null | string;
  dictCode: Id;
  dictLabel: string;
  dictSort: number;
  dictType: string;
  dictValue: string;
  isDefault?: null | string;
  listClass?: null | string;
  remark?: null | string;
}

export interface DictTypeQuery extends PageQuery {
  dictName?: string;
  dictType?: string;
  params?: DateRangeParams;
}

export interface DictTypeForm {
  dictId?: Id;
  dictName: string;
  dictType: string;
  remark?: null | string;
}

export interface DictDataQuery extends PageQuery {
  dictLabel?: string;
  dictSort?: number;
  dictType?: string;
}

export interface DictDataForm {
  cssClass?: null | string;
  dictCode?: Id;
  dictLabel: string;
  dictSort: number;
  dictType: string;
  dictValue: string;
  listClass?: null | string;
  remark?: null | string;
}
