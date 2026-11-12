# REQ-20261111-007 UAT 与环境配置核对（C1 / C2 / 本地部署）

- 日期：2026-11-11
- 范围：系统监控 4 个视图上线前验证（C1）＋生产环境变量与运行时配置核对（C2）
- 结论：**C1 通过（28/28）**；**C2 配置正确，外部控制台路由由部署方提供**

## C1 自动化 UAT（全量 E2E）

- 环境：后端 `http://localhost:8080`；前端生产预览 `http://localhost:5666`；
  构建产物为本提交（`1e03c4a`）的 `dist`（提交后仅新增文档与 `seed_spec002.sh` 清理逻辑，
  前端产物未变化）。
- 命令：

  ```bash
  cd frontend
  E2E_MONITOR_ADMIN_URL=http://localhost:9090/admin/applications \
  E2E_SNAILJOB_ADMIN_URL=http://localhost:8800/snail-job \
  pnpm exec playwright test tests/e2e/spec007-assertions.spec.ts
  ```

- 结果：**28 passed (9.8m)，exit 0**。
- 覆盖与账号：
  - `admin`：在线用户列表/筛选/分页/单条强退/批量强退（A-01～A-05）、缓存监控
    12 项与两张图表（A-06/A-07）、Admin 监控与任务调度中心 iframe 与外链（A-08/A-09）。
  - `spec007_limited`（仅 `monitor:online:list`）：列表可见、强退/批量按钮数量 = 0（A-10）；
    越权直达 `/monitor/cache` 落 404（E-14）。
  - `spec007_no_monitor`：越权直达 `/monitor/online` 落 404（E-15）。
  - 边界 E-01～E-17 全部执行通过（E-04 为单测，另见 trace `boundary_evidence`）。
- 说明：
  - 本机 `localhost:9090` 与 `:8800` 两个官方控制台**不可达**（curl 000）。E2E 中
    iframe `src`/外链 `href` 仍等于注入地址，E-13（不可达保留 iframe、不弹自造错误）
    实际被执行；未因目标站点不可达产生失败。
  - 该套 E2E 依赖 `E2E_MONITOR_ADMIN_URL` / `E2E_SNAILJOB_ADMIN_URL`，缺失时
    fail-fast（`spec007-assertions.spec.ts:150-166`）。

## C2 生产环境配置核对

| 检查项 | 结果 | 证据 |
|---|---|---|
| `.env.production` 地址 | ✅ 相对路径 `/admin/applications`、`/snail-job` | `.env.production:35,38` |
| 构建产物运行时注入 | ✅ `dist/_app.config.js` 含同名键且值为相对路径 | dist 产物（gitignore，部署时生成） |
| 源码/组件硬编码地址 | ✅ 无（仅单测夹具含字面量 URL，用于断言配置透传） | `external-console-logic.test.ts:17-43` |
| 运行时配置优先级 | ✅ 运行时值优先；空串按未配置（E-12） | `external-console-logic.ts:14-25` |
| 外链安全属性 | ✅ `window.open(url,'_blank','noopener,noreferrer')` | `external-console.vue:17-21` |
| 越权直达 | ✅ 无静态路由，菜单由后端下发；404 | 路由清单无 `/monitor/*` 静态项 |

### 部署侧待办（不在本需求代码范围）

生产环境使用相对路径，意味着两个控制台必须由**同源网关/反向代理**提供：

- `/admin/applications` → Spring Boot Admin 控制台
- `/snail-job` → SnailJob 控制台

若部署方无法提供同源路由，则需在运行时配置（`_app.config.js`）中改为绝对地址，
不需要改代码；但绝对地址需满足同源可访问或浏览器允许嵌入（iframe 受目标站点
`X-Frame-Options`/CSP 限制时，用户仍可通过「新窗口打开」外链访问）。

## C1' 本地 Docker 部署后 UAT（2026-11-11 晚）

- 部署：`deploy/build/dist` 更新为当前分支构建 → `docker compose -f deploy/docker-compose.yml up -d --build`；
  5 个容器 Running，`db-init` 判定“已初始化，跳过”；后端冷启动 28s 就绪。
- 部署验证：`http://localhost/` 200；`http://localhost/prod-api/auth/code` 200；
  容器内存在 `online-*.js` / `cache-*.js` / `admin-*.js` / `snailjob-*.js`，
  `_app.config.js` 为相对路径 `/admin/applications`、`/snail-job`。
- 部署后全量 E2E（baseURL 指向 nginx 80 端口）：

  ```bash
  cd frontend
  E2E_BASE_URL=http://localhost \
  E2E_MONITOR_ADMIN_URL=http://localhost:9090/admin/applications \
  E2E_SNAILJOB_ADMIN_URL=http://localhost:8800/snail-job \
  pnpm exec playwright test tests/e2e/spec007-assertions.spec.ts
  ```

  结果：**28 passed (9.9m)，exit 0**（与 5666 预览上的结果一致）。
- nginx 缺口已修复：`deploy/nginx/default.conf` 为 `/admin/applications` 与 `/snail-job`
  增加 `^~` 同源反代（保留完整路径、支持 WebSocket/SSE）。本地控制台未启动时两路径
  返回 502（真实上游失败），不再是 SPA 兜底的假 200；控制台启动后即可正常嵌入。
  部署到其他环境只需改 `proxy_pass`，不改前端或运行时配置。

## A 执行：官方控制台部署与内嵌验证（2026-11-12）

CLAR-016 裁决为先执行 A（部署缺口）。本仓库内置两个控制台服务端，无需改前端代码。

### 构建与启动

- 构建（不跳过前端，仅后端两模块）：

  ```bash
  cd platform
  mvn -B -q -pl aoyou-extend/aoyou-monitor-admin,aoyou-extend/aoyou-snailjob-server \
    -am -DskipTests -Pdev package
  ```

  产物：`aoyou-monitor-admin/target/aoyou-monitor-admin.jar`（46.9 MB）、
  `aoyou-snailjob-server/target/aoyou-snailjob-server.jar`（104.9 MB）。
- 数据库：导入 `platform/script/sql/ry_job.sql`，本地 `aoyou` 库新增 23 张 `sj_*` 表。
- 启动（宿主机进程，端口与前端配置一致）：
  - `java -jar aoyou-monitor-admin.jar` → `:9090`，context-path `/admin`，9.4s 启动
  - `java -jar aoyou-snailjob-server.jar --spring.datasource.url=jdbc:mysql://127.0.0.1:3307/aoyou ...`
    → `:8800`，context-path `/snail-job`，17.7s 启动
  - 两个 jar 均位于 `target/`（已 gitignore），启动日志在 `deploy/build/*.log`（已 gitignore）。

### nginx 修复：代理整个 context-path

- 原配置只代理 `^~ /admin/applications`，但 Spring Boot Admin 的登录页
  `/admin/login`、静态资源 `/admin/assets/*`、接口 `/admin/*` 都在同一 context-path 下；
  只代理入口会让登录页仍被 SPA 兜底成 `index.html`（表现为 iframe 里是本系统首页）。
- 改为 `location ^~ /admin/ { proxy_pass http://host.docker.internal:9090; ... }`，
  `/snail-job` 因为前缀覆盖 `/snail-job/*` 无需调整。
- `^~` 必须保留，否则静态资源正则会截走控制台 `assets/*.js`；已验证通过反代可取到
  `text/javascript`。

### 验证结果

| 检查 | 结果 |
|---|---|
| `http://localhost/admin/applications` | 302 → `/admin/login`（Location 仍是 `http://localhost/...`，未跳出同源） |
| `http://localhost/admin/login` | 200，`<title>Aoyou-Vue-Plus服务监控中心</title>` |
| `http://localhost/snail-job` | 302 → `/snail-job/` → 200 |
| `http://localhost/snail-job/` | 200，`<title>登录 \| Snail Job</title>` |
| 嵌入限制 | 两个控制台均无 `X-Frame-Options` / CSP，允许同源 iframe |
| iframe 实际内容 | 临时 Playwright 用例（不入库，验证后已删除）登录 admin 后读取 iframe 内 `title`：Admin 监控命中 `/服务监控中心/`，任务调度中心命中 `/Snail Job/` —— 不再是系统首页 |
| 全量回归 | 部署栈（`E2E_BASE_URL=http://localhost`，控制台地址为相对路径）跑 `spec007-assertions.spec.ts`：**28 passed (9.8m)，exit 0**；A-08/A-09 在控制台可达后仍通过 |

### 不在 A 范围（需 B 或单独部署裁决）

- 本地 compose 仍以 `--spring.boot.admin.client.enabled=false`、`--snail-job.enabled=false`
  启动后端，因此 Admin 监控里目前只有两个控制台自身注册的实例，**看不到平台后端**。
- `sj_group_config` 只有 `ruoyi_group`，而后端配置的组名是 `aoyou_group`；
  接续任务执行前需要在 SnailJob 后台建组或改配置。
- 两个控制台目前是宿主机进程，未纳入 compose；容器/机器重启后需手工再启动。

## 附：B1 夹具修复验证（同日）

- `seed_spec002.sh` 增加 `spec002_created_%` 清理后执行：
  遗留账号由 2 条降为 0，「Spec002 部门」用户数回到 3；
  下一次门禁的 REQ-006 A-03 Top5 不再受该部门漂移影响。
- 提交：`6b7781f chore(evals): seed_spec002 ...`。
- 本修复只清理本需求评测自建的账号，不改动任何断言、期望值或评分逻辑。
