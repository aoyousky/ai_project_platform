# 端到端测试（Playwright）

**位置约定**：跨页面、跨包的验收用例放本目录，文件名 `*.spec.ts`。
与源码同目录的单元/组件测试（`*.test.ts`）不在此收集（见 `vitest.config.ts`）。

## 前置条件

1. 本地 Docker 后端栈在线（见 `specs/001-vben-frontend-replacement/quickstart.md` §1）；
2. 前端地址 `http://localhost:5666`。**默认跑生产构建产物**（dev server 首屏 800+ 模块、
   单次约 30s，会把用例预算吃光）。`playwright.config.ts` 里的 `webServer` 会自动
   `pnpm --filter @vben/web-antdv-next preview --port 5666`，前提是已有 `dist`：
   ```bash
   pnpm build        # 或 pnpm test:e2e:full（build + 跑全部用例）
   ```
3. 系统已安装 Edge（配置里 `channel: 'msedge'`，不下载浏览器二进制）；
4. 评测夹具（部分用例依赖）：
   ```bash
   bash scripts/evals/seed_spec002.sh   # spec002_limited（无权限账号）、spec002_* 用户
   bash scripts/evals/seed_spec003.sh   # spec003_* 角色/菜单/部门/岗位（如需要）
   ```

## 运行

```bash
cd frontend
pnpm test:e2e                 # 全部用例（需先 build）
pnpm test:e2e:full            # build 后跑全部用例（CI/本地推荐）
pnpm test:e2e --grep 登录      # 只跑标题含"登录"的用例
pnpm test:e2e --ui            # 调试
```

被测地址可用 `E2E_BASE_URL` 覆盖，默认 `http://localhost:5666`（hash 路由，用例用
`gotoAppPath` 拼接，不要直接 `page.goto('/system/x')`）。
后端地址与 Redis 容器可用 `E2E_BACKEND_URL`、`E2E_REDIS_CONTAINER`、`E2E_REDIS_PASSWORD` 覆盖。
无权限账号可用 `E2E_LIMITED_USER` / `E2E_LIMITED_PASSWORD` 覆盖，默认 `spec002_limited` / `admin123`。

## 验证码限流（重要）

后端对 `/auth/code` 是 **10 次/60s/IP**（`CaptchaController @RateLimiter`）。每个用例都要登录，
`helpers.ts` 会：

- 复用页面挂载时的那一次取码，不额外点刷新；
- 按 **7 次/60s** 排队（留 3 次余量给“登录失败自动刷新 / 点击图片刷新”）；
- 若挂载取码被限流导致图片未渲染，等 15s 窗口重置后重试（最多 3 次）。

因此**不要并行**跑两套 E2E，也不要同时跑 `scripts/evals/run_eval.py`——两者共用同一 IP 额度。

## 产物（已 gitignore）

| 路径 | 内容 |
|---|---|
| `tests/e2e/report/` | Playwright HTML 报告（quickstart §5 的证据） |
| `tests/e2e/.artifacts/` | 失败用例的 trace / 截图 |

## 用例清单

| 文件 | 覆盖 |
|---|---|
| `smoke.spec.ts` | 未登录落登录页、登录后落 `/index` |
| `login.spec.ts` | SPEC-001 A-01、A-02、E-01、E-02、E-14 |
| `session.spec.ts` | SPEC-001 A-09、A-10、E-12、E-13 |
| `system-role.spec.ts` | SPEC-003 A-01~A-06、A-13、A-17 |
| `system-menu.spec.ts` | SPEC-003 A-07~A-09、A-14、A-17 |
| `system-dept.spec.ts` | SPEC-003 A-10、A-11、A-15、A-17 |
| `system-post.spec.ts` | SPEC-003 A-12、A-17 |
| `system-user.spec.ts` | SPEC-002 A-05、A-07、A-12、A-14；SPEC-003 A-17 |
