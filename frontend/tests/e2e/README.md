# 端到端测试（Playwright）

**位置约定**：跨页面、跨包的验收用例放本目录，文件名 `*.spec.ts`。
与源码同目录的单元/组件测试（`*.test.ts`）不在此收集（见 `vitest.config.ts`）。

## 前置条件

1. 本地 Docker 后端栈在线（见 `specs/001-vben-frontend-replacement/quickstart.md` §1）；
2. 前端地址 `http://localhost:5666`。**默认跑生产构建产物**（dev server 首屏 800+ 模块、
   单次约 30s，会把用例预算吃光）。`playwright.config.ts` 里的 `webServer` 会自动
   `pnpm --filter @vben/web-antdv-next preview --port 5666`，前提是已有 `dist`：
   ```bash
   pnpm build        # 或 pnpm test:e2e:full（build + 跑全部用例）
   ```
3. 系统已安装 Edge（配置里 `channel: 'msedge'`，不下载浏览器二进制）；
4. 评测夹具（部分用例依赖）：
   ```bash
   bash scripts/evals/seed_spec002.sh   # spec002_limited（无权限账号）、spec002_* 用户
   bash scripts/evals/seed_spec003.sh   # spec003_* 角色/菜单/部门/岗位、spec003_readonly、spec003_router
   ```

   `seed_spec003.sh` 预置的账号（密码均为 `admin123`，复用 `admin` 的密码哈希）：

   | 账号 | 用途 |
   |---|---|
   | `spec003_user` | 绑定 `spec003_assigned` 角色与 `spec003_post_ref` 岗位（删除/停用保护用例） |
   | `spec003_menu_admin` | 仅菜单权限码，用于 A-09 权限码控制 |
   | `spec003_readonly` | 仅 role/menu/dept/post 的 list/query 权限码（A-17 写按钮不渲染）；其角色 `role_key` 为 `admin`，因为 `/system/menu/list` 额外要求 superadmin/admin 角色 |
   | `spec003_router` | 用于 A-18 `getRouters` 路由过滤。**夹具不预置绑定**（CLAR-009 裁决 3A）：`system-router.spec.ts` 自行「补齐角色菜单授权 → 绑定 → 断言 → 解绑」，避免污染 A-05 的 `allocatedList.total=0`；补授权是因为 `system-role.spec.ts` 保存角色时会覆盖隐藏菜单的授权 |

## 运行

```bash
cd frontend
pnpm test:e2e                 # 全部用例（需先 build）
pnpm test:e2e:full            # build 后跑全部用例（CI/本地推荐）
pnpm test:e2e --grep 登录      # 只跑标题含"登录"的用例
pnpm test:e2e --ui            # 调试
```

被测地址可用 `E2E_BASE_URL` 覆盖，默认 `http://localhost:5666`（hash 路由，用例用
`gotoAppPath` 拼接，不要直接 `page.goto('/system/x')`）。
后端地址与 Redis 容器可用 `E2E_BACKEND_URL`、`E2E_REDIS_CONTAINER`、`E2E_REDIS_PASSWORD` 覆盖。
无权限账号可用 `E2E_LIMITED_USER` / `E2E_LIMITED_PASSWORD` 覆盖，默认 `spec002_limited` / `admin123`。
A-18 的路由账号可用 `E2E_SPEC003_ROUTER_USER` / `E2E_SPEC003_ROUTER_PASSWORD`、
`E2E_SPEC003_ROLE_ID` / `E2E_SPEC003_ROUTER_USER_ID` 覆盖，默认 `spec003_router` / `admin123`
与 `900003000000000006` / `900003000000000022`。

## 验证码限流（重要）

后端对 `/auth/code` 是 **10 次/60s/IP**（`CaptchaController @RateLimiter`）。每个用例都要登录，
`helpers.ts` 会：

- 复用页面挂载时的那一次取码，不额外点刷新；
- 按 **7 次/60s** 排队（留 3 次余量给“登录失败自动刷新 / 点击图片刷新”）；
- 若挂载取码被限流导致图片未渲染，等 15s 窗口重置后重试（最多 3 次）。
- `loginWithCaptcha` 会自检：Redis 无对应明文、填写值被页面重置、后端拒绝登录都会
  明确抛错；其中前两类与超时会在重新取码后整体重试一次（重试同样排队计数）。

因此**不要并行**跑两套 E2E，也不要同时跑 `scripts/evals/run_eval.py`——两者共用同一 IP 额度。

## 等待预算（慢宿主）

- 单用例预算见 `playwright.config.ts` 的 `timeout`（240s）。
- 登录成功后前端还要拉用户信息与菜单才跳 `/index`，慢宿主上会明显超过 15s
  （实测仍停在“加载菜单中…”），故统一用 `helpers.ts` 的 `APP_ENTRY_TIMEOUT`
  （60s）：登录后落 `/index`、`gotoAppPath` 后的首个元素、表格首屏等都用它。
  真实登录失败依旧会超时失败，不会被放过。
- `gotoAppPath` 返回前会等启动屏（“加载菜单中…”）消失；实测宿主在页面渲染期
  会出现 20s+ 的主线程停顿（页面最终渲染正常，网络请求均在 200ms 内），
  这是环境慢而非产品缺陷。
- antdv 的 message 提示存活时间固定，慢宿主上可能在断言开始轮询前就消失；
  `login.spec.ts` 用点击前挂 MutationObserver 的方式断言“后端 msg 确实展示过”，
  不与提示生命周期赛跑。
- 为降低录制开销，trace 关闭 screencast 截帧（DOM 快照与网络仍在），
  失败截图由 `screenshot: 'only-on-failure'` 负责。

## 产物（已 gitignore）

| 路径 | 内容 |
|---|---|
| `tests/e2e/report/` | Playwright HTML 报告（quickstart §5 的证据） |
| `tests/e2e/.artifacts/` | 失败用例的 trace / 截图 |

## 用例清单

| 文件 | 覆盖 |
|---|---|
| `smoke.spec.ts` | 未登录落登录页、登录后落 `/index` |
| `login.spec.ts` | SPEC-001 A-01、A-02、E-01、E-02、E-14 |
| `session.spec.ts` | SPEC-001 A-09、A-10、E-12、E-13 |
| `system-role.spec.ts` | SPEC-003 A-01~A-06、A-13、A-17 |
| `system-menu.spec.ts` | SPEC-003 A-07~A-09、A-14、A-17 |
| `system-dept.spec.ts` | SPEC-003 A-10、A-11、A-15、A-17 |
| `system-post.spec.ts` | SPEC-003 A-12、A-16、A-17 |
| `system-permissions.spec.ts` | SPEC-003 A-17（只读账号无写按钮；删除/级联删除/取消授权/启停二次确认，取消后不发请求） |
| `system-failure.spec.ts` | SPEC-003 A-19（列表失败不出无限加载；状态开关失败回滚） |
| `system-router.spec.ts` | SPEC-003 A-18（`GET /system/menu/getRouters` 仅返回已授权菜单；`visible='1'` 以 `hidden:true` 返回且不进侧边栏；用例自行「清残留绑定 → 绑定 → 断言 → 解绑」`spec003_router`） |
| `system-user.spec.ts` | SPEC-002 A-05、A-07、A-12、A-14；SPEC-003 A-17 |
