"""
Health check routes for POI Travel Recommendation API.
"""

from datetime import datetime, timezone

from flask import Blueprint, jsonify

from app.config.database import database_health_check


health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health():
    """
    Lightweight health endpoint used by CI/benchmarks.

    Returns 200 if the web service is up; includes best-effort DB status.
    """
    return (
        jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "database": database_health_check(),
            }
        ),
        200,
    )


__all__ = ["health_bp"]

