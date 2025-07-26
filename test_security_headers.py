#!/usr/bin/env python3
"""
Unit tests for security headers implementation.
Tests that all required security headers are properly configured and applied.
"""

import unittest
import json
import sys
import os

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app
from auth_config import auth_config

class TestSecurityHeaders(unittest.TestCase):
    """Test security headers implementation."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_security_headers_configuration(self):
        """Test that all required security headers are configured."""
        headers = auth_config.get_security_headers()
        
        required_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options', 
            'X-XSS-Protection',
            'Strict-Transport-Security',
        ]
        
        self.assertIsInstance(headers, dict, "Security headers should be returned as a dictionary")
        self.assertGreater(len(headers), 0, "At least some security headers should be configured")
        
        for required_header in required_headers:
            self.assertIn(required_header, headers, 
                         f"Required security header '{required_header}' is missing")
    
    def test_security_headers_in_responses(self):
        """Test that security headers are present in HTTP responses."""
        endpoints_to_test = [
            '/auth/status',
            '/auth/csrf-token',
        ]
        
        required_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ]
        
        for endpoint in endpoints_to_test:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                
                for header in required_headers:
                    self.assertIn(header, response.headers, 
                                f"Security header '{header}' missing from {endpoint}")
    
    def test_x_content_type_options_header(self):
        """Test X-Content-Type-Options header."""
        response = self.client.get('/auth/status')
        
        self.assertIn('X-Content-Type-Options', response.headers)
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
    
    def test_x_frame_options_header(self):
        """Test X-Frame-Options header."""
        response = self.client.get('/auth/status')
        
        self.assertIn('X-Frame-Options', response.headers)
        self.assertIn(response.headers['X-Frame-Options'], ['DENY', 'SAMEORIGIN'])
    
    def test_x_xss_protection_header(self):
        """Test X-XSS-Protection header."""
        response = self.client.get('/auth/status')
        
        self.assertIn('X-XSS-Protection', response.headers)
        self.assertEqual(response.headers['X-XSS-Protection'], '1; mode=block')
    
    def test_strict_transport_security_header(self):
        """Test Strict-Transport-Security header."""
        response = self.client.get('/auth/status')
        
        self.assertIn('Strict-Transport-Security', response.headers)
        sts_header = response.headers['Strict-Transport-Security']
        
        # Should contain max-age directive
        self.assertIn('max-age=', sts_header)
        
        # Should have reasonable max-age (at least 1 year)
        if 'max-age=' in sts_header:
            max_age_part = sts_header.split('max-age=')[1].split(';')[0]
            max_age = int(max_age_part)
            self.assertGreaterEqual(max_age, 31536000, "HSTS max-age should be at least 1 year")
    
    def test_content_security_policy_header(self):
        """Test Content-Security-Policy header if present."""
        response = self.client.get('/auth/status')
        
        if 'Content-Security-Policy' in response.headers:
            csp = response.headers['Content-Security-Policy']
            
            # Should contain basic directives
            self.assertIn("default-src", csp, "CSP should have default-src directive")
            
            # Should not allow unsafe-inline for scripts (security best practice)
            if "script-src" in csp:
                self.assertNotIn("'unsafe-inline'", csp, "CSP should not allow unsafe-inline scripts")
    
    def test_referrer_policy_header(self):
        """Test Referrer-Policy header if present."""
        response = self.client.get('/auth/status')
        
        if 'Referrer-Policy' in response.headers:
            referrer_policy = response.headers['Referrer-Policy']
            
            # Should be a valid referrer policy value
            valid_policies = [
                'no-referrer',
                'no-referrer-when-downgrade',
                'origin',
                'origin-when-cross-origin',
                'same-origin',
                'strict-origin',
                'strict-origin-when-cross-origin',
                'unsafe-url'
            ]
            
            self.assertIn(referrer_policy, valid_policies, 
                         f"Referrer-Policy '{referrer_policy}' is not a valid value")
    
    def test_cache_control_for_sensitive_endpoints(self):
        """Test cache control headers for sensitive endpoints."""
        sensitive_endpoints = [
            '/auth/status',
            '/auth/csrf-token',
        ]
        
        for endpoint in sensitive_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                
                # Should have cache control headers to prevent caching
                cache_headers = ['Cache-Control', 'Pragma', 'Expires']
                cache_header_found = any(header in response.headers for header in cache_headers)
                
                self.assertTrue(cache_header_found, 
                               f"Endpoint {endpoint} should have cache control headers")
                
                if 'Cache-Control' in response.headers:
                    cache_control = response.headers['Cache-Control']
                    # Should prevent caching of sensitive data
                    self.assertTrue(
                        'no-cache' in cache_control or 'no-store' in cache_control,
                        f"Cache-Control for {endpoint} should prevent caching"
                    )


class TestRateLimitingConfiguration(unittest.TestCase):
    """Test rate limiting configuration."""
    
    def test_max_login_attempts_configuration(self):
        """Test MAX_LOGIN_ATTEMPTS configuration."""
        max_attempts = auth_config.MAX_LOGIN_ATTEMPTS
        
        self.assertIsInstance(max_attempts, int, "MAX_LOGIN_ATTEMPTS should be an integer")
        self.assertGreaterEqual(max_attempts, 3, "MAX_LOGIN_ATTEMPTS should be at least 3")
        self.assertLessEqual(max_attempts, 10, "MAX_LOGIN_ATTEMPTS should not exceed 10")
    
    def test_lockout_duration_configuration(self):
        """Test LOCKOUT_DURATION configuration."""
        lockout_duration = auth_config.LOCKOUT_DURATION
        
        self.assertIsInstance(lockout_duration, int, "LOCKOUT_DURATION should be an integer")
        self.assertGreaterEqual(lockout_duration, 300, "LOCKOUT_DURATION should be at least 5 minutes")
        self.assertLessEqual(lockout_duration, 3600, "LOCKOUT_DURATION should not exceed 1 hour")
    
    def test_session_timeout_configuration(self):
        """Test SESSION_TIMEOUT configuration."""
        session_timeout = auth_config.SESSION_TIMEOUT
        
        self.assertIsInstance(session_timeout, int, "SESSION_TIMEOUT should be an integer")
        self.assertGreaterEqual(session_timeout, 1800, "SESSION_TIMEOUT should be at least 30 minutes")
        self.assertLessEqual(session_timeout, 86400, "SESSION_TIMEOUT should not exceed 24 hours")
    
    def test_remember_timeout_configuration(self):
        """Test REMEMBER_TIMEOUT configuration."""
        remember_timeout = auth_config.REMEMBER_TIMEOUT
        
        self.assertIsInstance(remember_timeout, int, "REMEMBER_TIMEOUT should be an integer")
        self.assertGreaterEqual(remember_timeout, 86400, "REMEMBER_TIMEOUT should be at least 1 day")
        self.assertLessEqual(remember_timeout, 2592000, "REMEMBER_TIMEOUT should not exceed 30 days")
    
    def test_bcrypt_rounds_configuration(self):
        """Test BCRYPT_ROUNDS configuration."""
        bcrypt_rounds = auth_config.BCRYPT_ROUNDS
        
        self.assertIsInstance(bcrypt_rounds, int, "BCRYPT_ROUNDS should be an integer")
        self.assertGreaterEqual(bcrypt_rounds, 10, "BCRYPT_ROUNDS should be at least 10 for security")
        self.assertLessEqual(bcrypt_rounds, 15, "BCRYPT_ROUNDS should not exceed 15 for performance")


class TestSecurityConfiguration(unittest.TestCase):
    """Test overall security configuration."""
    
    def test_session_security_configuration(self):
        """Test session security configuration."""
        # Test that session configuration is secure
        self.assertIsInstance(auth_config.SESSION_COOKIE_SECURE, bool, 
                             "SESSION_COOKIE_SECURE should be a boolean")
        
        self.assertIsInstance(auth_config.SESSION_COOKIE_HTTPONLY, bool,
                             "SESSION_COOKIE_HTTPONLY should be a boolean")
        
        # In production, these should be True
        if not auth_config.DEBUG:
            self.assertTrue(auth_config.SESSION_COOKIE_SECURE, 
                           "SESSION_COOKIE_SECURE should be True in production")
            self.assertTrue(auth_config.SESSION_COOKIE_HTTPONLY,
                           "SESSION_COOKIE_HTTPONLY should be True")
    
    def test_password_hash_configuration(self):
        """Test password hash configuration."""
        password_hash = auth_config.PASSWORD_HASH
        
        self.assertIsInstance(password_hash, str, "PASSWORD_HASH should be a string")
        self.assertGreater(len(password_hash), 50, "PASSWORD_HASH should be a proper bcrypt hash")
        
        # Should be a bcrypt hash
        self.assertTrue(password_hash.startswith('$2b$'), 
                       "PASSWORD_HASH should be a bcrypt hash starting with $2b$")
    
    def test_secret_key_configuration(self):
        """Test secret key configuration."""
        secret_key = auth_config.SESSION_SECRET_KEY
        
        self.assertIsInstance(secret_key, str, "SESSION_SECRET_KEY should be a string")
        self.assertGreater(len(secret_key), 20, "SESSION_SECRET_KEY should be at least 20 characters")
        
        # Should not be a default/weak value
        weak_keys = ['secret', 'password', 'key', 'test', 'default']
        for weak_key in weak_keys:
            self.assertNotIn(weak_key.lower(), secret_key.lower(),
                           f"SESSION_SECRET_KEY should not contain '{weak_key}'")


if __name__ == '__main__':
    print("🔒 Security Headers and Configuration Tests")
    print("=" * 50)
    
    # Run tests with detailed output
    unittest.main(verbosity=2, buffer=True)