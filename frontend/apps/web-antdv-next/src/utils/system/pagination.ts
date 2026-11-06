/**
 * 分页越界回退（SPEC-002 E-10 / SPEC-003 E-27）。
 *
 * 仅当“本页无数据且页码严格超过最大页”时回退，避免把合法的空页
 * （total=0、第一页、rows 非空但 total 尚未更新）误判为越界。
 */
export function resolveOutOfRangePage(options: {
  pageNum: number;
  pageSize: number;
  rowCount: number;
  total: number;
}): null | number {
  const { pageNum, pageSize, rowCount, total } = options;
  if (rowCount > 0 || total <= 0 || pageNum <= 1 || pageSize <= 0) {
    return null;
  }
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return pageNum > lastPage ? lastPage : null;
}
