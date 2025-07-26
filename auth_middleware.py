"""
Authentication middleware for POI management system.
Provides session management, password validation, and route protection.
"""

import time
import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import session, request, redirect, url_for, jsonify, g
from auth_config import auth_config
import secrets

class AuthMiddleware:
    """Authentication middleware class for managing user sessions and route protection."""
    
    def __init__(self, app=None):
        """
        Initialize authentication middleware.
        
        Args:
            app: Flask application instance (optional)
        """
        self.app = app
        self.failed_attempts = {}  # Track failed login attempts by IP
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app."""
        self.app = app
        
        # Register before_request handler for session validation
        app.before_request(self._before_request_handler)
        
        # Register after_request handler for security headers
        app.after_request(self._after_request_handler)
        
        # Start session cleanup worker
        self.schedule_session_cleanup()
    
    def _before_request_handler(self):
        """Handle requests before they reach route handlers."""
        # Skip authentication for static files and auth endpoints
        if (request.endpoint and 
            (request.endpoint.startswith('static') or 
             request.endpoint.startswith('auth.'))):
            return
        
        # Validate session for all other requests
        self._validate_session()
    
    def _after_request_handler(self, response):
        """Handle responses after route handlers to add security headers."""
        # Add security headers to all responses
        security_headers = auth_config.get_security_headers()
        for header, value in security_headers.items():
            response.headers[header] = value
        
        return response
    
    def require_auth(self, f):
        """
        Decorator for protecting routes that require authentication.
        
        Args:
            f: Function to protect
            
        Returns:
            Wrapped function that checks authentication
        """
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not self.is_authenticated():
                if request.is_json:
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated_function
    
    def is_authenticated(self):
        """
        Check if the current user is authenticated.
        
        Returns:
            bool: True if user is authenticated, False otherwise
        """
        return session.get('authenticated', False)
    
    def create_session(self, remember_me=False):
        """
        Create a new authenticated session.
        
        Args:
            remember_me: Whether to extend session duration
            
        Returns:
            bool: True if session created successfully
        """
        try:
            # Clear any existing session data
            session.clear()
            
            # Set session data
            session['authenticated'] = True
            session['login_time'] = datetime.now(timezone.utc).isoformat()
            session['last_activity'] = datetime.now(timezone.utc).isoformat()
            session['remember_me'] = remember_me
            session['csrf_token'] = secrets.token_hex(16)
            
            # Set session timeout based on remember_me option
            if remember_me:
                session.permanent = True
                self.app.permanent_session_lifetime = timedelta(
                    seconds=auth_config.REMEMBER_TIMEOUT
                )
            else:
                session.permanent = False
                self.app.permanent_session_lifetime = timedelta(
                    seconds=auth_config.SESSION_TIMEOUT
                )
            
            return True
            
        except Exception as e:
            print(f"Error creating session: {e}")
            return False
    
    def validate_session(self):
        """
        Validate the current session.
        
        Returns:
            bool: True if session is valid, False otherwise
        """
        if not session.get('authenticated'):
            return False
        
        try:
            # Check if session has required fields
            required_fields = ['login_time', 'last_activity', 'csrf_token']
            for field in required_fields:
                if field not in session:
                    return False
            
            # Parse timestamps
            login_time = datetime.fromisoformat(session['login_time'])
            last_activity = datetime.fromisoformat(session['last_activity'])
            current_time = datetime.now(timezone.utc)
            
            # Determine timeout based on remember_me setting
            remember_me = session.get('remember_me', False)
            timeout_seconds = (auth_config.REMEMBER_TIMEOUT if remember_me 
                             else auth_config.SESSION_TIMEOUT)
            
            # Check if session has expired
            if (current_time - last_activity).total_seconds() > timeout_seconds:
                self.destroy_session()
                return False
            
            # Update last activity time
            session['last_activity'] = current_time.isoformat()
            
            return True
            
        except Exception as e:
            print(f"Error validating session: {e}")
            self.destroy_session()
            return False
    
    def _validate_session(self):
        """Internal method to validate session and set global context."""
        if session.get('authenticated'):
            if not self.validate_session():
                session.clear()
                g.authenticated = False
            else:
                g.authenticated = True
        else:
            g.authenticated = False
    
    def destroy_session(self):
        """
        Destroy the current session.
        
        Returns:
            bool: True if session destroyed successfully
        """
        try:
            session.clear()
            return True
        except Exception as e:
            print(f"Error destroying session: {e}")
            return False
    
    def validate_password(self, password):
        """
        Validate a password against the configured hash.
        
        Args:
            password: Plain text password to validate
            
        Returns:
            bool: True if password is valid, False otherwise
        """
        if not password:
            return False
        
        return auth_config.validate_password(password)
    
    def check_rate_limit(self, ip_address):
        """
        Check if IP address is rate limited for login attempts.
        
        Args:
            ip_address: IP address to check
            
        Returns:
            tuple: (is_allowed, remaining_attempts, lockout_time, delay_seconds)
        """
        current_time = time.time()
        
        # Clean up old entries
        self._cleanup_failed_attempts(current_time)
        
        if ip_address not in self.failed_attempts:
            return True, auth_config.MAX_LOGIN_ATTEMPTS, None, 0
        
        attempt_data = self.failed_attempts[ip_address]
        
        # Check if IP is currently locked out
        if (attempt_data['lockout_until'] and 
            current_time < attempt_data['lockout_until']):
            lockout_remaining = attempt_data['lockout_until'] - current_time
            return False, 0, lockout_remaining, 0
        
        # Check if within rate limit window (15 minutes)
        attempts_in_window = [
            timestamp for timestamp in attempt_data['attempts']
            if current_time - timestamp < auth_config.LOCKOUT_DURATION
        ]
        
        remaining_attempts = auth_config.MAX_LOGIN_ATTEMPTS - len(attempts_in_window)
        
        # If we've exceeded max attempts, lock out immediately
        if remaining_attempts <= 0:
            lockout_until = current_time + auth_config.LOCKOUT_DURATION
            self.failed_attempts[ip_address]['lockout_until'] = lockout_until
            return False, 0, auth_config.LOCKOUT_DURATION, 0
        
        # Calculate progressive delay based on failed attempts
        delay_seconds = self._calculate_progressive_delay(len(attempts_in_window))
        
        # Check if last attempt was too recent (progressive delay)
        if attempts_in_window and delay_seconds > 0:
            last_attempt = max(attempts_in_window)
            time_since_last = current_time - last_attempt
            if time_since_last < delay_seconds:
                remaining_delay = delay_seconds - time_since_last
                return False, remaining_attempts, None, remaining_delay
        
        return True, remaining_attempts, None, 0
    
    def record_failed_attempt(self, ip_address, user_agent=None):
        """
        Record a failed login attempt for an IP address.
        
        Args:
            ip_address: IP address that failed login
            user_agent: User agent string (optional)
        """
        current_time = time.time()
        
        if ip_address not in self.failed_attempts:
            self.failed_attempts[ip_address] = {
                'attempts': [],
                'lockout_until': None,
                'first_attempt': current_time,
                'user_agents': set()
            }
        
        # Track user agents for potential bot detection
        if user_agent:
            self.failed_attempts[ip_address]['user_agents'].add(user_agent)
        
        self.failed_attempts[ip_address]['attempts'].append(current_time)
        
        # Keep only recent attempts
        self.failed_attempts[ip_address]['attempts'] = [
            timestamp for timestamp in self.failed_attempts[ip_address]['attempts']
            if current_time - timestamp < auth_config.LOCKOUT_DURATION
        ]
        
        # Log security event
        attempt_count = len(self.failed_attempts[ip_address]['attempts'])
        print(f"SECURITY: Failed login attempt #{attempt_count} from IP {ip_address}")
        
        # Log potential brute force attack
        if attempt_count >= auth_config.MAX_LOGIN_ATTEMPTS:
            print(f"SECURITY ALERT: IP {ip_address} locked out after {attempt_count} failed attempts")
            if len(self.failed_attempts[ip_address]['user_agents']) > 1:
                print(f"SECURITY ALERT: Multiple user agents detected from IP {ip_address} - possible bot attack")
    
    def clear_failed_attempts(self, ip_address):
        """
        Clear failed attempts for an IP address (after successful login).
        
        Args:
            ip_address: IP address to clear attempts for
        """
        if ip_address in self.failed_attempts:
            del self.failed_attempts[ip_address]
    
    def _calculate_progressive_delay(self, attempt_count):
        """
        Calculate progressive delay based on number of failed attempts.
        
        Args:
            attempt_count: Number of failed attempts
            
        Returns:
            int: Delay in seconds
        """
        if attempt_count <= 1:
            return 0
        elif attempt_count == 2:
            return 2  # 2 seconds after 2nd attempt
        elif attempt_count == 3:
            return 5  # 5 seconds after 3rd attempt
        elif attempt_count == 4:
            return 10  # 10 seconds after 4th attempt
        else:
            return 30  # 30 seconds after 5th+ attempt
    
    def _cleanup_failed_attempts(self, current_time):
        """
        Clean up old failed attempt records.
        
        Args:
            current_time: Current timestamp
        """
        expired_ips = []
        
        for ip_address, data in self.failed_attempts.items():
            # Remove expired lockouts
            if (data['lockout_until'] and 
                current_time > data['lockout_until']):
                data['lockout_until'] = None
            
            # Remove old attempts
            data['attempts'] = [
                timestamp for timestamp in data['attempts']
                if current_time - timestamp < auth_config.LOCKOUT_DURATION
            ]
            
            # Mark IP for removal if no recent activity
            if not data['attempts'] and not data['lockout_until']:
                expired_ips.append(ip_address)
        
        # Remove expired IP records
        for ip_address in expired_ips:
            del self.failed_attempts[ip_address]
    
    def get_security_stats(self):
        """
        Get current security statistics.
        
        Returns:
            dict: Security statistics
        """
        current_time = time.time()
        self._cleanup_failed_attempts(current_time)
        
        stats = {
            'total_tracked_ips': len(self.failed_attempts),
            'locked_out_ips': 0,
            'ips_with_recent_failures': 0,
            'total_recent_attempts': 0
        }
        
        for ip_address, data in self.failed_attempts.items():
            if data['lockout_until'] and current_time < data['lockout_until']:
                stats['locked_out_ips'] += 1
            
            recent_attempts = [
                timestamp for timestamp in data['attempts']
                if current_time - timestamp < 3600  # Last hour
            ]
            
            if recent_attempts:
                stats['ips_with_recent_failures'] += 1
                stats['total_recent_attempts'] += len(recent_attempts)
        
        return stats
    
    def get_csrf_token(self):
        """
        Get CSRF token for the current session.
        
        Returns:
            str: CSRF token or None if not authenticated
        """
        if self.is_authenticated():
            return session.get('csrf_token')
        return None
    
    def validate_csrf_token(self, token):
        """
        Validate CSRF token against session token.
        
        Args:
            token: CSRF token to validate
            
        Returns:
            bool: True if token is valid, False otherwise
        """
        if not self.is_authenticated():
            return False
        
        session_token = session.get('csrf_token')
        return session_token and token and session_token == token
    
    def get_session_info(self):
        """
        Get information about the current session.
        
        Returns:
            dict: Session information or None if not authenticated
        """
        if not self.is_authenticated():
            return None
        
        try:
            login_time = datetime.fromisoformat(session['login_time'])
            last_activity = datetime.fromisoformat(session['last_activity'])
            remember_me = session.get('remember_me', False)
            
            timeout_seconds = (auth_config.REMEMBER_TIMEOUT if remember_me 
                             else auth_config.SESSION_TIMEOUT)
            
            expires_at = last_activity + timedelta(seconds=timeout_seconds)
            
            return {
                'authenticated': True,
                'login_time': login_time.isoformat(),
                'last_activity': last_activity.isoformat(),
                'expires_at': expires_at.isoformat(),
                'remember_me': remember_me,
                'csrf_token': session.get('csrf_token')
            }
            
        except Exception as e:
            print(f"Error getting session info: {e}")
            return None
    
    def cleanup_expired_sessions(self):
        """
        Clean up expired session files from the filesystem.
        This should be called periodically to prevent session file buildup.
        
        Returns:
            int: Number of expired sessions cleaned up
        """
        try:
            import tempfile
            import glob
            
            session_dir = os.path.join(tempfile.gettempdir(), 'poi_sessions')
            if not os.path.exists(session_dir):
                return 0
            
            cleaned_count = 0
            current_time = datetime.now(timezone.utc)
            
            # Get all session files
            session_files = glob.glob(os.path.join(session_dir, 'session:*'))
            
            for session_file in session_files:
                try:
                    # Check file modification time
                    file_mtime = datetime.fromtimestamp(
                        os.path.getmtime(session_file), 
                        tz=timezone.utc
                    )
                    
                    # Calculate maximum possible session age (remember_me timeout)
                    max_age = timedelta(seconds=auth_config.REMEMBER_TIMEOUT)
                    
                    # If file is older than maximum possible session age, delete it
                    if current_time - file_mtime > max_age:
                        os.remove(session_file)
                        cleaned_count += 1
                        print(f"Cleaned expired session file: {os.path.basename(session_file)}")
                        
                except Exception as e:
                    print(f"Error processing session file {session_file}: {e}")
                    continue
            
            if cleaned_count > 0:
                print(f"Session cleanup completed: {cleaned_count} expired sessions removed")
            
            return cleaned_count
            
        except Exception as e:
            print(f"Error during session cleanup: {e}")
            return 0
    
    def schedule_session_cleanup(self):
        """
        Schedule periodic session cleanup.
        This should be called during application initialization.
        """
        import threading
        import time
        
        def cleanup_worker():
            while True:
                try:
                    # Run cleanup every hour
                    time.sleep(3600)  # 1 hour
                    self.cleanup_expired_sessions()
                except Exception as e:
                    print(f"Session cleanup worker error: {e}")
        
        # Start cleanup worker in background thread
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        print("Session cleanup worker started")

# Global middleware instance
auth_middleware = AuthMiddleware()