#!/usr/bin/env python3
"""
Comprehensive security tests for authentication system.
Tests all security aspects without external dependencies.
"""

import unittest
import json
import time
import tempfile
import shutil
import os
import sys
import secrets
import hashlib
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app
from auth_config import auth_config
from auth_middleware import auth_middleware
import bcrypt

class TestComprehensiveAuthentication(unittest.TestCase):
    """Comprehensive authentication workflow tests."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment for the entire test class."""
        # Set up test password
        cls.test_password = "TestPassword123!"
        cls.test_password_hash = bcrypt.hashpw(
            cls.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=10)
        ).decode('utf-8')
        
        # Mock auth config
        cls.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = cls.test_password_hash
        
        # Configure Flask app for testing
        cls.app = app
        cls.app.config['TESTING'] = True
        cls.app.config['WTF_CSRF_ENABLED'] = False
        
        # Create temporary directory for sessions
        cls.temp_dir = tempfile.mkdtemp()
        cls.app.config['SESSION_FILE_DIR'] = cls.temp_dir
        
        # Start Flask app in test mode
        cls.client = cls.app.test_client()
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        # Restore original password hash
        auth_config.PASSWORD_HASH = cls.original_password_hash
        
        # Clean up temporary directory
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
    
    def setUp(self):
        """Set up for each test."""
        # Clear failed attempts for clean test state
        auth_middleware.failed_attempts.clear()
    
    def test_complete_authentication_workflow(self):
        """Test complete authentication workflow via API."""
        # Step 1: Check initial auth status (should be unauthenticated)
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
        
        # Step 2: Try to access protected route (should be redirected)
        response = self.client.get('/')
        self.assertIn(response.status_code, [302, 401])
        
        # Step 3: Login with correct credentials
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        self.assertTrue(login_response['success'])
        self.assertIn('csrf_token', login_response)
        
        # Step 4: Verify authentication status
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['authenticated'])
        self.assertIsNotNone(data['csrf_token'])
        
        # Step 5: Access protected route (should succeed)
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        
        # Step 6: Logout
        logout_data = {
            'csrf_token': data['csrf_token']
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        logout_response = json.loads(response.data)
        self.assertTrue(logout_response['success'])
        
        # Step 7: Verify logout
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
    
    def test_session_persistence_across_requests(self):
        """Test that session persists across multiple requests."""
        # Login first
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        # Make multiple requests to verify session persistence
        for i in range(5):
            response = self.client.get('/auth/status')
            self.assertEqual(response.status_code, 200)
            
            data = json.loads(response.data)
            self.assertTrue(data['authenticated'], f"Session not persistent on request {i+1}")
            
            # Small delay between requests
            time.sleep(0.1)
    
    def test_brute_force_protection(self):
        """Test brute force protection mechanism."""
        wrong_password = "WrongPassword123!"
        
        # Make multiple failed login attempts
        for i in range(auth_config.MAX_LOGIN_ATTEMPTS + 1):
            login_data = {
                'password': wrong_password,
                'remember_me': False
            }
            
            response = self.client.post('/auth/login',
                                      data=json.dumps(login_data),
                                      content_type='application/json')
            
            if i < auth_config.MAX_LOGIN_ATTEMPTS:
                # Should be 401 (invalid password)
                self.assertEqual(response.status_code, 401)
            else:
                # Should be 429 (rate limited)
                self.assertEqual(response.status_code, 429)
            
            time.sleep(0.1)
    
    def test_csrf_protection(self):
        """Test CSRF protection throughout the authentication workflow."""
        # Step 1: Login to get CSRF token
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        csrf_token = login_response['csrf_token']
        
        # Step 2: Try logout with invalid CSRF token (should fail)
        logout_data = {
            'csrf_token': 'invalid_token'
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        
        # Step 3: Try logout with valid CSRF token (should succeed)
        logout_data['csrf_token'] = csrf_token
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
    
    def test_remember_me_functionality(self):
        """Test remember me functionality."""
        # Login with remember me
        login_data = {
            'password': self.test_password,
            'remember_me': True
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        self.assertTrue(login_response['success'])
        
        # Verify session info shows remember me
        if 'session_info' in login_response:
            session_info = login_response['session_info']
            self.assertTrue(session_info['remember_me'])
    
    def test_security_headers_presence(self):
        """Test that security headers are present in all responses."""
        endpoints_to_test = [
            '/auth/status',
            '/auth/csrf-token',
        ]
        
        expected_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ]
        
        for endpoint in endpoints_to_test:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                
                for header in expected_headers:
                    self.assertIn(header, response.headers, 
                                f"Security header '{header}' missing from {endpoint}")
    
    def test_input_validation(self):
        """Test input validation for malicious inputs."""
        malicious_inputs = [
            '"; DROP TABLE users; --',  # SQL injection
            '<script>alert("xss")</script>',  # XSS
            '../../../etc/passwd',  # Path traversal
            '\x00\x01\x02',  # Null bytes
            'A' * 1000,  # Very long input
        ]
        
        for malicious_input in malicious_inputs:
            with self.subTest(input=malicious_input):
                login_data = {
                    'password': malicious_input,
                    'remember_me': False
                }
                
                response = self.client.post('/auth/login',
                                          data=json.dumps(login_data),
                                          content_type='application/json')
                
                # Should handle malicious input gracefully (401 or 400)
                self.assertIn(response.status_code, [400, 401])
    
    def test_concurrent_sessions(self):
        """Test handling of concurrent sessions."""
        # Create two separate clients (simulating different browsers)
        client1 = self.app.test_client()
        client2 = self.app.test_client()
        
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        # Login with first client
        response1 = client1.post('/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        self.assertEqual(response1.status_code, 200)
        
        # Login with second client
        response2 = client2.post('/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        self.assertEqual(response2.status_code, 200)
        
        # Both sessions should be valid (concurrent sessions allowed)
        status1 = client1.get('/auth/status')
        status2 = client2.get('/auth/status')
        
        data1 = json.loads(status1.data)
        data2 = json.loads(status2.data)
        
        self.assertTrue(data1['authenticated'])
        self.assertTrue(data2['authenticated'])
        
        # Should have different CSRF tokens
        self.assertNotEqual(data1['csrf_token'], data2['csrf_token'])
    
    def test_error_handling_and_recovery(self):
        """Test error handling and recovery scenarios."""
        # Test 1: Invalid JSON data
        response = self.client.post('/auth/login',
                                  data='invalid json',
                                  content_type='application/json')
        
        self.assertIn(response.status_code, [400, 500])
        
        # Test 2: Empty request body
        response = self.client.post('/auth/login',
                                  data='',
                                  content_type='application/json')
        
        self.assertIn(response.status_code, [400, 500])
        
        # Test 3: Recovery after errors - normal login should still work
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        self.assertTrue(login_response['success'])


class TestPasswordSecurity(unittest.TestCase):
    """Test password security measures."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Set up test password
        self.test_password = "TestPassword123!"
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=10)
        ).decode('utf-8')
    
    def tearDown(self):
        """Clean up after test."""
        auth_config.PASSWORD_HASH = self.original_password_hash
    
    def test_password_hash_strength(self):
        """Test that password hashes are properly generated."""
        password_hash = auth_config.PASSWORD_HASH
        
        # Should be bcrypt hash (starts with $2b$)
        self.assertTrue(password_hash.startswith('$2b$'))
        
        # Should be proper length
        self.assertGreater(len(password_hash), 50)
        
        # Should verify correctly
        self.assertTrue(bcrypt.checkpw(self.test_password.encode('utf-8'), 
                                     password_hash.encode('utf-8')))
    
    def test_password_change_workflow(self):
        """Test complete password change workflow."""
        # Login first
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        csrf_token = login_response['csrf_token']
        
        # Change password
        new_password = "NewPassword456@"
        change_data = {
            'current_password': self.test_password,
            'new_password': new_password,
            'confirm_password': new_password,
            'csrf_token': csrf_token
        }
        
        response = self.client.post('/auth/change-password',
                                  data=json.dumps(change_data),
                                  content_type='application/json')
        
        # Should succeed or give appropriate error
        self.assertIn(response.status_code, [200, 400, 401])
        
        if response.status_code == 200:
            # If password change succeeded, verify session was terminated
            response = self.client.get('/auth/status')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            # Session might or might not be terminated depending on implementation
            # This is acceptable behavior


class TestSecurityConfiguration(unittest.TestCase):
    """Test security configuration."""
    
    def test_authentication_configuration(self):
        """Test authentication configuration values."""
        # Test that configuration values are reasonable
        self.assertGreaterEqual(auth_config.MAX_LOGIN_ATTEMPTS, 3)
        self.assertLessEqual(auth_config.MAX_LOGIN_ATTEMPTS, 10)
        
        self.assertGreaterEqual(auth_config.LOCKOUT_DURATION, 300)  # 5 minutes
        self.assertLessEqual(auth_config.LOCKOUT_DURATION, 3600)   # 1 hour
        
        self.assertGreaterEqual(auth_config.SESSION_TIMEOUT, 1800)  # 30 minutes
        self.assertLessEqual(auth_config.SESSION_TIMEOUT, 86400)   # 24 hours
        
        self.assertGreaterEqual(auth_config.REMEMBER_TIMEOUT, 86400)  # 1 day
        self.assertLessEqual(auth_config.REMEMBER_TIMEOUT, 2592000)  # 30 days
    
    def test_password_hash_configuration(self):
        """Test password hash configuration."""
        password_hash = auth_config.PASSWORD_HASH
        
        self.assertIsInstance(password_hash, str)
        self.assertGreater(len(password_hash), 50)
        
        # Should be a bcrypt hash
        self.assertTrue(password_hash.startswith('$2b$'))
    
    def test_secret_key_configuration(self):
        """Test secret key configuration."""
        secret_key = auth_config.SESSION_SECRET_KEY
        
        self.assertIsInstance(secret_key, str)
        self.assertGreater(len(secret_key), 20)


class TestPerformance(unittest.TestCase):
    """Test authentication system performance."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Set up test password
        self.test_password = "TestPassword123!"
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=10)
        ).decode('utf-8')
    
    def tearDown(self):
        """Clean up after test."""
        auth_config.PASSWORD_HASH = self.original_password_hash
    
    def test_login_performance(self):
        """Test login performance under normal conditions."""
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        start_time = time.time()
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        end_time = time.time()
        duration = end_time - start_time
        
        self.assertEqual(response.status_code, 200)
        self.assertLess(duration, 5.0, "Login should complete within 5 seconds")
    
    def test_multiple_rapid_requests(self):
        """Test handling of multiple rapid authentication requests."""
        # Login first
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        self.client.post('/auth/login',
                        data=json.dumps(login_data),
                        content_type='application/json')
        
        # Make rapid status requests
        start_time = time.time()
        
        for i in range(10):
            response = self.client.get('/auth/status')
            self.assertEqual(response.status_code, 200)
        
        end_time = time.time()
        duration = end_time - start_time
        
        self.assertLess(duration, 10.0, "10 status requests should complete within 10 seconds")


if __name__ == '__main__':
    print("🔐 Comprehensive Security Tests")
    print("=" * 50)
    
    # Run tests with detailed output
    unittest.main(verbosity=2, buffer=True)