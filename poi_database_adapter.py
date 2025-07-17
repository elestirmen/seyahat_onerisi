# -*- coding: utf-8 -*-
"""
POI Veritabanı Adaptörü
PostgreSQL/PostGIS ve MongoDB için unified interface
"""

import os
import json
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import logging

# PostgreSQL imports
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

# MongoDB imports
try:
    from pymongo import MongoClient, GEOSPHERE
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False

logger = logging.getLogger(__name__)


class POIDatabase(ABC):
    """POI veritabanı için abstract base class"""
    
    @abstractmethod
    def connect(self):
        """Veritabanına bağlan"""
        pass
    
    @abstractmethod
    def disconnect(self):
        """Veritabanı bağlantısını kapat"""
        pass
    
    @abstractmethod
    def get_pois_by_category(self, category: str) -> Dict[str, Tuple[float, float]]:
        """Kategori bazında POI'leri getir"""
        pass
    
    @abstractmethod
    def get_poi_details(self, poi_id: Any) -> Optional[Dict[str, Any]]:
        """POI detaylarını getir"""
        pass
    
    @abstractmethod
    def search_nearby_pois(self, lat: float, lon: float, radius_meters: float) -> List[Dict[str, Any]]:
        """Yakındaki POI'leri ara"""
        pass
    
    @abstractmethod
    def add_poi(self, poi_data: Dict[str, Any]) -> Any:
        """Yeni POI ekle"""
        pass
    
    @abstractmethod
    def update_poi(self, poi_id: Any, update_data: Dict[str, Any]) -> bool:
        """
        POI güncelle
        Args:
            poi_id: POI'nin benzersiz kimliği
            update_data: Güncellenecek alanlar (ör: {"name": "Yeni Ad", "latitude": 38.6, ...})
        Returns:
            bool: Başarılıysa True
        """
        pass


class PostgreSQLPOIDatabase(POIDatabase):
    """PostgreSQL/PostGIS POI veritabanı adaptörü"""
    
    def __init__(self, connection_string: str):
        """
        Args:
            connection_string: PostgreSQL bağlantı string'i
                Örnek: "postgresql://user:password@localhost/poi_db"
        """
        if not POSTGRES_AVAILABLE:
            raise ImportError("psycopg2 kurulu değil. pip install psycopg2-binary")
        
        self.connection_string = connection_string
        self.conn = None
    
    def connect(self):
        """PostgreSQL'e bağlan"""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("PostgreSQL veritabanına bağlandı")
        except Exception as e:
            logger.error(f"PostgreSQL bağlantı hatası: {e}")
            raise
    
    def disconnect(self):
        """Bağlantıyı kapat"""
        if self.conn:
            self.conn.close()
            logger.info("PostgreSQL bağlantısı kapatıldı")
    
    def get_pois_by_category(self, category: str) -> Dict[str, Tuple[float, float]]:
        """Kategori bazında POI'leri getir"""
        if not self.conn:
            raise RuntimeError("Veritabanı bağlantısı yok")
            
        query = """
            SELECT 
                name,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lon
            FROM pois
            WHERE category = %s AND is_active = true
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (category,))
            results = cur.fetchall()
        
        return {row['name']: (row['lat'], row['lon']) for row in results}
    
    def get_poi_details(self, poi_id: int) -> Optional[Dict[str, Any]]:
        """POI detaylarını getir"""
        if not self.conn:
            raise RuntimeError("Veritabanı bağlantısı yok")
            
        query = """
            SELECT 
                p.*,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lon,
                array_agg(
                    json_build_object(
                        'id', pi.id,
                        'url', pi.image_url,
                        'caption', pi.caption,
                        'is_primary', pi.is_primary
                    )
                ) FILTER (WHERE pi.id IS NOT NULL) as images
            FROM pois p
            LEFT JOIN poi_images pi ON p.id = pi.poi_id
            WHERE p.id = %s
            GROUP BY p.id
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (poi_id,))
            result = cur.fetchone()
        
        if result:
            result['coordinates'] = (result.pop('lat'), result.pop('lon'))
        
        return dict(result) if result else None
    
    def search_nearby_pois(self, lat: float, lon: float, radius_meters: float) -> List[Dict[str, Any]]:
        """Yakındaki POI'leri ara"""
        query = """
            SELECT 
                id,
                name,
                category,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lon,
                ST_Distance(location, ST_GeogFromText('POINT(%s %s)')) as distance
            FROM pois
            WHERE 
                ST_DWithin(location, ST_GeogFromText('POINT(%s %s)'), %s)
                AND is_active = true
            ORDER BY distance
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (lon, lat, lon, lat, radius_meters))
            results = cur.fetchall()
        
        return [dict(row) for row in results]
    
    def add_poi(self, poi_data: Dict[str, Any]) -> int:
        """Yeni POI ekle"""
        query = """
            INSERT INTO pois (
                name, category, location, altitude, 
                description, short_description, attributes
            ) VALUES (
                %s, %s, ST_GeogFromText('POINT(%s %s)'), %s,
                %s, %s, %s
            ) RETURNING id
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query, (
                poi_data['name'],
                poi_data['category'],
                poi_data['longitude'],
                poi_data['latitude'],
                poi_data.get('altitude'),
                poi_data.get('description'),
                poi_data.get('short_description'),
                Json(poi_data.get('attributes', {}))
            ))
            poi_id = cur.fetchone()[0]
            self.conn.commit()
        
        # Görüntüleri ekle
        if 'images' in poi_data:
            self._add_images(poi_id, poi_data['images'])
        
        return poi_id
    
    def update_poi(self, poi_id: int, update_data: Dict[str, Any]) -> bool:
        """
        POI güncelle (PostgreSQL)
        Args:
            poi_id: POI'nin id'si
            update_data: Güncellenecek alanlar
        Returns:
            bool: Başarılıysa True
        """
        if not self.conn:
            raise RuntimeError("Veritabanı bağlantısı yok")
        set_clauses = []
        values = []
        for key, value in update_data.items():
            if key in ["latitude", "longitude"]:
                continue  # Koordinatlar özel işlenir
            set_clauses.append(f"{key} = %s")
            values.append(value)
        if "latitude" in update_data and "longitude" in update_data:
            set_clauses.append("location = ST_GeogFromText('POINT(%s %s)')")
            values.append(update_data["longitude"])
            values.append(update_data["latitude"])
        if not set_clauses:
            return False
        set_clause = ", ".join(set_clauses)
        query = f"UPDATE pois SET {set_clause}, updated_at = NOW() WHERE id = %s"
        values.append(poi_id)
        with self.conn.cursor() as cur:
            cur.execute(query, tuple(values))
            self.conn.commit()
            return cur.rowcount > 0
    
    def _add_images(self, poi_id: int, images: List[Dict[str, Any]]):
        """POI'ye görüntüler ekle"""
        query = """
            INSERT INTO poi_images (
                poi_id, image_url, thumbnail_url, caption, is_primary
            ) VALUES (%s, %s, %s, %s, %s)
        """
        
        with self.conn.cursor() as cur:
            for idx, image in enumerate(images):
                cur.execute(query, (
                    poi_id,
                    image.get('url'),
                    image.get('thumbnail_url'),
                    image.get('caption'),
                    image.get('is_primary', idx == 0)
                ))
            self.conn.commit()


class MongoDBPOIDatabase(POIDatabase):
    """MongoDB POI veritabanı adaptörü"""
    
    def __init__(self, connection_string: str, database_name: str = "poi_db"):
        """
        Args:
            connection_string: MongoDB bağlantı string'i
                Örnek: "mongodb://localhost:27017/"
            database_name: Veritabanı adı
        """
        if not MONGODB_AVAILABLE:
            raise ImportError("pymongo kurulu değil. pip install pymongo")
        
        self.connection_string = connection_string
        self.database_name = database_name
        self.client = None
        self.db = None
        self.pois = None # Changed from self.collection to self.pois
    
    def connect(self):
        """MongoDB'ye bağlan"""
        try:
            self.client = MongoClient(self.connection_string)
            self.db = self.client[self.database_name]
            self.pois = self.db.pois # Changed from self.collection to self.pois
            
            # Geospatial index oluştur
            self.pois.create_index([("location", GEOSPHERE)]) # Changed from self.collection to self.pois
            
            logger.info("MongoDB veritabanına bağlandı")
        except Exception as e:
            logger.error(f"MongoDB bağlantı hatası: {e}")
            raise
    
    def disconnect(self):
        """Bağlantıyı kapat"""
        if self.client:
            self.client.close()
            logger.info("MongoDB bağlantısı kapatıldı")
    
    def get_pois_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Kategori bazında POI'leri ve tüm alanlarını getirir."""
        if not self.client:
            raise RuntimeError("Veritabanı bağlantısı yok")
        
        query = {'category': category, 'isActive': True}
        
        # Projeksiyon ile gereksiz alanları çıkarabiliriz, şimdilik hepsi
        results = list(self.pois.find(query))
        
        # MongoDB'nin _id'sini string'e çevir
        for r in results:
            r['_id'] = str(r['_id'])
            # Frontend'de beklenen 'latitude' ve 'longitude' alanlarını oluştur
            if 'location' in r and 'coordinates' in r['location']:
                r['longitude'], r['latitude'] = r['location']['coordinates']
        
        return results

    def get_poi_details(self, poi_id: str) -> Optional[Dict[str, Any]]:
        """POI detaylarını getirir (MongoDB)"""
        if not self.client:
            raise RuntimeError("Veritabanı bağlantısı yok")
        
        try:
            from bson.objectid import ObjectId
            obj_id = ObjectId(poi_id)
        except Exception:
            logger.error(f"Geçersiz POI ID formatı: {poi_id}")
            return None

        poi = self.pois.find_one({'_id': obj_id, 'isActive': True})
        
        if poi:
            poi['_id'] = str(poi['_id'])
            if 'location' in poi and 'coordinates' in poi['location']:
                poi['longitude'], poi['latitude'] = poi['location']['coordinates']
        
        return poi

    def search_nearby_pois(self, lat: float, lon: float, radius_meters: float) -> List[Dict[str, Any]]:
        """Yakındaki POI'leri ara"""
        query = {
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "$maxDistance": radius_meters
                }
            },
            "isActive": {"$ne": False}
        }
        
        pois = self.pois.find(query).limit(50) # Changed from self.collection to self.pois
        
        results = []
        for poi in pois:
            coords = poi['location']['coordinates']
            results.append({
                'id': str(poi['_id']),
                'name': poi['name'],
                'category': poi['category'],
                'lat': coords[1],
                'lon': coords[0]
            })
        
        return results
    
    def add_poi(self, poi_data: Dict[str, Any]) -> str:
        """Yeni POI ekle"""
        document = {
            "name": poi_data['name'],
            "category": poi_data['category'],
            "location": {
                "type": "Point",
                "coordinates": [poi_data['longitude'], poi_data['latitude']]
            },
            "altitude": poi_data.get('altitude'),
            "description": poi_data.get('description', {}),
            "images": poi_data.get('images', []),
            "model3d": poi_data.get('model3d'),
            "attributes": poi_data.get('attributes', {}),
            "tags": poi_data.get('tags', []),
            "isActive": poi_data.get('isActive', True),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = self.pois.insert_one(document) # Changed from self.collection to self.pois
        return str(result.inserted_id)
    
    def update_poi(self, poi_id: str, update_data: Dict[str, Any]) -> bool:
        """
        POI güncelle (MongoDB)
        Args:
            poi_id: POI'nin id'si (string)
            update_data: Güncellenecek alanlar
        Returns:
            bool: Başarılıysa True
        """
        from bson import ObjectId
        update_fields = update_data.copy()
        # Gelen veride latitude/longitude varsa, GeoJSON formatına çevir
        if 'latitude' in update_fields and 'longitude' in update_fields:
            update_fields['location'] = {
                'type': 'Point',
                'coordinates': [update_fields.pop('longitude'), update_fields.pop('latitude')]
            }
        
        # ObjectId'ye çevir
        try:
            from bson.objectid import ObjectId
            obj_id = ObjectId(poi_id)
        except Exception:
            logger.error(f"Geçersiz POI ID formatı: {poi_id}")
            return False

        result = self.pois.update_one({'_id': obj_id}, {'$set': update_fields}) # Changed from self.collection to self.pois
        return result.modified_count > 0


class POIDatabaseFactory:
    """POI veritabanı factory"""
    
    @staticmethod
    def create_database(db_type: str, **kwargs) -> POIDatabase:
        """
        Veritabanı tipine göre uygun adaptörü oluştur
        
        Args:
            db_type: 'postgresql' veya 'mongodb' (varsayılan: postgresql önerilir)
            **kwargs: Veritabanı bağlantı parametreleri
        
        Returns:
            POIDatabase instance
        """
        if db_type.lower() == 'postgresql':
            return PostgreSQLPOIDatabase(kwargs.get('connection_string'))
        elif db_type.lower() == 'mongodb':
            return MongoDBPOIDatabase(
                kwargs.get('connection_string'),
                kwargs.get('database_name', 'poi_db')
            )
        else:
            raise ValueError(f"Desteklenmeyen veritabanı tipi: {db_type}")


# Mevcut koda entegrasyon için yardımcı fonksiyon
def load_poi_data_from_database(db_config: Dict[str, str]) -> Dict[str, Dict[str, Tuple[float, float]]]:
    """
    Veritabanından POI verilerini yükle
    
    Args:
        db_config: Veritabanı konfigürasyonu
            {
                'type': 'postgresql' veya 'mongodb' (varsayılan: postgresql önerilir),
                'connection_string': '...',
                'database_name': '...' (sadece MongoDB için)
            }
    
    Returns:
        Mevcut POI_DATA formatında veri
    """
    db = POIDatabaseFactory.create_database(**db_config)
    
    try:
        db.connect()
        
        # Tüm kategorileri al
        categories = ['gastronomik', 'kulturel', 'sanatsal', 'doga_macera', 'konaklama']
        
        poi_data = {}
        for category in categories:
            poi_data[category] = db.get_pois_by_category(category)
        
        return poi_data
    
    finally:
        db.disconnect()


# Örnek kullanım
if __name__ == "__main__":
    # PostgreSQL örneği
    if POSTGRES_AVAILABLE:
        pg_config = {
            'type': 'postgresql',
            'connection_string': 'postgresql://user:password@localhost/poi_db'
        }
        
        pg_db = POIDatabaseFactory.create_database(**pg_config)
        pg_db.connect()
        
        # Yeni POI ekle
        new_poi = {
            'name': 'Test Müzesi',
            'category': 'kulturel',
            'latitude': 38.6322,
            'longitude': 34.9115,
            'altitude': 1050,
            'description': 'Test açıklaması',
            'attributes': {
                'opening_hours': '09:00-17:00',
                'ticket_price': 25
            }
        }
        # poi_id = pg_db.add_poi(new_poi)
        # POI güncelleme örneği
        # update_result = pg_db.update_poi(poi_id, {"name": "Yeni Ad", "latitude": 38.63, "longitude": 34.91})
        
        pg_db.disconnect()
    
    # MongoDB örneği
    if MONGODB_AVAILABLE:
        mongo_config = {
            'type': 'mongodb',
            'connection_string': 'mongodb://localhost:27017/',
            'database_name': 'poi_db'
        }
        
        mongo_db = POIDatabaseFactory.create_database(**mongo_config)
        mongo_db.connect()
        
        # Yakındaki POI'leri ara
        # nearby = mongo_db.search_nearby_pois(38.6310, 34.9130, 5505)
        # POI güncelleme örneği
        # update_result = mongo_db.update_poi(poi_id, {"name": "Yeni Ad", "latitude": 38.63, "longitude": 34.91})
        
        mongo_db.disconnect()