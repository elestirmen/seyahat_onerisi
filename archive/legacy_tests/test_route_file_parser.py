#!/usr/bin/env python3
"""
Unit tests for Route File Parser Service
Tests GPX, KML, and KMZ parsing functionality
"""

import unittest
import tempfile
import os
import zipfile
from datetime import datetime
from route_file_parser import (
    RouteFileParser, GPXParser, KMLParser, KMZParser,
    RouteParserError, RoutePoint, RouteMetadata, ParsedRoute
)


class TestGPXParser(unittest.TestCase):
    """Test GPX parser functionality"""
    
    def setUp(self):
        self.parser = GPXParser()
    
    def test_parse_simple_gpx(self):
        """Test parsing a simple GPX file"""
        gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
        <name>Test Route</name>
        <desc>A test route for unit testing</desc>
        <time>2024-01-01T12:00:00Z</time>
    </metadata>
    <trk>
        <name>Test Track</name>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213">
                <ele>1200</ele>
                <time>2024-01-01T12:00:00Z</time>
            </trkpt>
            <trkpt lat="38.6441" lon="34.8223">
                <ele>1210</ele>
                <time>2024-01-01T12:01:00Z</time>
            </trkpt>
            <trkpt lat="38.6451" lon="34.8233">
                <ele>1220</ele>
                <time>2024-01-01T12:02:00Z</time>
            </trkpt>
        </trkseg>
    </trk>
    <wpt lat="38.6436" lon="34.8218">
        <name>Checkpoint 1</name>
        <desc>First checkpoint</desc>
        <ele>1205</ele>
    </wpt>
</gpx>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(gpx_content)
            temp_path = f.name
        
        try:
            result = self.parser.parse(temp_path)
            
            # Test metadata
            self.assertEqual(result.metadata.name, "Test Route")
            self.assertEqual(result.metadata.description, "A test route for unit testing")
            self.assertIsNotNone(result.metadata.created_at)
            
            # Test points
            self.assertEqual(len(result.points), 3)
            self.assertAlmostEqual(result.points[0].latitude, 38.6431, places=4)
            self.assertAlmostEqual(result.points[0].longitude, 34.8213, places=4)
            self.assertEqual(result.points[0].elevation, 1200)
            
            # Test waypoints
            self.assertEqual(len(result.waypoints), 1)
            self.assertEqual(result.waypoints[0].name, "Checkpoint 1")
            self.assertEqual(result.waypoints[0].description, "First checkpoint")
            
            # Test calculated distance
            self.assertIsNotNone(result.metadata.distance)
            self.assertGreater(result.metadata.distance, 0)
            
            # Test file hash
            self.assertIsNotNone(result.file_hash)
            self.assertEqual(len(result.file_hash), 64)  # SHA-256 hash length
            
            # Test format
            self.assertEqual(result.original_format, 'gpx')
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_gpx_without_elevation(self):
        """Test parsing GPX file without elevation data"""
        gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213"/>
            <trkpt lat="38.6441" lon="34.8223"/>
        </trkseg>
    </trk>
</gpx>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(gpx_content)
            temp_path = f.name
        
        try:
            result = self.parser.parse(temp_path)
            
            self.assertEqual(len(result.points), 2)
            self.assertIsNone(result.points[0].elevation)
            self.assertIsNone(result.points[1].elevation)
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_invalid_gpx(self):
        """Test parsing invalid GPX file"""
        invalid_content = "This is not valid XML"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(invalid_content)
            temp_path = f.name
        
        try:
            with self.assertRaises(RouteParserError) as context:
                self.parser.parse(temp_path)
            
            self.assertEqual(context.exception.error_code, "GPX_PARSE_ERROR")
            
        finally:
            os.unlink(temp_path)


class TestKMLParser(unittest.TestCase):
    """Test KML parser functionality"""
    
    def setUp(self):
        self.parser = KMLParser()
    
    def test_parse_simple_kml(self):
        """Test parsing a simple KML file"""
        kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Test Route</name>
        <description>A test route for unit testing</description>
        <Placemark>
            <name>Route Line</name>
            <LineString>
                <coordinates>
                    34.8213,38.6431,1200
                    34.8223,38.6441,1210
                    34.8233,38.6451,1220
                </coordinates>
            </LineString>
        </Placemark>
        <Placemark>
            <name>Checkpoint 1</name>
            <description>First checkpoint</description>
            <Point>
                <coordinates>34.8218,38.6436,1205</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as f:
            f.write(kml_content)
            temp_path = f.name
        
        try:
            result = self.parser.parse(temp_path)
            
            # Test metadata
            self.assertEqual(result.metadata.name, "Test Route")
            self.assertEqual(result.metadata.description, "A test route for unit testing")
            
            # Test points
            self.assertEqual(len(result.points), 3)
            self.assertAlmostEqual(result.points[0].latitude, 38.6431, places=4)
            self.assertAlmostEqual(result.points[0].longitude, 34.8213, places=4)
            self.assertEqual(result.points[0].elevation, 1200)
            
            # Test waypoints
            self.assertEqual(len(result.waypoints), 1)
            self.assertEqual(result.waypoints[0].name, "Checkpoint 1")
            self.assertEqual(result.waypoints[0].description, "First checkpoint")
            
            # Test format
            self.assertEqual(result.original_format, 'kml')
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_kml_without_elevation(self):
        """Test parsing KML file without elevation data"""
        kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <Placemark>
            <LineString>
                <coordinates>
                    34.8213,38.6431
                    34.8223,38.6441
                </coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as f:
            f.write(kml_content)
            temp_path = f.name
        
        try:
            result = self.parser.parse(temp_path)
            
            self.assertEqual(len(result.points), 2)
            self.assertIsNone(result.points[0].elevation)
            self.assertIsNone(result.points[1].elevation)
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_kml_with_extended_data(self):
        """Test parsing KML file with extended data"""
        kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Test Route</name>
        <ExtendedData>
            <Data name="distance">
                <value>1500.5</value>
            </Data>
            <Data name="creator">
                <value>Test Creator</value>
            </Data>
            <Data name="type">
                <value>hiking</value>
            </Data>
        </ExtendedData>
        <Placemark>
            <LineString>
                <coordinates>34.8213,38.6431 34.8223,38.6441</coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as f:
            f.write(kml_content)
            temp_path = f.name
        
        try:
            result = self.parser.parse(temp_path)
            
            self.assertEqual(result.metadata.distance, 1500.5)
            self.assertEqual(result.metadata.creator, "Test Creator")
            self.assertEqual(result.metadata.route_type, "hiking")
            
        finally:
            os.unlink(temp_path)


class TestKMZParser(unittest.TestCase):
    """Test KMZ parser functionality"""
    
    def setUp(self):
        self.parser = KMZParser()
    
    def test_parse_simple_kmz(self):
        """Test parsing a simple KMZ file"""
        kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Test KMZ Route</name>
        <description>A test route from KMZ file</description>
        <Placemark>
            <LineString>
                <coordinates>
                    34.8213,38.6431,1200
                    34.8223,38.6441,1210
                </coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>'''
        
        # Create temporary KMZ file
        with tempfile.NamedTemporaryFile(suffix='.kmz', delete=False) as kmz_file:
            kmz_path = kmz_file.name
            
            with zipfile.ZipFile(kmz_file, 'w') as zf:
                zf.writestr('doc.kml', kml_content)
        
        try:
            result = self.parser.parse(kmz_path)
            
            # Test metadata
            self.assertEqual(result.metadata.name, "Test KMZ Route")
            self.assertEqual(result.metadata.description, "A test route from KMZ file")
            
            # Test points
            self.assertEqual(len(result.points), 2)
            self.assertAlmostEqual(result.points[0].latitude, 38.6431, places=4)
            self.assertAlmostEqual(result.points[0].longitude, 34.8213, places=4)
            
            # Test format
            self.assertEqual(result.original_format, 'kmz')
            
        finally:
            os.unlink(kmz_path)
    
    def test_parse_kmz_without_kml(self):
        """Test parsing KMZ file without KML content"""
        # Create KMZ file with no KML
        with tempfile.NamedTemporaryFile(suffix='.kmz', delete=False) as kmz_file:
            kmz_path = kmz_file.name
            
            with zipfile.ZipFile(kmz_file, 'w') as zf:
                zf.writestr('readme.txt', 'This is not a KML file')
        
        try:
            with self.assertRaises(RouteParserError) as context:
                self.parser.parse(kmz_path)
            
            self.assertEqual(context.exception.error_code, "KMZ_NO_KML_FOUND")
            
        finally:
            os.unlink(kmz_path)
    
    def test_parse_invalid_kmz(self):
        """Test parsing invalid KMZ file"""
        # Create invalid ZIP file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.kmz', delete=False) as f:
            f.write("This is not a valid ZIP file")
            temp_path = f.name
        
        try:
            with self.assertRaises(RouteParserError) as context:
                self.parser.parse(temp_path)
            
            self.assertEqual(context.exception.error_code, "KMZ_INVALID_ARCHIVE")
            
        finally:
            os.unlink(temp_path)


class TestRouteFileParser(unittest.TestCase):
    """Test main RouteFileParser functionality"""
    
    def setUp(self):
        self.parser = RouteFileParser()
    
    def test_supported_formats(self):
        """Test supported formats"""
        expected_formats = ["gpx", "kml", "kmz"]
        self.assertEqual(self.parser.supported_formats, expected_formats)
    
    def test_detect_file_type_from_extension(self):
        """Test file type detection from extension"""
        self.assertEqual(self.parser._detect_file_type("test.gpx"), "gpx")
        self.assertEqual(self.parser._detect_file_type("test.kml"), "kml")
        self.assertEqual(self.parser._detect_file_type("test.kmz"), "kmz")
        self.assertEqual(self.parser._detect_file_type("TEST.GPX"), "gpx")
    
    def test_detect_file_type_from_content(self):
        """Test file type detection from content"""
        # Test GPX content detection
        gpx_content = '''<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
</gpx>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(gpx_content)
            temp_path = f.name
        
        try:
            detected_type = self.parser._detect_file_type(temp_path)
            self.assertEqual(detected_type, "gpx")
        finally:
            os.unlink(temp_path)
    
    def test_file_not_found_error(self):
        """Test error handling for non-existent file"""
        with self.assertRaises(RouteParserError) as context:
            self.parser.parse_file("non_existent_file.gpx")
        
        self.assertEqual(context.exception.error_code, "FILE_NOT_FOUND")
    
    def test_file_too_large_error(self):
        """Test error handling for files that are too large"""
        # Create a large file (simulate by mocking os.path.getsize)
        import unittest.mock
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write("<gpx></gpx>")
            temp_path = f.name
        
        try:
            with unittest.mock.patch('os.path.getsize', return_value=60*1024*1024):  # 60MB
                with self.assertRaises(RouteParserError) as context:
                    self.parser.parse_file(temp_path)
                
                self.assertEqual(context.exception.error_code, "FILE_TOO_LARGE")
        finally:
            os.unlink(temp_path)
    
    def test_unsupported_format_error(self):
        """Test error handling for unsupported file format"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is just text")
            temp_path = f.name
        
        try:
            with self.assertRaises(RouteParserError) as context:
                self.parser.parse_file(temp_path)
            
            self.assertEqual(context.exception.error_code, "UNSUPPORTED_FORMAT")
        finally:
            os.unlink(temp_path)
    
    def test_validate_route_data_valid(self):
        """Test route data validation with valid data"""
        valid_data = {
            'points': [
                {'latitude': 38.6431, 'longitude': 34.8213},
                {'latitude': 38.6441, 'longitude': 34.8223}
            ],
            'metadata': {
                'name': 'Test Route',
                'description': 'Test description'
            }
        }
        
        result = self.parser.validate_route_data(valid_data)
        self.assertTrue(result['is_valid'])
        self.assertEqual(result['error_count'], 0)
    
    def test_validate_route_data_invalid(self):
        """Test route data validation with invalid data"""
        invalid_data = {
            'points': [
                {'latitude': 91, 'longitude': 181}  # Invalid coordinates
            ]
        }
        
        result = self.parser.validate_route_data(invalid_data)
        self.assertFalse(result['is_valid'])
        self.assertGreater(result['error_count'], 0)
    
    def test_suggest_pois(self):
        """Test POI suggestion functionality"""
        route_coordinates = [
            (38.6431, 34.8213),
            (38.6441, 34.8223),
            (38.6451, 34.8233)
        ]
        
        poi_data = [
            {
                'id': 1,
                'name': 'Close POI',
                'category': 'restaurant',
                'latitude': 38.6435,
                'longitude': 34.8215
            },
            {
                'id': 2,
                'name': 'Far POI',
                'category': 'hotel',
                'latitude': 38.7000,
                'longitude': 34.9000
            }
        ]
        
        suggestions = self.parser.suggest_pois(route_coordinates, poi_data, max_distance=1000)
        
        # Should only include the close POI
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]['poi_id'], 1)
        self.assertEqual(suggestions[0]['name'], 'Close POI')
        self.assertLess(suggestions[0]['distance_from_route'], 1000)
        self.assertGreater(suggestions[0]['compatibility_score'], 0)
    
    def test_extract_metadata(self):
        """Test metadata extraction"""
        # Create a simple parsed route
        metadata = RouteMetadata(
            name="Test Route",
            description="Test description",
            distance=1500.0,
            route_type="hiking"
        )
        
        parsed_route = ParsedRoute(
            points=[RoutePoint(38.6431, 34.8213)],
            metadata=metadata,
            waypoints=[],
            file_hash="test_hash",
            original_format="gpx"
        )
        
        extracted = self.parser.extract_metadata(parsed_route)
        
        self.assertEqual(extracted['name'], "Test Route")
        self.assertEqual(extracted['description'], "Test description")
        self.assertEqual(extracted['distance'], 1500.0)
        self.assertEqual(extracted['route_type'], "hiking")
        self.assertEqual(extracted['points_count'], 1)
        self.assertEqual(extracted['waypoints_count'], 0)
        self.assertEqual(extracted['file_hash'], "test_hash")
        self.assertEqual(extracted['original_format'], "gpx")


class TestUtilityFunctions(unittest.TestCase):
    """Test utility functions"""
    
    def test_haversine_distance(self):
        """Test Haversine distance calculation"""
        parser = RouteFileParser()
        
        # Test distance between two known points
        # Ürgüp to Göreme (approximately 6km)
        distance = parser._haversine_distance(38.6431, 34.8213, 38.6431, 34.8313)
        
        # Should be approximately 1km (1 degree longitude ≈ 1km at this latitude)
        self.assertGreater(distance, 500)  # At least 500m
        self.assertLess(distance, 2000)    # Less than 2km
    
    def test_coordinate_validation(self):
        """Test coordinate validation"""
        parser = RouteFileParser()
        
        # Valid coordinates
        self.assertTrue(parser._is_valid_coordinate(38.6431, 34.8213))
        self.assertTrue(parser._is_valid_coordinate(-90, -180))
        self.assertTrue(parser._is_valid_coordinate(90, 180))
        
        # Invalid coordinates
        self.assertFalse(parser._is_valid_coordinate(91, 34.8213))
        self.assertFalse(parser._is_valid_coordinate(38.6431, 181))
        self.assertFalse(parser._is_valid_coordinate(-91, 34.8213))
        self.assertFalse(parser._is_valid_coordinate(38.6431, -181))


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)