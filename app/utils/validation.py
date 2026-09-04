"""Strict, reusable parsers for HTTP and service-layer input."""

import math
from typing import Any, Tuple

from app.middleware.error_handler import bad_request


_MISSING = object()


def parse_bounded_int(
    value: Any,
    field: str,
    *,
    default: Any = _MISSING,
    minimum: int,
    maximum: int,
    clamp_maximum: bool = True,
) -> int:
    if value in (None, ""):
        if default is _MISSING:
            raise bad_request(f"{field} is required")
        return default

    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError, OverflowError):
        raise bad_request(f"{field} must be an integer")

    if parsed < minimum:
        raise bad_request(f"{field} must be at least {minimum}")
    if parsed > maximum:
        if clamp_maximum:
            return maximum
        raise bad_request(f"{field} must be at most {maximum}")
    return parsed


def parse_bool(value: Any, field: str, *, default: Any = _MISSING) -> bool:
    if value is None:
        if default is _MISSING:
            raise bad_request(f"{field} is required")
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    raise bad_request(f"{field} must be a boolean")


def parse_finite_float(value: Any, field: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        raise bad_request(f"{field} must be a number")
    if not math.isfinite(parsed):
        raise bad_request(f"{field} must be finite")
    return parsed


def parse_coordinates(latitude: Any, longitude: Any) -> Tuple[float, float]:
    lat = parse_finite_float(latitude, "latitude")
    lng = parse_finite_float(longitude, "longitude")
    if not -90 <= lat <= 90:
        raise bad_request("latitude must be between -90 and 90")
    if not -180 <= lng <= 180:
        raise bad_request("longitude must be between -180 and 180")
    return lat, lng
