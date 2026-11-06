# Implementation Plan: 系统管理核心（用户 / 角色 / 菜单 / 部门 / 岗位）

**Branch**: `002-system-management-core` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-system-management-core/spec.md`

## Summary

在 `frontend/apps/web-antdv-next` 中实现系统管理五个子域：用户、角色、菜单、部门、岗位，共 7 个页面（含两个 hidden 授权页）。页面全部消费 RuoYi-Vue-Plus 既有接口，`platform/` 零改动；复用 REQ-001 已交付的登录、会话、动态菜单、统一请求与权限基础能力。

技术路径：Vben `Page` + `useVbenVxeGrid` + `useVbenForm` + `useVbenModal`/`useVbenDrawer`，antdv-next 作为 UI 组件源；每个子域一个 `src/api/system/<domain>` 模块和 `src/views/system/<domain>` 目录；菜单/部门由后端 flat list 在前端构树；权限按钮使用 `v-access`（含 `*:*:*` 通配符的应用层补丁）；导出/导入模板使用 `responseReturn: 'raw'` 下载 blob；字典通过 `/system/dict/data/type/{dictType}` 只读消费并做会话级缓存。

本计划只做设计与契约整理，不改任何代码。Spec Packet（A-xx/E-xx、VO 契约、Non-goals、Golden Samples）经架构/业务签字后才进入 RED→GREEN 实现。

## Technical Context

**Language/Version**: TypeScript 6.0.3；Vue 3.5.34；Node ^22.18.0；pnpm 10.33.4（Corepack）

**Primary Dependencies**: Vben Admin 5.7.0 workspace 包（`@vben/access`、`@vben/common-ui`、`@vben/plugins`、`@vben/request`、`@vben/stores`、`@vben/utils` 等）、antdv-next 1.3.0、vxe-table 4.18.13、Vue Router 5.0.7、Pinia 3.0.4、axios（经 `@vben/request`）、dayjs 1.11.x

**Storage**: 浏览器内存 + Pinia（会话、权限、用户信息）；不新增浏览器持久化业务数据。后端 MySQL / Redis 不变。

**Testing**: Vitest（`pnpm test:unit`，happy-dom）+ `@vue/test-utils`；Playwright（`pnpm test:e2e`，系统 Edge，`E2E_BASE_URL` 默认 `http://localhost:5666`）；评测集 `specs/evals/` 仅覆盖 HTTP 可观测断言（见 research R10）。

**Target Platform**: 桌面端现代浏览器；中文界面；Vite dev server 5666；后端 RuoYi-Vue-Plus `http://localhost:8080`（经 `/api` 代理）

**Project Type**: Web 前端（Vben monorepo 单应用 `apps/web-antdv-next`）；后端只读

**Performance Goals**: SC-002 本地验收环境下列表筛选/分页/重置 ≤ 2s；菜单/部门树展开/折叠 ≤ 2s 且保持筛选状态；同一 `dictType` 每个会话只请求一次（并发去重）。

**Constraints**:
- `platform/` 零改动；接口、错误码、错误结构不得新增或修改（SC-008）
- 不新增任何依赖；只能使用 `specs/constraints/allowlist.md` 已登记项
- 单个 Spec Packet P0 断言 5–12 条（`specs/SPEC-TEMPLATE.md`）
- 新代码覆盖率目标 70%（lines / branches / functions / statements），覆盖范围见 research R10
- 所有敏感操作二次确认；状态开关失败/取消必须回滚
- 不在日志、console、trace 中输出令牌、密码、验证码或明文手机号/邮箱

**Scale/Scope**: 5 个子域、7 个页面、约 40 个消费端点；菜单/部门树节点量级为当前初始化数据（< 500 节点）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 适用性 | 结论 | 说明 |
|---|---|---|---|
| I 限界上下文优先 | 前端 | N/A | 无新服务、无新限界上下文；五个子域同属 `system` 上下文 |
| II DDD 四层架构 | 后端 | N/A | 不修改后端 |
| III 聚合与一致性 | 后端 | N/A | 不修改后端；前端只做展示与提交 |
| IV 服务契约先行 | 前端消费方 | **PASS（条件 E1）** | 不新增对外契约；`contracts/backend-api-consumed.md` 记录消费契约。后端 `/v3/api-docs` 实测返回 `{code:500}`，无法作为类型源，类型改由后端 VO/BO 源文件推导并在 `data-model.md` 固化。E1 须在签字前由 ADR-002 修订或新 ADR 覆盖 |
| V 数据与持久化 | 后端 | N/A | 不修改数据库 |
| VI 微服务治理 | 后端 | N/A | 不新增服务/调用 |
| VII 前端工程 | 前端 | **PASS（条件 E2）** | Vue 3 + TS + Vite + Pinia + Router、业务域目录、统一请求、路由 + 按钮权限、设计令牌复用均满足。UI 库为 antdv-next，与宪章基线 Element Plus 的冲突已由 ADR-002 D9 记录，宪章 MINOR 修订到期 2026-11-15。类型由后端 VO 推导属 E1 例外 |
| VIII 测试与质量 | 前端 | **PASS** | Vitest 单测/组件测试 + Playwright E2E；新逻辑覆盖率 70%；缺陷先写失败测试（RED→GREEN） |
| IX 安全与合规 | 前端 | **PASS** | 路由级 + 按钮级双控；删除/批量/级联/重置密码/停用/移除授权二次确认；后端已脱敏手机号/邮箱；不落敏感数据到日志 |
| X 可观测性 | 后端 | N/A | 不新增服务；前端错误提示复用后端 `msg` |
| XI 依赖与工程规范 | 前端 | **PASS（条件 E3）** | 本需求不新增依赖。`happy-dom`、`@types/crypto-js`、直接 `playwright` 不在 allowlist 的存量缺口归 REQ-001 清理，REQ-002 不扩大 |
| XII 演进、兼容与技术债 | 前端 | **PASS（条件 E1/E2）** | 无新增架构偏离；E1/E2 已有 ADR-002 记录，宪章修订与契约源例外在签字前闭环 |

**Gate 结论**：无未论证的违规。E1（OpenAPI 不可用导致类型手写）、E2（宪章 UI 基线待 MINOR 修订）、E3（存量 allowlist 缺口）均为已记录条件项，不阻塞计划；**实现前必须完成 Spec Packet 签字，并确认 E1/E2 的处置已写入签字记录**。

## Project Structure

### Documentation (this feature)

```text
specs/002-system-management-core/
├── spec.md                       # 上游意图（只读，非交付依据）
├── plan.md                       # 本文件
├── research.md                   # Phase 0 决策
├── data-model.md                 # VO / Form / Query / Tree 契约
├── quickstart.md                 # 验收与运行指南
├── contracts/
│   └── backend-api-consumed.md   # 消费的后端接口契约
└── tasks.md                      # Phase 2 输出（/speckit-tasks）
```

### Source Code (repository root)

```text
frontend/apps/web-antdv-next/src/
├── api/
│   ├── request.ts                        # 既有统一请求封装（不改语义）
│   ├── core/                             # REQ-001 登录/菜单/用户（依赖，不重复实现）
│   └── system/
│       ├── common.ts                     # 字典读取、共享类型出口
│       ├── user/
│       │   ├── index.ts                  # 用户、授权角色、导入导出 API
│       │   └── types.ts                  # UserVO / UserForm / UserQuery / UserInfoVO
│       ├── role/
│       │   ├── index.ts                  # 角色、数据权限、授权用户 API
│       │   └── types.ts
│       ├── menu/
│       │   ├── index.ts                  # 菜单 CRUD、菜单树、角色菜单树 API
│       │   └── types.ts
│       ├── dept/
│       │   ├── index.ts                  # 部门 CRUD、排除子部门 API
│       │   └── types.ts
│       └── post/
│           ├── index.ts                  # 岗位 CRUD、部门树、导出 API
│           └── types.ts
├── composables/
│   └── use-dict.ts                       # 字典会话缓存 + useDict()
├── utils/
│   └── system/
│       ├── id.ts                         # Id 归一化与比较
│       ├── query.ts                      # addDateRange / 空值清理
│       └── tree.ts                       # flat → tree、树选项映射、禁用部门过滤
├── directives/
│   └── access.ts                         # REQ-001 前置项：*:*:* 通配符 v-access 补丁
└── views/system/
    ├── user/
    │   ├── index.vue                     # 用户列表 + 部门树 + 新增/编辑/导入/导出
    │   ├── authRole.vue                  # hidden：分配角色
    │   └── components/                   # 用户表单、导入弹窗、重置密码弹窗
    ├── role/
    │   ├── index.vue                     # 角色列表 + 菜单权限 + 数据权限
    │   ├── authUser.vue                  # hidden：分配用户
    │   └── components/                   # 角色表单、数据权限抽屉、选择用户弹窗
    ├── menu/
    │   └── index.vue                     # 菜单树表 + 新增/编辑/级联删除
    ├── dept/
    │   └── index.vue                     # 部门树表 + 新增/编辑/删除
    └── post/
        └── index.vue                     # 岗位列表 + 部门树筛选 + 导出

frontend/tests/e2e/
├── system-user.spec.ts
├── system-role.spec.ts
├── system-menu.spec.ts
├── system-dept.spec.ts
└── system-post.spec.ts
```

**Structure Decision**: 采用 Vben 单应用内“业务域目录”布局。`api/system/<domain>` 与 `views/system/<domain>` 一一对应，页面私有组件放同级 `components/`，跨域逻辑只允许放在 `api/system/common.ts`、`composables/use-dict.ts`、`utils/system/*`。不修改 `packages/**`，避免把业务逻辑沉入框架层。

## Complexity Tracking

| Violation / 复杂度 | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 类型契约由后端 VO/BO 手写，而非 OpenAPI 生成（IV/VII，E1） | 后端 `/v3/api-docs` 返回业务错误，且本次 `platform/` 只读；现有 `specs/constraints` 未提供可用 OpenAPI 快照 | 直接 `any` 或使用旧 plus-ui 类型会引入后端已不存在的字段（`delFlag`、`admin`、`parentName`），导致运行期错配；故按后端源文件固化类型并在 `contracts/` 可审计 |
| 菜单/部门在客户端构树 | 后端 `/list` 返回 flat list，仅 `*/tree*` 端点返回树；列表筛选需要保留“孤儿节点提升为根”的 plus-ui 行为 | 改后端返回树违反 `platform/` 零改动；只用 tree 端点无法保留筛选语义（tree 端点按条件过滤后只返回单根子树） |
| `v-access` 通配符补丁 | 后端超管权限码为 `*:*:*`，Vben 上游指令做精确匹配；不补丁会导致超管所有按钮消失 | 让后端展开权限码违反零改动；在页面内逐按钮特判会把权限规则散落到视图层 |
| hidden 授权页按路径参数导航 | 后端菜单路径为 `/system/user-auth/role/:userId`、`/system/role-auth/user/:roleId`，路由名不保证稳定 | 按路由名 `push({name})` 依赖后端 `routeName + menuId` 命名，重命名菜单即失效；按解析后的 path 导航与 plus-ui 一致 |
| 字典会话级缓存 | 5 个子域重复使用 `sys_normal_disable` 等字典，逐页请求会放大首屏请求数并触发限流 | 每次组件挂载都请求：简单但重复；引入全局 Pinia store：把只读字典变成跨页共享状态，超出 Pinia 使用边界 |

## Phase 0 / Phase 1 Outputs

- [research.md](./research.md) — 12 项实现决策与替代方案
- [data-model.md](./data-model.md) — UserVO / RoleVO / MenuVO / DeptVO / PostVO、Form、Query、Tree 契约
- [contracts/backend-api-consumed.md](./contracts/backend-api-consumed.md) — 端点、权限码、请求/响应、错误行为
- [quickstart.md](./quickstart.md) — 本地运行、自动化门禁、逐模块验收场景
