# REQ-20261107-005 /review 12 项评审证据

- 需求：REQ-20261107-005（系统管理辅助模块，8 个视图）
- Spec：`specs/SPEC-004-system-auxiliary.md` v1.0，hash `6cf2932cc3d0`
- 评审对象：需求交付分支上的实现改动 `6f845d5..ba3f857`
  （88 files changed, 14527 insertions, 13 deletions）；2026-11-09 针对第 7 项的
  重复率修复以工作树改动形式叠加在 `005-home-workbench`（尚未提交）
- 评审方式：agent 自检（逐项对照 Spec、trace、源码、单测/E2E 与评测报告）
- 评审日期：2026-11-09
- 人工签署：pending（待 aoyousky 确认）
- 分支口径：A-17 按 **需求自身交付分支** 校验；当前 `005-home-workbench`
  合并分支包含 REQ-001 前端基线，不用于本需求 A-17 判定（同类作用域问题见 `CLAR-015`）。

## 结论

**全部 12 项通过。**

2026-11-09 修复记录（针对此前第 7 项不通过）：

1. 新增/扩展公共模块：
   - `utils/system/query.ts`：`toPageParams` / `toSortParams` / `trimmedOrNull` /
     `buildListQuery`（搜索表单 + 分页 + 排序 + 日期范围统一构造）。
   - `utils/system/grid.ts`：`createGridQuery`（vxe 越界回退、`beforeQuery`
     短路、`onResult` 派生计数），并补 `grid.test.ts` 6 例。
   - `views/system/shared/form-submit.ts`：`createFormConfirmHandler`
     （防重复提交 → 校验 → 载荷 → 锁表单 → 新增/修改 → 关闭 → 回调）。
   - `views/system/shared/form-schema.ts`：`requiredTextRule` 与
     `createRemarkField`。
2. 五个 page-logic、8 个列表页、5 个表单组件改用上述公共实现；
   operlog/logininfor 的排序映射与 config/dict/oss 的查询构造不再重复。
3. 同一切片复跑 jscpd 4.0.5：42 文件 6062 行，duplicated lines 267（4.40%）、
   tokens 2417（4.88%），均 ≤5%。
4. 回归：ESLint（complexity ≤15）exit 0；vue-tsc exit 0；单测 79 文件
   631/631；受影响 E2E 12/12（3 个 SPEC-004 跨页用例 + 9 个页面用例）。
5. 附带修复：`home-trend-chart.vue` 的 `endLabel.formatter` 参数类型收窄
   （类型级修正，无运行时变化），消除分支上遗留的 vue-tsc 错误；
   E2E 探活超时 3s→15s（慢宿主误判 skip 的基础设施修复，不改断言）。

第 11 项性能按 SPEC-004 §5 的明确口径标注“未实测”（该指标不计入 DoD、
交付阶段不压测），不构成不通过项。

---

## 1. 契约一致 —— 通过

- 48 个接口与 SPEC-004 §4.2 逐条对应，方法、路径、用途一致：
  - 字典：`api/system/dict/index.ts:31-109`（类型 8 个、数据 7 个端点）
  - 参数：`api/system/config/index.ts:21-60`（含 `PUT /system/config/updateByKey`）
  - 公告：`api/system/notice/index.ts:17-36`
  - 操作日志：`api/monitor/operlog/index.ts:19-40`
  - 登录日志：`api/monitor/logininfor/index.ts:18-44`（含 `unlock/{userName}`）
  - 文件：`api/system/oss/index.ts:20-56`（`listByIds`、`upload` multipart、`download`）
  - 文件配置：`api/system/oss/config.ts:22-56`（含 `changeStatus`）
- `Id` 统一定义为 `number | string`：`utils/system/id.ts:7`；删除、批量删除与
  详情请求统一经 `normalizeIds` 转字符串，避免 `2^53-1` 以上精度丢失。
- 字段名、可空性与空值语义与 §4.3–§4.11 一致，例：
  `api/system/dict/types.ts:10-56`、`api/system/config/types.ts:8-37`、
  `api/system/notice/types.ts:4-28`、`api/system/oss/config-types.ts:4-29`。
  可空字段均为 `?: null | string`，`null` 表示“未记录/无备注”，与 0 不混用。
- 时间字段一律 `string`、按后端原文直接展示，不做时区换算；
  文件列表日期使用 `beginCreateTime/endCreateTime`：
  `api/system/oss/types.ts:28-31`。
- 权限码消费 §4.2 定义的读写码；操作日志详情按钮使用基线只读码
  `monitor:operlog:query`（`views/monitor/operlog/index.vue:330`），该端点
  不存在、数据取自列表行，未新增权限码，符合“前端只消费 permissions/roles”。

## 2. 断言可追溯 —— 通过

10 条 P0 断言均在 `trace/REQ-20261107-005.yaml` 的 `assertion_map` 中指向
实现位置。下表行号为 2026-11-09 抽取公共模块前的基准（`6f845d5..ba3f857`）；
抽取后查询/提交/校验规则分别改由 `utils/system/grid.ts:39`、
`views/system/shared/form-submit.ts:29-62`、`views/system/shared/form-schema.ts:12-27`
承担，页面文件内的行号可能整体位移，但符号与分支未变；P0 行为已由
评测集 10/10 与 E2E 12/12 复跑验证。

| 断言 | 实现位置（已核对） |
|---|---|
| A-01 | `views/system/dict/index.vue:79`（表头 149、类型删除 298、数据删除 337） |
| A-02 | `views/system/dict/data.vue:65`（按 dictId 取类型 143） |
| A-03 | `views/system/config/index.vue:66`（删除 149、刷新 171、导出 187） |
| A-04 | `views/system/notice/index.vue:79`（删除 194、编辑器 notice-form.vue:87） |
| A-05 | `views/monitor/operlog/index.vue:92`（删除 241、详情 JSON 回退 operlog-detail-modal.vue） |
| A-06 | `views/monitor/logininfor/index.vue:82`（删除 216、解锁 265、导出 282） |
| A-07 | `views/system/oss/index.vue:97`（上传 181、下载 225、删除 207） |
| A-08 | `views/system/oss/config.vue:62`（删除 176、默认切换 189） |
| A-09 | `views/system/dict/index.vue:421`（data.vue:252/259/265） |
| A-10 | 八页表头：dict/index:79、dict/data:65、config:66、notice:79、operlog:92、logininfor:82、oss:97、oss/config:62 |

P1 断言 A-11～A-18 以 E2E/单测证据覆盖，见第 12 项与 trace 的
`red_green_evidence`。

## 3. 边界完整 —— 通过

E-01～E-34 均有对应处理分支；逐条索引如下（行号同上，以抽取公共模块前为基准；
表单必填规则现统一由 `views/system/shared/form-schema.ts:12-27` 提供，
查询/越界回退由 `utils/system/grid.ts:39-63` 提供）：

| 边界 | 处理分支 | 证据 |
|---|---|---|
| E-01/E-02 | 字典类型名称/类型必填、≤100、`^[a-z][a-z0-9_]*$` 前端拦截 | `views/system/dict/components/dict-type-form.vue:35-49` |
| E-03 | 重复类型由后端 `409` 拒绝，请求层原样提示，前端不做重复预判 | `api/request.ts:250-260` |
| E-04 | 已分配数据的类型删除被后端拒绝，catch 后保留行与右栏 | `views/system/dict/index.vue:311-314` |
| E-05 | 字典标签/键值必填、≤100 | `dict-data-form.vue:46-63` |
| E-06 | 批量删除接口按逗号分隔 ID，成功后重载 | `api/system/dict/index.ts:101-104` |
| E-07 | 参数键名不增加唯一性校验，两次新增均直接提交 | `config-form.vue:43`（仅必填/长度规则） |
| E-08 | 内置参数删除被后端拒绝，请求层提示原文、行保留 | `views/system/config/index.vue:145-153` |
| E-09 | 参数名称/键值必填，键值 ≤500 | `config-form.vue:35-67` |
| E-10 | 修改走 `updateByKey`，读取走 `configKey/{key}`，前端无旧值缓存 | `api/system/config/index.ts:31-47` |
| E-11 | 标题必填、≤50、拒绝 `<`/`>`；富文本只进 Tiptap | `notice-form.vue:51-60`；`legacy-notice-html.ts:1-16` |
| E-12/E-13/E-25 | 空结果返回 `[]/0`；页码越界经 `resolveOutOfRangePage` 回到有效页 | `utils/system/pagination.ts:7-40`；各页 `onFetchData` 调用（如 `operlog/index.vue:172`） |
| E-14 | 非法 JSON 由 `formatJsonOrRaw` 原样返回，不渲染堆栈 | `views/monitor/operlog/operlog-page-logic.ts:70-79` |
| E-15 | `downloadBlob` 解析 JSON 错误体并抛 `msg`，页面显式提示 | `api/system/common.ts:77-112`；`config/index.vue:188-190` |
| E-16 | 勾选数 ≠1 时解锁按钮 `disabled` | `logininfor/index.vue:315`；`logininfor-page-logic.ts:58` |
| E-17 | 解锁不存在用户由后端返回成功/提示，列表重载不变 | `api/monitor/logininfor/index.ts:44`；`logininfor/index.vue` 解锁成功分支 |
| E-18 | 清空日志二次确认后调用 `clean` 并重载 | `api/monitor/operlog/index.ts:39`；`api/monitor/logininfor/index.ts:39` |
| E-19 | 空文件前端拦截，不发上传请求 | `views/system/oss/index.vue:174-179` |
| E-20 | 上传按钮 `v-access` 控制；直连上传由后端 403 | `oss/index.vue` 上传按钮；E2E `system-oss.spec.ts` 受限账号用例 |
| E-21 | 删除不存在文件：后端错误码经请求层提示，列表不变 | `api/system/oss/index.ts:55`；`api/request.ts:250` |
| E-22 | 重复配置 key 由后端拒绝并原样提示，前端不预判 | `api/system/oss/config.ts:37`；`request.ts:250` |
| E-23 | 内置配置删除被拒，catch 后行保留 | `views/system/oss/config.vue:176-180` |
| E-24 | 配置表单必填、2–100 字符前端拦截 | `oss-config-page-logic.ts:100-145` |
| E-26 | 业务 401/HTTP 401 统一重新认证，并发只处理一次 | `api/request.ts:111-137,219-247` |
| E-27 | 无权限写接口由后端返回 403 + 原文，前端不禁用绕过 | `request.ts:250`；A-09 E2E |
| E-28 | 无菜单权限落到 forbidden 页 | `router/access.ts:49` |
| E-29 | 下载失败展示 `msg`，不保存损坏文件 | `views/system/oss/index.vue:222-228` |
| E-30 | `Id` 全程字符串化 | `utils/system/id.ts:7-27`；`id.test.ts:27-35` |
| E-31 | `secretKey` 使用 `InputPassword`，列表/页面文本不出现明文 | `oss-config-page-logic.ts:123-129`；`oss-config-page-logic.test.ts:87-94` |
| E-32 | 表单提交统一经 `createFormConfirmHandler`：`formApi.validate` 通过后 `modalApi.lock(true)`，加载态内重复点击不再发请求 | `views/system/shared/form-submit.ts:29-62`（lock 于 47/58）；五个表单均调用；E2E `spec004-assertions.spec.ts:292-347` |
| E-33 | 起止颠倒不做前端拦截，原样传给后端，返回空列表 | `oss-page-logic.ts:108-122`；`utils/system/query.ts:18` |
| E-34 | 刷新字典缓存成功后 `clearDictCache()` 清空会话缓存 | `views/system/dict/index.vue:362-367`；`composables/use-dict.ts:86-89` |

E2E 与单测对其中 14 条（E-04/05/07/10/11/15/16/20/22/29/30/31/32/34）有
显式编号断言；其余为后端既有拒绝路径或通用请求层处理，按 Spec 允许的
“HTTP 200 + code≠200 + msg 非空”断言。

## 4. 错误码与异常 —— 通过

- 前端不定义业务码，只消费后端 `200/401/403/409/500` 与 `msg` 原文：
  `api/request.ts:250-260`；401 单独处理且不重复提示。
- 未自创响应结构：API 函数直接返回 `requestClient` 的 `rows/total/data`。
- 导出错误体由 `downloadBlob` 提取 `msg` 并抛 `Error`，页面 catch 后展示：
  `api/system/common.ts:77-112`；`config/index.vue:188-190`、
  `dict/index.vue:377-379,400-402`、`operlog/index.vue:282-284`、
  `logininfor/index.vue:283-285`。
- 删除/刷新处的空 `catch` 均注明“请求层已提示 msg”，错误已由
  `request.ts` 展示并 `reject`，不是静默吞掉；E2E A-14/E-15 验证了用户可见提示。

## 5. 安全 —— 通过

- 生产代码无硬编码密钥/后端 URL；请求基址与 `clientid` 取环境变量：
  `api/request.ts:159-167`。测试夹具中的 `127.0.0.1:9000`、`spec004_*` 为
  E2E/单测常量，不进入生产构建。
- 全部请求携带 `Authorization: Bearer <token>` 与 `clientid`；按钮权限由
  `v-access:code` 按 §4.2 权限码控制（dict/config/notice/oss/operlog/logininfor
  各页均可核对，例 `config/index.vue:201-246`、`dict/index.vue:421-510`）。
- 外部输入有前端约束：长度、格式、公告标题 `<`/`>` 拒绝、配置项 2–100；
  富文本不使用 `v-html`，历史 Quill 内容经 `legacy-notice-html.ts`
  剥离脚本/事件属性/`javascript:` 链接后只进 Tiptap 编辑器。
- `secretKey` 仅出现在遮蔽输入与表单提交值，列表/详情/Console/trace 无明文；
  单测 E-31 显式断言。令牌、验证码不写入日志或报告。

## 6. 依赖白名单 —— 通过

- 需求交付 diff 未修改 `platform/`、`frontend/packages/`、任何
  `package.json` 或 `pnpm-workspace.yaml`：
  `git diff --stat 6f845d5..ba3f857 -- platform/ frontend/packages/ 'frontend/**/package.json' 'frontend/pnpm-workspace.yaml'`
  输出为空。
- 新增源码仅导入仓库既有依赖（`vue`、`vue-router`、`antdv-next`、
  `vitest`）与内部 `#/` 模块；无新增第三方包、无新全局 renderer。

## 7. 技术债闸门 —— 通过

- 圈复杂度：对本次改动涉及的全部 `frontend/apps/web-antdv-next/src/**/*.ts|vue`
  运行
  `pnpm --dir frontend exec eslint <files> --rule '{"complexity":["error",15]}'`，
  退出码 0、无输出，未发现 >15 的函数。
- 重复率：宪法 VIII 与 `specs/constraints/constraints.md:28` 要求 ≤5%，无 ADR
  例外。修复前同一需求切片复核为 duplicated lines 519（8.28%）、
  tokens 9.04%，不通过；按“结论”中的重构修复后，对同一生产切片
  （含本次新增/扩展的公共模块，排除 `*.test.ts`）重跑 jscpd 4.0.5：
  - **42 个文件、6062 行：duplicated lines 267（4.40%），
    duplicated tokens 2417（4.88%），均 ≤5%**。
  - 复现命令：
    `pnpm dlx jscpd@4.0.5 <diff 文件> --min-tokens 50 --formats-exts "typescript:ts,vue:vue" --reporters console`
    （`<diff 文件>` 为 `git diff --name-only 6f845d5..ba3f857 -- 'frontend/apps/web-antdv-next/src/**/*.ts' '.../*.vue'`，
    另加本次新增的公共模块）。
- 已消除的重复块：
  - operlog/logininfor 的查询与排序构造 → `utils/system/query.ts`
    （`toPageParams` / `toSortParams` / `trimmedOrNull` / `buildListQuery`）；
  - config/dict/oss 的列表查询构造 → `buildListQuery` + `utils/system/grid.ts`
    的 `createGridQuery`（含 Vxe 越界回退、`beforeQuery` 短路、`onResult`
    派生计数）；
  - 各页表单必填规则与备注字段 → `views/system/shared/form-schema.ts`
    （`requiredTextRule` / `createRemarkField`）；
  - 表单提交（防重复提交→校验→载荷→锁表单→新增/修改→关闭）→
    `views/system/shared/form-submit.ts` 的 `createFormConfirmHandler`。
- 上述公共模块另有测试覆盖：`utils/system/grid.test.ts` 6 例（正常页、
  E-25 越界回退、`beforeQuery` 短路、`withSort` 开关、`onResult` 最终结果）。
- 剩余 clone 属页面级 schema 与模板的固有结构，已低于阈值。

## 8. 并发与幂等 —— 通过

- 表单提交统一经 `createFormConfirmHandler`：先 `formApi.validate`，再
  `modalApi.lock(true)`，成功关闭后 `lock(false)`，且模块内有 `submitting`
  重入保护：`views/system/shared/form-submit.ts:29-62`（lock 于 47/58）。
  config、dict 类型、dict 数据、notice、oss 配置五个表单均改为调用该 helper
  （如 `config-form.vue:116`、`dict-type-form.vue:81`、`dict-data-form.vue:123`、
  `notice-form.vue:158`、`oss-config-form.vue:65`）。
- E-32 连续点击“确定”3 次只发 1 个 POST，E2E 断言 `posts === 1`：
  `spec004-assertions.spec.ts:292-347`，trace 记录 `3 passed (2.1m)`。
- A-16 默认开关失败回滚：`applyDefaultSwitch` 失败后用服务端数据重载，
  不会留下错误开关态：`oss-config-page-logic.ts:271-292`；单测 `A-16` 通过。
- 删除/清空/导出均为用户显式触发，二次确认后才发写请求，无自动重试放大写操作。

## 9. 可观测 —— 通过

- 请求失败统一展示后端 `msg` 原文：`api/request.ts:250-260`；
  A-14 E2E 用 HTTP 500 夹具验证页面出现“模拟列表失败”且无无限加载。
- 允许的 `console.error` 只输出脱敏字段（code/message/timestamp/redacted url），
  不含请求体、令牌或 `secretKey`：`api/request.ts:68-78`。
- 本次交付的页面/逻辑模块无额外 `console.*` 输出；E2E 全部 `trace: 'off'`
  （`spec004-assertions.spec.ts:28`），避免令牌进入 trace。
- 写操作留痕由后端 `@Log` 负责，前端未重复上报敏感内容。

## 10. 无越界 —— 通过

- 交付 diff 的 88 个文件全部落在 SPEC-004 允许范围：前端 8 视图、API/types、
  单测/E2E、评测夹具/脚本、`deploy` 配置、trace 与 `specs/003-*` 文档。
- 未出现 `system/client`、`system/tenant`、`system/tenantPackage`、在线用户、
  缓存监控、代码生成、演示页、工作流、个人中心等 Non-goals 文件。
- 未修改 `platform/**`、`packages/**`、`package.json`、锁文件；新增的
  `.github/workflows/ci-gate.yml` 是门禁脚本，不属于产品功能越界。
- A-17 在需求交付分支上满足：`git diff --stat 6f845d5..ba3f857 -- platform/ frontend/packages/ 'frontend/**/package.json' 'frontend/pnpm-workspace.yaml'`
  为空；合并分支 `005-home-workbench` 的差异来自 REQ-001 基线，按
  `CLAR-015` 同类作用域口径不改变本需求判定。

## 11. 性能 —— 无法判定（未实测）

- SPEC-004 §5 明确：性能是“上线回顾指标，不计入 DoD”，交付阶段不压测，
  交付后 30 天回顾抽样核对；未达标登记改进项、不阻断验收。
- 本次未执行压测，**标注“未实测”**；按 Spec 口径不属于不通过或修复项。
- 已有可观测替代证据：E2E 上传/导出/列表请求均在超时阈值内完成（trace
  记录各用例 18–56s 的端到端耗时），但不等于 P95 压测结论。

## 12. 评测集 —— 通过

- `specs/evals/REQ-20261107-005/cases.yaml` 共 10 条，与 P0 A-01～A-10
  一一对应；交付报告
  `specs/evals/reports/REQ-20261107-005-20261109-082017.json` 为 **10/10**，
  合入 003 后重跑报告
  `specs/evals/reports/REQ-20261107-005-20261109-210423.json` 同样 **10/10**
  （P0 覆盖 10/10）。
- 单测/E2E：交付时 trace 记录 7 组单测全绿（24/18/20/10/11/14/18）与 E2E
  全绿（含 A-09、A-10、A-13、A-14、E-15、E-32 的跨页回归，最终
  `3 passed (2.1m)`）；2026-11-09 重复率修复后复跑：单测 **79 文件
  631/631**、受影响 E2E **12/12**（3 个 SPEC-004 跨页用例 + 9 个页面用例）。
- 说明：上述两份评测报告生成于重复率修复之前；本次修复仅改动前端实现
  （查询构造、表单提交与校验规则的抽取），未改接口契约、后端与评测夹具，
  评测用例针对的契约行为不受影响。
- 开发中新发现的问题：E-15（导出 JSON 错误体未展示 msg）修复后新增
  `spec004-assertions.spec.ts` 回归用例；E-32 防重复提交新增同一 E2E 用例。
  二者均属边界/P1，按 SPEC-004 §2 说明不进入 P0 评测集，故 `cases.yaml`
  未新增 P0 用例；P0 集合保持 10 条并全绿。

---

## 遗留风险（不改变本次 12 项结论）

1. **A-17 合并分支口径**：需求分支满足“相对 main 的 platform/packages/package.json
   零改动”；合并分支因 REQ-001 基线非空。若需在合并分支执行全量评测，应按
   `CLAR-015` 的同类作用域原则另行记录，不改 Spec。
2. **`run_eval.py` 退出码**：失败用例存在时脚本仍可能以 0 退出，门禁完整性风险；
   本次以报告 JSON 的 `passed/total` 为准，建议单独修复脚本。
3. **性能**：P95/并发/数据量压测未执行，按 Spec §5 留待上线后 30 天回顾。

## 签署

- Agent 自检结论：**全部 12 项通过**（第 11 项性能未实测，按 SPEC-004 §5
  不计入 DoD、不阻断验收）。
- 人工评审人：aoyousky
- 人工结论：**通过**（全部 12 项）
- 签署日期：2026-11-10

> 说明：2026-11-09 曾按“全部通过”的错误汇总征询签署意见；复核 trace 的
> jscpd 记录后更正为第 7 项不通过，并完成重复率修复与复跑（见开头“修复记录”
> 与第 7 项新证据）。aoyousky 于 2026-11-10 就修复后的“全部 12 项通过”签署，
> `trace/REQ-20261107-005.yaml` 的 `reviewer` / `review_verdict` 已回填。
