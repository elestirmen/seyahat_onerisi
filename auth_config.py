"""
Authentication / admin protection configuration.

This project is deployed to the public internet. Admin/write operations are protected
with a single shared admin token sent via request headers:

- `X-Admin-Token: <token>`
- `Authorization: Bearer <token>`

Configure the token via environment variable: `POI_ADMIN_TOKEN`.
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any, Dict, Optional

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]


logger = logging.getLogger(__name__)

if load_dotenv:
    load_dotenv()


class AuthConfig:
    """Lightweight configuration for admin-token auth + security headers."""

    def get_admin_token(self) -> Optional[str]:
        token = (os.getenv("POI_ADMIN_TOKEN") or "").strip()
        return token or None

    def is_admin_token_configured(self) -> bool:
        return bool(self.get_admin_token())

    def validate_admin_token(self, token: Optional[str]) -> bool:
        expected = self.get_admin_token()
        if not expected:
            return False

        if not token:
            return False

        candidate = token.strip()
        if not candidate:
            return False

        try:
            return secrets.compare_digest(candidate, expected)
        except Exception:
            return False

    def get_security_headers(self) -> Dict[str, str]:
        """Return a set of security headers to apply to all responses."""
        return {
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            # The public shell embeds same-origin route pages in iframes.
            "X-Frame-Options": "SAMEORIGIN",
            # Enable XSS protection (legacy but still useful)
            "X-XSS-Protection": "1; mode=block",
            # Force HTTPS (only if running on HTTPS)
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
            # Content Security Policy - restrictive but functional for the POI app
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
                "img-src 'self' data: blob: https://*.openstreetmap.org https://*.tile.openstreetmap.org https://*.opentopomap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://unpkg.com; "
                "font-src 'self' https://cdnjs.cloudflare.com; "
                "connect-src 'self' https://*.openstreetmap.org https://*.tile.openstreetmap.org https://*.opentopomap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://api.open-elevation.com https://router.project-osrm.org; "
                "media-src 'self'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            ),
            # Referrer policy for privacy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            # Permissions policy (formerly Feature Policy)
            "Permissions-Policy": (
                "geolocation=(self), microphone=(), camera=(), payment=(), usb=(), "
                "magnetometer=(), gyroscope=(), accelerometer=()"
            ),
            # Cache control for sensitive pages
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }


auth_config = AuthConfig()
