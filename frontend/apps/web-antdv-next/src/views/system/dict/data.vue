<script setup lang="ts">
import type { DictData } from '#/api/system/dict/types';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { resolveErrorMessage } from '#/api/request';
import {
  deleteDictDataApi,
  exportDictDataApi,
  getDictDataListApi,
  getDictTypeApi,
} from '#/api/system/dict';
import { createGridQuery } from '#/utils/system/grid';

import DictDataForm from './components/dict-data-form.vue';
import {
  buildDictDataQuery,
  listClassInfo,
  resolveDictDataPageContext,
} from './dict-page-logic';

const route = useRoute();
const router = useRouter();

const dictId = computed(() => {
  const raw = route.params.dictId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? '');
});

const pageContext = ref<null | { dictId: string; dictType: string }>(null);
const loadError = ref('');

const panelTitle = computed(() =>
  pageContext.value
    ? `字典数据：${pageContext.value.dictType}`
    : '字典数据',
);

const [DataGrid, dataGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入字典标签' },
        fieldName: 'dictLabel',
        label: '字典标签',
      },
    ],
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'dictLabel',
        minWidth: 140,
        showOverflow: true,
        title: '字典标签',
      },
      {
        field: 'dictValue',
        minWidth: 140,
        showOverflow: true,
        title: '字典键值',
      },
      { field: 'dictSort', title: '字典排序', width: 90 },
      {
        field: 'listClass',
        slots: { default: 'listClass' },
        title: '回显样式',
        width: 100,
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
        query: createGridQuery({
          beforeQuery: () => pageContext.value !== null,
          buildQuery: (values, page) =>
            buildDictDataQuery(
              values,
              page,
              pageContext.value?.dictType ?? '',
            ),
          fetch: getDictDataListApi,
        }),
      },
    },
    rowConfig: { isHover: true, keyField: 'dictCode' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [DataFormModal, dataFormModalApi] = useVbenModal({
  connectedComponent: DictDataForm,
  destroyOnClose: true,
});

async function loadContext() {
  loadError.value = '';
  if (!dictId.value) {
    pageContext.value = null;
    loadError.value = '字典类型不存在';
    return;
  }

  try {
    // A-02：先按 dictId 取回 dictType，再查询字典数据
    const type = await getDictTypeApi(dictId.value);
    pageContext.value = resolveDictDataPageContext(type);
    if (!pageContext.value) {
      loadError.value = '字典类型不存在';
      return;
    }
    await dataGridApi.reload();
  } catch (error) {
    pageContext.value = null;
    loadError.value = resolveErrorMessage(error) || '字典类型不存在';
  }
}

function openCreate() {
  if (!pageContext.value) {
    return;
  }
  dataFormModalApi
    .setData({
      dictType: pageContext.value.dictType,
      mode: 'create',
    })
    .open();
}

function openEdit(row: any) {
  const record = row as DictData;
  dataFormModalApi
    .setData({
      dictType: record.dictType,
      mode: 'edit',
      record,
    })
    .open();
}

async function handleSuccess() {
  await dataGridApi.reload();
}

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as DictData[];
  if (records.length === 0) {
    message.warning('请选择要删除的字典数据');
    return;
  }
  const ids = records.map((row) => row.dictCode);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 条字典数据？`,
    okText: '确定',
    onOk: async () => {
      try {
        await deleteDictDataApi(ids);
        message.success('删除成功');
        await dataGridApi.reload();
      } catch {
        // 请求层已提示 msg，列表保持不变
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  const rows = (dataGridApi.grid.getCheckboxRecords?.() ?? []) as DictData[];
  confirmDelete(rows);
}

async function handleExport() {
  if (!pageContext.value) {
    return;
  }
  const formValues = (await dataGridApi.formApi.getValues()) as Record<
    string,
    any
  >;
  try {
    await exportDictDataApi(
      buildDictDataQuery(formValues, undefined, pageContext.value.dictType),
    );
  } catch (error) {
    // downloadBlob 在 HTTP 200 + JSON 错误体时抛出 Error(msg)，请求层不会弹提示
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}

onMounted(loadContext);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full flex-col gap-3" data-panel="dict-data">
      <div class="flex items-center gap-3">
        <Button @click="router.push('/system/dict')">返回</Button>
        <span class="text-sm font-medium">{{ panelTitle }}</span>
      </div>

      <div
        v-if="loadError"
        class="rounded bg-card p-6 text-sm text-muted-foreground"
      >
        {{ loadError }}
      </div>

      <div v-else class="min-h-0 flex-1">
        <DataGrid>
          <template #toolbar-actions>
            <Button
              v-access:code="['system:dict:add']"
              type="primary"
              @click="openCreate"
            >
              新增
            </Button>
            <Button
              v-access:code="['system:dict:remove']"
              @click="handleBatchDelete"
            >
              删除
            </Button>
            <Button
              v-access:code="['system:dict:export']"
              @click="handleExport"
            >
              导出
            </Button>
          </template>

          <template #listClass="{ row }">
            <Tag :color="listClassInfo(row.listClass).color">
              {{ listClassInfo(row.listClass).label }}
            </Tag>
          </template>

          <template #operation="{ row }">
            <Button
              v-access:code="['system:dict:edit']"
              size="small"
              type="link"
              @click="openEdit(row)"
            >
              修改
            </Button>
            <Button
              v-access:code="['system:dict:remove']"
              size="small"
              type="link"
              @click="confirmDelete([row])"
            >
              删除
            </Button>
          </template>
        </DataGrid>
      </div>
    </div>

    <DataFormModal @success="handleSuccess" />
  </Page>
</template>
