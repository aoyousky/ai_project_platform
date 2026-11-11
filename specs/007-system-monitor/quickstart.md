# Quickstart: 系统监控模块前端验收

**Feature**: `specs/007-system-monitor` | **Date**: 2026-11-11
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Delivery authority**: `specs/SPEC-007-system-monitor.md` v1.0

本指南只描述如何运行与验证，不复制实现代码。契约细节见
[contracts/backend-api-consumed.md](contracts/backend-api-consumed.md)、
[contracts/routes-and-permissions.md](contracts/routes-and-permissions.md)、
[contracts/ui-contracts.md](contracts/ui-contracts.md) 与 [data-model.md](data-model.md)。

## 1. 前置条件

- Node.js `^22.18.0 || ^24.0.0`，pnpm ≥ 10。
- 后端 `http://localhost:8080` 可用，且已执行登录与监控相关菜单的初始化。
- 如需评测夹具：Docker 可用，Redis 与 MySQL 已由 `deploy/docker-compose.yml` 启动。
- Admin 控制台（可选）：`http://localhost:9090/admin/applications`。
- SnailJob 控制台（可选）：`http://localhost:8800/snail-job`。

## 2. 安装与启动

```bash
cd frontend
pnpm install
pnpm dev:antdv-next
```

默认应用地址 `http://localhost:5666`（`.env.development` 的 `VITE_PORT`）。开发环境已配置：

```dotenv
VITE_GLOB_MONITOR_ADMIN_URL=http://localhost:9090/admin/applications
VITE_GLOB_SNAILJOB_ADMIN_URL=http://localhost:8800/snail-job
```

生产构建使用 `.env.production` 的相对路径 `/admin/applications` 与 `/snail-job`，由部署方覆盖。

## 3. 夹具与数据

```bash
# 仓库根目录
bash scripts/evals/seed_spec007.sh
```

夹具应创建：

- `spec007_online`：同一 IP 下 2 个有效在线会话（`deviceType=pc`）。
- `spec007_limited`：仅具备 `monitor:online:list`。
- `spec007_no_monitor`：不具备任何 `monitor:*` 权限。
- `admin`：超级管理员，权限 `*:*:*`。

会话编号在用例内通过 `GET /monitor/online/list` 动态读取，不写死。

## 4. 验证命令

```bash
# 单元测试（纯逻辑 + API 契约）
cd frontend
pnpm test:unit

# 类型检查与 lint
pnpm check:type
pnpm lint

# 单一 E2E 文件
pnpm exec playwright test tests/e2e/spec007-assertions.spec.ts

# 评测集（仓库根目录）
python scripts/evals/run_eval.py --req REQ-20261111-007 --report specs/evals/reports

# 门禁（含 spec 禁词、断言/边界、trace、Spec Kit 关联、评测集）
bash scripts/ci-gate.sh

# 辅助诊断（永远 exit 0，不参与合并判定）
bash scripts/spec-audit.sh specs/SPEC-007-system-monitor.md
```

## 5. 手工验收场景

### 5.1 在线用户（A-01～A-05、A-10）

1. 以 `admin` 登录，打开 `/monitor/online`。
2. 不填筛选条件：确认 2 条 `spec007_online` 会话、10 个表头各 1 次、总数为 2、无控制台异常。
3. 填 `userName=spec007_online` 与首行 `ipaddr`：确认仍为 2 条；改 `userName=spec007_not_exist`：
   确认 0 条并显示「暂无数据」。
4. 对 1 条点「强退」并确认：确认提示「强退成功」、列表少 1 条。
5. 勾选剩余 2 条执行「批量强退」：确认提示「成功 2 条，失败 0 条」、列表少 2 条。
6. 以 `spec007_limited` 登录：确认列表可见，但两个强退按钮均不存在。

### 5.2 缓存监控（A-06、A-07）

1. 以具备 `monitor:cache:list` 的账号打开 `/monitor/cache`。
2. 确认 12 个标签各 1 次、Key 数量等于接口 `dbSize`、两个图表各 1 个画布。
3. 在 Redis 中执行若干命令后刷新，确认命令统计饼图出现对应命令。
4. 临时将 `commandStats` 置空（或使用夹具），确认命令统计区域显示「暂无数据」、内存图表仍在。

### 5.3 外部控制台（A-08、A-09、E-12、E-13、E-17）

1. 打开 `/monitor/Admin`：确认 iframe `src` 与外链 `href` 均等于开发地址，iframe 高度 ≥ 400。
2. 点击外链：确认新窗口打开同一地址，原页 iframe 仍在。
3. 将 `.env.development` 中 Admin 地址改为空串并重启：确认显示「未配置监控地址」、无 iframe、
   外链不可点击。
4. 对 SnailJob 重复步骤 1～3。

### 5.4 越权与失败路径（E-09、E-14、E-15）

1. 以 `spec007_limited` 直达 `/monitor/cache`：确认 404，且网络面板无 `GET /monitor/cache`。
2. 以 `spec007_no_monitor` 直达 `/monitor/online`：确认 404，且无列表请求。
3. 停止 Redis 或让缓存接口失败：确认页面只显示后端 `msg`，无信息表与图表，无未捕获异常。

## 6. 预期结果

- A-01～A-10 全部通过，`pageerror` 计数为 0。
- `pnpm test:unit`、`pnpm check:type`、`pnpm lint` 全部通过。
- 评测集 `REQ-20261111-007` 全部通过，报告写入 `specs/evals/reports/`。
- `bash scripts/ci-gate.sh` 五道门禁全部通过（评测集与 trace 齐备后）。
- `git diff --stat` 不含 `platform/` 与 `frontend/packages/**`，`package.json` 无新增依赖。

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| 4 个菜单进入「即将推出」 | 检查 `views/monitor/{online,admin,cache,snailjob}/index.vue` 是否存在且组件名匹配 |
| 在线列表 401/403 | 检查登录令牌、`monitor:online:list` 菜单权限与 `clientid` |
| 批量强退提示失败数不符 | 检查 E2E 拦截的 `DELETE` 次数与失败注入位置 |
| 缓存图表无 `canvas` | 检查 `commandStats` 非空、ECharts 容器有宽高、`useEcharts` 在 `onMounted` 后调用 |
| iframe 空白 | 属目标站点不可达的允许行为；确认外链仍可用、地址来自环境变量 |
| 直接访问受限页未 404 | 检查后端菜单是否返回该路由；前端不得注册静态路由 |
