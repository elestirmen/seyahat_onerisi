#!/usr/bin/env python3
"""
File Validation Middleware for Route Import
Provides comprehensive file validation, security checks, and sanitization
"""

import os
import re
import hashlib
import mimetypes
from typing import Dict, List, Optional, Tuple
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
import json

# Optional import for python-magic
try:
    import magic
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False


class FileValidationError(Exception):
    """Custom exception for file validation errors"""
    def __init__(self, message: str, error_code: str, details: Optional[Dict] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class FileValidationMiddleware:
    """
    Comprehensive file validation middleware for route file uploads
    """
    
    # Configuration
    ALLOWED_EXTENSIONS = {'gpx', 'kml', 'kmz'}
    ALLOWED_MIME_TYPES = {
        'gpx': ['application/gpx+xml', 'text/xml', 'application/xml'],
        'kml': ['application/vnd.google-earth.kml+xml', 'text/xml', 'application/xml'],
        'kmz': ['application/vnd.google-earth.kmz', 'application/zip']
    }
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MIN_FILE_SIZE = 100  # 100 bytes
    
    # Security patterns to detect
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'vbscript:',
        r'onload\s*=',
        r'onerror\s*=',
        r'onclick\s*=',
        r'<iframe[^>]*>',
        r'<object[^>]*>',
        r'<embed[^>]*>',
        r'<form[^>]*>',
        r'<input[^>]*>',
        r'<meta[^>]*http-equiv',
    ]
    
    def __init__(self):
        """Initialize the validation middleware"""
        self.validation_cache = {}
        
        # Try to initialize python-magic for MIME type detection
        if HAS_MAGIC:
            try:
                self.mime_detector = magic.Magic(mime=True)
                self.has_magic = True
            except:
                self.has_magic = False
                print("Warning: python-magic initialization failed, using basic MIME detection")
        else:
            self.has_magic = False
    
    def validate_file(self, file: FileStorage, additional_checks: bool = True) -> Dict:
        """
        Comprehensive file validation
        
        Args:
            file: Uploaded file object
            additional_checks: Whether to perform additional security checks
            
        Returns:
            Dict: Validation results
        """
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'file_info': {},
            'security_info': {},
            'validation_timestamp': datetime.now().isoformat()
        }
        
        try:
            # Basic file existence check
            if not file or not file.filename:
                validation_result['is_valid'] = False
                validation_result['errors'].append('Dosya seçilmedi')
                return validation_result
            
            # Extract file information
            file_info = self._extract_file_info(file)
            validation_result['file_info'] = file_info
            
            # Validate file size
            size_validation = self._validate_file_size(file_info['size'])
            if not size_validation['is_valid']:
                validation_result['is_valid'] = False
                validation_result['errors'].extend(size_validation['errors'])
            
            # Validate file extension
            ext_validation = self._validate_file_extension(file_info['extension'])
            if not ext_validation['is_valid']:
                validation_result['is_valid'] = False
                validation_result['errors'].extend(ext_validation['errors'])
            
            # Validate filename
            filename_validation = self._validate_filename(file_info['original_filename'])
            validation_result['warnings'].extend(filename_validation['warnings'])
            if filename_validation['sanitized_filename'] != file_info['original_filename']:
                validation_result['file_info']['sanitized_filename'] = filename_validation['sanitized_filename']
            
            # MIME type validation
            if self.has_magic:
                mime_validation = self._validate_mime_type(file, file_info['extension'])
                if not mime_validation['is_valid']:
                    validation_result['warnings'].extend(mime_validation['warnings'])
                validation_result['file_info']['detected_mime_type'] = mime_validation['detected_mime_type']
            
            # Additional security checks
            if additional_checks and validation_result['is_valid']:
                security_validation = self._perform_security_checks(file, file_info)
                validation_result['security_info'] = security_validation
                
                if not security_validation['is_safe']:
                    validation_result['is_valid'] = False
                    validation_result['errors'].extend(security_validation['security_issues'])
            
            return validation_result
            
        except Exception as e:
            validation_result['is_valid'] = False
            validation_result['errors'].append(f'Validation hatası: {str(e)}')
            return validation_result
    
    def _extract_file_info(self, file: FileStorage) -> Dict:
        """Extract basic file information"""
        # Get file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        # Extract extension
        filename = file.filename
        extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        # Calculate file hash
        file_hash = self._calculate_file_hash(file)
        
        return {
            'original_filename': filename,
            'extension': extension,
            'size': file_size,
            'size_mb': round(file_size / (1024 * 1024), 2),
            'file_hash': file_hash
        }
    
    def _calculate_file_hash(self, file: FileStorage) -> str:
        """Calculate SHA-256 hash of file content"""
        hash_sha256 = hashlib.sha256()
        
        # Save current position
        current_pos = file.tell()
        file.seek(0)
        
        # Calculate hash
        while True:
            chunk = file.read(4096)
            if not chunk:
                break
            hash_sha256.update(chunk)
        
        # Restore position
        file.seek(current_pos)
        
        return hash_sha256.hexdigest()
    
    def _validate_file_size(self, file_size: int) -> Dict:
        """Validate file size constraints"""
        result = {'is_valid': True, 'errors': []}
        
        if file_size < self.MIN_FILE_SIZE:
            result['is_valid'] = False
            result['errors'].append(f'Dosya çok küçük: {file_size} bytes (minimum: {self.MIN_FILE_SIZE} bytes)')
        
        if file_size > self.MAX_FILE_SIZE:
            result['is_valid'] = False
            result['errors'].append(
                f'Dosya çok büyük: {round(file_size / (1024*1024), 2)}MB '
                f'(maksimum: {round(self.MAX_FILE_SIZE / (1024*1024), 2)}MB)'
            )
        
        return result
    
    def _validate_file_extension(self, extension: str) -> Dict:
        """Validate file extension"""
        result = {'is_valid': True, 'errors': []}
        
        if not extension:
            result['is_valid'] = False
            result['errors'].append('Dosya uzantısı bulunamadı')
        elif extension not in self.ALLOWED_EXTENSIONS:
            result['is_valid'] = False
            result['errors'].append(
                f'Desteklenmeyen dosya formatı: .{extension}. '
                f'Desteklenen formatlar: {", ".join(self.ALLOWED_EXTENSIONS)}'
            )
        
        return result
    
    def _validate_filename(self, filename: str) -> Dict:
        """Validate and sanitize filename"""
        result = {'warnings': [], 'sanitized_filename': filename}
        
        # Check for dangerous characters
        dangerous_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        if any(char in filename for char in dangerous_chars):
            result['warnings'].append('Dosya adında güvenlik riski oluşturan karakterler tespit edildi')
        
        # Sanitize filename
        sanitized = self._sanitize_filename(filename)
        result['sanitized_filename'] = sanitized
        
        if sanitized != filename:
            result['warnings'].append('Dosya adı güvenlik için değiştirildi')
        
        return result
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for security"""
        # Use werkzeug's secure_filename as base
        filename = secure_filename(filename)
        
        # Additional sanitization
        filename = re.sub(r'[^\w\s.-]', '', filename)
        filename = re.sub(r'[-\s]+', '-', filename)
        
        # Limit length
        name, ext = os.path.splitext(filename)
        if len(name) > 100:
            name = name[:100]
        
        return f"{name}{ext}"
    
    def _validate_mime_type(self, file: FileStorage, extension: str) -> Dict:
        """Validate MIME type using python-magic"""
        result = {
            'is_valid': True,
            'warnings': [],
            'detected_mime_type': None
        }
        
        if not self.has_magic:
            return result
        
        try:
            # Save current position
            current_pos = file.tell()
            file.seek(0)
            
            # Read first chunk for MIME detection
            chunk = file.read(2048)
            file.seek(current_pos)
            
            # Detect MIME type
            detected_mime = self.mime_detector.from_buffer(chunk)
            result['detected_mime_type'] = detected_mime
            
            # Check if detected MIME type matches expected types for extension
            expected_mimes = self.ALLOWED_MIME_TYPES.get(extension, [])
            if expected_mimes and detected_mime not in expected_mimes:
                result['warnings'].append(
                    f'Dosya içeriği beklenen formatla uyuşmuyor. '
                    f'Tespit edilen: {detected_mime}, Beklenen: {", ".join(expected_mimes)}'
                )
            
        except Exception as e:
            result['warnings'].append(f'MIME type tespiti başarısız: {str(e)}')
        
        return result
    
    def _perform_security_checks(self, file: FileStorage, file_info: Dict) -> Dict:
        """Perform comprehensive security checks"""
        security_result = {
            'is_safe': True,
            'security_issues': [],
            'scan_details': {}
        }
        
        try:
            # Save current position
            current_pos = file.tell()
            file.seek(0)
            
            # Read file content for analysis
            content = file.read()
            file.seek(current_pos)
            
            # Check file content based on extension
            extension = file_info['extension']
            
            if extension in ['gpx', 'kml']:
                security_result.update(self._check_xml_security(content))
            elif extension == 'kmz':
                security_result.update(self._check_zip_security(content))
            
        except Exception as e:
            security_result['security_issues'].append(f'Güvenlik taraması hatası: {str(e)}')
            security_result['is_safe'] = False
        
        return security_result
    
    def _check_xml_security(self, content: bytes) -> Dict:
        """Check XML files for security issues"""
        result = {
            'is_safe': True,
            'security_issues': [],
            'scan_details': {'content_type': 'xml'}
        }
        
        try:
            # Decode content
            try:
                text_content = content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    text_content = content.decode('latin-1')
                except:
                    result['security_issues'].append('Dosya karakter kodlaması tespit edilemedi')
                    result['is_safe'] = False
                    return result
            
            # Check for dangerous patterns
            for pattern in self.DANGEROUS_PATTERNS:
                if re.search(pattern, text_content, re.IGNORECASE):
                    result['security_issues'].append(f'Güvenlik riski: Tehlikeli içerik tespit edildi')
                    result['is_safe'] = False
            
            # Validate XML structure
            try:
                ET.fromstring(content)
                result['scan_details']['xml_valid'] = True
            except ET.ParseError as e:
                result['security_issues'].append(f'Geçersiz XML yapısı: {str(e)}')
                result['is_safe'] = False
                result['scan_details']['xml_valid'] = False
            
            # Check for external entity references (XXE protection)
            if '<!ENTITY' in text_content or '<!DOCTYPE' in text_content:
                result['security_issues'].append('Güvenlik riski: External entity referansı tespit edildi')
                result['is_safe'] = False
            
            # Check file size vs content ratio (detect zip bombs in XML)
            if len(text_content) > len(content) * 10:  # Suspicious compression ratio
                result['security_issues'].append('Güvenlik riski: Şüpheli sıkıştırma oranı')
                result['is_safe'] = False
            
        except Exception as e:
            result['security_issues'].append(f'XML güvenlik kontrolü hatası: {str(e)}')
            result['is_safe'] = False
        
        return result
    
    def _check_zip_security(self, content: bytes) -> Dict:
        """Check ZIP files (KMZ) for security issues"""
        result = {
            'is_safe': True,
            'security_issues': [],
            'scan_details': {'content_type': 'zip'}
        }
        
        try:
            # Create temporary file-like object
            import io
            zip_buffer = io.BytesIO(content)
            
            with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                # Check for zip bomb (too many files or too large uncompressed)
                file_list = zip_file.namelist()
                result['scan_details']['file_count'] = len(file_list)
                
                if len(file_list) > 100:  # Too many files
                    result['security_issues'].append('Güvenlik riski: Çok fazla dosya içeriyor')
                    result['is_safe'] = False
                
                total_uncompressed_size = 0
                for file_info in zip_file.filelist:
                    total_uncompressed_size += file_info.file_size
                    
                    # Check for directory traversal
                    if '..' in file_info.filename or file_info.filename.startswith('/'):
                        result['security_issues'].append('Güvenlik riski: Directory traversal tespit edildi')
                        result['is_safe'] = False
                
                result['scan_details']['total_uncompressed_size'] = total_uncompressed_size
                
                # Check compression ratio (zip bomb detection)
                if total_uncompressed_size > len(content) * 100:  # 100:1 ratio threshold
                    result['security_issues'].append('Güvenlik riski: Şüpheli sıkıştırma oranı (zip bomb)')
                    result['is_safe'] = False
                
                # Check if KML file exists
                kml_files = [f for f in file_list if f.lower().endswith('.kml')]
                if not kml_files:
                    result['security_issues'].append('KMZ arşivinde KML dosyası bulunamadı')
                    result['is_safe'] = False
                else:
                    # Check KML content security
                    for kml_file in kml_files[:1]:  # Check only first KML file
                        try:
                            kml_content = zip_file.read(kml_file)
                            kml_security = self._check_xml_security(kml_content)
                            if not kml_security['is_safe']:
                                result['security_issues'].extend(kml_security['security_issues'])
                                result['is_safe'] = False
                        except Exception as e:
                            result['security_issues'].append(f'KML içerik kontrolü hatası: {str(e)}')
                            result['is_safe'] = False
                
        except zipfile.BadZipFile:
            result['security_issues'].append('Geçersiz ZIP dosyası')
            result['is_safe'] = False
        except Exception as e:
            result['security_issues'].append(f'ZIP güvenlik kontrolü hatası: {str(e)}')
            result['is_safe'] = False
        
        return result
    
    def validate_file_content_structure(self, file_path: str, file_type: str) -> Dict:
        """
        Validate the internal structure of route files
        
        Args:
            file_path: Path to the uploaded file
            file_type: File type (gpx, kml, kmz)
            
        Returns:
            Dict: Structure validation results
        """
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'structure_info': {}
        }
        
        try:
            if file_type == 'gpx':
                validation_result.update(self._validate_gpx_structure(file_path))
            elif file_type == 'kml':
                validation_result.update(self._validate_kml_structure(file_path))
            elif file_type == 'kmz':
                validation_result.update(self._validate_kmz_structure(file_path))
            
        except Exception as e:
            validation_result['is_valid'] = False
            validation_result['errors'].append(f'Yapı doğrulama hatası: {str(e)}')
        
        return validation_result
    
    def _validate_gpx_structure(self, file_path: str) -> Dict:
        """Validate GPX file structure"""
        result = {'structure_info': {'format': 'gpx'}}
        
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Check root element
            if not root.tag.endswith('gpx'):
                result['warnings'] = result.get('warnings', [])
                result['warnings'].append('Root element GPX değil')
            
            # Count elements using namespace-aware search
            namespace = root.tag.split('}')[0] + '}' if '}' in root.tag else ''
            tracks = root.findall(f'.//{namespace}trk')
            track_segments = root.findall(f'.//{namespace}trkseg')
            track_points = root.findall(f'.//{namespace}trkpt')
            waypoints = root.findall(f'.//{namespace}wpt')
            
            result['structure_info'].update({
                'tracks_count': len(tracks),
                'track_segments_count': len(track_segments),
                'track_points_count': len(track_points),
                'waypoints_count': len(waypoints)
            })
            
            # Validate minimum content
            if len(track_points) == 0 and len(waypoints) == 0:
                result['errors'] = result.get('errors', [])
                result['errors'].append('GPX dosyasında rota noktası veya waypoint bulunamadı')
                result['is_valid'] = False
            
        except ET.ParseError as e:
            result['errors'] = result.get('errors', [])
            result['errors'].append(f'GPX XML parse hatası: {str(e)}')
            result['is_valid'] = False
        
        return result
    
    def _validate_kml_structure(self, file_path: str) -> Dict:
        """Validate KML file structure"""
        result = {'structure_info': {'format': 'kml'}}
        
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Check root element
            if not root.tag.endswith('kml'):
                result['warnings'] = result.get('warnings', [])
                result['warnings'].append('Root element KML değil')
            
            # Count elements using namespace-aware search
            namespace = root.tag.split('}')[0] + '}' if '}' in root.tag else ''
            placemarks = root.findall(f'.//{namespace}Placemark')
            linestrings = root.findall(f'.//{namespace}LineString')
            points = root.findall(f'.//{namespace}Point')
            coordinates = root.findall(f'.//{namespace}coordinates')
            
            result['structure_info'].update({
                'placemarks_count': len(placemarks),
                'linestrings_count': len(linestrings),
                'points_count': len(points),
                'coordinates_count': len(coordinates)
            })
            
            # Validate minimum content
            if len(coordinates) == 0:
                result['errors'] = result.get('errors', [])
                result['errors'].append('KML dosyasında koordinat bilgisi bulunamadı')
                result['is_valid'] = False
            
        except ET.ParseError as e:
            result['errors'] = result.get('errors', [])
            result['errors'].append(f'KML XML parse hatası: {str(e)}')
            result['is_valid'] = False
        
        return result
    
    def _validate_kmz_structure(self, file_path: str) -> Dict:
        """Validate KMZ file structure"""
        result = {'structure_info': {'format': 'kmz'}}
        
        try:
            with zipfile.ZipFile(file_path, 'r') as kmz_file:
                file_list = kmz_file.namelist()
                kml_files = [f for f in file_list if f.lower().endswith('.kml')]
                
                result['structure_info'].update({
                    'total_files': len(file_list),
                    'kml_files': kml_files,
                    'kml_files_count': len(kml_files)
                })
                
                if not kml_files:
                    result['errors'] = result.get('errors', [])
                    result['errors'].append('KMZ arşivinde KML dosyası bulunamadı')
                    result['is_valid'] = False
                else:
                    # Validate first KML file structure
                    main_kml = kml_files[0]
                    with kmz_file.open(main_kml) as kml_content:
                        # Create temporary file for KML validation
                        import tempfile
                        with tempfile.NamedTemporaryFile(suffix='.kml', delete=False) as temp_kml:
                            temp_kml.write(kml_content.read())
                            temp_kml_path = temp_kml.name
                        
                        try:
                            kml_validation = self._validate_kml_structure(temp_kml_path)
                            result.update(kml_validation)
                        finally:
                            os.unlink(temp_kml_path)
                
        except zipfile.BadZipFile:
            result['errors'] = result.get('errors', [])
            result['errors'].append('Geçersiz KMZ (ZIP) dosyası')
            result['is_valid'] = False
        
        return result
    
    def get_validation_summary(self, validation_results: List[Dict]) -> Dict:
        """
        Generate summary of multiple validation results
        
        Args:
            validation_results: List of validation result dictionaries
            
        Returns:
            Dict: Summary of all validations
        """
        summary = {
            'total_validations': len(validation_results),
            'successful_validations': 0,
            'failed_validations': 0,
            'total_errors': 0,
            'total_warnings': 0,
            'common_issues': {},
            'validation_timestamp': datetime.now().isoformat()
        }
        
        all_errors = []
        all_warnings = []
        
        for result in validation_results:
            if result.get('is_valid', False):
                summary['successful_validations'] += 1
            else:
                summary['failed_validations'] += 1
            
            errors = result.get('errors', [])
            warnings = result.get('warnings', [])
            
            all_errors.extend(errors)
            all_warnings.extend(warnings)
        
        summary['total_errors'] = len(all_errors)
        summary['total_warnings'] = len(all_warnings)
        
        # Find common issues
        from collections import Counter
        error_counts = Counter(all_errors)
        warning_counts = Counter(all_warnings)
        
        summary['common_issues'] = {
            'errors': dict(error_counts.most_common(5)),
            'warnings': dict(warning_counts.most_common(5))
        }
        
        return summary


# Utility functions for testing
def test_validation_middleware():
    """Test the validation middleware with sample data"""
    middleware = FileValidationMiddleware()
    
    print("🧪 File Validation Middleware Test")
    print("=" * 50)
    
    # Test configuration
    print(f"✅ Allowed extensions: {middleware.ALLOWED_EXTENSIONS}")
    print(f"✅ Max file size: {middleware.MAX_FILE_SIZE / (1024*1024):.1f}MB")
    print(f"✅ Magic library available: {middleware.has_magic}")
    
    print("\n🎉 Validation middleware test completed!")


if __name__ == "__main__":
    test_validation_middleware()