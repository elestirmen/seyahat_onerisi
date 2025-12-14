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
from typing import Dict, List, Any, Optional
from datetime import datetime

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.middleware.error_handler import APIError, bad_request, not_found
from app.services.media_service import media_service

logger = logging.getLogger(__name__)


class RouteService:
    """Service class for route business logic operations."""
    
    def __init__(self):
        self.cache: Dict[str, Any] = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes

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
        if limit > 100:
            limit = 100
        if page < 1:
            page = 1
        
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
    
    def get_route(self, route_id: int) -> Dict[str, Any]:
        """
        Get route by ID.
        
        Args:
            route_id: Route identifier
            
        Returns:
            Route data
        """
        try:
            return self._get_route_database(route_id)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error getting route {route_id}: {e}")
            raise APIError(f"Failed to get route {route_id}", "ROUTE_GET_ERROR")
    
    def _get_route_database(self, route_id: int) -> Dict[str, Any]:
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

                query = f"""
                    SELECT {', '.join(select_fields)}
                    FROM routes
                    WHERE id = %s
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
            try:
                return float(value)
            except (TypeError, ValueError):
                raise bad_request(f"Invalid {field} format")

        difficulty_level = _to_int(route_data.get("difficulty_level", 1), "difficulty_level")
        if difficulty_level is not None and not (1 <= difficulty_level <= 5):
            raise bad_request("difficulty_level must be between 1 and 5")

        estimated_duration = _to_int(route_data.get("estimated_duration"), "estimated_duration")
        total_distance = _to_float(route_data.get("total_distance"), "total_distance")
        elevation_gain = _to_int(route_data.get("elevation_gain"), "elevation_gain")

        is_circular = bool(route_data.get("is_circular", False))
        is_active = bool(route_data.get("is_active", True))

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
                    try:
                        val = float(val)
                    except (TypeError, ValueError):
                        raise bad_request(f"Invalid {field} format")
                elif cast == "jsonb":
                    set_parts.append(f"{column} = %s::jsonb")
                    values.append(json.dumps(val))
                    return
                elif cast == "bool":
                    val = bool(val)

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

    def associate_pois(self, route_id: int, poi_ids: List[Any]) -> Dict[str, Any]:
        """Associate POIs to a route (best-effort; supports multiple schemas)."""
        if not route_id:
            raise bad_request("Route ID is required")

        if not poi_ids:
            return {"associated": 0, "table": None}

        normalized: List[int] = []
        for item in poi_ids:
            if isinstance(item, dict):
                item = item.get("poi_id", item.get("id"))
            try:
                normalized.append(int(item))
            except (TypeError, ValueError):
                continue

        if not normalized:
            return {"associated": 0, "table": None}

        conn_context = self._get_database_connection()
        with conn_context as conn:
            route_pois_schema = self._get_table_schema(conn, "route_pois")
            route_poi_assoc_schema = self._get_table_schema(conn, "route_poi_associations")

            with conn.cursor() as cursor:
                inserted = 0

                if route_pois_schema:
                    for idx, poi_id in enumerate(normalized, start=1):
                        cursor.execute(
                            """
                            INSERT INTO route_pois (route_id, poi_id, order_in_route)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (route_id, poi_id) DO NOTHING
                            """,
                            (route_id, poi_id, idx),
                        )
                        inserted += max(cursor.rowcount, 0)
                    table_used = "route_pois"

                elif route_poi_assoc_schema:
                    for idx, poi_id in enumerate(normalized, start=1):
                        cursor.execute(
                            """
                            INSERT INTO route_poi_associations (route_id, poi_id, sequence_order)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (route_id, poi_id) DO NOTHING
                            """,
                            (route_id, poi_id, idx),
                        )
                        inserted += max(cursor.rowcount, 0)
                    table_used = "route_poi_associations"

                else:
                    raise APIError(
                        "No route-POI association table found (expected route_pois or route_poi_associations)",
                        "ROUTE_POI_SCHEMA_ERROR",
                        500,
                    )

        return {"associated": inserted, "table": table_used}
    
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
        
        if limit > 100:
            limit = 100
        
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

                # Build WHERE clause
                where_conditions = ["1=1"]
                params = [f"%{query}%", f"%{query}%"]

                if "is_active" in schema:
                    where_conditions.append("is_active = true")
                
                if route_type and "route_type" in schema:
                    where_conditions.append("route_type = %s")
                    params.append(route_type)
                
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
                    WHERE {where_clause} AND (name ILIKE %s OR description ILIKE %s)
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

    def add_route_media(self, route_id: int, file: FileStorage, lat: float, lng: float,
                        caption: Optional[str], is_primary: bool = False) -> Dict[str, Any]:
        """Add media file for a route."""
        if not file or not file.filename:
            raise bad_request("File is required")

        filename = secure_filename(file.filename)
        extension = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex}{extension}"

        media_dir = Path("poi_media") / "route_media" / str(route_id)
        media_dir.mkdir(parents=True, exist_ok=True)

        file_path = media_dir / unique_name
        file.save(str(file_path))

        thumbnail_path = media_service.generate_thumbnail(str(file_path))

        conn_context = self._get_database_connection()
        if conn_context is None:
            raise APIError("Database connection failed", "DB_CONN_ERROR")

        with conn_context as conn:
            with conn.cursor() as cursor:
                query = (
                    "INSERT INTO route_media (route_id, file_path, thumbnail_path, lat, lng, caption, is_primary) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s) "
                    "RETURNING id, route_id, file_path, thumbnail_path, lat, lng, caption, is_primary, uploaded_at"
                )
                cursor.execute(query, (
                    route_id,
                    str(file_path),
                    thumbnail_path,
                    lat,
                    lng,
                    caption,
                    is_primary
                ))
                result = cursor.fetchone()

        media_record = dict(result)
        if media_record.get('uploaded_at'):
            media_record['uploaded_at'] = media_record['uploaded_at'].isoformat()
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

        media_list = []
        for row in rows:
            item = dict(row)
            if item.get('uploaded_at'):
                item['uploaded_at'] = item['uploaded_at'].isoformat()
            
            # Add fields that the frontend expects
            item['filename'] = Path(item['file_path']).name if item.get('file_path') else ''
            item['file_size'] = Path(item['file_path']).stat().st_size if item.get('file_path') and Path(item['file_path']).exists() else 0
            item['media_type'] = 'image' if item.get('media_type') == 'photo' else item.get('media_type', 'image')
            item['latitude'] = item.get('lat')
            item['longitude'] = item.get('lng')
            
            media_list.append(item)

        return media_list
    
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
