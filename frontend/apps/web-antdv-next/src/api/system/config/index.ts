import type {
  Config,
  ConfigForm,
  ConfigKeyUpdate,
  ConfigQuery,
} from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { downloadBlob } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

/**
 * 参数 API（SPEC-004 §2 / contracts/backend-api-consumed.md §4）。
 * `configKey` 允许重复，前端不做唯一性拦截（E-07）。
 */
export async function listConfigApi(
  query: ConfigQuery,
): Promise<PageResult<Config>> {
  return requestClient.get<PageResult<Config>>('/system/config/list', {
    params: query,
  });
}

export async function getConfigApi(configId: Id): Promise<Config> {
  return requestClient.get<Config>(`/system/config/${configId}`);
}

/** 按键取值：无权限码要求；OSS 预览开关复用 */
export async function getConfigKeyApi(configKey: string): Promise<string> {
  return requestClient.get<string>(`/system/config/configKey/${configKey}`);
}

export async function addConfigApi(data: ConfigForm): Promise<void> {
  await requestClient.post('/system/config', data);
}

export async function updateConfigApi(data: ConfigForm): Promise<void> {
  await requestClient.put('/system/config', data);
}

export async function updateConfigByKeyApi(
  data: ConfigKeyUpdate,
): Promise<void> {
  await requestClient.put('/system/config/updateByKey', data);
}

export async function delConfigApi(configIds: Array<Id>): Promise<void> {
  await requestClient.delete(
    `/system/config/${normalizeIds(configIds).join(',')}`,
  );
}

export async function refreshConfigCacheApi(): Promise<void> {
  await requestClient.delete('/system/config/refreshCache');
}

export async function exportConfigApi(query: ConfigQuery): Promise<void> {
  await downloadBlob('/system/config/export', {
    fileName: '参数设置.xlsx',
    params: query,
  });
}
