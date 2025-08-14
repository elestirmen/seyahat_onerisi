#!/usr/bin/env python3
"""
Elevation Service
Rota için elevation profili hesaplar ve veritabanına kaydeder
"""

import math
import requests
import json
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import time
import os

class ElevationService:
    """Elevation hesaplama servisi"""
    
    def __init__(self):
        self.cappadocia_bounds = {
            'min_lat': 38.5,
            'max_lat': 38.8,
            'min_lng': 34.7,
            'max_lng': 35.0
        }
        # Real elevation provider config (defaults enabled)
        # Default to OpenTopoData + EU-DEM 25m unless explicitly disabled via env
        env_provider = os.getenv('ELEVATION_PROVIDER', '').strip().lower()
        env_dataset = os.getenv('ELEVATION_DATASET', '').strip().lower()
        self.elevation_provider = env_provider if env_provider else 'opentopodata'
        self.elevation_dataset = env_dataset if env_dataset else 'eudem25m'
        self.http_timeout_seconds = int(os.getenv('ELEVATION_HTTP_TIMEOUT', '10'))
        self.max_batch_size = 90  # keep URL size reasonable for GET
        self.request_backoff_seconds = 1
        self.elevation_cache: Dict[str, float] = {}
        
        # Kapadokya bölgesi için gerçekçi elevation değerleri
        self.region_elevations = {
            'urgup': {'lat': 38.6274, 'lng': 34.9115, 'elevation': 1100},
            'goreme': {'lat': 38.6431, 'lng': 34.8289, 'elevation': 1000},
            'avanos': {'lat': 38.7153, 'lng': 34.8478, 'elevation': 950},
            'nevsehir': {'lat': 38.6244, 'lng': 34.7236, 'elevation': 1250},
            'ortahisar': {'lat': 38.6089, 'lng': 34.8678, 'elevation': 1050},
            'uchisar': {'lat': 38.6267, 'lng': 34.8067, 'elevation': 1350}
        }
    
    def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """İki nokta arası mesafeyi metre cinsinden hesaplar (Haversine formula)"""
        R = 6371000  # Earth radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def get_estimated_elevation(self, lat: float, lng: float) -> float:
        """Kapadokya bölgesi için gerçekçi elevation tahmini"""
        
        # Bölge sınırları dışında ise ortalama değer döndür
        if not (self.cappadocia_bounds['min_lat'] <= lat <= self.cappadocia_bounds['max_lat'] and
                self.cappadocia_bounds['min_lng'] <= lng <= self.cappadocia_bounds['max_lng']):
            return 1100
        
        # En yakın bilinen noktaları bul
        min_distance = float('inf')
        closest_elevation = 1100
        
        for location_data in self.region_elevations.values():
            distance = self.calculate_distance(
                lat, lng, 
                location_data['lat'], 
                location_data['lng']
            )
            if distance < min_distance:
                min_distance = distance
                closest_elevation = location_data['elevation']
        
        # Mesafeye göre varyasyon ekle
        variation = min(50, min_distance / 1000 * 10)  # Her km için 10m varyasyon, max 50m
        
        # Koordinat bazlı ince ayar
        lat_factor = (lat - 38.6) * 100  # Kuzey-güney varyasyonu
        lng_factor = (lng - 34.85) * 80   # Doğu-batı varyasyonu
        
        # Noise ekle (gerçekçi topografik varyasyon için)
        noise = math.sin(lat * 1000) * 20 + math.cos(lng * 1000) * 15
        
        estimated = closest_elevation + lat_factor + lng_factor + noise
        
        # Kapadokya için makul sınırlar (800-1400m)
        return max(800, min(1400, round(estimated)))

    def _cache_key(self, lat: float, lng: float) -> str:
        # Round to 5 decimals (~1m precision) to improve cache hits
        return f"{lat:.5f},{lng:.5f}"

    def _fetch_elevations_opentopodata(self, points: List[Tuple[float, float]]) -> List[Optional[float]]:
        if not points:
            return []
        results: List[Optional[float]] = []
        base_url = f"https://api.opentopodata.org/v1/{self.elevation_dataset}"

        # Process in chunks
        for i in range(0, len(points), self.max_batch_size):
            chunk = points[i:i + self.max_batch_size]
            # Build locations param
            locations = "|".join([f"{lat},{lng}" for lat, lng in chunk])
            url = f"{base_url}?locations={locations}"
            try:
                resp = requests.get(url, timeout=self.http_timeout_seconds)
                if resp.status_code == 429:
                    time.sleep(self.request_backoff_seconds)
                    resp = requests.get(url, timeout=self.http_timeout_seconds)
                resp.raise_for_status()
                data = resp.json()
                chunk_results = []
                for item in data.get('results', []):
                    elevation = item.get('elevation')
                    chunk_results.append(elevation if elevation is not None else None)
                # If API returns fewer results than requested, pad None
                while len(chunk_results) < len(chunk):
                    chunk_results.append(None)
                results.extend(chunk_results)
            except Exception:
                # On error, append None for this chunk
                results.extend([None] * len(chunk))
        return results

    def _get_real_elevations(self, points: List[Tuple[float, float]]) -> List[float]:
        """Fetch real elevations with caching and fallback to estimation when needed."""
        elevations: List[float] = []
        to_query: List[Tuple[int, float, float]] = []

        # Prepare cache lookups
        for idx, (lat, lng) in enumerate(points):
            key = self._cache_key(lat, lng)
            if key in self.elevation_cache:
                elevations.append(self.elevation_cache[key])
            else:
                elevations.append(float('nan'))
                to_query.append((idx, lat, lng))

        # Query missing ones via provider
        if to_query and self.elevation_provider == 'opentopodata':
            query_points = [(lat, lng) for _, lat, lng in to_query]
            fetch_results = self._fetch_elevations_opentopodata(query_points)
            for (idx, lat, lng), elev in zip(to_query, fetch_results):
                if elev is None:
                    elev = self.get_estimated_elevation(lat, lng)
                elevations[idx] = elev
                self.elevation_cache[self._cache_key(lat, lng)] = elev

        # Fallback if provider not configured
        if any(math.isnan(v) for v in elevations):
            for i, v in enumerate(elevations):
                if math.isnan(v):
                    lat, lng = points[i]
                    elevations[i] = self.get_estimated_elevation(lat, lng)
        return elevations
    
    def interpolate_points_along_route(self, waypoints: List[Dict], resolution_meters: int = 100) -> List[Dict]:
        """Rota boyunca belirtilen çözünürlükte noktalar oluşturur"""
        
        if len(waypoints) < 2:
            return waypoints
        
        interpolated_points = []
        total_distance = 0
        
        # İlk noktayı ekle
        first_point = waypoints[0]
        interpolated_points.append({
            'lat': first_point['lat'],
            'lng': first_point['lng'],
            'distance': 0,
            'elevation': self.get_estimated_elevation(first_point['lat'], first_point['lng']),
            'type': 'waypoint',
            'name': first_point.get('name', '')
        })
        
        for i in range(1, len(waypoints)):
            prev_point = waypoints[i - 1]
            curr_point = waypoints[i]
            
            # Bu segment için mesafe hesapla
            segment_distance = self.calculate_distance(
                prev_point['lat'], prev_point['lng'],
                curr_point['lat'], curr_point['lng']
            )
            
            # Kaç interpolasyon noktası gerekli
            num_interpolations = max(1, int(segment_distance / resolution_meters))
            
            # Bu segment boyunca noktalar oluştur
            for j in range(1, num_interpolations + 1):
                ratio = j / num_interpolations
                
                # Linear interpolation
                interp_lat = prev_point['lat'] + (curr_point['lat'] - prev_point['lat']) * ratio
                interp_lng = prev_point['lng'] + (curr_point['lng'] - prev_point['lng']) * ratio
                
                distance_from_prev = self.calculate_distance(
                    prev_point['lat'], prev_point['lng'],
                    interp_lat, interp_lng
                )
                
                total_distance += distance_from_prev
                
                point_type = 'waypoint' if j == num_interpolations else 'interpolated'
                point_name = curr_point.get('name', '') if j == num_interpolations else ''
                
                interpolated_points.append({
                    'lat': interp_lat,
                    'lng': interp_lng,
                    'distance': total_distance,
                    'elevation': self.get_estimated_elevation(interp_lat, interp_lng),
                    'type': point_type,
                    'name': point_name
                })
                
                prev_point = {'lat': interp_lat, 'lng': interp_lng}
        
        return interpolated_points
    
    def calculate_elevation_stats(self, elevation_points: List[Dict]) -> Dict:
        """Elevation istatistiklerini hesaplar"""
        
        if not elevation_points:
            return {}
        
        elevations = [point['elevation'] for point in elevation_points]
        
        min_elevation = min(elevations)
        max_elevation = max(elevations)
        
        # Ascent/descent hesaplama
        total_ascent = 0
        total_descent = 0
        
        for i in range(1, len(elevations)):
            diff = elevations[i] - elevations[i-1]
            if diff > 0:
                total_ascent += diff
            else:
                total_descent += abs(diff)
        
        return {
            'min_elevation': min_elevation,
            'max_elevation': max_elevation,
            'total_ascent': round(total_ascent),
            'total_descent': round(total_descent),
            'elevation_gain': max_elevation - min_elevation,
            'avg_elevation': round(sum(elevations) / len(elevations))
        }
    
    def generate_elevation_profile_from_geometry(self, coordinates: List[List[float]], resolution_meters: int = 100) -> Dict:
        """Geometry koordinatlarından elevation profili oluşturur"""
        
        if len(coordinates) < 2:
            raise ValueError("En az 2 koordinat gerekli")
        
        print(f"🏔️ Generating elevation profile from {len(coordinates)} geometry points with {resolution_meters}m resolution...")
        
        # Tüm koordinatları işle, mesafe hesapla
        elevation_points = []
        total_distance = 0
        
        included_points: List[Tuple[float, float]] = []
        for i, coord in enumerate(coordinates):
            lng, lat = coord[0], coord[1]  # GeoJSON format: [lng, lat]
            
            # Mesafe hesapla (önceki noktadan)
            if i > 0:
                prev_coord = coordinates[i-1]
                segment_distance = self.calculate_distance(
                    prev_coord[1], prev_coord[0],  # lat, lng
                    lat, lng
                )
                total_distance += segment_distance
            
            # Her resolution_meters'da bir nokta ekle veya önemli noktaları dahil et
            should_include = (
                i == 0 or  # First point
                i == len(coordinates) - 1 or  # Last point
                total_distance >= len(elevation_points) * resolution_meters  # Resolution interval
            )
            
            if should_include:
                included_points.append((lat, lng))
                elevation_points.append({
                    'lat': lat,
                    'lng': lng,
                    'distance': total_distance,
                    'elevation': None,  # fill below
                    'type': 'geometry_point',
                    'name': f'Point {len(included_points)}'
                })

        # Fill elevations using real provider if configured
        if self.elevation_provider:
            elevations = self._get_real_elevations(included_points)
        else:
            elevations = [self.get_estimated_elevation(lat, lng) for lat, lng in included_points]

        for i, elev in enumerate(elevations):
            elevation_points[i]['elevation'] = elev
        
        # İstatistikleri hesapla
        stats = self.calculate_elevation_stats(elevation_points)
        
        # Sonuç formatı
        profile = {
            'points': elevation_points,
            'stats': stats,
            'resolution': resolution_meters,
            'total_distance': total_distance,
            'point_count': len(elevation_points),
            'last_updated': datetime.utcnow().isoformat() + 'Z',
            'source': 'geometry'
        }
        
        print(f"✅ Generated elevation profile from geometry: {len(elevation_points)} points, "
              f"{total_distance:.1f}m total distance")
        print(f"   📊 Stats: {stats['min_elevation']}-{stats['max_elevation']}m, "
              f"+{stats['total_ascent']}m/-{stats['total_descent']}m")
        
        return profile

    def generate_elevation_profile(self, waypoints: List[Dict], resolution_meters: int = 100) -> Dict:
        """Bir rota için komple elevation profili oluşturur"""
        
        print(f"🏔️ Generating elevation profile with {resolution_meters}m resolution...")
        
        # Waypoint'ler arasında interpolasyon yap
        elevation_points = self.interpolate_points_along_route(waypoints, resolution_meters)
        # Replace elevations with real data if provider configured
        if self.elevation_provider and elevation_points:
            pts = [(p['lat'], p['lng']) for p in elevation_points]
            elevations = self._get_real_elevations(pts)
            for i, elev in enumerate(elevations):
                elevation_points[i]['elevation'] = elev
        
        # İstatistikleri hesapla
        stats = self.calculate_elevation_stats(elevation_points)
        
        # Sonuç formatı
        profile = {
            'points': elevation_points,
            'stats': stats,
            'resolution': resolution_meters,
            'total_distance': elevation_points[-1]['distance'] if elevation_points else 0,
            'point_count': len(elevation_points),
            'last_updated': datetime.utcnow().isoformat() + 'Z'
        }
        
        print(f"✅ Generated elevation profile: {len(elevation_points)} points, "
              f"{profile['total_distance']:.1f}m total distance")
        print(f"   📊 Stats: {stats['min_elevation']}-{stats['max_elevation']}m, "
              f"+{stats['total_ascent']}m/-{stats['total_descent']}m")
        
        return profile
    
    def optimize_resolution_for_route(self, total_distance: float, waypoint_count: int) -> int:
        """Rota uzunluğuna göre optimal çözünürlük belirler"""
        # Tüm rotalar için ~10m örnekleme çözünürlüğü kullan
        # Not: Çok uzun rotalarda performans gerekirse ayarlanabilir
        return 10

# Test fonksiyonu
def test_elevation_service():
    """Elevation service'i test et"""
    
    service = ElevationService()
    
    # Test waypoints (Ürgüp bölgesi)
    test_waypoints = [
        {'lat': 38.6274, 'lng': 34.9115, 'name': 'Ürgüp Merkez'},
        {'lat': 38.6431, 'lng': 34.8289, 'name': 'Göreme'},
        {'lat': 38.6267, 'lng': 34.8067, 'name': 'Uçhisar'},
        {'lat': 38.6089, 'lng': 34.8678, 'name': 'Ortahisar'}
    ]
    
    print("🧪 Testing Elevation Service...")
    
    # Test elevation profili oluştur
    profile = service.generate_elevation_profile(test_waypoints, 100)
    
    print("\n📊 Generated Profile:")
    print(f"   Points: {profile['point_count']}")
    print(f"   Distance: {profile['total_distance']:.1f}m")
    print(f"   Resolution: {profile['resolution']}m")
    print(f"   Elevation range: {profile['stats']['min_elevation']}-{profile['stats']['max_elevation']}m")
    print(f"   Ascent/Descent: +{profile['stats']['total_ascent']}m/-{profile['stats']['total_descent']}m")
    
    print("\n✅ Test completed successfully!")
    
    return profile

if __name__ == "__main__":
    test_elevation_service()
