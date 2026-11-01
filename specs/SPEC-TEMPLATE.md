# Spec Packet 模板（机器友好版）

> 复制本文件为 `specs/SPEC-<需求编号>.md` 后填写。YAML front-matter 是给门禁脚本读的，正文是给 Agent 读的。
> 门禁规则：正文中出现模糊表述类字样（清单见 scripts/ci-gate.sh 门禁 1）直接 FAIL。

```yaml
---
id: REQ-20261030-001
title: 按订单号查询订单 v2
version: 1.0          # 断言变更必须升版
risk_level: L2        # L0 内部工具 / L1 一般业务 / L2 资金·数据敏感 / L3 合规·对外
channel: ai_direct    # ai_direct / ai_forced_review / sprint
pm: 
business_signoff:     # 业务方断言确认人
arch_reviewer:        # L2/L3 必填
target_window: 
---
```

## 1. 意图

- 业务目标（含量化指标）：
- 调用方 / 场景 / 频率：
- 上线 30 天成功度量：

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 存在订单号 ORD-10001 | GET /api/v2/orders/ORD-10001 | 200，返回体符合 schema v2，P95 ≤ 300ms |
| A-02 | P0 | 订单号不存在 | GET /api/v2/orders/ORD-99999 | 404，code = ORDER_NOT_FOUND，P95 ≤ 150ms |

> P0 断言 5–12 条，超过必须拆需求。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 订单号含非法字符 | 400，code = INVALID_ORDER_ID |
| E-02 | 订单服务下游超时 2s | 503，code = ORDER_SVC_TIMEOUT，不返回部分数据 |

## 4. 数据契约

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| order_id | string | 否 | — | 格式 ORD-\d{5} |
| amount | integer | 否 | — | 单位：分 |
| created_at | string | 否 | — | ISO8601，UTC+8 |

## 5. 非功能约束

- 性能口径：
- 安全（鉴权 / 脱敏字段）：
- 合规（留痕 / 审计）：
- 可观测（必须输出的日志/trace 字段）：

## 6. 状态流转（如涉及）

状态枚举 → 迁移表；非法迁移显式列出并写明拒绝行为。

## 7. Non-goals（必填）

- 本期不做：
- 不兼容：

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | | |
| 正例 | | |
| 正例 | | |
| **反例** | | **（必须被正确拒绝）** |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版 | | |
