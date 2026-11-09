<script setup lang="ts">
import type { OperLog } from '#/api/monitor/operlog/types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { dictLabel, useDict } from '#/composables/use-dict';

import {
  displayValue,
  formatJsonOrRaw,
  toOperLogDetail,
} from '../operlog-page-logic';

const {
  sys_oper_type: operTypeDict,
  sys_operator_type: operatorTypeDict,
} = useDict('sys_oper_type', 'sys_operator_type');

const detail = ref<OperLog>();

const [Modal, modalApi] = useVbenModal({
  // A-05：只读详情，无确认/取消动作
  footer: false,
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    detail.value = toOperLogDetail(modalApi.getData<OperLog>() ?? { operId: '' });
    modalApi.setState({ title: '操作日志详情' });
  },
});

function businessTypeText(value?: null | number): string {
  const label = dictLabel(operTypeDict.value ?? [], value);
  return label || displayValue(value);
}

function operatorTypeText(value?: null | number): string {
  const label = dictLabel(operatorTypeDict.value ?? [], value);
  return label || displayValue(value);
}

function statusText(value?: null | number | string): string {
  if (value === 0 || value === '0') {
    return '成功';
  }
  if (value === 1 || value === '1') {
    return '失败';
  }
  return displayValue(value);
}

function statusColor(value?: null | number | string): string {
  if (value === 0 || value === '0') {
    return 'success';
  }
  if (value === 1 || value === '1') {
    return 'error';
  }
  return 'default';
}

/** 异常信息只展示首行，避免把后端堆栈带进页面 */
function errorText(value?: null | string): string {
  const text = displayValue(value);
  if (text === '—') {
    return text;
  }
  return text.split('\n')[0]?.trim() || '—';
}

const summaryItems = computed(() => {
  const row = detail.value;
  return [
    { label: '日志编号', value: displayValue(row?.operId) },
    { label: '系统模块', value: displayValue(row?.title) },
    { label: '操作类型', value: businessTypeText(row?.businessType) },
    { label: '操作类别', value: operatorTypeText(row?.operatorType) },
    { label: '请求方式', value: displayValue(row?.requestMethod) },
    { label: '方法名称', value: displayValue(row?.method) },
    { label: '操作人员', value: displayValue(row?.operName) },
    { label: '部门', value: displayValue(row?.deptName) },
    { label: '请求地址', value: displayValue(row?.operUrl) },
    { label: '操作地址', value: displayValue(row?.operIp) },
    { label: '操作地点', value: displayValue(row?.operLocation) },
    { label: '操作时间', value: displayValue(row?.operTime) },
    { label: '消耗时间', value: displayValue(row?.costTime) },
  ];
});

const requestParams = computed(() => formatJsonOrRaw(detail.value?.operParam));
const responseParams = computed(() => formatJsonOrRaw(detail.value?.jsonResult));
const errorMessage = computed(() => errorText(detail.value?.errorMsg));
</script>

<template>
  <Modal class="w-[760px]">
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-x-6 gap-y-3">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="flex gap-3 text-sm"
        >
          <span class="w-20 shrink-0 text-muted-foreground">{{ item.label }}</span>
          <span class="min-w-0 break-all">{{ item.value }}</span>
        </div>
        <div class="flex gap-3 text-sm">
          <span class="w-20 shrink-0 text-muted-foreground">操作状态</span>
          <Tag :color="statusColor(detail?.status)">
            {{ statusText(detail?.status) }}
          </Tag>
        </div>
      </div>

      <div class="space-y-1">
        <div class="text-sm font-medium">请求参数</div>
        <pre
          class="max-h-40 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
        >{{ requestParams }}</pre>
      </div>

      <div class="space-y-1">
        <div class="text-sm font-medium">返回参数</div>
        <pre
          class="max-h-40 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
        >{{ responseParams }}</pre>
      </div>

      <div v-if="errorMessage !== '—'" class="space-y-1">
        <div class="text-sm font-medium">异常信息</div>
        <pre
          class="max-h-24 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"
        >{{ errorMessage }}</pre>
      </div>
    </div>
  </Modal>
</template>
