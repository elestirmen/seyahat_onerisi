from pathlib import Path

import pytest

import simple_server


@pytest.fixture
def public_root(tmp_path: Path) -> Path:
    (tmp_path / simple_server.DEFAULT_DOCUMENT).write_text("home", encoding="utf-8")
    (tmp_path / "personal_routes.html").write_text("routes", encoding="utf-8")
    (tmp_path / "policy.html").write_text("privacy", encoding="utf-8")
    (tmp_path / "static" / "js").mkdir(parents=True)
    (tmp_path / "static" / "js" / "app.js").write_text("ok", encoding="utf-8")
    (tmp_path / ".env").write_text("SECRET=do-not-publish", encoding="utf-8")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("private", encoding="utf-8")
    (tmp_path / "release.keystore").write_text("private", encoding="utf-8")
    return tmp_path


@pytest.mark.parametrize(
    ("request_target", "expected_relative_path"),
    [
        ("/", simple_server.DEFAULT_DOCUMENT),
        ("/personal_routes.html?view=compact", "personal_routes.html"),
        ("/policy.html", "policy.html"),
        ("/static/js/app.js?v=1", "static/js/app.js"),
    ],
)
def test_resolve_public_file_allows_only_declared_frontend_files(
    public_root: Path,
    request_target: str,
    expected_relative_path: str,
) -> None:
    resolved = simple_server.resolve_public_file(request_target, public_root)

    assert resolved == public_root / expected_relative_path


@pytest.mark.parametrize(
    "request_target",
    [
        "/.env",
        "/.git/config",
        "/release.keystore",
        "/static/",
        "/static/.hidden.js",
        "/static/js/../../.env",
        "/static/js/%2e%2e/%2e%2e/.env",
        "/static\\..\\.env",
        "//example.test/.env",
        "https://example.test/static/js/app.js",
    ],
)
def test_resolve_public_file_rejects_secrets_dotfiles_and_traversal(
    public_root: Path,
    request_target: str,
) -> None:
    assert simple_server.resolve_public_file(request_target, public_root) is None


def test_resolve_public_file_does_not_follow_symlink_to_repository_secret(
    public_root: Path,
) -> None:
    link = public_root / "static" / "js" / "secret.js"
    try:
        link.symlink_to(public_root / ".env")
    except (NotImplementedError, OSError):
        pytest.skip("symlinks are not available on this platform")

    assert simple_server.resolve_public_file("/static/js/secret.js", public_root) is None


def test_run_server_binds_to_loopback_by_default(monkeypatch, public_root: Path) -> None:
    observed = {}

    class FakeServer:
        def __init__(self, address, handler):
            observed["address"] = address
            observed["handler"] = handler

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def serve_forever(self):
            observed["served"] = True

    monkeypatch.setattr(simple_server.http.server, "ThreadingHTTPServer", FakeServer)

    simple_server.run_server(public_root=public_root)

    assert observed["address"] == ("127.0.0.1", 8080)
    assert observed["served"] is True


@pytest.mark.parametrize(
    ("target", "expected"),
    [
        ("/api/pois?limit=1", True),
        ("/poi_media/by_route_id/photo.webp", True),
        ("/policy.html", False),
        ("https://attacker.example/api/pois", False),
    ],
)
def test_backend_get_proxy_scope(target: str, expected: bool) -> None:
    handler = object.__new__(simple_server.ProxyHTTPRequestHandler)
    handler.path = target

    assert handler._is_backend_get_request() is expected


def test_proxy_rejects_oversized_request_before_reading_body() -> None:
    handler = object.__new__(simple_server.ProxyHTTPRequestHandler)
    handler.path = "/api/import"
    handler.api_base_url = "http://127.0.0.1:5560"
    handler.headers = {
        "Content-Length": str(simple_server.MAX_PROXY_REQUEST_BODY_BYTES + 1),
        "Content-Type": "application/octet-stream",
    }
    observed = {}
    handler.send_error = lambda status, message: observed.update(
        status=status, message=message
    )

    class UnreadableBody:
        def read(self, size=-1):
            raise AssertionError("oversized request body must not be read")

    handler.rfile = UnreadableBody()

    handler.proxy_api_request("POST")

    assert observed == {"status": 413, "message": "Request body too large"}
