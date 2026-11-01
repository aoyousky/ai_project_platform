# P1 Spike 验证报告：Vben Admin 5.7.0 适配 RuoYi-Vue-Plus 后端

- 日期：2026-11-01
- 范围：可行性验证（throwaway spike），**未改动仓库 `frontend/`**
- 组件：Vben `v5.7.0` + `apps/web-antdv-next`（antdv-next 1.3.0）+ pnpm 10.33.4
- 后端：本仓库 `platform/`（RuoYi-Vue-Plus 5.6.2 派生），Docker 本地栈 `awp-backend` 8080
- Spike 目录：`D:\workstation\_spike\vben-5.7.0`（临时，不并入仓库）

## 1. 结论

**通过。** Vben 5.7.0 可以在不改 `packages/**` 框架代码的前提下，通过约 9 个应用层文件适配
RuoYi-Vue-Plus 后端，并已用无头浏览器完成端到端验证：

| 验证项 | 结果 | 证据 |
|---|---|---|
| `pnpm install`（npmmirror，Corepack 自动切 pnpm 10.33.4） | 通过，约 7m40s | — |
| `pnpm -F @vben/web-antdv-next typecheck`（vue-tsc） | 通过，0 error | — |
| `pnpm -F @vben/web-antdv-next build` | 通过，约 44–51s，dist 5.4MB | `dist.zip` |
| dev server 启动（Vite，端口 5666） | 通过，`/` 200，`/api` 代理到 8080 | `ui/01-login.png` |
| RSA+AES 加密登录 + 图形验证码 | 通过，登录后进入 `/index` | `ui/02-home.png` |
| 后端 `getRouters` 菜单渲染 | 通过，6 个一级菜单全部出现 | `ui/02-home.png` |
| 后端路由转 Vue Router | 48 节点 / 39 叶子全部可解析，0 重名，0 `noRedirect` 残留 | `converted-routes.json` |
| 外链菜单内嵌 | 侧栏出现「PLUS官网」，点击进 `/iframe/<slug>`，渲染 `iframe[src=https://gitee.com/dromara/RuoYi-Vue-Plus]` | `ui/08~09*.png`、`ui/iframe-check.json` |
| 页面级 CRUD（样例页 `system/post`） | 新增 → 列表出现 → 删除 → 列表消失，全部通过 | `ui/03~07*.png` |
| 浏览器控制台错误 | 仅"未移植页面组件缺失"告警，无运行时异常 | `ui/errors.json` |

## 2. 适配层改动清单（应用层，共 9 个文件 + 1 个样例页）

| 文件 | 作用 |
|---|---|
| `apps/web-antdv-next/.env.development` | 端口、`VITE_GLOB_API_URL=/api`、`clientId`、RSA 公私钥、加密开关 |
| `src/api/core/ruoyi-crypto.ts` | AES-256-ECB/PKCS7 + RSA 封装（crypto-js / jsencrypt） |
| `src/api/request.ts` | `clientid` 请求头；响应解密拦截器；`successCode: 200`；分页响应体兼容；错误文案取 `msg` |
| `src/api/core/auth.ts` | `/auth/login`（加密体 + `encrypt-key` 头）、`/auth/code`、`/auth/logout`、`getAccessCodesApi` |
| `src/api/core/user.ts` | `/system/user/getInfo` → Vben `UserInfo`（`nickName`→`realName`、`homePath:'/index'`） |
| `src/api/core/menu.ts` | `/system/menu/getRouters` → `RouteRecordStringComponent[]` 转换；外链合成 `/iframe/...` + `IFrameView` |
| `src/router/access.ts` | `layoutMap`：`Layout`→`BasicLayout`、`ParentView`→占位、`InnerLink`→`IFrameView` |
| `src/router/routes/modules/home.ts` + `src/views/index.vue` | RuoYi 前端常量路由 `/index`（不在 getRouters 中） |
| `src/preferences.ts` | `accessMode: 'mixed'`（后端菜单 + 前端常量路由）、`enableRefreshToken: false` |
| `src/directives/access.ts` + `bootstrap.ts` | 覆盖 `v-access` 指令，支持 RuoYi 通配符权限码 `*:*:*` |
| `src/views/_core/authentication/login.vue` | 接入后端图形验证码，去掉 mock 账号 |
| `src/api/system/post/index.ts` + `src/views/system/post/index.vue` | 样例页（VxeGrid + Modal + Form） |

样例页 `system/post` 约 260 行，覆盖搜索表单、分页列表、字典渲染、新增/编辑弹窗、批量删除，
是 37 个待移植页面中"标准 CRUD"的代表。

## 3. 发现的契约差异（都已在 spike 中解决，需写入 ADR-002）

1. **分页响应体不同**：RuoYi 是 `{code,msg,rows,total}`，数据不在 `data` 字段。
   Vben 默认拦截器只取 `data` → 列表全空。适配：`dataField` 用函数，检测 `rows` 存在时返回 `{rows,total}`。
2. **外链菜单会让整张路由表崩掉**：后端 `getRouters` 含 `PLUS官网`（`path` 为完整 URL），
   Vue Router `addRoute` 直接抛错。处置（CLAR-001 裁决）：转换阶段合成内部路径
   `/iframe/<slug>-<hash>` + `component: 'IFrameView'`，真实 URL 写入 `meta.iframeSrc`，
   由 `IFrameRouterView` 内嵌渲染。**实现要点：`meta.link` 必须省略**——Vben 的
   `useNavigation` 一见 `link` 就 `window.open` 新窗口，菜单 href 也会变回外链本身，内嵌失效。
   已验证：侧栏可见、点击进 `/iframe/gitee-com-dromara-ruoyi-vue-plus-hzp6uu`、iframe src 正确。
   **残留风险**：目标站点若设 `X-Frame-Options` / CSP `frame-ancestors`（gitee.com 即如此），
   iframe 内显示拒绝图标；属站点侧限制，需在菜单运营规范中提示。
3. **`redirect: "noRedirect"`** 是 RuoYi 占位值，必须丢弃，否则会跳到字面量路径。
4. **`hidden` / `noCache` 语义相反映射**：`hidden`→`meta.hideInMenu`，`noCache`→`!keepAlive`。
5. **`/index` 是前端常量路由**，不在后端菜单里 → `accessMode` 必须用 `mixed`，不能只用 `backend`。
6. **权限码通配符**：超管权限是 `*:*:*`，Vben `hasAccessByCodes` 是精确匹配 → 超管看不到任何按钮。
   适配：应用层覆盖同名 `v-access` 指令。
7. **响应加密开关**：本环境 `/auth/code` 响应未加密、`/auth/login` 请求必须加密；拦截器按
   `encrypt-key` 响应头是否出现来决定是否解密，两种模式都兼容。
8. **登录页多余入口**：Vben 自带"手机号登录 / 扫码登录"标签，RuoYi 没有对应能力，移植时需移除。
9. **路由 name 兼容**：RuoYi 生成的 `User-auth/role/:userId131` 这类含 `/`、`:` 的 name
   在 Vue Router 5 下可正常工作；47 个节点无重名。

## 4. 依赖 / 许可证 / CVE（沿用本次会话已采集数据）

- `@vben/web-antdv-next` 依赖闭包：47 个包（29 个外部直接依赖 + 18 个内部 `@vben/*`）。
- `pnpm audit`（全仓）：153 条告警；运行时相关 36 条（16 high / 18 moderate / 2 low）。
- 当前 plus-ui 基线：33 条（1 critical / 10 high）——**Vben 方案在 CVE 面上不劣于现状**。
- 许可证注意项：
  - `@commitlint/*` 系 GPL（仅 devDependency，不进产物）
  - `lightningcss` MPL-2.0（构建期）
  - `zod-defaults` 许可证为 Unknown（运行时，来自 form-ui 链）
  - `node-forge` 双许可（BSD/GPL 可选）
- 关键新增运行时依赖：`antdv-next`、`crypto-js`、`jsencrypt`、`vxe-table`、`@vben/*` 全家桶
  → **必须在 `specs/constraints/allowlist.md` §1.2 增补**（当前白名单只有 Element Plus/vxe-table 等）。

## 5. 工作量估算（结合样例页实测）

| 工作项 | 估算 |
|---|---|
| 适配层（本 spike 已完成，含测试与文档） | 1.5–2 人日 |
| 标准 CRUD 页面移植（system/monitor 等 24 页左右） | 3–4 人日 |
| 工作流页面（流程设计器 BPMN、动态表单、任务列表 9 页） | 4–6 人日（最大不确定项） |
| 工具/演示页 + 首页 | 1–2 人日 |
| 回归、评测集、契约测试、trace | 2–3 人日 |
| **合计** | **约 12–17 人日** |

## 6. 未验证 / 风险

- 未接入 CI（Vben 的 Turborepo + Changeset 流程需裁剪，只要 `apps/web-antdv-next`）。
- 未验证 keep-alive 缓存、标签页、iframe/内嵌页的完整行为。
- 工作流设计器（bpmn-js / 动态表单）是框架替换后的最大工作量与风险点，建议 P2 单独 spike。
- `antdv-next` 是较新的独立仓库（1.3.0），生态成熟度低于 ant-design-vue；需关注发布节奏。
- 外链菜单改为 IFrameView 内嵌（已裁决并验证），但受目标站点 `X-Frame-Options` 限制；
  `v-access` 通配符为应用层补丁。

## 7. 下一步计划清单

1. ✅ **P2 — ADR-002**：已 Accepted（2026-11-01）；落地形态定为**整仓 subtree**。
2. ✅ **P2 — 白名单升版**：`allowlist.md` §1.2 已增补 antdv-next / crypto-js / jsencrypt / vxe-table /
   `@vben/*`；R8 锁文件条款已改为 `pnpm-lock.yaml`。
3. **P2 — 工作流专项 spike**：验证 bpmn-js、动态表单在当前后端接口下的迁移成本。
4. **P3 — Spec Packet**：以 `/spec-packet` 生成前端框架替换的可判定 Spec（A-xx/E-xx），
   覆盖登录、菜单、权限、分页契约、外链菜单策略。
5. **P4 — 实施**：按上下文逐页移植，先 system 后 workflow；每页保留 RED→GREEN 测试证据。
6. **P5 — 门禁**：`/spec-check` + `/review` + `/trace`，评测集与契约测试全绿后合入。

## 8. 复现方式

```bash
# 后端栈
cd deploy && docker compose up -d

# spike 应用
cd D:/workstation/_spike/vben-5.7.0
pnpm install --registry=https://registry.npmmirror.com
CI=1 pnpm -F @vben/web-antdv-next typecheck
CI=1 pnpm -F @vben/web-antdv-next dev        # http://localhost:5666

# 端到端 UI 验证（无头 Edge + Redis 取验证码）
cd D:/workstation/_spike/tools
node ui-login.mjs
```

产物：`D:\workstation\_spike\ui\*.png`、`body.txt`、`errors.json`、
`getRouters.json`、`converted-routes.json`。
