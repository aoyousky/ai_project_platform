#!/usr/bin/env python3
"""评测执行器：校验 specs/evals 用例结构、P0 覆盖，并可对服务执行 HTTP 断言。

用法：
  python specs/evals/run.py --check           # 静态校验 + P0 覆盖，不联网
  python specs/evals/run.py --ci              # CI 模式：静态校验通过后必须执行 HTTP
  EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py

用例目录约定：specs/evals/<需求编号>/cases.yaml，schema 见 specs/evals/README.md。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - 环境缺依赖时给出明确提示
    yaml = None

# Windows 控制台默认 GBK，会把中文输出写成乱码；CI 与 Git Bash 统一按 UTF-8 输出。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[2]
ASSERTION_REF = re.compile(r"^[AE]-\d+$")
SPEC_ROW = re.compile(r"^\|\s*([AE]-\d+)\s*\|\s*(P[0-3]|[-—])\s*\|", re.M)


# ---------------------------------------------------------------- 用例校验

def validate_case(case: Any) -> list[str]:
    """校验单条用例，返回错误信息列表（空列表表示通过）。"""
    if not isinstance(case, dict):
        return ["case 必须是映射"]
    errors: list[str] = []
    cid = case.get("id")
    if not isinstance(cid, str) or not cid.strip():
        errors.append("case.id 缺失或为空")
    assertion = case.get("assertion")
    if not isinstance(assertion, str) or not ASSERTION_REF.match(assertion):
        errors.append("case.assertion 缺失或格式不是 A-xx/E-xx")
    inp = case.get("input")
    if not isinstance(inp, dict):
        errors.append("case.input 缺失或不是映射")
    else:
        if not inp.get("method"):
            errors.append("case.input.method 缺失")
        if not inp.get("path"):
            errors.append("case.input.path 缺失")
    expect = case.get("expect")
    if not isinstance(expect, dict) or not expect:
        errors.append("case.expect 缺失或为空")
    return errors


def validate_cases_doc(doc: Any) -> list[str]:
    """校验整个 cases.yaml 文档。"""
    if not isinstance(doc, dict):
        return ["cases.yaml 顶层必须是映射"]
    errors: list[str] = []
    version = doc.get("spec_version")
    if version is None or str(version).strip() == "":
        errors.append("缺少 spec_version")
    cases = doc.get("cases")
    if not isinstance(cases, list) or not cases:
        errors.append("cases 必须是非空列表")
        return errors
    seen: set[str] = set()
    for index, case in enumerate(cases):
        for error in validate_case(case):
            errors.append(f"cases[{index}]: {error}")
        if isinstance(case, dict):
            cid = case.get("id")
            if cid in seen:
                errors.append(f"cases[{index}]: case id 重复: {cid}")
            seen.add(cid)
    return errors


def parse_spec(text: str) -> dict[str, str]:
    """从 Spec Packet 中解析断言编号 → 优先级。"""
    return {match.group(1): match.group(2) for match in SPEC_ROW.finditer(text)}


def check_coverage(cases: list[dict], spec_text: str) -> tuple[list[str], list[str]]:
    """返回 (未覆盖的 P0 断言, 用例引用了但 Spec 中不存在的断言)。"""
    spec = parse_spec(spec_text)
    covered = {
        case.get("assertion")
        for case in cases
        if isinstance(case, dict) and isinstance(case.get("assertion"), str)
    }
    missing = [
        assertion
        for assertion, priority in spec.items()
        if assertion.startswith("A-") and priority == "P0" and assertion not in covered
    ]
    unknown = sorted(assertion for assertion in covered if assertion not in spec)
    return missing, unknown


# ---------------------------------------------------------------- 断言匹配

_TYPE_MAP = {
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
    "object": dict,
    "array": list,
    "null": type(None),
}


def validate_schema(value: Any, schema: Any, path: str = "$") -> list[str]:
    """最小 JSON Schema 子集：type / required / properties / items / enum。"""
    if not isinstance(schema, dict):
        return []
    errors: list[str] = []
    expected_type = schema.get("type")
    if expected_type:
        expected = _TYPE_MAP.get(expected_type)
        type_ok = expected is not None and isinstance(value, expected)
        if expected_type == "integer" and isinstance(value, bool):
            type_ok = False
        if expected is not None and not type_ok:
            return [f"{path}: 期望类型 {expected_type}，实际 {type(value).__name__}"]
    if isinstance(value, dict):
        for required in schema.get("required", []):
            if required not in value:
                errors.append(f"{path}.{required}: 缺少必填字段")
        properties = schema.get("properties") or {}
        for key, sub_schema in properties.items():
            if key in value:
                errors.extend(validate_schema(value[key], sub_schema, f"{path}.{key}"))
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path}.{key}: 不允许的字段")
    if isinstance(value, list) and isinstance(schema.get("items"), dict):
        for index, item in enumerate(value):
            errors.extend(validate_schema(item, schema["items"], f"{path}[{index}]"))
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: 值 {value!r} 不在枚举内")
    return errors


def _subset_errors(actual: Any, expected: Any, path: str = "$") -> list[str]:
    errors: list[str] = []
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path}: 期望对象，实际 {type(actual).__name__}"]
        for key, value in expected.items():
            if key not in actual:
                errors.append(f"{path}.{key}: 缺少字段")
            else:
                errors.extend(_subset_errors(actual[key], value, f"{path}.{key}"))
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) < len(expected):
            errors.append(f"{path}: 列表长度不足或类型不符")
        else:
            for index, (actual_item, expected_item) in enumerate(zip(actual, expected)):
                errors.extend(_subset_errors(actual_item, expected_item, f"{path}[{index}]"))
    elif actual != expected:
        errors.append(f"{path}: 期望 {expected!r}，实际 {actual!r}")
    return errors


def match_expect(
    status: int, body: Any, latency_ms: float, expect: dict
) -> list[str]:
    """按 expect 校验响应，返回错误信息列表。"""
    errors: list[str] = []
    if "status" in expect and status != expect["status"]:
        errors.append(f"status: 期望 {expect['status']}，实际 {status}")
    if "code" in expect:
        actual_code = body.get("code") if isinstance(body, dict) else None
        if actual_code != expect["code"]:
            errors.append(f"code: 期望 {expect['code']}，实际 {actual_code}")
    if "json" in expect:
        errors.extend(_subset_errors(body, expect["json"]))
    if "max_latency_ms" in expect and latency_ms > float(expect["max_latency_ms"]):
        errors.append(
            f"latency: 期望 <= {expect['max_latency_ms']}ms，实际 {latency_ms:.1f}ms"
        )
    return errors


# ---------------------------------------------------------------- 文件发现

def discover_dirs(root: Path) -> list[Path]:
    base = Path(root) / "specs" / "evals"
    if not base.is_dir():
        return []
    return sorted(d for d in base.iterdir() if d.is_dir() and (d / "cases.yaml").is_file())


def parse_front_matter_id(text: str) -> str | None:
    match = re.search(r"^---\s*$(.*?)^---\s*$", text, re.M | re.S)
    if not match:
        return None
    for line in match.group(1).splitlines():
        found = re.match(r"^id:\s*(\S+)\s*$", line)
        if found:
            return found.group(1).strip("'\"")
    return None


def load_specs(root: Path) -> dict[str, tuple[Path, str]]:
    specs: dict[str, tuple[Path, str]] = {}
    for path in sorted((Path(root) / "specs").glob("SPEC-*.md")):
        if "TEMPLATE" in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        spec_id = parse_front_matter_id(text)
        if spec_id:
            specs[spec_id] = (path, text)
    return specs


def load_cases(path: Path) -> Any:
    if yaml is None:
        raise RuntimeError("缺少 PyYAML：请安装后重试（pip install pyyaml）")
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def _load_schema(req_dir: Path, name: str) -> dict:
    candidate = req_dir / "schemas" / f"{name}.json"
    if not candidate.is_file():
        candidate = req_dir / f"{name}.json"
    if not candidate.is_file():
        raise FileNotFoundError(f"找不到 schema 文件: {name}（{req_dir}/schemas/）")
    return json.loads(candidate.read_text(encoding="utf-8"))


# ---------------------------------------------------------------- 静态检查

def run_check(root: Path) -> int:
    specs = load_specs(root)
    dirs = discover_dirs(root)
    failed = False
    if not dirs:
        print("PASS: 未发现 specs/evals/*/cases.yaml")
        return 0
    for req_dir in dirs:
        print(f"== {req_dir.name} ==")
        try:
            doc = load_cases(req_dir / "cases.yaml")
        except Exception as exc:  # noqa: BLE001 - 需要把解析错误转成门禁失败
            print(f"FAIL: 读取 cases.yaml 失败: {exc}")
            failed = True
            continue
        errors = validate_cases_doc(doc)
        for error in errors:
            print(f"FAIL: {error}")
        if errors:
            failed = True
            continue
        spec_entry = specs.get(req_dir.name)
        if not spec_entry:
            print(f"FAIL: 找不到需求编号为 {req_dir.name} 的 Spec Packet")
            failed = True
            continue
        spec_path, spec_text = spec_entry
        cases = doc["cases"]
        missing, unknown = check_coverage(cases, spec_text)
        for assertion in missing:
            print(f"FAIL: P0 断言 {assertion} 无对应用例")
            failed = True
        for assertion in unknown:
            print(f"FAIL: 用例引用了 {spec_path.name} 中不存在的断言 {assertion}")
            failed = True
        if not missing and not unknown:
            print(f"PASS: {len(cases)} 条用例，P0 断言全覆盖")
    return 1 if failed else 0


# ---------------------------------------------------------------- HTTP 执行

def _http_request(case: dict, base_url: str, timeout: float) -> tuple[int, Any, float]:
    inp = case["input"]
    method = str(inp.get("method", "GET")).upper()
    path = str(inp.get("path", "/"))
    url = base_url.rstrip("/") + "/" + path.lstrip("/")
    query = inp.get("query")
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    headers = {str(k): str(v) for k, v in (inp.get("headers") or {}).items()}
    data = None
    if "body" in inp:
        data = json.dumps(inp["body"]).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
    latency_ms = (time.perf_counter() - started) * 1000
    body: Any = None
    if raw:
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = raw.decode("utf-8", errors="replace")
    return status, body, latency_ms


def run_http(root: Path, base_url: str, timeout: float, report_dir: Path | None) -> int:
    dirs = discover_dirs(root)
    specs = load_specs(root)
    total = passed = 0
    results: list[dict] = []
    for req_dir in dirs:
        doc = load_cases(req_dir / "cases.yaml")
        spec_entry = specs.get(req_dir.name)
        if not spec_entry:
            print(f"FAIL: 找不到需求编号为 {req_dir.name} 的 Spec Packet")
            return 1
        print(f"== {req_dir.name} ==")
        dir_start = len(results)
        for case in doc["cases"]:
            total += 1
            case_id = case.get("id", "<no-id>")
            try:
                status, body, latency = _http_request(case, base_url, timeout)
            except Exception as exc:  # noqa: BLE001 - 网络错误即用例失败
                print(f"FAIL {case_id}: 请求失败: {exc}")
                results.append({"id": case_id, "assertion": case.get("assertion"), "ok": False,
                                "errors": [f"请求失败: {exc}"]})
                continue
            errors = match_expect(status, body, latency, case.get("expect") or {})
            schema_name = (case.get("expect") or {}).get("schema")
            if schema_name:
                try:
                    errors.extend(validate_schema(body, _load_schema(req_dir, schema_name)))
                except FileNotFoundError as exc:
                    errors.append(str(exc))
            if errors:
                print(f"FAIL {case_id} ({case.get('assertion')}): " + "; ".join(errors))
                results.append({"id": case_id, "assertion": case.get("assertion"),
                                "ok": False, "status": status, "latency_ms": round(latency, 1),
                                "errors": errors})
            else:
                passed += 1
                print(f"PASS {case_id} ({case.get('assertion')}) {status} {latency:.1f}ms")
                results.append({"id": case_id, "assertion": case.get("assertion"),
                                "ok": True, "status": status, "latency_ms": round(latency, 1)})
        if report_dir is not None:
            dir_results = results[dir_start:]
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "requirement": req_dir.name,
                "base_url": base_url,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "total": len(doc["cases"]),
                "passed": sum(1 for r in dir_results if r["ok"]),
                "results": dir_results,
            }
            (report_dir / f"{req_dir.name}.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    print(f"== 结果：{passed}/{total} 通过 ==")
    return 0 if total > 0 and passed == total else 1


# ---------------------------------------------------------------- CLI

def main(argv: list[str] | None = None, env: dict[str, str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="评测执行器")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="仅静态校验，不联网")
    mode.add_argument("--ci", action="store_true", help="CI 模式：静态校验 + 执行 HTTP")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="仓库根目录")
    parser.add_argument("--base-url", default=None, help="被测服务地址")
    parser.add_argument("--timeout", type=float, default=10.0, help="单请求超时（秒）")
    parser.add_argument("--report", type=Path, default=None, help="执行报告输出目录")
    args = parser.parse_args(argv)

    root = args.root
    if args.check:
        return run_check(root)

    # --ci 或默认模式：先静态校验，再执行
    check_code = run_check(root)
    if check_code != 0:
        return check_code
    dirs = discover_dirs(root)
    if not dirs:
        print("PASS: 无用例可执行")
        return 0
    environment = env if env is not None else os.environ
    base_url = args.base_url or environment.get("EVAL_BASE_URL")
    if not base_url:
        print("FAIL: 存在评测用例但未设置 EVAL_BASE_URL，无法证明测试通过")
        return 1
    return run_http(root, base_url, args.timeout, args.report)


if __name__ == "__main__":
    sys.exit(main())
