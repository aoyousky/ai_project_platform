<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { DeptTreeOption } from '#/api/system/dept/types';
import type { PostQuery, PostVO } from '#/api/system/post/types';

import { onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import {
  Modal as AntModal,
  Button,
  message,
  Spin,
  Switch,
  Tree,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePostApi,
  exportPostApi,
  getPostDeptTreeApi,
  getPostListApi,
  updatePostApi,
} from '#/api/system/post';
import { resolveOutOfRangePage } from '#/utils/system/pagination';
import { runStatusToggle } from '#/utils/system/status';

import PostForm from './components/post-form.vue';
import {
  buildPostQuery,
  buildPostStatusPayload,
  toPostDeptOptions,
} from './post-page-logic';

const deptTree = ref<DeptTreeOption[]>([]);
const deptLoading = ref(false);
const deptId = ref<Id | null>(null);

async function loadDeptTree() {
  deptLoading.value = true;
  try {
    deptTree.value = await getPostDeptTreeApi();
  } finally {
    deptLoading.value = false;
  }
}

function handleDeptSelect(
  keys: Array<number | string>,
  info: { selected: boolean },
) {
  deptId.value =
    info.selected && keys.length > 0 ? keys[keys.length - 1]! : null;
  gridApi.reload();
}

const searchSchema = [
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入岗位编码' },
    fieldName: 'postCode',
    label: '岗位编码',
  },
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入岗位名称' },
    fieldName: 'postName',
    label: '岗位名称',
  },
  {
    component: 'Select' as const,
    componentProps: {
      options: [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' },
      ],
      placeholder: '岗位状态',
    },
    fieldName: 'status',
    label: '岗位状态',
  },
  {
    component: 'RangePicker' as const,
    componentProps: { valueFormat: 'YYYY-MM-DD' },
    fieldName: 'dateRange',
    label: '创建时间',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: searchSchema,
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'postId', title: '岗位编号', width: 160 },
      { field: 'deptName', minWidth: 140, title: '所属部门' },
      { field: 'postCode', minWidth: 120, title: '岗位编码' },
      { field: 'postName', minWidth: 120, title: '岗位名称' },
      { field: 'postSort', title: '排序', width: 80 },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '状态',
        width: 90,
      },
      { field: 'createTime', minWidth: 160, title: '创建时间' },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 160,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (
          params: any,
          formValues: Record<string, any>,
        ) => {
          const { page } = params;
          const query = buildPostQuery(formValues ?? {}, page, deptId.value);
          const { rows, total } = await getPostListApi(query);
          // E-27：页码越界时回退到最后一页
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await getPostListApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'postId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [PostFormModal, postFormModalApi] = useVbenModal({
  connectedComponent: PostForm,
  destroyOnClose: true,
});

async function openCreate() {
  const tree = await getPostDeptTreeApi();
  postFormModalApi
    .setData({ deptOptions: toPostDeptOptions(tree), mode: 'create' })
    .open();
}

async function handleEdit(row: any) {
  const tree = await getPostDeptTreeApi();
  postFormModalApi
    .setData({ deptOptions: toPostDeptOptions(tree), mode: 'edit', post: row })
    .open();
}

function confirmDelete(postIds: Array<Id>) {
  const ids = postIds.map(String);
  if (ids.length === 0) {
    message.warning('请选择要删除的岗位');
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 个岗位？已被用户引用的岗位将被后端拒绝。`,
    okText: '确定',
    onOk: async () => {
      await deletePostApi(ids);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  const rows = (gridApi.grid.getCheckboxRecords?.() ?? []) as PostVO[];
  confirmDelete(rows.map((row) => row.postId));
}

function handleStatusChange(row: any, checked: boolean) {
  const previousStatus = row.status;
  const nextStatus = checked ? '0' : '1';
  const action = checked ? '启用' : '停用';
  // A-17：停用/启用先二次确认，确认后才提交
  AntModal.confirm({
    cancelText: '取消',
    content: `确认${action}岗位「${row.postName}」？`,
    okText: '确定',
    // 取消后重载：开关受控于 row.status，未变更时组件内部状态需由新数据覆盖
    onCancel: () => gridApi.reload(),
    onOk: () =>
      runStatusToggle({
        apply: (status) => {
          row.status = status;
        },
        commit: () => updatePostApi(buildPostStatusPayload(row, nextStatus)),
        nextStatus,
        previousStatus,
        reload: () => gridApi.reload(),
      }),
    title: `${action}确认`,
  });
}

async function handleExport() {
  const formValues = (await gridApi.formApi.getValues()) as Record<string, any>;
  const query = buildPostQuery(formValues, {
    currentPage: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  });
  await exportPostApi({ ...query, pageNum: undefined, pageSize: undefined } as PostQuery);
}

onMounted(loadDeptTree);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full gap-3">
      <div class="w-[240px] shrink-0 overflow-auto rounded bg-card p-3">
        <div class="mb-2 text-sm font-medium">部门</div>
        <Spin :spinning="deptLoading">
          <Tree
            block-node
            :field-names="{ children: 'children', key: 'id', title: 'label' }"
            :tree-data="deptTree"
            @select="handleDeptSelect"
          />
        </Spin>
      </div>

      <div class="min-w-0 flex-1">
        <Grid>
          <template #toolbar-actions>
            <Button
              v-access:code="['system:post:add']"
              type="primary"
              @click="openCreate"
            >
              新增
            </Button>
            <Button
              v-access:code="['system:post:remove']"
              @click="handleBatchDelete"
            >
              删除
            </Button>
            <Button
              v-access:code="['system:post:export']"
              @click="handleExport"
            >
              导出
            </Button>
          </template>

          <template #status="{ row }">
            <Switch
              :checked="row.status === '0'"
              @change="(checked: boolean) => handleStatusChange(row, checked)"
            />
          </template>

          <template #operation="{ row }">
            <Button
              v-access:code="['system:post:edit']"
              size="small"
              type="link"
              @click="handleEdit(row)"
            >
              修改
            </Button>
            <Button
              v-access:code="['system:post:remove']"
              size="small"
              type="link"
              @click="confirmDelete([row.postId])"
            >
              删除
            </Button>
          </template>
        </Grid>
      </div>
    </div>

    <PostFormModal @success="gridApi.reload()" />
  </Page>
</template>
