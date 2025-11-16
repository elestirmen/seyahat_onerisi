import os
import sys
import importlib
from pathlib import Path
from datetime import datetime, timezone
import secrets
import pytest

# Ensure project root is on sys.path (so 'app' package can be imported)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture()
def app(monkeypatch):
    os.environ.setdefault("FLASK_ENV", "testing")
    # Import the application module
    app_pkg = importlib.import_module("app")
    app_module = importlib.import_module("app.__init__")

    # Prevent real DB pool initialization during tests
    monkeypatch.setattr(app_module, "init_database_pool", lambda cfg: None, raising=False)

    flask_app = app_module.create_app("testing")

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
            "timestamp": datetime.now().isoformat(),
        }

    def _stub_route_get(route_id, *args, **kwargs):
        raise APIError("Route not found", "NOT_FOUND", 404)

    monkeypatch.setattr(route_service, "list_routes", _stub_route_list, raising=False)
    monkeypatch.setattr(route_service, "get_route_statistics", _stub_route_stats, raising=False)
    monkeypatch.setattr(route_service, "get_route", _stub_route_get, raising=False)

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

    monkeypatch.setattr(poi_service, "list_pois", _stub_poi_list, raising=False)
    monkeypatch.setattr(poi_service, "search_pois", _stub_poi_search, raising=False)
    monkeypatch.setattr(poi_service, "get_poi", _stub_poi_get, raising=False)

    yield flask_app


@pytest.fixture()
def client(app):
    return app.test_client()

@pytest.fixture()
def authed_client(client):
    # Simulate an authenticated session that passes AuthMiddleware checks
    with client.session_transaction() as sess:
        now = datetime.now(timezone.utc).isoformat()
        sess['authenticated'] = True
        sess['login_time'] = now
        sess['last_activity'] = now
        sess['remember_me'] = False
        sess['csrf_token'] = secrets.token_hex(16)
    return client
