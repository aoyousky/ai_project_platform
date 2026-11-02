# business/ — 业务模块工作区

业务代码（我们自己写的部分）全部落在这里。`platform/`（RuoYi-Vue-Plus 5.X 底座）只读，
两者关系见 [docs/adr/001-scaffold-selection.md](../docs/adr/001-scaffold-selection.md)。

## 模块清单

| 模块 | 作用 | 是否含业务代码 |
|---|---|---|
| `archetype/` | 四层目录原型，只有 `package-info.java`，不产生运行时行为 | 否 |
| `archunit/` | 四层依赖规则的构建门禁（扫描 `com.aoyou.business`） | 否（只有测试与夹具） |
| `<context>/` | 具体业务上下文，如 `order/`、`contract/`，待第一个 Spec Packet 后创建 | 是 |

## DDD 四层

一个业务上下文的包结构固定为：

```
com.aoyou.business.<context>
├── interfaces/       入站适配：Controller、定时任务入口、消息监听入口
├── application/      用例编排：事务边界、鉴权、幂等
├── domain/           业务真相：聚合、实体、值对象、领域事件、仓储接口
└── infrastructure/   技术实现：仓储实现、外部系统适配、缓存、Mapper
```

依赖方向：

```
interfaces ──▶ application ──▶ domain ◀── infrastructure
```

层间规则的**规范正文**在宪章 [II. DDD 四层架构与依赖方向](../.specify/memory/constitution.md)，
本文不复述。这里只记录规则到门禁的机械映射——改规则必须先改宪章，再改下表。

| 宪章 II 条目 | 门禁实现 | 违规夹具 |
|---|---|---|
| domain 零框架依赖 | `DOMAIN_IS_FRAMEWORK_FREE` | `fixtures.bad.domain` |
| domain 不依赖外层 | `DOMAIN_DOES_NOT_DEPEND_ON_OUTER_LAYERS` | `fixtures.bad.coupling.domain` |
| application 不依赖 interfaces | `APPLICATION_DOES_NOT_DEPEND_ON_INTERFACES` | `fixtures.bad.coupling.application` |
| interfaces 不依赖 infrastructure | `INTERFACES_DOES_NOT_DEPEND_ON_INFRASTRUCTURE` | `fixtures.bad.interfaces` |
| infrastructure 不依赖 interfaces | `INFRASTRUCTURE_DOES_NOT_DEPEND_ON_INTERFACES` | `fixtures.bad.infrastructure` |

## 新增一个业务上下文

前提：已有签字版 `specs/SPEC-*.md`。**没有 Spec Packet 不写业务代码**（CLAUDE.md 铁律 1）。

1. 在 `business/pom.xml` 的 `<modules>` 里加 `<module><context></module>`；
2. 新建 `business/<context>/pom.xml`，`parent` 指向 `business-parent`；
3. 建四个层目录，各放一个 `package-info.java`（照抄 `archetype/` 的写法，改包名）；
4. 包名固定为 `com.aoyou.business.<context>.<layer>`；
5. 跑 `mvn -f business/pom.xml test`，`LayerArchitectureTest` 必须绿。

## 与平台底座的三条硬约束

1. **不读不写 `platform/` 的 Java 源码**。唯一允许改的接缝是 `platform/pom.xml` 的 `<modules>`
   和 `platform/aoyou-admin/pom.xml` 的 `<dependencies>`，用于把业务模块挂进启动工程。
2. **多租户不开**。业务实体继承 `BaseEntity`，禁止使用 `TenantEntity` / `TenantHelper`。
3. **不引白名单外的依赖**。新增依赖先改 `specs/constraints/allowlist.md`（同样需要 Spec 升版流程）。

## 包扫描可用的原因

启动类在 `com.aoyou` 包下，Mapper 扫描路径为 `com.aoyou.**.mapper`，因此
`com.aoyou.business.<context>.infrastructure.mapper` 会被自动扫到，无需改动平台代码。

## 当前状态

`archetype/` 与 `archunit/` 是 P0-5 的交付物：只提供目录原型和门禁，**不含任何业务功能**。
第一个真实业务上下文等第一个 Spec Packet 之后创建。
