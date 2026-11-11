import type { OnlineQuery, UserOnline } from './types';

import type { PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';

export type * from './types';

/**
 * 在线用户 API（SPEC-007 §4.1 / contracts/backend-api-consumed.md §2）。
 * 后端一次返回全部会话；前端不得传分页参数。
 */
export async function listOnlineApi(
  query: OnlineQuery,
): Promise<PageResult<UserOnline>> {
  return requestClient.get<PageResult<UserOnline>>('/monitor/online/list', {
    params: query,
  });
}

export async function forceLogoutOnlineApi(tokenId: string): Promise<void> {
  await requestClient.delete(`/monitor/online/${encodeURIComponent(tokenId)}`);
}
