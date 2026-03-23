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
