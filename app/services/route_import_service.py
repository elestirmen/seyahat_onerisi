"""
Route Import Service for POI Travel Recommendation API.
Handles route file upload, validation, and import operations.
"""

import logging
import os
import json
import uuid
import hashlib
import tempfile
from typing import Dict, List, Any, Optional
from datetime import datetime
from werkzeug.datastructures import FileStorage

from app.middleware.error_handler import APIError, bad_request, not_found, internal_error

logger = logging.getLogger(__name__)


class RouteImportService:
    """Service class for route file import operations."""
    
    def __init__(self):
        self.allowed_extensions = {'gpx', 'kml', 'kmz'}
        self.max_file_size = 50 * 1024 * 1024  # 50MB
        self.min_file_size = 100  # 100 bytes
        self.upload_dir = tempfile.gettempdir()
        self.progress_tracking = {}  # In-memory progress tracking
    
    def validate_file(self, file: FileStorage) -> Dict[str, Any]:
        """
        Validate uploaded file.
        
        Args:
            file: Uploaded file object
            
        Returns:
            Validation result with is_valid, errors, warnings, file_info
        """
        errors = []
        warnings = []
        file_info = {}
        
        try:
            # Check if file exists
            if not file or not file.filename:
                errors.append("No file provided")
                return {
                    'is_valid': False,
                    'errors': errors,
                    'warnings': warnings,
                    'file_info': file_info
                }
            
            filename = file.filename.lower()
            file_info['original_filename'] = file.filename
            file_info['filename'] = filename
            
            # Check file extension
            if '.' not in filename:
                errors.append("File must have an extension")
            else:
                ext = filename.rsplit('.', 1)[1]
                file_info['extension'] = ext
                
                if ext not in self.allowed_extensions:
                    errors.append(f"File type '{ext}' not allowed. Allowed types: {', '.join(self.allowed_extensions)}")
            
            # Check file size
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset position
            
            file_info['size_bytes'] = file_size
            file_info['size_mb'] = round(file_size / (1024 * 1024), 2)
            
            if file_size < self.min_file_size:
                errors.append(f"File too small (minimum {self.min_file_size} bytes)")
            elif file_size > self.max_file_size:
                errors.append(f"File too large (maximum {self.max_file_size // (1024*1024)} MB)")
            
            # Check file content (basic)
            try:
                content_sample = file.read(1024)  # Read first 1KB
                file.seek(0)  # Reset position
                
                # Basic content validation
                if not content_sample:
                    errors.append("File appears to be empty")
                elif file_info.get('extension') == 'gpx':
                    if b'<gpx' not in content_sample and b'<?xml' not in content_sample:
                        warnings.append("File does not appear to be valid GPX format")
                elif file_info.get('extension') == 'kml':
                    if b'<kml' not in content_sample and b'<?xml' not in content_sample:
                        warnings.append("File does not appear to be valid KML format")
                
            except Exception as e:
                warnings.append(f"Could not read file content: {str(e)}")
            
            # Generate file hash for security
            try:
                file_content = file.read()
                file.seek(0)  # Reset position
                file_hash = hashlib.sha256(file_content).hexdigest()
                file_info['sha256_hash'] = file_hash
            except Exception as e:
                warnings.append(f"Could not generate file hash: {str(e)}")
            
            return {
                'is_valid': len(errors) == 0,
                'errors': errors,
                'warnings': warnings,
                'file_info': file_info
            }
            
        except Exception as e:
            logger.error(f"File validation error: {e}")
            return {
                'is_valid': False,
                'errors': [f"Validation error: {str(e)}"],
                'warnings': warnings,
                'file_info': file_info
            }
    
    def save_uploaded_file(self, file: FileStorage, upload_id: str) -> str:
        """
        Save uploaded file to temporary location.
        
        Args:
            file: Uploaded file object
            upload_id: Unique upload identifier
            
        Returns:
            Path to saved file
        """
        try:
            # Create secure filename
            ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'tmp'
            safe_filename = f"route_import_{upload_id}.{ext}"
            file_path = os.path.join(self.upload_dir, safe_filename)
            
            # Save file
            file.save(file_path)
            
            logger.info(f"File saved to {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            raise APIError(f"Failed to save file: {str(e)}", "FILE_SAVE_ERROR")
    
    def parse_route_file(self, file_path: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse route file and extract metadata.
        
        Args:
            file_path: Path to the file
            file_info: File information from validation
            
        Returns:
            Parsed route data with metadata and coordinates
        """
        try:
            ext = file_info.get('extension', '').lower()
            
            if ext == 'gpx':
                return self._parse_gpx_file(file_path)
            elif ext == 'kml':
                return self._parse_kml_file(file_path)
            elif ext == 'kmz':
                return self._parse_kmz_file(file_path)
            else:
                raise APIError(f"Unsupported file type: {ext}", "UNSUPPORTED_FILE_TYPE")
                
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error parsing route file: {e}")
            raise APIError(f"Failed to parse route file: {str(e)}", "ROUTE_PARSE_ERROR")
    
    def _parse_gpx_file(self, file_path: str) -> Dict[str, Any]:
        """Parse GPX file."""
        # Simplified GPX parsing - in real implementation would use gpxpy library
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract basic metadata (simplified)
            metadata = {
                'name': 'Imported GPX Route',
                'description': 'Route imported from GPX file',
                'route_type': 'hiking',
                'format': 'gpx'
            }
            
            # Mock coordinate extraction (in real implementation would parse XML)
            coordinates = [
                {'lat': 38.6417, 'lng': 34.8603},
                {'lat': 38.6420, 'lng': 34.8610},
                {'lat': 38.6425, 'lng': 34.8615}
            ]
            
            return {
                'metadata': metadata,
                'coordinates': coordinates,
                'points_count': len(coordinates),
                'waypoints_count': 0,
                'bounds': {
                    'north': max(p['lat'] for p in coordinates),
                    'south': min(p['lat'] for p in coordinates),
                    'east': max(p['lng'] for p in coordinates),
                    'west': min(p['lng'] for p in coordinates)
                }
            }
            
        except Exception as e:
            raise APIError(f"Error parsing GPX file: {str(e)}", "GPX_PARSE_ERROR")
    
    def _parse_kml_file(self, file_path: str) -> Dict[str, Any]:
        """Parse KML file."""
        # Simplified KML parsing
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            metadata = {
                'name': 'Imported KML Route',
                'description': 'Route imported from KML file',
                'route_type': 'driving',
                'format': 'kml'
            }
            
            # Mock coordinate extraction
            coordinates = [
                {'lat': 38.6417, 'lng': 34.8603},
                {'lat': 38.6422, 'lng': 34.8608}
            ]
            
            return {
                'metadata': metadata,
                'coordinates': coordinates,
                'points_count': len(coordinates),
                'waypoints_count': 0,
                'bounds': {
                    'north': max(p['lat'] for p in coordinates),
                    'south': min(p['lat'] for p in coordinates),
                    'east': max(p['lng'] for p in coordinates),
                    'west': min(p['lng'] for p in coordinates)
                }
            }
            
        except Exception as e:
            raise APIError(f"Error parsing KML file: {str(e)}", "KML_PARSE_ERROR")
    
    def _parse_kmz_file(self, file_path: str) -> Dict[str, Any]:
        """Parse KMZ file (zipped KML)."""
        try:
            import zipfile
            
            with zipfile.ZipFile(file_path, 'r') as kmz:
                # Find KML file in archive
                kml_files = [f for f in kmz.namelist() if f.endswith('.kml')]
                if not kml_files:
                    raise APIError("No KML file found in KMZ archive", "KMZ_NO_KML")
                
                # Extract and parse first KML file
                kml_content = kmz.read(kml_files[0])
                
                # Create temporary KML file
                temp_kml = file_path + '.kml'
                with open(temp_kml, 'wb') as f:
                    f.write(kml_content)
                
                try:
                    result = self._parse_kml_file(temp_kml)
                    result['metadata']['format'] = 'kmz'
                    return result
                finally:
                    # Clean up temporary file
                    if os.path.exists(temp_kml):
                        os.unlink(temp_kml)
                        
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error parsing KMZ file: {str(e)}", "KMZ_PARSE_ERROR")
    
    def update_progress(self, upload_id: str, status: str, progress: int, message: str, **kwargs):
        """Update import progress."""
        self.progress_tracking[upload_id] = {
            'status': status,
            'progress': progress,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            **kwargs
        }
    
    def get_progress(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """Get import progress."""
        return self.progress_tracking.get(upload_id)
    
    def cleanup_upload(self, upload_id: str, file_path: str = None):
        """Clean up upload files and progress tracking."""
        try:
            # Remove file if exists
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Cleaned up file: {file_path}")
            
            # Remove progress tracking
            if upload_id in self.progress_tracking:
                del self.progress_tracking[upload_id]
                logger.info(f"Cleaned up progress tracking: {upload_id}")
                
        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")
    
    def import_route_file(self, file: FileStorage) -> Dict[str, Any]:
        """
        Complete route file import process.
        
        Args:
            file: Uploaded file object
            
        Returns:
            Import result with upload_id and parsed data
        """
        upload_id = str(uuid.uuid4())
        file_path = None
        
        try:
            # Initialize progress
            self.update_progress(upload_id, 'validating', 10, 'Validating file...')
            
            # Validate file
            validation_result = self.validate_file(file)
            if not validation_result['is_valid']:
                self.update_progress(upload_id, 'failed', 0, 'File validation failed', 
                                   errors=validation_result['errors'])
                raise bad_request("File validation failed", details={
                    'validation_errors': validation_result['errors'],
                    'warnings': validation_result.get('warnings', [])
                })
            
            # Save file
            self.update_progress(upload_id, 'uploading', 30, 'Saving file...')
            file_path = self.save_uploaded_file(file, upload_id)
            
            # Parse file
            self.update_progress(upload_id, 'parsing', 60, 'Parsing route data...')
            parsed_data = self.parse_route_file(file_path, validation_result['file_info'])
            
            # Complete
            self.update_progress(upload_id, 'completed', 100, 'Import completed successfully')
            
            return {
                'success': True,
                'upload_id': upload_id,
                'message': 'Route file imported successfully',
                'file_info': validation_result['file_info'],
                'route_data': parsed_data,
                'validation_warnings': validation_result.get('warnings', []),
                'temp_file_path': file_path
            }
            
        except APIError:
            if file_path:
                self.cleanup_upload(upload_id, file_path)
            raise
        except Exception as e:
            if file_path:
                self.cleanup_upload(upload_id, file_path)
            logger.error(f"Unexpected error during route import: {e}")
            raise APIError("Internal server error during import", "IMPORT_ERROR", 500)


# Global route import service instance
route_import_service = RouteImportService()
