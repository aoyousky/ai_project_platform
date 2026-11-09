<script setup lang="ts">
import type { DictType } from '#/api/system/dict/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { addDictTypeApi, updateDictTypeApi } from '#/api/system/dict';

import {
  buildDictTypeSubmitPayload,
  toDictTypeFormValues,
} from '../dict-page-logic';

interface DictTypeFormModalData {
  mode: 'create' | 'edit';
  record?: DictType;
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
      componentProps: { maxlength: 100, placeholder: '请输入字典名称' },
      fieldName: 'dictName',
      label: '字典名称',
      rules: z
        .string()
        .min(1, '请输入字典名称')
        .max(100, '字典名称不能超过 100 个字符'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典类型' },
      fieldName: 'dictType',
      label: '字典类型',
      rules: z
        .string()
        .min(1, '请输入字典类型')
        .max(100, '字典类型不能超过 100 个字符')
        .regex(
          /^[a-z][a-z0-9_]*$/,
          '字典类型只能以小写字母开头，仅含小写字母、数字和下划线',
        ),
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
    const payload = buildDictTypeSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    );

    submitting = true;
    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateDictTypeApi(payload)
        : addDictTypeApi(payload));
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

    const data = modalApi.getData<DictTypeFormModalData>();
    mode.value = data.mode;
    editingId.value = data.record?.dictId;

    const values =
      data.mode === 'edit' && data.record
        ? toDictTypeFormValues(data.record)
        : { dictName: '', dictType: '', remark: '' };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改字典类型' : '新增字典类型',
    });
  },
});
</script>

<template>
  <Modal class="w-[560px]">
    <Form />
  </Modal>
</template>
