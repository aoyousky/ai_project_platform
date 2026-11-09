import type { HomeResponse } from './types';

import { requestClient } from '#/api/request';

/**
 * SPEC-005 §4.1：当前登录用户与租户的首页聚合数据。
 *
 * 5 秒是前端硬超时（E-10）：后端 3 秒查询超时后返回 PARTIAL，
 * 若后端整体无响应，前端在 5 秒中止并进入与超时相同的错误态。
 */
export async function getDashboardHomeApi(): Promise<HomeResponse> {
  return requestClient.get<HomeResponse>('/dashboard/home', {
    timeout: 5000,
  });
}

export type * from './types';
