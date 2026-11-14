# REQ-20261114-010 /review 12 项 checklist

- 评审范围：`010-console-orchestration` 分支工作树（`git diff` + 未跟踪新增文件）
- 评审时间：2026-11-15 01:45 (+08:00)
- 评审人：agent（自检）；人审待定
- 关联：Spec `specs/SPEC-010-console-orchestration.md` v1.0；CLAR-017（009）、CLAR-018（本需求边界）

| # | 项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 契约一致 | 不通过（1 项不符） | 端口/容器名/context-path 与 §4 一致（[docker-compose.yml:149-201](deploy/docker-compose.yml#L149-L201)）；但 E-13 列表字段实测为 `data`，Spec 写 `rows`（CLAR-018） |
| 2 | 断言可追溯 | 通过 | A-01→compose#L149,L172；A-02→nginx#L36-L52；A-03→compose#L221-L227；A-04→snailjob-seed.sql#L8-L16；A-05→compose#L229-L232；A-06→seed#L18-L34；A-07→nginx#L36-L52；A-08→verification:diff-check（`trace/REQ-20261114-010.yaml`） |
| 3 | 边界完整 | 不通过 | E-05/E-07/E-08/E-12/E-14/E-15 与上游控制台行为冲突（实测，见 `clarifications/CLAR-018.md`）；E-02/E-04/E-09 未实测 |
| 4 | 错误码一致 | 不通过 | `GROUP_NOT_FOUND`/`EXECUTOR_OFFLINE`/`SBA_REGISTER_FAILED`/`TOO_MANY_TRIGGERS`/`ILLEGAL_STATE` 在三个构建产物与上游 class 常量中命中 0 次；配置层无法产生，且不得自创错误码 |
| 5 | 安全 | 通过 | 口令只来自 `${MONITOR_ADMIN_USERNAME/PASSWORD}`（[compose:159-160](deploy/docker-compose.yml#L159-L160)）；`.env.example` 仅占位；db-init 用 `SHA2(...)` 经 stdin 落库、不回显（[compose:82-86](deploy/docker-compose.yml#L82-L86)）；改动 diff 敏感赋值扫描为空 |
| 6 | 依赖白名单 | 通过 | 无新增 Maven/npm 依赖；新增镜像仅 `eclipse-temurin:17-jre`（`deploy/Dockerfile.*`），jar 来源于既有模块 |
| 7 | 技术债闸门 | 通过（工具估算） | 新增 `check.py` 各函数规模 6–30 行、分支 ≤ 6（圈复杂度 ≤ 7）；`ci-gate.sh` 未改动；重复率未用工具度量，人工判断无复制块 |
| 8 | 并发与幂等 | 不通过 | 种子按唯一键幂等（seed#L14-L16、L32-L34）；但触发接口无幂等键，重复提交产生多条记录（E-08，实测 +2） |
| 9 | 可观测 | 不通过 | 两控制台 healthcheck 已启用（compose#L164-L168/L196-L200）；后端日志实测仅输出 `snail-job client started successfully v1.10.0`，未打印实际组名 → E-10 日志口径不满足 |
| 10 | 无越界 | 通过 | `frontend/apps/**` 与 `specs/SPEC-008-*.md` 相对基线 diff=0（A-08 实测）；无新增权限码；未提交 PR/merge |
| 11 | 性能 | 未实测 | A-07 实测 restart 后 54.0s 恢复（评测报告），冷启动 ≤120s 口径达成；未做并发压测（Spec §5 未给并发数） |
| 12 | 评测集 | 通过 | 新需求评测集 `specs/evals/REQ-20261114-010/`（cases.yaml + check.py）8 条 P0 用例，门禁 5/5 PASS，报告 `REQ-20261114-010-20261115-011827.json`，8/8；未改动任何既有断言/用例 |

## 结论

**5 项不通过（1、3、4、8、9）+ 1 项未实测（11）**

修复清单：

1. 项 1/3/4/8/9 的共同根因是 SPEC-010 §3 的边界口径与官方控制台实际行为不一致（CLAR-018）。
   需 PM 裁决：选项 A 扩范围自建包装层 / 选项 B Spec 升版把 E-xx 改为上游固有行为 / 选项 C 记为已知缺口。
   **裁决前不修改 `specs/`，也不实现包装层。**
2. 项 11 需在裁决后按 Spec §5 口径补压测或明确标注“未实测不进入 A-xx”。
3. 项 9 若采纳选项 B，则 E-10 的“日志打印组名”随边界表一并调整；若保留，则需在 `platform/` 增加一行组名日志（超出当前已批准范围）。
