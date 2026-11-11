#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prd_lint.py — PRD 确定性质量门禁

检查那些"读一遍感觉没问题"但实际会漏掉的结构性缺陷：
章节完整性、需求编号唯一性、验收标准覆盖、模糊词、非功能需求量化、
占位符残留、追踪矩阵覆盖率、优先级分布。

用法:
    python prd_lint.py prd.md
    python prd_lint.py prd.md --level L2
    python prd_lint.py prd.md --json
    python prd_lint.py prd.md --max-warn 20

退出码:
    0  无 ERROR（可能仍有 WARN）
    1  存在 ERROR
    2  参数或文件错误

依赖: 仅 Python 3.8+ 标准库。
"""

import argparse
import json
import os
import re
import sys

# ---------------------------------------------------------------- 常量定义

CHAPTER_RE = re.compile(r"^##\s+(\d{1,2})(?!\d)\s*[\.、．]?\s*(?=[^\s\d])")
FR_RE = re.compile(r"^#{3,6}\s+(FR-\d{2,})\b", re.IGNORECASE)
ANY_HEADING_RE = re.compile(r"^#{2,6}\s")
CHECKBOX_RE = re.compile(r"^\s*[-*+]\s*\[[ xX]\]")
ANY_ITEM_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
FIELD_RE = re.compile(r"^\s*[-*+]\s*\*\*([^*]+?)\*\*")
STORY_ROW_RE = re.compile(r"^\s*(?:\|\s*US-\d+|[-*+]\s*US-\d+)", re.IGNORECASE)
PRIORITY_RE = re.compile(r"\bP[0-3]\b|优先级\s*[:：]|\b(Must|Should|Could|Won't)\b", re.IGNORECASE)
ID_REF_RE = re.compile(r"\b(FR-\d{2,})\b", re.IGNORECASE)

# 模糊词：出现即说明该句子很可能不可验证。
VAGUE_WORDS = [
    "快速", "迅速", "尽快", "及时", "尽快地",
    "友好", "易用", "简便", "便捷", "简单易用", "流畅", "顺畅",
    "高效", "优化", "提升", "增强", "完善", "健全",
    "尽量", "尽可能", "适当", "合理", "合适", "恰当",
    "大幅", "显著", "明显", "卓越", "良好", "优秀", "较好",
    "美观", "好看", "舒服", "强大", "灵活", "丰富", "贴心",
    "若干", "多种", "多种多样", "等等",
    "体验好", "用户体验好", "智能化", "人性化",
]

# 中文没有词边界，「提升」「优化」出现在正当术语里会被裸子串匹配误伤。
# 这些复合词在扫描前先屏蔽，避免把产品功能名当成模糊表述。
VAGUE_ALLOW = (
    "提升额度", "查询优化", "优化器", "优化算法", "自动优化",
    "性能优化", "合理化建议", "合理性检查", "显著差异", "明显下降",
)

# 遗留占位符：出现在交付物中即为缺陷。
PLACEHOLDER_RE = re.compile(
    r"\bTODO\b|\bTBD\b|\bFIXME\b|待补充|待完善|此处省略|后续补充|xxx|XXX", re.IGNORECASE
)
ANGLE_PLACEHOLDER_RE = re.compile(r"<[^<>\n]{1,24}>")

# 各级别要求的章节。core 缺失记 ERROR，recommended 缺失记 WARN。
LEVEL_SECTIONS = {
    "L1": {"core": [1, 3], "recommended": [8]},
    "L2": {"core": [1, 3], "recommended": [2, 5, 6, 7, 8]},
    "L3": {"core": [0, 1, 2, 3, 4, 5, 6, 7, 8], "recommended": []},
}

SECTION_NAMES = {
    0: "文档信息与变更记录",
    1: "背景与目标",
    2: "用户故事与主流程",
    3: "功能需求",
    4: "业务规则与状态机",
    5: "非功能需求",
    6: "数据与埋点需求",
    7: "依赖、风险与开放问题",
    8: "需求追踪矩阵",
}


class Issue:
    """一条检查结果。"""

    __slots__ = ("level", "code", "message", "line", "hint")

    def __init__(self, level, code, message, line=None, hint=None):
        self.level = level        # "ERROR" / "WARN"
        self.code = code
        self.message = message
        self.line = line
        self.hint = hint

    def to_dict(self):
        return {
            "level": self.level,
            "code": self.code,
            "message": self.message,
            "line": self.line,
            "hint": self.hint,
        }

    def render(self):
        loc = "L%-4d" % self.line if self.line else "  -  "
        text = "[%s] %s %s  %s" % (self.level, loc, self.code, self.message)
        if self.hint:
            text += "\n            → " + self.hint
        return text


# ---------------------------------------------------------------- 解析

class Doc:
    """一份 PRD 的结构化视图。"""

    def __init__(self, raw):
        self.raw = raw
        self.lines = raw.splitlines()
        self.chapters = self._parse_chapters()
        self.fr_blocks = self._parse_fr_blocks()

    def _parse_chapters(self):
        """返回 {章节号: (起始行下标, 结束行下标)}，行下标从 0 开始。"""
        starts = []
        for idx, line in enumerate(self.lines):
            m = CHAPTER_RE.match(line)
            if m:
                starts.append((int(m.group(1)), idx))
        result = {}
        for pos, (num, start) in enumerate(starts):
            end = starts[pos + 1][1] if pos + 1 < len(starts) else len(self.lines)
            result[num] = (start, end)
        return result

    def _parse_fr_blocks(self):
        """返回 [(fr_id, 起始行下标, 结束行下标)]，块内包含 ### FR-xxx 行本身。"""
        blocks = []
        marks = []
        for idx, line in enumerate(self.lines):
            m = FR_RE.match(line)
            if m:
                marks.append((m.group(1).upper(), idx))
        for pos, (fid, start) in enumerate(marks):
            end = len(self.lines)
            for nxt in range(start + 1, len(self.lines)):
                if ANY_HEADING_RE.match(self.lines[nxt]):
                    end = nxt
                    break
            blocks.append((fid, start, end))
        return blocks

    def chapter_text(self, num):
        if num not in self.chapters:
            return ""
        start, end = self.chapters[num]
        return "\n".join(self.lines[start:end])

    def block_text(self, start, end):
        return "\n".join(self.lines[start:end])

    def line_no(self, idx):
        return idx + 1


def ac_items(doc, start, end):
    """取出 FR 块内「验收标准」下面的具体条目。

    只认复选框会让「1. Given ...」「- Given ...」这类同样合格的写法被判成
    「有标题无条目」，所以这里接受任意列表标记，并把范围收敛到验收标准
    字段之后、下一个字段之前——否则业务规则的列表项会被算进验收标准。
    """
    lines = doc.lines
    ac_idx = None
    for idx in range(start, end):
        if "验收标准" in lines[idx]:
            ac_idx = idx  # 取最后一次出现，避免描述里顺带提到该词
    if ac_idx is None:
        return []

    items = []
    marker = lines[ac_idx]
    if "**" in marker:
        tail = marker.split("**")[-1].lstrip("：: \t")
        if tail.strip():
            items.append(tail.strip())  # 支持把验收标准直接写在字段行

    for idx in range(ac_idx + 1, end):
        line = lines[idx]
        if FIELD_RE.match(line) or ANY_HEADING_RE.match(line):
            break
        if ANY_ITEM_RE.match(line):
            items.append(line.strip())
    return items


# ---------------------------------------------------------------- 检查项

def check_sections(doc, level):
    """E001 / W101 — 章节完整性。"""
    issues = []
    rule = LEVEL_SECTIONS[level]
    for num in rule["core"]:
        if num not in doc.chapters:
            issues.append(Issue(
                "ERROR", "E001",
                "缺少必需章节：第 %d 章 %s" % (num, SECTION_NAMES.get(num, "")),
                hint="按 assets/prd-template.md 补齐该章，或降级文档级别（--level L1）",
            ))
    for num in rule["recommended"]:
        if num not in doc.chapters:
            issues.append(Issue(
                "WARN", "W101",
                "缺少建议章节：第 %d 章 %s" % (num, SECTION_NAMES.get(num, "")),
                hint="确属本级别不需要时，可在文档中显式写明「本期不涉及」",
            ))
    return issues


def check_empty_chapters(doc):
    """E002 — 章节有标题但无内容。"""
    issues = []
    for num, (start, end) in sorted(doc.chapters.items()):
        body = [l for l in doc.lines[start + 1:end] if l.strip()]
        # 去掉纯子标题与表格分隔行后仍为空，才算空章节
        substantive = [
            l for l in body
            if not ANY_HEADING_RE.match(l)
            and not re.match(r"^\|[\s\-:|]+\|$", l.strip())
        ]
        if not substantive:
            issues.append(Issue(
                "ERROR", "E002",
                "第 %d 章 %s 为空章节（只有标题，无实质内容）" % (num, SECTION_NAMES.get(num, "")),
                line=doc.line_no(start),
                hint="补齐内容；若本期不涉及，写明「本期不涉及」及原因",
            ))
    return issues


def check_fr_required(doc):
    """E003 — 文档没有任何功能需求编号。"""
    if not doc.fr_blocks:
        return [Issue(
            "ERROR", "E003",
            "未发现任何功能需求条目（应以 '### FR-001' 形式编号）",
            hint="功能需求必须独立编号，否则无法被追踪与验收",
        )]
    return []


def check_duplicate_ids(doc):
    """E004 — 需求编号重复。"""
    seen = {}
    for fid, start, _ in doc.fr_blocks:
        seen.setdefault(fid, []).append(start)
    issues = []
    for fid, starts in seen.items():
        if len(starts) > 1:
            lines = "、".join(str(doc.line_no(s)) for s in starts)
            issues.append(Issue(
                "ERROR", "E004",
                "需求编号 %s 重复出现 %d 次（第 %s 行）" % (fid, len(starts), lines),
                hint="编号必须全文档唯一；废弃需求保留编号并标注「已废弃」，不得复用",
            ))
    return issues


def check_fr_completeness(doc):
    """E005 / E006 / E007 / W102 — 每条需求的要素与验收标准。"""
    issues = []
    for fid, start, end in doc.fr_blocks:
        text = doc.block_text(start, end)
        ln = doc.line_no(start)

        has_ac = ("验收标准" in text) or re.search(r"\b(Given|AC\s*:)", text, re.IGNORECASE)
        if not has_ac:
            issues.append(Issue(
                "ERROR", "E005",
                "%s 缺少验收标准" % fid,
                line=ln,
                hint="补 Given/When/Then，至少 1 条正向 + 1 条异常",
            ))
        else:
            items = ac_items(doc, start, end)
            if not items:
                issues.append(Issue(
                    "ERROR", "E006",
                    "%s 有「验收标准」标题但无具体条目" % fid,
                    line=ln,
                    hint="用 '- Given ..., When ..., Then ...' 或有序列表逐条列出，至少 1 条",
                ))
            elif len(items) > 6:
                issues.append(Issue(
                    "WARN", "W102",
                    "%s 验收标准有 %d 条，可能粒度过粗" % (fid, len(items)),
                    line=ln,
                    hint="考虑拆成多条独立 FR，便于分任务开发与分用例验证",
                ))

        if not PRIORITY_RE.search(text):
            issues.append(Issue(
                "ERROR", "E007",
                "%s 缺少优先级" % fid,
                line=ln,
                hint="标注 P0/P1/P2/P3，并在文档开头定义每级判定标准",
            ))

        if "描述" not in text:
            issues.append(Issue(
                "WARN", "W103",
                "%s 缺少「描述」字段" % fid,
                line=ln,
                hint="用「系统必须在 <条件> 时 <行为>」句式补一句，主语是系统",
            ))

        has_exception = ("异常" in text) or ("边界" in text)
        if not has_exception:
            issues.append(Issue(
                "WARN", "W104",
                "%s 未涉及异常或边界" % fid,
                line=ln,
                hint="过一遍六类异常：非法输入、越权、超限、超时、并发、状态非法",
            ))
    return issues


def check_placeholders(doc):
    """E008 — 遗留 TODO/TBD 类占位符。尖括号占位由 check_unfilled_template 统一聚合。"""
    issues = []
    for idx, line in enumerate(doc.lines):
        m = PLACEHOLDER_RE.search(line)
        if m:
            issues.append(Issue(
                "ERROR", "E008",
                "存在未清理的占位符「%s」" % m.group(0),
                line=doc.line_no(idx),
                hint="交付物不允许保留 TODO/TBD/待补充；未定内容请转为开放问题",
            ))
    return issues


def check_vague_words(doc, limit=15, allow=()):
    """W106 — 需求正文中的模糊词。只扫第 3、5 章，避免背景与开放问题误报。

    allow 为项目自定义的豁免短语（如团队内部术语），与内置 VAGUE_ALLOW
    一起在扫描前屏蔽掉，减少中文裸子串匹配带来的误报。
    """
    issues = []
    mask_words = tuple(VAGUE_ALLOW) + tuple(allow)
    targets = [3, 5]
    hits = 0
    for num in targets:
        if num not in doc.chapters:
            continue
        start, end = doc.chapters[num]
        for idx in range(start + 1, end):
            line = doc.lines[idx]
            if not line.strip() or ANY_HEADING_RE.match(line):
                continue
            masked = line
            for phrase in mask_words:
                if phrase in masked:
                    masked = masked.replace(phrase, "　")
            for word in VAGUE_WORDS:
                if word in masked:
                    hits += 1
                    if hits <= limit:
                        snippet = line.strip()
                        if len(snippet) > 46:
                            snippet = snippet[:46] + "…"
                        issues.append(Issue(
                            "WARN", "W106",
                            "模糊词「%s」：%s" % (word, snippet),
                            line=doc.line_no(idx),
                            hint="换成可测数值或明确判定规则；确需保留请说明理由",
                        ))
                    break
    if hits > limit:
        issues.append(Issue(
            "WARN", "W106",
            "第 3/5 章另有 %d 处模糊词未逐条列出" % (hits - limit),
            hint="建议按 references/quality-rules.md 的黑名单全文检索",
        ))
    return issues


def check_nfr_numeric(doc):
    """W107 — 非功能需求未量化。

    性能/容量/可用性类必须有数字；安全/合规/兼容性类允许二值化的明确约束
    （如「传输与存储均加密」），只在这类描述退化为形容词时才报。
    """
    if 5 not in doc.chapters:
        return []
    start, end = doc.chapters[5]
    quant_required = ("性能", "容量", "可用性", "并发", "扩展")
    issues = []
    in_table = False
    for idx in range(start + 1, end):
        line = doc.lines[idx].strip()
        if line.startswith("|"):
            if re.match(r"^\|[\s\-:|]+\|$", line):
                in_table = True
                continue
            if not in_table:
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) < 4:
                continue
            category = cells[1]
            # 只校验「目标值」列。指标名常自带数字（P95、5 万条），
            # 若把指标名并入判断，任何性能需求都会被误判为已量化。
            target = cells[3]
            need_digit = any(k in category for k in quant_required)
            vague = any(w in target for w in VAGUE_WORDS)
            if need_digit and not re.search(r"\d", target):
                issues.append(Issue(
                    "WARN", "W107",
                    "非功能需求未量化（%s）：%s" % (category or "未分类", line[:48]),
                    line=doc.line_no(idx),
                    hint="补数值与测量条件；确实待定的写「待压测确定」并登记为开放问题",
                ))
            elif not need_digit and vague:
                issues.append(Issue(
                    "WARN", "W107",
                    "非功能需求描述为形容词，无法验证：%s" % line[:48],
                    line=doc.line_no(idx),
                    hint="改为明确约束，例如「传输与存储均加密」「符合<具体标准条款>」",
                ))
        else:
            in_table = False
    return issues


def check_scope(doc):
    """W108 — 非目标章节缺失或为空。"""
    if 1 not in doc.chapters:
        return []
    text = doc.chapter_text(1)
    issues = []
    if "非目标" not in text and "Out of Scope" not in text:
        issues.append(Issue(
            "WARN", "W108",
            "第 1 章未包含「非目标 / Out of Scope」",
            hint="明写本期不做什么及原因，这是控制范围蔓延的唯一抓手",
        ))
    else:
        seg = text.split("非目标", 1)[-1]
        bullets = [l for l in seg.splitlines() if l.strip().startswith("-")]
        if len(bullets) < 1:
            issues.append(Issue(
                "WARN", "W108",
                "「非目标」章节无具体排除项",
                hint="至少列 1 条明确不做的事，并写明排除原因",
            ))
    return issues


def check_indicators(doc):
    """W109 — 成功指标缺少数值或基线。"""
    if 1 not in doc.chapters:
        return []
    start, end = doc.chapters[1]
    text = doc.chapter_text(1)
    if "成功指标" not in text and "指标" not in text:
        return [Issue(
            "WARN", "W109",
            "第 1 章未见「成功指标」",
            hint="没有可观测指标的 PRD 无法在验收阶段判定是否达成目标",
        )]
    # 数字判定必须排除章标题：标题「## 1. 背景与目标」自带数字，
    # 若把标题算进来，这条规则永远为真，等于从未生效。
    body = "\n".join(doc.lines[start + 1:end])
    if not re.search(r"\d", body):
        return [Issue(
            "WARN", "W109",
            "第 1 章正文不含任何数字，成功指标疑似未量化",
            hint="补当前基线与目标值，例如「转化率 3.2% → 5%」",
        )]
    return []


def check_traceability(doc):
    """W110 — 追踪矩阵未覆盖全部需求。"""
    if 8 not in doc.chapters:
        return []
    text = doc.chapter_text(8)
    referenced = set(x.upper() for x in ID_REF_RE.findall(text))
    missing = [fid for fid, _, _ in doc.fr_blocks if fid not in referenced]
    if not missing:
        return []
    shown = "、".join(missing[:8]) + ("…" if len(missing) > 8 else "")
    return [Issue(
        "WARN", "W110",
        "%d 条需求未出现在追踪矩阵中：%s" % (len(missing), shown),
        hint="每条 FR 都需有对应测试用例，否则该需求实际未被验证",
    )]


def check_priority_ratio(doc):
    """W111 — P0 占比过高，说明未做取舍。"""
    if not doc.fr_blocks:
        return []
    p0 = 0
    total = 0
    for _, start, end in doc.fr_blocks:
        text = doc.block_text(start, end)
        m = re.search(r"\bP([0-3])\b", text)
        if m:
            total += 1
            if m.group(1) == "0":
                p0 += 1
    if total >= 4 and p0 / total > 0.4:
        return [Issue(
            "WARN", "W111",
            "P0 需求占比 %.0f%%（%d/%d），超过 40%%" % (p0 * 100.0 / total, p0, total),
            hint="P0 应为「不实现则无法上线」；占比过高说明优先级没有真正取舍",
        )]
    return []


def check_user_story(doc):
    """W112 — 用户故事格式不规范。

    只检查确实以 US-xxx 开头的表格行或列表项，避免把追踪矩阵里提到
    US-001 的行误判成用户故事；同时不再要求句中含「作为」——否则
    故事被写成一整句陈述时会被直接跳过，等于漏检。
    """
    issues = []
    story_ok = re.compile(r"作为[^，。；|]{1,30}[，,]\s*我")
    for idx, line in enumerate(doc.lines):
        s = line.strip()
        in_context = bool(STORY_ROW_RE.match(s)) or s.startswith("- 作为") or s.startswith("作为")
        if not in_context:
            continue
        if not story_ok.search(s):
            issues.append(Issue(
                "WARN", "W112",
                "用户故事格式不完整：%s" % s[:46],
                line=doc.line_no(idx),
                hint="统一为「作为 <角色>，我希望 <能力>，以便 <价值>」",
            ))
    return issues


def check_unparsed_fr(doc):
    """W114 — 形似需求标题但未被识别的行。

    需求标题的层级或编号写法一旦不合规（如 #### FR-001、### FR001），
    整条需求会被静默跳过，缺验收标准也查不出来。这条检查专门堵这个绕过口。
    """
    parsed_lines = set(start for _, start, _ in doc.fr_blocks)
    issues = []
    for idx, line in enumerate(doc.lines):
        if idx in parsed_lines:
            continue
        if not re.match(r"^#{2,6}\s", line):
            continue
        if re.search(r"\bFR[-\s_]?\d", line, re.IGNORECASE):
            issues.append(Issue(
                "WARN", "W114",
                "疑似需求标题未被识别：%s" % line.strip()[:46],
                line=doc.line_no(idx),
                hint="需求标题统一为「### FR-001 名称」；层级或编号不合规会导致该需求不被检查",
            ))
    return issues


TAG_WHITELIST = {
    "br", "hr", "img", "a", "span", "div", "p", "table", "tr", "td", "th",
    "code", "pre", "strong", "em", "li", "ul", "ol", "sub", "sup", "u",
}


def check_unfilled_template(doc):
    """E009 / W113 — 文档仍处于未填写状态。

    空模板通过门禁是质量门禁最危险的失效方式。这里按「出现次数」统计，
    不再按行跳过含 Given/When/Then 的行——模板里的验收标准示例恰好写在
    那种行上，按行跳过等于把最典型的未填写证据排除在外。
    """
    issues = []
    angle_total = 0
    for idx, line in enumerate(doc.lines):
        if PLACEHOLDER_RE.search(line):
            continue
        for m in ANGLE_PLACEHOLDER_RE.finditer(line):
            inner = m.group(0)[1:-1].strip().strip("/").strip().lower()
            if inner in TAG_WHITELIST:
                continue  # 正常的 HTML 标签，不是占位符
            angle_total += 1
        stripped = line.strip()
        if stripped.startswith("|") and not re.match(r"^\|[\s\-:|]+\|$", stripped):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if cells and all(c == "" for c in cells):
                angle_total += 1

    if angle_total >= 5:
        issues.append(Issue(
            "ERROR", "E009",
            "文档疑似仍为未填写的模板（%d 处占位符/空表格行）" % angle_total,
            hint="骨架只是起点，需填充实质内容后才能交付；阈值 5 处即可判定为未填写",
        ))
    elif angle_total > 0:
        issues.append(Issue(
            "WARN", "W113",
            "存在 %d 处疑似未填写的占位符或空表格行" % angle_total,
            hint="确认是否残留模板提示；确认无误可忽略",
        ))
    return issues


# ---------------------------------------------------------------- 主流程

ALL_CHECKS = [
    check_empty_chapters,
    check_fr_required,
    check_duplicate_ids,
    check_fr_completeness,
    check_placeholders,
    check_unfilled_template,
    check_nfr_numeric,
    check_scope,
    check_indicators,
    check_traceability,
    check_priority_ratio,
    check_user_story,
    check_unparsed_fr,
]


def lint(raw, level, allow=()):
    doc = Doc(raw)
    issues = []
    issues.extend(check_sections(doc, level))
    for fn in ALL_CHECKS:
        issues.extend(fn(doc))
    issues.extend(check_vague_words(doc, allow=allow))
    # 有行号的按行排序；无行号的汇总项排在同一级别末尾
    issues.sort(key=lambda i: (0 if i.level == "ERROR" else 1, i.line or 10 ** 6))
    return doc, issues


def score_of(issues):
    errors = sum(1 for i in issues if i.level == "ERROR")
    warns = sum(1 for i in issues if i.level == "WARN")
    return max(0, 100 - 12 * errors - 3 * warns), errors, warns


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="PRD 确定性质量门禁检查",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("path", help="PRD 的 Markdown 文件路径")
    parser.add_argument("--level", default="L2", choices=["L1", "L2", "L3"],
                        help="文档级别，决定必需章节（默认 L2）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    parser.add_argument("--max-warn", type=int, default=40, help="最多展示的 WARN 条数（默认 40）")
    parser.add_argument("--strict", action="store_true",
                        help="严格模式：任一 WARN 也判定为未通过，用于 CI 卡点")
    parser.add_argument("--allow", default="",
                        help="豁免的短语，逗号分隔，用于屏蔽团队内部术语被误判为模糊词")
    args = parser.parse_args(argv)

    if not os.path.isfile(args.path):
        sys.stderr.write("错误：文件不存在 —— %s\n" % args.path)
        return 2

    try:
        with open(args.path, "r", encoding="utf-8-sig") as fh:
            raw = fh.read()
    except OSError as exc:
        sys.stderr.write("错误：无法读取文件 —— %s\n" % exc)
        return 2

    allow = tuple(x.strip() for x in args.allow.split(",") if x.strip())
    doc, issues = lint(raw, args.level, allow=allow)
    score, errors, warns = score_of(issues)

    result = {
        "file": os.path.abspath(args.path),
        "level": args.level,
        "strict": args.strict,
        "score": score,
        "errors": errors,
        "warnings": warns,
        "chapters_found": sorted(doc.chapters.keys()),
        "fr_count": len(doc.fr_blocks),
        "issues": [i.to_dict() for i in issues],
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        render_text(result, issues, args.max_warn, args.strict)

    if errors:
        return 1
    if args.strict and warns:
        return 1
    return 0


def render_text(result, issues, max_warn, strict=False):
    out = []
    out.append("=" * 60)
    out.append("PRD 质量门禁报告")
    out.append("=" * 60)
    out.append("文件    : %s" % result["file"])
    out.append("级别    : %s%s" % (result["level"], " ｜ 严格模式" if strict else ""))
    out.append("章节    : %s" % ("、".join(str(n) for n in result["chapters_found"]) or "无"))
    out.append("需求条目: %d 条" % result["fr_count"])
    out.append("-" * 60)

    errs = [i for i in issues if i.level == "ERROR"]
    wans = [i for i in issues if i.level == "WARN"]

    if errs:
        out.append("")
        out.append("【ERROR】必须清零后才能交付（%d 项）" % len(errs))
        for i in errs:
            out.append("  " + i.render())

    if wans:
        out.append("")
        shown = wans[:max_warn]
        out.append("【WARN】逐条判断，确认误报需说明理由（%d 项，显示 %d 项）"
                   % (len(wans), len(shown)))
        for i in shown:
            out.append("  " + i.render())
        if len(wans) > len(shown):
            out.append("  ... 另有 %d 项未显示，用 --max-warn 调整" % (len(wans) - len(shown)))

    if not errs and not wans:
        out.append("")
        out.append("  未发现问题。")

    out.append("")
    out.append("-" * 60)
    blocked = bool(errs) or (strict and bool(wans))
    verdict = "未通过" if blocked else "通过"
    out.append("评分 %d/100 ｜ ERROR %d ｜ WARN %d ｜ 结论：%s"
               % (result["score"], len(errs), len(wans), verdict))
    if errs:
        out.append("存在 ERROR，文档未达到可交付标准。")
    elif wans and strict:
        out.append("严格模式下 WARN 也视为阻塞，处理完再提交。")
    elif wans:
        out.append("无阻塞问题，建议处理 WARN 后交付。")
    out.append("=" * 60)

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    print("\n".join(out))


if __name__ == "__main__":
    sys.exit(main())
