<script setup lang="ts">
import { computed } from 'vue';

import { externalLinkProps, isConfigured } from './external-console-logic';

defineOptions({ name: 'ExternalConsole' });

const props = defineProps<{
  url: string | undefined;
}>();

const configured = computed(() => isConfigured(props.url));
const link = computed(() => externalLinkProps(props.url));

/** SPEC-007 §4.3：显式 window.open(url, '_blank', 'noopener,noreferrer')；
 * 保留 href 以满足 A-08/E-12 的属性断言。 */
function openExternal() {
  if (configured.value && props.url) {
    window.open(props.url, '_blank', 'noopener,noreferrer');
  }
}
</script>

<template>
  <div class="h-full w-full p-4">
    <div v-if="configured" class="flex h-full flex-col gap-2">
      <div class="flex justify-end">
        <a
          data-testid="monitor-open-external"
          class="text-primary text-sm hover:underline"
          :href="link.href"
          :rel="link.rel"
          :target="link.target"
          @click.prevent="openExternal"
        >
          在新窗口打开
        </a>
      </div>
      <iframe
        data-testid="monitor-iframe"
        class="w-full flex-1 rounded border-0"
        :src="url"
        style="min-height: 400px"
        title="外部监控控制台"
      ></iframe>
    </div>

    <div v-else class="flex h-full flex-col items-center justify-center gap-3">
      <p class="text-muted-foreground">未配置监控地址</p>
      <button
        data-testid="monitor-open-external"
        class="cursor-not-allowed rounded border border-gray-300 px-3 py-1 text-sm text-gray-400"
        disabled
        type="button"
      >
        在新窗口打开
      </button>
    </div>
  </div>
</template>
