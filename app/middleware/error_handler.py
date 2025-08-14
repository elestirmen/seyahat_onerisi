"""
Standardized error handling middleware for POI Travel Recommendation API.
Consistent JSON error responses with proper HTTP status codes.
"""

import logging
import traceback
import time
from flask import jsonify, request, current_app
from werkzeug.exceptions import HTTPException
from psycopg2 import Error as PostgreSQLError
from typing import Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Custom API error with structured information."""
    
    def __init__(self, message: str, code: str = "API_ERROR", status_code: int = 400, details: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ErrorHandler:
    """Centralized error handling for the application."""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize error handling for Flask app."""
        self.app = app
        
        # Register error handlers
        app.register_error_handler(APIError, self.handle_api_error)
        app.register_error_handler(HTTPException, self.handle_http_error)
        app.register_error_handler(PostgreSQLError, self.handle_database_error)
        app.register_error_handler(ValueError, self.handle_validation_error)
        app.register_error_handler(KeyError, self.handle_missing_key_error)
        app.register_error_handler(Exception, self.handle_generic_error)
        
        # Register request logging
        app.before_request(self.log_request)
        app.after_request(self.log_response)
        
        logger.info("Error handler initialized")
    
    def log_request(self):
        """Log incoming requests."""
        if not current_app.config.get('LOG_REQUESTS', True):
            return
        
        # Skip health check spam
        if request.path == '/health':
            return
        
        logger.info(
            f"Request: {request.method} {request.path} "
            f"from {request.remote_addr} "
            f"User-Agent: {request.headers.get('User-Agent', 'Unknown')}"
        )
    
    def log_response(self, response):
        """Log responses."""
        if not current_app.config.get('LOG_RESPONSES', True):
            return response
        
        # Skip health check spam
        if request.path == '/health':
            return response
        
        logger.info(
            f"Response: {request.method} {request.path} "
            f"Status: {response.status_code} "
            f"Size: {response.content_length or 0} bytes"
        )
        
        return response
    
    def create_error_response(self, message: str, code: str, status_code: int, 
                            details: Optional[Dict] = None, request_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create standardized error response.
        
        Args:
            message: Human-readable error message
            code: Machine-readable error code
            status_code: HTTP status code
            details: Additional error details
            request_id: Request identifier for tracking
            
        Returns:
            dict: Standardized error response
        """
        error_response = {
            'success': False,
            'error': message,
            'code': code,
            'timestamp': time.time(),
            'path': request.path if request else None
        }
        
        if details:
            error_response['details'] = details
        
        if request_id:
            error_response['request_id'] = request_id
        
        # Add debug information in development
        if current_app and current_app.config.get('DEBUG', False):
            error_response['debug'] = {
                'method': request.method if request else None,
                'args': dict(request.args) if request else None,
                'headers': dict(request.headers) if request else None
            }
        
        return error_response
    
    def handle_api_error(self, error: APIError) -> Tuple[Dict[str, Any], int]:
        """Handle custom API errors."""
        logger.warning(f"API Error: {error.code} - {error.message}")
        
        response = self.create_error_response(
            message=error.message,
            code=error.code,
            status_code=error.status_code,
            details=error.details
        )
        
        return jsonify(response), error.status_code
    
    def handle_http_error(self, error: HTTPException) -> Tuple[Dict[str, Any], int]:
        """Handle HTTP errors (4xx, 5xx)."""
        code_mapping = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED", 
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "RATE_LIMIT_EXCEEDED",
            500: "INTERNAL_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE"
        }
        
        error_code = code_mapping.get(error.code, "HTTP_ERROR")
        
        logger.warning(f"HTTP Error: {error.code} - {error.description}")
        
        response = self.create_error_response(
            message=error.description or "HTTP Error",
            code=error_code,
            status_code=error.code
        )
        
        return jsonify(response), error.code
    
    def handle_database_error(self, error: PostgreSQLError) -> Tuple[Dict[str, Any], int]:
        """Handle PostgreSQL database errors."""
        logger.error(f"Database Error: {error}")
        
        # Map common PostgreSQL errors
        error_message = "Database operation failed"
        error_code = "DATABASE_ERROR"
        status_code = 500
        
        if "connection" in str(error).lower():
            error_message = "Database connection failed"
            error_code = "DATABASE_CONNECTION_ERROR"
            status_code = 503
        elif "timeout" in str(error).lower():
            error_message = "Database operation timed out"
            error_code = "DATABASE_TIMEOUT"
            status_code = 504
        elif "duplicate" in str(error).lower():
            error_message = "Duplicate entry"
            error_code = "DUPLICATE_ENTRY"
            status_code = 409
        
        response = self.create_error_response(
            message=error_message,
            code=error_code,
            status_code=status_code,
            details={'database_error': str(error)} if current_app.config.get('DEBUG') else None
        )
        
        return jsonify(response), status_code
    
    def handle_validation_error(self, error: ValueError) -> Tuple[Dict[str, Any], int]:
        """Handle validation errors."""
        logger.warning(f"Validation Error: {error}")
        
        response = self.create_error_response(
            message=str(error),
            code="VALIDATION_ERROR",
            status_code=400
        )
        
        return jsonify(response), 400
    
    def handle_missing_key_error(self, error: KeyError) -> Tuple[Dict[str, Any], int]:
        """Handle missing key errors (usually missing request parameters)."""
        logger.warning(f"Missing Key Error: {error}")
        
        response = self.create_error_response(
            message=f"Missing required parameter: {str(error)}",
            code="MISSING_PARAMETER",
            status_code=400,
            details={'missing_key': str(error)}
        )
        
        return jsonify(response), 400
    
    def handle_generic_error(self, error: Exception) -> Tuple[Dict[str, Any], int]:
        """Handle unexpected errors."""
        error_id = f"error_{int(time.time())}"
        
        logger.error(f"Unexpected Error [{error_id}]: {error}")
        logger.error(f"Traceback [{error_id}]: {traceback.format_exc()}")
        
        # Don't expose internal errors in production
        if current_app.config.get('DEBUG', False):
            message = str(error)
            details = {'traceback': traceback.format_exc()}
        else:
            message = "An unexpected error occurred"
            details = {'error_id': error_id}
        
        response = self.create_error_response(
            message=message,
            code="INTERNAL_ERROR",
            status_code=500,
            details=details,
            request_id=error_id
        )
        
        return jsonify(response), 500


# Commonly used error creators
def bad_request(message: str, details: Optional[Dict] = None) -> APIError:
    """Create a bad request error."""
    return APIError(message, "BAD_REQUEST", 400, details)


def unauthorized(message: str = "Authentication required") -> APIError:
    """Create an unauthorized error."""
    return APIError(message, "UNAUTHORIZED", 401)


def forbidden(message: str = "Access forbidden") -> APIError:
    """Create a forbidden error."""
    return APIError(message, "FORBIDDEN", 403)


def not_found(message: str = "Resource not found") -> APIError:
    """Create a not found error."""
    return APIError(message, "NOT_FOUND", 404)


def conflict(message: str, details: Optional[Dict] = None) -> APIError:
    """Create a conflict error."""
    return APIError(message, "CONFLICT", 409, details)


def rate_limit_exceeded(message: str = "Rate limit exceeded") -> APIError:
    """Create a rate limit exceeded error."""
    return APIError(message, "RATE_LIMIT_EXCEEDED", 429)


def internal_error(message: str = "Internal server error") -> APIError:
    """Create an internal server error."""
    return APIError(message, "INTERNAL_ERROR", 500)


# Global error handler instance
error_handler = ErrorHandler()
