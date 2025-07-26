"""
Unit tests for authentication middleware.
Tests password validation, session management, and security features.
"""

import unittest
import tempfile
import shutil
import os
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, session
from auth_middleware import AuthMiddleware
from auth_config import AuthConfig
import bcrypt

class TestAuthMiddleware(unittest.TestCase):
    """Test cases for AuthMiddleware class."""
    
    def setUp(self):
        """Set up test environment before each test."""
        # Create a test Flask app
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SECRET_KEY'] = 'test-secret-key'
        
        # Create temporary directory for sessions
        self.temp_dir = tempfile.mkdtemp()
        self.app.config['SESSION_TYPE'] = 'filesystem'
        self.app.config['SESSION_FILE_DIR'] = self.temp_dir
        
        # Initialize middleware
        self.auth_middleware = AuthMiddleware(self.app)
        
        # Create test client
        self.client = self.app.test_client()
        
        # Create test password hash
        self.test_password = "test_password_123"
        self.test_password_hash = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)  # Lower rounds for faster testing
        ).decode('utf-8')
        
        # Mock auth_config for testing
        self.original_password_hash = None
        if hasattr(AuthConfig, 'PASSWORD_HASH'):
            self.original_password_hash = AuthConfig.PASSWORD_HASH
        
        # Set test configuration
        from auth_config import auth_config
        auth_config.PASSWORD_HASH = self.test_password_hash
        auth_config.MAX_LOGIN_ATTEMPTS = 3
        auth_config.LOCKOUT_DURATION = 60  # 1 minute for testing
        auth_config.SESSION_TIMEOUT = 300  # 5 minutes for testing
        auth_config.REMEMBER_TIMEOUT = 600  # 10 minutes for testing
    
    def tearDown(self):
        """Clean up after each test."""
        # Restore original configuration
        if self.original_password_hash:
            from auth_config import auth_config
            auth_config.PASSWORD_HASH = self.original_password_hash
        
        # Clean up temporary directory
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_password_validation_success(self):
        """Test successful password validation."""
        result = self.auth_middleware.validate_password(self.test_password)
        self.assertTrue(result)
    
    def test_password_validation_failure(self):
        """Test failed password validation."""
        result = self.auth_middleware.validate_password("wrong_password")
        self.assertFalse(result)
    
    def test_password_validation_empty(self):
        """Test password validation with empty password."""
        result = self.auth_middleware.validate_password("")
        self.assertFalse(result)
        
        result = self.auth_middleware.validate_password(None)
        self.assertFalse(result)
    
    def test_session_creation_success(self):
        """Test successful session creation."""
        with self.app.test_request_context():
            result = self.auth_middleware.create_session()
            self.assertTrue(result)
            self.assertTrue(session.get('authenticated'))
            self.assertIsNotNone(session.get('login_time'))
            self.assertIsNotNone(session.get('last_activity'))
            self.assertIsNotNone(session.get('csrf_token'))
            self.assertFalse(session.get('remember_me'))
    
    def test_session_creation_with_remember_me(self):
        """Test session creation with remember me option."""
        with self.app.test_request_context():
            result = self.auth_middleware.create_session(remember_me=True)
            self.assertTrue(result)
            self.assertTrue(session.get('authenticated'))
            self.assertTrue(session.get('remember_me'))
    
    def test_session_validation_success(self):
        """Test successful session validation."""
        with self.app.test_request_context():
            # Create session first
            self.auth_middleware.create_session()
            
            # Validate session
            result = self.auth_middleware.validate_session()
            self.assertTrue(result)
    
    def test_session_validation_not_authenticated(self):
        """Test session validation when not authenticated."""
        with self.app.test_request_context():
            result = self.auth_middleware.validate_session()
            self.assertFalse(result)
    
    def test_session_validation_missing_fields(self):
        """Test session validation with missing required fields."""
        with self.app.test_request_context():
            # Set incomplete session data
            session['authenticated'] = True
            session['login_time'] = datetime.now(timezone.utc).isoformat()
            # Missing last_activity and csrf_token
            
            result = self.auth_middleware.validate_session()
            self.assertFalse(result)
    
    def test_session_validation_expired(self):
        """Test session validation with expired session."""
        with self.app.test_request_context():
            # Create session with old timestamps
            old_time = datetime.now(timezone.utc) - timedelta(seconds=400)  # Older than SESSION_TIMEOUT
            session['authenticated'] = True
            session['login_time'] = old_time.isoformat()
            session['last_activity'] = old_time.isoformat()
            session['csrf_token'] = 'test_token'
            session['remember_me'] = False
            
            result = self.auth_middleware.validate_session()
            self.assertFalse(result)
            self.assertFalse(session.get('authenticated'))
    
    def test_session_validation_remember_me_not_expired(self):
        """Test session validation with remember me and not expired."""
        with self.app.test_request_context():
            # Create session with remember me and recent activity
            recent_time = datetime.now(timezone.utc) - timedelta(seconds=500)  # Within REMEMBER_TIMEOUT
            session['authenticated'] = True
            session['login_time'] = recent_time.isoformat()
            session['last_activity'] = recent_time.isoformat()
            session['csrf_token'] = 'test_token'
            session['remember_me'] = True
            
            result = self.auth_middleware.validate_session()
            self.assertTrue(result)
    
    def test_session_destroy(self):
        """Test session destruction."""
        with self.app.test_request_context():
            # Create session first
            self.auth_middleware.create_session()
            self.assertTrue(session.get('authenticated'))
            
            # Destroy session
            result = self.auth_middleware.destroy_session()
            self.assertTrue(result)
            self.assertFalse(session.get('authenticated'))
    
    def test_is_authenticated(self):
        """Test authentication status check."""
        with self.app.test_request_context():
            # Not authenticated initially
            self.assertFalse(self.auth_middleware.is_authenticated())
            
            # Create session
            self.auth_middleware.create_session()
            self.assertTrue(self.auth_middleware.is_authenticated())
            
            # Destroy session
            self.auth_middleware.destroy_session()
            self.assertFalse(self.auth_middleware.is_authenticated())
    
    def test_rate_limiting_allowed(self):
        """Test rate limiting when attempts are within limit."""
        ip_address = "192.168.1.1"
        
        is_allowed, remaining, lockout_time, delay = self.auth_middleware.check_rate_limit(ip_address)
        self.assertTrue(is_allowed)
        self.assertEqual(remaining, 3)  # MAX_LOGIN_ATTEMPTS
        self.assertIsNone(lockout_time)
        self.assertEqual(delay, 0)
    
    def test_rate_limiting_record_attempts(self):
        """Test recording failed attempts."""
        ip_address = "192.168.1.2"
        
        # Record failed attempts
        for i in range(2):
            self.auth_middleware.record_failed_attempt(ip_address)
        
        is_allowed, remaining, lockout_time, delay = self.auth_middleware.check_rate_limit(ip_address)
        # After 2 attempts, there should be a progressive delay
        self.assertFalse(is_allowed)  # Blocked due to delay
        self.assertEqual(remaining, 1)  # 3 - 2 attempts
        self.assertIsNone(lockout_time)
        self.assertGreater(delay, 0)  # Should have delay
    
    def test_rate_limiting_lockout(self):
        """Test IP lockout after max attempts."""
        ip_address = "192.168.1.3"
        
        # Record max failed attempts
        for i in range(3):
            self.auth_middleware.record_failed_attempt(ip_address)
        
        is_allowed, remaining, lockout_time, delay = self.auth_middleware.check_rate_limit(ip_address)
        self.assertFalse(is_allowed)
        self.assertEqual(remaining, 0)
        self.assertIsNotNone(lockout_time)
        self.assertGreater(lockout_time, 0)
        self.assertEqual(delay, 0)  # No delay during lockout
    
    def test_rate_limiting_clear_attempts(self):
        """Test clearing failed attempts after successful login."""
        ip_address = "192.168.1.4"
        
        # Record failed attempts
        for i in range(2):
            self.auth_middleware.record_failed_attempt(ip_address)
        
        # Clear attempts
        self.auth_middleware.clear_failed_attempts(ip_address)
        
        is_allowed, remaining, lockout_time, delay = self.auth_middleware.check_rate_limit(ip_address)
        self.assertTrue(is_allowed)
        self.assertEqual(remaining, 3)  # Reset to max
        self.assertIsNone(lockout_time)
        self.assertEqual(delay, 0)
    
    def test_csrf_token_generation(self):
        """Test CSRF token generation and retrieval."""
        with self.app.test_request_context():
            # No token when not authenticated
            token = self.auth_middleware.get_csrf_token()
            self.assertIsNone(token)
            
            # Token available after authentication
            self.auth_middleware.create_session()
            token = self.auth_middleware.get_csrf_token()
            self.assertIsNotNone(token)
            self.assertIsInstance(token, str)
            self.assertGreater(len(token), 0)
    
    def test_csrf_token_validation(self):
        """Test CSRF token validation."""
        with self.app.test_request_context():
            # Create session
            self.auth_middleware.create_session()
            token = self.auth_middleware.get_csrf_token()
            
            # Valid token
            result = self.auth_middleware.validate_csrf_token(token)
            self.assertTrue(result)
            
            # Invalid token
            result = self.auth_middleware.validate_csrf_token("invalid_token")
            self.assertFalse(result)
            
            # No token
            result = self.auth_middleware.validate_csrf_token(None)
            self.assertFalse(result)
    
    def test_csrf_token_validation_not_authenticated(self):
        """Test CSRF token validation when not authenticated."""
        with self.app.test_request_context():
            result = self.auth_middleware.validate_csrf_token("any_token")
            self.assertFalse(result)
    
    def test_session_info(self):
        """Test getting session information."""
        with self.app.test_request_context():
            # No info when not authenticated
            info = self.auth_middleware.get_session_info()
            self.assertIsNone(info)
            
            # Info available after authentication
            self.auth_middleware.create_session(remember_me=True)
            info = self.auth_middleware.get_session_info()
            
            self.assertIsNotNone(info)
            self.assertTrue(info['authenticated'])
            self.assertIsNotNone(info['login_time'])
            self.assertIsNotNone(info['last_activity'])
            self.assertIsNotNone(info['expires_at'])
            self.assertTrue(info['remember_me'])
            self.assertIsNotNone(info['csrf_token'])
    
    def test_require_auth_decorator(self):
        """Test the require_auth decorator."""
        @self.auth_middleware.require_auth
        def protected_route():
            return "Protected content"
        
        with self.app.test_request_context():
            # Should fail when not authenticated
            with self.assertRaises(Exception):  # Will try to redirect
                protected_route()
            
            # Should succeed when authenticated
            self.auth_middleware.create_session()
            result = protected_route()
            self.assertEqual(result, "Protected content")
    
    def test_progressive_delay_calculation(self):
        """Test progressive delay calculation based on attempt count."""
        # Test delay calculation for different attempt counts
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(0), 0)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(1), 0)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(2), 2)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(3), 5)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(4), 10)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(5), 30)
        self.assertEqual(self.auth_middleware._calculate_progressive_delay(10), 30)
    
    def test_progressive_delay_enforcement(self):
        """Test that progressive delays are enforced."""
        ip_address = "192.168.1.5"
        
        # Record 2 failed attempts (should trigger 2-second delay)
        self.auth_middleware.record_failed_attempt(ip_address)
        self.auth_middleware.record_failed_attempt(ip_address)
        
        # Check immediately - should be blocked due to delay
        is_allowed, remaining, lockout_time, delay = self.auth_middleware.check_rate_limit(ip_address)
        self.assertFalse(is_allowed)
        self.assertEqual(remaining, 1)
        self.assertIsNone(lockout_time)
        self.assertGreater(delay, 0)
        self.assertLessEqual(delay, 2)  # Should be close to 2 seconds
    
    def test_user_agent_tracking(self):
        """Test user agent tracking for security monitoring."""
        ip_address = "192.168.1.6"
        user_agent1 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        user_agent2 = "curl/7.68.0"
        
        # Record attempts with different user agents
        self.auth_middleware.record_failed_attempt(ip_address, user_agent1)
        self.auth_middleware.record_failed_attempt(ip_address, user_agent2)
        
        # Check that user agents are tracked
        attempt_data = self.auth_middleware.failed_attempts[ip_address]
        self.assertIn(user_agent1, attempt_data['user_agents'])
        self.assertIn(user_agent2, attempt_data['user_agents'])
        self.assertEqual(len(attempt_data['user_agents']), 2)
    
    def test_security_stats(self):
        """Test security statistics collection."""
        # Record attempts from different IPs
        self.auth_middleware.record_failed_attempt("192.168.1.7")
        self.auth_middleware.record_failed_attempt("192.168.1.8")
        
        # Lock out one IP by exceeding max attempts
        for i in range(3):
            self.auth_middleware.record_failed_attempt("192.168.1.9")
        
        # Trigger the lockout by checking rate limit
        self.auth_middleware.check_rate_limit("192.168.1.9")
        
        stats = self.auth_middleware.get_security_stats()
        
        self.assertGreaterEqual(stats['total_tracked_ips'], 3)
        self.assertGreaterEqual(stats['locked_out_ips'], 1)
        self.assertGreaterEqual(stats['ips_with_recent_failures'], 3)
        self.assertGreaterEqual(stats['total_recent_attempts'], 5)
    
    def test_cleanup_expired_attempts(self):
        """Test cleanup of expired failed attempts."""
        ip_address = "192.168.1.10"
        
        # Record an attempt
        self.auth_middleware.record_failed_attempt(ip_address)
        self.assertIn(ip_address, self.auth_middleware.failed_attempts)
        
        # Manually set old timestamp to simulate expiration
        old_time = time.time() - 3700  # Older than 1 hour
        self.auth_middleware.failed_attempts[ip_address]['attempts'] = [old_time]
        
        # Trigger cleanup
        self.auth_middleware._cleanup_failed_attempts(time.time())
        
        # Should be cleaned up
        self.assertNotIn(ip_address, self.auth_middleware.failed_attempts)

if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)