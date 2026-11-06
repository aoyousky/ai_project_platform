# Research: REQ-002 系统管理核心

**Date**: 2026-11-03 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

> 本文件记录 `/speckit-plan` Phase 0 的实现决策。所有结论以仓库现有代码与 `platform/` 源文件为准；
> 不引入 Spec 未定义的行为。

## R1. 页面组合方式

**Decision**: 每个列表页统一使用 Vben `Page` + `useVbenVxeGrid`；新增/编辑使用 `useVbenModal`
（复杂表单用 `useVbenDrawer`）；表格列用 `columns` 声明，操作列用 vxe 自定义 slot；状态列用
antdv-next `Switch`/`Tag` slot，不新增 vxe 全局 renderer。

**Rationale**:
- `src/adapter/vxe-table.ts` 已配置 `proxyConfig.response.result = 'items'`、`total = 'total'`，
  并统一 `showOverflow`、`size: 'small'`，与后端分页返回 `{rows,total}` 的映射只需在查询函数内转换一次。
- `src/adapter/form.ts` 已暴露 `useVbenForm` 与 `z`，组件适配器名称覆盖 `Input`、`InputNumber`、
  `Select`、`TreeSelect`、`RadioGroup`、`Switch`、`Textarea`、`DatePicker`、`RangePicker`。
- `@vben/common-ui` 重导出 `@vben-core/popup-ui` 的 `useVbenModal`、`useVbenDrawer`、`confirm`，
  二次确认不需要额外依赖。

**Alternatives considered**:
- 直接用 antdv-next `Table` + 手写分页：失去 Vben 统一 loading/empty/proxy 行为，且与 REQ-001 适配层脱节。
- 直接使用 vxe-table 原生 API：绕过 `useVbenVxeGrid` 的响应映射，重复实现分页与表单联动。

## R2. API 模块布局

**Decision**: 每个子域一个目录 `src/api/system/<domain>/{index.ts,types.ts}`；跨域只读能力放
`src/api/system/common.ts`（字典）；请求/响应类型与 API 函数同域导出。

**Rationale**:
- 与 `src/api/core/{auth,menu,user}.ts` 的既有风格一致，也与旧 plus-ui 的 `api/system/*` 一一对应，
  降低迁移对照成本。
- 类型与函数同目录避免 `types.ts` 成为无归属的“大杂烩”；跨域字典单独成文件，REQ-003 实现字典管理时
  可直接扩展而不改动五个子域。

**Alternatives considered**:
- 单一 `src/api/system.ts`：文件过大，且五个子域的权限码/端点边界不清晰。
- 把类型放进 `src/types/`：与 Vben 按域组织源码的约定冲突，且不利于 trace 定位。

## R3. 契约源：后端 VO/BO，而不是旧 plus-ui 类型

**Decision**: TypeScript 类型以后端 `Sys*Vo` / `Sys*Bo` / `RouterVo` / `Tree<Long>` 的实际字段为准；
旧 plus-ui `types.ts` 只作为页面字段顺序和交互参考，不复制其中后端已不存在的字段。

**Rationale**:
- 旧类型包含 `delFlag`、`admin`、`parentName` 等后端 VO 不返回的字段；照抄会让页面读到 `undefined`。
- `SysUserVo`、`SysRoleVo`、`SysMenuVo`、`SysDeptVo`、`SysPostVo`、`SysUserInfoVo` 字段已在
  `data-model.md` 固化；`Sys*Bo` 校验规则同步写入表单规则。
- 后端 `/v3/api-docs` 实测返回 `{code:500,...}`，无法生成 OpenAPI 类型；本决策是计划中的 E1 例外。

**Alternatives considered**:
- 从 OpenAPI 生成：当前不可用；需要后端修复或离线快照，违反 `platform/` 零改动。
- 沿用 plus-ui 类型：字段漂移，且会把已删除逻辑（如 `delFlag` 展示）带回来。

## R4. 菜单/部门树：客户端构树，孤儿提升为根

**Decision**: `/system/menu/list` 与 `/system/dept/list` 返回 flat list，前端用
`buildTree(nodes, { idKey, parentKey })` 构树；父节点不在当前结果集中的节点提升为根。菜单页使用
vxe 树表（`treeConfig.childrenField: 'children'`，关闭分页）；部门页同样构树后整树渲染。

**Rationale**:
- 后端 `selectMenuList` / `selectDeptList` 返回 `List<*Vo>` 平铺列表（`SysMenuServiceImpl:71-87`、
  `SysDeptServiceImpl:74-77`）；只有 `/treeselect`、`/deptTree` 端点返回 Hutool 树。
- 旧 plus-ui 菜单页正是“父 ID 不在当前集合中即作为顶层”（`0534d3d^:views/system/menu/index.vue`
  的 `getList`），部门页用 `handleTree`，行为需对齐。
- 树表关闭分页，避免 vxe 对树节点做二次分页导致子节点丢失。

**Alternatives considered**:
- 改用 `/system/menu/treeselect` 作为列表数据：该端点不返回 `component`、`perms`、`createTime` 等列，
  且按条件过滤时使用单根构建，可能只返回一个子树。
- 后端新增树列表接口：违反 `platform/` 零改动。

## R5. 树选择节点形状

**Decision**: 树选择直接消费 Hutool 树节点：`{ id, parentId, label, weight, children }`。菜单节点额外
`{ menuType, icon, visible, status }`；部门节点额外 `{ disabled }`。前端 `TreeSelect` 映射
`value: 'id'`、`label: 'label'`、`children: 'children'`。

**Rationale**:
- `TreeBuildUtils.DEFAULT_CONFIG` 把共享 `TreeNodeConfig.DEFAULT_CONFIG` 的 `nameKey` 改为
  `"label"`；`Tree` 继承 `LinkedHashMap`，`putExtra` 直接写入顶层键，故 JSON 字段是 `label` 而非 `name`。
- `buildMenuTreeSelect` 写入 `menuType/icon/visible/status`（`SysMenuServiceImpl:238-252`）；
  `buildDeptTreeSelect` 写入 `disabled`（`SysDeptServiceImpl:124-137`）。
- 旧 plus-ui `MenuTreeOption` / `DeptTreeVO` 同样使用 `label`、`parentId`、`weight`，已互相验证。

**Alternatives considered**:
- 前端把 `label` 改写成 `name`：多一层无收益转换，且会与 `TreeSelect` 适配器默认字段不一致。
- 使用 `fieldNames` 重映射：可以，但增加每个调用点配置；统一类型更简单。

## R6. 权限：路由由后端下发，按钮用 `v-access` + 通配符补丁

**Decision**: 页面可达性继续由 REQ-001 的动态菜单控制；按钮使用 `v-access:code="'system:user:add'"`。
在应用层注册一个覆盖版 `access` 指令，匹配规则为：用户权限码包含 `*:*:*` 时全部通过，否则精确匹配。
菜单写操作（新增/修改/删除/级联删除）额外要求 `userStore.userInfo.roles` 包含 `superadmin`，因为后端
`SysMenuController` 对写接口同时要求 `@SaCheckRole("superadmin")` 与权限码。

**Rationale**:
- Vben 上游 `hasAccessByCodes` 只做 Set 精确匹配（`packages/effects/access/src/use-access.ts`），
  后端超管权限码为 `*:*:*`，不补丁会导致超管看不到任何按钮（ADR-002 C6）。
- `src/bootstrap.ts` 已调用上游 `registerAccessDirective(app)`；应用层在同名指令上再次注册即可覆盖，
  不需要修改 `packages/**`。
- 菜单写接口的 `@SaCheckRole` 在 `SysMenuController:130-176`，只靠按钮权限码无法避免 403。

**Alternatives considered**:
- 在 `hasAccessByCodes` 内改上游包：属于框架层改动，升级 Vben 时冲突。
- 页面内写 `hasPermi()` 组合函数：可以，但无法覆盖 Vben 内部使用 `v-access` 的组件；指令补丁是统一入口。

## R7. 字典：只读消费 + 会话级缓存

**Decision**: 新增 `getDictDataByTypeApi(dictType)` 调用 `GET /system/dict/data/type/{dictType}`
（无权限码）；`useDict('sys_normal_disable', ...)` 返回各字典的 `Ref<DictData[]>`。模块级 `Map` 缓存
已完成的 Promise，同一会话同一 `dictType` 只发一次请求；并发调用复用同一 Promise。导出
`clearDictCache()` 供后续字典管理（REQ-003）在变更后失效缓存。

**Rationale**:
- 该端点无 `@SaCheckPermission`（`SysDictDataController:76-78`），普通账号也能拿到状态/性别/是否枚举。
- 五个子域重复使用 `sys_normal_disable`、`sys_user_sex`、`sys_show_hide`；逐页请求会造成同一字典
  多次网络往返。`isFrame` / `isCache` 在 plus-ui 中是固定单选项，不读取字典。
- 字典是只读参考数据，不需要 Pinia 跨页共享状态；模块级缓存更轻，且不会把字典写进持久化 store。

**Alternatives considered**:
- 每个页面自行请求：实现简单但请求数翻倍，且刷新/切换页面时重复。
- 放进 Pinia：违反“Pinia 只存跨页面共享状态”的边界，且增加 store 生命周期复杂度。

## R8. 导出与导入

**Decision**:
- 导出：`requestClient.post(url, null, { params, responseType: 'blob', responseReturn: 'raw' })`，
  返回完整 `AxiosResponse`；用 `downloadFileFromBlobPart` 保存。若响应 `Content-Type` 是 JSON，
  解析 `msg` 并报错，不保存文件。
- 导入模板：`POST /system/user/importTemplate`，同样 raw blob。
- 导入数据：`FormData` 携带 `file`，把 `updateSupport` 作为 query 参数；请求头不要手动设置
  `Content-Type`，交给浏览器生成 boundary。成功后用弹窗展示后端 `msg` 的成功/失败统计，刷新列表。

**Rationale**:
- `defaultResponseInterceptor` 在 `responseReturn === 'raw'` 时直接返回响应，不拆 `{code,msg,data}`
  （`packages/effects/request/src/request-client/preset-interceptors.ts`）。
- 后端导出为 `void export(SysUserBo user, HttpServletResponse response)`，参数从 query 绑定，不是
  `@RequestBody`；POST body 传参不会生效。
- 后端导入方法为 `importData(@RequestPart("file") MultipartFile file, boolean updateSupport)`，
  `updateSupport` 是 query/form 参数。
- 导出失败时后端可能返回 JSON 错误体，直接按 blob 保存会得到损坏文件；必须检查 Content-Type。

**Alternatives considered**:
- 用 `window.open` 直接下载：无法携带 `Authorization`/`clientid` 头，后端会 401。
- 在 `requestClient` 上加全局 blob 分支：会影响所有请求，语义不清。

## R9. 错误处理与状态回滚

**Decision**:
- 请求失败不吞异常：`src/api/request.ts` 的全局拦截器已展示后端 `msg` 并 `reject`，页面不重复弹错。
- 列表查询失败：记录 `error` 状态并渲染错误提示，同时把异常继续抛给 grid 的 proxy（不静默返回空数组）。
- 状态开关：先保存旧值，确认后调用接口；取消或失败时恢复旧值并刷新当前页（避免“界面成功、数据未变”）。
- 表单提交失败：保留用户输入，展示后端 `msg`，不关闭弹窗。

**Rationale**: FR-002、FR-006、E-US1-6 要求失败可理解且状态一致；REQ-001 的 `request.ts` 已定义
“展示后端 msg 原文”的唯一入口（FR-012）。吞异常会违反 CLAUDE.md 禁止事项。

**Alternatives considered**:
- 页面级 `try/catch` 后返回 `[]`：grid 显示空数据，用户无法区分“无数据”和“请求失败”。
- 状态开关乐观更新后失败静默：会出现界面与后端不一致。

## R10. 测试策略

**Decision**:
1. **Vitest 单元测试**（与源码同目录）：
   - `utils/system/tree.test.ts`：flat→tree、孤儿提升根、禁用部门过滤、ID 归一化。
   - `utils/system/{id,query}.test.ts`：数字/字符串 ID 比较、`params[beginTime]` 映射。
   - `api/system/*/index.test.ts`：mock `requestClient`，断言 URL、method、query/body 形状、权限头、
     blob 配置、导入 FormData。
   - `components/*.test.ts` / `views/**/*.test.ts`：表单 schema、权限按钮显隐、状态开关回滚、导入结果展示。
2. **Playwright E2E**（`tests/e2e/system-*.spec.ts`）：每个子域一条主链路 + 权限/失败路径；依赖
   `deploy/docker compose` 后端栈，未启动时 skip。
3. **评测集**：`specs/evals/` 执行器仅支持 HTTP。P0 断言在 Spec Packet 中必须同时具备 HTTP 可观测
   对应项（如权限拒绝、响应形状、关联持久化），由 `cases.yaml` 覆盖；纯 UI 断言列为 P1，证据由
   Playwright 报告提供并写入 trace。

**Rationale**:
- 宪章 VIII 要求测试金字塔、覆盖率 ≥ 70%、缺陷先写失败测试。
- 评测执行器的硬规则要求每个 P0 A-xx 有 case（`specs/evals/README.md`），但执行器不执行浏览器脚本；
  这是流程约束，必须在 Spec Packet 断言设计阶段解决，而不是实现阶段绕过。

**Alternatives considered**:
- 只写 E2E：慢、脆弱，失败定位差，无法覆盖树/ID/查询映射等纯逻辑。
- 不写 evals：DoD 不允许；且 P0 覆盖检查会失败。

## R11. hidden 授权页与路由参数

**Decision**: 两个授权页按后端菜单路径直接导航：
`/system/user-auth/role/:userId` 与 `/system/role-auth/user/:roleId`。页面从 `useRoute().params`
读取 ID 并归一化为字符串；不依赖路由名，不在前端硬编码菜单 ID。若用户直接访问无权限页面，由路由
守卫/后端菜单决定 403/404。

**Rationale**:
- 后端菜单 SQL 固定了这两个路径（`platform/script/sql/ry_vue_5.X.sql:286-287`），组件分别为
  `system/user/authRole` 与 `system/role/authUser`；Vben `pageMap` 按组件路径解析，`hideInMenu`
  不影响可达性。
- 路由名由 `menu.getRouteName() + menuId` 生成，菜单改名会改变路由名，不适合作为跳转契约。

**Alternatives considered**:
- `router.push({ name: 'UserAuth131', params: { userId } })`：依赖初始化数据 ID，换库即失效。
- 用 query 参数 `/system/user/authRole?userId=`：后端菜单路径是 path 参数，改动会与动态菜单不一致。

## R12. ID、日期与枚举

**Decision**:
- `Id = number | string`。所有 ID 进入表单/树/比较前用 `toIdKey(id) = String(id)` 归一化；
  提交给后端时保留原始标量（数字或字符串均可被 Jackson 绑定为 `Long`）。
- 日期字段类型为 `string`，格式 `yyyy-MM-dd HH:mm:ss`；日期范围查询写入
  `params: { beginTime, endTime }`（Axios 默认序列化为 `params[beginTime]`）。
- 枚举使用后端字符串值，不在前端转数字：`status` `'0'` 正常 / `'1'` 停用；`sex` `'0'` 男 /
  `'1'` 女 / `'2'` 未知；`visible` `'0'` 显示 / `'1'` 隐藏；`isFrame` `'0'` 是 / `'1'` 否；
  `isCache` `'0'` 缓存 / `'1'` 不缓存；`menuType` `M/C/F`。

**Rationale**:
- `BigNumberSerializer` 对超出 JS 安全整数范围的 `Long` 输出字符串，安全范围内输出数字
  （`platform/aoyou-common/aoyou-common-json/.../BigNumberSerializer.java`）；同一字段可能因数据不同
  而类型不同。
- Jackson 全局 `date-format: yyyy-MM-dd HH:mm:ss`（`platform/aoyou-admin/src/main/resources/application.yml`）。
- 后端 `SysUserBo`/`SysRoleBo` 等以 `String` 接收状态/性别；前端转数字会造成绑定失败或语义漂移。

**Alternatives considered**:
- 全部 ID 用 `string`：类型更稳定，但列表/树节点里数字会触发大量转换；且后端返回数字时比较仍要归一化。
- 用 `json-bigint` 解析：Vben 依赖里有 `json-bigint`，但请求层未启用；启用会改变所有响应解析行为，
  超出本需求范围。

## R13. 用户表单的特殊行为

**Decision**:
- `GET /system/user/`（无 `userId`）用于新增前的选项加载：返回 `roles`、`posts`，`user` 为 null；
  新增密码默认值取后端返回/既有初始化策略，不在前端硬编码生产密码。
- 编辑自己时，部门、角色、岗位控件禁用，提交前不携带这三项（与 plus-ui 一致）；后端仍会校验。
- 用户详情 `GET /system/user/{userId}` 返回 `{user, roleIds, roles, postIds, posts}`；编辑时合并
  `data.roles` 与 `user.roles` 去重，保证已分配角色可见。
- `userId == 1`（超管）不展示修改/删除/重置密码/分配角色入口；角色 `roleId == 1` 不展示修改/删除/
  数据权限/分配用户入口。后端仍做最终拒绝。

**Rationale**: 旧 plus-ui 的 `handleAdd` / `handleUpdate` / `handleSubmit` 与行内守卫均如此
（`0534d3d^:views/system/user/index.vue`、`views/system/role/index.vue`）；Spec E-US1、FR-019 要求
保护内置账号/角色。

**Alternatives considered**:
- 只依赖后端拒绝：用户会先看到成功交互再收到错误，状态开关还可能停留在错误值。
- 硬编码初始密码：Spec 未定义，禁止猜测；必须以后端返回或配置为准（若后端未返回，需在 Spec Packet
  签字前澄清）。

## R14. 范围边界

**Decision**: REQ-002 只实现 `system/user`、`system/user/authRole`、`system/role`、
`system/role/authUser`、`system/menu`、`system/dept`、`system/post` 七个页面。个人中心
`system/user/profile`、字典管理、参数、通知公告、文件、客户端、租户、日志、监控、工具、演示、
工作流、任务均不实现。

**Rationale**: 与 `spec.md` Assumptions 及 CLAR-004 拆分一致；`system/user/profile` 不是后端动态菜单，
Vben 已有 `_core/profile` 页面，但不在本需求验收范围。

**Alternatives considered**: 无；缩范围会违反 PM 裁决，扩范围会超出本 Spec Packet。
