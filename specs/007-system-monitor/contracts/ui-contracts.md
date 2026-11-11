# Contract: UI 行为与组件契约

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Source**: `specs/SPEC-007-system-monitor.md` A-01～A-10、E-01～E-17、§4（签字版）
**Visual baseline**: plus-ui 的 RuoYi-Vue-Plus 同类页面行为；不要求 DOM/CSS 逐字一致（Packet §7）。
所有页面使用 `apps/web-antdv-next` 现有 `Page` 容器、`useVbenVxeGrid`、`AntModal.confirm`、
`message`、`EchartsUI`，不新增全局 renderer。

## 1. 通用交互

| 规则 | 契约 |
|---|---|
| 页面异常 | 不产生未捕获异常；`pageerror` 计数 = 0 |
| 失败提示 | `message.error(msg)`，`msg` 为后端原文；不展示堆栈、不输出响应体 |
| 成功提示 | `message.success`；强退固定「强退成功」 |
| 二次确认 | 单条与批量强退均先 `AntModal.confirm`；取消不发请求 |
| 敏感字段 | `tokenId`、`ipaddr`、`loginLocation` 只在表格展示，不写控制台/存储/埋点 |
| 测试标识 | 断言涉及的控件使用下表 `data-testid`，不依赖 CSS 类名 |

## 2. 在线用户 `/monitor/online`（A-01～A-05、A-10、E-01～E-08、E-15、E-16）

### 2.1 查询表单

| 字段 | 控件 | `fieldName` | Placeholder |
|---|---|---|---|
| 登录地址 | Input | `ipaddr` | 请输入登录地址 |
| 用户名称 | Input | `userName` | 请输入用户名称 |

- 查询与重置按钮由表格工具栏提供；重置清空两字段并重新请求。
- 空串表示不过滤；两个字段原样提交，不 trim、不拼接通配符。

### 2.2 表格

- 行主键：`tokenId`。
- 列顺序固定：`会话编号`、`登录名称`、`客户端`、`设备类型`、`所属部门`、`主机`、`登录地点`、
  `操作系统`、`浏览器`、`登录时间`、`操作`。
- 10 个数据列表头各出现 1 次（A-01）；`操作` 列不计入这 10 个。
- 设备类型：字典 `sys_device_type` 标签，缺项回退原值，`null`/空串显示「—」。
- 登录时间：`YYYY-MM-DD HH:mm:ss`。
- 空数据：表格显示「暂无数据」，不弹错误（E-01）。
- 分页：本地分页，默认每页 10 条；翻页不发列表请求（E-04）。

### 2.3 强退控件

| 控件 | `data-testid` | 渲染条件 | 行为 |
|---|---|---|---|
| 行内「强退」 | `online-force-logout` | 具备 `monitor:online:forceLogout` | 确认后调用单条接口；成功刷新列表并提示「强退成功」 |
| 工具栏「批量强退」 | `online-batch-logout` | 同时具备 `monitor:online:batchLogout` 与 `monitor:online:forceLogout` | 未选中时 `disabled`；执行中 `disabled`；确认后逐条调用 |

- 批量确认：`确认强退选中的 N 条会话？`；确定后串行执行。
- 批量结果：全部成功提示「成功 N 条，失败 0 条」；有失败时提示「成功 N 条，失败 M 条」并追加
  失败原因（后端 `msg` 或请求层统一网络错误文案）。
- 批量结束后刷新一次列表；失败对应行保留。
- 未选中点击批量按钮：不发请求（E-07）。
- 确认弹窗取消：不发请求，勾选保持（E-08）。
- 连续两次确认：第二次被 `disabled` 拦截，请求总数等于选中条数（E-16）。

## 3. 缓存监控 `/monitor/cache`（A-06、A-07、E-09～E-11）

### 3.1 基本信息

- 容器：`data-testid="cache-info-table"`。
- 12 个标签各出现 1 次：`Redis版本`、`运行模式`、`端口`、`客户端数`、`运行时间(天)`、`使用内存`、
  `使用CPU`、`内存配置`、`AOF是否开启`、`RDB是否成功`、`Key数量`、`网络入口/出口`。
- Key 数量单独提供 `data-testid="cache-db-size"`，文本等于响应 `dbSize` 的十进制字符串；
  `null` 时为「—」，`0` 时为 `0`。
- 转换规则见 [data-model.md](../data-model.md) §3。

### 3.2 图表

| 容器 | `data-testid` | 内容 | 空/失败行为 |
|---|---|---|---|
| 命令统计 | `cache-command-chart` | 饼图，1 个 `canvas` | `commandStats=[]` 显示「暂无数据」，`canvas=0` |
| 内存信息 | `cache-memory-chart` | 仪表盘，1 个 `canvas` | 命令统计为空时仍渲染 1 个 `canvas` |

- 两个 `canvas` 尺寸均 `width ≥ 100`、`height ≥ 100`（A-07）。
- 接口失败：页面显示后端 `msg` 原文；`cache-info-table` 不渲染；两个容器 `canvas=0`（E-09）。
- 缺键：对应单元格「—」，其余字段正常（E-10）。

## 4. Admin 监控 `/monitor/Admin`（A-08、E-12、E-13、E-17）

| 元素 | `data-testid` | 已配置 | 未配置 |
|---|---|---|---|
| 内嵌区域 | `monitor-iframe` | 1 个，`src` 等于 `VITE_GLOB_MONITOR_ADMIN_URL`，高度 ≥ 400 | 0 个 |
| 外链 | `monitor-open-external` | `href` 等于同一地址，可点击 | `disabled` |
| 未配置提示 | — | 不显示 | 显示「未配置监控地址」 |

- 已配置但目标不可达：iframe 与外链仍存在，不弹前端自造错误（E-13）。
- 外链点击后新窗口 URL 等于配置地址，原页 iframe 仍在（E-17）。

## 5. 任务调度中心 `/monitor/snailjob`（A-09、E-12、E-17）

| 元素 | `data-testid` | 已配置 | 未配置 |
|---|---|---|---|
| 内嵌区域 | `monitor-iframe` | 1 个，`src` 等于 `VITE_GLOB_SNAILJOB_ADMIN_URL`，高度 ≥ 400 | 0 个 |
| 外链 | `monitor-open-external` | `href` 等于同一地址，可点击 | `disabled` |
| 未配置提示 | — | 不显示 | 显示「未配置监控地址」 |

其余行为同 Admin 监控页；两页共用 `external-console.vue`，只传入不同地址。

## 6. 权限与越权

- `spec007_limited`（仅 `monitor:online:list`）：在线列表可见，`online-force-logout` 与
  `online-batch-logout` 元素数量均为 0（A-10）。
- 不具备 `monitor:cache:list` 直达 `/monitor/cache`：404，`GET /monitor/cache` 请求次数 = 0（E-14）。
- 不具备任何 `monitor:*` 直达 `/monitor/online`：404，`GET /monitor/online/list` 请求次数 = 0（E-15）。
