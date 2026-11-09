# CLAR-013

- REQ: REQ-20261108-006
- TRIGGER: E-05 / DataContract `deptDistribution[].deptName`
- STATUS: 已回写 Spec
- RAISED_BY: agent
- DATE: 2026-11-08

## 歧义描述

SPEC-005 v1.2 的 E-05 要求“单个部门名称为 80 个字符，接口返回完整 `deptName`”，
§4.2 的 `deptDistribution[].deptName` 也声明为“1～100 字符”。但仓库基线库表的
`sys_dept.dept_name` 是 `varchar(30)`：

- `db/migrations/sql/V1__baseline_aoyou_5.6.2.sql:103`：
  `dept_name varchar(30) default '' comment '部门名称'`。
- 同一基线 `sys_notice.notice_title` 是 `varchar(50)`，与 §4.2 的“1～100 字符”也不一致
  （A-05 只校验标题内容，不校验长度，暂不作为本问题单的主触发项）。

因此 E-05 在当前表结构下不可满足：插入 80 字符会被 MySQL 拒绝或截断，接口不可能返回完整
80 字符。可行路径只有两条：

1. **A：改 Spec 边界**。E-05 改为 30 字符（现有列上限），`deptDistribution[].deptName`
   契约改为 1～30；不新增 DDL。页面仍验证省略号截断与 `title` 完整名称。
2. **B：改表结构**。新增迁移把 `sys_dept.dept_name` 扩到 `varchar(100)`，并同步
   `sys_notice.notice_title`（如一并修正）；需要 DDL，违反 §7 Non-goals“不做数据回填或 DDL”，
   必须升 v1.3 并重新签字。

## 影响对比

| 选项 | 行为 | 影响的断言/契约 |
|---|---|---|
| A | E-05 夹具改为 30 字符；`deptName` 契约 `1～30`；不新增 DDL；UI 截断测试仍有效 | E-05、§4.2、§8；需 Spec v1.3 |
| B | 新增迁移扩列到 `varchar(100)`；E-05 保留 80 字符；需评估历史数据、迁移回滚与 Non-goals 例外 | E-05、§4.2、§7、§8；需 Spec v1.3；新增 DDL，超出当前 Non-goals |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

**A**：把 E-05 的夹具长度改为 30 字符，并把 `deptDistribution[].deptName` 契约改为 1～30。
理由：不新增 DDL、不触碰基线表结构，且 30 个中文字符在 1024×768 下足以触发省略号截断与
`title` 完整名称的 UI 行为；B 需要迁移与回滚方案，超出当前 Non-goals。
本问题单裁决前，部门分布相关实现与 E-05 测试夹具保持冻结。

## PM 裁决

- 裁决人：aoyousky（PM）
- 裁决日期：2026-11-08
- 结论：**采纳 A**。E-05 部门名夹具改为 30 字符；`deptDistribution[].deptName` 契约改为 1～30；
  不新增 DDL，不修改基线表结构。
- 升版：**是**。Spec Packet 已升为 **v1.3** 并覆盖 `specs/SPEC-005-home-workbench.md`；
  签字沿用 v1.0/v1.1/v1.2 三方（aoyousky / Jim Liu / Jiankui zhang，日期 2026-11-08）。
