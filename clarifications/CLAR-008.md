# CLAR-008

- REQ: REQ-20261104-003
- TRIGGER: A-03（角色菜单授权回显）
- STATUS: 已回写 Spec
- RAISED_BY: agent
- DATE: 2026-11-04

## 歧义描述

SPEC-003 v1.0 A-03 的 When 明确要求 `PUT /system/role` 携带 `menuIds=[目录ID, 子菜单ID]` 且
`menuCheckStrictly=true`，Then 要求随后 `GET /system/menu/roleMenuTreeselect/{roleId}` 的
`checkedKeys` **同时包含两个 ID**。

平台实际行为（`platform/` 只读，按 Non-goals 不得修改）：

- `SysRole.menuCheckStrictly=true` 表示“父子不联动”。保存后查询时，
  `SysMenuMapper.selectMenuListByRoleId(roleId, menuCheckStrictly=true)`
  （`platform/aoyou-modules/aoyou-system/src/main/java/com/aoyou/system/mapper/SysMenuMapper.java:141-143`）
  会执行 `notInSql(menuId, buildParentMenuByRoleSql(roleId))`，把“已分配菜单的父节点”从
  `checkedKeys` 中剔除，由树的联动规则回显父节点。
- `GET /system/menu/roleMenuTreeselect/{roleId}`（`SysMenuController.java:97`）不接收
  `menuCheckStrictly` 参数，只按角色已保存的该字段决定过滤，调用方无法改变。

实测（本地 Docker 栈，2026-11-04，`scripts/evals/run_eval.py --req REQ-20261104-003`）：

| 保存时的 `menuCheckStrictly` | `checkedKeys` 实际返回 | A-03 期望 |
|---|---|---|
| `true` | `["900003000000000015"]`（只有子菜单） | 两个 ID —— **不满足** |
| `false` | `["900003000000000014","900003000000000015"]` | 两个 ID —— 满足 |

即：A-03 的 When（`menuCheckStrictly=true`）与 Then（两个 ID 都回显）在平台现有语义下
互斥，且实现侧无法调和（后端只读、前端无法改变查询结果）。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 Spec：A-03 的 When 改为 `menuCheckStrictly=false`，Then 保持“两个 ID 均回显”。评测用例改为提交 `false`，与 plus-ui 默认（父子联动）一致。 | A-03 可通过；断言仍覆盖“保存后回显不丢 ID”的业务意图 |
| B | 升版 Spec：保留 When=`true`，Then 改为“`checkedKeys` 仅含叶子 ID（`spec003_menu`），父节点不出现在 `checkedKeys`，由树组件按联动规则回显”。 | A-03 可通过；但断言失去“父节点已保存”的可观测证据，需另加一条 `sys_role_menu` 侧的间接证据或树接口 `menus` 断言 |
| C | 不改 Spec，视为平台缺陷要求后端修改 | 违反 Non-goals（`platform/` 零改动），本需求无法交付 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

倾向于 A：A-03 的业务意图是“角色菜单授权保存后能正确回显”，`menuCheckStrictly=true`
（父子不联动）只是 When 里的一个前端开关描述，与 plus-ui 默认值（联动）不一致，应为笔误。
**但未经裁决不得据此修改 Spec 或用例。**

## PM 裁决

**选 A**（用户 2026-11-04 对话裁决，原文回复“A”）：升版 Spec Packet 至 **v1.1**，A-03 的
When 改为 `menuCheckStrictly=false`，Then 保持“两个 ID 均回显”；§8 首条正例同步修正；
`specs/evals/REQ-20261104-003/cases.yaml` 的 `spec_version` 升为 `1.1` 并同步入参。

是否升版 Spec Packet：是，升版后版本号：1.1。

裁决后复跑评测：REQ-20261104-003 **12/12 通过**（`specs/evals/reports/REQ-20261104-003-20261104-204209.json`）。
