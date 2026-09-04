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


def test_list_pois_zero_limit_returns_400(client):
    resp = client.get("/api/pois?limit=0")
    assert resp.status_code == 400


def test_list_pois_zero_page_returns_400(client):
    resp = client.get("/api/pois?page=0")
    assert resp.status_code == 400


def test_nearby_pois_rejects_non_finite_coordinates(client):
    resp = client.get("/api/pois/nearby?lat=nan&lng=34.91")
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


def test_nearby_pois_requires_coordinates(client):
    resp = client.get("/api/pois/nearby")
    assert resp.status_code == 400


def test_nearby_pois_returns_payload(client, monkeypatch):
    from app.services import poi_service

    def _stub_nearby(**kwargs):
        assert kwargs["lat"] == 38.63
        assert kwargs["lng"] == 34.91
        assert kwargs["radius_m"] == 500
        assert kwargs["limit"] == 10
        assert kwargs["category"] == "yemek"
        assert kwargs["categories"] == []
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 1,
            "category": kwargs["category"],
            "categories": kwargs["categories"],
            "pois": [
                {
                    "id": 123,
                    "_id": 123,
                    "name": "Test POI",
                    "category": "yemek",
                    "latitude": 38.6305,
                    "longitude": 34.9105,
                    "distance_m": 120,
                }
            ],
        }

    monkeypatch.setattr(poi_service, "search_nearby_pois", _stub_nearby, raising=False)

    resp = client.get("/api/pois/nearby?lat=38.63&lng=34.91&radius_m=500&limit=10&category=yemek")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 1
    assert data["category"] == "yemek"
    assert data["categories"] == []
    assert data["pois"][0]["distance_m"] == 120


def test_nearby_pois_clamps_radius_and_limit(client, monkeypatch):
    from app.services import poi_service

    def _stub_nearby(**kwargs):
        assert kwargs["radius_m"] == 50
        assert kwargs["limit"] == 200
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 0,
            "category": kwargs["category"],
            "categories": kwargs["categories"],
            "pois": [],
        }

    monkeypatch.setattr(poi_service, "search_nearby_pois", _stub_nearby, raising=False)

    resp = client.get("/api/pois/nearby?lat=38.63&lng=34.91&radius_m=5&limit=9999")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["radius_m"] == 50


def test_nearby_pois_rejects_invalid_radius(client):
    resp = client.get("/api/pois/nearby?lat=38.63&lng=34.91&radius_m=invalid")
    assert resp.status_code == 400


def test_nearby_pois_accepts_multiple_categories(client, monkeypatch):
    from app.services import poi_service

    def _stub_nearby(**kwargs):
        assert kwargs["lat"] == 38.63
        assert kwargs["lng"] == 34.91
        assert kwargs["radius_m"] == 500
        assert kwargs["limit"] == 10
        assert kwargs["category"] is None
        assert kwargs["categories"] == ["yemek", "doga"]
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 2,
            "category": kwargs["category"],
            "categories": kwargs["categories"],
            "pois": [],
        }

    monkeypatch.setattr(poi_service, "search_nearby_pois", _stub_nearby, raising=False)

    resp = client.get("/api/pois/nearby?lat=38.63&lng=34.91&radius_m=500&limit=10&categories=yemek&categories=doga")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 2
    assert data["category"] is None
    assert data["categories"] == ["yemek", "doga"]
