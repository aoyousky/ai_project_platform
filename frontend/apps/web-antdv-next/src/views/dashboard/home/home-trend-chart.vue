<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { LoginTrendItem } from '#/api/dashboard/types';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = defineProps<{
  items: LoginTrendItem[];
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

/** ECharts canvas 不解析 CSS 变量，渲染时读取 Vben 主题令牌 */
function primaryColor(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim();
  return value ? `hsl(${value})` : '#1677ff';
}

function render() {
  const labels = props.items.map((item) => item.date.slice(5));
  const values = props.items.map((item) => item.count);
  const lastIndex = values.length - 1;

  renderEcharts({
    animation: false,
    aria: { enabled: true },
    color: [primaryColor()],
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 16,
      top: 16,
    },
    series: [
      {
        areaStyle: { opacity: 0.12 },
        data: values,
        endLabel: {
          formatter: (params: { value?: unknown }) => String(params.value ?? 0),
          show: lastIndex >= 0,
        },
        itemStyle: { color: primaryColor() },
        label: { show: false },
        lineStyle: { width: 2 },
        smooth: false,
        symbol: 'circle',
        symbolSize: 8,
        type: 'line',
      },
    ],
    tooltip: {
      axisPointer: { type: 'line' },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { interval: 0 },
      axisTick: { show: true },
      boundaryGap: false,
      data: labels,
      type: 'category',
    },
    yAxis: {
      min: 0,
      splitNumber: 4,
      type: 'value',
    },
  });
}

onMounted(render);
watch(() => props.items, render, { deep: true });
</script>

<template>
  <EchartsUI ref="chartRef" height="260px" />
</template>
