---
description: Dev 评审门禁：12 项 checklist 逐项检查当前改动
allowed-tools: Read, Grep, Glob, Bash
---

对本会话中的代码改动（未指定 `$ARGUMENTS` 时用 `git diff` 范围）执行 12 项评审 checklist。逐项输出：通过 / 不通过（附证据 file:line）/ 无法判定（标注缺哪份依据）。

1. 契约一致：字段名、类型、空值语义、时区、数值精度与 Spec 的 Data Contract 完全一致
2. 断言可追溯：每条 P0 A-xx 能指到实现位置 file:line
3. 边界完整：每条 E-xx 有对应处理分支
4. 错误码与 Spec 一致；无吞异常、无自创错误结构
5. 安全：无硬编码密钥/URL；鉴权符合 Spec；外部输入有校验防注入
6. 依赖全部在 `specs/constraints/allowlist.md` 白名单内
7. 技术债闸门：圈复杂度 ≤ 15（constitution VIII）、重复率 ≤ 5%（可用工具估算，无法精确时标注）
8. 并发与幂等：按相关断言实现，重放安全
9. 可观测：Spec 声明的日志/trace 字段都已输出
10. 无越界：diff 不包含任何 Spec 的 Non-goals 内容
11. 性能：按 Spec 压测口径核对（无实测条件时明确标注"未实测"）
12. 评测集：`specs/evals/` 全部通过；开发中新发现的用例已回写评测集（说明回写了哪些）

结论只能是：`全部通过` 或 `N 项不通过 + 修复清单`。禁止输出"整体良好"。
