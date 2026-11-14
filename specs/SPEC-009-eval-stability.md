---
id: REQ-20261114-009
title: 评测环境稳定性与共享 IP 限流治理
version: 1.0
generated_from: "用户 2026-11-14 决定将 REQ-003 评测节奏与 REQ-007 宿主浏览器稳定性单独立项处理（对话原话：“1 单独立项处理”）"
risk_level: L2
channel: ai_forced_review
pm: aoyousky
business_signoff: Jim Liu 2026-11-14
arch_reviewer: jiankui zhang 2026-11-14
target_window: 2026-11-14 ~ 2026-11-15
---

# REQ-20261114-009 评测环境稳定性与共享 IP 限流治理

## 1. 意图

- 业务目标：让上线前全量门禁可重复全绿，消除两类假失败——后端 `/auth/code` 共享 IP
  限流（10 次/60 秒）导致的取码失败，以及 Playwright 用例挂起（`A-07` 曾 1800 秒
  被 `TimeoutExpired` 杀掉）。
- 背景证据：2026-11-14 三轮全量门禁均 EXIT=1，REQ-003 `TC-A18` 三轮失败、REQ-007
  r1 旧会话登录 500、r3 `A-07` 超时；同一批用例单例隔离跑均通过（见
  `docs/evidence/REQ-20261112-008/uat-and-evidence.md`）。
- 调用方 / 场景 / 频率：交付 Agent 提交前单需求门禁；上线前人工触发全量门禁（每次
  1 轮，全天不超过 5 轮）。
- 上线 30 天成功度量：全量门禁连续 3 次全绿；`TC-A18` 在需求内串行执行时 0 次取码
  失败；无单用例超过 600 秒。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 干净的 Docker 栈与最终代码树 | 连续 3 次执行 `CI_GATE_FULL_EVAL=1 bash scripts/ci-gate.sh` | 3 次均 `EXIT=0` 且日志含 `== 门禁全部通过 ==` |
| A-02 | P0 | 全量门禁执行到 REQ-20261104-003 | 执行 13 条用例（含 TC-A18） | 报告 `cases[TC-A18].status = passed`，且不含 `登录页未返回验证码 uuid` |
| A-03 | P0 | 任意 60 秒滑动窗口 | 评测探针请求 `/auth/code` | 窗口内请求数 ≤ 10（探针计数器 `captcha_requests_60s` 字段可复核） |
| A-04 | P0 | 全量门禁执行到 REQ-20261111-007 | 执行 10 条用例（含 A-07） | 10/10 passed，且单用例 `duration_ms ≤ 600000` |
| A-05 | P0 | 本需求 diff | 对比改动前后 `specs/evals/**/cases.yaml` 与断言函数 | 断言条数、期望值、用例 ID 的 diff 行数 = 0 |
| A-06 | P0 | 单需求模式 | 执行 `bash scripts/ci-gate.sh`（分支 008） | 5/5 PASS，`EXIT=0`，REQ-008 评测 11/11 |
| A-07 | P0 | 评测重试机制启用 | 单用例首次失败后重试 | 报告写入 `attempts` 字段，最终失败时 `status=failed` 且不伪造通过 |

> P0 断言 7 条（≤ 12）。

## 3. 边界与异常（14 条 ≥ 7 条断言）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | `/auth/code` 返回限流错误（HTTP 429 或业务码） | 探针等待并记录 `wait_ms`，单次等待 ≤ 180000ms，不直接将用例判失败 |
| E-02 | 等待预算耗尽仍限流 | 报告 `error_code=RATE_LIMIT_TIMEOUT`，`status=failed`，不重试到超时静默 |
| E-03 | 单用例执行超过 600 秒 | 杀进程，报告 `error_code=CASE_TIMEOUT`、`duration_ms>600000`；不得出现 1800 秒无记录卡死 |
| E-04 | Playwright worker 崩溃（退出码 `0xC0000142`） | 报告记录 `error_code=WORKER_CRASH`，重试最多 2 次；2 次仍崩溃则 `failed` |
| E-05 | 后端重启导致会话失效 | 评测自行重新登录，不依赖人工清理 Redis；报告中 `relogin_count ≥ 1` |
| E-06 | 旧密钥签发的历史 JWT 触发登录 500 | 评测以 `error_code=STALE_SESSION` 记录并把受影响账号标记为需重新登录，不把该账号的会话写入共享状态 |
| E-07 | 两个门禁并发执行 | 报告文件名带时间戳，互不覆盖；任一报告缺失即 `failed` |
| E-08 | 报告 JSON 读取方为旧版本 | 保留原有字段；新增 `attempts`、`wait_ms`、`error_code` 字段均为可空 |
| E-09 | 探针拿不到验证码 uuid（非限流，如服务未启动） | 报告 `error_code=CAPTCHA_UNAVAILABLE`，不重试超过 2 次 |
| E-10 | 评测进程被外部终止（宿主休眠/用户中断） | 报告保存已执行用例结果，未执行用例标记 `status=not_run` |
| E-11 | 全量模式与单需求模式结果不一致 | 以单需求报告为基线，全量报告必须包含同用例同状态；不一致即 `failed` |
| E-12 | 重试后成功 | 报告 `attempts>1` 且 `status=passed`，同时保留首次失败原因字段 `first_error` |
| E-13 | 非交付分支 / 未授权上下文触发全量评测 | 拒绝执行，`EXIT=1` 且日志含 `EVAL_PERMISSION_DENIED`，不产生报告文件 |
| E-14 | 报告 `status` 出现非法状态取值（枚举外，如被手改为 `skipped`） | 读取方按 `failed` 处理，`error_code=ILLEGAL_STATE`，门禁 `EXIT=1` |

## 4. 数据契约

报告 JSON（`specs/evals/reports/REQ-*-<timestamp>.json`）新增字段：

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| attempts | integer | 是 | null = 未执行重试机制 | 取值 ≥ 1；默认 1 |
| wait_ms | integer | 是 | null = 未发生等待 | 累计等待毫秒数 |
| error_code | string | 否 | `""` = 无错误 | 枚举：`RATE_LIMIT_TIMEOUT` / `CASE_TIMEOUT` / `WORKER_CRASH` / `STALE_SESSION` / `CAPTCHA_UNAVAILABLE` / `EVAL_PERMISSION_DENIED` / `ILLEGAL_STATE` |
| first_error | string | 是 | null = 首次即成功 | 重试前的错误摘要，不含令牌/密码 |
| relogin_count | integer | 是 | null = 未统计 | 评测内重新登录次数，≥ 0 |

原有字段（用例 ID、status、duration_ms、report 路径）保持不变。

口径补充：

- 时区：报告内 `started_at` / `finished_at` 为 ISO-8601，时区固定 `Asia/Shanghai`（UTC+8）。
- 数值精度：`wait_ms` / `duration_ms` / 时间为毫秒整数（精度 1ms），无小数；
  `attempts` / `relogin_count` 为十进制整数，精度 1。
- 枚举全量：`status ∈ {not_run, running, passed, failed}`；枚举外取值按 E-14 处理。
- 空值与 0 分开：`wait_ms=null` 表示未发生等待，`wait_ms=0` 表示进入限流分支但等待 0ms。

## 5. 非功能约束

- 性能口径：全量门禁单轮总耗时 ≤ 90 分钟（当前约 100–105 分钟，含 4×60 秒冷却）。
- 安全（脱敏）：JWT、密码、验证码一律掩码为 `***`，不得进入报告、日志或错误摘要
  （`first_error` 同样脱敏）；等待与重试日志只打印账号别名。
- 合规（留痕/审计）：每次运行保留原始日志与报告作为审计记录（日志 gitignored，
  报告入 `specs/evals/reports/`），重试不删除首次失败记录，便于回溯"谁重试了几次"。
- 可观测：报告必须输出 `attempts`、`wait_ms`、`error_code`、`relogin_count`。

## 6. 状态流转

用例状态枚举：`not_run → running → passed | failed`。允许 `failed(attempt 1..N) →
passed`（重试成功）；禁止 `failed → passed` 且 `attempts=1`（无重试不得改判）；禁止
`passed → failed` 由重试触发。非法迁移：报告字段缺失时按 `failed` 处理。

## 7. Non-goals（必填）

- 本期不做：不修改任何 P0 断言的验收口径、期望值或用例数量（A-05 为强制约束）。
- 本期不做：不修改产品代码（`frontend/`、`platform/` 业务逻辑）；不改 SPEC-008。
- 本期不做：不通过删除 Redis 共享数据（含 `online_tokens*`、会话列表）来规避登录失败。
- 本期不做：不引入新依赖、不更换浏览器内核、不做并行分片执行。
- 不兼容：旧报告 JSON 缺少新增字段时仍可被读取，但不得据此判定通过。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | 全量门禁中 REQ-003 连续登录，第 3 次 `/auth/code` 触发 10/60s 限流 | 探针等待 62s 后重试成功，报告 `wait_ms=62000`、`attempts=2`、`status=passed` |
| 正例 | Playwright A-07 用例 605 秒未结束 | 进程被杀，报告 `error_code=CASE_TIMEOUT`、`duration_ms=605000`、`status=failed`，门禁 `EXIT=1` |
| 正例 | 后端重启后评测首次登录返回 401 | 评测重新登录成功，`relogin_count=1`，后续用例全部 passed |
| **反例** | 把 `TC-A18` 的期望结果改成 `skipped` 以让全量门禁变绿 | **必须被正确拒绝**：A-05 diff 检查报 `assertions_changed=true`，门禁 `EXIT=1` |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 0.1（草稿） | Agent 起草，待 PM/业务方/架构复核 | 2026-11-14 | — |
| 0.1（草稿修订） | PM 确认全部待确认假设（会话原话「009 010 待确认全部确认」），假设转为约束 | 2026-11-14 | — |
| 1.0（签字） | 定稿：PM / 业务方 / 架构签字；假设全部确认，口径不变 | 2026-11-14 | pm aoyousky；业务 Jim Liu 2026-11-14；架构 jiankui zhang 2026-11-14 |

> ✅ 已确认假设（2026-11-14，PM 会话确认；仅确认假设口径，不构成 Spec 签字）：
> 1. **已批准**修改评测脚本资产 `scripts/evals/run_eval.py`、`scripts/evals/http_probe.mjs`
>    与 `scripts/ci-gate.sh`，范围限调度/等待/重试/报告字段，不改断言、用例、期望值。
> 2. 单用例上限 600 秒、重试上限 2 次、等待上限 180 秒按本稿数值执行。
> 3. 后端 `/auth/code` 限流 10 次/60 秒保持不变，不修改 `platform/` 配置。
> 4. 全量单轮 ≤ 90 分钟为目标值；实现后必须实测并把实测结果写入证据文档；
>    实测超出时**不得自行放宽目标**，走澄清。

## 附录：体检缺失项的补齐方式

| 体检项 | 补齐内容 |
|---|---|
| 边界缺权限/越权 | E-13：非交付分支/未授权上下文触发全量评测 → `EXIT=1`、`EVAL_PERMISSION_DENIED`、不产生报告 |
| 边界缺非法状态 | E-14：`status` 为枚举外取值 → 按 `failed`、`ILLEGAL_STATE`、`EXIT=1` |
| 契约缺时区 | 报告 `started_at`/`finished_at` 固定 `Asia/Shanghai`（UTC+8） |
| 契约缺精度 | `wait_ms`/`duration_ms` 为 1ms 精度整数；`attempts`/`relogin_count` 为整数 |
| 非功能缺脱敏 | §5 明确 JWT/密码/验证码掩码为 `***`，含 `first_error` |
| 非功能缺留痕 | §5 明确保留原始日志与报告作审计记录、重试不删首次失败记录 |
| 元信息缺 version | front-matter 增加 `version: 0.1` |
