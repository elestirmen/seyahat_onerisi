#!/usr/bin/env python3
"""Real-time route import progress service.

Importing this module is side-effect free.  The Flask application, Socket.IO
server, shared progress state, and monitor thread are created only through the
explicit factory/run entry points below.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import ipaddress
import logging
import os
import re
import threading
import time
from typing import Mapping, MutableMapping, Optional, Sequence
from urllib.parse import urlsplit

from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room


LOGGER = logging.getLogger(__name__)
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5506
DEFAULT_POLL_INTERVAL = 1.0
COMPLETED_UPLOAD_TTL_SECONDS = 300

SECRET_ENV_NAMES = ("POI_SESSION_SECRET_KEY", "SECRET_KEY")
INSECURE_SECRET_VALUES = frozenset(
    {
        "change-me",
        "changeme",
        "dev",
        "development",
        "secret",
        "your-secret-key",
    }
)
UPLOAD_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
PRIVATE_PROGRESS_FIELDS = frozenset({"temp_file_path"})


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_secret_key(
    secret_key: Optional[str] = None,
    environ: Optional[Mapping[str, str]] = None,
) -> str:
    """Return a strong, explicitly supplied Flask secret key."""

    environ = os.environ if environ is None else environ
    candidate = secret_key
    if candidate is None:
        candidate = next((environ.get(name) for name in SECRET_ENV_NAMES if environ.get(name)), None)

    if not candidate:
        names = " or ".join(SECRET_ENV_NAMES)
        raise RuntimeError(f"A secret key is required; set {names}")

    normalised = candidate.strip().lower()
    if (
        len(candidate) < 32
        or normalised in INSECURE_SECRET_VALUES
        or normalised.startswith(("change-me", "changeme"))
    ):
        raise RuntimeError("The WebSocket secret key must be at least 32 characters and not a placeholder")
    return candidate


def _parse_cors_origins(raw_origins: Optional[object]) -> tuple[str, ...]:
    """Validate explicit browser origins; an empty value means same-origin."""

    if raw_origins is None:
        return ()
    if isinstance(raw_origins, str):
        candidates = [item.strip() for item in raw_origins.split(",") if item.strip()]
    else:
        try:
            candidates = [str(item).strip() for item in raw_origins if str(item).strip()]
        except TypeError as exc:
            raise ValueError("CORS origins must be a comma-separated string or sequence") from exc

    validated = []
    for origin in candidates:
        if origin == "*":
            raise ValueError("Wildcard CORS origins are not allowed")
        try:
            parsed = urlsplit(origin)
            # Accessing ``port`` also rejects malformed values such as :abc.
            parsed.port
        except ValueError as exc:
            raise ValueError(f"Invalid CORS origin: {origin}") from exc
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in {"", "/"}
        ):
            raise ValueError(f"Invalid CORS origin: {origin}")
        canonical_origin = f"{parsed.scheme}://{parsed.netloc}"
        if canonical_origin not in validated:
            validated.append(canonical_origin)
    return tuple(validated)


def _public_progress(progress_data: object) -> object:
    """Remove server-only fields before returning progress to a client."""

    if not isinstance(progress_data, Mapping):
        return progress_data
    return {
        key: deepcopy(value)
        for key, value in progress_data.items()
        if key not in PRIVATE_PROGRESS_FIELDS
    }


def _valid_upload_id(data: object) -> Optional[str]:
    if not isinstance(data, Mapping):
        return None
    upload_id = data.get("upload_id")
    if not isinstance(upload_id, str) or not UPLOAD_ID_PATTERN.fullmatch(upload_id):
        return None
    return upload_id


def create_websocket_app(
    *,
    progress_tracker: Optional[MutableMapping[str, dict]] = None,
    progress_lock: Optional[threading.Lock] = None,
    secret_key: Optional[str] = None,
    cors_origins: Optional[object] = None,
    environ: Optional[Mapping[str, str]] = None,
) -> tuple[Flask, SocketIO]:
    """Create a configured Flask/Socket.IO pair without starting background work."""

    environ = os.environ if environ is None else environ
    tracker: MutableMapping[str, dict] = {} if progress_tracker is None else progress_tracker
    tracker_lock = threading.RLock() if progress_lock is None else progress_lock
    clients: dict[str, dict] = {}
    clients_lock = threading.Lock()

    resolved_secret = _resolve_secret_key(secret_key, environ)
    raw_origins = cors_origins
    if raw_origins is None:
        raw_origins = environ.get("WEBSOCKET_CORS_ORIGINS")
    allowed_origins = _parse_cors_origins(raw_origins)

    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=resolved_secret,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if allowed_origins:
        CORS(
            app,
            resources={r"/websocket/*": {"origins": list(allowed_origins)}},
            supports_credentials=False,
        )

    # This service does not use Flask sessions. Disabling Socket.IO's private
    # session copy avoids needless cookie state and remains compatible with
    # Flask versions whose request context exposes a read-only session.
    socketio_options = {"async_mode": "threading", "manage_session": False}
    if allowed_origins:
        socketio_options["cors_allowed_origins"] = list(allowed_origins)
    socketio = SocketIO(app, **socketio_options)

    @socketio.on("connect")
    def handle_connect(auth=None):
        del auth
        with clients_lock:
            clients[request.sid] = {
                "connected_at": _utc_timestamp(),
                "subscribed_uploads": set(),
            }
        emit(
            "connection_status",
            {
                "status": "connected",
                "message": "WebSocket bağlantısı kuruldu",
                "timestamp": _utc_timestamp(),
            },
        )

    @socketio.on("disconnect")
    def handle_disconnect():
        with clients_lock:
            clients.pop(request.sid, None)

    @socketio.on("subscribe_upload")
    def handle_subscribe_upload(data):
        upload_id = _valid_upload_id(data)
        if upload_id is None:
            emit(
                "error",
                {"error": "Geçerli Upload ID gerekli", "error_code": "INVALID_UPLOAD_ID"},
            )
            return

        join_room(f"upload_{upload_id}")
        with clients_lock:
            if request.sid in clients:
                clients[request.sid]["subscribed_uploads"].add(upload_id)
        with tracker_lock:
            current_progress = deepcopy(tracker.get(upload_id))

        if current_progress:
            emit(
                "upload_progress",
                {"upload_id": upload_id, "progress": _public_progress(current_progress)},
            )
        emit(
            "subscription_confirmed",
            {"upload_id": upload_id, "message": f"Upload {upload_id} takibine başlandı"},
        )

    @socketio.on("unsubscribe_upload")
    def handle_unsubscribe_upload(data):
        upload_id = _valid_upload_id(data)
        if upload_id is None:
            emit(
                "error",
                {"error": "Geçerli Upload ID gerekli", "error_code": "INVALID_UPLOAD_ID"},
            )
            return

        leave_room(f"upload_{upload_id}")
        with clients_lock:
            if request.sid in clients:
                clients[request.sid]["subscribed_uploads"].discard(upload_id)
        emit(
            "unsubscription_confirmed",
            {"upload_id": upload_id, "message": f"Upload {upload_id} takibi durduruldu"},
        )

    @socketio.on("get_upload_status")
    def handle_get_upload_status(data):
        upload_id = _valid_upload_id(data)
        if upload_id is None:
            emit(
                "error",
                {"error": "Geçerli Upload ID gerekli", "error_code": "INVALID_UPLOAD_ID"},
            )
            return

        with tracker_lock:
            progress_info = deepcopy(tracker.get(upload_id))
        payload = {
            "upload_id": upload_id,
            "progress": _public_progress(progress_info) if progress_info else None,
            "timestamp": _utc_timestamp(),
        }
        if progress_info is None:
            payload["message"] = "Upload bulunamadı"
        emit("upload_status", payload)

    @app.get("/websocket/health")
    def websocket_health():
        with clients_lock:
            client_count = len(clients)
        with tracker_lock:
            active_uploads = sum(
                1
                for progress in tracker.values()
                if isinstance(progress, Mapping)
                and progress.get("status") not in {"completed", "failed"}
            )
        return {
            "status": "healthy",
            "connected_clients": client_count,
            "active_uploads": active_uploads,
            "timestamp": _utc_timestamp(),
        }

    app.extensions["route_import_websocket"] = {
        "allowed_origins": allowed_origins,
        "clients": clients,
        "clients_lock": clients_lock,
        "progress_tracker": tracker,
        "progress_lock": tracker_lock,
    }
    return app, socketio


def broadcast_progress_update(
    socketio: SocketIO,
    upload_id: str,
    progress_data: object,
) -> None:
    """Broadcast a public progress snapshot to one upload room."""

    socketio.emit(
        "upload_progress",
        {
            "upload_id": upload_id,
            "progress": _public_progress(progress_data),
            "timestamp": _utc_timestamp(),
        },
        room=f"upload_{upload_id}",
    )


def start_progress_monitor(
    socketio: SocketIO,
    progress_tracker: MutableMapping[str, dict],
    progress_lock: threading.Lock,
    stop_event: threading.Event,
    poll_interval: float = DEFAULT_POLL_INTERVAL,
) -> None:
    """Monitor shared state until ``stop_event`` is set."""

    if poll_interval <= 0:
        raise ValueError("poll_interval must be positive")
    last_progress_state: dict[str, dict] = {}
    terminal_seen_at: dict[str, float] = {}

    while not stop_event.is_set():
        try:
            with progress_lock:
                current_progress = deepcopy(dict(progress_tracker))

            for upload_id, progress_data in current_progress.items():
                if last_progress_state.get(upload_id) != progress_data:
                    broadcast_progress_update(socketio, upload_id, progress_data)
                    last_progress_state[upload_id] = progress_data

            current_time = time.monotonic()
            active_ids = set(current_progress)
            for upload_id in set(last_progress_state) - active_ids:
                last_progress_state.pop(upload_id, None)
                terminal_seen_at.pop(upload_id, None)

            terminal_ids = {
                upload_id
                for upload_id, progress in current_progress.items()
                if isinstance(progress, Mapping)
                and progress.get("status") in {"completed", "failed"}
            }
            for upload_id in terminal_ids:
                terminal_seen_at.setdefault(upload_id, current_time)
            for upload_id in set(terminal_seen_at) - terminal_ids:
                terminal_seen_at.pop(upload_id, None)

            expired_ids = [
                upload_id
                for upload_id, first_seen in terminal_seen_at.items()
                if current_time - first_seen >= COMPLETED_UPLOAD_TTL_SECONDS
            ]
            if expired_ids:
                with progress_lock:
                    for upload_id in expired_ids:
                        progress_tracker.pop(upload_id, None)
                        last_progress_state.pop(upload_id, None)
                        terminal_seen_at.pop(upload_id, None)

            stop_event.wait(poll_interval)
        except Exception:
            LOGGER.exception("Progress monitor iteration failed")
            stop_event.wait(min(5.0, max(poll_interval, 0.1)))


def start_progress_monitor_thread(
    socketio: SocketIO,
    progress_tracker: MutableMapping[str, dict],
    progress_lock: threading.Lock,
    stop_event: threading.Event,
    poll_interval: float = DEFAULT_POLL_INTERVAL,
) -> threading.Thread:
    """Explicitly create and start the progress monitor thread."""

    thread = threading.Thread(
        target=start_progress_monitor,
        args=(socketio, progress_tracker, progress_lock, stop_event, poll_interval),
        name="route-import-progress-monitor",
        daemon=True,
    )
    thread.start()
    return thread


def _load_legacy_progress_state() -> tuple[MutableMapping[str, dict], threading.Lock]:
    """Load legacy API state only when the standalone service is started."""

    from poi_api import upload_progress, upload_progress_lock

    return upload_progress, upload_progress_lock


def _env_bool(value: Optional[str], *, name: str) -> bool:
    if value is None or not value.strip():
        return False
    normalised = value.strip().lower()
    if normalised in {"1", "true", "yes", "on"}:
        return True
    if normalised in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false")


def _validated_port(value: object) -> int:
    try:
        port = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("WebSocket port must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ValueError("WebSocket port must be between 1 and 65535")
    return port


def _is_loopback_host(host: str) -> bool:
    if host.strip().lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host.strip()).is_loopback
    except ValueError:
        return False


def run_websocket_server(
    *,
    host: Optional[str] = None,
    port: Optional[int] = None,
    debug: Optional[bool] = None,
    cors_origins: Optional[object] = None,
    environ: Optional[Mapping[str, str]] = None,
) -> None:
    """Run the standalone service with secure local-development defaults."""

    environ = os.environ if environ is None else environ
    resolved_host = (host or environ.get("WEBSOCKET_HOST") or DEFAULT_HOST).strip()
    if not resolved_host:
        raise ValueError("WebSocket host must not be empty")
    resolved_port = _validated_port(
        port if port is not None else environ.get("WEBSOCKET_PORT", DEFAULT_PORT)
    )
    resolved_debug = (
        _env_bool(environ.get("WEBSOCKET_DEBUG"), name="WEBSOCKET_DEBUG")
        if debug is None
        else bool(debug)
    )
    if resolved_debug and not _is_loopback_host(resolved_host):
        raise ValueError("Debug mode may only bind to a loopback address")

    resolved_secret = _resolve_secret_key(environ=environ)
    progress_tracker, progress_lock = _load_legacy_progress_state()
    app, socketio = create_websocket_app(
        progress_tracker=progress_tracker,
        progress_lock=progress_lock,
        secret_key=resolved_secret,
        cors_origins=cors_origins,
        environ=environ,
    )
    stop_event = threading.Event()
    monitor_thread = start_progress_monitor_thread(
        socketio,
        progress_tracker,
        progress_lock,
        stop_event,
    )
    try:
        socketio.run(
            app,
            host=resolved_host,
            port=resolved_port,
            debug=resolved_debug,
            use_reloader=False,
            allow_unsafe_werkzeug=True,
        )
    finally:
        stop_event.set()
        monitor_thread.join(timeout=6)


def main(
    argv: Optional[Sequence[str]] = None,
    environ: Optional[Mapping[str, str]] = None,
) -> int:
    environ = os.environ if environ is None else environ
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=None, help=f"bind address (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=None, help=f"listen port (default: {DEFAULT_PORT})")
    parser.add_argument(
        "--debug",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="enable Flask debug mode (loopback only)",
    )
    parser.add_argument(
        "--cors-origin",
        action="append",
        dest="cors_origins",
        default=None,
        help="explicit allowed browser origin; repeat for more than one",
    )
    args = parser.parse_args(argv)
    run_websocket_server(
        host=args.host,
        port=args.port,
        debug=args.debug,
        cors_origins=args.cors_origins,
        environ=environ,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
