import type { Id } from '#/utils/system/id';

/**
 * 系统管理共享 API 契约（SPEC-002 §4 数据契约）。
 *
 * - 分页：后端 `{code,msg,rows,total}`，适配层已解包为 `{rows,total}`；
 * - 字典：`GET /system/dict/data/type/{dictType}` 无需权限码；
 * - 导出：二进制响应，需要 `responseReturn: 'raw'` 才能拿到 headers 与 Blob；
 *   后端业务失败仍返回 HTTP 200 + JSON 体，必须识别并抛出 `msg`，不得静默下载。
 */
import { downloadFileFromBlobPart } from '@vben/utils';

import { requestClient } from '#/api/request';

export type { Id };

/** 分页查询基类字段；其余业务字段由各域扩展 */
export interface PageQuery {
  isAsc?: 'asc' | 'desc';
  orderByColumn?: string;
  pageNum?: number;
  pageSize?: number;
  [key: string]: any;
}

/** 分页结果：适配层把 `{code,msg,rows,total}` 解包为此结构 */
export interface PageResult<T> {
  rows: T[];
  total: number;
}

/** `BaseEntity.params` 承载的日期范围 */
export interface DateRangeParams {
  beginTime?: string;
  endTime?: string;
}

export interface DictData {
  cssClass?: string;
  dictCode?: Id;
  dictLabel: string;
  dictType?: string;
  dictValue: string;
  isDefault?: string;
  listClass?: string;
  remark?: string;
}

export interface DownloadOptions {
  data?: Record<string, any>;
  fileName?: string;
  params?: Record<string, any>;
}

/** 按类型加载字典数据（无权限码要求） */
export async function getDictDataByTypeApi(
  dictType: string,
): Promise<DictData[]> {
  return requestClient.get<DictData[]>(`/system/dict/data/type/${dictType}`);
}

/** 二进制响应只需要 data 与 headers，不直接依赖 axios 类型 */
interface BlobResponse {
  data: Blob;
  headers?: Record<string, any>;
}

function isJsonBlob(response: BlobResponse): boolean {
  const contentType = String(
    response.headers?.['content-type'] ?? response.data?.type ?? '',
  );
  return contentType.includes('application/json');
}

/** 导出失败时后端仍返回 JSON 体，取出 `msg` 供上层提示 */
async function readFailureMessage(blob: Blob): Promise<string> {
  try {
    const body = JSON.parse(await blob.text());
    return body?.msg ?? body?.message ?? '';
  } catch {
    return '';
  }
}

/**
 * 下载二进制导出文件。
 *
 * 后端约定：成功返回文件流；失败返回 `{code,msg}`（HTTP 200）。
 * 因此不能用通用的成功码判定，必须检查 `Content-Type`。
 */
export async function downloadBlob(
  url: string,
  options: DownloadOptions = {},
): Promise<void> {
  const response = await requestClient.post<BlobResponse>(
    url,
    options.data,
    {
      params: options.params,
      responseReturn: 'raw',
      responseType: 'blob',
    },
  );

  const blob = response.data;

  if (isJsonBlob(response)) {
    const msg = await readFailureMessage(blob);
    throw new Error(msg || '导出失败');
  }

  downloadFileFromBlobPart({
    fileName: options.fileName ?? 'export.xlsx',
    source: blob,
  });
}
