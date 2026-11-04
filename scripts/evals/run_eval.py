#!/usr/bin/env python3
"""评测执行夹具（等价注入版），覆盖 specs/evals/ 下全部需求目录。

`specs/evals/run.py` 不支持认证头与 `${EVAL_*}` 占位替换。本夹具在不修改共享
执行器的前提下补齐这两项（SPEC-002 / SPEC-003 §5 允许“在等价测试夹具中完成注入”）：

1. 静态校验仍调用共享执行器 `python specs/evals/run.py --check`；
2. 逐个需求目录读取 `cases.yaml`，替换 `${EVAL_*}` 占位符；
3. 令牌由 `scripts/evals/http_probe.mjs` 走真实登录页获取，只在内存中注入
   `Authorization` / `clientid`，不写文件、不打印。

用法：
  python scripts/evals/run_eval.py --check
  python scripts/evals/run_eval.py --report specs/evals/reports
  python scripts/evals/run_eval.py --req REQ-20261104-003 --only TC-A01

环境变量：
  EVAL_BASE_URL       后端地址，默认 http://localhost:8080
  EVAL_FRONTEND_URL   前端地址，默认 http://localhost:5666
  EVAL_TOKEN          可选；提供后跳过管理员登录
  EVAL_NOACCESS_TOKEN 可选；提供后跳过无权限账号登录
  EVAL_ADMIN_USER / EVAL_ADMIN_PASSWORD         默认 admin / admin123
  EVAL_LIMITED_USER / EVAL_LIMITED_PASSWORD     默认 spec002_limited / admin123
  EVAL_SPEC003_MENU_ADMIN_USER / _PASSWORD      默认 spec003_menu_admin / admin123
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[2]
EVALS_DIR = REPO_ROOT / "specs" / "evals"
PROBE = REPO_ROOT / "scripts" / "evals" / "http_probe.mjs"
PLACEHOLDER = re.compile(r"\$\{([A-Z0-9_]+)\}")

# 各需求的澄清引用写入报告，便于回溯
CLARIFICATION_REFS = {
    "REQ-20261103-002": {
        "CLAR-005": "已裁决（Spec v1.1）：A-05 不含 authRole；空 roleIds 为 no-op（E-22）",
        "CLAR-006": "已裁决（Spec v1.1）：编辑提交原 userName（只读）",
        "CLAR-007": "已裁决（Spec v1.1）：空 roleIds 返回 200 且为 no-op（E-21）",
    },
}


def substitute(value, env: dict[str, str]):
    if isinstance(value, str):
        return PLACEHOLDER.sub(lambda match: env.get(match.group(1), match.group(0)), value)
    if isinstance(value, list):
        return [substitute(item, env) for item in value]
    if isinstance(value, dict):
        return {key: substitute(item, env) for key, item in value.items()}
    return value


def required_placeholders(value, found: set[str]) -> None:
    if isinstance(value, str):
        found.update(PLACEHOLDER.findall(value))
    elif isinstance(value, list):
        for item in value:
            required_placeholders(item, found)
    elif isinstance(value, dict):
        for item in value.values():
            required_placeholders(item, found)


def build_env() -> dict[str, str]:
    env = dict(os.environ)
    env.setdefault("EVAL_BASE_URL", "http://localhost:8080")
    env.setdefault("EVAL_FRONTEND_URL", "http://localhost:5666")
    env.setdefault("EVAL_RUN_ID", str(int(datetime.now(timezone.utc).timestamp())))
    # 固定夹具 ID（与 scripts/evals/seed_spec002.sh 一致）
    env.setdefault("EVAL_DEPT_ID", "900000000000000001")
    env.setdefault("EVAL_USER_ID", "900000000000000002")
    env.setdefault("EVAL_DELETE_USER_ID", "900000000000000004")
    env.setdefault("EVAL_ROLE_ID", "900000000000000006")
    # 固定夹具 ID（与 scripts/evals/seed_spec003.sh 一致）
    env.setdefault("EVAL_SPEC003_DEPT_ID", "900003000000000001")
    env.setdefault("EVAL_SPEC003_CHILD_DEPT_ID", "900003000000000002")
    env.setdefault("EVAL_SPEC003_USER_DEPT_ID", "900003000000000003")
    env.setdefault("EVAL_SPEC003_POST_DEPT_ID", "900003000000000004")
    env.setdefault("EVAL_SPEC003_EMPTY_DEPT_ID", "900003000000000005")
    env.setdefault("EVAL_SPEC003_ROLE_ID", "900003000000000006")
    env.setdefault("EVAL_SPEC003_ASSIGNED_ROLE_ID", "900003000000000007")
    env.setdefault("EVAL_SPEC003_MENU_ADMIN_ROLE_ID", "900003000000000010")
    env.setdefault("EVAL_SPEC003_USER_ID", "900003000000000011")
    env.setdefault("EVAL_SPEC003_MENU_ADMIN_USER_ID", "900003000000000012")
    env.setdefault("EVAL_SPEC003_POST_ID", "900003000000000013")
    env.setdefault("EVAL_SPEC003_DIR_MENU_ID", "900003000000000014")
    env.setdefault("EVAL_SPEC003_SUB_MENU_ID", "900003000000000015")
    env.setdefault("EVAL_SPEC003_BUTTON_MENU_ID", "900003000000000016")
    env.setdefault("EVAL_SPEC003_ROLE_NAME", "Spec003 角色")
    env.setdefault("EVAL_SPEC003_DEPT_NAME", "Spec003 部门")
    env.setdefault("EVAL_SPEC003_MENU_NAME", "Spec003 目录")
    return env


def discover_requirements(only_req: str | None) -> list[Path]:
    """返回需要执行的需求目录（按名称排序）"""
    dirs = sorted(
        path
        for path in EVALS_DIR.iterdir()
        if path.is_dir() and (path / "cases.yaml").is_file()
    )
    if only_req:
        dirs = [path for path in dirs if path.name == only_req]
        if not dirs:
            raise SystemExit(f"FAIL: 未找到需求目录 specs/evals/{only_req}")
    return dirs


def run_check() -> int:
    return subprocess.call([sys.executable, str(REPO_ROOT / "specs" / "evals" / "run.py"), "--check"])


def load_requirement(
    req_dir: Path, only: set[str] | None
) -> tuple[dict, list[dict]]:
    doc = yaml.safe_load((req_dir / "cases.yaml").read_text(encoding="utf-8"))
    cases = doc["cases"]
    if only:
        cases = [case for case in cases if case.get("id") in only]
    return doc, cases


def run_probe(cases: list[dict], env: dict[str, str]) -> list[dict] | None:
    """一次性执行全部用例：令牌按 auth 类型各登录一次。

    多个需求目录分两次调用会重复登录，叠加 `/auth/code` 的 10 次/60s/IP 限流，
    第二次调用必然拿不到验证码，故所有需求合并为一次探针调用。
    """
    payload = {
        "baseUrl": env["EVAL_BASE_URL"],
        "frontendUrl": env["EVAL_FRONTEND_URL"],
        "clientId": env.get("EVAL_CLIENT_ID", "e5cd7e4891bf95d1d19206ce24a7b32e"),
        "redisContainer": env.get("EVAL_REDIS_CONTAINER", "awp-redis"),
        "redisPassword": env.get("EVAL_REDIS_PASSWORD", "aoyou123"),
        "credentials": {
            "admin": {
                "username": env.get("EVAL_ADMIN_USER", "admin"),
                "password": env.get("EVAL_ADMIN_PASSWORD", "admin123"),
            },
            "limited": {
                "username": env.get("EVAL_LIMITED_USER", "spec002_limited"),
                "password": env.get("EVAL_LIMITED_PASSWORD", "admin123"),
            },
            "menuAdmin": {
                "username": env.get(
                    "EVAL_SPEC003_MENU_ADMIN_USER", "spec003_menu_admin"
                ),
                "password": env.get(
                    "EVAL_SPEC003_MENU_ADMIN_PASSWORD", "admin123"
                ),
            },
        },
        "directTokens": {
            "admin": env.get("EVAL_TOKEN"),
            "limited": env.get("EVAL_NOACCESS_TOKEN"),
            "menuAdmin": env.get("EVAL_SPEC003_MENU_ADMIN_TOKEN"),
        },
        "cases": substitute(cases, env),
    }

    completed = subprocess.run(
        ["node", str(PROBE)],
        input=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        cwd=REPO_ROOT,
        capture_output=True,
    )
    if completed.returncode != 0:
        print("FAIL: 探针执行失败", file=sys.stderr)
        print(completed.stderr.decode("utf-8", errors="replace"), file=sys.stderr)
        return None

    return json.loads(completed.stdout.decode("utf-8"))["cases"]


def write_report(
    req_dir: Path,
    doc: dict,
    results: list[dict],
    env: dict[str, str],
    report_dir: Path,
) -> None:
    total = len(results)
    passed = sum(1 for item in results if item["passed"])
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report = {
        "req": req_dir.name,
        "spec_version": doc["spec_version"],
        "run_id": env["EVAL_RUN_ID"],
        "base_url": env["EVAL_BASE_URL"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "passed": passed,
        "cases": results,
        "clarification_refs": CLARIFICATION_REFS.get(req_dir.name, {}),
    }
    json_path = report_dir / f"{req_dir.name}-{stamp}.json"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"报告: {os.path.relpath(json_path, REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只做静态校验与 P0 覆盖检查")
    parser.add_argument("--report", type=Path, help="报告输出目录")
    parser.add_argument("--req", help="只执行指定需求目录（默认 specs/evals 下全部）")
    parser.add_argument("--only", help="只执行指定用例 ID（逗号分隔），用于定位问题")
    args = parser.parse_args()

    if args.check:
        return run_check()
    check_code = run_check()
    if check_code != 0:
        return check_code
    if yaml is None:
        print("FAIL: 缺少 PyYAML", file=sys.stderr)
        return 1

    only = {item.strip() for item in args.only.split(",")} if args.only else None
    env = build_env()

    loaded: list[tuple[Path, dict, list[dict]]] = []
    all_cases: list[dict] = []
    for req_dir in discover_requirements(args.req):
        doc, cases = load_requirement(req_dir, only)
        if not cases:
            continue
        loaded.append((req_dir, doc, cases))
        all_cases.extend(cases)

    placeholders: set[str] = set()
    required_placeholders(all_cases, placeholders)
    missing = sorted(
        name for name in placeholders if name.startswith("EVAL_") and name not in env
    )
    if missing:
        print(f"FAIL: 缺少环境变量 {', '.join(missing)}", file=sys.stderr)
        return 1

    results = run_probe(all_cases, env)
    if results is None:
        return 1

    failures = 0
    offset = 0
    for req_dir, doc, cases in loaded:
        chunk = results[offset : offset + len(cases)]
        offset += len(cases)

        print(f"== {req_dir.name} ==")
        for item in chunk:
            status = "PASS" if item["passed"] else "FAIL"
            print(f"[{status}] {item['id']} ({item['assertion']}) {item['latency_ms']}ms")
            for error in item["errors"]:
                print(f"       {error}")
        passed = sum(1 for item in chunk if item["passed"])
        print(f"\n{passed}/{len(chunk)} 通过")
        if args.report is not None:
            write_report(req_dir, doc, chunk, env, args.report)
        if passed != len(chunk):
            failures += 1
        print()

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
