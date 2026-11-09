import type { WorkbenchResponse } from './types';

import { requestClient } from '#/api/request';

/**
 * SPEC-005 §4.1：当前登录用户的工作台聚合数据。
 *
 * 只读；前端 5 秒超时，与首页一致。
 */
export async function getDashboardWorkbenchApi(): Promise<WorkbenchResponse> {
  return requestClient.get<WorkbenchResponse>('/dashboard/workbench', {
    timeout: 5000,
  });
}

export type * from './types';
