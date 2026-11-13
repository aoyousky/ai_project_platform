# REQ-20261112-008 UAT 与执行证据

- 需求：REQ-20261112-008（系统监控原生视图：Admin 监控 / 任务调度中心最小可用集）
- Spec：`specs/SPEC-008-admin-snailjob-native.md` v1.0（pm aoyousky / 业务 Jim Liu / 架构 jiankui zhang，2026-11-12 签字）
- 交付分支：`008-admin-snailjob-native`
- 执行日期：2026-11-12
- 数据来源：前端直连同源官方控制台 REST API（Spring Boot Admin 3.5.8 `/admin`、SnailJob 1.10.0 `/snail-job`），未改 `platform/`

## 环境

| 项 | 值 |
|---|---|
| 本地 Docker 栈 | `docker compose -f deploy/docker-compose.yml`（MySQL 3307 / Redis 6379 / backend 8080 / frontend 80） |
| 前端镜像 | `awp/frontend:local` 由本需求最终 `apps/web-antdv-next/dist` 重新构建（`docker compose build frontend` + `up -d --no-deps frontend`） |
| 生产预览 | `pnpm --filter @vben/web-antdv-next preview --port 5666`（预览服务由门禁重新拉起） |
| SBA | `http://localhost/admin/applications` → 未登录返回 `401`（同源反代生效） |
| SnailJob | `http://localhost/snail-job` → `200`（同源反代生效） |
| 夹具 | `bash scripts/evals/seed_spec007.sh`（`spec007_online` / `spec007_limited` 账号与权限） |

## 执行记录

以下均为本机真实运行结果（2026-11-12，最终代码/构建）。日志受 `.gitignore` 的
`*.log` 规则忽略，未入库；关键结果已在本节与 `review-12-items.md` 中复述。

| 时间 | 项目 | 命令 | 结果 |
|---|---|---|---|
| 13:40–13:45 | 单测 RED→GREEN | `pnpm exec vitest run admin-page-logic.test.ts` / `snailjob-page-logic.test.ts` | 先写用例、实现前 `Failed to resolve import`（RED）；实现后 6 + 4 用例通过 |
| 16:25 | SPEC-007 A-08/E-17 定向复跑 | `pnpm exec playwright test spec007-assertions.spec.ts -g "A-08\|E-17"`（3 轮） | **6/6 通过**（`spec007-retry-check.log`） |
| 16:28–16:58 | SPEC-007 全量回归 | `pnpm exec playwright test tests/e2e/spec007-assertions.spec.ts --reporter=line` | **28/28 通过**（30.3m，含 A-08/E-17；`spec007-regression.log`） |
| 17:24 | 单测 + 覆盖率 | `pnpm test:coverage` | **88 文件 / 687 用例通过**；lines 89.73% / branches 77.25% / functions 91.2% / statements 89.69%（阈值 70%；`unit-coverage.log`） |
| 17:39 / 19:15 | 评测（首跑 + 最终代码复跑） | `python scripts/evals/run_eval.py --req REQ-20261112-008 --report specs/evals/reports` | **11/11 通过**；报告 `REQ-20261112-008-20261112-173925.json`、`REQ-20261112-008-20261112-191531.json`（`eval-req008.log`） |
| 18:28 | 类型检查 | `pnpm check:type` | 11 tasks successful，exit 0（`typecheck.log`） |
| 18:41–18:58 | SPEC-008 全量 E2E（最终代码） | `pnpm exec playwright test tests/e2e/spec008-assertions.spec.ts --reporter=line` | **21/21 通过**（17.3m，`spec008-regression.log`） |
| 18:35 | 本需求文件格式/lint | `pnpm exec oxfmt --check` / `eslint` / `oxlint`（12 个文件） | 均 exit 0 |
| 19:2x | 规格门禁 `/spec-check` | 对照 SPEC-008 v1.0 10 项 | **PASS**（2 项 N/A：无 `speckit_feature`、无 spec.md/FR-xxx） |
| 23:12–23:31 | 门禁 `ci-gate.sh`（改造后，单需求范围） | `bash scripts/ci-gate.sh` | **5/5 PASS，EXIT=0**；门禁 5 仅评测 REQ-20261112-008，**11/11**（报告 `REQ-20261112-008-20261112-233138.json`） |
| 07:23–08:50 | 门禁复跑（宿主休眠恢复后） | `bash scripts/ci-gate.sh` | 首轮 5/11（旧会话残留 + 宿主挂起）；复测登录成功后复跑 **11/11 PASS，EXIT=0**（报告 `REQ-20261112-008-20261113-085022.json`） |
| 22:32–22:50 | 门禁复跑（交付前运行核验后） | `bash scripts/ci-gate.sh` | **5/5 PASS，EXIT=0**；门禁 5 仅评测本次交付需求，**11/11**（报告 `REQ-20261112-008-20261113-225049.json`） |

### 门禁 5 范围优化（2026-11-12）

**动机**：本轮改造前，门禁 5 串行跑全部 7 个需求，单轮 40–60 分钟；四次全量尝试中，
失败点均落在**其他需求**的浏览器取令牌/登录准备阶段，且与本需求实现无关：

| 全量尝试 | 结果 | 失败点 |
|---|---|---|
| 第 1 轮 | EXIT=1 | REQ-20261111-007 TC-A01/A04 页面响应超时；该需求 `--only TC-A01,TC-A04` 定向复跑 **2/2 通过** |
| 第 2 轮 | EXIT=1 | REQ-20261103-002 A-01/A02 取 admin 令牌超时（`/auth/login` 30s）、验证码失效；同轮 REQ-007 10/10、REQ-008 11/11 |
| 第 3 轮 | 停止（超时风险） | REQ-002 A-01/A02 `登录页未返回验证码 uuid`；随后 TC-A03～A11 正常通过，属启动期瞬时波动 |
| 第 4 轮（全量） | 改造后停止 | REQ-002 **16/16**、REQ-003 **13/13**、REQ-007 **10/10** 已通过；收到“门禁 5 只跑当前需求”指示后停止剩余需求 |

受控排查：按门禁同样顺序（后端重启 → 等就绪 → 重建 5666 预览）立即用评测探针走真实
登录页，两次均在 10s/16s 内成功，未复现 uuid 缺失；未发现本需求代码缺陷。

**改造内容**（`scripts/ci-gate.sh` 门禁 5）：

- 默认按当前分支号 `NNN` 匹配 `specs/evals/REQ-*-NNN`，只评测该需求；
- `CI_GATE_REQ=REQ-xxx` 可显式指定单个需求；
- 全量回归改为上线前**人工**触发：`CI_GATE_FULL_EVAL=1 bash scripts/ci-gate.sh`；
- 分支无法推断且未显式指定时直接 FAIL，不静默跑全量；
- 全量模式保留原有顺序约束（REQ-001 置后、REQ-006 专用后端覆盖置后）；
- 目标需求为 REQ-006 时仍走其专用夹具与令牌流程；
- **未改动任何断言、评测用例、夹具、登录逻辑或超时预算**，仅改评测范围调度。

**改造后运行**：`bash scripts/ci-gate.sh` → 门禁 1–4 PASS；范围行
`门禁 5 范围：本次交付需求 REQ-20261112-008（全量回归请人工触发 CI_GATE_FULL_EVAL=1）`；
评测 11/11；`== 门禁全部通过 ==`，EXIT=0。日志为 `docs/evidence/REQ-20261112-008/ci-gate.log`
（`*.log` 被仓库 `.gitignore` 忽略，关键结论已在此复述）。

**2026-11-13 环境恢复记录**：宿主机夜间休眠后 Docker 栈停止（8080 不可达），提交钩子
重跑门禁时 5 个 seed 全部失败、后端 240s 未就绪。恢复栈后首轮门禁评测 5/11 失败，
后端日志显示 `/auth/login` 抛 `SaJwtException: jwt 签名无效`——Redis 中残留历史门禁用
临时密钥签发、约 7 天 TTL 的旧会话；admin 登录超过 Sa-Token 单端上限踢最老会话时
解析旧 JWT 失败并返回 500。同一轮还出现 `ERR_NETWORK_IO_SUSPENDED` /
`ERR_CONNECTION_REFUSED`（A-05 单条耗时 57 分钟），属宿主休眠挂起，不是断言失败。
直接复测真实登录页登录成功后复跑门禁：**11/11 通过，EXIT=0**（08:50，报告
`specs/evals/reports/REQ-20261112-008-20261113-085022.json`）。旧会话由登录踢除机制
自然淘汰；**未删除 Redis 共享数据、未改动任何断言或评测资产**。

披露：该次运行日志末行仍为改造前沿用文案「评测集（全部需求目录，等价夹具）」；运行结束后
仅把该成功提示改为按范围输出（单需求模式打印「本次交付需求 REQ-…」），门禁逻辑与范围判定
未再改动。全量日志另存 `ci-gate-full-mode.log`（gitignored）。

### 2026-11-13 交付前运行核验（部署产物与控制台恢复）

在不改动任何代码/评测资产的前提下，对“用户实际打开的系统”做了一次只读核验：

| 检查 | 命令/方法 | 结果 |
|---|---|---|
| 产物包含 SPEC-008 视图 | `grep -l "admin-app-list" dist/js/*.js` / `grep -l "snailjob_token" dist/js/*.js` | 命中 `admin-DshQ7EZK.js`、`snailjob-CIHiDqwu.js` |
| 容器部署的即本机最终产物 | `md5sum` 对比本机 dist 与 `awp-frontend:/usr/share/nginx/html/js/...` | 一致（admin `d0a442563bfd0d730c559efb3b41c4f8`）；入口均为 `/jse/index-index-CgSN2Qzd.js` |
| 同源控制台路由 | `curl http://localhost/...` | `/admin/login` 200；`/admin/applications` 401（未登录，预期）；`/snail-job/` 200；`/` 200；`:8080` 200 |
| 官方控制台进程 | 宿主机 `java -jar`（A 阶段同一方式） | 宿主重启后原进程已退出，本轮手工拉起：`:9090` / `:8800` 均 200（`deploy/build/monitor-admin.log`、`snailjob-server.log`，gitignored） |
| 生产预览 `:5666` | `curl` | 000（未启动，不影响容器 `:80` 入口） |

核验同时确认的既有部署缺口（A 阶段已记录，非本需求代码问题，不属 SPEC-008 断言范围）：

- 两个控制台是宿主机进程、未纳入 compose，机器重启后需手工再启动；
- compose 后端以 `--spring.boot.admin.client.enabled=false`、`--snail-job.enabled=false` 启动，
  Admin 监控的应用列表只含控制台自身注册的实例，任务调度中心暂无业务执行节点；
- `sj_group_config` 仍为 `ruoyi_group`（后端配置组名为 `aoyou_group`），接续任务执行前需建组或改配置。

本轮仅做运行核验与文档记录，未改代码、未改断言/评测/夹具。

### 说明

- SnailJob 未启动/未登录时的降级行为由 E2E 夹具（`page.route`）覆盖，不依赖外部控制台进程；
  Admin 侧 401/502/超时同样由夹具驱动（A-05、E-07、E-11）。
- SPEC-007 回归中发现的两条环境型波动（验证码 Redis 读取为空、Windows 浏览器 worker
  `0xC0000142`）已如实记录在回归日志中；修复导航 helper 后全量 28/28 通过，未放宽断言。
- 人工 UAT 签字待 PM / 业务方完成；trace `reviewer` 与 `review_verdict` 保持 `pending`。
