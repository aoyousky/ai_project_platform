---
id: REQ-20261114-010
title: 官方控制台编排化与平台后端监控/调度接入
version: 1.0
generated_from: "用户 2026-11-14 决定为 P1 部署缺口更新 REQ/Spec（对话原话：“2 需要更新REQ/Spec”）：控制台编排化、SBA 注册平台后端、SnailJob 组与执行节点"
risk_level: L2
channel: ai_forced_review
pm: aoyousky
business_signoff: Jim Liu 2026-11-14
arch_reviewer: jiankui zhang 2026-11-14
target_window: 2026-11-14 ~ 2026-11-15
---

# REQ-20261114-010 官方控制台编排化与平台后端监控/调度接入

## 1. 意图

- 业务目标：把目前依赖宿主机 `java -jar` 手工启动的 Spring Boot Admin（`:9090`，
  context-path `/admin`）与 SnailJob（`:8800`，context-path `/snail-job`）纳入
  `deploy/docker-compose.yml`；同时让平台后端向 SBA 注册、向 SnailJob 注册执行器，
  使 SPEC-008 的「Admin 监控」能看到平台后端实例、「任务调度中心」能真实执行任务。
- 现状证据：宿主重启后两个控制台需手工启动（2026-11-13、11-14 两次记录）；compose
  后端以 `--spring.boot.admin.client.enabled=false --snail-job.enabled=false` 启动；
  `sj_group_config` 只有 `ruoyi_group`，后端配置组名为 `aoyou_group`。
- 调用方 / 场景 / 频率：本地与测试环境部署（每次环境重建 1 次）；控制台常驻。
- 上线 30 天成功度量：环境重建后 0 次手工 `java -jar`；Admin 监控页始终可见平台后端
  实例；任务调度中心至少有 1 个可执行任务并成功执行 1 次。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 干净的 MySQL/Redis/MinIO 与最终 compose | `docker compose -f deploy/docker-compose.yml up -d` | 7 个服务全部 `Running`，控制台两容器 120 秒内 `healthy` |
| A-02 | P0 | 控制台由 compose 启动 | 依次 `GET /admin/login`、`GET /admin/applications`、`GET /snail-job/` | `status=200`（`/admin/login`）、`status=401`（`/admin/applications`）、`status=200`（`/snail-job/`） |
| A-03 | P0 | 后端以 `spring.boot.admin.client.enabled=true` 启动 | 登录 SBA 后 `GET /admin/applications` | 返回实例列表中包含 `name=aoyou-server` 且 `status=UP` |
| A-04 | P0 | SnailJob 已初始化 | `SELECT count(*) FROM sj_group_config WHERE group_name='aoyou_group'` | 返回 `1`（同名重复组视为 failed） |
| A-05 | P0 | 后端 `snail-job.enabled=true` 已启动 60 秒 | 查询 SnailJob 执行器/客户端在线列表 | `aoyou_group` 下在线执行器数量 ≥ 1 |
| A-06 | P0 | 存在已注册测试任务 | 通过 `/snail-job` API 触发一次执行 | 60 秒内执行记录 `status=3`（成功），且记录数与触发次数相等 |
| A-07 | P0 | 已运行的 compose 栈 | `docker compose restart` 后不执行任何 `java -jar` | 120 秒内 `status=200` / `401` / `200`（三个请求，顺序同 A-02） |
| A-08 | P0 | 本需求 diff | 对比改动前后 | `frontend/apps/**` 与 `specs/SPEC-008-*.md` 的 diff 行数 = 0；无新增权限码 |

> P0 断言 8 条（≤ 12）。

## 3. 边界与异常（15 条 ≥ 8 条断言）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 数据库未初始化（`sj_*` 表缺失） | `db-init` 退出码非 0 且日志含 `sj_` 表创建失败原因；控制台容器不进入 running |
| E-02 | 宿主机 9090/8800 端口被占用 | compose 启动失败，`docker ps` 中两个新服务不出现；日志含 `port is already allocated` |
| E-03 | 缺少控制台管理员口令环境变量 | 两个控制台容器启动即失败（`EXIT=1`），日志指出缺失变量名，不打印口令值 |
| E-04 | MySQL 不可达 | 控制台容器保持 `unhealthy` 并重试，不产生假 200；A-02 返回 502 |
| E-05 | `aoyou_group` 不存在 | 触发接口返回业务错误码 `GROUP_NOT_FOUND`（不得 500） |
| E-06 | SBA 未登录 | `/admin/applications` 返回 401；SPEC-008 页面显示登录提示（A-05 行为不变） |
| E-07 | 执行器离线 | 触发接口返回 `EXECUTOR_OFFLINE`，不返回成功 toast |
| E-08 | 触发请求重复提交 | 同一幂等键 60 秒内只产生 1 条执行记录 |
| E-09 | 控制台容器崩溃 | nginx 返回 502（不得 SPA 兜底 200）；`docker compose ps` 显示 exited |
| E-10 | 组名同时存在 `ruoyi_group` 与 `aoyou_group` | 后端只使用 `aoyou_group`；启动日志打印实际使用的组名 |
| E-11 | 环境重建（`down -v`） | 控制台凭据与组配置由 seed/init 脚本重建，重建后 A-01～A-06 全部可复现 |
| E-12 | 后端启动后 SBA 注册失败 | 后端仍可用；日志 `SBA_REGISTER_FAILED`，A-03 判 failed |
| E-13 | 执行记录为空（新环境首次打开） | 列表接口 `status=200` 且 `rows=[]`，不含 `null` 元素 |
| E-14 | 同一 60 秒窗口触发超过 10 次 | 第 11 次返回 `status=429` 且错误码 `TOO_MANY_TRIGGERS`，不产生第 11 条执行记录 |
| E-15 | 对 `status=3`（SUCCESS）的记录调用停止（非法状态迁移） | 返回 `status=409` 且错误码 `ILLEGAL_STATE`，记录状态保持 `3` |

## 4. 数据契约

compose 服务、端口与配置项：

| 字段 | 类型 | 可空 | 空值语义 | 取值 / 说明 |
|---|---|---|---|---|
| service `monitor-admin` | string | 否 | — | 容器名 `awp-monitor-admin`，端口 `9090`（整数，精度 1），context-path `/admin`；SBA 3.5.8 |
| service `snailjob-server` | string | 否 | — | 容器名 `awp-snailjob-server`，端口 `8800`（整数，精度 1），context-path `/snail-job`；SnailJob 1.10.0 |
| `SPRING_BOOT_ADMIN_CLIENT_ENABLED` | string(`true`/`false`) | 否 | — | 环境变量注入，不写死；缺省即启动失败（E-03） |
| `SNAIL_JOB_ENABLED` | string(`true`/`false`) | 否 | — | 同上 |
| `group_name` | string | 否 | 空串 = 配置错误，fail-fast 不启动 | 唯一合法值 `aoyou_group` |
| `instance.name` | string | 否 | — | `aoyou-server` |
| `status`（SBA 实例） | string | 否 | — | 枚举：`UP` / `DOWN` / `OFFLINE` |
| `status`（执行记录） | integer | 否 | — | 枚举全量：`2=RUNNING`、`3=SUCCESS`、`4=FAIL`、`5=STOP`、`6=CANCEL`；未知整数按 `null` 展示，不猜测 |
| `created_at`（展示） | string(ISO-8601) | 是 | `null` = 后端未返回该时间 | 时区固定 `Asia/Shanghai`（UTC+8），秒级精度 |
| `duration_ms` | integer | 否 | — | 毫秒；精度 1ms，无小数 |
| 错误码 | string | 否 | `""` = 无错误 | 枚举：`GROUP_NOT_FOUND` / `EXECUTOR_OFFLINE` / `SBA_REGISTER_FAILED` / `TOO_MANY_TRIGGERS` / `ILLEGAL_STATE` |

> 时间口径：所有对外时间按 `Asia/Shanghai`（UTC+8）展示；毫秒字段不做四舍五入以外的换算。
> 数值精度：端口、状态码、`duration_ms` 均为十进制整数（精度 1），无金额字段、无小数。

## 5. 非功能约束

- 性能口径：控制台冷启动 ≤ 120 秒；SBA 注册在 backend ready 后 60 秒内完成。
- 安全：控制台管理员口令、`SA_TOKEN_JWT_SECRET` 一律来自环境变量，不进仓库、不进日志；
  SBA 实例 metadata 中的 `userpassword` 在页面按 SPEC-008 A-11 脱敏为 `***`。
- 合规（留痕/审计）：compose 变更与初始化 SQL 入仓库；每次 `up/restart/down` 的
  服务状态与失败原因写入 `deploy/build/compose-*.log`（gitignored），日志保留至少 7 天；
  谁改的配置可从 git 历史回溯；口令只写 `.env.example` 占位。
- 可观测：两个控制台容器输出 healthcheck 状态；后端日志输出注册/组名/执行器在线数。

## 6. 状态流转

执行记录状态迁移：`2 RUNNING → 3 SUCCESS | 4 FAIL | 5 STOP | 6 CANCEL`；禁止
`3/4/5/6 → 2` 的重新执行（重试产生新记录，不复用旧记录 ID）。

## 7. Non-goals（必填）

- 本期不做：不修改前端代码（SPEC-008 页面行为不变），不改 SPEC-008 断言。
- 本期不做：不新增权限码、菜单或依赖；不替换 SBA/SnailJob 版本。
- 本期不做：不做生产多副本高可用、不做控制台 TLS 与外部域名暴露。
- 本期不做：不修改评测断言或用例；评测集新增用例仅覆盖本 Spec 的 A-xx/E-xx。
- 不兼容：不保证与手工 `java -jar` 启动方式并存；切换后以 compose 为唯一启动方式。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `docker compose up -d` 全量启动 | 7 服务 Running；120 秒内 A-02 三个状态码 200/401/200 |
| 正例 | 登录 SBA 查询应用列表 | `aoyou-server` 实例 `status=UP` |
| 正例 | 触发 `aoyou_group` 下测试任务 | 60 秒内执行记录 `status=3`，记录数 = 触发次数 |
| **反例** | 在未创建 `aoyou_group` 时触发任务，接口返回 200 且页面提示成功 | **必须被正确拒绝**：应为 `GROUP_NOT_FOUND` 且不产生执行记录 |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 0.1（草稿） | Agent 起草，待 PM/业务方/架构复核 | 2026-11-14 | — |
| 0.1（草稿修订） | PM 确认全部待确认假设（会话原话「009 010 待确认全部确认」）；有分歧项按草稿内部约束收敛（见下） | 2026-11-14 | — |
| 1.0（签字） | 定稿：PM / 业务方 / 架构签字；假设全部确认，口径不变 | 2026-11-14 | pm aoyousky；业务 Jim Liu 2026-11-14；架构 jiankui zhang 2026-11-14 |

> ✅ 已确认假设（2026-11-14，PM 会话确认；仅确认假设口径，不构成 Spec 签字）：
> 1. **已批准**修改 `deploy/docker-compose.yml`、`deploy/nginx/default.conf`、`deploy/`
>    初始化脚本与 `platform/` 的 Spring 配置项（只改配置，不改业务代码）。
> 2. 控制台管理员口令**由环境变量注入**（收敛依据：E-03 以"缺少环境变量即启动失败"
>    为判定口径，且与 A-11 环境重建可复现一致）；不采用"首次启动随机生成落库"。
> 3. `sj_*` 表由 `db-init` **自动导入** `platform/script/sql/ry_job.sql`（收敛依据：
>    E-01 以 `db-init` 失败为判定口径，A-11 要求 `down -v` 后可复现）。
> 4. A-06 使用 **db-init 种子任务**（非业务任务），保证 A-06/A-11 可重复判定。
> 5. 宿主机端口 9090/8800 在目标环境可用。

> 说明：第 2–4 项原稿未给出唯一取值，按本 Spec 其他条目的既有判定口径收敛；
> 若与 PM 意图不符，请在升格前指出。

## 附录：Then 可判定性改写对照

| 断言 | 改写前（不可判定） | 改写后（机器可判定） |
|---|---|---|
| A-02 | 「三个响应状态码分别为 200、401、200」——自然语言并列，判定点不明确 | 「`status=200`（`/admin/login`）、`status=401`（`/admin/applications`）、`status=200`（`/snail-job/`）」——逐请求绑定状态码 |
| A-07 | 「三个请求状态码恢复为 200 / 401 / 200」——未说明恢复口径 | 「120 秒内 `status=200` / `401` / `200`（三个请求，顺序同 A-02）」——阈值 + 逐请求状态码 |

边界补齐（体检指出缺空值/超限/非法状态）：新增 E-13（空集 `rows=[]`）、
E-14（60 秒内第 11 次触发 `status=429` / `TOO_MANY_TRIGGERS`）、E-15（对 SUCCESS
记录停止返回 `status=409` / `ILLEGAL_STATE` 且状态不变）。
