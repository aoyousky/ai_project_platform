# Tasks: 系统监控模块前端交付（在线用户 / Admin 监控 / 缓存监控 / 任务调度中心）

**Input**: Design documents from `specs/007-system-monitor/`

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、
[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)；
交付依据为已签字 `specs/SPEC-007-system-monitor.md` v1.0。

**Tests**: 测试任务为强制项，不得省略或后置。每个用户故事先写测试、确认失败（RED），再实现（GREEN）。
测试范围按 Constitution VIII：纯逻辑与 API 模块单测、E2E 关键链路、契约测试。

**Organization**: 任务按用户故事分组，每个故事可独立实现与验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1～US4）
- 描述包含精确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 环境变量与类型声明，所有视图共用。

- [ ] T001 在 `frontend/apps/web-antdv-next/.env.development` 新增 `VITE_GLOB_MONITOR_ADMIN_URL=http://localhost:9090/admin/applications` 与 `VITE_GLOB_SNAILJOB_ADMIN_URL=http://localhost:8800/snail-job`
- [ ] T002 [P] 在 `frontend/apps/web-antdv-next/.env.production` 新增 `VITE_GLOB_MONITOR_ADMIN_URL=/admin/applications` 与 `VITE_GLOB_SNAILJOB_ADMIN_URL=/snail-job`
- [ ] T003 [P] 在 `frontend/apps/web-antdv-next/src/types/env.d.ts` 扩展 `ImportMetaEnv`，声明两个地址为 `string | undefined`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Admin 监控与任务调度中心共用的外部控制台视图，US3/US4 都依赖。

**CRITICAL**: 本阶段完成前，不开始 US3/US4。

### Tests for Foundational

- [ ] T004 [P] 编写 `frontend/apps/web-antdv-next/src/views/monitor/components/external-console-logic.test.ts`，覆盖已配置/未配置、地址原样保留、外链参数，先确认 RED
- [ ] T005 [P] 在 `frontend/tests/e2e/spec007-assertions.spec.ts` 新增外部控制台占位用例（未配置提示与 iframe 数量），先确认 RED

### Implementation for Foundational

- [ ] T006 实现 `frontend/apps/web-antdv-next/src/views/monitor/components/external-console-logic.ts`，提供 `isConfigured(url)` 与 `externalLinkProps(url)`
- [ ] T007 实现 `frontend/apps/web-antdv-next/src/views/monitor/components/external-console.vue`，渲染 `monitor-iframe`、`monitor-open-external` 与「未配置监控地址」三种状态（依赖 T006）

**Checkpoint**: 外部控制台基础视图可被 US3/US4 直接使用。

---

## Phase 3: User Story 1 - 在线用户查看与强制下线 (Priority: P1) — MVP

**Goal**: 在线列表、精确筛选、本地分页、单条强退、前端批量强退与权限隐藏。

**Independent Test**: 用 2 个有效会话完成查询、单条强退、批量强退；列表总数与后端一致；
`spec007_limited` 看不到强退按钮；`pageerror` 为 0。

### Tests for User Story 1 (MANDATORY - write first, verify RED)

- [ ] T008 [P] [US1] 编写 `frontend/apps/web-antdv-next/src/api/monitor/online/index.test.ts`，覆盖列表参数原样传递、路径 `tokenId` 编码、失败时 reject，先确认 RED
- [ ] T009 [P] [US1] 编写 `frontend/apps/web-antdv-next/src/views/monitor/online/online-page-logic.test.ts`，覆盖空值显示、设备类型回退、时间格式、筛选参数、本地分页 12 条、批量汇总（全成功/部分失败/网络错误），先确认 RED
- [ ] T010 [P] [US1] 在 `frontend/tests/e2e/spec007-assertions.spec.ts` 新增 A-01～A-05、A-10 与 E-01～E-08、E-15、E-16 用例，先确认 RED

### Implementation for User Story 1

- [ ] T011 [P] [US1] 创建 `frontend/apps/web-antdv-next/src/api/monitor/online/types.ts`，定义 `UserOnline`、`OnlineQuery`，字段按 Packet §4.1
- [ ] T012 [US1] 实现 `frontend/apps/web-antdv-next/src/api/monitor/online/index.ts`，提供 `listOnlineApi` 与 `forceLogoutOnlineApi`（依赖 T011）
- [ ] T013 [P] [US1] 实现 `frontend/apps/web-antdv-next/src/views/monitor/online/online-page-logic.ts`，提供 `formatLoginTime`、`deviceTypeText`、`buildOnlineQuery`、`paginateRows`、`summarizeBatchResult`
- [ ] T014 [US1] 实现 `frontend/apps/web-antdv-next/src/views/monitor/online/index.vue`：查询表单、10 列表格、本地分页、单条/批量强退、AND 权限判定与 `data-testid`（依赖 T012、T013、T007）
- [ ] T015 [US1] 运行 US1 单测与 E2E，修复至 GREEN；确认 12 条分页场景由单测覆盖、翻页不发列表请求

**Checkpoint**: US1 可独立演示；在线列表与强退闭环完成。

---

## Phase 4: User Story 2 - 缓存运行状态巡检 (Priority: P1)

**Goal**: 缓存 12 项基本信息、命令统计饼图、内存仪表盘、空值与接口失败处理。

**Independent Test**: 缓存接口成功时 12 个标签、`dbSize` 与 2 个画布可见；命令统计为空显示
「暂无数据」；接口失败只显示后端 `msg`。

### Tests for User Story 2 (MANDATORY - write first, verify RED)

- [ ] T016 [P] [US2] 编写 `frontend/apps/web-antdv-next/src/api/monitor/cache/index.test.ts`，覆盖成功解包与失败 reject，先确认 RED
- [ ] T017 [P] [US2] 编写 `frontend/apps/web-antdv-next/src/views/monitor/cache/cache-page-logic.test.ts`，覆盖 `null`/`0`/缺键、运行模式、AOF、CPU 两位小数、网络合并、命令序列转换，先确认 RED
- [ ] T018 [P] [US2] 在 `frontend/tests/e2e/spec007-assertions.spec.ts` 新增 A-06、A-07 与 E-09～E-11、E-14 用例，先确认 RED

### Implementation for User Story 2

- [ ] T019 [P] [US2] 创建 `frontend/apps/web-antdv-next/src/api/monitor/cache/types.ts`，定义 `CacheInfo` 与 `CacheCommandStat`
- [ ] T020 [US2] 实现 `frontend/apps/web-antdv-next/src/api/monitor/cache/index.ts`，提供 `getCacheInfoApi`（依赖 T019）
- [ ] T021 [P] [US2] 实现 `frontend/apps/web-antdv-next/src/views/monitor/cache/cache-page-logic.ts`，提供 `displayValue`、`redisModeText`、`aofText`、`cpuText`、`networkText`、`commandSeries`、`memoryGaugeOption`
- [ ] T022 [P] [US2] 实现 `frontend/apps/web-antdv-next/src/views/monitor/cache/components/cache-command-chart.vue`，命令统计饼图与「暂无数据」
- [ ] T023 [P] [US2] 实现 `frontend/apps/web-antdv-next/src/views/monitor/cache/components/cache-memory-chart.vue`，内存仪表盘
- [ ] T024 [US2] 实现 `frontend/apps/web-antdv-next/src/views/monitor/cache/index.vue`：12 项信息、`cache-db-size`、图表容器、失败仅显示 `msg`（依赖 T020、T021、T022、T023）
- [ ] T025 [US2] 运行 US2 单测与 E2E，修复至 GREEN；确认空统计时命令图 `canvas=0`、内存图 `canvas=1`

**Checkpoint**: US2 可独立演示；缓存巡检闭环完成。

---

## Phase 5: User Story 3 - 统一进入服务监控控制台 (Priority: P2)

**Goal**: Admin 监控页按环境变量内嵌官方控制台，提供外链，处理未配置与不可达。

**Independent Test**: 配置地址后 iframe `src` 与外链 `href` 等于配置值、高度 ≥ 400；
地址为空时显示「未配置监控地址」且无 iframe。

### Tests for User Story 3 (MANDATORY - write first, verify RED)

- [ ] T026 [P] [US3] 在 `frontend/tests/e2e/spec007-assertions.spec.ts` 新增 A-08 与 E-12、E-13、E-17 用例，先确认 RED
- [ ] T027 [P] [US3] 在 `frontend/apps/web-antdv-next/src/views/monitor/components/external-console-logic.test.ts` 补充 Admin 地址来源与空串场景（依赖 T004）

### Implementation for User Story 3

- [ ] T028 [US3] 实现 `frontend/apps/web-antdv-next/src/views/monitor/admin/index.vue`，读取 `VITE_GLOB_MONITOR_ADMIN_URL` 并渲染 `external-console.vue`（依赖 T007、T003）
- [ ] T029 [US3] 运行 US3 E2E，修复至 GREEN；确认 iframe 高度 ≥ 400、外链 `rel="noopener noreferrer"`

**Checkpoint**: US3 可独立演示；Admin 控制台入口闭环完成。

---

## Phase 6: User Story 4 - 统一进入任务调度控制台 (Priority: P2)

**Goal**: 任务调度中心页按环境变量内嵌 SnailJob 控制台，提供外链，处理未配置。

**Independent Test**: 配置地址后 iframe `src` 与外链 `href` 等于配置值、高度 ≥ 400；
地址为空时显示「未配置监控地址」且无 iframe。

### Tests for User Story 4 (MANDATORY - write first, verify RED)

- [ ] T030 [US4] 在 `frontend/tests/e2e/spec007-assertions.spec.ts` 新增 A-09 与 E-12、E-17 的 SnailJob 用例，先确认 RED

### Implementation for User Story 4

- [ ] T031 [US4] 实现 `frontend/apps/web-antdv-next/src/views/monitor/snailjob/index.vue`，读取 `VITE_GLOB_SNAILJOB_ADMIN_URL` 并渲染 `external-console.vue`（依赖 T007、T003）
- [ ] T032 [US4] 运行 US4 E2E，修复至 GREEN；确认与 Admin 页共用组件且无重复实现

**Checkpoint**: 4 个视图全部可独立验收。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 评测资产、溯源、门禁与范围核查。

- [ ] T033 [P] 创建 `specs/evals/REQ-20261111-007/cases.yaml`，覆盖 A-01～A-10 与 E-xx，认证头与 `EVAL_*` 占位按既有执行器约定
- [ ] T034 [P] 创建 `scripts/evals/seed_spec007.sh`，可重复创建 `spec007_online` 两会话、`spec007_limited`、`spec007_no_monitor` 夹具
- [ ] T035 运行 `python scripts/evals/run_eval.py --req REQ-20261111-007 --report specs/evals/reports`，修复至全绿
- [ ] T036 运行 `cd frontend && pnpm test:unit && pnpm check:type && pnpm lint`，修复至零失败
- [ ] T037 [P] 运行 `git diff --stat` 核查 `platform/` 与 `frontend/packages/**` 变更数为 0、`package.json` 无新增依赖
- [ ] T038 [P] 按 `scripts/trace-schema.md` 创建 `trace/REQ-20261111-007.yaml`，把 10 条 P0 的 file:line 写入 `assertion_map`
- [ ] T039 运行 `bash scripts/ci-gate.sh` 与 `/spec-check`，修复 FAIL 项并复跑
- [ ] T040 按 [quickstart.md](quickstart.md) 手工验收 4 个视图，记录结果并运行 `/review` 12 项 checklist
- [ ] T041 安全与范围核查：搜索 `tokenId`/`ipaddr`/`loginLocation` 是否进入 `console`、浏览器存储、埋点或错误上报；确认无缓存键浏览/清理、在线导出、轮询/SSE 与后端批量强退代码；记录结果供 `/review` 与 trace

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始。
- **Foundational (Phase 2)**: 依赖 Setup；阻塞 US3/US4。
- **US1（Phase 3）**：依赖 Setup；不依赖 Foundational（不使用外部控制台组件）。
- **US2（Phase 4）**：依赖 Setup；不依赖 Foundational。
- **US3（Phase 5）**：依赖 Foundational T007 与 T003。
- **US4（Phase 6）**：依赖 Foundational T007 与 T003。
- **Polish（Phase 7）**：依赖全部用户故事与实现任务。

### User Story Dependencies

- **US1 (P1)**：可独立完成，无跨故事依赖。
- **US2 (P1)**：可独立完成，无跨故事依赖。
- **US3 (P2)**：依赖共享 `external-console.vue`；不与 US1/US2 共享状态。
- **US4 (P2)**：依赖共享 `external-console.vue`；与 US3 只共用组件，不共用页面。

### Within Each User Story

- 测试必须先写并确认失败（RED），再实现（GREEN）。
- 类型先于 API；纯逻辑与 API 先于页面；页面集成后跑 E2E。
- 每个故事完成后单独验收，再进入下一优先级。

### Parallel Opportunities

- T002、T003 可并行；T004、T005 可并行；T006 依赖 T004。
- US1 的 T008、T009、T010 可并行（不同文件）。
- US1 的 T011 与 T013 可并行（类型与纯逻辑不同文件）。
- US2 的 T016、T017、T018 可并行；T019 与 T021 可并行；T022 与 T023 可并行。
- US3 的 T026 与 T027 可并行。
- Polish 的 T033、T034、T037、T038 可并行。

---

## Parallel Example: User Story 1

```bash
# 先并行写三个测试并确认 RED：
Task: "编写 api/monitor/online/index.test.ts"
Task: "编写 views/monitor/online/online-page-logic.test.ts"
Task: "在 tests/e2e/spec007-assertions.spec.ts 新增 A-01～A-05/A-10 用例"

# 测试就绪后并行实现类型与纯逻辑：
Task: "创建 api/monitor/online/types.ts"
Task: "实现 views/monitor/online/online-page-logic.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 Setup 与 Phase 2 Foundational。
2. 完成 Phase 3 US1：先测试 RED，再实现至 GREEN。
3. 停在此处独立验收 US1（在线列表、筛选、单条/批量强退、权限）。
4. 可演示后再进入 US2。

### Incremental Delivery

1. Setup + Foundational → 基础就绪。
2. US1 → 独立验收 → 演示（MVP）。
3. US2 → 独立验收 → 演示。
4. US3 → 独立验收 → 演示。
5. US4 → 独立验收 → 演示。
6. Polish → 评测集、trace、门禁与 review。

### Parallel Team Strategy

1. 团队共同完成 Setup + Foundational。
2. 完成后：
   - 开发者 A：US1（在线用户）。
   - 开发者 B：US2（缓存监控）。
   - 开发者 C：US3 + US4（两个外部控制台页，共用组件）。
3. 各故事独立验收后合并；Polish 由一人统一执行，避免评测资产冲突。

---

## Notes

- [P] 任务为不同文件、无未完成依赖。
- 每个故事先 RED 后 GREEN；测试失败记录写入 trace 的 `test_evidence`。
- 不修改 `platform/`、`frontend/packages/**`、`package.json`、权限码定义。
- 不新增静态路由；4 个页面文件必须匹配后端 `component`。
- 敏感字段不进入控制台、浏览器存储、埋点或错误上报。
- 评测资产必须真实可执行，不得伪造通过结果。
