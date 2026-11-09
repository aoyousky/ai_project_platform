/**
 * RuoYi 查询参数适配。
 *
 * 日期范围由 `BaseEntity.params` 承载，Axios 默认序列化为 `params[beginTime]` /
 * `params[endTime]`（与后端 `beginTime` / `endTime` 绑定）。
 */
export interface DateRangeParams {
  beginTime?: string;
  endTime?: string;
}

type QueryRecord = Record<string, any>;

export interface PageParam {
  currentPage: number;
  pageSize: number;
}

export interface SortParam {
  field?: string;
  order?: 'asc' | 'desc';
}

/** 前端分页参数 → 后端 `pageNum` / `pageSize`；无分页时不发送 */
export function toPageParams(page?: PageParam): QueryRecord {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

/** 表格排序 → 后端 `orderByColumn` / `isAsc`；缺字段时不发送 */
export function toSortParams(sort?: SortParam): QueryRecord {
  if (!sort?.field || !sort?.order) {
    return {};
  }
  return { isAsc: sort.order, orderByColumn: sort.field };
}

/** 去空白后转 `null`；空串表示“未填写”，与 0 区分 */
export function trimmedOrNull(value: unknown): null | string {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * 通用列表查询：搜索表单 + 分页 + 可选排序 + 可选日期范围。
 * `dateRange` 只进 `params`，不会作为普通搜索字段下发。
 */
export function buildListQuery<T extends QueryRecord = QueryRecord>(
  formValues: Record<string, any>,
  page?: PageParam,
  sort?: SortParam,
  options: { withDateRange?: boolean } = {},
): T {
  const { dateRange, ...rest } = formValues ?? {};
  const query: QueryRecord = {
    ...rest,
    ...toPageParams(page),
    ...toSortParams(sort),
  };
  const ranged =
    options.withDateRange === false
      ? query
      : addDateRange(query, dateRange as [string, string] | undefined);

  return removeEmptyParams(ranged) as T;
}

/**
 * 把日期范围写入 `query.params`，不修改入参。
 * 空值会清理已有 key；清理后 `params` 为空则移除该字段。
 */
export function addDateRange<T extends QueryRecord>(
  query: T,
  range?: [string, string] | null,
): T & { params?: DateRangeParams } {
  const next: QueryRecord = { ...query };
  const params: DateRangeParams = { ...query.params };
  const [beginTime, endTime] = range ?? [];

  if (beginTime) {
    params.beginTime = beginTime;
  } else {
    delete params.beginTime;
  }

  if (endTime) {
    params.endTime = endTime;
  } else {
    delete params.endTime;
  }

  if (Object.keys(params).length > 0) {
    next.params = params;
  } else {
    delete next.params;
  }

  return next as T & { params?: DateRangeParams };
}

/**
 * 移除空串、null、undefined，保留 0 与 false。
 */
export function removeEmptyParams<T extends QueryRecord>(query: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  ) as Partial<T>;
}
