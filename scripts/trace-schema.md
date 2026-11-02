# trace schema（溯源记录规范）

> 本文件是 `trace/<需求编号>.yaml` 的**唯一字段定义**。`/trace` 命令与 `scripts/ci-gate.sh` 均以本文件为准。
> 规则来源：CLAUDE.md 铁律 3（溯源强制）与 DoD。

## 文件命名

`trace/<需求编号>.yaml`，需求编号必须与 Spec Packet front-matter 的 `id` 完全一致。

## 字段定义

```yaml
generation_id: gen-<YYYYMMDD-HHMMSS>      # 必填；同一需求多次生成时追加 history
requirement_id: REQ-20261030-001          # 必填；与 Spec front-matter id 一致
spec_version: "1.0"                       # 必填；与 Spec front-matter version 一致
spec_hash: <sha256 前 12 位>              # 必填；对 SPEC 文件内容真实计算，禁止占位
constraint_version: <constraints.md 版本或 hash>   # 必填
allowlist_hash: <sha256 前 12 位>         # 必填；对 allowlist.md 内容计算
model: <本次会话使用的模型>                # 必填
prompt_version: claudemd-v1               # 必填；CLAUDE.md 有实质修改时升版
generated_at: <ISO8601>                   # 必填

speckit:                                  # Spec Kit 特性存在时必填，否则 null
  feature_dir: specs/003-user-auth
  plan_hash: <sha256 前 12 位>            # plan.md 不存在时为 null
  tasks_hash: <sha256 前 12 位>           # tasks.md 不存在时为 null

clarification_refs: [CLAR-001]            # 无则空列表
reviewer: <人审人，未评审则 pending>        # 必填
review_verdict: <pass / "rejected: 原因" / pending>   # 必填

diff_scope:                               # 必填；git diff --name-only 的真实结果
  - src/orders/GetOrder.java

assertion_map:                            # 必填；每条 P0 断言 → 实现位置
  A-01: src/orders/GetOrder.java#L42
  A-02: src/orders/OrderErrors.java#L8

test_evidence:                            # 必填；评测执行证据（见 specs/evals/run.py）
  executed_at: <ISO8601>
  base_url: <被测服务地址>
  total: 18
  passed: 18
  report: specs/evals/reports/REQ-20261030-001.json
  p0_coverage: 12/12

history: []                               # 追加式；不得覆盖旧记录
```

## 硬规则

1. `spec_hash`、`allowlist_hash`、`plan_hash`、`tasks_hash` 必须真实计算，不得写占位符。
2. `assertion_map` 必须覆盖该 Spec 的**全部 P0 断言**；映射不出来的写 `UNMAPPED:` 并说明原因，禁止编造行号。
3. `test_evidence` 只能来自真实执行 `specs/evals/run.py` 的结果，`report` 指向实际生成的 JSON；未执行时不得写 `passed == total`。
4. `diff_scope` 必须来自 `git diff --name-only`；非 git 环境视为无法交付。
5. 更新已有文件时追加 `history`，不覆盖旧记录。
6. `requirement_id`、`spec_version` 必须与 Spec Packet 完全一致，`/trace` 与 `ci-gate.sh` 会交叉校验。

## 门禁校验点（ci-gate.sh 门禁 3）

- `trace/<id>.yaml` 存在
- 顶层含 `spec_hash` 与 `assertion_map`
- 不含 `UNMAPPED`（P0 断言必须全部映射）
- `test_evidence.passed == test_evidence.total` 且 `total > 0`（无评测用例时不得声称完成）
- **开发期豁免（CLAR-003）**：当 `specs/evals/<requirement_id>/cases.yaml` 不存在时，允许
  `test_evidence:` 留空且 `review_verdict: pending` 的 trace 通过门禁——此时该 trace 只表示
  "实现进行中"，不得据此报告完成。评测集一旦建立，门禁即恢复严格校验。
