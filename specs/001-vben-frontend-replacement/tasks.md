---
description: "Task list for 前端框架替换（Vben 前端外壳）"
---

# Tasks: 前端框架替换（Vben 前端外壳）

**Input**: Design documents from `/specs/001-vben-frontend-replacement/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)

**Tests**: Test tasks are MANDATORY - never omit them, never defer them to a later phase. For every user story, write the tests first and confirm they FAIL before writing implementation (RED → GREEN). Test scope follows constitution VIII (test pyramid, domain unit coverage ≥ 70%, contract tests required).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app：`frontend/apps/web-antdv-next/src/`、`frontend/tests/`
- 后端只读：`platform/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 把 Vben 5.7.0 整仓落进 `frontend/`，并把构建链从 npm 切到 pnpm

- [ ] T001 以 `git subtree add --prefix=frontend <vben-remote> v5.7.0 --squash` 迁入 Vben 整仓，写 `frontend/PROVENANCE.md`（tag、commit、来源 URL）
- [ ] T002 裁剪多余应用：删除 `frontend/apps/{web-antd,web-ele,web-naive,web-tdesign,playground,backend-mock}` 与 `frontend/docs/`，同步清理 `frontend/package.json` 中对应 `build:*`/`dev:*` 脚本
- [ ] T003 [P] 删除 `frontend/package-lock.json`，执行 `corepack enable && pnpm install` 生成并在 `frontend/pnpm-lock.yaml` 提交锁文件（R8）
- [ ] T004 [P] CI 切换：`.github/workflows/ci-gate.yml` 的 `frontend` job 改为 `corepack enable && pnpm install --frozen-lockfile && pnpm -F @vben/web-antdv-next build`；`deploy/prepare.sh` 同步改为 pnpm
- [ ] T005 [P] 配置测试入口：在 `frontend/vitest.config.ts` 增加 `tests/**` 与 `apps/web-antdv-next/src/**/*.test.ts` 的 include；新增 `frontend/playwright.config.ts`（channel 用系统 Edge，baseURL `http://localhost:5666`）；新增测试依赖登记（allowlist §2 已登记）

**Checkpoint**: `pnpm -F @vben/web-antdv-next build` 与 `pnpm -F @vben/web-antdv-next typecheck` 在上游代码上通过

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 适配层——所有用户故事都依赖的传输、路由、会话基础

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### 测试先行（RED）

- [ ] T006 [P] 写 `frontend/apps/web-antdv-next/src/api/core/ruoyi-crypto.test.ts`：AES 往返、RSA 往返、非法密文抛错；预期全部失败
- [ ] T007 [P] 写 `frontend/apps/web-antdv-next/src/api/core/menu.test.ts`：`noRedirect` 丢弃、`hidden→hideInMenu`、`noCache→!keepAlive`、`icon:'#'` 丢弃、内链路径原样保留；预期全部失败
- [ ] T008 [P] 写 `frontend/apps/web-antdv-next/src/api/request.test.ts`：`{code,msg,rows,total}` 与 `{code,msg,data}` 两种响应体的解析分支；失败时取 `msg`；预期失败
- [ ] T009 [P] 写 `frontend/tests/e2e/smoke.spec.ts`：未登录访问根路径落到登录页、登录后落到 `/index`；预期失败

### 实现

- [ ] T010 [P] 实现 `frontend/apps/web-antdv-next/src/api/core/ruoyi-crypto.ts`：AES-256-ECB/PKCS7 + RSA 封装，导出 `encryptHeader`
- [ ] T011 [P] 实现 `frontend/apps/web-antdv-next/src/api/core/menu.ts`：`RouterVo → RouteRecordStringComponent` 转换（不含外链，外链在 US3）
- [ ] T012 [P] 实现 `frontend/apps/web-antdv-next/src/api/core/auth.ts`：`/auth/login`（加密体 + `encrypt-key` 头）、`/auth/code`、`/auth/logout`、`getAccessCodesApi`
- [ ] T013 [P] 实现 `frontend/apps/web-antdv-next/src/api/core/user.ts`：`/system/user/getInfo` → Vben `UserInfo`
- [ ] T014 实现 `frontend/apps/web-antdv-next/src/api/request.ts`：`clientid` 头、按 `encrypt-key` 响应头解密、`successCode: 200`、`dataField` 兼容 `rows`/`data`、错误取 `msg`
- [ ] T015 [P] 实现 `frontend/apps/web-antdv-next/src/router/access.ts` 的 `layoutMap`（`Layout→BasicLayout`、`ParentView→占位`、`InnerLink→IFrameView`）与 `frontend/apps/web-antdv-next/src/layouts/parent-view.vue`
- [ ] T016 [P] 实现 `frontend/apps/web-antdv-next/src/router/routes/modules/home.ts` + `frontend/apps/web-antdv-next/src/views/index.vue`（`/index` 常量路由）
- [ ] T017 [P] 配置 `frontend/apps/web-antdv-next/src/preferences.ts`（`accessMode: 'mixed'`、`defaultHomePath: '/index'`、`enableRefreshToken: false`）
- [ ] T018 配置 `frontend/apps/web-antdv-next/.env.development` 与 `.env.production`：端口 5666、`VITE_GLOB_API_URL=/api`、`VITE_APP_CLIENT_ID`、RSA 公钥/私钥（R3：生产走环境注入）
- [ ] T019 让 T006–T009 全部转 GREEN，并补齐 `frontend/apps/web-antdv-next/src/api/core/menu.test.ts` 的 48 节点 / 39 叶子可解析断言

**Checkpoint**: 用真实后端可完成"打开 → 登录 → 落在 `/index` → 侧栏出现后端菜单"；Foundation ready

---

## Phase 3: User Story 1 - 用现有账号登录并进入首页 (Priority: P1) 🎯 MVP

**Goal**: 验证码 + 加密登录 + 会话失效处理，登录后落在首页

**Independent Test**: 全新浏览器完成"输错验证码 → 刷新 → 正确登录 → 落 `/index` → 退出登录 → 后退不可回到已登录界面"

### Tests for User Story 1 (MANDATORY - write first, verify RED) ⚠️

- [ ] T020 [P] [US1] 写 `frontend/tests/e2e/login.spec.ts`：验证码错误提示、验证码刷新、登录成功进入 `/index`、无手机号/扫码入口；预期失败
- [ ] T021 [P] [US1] 写 `frontend/tests/e2e/session.spec.ts`：登出后回登录页、浏览器后退不回到已登录界面、401 后回登录页；预期失败
- [ ] T022 [P] [US1] 写 `frontend/apps/web-antdv-next/src/views/_core/authentication/login.test.ts`：`captchaEnabled=false` 时隐藏验证码字段、提交后刷新验证码；预期失败

### Implementation for User Story 1

- [ ] T023 [US1] 改造 `frontend/apps/web-antdv-next/src/views/_core/authentication/login.vue`：接入 `/auth/code`、验证码字段、移除手机号/扫码入口
- [ ] T024 [US1] 在 `frontend/apps/web-antdv-next/src/views/_core/authentication/login.vue` 实现提交节流（按钮禁用）与失败后刷新验证码、保留用户名
- [ ] T025 [US1] 在 `frontend/apps/web-antdv-next/src/api/request.ts` 与 `frontend/apps/web-antdv-next/src/store/auth.ts` 实现 401/会话失效回登录页与登出清会话
- [ ] T026 [US1] 让 T020–T022 转 GREEN

**Checkpoint**: US1 可独立演示与验收

---

## Phase 4: User Story 2 - 按权限看到菜单与操作按钮 (Priority: P1)

**Goal**: 后端菜单驱动导航；权限码控制按钮；超管通配放行；未授权路由拦截

**Independent Test**: `admin` 与普通账号各登录一次，比对菜单与按钮可见集合

### Tests for User Story 2 (MANDATORY - write first, verify RED) ⚠️

- [ ] T027 [P] [US2] 写 `frontend/apps/web-antdv-next/src/directives/access.test.ts`：`*:*:*` 放行、精确码放行、缺码移除元素、空权限移除元素；预期失败
- [ ] T028 [P] [US2] 写 `frontend/tests/e2e/permission.spec.ts`：超管见全部按钮、普通账号不见越权按钮、未授权地址落 403/404；预期失败

### Implementation for User Story 2

- [ ] T029 [US2] 实现 `frontend/apps/web-antdv-next/src/directives/access.ts` 的通配符感知指令
- [ ] T030 [US2] 在 `frontend/apps/web-antdv-next/src/bootstrap.ts` 注册 `registerRuoYiAccessDirective(app)`
- [ ] T031 [US2] 配置未授权路由落 `frontend/apps/web-antdv-next/src/views/_core/fallback/forbidden.vue` 或 404 页（含 `meta.menuVisibleWithForbidden` 的用法约定）
- [ ] T032 [US2] 让 T027–T028 转 GREEN

**Checkpoint**: US2 与 US1 可同时独立通过

---

## Phase 5: User Story 3 - 外链菜单在系统内嵌打开 (Priority: P2)

**Goal**: 外链菜单可见、点击内嵌、单条异常不影响整张菜单

**Independent Test**: 点击「PLUS官网」进入 `/iframe/...`，内容区出现 iframe；刷新仍在该路径

### Tests for User Story 3 (MANDATORY - write first, verify RED) ⚠️

- [ ] T033 [P] [US3] 在 `frontend/apps/web-antdv-next/src/api/core/menu.test.ts` 增补外链用例：合成路径稳定、`component='IFrameView'`、`meta.iframeSrc` 正确、**不产生 `meta.link`**；预期失败
- [ ] T034 [P] [US3] 写 `frontend/tests/e2e/external-link.spec.ts`：菜单出现、点击进 `/iframe/`、iframe `src` 正确、整站其余菜单仍可用；预期失败

### Implementation for User Story 3

- [ ] T035 [US3] 在 `frontend/apps/web-antdv-next/src/api/core/menu.ts` 实现外链路径合成（`/iframe/<slug>-<hash>`）与 `IFrameView` 映射
- [ ] T036 [US3] 在 `frontend/apps/web-antdv-next/src/router/access.ts` 确认 `IFrameView` 映射到 Vben 的 iframe 视图，并按 research R8 配置 sandbox（不含 `allow-top-navigation`）
- [ ] T037 [US3] 对目标站点拒绝内嵌的情况做兜底提示（不自动新窗口跳转，保留刷新/新窗口入口）
- [ ] T038 [US3] 让 T033–T034 转 GREEN

**Checkpoint**: US3 独立可验收；未移植页面仍显示占位页

---

## Phase 6: User Story 4 - 标准业务页面功能一致 (Priority: P2)

**Goal**: 以岗位管理为范式，打通"列表 → 新增 → 修改 → 批量删除"

**Independent Test**: 在 `/system/post` 完成 CRUD 闭环，数据与后端一致

### Tests for User Story 4 (MANDATORY - write first, verify RED) ⚠️

- [ ] T039 [P] [US4] 写 `frontend/tests/e2e/post-crud.spec.ts`：列表分页总数一致、新增可见、修改生效、批量删除消失、业务错误显示后端 `msg`；预期失败
- [ ] T040 [P] [US4] 写 `frontend/apps/web-antdv-next/src/views/system/post/index.test.ts`：必填校验（岗位名称/编码/部门）、状态字典渲染；预期失败

### Implementation for User Story 4

- [ ] T041 [P] [US4] 实现 `frontend/apps/web-antdv-next/src/api/system/post/index.ts` 与 `frontend/apps/web-antdv-next/src/api/system/dict/index.ts`
- [ ] T042 [US4] 实现 `frontend/apps/web-antdv-next/src/views/system/post/index.vue`：VxeGrid 列表 + 搜索表单 + 新增/编辑弹窗 + 批量删除 + `v-access` 按钮
- [ ] T043 [US4] 在 `frontend/apps/web-antdv-next/src/views/system/post/index.vue` 落实必填校验（`deptId` 必填，避免后端"部门id不能为空"）
- [ ] T044 [US4] 让 T039–T040 转 GREEN，并清理测试产生的数据

**Checkpoint**: 样例页成为其余页面的移植范式

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 批量移植其余页面、保真度收尾、门禁全绿

- [ ] T045 [P] 建立图标映射表 `frontend/apps/web-antdv-next/src/api/core/icon-map.ts`（36 个后端图标名 → iconify），未知回退 `lucide:circle` 并告警（research R10）
- [ ] T046 [P] 移植 `system` 上下文剩余页面（user/role/menu/dept/dict/config/notice/log×2/oss/client），逐页 RED→GREEN；**通知公告页同时补 `ql-*` 兼容样式**（`frontend/apps/web-antdv-next/src/styles/quill-compat.css`，覆盖 `ql-align-*` / `ql-size-*`），并做一次历史内容只读渲染回归（SPEC E-19）
- [ ] T047 [P] 移植 `monitor` 上下文页面（online/cache/snailjob/Admin）
- [ ] T048 [P] 移植 `tool/gen` 与 `demo/*` 页面
- [ ] T049 [P] 为未移植菜单提供统一占位页，保证菜单可达性 100%（SC-002）
- [ ] T050 删除 `frontend/` 下 plus-ui 残留（旧 `src/`、`bin/`、`html/`、`public/`、`vite.config.*` 等），确认 `PROVENANCE.md` 已登记
- [ ] T051 覆盖率收口：`src/api/core/**` 与首批移植页面分支覆盖率 ≥ 70%（research R6），CI 校验
- [ ] T052 [P] 性能核对：首页可交互 ≤ 3s、构建产物 ≤ 8MB（CONTEXT 约束），记录实测值
- [ ] T053 运行 [quickstart.md](./quickstart.md) 全部 VS 场景并留存证据（截图、Playwright 报告、覆盖率）
- [ ] T054 更新 `trace/<需求编号>.yaml`（断言 → file:line），执行 `/spec-check`、`/review`、评测集
- [ ] T055 [P] 文档收口：`docs/evidence/vben-p1-spike.md` 标记为历史证据，新增 P4 验证记录；README 的前端命令改 pnpm

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1，阻塞所有用户故事
- **User Stories (Phase 3–6)**: 均依赖 Phase 2 完成；US1/US2 可并行，US3/US4 依赖 US1 的登录可用于 E2E
- **Polish (Phase 7)**: 依赖 US1–US4 全部完成

### User Story Dependencies

- **US1 (P1)**: 依赖 Foundational；不依赖其他故事
- **US2 (P1)**: 依赖 Foundational；与 US1 并行无冲突（不同文件）
- **US3 (P2)**: 依赖 Foundational（`menu.ts` 基础转换）；E2E 需要 US1 的登录可用
- **US4 (P2)**: 依赖 Foundational；E2E 需要 US1 的登录可用

### Within Each User Story

- 测试先行并确认失败（RED），再实现，最后转 GREEN
- 同一文件的连续任务不得并行（如 `menu.ts`：T011 → T035；`login.vue`：T023 → T024）

### Parallel Opportunities

- T003/T004/T005 可并行
- T006–T009 四个测试文件可并行
- T010–T013 四个 API 文件可并行
- T015/T016/T017 可并行
- US1 与 US2 整体可并行
- T045–T049 页面移植可并行（不同上下文不同文件）

---

## Parallel Example: Phase 2 测试先行

```bash
Task: "写 ruoyi-crypto 单测（RED）"
Task: "写菜单转换单测（RED）"
Task: "写响应解析单测（RED）"
Task: "写登录冒烟 E2E（RED）"
```

## Parallel Example: Phase 7 页面移植

```bash
Task: "移植 system 上下文页面"
Task: "移植 monitor 上下文页面"
Task: "移植 tool/gen 与 demo 页面"
Task: "建立图标映射表"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 Setup
2. 完成 Phase 2 Foundational（阻塞项，必须全绿）
3. 完成 Phase 3 US1
4. **STOP and VALIDATE**：按 quickstart VS-1 独立验收
5. 可对内演示

### Incremental Delivery

1. Setup + Foundational → 能登录、能看到菜单
2. + US1 → 登录链路稳定（MVP）
3. + US2 → 权限呈现正确
4. + US3 → 外链菜单恢复
5. + US4 → 标准 CRUD 页面可用，形成移植范式
6. + Phase 7 → 全量页面移植与门禁

### 与 Spec Packet 的关系

本 tasks.md 是工程拆解，**不是交付依据**。正式实现前必须由 `/spec-packet` 产出
`specs/SPEC-001-vben-frontend-replacement.md`（A-xx / E-xx / Non-goals / Golden Samples），
trace 与 DoD 以该 Spec Packet 为准。

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每个任务提交时同步 `trace/` 与 `PROVENANCE.md`
- 后端 `platform/` 全程只读；发现需要后端改动即 STOP
