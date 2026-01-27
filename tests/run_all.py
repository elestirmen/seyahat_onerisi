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


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


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
    import importlib

    try:
        os.environ.setdefault("FLASK_ENV", "testing")
        os.environ.setdefault("POI_ADMIN_TOKEN", "test-admin-token-1234567890")
        app_module = importlib.import_module("app.__init__")
    except Exception as e:
        print(f"❌ Failed to import app: {e}")
        return 1

    # Prevent real DB pool initialization during fallback smoke tests
    setattr(app_module, "init_database_pool", lambda cfg: None)

    app = app_module.create_app("testing")
    client = app.test_client()

    # Stub services to avoid real database usage during tests
    from app.middleware.error_handler import APIError
    from app.services import route_service, poi_service

    def _stub_route_list(*args, **kwargs):
        page = kwargs.get("page", 1)
        limit = kwargs.get("limit", 20)
        return {
            "routes": [],
            "total": 0,
            "page": page,
            "total_pages": 0,
            "per_page": limit,
        }

    def _stub_route_stats(*args, **kwargs):
        return {
            "total_routes": 0,
            "active_routes": 0,
            "inactive_routes": 0,
            "by_type": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _stub_route_get(route_id, *args, **kwargs):
        raise APIError("Route not found", "NOT_FOUND", 404)

    route_service.list_routes = _stub_route_list  # type: ignore[assignment]
    route_service.get_route_statistics = _stub_route_stats  # type: ignore[assignment]
    route_service.get_route = _stub_route_get  # type: ignore[assignment]

    def _stub_poi_list(*args, **kwargs):
        page = kwargs.get("page", 1)
        limit = kwargs.get("limit", 20)
        return {
            "pois": [],
            "total": 0,
            "page": page,
            "total_pages": 0,
        }

    def _stub_poi_search(*args, **kwargs):
        query = kwargs.get("query") or kwargs.get("q") or ""
        return {
            "results": [],
            "total": 0,
            "query": query,
        }

    def _stub_poi_get(*args, **kwargs):
        raise APIError("POI not found", "NOT_FOUND", 404)

    poi_service.list_pois = _stub_poi_list  # type: ignore[assignment]
    poi_service.search_pois = _stub_poi_search  # type: ignore[assignment]
    poi_service.get_poi = _stub_poi_get  # type: ignore[assignment]

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
    check("GET /health", client.get("/health"))
    check("GET /api/pois", client.get("/api/pois?limit=2"))
    check("GET /api/routes", client.get("/api/routes?limit=2"))
    check("GET /api/routes/statistics", client.get("/api/routes/statistics"))

    # Admin requires auth; first without auth should be 401
    resp = client.get("/api/admin/routes", headers={"Content-Type": "application/json"})
    check("GET /api/admin/routes (unauth)", resp, expected=(401,))

    token = os.environ.get("POI_ADMIN_TOKEN", "")
    resp = client.get(
        "/api/admin/routes?limit=1",
        headers={"Content-Type": "application/json", "X-Admin-Token": token},
    )
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
