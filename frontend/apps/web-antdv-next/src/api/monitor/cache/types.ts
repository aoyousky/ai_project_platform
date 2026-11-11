/** `GET /monitor/cache` 数据契约（SPEC-007 §4.2）。 */
export interface CacheCommandStat {
  /** 命令名，后端已去掉 `cmdstat_` 前缀 */
  name: string;
  /** 调用次数的十进制整数字符串 */
  value: string;
}

export interface CacheInfo {
  /** Redis INFO 属性名到字符串值的映射 */
  info: Record<string, string>;
  /** `null` 表示未知；`0` 是有效空库 */
  dbSize: null | number;
  commandStats: CacheCommandStat[];
}
