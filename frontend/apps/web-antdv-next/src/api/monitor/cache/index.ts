import type { CacheInfo } from './types';

import { requestClient } from '#/api/request';

export type * from './types';

/**
 * 缓存监控 API（SPEC-007 §4.2 / contracts/backend-api-consumed.md §3）。
 * 只消费 `GET /monitor/cache`；不请求任何键浏览或清理端点。
 */
export async function getCacheInfoApi(): Promise<CacheInfo> {
  return requestClient.get<CacheInfo>('/monitor/cache');
}
