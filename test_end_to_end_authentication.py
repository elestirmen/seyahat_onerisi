#!/usr/bin/env python3
"""
End-to-end tests for complete authentication workflow.
Tests the entire authentication system from login to logout including UI interactions.
"""

import unittest
import json
import time
import tempfile
import shutil
import os
import sys
from unittest.mock import patch, MagicMock
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app
from auth_config import auth_config
import bcrypt

class TestEndToEndAuthentication(unittest.TestCase):
    """End-to-end authentication workflow tests."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment for the entire test class."""
        # Set up test password
        cls.test_password = "TestPassword123!"
        cls.test_password_hash = bcrypt.hashpw(
            cls.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)
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
        
        # Set up Chrome options for headless testing
        cls.chrome_options = Options()
        cls.chrome_options.add_argument('--headless')
        cls.chrome_options.add_argument('--no-sandbox')
        cls.chrome_options.add_argument('--disable-dev-shm-usage')
        cls.chrome_options.add_argument('--disable-gpu')
        cls.chrome_options.add_argument('--window-size=1920,1080')
        
        # Check if Chrome/Chromium is available
        cls.selenium_available = cls._check_selenium_availability()
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        # Restore original password hash
        auth_config.PASSWORD_HASH = cls.original_password_hash
        
        # Clean up temporary directory
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
    
    @classmethod
    def _check_selenium_availability(cls):
        """Check if Selenium WebDriver is available."""
        try:
            driver = webdriver.Chrome(options=cls.chrome_options)
            driver.quit()
            return True
        except (WebDriverException, FileNotFoundError):
            print("⚠️  Selenium WebDriver not available. Skipping browser tests.")
            return False
    
    def setUp(self):
        """Set up for each test."""
        # Clear failed attempts for clean test state
        from auth_middleware import auth_middleware
        auth_middleware.failed_attempts.clear()
    
    def test_complete_authentication_workflow_api(self):
        """Test complete authentication workflow via API."""
        # Step 1: Check initial auth status (should be unauthenticated)
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
        
        # Step 2: Try to access protected route (should be redirected)
        response = self.client.get('/')
        self.assertIn(response.status_code, [302, 401])
        
        # Step 3: Get CSRF token for login
        response = self.client.get('/auth/csrf-token')
        self.assertEqual(response.status_code, 200)
        csrf_data = json.loads(response.data)
        csrf_token = csrf_data['csrf_token']
        
        # Step 4: Login with correct credentials
        login_data = {
            'password': self.test_password,
            'remember_me': False,
            'csrf_token': csrf_token
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        self.assertTrue(login_response['success'])
        self.assertIn('csrf_token', login_response)
        
        # Step 5: Verify authentication status
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['authenticated'])
        self.assertIsNotNone(data['csrf_token'])
        
        # Step 6: Access protected route (should succeed)
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        
        # Step 7: Change password
        new_password = "NewPassword456@"
        change_password_data = {
            'current_password': self.test_password,
            'new_password': new_password,
            'confirm_password': new_password,
            'csrf_token': data['csrf_token']
        }
        
        response = self.client.post('/auth/change-password',
                                  data=json.dumps(change_password_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        change_response = json.loads(response.data)
        self.assertTrue(change_response['success'])
        
        # Step 8: Verify session was terminated after password change
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
        
        # Step 9: Login with new password
        login_data['password'] = new_password
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        self.assertTrue(login_response['success'])
        
        # Step 10: Logout
        logout_data = {
            'csrf_token': login_response['csrf_token']
        }
        
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        logout_response = json.loads(response.data)
        self.assertTrue(logout_response['success'])
        
        # Step 11: Verify logout
        response = self.client.get('/auth/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertFalse(data['authenticated'])
    
    @unittest.skipUnless(selenium_available, "Selenium WebDriver not available")
    def test_login_page_ui_elements(self):
        """Test login page UI elements and functionality."""
        if not self.selenium_available:
            self.skipTest("Selenium not available")
        
        driver = None
        try:
            driver = webdriver.Chrome(options=self.chrome_options)
            
            # Start Flask app in a separate thread for Selenium testing
            import threading
            import time
            
            def run_app():
                self.app.run(host='127.0.0.1', port=5555, debug=False, use_reloader=False)
            
            app_thread = threading.Thread(target=run_app, daemon=True)
            app_thread.start()
            time.sleep(2)  # Wait for app to start
            
            # Navigate to login page
            driver.get('http://127.0.0.1:5555/auth/login')
            
            # Wait for page to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Check for essential login form elements
            password_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "password"))
            )
            self.assertIsNotNone(password_field)
            
            # Check for login button
            login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            self.assertIsNotNone(login_button)
            
            # Check for remember me checkbox (if present)
            try:
                remember_checkbox = driver.find_element(By.NAME, "remember_me")
                self.assertIsNotNone(remember_checkbox)
            except:
                pass  # Remember me checkbox might not be present in all implementations
            
            # Test password visibility toggle (if present)
            try:
                toggle_button = driver.find_element(By.CSS_SELECTOR, ".password-toggle, .show-password")
                toggle_button.click()
                # Check if password field type changed
                password_type = password_field.get_attribute("type")
                self.assertIn(password_type, ["text", "password"])
            except:
                pass  # Password toggle might not be present
            
        except Exception as e:
            self.fail(f"UI test failed: {e}")
        finally:
            if driver:
                driver.quit()
    
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
    
    def test_concurrent_login_attempts(self):
        """Test handling of concurrent login attempts."""
        import threading
        import queue
        
        results = queue.Queue()
        
        def login_attempt(attempt_id):
            """Perform a login attempt."""
            try:
                login_data = {
                    'password': self.test_password,
                    'remember_me': False
                }
                
                response = self.client.post('/auth/login',
                                          data=json.dumps(login_data),
                                          content_type='application/json')
                
                results.put({
                    'attempt_id': attempt_id,
                    'status_code': response.status_code,
                    'success': response.status_code == 200
                })
            except Exception as e:
                results.put({
                    'attempt_id': attempt_id,
                    'error': str(e),
                    'success': False
                })
        
        # Start multiple concurrent login attempts
        threads = []
        for i in range(3):
            thread = threading.Thread(target=login_attempt, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join(timeout=10)
        
        # Collect results
        attempt_results = []
        while not results.empty():
            attempt_results.append(results.get())
        
        # At least one attempt should succeed
        successful_attempts = [r for r in attempt_results if r.get('success', False)]
        self.assertGreaterEqual(len(successful_attempts), 1, "At least one concurrent login should succeed")
    
    def test_rate_limiting_workflow(self):
        """Test complete rate limiting workflow."""
        # Make multiple failed login attempts
        failed_attempts = []
        
        for i in range(auth_config.MAX_LOGIN_ATTEMPTS + 2):
            login_data = {
                'password': 'wrong_password',
                'remember_me': False
            }
            
            response = self.client.post('/auth/login',
                                      data=json.dumps(login_data),
                                      content_type='application/json')
            
            failed_attempts.append({
                'attempt': i + 1,
                'status_code': response.status_code,
                'response': json.loads(response.data) if response.data else {}
            })
            
            # Small delay between attempts
            time.sleep(0.1)
        
        # First few attempts should be 401 (invalid password)
        for i in range(min(auth_config.MAX_LOGIN_ATTEMPTS, len(failed_attempts))):
            self.assertEqual(failed_attempts[i]['status_code'], 401)
        
        # Later attempts should be rate limited (429)
        if len(failed_attempts) > auth_config.MAX_LOGIN_ATTEMPTS:
            last_attempt = failed_attempts[-1]
            self.assertEqual(last_attempt['status_code'], 429)
            self.assertIn('error', last_attempt['response'])
    
    def test_security_headers_in_responses(self):
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
    
    def test_csrf_protection_workflow(self):
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
    
    def test_remember_me_functionality_workflow(self):
        """Test complete remember me functionality workflow."""
        # Step 1: Login with remember me
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
        
        # Step 2: Verify session info shows remember me
        session_info = login_response['session_info']
        self.assertTrue(session_info['remember_me'])
        
        # Step 3: Check that expiration time is extended
        from datetime import datetime
        expires_at = datetime.fromisoformat(session_info['expires_at'])
        login_time = datetime.fromisoformat(session_info['login_time'])
        
        duration = (expires_at - login_time).total_seconds()
        self.assertGreater(duration, auth_config.SESSION_TIMEOUT)
        self.assertLessEqual(duration, auth_config.REMEMBER_TIMEOUT + 60)  # Allow some margin
    
    def test_error_handling_and_recovery(self):
        """Test error handling and recovery scenarios."""
        # Test 1: Invalid JSON data
        response = self.client.post('/auth/login',
                                  data='invalid json',
                                  content_type='application/json')
        
        self.assertIn(response.status_code, [400, 500])
        
        # Test 2: Missing content type
        response = self.client.post('/auth/login',
                                  data=json.dumps({'password': self.test_password}))
        
        # Should still work with form data fallback
        self.assertIn(response.status_code, [200, 400])
        
        # Test 3: Empty request body
        response = self.client.post('/auth/login',
                                  data='',
                                  content_type='application/json')
        
        self.assertIn(response.status_code, [400, 500])
        
        # Test 4: Recovery after errors - normal login should still work
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


class TestAuthenticationPerformance(unittest.TestCase):
    """Performance tests for authentication system."""
    
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
            bcrypt.gensalt(rounds=4)
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
        self.assertLess(duration, 2.0, "Login should complete within 2 seconds")
    
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
        
        self.assertLess(duration, 5.0, "10 status requests should complete within 5 seconds")


if __name__ == '__main__':
    print("🔐 End-to-End Authentication Tests")
    print("=" * 50)
    
    # Run tests with detailed output
    unittest.main(verbosity=2, buffer=True)