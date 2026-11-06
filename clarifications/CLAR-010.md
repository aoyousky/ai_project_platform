# CLAR-010

- REQ: REQ-20261101-001
- TRIGGER: A-04
- STATUS: 已裁决 / 已回写 Spec（SPEC-001 v1.2）
- RAISED_BY: agent
- DATE: 2026-11-06

## 歧义描述

SPEC-001 A-04 的 Then 要求：打开 `/system/post` 后，DOM 中同时存在**文案为「新增」与「批量删除」**的按钮。

实际实现（[post/index.vue:255-270](../../frontend/apps/web-antdv-next/src/views/system/post/index.vue#L255-L270)）
工具栏第二个按钮文案为 **「删除」**，其权限码是 `system:post:remove`，点击后对勾选行执行批量删除。
全仓检索「批量删除」仅命中 API 注释（`post/index.ts:51`、`role/index.ts:76`、`user/index.ts:88`），
**没有任何 UI 文案**。

即：断言的字面文案与已交付实现不一致，评测无法在当前实现上原样通过。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 改实现：工具栏按钮文案「删除」→「批量删除」（role/user/dept 等同构页面是否同步需一并裁决） | A-04 可原样通过；属产品代码改动，且 `system-permissions.spec.ts`/`system-post.spec.ts` 按「删除」定位按钮，需同步 |
| B | 升版 Spec：A-04 的 Then 改为「文案为『新增』与『删除』（工具栏批量删除）的按钮」 | 断言与实现一致；需 PM 签字升版 SPEC-001（v1.1 → v1.2） |
| C | 评测按权限码/位置匹配（工具栏中 `v-access:code=['system:post:remove']` 的按钮），不校验文案 | 断言被削弱，偏离签字文本，且无法再约束文案回归 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

倾向 B（升版 Spec）：不改产品源码、不改 E2E 既有定位、成本最低；但升版须 PM 签字，
故不擅自采用，也不据此继续写 A-04 的评测用例。

## PM 裁决

**2026-11-06 裁决：选项 B（升版 Spec）。**

- 依据：上游 plus-ui（`git show 0534d3d^:frontend/src/views/system/post/index.vue`）工具栏文案即为
  「新增 / 删除 / 导出」，当前实现与参考实现一致；SPEC-001 A-04 的"批量删除"是断言化时的措辞偏差。
- 回写：`specs/SPEC-001-vben-frontend-replacement.md` v1.1 → v1.2，A-04 的 Then 改为
  「DOM 中同时存在文案为"新增"与"删除"（工具栏批量删除）的按钮」；断言语义不变。
- 追溯：`spec_hash` 由 `73ab85451acf` 变为 `2946c1efca03`，`trace/REQ-20261101-001.yaml` 已同步；
  `review_verdict` 仍为 `pending`（评测集尚未建立）。
- 签字：PM：aoyousky（2026-11-06）；架构追认：待张建魁确认（L2 升版）。
- 影响：A-07 的"勾选并批量删除"是行为描述，不涉及文案，无需改动；产品代码零改动。
