#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route Service
Rota yönetimi için veritabanı işlemleri ve business logic
"""

import os
import json
# Some tests import RouteService without the PostgreSQL driver installed.
# Import psycopg2 lazily and fall back to placeholders so the module can be
# imported without the optional dependency. Actual database operations will
# simply fail with a clear error message when psycopg2 is missing.
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
except ModuleNotFoundError:  # pragma: no cover - executed only when driver missing
    psycopg2 = None
    RealDictCursor = None

    def Json(value):  # minimal stand-in used only for type compatibility in tests
        return value
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import logging
import time
import hashlib
from functools import wraps

logger = logging.getLogger(__name__)

# Simple in-memory cache for performance
class SimpleCache:
    def __init__(self, ttl=300):
        self.cache = {}
        self.timestamps = {}
        self.ttl = ttl
    
    def get(self, key):
        if key in self.cache:
            if time.time() - self.timestamps[key] < self.ttl:
                return self.cache[key]
            else:
                del self.cache[key]
                del self.timestamps[key]
        return None
    
    def set(self, key, value):
        self.cache[key] = value
        self.timestamps[key] = time.time()
    
    def clear(self):
        self.cache.clear()
        self.timestamps.clear()

# Global cache instance
_route_cache = SimpleCache(ttl=300)

def cache_result(ttl=300):
    """Decorator to cache function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}_{hash(str(args) + str(sorted(kwargs.items())))}"
            
            # Try cache first
            cached = _route_cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached
            
            # Execute and cache
            result = func(*args, **kwargs)
            _route_cache.set(cache_key, result)
            logger.debug(f"Cache miss for {func.__name__}")
            return result
        return wrapper
    return decorator


class RouteService:
    """Rota yönetimi için servis sınıfı"""
    
    def __init__(self, connection_string: str = None):
        """
        Args:
            connection_string: PostgreSQL bağlantı string'i
        """
        if connection_string:
            self.connection_string = connection_string
        else:
            # Prefer unified connection string if provided to avoid mismatch
            env_conn = os.getenv('POI_DB_CONNECTION')
            if env_conn:
                self.connection_string = env_conn
            else:
                # Environment variables'dan bağlantı bilgilerini al
                host = os.getenv('POI_DB_HOST', 'localhost')
                port = os.getenv('POI_DB_PORT', '5432')
                database = os.getenv('POI_DB_NAME', 'poi_db')
                user = os.getenv('POI_DB_USER', 'poi_user')
                password = os.getenv('POI_DB_PASSWORD', 'poi_password')
                
                self.connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        
        self.conn = None
    
    def connect(self):
        """Veritabanına bağlan"""
        if psycopg2 is None:  # pragma: no cover - handled in tests
            logger.error("psycopg2 is not installed. Database operations are unavailable.")
            return False
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("Route service database connection established")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Veritabanı bağlantısını kapat"""
        if self.conn:
            self.conn.close()
            self.conn = None
            logger.info("Route service database connection closed")
    
    def _execute_query(self, query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = True):
        """
        SQL sorgusu çalıştır
        
        Args:
            query: SQL sorgusu
            params: Sorgu parametreleri
            fetch_one: Tek satır getir
            fetch_all: Tüm satırları getir
            
        Returns:
            Query sonucu veya None
        """
        if psycopg2 is None:  # pragma: no cover - handled in tests
            logger.error("psycopg2 is not installed. Query execution unavailable.")
            return None
        if not self.conn:
            if not self.connect():
                return None
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                
                if fetch_one:
                    return cur.fetchone()
                elif fetch_all:
                    return cur.fetchall()
                else:
                    self.conn.commit()
                    return cur.rowcount
                    
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    @cache_result(ttl=300)
    def get_all_active_routes(self) -> List[Dict[str, Any]]:
        """Tüm aktif rotaları getir (cached)"""
        # Optimized query with better performance
        query = """
            SELECT 
                r.id,
                r.name,
                r.description,
                r.route_type,
                r.difficulty_level,
                r.estimated_duration,
                r.total_distance,
                r.elevation_gain,
                r.is_circular,
                r.season_availability,
                r.tags,
                r.created_at,
                r.updated_at,
                COUNT(DISTINCT rp.poi_id) as poi_count,
                COALESCE(
                    json_object_agg(
                        rr.category, rr.rating
                    ) FILTER (WHERE rr.category IS NOT NULL), 
                    '{}'::json
                ) as ratings
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE r.is_active = true
            GROUP BY r.id
            ORDER BY r.created_at DESC;
        """
        
        routes = self._execute_query(query)
        if routes:
            return [dict(route) for route in routes]
        return []

    def get_route_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """İsme göre rota getir"""
        query = """
            SELECT id, name
            FROM routes
            WHERE LOWER(name) = LOWER(%s) AND is_active = true
            LIMIT 1;
        """
        result = self._execute_query(query, (name,), fetch_one=True)
        return dict(result) if result else None

    @cache_result(ttl=600)
    def get_route_by_id(self, route_id: int) -> Optional[Dict[str, Any]]:
        """ID'ye göre rota detaylarını getir (cached, optimized)"""
        # Single optimized query to get route with POIs
        query = """
            WITH route_data AS (
                SELECT 
                    r.*,
                    COALESCE(
                        json_object_agg(
                            rr.category, rr.rating
                        ) FILTER (WHERE rr.category IS NOT NULL), 
                        '{}'::json
                    ) as ratings
                FROM routes r
                LEFT JOIN route_ratings rr ON r.id = rr.route_id
                WHERE r.id = %s AND r.is_active = true
                GROUP BY r.id
            ),
            route_pois AS (
                SELECT 
                    rp.route_id,
                    json_agg(
                        json_build_object(
                            'poi_id', rp.poi_id,
                            'order_in_route', rp.order_in_route,
                            'is_mandatory', rp.is_mandatory,
                            'estimated_time_at_poi', rp.estimated_time_at_poi,
                            'notes', rp.notes,
                            'name', p.name,
                            'lat', ST_Y(p.location::geometry),
                            'lon', ST_X(p.location::geometry),
                            'category', p.category,
                            'description', p.description
                        ) ORDER BY rp.order_in_route
                    ) as pois
                FROM route_pois rp
                JOIN pois p ON rp.poi_id = p.id
                WHERE rp.route_id = %s
                GROUP BY rp.route_id
            )
            SELECT 
                rd.*,
                COALESCE(rp.pois, '[]'::json) as pois
            FROM route_data rd
            LEFT JOIN route_pois rp ON rd.id = rp.route_id;
        """
        
        route = self._execute_query(query, (route_id, route_id), fetch_one=True)
        if route:
            return dict(route)
        return None
    
    def get_route_pois(self, route_id: int) -> List[Dict[str, Any]]:
        """Rotaya ait POI'leri sıralı şekilde getir"""
        query = """
            SELECT rp.*, p.name, 
                   ST_Y(p.location::geometry) as lat, 
                   ST_X(p.location::geometry) as lon, 
                   p.category, p.description
            FROM route_pois rp
            JOIN pois p ON rp.poi_id = p.id
            WHERE rp.route_id = %s
            ORDER BY rp.order_in_route;
        """
        
        pois = self._execute_query(query, (route_id,))
        if pois:
            return [dict(poi) for poi in pois]
        return []
    
    def filter_routes(self, filters: Dict[str, Any], page: int = 0, limit: int = 20) -> Dict[str, Any]:
        """
        Filtrelere göre rotaları getir
        
        Args:
            filters: {
                'route_type': str,
                'difficulty_level': {'min': int, 'max': int},
                'duration': {'min': int, 'max': int},
                'distance': {'min': float, 'max': float},
                'tags': list,
                'season': str
            }
        """
        where_conditions = ["r.is_active = true"]
        params = []
        param_count = 0
        
        # Route type filter
        if filters.get('route_type'):
            param_count += 1
            where_conditions.append(f"r.route_type = ${param_count}")
            params.append(filters['route_type'])
        
        # Difficulty level filter
        if filters.get('difficulty_level'):
            difficulty = filters['difficulty_level']
            if difficulty.get('min') is not None:
                param_count += 1
                where_conditions.append(f"r.difficulty_level >= ${param_count}")
                params.append(difficulty['min'])
            if difficulty.get('max') is not None:
                param_count += 1
                where_conditions.append(f"r.difficulty_level <= ${param_count}")
                params.append(difficulty['max'])
        
        # Duration filter
        if filters.get('duration'):
            duration = filters['duration']
            if duration.get('min') is not None:
                param_count += 1
                where_conditions.append(f"r.estimated_duration >= ${param_count}")
                params.append(duration['min'])
            if duration.get('max') is not None:
                param_count += 1
                where_conditions.append(f"r.estimated_duration <= ${param_count}")
                params.append(duration['max'])
        
        # Distance filter
        if filters.get('distance'):
            distance = filters['distance']
            if distance.get('min') is not None:
                param_count += 1
                where_conditions.append(f"r.total_distance >= ${param_count}")
                params.append(distance['min'])
            if distance.get('max') is not None:
                param_count += 1
                where_conditions.append(f"r.total_distance <= ${param_count}")
                params.append(distance['max'])
        
        # Tags filter
        if filters.get('tags') and isinstance(filters['tags'], list):
            for tag in filters['tags']:
                param_count += 1
                where_conditions.append(f"r.tags ILIKE ${param_count}")
                params.append(f"%{tag}%")
        
        # Season filter
        if filters.get('season'):
            param_count += 1
            where_conditions.append(f"r.season_availability::jsonb ? ${param_count}")
            params.append(filters['season'])
        
        # Add pagination parameters
        offset = page * limit
        params.extend([limit, offset])
        param_count += 2
        
        # Build query with pagination
        where_clause = " AND ".join(where_conditions)
        
        # Count query for total results
        count_query = f"""
            SELECT COUNT(DISTINCT r.id)
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE {where_clause};
        """
        
        # Main query with pagination
        query = f"""
            SELECT 
                r.id,
                r.name,
                r.description,
                r.route_type,
                r.difficulty_level,
                r.estimated_duration,
                r.total_distance,
                r.is_circular,
                COUNT(DISTINCT rp.poi_id) as poi_count,
                COALESCE(
                    json_object_agg(
                        rr.category, rr.rating
                    ) FILTER (WHERE rr.category IS NOT NULL), 
                    '{{}}'::json
                ) as ratings
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE {where_clause}
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT ${param_count-1} OFFSET ${param_count};
        """
        
        # Convert $n placeholders to %s for psycopg2
        for i in range(param_count, 0, -1):
            query = query.replace(f"${i}", "%s")
            count_query = count_query.replace(f"${i}", "%s")
        
        # Get total count (excluding pagination params)
        count_params = params[:-2]
        total_result = self._execute_query(count_query, tuple(count_params), fetch_one=True)
        total = total_result['count'] if total_result else 0
        
        # Get paginated results
        routes = self._execute_query(query, tuple(params))
        
        return {
            'routes': [dict(route) for route in routes] if routes else [],
            'total': total,
            'page': page,
            'limit': limit,
            'has_more': (page + 1) * limit < total
        }
    
    def create_route(self, route_data: Dict[str, Any]) -> Optional[int]:
        """
        Yeni rota oluştur
        
        Args:
            route_data: Rota bilgileri
            
        Returns:
            Oluşturulan rotanın ID'si veya None
        """
        required_fields = ['name', 'description', 'route_type']
        for field in required_fields:
            if field not in route_data:
                logger.error(f"Required field missing: {field}")
                return None
        
        query = """
            INSERT INTO routes (
                name, description, route_type, difficulty_level, estimated_duration,
                total_distance, elevation_gain, is_circular, season_availability, tags
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id;
        """
        
        params = (
            route_data['name'],
            route_data['description'],
            route_data['route_type'],
            route_data.get('difficulty_level', 1),
            route_data.get('estimated_duration'),
            route_data.get('total_distance'),
            route_data.get('elevation_gain'),
            route_data.get('is_circular', False),
            Json(route_data.get('season_availability', ["spring", "summer", "autumn", "winter"])),
            route_data.get('tags', '')
        )
        
        result = self._execute_query(query, params, fetch_one=True)
        if result:
            route_id = result['id']
            
            # Ratings ekle
            if route_data.get('ratings'):
                self._add_route_ratings(route_id, route_data['ratings'])
            
            # Commit the transaction
            if self.conn:
                self.conn.commit()
                logger.info("Route creation transaction committed")
            
            # Clear cache after creation
            _route_cache.clear()
            
            logger.info(f"Route created with ID: {route_id}")
            return route_id
        
        return None
    
    def update_route(self, route_id: int, route_data: Dict[str, Any]) -> bool:
        """
        Rotayı güncelle
        
        Args:
            route_id: Rota ID'si
            route_data: Güncellenecek veriler
            
        Returns:
            Başarılıysa True
        """
        # Güncellenebilir alanları belirle
        updatable_fields = [
            'name', 'description', 'route_type', 'difficulty_level', 
            'estimated_duration', 'total_distance', 'elevation_gain', 
            'is_circular', 'season_availability', 'tags'
        ]
        
        update_fields = []
        params = []
        
        for field in updatable_fields:
            if field in route_data:
                update_fields.append(f"{field} = %s")
                if field == 'season_availability':
                    params.append(Json(route_data[field]))
                else:
                    params.append(route_data[field])
        
        if not update_fields:
            logger.warning("No valid fields to update")
            return False
        
        # updated_at alanını ekle
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(route_id)
        
        query = f"""
            UPDATE routes 
            SET {', '.join(update_fields)}
            WHERE id = %s AND is_active = true;
        """
        
        result = self._execute_query(query, tuple(params), fetch_all=False)
        
        if result and result > 0:
            # Ratings güncelle
            if route_data.get('ratings'):
                self._update_route_ratings(route_id, route_data['ratings'])
            
            # Clear cache after update
            _route_cache.clear()
            
            logger.info(f"Route {route_id} updated successfully")
            return True
        
        return False
    
    def delete_route(self, route_id: int) -> bool:
        """
        Rotayı sil (soft delete)
        
        Args:
            route_id: Rota ID'si
            
        Returns:
            Başarılıysa True
        """
        query = """
            UPDATE routes 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND is_active = true;
        """
        
        result = self._execute_query(query, (route_id,), fetch_all=False)
        
        if result and result > 0:
            # Clear cache after deletion
            _route_cache.clear()
            
            logger.info(f"Route {route_id} deleted successfully")
            return True
        
        return False
    
    def associate_pois(self, route_id: int, poi_associations: List[Dict[str, Any]]) -> bool:
        """
        Rotaya POI'leri ilişkilendir
        
        Args:
            route_id: Rota ID'si
            poi_associations: [
                {
                    'poi_id': int,
                    'order_in_route': int,
                    'is_mandatory': bool,
                    'estimated_time_at_poi': int,
                    'notes': str
                }
            ]
            
        Returns:
            Başarılıysa True
        """
        logger.info(f"Associating {len(poi_associations)} POIs with route {route_id}")
        
        if not poi_associations:
            logger.info(f"No POIs to associate with route {route_id}, clearing existing associations")
            try:
                delete_query = "DELETE FROM route_pois WHERE route_id = %s;"
                result = self._execute_query(delete_query, (route_id,), fetch_all=False)
                logger.info(f"Cleared existing POI associations for route {route_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to clear POI associations for route {route_id}: {e}")
                return False
        
        try:
            # Önce mevcut ilişkileri sil
            delete_query = "DELETE FROM route_pois WHERE route_id = %s;"
            delete_result = self._execute_query(delete_query, (route_id,), fetch_all=False)
            logger.info(f"Deleted {delete_result} existing POI associations for route {route_id}")
            
            # Yeni ilişkileri ekle
            insert_query = """
                INSERT INTO route_pois (
                    route_id, poi_id, order_in_route, is_mandatory, 
                    estimated_time_at_poi, notes
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """
            
            for i, association in enumerate(poi_associations):
                params = (
                    route_id,
                    association['poi_id'],
                    association.get('order_in_route', i + 1),
                    association.get('is_mandatory', True),
                    association.get('estimated_time_at_poi', 15),
                    association.get('notes', '')
                )
                
                logger.debug(f"Inserting POI association: {params}")
                result = self._execute_query(insert_query, params, fetch_all=False)
                logger.debug(f"Insert result: {result}")
            
            logger.info(f"Successfully associated {len(poi_associations)} POIs with route {route_id}")
            
            # Cache'i temizle
            try:
                cache_key = f"get_route_by_id_{route_id}"
                if hasattr(_route_cache, 'delete'):
                    _route_cache.delete(cache_key)
                elif hasattr(_route_cache, 'clear'):
                    _route_cache.clear()  # Tüm cache'i temizle
                logger.debug(f"Cache cleared for route {route_id}")
            except Exception as cache_error:
                logger.warning(f"Failed to clear cache for route {route_id}: {cache_error}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to associate POIs with route {route_id}: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def save_route_geometry(self, route_id: int, geometry_segments: List[Dict], 
                          total_distance: float, estimated_time: int, waypoints: List[Dict]) -> bool:
        """
        Rota geometrisini veritabanına kaydet
        
        Args:
            route_id: Rota ID'si
            geometry_segments: Rota segmentleri
            total_distance: Toplam mesafe (metre)
            estimated_time: Tahmini süre (saniye)
            waypoints: Waypoint'ler
            
        Returns:
            Başarılıysa True
        """
        try:
            logger.info(f"Saving geometry for route {route_id}")
            logger.info(f"Geometry segments: {len(geometry_segments)} segments")
            logger.info(f"Total distance: {total_distance}m, Estimated time: {estimated_time}s")
            
            # Geometry segments'i LineString formatına çevir
            linestring_coords = []
            for i, segment in enumerate(geometry_segments):
                logger.info(f"Processing segment {i}: {segment}")
                if 'coordinates' in segment and segment['coordinates']:
                    for coord in segment['coordinates']:
                        if 'lat' in coord and 'lng' in coord:
                            linestring_coords.append([coord['lng'], coord['lat']])
            
            logger.info(f"Extracted {len(linestring_coords)} coordinates")
            
            if not linestring_coords:
                logger.warning(f"No valid coordinates found for route {route_id}")
                return False
            
            # PostGIS LineString formatı oluştur
            linestring_wkt = "LINESTRING(" + ",".join([f"{lng} {lat}" for lng, lat in linestring_coords]) + ")"
            logger.info(f"Generated LineString WKT: {linestring_wkt[:200]}...")
            
            # Veritabanını güncelle
            update_query = """
                UPDATE routes 
                SET route_geometry = ST_GeomFromText(%s, 4326),
                    total_distance = %s,
                    estimated_duration = %s,
                    waypoints = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """
            
            # Estimated duration'ı dakikaya çevir
            estimated_duration_minutes = int(estimated_time / 60) if estimated_time > 0 else None
            logger.info(f"Converted values - Distance: {total_distance / 1000}km, Duration: {estimated_duration_minutes}min")
            
            params = (
                linestring_wkt,
                total_distance / 1000,  # Metre'den km'ye çevir
                estimated_duration_minutes,
                Json(waypoints),
                route_id
            )
            
            logger.info(f"Executing update query with params: {params}")
            result = self._execute_query(update_query, params, fetch_all=False)
            logger.info(f"Update query result: {result}")
            
            # Commit the transaction
            if self.conn:
                self.conn.commit()
                logger.info("Transaction committed")
            
            # Verify the update
            verify_query = "SELECT route_geometry IS NOT NULL as has_geometry FROM routes WHERE id = %s;"
            verify_result = self._execute_query(verify_query, (route_id,), fetch_one=True)
            logger.info(f"Verification result: {verify_result}")
            
            # Cache'i temizle
            _route_cache.clear()
            
            logger.info(f"Successfully saved geometry for route {route_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save geometry for route {route_id}: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def get_route_geometry(self, route_id: int) -> Optional[Dict]:
        """
        Rota geometrisini getir
        
        Args:
            route_id: Rota ID'si
            
        Returns:
            Rota geometrisi veya None
        """
        try:
            query = """
                SELECT 
                    ST_AsGeoJSON(route_geometry) as geometry,
                    total_distance,
                    estimated_duration,
                    waypoints
                FROM routes 
                WHERE id = %s AND route_geometry IS NOT NULL;
            """
            
            result = self._execute_query(query, (route_id,), fetch_one=True)
            
            if result:
                geometry_data = {
                    'route_id': route_id,
                    'geometry': json.loads(result['geometry']) if result['geometry'] else None,
                    'total_distance': result['total_distance'],
                    'estimated_duration': result['estimated_duration'],
                    'waypoints': result['waypoints'] or []
                }
                
                logger.info(f"Retrieved geometry for route {route_id}")
                return geometry_data
            else:
                logger.info(f"No geometry found for route {route_id}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get geometry for route {route_id}: {e}")
            return None
    
    def _add_route_ratings(self, route_id: int, ratings: Dict[str, int]):
        """Rota puanlarını ekle"""
        for category, rating in ratings.items():
            query = """
                INSERT INTO route_ratings (route_id, category, rating)
                VALUES (%s, %s, %s)
                ON CONFLICT (route_id, category) 
                DO UPDATE SET rating = EXCLUDED.rating;
            """
            self._execute_query(query, (route_id, category, rating), fetch_all=False)
    
    def _update_route_ratings(self, route_id: int, ratings: Dict[str, int]):
        """Rota puanlarını güncelle"""
        self._add_route_ratings(route_id, ratings)
    
    def search_routes(self, search_term: str) -> List[Dict[str, Any]]:
        """
        Rota arama
        
        Args:
            search_term: Arama terimi
            
        Returns:
            Bulunan rotalar
        """
        query = """
            SELECT r.*, 
                   COUNT(rp.poi_id) as poi_count,
                   COALESCE(
                       json_object_agg(
                           rr.category, rr.rating
                       ) FILTER (WHERE rr.category IS NOT NULL), 
                       '{}'::json
                   ) as ratings
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE r.is_active = true 
            AND (
                r.name ILIKE %s 
                OR r.description ILIKE %s 
                OR r.tags ILIKE %s
            )
            GROUP BY r.id
            ORDER BY r.created_at DESC;
        """
        
        search_pattern = f"%{search_term}%"
        routes = self._execute_query(query, (search_pattern, search_pattern, search_pattern))
        
        if routes:
            return [dict(route) for route in routes]
        return []
    
    def find_nearby_pois(self, route_id: int, max_distance_meters: int = 500) -> List[Dict[str, Any]]:
        """
        Rota yakınındaki POI'leri bul
        
        Args:
            route_id: Rota ID'si
            max_distance_meters: Maksimum mesafe (metre)
            
        Returns:
            Yakındaki POI'ler ve mesafe bilgileri
        """
        query = """
            SELECT 
                p.id,
                p.name,
                p.category,
                p.description,
                ST_Y(p.location::geometry) as lat,
                ST_X(p.location::geometry) as lon,
                ST_Distance(r.route_geometry, p.location) as distance_meters,
                ST_AsText(ST_ClosestPoint(r.route_geometry::geometry, p.location::geometry)) as closest_point_on_route
            FROM pois p
            CROSS JOIN routes r
            WHERE r.id = %s 
            AND r.route_geometry IS NOT NULL
            AND p.is_active = true
            AND ST_DWithin(r.route_geometry, p.location, %s)
            AND p.id NOT IN (
                SELECT poi_id FROM route_pois WHERE route_id = %s
            )
            ORDER BY distance_meters ASC;
        """
        
        pois = self._execute_query(query, (route_id, max_distance_meters, route_id))
        if pois:
            result = []
            for poi in pois:
                poi_dict = dict(poi)
                # Closest point koordinatlarını parse et
                if poi_dict.get('closest_point_on_route'):
                    # PostGIS POINT formatından koordinatları çıkar
                    point_str = poi_dict['closest_point_on_route']
                    # POINT(lng lat) formatından koordinatları çıkar
                    if 'POINT(' in point_str:
                        coords = point_str.replace('POINT(', '').replace(')', '').split()
                        if len(coords) == 2:
                            poi_dict['closest_route_point'] = {
                                'lng': float(coords[0]),
                                'lat': float(coords[1])
                            }
                
                result.append(poi_dict)
            return result
        return []
    
    def auto_associate_nearby_pois(self, route_id: int, max_distance_meters: int = 500, 
                                 auto_confirm: bool = False) -> Dict[str, Any]:
        """
        Rota yakınındaki POI'leri otomatik olarak ilişkilendir
        
        Args:
            route_id: Rota ID'si
            max_distance_meters: Maksimum mesafe (metre)
            auto_confirm: Otomatik onay (True ise direkt ekler)
            
        Returns:
            İşlem sonucu ve bulunan POI'ler
        """
        try:
            # Yakındaki POI'leri bul
            nearby_pois = self.find_nearby_pois(route_id, max_distance_meters)
            
            if not nearby_pois:
                return {
                    'success': True,
                    'message': 'Rota yakınında POI bulunamadı',
                    'found_pois': [],
                    'associated_count': 0
                }
            
            if not auto_confirm:
                # Sadece bulunan POI'leri döndür, ekleme yapma
                return {
                    'success': True,
                    'message': f'{len(nearby_pois)} POI bulundu',
                    'found_pois': nearby_pois,
                    'associated_count': 0,
                    'requires_confirmation': True
                }
            
            # Mevcut POI'leri al
            existing_pois = self.get_route_pois(route_id)
            max_order = max([poi.get('order_in_route', 0) for poi in existing_pois], default=0)
            
            # Yeni POI ilişkilendirmelerini hazırla
            new_associations = []
            for i, poi in enumerate(nearby_pois):
                association = {
                    'poi_id': poi['id'],
                    'order_in_route': max_order + i + 1,
                    'is_mandatory': False,  # Otomatik eklenenler opsiyonel
                    'estimated_time_at_poi': 10,  # Kısa süre
                    'notes': f'Otomatik eklendi - {int(poi["distance_meters"])}m mesafede'
                }
                new_associations.append(association)
            
            # Mevcut ilişkilendirmeleri koru, yenilerini ekle
            all_associations = []
            for existing in existing_pois:
                all_associations.append({
                    'poi_id': existing['poi_id'],
                    'order_in_route': existing['order_in_route'],
                    'is_mandatory': existing.get('is_mandatory', True),
                    'estimated_time_at_poi': existing.get('estimated_time_at_poi', 15),
                    'notes': existing.get('notes', '')
                })
            
            all_associations.extend(new_associations)
            
            # İlişkilendirmeleri kaydet
            if self.associate_pois(route_id, all_associations):
                logger.info(f"Auto-associated {len(new_associations)} POIs to route {route_id}")
                return {
                    'success': True,
                    'message': f'{len(new_associations)} POI otomatik olarak rotaya eklendi',
                    'found_pois': nearby_pois,
                    'associated_count': len(new_associations)
                }
            else:
                return {
                    'success': False,
                    'message': 'POI ilişkilendirme işlemi başarısız',
                    'found_pois': nearby_pois,
                    'associated_count': 0
                }
                
        except Exception as e:
            logger.error(f"Auto-association failed for route {route_id}: {e}")
            return {
                'success': False,
                'message': f'Otomatik POI ekleme hatası: {str(e)}',
                'found_pois': [],
                'associated_count': 0
            }
    
    def get_route_statistics(self) -> Dict[str, Any]:
        """Rota istatistiklerini getir"""
        stats_query = """
            SELECT 
                COUNT(*) as total_routes,
                COUNT(*) FILTER (WHERE is_active = true) as active_routes,
                COUNT(*) FILTER (WHERE route_type = 'walking') as walking_routes,
                COUNT(*) FILTER (WHERE route_type = 'hiking') as hiking_routes,
                COUNT(*) FILTER (WHERE route_type = 'cycling') as cycling_routes,
                COUNT(*) FILTER (WHERE route_type = 'driving') as driving_routes,
                AVG(difficulty_level) as avg_difficulty,
                AVG(estimated_duration) as avg_duration,
                AVG(total_distance) as avg_distance
            FROM routes;
        """
        
        stats = self._execute_query(stats_query, fetch_one=True)
        if stats:
            return dict(stats)
        return {}


# Test fonksiyonu
def test_route_service():
    """Route service test fonksiyonu"""
    service = RouteService()
    
    if not service.connect():
        print("❌ Database connection failed")
        return
    
    print("✅ Database connected")
    
    # Test: Tüm rotaları getir
    routes = service.get_all_active_routes()
    print(f"📋 Found {len(routes)} active routes")
    
    # Test: Filtreleme
    filters = {
        'route_type': 'walking',
        'difficulty_level': {'min': 1, 'max': 3}
    }
    filtered_routes = service.filter_routes(filters)
    print(f"🔍 Found {len(filtered_routes)} filtered routes")
    
    # Test: İstatistikler
    stats = service.get_route_statistics()
    print(f"📊 Route statistics: {stats}")
    
    service.disconnect()
    print("✅ Test completed")


if __name__ == "__main__":
    test_route_service()

# --- Cache utilities ---
def clear_route_cache():
    """Clear all cached route data (list/details)."""
    try:
        _route_cache.clear()
    except Exception:
        pass