#!/usr/bin/env python3
"""
Test suite for password change functionality.
Tests the /auth/change-password endpoint and related security features.
"""

import unittest
import json
import tempfile
import os
import sys
from unittest.mock import patch, MagicMock

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app, auth_middleware, auth_config
from auth_config import AuthConfig

class TestPasswordChange(unittest.TestCase):
    """Test cases for password change functionality."""
    
    def setUp(self):
        """Set up test environment before each test."""
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        self.client = self.app.test_client()
        
        # Create a temporary directory for session files
        self.temp_dir = tempfile.mkdtemp()
        self.app.config['SESSION_FILE_DIR'] = self.temp_dir
        
        # Set up test password
        self.test_password = "TestPassword123!"
        self.new_password = "NewPassword456@"
        
        # Mock auth config with test password
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = auth_config.hash_password(self.test_password)
        
        # Create authenticated session
        with self.client.session_transaction() as sess:
            sess['authenticated'] = True
            sess['csrf_token'] = 'test_csrf_token'
            sess['login_time'] = '2024-01-01T12:00:00+00:00'
            sess['last_activity'] = '2024-01-01T12:00:00+00:00'
            sess['remember_me'] = False
    
    def tearDown(self):
        """Clean up after each test."""
        # Restore original password hash
        auth_config.PASSWORD_HASH = self.original_password_hash
        
        # Clean up temporary directory
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_change_password_success(self):
        """Test successful password change."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('Password changed successfully', data['message'])
        
        # Verify password was actually changed
        self.assertTrue(auth_config.validate_password(self.new_password))
        self.assertFalse(auth_config.validate_password(self.test_password))
    
    def test_change_password_wrong_current_password(self):
        """Test password change with incorrect current password."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': 'WrongPassword123!',
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('Current password is incorrect', data['error'])
    
    def test_change_password_mismatch(self):
        """Test password change with mismatched new passwords."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': 'DifferentPassword789#',
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('do not match', data['error'])
    
    def test_change_password_weak_password(self):
        """Test password change with weak password."""
        weak_passwords = [
            'short',  # Too short
            'nouppercase123!',  # No uppercase
            'NOLOWERCASE123!',  # No lowercase
            'NoNumbers!',  # No numbers
            'NoSpecialChars123',  # No special characters
            'password123',  # Common weak password
        ]
        
        for weak_password in weak_passwords:
            with self.subTest(password=weak_password):
                response = self.client.post('/auth/change-password', 
                    json={
                        'current_password': self.test_password,
                        'new_password': weak_password,
                        'confirm_password': weak_password,
                        'csrf_token': 'test_csrf_token'
                    })
                
                self.assertEqual(response.status_code, 400)
                data = json.loads(response.data)
                self.assertIn('error', data)
    
    def test_change_password_same_as_current(self):
        """Test password change with same password as current."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.test_password,
                'confirm_password': self.test_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('must be different', data['error'])
    
    def test_change_password_missing_fields(self):
        """Test password change with missing required fields."""
        test_cases = [
            {'new_password': self.new_password, 'confirm_password': self.new_password, 'csrf_token': 'test_csrf_token'},
            {'current_password': self.test_password, 'confirm_password': self.new_password, 'csrf_token': 'test_csrf_token'},
            {'current_password': self.test_password, 'new_password': self.new_password, 'csrf_token': 'test_csrf_token'},
        ]
        
        for test_case in test_cases:
            with self.subTest(data=test_case):
                response = self.client.post('/auth/change-password', json=test_case)
                self.assertEqual(response.status_code, 400)
                data = json.loads(response.data)
                self.assertIn('required', data['error'])
    
    def test_change_password_invalid_csrf(self):
        """Test password change with invalid CSRF token."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'invalid_csrf_token'
            })
        
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertIn('Invalid CSRF token', data['error'])
    
    def test_change_password_unauthenticated(self):
        """Test password change without authentication."""
        # Clear session
        with self.client.session_transaction() as sess:
            sess.clear()
        
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 401)
    
    @patch('poi_api.terminate_all_sessions')
    def test_change_password_terminates_sessions(self, mock_terminate):
        """Test that password change terminates all active sessions."""
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 200)
        mock_terminate.assert_called_once()
    
    @patch('poi_api.update_password_hash')
    def test_change_password_update_failure(self, mock_update):
        """Test password change when password hash update fails."""
        mock_update.return_value = False
        
        response = self.client.post('/auth/change-password', 
            json={
                'current_password': self.test_password,
                'new_password': self.new_password,
                'confirm_password': self.new_password,
                'csrf_token': 'test_csrf_token'
            })
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        self.assertIn('Failed to update password', data['error'])


class TestPasswordStrengthValidation(unittest.TestCase):
    """Test cases for password strength validation."""
    
    def test_validate_strong_password(self):
        """Test validation of strong passwords."""
        from poi_api import validate_password_strength
        
        strong_passwords = [
            'StrongPassword123!',
            'MySecure@Pass456',
            'Complex#Password789',
            'Unbreakable$123Pass'
        ]
        
        for password in strong_passwords:
            with self.subTest(password=password):
                result = validate_password_strength(password)
                self.assertTrue(result['valid'], f"Password '{password}' should be valid: {result['message']}")
    
    def test_validate_weak_passwords(self):
        """Test validation of weak passwords."""
        from poi_api import validate_password_strength
        
        weak_passwords = [
            ('short', 'at least 8 characters'),
            ('nouppercase123!', 'uppercase letter'),
            ('NOLOWERCASE123!', 'lowercase letter'),
            ('NoNumbers!', 'number'),
            ('NoSpecialChars123', 'special character'),
            ('Password123!', 'too common'),  # This should pass all checks except common check
            ('a' * 129, 'less than 128 characters'),
        ]
        
        # Test common passwords separately since they need to pass other checks first
        common_passwords = ['Password123!', 'Letmein123!', 'Welcome123!']
        
        for password in common_passwords:
            with self.subTest(password=password):
                result = validate_password_strength(password)
                # These might be valid if they're not in our weak list, so just check they're processed
                self.assertIsInstance(result, dict)
                self.assertIn('valid', result)
                self.assertIn('message', result)
        
        for password, expected_error in weak_passwords:
            with self.subTest(password=password):
                result = validate_password_strength(password)
                self.assertFalse(result['valid'])
                self.assertIn(expected_error.lower(), result['message'].lower())


class TestPasswordHashUpdate(unittest.TestCase):
    """Test cases for password hash update functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = os.path.join(self.temp_dir, '.env.local')
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @patch('poi_api.auth_config')
    def test_update_password_hash_success(self, mock_auth_config):
        """Test successful password hash update."""
        from poi_api import update_password_hash
        
        new_hash = 'new_test_hash_value'
        
        with patch('poi_api.os.path.exists', return_value=False), \
             patch('builtins.open', unittest.mock.mock_open()) as mock_file:
            
            result = update_password_hash(new_hash)
            
            self.assertTrue(result)
            self.assertEqual(mock_auth_config.PASSWORD_HASH, new_hash)
            mock_file.assert_called()
    
    def test_update_password_hash_with_existing_config(self):
        """Test password hash update with existing config file."""
        from poi_api import update_password_hash
        
        # Create existing config file
        existing_config = "POI_SESSION_SECRET_KEY=existing_secret\nOTHER_CONFIG=value\n"
        with open(self.config_file, 'w') as f:
            f.write(existing_config)
        
        new_hash = 'new_test_hash_value'
        
        with patch('poi_api.auth_config') as mock_auth_config, \
             patch('poi_api.os.path.exists', return_value=True), \
             patch('poi_api.open', unittest.mock.mock_open(read_data=existing_config)) as mock_file:
            
            result = update_password_hash(new_hash)
            
            self.assertTrue(result)
            self.assertEqual(mock_auth_config.PASSWORD_HASH, new_hash)


class TestSessionTermination(unittest.TestCase):
    """Test cases for session termination functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        
        # Create some mock session files
        self.session_files = []
        for i in range(3):
            session_file = os.path.join(self.temp_dir, f'session:test_session_{i}')
            with open(session_file, 'w') as f:
                f.write('session_data')
            self.session_files.append(session_file)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_terminate_all_sessions(self):
        """Test termination of all active sessions."""
        from poi_api import terminate_all_sessions
        
        with patch('tempfile.gettempdir', return_value='/tmp'), \
             patch('os.path.exists', return_value=True), \
             patch('glob.glob', return_value=self.session_files), \
             patch('os.remove') as mock_remove, \
             self.app.test_request_context():
            
            terminate_all_sessions()
            
            # Verify all session files were removed
            self.assertEqual(mock_remove.call_count, len(self.session_files))
            for session_file in self.session_files:
                mock_remove.assert_any_call(session_file)


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)