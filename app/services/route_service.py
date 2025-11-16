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
            
            conn = psycopg2.connect(
                host=os.environ.get('DB_HOST', 'localhost'),
                port=int(os.environ.get('DB_PORT', 5432)),
                database=os.environ.get('DB_NAME', 'poi_db'),
                user=os.environ.get('DB_USER', 'poi_user'),
                password=os.environ.get('DB_PASSWORD', 'poi_password'),
                cursor_factory=RealDictCursor
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

        if 'waypoints' in route and isinstance(route['waypoints'], str):
            try:
                route['waypoints'] = json.loads(route['waypoints'])
            except json.JSONDecodeError:
                route['waypoints'] = []

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
                # Build WHERE clause
                where_conditions = ["1=1"]  # Always true base condition
                params = []
                
                if search:
                    where_conditions.append("(name ILIKE %s OR description ILIKE %s)")
                    params.extend([f"%{search}%", f"%{search}%"])
                
                if route_type:
                    where_conditions.append("route_type = %s")
                    params.append(route_type)
                
                if is_active is not None:
                    where_conditions.append("is_active = %s")
                    params.append(is_active)
                
                where_clause = " AND ".join(where_conditions)
                
                # Count total
                count_query = f"SELECT COUNT(*) FROM routes WHERE {where_clause}"
                cursor.execute(count_query, params)
                result = cursor.fetchone()
                total = result['count'] if isinstance(result, dict) else result[0]
                
                # Get routes
                query = f"""
                    SELECT id,
                           name,
                           description,
                           route_type,
                           total_distance,
                           estimated_duration,
                           difficulty_level,
                           elevation_gain,
                           is_active,
                           season_availability,
                           tags,
                           created_at,
                           updated_at
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
                query = """
                    SELECT id,
                           name,
                           description,
                           route_type,
                           total_distance,
                           estimated_duration,
                           difficulty_level,
                           elevation_gain,
                           is_active,
                           season_availability,
                           tags,
                           waypoints,
                           geometry,
                           elevation_profile,
                           elevation_resolution,
                           created_at,
                           updated_at
                    FROM routes 
                    WHERE id = %s
                """
                cursor.execute(query, (route_id,))
                result = cursor.fetchone()
                
                if not result:
                    raise not_found(f"Route with ID {route_id} not found")
                
                return self._map_route_record(result)
    
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
                # Build WHERE clause
                where_conditions = ["is_active = true"]
                params = [f"%{query}%", f"%{query}%"]
                
                if route_type:
                    where_conditions.append("route_type = %s")
                    params.append(route_type)
                
                where_clause = " AND ".join(where_conditions)
                
                search_query = f"""
                    SELECT id,
                           name,
                           description,
                           route_type,
                           total_distance,
                           estimated_duration,
                           difficulty_level,
                           elevation_gain,
                           is_active,
                           season_availability,
                           tags,
                           created_at,
                           updated_at
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
                # Get basic counts
                cursor.execute("SELECT COUNT(*) FROM routes WHERE is_active = true")
                result = cursor.fetchone()
                total_active = result['count'] if isinstance(result, dict) else result[0]
                
                cursor.execute("SELECT COUNT(*) FROM routes")
                result = cursor.fetchone()
                total_all = result['count'] if isinstance(result, dict) else result[0]
                
                # Get counts by type
                cursor.execute("""
                    SELECT route_type, COUNT(*) as count 
                    FROM routes 
                    WHERE is_active = true 
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
