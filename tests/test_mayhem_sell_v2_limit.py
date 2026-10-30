"""`scripts/mayhem_sell_v2_differential.py --limit` must reject negative counts.

Sibling of #2723 (mayhem buy v2 differential), #2719 (mayhem sell
differential), #2714 (mayhem buy differential) and merged #2697
(reconstruction/pump-main/log_attempt.py search --limit): this script's
case loop is `for c in cases(a.cases)[:a.limit]`, so `--limit -1` ran
every case except the last and wrote a report whose case_count
undercounted with no warning, while omitting `--limit` still runs every
case.

The script module itself is not imported here (it needs solders and the
Mayhem fixture); only its limit guard is executed, extracted by AST, and
the --limit argument is checked to actually use that guard, so the test
fails on base (no guard exists) and passes with the fix.
"""

import argparse
import ast
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = ROOT / "scripts" / "mayhem_sell_v2_differential.py"


def load_limit_value():
    source = SCRIPT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    func = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "limit_value":
            func = node
            break
    assert func is not None, "no limit_value guard found in mayhem_sell_v2_differential.py"
    namespace = {"argparse": argparse}
    code = compile(ast.Module(body=[func], type_ignores=[]), "limit_value", "exec")
    exec(code, namespace)
    return namespace["limit_value"], tree


class MayhemSellV2LimitTests(unittest.TestCase):
    def test_negative_limit_is_rejected(self):
        limit_value, _ = load_limit_value()
        for value in ("-1", "-3"):
            with self.assertRaises(argparse.ArgumentTypeError):
                limit_value(value)

    def test_zero_and_positive_limits_stay_admitted(self):
        limit_value, _ = load_limit_value()
        self.assertEqual(limit_value("0"), 0)
        self.assertEqual(limit_value("2"), 2)

    def test_limit_argument_uses_the_guard(self):
        _, tree = load_limit_value()
        found = False
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if not (isinstance(func, ast.Attribute) and func.attr == "add_argument"):
                continue
            args = [a for a in node.args if isinstance(a, ast.Constant)]
            if not any(a.value == "--limit" for a in args):
                continue
            for keyword in node.keywords:
                if keyword.arg == "type" and isinstance(keyword.value, ast.Name):
                    self.assertEqual(keyword.value.id, "limit_value")
                    found = True
        self.assertTrue(found, "--limit argument does not use limit_value")

    def test_negative_limit_would_truncate_the_case_list(self):
        # Documents the base behavior the guard closes: a negative slice
        # silently drops trailing cases instead of failing.
        cases = [{"name": "a"}, {"name": "b"}, {"name": "c"}]
        self.assertEqual([c["name"] for c in cases[:-1]], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
