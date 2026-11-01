# P0-6 证据：底座配置偏离上游（多租户关闭 + JWT 密钥强制注入）

日期：2026-11-01
关联：`docs/adr/001-scaffold-selection.md` §2 接缝 3、§9；`docs/AI-DELIVERY-REDLINES.md` R2 / R3

## 1. 改了什么

文件：`platform/ruoyi-admin/src/main/resources/application.yml`

```diff
   # jwt秘钥
-  jwt-secret-key: abcdefghijklmnopqrstuvwxyz
+  # jwt秘钥：不提供默认值，必须由环境变量 SA_TOKEN_JWT_SECRET 注入。
+  jwt-secret-key: ${SA_TOKEN_JWT_SECRET}

 tenant:
   # 是否开启
-  enable: true
+  enable: false
```

只改配置项取值，未改 Java、未改配置结构。

## 2. 为什么必须是这两处

| 问题 | 风险 |
|---|---|
| `jwt-secret-key: abcdefghijklmnopqrstuvwxyz` | 上游仓库公开的默认值，任何拿到源码的人都能伪造任意用户的 token |
| `tenant.enable: true` | 与"本项目不做多租户"的决定相反；租户拦截器会对 `TenantEntity` 自动拼 `tenant_id` 条件，业务实体一旦误继承就会出现查不到数据的隐蔽 bug |

改动前的核验：

```
$ grep -rn "jwt-secret-key\|tenant.enable" platform/ruoyi-admin/src/main/resources/*.yml
application.yml:104:  jwt-secret-key: abcdefghijklmnopqrstuvwxyz
application.yml:123:  enable: true      # 位于 tenant: 下
```

`application-dev.yml`、`application-prod.yml` 均未覆盖这两项，所以只改 `application.yml` 即可全局生效。

## 3. 关闭多租户是平台支持的开关，不是硬改

`ruoyi-common-tenant` 的装配是条件化的：

```
platform/ruoyi-modules/../ruoyi-common/ruoyi-common-tenant/src/main/java/org/dromara/common/tenant/config/TenantConfig.java:32
  @ConditionalOnProperty(value = "tenant.enable", havingValue = "true")

platform/ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/controller/system/SysTenantController.java:42
  @ConditionalOnProperty(value = "tenant.enable", havingValue = "true")

platform/ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/controller/system/SysTenantPackageController.java:38
  @ConditionalOnProperty(value = "tenant.enable", havingValue = "true")
```

即 `enable: false` 时租户配置类与两个租户管理接口都不会注册，属于受支持路径。
`sys_tenant` / `sys_tenant_package` 表由 Flyway V1 建出，保留无害。

## 4. 密钥"缺失即启动失败"的依据

反编译 `sa-token-spring-boot-webmvc-reactor-v2v3v4-common-1.45.0.jar`：

```
cn.dev33.satoken.spring.SaBeanRegister
  public cn.dev33.satoken.config.SaTokenConfig getSaTokenConfig();
    注解: @Bean + @ConfigurationProperties("sa-token")

cn.dev33.satoken.spring.SaBeanInject
  构造器: (cn.dev33.satoken.log.SaLog, cn.dev33.satoken.config.SaTokenConfig, ...)
```

结论链：`@ConfigurationProperties("sa-token")` 的 bean 在容器启动时绑定 → 绑定需解析 `jwt-secret-key`
的值 → `${SA_TOKEN_JWT_SECRET}` 无默认值且环境变量缺失 → Spring 抛
`IllegalArgumentException: Could not resolve placeholder 'SA_TOKEN_JWT_SECRET'` → 启动失败。
因此弱密钥不可能被静默带到任何环境。

## 5. 未验证的部分（必须如实记录）

- **没有真正启动过应用**：启动需要 MySQL + Redis，本机未运行。上条结论来自字节码检查，不是运行日志。
- 顺带清除了 `platform/ruoyi-admin/target/classes/application.yml`（旧构建产物，仍含旧密钥），
  下次构建会重新拷贝源文件。

## 6. 本地开发怎么跑

```bash
export SA_TOKEN_JWT_SECRET=$(openssl rand -hex 32)
mvn -f platform/pom.xml -pl ruoyi-admin -am spring-boot:run
```

变量每次会话都要重新导出；缺失时应用会直接启动失败，这是预期行为，不要加默认值绕过。
