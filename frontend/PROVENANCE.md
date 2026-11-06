# PROVENANCE：`frontend/` 来源与本地改动登记

> 本文件是 `frontend/` 的出处凭证与"相对上游改了什么"的唯一登记处。
> 每次对上游代码做本地改动，都必须在本文件追加一行；`/review` 会检查本文件是否与 diff 一致。

## 1. 上游

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/vbenjs/vue-vben-admin |
| 版本 | **v5.7.0** |
| 上游 commit | `63a38dce49ba109f61607994e21ba921d8e970e9`（`refs/tags/v5.7.0`） |
| 引入方式 | `git subtree add --prefix=frontend <vben-snapshot> v5.7.0 --squash` |
| 引入日期 | 2026-11-02 |
| 子树 squash commit | `8904006`（`Squashed 'frontend/'`），其父为本次 REQ 的前端落点提交 |
| 引入文件数 | 1771（与上游 tag 的 `git archive` 完全一致） |

### 1.1 为何经由"快照仓库"而非直接指向上游

1. 本机访问 GitHub 的 git 协议需强制 HTTP/1.1（`git -c http.version=HTTP/1.1`），否则 `ls-remote`/`clone` 超时。
2. 以 `--depth 1 --branch v5.7.0` 浅克隆后，`git subtree add` 直接指向该克隆会失败：
   `error: Could not read <sha>` / `shallow roots are not allowed to be updated`。
3. 因此对同一份克隆执行 `git archive HEAD`，在空目录重建一个**单提交非浅仓库**并打同名 tag，
   再对该仓库做 `subtree add`。

结果与常规 `--squash` 引入等价：`frontend/` 是一次 squash 提交，上游只保留一个父引用。
**上游 commit 已在第 1 节登记**，快照仓库仅是本机中间产物，不入库。

后续升级仍可直连上游：

```bash
git -c http.version=HTTP/1.1 subtree pull --prefix=frontend \
  https://github.com/vbenjs/vue-vben-admin.git vX.Y.Z --squash
```

## 2. 本地改动登记

| 日期 | 改动 | 原因 | 关联 |
|---|---|---|---|
| 2026-11-02 | 删除 `apps/{web-antd,web-ele,web-naive,web-tdesign,backend-mock}` | 只保留 `apps/web-antdv-next` | T002 |
| 2026-11-02 | 删除 `playground/`、`docs/` | 非本项目交付产物 | T002 |
| 2026-11-02 | `pnpm-workspace.yaml` 去掉 `docs`、`playground` 两个 workspace 条目 | 目录已删，残留会导致 `pnpm install` 报错 | T002 |
| 2026-11-02 | `package.json` 删除 `build:{antd,docs,ele,naive,tdesign,play}` 与 `dev:{antd,docs,ele,naive,tdesign,play}`，新增 `build:antdv-next` | 对应应用已删 | T002 |
| 2026-11-02 | `package.json` 删除 `prepare`（`is-ci \|\| pnpm exec lefthook install`） | `frontend/` 是本仓 subtree，`lefthook install` 会把钩子写进**本仓根 `.git/hooks`**，用整套 monorepo 的 lint + typecheck 拦下每一次提交（包括后端提交） | T002 |
| 2026-11-02 | `turbo.json` 删除 `@vben/backend-mock#build` 任务 | 对应应用已删 | T002 |
| 2026-11-02 | 锁文件统一为 `pnpm-lock.yaml`（由 `pnpm install` 按裁剪后的 workspace 重新生成并提交）；本仓不出现 `package-lock.json`（已在 `.gitignore` 中） | 从 npm 切 pnpm，锁文件与 CI 命令原子切换（R8、T003） | T003 |
| 2026-11-02 | `vitest.config.ts`：补 `include`（apps/packages/internal 的 `*.test.*` + `tests/unit/**`）与 `coverage`（v8，仅统计 `apps/web-antdv-next/src/api/core/**`，阈值 70%，页面阈值 T051 补） | 统一单元测试入口与覆盖率口径（research R5/R6） | T005 |
| 2026-11-02 | 新增 `playwright.config.ts`（系统 Edge `channel: 'msedge'`，baseURL 5666，用例目录 `tests/e2e`）与 `tests/e2e/README.md` | E2E 入口（research R4） | T005 |
| 2026-11-02 | `package.json`：新增 devDeps `@playwright/test`、`@vitest/coverage-v8`；`test:e2e` 由 `turbo run test:e2e` 改为 `playwright test`；新增 `test:coverage`；catalog 增加 `@vitest/coverage-v8` | 上述配置的依赖（均已在 allowlist §2 登记） | T005 |
| 2026-11-02 | `.gitignore` 增加 `tests/e2e/report`、`tests/e2e/.artifacts`、`test-results` | E2E 产物不入库 | T005 |
| 2026-11-02 | 新增 `src/api/core/ruoyi-crypto.ts` + `ruoyi-crypto.test.ts`（AES-256-ECB/PKCS7、RSA/ECB/PKCS1） | RuoYi 传输加密适配（FR-002） | T006/T010 |
| 2026-11-02 | 新增 `src/api/core/menu.ts`（替换上游 `/menu/all` 桩）+ `menu.test.ts` + `__fixtures__/getRouters.json`（真实后端 48 节点 / 39 叶子） | `getRouters` → Vue Router 转换（FR-005/006，C2） | T007/T011/T019 |
| 2026-11-02 | `src/api/request.ts`：`successCode: 200`、`dataField` 兼容 `rows/total`、按 `encrypt-key` 响应头解密、`clientid`/`Content-Language` 头、业务 `code:401` 重新认证、错误文案取后端 `msg`；移除对 `refreshTokenApi` 的依赖 | RuoYi 响应封装适配（FR-003/011/012，C1） | T008/T014 |
| 2026-11-02 | 新增 `src/api/request.test.ts` | 两种响应体、错误文案、401、响应解密、请求头 | T008 |
| 2026-11-02 | `src/api/core/auth.ts`：`/auth/login`（加密体）、`/auth/code`、`/auth/logout`、`getAccessCodesApi`（取 `getInfo.permissions`）；`src/api/core/user.ts`：`/system/user/getInfo` → Vben `UserInfo` | 认证与用户画像适配（FR-001/005） | T012/T013 |
| 2026-11-02 | `src/router/access.ts` 的 `layoutMap` 增加 `Layout`/`ParentView`/`InnerLink`；`src/layouts/index.ts` 导出 `ParentView`；新增 `src/layouts/parent-view.vue` | 后端菜单组件名落地（data-model §3.1） | T015 |
| 2026-11-02 | 新增 `src/router/routes/modules/home.ts` 与 `src/views/index.vue`（由 plus-ui 首页移植，技术栈描述改为 Ant Design Vue） | `/index` 常量路由（FR-015） | T016 |
| 2026-11-02 | `src/preferences.ts`：`accessMode: 'mixed'`、`defaultHomePath: '/index'`、`enableRefreshToken: false` | 后端菜单 + 前端常量路由共存；RuoYi 无刷新令牌 | T017 |
| 2026-11-02 | `.env`/`.env.development`/`.env.production`：标题、端口 5666、`VITE_GLOB_API_URL`（dev `/api`、prod `/prod-api`）、`VITE_APP_CLIENT_ID`、`VITE_APP_ENCRYPT`、RSA 公私钥、关闭 Nitro Mock；`vite.config.ts` 代理目标改为 `http://localhost:8080` | 对接本地/生产后端（T018）；RSA 为上游示例密钥，真实生产密钥用 `.env.production.local`/CI 注入 | T018 |
| 2026-11-02 | 新增 `tests/e2e/helpers.ts`、`tests/e2e/smoke.spec.ts`（后端未起时自动 skip） | 冒烟用例（A-16） | T009 |
| 2026-11-02 | `apps/web-antdv-next/package.json`：runtime 增 `crypto-js@4.2.0`、`jsencrypt@3.5.4`；dev 增 `@types/crypto-js@4.2.2`（类型包） | 传输加密实现（allowlist 已登记运行时两包；`@types/*` 为类型补充，待白名单补一行） | T006/T010 |
| 2026-11-02 | `pnpm-workspace.yaml` catalog：`@playwright/test`、`playwright` 钉为 `1.64.1`；`@vitest/coverage-v8` 钉为 `4.1.7` | 原 `^1.60.0` 使 `@playwright/test` 与 `playwright` 解析到两个版本，Playwright 拒绝运行；coverage-v8 需与 vitest 4.1.7 peer 对齐 | T005/T009 |

> `lefthook.yml` 文件本身保留（便于将来真需要时手动 `lefthook install`），但没有 `prepare` 就不会自动安装。

## 3. 保留但已失效的上游内容

- `frontend/.github/`：嵌套的 `.github` 不会被 GitHub 执行，仅作上游发布流程参考。
- `internal/lint-configs/*` 的 ignore 列表仍提到 `apps/backend-mock`、`docs/`：仅忽略规则，无副作用。
- `internal/vite-config/src/plugins/nitro-mock.ts` 默认 mock 包名为 `@vben/backend-mock`：`web-antdv-next` 未启用该插件，不触发。

## 4. 约定

- `frontend/.gitignore` 已忽略 `package-lock.json`；本仓禁止出现 npm 锁文件（R8）。
- 唯一锁文件为 `frontend/pnpm-lock.yaml`，必须提交，CI 用 `--frozen-lockfile`。
- 任何对上游文件的修改都要在第 2 节追加一行；未登记即 `/review` 不通过。
