import type { OnlineQuery } from '#/api/monitor/online/types';

export interface DictOption {
  label?: string;
  value?: unknown;
}

export interface BatchFailure {
  message: string;
  tokenId: string;
}

export interface BatchResult {
  failures: BatchFailure[];
  successCount: number;
}

/** `null`/`undefined`/空串显示「—」；真实 0 原样显示 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

/** 登录时间按 Asia/Shanghai 输出到秒（SPEC-007 §4.1） */
export function formatLoginTime(loginTime: number): string {
  if (!Number.isFinite(loginTime)) {
    return '—';
  }
  const date = new Date(loginTime);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  // 固定 UTC+8，避免宿主时区影响展示口径
  return new Date(loginTime + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

/** 字典标签优先；缺项回退原值；空值「—」 */
export function deviceTypeText(
  value: null | string | undefined,
  dict: DictOption[],
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const option = dict.find((item) => item.value === value);
  return option?.label || value;
}

/** 只下发非空字符串；保留原始值，不 trim、不加通配符 */
export function buildOnlineQuery(values: Record<string, any>): OnlineQuery {
  const query: OnlineQuery = {};
  if (typeof values.ipaddr === 'string' && values.ipaddr.length > 0) {
    query.ipaddr = values.ipaddr;
  }
  if (typeof values.userName === 'string' && values.userName.length > 0) {
    query.userName = values.userName;
  }
  return query;
}

/** 本地分页：页码小于 1 按第 1 页处理 */
export function paginateRows<T>(rows: T[], page: number, pageSize = 10): T[] {
  const current = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const start = (current - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** 同一筛选条件只取数一次；翻页复用全量行，不再请求后端（E-04）。 */
export async function loadCachedRows<T>(
  cache: Map<string, T[]>,
  key: string,
  fetcher: () => Promise<T[]>,
): Promise<T[]> {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const rows = await fetcher();
  cache.set(key, rows);
  return rows;
}

export function summarizeBatchResult(
  successCount: number,
  failures: BatchFailure[],
): string {
  const summary = `成功 ${successCount} 条，失败 ${failures.length} 条`;
  if (failures.length === 0) {
    return summary;
  }
  return `${summary}：${failures.map((item) => item.message).join('；')}`;
}

/**
 * 逐条强退：单条失败不中断，最终返回成功数与失败明细。
 * 网络层失败（非 Error）使用请求层统一兜底文案。
 */
export async function runBatchLogout(
  tokenIds: string[],
  logout: (tokenId: string) => Promise<void>,
): Promise<BatchResult> {
  let successCount = 0;
  const failures: BatchFailure[] = [];

  for (const tokenId of tokenIds) {
    try {
      await logout(tokenId);
      successCount += 1;
    } catch (error) {
      failures.push({
        tokenId,
        message:
          error instanceof Error && error.message
            ? error.message
            : '操作失败，请稍后重试',
      });
    }
  }

  return { failures, successCount };
}
