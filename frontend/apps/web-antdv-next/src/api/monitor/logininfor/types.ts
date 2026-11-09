import type { DateRangeParams, Id, PageQuery } from '#/api/system/common';

/** 登录日志（SPEC-004 §4.8）；tenantId 不展示 */
export interface Logininfor {
  browser?: null | string;
  clientKey?: null | string;
  deviceType?: null | string;
  infoId: Id;
  ipaddr?: null | string;
  loginLocation?: null | string;
  loginTime?: null | string;
  msg?: null | string;
  os?: null | string;
  status: string;
  tenantId?: null | string;
  userName?: null | string;
}

export interface LogininforQuery extends PageQuery {
  ipaddr?: string;
  params?: DateRangeParams;
  status?: string;
  userName?: string;
}
