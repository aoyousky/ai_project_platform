import type { DashboardWarning, LoginTrendItem } from '#/api/dashboard/types';

import { describe, expect, it } from 'vitest';

import {
  deptBarPercent,
  formatCount,
  formatLatency,
  formatShortDateTime,
  hasUsableTrend,
  healthServiceLabel,
  healthStatusLabel,
  isMetricVisible,
  loginStatusLabel,
  warningCodeFor,
} from './home-page-logic';

const sevenDays: LoginTrendItem[] = [
  { count: 142, date: '2026-11-02' },
  { count: 168, date: '2026-11-03' },
  { count: 153, date: '2026-11-04' },
  { count: 201, date: '2026-11-05' },
  { count: 187, date: '2026-11-06' },
  { count: 226, date: '2026-11-07' },
  { count: 213, date: '2026-11-08' },
];

describe('首页展示逻辑（SPEC-005 A-01 / A-02 / A-04 / A-12 / E-05）', () => {
  it('A-01：用户总数按千分位展示，0 与 null 语义分离', () => {
    expect(formatCount(1286)).toBe('1,286');
    expect(formatCount(48)).toBe('48');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(null)).toBe('—');
    expect(isMetricVisible(0)).toBe(true);
    expect(isMetricVisible(null)).toBe(false);
  });

  it('A-02：趋势必须恰好 7 项，刻度使用 MM-DD', () => {
    expect(hasUsableTrend(sevenDays)).toBe(true);
    expect(hasUsableTrend(sevenDays.slice(0, 6))).toBe(false);
    expect(hasUsableTrend(null)).toBe(false);
    expect(hasUsableTrend(null)).toBe(false);
    expect(sevenDays.map((item) => item.date.slice(5))).toEqual([
      '11-02',
      '11-03',
      '11-04',
      '11-05',
      '11-06',
      '11-07',
      '11-08',
    ]);
  });

  it('A-02：6 项趋势属于契约违规，前端进入错误态（E-17）', () => {
    expect(hasUsableTrend(sevenDays.slice(0, 6))).toBe(false);
  });

  it('A-04：健康状态与延迟文案', () => {
    expect(healthStatusLabel('DEGRADED')).toBe('部分服务状态未知');
    expect(healthStatusLabel('UP')).toBe('运行正常');
    expect(healthStatusLabel('DOWN')).toBe('服务异常');
    expect(healthStatusLabel('UNKNOWN')).toBe('状态未知');
    expect(healthServiceLabel('UNKNOWN')).toBe('未知');
    expect(formatLatency(null)).toBe('未测量');
    expect(formatLatency(0)).toBe('<1ms');
    expect(formatLatency(12)).toBe('12ms');
  });

  it('A-12：按字段定位 warning code', () => {
    const warnings: DashboardWarning[] = [
      { code: 'TIMEOUT', field: 'loginTrend' },
      { code: 'TIMEOUT', field: 'metrics.todayLoginTotal' },
    ];
    expect(warningCodeFor(warnings, 'loginTrend')).toBe('TIMEOUT');
    expect(warningCodeFor(warnings, 'metrics.todayLoginTotal')).toBe('TIMEOUT');
    expect(warningCodeFor(warnings, 'metrics.userTotal')).toBeUndefined();
  });

  it('时间展示统一为 Asia/Shanghai 的 MM-DD HH:mm', () => {
    expect(formatShortDateTime('2026-11-08T10:32:00+08:00')).toBe(
      '11-08 10:32',
    );
    expect(formatShortDateTime(null)).toBe('—');
  });

  it('E-05：部门条形宽度以 Top 1 为 100%，空集不出现 NaN', () => {
    expect(deptBarPercent(286, 286)).toBe(100);
    expect(deptBarPercent(98, 286)).toBe(34);
    expect(deptBarPercent(0, 0)).toBe(0);
  });

  it('登录状态枚举只来自契约', () => {
    expect(loginStatusLabel('SUCCESS')).toBe('成功');
    expect(loginStatusLabel('FAIL')).toBe('失败');
  });
});
