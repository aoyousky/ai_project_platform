#!/usr/bin/env bash
# Spec 就绪度体检 —— 辅助层入口。与 ci-gate.sh 的根本区别：本脚本永远 exit 0。
# 用法: bash scripts/spec-audit.sh specs/SPEC-003-xxx.md
#       bash scripts/spec-audit.sh specs            # 存量质量分布
#
# 为什么强制 exit 0：
#   一旦本脚本能返回非零，就会有人把它挂进 CI 的必需检查里，
#   它立刻变成"第 6 道门禁"——而本体系的设计前提是：门禁只保留 5 道，
#   其余一切质量问题用"评分 + 缺口清单"解决，不用"阻断"解决。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-specs}"

if command -v python >/dev/null 2>&1; then
  python "$ROOT/scripts/spec_audit.py" "$TARGET" "${@:2}" || true
elif command -v python3 >/dev/null 2>&1; then
  python3 "$ROOT/scripts/spec_audit.py" "$TARGET" "${@:2}" || true
else
  echo "[WARN] 未找到 python，跳过体检。这不影响交付与门禁。"
fi

echo "[辅助层] 本报告仅作诊断参考，不参与合并判定；不通过也请照常交付。"
exit 0
