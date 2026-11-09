import type { OperLog, OperLogQuery } from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 操作日志 API（SPEC-004 §2 / contracts/backend-api-consumed.md §6）。
 * 后端 `businessTypes` 是 `Integer[]`，axios 默认 `key[]=` 无法绑定，
 * 列表与导出都必须使用 `repeat` 序列化（`businessTypes=1&businessTypes=2`）。
 */
export async function listOperLogApi(
  query: OperLogQuery,
): Promise<PageResult<OperLog>> {
  return requestClient.get<PageResult<OperLog>>('/monitor/operlog/list', {
    params: query,
    paramsSerializer: 'repeat',
  });
}

export async function exportOperLogApi(query: OperLogQuery): Promise<void> {
  await downloadBlob('/monitor/operlog/export', {
    fileName: '操作日志.xlsx',
    params: query,
    paramsSerializer: 'repeat',
  });
}

export async function delOperLogApi(operIds: Array<Id>): Promise<void> {
  await requestClient.delete(
    `/monitor/operlog/${normalizeIds(operIds).join(',')}`,
  );
}

export async function cleanOperLogApi(): Promise<void> {
  await requestClient.delete('/monitor/operlog/clean');
}
