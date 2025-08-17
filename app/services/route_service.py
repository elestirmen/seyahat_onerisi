"""
Route Service for POI Travel Recommendation API.
Business logic layer for route operations.
"""

import logging
import json
import math
import hashlib
import time
import uuid
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.config.database import get_db_connection
from app.middleware.error_handler import APIError, bad_request, not_found, internal_error
from app.services.media_service import media_service

logger = logging.getLogger(__name__)


class RouteService:
    """Service class for route business logic operations."""
    
    def __init__(self):
        self.json_fallback = False
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes
    
    def _get_database_connection(self):
        """Get database connection or fall back to JSON."""
        try:
            # Try the new database pool first
            from app.config.database import get_database_pool
            pool = get_database_pool()
            if pool is not None:
                return pool.get_connection()
            
            # Fallback to direct connection using existing env vars
            import psycopg2
            import os
            from psycopg2.extras import RealDictCursor
            
            conn = psycopg2.connect(
                host=os.environ.get('DB_HOST', 'localhost'),
                port=int(os.environ.get('DB_PORT', 5432)),
                database=os.environ.get('DB_NAME', 'poi_db'),
                user=os.environ.get('DB_USER', 'poi_user'),
                password=os.environ.get('DB_PASSWORD', 'poi_password'),
                cursor_factory=RealDictCursor
            )
            
            logger.info("Using direct database connection (fallback)")
            
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
            
        except Exception as e:
            logger.warning(f"Database connection failed, using JSON fallback: {e}")
            self.json_fallback = True
            return None
    
    def _load_test_data(self) -> Dict[str, Any]:
        """Load test route data from JSON file."""
        try:
            with open('test_routes.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning("test_routes.json not found, using empty data")
            return {'routes': []}
        except Exception as e:
            logger.error(f"Error loading test route data: {e}")
            return {'routes': []}
    
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
            # Always try database first, then fallback to JSON
            if not self.json_fallback:
                try:
                    return self._list_routes_database(search, route_type, is_active, offset, limit, page)
                except Exception as db_error:
                    logger.warning(f"Database failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            
            # Use JSON fallback
            return self._list_routes_json(search, route_type, is_active, offset, limit, page)
        except Exception as e:
            logger.error(f"Error listing routes: {e}")
            raise APIError("Failed to list routes", "ROUTE_LIST_ERROR")
    
    def _list_routes_database(self, search: str, route_type: str, is_active: bool, 
                             offset: int, limit: int, page: int) -> Dict[str, Any]:
        """List routes from database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._list_routes_json(search, route_type, is_active, offset, limit, page)
        
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
                    SELECT id, name, description, route_type, 
                           distance_km, duration_hours, difficulty_level,
                           is_active, created_at, updated_at
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
                    route_dict = dict(route)
                    # Convert datetime objects to ISO strings
                    if route_dict.get('created_at'):
                        route_dict['created_at'] = route_dict['created_at'].isoformat()
                    if route_dict.get('updated_at'):
                        route_dict['updated_at'] = route_dict['updated_at'].isoformat()
                    route_list.append(route_dict)
                
                return {
                    'routes': route_list,
                    'total': total,
                    'page': page,
                    'total_pages': math.ceil(total / limit) if total > 0 else 0,
                    'per_page': limit
                }
    
    def _list_routes_json(self, search: str, route_type: str, is_active: bool, 
                         offset: int, limit: int, page: int) -> Dict[str, Any]:
        """List routes from JSON fallback."""
        test_data = self._load_test_data()
        routes = test_data.get('routes', [])
        
        # Apply filters
        filtered_routes = []
        for route in routes:
            # Search filter
            if search:
                search_lower = search.lower()
                if not (search_lower in route.get('name', '').lower() or 
                       search_lower in route.get('description', '').lower()):
                    continue
            
            # Route type filter
            if route_type and route.get('route_type') != route_type:
                continue
                
            # Active status filter
            if is_active is not None and route.get('is_active') != is_active:
                continue
                
            filtered_routes.append(route)
        
        # Apply pagination
        total = len(filtered_routes)
        paginated_routes = filtered_routes[offset:offset + limit]
        
        return {
            'routes': paginated_routes,
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
            if not self.json_fallback:
                try:
                    return self._get_route_database(route_id)
                except Exception as db_error:
                    logger.warning(f"Database failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            
            return self._get_route_json(route_id)
        except Exception as e:
            logger.error(f"Error getting route {route_id}: {e}")
            raise APIError(f"Failed to get route {route_id}", "ROUTE_GET_ERROR")
    
    def _get_route_database(self, route_id: int) -> Dict[str, Any]:
        """Get route from database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._get_route_json(route_id)
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT id, name, description, route_type, 
                           distance_km, duration_hours, difficulty_level,
                           is_active, created_at, updated_at,
                           geometry, elevation_profile, elevation_resolution
                    FROM routes 
                    WHERE id = %s
                """
                cursor.execute(query, (route_id,))
                result = cursor.fetchone()
                
                if not result:
                    raise not_found(f"Route with ID {route_id} not found")
                
                route_dict = dict(result)
                # Convert datetime objects to ISO strings
                if route_dict.get('created_at'):
                    route_dict['created_at'] = route_dict['created_at'].isoformat()
                if route_dict.get('updated_at'):
                    route_dict['updated_at'] = route_dict['updated_at'].isoformat()
                
                return route_dict
    
    def _get_route_json(self, route_id: int) -> Dict[str, Any]:
        """Get route from JSON fallback."""
        test_data = self._load_test_data()
        routes = test_data.get('routes', [])
        
        for route in routes:
            if route.get('id') == route_id:
                return route
        
        raise not_found(f"Route with ID {route_id} not found")
    
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
            if not self.json_fallback:
                try:
                    return self._search_routes_database(query, route_type, limit)
                except Exception as db_error:
                    logger.warning(f"Database failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            
            return self._search_routes_json(query, route_type, limit)
        except Exception as e:
            logger.error(f"Error searching routes: {e}")
            raise APIError("Failed to search routes", "ROUTE_SEARCH_ERROR")
    
    def _search_routes_database(self, query: str, route_type: str, limit: int) -> Dict[str, Any]:
        """Search routes in database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._search_routes_json(query, route_type, limit)
        
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
                    SELECT id, name, description, route_type, 
                           distance_km, duration_hours, difficulty_level,
                           is_active, created_at, updated_at
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
                    route_dict = dict(route)
                    # Convert datetime objects to ISO strings
                    if route_dict.get('created_at'):
                        route_dict['created_at'] = route_dict['created_at'].isoformat()
                    if route_dict.get('updated_at'):
                        route_dict['updated_at'] = route_dict['updated_at'].isoformat()
                    route_list.append(route_dict)
                
                return {
                    'results': route_list,
                    'total': len(route_list),
                    'query': query
                }
    
    def _search_routes_json(self, query: str, route_type: str, limit: int) -> Dict[str, Any]:
        """Search routes in JSON fallback."""
        test_data = self._load_test_data()
        routes = test_data.get('routes', [])
        
        results = []
        query_lower = query.lower()
        
        for route in routes:
            # Skip inactive routes
            if not route.get('is_active', True):
                continue
                
            # Route type filter
            if route_type and route.get('route_type') != route_type:
                continue
            
            # Search in name and description
            name_match = query_lower in route.get('name', '').lower()
            desc_match = query_lower in route.get('description', '').lower()
            
            if name_match or desc_match:
                # Add relevance score (name matches are more relevant)
                relevance = 2 if name_match else 1
                route_result = route.copy()
                route_result['relevance_score'] = relevance
                results.append(route_result)
        
        # Sort by relevance and limit results
        results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        results = results[:limit]
        
        return {
            'results': results,
            'total': len(results),
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
                    SELECT id, route_id, file_path, thumbnail_path, lat, lng,
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
            media_list.append(item)

        return media_list
    
    def get_route_statistics(self) -> Dict[str, Any]:
        """Get route statistics."""
        cache_key = "route_statistics"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        
        try:
            if not self.json_fallback:
                try:
                    stats = self._get_route_statistics_database()
                except Exception as db_error:
                    logger.warning(f"Database failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
                    stats = self._get_route_statistics_json()
            else:
                stats = self._get_route_statistics_json()
            
            self._cache_set(cache_key, stats)
            return stats
        except Exception as e:
            logger.error(f"Error getting route statistics: {e}")
            raise APIError("Failed to get route statistics", "ROUTE_STATS_ERROR")
    
    def _get_route_statistics_database(self) -> Dict[str, Any]:
        """Get route statistics from database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            return self._get_route_statistics_json()
        
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
    
    def _get_route_statistics_json(self) -> Dict[str, Any]:
        """Get route statistics from JSON fallback."""
        test_data = self._load_test_data()
        routes = test_data.get('routes', [])
        
        total_all = len(routes)
        active_routes = len([r for r in routes if r.get('is_active', True)])
        
        # Count by type
        by_type = {}
        for route in routes:
            if route.get('is_active', True):
                route_type = route.get('route_type', 'unknown')
                by_type[route_type] = by_type.get(route_type, 0) + 1
        
        return {
            'total_routes': total_all,
            'active_routes': active_routes,
            'inactive_routes': total_all - active_routes,
            'by_type': by_type,
            'timestamp': datetime.now().isoformat()
        }


# Global route service instance
route_service = RouteService()
