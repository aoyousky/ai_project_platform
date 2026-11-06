<script setup lang="ts">
import type { DeptVO } from '#/api/system/dept/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addDeptApi, updateDeptApi } from '#/api/system/dept';

import { buildDeptFormSchema } from '../dept-form-schema';
import { buildDeptFormValues, buildDeptSubmitPayload } from '../dept-page-logic';

interface DeptFormModalData {
  dept?: DeptVO;
  mode: 'create' | 'edit';
  parentId?: number | string;
  parentOptions: TreeSelectOption[];
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingDeptId = ref<number | string>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = (await formApi.getValues()) as Record<string, any>;
    const payload = buildDeptSubmitPayload(
      values,
      mode.value === 'edit' ? editingDeptId.value : undefined,
    );

    modalApi.lock(true);
    try {
      await (mode.value === 'edit' ? updateDeptApi(payload) : addDeptApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与用户输入
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<DeptFormModalData>();
    mode.value = data.mode;
    editingDeptId.value = data.dept?.deptId;

    formApi.setState({
      schema: buildDeptFormSchema({
        parentOptions: [
          { label: '顶级部门', value: '0', children: data.parentOptions ?? [] },
        ],
      }),
    });

    const values =
      data.mode === 'edit' && data.dept
        ? buildDeptFormValues(data.dept)
        : {
            deptCategory: '',
            deptName: '',
            email: '',
            leader: '',
            orderNum: 1,
            parentId: String(data.parentId ?? '0'),
            phone: '',
            status: '0',
          };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改部门' : '新增部门',
    });
  },
});
</script>

<template>
  <Modal class="w-[640px]">
    <Form />
  </Modal>
</template>
