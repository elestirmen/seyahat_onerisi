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

