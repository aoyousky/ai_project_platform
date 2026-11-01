#!/usr/bin/env bash
# PreToolUse(Bash) hook：git commit / git push 前强制执行交付门禁。
#
# 退出码约定（Claude Code hook 协议）：
#   0 = 放行；2 = 拦截，stderr 回传给模型。
#
# 只拦 commit/push，其余命令直接放行，避免每次 Bash 调用都跑门禁。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT="$(cat)"

extract_command() {
  if command -v python >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python -c 'import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("tool_input", {}).get("command", ""))
except Exception:
    pass'
  else
    # 无 python 时退化为宽松提取：宁可多跑门禁，不可漏拦。
    printf '%s' "$INPUT"
  fi
}

CMD="$(extract_command)"

# 匹配 `git commit` / `git push`，允许中间夹全局参数（如 git -C repo commit）。
# 宁可误报（多跑一次门禁），不可漏报。
if ! printf '%s' "$CMD" | grep -qE '(^|[^[:alnum:]_-])git([[:space:]]+[^;&|]*)?[[:space:]]+(commit|push)([[:space:]]|$)'; then
  exit 0
fi

echo "== PreToolUse: 检测到 git commit/push，执行 scripts/ci-gate.sh ==" >&2
if bash "$ROOT/scripts/ci-gate.sh" >&2; then
  exit 0
fi

echo "" >&2
echo "⛔ 已拦截：ci-gate 未通过，本次提交/推送被拒绝。" >&2
echo "按上面的 FAIL 项修复后重试；不得绕过门禁（--no-verify / 删除 trace / 伪造 test_evidence）。" >&2
exit 2
