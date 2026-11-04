<script setup lang="ts">
import type { UserRoleOption, UserVO } from '#/api/system/user/types';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Checkbox, CheckboxGroup, message, Spin } from 'antdv-next';

import { getUserAuthRoleApi, updateUserAuthRoleApi } from '#/api/system/user';
import { sameId } from '#/utils/system/id';

const route = useRoute();
const router = useRouter();

const userId = computed(() => String(route.params.userId ?? ''));
const user = ref<null | UserVO>(null);
const roles = ref<UserRoleOption[]>([]);
const checkedRoleIds = ref<string[]>([]);
const loading = ref(false);

/** 内置超级管理员不允许分配角色（后端仍会拒绝） */
const protectedUser = computed(() => sameId(userId.value, 1));

const roleOptions = computed(() =>
  roles.value.map((role) => ({
    disabled: role.status === '1',
    label: role.roleName,
    value: String(role.roleId),
  })),
);

async function loadData() {
  loading.value = true;
  try {
    const info = await getUserAuthRoleApi(userId.value);
    user.value = info.user ?? null;
    roles.value = info.roles ?? [];
    // `flag === true` 表示当前用户已拥有该角色
    checkedRoleIds.value = roles.value
      .filter((role) => role.flag === true)
      .map((role) => String(role.roleId));
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (protectedUser.value) {
    return;
  }
  await updateUserAuthRoleApi(userId.value, checkedRoleIds.value);
  message.success('授权成功');
  await router.push('/system/user');
}

function handleBack() {
  router.push('/system/user');
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="flex h-full flex-col gap-4 rounded bg-card p-4">
        <div class="flex items-center gap-6">
          <span>用户名称：{{ user?.userName ?? '-' }}</span>
          <span>用户昵称：{{ user?.nickName ?? '-' }}</span>
        </div>

        <div v-if="protectedUser" class="text-red-500">
          不允许操作超级管理员用户
        </div>

        <CheckboxGroup v-model:value="checkedRoleIds">
          <Checkbox
            v-for="option in roleOptions"
            :key="option.value"
            :disabled="option.disabled || protectedUser"
            :value="option.value"
          >
            {{ option.label }}
          </Checkbox>
        </CheckboxGroup>

        <div class="flex gap-2">
          <Button
            :disabled="protectedUser"
            type="primary"
            @click="handleSubmit"
          >
            提交
          </Button>
          <Button @click="handleBack">返回</Button>
        </div>
      </div>
    </Spin>
  </Page>
</template>
