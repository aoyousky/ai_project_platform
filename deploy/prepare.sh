#!/usr/bin/env bash
# 生成本地 Docker 部署所需的构建产物：deploy/build/app.jar 与 deploy/build/dist/
#
# 只产出到 deploy/build/（已被 .gitignore 忽略），不改动 platform/ 或 frontend/。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/deploy/build"
mkdir -p "$BUILD"

echo "== 1/3 后端：打包 aoyou-admin =="
mvn -f "$ROOT/platform/pom.xml" -pl aoyou-admin -am package -DskipTests -q
cp "$ROOT/platform/aoyou-admin/target/aoyou-admin.jar" "$BUILD/app.jar"
echo "   -> $BUILD/app.jar ($(du -h "$BUILD/app.jar" | cut -f1))"

echo "== 2/3 控制台：打包 monitor-admin 与 snailjob-server =="
# SPEC-010：两个官方控制台由 compose 编排，不再手工 java -jar。
mvn -f "$ROOT/platform/pom.xml" \
  -pl aoyou-extend/aoyou-monitor-admin,aoyou-extend/aoyou-snailjob-server -am package -DskipTests -q
cp "$ROOT/platform/aoyou-extend/aoyou-monitor-admin/target/aoyou-monitor-admin.jar" \
   "$BUILD/monitor-admin.jar"
cp "$ROOT/platform/aoyou-extend/aoyou-snailjob-server/target/aoyou-snailjob-server.jar" \
   "$BUILD/snailjob-server.jar"
echo "   -> $BUILD/monitor-admin.jar ($(du -h "$BUILD/monitor-admin.jar" | cut -f1))"
echo "   -> $BUILD/snailjob-server.jar ($(du -h "$BUILD/snailjob-server.jar" | cut -f1))"

echo "== 3/3 前端：生产构建 =="
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
