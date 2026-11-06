<script setup lang="ts">
import type { UploadProps } from 'antdv-next';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Checkbox, message, Upload } from 'antdv-next';

import {
  downloadUserImportTemplateApi,
  importUserDataApi,
} from '#/api/system/user';

import { importResultText } from '../user-page-logic';

const emit = defineEmits<{ success: [] }>();

const selectedFile = ref<File | null>(null);
const updateSupport = ref(false);
const resultText = ref('');
const success = ref(false);

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    message.error('仅支持 xls / xlsx 格式的文件');
    return false;
  }
  selectedFile.value = file;
  resultText.value = '';
  return false;
};

async function handleDownloadTemplate() {
  await downloadUserImportTemplateApi();
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!selectedFile.value) {
      message.warning('请选择要导入的文件');
      return;
    }

    modalApi.lock(true);
    try {
      const result = await importUserDataApi({
        file: selectedFile.value,
        updateSupport: updateSupport.value,
      });
      // 后端以 msg 返回成功/失败统计，按纯文本展示（禁止 HTML 拼接）
      resultText.value = importResultText(result);
      success.value = result.code === 200;
      if (success.value) {
        emit('success');
      }
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    selectedFile.value = null;
    updateSupport.value = false;
    resultText.value = '';
    success.value = false;
  },
});
</script>

<template>
  <Modal class="w-[560px]" title="用户导入">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <Upload
          accept=".xls,.xlsx"
          :before-upload="beforeUpload"
          :max-count="1"
          :show-upload-list="false"
        >
          <Button>选择文件</Button>
        </Upload>
        <span class="text-sm">
          {{ selectedFile?.name ?? '未选择文件' }}
        </span>
      </div>

      <Button type="link" @click="handleDownloadTemplate">
        下载导入模板
      </Button>

      <Checkbox v-model:checked="updateSupport">
        是否更新已经存在的用户数据
      </Checkbox>

      <div
        v-if="resultText"
        class="whitespace-pre-wrap break-all rounded p-2"
        :class="success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
      >
        {{ resultText }}
      </div>
    </div>
  </Modal>
</template>
