<script setup lang="ts">
import type { Config } from '#/api/system/config/types';

import { useVbenModal } from '@vben/common-ui';
import { Page } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  delConfigApi,
  exportConfigApi,
  listConfigApi,
  refreshConfigCacheApi,
} from '#/api/system/config';
import { clearDictCache } from '#/composables/use-dict';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import ConfigForm from './components/config-form.vue';
import {
  buildConfigQuery,
  configTypeInfo,
  refreshConfigCache,
} from './config-page-logic';

const [ConfigGrid, configGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入参数名称' },
        fieldName: 'configName',
        label: '参数名称',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入参数键名' },
        fieldName: 'configKey',
        label: '参数键名',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          options: [
            { label: '是', value: 'Y' },
            { label: '否', value: 'N' },
          ],
          placeholder: '请选择',
        },
        fieldName: 'configType',
        label: '系统内置',
      },
      {
        component: 'RangePicker' as const,
        componentProps: { valueFormat: 'YYYY-MM-DD' },
        fieldName: 'dateRange',
        label: '创建时间',
      },
    ],
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'configName', minWidth: 140, showOverflow: true, title: '参数名称' },
      { field: 'configKey', minWidth: 160, showOverflow: true, title: '参数键名' },
      { field: 'configValue', minWidth: 140, showOverflow: true, title: '参数键值' },
      {
        field: 'configType',
        slots: { default: 'configType' },
        title: '系统内置',
        width: 90,
      },
      { field: 'remark', minWidth: 120, showOverflow: true, title: '备注' },
      { field: 'createTime', minWidth: 160, title: '创建时间' },
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
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          const page = params.page;
          const query = buildConfigQuery(formValues ?? {}, page);
          const { rows, total } = await listConfigApi(query);
          // E-25：页码越界时回退到最后一页
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await listConfigApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'configId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [ConfigFormModal, configFormModalApi] = useVbenModal({
  connectedComponent: ConfigForm,
  destroyOnClose: true,
});

function openCreate() {
  configFormModalApi.setData({ mode: 'create' }).open();
}

function openEdit(row: any) {
  configFormModalApi
    .setData({ mode: 'edit', record: row as Config })
    .open();
}

async function handleSuccess() {
  await configGridApi.reload();
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as Config[];
  if (records.length === 0) {
    message.warning('请选择要删除的参数');
    return;
  }
  const ids = records.map((row) => row.configId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 条参数？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delConfigApi(ids);
        message.success('删除成功');
        await configGridApi.reload();
      } catch {
        // 内置参数删除被后端拒绝：请求层已提示 msg，行保留（E-08）
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  confirmDelete((configGridApi.grid.getCheckboxRecords?.() ?? []) as Config[]);
}

function handleRefreshCache() {
  AntModal.confirm({
    cancelText: '取消',
    content: '确认刷新参数缓存？',
    okText: '确定',
    onOk: async () => {
      try {
        await refreshConfigCache(refreshConfigCacheApi, clearDictCache);
        message.success('刷新缓存成功');
      } catch {
        // 请求层已提示 msg；刷新失败时不清空会话缓存
      }
    },
    title: '刷新缓存确认',
  });
}

async function handleExport() {
  const formValues = (await configGridApi.formApi.getValues()) as Record<
    string,
    any
  >;
  try {
    await exportConfigApi(buildConfigQuery(formValues));
  } catch (error) {
    // downloadBlob 在 HTTP 200 + JSON 错误体时抛出 Error(msg)，请求层不会弹提示
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <ConfigGrid>
        <template #toolbar-actions>
          <Button
            v-access:code="['system:config:add']"
            type="primary"
            @click="openCreate"
          >
            新增
          </Button>
          <Button
            v-access:code="['system:config:remove']"
            @click="handleBatchDelete"
          >
            删除
          </Button>
          <Button
            v-access:code="['system:config:export']"
            @click="handleExport"
          >
            导出
          </Button>
          <Button
            v-access:code="['system:config:remove']"
            @click="handleRefreshCache"
          >
            刷新缓存
          </Button>
        </template>

        <template #configType="{ row }">
          <Tag
            v-if="row.configType"
            :color="configTypeInfo(row.configType).color"
          >
            {{ configTypeInfo(row.configType).label }}
          </Tag>
        </template>

        <template #operation="{ row }">
          <Button
            v-access:code="['system:config:edit']"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            修改
          </Button>
          <Button
            v-access:code="['system:config:remove']"
            size="small"
            type="link"
            @click="confirmDelete([row])"
          >
            删除
          </Button>
        </template>
      </ConfigGrid>
    </div>

    <ConfigFormModal @success="handleSuccess" />
  </Page>
</template>
