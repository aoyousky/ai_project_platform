# CLAR-015

- REQ: REQ-20261101-001（影响合并分支 `005-home-workbench` 的全量评测口径）
- TRIGGER: SPEC-001 v1.2 A-08 / FR-013「交付分支相对 `main` 的 `platform/` 零改动」
- STATUS: 已裁决
- RAISED_BY: agent
- DATE: 2026-11-09

## 歧义描述

A-08 的评测用例固定执行 `git diff --stat main...HEAD -- platform/`，要求输出为空。
它描述的是 **REQ-001 自身交付分支** 的约束；但当前验证对象是已合入
`003-system-auxiliary` 与 REQ-20261108-006 后端实现的 `005-home-workbench` 分支。

- 在 `001-vben-frontend-replacement` 分支上：`git diff --stat main...001-vben-frontend-replacement -- platform/`
  为空，A-08 通过（历史报告 8/8）。
- 在 `005-home-workbench` 分支上：该分支包含 REQ-006 新增的
  `DashboardController`、`DashboardServiceImpl` 等 20 个后端文件（+2350 行），
  A-08 按定义必然失败；本轮全量评测结果因此为 7/8。

问题在于：A-08 是否应继续按「相对 `main`」比较当前分支，还是应按
「REQ-001 自身的改动范围」比较。两种口径决定了合并分支能否用同一个评测集
判定全绿。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | A-08 只在需求自身交付分支执行；合并分支全量评测将 A-08 标记为 N/A，REQ-001 以其分支报告 8/8 作为验收证据 | 全量评测 001 由 7/8 变为「其余 7 条通过 + A-08 N/A」；不改 Spec |
| B | 改写 A-08 为按需求 diff 范围校验（只检查 REQ-001 归属的后端文件），需修改 SPEC-001 与 `specs/evals/REQ-20261101-001/cases.yaml` 并升版 | A-08 可在任意合并分支执行；需 PM 签字与 Spec 升版 |
| C | 保持 A-08 原口径，合并分支全量评测接受该条为已知红；不将其作为合并阻断项 | 全量评测永久 7/8；门禁无法全绿，T082/T084 不可关闭 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

**A**：A-08 是需求分支内的约束，合并分支不适用；REQ-001 继续以
`001-vben-frontend-replacement` 分支的报告
`REQ-20261101-001-20261107-123957.json`（8/8）作为验收证据。
该假设不会改动任何 `specs/` 文件，也不会把合并分支的 7/8 当作产品回归。
裁决前不据此关闭 T082/T084，也不修改 SPEC-001 或评测用例。

## PM 裁决

- 裁决人：aoyousky（PM）
- 裁决日期：2026-11-09
- 结论：**采纳 A**。A-08 仅在 REQ-001 自身交付分支
  `001-vben-frontend-replacement` 执行；合并分支 `005-home-workbench` 的全量评测
  将 A-08 标记为 N/A，不修改 `SPEC-001` 与 `cases.yaml`。
- REQ-001 的验收证据继续使用其需求分支报告
  `specs/evals/reports/REQ-20261101-001-20261107-123957.json`（8/8）。
- 升版：**否**。该裁决仅明确既有 A-08 的作用域，不改动断言语义。
