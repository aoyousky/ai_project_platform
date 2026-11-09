import type { DateRangeParams, Id, PageQuery } from '#/api/system/common';

/** 操作日志（SPEC-004 §4.7）；tenantId 不展示 */
export interface OperLog {
  businessType?: null | number;
  businessTypes?: null | number[];
  costTime?: null | number;
  deptName?: null | string;
  errorMsg?: null | string;
  jsonResult?: null | string;
  method?: null | string;
  operId: Id;
  operIp?: null | string;
  operLocation?: null | string;
  operName?: null | string;
  operParam?: null | string;
  operTime?: null | string;
  operUrl?: null | string;
  operatorType?: null | number;
  requestMethod?: null | string;
  status?: null | number;
  tenantId?: null | string;
  title?: null | string;
}

export interface OperLogQuery extends PageQuery {
  businessType?: number;
  businessTypes?: number[];
  operIp?: string;
  operName?: string;
  params?: DateRangeParams;
  status?: number;
  title?: string;
}
