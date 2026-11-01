# 把这套规范喂给 Claude Code：部署与使用说明

## 一、原理：四层喂法

规范不能"一篇长文塞进去"，要按加载时机分四层，各司其职：

| 层 | 载体 | 加载时机 | 放什么 |
|---|---|---|---|
| 1. 常驻层 | `CLAUDE.md` | 每次会话自动注入 | 三条铁律、DoD、禁止事项（**精简、可判定**，≤150 行） |
| 2. 按需层 | `specs/`、`trace/` | Agent 按需读文件 | Spec Packet、技术约束单、评测集、溯源记录 |
| 3. 命令层 | `.claude/commands/*.md` | 用户敲斜杠命令时 | 把 checklist 变成 `/spec-check` `/review` `/clarify` `/trace` |
| 4. 强制层 | `scripts/ci-gate.sh`（可加 hooks） | CI / 提交时 | 不靠自觉的机器门禁 |

关键认识：**CLAUDE.md 里只能放"改变行为"的规则，checklist 和模板放命令层按需加载**——全塞进 CLAUDE.md 会稀释注意力，Agent 反而不守规矩。规则必须写成可判定行为（"Then 只能是四类之一"），不能写理念（"要重视边界"）。

## 二、目录结构

```
ai_work_platform/
├── CLAUDE.md                     # 常驻行为规范（交付铁律 + 与 Spec Kit 共存规则）
├── README.md                     # 本文件
├── .specify/                     # Spec Kit 本体（constitution / templates / scripts）
├── .claude/
│   ├── skills/speckit-*/         # Spec Kit 的 SDD 技能（constitution→converge）
│   └── commands/
│       ├── spec-packet.md        # /spec-packet 把 spec.md 断言化为 Spec Packet（衔接层）
│       ├── spec-check.md         # /spec-check 规格门禁
│       ├── review.md             # /review 12项评审
│       ├── clarify.md            # /clarify STOP澄清问题单
│       └── trace.md              # /trace 溯源记录
├── specs/
│   ├── SPEC-TEMPLATE.md          # Spec Packet 机器友好模板（YAML front-matter）
│   ├── <NNN-feature>/            # Spec Kit 特性目录：spec.md / plan.md / tasks.md
│   ├── constraints/
│   │   ├── constraints.md        # 技术约束单（分层/规范/配置）
│   │   └── allowlist.md          # 依赖白名单（唯一来源）
│   └── evals/                    # 评测集（每需求一个子目录）
├── docs/
│   ├── adr/                      # 架构决策记录（ADR-001 脚手架选型）
│   ├── evidence/                 # 核验证据快照（依赖树、门禁日志等）
│   └── AI-DELIVERY-REDLINES.md   # 平台底座红线（只读接缝/多租户/密钥/迁移）
├── platform/                     # 平台底座（RuoYi-Vue-Plus 5.X v5.6.2，框架层只读）
│   └── PROVENANCE.md             # 来源、许可证与只读约束
├── frontend/                     # 前端底座（plus-ui v5.6.2-v2.6.2，框架层只读）
│   └── PROVENANCE.md             # 来源、接缝与已登记改动
├── business/                     # 业务代码（DDD 四层，规格见 business/README.md）
│   ├── archetype/                # 四层目录原型（只含 package-info）
│   └── archunit/                 # 四层依赖门禁（ArchUnit）
├── db/
│   └── migrations/               # Flyway DDL 版本化（独立于 platform）
├── deploy/                       # 本地 Docker 一键启动（MySQL/Redis/后端/前端，非交付物）
│   ├── docker-compose.yml        # 4 服务 + db-init 一次性初始化
│   ├── Dockerfile.backend        # 打包 ruoyi-admin.jar
│   ├── Dockerfile.frontend       # nginx 托管 frontend/dist
│   ├── prepare.sh                # 产出 build/（已 gitignore）
│   └── README.md                 # 三步启动 / 端口 / 排错
├── trace/                        # 溯源 yaml（Agent 产出）
├── clarifications/               # 澄清问题单（Agent 产出）
└── scripts/
    ├── ci-gate.sh                # CI 门禁脚本（5 道）
    └── hooks/
        └── commit-gate.sh        # Claude Code PreToolUse 钩子（commit/push 前跑门禁）
```

## 三、部署（3 步）

1. 把 `claude-code-spec-agent/` 整个目录内容拷贝到目标仓库根目录（`.claude/`、`CLAUDE.md` 必须在根）
2. 修改 `specs/constraints/constraints.md`（分层/规范）与 `specs/constraints/allowlist.md`（依赖白名单）
3. 在流水线（或 pre-commit）中挂上：`bash scripts/ci-gate.sh`

## 四、一次交付的完整流程

```
PM 填 specs/SPEC-xxx.md
  → /spec-check REQ-xxx            # 门禁1：规格不合格打回 PM
  → 业务方/架构签字（升 version）
  → 对 Agent 说："实现 REQ-xxx"
      · 规格没写清楚 → Agent 自动 ⚠️ STOP 并 /clarify 出问题单，人裁决
      · 规格清楚 → 生成代码 + 跑评测集
  → EVAL_BASE_URL=... python specs/evals/run.py --ci   # 评测全绿
  → /review                        # 门禁2：12项checklist
  → /trace REQ-xxx                 # 溯源 yaml（断言→file:line + test_evidence）
  → CI 跑 scripts/ci-gate.sh       # 门禁3–5：机器终审（含评测执行）
```

## 五、进阶：用 hooks 把"自觉"变"强制"（可选）

在 `.claude/settings.json` 加 hook，示例（提交前强制跑门禁）：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "echo \"$CLAUDE_TOOL_INPUT\" | grep -q 'git commit' && bash scripts/ci-gate.sh || exit 0"
      }]
    }]
  }
}
```

门禁不过，commit 直接被拦截——这是 STOP 机制之外的第二道硬保险。

## 六、迁移性

这套东西本质是 **markdown 约定 + shell 脚本**，不绑定 Claude Code：
- Cursor：CLAUDE.md → `.cursor/rules/`
- Copilot：CLAUDE.md → `.github/copilot-instructions.md`
- 斜杠命令：commands/*.md 内容就是普通提示词，任何 agent 可复用

---

## 七、与 Spec Kit（SDD）共存

本仓库已集成 GitHub Spec Kit（`specify 0.16.6`，skills 模式，装于 `.specify/` + `.claude/skills/speckit-*`）。

### 7.1 职责分层（不得交叉）

| 层 | 体系 | 管什么 | 产物 |
|---|---|---|---|
| 上游 | Spec Kit | 意图 → 规格 → 计划 → 任务 | `specs/<NNN-feature>/spec.md`、`plan.md`、`tasks.md` |
| 下游 | 本规范 | 断言化验收 → 门禁 → 溯源 | `specs/SPEC-*.md`、`trace/*.yaml`、`clarifications/*.md` |

一句话：**Spec Kit 保证"做的事是对的"，本规范保证"做的事能被证明是对的"。**

### 7.2 完整流程

```
/speckit-constitution        # 只写技术/工程原则（不要写交付铁律，那是 CLAUDE.md 的）
/speckit-specify             # 产出 specs/003-xxx/spec.md（自然语言意图）
/speckit-clarify             # 主动追问最多 5 个问题，写回 spec.md
        ↓
/spec-packet specs/003-xxx   # ★ 衔接层：断言化生成 specs/SPEC-003-xxx.md
/spec-check SPEC-003-xxx     # 门禁1：规格不达标打回（含 FR 覆盖面检查）
        ↓
/speckit-plan  /speckit-tasks  /speckit-implement
        ↓
/speckit-analyze             # 跨制品一致性（任务是否覆盖需求）
EVAL_BASE_URL=... python specs/evals/run.py --ci   # 评测全绿
/review                      # 门禁2：12 项评审
/trace REQ-003               # 溯源（含 plan_hash / tasks_hash 锚点）
bash scripts/ci-gate.sh      # 门禁3–5：机器终审（含评测执行）
```

### 7.3 命令映射

| 能力 | Spec Kit | 本规范 | 结论 |
|---|---|---|---|
| 项目原则 | `/speckit-constitution` | `CLAUDE.md` 铁律 | 分工：技术原则 / 交付铁律，**同一规则只写一处** |
| 规格起草 | `/speckit-specify` | `SPEC-TEMPLATE.md` | 用 Spec Kit 起草，再 `spec-packet` 断言化 |
| 歧义澄清 | `/speckit-clarify`（自动追问） | `/clarify`（落盘模板） | 追问用它，存档用我们的格式 |
| 断言化 | 无 | `/spec-packet` | **本规范独有，缺此无法直达交付** |
| 规格门禁 | 无（`/speckit-checklist` 偏人工） | `/spec-check` + `ci-gate.sh` | 本规范独有 |
| 计划与任务分解 | `/speckit-plan` `/speckit-tasks` | 无 | 用 Spec Kit，成熟 |
| 一致性检查 | `/speckit-analyze` | `/spec-check` 第 9/10 项 | 两者都跑，维度不同 |
| 代码评审 | 无 | `/review` | 本规范独有 |
| 溯源审计 | 无 | `/trace` + `ci-gate.sh` 门禁3 | 本规范独有（`/speckit-converge` 不可替代） |
| 收敛循环 | `/speckit-converge` | 无 | 用 Spec Kit |

### 7.4 五道 CI 门禁

1. 禁词扫描（模糊表述）
2. 异常条数 ≥ 断言条数
3. 每个 Spec Packet 有 `trace/<id>.yaml`，无 UNMAPPED 断言，且 `test_evidence` 全绿
4. **每个 `specs/*/spec.md` 都有对应 Spec Packet**（未断言化的特性直接拦截）
5. **评测集执行**：`python specs/evals/run.py --ci`；P0 无对应用例、用例失败、或未设置 `EVAL_BASE_URL` 均拦截

### 7.5 冲突规避

- `constitution.md` 与 `CLAUDE.md` 重复同一条规则时，Agent 必须停下报告，不得自行取舍
- Spec Kit 的 `spec.md` 永远不作为实现依据（见 CLAUDE.md 铁律 1）
- 两个体系的命令不要互相替代（尤其 `/speckit-converge` ≠ `/trace`）

### 7.6 回滚

集成前的原始状态备份在 `C:\Users\Lenovo\WorkBuddy\2026-10-29-14-55-13\backup-before-speckit`，需要退回时整目录覆盖即可（或删除 `.specify/` 与 `.claude/skills/speckit-*`）。

## 八、本地启动（平台底座 + 前端）

### 后端

```bash
export SA_TOKEN_JWT_SECRET=$(openssl rand -hex 32)   # 缺失则启动失败（红线 R3）
mvn -f platform/pom.xml -pl ruoyi-admin -am spring-boot:run
```

默认端口 `8080`（`platform/ruoyi-admin/src/main/resources/application.yml` 的 `server.port`）。
数据库需先执行 `db/migrations/` 下的 Flyway 迁移（见 `db/migrations/README.md`）；多租户已关闭（红线 R2）。

### 前端

```bash
cd frontend
npm ci          # 锁定版本安装；package-lock.json 必须入库（红线 R8）
npm run dev     # http://localhost:80，/dev-api 代理到 http://localhost:8080
```

Node.js 需 `>= 20.19.0`（`frontend/package.json` 的 `engines`）。

### 业务代码放哪

| 层 | 位置 | 可写 |
|---|---|---|
| 后端业务 | `business/<context>/{interfaces,application,domain,infrastructure}` | 是 |
| 前端业务页面 | `frontend/src/views/<context>/` | 是 |
| 前端业务接口 | `frontend/src/api/<context>/` | 是 |
| 底座（`platform/`、`frontend/` 其余部分） | — | 否，见 `docs/AI-DELIVERY-REDLINES.md` R1 |

`<context>` 前后端必须同名（红线 R8）。
