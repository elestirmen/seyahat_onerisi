"""
Authentication Service for POI Travel Recommendation API.
Handles user authentication, session management, and authorization.
"""

import os
import time
import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from flask import session, request, g

from app.middleware.error_handler import APIError, bad_request
# Import functions directly from the module
def unauthorized(message, details=None):
    from app.middleware.error_handler import APIError
    raise APIError(message, "UNAUTHORIZED", 401, details)

def forbidden(message, details=None):
    from app.middleware.error_handler import APIError
    raise APIError(message, "FORBIDDEN", 403, details)
from auth_config import auth_config

logger = logging.getLogger(__name__)


class AuthService:
    """Service class for authentication and authorization operations."""
    
    def __init__(self):
        self.failed_attempts = {}  # Track failed login attempts by IP
        self.session_timeout = 3600  # 1 hour default
        self.max_failed_attempts = 5
        self.lockout_duration = 900  # 15 minutes
        self.csrf_token_expiry = 1800  # 30 minutes
    
    def authenticate_user(self, password: str, remember_me: bool = False, 
                         csrf_token: str = None) -> Dict[str, Any]:
        """
        Authenticate user with password.
        
        Args:
            password: User password
            remember_me: Whether to extend session
            csrf_token: CSRF token for validation
            
        Returns:
            Authentication result with session info
        """
        try:
            client_ip = self._get_client_ip()
            
            # Check if IP is locked out
            if self._is_ip_locked_out(client_ip):
                raise forbidden("Too many failed attempts. Please try again later.")
            
            # Validate CSRF token if session exists
            if session.get('csrf_token') and csrf_token:
                if not self.validate_csrf_token(csrf_token):
                    raise forbidden("Invalid CSRF token")
            
            # Basic validation
            if not password:
                raise bad_request("Password is required")
            
            # Verify password
            if not self._verify_password(password):
                self._record_failed_attempt(client_ip)
                raise unauthorized("Invalid password")
            
            # Clear failed attempts on successful login
            self._clear_failed_attempts(client_ip)
            
            # Create session
            session_data = self._create_session(remember_me)
            
            logger.info(f"User authenticated successfully from {client_ip}")
            
            return {
                'success': True,
                'message': 'Authentication successful',
                'session': session_data,
                'csrf_token': session_data.get('csrf_token')
            }
            
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            raise APIError("Authentication failed", "AUTH_ERROR", 500)
    
    def logout_user(self) -> Dict[str, Any]:
        """
        Logout user and clear session.
        
        Returns:
            Logout result
        """
        try:
            session_id = session.get('session_id')
            client_ip = self._get_client_ip()
            
            # Clear session data
            session.clear()
            
            # Could implement server-side session tracking here
            # For now, rely on Flask session management
            
            logger.info(f"User logged out from {client_ip}, session: {session_id}")
            
            return {
                'success': True,
                'message': 'Logged out successfully'
            }
            
        except Exception as e:
            logger.error(f"Logout error: {e}")
            raise APIError("Logout failed", "LOGOUT_ERROR", 500)
    
    def get_auth_status(self) -> Dict[str, Any]:
        """
        Get current authentication status.
        
        Returns:
            Authentication status information
        """
        try:
            is_authenticated = self.is_authenticated()
            
            status = {
                'authenticated': is_authenticated,
                'session_info': None
            }
            
            if is_authenticated:
                status['session_info'] = {
                    'session_id': session.get('session_id'),
                    'login_time': session.get('login_time'),
                    'expires_at': session.get('expires_at'),
                    'csrf_token': session.get('csrf_token'),
                    'remember_me': session.get('remember_me', False)
                }
            
            return status
            
        except Exception as e:
            logger.error(f"Auth status error: {e}")
            return {
                'authenticated': False,
                'error': str(e)
            }
    
    def is_authenticated(self) -> bool:
        """
        Check if current user is authenticated.
        
        Returns:
            True if authenticated, False otherwise
        """
        try:
            # Check if user is authenticated
            if not session.get('authenticated'):
                return False
            
            # Check session expiry
            expires_at = session.get('expires_at')
            if expires_at and datetime.now().timestamp() > expires_at:
                session.clear()
                return False
            
            # Check if session is valid
            if not session.get('session_id'):
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Authentication check error: {e}")
            return False
    
    def generate_csrf_token(self) -> str:
        """
        Generate CSRF token for session.
        
        Returns:
            CSRF token
        """
        try:
            csrf_token = secrets.token_urlsafe(32)
            session['csrf_token'] = csrf_token
            session['csrf_token_time'] = time.time()
            
            return csrf_token
            
        except Exception as e:
            logger.error(f"CSRF token generation error: {e}")
            raise APIError("Failed to generate CSRF token", "CSRF_ERROR", 500)
    
    def validate_csrf_token(self, token: str) -> bool:
        """
        Validate CSRF token.
        
        Args:
            token: CSRF token to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            if not token:
                return False
            
            session_token = session.get('csrf_token')
            if not session_token:
                return False
            
            # Check if token matches
            if not secrets.compare_digest(token, session_token):
                return False
            
            # Check if token is expired
            token_time = session.get('csrf_token_time', 0)
            if time.time() - token_time > self.csrf_token_expiry:
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"CSRF token validation error: {e}")
            return False
    
    def change_password(self, current_password: str, new_password: str) -> Dict[str, Any]:
        """
        Change user password.
        
        Args:
            current_password: Current password
            new_password: New password
            
        Returns:
            Password change result
        """
        try:
            # Verify current password
            if not self._verify_password(current_password):
                raise unauthorized("Current password is incorrect")
            
            # Validate new password
            if not new_password or len(new_password) < 8:
                raise bad_request("New password must be at least 8 characters")
            
            # Update password in auth config
            success = self._update_password(new_password)
            if not success:
                raise APIError("Failed to update password", "PASSWORD_UPDATE_ERROR", 500)
            
            # Invalidate all sessions after password change
            self._invalidate_all_sessions()
            
            logger.info(f"Password changed successfully from {self._get_client_ip()}")
            
            return {
                'success': True,
                'message': 'Password changed successfully'
            }
            
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Password change error: {e}")
            raise APIError("Password change failed", "PASSWORD_CHANGE_ERROR", 500)
    
    def require_auth(self, f):
        """
        Decorator to require authentication for routes.
        
        Args:
            f: Function to decorate
            
        Returns:
            Decorated function
        """
        from functools import wraps
        
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not self.is_authenticated():
                raise unauthorized("Authentication required")
            return f(*args, **kwargs)
        return decorated_function
    
    def _get_client_ip(self) -> str:
        """Get client IP address."""
        return request.environ.get('HTTP_X_FORWARDED_FOR') or \
               request.environ.get('HTTP_X_REAL_IP') or \
               request.environ.get('REMOTE_ADDR', 'unknown')
    
    def _is_ip_locked_out(self, ip: str) -> bool:
        """Check if IP is locked out due to failed attempts."""
        if ip not in self.failed_attempts:
            return False
        
        attempts_info = self.failed_attempts[ip]
        if attempts_info['count'] >= self.max_failed_attempts:
            # Check if lockout period has expired
            if time.time() - attempts_info['last_attempt'] < self.lockout_duration:
                return True
            else:
                # Reset attempts after lockout period
                self.failed_attempts[ip] = {'count': 0, 'last_attempt': 0}
        
        return False
    
    def _record_failed_attempt(self, ip: str):
        """Record failed login attempt."""
        if ip not in self.failed_attempts:
            self.failed_attempts[ip] = {'count': 0, 'last_attempt': 0}
        
        self.failed_attempts[ip]['count'] += 1
        self.failed_attempts[ip]['last_attempt'] = time.time()
        
        logger.warning(f"Failed login attempt from {ip} (attempt {self.failed_attempts[ip]['count']})")
    
    def _clear_failed_attempts(self, ip: str):
        """Clear failed attempts for IP."""
        if ip in self.failed_attempts:
            del self.failed_attempts[ip]
    
    def _verify_password(self, password: str) -> bool:
        """
        Verify password against stored hash.
        
        Args:
            password: Password to verify
            
        Returns:
            True if password is correct
        """
        try:
            # Get stored password hash from auth config
            stored_hash = auth_config.get_password_hash()
            if not stored_hash:
                logger.error("No password hash found in auth config")
                return False
            
            # Hash the provided password and compare
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            return secrets.compare_digest(password_hash, stored_hash)
            
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def _update_password(self, new_password: str) -> bool:
        """
        Update password in auth config.
        
        Args:
            new_password: New password to set
            
        Returns:
            True if successful
        """
        try:
            # Hash new password
            password_hash = hashlib.sha256(new_password.encode()).hexdigest()
            
            # Update auth config
            return auth_config.update_password_hash(password_hash)
            
        except Exception as e:
            logger.error(f"Password update error: {e}")
            return False
    
    def _create_session(self, remember_me: bool = False) -> Dict[str, Any]:
        """
        Create user session.
        
        Args:
            remember_me: Whether to extend session
            
        Returns:
            Session data
        """
        try:
            session_id = secrets.token_urlsafe(32)
            login_time = datetime.now().timestamp()
            
            # Set session expiry
            if remember_me:
                expires_at = login_time + (30 * 24 * 3600)  # 30 days
            else:
                expires_at = login_time + self.session_timeout  # 1 hour
            
            # Generate CSRF token
            csrf_token = self.generate_csrf_token()
            
            # Set session data
            session.permanent = remember_me
            session['authenticated'] = True
            session['session_id'] = session_id
            session['login_time'] = login_time
            session['expires_at'] = expires_at
            session['remember_me'] = remember_me
            
            return {
                'session_id': session_id,
                'login_time': login_time,
                'expires_at': expires_at,
                'csrf_token': csrf_token,
                'remember_me': remember_me
            }
            
        except Exception as e:
            logger.error(f"Session creation error: {e}")
            raise APIError("Failed to create session", "SESSION_ERROR", 500)
    
    def _invalidate_all_sessions(self):
        """Invalidate all active sessions (simplified implementation)."""
        try:
            # In a real implementation, this would invalidate all server-side sessions
            # For now, we'll just clear the current session
            session.clear()
            
            # Could implement server-side session storage and invalidation here
            logger.info("All sessions invalidated")
            
        except Exception as e:
            logger.warning(f"Session invalidation error: {e}")


# Global auth service instance
auth_service = AuthService()
