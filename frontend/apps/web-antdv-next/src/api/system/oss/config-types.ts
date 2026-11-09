import type { Id, PageQuery } from '#/api/system/common';

/** 文件配置（SPEC-004 §4.10 SysOssConfigVo） */
export interface OssConfig {
  accessKey: string;
  accessPolicy: string;
  bucketName: string;
  configKey: string;
  domain?: null | string;
  endpoint: string;
  ext1?: null | string;
  isHttps: string;
  ossConfigId: Id;
  prefix?: null | string;
  region?: null | string;
  remark?: null | string;
  secretKey: string;
  status: string;
}

/** 表单模型：id 可选、ext1 不提交（data-model §10） */
export interface OssConfigForm extends Omit<OssConfig, 'ext1' | 'ossConfigId'> {
  ossConfigId?: Id;
}

export interface OssConfigQuery extends PageQuery {
  bucketName?: string;
  configKey?: string;
  status?: string;
}

/** 切换默认配置载荷（status 固定 '0'，其余由后端置 '1'） */
export interface OssConfigStatusPayload {
  configKey: string;
  ossConfigId: Id;
  status: '0';
}
