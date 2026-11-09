<script setup lang="ts">
import type { DictType } from '#/api/system/dict/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addDictTypeApi, updateDictTypeApi } from '#/api/system/dict';

import {
  createRemarkField,
  requiredTextRule,
} from '../../shared/form-schema';
import { createFormConfirmHandler } from '../../shared/form-submit';
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

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典名称' },
      fieldName: 'dictName',
      label: '字典名称',
      rules: requiredTextRule('字典名称'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典类型' },
      fieldName: 'dictType',
      label: '字典类型',
      rules: requiredTextRule('字典类型').regex(
        /^[a-z][a-z0-9_]*$/,
        '字典类型只能以小写字母开头，仅含小写字母、数字和下划线',
      ),
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
const confirmHandler = createFormConfirmHandler({
  buildPayload: (values) =>
    buildDictTypeSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    ),
  create: addDictTypeApi,
  formApi,
  isEdit: () => mode.value === 'edit',
  modalApi,
  onSuccess: () => emit('success'),
  update: updateDictTypeApi,
});

</script>

<template>
  <Modal class="w-[560px]">
    <Form />
  </Modal>
</template>
