<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { UserForm, UserInfoVO } from '#/api/system/user/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addUserApi, updateUserApi } from '#/api/system/user';

import { buildUserFormSchema } from '../user-form-schema';
import {
  defaultUserFormValues,
  toUserFormState,
  toUserSubmitPayload,
} from '../user-page-logic';

interface UserFormModalData {
  currentUserId?: Id;
  deptOptions: TreeSelectOption[];
  info: UserInfoVO;
  mode: 'create' | 'edit';
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const selfEditing = ref(false);
const editingUserId = ref<Id>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = (await formApi.getValues()) as UserForm;
    const payload = toUserSubmitPayload(values, {
      isEdit: mode.value === 'edit',
      selfEditing: selfEditing.value,
      userId: editingUserId.value,
    }) as UserForm;

    modalApi.lock(true);
    try {
      await (mode.value === 'edit' ? updateUserApi(payload) : addUserApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与用户输入
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<UserFormModalData>();
    mode.value = data.mode;

    const state =
      data.mode === 'edit'
        ? toUserFormState(data.info, data.currentUserId)
        : { selfEditing: false, values: defaultUserFormValues() };
    selfEditing.value = state.selfEditing;
    editingUserId.value = state.values.userId;

    formApi.setState({
      schema: buildUserFormSchema({
        deptOptions: data.deptOptions,
        isEdit: data.mode === 'edit',
        // A-16：只列未停用岗位；已分配的停用岗位仍保留，避免编辑时丢失原值
        postOptions: (data.info.posts ?? [])
          .filter(
            (post) =>
              post.status !== '1' ||
              (data.info.postIds ?? []).some(
                (id) => String(id) === String(post.postId),
              ),
          )
          .map((post) => ({
            label: post.postName,
            value: String(post.postId),
          })),
        roleOptions: (data.info.roles ?? []).map((role) => ({
          label: role.roleName,
          value: String(role.roleId),
        })),
        selfEditing: state.selfEditing,
      }),
    });

    formApi.resetForm();
    formApi.setValues(state.values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改用户' : '新增用户',
    });
  },
});
</script>

<template>
  <Modal class="w-[720px]">
    <Form />
  </Modal>
</template>
