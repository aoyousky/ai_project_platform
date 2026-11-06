<script setup lang="ts">
import type { Id } from '#/api/system/common';
import type { UserQuery, UserVO } from '#/api/system/user/types';
import type { DeptTreeOption } from '#/api/system/user/types';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, Button, message, Spin, Switch, Tree } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPostListApi } from '#/api/system/post';
import {
  changeUserStatusApi,
  deleteUserApi,
  exportUserApi,
  getUserApi,
  getUserDeptTreeApi,
  getUserListApi,
} from '#/api/system/user';
import { addDateRange, removeEmptyParams } from '#/utils/system/query';

import ResetPasswordModal from './components/reset-password-modal.vue';
import UserForm from './components/user-form.vue';
import UserImportModal from './components/user-import-modal.vue';
import {
  buildDeptSelectOptions,
  canModifyUser,
  resolveOutOfRangePage,
  runStatusToggle,
} from './user-page-logic';

const router = useRouter();
const userStore = useUserStore();
const currentUserId = computed<Id | undefined>(
  () => userStore.userInfo?.userId as Id | undefined,
);

const deptTree = ref<DeptTreeOption[]>([]);
const deptLoading = ref(false);
const deptId = ref<Id | null>(null);

const deptSelectOptions = computed(() => buildDeptSelectOptions(deptTree.value));

async function loadDeptTree() {
  deptLoading.value = true;
  try {
    deptTree.value = await getUserDeptTreeApi();
  } finally {
    deptLoading.value = false;
  }
}

function handleDeptSelect(
  keys: Array<number | string>,
  info: { selected: boolean },
) {
  deptId.value = info.selected && keys.length > 0 ? keys[keys.length - 1]! : null;
  gridApi.reload();
}

const searchSchema = [
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入用户名称' },
    fieldName: 'userName',
    label: '用户名称',
  },
  {
    component: 'Input' as const,
    componentProps: { placeholder: '请输入手机号码' },
    fieldName: 'phonenumber',
    label: '手机号码',
  },
  {
    component: 'Select' as const,
    componentProps: {
      options: [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' },
      ],
      placeholder: '用户状态',
    },
    fieldName: 'status',
    label: '用户状态',
  },
  {
    component: 'RangePicker' as const,
    componentProps: { valueFormat: 'YYYY-MM-DD' },
    fieldName: 'dateRange',
    label: '创建时间',
  },
];

/** 查询条件：搜索表单 + 日期范围 + 左侧部门树 */
async function buildQuery(): Promise<UserQuery> {
  const formValues = (await gridApi.formApi.getValues()) as Record<string, any>;
  const { dateRange, ...rest } = formValues;
  return removeEmptyParams(
    addDateRange(
      { ...rest, deptId: deptId.value ?? undefined },
      dateRange as [string, string] | undefined,
    ),
  ) as UserQuery;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: searchSchema,
  },
  gridOptions: {
    columns: [
      { type: 'checkbox', width: 50 },
      { field: 'userId', title: '用户编号', width: 110 },
      { field: 'userName', title: '用户名称', minWidth: 120, showOverflow: true },
      { field: 'nickName', title: '用户昵称', minWidth: 120, showOverflow: true },
      { field: 'deptName', title: '部门', minWidth: 120, showOverflow: true },
      {
        field: 'phonenumber',
        title: '手机号码',
        minWidth: 120,
        showOverflow: true,
      },
      { field: 'status', slots: { default: 'status' }, title: '状态', width: 90 },
      {
        field: 'createTime',
        title: '创建时间',
        minWidth: 160,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 270,
      },
    ],
    emptyText: '暂无数据',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (
          params: { page: { currentPage: number; pageSize: number } },
          formValues: Record<string, any>,
        ) => {
          const { page } = params;
          const { dateRange, ...rest } = formValues ?? {};
          const query = removeEmptyParams(
            addDateRange(
              {
                ...rest,
                deptId: deptId.value ?? undefined,
                pageNum: page.currentPage,
                pageSize: page.pageSize,
              },
              dateRange as [string, string] | undefined,
            ),
          ) as UserQuery;

          const { rows, total } = await getUserListApi(query);
          // E-10：页码越界时后端返回空页；回退到最后一页，避免表格停在空页
          const fallbackPage = resolveOutOfRangePage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            rowCount: rows.length,
            total,
          });
          if (fallbackPage === null) {
            return { items: rows, total };
          }
          const corrected = await getUserListApi({
            ...query,
            pageNum: fallbackPage,
          });
          return { items: corrected.rows, total: corrected.total };
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'userId' },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  },
});

const [UserFormModal, userFormModalApi] = useVbenModal({
  connectedComponent: UserForm,
  destroyOnClose: true,
});

const [ResetPasswordModalComp, resetPasswordModalApi] = useVbenModal({
  connectedComponent: ResetPasswordModal,
  destroyOnClose: true,
});

const [UserImportModalComp, userImportModalApi] = useVbenModal({
  connectedComponent: UserImportModal,
  destroyOnClose: true,
});

async function handleCreate() {
  // 无 ID 预处理只回填角色：后端仅在带 userId 时才返回 posts，
  // 故岗位另取 `status='0'` 的列表（接口自带数据权限，即“当前账号可分配”）
  const [info, posts] = await Promise.all([
    getUserApi(),
    getPostListApi({ pageSize: 500, status: '0' }),
  ]);
  userFormModalApi
    .setData({
      currentUserId: currentUserId.value,
      deptOptions: deptSelectOptions.value,
      info: { ...info, posts: posts.rows },
      mode: 'create',
    })
    .open();
}

async function handleEdit(row: any) {
  if (!canModifyUser(row.userId)) {
    return;
  }
  const info = await getUserApi(row.userId);
  userFormModalApi
    .setData({
      currentUserId: currentUserId.value,
      deptOptions: deptSelectOptions.value,
      info,
      mode: 'edit',
    })
    .open();
}

function handleAuthRole(row: any) {
  if (!canModifyUser(row.userId)) {
    return;
  }
  router.push(`/system/user-auth/role/${row.userId}`);
}

function openResetPassword(row: any) {
  if (!canModifyUser(row.userId)) {
    return;
  }
  resetPasswordModalApi.setData({ userId: String(row.userId) }).open();
}

function confirmDelete(userIds: Array<Id | string>) {
  const ids = userIds.map(String);
  if (ids.length === 0) {
    message.warning('请选择要删除的用户');
    return;
  }
  if (ids.some((id) => !canModifyUser(id))) {
    message.error('不允许操作超级管理员用户');
    return;
  }

  AntModal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${ids.length} 个用户？`,
    okText: '确定',
    onOk: async () => {
      await deleteUserApi(ids);
      message.success('删除成功');
      await gridApi.reload();
    },
    title: '删除确认',
  });
}

function handleBatchDelete() {
  const rows = (gridApi.grid.getCheckboxRecords?.() ?? []) as UserVO[];
  confirmDelete(rows.map((row) => row.userId));
}

async function handleStatusChange(row: any, checked: boolean) {
  if (!canModifyUser(row.userId)) {
    return;
  }
  const nextStatus = checked ? '0' : '1';
  await runStatusToggle({
    apply: (status) => {
      row.status = status;
    },
    commit: () =>
      changeUserStatusApi({ status: nextStatus, userId: row.userId }),
    nextStatus,
    previousStatus: row.status,
    reload: () => gridApi.reload(),
  });
}

async function handleExport() {
  await exportUserApi(await buildQuery());
}

function openImport() {
  userImportModalApi.open();
}

onMounted(loadDeptTree);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full gap-3">
      <div class="w-[240px] shrink-0 overflow-auto rounded bg-card p-3">
        <div class="mb-2 text-sm font-medium">部门</div>
        <Spin :spinning="deptLoading">
          <Tree
            block-node
            :field-names="{ children: 'children', key: 'id', title: 'label' }"
            :tree-data="deptTree"
            @select="handleDeptSelect"
          />
        </Spin>
      </div>

      <div class="min-w-0 flex-1">
        <Grid>
          <template #toolbar-actions>
            <Button
              v-access:code="['system:user:add']"
              type="primary"
              @click="handleCreate"
            >
              新增
            </Button>
            <Button
              v-access:code="['system:user:remove']"
              @click="handleBatchDelete"
            >
              删除
            </Button>
            <Button
              v-access:code="['system:user:export']"
              @click="handleExport"
            >
              导出
            </Button>
            <Button
              v-access:code="['system:user:import']"
              @click="openImport"
            >
              导入
            </Button>
          </template>

          <template #status="{ row }">
            <Switch
              :checked="row.status === '0'"
              :disabled="!canModifyUser(row.userId)"
              @change="(checked: boolean) => handleStatusChange(row, checked)"
            />
          </template>

          <template #operation="{ row }">
            <template v-if="canModifyUser(row.userId)">
              <Button
                v-access:code="['system:user:edit']"
                size="small"
                type="link"
                @click="handleEdit(row)"
              >
                修改
              </Button>
              <Button
                v-access:code="['system:user:edit']"
                size="small"
                type="link"
                @click="handleAuthRole(row)"
              >
                分配角色
              </Button>
              <Button
                v-access:code="['system:user:resetPwd']"
                size="small"
                type="link"
                @click="openResetPassword(row)"
              >
                重置密码
              </Button>
              <Button
                v-access:code="['system:user:remove']"
                size="small"
                type="link"
                @click="confirmDelete([row.userId])"
              >
                删除
              </Button>
            </template>
          </template>
        </Grid>
      </div>
    </div>

    <UserFormModal @success="gridApi.reload()" />
    <ResetPasswordModalComp />
    <UserImportModalComp @success="gridApi.reload()" />
  </Page>
</template>
