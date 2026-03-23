from io import BytesIO
from pathlib import Path

import pytest
from werkzeug.datastructures import FileStorage

from app.middleware.error_handler import APIError
from app.services.media_service import media_service
from app.services.route_service import route_service


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc`\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_route_media_files_are_cleaned_up_when_db_write_fails(monkeypatch):
    route_id = 909999
    route_dir = Path("poi_media") / "route_media" / str(route_id)

    class FailingCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, *args, **kwargs):
            raise RuntimeError("db insert failed")

        def fetchone(self):
            return None

    class FailingConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return FailingCursor()

    def fake_generate_thumbnail(source_path):
        source = Path(source_path)
        thumb_path = source.with_name(f"{source.stem}_thumb{source.suffix}")
        thumb_path.write_bytes(b"thumb")
        return str(thumb_path)

    monkeypatch.setattr(route_service, "_get_database_connection", lambda: FailingConnection())
    monkeypatch.setattr(media_service, "generate_thumbnail", fake_generate_thumbnail)

    upload = FileStorage(
        stream=BytesIO(PNG_BYTES),
        filename="valid.png",
        content_type="image/png",
    )

    with pytest.raises(APIError) as excinfo:
        route_service.add_route_media(route_id, upload, None, None, None)

    assert excinfo.value.code == "ROUTE_MEDIA_UPLOAD_ERROR"
    assert not route_dir.exists() or not any(route_dir.iterdir())

    if route_dir.exists() and not any(route_dir.iterdir()):
        route_dir.rmdir()
