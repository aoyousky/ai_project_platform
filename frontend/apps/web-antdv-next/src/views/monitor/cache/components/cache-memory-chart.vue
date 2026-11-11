<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { memoryGaugeOption } from '../cache-page-logic';

const props = defineProps<{
  info: Record<string, string | undefined>;
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function renderMemoryChart() {
  void renderEcharts(memoryGaugeOption(props.info));
}

onMounted(renderMemoryChart);
watch(
  () => props.info,
  () => renderMemoryChart(),
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" height="320px" />
</template>
