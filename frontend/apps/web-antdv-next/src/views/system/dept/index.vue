<script setup lang="ts">
import type { DeptVO } from '#/api/system/dept/types';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDeptApi,
  getDeptExcludeChildApi,
  getDeptListApi,
} from '#/api/system/dept';
import { removeEmptyParams } from '#/utils/system/query';

import DeptForm from './components/dept-form.vue';
import {
  buildDeptParentOptions,
  buildDeptTableData,
  filterDeptFlat,
} from './dept-page-logic';

const flatDepts = ref<DeptVO[]>([]);

const searchSchema = [
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入部门名称' },
    fieldName: 'deptName',
    label: '部门名称',
  },
  {
    component: 'Select' as const,
    componentProps: {
      options: [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' },
      ],
      placeholder: '部门状态',
    },
    fieldName: 'status',
    label: '部门状态',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: searchSchema,
  },
  gridOptions: {
    columns: [
      {
        field: 'deptName',
        minWidth: 220,
        title: '部门名称',
        treeNode: true,
      },
      { field: 'orderNum', title: '排序', width: 80 },
      { field: 'leaderName', minWidth: 120, title: '负责人' },
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
        width: 220,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (_params: any, formValues: Record<string, any>) => {
          const { deptName, ...rest } = formValues ?? {};
          const rows = await getDeptListApi(removeEmptyParams(rest) as any);
          flatDepts.value = rows;
          // 名称筛选在前端完成，保留命中节点的祖先链（A-15）
          const filtered = filterDeptFlat(rows, deptName ?? '');
          return {
            items: buildDeptTableData(filtered),
            total: filtered.length,
          };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'deptId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
    treeConfig: { childrenField: 'children', expandAll: true },
  },
});

const [DeptFormModal, deptFormModalApi] = useVbenModal({
  connectedComponent: DeptForm,
  destroyOnClose: true,
});

async function openCreate(parentId: number | string = '0') {
  const rows = await getDeptListApi();
  deptFormModalApi
    .setData({
      mode: 'create',
      parentId,
      parentOptions: buildDeptParentOptions(rows),
    })
    .open();
}

async function handleEdit(row: any) {
  // 后端排除自身及全部下级（D-02、E-20）
  const rows = await getDeptExcludeChildApi(row.deptId);
  deptFormModalApi
    .setData({
      dept: row,
      mode: 'edit',
      parentOptions: buildDeptParentOptions(rows),
    })
    .open();
}

function confirmDelete(row: any) {
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除部门“${row.deptName}”？存在下级部门、用户或岗位时后端将拒绝删除。`,
    okText: '确定',
    onOk: async () => {
      await deleteDeptApi(row.deptId);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '删除确认',
  });
}

function setAllExpanded(expanded: boolean) {
  gridApi.grid.setAllTreeExpand?.(expanded);
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <Button
          v-access:code="['system:dept:add']"
          type="primary"
          @click="openCreate('0')"
        >
          新增
        </Button>
        <Button @click="setAllExpanded(true)">展开</Button>
        <Button @click="setAllExpanded(false)">折叠</Button>
      </template>

      <template #status="{ row }">
        <Tag :color="row.status === '0' ? 'green' : 'red'">
          {{ row.status === '0' ? '正常' : '停用' }}
        </Tag>
      </template>

      <template #operation="{ row }">
        <Button
          v-access:code="['system:dept:add']"
          size="small"
          type="link"
          @click="openCreate(row.deptId)"
        >
          新增下级
        </Button>
        <Button
          v-access:code="['system:dept:edit']"
          size="small"
          type="link"
          @click="handleEdit(row)"
        >
          修改
        </Button>
        <Button
          v-access:code="['system:dept:remove']"
          size="small"
          type="link"
          @click="confirmDelete(row)"
        >
          删除
        </Button>
      </template>
    </Grid>

    <DeptFormModal @success="gridApi.reload()" />
  </Page>
</template>
