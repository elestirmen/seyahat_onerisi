import pytest
from flask import Flask

from app.config.settings import ProductionConfig
from app.middleware.error_handler import ErrorHandler


def test_production_config_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv("POI_ADMIN_TOKEN", "test-admin-token-that-is-long-enough")
    monkeypatch.setenv("POI_SESSION_SECRET_KEY", "test-session-secret-that-is-long-enough")
    monkeypatch.setenv("POI_DB_PASSWORD", "test-database-password")
    monkeypatch.setenv("DB_PASSWORD", "test-database-password")
    monkeypatch.setattr(ProductionConfig, "CORS_ORIGINS", "*")

    app = Flask(__name__)
    app.config.from_object(ProductionConfig)

    with pytest.raises(ValueError, match="Wildcard CORS_ORIGINS"):
        ProductionConfig.init_app(app)


def test_debug_errors_do_not_echo_headers_query_or_tracebacks():
    app = Flask(__name__)
    app.config.update(TESTING=False, DEBUG=True)
    ErrorHandler(app)

    @app.get("/explode")
    def explode():
        raise RuntimeError("internal-secret-value")

    response = app.test_client().get(
        "/explode?lat=38.63&lng=34.91",
        headers={"X-Admin-Token": "admin-secret-value"},
    )
    body = response.get_json()

    assert response.status_code == 500
    assert body["error"] == "An unexpected error occurred"
    serialized = str(body)
    assert "internal-secret-value" not in serialized
    assert "admin-secret-value" not in serialized
    assert "38.63" not in serialized
    assert "traceback" not in serialized.lower()
