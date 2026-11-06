# CLAR-005

- REQ: REQ-20261103-002
- TRIGGER: SPEC-002 v1.0 §2 A-05（`PUT /system/user/authRole` 对 `userId=1` 的拒绝）
- STATUS: 已裁决
- RAISED_BY: agent
- DATE: 2026-11-03

## 歧义描述

A-05 要求：对内置管理员 `userId=1` 分别调用 `DELETE /system/user/1`、`PUT /system/user/changeStatus`、
`PUT /system/user/resetPwd`、`PUT /system/user/authRole`（空 `roleIds`），**四个响应均 `code ≠ 200`**。

后端只读代码（`platform/`，本期 Non-goal 禁止修改）显示：

| 接口 | 是否保护 `userId=1` | 依据 |
|---|---|---|
| `DELETE /system/user/{userIds}` | 是 | `SysUserServiceImpl.deleteUserByIds` → `checkUserAllowed`（抛“不允许操作超级管理员用户”） |
| `PUT /system/user/changeStatus` | 是 | Controller 调 `checkUserAllowed` |
| `PUT /system/user/resetPwd` | 是 | Controller 调 `checkUserAllowed` |
| `PUT /system/user/authRole` | **否** | Controller 只调 `checkUserDataScope`；`insertUserRole` 对空 `roleIds` 直接 `return`，随后返回 `R.ok()` |

因此 A-05 的第四个调用按现有后端会返回 `code=200`，与断言冲突；在不修改 `platform/`、
不改变 Non-goals 的前提下无法满足。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 Spec：把 `authRole` 从 A-05 的“必须拒绝”集合移出；管理员不可分配角色改由前端隐藏入口（A-15/P1）保证；A-05 只断言删除/启停/重置密码三条 | A-05 断言文本变更；前端实现不变 |
| B | 保留 A-05，要求后端在 `insertAuthRole` 增加 `checkUserAllowed` | 需修改 `platform/`（违反 §7 Non-goals），并走后端变更审批；本期不交付 |
| C | 前端接受 `code=200` 并自行判定 `userId=1` 不展示入口，A-05 第四条改为前端行为断言 | A-05 降级/拆分，评测集不再对 API 层断言该条 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

不做默认假设。参考路径：选项 A——管理员保护在 UI 层（A-15）已覆盖，A-05 的 API 层只保留
后端确实实现的三条；若业务要求 API 层也拒绝，则必须先取得 `platform/` 变更授权（选项 B）。

## 冻结范围

在裁决前，`A-05` 中 `PUT /system/user/authRole`（`userId=1`）这一子项**不纳入实现与评测结论**；
其余三条的保护、前端隐藏入口（A-15）与全生命周期实现可继续，但不得声称 A-05 已通过。

## PM 裁决

- 裁决：**按照事实执行**（选项 A）——以只读后端 `platform/` 的实际行为为准，不修改后端。
- A-05 应移出 `PUT /system/user/authRole` 子项，只保留删除、启停、重置密码三条必须被拒绝的调用。
- 新增 E-22 记录事实：对 `userId=1` 提交 `authRole`（空 `roleIds`）返回 `code=200` 且为 no-op；前端不渲染该入口（A-15）。
- 是否升版 Spec Packet：**是**，升版后版本号：**1.1**。
- 裁决日期：2026-11-04；裁决人：aoyousky（业务/架构签字人）。
