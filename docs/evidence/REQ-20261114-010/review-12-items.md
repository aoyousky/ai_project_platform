# REQ-20261114-010 /review 12 项 checklist

- 评审范围：`010-console-orchestration` 分支工作树（`git diff` + 未跟踪新增文件）
- 评审时间：2026-11-15 08:49 (+08:00)（按 SPEC-010 **v1.1** 复核；v1.0 版评审结论为 5 项不通过，见 git 历史）
- 评审人：agent（自检）；人审待定
- 关联：Spec `specs/SPEC-010-console-orchestration.md` v1.1；CLAR-017（009）、CLAR-018（本需求边界，含 E-10 补充发现）

| # | 项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 契约一致 | 通过 | 端口/容器名/context-path 与 §4 一致（[docker-compose.yml:149-201](deploy/docker-compose.yml#L149-L201)）；v1.1 已把 E-13 列表字段改为 `data`，§4 改为上游响应外层 `status`/`message`，与实测 `{"status":1,"data":[]}` 一致 |
| 2 | 断言可追溯 | 通过 | A-01→compose#L149,L172；A-02→nginx#L36-L52；A-03→compose#L221-L227；A-04→snailjob-seed.sql#L8-L16；A-05→compose#L229-L232；A-06→seed#L18-L34；A-07→nginx#L36-L52；A-08→verification:diff-check（`trace/REQ-20261114-010.yaml`） |
| 3 | 边界完整 | 通过（3 条未实测） | E-05/E-07/E-08/E-10/E-12/E-14/E-15 依 CLAR-018 裁决 B 改写为「上游固有行为 + 实测可判定口径」（v1.1）；E-01/E-03/E-06/E-11 有实现分支且已实测；E-02/E-04/E-09 有实现分支（compose 端口分配、healthcheck、nginx 变量 proxy_pass），**未实测**，已在 trace 标注 |
| 4 | 错误码一致 | 通过 | v1.1 已退役五项自创错误码（上游三构建产物与 class 常量命中 0 次）；契约改为上游 `status`（1/0）与 `message` 原文透传，实现层无自造错误结构 |
| 5 | 安全 | 通过 | 口令只来自 `${MONITOR_ADMIN_USERNAME/PASSWORD}`（[compose:159-160](deploy/docker-compose.yml#L159-L160)）；`.env.example` 仅占位；db-init 用 `SHA2(...)` 经 stdin 落库、不回显（[compose:82-86](deploy/docker-compose.yml#L82-L86)）；改动 diff 敏感赋值扫描为空 |
| 6 | 依赖白名单 | 通过 | 无新增 Maven/npm 依赖；新增镜像仅 `eclipse-temurin:17-jre`（`deploy/Dockerfile.*`），jar 来源于既有模块 |
| 7 | 技术债闸门 | 通过（工具估算） | 新增 `check.py` 各函数规模 6–30 行、分支 ≤ 6（圈复杂度 ≤ 7）；`ci-gate.sh` 未改动；重复率未用工具度量，人工判断无复制块 |
| 8 | 并发与幂等 | 通过（按 v1.1 口径） | 种子按唯一键幂等（seed#L14-L16、L32-L34）；v1.1 E-08 明确「上游无幂等键，记录增量 = 提交次数」，评测集不依赖并发调度 |
| 9 | 可观测 | 通过 | 两控制台 healthcheck 已启用（compose#L164-L168/L196-L200）；v1.1 E-10 改为以 `sj_server_node` 注册数据判定组名（实测在线节点 group=aoyou_group），§5 可观测条目同步；上游客户端只输出 `snail-job client started successfully v1.10.0`，该日志口径不再作为验收项 |
| 10 | 无越界 | 通过 | `frontend/apps/**` 与 `specs/SPEC-008-*.md` 相对基线 diff=0（A-08 实测）；无新增权限码；未提交 PR/merge。**本次 diff 含 `specs/SPEC-010-*.md` 升版 v1.1**——系 PM 会话授权（CLAR-018），非 Non-goals 实现内容 |
| 11 | 性能 | 通过（按 A-01/A-07 实测口径） | 本次门禁 A-07 `compose restart` 后 49.5s 恢复（≤120s）；A-01 控制台健康检查在 120s 窗口内；A-03 注册耗时按后端日志 Started→registered ≤ 60s 判定。Spec 未给并发数，未做并发压测（不进入 A-xx） |
| 12 | 评测集 | 通过 | `specs/evals/REQ-20261114-010/`（cases.yaml + check.py）8 条 P0 用例，门禁 5/5 PASS（EXIT=0），报告 `REQ-20261114-010-20261115-084859.json`，8/8；未改动任何既有断言/用例；本需求未新发现需回写的用例 |

## 结论

**全部通过（12/12）**

遗留与须知（不构成不通过）：

1. 人审未完成：`trace.reviewer` 记为 agent 自检，`review_verdict=pass` 仅代表自检结论，人审签字另计。
2. E-02 / E-04 / E-09 三条边界未实测（需占用端口、停 MySQL、制造崩溃态），已在 trace 如实标注；v1.0 评审时亦为同一状态。
3. E-10 的改写属 CLAR-018「补充发现」：未经业务方/架构方单独确认，人审时需一并确认；若坚持原「启动日志打印组名」口径，则超出「只改配置」范围，须另开 Spec 升版。
4. v1.1 未重新取得业务方/架构方签字，§9 变更表已如实记录（原 v1.0 签字沿用）。
