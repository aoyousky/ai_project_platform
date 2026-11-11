---
id: REQ-20261111-007
title: 系统监控模块前端交付（在线用户 / Admin 监控 / 缓存监控 / 任务调度中心）
generated_from: 用户原话「针对系统监控模块前端交付」＋2026-11-11 范围与交互裁决（4 个视图、沿用 iframe、单条＋前端批量、缓存仅基本信息＋图表）
version: 1.0
risk_level: L2
channel: ai_forced_review
pm: aoyousky 2026-11-11
business_signoff: Jim Liu 2026-11-11
arch_reviewer: jiankui zhang 2026-11-11
target_window: 2026-11-11 ~ 2026-11-25
speckit_feature: specs/007-system-monitor
---

> 本文件是**交付与验收的唯一依据**（签名版 Spec Packet）。`version` 变更必须走升版流程。
>
> **风险级别（L2）判断理由**：在线用户页展示会话编号、登录 IP 与登录地点，属数据敏感面；强退会直接影响在线会话，影响面覆盖全部在线用户；不涉及资金、不对第三方作出承诺。**渠道 `ai_forced_review`**：L2 且涉及会话处置，自动评审后必须人工复核 12 项 checklist。
>
> 已确认：需求编号 `REQ-20261111-007`，`target_window` 为 2026-11-11 至 2026-11-25；PM、业务签字人与架构评审人已填写（2026-11-11）。

## 1. 意图

- **业务目标（含量化指标）**：在 `frontend/apps/web-antdv-next` 完成系统监控模块 4 个视图——在线用户、Admin 监控、缓存监控、任务调度中心——的列表、筛选、分页、单条强退、前端批量强退、缓存基本信息与图表展示、外部控制台内嵌。DoD 内指标：本 Packet 的 10 条 P0 断言全部通过；4 个菜单「即将推出」占位页出现次数为 0；`pageerror` 计数为 0；越权按钮可见数量为 0；`platform/` 与 `frontend/packages/**` 变更数为 0；新增前端依赖数为 0。
- **调用方 / 场景 / 频率**：平台超级管理员与具备监控权限的运维人员；桌面端现代浏览器、中文界面；在线用户在排障、安全处置与并发会话核对时使用；缓存监控在 Redis 巡检时使用；Admin 监控与任务调度中心作为官方控制台的统一入口，日常低频访问。
- **上线 30 天成功度量（不计入 DoD）**：交付后 30 天内「在线用户列表打不开」「强退后列表不刷新」「缓存监控白屏」「监控入口 404」类工单数为 0。该指标为滞后指标，交付时不可验证，转为上线回顾。

## 2. 验收断言

> 夹具定义：`spec007_online` 具备 2 个有效在线会话（同一 IP、`deviceType=pc`）；`spec007_limited` 仅具备 `monitor:online:list`；`spec007_no_monitor` 不具备任何 `monitor:*` 权限；`admin` 使用 `*:*:*` 超级管理员令牌。在线会话由评测夹具通过两次登录创建；`spec007_online` 的 2 个 `tokenId` 在用例内动态读取，不写死。
> UI 断言由 Playwright 执行，HTTP 断言由 `specs/evals/run.py` 执行。

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | `spec007_online` 已建立 2 个有效会话；`admin` 已登录 | 打开 `/monitor/online`，不填筛选条件 | `GET /monitor/online/list` 返回 HTTP 200 且 `code=200`；`total = rows.length`；表格中 `userName=spec007_online` 的行数量 = 2；表头「会话编号」「登录名称」「客户端」「设备类型」「所属部门」「主机」「登录地点」「操作系统」「浏览器」「登录时间」各出现 1 次；`pageerror` 计数 = 0 |
| A-02 | P0 | 同 A-01 | 先填 `userName=spec007_online` 与首行的 `ipaddr` 值查询；再改为 `userName=spec007_not_exist` 查询 | 第一次 `total=2` 且 2 行同时匹配 `userName` 与 `ipaddr`；第二次 `total=0`、`rows=[]`，表格显示「暂无数据」；两次 `pageerror` 计数 = 0 |
| A-03 | P0 | `spec007_online` 有 1 个会话显示在列表中 | 点击该行「强退」按钮，在确认弹窗点「确定」 | 发出 1 次 `DELETE /monitor/online/{tokenId}`，HTTP 200 且 `code=200`；刷新后 `GET /monitor/online/list` 的 `rows` 不含该 `tokenId`；`total` 比操作前少 1；页面提示文案「强退成功」；`pageerror` 计数 = 0 |
| A-04 | P0 | `spec007_online` 有 2 个会话；`admin` 勾选这 2 行 | 点击「批量强退」，在确认弹窗点「确定」 | 发出 2 次 `DELETE /monitor/online/{tokenId}`，每次 HTTP 200 且 `code=200`；刷新后 2 个 `tokenId` 均不在 `rows`；`total` 比操作前少 2；页面提示文案包含「成功 2 条，失败 0 条」；`pageerror` 计数 = 0 |
| A-05 | P0 | 同 A-04；Playwright 将其中 1 次 `DELETE` 拦截并返回 HTTP 500 与 `{"code":500,"msg":"服务器错误"}` | 执行批量强退 | 仍发出 2 次 `DELETE`；页面提示文案同时包含「成功 1 条，失败 1 条」与「服务器错误」；被成功删除的 `tokenId` 不在列表，失败对应的行仍在列表；`pageerror` 计数 = 0 |
| A-06 | P0 | Redis 可用；`GET /monitor/cache` 返回 HTTP 200 且 `code=200` | 打开 `/monitor/cache` | 12 个标签「Redis版本」「运行模式」「端口」「客户端数」「运行时间(天)」「使用内存」「使用CPU」「内存配置」「AOF是否开启」「RDB是否成功」「Key数量」「网络入口/出口」各出现 1 次；`[data-testid="cache-db-size"]` 文本等于响应 `dbSize` 的十进制字符串；`[data-testid="cache-info-table"]` 可见；`pageerror` 计数 = 0 |
| A-07 | P0 | 同 A-06，且 `commandStats` 数组长度 ≥ 1 | 打开 `/monitor/cache` | `[data-testid="cache-command-chart"]` 内 `canvas` 元素数量 = 1；`[data-testid="cache-memory-chart"]` 内 `canvas` 元素数量 = 1；两个 `canvas` 的 `width ≥ 100` 且 `height ≥ 100`；`pageerror` 计数 = 0 |
| A-08 | P0 | 评测环境设置 `VITE_GLOB_MONITOR_ADMIN_URL=http://localhost:9090/admin/applications` | 打开 `/monitor/Admin` | `[data-testid="monitor-iframe"]` 元素数量 = 1，且其 `src` 属性值等于上述地址；`[data-testid="monitor-open-external"]` 的 `href` 属性值等于上述地址；iframe 渲染高度 ≥ 400；`pageerror` 计数 = 0 |
| A-09 | P0 | 评测环境设置 `VITE_GLOB_SNAILJOB_ADMIN_URL=http://localhost:8800/snail-job` | 打开 `/monitor/snailjob` | `[data-testid="monitor-iframe"]` 元素数量 = 1，且其 `src` 属性值等于上述地址；`[data-testid="monitor-open-external"]` 的 `href` 属性值等于上述地址；iframe 渲染高度 ≥ 400；`pageerror` 计数 = 0 |
| A-10 | P0 | `spec007_limited` 仅具备 `monitor:online:list` 权限并已登录 | 打开 `/monitor/online` | 在线列表可见且 `total ≥ 1`；`[data-testid="online-force-logout"]` 元素数量 = 0；`[data-testid="online-batch-logout"]` 元素数量 = 0；`pageerror` 计数 = 0 |

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 筛选无匹配（`userName=spec007_not_exist`） | `total=0`、`rows=[]`；表格显示「暂无数据」；页面不弹错误提示；`pageerror` 计数 = 0 |
| E-02 | `ipaddr` 与 `userName` 同时填写且都匹配 1 个会话 | 返回行同时满足两个条件（AND 语义），`total=1`；只有任一条件匹配的行不得出现在结果 |
| E-03 | 筛选值含特殊字符（`userName=' OR 1=1`） | HTTP 200 且 `code=200`；`total=0`、`rows=[]`；HTTP 状态码 ≠ 500；`pageerror` 计数 = 0 |
| E-04 | 有效在线会话数量 = 12，超过每页 10 条上限 | 第 1 页表格行数量 = 10；`total=12`；点击第 2 页后行数量 = 2；翻页期间 `GET /monitor/online/list` 累计请求次数 = 1；`pageerror` 计数 = 0 |
| E-05 | 选中会话在强退前已从 Redis 过期，`tokenId` 仍显示在本页 | `DELETE` 返回 HTTP 200 且 `code=200`；刷新后该行不在列表；页面不弹错误提示；`pageerror` 计数 = 0 |
| E-06 | 批量强退 2 条，其中 1 次 `DELETE` 在 5 秒后超时 | 仍发起 2 次请求；提示包含「成功 1 条，失败 1 条」；失败条目展示请求层统一网络错误文案；`pageerror` 计数 = 0 |
| E-07 | 未勾选任何行 | `[data-testid="online-batch-logout"]` 处于 `disabled` 状态；点击后 `DELETE` 请求次数 = 0 |
| E-08 | 勾选 1 行后在批量确认弹窗点「取消」 | `DELETE` 请求次数 = 0；勾选状态保持；`pageerror` 计数 = 0 |
| E-09 | `GET /monitor/cache` 返回 HTTP 500 与 `{"code":500,"msg":"Redis 连接失败"}` | 页面展示后端 `msg` 原文「Redis 连接失败」；`[data-testid="cache-info-table"]` 不渲染；两个图表容器内 `canvas` 数量均为 0；`pageerror` 计数 = 0 |
| E-10 | `GET /monitor/cache` 的 `info` 缺少 `redis_version`，其余键存在 | 「Redis版本」单元格文本为「—」；其余 11 个字段正常显示；`pageerror` 计数 = 0 |
| E-11 | `commandStats=[]` | `[data-testid="cache-command-chart"]` 显示「暂无数据」且 `canvas` 数量 = 0；`[data-testid="cache-memory-chart"]` 的 `canvas` 数量 = 1；`pageerror` 计数 = 0 |
| E-12 | `VITE_GLOB_MONITOR_ADMIN_URL` 为空字符串，属非法状态（未配置） | `[data-testid="monitor-iframe"]` 元素数量 = 0；页面显示「未配置监控地址」；`[data-testid="monitor-open-external"]` 处于 `disabled` 状态；`pageerror` 计数 = 0 |
| E-13 | Admin 控制台地址连接被拒绝 | `[data-testid="monitor-iframe"]` 元素数量 = 1；`[data-testid="monitor-open-external"]` 可点击且 `href` 等于配置地址；页面不弹出前端自造的错误弹窗；`pageerror` 计数 = 0 |
| E-14 | `spec007_limited` 不具备 `monitor:cache:list`，越权直达 `/monitor/cache` | 显示 404 页面；`GET /monitor/cache` 请求次数 = 0；`pageerror` 计数 = 0 |
| E-15 | `spec007_no_monitor` 不具备任何 `monitor:*` 权限，越权直达 `/monitor/online` | 显示 404 页面；`GET /monitor/online/list` 请求次数 = 0；`pageerror` 计数 = 0 |
| E-16 | 勾选 2 行后连续两次确认批量强退（间隔小于 1 秒） | `DELETE` 请求总数 = 2；第二次确认被按钮 `disabled` 状态拦截；成功提示出现 1 次；`pageerror` 计数 = 0 |
| E-17 | 配置地址有效时点击「新窗口打开」 | 新窗口 URL 等于配置地址；原页面 iframe 仍存在；`pageerror` 计数 = 0 |

## 4. 数据契约

> 空值语义与 0 严格区分：`null` 表示未知或未填写；`0` 表示真实零值。二者不得混用，前端不得把 `null` 显示为 `0`。

### 4.1 在线用户列表响应 `GET /monitor/online/list`

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `total` | integer | 否 | — | 等于 `rows` 数组长度；`0` 表示当前无在线会话 |
| `rows` | array | 否 | — | 空数组表示无记录，不得返回 `null` |
| `code` | integer | 否 | — | 成功值 `200` |
| `msg` | string | 否 | — | 成功值「查询成功」 |
| `rows[].tokenId` | string | 否 | — | 会话编号，全局唯一；前端原样展示，不截断 |
| `rows[].deptName` | string | 是 | `null` 或空串表示未归属部门，显示「—」 | 部门名称 |
| `rows[].userName` | string | 是 | `null` 表示未知账号，显示「—」 | 登录账号 |
| `rows[].clientKey` | string | 是 | `null` 或空串表示未上报客户端，显示「—」 | 客户端标识 |
| `rows[].deviceType` | string | 是 | `null` 或空串表示未上报，显示「—」 | 枚举全量：`pc`、`android`、`ios`、`xcx`；字典 `sys_device_type`；未知值显示原值 |
| `rows[].ipaddr` | string | 是 | `null` 表示未获取，显示「—」 | IPv4 或 IPv6 文本 |
| `rows[].loginLocation` | string | 是 | `null` 或空串表示未知地点，显示「—」 | 登录地点文本 |
| `rows[].browser` | string | 是 | `null` 或空串表示未解析，显示「—」 | 浏览器名称 |
| `rows[].os` | string | 是 | `null` 或空串表示未解析，显示「—」 | 操作系统名称 |
| `rows[].loginTime` | integer(int64) | 否 | — | epoch 毫秒；时区口径 Asia/Shanghai（UTC+8）；展示格式 `YYYY-MM-DD HH:mm:ss`，精度到秒 |

- 查询参数 `ipaddr`、`userName` 均为 string、可空；空串表示不过滤；匹配规则为**精确等值**，不支持模糊匹配与通配符。
- 分页口径：后端一次返回全部在线会话且 `total = rows.length`；前端采用本地分页，默认每页 10 条；前端不得假设服务端分页。
- 排序口径：行顺序等于后端 `rows` 顺序，前端不重新排序。

> 已确认：`tokenId` 在表格中原样完整展示（对齐 plus-ui「会话编号」基线）。
> 已确认：本地分页每页条数沿用基线 10 条。

### 4.2 缓存监控响应 `GET /monitor/cache`

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `info` | object | 否 | — | 键为 Redis INFO 属性名，值均为 string |
| `info.redis_version` | string | 是 | 缺键表示未知，显示「—」 | 例 `7.2.5` |
| `info.redis_mode` | string | 是 | 缺键表示未知，显示「—」 | 值 `standalone` 显示「单机」，其他值显示「集群」 |
| `info.tcp_port` | string | 是 | 缺键表示未知，显示「—」 | 端口文本 |
| `info.connected_clients` | string | 是 | 缺键表示未知，显示「—」 | 客户端数量文本 |
| `info.uptime_in_days` | string | 是 | 缺键表示未知，显示「—」 | 运行天数文本 |
| `info.used_memory_human` | string | 是 | 缺键表示未知，显示「—」 | 带单位的内存文本 |
| `info.used_cpu_user_children` | string | 是 | 缺键表示未知，显示「—」 | 数值文本；展示保留两位小数 |
| `info.maxmemory_human` | string | 是 | 缺键表示未知，显示「—」 | 带单位的内存配置文本 |
| `info.aof_enabled` | string | 是 | 缺键表示未知，显示「—」 | 值 `0` 显示「否」，其他值显示「是」 |
| `info.rdb_last_bgsave_status` | string | 是 | 缺键表示未知，显示「—」 | 原样显示 |
| `info.instantaneous_input_kbps` / `info.instantaneous_output_kbps` | string | 是 | 缺键表示未知，显示「—」 | 合并显示为 `{输入}kps/{输出}kps` |
| `dbSize` | integer(int64) | 是 | `null` 表示未知，显示「—」；`0` 表示空库 | Key 数量；数值精度为整数，无小数 |
| `commandStats` | array | 否 | 空数组表示无命令统计，显示「暂无数据」 | 元素结构见下 |
| `commandStats[].name` | string | 否 | — | 命令名，已去掉 `cmdstat_` 前缀 |
| `commandStats[].value` | string | 否 | — | 调用次数的十进制整数字符串；前端转 number 绘制，转换失败按 0 处理 |

### 4.3 外部控制台配置

| 配置项 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `VITE_GLOB_MONITOR_ADMIN_URL` | string | 是 | 空字符串表示未配置，按 E-12 处理 | Spring Boot Admin 控制台地址；开发环境 `http://localhost:9090/admin/applications`，生产环境 `/admin/applications` |
| `VITE_GLOB_SNAILJOB_ADMIN_URL` | string | 是 | 空字符串表示未配置，按 E-12 处理 | SnailJob 控制台地址；开发环境 `http://localhost:8800/snail-job`，生产环境 `/snail-job` |

- 两个地址只允许从环境变量读取，禁止在源码、组件或测试断言中硬编码默认值；环境变量值由部署方提供。
- 外链打开方式为 `window.open(url, '_blank', 'noopener,noreferrer')`。

> 已确认：环境变量命名为 `VITE_GLOB_MONITOR_ADMIN_URL` 与 `VITE_GLOB_SNAILJOB_ADMIN_URL`，并沿用 plus-ui 的开发/生产默认地址。

### 4.4 权限码与控件显隐

| 能力 | 权限码 | 显隐与判定规则 |
|---|---|---|
| 在线用户菜单与列表 | `monitor:online:list` | 无权限时菜单不生成；直接访问返回 404（E-15） |
| 单条强退按钮 | `monitor:online:forceLogout` | 无权限时按钮数量 = 0（A-10） |
| 批量强退按钮 | `monitor:online:batchLogout` 且 `monitor:online:forceLogout` | 两个权限码齐全时才渲染；后端每次 `DELETE` 仍校验 `monitor:online:forceLogout` |
| 缓存监控菜单与页面 | `monitor:cache:list` | 无权限时菜单不生成；直接访问返回 404（E-14） |
| Admin 监控菜单与页面 | `monitor:admin:list` | 无权限时不生成路由 |
| 任务调度中心菜单与页面 | `monitor:snailjob:list` | 无权限时不生成路由 |
| 在线查询 | `monitor:online:query` | 本 Packet 不使用该权限码控制任何控件显隐，保持 plus-ui 基线行为 |

> 已确认：批量强退按钮要求同时具备 `monitor:online:batchLogout` 与 `monitor:online:forceLogout`。
> 已确认：`monitor:online:query` 不用于任何控件显隐（保持 plus-ui 基线）。

### 4.5 错误响应

| 场景 | 后端响应 | 前端行为 |
|---|---|---|
| 未认证 | HTTP 200 且 `code=401` | 沿用 `src/api/request.ts` 既有逻辑：清除会话并重新认证，不重复弹业务错误 |
| 无接口权限 | `code=403`，`msg` 为后端原文 | 展示 `msg` 原文；按钮按 4.4 提前隐藏 |
| 服务端错误 | `code≠200`，`msg` 为后端原文 | 展示 `msg` 原文；页面不得吞异常；保留当前列表或空状态 |
| 网络超时 | 无响应 | 展示请求层统一网络错误文案；批量场景按 A-05/E-06 汇总 |

## 5. 非功能约束

- **性能口径**：在线会话 200 条、每页 10 条时，筛选后首屏渲染 P95 ≤ 500ms；本地翻页 P95 ≤ 100ms；缓存监控在 `GET /monitor/cache` 返回后 P95 ≤ 2s 完成首屏渲染；iframe 页首帧 P95 ≤ 1s（不含目标站点自身加载时间）。
- **安全（脱敏）**：`tokenId`、`ipaddr`、`loginLocation` 属于敏感字段；只允许在当前页面表格内展示，不得写入 `console`、`localStorage`、`sessionStorage`、埋点或错误上报；`console.error` 只允许输出脱敏后的接口路径、错误码与 `timestamp`，不得输出响应体。
- **合规（留痕 / 审计）**：强退由后端 `@Log(title="在线用户", businessType=FORCE)` 留痕；前端不重复上报敏感内容；批量强退由前端逐条触发，后端逐条留痕。
- **可观测（必须输出）**：请求失败时 `console.error` 输出 JSON，字段固定为 `timestamp`、`level`、`url`、`message`、`code`；页面不得吞异常。

## 6. 状态流转

| 实体 | 状态 | 合法迁移 | 非法迁移与拒绝 |
|---|---|---|---|
| 在线会话 | 在线 → 已强退 | 单条强退或批量强退成功后，该 `tokenId` 从列表消失 | 强退请求失败时保持在线；已过期 `tokenId` 再次强退返回 `code=200`，按幂等成功处理 |
| 在线用户页 | 未授权 → 无路由 | 具备 `monitor:online:list` 时生成路由 | 无权限直达 `/monitor/online` 显示 404（E-15） |
| 缓存监控页 | 未授权 → 无路由 | 具备 `monitor:cache:list` 时生成路由 | 无权限直达 `/monitor/cache` 显示 404（E-14） |
| 外部控制台页 | 已配置 → 渲染 iframe；未配置 → 提示 | 配置为空时显示「未配置监控地址」，不渲染 iframe | 配置为空仍渲染 iframe 属非法状态（E-12） |
| 批量强退 | 空闲 → 执行中 → 空闲 | 执行中按钮 `disabled`，结束后恢复 | 执行中再次确认不得发起重复请求（E-16） |

## 7. Non-goals（必填）

- **本期不做**：
  - 修改 `platform/` 任何文件，包括接口、字段、错误码、权限码、SQL 与配置。
  - 新增后端接口：批量强退接口、缓存 `getNames` / `getKeys` / `getValue` / `clearCacheName` / `clearCacheKey` / `clearCacheAll`。
  - 缓存名称与键名浏览、指定缓存清理、全部缓存清理的界面。
  - 在线用户的「当前登录设备管理」能力（`GET /monitor/online` 与 `DELETE /monitor/online/myself/{tokenId}`）不进入本页。
  - 自定义 Admin 监控指标页、自定义 SnailJob 任务管理页；只内嵌官方控制台，不复制其功能。
  - 自动轮询、SSE 推送、定时刷新；仅在进入页面、执行查询、执行强退后刷新。
  - 在线用户与缓存的导出、收藏、订阅、告警配置。
  - 新增前端依赖；修改 `frontend/packages/**` 上游实现。
  - 新增权限码；改变后端权限判定规则。
  - 移动端与响应式专项适配、新增语言包、视觉重设计、plus-ui SVG 图标资产搬迁。
  - 不保证 iframe 目标站点自身的可用性、内容正确性与加载性能；目标站点错误不在本 Packet 判定范围。
- **不兼容**：
  - 不保证与 plus-ui 的 DOM 结构或 CSS 类名一致；只保证用户可见行为与数据契约一致。
  - 不保证后端拒绝文案逐字一致，除本 Packet 明确写出的 `msg` 原文外。
  - 不保证超出 JS 安全整数范围的 `tokenId` 以外字段以 number 形式出现；前端统一兼容 number/string。

> 已确认：单条强退成功提示文案为「强退成功」，批量提示为「成功 N 条，失败 M 条」。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `userName=spec007_online`，`ipaddr` 留空 | `total=2`，2 行均为 `spec007_online`，设备类型显示「PC」 |
| 正例 | 勾选 2 个有效会话并批量强退 | 2 次 `DELETE` 均 `code=200`，提示「成功 2 条，失败 0 条」，列表减少 2 行 |
| 正例 | 正常 Redis，打开缓存监控 | 12 个字段渲染，`dbSize` 显示整数，两个图表各 1 个 `canvas` |
| **反例** | `ipaddr=A` 且 `userName=B`，其中 A 匹配 1 个会话、B 匹配另 1 个会话，期望返回 2 行 | **必须被正确拒绝**：规格要求 AND 语义，只允许返回同时满足 A 与 B 的 0 行或 1 行，不得返回并集 |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 0.1-draft | 初版草稿（由原话扩写，含待确认假设） | 2026-11-11 | 待 PM 与业务方逐条确认 |
| 1.0 | 假设逐条确认，升格为签名版 Spec Packet | 2026-11-11 | Jim Liu / Jiankui Zhang |

### FR → A-xx 映射

| 原条目 | 断言 | 状态 |
|---|---|---|
| FR-001 4 个视图与占位页替换 | A-01、A-06、A-08、A-09 | 已映射 |
| FR-002 在线列表 10 列、行序与总数 | A-01 | 已映射 |
| FR-003 登录地址/用户名称精确筛选与 AND 语义 | A-02、E-01、E-02、E-03 | 已映射 |
| FR-004 本地分页（每页 10 条） | E-04 | 已映射（边界） |
| FR-005 单条强退与幂等成功 | A-03、E-05 | 已映射 |
| FR-006 前端批量强退与部分失败汇总 | A-04、A-05、E-06 | 已映射 |
| FR-007 批量按钮可用性、防重复、取消不发请求 | E-07、E-08、E-16 | 已映射（边界） |
| FR-008 权限码控制菜单与按钮 | A-10、E-14、E-15 | 已映射 |
| FR-009 缓存 12 项基本信息与转换 | A-06、E-10 | 已映射 |
| FR-010 命令统计饼图、内存仪表盘与空状态 | A-07、E-11 | 已映射 |
| FR-011 缓存接口失败展示后端原文 | E-09 | 已映射（边界） |
| FR-012 Admin 控制台内嵌、外链与未配置/不可达 | A-08、E-12、E-13、E-17 | 已映射 |
| FR-013 SnailJob 控制台内嵌、外链与未配置 | A-09、E-12、E-17 | 已映射 |
| FR-014 platform/packages/依赖零改动 | 无 | UNVERIFIABLE |
| FR-015 敏感字段不落日志/存储/埋点 | 无 | UNVERIFIABLE |
| FR-016 Non-goals 范围排除 | 无 | UNVERIFIABLE |

### UNVERIFIABLE 清单

本 Packet 的 P0 行为均有 A-xx 判定；以下条目不进入 P0 门禁，按指定方式核对：

| 条目 | 原因 | 建议核对方式 |
|---|---|---|
| FR-014 `platform/`、`frontend/packages/**` 与依赖零改动 | 非行为断言，评测集无法观测 | `git diff --stat` 对比基线；`trace.diff_scope` 与 allowlist 哈希；`/review` 范围核查 |
| FR-015 敏感字段不进入日志、浏览器存储、埋点与错误上报 | 需静态检查与人工判定 | 搜索 `tokenId`/`ipaddr`/`loginLocation` 的日志与持久化调用；`/review` 安全项 |
| FR-016 缓存清理、键浏览、导出、轮询、SSE、后端批量接口未实现 | 属范围排除，非正向行为 | 检查路由、按钮与请求路径不存在；`/review` Non-goals 项 |
| 12 个会话的本地分页（对应 E-04） | 评测夹具只创建 2 个会话，评测集不覆盖 | 前端单元测试构造 12 条数据，断言每页 10 条与翻页不发请求 |
| 缓存首屏 2 秒（SC-003） | 交付阶段不做性能压测 | 评测时记录时间作参考；上线后 30 天回顾抽样 |
