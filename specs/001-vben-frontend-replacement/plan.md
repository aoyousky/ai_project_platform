# Implementation Plan: 前端框架替换（Vben 前端外壳）

**Branch**: `001-vben-frontend-replacement` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-vben-frontend-replacement/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

把 `frontend/` 的 plus-ui（Vue 3 + Element Plus + npm）整体替换为上游 Vben Admin 5.7.0 的整仓
subtree（只保留 `apps/web-antdv-next` 一个应用），用一层薄适配（约 10 个应用层文件）接住
RuoYi-Vue-Plus 后端的加密登录、`getRouters` 动态菜单、`{code,msg,rows,total}` 分页响应、
`*:*:*` 超管通配权限与外链菜单。`platform/` 后端零改动。

技术要点已在 P1 spike 中全部验证（typecheck / build / 无头浏览器端到端），本计划把 spike 结论
转成可交付的工程计划：适配层落地 + 单测、样例页 `system/post` 先行、其余页面按上下文批量移植、
CI 切换为 pnpm、最后删除 plus-ui 旧代码。

## Technical Context

**Language/Version**: TypeScript 6.0.3、Vue 3.5.34；构建与运行需 Node `^22.18.0 || ^24.0.0`、pnpm 10.33.4（Corepack 固定）

**Primary Dependencies**: Vben Admin 5.7.0（`apps/web-antdv-next` + 14 个 `@vben/*` workspace 包）、
antdv-next 1.3.0、vxe-table 4.18.13、crypto-js 4.2.0、jsencrypt 3.5.4、@vueuse/core 14.3、
vue-router 5.0.7、pinia 3.0.4、Vite 8.0.13。明细见 `specs/constraints/allowlist.md` §1.2.1。

**Storage**: 无新增服务端存储。前端只写入浏览器 `localStorage`（Vben preferences：主题、语言、布局）与
会话令牌存储；业务数据全部来自既有后端接口。

**Testing**: 单元/组件测试用 Vben 自带的 Vitest（`pnpm test:unit`）；端到端用 Playwright 驱动系统
Edge/Chrome（spike 已验证的路径），对接本地 Docker 后端栈（MySQL/Redis/`awp-backend:8080`）。

**Target Platform**: 现代常青浏览器（Chrome/Edge 最新两个大版本）；桌面优先，最低宽度 1280px。
不承诺 IE / Edge Legacy。

**Project Type**: Web 应用前端（pnpm monorepo 的单一 app），与既有后端仓同仓共存。

**Performance Goals**: 登录后首页可交互 ≤ 3s（本地环境）；页面切换 ≤ 500ms（不含接口耗时）；
生产构建产物 ≤ 8MB（spike 实测 5.4MB）。

**Constraints**: 后端接口契约零变更；不改 `frontend/packages/**` 与 `src/adapter/**`；
锁定 `pnpm-lock.yaml`；传输加密密钥走环境变量（R3）。

**Scale/Scope**: 后端 `getRouters` 当前 48 个节点 / 39 个可访问页面；首批交付适配层 + 标准 CRUD 页面，
工作流页面（BPMN / 动态表单）单独评估。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 检查项 | 结论 | 依据 |
|---|---|---|---|
| III 架构分层 | 前端不反向依赖后端内部实现，只经 HTTP 契约 | PASS | 适配层只调用 `/auth/*`、`/system/*` 公开接口 |
| IV 契约 | 不新增/修改对外接口；消费方需有契约校验 | PASS | 见 `contracts/backend-api-consumed.md`；CI 加 OpenAPI 消费方校验 |
| VII 前端工程 | Vue 3 + TS + Vite + Pinia + Router、`<script setup>`、统一请求封装、权限双控 | PASS（基线偏离另记） | 技术基线表仍写 Element Plus → 见下方例外 |
| VIII 测试 | 关键链路须有自动化；缺陷先写失败测试 | PASS（有约束） | 前端无 domain 层，"覆盖率 ≥70%"映射为：适配层与移植页面的**分支覆盖 ≥70%**，见 research R6 |
| IX 安全 | 不存密钥明文；越权用例回归；默认拒绝 | PASS | R3：RSA 公私钥走 `.env` 环境注入，禁止提交真实密钥；越权页访问用例进 E2E |
| XI 依赖 | 新增依赖必须登记白名单并审批 | PASS | `allowlist.md` §1.2.1 已登记（CLAR-001 裁决 A） |
| XII 架构例外 | 偏离必须写 ADR | PASS | ADR-002（Accepted）记录 D9/D10/D11/D12 |
| R1 底座只读 | 只动登记接缝 | PASS | 接缝表已按 ADR-002 §2.1 重写 |
| R8 同名交付/锁文件 | 上下文同名；锁文件入库 | PASS | `pnpm-lock.yaml` 入库；`src/{views,api}/<context>/` 与 `business/<context>/` 同名 |

**例外项（已由 ADR-002 覆盖，非新例外）**：

- **D9**：宪章 VII 与「技术栈基线」表仍写 Element Plus；实现用 antdv-next。已在 allowlist §1.2 顶部挂冲突告警，
  需宪章 MINOR 修订（到期 2026-11-15）。**本轮不修改宪章**（修订流程在架构委员会）。
- **D10/D11**：ADR-001 §2.3（plus-ui）与 R8 原文（`package-lock.json`）已被 ADR-002 覆盖，红线文本已同步。

**门禁结论**：无未论证的违规，可进入 Phase 0。

### Post-Design Re-check（Phase 1 完成后）

| 原则 | 设计产物带来的新风险 | 结论 |
|---|---|---|
| IV 契约 | `contracts/backend-api-consumed.md` 把前端依赖的后端行为写成明文契约 | PASS：契约只读登记，不改后端；E2E 断言其结构 |
| VII 前端工程 | 外链 iframe 与图标映射是应用层补丁 | PASS：补丁落在登记接缝，不碰 `packages/**` |
| VIII 测试 | 覆盖率口径由"domain 层"映射到适配层 + 页面（research R6） | PASS：映射已写明理由，纳入 CI |
| IX 安全 | iframe 可能被外部站点劫持顶层导航 | PASS：research R8 规定 sandbox 白名单，不含 `allow-top-navigation` |
| XI 依赖 | 新增 `@playwright/test`、`@vue/test-utils` 等测试依赖 | **需登记**：属测试工具类，按 `allowlist.md` §2 补登（P4-1 提交前完成） |
| XII 架构例外 | 无新增例外 | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/001-vben-frontend-replacement/
├── plan.md                    # 本文件
├── research.md                # Phase 0：待决问题的调研与结论
├── data-model.md              # Phase 1：前端视图模型与后端数据类型
├── quickstart.md              # Phase 1：可运行的验收步骤
├── contracts/
│   └── backend-api-consumed.md  # 消费方契约（前端消费的后端接口清单）
├── checklists/
│   └── requirements.md        # /speckit-specify 产出
└── tasks.md                   # Phase 2 产物（/speckit-tasks）
```

### Source Code (repository root)

```text
frontend/                                  # Vben 5.7.0 整仓 subtree（裁剪后只剩一个 app）
├── apps/web-antdv-next/
│   ├── .env.development / .env.production # 只改已有配置项取值：端口、API 前缀、clientId、RSA 密钥
│   └── src/
│       ├── api/
│       │   ├── core/                      # 适配层（可写）：request / auth / user / menu / ruoyi-crypto
│       │   └── <context>/                 # 业务接口封装（与后端 business/<context> 同名）
│       ├── views/
│       │   ├── _core/authentication/      # 登录页改造（验证码、去 mock 入口）
│       │   ├── index.vue                  # 首页（常量路由落点）
│       │   └── <context>/                 # 业务页面
│       ├── router/                        # layoutMap、常量路由模块
│       ├── layouts/parent-view.vue        # ParentView 占位
│       ├── directives/access.ts           # v-access 通配符补丁
│       ├── preferences.ts                 # accessMode: 'mixed' 等
│       └── bootstrap.ts                   # 注册指令补丁
├── packages/**                            # 框架层只读（@vben/* + @vben-core/*）
├── pnpm-workspace.yaml / turbo.json       # 只裁剪应用与脚本
├── pnpm-lock.yaml                         # 必须入库（R8）
├── PROVENANCE.md                          # 来源、commit、已登记改动
└── tests/e2e/                             # Playwright：登录、菜单、权限、CRUD 闭环

# 单元/组件测试与源文件同目录（Vitest），如
# frontend/apps/web-antdv-next/src/api/core/ruoyi-crypto.test.ts

platform/                                  # 后端：本次零改动（只读）
```

**Structure Decision**: 选中「Web application」布局。前端沿用 Vben 的 pnpm monorepo 结构（整仓 subtree），
业务代码只落在 `apps/web-antdv-next/src/{api,views}/<context>/` 与 ADR-002 §2.1 登记的应用层接缝；
`packages/**` 与 `src/adapter/**` 只读。测试放 `tests/`（Vitest 单元 + Playwright E2E），
与后端 `platform/` 的模块化单体同仓共存。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 引入 pnpm monorepo（`@vben/*` + `@vben-core/*`）而非单 app | Vben 的布局、权限、请求、表单、表格封装全部在 `packages/**`；只复制 app 会导致依赖缺失且升级困难 | 只复制 `apps/web-antdv-next`：缺少 `packages/**` 无法构建；只装 npm 发布版 `@vben/*` 则失去源码可读性与版本一致性 |
| 应用层覆盖 `v-access` 指令 | 后端超管权限码是 `*:*:*`，Vben 内置指令是精确匹配；改后端展开权限会动后端契约（违反"后端零改动"） | 后端展开权限码：需改 `platform/` 权限接口，违反本规格 FR-013 与 R1 |
| 外链菜单合成虚拟路径 + iframe | Vue Router 不接受完整 URL 作为 path，直接注册会让整张路由表崩溃 | 剔除外链菜单：菜单缺失，违反 SC-002；改后端菜单 path：违反后端零改动 |
| 保留全部 `packages/**`（只裁剪多余 app，不深度裁剪包） | 包之间互相引用，深度裁剪会把改动面扩大到框架层，后续上游升级无法 rebase | 按页面裁剪 packages：改动不可控，且与"框架层只读"直接冲突 |
