<script setup lang="ts">
import type { UploadProps } from 'antdv-next';

import type { Oss } from '#/api/system/oss/types';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Modal as AntModal, Button, message, Upload } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getConfigKeyApi,
  updateConfigByKeyApi,
} from '#/api/system/config';
import {
  delOssApi,
  downloadOssApi,
  listOssApi,
  uploadOssApi,
} from '#/api/system/oss';
import { resolveOutOfRangePage } from '#/utils/system/pagination';

import {
  buildOssQuery,
  buildPreviewTogglePayload,
  downloadFileName,
  isPreviewableImage,
  isPreviewEnabled,
  PREVIEW_CONFIG_KEY,
  toUploadSummary,
} from './oss-page-logic';

const router = useRouter();

/** A-12：预览开关值来自参数；写入失败时保持原值 */
const previewEnabled = ref(false);

async function loadPreviewSetting(): Promise<void> {
  try {
    previewEnabled.value = isPreviewEnabled(
      await getConfigKeyApi(PREVIEW_CONFIG_KEY),
    );
  } catch {
    // 读取失败按关闭处理：不渲染图片，不影响列表
    previewEnabled.value = false;
  }
}

onMounted(loadPreviewSetting);

const [OssGrid, ossGridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入文件名' },
        fieldName: 'fileName',
        label: '文件名',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入原名' },
        fieldName: 'originalName',
        label: '原名',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入文件后缀' },
        fieldName: 'fileSuffix',
        label: '文件后缀',
      },
      {
        component: 'Input' as const,
        componentProps: { placeholder: '请输入服务商' },
        fieldName: 'service',
        label: '服务商',
      },
      {
        component: 'RangePicker' as const,
        componentProps: { valueFormat: 'YYYY-MM-DD' },
        fieldName: 'dateRange',
        label: '创建时间',
      },
    ],
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      {
        field: 'fileName',
        minWidth: 180,
        showOverflow: true,
        title: '文件名',
      },
      {
        field: 'originalName',
        minWidth: 180,
        showOverflow: true,
        title: '原名',
      },
      {
        field: 'fileSuffix',
        minWidth: 100,
        showOverflow: true,
        title: '文件后缀',
      },
      {
        field: 'url',
        minWidth: 220,
        slots: { default: 'preview' },
        title: '文件展示',
      },
      {
        field: 'createTime',
        minWidth: 160,
        title: '创建时间',
      },
      {
        field: 'createByName',
        minWidth: 120,
        showOverflow: true,
        title: '上传人',
      },
      {
        field: 'service',
        minWidth: 100,
        showOverflow: true,
        title: '服务商',
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 100,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (params: any, formValues: Record<string, any>) => {
          const page = params.page;
          const query = buildOssQuery(formValues ?? {}, page);
          const { rows, total } = await listOssApi(query);
          // E-25：页码越界时回退到有效页，避免空页/NaN
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await listOssApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'ossId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

/** E-19：空文件不发出上传请求；失败时列表保持不变 */
async function handleUpload(file: File): Promise<void> {
  if (!file || file.size === 0) {
    message.error('不能上传空文件');
    return;
  }
  try {
    const summary = toUploadSummary(await uploadOssApi(file), file.name);
    message.success(`上传成功：${summary.originalName || summary.fileName}`);
    await ossGridApi.reload();
  } catch {
    // 请求层已提示后端 msg；列表不增加记录
  }
}

const beforeUploadFile: UploadProps['beforeUpload'] = (file) => {
  void handleUpload(file as unknown as File);
  return false;
};

function confirmDelete(rows: Array<Record<string, any>>) {
  const records = rows as Oss[];
  if (records.length === 0) {
    message.warning('请选择要删除的文件');
    return;
  }
  const ids = records.map((row) => row.ossId);
  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 个文件？`,
    okText: '确定',
    onOk: async () => {
      try {
        await delOssApi(ids);
        message.success('删除成功');
        await ossGridApi.reload();
      } catch {
        // E-21：删除被拒时行保留，请求层已提示 msg
      }
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  confirmDelete((ossGridApi.grid.getCheckboxRecords?.() ?? []) as Oss[]);
}

/** E-29：下载失败展示后端 msg，不保存损坏文件 */
async function handleDownload(row: Record<string, any>) {
  try {
    await downloadOssApi(row.ossId, downloadFileName(row as Oss));
  } catch (error) {
    message.error(error instanceof Error ? error.message : '下载失败');
  }
}

/** A-12 / A-13：预览开关需二次确认；失败时开关值回滚 */
function handleTogglePreview() {
  const payload = buildPreviewTogglePayload(previewEnabled.value);
  AntModal.confirm({
    cancelText: '取消',
    content:
      payload.configValue === 'true'
        ? '确认开启文件列表图片预览？'
        : '确认关闭文件列表图片预览？',
    okText: '确定',
    onOk: async () => {
      try {
        await updateConfigByKeyApi(payload);
        previewEnabled.value = isPreviewEnabled(payload.configValue);
        message.success(payload.configValue === 'true' ? '已开启预览' : '已关闭预览');
        await ossGridApi.reload();
      } catch {
        // 写入被拒：保持原开关值，列表不变
      }
    },
    title: '预览开关确认',
  });
}

/** FR-036：配置管理入口跳转隐藏文件配置页 */
function goOssConfig() {
  router.push('/system/oss-config/index');
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full">
      <OssGrid>
        <template #toolbar-actions>
          <Upload
            accept="*/*"
            :before-upload="beforeUploadFile"
            :show-upload-list="false"
          >
            <Button v-access:code="['system:oss:upload']">上传文件</Button>
          </Upload>
          <Upload
            accept="image/*"
            :before-upload="beforeUploadFile"
            :show-upload-list="false"
          >
            <Button v-access:code="['system:oss:upload']">上传图片</Button>
          </Upload>
          <Button
            v-access:code="['system:oss:remove']"
            @click="handleBatchDelete"
          >
            删除
          </Button>
          <Button
            v-access:code="['system:ossConfig:list']"
            @click="goOssConfig"
          >
            配置管理
          </Button>
          <Button
            v-access:code="['system:config:edit']"
            @click="handleTogglePreview"
          >
            预览开关
          </Button>
        </template>

        <template #preview="{ row }">
          <img
            v-if="isPreviewableImage(row.fileSuffix, previewEnabled)"
            :alt="row.originalName || row.fileName"
            :src="row.url"
            class="h-10 w-10 object-cover"
          />
          <span v-else class="break-all text-xs">{{ row.url }}</span>
        </template>

        <template #operation="{ row }">
          <Button
            v-access:code="['system:oss:download']"
            size="small"
            type="link"
            @click="handleDownload(row)"
          >
            下载
          </Button>
        </template>
      </OssGrid>
    </div>
  </Page>
</template>
