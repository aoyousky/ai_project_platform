<script setup lang="ts">
import type { MenuQuery, MenuVO } from '#/api/system/menu/types';

import { computed, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Modal as AntModal, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cascadeDeleteMenuApi,
  deleteMenuApi,
  getMenuListApi,
  getMenuTreeSelectApi,
} from '#/api/system/menu';
import { removeEmptyParams } from '#/utils/system/query';

import MenuForm from './components/menu-form.vue';
import {
  buildMenuDeleteIds,
  buildMenuTableData,
  canManageMenu,
  hasMenuAdminRole,
} from './menu-page-logic';

const accessStore = useAccessStore();
const userStore = useUserStore();

const menuTypeText: Record<string, string> = {
  C: '菜单',
  F: '按钮',
  M: '目录',
};

const hasAdminRole = computed(() => hasMenuAdminRole(userStore.userRoles));
const flatMenus = ref<MenuVO[]>([]);

function canManage(action: 'add' | 'edit' | 'remove'): boolean {
  return canManageMenu(
    {
      hasAdminRole: hasAdminRole.value,
      permissions: accessStore.accessCodes ?? [],
    },
    action,
  );
}

const searchSchema = [
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入菜单名称' },
    fieldName: 'menuName',
    label: '菜单名称',
  },
  {
    component: 'Select' as const,
    componentProps: {
      options: [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' },
      ],
      placeholder: '菜单状态',
    },
    fieldName: 'status',
    label: '菜单状态',
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
        field: 'menuName',
        minWidth: 200,
        title: '菜单名称',
        treeNode: true,
      },
      { field: 'icon', title: '图标', width: 100 },
      { field: 'orderNum', title: '排序', width: 80 },
      { field: 'perms', minWidth: 160, title: '权限标识' },
      { field: 'component', minWidth: 180, title: '组件路径' },
      {
        field: 'menuType',
        slots: { default: 'menuType' },
        title: '类型',
        width: 90,
      },
      {
        field: 'visible',
        slots: { default: 'visible' },
        title: '显示状态',
        width: 100,
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '菜单状态',
        width: 100,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 240,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (_params: any, formValues: Record<string, any>) => {
          const rows = await getMenuListApi(
            removeEmptyParams(formValues ?? {}) as MenuQuery,
          );
          flatMenus.value = rows;
          // 列表接口返回 flat，前端构建树（A-07）
          return { items: buildMenuTableData(rows), total: rows.length };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'menuId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
    treeConfig: { childrenField: 'children', expandAll: true },
  },
});

const [MenuFormModal, menuFormModalApi] = useVbenModal({
  connectedComponent: MenuForm,
  destroyOnClose: true,
});

async function openCreate(parentId: number | string = '0') {
  const parentOptions = await getMenuTreeSelectApi();
  menuFormModalApi
    .setData({ mode: 'create', parentId, parentOptions })
    .open();
}

async function handleEdit(row: any) {
  const parentOptions = await getMenuTreeSelectApi();
  menuFormModalApi
    .setData({ menu: row, mode: 'edit', parentOptions })
    .open();
}

function confirmDelete(row: any) {
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除菜单“${row.menuName}”？存在子菜单时后端将拒绝删除。`,
    okText: '确定',
    onOk: async () => {
      await deleteMenuApi(row.menuId);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '删除确认',
  });
}

async function confirmCascadeDelete(row: any) {
  const fullList = await getMenuListApi();
  const ids = buildMenuDeleteIds(row, fullList, 'cascade');
  AntModal.confirm({
    cancelText: '取消',
    content: `确认级联删除“${row.menuName}”及其 ${ids.length - 1} 个后代菜单？`,
    okText: '确定',
    onOk: async () => {
      await cascadeDeleteMenuApi(ids);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '级联删除确认',
  });
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <Button
          v-if="canManage('add')"
          type="primary"
          @click="openCreate('0')"
        >
          新增
        </Button>
      </template>

      <template #menuType="{ row }">
        <Tag>{{ menuTypeText[row.menuType] ?? row.menuType }}</Tag>
      </template>

      <template #visible="{ row }">
        <Tag :color="row.visible === '0' ? 'green' : 'orange'">
          {{ row.visible === '0' ? '显示' : '隐藏' }}
        </Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="row.status === '0' ? 'green' : 'red'">
          {{ row.status === '0' ? '正常' : '停用' }}
        </Tag>
      </template>

      <template #operation="{ row }">
        <template v-if="canManage('edit')">
          <Button size="small" type="link" @click="handleEdit(row)">
            修改
          </Button>
          <Button
            v-if="row.menuType !== 'F'"
            size="small"
            type="link"
            @click="openCreate(row.menuId)"
          >
            新增下级
          </Button>
        </template>
        <template v-if="canManage('remove')">
          <Button size="small" type="link" @click="confirmDelete(row)">
            删除
          </Button>
          <Button
            v-if="row.children && row.children.length > 0"
            size="small"
            type="link"
            @click="confirmCascadeDelete(row)"
          >
            级联删除
          </Button>
        </template>
      </template>
    </Grid>

    <MenuFormModal @success="gridApi.reload()" />
  </Page>
</template>
