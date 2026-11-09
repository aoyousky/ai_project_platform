# Contract: 路由、菜单与权限

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Source**: `specs/SPEC-004-system-auxiliary.md` §4.2、A-02、A-09、A-10、后端事实 14
**Mechanism**: 后端 `getRouters` 返回菜单 → `src/router/access.ts` 用
`generateRoutesByBackend` 生成动态路由；`import.meta.glob('../views/**/*.vue')` 按组件名解析页面，
未找到文件才回退 `ComingSoon`。本特性不新增静态路由、不修改路由框架。

## 1. 路由映射（8 个视图）

| 菜单标题 | 后端 `component` | 前端文件 | URL | 可见性 | 入口权限 |
|---|---|---|---|---|---|
| 字典管理 | `system/dict/index` | `src/views/system/dict/index.vue` | `/system/dict` | 可见 | `system:dict:list` |
| 字典数据（隐藏） | `system/dict/data` | `src/views/system/dict/data.vue` | `/system/dict-data/index/:dictId` | 隐藏 | `system:dict:list` |
| 参数设置 | `system/config/index` | `src/views/system/config/index.vue` | `/system/config` | 可见 | `system:config:list` |
| 通知公告 | `system/notice/index` | `src/views/system/notice/index.vue` | `/system/notice` | 可见 | `system:notice:list` |
| 操作日志 | `monitor/operlog/index` | `src/views/monitor/operlog/index.vue` | `/system/log/operlog` | 可见 | `monitor:operlog:list` |
| 登录日志 | `monitor/logininfor/index` | `src/views/monitor/logininfor/index.vue` | `/system/log/logininfor` | 可见 | `monitor:logininfor:list` |
| 文件管理 | `system/oss/index` | `src/views/system/oss/index.vue` | `/system/oss` | 可见 | `system:oss:list` |
| 文件配置（隐藏） | `system/oss/config` | `src/views/system/oss/config.vue` | `/system/oss-config/index` | 隐藏 | `system:ossConfig:list` |

**规则**：
- 文件名按 `component` 而非 URL：隐藏页 URL 与组件名不一致（`dict-data` vs `dict/data`，
  `oss-config` vs `oss/config`），按 URL 命名会落 `ComingSoon`，A-10 失败。
- 隐藏页仍需在 `getRouters` 中存在；`visible=false` 只影响侧边栏，不影响直接访问。
- 字典管理页进入隐藏页的入口：类型行“字典数据”操作按钮跳转
  `/system/dict-data/index/{dictId}`（`router.push`，不改 URL 结构）。
- 文件管理页进入文件配置的入口不新增按钮；按后端菜单权限控制，直接访问
  `/system/oss-config/index`（A-08）。

## 2. 按钮权限矩阵

| 页面 | 操作 | `v-access:code` | 对应接口 |
|---|---|---|---|
| 字典管理 | 新增类型 | `system:dict:add` | `POST /system/dict/type` |
| 字典管理 | 修改类型 | `system:dict:edit` | `PUT /system/dict/type` |
| 字典管理 | 删除类型 | `system:dict:remove` | `DELETE /system/dict/type/{dictIds}` |
| 字典管理 | 刷新缓存 | `system:dict:remove` | `DELETE /system/dict/type/refreshCache` |
| 字典管理 | 导出类型 | `system:dict:export` | `POST /system/dict/type/export` |
| 字典管理 | 新增数据 | `system:dict:add` | `POST /system/dict/data` |
| 字典管理 | 修改数据 | `system:dict:edit` | `PUT /system/dict/data` |
| 字典管理 | 删除数据 | `system:dict:remove` | `DELETE /system/dict/data/{dictCodes}` |
| 字典管理 | 导出数据 | `system:dict:export` | `POST /system/dict/data/export` |
| 隐藏字典数据页 | 新增 | `system:dict:add` | `POST /system/dict/data` |
| 隐藏字典数据页 | 修改 | `system:dict:edit` | `PUT /system/dict/data` |
| 隐藏字典数据页 | 删除 | `system:dict:remove` | `DELETE /system/dict/data/{dictCodes}` |
| 隐藏字典数据页 | 导出 | `system:dict:export` | `POST /system/dict/data/export` |
| 参数设置 | 新增 | `system:config:add` | `POST /system/config` |
| 参数设置 | 修改 | `system:config:edit` | `PUT /system/config` |
| 参数设置 | 删除 | `system:config:remove` | `DELETE /system/config/{configIds}` |
| 参数设置 | 刷新缓存 | `system:config:remove` | `DELETE /system/config/refreshCache` |
| 参数设置 | 导出 | `system:config:export` | `POST /system/config/export` |
| 通知公告 | 新增 | `system:notice:add` | `POST /system/notice` |
| 通知公告 | 修改 | `system:notice:edit` | `PUT /system/notice` |
| 通知公告 | 删除 | `system:notice:remove` | `DELETE /system/notice/{noticeIds}` |
| 操作日志 | 删除 | `monitor:operlog:remove` | `DELETE /monitor/operlog/{operIds}` |
| 操作日志 | 清空 | `monitor:operlog:remove` | `DELETE /monitor/operlog/clean` |
| 操作日志 | 导出 | `monitor:operlog:export` | `POST /monitor/operlog/export` |
| 登录日志 | 删除 | `monitor:logininfor:remove` | `DELETE /monitor/logininfor/{infoIds}` |
| 登录日志 | 清空 | `monitor:logininfor:remove` | `DELETE /monitor/logininfor/clean` |
| 登录日志 | 导出 | `monitor:logininfor:export` | `POST /monitor/logininfor/export` |
| 登录日志 | 解锁 | `monitor:logininfor:unlock` | `GET /monitor/logininfor/unlock/{userName}` |
| 文件管理 | 上传 | `system:oss:upload` | `POST /resource/oss/upload` |
| 文件管理 | 下载 | `system:oss:download` | `GET /resource/oss/download/{ossId}` |
| 文件管理 | 删除 | `system:oss:remove` | `DELETE /resource/oss/{ossIds}` |
| 文件管理 | 预览开关 | `system:config:edit` | `PUT /system/config/updateByKey` |
| 隐藏文件配置页 | 新增 | `system:ossConfig:add` | `POST /resource/oss/config` |
| 隐藏文件配置页 | 修改 | `system:ossConfig:edit` | `PUT /resource/oss/config` |
| 隐藏文件配置页 | 删除 | `system:ossConfig:remove` | `DELETE /resource/oss/config/{ossConfigIds}` |
| 隐藏文件配置页 | 切换默认 | `system:ossConfig:edit` | `PUT /resource/oss/config/changeStatus` |

**说明**：
- 预览开关使用 `system:config:edit`，不是 `system:oss:edit`（Packet §7 签字项 1）。
- 文件配置“详情”读取用 `system:ossConfig:list`（与 Packet §4.2 一致），不单独定义 query 权限。
- 字典类型下拉 `optionselect` 与字典数据按类型读取无权限码，页面不为其加按钮权限。
- 登录日志解锁在勾选数 ≠ 1 时禁用；即使按钮可见也不发起请求（E-17）。

## 3. 权限渲染规则

- 使用现有 `v-access:code` 指令；`admin` 的超级权限按已交付的通配符逻辑放行
  （`REQ-20261101-001` 收口补丁已修复 `*:*:*` 的匹配）。
- 页面级权限由菜单入口控制；按钮级用 `v-access:code`；接口层由后端鉴权。
- 受限账号 `spec004_limited`：仅有 `system:dict:list`/`system:dict:query` 时，
  字典页可加载列表；“新增/修改/删除/导出/刷新缓存”按钮不进入 DOM（A-09）。
- 不因按钮隐藏而假设接口不可调用；越权直接调用由后端返回 `code=403` 与
  `msg='没有访问权限，请联系管理员授权'`，页面展示该 `msg`。

## 4. 路由行为断言映射

| 行为 | 断言 |
|---|---|
| 8 个地址均非占位页、非 403/404，表头正确 | A-10 |
| 隐藏字典页可直连且有数据 | A-02 |
| 隐藏文件配置页可直连且表头正确 | A-08 |
| 受限账号按钮不渲染、写接口 403 | A-09 |
| 无权限访问页面落 403/404 | E-20 |
| 菜单未返回时页面不出现在导航（不强行造菜单） | E-26 |

## 5. 非目标（路由相关）

- 不新增静态路由、不在 `router/routes` 造菜单、不修改 `access.ts` 的匹配算法。
- 不实现移动端布局、面包屑定制、标签页固定、菜单排序。
- 不实现 `client/*`、`tenant/*`、`tenantPackage` 或任何未列出的菜单。
