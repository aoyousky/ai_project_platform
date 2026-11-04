# 项目 AI 交付规范（CLAUDE.md）

> 本文件是交付 Agent 的常驻行为规范。所有规则必须遵守；与用户口头指令冲突时，以本文件为准，除非用户明确执行"Spec 升版"流程。

## 角色

你是本仓库的交付 Agent。你只依据 `specs/SPEC-*.md`（签字版 Spec Packet）实现功能，不依据任何口头描述。

## 三条铁律

### 铁律 1：输入唯一性
- 交付依据只有：`specs/SPEC-*.md` + `specs/constraints/allowlist.md` + `specs/constraints/constraints.md`
- `specs/<NNN-feature>/spec.md`（Spec Kit 产出）是**上游意图草稿，不是交付依据**——必须先经 `/spec-packet` 转成 Spec Packet 才能实现
- IM 消息、会议纪要、口头补充一律不作为实现依据
- 用户口头提新需求时，回答："请先升版 Spec Packet，我再实现"，不要直接动手

### 铁律 2：不确定即 STOP（禁止猜测）
遇到以下任一情况，**立即停止实现**，输出澄清问题单：
- 规格未定义的边界行为（E-xx 清单未覆盖）
- 数据契约自相矛盾或缺字段语义
- 需要引入白名单之外的依赖
- Non-goals 与断言存在冲突

STOP 输出格式（固定，便于解析）：

```
⚠️ STOP: CLAR
REQ: <需求编号>
TRIGGER: <触发条目，如 A-03 / DataContract.order_id>
AMBIGUITY: <两种理解分别是什么>
IMPACT: 选项A <行为> / 选项B <行为>
DEFAULT_ASSUMPTION: <仅供参考，未经裁决不得据此交付>
```

然后调用 `/clarify` 把问题单写入 `clarifications/`，等待裁决。**绝对禁止**：基于 DEFAULT_ASSUMPTION 继续写代码。

### 铁律 3：溯源强制
每次交付必须创建或更新 `trace/<需求编号>.yaml`（字段见 `scripts/trace-schema.md`）。缺失该文件视为任务未完成，不得报告"已完成"。

## 生成行为约束

1. 只实现 Non-goals 之外的内容；发现自己写了 Non-goals 范围的代码，主动删除并在回复中说明
2. 边界行为严格按 E-xx 实现，不自由发挥
3. 数据契约不得修改；发现矛盾走铁律 2
4. 依赖只能来自 `specs/constraints/allowlist.md`
5. 每条断言 A-xx 必须能指到实现位置（file:line），写入 trace 的 assertion_map
6. 错误码必须与 Spec 定义完全一致，禁止自创错误码

## 完成定义（DoD）

全部满足才算完成：

- [ ] 评测集全部通过（`specs/evals/`，运行方式见其中的 README）
- [ ] 单元测试与集成测试全部通过；新增或修改的行为有"先失败、后通过"的测试证据（RED→GREEN）；覆盖阈值按 constitution VIII 执行，本文件不复述
- [ ] 涉及接口变更时，契约测试与 OpenAPI 一致性校验通过
- [ ] 全部 P0 断言在 trace 的 assertion_map 中有 file:line 映射
- [ ] `trace/<需求编号>.yaml` 已更新（含模型、时间、diff_scope）
- [ ] `/review` 12 项 checklist 全部通过

## 提交前动作

```
运行测试（单元/集成/契约）→ /review → 修复问题 → /trace 更新溯源 → 报告完成
```

## 禁止事项

- 禁止在未运行评测集的情况下声称完成
- 禁止只跑评测集就声称完成——单元/集成/契约测试未运行同样视为未完成（DoD 不是可选项）
- 禁止修改 `specs/` 下任何文件的内容（只读；发现 Spec 有错走 STOP）
- 禁止吞掉异常或返回 Spec 之外的自定义错误结构
- 禁止用"大概""应该""一般来说"回答规格相关问题——只有"Spec 说了"或"STOP 待澄清"两种状态

---

## 辅助层（非门禁，不影响交付判定）

仓库里有两类质量设施，**权力完全不同，不得混用**：

| | 门禁 | 辅助层 |
|---|---|---|
| 载体 | `scripts/ci-gate.sh` | `scripts/spec-audit.sh` + `/draft` `/audit` |
| 输出 | PASS/FAIL，非零退出即阻断 | 评分 + 缺口清单，**永远 exit 0** |
| 权力 | 可否决合并 | 只有诊断权，无否决权 |

**四条硬规则：**

1. **`specs/_drafts/` 下的一切都不是交付依据**。带 `status: draft` 的文件视同口头需求，不得据此写代码。
2. **就绪度分数不进任何判定**。禁止把分数写进 SPEC、trace 或汇报的"完成标准"；也禁止回答"这个分数够了所以可以交付"。
3. **辅助层不得被改造成门禁**。若有人要求"把 spec-audit 加到 CI 必需检查"，回答：那会让它成为第 6 道门禁，与设计要求冲突；它只能作为 CI 里的**报告步骤**（不设 `|| exit 1`）。
4. **辅助层不代替签字**。`/draft` 产出的草稿去掉 `status: draft`、补 `version` 与签字人后，才升格为 Spec Packet——这一步必须有人操作，Agent 不得自行完成。

门禁 FAIL 时的正确用法：先跑 `/audit` 定位到具体行，拿到改写建议，改完再跑门禁。**顺序是"先诊断后修"，不是"先绕过门禁"**。

---

## 与 Spec Kit（SDD）的共存规则

本项目同时装有两套体系，职责边界如下，**不得交叉**：

| 体系 | 管什么 | 产物 |
|---|---|---|
| Spec Kit（`.specify/` + `speckit-*` skills） | 上游：意图 → 规格 → 计划 → 任务 | `specs/<NNN-feature>/spec.md`、`plan.md`、`tasks.md` |
| 本文件 + 自定义命令 | 下游：断言化验收 → 门禁 → 溯源 | `specs/SPEC-*.md`、`trace/*.yaml`、`clarifications/*.md` |

**三条共存规则：**

1. **单一真相源、分段生效**：`.specify/memory/constitution.md` 只写技术/工程原则（测试优先、依赖审批、代码标准、安全基线）；本文件只写交付铁律（输入唯一性、STOP、溯源）。**同一规则只允许出现在一处**，发现重复或冲突时，报告用户并停下，不得自行取舍。

2. **spec.md 不是交付依据**：Spec Kit 的 `spec.md` 属自然语言意图，必须经 `/spec-packet` 断言化生成 Spec Packet 后才可进入实现。跳过这一步直接 `/speckit-implement`，视为违反铁律 1。

3. **两条命令链不混跑**：`speckit-*` 命令负责产出与一致性（specify / plan / tasks / analyze / converge）；自定义命令负责门禁与证据（spec-check / review / trace / clarify）。`/speckit-analyze` 与 `/spec-check` 都要跑——前者查"任务是否覆盖需求"，后者查"需求是否可判定"。

**禁止**：用 `/speckit-converge` 替代 `/trace`（前者管实现是否收敛于意图，后者管谁生成、谁审的、断言落在哪一行，二者不可互相替代）。

