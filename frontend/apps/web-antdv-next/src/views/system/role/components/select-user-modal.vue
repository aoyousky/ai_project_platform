<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { UserVO } from '#/api/system/user/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message, Table } from 'antdv-next';

import {
  getUnallocatedUserListApi,
  selectAuthUserAllApi,
} from '#/api/system/role';

interface SelectUserModalData {
  roleId: Id;
}

const emit = defineEmits<{ success: [] }>();

const roleId = ref<Id>();
const userName = ref('');
const phonenumber = ref('');
const rows = ref<UserVO[]>([]);
const total = ref(0);
const loading = ref(false);
const pageNum = ref(1);
const pageSize = ref(10);
const selectedKeys = ref<Array<number | string>>([]);

async function load() {
  if (!roleId.value) {
    return;
  }
  loading.value = true;
  try {
    const result = await getUnallocatedUserListApi({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      phonenumber: phonenumber.value || undefined,
      roleId: roleId.value,
      userName: userName.value || undefined,
    });
    rows.value = result.rows;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pageNum.value = 1;
  load();
}

function handlePageChange(page: number) {
  pageNum.value = page;
  load();
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!roleId.value || selectedKeys.value.length === 0) {
      message.warning('请选择要授权的用户');
      return;
    }

    modalApi.lock(true);
    try {
      await selectAuthUserAllApi(roleId.value, selectedKeys.value);
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示
    } finally {
      modalApi.lock(false);
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = modalApi.getData<SelectUserModalData>();
    roleId.value = data.roleId;
    userName.value = '';
    phonenumber.value = '';
    selectedKeys.value = [];
    pageNum.value = 1;
    modalApi.setState({ title: '选择用户' });
    await load();
  },
});

defineExpose({ load });
</script>

<template>
  <Modal class="w-[900px]">
    <div class="mb-3 flex items-center gap-2">
      <Input v-model:value="userName" placeholder="用户名称" @press-enter="handleSearch" />
      <Input
        v-model:value="phonenumber"
        placeholder="手机号码"
        @press-enter="handleSearch"
      />
      <Button @click="handleSearch">搜索</Button>
      <Button @click="handleSearch">重置</Button>
    </div>

    <Table
      :columns="[
        { dataIndex: 'userId', title: '用户编号', width: 110 },
        { dataIndex: 'userName', title: '用户名称' },
        { dataIndex: 'nickName', title: '用户昵称' },
        { dataIndex: 'phonenumber', title: '手机号码' },
        { dataIndex: 'status', title: '状态', width: 80 },
      ]"
      :data-source="rows"
      :loading="loading"
      :pagination="{
        current: pageNum,
        pageSize,
        total,
        onChange: handlePageChange,
      }"
      :row-key="(row: UserVO) => String(row.userId)"
      :row-selection="{
        selectedRowKeys: selectedKeys,
        onChange: (keys: Array<number | string>) => (selectedKeys = keys),
      }"
      size="small"
    />
  </Modal>
</template>
