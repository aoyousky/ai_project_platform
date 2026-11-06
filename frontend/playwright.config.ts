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
  // Playwright 启动时会清空 outputDir。同一工作区里并行跑两份评测（多个会话、
  // 或评测器分组执行与手工调试重叠）时，固定目录会让双方互删 trace，表现为
  // `browserContext.close: ENOENT ...recording1.trace`。评测器为每次运行注入
  // 独立目录；手工运行时仍用默认目录。
  outputDir: process.env.E2E_OUTPUT_DIR ?? './tests/e2e/.artifacts',
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
    [
      'html',
      {
        outputFolder: process.env.E2E_REPORT_DIR ?? './tests/e2e/report',
        open: 'never',
      },
    ],
  ],
  // 自动拉起生产预览（需先 `pnpm build`）：避免每次手工起 server 或误跑 dev server。
  // 本地调试复用已有服务；CI 由工作流统一起栈并显式设 E2E_REUSE_SERVER=1，
  // 其余 CI 场景仍不复用，保证跑的是本次构建产物。
  webServer: {
    command: 'pnpm --filter @vben/web-antdv-next preview --port 5666',
    // CI 由 .github/workflows/ci-gate.yml 统一起栈（评测探针与 E2E 共用同一个
    // 5666 预览），此时必须复用已有服务，否则 Playwright 会再起一个并撞端口。
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1' || !process.env.CI,
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
