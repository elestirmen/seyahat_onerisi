"""
Flask App Factory for POI Travel Recommendation API
Modular application structure with proper configuration management.
"""

from flask import Flask
from flask_cors import CORS
import logging

# Import configuration
from .config.settings import get_config
from .config.database import init_database_pool

# Import middleware and extensions
from auth_middleware import auth_middleware
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
    # Apply config-specific validation/hooks (e.g. production checks)
    try:
        config.init_app(app)
    except Exception as e:
        logger.error(f"Config initialization failed: {e}")
        raise
    
    # Initialize CORS
    cors_origins = app.config.get('CORS_ORIGINS', ["*"])
    if isinstance(cors_origins, str):
        cors_origins = [origin.strip() for origin in cors_origins.split(',')]
    
    CORS(
        app,
        origins=cors_origins,
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization", "X-Admin-Token"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )
    
    # Initialize authentication middleware
    auth_middleware.init_app(app)
    
    # Initialize database pool
    try:
        db_pool = init_database_pool(config)
        if not app.config.get("TESTING") and getattr(db_pool, "pool", None) is None:
            raise RuntimeError("Database pool is unavailable")
    except Exception as _db_err:
        if app.config.get("TESTING"):
            logger.warning(f"Database pool initialization skipped in testing: {_db_err}")
        else:
            logger.error(f"Database pool initialization failed: {_db_err}")
            raise
    
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
    # Register modular blueprints first, then mount compatibility routes
    # that preserve legacy endpoint contracts on top of the same app.
    from .routes.health import health_bp
    from .routes.auth import auth_bp
    from .routes.poi import poi_bp
    from .routes.route import route_bp
    from .routes.route_import import route_import_bp
    from .routes.compat import compat_bp
    
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(poi_bp)
    app.register_blueprint(route_bp)
    app.register_blueprint(route_import_bp)
    app.register_blueprint(compat_bp)

    logger.info("Blueprints registered successfully")


# Export the factory function
__all__ = ['create_app']
