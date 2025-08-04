#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route Service
Rota yönetimi için veritabanı işlemleri ve business logic
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


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
    
    def get_all_active_routes(self) -> List[Dict[str, Any]]:
        """Tüm aktif rotaları getir"""
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
            GROUP BY r.id
            ORDER BY r.created_at DESC;
        """
        
        routes = self._execute_query(query)
        if routes:
            return [dict(route) for route in routes]
        return []
    
    def get_route_by_id(self, route_id: int) -> Optional[Dict[str, Any]]:
        """ID'ye göre rota detaylarını getir"""
        query = """
            SELECT r.*, 
                   COALESCE(
                       json_object_agg(
                           rr.category, rr.rating
                       ) FILTER (WHERE rr.category IS NOT NULL), 
                       '{}'::json
                   ) as ratings
            FROM routes r
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE r.id = %s AND r.is_active = true
            GROUP BY r.id;
        """
        
        route = self._execute_query(query, (route_id,), fetch_one=True)
        if route:
            # POI'leri de getir
            route_dict = dict(route)
            route_dict['pois'] = self.get_route_pois(route_id)
            return route_dict
        return None
    
    def get_route_pois(self, route_id: int) -> List[Dict[str, Any]]:
        """Rotaya ait POI'leri sıralı şekilde getir"""
        query = """
            SELECT rp.*, p.name, p.latitude as lat, p.longitude as lon, p.category, p.description
            FROM route_pois rp
            JOIN pois p ON rp.poi_id = p.id
            WHERE rp.route_id = %s
            ORDER BY rp.order_in_route;
        """
        
        pois = self._execute_query(query, (route_id,))
        if pois:
            return [dict(poi) for poi in pois]
        return []
    
    def filter_routes(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
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
        
        # Build query
        where_clause = " AND ".join(where_conditions)
        query = f"""
            SELECT r.*, 
                   COUNT(rp.poi_id) as poi_count,
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
            ORDER BY r.created_at DESC;
        """
        
        # Convert $n placeholders to %s for psycopg2
        for i in range(param_count, 0, -1):
            query = query.replace(f"${i}", "%s")
        
        routes = self._execute_query(query, tuple(params))
        if routes:
            return [dict(route) for route in routes]
        return []
    
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
        if not poi_associations:
            return True
        
        try:
            # Önce mevcut ilişkileri sil
            delete_query = "DELETE FROM route_pois WHERE route_id = %s;"
            self._execute_query(delete_query, (route_id,), fetch_all=False)
            
            # Yeni ilişkileri ekle
            insert_query = """
                INSERT INTO route_pois (
                    route_id, poi_id, order_in_route, is_mandatory, 
                    estimated_time_at_poi, notes
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """
            
            for association in poi_associations:
                params = (
                    route_id,
                    association['poi_id'],
                    association.get('order_in_route', 1),
                    association.get('is_mandatory', True),
                    association.get('estimated_time_at_poi', 15),
                    association.get('notes', '')
                )
                
                self._execute_query(insert_query, params, fetch_all=False)
            
            logger.info(f"POI associations updated for route {route_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to associate POIs with route {route_id}: {e}")
            return False
    
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