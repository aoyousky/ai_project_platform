<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { RoleQuery, RoleVO } from '#/api/system/role/types';

import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Switch } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getMenuTreeSelectApi } from '#/api/system/menu';
import {
  changeRoleStatusApi,
  deleteRoleApi,
  exportRoleApi,
  getRoleApi,
  getRoleListApi,
  getRoleMenuTreeApi,
} from '#/api/system/role';
import { resolveOutOfRangePage } from '#/utils/system/pagination';
import { addDateRange, removeEmptyParams } from '#/utils/system/query';
import { runStatusToggle } from '#/utils/system/status';

import DataScopeDrawer from './components/data-scope-drawer.vue';
import RoleForm from './components/role-form.vue';
import { canModifyRole } from './role-page-logic';

const router = useRouter();

const searchSchema = [
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入角色名称' },
    fieldName: 'roleName',
    label: '角色名称',
  },
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入权限字符' },
    fieldName: 'roleKey',
    label: '权限字符',
  },
  {
    component: 'Select' as const,
    componentProps: {
      options: [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' },
      ],
      placeholder: '角色状态',
    },
    fieldName: 'status',
    label: '角色状态',
  },
  {
    component: 'RangePicker' as const,
    componentProps: { valueFormat: 'YYYY-MM-DD' },
    fieldName: 'dateRange',
    label: '创建时间',
  },
];

function toQuery(formValues: Record<string, any>, page?: any): RoleQuery {
  const { dateRange, ...rest } = formValues ?? {};
  return removeEmptyParams(
    addDateRange(
      {
        ...rest,
        ...(page
          ? { pageNum: page.currentPage, pageSize: page.pageSize }
          : {}),
      },
      dateRange as [string, string] | undefined,
    ),
  ) as RoleQuery;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: searchSchema,
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'roleId', title: '角色编号', width: 110 },
      { field: 'roleName', title: '角色名称', minWidth: 120, showOverflow: true },
      { field: 'roleKey', title: '权限字符', minWidth: 120, showOverflow: true },
      { field: 'roleSort', title: '显示顺序', width: 90 },
      { field: 'status', slots: { default: 'status' }, title: '状态', width: 90 },
      { field: 'createTime', title: '创建时间', minWidth: 160 },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 300,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          const page = params.page;
          const query = toQuery(formValues, page);
          const { rows, total } = await getRoleListApi(query);
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await getRoleListApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'roleId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [RoleFormModal, roleFormModalApi] = useVbenModal({
  connectedComponent: RoleForm,
  destroyOnClose: true,
});

const [DataScopeModal, dataScopeModalApi] = useVbenModal({
  connectedComponent: DataScopeDrawer,
  destroyOnClose: true,
});

async function handleCreate() {
  const menus = await getMenuTreeSelectApi();
  roleFormModalApi
    .setData({ checkedKeys: [], menus, mode: 'create' })
    .open();
}

async function handleEdit(row: any) {
  if (!canModifyRole(row.roleId)) {
    return;
  }
  const [role, menuTree] = await Promise.all([
    getRoleApi(row.roleId),
    getRoleMenuTreeApi(row.roleId),
  ]);
  roleFormModalApi
    .setData({
      checkedKeys: (menuTree.checkedKeys ?? []).map(String),
      menus: menuTree.menus ?? [],
      mode: 'edit',
      role,
    })
    .open();
}

function handleDataScope(row: any) {
  if (!canModifyRole(row.roleId)) {
    return;
  }
  dataScopeModalApi.setData({ role: row }).open();
}

function handleAuthUser(row: any) {
  if (!canModifyRole(row.roleId)) {
    return;
  }
  router.push(`/system/role-auth/user/${row.roleId}`);
}

function confirmDelete(roleIds: Array<Id>) {
  const ids = roleIds.map(String);
  if (ids.length === 0) {
    message.warning('请选择要删除的角色');
    return;
  }
  if (ids.some((id) => !canModifyRole(id))) {
    message.error('不允许操作超级管理员角色');
    return;
  }

  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 个角色？`,
    okText: '确定',
    onOk: async () => {
      await deleteRoleApi(ids);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  const rows = (gridApi.grid.getCheckboxRecords?.() ?? []) as RoleVO[];
  confirmDelete(rows.map((row) => row.roleId));
}

async function handleStatusChange(row: any, checked: boolean) {
  if (!canModifyRole(row.roleId)) {
    return;
  }
  const nextStatus = checked ? '0' : '1';
  await runStatusToggle({
    apply: (status) => {
      row.status = status;
    },
    commit: () => changeRoleStatusApi({ roleId: row.roleId, status: nextStatus }),
    nextStatus,
    previousStatus: row.status,
    reload: () => gridApi.reload(),
  });
}

async function handleExport() {
  const formValues = (await gridApi.formApi.getValues()) as Record<string, any>;
  await exportRoleApi(toQuery(formValues));
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <Button v-access:code="['system:role:add']" type="primary" @click="handleCreate">
          新增
        </Button>
        <Button v-access:code="['system:role:remove']" @click="handleBatchDelete">
          删除
        </Button>
        <Button v-access:code="['system:role:export']" @click="handleExport">
          导出
        </Button>
      </template>

      <template #status="{ row }">
        <Switch
          :checked="row.status === '0'"
          :disabled="!canModifyRole(row.roleId)"
          @change="(checked: boolean) => handleStatusChange(row, checked)"
        />
      </template>

      <template #operation="{ row }">
        <template v-if="canModifyRole(row.roleId)">
          <Button
            v-access:code="['system:role:edit']"
            size="small"
            type="link"
            @click="handleEdit(row)"
          >
            修改
          </Button>
          <Button
            v-access:code="['system:role:edit']"
            size="small"
            type="link"
            @click="handleDataScope(row)"
          >
            数据权限
          </Button>
          <Button
            v-access:code="['system:role:edit']"
            size="small"
            type="link"
            @click="handleAuthUser(row)"
          >
            分配用户
          </Button>
          <Button
            v-access:code="['system:role:remove']"
            size="small"
            type="link"
            @click="confirmDelete([row.roleId])"
          >
            删除
          </Button>
        </template>
      </template>
    </Grid>

    <RoleFormModal @success="gridApi.reload()" />
    <DataScopeModal @success="gridApi.reload()" />
  </Page>
</template>
