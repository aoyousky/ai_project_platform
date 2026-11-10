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

    # 5666 预览与 SPEC-005 临时令牌的清理（仅在本次门禁自己启动/创建时）。
    STARTED_PREVIEW=0
    TOKENS_TMP=""
    TOKENS_CREATED=0
    cleanup_eval() {
      if [ "$STARTED_PREVIEW" = "1" ] && command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command \
          "Get-NetTCPConnection -LocalPort 5666 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" \
          >/dev/null 2>&1 || true
      fi
      if [ "$TOKENS_CREATED" = "1" ] && [ -n "$TOKENS_TMP" ]; then
        rm -f "$TOKENS_TMP"
      fi
    }
    trap cleanup_eval EXIT

    stop_preview() {
      command -v powershell.exe >/dev/null 2>&1 || return 0
      powershell.exe -NoProfile -Command \
        "Get-NetTCPConnection -LocalPort 5666 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" \
        >/dev/null 2>&1 || true
    }

    start_preview() {
      ( cd "$ROOT/frontend" && pnpm --filter @vben/web-antdv-next preview --port 5666 \
          > "$ROOT/scripts/evals/.tmp-gate-preview.log" 2>&1 ) &
      STARTED_PREVIEW=1
      for _ in $(seq 1 90); do
        if curl -sf -o /dev/null http://localhost:5666/; then
          return 0
        fi
        sleep 1
      done
      return 1
    }

    # 夹具可重复执行（seed_*.sh 都是先清后插），门禁自动预置以保证可重复运行；
    # 无 docker 的环境跳过（EVAL_SKIP_SEED=1 亦可显式跳过）。
    # SPEC-005 的夹具是确定值（登录日志/在线数/超期率），必须等其余需求
    # 评测结束后再单独重置，否则会被其他 E2E 的真实登录污染。
    if [ "${EVAL_SKIP_SEED:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
      for seed in "$ROOT"/scripts/evals/seed_*.sh; do
        [ -f "$seed" ] || continue
        [ "$(basename "$seed")" = "seed_spec005.sh" ] && continue
        if bash "$seed" >/dev/null 2>&1; then
          echo "已预置夹具: $(basename "$seed")"
        else
          echo "WARN: $(basename "$seed") 预置失败，用例可能因夹具缺失而失败"
        fi
      done
      # seed_spec004.sh 会 docker restart 后端以刷新 OSS endpoint 缓存（改库不刷新
      # Redis 缓存），后端冷启动约 112s。历史失败均发生在重启未完成的窗口内：预览
      # 代理 socket hang up → /auth/code 拿不到 uuid、首个需求 A-01/A-03 抖动。
      # 评测前必须等到后端真正就绪。
      backend_ready=0
      for _ in $(seq 1 120); do
        if curl -sf http://localhost:8080/auth/tenant/list >/dev/null 2>&1; then
          backend_ready=1
          break
        fi
        sleep 2
      done
      if [ "$backend_ready" != "1" ]; then
        echo "FAIL: 后端在 seed 重启后 240s 内未就绪"; FAIL=1
      else
        echo "后端已就绪（seed 重启后）"
      fi
    fi

    # E2E 与 SPEC-005 取令牌都需要 5666 的生产预览。
    # 不复用已运行进程：Vite 代理到后端的 keep-alive 连接会在后端重启/空闲超时后
    # 变成 `socket hang up`，表现为 `/auth/code` 偶发不返回 uuid（预览日志可证）。
    # 门禁每次重建预览，确保代理连接是本次初始化的。
    if curl -sf -o /dev/null http://localhost:5666/; then
      echo "重建 5666 预览（清理长期驻留的代理连接）"
      stop_preview
    fi
    if ! start_preview; then
      echo "FAIL: 5666 预览未启动（见 scripts/evals/.tmp-gate-preview.log）"; FAIL=1
    fi

    REQ6="REQ-20261108-006"
    # REQ-001 的 A-01/A-03/A-07 依赖登录页与浏览器冷启动；门禁刚跑完 seed、
    # 后端/预览缓存都冷，实测首轮 15s 取码窗口与 5s 登录阈值会因宿主争用抖动失败
    # （单跑 REQ-001 稳定通过）。故非 006 需求里让 REQ-001 最后执行，跑在预热环境中。
    REQ1="REQ-20261101-001"
    if [ "$FAIL" -eq 0 ]; then
      for req_dir in "$ROOT"/specs/evals/REQ-*; do
        [ -d "$req_dir" ] || continue
        req=$(basename "$req_dir")
        [ "$req" = "$REQ6" ] && continue
        [ "$req" = "$REQ1" ] && continue
        if python "$FIXTURE" --req "$req" --report "$ROOT/specs/evals/reports"; then
          echo "PASS: $req"
        else
          echo "FAIL: $req 评测未通过"; FAIL=1
        fi
      done
      if [ "$FAIL" -eq 0 ]; then
        if python "$FIXTURE" --req "$REQ1" --report "$ROOT/specs/evals/reports"; then
          echo "PASS: $REQ1"
        else
          echo "FAIL: $REQ1 评测未通过"; FAIL=1
        fi
      fi
    fi

    # REQ-006 固定在最后：base（重建夹具）→ 生成令牌（不打印）→ volatile
    # （重置登录日志与在线键，保留令牌）→ 单独执行。
    if [ "$FAIL" -eq 0 ]; then
      # REQ-006 的 A-09 依赖流程 `fast` 的 SLA=1h（5.4h 办结记 1 条超时 → 8%），
      # 该参数只存在于评测专用 compose 覆盖中；必须用两份 compose 重启后端。
      if [ "${EVAL_SKIP_SEED:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
        # 后端 JWT 密钥无默认值（红线 R3）；每次门禁重新生成，不打印。
        if [ -z "${SA_TOKEN_JWT_SECRET:-}" ]; then
          SA_TOKEN_JWT_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
          export SA_TOKEN_JWT_SECRET
        fi
        if docker compose \
             -f "$ROOT/deploy/docker-compose.yml" \
             -f "$ROOT/scripts/evals/docker-compose.spec005.yml" \
             up -d --build backend >/dev/null 2>&1; then
          echo "已重启后端（SPEC-005 SLA 覆盖）"
        else
          echo "FAIL: 后端未能在 SPEC-005 覆盖下启动"; FAIL=1
        fi
        if [ "$FAIL" -eq 0 ]; then
          backend_ready=0
          for _ in $(seq 1 90); do
            if curl -sf http://localhost:8080/auth/tenant/list >/dev/null 2>&1; then
              backend_ready=1
              break
            fi
            sleep 2
          done
          [ "$backend_ready" = "1" ] || { echo "FAIL: 后端 180s 内未就绪"; FAIL=1; }
          # 后端重启后预览代理连接同样失效（socket hang up → /auth/code 无 uuid、
          # /auth/login 无响应）；006 的取令牌与 E2E 依赖预览，必须一并重建。
          if [ "$FAIL" -eq 0 ]; then
            stop_preview
            if start_preview; then
              echo "已重建 5666 预览（后端重启后）"
            else
              echo "FAIL: 5666 预览重建失败（见 scripts/evals/.tmp-gate-preview.log）"; FAIL=1
            fi
          fi
        fi
      fi
      if [ -n "${EVAL_SPEC005_TOKENS_FILE:-}" ]; then
        TOKENS_TMP="$EVAL_SPEC005_TOKENS_FILE"
      else
        TOKENS_TMP="$ROOT/scripts/evals/.tmp-gate-spec005-tokens.json"
        TOKENS_CREATED=1
      fi
      if [ "${EVAL_SKIP_SEED:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
        if bash "$ROOT/scripts/evals/seed_spec005.sh" base >/dev/null 2>&1; then
          echo "已预置夹具: seed_spec005.sh base"
        else
          echo "FAIL: seed_spec005.sh base 失败"; FAIL=1
        fi
      fi
      if [ "$FAIL" -eq 0 ]; then
        # 后端刚重启时首次登录可能超过 45s（JIT/数据源预热），重试 3 次。
        TOKENS_OK=0
        for attempt in 1 2 3; do
          if node "$ROOT/scripts/evals/spec005_tokens.mjs" "$TOKENS_TMP"; then
            TOKENS_OK=1
            break
          fi
          echo "WARN: SPEC-005 令牌生成失败（第 ${attempt} 次），30s 后重试"
          sleep 30
        done
        if [ "$TOKENS_OK" = "1" ]; then
          if EVAL_SPEC005_TOKENS_FILE="$TOKENS_TMP" bash "$ROOT/scripts/evals/seed_spec005.sh" volatile >/dev/null 2>&1; then
            echo "已预置夹具: seed_spec005.sh volatile"
          else
            echo "FAIL: seed_spec005.sh volatile 失败"; FAIL=1
          fi
        else
          echo "FAIL: SPEC-005 令牌生成失败（已重试 3 次）"; FAIL=1
        fi
      fi
      if [ "$FAIL" -eq 0 ]; then
        # 同时把 3 个令牌导出为 EVAL_SPEC005_*_TOKEN：只给 TOKENS_FILE 时，
        # 探针会改走真实登录补令牌，向 sys_logininfor 多写 1–3 行，
        # A-01/A-02 的确定值（213）会因此偏大。取值不打印。
        TOKENS_WIN="$(cygpath -w "$TOKENS_TMP" 2>/dev/null || printf '%s' "$TOKENS_TMP")"
        token_of() {
          python -c \
            'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))[sys.argv[2]])' \
            "$TOKENS_WIN" "$1"
        }
        if EVAL_SPEC005_ADMIN_TOKEN="$(token_of spec005Admin)" \
           EVAL_SPEC005_LIMITED_TOKEN="$(token_of spec005Limited)" \
           EVAL_SPEC005_TENANT_B_TOKEN="$(token_of spec005TenantB)" \
           EVAL_SPEC005_TOKENS_FILE="$TOKENS_WIN" \
           python "$FIXTURE" --req "$REQ6" --report "$ROOT/specs/evals/reports"; then
          echo "PASS: $REQ6"
        else
          echo "FAIL: $REQ6 评测未通过"; FAIL=1
        fi
      fi
    fi

    if [ "$FAIL" -eq 0 ]; then
      echo "PASS: 评测集（全部需求目录，等价夹具）"
    else
      echo "FAIL: 评测集未通过（请检查上述失败用例并确认夹具已 seed）"
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
