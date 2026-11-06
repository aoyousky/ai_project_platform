---
id: REQ-20261101-001
title: 前端框架替换（Vben 前端外壳）
version: 1.2
risk_level: L2
channel: ai_forced_review
pm: 产品负责人（CLAR-001 裁决人）
business_signoff: Tim Dong
arch_reviewer: 张建魁（架构师）
target_window: 2026-11-03 ~ 2026-11-28
speckit_feature: specs/001-vben-frontend-replacement
---

# Spec Packet：前端框架替换（Vben 前端外壳）

> 本文件是**交付与验收的唯一依据**。`specs/001-vben-frontend-replacement/spec.md` 只是意图来源；
> 两者冲突时以本文件为准，并按升版流程更新 version。

## 1. 意图

- **业务目标（含量化指标）**：把 `frontend/` 的 plus-ui 替换为 Vben Admin 5.7.0（`apps/web-antdv-next`），
  在不改动后端的前提下，使后端配置的全部菜单在新前端 100% 可达，`system/post` 等标准 CRUD 页面行为与原系统一致。
- **调用方 / 场景 / 频率**：平台内部用户（运营、业务、管理员），PC 浏览器，日常办公频率（每人每日多次登录与页面操作）。
- **上线后回顾指标（不计入 DoD）**：交付后 30 天内"前端无法登录 / 菜单缺失 / 按钮不显示"类工单数为 0
  （CLAR-002 第 2 项裁决：滞后指标，交付时不可验证，转为上线回顾）。
- **DoD 内可验证指标**：菜单可达率 100%；越权按钮可见率 0%；后端接口变更数 0；页面崩溃 0（E2E 断言）。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 后端可用，账号具备登录权限，验证码刚获取 | 以 AES 加密体调用 `POST /auth/login`（含 `uuid` + `code`） | 响应 `code = 200` 且 `data.access_token` 为非空字符串；前端在 5s 内跳到 `/index` |
| A-02 | P0 | 验证码已过期或错误 | 提交登录 | 响应 `code ≠ 200` 且 `msg` 非空；页面停留 `/auth` 并显示该 `msg`；验证码图片 `src` 前后不同；用户名输入值不变 |
| A-03 | P0 | `admin` 已登录，后端 `getRouters` 返回 48 节点 / 39 个叶子 | 打开首页 | 侧栏渲染的后端菜单节点数 = 后端非 `hidden` 节点数；路由单测断言 48 节点全部解析成功、`duplicate_names = 0`、`noRedirect_left = 0` |
| A-04 | P0 | 账号 `permissions` 含 `*:*:*` | 打开 `/system/post` | DOM 中同时存在文案为"新增"与"删除"（工具栏批量删除）的按钮 |
| A-05 | P0 | 普通账号 `permissions` 不含 `system:post:add` | 打开 `/system/post`，再直接访问未授权地址 `/system/menu` | 页面内不存在"新增"按钮；访问 `/system/menu` 落 403 或 404 页面（URL 匹配 `/(403\|404)` 或渲染 forbidden 组件），不渲染业务页面 |
| A-06 | P0 | 后端 `/system/post/list` 返回 `{code:200, rows:[...], total:N}` | 打开 `/system/post` | 表格总数显示 = `N`；`pageSize = 10` 时渲染行数 = `min(N, 10)` |
| A-07 | P0 | `admin` 已登录且具备岗位全权限 | 新增（岗位名称 + 编码 + 部门）→ 列表可见 → 修改名称 → 勾选并批量删除 | 四步响应均 `code = 200`；最终列表不含该岗位编码；分页 `total` 与操作前后差值一致 |
| A-08 | P0 | 交付分支相对 `main` | 执行 `git diff --stat main...HEAD -- platform/` | 输出为空（后端零改动） |
| A-09 | P1 | 已登录 | 点击退出登录，随后按浏览器后退 | URL 落到 `/auth`；`localStorage` 中令牌值被清空；后退后不出现已登录界面（无侧栏与用户信息） |
| A-10 | P1 | 会话令牌已失效 | 触发任一受保护接口请求 | 响应 `code = 401`；前端跳转 `/auth`；页面无空白且无未捕获异常 |
| A-11 | P1 | 后端菜单含一项 `path = https://gitee.com/dromara/RuoYi-Vue-Plus` | 点击该菜单 | URL 形如 `/iframe/<slug>-<hash>`；存在 `iframe[src="https://gitee.com/dromara/RuoYi-Vue-Plus"]`；点击其他菜单仍可正常跳转 |
| A-12 | P1 | 已登录且位于 `/system/post` | 刷新浏览器 | URL 仍为 `/system/post`；页面渲染出"岗位编码"表头；无 401 跳转 |
| A-13 | P1 | 已存在岗位编码 `X` | 用同一编码 `X` 再次新增 | 界面展示后端 `msg` 原文；DOM 中不出现 `Request failed` 字样与堆栈文本 |
| A-14 | P1 | 后端返回的菜单中包含一条与其他节点重名的 `name` | 登录并打开首页 | 其余菜单全部渲染；浏览器无未捕获异常（`pageerror` 计数 = 0） |
| A-15 | P2 | 已登录 | 切换为深色主题后刷新页面 | `localStorage` 中主题偏好值保持为深色；刷新后 body 主题类名仍为深色 |
| A-16 | P2 | 后端 `getRouters` 返回空数组 | 登录 | 落在 `/index` 且首页渲染成功；`pageerror` 计数 = 0；侧栏仅有前端常量菜单 |

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 验证码过期后提交 | 响应 `code ≠ 200`；验证码重新请求 `/auth/code`（网络面板出现新请求）；用户名输入值保持 |
| E-02 | `/auth/code` 返回 `captchaEnabled = false` | 登录表单不渲染验证码输入与图片；登录请求体不含 `code`、`uuid` 字段 |
| E-03 | `getRouters` 返回 `[]` | 侧栏仅常量菜单；首页可用；无 500 提示 |
| E-04 | 菜单 `hidden = true` | 侧栏不出现该项；直接访问其路径仍可渲染页面 |
| E-05 | 菜单 `meta.noCache = true` | 路由 `meta.keepAlive === false`（单测断言） |
| E-06 | 菜单 `redirect = "noRedirect"` | 生成的 route 不含 `redirect` 字段（单测断言） |
| E-07 | 菜单 `meta.icon = "#"` | 生成的 route `meta` 不含 `icon` 字段（单测断言） |
| E-08 | 外链站点返回 `X-Frame-Options: DENY` | iframe 区域空白但整个应用不崩溃；其他菜单可点击；无 `pageerror` |
| E-09 | 菜单指向尚未移植的组件 | 显示统一占位页；侧栏其余菜单可用 |
| E-10 | 分页返回 `rows = []` | 表格显示空态；`total = 0`；无异常提示 |
| E-11 | 分页返回 `total = 0` | 表格空态；分页器页码为 0 或隐藏，不出现 `NaN` |
| E-12 | 页面同时发出多个请求且令牌失效 | 只执行一次跳转 `/auth`；不出现重复跳转或循环 |
| E-13 | `/auth/logout` 请求失败 | 本地会话仍被清除并跳 `/auth` |
| E-14 | 登录按钮连续点击 3 次 | 只发出 1 个 `POST /auth/login` 请求 |
| E-15 | 新增岗位时后端返回业务错误 | 展示后端 `msg`；弹窗保持打开，已填内容不丢失 |
| E-16 | 新增岗位未选择部门直接确认 | 前端表单校验拦截，网络面板不出现 `POST /system/post` |
| E-17 | 路由 `name` 含 `/` 与 `:`（如 `User-auth/role/:userId131`） | 路由注册成功且无重名告警（单测断言） |
| E-18 | 后端返回 HTTP 500 | 展示 `msg` 或通用错误提示；页面不白屏；无堆栈文本 |
| E-19 | 历史富文本内容含 quill 专用类（`ql-align-center`、`ql-size-large`） | 详情渲染时居中与字号仍然生效（兼容样式生效）；文本内容与原文一致 |

## 4. 数据契约

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `code` | number | 否 | — | 业务码；`200` 成功；`401` 未认证；`403` 无权限 |
| `msg` | string | 否 | 失败时必有 | 人类可读文案，前端原样展示 |
| `data` | object \| null | 是 | 无数据 | 单对象响应的业务数据 |
| `rows` | array | 否 | 空数组，不为 `null` | 分页响应的数据数组 |
| `total` | number | 否 | `0` | 总条数（非总页数） |
| `access_token` | string | 否 | — | 登录令牌；请求头 `Authorization: Bearer <token>` |
| `permissions` | string[] | 否 | 空数组 | 权限码集合；`*:*:*` 表示全部权限 |
| `user.userId` | number | 否 | — | 前端存为 string，避免精度丢失 |
| `user.avatar` | string | 是 | 空串 → 默认头像 | — |
| `user.dept.deptName` | string | 是 | `null` → 顶部副标题为空 | — |
| `MenuNode.path` | string | 否 | — | 内部路径以 `/` 开头；外链为完整 URL |
| `MenuNode.redirect` | string | 是 | `noRedirect` 为占位，必须丢弃 | — |
| `MenuNode.meta.noCache` | boolean | 是 | 缺省 `false` | 映射为 `keepAlive = !noCache` |
| `MenuNode.meta.icon` | string | 是 | `#` 为占位，丢弃 | 需经映射表转 iconify 名称 |
| `PostVO.postId` | number \| string | 否 | — | 可能超出 JS 安全整数，按 string 处理 |
| `PostVO.postSort` | number | 否 | — | 整数 ≥ 0 |
| `PostVO.status` | string | 否 | — | 字典 `sys_normal_disable`：`0` 正常 / `1` 停用 |
| `PostVO.createTime` | string | 是 | — | `yyyy-MM-dd HH:mm:ss`，无时区后缀，按本地时间直出 |

时区与精度：时间字段一律不做时区换算；金额类字段本期不涉及。

## 5. 非功能约束

- **性能口径**：登录后首页可交互（`load` 后首屏可点击）≤ 3s（本地 Docker 栈、Edge 最新版）；
  **登录请求往返（前端发起至收到响应）≤ 2s**；页面路由切换 ≤ 500ms（不含接口耗时）；生产构建产物 ≤ 8MB。
  > 原 spec SC-001"熟练用户 60 秒完成登录"含人工输入验证码，已按 CLAR-002 第 1 项裁决移出断言，
  > 改为 [quickstart.md](./001-vben-frontend-replacement/quickstart.md) 的 VS-1 手工验收项。
- **安全（鉴权 / 脱敏字段）**：登录请求体必须加密传输（AES-256-ECB/PKCS7，密钥经 RSA 加密放 `encrypt-key` 头）；
  响应带 `encrypt-key` 头时必须解密；密钥不得出现在日志、console 或 trace 证据中；
  外链 iframe 的 `sandbox` 不含 `allow-top-navigation`；未授权路由默认拒绝。
- **合规（留痕 / 审计）**：登录、登出、增删改操作的请求由后端既有审计承接，前端不额外落盘敏感信息。
- **可观测（必须输出的日志/trace 字段）**：前端错误日志必须含 `timestamp`、`level`、`url`、`message`；
  接口失败日志必须含 `code` 与 `msg`，不得包含令牌或密钥。

## 6. 状态流转（如涉及）

| 当前状态 | 事件 | 下一状态 | 非法迁移的拒绝行为 |
|---|---|---|---|
| 未登录 | 登录成功 | 已登录 | — |
| 未登录 | 访问受保护路由 | 未登录 | 重定向 `/auth`，不渲染业务页面 |
| 已登录 | 令牌失效（401） | 未登录 | 清会话 + 跳 `/auth`，仅跳转一次 |
| 已登录 | 主动登出 | 未登录 | 清本地会话后跳 `/auth`，即使登出接口失败 |
| 已登录 | 访问未授权路由 | 已登录 | 渲染 403/404，不渲染业务页面 |

## 7. Non-goals（必填）

- **本期不做**：
  - 不修改 `platform/` 任何文件（含接口、字段、错误码、权限码展开方式）。
  - 不新增业务功能；不重做页面信息架构与视觉设计。
  - 不移植工作流与任务页面（`workflow/*`、`task/*`，共 9 页），另立需求。
  - 不启用多租户（`tenant/*` 页面仅保留菜单，页面按 403 处理）。
  - 不做移动端 / 响应式专项适配。
  - 不新增语言包与翻译文案。
  - 不为外链站点做代理、自动降级或内嵌失败后的自动新窗口跳转。
  - 不搬运 plus-ui 的 36 个 SVG 图标资产；统一用 iconify（lucide）映射表，未知图标回退 `lucide:circle`
    （CLAR-002 第 3 项裁决）。
  - 富文本页面的人工回归只覆盖两类：通知公告详情、含富文本字段的页面；其余页面不逐页回归
    （CLAR-002 第 4 项裁决）。
- **不兼容**：
  - 不保证旧版 IE / Edge Legacy。
  - 不保证 plus-ui 的 URL 结构完全一致（外链菜单路径由 `/` 起始的外部 URL 变为 `/iframe/<slug>-<hash>`）。
  - 富文本编辑器由 quill 换为 tiptap，产出 HTML 结构不保证逐字节一致；历史内容的 `ql-*` 类由兼容样式承接（E-19）。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | 登录请求：`{username:"admin", password:"***", code:"1234", uuid:"ab12", clientId:"e5cd...", grantType:"password"}` | 请求头含 `encrypt-key`，请求体为 AES 密文；响应 `code=200`，`data.access_token` 非空 |
| 正例 | 菜单节点：`{name:"Post", path:"post", component:"system/post/index", redirect:"noRedirect", meta:{title:"岗位管理", noCache:false}}` | 生成 route：`{name:"Post", path:"post", component:"system/post/index", meta:{title:"岗位管理", keepAlive:true, hideInMenu:false}}`，无 `redirect` 字段 |
| 正例 | 分页响应：`{code:200, msg:"查询成功", rows:[{postId:1,...}], total:1}` | 表格渲染 1 行、总数 1；`requestClient.get` 返回 `{rows, total}` |
| **反例** | 菜单节点：`{name:"Plus", path:"https://gitee.com/dromara/RuoYi-Vue-Plus", component:"Layout", meta:{title:"PLUS官网", link:"https://gitee.com/dromara/RuoYi-Vue-Plus"}}` | **必须被正确拒绝**：不得以原 `path` 进入路由表；必须转换为 `path:"/iframe/<slug>-<hash>"`、`component:"IFrameView"`、`meta.iframeSrc` 为原 URL，且**不含 `meta.link`** |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版，由 `specs/001-vben-frontend-replacement/spec.md` 断言化生成 | 2026-11-01 | 架构：张建魁（2026-11-01 指派） |
| 1.1 | CLAR-002 第 1–5 项裁决回写：SC-001 移出断言（改手工验收，补登录往返 ≤2s）；SC-008 转上线回顾指标；图标定 lucide 映射不搬 SVG；富文本接受 tiptap + `ql-*` 兼容样式（新增 E-19） | 2026-11-01 | 架构：张建魁；业务：Tim Dong |
| 1.2 | CLAR-010 回写：A-04 的 Then 文案由"批量删除"更正为"删除（工具栏批量删除）"，与 plus-ui 上游实现及当前五个系统页面一致；断言语义（新增+批量删除两类按钮均可见）不变 | 2026-11-06 | PM：aoyousky；架构追认：待张建魁确认（L2 升版） |

### FR → A-xx 映射

| 原条目 | 断言 | 状态 |
|---|---|---|
| FR-001 登录入口 | A-01、A-02 | 已映射 |
| FR-002 传输加密 | A-01、Golden Sample 1 | 已映射 |
| FR-003 令牌失效回登录 | A-10、E-12 | 已映射 |
| FR-004 登出清会话 | A-09、E-13 | 已映射 |
| FR-005 菜单来自后端 | A-03 | 已映射 |
| FR-006 菜单结构还原 | A-03、E-04、E-05、E-06、E-07 | 已映射 |
| FR-007 通配权限 | A-04、A-05 | 已映射 |
| FR-008 未授权路由拦截 | A-05、状态流转表 | 已映射 |
| FR-009 外链内嵌 | A-11、E-08 | 已映射 |
| FR-010 单条异常隔离 | A-14、E-03、E-09 | 已映射 |
| FR-011 分页解析 | A-06、E-10、E-11 | 已映射 |
| FR-012 错误文案原样展示 | A-13、E-15、E-18 | 已映射 |
| FR-013 后端零改动 | A-08 | 已映射 |
| FR-014 每页自动化测试 | A-07 及 `/speckit-tasks` T039–T044 | 已映射（过程性） |
| FR-015 首页常量路由 | A-16 | 已映射 |
| FR-016 深链刷新 | A-12 | 已映射 |
| FR-017 主题/语言持久化 | A-15 | 已映射 |

### 新增的 Non-goals（由断言化补出）

- 不保证 plus-ui 的 URL 结构完全一致（外链菜单路径变化）。
- 不保证富文本产出 HTML 逐字节一致。
- 不重绘图标资产（映射表替代）。

### 新增的 E-xx（由断言化补出）

E-02、E-05、E-06、E-07、E-12、E-14、E-16、E-17 为 spec.md 未覆盖、断言化时补出的边界。
