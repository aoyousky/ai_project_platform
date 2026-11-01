# Quickstart：前端框架替换的验收步骤

**Date**: 2026-11-01 | **Plan**: [plan.md](./plan.md)

> 本文件是**验收/运行指南**，不是实现说明。每条场景对应 spec 中的 FR / SC 编号，
> 失败即视为交付未完成（CLAUDE.md DoD）。

## 1. 前置条件

| 项 | 要求 | 检查命令 |
|---|---|---|
| Node | `^22.18.0` 或 `^24.0.0` | `node -v` |
| pnpm | 10.33.4（Corepack 自动） | `corepack enable && pnpm -v` |
| 后端栈 | MySQL 8 / Redis / `awp-backend:8080` | `docker ps --format '{{.Names}}'` |
| Redis 密码 | 本地为 `aoyou123`（E2E 取验证码用） | `docker exec awp-redis redis-cli -a aoyou123 ping` |
| 测试账号 | `admin`（超级管理员）+ 一个普通角色账号 | 后端初始化数据 |

## 2. 启动

```bash
# 后端
cd deploy && docker compose up -d

# 前端（落点后：frontend/ 为 Vben monorepo）
cd ../frontend
corepack enable
pnpm install
pnpm -F @vben/web-antdv-next dev        # http://localhost:5666
```

**预期**：浏览器打开 5666 显示登录页，控制台无 `ERR_CONNECTION_REFUSED`、无未捕获异常；
除"未移植页面组件缺失"类告警外无红色错误。

## 3. 自动化门禁

```bash
cd frontend

# 类型检查（VII）
pnpm -F @vben/web-antdv-next typecheck

# 单元/组件测试 + 覆盖率（VIII，门槛见 research R6）
pnpm test:unit -- --coverage

# 生产构建
pnpm -F @vben/web-antdv-next build

# 端到端（需后端栈在线）
pnpm exec playwright test tests/e2e
```

**通过标准**：四条命令均以 0 退出；覆盖率报告中 `src/api/core/**` 与首批移植页面分支覆盖 ≥ 70%。

## 4. 手工验收场景

### VS-1 登录与验证码（FR-001/002/003/004）

1. 打开 `http://localhost:5666` → 只见用户名 / 密码 / 验证码三个输入项，**无**手机号或扫码入口。
2. 故意输错验证码 → 提交 → 提示失败文案，验证码图片刷新，用户名保留。
3. 输入正确凭据 → 进入 `/index`，顶部显示昵称，侧栏显示菜单。
4. 点击头像 → 退出登录 → 回到登录页；按浏览器后退，**不应**回到已登录界面。

### VS-2 菜单与会话恢复（FR-005/006/016）

1. 刷新页面 → 仍停留在原页面（深层地址如 `/system/post` 可直接访问）。
2. 打开 `http://localhost:5666/system/post` 新标签页 → 已登录则直接进入，未登录则跳登录页。

### VS-3 权限呈现（FR-007/008）

1. `admin` 登录 → 进入岗位管理 → "新增""删除"按钮均可见（通配符生效）。
2. 普通账号登录（无 `system:post:add`）→ 岗位管理可进，但"新增"不可见。
3. 普通账号访问未授权地址（如 `/system/menu`）→ 403/404 提示页，无页面内容泄漏。

### VS-4 外链内嵌（FR-009/010）

1. 侧栏出现「PLUS官网」（或后端配置的外链项）。
2. 点击 → 地址栏变为 `/iframe/...`，标签页新增，内容区内嵌 iframe。
3. 若目标站点拒绝内嵌（`X-Frame-Options`），系统其余部分仍可用，无白屏、无路由崩溃。

### VS-5 样例页 CRUD（FR-011/012/014）

1. 岗位管理 → 列表有数据，分页总数与后端一致。
2. 新增（必填：岗位名称、岗位编码、部门）→ 确认 → 列表出现新记录。
3. 修改该记录 → 名称变更生效。
4. 勾选 → 批量删除 → 列表不再出现。
5. 提交缺必填项 → 界面给出提示，**不出现**堆栈或 `{"code":500}` 原文。

### VS-6 错误文案（FR-012）

用后端已存在的编码新建岗位 → 后端返回业务错误 → 界面展示后端 `msg`（如"岗位编码已存在"），
不是 "Request failed with status code 500"。

### VS-7 富文本兼容（E-19，CLAR-002 第 4 项）

1. 打开一条**历史**通知公告详情（内容由旧编辑器保存，含 `ql-align-center` / `ql-size-large`）。
2. 居中与字号应正常显示；文本内容与原文一致。
3. 回归范围仅限"通知公告详情"与"含富文本字段的页面"两类，其余页面不逐页回归。

> 注：SC-001「熟练用户 60 秒登录」已按 CLAR-002 第 1 项移出断言，本文件 VS-1 即为该项的人工验收记录。

## 5. 证据留存

| 证据 | 路径 | 说明 |
|---|---|---|
| E2E 报告 | `frontend/tests/e2e/report/` | Playwright HTML 报告 |
| 覆盖率报告 | `frontend/coverage/` | Vitest coverage |
| 截图 | 由 E2E 用例 `screenshot` 产出 | 登录页 / 首页 / 外链内嵌 / CRUD 各一张 |
| 路由校验 | 单元测试断言 | 48 节点 / 39 叶子全部可解析、无重名 |
| trace | `trace/<需求编号>.yaml` | 断言 → file:line 映射（CLAUDE.md 铁律 3） |

## 6. 故障排查

| 现象 | 可能原因 | 处置 |
|---|---|---|
| 登录后列表全空 | 分页响应体未按 `rows` 解析 | 检查 `dataField` 是否覆盖 `rows` 形态（C1） |
| 超管看不到按钮 | `v-access` 未识别 `*:*:*` | 检查 `directives/access.ts` 是否注册（C6） |
| 整张菜单加载失败 | 外链 path 直接进了路由表 | 检查 `menu.ts` 外链合成逻辑（C2） |
| 菜单无图标 | 图标名未映射 | 见 research R10 映射表 |
| 登录提示验证码错误但输入正确 | Redis 中验证码已被消费/过期 | 重新获取验证码；E2E 用 Redis 读取需在提交前读取 |
