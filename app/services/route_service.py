"""
Route Service for POI Travel Recommendation API.
Business logic layer for route operations.
"""

import logging
import json
import math
import time
import uuid
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.middleware.error_handler import APIError, bad_request, not_found
from app.services.media_service import media_service
from app.utils.validation import parse_bool, parse_finite_float

logger = logging.getLogger(__name__)


class RouteService:
    """Service class for route business logic operations."""
    
    def __init__(self):
        self.cache: Dict[str, Any] = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes
        self.urgup_center: Tuple[float, float] = (38.6310, 34.9130)
        self.urgup_center_radius_meters = 3000.0
        self._legacy_media_manager = None

    def _get_table_schema(self, conn, table_name: str) -> Dict[str, str]:
        """Return a mapping of column_name -> udt_name for a table (cached)."""
        cache_key = f"table_schema:{table_name}"
        cached = self._cache_get(cache_key)
        if isinstance(cached, dict) and cached:
            return cached

        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT column_name, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (table_name,),
            )
            rows = cursor.fetchall() or []

        schema: Dict[str, str] = {}
        for row in rows:
            if isinstance(row, dict):
                schema[row.get("column_name")] = row.get("udt_name")
            else:
                schema[row[0]] = row[1]

        # Cache even if empty (avoid repeated lookups during error conditions)
        self._cache_set(cache_key, schema)
        return schema

    def _linestring_wkt_from_coordinates(self, coordinates: Any) -> Optional[str]:
        """Build LINESTRING WKT from coordinate inputs (best-effort)."""
        if not coordinates:
            return None

        points: List[List[float]] = []

        # GeoJSON LineString: {"type":"LineString","coordinates":[[lng,lat],...]}
        if isinstance(coordinates, dict):
            if coordinates.get("type") == "LineString" and isinstance(coordinates.get("coordinates"), list):
                for pair in coordinates.get("coordinates", []):
                    if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                        try:
                            lng = float(pair[0])
                            lat = float(pair[1])
                        except (TypeError, ValueError):
                            continue
                        points.append([lng, lat])

        # List of dicts: [{"lat":..,"lng":..}, ...] or [{"latitude":..,"longitude":..}, ...]
        elif isinstance(coordinates, list):
            for item in coordinates:
                if isinstance(item, dict):
                    lat = item.get("lat", item.get("latitude"))
                    lng = item.get("lng", item.get("longitude", item.get("lon")))
                    try:
                        lat_f = float(lat)
                        lng_f = float(lng)
                    except (TypeError, ValueError):
                        continue
                    points.append([lng_f, lat_f])
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    try:
                        lng = float(item[0])
                        lat = float(item[1])
                    except (TypeError, ValueError):
                        continue
                    points.append([lng, lat])

        if len(points) < 2:
            return None

        coords = ",".join([f"{lng} {lat}" for lng, lat in points])
        return f"LINESTRING({coords})"

    def _calculate_distance_km(self, coordinates: Any) -> Optional[float]:
        """Approximate total distance in km for a route coordinate list."""
        if not coordinates:
            return None

        # Normalize to list of (lat, lng)
        pts: List[tuple[float, float]] = []
        if isinstance(coordinates, dict) and coordinates.get("type") == "LineString":
            for pair in coordinates.get("coordinates", []) or []:
                if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                    try:
                        lng = float(pair[0])
                        lat = float(pair[1])
                    except (TypeError, ValueError):
                        continue
                    pts.append((lat, lng))
        elif isinstance(coordinates, list):
            for item in coordinates:
                if isinstance(item, dict):
                    lat = item.get("lat", item.get("latitude"))
                    lng = item.get("lng", item.get("longitude", item.get("lon")))
                    try:
                        pts.append((float(lat), float(lng)))
                    except (TypeError, ValueError):
                        continue
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    try:
                        pts.append((float(item[1]), float(item[0])))
                    except (TypeError, ValueError):
                        continue

        if len(pts) < 2:
            return None

        def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
            lat1, lon1 = a
            lat2, lon2 = b
            r = 6371.0
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            s1 = math.sin(dlat / 2) ** 2
            s2 = math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
            c = 2 * math.asin(math.sqrt(s1 + s2))
            return r * c

        dist = 0.0
        for i in range(1, len(pts)):
            dist += haversine_km(pts[i - 1], pts[i])
        return round(dist, 4)

    def _haversine_distance_meters(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate great-circle distance between two points in meters."""
        radius = 6371000.0
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius * c

    def _is_within_urgup_center(self, lat: float, lng: float) -> bool:
        """Check whether a point falls inside the Ürgüp center radius."""
        return self._haversine_distance_meters(lat, lng, self.urgup_center[0], self.urgup_center[1]) <= self.urgup_center_radius_meters

    def _extract_route_points(self, route: Dict[str, Any], geometry_data: Optional[Dict[str, Any]] = None) -> List[Tuple[float, float]]:
        """Collect representative route coordinates from pois, waypoints, or geometry."""
        points: List[Tuple[float, float]] = []

        def add_point(lat_value: Any, lng_value: Any):
            try:
                lat = float(lat_value)
                lng = float(lng_value)
            except (TypeError, ValueError):
                return
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                points.append((lat, lng))

        def add_points_from_items(items: Any):
            if not isinstance(items, list):
                return
            for item in items:
                if isinstance(item, dict):
                    add_point(
                        item.get("lat", item.get("latitude")),
                        item.get("lng", item.get("longitude", item.get("lon"))),
                    )
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    add_point(item[1], item[0])

        add_points_from_items(route.get("pois"))
        add_points_from_items(route.get("waypoints"))

        geometry = None
        if isinstance(geometry_data, dict):
            geometry = geometry_data.get("geometry", geometry_data)
        if geometry is None:
            geometry = route.get("geometry")
        if isinstance(geometry, str):
            try:
                geometry = json.loads(geometry)
            except json.JSONDecodeError:
                geometry = None

        if isinstance(geometry, dict) and geometry.get("type") == "LineString":
            for coord in geometry.get("coordinates") or []:
                if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                    add_point(coord[1], coord[0])

        return points

    def _estimate_route_center_latlon(
        self,
        route: Dict[str, Any],
        geometry_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[Tuple[float, float]]:
        """Estimate route center from representative coordinates."""
        points = self._extract_route_points(route, geometry_data)
        if not points:
            return None
        avg_lat = sum(lat for lat, _ in points) / len(points)
        avg_lng = sum(lng for _, lng in points) / len(points)
        return avg_lat, avg_lng

    def is_route_in_urgup_center(
        self,
        route: Dict[str, Any],
        geometry_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Decide whether the route should use center-specific nearby thresholds."""
        center = self._estimate_route_center_latlon(route, geometry_data)
        if center is None:
            return False
        return self._is_within_urgup_center(center[0], center[1])

    def _closest_point_on_segment(
        self,
        point: Tuple[float, float],
        start: Tuple[float, float],
        end: Tuple[float, float],
    ) -> Tuple[float, Tuple[float, float]]:
        """Return shortest distance to a segment plus the closest point."""
        radius = 6371000.0
        ref_lat, ref_lng = point
        cos_ref = math.cos(math.radians(ref_lat)) or 1e-12

        def to_xy(lat: float, lng: float) -> Tuple[float, float]:
            x = math.radians(lng - ref_lng) * radius * cos_ref
            y = math.radians(lat - ref_lat) * radius
            return x, y

        def to_lat_lng(x: float, y: float) -> Tuple[float, float]:
            lat = ref_lat + math.degrees(y / radius)
            lng = ref_lng + math.degrees(x / (radius * cos_ref))
            return lat, lng

        px, py = to_xy(*point)
        ax, ay = to_xy(*start)
        bx, by = to_xy(*end)
        dx, dy = bx - ax, by - ay

        if dx == 0 and dy == 0:
            closest_x, closest_y = ax, ay
        else:
            t = ((px - ax) * dx + (py - ay) * dy) / float(dx * dx + dy * dy)
            t = max(0.0, min(1.0, t))
            closest_x = ax + t * dx
            closest_y = ay + t * dy

        distance = math.hypot(px - closest_x, py - closest_y)
        return distance, to_lat_lng(closest_x, closest_y)

    def _distance_to_polyline(
        self,
        point: Tuple[float, float],
        polyline_points: List[Tuple[float, float]],
    ) -> Tuple[float, Optional[Tuple[float, float]]]:
        """Compute shortest distance in meters from a point to a polyline."""
        if not polyline_points:
            return float("inf"), None
        if len(polyline_points) == 1:
            only_point = polyline_points[0]
            return (
                self._haversine_distance_meters(point[0], point[1], only_point[0], only_point[1]),
                only_point,
            )

        best_distance = float("inf")
        best_point = None
        for idx in range(len(polyline_points) - 1):
            distance, closest = self._closest_point_on_segment(point, polyline_points[idx], polyline_points[idx + 1])
            if distance < best_distance:
                best_distance = distance
                best_point = closest
        return best_distance, best_point
    
    def _get_database_connection(self):
        """Get database connection or raise API error."""
        try:
            # Try the new database pool first
            from app.config.database import get_database_pool
            pool = get_database_pool()
            if pool is not None:
                return pool.get_connection()
        except Exception as e:
            logger.debug(f"Database pool unavailable: {e}")
        
        try:
            # Fallback to direct connection using existing env vars
            import psycopg2
            from psycopg2.extras import RealDictCursor

            conn_str = os.environ.get("POI_DB_CONNECTION")
            if conn_str:
                conn = psycopg2.connect(conn_str, cursor_factory=RealDictCursor)
            else:
                host = os.environ.get("DB_HOST") or os.environ.get("POI_DB_HOST", "localhost")
                port = int(os.environ.get("DB_PORT") or os.environ.get("POI_DB_PORT") or 5432)
                database = os.environ.get("DB_NAME") or os.environ.get("POI_DB_NAME", "poi_db")
                user = os.environ.get("DB_USER") or os.environ.get("POI_DB_USER", "poi_user")
                password = os.environ.get("DB_PASSWORD") or os.environ.get("POI_DB_PASSWORD", "poi_password")

                conn = psycopg2.connect(
                    host=host,
                    port=port,
                    database=database,
                    user=user,
                    password=password,
                    cursor_factory=RealDictCursor,
                )
            
            logger.info("Using direct database connection")
            
            # Return a context manager wrapper
            class DirectConnectionContext:
                def __init__(self, connection):
                    self.connection = connection
                def __enter__(self):
                    return self.connection
                def __exit__(self, exc_type, exc_val, exc_tb):
                    if exc_type:
                        self.connection.rollback()
                    else:
                        self.connection.commit()
                    self.connection.close()
            
            return DirectConnectionContext(conn)
            
        except Exception as exc:
            logger.error(f"Database connection failed: {exc}")
            raise APIError("Database connection failed", "DB_CONN_ERROR", 503)
    
    def _cache_get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.cache_ttl:
                return data
            else:
                del self.cache[key]
        return None
    
    def _cache_set(self, key: str, value: Any):
        """Set value in cache with timestamp."""
        self.cache[key] = (value, time.time())

    def _get_legacy_media_manager(self):
        if self._legacy_media_manager is None:
            from poi_media_manager import POIMediaManager

            self._legacy_media_manager = POIMediaManager()
        return self._legacy_media_manager

    def _map_route_record(self, record: Any) -> Dict[str, Any]:
        """Normalize raw database/json route record for API consumers."""
        if record is None:
            return {}

        route = dict(record)

        created_at = route.get('created_at')
        if isinstance(created_at, datetime):
            route['created_at'] = created_at.isoformat() + ('Z' if created_at.tzinfo is None else '')

        updated_at = route.get('updated_at')
        if isinstance(updated_at, datetime):
            route['updated_at'] = updated_at.isoformat() + ('Z' if updated_at.tzinfo is None else '')

        if 'season_availability' in route and isinstance(route['season_availability'], str):
            try:
                route['season_availability'] = json.loads(route['season_availability'])
            except json.JSONDecodeError:
                route['season_availability'] = []
        if route.get('season_availability') is None:
            route['season_availability'] = ["spring", "summer", "autumn", "winter"]

        if 'waypoints' in route and isinstance(route['waypoints'], str):
            try:
                route['waypoints'] = json.loads(route['waypoints'])
            except json.JSONDecodeError:
                route['waypoints'] = []

        if 'geometry' in route:
            geom = route.get('geometry')
            if isinstance(geom, (bytes, bytearray, memoryview)):
                try:
                    geom = bytes(geom).decode("utf-8")
                except Exception:
                    geom = None
            if isinstance(geom, str):
                try:
                    route['geometry'] = json.loads(geom)
                except json.JSONDecodeError:
                    route['geometry'] = None

        if 'elevation_profile' in route:
            profile = route.get('elevation_profile')
            if isinstance(profile, (bytes, bytearray, memoryview)):
                try:
                    profile = bytes(profile).decode("utf-8")
                except Exception:
                    profile = None
            if isinstance(profile, str):
                try:
                    route['elevation_profile'] = json.loads(profile)
                except json.JSONDecodeError:
                    route['elevation_profile'] = None

        if 'tags' in route and isinstance(route['tags'], str):
            route['tags'] = [tag.strip() for tag in route['tags'].split(',') if tag.strip()]

        total_distance = route.get('total_distance')
        if total_distance is None and route.get('distance_km') is not None:
            total_distance = route.get('distance_km')
        if total_distance is not None:
            try:
                total_distance = float(total_distance)
            except (TypeError, ValueError):
                total_distance = None
        route['total_distance'] = total_distance
        route['distance_km'] = round(total_distance, 2) if isinstance(total_distance, float) else total_distance

        duration_minutes = route.get('estimated_duration')
        if duration_minutes is None and route.get('duration_minutes') is not None:
            duration_minutes = route.get('duration_minutes')
        if duration_minutes is not None:
            try:
                duration_minutes = int(duration_minutes)
            except (TypeError, ValueError):
                duration_minutes = None
        route['estimated_duration'] = duration_minutes
        if isinstance(duration_minutes, int):
            route['duration_minutes'] = duration_minutes
            route['duration_hours'] = round(duration_minutes / 60, 2)
        else:
            route['duration_minutes'] = duration_minutes
            route['duration_hours'] = None

        route.setdefault('difficulty_level', 1)
        route.setdefault('is_active', True)

        return route

    def _normalize_route_media_record(self, record: Any) -> Dict[str, Any]:
        """Normalize route media records for API consumers."""
        item = dict(record)
        if item.get("uploaded_at"):
            try:
                item["uploaded_at"] = item["uploaded_at"].isoformat()
            except Exception:
                pass

        file_path = item.get("file_path")
        if file_path:
            item["filename"] = Path(file_path).name
            try:
                path = Path(file_path)
                item["file_size"] = path.stat().st_size if path.exists() else 0
            except Exception:
                item["file_size"] = 0
        else:
            item.setdefault("filename", "")
            item["file_size"] = 0

        if item.get("media_type") == "photo":
            item["media_type"] = "image"
        item.setdefault("media_type", "image")
        panorama_meta = self._extract_route_panorama_meta(
            item.get("file_path"),
            item.get("media_type"),
        )
        item.update(panorama_meta)
        item["latitude"] = item.get("lat")
        item["longitude"] = item.get("lng")
        return item

    def _extract_route_panorama_meta(self, file_path: Any, media_type: Any) -> Dict[str, Any]:
        meta: Dict[str, Any] = {
            "is_pano": str(media_type or "").strip().lower() == "panorama",
            "original_path": None,
            "pyramid_levels": [],
        }
        if not file_path:
            return meta

        path = Path(str(file_path))
        if not path.is_absolute():
            path = Path.cwd() / path
        if not path.is_file():
            return meta

        if not meta["is_pano"]:
            try:
                from PIL import Image  # type: ignore

                with Image.open(path) as image:
                    width, height = image.size
                if height and 1.90 <= (float(width) / float(height)) <= 2.10 and width >= 1000:
                    meta["is_pano"] = True
            except Exception:
                pass

        try:
            sidecar_path = path.with_suffix(".pano.json")
            if sidecar_path.is_file():
                with open(sidecar_path, "r", encoding="utf-8") as sidecar_file:
                    sidecar_meta = json.load(sidecar_file) or {}

                original_path = sidecar_meta.get("original_path")
                if isinstance(original_path, str):
                    normalized_original = media_service._to_relative_media_path(original_path)
                    meta["original_path"] = normalized_original or None

                normalized_levels: List[Dict[str, Any]] = []
                for level in sidecar_meta.get("pyramid_levels", []) or []:
                    if not isinstance(level, dict):
                        continue
                    normalized_level = dict(level)
                    normalized_level["path"] = media_service._to_relative_media_path(level.get("path"))
                    normalized_levels.append(normalized_level)
                meta["pyramid_levels"] = normalized_levels

                if meta["original_path"] or meta["pyramid_levels"]:
                    meta["is_pano"] = True
        except Exception:
            pass

        return meta

    def _coerce_bool(self, value: Any) -> bool:
        return parse_bool(value, "boolean value")
    
    def list_routes(self, page: int = 1, limit: int = 20, search: str = None, 
                   route_type: str = None, is_active: bool = None) -> Dict[str, Any]:
        """
        List routes with optional filtering and pagination.
        
        Args:
            page: Page number (1-based)
            limit: Items per page
            search: Search term for route name/description
            route_type: Filter by route type
            is_active: Filter by active status
            
        Returns:
            Dict with routes, total, page, total_pages
        """
        if limit < 1:
            raise bad_request("limit must be at least 1")
        limit = min(limit, 100)
        if page < 1:
            raise bad_request("page must be at least 1")
        
        offset = (page - 1) * limit
        
        try:
            return self._list_routes_database(search, route_type, is_active, offset, limit, page)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error listing routes: {e}")
            raise APIError("Failed to list routes", "ROUTE_LIST_ERROR")
    
    def _list_routes_database(self, search: str, route_type: str, is_active: bool, 
                             offset: int, limit: int, page: int) -> Dict[str, Any]:
        """List routes from database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                schema = self._get_table_schema(conn, "routes")

                # Build WHERE clause
                where_conditions = ["1=1"]  # Always true base condition
                params = []
                
                if search:
                    where_conditions.append("(name ILIKE %s OR description ILIKE %s)")
                    params.extend([f"%{search}%", f"%{search}%"])
                
                if route_type and "route_type" in schema:
                    where_conditions.append("route_type = %s")
                    params.append(route_type)
                
                if is_active is not None and "is_active" in schema:
                    where_conditions.append("is_active = %s")
                    params.append(is_active)
                
                where_clause = " AND ".join(where_conditions)
                
                # Count total
                count_query = f"SELECT COUNT(*) FROM routes WHERE {where_clause}"
                cursor.execute(count_query, params)
                result = cursor.fetchone()
                total = result['count'] if isinstance(result, dict) else result[0]

                select_fields: List[str] = ["id", "name"]
                select_fields.append("description" if "description" in schema else "'' as description")
                select_fields.append("route_type" if "route_type" in schema else "'walking' as route_type")
                select_fields.append("total_distance" if "total_distance" in schema else "NULL as total_distance")
                select_fields.append("estimated_duration" if "estimated_duration" in schema else "NULL as estimated_duration")
                select_fields.append("difficulty_level" if "difficulty_level" in schema else "1 as difficulty_level")
                select_fields.append("elevation_gain" if "elevation_gain" in schema else "NULL as elevation_gain")
                select_fields.append("is_active" if "is_active" in schema else "true as is_active")
                select_fields.append(
                    "season_availability" if "season_availability" in schema else "NULL as season_availability"
                )
                select_fields.append("tags" if "tags" in schema else "NULL as tags")
                select_fields.append("created_at" if "created_at" in schema else "NULL as created_at")
                select_fields.append("updated_at" if "updated_at" in schema else "NULL as updated_at")

                query = f"""
                    SELECT {', '.join(select_fields)}
                    FROM routes
                    WHERE {where_clause}
                    ORDER BY name
                    LIMIT %s OFFSET %s
                """
                cursor.execute(query, params + [limit, offset])
                routes = cursor.fetchall()
                
                # Convert to list of dicts
                route_list = []
                for route in routes:
                    mapped = self._map_route_record(route)
                    route_list.append(mapped)
                
                return {
                    'routes': route_list,
                    'total': total,
                    'page': page,
                    'total_pages': math.ceil(total / limit) if total > 0 else 0,
                    'per_page': limit
                }
    
    def get_route(self, route_id: int, require_active: bool = False) -> Dict[str, Any]:
        """
        Get route by ID.
        
        Args:
            route_id: Route identifier
            require_active: Exclude inactive/soft-deleted routes when true
            
        Returns:
            Route data
        """
        try:
            return self._get_route_database(route_id, require_active=require_active)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error getting route {route_id}: {e}")
            raise APIError(f"Failed to get route {route_id}", "ROUTE_GET_ERROR")
    
    def _get_route_database(self, route_id: int, require_active: bool = False) -> Dict[str, Any]:
        """Get route from database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                schema = self._get_table_schema(conn, "routes")

                select_fields: List[str] = ["id", "name"]
                select_fields.append("description" if "description" in schema else "'' as description")
                select_fields.append("route_type" if "route_type" in schema else "'walking' as route_type")
                select_fields.append("total_distance" if "total_distance" in schema else "NULL as total_distance")
                select_fields.append("estimated_duration" if "estimated_duration" in schema else "NULL as estimated_duration")
                select_fields.append("difficulty_level" if "difficulty_level" in schema else "1 as difficulty_level")
                select_fields.append("elevation_gain" if "elevation_gain" in schema else "NULL as elevation_gain")
                select_fields.append("is_active" if "is_active" in schema else "true as is_active")
                select_fields.append(
                    "season_availability" if "season_availability" in schema else "NULL as season_availability"
                )
                select_fields.append("tags" if "tags" in schema else "NULL as tags")
                select_fields.append("created_at" if "created_at" in schema else "NULL as created_at")
                select_fields.append("updated_at" if "updated_at" in schema else "NULL as updated_at")

                if "waypoints" in schema:
                    select_fields.insert(select_fields.index("tags") + 1, "waypoints")

                # Geometry can be stored as PostGIS route_geometry or as a JSON column named geometry
                if "route_geometry" in schema:
                    select_fields.insert(
                        select_fields.index("tags") + 1,
                        "ST_AsGeoJSON(route_geometry::geometry) as geometry",
                    )
                elif "geometry" in schema:
                    select_fields.insert(select_fields.index("tags") + 1, "geometry")

                if "elevation_profile" in schema:
                    select_fields.append("elevation_profile")
                if "elevation_resolution" in schema:
                    select_fields.append("elevation_resolution")

                active_condition = " AND is_active = true" if require_active and "is_active" in schema else ""
                query = f"""
                    SELECT {', '.join(select_fields)}
                    FROM routes
                    WHERE id = %s{active_condition}
                """
                cursor.execute(query, (route_id,))
                result = cursor.fetchone()
                
                if not result:
                    raise not_found(f"Route with ID {route_id} not found")
                
                return self._map_route_record(result)

    def create_route(self, route_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new route (admin operation)."""
        if not isinstance(route_data, dict):
            raise bad_request("Request body must be an object")

        name = route_data.get("name")
        if not isinstance(name, str) or not name.strip():
            raise bad_request("name is required")

        description = route_data.get("description", "")
        if description is None:
            description = ""

        route_type = route_data.get("route_type") or "walking"
        if not isinstance(route_type, str) or not route_type.strip():
            raise bad_request("route_type must be a string")

        def _to_int(value, field):
            if value is None:
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                raise bad_request(f"Invalid {field} format")

        def _to_float(value, field):
            if value is None:
                return None
            return parse_finite_float(value, field)

        difficulty_level = _to_int(route_data.get("difficulty_level", 1), "difficulty_level")
        if difficulty_level is not None and not (1 <= difficulty_level <= 5):
            raise bad_request("difficulty_level must be between 1 and 5")

        estimated_duration = _to_int(route_data.get("estimated_duration"), "estimated_duration")
        total_distance = _to_float(route_data.get("total_distance"), "total_distance")
        elevation_gain = _to_int(route_data.get("elevation_gain"), "elevation_gain")

        is_circular = parse_bool(
            route_data.get("is_circular"), "is_circular", default=False
        )
        is_active = parse_bool(
            route_data.get("is_active"), "is_active", default=True
        )

        tags = route_data.get("tags", "")
        if isinstance(tags, list):
            tags = ", ".join([str(t).strip() for t in tags if str(t).strip()])
        if tags is None:
            tags = ""

        season_availability = route_data.get("season_availability")
        if season_availability is None:
            season_availability = ["spring", "summer", "autumn", "winter"]

        waypoints = route_data.get("waypoints")
        coordinates = route_data.get("coordinates")
        geometry = route_data.get("geometry")

        geometry_wkt = route_data.get("route_geometry_wkt") or self._linestring_wkt_from_coordinates(
            geometry or coordinates
        )

        if total_distance is None and coordinates:
            total_distance = self._calculate_distance_km(coordinates)

        conn_context = self._get_database_connection()
        with conn_context as conn:
            schema = self._get_table_schema(conn, "routes")

            columns: List[str] = []
            values: List[Any] = []
            placeholders: List[str] = []

            def add(col: str, placeholder: str, value: Any):
                columns.append(col)
                placeholders.append(placeholder)
                values.append(value)

            if "name" in schema:
                add("name", "%s", name.strip())
            if "description" in schema:
                add("description", "%s", description)
            if "route_type" in schema:
                add("route_type", "%s", route_type.strip())
            if "difficulty_level" in schema and difficulty_level is not None:
                add("difficulty_level", "%s", difficulty_level)
            if "estimated_duration" in schema and estimated_duration is not None:
                add("estimated_duration", "%s", estimated_duration)
            if "total_distance" in schema and total_distance is not None:
                add("total_distance", "%s", total_distance)
            if "elevation_gain" in schema and elevation_gain is not None:
                add("elevation_gain", "%s", elevation_gain)
            if "is_circular" in schema:
                add("is_circular", "%s", is_circular)
            if "season_availability" in schema and season_availability is not None:
                add("season_availability", "%s::jsonb", json.dumps(season_availability))
            if "tags" in schema:
                add("tags", "%s", tags)
            if "is_active" in schema:
                add("is_active", "%s", is_active)
            if "waypoints" in schema and waypoints is not None:
                add("waypoints", "%s::jsonb", json.dumps(waypoints))

            # Import metadata fields (optional, if schema supports it)
            for col in (
                "import_source",
                "original_filename",
                "import_metadata",
                "file_waypoints",
                "import_date",
                "imported_by",
            ):
                if col in schema and col in route_data and route_data.get(col) is not None:
                    if col in ("import_metadata", "file_waypoints"):
                        add(col, "%s::jsonb", json.dumps(route_data.get(col)))
                    else:
                        add(col, "%s", route_data.get(col))

            if "route_geometry" in schema and geometry_wkt:
                add("route_geometry", "ST_GeogFromText(%s)", geometry_wkt)

            if not columns:
                raise APIError("No writable columns available on routes table", "ROUTE_SCHEMA_ERROR", 500)

            with conn.cursor() as cursor:
                query = f"""
                    INSERT INTO routes ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                    RETURNING id
                """
                cursor.execute(query, values)
                row = cursor.fetchone()

        if not row:
            raise APIError("Failed to create route", "ROUTE_CREATE_ERROR", 500)

        route_id = row["id"] if isinstance(row, dict) else row[0]

        # Clear caches that may include route lists/statistics
        self.cache.pop("route_statistics", None)
        return self.get_route(int(route_id))

    def update_route(self, route_id: int, route_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing route (admin operation)."""
        if not route_id:
            raise bad_request("Route ID is required")
        if not isinstance(route_data, dict) or not route_data:
            raise bad_request("Request body is required")

        conn_context = self._get_database_connection()
        with conn_context as conn:
            schema = self._get_table_schema(conn, "routes")

            set_parts: List[str] = []
            values: List[Any] = []

            def set_if_present(field: str, column: str, cast: Optional[str] = None):
                if field not in route_data or column not in schema:
                    return
                val = route_data.get(field)
                if cast == "int":
                    if val is None:
                        set_parts.append(f"{column} = NULL")
                        return
                    try:
                        val = int(val)
                    except (TypeError, ValueError):
                        raise bad_request(f"Invalid {field} format")
                elif cast == "float":
                    if val is None:
                        set_parts.append(f"{column} = NULL")
                        return
                    val = parse_finite_float(val, field)
                elif cast == "jsonb":
                    set_parts.append(f"{column} = %s::jsonb")
                    values.append(json.dumps(val))
                    return
                elif cast == "bool":
                    val = parse_bool(val, field)

                set_parts.append(f"{column} = %s")
                values.append(val)

            set_if_present("name", "name")
            set_if_present("description", "description")
            set_if_present("route_type", "route_type")
            set_if_present("difficulty_level", "difficulty_level", "int")
            set_if_present("estimated_duration", "estimated_duration", "int")
            set_if_present("total_distance", "total_distance", "float")
            set_if_present("elevation_gain", "elevation_gain", "int")
            set_if_present("is_circular", "is_circular", "bool")
            set_if_present("is_active", "is_active", "bool")
            set_if_present("season_availability", "season_availability", "jsonb")
            set_if_present("waypoints", "waypoints", "jsonb")

            tags = route_data.get("tags")
            if tags is not None and "tags" in schema:
                if isinstance(tags, list):
                    tags = ", ".join([str(t).strip() for t in tags if str(t).strip()])
                set_parts.append("tags = %s")
                values.append(tags)

            # Geometry update (best-effort)
            if "route_geometry" in schema:
                geometry_wkt = route_data.get("route_geometry_wkt") or self._linestring_wkt_from_coordinates(
                    route_data.get("geometry") or route_data.get("coordinates")
                )
                if geometry_wkt:
                    set_parts.append("route_geometry = ST_GeogFromText(%s)")
                    values.append(geometry_wkt)

            if not set_parts:
                raise bad_request("No valid fields provided for update")

            if "updated_at" in schema:
                set_parts.append("updated_at = CURRENT_TIMESTAMP")

            values.append(route_id)

            with conn.cursor() as cursor:
                cursor.execute(
                    f"UPDATE routes SET {', '.join(set_parts)} WHERE id = %s RETURNING id",
                    values,
                )
                row = cursor.fetchone()

        if not row:
            raise not_found(f"Route with ID {route_id} not found")

        self.cache.pop("route_statistics", None)
        return self.get_route(route_id)

    def delete_route(self, route_id: int) -> None:
        """Delete a route (soft delete if supported)."""
        if not route_id:
            raise bad_request("Route ID is required")

        conn_context = self._get_database_connection()
        with conn_context as conn:
            schema = self._get_table_schema(conn, "routes")

            with conn.cursor() as cursor:
                if "is_active" in schema:
                    if "updated_at" in schema:
                        cursor.execute(
                            "UPDATE routes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING id",
                            (route_id,),
                        )
                    else:
                        cursor.execute(
                            "UPDATE routes SET is_active = false WHERE id = %s RETURNING id",
                            (route_id,),
                        )
                else:
                    cursor.execute("DELETE FROM routes WHERE id = %s RETURNING id", (route_id,))
                row = cursor.fetchone()

        if not row:
            raise not_found(f"Route with ID {route_id} not found")

        self.cache.pop("route_statistics", None)

    def get_route_geometry(self, route_id: int) -> Optional[Dict[str, Any]]:
        """Return route geometry/waypoint payload if available."""
        route = self.get_route(route_id)
        geometry = route.get("geometry")
        waypoints = route.get("waypoints") or []

        if geometry is None and not waypoints:
            return None

        return {
            "route_id": route_id,
            "geometry": geometry,
            "total_distance": route.get("total_distance"),
            "estimated_duration": route.get("estimated_duration"),
            "waypoints": waypoints,
        }

    def get_route_pois(self, route_id: int) -> List[Dict[str, Any]]:
        """Fetch POIs already associated with a route."""
        conn_context = self._get_database_connection()
        with conn_context as conn:
            route_pois_schema = self._get_table_schema(conn, "route_pois")
            route_poi_assoc_schema = self._get_table_schema(conn, "route_poi_associations")

            with conn.cursor() as cursor:
                if route_pois_schema:
                    select_fields = [
                        "rp.poi_id",
                        "rp.order_in_route",
                        "rp.is_mandatory" if "is_mandatory" in route_pois_schema else "true as is_mandatory",
                        (
                            "rp.estimated_time_at_poi"
                            if "estimated_time_at_poi" in route_pois_schema
                            else "15 as estimated_time_at_poi"
                        ),
                        "rp.notes" if "notes" in route_pois_schema else "'' as notes",
                        "p.name",
                        "ST_Y(p.location::geometry) as lat",
                        "ST_X(p.location::geometry) as lon",
                        "p.category",
                        "p.description",
                    ]
                    cursor.execute(
                        f"""
                        SELECT {', '.join(select_fields)}
                        FROM route_pois rp
                        LEFT JOIN pois p ON p.id = rp.poi_id
                        WHERE rp.route_id = %s
                        ORDER BY rp.order_in_route
                        """,
                        (route_id,),
                    )
                elif route_poi_assoc_schema:
                    select_fields = [
                        "rpa.poi_id",
                        "rpa.sequence_order as order_in_route",
                        "rpa.is_mandatory" if "is_mandatory" in route_poi_assoc_schema else "true as is_mandatory",
                        (
                            "rpa.estimated_time_at_poi"
                            if "estimated_time_at_poi" in route_poi_assoc_schema
                            else "15 as estimated_time_at_poi"
                        ),
                        "rpa.notes" if "notes" in route_poi_assoc_schema else "'' as notes",
                        "p.name",
                        "ST_Y(p.location::geometry) as lat",
                        "ST_X(p.location::geometry) as lon",
                        "p.category",
                        "p.description",
                    ]
                    cursor.execute(
                        f"""
                        SELECT {', '.join(select_fields)}
                        FROM route_poi_associations rpa
                        LEFT JOIN pois p ON p.id = rpa.poi_id
                        WHERE rpa.route_id = %s
                        ORDER BY rpa.sequence_order
                        """,
                        (route_id,),
                    )
                else:
                    return []

                rows = cursor.fetchall() or []

        return [dict(row) for row in rows]

    def _list_active_pois_with_location(self) -> List[Dict[str, Any]]:
        """Load active POIs that have coordinates."""
        conn_context = self._get_database_connection()
        with conn_context as conn:
            pois_schema = self._get_table_schema(conn, "pois")
            active_condition = "AND p.is_active = true" if "is_active" in pois_schema else ""

            with conn.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT p.id, p.name, p.category, p.description,
                           ST_Y(p.location::geometry) as lat,
                           ST_X(p.location::geometry) as lon
                    FROM pois p
                    WHERE p.location IS NOT NULL
                    {active_condition}
                    """
                )
                rows = cursor.fetchall() or []

        return [dict(row) for row in rows]

    def find_nearby_pois(self, route_id: int, max_distance_meters: int = 500) -> List[Dict[str, Any]]:
        """Find unassociated POIs close to a route geometry or waypoint chain."""
        max_distance = parse_finite_float(max_distance_meters, "max_distance_meters")
        if max_distance <= 0:
            raise bad_request("max_distance_meters must be greater than 0")

        # Load the route once. Prefer its real LineString over waypoint/POI
        # approximations so the native PostGIS query and fallback agree.
        route = self.get_route(route_id)
        geometry_points = self._extract_route_points({"geometry": route.get("geometry")})
        waypoint_points = self._extract_route_points({"waypoints": route.get("waypoints")})
        route_points = geometry_points or waypoint_points or self._extract_route_points(route)
        if not route_points:
            return []

        conn_context = self._get_database_connection()
        with conn_context as conn:
            routes_schema = self._get_table_schema(conn, "routes")
            pois_schema = self._get_table_schema(conn, "pois")
            route_pois_schema = self._get_table_schema(conn, "route_pois")
            route_poi_assoc_schema = self._get_table_schema(conn, "route_poi_associations")

            if "location" not in pois_schema:
                return []

            poi_active_condition = "AND p.is_active = true" if "is_active" in pois_schema else ""
            native_exclusions = []
            if {"route_id", "poi_id"}.issubset(route_pois_schema):
                native_exclusions.append(
                    "NOT EXISTS (SELECT 1 FROM route_pois rp "
                    "WHERE rp.route_id = r.id AND rp.poi_id = p.id)"
                )
            if {"route_id", "poi_id"}.issubset(route_poi_assoc_schema):
                native_exclusions.append(
                    "NOT EXISTS (SELECT 1 FROM route_poi_associations rpa "
                    "WHERE rpa.route_id = r.id AND rpa.poi_id = p.id)"
                )
            native_exclusion_sql = "\nAND ".join(native_exclusions)
            if native_exclusion_sql:
                native_exclusion_sql = f"AND {native_exclusion_sql}"

            # Canonical schema: both columns are geography values with GIST
            # indexes. Distance filtering and sorting stay entirely in PostGIS.
            use_native_postgis = (
                routes_schema.get("route_geometry") == "geography"
                and pois_schema.get("location") == "geography"
                and bool(geometry_points)
            )
            if use_native_postgis:
                with conn.cursor() as cursor:
                    cursor.execute(
                        f"""
                        SELECT p.id, p.name, p.category, p.description,
                               ST_Y(p.location::geometry) AS lat,
                               ST_X(p.location::geometry) AS lon,
                               ST_Distance(r.route_geometry, p.location) AS distance_meters,
                               ST_Y(ST_ClosestPoint(r.route_geometry::geometry, p.location::geometry)) AS closest_lat,
                               ST_X(ST_ClosestPoint(r.route_geometry::geometry, p.location::geometry)) AS closest_lng
                        FROM routes r
                        JOIN pois p ON p.location IS NOT NULL
                        WHERE r.id = %s
                          AND r.route_geometry IS NOT NULL
                          {poi_active_condition}
                          AND ST_DWithin(r.route_geometry, p.location, %s)
                          {native_exclusion_sql}
                        ORDER BY distance_meters ASC, p.id ASC
                        """,
                        [route_id, max_distance],
                    )
                    rows = cursor.fetchall() or []

                results = []
                for row in rows:
                    item = dict(row)
                    closest_lat = item.pop("closest_lat", None)
                    closest_lng = item.pop("closest_lng", None)
                    if item.get("distance_meters") is not None:
                        item["distance_meters"] = round(float(item["distance_meters"]), 2)
                    if closest_lat is not None and closest_lng is not None:
                        item["closest_route_point"] = {
                            "lat": round(float(closest_lat), 6),
                            "lng": round(float(closest_lng), 6),
                        }
                    results.append(item)
                return results

            # Older schemas may store only JSON geometry/waypoints. Bound the
            # candidate set by an expanded route envelope before applying the
            # exact existing polyline calculation in Python.
            candidate_limit = 500
            latitudes = [point[0] for point in route_points]
            longitudes = [point[1] for point in route_points]
            mid_latitude = (min(latitudes) + max(latitudes)) / 2.0
            latitude_buffer = max_distance / 111_320.0
            longitude_scale = max(abs(math.cos(math.radians(mid_latitude))), 0.01)
            longitude_buffer = max_distance / (111_320.0 * longitude_scale)

            min_latitude = max(-90.0, min(latitudes) - latitude_buffer)
            max_latitude = min(90.0, max(latitudes) + latitude_buffer)
            min_longitude = max(-180.0, min(longitudes) - longitude_buffer)
            max_longitude = min(180.0, max(longitudes) + longitude_buffer)

            fallback_exclusions = []
            fallback_params: List[Any] = [
                min_latitude,
                max_latitude,
                min_longitude,
                max_longitude,
            ]
            if {"route_id", "poi_id"}.issubset(route_pois_schema):
                fallback_exclusions.append(
                    "NOT EXISTS (SELECT 1 FROM route_pois rp "
                    "WHERE rp.route_id = %s AND rp.poi_id = p.id)"
                )
                fallback_params.append(route_id)
            if {"route_id", "poi_id"}.issubset(route_poi_assoc_schema):
                fallback_exclusions.append(
                    "NOT EXISTS (SELECT 1 FROM route_poi_associations rpa "
                    "WHERE rpa.route_id = %s AND rpa.poi_id = p.id)"
                )
                fallback_params.append(route_id)
            fallback_exclusion_sql = "\nAND ".join(fallback_exclusions)
            if fallback_exclusion_sql:
                fallback_exclusion_sql = f"AND {fallback_exclusion_sql}"
            fallback_params.append(candidate_limit)

            with conn.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT p.id, p.name, p.category, p.description,
                           ST_Y(p.location::geometry) AS lat,
                           ST_X(p.location::geometry) AS lon
                    FROM pois p
                    WHERE p.location IS NOT NULL
                      {poi_active_condition}
                      AND ST_Y(p.location::geometry) BETWEEN %s AND %s
                      AND ST_X(p.location::geometry) BETWEEN %s AND %s
                      {fallback_exclusion_sql}
                    ORDER BY p.id ASC
                    LIMIT %s
                    """,
                    fallback_params,
                )
                candidates = cursor.fetchall() or []

        results: List[Dict[str, Any]] = []
        for poi in candidates:
            lat = poi.get("lat")
            lng = poi.get("lon")
            if lat is None or lng is None:
                continue

            distance_meters, closest_point = self._distance_to_polyline((float(lat), float(lng)), route_points)
            if distance_meters > max_distance:
                continue

            item = dict(poi)
            item["distance_meters"] = round(distance_meters, 2)
            if closest_point:
                item["closest_route_point"] = {
                    "lat": round(closest_point[0], 6),
                    "lng": round(closest_point[1], 6),
                }
            results.append(item)

        results.sort(key=lambda item: item.get("distance_meters", float("inf")))
        return results

    def auto_associate_nearby_pois(
        self,
        route_id: int,
        max_distance_meters: int = 500,
        auto_confirm: bool = False,
        categories: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Optionally associate nearby POIs while preserving legacy response shape."""
        nearby_pois = self.find_nearby_pois(route_id, max_distance_meters)

        allowed_categories = {str(category) for category in (categories or []) if str(category).strip()}
        if allowed_categories:
            nearby_pois = [poi for poi in nearby_pois if str(poi.get("category")) in allowed_categories]

        if not nearby_pois:
            return {
                "success": True,
                "message": "Rota yakınında POI bulunamadı",
                "found_pois": [],
                "associated_count": 0,
                "total_found": 0,
            }

        if not auto_confirm:
            return {
                "success": True,
                "message": f"{len(nearby_pois)} POI bulundu",
                "found_pois": nearby_pois,
                "associated_count": 0,
                "requires_confirmation": True,
                "total_found": len(nearby_pois),
            }

        existing_pois = self.get_route_pois(route_id)
        max_order = max((int(poi.get("order_in_route") or 0) for poi in existing_pois), default=0)

        new_associations = []
        for offset, poi in enumerate(nearby_pois, start=1):
            distance_value = poi.get("distance_meters")
            try:
                distance_note = int(float(distance_value))
            except (TypeError, ValueError):
                distance_note = 0
            new_associations.append(
                {
                    "poi_id": poi["id"],
                    "order_in_route": max_order + offset,
                    "is_mandatory": False,
                    "estimated_time_at_poi": 10,
                    "notes": f"Otomatik eklendi - {distance_note}m mesafede",
                }
            )

        existing_associations = [
            {
                "poi_id": poi["poi_id"],
                "order_in_route": poi.get("order_in_route"),
                "is_mandatory": poi.get("is_mandatory", True),
                "estimated_time_at_poi": poi.get("estimated_time_at_poi", 15),
                "notes": poi.get("notes", ""),
            }
            for poi in existing_pois
            if poi.get("poi_id") is not None
        ]

        self.associate_pois(route_id, existing_associations + new_associations)
        return {
            "success": True,
            "message": f"{len(new_associations)} POI otomatik olarak rotaya eklendi",
            "found_pois": nearby_pois,
            "associated_count": len(new_associations),
            "total_found": len(nearby_pois),
        }

    def associate_pois(self, route_id: int, poi_ids: List[Any]) -> Dict[str, Any]:
        """Associate POIs to a route (best-effort; supports multiple schemas)."""
        if not route_id:
            raise bad_request("Route ID is required")

        if not poi_ids:
            return {"associated": 0, "table": None}

        normalized: List[Dict[str, Any]] = []
        seen_poi_ids = set()
        for idx, item in enumerate(poi_ids, start=1):
            order_in_route = idx
            is_mandatory = True
            estimated_time_at_poi = 15
            notes = ""

            if isinstance(item, dict):
                poi_id = item.get("poi_id", item.get("id"))
                order_in_route = item.get("order_in_route", item.get("sequence_order", idx))
                is_mandatory = parse_bool(
                    item.get("is_mandatory"), "is_mandatory", default=True
                )
                estimated_time_at_poi = item.get("estimated_time_at_poi", 15)
                notes = item.get("notes", "") or ""
            else:
                poi_id = item

            try:
                poi_id = int(poi_id)
            except (TypeError, ValueError):
                continue

            if poi_id in seen_poi_ids:
                continue
            seen_poi_ids.add(poi_id)

            try:
                order_in_route = int(order_in_route)
            except (TypeError, ValueError):
                order_in_route = idx

            try:
                estimated_time_at_poi = int(estimated_time_at_poi)
            except (TypeError, ValueError):
                estimated_time_at_poi = 15

            normalized.append(
                {
                    "poi_id": poi_id,
                    "order_in_route": max(1, order_in_route),
                    "is_mandatory": is_mandatory,
                    "estimated_time_at_poi": max(1, estimated_time_at_poi),
                    "notes": notes,
                }
            )

        if not normalized:
            return {"associated": 0, "table": None}

        conn_context = self._get_database_connection()
        with conn_context as conn:
            route_pois_schema = self._get_table_schema(conn, "route_pois")
            route_poi_assoc_schema = self._get_table_schema(conn, "route_poi_associations")

            with conn.cursor() as cursor:
                if route_pois_schema:
                    for association in normalized:
                        columns = ["route_id", "poi_id"]
                        placeholders = ["%s", "%s"]
                        values: List[Any] = [route_id, association["poi_id"]]
                        update_parts = []

                        if "order_in_route" in route_pois_schema:
                            columns.append("order_in_route")
                            placeholders.append("%s")
                            values.append(association["order_in_route"])
                            update_parts.append("order_in_route = EXCLUDED.order_in_route")
                        if "is_mandatory" in route_pois_schema:
                            columns.append("is_mandatory")
                            placeholders.append("%s")
                            values.append(association["is_mandatory"])
                            update_parts.append("is_mandatory = EXCLUDED.is_mandatory")
                        if "estimated_time_at_poi" in route_pois_schema:
                            columns.append("estimated_time_at_poi")
                            placeholders.append("%s")
                            values.append(association["estimated_time_at_poi"])
                            update_parts.append("estimated_time_at_poi = EXCLUDED.estimated_time_at_poi")
                        if "notes" in route_pois_schema:
                            columns.append("notes")
                            placeholders.append("%s")
                            values.append(association["notes"])
                            update_parts.append("notes = EXCLUDED.notes")

                        conflict_sql = (
                            f"DO UPDATE SET {', '.join(update_parts)}" if update_parts else "DO NOTHING"
                        )
                        cursor.execute(
                            f"""
                            INSERT INTO route_pois ({', '.join(columns)})
                            VALUES ({', '.join(placeholders)})
                            ON CONFLICT (route_id, poi_id) {conflict_sql}
                            """,
                            values,
                        )
                    table_used = "route_pois"

                elif route_poi_assoc_schema:
                    for association in normalized:
                        columns = ["route_id", "poi_id"]
                        placeholders = ["%s", "%s"]
                        values = [route_id, association["poi_id"]]
                        update_parts = []

                        if "sequence_order" in route_poi_assoc_schema:
                            columns.append("sequence_order")
                            placeholders.append("%s")
                            values.append(association["order_in_route"])
                            update_parts.append("sequence_order = EXCLUDED.sequence_order")
                        if "is_mandatory" in route_poi_assoc_schema:
                            columns.append("is_mandatory")
                            placeholders.append("%s")
                            values.append(association["is_mandatory"])
                            update_parts.append("is_mandatory = EXCLUDED.is_mandatory")
                        if "estimated_time_at_poi" in route_poi_assoc_schema:
                            columns.append("estimated_time_at_poi")
                            placeholders.append("%s")
                            values.append(association["estimated_time_at_poi"])
                            update_parts.append("estimated_time_at_poi = EXCLUDED.estimated_time_at_poi")
                        if "notes" in route_poi_assoc_schema:
                            columns.append("notes")
                            placeholders.append("%s")
                            values.append(association["notes"])
                            update_parts.append("notes = EXCLUDED.notes")

                        conflict_sql = (
                            f"DO UPDATE SET {', '.join(update_parts)}" if update_parts else "DO NOTHING"
                        )
                        cursor.execute(
                            f"""
                            INSERT INTO route_poi_associations ({', '.join(columns)})
                            VALUES ({', '.join(placeholders)})
                            ON CONFLICT (route_id, poi_id) {conflict_sql}
                            """,
                            values,
                        )
                    table_used = "route_poi_associations"

                else:
                    raise APIError(
                        "No route-POI association table found (expected route_pois or route_poi_associations)",
                        "ROUTE_POI_SCHEMA_ERROR",
                        500,
                    )

        self.cache.pop("route_statistics", None)
        return {"associated": len(normalized), "table": table_used}
    
    def search_routes(self, query: str, route_type: str = None, limit: int = 50) -> Dict[str, Any]:
        """
        Search routes by name or description.
        
        Args:
            query: Search query
            route_type: Optional route type filter
            limit: Maximum results
            
        Returns:
            Search results with relevance scoring
        """
        if not query:
            raise bad_request("Search query is required")
        
        if limit < 1:
            raise bad_request("limit must be at least 1")
        limit = min(limit, 100)
        
        try:
            return self._search_routes_database(query, route_type, limit)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error searching routes: {e}")
            raise APIError("Failed to search routes", "ROUTE_SEARCH_ERROR")
    
    def _search_routes_database(self, query: str, route_type: str, limit: int) -> Dict[str, Any]:
        """Search routes in database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                schema = self._get_table_schema(conn, "routes")

                # Build WHERE clause and parameters in the same order as the
                # placeholders. Keeping the search predicate in this list
                # prevents route_type from being bound to a search placeholder.
                where_conditions = ["1=1"]
                params = []

                if "is_active" in schema:
                    where_conditions.append("is_active = true")
                
                if route_type and "route_type" in schema:
                    where_conditions.append("route_type = %s")
                    params.append(route_type)

                where_conditions.append("(name ILIKE %s OR description ILIKE %s)")
                params.extend([f"%{query}%", f"%{query}%"])
                
                where_clause = " AND ".join(where_conditions)

                select_fields: List[str] = ["id", "name"]
                select_fields.append("description" if "description" in schema else "'' as description")
                select_fields.append("route_type" if "route_type" in schema else "'walking' as route_type")
                select_fields.append("total_distance" if "total_distance" in schema else "NULL as total_distance")
                select_fields.append("estimated_duration" if "estimated_duration" in schema else "NULL as estimated_duration")
                select_fields.append("difficulty_level" if "difficulty_level" in schema else "1 as difficulty_level")
                select_fields.append("elevation_gain" if "elevation_gain" in schema else "NULL as elevation_gain")
                select_fields.append("is_active" if "is_active" in schema else "true as is_active")
                select_fields.append(
                    "season_availability" if "season_availability" in schema else "NULL as season_availability"
                )
                select_fields.append("tags" if "tags" in schema else "NULL as tags")
                select_fields.append("created_at" if "created_at" in schema else "NULL as created_at")
                select_fields.append("updated_at" if "updated_at" in schema else "NULL as updated_at")

                search_query = f"""
                    SELECT {', '.join(select_fields)}
                    FROM routes
                    WHERE {where_clause}
                    ORDER BY
                        CASE WHEN name ILIKE %s THEN 1 ELSE 2 END,
                        name
                    LIMIT %s
                """
                
                # Add query parameter for ordering
                params.append(f"%{query}%")
                params.append(limit)
                
                cursor.execute(search_query, params)
                routes = cursor.fetchall()
                
                # Convert to list of dicts
                route_list = []
                for route in routes:
                    route_list.append(self._map_route_record(route))
                
                return {
                    'results': route_list,
                    'total': len(route_list),
                    'query': query
                }

    def add_route_media(
        self,
        route_id: int,
        file: FileStorage,
        lat: float,
        lng: float,
        caption: Optional[str],
        is_primary: bool = False,
        requested_media_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add media file for a route."""
        if not file or not file.filename:
            raise bad_request("File is required")

        requested_type = media_service._normalize_requested_media_type(
            requested_media_type,
            allow_panorama=True,
        )
        validation_type = "image" if requested_type == "panorama" else requested_type
        validation_result = media_service.validate_file(file, validation_type)
        if not validation_result["is_valid"]:
            raise bad_request(
                "File validation failed",
                details={
                    "validation_errors": validation_result["errors"],
                    "warnings": validation_result.get("warnings", []),
                },
            )

        filename = secure_filename(file.filename)
        extension = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex}{extension}"

        media_dir = Path("poi_media") / "route_media" / str(route_id)
        media_dir.mkdir(parents=True, exist_ok=True)

        file_path = media_dir / unique_name
        created_paths: List[Path] = []

        try:
            file.save(str(file_path))
            created_paths.append(file_path)

            thumbnail_path = media_service.generate_thumbnail(str(file_path))
            if thumbnail_path:
                created_paths.append(Path(thumbnail_path))

            conn_context = self._get_database_connection()
            if conn_context is None:
                raise APIError("Database connection failed", "DB_CONN_ERROR")

            stored_media_type = requested_type or validation_result["file_info"]["detected_type"]

            with conn_context as conn:
                with conn.cursor() as cursor:
                    query = (
                        "INSERT INTO route_media (route_id, file_path, thumbnail_path, lat, lng, caption, is_primary, media_type) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                        "RETURNING id, route_id, file_path, thumbnail_path, lat, lng, caption, is_primary, media_type, uploaded_at"
                    )
                    cursor.execute(query, (
                        route_id,
                        str(file_path),
                        thumbnail_path,
                        lat,
                        lng,
                        caption,
                        is_primary,
                        stored_media_type,
                    ))
                    result = cursor.fetchone()
                    if not result:
                        raise APIError("Failed to persist route media", "ROUTE_MEDIA_UPLOAD_ERROR", 500)
        except APIError:
            for created_path in reversed(created_paths):
                try:
                    created_path.unlink(missing_ok=True)
                except Exception:
                    pass
            if media_dir.exists() and not any(media_dir.iterdir()):
                media_dir.rmdir()
            raise
        except Exception as exc:
            for created_path in reversed(created_paths):
                try:
                    created_path.unlink(missing_ok=True)
                except Exception:
                    pass
            if media_dir.exists() and not any(media_dir.iterdir()):
                media_dir.rmdir()
            logger.error("Failed to add route media for route %s: %s", route_id, exc)
            raise APIError("Failed to upload route media", "ROUTE_MEDIA_UPLOAD_ERROR", 500)

        media_record = dict(result)
        if media_record.get('uploaded_at'):
            media_record['uploaded_at'] = media_record['uploaded_at'].isoformat()
        media_record['filename'] = Path(media_record['file_path']).name if media_record.get('file_path') else unique_name
        media_record['latitude'] = media_record.get('lat')
        media_record['longitude'] = media_record.get('lng')
        return media_record

    def list_route_media(self, route_id: int) -> List[Dict[str, Any]]:
        """List media files for a route."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            raise APIError("Database connection failed", "DB_CONN_ERROR")

        with conn_context as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT id, route_id, file_path, thumbnail_path, preview_path, lat, lng,
                           caption, is_primary, media_type, uploaded_at
                    FROM route_media
                    WHERE route_id = %s
                    ORDER BY is_primary DESC, uploaded_at DESC
                """
                cursor.execute(query, (route_id,))
                rows = cursor.fetchall()

        return [self._normalize_route_media_record(row) for row in rows]

    def _get_route_media_item(self, route_id: int, media_identifier: Any) -> Dict[str, Any]:
        """Resolve a route media item by DB id or filename-like identifier."""
        identifier = str(media_identifier).strip()
        if not identifier:
            raise bad_request("Media identifier is required")

        conn_context = self._get_database_connection()
        if conn_context is None:
            raise APIError("Database connection failed", "DB_CONN_ERROR")

        with conn_context as conn:
            with conn.cursor() as cursor:
                params: List[Any] = [route_id]
                conditions = ["route_id = %s"]

                if identifier.isdigit():
                    conditions.append("CAST(id AS TEXT) = %s")
                    params.append(identifier)

                like_pattern = f"%{identifier}%"
                conditions.append("(file_path LIKE %s OR COALESCE(thumbnail_path, '') LIKE %s OR COALESCE(preview_path, '') LIKE %s)")
                params.extend([like_pattern, like_pattern, like_pattern])

                cursor.execute(
                    f"""
                    SELECT id, route_id, file_path, thumbnail_path, preview_path, lat, lng,
                           caption, is_primary, media_type, uploaded_at
                    FROM route_media
                    WHERE {' AND '.join(['route_id = %s', '(' + ' OR '.join(conditions[1:]) + ')'])}
                    ORDER BY uploaded_at DESC NULLS LAST
                    LIMIT 1
                    """,
                    params,
                )
                row = cursor.fetchone()

        if not row:
            raise not_found("Media not found")
        return self._normalize_route_media_record(row)

    def delete_route_media_asset(self, route_id: int, media_identifier: Any) -> Dict[str, Any]:
        """Delete route media by DB id or filename."""
        self.get_route(route_id)
        media_item = self._get_route_media_item(route_id, media_identifier)
        filename = media_item.get("filename")
        if not filename:
            raise not_found("Media not found")

        if not self._get_legacy_media_manager().delete_route_media(route_id, filename):
            raise not_found("Media not found or could not be deleted")

        return {"success": True, "message": "Media deleted successfully"}

    def update_route_media_asset(
        self,
        route_id: int,
        media_identifier: Any,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update route media metadata by DB id or filename."""
        if not isinstance(payload, dict) or not payload:
            raise bad_request("No data provided")

        self.get_route(route_id)
        media_item = self._get_route_media_item(route_id, media_identifier)
        media_id = media_item.get("id")
        if media_id is None:
            raise not_found("Media not found")

        lat_provided = any(key in payload for key in ("lat", "latitude"))
        lng_provided = any(key in payload for key in ("lng", "longitude"))
        lat_value = payload.get("lat", payload.get("latitude"))
        lng_value = payload.get("lng", payload.get("longitude"))

        set_parts: List[str] = []
        values: List[Any] = []

        if "caption" in payload:
            set_parts.append("caption = %s")
            values.append(payload.get("caption") or "")

        if "is_primary" in payload:
            is_primary = self._coerce_bool(payload.get("is_primary"))
            set_parts.append("is_primary = %s")
            values.append(is_primary)
        else:
            is_primary = None

        if "media_type" in payload:
            media_type = str(payload.get("media_type") or "").strip().lower()
            if media_type == "photo":
                media_type = "image"
            if media_type not in ("image", "video", "audio", "model_3d", "panorama"):
                raise bad_request("Invalid media_type value")
            set_parts.append("media_type = %s")
            values.append(media_type)

        if lat_provided or lng_provided:
            if not (lat_provided and lng_provided):
                raise bad_request("Both latitude and longitude are required")

            if lat_value is None and lng_value is None:
                set_parts.append("lat = NULL")
                set_parts.append("lng = NULL")
            else:
                try:
                    lat_float = float(lat_value)
                    lng_float = float(lng_value)
                except (TypeError, ValueError):
                    raise bad_request("Invalid coordinate values")
                if not (-90 <= lat_float <= 90 and -180 <= lng_float <= 180):
                    raise bad_request("Invalid coordinate values")
                set_parts.append("lat = %s")
                values.append(lat_float)
                set_parts.append("lng = %s")
                values.append(lng_float)

        if not set_parts:
            raise bad_request("No valid fields to update")

        conn_context = self._get_database_connection()
        if conn_context is None:
            raise APIError("Database connection failed", "DB_CONN_ERROR")

        with conn_context as conn:
            with conn.cursor() as cursor:
                if is_primary is True:
                    cursor.execute(
                        "UPDATE route_media SET is_primary = false WHERE route_id = %s AND id <> %s",
                        (route_id, media_id),
                    )

                values.append(media_id)
                cursor.execute(
                    f"""
                    UPDATE route_media
                    SET {', '.join(set_parts)}
                    WHERE id = %s
                    RETURNING id, route_id, file_path, thumbnail_path, preview_path, lat, lng,
                              caption, is_primary, media_type, uploaded_at
                    """,
                    values,
                )
                updated_row = cursor.fetchone()

        if not updated_row:
            raise not_found("Media not found")

        return {
            "success": True,
            "message": "Media updated successfully",
            "media": self._normalize_route_media_record(updated_row),
        }

    def update_route_media_location_asset(self, route_id: int, media_identifier: Any, lat: float, lng: float) -> Dict[str, Any]:
        """Update route media coordinates."""
        result = self.update_route_media_asset(
            route_id,
            media_identifier,
            {"lat": lat, "lng": lng},
        )
        return {
            "success": True,
            "message": "Media location updated successfully",
            "media": result["media"],
        }

    def delete_route_media_location_asset(self, route_id: int, media_identifier: Any) -> Dict[str, Any]:
        """Clear route media coordinates."""
        result = self.update_route_media_asset(
            route_id,
            media_identifier,
            {"lat": None, "lng": None},
        )
        return {
            "success": True,
            "message": "Media location removed successfully",
            "media": result["media"],
        }

    def auto_route_media_location_asset(self, route_id: int, media_identifier: Any) -> Dict[str, Any]:
        """Extract EXIF coordinates for route media and persist them."""
        self.get_route(route_id)
        media_item = self._get_route_media_item(route_id, media_identifier)
        filename = media_item.get("filename")
        if not filename:
            raise not_found("Media not found")

        coords = self._get_legacy_media_manager().auto_set_route_media_location(route_id, filename)
        if not coords:
            raise not_found("No EXIF location found")

        updated = self._get_route_media_item(route_id, filename)
        return {
            "success": True,
            "message": "Media location extracted from EXIF",
            "media": updated,
        }
    
    def get_route_statistics(self) -> Dict[str, Any]:
        """Get route statistics."""
        cache_key = "route_statistics"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        
        try:
            stats = self._get_route_statistics_database()
            
            self._cache_set(cache_key, stats)
            return stats
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error getting route statistics: {e}")
            raise APIError("Failed to get route statistics", "ROUTE_STATS_ERROR")
    
    def _get_route_statistics_database(self) -> Dict[str, Any]:
        """Get route statistics from database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                schema = self._get_table_schema(conn, "routes")

                # Get basic counts
                cursor.execute("SELECT COUNT(*) FROM routes")
                result = cursor.fetchone()
                total_all = result['count'] if isinstance(result, dict) else result[0]

                if "is_active" in schema:
                    cursor.execute("SELECT COUNT(*) FROM routes WHERE is_active = true")
                    result = cursor.fetchone()
                    total_active = result['count'] if isinstance(result, dict) else result[0]
                else:
                    total_active = total_all
                
                # Get counts by type
                type_counts = []
                if "route_type" in schema:
                    if "is_active" in schema:
                        cursor.execute("""
                            SELECT route_type, COUNT(*) as count
                            FROM routes
                            WHERE is_active = true
                            GROUP BY route_type
                        """)
                    else:
                        cursor.execute("""
                            SELECT route_type, COUNT(*) as count
                            FROM routes
                            GROUP BY route_type
                        """)
                    type_counts = cursor.fetchall()
                
                by_type = {}
                for row in type_counts:
                    by_type[row['route_type']] = row['count']
                
                return {
                    'total_routes': total_all,
                    'active_routes': total_active,
                    'inactive_routes': total_all - total_active,
                    'by_type': by_type,
                    'timestamp': datetime.now().isoformat()
                }


# Global route service instance
route_service = RouteService()
