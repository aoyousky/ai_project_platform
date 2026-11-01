---
description: 溯源记录：为本次交付生成/更新 trace/<需求编号>.yaml
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

为 `$ARGUMENTS` 指定的需求（未指定则推断本会话正在交付的 Spec）生成或更新 `trace/<需求编号>.yaml`。

**字段定义以项目根目录的 `scripts/trace-schema.md` 为唯一来源**，不得自行增删字段。模板：

```yaml
generation_id: gen-<YYYYMMDD-HHMMSS>
requirement_id: <与 Spec front-matter id 一致>
spec_version: "1.0"
spec_hash: <真实 sha256 前 12 位>
constraint_version: <constraints.md 版本或 hash>
allowlist_hash: <allowlist.md 真实 sha256 前 12 位>
model: <本次会话使用的模型>
prompt_version: claudemd-v1
generated_at: <ISO8601>
speckit:
  feature_dir: specs/003-user-auth
  plan_hash: <sha256 前 12 位 或 null>
  tasks_hash: <sha256 前 12 位 或 null>
clarification_refs: [CLAR-001]
reviewer: <人审人，未评审则 pending>
review_verdict: <pass / "rejected: 原因" / pending>
diff_scope:                            # git diff --name-only 的真实结果
  - src/orders/GetOrder.java
assertion_map:                         # 每条 P0 断言 → 实现位置
  A-01: src/orders/GetOrder.java#L42
  A-02: src/orders/OrderErrors.java#L8
test_evidence:                         # 必须来自真实执行 specs/evals/run.py
  executed_at: <ISO8601>
  base_url: <被测服务地址>
  total: 18
  passed: 18
  report: specs/evals/reports/<需求编号>.json
  p0_coverage: 12/12
history: []
```

规则：
1. assertion_map 必须覆盖该 Spec 的全部 P0 断言；映射不出来时如实标注 `UNMAPPED` 并说明，不得编造行号
2. spec_hash / allowlist_hash / plan_hash / tasks_hash 必须真实计算，不得占位
3. test_evidence 只能在真实跑完评测集后填写；未执行时不得声称通过
4. 更新已有文件时保留 history 追加，不覆盖旧记录
5. 完成后在回复中输出文件路径、断言覆盖统计（如 4/4）和评测通过数（如 18/18）
