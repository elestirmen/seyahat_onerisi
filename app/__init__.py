"""
Flask App Factory for POI Travel Recommendation API
Modular application structure with proper configuration management.
"""

from flask import Flask
from flask_cors import CORS
import logging
import os

# Import configuration
from .config.settings import get_config
from .config.database import init_database_pool, close_database_pool

# Import middleware and extensions
from auth_middleware import auth_middleware
from session_config import configure_session
from .middleware.error_handler import error_handler

# Global logger
logger = logging.getLogger(__name__)


def create_app(config_name=None):
    """
    Application factory function that creates and configures Flask app.
    
    Args:
        config_name (str): Configuration profile name ('development', 'production', 'testing')
                          If None, auto-detects from environment
    
    Returns:
        Flask: Configured Flask application instance
    """
    # Create Flask app instance
    app = Flask(__name__, 
                instance_relative_config=True,
                static_folder='../static',
                template_folder='../templates')
    
    # Load configuration
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Initialize CORS
    cors_origins = app.config.get('CORS_ORIGINS', ["*"])
    if isinstance(cors_origins, str):
        cors_origins = [origin.strip() for origin in cors_origins.split(',')]
    
    CORS(app, origins=cors_origins, supports_credentials=True)
    
    # Configure session management
    configure_session(app)
    
    # Initialize authentication middleware
    auth_middleware.init_app(app)
    
    # Initialize database pool
    init_database_pool(config)
    
    # Initialize error handler
    error_handler.init_app(app)
    
    # Configure logging
    configure_logging(app)
    
    # Register blueprints and routes
    register_blueprints(app)
    
    # Log successful initialization
    logger.info(f"Flask app created with config: {config.__class__.__name__}")
    
    return app


def configure_logging(app):
    """Configure application logging."""
    log_level = app.config.get('LOG_LEVEL', 'INFO')
    log_file = app.config.get('LOG_FILE', 'api.log')
    
    # Set logging level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )


def register_blueprints(app):
    """Register application blueprints and routes."""
    # Import all routes from main poi_api module
    # This will be done gradually to maintain compatibility
    
    # Register new modular blueprints FIRST (higher priority)
    from .routes.main import main_bp
    from .routes.poi import poi_bp
    from .routes.route import route_bp
    from .routes.route_import import route_import_bp
    from .routes.health import health_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(poi_bp)
    app.register_blueprint(route_bp)
    app.register_blueprint(route_import_bp)
    app.register_blueprint(health_bp)
    
    # Import and register blueprints (avoiding circular imports)
    # The main routes are still in poi_api.py and will be registered automatically
    # when poi_api.py is imported by the main application
    # Note: Blueprints registered first take precedence over later routes
    
    logger.info("Blueprints registered successfully (POI + Route)")


def register_error_handlers(app):
    """Register global error handlers."""
    
    @app.errorhandler(404)
    def not_found(error):
        return {
            'success': False,
            'error': 'Resource not found',
            'code': 'NOT_FOUND'
        }, 404
    
    @app.errorhandler(400)
    def bad_request(error):
        return {
            'success': False,
            'error': 'Bad request',
            'code': 'BAD_REQUEST'
        }, 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return {
            'success': False,
            'error': 'Authentication required',
            'code': 'UNAUTHORIZED'
        }, 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return {
            'success': False,
            'error': 'Access forbidden',
            'code': 'FORBIDDEN'
        }, 403
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return {
            'success': False,
            'error': 'Rate limit exceeded',
            'code': 'RATE_LIMIT_EXCEEDED'
        }, 429
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return {
            'success': False,
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR'
        }, 500
    
    logger.info("Error handlers registered successfully")


# Export the factory function
__all__ = ['create_app']
