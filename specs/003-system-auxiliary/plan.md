# Implementation Plan: 系统管理辅助模块（字典 / 参数 / 公告 / 日志 / 文件）

**Branch**: `003-system-auxiliary` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-system-auxiliary/spec.md`；交付依据为已签字
`specs/SPEC-004-system-auxiliary.md`（REQ-20261107-005，version 1.0）。

> 本计划是已签字 Spec Packet 的实现分解，不是第二真相源。若本计划与 Packet 冲突，以 Packet 为准；
> 若 Packet 本身存在歧义，按 CLAUDE.md 铁律 2 走 STOP，不在计划阶段自行裁决。

## Summary

在现有 Vben Admin 5.7.0 单应用 `frontend/apps/web-antdv-next` 中交付 8 个系统管理视图：
字典管理（含隐藏字典数据页）、参数设置、通知公告、操作日志、登录日志、文件管理、隐藏文件配置页。
实现范围限定为前端页面、API 消费层、纯逻辑工具与测试；`platform/`、`frontend/packages/**` 零改动，
不新增依赖。所有列表、筛选、分页、增删改、导出、缓存刷新、上传下载、解锁与默认配置切换
按 SPEC-004 的 10 条 P0、8 条 P1 与 34 条 E-xx 实现，并用单元测试、E2E、评测集与 trace 提供证据。

## Technical Context

**Language/Version**: TypeScript 5.x + Vue 3（Vben Admin 5.7.0 基线，Vite 构建）

**Primary Dependencies**: `@vben/access`、`@vben/common-ui`、`@vben/plugins`（`/vxe-table`、`/tiptap`）、
`@vben/request`、`@vben/utils`、`antdv-next`、`dayjs`、`vue`、`vue-router`。全部为现有依赖。

**Storage**: N/A（纯前端；数据经既有 RuoYi-Vue-Plus 后端接口读写，后端 MySQL/Redis 不改动）

**Testing**: Vitest（单元/组件，`pnpm test:unit`，DOM 环境）；Playwright（E2E，`tests/e2e`，Edge channel）；
Python 评测执行器（`scripts/evals/run_eval.py` + `scripts/evals/http_probe.mjs`，`specs/evals/REQ-20261107-005/`）；
`vue-tsc` 与 ESLint。

**Target Platform**: 桌面端现代浏览器，中文界面；不做移动端/响应式专项适配。

**Project Type**: Web 应用（monorepo 中的前端应用；本特性只改 `frontend/apps/web-antdv-next`，
以及评测脚本 `scripts/evals/`）。

**Performance Goals**: 按 SPEC-004 §5：8 个页面列表接口 P95 ≤ 2s；页面路由切换 ≤ 500ms（不含接口耗时）；
导出请求发起后 2s 内开始返回响应体。该组指标为上线后 30 天回顾指标，不计入本次 DoD；交付阶段不压测。

**Constraints**: 8 个视图；10 条 P0 + 8 条 P1 + 34 条 E；`platform/` 与 `frontend/packages/**` 变更数为 0；
新增前端依赖数为 0；ID 统一按字符串比较与回传；时间按 `yyyy-MM-dd HH:mm:ss` 字符串直出；
`secretKey` 仅以遮蔽输入出现在编辑表单，列表/详情/日志/控制台/trace 不得出现明文。

**Scale/Scope**: 8 个页面/视图，7 个 API 域（字典、参数、公告、操作日志、登录日志、文件、文件配置），
10 条 P0 断言，18 条 A-xx，34 条 E-xx。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 依据 / 处置 |
|---|---|---|
| I 限界上下文优先 | PASS（N/A 部分已说明） | 本特性是前端“系统管理”页面的交付，不新建服务、不跨库取数；数据经既有 `/system/*`、`/monitor/*`、`/resource/oss/*` 接口消费，不改变后端上下文边界。 |
| II DDD 四层架构 | N/A | 不修改后端 `platform/`，不新增 domain/application/interfaces 层；前端按业务域组织，见原则 VII。 |
| III 聚合与一致性 | N/A | 前端只消费读模型与单条写接口；默认配置切换、清空日志等一致性由后端单接口保证，不在前端引入跨聚合事务。 |
| IV 服务契约先行 | PASS | 不新增端点；全部接口、响应封装 `{code,msg,data}` / `{code,msg,rows,total}`、错误码与权限码来自 SPEC-004 §4.2；契约测试以 API 模块单测与评测集覆盖。 |
| V 数据与持久化 | N/A | 不写 DDL、不新建表、不修改数据库；所有持久化行为由既有后端接口承接。 |
| VI 微服务治理 | N/A | 不新增服务、网关、注册配置；现有请求客户端已带 token 与 `clientid`，不自建鉴权。 |
| VII 前端工程 | PASS | Vue 3 + TS + Vite + Pinia + Vue Router；统一 `<script setup>`；页面按业务域放在 `views/system/*` 与 `views/monitor/*`；状态留在页面/组合函数；请求走 `#/api/request` 统一封装；权限用 `v-access:code` 与路由菜单双控；API 类型手写在 `types.ts`（现有项目无 OpenAPI 生成器，保持既有约定）；复用 vxe-table、tiptap、antdv-next 与既有工具，不复制组件样式。 |
| VIII 测试与质量 | PASS（含 1 项已签字豁免） | 单元测试覆盖纯逻辑与 API 模块；E2E 覆盖 P0/P1 交互；RED→GREEN 证据写入 trace；`vue-tsc` 零错误。性能压测按 SPEC-004 §5 延后到上线后 30 天回顾（见 Complexity Tracking）。SonarQube 未在本仓库 CI 配置，维持既有基线，不因本特性新增债务。 |
| IX 安全与合规 | PASS | 认证走既有请求拦截器；按钮按权限码默认拒绝；`secretKey` 遮蔽且不落日志；标题/长度/格式校验；错误只展示后端 `msg`；不输出令牌、验证码、密钥。 |
| X 可观测性 | PASS | 请求失败由既有拦截器输出脱敏后的 `timestamp/level/url/message/code`；页面 `pageerror` 计数为 0；不新增后端 Metrics/Tracing 端点。 |
| XI 依赖与工程规范 | PASS | 不新增依赖；不改 `package.json`/`pnpm-workspace.yaml`；BOM/白名单无变化；代码走既有 ESLint/Prettier。 |
| XII 演进、兼容与技术债 | PASS | 不改 API 语义、不做破坏性变更；不新增架构例外；无 ADR 需求。 |

**Gate 结论**: PASS；唯一需要登记的是原则 VIII 的性能压测延后，已由签字 Packet §5 明确，
列入 Complexity Tracking，不作为违规阻断。

## Project Structure

### Documentation (this feature)

```text
specs/003-system-auxiliary/
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
frontend/apps/web-antdv-next/src/
├── api/
│   ├── system/
│   │   ├── common.ts                    # 既有：PageResult / Id / downloadBlob / dict 按类型读取
│   │   ├── dict/{index.ts,types.ts,index.test.ts}
│   │   ├── config/{index.ts,types.ts,index.test.ts}
│   │   ├── notice/{index.ts,types.ts,index.test.ts}
│   │   └── oss/
│   │       ├── index.ts                 # 文件列表、上传、下载、删除
│   │       ├── config.ts                # 文件配置列表、详情、增删改、切换默认
│   │       ├── types.ts                 # Oss / OssUpload / OssQuery
│   │       ├── config-types.ts          # OssConfig / OssConfigForm / OssConfigQuery
│   │       ├── index.test.ts            # 文件 API 契约测试
│   │       └── config.test.ts           # 文件配置 API 契约测试
│   └── monitor/
│       ├── operlog/{index.ts,types.ts,index.test.ts}
│       └── logininfor/{index.ts,types.ts,index.test.ts}
├── views/
│   ├── system/
│   │   ├── dict/
│   │   │   ├── index.vue                # 双栏字典管理（可见页）
│   │   │   ├── data.vue                 # 隐藏字典数据页（component=system/dict/data）
│   │   │   ├── components/dict-type-form.vue
│   │   │   ├── components/dict-data-form.vue
│   │   │   ├── dict-page-logic.ts
│   │   │   └── dict-page-logic.test.ts
│   │   ├── config/
│   │   │   ├── index.vue
│   │   │   ├── components/config-form.vue
│   │   │   ├── config-page-logic.ts
│   │   │   └── config-page-logic.test.ts
│   │   ├── notice/
│   │   │   ├── index.vue
│   │   │   ├── components/notice-form.vue
│   │   │   ├── legacy-notice-html.ts
│   │   │   ├── notice-page-logic.ts
│   │   │   └── *.test.ts
│   │   └── oss/
│   │       ├── index.vue
│   │       ├── config.vue               # 隐藏文件配置页（component=system/oss/config）
│   │       ├── components/oss-config-form.vue
│   │       ├── oss-page-logic.ts
│   │       ├── oss-config-page-logic.ts
│   │       └── *.test.ts
│   └── monitor/
│       ├── operlog/
│       │   ├── index.vue
│       │   ├── components/operlog-detail-modal.vue
│       │   ├── operlog-page-logic.ts
│       │   └── operlog-page-logic.test.ts
│       └── logininfor/
│           ├── index.vue
│           ├── logininfor-page-logic.ts
│           └── logininfor-page-logic.test.ts
├── adapter/
│   ├── component/index.ts               # 追加 Tiptap 表单项（应用级适配，不改 packages）
│   └── form.ts                          # 追加 Tiptap 的 modelPropName 映射
└── utils/system/
    ├── id.ts / pagination.ts / status.ts / query.ts  # 既有，复用
    └── (仅在确有共享需求时新增纯函数，优先放在各页面 page-logic)

frontend/tests/e2e/
├── system-dict.spec.ts
├── system-config.spec.ts
├── system-notice.spec.ts
├── system-operlog.spec.ts
├── system-logininfor.spec.ts
├── system-oss.spec.ts
├── system-oss-config.spec.ts
└── spec004-assertions.spec.ts           # A-09/A-10/A-13/A-14 等跨页断言

specs/evals/REQ-20261107-005/
├── cases.yaml
└── README.md

scripts/evals/
├── seed_spec004.sh
└── run_eval.py                          # 追加 EVAL_SPEC004_* 默认值与 auth 类型
```

**Structure Decision**: 采用现有单应用结构，不新建包、不改路由表。动态菜单由后端 `getRouters` 驱动，
`router/access.ts` 的 `import.meta.glob('../views/**/*.vue')` 会自动发现新页面；`markUnportedMenus`
只在页面文件不存在时才落 `ComingSoon`。因此 8 个视图只需新增对应视图文件，不写静态路由。
隐藏菜单的组件名与文件路径必须严格对应：

| 后端 `component` | 前端文件 | 菜单 URL |
|---|---|---|
| `system/dict/index` | `views/system/dict/index.vue` | `/system/dict` |
| `system/dict/data` | `views/system/dict/data.vue` | `/system/dict-data/index/:dictId` |
| `system/config/index` | `views/system/config/index.vue` | `/system/config` |
| `system/notice/index` | `views/system/notice/index.vue` | `/system/notice` |
| `monitor/operlog/index` | `views/monitor/operlog/index.vue` | `/system/log/operlog` |
| `monitor/logininfor/index` | `views/monitor/logininfor/index.vue` | `/system/log/logininfor` |
| `system/oss/index` | `views/system/oss/index.vue` | `/system/oss` |
| `system/oss/config` | `views/system/oss/config.vue` | `/system/oss-config/index` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 原则 VIII 要求核心接口压测；本交付不压测，改为上线后 30 天回顾 | SPEC-004 §5 已由业务与架构签字，将 P95/路由切换/导出响应定义为上线回顾指标，不计入 DoD；本特性又是纯前端、无新增后端接口 | 在交付阶段压测需要额外起后端/数据库负载环境，且与 Packet 的 DoD 冲突；以签字 Packet 为准，遗留指标登记为上线回顾改进项 |

## Phase 0: Research

研究结论见 [research.md](research.md)。所有技术未知项已在计划阶段收敛，无 NEEDS CLARIFICATION 遗留：

- 页面与 API 的组织方式沿用现有 `views/system/*`、`api/system/*` 模式；
- 动态路由无需修改路由表，新增视图文件即可被 `pageMap` 发现；
- 通知公告使用现有 `@vben/plugins/tiptap`，历史 `ql-*` 类在进入编辑器前归一化为内联样式；
- 上传/下载/导出复用现有请求封装与二进制响应识别，不新增依赖；
- 评测集沿用 `scripts/evals/run_eval.py` + `http_probe.mjs`，新增 `seed_spec004.sh` 与 `EVAL_SPEC004_*` 默认值。

## Phase 1: Design

设计产物：

- [data-model.md](data-model.md)：8 个实体、字段/可空/空值语义、状态流转、校验规则；
- [contracts/backend-api-consumed.md](contracts/backend-api-consumed.md)：接口、权限码、请求/响应类型；
- [contracts/routes-and-permissions.md](contracts/routes-and-permissions.md)：8 个视图的路由、组件、权限与隐藏页行为；
- [contracts/ui-contracts.md](contracts/ui-contracts.md)：页面区域、操作、二次确认、测试选择器与可观测行为；
- [quickstart.md](quickstart.md)：本地栈、夹具、单元/E2E/评测执行与人工验收步骤。

**Post-Design Constitution Check**: 设计未引入新服务、新依赖、新端点或后端改动；原则 VII/IX/XI
仍满足，原则 VIII 的压测延后仍按签字 Packet 记录，无新增违规。

## Implementation Strategy

按用户故事优先级与依赖顺序推进；每个故事完成“先失败测试 → 实现 → 通过 → E2E/评测证据”。

1. **基础层（阻塞所有页面）**
   - 新增各域 `types.ts` 与 API 模块；复用 `PageResult`、`Id`、`normalizeIds`、`downloadBlob`；
   - 为 GET 二进制下载补充共享 helper（识别 JSON 错误体），不改变既有 `downloadBlob` 行为；
   - 在 `adapter/component/index.ts` 与 `adapter/form.ts` 注册 `Tiptap` 表单项（`modelValue` 映射），
     不改 `frontend/packages/**`；
   - 建立 `scripts/evals/seed_spec004.sh` 与 `specs/evals/REQ-20261107-005/cases.yaml` 骨架（P0 全覆盖）。
2. **US1 字典管理 + 隐藏字典数据页（P1）**
   - 双栏页面、类型/数据两套 CRUD、导出、刷新缓存（成功后 `clearDictCache()`）；
   - 隐藏页按 `dictId` 先查类型详情再按 `dictType` 加载数据；无效编号走空状态/错误提示；
   - 单测覆盖查询构造、表单载荷、缓存刷新、删除保护；E2E 覆盖 A-01/A-02。
3. **US2 参数设置（P1）**
   - 列表/筛选/分页、CRUD、导出、刷新缓存；内置参数删除走后端拒绝；
   - 单测覆盖查询构造、内置标记、刷新缓存；E2E 覆盖 A-03。
4. **US3 通知公告（P1）**
   - 列表/筛选（仅标题、操作人员、类型）、CRUD、tiptap 富文本；
   - `legacy-notice-html.ts` 归一化 `ql-align-*`/`ql-size-*`；编辑器 `previewable=false`，不经过 `v-html`；
   - 标题脚本字符校验；单测覆盖归一化与校验；E2E 覆盖 A-04/A-11。
5. **US4 操作日志（P2）**
   - 列表/筛选/排序、详情弹窗、删除/清空/导出；`operParam`/`jsonResult` 先尝试 JSON 美化，失败按原文；
   - 详情数据来自列表行，不请求不存在的详情端点；单测覆盖 `formatJsonOrRaw` 与查询构造；E2E 覆盖 A-05。
6. **US5 登录日志（P2）**
   - 列表/筛选/排序、删除/清空/导出、解锁（恰好 1 条才可用，确认后请求）；
   - 单测覆盖勾选/解锁判定；E2E 覆盖 A-06/A-15。
7. **US6 文件管理（P2）**
   - 列表/筛选、上传（文件/图片）、条件缩略图、下载、删除、配置管理入口、预览开关；
   - 预览开关读写参数 `sys.oss.previewListResource`，按钮权限 `system:config:edit`；
   - 上传用 multipart 字段 `file`；下载识别 JSON 错误体；单测覆盖后缀/开关/下载错误；E2E 覆盖 A-07/A-12。
8. **US7 文件配置管理（P2）**
   - 列表/筛选、CRUD、默认切换（确认 + 失败回滚）、内置配置删除保护、`secretKey` 遮蔽；
   - 单测覆盖表单校验/协议前缀/默认切换载荷；E2E 覆盖 A-08/A-16。
9. **收口**
   - 全量 `pnpm test:unit`、`pnpm test:e2e`、`python scripts/evals/run_eval.py --report ...`、`vue-tsc`；
   - `/review` 12 项、`/trace` 回填 `assertion_map`（P0 file:line）与测试证据、`scripts/ci-gate.sh`；
   - 确认目标分支 `003-system-auxiliary` 后再提交，禁止向 `main` 提 PR。

## Dependencies & Ordering

```text
基础层（API 类型/模块、下载 helper、Tiptap 适配、评测夹具）
   ├─ US1 字典（含隐藏页）  ─┐
   ├─ US2 参数              ─┼─ P1 三域可并行（文件不重叠）
   ├─ US3 公告              ─┘
   ├─ US4 操作日志          ─┐
   ├─ US5 登录日志          ─┼─ P2 四域可并行（文件不重叠）
   ├─ US6 文件              ─┤
   └─ US7 文件配置          ─┘
收口：全量测试 → /review → /trace → ci-gate → 分支提交
```

## Risks & Mitigations

| 风险 | 影响 | 处置 |
|---|---|---|
| `ql-size-*` 归一化后 tiptap 不保留字号 | A-11 不通过 | 归一化为内联 `font-size` 并先做单测；E2E 用 `getComputedStyle` 校验。若默认 TextStyle 不保留，改为编辑器可识别的等效标记（标题层级或应用内样式），仍不新增依赖、不改 packages。 |
| 隐藏字典页只有 `dictId`，列表接口要 `dictType` | A-02 加载失败 | 先 `GET /system/dict/type/{dictId}` 取 `dictType`，再按类型加载；无效 id 展示空状态/错误提示。 |
| 导出/下载失败体是 JSON | E-15/E-29 保存损坏文件 | 统一检查 `Content-Type`，JSON 时读取 `msg` 并 `message.error`，不触发下载。 |
| 预览开关权限与 plus-ui 不一致 | A-12 按钮不渲染 | 按签字 §7 使用 `system:config:edit`，不修改后端权限表。 |
| 大整数 ID 精度 | E-30 编辑/删除错对象 | 全链路 `Id`/`toIdKey`/`normalizeIds`，请求参数与回传均字符串。 |
| E2E 验证码限流 | 用例互相挤占 | 复用 `tests/e2e/helpers.ts` 的 5 次/60s 账本；评测集由 `run_eval.py` 统一登录一次。 |
| 性能指标未实测 | 上线后可能超阈值 | 按签字 Packet 作为 30 天回顾指标；交付阶段只做功能与 pageerror 验证。 |

## Definition of Done Alignment

- 10 条 P0 全部有评测用例，`python scripts/evals/run_eval.py --check` 通过；
- 单元/组件/E2E 全部通过，新增行为有 RED→GREEN 证据；
- 8 个页面无“即将推出”，pageerror=0；`platform/` 与 `frontend/packages/**` diff 为空；
- `trace/REQ-20261107-005.yaml` 的 `assertion_map` 覆盖 A-01～A-10 的 file:line，`test_evidence` 引用真实报告；
- `/review` 12 项通过；`scripts/ci-gate.sh` 通过；提交目标为 `003-system-auxiliary` 开发分支。
