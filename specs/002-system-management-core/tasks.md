---
description: "Task list for REQ-002 系统管理核心"
---

# Tasks: 系统管理核心（用户 / 角色 / 菜单 / 部门 / 岗位）

**Input**: Design documents from `specs/002-system-management-core/`

**Prerequisites**: [plan.md](./plan.md)（必需）、[spec.md](./spec.md)（用户故事）、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/backend-api-consumed.md](./contracts/backend-api-consumed.md)

**Tests**: MANDATORY。每个用户故事先写测试并确认失败（RED），再写实现（GREEN）。测试范围按宪章 VIII：单元/组件 ≥ 70% 覆盖，契约测试覆盖消费端点，E2E 覆盖关键链路。

**Organization**: 按用户故事分阶段；US1/US2 为 P1，US3/US4 为 P2，US5 为 P3。

> **MVP 与断言说明**：本轮按 MVP 执行，范围为 **Phase 1 + Phase 2 + Phase 3（T001–T027）**，
> 对应 `specs/SPEC-002-system-management-core.md` v1.0。该 Packet 已定义 A-01～A-16（P0 为
> A-01～A-11，P1 为 A-12～A-16）。Phase 4–7（角色/菜单/部门/岗位）**不属于本 Packet**，其
> `[A-xx]` / `[E-xx]` 仍为占位，须由后续 Packet 签字后回填。
> **在 SPEC-002 完成架构/业务签字前，不得开始 RED→GREEN 实现。**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1–US5）
- 每个任务都给出确切文件路径或命令

## Path Conventions

- 前端应用：`frontend/apps/web-antdv-next/src/`
- 前端单测：与被测源码同目录 `*.test.ts`
- E2E：`frontend/tests/e2e/`
- 评测集：`specs/evals/<Spec Packet ID>/cases.yaml`
- 溯源：`trace/<需求编号>.yaml`

---

## Phase 1: Setup

**Purpose**: 确认前置能力与环境，避免在 REQ-001 未完成时开始实现。

- [ ] T001 检查 REQ-001 前置能力：`frontend/apps/web-antdv-next/src/api/core/`（登录/会话/菜单）、`src/router/access.ts`（动态路由）、`src/api/request.ts`（响应适配）可用；运行 `pnpm exec playwright test tests/e2e/login.spec.ts tests/e2e/session.spec.ts` 记录结果。若失败，先修复 REQ-001，不得绕过。
- [ ] T002 [P] 检查 `specs/constraints/allowlist.md` 与 `frontend/package.json`：确认 REQ-002 不新增依赖；确认 `platform/` 无待提交改动（`git diff -- platform/` 为空）。
- [ ] T003 [P] 在 `frontend/vitest.config.ts` 的 coverage.include 中加入 `apps/web-antdv-next/src/api/system/**`、`apps/web-antdv-next/src/utils/system/**`、`apps/web-antdv-next/src/composables/**`、`apps/web-antdv-next/src/directives/**`、`apps/web-antdv-next/src/views/system/**`（只统计可测试逻辑，排除纯模板 `.vue`），阈值仍为 70%。

**Checkpoint**: 前置能力确认完毕；若 REQ-001 的 `v-access` 补丁缺失，由 T011 补齐。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 五域共享的 ID/日期/树/字典/权限基础。**所有用户故事依赖本阶段完成。**

### Tests for Foundational (write first, verify RED)

- [ ] T004 [P] 写 `frontend/apps/web-antdv-next/src/utils/system/id.test.ts`：数字/字符串 ID 归一化、`1` 与 `"1"` 相等、`null/undefined` 处理；先确认失败（RED）。
- [ ] T005 [P] 写 `frontend/apps/web-antdv-next/src/utils/system/query.test.ts`：日期范围写入 `params[beginTime]`/`params[endTime]`、空字符串清理、不修改入参；先确认失败（RED）。
- [ ] T006 [P] 写 `frontend/apps/web-antdv-next/src/utils/system/tree.test.ts`：flat→tree、父节点缺失时提升为根、保持排序、递归过滤 `disabled` 部门、不修改入参；先确认失败（RED）。
- [ ] T007 [P] 写 `frontend/apps/web-antdv-next/src/composables/use-dict.test.ts`：同 `dictType` 单次请求、并发去重、失败不缓存、`clearDictCache()` 后重新请求；先确认失败（RED）。
- [ ] T008 [P] 写 `frontend/apps/web-antdv-next/src/directives/access.test.ts`：`*:*:*` 全通过、精确匹配、无权限移除元素、数组任一匹配；先确认失败（RED）。
- [ ] T009 [P] 写 `frontend/apps/web-antdv-next/src/api/system/common.test.ts`：`getDictDataByTypeApi` 的 URL/返回类型；先确认失败（RED）。

### Implementation for Foundational

- [ ] T010 [P] 实现 `frontend/apps/web-antdv-next/src/utils/system/id.ts`：`toIdKey`、`sameId`、`normalizeIds`。
- [ ] T011 [P] 实现 `frontend/apps/web-antdv-next/src/utils/system/query.ts`：`addDateRange(query, [start, end])`、`removeEmptyParams`。
- [ ] T012 [P] 实现 `frontend/apps/web-antdv-next/src/utils/system/tree.ts`：`buildTree`、`promoteOrphans`、`filterDisabledTree`、`toTreeSelectOptions`。
- [ ] T013 [P] 实现 `frontend/apps/web-antdv-next/src/api/system/common.ts`：`Id`、`PageQuery`、`PageResult`、`DateRangeParams`、`DictData` 类型与 `getDictDataByTypeApi`。
- [ ] T014 [P] 实现 `frontend/apps/web-antdv-next/src/composables/use-dict.ts`：模块级 Promise 缓存、`useDict()`、`dictLabel()`、`clearDictCache()`。
- [ ] T015 实现 `frontend/apps/web-antdv-next/src/directives/access.ts`：覆盖版 `v-access`（`*:*:*` 通配 + 精确匹配），并在 `frontend/apps/web-antdv-next/src/bootstrap.ts` 中于上游 `registerAccessDirective(app)` 之后注册；依赖 T008/T010。
- [ ] T016 [P] 在 `frontend/apps/web-antdv-next/src/api/system/common.ts` 增加 `downloadBlob()`：`responseReturn: 'raw'`、`responseType: 'blob'`、`Content-Type` 为 JSON 时解析 `msg` 并抛错。

**Checkpoint**: 共享基础完成。US1–US5 可以并行开始（若人力允许）。

---

## Phase 3: User Story 1 - 用户全生命周期管理 (Priority: P1) [SPEC-002 A-01～A-16]

**Goal**: 用户列表/部门树筛选、新增、编辑、删除、重置密码、状态开关、导入、导出、分配角色。

**Independent Test**: 在具备 `system:user:*` 的账号下完成“筛选 → 新增 → 编辑 → 分配角色 → 重置密码 → 启停 → 删除 → 导出”链路，每一步刷新后结果一致；用无权限账号验证按钮隐藏与 403。

### Tests for User Story 1 (MANDATORY - write first, verify RED)

- [ ] T017 [P] [US1] 契约测试 `frontend/apps/web-antdv-next/src/api/system/user/index.test.ts`：U-01 ~ U-13 的 URL、method、query/body、`isEncrypt`、blob/multipart 参数、逗号分隔 ID；先确认失败（RED）。
- [ ] T018 [P] [US1] 组件测试 `frontend/apps/web-antdv-next/src/views/system/user/index.test.ts`：部门树筛选、`userId=1` 行内操作隐藏、编辑自己不提交 dept/role/post、状态开关失败回滚、导入统计展示；先确认失败（RED）。
- [ ] T019 [P] [US1] E2E `frontend/tests/e2e/system-user.spec.ts`：新增/编辑/分配角色/重置密码/启停/删除/导出主链路；重复用户名失败提示；无权限账号按钮隐藏；先确认失败（RED）。

### Implementation for User Story 1

- [ ] T020 [P] [US1] 定义类型 `frontend/apps/web-antdv-next/src/api/system/user/types.ts`（`UserVO`、`UserInfoVO`、`UserForm`、`UserQuery`、`ResetPwdForm`、`UserImportParams`）。
- [ ] T021 [US1] 实现 API `frontend/apps/web-antdv-next/src/api/system/user/index.ts`：列表、导出、模板、导入、详情（含无 ID 预处理）、新增、编辑、删除、重置密码、状态、授权角色、部门树；依赖 T020/T013/T016。
- [ ] T022 [US1] 实现用户表单 `frontend/apps/web-antdv-next/src/views/system/user/components/user-form.vue`：新增/编辑 schema、校验、部门/岗位/角色选项、编辑自己禁用三项；依赖 T021/T014/T012。
- [ ] T023 [US1] 实现导入弹窗 `frontend/apps/web-antdv-next/src/views/system/user/components/user-import-modal.vue`：模板下载、文件校验、`updateSupport`、结果统计（纯文本展示，避免 HTML 注入）。
- [ ] T024 [US1] 实现重置密码弹窗 `frontend/apps/web-antdv-next/src/views/system/user/components/reset-password-modal.vue`：5–20 位校验、非法字符校验、确认后调用 U-09。
- [ ] T025 [US1] 实现用户页 `frontend/apps/web-antdv-next/src/views/system/user/index.vue`：`Page` + grid + 左侧部门树 + 查询/重置 + 批量删除 + 状态开关回滚 + 导出；依赖 T021–T024。
- [ ] T026 [US1] 实现分配角色页 `frontend/apps/web-antdv-next/src/views/system/user/authRole.vue`：读取 `route.params.userId`、展示用户信息、按 `roles[].flag` 回显、提交 U-12。
- [ ] T027 [US1] 在 `frontend/apps/web-antdv-next/src/views/system/user/` 下补充空状态/错误状态/加载状态，并确保 `user-*` 组件不直接读取全局 store 传参。

**Checkpoint**: US1 独立可验收；运行 T017–T019，确认 RED→GREEN 证据已留存。

---

## Phase 4: User Story 2 - 角色、数据权限与用户授权 (Priority: P1) [A-xx/E-xx]

**Goal**: 角色 CRUD、菜单权限树、数据权限范围、已授权/未授权用户管理、角色导出。

**Independent Test**: 新建角色 → 勾选菜单 → 设置自定义数据权限 → 添加/移除授权用户 → 用该角色账号验证菜单可见性与数据范围；超管角色操作入口隐藏且后端拒绝。

### Tests for User Story 2 (MANDATORY - write first, verify RED)

- [ ] T028 [P] [US2] 契约测试 `frontend/apps/web-antdv-next/src/api/system/role/index.test.ts`：R-01 ~ R-14 的 URL、method、query/body、批量 `userIds` 逗号格式、`deptIds`/`menuIds` 形状；先确认失败（RED）。
- [ ] T029 [P] [US2] 组件测试 `frontend/apps/web-antdv-next/src/views/system/role/index.test.ts`：`roleId=1` 操作隐藏、菜单树 `checkStrictly` 与角色字段绑定、自定义数据权限才显示部门树、授权用户批量操作；先确认失败（RED）。
- [ ] T030 [P] [US2] E2E `frontend/tests/e2e/system-role.spec.ts`：角色 CRUD、菜单授权后新账号菜单可见、数据权限保存回显、授权用户添加/移除；先确认失败（RED）。

### Implementation for User Story 2

- [ ] T031 [P] [US2] 定义类型 `frontend/apps/web-antdv-next/src/api/system/role/types.ts`（`RoleVO`、`RoleForm`、`RoleQuery`、`AuthUserQuery`、`RoleMenuTree`、`RoleDeptTree`）。
- [ ] T032 [US2] 实现 API `frontend/apps/web-antdv-next/src/api/system/role/index.ts`：角色 CRUD、导出、数据权限、状态、授权用户列表/取消/批量选择；依赖 T031/T013/T016。
- [ ] T033 [US2] 实现角色表单 `frontend/apps/web-antdv-next/src/views/system/role/components/role-form.vue`：基本信息 + 菜单权限树 + `menuCheckStrictly`。
- [ ] T034 [US2] 实现菜单权限树 `frontend/apps/web-antdv-next/src/views/system/role/components/menu-permission-tree.vue`：`checkedKeys` 回显、父子联动、全选/全不选、展开/折叠。
- [ ] T035 [US2] 实现数据权限抽屉 `frontend/apps/web-antdv-next/src/views/system/role/components/data-scope-drawer.vue`：数据范围选项、自定义时显示部门树、`deptCheckStrictly`。
- [ ] T036 [US2] 实现角色页 `frontend/apps/web-antdv-next/src/views/system/role/index.vue`：列表/筛选/导出、状态开关回滚、`roleId=1` 守卫、跳转授权用户页；依赖 T032–T035。
- [ ] T037 [US2] 实现授权用户页 `frontend/apps/web-antdv-next/src/views/system/role/authUser.vue`：读取 `route.params.roleId`、已授权列表、单个取消、批量取消、打开选择用户弹窗。
- [ ] T038 [US2] 实现选择用户弹窗 `frontend/apps/web-antdv-next/src/views/system/role/components/select-user-modal.vue`：未授权列表、筛选、多选、批量 `selectAll`。

**Checkpoint**: US2 独立可验收；US1 与 US2 可并行，但 US1 的分配角色页依赖 US2 的 `RoleVO` 类型（只读依赖，不阻塞）。

---

## Phase 5: User Story 3 - 菜单与权限标识配置 (Priority: P2) [A-xx/E-xx]

**Goal**: 菜单树表、按名称/状态筛选、目录/菜单/按钮新增编辑、级联删除、隐藏菜单激活路由。

**Independent Test**: 新增目录 → 子菜单 → 按钮，树结构正确；编辑权限标识/显示状态后刷新保持；普通删除有子节点菜单被拒绝，级联删除成功；非 superadmin 看不到写操作。

### Tests for User Story 3 (MANDATORY - write first, verify RED)

- [ ] T039 [P] [US3] 契约测试 `frontend/apps/web-antdv-next/src/api/system/menu/index.test.ts`：M-01 ~ M-08 的 URL、method、`cascade` 逗号 ID、`RoleMenuTree` 形状；先确认失败（RED）。
- [ ] T040 [P] [US3] 组件测试 `frontend/apps/web-antdv-next/src/views/system/menu/index.test.ts`：flat→tree 与孤儿提升、按 `menuType` 条件字段、`superadmin` + 权限码双重守卫、级联删除确认文案；先确认失败（RED）。
- [ ] T041 [P] [US3] E2E `frontend/tests/e2e/system-menu.spec.ts`：新增目录/菜单/按钮、编辑、普通删除拒绝、级联删除、筛选后树结构；先确认失败（RED）。

### Implementation for User Story 3

- [ ] T042 [P] [US3] 定义类型 `frontend/apps/web-antdv-next/src/api/system/menu/types.ts`（`MenuVO`、`MenuForm`、`MenuQuery`、`MenuTreeOption`、`RoleMenuTree`）。
- [ ] T043 [US3] 实现 API `frontend/apps/web-antdv-next/src/api/system/menu/index.ts`：列表、详情、树选择、角色菜单树、新增、编辑、删除、级联删除；依赖 T042/T013。
- [ ] T044 [US3] 实现菜单表单 `frontend/apps/web-antdv-next/src/views/system/menu/components/menu-form.vue`：按 `menuType` 切换必填项与可见字段、图标选择、权限标识格式、隐藏菜单激活路由（`remark`）。
- [ ] T045 [US3] 实现菜单页 `frontend/apps/web-antdv-next/src/views/system/menu/index.vue`：树表、筛选/重置、新增/编辑、普通删除与级联删除、`superadmin` 守卫；依赖 T043/T044。

**Checkpoint**: US3 独立可验收；菜单写操作只对 superadmin 展示。

---

## Phase 6: User Story 4 - 组织架构（部门）维护 (Priority: P2) [A-xx/E-xx]

**Goal**: 部门树表、筛选、新增下级、编辑（排除自身及下级）、删除、展开/折叠。

**Independent Test**: 新增一级/下级部门，刷新后层级正确；编辑时上级候选不含自身及下级；删除含下级/用户的部门被拒绝；部门树与用户/角色/岗位选择器一致。

### Tests for User Story 4 (MANDATORY - write first, verify RED)

- [ ] T046 [P] [US4] 契约测试 `frontend/apps/web-antdv-next/src/api/system/dept/index.test.ts`：D-01 ~ D-06 的 URL/method/body、`exclude` 路径；先确认失败（RED）。
- [ ] T047 [P] [US4] 组件测试 `frontend/apps/web-antdv-next/src/views/system/dept/index.test.ts`：flat→tree、筛选孤儿提升、编辑时排除自身及下级、删除失败提示；先确认失败（RED）。
- [ ] T048 [P] [US4] E2E `frontend/tests/e2e/system-dept.spec.ts`：新增一级/下级、编辑、删除叶子成功、删除非叶子失败、筛选与展开/折叠；先确认失败（RED）。

### Implementation for User Story 4

- [ ] T049 [P] [US4] 定义类型 `frontend/apps/web-antdv-next/src/api/system/dept/types.ts`（`DeptVO`、`DeptForm`、`DeptQuery`、`DeptTreeOption`）。
- [ ] T050 [US4] 实现 API `frontend/apps/web-antdv-next/src/api/system/dept/index.ts`：列表、排除子部门、详情、新增、编辑、删除；依赖 T049/T013。
- [ ] T051 [US4] 实现部门表单 `frontend/apps/web-antdv-next/src/views/system/dept/components/dept-form.vue`：上级部门树、负责人、电话/邮箱校验、状态。
- [ ] T052 [US4] 实现部门页 `frontend/apps/web-antdv-next/src/views/system/dept/index.vue`：树表、筛选/重置、新增下级、编辑、删除、展开/折叠；依赖 T050/T051。

**Checkpoint**: US4 独立可验收；部门树结构与 US1/US2/US5 的选择器一致。

---

## Phase 7: User Story 5 - 岗位配置 (Priority: P3) [A-xx/E-xx]

**Goal**: 岗位列表/筛选/导出、新增/编辑/删除、部门树筛选、用户表单岗位选项一致。

**Independent Test**: 新增岗位 → 筛选 → 编辑 → 启停 → 导出 → 删除；被用户引用的岗位删除被拒绝；用户表单岗位选项与岗位页一致。

### Tests for User Story 5 (MANDATORY - write first, verify RED)

- [ ] T053 [P] [US5] 契约测试 `frontend/apps/web-antdv-next/src/api/system/post/index.test.ts`：P-01 ~ P-07 的 URL/method/query/blob、`belongDeptId` 与 `deptId` 互斥；先确认失败（RED）。
- [ ] T054 [P] [US5] 组件测试 `frontend/apps/web-antdv-next/src/views/system/post/index.test.ts`：部门树筛选、必填校验、删除失败提示、状态回滚；先确认失败（RED）。
- [ ] T055 [P] [US5] E2E `frontend/tests/e2e/system-post.spec.ts`：新增/编辑/启停/导出/删除、部门子树筛选、删除被引用岗位失败；先确认失败（RED）。

### Implementation for User Story 5

- [ ] T056 [P] [US5] 定义类型 `frontend/apps/web-antdv-next/src/api/system/post/types.ts`（`PostVO`、`PostForm`、`PostQuery`）。
- [ ] T057 [US5] 实现 API `frontend/apps/web-antdv-next/src/api/system/post/index.ts`：列表、导出、详情、新增、编辑、删除、部门树；依赖 T056/T013/T016。
- [ ] T058 [US5] 实现岗位表单 `frontend/apps/web-antdv-next/src/views/system/post/components/post-form.vue`：所属部门树、编码/名称/类别/顺序/状态。
- [ ] T059 [US5] 实现岗位页 `frontend/apps/web-antdv-next/src/views/system/post/index.vue`：列表/筛选/分页、左侧部门树、新增/编辑/删除、导出；依赖 T057/T058。

**Checkpoint**: US5 独立可验收；五个子域全部完成。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 门禁、评测、溯源、文档与证据。

- [ ] T060 运行 `pnpm -F @vben/web-antdv-next typecheck`、`pnpm lint`、`pnpm -F @vben/web-antdv-next build`，修复 `frontend/apps/web-antdv-next/src/**` 的类型/静态检查/构建问题；结果日志保存到 `frontend/tests/e2e/.artifacts/build.log`。
- [ ] T061 [P] 运行 `pnpm test:unit -- --coverage`，检查 `frontend/apps/web-antdv-next/src/api/system/**`、`src/utils/system/**`、`src/composables/**`、`src/directives/**`、`src/views/system/**` 覆盖率 ≥ 70%；补齐 `frontend/apps/web-antdv-next/src/**/*.test.ts` 与 `frontend/tests/e2e/system-*.spec.ts` 暴露的缺口，保留 RED→GREEN 证据到 `frontend/coverage/`。
- [ ] T062 [P] 在 `/spec-packet` 生成并签字后，创建 `specs/evals/<Spec Packet ID>/cases.yaml`：覆盖全部 P0 A-xx 的 HTTP 可观测对应项；运行 `python specs/evals/run.py --check` 与 `EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py --ci --report specs/evals/reports`。
- [ ] T063 运行完整 E2E `pnpm exec playwright test tests/e2e`，保存 HTML 报告与失败 trace 到 `frontend/tests/e2e/report/`、`frontend/tests/e2e/.artifacts/`。
- [ ] T064 更新 `trace/<需求编号>.yaml`：P0 断言 → file:line、测试证据、模型、时间、`diff_scope`；缺失文件视为未完成。
- [ ] T065 对 `frontend/apps/web-antdv-next/src/{api/system,utils/system,composables,directives,views/system}/**` 与 `trace/<需求编号>.yaml` 运行 `/spec-check` 与 `/review`，修复 12 项 checklist 问题；在 PR/交付记录中引用证据路径。
- [ ] T066 最终边界核对：`git diff -- platform/` 为空；`git diff -- frontend/package.json frontend/pnpm-lock.yaml` 为空；`frontend/apps/web-antdv-next/src/**`、`frontend/tests/e2e/**`、`trace/<需求编号>.yaml` 中无令牌、密码、验证码、明文手机号/邮箱；`specs/002-system-management-core/quickstart.md` 场景全部手工或自动验证通过。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，立即开始。T001 失败则停止，先完成 REQ-001。
- **Foundational (Phase 2)**: 依赖 Setup；**阻塞所有用户故事**。
- **User Stories (Phase 3–7)**: 依赖 Foundational。US1/US2 均为 P1，可并行；US3/US4 P2 可与 P1 并行（文件不重叠）；US5 P3 最后。
- **Polish (Phase 8)**: 依赖所有目标用户故事完成，且 Spec Packet 已签字。

### User Story Dependencies

- **US1 用户**：依赖 Foundational；内部依赖 US2 的 `RoleVO` 类型（只读类型，可用 T031 先行解耦）。
- **US2 角色**：依赖 Foundational；菜单树组件依赖 US3 的 `MenuTreeOption` 类型（只读类型，可用 T042 先行）。
- **US3 菜单**：依赖 Foundational；无页面间依赖。
- **US4 部门**：依赖 Foundational；无页面间依赖。
- **US5 岗位**：依赖 Foundational；用户表单岗位选项来自 US1 的详情预处理接口，页面本身独立。

### Within Each User Story

1. 契约/组件/E2E 测试先写并确认失败（RED）。
2. 类型 → API → 页面私有组件 → 页面。
3. 页面完成后再跑该故事测试，确认 GREEN。
4. 故事完成后再进入下一个优先级。

### Parallel Opportunities

- Setup 的 T002/T003 可并行。
- Foundational 的 T004–T009 测试可并行；T010–T014、T016 实现可并行；T015 依赖 T008/T010。
- 每个故事的契约测试、组件测试、E2E 测试可并行编写。
- US1–US5 的 API/类型/组件文件互不重叠，可在 Foundational 完成后并行开发。
- Polish 的 T061/T062 可并行；T060/T063/T064 需等待实现稳定。

---

## Parallel Example: Foundational

```bash
# 先并行写失败测试
Task: "写 id.test.ts（RED）"
Task: "写 query.test.ts（RED）"
Task: "写 tree.test.ts（RED）"
Task: "写 use-dict.test.ts（RED）"
Task: "写 access.test.ts（RED）"

# 再并行写共享实现
Task: "实现 utils/system/id.ts"
Task: "实现 utils/system/query.ts"
Task: "实现 utils/system/tree.ts"
Task: "实现 composables/use-dict.ts"
Task: "实现 api/system/common.ts"
```

## Parallel Example: User Story 1

```bash
# 测试并行
Task: "写 api/system/user/index.test.ts（RED）"
Task: "写 views/system/user/index.test.ts（RED）"
Task: "写 tests/e2e/system-user.spec.ts（RED）"

# 实现并行（文件不重叠）
Task: "写 api/system/user/types.ts"
Task: "写 views/system/user/components/user-import-modal.vue"
Task: "写 views/system/user/components/reset-password-modal.vue"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 + Phase 2。
2. 完成 **US1 用户全生命周期**。
3. 运行 US1 的单元/组件/E2E 测试并手工验收 VS-1。
4. **STOP and VALIDATE**：不满足 `userId=1` 保护、状态回滚、导入/导出失败路径时不得进入下一故事。

> 生产可用建议：US2（角色/权限）与 US1 同为 P1，应在 MVP 后立即交付，否则用户无法获得角色授权闭环。

### Incremental Delivery

1. Setup + Foundational → 基础可测。
2. US1 → 用户管理可交付。
3. US2 → 角色与授权可交付。
4. US3 → 菜单可维护。
5. US4 → 部门可维护。
6. US5 → 岗位可维护。
7. Polish → 门禁、评测、trace、review 完成。

### Parallel Team Strategy

- 1 人：按 Phase 顺序串行。
- 2 人：A 负责 US1 + US3，B 负责 US2 + US4 + US5；共享文件（T010–T016）由一人先完成。
- 3 人：A 负责 US1、B 负责 US2、C 负责 US3–US5；公共组件（树、字典、下载）由 A 先行。

---

## Notes

- `[P]` 任务必须确认文件不重叠；同一文件的任务不得并行。
- `[A-xx]` / `[E-xx]` 为占位，Spec Packet 签字后回填；未回填前不得开始实现。
- 每个故事的测试必须先失败（RED），并在 trace 中保留失败→通过证据。
- 状态开关、删除、批量操作、级联删除、重置密码、移除授权必须二次确认。
- 所有错误展示后端 `msg` 原文；不新增错误码，不吞异常。
- 后端 `platform/` 只读；任何接口缺口先 STOP，不得自行改后端。
- 每完成一个逻辑组提交一次，提交信息遵循项目 Git 规范。
