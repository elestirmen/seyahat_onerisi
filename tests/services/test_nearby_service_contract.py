from app.services.media_service import media_service
from app.services.poi_service import poi_service


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, *args, **kwargs):
        return None

    def fetchall(self):
        return self._rows


class _FakeConnection:
    def __init__(self, rows):
        self._rows = rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return _FakeCursor(self._rows)


def test_search_nearby_pois_normalizes_identity_and_distance(monkeypatch):
    rows = [
        {
            "id": 123,
            "name": "Test POI",
            "description": "Desc",
            "short_description": "",
            "category": "yemek",
            "altitude": None,
            "latitude": 38.63,
            "longitude": 34.91,
            "attributes": {},
            "is_active": True,
            "created_at": None,
            "updated_at": None,
            "distance_m": 42.3,
        }
    ]

    monkeypatch.setattr(poi_service, "_get_database_connection", lambda: _FakeConnection(rows), raising=False)

    payload = poi_service.search_nearby_pois(
        lat=38.63,
        lng=34.91,
        radius_m=500,
        limit=10,
        category="yemek",
        categories=[],
    )

    assert payload["count"] == 1
    item = payload["pois"][0]
    assert item["id"] == "123"
    assert item["_id"] == "123"
    assert item["poi_id"] == "123"
    assert item["stable_id"] == "123"
    assert item["distance_m"] == 42


def test_search_nearby_panoramas_normalizes_identity_and_distance(monkeypatch):
    monkeypatch.setattr(
        media_service,
        "_calculate_haversine_distance_m",
        lambda *args, **kwargs: 42.3,
        raising=False,
    )
    monkeypatch.setattr(
        media_service,
        "list_panoramas",
        lambda: {
            "panoramas": [
                {
                    "id": 7,
                    "caption": "Peri Bacalari 360",
                    "lat": 38.63,
                    "lng": 34.91,
                    "path": "poi_media/by_panorama/images/test.webp",
                }
            ]
        },
        raising=False,
    )
    monkeypatch.setattr(media_service, "list_route_panoramas", lambda: {"panoramas": []}, raising=False)

    payload = media_service.search_nearby_panoramas(
        lat=38.63,
        lng=34.91,
        radius_m=350,
        limit=5,
    )

    assert payload["count"] == 1
    item = payload["panoramas"][0]
    assert item["id"] == "panorama:7"
    assert item["_id"] == "panorama:7"
    assert item["stable_id"] == "panorama:7"
    assert item["alert_id"] == "panorama:7"
    assert item["distance_m"] == 42
