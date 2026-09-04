def test_list_routes_minimal(client):
    resp = client.get("/api/routes?limit=2")
    # Route blueprint should exist; tolerate 200 even if empty
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    # Expected JSON fallback shape
    assert "routes" in data
    assert "total" in data
    assert isinstance(data["routes"], list)


def test_route_geometry_endpoint_exists(client):
    # For a non-existent ID, endpoint should still reply with 200 and a message
    resp = client.get("/api/routes/999999/geometry")
    assert resp.status_code in (200, 400, 404)
    data = resp.get_json()
    assert isinstance(data, dict)


def test_list_routes_invalid_limit_returns_400(client):
    resp = client.get("/api/routes?limit=bad")
    assert resp.status_code == 400


def test_list_routes_negative_limit_returns_400(client):
    resp = client.get("/api/routes?limit=-1")
    assert resp.status_code == 400


def test_admin_routes_rejects_invalid_boolean(authed_client):
    resp = authed_client.get("/api/admin/routes?is_active=perhaps")
    assert resp.status_code == 400


def test_public_route_list_cannot_request_inactive_routes(client, monkeypatch):
    from app.routes import route as route_routes

    captured = {}

    def fake_list_routes(*args, **kwargs):
        captured.update(kwargs)
        return {
            "routes": [],
            "total": 0,
            "page": kwargs["page"],
            "total_pages": 0,
            "per_page": kwargs["limit"],
        }

    monkeypatch.setattr(route_routes.route_service, "list_routes", fake_list_routes)

    resp = client.get("/api/routes?is_active=false")

    assert resp.status_code == 200
    assert captured["is_active"] is True


def test_public_route_detail_requires_active_route(client, monkeypatch):
    from app.middleware.error_handler import APIError
    from app.routes import route as route_routes

    captured = {}

    def fake_get_route(route_id, require_active=False):
        captured["route_id"] = route_id
        captured["require_active"] = require_active
        raise APIError("Route not found", "NOT_FOUND", 404)

    monkeypatch.setattr(route_routes.route_service, "get_route", fake_get_route)

    resp = client.get("/api/routes/42")

    assert resp.status_code == 404
    assert captured == {"route_id": 42, "require_active": True}


def test_route_statistics_shape(client):
    resp = client.get("/api/routes/statistics")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    for key in ("total_routes", "active_routes", "inactive_routes", "by_type"):
        assert key in data


def test_route_import_progress_rejects_invalid_upload_id(authed_client):
    resp = authed_client.get("/api/routes/import/progress/not-a-uuid")
    assert resp.status_code == 400
