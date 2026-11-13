# REQ-20261112-008 /review 12 项评审证据

- 需求：REQ-20261112-008（系统监控原生视图：Admin 监控 / 任务调度中心最小可用集）
- Spec：`specs/SPEC-008-admin-snailjob-native.md` v1.0，hash `e28474d7222e`
- 交付分支：`008-admin-snailjob-native`（PR 目标分支为本需求分支，不指向 `main`）
- 评审方式：agent 自检（逐项对照 Spec、源码、单测/E2E、评测报告与门禁输出）
- 评审日期：2026-11-12
- 开发依据：签字版 Spec Packet + `specs/constraints/allowlist.md`（hash `4d2d2e9f97f7`）
  + `specs/constraints/constraints.md`（hash `77e727639c28`）

## 结论

**全部通过（12/12）**。第 11 项性能按 SPEC-008 §5 口径标注「未实测」，该指标不进入
A-xx、不计入 DoD；其余 11 项均有可执行证据。评测 11/11、SPEC-007 回归 28/28、
SPEC-008 E2E 21/21、单测 687/687、覆盖率 ≥ 70%、typecheck/oxfmt/ESLint/oxlint 均 exit 0，
`/spec-check` PASS。签字状态：agent 自检完成，人工签署待 PM / 业务方（trace
`reviewer: pending`）。

---

## 1. 契约一致 —— 通过

- Admin 应用列表只消费 `GET /admin/applications`，按 SPEC-008 §4.1 映射
  `name` / `status` / `instances`；实例状态取 `instances[].statusInfo.status`：
  `src/api/monitor/admin/index.ts#L114-L122`、`src/views/monitor/admin/index.vue#L209-L229`。
- 实例 id 经 `encodeURIComponent` 拼入 `/admin/instances/{id}/actuator/env|logfile`：
  `src/api/monitor/admin/index.ts#L124-L148`。
- `statusTimestamp` 为 UTC ISO8601，统一按 Asia/Shanghai 输出
  `YYYY-MM-DD HH:mm:ss`；空值/非法值显示「—」，不出现 `1970-01-01`：
  `src/views/monitor/admin/admin-page-logic.ts#L62-L87`。
- `metadata.userpassword` 与 `metadata.username` 不渲染（页面上没有任何读取该字段的模板）：
  `src/views/monitor/admin/index.vue#L224-L230`。
- 环境配置：`env.propertySources[].properties` 的 key/value 为 string；
  末段精确命中 `password/secret/token/accesskey/secretkey/passwd/userpassword` 才脱敏，
  空值显示「—」、真实 `0` 原样保留：`admin-page-logic.ts#L36-L44`、`#L107-L120`。
- 日志按 `text/plain` 读取并按行截取末尾 200 行；不落本地存储：
  `src/api/monitor/admin/index.ts#L138-L148`、`admin-page-logic.ts#L133-L142`。
- SnailJob 响应按 §4.2 解包 `{status, data, page, size, total}`；`status=1` 成功，
  `5001` 登录过期，其他失败展示后端 `message` 原文：
  `src/api/monitor/snailjob/index.ts#L91-L144`、`#L173-L180`。
- `jobStatus 1/0 → 启用/停用`、`nextTriggerAt` 空值「—」、任务状态
  `2/3/4/5/6 → 运行中/成功/失败/已停止/已取消`：
  `src/views/monitor/snailjob/snailjob-page-logic.ts#L3-L10`、`#L53-L85`。
- SnailJob JWT 仅写 `sessionStorage`（`snailjob_token` / `snailjob_namespace`），
  请求头为 `SNAIL-JOB-AUTH` + `SNAIL-JOB-NAMESPACE-ID`
  （后者取 namespace `uniqueId`，默认 `dev`）：
  `src/api/monitor/snailjob/index.ts#L7-L9`、`#L79-L89`、`#L146-L171`。

## 2. 断言可追溯 —— 通过

11 条 P0 断言全部落到实现位置（完整映射见 `trace/REQ-20261112-008.yaml` 的
`assertion_map`）：

| 断言 | 实现位置 |
|---|---|
| A-01 | `src/views/monitor/admin/index.vue#L196`（`admin-app-list`）、`#L209-L213`、`admin-page-logic.ts#L51-L59` |
| A-02 | `admin/index.vue#L196`、`#L213-L215`（状态列直出响应 `status`）、`src/api/monitor/admin/index.ts#L114-L122` |
| A-03 | `admin/index.vue#L233-L238`、`#L278-L294`、`src/api/monitor/admin/index.ts#L124-L136`、`admin-page-logic.ts#L107-L120` |
| A-04 | `admin/index.vue#L241-L247`、`#L348-L353`、`src/api/monitor/admin/index.ts#L138-L148`、`admin-page-logic.ts#L133-L142` |
| A-05 | `admin/index.vue#L173-L188`（登录提示 + `/admin/login` 链接）、`src/api/monitor/admin/index.ts#L88-L95` |
| A-06 | `src/views/monitor/snailjob/index.vue#L311-L339`、`src/api/monitor/snailjob/index.ts#L182-L191` |
| A-07 | `snailjob/index.vue#L341-L348`、`#L418-L465`、`src/api/monitor/snailjob/index.ts#L193-L201` |
| A-08 | `snailjob/index.vue#L349-L357`、`#L372-L396`、`#L161-L177`、`src/api/monitor/snailjob/index.ts#L203-L209` |
| A-09 | `snailjob/index.vue#L442-L452`、`#L179-L195`、`src/api/monitor/snailjob/index.ts#L211-L216` |
| A-10 | `snailjob/index.vue#L453-L463`、`#L197-L213`、`src/api/monitor/snailjob/index.ts#L218-L223` |
| A-11 | `admin-page-logic.ts#L36-L44`、`#L90-L94`、`#L107-L120`；`admin/index.vue#L310-L324`（展开后才渲染键值） |

## 3. 边界完整 —— 通过

E-01～E-12 均有处理分支与可执行证据：

| 边界 | 处理分支 | 证据 |
|---|---|---|
| E-01 空应用列表 | 空态「暂无应用」，不弹错误：`admin/index.vue#L190-L192` | `spec008-assertions.spec.ts:242` |
| E-02 环境空对象 | 「暂无配置项」，只请求一次：`admin/index.vue#L272-L277`、`#L97-L114` | `spec008-assertions.spec.ts:254` |
| E-03 环境超限 | 只取前 200 源 + 「已截断，仅显示前 200 条」：`admin/index.vue#L63-L66`、`#L265-L271` | `spec008-assertions.spec.ts:271` |
| E-04 日志超限 | 末尾 200 行：`admin-page-logic.ts#L133-L142` | `admin-page-logic.test.ts:80`（单测）、`spec008-assertions.spec.ts:196`（E2E 250 行） |
| E-05 无 admin 权限 | 路由由后端菜单生成，直达 404、无 `/admin/*` 请求 | `spec008-assertions.spec.ts:698` |
| E-06 无 snailjob 权限 | 同上，无 `/snail-job/*` 请求 | `spec008-assertions.spec.ts:716` |
| E-07 SBA 超时 | 30s `AbortController` → 「控制台连接超时」，清空表：`src/api/monitor/admin/index.ts#L59-L86`、`admin/index.vue#L71-L75` | `admin-api.test.ts:91`（单测） |
| E-08 5001 | 清会话 + 登录提示 + `/snail-job` 链接：`src/api/monitor/snailjob/index.ts#L136-L139`、`snailjob/index.vue#L235-L250` | `spec008-assertions.spec.ts:562`、`snailjob-api.test.ts:114` |
| E-09 重复点击执行 | `busyJobId` 守卫 + 按钮 disabled：`snailjob/index.vue#L154-L177`、`#L349-L357` | `spec008-assertions.spec.ts:584` |
| E-10 非法停止 | `canStop` 仅 RUNNING(2)：`snailjob-page-logic.ts#L37-L40`、`snailjob/index.vue#L442-L452` | `spec008-assertions.spec.ts:616` |
| E-11 反代 502/HTML | Content-Type 非 JSON → 「控制台不可用」，不解析 HTML：`src/api/monitor/admin/index.ts#L97-L112`、`src/api/monitor/snailjob/index.ts#L124-L134` | `spec008-assertions.spec.ts:294`、`:668`、`admin-api.test.ts:57`、`snailjob-api.test.ts:126` |
| E-12 total=0 | 「暂无任务」、`data-total="0"`、不请求执行记录：`snailjob/index.vue#L304-L309`、`#L363-L370` | `spec008-assertions.spec.ts:645` |

## 4. 错误码与异常 —— 通过

- 不新增后端错误码；页面内错误类型只承载 Spec 已定义的文案口径：
  `ConsoleAuthError` →「请先登录官方控制台」（A-05），`ConsoleTimeoutError` →
  「控制台连接超时」（E-07），`ConsoleUnavailableError` / `SnailJobUnavailableError` →
  「控制台不可用」（E-11），`SnailJobAuthError` →「请先登录任务调度中心」（E-08）：
  `src/api/monitor/admin/index.ts#L27-L52`、`src/api/monitor/snailjob/index.ts#L55-L71`。
- 非 `status=1` 展示后端 `message` 原文（缺失时「操作失败」），不改写成自定义结构：
  `src/api/monitor/snailjob/index.ts#L140-L143`。
- 无吞异常：每处 `catch` 都转换为可见文案并清空对应数据表；
  页面 `pageerror` 在所有 E2E 用例中断言为 0。
- 中文文案与 Spec 的 E-xx 表格逐字一致（`snailjob/index.vue#L240`、`#L308`；
  `admin/index.vue#L178`、`#L191`、`#L276`、`#L270`、`#L346`）。

## 5. 安全 —— 通过

- 无硬编码控制台地址：`grep -rn "localhost|127.0.0.1|http://"` 在本需求源码目录
  无命中；地址只从 `VITE_GLOB_MONITOR_ADMIN_URL` / `VITE_GLOB_SNAILJOB_ADMIN_URL`
  或运行时 `_app.config.js` 读取：`admin/index.vue#L32-L41`、`snailjob/index.vue#L33-L42`、
  `components/external-console-logic.ts#L14-L25`。
- 浏览器存储：SnailJob JWT 只进 `sessionStorage`（`snailjob_token`），
  无 `localStorage`、无 URL 参数、无日志/上报（源码 grep 仅
  `src/api/monitor/snailjob/index.ts` 的 sessionStorage 读写）：
  `snailjob/index.ts#L7-L9`、`#L73-L76`、`#L168-L170`。
- 脱敏：`metadata.userpassword` 不渲染；环境键末段命中敏感词 → `***`；
  日志中 `Bearer ` / `SNAIL-JOB-AUTH` 后的值 → `***`（§5）：
  `admin-page-logic.ts#L126-L130`（RED→GREEN 证据见 `admin-page-logic.test.ts:87`）。
- 外部输入校验：实例 id 走 `encodeURIComponent`；`taskBatchId` 为数字；
  不拼接 HTML，模板插值由 Vue 转义；`ENV_LIMIT`/`LOG_LIMIT` 固定 200。
- 控制台原始响应体不打印、不进错误上报：无 `console.*`/`sendBeacon`/`track(` 命中。

## 6. 依赖 —— 通过

- `package.json`、`pnpm-lock.yaml` 无改动；`frontend/packages/**` 与 `platform/` 的
  diff 为 0（`git diff --stat -- platform frontend/packages ...` 空输出）。
- 执行期间 pnpm 曾自动向 `frontend/pnpm-workspace.yaml` 的 catalog 追加三条**既有**依赖
  （`crypto-js` / `jsencrypt` / `@types/crypto-js`，均已在 `apps/web-antdv-next/package.json`
  中声明，非本需求新增）。该改动不属于本需求，已 `git checkout` 还原；最终
  `frontend/pnpm-workspace.yaml` diff 为空。
- 新增 import 只用仓库既有依赖：`vue`、`@vben/common-ui`、`@vben/stores`、
  `#/api/monitor/*`、`../components/external-console*`。
- 未新增权限码/菜单：两页面沿用 `monitor:admin:list`、`monitor:snailjob:list`
  （Spec §4.3），路由仍由后端菜单下发。

## 7. 技术债闸门 —— 通过

- 圈复杂度（≤15）：本需求新增/修改文件运行
  `pnpm exec eslint <7 个目录>` 无输出（exit 0），`complexity` 规则随 ESLint 配置生效。
- 重复率：登录响应解析与请求头构造只保留 API 模块一处实现
  （`src/api/monitor/snailjob/index.ts#L79-L89`、`#L146-L171`），
                            `snailjob-page-logic.ts` 不再保留同名重复函数；
  Admin 时间格式化与 SnailJob 时间直出分属两套契约（UTC ISO vs 已格式化字符串），
  属有意分离。未引入跨模块复制；重复率无法精确工具化，标注「工具未提供精确重复率」。
- 格式基线：本需求文件 `oxfmt --check` 与 `eslint`、`oxlint` 全部 exit 0；
  未为让全仓变绿修改无关文件（执行中发现 `api/monitor/logininfor/index.ts`
  被格式化工具误改，已 `git checkout` 还原）。

## 8. 并发与幂等 —— 通过

- 执行：`busyJobId` + 确认框 + 按钮 disabled，连续点击只发 1 次
  `POST /snail-job/job/trigger`：`snailjob/index.vue#L154-L177`、E2E `:583`。
- 停止/重试：`busyBatchId` 守卫，成功后 `reloadTasks` 刷新；重复执行只发 1 次：
  `snailjob/index.vue#L179-L213`。
- 写操作成功后刷新列表（A-08 列表再请求 1 次；A-09 记录状态不再为 RUNNING）：
  `snailjob/index.vue#L161-L177`、`#L179-L195`。
- Admin 只读，重复进入为幂等 GET；刷新按钮在 loading 中 disabled：
  `admin/index.vue#L151-L159`。

## 9. 可观测 —— 通过

- Spec §5 要求：不新增日志字段、错误文案来自控制台 `message` 或统一文案、
  不打印原始响应体——均满足（见第 4 项）。
- 留痕：写操作在页面显示操作人（当前登录用户 `realName`）与操作时间：
  `snailjob/index.vue#L87-L92`、`#L468-L474`；Admin 面板同样显示操作人
  （只读展示，不额外落审计表）：`admin/index.vue#L354-L356`。
- 不吞异常：失败都落到可见文案；E2E 全量 `pageerror === 0`。

## 10. 无越界（Non-goals） —— 通过

- diff 只含两个既有路由组件、两个 API 模块、两个纯逻辑模块及其单测、
  一条 E2E 文件、评测集、Spec 升格与证据/trace；无指标图/告警/实例注册、
  无通知/组/命名空间管理、无任务增删改与启停切换、无后端聚合代理接口。
- 无 `setInterval`/`EventSource`/`WebSocket` 轮询；无 localStorage 凭据持久化。
- 未改 `platform/`、`frontend/packages/**`、`package.json`/lock/`pnpm-workspace.yaml`：
  `git diff --stat -- platform frontend/packages frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml` 空输出。
- SPEC-007 A-08/A-09 的内嵌 iframe 与外链入口原样保留
  （`ExternalConsole` 未改动），SPEC-007 回归见第 12 项。

## 11. 性能 —— 未实测

SPEC-008 §5 给出「控制台同源请求 P95 ≤ 500ms（≤100 任务 / ≤200 env）、首屏 ≤2s、
5MB 日志仍可交互」的口径，但本次评测环境不提供对应压测夹具，且性能指标不进入
A-xx 验收断言。按既有口径标注「未实测」，不计入 DoD 判定；已知边界由
`ENV_LIMIT`/`LOG_LIMIT`=200 与 30s 超时兜底（`admin/index.vue#L29-L30`、
`src/api/monitor/admin/index.ts#L59`、`src/api/monitor/snailjob/index.ts#L10`）。

## 12. 评测集 —— 通过

- `specs/evals/REQ-20261112-008/cases.yaml` 共 11 条 P0 用例（TC-A01～TC-A11）；
  `python specs/evals/run.py --check` → `PASS: 11 条用例，P0 断言全覆盖`。
- 评测执行：`python scripts/evals/run_eval.py --req REQ-20261112-008 --report specs/evals/reports`
  → **11/11 通过**；最终代码报告 `specs/evals/reports/REQ-20261112-008-20261112-191531.json`
  （首跑 `...-20261112-173925.json` 亦为 11/11，两份均保留）。
- SPEC-008 E2E 全量：最终代码上 **21/21 通过**（17.3m，`spec008-regression.log`）。
- SPEC-007 回归：**28/28 通过**（30.3m，`spec007-regression.log`），含 A-08 / E-17
  两条外部控制台用例；A-08/E-17 另在最终导航 helper 上定向复跑 6/6
  （`spec007-retry-check.log`）。
- 单测：**88 文件 / 687 用例全部通过**；覆盖率 lines 89.73%、branches 77.25%、
  functions 91.2%、statements 89.69%（阈值 70%，`unit-coverage.log`）。
- 回写说明：开发期未发现缺失的验收断言；A-11 与 A-03 共用同一 E2E 用例标题
  （grep `A-03` 命中），已在 `cases.yaml` 注明，无需新增用例。
- 测试基础设施披露：`frontend/tests/e2e/helpers.ts` 的 `gotoAppPath`
  增加「启动期菜单路由就绪等待 + 落到首页时整页 reload 重试」，用于消除动态路由
  注册竞态导致的 SPEC-007 A-08/E-17 偶发失败；**未改变任何断言、超时预算或评测用例**。
  另对 `spec008-assertions.spec.ts` 做了两处 `no-await-expression-member` 风格重构
  （只提取 await 结果到局部变量，断言不变），随后全量复跑仍为 21/21。
- `/speckit-analyze`：本需求无 `specs/008-*` 特性目录，N/A；`/spec-check`
  10 项中 8 项 PASS、2 项 N/A（无 `speckit_feature`），结论 PASS。
- 门禁：`bash scripts/ci-gate.sh` **5/5 PASS，EXIT=0**（2026-11-13 08:50，报告
  `specs/evals/reports/REQ-20261112-008-20261113-085022.json`，11/11；改造后首轮
  23:31 的报告 `...-20261112-233138.json` 亦为 11/11）。
  按用户 2026-11-12 指示，门禁 5 已改为**默认只评测本次交付需求**（按分支号 008
  匹配 `specs/evals/REQ-20261112-008`），全量回归改为上线前人工触发
  `CI_GATE_FULL_EVAL=1 bash scripts/ci-gate.sh`；改造前后未改动任何断言、用例、
  夹具或超时预算（详见 `uat-and-evidence.md` 的「门禁 5 范围优化」与复跑记录）。
