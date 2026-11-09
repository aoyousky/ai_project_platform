# Tasks: 系统管理辅助模块（8 视图）

**Input**: Design documents from `specs/003-system-auxiliary/`

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、
[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)；
交付依据为已签字 `specs/SPEC-004-system-auxiliary.md` v1.0。

**Tests**: 测试为强制项。每个用户故事先写测试并确认 RED，再实现并确认 GREEN（RED → GREEN）。
测试范围按 constitution VIII：纯逻辑/API 单测优先，E2E 覆盖 P0 交互，评测集覆盖 A-01～A-10。

**Organization**: 按用户故事分阶段；基础层阻塞全部故事；P1 三域与 P2 四域在基础层完成后可并行。

## Preconditions（开始实现前）

- 目标开发分支：`003-system-auxiliary`。当前分支若为 `main` 或无法确定，停止并询问用户；
  禁止向 `main` 提交 PR 或自动合并。
- `specs/SPEC-004-system-auxiliary.md` 已签字；不得修改 `specs/` 下 Packet 与上游 spec。
- 不修改 `platform/`、`frontend/packages/**`；不新增依赖、不改 `package.json`/`pnpm-workspace.yaml`。
- 不把令牌、验证码、密码、`secretKey` 写入日志、console、报告或 trace。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 用户故事编号（US1～US7），仅用户故事阶段使用
- 每条任务都带精确文件路径

---

## Phase 1: Setup（评测与夹具基础）

**Purpose**: 建立可执行的评测/夹具基础设施，不涉及业务页面。

- [x] T001 [P] 创建 `specs/evals/REQ-20261107-005/README.md`，写明本地栈、`seed_spec004.sh`、`run_eval.py` 命令、`spec004Limited` 认证类型与“令牌不落盘/不打印”约束
- [x] T002 [P] 创建幂等夹具脚本 `scripts/evals/seed_spec004.sh`：先清后插 `spec004_dict_type` 及 2 条字典数据、参数 `spec004.config.key`（`configType='N'`）、公告 `Spec004 公告`（含 `ql-align-center`/`ql-size-large`）、操作日志 `Spec004 操作`（`operName='spec004_operator'`，`operParam`/`jsonResult` 为合法 JSON）、登录日志 `spec004_lock`、受限账号 `spec004_limited` 及其角色/菜单权限；不删除内置配置 `ossConfigId=1/2` 与 `sys.oss.previewListResource`；数据库凭据只从环境/容器读取，不打印
- [x] T003 [P] 在 `scripts/evals/run_eval.py` 的 `build_env()` 增加 `EVAL_SPEC004_*` 固定 ID/名称默认值，并在 `run_probe()` 增加 `spec004Limited` 认证类型与 `EVAL_SPEC004_LIMITED_TOKEN`，与 T002 的夹具 ID 一一对应
- [x] T004 [P] 扩展 `scripts/evals/http_probe.mjs` 支持 multipart `formData.file`，并创建 `specs/evals/REQ-20261107-005/fixtures/spec004_upload.png` 与 `spec004_upload.txt` 夹具用于 A-07 上传；实现后自测一次，确认不把文件路径或令牌打印到报告
- [x] T005 创建 `specs/evals/REQ-20261107-005/cases.yaml`，写入 `spec_version: "1.0"` 与 A-01～A-10 的 P0 用例（A-02/A-09/A-10 覆盖 HTTP 可观测链路：`GET /system/menu/getRouters`、字典类型/数据接口、受限账号 403；A-07 覆盖 multipart 上传+列表+下载），UI 专属断言留给 E2E

**Checkpoint**: `python scripts/evals/run_eval.py --check` 的 P0 覆盖检查可通过；夹具脚本可重复执行。

---

## Phase 2: Foundational（阻塞全部用户故事）

**Purpose**: 共享二进制下载与 Tiptap 表单项适配；完成后各用户故事可独立开工。

- [x] T006 [P] 先写 `frontend/apps/web-antdv-next/src/api/system/common.test.ts`，覆盖 GET 二进制成功、JSON 错误体读取 `msg`、文件名回退；运行 `cd frontend && pnpm vitest run --dom src/api/system/common.test.ts` 确认 RED
- [x] T007 在 `frontend/apps/web-antdv-next/src/api/system/common.ts` 实现 GET 二进制 helper（`responseReturn: 'raw'` + `responseType: 'blob'` + JSON 错误体识别），不改变既有 `downloadBlob`；运行 T006 测试确认 GREEN
- [x] T008 [P] 在 `frontend/apps/web-antdv-next/src/adapter/component/index.ts` 注册 `Tiptap`（`ComponentType`/`ComponentPropsMap`/`components` 使用 `@vben/plugins/tiptap` 的 `VbenTiptap`），并在 `frontend/apps/web-antdv-next/src/adapter/form.ts` 增加 `Tiptap: 'modelValue'` 映射；运行 `cd frontend && pnpm --filter @vben/web-antdv-next typecheck` 确认通过

**Checkpoint**: 基础层完成；US1～US7 可按优先级并行。

---

## Phase 3: User Story 1 - 字典维护（Priority: P1）MVP

**Goal**: 双栏字典管理页 + 隐藏字典数据页；类型/数据 CRUD、导出、刷新缓存；删除受保护类型被拒绝。

**Independent Test**: 打开 `/system/dict`，筛选 `spec004_dict_type`，右侧数据行数 2→3→3→2；删除类型被拒绝且数据保留；直连 `/system/dict-data/index/{dictId}` 可改标签并刷新可见。

### Tests for User Story 1（强制，先写并确认 RED）

- [x] T009 [P] [US1] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/system/dict/index.test.ts`，覆盖类型 8 个端点与数据 6 个端点的 URL/方法/参数/`{rows,total}` 解包；运行 `cd frontend && pnpm vitest run --dom src/api/system/dict/index.test.ts` 确认 RED
- [x] T010 [P] [US1] 写页面逻辑测试 `frontend/apps/web-antdv-next/src/views/system/dict/dict-page-logic.test.ts`，覆盖查询构造、`dictId → dictType`、表单载荷、右侧行数期望、`clearDictCache` 调用；运行确认 RED
- [x] T011 [P] [US1] 写 E2E `frontend/tests/e2e/system-dict.spec.ts`，覆盖 A-01、A-02、A-10 的字典表头/隐藏页/删除保护；运行 `cd frontend && pnpm exec playwright test tests/e2e/system-dict.spec.ts` 确认 RED（当前应为 ComingSoon 或页面不存在）

### Implementation for User Story 1

- [x] T012 [US1] 创建类型 `frontend/apps/web-antdv-next/src/api/system/dict/types.ts`：`DictType`、`DictData`、`DictTypeQuery/Form`、`DictDataQuery/Form`，字段与 `data-model.md` §3/§4 一致
- [x] T013 [US1] 实现 API `frontend/apps/web-antdv-next/src/api/system/dict/index.ts`，复用 `common.ts` 的 `PageResult`、`getDictDataByTypeApi`，删除路径用 `normalizeIds`（依赖 T009/T012）
- [x] T014 [US1] 实现逻辑 `frontend/apps/web-antdv-next/src/views/system/dict/dict-page-logic.ts`：查询组装、`params[beginTime]`、载荷映射、`dictId` 上下文、缓存清理（依赖 T010/T012）
- [x] T015 [US1] 创建表单 `frontend/apps/web-antdv-next/src/views/system/dict/components/dict-type-form.vue`，校验 `dictName` ≤100、`dictType` 匹配 `^[a-z][a-z0-9_]*$`，提交按钮 loading 防重（E-32）（依赖 T012）
- [x] T016 [US1] 创建表单 `frontend/apps/web-antdv-next/src/views/system/dict/components/dict-data-form.vue`，`dictType` 只读、`dictSort` 非负整数、`listClass` 枚举、`isDefault` 不提交、提交按钮 loading 防重（E-32）（依赖 T012）
- [x] T017 [US1] 实现 `frontend/apps/web-antdv-next/src/views/system/dict/index.vue`：左类型/右数据双栏、行点击联动、两套工具栏与行操作、`v-access:code`、删除/刷新缓存二次确认、导出、跳转隐藏页（依赖 T013/T014/T015/T016）
- [x] T018 [US1] 实现 `frontend/apps/web-antdv-next/src/views/system/dict/data.vue`：按 `:dictId` 先查类型再查数据；无效 id 空状态/错误提示；无“即将推出”；修改后刷新保留（依赖 T013/T014/T016）
- [x] T019 [US1] 运行 US1 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/system/dict/index.test.ts src/views/system/dict/dict-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-dict.spec.ts`；把 RED→GREEN 证据路径记入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US1 独立可验收（A-01/A-02 通过，字典双栏与隐藏页均可用）。

---

## Phase 4: User Story 2 - 参数维护（Priority: P1）

**Goal**: 参数列表/筛选/CRUD/导出/刷新缓存；内置参数删除保护。

**Independent Test**: 新增非内置参数→修改→刷新缓存→删除；删除 `sys.oss.previewListResource` 被拒绝且仍在列表。

### Tests for User Story 2

- [x] T020 [P] [US2] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/system/config/index.test.ts`，覆盖 9 个端点与 `configKey` 字符串响应；运行确认 RED
- [x] T021 [P] [US2] 写页面逻辑测试 `frontend/apps/web-antdv-next/src/views/system/config/config-page-logic.test.ts`，覆盖查询/载荷、内置标记保留、重复键名不前端拦截、刷新缓存成功路径；运行确认 RED
- [x] T022 [P] [US2] 写 E2E `frontend/tests/e2e/system-config.spec.ts`，覆盖 A-03、A-10 参数表头、内置删除/刷新缓存；运行确认 RED

### Implementation for User Story 2

- [x] T023 [US2] 创建类型 `frontend/apps/web-antdv-next/src/api/system/config/types.ts`：`Config`、`ConfigQuery/Form`、`ConfigKeyUpdate`
- [x] T024 [US2] 实现 API `frontend/apps/web-antdv-next/src/api/system/config/index.ts`，含 `getConfigKeyApi` 与 `updateConfigByKeyApi`（依赖 T020/T023）
- [x] T025 [US2] 实现逻辑 `frontend/apps/web-antdv-next/src/views/system/config/config-page-logic.ts`（依赖 T021/T023）
- [x] T026 [US2] 创建表单 `frontend/apps/web-antdv-next/src/views/system/config/components/config-form.vue`：`configName/configKey ≤100`、`configValue ≤500`、`configType` 默认 `'Y'`、编辑保留内置标记、提交按钮 loading 防重（E-32）（依赖 T023）
- [x] T027 [US2] 实现 `frontend/apps/web-antdv-next/src/views/system/config/index.vue`：列表/筛选/日期范围/CRUD/导出/刷新缓存/二次确认/权限码（依赖 T024/T025/T026）
- [x] T028 [US2] 运行 US2 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/system/config/index.test.ts src/views/system/config/config-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-config.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US2 独立可验收（A-03 通过）。

---

## Phase 5: User Story 3 - 通知公告（Priority: P1）

**Goal**: 公告列表/筛选/CRUD；tiptap 富文本；历史 `ql-*` 归一化；无 `v-html` 正文渲染。

**Independent Test**: 新增带居中/大字号格式的公告，重新打开内容与格式一致；历史 `ql-*` 公告文本不变、对齐与字号生效；标题含脚本字符被拒绝。

### Tests for User Story 3

- [x] T029 [P] [US3] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/system/notice/index.test.ts`，覆盖 5 个端点；运行确认 RED
- [x] T030 [P] [US3] 写归一化测试 `frontend/apps/web-antdv-next/src/views/system/notice/legacy-notice-html.test.ts`：`ql-align-center/right/justify`、`ql-size-small/large/huge`、文本节点不改写、`<script>` 拦截；运行确认 RED
- [x] T031 [P] [US3] 写页面逻辑测试 `frontend/apps/web-antdv-next/src/views/system/notice/notice-page-logic.test.ts`：仅 title/createByName/type 查询、表单载荷、状态默认；运行确认 RED
- [x] T032 [P] [US3] 写 E2E `frontend/tests/e2e/system-notice.spec.ts`，覆盖 A-04、A-11、A-10 公告表头；断言正文经过 tiptap 渲染且无 `v-html` 注入；运行确认 RED

### Implementation for User Story 3

- [x] T033 [US3] 创建类型 `frontend/apps/web-antdv-next/src/api/system/notice/types.ts`：`Notice`、`NoticeQuery/Form`
- [x] T034 [US3] 实现 API `frontend/apps/web-antdv-next/src/api/system/notice/index.ts`（依赖 T029/T033）
- [x] T035 [US3] 实现 `frontend/apps/web-antdv-next/src/views/system/notice/legacy-notice-html.ts`：`ql-*` → 内联 `text-align`/`font-size`，保留文本节点，标题脚本字符拦截（依赖 T030）
- [x] T036 [US3] 实现逻辑 `frontend/apps/web-antdv-next/src/views/system/notice/notice-page-logic.ts`（依赖 T031/T033）
- [x] T037 [US3] 创建表单 `frontend/apps/web-antdv-next/src/views/system/notice/components/notice-form.vue`：`Tiptap` 组件、`previewable=false`、标题 ≤50 且不含 `<`/`>`、类型/状态 Radio、提交按钮 loading 防重（E-32）（依赖 T008/T033/T035）
- [x] T038 [US3] 实现 `frontend/apps/web-antdv-next/src/views/system/notice/index.vue`：列表/三项筛选/CRUD/二次确认/权限码；详情或编辑回显只走 tiptap（依赖 T034/T036/T037）
- [x] T039 [US3] 运行 US3 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/system/notice/index.test.ts src/views/system/notice/legacy-notice-html.test.ts src/views/system/notice/notice-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-notice.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US3 独立可验收（A-04/A-11 通过，历史格式不丢）。

---

## Phase 6: User Story 4 - 操作日志审计（Priority: P2）

**Goal**: 操作日志筛选/排序/详情/删除/清空/导出；JSON 美化与原文回退。

**Independent Test**: 筛选到 `Spec004 操作`，详情展示可读 JSON，导出非空文件，删除后列表减 1；非法 JSON 按原文展示。

### Tests for User Story 4

- [x] T040 [P] [US4] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/monitor/operlog/index.test.ts`，覆盖 4 个端点；运行确认 RED
- [x] T041 [P] [US4] 写逻辑测试 `frontend/apps/web-antdv-next/src/views/monitor/operlog/operlog-page-logic.test.ts`：`formatJsonOrRaw` 合法/非法/null、`businessTypes` 空数组不发、排序映射；运行确认 RED
- [x] T042 [P] [US4] 写 E2E `frontend/tests/e2e/system-operlog.spec.ts`，覆盖 A-05、A-18 操作日志排序、A-10 日志编号表头；运行确认 RED

### Implementation for User Story 4

- [x] T043 [US4] 创建类型 `frontend/apps/web-antdv-next/src/api/monitor/operlog/types.ts`：`OperLog`、`OperLogQuery`
- [x] T044 [US4] 实现 API `frontend/apps/web-antdv-next/src/api/monitor/operlog/index.ts`（依赖 T040/T043）
- [x] T045 [US4] 实现逻辑 `frontend/apps/web-antdv-next/src/views/monitor/operlog/operlog-page-logic.ts`（依赖 T041/T043）
- [x] T046 [US4] 创建详情弹窗 `frontend/apps/web-antdv-next/src/views/monitor/operlog/components/operlog-detail-modal.vue`：完整字段、`operParam`/`jsonResult` 可读 JSON/原文、无堆栈、无 `tenantId`（依赖 T043/T045）
- [x] T047 [US4] 实现 `frontend/apps/web-antdv-next/src/views/monitor/operlog/index.vue`：列表/筛选/日期、排序、详情、删除/清空二次确认、导出 JSON 错误体处理、权限码（依赖 T044/T045/T046）
- [x] T048 [US4] 运行 US4 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/monitor/operlog/index.test.ts src/views/monitor/operlog/operlog-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-operlog.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US4 独立可验收（A-05/A-18 通过）。

---

## Phase 7: User Story 5 - 登录日志审计（Priority: P2）

**Goal**: 登录日志筛选/排序/删除/清空/导出；恰好 1 条才可解锁。

**Independent Test**: 筛选 `spec004_lock`，单选解锁成功且日志仍在；0/2 条时解锁不可用；删除/清空/导出正常。

### Tests for User Story 5

- [x] T049 [P] [US5] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/monitor/logininfor/index.test.ts`，覆盖 5 个端点；运行确认 RED
- [x] T050 [P] [US5] 写逻辑测试 `frontend/apps/web-antdv-next/src/views/monitor/logininfor/logininfor-page-logic.test.ts`：解锁可用性（0/1/2 条）、用户名提取、排序映射、查询组装；运行确认 RED
- [x] T051 [P] [US5] 写 E2E `frontend/tests/e2e/system-logininfor.spec.ts`，覆盖 A-06、A-15、A-18 登录日志排序、A-10 访问编号表头；运行确认 RED

### Implementation for User Story 5

- [x] T052 [US5] 创建类型 `frontend/apps/web-antdv-next/src/api/monitor/logininfor/types.ts`：`Logininfor`、`LogininforQuery`
- [x] T053 [US5] 实现 API `frontend/apps/web-antdv-next/src/api/monitor/logininfor/index.ts`，含 `unlockLogininforApi`（依赖 T049/T052）
- [x] T054 [US5] 实现逻辑 `frontend/apps/web-antdv-next/src/views/monitor/logininfor/logininfor-page-logic.ts`（依赖 T050/T052）
- [x] T055 [US5] 实现 `frontend/apps/web-antdv-next/src/views/monitor/logininfor/index.vue`：列表/筛选/日期、排序、批量删除/清空、解锁单选约束与确认、导出、权限码（依赖 T053/T054）
- [x] T056 [US5] 运行 US5 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/monitor/logininfor/index.test.ts src/views/monitor/logininfor/logininfor-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-logininfor.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US5 独立可验收（A-06/A-15/A-18 通过）。

---

## Phase 8: User Story 6 - 文件管理（Priority: P2）

**Goal**: 文件列表/筛选/上传/下载/删除；预览开关与条件缩略图；错误体不保存损坏文件。

**Independent Test**: 上传 PNG 与文本各 1 个，列表出现两条；预览开关开→图片缩略图，关→URL 文本；下载 PNG 成功；删除两条后消失。

### Tests for User Story 6

- [x] T057 [P] [US6] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/system/oss/index.test.ts`：5 个端点、上传 `FormData` 字段 `file`、GET 下载与 JSON 错误体；运行确认 RED
- [x] T058 [P] [US6] 写逻辑测试 `frontend/apps/web-antdv-next/src/views/system/oss/oss-page-logic.test.ts`：预览后缀白名单、开关值判断、下载文件名回退、上传响应映射；运行确认 RED
- [x] T059 [P] [US6] 写 E2E `frontend/tests/e2e/system-oss.spec.ts`，覆盖 A-07、A-12、E-19/E-20 上传空文件/无权限、A-10 文件名表头、配置管理入口跳转；运行确认 RED

### Implementation for User Story 6

- [x] T060 [US6] 创建类型 `frontend/apps/web-antdv-next/src/api/system/oss/types.ts`：`Oss`、`OssUpload`、`OssQuery`
- [x] T061 [US6] 实现 API `frontend/apps/web-antdv-next/src/api/system/oss/index.ts`，含 `uploadOssApi`/`downloadOssApi`，复用 T007 的 GET 二进制 helper（依赖 T057/T060）
- [x] T062 [US6] 实现逻辑 `frontend/apps/web-antdv-next/src/views/system/oss/oss-page-logic.ts`（依赖 T058/T060）
- [x] T063 [US6] 实现 `frontend/apps/web-antdv-next/src/views/system/oss/index.vue`：列表/五项筛选+创建时间、上传文件/图片、预览开关确认与回滚、条件 `<img>`、下载、批量删除二次确认、按 `system:ossConfig:list` 渲染“配置管理”入口并跳转 `/system/oss-config/index`、权限码（依赖 T061/T062）
- [x] T064 [US6] 运行 US6 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/system/oss/index.test.ts src/views/system/oss/oss-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-oss.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US6 独立可验收（A-07/A-12 通过）。

---

## Phase 9: User Story 7 - 文件配置管理（Priority: P2）

**Goal**: 隐藏文件配置页；筛选/CRUD/默认切换/内置删除保护；`secretKey` 遮蔽且不展示。

**Independent Test**: 直连 `/system/oss-config/index`，新增配置→设默认（仅一条 `status='0'`）→删内置被拒绝→删新增成功；列表与详情无 `secretKey` 明文。

### Tests for User Story 7

- [x] T065 [P] [US7] 写 API 契约测试 `frontend/apps/web-antdv-next/src/api/system/oss/config.test.ts`，覆盖 6 个端点与 `changeStatus` 载荷；运行确认 RED
- [x] T066 [P] [US7] 写逻辑测试 `frontend/apps/web-antdv-next/src/views/system/oss/oss-config-page-logic.test.ts`：默认切换载荷/失败回滚、状态展示、协议前缀、`secretKey` 掩码、表单校验；运行确认 RED
- [x] T067 [P] [US7] 写 E2E `frontend/tests/e2e/system-oss-config.spec.ts`，覆盖 A-08、A-16、A-10 配置key/访问站点/桶名称/是否默认表头；运行确认 RED

### Implementation for User Story 7

- [x] T068 [US7] 创建类型 `frontend/apps/web-antdv-next/src/api/system/oss/config-types.ts`：`OssConfig`、`OssConfigForm`、`OssConfigQuery`，字段按 `data-model.md` §10（与 US6 的 `types.ts` 分开，避免并行冲突）
- [x] T069 [US7] 实现 API `frontend/apps/web-antdv-next/src/api/system/oss/config.ts`（依赖 T065/T068）
- [x] T070 [US7] 实现逻辑 `frontend/apps/web-antdv-next/src/views/system/oss/oss-config-page-logic.ts`（依赖 T066/T068）
- [x] T071 [US7] 创建表单 `frontend/apps/web-antdv-next/src/views/system/oss/components/oss-config-form.vue`：必填/长度 2–100、`secretKey` 用 `InputPassword`、`accessPolicy`/`isHttps` Radio、`status` 新增默认 `'1'`、提交按钮 loading 防重（E-32）（依赖 T068）
- [x] T072 [US7] 实现 `frontend/apps/web-antdv-next/src/views/system/oss/config.vue`：隐藏页列表/筛选/CRUD/删除与设为默认二次确认/切换失败回滚/内置删除原文展示/权限码/不含敏感列（依赖 T069/T070/T071）
- [x] T073 [US7] 运行 US7 单测与 E2E 确认 GREEN：`cd frontend && pnpm vitest run --dom src/api/system/oss/config.test.ts src/views/system/oss/oss-config-page-logic.test.ts` 与 `pnpm exec playwright test tests/e2e/system-oss-config.spec.ts`；把证据写入 `trace/REQ-20261107-005.yaml`

**Checkpoint**: US7 独立可验收（A-08/A-16 通过）。

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 跨页权限/路由/错误态、全量测试、评测、门禁与溯源。

- [x] T074 [P] 写跨页 E2E `frontend/tests/e2e/spec004-assertions.spec.ts`，覆盖 A-09 受限账号无新增/删除/导出与写接口 403、A-10 八地址无占位页/表头、A-13 二次确认、A-14 列表失败提示、E-32 连续点击只发 1 个请求；运行确认 GREEN
- [x] T075 [P] 扩展 `frontend/apps/web-antdv-next/src/utils/system/id.test.ts`，增加超过 `2^53-1` 的字符串 ID 经 `toIdKey`/`normalizeIds` 原样往返的用例，并运行 `cd frontend && pnpm vitest run --dom src/utils/system/id.test.ts` 确认通过
- [x] T076 运行全量单元与类型检查：`cd frontend && pnpm test:unit`（76 文件/606 用例通过）、`pnpm --filter @vben/web-antdv-next typecheck`（exit 0）；新增 ESLint 清零
- [x] T077 运行全量 E2E：`cd frontend && pnpm test:e2e:full`；确认 `pageerror` 为 0、无 403/404、无占位页（2026-11-09 实测 43/43 通过，16.1m，含菜单级联删除用例）
- [x] T078 运行评测集：`python scripts/evals/run_eval.py --check`（全部需求 P0 全覆盖）与 `python scripts/evals/run_eval.py --req REQ-20261107-005 --report specs/evals/reports`（10/10 通过，报告 REQ-20261107-005-20261109-082017.json）
- [ ] T079 执行 A-17 静态检查：`git diff --stat main...HEAD -- platform/ frontend/packages/` 与 `git diff --stat main...HEAD -- 'frontend/**/package.json' 'frontend/pnpm-workspace.yaml'`，两条输出必须为空。**实测非空（824 文件 / 39 清单）**：main(3007010) 早于未合入的 REQ-001 Vben 脚手架；相对开发分支基线 `001-vben-frontend-replacement...HEAD` 两命令均为 0。待用户决定：合入 REQ-001 或升版 A-17 基线口径
- [x] T080 执行 `/review` 12 项，逐项给出通过/不通过/无法判定证据（file:line）；修复不通过项后复跑受影响测试（结论见 2026-11-09 汇报：11 项通过、1 项“无法判定”为性能未实测；E-15 修复后复跑 3/3 GREEN）
- [x] T081 执行 `/trace` 更新 `trace/REQ-20261107-005.yaml`：`plan_hash`、`tasks_hash`、`diff_scope`、`assertion_map`（A-01～A-10 file:line）、`test_evidence`、`reviewer/review_verdict`；重新计算签字后 `spec_hash`（机器可更新项已回填；`reviewer`/`review_verdict` 保持 pending，待人工评审）
- [ ] T082 运行 `bash scripts/ci-gate.sh`，确认五道门禁 PASS；性能压测按签字 Packet §5 作为上线回顾项，不伪造实测数据。**实测：门禁 1/2/4/5 PASS（门禁 5 全需求 8/8、16/16、13/13、10/10），门禁 3 FAIL——外部 `specs/SPEC-005-home-workbench.md`（REQ-20261108-006）缺 `trace/REQ-20261108-006.yaml`；未伪造、未绕过，整体 exit 1**
- [ ] T083 按 `specs/003-system-auxiliary/quickstart.md` 逐条验证命令与人工验收路径；确认报告/日志/trace 无令牌、验证码、密码、`secretKey`。**发现：quickstart §6 的 5 个 E2E 文件名已过时（实际为 system-dict/system-config/system-notice/system-operlog/system-logininfor/system-oss/system-oss-config/spec004-assertions.spec.ts），因 specs 只读未改；当前需求报告与 trace 无明文敏感值，但本地后端容器日志（平台 `PlusWebInvokeTimeInterceptor` 既有行为）会记录请求参数/SQL 参数，含测试夹具口令与 accessKey/secretKey 明文，建议另立平台需求脱敏**
- [ ] T084 勾选本文件全部完成项，汇总 RED→GREEN、评测报告、门禁结果与剩余风险；**未经用户确认不得提交，不得向 `main` 提 PR/合并**（T079/T082/T083 未关闭，不勾选）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 无依赖，立即开始；T005 依赖 T002/T003/T004。
- **Phase 2 Foundational**: 依赖 T001–T005；T006→T007 串行，T008 可与 T006/T007 并行；阻塞全部用户故事。
- **Phase 3–9 User Stories**: 依赖 Phase 2；US1/US2/US3（P1）可并行；US4/US5/US6/US7（P2）可并行。
- **Phase 10 Polish**: 依赖全部目标用户故事完成。

### User Story Dependencies

- **US1 字典（P1）**: 基础层后独立；无其他故事依赖。
- **US2 参数（P1）**: 基础层后独立；与 US1 无共享文件。
- **US3 公告（P1）**: 依赖 T008 的 Tiptap 适配；其余独立。
- **US4 操作日志（P2）**: 基础层后独立。
- **US5 登录日志（P2）**: 基础层后独立。
- **US6 文件（P2）**: 依赖 T007 的 GET 二进制 helper；其余独立。
- **US7 文件配置（P2）**: 基础层后独立；与 US6 共享 `views/system/oss/` 目录但文件不同（`config.vue`/`oss-config-page-logic.ts` vs `index.vue`/`oss-page-logic.ts`）。

### Within Each User Story

- 测试任务（T009–T011 等）先写并运行确认 RED；
- 类型 → API → 逻辑 → 表单/子组件 → 页面；
- 页面完成后运行本故事单测与 E2E 确认 GREEN；
- 故事完成后再进入下一优先级；并行时不同故事的页面文件不得重叠。

### Parallel Opportunities

- Phase 1: T001/T002/T003/T004 可并行（不同文件）；T005 汇总 cases。
- Phase 2: T006/T008 可并行；T007 依赖 T006。
- 每个故事内部：API 测试、逻辑测试、E2E 测试可并行（不同文件）；类型文件可尽早写。
- US1–US7 完成后，Polish 的 T074 可先跑，T075/T076/T077 依赖全部实现。

---

## Parallel Example: User Story 1

```bash
# 先并行写三类测试并确认 RED：
cd frontend
pnpm vitest run --dom src/api/system/dict/index.test.ts
pnpm vitest run --dom src/views/system/dict/dict-page-logic.test.ts
pnpm exec playwright test tests/e2e/system-dict.spec.ts
```

```text
T009 [P] [US1] API 契约测试
T010 [P] [US1] 页面逻辑测试
T011 [P] [US1] E2E 测试
```

## Parallel Example: P1 三域（基础层完成后）

```text
Developer A: US1 字典（T009–T019）
Developer B: US2 参数（T020–T028）
Developer C: US3 公告（T029–T039；先确认 T008 完成）
```

## Parallel Example: P2 四域（基础层完成后）

```text
Developer A: US4 操作日志（T040–T048）
Developer B: US5 登录日志（T049–T056）
Developer C: US6 文件（T057–T064）
Developer D: US7 文件配置（T065–T073）
```

---

## Implementation Strategy

### MVP First（US1）

1. Phase 1 + Phase 2 完成基础层。
2. Phase 3 完成字典双栏与隐藏页。
3. 运行 T019 独立验收 A-01/A-02，再进入下一故事。

### Incremental Delivery

1. 基础层 → 评测 P0 覆盖可检查。
2. US1 → 字典可用（MVP）。
3. US2/US3 → 参数/公告可用。
4. US4/US5/US6/US7 → 日志/文件/配置可用。
5. Polish → 全量测试、评测、`/review`、`/trace`、`ci-gate`。

### 完成定义（本文件收口）

- 所有 `- [ ]` 任务完成并勾选；
- P0 A-01～A-10 均有评测用例且通过；
- 单元/组件/E2E/契约测试通过，RED→GREEN 证据在 trace；
- `git diff` 不含 `platform/`、`frontend/packages/**`、依赖清单变更；
- `/review` 12 项全部通过；`/trace` 已回填；`ci-gate.sh` PASS；
- 未经用户确认不提交、不向 `main` 提 PR。

---

## Notes

- [P] 任务必须确认不同文件、无未完成依赖；共享文件（`cases.yaml`、`common.ts`、`adapter/*`）不得并行修改。
- 每个用户故事必须独立可验收；不得把 US1 的页面选择状态用于 US2/US3。
- 评测集只记录状态码/`code`/`msg` 摘要/耗时；报告不得含令牌、验证码、密码、`secretKey`。
- 性能 P95/路由/导出阈值按 SPEC-004 §5 仅作上线 30 天回顾，不伪造压测结果。
- 遇到 Spec 未定义边界或契约矛盾，立即按 `CLAUDE.md` 铁律 2 输出 `⚠️ STOP: CLAR`，不得基于默认假设继续实现。
