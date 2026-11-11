# Phase 0 Research: 系统监控模块前端交付

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Input**: [spec.md](spec.md)、已签字 `specs/SPEC-007-system-monitor.md` v1.0、仓库现有实现与后端源码。

本阶段无 `NEEDS CLARIFICATION`。以下决策用于消除实现方式上的不确定性，均不改变 Spec Packet 的断言内容。

## R-01 外部控制台使用自建视图而非内置 `IFrameView`

- **Decision**: 在 `views/monitor/admin/index.vue` 与 `views/monitor/snailjob/index.vue` 中渲染自建
  `external-console.vue`：由环境变量取地址，渲染 `<iframe data-testid="monitor-iframe">`，并提供
  `<a data-testid="monitor-open-external">` 外链。
- **Rationale**: 仓库内 `IFrameView` 是空 div，真实 iframe 由布局 `iframe-router-view.vue` 依据
  `route.meta.iframeSrc` 渲染；该机制无法提供本 Packet 要求的 `data-testid`、未配置提示、
  外链与高度断言，也无法把地址来源固定为两个环境变量。自建视图可全部满足 A-08/A-09/E-12/E-13/E-17。
- **Alternatives considered**:
  - 修改后端菜单 `meta.link` 指向外部地址：需要改后端或菜单数据，违反 `platform/` 零改动。
  - 修改 `frontend/packages/**` 的 iframe 视图：违反 packages 零改动。
  - 仅用 `<a>` 新窗口打开：不满足“内嵌区域”断言。

## R-02 环境变量读取与类型

- **Decision**: 通过 `import.meta.env.VITE_GLOB_MONITOR_ADMIN_URL` 与
  `import.meta.env.VITE_GLOB_SNAILJOB_ADMIN_URL` 读取；在 `src/types/env.d.ts` 扩展 `ImportMetaEnv`；
  在 `.env.development` 写入 `http://localhost:9090/admin/applications` 与
  `http://localhost:8800/snail-job`，在 `.env.production` 写入 `/admin/applications` 与 `/snail-job`。
  组件内不提供硬编码兜底值。
- **Rationale**: Vite 只注入 `VITE_` 前缀变量；项目现有 `.env.*` 已使用 `VITE_GLOB_*` 命名。
  代码内兜底会让“未配置”状态永远不可达，E-12 无法通过。
- **Alternatives considered**:
  - 使用 `VITE_APP_MONITOR_ADMIN`（plus-ui 命名）：与已签字 Packet §4.3 命名冲突。
  - 运行时从 `window` 注入：需要改入口文件，且评测环境不便设置。

## R-03 批量强退按钮的“两码齐全”判定

- **Decision**: 使用 `hasCodeAccess(accessCodes, ['monitor:online:batchLogout'])` 与
  `hasCodeAccess(accessCodes, ['monitor:online:forceLogout'])` 分别判定后取 AND，结果绑定 `v-if`；
  单条强退按钮与批量按钮均加 `data-testid`。
- **Rationale**: `src/directives/access.ts` 的 `hasCodeAccess` 对数组使用 `.some`（任一命中即通过），
  无法表达“同时具备”。A-10 中 `spec007_limited` 只有 `monitor:online:list`，AND 判定可保证两个按钮
  均不渲染；超级管理员 `*:*:*` 仍由 `hasCodeAccess` 的短路逻辑放行。
- **Alternatives considered**:
  - `v-access:code="['batchLogout','forceLogout']"`：语义为 OR，会在只具备其一时错误渲染。
  - 修改指令为 AND 语义：会影响既有页面，违反最小改动。

## R-04 在线列表：一次取全量 + 前端本地分页

- **Decision**: `listOnlineApi` 只调用一次 `GET /monitor/online/list`，把返回 `rows` 全量保存在页面状态；
  表格使用 `useVbenVxeGrid` 的本地数据与 `pagerConfig.pageSize=10`，翻页不触发 `proxyConfig.ajax`。
- **Rationale**: 后端 `TableDataInfo.build(list)` 的 `total` 等于 `rows.length`，不支持服务端分页；
  E-04 要求翻页期间列表请求累计次数为 1。vxe-grid 在无 `proxyConfig.ajax` 时对 `data` 做本地分页。
- **Alternatives considered**:
  - 每次翻页重新请求并本地切片：请求次数 > 1，E-04 失败。
  - 自建简单分页器 + 表格：可行但重复现有表格能力，增加样式与交互差异。

## R-05 筛选：精确等值 + AND

- **Decision**: 表单提交时把 `ipaddr`、`userName` 原样放入查询参数，不拼接 `LIKE`、不裁剪内部空白；
  两个字段都非空时由后端按 AND 处理；前端不额外做模糊匹配；重置时清空两个字段并重新请求。
- **Rationale**: 后端接口对两个参数使用精确等值；A-02/E-02 要求 AND 语义；E-03 要求特殊字符不导致 500，
  前端不加工即可把原始文本交给后端参数绑定。
- **Alternatives considered**:
  - 前端二次过滤：会与后端结果叠加，且无法证明 AND 语义来自契约。
  - `trim()` 后提交：会把“空格账号”改成另一账号，改变精确匹配语义。

## R-06 批量强退：逐条调用、继续执行、一次刷新、汇总提示

- **Decision**: 对选中 `tokenId` 串行 `for...of` 调用 `forceLogoutOnlineApi`，每条 `try/catch` 独立收集
  成功与失败（失败保留后端 `msg` 或请求层统一网络错误文案）；全部结束后刷新一次列表；
  提示文案 `成功 N 条，失败 M 条`，存在失败时追加失败原因。
- **Rationale**: 后端无批量接口，Packet 明确“前端逐条调用单条 DELETE”；A-04/A-05/E-06 要求
  部分失败仍继续、最终数量正确、失败行保留。串行避免并发强退对同一列表刷新造成竞态。
- **Alternatives considered**:
  - `Promise.all`：任一失败会提前中断汇总，且并发请求不利于逐条留痕。
  - 失败即停止：违反 A-05“其余条目继续执行”。

## R-07 单条强退与幂等

- **Decision**: 二次确认后调用 `DELETE /monitor/online/{encodeURIComponent(tokenId)}`；成功即刷新列表并提示
  「强退成功」；已过期会话后端仍返回 `code=200`，按成功处理。
- **Rationale**: A-03/E-05 与后端事实一致；`tokenId` 作为路径段需要编码，避免特殊字符破坏 URL。
- **Alternatives considered**:
  - 先本地移除再请求：失败时列表与后端不一致，且无法展示后端 `msg`。
  - 对 404 特判为成功：后端不会返回 404，特判属自造语义。

## R-08 缓存字段转换与空值

- **Decision**: 在 `cache-page-logic.ts` 提供纯函数：
  `displayValue(v)`（`null`/`undefined`/空串 → `—`，`0` 原样显示）、
  `redisModeText(v)`（`standalone` → 「单机」，其他非空 → 「集群」）、
  `aofText(v)`（`0` → 「否」，其他非空 → 「是」）、
  `cpuText(v)`（可转数字则 `toFixed(2)`，否则原值）、
  `networkText(input, output)`（`{输入}kps/{输出}kps`）、
  `commandSeries(commandStats)`（`value` 转 number，失败按 0）、
  `memoryGaugeOption(info)`。
- **Rationale**: SPEC-007 §4.2 明确每条转换与空值语义；集中为纯函数可被 Vitest 逐条覆盖，
  避免模板里散落 `|| '—'` 把 `0` 误显示为「—」。
- **Alternatives considered**:
  - 模板内联三元表达式：`0` 与 `null` 易混，E-10 与数据契约难以稳定通过。
  - 直接使用后端原文：不满足运行模式/AOF/CPU 的用户可读转换。

## R-09 缓存图表与空状态

- **Decision**: 使用 `@vben/plugins/echarts` 的 `EchartsUI` + `useEcharts`；命令统计饼图与内存仪表盘
  各放在带 `data-testid` 的容器内；`commandStats=[]` 时命令统计容器渲染「暂无数据」且不挂载
  `EchartsUI`，内存图表仍渲染；接口失败时整页只显示后端 `msg` 原文，不渲染信息表与图表。
- **Rationale**: A-07 以 `canvas` 数量与尺寸判定；E-09/E-11 要求失败与空统计下不出现空图表。
- **Alternatives considered**:
  - 用 antdv 的 `Progress` 替代仪表盘：A-07 明确要求 `canvas`，不满足。
  - 空数据也挂载 ECharts：会产生 `canvas`，与 E-11 的 `canvas=0` 冲突。

## R-10 设备类型与时间格式

- **Decision**: 设备类型用既有 `useDict('sys_device_type')` 与 `dictLabel`，字典缺项时回退原值；
  登录时间用 `dayjs(loginTime).format('YYYY-MM-DD HH:mm:ss')`，`loginTime` 按 epoch 毫秒处理。
- **Rationale**: 字典 `pc` 的标签为「PC」，符合 A-01/Golden Sample；Packet §4.1 规定展示格式与精度。
- **Alternatives considered**:
  - 自建 `pc → PC` 映射：会绕过字典配置，后续新增设备类型需改代码。
  - 直接渲染原始毫秒数：不满足数据契约。

## R-11 敏感字段与错误处理

- **Decision**: 页面不 `console.log` 行数据；不写 `localStorage`/`sessionStorage`；不增加埋点；
  请求失败由既有拦截器展示 `msg`，页面 `catch` 只维护本地状态，不打印响应体；
  批量失败原因取后端 `msg` 或请求层统一网络错误文案。
- **Rationale**: SPEC-007 §5 与 Constitution IX 明确脱敏要求；A-05/E-06 需要展示失败原因但不要求原文响应。
- **Alternatives considered**:
  - 调试期打印整行便于排障：会把 `tokenId`/`ipaddr` 写入控制台，违反 Packet。

## R-12 菜单组件名与 404 行为

- **Decision**: 新建文件严格匹配后端 `component`：`monitor/online/index.vue`、`monitor/admin/index.vue`、
  `monitor/cache/index.vue`、`monitor/snailjob/index.vue`；不新增静态路由、不改路由框架。
- **Rationale**: 动态路由按 `import.meta.glob('../views/**/*.vue')` 的文件键解析组件名；文件缺失才回退
  `ComingSoon`。无权限时后端不返回菜单，直接访问即 404（E-14/E-15），与现有守卫一致。
- **Alternatives considered**:
  - 在 `router/routes` 中注册静态路由：会绕过权限菜单，越权直达不再 404。
  - 用 `Admin` 大写目录名：Windows 不敏感、Linux 构建敏感，按后端 `component` 的小写目录更稳。

## R-13 评测与证据

- **Decision**: 新增 `specs/evals/REQ-20261111-007/cases.yaml`、`scripts/evals/seed_spec007.sh` 与
  `frontend/tests/e2e/spec007-assertions.spec.ts`；E2E 使用既有登录助手与 5666 预览；
  在线会话由夹具通过两次登录创建，`tokenId` 用例内动态读取；E2E 断言与 `pageerror` 计数写入用例。
- **Rationale**: 仓库既有评测执行器支持认证头与 `EVAL_*` 占位；沿用可重复 seed 的夹具模式，
  避免写死会变化的 `tokenId`。
- **Alternatives considered**:
  - 直接调用 `specs/evals/run.py`：不支持认证头与占位替换，认证用例会 401。
  - 在用例里写死会话编号：两次登录生成的 token 每次都不同，不可重复。
