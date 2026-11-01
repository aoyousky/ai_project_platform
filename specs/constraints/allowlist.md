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
| 前端 | Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、axios | 类型由 OpenAPI 生成 |

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

### 1.2 前端依赖（plus-ui 5.X，version 5.6.2-2.6.2）

| 类别 | 组件 |
|---|---|
| 框架 | vue 3、vue-router、pinia、typescript、vite |
| UI | element-plus、@element-plus/icons-vue |
| 表格 | vxe-table、vxe-pc-ui |
| 图表 | echarts |
| 富文本 | @vueup/vue-quill |
| 工具 | axios、@vueuse/core、await-to-js、animate.css、nprogress、screenfull、js-cookie、jsencrypt、crypto-js、file-saver、image-conversion、vue-cropper、vue-i18n、vue-json-pretty、vue-types、highlight.js、@highlightjs/vue-plugin |

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
- 前端：`package.json` 的 `dependencies` 必须能在第 1 节找到对应条目。
- 评测器：`specs/evals/run.py` 只允许 `stdlib` + 第 3 节列出的依赖。
