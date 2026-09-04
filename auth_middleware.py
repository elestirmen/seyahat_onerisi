"""
Admin protection middleware (stateless).

This project is deployed to the public internet. To keep things simple while still
safe, we protect all admin/write routes with a single shared token.

Clients must send one of:
- `X-Admin-Token: <token>`
- `Authorization: Bearer <token>`

Configure via environment variable: `POI_ADMIN_TOKEN`.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from functools import wraps
from urllib.parse import quote

from flask import jsonify, redirect, request

from auth_config import auth_config


logger = logging.getLogger(__name__)


class AuthMiddleware:
    """A lightweight auth layer based on a shared admin token."""

    def __init__(self, app=None):
        self.app = None
        self._failed_attempts = {}
        self._rate_limit_lock = threading.Lock()
        self.max_failed_attempts = self._positive_env_int(
            "ADMIN_LOGIN_MAX_ATTEMPTS", 5
        )
        self.failed_attempt_window = self._positive_env_int(
            "ADMIN_LOGIN_ATTEMPT_WINDOW_SECONDS", 900
        )
        if app is not None:
            self.init_app(app)

    @staticmethod
    def _positive_env_int(name, default):
        try:
            return max(1, int(os.environ.get(name, default)))
        except (TypeError, ValueError):
            return default

    def init_app(self, app):
        self.app = app
        app.after_request(self._after_request_handler)
        return app

    def _after_request_handler(self, response):
        try:
            security_headers = auth_config.get_security_headers()
            for header, value in security_headers.items():
                response.headers.setdefault(header, value)
        except Exception:
            pass

        path = request.path.lower()
        sensitive = (
            path.startswith("/api/")
            or path.startswith("/auth/")
            or path.startswith("/admin")
            or path.endswith("poi_manager_ui.html")
        )
        cacheable_asset = path.startswith("/static/") or path.endswith(
            (
                ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".webp",
                ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".mp3",
                ".mp4", ".webm", ".glb", ".gltf",
            )
        )
        if sensitive:
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        elif cacheable_asset and request.method in {"GET", "HEAD"} and response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=86400"
            response.headers.pop("Pragma", None)
            response.headers.pop("Expires", None)
        else:
            # Public HTML may be revalidated but is not pinned indefinitely.
            response.headers.setdefault("Cache-Control", "no-cache")
        return response

    def _extract_token(self):
        token = request.headers.get("X-Admin-Token")
        if token:
            token = token.strip()
            if token:
                return token

        authz = request.headers.get("Authorization") or ""
        if authz.lower().startswith("bearer "):
            token = authz[7:].strip()
            return token or None

        return None

    def is_authenticated(self) -> bool:
        token = self._extract_token()
        return auth_config.validate_admin_token(token)

    def get_client_ip(self):
        """Return the transport peer address without trusting raw proxy headers."""
        # Never consume X-Forwarded-For directly here. A reverse proxy should
        # enforce its own limits too; deployments may add a correctly scoped
        # ProxyFix only when the exact proxy hop count is known.
        return request.remote_addr or "unknown"

    def _wants_json(self) -> bool:
        if request.path.startswith("/api/"):
            return True

        accept = request.headers.get("Accept", "")
        if "application/json" in accept:
            return True

        if request.is_json:
            return True

        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return True

        return False

    def require_auth(self, f):
        """Decorator for routes that require admin token."""

        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Let CORS preflight through (Flask-CORS will attach headers).
            if request.method == "OPTIONS":
                return f(*args, **kwargs)

            if self.is_authenticated():
                return f(*args, **kwargs)

            if not auth_config.is_admin_token_configured():
                if self._wants_json():
                    return jsonify({"success": False, "error": "Admin token not configured"}), 503
                return (
                    "<h1>Service misconfigured</h1><p>POI_ADMIN_TOKEN is not set.</p>",
                    503,
                )

            if self._wants_json():
                return jsonify({"success": False, "error": "Authentication required"}), 401

            next_path = request.full_path or "/"
            if next_path.endswith("?"):
                next_path = next_path[:-1]
            return redirect(f"/auth/login?next={quote(next_path)}")

        return decorated_function

    # Compatibility methods (legacy code expects these names).
    def get_csrf_token(self):
        return ""

    def validate_csrf_token(self, token):
        # CSRF is not used in admin-token mode (no cookies).
        return True

    def get_session_info(self):
        return {"authenticated": self.is_authenticated(), "expires_at": None}

    def create_session(self, remember_me=False):
        # Cookie-backed admin sessions are intentionally disabled.
        # Admin authentication is header-token based only.
        return True

    def destroy_session(self):
        return True

    def check_rate_limit(self, ip_address):
        now = time.time()
        client_key = str(ip_address or "unknown")
        with self._rate_limit_lock:
            attempts = [
                timestamp
                for timestamp in self._failed_attempts.get(client_key, [])
                if now - timestamp < self.failed_attempt_window
            ]
            if attempts:
                self._failed_attempts[client_key] = attempts
            else:
                self._failed_attempts.pop(client_key, None)

            remaining = max(0, self.max_failed_attempts - len(attempts))
            if remaining == 0:
                retry_after = max(
                    1,
                    int(self.failed_attempt_window - (now - attempts[0])),
                )
                return False, 0, int(attempts[0] + self.failed_attempt_window), retry_after

            return True, remaining, None, 0

    def record_failed_attempt(self, ip_address, user_agent=None):
        now = time.time()
        client_key = str(ip_address or "unknown")
        with self._rate_limit_lock:
            attempts = [
                timestamp
                for timestamp in self._failed_attempts.get(client_key, [])
                if now - timestamp < self.failed_attempt_window
            ]
            attempts.append(now)
            self._failed_attempts[client_key] = attempts[-self.max_failed_attempts:]
        logger.warning("Failed admin login attempt from %s", client_key)

    def clear_failed_attempts(self, ip_address):
        client_key = str(ip_address or "unknown")
        with self._rate_limit_lock:
            self._failed_attempts.pop(client_key, None)

    def clear_all_rate_limits(self):
        with self._rate_limit_lock:
            self._failed_attempts.clear()


auth_middleware = AuthMiddleware()
