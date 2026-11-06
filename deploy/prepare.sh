#!/usr/bin/env bash
# 生成本地 Docker 部署所需的构建产物：deploy/build/app.jar 与 deploy/build/dist/
#
# 只产出到 deploy/build/（已被 .gitignore 忽略），不改动 platform/ 或 frontend/。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/deploy/build"
mkdir -p "$BUILD"

echo "== 1/2 后端：打包 aoyou-admin =="
mvn -f "$ROOT/platform/pom.xml" -pl aoyou-admin -am package -DskipTests -q
cp "$ROOT/platform/aoyou-admin/target/aoyou-admin.jar" "$BUILD/app.jar"
echo "   -> $BUILD/app.jar ($(du -h "$BUILD/app.jar" | cut -f1))"

echo "== 2/2 前端：生产构建 =="
# frontend/ 是 pnpm workspace（Vben monorepo），锁文件只有 pnpm-lock.yaml。
(
  cd "$ROOT/frontend"
  corepack enable
  pnpm install --frozen-lockfile
  pnpm -F @vben/web-antdv-next build >/dev/null
)
rm -rf "$BUILD/dist"
cp -r "$ROOT/frontend/apps/web-antdv-next/dist" "$BUILD/dist"
echo "   -> $BUILD/dist ($(du -sh "$BUILD/dist" | cut -f1))"

echo "== 就绪，可以执行：docker compose -f deploy/docker-compose.yml up -d --build =="
