/**
 * 操作日志页可测逻辑（SPEC-004 A-05 / A-18 / E-14）。
 *
 * 详情没有独立端点，数据来自列表行；`operParam` / `jsonResult` 是原文，
 * 合法 JSON 仅做展示层格式化，解析失败必须原样返回（E-14）。
 */
import type {
  OperLog,
  OperLogQuery,
} from '#/api/monitor/operlog/types';

import {
  buildListQuery,
  type PageParam,
  type SortParam,
} from '#/utils/system/query';

/**
 * 查询：业务类型多选空数组不下发（E-14 同源），日期范围进 `params`。
 */
export function buildOperLogQuery(
  formValues: Record<string, any>,
  page?: PageParam,
  sort?: SortParam,
): OperLogQuery {
  const { businessTypes, ...rest } = formValues ?? {};
  const types = Array.isArray(businessTypes)
    ? businessTypes
        .map(Number)
        .filter((item) => Number.isInteger(item))
    : [];
  const query =
    types.length > 0 ? { ...rest, businessTypes: types } : rest;

  return buildListQuery<OperLogQuery>(query, page, sort);
}

/**
 * 详情参数展示：合法 JSON 缩进格式化；非法 JSON、空值原样返回。
 */
export function formatJsonOrRaw(value: null | string = ''): string {
  if (value === null || value.trim() === '') {
    return value ?? '';
  }
  const raw = value;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** 日志行 → 详情弹窗数据（不复制、不改写原文） */
export function toOperLogDetail(row: OperLog): OperLog {
  return row;
}

/** `operTime` 等空值展示占位 */
export function displayValue(value?: null | number | string): string {
  return value === null || value === undefined || value === ''
    ? '—'
    : String(value);
}
