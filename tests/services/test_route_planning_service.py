import pytest

from app.middleware.error_handler import APIError
from app.services.route_planning_service import RoutePlanningService


def test_smart_route_is_honest_about_straight_line_preview():
    service = RoutePlanningService()

    result = service.create_route(
        [
            {"lat": "38.631", "lng": "34.913", "name": "Başlangıç"},
            {"lat": "38.632", "lng": "34.914", "name": "Bitiş"},
        ],
        "smart",
    )

    assert result["success"] is True
    assert result["fallback_used"] is True
    assert result["approximate"] is True
    assert result["routing_provider"] == "straight_line_preview"
    assert result["route"]["geometry_accuracy"] == "approximate"
    assert result["route"]["network_type"] == "walking"
    assert result["route"]["coordinates"][0] == [34.913, 38.631]
    assert "do not use" in result["warning"].lower()


@pytest.mark.parametrize(
    "waypoints",
    [
        [{"lat": "nan", "lng": 34.9}, {"lat": 38.6, "lng": 34.9}],
        [{"lat": 38.6, "lng": 34.9}, {"lat": 38.6, "lng": 181}],
        [{"lat": 38.6}, {"lat": 38.7, "lng": 34.9}],
    ],
)
def test_route_planning_rejects_invalid_waypoints(waypoints):
    with pytest.raises(APIError) as excinfo:
        RoutePlanningService().create_route(waypoints)

    assert excinfo.value.status_code == 400


def test_route_planning_caps_waypoint_count():
    waypoints = [
        {"lat": 38.6 + index / 100_000, "lng": 34.9}
        for index in range(101)
    ]

    with pytest.raises(APIError) as excinfo:
        RoutePlanningService().create_route(waypoints)

    assert excinfo.value.status_code == 400
