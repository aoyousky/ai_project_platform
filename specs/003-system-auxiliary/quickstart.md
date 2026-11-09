# Quickstart: 系统管理辅助模块验证指南

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Delivery basis**: `specs/SPEC-004-system-auxiliary.md` v1.0（签字版）
**Target branch**: `003-system-auxiliary`（实现前确认；禁止向 `main` 提交或合并）
**Related**: [plan.md](plan.md)、[data-model.md](data-model.md)、
[contracts/backend-api-consumed.md](contracts/backend-api-consumed.md)、
[contracts/routes-and-permissions.md](contracts/routes-and-permissions.md)、
[contracts/ui-contracts.md](contracts/ui-contracts.md)

本文件只描述如何运行与验证，不包含实现代码。所有密钥、令牌、验证码、`secretKey` 只在进程内使用，
不写入命令输出、日志、报告或 trace。

## 1. 前置条件

- Node.js（Vben 5.7 要求 Node ≥ 20）、pnpm（仓库声明的版本）
- Python 3.11+
- Docker Desktop（本地测试栈）
- Microsoft Edge（Playwright 配置为 `channel: 'edge'`）
- 已签字 Packet `specs/SPEC-004-system-auxiliary.md` 与 `trace/REQ-20261107-005.yaml`
- 代码位于目标分支 `003-system-auxiliary`；当前分支不是 `main`

## 2. 启动本地栈

```bash
# 仓库根目录
docker compose -f deploy/docker-compose.yml up -d

# 前端依赖（仅首次）
cd frontend && pnpm install && cd ..

# 生产预览（Playwright 与评测共用 5666）
cd frontend
pnpm build
pnpm --filter @vben/web-antdv-next preview --port 5666
```

- 后端：`http://localhost:8080`
- 前端：`http://localhost:5666`
- 若端口被占用，先释放 5666/8080；不要改 Playwright 基地址以外的配置。

## 3. 预置夹具

```bash
# 仓库根目录；仅本地/CI 测试库，禁止指向生产库
bash scripts/evals/seed_spec004.sh
```

写入内容（与 `cases.yaml` 的 `EVAL_SPEC004_*` 变量一一对应）：

- 字典类型 `spec004_dict_type`（含 2 条字典数据）
- 参数 `spec004.config.key`（`configType='N'`）
- 公告 `Spec004 公告`（含 `ql-align-center` / `ql-size-large` 历史类）
- 操作日志 `Spec004 操作`（`operName='spec004_operator'`，含合法 JSON 与普通文本两种参数）
- 登录日志 `spec004_lock`（`userName='spec004_lock'`）
- 文件配置 `spec004_oss_config`（新增用，初始不存在）
- 受限账号 `spec004_limited`（仅字典菜单 + `system:dict:list`/`system:dict:query`）

脚本必须“先清后插”，可重复执行；不得删除内置配置 `ossConfigId=1/2` 或内置参数
`sys.oss.previewListResource`。

## 4. 静态与单元验证

```bash
# 1) 评测集静态校验 + P0 覆盖（建立 specs/evals/REQ-20261107-005/ 之后）
python scripts/evals/run_eval.py --check

# 2) 单元测试（根目录；Vitest DOM 环境）
cd frontend && pnpm test:unit

# 3) 类型检查
pnpm check:type

# 4) 共享执行器自测（可选，改动 run_eval.py 时必跑）
cd ..
python -m unittest discover -s specs/evals/tests -v
```

预期：全部退出码 0；单元测试覆盖 `*-page-logic.ts`、`legacy-notice-html.ts`、
API 模块与 Tiptap 适配。RED→GREEN 证据保留在 trace 的 `test_evidence`。

## 5. HTTP 评测

```bash
# 只跑本需求；探针按 auth 类型各登录一次，避免 /auth/code 10 次/60s 限流
python scripts/evals/run_eval.py --req REQ-20261107-005 --report specs/evals/reports
```

覆盖 A-01～A-10 的 HTTP 可观测部分（列表/详情/CRUD/失败码/导出 Content-Type/权限 403/隐藏页数据链路）。
A-02、A-10、A-12、A-13、A-15、A-16、A-18 的 UI 断言由 E2E 补充；评测用例仍保留 `assertion`
以通过 P0 覆盖检查。

**安全**：报告只记录状态码、`code`、`msg` 摘要与耗时；不记录令牌、验证码、请求头、
`secretKey`、密码。`http_probe.mjs` 从登录响应体取 `access_token` 后只在内存注入。

## 6. E2E 验证

```bash
cd frontend

# 全量（含 build）
pnpm test:e2e:full

# 只跑本特性（需先 build 并启动 preview）
pnpm exec playwright test tests/e2e/system-auxiliary-dict.spec.ts
pnpm exec playwright test tests/e2e/system-auxiliary-config.spec.ts
pnpm exec playwright test tests/e2e/system-auxiliary-notice.spec.ts
pnpm exec playwright test tests/e2e/system-auxiliary-log.spec.ts
pnpm exec playwright test tests/e2e/system-auxiliary-oss.spec.ts
```

预期：`pageerror` 计数为 0；失败截图/追踪只保存在本地 `test-results/`，不提交。

## 7. 人工验收脚本（按断言）

| 断言 | 操作 | 期望 |
|---|---|---|
| A-01 | `/system/dict` 筛选 `spec004_dict_type`，点类型行，右侧增/改/删数据，再删类型 | 左 1 行；右侧 2→3→3→2；删类型 `code≠200` 且类型仍在 |
| A-02 | 访问 `/system/dict-data/index/{dictId}`，改标签保存并刷新 | 表头存在、≥2 行、无“即将推出”、刷新后新标签 |
| A-03 | `/system/config` 筛选、CRUD、删内置、刷新缓存 | 成功码 200；内置删除 `code≠200` 仍在 |
| A-04 | `/system/notice` 三项筛选、编辑回显、新增带格式公告、改状态、删除 | 内容含正文；状态同步；`total` 减 1 |
| A-05 | `/system/log/operlog` 筛选、详情、删除、导出 | JSON 可读；导出非空且 xlsx/octet-stream |
| A-06 | `/system/log/logininfor` 筛选、单选解锁、删除、导出 | 解锁 200 且日志仍在；删除后 `total` 减 1 |
| A-07 | `/system/oss` 上传 PNG + 文本、下载 PNG、删除两条 | 两次 200；下载 `Content-Disposition: attachment` |
| A-08 | `/system/oss-config/index` 筛选、增改、设默认、删内置、删新增 | 唯一默认；内置删除 `msg='系统内置, 不可删除!'` |
| A-09 | `spec004_limited` 登录 `/system/dict`，直接 `POST` 写接口 | 无新增/删除/导出按钮；`code=403` |
| A-10 | 依次打开 8 个地址 | 无占位页，表头正确，无 403/404 |
| A-11 | 打开含 `ql-*` 的公告 | 居中 `text-align=center`；大字号大于正文 |
| A-12 | `/system/oss` 开关 preview，再关再开 | `<img src=url>` ↔ URL 文本；开关权限正确 |
| A-13 | 删除/清空/解锁/设默认/刷新缓存 | 先确认；取消不发请求 |
| A-14 | 拦截列表接口为 500 | 展示 `msg`/统一错误，无无限加载 |
| A-15 | 勾选 0/1/2 条登录日志 | 仅 1 条时解锁可用 |
| A-16 | 设默认时拦截 `changeStatus` | 开关回滚，默认仍是 `ossConfigId=1` |
| A-18 | 点操作日志/登录日志排序列头 | 请求带 `orderByColumn`/`isAsc`，首行变化 |

A-17 为分支静态检查：

```bash
git diff --stat main...HEAD -- platform/ frontend/packages/
git diff --stat main...HEAD -- 'frontend/**/package.json' 'frontend/pnpm-workspace.yaml'
```

两条输出必须为空（变更文件数 = 0）。

## 8. 契约与门禁

```bash
# 12 项 review（实现完成后）
/review

# 溯源（assertion_map 填 file:line、diff_scope、test_evidence）
/trace

# 五道门禁
bash scripts/ci-gate.sh
```

- 本特性不改后端接口，无 OpenAPI 变更；契约测试以 API 模块单测（断言 URL/方法/参数/载荷）
  与评测集 HTTP 用例为准。
- 门禁 3 的开发期豁免仅在 `test_evidence` 为空且 `review_verdict: pending` 时成立；
  完成后必须回填真实证据。
- 任何 FAIL 先跑 `/audit` 定位并修复，不得绕过门禁。

## 9. 常见问题

| 现象 | 处置 |
|---|---|
| `/auth/code` 限流拿不到验证码 | 评测/探针只登录一次；不要按用例重复登录 |
| E2E 打开是空白/占位页 | 确认已 `pnpm build` + preview 5666；确认 8 个视图文件路径与组件名一致 |
| 隐藏页落 403/404 | 确认后端 `getRouters` 返回该隐藏菜单；URL 用 `/system/dict-data/index/:dictId` 与 `/system/oss-config/index` |
| 图片行不显示 `<img>` | 检查 `sys.oss.previewListResource` 为 `'true'` 且后缀在白名单 |
| 导出保存了 JSON 文件 | 说明未走 `downloadBlob` JSON 错误体识别；补 `msg` 抛错与页面捕获 |
| `secretKey` 出现在页面 | 检查列表/详情列定义与日志输出；只允许编辑表单 `InputPassword` 遮蔽显示 |
