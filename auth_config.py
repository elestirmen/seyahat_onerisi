"""
Authentication configuration module for POI management system.
Handles environment variables and secure configuration settings with validation.
"""

import os
import sys
import secrets
import bcrypt
import logging
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConfigurationError(Exception):
    """Custom exception for configuration errors."""
    pass

class AuthConfig:
    """Authentication configuration class with environment variable support and validation."""
    
    def __init__(self, validate_on_init: bool = True):
        """Initialize authentication configuration with secure defaults."""
        self.validation_errors = []
        self.warnings = []
        
        # Configuration validation rules
        self.validation_rules = {
            'POI_MAX_LOGIN_ATTEMPTS': {'min': 3, 'max': 10, 'type': int, 'required': False},
            'POI_LOCKOUT_DURATION': {'min': 300, 'max': 3600, 'type': int, 'required': False},
            'POI_BCRYPT_ROUNDS': {'min': 10, 'max': 15, 'type': int, 'required': False},
            'POI_SESSION_TIMEOUT': {'min': 300, 'max': 86400, 'type': int, 'required': False},
            'POI_REMEMBER_TIMEOUT': {'min': 3600, 'max': 2592000, 'type': int, 'required': False},
            'POI_SESSION_SECRET_KEY': {'min_length': 32, 'type': str, 'required': True},
            'POI_ADMIN_PASSWORD_HASH': {'pattern': r'^\$2b\$', 'type': str, 'required': True},
            'POI_SESSION_SECURE': {'values': ['True', 'False'], 'type': str, 'required': False}
        }
        
        self.load_config()
        
        if validate_on_init:
            self.validate_configuration()
            if self.validation_errors:
                self._handle_validation_errors()
    
    def load_config(self):
        """Load configuration from environment variables with secure defaults."""
        try:
            # Security configuration (load first as it's needed for password hashing)
            self.MAX_LOGIN_ATTEMPTS = self._get_int_config('POI_MAX_LOGIN_ATTEMPTS', 5, 3, 10)
            self.LOCKOUT_DURATION = self._get_int_config('POI_LOCKOUT_DURATION', 900, 300, 3600)
            self.BCRYPT_ROUNDS = self._get_int_config('POI_BCRYPT_ROUNDS', 12, 10, 15)
            
            # Session configuration
            self.SECRET_KEY = self._get_secret_key()
            self.SESSION_TIMEOUT = self._get_int_config('POI_SESSION_TIMEOUT', 7200, 300, 86400)
            self.REMEMBER_TIMEOUT = self._get_int_config('POI_REMEMBER_TIMEOUT', 604800, 3600, 2592000)
            
            # Password configuration (load after BCRYPT_ROUNDS is set)
            self.PASSWORD_HASH = self._get_password_hash()
            
            # Session security settings
            self.SESSION_COOKIE_SECURE = self._get_bool_config('POI_SESSION_SECURE', True)
            self.SESSION_COOKIE_HTTPONLY = True
            self.SESSION_COOKIE_SAMESITE = 'Strict'
            
            logger.info("Authentication configuration loaded successfully")
            
        except Exception as e:
            error_msg = f"Failed to load authentication configuration: {e}"
            logger.error(error_msg)
            raise ConfigurationError(error_msg)
    
    def _get_int_config(self, key: str, default: int, min_val: int, max_val: int) -> int:
        """Get and validate integer configuration value."""
        try:
            value = int(os.getenv(key, str(default)))
            if value < min_val or value > max_val:
                self.warnings.append(f"{key} value {value} is outside recommended range [{min_val}-{max_val}], using default {default}")
                return default
            return value
        except ValueError:
            self.validation_errors.append(f"{key} must be a valid integer")
            return default
    
    def _get_bool_config(self, key: str, default: bool) -> bool:
        """Get and validate boolean configuration value."""
        value = os.getenv(key, str(default)).lower()
        if value in ['true', '1', 'yes', 'on']:
            return True
        elif value in ['false', '0', 'no', 'off']:
            return False
        else:
            self.warnings.append(f"{key} has invalid boolean value '{value}', using default {default}")
            return default
    
    def _get_secret_key(self) -> str:
        """Get or generate session secret key with validation."""
        secret_key = os.getenv('POI_SESSION_SECRET_KEY')
        
        if not secret_key:
            secret_key = self._generate_secret_key()
            self.warnings.append("POI_SESSION_SECRET_KEY not found, generated temporary key. Set this in production!")
        elif len(secret_key) < 32:
            self.validation_errors.append("POI_SESSION_SECRET_KEY must be at least 32 characters long")
            secret_key = self._generate_secret_key()
        
        return secret_key
    
    def _get_password_hash(self) -> str:
        """Get or generate password hash with validation."""
        password_hash = os.getenv('POI_ADMIN_PASSWORD_HASH')
        
        if not password_hash:
            password_hash = self._generate_default_password_hash()
            self.warnings.append("POI_ADMIN_PASSWORD_HASH not found, generated default password")
        elif not password_hash.startswith('$2b$'):
            self.validation_errors.append("POI_ADMIN_PASSWORD_HASH must be a valid bcrypt hash")
            password_hash = self._generate_default_password_hash()
        
        return password_hash
    
    def validate_configuration(self) -> bool:
        """Validate all configuration values."""
        self.validation_errors = []
        self.warnings = []
        
        # Validate each configuration value
        for key, rules in self.validation_rules.items():
            value = os.getenv(key)
            
            # Check required fields
            if rules.get('required', False) and not value:
                self.validation_errors.append(f"Required configuration {key} is missing")
                continue
            
            if not value:
                continue
            
            # Type validation
            if rules['type'] == int:
                try:
                    int_value = int(value)
                    if 'min' in rules and int_value < rules['min']:
                        self.validation_errors.append(f"{key} must be at least {rules['min']}")
                    if 'max' in rules and int_value > rules['max']:
                        self.validation_errors.append(f"{key} must be at most {rules['max']}")
                except ValueError:
                    self.validation_errors.append(f"{key} must be a valid integer")
            
            elif rules['type'] == str:
                if 'min_length' in rules and len(value) < rules['min_length']:
                    self.validation_errors.append(f"{key} must be at least {rules['min_length']} characters long")
                
                if 'pattern' in rules:
                    import re
                    if not re.match(rules['pattern'], value):
                        self.validation_errors.append(f"{key} does not match required pattern")
                
                if 'values' in rules and value not in rules['values']:
                    self.validation_errors.append(f"{key} must be one of: {', '.join(rules['values'])}")
        
        # Additional validation logic
        self._validate_security_settings()
        
        return len(self.validation_errors) == 0
    
    def _validate_security_settings(self):
        """Validate security-specific settings."""
        # Check session timeout vs remember timeout
        if self.SESSION_TIMEOUT >= self.REMEMBER_TIMEOUT:
            self.warnings.append("SESSION_TIMEOUT should be less than REMEMBER_TIMEOUT")
        
        # Check bcrypt rounds for performance
        if self.BCRYPT_ROUNDS > 13:
            self.warnings.append("High bcrypt rounds may impact performance")
        
        # Check secure cookie settings
        if not self.SESSION_COOKIE_SECURE:
            self.warnings.append("SESSION_COOKIE_SECURE is disabled - only use in development")
    
    def _handle_validation_errors(self):
        """Handle validation errors based on severity."""
        # Log warnings
        for warning in self.warnings:
            logger.warning(f"Configuration warning: {warning}")
        
        # Handle errors
        if self.validation_errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in self.validation_errors)
            logger.error(error_msg)
            
            # In production, fail fast
            if os.getenv('DEBUG', 'False').lower() != 'true':
                raise ConfigurationError(error_msg)
            else:
                logger.warning("Running in debug mode, continuing with invalid configuration")
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration (excluding sensitive data)."""
        return {
            'MAX_LOGIN_ATTEMPTS': self.MAX_LOGIN_ATTEMPTS,
            'LOCKOUT_DURATION': self.LOCKOUT_DURATION,
            'BCRYPT_ROUNDS': self.BCRYPT_ROUNDS,
            'SESSION_TIMEOUT': self.SESSION_TIMEOUT,
            'REMEMBER_TIMEOUT': self.REMEMBER_TIMEOUT,
            'SESSION_COOKIE_SECURE': self.SESSION_COOKIE_SECURE,
            'SESSION_COOKIE_HTTPONLY': self.SESSION_COOKIE_HTTPONLY,
            'SESSION_COOKIE_SAMESITE': self.SESSION_COOKIE_SAMESITE,
            'SECRET_KEY_LENGTH': len(self.SECRET_KEY),
            'PASSWORD_HASH_SET': bool(self.PASSWORD_HASH and self.PASSWORD_HASH.startswith('$2b$')),
            'VALIDATION_ERRORS': len(self.validation_errors),
            'WARNINGS': len(self.warnings)
        }
    
    def _generate_secret_key(self) -> str:
        """Generate a secure random secret key for sessions."""
        return secrets.token_hex(32)
    
    def _generate_default_password_hash(self) -> str:
        """Generate a secure default password hash."""
        try:
            # Generate a random default password
            default_password = secrets.token_urlsafe(16)
            
            # Hash the password with bcrypt
            password_hash = bcrypt.hashpw(
                default_password.encode('utf-8'), 
                bcrypt.gensalt(rounds=self.BCRYPT_ROUNDS)
            ).decode('utf-8')
            
            # Log the default password for initial setup (in production, this should be changed)
            logger.warning(f"Using default generated password: {default_password}")
            logger.warning("Please set POI_ADMIN_PASSWORD_HASH environment variable with your own password hash")
            
            return password_hash
        except Exception as e:
            logger.error(f"Failed to generate default password hash: {e}")
            raise ConfigurationError(f"Cannot generate default password: {e}")
    
    def validate_password(self, password):
        """Validate a password against the stored hash."""
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'), 
                self.PASSWORD_HASH.encode('utf-8')
            )
        except Exception as e:
            print(f"Password validation error: {e}")
            return False
    
    def hash_password(self, password):
        """Hash a password using bcrypt."""
        return bcrypt.hashpw(
            password.encode('utf-8'), 
            bcrypt.gensalt(rounds=self.BCRYPT_ROUNDS)
        ).decode('utf-8')
    
    def get_security_headers(self):
        """Get comprehensive security headers for HTTP responses."""
        return {
            # Prevent MIME type sniffing
            'X-Content-Type-Options': 'nosniff',
            
            # Prevent clickjacking attacks
            'X-Frame-Options': 'DENY',
            
            # Enable XSS protection (legacy but still useful)
            'X-XSS-Protection': '1; mode=block',
            
            # Force HTTPS (only if running on HTTPS)
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            
            # Content Security Policy - restrictive but functional for the POI app
            'Content-Security-Policy': (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
                "img-src 'self' data: blob: https://*.openstreetmap.org https://*.tile.openstreetmap.org; "
                "font-src 'self' https://cdnjs.cloudflare.com; "
                "connect-src 'self' https://*.openstreetmap.org https://*.tile.openstreetmap.org https://api.open-elevation.com https://router.project-osrm.org; "
                "media-src 'self'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            ),
            
            # Referrer policy for privacy
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            
            # Permissions policy (formerly Feature Policy)
            'Permissions-Policy': (
                'geolocation=(), '
                'microphone=(), '
                'camera=(), '
                'payment=(), '
                'usb=(), '
                'magnetometer=(), '
                'gyroscope=(), '
                'accelerometer=()'
            ),
            
            # Cache control for sensitive pages
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }

# Global configuration instance
auth_config = AuthConfig()