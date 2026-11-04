# REQ-20261104-003 评测说明

对应 Spec Packet：`specs/SPEC-003-role-menu-dept-post.md`（version **1.1**）。

## 准备

1. 启动本地测试栈（`deploy/docker-compose.yml`）与前端登录页（E2E 同款生产预览）：
   - 后端 `http://localhost:8080`
   - 前端 `http://localhost:5666`（`pnpm build && pnpm --filter @vben/web-antdv-next preview --port 5666`）
2. 预置夹具（仅本地/CI 测试库，禁止指向生产库）：

   ```bash
   bash scripts/evals/seed_spec003.sh
   # REQ-002 的用例同批执行，需一并预置
   bash scripts/evals/seed_spec002.sh
   ```

   写入：部门树 `Spec003 部门`（`900003000000000001`）及其子部门/含用户/含岗位/空部门
   （`...002`~`...005`）、角色 `Spec003 角色`（`...006`）、已分配角色（`...007`）、
   仅菜单权限码角色（`...010`）、用户 `spec003_user`（`...011`）与 `spec003_menu_admin`
   （`...012`）、岗位 `spec003_post_ref`（`...013`）、菜单目录/子菜单/按钮（`...014`~`...016`）。
3. `seed_*.sh` 都是“先清后插”，可重复执行；`scripts/ci-gate.sh` 门禁 5 会自动调用它们
   （`EVAL_SKIP_SEED=1` 可跳过）。

## 执行

```bash
# 静态校验 + P0 覆盖（共享执行器）
python scripts/evals/run_eval.py --check

# 只跑本需求
python scripts/evals/run_eval.py --req REQ-20261104-003 --report specs/evals/reports

# 全部需求（门禁 5 的等价命令）
python scripts/evals/run_eval.py --report specs/evals/reports
```

全部需求合并为**一次探针调用**：探针按 `auth` 类型各登录一次（`admin` / `limited` /
`menuAdmin`），再复用同一组令牌跑完所有用例。不要按需求目录分多次调用——`/auth/code`
有 10 次/60s/IP 限流，重复登录会拿不到验证码。

令牌只在内存中使用：登录响应体取出 `access_token` 后直接注入 `Authorization` /
`clientid`，不写文件、不写日志、不出现在报告里。

## 已裁决事实

| 断言 | 事实 | 澄清单 |
|---|---|---|
| A-03 | 保存时 `menuCheckStrictly` 用 `false`（父子联动）；`true`（父子不联动）时后端会从 `checkedKeys` 剔除已分配菜单的父节点 | `clarifications/CLAR-008.md`（Spec 升版 v1.1） |
| A-05 | `authUser` 链路上同一请求参数 5s 内重复提交会被 `@RepeatSubmit` 拦截，用例用 `{ wait: 5500 }` 跨过窗口 | 用例内注释 |
| A-09 | 非 superadmin/租户管理员调用菜单接口 → HTTP 200 + `code=403` + `msg='没有访问权限，请联系管理员授权'` | SPEC-003 A-09 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EVAL_BASE_URL` | `http://localhost:8080` | 后端地址 |
| `EVAL_FRONTEND_URL` | `http://localhost:5666` | 登录页地址 |
| `EVAL_TOKEN` / `EVAL_NOACCESS_TOKEN` / `EVAL_SPEC003_MENU_ADMIN_TOKEN` | 空 | 提供后跳过对应账号登录 |
| `EVAL_ADMIN_USER` / `EVAL_ADMIN_PASSWORD` | `admin` / `admin123` | 管理员 |
| `EVAL_LIMITED_USER` / `EVAL_LIMITED_PASSWORD` | `spec002_limited` / `admin123` | 无权限账号 |
| `EVAL_SPEC003_MENU_ADMIN_USER` / `_PASSWORD` | `spec003_menu_admin` / `admin123` | 仅菜单权限码账号 |
| `EVAL_SPEC003_*_ID` / `_NAME` | 见 `scripts/evals/run_eval.py` 的 `build_env` | 夹具 ID/名称，与 `seed_spec003.sh` 保持一致 |
| `EVAL_REDIS_CONTAINER` / `EVAL_REDIS_PASSWORD` | `awp-redis` / `aoyou123` | 读取一次性图形验证码明文 |
