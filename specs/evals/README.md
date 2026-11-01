# 评测集（evals）

每个 Spec Packet 一个子目录：`specs/evals/<需求编号>/`，目录名必须与 Spec front-matter 的 `id` 完全一致。

## 目录结构

```
specs/evals/
├── run.py                 # 共享执行器（唯一实现，不随需求复制）
├── tests/                 # 执行器单元测试
│   └── test_run.py
└── <需求编号>/
    ├── cases.yaml         # 用例清单
    ├── schemas/           # 可选：JSON Schema，供 expect.schema 引用
    │   └── order_v2.json
    └── README.md          # 可选：本需求的测试说明
```

> 不再要求每个需求目录放 `run.py`/`run.sh`；共享执行器可避免用例脚本各自漂移。

## cases.yaml 格式

```yaml
spec_version: "1.0"          # 必须与 Spec Packet 的 version 一致
cases:
  - id: TC-001               # 用例唯一编号
    assertion: A-01          # 必须指向 Spec 中存在的 A-xx 或 E-xx
    input:
      method: GET            # 必填
      path: /api/v2/orders/ORD-10001   # 必填，相对 EVAL_BASE_URL
      query: {verbose: "1"}  # 可选
      headers: {X-Tenant: demo}        # 可选
      body: {amount: 100}    # 可选，自动按 JSON 发送
    expect:
      status: 200            # 期望 HTTP 状态码
      code: ORDER_NOT_FOUND  # 期望响应体顶层 code
      json: {data: {id: "ORD-10001"}}  # 响应体子集匹配
      schema: order_v2       # 引用 <需求编号>/schemas/order_v2.json
      max_latency_ms: 300    # P95 单次阈值
```

`expect` 至少包含一项；`schema` 支持 type / required / properties / items / enum 子集。

## 执行

```bash
# 1) 静态校验 + P0 覆盖检查（不联网，CI 必跑）
python specs/evals/run.py --check

# 2) 执行全部 HTTP 用例
EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py

# 3) CI 模式：静态校验通过后必须执行；未设置 EVAL_BASE_URL 且有用例时直接失败
EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py --ci

# 4) 执行并落盘证据，供 /trace 的 test_evidence 引用
EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py --ci \
  --report specs/evals/reports
```

退出码：全部通过 0；任一失败 1；静态校验失败 1。

## 硬规则

1. **P0 断言必须有对应用例**：`run.py --check` 会对比 Spec Packet 的 P0 A-xx 与 `cases.yaml`，缺一即 FAIL。
2. **用例只能引用 Spec 中存在的断言**：引用不存在的 A-xx/E-xx 直接 FAIL。
3. **P0 用例永久保留**：后续任何改动必须重跑；`--check` 与 `--ci` 都会执行历史用例。
4. **Spec 升版 → 用例同步升版**：`cases.yaml` 的 `spec_version` 必须与 Spec 一致。
5. **禁止伪造结果**：`test_evidence` 只能引用本执行器真实生成的报告；无用例时不得声称测试通过。
6. **服务不可达即失败**：网络错误、超时、非预期状态码都按用例失败处理。

## 门禁接入

`scripts/ci-gate.sh` 门禁 5 会调用 `python specs/evals/run.py --ci`：

- 有 Spec 用例但 `EVAL_BASE_URL` 未设置 → 门禁失败（无法证明测试通过）
- 无用例 → 通过并提示
- 用例失败或 P0 未覆盖 → 门禁失败

## 执行器自测

```bash
python -m unittest discover -s specs/evals/tests -v
```
