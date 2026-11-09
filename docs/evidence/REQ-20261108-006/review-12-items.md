# /review 12 项检查（REQ-20261108-006 / SPEC-005 v1.4）

- 评审时间：2026-11-09（Asia/Shanghai）
- 评审范围：`git status --porcelain -uall` 中本需求交付文件（modified + untracked，不含临时文件与评测报告）
- 结论：**全部通过**（第 7 项为估算，第 11 项按规范标注“未实测”）

| # | 检查项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 契约一致 | 通过 | `HomeResponse.java` / `WorkbenchResponse.java` 字段名与 §4.2/§4.4 一致；`null`=无权限/不可用、`0`=真实零见 `DashboardServiceImpl.java#L189`、`home-page-logic.ts#L11`；时间统一 `DashboardTime.java#L14`（Asia/Shanghai，输出 `+08:00`）；`avgHandleHours` 1 位 HALF_UP 见 `DashboardEfficiencyCalculator.java#L61-L66` |
| 2 | 断言可追溯 | 通过 | A-01 `DashboardServiceImpl.java#L121`；A-02 `#L509`；A-03 `#L497` + `DashboardMapper.xml#L14`；A-04 `#L595`；A-05 `#L549`（另 L523/L536）；A-06 `#L143`；A-07 `#L387`；A-08 `workbench-page-logic.ts#L93`；A-09 `DashboardEfficiencyCalculator.java#L20`；A-10 `preferences.ts#L16`；A-11 `DashboardMapper.xml#L11`；A-12 `DashboardQueryTimeoutInterceptor.java#L45` |
| 3 | 边界完整 | 通过 | E-01 `DashboardServiceImpl.java#L189`、`home/index.vue#L291`；E-02 `#L516-L519`；E-03 `DashboardMapper.xml#L26`、`home/index.vue#L330`；E-04 `DashboardMapper.xml#L27-L28`；E-05 `home/index.vue#L309`（title）+ CSS `#L650`（ellipsis）；E-06 `DashboardController.java#L26-L32`（GET 只读）；E-07 `DashboardServiceImpl.java#L397-L403`、`#L436-L446`；E-08 `#L200-L205`；E-09 `#L103`（每次请求取权限，无缓存）；E-10 `DashboardQueryTimeoutInterceptor.java#L45` + `api/dashboard/home.ts#L11`（5s 前端超时）；E-11 `home/index.vue#L130-L134`（失败态清空并单次重试）；E-12 `DashboardServiceImpl.java#L307-L309`；E-13 `api/request.ts#L219-L250`（401 重认证）；E-14 `DashboardTime.java#L14-L25`；E-15 `home-page-logic.ts#L11` + `home/index.vue` 的 `v-if`；E-16 `workspace/index.vue#L54`、`#L187`；E-17 `home-page-logic.ts#L31`、`home-page-logic.test.ts#L54`、`cases.yaml` A-02 `array_length_eq=7`；E-18 `DashboardSlaCalculator.java#L38-L40`；E-19 `DashboardProperties.java#L40-L46`；E-20 `DashboardProperties.java#L47-L57` |
| 4 | 错误码与异常处理 | 通过 | `DashboardWarning.java` 仅定义 §4.2 四个枚举；控制器统一 `R.ok`（`DashboardController.java#L28`/`L33`），无自创错误结构；异常均记录日志并落 warning，未静默吞掉（`DashboardServiceImpl.java#L152-L161`、#L191-L196） |
| 5 | 安全 | 通过 | 租户只来自 `LoginHelper.getTenantId()`（`DashboardServiceImpl.java#L700-L703`），无请求参数覆盖；MyBatis 全部 `#{}`，无 `${}`；新增代码无硬编码密钥/外部 URL；接口需登录，健康字段受 `monitor:admin:list` 权限控制（`#L246-L258`） |
| 6 | 依赖白名单 | 通过 | `git diff` 不包含 `pom.xml` / `package.json` / lockfile 变更；仅复用平台既有 Spring、MyBatis、Redisson、Micrometer、Vben 依赖 |
| 7 | 技术债闸门 | 通过（估算） | `DashboardServiceImpl` 将加载逻辑拆为独立方法（#L106-L117 注释说明控制复杂度）；最大分支方法 `todoResult` 估算 ≤15，其余方法 ≤12；无工具可精确测量，重复率按人工估算 <5%（无跨文件复制块） |
| 8 | 并发与幂等 | 通过 | 两接口均 GET 只读（`DashboardController.java#L26-L32`）；工作台刷新 `inFlight` + 800ms 冷却（`workspace/index.vue#L187`）；后端 `taskId` 去重（`DashboardServiceImpl.java#L397-L403`）；重复请求不产生写入 |
| 9 | 可观测 | 通过 | Micrometer：`dashboard.home.requests`/`dashboard.home.partial`/`dashboard.home.duration`（`DashboardServiceImpl.java#L132-L136`），工作台对应计数器/计时器（#L379-L380）；日志含 `traceId`、`tenantId`、`userId`、`durationMs`、`warnings[].field:code`（#L137-L139、#L381-L383）；`path` 由平台统一请求日志输出（后端日志 `[PLUS]开始请求 => URL[...]`） |
| 10 | 无越界 | 通过 | diff 未含 C 方案角色门户、登录/权限模型改动、工作流状态机/批量办理、SBA 页面代理、新图表库或主题；`docs/prototypes/` 仅为已签字设计输入 |
| 11 | 性能 | 未实测（按检查项要求标注） | 未执行 100 并发压测；现有评测仅验证正确性与页面行为，不将 E2E 耗时当性能证据。Spec §5 的 P95/200KB/LCP 指标本报告不作通过结论 |
| 12 | 评测集 | 通过 | `specs/evals/reports/REQ-20261108-006-20261109-141930.json`：14/14 通过，P0 12/12 覆盖；开发中新增 TC-A13/TC-A14（`cases.yaml#L470`/`#L507`）并回写 `frontend/tests/e2e/spec005-home-workbench.spec.ts#L324`/`#L346`；查询超时缺陷 RED→GREEN 见 `docs/evidence/REQ-20261108-006/red-green-query-timeout.md` |

## 结论

全部通过。第 7 项为估算（无精确工具），第 11 项按规范标注“未实测”；二者不构成修复项。
