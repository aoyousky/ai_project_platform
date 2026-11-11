<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { resolveConsoleUrl } from '../components/external-console-logic';
import ExternalConsole from '../components/external-console.vue';

/**
 * 任务调度中心（SPEC-007 §4.3 / A-09、E-12、E-17）。
 * 地址只从环境读取；生产构建的运行时值由 `_app.config.js` 注入。
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
</script>

<template>
  <Page auto-content-height>
    <ExternalConsole :url="snailjobUrl" />
  </Page>
</template>
