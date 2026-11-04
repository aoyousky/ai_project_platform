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
