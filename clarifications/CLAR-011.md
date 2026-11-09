# CLAR-011

- REQ: REQ-20261108-006
- TRIGGER: DataContract `groups.*[].dueTime` / `groupCounts.overdue` / `groupCounts.today` / `groupCounts.next7Days` / A-07 / A-08
- STATUS: 已回写 Spec
- RAISED_BY: agent
- DATE: 2026-11-08

## 歧义描述

SPEC-005 v1.0 的工作台契约要求待办按截止时间分组：`dueTime`、`overdueHours`、
`groupCounts.overdue/today/next7Days/unscheduled`，A-07 还要求固定出现 2/3/2/0 的分布。
但当前仓库的 Warm-Flow 任务实体、`FlowTaskVo` 与 `flow_task` 表都没有截止时间字段：

- `platform/aoyou-modules/aoyou-workflow/src/main/java/com/aoyou/workflow/domain/vo/FlowTaskVo.java:32`
  只有 `createTime` / `updateTime`，没有 `dueTime`。
- `platform/script/sql/ry_workflow.sql:97` 的 `flow_task` 表只有 `create_time` / `update_time`，
  没有 `due_time`；Warm-Flow `Task` 接口也没有截止时间 getter。
- `FlowTaskVo.varList` 只是流程变量 Map，不能保证每个流程都提供截止时间。

因此有两种理解：

1. **A：截止时间是工作流持久化业务字段**。需要在 `flow_task` 或扩展表新增 `due_time`，
   在任务创建/流转时写入；没有值的任务进入 `unscheduled`。
2. **B：截止时间是工作台的展示计算值**。不改工作流表，按任务 `createTime` 加流程定义/
   配置的 SLA 推导 `dueTime`；没有 SLA 的任务进入 `unscheduled`。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 新增 `flow_task.due_time`（或 `flow_task_ext`），由发起/流转逻辑写入；需要 DDL、历史数据回填策略与 Warm-Flow 适配；`dueTime` 是真实业务值，`null` 才表示未设截止 | A-07、A-08、E-07、E-12；§4.4 与 §6；需修改 `aoyou-workflow` 模块，超出已确认的“仅 `aoyou-admin` 聚合”范围 |
| B | 不改表；`dueTime = createTime + SLA`，SLA 来自配置（如 `dashboard.workbench.defaultSlaHours=72`，可按流程定义覆盖）；`null` 只用于禁用 SLA 的任务。`今天到期`/`未来 7 天` 都由派生值计算 | A-07、A-08、E-07、E-12；§4.4 与 §6；需在 Spec 明确 SLA 配置键、默认值与“派生值不是业务截止时间”的语义 |
| C | 仅当 `FlowTaskVo.varList` 存在 `dueTime` 变量时返回，否则 `null` + `unscheduled`；不改表也不定义 SLA | A-07 无法保证 2/3/2/0；A-08 过滤结果依赖业务流程是否填变量；§4.4 需改 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

**B**：不改工作流表，按 `createTime + SLA` 派生 `dueTime`，默认 `dashboard.workbench.defaultSlaHours=72`，
按流程定义可选覆盖；无 SLA 的任务进入 `unscheduled`。选 B 的原因是它不触碰 Warm-Flow 表结构，
但仍必须由 PM 裁决并在 Spec v1.1 写死 SLA 键、默认值、覆盖优先级与 `null` 语义；
本问题单裁决前，工作台分组相关实现冻结。

## PM 裁决

- 裁决人：aoyousky（PM）
- 裁决日期：2026-11-08
- 结论：**采纳 B**。不改 `flow_task` 表结构；`dueTime = task.createTime + SLA`。
  默认配置键 `dashboard.workbench.defaultSlaHours`，缺省 72；按流程定义的覆盖键与优先级在 Spec v1.1 写死。
  `dueTime=null` 仅用于显式禁用 SLA 的任务；`overdueHours` 与 `groupCounts` 均基于派生 `dueTime` 计算。
- 升版：**是**。Spec Packet 已升为 **v1.1** 并覆盖 `specs/SPEC-005-home-workbench.md`；
  三方签字沿用 v1.0 签字人（aoyousky / Jim Liu / Jiankui zhang，日期 2026-11-08）。
- 注意：`FlowTaskVo.getCreateTime()` 当前返回友好化字符串，不返回原始 `Date`；实现必须从
  `FlowTask` 实体或直接查询 `flow_task.create_time` 获取原始时间，禁止用该 getter 参与 SLA 计算。
