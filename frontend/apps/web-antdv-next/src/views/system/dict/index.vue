<script setup lang="ts">
import type { DictData, DictType } from '#/api/system/dict/types';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDictDataApi,
  deleteDictTypeApi,
  exportDictDataApi,
  exportDictTypeApi,
  getDictDataListApi,
  getDictTypeApi,
  getDictTypeListApi,
  refreshDictTypeCacheApi,
} from '#/api/system/dict';
import { clearDictCache } from '#/composables/use-dict';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import DictDataForm from './components/dict-data-form.vue';
import DictTypeForm from './components/dict-type-form.vue';
import {
  buildDictDataQuery,
  buildDictTypeQuery,
  listClassInfo,
  refreshDictCache,
} from './dict-page-logic';

const router = useRouter();

const selectedDictType = ref<DictType | null>(null);
const dictDataCount = ref(0);

const dataPanelTitle = computed(() =>
  selectedDictType.value
    ? `字典数据：${selectedDictType.value.dictType}（${dictDataCount.value} 条）`
    : '字典数据：请选择左侧字典类型',
);

/* ------------------------------ 字典类型 ------------------------------ */

const [TypeGrid, typeGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入字典名称' },
        fieldName: 'dictName',
        label: '字典名称',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入字典类型' },
        fieldName: 'dictType',
        label: '字典类型',
      },
      {
        component: 'RangePicker' as const,
        componentProps: { valueFormat: 'YYYY-MM-DD' },
        fieldName: 'dateRange',
        label: '创建时间',
      },
    ],
  },
  gridEvents: {
    cellClick: ({ row }: { row: DictType }) => {
      handleSelectType(row);
    },
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'dictName', minWidth: 140, showOverflow: true, title: '字典名称' },
      {
        field: 'dictType',
        minWidth: 160,
        showOverflow: true,
        title: '字典类型',
      },
      { field: 'remark', minWidth: 140, showOverflow: true, title: '备注' },
      { field: 'createTime', minWidth: 160, title: '创建时间' },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 230,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          const page = params.page;
          const query = buildDictTypeQuery(formValues ?? {}, page);
          const { rows, total } = await getDictTypeListApi(query);
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
          const corrected = await getDictTypeListApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'dictId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

/* ------------------------------ 字典数据 ------------------------------ */

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
        minWidth: 130,
        showOverflow: true,
        title: '字典标签',
      },
      {
        field: 'dictValue',
        minWidth: 130,
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
        query: async (params: any, formValues: Record<string, any>) => {
          if (!selectedDictType.value) {
            dictDataCount.value = 0;
            return { items: [], total: 0 };
          }
          const page = params.page;
          const query = buildDictDataQuery(
            formValues ?? {},
            page,
            selectedDictType.value.dictType,
          );
          const { rows, total } = await getDictDataListApi(query);
          dictDataCount.value = total;
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await getDictDataListApi({
            ...query,
            pageNum: fallbackPage,
          });
          dictDataCount.value = corrected.total;
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'dictCode' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

function handleSelectType(row: DictType) {
  selectedDictType.value = row;
  dictDataCount.value = 0;
  dataGridApi.reload();
}

/* ------------------------------ 弹窗与操作 ------------------------------ */

const [TypeFormModal, typeFormModalApi] = useVbenModal({
  connectedComponent: DictTypeForm,
  destroyOnClose: true,
});

const [DataFormModal, dataFormModalApi] = useVbenModal({
  connectedComponent: DictDataForm,
  destroyOnClose: true,
});

function openTypeCreate() {
  typeFormModalApi.setData({ mode: 'create' }).open();
}

function openTypeEdit(row: any) {
  typeFormModalApi
    .setData({ mode: 'edit', record: row as DictType })
    .open();
}

function openDataCreate() {
  if (!selectedDictType.value) {
    message.warning('请先选择左侧字典类型');
    return;
  }
  dataFormModalApi
    .setData({
      dictType: selectedDictType.value.dictType,
      mode: 'create',
    })
    .open();
}

function openDataEdit(row: any) {
  const record = row as DictData;
  dataFormModalApi
    .setData({
      dictType: record.dictType,
      mode: 'edit',
      record,
    })
    .open();
}

async function handleTypeSuccess() {
  await typeGridApi.reload();
  const selected = selectedDictType.value;
  if (!selected) {
    return;
  }
  try {
    selectedDictType.value = await getDictTypeApi(selected.dictId);
  } catch {
    selectedDictType.value = null;
  }
  await dataGridApi.reload();
}

async function handleDataSuccess() {
  await dataGridApi.reload();
}

function confirmDeleteTypes(rows: Array<Record<string, any>>) {
  const records = rows as DictType[];
  if (records.length === 0) {
    message.warning('请选择要删除的字典类型');
    return;
  }
  const ids = records.map((row) => row.dictId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 个字典类型？已被字典数据使用的类型将被后端拒绝。`,
    okText: '确定',
    onOk: async () => {
      try {
        await deleteDictTypeApi(ids);
        message.success('删除成功');
        await typeGridApi.reload();
        if (
          selectedDictType.value &&
          ids.some(
            (id) => String(id) === String(selectedDictType.value?.dictId),
          )
        ) {
          selectedDictType.value = null;
          dictDataCount.value = 0;
        }
        await dataGridApi.reload();
      } catch {
        // 后端拒绝（如类型已分配数据）：请求层已提示 msg，保留行与右侧数据
      }
    },
    title: '删除确认',
  });
}

function handleTypeBatchDelete() {
  const rows = (typeGridApi.grid.getCheckboxRecords?.() ?? []) as DictType[];
  confirmDeleteTypes(rows);
}

function confirmDeleteData(rows: Array<Record<string, any>>) {
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

function handleDataBatchDelete() {
  const rows = (dataGridApi.grid.getCheckboxRecords?.() ?? []) as DictData[];
  confirmDeleteData(rows);
}

function handleRefreshCache() {
  AntModal.confirm({
    cancelText: '取消',
    content: '确认刷新字典缓存？',
    okText: '确定',
    onOk: async () => {
      try {
        await refreshDictCache(refreshDictTypeCacheApi, clearDictCache);
        message.success('刷新缓存成功');
      } catch {
        // 请求层已提示 msg；刷新失败时不清空会话缓存（E-34）
      }
    },
    title: '刷新缓存确认',
  });
}

async function handleTypeExport() {
  const formValues = (await typeGridApi.formApi.getValues()) as Record<
    string,
    any
  >;
  try {
    await exportDictTypeApi(buildDictTypeQuery(formValues));
  } catch (error) {
    // downloadBlob 在 HTTP 200 + JSON 错误体时抛出 Error(msg)，请求层不会弹提示
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}

async function handleDataExport() {
  if (!selectedDictType.value) {
    message.warning('请先选择左侧字典类型');
    return;
  }
  const formValues = (await dataGridApi.formApi.getValues()) as Record<
    string,
    any
  >;
  try {
    await exportDictDataApi(
      buildDictDataQuery(
        formValues,
        undefined,
        selectedDictType.value.dictType,
      ),
    );
  } catch (error) {
    // downloadBlob 在 HTTP 200 + JSON 错误体时抛出 Error(msg)，请求层不会弹提示
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}

function openDataPage(row: any) {
  router.push(`/system/dict-data/index/${(row as DictType).dictId}`);
}
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full gap-3">
      <div
        class="min-w-0 w-[55%]"
        data-panel="dict-type"
      >
        <TypeGrid>
          <template #toolbar-actions>
            <Button
              v-access:code="['system:dict:add']"
              type="primary"
              @click="openTypeCreate"
            >
              新增
            </Button>
            <Button
              v-access:code="['system:dict:remove']"
              @click="handleTypeBatchDelete"
            >
              删除
            </Button>
            <Button
              v-access:code="['system:dict:export']"
              @click="handleTypeExport"
            >
              导出
            </Button>
            <Button
              v-access:code="['system:dict:remove']"
              @click="handleRefreshCache"
            >
              刷新缓存
            </Button>
          </template>

          <template #operation="{ row }">
            <Button
              v-access:code="['system:dict:edit']"
              size="small"
              type="link"
              @click="openTypeEdit(row)"
            >
              修改
            </Button>
            <Button
              v-access:code="['system:dict:remove']"
              size="small"
              type="link"
              @click="confirmDeleteTypes([row])"
            >
              删除
            </Button>
            <Button size="small" type="link" @click="openDataPage(row)">
              字典数据
            </Button>
          </template>
        </TypeGrid>
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col"
        data-panel="dict-data"
      >
        <div class="mb-2 px-2 text-sm font-medium">
          {{ dataPanelTitle }}
        </div>
        <div class="min-h-0 flex-1">
          <DataGrid>
            <template #toolbar-actions>
              <Button
                v-access:code="['system:dict:add']"
                type="primary"
                @click="openDataCreate"
              >
                新增
              </Button>
              <Button
                v-access:code="['system:dict:remove']"
                @click="handleDataBatchDelete"
              >
                删除
              </Button>
              <Button
                v-access:code="['system:dict:export']"
                @click="handleDataExport"
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
                @click="openDataEdit(row)"
              >
                修改
              </Button>
              <Button
                v-access:code="['system:dict:remove']"
                size="small"
                type="link"
                @click="confirmDeleteData([row])"
              >
                删除
              </Button>
            </template>
          </DataGrid>
        </div>
      </div>
    </div>

    <TypeFormModal @success="handleTypeSuccess" />
    <DataFormModal @success="handleDataSuccess" />
  </Page>
</template>
