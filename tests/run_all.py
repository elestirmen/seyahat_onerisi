#!/usr/bin/env python3
"""
Unified test runner.

Runs pytest if available (and writes JUnit XML to reports/junit.xml),
otherwise executes a fallback API smoke test against the Flask app.
"""
import os
import sys
import time
from pathlib import Path


def ensure_reports_dir():
    reports = Path("reports")
    reports.mkdir(exist_ok=True)
    return reports


def run_pytest():
    import pytest  # type: ignore
    reports = ensure_reports_dir()
    args = [
        "-q",
        "tests",
        f"--junitxml={reports / 'junit.xml'}",
    ]
    print("🔎 Running pytest...", flush=True)
    start = time.time()
    code = pytest.main(args)
    duration = time.time() - start
    summary = f"Pytest finished with exit code {code} in {duration:.2f}s\n"
    (reports / "summary.txt").write_text(summary)
    print(summary.strip())
    return code


def run_fallback_smoke():
    print("⚠️  Pytest not available. Running fallback API smoke tests...", flush=True)
    from datetime import datetime, timezone
    import secrets
    try:
        os.environ.setdefault("FLASK_ENV", "testing")
        from app.__init__ import create_app  # type: ignore
    except Exception as e:
        print(f"❌ Failed to import app: {e}")
        return 1

    app = create_app("testing")
    client = app.test_client()

    passed = 0
    failed = 0

    def check(name, resp, expected=(200,)):
        nonlocal passed, failed
        if resp.status_code in expected:
            print(f"✅ {name} -> {resp.status_code}")
            passed += 1
        else:
            print(f"❌ {name} -> {resp.status_code}")
            failed += 1

    # Public endpoints
    check("GET /api/pois", client.get("/api/pois?limit=2"))
    check("GET /api/routes", client.get("/api/routes?limit=2"))
    check("GET /api/routes/statistics", client.get("/api/routes/statistics"))

    # Admin requires auth; first without auth should be 401
    resp = client.get("/api/admin/routes", headers={"Content-Type": "application/json"})
    check("GET /api/admin/routes (unauth)", resp, expected=(401,))

    # Now simulate an authenticated session
    with client.session_transaction() as sess:
        now = datetime.now(timezone.utc).isoformat()
        sess['authenticated'] = True
        sess['login_time'] = now
        sess['last_activity'] = now
        sess['remember_me'] = False
        sess['csrf_token'] = secrets.token_hex(16)

    resp = client.get("/api/admin/routes?limit=1")
    check("GET /api/admin/routes (auth)", resp)

    reports = ensure_reports_dir()
    (reports / "fallback-summary.txt").write_text(
        f"passed={passed}, failed={failed}\n"
    )
    print(f"Summary: passed={passed}, failed={failed}")
    return 0 if failed == 0 else 1


def main():
    try:
        import pytest  # noqa: F401
    except Exception:
        return run_fallback_smoke()
    else:
        return run_pytest()


if __name__ == "__main__":
    sys.exit(main())

