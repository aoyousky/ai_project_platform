import type { Oss, OssQuery, OssUpload } from './types';

import type { Id, PageResult } from '#/api/system/common';

import { requestClient } from '#/api/request';
import { downloadBinary } from '#/api/system/common';
import { normalizeIds } from '#/utils/system/id';

export type * from './types';

/**
 * 文件 API（SPEC-004 §2、contracts §4.9）。
 *
 * - 上传使用 multipart 字段 `file`；请求实例默认 `Content-Type: application/json` 会让
 *   Axios 把 FormData 序列化成 JSON（后端 415/500），必须显式清空该头，交给浏览器加 boundary；
 * - 下载走 GET 二进制 helper，失败时后端仍可能 HTTP 200 + JSON，按 `msg` 抛出（E-29）；
 * - 删除使用逗号分隔编号，编号一律先归一化为字符串（E-30）。
 */
export async function listOssApi(query: OssQuery): Promise<PageResult<Oss>> {
  return requestClient.get<PageResult<Oss>>('/resource/oss/list', {
    params: query,
  });
}

/** 按编号取文件（A-07 上传后可按编号核对） */
export async function getOssByIdsApi(ossIds: Array<Id>): Promise<Oss[]> {
  return requestClient.get<Oss[]>(
    `/resource/oss/listByIds/${normalizeIds(ossIds).join(',')}`,
  );
}

/** 上传；响应 `{url,fileName,ossId}` 由适配层取出 `data` */
export async function uploadOssApi(file: File): Promise<OssUpload> {
  const formData = new FormData();
  formData.append('file', file);

  return requestClient.post<OssUpload>('/resource/oss/upload', formData, {
    headers: { 'Content-Type': undefined },
    // 默认 10s 对真实对象存储上传偏短（本地实测 ~14s），超时会让已成功的
    // 上传在页面上表现为失败并触发重复重试
    timeout: 60_000,
  });
}

/** 下载：GET 二进制，文件名由调用方按原名/存储名回退 */
export async function downloadOssApi(
  ossId: Id,
  fileName?: string,
): Promise<void> {
  return downloadBinary(`/resource/oss/download/${ossId}`, { fileName });
}

/** 批量删除（逗号分隔） */
export async function delOssApi(ossIds: Array<Id>): Promise<void> {
  return requestClient.delete(
    `/resource/oss/${normalizeIds(ossIds).join(',')}`,
  );
}
