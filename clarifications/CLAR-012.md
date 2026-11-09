# CLAR-012

- REQ: REQ-20261108-006
- TRIGGER: DataContract `efficiency.completedThisWeek` / `efficiency.avgHandleHours` / `efficiency.overdueRate` / A-09
- STATUS: 已回写 Spec
- RAISED_BY: agent
- DATE: 2026-11-08

## 歧义描述

SPEC-005 v1.1 只给出本周效率的夹具目标值（已完成 12、平均处理 3.2 小时、超时率 8%），
没有定义三个统计口径；仓库现有工作流代码也没有可复用的效率统计实现，无法从代码反推：

1. **“本周”边界**：自然周（周一 00:00～周日 23:59:59，Asia/Shanghai）还是滚动 7 天
   （当前时刻往前 7×24 小时）？两者在周中/跨周时结果不同。
2. **平均处理时长**：`flow_his_task.update_time - flow_his_task.create_time`（当前节点任务
   办理时长），还是 `flow_instance.create_time` 到本次完成（整流程实例时长）？
3. **超时率**：分母是本周完成数 `completedThisWeek` 还是当前用户全部已办数 `doneTotal`？
   超时判定是“完成时间晚于派生 `dueTime`”，还是别的口径？百分比取整规则也未定义。
4. 当本周完成数为 0 时，`avgHandleHours`/`overdueRate` 已约定为 `null`；但如果分母用
   `doneTotal`，则即使本周完成数为 0 也可能有非空值，与 §4.4 的 `null` 语义冲突。

相关数据现状：
- `flow_his_task` 有原始 `create_time`（任务开始）与 `update_time`（审批完成），
  见 `platform/script/sql/ry_workflow.sql:117`。
- `FlowHisTaskVo.getCreateTime()` 返回友好化字符串，不能用于数值计算；原始时间需从
  `FlowHisTask` 实体或直接查询获取。
- 当前没有现成的“本周完成数/平均时长/超时率”服务或 SQL。

## 影响对比

| 选项 | 行为 | 影响的断言/契约 |
|---|---|---|
| A | 自然周（周一 00:00～周日 23:59:59.999，Asia/Shanghai）；`completedThisWeek` = 当前用户 `flow_his_task` 中 `update_time` 落在本周的记录数；`avgHandleHours` = 这些记录 `update_time - create_time` 的平均值，BigDecimal 1 位小数、四舍五入；`overdueRate` = 这些记录中 `update_time > 派生 dueTime` 的占比，四舍五入到整数；本周完成数为 0 时两项为 `null` | A-09；§4.4、§4.5、§10；需 Spec v1.2 |
| B | 滚动 7 天（当前时刻往前 7×24 小时，含当前时刻）；其余口径同 A | A-09；§4.4、§4.5、§10；需 Spec v1.2 |
| C | 自然周；“平均处理时长”改为整流程实例时长（实例开始到本次完成）；其余口径同 A | A-09；§4.4、§4.5、§10；需 Spec v1.2；需额外读取 `flow_instance.create_time` |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

**A**：自然周 + 当前节点任务办理时长 + 本周完成数为分母 + 四舍五入；本周完成数为 0 时
`avgHandleHours`/`overdueRate` 为 `null`。选 A 的原因是它与“本周效率”的中文语义一致，
且 `flow_his_task` 已同时具备任务开始与完成时间，不需要额外读取实例开始时间。
本问题单裁决前，`efficiency` 相关实现冻结；不得用夹具数字倒推公式。

## PM 裁决

- 裁决人：aoyousky（PM）
- 裁决日期：2026-11-08
- 结论：**采纳 B（滚动 7 天 + 节点任务时长）**。
  - 统计窗口：请求时刻往前 7×24 小时（`[now - 7 days, now]`，含边界）；显示日期仍按 Asia/Shanghai。
  - `completedThisWeek`：当前用户 `flow_his_task` 中 `update_time` 落在窗口内的记录数。
  - `avgHandleHours`：上述记录 `update_time - create_time` 的平均值，BigDecimal 1 位小数、四舍五入。
  - `overdueRate`：上述记录中 `update_time > 派生 dueTime` 的占比，四舍五入到整数；分母为 `completedThisWeek`；
    `completedThisWeek=0` 时 `avgHandleHours`/`overdueRate` 为 `null`。
- 升版：**是**。用户于 2026-11-08 明确指令“按 v1.2 升版并覆盖 specs/SPEC-005-home-workbench.md”；
  Spec Packet 已升为 **v1.2** 并覆盖正式文件，签字沿用 v1.0/v1.1 三方（aoyousky / Jim Liu /
  Jiankui zhang，日期 2026-11-08）。
</content>
</file_path>
