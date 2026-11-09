/**
 * 字典页可测逻辑（SPEC-004 A-01 / A-02 / E-34）。
 *
 * 页面只负责渲染与请求调度；查询组装、载荷映射、隐藏页上下文解析与
 * 缓存清理顺序放在这里，便于单测覆盖。
 */
import type {
  DictData,
  DictDataForm,
  DictDataQuery,
  DictType,
  DictTypeForm,
  DictTypeQuery,
} from '#/api/system/dict/types';

import { clearDictCache } from '#/composables/use-dict';
import { addDateRange, removeEmptyParams } from '#/utils/system/query';

interface PageParam {
  currentPage: number;
  pageSize: number;
}

function toPageParams(page?: PageParam) {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

/** 左侧类型查询：搜索表单 + 日期范围 + 分页 */
export function buildDictTypeQuery(
  formValues: Record<string, any>,
  page?: PageParam,
): DictTypeQuery {
  const { dateRange, ...rest } = formValues ?? {};
  return removeEmptyParams(
    addDateRange(
      {
        ...rest,
        ...toPageParams(page),
      },
      dateRange as [string, string] | undefined,
    ),
  ) as DictTypeQuery;
}

/**
 * 右侧数据查询：`dictType` 固定为当前选中类型，忽略搜索表单中的同名字段。
 */
export function buildDictDataQuery(
  formValues: Record<string, any>,
  page: PageParam | undefined,
  dictType: string,
): DictDataQuery {
  const { dictType: _ignored, ...rest } = formValues ?? {};
  return removeEmptyParams({
    ...rest,
    dictType,
    ...toPageParams(page),
  }) as DictDataQuery;
}

function trimmedOrNull(value: unknown): null | string {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** 类型表单值 → 提交体；空备注提交 `null`，编辑时补 `dictId` */
export function buildDictTypeSubmitPayload(
  values: Record<string, any>,
  dictId?: number | string,
): DictTypeForm {
  const effectiveId = dictId ?? values.dictId;
  const payload: DictTypeForm = {
    dictName: String(values.dictName ?? '').trim(),
    dictType: String(values.dictType ?? '').trim(),
    remark: trimmedOrNull(values.remark),
  };

  if (effectiveId !== undefined && effectiveId !== null) {
    payload.dictId = effectiveId;
  }

  return payload;
}

/**
 * 数据表单值 → 提交体。
 * `isDefault` 不展示、不提交；空样式提交 `null`；`dictSort` 缺省 0。
 */
export function buildDictDataSubmitPayload(
  values: Record<string, any>,
  dictCode?: number | string,
): DictDataForm {
  const effectiveId = dictCode ?? values.dictCode;
  const sort = Number(values.dictSort ?? 0);
  const payload: DictDataForm = {
    cssClass: trimmedOrNull(values.cssClass),
    dictLabel: String(values.dictLabel ?? '').trim(),
    dictSort: Number.isFinite(sort) && sort >= 0 ? sort : 0,
    dictType: String(values.dictType ?? '').trim(),
    dictValue: String(values.dictValue ?? '').trim(),
    listClass: trimmedOrNull(values.listClass),
    remark: trimmedOrNull(values.remark),
  };

  if (effectiveId !== undefined && effectiveId !== null) {
    payload.dictCode = effectiveId;
  }

  return payload;
}

/** 类型详情 → 表单回显 */
export function toDictTypeFormValues(type: DictType): Record<string, any> {
  return {
    dictId: type.dictId,
    dictName: type.dictName,
    dictType: type.dictType,
    remark: type.remark ?? '',
  };
}

/** 字典数据详情 → 表单回显 */
export function toDictDataFormValues(data: DictData): Record<string, any> {
  return {
    cssClass: data.cssClass ?? '',
    dictCode: data.dictCode,
    dictLabel: data.dictLabel,
    dictSort: data.dictSort ?? 0,
    dictType: data.dictType,
    dictValue: data.dictValue,
    listClass: data.listClass ?? 'default',
    remark: data.remark ?? '',
  };
}

/**
 * 隐藏页上下文：`dictId` 必须先取回 `dictType` 才能查数据。
 * 任一字段为空视为无效类型，页面只展示空状态，不发起列表请求。
 */
export function resolveDictDataPageContext(
  type: DictType | null | undefined,
): null | { dictId: string; dictType: string } {
  if (!type) {
    return null;
  }
  const dictId = String(type.dictId ?? '').trim();
  const dictType = String(type.dictType ?? '').trim();
  if (!dictId || !dictType) {
    return null;
  }
  return { dictId, dictType };
}

/** 回显样式枚举（顺序与 plus-ui 一致） */
export const LIST_CLASS_OPTIONS = [
  { label: '默认', value: 'default' },
  { label: '主要', value: 'primary' },
  { label: '成功', value: 'success' },
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '危险', value: 'danger' },
] as const;

const LIST_CLASS_TAG: Record<string, { color: string; label: string }> = {
  danger: { color: 'error', label: '危险' },
  default: { color: 'default', label: '默认' },
  info: { color: 'default', label: '信息' },
  primary: { color: 'blue', label: '主要' },
  success: { color: 'success', label: '成功' },
  warning: { color: 'warning', label: '警告' },
};

/** 未知回显样式按 default 渲染，不回写后端（data-model §4） */
export function listClassInfo(value?: null | string): {
  color: string;
  label: string;
} {
  return LIST_CLASS_TAG[String(value ?? '')] ?? LIST_CLASS_TAG.default!;
}

export type DictDataRowAction = 'add' | 'edit' | 'remove';

/** A-01 右侧行数期望：新增 +1、修改不变、删除 -1 */
export function nextDictDataRowCount(
  current: number,
  action: DictDataRowAction,
  count = 1,
): number {
  if (action === 'add') {
    return current + count;
  }
  if (action === 'remove') {
    return Math.max(0, current - count);
  }
  return current;
}

/**
 * E-34：刷新缓存成功后清空会话字典缓存，失败时保持原缓存并抛错。
 */
export async function refreshDictCache(
  refresh: () => Promise<void>,
  clearCache: () => void = clearDictCache,
): Promise<void> {
  await refresh();
  clearCache();
}
