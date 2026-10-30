"""`scripts/pump_create_mayhem_differential.py` must report the candidate pair it executed.

Sibling of #2816 (fees donation-crank probe), open #2805 (fees
social-claim), #2798 (fees donation-create) and #2791 (fees
external-codec), and merged #2774 (fees sharing-create), which
pinned their candidate images: this script's `main()` hands the
candidate pump and mayhem paths straight to `run()` once per case,
and `run()` hands them to `add_program_from_file`, which reads each
file on every call — so replacing either candidate file mid-run
makes later cases execute a different image (and breaks the pump /
mayhem pair the receipt claims), while the report's
`candidate_pump_sha256` / `candidate_mayhem_sha256` are read from
the live candidate paths only at the end. One receipt would then
cover two images.

The script module itself is not imported here (it needs solders and
the LiteSVM fixture); only the pinning wiring is checked by AST, so
the test fails on base (no `pin_program` use, live paths hashed at
the end) and passes with the fix. The runtime swap is not runnable
here (solders is absent).
"""

import ast
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = ROOT / "scripts" / "pump_create_mayhem_differential.py"

CANDIDATES = ("candidate_pump", "candidate_mayhem")


def load_tree():
    return ast.parse(SCRIPT.read_text(encoding="utf-8"))


def is_pinned_call(node, attr):
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "pin_program"
        and node.args
        and isinstance(node.args[0], ast.Attribute)
        and isinstance(node.args[0].value, ast.Name)
        and node.args[0].value.id == "a"
        and node.args[0].attr == attr
    )


def is_live_candidate_attr(node, attr):
    return (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "a"
        and node.attr == attr
    )


class PumpCreateMayhemPinnedImagesTests(unittest.TestCase):
    def test_candidate_pair_is_pinned(self):
        tree = load_tree()
        imported = any(
            isinstance(node, ast.ImportFrom)
            and node.module == "pump_amm_reusable_harness"
            and any(alias.name == "pin_program" for alias in node.names)
            for node in ast.walk(tree)
        )
        self.assertTrue(imported, "pin_program is not imported")

        for attr in CANDIDATES:
            pinned = any(is_pinned_call(node, attr) for node in ast.walk(tree))
            self.assertTrue(pinned, "candidate path %s is not pinned" % attr)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "run":
                for arg in node.args:
                    for attr in CANDIDATES:
                        if is_live_candidate_attr(arg, attr):
                            self.fail("candidate cases are run from the live %s path" % attr)
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "read_bytes"
                and isinstance(node.func.value, ast.Attribute)
            ):
                for attr in CANDIDATES:
                    if is_live_candidate_attr(node.func.value, attr):
                        self.fail("report hash is read from the live %s path" % attr)


if __name__ == "__main__":
    unittest.main()
