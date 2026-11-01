# 技术约束单（Generation Constraints）

> Agent 生成代码的"施工边界"。由架构维护，Agent 只读。

## 依赖白名单（allowlist）

**唯一来源：[allowlist.md](allowlist.md)**。本文件不再重复列依赖，避免双真相源。

需要新增依赖 → Agent 必须按 CLAUDE.md 铁律 2 STOP 上报，不得自行引入。

## 分层边界

遵循 constitution II 的 DDD 四层与依赖方向：

```
interfaces → application → domain ← infrastructure
```

- domain 层零框架依赖
- infrastructure 只能被 application 组装，仓储接口定义在 domain
- application 层只做编排：事务边界、鉴权、幂等；禁止写业务规则
- interfaces 层只做协议转换；禁止直接返回 DO/PO
- 事务边界只在 application 层；禁止长事务与事务内远程调用

## 代码规范

- 静态检查：Spotless/Checkstyle 零告警，前端 ESLint + vue-tsc 零错误
- 圈复杂度 ≤ 15（以 constitution VIII 为准）；重复率 ≤ 5%
- 命名与目录：跟随现有模块结构
- 注释：只解释"为什么"，不复述"做了什么"

## 配置与密钥

- 禁止硬编码任何密钥、URL、开关
- 配置一律经环境变量注入，由 `@ConfigurationProperties` 绑定并校验；禁止写死在代码里

## 错误与可观测

- 错误码只允许来自各 Spec Packet 的断言定义
- 每个 Spec 声明的日志/trace 字段必须输出
