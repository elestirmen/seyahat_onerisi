from contextlib import contextmanager

from app.services.media_service import media_service


class _LegacyMediaManager:
    def __init__(self, items=None):
        self.items = items or []

    def get_poi_media_by_id(self, poi_id, media_type):
        return list(self.items)


class _Cursor:
    def __init__(self, rows):
        self.rows = rows
        self.query = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params):
        self.query = query
        self.params = params

    def fetchall(self):
        return list(self.rows)


class _Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


def test_get_poi_media_includes_external_database_images(monkeypatch):
    cursor = _Cursor(
        [
            {
                "image_url": "https://cdn.example.test/poi/42.jpg?size=large",
                "thumbnail_url": "https://cdn.example.test/poi/42-thumb.jpg",
                "caption": "Kapadokya",
                "is_primary": True,
            }
        ]
    )

    @contextmanager
    def connection():
        yield _Connection(cursor)

    monkeypatch.setattr(
        media_service, "_get_legacy_manager", lambda: _LegacyMediaManager()
    )
    monkeypatch.setattr(media_service, "_get_database_connection", connection)

    result = media_service.get_poi_media(42, "image")

    assert result == [
        {
            "poi_id": 42,
            "media_type": "image",
            "path": "https://cdn.example.test/poi/42.jpg?size=large",
            "preview_path": "https://cdn.example.test/poi/42-thumb.jpg",
            "file_path": "https://cdn.example.test/poi/42.jpg?size=large",
            "thumbnail_path": "https://cdn.example.test/poi/42-thumb.jpg",
            "filename": "42.jpg",
            "description": "Kapadokya",
            "caption": "Kapadokya",
            "is_primary": True,
            "source": "poi_images",
        }
    ]
    assert cursor.params == (42,)
    # JSON row access keeps this query compatible with schemas that do not yet
    # have an explicit image_url column.
    assert "to_jsonb(pi)->>'image_url'" in cursor.query


def test_get_poi_media_does_not_query_images_for_other_media_types(monkeypatch):
    monkeypatch.setattr(
        media_service,
        "_get_legacy_manager",
        lambda: _LegacyMediaManager(
            [{"media_type": "audio", "path": "poi_media/audio/guide.mp3"}]
        ),
    )

    def unexpected_connection():
        raise AssertionError("image database must not be queried for audio")

    monkeypatch.setattr(
        media_service, "_get_database_connection", unexpected_connection
    )

    result = media_service.get_poi_media(42, "audio")

    assert result == [
        {
            "media_type": "audio",
            "path": "poi_media/audio/guide.mp3",
            "poi_id": 42,
            "file_path": "poi_media/audio/guide.mp3",
            "thumbnail_path": None,
            "description": "",
        }
    ]
