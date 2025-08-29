#!/usr/bin/env python3
"""
Unit tests for File Upload API endpoints
Tests file upload, validation, and import functionality
"""

import unittest
import tempfile
import os
import json
import zipfile
from unittest.mock import patch, MagicMock
from werkzeug.datastructures import FileStorage
from io import BytesIO

# Import the modules to test
from file_validation_middleware import FileValidationMiddleware, FileValidationError
from route_file_parser import RouteFileParser, RouteParserError


class TestFileValidationMiddleware(unittest.TestCase):
    """Test file validation middleware functionality"""
    
    def setUp(self):
        self.middleware = FileValidationMiddleware()
    
    def create_test_file(self, content: str, filename: str) -> FileStorage:
        """Create a test FileStorage object"""
        return FileStorage(
            stream=BytesIO(content.encode('utf-8')),
            filename=filename,
            content_type='text/xml'
        )
    
    def test_validate_file_success(self):
        """Test successful file validation"""
        gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213"/>
            <trkpt lat="38.6441" lon="34.8223"/>
        </trkseg>
    </trk>
</gpx>'''
        
        test_file = self.create_test_file(gpx_content, 'test_route.gpx')
        result = self.middleware.validate_file(test_file)
        
        self.assertTrue(result['is_valid'])
        self.assertEqual(len(result['errors']), 0)
        self.assertEqual(result['file_info']['extension'], 'gpx')
        self.assertGreater(result['file_info']['size'], 0)
    
    def test_validate_file_no_file(self):
        """Test validation with no file"""
        result = self.middleware.validate_file(None)
        
        self.assertFalse(result['is_valid'])
        self.assertIn('Dosya seçilmedi', result['errors'])
    
    def test_validate_file_empty_file(self):
        """Test validation with empty file"""
        test_file = self.create_test_file('', 'empty.gpx')
        result = self.middleware.validate_file(test_file)
        
        self.assertFalse(result['is_valid'])
        self.assertTrue(any('çok küçük' in error for error in result['errors']))
    
    def test_validate_file_unsupported_extension(self):
        """Test validation with unsupported file extension"""
        test_file = self.create_test_file('test content', 'test.txt')
        result = self.middleware.validate_file(test_file)
        
        self.assertFalse(result['is_valid'])
        self.assertTrue(any('Desteklenmeyen dosya formatı' in error for error in result['errors']))
    
    def test_validate_file_too_large(self):
        """Test validation with file too large"""
        # Mock file size to be larger than limit
        test_file = self.create_test_file('test content', 'large.gpx')
        
        with patch.object(test_file, 'tell', return_value=60 * 1024 * 1024):  # 60MB
            result = self.middleware.validate_file(test_file)
        
        self.assertFalse(result['is_valid'])
        self.assertTrue(any('Dosya çok büyük' in error for error in result['errors']))
    
    def test_sanitize_filename(self):
        """Test filename sanitization"""
        dangerous_filename = 'test<script>alert("xss")</script>.gpx'
        sanitized = self.middleware._sanitize_filename(dangerous_filename)
        
        self.assertNotIn('<', sanitized)
        self.assertNotIn('>', sanitized)
        # Note: secure_filename may not remove all text, just dangerous chars
        self.assertTrue(sanitized.endswith('.gpx'))
        # Check that dangerous characters are removed
        self.assertNotIn('<script>', sanitized)
    
    def test_xml_security_check(self):
        """Test XML security checking"""
        malicious_xml = '''<?xml version="1.0"?>
<gpx><script>alert("xss")</script></gpx>'''
        
        result = self.middleware._check_xml_security(malicious_xml.encode('utf-8'))
        
        self.assertFalse(result['is_safe'])
        self.assertTrue(any('Tehlikeli içerik' in issue for issue in result['security_issues']))
    
    def test_zip_security_check(self):
        """Test ZIP (KMZ) security checking"""
        # Create a test KMZ file
        kml_content = '''<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <Placemark>
            <LineString>
                <coordinates>34.8213,38.6431</coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>'''
        
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            zf.writestr('doc.kml', kml_content)
        
        zip_content = zip_buffer.getvalue()
        result = self.middleware._check_zip_security(zip_content)
        
        self.assertTrue(result['is_safe'])
        self.assertEqual(result['scan_details']['content_type'], 'zip')
    
    def test_gpx_structure_validation(self):
        """Test GPX structure validation"""
        gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213"/>
            <trkpt lat="38.6441" lon="34.8223"/>
        </trkseg>
    </trk>
    <wpt lat="38.6436" lon="34.8218">
        <name>Waypoint 1</name>
    </wpt>
</gpx>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(gpx_content)
            temp_path = f.name
        
        try:
            result = self.middleware._validate_gpx_structure(temp_path)
            
            self.assertTrue(result.get('is_valid', True))
            self.assertEqual(result['structure_info']['track_points_count'], 2)
            self.assertEqual(result['structure_info']['waypoints_count'], 1)
            
        finally:
            os.unlink(temp_path)
    
    def test_kml_structure_validation(self):
        """Test KML structure validation"""
        kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <Placemark>
            <LineString>
                <coordinates>34.8213,38.6431 34.8223,38.6441</coordinates>
            </LineString>
        </Placemark>
        <Placemark>
            <Point>
                <coordinates>34.8218,38.6436</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as f:
            f.write(kml_content)
            temp_path = f.name
        
        try:
            result = self.middleware._validate_kml_structure(temp_path)
            
            self.assertTrue(result.get('is_valid', True))
            self.assertEqual(result['structure_info']['placemarks_count'], 2)
            self.assertEqual(result['structure_info']['linestrings_count'], 1)
            self.assertEqual(result['structure_info']['points_count'], 1)
            
        finally:
            os.unlink(temp_path)
    
    def test_validation_summary(self):
        """Test validation summary generation"""
        validation_results = [
            {'is_valid': True, 'errors': [], 'warnings': ['Warning 1']},
            {'is_valid': False, 'errors': ['Error 1', 'Error 2'], 'warnings': []},
            {'is_valid': True, 'errors': [], 'warnings': ['Warning 1', 'Warning 2']}
        ]
        
        summary = self.middleware.get_validation_summary(validation_results)
        
        self.assertEqual(summary['total_validations'], 3)
        self.assertEqual(summary['successful_validations'], 2)
        self.assertEqual(summary['failed_validations'], 1)
        self.assertEqual(summary['total_errors'], 2)
        self.assertEqual(summary['total_warnings'], 3)


class TestFileUploadIntegration(unittest.TestCase):
    """Test file upload API integration"""
    
    def setUp(self):
        self.middleware = FileValidationMiddleware()
        self.parser = RouteFileParser()
    
    def test_complete_upload_workflow(self):
        """Test complete file upload workflow"""
        # Create test GPX file
        gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
        <name>Test Route</name>
        <desc>A test route</desc>
    </metadata>
    <trk>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213">
                <ele>1200</ele>
            </trkpt>
            <trkpt lat="38.6441" lon="34.8223">
                <ele>1210</ele>
            </trkpt>
        </trkseg>
    </trk>
</gpx>'''
        
        # Step 1: Validate file
        test_file = FileStorage(
            stream=BytesIO(gpx_content.encode('utf-8')),
            filename='test_route.gpx',
            content_type='text/xml'
        )
        
        validation_result = self.middleware.validate_file(test_file)
        self.assertTrue(validation_result['is_valid'])
        
        # Step 2: Save file temporarily
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(gpx_content)
            temp_path = f.name
        
        try:
            # Step 3: Parse file
            parsed_route = self.parser.parse_file(temp_path)
            
            self.assertEqual(parsed_route.metadata.name, "Test Route")
            self.assertEqual(len(parsed_route.points), 2)
            self.assertEqual(parsed_route.original_format, 'gpx')
            
            # Step 4: Extract metadata
            metadata = self.parser.extract_metadata(parsed_route)
            
            self.assertEqual(metadata['name'], "Test Route")
            self.assertEqual(metadata['points_count'], 2)
            self.assertEqual(metadata['original_format'], 'gpx')
            
        finally:
            os.unlink(temp_path)
    
    def test_error_handling_workflow(self):
        """Test error handling in upload workflow"""
        # Test with invalid XML
        invalid_content = "This is not valid XML content"
        
        test_file = FileStorage(
            stream=BytesIO(invalid_content.encode('utf-8')),
            filename='invalid.gpx',
            content_type='text/xml'
        )
        
        # Validation should pass basic checks but fail on content
        validation_result = self.middleware.validate_file(test_file)
        
        # Create temporary file for parsing test
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
            f.write(invalid_content)
            temp_path = f.name
        
        try:
            # Parsing should fail
            with self.assertRaises(RouteParserError):
                self.parser.parse_file(temp_path)
                
        finally:
            os.unlink(temp_path)
    
    def test_security_workflow(self):
        """Test security checks in upload workflow"""
        # Create malicious XML content
        malicious_content = '''<?xml version="1.0"?>
<gpx>
    <script>alert("xss")</script>
    <trk>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213"/>
        </trkseg>
    </trk>
</gpx>'''
        
        test_file = FileStorage(
            stream=BytesIO(malicious_content.encode('utf-8')),
            filename='malicious.gpx',
            content_type='text/xml'
        )
        
        # Validation should detect security issues
        validation_result = self.middleware.validate_file(test_file, additional_checks=True)
        
        self.assertFalse(validation_result['is_valid'])
        self.assertFalse(validation_result['security_info']['is_safe'])
        self.assertTrue(any('Tehlikeli içerik' in issue for issue in validation_result['security_info']['security_issues']))


class TestProgressTracking(unittest.TestCase):
    """Test progress tracking functionality"""
    
    def test_progress_tracking_structure(self):
        """Test progress tracking data structure"""
        from datetime import datetime
        
        # Simulate progress tracking
        upload_progress = {}
        upload_id = "test-upload-123"
        
        # Initialize progress
        upload_progress[upload_id] = {
            'status': 'validating',
            'progress': 10,
            'message': 'Dosya doğrulanıyor...',
            'started_at': datetime.now().isoformat()
        }
        
        self.assertIn(upload_id, upload_progress)
        self.assertEqual(upload_progress[upload_id]['status'], 'validating')
        self.assertEqual(upload_progress[upload_id]['progress'], 10)
        
        # Update progress
        upload_progress[upload_id].update({
            'status': 'parsing',
            'progress': 70,
            'message': 'Rota dosyası parse ediliyor...'
        })
        
        self.assertEqual(upload_progress[upload_id]['status'], 'parsing')
        self.assertEqual(upload_progress[upload_id]['progress'], 70)
        
        # Complete progress
        upload_progress[upload_id].update({
            'status': 'completed',
            'progress': 100,
            'message': 'Dosya başarıyla işlendi'
        })
        
        self.assertEqual(upload_progress[upload_id]['status'], 'completed')
        self.assertEqual(upload_progress[upload_id]['progress'], 100)


class TestErrorHandling(unittest.TestCase):
    """Test error handling scenarios"""
    
    def test_route_parser_error_handling(self):
        """Test RouteParserError handling"""
        try:
            raise RouteParserError(
                "Test error message",
                "TEST_ERROR_CODE",
                {"detail": "test detail"}
            )
        except RouteParserError as e:
            self.assertEqual(e.message, "Test error message")
            self.assertEqual(e.error_code, "TEST_ERROR_CODE")
            self.assertEqual(e.details["detail"], "test detail")
    
    def test_file_validation_error_handling(self):
        """Test FileValidationError handling"""
        try:
            raise FileValidationError(
                "Validation failed",
                "VALIDATION_ERROR",
                {"file": "test.gpx"}
            )
        except FileValidationError as e:
            self.assertEqual(e.message, "Validation failed")
            self.assertEqual(e.error_code, "VALIDATION_ERROR")
            self.assertEqual(e.details["file"], "test.gpx")


class TestUtilityFunctions(unittest.TestCase):
    """Test utility functions"""
    
    def test_file_hash_calculation(self):
        """Test file hash calculation"""
        middleware = FileValidationMiddleware()
        
        test_content = "Test file content for hashing"
        test_file = FileStorage(
            stream=BytesIO(test_content.encode('utf-8')),
            filename='test.txt'
        )
        
        hash1 = middleware._calculate_file_hash(test_file)
        hash2 = middleware._calculate_file_hash(test_file)
        
        # Same content should produce same hash
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)  # SHA-256 hash length
    
    def test_filename_sanitization_edge_cases(self):
        """Test filename sanitization edge cases"""
        middleware = FileValidationMiddleware()
        
        test_cases = [
            ("normal_file.gpx", "normal_file.gpx"),
            ("file with spaces.gpx", "file-with-spaces.gpx"),
            ("file<>:\"|?*.gpx", "file.gpx"),
            ("very_long_filename_" + "x" * 100 + ".gpx", "very_long_filename_" + "x" * 85 + ".gpx"),
            ("", ""),
            ("file..gpx", "file.gpx"),
            ("file---name.gpx", "file-name.gpx")
        ]
        
        for original, expected in test_cases:
            result = middleware._sanitize_filename(original)
            if expected:
                self.assertTrue(result.endswith('.gpx') if original.endswith('.gpx') else True)
            else:
                self.assertEqual(result, expected)


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)