"""
Recommendation service for POI suggestion workflows.
"""

from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional, Tuple

from app.middleware.error_handler import APIError, bad_request
from app.services.poi_service import poi_service


logger = logging.getLogger(__name__)


RATING_FIELDS = [
    "tarihi",
    "sanat_kultur",
    "doga",
    "eglence",
    "alisveris",
    "spor",
    "macera",
    "rahatlatici",
    "yemek",
    "gece_hayati",
]

CATEGORY_MAPPING = {
    "doga_macera": ["doga", "macera", "spor"],
    "gastronomik": ["yemek"],
    "kulturel": ["tarihi", "sanat_kultur"],
    "sanatsal": ["sanat_kultur"],
    "konaklama": ["rahatlatici"],
    "kulturel_miras": ["tarihi", "sanat_kultur"],
    "dogal_miras": ["doga"],
    "macera_spor": ["macera", "spor"],
    "konaklama_hizmet": ["rahatlatici"],
    "gastronomi": ["yemek"],
    "seyir_noktalari": ["doga"],
    "yasayan_kultur": ["tarihi", "sanat_kultur"],
    "dogal_guzellilk": ["doga"],
    "yemek_icecek": ["yemek"],
    "alisveris_el_sanatlari": ["alisveris"],
    "eglence_aktivite": ["eglence", "spor"],
    "ulasilabilirlik": [],
}


class RecommendationService:
    """Business logic for recommendation requests."""

    def get_recommendations(self, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        data = payload or {}
        preferences = data.get("preferences")
        if not isinstance(preferences, dict):
            raise bad_request("Missing preferences in request body")

        limit = self._parse_limit(data.get("limit"))
        pref_values = self._normalize_preferences(preferences)
        pref_sum = sum(pref_values.values())
        pref_weights = (
            {field: (value / pref_sum) for field, value in pref_values.items()}
            if pref_sum > 0
            else {field: 0.0 for field in RATING_FIELDS}
        )
        all_zero = pref_sum == 0

        user_lat, user_lng = self._parse_location(data.get("location"))
        pois = self._load_pois_with_ratings()

        field_means = self._calculate_field_means(pois)
        strong_dims = [field for field, value in pref_values.items() if value >= 75]

        if user_lat is not None and user_lng is not None:
            w_pref, w_dist, w_quality = 0.6, 0.3, 0.1
        else:
            w_pref, w_dist, w_quality = 0.8, 0.0, 0.2

        recommendations: List[Dict[str, Any]] = []
        for poi in pois:
            pref_score = 0.0
            quality_total = 0.0
            quality_count = 0

            for field in RATING_FIELDS:
                rating = self._coerce_rating(poi.get(field), field_means[field])
                pref_score += pref_weights[field] * (rating / 100.0)
                quality_total += rating / 100.0
                quality_count += 1

            quality_score = (quality_total / quality_count) if quality_count else 0.5

            dist_km = None
            dist_score = 0.0
            if user_lat is not None and user_lng is not None:
                try:
                    dist_km = self._haversine_km(
                        user_lat,
                        user_lng,
                        float(poi["latitude"]),
                        float(poi["longitude"]),
                    )
                    dist_score = self._proximity_score_km(dist_km)
                except Exception:
                    dist_km = None
                    dist_score = 0.0

            bonus = self._calculate_category_bonus(str(poi.get("category") or "").lower(), pref_values)
            boost = self._calculate_strong_dimension_boost(poi, strong_dims, field_means)

            if all_zero:
                base = (w_dist * dist_score) + (w_quality * quality_score)
            else:
                base = (w_pref * pref_score) + (w_dist * dist_score) + (w_quality * quality_score)

            final_norm = min(1.0, max(0.0, boost * base + bonus))
            final_score = round(final_norm * 100.0, 2)
            if final_score <= 0:
                continue

            recommendation = {
                "id": poi["id"],
                "name": poi["name"],
                "category": poi["category"],
                "latitude": poi["latitude"],
                "longitude": poi["longitude"],
                "description": poi.get("description", ""),
                "tags": poi.get("tags", ""),
                "score": final_score,
                "ratings": {field: poi.get(field, 0) for field in RATING_FIELDS},
                "components": {
                    "preference": round(pref_score * 100.0, 2),
                    "distance": round(dist_score * 100.0, 2),
                    "quality": round(quality_score * 100.0, 2),
                    "bonus": round(bonus * 100.0, 2),
                },
            }
            if dist_km is not None:
                recommendation["distance_km"] = round(dist_km, 2)

            recommendations.append(recommendation)

        recommendations.sort(key=lambda item: item["score"], reverse=True)
        diversified = self._diversify(recommendations, limit)

        return {
            "recommendations": diversified,
            "total": len(diversified),
            "preferences_used": pref_values,
            "location_used": (
                {"latitude": user_lat, "longitude": user_lng}
                if user_lat is not None and user_lng is not None
                else None
            ),
        }

    def _parse_limit(self, raw_limit: Any) -> int:
        if raw_limit in (None, ""):
            return 20
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError):
            raise bad_request("Invalid limit value")
        return max(1, min(limit, 100))

    def _normalize_preferences(self, preferences: Dict[str, Any]) -> Dict[str, int]:
        values: Dict[str, int] = {}
        for field in RATING_FIELDS:
            raw_value = preferences.get(field, 0)
            try:
                parsed = int(raw_value)
            except (TypeError, ValueError):
                parsed = 0
            values[field] = max(0, parsed)
        return values

    def _parse_location(self, location: Any) -> Tuple[Optional[float], Optional[float]]:
        if not isinstance(location, dict):
            return None, None

        try:
            return float(location.get("latitude")), float(location.get("longitude"))
        except (TypeError, ValueError):
            return None, None

    def _load_pois_with_ratings(self) -> List[Dict[str, Any]]:
        try:
            with poi_service._get_database_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT p.id, p.name, p.category,
                               ST_Y(p.location::geometry) AS latitude,
                               ST_X(p.location::geometry) AS longitude,
                               p.description, '' AS tags,
                               MAX(CASE WHEN r.category = 'tarihi' THEN r.rating END) AS tarihi,
                               MAX(CASE WHEN r.category = 'sanat_kultur' THEN r.rating END) AS sanat_kultur,
                               MAX(CASE WHEN r.category = 'doga' THEN r.rating END) AS doga,
                               MAX(CASE WHEN r.category = 'eglence' THEN r.rating END) AS eglence,
                               MAX(CASE WHEN r.category = 'alisveris' THEN r.rating END) AS alisveris,
                               MAX(CASE WHEN r.category = 'spor' THEN r.rating END) AS spor,
                               MAX(CASE WHEN r.category = 'macera' THEN r.rating END) AS macera,
                               MAX(CASE WHEN r.category = 'rahatlatici' THEN r.rating END) AS rahatlatici,
                               MAX(CASE WHEN r.category = 'yemek' THEN r.rating END) AS yemek,
                               MAX(CASE WHEN r.category = 'gece_hayati' THEN r.rating END) AS gece_hayati
                        FROM pois p
                        LEFT JOIN poi_ratings r ON p.id = r.poi_id
                        WHERE p.location IS NOT NULL
                        GROUP BY p.id, p.name, p.category, p.location, p.description
                        """
                    )
                    rows = cursor.fetchall() or []

            return [dict(row) for row in rows]
        except APIError:
            raise
        except Exception as exc:
            logger.error("Failed to load POIs for recommendations: %s", exc)
            raise APIError("Failed to load recommendations", "RECOMMENDATION_LOAD_ERROR", 500)

    def _calculate_field_means(self, pois: List[Dict[str, Any]]) -> Dict[str, float]:
        field_sums = {field: 0.0 for field in RATING_FIELDS}
        field_counts = {field: 0 for field in RATING_FIELDS}

        for poi in pois:
            for field in RATING_FIELDS:
                value = poi.get(field)
                if value is None:
                    continue
                try:
                    numeric = float(value)
                except (TypeError, ValueError):
                    continue
                if numeric > 0:
                    field_sums[field] += numeric
                    field_counts[field] += 1

        return {
            field: (field_sums[field] / field_counts[field]) if field_counts[field] > 0 else 50.0
            for field in RATING_FIELDS
        }

    def _coerce_rating(self, value: Any, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return default
        return numeric if numeric > 0 else default

    def _calculate_category_bonus(self, category: str, pref_values: Dict[str, int]) -> float:
        bonus = 0.0
        for mapped_field in CATEGORY_MAPPING.get(category, []):
            pref_value = pref_values.get(mapped_field, 0)
            if pref_value > 50:
                bonus += (pref_value - 50) * 0.003
        return min(0.15, bonus)

    def _calculate_strong_dimension_boost(
        self,
        poi: Dict[str, Any],
        strong_dims: List[str],
        field_means: Dict[str, float],
    ) -> float:
        if not strong_dims:
            return 1.0

        matches = 0
        for field in strong_dims:
            rating = self._coerce_rating(poi.get(field), field_means[field])
            if rating >= 60.0:
                matches += 1

        return 1.12 if matches >= 1 else 0.85

    def _diversify(self, recommendations: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
        diversified: List[Dict[str, Any]] = []
        cat_counts: Dict[str, int] = {}
        cat_cap = max(3, int(limit * 0.4))
        min_sep_km = 0.2

        for recommendation in recommendations:
            category = str(recommendation.get("category") or "").lower()
            if cat_counts.get(category, 0) >= cat_cap:
                continue

            too_close = False
            for chosen in diversified:
                if str(chosen.get("category") or "").lower() != category:
                    continue
                try:
                    if self._haversine_km(
                        float(recommendation["latitude"]),
                        float(recommendation["longitude"]),
                        float(chosen["latitude"]),
                        float(chosen["longitude"]),
                    ) < min_sep_km:
                        too_close = True
                        break
                except Exception:
                    continue

            if too_close:
                continue

            diversified.append(recommendation)
            cat_counts[category] = cat_counts.get(category, 0) + 1
            if len(diversified) >= limit:
                return diversified

        if len(diversified) < limit:
            seen_ids = {item["id"] for item in diversified}
            for recommendation in recommendations:
                if recommendation["id"] in seen_ids:
                    continue
                diversified.append(recommendation)
                if len(diversified) >= limit:
                    break

        return diversified[:limit]

    def _haversine_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius_km * c

    def _proximity_score_km(self, distance_km: float) -> float:
        return 1.0 / (1.0 + (max(0.0, distance_km) / 3.0) ** 2)


recommendation_service = RecommendationService()
