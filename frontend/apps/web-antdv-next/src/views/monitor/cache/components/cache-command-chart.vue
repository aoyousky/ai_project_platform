<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = defineProps<{
  series: Array<{ name: string; value: number }>;
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function renderCommandChart() {
  if (props.series.length === 0) {
    return;
  }
  void renderEcharts({
    legend: {
      bottom: 0,
      left: 'center',
    },
    series: [
      {
        data: props.series,
        label: { show: false },
        name: '命令统计',
        radius: ['40%', '65%'],
        type: 'pie',
      },
    ],
    tooltip: {
      trigger: 'item',
    },
  });
}

onMounted(renderCommandChart);
watch(
  () => props.series,
  () => renderCommandChart(),
  { deep: true },
);
</script>

<template>
  <div v-if="series.length > 0" class="h-full">
    <EchartsUI ref="chartRef" height="320px" />
  </div>
  <div v-else class="flex h-80 items-center justify-center text-gray-400">
    暂无数据
  </div>
</template>
