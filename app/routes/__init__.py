"""Routes package for POI Travel Recommendation API."""

from .auth import auth_bp
from .health import health_bp
from .poi import poi_bp
from .route import route_bp
from .route_import import route_import_bp

__all__ = ["auth_bp", "health_bp", "poi_bp", "route_bp", "route_import_bp"]
