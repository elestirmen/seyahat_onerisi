from flask.sessions import SecureCookieSessionInterface

from app.services.media_service import media_service
from poi_media_manager import POIMediaManager


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
