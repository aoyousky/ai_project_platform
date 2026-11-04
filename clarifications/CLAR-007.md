# CLAR-007

- REQ: REQ-20261103-002
- TRIGGER: SPEC-002 v1.0 §2 A-06 / §3 E-21（提交空 `roleIds` 清空用户角色）
- STATUS: 已裁决
- RAISED_BY: agent
- DATE: 2026-11-03

## 歧义描述

A-06 要求：以空 `roleIds` 提交后，`roles[]` 中 `R.flag=false`，且 `roleIds` 不含 `R`。
E-21 同样要求空 `roleIds` → `code=200` 且所有角色 `flag=false`。

后端只读实现（`SysUserServiceImpl.insertUserRole`）：

```java
private void insertUserRole(Long userId, Long[] roleIds, boolean clear) {
    if (ArrayUtil.isEmpty(roleIds)) {
        return;          // 直接返回，未执行 clear 分支
    }
    ...
}
```

`PUT /system/user/authRole` 仅调用 `insertUserAuth` → `insertUserRole(..., true)`；空数组在删除旧绑定
之前就返回。实测：提交空 `roleIds` 返回 `code=200`，但 `GET /system/user/authRole/{id}` 仍显示
`R.flag=true`。即“提交成功但未清空”，无法通过任何前端调用序列实现 A-06/E-21 的期望状态。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 Spec：删除“以空 `roleIds` 清空”的子项；A-06 只断言分配成功与 `flag=true`，E-21 改为“空 `roleIds` 为 no-op，返回 200，界面不报错且不改动现有角色” | A-06/E-21 文本变更 |
| B | 保留现有断言，要求后端把 `insertUserRole` 的 `clear` 分支移到空数组判断之前 | 需修改 `platform/`（违反 §7 Non-goals），需后端变更审批 |
| C | 前端用“先查全部角色再提交保留集”模拟清空 | 空集仍走同一 early return，不可行 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

不做默认假设。参考路径：选项 A——A-06 的核心价值是“授权后 `flag=true`”；清空能力当前后端不具备，
若业务必须支持清空，应走选项 B 的后端变更流程。

## 冻结范围

裁决前，A-06“清空角色”与 E-21 的“清空后 `flag=false`”不纳入评测结论；分配角色的前半段
（提交 `R` 后 `flag=true`）可继续实现与验证。

## PM 裁决

- 裁决：**按照事实执行**（选项 A）——后端空 `roleIds` 为 no-op，不修改 `platform/`。
- A-06 删除“以空 `roleIds` 清空”的子项，只断言分配成功与 `flag=true`。
- E-21 改为：空 `roleIds` 返回 `code=200` 且为 no-op，现有角色 `flag` 保持不变，页面不报错。
- 是否升版 Spec Packet：**是**，升版后版本号：**1.1**。
- 裁决日期：2026-11-04；裁决人：aoyousky（业务/架构签字人）。
