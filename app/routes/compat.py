"""
Legacy compatibility routes for the modular Flask app.

These endpoints keep the current frontend contract working while the
application continues to use the modular runtime.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from importlib import import_module
from typing import Any, Dict, Iterable, List, Optional

from flask import Blueprint, jsonify, request

from auth_middleware import auth_middleware
from app.services.media_service import media_service
from app.services.poi_service import poi_service
from app.services.recommendation_service import recommendation_service
from app.services.route_planning_service import route_planning_service


logger = logging.getLogger(__name__)

compat_bp = Blueprint("compat", __name__)

FALLBACK_CATEGORIES: List[Dict[str, Any]] = [
    {
        "name": "gastronomik",
        "display_name": "🍽️ Gastronomik",
        "color": "#e74c3c",
        "icon": "utensils",
    },
    {
        "name": "kulturel",
        "display_name": "🏛️ Kültürel",
        "color": "#3498db",
        "icon": "landmark",
    },
    {
        "name": "sanatsal",
        "display_name": "🎨 Sanatsal",
        "color": "#2ecc71",
        "icon": "palette",
    },
    {
        "name": "doga_macera",
        "display_name": "🌿 Doğa & Macera",
        "color": "#f39c12",
        "icon": "hiking",
    },
    {
        "name": "konaklama",
        "display_name": "🏨 Konaklama",
        "color": "#9b59b6",
        "icon": "bed",
    },
    {
        "name": "alisveris",
        "display_name": "🛍️ Alışveriş",
        "color": "#f39c12",
        "icon": "shopping-cart",
    },
    {
        "name": "eglence",
        "display_name": "🎪 Eğlence",
        "color": "#e74c3c",
        "icon": "music",
    },
    {
        "name": "spor",
        "display_name": "⚽ Spor",
        "color": "#34495e",
        "icon": "dumbbell",
    },
    {
        "name": "yasayan_kultur",
        "display_name": "🕌 Yaşayan Kültür",
        "color": "#8B4513",
        "icon": "mosque",
    },
    {
        "name": "ulasilabilirlik",
        "display_name": "🚗 Ulaşılabilirlik",
        "color": "#34495e",
        "icon": "road",
    },
]


def _legacy_api():
    """Import the legacy module lazily so normal startup stays lightweight."""
    return import_module("poi_api")


def _direct_connection():
    import psycopg2
    from psycopg2.extras import RealDictCursor

    conn_str = os.environ.get("POI_DB_CONNECTION")
    if conn_str:
        return psycopg2.connect(conn_str, cursor_factory=RealDictCursor)

    return psycopg2.connect(
        host=os.environ.get("DB_HOST") or os.environ.get("POI_DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT") or os.environ.get("POI_DB_PORT") or 5432),
        dbname=os.environ.get("DB_NAME") or os.environ.get("POI_DB_NAME", "poi_db"),
        user=os.environ.get("DB_USER") or os.environ.get("POI_DB_USER", "poi_user"),
        password=os.environ.get("DB_PASSWORD") or os.environ.get("POI_DB_PASSWORD", "poi_password"),
        cursor_factory=RealDictCursor,
    )


@contextmanager
def _db_connection():
    """
    Get a pooled connection when available, otherwise open a direct connection.
    """
    try:
        from app.config.database import get_database_pool

        pool = get_database_pool()
        if pool is not None:
            with pool.get_connection() as conn:
                yield conn
            return
    except Exception as exc:
        logger.debug("Compatibility route pool unavailable: %s", exc)

    conn = _direct_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _load_categories_from_db() -> Optional[List[Dict[str, Any]]]:
    try:
        with _db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT name, display_name, color, icon, description
                    FROM categories
                    ORDER BY name
                    """
                )
                rows = cursor.fetchall() or []

        return [dict(row) for row in rows]
    except Exception as exc:
        logger.warning("Falling back to static categories: %s", exc)
        return None


def _delegate(handler_name: str, *args, **kwargs):
    try:
        handler = getattr(_legacy_api(), handler_name)
        return handler(*args, **kwargs)
    except Exception as exc:
        logger.exception("Compatibility delegate failed for %s: %s", handler_name, exc)
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Compatibility handler failed",
                    "handler": handler_name,
                }
            ),
            500,
        )


@compat_bp.route("/api/categories", methods=["GET", "POST", "PUT", "DELETE"])
def categories():
    if request.method == "GET":
        categories = _load_categories_from_db()
        if categories is None or not categories:
            categories = FALLBACK_CATEGORIES
        return jsonify(categories), 200

    return _delegate("manage_categories")


@compat_bp.route("/api/ratings/categories", methods=["GET"])
def rating_categories():
    return jsonify(poi_service.get_rating_categories()), 200


@compat_bp.route("/api/poi/<poi_id>/ratings", methods=["GET"])
@auth_middleware.require_auth
def get_poi_ratings(poi_id):
    return jsonify(poi_service.get_poi_ratings(poi_id)), 200


@compat_bp.route("/api/poi/<poi_id>/ratings", methods=["PUT"])
@auth_middleware.require_auth
def update_poi_ratings(poi_id):
    payload = request.get_json(silent=True) or {}
    return jsonify(poi_service.update_poi_ratings(poi_id, payload.get("ratings"))), 200


@compat_bp.route("/api/poi/<poi_id>/images", methods=["GET"])
def get_poi_images(poi_id):
    return _delegate("get_poi_images_legacy", poi_id)


@compat_bp.route("/api/poi/<poi_id>/images", methods=["POST"])
def upload_poi_images(poi_id):
    return _delegate("upload_poi_image_legacy", poi_id)


@compat_bp.route("/api/poi/<poi_id>/images/<filename>", methods=["DELETE"])
def delete_poi_image(poi_id, filename):
    return _delegate("delete_poi_image_legacy", poi_id, filename)


@compat_bp.route("/api/panoramas", methods=["GET"])
def list_panoramas():
    return jsonify(media_service.list_panoramas()), 200


@compat_bp.route("/api/panoramas", methods=["POST"])
@auth_middleware.require_auth
def upload_panorama():
    files = []
    if "media" in request.files:
        files.extend(request.files.getlist("media"))
    if "media[]" in request.files:
        files.extend(request.files.getlist("media[]"))

    payload = media_service.upload_panoramas(files, request.form.get("caption", ""))
    if payload.get("errors"):
        return jsonify(payload), 207
    if payload.get("uploaded_count", 0) == 0 and payload.get("duplicate_count", 0) > 0:
        return jsonify(payload), 200
    return jsonify(payload), 201


@compat_bp.route("/api/panoramas/<pano_id>", methods=["DELETE"])
@auth_middleware.require_auth
def delete_panorama(pano_id):
    return jsonify(media_service.delete_panorama(pano_id)), 200


@compat_bp.route("/api/route-panoramas", methods=["GET"])
def list_route_panoramas():
    return jsonify(media_service.list_route_panoramas()), 200


@compat_bp.route("/api/route/smart", methods=["POST"])
def smart_route():
    payload = request.get_json(silent=True) or {}
    return jsonify(route_planning_service.create_route(payload.get("waypoints", []), "smart")), 200


@compat_bp.route("/api/recommendations", methods=["POST"])
def recommendations():
    return jsonify(recommendation_service.get_recommendations(request.get_json(silent=True) or {})), 200


@compat_bp.route("/api/routes/<int:route_id>/nearby-pois", methods=["GET"])
def nearby_pois(route_id):
    return _delegate("find_nearby_pois_for_route", route_id)


@compat_bp.route("/api/routes/<int:route_id>/auto-associate-pois", methods=["POST"])
def auto_associate_pois(route_id):
    return _delegate("auto_associate_nearby_pois", route_id)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["DELETE"])
@auth_middleware.require_auth
def delete_route_media(route_id, filename):
    return _delegate("delete_route_media", route_id, filename)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["PUT"])
@auth_middleware.require_auth
def update_route_media(route_id, filename):
    return _delegate("update_route_media", route_id, filename)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["PATCH"])
@auth_middleware.require_auth
def patch_route_media(route_id, filename):
    return _delegate("patch_route_media", route_id, filename)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location", methods=["PUT"])
@auth_middleware.require_auth
def update_route_media_location(route_id, filename):
    return _delegate("update_route_media_location", route_id, filename)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location", methods=["DELETE"])
@auth_middleware.require_auth
def delete_route_media_location(route_id, filename):
    return _delegate("delete_route_media_location", route_id, filename)


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location/auto", methods=["POST"])
@auth_middleware.require_auth
def auto_route_media_location(route_id, filename):
    return _delegate("auto_route_media_location", route_id, filename)


@compat_bp.route("/poi_media/<path:filename>", methods=["GET"])
def serve_poi_media(filename):
    return _delegate("serve_poi_media", filename)


@compat_bp.route("/poi_images/<path:filename>", methods=["GET"])
def serve_poi_images(filename):
    return _delegate("serve_poi_image", filename)


__all__ = ["compat_bp"]
