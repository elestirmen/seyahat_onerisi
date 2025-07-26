#!/usr/bin/env python3
"""
Test script for session timeout and "Remember Me" functionality.
This script tests the implementation of task 7.
"""

import unittest
import tempfile
import os
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, session
from auth_middleware import auth_middleware
from auth_config import auth_config
from session_config import configure_session

class TestSessionTimeout(unittest.TestCase):
    """Test session timeout and Remember Me functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        
        # Configure session
        configure_session(self.app)
        
        # Initialize auth middleware
        auth_middleware.init_app(self.app)
        
        # Set shorter timeouts for testing
        self.original_session_timeout = auth_config.SESSION_TIMEOUT
        self.original_remember_timeout = auth_config.REMEMBER_TIMEOUT
        
        auth_config.SESSION_TIMEOUT = 5  # 5 seconds for testing
        auth_config.REMEMBER_TIMEOUT = 10  # 10 seconds for testing
        
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
    
    def tearDown(self):
        """Clean up test environment."""
        # Restore original timeouts
        auth_config.SESSION_TIMEOUT = self.original_session_timeout
        auth_config.REMEMBER_TIMEOUT = self.original_remember_timeout
        
        self.app_context.pop()
    
    def test_session_timeout_normal(self):
        """Test normal session timeout (without remember me)."""
        with self.app.test_request_context():
            # Create session without remember me
            success = auth_middleware.create_session(remember_me=False)
            self.assertTrue(success)
            self.assertTrue(auth_middleware.is_authenticated())
            
            # Session should be valid initially
            self.assertTrue(auth_middleware.validate_session())
            
            # Wait for session to expire
            time.sleep(6)  # Wait longer than SESSION_TIMEOUT (5 seconds)
            
            # Session should now be expired
            self.assertFalse(auth_middleware.validate_session())
            self.assertFalse(auth_middleware.is_authenticated())
    
    def test_session_timeout_remember_me(self):
        """Test extended session timeout with remember me."""
        with self.app.test_request_context():
            # Create session with remember me
            success = auth_middleware.create_session(remember_me=True)
            self.assertTrue(success)
            self.assertTrue(auth_middleware.is_authenticated())
            
            # Session should be valid initially
            self.assertTrue(auth_middleware.validate_session())
            
            # Wait for normal session timeout but less than remember timeout
            time.sleep(6)  # Wait longer than SESSION_TIMEOUT (5 seconds) but less than REMEMBER_TIMEOUT (10 seconds)
            
            # Session should still be valid due to remember me
            self.assertTrue(auth_middleware.validate_session())
            self.assertTrue(auth_middleware.is_authenticated())
            
            # Wait for remember me timeout (need to wait from last activity, not from start)
            time.sleep(11)  # Wait longer than REMEMBER_TIMEOUT (10 seconds) from last validation
            
            # Session should now be expired
            self.assertFalse(auth_middleware.validate_session())
            self.assertFalse(auth_middleware.is_authenticated())
    
    def test_session_info_expiration_time(self):
        """Test that session info includes correct expiration time."""
        with self.app.test_request_context():
            # Test normal session
            auth_middleware.create_session(remember_me=False)
            session_info = auth_middleware.get_session_info()
            
            self.assertIsNotNone(session_info)
            self.assertIn('expires_at', session_info)
            self.assertFalse(session_info['remember_me'])
            
            expires_at = datetime.fromisoformat(session_info['expires_at'])
            last_activity = datetime.fromisoformat(session_info['last_activity'])
            
            # Check that expiration is SESSION_TIMEOUT seconds after last activity
            expected_expiration = last_activity + timedelta(seconds=auth_config.SESSION_TIMEOUT)
            self.assertEqual(expires_at.replace(microsecond=0), expected_expiration.replace(microsecond=0))
    
    def test_session_info_remember_me_expiration(self):
        """Test that session info includes correct expiration time for remember me."""
        with self.app.test_request_context():
            # Test remember me session
            auth_middleware.create_session(remember_me=True)
            session_info = auth_middleware.get_session_info()
            
            self.assertIsNotNone(session_info)
            self.assertIn('expires_at', session_info)
            self.assertTrue(session_info['remember_me'])
            
            expires_at = datetime.fromisoformat(session_info['expires_at'])
            last_activity = datetime.fromisoformat(session_info['last_activity'])
            
            # Check that expiration is REMEMBER_TIMEOUT seconds after last activity
            expected_expiration = last_activity + timedelta(seconds=auth_config.REMEMBER_TIMEOUT)
            self.assertEqual(expires_at.replace(microsecond=0), expected_expiration.replace(microsecond=0))
    
    def test_session_cleanup(self):
        """Test session cleanup functionality."""
        # Create some temporary session files
        session_dir = os.path.join(tempfile.gettempdir(), 'poi_sessions')
        os.makedirs(session_dir, exist_ok=True)
        
        # Create an old session file
        old_session_file = os.path.join(session_dir, 'session:old_session')
        with open(old_session_file, 'w') as f:
            f.write('old session data')
        
        # Set file modification time to be very old
        old_time = time.time() - (auth_config.REMEMBER_TIMEOUT + 3600)  # 1 hour older than max timeout
        os.utime(old_session_file, (old_time, old_time))
        
        # Create a recent session file
        recent_session_file = os.path.join(session_dir, 'session:recent_session')
        with open(recent_session_file, 'w') as f:
            f.write('recent session data')
        
        # Run cleanup
        cleaned_count = auth_middleware.cleanup_expired_sessions()
        
        # Old session should be cleaned, recent should remain
        self.assertGreaterEqual(cleaned_count, 1)
        self.assertFalse(os.path.exists(old_session_file))
        self.assertTrue(os.path.exists(recent_session_file))
        
        # Clean up test files
        if os.path.exists(recent_session_file):
            os.remove(recent_session_file)
    
    def test_session_activity_update(self):
        """Test that session activity is updated on validation."""
        with self.app.test_request_context():
            # Create session
            auth_middleware.create_session(remember_me=False)
            
            # Get initial session info
            initial_info = auth_middleware.get_session_info()
            initial_activity = datetime.fromisoformat(initial_info['last_activity'])
            
            # Wait a bit
            time.sleep(1)
            
            # Validate session (should update last_activity)
            self.assertTrue(auth_middleware.validate_session())
            
            # Get updated session info
            updated_info = auth_middleware.get_session_info()
            updated_activity = datetime.fromisoformat(updated_info['last_activity'])
            
            # Last activity should be updated
            self.assertGreater(updated_activity, initial_activity)

def run_tests():
    """Run the session timeout tests."""
    print("Testing Session Timeout and Remember Me Functionality")
    print("=" * 60)
    
    # Run tests
    unittest.main(verbosity=2, exit=False)

if __name__ == '__main__':
    run_tests()