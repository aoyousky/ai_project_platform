<script setup lang="ts">
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { resetUserPwdApi } from '#/api/system/user';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../user-form-schema';

const userId = ref<string>('');

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 80 },
  schema: [
    {
      component: 'InputPassword',
      componentProps: { placeholder: '请输入新密码' },
      fieldName: 'password',
      label: '新密码',
      rules: z
        .string()
        .min(PASSWORD_MIN_LENGTH, '密码长度必须介于 5 和 20 之间')
        .max(PASSWORD_MAX_LENGTH, '密码长度必须介于 5 和 20 之间')
        .regex(PASSWORD_PATTERN, '密码不能包含非法字符'),
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const { password } = await formApi.getValues();
    modalApi.lock(true);
    try {
      await resetUserPwdApi({ password, userId: userId.value });
      await modalApi.close();
    } catch {
      // 后端 msg 由请求层统一提示；弹窗保持打开
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    userId.value = modalApi.getData<{ userId: string }>().userId;
    formApi.resetForm();
  },
});
</script>

<template>
  <Modal class="w-[480px]" title="重置密码">
    <Form />
  </Modal>
</template>
