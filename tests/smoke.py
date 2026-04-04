#!/usr/bin/env python3
"""
Smoke tests for POI Travel Recommendation API.

Runs a small set of fast checks using Flask's test client (no real DB required).
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def build_test_app():
    import importlib

    os.environ.setdefault("FLASK_ENV", "testing")
    os.environ.setdefault("POI_ADMIN_TOKEN", "test-admin-token-1234567890")
    app_module = importlib.import_module("app.__init__")

    # Prevent real DB pool initialization
    setattr(app_module, "init_database_pool", lambda cfg: None)
    flask_app = app_module.create_app("testing")

    # Stub services to avoid real database usage during tests
    from app.middleware.error_handler import APIError
    from app.services import route_service, poi_service, media_service

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

    def _stub_poi_nearby(*args, **kwargs):
        lat = kwargs.get("lat", 0.0)
        lng = kwargs.get("lng", 0.0)
        radius_m = kwargs.get("radius_m", 1000)
        return {
            "center": {"lat": lat, "lng": lng},
            "radius_m": radius_m,
            "count": 0,
            "category": kwargs.get("category"),
            "categories": kwargs.get("categories") or [],
            "pois": [],
        }

    def _stub_nearby_panoramas(*args, **kwargs):
        lat = kwargs.get("lat", 0.0)
        lng = kwargs.get("lng", 0.0)
        radius_m = kwargs.get("radius_m", 1000)
        return {
            "center": {"lat": lat, "lng": lng},
            "radius_m": radius_m,
            "count": 0,
            "panoramas": [],
        }

    poi_service.list_pois = _stub_poi_list  # type: ignore[assignment]
    poi_service.search_pois = _stub_poi_search  # type: ignore[assignment]
    poi_service.get_poi = _stub_poi_get  # type: ignore[assignment]
    poi_service.search_nearby_pois = _stub_poi_nearby  # type: ignore[assignment]
    media_service.search_nearby_panoramas = _stub_nearby_panoramas  # type: ignore[assignment]

    return flask_app


def main() -> int:
    app = build_test_app()
    client = app.test_client()

    checks = [
        ("GET /health", client.get("/health"), (200,)),
        ("GET /api/pois", client.get("/api/pois?limit=2"), (200,)),
        ("GET /api/search?q=test", client.get("/api/search?q=test&limit=5"), (200,)),
        ("GET /api/pois/nearby", client.get("/api/pois/nearby?lat=38.63&lng=34.91&radius_m=500&limit=5"), (200,)),
        ("GET /api/panoramas/nearby", client.get("/api/panoramas/nearby?lat=38.63&lng=34.91&radius_m=500&limit=5"), (200,)),
        ("GET /api/routes", client.get("/api/routes?limit=2"), (200,)),
        ("GET /api/routes/statistics", client.get("/api/routes/statistics"), (200,)),
        ("GET /api/admin/routes (unauth)", client.get("/api/admin/routes", headers={"Content-Type": "application/json"}), (401,)),
    ]

    failed = 0
    for name, resp, expected in checks:
        if resp.status_code in expected:
            print(f"✅ {name} -> {resp.status_code}")
        else:
            print(f"❌ {name} -> {resp.status_code} (expected {expected})")
            failed += 1

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
