<script setup lang="ts">
import type { OssConfig } from '#/api/system/oss/config-types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  addOssConfigApi,
  updateOssConfigApi,
} from '#/api/system/oss/config';

import { createFormConfirmHandler } from '../../shared/form-submit';
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

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 110 },
  schema: createOssConfigFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  onConfirm: async () => {
    await confirmHandler();
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
const confirmHandler = createFormConfirmHandler({
  buildPayload: (values) =>
    buildOssConfigPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
      mode.value === 'edit' ? editingStatus.value : '1',
    ),
  create: addOssConfigApi,
  formApi,
  isEdit: () => mode.value === 'edit',
  modalApi,
  onSuccess: () => emit('success'),
  update: updateOssConfigApi,
});

</script>

<template>
  <Modal class="w-[640px]">
    <Form />
  </Modal>
</template>
