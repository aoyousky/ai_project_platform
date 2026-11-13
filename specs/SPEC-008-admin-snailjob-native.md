---
id: REQ-20261112-008
title: 系统监控原生视图（Admin 监控 / 任务调度中心）最小可用集
version: 1.0
generated_from: 2026-11-12 裁决「先 A 后 B」；B 采用前端直连官方控制台 REST API、最小可用集、复用现有权限码、新建独立 REQ
risk_level: L2
risk_reason: 页面展示环境配置与运行日志，可能包含密钥/令牌等敏感值，需要脱敏口径与架构复核；不涉资金与对外承诺
channel: ai_direct
pm: aoyousky 2026-11-12
business_signoff: Jim Liu 2026-11-12
arch_reviewer: jiankui zhang 2026-11-12
target_window:
---

# 系统监控原生视图（Admin 监控 / 任务调度中心）最小可用集

> ⚠️ 本文不是**草稿**，可以作为交付依据。升格为 Spec Packet 需要
> PM 与业务方逐条签字，Agent 不得自行去草稿标记或升版。

## 1. 意图

- 业务目标：把 SPEC-007 v1.0 中用 iframe 内嵌的两个官方控制台，替换为前端原生页面，
  在 vben 应用内直接查看 Admin 监控与任务调度中心的最小可用信息，减少跳出与上下文切换。
- 调用方 / 场景 / 频率：运维与管理员在系统监控菜单下查看平台应用健康、实例环境/日志，
  以及任务列表与执行记录并触发执行/停止/重试。低频人工操作，每天个位数到几十次。
- 上线 30 天成功度量：两个原生页面的周活跃管理员 ≥ 1；因控制台不可用导致的页面错误
  工单为 0；两页面 pageerror 率为 0。
- 交付边界：**不改 `platform/`、不新增依赖、不新增权限码、不新增菜单**；数据来自同源反代下
  官方控制台 REST API（Spring Boot Admin 3.5.8、SnailJob 1.10.0）。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | SBA 控制台已启动且当前标签页已登录 | 进入 `/monitor/Admin` | 表格 `[data-testid=admin-app-list]` 行数 ≥ 1；每行同时含应用名与状态列；`pageerror === 0` |
| A-02 | P0 | `GET /admin/applications` 返回 N 个应用 | 页面渲染完成 | 表格行数 = N；状态列与响应 `status` 字段不一致的行数 = 0（枚举 ∈ {UP, DOWN, OFFLINE, UNKNOWN}） |
| A-03 | P0 | 选择一个应用的实例 | 点击「环境」 | 发出 1 次 `GET /admin/instances/{id}/actuator/env`；表格行数 = 响应 `propertySources` 条数，且 ≤ 200 |
| A-04 | P0 | 选择一个应用的实例 | 点击「日志」 | 发出 1 次 `GET /admin/instances/{id}/actuator/logfile`；`[data-testid=admin-log]` 可见，渲染行数 ≤ 200，内容为 text/plain |
| A-05 | P0 | SBA 会话未登录（接口返回 401） | 进入 `/monitor/Admin` | 显示 `[data-testid=console-login-tip]` 文案「请先登录官方控制台」；登录链接 `href=/admin/login` 且可见；不渲染 `admin-app-list`；`pageerror === 0` |
| A-06 | P0 | SnailJob 已登录（`SNAIL-JOB-AUTH` 有效） | 进入 `/monitor/snailjob` | 发出 1 次 `GET /snail-job/job/page/list`；表格行数 = min(total, pageSize)；列含任务名/组/状态/下次触发 |
| A-07 | P0 | 任务列表存在任务 id=1 | 点击该行「执行记录」 | 发出 1 次 `GET /snail-job/job/task/list?jobId=1`；执行记录行数 = 响应数组长度；空数组时显示「暂无数据」 |
| A-08 | P0 | 任务列表存在任务 id=1 | 点击「执行」并在确认框点确定 | 发出 1 次 `POST /snail-job/job/trigger`，body `jobId=1`；成功提示元素 `[data-testid=action-toast]` 文本「执行成功」；任务列表重新请求 1 次 |
| A-09 | P0 | 执行记录中存在状态为 RUNNING(2) 的记录 | 点击该行「停止」 | 发出 1 次 `POST /snail-job/job/batch/stop/{taskBatchId}`；成功提示元素 `[data-testid=action-toast]` 文本「停止成功」；刷新后该记录状态不再为 RUNNING(2) |
| A-10 | P0 | 执行记录中存在状态为 FAIL(4) 的记录 | 点击该行「重试」 | 发出 1 次 `POST /snail-job/job/batch/retry/{taskBatchId}`；成功提示元素 `[data-testid=action-toast]` 文本「重试成功」；刷新后记录数 ≥ 1 |
| A-11 | P0 | 任意页面已渲染 | 页面稳定 3s | 所有敏感值脱敏：环境表 key 含 `password/secret/token` 的值显示 `***`；不出现控制台 `metadata.userpassword` 原文 |

> P0 断言 11 条，≤ 12，不拆需求。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 空值：`/admin/applications` 返回 `[]` | 显示「暂无应用」空态；不弹错误提示；`pageerror === 0` |
| E-02 | 空值：env `propertySources` 为空 | 显示「暂无配置项」；不发起第二次请求 |
| E-03 | 超限：env 返回 500 条 propertySource（上限 200 条） | 仅渲染前 200 条，并显示「已截断，仅显示前 200 条」 |
| E-04 | 超限：logfile 内容 5 MB（上限 200 行） | 仅渲染最后 200 行；页面在 5s 内可交互（停止按钮/刷新可用） |
| E-05 | 权限：账号无 `monitor:admin:list` | 直达 `/monitor/Admin` 落 404；不发起任何 `/admin/*` 请求 |
| E-06 | 权限：账号无 `monitor:snailjob:list` | 直达 `/monitor/snailjob` 落 404；不发起任何 `/snail-job/*` 请求 |
| E-07 | 超时：SBA 请求 30s 未返回 | 显示「控制台连接超时」；不渲染数据表；`pageerror === 0` |
| E-08 | 未登录：SnailJob 返回 `status=5001` | 显示「请先登录任务调度中心」与「打开控制台」链接 `href=/snail-job`；不渲染任务表 |
| E-09 | 重复：连续点击「执行」两次 | 第一次请求发出后按钮 disabled；`POST /snail-job/job/trigger` 总次数 = 1 |
| E-10 | 非法状态：对已 SUCCESS(3) 的记录点「停止」 | 按钮 disabled，不发出 `POST /job/batch/stop/*` |
| E-11 | 控制台返回 HTML/502（反代上游失败） | 显示「控制台不可用」；不抛出 pageerror；不把 HTML 当 JSON 解析 |
| E-12 | 空值：任务列表 `total=0` | 显示「暂无任务」；分页器总数为 0；不请求 `/job/task/list` |

> 六类覆盖：空值（E-01/E-02/E-12）、超限（E-03/E-04）、重复（E-09）、权限（E-05/E-06）、
> 超时（E-07）、非法状态（E-08/E-10/E-11）。

> ⚠️ 已确认假设：E-05/E-06 沿用 SPEC-007 的「越权直达落 404」口径（菜单由后端下发，
> 前端无静态路由）。

## 4. 数据契约

### 4.1 Admin 监控（Spring Boot Admin 3.5.8，同源 `/admin`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `applications[].name` | string | 否 | — | 应用名，唯一 |
| `applications[].status` | enum string | 否 | — | `UP` / `DOWN` / `OFFLINE` / `UNKNOWN` |
| `applications[].instances` | array | 否 | 空数组表示无实例 | 元素为实例对象 |
| `instances[].id` | string | 否 | — | 实例 id，用于拼接 `/instances/{id}/actuator/*` |
| `instances[].statusInfo.status` | enum string | 否 | — | 同 `status` 枚举 |
| `instances[].registration.managementUrl` | string(url) | 是 | `null` 表示未注册管理地址 | 不做跳转展示 |
| `instances[].metadata.username` | string | 是 | `null` 表示未提供 | **不渲染** |
| `instances[].metadata.userpassword` | string | 是 | `null` 表示未提供 | **禁止渲染/记录** |
| `env.propertySources[].name` | string | 否 | — | 配置源名 |
| `env.propertySources[].properties` | object | 否 | 空对象表示无配置项 | key/value 均为 string；值命中敏感键时显示 `***` |
| `logfile` | text/plain | 是 | 空文本表示无日志 | 取末尾 200 行；不做本地持久化 |

- 时间口径：控制台返回的 `statusTimestamp` 为 UTC ISO8601；页面统一按 `Asia/Shanghai`
  展示为 `YYYY-MM-DD HH:mm:ss`。空时间显示「—」，不显示 `1970-01-01`。
- 分页：Admin 应用列表不分页，一次性渲染；实例折叠展开。

### 4.2 任务调度中心（SnailJob 1.10.0，同源 `/snail-job`）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `status` | integer | 否 | — | 顶层响应码：`1` 成功；`5001` 登录过期；`0` 业务失败 |
| `data[].id` | integer | 否 | — | 任务 id |
| `data[].jobName` | string | 否 | — | 任务名 |
| `data[].groupName` | string | 否 | — | 组名；空字符串表示未分组 |
| `data[].jobStatus` | integer | 否 | — | `1` 启用 / `0` 停用 |
| `data[].nextTriggerAt` | string | 是 | `null` 表示未调度 | `YYYY-MM-DD HH:mm:ss`，时区 Asia/Shanghai |
| `data[].triggerType` / `triggerInterval` | integer / string | 否 | — | 仅展示，不做编辑 |
| `total` / `page` / `size` | integer | 否 | — | 分页字段；`total=0` 表示空列表 |
| `job/task/list[].taskBatchId` | integer | 否 | — | 执行批次 id，用于 stop/retry 路径 |
| `job/task/list[].status` | integer | 否 | — | `2` RUNNING / `3` SUCCESS / `4` FAIL / `5` STOP / `6` CANCEL |
| `job/task/list[].createDt` | string | 是 | `null` 表示无记录 | `YYYY-MM-DD HH:mm:ss` |
| `auth/login.data.token` | string(JWT) | 否 | — | 仅保存在当前标签页 `sessionStorage`（`snailjob_token`）与内存；不写 localStorage、不打印、不上报 |

- 登录与请求头：`POST /snail-job/auth/login` 取 token；后续请求带 `SNAIL-JOB-AUTH: <token>`
  与 `SNAIL-JOB-NAMESPACE-ID: <namespace uniqueId>`（默认取当前已选 namespace，未选则取
  `dev` 并在页面提供切换）。
- 错误结构：非 `status=1` 一律按失败处理，展示后端 `message` 原文，不渲染数据表。

> ⚠️ 已确认假设：原生页自己发起 SnailJob 登录（表单）并把 JWT 放 `sessionStorage`。

### 4.3 权限码（复用，不新增）

| 页面 | 权限码 | 来源 |
|---|---|---|
| `/monitor/Admin` | `monitor:admin:list` | 现有 `sys_menu` 菜单 117 |
| `/monitor/snailjob` | `monitor:snailjob:list` | 现有 `sys_menu` 菜单 120 |

## 5. 非功能约束

- 性能口径：控制台同源请求 P95 ≤ 500ms（本地栈、任务 ≤ 100 条、env ≤ 200 条）；
  首屏渲染 ≤ 2s；日志 5MB 时页面仍可交互。
- 安全（鉴权 / 脱敏）：
  - 鉴权：仅复用现有权限码，无新增权限；页面直连控制台 API 时依赖控制台自身登录态。
  - 脱敏：`metadata.userpassword`、环境变量中命中 `password/secret/token/key` 的键值、
    日志中的令牌样式字符串（如 `Bearer `、`SNAIL-JOB-AUTH` 后的值）一律显示 `***`。
  - 浏览器存储：仅 `sessionStorage` 保存 SnailJob JWT；**禁止**写入 localStorage、
    URL、日志、telemetry、错误上报。
- 合规（留痕 / 审计）：任务执行/停止/重试为写操作，需在页面显示操作人（当前登录用户）
  与操作时间；不额外写后端审计表（超出 B 约束）。
- 可观测（必须输出）：不新增日志字段；错误提示文案来自控制台 `message` 或统一文案，
  前端不打印控制台原始响应体。

## 6. 状态流转

- 任务记录状态：`RUNNING(2) → SUCCESS(3) | FAIL(4) | STOP(5) | CANCEL(6)`。
- 允许迁移：RUNNING 可被「停止」→ STOP(5)。
- 非法迁移（显式拒绝）：SUCCESS/FAIL/STOP/CANCEL 不得被「停止」（按钮 disabled，不发请求）；
  SUCCESS 不得被「重试」；FAIL 可「重试」，重试成功后由控制台产生新批次，原批次状态不变。
- 任务启停：`jobStatus 1（启用） ↔ 0（停用）` 本期只读展示，不提供切换（见 Non-goals）。

## 7. Non-goals（必填）

- 本期不做：SBA 的指标图（JVM/GC/线程/HTTP trace）、告警通知、实例注销/注册；
  SnailJob 的通知配置、组管理、命名空间管理、工作流、执行器管理、任务新增/编辑/删除、
  任务启停切换。
- 本期不做：后端聚合/代理接口（不改 `platform/`），不新增权限码与菜单，不新增依赖。
- 不兼容：不修改 SPEC-007 v1.0 已签字的 A-08/A-09 判定口径；官方控制台内嵌仍保留为兜底入口。
- 不做：移动端适配、国际化新增文案（沿用中文）。
- 不做：控制台凭据持久化（浏览器 localStorage）与凭据出现在任何日志/上报。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `/admin/applications` 返回 2 个应用，1 UP、1 DOWN | 列表 2 行，状态分别显示 UP / DOWN |
| 正例 | 任务 total=3，pageSize=10，其中 1 条 RUNNING | 列表 3 行；点「停止」仅对 RUNNING 行可用，POST 路径含该 taskBatchId |
| 正例 | 环境 `propertySources` 含 `spring.datasource.password` | 该行值为 `***`，其余键值正常显示 |
| **反例** | 控制台返回 502 HTML 页面 | **不得**把 HTML 当 JSON 渲染或抛 pageerror；显示「控制台不可用」 |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 0.1 | 草稿初版 | 2026-11-12 | Agent 起草 |
| 1.0 | 断言与边界确认，升格为 Spec Packet | 2026-11-12 | PM aoyousky / 业务方 Jim Liu / 架构复核 jiankui zhang |

> 签字依据：front-matter 的 `pm` / `business_signoff` / `arch_reviewer` 字段由签字人填写；
> 本表为同一签字的记录，内容未改动任何断言或边界。

## 附：断言改写对照（体检反馈）

| 条目 | 改写前 | 改写后 |
|---|---|---|
| A-02 | 每行状态文本 ∈ {UP, DOWN, OFFLINE, UNKNOWN} 且与响应 `status` 字段一致 | 表格行数 = N；状态列与响应 `status` 字段**不一致的行数 = 0** |

> 体检结论：11 条断言全部可机器判定；剩余提示仅要求前端可见性断言点名元素，已在 A-08/A-09/A-10 补 `[data-testid=action-toast]`。
