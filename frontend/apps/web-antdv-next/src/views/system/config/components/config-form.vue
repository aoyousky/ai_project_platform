<script setup lang="ts">
import type { Config } from '#/api/system/config/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { addConfigApi, updateConfigApi } from '#/api/system/config';

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
let submitting = false;

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入参数名称' },
      fieldName: 'configName',
      label: '参数名称',
      rules: z
        .string()
        .min(1, '请输入参数名称')
        .max(100, '参数名称不能超过 100 个字符'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入参数键名' },
      fieldName: 'configKey',
      label: '参数键名',
      rules: z
        .string()
        .min(1, '请输入参数键名')
        .max(100, '参数键名不能超过 100 个字符'),
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
      rules: z
        .string()
        .min(1, '请输入参数键值')
        .max(500, '参数键值不能超过 500 个字符'),
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
    {
      component: 'Textarea',
      componentProps: { placeholder: '请输入内容', rows: 3 },
      fieldName: 'remark',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (submitting) {
      return;
    }

    const { valid } = await formApi.validate();
    if (!valid || submitting) {
      return;
    }

    const values = (await formApi.getValues()) as Record<string, any>;
    const payload = buildConfigSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    );

    submitting = true;
    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateConfigApi(payload)
        : addConfigApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与用户输入
    } finally {
      submitting = false;
      modalApi.lock(false);
    }
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
</script>

<template>
  <Modal class="w-[560px]">
    <Form />
  </Modal>
</template>
