<script setup lang="ts">
import type { OssConfig } from '#/api/system/oss/config-types';

import { useVbenModal } from '@vben/common-ui';
import { Page } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Switch, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  changeOssConfigStatusApi,
  delOssConfigApi,
  listOssConfigApi,
} from '#/api/system/oss/config';
import { createGridQuery } from '#/utils/system/grid';

import OssConfigForm from './components/oss-config-form.vue';
import {
  applyDefaultSwitch,
  buildOssConfigQuery,
  endpointDisplay,
  statusLabel,
} from './oss-config-page-logic';

const [OssConfigGrid, ossConfigGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入配置key' },
        fieldName: 'configKey',
        label: '配置key',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入桶名称' },
        fieldName: 'bucketName',
        label: '桶名称',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          options: [
            { label: '是', value: '0' },
            { label: '否', value: '1' },
          ],
          placeholder: '请选择',
        },
        fieldName: 'status',
        label: '是否默认',
      },
    ],
  },
  gridOptions: {
    columns: [
      {
        field: 'configKey',
        minWidth: 170,
        showOverflow: true,
        title: '配置key',
      },
      {
        field: 'accessKey',
        minWidth: 150,
        showOverflow: true,
        title: '访问密钥',
      },
      {
        field: 'bucketName',
        minWidth: 170,
        showOverflow: true,
        title: '桶名称',
      },
      {
        field: 'endpoint',
        minWidth: 220,
        slots: { default: 'endpoint' },
        title: '访问站点',
      },
      {
        field: 'accessPolicy',
        slots: { default: 'accessPolicy' },
        title: '桶权限类型',
        width: 110,
      },
      {
        field: 'isHttps',
        slots: { default: 'isHttps' },
        title: 'HTTPS',
        width: 90,
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '是否默认',
        width: 120,
      },
      {
        field: 'remark',
        minWidth: 120,
        showOverflow: true,
        title: '备注',
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
      ajax: {
        query: createGridQuery({
          buildQuery: (values, page) => buildOssConfigQuery(values, page),
          fetch: listOssConfigApi,
        }),
      },
    },
    rowConfig: { isHover: true, keyField: 'ossConfigId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [OssConfigFormModal, ossConfigFormModalApi] = useVbenModal({
  connectedComponent: OssConfigForm,
  destroyOnClose: true,
});

function openCreate() {
  ossConfigFormModalApi.setData({ mode: 'create' }).open();
}

function openEdit(row: any) {
  ossConfigFormModalApi
    .setData({ mode: 'edit', record: row as OssConfig })
    .open();
}

async function handleSuccess() {
  await ossConfigGridApi.reload();
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as OssConfig[];
  if (records.length === 0) {
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除文件配置「${records[0]?.configKey}」？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delOssConfigApi(records.map((row) => row.ossConfigId));
        message.success('删除成功');
        await ossConfigGridApi.reload();
      } catch {
        // 内置配置删除被后端拒绝：请求层已提示原文 msg，行保留（E-23）
      }
    },
    title: '删除确认',
  });
}

/** A-16：设为默认成功则其余置非默认；失败回滚开关并重载 */
async function handleSetDefault(row: any) {
  await applyDefaultSwitch(
    row as OssConfig,
    changeOssConfigStatusApi,
    () => ossConfigGridApi.reload(),
  );
}

/** A-13：切换默认配置先二次确认；取消后不发出 changeStatus 请求 */
function confirmSetDefault(row: any) {
  if (row.status === '0') {
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    content: `确认将「${row.configKey}」设为默认配置？`,
    okText: '确定',
    onOk: () => handleSetDefault(row),
    title: '设为默认确认',
  });
}

const ACCESS_POLICY_LABEL: Record<string, string> = {
  '0': '私有',
  '1': '公开',
  '2': '自定义',
};
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <OssConfigGrid>
        <template #toolbar-actions>
          <Button
            v-access:code="['system:ossConfig:add']"
            type="primary"
            @click="openCreate"
          >
            新增
          </Button>
        </template>

        <template #endpoint="{ row }">
          {{ endpointDisplay(row.endpoint, row.isHttps) }}
        </template>

        <template #accessPolicy="{ row }">
          <Tag>{{ ACCESS_POLICY_LABEL[row.accessPolicy] ?? row.accessPolicy }}</Tag>
        </template>

        <template #isHttps="{ row }">
          {{ row.isHttps === 'Y' ? '是' : '否' }}
        </template>

        <template #status="{ row }">
          <div class="flex items-center gap-2">
            <Switch
              v-access:code="['system:ossConfig:edit']"
              :checked="row.status === '0'"
              :disabled="row.status === '0'"
              @change="() => confirmSetDefault(row)"
            />
            <span>{{ statusLabel(row.status) }}</span>
          </div>
        </template>

        <template #operation="{ row }">
          <Button
            v-access:code="['system:ossConfig:edit']"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            修改
          </Button>
          <Button
            v-access:code="['system:ossConfig:remove']"
            size="small"
            type="link"
            @click="confirmDelete([row])"
          >
            删除
          </Button>
        </template>
      </OssConfigGrid>
    </div>

    <OssConfigFormModal @success="handleSuccess" />
  </Page>
</template>
