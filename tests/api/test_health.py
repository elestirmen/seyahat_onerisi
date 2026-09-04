def test_livez_does_not_depend_on_database(client, monkeypatch):
    from app.routes import health as health_routes

    def fail_if_called():
        raise AssertionError("liveness must not call the database")

    monkeypatch.setattr(health_routes, "database_health_check", fail_if_called)

    resp = client.get("/livez")

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "alive"


def test_readyz_returns_200_when_database_is_healthy(client, monkeypatch):
    from app.routes import health as health_routes

    db_status = {
        "status": "healthy",
        "response_time_ms": 1.25,
        "database": {"host": "internal-db", "name": "poi"},
    }
    monkeypatch.setattr(health_routes, "database_health_check", lambda: db_status)

    resp = client.get("/readyz")

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ready"
    assert resp.get_json()["database"] == {
        "status": "healthy",
        "response_time_ms": 1.25,
    }


def test_readyz_returns_503_when_database_is_unhealthy(client, monkeypatch):
    from app.routes import health as health_routes

    db_status = {"status": "unhealthy", "error": "database unavailable"}
    monkeypatch.setattr(health_routes, "database_health_check", lambda: db_status)

    resp = client.get("/readyz")

    assert resp.status_code == 503
    assert resp.get_json()["status"] == "not_ready"
    assert resp.get_json()["database"] == {"status": "unhealthy"}


def test_health_stays_http_200_but_reports_unhealthy_database(client, monkeypatch):
    from app.routes import health as health_routes

    db_status = {"status": "unhealthy", "error": "database unavailable"}
    monkeypatch.setattr(health_routes, "database_health_check", lambda: db_status)

    resp = client.get("/health")

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "unhealthy"
    assert resp.get_json()["database"] == {"status": "unhealthy"}
