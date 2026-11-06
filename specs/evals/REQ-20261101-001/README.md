# REQ-20261101-001 评测说明

对应 Spec Packet：`specs/SPEC-001-vben-frontend-replacement.md`（version **1.2**，v1.2 按
CLAR-010 裁决把 A-04 的按钮文案更正为「删除（工具栏批量删除）」）。

P0 覆盖：A-01 ~ A-08（8/8）。P1/P2 断言（A-09 ~ A-16）本期不进评测集。

## 证据面

| 断言 | HTTP 面 | E2E / 单测面 |
|---|---|---|
| A-01 | —（登录体为 AES 密文 + 一次性验证码，探针无法重放） | `tests/e2e/login.spec.ts`：`登录成功后落到 /index（A-01）`（校验 `code=200`、`access_token` 非空、提交后 5s 内到 `/index`） |
| A-02 | — | 同上文件：`验证码错误：展示后端 msg、刷新验证码、保留用户名（A-02、E-01）` |
| A-03 | `GET /system/menu/getRouters` → `code=200` | `spec001-assertions.spec.ts` 侧栏多重集匹配；`menu.test.ts` 的 48 节点/无重名/noRedirect 单测 |
| A-04 | — | `spec001-assertions.spec.ts`：`A-04 admin 在岗位页可见新增与删除` |
| A-05 | —（需要专用账号，见下） | 同上文件：`A-05 ...` |
| A-06 | — | 同上文件：`A-06 ...`（分页器切到 `pageSize=10` 后断言行数 = `min(total,10)`） |
| A-07 | 新增 → 列表可见 → 改名 → 删除 → 列表为空的 total 链路 | `system-post.spec.ts`：`...（A-07）`（勾选行 → 工具栏「删除」批量删除） |
| A-08 | — | `git diff --stat main...HEAD -- platform/` 输出为空 |

`probe: false` 的用例只有 E2E 面：A-01/A-02 的登录请求含 AES 密文与一次性验证码，
探针重放会失真；A-04~A-06 是纯 DOM 行为。执行器按 `e2e.grep` 只跑标题命中的用例，
避免把 `/auth/code` 的 10 次/60s/IP 限流预算花在无关用例上。

## 准备

1. 本地栈：后端 `http://localhost:8080`，前端生产预览 `http://localhost:5666`
   （E2E 同款：`pnpm build && pnpm --filter @vben/web-antdv-next preview --port 5666`）。
2. 夹具：

   ```bash
   bash scripts/evals/seed_spec001.sh
   ```

   写入角色 `spec001_postonly_role`（`900001000000000001`）与账号 `spec001_postonly`
   （`900001000000000002`），只授予 系统管理 / 岗位管理 / 岗位查询，用于 A-05
   「能进岗位页但看不到新增，且进不了菜单页」。脚本先清后插，可重复执行；
   `scripts/ci-gate.sh` 门禁 5 会自动调用（`EVAL_SKIP_SEED=1` 可跳过）。

## 执行

```bash
# 静态校验 + P0 覆盖
python scripts/evals/run_eval.py --check

# 只跑本需求（E2E 需先 build + preview）
python scripts/evals/run_eval.py --req REQ-20261101-001 --report specs/evals/reports

# 定位单条
python scripts/evals/run_eval.py --req REQ-20261101-001 --only TC-A05
```

A-07 用 `${EVAL_RUN_ID}` 生成唯一岗位编码；用例末尾会删除该岗位。若上次运行中断
留下同名编码，按 `postCode = 'spec001_a07_%'` 手工清理后再跑。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EVAL_BASE_URL` | `http://localhost:8080` | 后端地址 |
| `EVAL_FRONTEND_URL` | `http://localhost:5666` | 登录页地址 |
| `EVAL_SPEC001_POSTONLY_USER` / `_PASSWORD` | `spec001_postonly` / `admin123` | A-05 账号 |
| `EVAL_E2E_TIMEOUT` | `1800` | 单次 Playwright 调用预算（秒） |
| `EVAL_RUN_ID` | 当前 UTC 秒级时间戳 | A-07 唯一后缀 |

## 已知取舍

- A-05 的「落 403 或 404 页面」：未授权路由在前端未注册，Vben 渲染兜底未找到页
  （文案「哎呀！未找到页面」，URL 不含 403/404）。用例按「渲染 not-found 组件且不渲染
  业务表格」判定，与 SPEC 的「渲染 forbidden 组件」等价；已在用例内注释。
- A-03 的侧栏计数：侧栏始终包含前端常量菜单（概览/演示/项目），且 Vben 全量渲染、
  折叠只影响可见性；故按「后端非 hidden 标题多重集全部出现在侧栏」断言，而非比较
  DOM 节点总数。
