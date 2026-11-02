# 端到端测试（Playwright）

**位置约定**：跨页面、跨包的验收用例放本目录，文件名 `*.spec.ts`。
与源码同目录的单元/组件测试（`*.test.ts`）不在此收集（见 `vitest.config.ts`）。

## 前置条件

1. 本地 Docker 后端栈在线（见 `specs/001-vben-frontend-replacement/quickstart.md` §1）；
2. 前端 dev server 在 `http://localhost:5666`（`pnpm -F @vben/web-antdv-next dev`）；
3. 系统已安装 Edge（配置里 `channel: 'msedge'`，不下载浏览器二进制）。

## 运行

```bash
cd frontend
pnpm test:e2e                 # 全部用例
pnpm test:e2e --grep 登录      # 只跑标题含"登录"的用例
pnpm test:e2e --ui            # 调试
```

被测地址可用 `E2E_BASE_URL` 覆盖，默认 `http://localhost:5666`。

## 产物（已 gitignore）

| 路径 | 内容 |
|---|---|
| `tests/e2e/report/` | Playwright HTML 报告（quickstart §5 的证据） |
| `tests/e2e/.artifacts/` | 失败用例的 trace / 截图 |

## 待建用例（对应 tasks.md）

| 文件 | 任务 | 覆盖断言 |
|---|---|---|
| `smoke.spec.ts` | T009 | A-16、E-03 |
| `login.spec.ts` | T020 | A-01、A-02、E-01、E-02、E-14 |
| `session.spec.ts` | T021 | A-09、A-10、E-12、E-13 |
| `permission.spec.ts` | T028 | A-04、A-05 |
| `external-link.spec.ts` | T034 | A-11、E-08 |
| `post-crud.spec.ts` | T039 | A-06、A-07、A-13、E-10、E-11、E-15 |
