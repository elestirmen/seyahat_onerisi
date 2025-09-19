"""
POI Service for POI Travel Recommendation API.
Business logic layer for POI operations.
"""

import logging
import json
import unicodedata
import math
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.config.database import get_db_connection
from app.middleware.error_handler import APIError, bad_request, not_found

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
        
        # Sort results
        if sort == 'name_desc':
            pois.sort(key=lambda x: x.get('name', ''), reverse=True)
        elif sort == 'category_asc':
            pois.sort(key=lambda x: (x.get('category', ''), x.get('name', '')))
        elif sort == 'created_desc':
            pois.sort(key=lambda x: x.get('createdAt') or x.get('created_at') or '', reverse=True)
        elif sort == 'created_asc':
            pois.sort(key=lambda x: x.get('createdAt') or x.get('created_at') or '')
        else:
            pois.sort(key=lambda x: x.get('name', ''))
        
        # Pagination
        total = len(pois)
        normalized = []
        for poi in pois:
            mapped = self._map_poi_record(poi)
            normalized.append(self._ensure_client_compat(mapped))

        pois = normalized[offset:offset + limit]
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
            poi_copy = self._map_poi_record(poi.copy())
            poi_copy = self._ensure_client_compat(poi_copy)
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
    
    def _get_poi_json(self, poi_id: str) -> Dict[str, Any]:
        """Get POI from JSON fallback."""
        data = self._load_test_data()
        pois = data.get('pois', [])
        
        for poi in pois:
            if poi.get('id') == poi_id:
                mapped = self._map_poi_record(poi)
                return self._ensure_client_compat(mapped)
        
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
            if self.json_fallback:
                return self._create_poi_json(sanitized)
            else:
                return self._create_poi_database(sanitized)
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

    def _create_poi_json(self, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create POI in JSON fallback."""
        data = self._load_test_data()

        # Check for duplicate IDs
        existing_ids = {poi.get('id') for poi in data.get('pois', [])}
        poi_id = str(uuid.uuid4())
        while poi_id in existing_ids:
            poi_id = str(uuid.uuid4())

        now = datetime.utcnow().isoformat() + 'Z'

        json_record = {
            'id': poi_id,
            'name': poi_data['name'],
            'category': poi_data['category'],
            'description': poi_data['description'],
            'short_description': poi_data.get('short_description', ''),
            'latitude': poi_data['latitude'],
            'longitude': poi_data['longitude'],
            'altitude': poi_data.get('altitude'),
            'attributes': poi_data.get('attributes', {}),
            'is_active': poi_data.get('is_active', True),
            'created_at': now,
            'updated_at': now
        }

        data.setdefault('pois', []).append(json_record)
        self._save_test_data(data)

        return self._ensure_client_compat(json_record)

    def update_poi(self, poi_id: str, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing POI."""
        if not poi_id:
            raise bad_request("POI ID is required")
        if not poi_data:
            raise bad_request("Update payload is required")

        try:
            if not self.json_fallback:
                try:
                    return self._update_poi_database(poi_id, poi_data)
                except Exception as db_error:
                    logger.warning(f"Database update failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            return self._update_poi_json(poi_id, poi_data)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error updating POI {poi_id}: {e}")
            raise APIError("Failed to update POI", "POI_UPDATE_ERROR")

    def _update_poi_database(self, poi_id: str, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update POI in database and return updated record."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            return self._update_poi_json(poi_id, poi_data)

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

    def _update_poi_json(self, poi_id: str, poi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update POI in JSON fallback store."""
        data = self._load_test_data()
        pois = data.get('pois', [])

        for poi in pois:
            if str(poi.get('id')) == str(poi_id):
                if 'name' in poi_data and poi_data['name']:
                    poi['name'] = poi_data['name']
                if 'category' in poi_data and poi_data['category']:
                    poi['category'] = poi_data['category']
                if 'description' in poi_data:
                    poi['description'] = poi_data.get('description', '')
                if 'short_description' in poi_data:
                    poi['short_description'] = poi_data.get('short_description', '')
                if 'altitude' in poi_data:
                    altitude = poi_data.get('altitude')
                    if altitude is not None:
                        try:
                            altitude = float(altitude)
                        except (TypeError, ValueError):
                            raise bad_request("Invalid altitude format")
                    poi['altitude'] = altitude
                if 'attributes' in poi_data:
                    attributes = poi_data.get('attributes')
                    if attributes is not None and not isinstance(attributes, dict):
                        raise bad_request("Attributes must be an object")
                    poi['attributes'] = attributes or {}
                if 'is_active' in poi_data:
                    poi['is_active'] = bool(poi_data['is_active'])

                latitude = poi_data.get('latitude', poi_data.get('lat'))
                longitude = poi_data.get('longitude', poi_data.get('lng'))
                if latitude is not None or longitude is not None:
                    if latitude is None or longitude is None:
                        raise bad_request("Both latitude and longitude are required to update location")
                    try:
                        poi['latitude'] = float(latitude)
                        poi['longitude'] = float(longitude)
                    except (TypeError, ValueError):
                        raise bad_request("Invalid latitude or longitude format")

                poi['updated_at'] = datetime.utcnow().isoformat() + 'Z'
                self._save_test_data(data)
                return self._ensure_client_compat(poi)

        raise not_found(f"POI with ID {poi_id} not found")

    def delete_poi(self, poi_id: str) -> None:
        """Delete POI from primary store."""
        if not poi_id:
            raise bad_request("POI ID is required")

        try:
            if not self.json_fallback:
                try:
                    self._delete_poi_database(poi_id)
                    return
                except Exception as db_error:
                    logger.warning(f"Database delete failed, falling back to JSON: {db_error}")
                    self.json_fallback = True
            self._delete_poi_json(poi_id)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error deleting POI {poi_id}: {e}")
            raise APIError("Failed to delete POI", "POI_DELETE_ERROR")

    def _delete_poi_database(self, poi_id: str) -> None:
        """Delete POI in database."""
        conn_context = self._get_database_connection()
        if conn_context is None:
            self._delete_poi_json(poi_id)
            return

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

    def _delete_poi_json(self, poi_id: str) -> None:
        """Delete POI in JSON fallback store."""
        data = self._load_test_data()
        pois = data.get('pois', [])
        initial_count = len(pois)
        data['pois'] = [poi for poi in pois if str(poi.get('id')) != str(poi_id)]

        if len(data['pois']) == initial_count:
            raise not_found(f"POI with ID {poi_id} not found")

        self._save_test_data(data)


# Global service instance
poi_service = POIService()
