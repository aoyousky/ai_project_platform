<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  listJobsApi,
  listTasksApi,
  loginApi,
  retryBatchApi,
  SnailJobApiError,
  SnailJobAuthError,
  SnailJobUnavailableError,
  stopBatchApi,
  triggerJobApi,
} from '#/api/monitor/snailjob';

import { formatStatusTimestamp } from '../admin/admin-page-logic';
import { resolveConsoleUrl } from '../components/external-console-logic';
import ExternalConsole from '../components/external-console.vue';
import {
  canRetry,
  canStop,
  mapJobRows,
  mapTaskRows,
} from './snailjob-page-logic';

/**
 * 任务调度中心（SPEC-008 §4.2 / A-06～A-10、E-08～E-12）。
 * 本页自己登录控制台，JWT 仅存 sessionStorage；官方控制台仍保留为兜底入口（SPEC-007 A-09）。
 */
const runtimeConfig = import.meta.env.PROD
  ? (window._VBEN_ADMIN_PRO_APP_CONF_ as unknown as
      | Record<string, unknown>
      | undefined)
  : undefined;
const snailjobUrl = resolveConsoleUrl(
  'VITE_GLOB_SNAILJOB_ADMIN_URL',
  import.meta.env,
  runtimeConfig,
);

const userStore = useUserStore();
const operatorName = computed(() => userStore.userInfo?.realName ?? '—');

const hasToken = ref(Boolean(sessionStorage.getItem('snailjob_token')));
const username = ref('');
const password = ref('');
const loggingIn = ref(false);
const loginError = ref('');

const jobs = ref<Awaited<ReturnType<typeof listJobsApi>> | null>(null);
const jobsLoaded = ref(false);
const loading = ref(false);
const loginRequired = ref(false);
const errorText = ref('');

const selectedJobId = ref<null | number>(null);
const tasks = ref<Awaited<ReturnType<typeof listTasksApi>> | null>(null);
const tasksLoaded = ref(false);
const tasksLoading = ref(false);
const taskError = ref('');

const busyJobId = ref<null | number>(null);
const busyBatchId = ref<null | number>(null);
const confirmJobId = ref<null | number>(null);
const toast = ref('');
const lastAction = ref<null | string>(null);

const jobRows = computed(() => mapJobRows(jobs.value?.list ?? []));
const taskRows = computed(() => mapTaskRows(tasks.value?.list ?? []));
const jobTotal = computed(() => jobs.value?.total ?? 0);

function describeError(error: unknown): string {
  if (error instanceof SnailJobAuthError) {
    loginRequired.value = true;
    return '';
  }
  if (error instanceof SnailJobApiError) {
    return error.message;
  }
  return '控制台不可用';
}

function showToast(message: string) {
  toast.value = message;
  lastAction.value = `${operatorName.value} · ${formatStatusTimestamp(
    new Date().toISOString(),
  )} · ${message}`;
}

async function reloadJobs() {
  if (!hasToken.value) {
    return;
  }
  loading.value = true;
  jobsLoaded.value = false;
  loginRequired.value = false;
  errorText.value = '';
  jobs.value = null;
  try {
    jobs.value = await listJobsApi({ pageNo: 1, pageSize: 10 });
    jobsLoaded.value = true;
  } catch (error) {
    errorText.value = describeError(error);
  } finally {
    loading.value = false;
  }
}

async function doLogin() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    await loginApi(username.value, password.value);
    hasToken.value = true;
    await reloadJobs();
  } catch (error) {
    loginError.value =
      error instanceof SnailJobApiError ||
      error instanceof SnailJobUnavailableError
        ? error.message
        : '登录失败';
  } finally {
    loggingIn.value = false;
  }
}

async function loadTasks(jobId: number) {
  selectedJobId.value = jobId;
  tasks.value = null;
  tasksLoaded.value = false;
  taskError.value = '';
  tasksLoading.value = true;
  try {
    tasks.value = await listTasksApi(jobId);
    tasksLoaded.value = true;
  } catch (error) {
    taskError.value = describeError(error);
  } finally {
    tasksLoading.value = false;
  }
}

async function reloadTasks(jobId: number) {
  if (taskError.value !== '') {
    return;
  }
  await loadTasks(jobId);
}

function askTrigger(jobId: number) {
  if (busyJobId.value !== null) {
    return;
  }
  confirmJobId.value = jobId;
}

async function confirmTrigger() {
  const jobId = confirmJobId.value;
  confirmJobId.value = null;
  if (jobId === null || busyJobId.value !== null) {
    return;
  }
  busyJobId.value = jobId;
  try {
    await triggerJobApi(jobId);
    showToast('执行成功');
    await reloadJobs();
  } catch (error) {
    errorText.value = describeError(error);
  } finally {
    busyJobId.value = null;
  }
}

async function doStop(taskBatchId: number) {
  if (busyBatchId.value !== null) {
    return;
  }
  busyBatchId.value = taskBatchId;
  try {
    await stopBatchApi(taskBatchId);
    showToast('停止成功');
  } catch (error) {
    taskError.value = describeError(error);
  } finally {
    busyBatchId.value = null;
  }
  if (selectedJobId.value !== null) {
    await reloadTasks(selectedJobId.value);
  }
}

async function doRetry(taskBatchId: number) {
  if (busyBatchId.value !== null) {
    return;
  }
  busyBatchId.value = taskBatchId;
  try {
    await retryBatchApi(taskBatchId);
    showToast('重试成功');
  } catch (error) {
    taskError.value = describeError(error);
  } finally {
    busyBatchId.value = null;
  }
  if (selectedJobId.value !== null) {
    await reloadTasks(selectedJobId.value);
  }
}

onMounted(reloadJobs);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full w-full flex-col gap-4 overflow-auto p-4">
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">任务调度中心</h2>
          <button
            data-testid="snailjob-refresh"
            class="rounded border border-gray-300 px-3 py-1 text-sm"
            :disabled="loading"
            type="button"
            @click="reloadJobs"
          >
            刷新
          </button>
        </div>

        <div
          v-if="loginRequired"
          data-testid="snailjob-login-tip"
          class="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm"
        >
          <span>请先登录任务调度中心</span>
          <a
            data-testid="snailjob-open-console"
            class="text-primary ml-2 underline"
            href="/snail-job"
            rel="noopener noreferrer"
            target="_blank"
          >
            打开控制台
          </a>
        </div>

        <form
          v-else-if="!hasToken"
          data-testid="snailjob-login-form"
          class="flex max-w-md flex-col gap-2 text-sm"
          @submit.prevent="doLogin"
        >
          <input
            v-model="username"
            data-testid="snailjob-username"
            class="rounded border border-gray-300 px-2 py-1"
            placeholder="用户名"
          />
          <input
            v-model="password"
            data-testid="snailjob-password"
            class="rounded border border-gray-300 px-2 py-1"
            placeholder="密码"
            type="password"
          />
          <button
            data-testid="snailjob-login"
            class="rounded border border-gray-300 px-3 py-1"
            :disabled="loggingIn"
            type="submit"
          >
            登录
          </button>
          <p
            v-if="loginError"
            data-testid="snailjob-login-error"
            class="text-red-600"
          >
            {{ loginError }}
          </p>
        </form>

        <p v-if="loading" class="text-sm">加载中…</p>
        <p
          v-if="errorText"
          data-testid="snailjob-error"
          class="text-sm text-red-600"
        >
          {{ errorText }}
        </p>
        <p
          v-if="toast"
          data-testid="action-toast"
          class="text-sm text-green-700"
        >
          {{ toast }}
        </p>

        <p
          v-if="hasToken && !loginRequired && jobsLoaded && jobTotal === 0"
          data-testid="snailjob-empty"
        >
          暂无任务
        </p>

        <table
          v-if="hasToken && !loginRequired && jobRows.length > 0"
          data-testid="snailjob-job-list"
          class="w-full border-collapse text-sm"
        >
          <thead>
            <tr class="border-b text-left">
              <th class="p-2">任务名</th>
              <th class="p-2">组</th>
              <th class="p-2">状态</th>
              <th class="p-2">下次触发</th>
              <th class="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="job in jobRows"
              :key="job.id"
              data-testid="snailjob-job-row"
              class="border-b"
            >
              <td data-testid="snailjob-job-name" class="p-2">
                {{ job.jobName }}
              </td>
              <td class="p-2">{{ job.groupName }}</td>
              <td data-testid="snailjob-job-status" class="p-2">
                {{ job.statusText }}
              </td>
              <td class="p-2">{{ job.nextTriggerAt }}</td>
              <td class="flex gap-2 p-2">
                <button
                  data-testid="snailjob-task-view"
                  class="rounded border border-gray-300 px-2 py-1"
                  type="button"
                  @click="loadTasks(job.id)"
                >
                  执行记录
                </button>
                <button
                  data-testid="snailjob-trigger"
                  class="rounded border border-gray-300 px-2 py-1"
                  :disabled="busyJobId === job.id"
                  type="button"
                  @click="askTrigger(job.id)"
                >
                  执行
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div
          v-if="hasToken && !loginRequired"
          data-testid="snailjob-pager"
          class="text-sm text-gray-600"
          :data-total="jobTotal"
        >
          共 {{ jobTotal }} 条
        </div>

        <div
          v-if="confirmJobId !== null"
          data-testid="snailjob-confirm"
          class="rounded border border-gray-300 bg-gray-50 p-3 text-sm"
        >
          <p>确认执行任务 {{ confirmJobId }}？</p>
          <div class="mt-2 flex gap-2">
            <button
              data-testid="snailjob-confirm-ok"
              class="rounded border border-gray-300 px-3 py-1"
              type="button"
              @click="confirmTrigger"
            >
              确定
            </button>
            <button
              data-testid="snailjob-confirm-cancel"
              class="rounded border border-gray-300 px-3 py-1"
              type="button"
              @click="confirmJobId = null"
            >
              取消
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="hasToken && !loginRequired && selectedJobId !== null"
        class="flex flex-col gap-2"
      >
        <h3 class="font-semibold">执行记录 · 任务 {{ selectedJobId }}</h3>
        <p v-if="tasksLoading" class="text-sm">加载中…</p>
        <p
          v-if="taskError"
          data-testid="snailjob-task-error"
          class="text-sm text-red-600"
        >
          {{ taskError }}
        </p>
        <p
          v-if="tasksLoaded && taskRows.length === 0"
          data-testid="snailjob-task-empty"
        >
          暂无数据
        </p>
        <table
          v-if="taskRows.length > 0"
          data-testid="snailjob-task-list"
          class="w-full border-collapse text-sm"
        >
          <thead>
            <tr class="border-b text-left">
              <th class="p-2">批次</th>
              <th class="p-2">状态</th>
              <th class="p-2">开始时间</th>
              <th class="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in taskRows"
              :key="task.taskBatchId"
              data-testid="snailjob-task-row"
              class="border-b"
            >
              <td class="p-2">{{ task.taskBatchId }}</td>
              <td class="p-2">{{ task.statusText }}</td>
              <td class="p-2">{{ task.createDt }}</td>
              <td class="flex gap-2 p-2">
                <button
                  data-testid="snailjob-stop"
                  class="rounded border border-gray-300 px-2 py-1"
                  :disabled="
                    !canStop(task.status) || busyBatchId === task.taskBatchId
                  "
                  type="button"
                  @click="doStop(task.taskBatchId)"
                >
                  停止
                </button>
                <button
                  data-testid="snailjob-retry"
                  class="rounded border border-gray-300 px-2 py-1"
                  :disabled="
                    !canRetry(task.status) || busyBatchId === task.taskBatchId
                  "
                  type="button"
                  @click="doRetry(task.taskBatchId)"
                >
                  重试
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="lastAction"
          data-testid="snailjob-last-action"
          class="text-xs text-gray-500"
        >
          最近操作：{{ lastAction }}
        </p>
      </section>

      <section class="flex min-h-0 flex-col gap-2">
        <h3 class="font-semibold">官方控制台（兜底入口）</h3>
        <ExternalConsole :url="snailjobUrl" />
      </section>
    </div>
  </Page>
</template>
