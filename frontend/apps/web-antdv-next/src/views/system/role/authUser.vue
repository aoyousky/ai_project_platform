<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { RoleVO } from '#/api/system/role/types';
import type { UserVO } from '#/api/system/user/types';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelAuthUserAllApi,
  cancelAuthUserApi,
  getAllocatedUserListApi,
  getRoleApi,
} from '#/api/system/role';

import SelectUserModal from './components/select-user-modal.vue';

const route = useRoute();
const router = useRouter();
const roleId = ref<Id>(String(route.params.roleId ?? ''));
const roleName = ref('');

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'userId', title: '用户编号', width: 110 },
      { field: 'userName', title: '用户名称', minWidth: 120 },
      { field: 'nickName', title: '用户昵称', minWidth: 120 },
      { field: 'phonenumber', title: '手机号码', minWidth: 120 },
      { field: 'status', title: '状态', width: 80 },
      { field: 'createTime', title: '创建时间', minWidth: 160 },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 120,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (params: any) => {
          const { page } = params;
          const { rows, total } = await getAllocatedUserListApi({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            roleId: roleId.value,
          });
          return { items: rows, total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'userId' },
    toolbarConfig: { refresh: true, zoom: true },
  },
});

const [SelectUserModalComp, selectUserModalApi] = useVbenModal({
  connectedComponent: SelectUserModal,
  destroyOnClose: true,
});

function confirmCancel(userIds: Array<Id>) {
  if (userIds.length === 0) {
    message.warning('请选择要取消授权的用户');
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    content: `确认取消选中的 ${userIds.length} 个用户的角色授权？`,
    okText: '确定',
    onOk: async () => {
      await (userIds.length === 1
        ? cancelAuthUserApi({ roleId: roleId.value, userId: userIds[0]! })
        : cancelAuthUserAllApi(roleId.value, userIds));
      message.success('取消授权成功');
      await gridApi.reload();
    },
    title: '取消授权确认',
  });
}

function handleBatchCancel() {
  const rows = (gridApi.grid.getCheckboxRecords?.() ?? []) as UserVO[];
  confirmCancel(rows.map((row) => row.userId));
}

function handleSelectUser() {
  selectUserModalApi.setData({ roleId: roleId.value }).open();
}

onMounted(async () => {
  if (roleId.value) {
    const role: RoleVO = await getRoleApi(roleId.value);
    roleName.value = role.roleName;
  }
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <Button type="primary" @click="handleSelectUser">添加用户</Button>
        <Button @click="handleBatchCancel">批量取消授权</Button>
        <Button @click="router.back()">返回</Button>
        <span class="ml-2 text-sm text-gray-500">角色：{{ roleName }}</span>
      </template>

      <template #operation="{ row }">
        <Button size="small" type="link" @click="confirmCancel([row.userId])">
          取消授权
        </Button>
      </template>
    </Grid>

    <SelectUserModalComp @success="gridApi.reload()" />
  </Page>
</template>
