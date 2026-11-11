#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prd_forge_eval.py — prd-forge 质量门禁的回归评测集

商用评估的核心问题不是「跑一遍看着不错」，而是：
  1. 合格的文档会不会被误拦截？（误报率）
  2. 植入了缺陷的文档能不能被抓住？（检出率）
  3. 结构完美但语义有病的文档，门禁能不能发现？（能力边界）

用法:
    python eval/prd_forge_eval.py            # 完整报告
    python eval/prd_forge_eval.py --quiet    # 仅汇总指标

退出码:
    0  所有「必须拦截」与「不应拦截」用例均符合预期
    1  存在偏离预期的用例
    2  评测环境错误
"""

import argparse
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_lint():
    path = os.path.join(ROOT, "scripts", "prd_lint.py")
    if not os.path.isfile(path):
        sys.stderr.write("错误：找不到 %s\n" % path)
        raise SystemExit(2)
    spec = importlib.util.spec_from_file_location("prd_lint", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


LINT = load_lint()

# ---------------------------------------------------------------- 基准文档
# 一份结构完整、内容合格的 L3 PRD。所有用例都是对它做定点变异，
# 这样每个用例的差异只有一个变量，出问题能直接归因到规则本身。

BASE = r"""# 员工报销审批 产品需求文档

> 文档版本：v1.0 ｜ 级别：L3 ｜ 最后更新：2026-11-10 ｜ 负责人：张三

## 0. 文档信息与变更记录

### 变更记录

| 版本 | 日期 | 修改人 | 变更内容 | 影响的需求 ID |
|---|---|---|---|---|
| v1.0 | 2026-11-10 | 张三 | 初稿，覆盖提交、审批、查验、导出四条链路 | 全部 |

## 1. 背景与目标

### 1.1 背景

现行报销流程依赖线下单据流转，平均处理时长 6.5 个工作日，报销人无法获知单据当前所处环节。

### 1.2 业务目标与成功指标

| 指标 | 当前基线 | 目标值 | 观测方式 |
|---|---|---|---|
| 报销平均处理时长 | 6.5 个工作日 | 2 个工作日 | 流程日志 |
| 单据驳回率 | 18% | 8% | 审批记录 |

### 1.3 非目标

- 不做与银行系统的直连打款 —— 原因：涉及资金通道合规审批，本期不具备条件。
- 不做移动端拍照上传 —— 原因：本期先验证 Web 端流程闭环。

## 2. 用户故事与主流程

### 2.1 用户故事

| 编号 | 用户故事 | 验收关联 | 优先级 |
|---|---|---|---|
| US-001 | 作为 报销人，我希望 一次提交多张发票，以便 减少重复填写 | FR-001 | P0 |
| US-002 | 作为 审批人，我希望 在列表页直接通过或驳回，以便 不必逐张打开 | FR-002 | P1 |
| US-003 | 作为 财务，我希望 导出台账用于对账，以便 与总账核对 | FR-004 | P2 |

### 2.2 主流程

1. 报销人新建单据并上传发票。
2. 提交后系统按金额路由到对应审批层级。
3. 审批通过后进入财务查验，查验通过则流程结束。

## 3. 功能需求

### FR-001 多发票批量提交

- **优先级**：P0
- **关联**：US-001 ｜ 目标：缩短处理时长
- **描述**：系统必须在单张报销单内接收 1 至 50 张发票，并在提交时一次性校验全部发票的必填字段。
- **业务规则**：
  - 单张报销单的发票数量上限为 50 张。
  - 发票金额合计超过 50000 元时进入特批流程。
- **异常与边界**：
  - 发票数量超过 50 张时，返回错误码 INVOICE_LIMIT，并提示当前已上传数量。
  - 上传过程中断网，已上传发票保留，用户可续传。
- **验收标准**：
  - [ ] Given 用户已上传 49 张发票，When 再上传 1 张，Then 提交成功且单据状态变为已提交
  - [ ] Given 用户已上传 50 张发票，When 再上传 1 张，Then 返回 INVOICE_LIMIT 且发票记录数不变

### FR-002 审批流转

- **优先级**：P1
- **关联**：US-002 ｜ 目标：缩短处理时长
- **描述**：系统必须按单据金额将单据路由至对应审批层级，并在每级审批完成后推进到下一级。
- **业务规则**：
  - 金额不超过 5000 元走单级审批，超过 5000 元走两级审批。
- **异常与边界**：
  - 审批人离职时，单据自动转交其直属上级。
  - 同一单据不允许两位审批人并发通过。
- **验收标准**：
  - [ ] Given 单据金额 3000 元，When 提交审批，Then 路由到直属主管单级审批
  - [ ] Given 单据金额 8000 元，When 提交审批，Then 先路由到直属主管，再路由到财务负责人

### FR-003 发票查验

- **优先级**：P1
- **关联**：US-001 ｜ 目标：降低驳回率
- **描述**：系统必须在发票上传后调用查验服务校验真伪，并将查验结果写入发票记录。
- **业务规则**：
  - 查验结果分为通过、不通过、查验中三种状态。
  - 查验中的发票允许提交，但单据进入财务时需重新查验。
- **异常与边界**：
  - 查验服务超时超过 10 秒时，发票标记为查验中，不阻断提交。
- **验收标准**：
  - [ ] Given 发票号码有效，When 上传完成，Then 发票状态变为通过并记录查验时间
  - [ ] Given 查验服务超时，When 上传完成，Then 发票状态为查验中且单据仍可提交

### FR-004 台账导出

- **优先级**：P2
- **关联**：US-003 ｜ 目标：支持对账
- **描述**：系统必须支持按日期区间导出报销台账，导出文件为 CSV 格式。
- **业务规则**：
  - 单次导出的最大时间跨度为 366 天。
  - 导出文件编码为 UTF-8 并带表头。
- **异常与边界**：
  - 时间跨度超过 366 天时返回错误码 RANGE_LIMIT。
  - 导出记录数为 0 时仍生成带表头的空文件。
- **验收标准**：
  - [ ] Given 选择 30 天区间，When 点击导出，Then 下载文件包含该区间内全部单据且首行为表头
  - [ ] Given 选择 400 天区间，When 点击导出，Then 返回 RANGE_LIMIT 且不生成文件

## 4. 业务规则与状态机

### 4.1 业务规则

| 编号 | 规则 | 关联需求 | 异常处理 |
|---|---|---|---|
| BR-001 | 单张报销单最多 50 张发票 | FR-001 | 返回 INVOICE_LIMIT |
| BR-002 | 金额超过 5000 元走两级审批 | FR-002 | 缺少上级时转财务负责人 |
| BR-003 | 已提交单据不可直接修改，需撤回后重提 | FR-002 | 撤回保留操作日志 |
| BR-004 | 查验超时不阻断提交 | FR-003 | 发票标记为查验中 |

### 4.2 状态机

单据状态流转：草稿 → 已提交 → 审批中 → 已通过。驳回后回到草稿，撤回后回到草稿。

## 5. 非功能需求

| 编号 | 类别 | 指标 | 目标值 | 测量条件 | 验证方式 |
|---|---|---|---|---|---|
| NFR-001 | 性能 | 列表页 P95 响应时间 | 300 ms | 1000 条单据数据量 | 压测 |
| NFR-002 | 安全 | 传输与存储加密 | 传输与存储均加密 | 全链路 | 安全评审 |
| NFR-003 | 可用性 | 月度可用性 | 99.5% | 按自然月统计 | 监控报表 |
| NFR-004 | 容量 | 单账号单据上限 | 10 万条 | — | 容量测试 |

## 6. 数据与埋点需求

| 事件名 | 触发时机 | 关键属性 |
|---|---|---|
| invoice_upload | 发票上传完成 | user_id、count、size_kb |
| submit_click | 点击提交 | user_id、invoice_count、amount |
| export_click | 点击导出 | user_id、range_days、row_count |

## 7. 依赖、风险与开放问题

### 7.1 依赖

| 编号 | 依赖项 | 用途 | 责任方 | 状态 |
|---|---|---|---|---|
| DEP-001 | 发票查验服务 | 校验发票真伪 | 财务中台 | 已具备 |

### 7.2 风险

| 编号 | 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|---|
| RISK-001 | 查验服务超时导致提交失败 | 中 | 高 | 异步查验，失败不阻断提交 |

### 7.3 开放问题

| 编号 | 问题 | 假设 | 阻塞程度 | 负责人 | 期限 |
|---|---|---|---|---|---|
| Q-001 | 特批流程的审批层级 | 假设由财务总监终审 | 不阻塞 | 李四 | 2026-11-20 |

## 8. 需求追踪矩阵

| 需求 ID | 关联目标 | 用户故事 | 开发任务 | 测试用例 | 状态 |
|---|---|---|---|---|---|
| FR-001 | 缩短处理时长 | US-001 | T-001 提交与校验 | TC-001 至 TC-008 | 待开发 |
| FR-002 | 缩短处理时长 | US-002 | T-002 审批路由 | TC-009 至 TC-016 | 待开发 |
| FR-003 | 降低驳回率 | US-001 | T-003 查验对接 | TC-017 至 TC-024 | 待开发 |
| FR-004 | 支持对账 | US-003 | T-004 导出 | TC-025 至 TC-030 | 待开发 |
"""


# ---------------------------------------------------------------- 变异工具
# 变异必须真的改到目标，否则测试本身就是无效的。上一轮出现过
# 「只去掉一个复选框前缀、另两条还在」的假变异，这里用锚点断言防住。

def rep(old, new, count=1):
    def fn(text):
        if old not in text:
            raise AssertionError("变异锚点不存在：%r" % old[:50])
        return text.replace(old, new, count)
    return fn


def seq(*fns):
    def fn(text):
        for f in fns:
            text = f(text)
        return text
    return fn


def drop_fr_block(fr_id):
    """删掉指定 FR 从标题到下一个 ### 标题之间的全部内容。"""
    def fn(text):
        start = text.find("### %s" % fr_id)
        if start < 0:
            raise AssertionError("找不到 %s" % fr_id)
        nxt = text.find("\n### ", start + 1)
        if nxt < 0:
            nxt = text.find("\n## ", start + 1)
        if nxt < 0:
            raise AssertionError("找不到 %s 的块尾" % fr_id)
        return text[:start] + text[nxt + 1:]
    return fn


def noop(text):
    return text


def _strip_digits_in_ch1(text):
    """把第 1 章正文里的所有数字替换成「若干」，但保留章标题本身。

    注意不能对整章做正则替换：章标题「## 1. 背景与目标」自带数字，
    替换掉会导致章节解析失败，测出来的是另一个缺陷。
    """
    import re as _re
    head = "## 1. 背景与目标\n"
    start = text.find(head)
    end = text.find("## 2. 用户故事与主流程")
    if start < 0 or end < 0:
        raise AssertionError("找不到第 1 章边界")
    body_start = start + len(head)
    body = _re.sub(r"\d+(?:\.\d+)?", "若干", text[body_start:end])
    return text[:body_start] + body + text[end:]


# ---------------------------------------------------------------- 用例定义
# tag: positive  = 合格文档，不应被拦截
#      planted   = 植入了明确缺陷，必须检出指定错误码
#      semantic  = 语义有病但结构完美，用于测量能力边界
#      gap       = 规则覆盖不到的区间，用于测量漏检

CASES = [
    # ---- 合格文档：不该被拦 ----
    dict(name="base_good", tag="positive", level="L3", fn=noop,
         desc="完整合格的 L3 PRD",
         expect=set(), block=False),

    dict(name="ac_numbered_list", tag="positive", level="L3",
         fn=seq(rep("- [ ] Given 单据金额 3000 元", "1. Given 单据金额 3000 元"),
                rep("- [ ] Given 单据金额 8000 元", "2. Given 单据金额 8000 元")),
         desc="验收标准用有序列表而非复选框（团队常见写法）",
         expect=set(), block=False),

    dict(name="heading_no_dot", tag="positive", level="L3",
         fn=rep("## 3. 功能需求", "## 3 功能需求"),
         desc="章标题用「## 3 功能需求」而非「## 3. 功能需求」",
         expect=set(), block=False),

    dict(name="term_false_positive", tag="positive", level="L3",
         fn=rep("| NFR-001 | 性能 | 列表页 P95 响应时间 | 300 ms |",
                "| NFR-001 | 性能 | 列表页 P95 响应时间 | 300 ms，由查询优化器生成执行计划 |"),
         desc="「查询优化器」是技术术语，裸子串匹配会当成模糊词",
         expect=set(), block=False),

    dict(name="l1_scope", tag="positive", level="L1",
         fn=noop,
         desc="同一文档按 L1 级别检查（只要求 1/3 章）",
         expect=set(), block=False),

    # ---- 植入缺陷：必须检出 ----
    dict(name="dup_id", tag="planted", level="L3",
         fn=rep("### FR-004 台账导出", "### FR-001 台账导出"),
         desc="需求编号重复（FR-004 改成 FR-001）",
         expect={"E004"}, block=True),

    dict(name="no_ac", tag="planted", level="L3",
         fn=seq(rep("- **验收标准**：\n  - [ ] Given 发票号码有效，When 上传完成，Then 发票状态变为通过并记录查验时间\n"
                     "  - [ ] Given 查验服务超时，When 上传完成，Then 发票状态为查验中且单据仍可提交\n", ""),
                rep("- **异常与边界**：\n  - 查验服务超时超过 10 秒时，发票标记为查验中，不阻断提交。",
                    "- **异常与边界**：\n  - 查验服务超时超过 10 秒时，发票标记为查验中，不阻断提交。\n"
                    "- **备注**：验收由测试同学线下确认。")),
         desc="FR-003 保留其余字段但整块删掉验收标准",
         expect={"E005"}, block=True),

    dict(name="fr_h4_bypass", tag="planted", level="L3",
         fn=seq(rep("### FR-003 发票查验", "#### FR-003 发票查验"),
                rep("- **验收标准**：\n  - [ ] Given 发票号码有效，When 上传完成，Then 发票状态变为通过并记录查验时间\n"
                    "  - [ ] Given 查验服务超时，When 上传完成，Then 发票状态为查验中且单据仍可提交\n", "")),
         desc="需求标题降为四级并删掉验收标准（换标题层级试图绕过门禁）",
         expect={"E005"}, block=True),

    dict(name="ac_no_items", tag="planted", level="L3",
         fn=seq(rep("- [ ] Given 发票号码有效，When 上传完成，Then 发票状态变为通过并记录查验时间\n", ""),
                rep("- [ ] Given 查验服务超时，When 上传完成，Then 发票状态为查验中且单据仍可提交", "查验标准见附件说明")),
         desc="有「验收标准」标题但无具体条目",
         expect={"E006"}, block=True),

    dict(name="no_priority", tag="planted", level="L3",
         fn=rep("- **优先级**：P2\n- **关联**：US-003", "- **关联**：US-003"),
         desc="FR-004 缺优先级",
         expect={"E007"}, block=True),

    dict(name="todo_left", tag="planted", level="L3",
         fn=rep("导出文件编码为 UTF-8 并带表头。", "导出文件编码待补充。"),
         desc="残留「待补充」占位符",
         expect={"E008"}, block=True),

    dict(name="empty_chapter", tag="planted", level="L3",
         fn=lambda t: (t[:t.find("## 4. 业务规则与状态机")] + "## 4. 业务规则与状态机\n\n"
                       + t[t.find("## 5. 非功能需求"):]),
         desc="第 4 章整章只有标题（规则表与状态机全部缺失）",
         expect={"E002"}, block=True),

    dict(name="no_fr_at_all", tag="planted", level="L3",
         fn=lambda t: t.replace("### FR-0", "### 功能需求 "),
         desc="需求未按 FR-xxx 编号",
         expect={"E003"}, block=True),

    dict(name="vague_ch3", tag="planted", level="L3",
         fn=rep("- **描述**：系统必须支持按日期区间导出报销台账，导出文件为 CSV 格式。",
                "- **描述**：系统必须支持按日期区间导出报销台账，导出文件为 CSV 格式，导出界面需美观友好。"),
         desc="第 3 章需求描述出现模糊形容词",
         expect={"W106"}, block=False),

    dict(name="nfr_unquantified", tag="planted", level="L3",
         fn=rep("| NFR-001 | 性能 | 列表页 P95 响应时间 | 300 ms |",
                "| NFR-001 | 性能 | 列表页 P95 响应时间 | 要足够快 |"),
         desc="性能类 NFR 目标值退化为形容词",
         expect={"W107"}, block=False),

    dict(name="no_scope", tag="planted", level="L3",
         fn=rep("### 1.3 非目标", "### 1.3 其他说明"),
         desc="缺非目标章节",
         expect={"W108"}, block=False),

    dict(name="no_indicator_num", tag="gap", level="L3",
         fn=lambda t: _strip_digits_in_ch1(t),
         desc="第 1 章全章无数字（W109 被章标题自带的「1」击穿，规则形同失效）",
         expect={"W109"}, block=False),

    dict(name="matrix_missing", tag="planted", level="L3",
         fn=rep("| FR-004 | 支持对账 | US-003 | T-004 导出 | TC-025 至 TC-030 | 待开发 |\n", ""),
         desc="追踪矩阵漏掉 FR-004",
         expect={"W110"}, block=False),

    dict(name="all_p0", tag="planted", level="L3",
         fn=seq(rep("- **优先级**：P1\n- **关联**：US-002", "- **优先级**：P0\n- **关联**：US-002"),
                rep("- **优先级**：P1\n- **关联**：US-001 ｜ 目标：降低驳回率", "- **优先级**：P0\n- **关联**：US-001 ｜ 目标：降低驳回率")),
         desc="四条需求全标 P0（未做取舍）",
         expect={"W111"}, block=False),

    dict(name="bad_story", tag="gap", level="L3",
         fn=rep("| US-002 | 作为 审批人，我希望 在列表页直接通过或驳回，以便 不必逐张打开 |",
                "| US-002 | 审批人可以直接审批 |"),
         desc="用户故事退化为一句陈述（原文含「作为」才检查，不含则完全跳过）",
         expect={"W112"}, block=False),

    dict(name="no_matrix", tag="planted", level="L3",
         fn=lambda t: t[:t.find("## 8. 需求追踪矩阵")],
         desc="L3 文档缺第 8 章追踪矩阵",
         expect={"E001"}, block=True),

    dict(name="unfilled_skeleton", tag="planted", level="L2",
         fn=lambda t: "# 需求 产品需求文档\n\n## 1. 背景与目标\n\n<一句话说明为什么做>\n\n"
                      "## 3. 功能需求\n\n### FR-001 <需求名称>\n- **优先级**：P0\n"
                      "- **描述**：<系统必须在什么条件下做什么>\n- **验收标准**：\n"
                      "  - [ ] Given <前置条件>，When <动作>，Then <可观测结果>\n",
         desc="未填写的空模板骨架（占位符 5 处）",
         expect={"E009"}, block=True),

    dict(name="gap_indicator_partial", tag="gap", level="L3",
         fn=rep("| 报销平均处理时长 | 6.5 个工作日 | 2 个工作日 | 流程日志 |\n| 单据驳回率 | 18% | 8% | 审批记录 |",
                "| 报销平均处理时长 | 较长 | 更短 | 流程日志 |\n| 单据驳回率 | 偏高 | 下降 | 审批记录 |"),
         desc="指标表全部退化为形容词，但背景段有数字（W109 只看整章有无数字）",
         expect={"W109"}, block=False),

    # ---- 能力边界：结构完美，语义有病 ----
    dict(name="semantic_conflict", tag="semantic", level="L3",
         fn=seq(rep("金额不超过 5000 元走单级审批，超过 5000 元走两级审批。",
                    "金额不超过 80000 元走单级审批，超过 8000 元走两级审批。"),
                rep("| BR-002 | 金额超过 5000 元走两级审批 |", "| BR-002 | 金额超过 8000 元走两级审批 |")),
         desc="审批阈值自相矛盾（80000 与 8000 重叠区间无定义），结构完全合格",
         expect=set(), block=False),

    dict(name="semantic_dead_rule", tag="semantic", level="L3",
         fn=rep("- 查验中的发票允许提交，但单据进入财务时需重新查验。",
                "- 查验中的发票允许提交，且单据进入财务时无需重新查验。"),
         desc="与 FR-003 查验规则冲突：超时发票免于复核，等于放开风险敞口",
         expect=set(), block=False),

    dict(name="gap_vague_in_br", tag="gap", level="L3",
         fn=rep("| BR-003 | 已提交单据不可直接修改，需撤回后重提 |",
                "| BR-003 | 已提交单据原则上不建议直接修改，金额较大时需适当复核 |"),
         desc="业务规则用模糊表述（规则库只扫第 3/5 章，第 4 章是盲区）",
         expect={"W106"}, block=True),

    dict(name="gap_english_vague", tag="gap", level="L3",
         fn=rep("Then 下载文件包含该区间内全部单据且首行为表头",
                "Then the export finishes fast and the layout looks friendly"),
         desc="英文模糊表述（模糊词表为中文，英文文档零检出）",
         expect={"W106"}, block=True),
]


# ---------------------------------------------------------------- 执行

def run_case(case):
    try:
        text = case["fn"](BASE)
    except AssertionError as exc:
        return {"status": "BROKEN", "reason": str(exc), "codes": set(),
                "score": None, "errors": 0, "warns": 0}
    doc, issues = LINT.lint(text, case["level"])
    codes = set(i.code for i in issues)
    score, errors, warns = LINT.score_of(issues)
    blocked = errors > 0
    return {"status": "OK", "codes": codes, "score": score,
            "errors": errors, "warns": warns, "blocked": blocked,
            "doc": doc, "issues": issues}


def main(argv=None):
    ap = argparse.ArgumentParser(description="prd-forge 门禁回归评测")
    ap.add_argument("--quiet", action="store_true", help="只输出汇总")
    ap.add_argument("--verbose", action="store_true", help="打印每条问题时序列")
    args = ap.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    rows = []
    for case in CASES:
        res = run_case(case)
        rows.append((case, res))

    # 判定
    stats = {"positive": [0, 0], "planted": [0, 0], "semantic": [0, 0], "gap": [0, 0]}
    tally = {"blocked": 0, "warn_only": 0, "missed": 0, "block_expect": 0,
             "planted_detected": 0, "gap_detected": 0}
    lines = []
    broken = 0

    if not args.quiet:
        print("=" * 78)
        print("prd-forge 门禁评测报告")
        print("=" * 78)
        print("%-22s %-9s %6s %4s %4s  %s" % ("用例", "类型", "评分", "E", "W", "判定"))
        print("-" * 78)

    for case, res in rows:
        tag = case["tag"]
        if res["status"] == "BROKEN":
            broken += 1
            verdict = "测试无效：" + res["reason"]
            sc, e, w, codes = "-", "-", "-", set()
        else:
            codes = res["codes"]
            sc, e, w = res["score"], res["errors"], res["warns"]
            if tag == "positive":
                ok = (not res["blocked"]) and not codes
                if ok:
                    verdict = "正确放行"
                elif res["blocked"]:
                    verdict = "误拦截 ←"
                else:
                    verdict = "误告警 ←"
            elif tag in ("planted", "gap"):
                hit = case["expect"].issubset(codes)
                if case["block"] and tag == "planted":
                    tally["block_expect"] += 1
                if hit:
                    tally[tag + "_detected"] = tally.get(tag + "_detected", 0) + 1
                if hit and res["blocked"]:
                    tally["blocked"] += 1
                    verdict = "已拦截"
                    ok = True
                elif hit:
                    tally["warn_only"] += 1
                    verdict = "已告警未拦截" if not case["block"] else "应拦截却放行 ←"
                    ok = not case["block"]
                else:
                    tally["missed"] += 1
                    tally["missed_" + tag] = tally.get("missed_" + tag, 0) + 1
                    # gap 类用例是已知盲区，记录但不判失败；planted 漏检才是回退
                    verdict = "漏检（已知盲区）" if tag == "gap" else "漏检 ←"
                    ok = (tag == "gap")
            else:  # semantic
                ok = None
                verdict = "未检出（结构通过 %d 分）" % sc
            stats[tag][1] += 1
            if ok:
                stats[tag][0] += 1
            if args.verbose:
                verdict += "  " + "/".join(sorted(codes))
        if not args.quiet:
            print("%-22s %-9s %6s %4s %4s  %s" % (case["name"], tag, sc, e, w, verdict))
            lines.append((case, res))

    if not args.quiet:
        print("-" * 78)
        print("用例明细")
        print("-" * 78)
        for case, res in lines:
            print("· %s — %s" % (case["name"], case["desc"]))
            if res["status"] != "OK":
                continue
            shown = [i for i in res["issues"] if i.level == "ERROR"][:3]
            for i in shown:
                print("    %s" % i.render().splitlines()[0])
            if not res["issues"]:
                print("    （无任何问题）")

    pos_ok, pos_n = stats["positive"]
    pl_ok, pl_n = stats["planted"]
    gp_ok, gp_n = stats["gap"]
    se_ok, se_n = stats["semantic"]

    print()
    print("=" * 78)
    print("汇总指标")
    print("=" * 78)
    print("合格文档不被误判 : %d/%d  (误报率 %.0f%%)"
          % (pos_ok, pos_n, (1 - pos_ok / pos_n) * 100 if pos_n else 0))
    print("规则集内缺陷检出 : %d/%d  (结构类缺陷，规则按设计生效)"
          % (tally["planted_detected"], pl_n))
    print("  其中触发 ERROR 拦截: %d/%d"
          % (tally["blocked"], tally["block_expect"]))
    print("  仅触发 WARN 不阻断 : %d 条（CI 门禁视为通过）" % tally["warn_only"])
    print("规则集外缺口检出 : %d/%d  (真实写法差异与语义问题)"
          % (tally["gap_detected"], gp_n))
    print("语义缺陷检出     : %d/%d  (结构完美但有病的文档)"
          % (se_ok, se_n))
    if broken:
        print("失效用例（变异未生效）: %d" % broken)
    print("=" * 78)

    # 判定失败的只有三种：误判合格文档、漏掉植入缺陷、评测用例本身失效。
    # gap 类（已知盲区）只做记录，它反映能力边界，不是回归。
    failed = (pos_ok < pos_n) or tally.get("missed_planted", 0) > 0 or broken
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
