"""
Configuration settings for POI Travel Recommendation API.
Environment-based configuration management with sensible defaults.
"""

import os
import secrets


DEFAULT_SECRET_KEY = secrets.token_urlsafe(48)


class Config:
    """Base configuration class with common settings."""
    
    # Flask Core Settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('POI_SESSION_SECRET_KEY') or DEFAULT_SECRET_KEY
    
    # Database Configuration
    DB_HOST = os.environ.get('DB_HOST') or os.environ.get('POI_DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT') or os.environ.get('POI_DB_PORT') or 5432)
    DB_NAME = os.environ.get('DB_NAME') or os.environ.get('POI_DB_NAME', 'poi_db')
    DB_USER = os.environ.get('DB_USER') or os.environ.get('POI_DB_USER', 'poi_user')
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or os.environ.get('POI_DB_PASSWORD', 'poi_password')
    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 10))
    DB_TIMEOUT = int(os.environ.get('DB_TIMEOUT', 30))
    
    # Admin Token (stateless auth)
    ADMIN_TOKEN = os.environ.get('POI_ADMIN_TOKEN', '')
    
    # CORS Configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    
    # Rate Limiting
    RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.environ.get('RATE_LIMIT_REQUESTS_PER_MINUTE', 100))
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))  # 100MB
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
        
        # Ensure admin token is configured in production
        token = (os.environ.get("POI_ADMIN_TOKEN") or "").strip()
        if len(token) < 16:
            raise ValueError("POI_ADMIN_TOKEN must be set (min 16 chars) in production")

        has_explicit_secret_key = bool(
            (os.environ.get("SECRET_KEY") or "").strip()
            or (os.environ.get("POI_SESSION_SECRET_KEY") or "").strip()
        )
        if not has_explicit_secret_key:
            raise ValueError("SECRET_KEY or POI_SESSION_SECRET_KEY must be set in production")

        secret_key = (app.config.get("SECRET_KEY") or "").strip()
        if len(secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters in production")


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
