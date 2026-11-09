# CLAR-011（编号冲突合并记录）

> 合并说明（2026-11-09）：`003-system-auxiliary` 与 `005-home-workbench` 两条并行分支各自新增了
> 同号 CLAR-011。为保证两边 `trace` 与 `SPEC` 中的 `clarifications/CLAR-011.md` 引用都不失效，
> 本文件并列保留两份记录（按日期排序）；后续新澄清请从 CLAR-015 起编号。

---

# CLAR-011（REQ-20261107-004）

- REQ: REQ-20261107-004（同时影响 REQ-20261101-001）
- TRIGGER: SPEC-001 v1.2 §7 Non-goals「不启用多租户（`tenant/*` 页面仅保留菜单，页面按 403 处理）」 vs CLAR-004 PM 裁决「tenant/* 一并纳入、完整 CRUD」及 `specs/003-system-config-tenant/spec.md` FR-015 / FR-016
- STATUS: 已失效（范围变更，2026-11-07；tenant/client 不在当前交付范围，留待后续 REQ 单独裁决）
- RAISED_BY: agent
- DATE: 2026-11-07

> 范围变更记录（2026-11-07）：用户明确本次只交付系统管理五个模块（字典、参数、公告、日志、文件）共 8 个视图，
> `client/*`、`tenant/*`、`tenantPackage` 不在本次范围。因此本澄清中的 tenant Non-goals 冲突对当前
> Packet 不再触发；上游草稿已归档到 `specs/_drafts/003-system-config-tenant-superseded/`，
> 当前交付依据为新 Packet `SPEC-004-system-auxiliary.md`（REQ-20261107-005）。tenant 范围如后续启动，
> 仍需先按本文件原问题裁决并升版 SPEC-001。

## 歧义描述

CLAR-004 的 PM 裁决已将 `tenant/*` 纳入范围，并注明「§7 Non-goals 需相应改写」；但该改写至今未落笔，SPEC-001 仍停留在 v1.2，其 §7 继续声明 tenant 页面按 403 处理。两份已存在的依据因此互相矛盾：

1. 若以 CLAR-004 为准：tenant 页面须在 SPEC-004 中定义完整 CRUD 断言，但需要一份已升版的 SPEC-001 支撑，否则同一仓库内存在两个生效且冲突的 Non-goals。
2. 若以 SPEC-001 v1.2 为准：tenant 页面不在本期交付范围，SPEC-004 只能覆盖 7 个页面（字典、参数、公告、文件、客户端及其两个隐藏页），与 CLAR-004 的「一并纳入」相背。

按 CLAUDE.md 铁律 2，Non-goals 与断言冲突属于 STOP 条件；Agent 不得自行取舍，也不得修改 `specs/` 下任何文件。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | PM/架构升版 SPEC-001 至 v1.3：删除或改写 §7 的 tenant Non-goals，注明 tenant 范围由 SPEC-004 承接；随后 SPEC-004 覆盖 9 页（含 tenant/tenantPackage）并签字 | 新增 SPEC-004 FR-015/FR-016 及租户 A-xx/E-xx；REQ-001 的 A-01～A-08 不变 |
| B | 不改 SPEC-001，SPEC-004 以「后续裁决覆盖旧 Non-goals」方式声明范围并签字 | SPEC-004 含租户断言，但仓库内保留冲突文本；审计/追溯无法自证，双真相源 |
| C | 批 4 先只交付 7 页（字典/参数/公告/文件/客户端），tenant 拆为后续 REQ 单独裁决 | SPEC-004 不含租户断言；与 CLAR-004「一并纳入」冲突，需 PM 明确改口 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

无默认假设。批 4 的实现（含 7 页与租户页）在裁决前全部冻结；已产出的上游草稿 `specs/003-system-config-tenant/spec.md` 仅为意图记录，不是交付依据。

## PM 裁决

**2026-11-07 裁决：本批按 8 视图交付（字典 / 参数 / 公告 / 操作日志 / 登录日志 / 文件 / 文件配置，含隐藏字典数据页与隐藏文件配置页）；`client/*`、`tenant/*`、`tenantPackage` 不在本批，留待后续 REQ 单独裁决。**

- 依据：用户 2026-11-07 明确选择 8 视图；当前交付依据为 `SPEC-004-system-auxiliary.md`（REQ-20261107-005）。
- 本澄清的 tenant Non-goals 冲突不再阻塞当前 Packet；当前 Packet 不包含任何 tenant 断言。
- 后续 tenant REQ 启动时，仍须先按本文件原问题裁决 CLAR-004 与 SPEC-001 §7 的冲突，并升版 SPEC-001。

---

# CLAR-011（REQ-20261108-006）

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
