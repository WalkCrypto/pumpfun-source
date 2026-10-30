#!/usr/bin/env python3
"""verify_mayhem_buy must fail closed when Python strips asserts.

Every acceptance check in scripts/verify_mayhem_buy.py is a bare
assert, so under ``python -O``/``-OO`` a tampered saved-receipt report is
still accepted: the candidate-hash, original-hash, harness-hash, case-count
and mismatches header checks all vanish, and with zero cases the case loop
does nothing, so the script writes a clean result with ``"mismatches": []``
and exits 0. The fix refuses optimized interpreters up front, like
scripts/pump_validate_all.py already does.

The test materializes an isolated tree (the real repo root has no
evidence/ in a sparse checkout) with a candidate file and the original
deployed blob, plus stub solders modules (solders is not installed here,
and the header-only fixtures never reach transaction parsing), then runs
the script three ways: normal Python accepts the valid fixture and
rejects each tampered one, and optimized Python must refuse to run at
all. On the unfixed script the optimized runs exit 0 and print the clean
result for the tampered fixtures, which is the defect.
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPT = "verify_mayhem_buy.py"

CANDIDATE = b"CANDIDATE-BYTES"
ORIGINAL = b"MAYHEM-ORIGINAL"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def build_tree(root, report):
    scripts = root / "scripts"
    scripts.mkdir(parents=True)
    shutil.copy(REPO / "scripts" / SCRIPT, scripts / SCRIPT)
    deployed = root / "evidence" / "original" / "mayhem"
    deployed.mkdir(parents=True)
    (deployed / "deployed.so").write_bytes(ORIGINAL)
    stub = root / "stub"
    solders = stub / "solders"
    solders.mkdir(parents=True)
    (solders / "__init__.py").write_text("")
    (solders / "pubkey.py").write_text(
        "class Pubkey(str):\n"
        "    @classmethod\n"
        "    def from_string(cls, value):\n"
        "        return cls(value)\n"
        "    @classmethod\n"
        "    def find_program_address(cls, seeds, program_id):\n"
        "        return (cls('stub-pda'), 255)\n"
        "    def is_on_curve(self):\n"
        "        return True\n"
    )
    (solders / "transaction.py").write_text(
        "class Transaction:\n"
        "    @classmethod\n"
        "    def from_bytes(cls, data):\n"
        "        raise NotImplementedError('stub Transaction is unused here')\n"
    )
    candidate = root / "candidate.so"
    candidate.write_bytes(CANDIDATE)
    receipts = root / "receipts.json"
    receipts.write_text(json.dumps(report))
    return scripts / SCRIPT, stub, candidate, receipts, root / "out.json"


def valid_report():
    return {
        "candidate_sha256": sha(CANDIDATE),
        "original_sha256": sha(ORIGINAL),
        "harness_sha256": {},
        "case_count": 0,
        "cases": [],
        "mismatches": [],
    }


def tampered_reports():
    report = valid_report()
    wrong_hash = valid_report()
    wrong_hash["candidate_sha256"] = "0" * 64
    mismatches = valid_report()
    mismatches["mismatches"] = ["case-0 mismatch"]
    wrong_count = valid_report()
    wrong_count["case_count"] = 3
    return {
        "candidate-hash": wrong_hash,
        "mismatches": mismatches,
        "case-count": wrong_count,
    }


def run(script, stub, candidate, receipts, output, flags):
    env = dict(os.environ)
    env["PYTHONPATH"] = str(stub)
    return subprocess.run(
        [sys.executable, *flags, "-B", str(script),
         "--receipts", str(receipts),
         "--candidate", str(candidate),
         "--output", str(output)],
        capture_output=True,
        text=True,
        timeout=60,
        env=env,
    )


class VerifyMayhemBuyOptimizationTests(unittest.TestCase):
    def test_valid_fixture_passes_and_tampered_fails_in_all_modes(self):
        fixtures = [("valid", valid_report())]
        fixtures += sorted(tampered_reports().items())
        for name, report in fixtures:
            for flags in ([], ["-O"], ["-OO"]):
                with self.subTest(fixture=name, flags=flags):
                    with tempfile.TemporaryDirectory() as tmp:
                        script, stub, candidate, receipts, output = build_tree(
                            Path(tmp), report
                        )
                        result = run(
                            script, stub, candidate, receipts, output, flags
                        )
                        if flags:
                            # The guard refuses optimized runs outright,
                            # valid fixture or not, and never prints a
                            # clean result.
                            self.assertNotEqual(
                                result.returncode,
                                0,
                                "optimized run accepted under %s:\n%s"
                                % (flags, result.stdout),
                            )
                            self.assertNotIn('"mismatches": []', result.stdout)
                        elif name == "valid":
                            self.assertEqual(
                                result.returncode,
                                0,
                                "valid fixture rejected:\n%s%s"
                                % (result.stdout, result.stderr),
                            )
                        else:
                            self.assertNotEqual(
                                result.returncode,
                                0,
                                "tampered fixture accepted (%s):\n%s"
                                % (name, result.stdout),
                            )
                            self.assertNotIn('"mismatches": []', result.stdout)


if __name__ == "__main__":
    unittest.main()
