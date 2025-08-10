"""
Session configuration module for Flask application.
Provides secure session setup with proper security headers.
"""

from flask import Flask
from flask_session import Session
from auth_config import auth_config
import os
import tempfile

def configure_session(app: Flask):
    """
    Configure Flask session with secure settings.
    
    Args:
        app: Flask application instance
    """
    
    # Session configuration
    app.config['SECRET_KEY'] = auth_config.SECRET_KEY
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_FILE_DIR'] = os.path.join(tempfile.gettempdir(), 'poi_sessions')
    app.config['SESSION_PERMANENT'] = False
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_KEY_PREFIX'] = 'poi_session:'
    
    # Cookie security settings
    app.config['SESSION_COOKIE_SECURE'] = auth_config.SESSION_COOKIE_SECURE
    app.config['SESSION_COOKIE_HTTPONLY'] = auth_config.SESSION_COOKIE_HTTPONLY
    app.config['SESSION_COOKIE_SAMESITE'] = auth_config.SESSION_COOKIE_SAMESITE
    app.config['SESSION_COOKIE_NAME'] = 'poi_session'
    
    # Initialize Flask-Session
    Session(app)
    
    # Ensure session directory exists
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
    
    return app

def add_security_headers(app: Flask):
    """
    Add security headers to all responses.
    
    Args:
        app: Flask application instance
    """
    
    @app.after_request
    def set_security_headers(response):
        """Add security headers to every response."""
        headers = auth_config.get_security_headers()
        
        for header, value in headers.items():
            response.headers[header] = value
        
        return response
    
    return app

def setup_secure_session(app: Flask):
    """
    Complete session setup with security configurations.
    
    Args:
        app: Flask application instance
        
    Returns:
        Flask app with configured session and security headers
    """
    
    # Configure session
    app = configure_session(app)
    
    # Add security headers
    app = add_security_headers(app)
    
    return app