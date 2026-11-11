/**
 * 在线会话（SPEC-007 §4.1）。
 * `loginTime` 为 epoch 毫秒；其余文本字段可能为 null，展示层统一回退「—」。
 */
export interface UserOnline {
  browser: null | string;
  clientKey: null | string;
  deptName: null | string;
  deviceType: null | string;
  ipaddr: null | string;
  loginLocation: null | string;
  loginTime: number;
  os: null | string;
  tokenId: string;
  userName: null | string;
}

/** 服务端不支持分页；两个条件均精确等值，空串表示不过滤 */
export interface OnlineQuery {
  ipaddr?: string;
  userName?: string;
}
