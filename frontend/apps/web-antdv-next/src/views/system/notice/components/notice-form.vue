<script setup lang="ts">
import type { Notice } from '#/api/system/notice/types';

import { ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { addNoticeApi, updateNoticeApi } from '#/api/system/notice';
import { useDict } from '#/composables/use-dict';

import { buildNoticeSubmitPayload, toNoticeFormValues } from '../notice-page-logic';

interface NoticeFormModalData {
  mode: 'create' | 'edit';
  record?: Notice;
}

const emit = defineEmits<{ success: [] }>();

const { sys_notice_status: statusDict, sys_notice_type: typeDict } = useDict(
  'sys_notice_type',
  'sys_notice_status',
);

const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | string>();
let submitting = false;

function dictOptions(
  list: Array<{ dictLabel?: null | string; dictValue?: null | string }>,
  fallback: Array<{ label: string; value: string }>,
) {
  const options = (list ?? [])
    .filter((item) => item.dictValue)
    .map((item) => ({
      label: String(item.dictLabel ?? item.dictValue),
      value: String(item.dictValue),
    }));
  return options.length > 0 ? options : fallback;
}

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 50, placeholder: '请输入公告标题' },
      fieldName: 'noticeTitle',
      label: '公告标题',
      rules: z
        .string()
        .trim()
        .min(1, '请输入公告标题')
        .max(50, '公告标题不能超过 50 个字符')
        .refine((value) => !/[<>]/.test(value), '公告标题不能包含 < 或 >'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '通知', value: '1' },
          { label: '公告', value: '2' },
        ],
      },
      defaultValue: '1',
      fieldName: 'noticeType',
      label: '公告类型',
      rules: z.string().min(1, '请选择公告类型'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '正常', value: '0' },
          { label: '关闭', value: '1' },
        ],
      },
      defaultValue: '0',
      fieldName: 'status',
      label: '状态',
      rules: z.string().min(1, '请选择状态'),
    },
    {
      component: 'Tiptap',
      componentProps: {
        maxHeight: 320,
        minHeight: 220,
        placeholder: '请输入公告内容',
        previewable: false,
      },
      fieldName: 'noticeContent',
      label: '公告内容',
    },
  ],
  showDefaultActions: false,
});

watch(
  [typeDict, statusDict],
  () => {
    formApi.updateSchema([
      {
        componentProps: {
          options: dictOptions(typeDict.value ?? [], [
            { label: '通知', value: '1' },
            { label: '公告', value: '2' },
          ]),
        },
        fieldName: 'noticeType',
      },
      {
        componentProps: {
          options: dictOptions(statusDict.value ?? [], [
            { label: '正常', value: '0' },
            { label: '关闭', value: '1' },
          ]),
        },
        fieldName: 'status',
      },
    ]);
  },
  { immediate: true },
);

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
    const payload = buildNoticeSubmitPayload(
      values,
      mode.value === 'edit' ? editingId.value : undefined,
    );

    submitting = true;
    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateNoticeApi(payload)
        : addNoticeApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // E-11：后端拒绝时请求层已提示 msg，弹窗与已填内容保持
    } finally {
      submitting = false;
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<NoticeFormModalData>();
    mode.value = data.mode;
    editingId.value = data.record?.noticeId;
    const isEdit = data.mode === 'edit' && data.record;

    const values = isEdit
      ? toNoticeFormValues(data.record!)
      : {
          noticeContent: '',
          noticeTitle: '',
          noticeType: '1',
          status: '0',
        };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: isEdit ? '修改公告' : '新增公告',
    });
  },
});
</script>

<template>
  <Modal class="w-[760px]">
    <Form />
  </Modal>
</template>
