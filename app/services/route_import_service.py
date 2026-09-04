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
import zipfile
import time
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from werkzeug.datastructures import FileStorage

from app.middleware.error_handler import APIError, bad_request

logger = logging.getLogger(__name__)


class RouteImportService:
    """Service class for route file import operations."""
    
    def __init__(self):
        self.allowed_extensions = {'gpx', 'kml', 'kmz'}
        self.max_file_size = 50 * 1024 * 1024  # 50MB
        self.max_xml_size = 20 * 1024 * 1024  # parsed XML payload limit
        self.max_kmz_entries = 100
        self.max_kmz_uncompressed_size = 100 * 1024 * 1024
        self.max_kmz_compression_ratio = 100
        self.min_file_size = 100  # 100 bytes
        self.upload_dir = tempfile.gettempdir()
        self.state_dir = Path(self.upload_dir) / "poi_route_import_state"
        self.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            self.state_dir.chmod(0o700)
        except OSError:
            pass
        try:
            self.state_ttl_seconds = max(
                300, int(os.environ.get("ROUTE_IMPORT_STATE_TTL_SECONDS", "86400"))
            )
        except (TypeError, ValueError):
            self.state_ttl_seconds = 86400
        self.progress_tracking = {}
        self._cleanup_stale_states()

    def _normalize_upload_id(self, upload_id: str) -> str:
        try:
            return str(uuid.UUID(str(upload_id)))
        except (TypeError, ValueError, AttributeError):
            raise bad_request("Invalid upload_id format")

    def _state_path(self, upload_id: str) -> Path:
        safe_upload_id = self._normalize_upload_id(upload_id)
        state_path = (self.state_dir / f"{safe_upload_id}.json").resolve()
        state_root = self.state_dir.resolve()
        try:
            state_path.relative_to(state_root)
        except ValueError:
            raise bad_request("Invalid upload_id format")
        return state_path

    def _write_progress_state(self, upload_id: str, payload: Dict[str, Any]):
        safe_upload_id = self._normalize_upload_id(upload_id)
        state_path = self._state_path(safe_upload_id)
        temp_path = state_path.with_suffix(".tmp")
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(temp_path, flags, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise
        os.replace(temp_path, state_path)
        try:
            state_path.chmod(0o600)
        except OSError:
            pass

    def _read_progress_state(self, upload_id: str) -> Optional[Dict[str, Any]]:
        safe_upload_id = self._normalize_upload_id(upload_id)
        state_path = self._state_path(safe_upload_id)
        if not state_path.exists():
            return None
        try:
            with open(state_path, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception as exc:
            logger.warning(f"Failed to read import state for {safe_upload_id}: {exc}")
            return None

    def _is_managed_upload_path(self, file_path: Any, upload_id: Any = None) -> bool:
        if not file_path:
            return False
        try:
            candidate = Path(str(file_path)).resolve()
            upload_root = Path(self.upload_dir).resolve()
            candidate.relative_to(upload_root)
            if candidate.parent != upload_root or candidate.suffix.lower().lstrip('.') not in self.allowed_extensions:
                return False
            filename_token = candidate.stem.removeprefix("route_import_")
            if filename_token == candidate.stem:
                return False
            normalized_token = str(uuid.UUID(filename_token))
            if upload_id is not None and normalized_token != self._normalize_upload_id(upload_id):
                return False
            return True
        except (OSError, ValueError, AttributeError, APIError):
            return False

    def _cleanup_stale_states(self) -> None:
        """Remove expired import state and only its managed temporary upload."""
        cutoff = time.time() - self.state_ttl_seconds
        for state_path in self.state_dir.glob("*.json"):
            try:
                if state_path.stat().st_mtime >= cutoff:
                    continue
                temp_file_path = None
                try:
                    with open(state_path, "r", encoding="utf-8") as handle:
                        payload = json.load(handle)
                    if isinstance(payload, dict):
                        temp_file_path = payload.get("temp_file_path")
                except (OSError, ValueError, TypeError):
                    pass

                if self._is_managed_upload_path(temp_file_path, state_path.stem):
                    Path(str(temp_file_path)).unlink(missing_ok=True)
                state_path.unlink(missing_ok=True)
            except OSError as exc:
                logger.warning("Failed to clean stale route import state: %s", exc)
    
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
            
            # Generate the hash incrementally so a maximum-sized upload is not
            # duplicated in process memory.
            try:
                file_hash = self._calculate_stream_hash(file)
                file_info['sha256_hash'] = file_hash
                # Frontend expects file_hash
                file_info['file_hash'] = file_hash
            except Exception as e:
                warnings.append(f"Could not generate file hash: {str(e)}")

            extension = file_info.get('extension')
            if extension in {'gpx', 'kml'} and file_size > self.max_xml_size:
                errors.append(
                    f"XML content too large (maximum {self.max_xml_size // (1024 * 1024)} MB)"
                )
            elif extension == 'kmz' and not errors:
                errors.extend(self._validate_kmz_archive(file))
            
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

    @staticmethod
    def _calculate_stream_hash(file: FileStorage) -> str:
        current_position = file.tell()
        digest = hashlib.sha256()
        try:
            file.seek(0)
            for chunk in iter(lambda: file.read(64 * 1024), b''):
                digest.update(chunk)
            return digest.hexdigest()
        finally:
            file.seek(current_position)

    def _validate_kmz_archive(self, file: FileStorage):
        """Validate archive metadata without inflating entries into memory."""
        errors = []
        current_position = file.tell()
        try:
            file.seek(0)
            with zipfile.ZipFile(file.stream, 'r') as archive:
                entries = archive.infolist()
                if len(entries) > self.max_kmz_entries:
                    errors.append(
                        f"KMZ contains too many entries (maximum {self.max_kmz_entries})"
                    )

                total_uncompressed = sum(entry.file_size for entry in entries)
                total_compressed = sum(entry.compress_size for entry in entries)
                if total_uncompressed > self.max_kmz_uncompressed_size:
                    errors.append(
                        "KMZ uncompressed content exceeds the allowed size"
                    )
                elif (
                    total_uncompressed / max(total_compressed, 1)
                    > self.max_kmz_compression_ratio
                ):
                    errors.append("KMZ has a suspicious compression ratio")

                for entry in entries:
                    normalized_name = entry.filename.replace('\\', '/')
                    if (
                        normalized_name.startswith('/')
                        or '..' in normalized_name.split('/')
                        or entry.flag_bits & 0x1
                    ):
                        errors.append("KMZ contains an unsafe archive entry")
                        break

                kml_entries = [
                    entry for entry in entries
                    if entry.filename.lower().endswith('.kml')
                ]
                if not kml_entries:
                    errors.append("KMZ archive does not contain a KML file")
                else:
                    main_kml = next(
                        (
                            entry for entry in kml_entries
                            if entry.filename.lower().endswith('doc.kml')
                        ),
                        kml_entries[0],
                    )
                    if main_kml.file_size > self.max_xml_size:
                        errors.append(
                            "KML content inside KMZ exceeds the allowed size"
                        )
                    elif (
                        main_kml.file_size / max(main_kml.compress_size, 1)
                        > self.max_kmz_compression_ratio
                    ):
                        errors.append("KML content has a suspicious compression ratio")
        except (zipfile.BadZipFile, OSError):
            errors.append("KMZ is not a valid ZIP archive")
        finally:
            file.seek(current_position)

        return errors
    
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
            safe_upload_id = self._normalize_upload_id(upload_id)
            # Create secure filename
            ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'tmp'
            safe_filename = f"route_import_{safe_upload_id}.{ext}"
            file_path = str(Path(self.upload_dir) / safe_filename)
            
            # Create with owner-only permissions from the first byte. Applying
            # chmod only after saving creates a brief disclosure window under
            # permissive process umasks.
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            if hasattr(os, "O_NOFOLLOW"):
                flags |= os.O_NOFOLLOW
            descriptor = os.open(file_path, flags, 0o600)
            try:
                with os.fdopen(descriptor, "wb") as destination:
                    file.save(destination)
            except Exception:
                Path(file_path).unlink(missing_ok=True)
                raise
            
            logger.info("Route import upload saved for %s", safe_upload_id)
            return file_path
            
        except APIError:
            raise
        except Exception:
            logger.exception("Error saving route import upload")
            raise APIError("Failed to save file", "FILE_SAVE_ERROR")
    
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
            from route_file_parser import RouteFileParser  # legacy, stdlib-only parser

            ext = (file_info.get('extension') or '').lower()
            parser = RouteFileParser()
            parsed = parser.parse_file(file_path, file_type=ext or None)

            metadata = parser.extract_metadata(parsed)

            coords = [
                {
                    'lat': p.latitude,
                    'lng': p.longitude,
                    'elevation': p.elevation,
                    'time': p.time.isoformat() if p.time else None,
                    'name': p.name,
                    'description': p.description,
                }
                for p in parsed.points
            ]

            waypoints = [
                {
                    'lat': p.latitude,
                    'lng': p.longitude,
                    'elevation': p.elevation,
                    'time': p.time.isoformat() if p.time else None,
                    'name': p.name,
                    'description': p.description,
                }
                for p in parsed.waypoints
            ]

            # Map preview: cap points to keep UI responsive
            max_preview = 250
            if len(coords) <= max_preview:
                coords_preview = coords
            else:
                step = max(1, len(coords) // max_preview)
                coords_preview = coords[::step][:max_preview]

            bounds = None
            if coords:
                lats = [p['lat'] for p in coords if isinstance(p.get('lat'), (int, float))]
                lngs = [p['lng'] for p in coords if isinstance(p.get('lng'), (int, float))]
                if lats and lngs:
                    bounds = {
                        'north': max(lats),
                        'south': min(lats),
                        'east': max(lngs),
                        'west': min(lngs),
                    }

            return {
                'metadata': metadata,
                'coordinates': coords,
                'coordinates_preview': coords_preview,
                'points_count': len(coords),
                'waypoints': waypoints,
                'waypoints_count': len(waypoints),
                'bounds': bounds,
            }

        except APIError:
            raise
        except Exception:
            logger.exception("Error parsing route import file")
            raise APIError("Failed to parse route file", "ROUTE_PARSE_ERROR")
    
    def _parse_gpx_file(self, file_path: str) -> Dict[str, Any]:
        """Parse GPX file."""
        # Simplified GPX parsing - in real implementation would use gpxpy library
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read()
            
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
                f.read()
            
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
        safe_upload_id = self._normalize_upload_id(upload_id)
        payload = {
            'status': status,
            'progress': progress,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            **kwargs
        }
        self.progress_tracking[safe_upload_id] = payload
        self._write_progress_state(safe_upload_id, payload)

    def get_progress(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """Get import progress."""
        safe_upload_id = self._normalize_upload_id(upload_id)
        state = self._read_progress_state(safe_upload_id)
        if state is not None:
            self.progress_tracking[safe_upload_id] = state
            return state
        return self.progress_tracking.get(safe_upload_id)
    
    def cleanup_upload(self, upload_id: str, file_path: str = None):
        """Clean up upload files and progress tracking."""
        safe_upload_id = self._normalize_upload_id(upload_id)
        try:
            if not file_path:
                state = self.get_progress(safe_upload_id) or {}
                file_path = state.get('temp_file_path')

            # Never unlink a caller-supplied path outside the exact managed
            # route-import filename format.
            if self._is_managed_upload_path(file_path, safe_upload_id) and os.path.exists(file_path):
                os.unlink(file_path)
                logger.info("Cleaned up route import upload for %s", safe_upload_id)
            elif file_path:
                logger.warning("Refused to clean unmanaged upload path for %s", safe_upload_id)
            
            # Remove progress tracking
            if safe_upload_id in self.progress_tracking:
                del self.progress_tracking[safe_upload_id]
                logger.info(f"Cleaned up progress tracking: {safe_upload_id}")

            state_path = self._state_path(safe_upload_id)
            if state_path.exists():
                state_path.unlink()
                logger.info(f"Cleaned up persisted state: {safe_upload_id}")
                
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
            self._cleanup_stale_states()
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
            self.update_progress(
                upload_id,
                'completed',
                100,
                'Import completed successfully',
                file_info=validation_result.get('file_info') or {},
                route_data=parsed_data,
                temp_file_path=file_path,
            )
            
            return {
                'success': True,
                'upload_id': upload_id,
                'message': 'Route file imported successfully',
                'file_info': validation_result['file_info'],
                'route_data': parsed_data,
                'validation_warnings': validation_result.get('warnings', []),
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
