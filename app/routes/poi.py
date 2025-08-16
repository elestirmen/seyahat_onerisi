"""
POI Routes for POI Travel Recommendation API.
Handles all POI-related HTTP endpoints.
"""

from flask import Blueprint, request, jsonify
import logging

from app.services.poi_service import poi_service
from app.services.media_service import media_service
from app.middleware.error_handler import APIError, bad_request
from auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

# Create POI blueprint
poi_bp = Blueprint('poi', __name__, url_prefix='/api')


@poi_bp.route('/pois', methods=['GET'])
def list_pois():
    """
    List POIs with optional filtering and pagination.
    
    Query Parameters:
        - search: Search term for POI name/description
        - category: Filter by category
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
        - sort: Sort order (name_asc, name_desc, category_asc, created_desc, created_asc)
    """
    try:
        # Get query parameters
        search = request.args.get('search')
        category = request.args.get('category')
        
        # Parse pagination parameters
        try:
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 20))
        except (ValueError, TypeError):
            raise bad_request("Invalid page or limit parameter")
        
        # Parse sort parameter
        sort = request.args.get('sort', 'name_asc')
        
        # Call service
        result = poi_service.list_pois(
            search=search,
            category=category,
            page=page,
            limit=limit,
            sort=sort
        )
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in list_pois: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@poi_bp.route('/search', methods=['GET'])
def search_pois():
    """
    Advanced POI search with relevance scoring.
    
    Query Parameters:
        - q: Search query (required)
        - category: Filter by category (optional)
        - limit: Maximum results (default: 50, max: 100)
    """
    try:
        # Get query parameters
        query = request.args.get('q')
        if not query:
            raise bad_request("Search query parameter 'q' is required")
        
        category = request.args.get('category')
        
        try:
            limit = int(request.args.get('limit', 50))
        except (ValueError, TypeError):
            raise bad_request("Invalid limit parameter")
        
        # Call service
        result = poi_service.search_pois(
            query=query,
            category=category,
            limit=limit
        )
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in search_pois: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@poi_bp.route('/poi/<poi_id>', methods=['GET'])
def get_poi(poi_id):
    """
    Get single POI by ID.
    
    Path Parameters:
        - poi_id: POI identifier
    """
    try:
        if not poi_id:
            raise bad_request("POI ID is required")
        
        # Call service
        result = poi_service.get_poi(poi_id)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_poi: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@poi_bp.route('/poi', methods=['POST'])
@auth_middleware.require_auth
def add_poi():
    """
    Create new POI.
    
    Request Body:
        JSON with POI data (name, latitude, longitude required)
    """
    try:
        # Validate content type
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        poi_data = request.get_json()
        if not poi_data:
            raise bad_request("Request body is required")
        
        # Call service
        result = poi_service.create_poi(poi_data)
        
        return jsonify(result), 201
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in add_poi: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@poi_bp.route('/poi/<poi_id>', methods=['PUT'])
@auth_middleware.require_auth
def update_poi(poi_id):
    """
    Update existing POI.
    
    Path Parameters:
        - poi_id: POI identifier
        
    Request Body:
        JSON with POI data to update
    """
    try:
        if not poi_id:
            raise bad_request("POI ID is required")
        
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        poi_data = request.get_json()
        if not poi_data:
            raise bad_request("Request body is required")
        
        # Call service (to be implemented)
        # result = poi_service.update_poi(poi_id, poi_data)
        
        # Temporary placeholder - return existing POI
        result = poi_service.get_poi(poi_id)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_poi: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@poi_bp.route('/poi/<poi_id>', methods=['DELETE'])
@auth_middleware.require_auth
def delete_poi(poi_id):
    """
    Delete POI by ID.
    
    Path Parameters:
        - poi_id: POI identifier
    """
    try:
        if not poi_id:
            raise bad_request("POI ID is required")
        
        # Call service (to be implemented)
        # poi_service.delete_poi(poi_id)
        
        # Temporary placeholder
        return jsonify({
            'success': True,
            'message': f'POI {poi_id} would be deleted'
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_poi: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


# Additional POI endpoints can be added here as needed:
# - POI ratings endpoints
# - POI media endpoints  
# - POI search by rating
# etc.


# Export blueprint
__all__ = ['poi_bp']

# Media endpoints for POI (compat with legacy frontend)
@poi_bp.route('/poi/<poi_id>/media', methods=['GET'])
def get_poi_media(poi_id):
    """
    Get media for a POI grouped by type.

    Path Parameters:
        - poi_id: POI identifier

    Query Parameters (optional):
        - type: Filter by media type (image, video, audio, model_3d)

    Returns structure expected by legacy frontend:
    {
      "images": [...],
      "videos": [...],
      "audio": [...],
      "models": [...]
    }
    """
    try:
        if not poi_id:
            raise bad_request("POI ID is required")

        media_type = request.args.get('type')  # optional

        items = media_service.get_poi_media(int(poi_id), media_type)

        # Group by type to match frontend expectations
        grouped = {
            'images': [],
            'videos': [],
            'audio': [],
            'models': []
        }

        for m in items:
            mt = m.get('media_type')
            if mt == 'image':
                grouped['images'].append(m)
            elif mt == 'video':
                grouped['videos'].append(m)
            elif mt == 'audio':
                grouped['audio'].append(m)
            elif mt == 'model_3d':
                grouped['models'].append(m)

        return jsonify(grouped), 200

    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_poi_media: {e}")
        # Always return a safe structure to keep UI functioning
        return jsonify({'images': [], 'videos': [], 'audio': [], 'models': []}), 200
