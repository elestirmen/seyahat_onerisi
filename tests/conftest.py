import os
import sys
import importlib
from pathlib import Path
from datetime import datetime, timezone
import secrets
import pytest

# Ensure project root is on sys.path (so 'app' package can be imported)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture()
def app(monkeypatch):
    os.environ.setdefault("FLASK_ENV", "testing")
    # Import the application module
    app_pkg = importlib.import_module("app")
    app_module = importlib.import_module("app.__init__")

    # Prevent real DB pool initialization during tests
    monkeypatch.setattr(app_module, "init_database_pool", lambda cfg: None, raising=False)

    flask_app = app_module.create_app("testing")
    yield flask_app


@pytest.fixture()
def client(app):
    return app.test_client()

@pytest.fixture()
def authed_client(client):
    # Simulate an authenticated session that passes AuthMiddleware checks
    with client.session_transaction() as sess:
        now = datetime.now(timezone.utc).isoformat()
        sess['authenticated'] = True
        sess['login_time'] = now
        sess['last_activity'] = now
        sess['remember_me'] = False
        sess['csrf_token'] = secrets.token_hex(16)
    return client
