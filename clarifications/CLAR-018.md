# CLAR-018

- REQ: REQ-20261114-010
- TRIGGER: E-05 / E-07 / E-08 / E-14 / E-15（以及 E-12 的 `SBA_REGISTER_FAILED`、E-13 的 `rows` 字段名）
- STATUS: 待裁决
- RAISED_BY: agent
- DATE: 2026-11-15

## 歧义描述

SPEC-010 §3 的边界表要求控制台返回**自有错误码** `GROUP_NOT_FOUND` / `EXECUTOR_OFFLINE`
/ `SBA_REGISTER_FAILED` / `TOO_MANY_TRIGGERS` / `ILLEGAL_STATE`，并要求
`429`、`409`、幂等键等行为。但 §9 已确认假设 1 与 §7 Non-goals 明确：
**只改 `platform/` 的 Spring 配置项，不改业务代码**；控制台是官方上游产物
（SBA 3.5.8 / SnailJob 1.10.0），本期不替换版本。

实测（2026-11-15，`deploy/` 栈运行态，登录后直接调用控制台 API）：

| 条目 | Spec 期望 | 实测上游行为 |
|---|---|---|
| E-05 组不存在 | 业务错误码 `GROUP_NOT_FOUND` | `POST /job/trigger {"jobId":999999}` → `HTTP 200`、`{"status":0,"message":"job can not be null."}`，无 `GROUP_NOT_FOUND` |
| E-07 执行器离线 | 错误码 `EXECUTOR_OFFLINE`，不返回成功 | `docker compose stop backend` 后触发 → `HTTP 200`、`status:1`、`data:true`（受理成功），20 秒后批次转为 `status=4`（FAIL） |
| E-08 重复提交 | 同一幂等键 60 秒内仅 1 条 | 连续两次 `POST /job/trigger {"jobId":2}` 均 `status:1`，`sj_job_task_batch` 记录数 +2（接口无幂等键字段） |
| E-14 60 秒内第 11 次 | `429` + `TOO_MANY_TRIGGERS` | 连续 11 次触发全部 `HTTP 200`、`status:1`，无 429、无错误码 |
| E-15 停止 SUCCESS 记录 | `409` + `ILLEGAL_STATE`，状态保持 3 | `POST /job/batch/stop/1708` → `HTTP 200`、`status:1`、`data:true`；记录仍为 `task_batch_status=3` |
| E-12 SBA 注册失败 | 日志 `SBA_REGISTER_FAILED` | `deploy/build/monitor-admin.jar`、`snailjob-server.jar`、`app.jar` 与上游 class 常量中均无此字符串（SBA client 打自己的日志） |
| E-13 空记录列表 | `rows=[]` | `GET /job/batch/list?jobId=999999` → `{"status":1,"data":[],"total":0}`，字段名是 `data` 不是 `rows` |

上游 class 常量检索（`snail-job-*.jar` 与 `spring-boot-admin-*.jar` 展开后 grep）：
五个错误码字符串命中数均为 0。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 扩展范围：允许在 `platform/` 增加一层薄适配（trigger/stop 包装 + 自带错误码 + 限流/幂等），实现 Spec 的 E-xx 错误码 | 违反 §7 Non-goals「只改配置」，需 Spec 升版；工作量最大 |
| B | 保留范围：把 E-05/E-07/E-08/E-12/E-14/E-15 改写为「上游控制台固有行为，不在本需求实现范围」，E-13 的 `rows` 改为 `data`；即 Spec 升版 v1.1 | 断言不变（P0 8 条已全绿），仅 §3 边界表与数据契约字段名调整 |
| C | 维持原文：把上述 E-xx 标记为「上游限制导致无法交付」，作为已知缺口记录并接受验收风险 | 本需求无法满足「E-xx 严格实现」的生成约束，DoD 第 3 项持续 FAIL |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

按选项 B 理解：E-xx 是「一键本地编排 + 官方控制台开箱行为」的验收口径，不是要求
自建调度服务端；错误码 `GROUP_NOT_FOUND` 等来自早期 PRD 的设想，与 SnailJob 1.10.0
实际 API 不一致。**未经裁决，Agent 不据此删除或改写 Spec 任何条目，也不实现包装层。**

## PM 裁决

（待填）
