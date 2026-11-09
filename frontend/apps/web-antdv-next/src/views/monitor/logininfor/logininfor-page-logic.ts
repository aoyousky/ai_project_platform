/**
 * 登录日志页可测逻辑（SPEC-004 A-06 / A-15 / A-18 / E-16）。
 *
 * 解锁只允许恰好勾选 1 条且该行有用户名；勾选 0 条或多条时入口不可用。
 */
import type {
  Logininfor,
  LogininforQuery,
} from '#/api/monitor/logininfor/types';

import { addDateRange, removeEmptyParams } from '#/utils/system/query';

interface PageParam {
  currentPage: number;
  pageSize: number;
}

interface SortParam {
  field?: string;
  order?: 'asc' | 'desc';
}

function toPageParams(page?: PageParam) {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

/** 表格排序 → 后端 `orderByColumn` / `isAsc`；缺字段时不发送 */
function toSortParams(sort?: SortParam) {
  if (!sort?.field || !sort?.order) {
    return {};
  }
  return { isAsc: sort.order, orderByColumn: sort.field };
}

/**
 * 查询：日期范围进 `params`，空白条件移除；`status` 是字符串原样保留。
 */
export function buildLogininforQuery(
  formValues: Record<string, any>,
  page?: PageParam,
  sort?: SortParam,
): LogininforQuery {
  const { dateRange, ...rest } = formValues ?? {};
  const query: Record<string, any> = {
    ...rest,
    ...toPageParams(page),
    ...toSortParams(sort),
  };

  return removeEmptyParams(
    addDateRange(query, dateRange as [string, string] | undefined),
  ) as LogininforQuery;
}

/** 恰好 1 条且有用户名才允许解锁（A-15 / E-16） */
export function canUnlock(rows: Array<Partial<Logininfor>>): boolean {
  return unlockUserName(rows) !== undefined;
}

/** 勾选行的用户名：数量不等于 1 或无用户名时返回 undefined */
export function unlockUserName(
  rows: Array<Partial<Logininfor>>,
): string | undefined {
  if (rows.length !== 1) {
    return undefined;
  }
  const name = String(rows[0]?.userName ?? '').trim();
  return name || undefined;
}
