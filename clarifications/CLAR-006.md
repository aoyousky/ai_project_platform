# CLAR-006

- REQ: REQ-20261103-002
- TRIGGER: SPEC-002 v1.0 §2 A-03（`PUT /system/user` 不提交 `userName`）
- STATUS: 已裁决
- RAISED_BY: agent
- DATE: 2026-11-03

## 歧义描述

A-03 的 When 要求：`PUT /system/user` **仅修改 `nickName`，不提交 `userName`/`password`**；
Then 要求 `code=200`、`nickName` 为新值、`userName` 保持原值。

后端只读契约（`platform/aoyou-modules/aoyou-system/.../bo/SysUserBo.java`）对 `userName` 标注
`@NotBlank(message = "用户账号不能为空")`，`edit` 方法使用 `@Validated @RequestBody`。实测：

```
PUT /system/user {"userId":"900000000000000002","nickName":"Spec002 User Edited"}
→ code=500，msg="用户账号不能为空"
```

因此“不提交 `userName`”与“`code=200`”不能同时成立。plus-ui 的编辑表单也始终回传 `userName`
（控件只读，但值随表单提交）。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 Spec：When 改为“提交原 `userName` 与新 `nickName`，不提交 `password`”，Then 仍校验 `userName` 保持原值 | A-03 文本变更；评测用例改为回传原 `userName` |
| B | 保留 A-03，要求后端去掉 `userName` 的 `@NotBlank` 或改用分组校验 | 需修改 `platform/`（违反 §7 Non-goals），需后端变更审批 |
| C | 前端编辑时拆分请求（先查详情再提交） | 仍无法绕过 `@NotBlank`，不可行 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

不做默认假设。参考路径：选项 A——与 §4 数据契约“`userName` 仅新增可填，编辑不可改”的意图一致：
前端保持 `userName` 只读并原值回传，评测断言改为“提交后 `userName` 不变”。

## 冻结范围

裁决前，A-03 的“提交体不含 `userName`”这一表述不纳入实现/评测结论；编辑功能本身（`userName`
只读并原值回传、`password` 不提交）可继续实现与验证。

## PM 裁决

- 裁决：**按照事实执行**（选项 A）——保留后端 `@NotBlank` 校验，不修改 `platform/`。
- A-03 的 When 改为“提交原 `userName`（只读、不可改）与新 `nickName`，不提交 `password`”；
  Then 仍校验 `code=200`、`nickName` 为新值、`userName` 保持原值。
- 是否升版 Spec Packet：**是**，升版后版本号：**1.1**。
- 裁决日期：2026-11-04；裁决人：aoyousky（业务/架构签字人）。
