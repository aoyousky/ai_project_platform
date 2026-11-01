# Phase 1 Data Model：前端视图模型与后端数据类型

**Date**: 2026-11-01 | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/backend-api-consumed.md](./contracts/backend-api-consumed.md)

> 本文件描述**前端持有**的数据结构，以及它们与后端契约的对应关系。后端实体定义以 `platform/` 为准，
> 本文件不改动任何后端契约（FR-013）。

## 1. 通用响应封装

### 1.1 ApiResult\<T\>（单对象响应）

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `code` | number | 否 | 业务码；`200` 为成功，其余为失败 |
| `msg` | string | 否 | 人类可读提示；失败时直接展示给用户（FR-012） |
| `data` | T | 是 | 业务数据；无数据时为 `null` 或省略 |

### 1.2 PagedResult\<T\>（分页响应，RuoYi `TableDataInfo`）

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `code` | number | 否 | 同 1.1 |
| `msg` | string | 否 | 同 1.1 |
| `rows` | T[] | 否 | 当前页数据；无数据时为 `[]`，**不返回 `null`** |
| `total` | number | 否 | 满足条件的总条数（不是总页数） |

**关键约束**：分页响应**没有 `data` 字段**。适配层必须按 `rows` 是否存在分派，否则列表恒为空
（ADR-002 C1，spike 已复现并修复）。

### 1.3 分页请求参数

| 字段 | 类型 | 默认 | 约束 |
|---|---|---|---|
| `pageNum` | number | 1 | ≥ 1，从 1 开始（非 0） |
| `pageSize` | number | 10 | 1–500；超过后端上限按后端返回处理 |

## 2. 用户会话

### 2.1 LoginResult（登录成功）

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `access_token` | string | 否 | 会话令牌；前端以 `Bearer <token>` 放 `Authorization` |
| `expire_in` | number | 否 | 有效期（秒）；前端不据此做本地倒计时，以服务端为准 |

### 2.2 UserInfo（前端展示画像，由 `/system/user/getInfo` 映射）

| 字段 | 来源 | 可空 | 语义 |
|---|---|---|---|
| `userId` | `user.userId` | 否 | 字符串化，避免雪花 ID 精度丢失 |
| `username` | `user.userName` | 否 | 登录名 |
| `realName` | `user.nickName` | 否 | 展示名 |
| `avatar` | `user.avatar` | 是 | 为空时用默认头像 |
| `desc` | `user.dept.deptName` | 是 | 顶部栏副标题；无部门时为空串 |
| `homePath` | 常量 | 否 | 固定 `/index`（FR-015） |
| `roles` | `roles[]` | 否 | 角色码数组，可为空数组 |
| `token` | 常量 | 否 | 固定空串（令牌由 accessStore 管理） |

### 2.3 权限集合

| 字段 | 类型 | 语义 |
|---|---|---|
| `permissions` | string[] | 权限码集合，如 `system:post:add` |
| 通配值 | `*:*:*` | 持有即视为拥有全部权限（FR-007）；判定在 `v-access` 指令内完成 |

## 3. 菜单与路由

### 3.1 MenuNode（后端 `RouterVo`）

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `name` | string | 否 | 路由唯一名；RuoYi 可能生成含 `/`、`:` 的名字（ADR-002 C9） |
| `path` | string | 否 | 内部路径（以 `/` 开头）或完整外链 URL |
| `component` | string | 是 | `Layout` / `ParentView` / `InnerLink` / 视图相对路径 |
| `redirect` | string | 是 | `noRedirect` 是占位值，必须丢弃（C3） |
| `hidden` | boolean | 是 | `true` → `meta.hideInMenu` |
| `children` | MenuNode[] | 是 | 子节点 |
| `meta.title` | string | 否 | 菜单标题 |
| `meta.icon` | string | 是 | plus-ui 的 SVG 资产名，需映射（research R10）；`#` 为占位，丢弃 |
| `meta.noCache` | boolean | 是 | `true` → `keepAlive: false`（语义相反，C4） |
| `meta.link` | string | 是 | 外链地址 |

### 3.2 RouteRecord（前端路由）

| 字段 | 类型 | 语义 |
|---|---|---|
| `path` | string | 必以 `/` 开头；外链合成 `/iframe/<slug>-<hash>`（C2） |
| `name` | string | 与 MenuNode.name 一致 |
| `component` | string \| Component | `Layout`→`BasicLayout`，`ParentView`→占位组件，`IFrameView`→iframe 视图 |
| `meta.hideInMenu` | boolean | 隐藏菜单 |
| `meta.keepAlive` | boolean | 页面缓存 |
| `meta.title` / `meta.icon` | string | 展示 |
| `meta.iframeSrc` | string | **仅外链**：内嵌地址；此时**不得设 `meta.link`** |

### 3.3 外链菜单的路径合成规则

- 输入：`https://gitee.com/dromara/RuoYi-Vue-Plus`
- 输出路径：`/iframe/gitee-com-dromara-ruoyi-vue-plus-hzp6uu`
- 规则：取 URL 去掉协议后的小写字母数字串（非字母数字折叠为 `-`，截断 40 字符）+ djb2 哈希 base36 后缀。
- 稳定性要求：同一 URL 每次得到同一路径（刷新、重新登录不变）。

## 4. 业务数据类型（样例：岗位）

### 4.1 PostVO（列表/详情）

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `postId` | number \| string | 否 | 主键；可能超出 JS 安全整数范围，按 string 处理 |
| `postCode` | string | 否 | 岗位编码，唯一 |
| `postName` | string | 否 | 岗位名称 |
| `postCategory` | string | 否 | 类别编码 |
| `deptId` | number \| string | 是 | 所属部门 |
| `deptName` | string | 是 | 部门名称（列表展示用） |
| `postSort` | number | 否 | 排序，整数 ≥ 0 |
| `status` | string | 否 | 字典 `sys_normal_disable`：`0` 正常 / `1` 停用 |
| `createTime` | string | 是 | `yyyy-MM-dd HH:mm:ss`，**无时区后缀**，按本地时间直出，不做时区换算 |

### 4.2 PostForm（新增/修改）

字段同 4.1，去掉 `deptName`、`createTime`；`postId` 仅在修改时携带。

**校验规则**（前端同校，后端为准）：

| 字段 | 规则 | 失败提示来源 |
|---|---|---|
| `postName` | 必填 | 前端表单校验 |
| `postCode` | 必填 | 前端表单校验 |
| `deptId` | 必填 | 后端返回"部门id不能为空"（spike 已复现），前端必须先行校验避免无谓请求 |
| `postSort` | 整数 ≥ 0 | 前端 |

### 4.3 PostQuery（查询参数）

同 1.3 + `postCode`、`postName`、`postCategory`、`status`、`deptId`，全部可空，空值不参与查询。

### 4.4 DictOption（字典项）

| 字段 | 类型 | 语义 |
|---|---|---|
| `dictLabel` | string | 展示文案 |
| `dictValue` | string | 存储值 |
| `listClass` | string | 样式类（如 `primary`/`danger`） |
| `cssClass` | string | 自定义样式类 |

### 4.5 DeptTreeNode（部门树）

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | number \| string | 节点 ID（树组件的 `valueField`） |
| `label` | string | 节点名称（`labelField`） |
| `children` | DeptTreeNode[] | 子节点（`childrenField`）；叶子节点为 `null` 或省略 |

## 5. 前端本地状态

| 名称 | 存储位置 | 生命周期 | 内容 |
|---|---|---|---|
| `accessStore.accessToken` | localStorage | 登出/401 清除 | 会话令牌 |
| `accessStore.accessCodes` | 内存（登录后填充） | 页面刷新重新拉取 | 权限码集合 |
| `userStore.userInfo` | 内存 | 同上 | 用户画像（2.2） |
| Vben preferences | localStorage | 用户长期 | 主题、语言、布局、标签页 |
| 打开的标签页 | 内存 / sessionStorage | 会话内 | 标签页列表（含 iframe 标签） |

**约束**：任何密钥、私钥、令牌**不得**写入日志、console 或 trace 证据（R3）。
