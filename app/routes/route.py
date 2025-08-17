"""
Route Routes for POI Travel Recommendation API.
Handles all route-related HTTP endpoints.
"""

from flask import Blueprint, request, jsonify
import logging

from app.services.route_service import route_service
from app.middleware.error_handler import APIError, bad_request
from auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

# Create Route blueprint
route_bp = Blueprint('route', __name__, url_prefix='/api')


@route_bp.route('/routes', methods=['GET'])
def list_routes():
    """
    List routes with optional filtering and pagination.
    
    Query Parameters:
        - search: Search term for route name/description
        - route_type: Filter by route type (hiking, cultural, cycling, etc.)
        - is_active: Filter by active status (true/false)
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
    """
    try:
        # Get query parameters
        search = request.args.get('search')
        route_type = request.args.get('route_type')
        
        # Parse boolean is_active parameter
        is_active = request.args.get('is_active')
        if is_active is not None:
            is_active = is_active.lower() in ('true', '1', 'yes')
        
        # Parse pagination parameters
        try:
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 20))
        except (ValueError, TypeError):
            raise bad_request("Invalid page or limit parameter")
        
        # Call service
        result = route_service.list_routes(
            page=page,
            limit=limit,
            search=search,
            route_type=route_type,
            is_active=is_active
        )
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in list_routes: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/routes/<int:route_id>', methods=['GET'])
def get_route(route_id):
    """
    Get route by ID.
    
    Path Parameters:
        - route_id: Route identifier
    """
    try:
        if not route_id:
            raise bad_request("Route ID is required")
        
        # Call service
        result = route_service.get_route(route_id)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_route: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/routes/search', methods=['GET'])
def search_routes():
    """
    Search routes by name or description.
    
    Query Parameters:
        - q: Search query (required)
        - route_type: Filter by route type
        - limit: Maximum results (default: 50, max: 100)
    """
    try:
        # Get query parameters
        query = request.args.get('q', '').strip()
        route_type = request.args.get('route_type')
        
        if not query:
            raise bad_request("Search query 'q' is required")
        
        # Parse limit parameter
        try:
            limit = int(request.args.get('limit', 50))
        except (ValueError, TypeError):
            raise bad_request("Invalid limit parameter")
        
        # Call service
        result = route_service.search_routes(
            query=query,
            route_type=route_type,
            limit=limit
        )
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in search_routes: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/routes/statistics', methods=['GET'])
def get_route_statistics():
    """
    Get route statistics.
    
    Returns general statistics about routes in the system.
    """
    try:
        # Call service
        result = route_service.get_route_statistics()
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_route_statistics: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/routes/<int:route_id>/geometry', methods=['GET'])
def get_route_geometry(route_id):
    """
    Get route geometry (coordinates).
    
    Path Parameters:
        - route_id: Route identifier
    """
    try:
        if not route_id:
            raise bad_request("Route ID is required")
        
        # Get route first to ensure it exists
        route = route_service.get_route(route_id)
        
        # Extract geometry if available
        geometry = route.get('geometry')
        if not geometry:
            return jsonify({
                'route_id': route_id,
                'geometry': None,
                'message': 'No geometry data available for this route'
            }), 200
        
        return jsonify({
            'route_id': route_id,
            'geometry': geometry
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_route_geometry: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


# Route media endpoints


@route_bp.route('/routes/<int:route_id>/media', methods=['GET'])
def list_route_media(route_id):
    """Get media files for a route."""
    try:
        if not route_id:
            raise bad_request("Route ID is required")

        media = route_service.list_route_media(route_id)
        return jsonify({'route_id': route_id, 'media': media}), 200

    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in list_route_media: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


# Admin endpoints (require authentication)
@route_bp.route('/admin/routes', methods=['GET'])
@auth_middleware.require_auth
def admin_list_routes():
    """
    Admin: List all routes including inactive ones.
    
    Query Parameters:
        - search: Search term for route name/description
        - route_type: Filter by route type
        - is_active: Filter by active status (true/false)
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
    """
    try:
        # Get query parameters (similar to public endpoint but includes inactive routes)
        search = request.args.get('search')
        route_type = request.args.get('route_type')
        
        # Parse boolean is_active parameter (admin can see both active and inactive)
        is_active = request.args.get('is_active')
        if is_active is not None:
            is_active = is_active.lower() in ('true', '1', 'yes')
        
        # Parse pagination parameters
        try:
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 20))
        except (ValueError, TypeError):
            raise bad_request("Invalid page or limit parameter")
        
        # Call service
        result = route_service.list_routes(
            page=page,
            limit=limit,
            search=search,
            route_type=route_type,
            is_active=is_active  # Admin can filter by active status
        )
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_list_routes: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/admin/routes/<int:route_id>', methods=['GET'])
@auth_middleware.require_auth
def admin_get_route(route_id):
    """
    Admin: Get route by ID including all details.
    
    Path Parameters:
        - route_id: Route identifier
    """
    try:
        if not route_id:
            raise bad_request("Route ID is required")
        
        # Call service (same as public but admin context)
        result = route_service.get_route(route_id)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_get_route: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/admin/routes/<int:route_id>/media', methods=['POST'])
@auth_middleware.require_auth
def admin_add_route_media(route_id):
    """Admin: Upload media for a route."""
    try:
        if 'file' not in request.files:
            raise bad_request("File is required")

        file = request.files['file']
        caption = request.form.get('caption')
        is_primary = request.form.get('is_primary', 'false').lower() in ('true', '1', 'yes')
        lat = request.form.get('lat')
        lng = request.form.get('lng')

        if lat or lng:
            if not (lat and lng):
                raise bad_request("lat and lng must be provided together")
            try:
                lat_val = float(lat)
                lng_val = float(lng)
            except (TypeError, ValueError):
                raise bad_request("Invalid lat or lng")
            if not (-90 <= lat_val <= 90 and -180 <= lng_val <= 180):
                raise bad_request("lat/lng out of range")
            lat, lng = lat_val, lng_val
        else:
            lat = lng = None

        result = route_service.add_route_media(route_id, file, lat, lng, caption, is_primary)
        return jsonify(result), 201

    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_add_route_media: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/admin/routes', methods=['POST'])
@auth_middleware.require_auth
def admin_create_route():
    """
    Admin: Create new route.
    
    Request Body:
        JSON with route data
    """
    try:
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        route_data = request.get_json()
        if not route_data:
            raise bad_request("Request body is required")
        
        # TODO: Implement route creation in service
        # result = route_service.create_route(route_data)
        
        # Temporary placeholder
        return jsonify({
            'success': True,
            'message': 'Route creation endpoint - implementation pending',
            'data': route_data
        }), 201
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_create_route: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/admin/routes/<int:route_id>', methods=['PUT'])
@auth_middleware.require_auth
def admin_update_route(route_id):
    """
    Admin: Update existing route.
    
    Path Parameters:
        - route_id: Route identifier
        
    Request Body:
        JSON with route data to update
    """
    try:
        if not route_id:
            raise bad_request("Route ID is required")
        
        if not request.is_json:
            raise bad_request("Request must be JSON")
        
        route_data = request.get_json()
        if not route_data:
            raise bad_request("Request body is required")
        
        # TODO: Implement route update in service
        # result = route_service.update_route(route_id, route_data)
        
        # Temporary placeholder - return existing route
        result = route_service.get_route(route_id)
        
        return jsonify(result), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_update_route: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


@route_bp.route('/admin/routes/<int:route_id>', methods=['DELETE'])
@auth_middleware.require_auth
def admin_delete_route(route_id):
    """
    Admin: Delete route by ID.
    
    Path Parameters:
        - route_id: Route identifier
    """
    try:
        if not route_id:
            raise bad_request("Route ID is required")
        
        # TODO: Implement route deletion in service
        # route_service.delete_route(route_id)
        
        # Temporary placeholder
        return jsonify({
            'success': True,
            'message': f'Route {route_id} would be deleted'
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in admin_delete_route: {e}")
        raise APIError("Internal server error", "INTERNAL_ERROR", 500)


# Export blueprint
__all__ = ['route_bp']
