#!/usr/bin/env python3
"""
Route File Parser Service
Supports GPX, KML, and KMZ file formats for route import functionality.
"""

import xml.etree.ElementTree as ET
import zipfile
import json
import os
import re
import math
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import hashlib


@dataclass
class RoutePoint:
    """Represents a single point in a route"""
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    time: Optional[datetime] = None
    name: Optional[str] = None
    description: Optional[str] = None


@dataclass
class RouteMetadata:
    """Metadata extracted from route files"""
    name: Optional[str] = None
    description: Optional[str] = None
    distance: Optional[float] = None
    elevation_gain: Optional[float] = None
    elevation_loss: Optional[float] = None
    duration: Optional[float] = None
    route_type: Optional[str] = None
    creator: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ParsedRoute:
    """Complete parsed route data"""
    points: List[RoutePoint]
    metadata: RouteMetadata
    waypoints: List[RoutePoint]
    file_hash: str
    original_format: str


class RouteParserError(Exception):
    """Base exception for route parsing errors"""
    def __init__(self, message: str, error_code: str, details: Optional[Dict] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class GPXParser:
    """Parser for GPX (GPS Exchange Format) files"""
    
    def __init__(self):
        self.namespaces = {
            'gpx': 'http://www.topografix.com/GPX/1/1',
            'gpx10': 'http://www.topografix.com/GPX/1/0'
        }
    
    def parse(self, file_path: str) -> ParsedRoute:
        """Parse GPX file and extract route data"""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Detect namespace
            namespace = self._detect_namespace(root)
            
            # Extract metadata
            metadata = self._extract_metadata(root, namespace)
            
            # Extract track points
            points = self._extract_track_points(root, namespace)
            
            # Extract waypoints
            waypoints = self._extract_waypoints(root, namespace)
            
            # Calculate file hash
            file_hash = self._calculate_file_hash(file_path)
            
            # Calculate distance if not provided
            if metadata.distance is None and points:
                metadata.distance = self._calculate_distance(points)
            
            return ParsedRoute(
                points=points,
                metadata=metadata,
                waypoints=waypoints,
                file_hash=file_hash,
                original_format='gpx'
            )
            
        except ET.ParseError as e:
            raise RouteParserError(
                f"GPX dosyası parse edilemedi: {str(e)}",
                "GPX_PARSE_ERROR",
                {"file_path": file_path, "xml_error": str(e)}
            )
        except Exception as e:
            raise RouteParserError(
                f"GPX dosyası işlenirken hata: {str(e)}",
                "GPX_PROCESSING_ERROR",
                {"file_path": file_path, "error": str(e)}
            )
    
    def _detect_namespace(self, root) -> str:
        """Detect GPX namespace version"""
        if root.tag.startswith('{http://www.topografix.com/GPX/1/1}'):
            return 'gpx'
        elif root.tag.startswith('{http://www.topografix.com/GPX/1/0}'):
            return 'gpx10'
        else:
            return 'gpx'  # Default to 1.1
    
    def _extract_metadata(self, root, namespace: str) -> RouteMetadata:
        """Extract metadata from GPX file"""
        metadata = RouteMetadata()
        
        # Name from metadata or first track name
        name_elem = root.find(f'.//{{{self.namespaces[namespace]}}}name')
        if name_elem is not None:
            metadata.name = name_elem.text
        
        # Description
        desc_elem = root.find(f'.//{{{self.namespaces[namespace]}}}desc')
        if desc_elem is not None:
            metadata.description = desc_elem.text
        
        # Creator
        creator = root.get('creator')
        if creator:
            metadata.creator = creator
        
        # Time
        time_elem = root.find(f'.//{{{self.namespaces[namespace]}}}time')
        if time_elem is not None:
            try:
                metadata.created_at = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
            except:
                pass
        
        return metadata
    
    def _extract_track_points(self, root, namespace: str) -> List[RoutePoint]:
        """Extract track points from GPX file"""
        points = []
        
        # Look for track segments
        for trkseg in root.findall(f'.//{{{self.namespaces[namespace]}}}trkseg'):
            for trkpt in trkseg.findall(f'{{{self.namespaces[namespace]}}}trkpt'):
                point = self._parse_track_point(trkpt, namespace)
                if point:
                    points.append(point)
        
        return points
    
    def _extract_waypoints(self, root, namespace: str) -> List[RoutePoint]:
        """Extract waypoints from GPX file"""
        waypoints = []
        
        for wpt in root.findall(f'.//{{{self.namespaces[namespace]}}}wpt'):
            waypoint = self._parse_waypoint(wpt, namespace)
            if waypoint:
                waypoints.append(waypoint)
        
        return waypoints
    
    def _parse_track_point(self, trkpt, namespace: str) -> Optional[RoutePoint]:
        """Parse individual track point"""
        try:
            lat = float(trkpt.get('lat'))
            lon = float(trkpt.get('lon'))
            
            # Elevation
            elevation = None
            ele_elem = trkpt.find(f'{{{self.namespaces[namespace]}}}ele')
            if ele_elem is not None:
                try:
                    elevation = float(ele_elem.text)
                except:
                    pass
            
            # Time
            time = None
            time_elem = trkpt.find(f'{{{self.namespaces[namespace]}}}time')
            if time_elem is not None:
                try:
                    time = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
                except:
                    pass
            
            return RoutePoint(
                latitude=lat,
                longitude=lon,
                elevation=elevation,
                time=time
            )
        except (ValueError, TypeError):
            return None
    
    def _parse_waypoint(self, wpt, namespace: str) -> Optional[RoutePoint]:
        """Parse individual waypoint"""
        try:
            lat = float(wpt.get('lat'))
            lon = float(wpt.get('lon'))
            
            # Name
            name = None
            name_elem = wpt.find(f'{{{self.namespaces[namespace]}}}name')
            if name_elem is not None:
                name = name_elem.text
            
            # Description
            description = None
            desc_elem = wpt.find(f'{{{self.namespaces[namespace]}}}desc')
            if desc_elem is not None:
                description = desc_elem.text
            
            # Elevation
            elevation = None
            ele_elem = wpt.find(f'{{{self.namespaces[namespace]}}}ele')
            if ele_elem is not None:
                try:
                    elevation = float(ele_elem.text)
                except:
                    pass
            
            return RoutePoint(
                latitude=lat,
                longitude=lon,
                elevation=elevation,
                name=name,
                description=description
            )
        except (ValueError, TypeError):
            return None
    
    def _calculate_distance(self, points: List[RoutePoint]) -> float:
        """Calculate total distance of route in meters"""
        if len(points) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(1, len(points)):
            distance = self._haversine_distance(
                points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude
            )
            total_distance += distance
        
        return total_distance
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()


class KMLParser:
    """Parser for KML (Keyhole Markup Language) files"""
    
    def __init__(self):
        self.namespaces = {
            'kml': 'http://www.opengis.net/kml/2.2',
            'kml21': 'http://earth.google.com/kml/2.1',
            'kml20': 'http://earth.google.com/kml/2.0'
        }
    
    def parse(self, file_path: str) -> ParsedRoute:
        """Parse KML file and extract route data"""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Detect namespace
            namespace = self._detect_namespace(root)
            
            # Extract metadata
            metadata = self._extract_metadata(root, namespace)
            
            # Extract route points from LineString elements
            points = self._extract_linestring_points(root, namespace)
            
            # Extract waypoints from Placemark elements
            waypoints = self._extract_placemarks(root, namespace)
            
            # Calculate file hash
            file_hash = self._calculate_file_hash(file_path)
            
            # Calculate distance if not provided
            if metadata.distance is None and points:
                metadata.distance = self._calculate_distance(points)
            
            return ParsedRoute(
                points=points,
                metadata=metadata,
                waypoints=waypoints,
                file_hash=file_hash,
                original_format='kml'
            )
            
        except ET.ParseError as e:
            raise RouteParserError(
                f"KML dosyası parse edilemedi: {str(e)}",
                "KML_PARSE_ERROR",
                {"file_path": file_path, "xml_error": str(e)}
            )
        except Exception as e:
            raise RouteParserError(
                f"KML dosyası işlenirken hata: {str(e)}",
                "KML_PROCESSING_ERROR",
                {"file_path": file_path, "error": str(e)}
            )
    
    def _detect_namespace(self, root) -> str:
        """Detect KML namespace version"""
        if root.tag.startswith('{http://www.opengis.net/kml/2.2}'):
            return 'kml'
        elif root.tag.startswith('{http://earth.google.com/kml/2.1}'):
            return 'kml21'
        elif root.tag.startswith('{http://earth.google.com/kml/2.0}'):
            return 'kml20'
        else:
            return 'kml'  # Default to 2.2
    
    def _extract_metadata(self, root, namespace: str) -> RouteMetadata:
        """Extract metadata from KML file"""
        metadata = RouteMetadata()
        
        # Document name
        name_elem = root.find(f'.//{{{self.namespaces[namespace]}}}Document/{{{self.namespaces[namespace]}}}name')
        if name_elem is not None:
            metadata.name = name_elem.text
        
        # Document description
        desc_elem = root.find(f'.//{{{self.namespaces[namespace]}}}Document/{{{self.namespaces[namespace]}}}description')
        if desc_elem is not None:
            metadata.description = desc_elem.text
        
        # Look for extended data
        extended_data = root.find(f'.//{{{self.namespaces[namespace]}}}ExtendedData')
        if extended_data is not None:
            self._parse_extended_data(extended_data, metadata, namespace)
        
        return metadata
    
    def _parse_extended_data(self, extended_data, metadata: RouteMetadata, namespace: str):
        """Parse extended data for additional metadata"""
        for data in extended_data.findall(f'{{{self.namespaces[namespace]}}}Data'):
            name = data.get('name', '').lower()
            value_elem = data.find(f'{{{self.namespaces[namespace]}}}value')
            if value_elem is not None:
                value = value_elem.text
                
                if name in ['distance', 'length']:
                    try:
                        metadata.distance = float(value)
                    except:
                        pass
                elif name in ['creator', 'author']:
                    metadata.creator = value
                elif name in ['type', 'activity']:
                    metadata.route_type = value
    
    def _extract_linestring_points(self, root, namespace: str) -> List[RoutePoint]:
        """Extract points from LineString coordinates"""
        points = []
        
        # Find all LineString elements
        for linestring in root.findall(f'.//{{{self.namespaces[namespace]}}}LineString'):
            coordinates_elem = linestring.find(f'{{{self.namespaces[namespace]}}}coordinates')
            if coordinates_elem is not None:
                coords_text = coordinates_elem.text.strip()
                line_points = self._parse_coordinates(coords_text)
                points.extend(line_points)
        
        return points
    
    def _extract_placemarks(self, root, namespace: str) -> List[RoutePoint]:
        """Extract waypoints from Placemark elements with Point geometry"""
        waypoints = []
        
        for placemark in root.findall(f'.//{{{self.namespaces[namespace]}}}Placemark'):
            # Skip placemarks that contain LineString (these are routes, not waypoints)
            if placemark.find(f'.//{{{self.namespaces[namespace]}}}LineString') is not None:
                continue
            
            # Look for Point geometry
            point_elem = placemark.find(f'.//{{{self.namespaces[namespace]}}}Point')
            if point_elem is not None:
                coordinates_elem = point_elem.find(f'{{{self.namespaces[namespace]}}}coordinates')
                if coordinates_elem is not None:
                    coords_text = coordinates_elem.text.strip()
                    coords = self._parse_single_coordinate(coords_text)
                    if coords:
                        # Get placemark name and description
                        name_elem = placemark.find(f'{{{self.namespaces[namespace]}}}name')
                        desc_elem = placemark.find(f'{{{self.namespaces[namespace]}}}description')
                        
                        waypoint = RoutePoint(
                            latitude=coords[1],
                            longitude=coords[0],
                            elevation=coords[2] if len(coords) > 2 else None,
                            name=name_elem.text if name_elem is not None else None,
                            description=desc_elem.text if desc_elem is not None else None
                        )
                        waypoints.append(waypoint)
        
        return waypoints
    
    def _parse_coordinates(self, coords_text: str) -> List[RoutePoint]:
        """Parse coordinate string into RoutePoint objects"""
        points = []
        
        # Clean up the coordinate text
        coords_text = re.sub(r'\s+', ' ', coords_text.strip())
        
        # Split by whitespace or newlines
        coord_pairs = coords_text.split()
        
        for coord_pair in coord_pairs:
            coord_pair = coord_pair.strip()
            if not coord_pair:
                continue
            
            coords = self._parse_single_coordinate(coord_pair)
            if coords:
                point = RoutePoint(
                    latitude=coords[1],
                    longitude=coords[0],
                    elevation=coords[2] if len(coords) > 2 else None
                )
                points.append(point)
        
        return points
    
    def _parse_single_coordinate(self, coord_str: str) -> Optional[List[float]]:
        """Parse single coordinate string (lon,lat,alt)"""
        try:
            parts = coord_str.split(',')
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])
                alt = float(parts[2]) if len(parts) > 2 else None
                
                result = [lon, lat]
                if alt is not None:
                    result.append(alt)
                return result
        except (ValueError, IndexError):
            pass
        
        return None
    
    def _calculate_distance(self, points: List[RoutePoint]) -> float:
        """Calculate total distance of route in meters"""
        if len(points) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(1, len(points)):
            distance = self._haversine_distance(
                points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude
            )
            total_distance += distance
        
        return total_distance
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()


class KMZParser:
    """Parser for KMZ (compressed KML) files"""
    
    def __init__(self):
        self.kml_parser = KMLParser()
    
    def parse(self, file_path: str) -> ParsedRoute:
        """Parse KMZ file and extract route data"""
        try:
            # Extract KML content from KMZ archive
            kml_content = self._extract_kml_from_kmz(file_path)
            
            # Create temporary KML file
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as temp_file:
                temp_file.write(kml_content)
                temp_kml_path = temp_file.name
            
            try:
                # Parse the extracted KML
                parsed_route = self.kml_parser.parse(temp_kml_path)
                
                # Update format and recalculate hash for original KMZ file
                parsed_route.original_format = 'kmz'
                parsed_route.file_hash = self._calculate_file_hash(file_path)
                
                return parsed_route
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_kml_path)
                except:
                    pass
                    
        except RouteParserError:
            # Re-raise RouteParserError exceptions (including KMZ_NO_KML_FOUND)
            raise
        except zipfile.BadZipFile:
            raise RouteParserError(
                "KMZ dosyası bozuk veya geçersiz ZIP arşivi",
                "KMZ_INVALID_ARCHIVE",
                {"file_path": file_path}
            )
        except Exception as e:
            raise RouteParserError(
                f"KMZ dosyası işlenirken hata: {str(e)}",
                "KMZ_PROCESSING_ERROR",
                {"file_path": file_path, "error": str(e)}
            )
    
    def _extract_kml_from_kmz(self, kmz_path: str) -> str:
        """Extract KML content from KMZ archive"""
        with zipfile.ZipFile(kmz_path, 'r') as kmz_file:
            # Look for KML files in the archive
            kml_files = [f for f in kmz_file.namelist() if f.lower().endswith('.kml')]
            
            if not kml_files:
                raise RouteParserError(
                    "KMZ arşivinde KML dosyası bulunamadı",
                    "KMZ_NO_KML_FOUND",
                    {"file_path": kmz_path, "archive_contents": kmz_file.namelist()}
                )
            
            # Use the first KML file found (usually doc.kml)
            main_kml = kml_files[0]
            
            # Extract and decode KML content
            with kmz_file.open(main_kml) as kml_file:
                kml_content = kml_file.read().decode('utf-8')
            
            return kml_content
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()


class RouteFileParser:
    """Main route file parser that supports multiple formats"""
    
    def __init__(self):
        self.supported_formats = ["gpx", "kml", "kmz"]
        self.parsers = {
            'gpx': GPXParser(),
            'kml': KMLParser(),
            'kmz': KMZParser()
        }
        
        # Error codes mapping
        self.error_codes = {
            'UNSUPPORTED_FORMAT': 'Desteklenmeyen dosya formatı',
            'FILE_NOT_FOUND': 'Dosya bulunamadı',
            'FILE_TOO_LARGE': 'Dosya çok büyük',
            'CORRUPTED_FILE': 'Bozuk dosya',
            'INVALID_COORDINATES': 'Geçersiz koordinat bilgisi',
            'MISSING_ROUTE_DATA': 'Rota verisi bulunamadı',
            'PARSING_FAILED': 'Dosya parse edilemedi'
        }
    
    def parse_file(self, file_path: str, file_type: Optional[str] = None) -> ParsedRoute:
        """
        Parse route file and extract route data
        
        Args:
            file_path: Path to the route file
            file_type: Optional file type override (gpx, kml, kmz)
            
        Returns:
            ParsedRoute object with extracted data
            
        Raises:
            RouteParserError: If parsing fails
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise RouteParserError(
                f"Dosya bulunamadı: {file_path}",
                "FILE_NOT_FOUND",
                {"file_path": file_path}
            )
        
        # Check file size (max 50MB)
        file_size = os.path.getsize(file_path)
        max_size = 50 * 1024 * 1024  # 50MB
        if file_size > max_size:
            raise RouteParserError(
                f"Dosya çok büyük: {file_size / (1024*1024):.1f}MB (maksimum: 50MB)",
                "FILE_TOO_LARGE",
                {"file_path": file_path, "file_size": file_size, "max_size": max_size}
            )
        
        # Determine file type
        if file_type is None:
            file_type = self._detect_file_type(file_path)
        
        file_type = file_type.lower()
        
        # Validate file type
        if file_type not in self.supported_formats:
            raise RouteParserError(
                f"Desteklenmeyen dosya formatı: {file_type}",
                "UNSUPPORTED_FORMAT",
                {"file_path": file_path, "file_type": file_type, "supported_formats": self.supported_formats}
            )
        
        # Parse file using appropriate parser
        parser = self.parsers[file_type]
        parsed_route = parser.parse(file_path)
        
        # Validate parsed data
        self._validate_route_data(parsed_route)
        
        return parsed_route
    
    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type from extension"""
        _, ext = os.path.splitext(file_path.lower())
        ext = ext.lstrip('.')
        
        if ext in self.supported_formats:
            return ext
        
        # Try to detect from file content for files without proper extension
        try:
            with open(file_path, 'rb') as f:
                header = f.read(1024).decode('utf-8', errors='ignore')
                
                if '<gpx' in header.lower():
                    return 'gpx'
                elif '<kml' in header.lower():
                    return 'kml'
                elif header.startswith('PK'):  # ZIP file signature
                    return 'kmz'
        except:
            pass
        
        raise RouteParserError(
            f"Dosya türü tespit edilemedi: {file_path}",
            "UNSUPPORTED_FORMAT",
            {"file_path": file_path}
        )
    
    def _validate_route_data(self, parsed_route: ParsedRoute):
        """Validate parsed route data"""
        if not parsed_route.points and not parsed_route.waypoints:
            raise RouteParserError(
                "Dosyada rota verisi bulunamadı",
                "MISSING_ROUTE_DATA",
                {"points_count": len(parsed_route.points), "waypoints_count": len(parsed_route.waypoints)}
            )
        
        # Validate coordinates
        for point in parsed_route.points + parsed_route.waypoints:
            if not self._is_valid_coordinate(point.latitude, point.longitude):
                raise RouteParserError(
                    f"Geçersiz koordinat: {point.latitude}, {point.longitude}",
                    "INVALID_COORDINATES",
                    {"latitude": point.latitude, "longitude": point.longitude}
                )
    
    def _is_valid_coordinate(self, lat: float, lon: float) -> bool:
        """Validate coordinate values"""
        return (-90 <= lat <= 90) and (-180 <= lon <= 180)
    
    def extract_metadata(self, parsed_route: ParsedRoute) -> Dict[str, Any]:
        """Extract metadata in a standardized format"""
        metadata = parsed_route.metadata
        
        return {
            'name': metadata.name,
            'description': metadata.description,
            'distance': metadata.distance,
            'elevation_gain': metadata.elevation_gain,
            'elevation_loss': metadata.elevation_loss,
            'duration': metadata.duration,
            'route_type': metadata.route_type,
            'creator': metadata.creator,
            'created_at': metadata.created_at.isoformat() if metadata.created_at else None,
            'points_count': len(parsed_route.points),
            'waypoints_count': len(parsed_route.waypoints),
            'file_hash': parsed_route.file_hash,
            'original_format': parsed_route.original_format
        }
    
    def suggest_pois(self, route_coordinates: List[Tuple[float, float]], poi_data: List[Dict], max_distance: float = 1000) -> List[Dict]:
        """
        Suggest POIs near the route
        
        Args:
            route_coordinates: List of (lat, lon) tuples representing the route
            poi_data: List of POI dictionaries with 'latitude', 'longitude', 'name', etc.
            max_distance: Maximum distance in meters to consider POIs
            
        Returns:
            List of POI suggestions with distance and compatibility scores
        """
        suggestions = []
        
        for poi in poi_data:
            try:
                poi_lat = float(poi.get('latitude', 0))
                poi_lon = float(poi.get('longitude', 0))
                
                # Find minimum distance to route
                min_distance = float('inf')
                closest_point_index = -1
                
                for i, (route_lat, route_lon) in enumerate(route_coordinates):
                    distance = self._haversine_distance(poi_lat, poi_lon, route_lat, route_lon)
                    if distance < min_distance:
                        min_distance = distance
                        closest_point_index = i
                
                # Only include POIs within max_distance
                if min_distance <= max_distance:
                    # Calculate compatibility score (closer = higher score)
                    compatibility_score = max(0, 100 - (min_distance / max_distance * 100))
                    
                    suggestion = {
                        'poi_id': poi.get('id'),
                        'name': poi.get('name'),
                        'category': poi.get('category'),
                        'distance_from_route': round(min_distance, 2),
                        'compatibility_score': round(compatibility_score, 2),
                        'closest_route_point_index': closest_point_index,
                        'latitude': poi_lat,
                        'longitude': poi_lon
                    }
                    suggestions.append(suggestion)
                    
            except (ValueError, TypeError):
                continue
        
        # Sort by compatibility score (highest first)
        suggestions.sort(key=lambda x: x['compatibility_score'], reverse=True)
        
        return suggestions
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def validate_route_data(self, route_data: Dict) -> Dict[str, Any]:
        """
        Validate route data structure
        
        Args:
            route_data: Dictionary containing route data
            
        Returns:
            Validation results with errors and warnings
        """
        errors = []
        warnings = []
        
        # Check required fields
        required_fields = ['points', 'metadata']
        for field in required_fields:
            if field not in route_data:
                errors.append(f"Gerekli alan eksik: {field}")
        
        # Validate points
        if 'points' in route_data:
            points = route_data['points']
            if not isinstance(points, list):
                errors.append("Points alanı liste olmalı")
            elif len(points) < 2:
                warnings.append("Rota çok az nokta içeriyor (minimum 2 nokta önerilir)")
            else:
                # Validate individual points
                for i, point in enumerate(points):
                    if not isinstance(point, dict):
                        errors.append(f"Point {i} geçersiz format")
                        continue
                    
                    if 'latitude' not in point or 'longitude' not in point:
                        errors.append(f"Point {i} koordinat bilgisi eksik")
                        continue
                    
                    try:
                        lat = float(point['latitude'])
                        lon = float(point['longitude'])
                        if not self._is_valid_coordinate(lat, lon):
                            errors.append(f"Point {i} geçersiz koordinat: {lat}, {lon}")
                    except (ValueError, TypeError):
                        errors.append(f"Point {i} koordinat değerleri sayısal olmalı")
        
        # Validate metadata
        if 'metadata' in route_data:
            metadata = route_data['metadata']
            if not isinstance(metadata, dict):
                errors.append("Metadata alanı dictionary olmalı")
            else:
                if not metadata.get('name'):
                    warnings.append("Rota adı belirtilmemiş")
                if not metadata.get('description'):
                    warnings.append("Rota açıklaması belirtilmemiş")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'error_count': len(errors),
            'warning_count': len(warnings)
        }


# Utility functions for testing and debugging
def create_sample_route_data() -> Dict:
    """Create sample route data for testing"""
    return {
        'points': [
            {'latitude': 38.6431, 'longitude': 34.8213, 'elevation': 1200},
            {'latitude': 38.6441, 'longitude': 34.8223, 'elevation': 1210},
            {'latitude': 38.6451, 'longitude': 34.8233, 'elevation': 1220}
        ],
        'metadata': {
            'name': 'Test Route',
            'description': 'A test route for validation',
            'distance': 1500.0,
            'route_type': 'hiking'
        },
        'waypoints': [
            {'latitude': 38.6436, 'longitude': 34.8218, 'name': 'Checkpoint 1'}
        ]
    }


if __name__ == "__main__":
    # Test the parser
    parser = RouteFileParser()
    print("✅ RouteFileParser hazır")
    print(f"📁 Desteklenen formatlar: {parser.supported_formats}")
    
    # Test validation
    sample_data = create_sample_route_data()
    validation_result = parser.validate_route_data(sample_data)
    print(f"🔍 Örnek veri validasyonu: {'✅ Geçerli' if validation_result['is_valid'] else '❌ Geçersiz'}")
    
    if validation_result['warnings']:
        print(f"⚠️  Uyarılar: {validation_result['warnings']}")