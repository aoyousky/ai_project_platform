#!/usr/bin/env python3
"""SPEC-005 在线用户夹具：写入/清理 Redisson 的 online_tokens 键。

背景：`GET /dashboard/home` 的 `onlineTotal` 统计 Redis `online_tokens:*` 中
`UserOnlineDTO.userName` 去重后、属于当前租户的人数。评测需要确定值 48：

- 3 个真实登录令牌（spec005_admin_a / spec005_limited / spec005_admin_b）；
- 46 条合成在线会话（spec005_online_1..46）。

真实令牌不能删除（删除后 HTTP 探针 401），因此 volatile 阶段只保留三个真实
令牌键，清理其余键后再写 46 条合成记录；租户 A 去重后恰好 48（B 的令牌属于
另一租户，不计入 A）。

此外，`--flush-all` 还必须清理 Sa-Token 的会话键（`token-name: Authorization`
→ Redis 前缀 `Authorization:login:*`）。每次评测都重新生成 `SA_TOKEN_JWT_SECRET`，
而共用的 `awp-redis` 容器会保留上一轮的会话；同一账号累计超过
`max-login-count` 后，Sa-Token 的 `logoutByMaxLoginCount` 会解析旧 JWT 做踢人，
旧签名与新密钥不符即抛 `SaJwtException`，导致新登录失败。该清理只在 token
生成前的 base 阶段执行，不影响本轮刚签发的令牌。

用法（由 seed_spec005.sh 调用）：
  python spec005_redis_seed.py --flush-all
  python spec005_redis_seed.py --tokens-file <json> --synthetic 46
"""
import argparse
import json
import os
import subprocess
import sys

CONTAINER = os.environ.get("EVAL_REDIS_CONTAINER", "awp-redis")
PASSWORD = os.environ.get("EVAL_REDIS_PASSWORD", "aoyou123")
PREFIX = "online_tokens:"
# Sa-Token token-name=Authorization，会话键形如 Authorization:login:token:<jwt>。
SATOKEN_PREFIXES = ("Authorization:login:",)
DTO_CLASS = "com.aoyou.common.core.domain.dto.UserOnlineDTO"


def redis_cli(*args: str) -> str:
    """调用容器内 redis-cli；返回值按 --raw 输出。"""
    command = [
        "docker",
        "exec",
        CONTAINER,
        "redis-cli",
        "--no-auth-warning",
        "-a",
        PASSWORD,
        "--raw",
        *args,
    ]
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "redis-cli 执行失败")
    return completed.stdout


def scan_keys(match: str) -> list[str]:
    keys: list[str] = []
    cursor = "0"
    while True:
        output = redis_cli("SCAN", cursor, "MATCH", match, "COUNT", "1000")
        lines = [line for line in output.splitlines() if line.strip()]
        if not lines:
            return keys
        cursor = lines[0]
        keys.extend(lines[1:])
        if cursor == "0":
            return keys


def flush_all() -> None:
    patterns = [PREFIX + "*"] + [prefix + "*" for prefix in SATOKEN_PREFIXES]
    for pattern in patterns:
        for key in scan_keys(pattern):
            redis_cli("DEL", key)


def online_value(user_name: str) -> str:
    # Redisson CompositeCodec 用 Jackson 数组形式保存全类名 + 字段
    return json.dumps([DTO_CLASS, {"userName": user_name}], ensure_ascii=False)


def seed(tokens_file: str, synthetic: int) -> None:
    with open(tokens_file, encoding="utf-8") as handle:
        tokens = json.load(handle)
    keep = {PREFIX + token for token in tokens.values() if token}
    if len(keep) != len(tokens):
        raise RuntimeError("令牌文件存在空令牌")

    for key in scan_keys(PREFIX + "*"):
        if key not in keep:
            redis_cli("DEL", key)

    for index in range(1, synthetic + 1):
        user_name = f"spec005_online_{index}"
        redis_cli("SET", PREFIX + f"spec005-synthetic-{index}", online_value(user_name))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--flush-all", action="store_true")
    parser.add_argument("--tokens-file")
    parser.add_argument("--synthetic", type=int, default=46)
    args = parser.parse_args()

    try:
        if args.flush_all:
            flush_all()
        elif args.tokens_file:
            seed(args.tokens_file, args.synthetic)
        else:
            parser.error("需要 --flush-all 或 --tokens-file")
    except Exception as exc:  # noqa: BLE001 - CLI 失败需要非零退出
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
