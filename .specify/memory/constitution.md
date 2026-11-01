<!--
Sync Impact Report
==================
- Version change: 1.0.1 → 1.1.0 (MINOR)
- Ratified: 2026-10-31
- Amended: 2026-11-01
- Changes:
  * 技术栈基线：Spring Boot 3.2.x → 3.5.x，对齐 ADR-001 选定的 RuoYi-Vue-Plus 5.6.2（Java 17）
  * 技术栈基线：Spring Cloud / Spring Cloud Alibaba 的版本不再与 Boot 版本绑死在同一行，改为"微服务化时按官方兼容矩阵选定"（当前为模块化单体，ADR-001 D3）
- Rationale for MINOR: 仅调整基线版本与表述，未新增/删除原则；3.2 时代的既有实现不因本次修订失效
- Modified principles: 无（I–XII 条文未变，仅「技术栈基线」章节）
- Templates requiring updates: 无
- Evidence: platform/ 在 Java 17.0.12 + Maven 3.9.14 下 `mvn verify` → BUILD SUCCESS；注意根 pom 默认 `skipTests=true`，该结果不代表测试通过
- Previous: 1.0.1（2026-10-31）修正门禁计数与白名单指向
- Ratification: 1.1.0 于 2026-11-01 经架构委员会签字确认，**已生效**；此前“待签字”状态解除
-->

# AI 工作平台 Constitution

## 适用范围与边界

本宪章约束**技术决策与工程实现**，是 `/speckit-plan` 与 `/speckit-analyze` 的评判基准。

**不在本宪章范围内**（归属 CLAUDE.md，勿在此重复，避免双真相源）：
交付流程铁律（输入唯一性 / STOP 机制 / 溯源强制）、Spec Packet 断言化规范、CI 门禁的组织方式。

**冲突处理**：本宪章与 CLAUDE.md 出现同一条规则时，Agent 必须停下报告，不得自行取舍。

---

## Core Principles

### I. 限界上下文优先（NON-NEGOTIABLE）

服务边界由业务能力与限界上下文（Bounded Context）决定，而非技术分层。

- **禁止**按技术角色拆服务（`user-controller` / `user-service` / `user-dao` 属反模式）
- 每个服务必须能一句话说清"它拥有哪一段业务事实"，说不清则说明边界错了
- 上下文之间必须显式声明映射关系：防腐层（ACL）、开放主机服务（OHS）、共享内核（Shared Kernel，最小化）
- **禁止**两个上下文共享同一批数据库表；跨上下文取数只能通过 API 或领域事件
- 服务依赖深度 ≤ 3 层，**禁止**循环依赖（含通过事件形成的隐式环）

**判定**：`/speckit-plan` 必须写出本特性的上下文归属与上下游映射；`/speckit-analyze` 检查跨服务表访问。

### II. DDD 四层架构与依赖方向（NON-NEGOTIABLE）

```
interfaces → application → domain ← infrastructure
```

- **domain 层零框架依赖**：不得 import Spring / MyBatis / Nacos / Jackson 注解（`@Service` `@Entity` `@TableName` 一律禁止出现在 domain）
- **infrastructure 只能被 application 组装**：仓储接口定义在 domain，实现在 infrastructure
- application 层只做编排：事务边界、鉴权、幂等、调用领域服务与仓储；**禁止**在 application 写业务规则
- interfaces 层只做协议转换：参数校验、DTO ↔ 领域对象映射；**禁止**直接返回 DO/PO
- 领域对象必须行为内聚（充血模型）；**禁止**贫血模型 + Service 里堆全部逻辑

**判定**：依赖规则用 ArchUnit 固化到单测（`domain` 包不得依赖 `org.springframework.*`）；违规即构建失败。

### III. 聚合与一致性边界

- 聚合根是**事务一致性的唯一边界**；一个事务只允许修改一个聚合
- 跨聚合一致性用最终一致：领域事件 + 本地消息表 / RocketMQ 事务消息；**禁止**为图省事引入跨聚合大事务
- 聚合内只持有其他聚合的 ID，**禁止**直接持有聚合对象引用
- 值对象不可变；金额、数量等必须封装为值对象，**禁止**裸 `BigDecimal`/`Long` 在层间传递语义
- 领域事件命名用过去式（`OrderPaid`）；事件必须可幂等消费，消费端必须做去重

**判定**：`/speckit-plan` 的数据模型章节必须标注聚合边界与事件流向。

### IV. 服务契约先行

- 接口契约（OpenAPI 3）先于实现编写，契约评审通过后才进入编码
- 路径规范：`/api/v{n}/{resource}`；版本号只在**破坏性变更**时升级
- 统一响应体：`{code, message, data, traceId}`；错误码按服务段位分配（如 `ORD-4xxxx`），**禁止**自定义无段位错误码
- 写接口必须支持 `Idempotency-Key`；列表接口优先游标分页，`offset` 分页仅限后台小数据量场景
- **禁止**在 Controller 内拼装 SQL 或直接暴露持久化对象

**判定**：契约文件与实现同时提交；CI 校验 OpenAPI 与实现一致性。

### V. 数据与持久化（MySQL）

- **一服务一库**；**禁止**跨库 JOIN、跨库事务、跨服务直连他人库
- 表必备字段：雪花 `bigint` 主键、`created_at`、`updated_at`、`deleted`（逻辑删除）、`version`（乐观锁）
- 字符集 `utf8mb4`；金额用 `decimal(18,2)` 或整数分，**禁止** `float/double` 存金额
- **禁止**物理外键，引用完整性由应用层保证；索引必须覆盖高频查询条件，禁止无索引的大表扫描
- 单表预估超 1000 万行时必须给出分表或归档方案（写入 plan）
- 全部 DDL 走 Flyway 版本化脚本；**禁止**手工改生产表结构；变更必须向后兼容（先加列 → 双写 → 迁移 → 删列）
- 事务只在 application 层开启；**禁止**长事务与事务内远程调用

**判定**：`/speckit-plan` 必须给出表结构、索引、迁移脚本路径；DDL 脚本进入 code review。

### VI. 微服务治理（Spring Cloud Alibaba）

- 注册与配置：Nacos，按环境隔离 namespace；配置变更必须可回滚并留痕
- 服务调用：OpenFeign + Sentinel；**禁止**无超时、无熔断、无降级的远程调用
- 网关统一承担：鉴权、限流、灰度路由、跨域；**禁止**在业务服务里重复实现这些能力
- 分布式事务优先级：本地消息表 > RocketMQ 事务消息 > Seata（仅在强一致不可妥协且成本已评估时使用，需 ADR）
- 链路追踪：Micrometer Tracing + SkyWalking，`traceId` 必须全链路透传并在响应体返回
- 服务间调用必须带内部身份（内部 token 或 mTLS），**禁止**裸信任内网

**判定**：新服务接入检查表（注册 / 配置 / 熔断 / 追踪 / 健康检查）逐项打勾才允许上线。

### VII. 前端工程（Vue 3）

- 技术基线：Vue 3 + TypeScript + Vite + Pinia + Vue Router；统一 `<script setup>` 组合式 API
- 目录按**业务域**组织（`modules/order/...`），**禁止**纯技术分层（把万物塞进 `components/`）
- 状态管理：Pinia 只存跨页面共享状态；组件内部状态不外泄；**禁止**用全局 store 当传参通道
- 请求必须经统一封装（axios 实例 + 拦截器：token、错误码、traceId、重试）；**禁止**组件内裸写 axios
- 权限双控：路由级守卫 + 按钮级指令；敏感操作需二次确认
- 类型安全：API 类型由 OpenAPI 生成，**禁止**手写 `any` 绕过
- UI 复用优先：设计令牌（token）统一管理颜色/间距；**禁止**复制组件后各自改样式

**判定**：ESLint + vue-tsc 零错误；出现 `any` 需注释说明并经 review 通过。

### VIII. 测试与质量

- 测试金字塔：单元测试（domain 层）> 集成测试（application + 仓储）> 端到端（关键链路）
- **domain 层单元测试覆盖率 ≥ 70%**；每个聚合根的核心不变式必须有测试
- 契约测试必做：消费方对提供方的 OpenAPI 变更必须有兼容性测试
- 静态门禁：SonarQube 零 blocker/critical；圈复杂度 ≤ 15；重复率 ≤ 5%
- 性能：核心接口 P95/P99 阈值写入计划并压测验证；**禁止**用"感觉还行"替代压测报告
- 缺陷修复必须先写出可复现的失败测试

**判定**：覆盖率与 Sonar 门禁在 CI 强制执行，未达标不合并。

### IX. 安全与合规（NON-NEGOTIABLE）

- 认证：OAuth2 / JWT，网关统一校验；服务间调用必须有内部身份
- 授权：每个接口显式声明所需权限点，**默认拒绝**；**禁止**"登录即可访问"
- 敏感数据（手机号、证件、银行卡、地址）：加密存储 + 展示脱敏；**禁止**在日志、异常栈、埋点中输出明文
- 输入校验：所有外部输入在 interfaces 层校验（长度、格式、范围），**禁止**信任前端校验
- 依赖安全：CVE 扫描进 CI；高危 7 天内修复，中危 30 天
- 审计：资金、权限、数据导出类写操作必须留审计日志（谁 / 何时 / 改了什么 / traceId）

**判定**：安全清单随 PR 提交；越权用例进入自动化回归。

### X. 可观测性

- 三支柱齐备才允许上线：Metrics（Prometheus）、Logging（结构化 JSON）、Tracing（SkyWalking）
- 日志必备字段：`timestamp` `level` `service` `env` `traceId` `spanId`；**禁止** `System.out` / `print`
- 每个服务必须暴露 `/actuator/health` 与 readiness 探针，且探针不依赖弱依赖
- 告警必须可行动：含阈值依据、处理手册链接、责任人；**禁止**无主告警与噪音告警
- 关键业务指标（下单量、支付成功率、任务失败率）必须有看板

**判定**：上线检查表包含三支柱与探针项，缺项不得发布。

### XI. 依赖与工程规范

- 版本统一由 BOM（`dependencyManagement`）管理；**禁止**在子模块随意指定版本
- 新增第三方依赖必须审批并登记到 `specs/constraints/allowlist.md` 白名单；**禁止**引入未审计 SDK
- **禁止** SNAPSHOT 依赖进入生产；**禁止**内部二方库跨大版本直接引用
- 代码规范：Alibaba Java Coding Guidelines + Spotless/Checkstyle，提交前自动格式化
- 分支与提交遵循团队 Git 规范；**禁止**直接推送主干

**判定**：`mvn dependency:tree` 无版本冲突；CI 校验 BOM 与白名单。

### XII. 演进、兼容与技术债

- 数据库变更向后兼容（两阶段：先加后删），**禁止**同版本内既改结构又改语义
- API 弃用需 ≥ 2 个版本过渡期，并在响应头返回弃用告警
- 新功能默认关闭，通过配置中心灰度放量；灰度必须可秒级回滚
- 架构例外必须写 ADR（`docs/adr/NNN-*.md`），含理由、替代方案、到期日、责任人；**禁止**口头例外
- 每个迭代预留 ≥ 20% 容量偿还技术债；技术债清单公开可见

**判定**：`/speckit-analyze` 检查是否存在无 ADR 的架构偏离。

---

## 技术栈基线（Technology Baseline）

| 层 | 选型 | 约束 |
|---|---|---|
| 语言/运行时 | Java 17+ | 不使用已废弃 API |
| 框架 | Spring Boot 3.5.x；微服务化时叠加 Spring Cloud / Spring Cloud Alibaba（版本按官方兼容矩阵选定） | 以官方兼容矩阵为准；升版需 ADR；当前为模块化单体（ADR-001 D3） |
| 注册/配置 | Nacos 2.x | 按环境隔离 namespace |
| 流量治理 | Sentinel + Spring Cloud Gateway | 超时/熔断/限流为硬要求 |
| 消息 | RocketMQ | 事务消息用于跨服务最终一致 |
| 分布式事务 | Seata（受限使用） | 需 ADR；优先本地消息表 |
| 持久化 | MySQL 8.0 + MyBatis-Plus + Flyway | 一服务一库；DDL 版本化 |
| 缓存 | Redis | key 必须带业务前缀与 TTL |
| 链路/监控 | SkyWalking + Micrometer + Prometheus | traceId 全链路 |
| 前端 | Vue 3 + TS + Vite + Pinia + Element Plus | 类型由 OpenAPI 生成 |
| 质量 | JUnit 5 + ArchUnit + SonarQube | 依赖规则与覆盖率强制 |

---

## 工程门禁与合规检查

| 原则 | 落地手段 | 触发点 |
|---|---|---|
| I / II / III | ArchUnit 架构测试 + plan 模板强制章节 | 构建时 / `/speckit-plan` |
| IV | OpenAPI 契约校验 + 实现一致性检查 | CI |
| V | Flyway 校验 + DDL review + 索引检查 | 提交时 |
| VI | 新服务接入检查表 | 上线前 |
| VII | ESLint + vue-tsc + 类型生成校验 | CI |
| VIII | 覆盖率门禁 + Sonar 质量门 | CI |
| IX | 安全清单 + CVE 扫描 + 越权回归 | PR + 定时 |
| X | 上线检查表 | 发布前 |
| XI | BOM 校验 + 依赖白名单 | CI |
| XII | ADR 存在性检查 + 弃用告警 | `/speckit-analyze` |

---

## Governance

**效力**：本宪章优先于个人习惯与历史遗留写法。任何与之冲突的实现，Review 阶段必须驳回；确需偏离时走 ADR 例外流程（原则 XII），并在 PR 描述中引用 ADR 编号。

**修订流程**：
1. 提出修订（说明动机、影响范围、迁移成本）
2. 架构委员会评审通过
3. 同步更新受影响的模板与门禁（见顶部 Sync Impact Report）
4. 记录版本变更与生效日期

**版本策略（语义化）**：
- MAJOR：删除或重定义原则，导致既有实现不再合规
- MINOR：新增原则或章节，或实质性扩展约束
- PATCH：措辞澄清、错别字、非语义调整

**合规审查**：
- 每个 PR 与每次 `/speckit-analyze` 必须逐条核对 I–XII，不合规项显式记录处置方式
- 复杂度与例外必须被论证，不得默认放行
- 技术判断以本宪章为准；交付流程以 `CLAUDE.md` 为准

**Version**: 1.1.0 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-11-01
