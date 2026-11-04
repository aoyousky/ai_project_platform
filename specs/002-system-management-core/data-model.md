# Data Model: REQ-002 系统管理核心

**Date**: 2026-11-03 | **Plan**: [plan.md](./plan.md) | **Contract source**: `platform/` VO / BO

> 本文件是前端类型契约，不是数据库模型。字段名、可空性、枚举值以 RuoYi-Vue-Plus 后端
> `Sys*Vo` / `Sys*Bo` / `Hutool Tree` 的实际序列化结果为准。旧 plus-ui 类型仅作交互参考，
> **不得**把后端已不返回的 `delFlag`、`admin`、`parentName` 等字段写进实现。

## 1. 共享类型

```ts
/** 雪花 ID 可能被 BigNumberSerializer 序列化为 number 或 string。 */
export type Id = number | string;

/** RuoYi PageQuery 的入参。 */
export interface PageQuery {
  pageNum?: number;
  pageSize?: number;
  orderByColumn?: string;
  isAsc?: 'asc' | 'desc';
}

/** 分页响应：requestClient 把 {code,msg,rows,total} 解析为 {rows,total}。 */
export interface PageResult<T> {
  rows: T[];
  total: number;
}

/** 日期范围由 BaseEntity.params 承载；Axios 序列化为 params[beginTime]。 */
export interface DateRangeParams {
  beginTime?: string;
  endTime?: string;
}

/** 审计字段（五个 VO 共同返回的只有 createTime）。 */
export interface AuditFields {
  createTime?: string | null;
}

/** 字典数据（GET /system/dict/data/type/{dictType}）。 */
export interface DictData {
  dictCode: Id;
  dictSort: number;
  dictLabel: string;
  dictValue: string;
  dictType: string;
  cssClass?: null | string;
  listClass?: null | string;
  isDefault?: null | string;
  remark?: null | string;
  createTime?: null | string;
}
```

**响应形态**

| 端点类型 | 适配层解析结果 |
|---|---|
| `R<T>` | `T`（`body.data`） |
| `TableDataInfo<T>` | `PageResult<T>`（`body.rows` / `body.total`） |
| 文件下载 | `AxiosResponse`（`responseReturn: 'raw'`） |

## 2. 用户（User）

### 2.1 UserVO（`SysUserVo`）

```ts
export interface UserVO extends AuditFields {
  userId: Id;
  tenantId?: null | string;
  deptId?: Id | null;
  userName: string;
  nickName: string;
  userType?: null | string;
  /** 敏感字段：无 system:user:edit 时后端返回掩码。 */
  email?: null | string;
  /** 敏感字段：无 system:user:edit 时后端返回掩码。 */
  phonenumber?: null | string;
  /** '0' 男 / '1' 女 / '2' 未知 */
  sex?: null | string;
  /** OSS ID 经 @Translation 转成 URL；未设置头像时为 null。 */
  avatar?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
  loginIp?: null | string;
  loginDate?: null | string;
  remark?: null | string;
  deptName?: null | string;
  roles?: null | RoleVO[];
  roleIds?: Id[] | null;
  postIds?: Id[] | null;
  roleId?: Id | null;
}
```

说明：
- `password` 在后端为 `@JsonIgnore`，前端类型不声明。
- `userId`、`deptId`、`roleIds[]`、`postIds[]` 均可能为数字或字符串，比较/树 key 必须归一化。
- `avatar` 声明为 `Long` 但带 `@Translation(type = OSS_ID_TO_URL)`，运行期按 URL 字符串处理。

### 2.2 UserInfoVO（`SysUserInfoVo`）

`GET /system/user/{userId}`、`GET /system/user/authRole/{userId}` 与无 ID 的
`GET /system/user/` 共用该结构。

```ts
export interface UserInfoVO {
  /** 无 userId 的“新增预处理”请求返回 null。 */
  user?: null | UserVO;
  roleIds?: Id[];
  roles?: RoleVO[];
  postIds?: Id[];
  posts?: PostVO[];
}
```

- `authRole` 返回的 `roles[]` 用 `flag` 标记当前用户是否已拥有该角色。
- 无 ID 的 `GET /system/user/` 用于新增前加载 `roles`、`posts` 选项；不得在前端硬编码初始密码。

### 2.3 UserForm

```ts
export interface UserForm {
  userId?: Id;
  deptId?: Id | null;
  userName: string;
  nickName: string;
  email?: null | string;
  phonenumber?: null | string;
  /** '0' 男 / '1' 女 / '2' 未知 */
  sex?: null | string;
  /** 仅新增时提交；编辑态不出现。 */
  password?: null | string;
  status?: null | string;
  remark?: null | string;
  roleIds?: Id[] | null;
  postIds?: Id[] | null;
}
```

### 2.4 UserQuery

```ts
export interface UserQuery extends PageQuery {
  userId?: Id;
  deptId?: Id;
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  status?: string;
  /** 角色授权页的已授权/未授权用户列表使用。 */
  roleId?: Id;
  params?: DateRangeParams;
}
```

### 2.5 ResetPwdForm / Import 参数

```ts
export interface ResetPwdForm {
  userId: Id;
  password: string;
}

export interface UserImportParams {
  file: File;
  /** 是否更新已存在用户数据。 */
  updateSupport: boolean;
}
```

## 3. 角色（Role）

### 3.1 RoleVO（`SysRoleVo`）

```ts
export interface RoleVO extends AuditFields {
  roleId: Id;
  roleName: string;
  roleKey: string;
  roleSort: number;
  /** '1' 全部 / '2' 自定义 / '3' 本部门 / '4' 本部门及以下 / '5' 仅本人 / '6' 部门及以下或本人 */
  dataScope?: null | string;
  menuCheckStrictly?: boolean | null;
  deptCheckStrictly?: boolean | null;
  /** '0' 正常 / '1' 停用 */
  status: string;
  remark?: null | string;
  /** 用户授权页：true 表示当前用户已拥有该角色。 */
  flag?: boolean;
  /** 后端 isSuperAdmin() 派生字段。 */
  superAdmin?: boolean;
}
```

### 3.2 RoleForm

```ts
export interface RoleForm {
  roleId?: Id;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope?: null | string;
  status?: null | string;
  remark?: null | string;
  menuIds?: Id[];
  menuCheckStrictly?: boolean;
  deptIds?: Id[];
  deptCheckStrictly?: boolean;
}
```

### 3.3 RoleQuery

```ts
export interface RoleQuery extends PageQuery {
  roleId?: Id;
  roleName?: string;
  roleKey?: string;
  status?: string;
  params?: DateRangeParams;
}
```

### 3.4 授权用户

```ts
export interface AuthUserQuery extends UserQuery {
  roleId: Id;
}

export interface AuthUserCancel {
  roleId: Id;
  userId: Id;
}

export interface AuthUserBatch {
  roleId: Id;
  /** 后端以逗号分隔的 Long[] 绑定 query 参数。 */
  userIds: Id[];
}
```

## 4. 菜单（Menu）

### 4.1 MenuVO（`SysMenuVo`）

```ts
export interface MenuVO extends AuditFields {
  menuId: Id;
  menuName: string;
  parentId: Id;
  orderNum: number;
  path?: null | string;
  component?: null | string;
  queryParam?: null | string;
  /** '0' 是（外链） / '1' 否 */
  isFrame?: null | string;
  /** '0' 缓存 / '1' 不缓存（后端以 "1" 判定 noCache） */
  isCache?: null | string;
  /** 'M' 目录 / 'C' 菜单 / 'F' 按钮 */
  menuType: string;
  /** '0' 显示 / '1' 隐藏 */
  visible: string;
  /** '0' 正常 / '1' 停用 */
  status: string;
  perms?: null | string;
  icon?: null | string;
  /** SysMenuVo 显式声明；其他四个 VO 不返回。 */
  createDept?: Id | null;
  remark?: null | string;
  children?: MenuVO[];
}
```

- `/system/menu/list` 返回 **flat list**（`children` 通常为空数组或缺失）；树由前端构建。
- `remark` 在隐藏菜单场景兼作“激活路由”（后端 `MetaVo` 第五参数），表单标签为“激活路由”；
  值需以 `/` 开头才生效。

### 4.2 MenuForm

```ts
export interface MenuForm {
  menuId?: Id;
  parentId: Id;
  menuName: string;
  orderNum: number;
  /** 目录/菜单必填；按钮可为空。 */
  path?: null | string;
  component?: null | string;
  queryParam?: null | string;
  isFrame?: null | string;
  isCache?: null | string;
  menuType: 'C' | 'F' | 'M';
  visible?: null | string;
  status?: null | string;
  perms?: null | string;
  icon?: null | string;
  /** 隐藏菜单的激活路由。 */
  remark?: null | string;
}
```

### 4.3 MenuQuery

```ts
export interface MenuQuery {
  menuId?: Id;
  parentId?: Id;
  menuName?: string;
  visible?: string;
  status?: string;
  menuType?: string;
}
```

### 4.4 菜单树（`/treeselect`、`/roleMenuTreeselect/{roleId}`）

```ts
export interface MenuTreeOption {
  id: Id;
  parentId: Id;
  /** Hutool TreeNodeConfig.nameKey 被改为 label。 */
  label: string;
  weight?: number;
  menuType?: string;
  icon?: null | string;
  visible?: string;
  status?: string;
  children?: MenuTreeOption[];
}

export interface RoleMenuTree {
  checkedKeys: Id[];
  menus: MenuTreeOption[];
}
```

## 5. 部门（Dept）

### 5.1 DeptVO（`SysDeptVo`）

```ts
export interface DeptVO extends AuditFields {
  deptId: Id;
  parentId: Id;
  parentName?: null | string;
  /** 祖级列表，如 "0,100,101"。 */
  ancestors?: null | string;
  deptName: string;
  deptCategory?: null | string;
  orderNum: number;
  leader?: Id | null;
  leaderName?: null | string;
  phone?: null | string;
  email?: null | string;
  /** '0' 正常 / '1' 停用 */
  status: string;
  children?: DeptVO[];
}
```

- `/system/dept/list` 返回 **flat list**；树由前端构建。
- `parentName` 在 `SysDeptVo` 中存在，但列表接口不保证填充；页面展示以 `deptName` 树层级为准。

### 5.2 DeptForm

```ts
export interface DeptForm {
  deptId?: Id;
  parentId?: Id;
  deptName: string;
  deptCategory?: null | string;
  orderNum: number;
  leader?: Id | null;
  phone?: null | string;
  email?: null | string;
  status?: null | string;
}
```

### 5.3 DeptQuery

```ts
export interface DeptQuery {
  deptId?: Id;
  parentId?: Id;
  /** 部门子树筛选（SysDeptBo.belongDeptId）。 */
  belongDeptId?: Id;
  deptName?: string;
  deptCategory?: string;
  status?: string;
  params?: DateRangeParams;
}
```

### 5.4 部门树（`/system/user/deptTree`、`/system/post/deptTree`、`/system/role/deptTree/{roleId}`）

```ts
export interface DeptTreeOption {
  id: Id;
  parentId: Id;
  label: string;
  weight?: number;
  /** 后端按 status='1' 计算，详见 SysDeptServiceImpl.buildDeptTreeSelect。 */
  disabled?: boolean;
  children?: DeptTreeOption[];
}

export interface RoleDeptTree {
  checkedKeys: Id[];
  depts: DeptTreeOption[];
}
```

## 6. 岗位（Post）

### 6.1 PostVO（`SysPostVo`）

```ts
export interface PostVO extends AuditFields {
  postId: Id;
  deptId: Id;
  postCode: string;
  postName: string;
  postCategory?: null | string;
  postSort: number;
  /** '0' 正常 / '1' 停用 */
  status: string;
  remark?: null | string;
  deptName?: null | string;
}
```

### 6.2 PostForm

```ts
export interface PostForm {
  postId?: Id;
  deptId: Id;
  postCode: string;
  postName: string;
  postCategory?: null | string;
  postSort: number;
  status?: null | string;
  remark?: null | string;
}
```

### 6.3 PostQuery

```ts
export interface PostQuery extends PageQuery {
  postId?: Id;
  deptId?: Id;
  /** 部门子树筛选。 */
  belongDeptId?: Id;
  postCode?: string;
  postName?: string;
  postCategory?: string;
  status?: string;
}
```

## 7. 状态与枚举

| 字段 | 允许值 | 来源 |
|---|---|---|
| `status` | `'0'` 正常 / `'1'` 停用 | 字典 `sys_normal_disable` |
| `sex` | `'0'` 男 / `'1'` 女 / `'2'` 未知 | 字典 `sys_user_sex` |
| `visible` | `'0'` 显示 / `'1'` 隐藏 | 字典 `sys_show_hide` |
| `isFrame` | `'0'` 是 / `'1'` 否 | 固定单选项（plus-ui 既有行为）/ `SystemConstants.YES_FRAME` |
| `isCache` | `'0'` 缓存 / `'1'` 不缓存 | 固定单选项；后端以 `"1".equals(isCache)` 判定 noCache |
| `menuType` | `'M'` 目录 / `'C'` 菜单 / `'F'` 按钮 | 后端 `SystemConstants.TYPE_*` |
| `dataScope` | `'1'` 全部 / `'2'` 自定义 / `'3'` 本部门 / `'4'` 本部门及以下 / `'5'` 仅本人 / `'6'` 部门及以下或本人 | 旧 plus-ui 固定选项，后端 `SysRoleBo.dataScope` |

**日期**：全部为 `yyyy-MM-dd HH:mm:ss` 字符串；后端 Jackson 全局配置保证。

## 8. 前端校验规则（最终以后端 `@Validated` 为准）

| 表单 | 字段 | 前端规则 | 后端约束 |
|---|---|---|---|
| User | `userName` | 必填，2–30 | `@NotBlank`、`@Size(min=2,max=30)` |
| User | `nickName` | 必填，≤30 | `@NotBlank`、`@Size(max=30)` |
| User | `email` | 邮箱格式，≤50 | `@Email`、`@Size(max=50)` |
| User | `password` | 新增必填，5–20，不含尖括号、引号、反斜杠、竖线 | 后端无注解；规则来自 plus-ui 既有行为 |
| User | `roleIds` | 至少 1 项（编辑自己时不提交） | `@Size(min=1)` |
| Role | `roleName` | 必填，≤30 | `@NotBlank`、`@Size(max=30)` |
| Role | `roleKey` | 必填，≤100 | `@NotBlank`、`@Size(max=100)` |
| Role | `roleSort` | 必填，整数 ≥ 0 | `@NotNull` |
| Menu | `menuName` | 必填，≤50 | `@NotBlank`、`@Size(max=50)` |
| Menu | `orderNum` | 必填 | `@NotNull` |
| Menu | `path` | 目录/菜单必填，≤200 | `@Size(max=200)` |
| Menu | `component` | ≤200 | `@Size(max=200)` |
| Menu | `perms` | 匹配 `tool:build:list` 形式，≤100 | `@Pattern(RegexConstants.PERMISSION_STRING)` |
| Menu | `menuType` | 必填 | `@NotBlank` |
| Dept | `deptName` | 必填，≤30 | `@NotBlank`、`@Size(max=30)` |
| Dept | `orderNum` | 必填 | `@NotNull` |
| Dept | `deptCategory` | ≤100 | `@Size(max=100)` |
| Dept | `phone` | 11 位手机号 | `@Size(max=11)` |
| Dept | `email` | 邮箱格式，≤50 | `@Email`、`@Size(max=50)` |
| Post | `deptId` | 必填 | `@NotNull` |
| Post | `postCode` | 必填，≤64 | `@NotBlank`、`@Size(max=64)` |
| Post | `postName` | 必填，≤50 | `@NotBlank`、`@Size(max=50)` |
| Post | `postSort` | 必填 | `@NotNull` |
| Post | `postCategory` | ≤100 | `@Size(max=100)` |

> 前端校验不得替代后端校验；后端返回 `msg` 时页面必须原样展示并保留表单输入。

## 9. 空值与序列化注意事项

1. **ID 类型漂移**：`BigNumberSerializer` 对超出 ±`9007199254740991` 的 `Long` 输出字符串，否则输出数字。
   所有 ID 比较使用 `String(id)`；树构建使用字符串 key。
2. **敏感字段**：`email`、`phonenumber` 在无 `system:user:edit` 权限时被 `@Sensitive` 掩码。前端不得
   尝试“还原”；编辑按钮本身受 `system:user:edit` 控制。
3. **日期**：后端输出格式化字符串，前端不再用 `new Date()` 解析后再格式化，避免时区偏移。
4. **空集合**：`children`、`roles`、`roleIds`、`postIds` 等可能缺失或为 `null`；渲染前统一 `?? []`。
5. **密码**：任何接口都不返回明文密码；`ResetPwdForm` 只提交新密码，且请求必须带 `isEncrypt` 头。
