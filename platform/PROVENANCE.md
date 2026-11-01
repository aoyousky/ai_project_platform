# platform/ 来源与使用约束

## 来源

| 项 | 值 |
|---|---|
| 上游 | [dromara/RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus) |
| 版本 | tag `v5.6.2` |
| commit | `8136a0191a2258c0e1b36a8146a1c5ebc070c139`（2026-06-17） |
| 导入日期 | 2026-10-31 |
| 导入方式 | `tar` 复制，排除 `.git` 与 `.gitee` |
| 文件数 / 体积 | 824 / 15 MB |

上游 `LICENSE`（MIT）已原样保留，版权归原作者所有。本目录内的改动不改变上游许可条款。

## 使用约束（与 ADR-001 §2 一致）

1. **框架层只读**：`ruoyi-common-*`、`ruoyi-modules/{ruoyi-system,ruoyi-job,ruoyi-generator,ruoyi-workflow,ruoyi-demo}`、`ruoyi-admin`、`ruoyi-extend/*` 不得直接修改。需要改动时另提 ADR，并在 ADR 中登记改动文件清单。
   - **唯一可写接缝**（三处）：
     1. `pom.xml` 的 `<modules>`——仅允许追加业务模块，不得改动既有条目；
     2. `ruoyi-admin/pom.xml` 的 `<dependencies>`——同上；
     3. `ruoyi-admin/src/main/resources/` 下的配置文件——仅允许改配置项取值，禁止改 Java 源码或配置结构。
   - 本仓库对上游的实际改动（已登记的偏离）：
     | 文件 | 改动 | 理由 |
     |---|---|---|
     | `ruoyi-admin/src/main/resources/application.yml` | `sa-token.jwt-secret-key` → `${SA_TOKEN_JWT_SECRET}`（无默认值） | 上游为社区公开默认密钥，可伪造 token；改为强制注入，缺失即启动失败 |
     | `ruoyi-admin/src/main/resources/application.yml` | `tenant.enable` → `false` | 本项目不做多租户（ADR-001 §9） |
   - 业务包名统一 `org.dromara.business.<context>`，启动类 `org.dromara.DromaraApplication` 自动扫描；MyBatis 已配置 `org.dromara.**.mapper`。
2. **业务代码落点**：`business/<bounded-context>/{interfaces,application,domain,infrastructure}`，不放进上述任何框架包。
3. **多租户不启用**：业务实体继承 `BaseEntity`，禁止继承 `TenantEntity`；禁止使用 `TenantHelper`。
4. **密钥**：`application.yml` 中的 `sa-token.jwt-secret-key` 等默认值必须在部署时以环境变量覆盖，禁止沿用仓库内默认值。

## 升级流程

1. 拉取上游目标 tag 到仓库外临时目录
2. `tar` 覆盖本目录（保留本文件与 `business/`）
3. 记录新 commit 到本文件，复核 ADR-001 §3 偏离表
4. 跑 `mvn verify` 与 ArchUnit 门禁，结果写入 trace 或交付记录

## 相关

- ADR：[../docs/adr/001-scaffold-selection.md](../docs/adr/001-scaffold-selection.md)
- 核验记录：[../docs/adr/001-verification-record.md](../docs/adr/001-verification-record.md)
