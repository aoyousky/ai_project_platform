<script setup lang="ts">
import type { DictData } from '#/api/system/dict/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addDictDataApi, updateDictDataApi } from '#/api/system/dict';

import {
  createRemarkField,
  requiredTextRule,
} from '../../shared/form-schema';
import { createFormConfirmHandler } from '../../shared/form-submit';
import {
  buildDictDataSubmitPayload,
  LIST_CLASS_OPTIONS,
  toDictDataFormValues,
} from '../dict-page-logic';

interface DictDataFormModalData {
  dictType: string;
  mode: 'create' | 'edit';
  record?: DictData;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | string>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '字典类型',
      },
      fieldName: 'dictType',
      label: '字典类型',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典标签' },
      fieldName: 'dictLabel',
      label: '字典标签',
      rules: requiredTextRule('字典标签'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典键值' },
      fieldName: 'dictValue',
      label: '字典键值',
      rules: requiredTextRule('字典键值'),
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0, precision: 0 },
      defaultValue: 0,
      fieldName: 'dictSort',
      label: '字典排序',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入样式属性' },
      fieldName: 'cssClass',
      label: '样式属性',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [...LIST_CLASS_OPTIONS],
        placeholder: '请选择回显样式',
      },
      defaultValue: 'default',
      fieldName: 'listClass',
      label: '回显样式',
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

    const data = modalApi.getData<DictDataFormModalData>();
    mode.value = data.mode;
    editingId.value = data.record?.dictCode;

    const values =
      data.mode === 'edit' && data.record
        ? toDictDataFormValues(data.record)
        : {
            cssClass: '',
            dictLabel: '',
            dictSort: 0,
            dictType: data.dictType,
            dictValue: '',
            listClass: 'default',
            remark: '',
          };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改字典数据' : '新增字典数据',
    });
  },
});
const confirmHandler = createFormConfirmHandler({
  buildPayload: (values) =>
    buildDictDataSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    ),
  create: addDictDataApi,
  formApi,
  isEdit: () => mode.value === 'edit',
  modalApi,
  onSuccess: () => emit('success'),
  update: updateDictDataApi,
});

</script>

<template>
  <Modal class="w-[600px]">
    <Form />
  </Modal>
</template>
