# CLAR-011

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
