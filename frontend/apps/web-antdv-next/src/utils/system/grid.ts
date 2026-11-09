/**
 * vxe 表格代理查询的公共流程（SPEC-004 E-13 / E-25）。
 *
 * 页码越界时回退到有效页并重取一次；正常页直接返回。各列表页只声明
 * “查询参数如何构造”和“调用哪个列表接口”，避免复制同一段回退代码。
 */
import type { PageParam, SortParam } from './query';

import { resolveOutOfRangePage } from './pagination';

interface GridPageParams {
  page: PageParam;
  sort?: SortParam;
}

interface GridQueryResult<TRow> {
  rows: TRow[];
  total: number;
}

interface GridQueryOptions<TQuery, TRow> {
  /** 返回 false 时跳过请求，直接展示空列表（如未选中上下文） */
  beforeQuery?: () => boolean;
  buildQuery: (
    formValues: Record<string, any>,
    page: PageParam,
    sort?: SortParam,
  ) => TQuery;
  fetch: (query: TQuery) => Promise<GridQueryResult<TRow>>;
  /** 取回最终结果后同步页面计数等派生状态 */
  onResult?: (result: GridQueryResult<TRow>) => void;
  withSort?: boolean;
}

/**
 * 返回 vxe `proxyConfig.ajax.query` 可用的查询函数。
 * 第一次取当前页；若页码超出总页数，则用回退页码重取。
 */
export function createGridQuery<TQuery extends Record<string, any>, TRow>(
  options: GridQueryOptions<TQuery, TRow>,
): (
  params: GridPageParams,
  formValues: Record<string, any>,
) => Promise<{ items: TRow[]; total: number }> {
  return async (params, formValues) => {
    if (options.beforeQuery?.() === false) {
      return { items: [], total: 0 };
    }
    const page = params.page;
    const query = options.buildQuery(
      formValues ?? {},
      page,
      options.withSort ? params.sort : undefined,
    );
    const { rows, total } = await options.fetch(query);
    const fallbackPage = resolveOutOfRangePage({
      pageNum: page.currentPage,
      pageSize: page.pageSize,
      rowCount: rows.length,
      total,
    });
    if (fallbackPage === null) {
      const result = { rows, total };
      options.onResult?.(result);
      return { items: rows, total };
    }
    const corrected = await options.fetch({
      ...query,
      pageNum: fallbackPage,
    });
    options.onResult?.(corrected);
    return { items: corrected.rows, total: corrected.total };
  };
}
