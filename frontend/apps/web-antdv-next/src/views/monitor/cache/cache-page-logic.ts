import type { ECOption } from '@vben/plugins/echarts';

import type { CacheCommandStat } from '#/api/monitor/cache/types';

/** `null`/`undefined`/空串显示「—」；真实 `0` 原样显示（SPEC-007 §4.2）。 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

/** `standalone` → 「单机」，其他非空 → 「集群」；缺键 → 「—」。 */
export function redisModeText(value: null | string | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value === 'standalone' ? '单机' : '集群';
}

/** `0` → 「否」，其他非空 → 「是」；缺键 → 「—」。 */
export function aofText(value: null | string | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value === '0' ? '否' : '是';
}

/** 可转数字保留两位小数；不可转回退原值；缺键 → 「—」。 */
export function cpuText(value: null | string | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : value;
}

/** 合并为 `{输入}kps/{输出}kps`；任一侧缺键时该侧显示「—」。 */
export function networkText(
  input: null | string | undefined,
  output: null | string | undefined,
): string {
  return `${displayValue(input)}kps/${displayValue(output)}kps`;
}

/** `value` 十进制字符串转 number，转换失败按 0；空数组返回空序列。 */
export function commandSeries(
  stats: CacheCommandStat[],
): Array<{ name: string; value: number }> {
  return stats.map(({ name, value }) => ({
    name,
    value: Number(value) || 0,
  }));
}

/**
 * 内存仪表盘：后端没有使用率来源，因此只呈现已用内存文本与固定量程弧线，
 * 不臆造百分比数值。共享的 `@vben/plugins/echarts` 未注册 GaugeChart，
 * 故用已注册的饼图绘制半环量程（扇区标签关闭），避免为一张图改动框架包。
 */
export function memoryGaugeOption(
  info: Record<string, string | undefined>,
): ECOption {
  const used = displayValue(info.used_memory_human);
  const max = displayValue(info.maxmemory_human);
  return {
    series: [
      {
        center: ['50%', '50%'],
        clockwise: false,
        data: [
          {
            itemStyle: { color: '#d9d9d9' },
            label: { show: false },
            name: '量程',
            value: 100,
          },
        ],
        endAngle: 0,
        label: { show: false },
        labelLine: { show: false },
        radius: ['70%', '85%'],
        silent: true,
        startAngle: 180,
        type: 'pie',
      },
    ],
    title: {
      left: 'center',
      subtext: `最大 ${max}`,
      subtextStyle: { fontSize: 12 },
      text: used,
      textStyle: { fontSize: 20, fontWeight: 600 },
      top: '40%',
    },
  } as unknown as ECOption;
}
