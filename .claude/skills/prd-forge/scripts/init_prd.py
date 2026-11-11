#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
init_prd.py — 生成 PRD 骨架

从 assets/prd-template.md 读取模板，按文档级别裁剪章节、预分配需求编号，
输出一份可以直接开始填写的 Markdown 文件。避免每次手抄模板导致结构漂移。

用法:
    python init_prd.py --title "订单导出" --out prd.md
    python init_prd.py --title "订单导出" --level L3 --fr 8 --out prd.md
    python init_prd.py --title "改个按钮文案" --level L1 --out change.md

依赖: 仅 Python 3.8+ 标准库。
"""

import argparse
import datetime
import os
import re
import sys

# 各级别保留的章节号。附录（术语表）始终保留。
LEVEL_KEEP = {
    "L1": {0, 1, 3, 8},
    "L2": {0, 1, 2, 3, 4, 5, 6, 7, 8},
    "L3": {0, 1, 2, 3, 4, 5, 6, 7, 8},
}

DEFAULT_FR = {"L1": 2, "L2": 4, "L3": 6}

CHAPTER_RE = re.compile(r"^##\s+(\d+)\s*[\.、．]")


def locate_template():
    """定位模板文件：优先同级 assets 目录，其次当前工作目录。"""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, os.pardir, "assets", "prd-template.md"),
        os.path.join(here, "assets", "prd-template.md"),
        os.path.join(os.getcwd(), "assets", "prd-template.md"),
    ]
    for path in candidates:
        path = os.path.normpath(path)
        if os.path.isfile(path):
            return path
    return None


def build_fr_block(index, total):
    """生成第 index 条需求（从 1 开始）的骨架。第一条给出完整示例提示。"""
    fid = "FR-%03d" % index
    priority = "P0" if index == 1 else ("P1" if index <= max(2, total // 2) else "P2")
    lines = [
        "### %s <需求名称>" % fid,
        "",
        "- **优先级**：%s" % priority,
        "- **关联**：US-001 ｜ 指标：<第 1.3 章中的指标名>",
        "- **描述**：系统必须在 <条件> 时 <行为>，否则 <替代行为>。",
        "- **业务规则**：",
        "  1. <规则，可判定真假>",
        "  2. <规则，含边界值>",
        "- **输入与校验**：",
        "  | 字段 | 类型 | 必填 | 约束 | 校验失败行为 |",
        "  |---|---|---|---|---|",
        "  | | | | | |",
        "- **异常与边界**：",
        "  | 场景 | 系统行为 | 用户可见反馈 |",
        "  |---|---|---|",
        "  | <非法输入> | | |",
        "  | <越权 / 超限 / 超时 / 并发 / 状态非法> | | |",
        "- **验收标准**：",
        "  - [ ] Given <前置条件>, When <操作>, Then <正向可观测结果>",
        "  - [ ] Given <异常前置条件>, When <操作>, Then <异常处理结果>",
        "",
    ]
    if index == 1:
        lines.insert(1, "")
        lines.insert(2, "> 六要素缺一不可。Then 必须落在可观测载体上：接口返回 / 数据状态 / 界面元素 / 外部副作用 / 日志。")
        lines.insert(3, "> 写完后删除本提示块。")
    return "\n".join(lines)


def replace_fr_section(text, count):
    """把模板中「功能需求」章的 FR 块整体替换为 count 条。"""
    pattern = re.compile(
        r"(^##\s+3\s*[\.、．].*?$)(.*?)(?=^##\s+4\s*[\.、．])",
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        return text
    head = m.group(1)
    intro = (
        "\n\n> 每条需求一个可独立验收的行为。出现「并且」「同时支持」时拆成多条。"
        "\n> 编号规则：FR-001 起连续编号，全文档唯一，废弃编号保留不复用。\n\n"
    )
    blocks = "\n".join(build_fr_block(i, count) for i in range(1, count + 1))
    return text[:m.start()] + head + intro + blocks + text[m.end():]


def replace_trace_section(text, count):
    """重建追踪矩阵的行，使行数与预分配的需求条数一致。"""
    start = text.find("## 8.")
    if start < 0:
        return text
    nxt = text.find("\n## ", start + 1)
    end = nxt if nxt > 0 else len(text)
    section = text[start:end]

    lines = section.splitlines()
    sep_idx = None
    for i, line in enumerate(lines):
        if re.match(r"^\|[\s\-:|]+\|$", line.strip()):
            sep_idx = i
            break
    if sep_idx is None:
        return text

    head = lines[:sep_idx + 1]
    rows = []
    for i in range(1, count + 1):
        rows.append("| FR-%03d | | | | TC-%03d | 待开发 |" % (i, i))
    rebuilt = "\n".join(head + rows) + "\n"
    return text[:start] + rebuilt + text[end:]


def trim_chapters(text, keep):
    """按章节号裁剪。附录（无编号的 ## 标题）始终保留。"""
    lines = text.splitlines()
    out = []
    i = 0
    total = len(lines)
    while i < total:
        line = lines[i]
        m = CHAPTER_RE.match(line)
        if m:
            num = int(m.group(1))
            j = i + 1
            while j < total and not CHAPTER_RE.match(lines[j]) and not lines[j].startswith("## "):
                j += 1
            if num in keep:
                out.extend(lines[i:j])
            i = j
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def main(argv=None):
    parser = argparse.ArgumentParser(description="生成 PRD 骨架")
    parser.add_argument("--title", required=True, help="产品/功能名称")
    parser.add_argument("--out", required=True, help="输出文件路径（.md）")
    parser.add_argument("--level", default="L2", choices=["L1", "L2", "L3"],
                        help="文档级别（默认 L2）")
    parser.add_argument("--fr", type=int, default=None, help="预分配的功能需求条数")
    parser.add_argument("--author", default="<姓名>", help="负责人姓名")
    parser.add_argument("--force", action="store_true", help="覆盖已存在的文件")
    args = parser.parse_args(argv)

    template_path = locate_template()
    if not template_path:
        sys.stderr.write(
            "错误：未找到模板 assets/prd-template.md。\n"
            "请确认 scripts/ 与 assets/ 处于同一 Skill 目录下。\n"
        )
        return 2

    with open(template_path, "r", encoding="utf-8-sig") as fh:
        text = fh.read()

    fr_count = args.fr if args.fr is not None else DEFAULT_FR[args.level]
    if fr_count < 1:
        sys.stderr.write("错误：--fr 至少为 1\n")
        return 2

    today = datetime.date.today().isoformat()
    text = text.replace("# <产品/功能名称> 产品需求文档", "# %s 产品需求文档" % args.title, 1)
    text = text.replace("YYYY-MM-DD", today)
    text = text.replace("<姓名>", args.author)

    text = replace_fr_section(text, fr_count)
    text = replace_trace_section(text, fr_count)
    text = trim_chapters(text, LEVEL_KEEP[args.level])

    # 压缩连续空行，避免裁剪后留下大片空白
    text = re.sub(r"\n{3,}", "\n\n", text).rstrip() + "\n"

    out_path = os.path.abspath(args.out)
    parent = os.path.dirname(out_path)
    if parent and not os.path.isdir(parent):
        sys.stderr.write("错误：输出目录不存在 —— %s\n" % parent)
        return 2
    if os.path.exists(out_path) and not args.force:
        sys.stderr.write("错误：文件已存在 —— %s\n加 --force 可覆盖。\n" % out_path)
        return 2

    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    print("已生成：%s" % out_path)
    print("级别 %s ｜ 预分配需求 %d 条 ｜ 模板来源 %s"
          % (args.level, fr_count, os.path.normpath(template_path)))
    print("下一步：填写内容后运行  python scripts/prd_lint.py \"%s\"" % args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
