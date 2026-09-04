from contextlib import contextmanager

from app.services.poi_service import poi_service
from app.services.recommendation_service import RecommendationService


class _Cursor:
    def __init__(self):
        self.query = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        self.query = query
        self.params = params

    def fetchall(self):
        return []


class _Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


def test_recommendation_candidates_only_include_active_pois(monkeypatch):
    cursor = _Cursor()

    @contextmanager
    def connection():
        yield _Connection(cursor)

    monkeypatch.setattr(poi_service, "_get_database_connection", connection)

    service = RecommendationService()
    assert service._load_pois_with_ratings() == []
    assert "p.is_active = TRUE" in cursor.query
    assert "LIMIT %s" in cursor.query
    assert cursor.params == (service.candidate_limit,)
