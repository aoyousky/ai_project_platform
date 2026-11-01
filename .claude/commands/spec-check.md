---
description: 规格门禁：校验 Spec Packet 完整性，输出 PASS/FAIL
allowed-tools: Read, Grep, Glob
---

对 `$ARGUMENTS` 指定的 `specs/SPEC-*.md`（未指定则校验全部）执行规格门禁，逐项输出 PASS/FAIL 表格：

1. YAML front-matter 必填字段齐全：id / title / version / risk_level / channel / pm / business_signoff（L2、L3 还需 arch_reviewer）
2. 每条 A-xx 断言：Given / When / Then 完整，且 Then 只属于四类之一——状态码、返回值或 schema 断言、数值阈值、错误码
3. P0 断言数量 ≤ 12，否则建议拆分
4. E-xx 条数 ≥ A-xx 条数
5. Non-goals 非空
6. 禁词扫描（区分正文与表格）：`另行确认`、`后续讨论`、`适当`、`大概`、`尽快`、`视情况`
7. Golden Samples 恰好 3 正例 + 1 反例，反例的期望输出非空
8. 数据契约表中每个字段都声明了"可空"与"空值语义/说明"
9. **Spec Kit 关联（若 front-matter 有 `speckit_feature`）**：该目录下 `spec.md` 存在；`plan.md`、`tasks.md` 若已存在则记录其存在状态；Spec Packet 的 `version` 不早于该 spec.md 的最近修改时间
10. **来源覆盖**：spec.md 中的每条 FR-xxx 都能在断言表里找到 `[来源: FR-xxx]` 反查记录，或有对应的 UNVERIFIABLE 记录

规则：任一 FAIL，输出具体行号和修改建议；最终结论只能是 `PASS` 或 `FAIL`，不得输出"基本通过"这类模糊结论。
