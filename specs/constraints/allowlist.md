# 依赖白名单（allowlist）

> 本文件是依赖审批的**唯一白名单**。`specs/constraints/constraints.md` 只引用本文件，不再重复列依赖。
> 与 `.specify/memory/constitution.md` 的「技术栈基线」保持一致；两者冲突时以 constitution 为准并立即修正本文件。
> Agent 需要引入白名单之外的依赖时，必须按 CLAUDE.md 铁律 2 **STOP** 上报，不得自行安装或改构建文件。

## 1. 运行时依赖（生产代码允许）

版本统一由 BOM（`dependencyManagement`）管理，禁止在子模块随意指定版本。

| 类别 | 允许项 | 说明 |
|---|---|---|
| 语言/运行时 | Java 17+ | 不使用已废弃 API |
| Web 框架 | Spring Boot 3.5.x | 以官方兼容矩阵为准；平台底座为 3.5.15（ADR-001） |
| 微服务 | Spring Cloud 2023.0.x、Spring Cloud Alibaba 2023.0.x | 升版需 ADR |
| 注册/配置 | Nacos 2.x | 按环境隔离 namespace |
| 流量治理 | Sentinel、Spring Cloud Gateway | 超时/熔断/限流为硬要求 |
| 消息 | RocketMQ Client | 事务消息用于跨服务最终一致 |
| 分布式事务 | Seata（受限） | 需 ADR；优先本地消息表 |
| 持久化 | MySQL 8.0 Driver、MyBatis-Plus、Flyway | 一服务一库；DDL 版本化 |
| 缓存 | Redis Client（Lettuce / Redisson 二选一） | key 必须带业务前缀与 TTL |
| 可观测 | Micrometer、Prometheus Registry、SkyWalking Agent | traceId 全链路 |
| 前端 | Vue 3、TypeScript、Vite、Pinia、Vue Router、antdv-next、axios、pnpm | 类型由 OpenAPI 生成；明细见 §1.2（2026-11-01 升版，ADR-002） |

**禁止**：SNAPSHOT 依赖、未审计 SDK、内部二方库跨大版本直引、`float/double` 存金额、物理外键、跨库 JOIN。

### 1.1 平台底座已核验依赖（RuoYi-Vue-Plus 5.6.2，2026-10-31）

以下为 `platform/` 实际解析出的 runtime 依赖摘要；**完整快照（175 个 artifact）**见
[`docs/evidence/deps-runtime-5.6.2.txt`](../../docs/evidence/deps-runtime-5.6.2.txt)，快照内全部条目视同已登记。
新增业务依赖不在快照内，仍走第 4 节审批流程。

| 类别 | 组件 | 版本 | 约束 |
|---|---|---|---|
| 应用框架 | Spring Boot | 3.5.15 | 平台 BOM 统一管理 |
| 持久化 | MyBatis / MyBatis-Plus | 3.5.19 / 3.5.16 | 禁止子模块自定义版本 |
| 数据库驱动 | MySQL Connector/J、PostgreSQL、MariaDB、SQL Server、Oracle | 由平台 BOM 管理 | 一服务一库 |
| 认证 | Sa-Token（core / jwt / spring-boot3-starter） | 1.45.0 | JWT Simple 模式；密钥必须环境注入 |
| 缓存 | Redisson | 3.52.0 | 与第 1 节「Lettuce / Redisson 二选一」一致：**本项目选 Redisson** |
| 工具 | Hutool | 5.8.43 | |
| 接口文档 | springdoc-openapi | 2.8.17 | |
| 映射 | MapStruct-Plus / Lombok | 1.5.0 / 1.18.44 | |
| 动态数据源 | dynamic-datasource | 4.3.1 | 多数据源场景须在 Spec 中声明 |
| 任务调度 | SnailJob（client / server） | 1.10.0 | server 端含 gRPC/Pekko/Scala，仅 `ruoyi-extend` 使用 |
| 工作流 | Warm-Flow | 1.8.5 | 业务上下文未声明前不得引用 |
| 三方登录 | JustAuth | 1.16.7 | |
| 对象存储 | AWS SDK for Java v2 | 2.28.22 | S3 兼容协议 |
| 短信 | sms4j | 3.3.5 | |
| 加密 | BouncyCastle | 1.83 | |
| 表格 | FastExcel | 1.3.0 | 替代 EasyExcel |
| 代码生成 | Velocity | 2.3 | 仅 `ruoyi-generator` 使用 |
| SQL 日志 | p6spy | 3.9.1 | 仅开发环境 |
| JSON（遗留） | fastjson | 1.2.83 | **禁止业务代码新增使用**；见 §1.3 |

### 1.2 前端依赖

> **2026-11-01 升版（CLAR-001 裁决 A / ADR-002）**：前端底座由 plus-ui（Element Plus + npm）
> 替换为 Vben Admin 5.7.0 + antdv-next + pnpm。本节分两张表：**1.2.1 目标基线**（P4 实施后唯一
> 有效）与 **1.2.2 存量过渡项**（迁移期内允许保留，P4-3 完成后必须删除）。
> 版本以 spike 实测 `D:\workstation\_spike\vben-5.7.0` 的 `pnpm-lock.yaml` 为准，见
> [`docs/evidence/vben-p1-spike.md`](../../docs/evidence/vben-p1-spike.md)。
>
> ⚠️ **与宪章的冲突待消解**：`.specify/memory/constitution.md` 第 VII 条与技术栈基线表仍写
> "Vue 3 + TS + Vite + Pinia + Element Plus"，本节已改为 antdv-next + Vben。按宪章修订流程，
> 需一次 **MINOR 修订**（ADR-002 D9，到期 2026-11-15）。宪章未修订前，本节的 Vben 基线
> **仅对 P4-1 起的适配层落地有效**；冲突不影响 P3 Spec Packet 编写。

#### 1.2.1 目标基线（Vben Admin 5.7.0 / `apps/web-antdv-next`）

| 类别 | 组件 | 版本 | 作用域 | 许可证 |
|---|---|---|---|---|
| 框架 | vue / vue-router / pinia | 3.5.34 / 5.0.7 / 3.0.4 | runtime | MIT |
| 语言/构建 | typescript / vite | 6.0.3 / 8.0.13 | dev | Apache-2.0 / MIT |
| UI 库 | antdv-next | 1.3.0 | runtime | MIT |
| 框架包 | `@vben/access`、`@vben/common-ui`、`@vben/constants`、`@vben/hooks`、`@vben/icons`、`@vben/layouts`、`@vben/locales`、`@vben/plugins`、`@vben/preferences`、`@vben/request`、`@vben/stores`、`@vben/styles`、`@vben/types`、`@vben/utils`（共 14 个） | workspace（仓库内源码） | runtime | MIT |
| 表格 | vxe-table / vxe-pc-ui | 4.18.13 / 4.14.16 | runtime（经 `@vben/plugins`） | MIT |
| 图表 | echarts | 6.1.0 | runtime（经 `@vben/plugins`） | Apache-2.0 |
| 富文本 | @tiptap/core、@tiptap/vue-3、@tiptap/starter-kit 及官方扩展 | 3.23.x | runtime（经 `@vben/plugins`） | MIT |
| 样式基座 | tailwindcss（v4）/ reka-ui | 4.3.x / 2.9.7 | runtime（构建 + 组件基座） | MIT |
| 组合式工具 | @vueuse/core | 14.x | runtime | MIT |
| 日期 | dayjs | 1.11.x | runtime | MIT |
| 加密 | crypto-js / jsencrypt | 4.2.0 / 3.5.4 | runtime | MIT |
| 请求内核 | axios（经 `@vben/request`） | 1.13.x | runtime | MIT |
| 国际化 | vue-i18n | 11.x | runtime | MIT |
| 其他工具 | await-to-js、file-saver、js-cookie、nprogress、screenfull、highlight.js、vue-json-pretty、json-bigint、qrcode、tippy.js | 沿用 Vben 锁文件 | runtime | MIT / BSD-3-Clause |
| 包管理 | pnpm（`packageManager: pnpm@10.33.4`，经 Corepack） | 10.33.4 | toolchain | MIT |

**许可证例外（已采集，不进运行时产物或可选许可）**：

- `@commitlint/*` — GPL-3.0，**仅 devDependency**
- `lightningcss` — MPL-2.0，构建期
- `zod-defaults` — 许可证为 Unknown（运行时，经 `@vben/common-ui` form-ui 链路引入）；升级或替换前需复核
- `node-forge` — BSD-3-Clause / GPL-2.0 双许可，取 BSD-3-Clause

#### 1.2.2 存量过渡项（迁移期保留，P4-3 后删除）

| 类别 | 组件 | 说明 |
|---|---|---|
| UI | element-plus、@element-plus/icons-vue | 仅 plus-ui 存量代码使用；随 `frontend/` 旧代码一并删除 |
| 富文本 | @vueup/vue-quill | 仅 plus-ui 存量；目标基线改用 Vben 内置 tiptap，相关页面迁移时重写（见 ADR-002 C10） |
| 框架 | 沿用现有 `frontend/package.json` 依赖 | 不得新增、不得升级 |
| 包管理 | npm | 仅用于迁移前构建；P4-1 起前端统一为 pnpm |


### 1.3 安全复核项（已登记但受限）

- **fastjson 1.2.83**：历史 CVE 密集，仅允许平台既有代码路径使用；业务代码禁止新增 `com.alibaba.fastjson` 引用，统一用 Jackson。
- **p6spy 3.9.1**：仅开发环境开启，生产配置必须关闭。
- **MySQL Connector/J 9.7.0**：需在 P1 的 CVE 扫描中确认与目标 MySQL 8.0 服务端兼容性。

## 2. 测试与质量工具（仅测试/构建期，不进入生产包）

| 类别 | 允许项 | 说明 |
|---|---|---|
| 单元测试 | JUnit 5、AssertJ、Mockito | domain 层覆盖率 ≥ 70% |
| 架构测试 | ArchUnit | 依赖方向违规即构建失败 |
| 集成测试 | Testcontainers、Spring Boot Test | 仓储与契约测试 |
| 契约测试 | OpenAPI 生成器 + 兼容性校验 | 消费方/提供方契约 |
| 前端单元/组件测试 | Vitest、@vue/test-utils、@vitest/coverage-v8、jsdom | 与源码同目录，`*.test.ts` |
| 前端端到端 | @playwright/test、playwright-core | 用系统 Edge/Chrome，不下载浏览器二进制 |
| 静态检查 | SonarQube、Spotless/Checkstyle、ESLint、vue-tsc | CI 强制 |
| 安全扫描 | CVE 扫描器（由 CI 提供）、secret 扫描 | 高危 7 天、中危 30 天 |

## 3. 评测执行器工具链（仅 `specs/evals/run.py`）

评测器是交付门禁工具，不属于业务运行时；允许独立于第 1 节的运行时白名单：

| 依赖 | 版本 | 用途 |
|---|---|---|
| Python | 3.11+ | 运行 `specs/evals/run.py` |
| PyYAML | 6.x | 解析 `cases.yaml` |

新增工具链依赖同样需要审批并登记到本节。

## 4. 新增依赖审批流程

1. Agent 输出 `⚠️ STOP: CLAR`，说明依赖名、版本、用途、替代方案。
2. `/clarify` 写入 `clarifications/`，等待架构/安全裁决。
3. 裁决通过后，由维护者在本文件登记（类别、版本、用途、到期复核日）。
4. 更新 BOM 或构建文件；CI 校验实际依赖树 ⊆ 本白名单。

## 5. 机器校验口径

- 运行时：`mvn dependency:tree` 的全部 `compile/runtime` 依赖必须能在第 1 节找到对应条目。
- 前端：`pnpm-workspace.yaml` 下各 workspace 包的 `dependencies` 必须能在 §1.2 找到对应条目；
  `devDependencies` 只校验无高危许可证（§1.2.1 例外栏已登记的除外）。迁移期内 plus-ui 存量依赖
  按 §1.2.2 校验（只减不增）。
- 评测器：`specs/evals/run.py` 只允许 `stdlib` + 第 3 节列出的依赖。

## 6. 变更记录

| 日期 | 变更 | 依据 | 批准人 |
|---|---|---|---|
| 2026-10-31 | 初版建立（平台底座 5.6.2 依赖快照） | ADR-001 | 架构负责人 |
| 2026-11-01 | §1.2 增补 Vben Admin 5.7.0 前端栈；新增 §1.2.2 存量过渡项；§5 前端校验口径改 pnpm | ADR-002 / CLAR-001 裁决 A | PM（CLAR-001） |
| 2026-11-01 | §2 增补前端测试工具（Vitest / @vue/test-utils / coverage-v8 / jsdom / Playwright） | plan.md Post-Design Re-check（001-vben-frontend-replacement） | 架构负责人 |
