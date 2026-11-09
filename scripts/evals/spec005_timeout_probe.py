#!/usr/bin/env python3
"""SPEC-005 A-12：真实数据库超时探针。

对 MySQL 的 ``sys_logininfor`` 加写锁，使 ``GET /dashboard/home`` 里的登录趋势
查询超过 3 秒；断言接口仍返回 HTTP 200 + ``code=200``，``loginTrend`` 与
``metrics.todayLoginTotal`` 降级为 ``null`` 且 warnings 带 ``TIMEOUT``，
其余字段（``userTotal``、``notices``）保持可用。

成功时 stdout 保持为空（``scripts/evals/run_eval.py`` 的 shell 用例约定），
失败时把原因写 stderr 并退出 1。只允许指向本地 Docker 测试栈。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("EVAL_BASE_URL", "http://localhost:8080").rstrip("/")
MYSQL_CONTAINER = os.environ.get("EVAL_MYSQL_CONTAINER", "awp-mysql")
MYSQL_DATABASE = os.environ.get("EVAL_MYSQL_DATABASE", "aoyou")
MYSQL_ROOT_PASSWORD = os.environ.get("EVAL_MYSQL_ROOT_PASSWORD", "root")
CLIENT_ID = os.environ.get(
    "EVAL_CLIENT_ID", "e5cd7e4891bf95d1d19206ce24a7b32e"
)
LOCK_SECONDS = 12
HTTP_TIMEOUT = 30
ATTEMPTS = 2


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def admin_token() -> str:
    direct = os.environ.get("EVAL_SPEC005_ADMIN_TOKEN", "").strip()
    if direct:
        return direct
    tokens_file = os.environ.get("EVAL_SPEC005_TOKENS_FILE", "").strip()
    if not tokens_file or not os.path.isfile(tokens_file):
        fail(
            "缺少 EVAL_SPEC005_ADMIN_TOKEN 或 EVAL_SPEC005_TOKENS_FILE（需指向已生成的令牌 JSON）"
        )
    try:
        tokens = json.loads(open(tokens_file, encoding="utf-8").read())
    except (OSError, json.JSONDecodeError) as exc:  # noqa: BLE001 - 明确报错
        fail(f"读取令牌文件失败: {exc}")
    token = str(tokens.get("spec005Admin") or "").strip()
    if not token:
        fail("令牌文件缺少 spec005Admin")
    return token


def start_table_lock() -> subprocess.Popen:
    """持有 sys_logininfor 写锁 LOCK_SECONDS 秒；mysql 客户端退出即释放。"""
    sql = (
        "LOCK TABLES sys_logininfor WRITE;"
        f"SELECT SLEEP({LOCK_SECONDS});"
        "UNLOCK TABLES;"
    )
    return subprocess.Popen(
        [
            "docker",
            "exec",
            "-i",
            "-e",
            f"MYSQL_PWD={MYSQL_ROOT_PASSWORD}",
            MYSQL_CONTAINER,
            "mysql",
            "--default-character-set=utf8mb4",
            "-uroot",
            "-N",
            "-B",
            MYSQL_DATABASE,
            "-e",
            sql,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def call_home(token: str) -> dict:
    request = urllib.request.Request(
        f"{BASE_URL}/dashboard/home",
        headers={
            "Accept-Language": "zh-CN",
            "Authorization": f"Bearer {token}",
            "clientid": CLIENT_ID,
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
            status = response.status
            raw = response.read()
    except urllib.error.HTTPError as exc:
        fail(f"GET /dashboard/home 返回 HTTP {exc.code}")
    except urllib.error.URLError as exc:
        fail(f"GET /dashboard/home 请求失败: {exc.reason}")
    if status != 200:
        fail(f"GET /dashboard/home 期望 HTTP 200，实际 {status}")
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"响应不是 JSON: {exc}")


def verify(body: dict) -> list[str]:
    errors: list[str] = []
    if body.get("code") != 200:
        errors.append(f"code 期望 200，实际 {body.get('code')!r}")
    data = body.get("data") or {}
    metrics = data.get("metrics") or {}

    if data.get("loginTrend") is not None:
        errors.append("loginTrend 期望 null（3 秒超时降级），实际非 null")
    if metrics.get("todayLoginTotal") is not None:
        errors.append(
            f"metrics.todayLoginTotal 期望 null，实际 {metrics.get('todayLoginTotal')!r}"
        )

    warnings = data.get("warnings") or []
    expected = {
        ("metrics.todayLoginTotal", "TIMEOUT"),
        ("loginTrend", "TIMEOUT"),
    }
    actual = {
        (str(item.get("field")), str(item.get("code")))
        for item in warnings
        if isinstance(item, dict)
    }
    for pair in sorted(expected):
        if pair not in actual:
            errors.append(f"warnings 缺少 field={pair[0]},code={pair[1]}")

    if metrics.get("userTotal") != 1286:
        errors.append(
            f"metrics.userTotal 期望 1286（其余字段应保留），实际 {metrics.get('userTotal')!r}"
        )
    notices = data.get("notices")
    if not isinstance(notices, list) or len(notices) != 3:
        errors.append(
            f"notices 期望 3 条（其余字段应保留），实际 {notices!r}"
        )
    return errors


def main() -> int:
    token = admin_token()
    last_errors = ["探针未执行"]
    for attempt in range(ATTEMPTS):
        lock = start_table_lock()
        try:
            # 等 docker exec 完成连接并拿到表锁，再发起聚合查询。
            time.sleep(1.0 + attempt * 0.5)
            body = call_home(token)
            last_errors = verify(body)
        finally:
            try:
                lock.wait(timeout=LOCK_SECONDS + 20)
            except subprocess.TimeoutExpired:
                lock.terminate()
                lock.wait(timeout=10)
        if not last_errors:
            return 0
    fail("A-12 超时降级断言失败: " + "; ".join(last_errors))
    return 1


if __name__ == "__main__":
    sys.exit(main())
