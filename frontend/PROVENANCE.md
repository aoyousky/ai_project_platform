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

> `lefthook.yml` 文件本身保留（便于将来真需要时手动 `lefthook install`），但没有 `prepare` 就不会自动安装。

## 3. 保留但已失效的上游内容

- `frontend/.github/`：嵌套的 `.github` 不会被 GitHub 执行，仅作上游发布流程参考。
- `internal/lint-configs/*` 的 ignore 列表仍提到 `apps/backend-mock`、`docs/`：仅忽略规则，无副作用。
- `internal/vite-config/src/plugins/nitro-mock.ts` 默认 mock 包名为 `@vben/backend-mock`：`web-antdv-next` 未启用该插件，不触发。

## 4. 约定

- `frontend/.gitignore` 已忽略 `package-lock.json`；本仓禁止出现 npm 锁文件（R8）。
- 唯一锁文件为 `frontend/pnpm-lock.yaml`，必须提交，CI 用 `--frozen-lockfile`。
- 任何对上游文件的修改都要在第 2 节追加一行；未登记即 `/review` 不通过。
