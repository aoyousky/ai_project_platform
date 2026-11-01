# P0-5 证据：DDD 四层原型 + ArchUnit 门禁

日期：2026-10-31
关联：`docs/adr/001-scaffold-selection.md` §6 P0-5、宪章 II

## 1. 交付物

| 路径 | 内容 |
|---|---|
| `business/pom.xml` | 聚合 POM，`<modules>` = `archetype`、`archunit` |
| `business/archetype/**/package-info.java` | 四层目录原型（`interfaces` / `application` / `domain` / `infrastructure`），**无任何类、无运行时行为** |
| `business/archunit/.../LayerArchitectureTest.java` | 5 条依赖规则 + 7 个测试 |
| `business/archunit/.../fixtures/**` | 合规夹具 5 个类、违规夹具 4 个类 |
| `business/README.md` | 四层约定、新增上下文步骤、平台硬约束 |
| `.github/workflows/ci-gate.yml` | 新增 `architecture` job：`mvn -B -f business/pom.xml test` |

## 2. 五条规则

| # | 规则 | 依据 |
|---|---|---|
| 1 | `..domain..` 不依赖 Spring / MyBatis / JPA / Jackson / Swagger | 宪章 II：domain 零框架依赖 |
| 2 | `..domain..` 不依赖 `..application..` / `..interfaces..` / `..infrastructure..` | 依赖方向 |
| 3 | `..application..` 不依赖 `..interfaces..` | 依赖方向 |
| 4 | `..interfaces..` 不依赖 `..infrastructure..` | 依赖方向 |
| 5 | `..infrastructure..` 不依赖 `..interfaces..` | 依赖方向 |

扫描范围只限 `org.dromara.business`；`platform/` 豁免（ADR-001 D2）。

## 3. 绿：合规结构通过

```
mvn -f business/pom.xml clean test

[INFO] Running org.dromara.business.arch.LayerArchitectureTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.800 s
[INFO] BUILD SUCCESS
```

7 个测试 = 1 个“业务代码合规” + 1 个“合规夹具合规” + 5 个“违规夹具被抓”。

## 4. 红：违规真的会让门禁失败

### 4.1 夹具级（常驻）

每个违规夹具单独导入，断言抛出 `AssertionError`，并进一步断言异常消息里包含**该规则自身的描述**
（`message.contains(rule.getDescription())`），排除“因类解析失败而抛错”的假阳性。

| 夹具 | 触发规则 |
|---|---|
| `fixtures.bad.domain.BadDomainService`（`@Service`） | 规则 1 |
| `fixtures.bad.coupling.domain.BadDomainCoupling` | 规则 2 |
| `fixtures.bad.coupling.application.BadAppService` | 规则 3 |
| `fixtures.bad.interfaces.BadController` | 规则 4 |
| `fixtures.bad.infrastructure.BadRepository` | 规则 5 |

### 4.2 业务代码级（一次性反向验证）

在 `org.dromara.business.archetype.domain` 临时加入一个依赖 `..archetype.infrastructure..` 的类，
确认 `businessModulesRespectLayering` 变红：

```
[ERROR] Tests run: 7, Failures: 1, Errors: 0, Skipped: 0
Architecture Violation [Priority: MEDIUM] - Rule 'no classes that reside in a package '..domain..'
should depend on classes that reside in any package ['..application..', '..interfaces..',
'..infrastructure..'], because 依赖方向为 interfaces → application → domain ← infrastructure'
was violated (2 times)
[INFO] BUILD FAILURE
```

删除临时类并 `mvn clean test` 后恢复 `Tests run: 7, Failures: 0` → `BUILD SUCCESS`。
**结论：规则对真实业务包生效，不是空转。**

## 5. 未覆盖 / 遗留

- 规则只查包级依赖，不查“domain 里出现了 Mapper 字段但类型本身合规”这类语义问题——由 `/review` 兜底。
- `business/` 目前没有任何业务类，因此 `businessModulesRespectLayering` 只覆盖“未来新增的类”，
  非空转性由 §4.2 的反向验证证明。
- 未把 `platform/` 的构建放进 CI（单次约 16 分钟，且平台只读、仅两个接缝可改）。
