import type { Logininfor, LogininforQuery } from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 登录日志 API（SPEC-004 §2 / contracts/backend-api-consumed.md §6）。
 * 解锁只清 Redis 中的失败计数，不删除日志记录（A-06 / E-17）。
 */
export async function listLogininforApi(
  query: LogininforQuery,
): Promise<PageResult<Logininfor>> {
  return requestClient.get<PageResult<Logininfor>>(
    '/monitor/logininfor/list',
    { params: query },
  );
}

export async function exportLogininforApi(
  query: LogininforQuery,
): Promise<void> {
  await downloadBlob('/monitor/logininfor/export', {
    fileName: '登录日志.xlsx',
    params: query,
  });
}

export async function delLogininforApi(infoIds: Array<Id>): Promise<void> {
  await requestClient.delete(
    `/monitor/logininfor/${normalizeIds(infoIds).join(',')}`,
  );
}

export async function cleanLogininforApi(): Promise<void> {
  await requestClient.delete('/monitor/logininfor/clean');
}

export async function unlockLogininforApi(userName: string): Promise<void> {
  await requestClient.get(
    `/monitor/logininfor/unlock/${encodeURIComponent(userName)}`,
  );
}
