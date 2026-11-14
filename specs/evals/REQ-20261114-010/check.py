#!/usr/bin/env python3
"""REQ-20261114-010（SPEC-010 控制台编排化）评测取证脚本。

每个子命令对应一条 P0 断言，只读取真实运行态（compose / HTTP / MySQL / git），
不 mock、不写业务数据。由 `scripts/evals/run_eval.py` 以 `shell:` 用例调用：

    python specs/evals/REQ-20261114-010/check.py a01

退出码 0 = 断言成立；非 0 = 失败并打印原因（门禁用例据此判 failed）。

凭据只从 `deploy/.env` 读取，不打印口令、不写入任何文件；`a06` 触发的任务来自
`deploy/sql/snailjob-seed.sql`（aoyou-demo-job）。
"""
from __future__ import annotations

import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEPLOY = ROOT / "deploy"
COMPOSE = ["docker", "compose", "-f", str(DEPLOY / "docker-compose.yml")]
FRONT = "http://localhost"
SBA = "http://localhost:9090"
SJ = "http://localhost:8800/snail-job"

LONG_RUNNING = {
    "backend",
    "frontend",
    "minio",
    "monitor-admin",
    "mysql",
    "redis",
    "snailjob-server",
}
SEED_JOB_ID = 2  # deploy/sql/snailjob-seed.sql 的 aoyou-demo-job


def env() -> dict[str, str]:
    values: dict[str, str] = {}
    path = DEPLOY / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def run(cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout,
    )


def http_code(url: str, auth: str | None = None, timeout: float = 5,
              accept: str = "*/*") -> int:
    # 默认 `Accept: */*` 与 SPEC-010 里验证用的 curl 口径一致。
    # 不能用 `text/html`：SBA 对未登录的 HTML 请求返回 302（跳登录页），
    # 只有 API 口径（*/* 或 application/json）才返回 401，而 A-02 判定的正是 401。
    headers = {"Accept": accept}
    if auth:
        headers["Authorization"] = "Basic " + auth
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except Exception:
        return 0


def http_json(url: str, method: str = "GET", body: dict | None = None,
              headers: dict | None = None, timeout: float = 10):
    hdrs = {"Accept": "application/json", "Content-Type": "application/json"}
    hdrs.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode())


def mysql(sql: str, timeout: int = 30) -> list[str]:
    password = env().get("MYSQL_ROOT_PASSWORD", "root")
    proc = run(
        ["docker", "exec", "awp-mysql", "mysql", "-uroot", f"-p{password}",
         "-N", "-B", "-e", sql],
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or "").strip()[:300])
    return [line for line in proc.stdout.splitlines() if line.strip()]


def compose_ps() -> dict[str, dict]:
    proc = run(COMPOSE + ["ps", "--format", "json"], timeout=60)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "").strip()[:300])
    text = (proc.stdout or "").strip()
    if not text:
        return {}
    # compose v2 的 `--format json` 每个服务输出一行 JSON，不是数组。
    if text.startswith("["):
        rows = json.loads(text)
    else:
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    return {row.get("Service"): row for row in rows}


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def login_snailjob() -> str:
    creds = env()
    _, body = http_json(
        SJ + "/auth/login", "POST",
        {"username": creds["MONITOR_ADMIN_USERNAME"],
         "password": creds["MONITOR_ADMIN_PASSWORD"]},
    )
    check(body.get("status") == 1, f"SnailJob 登录失败: {body.get('message')}")
    return body["data"]["token"]


# --- A-01 ---------------------------------------------------------------
def a01() -> None:
    deadline = time.time() + 120
    last = {}
    while time.time() < deadline:
        ps = compose_ps()
        missing = LONG_RUNNING - set(ps)
        not_running = [n for n in LONG_RUNNING
                       if n in ps and ps[n].get("State") != "running"]
        unhealthy = [n for n in ("monitor-admin", "snailjob-server")
                     if n in ps and ps[n].get("Health") != "healthy"]
        last = {"missing": sorted(missing), "not_running": sorted(not_running),
                "unhealthy": sorted(unhealthy)}
        if not missing and not not_running and not unhealthy:
            print(f"PASS A-01: {len(LONG_RUNNING)} 个服务 Running，控制台 healthy")
            return
        time.sleep(5)
    raise SystemExit(f"FAIL A-01: 120s 内未全部就绪 {last}")


# --- A-02 ---------------------------------------------------------------
def a02() -> None:
    expected = [(FRONT + "/admin/login", 200),
                (FRONT + "/admin/applications", 401),
                (FRONT + "/snail-job/", 200)]
    deadline = time.time() + 120
    while True:
        got = [http_code(url) for url, _ in expected]
        if got == [code for _, code in expected]:
            print(f"PASS A-02: {got}")
            return
        if time.time() > deadline:
            raise SystemExit(
                f"FAIL A-02: 期望 {[c for _, c in expected]}，实际 {got}")
        time.sleep(3)


# --- A-03 ---------------------------------------------------------------
def a03() -> None:
    creds = env()
    auth = base64.b64encode(
        f"{creds['MONITOR_ADMIN_USERNAME']}:{creds['MONITOR_ADMIN_PASSWORD']}"
        .encode()).decode()
    deadline = time.time() + 120
    while True:
        code = http_code(FRONT + "/admin/applications", auth=auth)
        if code == 200:
            status, apps = http_json(FRONT + "/admin/applications",
                                     headers={"Authorization": "Basic " + auth})
            hits = [app for app in apps
                    if app.get("name") == "aoyou-server" and app.get("status") == "UP"]
            if hits:
                print("PASS A-03: aoyou-server status=UP")
                return
        if time.time() > deadline:
            raise SystemExit(f"FAIL A-03: HTTP {code}，未找到 aoyou-server UP 实例")
        time.sleep(5)


# --- A-04 ---------------------------------------------------------------
def a04() -> None:
    count = int(mysql(
        "select count(*) from aoyou.sj_group_config"
        " where group_name='aoyou_group'")[0])
    check(count == 1, f"aoyou_group 组数量应为 1，实际 {count}")
    print("PASS A-04: sj_group_config aoyou_group = 1")


# --- A-05 ---------------------------------------------------------------
def a05() -> None:
    rows = mysql(
        "select count(*) from aoyou.sj_server_node"
        " where node_type=1 and group_name='aoyou_group'"
        " and expire_at > now()")
    check(int(rows[0]) >= 1,
          f"aoyou_group 在线执行器应为 ≥1，实际 {rows[0]}")
    token = login_snailjob()
    status, body = http_json(SJ + "/job/executor/list",
                             headers={"SNAIL-JOB-AUTH": token,
                                      "SNAIL-JOB-NAMESPACE-ID": "dev"})
    check(status == 200 and body.get("status") == 1,
          f"执行器列表接口不可用: {body.get('message')}")
    check(len(body.get("data") or []) >= 1, "执行器列表为空")
    print(f"PASS A-05: 在线执行器 {rows[0]} 个，注册执行器 {len(body['data'])} 个")


# --- A-06 ---------------------------------------------------------------
def batch_count() -> int:
    return int(mysql(
        f"select count(*) from aoyou.sj_job_task_batch where job_id={SEED_JOB_ID}")[0])


def a06() -> None:
    before = batch_count()
    token = login_snailjob()
    status, body = http_json(
        SJ + "/job/trigger", "POST", {"jobId": SEED_JOB_ID},
        headers={"SNAIL-JOB-AUTH": token, "SNAIL-JOB-NAMESPACE-ID": "dev"})
    check(status == 200 and body.get("status") == 1,
          f"触发失败: {body.get('message')}")
    deadline = time.time() + 60
    while time.time() < deadline:
        rows = mysql(
            "select task_batch_status from aoyou.sj_job_task_batch"
            f" where job_id={SEED_JOB_ID} order by id desc limit 1")
        if rows and int(rows[0]) == 3:
            after = batch_count()
            check(after == before + 1,
                  f"执行记录数应为 {before + 1}，实际 {after}")
            print(f"PASS A-06: 60s 内 status=3，记录数 {after}（触发 1 次）")
            return
        time.sleep(3)
    raise SystemExit("FAIL A-06: 60s 内未见 status=3 执行记录")


# --- A-07 ---------------------------------------------------------------
def a07() -> None:
    proc = run(COMPOSE + ["restart"], timeout=300)
    check(proc.returncode == 0, f"compose restart 失败: {proc.stderr[:200]}")
    started = time.time()
    expected = [(FRONT + "/admin/login", 200),
                (FRONT + "/admin/applications", 401),
                (FRONT + "/snail-job/", 200)]
    while time.time() - started <= 120:
        got = [http_code(url) for url, _ in expected]
        if got == [code for _, code in expected]:
            print(f"PASS A-07: restart 后 {time.time() - started:.1f}s 内 "
                  f"{got}，无手工 java -jar")
            return
        time.sleep(3)
    raise SystemExit(
        f"FAIL A-07: 120s 内未恢复，期望 {[c for _, c in expected]}，实际 {got}")


# --- A-08 ---------------------------------------------------------------
def diff_base() -> str:
    for ref in ("008-admin-snailjob-native", "main"):
        proc = run(["git", "rev-parse", "--verify", "--quiet", ref])
        if proc.returncode == 0:
            return ref
    raise SystemExit("FAIL A-08: 找不到对比基线分支")


def a08() -> None:
    base = diff_base()
    for path, label in (("frontend/apps", "frontend/apps/**"),
                        ("specs/SPEC-008-admin-snailjob-native.md", "SPEC-008")):
        proc = run(["git", "diff", "--stat", base, "--", path])
        check(not (proc.stdout or "").strip(),
              f"{label} 相对 {base} 存在改动:\n{proc.stdout}")
    perm = run(["git", "diff", base, "--", "frontend/apps"])
    added = [line for line in perm.stdout.splitlines()
             if line.startswith("+") and ("hasPermi" in line or "v-access:code" in line
                                          or "permission:" in line.lower())]
    check(not added, f"新增权限码: {added[:3]}")
    print(f"PASS A-08: 相对 {base} 的 frontend/apps 与 SPEC-008 diff=0，无新增权限码")


COMMANDS = {
    "a01": a01, "a02": a02, "a03": a03, "a04": a04,
    "a05": a05, "a06": a06, "a07": a07, "a08": a08,
}


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        print("用法: check.py <" + "|".join(sorted(COMMANDS)) + ">", file=sys.stderr)
        return 2
    COMMANDS[sys.argv[1]]()
    return 0


if __name__ == "__main__":
    sys.exit(main())
