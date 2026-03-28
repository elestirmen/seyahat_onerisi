"""
POI Service for POI Travel Recommendation API.
Business logic layer for POI operations.
"""

import logging
import json
import unicodedata
import math
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.middleware.error_handler import APIError, bad_request, not_found

logger = logging.getLogger(__name__)


RATING_CATEGORIES = {
    'tarihi': {'name': 'Tarihi', 'description': 'Tarihi önem ve değer', 'icon': 'fa-landmark', 'color': '#8B4513'},
    'sanat_kultur': {'name': 'Sanat ve Kültür', 'description': 'Sanatsal ve kültürel değer', 'icon': 'fa-palette', 'color': '#9B59B6'},
    'doga': {'name': 'Doğa', 'description': 'Doğal güzellik ve çevre', 'icon': 'fa-leaf', 'color': '#27AE60'},
    'eglence': {'name': 'Eğlence', 'description': 'Eğlence ve aktivite değeri', 'icon': 'fa-music', 'color': '#E74C3C'},
    'alisveris': {'name': 'Alışveriş', 'description': 'Alışveriş olanakları', 'icon': 'fa-shopping-cart', 'color': '#F39C12'},
    'spor': {'name': 'Spor', 'description': 'Spor aktiviteleri', 'icon': 'fa-dumbbell', 'color': '#34495E'},
    'macera': {'name': 'Macera', 'description': 'Macera ve heyecan', 'icon': 'fa-mountain', 'color': '#D35400'},
    'rahatlatici': {'name': 'Rahatlatıcı', 'description': 'Huzur ve dinlendirici', 'icon': 'fa-spa', 'color': '#1ABC9C'},
    'yemek': {'name': 'Yemek', 'description': 'Gastronomi ve lezzet', 'icon': 'fa-utensils', 'color': '#E67E22'},
    'gece_hayati': {'name': 'Gece Hayatı', 'description': 'Gece eğlencesi', 'icon': 'fa-moon', 'color': '#6C3483'},
}

DEFAULT_RATINGS = {category: 0 for category in RATING_CATEGORIES}


class POIService:
    """Service class for POI business logic operations."""
    
    def __init__(self):
        pass
    
    def _get_database_connection(self):
        """Get database connection or raise an API error."""
        try:
            # Try the new database pool first
            from app.config.database import get_database_pool
            pool = get_database_pool()
            if pool is not None:
                return pool.get_connection()
            
        except Exception as e:
            logger.debug(f"Database pool unavailable: {e}")
        
        try:
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
    
    def _normalize_turkish_text(self, text: str) -> str:
        """Normalize Turkish text for search."""
        if not text:
            return ""
        
        # Turkish character mappings
        replacements = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'I': 'I', 'i': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U'
        }
        
        normalized = text
        for turkish, english in replacements.items():
            normalized = normalized.replace(turkish, english)
        
        # Remove diacritics and normalize
        normalized = unicodedata.normalize('NFD', normalized)
        normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
        
        return normalized.lower()
    
    def _fuzzy_search_match(self, search_term: str, target_text: str, threshold: float = 0.6) -> bool:
        """Simple fuzzy search matching."""
        if not search_term or not target_text:
            return False
        
        search_normalized = self._normalize_turkish_text(search_term)
        target_normalized = self._normalize_turkish_text(target_text)
        
        # Exact match
        if search_normalized in target_normalized:
            return True
        
        # Word boundary matching
        search_words = search_normalized.split()
        target_words = target_normalized.split()
        
        matches = 0
        for search_word in search_words:
            for target_word in target_words:
                if search_word in target_word or target_word in search_word:
                    matches += 1
                    break
        
        match_ratio = matches / len(search_words) if search_words else 0
        return match_ratio >= threshold
    
    def _calculate_relevance_score(self, search_query: str, poi: Dict[str, Any]) -> float:
        """Calculate relevance score for POI."""
        if not search_query:
            return 1.0
        
        search_normalized = self._normalize_turkish_text(search_query)
        score = 0.0
        
        # Name matching (highest weight)
        name_normalized = self._normalize_turkish_text(poi.get('name', ''))
        if search_normalized in name_normalized:
            score += 10.0
        elif self._fuzzy_search_match(search_query, poi.get('name', '')):
            score += 5.0
        
        # Description matching
        description_normalized = self._normalize_turkish_text(poi.get('description', ''))
        if search_normalized in description_normalized:
            score += 3.0
        elif self._fuzzy_search_match(search_query, poi.get('description', '')):
            score += 1.5
        
        # Category matching
        category_normalized = self._normalize_turkish_text(poi.get('category', ''))
        if search_normalized in category_normalized:
            score += 2.0
        
        # Rating boost
        rating = poi.get('rating', 0)
        if isinstance(rating, (int, float)) and rating > 0:
            score += rating * 0.5
        
        return score

    def _ensure_client_compat(self, poi: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure response object has fields expected by legacy frontend.

        Frontend recommendation code expects a nested object (e.g., poi.ratings.*).
        Guarantee presence with safe defaults to avoid undefined access errors.
        """
        try:
            if poi is None:
                return poi
            if not isinstance(poi.get('ratings'), dict):
                poi['ratings'] = {}
            if not isinstance(poi.get('scores'), dict):
                poi['scores'] = {}
            if not isinstance(poi.get('attributes'), dict):
                poi['attributes'] = poi.get('attributes') or {}
            # Ensure lat/lng aliases exist for mapping code paths that use either
            lat = poi.get('lat') if poi.get('lat') is not None else poi.get('latitude')
            lng = poi.get('lng') if poi.get('lng') is not None else poi.get('longitude')
            # Coerce to float if possible
            try:
                if lat is not None:
                    lat = float(lat)
                if lng is not None:
                    lng = float(lng)
            except (ValueError, TypeError):
                pass
            if lat is not None:
                poi['latitude'] = poi.get('latitude', lat)
                poi['lat'] = lat
            if lng is not None:
                poi['longitude'] = poi.get('longitude', lng)
                poi['lng'] = lng
            # Ensure name exists
            if not poi.get('name'):
                poi['name'] = poi.get('id', 'POI')
        except Exception:
            # Be defensive; never fail this step
            poi = poi or {}
            poi.setdefault('ratings', {})
            poi.setdefault('scores', {})
            if 'latitude' in poi and 'lat' not in poi:
                poi['lat'] = poi['latitude']
            if 'longitude' in poi and 'lng' not in poi:
                poi['lng'] = poi['longitude']
        return poi

    def _map_poi_record(self, record: Any) -> Dict[str, Any]:
        """Normalize database record structures before returning to clients."""
        if record is None:
            return {}

        poi = dict(record)

        created_at = poi.get('created_at')
        if isinstance(created_at, datetime):
            poi['created_at'] = created_at.isoformat() + ('Z' if created_at.tzinfo is None else '')

        updated_at = poi.get('updated_at')
        if isinstance(updated_at, datetime):
            poi['updated_at'] = updated_at.isoformat() + ('Z' if updated_at.tzinfo is None else '')

        poi.setdefault('short_description', '')
        poi.setdefault('altitude', None)

        attributes = poi.get('attributes')
        if isinstance(attributes, str):
            try:
                poi['attributes'] = json.loads(attributes)
            except json.JSONDecodeError:
                poi['attributes'] = {}
        else:
            poi.setdefault('attributes', {})
        poi.setdefault('is_active', True)

        return poi
    
    def list_pois(self, search: str = None, category: str = None, page: int = 1, limit: int = 20, sort: str = 'name_asc') -> Dict[str, Any]:
        """
        List POIs with optional filtering and pagination.
        
        Args:
            search: Search term for POI name/description
            category: Filter by category
            page: Page number (1-based)
            limit: Items per page
            sort: Sort order (name_asc, name_desc, etc.)
            
        Returns:
            Dict with pois, total, page, total_pages
        """
        if limit > 100:
            limit = 100
        if page < 1:
            page = 1
        
        offset = (page - 1) * limit
        
        try:
            return self._list_pois_database(search, category, offset, limit, page, sort)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error listing POIs: {e}")
            raise APIError("Failed to list POIs", "POI_LIST_ERROR")
    
    def _list_pois_database(self, search: str, category: str, offset: int, limit: int, page: int, sort: str = 'name_asc') -> Dict[str, Any]:
        """List POIs from database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                # Build query
                where_conditions = []
                params = []
                
                if search:
                    where_conditions.append("(name ILIKE %s OR description ILIKE %s)")
                    search_param = f"%{search}%"
                    params.extend([search_param, search_param])
                
                if category:
                    where_conditions.append("category = %s")
                    params.append(category)
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
                
                # Count total
                count_query = f"SELECT COUNT(*) FROM pois WHERE {where_clause} AND is_active = true"
                cursor.execute(count_query, params)
                result = cursor.fetchone()
                total = result['count'] if isinstance(result, dict) else result[0]
                
                # Determine sort order safely
                order_mapping = {
                    'name_asc': 'name ASC',
                    'name_desc': 'name DESC',
                    'category_asc': 'category ASC, name ASC',
                    'created_desc': 'created_at DESC',
                    'created_asc': 'created_at ASC'
                }
                order_clause = order_mapping.get(sort, 'name ASC')

                # Get POIs - adapt to actual database schema
                query = f"""
                    SELECT id,
                           name,
                           description,
                           short_description,
                           category,
                           altitude,
                           ST_Y(location::geometry) as latitude,
                           ST_X(location::geometry) as longitude,
                           attributes,
                           is_active,
                           created_at,
                           updated_at
                    FROM pois
                    WHERE {where_clause} AND is_active = true
                    ORDER BY {order_clause}
                    LIMIT %s OFFSET %s
                """
                cursor.execute(query, params + [limit, offset])
                pois = cursor.fetchall()
                
                # Convert to list of dicts
                poi_list = []
                for poi in pois:
                    mapped = self._map_poi_record(poi)
                    poi_list.append(self._ensure_client_compat(mapped))
                
                total_pages = math.ceil(total / limit) if limit > 0 else 1
                
                return {
                    'pois': poi_list,
                    'total': total,
                    'page': page,
                    'total_pages': total_pages
                }
    
    def search_pois(self, query: str, category: str = None, limit: int = 50) -> Dict[str, Any]:
        """
        Advanced POI search with relevance scoring.
        
        Args:
            query: Search query
            category: Optional category filter
            limit: Maximum results
            
        Returns:
            Dict with results, total, query
        """
        if not query:
            raise bad_request("Search query is required")
        
        if limit > 100:
            limit = 100
        
        try:
            return self._search_pois_database(query, category, limit)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error searching POIs: {e}")
            raise APIError("Search failed", "POI_SEARCH_ERROR")

    def search_nearby_pois(
        self,
        lat: float,
        lng: float,
        radius_m: int = 1000,
        limit: int = 50,
        category: Optional[str] = None,
        categories: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Return POIs near the given coordinate ordered by distance."""
        if not (-90 <= lat <= 90):
            raise bad_request("Latitude must be between -90 and 90")

        if not (-180 <= lng <= 180):
            raise bad_request("Longitude must be between -180 and 180")

        radius_m = max(50, min(int(radius_m), 50000))
        limit = max(1, min(int(limit), 200))
        normalized_category = (category or "").strip() or None
        normalized_categories: List[str] = []

        for item in categories or []:
            category_name = str(item or "").strip()
            if not category_name or category_name in normalized_categories:
                continue
            normalized_categories.append(category_name)

        if normalized_categories:
            normalized_category = normalized_categories[0] if len(normalized_categories) == 1 else None

        conn_context = self._get_database_connection()

        with conn_context as conn:
            with conn.cursor() as cursor:
                params: List[Any] = [lng, lat, lng, lat, radius_m]
                category_clause = ""
                if normalized_categories:
                    category_clause = " AND p.category = ANY(%s)"
                    params.append(normalized_categories)
                elif normalized_category:
                    category_clause = " AND p.category = %s"
                    params.append(normalized_category)

                params.append(limit)

                query = f"""
                    SELECT
                        p.id,
                        p.name,
                        p.description,
                        p.short_description,
                        p.category,
                        p.altitude,
                        ST_Y(p.location::geometry) AS latitude,
                        ST_X(p.location::geometry) AS longitude,
                        p.attributes,
                        p.is_active,
                        p.created_at,
                        p.updated_at,
                        ST_Distance(
                            p.location::geography,
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                        ) AS distance_m
                    FROM pois p
                    WHERE p.is_active = true
                      AND p.location IS NOT NULL
                      AND ST_DWithin(
                            p.location::geography,
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                            %s
                      )
                      {category_clause}
                    ORDER BY distance_m ASC
                    LIMIT %s
                """

                cursor.execute(query, params)
                rows = cursor.fetchall() or []

        pois: List[Dict[str, Any]] = []
        for row in rows:
            mapped = self._ensure_client_compat(self._map_poi_record(row))
            mapped["_id"] = mapped.get("id")
            try:
                mapped["distance_m"] = int(round(float(mapped.get("distance_m") or 0)))
            except (TypeError, ValueError):
                mapped["distance_m"] = 0
            pois.append(mapped)

        return {
            "center": {"lat": lat, "lng": lng},
            "radius_m": radius_m,
            "count": len(pois),
            "category": normalized_category,
            "categories": normalized_categories,
            "pois": pois,
        }

    def _search_pois_database(self, query: str, category: str, limit: int) -> Dict[str, Any]:
        """Search POIs in database with relevance scoring."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                params = [f"%{query}%", f"%{query}%"]
                where_conditions = ["(name ILIKE %s OR description ILIKE %s)"]
                
                if category:
                    where_conditions.append("category = %s")
                    params.append(category)
                
                where_clause = " AND ".join(where_conditions)
                
                search_query = f"""
                    SELECT id,
                           name,
                           description,
                           short_description,
                           category,
                           altitude,
                           ST_Y(location::geometry) as latitude,
                           ST_X(location::geometry) as longitude,
                           attributes,
                           is_active,
                           created_at,
                           updated_at
                    FROM pois 
                    WHERE {where_clause} AND is_active = true
                    ORDER BY 
                        CASE WHEN name ILIKE %s THEN 1 ELSE 2 END,
                        name
                    LIMIT %s
                """
                
                # Add query parameter for ordering
                params.append(f"%{query}%")
                params.append(limit)
                
                cursor.execute(search_query, params)
                results = cursor.fetchall()
                
                # Convert to list of dicts
                poi_list = []
                for poi in results:
                    mapped = self._map_poi_record(poi)
                    poi_list.append(self._ensure_client_compat(mapped))
                
                return {
                    'results': poi_list,
                    'total': len(poi_list),
                    'query': query
                }
    
    def get_poi(self, poi_id: str) -> Dict[str, Any]:
        """
        Get single POI by ID.
        
        Args:
            poi_id: POI identifier
            
        Returns:
            POI data dict
        """
        try:
            return self._get_poi_database(poi_id)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error getting POI {poi_id}: {e}")
            raise APIError("Failed to get POI", "POI_GET_ERROR")

    def get_default_ratings(self) -> Dict[str, int]:
        """Return default zeroed ratings for every known category."""
        return DEFAULT_RATINGS.copy()

    def get_rating_categories(self) -> Dict[str, Any]:
        """Return rating category metadata used by legacy and modular frontends."""
        return {
            'categories': RATING_CATEGORIES,
            'description': 'POI rating kategorileri ve bilgileri'
        }

    def list_categories(self) -> List[Dict[str, Any]]:
        """List custom POI categories from the database."""
        conn_context = self._get_database_connection()

        with conn_context as conn:
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

    def create_category(self, category_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a new POI category."""
        if not category_data:
            raise bad_request("No data provided")

        required_fields = ['name', 'display_name', 'color', 'icon']
        for field in required_fields:
            if not category_data.get(field):
                raise bad_request(f"Missing required field: {field}")

        conn_context = self._get_database_connection()
        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS count FROM categories WHERE name = %s", (category_data['name'],))
                existing = cursor.fetchone()
                existing_count = existing.get('count', 0) if isinstance(existing, dict) else existing[0]
                if existing_count > 0:
                    raise APIError("Category name already exists", "CATEGORY_CONFLICT", 409)

                cursor.execute(
                    """
                    INSERT INTO categories (name, display_name, color, icon, description)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        category_data['name'],
                        category_data['display_name'],
                        category_data['color'],
                        category_data['icon'],
                        category_data.get('description', ''),
                    ),
                )

        return {'success': True, 'message': 'Category added successfully'}

    def update_category(self, category_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Update a category's editable fields."""
        if not category_data or not category_data.get('name'):
            raise bad_request("Category name is required")

        conn_context = self._get_database_connection()
        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS count FROM categories WHERE name = %s", (category_data['name'],))
                existing = cursor.fetchone()
                existing_count = existing.get('count', 0) if isinstance(existing, dict) else existing[0]
                if existing_count == 0:
                    raise APIError("Category not found", "NOT_FOUND", 404)

                update_fields: List[str] = []
                update_values: List[Any] = []
                for field in ['display_name', 'color', 'icon', 'description']:
                    if field in category_data:
                        update_fields.append(f"{field} = %s")
                        update_values.append(category_data[field])

                if not update_fields:
                    raise bad_request("No fields to update")

                update_values.append(category_data['name'])
                cursor.execute(
                    f"""
                    UPDATE categories
                    SET {', '.join(update_fields)}
                    WHERE name = %s
                    """,
                    update_values,
                )

        return {'success': True, 'message': 'Category updated successfully'}

    def delete_category(self, category_name: str) -> Dict[str, Any]:
        """Delete a category when it is not referenced by any POIs."""
        if not category_name:
            raise bad_request("Category name is required")

        conn_context = self._get_database_connection()
        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS count FROM pois WHERE category = %s", (category_name,))
                poi_count_row = cursor.fetchone()
                poi_count = poi_count_row.get('count', 0) if isinstance(poi_count_row, dict) else poi_count_row[0]
                if poi_count > 0:
                    raise APIError(
                        f"Cannot delete category. {poi_count} POIs are using this category.",
                        "CATEGORY_IN_USE",
                        409,
                    )

                cursor.execute("DELETE FROM categories WHERE name = %s", (category_name,))
                if cursor.rowcount == 0:
                    raise APIError("Category not found", "NOT_FOUND", 404)

        return {'success': True, 'message': 'Category deleted successfully'}

    def _normalize_ratings(self, ratings: Dict[str, Any]) -> Dict[str, int]:
        """Validate and normalize rating payloads."""
        if not isinstance(ratings, dict):
            raise bad_request("Ratings must be an object")

        normalized: Dict[str, int] = {}
        for category, value in ratings.items():
            if category not in RATING_CATEGORIES:
                continue
            try:
                numeric_value = int(value)
            except (TypeError, ValueError):
                raise bad_request(f"Invalid rating value for category: {category}")
            normalized[category] = max(0, min(100, numeric_value))

        if not normalized and ratings:
            raise bad_request("No valid rating categories provided")

        return normalized

    def get_poi_ratings(self, poi_id: str) -> Dict[str, Any]:
        """Get a POI's rating payload in legacy-compatible response format."""
        try:
            poi_id_int = int(poi_id)
        except (TypeError, ValueError):
            raise bad_request("Invalid POI ID format")

        conn_context = self._get_database_connection()

        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name
                    FROM pois
                    WHERE id = %s AND is_active = true
                    """,
                    (poi_id_int,),
                )
                poi_row = cursor.fetchone()

                if not poi_row:
                    raise not_found(f"POI with ID {poi_id} not found")

                cursor.execute(
                    """
                    SELECT category, rating
                    FROM poi_ratings
                    WHERE poi_id = %s
                    """,
                    (poi_id_int,),
                )
                rating_rows = cursor.fetchall() or []

        ratings = self.get_default_ratings()
        for row in rating_rows:
            category = row.get('category') if isinstance(row, dict) else row[0]
            rating = row.get('rating') if isinstance(row, dict) else row[1]
            if category in ratings:
                ratings[category] = int(rating or 0)

        poi_name = poi_row.get('name') if isinstance(poi_row, dict) else poi_row[1]
        return {
            'poi_id': poi_id_int,
            'poi_name': poi_name or '',
            'ratings': ratings,
            'rating_categories': RATING_CATEGORIES
        }

    def update_poi_ratings(self, poi_id: str, ratings: Dict[str, Any]) -> Dict[str, Any]:
        """Update a POI's ratings and return the updated payload."""
        try:
            poi_id_int = int(poi_id)
        except (TypeError, ValueError):
            raise bad_request("Invalid POI ID format")

        normalized_ratings = self._normalize_ratings(ratings or {})

        conn_context = self._get_database_connection()
        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id
                    FROM pois
                    WHERE id = %s AND is_active = true
                    """,
                    (poi_id_int,),
                )
                poi_row = cursor.fetchone()
                if not poi_row:
                    raise not_found(f"POI with ID {poi_id} not found")

                upsert_query = """
                    INSERT INTO poi_ratings (poi_id, category, rating)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (poi_id, category)
                    DO UPDATE SET rating = EXCLUDED.rating
                """

                for category, rating in normalized_ratings.items():
                    cursor.execute(upsert_query, (poi_id_int, category, rating))

        updated_payload = self.get_poi_ratings(str(poi_id_int))
        return {
            'success': True,
            'poi_id': poi_id_int,
            'ratings': updated_payload['ratings'],
            'message': "Rating'ler başarıyla güncellendi"
        }
    
    def _get_poi_database(self, poi_id: str) -> Dict[str, Any]:
        """Get POI from database."""
        conn_context = self._get_database_connection()
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT id,
                           name,
                           description,
                           short_description,
                           category,
                           altitude,
                           ST_Y(location::geometry) as latitude,
                           ST_X(location::geometry) as longitude,
                           attributes,
                           is_active,
                           created_at,
                           updated_at
                    FROM pois 
                    WHERE id = %s AND is_active = true
                """
                cursor.execute(query, (poi_id,))
                result = cursor.fetchone()
                
                if not result:
                    raise not_found(f"POI with ID {poi_id} not found")
                
                mapped = self._map_poi_record(result)
                return self._ensure_client_compat(mapped)
    
    def create_poi(self, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new POI.
        
        Args:
            poi_data: POI data dict with required fields
            
        Returns:
            Created POI data dict
        """
        # Validate required fields
        required_fields = ['name', 'latitude', 'longitude']
        for field in required_fields:
            if field not in poi_data:
                raise bad_request(f"Missing required field: {field}")
        
        # Validate data types
        try:
            float(poi_data['latitude'])
            float(poi_data['longitude'])
        except (ValueError, TypeError):
            raise bad_request("Invalid latitude or longitude format")
        
        category = poi_data.get('category') or 'other'
        description = poi_data.get('description', '')
        short_description = poi_data.get('short_description', '')
        altitude = poi_data.get('altitude')
        if altitude is not None:
            try:
                altitude = float(altitude)
            except (TypeError, ValueError):
                raise bad_request("Invalid altitude format")

        attributes = poi_data.get('attributes')
        if attributes is None:
            attributes = {}
        elif not isinstance(attributes, dict):
            raise bad_request("Attributes must be an object")

        sanitized = {
            'name': poi_data['name'].strip() if isinstance(poi_data['name'], str) else poi_data['name'],
            'category': category,
            'description': description,
            'short_description': short_description,
            'latitude': float(poi_data['latitude']),
            'longitude': float(poi_data['longitude']),
            'altitude': altitude,
            'attributes': attributes,
            'is_active': bool(poi_data.get('is_active', True))
        }

        try:
            return self._create_poi_database(sanitized)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error creating POI: {e}")
            raise APIError("Failed to create POI", "POI_CREATE_ERROR")

    def _create_poi_database(self, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create POI in database."""
        conn_context = self._get_database_connection()

        with conn_context as conn:
            with conn.cursor() as cursor:
                now = datetime.utcnow()
                query = """
                    INSERT INTO pois (
                        name,
                        category,
                        description,
                        short_description,
                        location,
                        altitude,
                        attributes,
                        is_active,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    RETURNING id,
                              name,
                              description,
                              short_description,
                              category,
                              altitude,
                              ST_Y(location::geometry) as latitude,
                              ST_X(location::geometry) as longitude,
                              attributes,
                              is_active,
                              created_at,
                              updated_at
                """
                cursor.execute(query, (
                    poi_data['name'],
                    poi_data['category'],
                    poi_data['description'],
                    poi_data['short_description'],
                    poi_data['longitude'],
                    poi_data['latitude'],
                    poi_data['altitude'],
                    json.dumps(poi_data['attributes']),
                    poi_data['is_active'],
                    now,
                    now
                ))

                result = cursor.fetchone()
                conn.commit()

                mapped = self._map_poi_record(result)
                return self._ensure_client_compat(mapped)

    def update_poi(self, poi_id: str, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing POI."""
        if not poi_id:
            raise bad_request("POI ID is required")
        if not poi_data:
            raise bad_request("Update payload is required")

        try:
            return self._update_poi_database(poi_id, poi_data)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error updating POI {poi_id}: {e}")
            raise APIError("Failed to update POI", "POI_UPDATE_ERROR")

    def _update_poi_database(self, poi_id: str, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update POI in database and return updated record."""
        conn_context = self._get_database_connection()

        try:
            poi_id_int = int(poi_id)
        except (TypeError, ValueError):
            raise bad_request("POI ID must be an integer")

        fields = []
        values: List[Any] = []

        if 'name' in poi_data and poi_data['name']:
            fields.append('name = %s')
            values.append(poi_data['name'].strip() if isinstance(poi_data['name'], str) else poi_data['name'])

        if 'category' in poi_data and poi_data['category']:
            fields.append('category = %s')
            values.append(poi_data['category'])

        if 'description' in poi_data:
            fields.append('description = %s')
            values.append(poi_data.get('description', ''))

        if 'short_description' in poi_data:
            fields.append('short_description = %s')
            values.append(poi_data.get('short_description', ''))

        if 'altitude' in poi_data:
            altitude = poi_data.get('altitude')
            if altitude is not None:
                try:
                    altitude = float(altitude)
                except (TypeError, ValueError):
                    raise bad_request("Invalid altitude format")
            fields.append('altitude = %s')
            values.append(altitude)

        attributes = poi_data.get('attributes')
        if attributes is not None:
            if not isinstance(attributes, dict):
                raise bad_request("Attributes must be an object")
            fields.append('attributes = %s')
            values.append(json.dumps(attributes))

        if 'is_active' in poi_data:
            fields.append('is_active = %s')
            values.append(bool(poi_data['is_active']))

        latitude = poi_data.get('latitude', poi_data.get('lat'))
        longitude = poi_data.get('longitude', poi_data.get('lng'))
        if latitude is not None or longitude is not None:
            if latitude is None or longitude is None:
                raise bad_request("Both latitude and longitude are required to update location")
            try:
                latitude = float(latitude)
                longitude = float(longitude)
            except (TypeError, ValueError):
                raise bad_request("Invalid latitude or longitude format")
            fields.append('location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography')
            values.extend([longitude, latitude])

        if not fields:
            raise bad_request("No valid fields provided for update")

        updated_at = datetime.utcnow()
        fields.append('updated_at = %s')
        values.append(updated_at)
        values.append(poi_id_int)

        with conn_context as conn:
            with conn.cursor() as cursor:
                query = f"""
                    UPDATE pois
                    SET {', '.join(fields)}
                    WHERE id = %s
                    RETURNING id,
                              name,
                              description,
                              short_description,
                              category,
                              altitude,
                              ST_Y(location::geometry) as latitude,
                              ST_X(location::geometry) as longitude,
                              attributes,
                              is_active,
                              created_at,
                              updated_at
                """
                cursor.execute(query, values)
                result = cursor.fetchone()

                if not result:
                    raise not_found(f"POI with ID {poi_id} not found")

        mapped = self._map_poi_record(result)
        return self._ensure_client_compat(mapped)

    def delete_poi(self, poi_id: str) -> None:
        """Delete POI from primary store."""
        if not poi_id:
            raise bad_request("POI ID is required")

        try:
            self._delete_poi_database(poi_id)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error deleting POI {poi_id}: {e}")
            raise APIError("Failed to delete POI", "POI_DELETE_ERROR")

    def _delete_poi_database(self, poi_id: str) -> None:
        """Delete POI in database."""
        conn_context = self._get_database_connection()

        try:
            poi_id_int = int(poi_id)
        except (TypeError, ValueError):
            raise bad_request("POI ID must be an integer")

        with conn_context as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM pois WHERE id = %s RETURNING id", (poi_id_int,))
                result = cursor.fetchone()
                if not result:
                    raise not_found(f"POI with ID {poi_id} not found")

# Global service instance
poi_service = POIService()
