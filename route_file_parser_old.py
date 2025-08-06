#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route File Parser - KML, KMZ ve GPX dosyalarından rota verilerini çıkarır
"""

import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import os
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

class RouteFileParser:
    """KML, KMZ ve GPX dosyalarını parse eden sınıf"""
    
    def __init__(self):
        self.supported_formats = ['gpx', 'kml', 'kmz']
    
    def parse_file(self, file_path: str, file_type: str = None) -> Dict[str, Any]:
        """Dosyayı parse et ve rota verilerini çıkar"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")
        
        # Dosya tipini belirle
        if not file_type:
            file_type = self._detect_file_type(file_path)
        
        if file_type not in self.supported_formats:
            raise ValueError(f"Desteklenmeyen dosya tipi: {file_type}")
        
        try:
            if file_type == 'gpx':
                return self._parse_gpx(file_path)
            elif file_type == 'kml':
                return self._parse_kml(file_path)
            elif file_type == 'kmz':
                return self._parse_kmz(file_path)
        except Exception as e:
            logger.error(f"Dosya parse hatası: {e}")
            raise ValueError(f"Dosya parse edilemedi: {str(e)}")
    
    def _detect_file_type(self, file_path: str) -> str:
        """Dosya uzantısından tipi belirle"""
        extension = os.path.splitext(file_path)[1].lower()
        if extension == '.gpx':
            return 'gpx'
        elif extension == '.kml':
            return 'kml'
        elif extension == '.kmz':
            return 'kmz'
        else:
            raise ValueError(f"Desteklenmeyen dosya uzantısı: {extension}")
    
    def _parse_gpx(self, file_path: str) -> Dict[str, Any]:
        """GPX dosyasını parse et"""
        try:
            import gpxpy
        except ImportError:
            raise ImportError("gpxpy kütüphanesi gerekli: pip install gpxpy")
        
        with open(file_path, 'r', encoding='utf-8') as gpx_file:
            gpx = gpxpy.parse(gpx_file)
        
        routes = []
        tracks = []
        waypoints = []
        
        # GPX waypoints
        for waypoint in gpx.waypoints:
            waypoints.append({
                'name': waypoint.name or 'Waypoint',
                'description': waypoint.description or '',
                'lat': waypoint.latitude,
                'lon': waypoint.longitude,
                'elevation': waypoint.elevation
            })
        
        # GPX routes
        for route in gpx.routes:
            route_points = []
            for point in route.points:
                route_points.append({
                    'lat': point.latitude,
                    'lon': point.longitude,
                    'elevation': point.elevation
                })
            
            routes.append({
                'name': route.name or 'Route',
                'description': route.description or '',
                'points': route_points,
                'distance': self._calculate_distance(route_points),
                'type': 'route'
            })
        
        # GPX tracks
        for track in gpx.tracks:
            track_points = []
            for segment in track.segments:
                for point in segment.points:
                    track_points.append({
                        'lat': point.latitude,
                        'lon': point.longitude,
                        'elevation': point.elevation
                    })
            
            tracks.append({
                'name': track.name or 'Track',
                'description': track.description or '',
                'points': track_points,
                'distance': self._calculate_distance(track_points),
                'type': 'track'
            })
        
        metadata = {
            'name': gpx.name or 'GPX Route',
            'description': gpx.description or '',
            'creator': gpx.creator or ''
        }
        
        return {
            'format': 'gpx',
            'metadata': metadata,
            'routes': routes,
            'tracks': tracks,
            'waypoints': waypoints,
            'total_routes': len(routes) + len(tracks),
            'total_waypoints': len(waypoints)
        }
    
    def _parse_kml(self, file_path: str) -> Dict[str, Any]:
        """KML dosyasını parse et"""
        logger.info(f"KML dosyası parse ediliyor: {file_path}")
        
        # Farklı encoding'leri dene
        content = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                with open(file_path, 'r', encoding=encoding) as kml_file:
                    content = kml_file.read()
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise ValueError("KML dosyası okunamadı - encoding sorunu")
        
        # XML içeriğini temizle
        content = content.strip()
        
        # BOM karakterini kaldır
        if content.startswith('\ufeff'):
            content = content[1:]
        
        # XML declaration'ı kontrol et ve düzelt
        if not content.startswith('<?xml'):
            content = '<?xml version="1.0" encoding="UTF-8"?>\n' + content
        
        try:
            root = ET.fromstring(content)
            ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        except ET.ParseError as e:
            logger.error(f"XML parse hatası: {e}")
            # Namespace olmadan dene
            try:
                # Namespace'i kaldır
                content_no_ns = content.replace(' xmlns="http://www.opengis.net/kml/2.2"', '')
                root = ET.fromstring(content_no_ns)
                ns = {}  # Namespace yok
            except ET.ParseError:
                raise ValueError(f"KML XML parse edilemedi: {e}")
        
        routes = []
        waypoints = []
        
        # Namespace'e göre xpath'leri ayarla
        if ns:
            doc_xpath = './/kml:Document/kml:name'
            placemark_xpath = './/kml:Placemark'
            name_xpath = 'kml:name'
            desc_xpath = 'kml:description'
            point_xpath = './/kml:Point'
            linestring_xpath = './/kml:LineString'
            coords_xpath = 'kml:coordinates'
        else:
            doc_xpath = './/Document/name'
            placemark_xpath = './/Placemark'
            name_xpath = 'name'
            desc_xpath = 'description'
            point_xpath = './/Point'
            linestring_xpath = './/LineString'
            coords_xpath = 'coordinates'
        
        # Document name'i al
        doc_name = root.find(doc_xpath, ns)
        metadata_name = doc_name.text if doc_name is not None else 'KML Route'
        
        # Placemark'ları bul
        for placemark in root.findall(placemark_xpath, ns):
            name_elem = placemark.find(name_xpath, ns)
            desc_elem = placemark.find(desc_xpath, ns)
            
            name = name_elem.text if name_elem is not None else 'Unnamed'
            description = desc_elem.text if desc_elem is not None else ''
            
            # Point kontrolü (waypoint)
            point = placemark.find(point_xpath, ns)
            if point is not None:
                coords_elem = point.find(coords_xpath, ns)
                if coords_elem is not None and coords_elem.text:
                    coords_text = coords_elem.text.strip()
                    coords = coords_text.split(',')
                    if len(coords) >= 2:
                        try:
                            waypoints.append({
                                'name': name,
                                'description': description,
                                'lat': float(coords[1]),
                                'lon': float(coords[0]),
                                'elevation': float(coords[2]) if len(coords) > 2 else None
                            })
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Waypoint koordinat hatası: {e}")
            
            # LineString kontrolü (route)
            linestring = placemark.find(linestring_xpath, ns)
            if linestring is not None:
                coords_elem = linestring.find(coords_xpath, ns)
                if coords_elem is not None and coords_elem.text:
                    coords_text = coords_elem.text.strip()
                    points = []
                    
                    # Koordinatları parse et
                    for coord_line in coords_text.split():
                        coord_line = coord_line.strip()
                        if coord_line:
                            coords = coord_line.split(',')
                            if len(coords) >= 2:
                                try:
                                    points.append({
                                        'lat': float(coords[1]),
                                        'lon': float(coords[0]),
                                        'elevation': float(coords[2]) if len(coords) > 2 else None
                                    })
                                except (ValueError, IndexError) as e:
                                    logger.warning(f"Route koordinat hatası: {e}")
                    
                    if points:
                        routes.append({
                            'name': name,
                            'description': description,
                            'points': points,
                            'distance': self._calculate_distance(points),
                            'type': 'route'
                        })
        
        metadata = {
            'name': metadata_name,
            'description': '',
            'creator': 'KML Parser'
        }
        
        return {
            'format': 'kml',
            'metadata': metadata,
            'routes': routes,
            'tracks': [],
            'waypoints': waypoints,
            'total_routes': len(routes),
            'total_waypoints': len(waypoints)
        }
    
    def _parse_kmz(self, file_path: str) -> Dict[str, Any]:
        """KMZ dosyasını parse et"""
        import zipfile
        import tempfile
        
        routes = []
        waypoints = []
        
        with zipfile.ZipFile(file_path, 'r') as kmz_file:
            kml_files = [f for f in kmz_file.namelist() if f.lower().endswith('.kml')]
            
            if not kml_files:
                raise ValueError("KMZ dosyasında KML dosyası bulunamadı")
            
            for kml_filename in kml_files:
                kml_content = kmz_file.read(kml_filename)
                
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.kml', delete=False) as temp_kml:
                    temp_kml.write(kml_content)
                    temp_kml_path = temp_kml.name
                
                try:
                    kml_data = self._parse_kml(temp_kml_path)
                    routes.extend(kml_data['routes'])
                    waypoints.extend(kml_data['waypoints'])
                finally:
                    if os.path.exists(temp_kml_path):
                        os.remove(temp_kml_path)
        
        metadata = {
            'name': 'KMZ Route',
            'description': '',
            'creator': 'KMZ Parser'
        }
        
        return {
            'format': 'kmz',
            'metadata': metadata,
            'routes': routes,
            'tracks': [],
            'waypoints': waypoints,
            'total_routes': len(routes),
            'total_waypoints': len(waypoints)
        }
    
    def _calculate_distance(self, points: List[Dict]) -> float:
        """Mesafe hesapla"""
        if len(points) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(1, len(points)):
            p1 = points[i-1]
            p2 = points[i]
            distance = self._haversine_distance(p1['lat'], p1['lon'], p2['lat'], p2['lon'])
            total_distance += distance
        
        return round(total_distance, 2)
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine mesafe"""
        import math
        
        R = 6371
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def convert_to_route_data(self, parsed_data: Dict[str, Any], route_index: int = 0) -> Dict[str, Any]:
        """Rota verisine çevir"""
        all_routes = parsed_data['routes'] + parsed_data['tracks']
        
        if not all_routes:
            raise ValueError("Dosyada rota bulunamadı")
        
        if route_index >= len(all_routes):
            route_index = 0
        
        selected_route = all_routes[route_index]
        metadata = parsed_data['metadata']
        
        return {
            'name': selected_route['name'] or metadata['name'] or 'İçe Aktarılan Rota',
            'description': selected_route['description'] or metadata['description'] or 'Dosyadan içe aktarılan rota',
            'route_type': 'walking',
            'difficulty_level': 3,
            'estimated_duration': max(30, int(selected_route['distance'] * 15)),
            'total_distance': selected_route['distance'],
            'is_circular': False,
            'tags': f"içe-aktarılan, {parsed_data['format']}",
            'geometry': selected_route['points'],
            'waypoints': parsed_data['waypoints'],
            'source_file': parsed_data['format'].upper(),
            'import_date': datetime.now().isoformat()
        }


if __name__ == '__main__':
    parser = RouteFileParser()
    print("✅ RouteFileParser hazır")
    print(f"📁 Desteklenen formatlar: {parser.supported_formats}")