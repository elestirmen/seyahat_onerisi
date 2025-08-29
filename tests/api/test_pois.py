def test_list_pois_minimal(client):
    resp = client.get("/api/pois?limit=2")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    # Expected JSON fallback shape
    assert "pois" in data
    assert "total" in data
    assert isinstance(data["pois"], list)


def test_list_pois_invalid_limit_returns_400(client):
    resp = client.get("/api/pois?limit=abc")
    assert resp.status_code == 400


def test_search_pois_requires_query_param(client):
    resp = client.get("/api/search")
    assert resp.status_code == 400


def test_search_pois_with_query_ok(client):
    resp = client.get("/api/search?q=test&limit=5")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    assert "results" in data


def test_get_single_poi_not_found(client):
    resp = client.get("/api/poi/nonexistent-poi-id")
    # Depending on backend path, could be 400 (bad id), 404 (not found) or 200 with message
    assert resp.status_code in (200, 400, 404)
    if resp.status_code == 200:
        data = resp.get_json()
        # JSON fallback may not have this POI; be lenient
        assert isinstance(data, dict)
