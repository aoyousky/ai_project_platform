<script setup lang="ts">
import type { OssConfig } from '#/api/system/oss/config-types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  addOssConfigApi,
  updateOssConfigApi,
} from '#/api/system/oss/config';

import {
  buildOssConfigDefaults,
  buildOssConfigPayload,
  createOssConfigFormSchema,
  toOssConfigFormValues,
} from '../oss-config-page-logic';

interface OssConfigFormModalData {
  mode: 'create' | 'edit';
  record?: OssConfig;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | string>();
const editingStatus = ref('1');
let submitting = false;

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 110 },
  schema: createOssConfigFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    // E-32：连续点击只发一次请求
    if (submitting) {
      return;
    }

    const { valid } = await formApi.validate();
    if (!valid || submitting) {
      return;
    }

    const values = (await formApi.getValues()) as Record<string, any>;
    const payload = buildOssConfigPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
      mode.value === 'edit' ? editingStatus.value : '1',
    );

    submitting = true;
    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateOssConfigApi(payload)
        : addOssConfigApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与已填内容（E-22/E-24）
    } finally {
      submitting = false;
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<OssConfigFormModalData>();
    mode.value = data.mode;
    editingId.value = data.record?.ossConfigId;
    editingStatus.value = data.record?.status ?? '1';
    const isEdit = data.mode === 'edit' && data.record;

    formApi.resetForm();
    formApi.setValues(
      isEdit
        ? toOssConfigFormValues(data.record!)
        : buildOssConfigDefaults(),
    );
    modalApi.setState({
      title: isEdit ? '修改文件配置' : '新增文件配置',
    });
  },
});
</script>

<template>
  <Modal class="w-[640px]">
    <Form />
  </Modal>
</template>
