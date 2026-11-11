# Phase 1 Data Model: 系统监控模块前端交付

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Source**: `specs/SPEC-007-system-monitor.md` §4（签字版）与 [spec.md](spec.md) Key Entities。

本文件只描述前端消费/派生的数据形状与展示规则，不定义后端存储，不修改数据契约。

## 1. 在线会话 `UserOnline`

对应 `GET /monitor/online/list` 的 `rows[]`。字段与空值语义严格按 Packet §4.1。

| 字段 | TypeScript 类型 | 可空 | 空值/展示语义 |
|---|---|---|---|
| `tokenId` | `string` | 否 | 表格原样完整展示，不截断；请求路径中 `encodeURIComponent` 后使用 |
| `deptName` | `string \| null` | 是 | `null` 或空串 → 「—」 |
| `userName` | `string \| null` | 是 | `null` → 「—」 |
| `clientKey` | `string \| null` | 是 | `null` 或空串 → 「—」 |
| `deviceType` | `string \| null` | 是 | 字典 `sys_device_type` 标签；缺项回退原值；`null`/空串 → 「—」 |
| `ipaddr` | `string \| null` | 是 | `null` → 「—」；IPv4/IPv6 文本 |
| `loginLocation` | `string \| null` | 是 | `null` 或空串 → 「—」 |
| `browser` | `string \| null` | 是 | `null` 或空串 → 「—」 |
| `os` | `string \| null` | 是 | `null` 或空串 → 「—」 |
| `loginTime` | `number`（epoch 毫秒） | 否 | `dayjs(loginTime).format('YYYY-MM-DD HH:mm:ss')` |

**派生字段（仅页面内，不回传后端）**：

- `rowKey` = `tokenId`（vxe-table 行主键，保证批量勾选唯一）。
- `deviceTypeText` = `dictLabel(sys_device_type, deviceType)`；字典未加载或未知值回退 `deviceType`。
- `loginTimeText` = 上述时间格式。

**列表响应 `OnlineListResult`**：

```ts
interface OnlineListResult {
  rows: UserOnline[];
  total: number; // 必须等于 rows.length，前端不据此发起分页请求
}
```

## 2. 在线查询 `OnlineQuery`

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `ipaddr` | `string` | 是 | 空串表示不过滤；精确等值 |
| `userName` | `string` | 是 | 空串表示不过滤；精确等值 |

**校验规则**：不做长度、格式、通配符转换；原样提交。两个字段同时非空时由后端按 AND 返回。

## 3. 缓存运行信息 `CacheInfo`

对应 `GET /monitor/cache` 的 `data`。`info` 为 Redis INFO 属性名到字符串的映射。

```ts
interface CacheInfo {
  info: Record<string, string>;
  dbSize: null | number;
  commandStats: CacheCommandStat[];
}

interface CacheCommandStat {
  name: string;
  value: string; // 十进制整数字符串
}
```

| 展示项 | 来源键 | 转换 |
|---|---|---|
| Redis版本 | `info.redis_version` | 原值；缺键 → 「—」 |
| 运行模式 | `info.redis_mode` | `standalone` → 「单机」；其他非空 → 「集群」；缺键 → 「—」 |
| 端口 | `info.tcp_port` | 原值；缺键 → 「—」 |
| 客户端数 | `info.connected_clients` | 原值；缺键 → 「—」 |
| 运行时间(天) | `info.uptime_in_days` | 原值；缺键 → 「—」 |
| 使用内存 | `info.used_memory_human` | 原值；缺键 → 「—」 |
| 使用CPU | `info.used_cpu_user_children` | 可转数字 → 保留两位小数；否则原值；缺键 → 「—」 |
| 内存配置 | `info.maxmemory_human` | 原值；缺键 → 「—」 |
| AOF是否开启 | `info.aof_enabled` | `0` → 「否」；其他非空 → 「是」；缺键 → 「—」 |
| RDB是否成功 | `info.rdb_last_bgsave_status` | 原值；缺键 → 「—」 |
| Key数量 | `dbSize` | 整数十进制；`null` → 「—」；`0` → `0` |
| 网络入口/出口 | `info.instantaneous_input_kbps` / `info.instantaneous_output_kbps` | `{输入}kps/{输出}kps`；任一缺键 → 该侧显示「—」 |

**派生图表数据**：

- 命令统计饼图：`commandStats.map(({name, value}) => ({name, value: Number(value) || 0}))`；
  数组为空 → 显示「暂无数据」，不渲染画布。
- 内存仪表盘：以 `used_memory_human` 与 `maxmemory_human` 作为展示文本；无百分比来源时只呈现
  已用内存文本与固定量程的仪表盘，不臆造使用率数值。`maxmemory_human` 缺键 → 「—」。

## 4. 外部控制台配置 `ExternalConsoleConfig`

| 字段 | 类型 | 可空 | 语义 |
|---|---|---|---|
| `adminUrl` | `string` | 是 | `import.meta.env.VITE_GLOB_MONITOR_ADMIN_URL`；空串 → 未配置 |
| `snailjobUrl` | `string` | 是 | `import.meta.env.VITE_GLOB_SNAILJOB_ADMIN_URL`；空串 → 未配置 |

**派生状态**：

- `configured = url.trim().length > 0`。
- 未配置：不渲染 iframe，显示「未配置监控地址」，外链 `disabled`。
- 已配置：渲染 iframe（`src=url`）与外链（`href=url`，`target=_blank`，`rel=noopener noreferrer`）。
- 目标不可达不改变已配置状态；iframe 保留，外链保留。

## 5. 权限集合 `MonitorPermissions`

| 能力 | 权限码 | 判定 |
|---|---|---|
| 在线菜单/列表 | `monitor:online:list` | 后端菜单生成；页面不做额外判定 |
| 单条强退 | `monitor:online:forceLogout` | `hasCodeAccess(codes, ['monitor:online:forceLogout'])` |
| 批量强退 | `monitor:online:batchLogout` **且** `monitor:online:forceLogout` | 两次 `hasCodeAccess` 取 AND |
| 缓存页面 | `monitor:cache:list` | 后端菜单生成 |
| Admin 页面 | `monitor:admin:list` | 后端菜单生成 |
| 任务调度页面 | `monitor:snailjob:list` | 后端菜单生成 |
| 在线查询 | `monitor:online:query` | 不使用，不控制任何控件 |

超级管理员 `*:*:*` 由 `hasCodeAccess` 短路放行。

## 6. 页面状态

### 6.1 在线用户页

```ts
interface OnlinePageState {
  rows: UserOnline[];       // 后端全量
  total: number;            // = rows.length
  loading: boolean;
  batchRunning: boolean;    // 批量执行中
  selectedTokenIds: string[];
}
```

- `batchRunning=true` 时批量按钮 `disabled`，重复确认不发请求。
- 未选中时批量按钮 `disabled`。
- 强退/批量结束后重新拉取列表，重置为后端最新全量。

### 6.2 缓存页

```ts
interface CachePageState {
  data: CacheInfo | null;
  errorMessage: string | null;
  loading: boolean;
}
```

- `errorMessage` 非空：只显示后端 `msg` 原文，信息表与图表不渲染。
- `data.info` 缺键：逐字段回退「—」。
- `commandStats=[]`：命令统计区域显示「暂无数据」，内存图表照常。

### 6.3 外部控制台页

```ts
interface ExternalConsoleState {
  url: string;       // 来自环境变量
  configured: boolean;
}
```

## 7. 状态流转

| 实体 | 合法迁移 | 非法迁移/拒绝 |
|---|---|---|
| 在线会话 | 在线 → 已强退（单条或批量成功） | 请求失败保持在线；已过期再次强退按幂等成功 |
| 批量操作 | 空闲 → 执行中 → 空闲 | 执行中再次确认不发起请求；未选中不可进入执行中 |
| 缓存页 | 加载中 → 成功（表格+图表）/ 失败（仅错误文案） | 失败时不得残留上一轮图表或信息表 |
| 外部控制台页 | 未配置 → 不渲染 iframe；已配置 → 渲染 iframe | 未配置却渲染 iframe 属非法状态 |
| 越权直达 | 无菜单 → 404，不发数据请求 | 直接放行到页面属非法状态 |
