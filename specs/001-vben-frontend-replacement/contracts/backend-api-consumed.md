# 消费方契约：前端消费的后端接口

**Date**: 2026-11-01 | **Type**: 客户侧契约（前端为消费方，后端为提供方）

> 本文件登记前端实际调用的后端接口。**后端不因本规格改动任何一项**（FR-013）；
> 若某接口的行为与本文不符，按 CLAUDE.md 铁律 2 STOP，不得在前端"将就"实现。

## 0. 通用约定

| 项 | 约定 |
|---|---|
| Base URL | 开发 `VITE_GLOB_API_URL=/api`，由 Vite 代理到后端 8080 |
| 公共请求头 | `Authorization: Bearer <access_token>`、`clientid: <clientId>`、`Accept-Language: zh-CN` |
| 传输加密 | 登录请求体由 AES-256-ECB/PKCS7 加密，AES 密钥经 RSA 加密后放 `encrypt-key` 头；响应若带 `encrypt-key` 头则必须先解密（C7） |
| 成功判定 | 响应体 `code === 200`（不是 HTTP 状态码） |
| 业务失败 | HTTP 200 + `code ≠ 200` + `msg` 人类可读文案；前端直接展示 `msg`（FR-012） |
| 未认证 | `code === 401`（或 HTTP 401）；前端清会话并回登录页（FR-003） |
| 无权限 | `code === 403`；页面内操作提示无权限，路由级由前端拦截（FR-008） |

## 1. 认证

### GET `/auth/code`

- 请求：无
- 响应 `data`：`{ captchaEnabled: boolean, uuid: string, img: string }`
- `img` 为 base64（不含 `data:` 前缀时前端补前缀）
- `captchaEnabled === false` 时登录页隐藏验证码输入

### POST `/auth/login`

- 请求体（加密后传输）：`{ username, password, code, uuid, clientId, grantType: 'password' }`
- 响应 `data`：`{ access_token, expire_in }`
- 失败：`code ≠ 200`，`msg` 如"验证码错误"
- **禁止**：前端自行生成或缓存验证码（一次性）

### POST `/auth/logout`

- 请求：无
- 响应：`{ code: 200, msg }`
- 语义：服务端注销令牌；前端无论成败都清本地会话（FR-004）

## 2. 用户与权限

### GET `/system/user/getInfo`

- 响应 `data`：

  ```jsonc
  {
    "user": {
      "userId": 1, "userName": "admin", "nickName": "超级管理员",
      "avatar": "", "dept": { "deptId": 103, "deptName": "研发部门" }
    },
    "roles": ["superadmin"],
    "permissions": ["*:*:*"]
  }
  ```

- 约束：`permissions` 可能为空数组；`dept` 可能为 `null`
- 超管通配：`permissions` 含 `*:*:*` 时，前端按钮级校验一律放行（FR-007）

## 3. 菜单

### GET `/system/menu/getRouters`

- 响应 `data`：`MenuNode[]`（结构见 [data-model.md §3.1](../data-model.md)）
- 观测数据（2026-11-01 本地栈）：48 节点 / 39 个叶子；1 个外链节点
- 已知特殊值：
  - `path` 为完整 URL（外链）→ 合成 `/iframe/...`（C2）
  - `redirect: 'noRedirect'` → 丢弃（C3）
  - `meta.icon: '#'` → 丢弃
  - `meta.noCache` → `keepAlive: !noCache`（C4）

## 4. 字典

### GET `/system/dict/data/type/{dictType}`

- 响应 `data`：`DictOption[]`（`dictLabel` / `dictValue` / `listClass` / `cssClass`）
- 使用：`sys_normal_disable`（`0` 正常 / `1` 停用）
- 失败：按业务失败处理，不影响页面主体可用性（列表仍可加载）

## 5. 岗位（样例页）

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/system/post/list` | `pageNum`、`pageSize` + 查询条件 | `PagedResult<PostVO>`（`rows` + `total`） |
| GET | `/system/post/{postId}` | 路径参数 | `ApiResult<PostVO>` |
| POST | `/system/post` | `PostForm` | `ApiResult<null>` |
| PUT | `/system/post` | `PostForm`（含 `postId`） | `ApiResult<null>` |
| DELETE | `/system/post/{postIds}` | 逗号分隔或单值 | `ApiResult<null>` |
| GET | `/system/post/deptTree` | 无 | `ApiResult<DeptTreeNode[]>` |

**已踩坑（不得回归）**：

1. `list` 的分页数据在 `rows`，不在 `data`（C1）。
2. 新增时缺少 `deptId` 后端返回"部门id不能为空"——前端必须先把 `deptId` 做成必填（data-model §4.2）。
3. 删除接口参数是路径段，批量删除用逗号拼接，不是请求体数组。

## 6. 权限码（样例页）

| 操作 | 权限码 |
|---|---|
| 查看列表 | `system:post:list` |
| 新增 | `system:post:add` |
| 修改 | `system:post:edit` |
| 删除 | `system:post:remove` |
| 导出 | `system:post:export`（页面未移植导出时不使用） |

## 7. 契约校验方式

- **静态**：`platform/` 的 OpenAPI 文档（若暴露）与本文路径逐条比对，CI 脚本检查缺失/多余。
- **动态**：E2E 真实调用上述 6 组接口，断言响应结构与本文一致（字段存在性 + 类型 + 分页形态）。
- **变更处置**：后端若变更任一字段，先 STOP；经 PM 裁决后同步升版本文与 `data-model.md`。
