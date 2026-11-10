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
  EVAL_SPEC003_ROUTER_USER / _PASSWORD          默认 spec003_router / admin123（A-18）
  EVAL_SPEC003_ROUTER_TOKEN                     可选；提供后跳过路由账号登录
  EVAL_SPEC004_LIMITED_USER / _PASSWORD         默认 spec004_limited / admin123（A-09）
  EVAL_SPEC004_LIMITED_TOKEN                    可选；提供后跳过受限账号登录
  EVAL_SPEC004_*_ID / _NAME                     固定夹具 ID/名称（与 seed_spec004.sh 对齐）
  EVAL_SPEC005_ADMIN_TOKEN / EVAL_SPEC005_LIMITED_TOKEN
  EVAL_SPEC005_TENANT_B_TOKEN                   SPEC-005 夹具直取令牌；提供后跳过登录，
                                                保持 A-01/A-02 的登录日志夹具稳定
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
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
FRONTEND = REPO_ROOT / "frontend"
# Windows 下 npx 是 .cmd，Python 的 CreateProcess 不解析 PATHEXT，需显式取全路径。
NPX = shutil.which("npx") or shutil.which("npx.cmd") or "npx"
PLACEHOLDER = re.compile(r"\$\{([A-Z0-9_]+)\}")

# CLAR-015（2026-11-09 裁决 A）：SPEC-001 A-08 的“相对 main 零改动”只在
# REQ-001 自身交付分支上成立；合并分支（如 005-home-workbench）包含其他
# 需求的改动，按定义必然失败。合并分支运行时把该条显式标记为 N/A，
# 不计入分母，也不写成 PASS——报告保留 n/a 字段与原因，供人工复核。
NA_CASE_RULES = {
    "REQ-20261101-001": {
        "branch": "001-vben-frontend-replacement",
        "assertions": {"A-08"},
        "clarification": "CLAR-015",
    },
}


def current_branch() -> str:
    """当前 git 分支名；取不到时返回空串（此时不启用任何 N/A 规则）。"""
    try:
        proc = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return proc.stdout.strip() if proc.returncode == 0 else ""


def na_reason(req_name: str, case: dict) -> str:
    """命中 N/A 规则时返回原因，否则空串。"""
    rule = NA_CASE_RULES.get(req_name)
    if not rule:
        return ""
    if case.get("assertion") not in rule["assertions"]:
        return ""
    branch = current_branch()
    if not branch or branch == rule["branch"]:
        return ""
    return (
        f"{rule['clarification']}：该断言只在交付分支 {rule['branch']} 执行，"
        f"当前分支 {branch} 标记 N/A（不计入分母）"
    )

# 各需求的澄清引用写入报告，便于回溯
CLARIFICATION_REFS = {
    "REQ-20261103-002": {
        "CLAR-005": "已裁决（Spec v1.1）：A-05 不含 authRole；空 roleIds 为 no-op（E-22）",
        "CLAR-006": "已裁决（Spec v1.1）：编辑提交原 userName（只读）",
        "CLAR-007": "已裁决（Spec v1.1）：空 roleIds 返回 200 且为 no-op（E-21）",
    },
    "REQ-20261108-006": {
        "CLAR-011": "已裁决（Spec v1.1）：dueTime 由 flow_task.create_time + 生效 SLA 派生",
        "CLAR-012": "已裁决（Spec v1.2）：效率统计改为滚动 7×24h + 节点任务时长",
        "CLAR-013": "已裁决（Spec v1.3）：公告标题长度边界按 30 字符",
        "CLAR-014": "已裁决（Spec v1.4）：SLA 上限 168h，非法配置启动失败",
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
    env.setdefault("EVAL_SPEC003_HIDDEN_MENU_ID", "900003000000000017")
    env.setdefault("EVAL_SPEC003_ROUTER_USER_ID", "900003000000000022")
    env.setdefault("EVAL_SPEC003_ROLE_NAME", "Spec003 角色")
    env.setdefault("EVAL_SPEC003_DEPT_NAME", "Spec003 部门")
    env.setdefault("EVAL_SPEC003_MENU_NAME", "Spec003 目录")
    # 固定夹具 ID/名称（与 scripts/evals/seed_spec004.sh 一致）
    env.setdefault("EVAL_SPEC004_DICT_TYPE_ID", "900004000000000001")
    env.setdefault("EVAL_SPEC004_DICT_TYPE", "spec004_dict_type")
    env.setdefault("EVAL_SPEC004_DICT_TYPE_NAME", "Spec004 字典类型")
    env.setdefault("EVAL_SPEC004_DICT_DATA_A_ID", "900004000000000002")
    env.setdefault("EVAL_SPEC004_DICT_DATA_B_ID", "900004000000000003")
    env.setdefault("EVAL_SPEC004_DICT_DATA_A_LABEL", "Spec004 标签一")
    env.setdefault("EVAL_SPEC004_DICT_DATA_B_LABEL", "Spec004 标签二")
    env.setdefault("EVAL_SPEC004_CONFIG_ID", "900004000000000004")
    env.setdefault("EVAL_SPEC004_CONFIG_KEY", "spec004.config.key")
    env.setdefault("EVAL_SPEC004_CONFIG_NAME", "Spec004 参数")
    env.setdefault("EVAL_SPEC004_NOTICE_ID", "900004000000000005")
    env.setdefault("EVAL_SPEC004_NOTICE_TITLE", "Spec004 公告")
    env.setdefault("EVAL_SPEC004_OPER_LOG_ID", "900004000000000006")
    env.setdefault("EVAL_SPEC004_OPER_NAME", "spec004_operator")
    env.setdefault("EVAL_SPEC004_LOGININFOR_ID", "900004000000000007")
    env.setdefault("EVAL_SPEC004_LOGIN_USER", "spec004_lock")
    env.setdefault("EVAL_SPEC004_LIMITED_ROLE_ID", "900004000000000008")
    env.setdefault("EVAL_SPEC004_LIMITED_USER_ID", "900004000000000009")
    env.setdefault("EVAL_SPEC004_OSS_CONFIG_ID", "900004000000000010")
    env.setdefault("EVAL_SPEC004_OSS_CONFIG_KEY", "spec004_oss_config")
    # SPEC-005 登录趋势 / 工作台分组的日期口径（Asia/Shanghai，D-6～D）。
    now_cn = datetime.now(timezone(timedelta(hours=8)))
    for offset in range(7):
        day = (now_cn - timedelta(days=offset)).strftime("%Y-%m-%d")
        env.setdefault(f"EVAL_DATE_D{offset or ''}", day)
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
        # `/auth/code` 限流账本：与 E2E 进程共享 7 次/60s 的预算（见下方 main）。
        "captchaLedger": env.get("EVAL_CAPTCHA_LEDGER", ""),
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
            # A-18：绑定 spec003_role 的普通账号，用于验证 getRouters 的路由过滤
            "router": {
                "username": env.get(
                    "EVAL_SPEC003_ROUTER_USER", "spec003_router"
                ),
                "password": env.get(
                    "EVAL_SPEC003_ROUTER_PASSWORD", "admin123"
                ),
            },
            # SPEC-005：三个账号都走夹具直取令牌，避免评测登录写入
            # sys_logininfor 干扰 A-01/A-02 的登录数断言。
            "spec005Admin": {
                "username": env.get(
                    "EVAL_SPEC005_ADMIN_USER", "spec005_admin_a"
                ),
                "password": env.get(
                    "EVAL_SPEC005_ADMIN_PASSWORD", "admin123"
                ),
            },
            "spec005Limited": {
                "username": env.get(
                    "EVAL_SPEC005_LIMITED_USER", "spec005_limited"
                ),
                "password": env.get(
                    "EVAL_SPEC005_LIMITED_PASSWORD", "admin123"
                ),
            },
            "spec005TenantB": {
                "username": env.get(
                    "EVAL_SPEC005_TENANT_B_USER", "spec005_admin_b"
                ),
                "password": env.get(
                    "EVAL_SPEC005_TENANT_B_PASSWORD", "admin123"
                ),
            },
            # A-09：仅字典 list/query 权限，用于验证按钮不渲染与写接口 403
            "spec004Limited": {
                "username": env.get(
                    "EVAL_SPEC004_LIMITED_USER", "spec004_limited"
                ),
                "password": env.get(
                    "EVAL_SPEC004_LIMITED_PASSWORD", "admin123"
                ),
            },
        },
        "directTokens": {
            "admin": env.get("EVAL_TOKEN"),
            "limited": env.get("EVAL_NOACCESS_TOKEN"),
            "menuAdmin": env.get("EVAL_SPEC003_MENU_ADMIN_TOKEN"),
            "router": env.get("EVAL_SPEC003_ROUTER_TOKEN"),
            "spec005Admin": env.get("EVAL_SPEC005_ADMIN_TOKEN"),
            "spec005Limited": env.get("EVAL_SPEC005_LIMITED_TOKEN"),
            "spec005TenantB": env.get("EVAL_SPEC005_TENANT_B_TOKEN"),
            "spec004Limited": env.get("EVAL_SPEC004_LIMITED_TOKEN"),
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


def _exec(
    cmd: list[str], cwd: Path, timeout: int
) -> tuple[subprocess.CompletedProcess, float]:
    started = time.perf_counter()
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return proc, (time.perf_counter() - started) * 1000


def _first_json(text: str | None) -> dict | None:
    """从命令输出里取 JSON（报告器可能在 JSON 前后夹日志行）。"""
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _run_shell(spec: dict) -> tuple[list[str], float]:
    """执行 `shell:` 步骤：默认要求退出码 0 且 stdout 为空。"""
    timeout = int(spec.get("timeout", 120))
    proc, latency = _exec(["bash", "-lc", str(spec.get("cmd", ""))], REPO_ROOT, timeout)
    errors: list[str] = []
    stdout = (proc.stdout or "").strip()
    if proc.returncode != 0:
        errors.append(
            f"退出码 {proc.returncode}: {(proc.stderr or '').strip()[:400]}"
        )
    if spec.get("expect_empty", True) and stdout:
        errors.append(f"stdout 期望为空，实际: {stdout[:400]}")
    return errors, latency


def _playwright_tests(
    spec: str, grep: str, timeout: int
) -> tuple[dict[str, list[str]], dict[str, str], float]:
    """运行一个 E2E spec（可用 -g 只跑命中标题的用例）。

    返回 ({标题: [状态]}, {标题: 失败信息}, 耗时)。只跑命中用例是为了省掉无关登录：
    `/auth/code` 限流 10 次/60s/IP，整文件跑会把限流预算花在别的断言上。
    """
    cmd = [NPX, "playwright", "test", spec, "--reporter=json"]
    if grep:
        cmd += ["-g", grep]
    proc, latency = _exec(cmd, FRONTEND, timeout)
    data = _first_json(proc.stdout) or {}
    titles: dict[str, list[str]] = {}
    messages: dict[str, str] = {}

    def walk(node: dict) -> None:
        for item in node.get("specs") or []:
            statuses: list[str] = []
            details: list[str] = []
            for test in item.get("tests") or []:
                for result in test.get("results") or []:
                    statuses.append(result.get("status"))
                    message = (result.get("error") or {}).get("message") or ""
                    for extra in result.get("errors") or []:
                        message += "\n" + str((extra or {}).get("message") or "")
                    if message.strip():
                        details.append(message.strip()[:600])
            title = item.get("title") or "<untitled>"
            titles[title] = statuses
            if details:
                messages[title] = "\n".join(details)
        for child in node.get("suites") or []:
            walk(child)

    for suite in data.get("suites") or []:
        walk(suite)

    if not titles:
        detail = (proc.stderr or proc.stdout or "").strip()[:400]
        titles[f"<未解析到用例> {detail}"] = ["failed"]
    return titles, messages, latency


def _vitest_tests(case_file: str, timeout: int) -> tuple[dict[str, str], float]:
    """运行一个单测文件，返回 {标题: 状态}。"""
    proc, latency = _exec(
        [NPX, "vitest", "run", case_file, "--reporter=json"], FRONTEND, timeout
    )
    data = _first_json(proc.stdout) or {}
    titles: dict[str, str] = {}
    for result in data.get("testResults") or []:
        for assertion in result.get("assertionResults") or []:
            titles[assertion.get("title") or "<untitled>"] = assertion.get("status")
    if not titles:
        detail = (proc.stderr or proc.stdout or "").strip()[:400]
        titles[f"<未解析到用例> {detail}"] = "failed"
    return titles, latency


def run_extra_checks(cases: list[dict]) -> dict[str, dict]:
    """执行用例里声明的 `e2e:` / `vitest:` / `shell:` 检查。

    E2E 按 (spec, grep) 分组：同一组只跑一次，并用 `-g` 只执行命中标题的用例，
    避免把 `/auth/code` 的限流预算花在无关用例上；单测按文件分组。
    """
    results: dict[str, dict] = {}
    e2e_groups: dict[tuple[str, str], list[dict]] = {}
    vitest_groups: dict[str, list[dict]] = {}

    for case in cases:
        cid = case.get("_key") or case.get("id")
        if case.get("shell"):
            errors, latency = _run_shell(case["shell"])
            results[cid] = {"errors": errors, "latency_ms": latency}
        if case.get("e2e"):
            key = (str(case["e2e"]["spec"]), str(case["e2e"].get("grep", "")))
            e2e_groups.setdefault(key, []).append(case)
        if case.get("vitest"):
            vitest_groups.setdefault(str(case["vitest"]["file"]), []).append(case)

    for (spec, grep), group in e2e_groups.items():
        titles, messages, latency = _playwright_tests(
            spec, grep, int(os.environ.get("EVAL_E2E_TIMEOUT", "1800"))
        )
        for case in group:
            case_grep = str(case["e2e"].get("grep", ""))
            matched = {
                title: statuses
                for title, statuses in titles.items()
                if case_grep and case_grep in title
            }
            errors: list[str] = []
            if not matched:
                errors.append(
                    f"E2E {spec} 未找到标题包含“{case_grep}”的用例；已解析标题={sorted(titles)}"
                )
            for title, statuses in matched.items():
                if not statuses or any(status != "passed" for status in statuses):
                    detail = messages.get(title)
                    suffix = f"：{detail}" if detail else ""
                    errors.append(f"E2E {title} 状态 {statuses}{suffix}")
            entry = results.setdefault(
                case.get("_key") or case["id"], {"errors": [], "latency_ms": 0}
            )
            entry["errors"].extend(errors)
            entry["latency_ms"] += latency

    for case_file, group in vitest_groups.items():
        titles, latency = _vitest_tests(case_file, int(os.environ.get("EVAL_UNIT_TIMEOUT", "600")))
        for case in group:
            grep = str(case["vitest"].get("grep", ""))
            matched = {title: status for title, status in titles.items() if grep and grep in title}
            errors = []
            if not matched:
                errors.append(
                    f"单测 {case_file} 未找到标题包含“{grep}”的用例；已解析标题={sorted(titles)}"
                )
            for title, status in matched.items():
                if status != "passed":
                    errors.append(f"单测 {title} 状态 {status}")
            entry = results.setdefault(
                case.get("_key") or case["id"], {"errors": [], "latency_ms": 0}
            )
            entry["errors"].extend(errors)
            entry["latency_ms"] += latency

    return results


def write_report(
    req_dir: Path,
    doc: dict,
    results: list[dict],
    env: dict[str, str],
    report_dir: Path,
) -> None:
    total = len(results)
    passed = sum(1 for item in results if item["passed"])
    na = sum(1 for item in results if item.get("na"))
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
        "effective_total": total - na,
        "na": na,
        "cases": results,
        "clarification_refs": CLARIFICATION_REFS.get(req_dir.name, {}),
    }
    json_path = report_dir / f"{req_dir.name}-{stamp}.json"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    try:
        shown = os.path.relpath(json_path, REPO_ROOT)
    except ValueError:  # Windows 跨盘符无法取相对路径
        shown = str(json_path)
    print(f"报告: {shown}")


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

    # `/auth/code` 限流账本：探针与各 Playwright 进程都是独立进程，进程内节流
    # 无法跨进程生效；用临时文件共享「5 次/60s」的预算（后端上限 10 次/60s/IP）。
    ledger_path = Path(tempfile.gettempdir()) / f"awp-eval-captcha-{os.getpid()}.json"
    ledger_path.write_text("[]", encoding="utf-8")
    env["EVAL_CAPTCHA_LEDGER"] = str(ledger_path)
    os.environ["E2E_CAPTCHA_LEDGER"] = str(ledger_path)

    # E2E 产物按运行隔离：Playwright 启动时会清空 outputDir，并发评测若共用
    # 固定目录会互删 trace（`browserContext.close: ENOENT ...recording1.trace`）。
    # 成功时删除，失败时保留并把路径打出来，便于排查。
    artifacts_dir = Path(tempfile.mkdtemp(prefix=f"awp-eval-artifacts-{os.getpid()}-"))
    os.environ["E2E_OUTPUT_DIR"] = str(artifacts_dir / "artifacts")
    os.environ["E2E_REPORT_DIR"] = str(artifacts_dir / "report")

    loaded: list[tuple[Path, dict, list[dict]]] = []
    all_cases: list[dict] = []
    for req_dir in discover_requirements(args.req):
        doc, cases = load_requirement(req_dir, only)
        if not cases:
            continue
        # case.id 只在需求内唯一（各需求都用 TC-A01 这类编号）；跨需求合并结果时
        # 必须带上需求目录，否则同名用例的成败会互相覆盖/串值。
        for case in cases:
            case["_key"] = f"{req_dir.name}/{case.get('id')}"
        loaded.append((req_dir, doc, cases))
        all_cases.extend(cases)

    placeholders: set[str] = set()
    required_placeholders(all_cases, placeholders)
    missing = sorted(
        name for name in placeholders if name.startswith("EVAL_") and name not in env
    )
    if missing:
        print(f"FAIL: 缺少环境变量 {', '.join(missing)}", file=sys.stderr)
        ledger_path.unlink(missing_ok=True)
        shutil.rmtree(artifacts_dir, ignore_errors=True)
        return 1

    # shell 用例不经过 HTTP 探针；显式 `probe: false` 的用例只有 e2e/vitest 面。
    probe_cases = [
        case
        for case in all_cases
        if not case.get("shell") and case.get("probe", True) is not False
    ]
    probe_results = run_probe(probe_cases, env) if probe_cases else []
    if probe_results is None:
        ledger_path.unlink(missing_ok=True)
        shutil.rmtree(artifacts_dir, ignore_errors=True)
        return 1
    extra_results = run_extra_checks(all_cases)
    ledger_path.unlink(missing_ok=True)

    # 探针按传入顺序逐条返回，用位置对齐（id 跨需求会重名）。
    probe_keyed = {
        case["_key"]: item
        for case, item in zip(probe_cases, probe_results, strict=False)
    }
    merged: list[dict] = []
    for case in all_cases:
        cid = case.get("id")
        key = case["_key"]
        base = probe_keyed.get(key)
        errors: list[str] = []
        latency = 0.0
        if (
            base is None
            and not case.get("shell")
            and case.get("probe", True) is not False
        ):
            errors.append("未取得 HTTP 结果")
        if base is not None:
            errors.extend(base.get("errors") or [])
            latency += float(base.get("latency_ms") or 0)
        extra = extra_results.get(key)
        if extra:
            errors.extend(extra["errors"])
            latency += extra["latency_ms"]
        merged.append(
            {
                "id": cid,
                "assertion": case.get("assertion"),
                "passed": not errors,
                "latency_ms": round(latency, 1),
                "errors": errors,
            }
        )

    failures = 0
    offset = 0
    for req_dir, doc, cases in loaded:
        chunk = merged[offset : offset + len(cases)]
        offset += len(cases)

        print(f"== {req_dir.name} ==")
        for case, item in zip(cases, chunk):
            reason = na_reason(req_dir.name, case)
            if reason:
                item["passed"] = False
                item["errors"] = []
                item["na"] = True
                item["na_reason"] = reason
                print(f"[N/A] {item['id']} ({item['assertion']}) — {reason}")
                continue
            status = "PASS" if item["passed"] else "FAIL"
            print(f"[{status}] {item['id']} ({item['assertion']}) {item['latency_ms']}ms")
            for error in item["errors"]:
                print(f"       {error}")
        passed = sum(1 for item in chunk if item["passed"])
        na = sum(1 for item in chunk if item.get("na"))
        effective = len(chunk) - na
        suffix = f"（{na} 条 N/A）" if na else ""
        print(f"\n{passed}/{effective} 通过{suffix}")
        if args.report is not None:
            write_report(req_dir, doc, chunk, env, args.report)
        if passed != effective:
            failures += 1
        print()

    if failures:
        # 失败时保留 trace / HTML 报告，便于定位；成功时清理临时目录。
        print(f"E2E 产物保留: {artifacts_dir}")
    else:
        shutil.rmtree(artifacts_dir, ignore_errors=True)

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
