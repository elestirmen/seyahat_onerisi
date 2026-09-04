import poi_api


class _Database:
    def __init__(self):
        self.disconnected = False

    def disconnect(self):
        self.disconnected = True


def test_legacy_liveness_does_not_touch_database(monkeypatch):
    monkeypatch.setattr(
        poi_api,
        "get_db",
        lambda: (_ for _ in ()).throw(AssertionError("database must not be used")),
    )

    response = poi_api.app.test_client().get("/livez")

    assert response.status_code == 200
    assert response.get_json()["status"] == "alive"


def test_legacy_api_does_not_reflect_unconfigured_cross_origin():
    response = poi_api.app.test_client().get(
        "/livez", headers={"Origin": "https://attacker.example"}
    )

    assert "Access-Control-Allow-Origin" not in response.headers


def test_legacy_readiness_returns_503_without_database(monkeypatch):
    monkeypatch.setattr(poi_api, "JSON_FALLBACK", False)
    monkeypatch.setattr(poi_api, "get_db", lambda: None)

    response = poi_api.app.test_client().get("/readyz")

    assert response.status_code == 503
    assert response.get_json() == {
        "status": "not_ready",
        "timestamp": response.get_json()["timestamp"],
        "database": {"status": "unhealthy"},
    }


def test_legacy_readiness_disconnects_healthy_database(monkeypatch):
    database = _Database()
    monkeypatch.setattr(poi_api, "JSON_FALLBACK", False)
    monkeypatch.setattr(poi_api, "get_db", lambda: database)

    response = poi_api.app.test_client().get("/readyz")

    assert response.status_code == 200
    assert response.get_json()["status"] == "ready"
    assert database.disconnected is True


def test_legacy_database_failure_cannot_enable_json_fallback_by_default(monkeypatch):
    def fail_to_create(*args, **kwargs):
        raise RuntimeError("database offline")

    monkeypatch.setattr(
        poi_api.POIDatabaseFactory, "create_database", fail_to_create
    )
    monkeypatch.setattr(poi_api, "JSON_FALLBACK", False)
    monkeypatch.setattr(poi_api, "JSON_FALLBACK_ENABLED", False)

    assert poi_api.get_db() is None
    assert poi_api.JSON_FALLBACK is False


def test_legacy_nearby_accepts_private_json_body_and_filters_categories(monkeypatch):
    monkeypatch.setattr(poi_api, "JSON_FALLBACK", True)
    monkeypatch.setattr(
        poi_api,
        "load_test_data",
        lambda: {
            "museum": [
                {"id": 1, "name": "Museum", "lat": 38.63, "lng": 34.91}
            ],
            "food": [
                {"id": 2, "name": "Restaurant", "lat": 38.63, "lng": 34.91}
            ],
        },
    )

    response = poi_api.app.test_client().post(
        "/api/pois/nearby",
        json={
            "lat": 38.63,
            "lng": 34.91,
            "radius_m": 500,
            "categories": ["museum"],
        },
    )

    assert response.status_code == 200
    assert [item["category"] for item in response.get_json()["pois"]] == ["museum"]


def test_legacy_nearby_rejects_non_object_json_body():
    response = poi_api.app.test_client().post("/api/pois/nearby", json=[])

    assert response.status_code == 400
    assert response.get_json()["error"] == "Request body must be a JSON object"
