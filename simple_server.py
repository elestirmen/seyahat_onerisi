#!/usr/bin/env python3
"""Small, local-only frontend server with an API proxy.

Unlike ``SimpleHTTPRequestHandler``'s default behaviour, this module never
exposes the repository as a browsable document root.  Only explicitly listed
HTML entry points and frontend assets below approved directories are served.
"""

from __future__ import annotations

import argparse
import http.server
import os
from pathlib import Path
from typing import Mapping, Optional, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
import urllib.request


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DOCUMENT = "poi_recommendation_system.html"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8080
DEFAULT_API_BASE_URL = "http://127.0.0.1:5560"
MAX_PROXY_REQUEST_BODY_BYTES = 64 * 1024 * 1024

# Root-level files must be listed one by one.  Adding a new page is therefore
# an explicit security decision instead of silently publishing every HTML file
# (or secret) that happens to be added to the repository.
PUBLIC_ENTRY_FILES = frozenset(
    {
        "file_import_manager.html",
        "personal_routes.html",
        "policy.html",
        "poi_manager_enhanced.html",
        "poi_manager_ui.html",
        "poi_recommendation_system.html",
        "predefined_routes.html",
        "route_manager_enhanced.html",
        "route_manager_ui.html",
    }
)
PUBLIC_ASSET_DIRECTORIES = frozenset({"assets", "static"})
PUBLIC_ASSET_EXTENSIONS = frozenset(
    {
        ".css",
        ".gif",
        ".ico",
        ".jpeg",
        ".jpg",
        ".js",
        ".json",
        ".mjs",
        ".png",
        ".svg",
        ".ttf",
        ".webp",
        ".woff",
        ".woff2",
    }
)

FORWARDED_REQUEST_HEADERS = (
    "Accept",
    "Authorization",
    "Content-Type",
    "X-Admin-Token",
    "User-Agent",
)
HOP_BY_HOP_RESPONSE_HEADERS = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
    }
)


def resolve_public_file(request_target: str, public_root: Path = PROJECT_ROOT) -> Optional[Path]:
    """Resolve an allowlisted request target to a file, or return ``None``.

    The check is deliberately performed before ``SimpleHTTPRequestHandler``
    sees the path.  Encoded traversal, dotfiles, directory listings, backslash
    variants, and symlinks escaping the public root are all rejected.
    """

    try:
        parsed = urlsplit(request_target)
        if parsed.scheme or parsed.netloc:
            return None
        decoded_path = unquote(parsed.path, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return None

    if not decoded_path.startswith("/") or "\x00" in decoded_path or "\\" in decoded_path:
        return None

    if decoded_path == "/":
        relative_parts = [DEFAULT_DOCUMENT]
    else:
        raw_relative = decoded_path[1:]
        relative_parts = raw_relative.split("/")

    if not relative_parts or any(
        not part or part in {".", ".."} or part.startswith(".")
        for part in relative_parts
    ):
        return None

    relative_path = Path(*relative_parts)
    if len(relative_parts) == 1:
        if relative_parts[0] not in PUBLIC_ENTRY_FILES:
            return None
    else:
        if relative_parts[0] not in PUBLIC_ASSET_DIRECTORIES:
            return None
        if relative_path.suffix.lower() not in PUBLIC_ASSET_EXTENSIONS:
            return None

    root = Path(public_root).resolve()
    unresolved_candidate = root / relative_path
    candidate = unresolved_candidate.resolve()
    # Do not follow aliases: an apparently harmless ``static/foo.js`` symlink
    # must never be able to publish ``.env`` or a keystore elsewhere in the
    # repository.
    if candidate != unresolved_candidate:
        return None
    try:
        candidate.relative_to(root)
    except ValueError:
        return None

    if not candidate.is_file():
        return None
    return candidate


def _normalise_api_base_url(value: str) -> str:
    normalised = (value or "").strip()
    parsed = urlsplit(normalised)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("API base URL must be an absolute http(s) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("API base URL must not contain credentials, query, or fragment")
    if parsed.path not in {"", "/"}:
        raise ValueError("API base URL must not contain a path")
    return normalised.rstrip("/")


class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve allowlisted frontend files and proxy requests below ``/api/``."""

    public_root = PROJECT_ROOT
    api_base_url = DEFAULT_API_BASE_URL

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.public_root), **kwargs)

    def _request_path(self) -> Optional[str]:
        try:
            parsed = urlsplit(self.path)
        except ValueError:
            return None
        if parsed.scheme or parsed.netloc:
            return None
        return parsed.path

    def _is_api_request(self) -> bool:
        path = self._request_path()
        return path is not None and path.startswith("/api/")

    def _is_backend_get_request(self) -> bool:
        path = self._request_path()
        return path is not None and (
            path.startswith("/api/") or path.startswith("/poi_media/")
        )

    def _serve_public_file(self, *, include_body: bool) -> None:
        public_file = resolve_public_file(self.path, Path(self.public_root))
        if public_file is None:
            self.send_error(404, "File not found")
            return

        # The path has already been resolved and checked.  Passing its relative
        # URL back to the standard handler keeps correct MIME and length headers.
        relative_url = "/" + public_file.relative_to(Path(self.public_root).resolve()).as_posix()
        original_path = self.path
        self.path = relative_url
        try:
            response_file = self.send_head()
            if response_file is not None:
                try:
                    if include_body:
                        self.copyfile(response_file, self.wfile)
                finally:
                    response_file.close()
        finally:
            self.path = original_path

    def do_GET(self):
        if self._is_backend_get_request():
            self.proxy_api_request("GET")
            return
        self._serve_public_file(include_body=True)

    def do_HEAD(self):
        if self._is_backend_get_request():
            self.proxy_api_request("HEAD")
            return
        self._serve_public_file(include_body=False)

    def do_POST(self):
        if self._is_api_request():
            self.proxy_api_request("POST")
            return
        self.send_error(405, "Method not allowed")

    def list_directory(self, path):  # pragma: no cover - defence in depth
        self.send_error(404, "File not found")
        return None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    def proxy_api_request(self, method: str) -> None:
        """Proxy an API request to the explicitly configured backend."""

        try:
            api_url = f"{_normalise_api_base_url(self.api_base_url)}{self.path}"
            headers = {
                name: value
                for name in FORWARDED_REQUEST_HEADERS
                if (value := self.headers.get(name)) is not None
            }

            data = None
            if method == "POST":
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length < 0:
                    raise ValueError("Content-Length must not be negative")
                if content_length > MAX_PROXY_REQUEST_BODY_BYTES:
                    self.send_error(413, "Request body too large")
                    return
                if content_length > 0:
                    data = self.rfile.read(content_length)

            request = urllib.request.Request(api_url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(request, timeout=30) as response:
                self.send_response(response.status)
                for header_name, header_value in response.headers.items():
                    if header_name.lower() not in HOP_BY_HOP_RESPONSE_HEADERS:
                        self.send_header(header_name, header_value)
                self.end_headers()
                if method != "HEAD":
                    self.wfile.write(response.read())

        except HTTPError as exc:
            self.send_error(exc.code, f"API Error: {exc.reason}")
        except URLError:
            self.send_error(502, "API server not available")
        except (TypeError, ValueError):
            self.send_error(400, "Invalid proxy request")
        except Exception:
            self.send_error(500, "Proxy error")


def build_handler(
    public_root: Path = PROJECT_ROOT,
    api_base_url: str = DEFAULT_API_BASE_URL,
):
    """Return a handler class bound to an explicit root and backend URL."""

    root = Path(public_root).resolve()
    normalised_api_url = _normalise_api_base_url(api_base_url)

    class ConfiguredProxyHTTPRequestHandler(ProxyHTTPRequestHandler):
        pass

    ConfiguredProxyHTTPRequestHandler.public_root = root
    ConfiguredProxyHTTPRequestHandler.api_base_url = normalised_api_url
    return ConfiguredProxyHTTPRequestHandler


def run_server(
    port: int = DEFAULT_PORT,
    host: str = DEFAULT_HOST,
    *,
    public_root: Path = PROJECT_ROOT,
    api_base_url: str = DEFAULT_API_BASE_URL,
) -> None:
    """Run the frontend proxy, binding to loopback unless explicitly changed."""

    handler = build_handler(public_root=public_root, api_base_url=api_base_url)
    with http.server.ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Frontend proxy listening on http://{host}:{port}")
        print(f"Public entry point: http://{host}:{port}/{DEFAULT_DOCUMENT}")
        print(f"API proxy target: {_normalise_api_base_url(api_base_url)}/api/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped")


def _env_port(environ: Mapping[str, str]) -> int:
    raw_port = environ.get("SIMPLE_SERVER_PORT", str(DEFAULT_PORT))
    try:
        port = int(raw_port)
    except (TypeError, ValueError) as exc:
        raise ValueError("SIMPLE_SERVER_PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ValueError("SIMPLE_SERVER_PORT must be between 1 and 65535")
    return port


def main(argv: Optional[Sequence[str]] = None, environ: Optional[Mapping[str, str]] = None) -> int:
    environ = os.environ if environ is None else environ
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=environ.get("SIMPLE_SERVER_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=_env_port(environ))
    parser.add_argument(
        "--api-base-url",
        default=environ.get("SIMPLE_SERVER_API_BASE_URL", DEFAULT_API_BASE_URL),
    )
    args = parser.parse_args(argv)

    run_server(port=args.port, host=args.host, api_base_url=args.api_base_url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
