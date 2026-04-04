def test_nearby_panoramas_requires_coordinates(client):
    resp = client.get("/api/panoramas/nearby")
    assert resp.status_code == 400


def test_nearby_panoramas_returns_payload(client, monkeypatch):
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
                    "distance_m": 42.3,
                    "path": "poi_media/by_panorama/images/test.webp",
                }
            ],
        }

    monkeypatch.setattr(media_service, "search_nearby_panoramas", _stub_nearby, raising=False)

    resp = client.get("/api/panoramas/nearby?lat=38.63&lng=34.91&radius_m=350&limit=5")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 1
    assert data["radius_m"] == 350
    assert data["panoramas"][0]["id"] == "panorama:test-1"
    assert data["panoramas"][0]["source_type"] == "standalone"


def test_nearby_panoramas_clamps_radius_and_limit(client, monkeypatch):
    from app.services import media_service

    def _stub_nearby(**kwargs):
        assert kwargs["radius_m"] == 50
        assert kwargs["limit"] == 100
        return {
            "center": {"lat": kwargs["lat"], "lng": kwargs["lng"]},
            "radius_m": kwargs["radius_m"],
            "count": 0,
            "panoramas": [],
        }

    monkeypatch.setattr(media_service, "search_nearby_panoramas", _stub_nearby, raising=False)

    resp = client.get("/api/panoramas/nearby?lat=38.63&lng=34.91&radius_m=5&limit=999")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["radius_m"] == 50


def test_nearby_panoramas_rejects_invalid_limit(client):
    resp = client.get("/api/panoramas/nearby?lat=38.63&lng=34.91&limit=invalid")
    assert resp.status_code == 400
