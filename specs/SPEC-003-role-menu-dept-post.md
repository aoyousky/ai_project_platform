---
id: REQ-20261104-003
title: 系统管理核心（角色/菜单/部门/岗位）
version: 1.3
risk_level: L2
channel: ai_forced_review
pm: aoyousky（2026-11-02 CLAR-004 裁决人）
business_signoff: aoyousky（2026-11-04 对话确认“确认，同意执行后续任务”）
arch_reviewer: aoyousky（2026-11-04 对话确认，L2）
target_window: 2026-11-04 ~ 2026-11-18
speckit_feature: specs/002-system-management-core
---

# Spec Packet：系统管理核心（角色/菜单/部门/岗位）

> 本文件是**交付与验收的唯一依据**。`specs/002-system-management-core/spec.md` 与
> `plan.md` 只是上游意图与设计来源；两者冲突时以本文件为准，并按升版流程更新 `version`。
> 本 Packet 承接 `specs/SPEC-002-system-management-core.md` §7 中明确留给后续 Packet 的
> US2–US5：角色（含授权用户隐藏页）、菜单、部门、岗位。用户管理与分配角色已在
> `REQ-20261103-002` 交付，不在本 Packet 重新实现。

## 1. 意图

- **业务目标（含量化指标）**：在 Vben Admin 5.7.0 的 `apps/web-antdv-next` 中完成
  `system/role`、`system/role/authUser`、`system/menu`、`system/dept`、`system/post`
  五个页面的列表/树、筛选、分页、新增、编辑、删除、状态、导出、菜单授权、数据权限、
  用户授权，行为对齐 plus-ui。DoD 内指标：本 Packet 的 12 条 P0 断言全部通过；五个页面
  关键链路 Playwright 失败数 0；后端接口、错误结构与权限码变更数 0。
- **调用方 / 场景 / 频率**：平台超级管理员与租户管理员，桌面端现代浏览器，中文界面；
  日常办公频率（组织调整、权限变更时集中使用）。
- **上线 30 天成功度量（不计入 DoD）**：交付后 30 天内“角色/菜单/部门/岗位保存后不生效或
  列表与详情不一致”类工单数为 0；该指标为滞后指标，交付时不可验证，转为上线回顾。

## 2. 验收断言

> 评测夹具（`scripts/evals/seed_spec003.sh` 在实现阶段提供）：角色 `spec003_role`
> （`roleKey=spec003_role`）、已分配角色 `spec003_assigned`（绑定用户 `spec003_user`）、
> 部门 `spec003_dept`（根，`parentId=0`）及其子部门 `spec003_dept_child`、含用户部门
> `spec003_dept_user`（绑定 `spec003_user`）、含岗位部门 `spec003_dept_post`、空部门
> `spec003_dept_empty`、岗位 `spec003_post_ref`（绑定 `spec003_user`）、菜单目录
> `spec003_dir` 及其子菜单 `spec003_menu` 和按钮 `spec003_button`、非 superadmin 但拥有
> 菜单权限码的用户 `spec003_menu_admin`。除 A-09 外均使用拥有 `*:*:*` 的超级管理员令牌。

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 预置角色 `spec003_role` 存在（`status='0'`，`roleSort=1`） | `GET /system/role/list?pageNum=1&pageSize=10&roleName=<角色名>&status=0` | HTTP 200；`code=200`；`total ≥ 1`；`rows` 中某行 `roleKey='spec003_role'`；每行满足 RoleVO schema，`roleId` 为字符串或数字，`roleName`/`roleKey`/`roleSort`/`status` 类型与 §4 一致 |
| A-02 | P0 | 角色名称与权限字符在库中不存在 | `POST /system/role`（`roleName`、`roleKey`、`roleSort=1`、`status='0'`、`menuIds=[]`）；`GET /system/role/list?roleKey=<新 roleKey>`；`PUT /system/role`（同 `roleKey`，改 `roleName`，`menuIds=[]`）；`DELETE /system/role/{新 roleId}`；再次查询 | 新增/修改/删除响应均 `code=200`；首次查询 `total=1` 且 `roleName` 为新值；删除后查询 `code=200`、`total=0`、`rows=[]` |
| A-03 | P0 | 角色 `spec003_role` 存在；菜单树含 `spec003_dir` 与其子菜单 `spec003_menu` | `PUT /system/role`（原 `roleName`/`roleKey`，`menuIds=[dirId,menuId]`，`menuCheckStrictly=false`）；`GET /system/menu/roleMenuTreeselect/{roleId}`；再 `PUT` 提交 `menuIds=[]` 后重复查询 | 保存与查询均 `code=200`；首次 `checkedKeys` 同时包含两个 ID；`menus` 为数组且节点含 `id`/`parentId`/`label`；第二次查询 `checkedKeys=[]` |
| A-04 | P0 | 角色 `spec003_role` 存在；部门 `spec003_dept` 存在 | `PUT /system/role/dataScope`（`roleId`、`dataScope='2'`、`deptIds=[deptId]`、`deptCheckStrictly=true`）；`GET /system/role/deptTree/{roleId}`；`GET /system/role/{roleId}`；再提交 `dataScope='1'`、`deptIds=[]` 并重复查询树 | 保存与查询均 `code=200`；首次 `checkedKeys` 包含该部门 ID，`depts` 为数组且节点含 `id`/`parentId`/`label`；详情 `dataScope='2'`；第二次 `checkedKeys=[]` 且详情 `dataScope='1'` |
| A-05 | P0 | 角色 `spec003_role` 与用户 `spec003_user` 存在，二者当前无授权关系 | `PUT /system/role/authUser/selectAll?roleId=<id>&userIds=<userId>`；`GET /system/role/authUser/allocatedList?roleId=<id>`；`GET /system/role/authUser/unallocatedList?roleId=<id>&userName=spec003_user`；`PUT /system/role/authUser/cancel`（JSON `{roleId,userId}`）；再 `selectAll` 后 `PUT /system/role/authUser/cancelAll?roleId=<id>&userIds=<userId>` | 全部响应 `code=200`；首次 `allocatedList.total ≥ 1` 且 `rows` 含该 `userId`；`unallocatedList.total=0`；`cancel` 后 `allocatedList` 不含该 `userId`；`cancelAll` 后 `allocatedList.total=0` |
| A-06 | P0 | 内置角色 `roleId=1` 存在且 `status='0'`；已分配角色 `spec003_assigned` 绑定 `spec003_user` 且 `status='0'` | `DELETE /system/role/1`；`PUT /system/role/changeStatus`（`roleId=1`、`status='1'`）；`DELETE /system/role/{assignedId}`；`PUT /system/role/changeStatus`（`roleId=assignedId`、`status='1'`）；随后 `GET /system/role/1` 与 `GET /system/role/{assignedId}` | 四个写响应均 `code ≠ 200` 且 `msg` 非空；两个详情响应 `code=200`，`status` 均仍为 `'0'`，角色未被删除 |
| A-07 | P0 | 超级管理员令牌有效；预置菜单目录 `spec003_dir` 存在 | `GET /system/menu/list?menuName=<目录名>`；`GET /system/menu/treeselect` | 列表响应 `code=200`，`data` 为数组且节点含 `menuId`/`parentId`/`menuName`/`menuType`/`status`；树响应 `code=200`，`data` 为数组且至少一个节点含 `label` 与 `children` |
| A-08 | P0 | 超级管理员令牌有效；预置目录 `spec003_dir` 下暂无子节点 | `POST /system/menu` 新增目录（`menuType='M'`、`parentId=0`）；新增子菜单（`menuType='C'`、`parentId=目录`）；新增按钮（`menuType='F'`、`parentId=子菜单`）；`DELETE /system/menu/{子菜单}`（存在按钮子节点）；`DELETE /system/menu/cascade/{目录,子菜单,按钮}`（三个 ID 一次提交） | 三个新增响应 `code=200`；单删含子节点的子菜单返回 HTTP 200 且 body `code=601`、`msg` 非空；级联删除（提交全部后代 ID）`code=200`；删除后 `GET /system/menu/list?menuName=<目录名>` 返回 `code=200`、`data=[]` |
| A-09 | P0 | 用户 `spec003_menu_admin` 拥有 `system:menu:list/query/add/edit/remove` 权限码，但不具备 `superadmin` 与租户管理员角色 | 该用户令牌调用 `GET /system/menu/list` 与 `POST /system/menu` | 两个响应 HTTP 200、`code=403`、`msg='没有访问权限，请联系管理员授权'` |
| A-10 | P0 | 部门 `spec003_dept` 及其子部门 `spec003_dept_child` 存在；超级管理员令牌有效 | `GET /system/dept/list?deptName=<父部门名>`；`GET /system/dept/list/exclude/{父部门 deptId}`；`GET /system/post/deptTree` | 列表 `code=200`，`data` 为数组且含 `deptId`/`parentId`/`deptName`/`orderNum`/`status`；排除接口 `code=200`，`data` 不含父部门与子部门 ID；部门树 `code=200`，`data` 中某节点 `label` 等于父部门名 |
| A-11 | P0 | 部门 `spec003_dept_child` 为叶子且无用户、无岗位；父部门 `spec003_dept` 含该子部门 | `POST /system/dept` 在父部门下新增子部门；`PUT /system/dept` 修改其名称与负责人；`DELETE /system/dept/{父部门}`；`DELETE /system/dept/{子部门}`；再次 `GET /system/dept/list?deptName=<子部门新名>` | 新增与修改 `code=200`；删除父部门返回 HTTP 200 且 body `code=601`、`msg` 非空；删除子部门 `code=200`；最终查询 `code=200`、`data=[]` |
| A-12 | P0 | 部门 `spec003_dept` 存在；岗位编码/名称在库中不存在；岗位 `spec003_post_ref` 已绑定 `spec003_user` | `POST /system/post`（`deptId`、`postCode`、`postName`、`postSort=1`、`status='0'`）；`GET /system/post/list?postCode=<新编码>`；`PUT /system/post` 改 `postName`；`DELETE /system/post/{引用岗位}`；`DELETE /system/post/{新岗位}`；`POST /system/post/export?postCode=<新编码>` | 新增/修改/删除（新岗位）响应 `code=200`；列表 `total=1` 且 `deptName` 非空；删除引用岗位 `code ≠ 200` 且 `msg` 非空；删除新岗位后列表 `total=0`；导出 HTTP 200、响应体非空，`Content-Type` 属于 xlsx 或 octet-stream |
| A-13 | P1 | 超级管理员令牌有效，角色列表非空 | `POST /system/role/export?roleName=<角色名>` | HTTP 200；响应体非空；`Content-Type` 属于 xlsx 或 octet-stream |
| A-14 | P1 | 打开菜单新增/编辑弹窗 | 切换 `menuType` 为 `M`/`C`/`F` | `M`/`C` 时渲染“路由地址”必填项与“组件路径”字段；`F` 时不渲染路由地址与组件路径，渲染“权限标识”字段；隐藏菜单时渲染“激活路由”字段 |
| A-15 | P1 | 部门页、用户部门选择器、角色数据权限树打开 | 筛选部门名称并展开/折叠节点 | 三处树的层级与节点集合一致；筛选后匹配节点的必要父节点保留；折叠/展开不改变筛选结果 |
| A-16 | P1 | 用户新增/编辑页打开 | 打开岗位选择器 | 只列出未停用且当前账号可分配的岗位；保存后用户详情 `postIds` 与所选一致 |
| A-17 | P1 | 无 `system:role:add` / `system:menu:add` / `system:dept:add` / `system:post:add` 权限码的账号登录 | 进入对应页面并尝试删除操作 | 新增/删除按钮不渲染；删除、级联删除、停用、移除授权均先出现二次确认，确认后才发起请求 |
| A-18 | P1 | 角色 `spec003_role` 已授予目录 `spec003_dir`、子菜单 `spec003_menu`（`visible='0'`）与隐藏菜单 `spec003_hidden`（`visible='1'`）；账号 `spec003_router` 在断言期间绑定该角色 | 使用该账号令牌调用 `GET /system/menu/getRouters` | `code=200`；`data` 中存在 `spec003_menu` 对应路由且 `hidden=false`；未授权的菜单（如 `system`）不出现；`spec003_hidden` 以 `hidden=true` 返回，不渲染为侧边栏可见入口 |
| A-19 | P1 | 列表请求可控地失败（后端不可达或返回非 200 code） | 打开角色/菜单/部门/岗位页 | 页面展示错误提示或空状态，不出现无限加载；状态开关失败后回滚为原状态 |

> P0 断言 12 条，未超过模板上限；P1 断言只做组件/E2E 验证，不进入 P0 门禁。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 新增角色时角色名称重复 | HTTP 200；`code ≠ 200`；`msg` 非空；角色列表 `total` 不增加 |
| E-02 | 新增角色时权限字符重复 | HTTP 200；`code ≠ 200`；`msg` 非空；角色列表 `total` 不增加 |
| E-03 | 新增角色使用内置标识符 `superadmin` 或租户管理员标识符 | HTTP 200；`code ≠ 200`；`msg` 非空；角色未创建 |
| E-04 | 编辑角色把 `roleKey` 改为内置管理员标识符 | HTTP 200；`code ≠ 200`；`msg` 非空；原角色 `roleKey` 不变 |
| E-05 | 删除内置角色 `roleId=1` | HTTP 200；`code ≠ 200`；`msg` 非空；`GET /system/role/1` 仍为 `code=200` |
| E-06 | 停用内置角色 `roleId=1` | HTTP 200；`code ≠ 200`；`msg` 非空；详情 `status` 仍为 `'0'` |
| E-07 | 删除已分配用户的角色 | HTTP 200；`code ≠ 200`；`msg` 非空；`allocatedList` 仍含该用户 |
| E-08 | 停用已分配用户的角色 | HTTP 200；`code ≠ 200`；`msg` 非空；详情 `status` 仍为 `'0'` |
| E-09 | 角色菜单保存提交 `menuIds=[]` | HTTP 200；`code=200`；随后 `roleMenuTreeselect.checkedKeys=[]` |
| E-10 | 删除含子菜单的菜单（单删端点） | HTTP 200；body `code=601`；`msg` 非空；子菜单仍在列表中 |
| E-11 | 删除已分配给角色的菜单 | HTTP 200；body `code=601`；`msg` 非空；菜单仍在列表中 |
| E-12 | 级联删除端点只提交父菜单 ID（不含后代 ID） | HTTP 200；body `code=601`；`msg` 非空；父子节点均未被删除 |
| E-13 | 非 superadmin 但拥有菜单权限码的账号调用菜单写接口 | HTTP 200；`code=403`；`msg='没有访问权限，请联系管理员授权'` |
| E-14 | 菜单/部门列表筛选无匹配 | HTTP 200；`code=200`；`data=[]`（不是 `null`） |
| E-15 | 同一父部门下新增重名部门 | HTTP 200；`code ≠ 200`；`msg` 非空；部门未创建 |
| E-16 | 删除默认部门 `deptId=100` | HTTP 200；body `code=601`；`msg='默认部门,不允许删除'` |
| E-17 | 删除存在下级部门的部门 | HTTP 200；body `code=601`；`msg` 非空；下级部门仍存在 |
| E-18 | 删除存在用户的部门 | HTTP 200；body `code=601`；`msg` 非空；部门仍存在 |
| E-19 | 删除存在岗位的部门 | HTTP 200；body `code=601`；`msg` 非空；部门仍存在 |
| E-20 | 编辑部门时把上级部门设为自身 | HTTP 200；`code ≠ 200`；`msg` 非空；部门层级不变 |
| E-21 | 停用含未停用子部门的部门 | HTTP 200；`code ≠ 200`；`msg` 非空；部门状态不变 |
| E-22 | 新增或编辑岗位时名称/编码重复 | HTTP 200；`code ≠ 200`；`msg` 非空；岗位未新增或未改变 |
| E-23 | 删除已被用户引用的岗位 | HTTP 200；`code ≠ 200`；`msg` 非空；岗位仍存在 |
| E-24 | 停用已被用户引用的岗位 | HTTP 200；`code ≠ 200`；`msg` 非空；岗位 `status` 仍为 `'0'` |
| E-25 | 无令牌访问角色/菜单/部门/岗位任一接口 | HTTP 401；响应体不包含业务数据 |
| E-26 | 无对应权限码的账号访问角色/菜单/部门/岗位写接口 | HTTP 200；`code=403`；`msg='没有访问权限，请联系管理员授权'` |
| E-27 | 角色/岗位列表页码超出总页数 | HTTP 200；`code=200`；`rows=[]`；`total` 等于筛选后的真实总数 |
| E-28 | 角色菜单/数据权限保存后立即重新查询 | HTTP 200；`code=200`；查询结果与本次提交一致（缓存不返回旧值） |
| E-29 | 部门树接口在无部门数据时 | HTTP 200；`code=200`；`data=[]`（不是 `null`） |

## 4. 数据契约

### 4.1 共享字段（`AuditFields`，四个 VO 均继承）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `createBy` | `Id \| null` | 是 | `null` 表示历史数据未记录 | 创建人 |
| `createTime` | `string \| null` | 是 | `null` 表示未记录 | `yyyy-MM-dd HH:mm:ss` |
| `updateBy` | `Id \| null` | 是 | `null` 表示未更新 | 更新人 |
| `updateTime` | `string \| null` | 是 | `null` 表示未更新 | `yyyy-MM-dd HH:mm:ss` |
| `params` | `Record<string, unknown> \| null` | 是 | `null` 等价空对象 | 查询扩展参数 |

### 4.2 RoleVO（`SysRoleVo`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `roleId` | `Id` | 否 | — | 超过 `2^53-1` 时后端输出字符串 |
| `roleName` | `string` | 否 | — | ≤30 |
| `roleKey` | `string` | 否 | — | 权限字符，≤100 |
| `roleSort` | `number` | 否 | — | 显示顺序，≥0 |
| `dataScope` | `string \| null` | 是 | `null` 按 `'1'` 展示 | `'1'` 全部 / `'2'` 自定义 / `'3'` 本部门 / `'4'` 本部门及以下 / `'5'` 仅本人 / `'6'` 部门及以下或本人 |
| `menuCheckStrictly` | `boolean \| null` | 是 | `null` 等价 `false` | 菜单树父子联动开关 |
| `deptCheckStrictly` | `boolean \| null` | 是 | `null` 等价 `false` | 部门树父子联动开关 |
| `status` | `string` | 否 | — | `'0'` 正常 / `'1'` 停用 |
| `remark` | `string \| null` | 是 | `null` 表示无备注 | 备注 |
| `flag` | `boolean \| undefined` | 是 | 缺省表示未授权 | 授权用户接口：`true` 表示当前用户拥有该角色 |
| `superAdmin` | `boolean \| undefined` | 是 | 缺省等价 `false` | 后端派生字段，前端只读 |

### 4.3 MenuVO（`SysMenuVo`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `menuId` | `Id` | 否 | — | 菜单 ID |
| `menuName` | `string` | 否 | — | ≤50 |
| `parentId` | `Id` | 否 | — | 根菜单为 `0` |
| `orderNum` | `number` | 否 | — | 排序 |
| `path` | `string \| null` | 是 | `null` 表示按钮或未配置 | 路由地址，`M`/`C` 必填 |
| `component` | `string \| null` | 是 | `null` 表示目录或外链 | 组件路径 |
| `queryParam` | `string \| null` | 是 | `null` 表示无参数 | 路由参数 |
| `isFrame` | `string \| null` | 是 | `null` 等价 `'1'` | `'0'` 外链 / `'1'` 否 |
| `isCache` | `string \| null` | 是 | `null` 等价 `'0'` | `'0'` 缓存 / `'1'` 不缓存 |
| `menuType` | `'M' \| 'C' \| 'F'` | 否 | — | 目录/菜单/按钮 |
| `visible` | `string` | 否 | — | `'0'` 显示 / `'1'` 隐藏 |
| `status` | `string` | 否 | — | `'0'` 正常 / `'1'` 停用 |
| `perms` | `string \| null` | 是 | `null` 表示无权限标识 | 权限字符，格式 `a:b:c` |
| `icon` | `string \| null` | 是 | `null` 表示无图标 | 图标名 |
| `createDept` | `Id \| null` | 是 | `null` 表示未记录 | 仅 `SysMenuVo` 返回 |
| `remark` | `string \| null` | 是 | `null` 表示无备注/无激活路由 | 隐藏菜单场景兼作激活路由，需以 `/` 开头 |
| `children` | `MenuVO[]` | 是 | 缺省等价 `[]` | `/system/menu/list` 返回 flat 列表，树由前端构建 |

### 4.4 DeptVO（`SysDeptVo`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `deptId` | `Id` | 否 | — | 部门 ID |
| `parentId` | `Id` | 否 | — | 根部门为 `0` |
| `parentName` | `string \| null` | 是 | `null` 表示列表未填充 | 列表接口不保证填充 |
| `ancestors` | `string \| null` | 是 | `null` 表示未记录 | 祖级列表，如 `0,100,101` |
| `deptName` | `string` | 否 | — | ≤30 |
| `deptCategory` | `string \| null` | 是 | `null` 表示未分类 | 类别编码，≤100 |
| `orderNum` | `number` | 否 | — | 排序 |
| `leader` | `Id \| null` | 是 | `null` 表示未指定 | 负责人用户 ID |
| `leaderName` | `string \| null` | 是 | `null` 表示未填充或未指定 | 负责人姓名 |
| `phone` | `string \| null` | 是 | `null` 表示未填写 | ≤11 |
| `email` | `string \| null` | 是 | `null` 表示未填写 | ≤50 |
| `status` | `string` | 否 | — | `'0'` 正常 / `'1'` 停用 |
| `children` | `DeptVO[]` | 是 | 缺省等价 `[]` | 列表返回 flat，树由前端构建 |

### 4.5 PostVO（`SysPostVo`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `postId` | `Id` | 否 | — | 岗位 ID |
| `deptId` | `Id` | 否 | — | 所属部门 ID |
| `postCode` | `string` | 否 | — | ≤64，唯一 |
| `postName` | `string` | 否 | — | ≤50，唯一 |
| `postCategory` | `string \| null` | 是 | `null` 表示未分类 | 类别编码，≤100 |
| `postSort` | `number` | 否 | — | 排序 |
| `status` | `string` | 否 | — | `'0'` 正常 / `'1'` 停用 |
| `remark` | `string \| null` | 是 | `null` 表示无备注 | 备注 |
| `deptName` | `string \| null` | 是 | `null` 表示未填充 | 所属部门名称 |

### 4.6 树选择契约（`MenuTreeOption` / `DeptTreeOption`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `id` | `Id` | 否 | — | 节点 ID |
| `parentId` | `Id` | 否 | — | 根为 `0` |
| `label` | `string` | 否 | — | Hutool `nameKey='label'`；对应菜单名/部门名 |
| `weight` | `number \| undefined` | 是 | 缺省表示无排序 | 排序值 |
| `disabled` | `boolean \| undefined` | 是 | 缺省等价 `false` | 部门树：停用部门为 `true` |
| `children` | `TreeOption[]` | 是 | 缺省等价 `[]` | 子节点 |

- `/system/menu/roleMenuTreeselect/{roleId}` 返回 `{ checkedKeys: Id[], menus: MenuTreeOption[] }`。
- `/system/role/deptTree/{roleId}` 返回 `{ checkedKeys: Id[], depts: DeptTreeOption[] }`。
- `checkedKeys` 为空时必须是 `[]`，不得为 `null`。

### 4.7 请求体校验约束（由后端 `@Validated` 决定，前端不得放宽；本表是校验规则，不是字段契约）

| 表单 | 字段 | 约束 |
|---|---|---|
| RoleForm | `roleName` | `@NotBlank`、≤30 |
| RoleForm | `roleKey` | `@NotBlank`、≤100 |
| RoleForm | `roleSort` | `@NotNull` |
| RoleForm | `menuIds` | 必须传数组；空数组表示清空菜单权限 |
| RoleForm | `deptIds` | 数据权限接口必须传数组；空数组表示清空部门关联 |
| MenuForm | `menuName` | `@NotBlank`、≤50 |
| MenuForm | `menuType` | `@NotBlank`，取值 `M`/`C`/`F` |
| MenuForm | `orderNum` | `@NotNull` |
| MenuForm | `path` | `M`/`C` 必填（前端强制），≤200 |
| MenuForm | `perms` | 匹配 `^[a-z][a-z0-9]*(:[a-z0-9]+)+$` 形式，≤100 |
| DeptForm | `deptName` | `@NotBlank`、≤30 |
| DeptForm | `orderNum` | `@NotNull` |
| DeptForm | `email` | `@Email`、≤50 |
| PostForm | `deptId` | `@NotNull` |
| PostForm | `postCode` | `@NotBlank`、≤64 |
| PostForm | `postName` | `@NotBlank`、≤50 |
| PostForm | `postSort` | `@NotNull` |

## 5. 非功能约束

- **性能口径（上线回顾指标，不计入 DoD）**：五个页面列表/树接口在本地 Docker 栈、Edge 最新版下
  P95 ≤ 2s；页面路由切换 ≤ 500ms（不含接口耗时）；导出请求发起后 2s 内开始返回响应体。
  交付阶段不做压测，交付后 30 天回顾时抽样核对；未达标不阻断本次验收，但须登记为改进项。
- **安全（鉴权 / 脱敏）**：全部请求携带 `Authorization: Bearer <token>` 与 `clientid`；菜单写接口
  额外要求 `superadmin` 角色；部门/角色/岗位写接口要求对应权限码。`email`、`phone` 在无
  `system:user:edit` 权限时由后端掩码，前端不得缓存或还原密文。任何令牌、验证码明文不得写入
  日志、`console`、trace 或报告（R3）。
- **合规（留痕 / 审计）**：写操作由后端 `@Log` 记录，前端不重复上报敏感内容；不新增埋点依赖。
- **可观测（必须输出）**：请求失败时展示后端 `msg`；页面不得吞异常；`console.error` 只允许输出
  脱敏后的接口路径与错误码，不得输出请求体中的密码或令牌。

## 6. 状态流转

| 实体 | 状态 | 合法迁移 | 非法迁移与拒绝 |
|---|---|---|---|
| 角色 | `'0'` 正常 ↔ `'1'` 停用 | 无用户分配时可互转 | `roleId=1` 任何停用；已分配用户的角色停用 → `code ≠ 200` |
| 角色数据权限 | `dataScope` `'1'`～`'6'` | 任意范围可互转；`'2'` 时维护 `deptIds` | 非 `'2'` 时 `deptIds` 必须提交 `[]`，否则保留旧关联（前端强制清空） |
| 菜单 | `'0'` 正常 ↔ `'1'` 停用 | 任意方向可转 | 无额外后端拒绝 |
| 部门 | `'0'` 正常 ↔ `'1'` 停用 | 无未停用子部门且无用户时可转停用 | 含未停用子部门或用户时停用 → `code ≠ 200` |
| 岗位 | `'0'` 正常 ↔ `'1'` 停用 | 无用户引用时可转停用 | 有用户引用时停用 → `code ≠ 200` |
| 菜单类型 | `M` 目录 / `C` 菜单 / `F` 按钮 | 新增时选定；编辑时不得改变父子循环 | 上级菜单选择自身或后代由前端禁用；后端拒绝自身为上级 |

## 7. Non-goals（必填）

- **本期不做**：
  - 用户管理页、分配角色页、个人中心、修改密码、头像上传、在线设备（`REQ-20261103-002` 已交付或属个人中心）。
  - 字典管理、参数设置、通知公告、文件/OSS、客户端、租户、租户套餐、日志、监控、代码生成、
    演示页面、工作流与任务。
  - 修改 `platform/` 任何文件，包括接口、字段、错误码、权限码、SQL 与配置。
  - 新增前端依赖；新增 vxe 全局 renderer；修改 `packages/**` 上游实现。
  - 移动端/响应式专项适配、新增语言包、视觉重设计、plus-ui SVG 图标资产搬迁。
  - 重新定义导出列或文件格式；导出列以后端既有实现为准。
  - 改变后端权限判定规则；前端只消费 `permissions` 与 `roles`。
  - 菜单拖拽排序、批量导入。
- **不兼容**：
  - 不保证与 plus-ui 的 DOM 结构或 CSS 类名一致；只保证用户可见行为与数据契约一致。
  - 不保证后端拒绝文案逐字一致，除本 Packet 明确写出的 `msg` 原文外。
  - 不保证超出 JS 安全整数范围的 ID 以 number 形式出现；前端统一兼容 number/string。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `PUT /system/role`：`{roleId: 900003000000000006, roleName: "Spec003 角色", roleKey: "spec003_role", roleSort: 1, menuIds: [<dir>,<menu>], menuCheckStrictly: false}` | `code=200`；`GET /system/menu/roleMenuTreeselect/900003000000000006` 的 `checkedKeys` 同时包含两个 ID |
| 正例 | `PUT /system/role/dataScope`：`{roleId: 900003000000000006, dataScope: "2", deptIds: [900003000000000001], deptCheckStrictly: true}` | `code=200`；`GET /system/role/deptTree/900003000000000006` 的 `checkedKeys` 含该部门 ID |
| 正例 | `POST /system/dept`：`{parentId: 900003000000000001, deptName: "Spec003 子部门", orderNum: 1, status: "0"}` | `code=200`；`GET /system/dept/list?deptName=Spec003 子部门` 返回 `data` 含该节点且 `parentId` 正确 |
| **反例** | `DELETE /system/menu/<含子节点的目录 ID>`（单删端点） | **HTTP 200、body `code=601`、`msg="存在子菜单,不允许删除"`；目录与子节点均保留** |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版：由 `specs/002-system-management-core/spec.md` US2–US5 与 `data-model.md`、`contracts/backend-api-consumed.md` 断言化生成；承接 `REQ-20261103-002` §7 的后续范围 | 2026-11-04 | 业务：aoyousky（“确认，同意执行后续任务”）；架构：aoyousky（L2） |
| 1.1 | 按 `clarifications/CLAR-008.md` 裁决修正 A-03：`menuCheckStrictly` 由 `true` 改为 `false`（父子联动）。平台在 `menuCheckStrictly=true`（父子不联动）时会从 `checkedKeys` 剔除已分配菜单的父节点，与“两个 ID 均回显”的 Then 互斥；`false` 与 plus-ui 默认及 `menuCheckStrictly` 契约行“`null` 等价 `false`”一致。同步修正 §8 首条正例 | 2026-11-04 | 业务：aoyousky（对话裁决“A”）；架构：aoyousky（L2） |
| 1.2 | 元数据回填：front-matter `pm` 由占位「待指派（CLAR-004 裁决人）」改为 `aoyousky`（依据 `clarifications/CLAR-004.md` 的 PM 裁决记录）。断言、数据契约、Non-goals 均未改动 | 2026-11-05 | PM：aoyousky（CLAR-004 裁决人，历史记录回填） |
| 1.3 | 按 `clarifications/CLAR-009.md` 裁决修正 A-18：接口路径由 `/getRouters` 更正为 `/system/menu/getRouters`；`visible='1'` 的期望由“不出现”改为“以 `hidden=true` 返回且不渲染为可见入口”（平台 `buildMenus` 语义，`platform/` 零改动）；夹具改为断言期间绑定 `spec003_router`，避免与 A-05 的 `allocatedList.total=0` 冲突 | 2026-11-05 | 业务：aoyousky（对话裁决“1A 2A 3A”）；架构：aoyousky（L2） |

> 签字记录：用户于 2026-11-04 在对话中确认“以上方案确认，同意执行后续任务”，即对本 Packet
> 的断言、数据契约、Non-goals 与后端事实完成业务与架构（L2）签字，据此进入实现。
> 签字后如需变更断言，按版本升版并重新签字；`spec.md` 仍是意图来源，交付与验收的唯一依据是本文件。

### FR → A-xx 映射

| 原条目 | 断言 | 状态 |
|---|---|---|
| FR-001 列表/树/筛选/分页/重置 | A-01、A-07、A-10、A-12、E-14、E-27 | 已映射 |
| FR-002 操作后视图与后端一致、失败可理解 | A-02、A-03、A-04、A-05、A-11、E-28 | 已映射 |
| FR-003 权限码控制入口与按钮 | A-09、A-17、E-13、E-25、E-26 | 已映射 |
| FR-004 敏感操作二次确认 | A-17 | 已映射（P1 交互） |
| FR-005 前端校验 + 后端校验 | E-01、E-02、E-15、E-22、§4.7 | 已映射 |
| FR-006 加载/空/失败三态 | A-19、E-14、E-29 | 已映射 |
| FR-014 角色筛选与约定列 | A-01 | 已映射 |
| FR-015 角色新增/编辑/删除/字段 | A-02、A-13、E-01～E-04 | 已映射 |
| FR-016 角色菜单权限树 | A-03、A-14、E-09 | 已映射 |
| FR-017 角色数据权限 | A-04、§6 | 已映射 |
| FR-018 授权/未授权用户 | A-05、E-07、E-08 | 已映射 |
| FR-019 角色启停/导出/保护 | A-06、A-13、E-05～E-08 | 已映射 |
| FR-020 菜单筛选与树形展示 | A-07、E-14 | 已映射 |
| FR-021 菜单类型与字段 | A-08、A-14 | 已映射 |
| FR-022 菜单编辑/删除/级联删除 | A-08、E-10～E-12 | 已映射 |
| FR-023 菜单属性生效 | A-18 | 已映射（P1 E2E + `GET /system/menu/getRouters`） |
| FR-024 部门筛选与树形展示 | A-10、A-15 | 已映射 |
| FR-025 部门新增/编辑/删除/字段 | A-11、E-15～E-21 | 已映射 |
| FR-026 部门循环防护与删除拒绝 | A-10、A-11、E-17～E-20 | 已映射 |
| FR-027 三处部门树一致 | A-10、A-15 | 已映射 |
| FR-028 岗位筛选与约定列 | A-12 | 已映射 |
| FR-029 岗位新增/编辑/删除/字段 | A-12、E-22～E-24 | 已映射 |
| FR-030 岗位导出与用户表单联动 | A-12、A-16 | 已映射 |
| FR-031 被引用岗位保护 | A-12、E-23 | 已映射 |
| FR-007～FR-013 用户管理 | — | 由 `REQ-20261103-002` 覆盖（A-01～A-11），本 Packet 不重复实现 |
| FR-032 数据契约不得前端改变 | §4 数据契约、A-03、A-04、A-10 | 已映射 |
| FR-033 用户-角色/岗位关联一致性 | A-05、A-16 | 已映射 |
| FR-034 文案/枚举/错误结构一致 | A-09、E-26、§4.5 | 已映射 |

### UNVERIFIABLE 清单

本 Packet 无无法判定的行为断言。以下为 P1 人工核对项，不作为 P0 门禁：

| 条目 | 原因 | 建议核对方式 |
|---|---|---|
| 导出文件列顺序 | `spec.md` 只约定列集合，未约定顺序 | 断言列集合包含约定字段；顺序以导出文件为准 |
| 菜单图标选择器视觉 | `spec.md` 只要求可选图标 | 组件测试断言 `icon` 值可写入并可回显，不比对图标资源 |
| 二次确认文案 | 无既有页面文案基线 | 只断言“确认后才发起请求”的行为，不比对文案 |

### 后端事实（实现时不得违背）

1. **菜单写接口双重守卫**：`POST/PUT/DELETE /system/menu` 与 `/system/menu/cascade/*` 除权限码外
   还要求 `superadmin` 角色；`GET /system/menu/list`、`GET /system/menu/{menuId}` 同样要求
   `superadmin` 或租户管理员角色。仅拥有权限码的普通管理员访问返回 `code=403`（A-09）。
2. **级联删除不是后端递归**：`DELETE /system/menu/cascade/{menuIds}` 只删除传入的 ID，且只要
   传入 ID 中任一有子节点就返回 `code=601`。前端必须先收集节点及全部后代 ID 再调用（A-08、E-12）。
3. **单删菜单的两种拒绝**：存在子菜单返回 `code=601`；已分配给角色返回 `code=601`；两者都
   不是 HTTP 错误状态码（E-10、E-11）。
4. **角色删除/停用保护**：`roleId=1` 的删除与状态修改抛业务异常（`code ≠ 200`）；已分配用户的
   角色删除或停用同样被拒绝（A-06、E-05～E-08）。
5. **`menuIds`/`deptIds` 必须传数组**：后端直接遍历该字段；缺省或 `null` 会触发服务端异常。
   前端保存时未选择任何节点必须提交 `[]`（§4.7、E-09）。
6. **部门删除拒绝**：默认部门 `100`、存在下级、存在用户、存在岗位分别返回 `code=601` 与对应
   `msg`；前端展示 `msg`，不做前端推断（E-16～E-19）。
7. **部门上级选择**：后端只拒绝“上级为自己”；“排除自身及后代”由 `GET /system/dept/list/exclude/{deptId}`
   提供候选，前端必须使用该接口（A-10、E-20）。
8. **岗位无独立状态端点**：启停通过 `PUT /system/post` 提交 `status`；被用户引用时停用与删除均
   被拒绝（A-12、E-23、E-24）。

### 新增的 E-xx（由断言化补出）

E-09（空数组清空权限）、E-10（单删子菜单拒绝）、E-11（已分配菜单拒绝）、E-12（级联不递归）、
E-14/E-29（空数组契约）、E-20（上级为自己）、E-21（停用含子部门）、E-25/E-26（统一鉴权）、
E-27（分页超界）、E-28（保存后缓存一致）为 `spec.md` 未逐条覆盖、断言化时补出的边界。

### 新增的 Non-goals（由断言化补出）

- 不保证 DOM/CSS 与 plus-ui 一致。
- 不保证除本 Packet 明确写出的 `msg` 外的拒绝文案逐字一致。
- 不保证大整数 ID 以 number 出现。
- 不重新定义导出列与文件格式。
- 不做菜单拖拽排序与批量导入。
