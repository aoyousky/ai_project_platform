import type {
  OssConfig,
  OssConfigForm,
  OssConfigQuery,
  OssConfigStatusPayload,
} from './config-types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { normalizeIds } from '#/utils/system/id';

export type * from './config-types';

/**
 * 文件配置 API（SPEC-004 §2、data-model §10）。
 * 列表/详情不含敏感字段的展示职责在页面层，接口本身返回完整 VO。
 */
export async function listOssConfigApi(
  query: OssConfigQuery,
): Promise<PageResult<OssConfig>> {
  return requestClient.get<PageResult<OssConfig>>(
    '/resource/oss/config/list',
    { params: query },
  );
}

export async function getOssConfigApi(ossConfigId: Id): Promise<OssConfig> {
  return requestClient.get<OssConfig>(
    `/resource/oss/config/${ossConfigId}`,
  );
}

export async function addOssConfigApi(
  form: OssConfigForm,
): Promise<void> {
  return requestClient.post('/resource/oss/config', form);
}

export async function updateOssConfigApi(
  form: OssConfigForm,
): Promise<void> {
  return requestClient.put('/resource/oss/config', form);
}

export async function delOssConfigApi(ossConfigIds: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/resource/oss/config/${normalizeIds(ossConfigIds).join(',')}`,
  );
}

/** 切换默认：仅提交目标行的 id/key 与 status='0' */
export async function changeOssConfigStatusApi(
  payload: OssConfigStatusPayload,
): Promise<void> {
  return requestClient.put('/resource/oss/config/changeStatus', payload);
}
