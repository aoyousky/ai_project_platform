<script setup lang="ts">
import type { UserOnline } from '#/api/monitor/online/types';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { Modal as AntModal, Button, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { forceLogoutOnlineApi, listOnlineApi } from '#/api/monitor/online';
import { dictLabel, useDict } from '#/composables/use-dict';
import { hasCodeAccess } from '#/directives/access';

import {
  buildOnlineQuery,
  displayValue,
  formatLoginTime,
  loadCachedRows,
  paginateRows,
  runBatchLogout,
  summarizeBatchResult,
} from './online-page-logic';

const PAGE_SIZE = 10;

const { sys_device_type: deviceTypeDict } = useDict('sys_device_type');
const accessStore = useAccessStore();

const selectedRows = ref<UserOnline[]>([]);
const isBatchLoggingOut = ref(false);
const batchConfirmOpen = ref(false);
const batchTargets = ref<UserOnline[]>([]);
// 同一筛选条件缓存全量行：翻页只做本地切片，不再请求 `GET /monitor/online/list`（E-04）。
const rowCache = new Map<string, UserOnline[]>();

const canForceLogout = computed(() =>
  hasCodeAccess(accessStore.accessCodes, ['monitor:online:forceLogout']),
);
// 批量按钮要求两个权限码同时具备；`hasCodeAccess` 是 OR 语义，不能直接传数组。
const canBatchLogout = computed(
  () =>
    canForceLogout.value &&
    hasCodeAccess(accessStore.accessCodes, ['monitor:online:batchLogout']),
);

async function queryOnline(params: any, formValues: Record<string, any>) {
  const query = buildOnlineQuery(formValues ?? {});
  const key = JSON.stringify(query);
  const response = await listOnlineApi(query);
  const rows = await loadCachedRows(
    rowCache,
    key,
    async () => response.rows ?? [],
  );
  const page = params?.page?.currentPage ?? 1;
  const pageSize = params?.page?.pageSize ?? PAGE_SIZE;
  return {
    items: paginateRows(rows, page, pageSize),
    total: rows.length,
  };
}

function invalidateCache() {
  rowCache.clear();
}

const [OnlineGrid, onlineGridApi] = useVbenVxeGrid<UserOnline>({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入登录地址' },
        fieldName: 'ipaddr',
        label: '登录地址',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入登录名称' },
        fieldName: 'userName',
        label: '登录名称',
      },
    ],
  },
  gridEvents: {
    checkboxAll: (params: any) => {
      selectedRows.value = (params.records ?? []) as UserOnline[];
    },
    checkboxChange: (params: any) => {
      selectedRows.value = (params.records ?? []) as UserOnline[];
    },
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'tokenId',
        minWidth: 160,
        showOverflow: true,
        title: '会话编号',
      },
      {
        field: 'userName',
        minWidth: 120,
        showOverflow: true,
        title: '登录名称',
      },
      {
        field: 'clientKey',
        minWidth: 100,
        showOverflow: true,
        title: '客户端',
      },
      {
        field: 'deviceType',
        slots: { default: 'deviceType' },
        title: '设备类型',
        width: 100,
      },
      {
        field: 'deptName',
        minWidth: 120,
        showOverflow: true,
        title: '所属部门',
      },
      {
        field: 'ipaddr',
        minWidth: 120,
        showOverflow: true,
        title: '主机',
      },
      {
        field: 'loginLocation',
        minWidth: 120,
        showOverflow: true,
        title: '登录地点',
      },
      {
        field: 'os',
        minWidth: 120,
        showOverflow: true,
        title: '操作系统',
      },
      {
        field: 'browser',
        minWidth: 120,
        showOverflow: true,
        title: '浏览器',
      },
      {
        field: 'loginTime',
        slots: { default: 'loginTime' },
        title: '登录时间',
        width: 170,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 100,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    pagerConfig: {
      enabled: true,
      pageSize: PAGE_SIZE,
      pageSizes: [10, 20, 50],
    },
    proxyConfig: {
      ajax: {
        query: queryOnline,
      },
    },
    rowConfig: { isHover: true, keyField: 'tokenId' },
    toolbarConfig: { refresh: false, search: false, zoom: true },
  },
});

function deviceTypeDisplay(row: UserOnline): string {
  return (
    dictLabel(deviceTypeDict.value, row.deviceType) ||
    displayValue(row.deviceType)
  );
}

async function loadRows() {
  invalidateCache();
  await onlineGridApi.reload();
}

async function refreshRows() {
  invalidateCache();
  selectedRows.value = [];
  await onlineGridApi.reload();
}

function handleSingleLogout(row: UserOnline) {
  AntModal.confirm({
    cancelText: '取消',
    content: `确认强退用户「${displayValue(row.userName)}」的会话？`,
    okText: '确定',
    onOk: async () => {
      try {
        await forceLogoutOnlineApi(row.tokenId);
        message.success('强退成功');
        await loadRows();
      } catch {
        // 请求层已提示 msg；失败时行保留
      }
    },
    title: '强退确认',
  });
}

function handleBatchLogout() {
  if (selectedRows.value.length === 0 || isBatchLoggingOut.value) {
    return;
  }
  batchTargets.value = [...selectedRows.value];
  batchConfirmOpen.value = true;
}

async function confirmBatchLogout() {
  if (isBatchLoggingOut.value) {
    return;
  }
  isBatchLoggingOut.value = true;
  try {
    const result = await runBatchLogout(
      batchTargets.value.map((row) => row.tokenId),
      forceLogoutOnlineApi,
    );
    const summary = summarizeBatchResult(result.successCount, result.failures);
    if (result.failures.length === 0) {
      message.success(summary);
    } else {
      message.warning(summary);
    }
    batchConfirmOpen.value = false;
    await loadRows();
  } finally {
    isBatchLoggingOut.value = false;
  }
}

onMounted(() => {
  void nextTick(() => onlineGridApi.query());
});
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full flex-col gap-2">
      <OnlineGrid>
        <template #toolbar-actions>
          <Button @click="refreshRows">刷新</Button>
          <Button
            v-if="canBatchLogout"
            :disabled="selectedRows.length === 0 || isBatchLoggingOut"
            data-testid="online-batch-logout"
            @click="handleBatchLogout"
          >
            批量强退
          </Button>
        </template>

        <template #deviceType="{ row }">
          <span>{{ deviceTypeDisplay(row) }}</span>
        </template>

        <template #loginTime="{ row }">
          <span>{{ formatLoginTime(row.loginTime) }}</span>
        </template>

        <template #operation="{ row }">
          <Button
            v-if="canForceLogout"
            data-testid="online-force-logout"
            size="small"
            type="link"
            @click="handleSingleLogout(row)"
          >
            强退
          </Button>
        </template>
      </OnlineGrid>
    </div>

    <Modal
      cancel-text="取消"
      :confirm-loading="isBatchLoggingOut"
      :ok-button-props="{ disabled: isBatchLoggingOut }"
      ok-text="确定"
      :open="batchConfirmOpen"
      title="批量强退确认"
      @cancel="batchConfirmOpen = false"
      @ok="confirmBatchLogout"
    >
      确认强退选中的 {{ batchTargets.length }} 个会话？
    </Modal>
  </Page>
</template>
