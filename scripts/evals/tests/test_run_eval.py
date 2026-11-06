"""scripts/evals/run_eval.py 的单元测试（stdlib unittest）。

重点守护跨需求合并：`case.id` 只在需求内唯一（各需求的用例都叫 TC-A01…），
运行器必须用「需求目录/用例ID」作为结果键，否则同名用例的成败会串值。
"""
import importlib.util
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = REPO_ROOT / "scripts" / "evals" / "run_eval.py"


def load_runner(path: Path = RUNNER_PATH):
    spec = importlib.util.spec_from_file_location("eval_run_eval", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def shell_case(req: str, cmd: str, key: str = "TC-A01") -> dict:
    return {
        "id": key,
        "_key": f"{req}/{key}",
        "assertion": "A-01",
        "input": {"method": "SHELL", "path": cmd},
        "expect": {"shell": "empty"},
        "shell": {"cmd": cmd},
    }


class TestResultKeys(unittest.TestCase):
    def test_same_case_id_across_requirements_keeps_separate_results(self):
        """两个需求都有 TC-A01 时，结果不能互相覆盖。"""
        runner = load_runner()
        results = runner.run_extra_checks(
            [
                shell_case("REQ-A", "true"),
                shell_case("REQ-B", "false"),
            ]
        )

        self.assertEqual(
            sorted(results), ["REQ-A/TC-A01", "REQ-B/TC-A01"]
        )
        self.assertEqual(results["REQ-A/TC-A01"]["errors"], [])
        self.assertNotEqual(results["REQ-B/TC-A01"]["errors"], [])

    def test_missing_requirement_key_falls_back_to_case_id(self):
        """单需求直接调用（无 _key）时仍按 case.id 归并。"""
        runner = load_runner()
        case = shell_case("REQ-A", "true")
        case.pop("_key")

        results = runner.run_extra_checks([case])

        self.assertEqual(sorted(results), ["TC-A01"])


if __name__ == "__main__":
    unittest.main()
