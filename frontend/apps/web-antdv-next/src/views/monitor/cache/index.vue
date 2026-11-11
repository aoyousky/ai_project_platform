<script setup lang="ts">
import type { CacheInfo } from '#/api/monitor/cache/types';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Card } from 'antdv-next';

import { getCacheInfoApi } from '#/api/monitor/cache';
import { resolveErrorMessage } from '#/api/request';

import {
  aofText,
  commandSeries,
  cpuText,
  displayValue,
  networkText,
  redisModeText,
} from './cache-page-logic';
import CacheCommandChart from './components/cache-command-chart.vue';
import CacheMemoryChart from './components/cache-memory-chart.vue';

interface CacheInfoItem {
  key: string;
  label: string;
  testId: string;
  value: string;
}

const data = ref<CacheInfo | null>(null);
const errorMessage = ref('');
const loading = ref(true);

const infoItems = computed<CacheInfoItem[]>(() => {
  const info = data.value?.info ?? {};
  return [
    {
      key: 'redis_version',
      label: 'Redis版本',
      testId: 'cache-field-redis_version',
      value: displayValue(info.redis_version),
    },
    {
      key: 'redis_mode',
      label: '运行模式',
      testId: 'cache-field-redis_mode',
      value: redisModeText(info.redis_mode),
    },
    {
      key: 'tcp_port',
      label: '端口',
      testId: 'cache-field-tcp_port',
      value: displayValue(info.tcp_port),
    },
    {
      key: 'connected_clients',
      label: '客户端数',
      testId: 'cache-field-connected_clients',
      value: displayValue(info.connected_clients),
    },
    {
      key: 'uptime_in_days',
      label: '运行时间(天)',
      testId: 'cache-field-uptime_in_days',
      value: displayValue(info.uptime_in_days),
    },
    {
      key: 'used_memory_human',
      label: '使用内存',
      testId: 'cache-field-used_memory_human',
      value: displayValue(info.used_memory_human),
    },
    {
      key: 'used_cpu_user_children',
      label: '使用CPU',
      testId: 'cache-field-used_cpu_user_children',
      value: cpuText(info.used_cpu_user_children),
    },
    {
      key: 'maxmemory_human',
      label: '内存配置',
      testId: 'cache-field-maxmemory_human',
      value: displayValue(info.maxmemory_human),
    },
    {
      key: 'aof_enabled',
      label: 'AOF是否开启',
      testId: 'cache-field-aof_enabled',
      value: aofText(info.aof_enabled),
    },
    {
      key: 'rdb_last_bgsave_status',
      label: 'RDB是否成功',
      testId: 'cache-field-rdb_last_bgsave_status',
      value: displayValue(info.rdb_last_bgsave_status),
    },
    {
      key: 'dbSize',
      label: 'Key数量',
      testId: 'cache-db-size',
      value: displayValue(data.value?.dbSize),
    },
    {
      key: 'network',
      label: '网络入口/出口',
      testId: 'cache-field-network',
      value: networkText(
        info.instantaneous_input_kbps,
        info.instantaneous_output_kbps,
      ),
    },
  ];
});

const commandSeriesData = computed(() =>
  commandSeries(data.value?.commandStats ?? []),
);

async function loadCache() {
  loading.value = true;
  errorMessage.value = '';
  try {
    data.value = await getCacheInfoApi();
  } catch (error) {
    // SPEC-007 E-09：失败只展示后端 msg 原文，不残留信息表与图表。
    errorMessage.value = resolveErrorMessage(error);
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadCache);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full flex-col gap-3">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
      />

      <Card v-else-if="loading" class="flex-1">
        <div class="text-gray-400">加载中…</div>
      </Card>

      <template v-else-if="data">
        <Card class="flex-1" title="基本信息">
          <div
            class="grid grid-cols-2 gap-3 md:grid-cols-3"
            data-testid="cache-info-table"
          >
            <div
              v-for="item in infoItems"
              :key="item.key"
              class="rounded border border-gray-200 p-3"
            >
              <div class="text-sm text-gray-500">{{ item.label }}</div>
              <div
                :data-testid="item.testId"
                class="mt-1 break-all font-medium"
              >
                {{ item.value }}
              </div>
            </div>
          </div>
        </Card>

        <div class="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          <Card title="命令统计">
            <div data-testid="cache-command-chart">
              <CacheCommandChart :series="commandSeriesData" />
            </div>
          </Card>
          <Card title="内存信息">
            <div data-testid="cache-memory-chart">
              <CacheMemoryChart :info="data.info" />
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>
