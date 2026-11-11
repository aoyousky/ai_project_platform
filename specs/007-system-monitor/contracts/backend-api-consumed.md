# Contract: 后端接口消费清单

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Source**: `specs/SPEC-007-system-monitor.md` §4.1、§4.2、§4.5（签字版）
**Scope**: 仅消费以下 3 个既有端点；不新增端点、不修改 `platform/`、不自定义错误结构。
所有请求经 `#/api/request` 的 `requestClient`，默认携带 `Authorization: Bearer <token>` 与
`clientid`，成功码 `200`，失败展示后端 `msg`。

## 1. 共享约定

- 列表响应：`{ code: 200, msg, rows: T[], total: number }` → 解包为 `PageResult<T> = { rows, total }`。
- 对象响应：`{ code: 200, msg, data: T }` → 解包为 `T`。
- 失败响应：HTTP 200 + `code≠200` 由拦截器 `message.error(msg)` 并 reject；HTTP 401 触发重新认证；
  HTTP 403 展示 `msg`；不吞异常、不返回 Spec 之外的自定义错误结构。
- 本特性不发送分页参数；不发送排序参数；不发送日期范围参数。

## 2. 在线用户

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listOnlineApi` | `GET /monitor/online/list` | `monitor:online:list` | `OnlineQuery`（`ipaddr`、`userName`，均可空） | `PageResult<UserOnline>`，`total=rows.length` |
| `forceLogoutOnlineApi` | `DELETE /monitor/online/{tokenId}` | `monitor:online:forceLogout` | 路径参数，`encodeURIComponent(tokenId)` | `void`（`code=200`） |

**行为约束**：

- `ipaddr` 与 `userName` 为空串或未传时表示不过滤；两个都传时由后端按 AND 返回。
- 匹配为精确等值，前端不拼接通配符、不做前端二次过滤。
- 已过期 `tokenId` 仍返回 `code=200`，前端按幂等成功处理。
- 一次请求返回全部在线会话，前端本地分页；不得传 `pageNum`/`pageSize`。
- 批量强退对每个 `tokenId` 串行调用 `forceLogoutOnlineApi`，不使用未定义的后端批量端点。

**错误行为**：

- 列表失败：保留当前列表或空状态，展示后端 `msg`；不发起本地分页请求。
- 强退失败：该行保留；单条场景展示后端 `msg`；批量场景计入失败数并汇总展示 `msg`。
- 网络超时：展示请求层统一网络错误文案；批量场景继续处理其余条目。

## 3. 缓存监控

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `getCacheInfoApi` | `GET /monitor/cache` | `monitor:cache:list` | 无 | `CacheInfo` |

**响应形状**：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "info": { "redis_version": "7.2.5", "redis_mode": "standalone", "...": "..." },
    "dbSize": 42,
    "commandStats": [{ "name": "get", "value": "120" }]
  }
}
```

- `info` 的值均为 string；缺键按 §4.2 显示「—」。
- `dbSize` 为 `null` 时显示「—」，为 `0` 时显示 `0`。
- `commandStats` 为空数组时显示「暂无数据」，不请求其他缓存端点。
- 不调用 `getNames`、`getKeys`、`getValue`、`clearCacheName`、`clearCacheKey`、`clearCacheAll`。

**错误行为**：失败时页面只展示后端 `msg` 原文，不渲染信息表与图表，不吞异常。

## 4. 明确不消费的端点

| 端点 | 原因 |
|---|---|
| `GET /monitor/online`、`DELETE /monitor/online/myself/{tokenId}` | 当前登录设备管理，属 Non-goals |
| `GET /monitor/online/list` 的分页变体 | 后端不支持服务端分页 |
| `GET /monitor/cache/getNames` 等缓存键接口 | 后端不存在，且属 Non-goals |
| 任意批量强退端点 | 后端不存在；批量由前端逐条调用 |
| Admin 监控、SnailJob 后端接口 | 只内嵌官方控制台，不消费其 API |
