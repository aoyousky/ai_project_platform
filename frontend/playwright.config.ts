import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端测试配置（research R4）。
 *
 * - 用例放 `tests/e2e/*.spec.ts`，跨页面、跨包，故不与被测源码同目录。
 * - 使用**系统已安装的 Edge**（channel: 'msedge'），不下载浏览器二进制；
 *   如需 Chrome，把 project 换成 `channel: 'chrome'`。
 * - 依赖本地 Docker 后端栈（quickstart §1）；CI 未起栈时该 job 视为可选。
 * - 每个用例都要重新登录（全新 context → 整页加载）。dev server 单次首屏
 *   约 30s（800+ 模块），会吃掉用例预算，故 E2E 默认跑生产构建产物：
 *   `pnpm build && pnpm preview --port 5666`。
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.artifacts',
  // 单用例预算 240s：每个用例都要整页加载并登录，登录还要 `docker exec redis-cli`
  // 取验证码明文（宿主 Docker Desktop 冷/慢时单次 3–5s）。120s 在慢宿主上会让
  // 需要多次登录的用例（A-17、A-16）在“等响应”处超时，与断言本身无关。
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './tests/e2e/report', open: 'never' }],
  ],
  // 自动拉起生产预览（需先 `pnpm build`）：避免每次手工起 server 或误跑 dev server。
  // 已有服务在监听时复用（本地调试友好），CI 下不复用，保证跑的是本次构建产物。
  webServer: {
    command: 'pnpm --filter @vben/web-antdv-next preview --port 5666',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://localhost:5666',
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5666',
    // 失败时保留 trace；关掉 screencast 截帧（DOM 快照 + 网络仍在）。慢宿主上
    // 逐帧截图会显著加重录制开销，反而制造等待抖动；失败截图由 screenshot 单独负责。
    trace: { mode: 'retain-on-failure', screenshots: false },
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
