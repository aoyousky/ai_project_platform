# 业务库迁移（Flyway）

独立于 `platform/` 的 DDL 版本化模块。`platform/` 保持只读，迁移由本模块以 Maven 插件方式执行（ADR-001 D4）。

## 目录

```
db/migrations/
├── pom.xml
├── sql/
│   ├── V1__baseline_ruoyi_5.6.2.sql   # 上游 5.6.2 业务库快照（25 表）
│   └── V2__workflow_ruoyi_5.6.2.sql   # 上游 5.6.2 工作流表（11 表）
└── README.md
```

`V1`/`V2` 是上游快照，**内容不得修改**（Flyway 校验会失败）。所有业务变更从 `V3` 开始追加。

## 命令

```bash
# 新库：建库后执行（库本身仍需先创建，Flyway 不建库）
mvn -f db/migrations/pom.xml flyway:migrate \
  -Dflyway.url="jdbc:mysql://127.0.0.1:3306/ry_vue?useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai" \
  -Dflyway.user=root -Dflyway.password=***

# 存量库（已手工执行过 5.6.2 脚本）：先打基线，再迁移
mvn -f db/migrations/pom.xml flyway:baseline -Dflyway.baselineVersion=2 ...同上连接参数
mvn -f db/migrations/pom.xml flyway:migrate  ...同上连接参数

# 只读检查
mvn -f db/migrations/pom.xml flyway:info     ...同上连接参数
mvn -f db/migrations/pom.xml flyway:validate ...同上连接参数
```

连接参数也可写入 `~/.m2/settings.xml` 的 profile，或通过 `FLYWAY_URL` / `FLYWAY_USER` / `FLYWAY_PASSWORD` 环境变量注入；**禁止把生产密码写进本仓库**。

## 版本与编写规范

1. 文件名 `V<n>__<snake_case_描述>.sql`，版本号连续，不跳号、不复用。
2. 已发布的迁移脚本**只增不改**；改了会触发 `validate` 失败。
3. 向后兼容（宪章 V）：先加列 → 双写 → 迁数据 → 再删列；禁止同版本内既改结构又改语义。
4. 禁止物理外键；字符集 `utf8mb4`；金额 `decimal(18,2)` 或整数分。
5. `clean` 已在 pom 中永久禁用（`cleanDisabled=true`），避免误清库。

## 不在本模块的范围

- **`ry_job.sql`（SnailJob）**：属调度服务独立库，由运维单独初始化，不与业务库混跑。
- **演示数据**：`V1` 中包含上游的 `test_demo` / `test_tree` 演示表与数据。首个业务迭代如确认不需要，追加 `V3__drop_demo_tables.sql` 显式删除，不要手改 `V1`。

## CI 要求

- 合并前必须对**空库**执行一次 `flyway:migrate`，再执行一次 `flyway:info`，确认无 `pending`。
- 对存量库快照执行 `flyway:validate`，确认校验和未漂移。
- 数据库由流水线临时实例提供（Testcontainers 或一次性 MySQL 容器），不连生产库。

## 验证状态（2026-10-31）

已在 **MySQL 8.0.40** 上用一次性用户态实例（端口 3307，验证后销毁）实测：

| 检查 | 结果 |
|---|---|
| 空库首次 `flyway:migrate` | 应用 `V1`、`V2`，`Successfully applied 2 migrations`，库内共 **37 张表**（25 + 11 + `flyway_schema_history`） |
| 第二次 `flyway:migrate` | `Schema is up to date. No migration necessary.`（幂等） |
| `flyway_schema_history` | `1 baseline` / `2 workflow` 两条记录，`success=1` |

**踩坑记录**：`V2`（warm-flow）脚本内含 `${initiator}` 字面量，Flyway 默认会当占位符解析并报 `No value provided for placeholder`。已在 pom 中设置 `placeholderReplacement=false`，后续迁移不得依赖 Flyway 占位符语法。

**未覆盖**：未在 MySQL 8.0 之外的版本（5.7 / MariaDB）验证；`ry_job.sql` 不在本模块范围内。
