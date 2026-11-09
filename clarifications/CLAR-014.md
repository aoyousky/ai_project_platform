# CLAR-014

- REQ: REQ-20261108-006
- TRIGGER: DataContract `groupCounts` / `groups.*` / A-07 / §4.4 v1.1 分组规则
- STATUS: 已回写 Spec
- RAISED_BY: agent
- DATE: 2026-11-08

## 歧义描述

SPEC-005 v1.3 规定待办只进入四个互斥分组：

- `OVERDUE`：`dueTime < now`；
- `TODAY`：`dueTime >= now` 且日期 = 今天；
- `NEXT_7_DAYS`：日期在 `[D+1, D+7]`；
- `UNSCHEDULED`：`dueTime=null`。

并规定 `groupCounts` 四项之和等于 `metrics.todoTotal`。但 `dueTime = createTime + 生效 SLA`，
而当前 Spec 只约束 `defaultSlaHours >= 1`、覆盖值 >= 0，**没有上限**。如果某个流程覆盖
`dashboard.workbench.slaHoursByFlow.<flowCode> = 240`（10 天），或默认值被配置为 240，
一个刚创建的任务会得到 `dueTime = D+10`，不属于上述任何一组：

- 不是 `OVERDUE`（未超时）；
- 不是 `TODAY`（日期不是今天）；
- 不是 `NEXT_7_DAYS`（日期 > D+7）；
- 不是 `UNSCHEDULED`（`dueTime` 非 null）。

此时 `groupCounts` 四项之和小于 `todoTotal`，直接违反 §4.4 的“和等于它”。A-07 夹具只有
D+1～D+7 内到期的任务，不会暴露该问题；但生产配置允许 >168h 的 SLA。

## 影响对比

| 选项 | 行为 | 影响的断言/契约 |
|---|---|---|
| A | 给生效 SLA 增加上限 168h：`defaultSlaHours` 与每个覆盖值必须为 0 或 1～168；非法配置启动失败（同 E-19）。这样任何过去创建的任务 `dueTime <= now + 7 天`，四组可覆盖全部待办，`groupCounts` 之和恒等于 `todoTotal` | A-07、E-19、§4.4、§10；需 Spec v1.4 |
| B | 新增第五组 `LATER`（`groups.later`、`groupCounts.later`），把 `dueTime > D+7` 的任务放入；契约、页面、A-07/A-08 的组数与文案都要扩展 | A-07、A-08、§4.4、§4.2；需 Spec v1.4；前端新增分组 |
| C | 不限制 SLA，把 `dueTime > D+7` 折入 `NEXT_7_DAYS`；`NEXT_7_DAYS` 语义改为“今天之后的全部未来任务”，页面文案不能再用“未来 7 天” | A-07、§4.4、§10 假设 5；需 Spec v1.4；语义与文案都要改 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

**A**：给生效 SLA 增加 168h 上限，非法配置启动失败。理由：不改变现有四组契约与前端结构，
只加一条配置校验；`effectiveSla <= 168` 且 `createTime <= now` 保证 `dueTime <= now + 7 天`，
四组之和恒等于 `todoTotal`；同时保留“未来 7 天”的页面语义。
本问题单裁决前，分组与 SLA 上限相关实现保持冻结。

## PM 裁决

- 裁决人：aoyousky（PM）
- 裁决日期：2026-11-08
- 结论：**采纳 A**。`defaultSlaHours` 必须为 1～168；覆盖值必须为 0 或 1～168；
  默认值 0/负数/>168、覆盖值负数/>168 均启动失败并记录配置键；保持四组契约不变。
- 升版：**是**。Spec Packet 已升为 **v1.4** 并覆盖 `specs/SPEC-005-home-workbench.md`；
  签字沿用 v1.0～v1.3 三方（aoyousky / Jim Liu / Jiankui zhang，日期 2026-11-08）。
