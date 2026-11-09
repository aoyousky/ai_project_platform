/**
 * 文件页可测逻辑（SPEC-004 A-07 / A-12 / E-19 / E-30）。
 *
 * 预览开关、后缀白名单、下载文件名回退与查询组装放在这里，页面只负责渲染与
 * 请求调度。预览开关读取参数 `sys.oss.previewListResource`（无权限码），
 * 写入需要 `system:config:edit`（§7 签字确认项 1）。
 */
import type { ConfigKeyUpdate } from '#/api/system/config/types';
import type { Oss, OssQuery, OssUpload } from '#/api/system/oss/types';

import { removeEmptyParams } from '#/utils/system/query';

/** 预览开关参数键（SPEC-004 后端事实 12） */
export const PREVIEW_CONFIG_KEY = 'sys.oss.previewListResource';

/** 允许缩略图预览的后缀（去掉前导点、忽略大小写） */
const PREVIEWABLE_SUFFIXES = new Set(['jpeg', 'jpg', 'png']);

interface PageParam {
  currentPage: number;
  pageSize: number;
}

function toPageParams(page?: PageParam) {
  return page
    ? { pageNum: page.currentPage, pageSize: page.pageSize }
    : {};
}

function normalizeSuffix(value?: null | string): string {
  return String(value ?? '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
}

/** 参数值是否为开启：仅字符串 `true`（忽略大小写与空白） */
export function isPreviewEnabled(value: unknown): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

/** A-12：开关开启且后缀在 png/jpg/jpeg 白名单内才渲染图片 */
export function isPreviewableImage(
  fileSuffix?: null | string,
  previewEnabled = false,
): boolean {
  return previewEnabled && PREVIEWABLE_SUFFIXES.has(normalizeSuffix(fileSuffix));
}

/** 切换目标值：开启 → `'false'`，其余 → `'true'` */
export function nextPreviewValue(current: unknown): 'false' | 'true' {
  return isPreviewEnabled(current) ? 'false' : 'true';
}

/** A-12：写入参数的固定载荷 */
export function buildPreviewTogglePayload(current: unknown): ConfigKeyUpdate {
  return {
    configKey: PREVIEW_CONFIG_KEY,
    configValue: nextPreviewValue(current),
  };
}

/** 下载文件名回退：原名 → 存储文件名 → `download` */
export function downloadFileName(
  oss?: null | Partial<Oss>,
): string {
  return (
    String(oss?.originalName ?? '').trim() ||
    String(oss?.fileName ?? '').trim() ||
    'download'
  );
}

export interface UploadSummary {
  fileName: string;
  originalName: string;
  ossId: string;
  url: string;
}

/**
 * A-07 / E-30：上传响应映射。
 * `ossId` 统一转字符串保存，避免超出安全整数范围时精度丢失。
 */
export function toUploadSummary(
  result?: null | Partial<OssUpload>,
  originalName?: null | string,
): UploadSummary {
  const original = String(originalName ?? '').trim();
  return {
    fileName: String(result?.fileName ?? '').trim() || original,
    originalName: original,
    ossId: result?.ossId === undefined || result?.ossId === null
      ? ''
      : String(result.ossId),
    url: String(result?.url ?? ''),
  };
}

/**
 * 列表查询：日期范围写入 `params.beginCreateTime` / `params.endCreateTime`
 * （OSS 列表与其他列表的日期键不同，SPEC-004 后端事实 10）。
 */
export function buildOssQuery(
  formValues: Record<string, any>,
  page?: PageParam,
): OssQuery {
  const { dateRange, ...rest } = formValues ?? {};
  const query: Record<string, any> = {
    ...rest,
    ...toPageParams(page),
  };

  const params: Record<string, any> = { ...query.params };
  const [beginTime, endTime] = (dateRange ?? []) as [string, string?];
  if (beginTime) {
    params.beginCreateTime = beginTime;
  } else {
    delete params.beginCreateTime;
  }
  if (endTime) {
    params.endCreateTime = endTime;
  } else {
    delete params.endCreateTime;
  }
  if (Object.keys(params).length > 0) {
    query.params = params;
  } else {
    delete query.params;
  }

  return removeEmptyParams(query) as OssQuery;
}
