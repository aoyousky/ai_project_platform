<script setup lang="ts">
import type { Notice } from '#/api/system/notice/types';

import { watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Page } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delNoticeApi, getNoticeApi, listNoticeApi } from '#/api/system/notice';
import { useDict } from '#/composables/use-dict';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import NoticeForm from './components/notice-form.vue';
import {
  buildNoticeQuery,
  dictLabelOrValue,
  noticeStatusColor,
} from './notice-page-logic';

const { sys_notice_status: statusDict, sys_notice_type: typeDict } = useDict(
  'sys_notice_type',
  'sys_notice_status',
);

function dictOptions(
  list: Array<{ dictLabel?: null | string; dictValue?: null | string }>,
  fallback: Array<{ label: string; value: string }>,
) {
  const options = (list ?? [])
    .filter((item) => item.dictValue)
    .map((item) => ({
      label: String(item.dictLabel ?? item.dictValue),
      value: String(item.dictValue),
    }));
  return options.length > 0 ? options : fallback;
}

const [NoticeGrid, noticeGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入公告标题' },
        fieldName: 'noticeTitle',
        label: '公告标题',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入操作人员' },
        fieldName: 'createByName',
        label: '操作人员',
      },
      {
        component: 'Select' as const,
        componentProps: {
          allowClear: true,
          options: [
            { label: '通知', value: '1' },
            { label: '公告', value: '2' },
          ],
          placeholder: '请选择',
        },
        fieldName: 'noticeType',
        label: '公告类型',
      },
    ],
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'noticeTitle',
        minWidth: 220,
        showOverflow: true,
        title: '公告标题',
      },
      {
        field: 'noticeType',
        slots: { default: 'noticeType' },
        title: '公告类型',
        width: 100,
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '状态',
        width: 90,
      },
      {
        field: 'createByName',
        showOverflow: true,
        title: '创建者',
        width: 120,
      },
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
          const query = buildNoticeQuery(formValues ?? {}, page);
          const { rows, total } = await listNoticeApi(query);
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
          const corrected = await listNoticeApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'noticeId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

watch(
  typeDict,
  (list) => {
    noticeGridApi.formApi?.updateSchema([
      {
        componentProps: {
          options: dictOptions(list ?? [], [
            { label: '通知', value: '1' },
            { label: '公告', value: '2' },
          ]),
        },
        fieldName: 'noticeType',
      },
    ]);
  },
  { immediate: true },
);

const [NoticeFormModal, noticeFormModalApi] = useVbenModal({
  connectedComponent: NoticeForm,
  destroyOnClose: true,
});

function openCreate() {
  noticeFormModalApi.setData({ mode: 'create' }).open();
}

async function openEdit(row: Record<string, any>) {
  try {
    // A-04：编辑前读取详情（列表不保证返回正文）
    const detail = await getNoticeApi(row.noticeId);
    noticeFormModalApi.setData({ mode: 'edit', record: detail }).open();
  } catch {
    // 请求层已提示 msg，不打开空弹窗
  }
}

async function handleSuccess() {
  await noticeGridApi.reload();
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as Notice[];
  if (records.length === 0) {
    message.warning('请选择要删除的公告');
    return;
  }
  const ids = records.map((row) => row.noticeId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 条公告？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delNoticeApi(ids);
        message.success('删除成功');
        await noticeGridApi.reload();
      } catch {
        // 请求层已提示 msg；删除被拒时行保留
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  confirmDelete((noticeGridApi.grid.getCheckboxRecords?.() ?? []) as Notice[]);
}

function noticeTypeText(value?: null | string) {
  return dictLabelOrValue(typeDict.value, value);
}

function noticeStatusText(value?: null | string) {
  return dictLabelOrValue(statusDict.value, value) || String(value ?? '');
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <NoticeGrid>
        <template #toolbar-actions>
          <Button
            v-access:code="['system:notice:add']"
            type="primary"
            @click="openCreate"
          >
            新增
          </Button>
          <Button
            v-access:code="['system:notice:remove']"
            @click="handleBatchDelete"
          >
            删除
          </Button>
        </template>

        <template #noticeType="{ row }">
          <span>{{ noticeTypeText(row.noticeType) }}</span>
        </template>

        <template #status="{ row }">
          <Tag :color="noticeStatusColor(row.status)">
            {{ noticeStatusText(row.status) }}
          </Tag>
        </template>

        <template #operation="{ row }">
          <Button
            v-access:code="['system:notice:edit']"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            修改
          </Button>
          <Button
            v-access:code="['system:notice:remove']"
            size="small"
            type="link"
            @click="confirmDelete([row])"
          >
            删除
          </Button>
        </template>
      </NoticeGrid>
    </div>

    <NoticeFormModal @success="handleSuccess" />
  </Page>
</template>
