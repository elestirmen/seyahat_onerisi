def test_nearby_pois_contract_supports_multi_select_categories(client, monkeypatch):
    from app.services import poi_service

    def _stub_nearby(**kwargs):
        assert kwargs["lat"] == 38.63
        assert kwargs["lng"] == 34.91
        assert kwargs["radius_m"] == 1250
        assert kwargs["limit"] == 8
        assert kwargs["category"] is None
        assert kwargs["categories"] == ["yemek", "doga", "spor"]
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 1,
            "category": kwargs["category"],
            "categories": kwargs["categories"],
            "pois": [
                {
                    "id": "poi-1",
                    "_id": "poi-1",
                    "name": "Test POI",
                    "category": "yemek",
                    "latitude": 38.6305,
                    "longitude": 34.9105,
                    "distance_m": 87,
                }
            ],
        }

    monkeypatch.setattr(poi_service, "search_nearby_pois", _stub_nearby, raising=False)

    resp = client.get(
        "/api/pois/nearby?lat=38.63&lng=34.91&radius_m=1250.4&limit=8"
        "&category=ignored&categories=yemek,doga&categories[]=spor&categories=yemek"
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["center"] == {"lat": 38.63, "lng": 34.91}
    assert data["radius_m"] == 1250
    assert data["count"] == 1
    assert data["category"] is None
    assert data["categories"] == ["yemek", "doga", "spor"]
    assert data["pois"][0]["_id"] == "poi-1"
    assert data["pois"][0]["distance_m"] == 87


def test_nearby_pois_rejects_out_of_range_coordinates(client):
    resp = client.get("/api/pois/nearby?lat=91&lng=34.91")
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["error"] == "lat/lng out of range"
    assert data["code"] == "BAD_REQUEST"


def test_nearby_panoramas_contract_preserves_expected_shape(client, monkeypatch):
    from app.services import media_service

    def _stub_nearby(**kwargs):
        assert kwargs["lat"] == 38.63
        assert kwargs["lng"] == 34.91
        assert kwargs["radius_m"] == 350
        assert kwargs["limit"] == 5
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 1,
            "panoramas": [
                {
                    "id": "panorama:test-1",
                    "_id": "panorama:test-1",
                    "name": "Peri Bacalari 360",
                    "caption": "Peri Bacalari 360",
                    "entity_type": "panorama",
                    "source_type": "standalone",
                    "lat": 38.6301,
                    "lng": 34.9102,
                    "distance_m": 42,
                    "path": "poi_media/by_panorama/images/test.webp",
                }
            ],
        }

    monkeypatch.setattr(media_service, "search_nearby_panoramas", _stub_nearby, raising=False)

    resp = client.get("/api/panoramas/nearby?lat=38.63&lng=34.91&radius_m=350&limit=5")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["center"] == {"lat": 38.63, "lng": 34.91}
    assert data["radius_m"] == 350
    assert data["count"] == 1
    assert data["panoramas"][0]["id"] == "panorama:test-1"
    assert data["panoramas"][0]["source_type"] == "standalone"
    assert data["panoramas"][0]["distance_m"] == 42


def test_nearby_panoramas_rejects_out_of_range_coordinates(client):
    resp = client.get("/api/panoramas/nearby?lat=38.63&lng=181")
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["error"] == "lat/lng out of range"
