"""
POI Service for POI Travel Recommendation API.
Business logic layer for POI operations.
"""

import logging
import json
# uuid - used for ID generation in create_poi
import unicodedata
import re
import math
from typing import Dict, List, Any, Optional, Tuple
# datetime - used for timestamp operations

from app.config.database import get_db_connection
from app.middleware.error_handler import APIError, bad_request, not_found, internal_error

logger = logging.getLogger(__name__)


class POIService:
    """Service class for POI business logic operations."""
    
    def __init__(self):
        self.json_fallback = False
        self.test_data_file = 'test_data.json'
    
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
        """Load test data from JSON file."""
        try:
            with open(self.test_data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Test data file {self.test_data_file} not found")
            return {'pois': []}
        except Exception as e:
            logger.error(f"Error loading test data: {e}")
            return {'pois': []}
    
    def _save_test_data(self, data: Dict[str, Any]) -> None:
        """Save test data to JSON file."""
        try:
            with open(self.test_data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving test data: {e}")
            raise APIError("Failed to save data", "DATA_SAVE_ERROR")
    
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
            # Always try database first, then fallback to JSON
            if not self.json_fallback:
                try:
                    return self._list_pois_database(search, category, offset, limit, page, sort)
                except Exception as db_error:
                    logger.warning(f"Database failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            
            # Use JSON fallback
            return self._list_pois_json(search, category, offset, limit, page, sort)
        except Exception as e:
            logger.error(f"Error listing POIs: {e}")
            raise APIError("Failed to list POIs", "POI_LIST_ERROR")
    
    def _list_pois_database(self, search: str, category: str, offset: int, limit: int, page: int, sort: str = 'name_asc') -> Dict[str, Any]:
        """List POIs from database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._list_pois_json(search, category, offset, limit, page, sort)
        
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
                
                # Get POIs - adapt to actual database schema
                query = f"""
                    SELECT id, name, description, category, 
                           ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude,
                           0 as rating, '[]'::text as images, created_at, updated_at
                    FROM pois 
                    WHERE {where_clause} AND is_active = true
                    ORDER BY name
                    LIMIT %s OFFSET %s
                """
                cursor.execute(query, params + [limit, offset])
                pois = cursor.fetchall()
                
                # Convert to list of dicts
                poi_list = []
                for poi in pois:
                    poi_dict = dict(poi)
                    if poi_dict.get('created_at'):
                        poi_dict['created_at'] = poi_dict['created_at'].isoformat() + 'Z'
                    if poi_dict.get('updated_at'):
                        poi_dict['updated_at'] = poi_dict['updated_at'].isoformat() + 'Z'
                    poi_list.append(self._ensure_client_compat(poi_dict))
                
                total_pages = math.ceil(total / limit) if limit > 0 else 1
                
                return {
                    'pois': poi_list,
                    'total': total,
                    'page': page,
                    'total_pages': total_pages
                }
    
    def _list_pois_json(self, search: str, category: str, offset: int, limit: int, page: int, sort: str = 'name_asc') -> Dict[str, Any]:
        """List POIs from JSON fallback."""
        data = self._load_test_data()
        pois = data.get('pois', [])
        
        # Filter by search
        if search:
            filtered_pois = []
            for poi in pois:
                if self._fuzzy_search_match(search, poi.get('name', '')) or \
                   self._fuzzy_search_match(search, poi.get('description', '')):
                    filtered_pois.append(poi)
            pois = filtered_pois
        
        # Filter by category
        if category:
            pois = [poi for poi in pois if poi.get('category', '').lower() == category.lower()]
        
        # Sort by name
        pois.sort(key=lambda x: x.get('name', ''))
        
        # Pagination
        total = len(pois)
        pois = [self._ensure_client_compat(dict(p)) if isinstance(p, dict) else self._ensure_client_compat(p) for p in pois]
        pois = pois[offset:offset + limit]
        total_pages = math.ceil(total / limit) if limit > 0 else 1
        
        return {
            'pois': pois,
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
            if self.json_fallback:
                return self._search_pois_json(query, category, limit)
            else:
                return self._search_pois_database(query, category, limit)
        except Exception as e:
            logger.error(f"Error searching POIs: {e}")
            raise APIError("Search failed", "POI_SEARCH_ERROR")
    
    def _search_pois_database(self, query: str, category: str, limit: int) -> Dict[str, Any]:
        """Search POIs in database with relevance scoring."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._search_pois_json(query, category, limit)
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                params = [f"%{query}%", f"%{query}%"]
                where_conditions = ["(name ILIKE %s OR description ILIKE %s)"]
                
                if category:
                    where_conditions.append("category = %s")
                    params.append(category)
                
                where_clause = " AND ".join(where_conditions)
                
                search_query = f"""
                    SELECT id, name, description, category, 
                           ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude,
                           0 as rating, '[]'::text as images, created_at, updated_at
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
                    poi_dict = dict(poi)
                    if poi_dict.get('created_at'):
                        poi_dict['created_at'] = poi_dict['created_at'].isoformat() + 'Z'
                    if poi_dict.get('updated_at'):
                        poi_dict['updated_at'] = poi_dict['updated_at'].isoformat() + 'Z'
                    poi_list.append(self._ensure_client_compat(poi_dict))
                
                return {
                    'results': poi_list,
                    'total': len(poi_list),
                    'query': query
                }
    
    def _search_pois_json(self, query: str, category: str, limit: int) -> Dict[str, Any]:
        """Search POIs in JSON with relevance scoring."""
        data = self._load_test_data()
        pois = data.get('pois', [])
        
        # Filter by category first
        if category:
            pois = [poi for poi in pois if poi.get('category', '').lower() == category.lower()]
        
        # Calculate relevance scores
        scored_pois = []
        for poi in pois:
            score = self._calculate_relevance_score(query, poi)
            if score > 0:
                poi_with_score = poi.copy()
                poi_with_score['_relevance_score'] = score
                scored_pois.append(poi_with_score)
        
        # Sort by relevance score descending
        scored_pois.sort(key=lambda x: x['_relevance_score'], reverse=True)
        
        # Remove score and limit results
        results = []
        for poi in scored_pois[:limit]:
            poi_copy = self._ensure_client_compat(poi.copy())
            poi_copy.pop('_relevance_score', None)
            results.append(poi_copy)
        
        return {
            'results': results,
            'total': len(results),
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
            if self.json_fallback:
                return self._get_poi_json(poi_id)
            else:
                return self._get_poi_database(poi_id)
        except Exception as e:
            logger.error(f"Error getting POI {poi_id}: {e}")
            raise APIError("Failed to get POI", "POI_GET_ERROR")
    
    def _get_poi_database(self, poi_id: str) -> Dict[str, Any]:
        """Get POI from database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._get_poi_json(poi_id)
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT id, name, description, category, 
                           ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude,
                           0 as rating, '[]'::text as images, created_at, updated_at
                    FROM pois 
                    WHERE id = %s AND is_active = true
                """
                cursor.execute(query, (poi_id,))
                result = cursor.fetchone()
                
                if not result:
                    raise not_found(f"POI with ID {poi_id} not found")
                
                poi_dict = dict(result)
                if poi_dict.get('created_at'):
                    poi_dict['created_at'] = poi_dict['created_at'].isoformat() + 'Z'
                if poi_dict.get('updated_at'):
                    poi_dict['updated_at'] = poi_dict['updated_at'].isoformat() + 'Z'
                return self._ensure_client_compat(poi_dict)
    
    def _get_poi_json(self, poi_id: str) -> Dict[str, Any]:
        """Get POI from JSON fallback."""
        data = self._load_test_data()
        pois = data.get('pois', [])
        
        for poi in pois:
            if poi.get('id') == poi_id:
                return self._ensure_client_compat(poi)
        
        raise not_found(f"POI with ID {poi_id} not found")
    
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
        
        # Generate ID and timestamps
        poi_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        poi_data['id'] = poi_id
        poi_data['created_at'] = now.isoformat() + 'Z'
        poi_data['updated_at'] = now.isoformat() + 'Z'
        
        # Set defaults
        poi_data.setdefault('description', '')
        poi_data.setdefault('category', 'other')
        poi_data.setdefault('rating', 0)
        poi_data.setdefault('images', [])
        
        try:
            if self.json_fallback:
                return self._create_poi_json(poi_data)
            else:
                return self._create_poi_database(poi_data)
        except Exception as e:
            logger.error(f"Error creating POI: {e}")
            raise APIError("Failed to create POI", "POI_CREATE_ERROR")
    
    def _create_poi_database(self, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create POI in database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            # Fallback to JSON if database not available
            return self._create_poi_json(poi_data)
        
        with conn_context as conn:
            with conn.cursor() as cursor:
                query = """
                    INSERT INTO pois (id, name, description, category, latitude, longitude, rating, images, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """
                cursor.execute(query, (
                    poi_data['id'], poi_data['name'], poi_data['description'],
                    poi_data['category'], poi_data['latitude'], poi_data['longitude'],
                    poi_data['rating'], json.dumps(poi_data['images']),
                    poi_data['created_at'], poi_data['updated_at']
                ))
                
                result = cursor.fetchone()
                conn.commit()
                
                poi_dict = dict(result)
                if poi_dict.get('created_at'):
                    poi_dict['created_at'] = poi_dict['created_at'].isoformat() + 'Z'
                if poi_dict.get('updated_at'):
                    poi_dict['updated_at'] = poi_dict['updated_at'].isoformat() + 'Z'
                
                return poi_dict
    
    def _create_poi_json(self, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create POI in JSON fallback."""
        data = self._load_test_data()
        
        # Check for duplicate IDs
        existing_ids = {poi.get('id') for poi in data.get('pois', [])}
        if poi_data['id'] in existing_ids:
            poi_data['id'] = str(uuid.uuid4())  # Generate new ID
        
        data.setdefault('pois', []).append(poi_data)
        self._save_test_data(data)
        
        return poi_data


# Global service instance
poi_service = POIService()
