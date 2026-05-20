"""
Legacy compatibility routes for the modular Flask app.

These endpoints keep the current frontend contract working while the
application continues to use the modular runtime.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from werkzeug.exceptions import NotFound
from werkzeug.utils import safe_join

from auth_middleware import auth_middleware
from app.middleware.error_handler import APIError
from app.services.media_service import media_service
from app.services.poi_service import poi_service
from app.services.recommendation_service import recommendation_service
from app.services.route_planning_service import route_planning_service
from app.services.route_service import route_service


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


def _compat_error_response(error: APIError):
    status_code = error.status_code
    message = error.message
    if error.code == "DB_CONN_ERROR":
        status_code = 500
        message = "Database connection failed"
    return jsonify({"error": message}), status_code


def _parse_clamped_int_param(name: str, raw_value, default: int, minimum: int, maximum: int) -> int:
    value_text = str(raw_value or "").strip()
    if not value_text:
        return default

    try:
        parsed_value = int(float(value_text))
    except (TypeError, ValueError, OverflowError):
        raise APIError(f"{name} must be a number", "BAD_REQUEST", 400)

    return max(minimum, min(maximum, parsed_value))


@compat_bp.route("/api/categories", methods=["GET", "POST", "PUT", "DELETE"])
def categories():
    if request.method == "GET":
        try:
            categories = poi_service.list_categories()
        except Exception as exc:
            logger.warning("Falling back to static categories: %s", exc)
            categories = None

        if categories is None or not categories:
            categories = FALLBACK_CATEGORIES
        return jsonify(categories), 200

    @auth_middleware.require_auth
    def _protected():
        try:
            if request.method == "POST":
                payload = poi_service.create_category(request.get_json(silent=True))
                return jsonify(payload), 201

            if request.method == "PUT":
                payload = poi_service.update_category(request.get_json(silent=True))
                return jsonify(payload), 200

            payload = poi_service.delete_category(request.args.get("name"))
            return jsonify(payload), 200
        except APIError as exc:
            return _compat_error_response(exc)

    return _protected()


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
    try:
        return jsonify(media_service.list_poi_images_legacy(poi_id)), 200
    except APIError as exc:
        return _compat_error_response(exc)


@compat_bp.route("/api/poi/<poi_id>/images", methods=["POST"])
@auth_middleware.require_auth
def upload_poi_images(poi_id):
    try:
        payload = media_service.upload_poi_media_asset(
            poi_id,
            request.files.get("media"),
            caption=request.form.get("caption", ""),
            is_primary=str(request.form.get("is_primary", "false")).lower() == "true",
        )
        return jsonify(payload), 201
    except APIError as exc:
        return _compat_error_response(exc)


@compat_bp.route("/api/poi/<poi_id>/images/<filename>", methods=["DELETE"])
@auth_middleware.require_auth
def delete_poi_image(poi_id, filename):
    try:
        return jsonify(media_service.delete_poi_media_asset(poi_id, filename)), 200
    except APIError as exc:
        return _compat_error_response(exc)


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


@compat_bp.route("/api/panoramas/nearby", methods=["GET"])
def nearby_panoramas():
    lat_raw = (request.args.get("lat") or "").strip()
    lng_raw = (request.args.get("lng") or "").strip()
    if not lat_raw or not lng_raw:
        return jsonify({"error": "lat and lng query params are required"}), 400

    try:
        lat = float(lat_raw)
        lng = float(lng_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "lat and lng must be numbers"}), 400

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return jsonify({"error": "lat/lng out of range"}), 400

    radius_m = _parse_clamped_int_param("radius_m", request.args.get("radius_m"), 1000, 50, 10_000)
    limit = _parse_clamped_int_param("limit", request.args.get("limit"), 20, 1, 100)

    try:
        return jsonify(media_service.search_nearby_panoramas(lat=lat, lng=lng, radius_m=radius_m, limit=limit)), 200
    except APIError as exc:
        return _compat_error_response(exc)


@compat_bp.route("/api/route/smart", methods=["POST"])
def smart_route():
    payload = request.get_json(silent=True) or {}
    return jsonify(route_planning_service.create_route(payload.get("waypoints", []), "smart")), 200


@compat_bp.route("/api/recommendations", methods=["POST"])
def recommendations():
    return jsonify(recommendation_service.get_recommendations(request.get_json(silent=True) or {})), 200


@compat_bp.route("/api/routes/<int:route_id>/nearby-pois", methods=["GET"])
@auth_middleware.require_auth
def nearby_pois(route_id):
    try:
        user_supplied = request.args.get("max_distance")
        if user_supplied is not None:
            max_distance = min(2000, max(50, int(user_supplied)))
        else:
            max_distance = 500

        route = route_service.get_route(route_id)
        geometry = route_service.get_route_geometry(route_id)
        is_center = route_service.is_route_in_urgup_center(route, geometry)
        dynamic_default = 50 if is_center else 250
        max_distance = min(max_distance, dynamic_default) if user_supplied is not None else dynamic_default

        nearby = route_service.find_nearby_pois(route_id, max_distance)
        return (
            jsonify(
                {
                    "success": True,
                    "route": {"id": route["id"], "name": route["name"]},
                    "nearby_pois": nearby,
                    "total_found": len(nearby),
                    "parameters": {
                        "max_distance_meters": max_distance,
                        "is_center_route": is_center,
                        "user_supplied": user_supplied,
                    },
                }
            ),
            200,
        )
    except ValueError:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Geçersiz parametre değeri",
                    "error_code": "INVALID_PARAMETER",
                }
            ),
            400,
        )
    except APIError as exc:
        logger.error("Error in find_nearby_pois_for_route: %s", exc)
        error_code = "ROUTE_NOT_FOUND" if exc.status_code == 404 else "NEARBY_POI_ERROR"
        return (
            jsonify(
                {
                    "success": False,
                    "error": str(exc),
                    "error_code": error_code,
                }
            ),
            exc.status_code,
        )
    except Exception as exc:
        logger.error("Error in find_nearby_pois_for_route: %s", exc)
        return (
            jsonify(
                {
                    "success": False,
                    "error": f"Yakın POI arama hatası: {str(exc)}",
                    "error_code": "NEARBY_POI_ERROR",
                }
            ),
            500,
        )


@compat_bp.route("/api/routes/<int:route_id>/auto-associate-pois", methods=["POST"])
@auth_middleware.require_auth
def auto_associate_pois(route_id):
    try:
        data = request.get_json(silent=True) or {}
        raw_max_distance = data.get("max_distance")
        max_distance = None
        if raw_max_distance is not None:
            try:
                max_distance = min(2000, max(50, int(raw_max_distance)))
            except Exception:
                max_distance = None

        auto_confirm = bool(data.get("auto_confirm", False))
        categories = data.get("categories", [])
        if not isinstance(categories, list):
            categories = []

        route = route_service.get_route(route_id)
        geometry = route_service.get_route_geometry(route_id)
        is_center = route_service.is_route_in_urgup_center(route, geometry)
        dynamic_default = 50 if is_center else 250
        effective_distance = dynamic_default if max_distance is None else min(max_distance, dynamic_default)

        result = route_service.auto_associate_nearby_pois(
            route_id,
            effective_distance,
            auto_confirm,
            categories=categories,
        )
        result["route"] = {"id": route["id"], "name": route["name"]}
        result["parameters"] = {
            "max_distance_meters": effective_distance,
            "auto_confirm": auto_confirm,
            "categories": categories,
        }
        return jsonify(result), 200
    except APIError as exc:
        logger.error("Error in auto_associate_nearby_pois: %s", exc)
        error_code = "ROUTE_NOT_FOUND" if exc.status_code == 404 else "AUTO_ASSOCIATION_ERROR"
        return (
            jsonify(
                {
                    "success": False,
                    "error": str(exc),
                    "error_code": error_code,
                }
            ),
            exc.status_code,
        )
    except Exception as exc:
        logger.error("Error in auto_associate_nearby_pois: %s", exc)
        return (
            jsonify(
                {
                    "success": False,
                    "error": f"Otomatik POI ekleme hatası: {str(exc)}",
                    "error_code": "AUTO_ASSOCIATION_ERROR",
                }
            ),
            500,
        )


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["DELETE"])
@auth_middleware.require_auth
def delete_route_media(route_id, filename):
    try:
        return jsonify(route_service.delete_route_media_asset(route_id, filename)), 200
    except APIError as exc:
        code = 404 if exc.status_code == 404 else exc.status_code
        return jsonify({"success": False, "error": str(exc)}), code


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["PUT"])
@auth_middleware.require_auth
def update_route_media(route_id, filename):
    try:
        payload = request.get_json(silent=True) or {}
        return jsonify(route_service.update_route_media_asset(route_id, filename, payload)), 200
    except APIError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.status_code


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>", methods=["PATCH"])
@auth_middleware.require_auth
def patch_route_media(route_id, filename):
    try:
        payload = request.get_json(silent=True) or {}
        return jsonify(route_service.update_route_media_asset(route_id, filename, payload)), 200
    except APIError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.status_code


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location", methods=["PUT"])
@auth_middleware.require_auth
def update_route_media_location(route_id, filename):
    try:
        payload = request.get_json(silent=True) or {}
        lat = payload.get("latitude", payload.get("lat"))
        lng = payload.get("longitude", payload.get("lng"))
        if lat is None or lng is None:
            raise APIError("Both latitude and longitude are required", "MISSING_COORDINATES", 400)
        return jsonify(route_service.update_route_media_location_asset(route_id, filename, float(lat), float(lng))), 200
    except ValueError:
        return jsonify({"success": False, "error": "Invalid coordinate values"}), 400
    except APIError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.status_code


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location", methods=["DELETE"])
@auth_middleware.require_auth
def delete_route_media_location(route_id, filename):
    try:
        return jsonify(route_service.delete_route_media_location_asset(route_id, filename)), 200
    except APIError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.status_code


@compat_bp.route("/api/admin/routes/<int:route_id>/media/<filename>/location/auto", methods=["POST"])
@auth_middleware.require_auth
def auto_route_media_location(route_id, filename):
    try:
        return jsonify(route_service.auto_route_media_location_asset(route_id, filename)), 200
    except APIError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.status_code


@compat_bp.route("/poi_media/<path:filename>", methods=["GET"])
def serve_poi_media(filename):
    media_root = os.path.join(os.path.dirname(current_app.root_path), "poi_media")
    try:
        safe_path = safe_join(media_root, filename)
    except (NotFound, ValueError):
        safe_path = None

    if safe_path and os.path.exists(safe_path):
        return send_from_directory(media_root, filename)
    return jsonify({"error": "Media file not found"}), 404


@compat_bp.route("/poi_images/<path:filename>", methods=["GET"])
def serve_poi_images(filename):
    project_root = os.path.dirname(current_app.root_path)
    poi_images_dir = os.path.join(project_root, "poi_images")
    poi_media_dir = os.path.join(project_root, "poi_media")

    try:
        safe_poi_image_path = safe_join(poi_images_dir, filename)
    except (NotFound, ValueError):
        safe_poi_image_path = None

    if safe_poi_image_path and os.path.exists(safe_poi_image_path):
        return send_from_directory(poi_images_dir, filename)

    try:
        safe_media_path = safe_join(poi_media_dir, filename)
    except (NotFound, ValueError):
        safe_media_path = None

    if safe_media_path and os.path.exists(safe_media_path):
        return send_from_directory(poi_media_dir, filename)

    return jsonify({"error": "Image not found"}), 404


__all__ = ["compat_bp"]
