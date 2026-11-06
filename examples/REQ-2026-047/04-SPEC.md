---
id: REQ-2026-047
title: 优惠券批量发放任务创建（P-01）
version: 1.0
risk_level: L2            # 涉及营销预算与库存扣减，错误发放即资损
channel: ai_forced_review # L2：Agent 生成 + 双人评审
pm: 王倩
business_signoff: 陈立（运营负责人）
arch_reviewer: 刘栋
target_window: 2026-11-20
speckit_feature: specs/002-coupon-batch-issue
---

# Spec Packet｜优惠券批量发放任务创建（P-01）

## 1. 意图

- 业务目标：运营在 2 分钟内完成一次人群发券配置并提交，提交前必须能看到预计人数与预计成本两个数字；超过免审额度（人数 > 10,000 或成本 > 50,000 元）自动进入审批。
- 调用方 / 场景 / 频率：运营专员，活动排期前后，3–5 次/月；审批人（运营主管）通过 P-02 处理。
- 上线 30 天成功度量：任务创建平均耗时 ≤ 2 分钟；零重复发放事故；审批任务驳回率 < 20%。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 已选标签「沉睡用户（90 天未下单）」，人群 26,480 人 | POST /api/v1/coupon-campaigns/estimate | 200，count = 26480，P95 ≤ 800ms |
| A-02 | P0 | 未选择任何标签 | POST /api/v1/coupon-campaigns | 400，code = PARAM_MISSING_TARGET，页面提交按钮置灰 |
| A-03 | P0 | 每人 2 张 × 26,480 人 = 52,960 张，券可用库存 50,000 张 | POST /api/v1/coupon-campaigns | 409，code = COUPON_STOCK_INSUFFICIENT，响应体 shortfall = 2960 |
| A-04 | P0 | 预估人数 26,480（> 10,000）且成本 529,600 元（> 50,000） | 提交成功 | 201，status = PENDING_APPROVAL，不触发库存扣减 |
| A-05 | P0 | 携带同一 Idempotency-Key 的重复提交 | POST /api/v1/coupon-campaigns ×2 | 第二次返回 200 且 campaignId 与第一次相同，库存只扣减一次 |
| A-06 | P0 | 库存扣减成功但任务记录写入失败 | 提交 | 500，code = CAMPAIGN_CREATE_FAILED，库存查询结果与提交前一致（事务回滚） |
| A-07 | P1 | 所选券有效期至 2026-12-31 已过 | POST /api/v1/coupon-campaigns | 400，code = COUPON_EXPIRED |
| A-08 | P1 | 调用方无 coupon:campaign:create 权限 | POST /api/v1/coupon-campaigns | 403，code = FORBIDDEN |
| A-09 | P1 | 任务名称与创建人 7 天内已有任务重名 | POST /api/v1/coupon-campaigns | 409，code = CAMPAIGN_NAME_DUPLICATED |

> P0 断言 6 条，P1 断言 3 条，共 9 条，未超 12 条上限，不拆需求。

## 3. 边界与异常

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 标签命中人数为 0 | 200，count = 0，页面显示「该人群当前无可用用户」，提交按钮置灰 |
| E-02 | 预估接口超时（> 3s） | 前端展示「预估失败（ERR-5012）」+ 重试；重试不清空已选标签 |
| E-03 | 提交时标签已被并发删除 | 409，code = TAG_NOT_FOUND，提示重新选择人群 |
| E-04 | 提交时券已被下线 | 409，code = COUPON_OFFLINE |
| E-05 | 人数 80,000 的标签预估 | 前端对标签变化做 500ms 防抖；预估值返回 P95 ≤ 800ms |
| E-06 | 同一标签被重复选择 | 前端自动去重，targetTags 不含重复项，预估人数不重复累加 |
| E-07 | 提交请求网络中断 | 客户端不自动重发；恢复后通过 GET /campaigns?name= 确认是否已创建 |
| E-08 | 浏览器刷新 | 草稿从服务端恢复，已选标签与券回填，草稿保留 24h |
| E-09 | 定时发放时间早于当前时间 + 5 分钟 | 400，code = PARAM_INVALID_SCHEDULE_TIME |
| E-10 | 券可用库存为 0 | 券在列表中置灰并标注「已发完」，不可选 |
| E-11 | 预估人数与提交时实际人数不一致（标签人群变动） | 以提交时快照为准；任务详情展示 snapshot_count 字段 |
| E-12 | 网关重试导致同一请求到达 3 次 | 服务端以 Idempotency-Key 唯一索引兜底，仅创建 1 个任务 |

## 4. 数据契约

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| target_tags | string[] | 否 | — | 非空数组，≤10 项，服务端去重 |
| coupon_id | string | 否 | — | 长度 12，格式 CUP+9 位数字 |
| per_user_count | integer | 否 | — | 1–5，默认 1 |
| schedule_time | string | 是 | null = 立即发放 | ISO8601 含时区，必须 ≥ now + 5min |
| estimate_count | integer | 是 | null = 未预估；0 = 真实空人群 | 两者语义不同，禁止合并表示 |
| cost_amount | integer | 否 | — | 单位：分；展示层转为元并千分位 |
| status | string | 否 | — | 枚举见第 6 节 |

## 5. 非功能约束

- 性能口径：预估 P95 ≤ 800ms（8 万人群口径）；提交 P95 ≤ 500ms。
- 安全：接口需 coupon:campaign:create 权限；手机号等人群明细不在本页展示（属 P-03 且需单独权限）。
- 合规：每次提交记录操作人、时间、快照人数，留痕保存 ≥ 3 年。
- 可观测：日志必须含 trace_id、campaign_id、operator_id、idempotency_key、snapshot_count、result_code 六字段。

## 6. 状态流转

枚举：DRAFT → PENDING_APPROVAL → APPROVED → EXECUTING → SUCCESS / PARTIAL_SUCCESS / FAILED；任意非终态可 CANCELLED。

非法迁移及拒绝行为：
- EXECUTING → PENDING_APPROVAL：409，code = INVALID_STATUS_TRANSITION
- CANCELLED → 任意状态：409，code = INVALID_STATUS_TRANSITION
- PENDING_APPROVAL → EXECUTING（跳过审批）：409，code = APPROVAL_REQUIRED

## 7. Non-goals

- 本期不做：人群规则编辑器（沿用现有标签系统）、券的创建与编辑、审批流可配置化（固定两级）、发放结果实时推送（任务详情轮询）、跨租户发放、S-04 的失败重发与 S-05 的导出（归 P-03，单独出 Spec）。
- 不兼容：不兼容 v1 散发接口（/coupons/grant），旧接口按原计划下线，不并行。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | 标签「高价值（年消费≥5000）」12,300 人、券「满100减20」每人 1 张 | 提交成功，status = PENDING_APPROVAL（人数 > 10,000） |
| 正例 | 标签「11 月新注册」380 人、券「满100减20」每人 1 张 | 提交成功，status = EXECUTING，直接执行 |
| 正例 | 携带 Idempotency-Key = 9f2c… 提交后网络超时，用同 Key 重发 | 两次返回同一 campaignId，库存只扣一次 |
| **反例** | estimate_count = 0 但仍允许提交（把"未预估"当作"空人群"） | **必须被拒绝：预估未完成时提交按钮置灰，接口返回 400 PARAM_MISSING_ESTIMATE** |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版：断言 9 条 / 边界 12 条，风险 L2，通道 ai_forced_review | 2026-11-04 | 王倩 / 陈立 / 刘栋 |
