"""
Media Service for POI Travel Recommendation API.
Handles media file upload, processing, and management for POIs.
"""

import hashlib
import json
import os
import uuid
import logging
import math
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.middleware.error_handler import APIError, bad_request, not_found

logger = logging.getLogger(__name__)

MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024


class MediaService:
    """Service class for media management operations."""
    
    # Supported media formats
    SUPPORTED_FORMATS = {
        'image': {
            'extensions': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
            'mime_types': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'],
            'max_size': MAX_MEDIA_FILE_SIZE,
            'folder': 'images'
        },
        'video': {
            'extensions': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
            'mime_types': ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm'],
            'max_size': MAX_MEDIA_FILE_SIZE,
            'folder': 'videos'
        },
        'audio': {
            'extensions': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
            'mime_types': ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac'],
            'max_size': MAX_MEDIA_FILE_SIZE,
            'folder': 'audio'
        },
        'model_3d': {
            'extensions': ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.ply', '.stl'],
            'mime_types': ['model/gltf-binary', 'model/gltf+json', 'model/obj'],
            'max_size': MAX_MEDIA_FILE_SIZE,
            'folder': '3d_models'
        }
    }
    
    def __init__(self, base_path: str = "poi_media"):
        self.base_path = Path(base_path)
        self.thumbnails_path = self.base_path / "thumbnails"
        self.previews_path = self.base_path / "previews"
        self._legacy_manager = None
        self._ensure_directories()

    def _get_legacy_manager(self):
        if self._legacy_manager is None:
            from poi_media_manager import POIMediaManager

            self._legacy_manager = POIMediaManager(str(self.base_path))
        return self._legacy_manager

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

    def _get_database_connection(self):
        """Get database connection or raise API error."""
        try:
            from app.config.database import get_database_pool

            pool = get_database_pool()
            if pool is not None:
                return pool.get_connection()
        except Exception as exc:
            logger.debug("Database pool unavailable for media service: %s", exc)

        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor

            conn_str = os.environ.get("POI_DB_CONNECTION")
            if conn_str:
                conn = psycopg2.connect(conn_str, cursor_factory=RealDictCursor)
            else:
                conn = psycopg2.connect(
                    host=os.environ.get("DB_HOST") or os.environ.get("POI_DB_HOST", "localhost"),
                    port=int(os.environ.get("DB_PORT") or os.environ.get("POI_DB_PORT") or 5432),
                    database=os.environ.get("DB_NAME") or os.environ.get("POI_DB_NAME", "poi_db"),
                    user=os.environ.get("DB_USER") or os.environ.get("POI_DB_USER", "poi_user"),
                    password=os.environ.get("DB_PASSWORD") or os.environ.get("POI_DB_PASSWORD", "poi_password"),
                    cursor_factory=RealDictCursor,
                )

            class DirectConnectionContext:
                def __init__(self, connection):
                    self.connection = connection

                def __enter__(self):
                    return self.connection

                def __exit__(self, exc_type, exc_val, exc_tb):
                    if exc_type:
                        self.connection.rollback()
                    else:
                        self.connection.commit()
                    self.connection.close()

            return DirectConnectionContext(conn)
        except Exception as exc:
            logger.error("Database connection failed for media service: %s", exc)
            raise APIError("Database connection failed", "DB_CONN_ERROR", 503)

    def _to_relative_media_path(self, raw_path: Any) -> str:
        """Normalize stored media paths for frontend consumption."""
        if not raw_path or not isinstance(raw_path, str):
            return ""

        normalized = raw_path.replace("\\", "/")
        path_obj = Path(normalized)
        if path_obj.is_absolute():
            try:
                return str(path_obj.resolve().relative_to(Path.cwd().resolve())).replace("\\", "/")
            except Exception:
                marker = f"{self.base_path.name}/"
                marker_index = normalized.find(marker)
                if marker_index != -1:
                    return normalized[marker_index:]
                return normalized.lstrip("/")

        return normalized

    def _get_active_poi_identity(self, poi_id: Union[str, int]) -> Dict[str, Any]:
        """Fetch the minimum active POI data needed for media operations."""
        try:
            poi_id_int = int(poi_id)
        except (TypeError, ValueError):
            raise bad_request("Invalid POI ID format")

        with self._get_database_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, category
                    FROM pois
                    WHERE id = %s AND is_active = true
                    """,
                    (poi_id_int,),
                )
                row = cursor.fetchone()

        if not row:
            raise not_found("POI not found")

        return dict(row) if isinstance(row, dict) else {
            "id": row[0],
            "name": row[1],
            "category": row[2],
        }

    def _list_supported_extensions(self) -> List[str]:
        extensions: List[str] = []
        for config in self._get_legacy_manager().SUPPORTED_FORMATS.values():
            extensions.extend(config.get("extensions", []))
        return extensions

    def _normalize_requested_media_type(
        self,
        media_type: Optional[str],
        *,
        allow_panorama: bool = False,
    ) -> Optional[str]:
        if media_type is None:
            return None

        normalized = str(media_type).strip().lower()
        if not normalized:
            return None

        if normalized == "photo":
            normalized = "image"

        allowed_types = set(self.SUPPORTED_FORMATS.keys())
        if allow_panorama:
            allowed_types.add("panorama")

        if normalized not in allowed_types:
            raise bad_request("Invalid media_type value")

        return normalized

    def upload_poi_media_asset(
        self,
        poi_id: Union[str, int],
        file: Optional[FileStorage],
        caption: str = "",
        is_primary: bool = False,
        media_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upload a POI media asset using the legacy storage contract."""
        if not file:
            raise bad_request("No media file provided")

        if not getattr(file, "filename", ""):
            raise bad_request("No file selected")

        requested_type = self._normalize_requested_media_type(media_type)
        validation_result = self.validate_file(file, requested_type)
        if not validation_result["is_valid"]:
            raise bad_request(
                "File validation failed",
                details={
                    "validation_errors": validation_result["errors"],
                    "warnings": validation_result.get("warnings", []),
                },
            )

        legacy_manager = self._get_legacy_manager()
        detected_type = validation_result["file_info"]["detected_type"]

        poi = self._get_active_poi_identity(poi_id)

        safe_name = secure_filename(file.filename)
        temp_path = Path("/tmp") / f"{uuid.uuid4()}_{safe_name}"

        try:
            file.save(str(temp_path))
            result = legacy_manager.add_poi_media(
                poi_id=str(poi_id),
                poi_name=poi.get("name", ""),
                category=poi.get("category") or "",
                media_file_path=str(temp_path),
                media_type=requested_type or detected_type,
                caption=caption,
                is_primary=is_primary,
            )
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass

        if not result:
            raise APIError("Failed to process media file", "MEDIA_UPLOAD_ERROR", 500)

        return {
            "success": True,
            "media": result,
        }

    def list_poi_images_legacy(self, poi_id: Union[str, int]) -> Dict[str, Any]:
        """List image-only POI media in the legacy `/images` response shape."""
        self._get_active_poi_identity(poi_id)
        images = self._get_legacy_manager().get_poi_media_by_id(str(poi_id), "image")
        return {"images": images}

    def delete_poi_media_asset(self, poi_id: Union[str, int], filename: str) -> Dict[str, Any]:
        """Delete a POI media asset by filename."""
        if ".." in filename or filename.startswith("/"):
            raise bad_request("Invalid filename")

        success = self._get_legacy_manager().delete_poi_media_by_id(str(poi_id), filename)
        if success:
            return {"success": True}

        return {"success": True, "message": "Media file not found or already deleted"}

    def upload_panoramas(self, files: List[FileStorage], caption: str = "") -> Dict[str, Any]:
        """Upload standalone panorama images through the legacy media manager."""
        valid_files = [file for file in files if getattr(file, "filename", None)]
        if not valid_files:
            raise bad_request("No media file provided")

        legacy_manager = self._get_legacy_manager()
        panoramas: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        for idx, file in enumerate(valid_files):
            filename_raw = file.filename or f"panorama_{idx + 1}"
            safe_suffix = Path(filename_raw).suffix or ".jpg"
            temp_path = Path("/tmp") / f"{uuid.uuid4()}_{Path(filename_raw).stem}{safe_suffix}"

            try:
                file.save(str(temp_path))
                is_valid, message, detected_type = legacy_manager.validate_file(str(temp_path), "image")
                if not is_valid or detected_type != "image":
                    errors.append(
                        {
                            "index": idx,
                            "filename": filename_raw,
                            "error": message or "Invalid file type",
                        }
                    )
                    continue

                result = legacy_manager.add_panorama_image(str(temp_path), caption)
                if not result:
                    errors.append(
                        {
                            "index": idx,
                            "filename": filename_raw,
                            "error": "Failed to process panorama",
                        }
                    )
                    continue

                panoramas.append(result)
            except Exception as exc:
                logger.warning("Panorama upload failed for %s: %s", filename_raw, exc)
                errors.append(
                    {
                        "index": idx,
                        "filename": filename_raw,
                        "error": str(exc),
                    }
                )
            finally:
                try:
                    temp_path.unlink(missing_ok=True)
                except Exception:
                    pass

        if not panoramas:
            raise bad_request(
                errors[0]["error"] if errors else "Failed to process panorama",
                details={"errors": errors},
            )

        duplicate_count = sum(1 for pano in panoramas if pano.get("is_duplicate"))
        uploaded_count = max(0, len(panoramas) - duplicate_count)

        return {
            "success": True,
            "panorama": panoramas[0],
            "panoramas": panoramas,
            "uploaded_count": uploaded_count,
            "duplicate_count": duplicate_count,
            "total_requested": len(valid_files),
            "total_processed": len(panoramas),
            "errors": errors,
        }

    def list_panoramas(self) -> Dict[str, Any]:
        """List standalone panoramas."""
        try:
            items = self._get_legacy_manager().get_all_panoramas()
            normalized_items: List[Dict[str, Any]] = []

            for item in items:
                record = dict(item)
                record_id = self._build_panorama_alert_id(
                    "standalone",
                    panorama_id=record.get("id"),
                    filename=record.get("filename"),
                    path=record.get("path"),
                )
                title = str(record.get("caption") or "").strip() or "360° Panorama"
                record.update(
                    {
                        "alert_id": record_id,
                        "name": title,
                        "source_type": "standalone",
                        "entity_type": "panorama",
                        "kind_label": "360° Panorama",
                    }
                )
                normalized_items.append(record)

            return {"panoramas": normalized_items}
        except Exception as exc:
            logger.error("Error fetching panoramas: %s", exc)
            raise APIError("Error fetching panoramas", "PANORAMA_LIST_ERROR", 500)

    def list_route_panoramas(self) -> Dict[str, Any]:
        """List geo-located route panoramas and panorama-capable route images."""
        try:
            try:
                from PIL import Image  # type: ignore
            except Exception:
                Image = None

            with self._get_database_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT route_id, file_path, thumbnail_path, caption, lat, lng, media_type, uploaded_at
                        FROM route_media
                        WHERE lat IS NOT NULL
                          AND lng IS NOT NULL
                          AND (media_type IS NULL OR media_type IN ('image', 'photo', 'panorama'))
                        ORDER BY uploaded_at DESC NULLS LAST
                        """
                    )
                    rows = cursor.fetchall() or []

            results: List[Dict[str, Any]] = []
            for row in rows:
                record = dict(row)
                rel_path = self._to_relative_media_path(record.get("file_path"))
                filename = Path(rel_path).name if rel_path else None

                file_path = Path(record.get("file_path")) if record.get("file_path") else None
                if file_path and not file_path.is_absolute():
                    file_path = Path.cwd() / file_path

                is_pano = False
                if Image and file_path and file_path.is_file():
                    try:
                        with Image.open(file_path) as image:
                            width, height = image.size
                            if height and 1.90 <= (float(width) / float(height)) <= 2.10 and width >= 1000:
                                is_pano = True
                    except Exception:
                        pass

                panorama_meta: Dict[str, Any] = {}
                if file_path:
                    try:
                        sidecar_path = file_path.with_suffix(".pano.json")
                        if sidecar_path.is_file():
                            with open(sidecar_path, "r", encoding="utf-8") as sidecar_file:
                                panorama_meta = json.load(sidecar_file) or {}
                    except Exception:
                        panorama_meta = {}

                original_path = panorama_meta.get("original_path")
                if isinstance(original_path, str):
                    original_path = self._to_relative_media_path(original_path)

                pyramid_levels = []
                for level in panorama_meta.get("pyramid_levels", []) or []:
                    if not isinstance(level, dict):
                        continue
                    normalized_level = dict(level)
                    normalized_level["path"] = self._to_relative_media_path(level.get("path"))
                    pyramid_levels.append(normalized_level)

                results.append(
                    {
                        "alert_id": self._build_panorama_alert_id(
                            "route",
                            route_id=record.get("route_id"),
                            filename=filename,
                            path=rel_path,
                        ),
                        "name": (record.get("caption") or "360° Panorama").strip() or "360° Panorama",
                        "route_id": record.get("route_id"),
                        "path": rel_path,
                        "caption": record.get("caption") or "",
                        "lat": float(record["lat"]) if record.get("lat") is not None else None,
                        "lng": float(record["lng"]) if record.get("lng") is not None else None,
                        "filename": filename,
                        "media_type": (
                            "image"
                            if (record.get("media_type") or "").lower() in ("photo", "image", "")
                            else record.get("media_type")
                        ),
                        "is_pano": is_pano,
                        "source_type": "route",
                        "entity_type": "panorama",
                        "kind_label": "360° Panorama",
                        "original_path": original_path,
                        "pyramid_levels": pyramid_levels,
                    }
                )

            return {"panoramas": results}
        except APIError:
            raise
        except Exception as exc:
            logger.error("Error fetching route panoramas: %s", exc)
            raise APIError("Error fetching route panoramas", "ROUTE_PANORAMA_LIST_ERROR", 500)

    @staticmethod
    def _parse_coordinate(value: Any) -> Optional[float]:
        try:
            coordinate = float(value)
        except (TypeError, ValueError):
            return None

        if not math.isfinite(coordinate):
            return None

        return coordinate

    @staticmethod
    def _calculate_haversine_distance_m(
        origin_lat: float,
        origin_lng: float,
        target_lat: float,
        target_lng: float,
    ) -> float:
        earth_radius_m = 6_371_000.0
        lat1 = math.radians(origin_lat)
        lng1 = math.radians(origin_lng)
        lat2 = math.radians(target_lat)
        lng2 = math.radians(target_lng)
        delta_lat = lat2 - lat1
        delta_lng = lng2 - lng1

        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
        )
        return 2 * earth_radius_m * math.asin(math.sqrt(haversine))

    @staticmethod
    def _build_panorama_alert_id(
        source_type: str,
        *,
        panorama_id: Any = None,
        route_id: Any = None,
        filename: Any = None,
        path: Any = None,
    ) -> str:
        normalized_source = str(source_type or "").strip().lower() or "standalone"
        existing_id = str(panorama_id or "").strip()
        if existing_id.startswith("panorama:") or existing_id.startswith("route-panorama:"):
            return existing_id

        if normalized_source == "standalone":
            base_id = existing_id
            if base_id:
                return f"panorama:{base_id}"

            fallback_stem = Path(str(path or filename or "panorama")).stem
            safe_fallback = secure_filename(fallback_stem) or "panorama"
            return f"panorama:{safe_fallback}"

        route_value = str(route_id or "").strip() or "unknown"
        stem = Path(str(filename or path or "panorama")).stem
        safe_stem = secure_filename(stem) or "panorama"
        return f"route-panorama:{route_value}:{safe_stem}"

    def search_nearby_panoramas(
        self,
        *,
        lat: float,
        lng: float,
        radius_m: int = 1000,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """List nearby standalone and route panoramas around a coordinate."""
        normalized_radius = max(50, min(int(radius_m), 10_000))
        normalized_limit = max(1, min(int(limit), 100))
        normalized_results: List[Dict[str, Any]] = []
        seen_ids = set()

        def add_result(item: Dict[str, Any], source_type: str) -> None:
            item_lat = self._parse_coordinate(item.get("lat"))
            item_lng = self._parse_coordinate(item.get("lng"))
            if item_lat is None or item_lng is None:
                return

            distance_m = self._calculate_haversine_distance_m(lat, lng, item_lat, item_lng)
            if distance_m > normalized_radius:
                return

            alert_id = self._build_panorama_alert_id(
                source_type,
                panorama_id=item.get("alert_id") or item.get("id"),
                route_id=item.get("route_id"),
                filename=item.get("filename"),
                path=item.get("path"),
            )
            if not alert_id or alert_id in seen_ids:
                return

            seen_ids.add(alert_id)
            normalized_distance_m = int(round(distance_m))

            title = str(item.get("caption") or "").strip()
            if not title:
                title = "360° Panorama"

            normalized_results.append(
                {
                    "id": alert_id,
                    "_id": alert_id,
                    "stable_id": alert_id,
                    "alert_id": alert_id,
                    "name": title,
                    "caption": str(item.get("caption") or "").strip(),
                    "entity_type": "panorama",
                    "source_type": source_type,
                    "latitude": item_lat,
                    "longitude": item_lng,
                    "lat": item_lat,
                    "lng": item_lng,
                    "distance_m": normalized_distance_m,
                    "path": self._to_relative_media_path(item.get("path")),
                    "original_path": self._to_relative_media_path(item.get("original_path")),
                    "pyramid_levels": item.get("pyramid_levels") if isinstance(item.get("pyramid_levels"), list) else [],
                    "filename": item.get("filename"),
                    "route_id": item.get("route_id"),
                    "kind_label": "360° Panorama",
                }
            )

        standalone_payload = self.list_panoramas()
        for panorama in standalone_payload.get("panoramas", []) or []:
            add_result(dict(panorama), "standalone")

        route_payload = self.list_route_panoramas()
        for panorama in route_payload.get("panoramas", []) or []:
            record = dict(panorama)
            is_pano = bool(record.get("is_pano")) or str(record.get("media_type") or "").strip().lower() == "panorama"
            if not is_pano:
                continue
            add_result(record, "route")

        normalized_results.sort(key=lambda item: (item.get("distance_m") or 0, item.get("name") or ""))
        limited_results = normalized_results[:normalized_limit]

        return {
            "center": {"lat": lat, "lng": lng},
            "radius_m": normalized_radius,
            "count": len(limited_results),
            "panoramas": limited_results,
        }

    def delete_panorama(self, pano_id: str) -> Dict[str, Any]:
        """Delete standalone panorama by identifier."""
        if not pano_id or len(str(pano_id)) < 6:
            raise bad_request("Invalid panorama id")

        try:
            success = self._get_legacy_manager().delete_panorama_by_id(str(pano_id))
            if success:
                return {"success": True}
            return {"success": True, "message": "Panorama not found or already deleted"}
        except Exception as exc:
            logger.error("Error deleting panorama %s: %s", pano_id, exc)
            raise APIError("Error deleting panorama", "PANORAMA_DELETE_ERROR", 500)

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
            legacy_manager = self._get_legacy_manager()
            items = legacy_manager.get_poi_media_by_id(str(poi_id), media_type)
            normalized_items: List[Dict[str, Any]] = []

            for item in items:
                normalized = dict(item)
                normalized.setdefault('poi_id', poi_id)
                normalized['file_path'] = normalized.get('path')
                normalized['thumbnail_path'] = normalized.get('preview_path')
                normalized.setdefault('description', normalized.get('caption', ''))
                normalized_items.append(normalized)

            if media_type in (None, "", "image"):
                existing_paths = {
                    item.get("path")
                    for item in normalized_items
                    if item.get("media_type") == "image" and item.get("path")
                }
                try:
                    with self._get_database_connection() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                SELECT
                                    to_jsonb(pi)->>'image_url' AS image_url,
                                    pi.thumbnail_url,
                                    pi.caption,
                                    pi.is_primary
                                FROM poi_images AS pi
                                WHERE pi.poi_id = %s
                                  AND COALESCE(
                                      NULLIF(to_jsonb(pi)->>'image_url', ''),
                                      NULLIF(pi.thumbnail_url, '')
                                  ) IS NOT NULL
                                ORDER BY pi.is_primary DESC, pi.id
                                """,
                                (poi_id,),
                            )
                            for row in cur.fetchall():
                                image_path = row.get("image_url") or row.get("thumbnail_url")
                                preview_path = row.get("thumbnail_url") or image_path
                                if not image_path or image_path in existing_paths:
                                    continue
                                filename = Path(image_path.split("?", 1)[0]).name or image_path
                                normalized_items.append({
                                    "poi_id": poi_id,
                                    "media_type": "image",
                                    "path": image_path,
                                    "preview_path": preview_path,
                                    "file_path": image_path,
                                    "thumbnail_path": preview_path,
                                    "filename": filename,
                                    "description": row.get("caption") or "",
                                    "caption": row.get("caption") or "",
                                    "is_primary": row.get("is_primary", False),
                                    "source": "poi_images",
                                })
                                existing_paths.add(image_path)
                except Exception as exc:
                    logger.warning("POI DB image media lookup failed for %s: %s", poi_id, exc)

            return normalized_items
            
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
