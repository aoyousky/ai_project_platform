<script setup lang="ts">
import type { Logininfor } from '#/api/monitor/logininfor/types';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cleanLogininforApi,
  delLogininforApi,
  exportLogininforApi,
  listLogininforApi,
  unlockLogininforApi,
} from '#/api/monitor/logininfor';
import { dictLabel, useDict } from '#/composables/use-dict';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import {
  buildLogininforQuery,
  canUnlock,
  unlockUserName,
} from './logininfor-page-logic';

const {
  sys_common_status: statusDict,
  sys_device_type: deviceTypeDict,
} = useDict('sys_common_status', 'sys_device_type');

const selectedRows = ref<Array<Partial<Logininfor>>>([]);

const [LogininforGrid, logininforGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入用户名称' },
        fieldName: 'userName',
        label: '用户名称',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入登录地址' },
        fieldName: 'ipaddr',
        label: '登录地址',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          options: [
            { label: '成功', value: '0' },
            { label: '失败', value: '1' },
          ],
          placeholder: '请选择',
        },
        fieldName: 'status',
        label: '登录状态',
      },
      {
        component: 'RangePicker' as const,
        componentProps: { valueFormat: 'YYYY-MM-DD' },
        fieldName: 'dateRange',
        label: '访问时间',
      },
    ],
  },
  gridEvents: {
    checkboxAll: () => syncSelection(),
    checkboxChange: () => syncSelection(),
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'infoId',
        minWidth: 180,
        showOverflow: true,
        title: '访问编号',
      },
      {
        field: 'userName',
        minWidth: 120,
        showOverflow: true,
        sortable: true,
        title: '用户名称',
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
        field: 'ipaddr',
        minWidth: 120,
        showOverflow: true,
        title: '登录地址',
      },
      {
        field: 'loginLocation',
        minWidth: 120,
        showOverflow: true,
        title: '登录地点',
      },
      {
        field: 'os',
        minWidth: 110,
        showOverflow: true,
        title: '操作系统',
      },
      {
        field: 'browser',
        minWidth: 110,
        showOverflow: true,
        title: '浏览器',
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '登录状态',
        width: 90,
      },
      {
        field: 'msg',
        minWidth: 140,
        showOverflow: true,
        title: '描述',
      },
      {
        field: 'loginTime',
        minWidth: 160,
        sortable: true,
        title: '访问时间',
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      sort: true,
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          // 列表重载会清空 vxe 勾选记录；同步清空按钮可用性状态
          selectedRows.value = [];
          const page = params.page;
          const query = buildLogininforQuery(
            formValues ?? {},
            page,
            params.sort ?? undefined,
          );
          const { rows, total } = await listLogininforApi(query);
          // E-13：页码越界时回退到有效页，避免空页/NaN
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await listLogininforApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'infoId' },
    sortConfig: { remote: true, trigger: 'cell' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

function syncSelection() {
  selectedRows.value = (logininforGridApi.grid.getCheckboxRecords?.() ??
    []) as Array<Partial<Logininfor>>;
}

function deviceTypeText(value?: null | string): string {
  return dictLabel(deviceTypeDict.value ?? [], value) || String(value ?? '');
}

function statusText(value?: null | string): string {
  return dictLabel(statusDict.value ?? [], value) || String(value ?? '');
}

function statusColor(value?: null | string): string {
  return value === '0' ? 'success' : 'error';
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as Logininfor[];
  if (records.length === 0) {
    message.warning('请选择要删除的日志');
    return;
  }
  const ids = records.map((row) => row.infoId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 条日志？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delLogininforApi(ids);
        message.success('删除成功');
        await logininforGridApi.reload();
        selectedRows.value = [];
      } catch {
        // 请求层已提示 msg；删除被拒时行保留
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  confirmDelete(
    (logininforGridApi.grid.getCheckboxRecords?.() ?? []) as Logininfor[],
  );
}

function confirmClean() {
  AntModal.confirm({
    cancelText: '取消',
    content: '确认清空全部登录日志？此操作不可恢复。',
    okText: '确定',
    onOk: async () => {
      try {
        await cleanLogininforApi();
        message.success('清空成功');
        await logininforGridApi.reload();
        selectedRows.value = [];
      } catch {
        // 请求层已提示 msg；清空被拒时列表保持
      }
    },
    title: '清空确认',
  });
}

function handleUnlock() {
  const userName = unlockUserName(selectedRows.value);
  if (!userName) {
    // E-16：非单选状态下不发出解锁请求
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    content: `确认解锁用户 ${userName}？`,
    okText: '确定',
    onOk: async () => {
      try {
        await unlockLogininforApi(userName);
        message.success('解锁成功');
        await logininforGridApi.reload();
      } catch {
        // 请求层已提示 msg；列表保持
      }
    },
    title: '解锁确认',
  });
}

async function handleExport() {
  const formValues =
    ((await logininforGridApi.formApi?.getValues?.()) ??
      {}) as Record<string, any>;
  const query = buildLogininforQuery(formValues);
  try {
    await exportLogininforApi(query);
  } catch (error) {
    // E-15：后端以 HTTP 200 + JSON 错误体返回，展示 msg 原文，不保存损坏文件
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <LogininforGrid>
        <template #toolbar-actions>
          <Button
            v-access:code="['monitor:logininfor:remove']"
            @click="handleBatchDelete"
          >
            删除
          </Button>
          <Button
            v-access:code="['monitor:logininfor:remove']"
            @click="confirmClean"
          >
            清空
          </Button>
          <Button
            v-access:code="['monitor:logininfor:export']"
            @click="handleExport"
          >
            导出
          </Button>
          <Button
            v-access:code="['monitor:logininfor:unlock']"
            :disabled="!canUnlock(selectedRows)"
            @click="handleUnlock"
          >
            解锁
          </Button>
        </template>

        <template #deviceType="{ row }">
          <span>{{ deviceTypeText(row.deviceType) }}</span>
        </template>

        <template #status="{ row }">
          <Tag :color="statusColor(row.status)">
            {{ statusText(row.status) }}
          </Tag>
        </template>
      </LogininforGrid>
    </div>
  </Page>
</template>
