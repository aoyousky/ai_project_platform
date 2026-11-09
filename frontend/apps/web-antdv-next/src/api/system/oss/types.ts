import type {
  DateRangeParams,
  Id,
  PageQuery,
} from '#/api/system/common';

/** 文件（SPEC-004 §4.9 SysOssVo） */
export interface Oss {
  createBy?: Id | null;
  createByName?: null | string;
  createTime?: null | string;
  ext1?: null | string;
  fileName: string;
  fileSuffix?: null | string;
  originalName?: null | string;
  ossId: Id;
  service?: null | string;
  url: string;
}

/** 上传响应（SPEC-004 §4.9 SysOssUploadVo） */
export interface OssUpload {
  fileName: string;
  ossId: Id;
  url: string;
}

/** 文件列表日期参数使用 `params[beginCreateTime]` / `params[endCreateTime]`（§4.11） */
export interface OssDateRangeParams extends DateRangeParams {
  beginCreateTime?: string;
  endCreateTime?: string;
}

export interface OssQuery extends PageQuery {
  fileName?: string;
  fileSuffix?: string;
  originalName?: string;
  params?: OssDateRangeParams;
  service?: string;
}
