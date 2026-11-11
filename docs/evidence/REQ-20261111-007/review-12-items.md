# REQ-20261111-007 /review 12 项评审证据

- 需求：REQ-20261111-007（系统监控模块前端交付：在线用户 / Admin 监控 / 缓存监控 / 任务调度中心）
- Spec：`specs/SPEC-007-system-monitor.md` v1.0，hash `aaa267adeaec`
- 交付分支：`007-system-monitor`（PR 目标分支为本需求分支，不指向 `main`）
- 评审方式：agent 自检（逐项对照 Spec、源码、单测/E2E、评测报告与门禁输出）
- 评审日期：2026-11-11
- 人工签署：aoyousky 2026-11-11，结论 **pass**
- 开发依据：签字版 Spec Packet + `specs/constraints/allowlist.md`（hash `4d2d2e9f97f7`）
  + `specs/constraints/constraints.md`（hash `77e727639c28`）；`specs/007-system-monitor/spec.md`
  只作为上游意图，不作为判定依据。

## 结论

**12/12 通过（agent 评审），aoyousky 人工签署 pass（2026-11-11）**。依据：
评测 10/10（门禁 5 全量运行）、边界 E2E 18/18、单测 84 文件 661/661、
覆盖率 lines 89.33% / branches 77.21%（阈值 70%）、`vue-tsc` exit 0、
本需求文件 oxfmt/ESLint/oxlint exit 0、`bash scripts/ci-gate.sh` 5/5 PASS。
第 11 项性能按 Spec 标注「未实测」（不属 DoD 判定），签署时确认接受；
仓库级 oxfmt 基线失败（122 个既有文件）签署时确认不在本需求修复。

---

## 1. 契约一致 —— 通过

- 在线列表只消费 `GET /monitor/online/list`，不传分页参数，响应按
  `{ total, rows }` 解包：`src/api/monitor/online/index.ts:13-19`、
  `src/api/system/common.ts` 的 `PageResult`。
- 单条强退只消费 `DELETE /monitor/online/{tokenId}`，`tokenId` 经
  `encodeURIComponent` 后放入路径，不截断、不转小写：
  `src/api/monitor/online/index.ts:21-25`。
- 字段名、可空性与空值语义与 SPEC-007 §4.1 一致：
  `src/api/monitor/online/types.ts:5-22` 中 `browser/clientKey/deptName/deviceType/ipaddr/
  loginLocation/os/userName` 均为 `null | string`；`loginTime` 为 epoch 毫秒
  `number`；`tokenId` 为 `string`。
- `loginTime` 固定按 UTC+8 输出 `YYYY-MM-DD HH:mm:ss`，精度到秒，不依赖宿主时区：
  `src/views/monitor/online/online-page-logic.ts:27-40`。
- 筛选参数只下发非空字符串，保留原值（不 trim、不加通配符），AND 语义由两个
  参数同时下发实现：`src/views/monitor/online/online-page-logic.ts:55-66`。
- 缓存监控只消费 `GET /monitor/cache`；不请求任何键浏览/清理端点：
  `src/api/monitor/cache/index.ts:11-13`。
- 缓存契约与 §4.2 一致：`info` 为字符串映射、`dbSize` 为 `null | number`
  （`null` 未知、`0` 空库）、`commandStats` 为 `name/value:string` 数组：
  `src/api/monitor/cache/types.ts:2-15`。
- `null`/`undefined`/空串统一显示「—」，真实 `0` 原样显示；缓存与在线两处
  独立实现同样语义：`online-page-logic.ts:19-24`、`cache-page-logic.ts:6-11`。
- CPU 数值保留两位小数、运行模式 `standalone→单机`/其他→`集群`、
  AOF `0→否`/其他→`是`、网络合并为 `{输入}kps/{输出}kps`：
  `src/views/monitor/cache/cache-page-logic.ts:14-44`。
- 外部控制台地址只从环境/运行时配置读取，空串按未配置处理；生产相对路径
  `/admin/applications`、`/snail-job` 由 `.env.production` 提供，运行时由
  `_app.config.js` 注入：`src/views/monitor/components/external-console-logic.ts:14-25`、
  `src/views/monitor/admin/index.vue:11-20`、`src/views/monitor/snailjob/index.vue:11-20`。

## 2. 断言可追溯 —— 通过

10 条 P0 断言全部落到实现位置（完整映射见 `trace/REQ-20261111-007.yaml` 的
`assertion_map`）：

| 断言 | 实现位置 |
|---|---|
| A-01 | `frontend/apps/web-antdv-next/src/views/monitor/online/index.vue#L98-167`（10 列表头）、`#L51-65`（全量取数与 `total=rows.length`） |
| A-02 | `frontend/apps/web-antdv-next/src/views/monitor/online/online-page-logic.ts#L55-66`、`online/index.vue#L51-58` |
| A-03 | `online/index.vue#L203-219`、`src/api/monitor/online/index.ts#L21-25` |
| A-04 | `online/index.vue#L221-253`、`online-page-logic.ts#L109-132` |
| A-05 | `online-page-logic.ts#L94-132`（逐条捕获、继续执行、汇总文案） |
| A-06 | `src/views/monitor/cache/index.vue#L35-114`（12 项）、`#L99-102`（`cache-db-size`） |
| A-07 | `cache/index.vue#L173-184`、`cache/components/cache-command-chart.vue#L47-56`、`cache/components/cache-memory-chart.vue#L29-31` |
| A-08 | `src/views/monitor/admin/index.vue#L16-20`、`components/external-console.vue#L28-45` |
| A-09 | `src/views/monitor/snailjob/index.vue#L16-20`、`components/external-console.vue#L28-45` |
| A-10 | `online/index.vue#L41-49`（AND 权限判定）、`#L267`/`#L286`（控件条件渲染） |

## 3. 边界完整 —— 通过

E-01～E-17 均有处理分支与可执行用例（E2E 用例见
`frontend/tests/e2e/spec007-assertions.spec.ts`，E-04 为纯函数单测）：

| 边界 | 处理分支 | 证据 |
|---|---|---|
| E-01 无匹配 | `emptyText: '暂无数据'`，不弹错误：`online/index.vue#L168` | `spec007-assertions.spec.ts:599` |
| E-02 AND 语义 | 两参数同时下发：`online-page-logic.ts#L55-66` | `:615` |
| E-03 特殊字符 | 原值下发、请求层编码，不外拼 SQL：`online-page-logic.ts#L55-66` | `:636` |
| E-04 12 条本地分页 | `paginateRows` + `loadCachedRows` 只取数一次：`online-page-logic.ts#L69-92` | `online-page-logic.test.ts:52-80` |
| E-05 已过期会话 | 强退成功按幂等处理并刷新：`online/index.vue#L203-219` | `:656` |
| E-06 批量超时 | 单条失败不中断，收集失败明细：`online-page-logic.ts#L109-132` | `:700` |
| E-07 未勾选 | 按钮 `disabled`：`online/index.vue#L266-274` | `:739` |
| E-08 取消确认 | 仅关闭弹窗、不发请求：`online/index.vue#L298-309` | `:758` |
| E-09 缓存失败 | 仅显示后端 `msg`，清空数据：`cache/index.vue#L120-131`、`#L140-151` | `:932` |
| E-10 缺键 | `displayValue` 回退「—」：`cache-page-logic.ts#L6-11` | `:963` |
| E-11 `commandStats=[]` | 空数组不渲染图表、显示「暂无数据」：`cache-command-chart.vue#L48-56` | `:1015` |
| E-12 地址为空 | `isConfigured` + 未配置分支：`external-console-logic.ts#L5-7`、`external-console.vue#L48-58` | `:233`、`:297` |
| E-13 地址不可达 | iframe 与外链保留，不弹自造错误：`external-console.vue#L26-46` | `:250` |
| E-14 无缓存权限 | 路由由后端菜单生成，前端无静态路由；突增请求数 0 | `:1060` |
| E-15 无监控权限 | 同上，直达 404 | `:784` |
| E-16 连续确认 | `isBatchLoggingOut` 守卫 + 按钮 `disabled`：`online/index.vue#L229-253`、`#L301` | `:807` |
| E-17 新窗口打开 | `window.open(url, '_blank', 'noopener,noreferrer')`：`external-console.vue#L17-21` | `:268`、`:318` |

## 4. 错误码与异常 —— 通过

- 不新增错误码；成功判定沿用 `code === 200`，`401` 走既有重新认证，`403` 与
  其他非 200 展示后端 `msg` 原文：`src/api/request.ts:36-39`、`96-110`。
- 缓存页失败不吞异常，只展示 `resolveErrorMessage(error)` 的后端原文并清空信息表/图表：
  `src/views/monitor/cache/index.vue:120-131`。
- 批量强退逐条捕获，失败条目保留行、汇总提示包含成功/失败数与失败原因；非 `Error`
  使用统一网络错误文案：`online-page-logic.ts:109-132`。
- 单条强退 `catch` 为空是刻意的：请求层已展示后端 `msg`，强退失败时行保留；
  见 `online/index.vue:213-215` 的注释与 E-05/E-06 用例。

## 5. 安全 —— 通过

- 全量搜索 SPEC-007 代码：无 `console.*`、`localStorage`、`sessionStorage`、
  `sendBeacon`/埋点调用（`grep -rnE "console\\.|localStorage|sessionStorage|sendBeacon|track\\("`
  结果为空）。
- `tokenId`/`ipaddr`/`loginLocation` 只出现在表格展示、查询参数与 `DELETE` 路径；
  未进入日志、存储、埋点或错误上报。
- 请求失败日志固定输出 `timestamp/level/url/message/code`，URL 先脱敏查询参数，
  不含响应体：`src/api/request.ts:40-79`。
- 源码与组件无硬编码控制台地址；测试断言也要求由 `E2E_MONITOR_ADMIN_URL` /
  `E2E_SNAILJOB_ADMIN_URL` 提供（缺失即 fail-fast），评测地址由夹具注入：
  `frontend/tests/e2e/spec007-assertions.spec.ts:150-166`、
  `scripts/evals/run_eval.py` 的 `build_env()`。
- 外链使用 `noopener,noreferrer`，并保留 `rel` 属性：`external-console.vue:17-36`。
- 查询参数原样下发，由请求库编码；无字符串拼接 SQL/HTML。

## 6. 依赖白名单 —— 通过

- `package.json` 与 `pnpm-lock` 无改动（`git status` 无相关条目）。
- 新增 import 只使用仓库既有依赖：`antdv-next`、`@vben/common-ui`、
  `@vben/plugins/echarts`（仅用已注册的 PieChart）、`#/adapter/vxe-table`、
  `#/api/request`、`#/composables/use-dict`。
- `frontend/packages/**` 与 `platform/` 的 diff 为 0（`git diff --stat -- platform frontend/packages`
  空输出）。

## 7. 技术债闸门 —— 通过

- 圈复杂度：本需求 21 个新增/修改文件运行
  `pnpm exec eslint <files>` 无输出（exit 0），`complexity` 规则随 ESLint 配置生效。
- 重复率：SPEC-007 新增纯逻辑已抽取为 `online-page-logic.ts`、`cache-page-logic.ts`、
  `external-console-logic.ts`，组件与页面只做编排；`displayValue` 在两个
  page-logic 中各有实现（在线/缓存契约不同，属有意分离）。未引入跨模块复制。
- **格式基线（如实记录）**：仓库级 `pnpm lint` 在 HEAD 基线上即失败——
  `oxfmt --check` 报 122 个既有文件，含未改动的 `system/post/index.vue`、
  `tests/e2e/helpers.ts`（其 HEAD 版本单独跑同样失败），不是本需求引入。
  本需求文件的 `oxfmt --check`、ESLint、oxlint 均 exit 0；未为“让全仓变绿”
  去改无关文件。

## 8. 并发与幂等 —— 通过

- 批量强退执行中由 `isBatchLoggingOut` 阻断重复确认，按钮 `disabled`，E-16 验证
  连续两次确认只产生 2 次 `DELETE`：`online/index.vue:229-253`、`:301`。
- 单条强退与批量强退成功后清空行缓存并重新取数；已过期会话按 `code=200` 幂等成功处理：
  `online/index.vue:192-201`、`:203-219`。
- 本地分页缓存以筛选条件 JSON 为键，刷新/强退后主动失效，避免陈旧数据：
  `online/index.vue:39`、`:67-69`、`:192-201`。
- 缓存页只读，重复进入页面为幂等 GET。

## 9. 可观测 —— 通过

- SPEC-007 §5 要求的失败日志字段 `timestamp/level/url/message/code` 由请求层
  统一输出：`src/api/request.ts:68-79`。
- 页面不吞异常：缓存失败展示后端 `msg`；批量失败汇总失败原因；单条强退失败由
  请求层提示。`pageerror` 在所有 E2E 用例中断言为 0。

## 10. 无越界（Non-goals） —— 通过

- SPEC-007 代码只请求 `/monitor/online/list`、`/monitor/online/{tokenId}`、
  `/monitor/cache`；无键浏览、键清理、全部清理、在线导出、轮询/SSE/定时刷新、
  后端批量强退接口。
- 全量搜索 `setInterval|EventSource|WebSocket|batchLogout`（后端批量路径）
  在 SPEC-007 目录无命中；在线页“批量”仅在前端逐条调用单条 `DELETE`。
- 未新增权限码：仅使用后端已定义的 `monitor:online:forceLogout`、
  `monitor:online:batchLogout`、`monitor:online:list`、`monitor:cache:list`
  （后端定义见 `platform/aoyou-modules/aoyou-system/.../SysUserOnlineController.java:44,83`、
  `CacheController.java:31`）。
- 未修改 `platform/`、`frontend/packages/**`、`package.json`。

## 11. 性能 —— 未实测

SPEC-007 §5 给出 200 会话、每页 10 条的 P95 口径，但本次评测环境不提供
200 条在线会话的压测夹具，且性能指标不进入 A-xx 验收断言。按既有口径标注
“未实测”，不计入 DoD 判定；本地分页/筛选为纯内存操作，数据量上限由后端一次
返回全部会话决定（`online-page-logic.ts:69-92`）。

## 12. 评测集 —— 通过

- P0 用例（A-01～A-10）：门禁 5 的全量运行中通过
  `python scripts/evals/run_eval.py --req REQ-20261111-007`
  → **10/10 通过**，报告 `specs/evals/reports/REQ-20261111-007-20261111-154802.json`
  （`generated_at 2026-11-11T07:48:02Z`，`base_url http://localhost:8080`）。
  用例定义见 `specs/evals/REQ-20261111-007/cases.yaml`。
- 完整门禁 `bash scripts/ci-gate.sh` → **`== 门禁全部通过 ==`（5/5，exit 0）**。
- 夹具事件（如实记录）：首次门禁在 REQ-20261108-006 A-03 失败，根因是共享测试库
  积压 96 条 REQ-20261103-002 评测遗留账号 `spec002_created_*`，使「Spec002 部门」
  98 人与 Top5 第 5 名「人力资源部」98 人打平并被顶掉。经用户授权删除这批遗留账号
  及其角色/岗位关联后重跑，门禁 5 全绿；未修改任何评测断言、种子脚本或 `specs/`。
  该问题与 SPEC-007 代码无关，但会反复出现，建议后续给 REQ-002 评测增加清理步骤
  （属该需求维护范围，本次不越界修改）。
- 边界用例（E-01～E-17）：同一 E2E 文件在最终重建构建上复跑
  `pnpm exec playwright test tests/e2e/spec007-assertions.spec.ts -g "E-"`
  → **18/18 通过**（5.9m，exit 0；E-12/E-17 双页面各 1 条，E-04 为单测）。
  E-xx 未进入 `cases.yaml` 的用例列表：`run_eval.py` 的静态检查只索引
  A-xx 行（E-xx 记在 `boundary_evidence`），属夹具限制，非覆盖缺口。
- 门禁 5 会以仓库根目录为准重跑**全部需求目录**的评测；本需求结果以门禁输出为准，
  单独报告仅作诊断用。
- 评测地址由 `E2E_MONITOR_ADMIN_URL` / `E2E_SNAILJOB_ADMIN_URL` 注入，
  缺失时用例 fail-fast（`spec007-assertions.spec.ts:150-166`），不硬编码。
