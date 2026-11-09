---
id: REQ-20261108-006
title: 登录后首页与工作台（A 运营驾驶舱 + B 协同工作台）交付
version: 1.4
risk_level: L2
channel: ai_forced_review
pm: aoyousky 2026-11-08
business_signoff: Jim Liu 2026-11-08
arch_reviewer: Jiankui zhang 2026-11-08
target_window: 2026-11-09 ~ 2026-11-23
generated_from: "CLAR-014 PM 裁决 A：生效 SLA 上限 168h，非法配置启动失败；基于 SPEC-005 v1.3 升版 v1.4"
supersedes: "1.3"
---

# Spec Packet：登录后首页与工作台（A 首页 + B 工作台）

> **正式 Spec Packet（v1.4）。** 本文件基于已签字 v1.0 与 CLAR-011～CLAR-014 的 PM 裁决升版，
> 是 `REQ-20261108-006` 的交付依据；实现必须按本文件的断言、边界与数据契约执行。
> 设计输入：[`docs/prototypes/home-workspace/README.md`](../../docs/prototypes/home-workspace/README.md)。

**风险级别说明**：L2。首页是全体登录用户的默认落点，聚合数据含用户数、在线数、登录日志、
操作日志与系统健康；影响面覆盖全部用户，且包含租户边界与权限降级，不是内部工具级变更。
**通道说明**：`ai_forced_review`。L2 + 后端新增只读聚合接口 + 默认路由组件替换，需架构复核。

## 1. 意图

- **业务目标（含量化指标）**：把登录后的默认落点从 Vben 示例页替换为 A 运营驾驶舱，
  把 `/dashboard/workspace` 示例页替换为 B 协同工作台；本 Packet 的 12 条 P0 断言全部通过；
  首页与工作台 `pageerror` 计数为 0；首页首屏骨架出现时间 ≤ 300ms；无权限用户看到的
  系统级卡片数量为 0；新增前端运行时依赖数为 0。
- **调用方 / 场景 / 频率**：全体登录用户。首页在登录成功、手动刷新、从其他页面返回时加载；
  工作台在用户处理流程任务、查看已办/抄送、筛选待办时使用；桌面端 1440×900 为主，
  兼容 1280×720 与 1024×768；使用频率为每日多次。
- **上线 30 天成功度量（不计入 DoD）**：上线后 30 天内“首页白屏/数字与列表不一致/
  待办点不进去/普通用户看到系统级数据”类工单数为 0。该指标为滞后指标，交付时不可验证，
  转为上线回顾。

## 2. 验收断言

> 评测夹具约定（实现阶段落库）：`spec005_admin`（`*:*:*`）、`spec005_limited`
> （仅 `system:notice:list`，无 `monitor:*`、`system:user:list`、`system:dept:list`）、
> 租户 `spec005_tenant_a`（1,286 用户、36 部门、Top 5 部门人数 286/248/193/126/98）与
> `spec005_tenant_b`（42 用户、3 部门）。登录日志按请求日 D 的 D-6～D 共 7 天造数，
> 每日成功登录数依次为 142/168/153/201/187/226/213；D 日另造 3 条失败操作日志。
> 待办 7 条：2 条已超时、3 条 D 日到期、2 条 D+1～D+7 内到期、0 条无截止时间；
> 已办 32 条、我发起 12 条、抄送 5 条。P0 断言均使用 `spec005_admin`，A-06 与 A-11 例外。
> **v1.1 SLA 夹具口径**：待办截止时间不再来自 `flow_task` 持久化字段，而是由
> `create_time + 生效 SLA` 派生。种子脚本按运行时当前时刻反推 7 条待办的 `create_time`，
> 使默认 SLA=72 时分别得到 2 条 `dueTime < now`、3 条 `dueTime >= now 且日期=D`、
> 2 条 `D+1～D+7` 到期、0 条禁用 SLA；不得在测试代码中硬编码 D 的日历日期。

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | `spec005_admin` 已登录；夹具数据如 §2 前言 | 打开 `/index`；调用 `GET /dashboard/home` | HTTP 200、`code=200`；`data.metrics.userTotal=1286`、`onlineTotal=48`、`todoTotal=7`、`todayLoginTotal=213`、`todayErrorLogTotal=3`；`[data-testid="home-kpi-user-total"]` 文本为 `1,286`，`[data-testid="home-kpi-online"]` 文本为 `48`，`[data-testid="home-kpi-todo"]` 文本为 `7`，`[data-testid="home-kpi-today-login"]` 文本为 `213`；`pageerror` 计数 = 0 |
| A-02 | P0 | 登录日志夹具覆盖 D-6～D 共 7 天 | 调用 `GET /dashboard/home`；读取 `data.loginTrend` | `loginTrend.length=7`；首项 `date=D-6`、末项 `date=D`（`YYYY-MM-DD`，Asia/Shanghai）；7 项 `count` 依次为 142/168/153/201/187/226/213，合计 1290；`[data-testid="home-login-trend"]` 渲染 7 个 x 轴刻度，`[data-testid="home-trend-last-value"]` 文本为 `213`；`pageerror` 计数 = 0 |
| A-03 | P0 | 租户 A 有 36 个部门，Top 5 人数如 §2 前言 | 调用 `GET /dashboard/home`；读取 `data.deptDistribution` | `length=5`；`deptName` 顺序为 运营中心/技术中心/客户成功部/财务部/人力资源部；`userCount` 依次为 286/248/193/126/98；`[data-testid="home-dept-row"]` 数量 = 5，首行数值文本为 `286`；`pageerror` 计数 = 0 |
| A-04 | P0 | `spec005_admin` 具备 `monitor:admin:list`；MySQL 与 Redis 可用；任务调度未配置探活 | 调用 `GET /dashboard/home`；读取 `data.health` | HTTP 200；`health.status=DEGRADED`；`health.services.length=4`；MySQL、Redis 的 `status=UP`；任务调度的 `status=UNKNOWN`、`latencyMs=null`；`cpuUsage`、`memoryUsage`、`diskUsage` 均为 0～100 的整数；`[data-testid="home-health-status"]` 文本为 `部分服务状态未知`；`[data-testid="home-meter"]` 数量 = 3；`pageerror` 计数 = 0 |
| A-05 | P0 | 3 条公告、D 日 5 条登录日志、5 条操作日志已造数 | 调用 `GET /dashboard/home`；读取 `notices`、`recentLogins`、`recentOperations` | `notices.length=3`、`recentLogins.length=5`、`recentOperations.length=5`；公告标题与种子标题逐项相等；登录日志 `status` 仅取 `SUCCESS` 或 `FAIL`；`[data-testid="home-notice-row"]` 数量 = 3，`[data-testid="home-recent-login-row"]` 数量 = 5，`[data-testid="home-recent-oper-row"]` 数量 = 5；`pageerror` 计数 = 0 |
| A-06 | P0 | `spec005_limited` 已登录；仅具备 `system:notice:list`；流程接口按当前用户可用 | 调用 `GET /dashboard/home`；打开 `/index` | HTTP 200、`code=200`；`metrics.userTotal`、`onlineTotal`、`todayLoginTotal`、`todayErrorLogTotal`、`loginTrend`、`deptDistribution`、`health`、`recentLogins`、`recentOperations` 均为 `null`；`notices.length=3`；`metrics.todoTotal=7`；`warnings` 中对上述 9 个字段各有一条 `PERMISSION_DENIED`；`[data-testid="home-system-card"]` 数量 = 0、`[data-testid="home-health-card"]` 数量 = 0、`[data-testid="home-dept-card"]` 数量 = 0、`[data-testid="home-recent-login-card"]` 数量 = 0、`[data-testid="home-recent-oper-card"]` 数量 = 0；`[data-testid="home-notice-card"]` 可见；`pageerror` 计数 = 0 |
| A-07 | P0 | `spec005_admin` 有 7 条待办、32 条已办、12 条我发起、5 条抄送；近 7 天效率夹具为 12/20、3.2 小时、8% | 调用 `GET /dashboard/workbench`；打开 `/dashboard/workspace` | HTTP 200、`code=200`；`metrics.todoTotal=7`、`doneTotal=32`、`initiatedTotal=12`、`copyTotal=5`；`groupCounts.overdue=2`、`today=3`、`next7Days=2`、`unscheduled=0`；四个 `groups` 数组长度与计数相等；`[data-testid="workbench-tab-todo"]` 文本含 `7`，`[data-testid="workbench-group-overdue"]` 文本含 `2`，`[data-testid="workbench-group-next7"]` 文本含 `2`，`[data-testid="workbench-task-row"]` 数量 = 7；`pageerror` 计数 = 0 |
| A-08 | P0 | 工作台已加载 7 条待办；4 个筛选入口可见 | 依次点击 `[data-testid="filter-overdue"]`、`[data-testid="filter-today"]`、`[data-testid="filter-next7"]`、`[data-testid="filter-clear"]` | 四次点击后 `[data-testid="workbench-task-row"]` 数量依次为 2/3/2/7；页签计数仍为 7/32/12/5；清除筛选后所有行重新出现；`pageerror` 计数 = 0 |
| A-09 | P0 | 近 7 天效率夹具为已完成 12、目标 20、平均处理 3.2 小时、超时率 8%；统计窗口为请求时刻往前 7×24 小时（含边界） | 调用 `GET /dashboard/workbench`；打开 `/dashboard/workspace` | `efficiency.completedThisWeek=12`、`weeklyTarget=20`、`avgHandleHours=3.2`、`overdueRate=8`；`[data-testid="workbench-efficiency-text"]` 文本为 `已完成 12 / 20`；`[data-testid="workbench-efficiency-bar"]` 计算样式 `width=60%`；DOM 中不出现 `NaN`；`pageerror` 计数 = 0 |
| A-10 | P0 | `spec005_admin` 从登录页成功登录 | 登录成功后读取 `window.location.pathname`；打开 `/dashboard/workspace` | 登录后 `pathname=/index`；`[data-testid="home-page-title"]` 文本为 `运营驾驶舱`；`[data-testid="workbench-page-title"]` 文本为 `工作台`；两个页面均不出现文本 `即将推出`；`pageerror` 计数 = 0 |
| A-11 | P0 | 租户 A 用户 `spec005_admin_a` 与租户 B 用户 `spec005_admin_b` 已登录，两租户用户数分别 1,286 与 42 | 分别以 A、B 令牌调用 `GET /dashboard/home` | 两次均 HTTP 200；A 的 `metrics.userTotal=1286`，`deptDistribution` 中的 `deptName` 不包含租户 B 的 3 个部门名；B 的 `metrics.userTotal=42`，`deptDistribution` 中的 `deptName` 不包含租户 A 的 5 个部门名；两个响应的 `serverTime` 均带 `+08:00` 偏移；`pageerror` 计数 = 0 |
| A-12 | P0 | 登录日志查询被注入 3 秒超时；首页其他数据源可用 | 调用 `GET /dashboard/home`；打开 `/index` | HTTP 200、`code=200`；`loginTrend=null`、`metrics.todayLoginTotal=null`；`warnings` 含 `field=loginTrend,code=TIMEOUT` 与 `field=metrics.todayLoginTotal,code=TIMEOUT`；`metrics.userTotal=1286` 与 `notices.length=3` 保留；`[data-testid="home-trend-error"]` 可见且文本为 `加载失败，点击重试`；`[data-testid="home-trend-chart"]` 数量 = 0；`pageerror` 计数 = 0 |
| A-13 | P1 | `spec005_admin` 有 3 个运行中流程实例 | 调用 `GET /dashboard/workbench`；打开 `/dashboard/workspace` | `flowProgress.length=3`；每项 `progressPercent` 为 0～100 的整数或 `null`；`null` 时 `[data-testid="workbench-flow-bar"]` 数量 = 0 且节点名可见；非 `null` 时进度条宽度等于对应百分比；`pageerror` 计数 = 0 |
| A-14 | P1 | 工作台已加载；当前用户有 7 条待办 | 勾选第 1 行，再取消勾选；点击刷新按钮两次（间隔 500ms） | 勾选 1 行时 `[data-testid="workbench-batch-action"]` 可用，取消后禁用；刷新期间 `[data-testid="workbench-loading"]` 出现，结束后消失；`[data-testid="workbench-task-row"]` 仍为 7 条且无重复 `taskId`；`pageerror` 计数 = 0 |
| A-15 | P1 | 默认 SLA=72h；流程 `leave` 覆盖 `dashboard.workbench.slaHoursByFlow.leave=0`；一条普通待办 `create_time=D-4d 08:00` | 调用 `GET /dashboard/workbench`；读取对应 `groups` | 普通待办 `dueTime=D-1d 08:00+08:00`、`priority=OVERDUE`；`leave` 待办 `dueTime=null`、`priority=UNSCHEDULED`；无 `INVALID_DATA` warning；`pageerror` 计数 = 0 |

> P0 断言 12 条，未超过模板上限；P1 断言只做组件/E2E/人工核对，不进入 P0 门禁。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 公告、登录日志、操作日志均为 0 条 | `notices=[]`；`[data-testid="home-notice-empty"]` 文本为 `暂无公告`；`todayLoginTotal=0` 且 KPI 显示 `0`；`warnings=[]`；`pageerror` 计数 = 0 |
| E-02 | D-6～D 均无登录日志 | `loginTrend.length=7` 且 7 项 `count=0`；趋势卡渲染 7 个刻度，Y 轴最小值为 0；趋势字段不为 `null`；`pageerror` 计数 = 0 |
| E-03 | 租户无部门、无用户 | `deptDistribution=[]`；`[data-testid="home-dept-empty"]` 文本为 `暂无部门数据`；`metrics.userTotal=0` 显示 `0`；`deptDistribution` 不为 `null`；`pageerror` 计数 = 0 |
| E-04 | 部门数为 200，Top 5 之外仍有 195 个部门 | `deptDistribution.length=5`；按 `userCount` 降序，同值时按 `deptId` 升序；响应体 ≤ 200KB；1024×768 下无横向滚动条 |
| E-05 | 单个部门名称为 30 个字符 | 接口返回完整 `deptName`；页面用省略号截断，元素 `title` 属性含完整名称；1024×768 下部门卡不出现溢出或换行错位；`pageerror` 计数 = 0 |
| E-06 | 两个并发请求携带同一租户、同一用户令牌 | 两次均 HTTP 200；`metrics` 与 `loginTrend` 数值逐项相等；用户、角色、部门表行数不变；`warnings=[]` |
| E-07 | 待办接口返回两条 `taskId` 相同的记录 | 后端按 `taskId` 去重；`metrics.todoTotal` 非 `null` 时 `groupCounts` 四项之和等于它；DOM `[data-testid="workbench-task-row"]` 中 `taskId` 不重复 |
| E-08 | 用户无 `monitor:logininfor:list` 但有公告权限 | `recentLogins=null`；`warnings` 含 `field=recentLogins,code=PERMISSION_DENIED`；HTTP 200；`[data-testid="home-recent-login-card"]` 数量 = 0；`pageerror` 计数 = 0 |
| E-09 | 用户登录后权限被撤销，随后刷新首页 | 下一次请求中对应字段变为 `null`；页面不再显示旧数值；`warnings` 出现对应 `PERMISSION_DENIED`；无缓存旧值残留 |
| E-10 | 下游查询超过 3 秒未返回 | 接口 HTTP 200；超时字段为 `null` 且 `warnings` 含 `TIMEOUT`；其余字段保留；前端收到响应后显示 `[data-testid="home-trend-error"]`；若 5 秒内无响应，前端中止并显示同一错误态；点击重试只发起 1 次请求，不出现无限加载 |
| E-11 | 聚合接口返回 HTTP 500 | 页面显示 `[data-testid="home-load-error"]` 文本 `加载失败，点击重试`；KPI 不显示任何旧数值；点击重试发起 1 次 `GET /dashboard/home`；`pageerror` 计数 = 0 |
| E-12 | 工作流模块未启用（`@ConditionalOnEnable` 条件不满足） | 首页 `metrics.todoTotal=null`；工作台 `metrics` 各字段为 `null`、四个 `groups` 为空数组；`warnings` 含 `field=metrics.todoTotal,code=UNAVAILABLE`；HTTP 200；`pageerror` 计数 = 0 |
| E-13 | 非法状态：令牌已失效（过期）或用户被删除/冻结后访问 `/index` | 接口 HTTP 401；前端跳转登录页；`[data-testid="home-kpi-user-total"]` 不渲染；旧租户数据不可见 |
| E-14 | 登录事件发生在 23:59:30 与次日 00:00:10（Asia/Shanghai） | 前者计入 D，后者计入 D+1；`loginTrend` 日期标签分别为 D 与 D+1；`serverTime` 偏移为 `+08:00`；跨日不合并 |
| E-15 | 夹具分别提供 `userTotal=0` 与 `userTotal=null` | `0` 时 KPI 显示 `0` 且卡片可见；`null` 时卡片隐藏并出现 `PERMISSION_DENIED` 或 `UNAVAILABLE`；两种状态 DOM 不同 |
| E-16 | 用户在工作台 500ms 内连续点击刷新两次 | 仅 1 个 `GET /dashboard/workbench` 在途；结束后任务行仍为 7 条且无重复；`pageerror` 计数 = 0 |
| E-17 | 后端返回 `loginTrend` 只有 6 项 | 契约测试按 schema `minItems=7,maxItems=7` 判失败；前端进入错误态，不渲染 6 点趋势图；`pageerror` 计数 = 0 |
| E-18 | 流程定义覆盖 SLA=0（显式禁用） | 该流程待办 `dueTime=null`、`priority=UNSCHEDULED`，计入 `groupCounts.unscheduled` 并出现在 `groups.unscheduled`；不产生 `INVALID_DATA` warning |
| E-19 | `dashboard.workbench.defaultSlaHours=0`、负数或大于 168 | 配置非法：应用启动失败并记录配置键；不存在可返回的 200 响应，不得静默回退到 72 |
| E-20 | `dashboard.workbench.slaHoursByFlow.leave=169`（覆盖值大于 168） | 配置非法：应用启动失败并记录配置键与流程编码；不得把该覆盖值当作有效 SLA，也不得静默回退到默认值 |

## 4. 数据契约

### 4.1 接口与封装

- `GET /dashboard/home`：当前登录用户与当前租户的首页聚合数据；无查询参数；响应 `R<HomeResponse>`。
- `GET /dashboard/workbench`：当前登录用户与当前租户的工作台聚合数据；无查询参数；响应 `R<WorkbenchResponse>`。
- 认证沿用现有 `Authorization: Bearer <token>`；租户从登录上下文解析，不接受请求参数覆盖。
- 两个接口均为只读；不产生业务写入，不修改任务状态。

### 4.2 HomeResponse

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `serverTime` | string | 否 | — | ISO8601，Asia/Shanghai，形如 `2026-11-08T10:32:00+08:00` |
| `metrics` | object | 否 | — | 五项指标；子字段可为 `null` |
| `metrics.userTotal` | integer | 是 | `null` 表示无 `system:user:list` 权限或查询不可用；`0` 表示真实零用户 | ≥0 |
| `metrics.onlineTotal` | integer | 是 | `null` 表示无 `monitor:online:list` 权限或查询不可用；`0` 表示真实零在线 | ≥0 |
| `metrics.todoTotal` | integer | 是 | `null` 表示工作流模块不可用；`0` 表示真实零待办 | 当前用户待办数 |
| `metrics.todayLoginTotal` | integer | 是 | `null` 表示无 `monitor:logininfor:list` 权限或查询不可用；`0` 表示真实零登录 | ≥0 |
| `metrics.todayErrorLogTotal` | integer | 是 | `null` 表示无 `monitor:operlog:list` 权限或查询不可用；`0` 表示真实零错误日志 | ≥0 |
| `loginTrend` | array | 是 | `null` 表示无权限或查询不可用；不是 `[]` | 恰好 7 项，按日期升序 |
| `loginTrend[].date` | string | 否 | — | `YYYY-MM-DD`，Asia/Shanghai |
| `loginTrend[].count` | integer | 否 | `0` 表示该日真实零登录 | ≥0 |
| `deptDistribution` | array | 是 | `null` 表示无权限或查询不可用；不是 `[]` | 最多 5 项，按 `userCount` 降序、同值按 `deptId` 升序 |
| `deptDistribution[].deptId` | string | 否 | — | 雪花 ID 字符串，避免 JS 精度丢失 |
| `deptDistribution[].deptName` | string | 否 | — | 1～30 字符 |
| `deptDistribution[].userCount` | integer | 否 | `0` 表示该部门真实零用户 | ≥0 |
| `health` | object | 是 | `null` 表示无 `monitor:admin:list` 权限或探活不可用 | 见 4.3 |
| `notices` | array | 是 | `null` 表示无 `system:notice:list` 权限；`[]` 表示有权限且确实无公告 | 最多 3 项 |
| `notices[].noticeId` | string | 否 | — | 雪花 ID 字符串 |
| `notices[].title` | string | 否 | — | 1～100 字符 |
| `notices[].noticeType` | string | 否 | — | 取值来自 `sys_notice_type` 字典 |
| `notices[].noticeTypeLabel` | string | 否 | — | 字典标签，中文；用于页面标签文本 |
| `notices[].publishTime` | string | 是 | `null` 表示发布时间未设置 | ISO8601，Asia/Shanghai |
| `recentLogins` | array | 是 | `null` 表示无 `monitor:logininfor:list` 权限；`[]` 表示无记录 | 最多 5 项，按登录时间降序 |
| `recentLogins[].userName` | string | 否 | — | 1～30 字符 |
| `recentLogins[].ipaddr` | string | 否 | — | IPv4 或 IPv6；接口仅对有权限用户返回 |
| `recentLogins[].loginTime` | string | 否 | — | ISO8601，Asia/Shanghai |
| `recentLogins[].status` | string | 否 | — | 枚举 `SUCCESS` / `FAIL` |
| `recentOperations` | array | 是 | `null` 表示无 `monitor:operlog:list` 权限；`[]` 表示无记录 | 最多 5 项，按操作时间降序 |
| `recentOperations[].operName` | string | 否 | — | 1～30 字符 |
| `recentOperations[].title` | string | 否 | — | 1～50 字符 |
| `recentOperations[].operTime` | string | 否 | — | ISO8601，Asia/Shanghai |
| `recentOperations[].status` | string | 否 | — | 枚举 `SUCCESS` / `FAIL` |
| `warnings` | array | 否 | — | 空数组表示完整；非空表示部分字段不可用 |
| `warnings[].field` | string | 否 | — | JSON 路径，如 `metrics.userTotal`、`loginTrend` |
| `warnings[].code` | string | 否 | — | 枚举 `PERMISSION_DENIED` / `TIMEOUT` / `UNAVAILABLE` / `INVALID_DATA` |

### 4.3 health 对象

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `status` | string | 否 | — | 枚举 `UP` / `DEGRADED` / `DOWN` / `UNKNOWN` |
| `services` | array | 否 | — | 固定 4 项：应用服务、MySQL、Redis、任务调度 |
| `services[].name` | string | 否 | — | 固定中文名 |
| `services[].status` | string | 否 | — | 枚举 `UP` / `DEGRADED` / `DOWN` / `UNKNOWN` |
| `services[].latencyMs` | integer | 是 | `null` 表示未测量；`0` 表示耗时小于 1ms | 0～60000 |
| `cpuUsage` | integer | 是 | `null` 表示未采集；`0` 表示真实零负载 | 0～100，单位 % |
| `memoryUsage` | integer | 是 | `null` 表示未采集；`0` 表示真实零占用 | 0～100，单位 % |
| `diskUsage` | integer | 是 | `null` 表示未采集；`0` 表示真实零占用 | 0～100，单位 % |

派生规则：MySQL 或 Redis 任一 `DOWN` → `status=DOWN`；存在 `UNKNOWN` 或 `latencyMs` > 1000
→ `status=DEGRADED`；四项均 `UP` 且延迟 ≤ 1000 → `status=UP`；无采集数据 → `status=UNKNOWN`。

### 4.4 WorkbenchResponse

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `serverTime` | string | 否 | — | 同 4.2 |
| `metrics.todoTotal` | integer | 是 | `null` 表示工作流不可用；`0` 表示真实零待办 | ≥0 |
| `metrics.doneTotal` | integer | 是 | `null` 表示工作流不可用；`0` 表示真实零已办 | 当前用户已办总数；“近 7 天完成数”见 `efficiency.completedThisWeek` |
| `metrics.initiatedTotal` | integer | 是 | `null` 表示工作流不可用；`0` 表示真实零发起 | 当前用户我发起数 |
| `metrics.copyTotal` | integer | 是 | `null` 表示工作流不可用；`0` 表示真实零抄送 | 当前用户抄送数 |
| `groupCounts` | object | 否 | — | 四项整数；`metrics.todoTotal` 非 `null` 时和等于它；`todoTotal=null` 时四项均为 0 |
| `groupCounts.overdue` | integer | 否 | `0` 表示真实零超时 | ≥0 |
| `groupCounts.today` | integer | 否 | `0` 表示真实零今日到期 | ≥0 |
| `groupCounts.next7Days` | integer | 否 | `0` 表示真实零未来 7 天到期 | ≥0 |
| `groupCounts.unscheduled` | integer | 否 | `0` 表示真实零无截止时间 | ≥0 |
| `groups.overdue` | array | 否 | — | 截止时间 < 当前时刻；最多 50 项 |
| `groups.today` | array | 否 | — | `dueTime >= 当前时刻` 且截止日期 = 今天（Asia/Shanghai） |
| `groups.next7Days` | array | 否 | — | 截止日期 > 今天且 ≤ 今天+7 天 |
| `groups.unscheduled` | array | 否 | — | `dueTime=null`（SLA 显式禁用或无法派生）；页面仅在非空时显示 `未设截止` 分组 |
| `groups.*[].taskId` | string | 否 | — | 雪花 ID 字符串；同一响应内唯一 |
| `groups.*[].flowName` | string | 否 | — | 1～50 字符 |
| `groups.*[].initiatorName` | string | 否 | — | 1～30 字符 |
| `groups.*[].nodeName` | string | 否 | — | 1～50 字符 |
| `groups.*[].dueTime` | string | 是 | `null` 表示未设截止（SLA 显式禁用）；不是“今天” | ISO8601，Asia/Shanghai；`rawCreateTime + 生效 SLA` 的派生值 |
| `groups.*[].overdueHours` | integer | 是 | `null` 表示未超时或未设截止；`0` 表示正好到点 | ≥0；按派生 `dueTime` 计算 |
| `groups.*[].priority` | string | 否 | — | 枚举 `OVERDUE` / `TODAY` / `NEXT_7_DAYS` / `UNSCHEDULED` |
| `efficiency.completedThisWeek` | integer | 否 | `0` 表示近 7 天真实零完成 | ≥0；字段名保留以兼容契约，语义为“近 7 天完成数”，窗口见下方 v1.2 规则 |
| `efficiency.weeklyTarget` | integer | 否 | — | ≥1；来自配置 `dashboard.workbench.weeklyTarget`，缺省 20 |
| `efficiency.avgHandleHours` | number | 是 | `null` 表示近 7 天无已完成样本；`0.0` 表示平均小于 0.05 小时 | BigDecimal，1 位小数、四舍五入，≥0 |
| `efficiency.overdueRate` | integer | 是 | `null` 表示近 7 天无已完成样本；`0` 表示真实零超时率 | 0～100，单位 %；分母为 `completedThisWeek`，四舍五入到整数 |
| `flowProgress` | array | 否 | — | 最多 5 项；运行中实例 |
| `flowProgress[].instanceId` | string | 否 | — | 雪花 ID 字符串 |
| `flowProgress[].flowName` | string | 否 | — | 1～50 字符 |
| `flowProgress[].nodeName` | string | 否 | — | 当前节点名称 |
| `flowProgress[].progressPercent` | integer | 是 | `null` 表示无法计算总节点数；`0` 表示零进度 | 0～100 |
| `flowProgress[].estimatedEndDate` | string | 是 | `null` 表示未估算 | `YYYY-MM-DD`，Asia/Shanghai |
| `commonFlows` | array | 否 | — | 最多 8 项 |
| `commonFlows[].definitionId` | string | 否 | — | 雪花 ID 字符串 |
| `commonFlows[].name` | string | 否 | — | 1～50 字符 |
| `warnings` | array | 否 | — | 同 4.2 |

> **v1.1 dueTime 派生与分组规则（CLAR-011 裁决 B）：**
>
> 1. 生效 SLA：`dashboard.workbench.slaHoursByFlow[flowCode]` 存在时优先；否则使用
>    `dashboard.workbench.defaultSlaHours`（缺省 72）。`flowCode` 缺失时使用默认值。
> 2. `dueTime = rawCreateTime + 生效 SLA` 小时，按 Asia/Shanghai 输出。`rawCreateTime` 必须取
>    `FlowTask` 实体或 `flow_task.create_time` 的原始 `Date`；**禁止**使用
>    `FlowTaskVo.getCreateTime()`，该 getter 返回 `DateUtils.formatFriendlyTime` 的友好化字符串。
> 3. 覆盖值 `0` 表示该流程显式禁用 SLA：`dueTime=null`，进入 `unscheduled`。`defaultSlaHours`
>    必须为 1～168；覆盖值必须为 0 或 1～168。默认值 0/负数/大于 168、覆盖值负数/大于 168
>    均属非法配置，启动失败，不得静默回退。上限 168h 保证 `createTime <= now` 的任务
>    `dueTime <= now + 7 天`，四组之和恒等于 `todoTotal`。
> 4. 四个分组互斥，按 `OVERDUE → TODAY → NEXT_7_DAYS → UNSCHEDULED` 顺序判定：
>    `dueTime < now` 为 `OVERDUE`；否则 `dueTime` 日期 = 今天为 `TODAY`；否则日期在
>    `[D+1, D+7]` 为 `NEXT_7_DAYS`；`dueTime=null` 为 `UNSCHEDULED`。每个待办只进入一个组，
>    保证 `groupCounts` 四项之和 = `todoTotal`。
> 5. `dueTime` 是请求时派生值，不持久化、不写回 `flow_task`；随当前时间变化，同一任务可在
>    不同请求中跨组；不得缓存派生结果。

> **v1.2 效率统计规则（CLAR-012 裁决 B）：**
>
> 1. 统计窗口为请求时刻往前 7×24 小时，闭区间 `[now - 7 days, now]`；不使用自然周。
> 2. `completedThisWeek` = 当前用户在 `flow_his_task.approver` 下的记录中 `update_time` 落在
>    窗口内的数量。字段名保留 `completedThisWeek` 以兼容契约，语义为“近 7 天完成数”。
> 3. `avgHandleHours` = 上述记录 `update_time - create_time` 的平均小时数，BigDecimal 1 位小数、
>    四舍五入。
> 4. `overdueRate` = 上述记录中 `update_time > 派生 dueTime` 的记录占比，分母为
>    `completedThisWeek`，四舍五入到整数；`completedThisWeek=0` 时 `avgHandleHours` 与
>    `overdueRate` 均为 `null`。
> 5. 上述记录必须取 `FlowHisTask` 实体的原始 `Date`；**禁止**使用
>    `FlowHisTaskVo.getCreateTime()`，该 getter 返回友好化字符串。
> 6. 窗口按瞬时计算，日期展示统一转 Asia/Shanghai；同一记录只进入一个统计窗口，不缓存结果。

### 4.5 时间、精度与枚举

- 所有日期时间使用 Asia/Shanghai；接口输出带 `+08:00` 偏移；数据库时间字段按平台既有约定存储。
- `dueTime` 由 `flow_task.create_time` 的原始值与生效 SLA 派生，不新增数据库列、不做回填；
  `FlowTaskVo.getCreateTime()` 返回友好化字符串，不得用于计算（见 §4.4 规则 2）。
- `avgHandleHours` 使用 `BigDecimal`，保留 1 位小数、四舍五入；其余百分比为整数。
- `efficiency` 统计窗口为请求时刻往前 7×24 小时（含边界），不使用自然周；
  `completedThisWeek` 字段名保留，语义为“近 7 天完成数”；`overdueRate` 分母为该窗口完成数，
  四舍五入到整数。
- 枚举全量：`health.status` / `services[].status` = `UP|DEGRADED|DOWN|UNKNOWN`；
  `recentLogins[].status` / `recentOperations[].status` = `SUCCESS|FAIL`；
  `groups.*[].priority` = `OVERDUE|TODAY|NEXT_7_DAYS|UNSCHEDULED`；
  `warnings[].code` = `PERMISSION_DENIED|TIMEOUT|UNAVAILABLE|INVALID_DATA`。
- `null` 与 `0` 不得混用：`null` 只表示“无权限 / 未采集 / 不可用 / 未设置”，
  `0` 只表示“已采集且确实为零”。每个 `null` 字段必须在 `warnings` 中有对应条目；
  `[]` 表示“有权限且确实无记录”，不产生 warning。

> 已确认口径：任务调度探活未配置时 `services[].status=UNKNOWN`，健康总状态按派生规则
> 变为 `DEGRADED`；若后续要求显示 `UP`，必须提供 SnailJob 探活配置，整段断言需重写。

## 5. 非功能约束

- **性能口径**：`GET /dashboard/home` 在 100 并发、1,000 用户、10,000 条登录日志、
  5,000 条操作日志、200 个部门的数据量下 P95 ≤ 800ms；`GET /dashboard/workbench`
  在 100 并发、当前用户 7 条待办下 P95 ≤ 500ms；单响应 ≤ 200KB。前端骨架出现 ≤ 300ms，
  数据完成后 LCP ≤ 2.5s（1440×900、100Mbps、Edge 120+）。
- **安全（鉴权 / 脱敏）**：两个接口均要求登录；租户从登录上下文解析，禁止通过请求参数
  指定其它租户；字段级权限按 §4.6 映射；日志中的 `ipaddr` 脱敏为 `10.12.*.*`，
  接口仅向具备对应权限的管理员返回原始 IP；健康数据仅向具备 `monitor:admin:list` 的用户返回。
- **合规（留痕 / 审计）**：本需求只读，不写业务审计；失败请求记录 `traceId`、`tenantId`、
  `userId`、`path`、`durationMs`、`warnings[].code`；登录/操作日志保留策略沿用平台既有配置。
- **可观测**：输出 Micrometer 计数器 `dashboard.home.requests`、`dashboard.home.partial`、
  `dashboard.workbench.requests`，计时器 `dashboard.home.duration`、
  `dashboard.workbench.duration`；日志字段包含 `traceId`、`tenantId`、`userId`、`durationMs`。
- **可访问性**：文本对比度满足 WCAG AA；状态使用“圆点 + 文本”，不只依赖颜色；筛选与刷新
  可用键盘操作；趋势图提供等价数据表（`[data-testid="home-trend-table"]`）。
- **兼容性**：Edge/Chrome ≥120；1440×900、1280×720、1024×768；不承诺移动端/H5 布局。

### 4.6 字段权限映射

| 字段 | 所需权限码 | 无权限时 |
|---|---|---|
| `metrics.userTotal`、`deptDistribution` | `system:user:list` 且 `system:dept:list` | 字段 `null` + `PERMISSION_DENIED` |
| `metrics.onlineTotal` | `monitor:online:list` | 字段 `null` + `PERMISSION_DENIED` |
| `metrics.todayLoginTotal`、`loginTrend`、`recentLogins` | `monitor:logininfor:list` | 字段 `null` + `PERMISSION_DENIED` |
| `metrics.todayErrorLogTotal`、`recentOperations` | `monitor:operlog:list` | 字段 `null` + `PERMISSION_DENIED` |
| `health` | `monitor:admin:list` | 字段 `null` + `PERMISSION_DENIED` |
| `notices` | `system:notice:list` | 字段 `null` + `PERMISSION_DENIED`；不显示公告卡 |
| `metrics.todoTotal`、工作台全部字段 | 登录即可；按当前用户过滤 | 工作流不可用时 `null` + `UNAVAILABLE` |

> 已确认口径：`monitor:admin:list` 是既有菜单权限码，但当前后端没有 Admin 控制器；
> 本需求新增的只读健康接口沿用该权限码，不新增权限码。若架构后续要求新权限码，需重写本节与 A-04。

## 6. 状态流转

- 首页与工作台均为**只读视图**，不改变任务、流程、用户、公告等业务状态。
- `dueTime`、`overdueHours` 与 `groupCounts` 是请求时派生值，不写回任务；SLA 配置变更在
  下一次请求生效，不回填历史任务，也不改变既有工作流状态机。
- 任务办理状态仍由既有工作流状态机管理；“办理”按钮只跳转既有任务页，不在本页面调用
  `completeTask`；非法状态迁移由既有工作流接口拒绝，本需求不新增迁移规则。
- 健康 `status` 是派生状态，不持久化：`UP → DEGRADED → DOWN` 由 §4.3 规则实时计算；
  `UNKNOWN` 表示探活数据缺失；状态变化在下一次请求生效。
- 响应完整性状态：`warnings=[]` 为 `COMPLETE`；`warnings` 非空且 HTTP 200 为 `PARTIAL`；
  令牌无效为 HTTP 401；聚合服务整体异常为 HTTP 500。`PARTIAL` 不得返回错误码。
- 工作流模块从启用变为停用：字段由数值变为 `null` + `UNAVAILABLE`；重新启用后下一次请求
  恢复数值；不做数据迁移。

## 7. Non-goals（必填）

- 不做 C 方案的角色门户、管理员/业务用户双首页、可拖拽组件、组件隐藏与布局持久化。
- 不修改登录、注册、租户选择、令牌刷新与权限模型；不新增权限码。
- 不修改工作流状态机、任务详情页、批量办理、催办、驳回、转办；工作台“办理”只做跳转。
- 不内嵌 Spring Boot Admin 页面，不代理 SBA UI；健康卡只消费新增只读接口。
- 不新增前端运行时依赖；图表使用 `@vben/plugins/echarts`，不引入第二套图表库。
- 不新增正式主题或皮肤；使用 Vben 既有 CSS 变量与明暗主题令牌。
- 不做移动端/H5 专属布局；只保证 1024px 及以上桌面宽度。
- 不做历史趋势分析、报表导出、数据归档、跨租户汇总；趋势固定 7 天，部门固定 Top 5。
- 不删除 `/dashboard/analytics` 示例路由；不改变其行为。
- 不做数据回填或 DDL；不修改 `flow_task` 表结构。仅新增配置种子
  `dashboard.workbench.weeklyTarget=20`、`dashboard.workbench.defaultSlaHours=72`；
  流程级覆盖键 `dashboard.workbench.slaHoursByFlow.<flowCode>` 可选，不要求种子。
- 不把 `specs/_drafts/` 草稿或原型 mock 数据接入生产；所有展示值来自聚合接口。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | 管理员请求 `GET /dashboard/home`，夹具完整 | HTTP 200；`metrics` 五项为 1286/48/7/213/3；`loginTrend` 7 项合计 1290；`deptDistribution` 5 项；`warnings=[]` |
| 正例 | 仅有公告权限的用户请求同一接口 | HTTP 200；9 个系统字段为 `null`；`notices.length=3`；`metrics.todoTotal=7`；`warnings` 含 9 条 `PERMISSION_DENIED` |
| 正例 | 空租户请求同一接口 | HTTP 200；`metrics.userTotal=0`；`deptDistribution=[]`；`notices=[]`；`loginTrend` 7 项均为 0；`warnings=[]` |
| **反例** | 响应中 `loginTrend` 只有 6 项，且用 `userTotal=0` 表示“无权限” | **必须被拒绝**：契约测试按 `minItems=7,maxItems=7` 失败；前端进入错误态，不渲染 6 点趋势图；`userTotal` 视为无权限应使用 `null` + `PERMISSION_DENIED`，不得显示 `0` |

> **v1.1 工作台派生正例**：默认 SLA=72 时，`flow_task.create_time=D-4d 08:00` 派生
> `dueTime=D-1d 08:00+08:00`，`priority=OVERDUE`；流程 `leave` 覆盖
> `dashboard.workbench.slaHoursByFlow.leave=0` 时，`dueTime=null`、`priority=UNSCHEDULED`。
>
> **v1.2 效率统计正例**：窗口为请求时刻往前 7×24 小时；窗口内 12 条当前用户
> `flow_his_task` 记录，`update_time - create_time` 平均为 3.2 小时，其中 1 条完成时间晚于
> 派生 `dueTime` → `completedThisWeek=12`、`avgHandleHours=3.2`、`overdueRate=8`
> （1/12 四舍五入）、`weeklyTarget=20`。

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 0.1 | 草稿初版（A 首页 + B 工作台；新增只读聚合接口与权限降级） | 2026-11-08 | 草稿历史，无交付效力 |
| 1.0 | 正式签字版 | 2026-11-08 | aoyousky / Jim Liu / Jiankui zhang |
| 1.1 | CLAR-011 裁决 B：`dueTime` 改为 `create_time + SLA` 派生；新增 SLA 配置；不新增 DDL；补充互斥分组规则 | 2026-11-08 | aoyousky / Jim Liu / Jiankui zhang |
| 1.2 | CLAR-012 裁决 B：效率统计改为请求时刻往前 7×24 小时窗口；平均时长为节点任务时长；超时率以窗口完成数为分母；字段名 `completedThisWeek` 保留 | 2026-11-08 | aoyousky / Jim Liu / Jiankui zhang |
| 1.3 | CLAR-013 裁决 A：E-05 部门名夹具改为 30 字符；`deptDistribution[].deptName` 契约改为 1～30；不新增 DDL | 2026-11-08 | aoyousky / Jim Liu / Jiankui zhang |
| 1.4 | CLAR-014 裁决 A：生效 SLA 上限 168h；默认值与覆盖值超出范围或默认值为 0/负数时启动失败；保持四组契约 | 2026-11-08 | aoyousky / Jim Liu / Jiankui zhang |

## 10. 已确认假设汇总

1. 已确认假设 1 — **需求编号与分支**：`REQ-20261108-006`、开发分支 `005-home-workbench`；trace 随实现建立。
2. 已确认假设 2 — **后端落点**：聚合控制器放在 `platform/aoyou-admin` 的 `web/controller` 与 `web/service`，不新建模块；如需变更，按铁律 2 STOP。
3. 已确认假设 3 — **任务调度探活**：未配置 SnailJob 探活时状态为 `UNKNOWN`，健康总状态为 `DEGRADED`；A-04 与 §4.3 按此执行。
4. 已确认假设 4 — **周目标配置**：`dashboard.workbench.weeklyTarget` 缺省 20，新增一条配置种子；若无法新增，按铁律 2 STOP。
5. 已确认假设 5 — **“未来 7 天”分组与 dueTime 派生（v1.1）**：工作台第三组按滚动 7 天窗口（今天+1～今天+7）计算，不使用自然周；页面文案使用 `未来 7 天`。`dueTime = flow_task.create_time + 生效 SLA`；默认 `dashboard.workbench.defaultSlaHours=72`，流程级覆盖 `dashboard.workbench.slaHoursByFlow.<flowCode>`，覆盖值 0 表示禁用 SLA，`dueTime=null` 进入 `未设截止` 分组；不修改 `flow_task` 表结构。原型当前文案为 `本周`，实现时同步改动并重截 B 首页/B 工作台截图。
6. 已确认假设 6 — **流程进度**：`progressPercent = 已完成审批节点数 / 总审批节点数 × 100`，向下取整；总节点数不可得时按 §4.4 返回 `null`，页面不显示百分比。
7. 已确认假设 7 — **路由**：`/index` 保留常量路由与 FR-015 属性，只替换视图组件；工作台复用既有 `/dashboard/workspace` 路径，替换 Vben 示例组件，不新增路由。
8. 已确认假设 8 — **权限码**：健康卡沿用既有 `monitor:admin:list`，其余字段使用 §4.6 的既有权限码；不新增权限码。
9. 已确认假设 9 — **时区**：所有租户统一按 Asia/Shanghai 计算日界；不支持租户自定义时区。
10. 已确认假设 10 — **公告与日志条数**：公告最多 3 条、最近登录最多 5 条、最近操作最多 5 条；管理员可见完整 `ipaddr`。
11. 已确认假设 11 — **租户口径**：用户总数、部门分布、在线数均按当前租户统计；不提供跨租户汇总。
12. 已确认假设 12 — **批量操作**：工作台批量勾选只控制按钮可用状态，批量办理不在本期范围；A-14 仅验证选择与刷新。
13. 已确认假设 13 — **近 7 天效率口径（v1.2）**：`completedThisWeek`/`avgHandleHours`/`overdueRate` 按请求时刻往前 7×24 小时（含边界）统计；平均时长为当前节点任务 `update_time - create_time`；超时率为窗口内完成时间晚于派生 `dueTime` 的占比，分母为窗口完成数；`completedThisWeek=0` 时两项为 `null`。
14. 已确认假设 14 — **部门名长度（v1.3）**：`sys_dept.dept_name` 为 `varchar(30)`，E-05 使用 30 字符夹具，`deptDistribution[].deptName` 契约上限 30；不新增 DDL。
15. 已确认假设 15 — **SLA 上限（v1.4）**：默认 SLA 与流程覆盖值上限均为 168h；默认值必须为 1～168，覆盖值必须为 0 或 1～168；越界配置启动失败。该上限保证四组覆盖全部待办，`groupCounts` 之和恒等于 `todoTotal`。
