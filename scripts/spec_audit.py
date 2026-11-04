#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spec 就绪度体检（辅助层，非门禁）

设计约束（不可修改，否则本工具会退化成第 6 道门禁）：
  1. 永远 exit 0。任何异常都只降级为 WARN，不影响调用方退出码。
  2. 只读。不写 specs/ 下任何被门禁读取的文件；报告只落 specs/_audit/。
  3. 输出的是"评分 + 缺口 + 改写建议"，不是 PASS/FAIL。
  4. 不修改 SPEC 内容。改写由人或 /audit 命令在草稿区完成。

用法：
  python scripts/spec_audit.py specs/SPEC-003-xxx.md
  python scripts/spec_audit.py specs/            # 目录模式，输出质量分布
  python scripts/spec_audit.py specs/ --json     # 机器可读
"""

import sys
import os
import re
import json
import glob

# ---------------------------------------------------------------- 词表

# 与门禁 1 重合的硬禁词（此处仅计分，不阻断）
HARD_BANNED = ["另行确认", "后续讨论", "适当", "大概", "尽快", "视情况"]

# 软模糊词：不违反门禁，但会显著降低 AI 一次性交付成功率
SOFT_VAGUE = [
    "合理", "友好", "快速", "高效", "尽量", "优化一下", "等等", "若干",
    "比较", "较好", "完善", "灵活", "丰富", "良好", "必要时", "相关",
    "一些", "多个", "大量", "少量", "及时",
]

# Then 列可判定的信号。分两类，都算"机器可判定"，但观察点不同：
#   后端类：状态码 / 返回值或 schema / 数值阈值 / 错误码
#   前端类：断言的是"哪个元素处于什么可见/可用/数量状态"，Playwright 可直接判定
DECIDABLE = re.compile(
    r"(HTTP\s*\d{3}|code\s*[=≠]|\bcode\b|status\s*[=:]|\d+\s*(ms|s|条|行|个|次|字节|%|‰)|"
    r"[≥≤><=]\s*\d|total\s*[=≥]|rows|schema|errorCode|msg\s*非空|返回|异常码|"
    # 前端可判定：需同时有"可观测动作"与"具体对象"，故配合 UI_OBJECT 二次校验
    r"渲染|不渲染|展示|显示|隐藏|置灰|禁用|可点|可见|不可见|选中|勾选|列出|"
    r"数量|条数|文案|表头|列头|节点|toHaveText|toBeVisible|toBeDisabled|快照|snapshot)",
    re.I,
)
# 前端信号必须落在具体对象上，否则「展示友好提示」这类仍算模糊
UI_OBJECT = re.compile(
    r"(`[^`]{1,40}`|「[^」]{1,40}」|\"[^\"]{1,40}\"|[A-Za-z][A-Za-z0-9_]{2,}|"
    r"[\u4e00-\u9fa5]{1,8}(按钮|字段|输入框|列头|列|弹窗|对话框|提示|开关|树|选择器|节点|标签|图标|菜单|页签|数量))"
)
# Then 里用「或」并列两种不同结果 = 二选一，机器无法判定该走哪条
AMBIGUOUS_OR = re.compile(r"[^0-9]{2,}或[^0-9]{2,}")

# 边界覆盖的六类场景（按关键词聚类，命中即算覆盖）
EDGE_CLASSES = {
    "空值/空集": r"(空|null|nil|未填|为空|空数组|0\s*条|无数据|空串)",
    "超限/上限": r"(超过|上限|超长|溢出|最大|超出|越界|限流|配额|不足)",
    "重复/幂等": r"(重复|幂等|并发|同时|两次|再次|重放|双击)",
    "权限/越权": r"(无权限|越权|未授权|只读|非本人|角色|鉴权|401|403)",
    "超时/网络": r"(超时|timeout|断网|重试|网络异常|5\d\d|降级)",
    "非法状态": r"(非法|不允许|不支持|无效|已删除|冻结|已失效|状态机)",
}

CONTRACT_CHECKS = {
    "可空列": r"(可空|nullable|是否可空|非空)",
    "空值语义": r"(空值语义|null\s*的|为空时|空串|null\s*表示|未赋值)",
    "时区": r"(时区|UTC|GMT\+8|Asia/Shanghai|timestamp\s*时区)",
    "数值精度": r"(精度|小数|DECIMAL|BigDecimal|两位小数|金额单位|分)",
    "枚举全量": r"(枚举|取值范围|全部值|可选值|字典值)",
}

NFR_CHECKS = {
    "性能有数字": r"((P9\d|P5\d|TPS|QPS|并发)\D{0,12}\d|\d+\s*(ms|毫秒|秒))",
    "脱敏/加密": r"(脱敏|加密|掩码|敏感|AES|SM4|hash)",
    "留痕/审计": r"(留痕|审计日志|操作日志|operationLog|谁改的)",
    "可观测": r"(可观测|链路|traceId|指标|告警|监控|日志字段)",
}


def die_soft(msg):
    print(f"[WARN] {msg}")
    print("[辅助层] 体检未完成，但这不影响交付与门禁。")
    sys.exit(0)


def read(path):
    for enc in ("utf-8", "utf-8-sig", "gbk"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    return None


def parse_front_matter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return {}
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", line)
        if mm:
            fm[mm.group(1)] = mm.group(2).strip()
    return fm


def section(text, no):
    """取 '## N. xxx' 到下一个 '## ' 之间的内容"""
    m = re.search(rf"^##\s*{no}\.\s*(.*?)(?=^##\s|\Z)", text, re.S | re.M)
    return (m.group(0), m.group(1).strip()) if m else ("", "")


def table_rows(block, prefix):
    rows = []
    for line in block.splitlines():
        if re.match(rf"^\|\s*{prefix}-?\d*\s*\|", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            rows.append(cells)
    return rows


def count_bullets(block):
    """数列表项（含缩进的子项不重复计）"""
    n = 0
    for line in block.splitlines():
        if re.match(r"^\s{0,2}[-*]\s+\S", line):
            n += 1
    return n


def audit(path):
    text = read(path)
    if text is None:
        return {"file": path, "error": "无法读取（编码或权限）"}
    name = os.path.basename(path)
    fm = parse_front_matter(text)

    notes = []   # 缺口与建议
    score = 0
    detail = {}

    # ---------- 1. 断言可判定性 (30)
    sec2, _ = section(text, 2)
    a_rows = table_rows(sec2, "A")
    n_a = len(a_rows)
    dec = 0
    ui_only = 0
    bad_then = []
    ambiguous = []
    for r in a_rows:
        then = r[-1] if len(r) >= 5 else (r[-1] if r else "")
        strong = re.search(r"HTTP|code|total|rows|schema|errorCode|[≥≤><=]\s*\d", then, re.I)
        if not strong and AMBIGUOUS_OR.search(then):
            ambiguous.append(r[0] if r else "?")
        if DECIDABLE.search(then):
            # 前端类信号需要具体对象，避免「展示友好提示」蒙混过关
            if not strong:
                if not UI_OBJECT.search(then):
                    bad_then.append(r[0] if r else "?")
                    continue
                ui_only += 1
            dec += 1
        else:
            bad_then.append(r[0] if r else "?")
    dec_rate = (dec / n_a) if n_a else 0
    s1 = dec_rate * 22
    # 数量合理性：过少覆盖不全，过多则 AI 注意力被摊薄；按子域分组的 Packet 允许适度放宽
    if 5 <= n_a <= 15:
        s1 += 8
    elif 16 <= n_a <= 20:
        s1 += 5
        notes.append(f"断言 {n_a} 条偏多（建议单 Packet ≤15），确认是否按子域可再拆分")
    elif n_a > 20:
        s1 += 2
        notes.append(f"断言 {n_a} 条远超单 Packet 容量，强烈建议拆成多个 Packet（否则 AI 注意力被摊薄）")
    elif 0 < n_a < 5:
        s1 += max(0, 8 - (5 - n_a) * 2)
        notes.append(f"断言仅 {n_a} 条（建议 5–12 条 P0），主流程很可能没覆盖全")
    else:
        notes.append("第 2 段没有断言表：AI 无法判断什么算做完，必须先补 A-xx")
    if ui_only:
        notes.append(f"其中 {ui_only} 条是前端可见性断言：可被 Playwright 判定，但请确认每条都点名了具体元素（否则退化为形容词）")
    if ambiguous:
        notes.append(
            f"以下断言含「或」二选一表述，机器无法判定该走哪条（{len(ambiguous)} 条）："
            f"{', '.join(ambiguous[:6])}。拆成两条断言，或明确判定优先级"
        )
    if bad_then:
        notes.append(
            f"以下断言的 Then 不可机器判定（{len(bad_then)} 条）：{', '.join(bad_then[:8])}"
            f"{' …' if len(bad_then) > 8 else ''}。改写方向：落到状态码 / 返回值或 schema / 数值阈值 / 错误码"
        )
    score += s1
    detail["断言可判定性"] = round(s1, 1)

    # ---------- 2. 边界覆盖 (20)
    sec3, _ = section(text, 3)
    e_rows = table_rows(sec3, "E")
    n_e = len(e_rows)
    s2 = 0
    if n_a:
        if n_e >= n_a:
            s2 += 12
        else:
            s2 += max(0, 12 * n_e / n_a)
            notes.append(f"边界 E-xx 只有 {n_e} 条 < 断言 {n_a} 条：AI 的错误 80% 发生在边界，先补到 ≥ {n_a} 条")
    else:
        notes.append("无断言则无法评估边界完整性")
    covered = [k for k, p in EDGE_CLASSES.items() if re.search(p, sec3, re.I)]
    s2 += min(8, len(covered) * 1.4)
    missed = [k for k in EDGE_CLASSES if k not in covered]
    if missed:
        notes.append(f"边界场景缺少这几类：{'、'.join(missed)}（AI 会自行发明行为，属高危区）")
    score += s2
    detail["边界覆盖"] = round(s2, 1)

    # ---------- 3. 数据契约 (15)
    sec4, _ = section(text, 4)
    s3 = 0
    hit = []
    if sec4:
        # 枚举启发式：契约表里若成组出现 `0`/`1`、`M`/`C`/`F` 这类短值，视为已声明取值域
        short_vals = set(re.findall(r"`([A-Za-z0-9]{1,4})`", sec4))
        enum_by_sample = len(short_vals) >= 2
        for k, p in CONTRACT_CHECKS.items():
            if re.search(p, sec4, re.I) or (k == "枚举全量" and enum_by_sample):
                s3 += 2.5
                hit.append(k)
            else:
                notes.append(f"数据契约缺少「{k}」的显式声明——这是歧义高发点，AI 会按自己的理解补")
    else:
        notes.append("缺第 4 段数据契约：字段类型/可空/空值语义不定，实现必返工")
    score += s3
    detail["数据契约"] = round(s3, 1)

    # ---------- 4. Non-goals (10)
    sec7, _ = section(text, 7)
    nb = count_bullets(sec7)
    if nb >= 3:
        s4 = 10
    elif nb >= 1:
        s4 = 5
        notes.append(f"Non-goals 仅 {nb} 条，建议 ≥3 条。没写「不做什么」，AI 会替你决定做什么")
    else:
        s4 = 0
        notes.append("缺 Non-goals：这是 AI 越界改动的最主要来源，必填")
    score += s4
    detail["Non-goals"] = round(s4, 1)

    # ---------- 5. Golden Samples (10)
    sec8, _ = section(text, 8)
    pos = len(re.findall(r"\|\s*\*{0,2}正例", sec8))
    neg = len(re.findall(r"\|\s*\*{0,2}反例", sec8))
    s5 = 0
    if pos >= 3:
        s5 += 6
    else:
        s5 += pos * 2
        notes.append(f"正例 {pos} 条（建议 3 条）：正例不足时 AI 缺少「长什么样算对」的锚")
    if neg >= 1:
        s5 += 4
    else:
        notes.append("缺反例：反例专门约束「看起来合理但违反规格」的产出，是 AI 交付最典型的翻车点")
    score += s5
    detail["Golden Samples"] = round(s5, 1)

    # ---------- 6. 非功能约束 (10)
    sec5, _ = section(text, 5)
    s6 = 0
    for k, p in NFR_CHECKS.items():
        if re.search(p, sec5, re.I):
            s6 += 2.5
        else:
            notes.append(f"非功能约束缺「{k}」")
    score += s6
    detail["非功能约束"] = round(s6, 1)

    # ---------- 7. 元信息 (5)
    s7 = 0
    for k in ("id", "version", "risk_level", "channel"):
        if fm.get(k):
            s7 += 1
        else:
            notes.append(f"front-matter 缺 `{k}`")
    if fm.get("pm") or fm.get("business_signoff") or fm.get("arch_reviewer"):
        s7 += 1
    else:
        notes.append("未填任何签字人（pm / business_signoff / arch_reviewer）")
    score += s7
    detail["元信息"] = round(s7, 1)

    # ---------- 模糊词（不计分，单独列）
    vague = []
    for i, line in enumerate(text.splitlines(), 1):
        for w in HARD_BANNED + SOFT_VAGUE:
            if w in line:
                vague.append((i, w, line.strip()[:60]))
                break

    score = round(min(100, score), 1)
    if score >= 90:
        tier, verdict = "A · 可直达", "AI 可无人值守开工；预计 0 轮澄清"
    elif score >= 75:
        tier, verdict = "B · 可开工", "预计 ≤2 轮澄清；可进入实现"
    elif score >= 60:
        tier, verdict = "C · 勉强", "预计 1–2 次返工；建议先补红线项"
    else:
        tier, verdict = "D · 不可开工", "大量 STOP 与返工；不要交给 AI"

    return {
        "file": path, "name": name, "score": score, "tier": tier, "verdict": verdict,
        "detail": detail, "counts": {"断言": n_a, "边界": n_e, "then可判定": dec,
                                     "non_goals": nb, "正例": pos, "反例": neg},
        "notes": notes, "vague": vague, "front_matter": fm,
    }


# ---------------------------------------------------------------- 输出

BAR = "─" * 62


def render(r):
    if r.get("error"):
        print(f"[WARN] {r['file']}: {r['error']}")
        return
    print(BAR)
    print(f"  {r['name']}")
    if "TEMPLATE" in r["name"].upper():
        print("  ⚠ 这是模板文件，分数无参考价值（内容为占位示例）")
    print(f"  就绪度 {r['score']}/100   〔{r['tier']}〕{r['verdict']}")
    print(BAR)
    print("  分项： " + "  ".join(f"{k} {v}" for k, v in r["detail"].items()))
    c = r["counts"]
    print(f"  计数： 断言 {c['断言']} / 边界 {c['边界']} / Then 可判定 {c['then可判定']}"
          f" / Non-goals {c['non_goals']} / 正例 {c['正例']} 反例 {c['反例']}")
    if r["notes"]:
        print("\n  ▸ 缺口与改写建议（按影响排序）")
        for i, n in enumerate(r["notes"], 1):
            print(f"    {i}. {n}")
    if r["vague"]:
        print(f"\n  ▸ 模糊表述 {len(r['vague'])} 处（软风险：不阻断，但会放大返工）")
        for line, w, ctx in r["vague"][:6]:
            print(f"    L{line} 「{w}」 {ctx}")
        if len(r["vague"]) > 6:
            print(f"    … 另有 {len(r['vague'])-6} 处，建议整体扫一遍")
    print()


def render_dir(results):
    ok = [r for r in results if not r.get("error")]
    if not ok:
        print("未发现 SPEC 文件")
        return
    print(BAR)
    print(f"  存量质量分布（{len(ok)} 份）")
    print(BAR)
    buckets = {"A ≥90": 0, "B 75-89": 0, "C 60-74": 0, "D <60": 0}
    for r in ok:
        s = r["score"]
        k = "A ≥90" if s >= 90 else "B 75-89" if s >= 75 else "C 60-74" if s >= 60 else "D <60"
        buckets[k] += 1
    for k, v in buckets.items():
        print(f"  {k:<10} {'█'*v}{'' if v else '·'}  {v}")
    avg = sum(r["score"] for r in ok) / len(ok)
    print(f"\n  平均分 {avg:.1f}   最低 {min(r['score'] for r in ok)}"
          f"   最高 {max(r['score'] for r in ok)}")
    print("\n  明细：")
    for r in sorted(ok, key=lambda x: -x["score"]):
        print(f"    {r['score']:>5.1f}  {r['tier']:<10} {r['name']}")
    print("\n  下一步：对分数最低的 1–2 份跑单文件体检，拿具体缺口清单。")
    print()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    if not args:
        print("用法: python scripts/spec_audit.py <SPEC文件|目录> [--json]")
        print("[辅助层] 本工具不参与门禁，仅提供诊断。")
        return 0

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, "SPEC-*.md")))
        files = [f for f in files if "TEMPLATE" not in os.path.basename(f)]
        results = [audit(f) for f in files]
        if as_json:
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            render_dir(results)
    elif os.path.isfile(target):
        r = audit(target)
        if as_json:
            print(json.dumps(r, ensure_ascii=False, indent=2))
        else:
            render(r)
    else:
        print(f"[WARN] 路径不存在: {target}")
        return 0
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        main()
    except Exception as e:                       # 辅助层永不阻断
        print(f"[WARN] 体检异常（不影响交付）: {e}")
    sys.exit(0)
