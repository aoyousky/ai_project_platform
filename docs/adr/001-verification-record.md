# ADR-001 核验记录（P0-1）

- **核验对象**：RuoYi-Vue-Plus `6.X`
- **核验时间**：2026-10-31
- **核验方式**：在仓库外临时目录浅克隆后静态读取（`git clone --depth 1`），未构建、未启动
- **源码坐标**：branch `6.X`，commit `9227f626a3a37e1546d6c291ed398183e94df92b`（2026-09-28）
- **前端坐标**：`CrazyLionCat/plus-ui`，branch `6.X-Vue`（默认分支），commit `a85754cdc4410d13a6db9b57dd8461ea6e33d45c`，version `6.0.0`
- **对照样本**：`5.X` 分支根 pom 与目录树（用于确认多租户能力差异）

> 结论先行：第一轮（6.X）10 项核验全部有结论，其中多租户缺失构成阻断项；2026-10-31 裁决“不需要多租户 + 不接受 Spring Boot 4.1 生态风险”后，6.X 出局，第二轮改核 5.X 并选定，见 §4。

---

## 1. 逐项核验结果

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 1 | Spring Boot / Java 版本 | **Spring Boot 4.1.1，Java 21**（`spring-boot-admin 4.1.2`、`springdoc 3.1.1`、`spring-ai 2.0.1`） | 根 `pom.xml` properties |
| 2 | 代码生成器 | 保留，`ruoyi-modules/ruoyi-gen`；FreeMarker 模板 `fm/{java,vue,react,xml,sql}`；默认包 `org.dromara.system`；产物为 zip 流下载 | `generator.yml`、`GenController` |
| 3 | 是否内置 Flyway/Liquibase | **均无**；DDL 只有初始化脚本 `script/sql/ry_vue.sql`（24 张表）+ `ry_job/ry_workflow/ry_ai` | 全仓 pom/yml/java 检索无命中 |
| 4 | Sa-Token JWT 与刷新 | 集成 JWT **简单模式**（`StpLogicJwtForSimple`）；`token-name: Authorization`；`jwt-secret-key` 明文写在 `application.yml`，默认值为弱密钥 `abcdefghijklmnopqrstuvwxyz` | `SaTokenConfig.java:31`、`application.yml:88-96` |
| 5 | 多租户 | **6.X 已无多租户**：无 `ruoyi-common-tenant`、拦截器链未注册 `TenantLineInnerInterceptor`、`ry_vue.sql` 24 张表 0 个 `tenant` 列；5.X 存在 `ruoyi-common-tenant` 与 48 处 tenant 路径 | 模块清单、`MybatisPlusConfig`、DDL 检索；5.X 目录树 |
| 6 | 数据权限范围与绕过 | 注解 `@DataPermission(DataColumn[], joinStr)` + `PlusDataPermissionInterceptor` + `DataPermissionPointcutAdvisor`；绕过有两条路径：MP 原生 `@InterceptorIgnore(dataPermission = "true")` 与线程上下文 `DataPermissionIgnoreContext` | `ruoyi-common-mybatis`（35 个类） |
| 7 | 模块依赖环 / 反向依赖 | 40 个 pom **无环**；`ruoyi-common-*` 只依赖 common 与 `ruoyi-api`，**不依赖任何业务模块**；业务模块之间互不依赖；`ruoyi-admin` 单向聚合 | 全量 pom 解析（DFS 环检测） |
| 8 | 前端可裁剪性 | 独立仓库 `plus-ui`（6.X-Vue）：Vue 3 + TS + Vite + Pinia + Vue Router + Element Plus，可裁剪；但另带 `vxe-table/vxe-pc-ui`、`@wangeditor-next`、`echarts`、`unocss`，非零成本 | `plus-ui/package.json` |
| 9 | 三方许可证 | Warm-Flow 1.8.9 **Apache-2.0**；SnailJob 2.0.2 **Apache-2.0**；JustAuth 3.0.1 **MIT**；主仓 **MIT** | GitHub API `/repos/{owner}/{repo}` |
| 10 | 活跃度 | `v6.0.0`（2026-07-30）、`v5.6.2`（2026-06-17）、`v5.6.1`（2026-04-24）… 近 12 个月按月发布；仓库最后推送 2026-10-30 | GitHub Releases API |

## 2. 清单外的重要发现

1. **无 Spring Cloud 任何依赖**（pom 中 nacos / feign / sentinel / rocketmq 均无命中）——D3「模块化单体」得到确证，不是"暂未启用"而是"根本没有"。
2. **测试基线只在公共模块**：59 个测试类全部位于 `ruoyi-common-*`；`ruoyi-system`、`ruoyi-job`、`ruoyi-workflow`、`ruoyi-gen`、`ruoyi-ai` 的 `src/test` 为空——业务模块没有任何可参照的测试范式，ArchUnit 与领域测试需自建。
3. **模块命名与 ADR §2 不符**：实际为 `ruoyi-system` / `ruoyi-job` / `ruoyi-gen` / `ruoyi-workflow`，不是 `ruoyi-modules-system` 等；且 `ruoyi-common-{log,mybatis,satoken,push}` 反向依赖 `ruoyi-api`（共享 API 模块），属可接受耦合但需在红线文档中写明。
4. **5.X 基线**：Spring Boot 3.5.16 + Java 17 + Sa-Token 1.45.0 + MyBatis-Plus 3.5.16，且**带多租户模块**。

## 3. 核验局限（未验证项）

- 未执行 `mvn verify`，因此"6.X 在 JDK 21 上可构建"仅由 pom 声明，未取得构建证据。
- 未核验 Spring Boot 4.1 与 MyBatis-Plus 3.5.17 / Sa-Token 1.46.0 / Warm-Flow 1.8.9 的运行期兼容性（只确认存在 `sb4` 专用 starter）。
- 未逐条审计全部三方依赖的 CVE 与传递依赖，留待 P0-3 白名单登记时用 `dependency:tree` 补证。
- GitHub API 未返回 `dromara/snail-job` 与 `justauth/JustAuth`，改用 `aizuda/snail-job`、`JustAuth/JustAuth` 确证许可证。

---

# 第二轮：5.X 核验（决策依据）

- **核验对象**：RuoYi-Vue-Plus tag `v5.6.2`
- **源码坐标**：commit `8136a0191a2258c0e1b36a8146a1c5ebc070c139`（2026-06-17）；分支 `5.X` head `815087e7`（2026-09-07）
- **前端坐标**：`CrazyLionCat/plus-ui` branch `5.X`，version `5.6.2-2.6.2`
- **触发**：2026-10-31 裁决——多租户非必需、不接受 Spring Boot 4.1 生态风险

## 1. 逐项结果

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 1 | Spring Boot / Java | **3.5.15 / Java 17**（springdoc 2.8.17、SBA 3.5.8、Sa-Token 1.45.0、MyBatis-Plus 3.5.16） | 根 `pom.xml` properties |
| 2 | 代码生成器 | 保留，`ruoyi-modules/ruoyi-generator`；模板 `vm/{java,ts,vue,xml,sql}`；默认包 `org.dromara.system` | 模块目录、`generator.yml` |
| 3 | Flyway/Liquibase | **均无**；`script/sql/ry_vue_5.X.sql` 25 张表 | 全仓 pom/yml 检索无命中 |
| 4 | Sa-Token JWT | `StpLogicJwtForSimple`；`token-name: Authorization`；`jwt-secret-key` 默认弱密钥 | `SaTokenConfig.java:27`、`application.yml:96-104` |
| 5 | 多租户 | 存在：`ruoyi-common-tenant`（9 个类：`TenantEntity`、`TenantHelper`、`PlusTenantLineHandler`、`TenantSpringCacheManager`、`TenantSaTokenDao` 等）；DDL 25 表中 33 处 `tenant` | 模块源码、`ry_vue_5.X.sql` |
| 6 | 数据权限 | 注解 + 拦截器 + 线程上下文绕过（与 6.X 同源实现） | `ruoyi-common-mybatis` |
| 7 | 依赖环 | 36 个 pom **无环**；common 无反向依赖业务模块 | 全量 pom DFS 检测 |
| 8 | 前端 | `plus-ui` 5.X：Vue 3 + TS + Element Plus + Pinia + Router；额外 `vxe-table`、`echarts`、`@vueup/vue-quill` | `plus-ui@5.X/package.json` |
| 9 | 许可证 | Warm-Flow 1.8.5 Apache-2.0、SnailJob 1.10.0 Apache-2.0、JustAuth 1.16.7 MIT、主仓 MIT | 根 pom 版本 + GitHub API |
| 10 | 活跃度 | 5.X 发版至 v5.6.2（2026-06-17），分支提交至 2026-09-07；主线已转向 6.X | Git tag / branch API |

## 2. 与 6.X 的差异（决策相关）

| 维度 | 5.X v5.6.2 | 6.X @ 9227f62 |
|---|---|---|
| 运行时基线 | SB 3.5.15 / Java 17 | **SB 4.1.1 / Java 21** |
| 多租户 | 有（默认启用） | 无 |
| 测试类数量 | **4** | 59（全在 common） |
| 代码生成器 | `ruoyi-generator`（vm 模板） | `ruoyi-gen`（fm 模板） |
| 工作流 / 调度 | Warm-Flow 1.8.5 / SnailJob 1.10.0 | Warm-Flow 1.8.9 / SnailJob 2.0.2 |
| 公共模块 | 含 idempotent / ratelimiter / websocket / sse | 含 ai / mcp / liteflow / mqtt / push / elasticsearch |
| 前端 | plus-ui 5.X（Vue3 + ElementPlus） | plus-ui 6.X-Vue（同栈） |

## 3. 构建与测试实测（导入 `platform/` 后）

| 命令 | 结果 |
|---|---|
| `mvn verify`（默认） | **BUILD SUCCESS**，16.4 min，全部模块编译 + 打包通过；日志中 surefire 显示 `Tests are skipped` |
| `mvn verify -DskipTests=false` | **BUILD FAILURE**：`ruoyi-admin` 的 `TagUnitTest`（`@SpringBootTest`）无法创建 `dataSource`，`Could not create connection to database server` |

结论：5.X 的 4 个测试类全部位于 `ruoyi-admin/src/test`，且都是演示性质（断言/参数/标签示例），
`TagUnitTest` 还依赖真实 MySQL 与 Redis。**平台不存在可直接运行的测试基线**，D8 由此从“推断”变为“实测”。

## 4. 核验局限（5.X）

- 未逐条审计传递依赖 CVE，留待 P1 的 CVE 扫描。
- `plus-ui` 未安装依赖、未构建，仅核验 `package.json`。
- 未在真实 MySQL/Redis 环境下启动应用，运行时行为未验证。
