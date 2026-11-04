<script lang="ts" setup>
import { $t } from '@vben/locales';

import { Input } from 'antdv-next';

defineOptions({ name: 'RuoYiCaptchaField' });

const props = defineProps<{
  imageSrc?: string;
  onRefresh?: () => Promise<void> | void;
}>();

/** 验证码输入值（由 VbenForm 通过 v-model 注入） */
const modelValue = defineModel<string>({ default: '' });
</script>

<template>
  <div class="flex w-full items-center gap-3">
    <Input
      v-model:value="modelValue"
      :placeholder="$t('authentication.code')"
      autocomplete="off"
      class="flex-1"
    />
    <img
      v-if="props.imageSrc"
      :src="props.imageSrc"
      :alt="$t('authentication.code')"
      class="h-9 w-28 cursor-pointer rounded border border-border"
      @click="props.onRefresh?.()"
    />
  </div>
</template>
