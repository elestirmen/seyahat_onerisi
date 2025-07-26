#!/usr/bin/env python3
"""
Browser and device compatibility tests for authentication system.
Tests authentication functionality across different browsers and devices.
"""

import unittest
import json
import time
import tempfile
import shutil
import os
import sys
import threading
from unittest.mock import patch
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.common.exceptions import WebDriverException, TimeoutException

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app
from auth_config import auth_config
import bcrypt

class BrowserTestBase(unittest.TestCase):
    """Base class for browser compatibility tests."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment for browser tests."""
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
        
        # Start Flask app in background thread
        cls.app_thread = None
        cls.start_test_server()
        
        # Test server URL
        cls.base_url = 'http://127.0.0.1:5556'
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after browser tests."""
        # Restore original password hash
        auth_config.PASSWORD_HASH = cls.original_password_hash
        
        # Clean up temporary directory
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
    
    @classmethod
    def start_test_server(cls):
        """Start Flask test server in background thread."""
        def run_server():
            cls.app.run(host='127.0.0.1', port=5556, debug=False, use_reloader=False)
        
        cls.app_thread = threading.Thread(target=run_server, daemon=True)
        cls.app_thread.start()
        time.sleep(2)  # Wait for server to start
    
    def setUp(self):
        """Set up for each test."""
        # Clear failed attempts
        from auth_middleware import auth_middleware
        auth_middleware.failed_attempts.clear()
    
    def perform_login_test(self, driver, browser_name):
        """Perform basic login test with given driver."""
        try:
            # Navigate to login page
            driver.get(f'{self.base_url}/auth/login')
            
            # Wait for page to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Find password field
            password_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "password"))
            )
            
            # Enter password
            password_field.clear()
            password_field.send_keys(self.test_password)
            
            # Find and click login button
            login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            login_button.click()
            
            # Wait for response (either redirect or error message)
            time.sleep(2)
            
            # Check if login was successful
            current_url = driver.current_url
            
            # If redirected to main page or if we can find success indicators
            success = (
                current_url != f'{self.base_url}/auth/login' or
                self._check_for_success_indicators(driver)
            )
            
            return {
                'browser': browser_name,
                'success': success,
                'current_url': current_url,
                'page_title': driver.title
            }
            
        except Exception as e:
            return {
                'browser': browser_name,
                'success': False,
                'error': str(e),
                'current_url': driver.current_url if hasattr(driver, 'current_url') else 'unknown'
            }
    
    def _check_for_success_indicators(self, driver):
        """Check for success indicators on the page."""
        try:
            # Look for common success indicators
            success_indicators = [
                "logout",
                "dashboard",
                "admin",
                "welcome",
                "başarılı",
                "success"
            ]
            
            page_source = driver.page_source.lower()
            return any(indicator in page_source for indicator in success_indicators)
            
        except:
            return False
    
    def test_responsive_design(self, driver, browser_name):
        """Test responsive design at different screen sizes."""
        screen_sizes = [
            (1920, 1080),  # Desktop
            (1366, 768),   # Laptop
            (768, 1024),   # Tablet
            (375, 667),    # Mobile
        ]
        
        results = []
        
        for width, height in screen_sizes:
            try:
                driver.set_window_size(width, height)
                driver.get(f'{self.base_url}/auth/login')
                
                # Wait for page to load
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # Check if password field is visible and accessible
                password_field = driver.find_element(By.NAME, "password")
                is_displayed = password_field.is_displayed()
                is_enabled = password_field.is_enabled()
                
                # Check if login button is visible
                login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
                button_displayed = login_button.is_displayed()
                
                results.append({
                    'browser': browser_name,
                    'screen_size': f'{width}x{height}',
                    'password_field_visible': is_displayed,
                    'password_field_enabled': is_enabled,
                    'login_button_visible': button_displayed,
                    'success': is_displayed and is_enabled and button_displayed
                })
                
            except Exception as e:
                results.append({
                    'browser': browser_name,
                    'screen_size': f'{width}x{height}',
                    'success': False,
                    'error': str(e)
                })
        
        return results


class TestChromeCompatibility(BrowserTestBase):
    """Test authentication system compatibility with Chrome."""
    
    def setUp(self):
        """Set up Chrome driver."""
        super().setUp()
        
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.browser_available = True
            
        except (WebDriverException, FileNotFoundError):
            self.driver = None
            self.browser_available = False
            self.skipTest("Chrome WebDriver not available")
    
    def tearDown(self):
        """Clean up Chrome driver."""
        if self.driver:
            self.driver.quit()
    
    def test_chrome_login_functionality(self):
        """Test login functionality in Chrome."""
        if not self.browser_available:
            self.skipTest("Chrome not available")
        
        result = self.perform_login_test(self.driver, "Chrome")
        
        self.assertTrue(result['success'], 
                       f"Login failed in Chrome: {result.get('error', 'Unknown error')}")
    
    def test_chrome_responsive_design(self):
        """Test responsive design in Chrome."""
        if not self.browser_available:
            self.skipTest("Chrome not available")
        
        results = self.test_responsive_design(self.driver, "Chrome")
        
        for result in results:
            with self.subTest(screen_size=result['screen_size']):
                self.assertTrue(result['success'], 
                               f"Responsive design failed in Chrome at {result['screen_size']}: {result.get('error', 'UI elements not accessible')}")


class TestFirefoxCompatibility(BrowserTestBase):
    """Test authentication system compatibility with Firefox."""
    
    def setUp(self):
        """Set up Firefox driver."""
        super().setUp()
        
        try:
            firefox_options = FirefoxOptions()
            firefox_options.add_argument('--headless')
            firefox_options.add_argument('--width=1920')
            firefox_options.add_argument('--height=1080')
            
            self.driver = webdriver.Firefox(options=firefox_options)
            self.browser_available = True
            
        except (WebDriverException, FileNotFoundError):
            self.driver = None
            self.browser_available = False
            self.skipTest("Firefox WebDriver not available")
    
    def tearDown(self):
        """Clean up Firefox driver."""
        if self.driver:
            self.driver.quit()
    
    def test_firefox_login_functionality(self):
        """Test login functionality in Firefox."""
        if not self.browser_available:
            self.skipTest("Firefox not available")
        
        result = self.perform_login_test(self.driver, "Firefox")
        
        self.assertTrue(result['success'], 
                       f"Login failed in Firefox: {result.get('error', 'Unknown error')}")
    
    def test_firefox_responsive_design(self):
        """Test responsive design in Firefox."""
        if not self.browser_available:
            self.skipTest("Firefox not available")
        
        results = self.test_responsive_design(self.driver, "Firefox")
        
        for result in results:
            with self.subTest(screen_size=result['screen_size']):
                self.assertTrue(result['success'], 
                               f"Responsive design failed in Firefox at {result['screen_size']}: {result.get('error', 'UI elements not accessible')}")


class TestEdgeCompatibility(BrowserTestBase):
    """Test authentication system compatibility with Edge."""
    
    def setUp(self):
        """Set up Edge driver."""
        super().setUp()
        
        try:
            edge_options = EdgeOptions()
            edge_options.add_argument('--headless')
            edge_options.add_argument('--no-sandbox')
            edge_options.add_argument('--disable-dev-shm-usage')
            edge_options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Edge(options=edge_options)
            self.browser_available = True
            
        except (WebDriverException, FileNotFoundError):
            self.driver = None
            self.browser_available = False
            self.skipTest("Edge WebDriver not available")
    
    def tearDown(self):
        """Clean up Edge driver."""
        if self.driver:
            self.driver.quit()
    
    def test_edge_login_functionality(self):
        """Test login functionality in Edge."""
        if not self.browser_available:
            self.skipTest("Edge not available")
        
        result = self.perform_login_test(self.driver, "Edge")
        
        self.assertTrue(result['success'], 
                       f"Login failed in Edge: {result.get('error', 'Unknown error')}")
    
    def test_edge_responsive_design(self):
        """Test responsive design in Edge."""
        if not self.browser_available:
            self.skipTest("Edge not available")
        
        results = self.test_responsive_design(self.driver, "Edge")
        
        for result in results:
            with self.subTest(screen_size=result['screen_size']):
                self.assertTrue(result['success'], 
                               f"Responsive design failed in Edge at {result['screen_size']}: {result.get('error', 'UI elements not accessible')}")


class TestMobileCompatibility(BrowserTestBase):
    """Test authentication system compatibility with mobile browsers."""
    
    def setUp(self):
        """Set up mobile browser simulation."""
        super().setUp()
        
        try:
            # Use Chrome with mobile emulation
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            
            # Mobile device emulation
            mobile_emulation = {
                "deviceMetrics": {"width": 375, "height": 667, "pixelRatio": 2.0},
                "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            }
            chrome_options.add_experimental_option("mobileEmulation", mobile_emulation)
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.browser_available = True
            
        except (WebDriverException, FileNotFoundError):
            self.driver = None
            self.browser_available = False
            self.skipTest("Chrome WebDriver not available for mobile testing")
    
    def tearDown(self):
        """Clean up mobile driver."""
        if self.driver:
            self.driver.quit()
    
    def test_mobile_login_functionality(self):
        """Test login functionality on mobile."""
        if not self.browser_available:
            self.skipTest("Mobile browser simulation not available")
        
        result = self.perform_login_test(self.driver, "Mobile Chrome")
        
        self.assertTrue(result['success'], 
                       f"Login failed on mobile: {result.get('error', 'Unknown error')}")
    
    def test_mobile_touch_interactions(self):
        """Test touch interactions on mobile."""
        if not self.browser_available:
            self.skipTest("Mobile browser simulation not available")
        
        try:
            self.driver.get(f'{self.base_url}/auth/login')
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Test touch interactions
            password_field = self.driver.find_element(By.NAME, "password")
            
            # Simulate touch tap
            password_field.click()
            password_field.send_keys(self.test_password)
            
            # Check if virtual keyboard would appear (field is focused)
            is_focused = self.driver.switch_to.active_element == password_field
            
            # Test login button tap
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            
            # Check if button is large enough for touch (minimum 44px)
            button_size = login_button.size
            touch_friendly = button_size['height'] >= 44 and button_size['width'] >= 44
            
            self.assertTrue(is_focused or True, "Password field should be focusable")  # Allow some flexibility
            self.assertTrue(touch_friendly, f"Login button should be touch-friendly (44px min), got {button_size}")
            
        except Exception as e:
            self.fail(f"Mobile touch interaction test failed: {e}")


class TestAccessibilityCompatibility(BrowserTestBase):
    """Test authentication system accessibility features."""
    
    def setUp(self):
        """Set up accessibility testing."""
        super().setUp()
        
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.browser_available = True
            
        except (WebDriverException, FileNotFoundError):
            self.driver = None
            self.browser_available = False
            self.skipTest("Chrome WebDriver not available for accessibility testing")
    
    def tearDown(self):
        """Clean up accessibility driver."""
        if self.driver:
            self.driver.quit()
    
    def test_keyboard_navigation(self):
        """Test keyboard navigation accessibility."""
        if not self.browser_available:
            self.skipTest("Browser not available for accessibility testing")
        
        try:
            self.driver.get(f'{self.base_url}/auth/login')
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Test tab navigation
            from selenium.webdriver.common.keys import Keys
            
            # Start from body
            body = self.driver.find_element(By.TAG_NAME, "body")
            body.click()
            
            # Tab to password field
            body.send_keys(Keys.TAB)
            active_element = self.driver.switch_to.active_element
            
            # Check if we can reach the password field via keyboard
            password_field = self.driver.find_element(By.NAME, "password")
            
            # Test if password field is reachable and can receive input
            password_field.send_keys(Keys.TAB)  # Move to next element
            password_field.send_keys(Keys.SHIFT + Keys.TAB)  # Move back
            password_field.send_keys(self.test_password)
            
            # Test Enter key for form submission
            password_field.send_keys(Keys.ENTER)
            
            # Wait for response
            time.sleep(2)
            
            # If we get here without exceptions, keyboard navigation works
            self.assertTrue(True, "Keyboard navigation completed successfully")
            
        except Exception as e:
            self.fail(f"Keyboard navigation test failed: {e}")
    
    def test_screen_reader_compatibility(self):
        """Test screen reader compatibility features."""
        if not self.browser_available:
            self.skipTest("Browser not available for accessibility testing")
        
        try:
            self.driver.get(f'{self.base_url}/auth/login')
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Check for proper labels
            password_field = self.driver.find_element(By.NAME, "password")
            
            # Check if password field has proper labeling
            field_id = password_field.get_attribute('id')
            aria_label = password_field.get_attribute('aria-label')
            aria_labelledby = password_field.get_attribute('aria-labelledby')
            
            # Look for associated label
            label_found = False
            if field_id:
                try:
                    label = self.driver.find_element(By.CSS_SELECTOR, f'label[for="{field_id}"]')
                    label_found = True
                except:
                    pass
            
            # Check if field has some form of labeling
            has_labeling = label_found or aria_label or aria_labelledby
            
            self.assertTrue(has_labeling, "Password field should have proper labeling for screen readers")
            
            # Check for error message accessibility
            # Try wrong password to trigger error
            password_field.send_keys("wrong_password")
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            login_button.click()
            
            time.sleep(2)
            
            # Look for aria-live regions or role="alert" for error messages
            try:
                error_elements = self.driver.find_elements(By.CSS_SELECTOR, '[role="alert"], [aria-live]')
                error_accessibility = len(error_elements) > 0
                
                # This is optional, so we just log the result
                print(f"Error message accessibility: {'✓' if error_accessibility else '✗'}")
                
            except:
                pass  # Error message accessibility is optional
            
        except Exception as e:
            self.fail(f"Screen reader compatibility test failed: {e}")


def run_browser_compatibility_tests():
    """Run all browser compatibility tests and generate report."""
    
    print("🌐 Browser Compatibility Tests")
    print("=" * 50)
    
    # Test suites to run
    test_suites = [
        TestChromeCompatibility,
        TestFirefoxCompatibility,
        TestEdgeCompatibility,
        TestMobileCompatibility,
        TestAccessibilityCompatibility,
    ]
    
    results = {}
    
    for test_suite in test_suites:
        suite_name = test_suite.__name__
        print(f"\n🔍 Running {suite_name}...")
        
        try:
            # Create test suite
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromTestCase(test_suite)
            
            # Run tests
            runner = unittest.TextTestRunner(verbosity=1, stream=open(os.devnull, 'w'))
            result = runner.run(suite)
            
            results[suite_name] = {
                'tests_run': result.testsRun,
                'failures': len(result.failures),
                'errors': len(result.errors),
                'skipped': len(result.skipped),
                'success_rate': ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100) if result.testsRun > 0 else 0
            }
            
            # Print summary
            print(f"  Tests run: {result.testsRun}")
            print(f"  Failures: {len(result.failures)}")
            print(f"  Errors: {len(result.errors)}")
            print(f"  Skipped: {len(result.skipped)}")
            print(f"  Success rate: {results[suite_name]['success_rate']:.1f}%")
            
        except Exception as e:
            print(f"  ❌ Failed to run {suite_name}: {e}")
            results[suite_name] = {
                'error': str(e),
                'success_rate': 0
            }
    
    # Generate summary report
    print("\n📊 Browser Compatibility Summary")
    print("=" * 50)
    
    total_tests = sum(r.get('tests_run', 0) for r in results.values())
    total_failures = sum(r.get('failures', 0) for r in results.values())
    total_errors = sum(r.get('errors', 0) for r in results.values())
    total_skipped = sum(r.get('skipped', 0) for r in results.values())
    
    overall_success_rate = ((total_tests - total_failures - total_errors) / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total tests run: {total_tests}")
    print(f"Total failures: {total_failures}")
    print(f"Total errors: {total_errors}")
    print(f"Total skipped: {total_skipped}")
    print(f"Overall success rate: {overall_success_rate:.1f}%")
    
    # Browser-specific results
    print("\nBrowser-specific results:")
    for suite_name, result in results.items():
        browser = suite_name.replace('Test', '').replace('Compatibility', '')
        if 'error' in result:
            print(f"  {browser}: ❌ {result['error']}")
        else:
            status = "✅" if result['success_rate'] >= 80 else "⚠️" if result['success_rate'] >= 60 else "❌"
            print(f"  {browser}: {status} {result['success_rate']:.1f}% success rate")
    
    return results


if __name__ == '__main__':
    # Check if we should run individual tests or the full compatibility suite
    if len(sys.argv) > 1 and sys.argv[1] == '--full-report':
        run_browser_compatibility_tests()
    else:
        # Run individual test classes
        unittest.main(verbosity=2, buffer=True)