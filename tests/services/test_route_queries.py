import pytest

from app.middleware.error_handler import APIError
from app.services.route_service import RouteService


class RecordingCursor:
    def __init__(self, row=None, rows=None, hide_inactive_when_filtered=False):
        self.row = row
        self.rows = rows or []
        self.hide_inactive_when_filtered = hide_inactive_when_filtered
        self.executions = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def execute(self, query, params=None):
        self.executions.append((query, params))

    def fetchone(self):
        query = self.executions[-1][0]
        if self.hide_inactive_when_filtered and "is_active = true" in query:
            return None
        return self.row

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


class FakeConnectionContext:
    def __init__(self, cursor):
        self._connection = FakeConnection(cursor)

    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc_value, traceback):
        return False


def _route_schema():
    return {
        "id": "int4",
        "name": "varchar",
        "description": "text",
        "route_type": "varchar",
        "is_active": "bool",
    }


def test_get_route_can_require_active_record(monkeypatch):
    service = RouteService()
    inactive = {
        "id": 7,
        "name": "Archived route",
        "description": "",
        "route_type": "walking",
        "is_active": False,
    }
    cursor = RecordingCursor(row=inactive, hide_inactive_when_filtered=True)
    monkeypatch.setattr(service, "_get_database_connection", lambda: FakeConnectionContext(cursor))
    monkeypatch.setattr(service, "_get_table_schema", lambda conn, table_name: _route_schema())

    with pytest.raises(APIError) as exc_info:
        service.get_route(7, require_active=True)

    assert exc_info.value.status_code == 404
    assert "WHERE id = %s AND is_active = true" in cursor.executions[0][0]

    result = service.get_route(7, require_active=False)
    assert result["id"] == 7
    assert result["is_active"] is False
    assert "is_active = true" not in cursor.executions[1][0]


def test_search_route_type_parameters_follow_sql_placeholder_order(monkeypatch):
    service = RouteService()
    cursor = RecordingCursor(rows=[])
    monkeypatch.setattr(service, "_get_database_connection", lambda: FakeConnectionContext(cursor))
    monkeypatch.setattr(service, "_get_table_schema", lambda conn, table_name: _route_schema())

    result = service._search_routes_database("valley", "hiking", 25)

    query, params = cursor.executions[0]
    normalized_query = " ".join(query.split())
    assert "is_active = true AND route_type = %s AND (name ILIKE %s OR description ILIKE %s)" in normalized_query
    assert params == ["hiking", "%valley%", "%valley%", "%valley%", 25]
    assert result == {"results": [], "total": 0, "query": "valley"}


def test_find_nearby_pois_uses_native_postgis_with_ordered_parameters(monkeypatch):
    service = RouteService()
    cursor = RecordingCursor(
        rows=[
            {
                "id": 12,
                "name": "Viewpoint",
                "category": "scenic",
                "description": "",
                "lat": 38.631,
                "lon": 34.912,
                "distance_meters": "42.345",
                "closest_lat": "38.6309",
                "closest_lng": "34.9119",
            }
        ]
    )
    schemas = {
        "routes": {"route_geometry": "geography"},
        "pois": {"location": "geography", "is_active": "bool"},
        "route_pois": {"route_id": "int4", "poi_id": "int4"},
        "route_poi_associations": {},
    }
    route = {
        "id": 7,
        "geometry": {
            "type": "LineString",
            "coordinates": [[34.91, 38.63], [34.92, 38.64]],
        },
        "waypoints": [],
    }

    monkeypatch.setattr(service, "get_route", lambda route_id: route)
    monkeypatch.setattr(service, "_get_database_connection", lambda: FakeConnectionContext(cursor))
    monkeypatch.setattr(service, "_get_table_schema", lambda conn, table_name: schemas[table_name])
    monkeypatch.setattr(
        service,
        "_distance_to_polyline",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("Python fallback should not run")),
    )

    result = service.find_nearby_pois(7, "250")

    query, params = cursor.executions[0]
    normalized_query = " ".join(query.split())
    assert "ST_DWithin(r.route_geometry, p.location, %s)" in normalized_query
    assert "ST_Distance(r.route_geometry, p.location)" in normalized_query
    assert "rp.route_id = r.id AND rp.poi_id = p.id" in normalized_query
    assert params == [7, 250.0]
    assert result == [
        {
            "id": 12,
            "name": "Viewpoint",
            "category": "scenic",
            "description": "",
            "lat": 38.631,
            "lon": 34.912,
            "distance_meters": 42.34,
            "closest_route_point": {"lat": 38.6309, "lng": 34.9119},
        }
    ]


def test_find_nearby_pois_bounds_legacy_schema_candidates(monkeypatch):
    service = RouteService()
    cursor = RecordingCursor(
        rows=[
            {
                "id": 21,
                "name": "Legacy POI",
                "category": "historic",
                "description": "",
                "lat": 38.63,
                "lon": 34.91,
            }
        ]
    )
    schemas = {
        "routes": {"geometry": "jsonb"},
        "pois": {"location": "geography", "is_active": "bool"},
        "route_pois": {},
        "route_poi_associations": {"route_id": "int4", "poi_id": "int4"},
    }
    calls = {"get_route": 0}

    def get_route(route_id):
        calls["get_route"] += 1
        return {
            "id": route_id,
            "geometry": None,
            "waypoints": [
                {"lat": 38.63, "lng": 34.91},
                {"lat": 38.631, "lng": 34.911},
            ],
        }

    monkeypatch.setattr(service, "get_route", get_route)
    monkeypatch.setattr(service, "_get_database_connection", lambda: FakeConnectionContext(cursor))
    monkeypatch.setattr(service, "_get_table_schema", lambda conn, table_name: schemas[table_name])
    monkeypatch.setattr(
        service,
        "get_route_geometry",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("duplicate route read")),
    )
    monkeypatch.setattr(
        service,
        "get_route_pois",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("association read should be in SQL")),
    )
    monkeypatch.setattr(
        service,
        "_list_active_pois_with_location",
        lambda: (_ for _ in ()).throw(AssertionError("unbounded POI load")),
    )

    result = service.find_nearby_pois(8, 100)

    query, params = cursor.executions[0]
    normalized_query = " ".join(query.split())
    assert "ST_Y(p.location::geometry) BETWEEN %s AND %s" in normalized_query
    assert "ST_X(p.location::geometry) BETWEEN %s AND %s" in normalized_query
    assert "rpa.route_id = %s AND rpa.poi_id = p.id" in normalized_query
    assert params[0] < params[1]
    assert params[2] < params[3]
    assert params[4:] == [8, 500]
    assert calls == {"get_route": 1}
    assert result[0]["id"] == 21
    assert result[0]["distance_meters"] == 0.0
