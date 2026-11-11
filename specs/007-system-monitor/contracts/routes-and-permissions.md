# Contract: 路由、菜单与权限

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Source**: `specs/SPEC-007-system-monitor.md` §4.3、§4.4、A-08、A-09、A-10、E-12～E-17
**Mechanism**: 后端 `getRouters` 返回菜单 → `src/router/access.ts` 用 `generateRoutesByBackend`
生成动态路由；`import.meta.glob('../views/**/*.vue')` 按组件名解析页面，未找到文件才回退
`ComingSoon`。本特性不新增静态路由、不修改路由框架。

## 1. 路由映射（4 个视图）

| 菜单标题 | 后端 `component` | 前端文件 | URL | 入口权限 |
|---|---|---|---|---|
| 在线用户 | `monitor/online/index` | `src/views/monitor/online/index.vue` | `/monitor/online` | `monitor:online:list` |
| Admin监控 | `monitor/admin/index` | `src/views/monitor/admin/index.vue` | `/monitor/Admin` | `monitor:admin:list` |
| 缓存监控 | `monitor/cache/index` | `src/views/monitor/cache/index.vue` | `/monitor/cache` | `monitor:cache:list` |
| 任务调度中心 | `monitor/snailjob/index` | `src/views/monitor/snailjob/index.vue` | `/monitor/snailjob` | `monitor:snailjob:list` |

**规则**：

- 文件名按 `component` 而非菜单标题；目录使用小写 `admin`，与后端 `component` 一致。
- 4 个文件必须存在，否则动态路由回退 `ComingSoon`，A-01/A-06/A-08/A-09 失败。
- 无权限时后端不返回对应菜单，直接访问由既有守卫落到 404，且不发起该页数据请求（E-14/E-15）。
- 不新增静态路由；不在前端补权限判断来“放行”菜单未返回的页面。

## 2. 按钮权限矩阵

| 页面 | 控件 | 判定方式 | 权限码 | 对应接口 |
|---|---|---|---|---|
| 在线用户 | 单条「强退」 | `hasCodeAccess(codes, ['monitor:online:forceLogout'])`，`v-if` | `monitor:online:forceLogout` | `DELETE /monitor/online/{tokenId}` |
| 在线用户 | 「批量强退」 | 两次 `hasCodeAccess` 取 AND，`v-if` | `monitor:online:batchLogout` 且 `monitor:online:forceLogout` | 逐条 `DELETE /monitor/online/{tokenId}` |

**规则**：

- `hasCodeAccess` 对数组是 OR 语义，不能直接用 `v-access:code` 表达“两码齐全”；批量按钮必须用
  AND 组合判定。
- 无权限时按钮不进入 DOM（`v-if=false`），不是 `disabled`；A-10/E-14 以元素数量 = 0 判定。
- `monitor:online:query` 不控制任何控件显隐。
- 超级管理员 `*:*:*` 由 `hasCodeAccess` 短路放行。

## 3. 外部控制台地址

| 页面 | 环境变量 | 开发默认值 | 生产默认值 |
|---|---|---|---|
| Admin监控 | `VITE_GLOB_MONITOR_ADMIN_URL` | `http://localhost:9090/admin/applications` | `/admin/applications` |
| 任务调度中心 | `VITE_GLOB_SNAILJOB_ADMIN_URL` | `http://localhost:8800/snail-job` | `/snail-job` |

- 组件只读环境变量，不硬编码兜底值。
- 空串视为未配置：不渲染 iframe，显示「未配置监控地址」，外链 `disabled`（E-12）。
- 已配置但目标不可达：iframe 与外链均保留，不弹前端自造错误（E-13）。
- 外链使用 `target="_blank"` 与 `rel="noopener noreferrer"`；点击后新窗口 URL 等于配置值（E-17）。
