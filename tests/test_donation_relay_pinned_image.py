"""`scripts/donation_relay_differential.py` must report the candidate it executed.

Sibling of #2824 (pump create-mayhem pair), #2816 (fees
donation-crank probe), #2805 (fees social-claim), #2798 (fees
donation-create) and #2791 (fees external-codec), which pinned their
candidate images: this script's `main()` hands the live candidate path
straight to `execute()`, `execute()` builds a fresh LiteSVM per case
through `vm_for()`, and `vm_for()` hands the path to
`add_program_from_file`, which reads the file on every call -- so
replacing the candidate file mid-run makes later cases execute a
different image, while the report's `candidate_sha256` is read from
the live candidate path only at the end. One receipt would then
cover two images.

The script module itself is not imported here (it needs solders and
the LiteSVM fixture); only the pinning wiring is checked by AST, so
the test fails on base (no `pin_program` use, live path handed to
`execute()`) and passes with the fix. The runtime swap is not
runnable here (solders is absent).
"""

import ast
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = ROOT / "scripts" / "donation_relay_differential.py"


def load_tree():
    return ast.parse(SCRIPT.read_text(encoding="utf-8"))


def contains_candidate_attr(node):
    return any(
        isinstance(n, ast.Attribute)
        and isinstance(n.value, ast.Name)
        and n.value.id == "a"
        and n.attr == "candidate"
        for n in ast.walk(node)
    )


def is_pinned_call(node):
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "pin_program"
        and node.args
        and contains_candidate_attr(node.args[0])
    )


class DonationRelayPinnedImageTests(unittest.TestCase):
    def test_candidate_is_pinned_before_execute(self):
        tree = load_tree()
        imported = any(
            isinstance(node, ast.ImportFrom)
            and node.module == "pump_amm_reusable_harness"
            and any(alias.name == "pin_program" for alias in node.names)
            for node in ast.walk(tree)
        )
        self.assertTrue(imported, "pin_program is not imported")

        execute_calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "execute"
        ]
        self.assertTrue(execute_calls, "no execute() call found")
        for call in execute_calls:
            self.assertTrue(
                call.args and is_pinned_call(call.args[0]),
                "execute() is not handed a pinned candidate snapshot",
            )


if __name__ == "__main__":
    unittest.main()
