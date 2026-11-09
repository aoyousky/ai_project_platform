<script setup lang="ts">
import type { Config } from '#/api/system/config/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { addConfigApi, updateConfigApi } from '#/api/system/config';

import {
  createRemarkField,
  requiredTextRule,
} from '../../shared/form-schema';
import { createFormConfirmHandler } from '../../shared/form-submit';
import {
  buildConfigSubmitPayload,
  toConfigFormValues,
} from '../config-page-logic';

interface ConfigFormModalData {
  mode: 'create' | 'edit';
  record?: Config;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | string>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入参数名称' },
      fieldName: 'configName',
      label: '参数名称',
      rules: requiredTextRule('参数名称'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入参数键名' },
      fieldName: 'configKey',
      label: '参数键名',
      rules: requiredTextRule('参数键名'),
    },
    {
      component: 'Textarea',
      componentProps: {
        maxlength: 500,
        placeholder: '请输入参数键值',
        rows: 3,
      },
      fieldName: 'configValue',
      label: '参数键值',
      rules: requiredTextRule('参数键值', 500),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '是', value: 'Y' },
          { label: '否', value: 'N' },
        ],
      },
      defaultValue: 'Y',
      fieldName: 'configType',
      label: '系统内置',
      rules: z.string().min(1, '请选择是否系统内置'),
    },
    createRemarkField(),
  ],
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

    const data = modalApi.getData<ConfigFormModalData>();
    mode.value = data.mode;
    editingId.value = data.record?.configId;
    const isEdit = data.mode === 'edit' && data.record;

    const values = isEdit
      ? toConfigFormValues(data.record!)
      : {
          configKey: '',
          configName: '',
          configType: 'Y',
          configValue: '',
          remark: '',
        };

    formApi.resetForm();
    formApi.setValues(values);
    // 编辑时“系统内置”只读保留原值（Packet §6）
    formApi.updateSchema([
      {
        componentProps: { disabled: Boolean(isEdit) },
        fieldName: 'configType',
      },
    ]);
    modalApi.setState({
      title: isEdit ? '修改参数' : '新增参数',
    });
  },
});
const confirmHandler = createFormConfirmHandler({
  buildPayload: (values) =>
    buildConfigSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    ),
  create: addConfigApi,
  formApi,
  isEdit: () => mode.value === 'edit',
  modalApi,
  onSuccess: () => emit('success'),
  update: updateConfigApi,
});

</script>

<template>
  <Modal class="w-[560px]">
    <Form />
  </Modal>
</template>
