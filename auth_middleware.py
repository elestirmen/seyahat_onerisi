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
from functools import wraps
from urllib.parse import quote

from flask import jsonify, redirect, request

from auth_config import auth_config


logger = logging.getLogger(__name__)


class AuthMiddleware:
    """A lightweight auth layer based on a shared admin token."""

    def __init__(self, app=None):
        self.app = None
        if app is not None:
            self.init_app(app)

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
        return True, 0, None, 0

    def record_failed_attempt(self, ip_address, user_agent=None):
        return None

    def clear_failed_attempts(self, ip_address):
        return None


auth_middleware = AuthMiddleware()
