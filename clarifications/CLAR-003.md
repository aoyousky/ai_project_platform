# CLAR-003

- REQ: REQ-20261101-001
- TRIGGER: `scripts/ci-gate.sh` 门禁 3 ↔ `scripts/trace-schema.md` 规则 3
- STATUS: 已裁决 / 已回写门禁（待架构追认）
- RAISED_BY: agent
- DATE: 2026-11-02

## 歧义描述

门禁 3 要求 `trace/<id>.yaml` 的 `test_evidence.total > 0` 且 `passed == total`
（`scripts/ci-gate.sh` 门禁 3），而 `trace-schema.md` 规则 3 规定该证据只能来自
**真实执行** `specs/evals/run.py` 的结果。

本需求的 8 条 P0 断言（A-01 ~ A-08）落在 HTTP / DOM / 路由层，`run.py` 只支持 HTTP 用例，
且要求 P0 断言全覆盖。因此：

- 前端未实现 → 评测集无法全绿；
- 评测集不全绿 → 无法写出合法 trace；
- 无 trace → 门禁 3 FAIL → **任何一次提交都被拦截**。

即：新需求一旦进入实现期，在功能完成前无法提交任何中间进度；`/trace` 在 T054 才执行，
但门禁在每次 `git commit` 前都会跑。这是脚手架的门禁死锁，不是实现问题。

## 影响对比

| 选项 | 行为 | 影响 |
|---|---|---|
| A（已采纳） | 开发期豁免：`specs/evals/<id>/cases.yaml` 不存在时，允许 `test_evidence:` 留空且 `review_verdict: pending` 的 trace 通过门禁 | 实现期可增量提交；评测集一旦建立立即恢复严格校验；代价是门禁脚本被修改，需架构追认 |
| B | 不改门禁，全程不提交，T054 评测全绿后一次性提交 | 完全不改治理脚本；代价是失去增量历史，且 `git subtree add` 无法使用（它会自行提交），Vben 落点退化为手工导入 |
| C | 先写评测集并转绿再提交 | 不成立：P0 用例依赖未实现的前端，无法先绿 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

- 不修改门禁脚本，改为全程不提交（选项 B），并在 T054 一次性交付。

## PM 裁决

**2026-11-02 裁决：选项 A（开发期放行）。**

回写位置：

1. `scripts/ci-gate.sh` 门禁 3：新增分支——`specs/evals/<id>/cases.yaml` 不存在时，
   要求 `test_evidence:` 为空且 `review_verdict: pending` 才放行，输出 `PASS(开发期)`；
   存在评测集时仍执行原有严格校验（`total > 0` 且 `passed == total`）。
2. `scripts/trace-schema.md`「门禁校验点」：补记该豁免及其边界。

**边界（不得扩大解释）**：

- 豁免只让"实现进行中"的 trace 通过，**不等于完成**；`CLAUDE.md` 的 DoD 与
  "禁止在未运行评测集的情况下声称完成"不受影响。
- 一旦 `specs/evals/REQ-20261101-001/cases.yaml` 建立，该豁免自动失效，无需再改脚本。
- 若 trace 在无评测集时写了 `passed == total`，门禁仍 FAIL。

**待架构追认**：本次修改的是门禁脚本本身，按 CLAUDE.md「与 Spec Kit 共存规则」第 1 条，
需架构签字人（张建魁）确认该改动属于"开发期放行"而非"削弱门禁"。追认前本改动仅用于本分支推进。
