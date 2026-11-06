#!/usr/bin/env bash
# CI 门禁：规格完整 + 评测执行 + 溯源齐备。供流水线或 pre-commit 调用，非零退出即拦截。
# 用法: bash scripts/ci-gate.sh [specs目录，默认 specs]
# 说明: 评测集（门禁 5）始终以仓库根目录为准，忽略上面的 specs 目录参数。
set -euo pipefail

SPEC_DIR="${1:-specs}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0
shopt -s nullglob

echo "== 门禁 1/5：禁词扫描 =="
if grep -rnE "另行确认|后续讨论|适当|大概|尽快|视情况" "$SPEC_DIR" --include="SPEC-*.md"; then
  echo "FAIL: Spec 存在禁词（见上）"; FAIL=1
else
  echo "PASS"
fi

SPEC_FILES=("$SPEC_DIR"/SPEC-*.md)

echo "== 门禁 2/5：断言条数校验 =="
if [ "${#SPEC_FILES[@]}" -eq 0 ]; then
  echo "未发现 SPEC 文件，跳过"
else
  for f in "${SPEC_FILES[@]}"; do
    case "$f" in *TEMPLATE*) echo "SKIP(模板): $f"; continue;; esac
    a=$(grep -cE "^\| A-[0-9]+" "$f" || true)
    e=$(grep -cE "^\| E-[0-9]+" "$f" || true)
    if [ "$e" -lt "$a" ]; then
      echo "FAIL: $f 异常条数($e) < 断言条数($a)"; FAIL=1
    else
      echo "PASS: $f 断言=$a 异常=$e"
    fi
  done
fi

echo "== 门禁 3/5：溯源文件校验 =="
if [ "${#SPEC_FILES[@]}" -eq 0 ]; then
  echo "未发现 SPEC 文件，跳过"
else
  for f in "${SPEC_FILES[@]}"; do
    case "$f" in *TEMPLATE*) echo "SKIP(模板): $f"; continue;; esac
    id=$(awk '/^---$/{n++} n==1 && /^id:/{print $2; exit}' "${f}")
    [ -n "$id" ] || { echo "FAIL: $f 缺少 front-matter id"; FAIL=1; continue; }
    t="trace/$id.yaml"
    if [ ! -f "$t" ]; then
      echo "FAIL: 缺少溯源文件 $t"; FAIL=1; continue
    fi
    if ! grep -qE "^(spec_hash|assertion_map):" "$t" || grep -q "UNMAPPED" "$t"; then
      echo "FAIL: $t 缺 spec_hash/assertion_map 或存在 UNMAPPED 断言"; FAIL=1; continue
    fi
    # 开发期豁免（CLAR-003）：尚未编写评测集时，允许提交实现进度，
    # 但 trace 不得宣称完成——必须 test_evidence 为空且 review_verdict 为 pending。
    # 一旦 specs/evals/<id>/cases.yaml 出现，立即回到严格校验（必须全绿）。
    cases="$ROOT/specs/evals/$id/cases.yaml"
    if [ ! -f "$cases" ]; then
      # 架构追认（2026-11-06，张建魁；CLAR-003 条件 2）：以 SPEC front-matter 的
      # target_window 结束日为评测集建立期限，逾期不再放行。
      deadline=$(sed -n 's/^target_window:.*~[[:space:]]*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p' "${f}" | head -1)
      today=$(date +%F)
      if [ -z "$deadline" ]; then
        echo "FAIL: $f 缺 target_window 结束日，无法界定评测集期限（CLAR-003 追认条件 2）"; FAIL=1; continue
      fi
      if [[ "$today" > "$deadline" ]]; then
        echo "FAIL: $t 逾期未建评测集（期限 $deadline，今日 $today，CLAR-003 追认条件 2）"; FAIL=1; continue
      fi
      if grep -qE "^test_evidence:[[:space:]]*(null)?[[:space:]]*$" "$t" \
        && grep -qE "^review_verdict:[[:space:]]*[\"']?pending" "$t"; then
        echo "PASS(开发期): $t 无评测集，trace=pending；评测集须在 $deadline 前建立"
        continue
      fi
      echo "FAIL: $t 无评测集却声称完成（要求 test_evidence 为空且 review_verdict: pending）"; FAIL=1; continue
    fi
    passed=$(awk '/^test_evidence:/{f=1} f && /^  passed:/{print $2; exit}' "$t")
    total=$(awk '/^test_evidence:/{f=1} f && /^  total:/{print $2; exit}' "$t")
    if [ -z "${passed:-}" ] || [ -z "${total:-}" ] || [ "$total" -le 0 ] || [ "$passed" -ne "$total" ]; then
      echo "FAIL: $t 的 test_evidence 缺失或未全绿（passed=$passed total=$total）"; FAIL=1; continue
    fi
    echo "PASS: $t"
  done
fi

echo "== 门禁 4/5：Spec Kit 特性未被断言化拦截 =="
for d in "$SPEC_DIR"/*/; do
  s="$d/spec.md"
  [ -f "$s" ] || continue
  dir="${d%/}"
  if grep -rqs "speckit_feature: *$dir" "$SPEC_DIR"/SPEC-*.md 2>/dev/null; then
    echo "PASS: $dir 已有对应 Spec Packet"
  else
    echo "FAIL: $dir 有 spec.md 但无对应 Spec Packet（请先跑 /spec-packet）"; FAIL=1
  fi
done

echo "== 门禁 5/5：评测集 =="
if command -v python >/dev/null 2>&1; then
  # 等价夹具优先（2026-11-04 裁决，SPEC-002 v1.2）：
  # specs/evals/run.py 不支持认证头与 ${EVAL_*} 占位替换，认证用例直接执行会得到 401。
  # 存在 scripts/evals/run_eval.py 时改用它执行 specs/evals/ 下全部需求目录。
  FIXTURE="$ROOT/scripts/evals/run_eval.py"
  if [ -f "$FIXTURE" ]; then
    echo "使用等价夹具（认证注入）：scripts/evals/run_eval.py"
    # 夹具可重复执行（seed_*.sh 都是先清后插），门禁自动预置以保证可重复运行；
    # 无 docker 的环境跳过（EVAL_SKIP_SEED=1 亦可显式跳过）。
    if [ "${EVAL_SKIP_SEED:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
      for seed in "$ROOT"/scripts/evals/seed_*.sh; do
        [ -f "$seed" ] || continue
        if bash "$seed" >/dev/null 2>&1; then
          echo "已预置夹具: $(basename "$seed")"
        else
          echo "WARN: $(basename "$seed") 预置失败，用例可能因夹具缺失而失败"
        fi
      done
    fi
    if python "$FIXTURE" --report "$ROOT/specs/evals/reports"; then
      echo "PASS: 评测集（全部需求目录，等价夹具）"
    else
      echo "FAIL: 评测集未通过（请检查上述失败用例并确认夹具已 seed）"; FAIL=1
    fi
  else
    if python "$ROOT/specs/evals/run.py" --ci --root "$ROOT"; then
      echo "PASS: 评测集"
    else
      echo "FAIL: 评测集未通过"; FAIL=1
    fi
  fi
else
  echo "FAIL: 未找到 python，无法执行评测集"; FAIL=1
fi

[ "$FAIL" -eq 0 ] && echo "== 门禁全部通过 ==" || echo "== 门禁未通过，禁止合并 =="
exit $FAIL
