# Phase 0 Research：前端框架替换

**Date**: 2026-11-01 | **Plan**: [plan.md](./plan.md)

> 本文件只记录**影响计划与验收**的决策。已由 ADR-002 / CLAR-001 裁决的事项直接引用，不重新论证。

## R1 页面移植的分批与顺序

- **Decision**：分三批。
  1. **批次 A（本规格首批）**：适配层 + 首页 + 样例页 `system/post` + 同构标准 CRUD 页
     （`system/{user,role,menu,dept,dict,config,notice,log/*,oss,client}`、`monitor/*`、`tool/gen`、`demo/*`）。
  2. **批次 B**：工作流与任务（`workflow/*`、`task/*`，共 9 页）——前置条件是独立 spike 验证
     BPMN 设计器与动态表单。
  3. **批次 C**：租户页（多租户不启用，R2）保留菜单但页面按 403 提示处理，不移植。
- **Rationale**：批次 A 覆盖了绝大多数用户日常操作，且与 `system/post` 同构，移植成本可预测；
  批次 B 风险与成本最高（ADR-002 §6），不能拖住首批交付；批次 C 与"多租户不启用"红线一致。
- **Alternatives**：按菜单顺序线性移植（工作流会卡在中间）；一次性全量（风险集中，无法阶段性验收）。

## R2 富文本编辑器：quill 还是 tiptap

- **Decision**：用 Vben 内置的 tiptap（`@vben/plugins`），不引入 `@vueup/vue-quill`。
- **Rationale**：tiptap 已在 `packages/effects/plugins` 中，属白名单内、零新增依赖；quill 需新增白名单项，
  且在 plus-ui 中只为通知公告与富文本字段服务。
- **代价**：编辑器 UI 与产出 HTML 结构变化（ADR-002 C10）。历史 quill 内容带 `ql-align-*`、`ql-size-*`
  等专用类，tiptap 渲染时会丢失居中与字号——**必须补一段兼容样式**（应用层 `src/styles/quill-compat.css`），
  否则是可见的排版回退，不是"结构差异"。
- **回归范围（CLAR-002 第 4 项裁决）**：只人工回归"通知公告详情"与"含富文本字段的页面"两类，
  其余页面不逐页回归。
- **Alternatives**：保留 quill（新增依赖 + 白名单审批，但保持内容产出完全一致）。

## R3 CI 与部署脚本切换到 pnpm 的时机

- **Decision**：与 `frontend/` 落点同一次提交完成，分两步：
  1. 提交 1（subtree 落地）：`frontend/package.json` 改为 Vben 根，`pnpm-lock.yaml` 入库，
     CI `frontend` job 改 `corepack enable && pnpm install --frozen-lockfile && pnpm -F @vben/web-antdv-next build`，
     `deploy/prepare.sh` 同步改为 pnpm。
  2. 期间 `package-lock.json` 立即删除，禁止 npm 再生成（R8）。
- **Rationale**：锁文件与 CI 命令必须原子切换，否则会出现"CI 用 npm 装 pnpm workspace"的确定性失败。
- **Alternatives**：先保留 npm 兼容层（双锁文件）——直接违反 R8，不采纳。

## R4 E2E 框架

- **Decision**：Playwright（`@playwright/test`），浏览器用系统 Edge/Chrome channel，不下载浏览器二进制。
- **Rationale**：spike 已用 `playwright-core` + 系统 Edge 跑通全链路（含 Redis 取验证码）；
  `@playwright/test` 提供断言、重试、报告，适合作为门禁。
- **Alternatives**：Vitest Browser Mode——Vben 未预置，且验证码/跨页导航场景不如 Playwright 成熟。
- **注意**：E2E 依赖本地 Docker 后端栈与 Redis；CI 未起栈时该 job 标记为可选，本地门禁必跑。

## R5 测试落点与命名

- **Decision**：单元/组件测试与被测文件同目录（`*.test.ts`），E2E 放 `frontend/tests/e2e/*.spec.ts`。
  Vitest 配置沿用 Vben 根配置（`pnpm test:unit`）。
- **Rationale**：Vben 的 monorepo 以包为单位，同目录放置便于 `pnpm -F` 过滤运行；E2E 跨页面、跨包，独立目录。
- **Alternatives**：集中 `tests/unit/`——与 Vben 现有包结构冲突，`-F` 过滤失效。

## R6 "覆盖率 ≥70%" 在前端的映射

- **Decision**：宪章 VIII 的 domain 层 70% 映射为：**适配层文件（`src/api/core/**`）与移植页面组件
  的分支覆盖率 ≥ 70%**，由 Vitest coverage 统计并在 CI 校验；框架层 `packages/**` 不计入。
- **Rationale**：前端没有 domain 层；适配层是本次唯一"业务逻辑"集中地，页面组件是移植主要产物。
- **Alternatives**：只统计行覆盖率（易被空行拉高）；全仓统计（框架代码计入，指标失真）。

## R7 Vben 整仓 subtree 的落地与裁剪步骤

- **Decision**：
  1. `git subtree add --prefix=frontend vben-upstream v5.7.0 --squash`（或在临时 clone 后 `git read-tree`）；
  2. 删除 `apps/{web-antd,web-ele,web-naive,web-tdesign,playground,backend-mock}` 与 `docs/`；
  3. 根 `package.json` 删除对应 `build:*/dev:*` 脚本与 `changeset` 相关（保留 `pnpm-lock.yaml` 一致性）；
  4. `pnpm install` 重新生成锁文件后提交；
  5. 在 `frontend/PROVENANCE.md` 写明 tag、commit、已登记改动（裁剪清单）。
- **Rationale**：整仓保留 `packages/**` 才能保持与上游可比较、可 rebase；只裁 app 层风险最小。
- **Alternatives**：浅克隆只取 app（见 plan Complexity Tracking）。

## R8 外链 iframe 的安全属性

- **Decision**：iframe 使用 `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`，
  不加 `allow-top-navigation`；同时保留 `referrerpolicy="no-referrer-when-downgrade"`。
- **Rationale**：外链是后端配置的可信度较低内容；去掉顶层导航权限可防钓鱼跳转。
  注意 `allow-same-origin` 与 `allow-scripts` 同时开启会削弱隔离，但目标站点多为普通官网，权限过严会导致内容不可用。
- **代价**：极少数依赖 `window.top` 的站点会失效，由菜单运营方改配地址解决。
- **Alternatives**：完全沙箱（`sandbox=""`）——多数站点白屏；不设 sandbox——外链可劫持顶层导航。

## R9 令牌存储与多标签页登出

- **Decision**：沿用 Vben 默认的 `localStorage` 令牌存储 + `storage` 事件同步；登出时清空 accessStore
  并跳转登录页。`enableRefreshToken: false`（后端未提供刷新令牌接口）。
- **Rationale**：RuoYi 的令牌有效期由后端控制，前端不做静默刷新，401/`code=401` 走重新认证。
- **Alternatives**：改 httpOnly Cookie——需后端改造，违反"后端零改动"。

## R10 菜单图标的映射

- **Decision**：在 `src/api/core/menu.ts` 维护一张 `RuoYi 图标名 → iconify 名称` 的映射表
  （36 个已配置图标，如 `system`→`lucide:settings`、`monitor`→`lucide:activity`、`guide`→`lucide:book-open`）；
  命中不到的图标回退为 `lucide:circle`，并输出一次 `console.warn` 便于运营发现错配。
- **Rationale**：后端图标名是 plus-ui 的 SVG 资产名，Vben 用 iconify 字符串；不映射会导致全部菜单无图标
  （spike 中已观察到此现象），属可见保真度问题。
- **Alternatives**：把 plus-ui 的 36 个 SVG 搬进 Vben 并注册本地图标集——保真最高，但需新增资产与注册代码，
  且图标风格与 antdv-next 不一致。
- **已裁决（CLAR-002 第 3 项）**：采用本方案，**不搬运 SVG**；图标风格由 plus-ui 线性图标切到 lucide，已获认可。

## R11 验证码与登录节流

- **Decision**：登录页每次进入、每次失败后都请求 `/auth/code` 刷新验证码；提交时禁用按钮防重复点击。
  E2E 通过 Redis 读验证码（仅本地测试环境，不进入产品代码）。
- **Rationale**：与 plus-ui 行为一致；避免重复提交触发后端限流。
- **Alternatives**：前端缓存验证码图片——后端一次性校验，缓存无意义。

## 未决事项

1. ~~图标风格切换~~ —— 已裁决（CLAR-002 第 3 项）：lucide 映射，不搬 SVG。
2. ~~富文本产出 HTML 结构变化~~ —— 已裁决（CLAR-002 第 4 项）：接受 tiptap + `ql-*` 兼容样式。
3. **工作流页面**（R1 批次 B）：不在本次范围，需单独 spike 后才能给断言。
