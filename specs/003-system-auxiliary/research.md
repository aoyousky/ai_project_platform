# Research: 系统管理辅助模块实现决策

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Delivery basis**: `specs/SPEC-004-system-auxiliary.md` v1.0（已签字）

本文件记录 Phase 0 的技术决策。所有决策均在现有代码与签字 Packet 内可落地，不引入新依赖、
不改 `platform/` 与 `frontend/packages/**`。

## R1. 页面与 API 的组织方式

- **Decision**: 沿用现有 `views/system/*`、`views/monitor/*` 与 `api/system/*`、`api/monitor/*`
  的业务域目录；每个域一个 `types.ts` + `index.ts`，纯逻辑抽到 `*-page-logic.ts`。
- **Rationale**: 现有 `views/system/{user,role,menu,dept,post}` 与 `api/system/*` 已是同一模式；
  `post-page-logic.ts`、`user-page-logic.ts` 证明“页面逻辑纯函数化 + 单测”可复用。
  不新建包，符合 constitution VII 的业务域组织与“复用优先”。
- **Alternatives considered**:
  - 新建 `packages/system-auxiliary`：需要改 workspace 与依赖，违反“不新增依赖/不改 packages”。
  - 全部塞进页面组件：无法对查询构造、载荷映射、归一化做单测，E2E 成本高。

## R2. 动态路由与隐藏页

- **Decision**: 不写静态路由表；新增 8 个视图文件即可。文件路径严格对应后端 `component`：
  `system/dict/index` → `views/system/dict/index.vue`；`system/dict/data` → `views/system/dict/data.vue`；
  `system/config/index` → `views/system/config/index.vue`；`system/notice/index` → `views/system/notice/index.vue`；
  `monitor/operlog/index` → `views/monitor/operlog/index.vue`；`monitor/logininfor/index` →
  `views/monitor/logininfor/index.vue`；`system/oss/index` → `views/system/oss/index.vue`；
  `system/oss/config` → `views/system/oss/config.vue`。
- **Rationale**: `router/access.ts` 用 `import.meta.glob('../views/**/*.vue')` 生成 `pageMap`，
  `markUnportedMenus` 只在文件不存在时替换为 `ComingSoon`（`router/coming-soon.ts`）。
  新增文件后，8 个菜单自然从占位页切到真实页面，无需修改路由配置。
  隐藏菜单的 URL 与组件名不同（`/system/dict-data/index/:dictId` 对应 `system/dict/data`，
  `/system/oss-config/index` 对应 `system/oss/config`），文件路径按组件名而非 URL 命名。
- **Alternatives considered**:
  - 在 `router/routes` 手写路由：会与后端动态菜单重复，且无法覆盖隐藏菜单。
  - 用 URL 作为文件名：`pageMap` 按组件名匹配，会落 `ComingSoon`，A-10 失败。

## R3. API 消费层与响应封装

- **Decision**: 每个域新增 API 模块，统一使用 `#/api/request` 的 `requestClient`；
  分页返回 `PageResult<T> = { rows, total }`；单对象返回 `data`；导出/下载用 `responseReturn: 'raw'`
  与 `responseType: 'blob'`。不新增端点，不自定义错误结构。
- **Rationale**: `api/request.ts` 已把 RuoYi 的 `{code,msg,rows,total}` 解包为 `{rows,total}`，
  成功码为 200，失败展示后端 `msg`；`api/system/common.ts` 的 `downloadBlob` 已识别
  JSON 错误体（HTTP 200 + `{code,msg}`）并抛出 `msg`。复用这些行为可保证错误码/文案一致。
- **Alternatives considered**:
  - 页面内直接调用 axios：违反 constitution VII“禁止组件内裸写 axios”。
  - 新增统一响应类型：会与现有 `PageResult`/`requestClient` 重复，形成第二套契约。

## R4. 列表、筛选、分页与排序

- **Decision**: 所有列表用 `#/adapter/vxe-table` 的 `useVbenVxeGrid`；搜索表单用 `formOptions.schema`；
  `proxyConfig.ajax.query` 内组装查询、调用 API、按 `resolveOutOfRangePage` 处理页码越界。
  日期范围放 `query.params`（文件列表用 `beginCreateTime`/`endCreateTime`，其余用 `beginTime`/`endTime`）。
  排序在需要的列上开 `sortable`，把 vxe 的 `sort/order` 映射为 `orderByColumn/isAsc`，仅在后端支持时发送。
- **Rationale**: `views/system/post/index.vue` 已使用 `useVbenVxeGrid` + `proxyConfig` +
  `resolveOutOfRangePage`（E-27）；`utils/system/query.ts` 的 `addDateRange`/`removeEmptyParams`
  已处理 `params[beginTime]` 与空值。沿用可保持交互、空状态、分页器行为一致。
- **Alternatives considered**:
  - 每页自己写表格与分页：重复代码，无法统一空状态/越界回退。
  - 把日期平铺到查询根对象：后端 `BaseEntity.params` 绑定不到，筛选失效。

## R5. ID 与时间契约

- **Decision**: 所有主键类型用 `Id = string | number`；比较、作为表格 key、拼接删除路径前统一
  `toIdKey`/`normalizeIds`；请求体保留原始 `Id` 或字符串化后的值，不转 `Number`。
  时间字段按后端 `yyyy-MM-dd HH:mm:ss` 字符串直接展示，不做 `dayjs` 时区换算。
- **Rationale**: `utils/system/id.ts` 已定义 `Id`/`toIdKey`/`sameId`/`normalizeIds`；
  SPEC-004 §4.1 明确超出 `2^53-1` 时后端输出字符串。现有岗位/用户页面均按此处理。
- **Alternatives considered**:
  - 统一 `Number(id)`：雪花 ID 精度丢失，E-30 失败。
  - 用 `dayjs` 解析再格式化：会引入时区偏移，违反 FR-006。

## R6. 通知公告富文本与历史 `ql-*` 兼容

- **Decision**: 使用现有 `@vben/plugins/tiptap` 的 `VbenTiptap`，通过应用级表单适配注册为
  `component: 'Tiptap'`（`modelValue` 映射），`previewable=false`；不使用 `VbenTiptapPreview`
  （其内部是 `v-html`）。历史公告加载后先经 `legacy-notice-html.ts` 归一化：
  `ql-align-center/right/justify` → 段落 `style="text-align: ..."`；
  `ql-size-small/large/huge` → 内联 `font-size`（如 `0.75em/1.5em/2.5em`）。
  归一化只改样式表达，不改文本节点；标题用正则拦截 `<`/`>`。
- **Rationale**: `packages/effects/plugins/src/tiptap/tiptap.vue` 用 ProseMirror `EditorContent`
  渲染，`extensions.ts` 已含 `TextAlign` 与 `TextStyle`；`preview.vue` 明确使用 `v-html`，
  与 SPEC-004 §5“只通过 tiptap 解析与回显，不使用未经净化的 v-html”冲突，故关闭预览。
  `ql-*` 是 quill 专用类，ProseMirror 不识别，必须在进入编辑器前转成可识别的内联样式。
- **Alternatives considered**:
  - 直接用 `VbenTiptapPreview`：违反 Packet §5 的 v-html 限制。
  - 引入 DOMPurify 或 quill：新增依赖，违反 FR-044/Non-goals。
  - 保留 `ql-*` 类并加全局 CSS：ProseMirror 解析时会丢弃未声明的 class，编辑后样式丢失。

## R7. OSS 预览开关的权限与读写

- **Decision**: 预览开关的读取用 `GET /system/config/configKey/sys.oss.previewListResource`
  （无权限码），写入用 `PUT /system/config/updateByKey`（`system:config:edit`）；
  按钮 `v-access:code="['system:config:edit']"`。开关变更先 `Modal.confirm`，成功后刷新列表，
  失败用 `runStatusToggle` 回滚并保留原值。
- **Rationale**: SPEC-004 §7 签字确认项 1 已裁定使用 `system:config:edit`；后端实际写接口校验该权限码，
  plus-ui 的 `system:oss:edit` 在基线权限表中不存在。`utils/system/status.ts` 的 `runStatusToggle`
  已实现“先更新 UI、失败回滚”。
- **Alternatives considered**:
  - 使用 `system:oss:edit`：无权限码，按钮永不渲染，A-12 失败。
  - 不确认直接写：违反 FR-005/A-13。

## R8. 上传、下载与导出

- **Decision**:
  - 上传：`antdv-next` `Upload` + `customRequest`，FormData 字段名 `file`；上传成功 `message.success`
    并刷新列表；空文件/失败不新增记录。
  - 下载：新增 GET 二进制 helper（`responseReturn: 'raw'`、`responseType: 'blob'`），
    检查 `Content-Type`；JSON 时读取 `msg` 并抛出，由页面 `message.error` 展示；成功用
    `downloadFileFromBlobPart` 保存。
  - 导出：复用 `downloadBlob`（POST），文件名按模块命名；JSON 错误体同样展示 `msg`，不保存损坏文件。
- **Rationale**: `api/system/common.ts` 已有 `downloadBlob` 与 `isJsonBlob`/`readFailureMessage`；
  上传接口 `POST /resource/oss/upload` 的 multipart 字段为 `file`（SPEC-004 后端事实 11）。
  现有导出页未捕获异常，本特性在页面层 `try/catch` 并展示 `msg`，满足 E-15/E-29 与 FR-007。
- **Alternatives considered**:
  - 用 `window.open` 下载：无法带 `Authorization` 头，且无法识别 JSON 错误体。
  - 用 `Upload` 默认 action：无法注入 token/`clientid`，且字段名不可控。

## R9. `secretKey` 遮蔽与日志

- **Decision**: 文件配置列表不渲染 `accessKey`/`secretKey`；编辑表单 `secretKey` 用
  `InputPassword`（默认遮蔽）；提交体包含真实值但不打印；`console.error` 只允许输出脱敏后的
  接口路径与错误码；trace/报告不记录请求体。
- **Rationale**: SPEC-004 §5 安全约束与 E-31；`adapter/component/index.ts` 已注册 `InputPassword`。
  `api/request.ts` 的 `redactUrl` 已脱敏令牌/密码查询参数，页面层不再额外输出请求体。
- **Alternatives considered**:
  - 列表展示 `secretKey`：违反 Packet 安全约束。
  - 编辑时留空并让用户重填：无法区分“未修改”与“清空”，且 A-08 修改配置会失败。

## R10. 测试与评测集

- **Decision**:
  - 单元测试：每个 `*-page-logic.ts`、`legacy-notice-html.ts`、API 模块、`formatJsonOrRaw`
    都要有 Vitest 用例；mock `requestClient`，断言 URL/方法/参数/载荷；纯函数覆盖正常、空值、边界。
  - 组件/E2E：Playwright 复用 `tests/e2e/helpers.ts`（登录、`gotoAppPath`、`searchGrid`、`confirmDialog`）。
  - 评测集：`specs/evals/REQ-20261107-005/cases.yaml` 覆盖 A-01～A-10 的 HTTP 可观测部分；
    UI 专属断言（A-02 页面、A-10 页面表头、A-13 二次确认）由 E2E 覆盖，评测用例仍保留对应
    `assertion` 以通过 `run.py --check` 的 P0 覆盖检查。
  - 夹具：`scripts/evals/seed_spec004.sh` 先清后插，重复可执行；`run_eval.py` 追加
    `EVAL_SPEC004_*` 默认值与 `limited` 认证类型。
- **Rationale**: `specs/evals/README.md` 要求 P0 全覆盖；`scripts/evals/run_eval.py` 统一登录一次，
  避免 `/auth/code` 10 次/60s 限流；`http_probe.mjs` 支持 `capture`、`verify`、`rows_contains`、
  `content_type_in`、`json_error_allowed` 等字段，足以表达 A-01～A-10 的 HTTP 断言。
- **Alternatives considered**:
  - 每个需求单独写 runner：README 明确禁止，会漂移。
  - 只跑 E2E 不跑评测集：违反 DoD 与门禁 5。

## R11. 权限与路由双控

- **Decision**: 页面入口由后端菜单权限控制；按钮用 `v-access:code` 按 SPEC-004 §4.2 的权限码渲染；
  预览开关用 `system:config:edit`；文件配置入口用 `system:ossConfig:list`；无权限直接访问页面
  由路由守卫落 403/404。列表接口仍由后端鉴权，前端不假设“页面可见=接口可用”。
- **Rationale**: 现有 `views/system/post/index.vue` 使用 `v-access:code`；`router/access.ts` 已配置
  `forbiddenComponent`；A-09/E-20/E-27/E-28 需要“按钮不渲染 + 接口 403”双层。
- **Alternatives considered**:
  - 只靠后端鉴权：A-09 要求 DOM 不出现写按钮，会失败。
  - 只靠前端隐藏：直接调用接口仍可越权，E-27 失败。

## R12. 性能指标处置

- **Decision**: 交付阶段不做压测；按 SPEC-004 §5 将 P95/路由切换/导出响应作为上线后 30 天回顾指标。
- **Rationale**: Packet 已由业务/架构签字明确“不计入 DoD”；本特性纯前端，无新增后端接口，
  压测环境成本高于收益。计划在 Complexity Tracking 中登记该豁免。
- **Alternatives considered**:
  - 交付前压测：需要额外负载环境，且与签字 Packet 的 DoD 冲突。
  - 完全不记录阈值：违反 constitution VIII“阈值写入计划”，故保留阈值并记录回顾方式。
