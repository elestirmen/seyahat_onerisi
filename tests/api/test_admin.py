from flask.sessions import SecureCookieSessionInterface

from app.services.media_service import media_service
from poi_media_manager import POIMediaManager
from auth_middleware import auth_middleware


def test_admin_routes_require_auth_returns_401_json(client):
    # Indicate JSON to avoid redirect to non-registered auth blueprint
    resp = client.get("/api/admin/routes", headers={"Content-Type": "application/json"})
    assert resp.status_code == 401
    data = resp.get_json()
    assert isinstance(data, dict)
    assert data.get("error")


def test_admin_routes_authorized_list_ok(authed_client):
    resp = authed_client.get("/api/admin/routes?limit=1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    # Expected shape
    assert "routes" in data
    assert "total" in data


def test_admin_route_list_keeps_inactive_visibility(authed_client, monkeypatch):
    from app.routes import route as route_routes

    captured = {}

    def fake_list_routes(*args, **kwargs):
        captured.update(kwargs)
        return {
            "routes": [{"id": 7, "name": "Archived", "is_active": False}],
            "total": 1,
            "page": kwargs["page"],
            "total_pages": 1,
            "per_page": kwargs["limit"],
        }

    monkeypatch.setattr(route_routes.route_service, "list_routes", fake_list_routes)

    resp = authed_client.get("/api/admin/routes")

    assert resp.status_code == 200
    assert resp.get_json()["routes"][0]["is_active"] is False
    assert captured["is_active"] is None


def test_admin_route_detail_can_read_inactive_route(authed_client, monkeypatch):
    from app.routes import route as route_routes

    captured = {}

    def fake_get_route(route_id, require_active=False):
        captured["route_id"] = route_id
        captured["require_active"] = require_active
        return {"id": route_id, "name": "Archived", "is_active": False}

    monkeypatch.setattr(route_routes.route_service, "get_route", fake_get_route)

    resp = authed_client.get("/api/admin/routes/7")

    assert resp.status_code == 200
    assert resp.get_json()["is_active"] is False
    assert captured == {"route_id": 7, "require_active": False}


def test_signed_session_cookie_does_not_authenticate_admin_routes(app, client):
    serializer = SecureCookieSessionInterface().get_signing_serializer(app)
    cookie_value = serializer.dumps({"poi_admin_authenticated": True})
    client.set_cookie("session", cookie_value)

    resp = client.get("/api/admin/routes", headers={"Content-Type": "application/json"})
    assert resp.status_code == 401


def test_media_limits_are_100mb(app):
    expected_size = 100 * 1024 * 1024

    assert app.config["MAX_CONTENT_LENGTH"] == expected_size
    for config in media_service.SUPPORTED_FORMATS.values():
        assert config["max_size"] == expected_size
    for config in POIMediaManager.SUPPORTED_FORMATS.values():
        assert config["max_size"] == expected_size


def test_admin_login_is_locked_after_repeated_failures(client, monkeypatch):
    monkeypatch.setattr(auth_middleware, "max_failed_attempts", 3)
    monkeypatch.setattr(auth_middleware, "failed_attempt_window", 60)

    for _ in range(3):
        response = client.post("/auth/login", json={"token": "wrong-token"})
        assert response.status_code == 401

    blocked = client.post("/auth/login", json={"token": "wrong-token"})

    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


def test_forwarded_for_cannot_bypass_login_limit(client, monkeypatch):
    monkeypatch.setattr(auth_middleware, "max_failed_attempts", 2)
    monkeypatch.setattr(auth_middleware, "failed_attempt_window", 60)

    first = client.post(
        "/auth/login",
        json={"token": "wrong-token"},
        headers={"X-Forwarded-For": "198.51.100.10"},
        environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
    )
    second = client.post(
        "/auth/login",
        json={"token": "wrong-token"},
        headers={"X-Forwarded-For": "203.0.113.20"},
        environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
    )
    blocked = client.post(
        "/auth/login",
        json={"token": "wrong-token"},
        headers={"X-Forwarded-For": "192.0.2.30"},
        environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
    )

    assert first.status_code == 401
    assert second.status_code == 401
    assert blocked.status_code == 429


def test_api_responses_are_not_cached(client):
    response = client.get("/api/pois")

    assert response.headers["Cache-Control"] == "no-store"


def test_static_assets_can_be_cached(client):
    response = client.get("/static/js/admin_token.js")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public, max-age=86400"


def test_csp_disallows_javascript_eval(client):
    response = client.get("/health")
    csp = response.headers["Content-Security-Policy"]

    assert "'unsafe-eval'" not in csp
    assert "frame-ancestors 'self'" in csp
