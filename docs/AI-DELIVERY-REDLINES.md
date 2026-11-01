# AI 交付红线（平台底座部分）

日期：2026-11-01
状态：**已生效**（本文件条目均可由代码或配置复核）

## 0. 本文只管什么

本文只写**接管 RuoYi-Vue-Plus 底座之后新产生的**约束。通用交付规则不在这里，见下表——
**同一规则只允许出现在一处**，本文发现与下表冲突时应停下报告，不得自行取舍。

| 规则类别 | 唯一出处 |
|---|---|
| 输入唯一性、STOP、溯源、DoD | [CLAUDE.md](../CLAUDE.md) |
| 分层、聚合、测试、安全、依赖审批等工程原则 | [.specify/memory/constitution.md](../.specify/memory/constitution.md) |
| 技术选型、与宪章的偏离、接缝定义 | [docs/adr/001-scaffold-selection.md](adr/001-scaffold-selection.md) |
| 平台来源、上游 commit、已登记改动 | [platform/PROVENANCE.md](../platform/PROVENANCE.md) |
| 业务目录与四层映射 | [business/README.md](../business/README.md) |
| **底座红线** | **本文** |

## 1. 红线清单

### R1 底座只读（`platform/` 与 `frontend/`）

`platform/`（后端）与 `frontend/`（前端）都是脚手架，**框架代码只读**。除下表接缝外，任何既有文件不得改动：

| 接缝 | 允许的操作 | 禁止 |
|---|---|---|
| `platform/pom.xml` 的 `<modules>` | 追加业务模块 | 改动既有条目、改属性 |
| `platform/aoyou-admin/pom.xml` 的 `<dependencies>` | 追加业务模块 | 改平台依赖版本 |
| `platform/aoyou-admin/src/main/resources/` 下的配置文件 | 改**配置项取值** | 改 Java 源码、改配置结构、增删配置节点 |
| `frontend/apps/web-antdv-next/src/views/<context>/` | 新增业务页面 | 改 `packages/**`、`src/adapter/**`、布局与 store |
| `frontend/apps/web-antdv-next/src/api/<context>/` | 新增业务接口封装 | 改既有 `src/api/core/*.ts`（适配层，见 ADR-002 §2.1） |
| `frontend/apps/web-antdv-next/.env.*` | 改**已有配置项的值** | 增删配置结构 |
| ADR-002 §2.1 列出的适配层文件 | 按该表逐项限定 | 超出该表的框架代码改动需另提 ADR |

需要改底座代码（Java / Vue / TS）时：另提 ADR，登记改动文件清单，经批准后方可动。

**复核**：`git diff --stat platform/ frontend/` 应只出现上述路径。
`frontend/PROVENANCE.md` 与 `platform/PROVENANCE.md` 的"已登记改动"表必须与 diff 一致。

### R2 多租户不启用

- 配置：`tenant.enable: false`（`application.yml`）。
- 业务实体继承 `BaseEntity`；禁止 `TenantEntity`、禁止调用 `TenantHelper`。
- 禁止在 SQL / Mapper 里自行写 `tenant_id` 过滤条件。
- 确需启用须另提 ADR，并重新评估全部既有表与迁移脚本。

**复核**：`grep -rn "TenantEntity\|TenantHelper" business/` 应为空。

### R3 密钥不得入仓

- `sa-token.jwt-secret-key` 为 `${SA_TOKEN_JWT_SECRET}`，**无默认值**；未注入则启动失败。
- 仓库内不得出现真实密钥、证书、第三方账号密码、OSS/短信 AccessKey；一律走环境变量。
- 日志、异常、trace 证据里不得出现密钥明文。
- `frontend/.env.*` 里的 `VITE_APP_RSA_PUBLIC_KEY` / `VITE_APP_RSA_PRIVATE_KEY` 是**上游公开默认值**，
  仅用于接口传输加密，不是身份凭据；但**上线前必须重新生成并改为环境注入**，与后端 `api-decrypt` 配置成对更换。

**复核**：`grep -rn "jwt-secret-key" platform/aoyou-admin/src/main/resources/application.yml` 只能看到占位符。

### R4 平台内部实现不得跨模块直连

- 禁止在 `business/` 中 `import com.aoyou.system.service.*Impl`、直接注入平台 Mapper。
- 需要平台能力时，走平台已暴露的接口；需要新能力时在 `business/<context>` 内自行实现。
- 禁止改平台 Mapper XML / 实体来"顺手满足"业务需求。

### R5 表结构唯一入口是 `db/migrations/`

- V1、V2 为平台基线，**不可修改**；业务变更从 V3 起追加。
- 禁止在业务代码中执行 DDL；禁止手工改库后不回写迁移脚本。
- 业务表不得修改平台表结构；需要扩展时新建表或加可空列，并写清回滚方式。

### R6 不引入微服务组件

- 当前为模块化单体（ADR-001 D3）：禁止新增 Spring Cloud / Nacos / Gateway 等依赖。
- 拆分预案见 ADR-001 §6，触发条件满足时另提 ADR。

### R7 开发期工具不得进生产

- `p6spy` 只在 `dev` profile 生效，生产关闭。
- `fastjson` 存量保留，**禁止在新业务代码中使用**。
- 代码生成器产物只是初稿，必须落在 `business/` 并通过 ArchUnit 后才算交付。

### R8 前后端按同一限界上下文同名交付

- 后端 `business/<context>/`、前端 `apps/web-antdv-next/src/views/<context>/`、
  `apps/web-antdv-next/src/api/<context>/` **必须同名**；交付一个需求时三处一起改，不允许只交一半。
- 禁止在组件里硬编码后端地址：统一走 `VITE_GLOB_API_URL` + `src/api/<context>/` 的封装。
- `frontend/pnpm-lock.yaml` **必须入库**；禁止删除锁文件、禁止用 `--no-save` 绕过、
  禁止 `npm install` 另外生成 `package-lock.json`。
- 前端不得引入 `frontend/PROVENANCE.md` 之外的新依赖；新增依赖先走白名单（`allowlist.md` §1.2）。
- 迁移期说明：P4-1 起前端统一为 pnpm；`frontend/` 旧 plus-ui 代码在 P4-3 删除前仍按 R1 只读。

## 2. 强制方式

| 红线 | 由什么强制 | 现状 |
|---|---|---|
| R1 只读 | 人工 review + `git diff --stat platform/ frontend/` | 无自动门禁 |
| R1 四层方向 | ArchUnit（`business/archunit`）+ CI `architecture` job | 自动 |
| R2 多租户 | 配置 + 人工 review | 无自动门禁 |
| R3 密钥 | 配置占位符（缺失即启动失败） | 半自动 |
| R4 内部直连 | `/review` checklist | 人工 |
| R5 迁移 | 人工 review；V1/V2 校验和由 Flyway `validateOnMigrate` 保证 | 半自动 |
| R6 微服务 | 依赖只能来自 `allowlist.md` | 半自动 |
| R7 p6spy/fastjson | `/review` checklist | 人工 |
| R8 目录同名 | `/review` checklist | 人工 |
| 前端可构建 | CI `frontend` job：迁移期仍为 `npm ci && npm run build:prod`（plus-ui）；P4-1 起改为 `corepack enable && pnpm install --frozen-lockfile && pnpm -F @vben/web-antdv-next build` | 自动 |

**未自动化的项由 `/review` 的 12 项 checklist 兜底。** 未通过 `/review` 不得报告完成。

## 3. 违规处理

1. 发现违反红线 → 停止交付，先由人工决定是"改代码"还是"改 ADR"。
2. 只要选择改 ADR，就必须同步更新 `platform/PROVENANCE.md` 的已登记改动表。
3. 不得以"先跑起来再说""后面补"为由放行——这与 CLAUDE.md 的 DoD 冲突，以 CLAUDE.md 为准。
