<script setup lang="ts">
import type { DictData } from '#/api/system/dict/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { addDictDataApi, updateDictDataApi } from '#/api/system/dict';

import {
  buildDictDataSubmitPayload,
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
let submitting = false;

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
      rules: z
        .string()
        .min(1, '请输入字典标签')
        .max(100, '字典标签不能超过 100 个字符'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入字典键值' },
      fieldName: 'dictValue',
      label: '字典键值',
      rules: z
        .string()
        .min(1, '请输入字典键值')
        .max(100, '字典键值不能超过 100 个字符'),
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
        options: [
          { label: '默认', value: 'default' },
          { label: '主要', value: 'primary' },
          { label: '成功', value: 'success' },
          { label: '信息', value: 'info' },
          { label: '警告', value: 'warning' },
          { label: '危险', value: 'danger' },
        ],
        placeholder: '请选择回显样式',
      },
      defaultValue: 'default',
      fieldName: 'listClass',
      label: '回显样式',
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
    const payload = buildDictDataSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    );

    submitting = true;
    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateDictDataApi(payload)
        : addDictDataApi(payload));
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
</script>

<template>
  <Modal class="w-[600px]">
    <Form />
  </Modal>
</template>
