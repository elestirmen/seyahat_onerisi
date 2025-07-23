# -*- coding: utf-8 -*-
"""
POI Veritabanı Adaptörü
Sadece PostgreSQL/PostGIS için interface
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
            # Ratings tablosu mevcut mu kontrol et, yoksa oluştur
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS poi_ratings (
                        poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
                        category TEXT,
                        rating INTEGER CHECK (rating BETWEEN 0 AND 100),
                        PRIMARY KEY (poi_id, category)
                    );
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_poi_ratings_poi_id ON poi_ratings(poi_id);"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_poi_ratings_category ON poi_ratings(category);"
                )
                self.conn.commit()
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
                        'caption', pi.caption,
                        'is_primary', pi.is_primary,
                        'thumbnail_url', pi.thumbnail_url
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
            # UI detay ekranı latitude ve longitude alanlarını bekliyor
            result['latitude'] = result.pop('lat')
            result['longitude'] = result.pop('lon')
            # Geriye uyumluluk için coordinates tuple'ı da ekle
            result['coordinates'] = (result['latitude'], result['longitude'])
            # UI JSON formatında `_id` alanı bekleniyor
            result['_id'] = result['id']
            
            # Ratingleri yeni tablodan oku
            ratings = self.get_poi_ratings(poi_id)
            result['ratings'] = ratings if ratings else self.get_default_ratings()
        
        return dict(result) if result else None

    def get_default_ratings(self) -> Dict[str, int]:
        """Varsayılan rating değerleri"""
        return {
            'tarihi': 0,
            'sanat_kultur': 0,
            'doga': 0,
            'eglence': 0,
            'alisveris': 0,
            'spor': 0,
            'macera': 0,
            'rahatlatici': 0,
            'yemek': 0,
            'gece_hayati': 0
        }

    def get_poi_ratings(self, poi_id: int) -> Dict[str, int]:
        """Belirli bir POI'nin tüm puanlarını döndür"""
        query = "SELECT category, rating FROM poi_ratings WHERE poi_id = %s"
        with self.conn.cursor() as cur:
            cur.execute(query, (poi_id,))
            rows = cur.fetchall()
        return {row[0]: row[1] for row in rows}

    def update_poi_ratings(self, poi_id: int, ratings: Dict[str, int]) -> None:
        """POI ratinglerini upsert et"""
        insert_q = (
            "INSERT INTO poi_ratings (poi_id, category, rating) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (poi_id, category) DO UPDATE SET rating = EXCLUDED.rating"
        )
        with self.conn.cursor() as cur:
            for category, rating in ratings.items():
                cur.execute(insert_q, (poi_id, category, rating))
        self.conn.commit()
    
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
        
        return poi_id
    
    def update_poi(self, poi_id: int, update_data: Dict[str, Any]) -> bool:
        """
        POI güncelle (PostgreSQL)
        Args:
            poi_id: POI'nin id'si
            update_data: Güncellenecek alanlar (ratings dahil)
        Returns:
            bool: Başarılıysa True
        """
        if not self.conn:
            raise RuntimeError("Veritabanı bağlantısı yok")
        
        # Valid database columns
        valid_columns = {
            'name', 'category', 'altitude', 'description', 'short_description', 
            'is_active', 'created_at', 'updated_at'
        }
        
        # Field mapping: API camelCase -> Database snake_case
        field_mapping = {
            'isActive': 'is_active',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at',
            'shortDescription': 'short_description'
        }
        
        set_clauses = []
        values = []
        attributes_to_update = {}
        ratings_updated = False
        
        for key, value in update_data.items():
            if key in ["latitude", "longitude"]:
                continue  # Koordinatlar özel işlenir
            
            # Map camelCase to snake_case if needed
            db_column = field_mapping.get(key, key)
            
            if db_column in valid_columns:
                # Valid database column - update directly
                set_clauses.append(f"{db_column} = %s")
                values.append(value)
            elif key != "ratings":  # ratings'i attributes'a ekleme!
                # Store in attributes JSONB column
                attributes_to_update[key] = value
        
        # Handle coordinate updates
        if "latitude" in update_data and "longitude" in update_data:
            set_clauses.append("location = ST_GeogFromText('POINT(%s %s)')")
            values.append(update_data["longitude"])
            values.append(update_data["latitude"])
        
        # Handle ratings updates - yeni tablo
        if "ratings" in update_data:
            ratings_data = update_data["ratings"]
            if isinstance(ratings_data, dict):
                validated_ratings = self.validate_ratings(ratings_data)
                self.update_poi_ratings(poi_id, validated_ratings)
                ratings_updated = True
                print(f"✅ POI {poi_id} için rating'ler güncellendi: {validated_ratings}")
        
        # Handle attributes updates
        if attributes_to_update:
            # Get current attributes and merge with new ones
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT attributes FROM pois WHERE id = %s", (poi_id,))
                result = cur.fetchone()
                current_attributes = result['attributes'] if result and result['attributes'] else {}
                
            # Merge attributes (ratings dahil)
            current_attributes.update(attributes_to_update)
            set_clauses.append("attributes = %s")
            values.append(Json(current_attributes))
        
        if not set_clauses and not attributes_to_update:
            return ratings_updated
            
        set_clause = ", ".join(set_clauses)
        query = f"UPDATE pois SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        values.append(poi_id)
        
        with self.conn.cursor() as cur:
            cur.execute(query, tuple(values))
            self.conn.commit()
            return cur.rowcount > 0

    def validate_ratings(self, ratings: Dict[str, Any]) -> Dict[str, int]:
        """Rating verilerini validate et ve temizle. Tüm gönderilen kategorileri sakla, valid olmayanlar için uyarı ver."""
        valid_categories = {
            'tarihi', 'sanat_kultur', 'doga', 'eglence', 'alisveris', 
            'spor', 'macera', 'rahatlatici', 'yemek', 'gece_hayati'
        }
        validated = {}
        for category, value in ratings.items():
            try:
                value_int = int(value)
                validated[category] = max(0, min(100, value_int))
                if category not in valid_categories:
                    print(f"[WARN] Bilinmeyen rating kategorisi: {category}")
            except (ValueError, TypeError):
                validated[category] = 0
        # Eksik valid kategoriler için sıfır ekle
        for category in valid_categories:
            if category not in validated:
                validated[category] = 0
        return validated

    def list_pois(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Aktif POI'leri listele (opsiyonel kategori filtresi) ve UI ile uyumlu obje dizisi döndür"""
        if not self.conn:
            raise RuntimeError("Veritabanı bağlantısı yok")

        base_query = """
            SELECT
                id,
                name,
                category,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                description,
                (
                    SELECT json_object_agg(category, rating)
                    FROM poi_ratings pr
                    WHERE pr.poi_id = pois.id
                ) AS ratings
            FROM pois
            WHERE is_active = true
        """
        params: List[Any] = []
        if category:
            base_query += " AND category = %s"
            params.append(category)

        base_query += " ORDER BY name"

        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(base_query, params)
            results = cur.fetchall()

        # UI JSON formatında `_id` alanı bekleniyor
        formatted: List[Dict[str, Any]] = []
        for row in results:
            poi_data = {
                "_id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "description": row["description"],
            }
            
            # Rating sistemini ekle
            if row.get('ratings') and isinstance(row['ratings'], dict):
                poi_data['ratings'] = row['ratings']
            else:
                poi_data['ratings'] = self.get_default_ratings()
            
            formatted.append(poi_data)
            
        return formatted


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
    db = POIDatabaseFactory.create_database(
        db_config['type'],
        connection_string=db_config['connection_string'],
        database_name=db_config.get('database_name')
    )
    
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