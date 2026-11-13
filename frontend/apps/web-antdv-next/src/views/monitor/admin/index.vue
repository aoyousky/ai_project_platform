<script setup lang="ts">
import type { ConsolePropertySource } from '#/api/monitor/admin';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  ConsoleAuthError,
  ConsoleTimeoutError,
  fetchApplications,
  fetchInstanceEnv,
  fetchInstanceLog,
} from '#/api/monitor/admin';

import { resolveConsoleUrl } from '../components/external-console-logic';
import ExternalConsole from '../components/external-console.vue';
import {
  formatStatusTimestamp,
  maskPropertySources,
  tailLines,
} from './admin-page-logic';

/**
 * Admin 监控（SPEC-008 §4.1 / A-01～A-05、A-11、E-01～E-03、E-07、E-11）。
 * 数据直连同源控制台 `/admin/*`；官方控制台仍以内嵌形式保留为兜底（SPEC-007 A-08）。
 */
const ENV_LIMIT = 200;
const LOG_LIMIT = 200;

const runtimeConfig = import.meta.env.PROD
  ? (window._VBEN_ADMIN_PRO_APP_CONF_ as unknown as
      | Record<string, unknown>
      | undefined)
  : undefined;
const adminUrl = resolveConsoleUrl(
  'VITE_GLOB_MONITOR_ADMIN_URL',
  import.meta.env,
  runtimeConfig,
);

const apps = ref<Awaited<ReturnType<typeof fetchApplications>>>([]);
const loading = ref(false);
const loaded = ref(false);
const loginRequired = ref(false);
const errorText = ref('');

const envSourceId = ref('');
const envSources = ref<ConsolePropertySource[]>([]);
const envLoading = ref(false);
const envError = ref('');
const expandedSources = ref<Record<string, boolean>>({});

const logSourceId = ref('');
const logLines = ref<string[]>([]);
const logLoading = ref(false);
const logError = ref('');

const userStore = useUserStore();
const operatorName = computed(() => userStore.userInfo?.realName ?? '—');

const envVisible = computed(() =>
  maskPropertySources(envSources.value.slice(0, ENV_LIMIT)),
);
const envTruncated = computed(() => envSources.value.length > ENV_LIMIT);

const logText = computed(() => logLines.value.join('\n'));
const logTruncated = computed(() => logLines.value.length >= LOG_LIMIT);

function describeError(error: unknown): string {
  return error instanceof ConsoleTimeoutError
    ? '控制台连接超时'
    : '控制台不可用';
}

async function reload() {
  loading.value = true;
  loaded.value = false;
  loginRequired.value = false;
  errorText.value = '';
  apps.value = [];
  try {
    apps.value = await fetchApplications();
    loaded.value = true;
  } catch (error) {
    if (error instanceof ConsoleAuthError) {
      loginRequired.value = true;
    } else {
      errorText.value = describeError(error);
    }
  } finally {
    loading.value = false;
  }
}

async function loadEnv(instanceId: string) {
  envSourceId.value = instanceId;
  envSources.value = [];
  expandedSources.value = {};
  envError.value = '';
  envLoading.value = true;
  try {
    envSources.value = await fetchInstanceEnv(instanceId);
  } catch (error) {
    if (error instanceof ConsoleAuthError) {
      loginRequired.value = true;
    } else {
      envError.value = describeError(error);
    }
  } finally {
    envLoading.value = false;
  }
}

async function loadLog(instanceId: string) {
  logSourceId.value = instanceId;
  logLines.value = [];
  logError.value = '';
  logLoading.value = true;
  try {
    const text = await fetchInstanceLog(instanceId);
    logLines.value = tailLines(text, LOG_LIMIT);
  } catch (error) {
    if (error instanceof ConsoleAuthError) {
      loginRequired.value = true;
    } else {
      logError.value = describeError(error);
    }
  } finally {
    logLoading.value = false;
  }
}

function toggleSource(name: string) {
  expandedSources.value = {
    ...expandedSources.value,
    [name]: !expandedSources.value[name],
  };
}

onMounted(reload);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full w-full flex-col gap-4 overflow-auto p-4">
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Admin 监控</h2>
          <button
            data-testid="admin-refresh"
            class="rounded border border-gray-300 px-3 py-1 text-sm"
            :disabled="loading"
            type="button"
            @click="reload"
          >
            刷新
          </button>
        </div>

        <p v-if="loading" data-testid="admin-loading" class="text-sm">
          加载中…
        </p>
        <p
          v-if="errorText"
          data-testid="admin-error"
          class="text-sm text-red-600"
        >
          {{ errorText }}
        </p>

        <div
          v-if="loginRequired"
          data-testid="console-login-tip"
          class="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm"
        >
          <span>请先登录官方控制台</span>
          <a
            data-testid="console-login-link"
            class="text-primary ml-2 underline"
            href="/admin/login"
            rel="noopener noreferrer"
            target="_blank"
          >
            去登录
          </a>
        </div>

        <p v-else-if="loaded && apps.length === 0" data-testid="admin-empty">
          暂无应用
        </p>

        <table
          v-else-if="apps.length > 0"
          data-testid="admin-app-list"
          class="w-full border-collapse text-sm"
        >
          <thead>
            <tr class="border-b text-left">
              <th class="p-2">应用名</th>
              <th class="p-2">状态</th>
              <th class="p-2">实例数</th>
              <th class="p-2">状态时间</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="app in apps" :key="app.name">
              <tr data-testid="admin-app-row" class="border-b">
                <td data-testid="admin-app-name" class="p-2">
                  {{ app.name }}
                </td>
                <td data-testid="admin-app-status" class="p-2">
                  {{ app.status }}
                </td>
                <td class="p-2">{{ app.instances?.length ?? 0 }}</td>
                <td class="p-2">
                  {{ formatStatusTimestamp(app.statusTimestamp) }}
                </td>
              </tr>
              <tr
                v-for="instance in app.instances ?? []"
                :key="instance.id"
                data-testid="admin-instance-row"
                class="border-b bg-gray-50"
              >
                <td colspan="2" class="p-2 pl-6">
                  实例 {{ instance.id }} ·
                  {{ instance.statusInfo?.status ?? '—' }}
                </td>
                <td colspan="2" class="flex gap-2 p-2">
                  <button
                    data-testid="admin-instance-env"
                    class="rounded border border-gray-300 px-2 py-1"
                    type="button"
                    @click="loadEnv(instance.id)"
                  >
                    环境
                  </button>
                  <button
                    data-testid="admin-instance-log"
                    class="rounded border border-gray-300 px-2 py-1"
                    type="button"
                    @click="loadLog(instance.id)"
                  >
                    日志
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section v-if="envSourceId" class="flex flex-col gap-2">
        <h3 class="font-semibold">环境 · 实例 {{ envSourceId }}</h3>
        <p v-if="envLoading" class="text-sm">加载中…</p>
        <p
          v-if="envError"
          data-testid="admin-env-error"
          class="text-sm text-red-600"
        >
          {{ envError }}
        </p>
        <p
          v-if="envTruncated"
          data-testid="admin-env-truncated"
          class="text-sm text-orange-600"
        >
          已截断，仅显示前 200 条
        </p>
        <p
          v-if="!envLoading && !envError && envSources.length === 0"
          data-testid="admin-env-empty"
        >
          暂无配置项
        </p>
        <table
          v-if="envVisible.length > 0"
          data-testid="admin-env"
          class="w-full border-collapse text-sm"
        >
          <thead>
            <tr class="border-b text-left">
              <th class="p-2">配置源</th>
              <th class="p-2">配置项数</th>
              <th class="p-2">明细</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="source in envVisible" :key="source.name">
              <tr data-testid="admin-env-source" class="border-b">
                <td class="p-2">{{ source.name }}</td>
                <td class="p-2">{{ source.rows.length }}</td>
                <td class="p-2">
                  <button
                    data-testid="admin-env-toggle"
                    class="rounded border border-gray-300 px-2 py-1"
                    type="button"
                    @click="toggleSource(source.name)"
                  >
                    {{ expandedSources[source.name] ? '收起' : '展开' }}
                  </button>
                </td>
              </tr>
              <tr
                v-if="expandedSources[source.name]"
                data-testid="admin-env-property-row"
                class="border-b bg-gray-50"
              >
                <td colspan="3" class="p-2">
                  <table class="w-full border-collapse">
                    <tbody>
                      <tr
                        v-for="row in source.rows"
                        :key="row.key"
                        data-testid="admin-env-property"
                      >
                        <td class="w-1/2 p-1 font-mono">{{ row.key }}</td>
                        <td class="p-1 font-mono">{{ row.value }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section v-if="logSourceId" class="flex flex-col gap-2">
        <h3 class="font-semibold">日志 · 实例 {{ logSourceId }}</h3>
        <p v-if="logLoading" class="text-sm">加载中…</p>
        <p
          v-if="logError"
          data-testid="admin-log-error"
          class="text-sm text-red-600"
        >
          {{ logError }}
        </p>
        <p
          v-if="logTruncated"
          data-testid="admin-log-truncated"
          class="text-sm text-orange-600"
        >
          已截断，仅显示最后 200 行
        </p>
        <pre
          v-if="!logLoading && !logError"
          v-text="logText"
          data-testid="admin-log"
          class="max-h-96 overflow-auto rounded bg-gray-100 p-2 text-xs"
        ></pre>
        <p class="text-xs text-gray-500">
          当前操作人：{{ operatorName }}（展示用，写操作不额外落审计表）
        </p>
      </section>

      <section class="flex min-h-0 flex-col gap-2">
        <h3 class="font-semibold">官方控制台（兜底入口）</h3>
        <ExternalConsole :url="adminUrl" />
      </section>
    </div>
  </Page>
</template>
