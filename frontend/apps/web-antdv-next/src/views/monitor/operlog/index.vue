<script setup lang="ts">
import type { OperLog } from '#/api/monitor/operlog/types';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cleanOperLogApi,
  delOperLogApi,
  exportOperLogApi,
  listOperLogApi,
} from '#/api/monitor/operlog';
import { dictLabel, useDict } from '#/composables/use-dict';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import OperLogDetail from './components/operlog-detail-modal.vue';
import {
  buildOperLogQuery,
  displayValue,
} from './operlog-page-logic';

const { sys_oper_type: operTypeDict } = useDict('sys_oper_type');

const [OperLogGrid, operLogGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入系统模块' },
        fieldName: 'title',
        label: '系统模块',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入操作人员' },
        fieldName: 'operName',
        label: '操作人员',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入操作地址' },
        fieldName: 'operIp',
        label: '操作地址',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          mode: 'multiple',
          options: [
            { label: '新增', value: '1' },
            { label: '修改', value: '2' },
            { label: '删除', value: '3' },
            { label: '导出', value: '5' },
          ],
          placeholder: '请选择',
        },
        fieldName: 'businessTypes',
        label: '操作类型',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          options: [
            { label: '成功', value: 0 },
            { label: '失败', value: 1 },
          ],
          placeholder: '请选择',
        },
        fieldName: 'status',
        label: '操作状态',
      },
      {
        component: 'RangePicker' as const,
        componentProps: { valueFormat: 'YYYY-MM-DD' },
        fieldName: 'dateRange',
        label: '操作时间',
      },
    ],
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'operId',
        minWidth: 180,
        showOverflow: true,
        title: '日志编号',
      },
      {
        field: 'title',
        minWidth: 140,
        showOverflow: true,
        title: '系统模块',
      },
      {
        field: 'businessType',
        slots: { default: 'businessType' },
        title: '操作类型',
        width: 100,
      },
      {
        field: 'requestMethod',
        title: '请求方式',
        width: 90,
      },
      {
        field: 'operName',
        minWidth: 120,
        showOverflow: true,
        sortable: true,
        title: '操作人员',
      },
      {
        field: 'operIp',
        minWidth: 120,
        showOverflow: true,
        title: '操作地址',
      },
      {
        field: 'operLocation',
        minWidth: 120,
        showOverflow: true,
        title: '操作地点',
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '操作状态',
        width: 90,
      },
      {
        field: 'operTime',
        minWidth: 160,
        sortable: true,
        title: '操作时间',
      },
      {
        field: 'costTime',
        slots: { default: 'costTime' },
        sortable: true,
        title: '消耗时间',
        width: 100,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 140,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      sort: true,
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          const page = params.page;
          const query = buildOperLogQuery(
            formValues ?? {},
            page,
            params.sort ?? undefined,
          );
          const { rows, total } = await listOperLogApi(query);
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
          const corrected = await listOperLogApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'operId' },
    sortConfig: { remote: true, trigger: 'cell' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [OperLogDetailModal, operLogDetailModalApi] = useVbenModal({
  connectedComponent: OperLogDetail,
  destroyOnClose: true,
});

function businessTypeText(value?: null | number): string {
  return dictLabel(operTypeDict.value ?? [], value) || displayValue(value);
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

function openDetail(row: Record<string, any>) {
  operLogDetailModalApi.setData(row as OperLog).open();
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as OperLog[];
  if (records.length === 0) {
    message.warning('请选择要删除的日志');
    return;
  }
  const ids = records.map((row) => row.operId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 条日志？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delOperLogApi(ids);
        message.success('删除成功');
        await operLogGridApi.reload();
      } catch {
        // 请求层已提示 msg；删除被拒时行保留
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  confirmDelete(
    (operLogGridApi.grid.getCheckboxRecords?.() ?? []) as OperLog[],
  );
}

function confirmClean() {
  AntModal.confirm({
    cancelText: '取消',
    content: '确认清空全部操作日志？此操作不可恢复。',
    okText: '确定',
    onOk: async () => {
      try {
        await cleanOperLogApi();
        message.success('清空成功');
        await operLogGridApi.reload();
      } catch {
        // 请求层已提示 msg；清空被拒时列表保持
      }
    },
    title: '清空确认',
  });
}

async function handleExport() {
  const formValues =
    ((await operLogGridApi.formApi?.getValues?.()) ?? {}) as Record<string, any>;
  const query = buildOperLogQuery(formValues);
  try {
    await exportOperLogApi(query);
  } catch (error) {
    // E-15：后端以 HTTP 200 + JSON 错误体返回，展示 msg 原文，不保存损坏文件
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <OperLogGrid>
        <template #toolbar-actions>
          <Button
            v-access:code="['monitor:operlog:remove']"
            @click="handleBatchDelete"
          >
            删除
          </Button>
          <Button
            v-access:code="['monitor:operlog:remove']"
            @click="confirmClean"
          >
            清空
          </Button>
          <Button
            v-access:code="['monitor:operlog:export']"
            @click="handleExport"
          >
            导出
          </Button>
        </template>

        <template #businessType="{ row }">
          <span>{{ businessTypeText(row.businessType) }}</span>
        </template>

        <template #status="{ row }">
          <Tag :color="statusColor(row.status)">
            {{ statusText(row.status) }}
          </Tag>
        </template>

        <template #costTime="{ row }">
          <span>{{ displayValue(row.costTime) }}</span>
        </template>

        <template #operation="{ row }">
          <Button
            v-access:code="['monitor:operlog:query']"
            size="small"
            type="link"
            @click="openDetail(row)"
          >
            详情
          </Button>
          <Button
            v-access:code="['monitor:operlog:remove']"
            size="small"
            type="link"
            @click="confirmDelete([row])"
          >
            删除
          </Button>
        </template>
      </OperLogGrid>
    </div>

    <OperLogDetailModal />
  </Page>
</template>
