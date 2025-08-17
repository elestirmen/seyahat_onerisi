"""
Media Service for POI Travel Recommendation API.
Handles media file upload, processing, and management for POIs.
"""

import os
import shutil
import hashlib
import uuid
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.middleware.error_handler import APIError, bad_request, not_found, internal_error

logger = logging.getLogger(__name__)


class MediaService:
    """Service class for media management operations."""
    
    # Supported media formats
    SUPPORTED_FORMATS = {
        'image': {
            'extensions': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
            'mime_types': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'],
            'max_size': 15 * 1024 * 1024,  # 15MB
            'folder': 'images'
        },
        'video': {
            'extensions': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
            'mime_types': ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm'],
            'max_size': 100 * 1024 * 1024,  # 100MB
            'folder': 'videos'
        },
        'audio': {
            'extensions': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
            'mime_types': ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac'],
            'max_size': 50 * 1024 * 1024,  # 50MB
            'folder': 'audio'
        },
        'model_3d': {
            'extensions': ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.ply', '.stl'],
            'mime_types': ['model/gltf-binary', 'model/gltf+json', 'model/obj'],
            'max_size': 50 * 1024 * 1024,  # 50MB
            'folder': '3d_models'
        }
    }
    
    def __init__(self, base_path: str = "poi_media"):
        self.base_path = Path(base_path)
        self.thumbnails_path = self.base_path / "thumbnails"
        self.previews_path = self.base_path / "previews"
        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure all required directories exist."""
        try:
            # Create base directories
            self.base_path.mkdir(exist_ok=True)
            self.thumbnails_path.mkdir(exist_ok=True)
            self.previews_path.mkdir(exist_ok=True)
            
            # Create media type directories
            for media_type, config in self.SUPPORTED_FORMATS.items():
                folder_path = self.base_path / config['folder']
                folder_path.mkdir(exist_ok=True)
                
            logger.info(f"Media directories ensured at {self.base_path}")
            
        except Exception as e:
            logger.error(f"Error creating media directories: {e}")
            raise APIError("Failed to initialize media directories", "MEDIA_DIR_ERROR", 500)

    def generate_thumbnail(self, source_path: Union[str, Path], size: Tuple[int, int] = (300, 200)) -> Optional[str]:
        """Generate a thumbnail for the given image file."""
        try:
            from PIL import Image

            source = Path(source_path)
            thumb_path = source.with_name(f"{source.stem}_thumb{source.suffix}")
            thumb_path.parent.mkdir(parents=True, exist_ok=True)

            with Image.open(source) as img:
                img.thumbnail(size)
                img.save(thumb_path)

            return str(thumb_path)
        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")
            return None
    
    def validate_file(self, file: FileStorage, media_type: str = None) -> Dict[str, Any]:
        """
        Validate uploaded media file.
        
        Args:
            file: Uploaded file object
            media_type: Expected media type (image, video, audio, model_3d)
            
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
            
            # Detect media type from extension
            detected_type = self._detect_media_type(filename)
            file_info['detected_type'] = detected_type
            
            if not detected_type:
                errors.append(f"Unsupported file type: {filename}")
                return {
                    'is_valid': False,
                    'errors': errors,
                    'warnings': warnings,
                    'file_info': file_info
                }
            
            # Check if media type matches expected type
            if media_type and detected_type != media_type:
                errors.append(f"Expected {media_type} file, got {detected_type}")
            
            # Get format configuration
            format_config = self.SUPPORTED_FORMATS[detected_type]
            
            # Check file extension
            file_ext = Path(filename).suffix.lower()
            if file_ext not in format_config['extensions']:
                errors.append(f"File extension '{file_ext}' not supported for {detected_type}")
            
            # Check file size
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset position
            
            file_info['size_bytes'] = file_size
            file_info['size_mb'] = round(file_size / (1024 * 1024), 2)
            
            if file_size == 0:
                errors.append("File is empty")
            elif file_size > format_config['max_size']:
                max_size_mb = format_config['max_size'] // (1024 * 1024)
                errors.append(f"File too large (maximum {max_size_mb} MB for {detected_type})")
            
            # Basic content validation
            try:
                content_sample = file.read(1024)  # Read first 1KB
                file.seek(0)  # Reset position
                
                if not content_sample:
                    errors.append("File appears to be empty or corrupted")
                else:
                    # Basic magic number checks for common formats
                    if detected_type == 'image':
                        if not self._is_valid_image_header(content_sample):
                            warnings.append("File may not be a valid image")
                    
            except Exception as e:
                warnings.append(f"Could not read file content: {str(e)}")
            
            # Generate file hash for duplicate detection
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
    
    def upload_media(self, file: FileStorage, poi_id: int, media_type: str = None, 
                    description: str = None) -> Dict[str, Any]:
        """
        Upload and process media file for POI.
        
        Args:
            file: Uploaded file object
            poi_id: POI identifier
            media_type: Media type (auto-detected if not provided)
            description: Media description
            
        Returns:
            Upload result with file information
        """
        try:
            # Validate file
            validation_result = self.validate_file(file, media_type)
            if not validation_result['is_valid']:
                raise bad_request("File validation failed", details={
                    'validation_errors': validation_result['errors'],
                    'warnings': validation_result.get('warnings', [])
                })
            
            file_info = validation_result['file_info']
            detected_type = file_info['detected_type']
            
            # Generate unique filename
            file_id = str(uuid.uuid4())
            original_ext = Path(file.filename).suffix.lower()
            safe_filename = f"{file_id}{original_ext}"
            
            # Determine target directory
            format_config = self.SUPPORTED_FORMATS[detected_type]
            target_dir = self.base_path / format_config['folder']
            file_path = target_dir / safe_filename
            
            # Save file
            file.save(str(file_path))
            
            # Process based on media type
            processing_result = self._process_media_file(file_path, detected_type, file_id)
            
            # Prepare result
            result = {
                'success': True,
                'file_id': file_id,
                'filename': safe_filename,
                'original_filename': file.filename,
                'media_type': detected_type,
                'poi_id': poi_id,
                'description': description or '',
                'file_size': file_info['size_bytes'],
                'file_hash': file_info.get('sha256_hash'),
                'file_path': str(file_path.relative_to(self.base_path)),
                'validation_warnings': validation_result.get('warnings', []),
                **processing_result
            }
            
            # TODO: Save media info to database
            # self._save_media_to_database(result)
            
            logger.info(f"Media uploaded successfully: {file_id} for POI {poi_id}")
            
            return result
            
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Media upload error: {e}")
            raise APIError("Failed to upload media", "MEDIA_UPLOAD_ERROR", 500)
    
    def get_poi_media(self, poi_id: int, media_type: str = None) -> List[Dict[str, Any]]:
        """
        Get all media files for a POI.
        
        Args:
            poi_id: POI identifier
            media_type: Filter by media type (optional)
            
        Returns:
            List of media files
        """
        try:
            # TODO: Implement database query to get media files
            # For now, return mock data
            
            mock_media = [
                {
                    'file_id': 'mock-image-1',
                    'filename': 'poi_image_1.jpg',
                    'original_filename': 'beautiful_view.jpg',
                    'media_type': 'image',
                    'poi_id': poi_id,
                    'description': 'Beautiful view of the location',
                    'file_size': 1024000,
                    'file_path': f'images/mock-image-1.jpg',
                    'thumbnail_path': f'thumbnails/mock-image-1_thumb.jpg',
                    'created_at': '2024-01-15T10:00:00Z'
                }
            ]
            
            # Filter by media type if specified
            if media_type:
                mock_media = [m for m in mock_media if m['media_type'] == media_type]
            
            return mock_media
            
        except Exception as e:
            logger.error(f"Error getting POI media: {e}")
            raise APIError("Failed to get media files", "MEDIA_GET_ERROR", 500)
    
    def delete_media(self, file_id: str, poi_id: int = None) -> Dict[str, Any]:
        """
        Delete media file.
        
        Args:
            file_id: File identifier
            poi_id: POI identifier (for verification)
            
        Returns:
            Deletion result
        """
        try:
            # TODO: Implement database query to get file info
            # For now, mock the deletion
            
            # In real implementation:
            # 1. Get file info from database
            # 2. Verify POI ownership if poi_id provided
            # 3. Delete physical files (original, thumbnails, previews)
            # 4. Remove database record
            
            logger.info(f"Media file deleted: {file_id}")
            
            return {
                'success': True,
                'message': f'Media file {file_id} deleted successfully'
            }
            
        except Exception as e:
            logger.error(f"Error deleting media: {e}")
            raise APIError("Failed to delete media file", "MEDIA_DELETE_ERROR", 500)
    
    def get_media_statistics(self) -> Dict[str, Any]:
        """
        Get media system statistics.
        
        Returns:
            Media statistics
        """
        try:
            stats = {
                'total_files': 0,
                'total_size_bytes': 0,
                'by_type': {},
                'directories': {}
            }
            
            # Calculate statistics for each media type
            for media_type, config in self.SUPPORTED_FORMATS.items():
                folder_path = self.base_path / config['folder']
                
                if folder_path.exists():
                    files = list(folder_path.glob('*'))
                    file_count = len(files)
                    total_size = sum(f.stat().st_size for f in files if f.is_file())
                    
                    stats['by_type'][media_type] = {
                        'count': file_count,
                        'size_bytes': total_size,
                        'size_mb': round(total_size / (1024 * 1024), 2)
                    }
                    
                    stats['total_files'] += file_count
                    stats['total_size_bytes'] += total_size
                    
                    stats['directories'][config['folder']] = {
                        'path': str(folder_path),
                        'exists': True,
                        'file_count': file_count
                    }
                else:
                    stats['by_type'][media_type] = {
                        'count': 0,
                        'size_bytes': 0,
                        'size_mb': 0
                    }
                    
                    stats['directories'][config['folder']] = {
                        'path': str(folder_path),
                        'exists': False,
                        'file_count': 0
                    }
            
            stats['total_size_mb'] = round(stats['total_size_bytes'] / (1024 * 1024), 2)
            stats['base_path'] = str(self.base_path)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting media statistics: {e}")
            raise APIError("Failed to get media statistics", "MEDIA_STATS_ERROR", 500)
    
    def _detect_media_type(self, filename: str) -> Optional[str]:
        """Detect media type from filename extension."""
        file_ext = Path(filename).suffix.lower()
        
        for media_type, config in self.SUPPORTED_FORMATS.items():
            if file_ext in config['extensions']:
                return media_type
        
        return None
    
    def _is_valid_image_header(self, content_sample: bytes) -> bool:
        """Check if file has valid image magic numbers."""
        # Check for common image format magic numbers
        image_signatures = [
            b'\xff\xd8\xff',  # JPEG
            b'\x89PNG\r\n\x1a\n',  # PNG
            b'GIF87a',  # GIF87a
            b'GIF89a',  # GIF89a
            b'RIFF',  # WebP (starts with RIFF)
            b'BM',  # BMP
            b'MM\x00\x2a',  # TIFF (big endian)
            b'II\x2a\x00',  # TIFF (little endian)
        ]
        
        for signature in image_signatures:
            if content_sample.startswith(signature):
                return True
        
        return False
    
    def _process_media_file(self, file_path: Path, media_type: str, file_id: str) -> Dict[str, Any]:
        """
        Process uploaded media file (generate thumbnails, extract metadata, etc.).
        
        Args:
            file_path: Path to uploaded file
            media_type: Type of media
            file_id: Unique file identifier
            
        Returns:
            Processing result
        """
        try:
            result = {
                'processed': True,
                'thumbnails': [],
                'metadata': {}
            }
            
            if media_type == 'image':
                # For images, could generate thumbnails using PIL
                # For now, just return basic info
                result['thumbnails'] = [
                    {
                        'size': 'thumb',
                        'dimensions': '150x150',
                        'path': f'thumbnails/{file_id}_thumb.jpg'
                    },
                    {
                        'size': 'preview',
                        'dimensions': '400x400',
                        'path': f'previews/{file_id}_preview.jpg'
                    }
                ]
                
                # Could extract EXIF data here
                result['metadata'] = {
                    'format': 'JPEG',
                    'dimensions': '1920x1080',  # Mock data
                    'color_mode': 'RGB'
                }
            
            elif media_type == 'video':
                # For videos, could extract frame thumbnails
                result['thumbnails'] = [
                    {
                        'size': 'thumb',
                        'dimensions': '150x150',
                        'path': f'thumbnails/{file_id}_thumb.jpg',
                        'frame_time': '00:00:01'
                    }
                ]
                
                result['metadata'] = {
                    'duration': '00:02:30',  # Mock data
                    'resolution': '1920x1080',
                    'framerate': '30fps',
                    'codec': 'H.264'
                }
            
            elif media_type == 'audio':
                result['metadata'] = {
                    'duration': '00:03:45',  # Mock data
                    'bitrate': '320kbps',
                    'sample_rate': '44.1kHz',
                    'codec': 'MP3'
                }
            
            elif media_type == 'model_3d':
                result['metadata'] = {
                    'format': 'GLB',
                    'vertices': 15420,  # Mock data
                    'faces': 8960,
                    'materials': 3
                }
            
            return result
            
        except Exception as e:
            logger.warning(f"Media processing error: {e}")
            return {
                'processed': False,
                'error': str(e),
                'thumbnails': [],
                'metadata': {}
            }


# Global media service instance
media_service = MediaService()
