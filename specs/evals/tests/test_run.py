"""评测执行器 specs/evals/run.py 的单元测试（stdlib unittest）。"""
import http.server
import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = REPO_ROOT / "specs" / "evals" / "run.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("eval_runner", RUNNER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_runner()


class TestValidateCase(unittest.TestCase):
    def test_valid_case_has_no_errors(self):
        case = {
            "id": "TC-001",
            "assertion": "A-01",
            "input": {"method": "GET", "path": "/orders/1"},
            "expect": {"status": 200},
        }
        self.assertEqual(runner.validate_case(case), [])

    def test_missing_required_fields_are_reported(self):
        errors = runner.validate_case({"id": "TC-001"})
        joined = " ".join(errors)
        self.assertIn("assertion", joined)
        self.assertIn("input", joined)
        self.assertIn("expect", joined)

    def test_input_requires_method_and_path(self):
        case = {
            "id": "TC-002",
            "assertion": "A-01",
            "input": {"method": "GET"},
            "expect": {"status": 200},
        }
        joined = " ".join(runner.validate_case(case))
        self.assertIn("path", joined)

    def test_expect_requires_at_least_one_assertion(self):
        case = {
            "id": "TC-003",
            "assertion": "A-01",
            "input": {"method": "GET", "path": "/x"},
            "expect": {},
        }
        joined = " ".join(runner.validate_case(case))
        self.assertIn("expect", joined)


class TestCoverage(unittest.TestCase):
    SPEC = """
| 编号 | 优先级 | Given | When | Then |
|---|---|---|---|---|
| A-01 | P0 | 存在 | 查询 | 200 |
| A-02 | P0 | 不存在 | 查询 | 404 |
| A-03 | P1 | 存在 | 查询 | 200 |
| E-01 | - | 非法 | 查询 | 400 |
| E-02 | - | 超时 | 查询 | 503 |
"""

    def test_missing_p0_case_is_reported(self):
        cases = [{"assertion": "A-01"}]
        missing, unknown = runner.check_coverage(cases, self.SPEC)
        self.assertEqual(missing, ["A-02"])
        self.assertEqual(unknown, [])

    def test_unknown_assertion_is_reported(self):
        cases = [{"assertion": "A-01"}, {"assertion": "A-02"}, {"assertion": "A-99"}]
        missing, unknown = runner.check_coverage(cases, self.SPEC)
        self.assertEqual(missing, [])
        self.assertEqual(unknown, ["A-99"])

    def test_edge_case_reference_is_valid(self):
        cases = [{"assertion": "A-01"}, {"assertion": "A-02"}, {"assertion": "E-01"}]
        missing, unknown = runner.check_coverage(cases, self.SPEC)
        self.assertEqual(missing, [])
        self.assertEqual(unknown, [])


class TestMatchExpect(unittest.TestCase):
    def test_status_mismatch(self):
        errors = runner.match_expect(500, {}, 10.0, {"status": 200})
        self.assertTrue(any("status" in e for e in errors))

    def test_code_mismatch(self):
        errors = runner.match_expect(404, {"code": "OTHER"}, 10.0, {"code": "ORDER_NOT_FOUND"})
        self.assertTrue(any("code" in e for e in errors))

    def test_json_subset_matches_nested_fields(self):
        body = {"data": {"id": "1", "amount": 100}, "code": "OK"}
        expect = {"json": {"data": {"id": "1"}}}
        self.assertEqual(runner.match_expect(200, body, 10.0, expect), [])

    def test_json_subset_reports_wrong_value(self):
        body = {"data": {"id": "2"}}
        expect = {"json": {"data": {"id": "1"}}}
        errors = runner.match_expect(200, body, 10.0, expect)
        self.assertTrue(any("data.id" in e for e in errors))

    def test_latency_threshold(self):
        errors = runner.match_expect(200, {}, 500.0, {"max_latency_ms": 300})
        self.assertTrue(any("latency" in e for e in errors))

    def test_schema_required_field(self):
        schema = {
            "type": "object",
            "required": ["id"],
            "properties": {"id": {"type": "string"}},
        }
        errors = runner.validate_schema({"name": "x"}, schema)
        self.assertTrue(any("id" in e for e in errors))

    def test_schema_type_mismatch(self):
        schema = {"type": "object", "properties": {"id": {"type": "integer"}}}
        errors = runner.validate_schema({"id": "not-int"}, schema)
        self.assertTrue(any("id" in e for e in errors))


class TestDiscoverAndCli(unittest.TestCase):
    def _make_root(self, cases_doc, spec_text):
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / "specs" / "evals" / "REQ-001").mkdir(parents=True)
        (root / "specs" / "SPEC-001.md").write_text(spec_text, encoding="utf-8")
        (root / "specs" / "evals" / "REQ-001" / "cases.yaml").write_text(
            cases_doc, encoding="utf-8"
        )
        return tmp, root

    def test_discover_finds_cases_dirs(self):
        tmp, root = self._make_root("spec_version: '1.0'\ncases: []\n", "---\nid: REQ-001\n---\n")
        try:
            dirs = runner.discover_dirs(root)
            self.assertEqual([d.name for d in dirs], ["REQ-001"])
        finally:
            tmp.cleanup()

    def test_check_fails_when_p0_uncovered(self):
        spec = "---\nid: REQ-001\n---\n| A-01 | P0 | a | b | 200 |\n"
        cases = (
            "spec_version: '1.0'\n"
            "cases:\n"
            "  - id: TC-002\n"
            "    assertion: A-02\n"
            "    input: {method: GET, path: /x}\n"
            "    expect: {status: 200}\n"
        )
        tmp, root = self._make_root(cases, spec)
        try:
            self.assertEqual(runner.main(["--check", "--root", str(root)]), 1)
        finally:
            tmp.cleanup()

    def test_check_passes_when_p0_covered(self):
        spec = "---\nid: REQ-001\n---\n| A-01 | P0 | a | b | 200 |\n"
        cases = (
            "spec_version: '1.0'\n"
            "cases:\n"
            "  - id: TC-001\n"
            "    assertion: A-01\n"
            "    input: {method: GET, path: /x}\n"
            "    expect: {status: 200}\n"
        )
        tmp, root = self._make_root(cases, spec)
        try:
            self.assertEqual(runner.main(["--check", "--root", str(root)]), 0)
        finally:
            tmp.cleanup()

    def test_ci_fails_without_base_url_when_cases_exist(self):
        spec = "---\nid: REQ-001\n---\n| A-01 | P0 | a | b | 200 |\n"
        cases = (
            "spec_version: '1.0'\n"
            "cases:\n"
            "  - id: TC-001\n"
            "    assertion: A-01\n"
            "    input: {method: GET, path: /x}\n"
            "    expect: {status: 200}\n"
        )
        tmp, root = self._make_root(cases, spec)
        try:
            rc = runner.main(["--ci", "--root", str(root)], env={})
            self.assertEqual(rc, 1)
        finally:
            tmp.cleanup()


class TestHttpExecution(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/ok":
                    body = b'{"ok": true, "code": "OK"}'
                    self.send_response(200)
                else:
                    body = b'{"code": "NOT_FOUND"}'
                    self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def _make_root(self, requirements):
        """requirements: [(req_id, case_yaml)]"""
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / "specs").mkdir(parents=True)
        for req_id, case_yaml in requirements:
            (root / "specs" / f"SPEC-{req_id}.md").write_text(
                f"---\nid: {req_id}\n---\n| A-01 | P0 | a | b | 200 |\n",
                encoding="utf-8",
            )
            eval_dir = root / "specs" / "evals" / req_id
            eval_dir.mkdir(parents=True)
            (eval_dir / "cases.yaml").write_text(case_yaml, encoding="utf-8")
        return tmp, root

    def _case(self, case_id, path, expect):
        return (
            "spec_version: '1.0'\n"
            "cases:\n"
            f"  - id: {case_id}\n"
            "    assertion: A-01\n"
            f"    input: {{method: GET, path: {path}}}\n"
            f"    expect: {expect}\n"
        )

    def test_ci_passes_and_writes_report(self):
        tmp, root = self._make_root([("REQ-001", self._case("TC-001", "/ok", "{status: 200}"))])
        try:
            rc = runner.main(
                ["--ci", "--root", str(root), "--base-url", self.base_url,
                 "--report", str(root / "reports"), "--timeout", "2"],
                env={},
            )
            self.assertEqual(rc, 0)
            report = json.loads((root / "reports" / "REQ-001.json").read_text(encoding="utf-8"))
            self.assertEqual((report["total"], report["passed"]), (1, 1))
        finally:
            tmp.cleanup()

    def test_ci_fails_on_wrong_expectation(self):
        tmp, root = self._make_root([("REQ-001", self._case("TC-001", "/ok", "{status: 500}"))])
        try:
            rc = runner.main(
                ["--ci", "--root", str(root), "--base-url", self.base_url, "--timeout", "2"],
                env={},
            )
            self.assertEqual(rc, 1)
        finally:
            tmp.cleanup()

    def test_report_counts_are_per_requirement(self):
        tmp, root = self._make_root(
            [
                ("REQ-001", self._case("TC-001", "/ok", "{status: 200}")),
                ("REQ-002", self._case("TC-002", "/ok", "{status: 500}")),
            ]
        )
        try:
            rc = runner.main(
                ["--ci", "--root", str(root), "--base-url", self.base_url,
                 "--report", str(root / "reports"), "--timeout", "2"],
                env={},
            )
            self.assertEqual(rc, 1)
            first = json.loads((root / "reports" / "REQ-001.json").read_text(encoding="utf-8"))
            second = json.loads((root / "reports" / "REQ-002.json").read_text(encoding="utf-8"))
            self.assertEqual((first["total"], first["passed"]), (1, 1))
            self.assertEqual((second["total"], second["passed"]), (1, 0))
        finally:
            tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
