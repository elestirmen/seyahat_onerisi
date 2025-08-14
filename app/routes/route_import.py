"""
Route Import Routes for POI Travel Recommendation API.
Handles route file upload, validation, and import endpoints.
"""

from flask import Blueprint, request, jsonify
import logging
import uuid

from app.services.route_import_service import route_import_service
from app.middleware.error_handler import APIError, bad_request

def not_found(message, details=None):
    raise APIError(message, "NOT_FOUND", 404, details)
from auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

# Create Route Import blueprint
route_import_bp = Blueprint('route_import', __name__, url_prefix='/api/routes')


@route_import_bp.route('/import', methods=['POST'])
@auth_middleware.require_auth
def upload_route_file():
    """
    Upload and validate route file (GPX, KML, KMZ).
    
    Form Data:
        - file: Route file to upload
        
    Returns:
        JSON response with upload status and validation results
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            raise bad_request('No file provided', details={'error_code': 'NO_FILE'})
        
        file = request.files['file']
        if not file or not file.filename:
            raise bad_request('No file selected', details={'error_code': 'NO_FILE_SELECTED'})
        
        # Import route file
        result = route_import_service.import_route_file(file)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_route_file: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_import_bp.route('/import/progress/<upload_id>', methods=['GET'])
@auth_middleware.require_auth
def get_import_progress(upload_id):
    """
    Get real-time upload progress.
    
    Path Parameters:
        - upload_id: Upload identifier
        
    Returns:
        JSON response with progress information
    """
    try:
        if not upload_id:
            raise bad_request("Upload ID is required")
        
        # Get progress
        progress = route_import_service.get_progress(upload_id)
        
        if not progress:
            raise not_found(f"Upload progress not found for ID: {upload_id}")
        
        return jsonify({
            'upload_id': upload_id,
            'progress': progress
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_import_progress: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_import_bp.route('/import/confirm', methods=['POST'])
@auth_middleware.require_auth
def confirm_route_import():
    """
    Confirm and save imported route to database.
    
    Request Body:
        JSON with import confirmation data:
        - upload_id: Upload identifier
        - route_name: Custom route name
        - route_description: Custom description
        - route_type: Route type (hiking, cycling, driving, etc.)
        - associate_pois: List of POI IDs to associate (optional)
        
    Returns:
        JSON response with confirmation status
    """
    try:
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        data = request.get_json()
        if not data:
            raise bad_request("Request body is required")
        
        # Validate required fields
        upload_id = data.get('upload_id')
        if not upload_id:
            raise bad_request("upload_id is required")
        
        route_name = data.get('route_name', '').strip()
        if not route_name:
            raise bad_request("route_name is required")
        
        # Get import progress
        progress = route_import_service.get_progress(upload_id)
        if not progress:
            raise not_found(f"Upload not found: {upload_id}")
        
        if progress.get('status') != 'completed':
            raise bad_request("Import must be completed before confirmation")
        
        # TODO: Implement actual route saving to database
        # This would involve:
        # 1. Create route record in database
        # 2. Save geometry data
        # 3. Associate with POIs if specified
        # 4. Clean up temporary files
        
        # For now, return success response
        confirmation_result = {
            'success': True,
            'message': 'Route import confirmed successfully',
            'upload_id': upload_id,
            'route_name': route_name,
            'route_description': data.get('route_description', ''),
            'route_type': data.get('route_type', 'hiking'),
            'associate_pois': data.get('associate_pois', []),
            'confirmed_at': route_import_service.progress_tracking[upload_id]['timestamp'] if upload_id in route_import_service.progress_tracking else None
        }
        
        # Clean up progress tracking (but keep temp file for now in real implementation)
        # route_import_service.cleanup_upload(upload_id)
        
        return jsonify(confirmation_result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in confirm_route_import: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_import_bp.route('/import/cancel', methods=['POST'])
@auth_middleware.require_auth
def cancel_route_import():
    """
    Cancel import and cleanup temporary files.
    
    Request Body:
        JSON with cancellation data:
        - upload_id: Upload identifier
        
    Returns:
        JSON response with cancellation status
    """
    try:
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        data = request.get_json()
        if not data:
            raise bad_request("Request body is required")
        
        upload_id = data.get('upload_id')
        if not upload_id:
            raise bad_request("upload_id is required")
        
        # Get progress to check if upload exists
        progress = route_import_service.get_progress(upload_id)
        if not progress:
            raise not_found(f"Upload not found: {upload_id}")
        
        # Clean up upload
        temp_file_path = progress.get('temp_file_path')  # If stored in progress
        route_import_service.cleanup_upload(upload_id, temp_file_path)
        
        return jsonify({
            'success': True,
            'message': 'Import cancelled and cleaned up successfully',
            'upload_id': upload_id
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in cancel_route_import: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_import_bp.route('/import/validate', methods=['POST'])
@auth_middleware.require_auth
def validate_route_file():
    """
    Validate route file without importing.
    
    Form Data:
        - file: Route file to validate
        
    Returns:
        JSON response with validation results
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            raise bad_request('No file provided', details={'error_code': 'NO_FILE'})
        
        file = request.files['file']
        if not file or not file.filename:
            raise bad_request('No file selected', details={'error_code': 'NO_FILE_SELECTED'})
        
        # Validate file only
        validation_result = route_import_service.validate_file(file)
        
        return jsonify({
            'success': validation_result['is_valid'],
            'validation_result': validation_result,
            'message': 'File validation completed'
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in validate_route_file: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


# Export blueprint
__all__ = ['route_import_bp']
