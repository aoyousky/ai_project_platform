<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, markRaw, onMounted, ref } from 'vue';

import { AuthenticationLogin } from '@vben/common-ui';

import { getCodeImageApi } from '#/api';
import { useAuthStore } from '#/store';

import CaptchaField from './captcha-field.vue';
import { useLoginModel } from './login-model';
import { buildLoginSchema } from './login-schema';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const loginRef = ref<InstanceType<typeof AuthenticationLogin>>();

const { captcha, refreshCaptcha, submit, submitting } = useLoginModel({
  fetchCaptcha: getCodeImageApi,
  login: (params) => authStore.authLogin(params),
});

const formSchema = computed((): VbenFormSchema[] =>
  buildLoginSchema(captcha, markRaw(CaptchaField), refreshCaptcha),
);

onMounted(refreshCaptcha);

async function handleSubmit(values: Record<string, any>) {
  try {
    await submit(values);
  } catch {
    // 错误文案由 request 层按后端 msg 提示；这里只清空一次性验证码
    loginRef.value?.getFormApi?.().setFieldValue('code', '');
  }
}
</script>

<template>
  <AuthenticationLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading || submitting"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    @submit="handleSubmit"
  />
</template>
