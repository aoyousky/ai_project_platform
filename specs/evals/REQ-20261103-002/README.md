# REQ-20261103-002 评测说明

对应 Spec Packet：`specs/SPEC-002-system-management-core.md`（version 1.2）。

## 准备

1. 启动本地测试栈（`deploy/docker-compose.yml`）与前端登录页（E2E 同款生产预览）：
   - 后端 `http://localhost:8080`
   - 前端 `http://localhost:5666`（`pnpm build && pnpm --filter @vben/web-antdv-next preview --port 5666`；
     预览服务器在 `vite.config.ts` 里把 `/prod-api` 代理到 8080）
2. 预置夹具（仅本地/CI 测试库，禁止指向生产库）。**每次执行评测前都要重跑**——
   A-04 会删除 `spec002_delete`，A-02 会新增随机用户名：

   ```bash
   bash scripts/evals/seed_spec002.sh
   ```

   写入：部门 `D`（`900000000000000001`）、用户 `spec002_user`（`...002`）、
   无权限用户 `spec002_limited`（`...003`，仅绑定无菜单角色）、可删除用户
   `spec002_delete`（`...004`）、角色 `R`（`...006`）。

## 执行

```bash
# 静态校验 + P0 覆盖（共享执行器）
python specs/evals/run.py --check

# 等价夹具：注入认证头 + ${EVAL_*} 占位替换，并执行 HTTP
python scripts/evals/run_eval.py --report specs/evals/reports
```

`run_eval.py` 不修改 `specs/evals/run.py`：静态校验仍调用共享执行器，执行阶段由
`scripts/evals/http_probe.mjs` 走真实登录页取得令牌，且只在内存中注入
`Authorization: Bearer` 与 `clientid`。令牌不会写入文件、日志或报告。

> **门禁 5 说明**：`specs/evals/run.py` 不支持认证头与 `${EVAL_*}` 占位替换（SPEC-002 §5
> 已记录）。经 2026-11-04 裁决（Spec v1.2），`scripts/ci-gate.sh` 在检测到
> `scripts/evals/run_eval.py` 时改调该等价夹具；执行前需先跑 `seed_spec002.sh`。
> 新增需求若有认证用例，需要先把新需求接入该夹具，否则门禁 5 会回落到 `run.py --ci`。

> 后端对 `/auth/code` 有限流（10 次/窗口）。连续跑多轮 E2E/评测时若出现
> “访问过于频繁，请稍候再试”，等待限流窗口后再执行。

可选环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EVAL_BASE_URL` | `http://localhost:8080` | 后端地址 |
| `EVAL_FRONTEND_URL` | `http://localhost:5666` | 登录页地址 |
| `EVAL_TOKEN` | 空 | 提供后跳过管理员登录 |
| `EVAL_NOACCESS_TOKEN` | 空 | 提供后跳过无权限账号登录 |
| `EVAL_ADMIN_USER` / `EVAL_ADMIN_PASSWORD` | `admin` / `admin123` | 管理员账号 |
| `EVAL_LIMITED_USER` / `EVAL_LIMITED_PASSWORD` | `spec002_limited` / `admin123` | 无权限账号 |
| `EVAL_REDIS_CONTAINER` / `EVAL_REDIS_PASSWORD` | `awp-redis` / `aoyou123` | 读取一次性图形验证码明文 |

## 已裁决事实（Spec v1.1）

| 断言 | 事实 | 澄清单 |
|---|---|---|
| A-05 | `authRole(userId=1)` 返回 200 且 no-op；A-05 只覆盖删除/启停/重置密码 | `clarifications/CLAR-005.md`（对应 E-22） |
| A-03 | 后端 `userName` 为 `@NotBlank`；编辑提交原 `userName`（只读） | `clarifications/CLAR-006.md` |
| A-06 / E-21 | 空 `roleIds` 返回 200 且 no-op，不清空现有角色 | `clarifications/CLAR-007.md` |

上述裁决已回写 Spec Packet v1.1，`cases.yaml` 的 `spec_version` 与之保持一致。

> `specs/evals/run.py` 只解析断言表的 A-xx 行（E-xx 表无优先级列），因此用例只引用
> A-xx：E-21 / E-22 的后端 no-op 事实作为 `TC-A06-GRANT` 的附加 verify 步骤执行。
