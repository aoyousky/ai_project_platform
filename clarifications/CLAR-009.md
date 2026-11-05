# CLAR-009

- REQ: REQ-20261104-003
- TRIGGER: A-18（`/getRouters` 返回与 `visible` 字段语义）
- STATUS: 待裁决
- RAISED_BY: agent
- DATE: 2026-11-05

## 歧义描述

SPEC-003 v1.1 A-18（`specs/SPEC-003-role-menu-dept-post.md:63`）的 Then 要求：

> `code=200`；返回路由中包含子菜单对应路由；未授权的菜单不出现；`visible='1'` 的菜单不出现

平台实际行为（`platform/` 只读，按 Non-goals 不得修改）：

1. `SysMenuServiceImpl.selectMenuTreeByUserId` 对非超管账号只按 `sys_role_menu` 过滤，
   **没有 `visible` 条件**，`visible='1'` 的菜单同样进入候选集。
2. `SysMenuServiceImpl.buildMenus` 对每项执行 `router.setHidden("1".equals(menu.getVisible()))`
   —— 即 `visible='1'` 的语义是“**返回但标记 hidden**”，不是“不返回”。

实测证据（本地 Docker 栈，2026-11-05，登录 `spec003_router` 后直接调用后端）：

```json
{ "code": 200, "data": [ { "name": "Spec003900003000000000014", "path": "/spec003",
  "children": [
    { "path": "menu",            "hidden": false, "component": "system/role/index" },
    { "path": "spec003-hidden",  "hidden": true,  "component": "system/dept/index",
      "meta": { "title": "Spec003 隐藏菜单" } } ] } ] }
```

夹具 `spec003_hidden`（`HIDDEN_MENU_ID=900003000000000017`）确实以 `hidden: true` 出现。

附带问题（同一断言）：A-18 的 When 写 `GET /getRouters`，实测该路径返回
`{"code":404,"msg":"请求地址不存在"}`；实际映射为 `GET /system/menu/getRouters`
（前端适配层 `frontend/apps/web-antdv-next/src/api/core/menu.ts:133` 亦使用此路径）。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 Spec：A-18 的 Then 改为「`visible='1'` 的菜单以 `hidden=true` 返回，且不渲染为可见侧边栏入口」；同时把 When 的 `/getRouters` 更正为 `/system/menu/getRouters` | A-18 可通过；断言仍覆盖“隐藏菜单不产生可见入口”的业务意图，E2E 可断言 `hidden:true` + 侧边栏无该标题 |
| B | 保持 Then「`visible='1'` 的菜单不出现」，要求后端在 `selectMenuTreeByUserId` 加 `visible='0'` 过滤 | 违反 Non-goals（`platform/` 零改动），本需求无法交付；且会破坏 RuoYi 隐藏路由（如个人中心）的既有用法 |
| C | 从 A-18 删除「`visible='1'` 的菜单不出现」一句，仅保留前三个 Then | A-18 可通过，但失去对 `visible` 字段生效的覆盖，FR-023「菜单属性生效」映射不完整 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

倾向于 A：`visible` 在 RuoYi 体系里的定义就是“隐藏菜单（hidden route）”，
`platform` 的 `buildMenus` 实现与该定义一致；A-18 原文的“不出现”应理解为
“不在侧边栏出现”，而非“不出现在 JSON 里”。
**但未经裁决不得据此修改 Spec、用例或编写断言。**

## PM 裁决

<待裁决>
