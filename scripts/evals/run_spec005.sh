#!/usr/bin/env bash
# REQ-20261108-006（SPEC-005 v1.4）评测编排（仅本地 Docker 测试栈）。
#
# 固定顺序（原因见 seed_spec005.sh 文件头）：
#   后端打包 → 启动 MySQL/Redis/后端 → 前端生产构建 + 5666 预览
#   → seed base → 生成 3 个令牌 → seed volatile（重置日志/在线键）
#   → 导出 EVAL_SPEC005_* → run_eval.py
#
# 令牌只在内存与 0600 临时文件中流转，不打印；脚本退出时删除令牌文件。
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"

PYTHON_BIN="${EVAL_PYTHON:-python}"
# 8GB 宿主机默认限制 Maven 堆：不限制时 C2 编译器线程会耗尽原生内存（hs_err）。
export MAVEN_OPTS="${MAVEN_OPTS:--Xmx768m -XX:MaxMetaspaceSize=512m -XX:ReservedCodeCacheSize=128m -XX:ActiveProcessorCount=4}"
TOKENS_FILE="${EVAL_SPEC005_TOKENS_FILE:-$ROOT/scripts/evals/.tmp-spec005-tokens.json}"
PREVIEW_LOG="$ROOT/scripts/evals/.tmp-spec005-preview.log"
COMPOSE=(docker compose
  -f "$ROOT/deploy/docker-compose.yml"
  -f "$ROOT/scripts/evals/docker-compose.spec005.yml")

kill_port() {
  local port="$1"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command \
      "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" \
      >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${port}" | xargs -r kill 2>/dev/null || true
  fi
}

PREVIEW_PID=""
cleanup() {
  if [[ -n "$PREVIEW_PID" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
  fi
  kill_port 5666
  rm -f "$TOKENS_FILE"
}
trap cleanup EXIT

token_of() {
  "$PYTHON_BIN" -c \
    'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))[sys.argv[2]])' \
    "$TOKENS_FILE" "$1"
}

# 后端 JWT 密钥无默认值（缺失即启动失败）。每次运行重新生成，令牌在后端之后签发。
if [[ -z "${SA_TOKEN_JWT_SECRET:-}" ]]; then
  SA_TOKEN_JWT_SECRET=$("$PYTHON_BIN" -c 'import secrets; print(secrets.token_hex(32))')
  export SA_TOKEN_JWT_SECRET
fi

echo "== 1/9 后端打包 =="
mvn -f platform/pom.xml -pl aoyou-admin -am package -DskipTests -q
mkdir -p deploy/build
cp platform/aoyou-admin/target/aoyou-admin.jar deploy/build/app.jar

echo "== 2/9 启动测试栈（含 SLA 覆盖 fast=1h） =="
"${COMPOSE[@]}" up -d --build mysql redis db-init backend

echo "== 3/9 前端生产构建 =="
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  (cd "$ROOT/frontend" && pnpm install --frozen-lockfile)
fi
(cd "$ROOT/frontend" && pnpm -F @vben/web-antdv-next build)

echo "== 4/9 重启 5666 预览（本 worktree 构建产物） =="
kill_port 5666
(
  cd "$ROOT/frontend"
  pnpm --filter @vben/web-antdv-next preview --port 5666
) >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!
preview_ready=0
for _ in $(seq 1 60); do
  if curl -sf http://localhost:5666/ >/dev/null 2>&1; then
    preview_ready=1
    break
  fi
  sleep 2
done
if [[ "$preview_ready" -ne 1 ]]; then
  echo "FAIL: 5666 预览未就绪，日志：" >&2
  tail -n 80 "$PREVIEW_LOG" >&2 || true
  exit 1
fi

echo "== 5/9 等待后端就绪 =="
backend_ready=0
for _ in $(seq 1 90); do
  if curl -sf http://localhost:8080/auth/tenant/list >/dev/null 2>&1; then
    backend_ready=1
    break
  fi
  sleep 2
done
if [[ "$backend_ready" -ne 1 ]]; then
  echo "FAIL: 后端未在 180s 内就绪" >&2
  docker logs --tail 100 awp-backend >&2 || true
  exit 1
fi

echo "== 6/9 写入基础夹具 =="
bash scripts/evals/seed_spec005.sh base

echo "== 7/9 生成 3 个夹具令牌（不打印） =="
node scripts/evals/spec005_tokens.mjs "$TOKENS_FILE"

echo "== 8/9 重置易变夹具（保留令牌对应在线会话） =="
EVAL_SPEC005_TOKENS_FILE="$TOKENS_FILE" bash scripts/evals/seed_spec005.sh volatile

echo "== 9/9 执行评测集 =="
export EVAL_SPEC005_TOKENS_FILE="$TOKENS_FILE"
export EVAL_SPEC005_ADMIN_TOKEN
EVAL_SPEC005_ADMIN_TOKEN="$(token_of spec005Admin)"
export EVAL_SPEC005_LIMITED_TOKEN
EVAL_SPEC005_LIMITED_TOKEN="$(token_of spec005Limited)"
export EVAL_SPEC005_TENANT_B_TOKEN
EVAL_SPEC005_TENANT_B_TOKEN="$(token_of spec005TenantB)"
export EVAL_FRONTEND_URL="${EVAL_FRONTEND_URL:-http://localhost:5666}"
export E2E_BASE_URL="${E2E_BASE_URL:-$EVAL_FRONTEND_URL}"
export E2E_REUSE_SERVER=1

"$PYTHON_BIN" scripts/evals/run_eval.py \
  --req REQ-20261108-006 \
  --report specs/evals/reports
