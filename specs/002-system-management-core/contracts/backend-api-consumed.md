# 消费契约：REQ-002 系统管理核心

**Date**: 2026-11-03 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

> 本文件记录**前端消费**的 RuoYi-Vue-Plus 接口，不新增、不修改后端契约。`platform/` 为只读；
> 若实现中发现下述契约无法支撑 spec，必须按 CLAUDE.md 铁律 2 STOP，不得自行假设或要求后端改接口。

## 0. 通用约定

| 项 | 约定 |
|---|---|
| Base URL | `/api`（Vite 代理到 `http://localhost:8080`） |
| 认证 | `Authorization: Bearer <access_token>`；`clientid`、`Accept-Language`、`Content-Language` 由 `request.ts` 统一添加 |
| 成功码 | `code === 200`（RuoYi 语义，不是 0） |
| 普通响应 | `{ code: number, msg: string, data: T }` → 适配层返回 `T` |
| 分页响应 | `{ code: number, msg: string, rows: T[], total: number }` → 适配层返回 `{ rows, total }` |
| 业务失败 | 通常 HTTP 200 + `code` 400/401/403/500 + `msg`；`request.ts` 展示 `msg` 原文并 reject |
| 未认证 | `code === 401`（HTTP 200）或 HTTP 401；`request.ts` 清会话并回登录页 |
| 无权限 | `code === 403`，`msg = "没有访问权限，请联系管理员授权"` |
| ID | `number` 或 `string`（`BigNumberSerializer`）；前端归一化后比较 |
| 日期 | 响应 `yyyy-MM-dd HH:mm:ss`；查询日期范围用 `params[beginTime]` / `params[endTime]` |
| 下载 | `responseType: 'blob'` + `responseReturn: 'raw'`；成功为二进制，失败可能是 JSON |

**消费的前置端点（REQ-001 已定义，不在本文件重复展开）：**

| 端点 | 用途 |
|---|---|
| `GET /system/user/getInfo` | 当前用户、`permissions`、`roles` |
| `GET /system/menu/getRouters` | 动态菜单与路由 |
| `GET /system/dict/data/type/{dictType}` | 字典只读消费（见 §1） |

## 1. 共享：字典

### `GET /system/dict/data/type/{dictType}`

- **权限**：无（`SysDictDataController.dictType` 未加 `@SaCheckPermission`）
- **路径参数**：`dictType`，如 `sys_normal_disable`
- **响应**：`R<DictData[]>` → `DictData[]`
- **消费方**：`useDict()`；每个 `dictType` 每会话缓存一次
- **失败**：返回 `code != 200` 时展示 `msg`，页面使用空字典并保持可操作（不阻塞页面渲染）

REQ-002 使用的字典：

| dictType | 使用页面 |
|---|---|
| `sys_normal_disable` | user / role / menu / dept / post |
| `sys_user_sex` | user |
| `sys_show_hide` | menu |

> `isFrame` / `isCache` 在 plus-ui 中使用固定单选项（是/否、缓存/不缓存），不读取字典；
> REQ-002 保持该行为，值域见 `data-model.md` §7。

## 2. 用户

| # | 方法 | 路径 | 权限码 | 请求 | 成功数据 |
|---|---|---|---|---|---|
| U-01 | GET | `/system/user/list` | `system:user:list` | `UserQuery` query | `{ rows: UserVO[], total }` |
| U-02 | POST | `/system/user/export` | `system:user:export` | `UserQuery` query | blob |
| U-03 | POST | `/system/user/importTemplate` | 无 | 无 | blob |
| U-04 | POST | `/system/user/importData` | `system:user:import` | multipart `file` + query `updateSupport` | `null`；`msg` 含导入统计 |
| U-05 | GET | `/system/user/` 或 `/system/user/{userId}` | `system:user:query` | — | `UserInfoVO` |
| U-06 | POST | `/system/user` | `system:user:add` | `UserForm` JSON | `null` |
| U-07 | PUT | `/system/user` | `system:user:edit` | `UserForm` JSON | `null` |
| U-08 | DELETE | `/system/user/{userIds}` | `system:user:remove` | 逗号分隔 ID | `null` |
| U-09 | PUT | `/system/user/resetPwd` | `system:user:resetPwd` | `ResetPwdForm` JSON；**须 `isEncrypt` 头** | `null` |
| U-10 | PUT | `/system/user/changeStatus` | `system:user:edit` | `{ userId, status }` JSON | `null` |
| U-11 | GET | `/system/user/authRole/{userId}` | `system:user:query` | — | `UserInfoVO`（`roles[].flag`） |
| U-12 | PUT | `/system/user/authRole` | `system:user:edit` | query `userId`、`roleIds`（逗号分隔） | `null` |
| U-13 | GET | `/system/user/deptTree` | `system:user:list` | `SysDeptBo` query（可空） | `DeptTreeOption[]` |

**关键行为**

- **U-05 无 ID 形态**：新增用户前调用 `GET /system/user/`（保留尾部 `/`），返回 `roles`、`posts` 选项；
  `user` 为 `null`。不能把路径写成 `/system/user`，否则会与集合 POST 路由混淆。
- **U-05 有 ID**：返回 `{user, roleIds, roles, postIds, posts}`；编辑表单从 `user` 合并资料，从
  `roleIds` / `postIds` 回显关联。
- **U-02 导出**：参数必须放在 query；后端方法签名没有 `@RequestBody`。
- **U-03 模板**：POST，无权限码；返回文件流。
- **U-04 导入**：`updateSupport` 为布尔 query 参数；`file` 为 multipart part。不要手动设置
  `Content-Type`，交给浏览器生成 boundary。
- **U-08 批量删除**：路径为 `/system/user/1,2,3`；后端 `Long[] userIds` 绑定逗号分隔值。
- **U-09**：`@ApiEncrypt` 要求请求体加密；`request.ts` 在 `headers.isEncrypt === 'true'` 且方法为 PUT 时
  生成 AES 密钥并改写请求体。
- **U-12**：`roleIds` 用逗号分隔；空数组表示清空授权（`roleIds=`）。
- **U-13**：返回 Hutool 树，节点含 `label`、`disabled`；用户表单使用前过滤 `disabled === true` 的部门。

**后端保护（前端需要预判并展示错误）**

- `userId === 1`：修改、删除、重置密码、分配角色入口不渲染；后端 `checkUserAllowed` 仍会拒绝。
- 删除自己：后端拒绝；前端可在删除确认文案中提示，但不自行放行。
- 编辑自己：部门、角色、岗位控件禁用，提交时不携带这三项。

## 3. 角色

| # | 方法 | 路径 | 权限码 | 请求 | 成功数据 |
|---|---|---|---|---|---|
| R-01 | GET | `/system/role/list` | `system:role:list` | `RoleQuery` query | `{ rows: RoleVO[], total }` |
| R-02 | POST | `/system/role/export` | `system:role:export` | `RoleQuery` query | blob |
| R-03 | GET | `/system/role/{roleId}` | `system:role:query` | — | `RoleVO` |
| R-04 | POST | `/system/role` | `system:role:add` | `RoleForm` JSON | `null` |
| R-05 | PUT | `/system/role` | `system:role:edit` | `RoleForm` JSON | `null` |
| R-06 | PUT | `/system/role/dataScope` | `system:role:edit` | `{ roleId, dataScope, deptIds, deptCheckStrictly }` JSON | `null` |
| R-07 | PUT | `/system/role/changeStatus` | `system:role:edit` | `{ roleId, status }` JSON | `null` |
| R-08 | DELETE | `/system/role/{roleIds}` | `system:role:remove` | 逗号分隔 ID | `null` |
| R-09 | GET | `/system/role/authUser/allocatedList` | `system:role:list` | `AuthUserQuery`（含 `roleId`） | `{ rows: UserVO[], total }` |
| R-10 | GET | `/system/role/authUser/unallocatedList` | `system:role:list` | `AuthUserQuery` | `{ rows: UserVO[], total }` |
| R-11 | PUT | `/system/role/authUser/cancel` | `system:role:edit` | `{ roleId, userId }` JSON | `null` |
| R-12 | PUT | `/system/role/authUser/cancelAll` | `system:role:edit` | query `roleId`、`userIds`（逗号分隔） | `null` |
| R-13 | PUT | `/system/role/authUser/selectAll` | `system:role:edit` | query `roleId`、`userIds`（逗号分隔） | `null` |
| R-14 | GET | `/system/role/deptTree/{roleId}` | `system:role:list` | — | `{ checkedKeys: Id[], depts: DeptTreeOption[] }` |

**关键行为**

- **R-05 菜单权限**：`RoleForm.menuIds` 与 `menuCheckStrictly` 一起提交；编辑页先 `GET /system/role/{roleId}`
  取角色，再 `GET /system/menu/roleMenuTreeselect/{roleId}` 取 `checkedKeys` 与整棵菜单树。
- **R-06 数据权限**：`deptIds` 只在 `dataScope === '2'`（自定义）时有意义；`deptCheckStrictly` 控制
  父子联动。部门树来自 `R-14`。
- **R-09/R-10**：两个列表共用 `UserQuery`，必须带 `roleId`；后端按角色区分已授权/未授权。
- **R-11**：单个取消用 JSON body；**R-12/R-13** 批量操作必须用 query，不能用 body。
- **R-14**：`depts` 是整棵部门树（含 `checkedKeys` 标记）；不是按角色过滤后的子树。
- **内置角色 `roleId === 1`**：不渲染修改、删除、数据权限、分配用户入口；后端仍会拒绝。

## 4. 菜单

| # | 方法 | 路径 | 权限码 | 请求 | 成功数据 |
|---|---|---|---|---|---|
| M-01 | GET | `/system/menu/list` | `system:menu:list` | `MenuQuery` query | `MenuVO[]`（flat） |
| M-02 | GET | `/system/menu/{menuId}` | `system:menu:query` | — | `MenuVO` |
| M-03 | GET | `/system/menu/treeselect` | `system:menu:query` | `MenuQuery`（可空） | `MenuTreeOption[]` |
| M-04 | GET | `/system/menu/roleMenuTreeselect/{roleId}` | `system:menu:query` | — | `{ checkedKeys: Id[], menus: MenuTreeOption[] }` |
| M-05 | POST | `/system/menu` | `system:menu:add` + **`superadmin` 角色** | `MenuForm` JSON | `null` |
| M-06 | PUT | `/system/menu` | `system:menu:edit` + **`superadmin` 角色** | `MenuForm` JSON | `null` |
| M-07 | DELETE | `/system/menu/{menuId}` | `system:menu:remove` + **`superadmin` 角色** | — | `null` |
| M-08 | DELETE | `/system/menu/cascade/{menuIds}` | `system:menu:remove` + **`superadmin` 角色** | 逗号分隔 ID | `null` |

**关键行为**

- **M-01 返回 flat list**：页面按 `parentId` 构树；父节点不在筛选结果中的节点提升为根。
- **M-03**：完整菜单树，用于新增/编辑角色时勾选；节点含 `menuType`、`icon`、`visible`、`status`。
- **M-04**：`checkedKeys` 已按 `menuCheckStrictly` 处理；前端树的 `checkStrictly` 必须与角色
  `menuCheckStrictly` 绑定，否则父子联动会改变提交集合。
- **M-05/M-06**：后端额外要求 `@SaCheckRole("superadmin")`；只拥有权限码的普通管理员会被 403。
- **M-06 校验**：后端拒绝“上级菜单选择自己”和重复路由；前端也应在前端提前禁用自己及子节点。
- **M-07**：删除含子节点的菜单时后端拒绝；前端提供“级联删除”入口（M-08），并在确认框中提示影响范围。
- **按钮节点**：`menuType === 'F'` 时 `path`、`component` 不参与导航，但 `perms` 决定按钮权限。

## 5. 部门

| # | 方法 | 路径 | 权限码 | 请求 | 成功数据 |
|---|---|---|---|---|---|
| D-01 | GET | `/system/dept/list` | `system:dept:list` | `DeptQuery` query | `DeptVO[]`（flat） |
| D-02 | GET | `/system/dept/list/exclude/{deptId}` | `system:dept:list` | — | `DeptVO[]`（flat，排除自身及下级） |
| D-03 | GET | `/system/dept/{deptId}` | `system:dept:query` | — | `DeptVO` |
| D-04 | POST | `/system/dept` | `system:dept:add` | `DeptForm` JSON | `null` |
| D-05 | PUT | `/system/dept` | `system:dept:edit` | `DeptForm` JSON | `null` |
| D-06 | DELETE | `/system/dept/{deptId}` | `system:dept:remove` | — | `null` |

**关键行为**

- **D-01**：flat list；页面构树后整树渲染，支持展开/折叠。筛选时孤儿节点提升为根。
- **D-02**：编辑部门时作为上级部门候选，排除自身及所有下级，防止形成循环。
- **D-06**：存在下级部门或关联用户时后端拒绝；前端展示后端 `msg`，不做前端推断。
- 部门管理页、用户归属选择器、角色数据权限选择器使用同一棵部门树数据源（`/system/user/deptTree`、
  `/system/role/deptTree/{roleId}`、`/system/post/deptTree`）；结构必须一致。

## 6. 岗位

| # | 方法 | 路径 | 权限码 | 请求 | 成功数据 |
|---|---|---|---|---|---|
| P-01 | GET | `/system/post/list` | `system:post:list` | `PostQuery` query | `{ rows: PostVO[], total }` |
| P-02 | POST | `/system/post/export` | `system:post:export` | `PostQuery` query | blob |
| P-03 | GET | `/system/post/{postId}` | `system:post:query` | — | `PostVO` |
| P-04 | POST | `/system/post` | `system:post:add` | `PostForm` JSON | `null` |
| P-05 | PUT | `/system/post` | `system:post:edit` | `PostForm` JSON | `null` |
| P-06 | DELETE | `/system/post/{postIds}` | `system:post:remove` | 逗号分隔 ID | `null` |
| P-07 | GET | `/system/post/deptTree` | `system:post:list` | `DeptQuery`（可空） | `DeptTreeOption[]` |

**关键行为**

- **P-01**：分页列表；`belongDeptId` 用于按部门子树筛选（左侧部门树点击），`deptId` 用于精确部门筛选。
  两个参数不要同时提交。
- **P-07**：节点含 `label`、`disabled`；岗位表单的所属部门使用该树。
- **P-02**：参数走 query，响应 blob。

## 7. 错误与边界

| 场景 | 后端表现 | 前端行为 |
|---|---|---|
| 参数校验失败 | `code=400` / `500`，`msg` 含字段提示 | 展示 `msg`；表单不关闭；不重复包装错误 |
| 无权限 | `code=403`，`msg` 固定 | 展示 `msg`；按钮本身应按权限隐藏 |
| 未认证 | `code=401` 或 HTTP 401 | `request.ts` 清会话并回登录页；不弹业务错误 |
| 唯一性冲突 | `code=500`，`msg` 如“登录账号已存在” | 原样展示；表单保留输入 |
| 受保护对象 | `code=500`，`msg` 如“不允许操作超级管理员用户” | 原样展示；状态开关回滚 |
| 导出失败 | 可能 HTTP 200 + JSON 错误体 | 检查 `Content-Type`；JSON 时解析 `msg` 并报错，不保存文件 |
| 导入部分成功 | `code=200`，`msg` 含成功/失败统计与失败原因 | 弹窗展示统计；刷新列表 |
| 空数据 | `rows=[]` / `data=[]` | 表格/树显示空状态，不显示错误弹窗 |
| 分页越界 | 返回空 `rows`，`total` 不变 | 分页组件回到有效页码；不无限加载 |

## 8. 明确不消费（本需求范围外）

- `GET /system/user/profile`、`PUT /system/user/profile`、`PUT /system/user/profile/updatePwd`、
  `POST /system/user/profile/avatar`
- 字典管理、参数、通知公告、文件、客户端、租户、租户套餐
- 日志、在线用户、缓存、Admin 监控、SnailJob
- 代码生成、演示页面、工作流与任务
- `GET /system/menu/tenantPackageMenuTreeselect/{packageId}`（租户套餐管理由 REQ-003 承接）
- `GET /system/user/optionselect`、`GET /system/role/optionselect`、`GET /system/post/optionselect`、
  `GET /system/dept/optionselect`：当前页面通过用户预处理接口或树接口取选项，不调用这些端点。
  若实现中发现需要，先按铁律 2 STOP 并更新本契约。
