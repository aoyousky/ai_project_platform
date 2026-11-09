# REQ-20261107-005 评测说明

对应 Spec Packet：`specs/SPEC-004-system-auxiliary.md`（version **1.0**，已签字）。
覆盖 8 个视图（字典双栏、隐藏字典数据页、参数、公告、操作日志、登录日志、文件、隐藏文件配置）。
本目录用例覆盖 A-01～A-10 的 HTTP 可观测部分；UI 专属断言由 E2E 补充。

## 准备

1. 启动本地测试栈（`deploy/docker-compose.yml`）与前端生产预览：
   - 后端 `http://localhost:8080`
   - 前端 `http://localhost:5666`
     （`cd frontend && pnpm build && pnpm --filter @vben/web-antdv-next preview --port 5666`）
   - MinIO `http://localhost:9000`（桶 `aoyou` 由 compose 的 `minio-init` 创建；
     后端在容器内时 `sys_oss_config.endpoint` 为 `minio:9000`，在宿主机时为
     `127.0.0.1:9000`，`seed_spec004.sh` 会按运行方式自动选择，可用
     `EVAL_OSS_ENDPOINT` 覆盖）
2. 预置夹具（仅本地/CI 测试库，禁止指向生产库）：

   ```bash
   bash scripts/evals/seed_spec004.sh
   ```

   写入内容与 `EVAL_SPEC004_*` 变量一一对应：
   - 字典类型 `spec004_dict_type` 及 2 条字典数据；
   - 参数 `spec004.config.key`（`configType='N'`）；
   - 公告 `Spec004 公告`（含 `ql-align-center` / `ql-size-large` 历史类）；
   - 操作日志 `Spec004 操作`（`operName='spec004_operator'`，含合法 JSON 与普通文本两种参数）；
   - 登录日志 `spec004_lock`（`userName='spec004_lock'`）；
   - 受限账号 `spec004_limited`（仅字典菜单 + `system:dict:list`/`system:dict:query`）。

   脚本“先清后插”，可重复执行；不得删除内置配置 `ossConfigId=1/2` 或内置参数
   `sys.oss.previewListResource`。数据库凭据只从环境/容器读取，不打印。
   后端在 `awp-backend` 容器内时，脚本会重启该容器以刷新 OSS 配置缓存
   （endpoint 从 `127.0.0.1:9000` 切到 `minio:9000`）；宿主机后端不需要重启。

3. 上传夹具：`fixtures/spec004_upload.png` 与 `fixtures/spec004_upload.txt`（A-07 使用）。

## 执行

```bash
# 静态校验 + P0 覆盖（共享执行器）
python scripts/evals/run_eval.py --check

# 只跑本需求并落盘报告
python scripts/evals/run_eval.py --req REQ-20261107-005 --report specs/evals/reports
```

全部需求合并为**一次探针调用**：探针按 `auth` 类型各登录一次
（`admin` / `limited` / `menuAdmin` / `router` / `spec004Limited`），再复用同一组令牌跑完用例。
`/auth/code` 有 10 次/60s/IP 限流；不要按用例或按需求目录重复登录。

`spec004Limited` 是本需求新增的认证类型，默认账号/密码/令牌变量由
`scripts/evals/run_eval.py` 的 `build_env()` 提供（`EVAL_SPEC004_LIMITED_USER`、
`EVAL_SPEC004_LIMITED_PASSWORD`、`EVAL_SPEC004_LIMITED_TOKEN`），与 `seed_spec004.sh`
中的受限账号保持一致。提供 `EVAL_SPEC004_LIMITED_TOKEN` 时跳过该账号登录。

## 用例范围

| 断言 | HTTP 覆盖 | UI 补充 |
|---|---|---|
| A-01 | 字典类型/数据列表、CRUD、删除受保护类型 `code≠200` 且数据保留 | 双栏行数 2→3→3→2 |
| A-02 | `GET /system/dict/type/{dictId}` → 数据列表链路 | 隐藏页表头、修改后刷新可见 |
| A-03 | 参数列表/CRUD/内置删除拒绝/刷新缓存 | 筛选、导出、提示 |
| A-04 | 公告列表/CRUD | 富文本回显、状态同步 |
| A-05 | 操作日志列表/删除/导出 Content-Type | 详情 JSON 可读 |
| A-06 | 登录日志列表/解锁/删除/导出 | 单选解锁约束 |
| A-07 | multipart 上传 + 列表 + 下载 `Content-Disposition` | 空文件拦截、预览 |
| A-08 | 文件配置列表/CRUD/唯一默认/内置删除文案 | 敏感列不渲染 |
| A-09 | 受限账号 `GET` 成功、写接口 `code=403` | 按钮不进入 DOM |
| A-10 | `GET /system/menu/getRouters` 含 8 个菜单 | 8 地址无占位页 |

A-11～A-18 的 UI/交互断言由 `frontend/tests/e2e/` 覆盖，评测用例仍保留 `assertion`
以满足 P0 覆盖检查。

## 安全约束

- 令牌只在内存中使用：登录响应体取出 `access_token` 后直接注入
  `Authorization` / `clientid`，不写文件、不写日志、不进入报告。
- 报告只记录状态码、`code`、`msg` 摘要与耗时；不记录请求头、令牌、验证码、密码、
  `secretKey`。
- `http_probe.mjs` 不得打印 multipart 文件路径或文件内容。
- E2E 失败截图/追踪只保存在本地 `test-results/`，不提交、不上传。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EVAL_BASE_URL` | `http://localhost:8080` | 后端地址 |
| `EVAL_FRONTEND_URL` | `http://localhost:5666` | 前端预览地址 |
| `EVAL_ADMIN_USER` / `EVAL_ADMIN_PASSWORD` | 见 `run_eval.py` | 管理员 |
| `EVAL_LIMITED_USER` / `EVAL_LIMITED_PASSWORD` | 见 `run_eval.py` | 无权限账号 |
| `EVAL_SPEC004_LIMITED_USER` / `_PASSWORD` / `_TOKEN` | 见 `run_eval.py` / 空 | 本需求受限账号；提供令牌后跳过登录 |
| `EVAL_SPEC004_*_ID` / `_NAME` | 见 `run_eval.py` 的 `build_env()` | 夹具 ID/名称，与 `seed_spec004.sh` 保持一致 |
| `EVAL_REDIS_CONTAINER` / `EVAL_REDIS_PASSWORD` | 见 `run_eval.py` | 读取一次性图形验证码明文 |
| `EVAL_BACKEND_CONTAINER` | `awp-backend` | 判断后端运行方式；容器内后端 seed 后会重启以刷新 OSS 缓存 |
| `EVAL_OSS_ENDPOINT` | 自动判断 | 覆盖 `sys_oss_config.endpoint`；容器内后端用 `minio:9000`，宿主机用 `127.0.0.1:9000` |
| `EVAL_SKIP_SEED` | 空 | 设为 `1` 时跳过门禁 5 的自动预置 |

## 退出码

- 全部通过：`0`
- 任一用例失败或静态校验失败：`1`
- 服务不可达、超时、非预期状态码均按失败处理。
