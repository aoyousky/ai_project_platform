import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端测试配置（research R4）。
 *
 * - 用例放 `tests/e2e/*.spec.ts`，跨页面、跨包，故不与被测源码同目录。
 * - 使用**系统已安装的 Edge**（channel: 'msedge'），不下载浏览器二进制；
 *   如需 Chrome，把 project 换成 `channel: 'chrome'`。
 * - 依赖本地 Docker 后端栈（quickstart §1）；CI 未起栈时该 job 视为可选。
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.artifacts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './tests/e2e/report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5666',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
});
