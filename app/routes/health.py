"""
Health check routes for POI Travel Recommendation API.
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from app.config.database import database_health_check


health_bp = Blueprint("health", __name__)
logger = logging.getLogger(__name__)


def _timestamp():
    return datetime.now(timezone.utc).isoformat()


def _database_status():
    """Return a stable, public-safe status without DB hosts or exceptions."""
    try:
        status = database_health_check()
    except Exception:
        logger.exception("Database health check raised an exception")
        return {"status": "unhealthy"}

    if not isinstance(status, dict):
        return {"status": "unhealthy"}

    public_status = {
        "status": "healthy"
        if str(status.get("status", "")).lower() == "healthy"
        else "unhealthy"
    }
    if isinstance(status.get("response_time_ms"), (int, float)):
        public_status["response_time_ms"] = status["response_time_ms"]
    return public_status


def _database_is_healthy(status):
    return str(status.get("status", "")).lower() == "healthy"


@health_bp.route("/livez", methods=["GET"])
def liveness():
    """Process liveness probe; intentionally does not touch the database."""
    return jsonify({"status": "alive", "timestamp": _timestamp()}), 200


@health_bp.route("/readyz", methods=["GET"])
def readiness():
    """Dependency-aware readiness probe for traffic admission."""
    db_status = _database_status()
    ready = _database_is_healthy(db_status)
    return (
        jsonify(
            {
                "status": "ready" if ready else "not_ready",
                "timestamp": _timestamp(),
                "database": db_status,
            }
        ),
        200 if ready else 503,
    )


@health_bp.route("/health", methods=["GET"])
def health():
    """
    Lightweight health endpoint used by CI/benchmarks.

    Backward-compatible aggregate probe. It keeps returning HTTP 200 for
    existing consumers, while its status accurately reflects DB health.
    """
    db_status = _database_status()
    healthy = _database_is_healthy(db_status)
    return (
        jsonify(
            {
                "status": "healthy" if healthy else "unhealthy",
                "timestamp": _timestamp(),
                "database": db_status,
            }
        ),
        200,
    )


__all__ = ["health_bp"]
