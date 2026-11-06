# CLAR-004

- REQ: REQ-20261101-001
- TRIGGER: SPEC-001 v1.1 §2（A-03～A-07）/ §4（仅有 PostVO）/ §7（Non-goals）；tasks.md T046
- STATUS: 已裁决
- RAISED_BY: agent
- DATE: 2026-11-02

## 歧义描述

用户新增要求：“补充完整系统管理功能模块，适应新的 Vben 架构要求。”

当前 Spec Packet 没有定义“完整系统管理功能模块”的范围与深度，存在三种理解：

1. **窄口径（仅 system 上下文）**：移植 `system/user`、`system/role`、`system/menu`、`system/dept`、`system/post`、`system/dict`、`system/config`、`system/notice`、`system/log`（操作日志/登录日志）、`system/oss`、`system/client`，行为对齐 plus-ui 现状；`monitor`、`tool/gen`、`demo`、`workflow`、`task` 不在内。
2. **宽口径（所有非 hidden 菜单）**：除 system 外，还包括 `monitor`、`tool/gen`、`demo`，甚至此前 §7 Non-goals 明确排除的 `workflow/*`、`task/*`。
3. **最窄口径（可达即可）**：只满足 A-03 菜单可达与 E-09 统一占位页，不要求各模块 CRUD。

同时以下事项也未定义：

- **功能深度**：完整 CRUD（列表、搜索、新增、修改、删除、导入/导出、权限按钮、字典/部门树/菜单树等）对齐 plus-ui，还是只读列表/详情？
- **数据契约**：SPEC §4 只有 `PostVO` 字段；`UserVO`、`RoleVO`、`MenuVO`、`DeptVO`、`DictTypeVO`、`DictDataVO`、`ConfigVO`、`NoticeVO`、`OperLogVO`、`LoginLogVO`、`OssVO`、`ClientVO` 的字段、可空性、空值语义均未定义。
- **验收断言**：A-04～A-07 只覆盖 `system/post`；其余模块没有 A-xx/E-xx，无法写入 trace 的 `assertion_map`，也无法判定 DoD。
- **与 Non-goals 的冲突**：§7 明确“不移植 workflow/*、task/*”“tenant/* 仅保留菜单”；若“完整”包含这些菜单，需要先修改 Non-goals。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 仅 system 上下文 11 类页面完整 CRUD，monitor/tool/demo 与 workflow/task 不做 | 需为每模块新增 A-xx/E-xx 与 VO 契约，Spec 升版至 v1.2；A-03 满足，A-04～A-07 保持 |
| B | 所有非 hidden 菜单完整功能（含 monitor/tool/gen/demo；workflow/task 是否含需再裁决） | 范围最大，需修改 §7 Non-goals，新增大量断言与契约 |
| C | 仅统一占位页保证菜单可达，不实现各模块 CRUD | 只需 A-03 + E-09；不新增契约，但用户“完整功能”诉求未满足 |
| D | 先按已签 A-04～A-07/T041–T044 完成 `system/post` 范式，其余模块分批补 Spec | 可立即推进已签范围；后续批次仍须裁决并升版 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

不设默认假设。若必须给出参考路径：建议选 **A + 完整 CRUD**，并升版 Spec Packet 至 v1.2，为每个 system 模块补 A-xx/E-xx 与 VO 字段契约；`workflow/*`、`task/*` 继续维持 Non-goals。该建议未经裁决，不得作为实现依据。

## PM 裁决

- 范围：**所有非 hidden 菜单**（含 system、monitor、tool/gen、demo；workflow/*、task/* 及 tenant/* 一并纳入，§7 Non-goals 需相应改写）。
- 功能深度：**完整 CRUD，对齐 plus-ui 现状**（列表、搜索、新增、修改、删除、导入/导出、权限按钮、字典/树形数据等）。
- 数据契约：**升版 Spec Packet 至 v1.2**，为每个模块补 A-xx / E-xx 断言与 VO 字段契约。
- 裁决日期：2026-11-02。
- 实现前置：v1.2 需完成架构/业务签字后，方可进入实现；签字前实现冻结。

## Agent 执行约束（基于 SPEC-TEMPLATE §2）

SPEC-TEMPLATE 规定单个 Spec Packet 的 P0 断言为 5–12 条，超过应拆需求。REQ-001 已有 8 条 P0（A-01～A-08），无法在 v1.2 内再容纳“所有非 hidden 菜单 + 完整 CRUD”的模块级断言。因此建议按限界上下文拆为以下新需求，REQ-001 v1.2 仅补充范围边界与依赖说明：

| 新需求（建议编号） | 范围（对应后端菜单） | 风险 | P0 预估 |
|---|---|---|---|
| REQ-002 | 系统管理核心：用户、角色、菜单、部门、岗位（含分配角色/分配用户隐藏页） | L2 | 5–6 |
| REQ-003 | 系统配置与租户：字典、参数、通知公告、文件管理、客户端、租户、租户套餐（含字典数据/文件配置隐藏页） | L2 | 7 |
| REQ-004 | 日志与监控：操作日志、登录日志、在线用户、缓存监控、Admin 监控、任务调度中心 | L2 | 6 |
| REQ-005 | 工具与演示：代码生成（含修改生成配置）、测试单表、测试树表、请假申请入口 | L1 | 3–4 |
| REQ-006 | 工作流与任务：流程分类、流程表达式、流程定义、流程实例、待办任务、我发起的/我的待办/我的已办/我的抄送、流程设计、请假编辑 | L3 | 8–10 |

> 拆分是模板约束下的包装方式，不缩减 PM 裁决的范围；PLUS 官网外链已由 REQ-001 A-11 覆盖。
