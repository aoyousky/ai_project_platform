# ADR-001：企业级交付脚手架选型

- **状态**：Proposed（决策已定；依赖的宪章基线 1.1.0 已于 2026-11-01 签字生效，ADR 本体签署待确认）
- **日期**：2026-10-31（v2，覆盖同日 v1 的 6.X 结论）
- **责任人**：架构负责人（待指定）
- **复核到期日**：2027-04-30（复核 Spring Boot 基线、Spring Cloud 拆分、是否切换 6.X）
- **关联**：宪章 I / II / V / VI / VII / VIII / XI / XII；`specs/constraints/allowlist.md`
- **核验记录**：[001-verification-record.md](001-verification-record.md)

---

## 1. 背景

本仓库是 AI 交付框架，需要为下游企业项目提供一套“基础功能完善、业务团队只写业务”的脚手架。选型必须同时满足：

1. 企业级基础能力齐备（RBAC、数据权限、字典、日志、文件、任务、代码生成）
2. AI 模式可交付（目录唯一落点、约定少而硬、平台层与业务层边界清晰）
3. 与宪章的技术基线、分层原则可收敛（允许以本 ADR 记录的偏离为代价）
4. **不引入未成熟的运行时基线**（2026-10-31 追加约束：不接受 Spring Boot 4.1 生态风险）
5. 多租户**不在本次要求内**（2026-10-31 明确）

## 2. 决策

**采用 RuoYi-Vue-Plus 5.X（v5.6.2 为基线 tag）作为平台底座**，代码落点为仓库内 `platform/`（来源、commit 与只读约束见 `platform/PROVENANCE.md`），并执行以下约束：

1. 平台模块（`ruoyi-common-*`、`ruoyi-modules/*` 下的 `ruoyi-system`、`ruoyi-job`、`ruoyi-generator`、`ruoyi-workflow`、`ruoyi-demo`，以及 `ruoyi-extend/*`）视为**框架层，只读**；AI 与业务团队不得直接修改，需改动时另提 ADR。
   - **唯一可写接缝**（三处，2026-11-01 增补第 3 处）：
     1. `platform/pom.xml` 的 `<modules>` 列表——追加业务模块；
     2. `platform/ruoyi-admin/pom.xml` 的 `<dependencies>`——把业务模块挂进启动工程；
     3. `platform/ruoyi-admin/src/main/resources/` 下的**配置文件**（`application*.yml`、`logback-plus.xml`、`banner.txt`）——仅允许改配置项取值，**禁止改 Java 源码、禁止改变配置结构**。增设原因是：多租户开关（`tenant.enable`）与 JWT 密钥（`sa-token.jwt-secret-key`）只存在于该目录，而二者都必须偏离上游默认值（见 §9）。
     
     除此之外任何既有文件不得改动。
   - 业务代码包名统一 `org.dromara.business.<context>`（启动类在 `org.dromara`，自动扫描生效）；MyBatis 扫描已配置为 `org.dromara.**.mapper`，仓储实现按 `...infrastructure.mapper` 放置即可被发现。
2. 新业务一律落在 `business/<bounded-context>/` 的 DDD 四层模块内，结构固定为：
   ```
   business/<context>/
     interfaces/    # Controller、DTO、协议转换
     application/   # 用例编排、事务边界、鉴权、幂等
     domain/        # 聚合、值对象、领域事件、仓储接口（零框架依赖）
     infrastructure/# 仓储实现、外部适配
   ```
3. 前端沿用 `plus-ui` 5.X 基线（tag `v5.6.2-v2.6.2`：Vue 3 + TypeScript + Vite + Element Plus），**与后端同仓**，落点 `frontend/`（来源与只读约束见 `frontend/PROVENANCE.md`）。
   - 前端同样视为**框架层只读**，可写接缝仅三处：`src/views/<context>/`、`src/api/<context>/`、`.env.{development,production}` 的配置项取值。
   - 业务目录名 `src/views/<context>` 与后端 `business/<context>` 一一对应，便于按上下文整体交付。
   - `package-lock.json` 必须入库（上游 `.gitignore` 忽略锁文件，本项目不复用该规则）。
4. 代码生成器只作为“初稿生成器”，生成物必须落在 `business/` 下并通过 ArchUnit 校验后才算交付。
5. **多租户模块保留但不启用**：业务代码继承 `BaseEntity`，不得继承 `TenantEntity`；如需启用须另提 ADR。

## 3. 偏离宪章的项与处置

| # | 宪章条款 | 偏离事实（已核验） | 处置 | 到期 |
|---|---|---|---|---|
| D1 | 技术栈基线：Spring Boot 3.2.x | 5.X 为 **Spring Boot 3.5.15 / Java 17**（同一大版本线，跨 3 个 minor） | 出基线修订（MINOR），同步改宪章；做一次全量回归 | 2026-11-15 |
| D2 | 原则 II：DDD 四层 | 平台模块为事务脚本分层 | 本 ADR 豁免**平台模块**；`business/**` 仍强制四层，ArchUnit 固化 | 复核日重评 |
| D3 | 原则 VI：Spring Cloud（Nacos/Feign/Sentinel/RocketMQ） | 5.X **无任何 Spring Cloud 依赖**，为模块化单体 | 前期以模块化单体交付，限界上下文边界显式化；拆分方案见 §6 | 2027-04-30 |
| D4 | 原则 V：Flyway | 无 Flyway/Liquibase，只有 `script/sql/ry_vue_5.X.sql` 初始化脚本 | 以独立模块 `db/migrations/` 接入 Flyway（不改 `platform/`），V1/V2 固化为 5.6.2 快照；**已完成并实测** | 2026-11-15 |
| D5 | 原则 IV：OAuth2 / JWT | Sa-Token **JWT 简单模式**（`StpLogicJwtForSimple`）：token 为 JWT 形态，但会话态仍在 Redis；默认密钥 `abcdefghijklmnopqrstuvwxyz` 写死在 yml | 保留 Simple 模式（保留踢人能力），**密钥必须改为环境注入**；OAuth2 在网关层后补 | 2026-11-15（密钥）/ 2027-04-30（OAuth2） |
| D6 | 原则 XI：依赖白名单 | 脚手架依赖未登记 | 一次性批量登记到 `allowlist.md`，未登记依赖禁止进入实现 | 2026-11-10 |
| D7 | 原则 VII：前端同仓交付 | ~~前端为独立仓库~~ 已于 2026-11-01 迁入 `frontend/`（`plus-ui` tag `v5.6.2-v2.6.2`） | **偏离关闭**：前端纳入只读底座 + 业务接缝（`src/views/<context>/`、`src/api/<context>/`、`.env.*` 取值），规则见红线 R8 | 关闭 |
| D8 | 原则 VIII：测试基线 | 后端 5.X 全仓**仅 4 个测试类**；前端 `frontend/` **零测试文件**（vitest 仅在 devDependencies） | 自建测试骨架：ArchUnit 规则 + domain 单测模板 + 契约测试；前端测试基线待 P1 补 | 2026-11-15（后端）/ P1（前端） |

## 4. 放弃的备选方案

| 方案 | 放弃原因 |
|---|---|
| **RuoYi-Vue-Plus 6.X** | 基线为 **Spring Boot 4.1.1 / Java 21**，跨 3→4 两个大版本；只确证存在 `sb4` 专用 starter，无运行期兼容证据。按 2026-10-31 追加约束（不接受 Boot 4.1 生态风险）出局。附带事实：6.X 已移除多租户，且业务模块零测试 |
| ContiNew Admin 5.X | 基线贴合（SB 3.2.7），但前端 Arco Design 与宪章 VII 冲突、Liquibase 与 V 冲突、starter 为 LGPL；换 UI 库的长期成本高于升 SB minor |
| yudao-boot-mini | Spring Security + Element Plus 最合宪，但模块数量大、体量大，AI 放错位置的概率显著上升 |
| JHipster Lite | 原生六边形架构最合宪章 II，但 RBAC/字典等基础功能需自建，与“基础功能完善、只写业务”目标冲突 |
| 自建薄骨架 | 最可控，但交付启动慢 2–3 周，且平台能力需自行维护 |

## 5. 后果

**正面**
- 基础能力开箱即用：RBAC、数据权限、字典、日志、文件、任务、代码生成、幂等、限流
- 前端与宪章 VII 完全一致（Vue 3 + TS + Element Plus），无 UI 迁移成本
- MIT 许可，商用无授权风险；Warm-Flow / SnailJob 为 Apache-2.0
- 模块化单体对 AI 更友好：编译快、调试链路短、边界可见
- 基线只比宪章高 3 个 minor，升级与回退成本可控

**负面 / 风险**
- 5.X 是上一大版本线（6.0.0 已于 2026-07-30 发布），存在“一年后被迫升级”的路线风险；复核日必须重评
- 测试基线几乎为零（4 个测试类），ArchUnit、领域测试、契约测试都需要自建
- 自带工作流、OSS、多数据源、多租户等重型能力，依赖面大，白名单会显著变长
- 模块化单体与宪章 VI 暂不一致，未来拆服务需要额外设计

## 6. 落地计划

| 阶段 | 任务 | 验收标准 |
|---|---|---|
| P0-1 | clone `v5.6.2`，核验 §8 清单 | 清单逐项有结论，记录版本号与 commit（**已完成**） |
| P0-2 | 基线修订（3.2.x → 3.5.x）+ 宪章修订 | **已完成（2026-10-31）**：宪章升至 1.1.0；`platform/` 在 Java 17.0.12 + Maven 3.9.14 下 `mvn verify` → BUILD SUCCESS（默认跳过测试；显式开启则因缺 DB 失败，见构建注意） |
| P0-3 | 依赖批量登记 `allowlist.md` | **已完成（2026-10-31）**：175 个 runtime artifact 快照 + 前端依赖表；证据 `docs/evidence/deps-runtime-5.6.2.txt` |
| P0-4 | 接入 Flyway（独立模块 `db/migrations/`） | **已完成（2026-10-31）**：MySQL 8.0.40 空库首次迁移建 37 表；二次执行 `Schema is up to date`；历史表 V1/V2 均 success |
| P0-5 | DDD 业务模块原型 + ArchUnit | **已完成（2026-10-31）**：`business/{archetype,archunit}`；5 条依赖规则 + 合规/违规夹具，`mvn clean test` 7/7 通过；反向验证（临时造跨层依赖）构建失败，证据 `docs/evidence/p0-5-archunit-gate.md`；CI 新增 `architecture` job |
| P0-6 | 固化 AI 红线文档（平台只读 / 业务可写 / 多租户禁用 / 密钥规范） | **已完成（2026-11-01）**：`docs/AI-DELIVERY-REDLINES.md`（7 条 + 强制方式表）；同步落地配置偏离 `tenant.enable=false`、`jwt-secret-key=${SA_TOKEN_JWT_SECRET}`，证据 `docs/evidence/p0-6-platform-config.md` |
| P0-7 | 前端 `plus-ui` 迁入 `frontend/` | **已完成（2026-11-01）**：tag `v5.6.2-v2.6.2`，360 文件 / 2.9 MB；`npm install` 575 包、`npm ci --dry-run` 通过、`npm run build:prod` EXIT=0、dist 8.0 MB；证据 `docs/evidence/frontend-import.md`；CI 新增 `frontend` job |
| P0-8 | 本地 Docker 容器启动并验证脚手架可访问 | **已完成（2026-11-01）**：`deploy/` 一键启动 4 容器 + `db-init`；前端 200、后端 `Started in 166s`、36 张业务表、中文完整（hex `E7..`）、登录→`getInfo`→`user/list`→`getRouters` 全链路通；证据 `docs/evidence/docker-verify.md` |
| P0-9 | 前端已有功能巡检（真实浏览器 + 真实加密登录） | **已完成（2026-11-01）**：Headless Edge 驱动，真实 RSA+AES 登录（未关 `api-decrypt`/`captcha`），菜单 39 叶子页中 32 个实访、**31 个通过**，30 页渲染出表格数据；**发现并修复 1 个真实缺陷**——`deploy/nginx/default.conf` 静态资源正则 location 劫持 `/prod-api/` 下以 `.js/.css` 结尾的请求，导致流程设计器整页不可用（后端直连 200），已加 `^~` 修复并复验；证据 `docs/evidence/frontend-verify.md` |
| P1 | 补 OpenAPI 校验、覆盖率门禁、CVE 扫描、前端测试基线 | 接入 `scripts/ci-gate.sh` |

**构建注意（P0-2 实测）**：`platform/pom.xml` 默认 `<skipTests>true</skipTests>`，`mvn verify` 显示 `Tests are skipped`；显式 `-DskipTests=false` 则 **BUILD FAILURE**——`ruoyi-admin` 的 `TagUnitTest`（`@SpringBootTest`）要连真实 MySQL/Redis，报 `Could not create connection to database server`。因此：

- 任何声称“测试通过”的交付，必须显式使用 `mvn verify -DskipTests=false` 并给出 Tests run 统计；
- 平台侧 4 个测试类均为演示性质，**不存在可用测试基线**（D8 实测确认）；
- 业务模块的测试必须自包含（单元测试不依赖 Spring 容器；集成测试用 Testcontainers 或专用 profile），不得沿用平台的 `@SpringBootTest` 演示写法。

**拆分预案（D3）**：当单个业务上下文的团队规模或发布频率超过阈值时，按 `business/<context>` 边界拆为独立服务，接口先行、数据独立，不在同一事务内跨上下文写。

**升级预案（6.X）**：复核日（2027-04-30）重评 Spring Boot 4.x 生态成熟度（MyBatis-Plus / Sa-Token / Warm-Flow 的运行期证据、社区 issue 密度）；满足条件时另提 ADR 迁移。

## 7. 验证方式

- ArchUnit 规则作为构建门禁
- `scripts/ci-gate.sh` 第 5 道评测集覆盖业务接口
- 每次升级脚手架版本必须复核 §3 偏离表，未消除的偏离需续期并说明原因

## 8. 定稿前实地核验清单（P0-1，5.X 已完成）

> 逐项证据见 [001-verification-record.md](001-verification-record.md)。核验坐标：tag `v5.6.2` @ `8136a01`（2026-06-17）；分支 `5.X` head `815087e7`（2026-09-07）。

- [x] 实际 Spring Boot / Java 版本 → **Spring Boot 3.5.15 / Java 17**
- [x] 代码生成器是否保留、生成物默认落点 → 保留（`ruoyi-generator`）；模板 `vm/{java,ts,vue,xml,sql}`；默认包 `org.dromara.system`
- [x] 是否内置 Flyway → **否**
- [x] Sa-Token 的 JWT 模式与刷新机制 → `StpLogicJwtForSimple`；**默认弱密钥，必须改**
- [x] 多租户隔离方式 → 有 `ruoyi-common-tenant`（9 个类，行级 `tenant_id` + 缓存/会话隔离）；**本次不启用**
- [x] 数据权限拦截器的作用范围与绕过方式 → 注解 + 拦截器；`@InterceptorIgnore` 与线程上下文两条绕过路径
- [x] 模块依赖图是否存在环 → **无环**；`ruoyi-common-*` 不反向依赖业务模块
- [x] 前端是否可裁剪 → `plus-ui` 5.X（Vue3 + TS + Element Plus），可裁剪；额外带 vxe-table / echarts / vue-quill
- [x] 第三方依赖许可证清单 → Warm-Flow 1.8.5 Apache-2.0、SnailJob 1.10.0 Apache-2.0、JustAuth 1.16.7 MIT、主仓 MIT
- [x] 官方文档与社区活跃度 → 5.X 按月发版至 2026-06-17，分支仍有提交至 2026-09-07；6.0.0 后主线转向 6.X

## 9. 决策记录

**2026-10-31 裁决输入**：① 目标业务不要求单实例多租户；② 不接受 Spring Boot 4.1 生态风险。

**推论**：6.X（SB 4.1.1）与两项输入均冲突，出局；5.X 满足“无多租户需求 + 基线仅 3.5.15”两项条件，且具备全部基础能力，故选定 5.X。

**遗留裁决点**（不阻断 P0）：是否在 P1 阶段关闭多租户模块（减少 `tenant_id` 相关的 AI 误用面）。当前口径是“保留不启用”，理由是可回退且改动面小；若红线文档评审认为误用风险更高，再走模块裁剪。

**2026-10-31 补充裁决（D4 落点）**：Flyway 以独立模块 `db/migrations/` 接入，**不扩大 `platform/` 可写接缝**。代价是迁移不在应用启动时自动执行，改为发布前/CI 显式执行；换取的是平台升级时无补丁负担。

**2026-11-01 裁决（接缝 3 + 遗留裁决点关闭）**：P0-6 编写红线文档时发现两处上游默认值必须偏离——`sa-token.jwt-secret-key` 是仓库公开的弱密钥，`tenant.enable` 默认为 `true`（与“不做多租户”冲突）。二者都只存在于 `platform/ruoyi-admin/src/main/resources/`，不在既有两个接缝内。经裁决：**把该 resources 目录加入可写接缝，但仅限改配置项取值**，禁止改 Java 源码与配置结构。同时关闭 2026-10-31 的遗留裁决点：多租户从“保留不启用”改为“配置层关闭（`enable: false`）”，租户管理接口随之不注册，代码保留以便回退。密钥改为无默认值的 `${SA_TOKEN_JWT_SECRET}`，缺失即启动失败。证据：`docs/evidence/p0-6-platform-config.md`。

**2026-11-01 裁决（前端同仓）**：前端 `plus-ui` 由"独立仓库"改为**迁入本仓 `frontend/`**，tag 与后端配套（`v5.6.2-v2.6.2`），D7 偏离随之关闭。处置要点：① 前端与后端同等对待——框架代码只读，可写接缝仅 `src/views/<context>/`、`src/api/<context>/`、`.env.*` 配置取值；② 业务目录名与后端限界上下文同名，一次交付覆盖前后端；③ 上游 `.gitignore` 忽略锁文件，本项目改为 `package-lock.json` 入库，记入 `frontend/PROVENANCE.md` 已登记改动；④ 前端零测试基线，补测列入 P1。

**与 v1 的关系**：v1 基于 6.X 且依据未核验的版本检索结论（3.4/3.5），已作废，本版为唯一有效版本。

## 10. 参考

- [dromara/RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus)
- [RuoYi-Vue-Plus 5.X README](https://github.com/yunzhao824/RuoYi-Vue-Plus/blob/5.X/README.md)
- [plus-ui 5.X](https://github.com/CrazyLionCat/plus-ui/tree/5.X)
- [ContiNew Admin](https://github.com/continew-org/continew-admin)
- [yudao / ruoyi-vue-pro](https://gitee.com/zhijiantianya/ruoyi-vue-pro)
- [JHipster Lite](https://github.com/jhipster/jhipster-lite)
