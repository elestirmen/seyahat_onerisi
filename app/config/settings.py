"""
Configuration settings for POI Travel Recommendation API.
Environment-based configuration management with sensible defaults.
"""

import os
from datetime import timedelta


class Config:
    """Base configuration class with common settings."""
    
    # Flask Core Settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Database Configuration
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', 5432))
    DB_NAME = os.environ.get('DB_NAME', 'poi_database')
    DB_USER = os.environ.get('DB_USER', 'postgres')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 10))
    DB_TIMEOUT = int(os.environ.get('DB_TIMEOUT', 30))
    
    # Authentication Configuration
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH', '')
    SESSION_LIFETIME = int(os.environ.get('SESSION_LIFETIME', 86400))  # 24 hours
    
    # CORS Configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    
    # Rate Limiting
    RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.environ.get('RATE_LIMIT_REQUESTS_PER_MINUTE', 100))
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16777216))  # 16MB
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'temp_uploads')
    POI_MEDIA_FOLDER = os.environ.get('POI_MEDIA_FOLDER', 'poi_media')
    
    # Performance Settings
    ENABLE_CACHING = os.environ.get('ENABLE_CACHING', 'true').lower() == 'true'
    CACHE_TIMEOUT = int(os.environ.get('CACHE_TIMEOUT', 300))  # 5 minutes
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', 'api.log')
    
    # Testing Configuration
    TEST_MODE = os.environ.get('TEST_MODE', 'false').lower() == 'true'
    
    @property
    def database_url(self):
        """Construct database URL from components."""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @classmethod
    def init_app(cls, app):
        """Initialize application with this configuration."""
        pass


class DevelopmentConfig(Config):
    """Development configuration."""
    
    DEBUG = True
    FLASK_ENV = 'development'
    
    # More verbose logging in development
    LOG_LEVEL = 'DEBUG'
    
    # Relaxed CORS for development
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:8080')
    
    # Lower rate limits for easier testing
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.environ.get('RATE_LIMIT_REQUESTS_PER_MINUTE', 200))


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False
    FLASK_ENV = 'production'
    
    # Strict CORS in production
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '')  # Must be explicitly set
    
    # Stricter rate limits
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.environ.get('RATE_LIMIT_REQUESTS_PER_MINUTE', 60))
    
    # Production security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    @classmethod
    def init_app(cls, app):
        """Production-specific initialization."""
        Config.init_app(app)
        
        # Ensure critical settings are configured
        if not app.config.get('SECRET_KEY') or app.config['SECRET_KEY'] == 'dev-secret-key-change-in-production':
            raise ValueError("SECRET_KEY must be set in production")
        
        if not app.config.get('ADMIN_PASSWORD_HASH'):
            raise ValueError("ADMIN_PASSWORD_HASH must be set in production")


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    DEBUG = True
    
    # Use in-memory or test database
    DB_NAME = os.environ.get('TEST_DB_NAME', 'poi_test')
    
    # Disable CSRF for testing
    WTF_CSRF_ENABLED = False
    
    # Fast sessions for testing
    SESSION_LIFETIME = 3600  # 1 hour
    
    # Disable rate limiting in tests
    RATE_LIMIT_ENABLED = False
    
    # Test-specific folders
    UPLOAD_FOLDER = 'test_uploads'
    POI_MEDIA_FOLDER = 'test_media'


# Configuration registry
config_registry = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name=None):
    """
    Get configuration class based on environment.
    
    Args:
        config_name (str): Configuration name or None for auto-detection
        
    Returns:
        Config: Configuration class instance
    """
    if config_name is None:
        # Auto-detect from environment
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    # Map environment names to config names
    env_mapping = {
        'development': 'development',
        'dev': 'development',
        'production': 'production',
        'prod': 'production',
        'testing': 'testing',
        'test': 'testing'
    }
    
    config_name = env_mapping.get(config_name.lower(), config_name.lower())
    
    config_class = config_registry.get(config_name, config_registry['default'])
    
    return config_class()
