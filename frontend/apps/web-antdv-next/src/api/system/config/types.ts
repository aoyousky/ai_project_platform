import type {
  DateRangeParams,
  Id,
  PageQuery,
} from '#/api/system/common';

/** 参数（SPEC-004 §4.5） */
export interface Config {
  configId: Id;
  configKey: string;
  configName: string;
  configType: string;
  configValue: string;
  createTime?: null | string;
  remark?: null | string;
}

export interface ConfigQuery extends PageQuery {
  configKey?: string;
  configName?: string;
  configType?: string;
  params?: DateRangeParams;
}

export interface ConfigForm {
  configId?: Id;
  configKey: string;
  configName: string;
  configType: string;
  configValue: string;
  remark?: null | string;
}

/** 按键名更新（OSS 预览开关复用） */
export interface ConfigKeyUpdate {
  configKey: string;
  configValue: string;
}
