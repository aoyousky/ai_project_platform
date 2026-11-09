/**
 * 首页展示逻辑（SPEC-005 v1.4）。
 *
 * 页面只做装配；数字格式、空值语义、健康状态文案与 warning 定位在这里实现，
 * 便于在没有 UI 运行时的环境下做组件级验证。
 */
import type {
  DashboardWarning,
  DashboardWarningCode,
  HealthStatus,
  LoginTrendItem,
} from '#/api/dashboard/types';

/** `null` 表示无权限/不可用；`0` 是真实零值，必须显示 */
export function isMetricVisible(value: null | number | undefined): boolean {
  return value !== null && value !== undefined;
}

/** 千分位展示；null 用占位符而不是 0 */
export function formatCount(value: null | number | undefined): string {
  if (!isMetricVisible(value)) {
    return '—';
  }
  return String(Math.trunc(value as number)).replaceAll(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );
}

/** 契约要求恰好 7 项；6 项按 E-17 进入错误态 */
export function hasUsableTrend(
  trend: LoginTrendItem[] | null | undefined,
): trend is LoginTrendItem[] {
  return Array.isArray(trend) && trend.length === 7;
}

export function warningCodeFor(
  warnings: DashboardWarning[] | undefined,
  field: string,
): DashboardWarningCode | undefined {
  return warnings?.find((warning) => warning.field === field)?.code;
}

/** 健康总状态文案；A-04 的 DEGRADED 文案固定为“部分服务状态未知” */
export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  DEGRADED: '部分服务状态未知',
  DOWN: '服务异常',
  UNKNOWN: '状态未知',
  UP: '运行正常',
};

export function healthStatusLabel(status: HealthStatus): string {
  return HEALTH_STATUS_LABELS[status];
}

/** 服务行文案（“圆点 + 文本”，不只依赖颜色） */
export const HEALTH_SERVICE_LABELS: Record<HealthStatus, string> = {
  DEGRADED: '延迟',
  DOWN: '异常',
  UNKNOWN: '未知',
  UP: '正常',
};

export function healthServiceLabel(status: HealthStatus): string {
  return HEALTH_SERVICE_LABELS[status];
}

export function formatLatency(latencyMs: null | number): string {
  if (latencyMs === null) {
    return '未测量';
  }
  return latencyMs < 1 ? '<1ms' : `${latencyMs}ms`;
}

/** ISO8601（Asia/Shanghai）→ `MM-DD HH:mm`；null 表示未设置 */
export function formatShortDateTime(value: null | string): string {
  if (!value) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match
    ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}`
    : value;
}

/** 部门人数条：以最大值为 100%，空集返回 0，避免 NaN */
export function deptBarPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

export function loginStatusLabel(status: 'FAIL' | 'SUCCESS'): string {
  return status === 'SUCCESS' ? '成功' : '失败';
}

export function healthStatusColor(
  status: HealthStatus,
): 'error' | 'success' | 'warning' {
  if (status === 'UP') {
    return 'success';
  }
  if (status === 'DOWN') {
    return 'error';
  }
  return 'warning';
}

/** 当天登录数来自趋势末项；趋势超时/不可用时返回 null */
export function trendLastValue(
  trend: LoginTrendItem[] | null | undefined,
): null | number {
  return hasUsableTrend(trend) ? trend[trend.length - 1]!.count : null;
}
