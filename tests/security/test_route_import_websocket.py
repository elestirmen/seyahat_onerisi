import importlib
import threading

import pytest

import route_import_websocket


STRONG_SECRET = "test-only-secret-key-with-at-least-32-characters"


def test_import_does_not_start_background_thread(monkeypatch) -> None:
    def fail_if_started(thread):
        raise AssertionError(f"import started thread {thread.name}")

    monkeypatch.setattr(threading.Thread, "start", fail_if_started)

    importlib.reload(route_import_websocket)


@pytest.mark.parametrize(
    ("secret_key", "environ"),
    [
        (None, {}),
        ("change-me", {}),
        ("change-me-but-long-enough-to-look-valid", {}),
        ("short", {}),
        (None, {"POI_SESSION_SECRET_KEY": "change-me"}),
    ],
)
def test_factory_rejects_missing_or_placeholder_secret(secret_key, environ) -> None:
    with pytest.raises(RuntimeError, match="secret key"):
        route_import_websocket.create_websocket_app(
            secret_key=secret_key,
            environ=environ,
        )


def test_factory_defaults_to_same_origin_without_credential_cors() -> None:
    app, socketio = route_import_websocket.create_websocket_app(
        secret_key=STRONG_SECRET,
        environ={},
    )

    response = app.test_client().get(
        "/websocket/health",
        headers={"Origin": "https://attacker.example"},
    )

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers
    assert "Access-Control-Allow-Credentials" not in response.headers
    assert socketio.server.eio.cors_allowed_origins is None


def test_factory_allows_only_explicit_noncredential_origin() -> None:
    app, socketio = route_import_websocket.create_websocket_app(
        secret_key=STRONG_SECRET,
        cors_origins=["https://ui.example"],
        environ={},
    )
    client = app.test_client()

    allowed = client.get(
        "/websocket/health",
        headers={"Origin": "https://ui.example"},
    )
    denied = client.get(
        "/websocket/health",
        headers={"Origin": "https://attacker.example"},
    )

    assert allowed.headers["Access-Control-Allow-Origin"] == "https://ui.example"
    assert "Access-Control-Allow-Credentials" not in allowed.headers
    assert "Access-Control-Allow-Origin" not in denied.headers
    assert socketio.server.eio.cors_allowed_origins == ["https://ui.example"]


def test_factory_rejects_wildcard_origin() -> None:
    with pytest.raises(ValueError, match="Wildcard"):
        route_import_websocket.create_websocket_app(
            secret_key=STRONG_SECRET,
            cors_origins="*",
            environ={},
        )


def test_status_event_never_exposes_temporary_file_path() -> None:
    upload_id = "5cafe37e-9bf7-4717-949a-35f5f64a0ca5"
    tracker = {
        upload_id: {
            "status": "uploading",
            "progress": 30,
            "temp_file_path": "/tmp/private-upload.gpx",
        }
    }
    app, socketio = route_import_websocket.create_websocket_app(
        progress_tracker=tracker,
        secret_key=STRONG_SECRET,
        environ={},
    )
    client = socketio.test_client(app)
    client.get_received()

    client.emit("get_upload_status", {"upload_id": upload_id})
    received = client.get_received()
    status_event = next(event for event in received if event["name"] == "upload_status")

    assert status_event["args"][0]["progress"] == {
        "status": "uploading",
        "progress": 30,
    }
    client.disconnect()


def test_run_server_uses_loopback_and_debug_off_by_default(monkeypatch) -> None:
    observed = {}
    tracker = {}
    lock = threading.Lock()

    class FakeSocketIO:
        def run(self, app, **kwargs):
            observed["app"] = app
            observed["run_kwargs"] = kwargs

    class FakeMonitorThread:
        def join(self, timeout):
            observed["join_timeout"] = timeout

    fake_socketio = FakeSocketIO()
    monkeypatch.setattr(
        route_import_websocket,
        "_load_legacy_progress_state",
        lambda: (tracker, lock),
    )

    def fake_factory(**kwargs):
        observed["factory_kwargs"] = kwargs
        return "app", fake_socketio

    monkeypatch.setattr(route_import_websocket, "create_websocket_app", fake_factory)
    monkeypatch.setattr(
        route_import_websocket,
        "start_progress_monitor_thread",
        lambda *args, **kwargs: FakeMonitorThread(),
    )

    route_import_websocket.run_websocket_server(
        environ={"POI_SESSION_SECRET_KEY": STRONG_SECRET}
    )

    assert observed["run_kwargs"] == {
        "host": "127.0.0.1",
        "port": 5506,
        "debug": False,
        "use_reloader": False,
        "allow_unsafe_werkzeug": True,
    }
    assert observed["factory_kwargs"]["secret_key"] == STRONG_SECRET
    assert observed["join_timeout"] == 6


def test_debug_mode_cannot_bind_to_public_interface(monkeypatch) -> None:
    monkeypatch.setattr(
        route_import_websocket,
        "_load_legacy_progress_state",
        lambda: pytest.fail("legacy state must not load for rejected configuration"),
    )

    with pytest.raises(ValueError, match="loopback"):
        route_import_websocket.run_websocket_server(
            host="0.0.0.0",
            debug=True,
            environ={"POI_SESSION_SECRET_KEY": STRONG_SECRET},
        )
