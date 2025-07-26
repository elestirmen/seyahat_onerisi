"""
Integration tests for authentication API endpoints.
Tests the complete authentication workflow including login, logout, and status endpoints.
"""

import unittest
import json
import os
import tempfile
from unittest.mock import patch, MagicMock
from poi_api import app
from auth_config import auth_config
import bcrypt

class TestAuthEndpoints(unittest.TestCase):
    """Test cases for authentication API endpoints."""
    
    def setUp(self):
        """Set up test environment."""
        # Create test client
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        self.client = self.app.test_client()
        
        # Set up test password
        self.test_password = "test_password_123"
        self.test_password_hash = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)  # Lower rounds for faster testing
        ).decode('utf-8')
        
        # Mock auth config for testing
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = self.test_password_hash
        
        # Create application context
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Clear failed attempts for clean test state
        from auth_middleware import auth_middleware
        auth_middleware.failed_attempts.clear()
    
    def tearDown(self):
        """Clean up test environment."""
        # Restore original password hash
        auth_config.PASSWORD_HASH = self.original_password_hash
        
        # Clean up application context
        self.app_context.pop()
    
    def test_login_page_get(self):
        """Test GET request to login page."""
        response = self.client.get('/auth/login')
        
        # Should return login page or redirect if already authenticated
        self.assertIn(response.status_code, [200, 302])
        
        if response.status_code == 200:
            # Should contain login form elements
            self.assertIn(b'password', response.data.lower())
    
    def test_login_success(self):
        """Test successful login."""
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'Login successful')
        self.assertIn('csrf_token', data)
        self.assertIn('session_info', data)
        
        # Check security headers
        self.assertIn('X-Content-Type-Options', response.headers)
        self.assertIn('X-Frame-Options', response.headers)
    
    def test_login_invalid_password(self):
        """Test login with invalid password."""
        login_data = {
            'password': 'wrong_password',
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
        
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Invalid password')
        self.assertIn('remaining_attempts', data)
    
    def test_login_missing_password(self):
        """Test login with missing password."""
        login_data = {
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Password is required')
    
    def test_login_remember_me(self):
        """Test login with remember me option."""
        login_data = {
            'password': self.test_password,
            'remember_me': True
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['session_info']['remember_me'])
    
    def test_login_rate_limiting(self):
        """Test rate limiting for failed login attempts."""
        # Make multiple failed login attempts
        login_data = {
            'password': 'wrong_password',
            'remember_me': False
        }
        
        # Make failed attempts to trigger rate limiting
        responses = []
        for i in range(auth_config.MAX_LOGIN_ATTEMPTS + 1):
            response = self.client.post('/auth/login',
                                      data=json.dumps(login_data),
                                      content_type='application/json')
            responses.append(response)
            
            # Add small delay to avoid timing issues
            import time
            time.sleep(0.1)
        
        # First attempt should be 401 (invalid password)
        self.assertEqual(responses[0].status_code, 401)
        
        # Later attempts should be rate limited (429) or invalid password (401)
        # The exact behavior depends on timing and progressive delays
        final_response = responses[-1]
        self.assertEqual(final_response.status_code, 429)
        
        data = json.loads(final_response.data)
        # Should contain either delay message or lockout message
        self.assertTrue(
            'Please wait' in data['error'] or 'locked' in data['error'] or 'Too many' in data['error']
        )
    
    def test_logout_success(self):
        """Test successful logout."""
        # First login
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        login_response = self.client.post('/auth/login',
                                        data=json.dumps(login_data),
                                        content_type='application/json')
        
        self.assertEqual(login_response.status_code, 200)
        
        login_data = json.loads(login_response.data)
        csrf_token = login_data['csrf_token']
        
        # Now logout
        logout_data = {
            'csrf_token': csrf_token
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'Logout successful')
    
    def test_logout_invalid_csrf(self):
        """Test logout with invalid CSRF token."""
        # First login
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        self.client.post('/auth/login',
                        data=json.dumps(login_data),
                        content_type='application/json')
        
        # Try logout with invalid CSRF token
        logout_data = {
            'csrf_token': 'invalid_token'
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Invalid CSRF token')
    
    def test_logout_without_login(self):
        """Test logout without being logged in."""
        logout_data = {
            'csrf_token': 'some_token'
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Invalid CSRF token')
    
    def test_auth_status_not_authenticated(self):
        """Test auth status when not authenticated."""
        response = self.client.get('/auth/status')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
        self.assertIsNone(data['csrf_token'])
        
        # Check security headers
        self.assertIn('X-Content-Type-Options', response.headers)
    
    def test_auth_status_authenticated(self):
        """Test auth status when authenticated."""
        # First login
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        self.client.post('/auth/login',
                        data=json.dumps(login_data),
                        content_type='application/json')
        
        # Check auth status
        response = self.client.get('/auth/status')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['authenticated'])
        self.assertIsNotNone(data['csrf_token'])
        self.assertIn('session_info', data)
        
        # Verify session info structure
        session_info = data['session_info']
        self.assertIn('login_time', session_info)
        self.assertIn('last_activity', session_info)
        self.assertIn('expires_at', session_info)
        self.assertIn('remember_me', session_info)
    
    def test_csrf_token_validation(self):
        """Test CSRF token generation and validation."""
        # Login to get CSRF token
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        login_response = self.client.post('/auth/login',
                                        data=json.dumps(login_data),
                                        content_type='application/json')
        
        login_data = json.loads(login_response.data)
        csrf_token = login_data['csrf_token']
        
        # Verify CSRF token is present and valid format
        self.assertIsNotNone(csrf_token)
        self.assertIsInstance(csrf_token, str)
        self.assertGreater(len(csrf_token), 10)  # Should be reasonably long
        
        # Test that same token is returned in status
        status_response = self.client.get('/auth/status')
        status_data = json.loads(status_response.data)
        
        self.assertEqual(status_data['csrf_token'], csrf_token)
    
    def test_protected_route_access(self):
        """Test access to protected routes."""
        # Try to access protected route without authentication
        response = self.client.get('/')
        
        # Should redirect to login or return 401
        self.assertIn(response.status_code, [302, 401])
        
        # If redirected, check that it's to the login page
        if response.status_code == 302:
            self.assertIn('/auth/login', response.location)
        
        # Login first
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        login_response = self.client.post('/auth/login',
                                        data=json.dumps(login_data),
                                        content_type='application/json')
        
        # Verify login was successful
        self.assertEqual(login_response.status_code, 200)
        
        # Now should be able to access protected route
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
    
    def test_security_headers(self):
        """Test that security headers are properly set."""
        response = self.client.get('/auth/status')
        
        expected_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security',
            'Content-Security-Policy'
        ]
        
        for header in expected_headers:
            self.assertIn(header, response.headers)
        
        # Check specific header values
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
        self.assertEqual(response.headers['X-XSS-Protection'], '1; mode=block')
    
    def test_session_persistence(self):
        """Test that session persists across requests."""
        # Login
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        login_response = self.client.post('/auth/login',
                                        data=json.dumps(login_data),
                                        content_type='application/json')
        
        # Verify login was successful
        self.assertEqual(login_response.status_code, 200)
        
        # Make multiple requests to verify session persistence
        for i in range(3):
            response = self.client.get('/auth/status')
            self.assertEqual(response.status_code, 200)
            
            data = json.loads(response.data)
            self.assertTrue(data['authenticated'], f"Session not persistent on request {i+1}")
    
    def test_form_data_login(self):
        """Test login with form data instead of JSON."""
        login_data = {
            'password': self.test_password,
            'remember_me': 'true'
        }
        
        response = self.client.post('/auth/login', data=login_data)
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])

if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)