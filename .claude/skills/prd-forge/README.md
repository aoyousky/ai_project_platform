# PRD Forge · 产品需求文档锻造器

把模糊的业务想法，锻造成研发能照着做、测试能照着验、验收时能拿着对账的 PRD。

面向 IT 产品经理、业务专家、需求分析师。基于 SDD（Spec-Driven Development，规范驱动开发）思想改造：**先澄清再动笔、需求带唯一 ID 与验收标准、业务规则不留白、全链路可追踪**。

---

## 它解决什么问题

大多数 PRD 的通病不是写得不全，而是**写成了故事而不是契约**：

| 常见写法 | 研发拿到后的反应 | PRD Forge 的输出 |
|---|---|---|
| 「提升用户体验」 | 这不是需求 | 「下单跳转从 7 次降至 3 次，完成时长从 4 分 12 秒降至 90 秒内」 |
| 「用户可以导出数据」 | 导多少？多久？失败呢？ | 「系统必须在点击后 10 秒内生成 UTF-8 CSV，超 5 万条转异步，完成后站内信通知」 |
| 「按业务规则校验」 | 什么规则？ | BR-003 逐条列出，含边界值与分位差处理 |
| 「失败则提示错误」 | 提示什么？状态怎么变？ | 异常表 4 行，含并发冲突与幂等处理 |

具体做法是把 SDD 的核心动作搬进 PRD 流程：**动笔前先提问**（最多 5 问，每个带兜底假设）、**每条需求一个可独立验收的行为**、**验收标准用 Given/When/Then 且落在可观测载体上**、**交付前跑确定性门禁**。

---

## 目录结构

```
prd-forge/
├── SKILL.md                      # 主入口：工作流与硬规则（唯一常驻上下文）
├── README.md                     # 本文件
├── assets/
│   ├── prd-template.md           # 空白模板，八章结构
│   └── portable-prompt.md        # 单文件提示词包，用于不支持 Skill 的平台
├── references/
│   ├── section-guide.md          # 逐章撰写指南 + 交付核对清单
│   ├── quality-rules.md          # 可验证性规则、模糊词黑名单、NFR 量化
│   ├── question-playbook.md      # 按业务域分类的澄清问题库
│   ├── anti-patterns.md          # 14 个反模式对照，用于评审
│   └── example-prd.md            # 完整示范 PRD（门禁 100 分）
└── scripts/
    ├── init_prd.py               # 生成骨架，按级别裁剪章节
    └── prd_lint.py               # 确定性质量门禁
```

只有 `SKILL.md` 会常驻上下文，其余文件按需加载——这是 Skill 的渐进式加载机制，不会撑爆窗口。

---

## 安装

### 方式一：Claude Code（原生 Skill）

把整个 `prd-forge` 目录放进以下任一位置：

```bash
# 个人级：所有项目可用
~/.claude/skills/prd-forge/

# 项目级：仅当前项目，可随代码库共享
<项目根>/.claude/skills/prd-forge/
```

放好后目录看起来应该是 `.../skills/prd-forge/SKILL.md`。重启 Claude Code 生效，直接说「帮我写个 PRD」或「把这段需求整理成 PRD」即可触发，也可用 `/prd-forge` 显式调用。

> 已验证：本机另一个项目的 `.claude/skills/` 下已有 10 个 `speckit-*` Skill，均采用 `skills/<name>/SKILL.md` 结构，与本包一致。若未触发，先检查层级是否多套了一层（错误：`skills/prd-forge/prd-forge/SKILL.md`）。

### 方式二：Codex / Cursor / 其他支持 AGENTS.md 的工具

这类工具通过项目根目录的 `AGENTS.md` 加载长期指令，不支持 Skill 目录结构。做法：

```bash
# 1. 把 Skill 放到项目里，作为知识库
cp -r prd-forge <项目根>/docs/prd-forge

# 2. 在 AGENTS.md 末尾追加一段索引
```

```markdown
## PRD 撰写

需要撰写或评审产品需求文档时，先完整阅读 `docs/prd-forge/SKILL.md`，
按其工作流程执行；撰写前读 `references/section-guide.md` 中对应章节，
写完后必须运行 `python scripts/prd_lint.py <文件>` 并通过（无 ERROR）。

模板在 `assets/prd-template.md`，示范见 `references/example-prd.md`。
```

> 注：Codex CLI 与 Cursor 均以 `AGENTS.md` 作为指令入口，这是通用的降级方案。若所用版本已支持原生 Skill 目录，优先用方式一。

### 方式三：DeepSeek / Kimi / ChatGPT / 豆包 等网页版

这些平台没有文件系统访问，也不支持 Skill 目录，唯一可行的方式是提示词：

1. 打开 `assets/portable-prompt.md`
2. 复制两个 `---` 之间的全部内容
3. 粘贴为该对话的**第一条消息**（有"系统提示词"入口的工具则填在那里）
4. 随后直接描述需求：「我需要给商家后台做订单批量导出，现在只能分页导 50 条」

如果平台支持上传附件，把 `assets/prd-template.md` 一起传上去，输出会更贴合模板。

### 方式四：接入自有 Agent / API

`SKILL.md` 与 `references/` 全部是纯 Markdown，可直接作为 system prompt 或 RAG 语料加载。`scripts/` 是零依赖的 Python 脚本，可在 CI 里作为文档质量门禁：

```yaml
# CI 示例：PRD 变更时自动检查
- name: PRD lint
  run: python docs/prd-forge/scripts/prd_lint.py docs/prd/xxx-PRD.md --level L2
```

退出码非 0 即表示文档存在结构性缺陷，可配置为阻止合并。

---

## 怎么用

### 场景一：从零写一份 PRD

```
帮我把这个需求整理成 PRD：商家后台要支持订单批量导出，
现在只能分页导 50 条，财务对账很麻烦。
```

它会先判断文档级别，再问最多 5 个关键问题（每个附兜底假设），然后产出文档并跑门禁。

### 场景二：评审已有 PRD

```
用 PRD 标准评审这份文档，指出可验证性和完整性上的问题。
```

会对照 `references/anti-patterns.md` 逐条比对，给出问题定位与改写建议。

### 场景三：把一句话需求补齐

```
这个需求太粗了，帮我拆成可开发的需求：<一句话>
```

### 场景四：只做质量门禁

```bash
python scripts/prd_lint.py my-prd.md
```

输出评分、ERROR / WARN 清单、行号定位。ERROR 必须清零才算可交付。

---

## 脚本说明

两个脚本都只依赖 Python 3.8+ 标准库，无需 pip 安装。

### init_prd.py · 生成骨架

```bash
python scripts/init_prd.py --title "订单批量导出" --level L2 --fr 5 --out prd.md
```

| 参数 | 说明 |
|---|---|
| `--title` | 必填，产品/功能名称 |
| `--out` | 必填，输出路径 |
| `--level` | L1 / L2 / L3，决定保留哪些章节（默认 L2） |
| `--fr` | 预分配的需求条数（默认 L1=2 / L2=4 / L3=6） |
| `--author` | 负责人姓名，会替换模板占位 |
| `--force` | 覆盖已有文件 |

### prd_lint.py · 质量门禁

```bash
python scripts/prd_lint.py prd.md            # 默认按 L2 检查
python scripts/prd_lint.py prd.md --level L3 # 按 L3 严格检查
python scripts/prd_lint.py prd.md --json     # 输出 JSON，便于接入 CI
```

检查项：

| 代码 | 级别 | 检查内容 |
|---|---|---|
| E001 | ERROR | 缺少必需章节 |
| E002 | ERROR | 章节只有标题无内容 |
| E003 | ERROR | 文档内无任何编号需求 |
| E004 | ERROR | 需求编号重复 |
| E005 | ERROR | 需求缺验收标准 |
| E006 | ERROR | 有验收标准标题但无具体条目 |
| E007 | ERROR | 需求缺优先级 |
| E008 | ERROR | TODO / TBD / 待补充 残留 |
| E009 | ERROR | 文档仍是未填写的空模板 |
| W101 | WARN | 缺少建议章节 |
| W102 | WARN | 单条需求验收标准过多，粒度过粗 |
| W103 | WARN | 缺少描述字段 |
| W104 | WARN | 未涉及异常与边界 |
| W106 | WARN | 需求正文出现模糊词 |
| W107 | WARN | 非功能需求未量化 |
| W108 | WARN | 未声明非目标 |
| W109 | WARN | 成功指标未量化 |
| W110 | WARN | 需求未进入追踪矩阵 |
| W111 | WARN | P0 占比超过 40% |
| W112 | WARN | 用户故事格式不规范 |
| W113 | WARN | 疑似占位符残留 |

评分规则：`100 - 12 × ERROR - 3 × WARN`，下限 0。退出码 0 表示无 ERROR，1 表示有 ERROR，2 表示参数或文件错误。

---

## 设计取舍

**为什么把「提问」放在第一步。** PRD 质量的下限由澄清决定，上限由写作决定。跳过澄清直接生成，产出的必然是"结构完整但内容空洞"的文档——看起来像 PRD，实际每条需求都不能验收。

**为什么门禁是脚本而不是提示词。** 「检查一下有没有模糊词」这类要求写在提示词里，模型会挑几条报告就收工。写成脚本才能保证每次都全量扫描、结果可复现、能接进 CI。

**为什么要分 L0–L3。** 过度文档化和文档缺失同样是交付缺陷。改一句文案写八章 PRD，团队会直接跳过流程。分级让流程成本与风险匹配。

**为什么 lint 分 ERROR 和 WARN。** ERROR 是结构性缺陷（缺章节、无验收标准），必须清零；WARN 是判断性建议（模糊词、P0 占比），需要人确认。把两者混在一起会导致"反正一堆警告"的麻木，门禁就失效了。

---

## 已知限制

- **脚本查语义，不查对错。** 它能确认「每条需求都有验收标准」，不能确认「这个验收标准是否真的覆盖了业务场景」。需求是否解决了真问题、规则之间是否冲突、边界是否遗漏，仍需人工评审。
- **模糊词表永远不全。** 黑名单覆盖的是高频词，新造的模糊表述需要持续补充。发现漏网时直接往 `scripts/prd_lint.py` 的 `VAGUE_WORDS` 里加。
- **不产出技术方案。** 这是刻意的边界——PRD 里写技术选型，实现一变更文档就失效，而验收标准不会。
- **平台适配层可能滞后。** 各 Agent 平台的 Skill 加载机制仍在演进，README 中的路径以发布时为准，遇到不生效优先查对应平台的官方文档。

---

## 版本

**v1.1.0** ｜ 2026-11-10 ｜ 变更明细见 `CHANGELOG.md`

v1.1.0 针对「内部团队门禁」场景做了可用性加固：修掉 8 处会导致误拦截或漏检的规则缺陷，新增 `--strict`（CI 卡点）与 `--allow`（术语豁免），并把变异测试固化为 26 用例的回归评测集 `eval/prd_forge_eval.py`。当前基线：合格文档误报率 0%，规则集内缺陷 15/15 检出。

v1.0 ｜ 2026-11-10

基于 SDD 方法论改造，针对 PRD 场景重新设计了章节结构与质量门禁。方法论原始出处见《Spec 驱动开发（SDD）实战指南》。
