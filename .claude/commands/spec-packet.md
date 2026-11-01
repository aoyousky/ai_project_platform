---
description: 衔接层：把 spec-kit 的 spec.md 断言化为可交付的 Spec Packet
allowed-tools: Read, Grep, Glob, Write, Edit
---

把 Spec Kit 产出的自然语言规格，转换成可被 AI 直达交付的 Spec Packet。这是两套体系唯一的合法接口，没有这一转换，`spec.md` 不得进入实现阶段。

## 输入
`$ARGUMENTS` 指定的特性目录（如 `specs/003-user-auth`）。未指定时，若当前分支对应某特性目录则使用之，否则列出 `specs/*/spec.md` 让用户选择。

## 执行步骤

1. 读取该目录下 `spec.md` 与 `plan.md`（若存在）；读取 `.specify/memory/constitution.md` 中的技术原则作为约束参考。

2. **逐条断言化**：把 spec.md 中的功能需求（FR-xxx）、用户故事验收场景逐条改写为断言：

| 原条目 | 断言编号 | Given | When | Then |
|---|---|---|---|---|
| FR-001 | A-01 | | | |
| US1-AC1 | A-02 | | | |

   硬规则：
   - 每条 Then 必须是四类之一：状态码 / 返回值或 schema 断言 / 数值阈值 / 明确的错误码
   - 原条目无法转成可判定 Then 的，**不得臆造**，列入 UNVERIFIABLE 清单（第 6 步）
   - 保留 `[来源: FR-001]` 反向引用，便于 /speckit-analyze 回溯

3. **补齐 spec-kit 没有的四段**（缺一不可）：
   - 边界与异常 E-xx：条数 ≥ 断言条数
   - 数据契约：字段、类型、可空、空值语义、时区、精度
   - Non-goals：从 spec.md 的 Out of Scope 提取，若原文没有则向用户确认
   - Golden Samples：3 正例 + 1 反例

4. **风险分级**：按影响面判定 L0–L3 并给出理由；L2/L3 标记需架构签字。

5. **写入** `specs/SPEC-<NNN>-<feature>.md`：按 `specs/SPEC-TEMPLATE.md` 的九段式结构，front-matter 增加一行：
   ```yaml
   speckit_feature: specs/003-user-auth
   ```

6. 输出三张清单给用户：
   - FR → A-xx 映射表（含未映射项）
   - **UNVERIFIABLE 清单**：无法判定化的条目 + 原因 + 建议问 PM 的问题（同时按 /clarify 格式写入 `clarifications/`）
   - 新增的 E-xx 与 Non-goals 清单（这些是 spec.md 里原本没有、由断言化补出来的）

7. 明确告知：`spec.md` 仍是意图来源，但**交付与验收的唯一依据是 Spec Packet**；两者冲突时以 Spec Packet 为准并升版。
