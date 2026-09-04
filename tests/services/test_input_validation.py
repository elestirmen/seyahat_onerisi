import pytest

from app.middleware.error_handler import APIError
from app.services.poi_service import poi_service
from app.services.route_service import route_service
from app.utils.validation import parse_bool, parse_coordinates


def test_false_string_is_not_treated_as_true():
    assert parse_bool("false", "is_active") is False
    assert route_service._coerce_bool("false") is False


def test_invalid_boolean_is_rejected():
    with pytest.raises(APIError) as excinfo:
        parse_bool("sometimes", "is_active")

    assert excinfo.value.status_code == 400


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [
        ("nan", 34.9),
        (38.6, "inf"),
        (91, 34.9),
        (38.6, -181),
    ],
)
def test_coordinates_must_be_finite_and_in_range(latitude, longitude):
    with pytest.raises(APIError) as excinfo:
        parse_coordinates(latitude, longitude)

    assert excinfo.value.status_code == 400


def test_create_poi_normalizes_boolean_and_coordinates(monkeypatch):
    captured = {}

    def fake_create(payload):
        captured.update(payload)
        return payload

    monkeypatch.setattr(poi_service, "_create_poi_database", fake_create)

    result = poi_service.create_poi(
        {
            "name": "Test POI",
            "latitude": "38.6",
            "longitude": "34.9",
            "is_active": "false",
        }
    )

    assert result["latitude"] == 38.6
    assert result["longitude"] == 34.9
    assert result["is_active"] is False
    assert captured == result
