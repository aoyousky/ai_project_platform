import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue(), VueJsx()],
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          // happy-dom v20+ disables JS evaluation by default (security fix).
          // Treat disabled script loading as success to preserve test behavior.
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    // 单元/组件测试与被测源码同目录（research R5）；E2E 用例归 Playwright，不在此收集。
    include: [
      'apps/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{ts,tsx}',
      'internal/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/node_modules/**',
      '**/{stylelint,eslint}.config.*',
      '**/{oxfmt,oxlint}.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // 宪章 VIII 的 70% 在本次前端的映射对象（research R6）：
      // 适配层是本次唯一的业务逻辑集中地；框架层 packages/** 不计入。
      // 首批移植页面（apps/web-antdv-next/src/views/**）的阈值在 T051 补齐。
      include: ['apps/web-antdv-next/src/api/core/**'],
      exclude: ['**/*.{test,spec}.{ts,tsx}'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
