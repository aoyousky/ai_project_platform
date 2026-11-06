<script setup lang="ts">
import type { PostVO } from '#/api/system/post/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addPostApi, updatePostApi } from '#/api/system/post';

import { buildPostFormSchema } from '../post-form-schema';
import { buildPostSubmitPayload, toPostFormValues } from '../post-page-logic';

interface PostFormModalData {
  deptOptions: TreeSelectOption[];
  mode: 'create' | 'edit';
  post?: PostVO;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingPostId = ref<number | string>();

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
    const payload = buildPostSubmitPayload(
      values,
      mode.value === 'edit' ? editingPostId.value : undefined,
    );

    modalApi.lock(true);
    try {
      await (mode.value === 'edit' ? updatePostApi(payload) : addPostApi(payload));
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

    const data = modalApi.getData<PostFormModalData>();
    mode.value = data.mode;
    editingPostId.value = data.post?.postId;

    formApi.setState({
      schema: buildPostFormSchema({ deptOptions: data.deptOptions ?? [] }),
    });

    const values =
      data.mode === 'edit' && data.post
        ? toPostFormValues(data.post)
        : {
            deptId: undefined,
            postCategory: '',
            postCode: '',
            postName: '',
            postSort: 1,
            remark: '',
            status: '0',
          };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改岗位' : '新增岗位',
    });
  },
});
</script>

<template>
  <Modal class="w-[640px]">
    <Form />
  </Modal>
</template>
