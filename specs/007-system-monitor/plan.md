# Implementation Plan: 系统监控模块前端交付（在线用户 / Admin 监控 / 缓存监控 / 任务调度中心）

**Branch**: `007-system-monitor` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-system-monitor/spec.md`；交付依据为已签字
`specs/SPEC-007-system-monitor.md`（REQ-20261111-007，version 1.0）。

> 本计划是已签字 Spec Packet 的实现分解，不是第二真相源。若本计划与 Packet 冲突，以 Packet 为准；
> 若 Packet 本身存在歧义，按 CLAUDE.md 铁律 2 走 STOP，不在计划阶段自行裁决。

## Summary

在现有 Vben Admin 5.7.0 单应用 `frontend/apps/web-antdv-next` 中交付系统监控菜单下的 4 个视图：
在线用户、Admin 监控、缓存监控、任务调度中心。在线用户消费既有列表与单条强退接口，前端做精确筛选、
本地分页、单条强退与逐条批量强退；缓存监控消费既有缓存信息接口，渲染 12 项基本信息与命令统计饼图、
内存仪表盘；Admin 监控与任务调度中心不复制外部控制台功能，只按环境变量地址内嵌官方页面并提供外链。
实现范围限定为前端页面、API 消费层、纯逻辑工具、环境变量与评测资产；`platform/`、
`frontend/packages/**` 零改动，不新增依赖与权限码。全部行为按 SPEC-007 的 10 条 P0、17 条 E-xx 实现，
用单元测试、E2E、评测集与 trace 提供证据。

## Technical Context

**Language/Version**: TypeScript 5.x + Vue 3（Vben Admin 5.7.0 基线，Vite 构建）

**Primary Dependencies**: `@vben/access`、`@vben/common-ui`、`@vben/plugins`（`/echarts`、`/vxe-table`）、
`@vben/request`、`@vben/utils`、`antdv-next`、`dayjs`、`vue`、`vue-router`。全部为现有依赖，
不修改 `package.json`、`pnpm-workspace.yaml` 与 `frontend/packages/**`。

**Storage**: N/A（纯前端；在线会话与缓存数据经既有 RuoYi-Vue-Plus 后端接口读取，后端 MySQL/Redis 不改动）

**Testing**: Vitest（纯逻辑与 API 模块单测，`pnpm test:unit`）；Playwright（E2E，`frontend/tests/e2e`）；
Python 评测执行器（`scripts/evals/run_eval.py`、`scripts/evals/http_probe.mjs` 与
`specs/evals/REQ-20261111-007/`）；`vue-tsc` 与 ESLint。

**Target Platform**: 桌面端现代浏览器，中文界面；不做移动端/响应式专项适配。

**Project Type**: Web 应用（monorepo 中的前端应用；本特性改动 `frontend/apps/web-antdv-next`、
`frontend/tests/e2e`、`scripts/evals` 与评测集目录）。

**Performance Goals**: 按 SPEC-007 §5：在线会话 200 条、每页 10 条时筛选后首屏 P95 ≤ 500ms；
本地翻页 P95 ≤ 100ms；缓存接口返回后首屏 P95 ≤ 2s；iframe 页首帧 P95 ≤ 1s（不含目标站点加载）。
该组指标为上线后 30 天回顾指标，不计入本次 DoD；交付阶段不压测。

**Constraints**: 4 个视图；10 条 P0 断言；17 条 E-xx；`platform/` 与 `frontend/packages/**` 变更数为 0；
新增前端依赖数为 0；不新增权限码；在线列表一次取全量、前端本地分页；筛选为精确等值；
批量强退逐条调用既有单条接口；缓存只读且不提供键浏览/清理；外部控制台地址只从环境变量读取；
`tokenId`、`ipaddr`、`loginLocation` 不进入控制台、浏览器存储、埋点或错误上报。

**Scale/Scope**: 4 个页面/视图，2 个 API 域（在线用户、缓存监控），2 个外部控制台入口，
10 条 P0 断言，17 条 E-xx，1 个 E2E 断言文件与 1 个评测需求目录。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 依据 / 处置 |
|---|---|---|
| I 限界上下文优先 | PASS（N/A 部分已说明） | 本特性是前端“系统监控”页面的交付，不新建服务、不跨库取数；数据经既有 `/monitor/online/*`、`/monitor/cache` 接口消费，不改变后端上下文边界。 |
| II DDD 四层架构 | N/A | 不修改后端 `platform/`，不新增 domain/application/interfaces 层；前端按业务域组织，见原则 VII。 |
| III 聚合与一致性 | N/A | 前端只消费读模型与既有单条写接口；批量强退由前端逐条调用、后端逐条留痕，不在前端引入跨聚合事务。 |
| IV 服务契约先行 | PASS | 不新增端点；列表 `{code,msg,rows,total}`、对象 `{code,msg,data}`、错误码与权限码来自 SPEC-007 §4；契约测试由 API 模块单测与评测集覆盖。 |
| V 数据与持久化 | N/A | 不写 DDL、不新建表、不修改数据库；持久化行为由既有后端接口承接。 |
| VI 微服务治理 | N/A | 不新增服务、网关、注册配置；现有请求客户端已带 token 与 `clientid`，不自建鉴权。 |
| VII 前端工程 | PASS | Vue 3 + TS + Vite + Pinia + Vue Router；统一 `<script setup>`；页面按业务域放在 `views/monitor/*`；纯逻辑抽到页面级 `*-page-logic.ts`；请求走 `#/api/request` 统一封装；权限用路由菜单与按钮双控（批量按钮用组合判定）；类型手写在 `types.ts`（项目无 OpenAPI 生成器，保持既有约定）；复用 vxe-table、ECharts、antdv-next，不复制组件样式。 |
| VIII 测试与质量 | PASS（含 1 项已签字豁免） | 纯逻辑与 API 模块单测覆盖全部转换、筛选、汇总与契约；E2E 覆盖 A-01～A-10 与关键 E-xx；RED→GREEN 证据写入 trace；`vue-tsc` 零错误。性能压测按 SPEC-007 §5 延后到上线后 30 天回顾（见 Complexity Tracking）。SonarQube 未在本仓库 CI 配置，维持既有基线，不因本特性新增债务。 |
| IX 安全与合规 | PASS | 认证走既有请求拦截器；按钮按权限码默认拒绝，批量按钮要求两码齐全；`tokenId`/`ipaddr`/`loginLocation` 仅在表格展示，不落日志/存储/埋点；错误只展示后端 `msg`；不输出令牌与响应体。 |
| X 可观测性 | PASS | 请求失败由既有拦截器输出脱敏后的 `timestamp/level/url/message/code`；页面 `pageerror` 计数为 0；不新增后端 Metrics/Tracing 端点。 |
| XI 依赖与工程规范 | PASS | 不新增依赖；不改 `package.json`/`pnpm-workspace.yaml`；BOM/白名单无变化；代码走既有 ESLint/Prettier。 |
| XII 演进、兼容与技术债 | PASS | 不改 API 语义、不做破坏性变更；不新增架构例外；无 ADR 需求。 |

**Gate 结论**: PASS；唯一需要登记的是原则 VIII 的性能压测延后，已由签字 Packet §5 明确，
列入 Complexity Tracking，不作为违规阻断。

## Project Structure

### Documentation (this feature)

```text
specs/007-system-monitor/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   ├── backend-api-consumed.md
│   ├── routes-and-permissions.md
│   └── ui-contracts.md
└── tasks.md             # Phase 2 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
frontend/apps/web-antdv-next/
├── .env.development                      # 新增 VITE_GLOB_MONITOR_ADMIN_URL / VITE_GLOB_SNAILJOB_ADMIN_URL
├── .env.production                       # 同上（生产默认相对路径）
└── src/
    ├── api/
    │   └── monitor/
    │       ├── online/
    │       │   ├── index.ts              # 列表、单条强退
    │       │   ├── types.ts              # UserOnline / OnlineQuery
    │       │   └── index.test.ts         # 接口契约测试
    │       └── cache/
    │           ├── index.ts              # 缓存信息
    │           ├── types.ts              # CacheInfo / CacheCommandStat
    │           └── index.test.ts
    ├── views/
    │   └── monitor/
    │       ├── online/
    │       │   ├── index.vue             # 在线用户页
    │       │   ├── online-page-logic.ts   # 筛选、分页、格式化、批量汇总
    │       │   └── online-page-logic.test.ts
    │       ├── cache/
    │       │   ├── index.vue             # 缓存监控页
    │       │   ├── cache-page-logic.ts    # 字段转换、图表数据、空值
    │       │   ├── cache-page-logic.test.ts
    │       │   └── components/
    │       │       ├── cache-command-chart.vue
    │       │       └── cache-memory-chart.vue
    │       ├── admin/
    │       │   └── index.vue             # Admin 监控入口（内嵌 + 外链）
    │       ├── snailjob/
    │       │   └── index.vue             # 任务调度中心入口（内嵌 + 外链）
    │       └── components/
    │           ├── external-console.vue  # 两页共用的内嵌/外链视图
    │           ├── external-console-logic.ts
    │           └── external-console-logic.test.ts
    └── types/
        └── env.d.ts                      # ImportMetaEnv 扩展（两个监控地址）

frontend/tests/e2e/
└── spec007-assertions.spec.ts            # A-01～A-10 与关键 E-xx

scripts/evals/
├── seed_spec007.sh                       # 在线会话夹具（spec007_online 两次登录）
└── http_probe.mjs                        # 既有探针（复用）

specs/evals/REQ-20261111-007/
└── cases.yaml                            # HTTP/UI 用例

trace/
└── REQ-20261111-007.yaml                 # 交付后创建并更新
```

**Structure Decision**: 单应用 Web 前端结构。页面按业务域放在 `views/monitor/<view>/`，
API 按域放在 `api/monitor/<domain>/`；在线用户与缓存的判定逻辑抽为 `*-page-logic.ts`，便于
Vitest 覆盖且不依赖 DOM。Admin 与任务调度共用 `views/monitor/components/external-console.vue`，
避免复制 iframe/外链/未配置三种状态。不新增 `packages/**` 组件。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 性能压测不在交付阶段执行（原则 VIII） | 签字 Packet §5 将 P95 指标定义为上线后 30 天回顾指标，交付阶段无稳定压测环境 | 在交付阶段压测会引入与业务无关的负载脚本与不稳定环境依赖，且 Packet 已明确不计入 DoD |
