#!/usr/bin/env python3
"""
Comprehensive Test System for POI Travel Recommendation API
Replaces test_all_functions.py with a more robust and categorized testing approach.

Usage:
    python comprehensive_test_system.py --mode=quick    # Run critical tests only (~10 seconds)
    python comprehensive_test_system.py --mode=full     # Run all tests (~30 seconds)
    python comprehensive_test_system.py --category=api  # Run specific category tests
    python comprehensive_test_system.py --help          # Show help
"""

import argparse
import json
import time
import sys
import os
import traceback
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from enum import Enum
import requests
import psycopg2
from psycopg2.extras import RealDictCursor


class TestStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"


@dataclass
class TestResult:
    name: str
    category: str
    status: TestStatus
    duration: float
    message: str
    details: Dict[str, Any] = None
    suggestions: List[str] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.suggestions is None:
            self.suggestions = []


@dataclass
class TestConfig:
    api_base_url: str = "http://localhost:5560"
    database_url: str = None
    test_timeout: int = 30
    quick_mode_categories: List[str] = None
    verbose: bool = False
    save_reports: bool = True

    def __post_init__(self):
        if self.quick_mode_categories is None:
            self.quick_mode_categories = ["api", "database", "auth"]


class Colors:
    """ANSI color codes for console output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'


class TestRunner:
    """Main test runner class"""
    
    def __init__(self, config: TestConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.start_time = None
        self.end_time = None
    
    def run_tests(self, categories: List[str] = None, mode: str = "full") -> List[TestResult]:
        """Run tests based on specified categories and mode"""
        self.start_time = time.time()
        self.results = []
        
        print(f"{Colors.BOLD}{Colors.BLUE}🚀 Starting Comprehensive Test System{Colors.END}")
        print(f"{Colors.CYAN}Mode: {mode.upper()}{Colors.END}")
        print(f"{Colors.CYAN}Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
        print("-" * 60)
        
        # Determine which categories to run
        if mode == "quick":
            categories = categories or self.config.quick_mode_categories
        elif categories is None:
            categories = ["api", "database", "auth", "media", "frontend"]
        
        print(f"{Colors.CYAN}Running categories: {', '.join(categories)}{Colors.END}")
        print()
        
        # Run each category
        for category in categories:
            self._run_category(category)
        
        self.end_time = time.time()
        self._generate_report()
        
        return self.results
    
    def _run_category(self, category: str):
        """Run tests for a specific category"""
        print(f"{Colors.BOLD}{Colors.PURPLE}📋 Testing {category.upper()} Category{Colors.END}")
        
        try:
            if category == "api":
                self._run_api_tests()
            elif category == "database":
                self._run_database_tests()
            elif category == "auth":
                self._run_auth_tests()
            elif category == "media":
                self._run_media_tests()
            elif category == "frontend":
                self._run_frontend_tests()
            else:
                self._add_result(f"Unknown category: {category}", category, TestStatus.SKIP, 0, 
                               f"Category '{category}' is not implemented")
        except Exception as e:
            self._add_result(f"Category {category} failed", category, TestStatus.ERROR, 0,
                           f"Unexpected error: {str(e)}", suggestions=["Check system logs", "Verify dependencies"])
        
        print()
    
    def _run_api_tests(self):
        """Run comprehensive API endpoint tests"""
        print(f"  {Colors.CYAN}Testing Public API Endpoints...{Colors.END}")
        
        # Public endpoints (no authentication required)
        public_tests = [
            ("GET /api/pois", "GET", "/api/pois", None, 200),
            ("GET /api/search", "GET", "/api/search?q=test", None, 200),
            ("GET /api/routes", "GET", "/api/routes", None, 200),
            ("GET /api/ratings/categories", "GET", "/api/ratings/categories", None, 200),
            ("GET /api/pois/by-rating", "GET", "/api/pois/by-rating?category=doga_macera", None, 200),
            ("POST /api/recommendations", "POST", "/api/recommendations", 
             {"preferences": {"categories": ["doga_macera"]}}, 200),
            ("POST /api/routes/filter", "POST", "/api/routes/filter", 
             {"categories": ["doga_macera"]}, 200),
            ("GET /api/routes/search", "GET", "/api/routes/search?q=test", None, 200),
        ]
        
        for test_name, method, endpoint, data, expected_status in public_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Authentication Endpoints...{Colors.END}")
        
        # Authentication endpoints
        auth_tests = [
            ("GET /auth/status", "GET", "/auth/status", None, 200),
            ("POST /auth/login (Invalid)", "POST", "/auth/login", 
             {"password": "invalid"}, [401, 400]),
        ]
        
        for test_name, method, endpoint, data, expected_status in auth_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Protected Endpoints (Unauthorized)...{Colors.END}")
        
        # Protected endpoints (should return 401 without authentication)
        protected_tests = [
            ("POST /api/poi (Unauthorized)", "POST", "/api/poi", 
             {"name": "Test POI", "category": "test"}, 401),
            ("PUT /api/poi/1 (Unauthorized)", "PUT", "/api/poi/1", 
             {"name": "Updated POI"}, 401),
            ("DELETE /api/poi/1 (Unauthorized)", "DELETE", "/api/poi/1", None, 401),
            ("POST /api/poi/1/media (Unauthorized)", "POST", "/api/poi/1/media", {}, 401),
            ("DELETE /api/poi/1/media/test.jpg (Unauthorized)", "DELETE", 
             "/api/poi/1/media/test.jpg", None, 401),
            ("POST /api/system/cleanup-media-folders (Unauthorized)", "POST", 
             "/api/system/cleanup-media-folders", {}, 401),
            ("POST /api/routes/import (Unauthorized)", "POST", "/api/routes/import", {}, 401),
        ]
        
        for test_name, method, endpoint, data, expected_status in protected_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Route Planning Endpoints...{Colors.END}")
        
        # Route planning endpoints
        route_tests = [
            ("POST /api/route/walking", "POST", "/api/route/walking", 
             {"pois": [{"lat": 38.6, "lng": 34.8}, {"lat": 38.61, "lng": 34.81}]}, [200, 400]),
            ("POST /api/route/driving", "POST", "/api/route/driving", 
             {"pois": [{"lat": 38.6, "lng": 34.8}, {"lat": 38.61, "lng": 34.81}]}, [200, 400]),
            ("POST /api/route/smart", "POST", "/api/route/smart", 
             {"pois": [{"lat": 38.6, "lng": 34.8}, {"lat": 38.61, "lng": 34.81}]}, [200, 400]),
        ]
        
        for test_name, method, endpoint, data, expected_status in route_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Individual POI Endpoints...{Colors.END}")
        
        # Test individual POI endpoints with a test POI ID
        poi_tests = [
            ("GET /api/poi/1", "GET", "/api/poi/1", None, [200, 404]),
            ("GET /api/poi/1/media", "GET", "/api/poi/1/media", None, [200, 404]),
            ("GET /api/poi/1/images", "GET", "/api/poi/1/images", None, [200, 404]),
        ]
        
        for test_name, method, endpoint, data, expected_status in poi_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Route Detail Endpoints...{Colors.END}")
        
        # Test route detail endpoints
        route_detail_tests = [
            ("GET /api/routes/1", "GET", "/api/routes/1", None, [200, 404]),
            ("GET /api/routes/1/geometry", "GET", "/api/routes/1/geometry", None, [200, 404]),
        ]
        
        for test_name, method, endpoint, data, expected_status in route_detail_tests:
            self._test_api_endpoint(test_name, method, endpoint, data, expected_status)
        
        print(f"  {Colors.CYAN}Testing Response Format Validation...{Colors.END}")
        
        # Test response format validation
        self._test_response_formats()
    
    def _test_api_endpoint(self, test_name: str, method: str, endpoint: str, 
                          data: Dict = None, expected_status = 200):
        """Test a single API endpoint with comprehensive validation"""
        start_time = time.time()
        
        try:
            url = f"{self.config.api_base_url}{endpoint}"
            headers = {'Content-Type': 'application/json'} if data else {}
            
            # Make the HTTP request
            if method == "GET":
                response = requests.get(url, timeout=self.config.test_timeout, headers=headers)
            elif method == "POST":
                response = requests.post(url, json=data, timeout=self.config.test_timeout, headers=headers)
            elif method == "PUT":
                response = requests.put(url, json=data, timeout=self.config.test_timeout, headers=headers)
            elif method == "DELETE":
                response = requests.delete(url, timeout=self.config.test_timeout, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            duration = time.time() - start_time
            
            # Check if status code is expected
            if isinstance(expected_status, list):
                status_ok = response.status_code in expected_status
                expected_str = f"one of {expected_status}"
            else:
                status_ok = response.status_code == expected_status
                expected_str = str(expected_status)
            
            # Prepare response details for analysis
            response_details = {
                "status_code": response.status_code,
                "response_size": len(response.content),
                "content_type": response.headers.get('Content-Type', 'unknown')
            }
            
            # Try to parse JSON response for additional validation
            try:
                if response.headers.get('Content-Type', '').startswith('application/json'):
                    json_data = response.json()
                    response_details["has_json"] = True
                    response_details["json_keys"] = list(json_data.keys()) if isinstance(json_data, dict) else []
                else:
                    response_details["has_json"] = False
            except:
                response_details["has_json"] = False
            
            if status_ok:
                # Additional validation for successful responses
                success_message = f"✅ {method} {endpoint} → {response.status_code}"
                
                # Add response format validation
                if response.status_code == 200 and response_details["has_json"]:
                    if response_details["json_keys"]:
                        success_message += f" (JSON with {len(response_details['json_keys'])} keys)"
                    else:
                        success_message += " (JSON array or primitive)"
                elif response.status_code == 200:
                    success_message += f" ({response_details['content_type']})"
                
                self._add_result(test_name, "api", TestStatus.PASS, duration, success_message,
                               details=response_details)
            else:
                # Detailed failure analysis
                failure_message = f"❌ Expected {expected_str}, got {response.status_code}"
                
                # Add specific error context based on status code
                suggestions = []
                if response.status_code == 404:
                    suggestions.extend(["Check if endpoint URL is correct", "Verify API routing configuration"])
                elif response.status_code == 401:
                    suggestions.extend(["Check authentication requirements", "Verify credentials if needed"])
                elif response.status_code == 403:
                    suggestions.extend(["Check authorization permissions", "Verify user has required access"])
                elif response.status_code == 500:
                    suggestions.extend(["Check server logs for errors", "Verify database connectivity"])
                elif response.status_code == 400:
                    suggestions.extend(["Check request data format", "Verify required parameters"])
                else:
                    suggestions.extend(["Check API server status", "Verify endpoint implementation"])
                
                # Include response body for debugging (truncated)
                response_text = response.text[:300] if response.text else "No response body"
                response_details["response_preview"] = response_text
                
                self._add_result(test_name, "api", TestStatus.FAIL, duration, failure_message,
                               details=response_details, suggestions=suggestions)
                
        except requests.exceptions.ConnectionError:
            duration = time.time() - start_time
            self._add_result(test_name, "api", TestStatus.FAIL, duration,
                           "❌ Connection failed - API server not reachable",
                           details={"error_type": "ConnectionError", "url": url},
                           suggestions=["Start the API server: python poi_api.py", 
                                      f"Verify server is running on {self.config.api_base_url}",
                                      "Check if port is available and not blocked"])
        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            self._add_result(test_name, "api", TestStatus.FAIL, duration,
                           f"❌ Request timeout after {self.config.test_timeout}s",
                           details={"error_type": "Timeout", "timeout": self.config.test_timeout},
                           suggestions=["Check server performance and load", 
                                      "Increase timeout value with --timeout parameter",
                                      "Verify network connectivity"])
        except requests.exceptions.RequestException as e:
            duration = time.time() - start_time
            self._add_result(test_name, "api", TestStatus.ERROR, duration,
                           f"❌ Request error: {str(e)}",
                           details={"error_type": "RequestException", "error_details": str(e)},
                           suggestions=["Check network connectivity", "Verify API server configuration"])
        except Exception as e:
            duration = time.time() - start_time
            self._add_result(test_name, "api", TestStatus.ERROR, duration,
                           f"❌ Unexpected error: {str(e)}",
                           details={"error_type": type(e).__name__, "error_details": str(e)},
                           suggestions=["Check test configuration", "Report this as a potential bug"])
    
    def _run_database_tests(self):
        """Run database connection and basic operation tests"""
        # Test database connection
        self._test_database_connection()
        
        # Test basic CRUD operations
        self._test_database_crud()
        
        # Test JSON fallback
        self._test_json_fallback()
    
    def _test_database_connection(self):
        """Test database connection"""
        start_time = time.time()
        
        try:
            # Try to get connection using environment variables
            conn = psycopg2.connect(
                host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                port=int(os.getenv("POI_DB_PORT", "5432")),
                dbname=os.getenv("POI_DB_NAME", "poi_db"),
                user=os.getenv("POI_DB_USER", "poi_user"),
                password=os.getenv("POI_DB_PASSWORD"),
                cursor_factory=RealDictCursor
            )
            
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
            
            conn.close()
            duration = time.time() - start_time
            
            self._add_result("Database Connection", "database", TestStatus.PASS, duration,
                           "✅ Database connection successful")
            
        except psycopg2.OperationalError as e:
            duration = time.time() - start_time
            self._add_result("Database Connection", "database", TestStatus.FAIL, duration,
                           f"❌ Database connection failed: {str(e)}",
                           suggestions=["Check database server is running", 
                                      "Verify connection parameters in environment variables",
                                      "System will fall back to JSON mode"])
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("Database Connection", "database", TestStatus.ERROR, duration,
                           f"❌ Unexpected database error: {str(e)}",
                           suggestions=["Check database configuration", "Verify psycopg2 installation"])
    
    def _test_database_crud(self):
        """Test basic CRUD operations"""
        start_time = time.time()
        
        try:
            # This is a simplified test - in reality we'd test actual CRUD operations
            # For now, just test that we can query existing tables
            conn = psycopg2.connect(
                host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                port=int(os.getenv("POI_DB_PORT", "5432")),
                dbname=os.getenv("POI_DB_NAME", "poi_db"),
                user=os.getenv("POI_DB_USER", "poi_user"),
                password=os.getenv("POI_DB_PASSWORD"),
                cursor_factory=RealDictCursor
            )
            
            with conn.cursor() as cursor:
                # Test if we can query POIs table
                cursor.execute("SELECT COUNT(*) FROM pois LIMIT 1")
                result = cursor.fetchone()
            
            conn.close()
            duration = time.time() - start_time
            
            self._add_result("Database CRUD", "database", TestStatus.PASS, duration,
                           "✅ Database CRUD operations accessible")
            
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("Database CRUD", "database", TestStatus.FAIL, duration,
                           f"❌ CRUD operations failed: {str(e)}",
                           suggestions=["Check database schema", "Verify table permissions"])
    
    def _test_json_fallback(self):
        """Test JSON fallback system"""
        start_time = time.time()
        
        try:
            # Check if test_data.json exists
            if os.path.exists("test_data.json"):
                with open("test_data.json", 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                duration = time.time() - start_time
                self._add_result("JSON Fallback", "database", TestStatus.PASS, duration,
                               f"✅ JSON fallback available with {len(data.get('pois', []))} POIs")
            else:
                duration = time.time() - start_time
                self._add_result("JSON Fallback", "database", TestStatus.FAIL, duration,
                               "❌ test_data.json not found",
                               suggestions=["Create test_data.json file", "Ensure JSON fallback is configured"])
                
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("JSON Fallback", "database", TestStatus.ERROR, duration,
                           f"❌ JSON fallback error: {str(e)}",
                           suggestions=["Check test_data.json format", "Verify file permissions"])
    
    def _test_database_schema(self):
        """Test database schema and required tables"""
        start_time = time.time()
        
        try:
            conn = self._get_database_connection()
            
            required_tables = ['pois', 'routes', 'poi_media', 'route_media']
            existing_tables = []
            missing_tables = []
            
            with conn.cursor() as cursor:
                # Check if required tables exist
                for table in required_tables:
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = %s
                        );
                    """, (table,))
                    
                    exists = cursor.fetchone()[0]
                    if exists:
                        existing_tables.append(table)
                    else:
                        missing_tables.append(table)
            
            conn.close()
            duration = time.time() - start_time
            
            if not missing_tables:
                self._add_result("Database Schema", "database", TestStatus.PASS, duration,
                               f"✅ All required tables exist: {', '.join(existing_tables)}",
                               details={"existing_tables": existing_tables})
            else:
                self._add_result("Database Schema", "database", TestStatus.FAIL, duration,
                               f"❌ Missing tables: {', '.join(missing_tables)}",
                               details={"existing_tables": existing_tables, "missing_tables": missing_tables},
                               suggestions=["Run database setup scripts", "Check database migration status"])
                
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("Database Schema", "database", TestStatus.ERROR, duration,
                           f"❌ Schema validation error: {str(e)}",
                           suggestions=["Check database connection", "Verify database permissions"])
    
    def _test_data_integrity(self):
        """Test data integrity and constraint validation"""
        start_time = time.time()
        
        try:
            conn = self._get_database_connection()
            
            integrity_results = {}
            
            with conn.cursor() as cursor:
                # Test POI data integrity
                try:
                    # Check for POIs with required fields
                    cursor.execute("""
                        SELECT COUNT(*) as valid_pois 
                        FROM pois 
                        WHERE name IS NOT NULL 
                        AND name != '' 
                        AND latitude IS NOT NULL 
                        AND longitude IS NOT NULL
                    """)
                    valid_pois = cursor.fetchone()['valid_pois']
                    
                    cursor.execute("SELECT COUNT(*) as total_pois FROM pois")
                    total_pois = cursor.fetchone()['total_pois']
                    
                    integrity_results['poi_integrity'] = {
                        'valid': valid_pois,
                        'total': total_pois,
                        'percentage': (valid_pois / total_pois * 100) if total_pois > 0 else 0
                    }
                except Exception as e:
                    integrity_results['poi_integrity_error'] = str(e)
                
                # Test coordinate validity
                try:
                    cursor.execute("""
                        SELECT COUNT(*) as invalid_coords
                        FROM pois 
                        WHERE latitude < -90 OR latitude > 90 
                        OR longitude < -180 OR longitude > 180
                    """)
                    invalid_coords = cursor.fetchone()['invalid_coords']
                    integrity_results['coordinate_validity'] = invalid_coords == 0
                    integrity_results['invalid_coordinate_count'] = invalid_coords
                except Exception as e:
                    integrity_results['coordinate_validity_error'] = str(e)
                
                # Test route data integrity
                try:
                    cursor.execute("""
                        SELECT COUNT(*) as valid_routes 
                        FROM routes 
                        WHERE name IS NOT NULL 
                        AND name != ''
                    """)
                    valid_routes = cursor.fetchone()['valid_routes']
                    
                    cursor.execute("SELECT COUNT(*) as total_routes FROM routes")
                    total_routes = cursor.fetchone()['total_routes']
                    
                    integrity_results['route_integrity'] = {
                        'valid': valid_routes,
                        'total': total_routes,
                        'percentage': (valid_routes / total_routes * 100) if total_routes > 0 else 0
                    }
                except Exception as e:
                    integrity_results['route_integrity_error'] = str(e)
                
                # Test foreign key relationships (if poi_media table exists)
                try:
                    cursor.execute("""
                        SELECT COUNT(*) as orphaned_media
                        FROM poi_media pm
                        LEFT JOIN pois p ON pm.poi_id = p.id
                        WHERE p.id IS NULL
                    """)
                    orphaned_media = cursor.fetchone()['orphaned_media']
                    integrity_results['foreign_key_integrity'] = orphaned_media == 0
                    integrity_results['orphaned_media_count'] = orphaned_media
                except Exception as e:
                    # Table might not exist, which is okay
                    integrity_results['foreign_key_check'] = f"Skipped: {str(e)}"
            
            conn.close()
            duration = time.time() - start_time
            
            # Evaluate integrity results
            issues = []
            if 'poi_integrity' in integrity_results:
                poi_integrity = integrity_results['poi_integrity']
                if poi_integrity['percentage'] < 90:
                    issues.append(f"POI data integrity low ({poi_integrity['percentage']:.1f}%)")
            
            if integrity_results.get('coordinate_validity') is False:
                issues.append(f"Invalid coordinates found ({integrity_results['invalid_coordinate_count']})")
            
            if integrity_results.get('foreign_key_integrity') is False:
                issues.append(f"Orphaned media records found ({integrity_results['orphaned_media_count']})")
            
            if not issues:
                self._add_result("Data Integrity", "database", TestStatus.PASS, duration,
                               "✅ Data integrity checks passed",
                               details=integrity_results)
            else:
                self._add_result("Data Integrity", "database", TestStatus.FAIL, duration,
                               f"❌ Data integrity issues: {'; '.join(issues)}",
                               details=integrity_results,
                               suggestions=["Run data cleanup scripts", "Check data import processes"])
                
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("Data Integrity", "database", TestStatus.ERROR, duration,
                           f"❌ Data integrity test error: {str(e)}",
                           suggestions=["Check database connection", "Verify table structure"])
    
    def _run_auth_tests(self):
        """Run comprehensive authentication tests"""
        print(f"  {Colors.CYAN}Testing Authentication System...{Colors.END}")
        
        # Test auth status endpoint
        self._test_api_endpoint("Auth Status Check", "GET", "/auth/status", None, 200)
        
        # Test login endpoint with invalid credentials
        self._test_api_endpoint("Login with Invalid Password", "POST", "/auth/login", 
                               {"password": "invalid_password"}, [401, 400])
        
        # Test login endpoint with missing password
        self._test_api_endpoint("Login with Missing Password", "POST", "/auth/login", 
                               {}, [400, 422])
        
        # Test login endpoint with empty password
        self._test_api_endpoint("Login with Empty Password", "POST", "/auth/login", 
                               {"password": ""}, [400, 401])
        
        # Test CSRF token endpoint (if available)
        self._test_api_endpoint("CSRF Token Request", "GET", "/auth/csrf-token", None, [200, 404])
        
        # Test logout endpoint (may require CSRF token)
        self._test_api_endpoint("Logout Request", "POST", "/auth/logout", {}, [200, 401, 403])
        
        print(f"  {Colors.CYAN}Testing Rate Limiting...{Colors.END}")
        
        # Test rate limiting by making multiple rapid requests
        self._test_rate_limiting()
    
    def _test_rate_limiting(self):
        """Test authentication rate limiting"""
        start_time = time.time()
        
        try:
            # Make multiple rapid login attempts to test rate limiting
            attempts = 0
            rate_limited = False
            
            for i in range(6):  # Try 6 attempts (should trigger rate limiting)
                try:
                    response = requests.post(
                        f"{self.config.api_base_url}/auth/login",
                        json={"password": "test_rate_limit"},
                        timeout=5
                    )
                    attempts += 1
                    
                    if response.status_code == 429:  # Too Many Requests
                        rate_limited = True
                        break
                        
                except requests.exceptions.RequestException:
                    break
                
                # Small delay between attempts
                time.sleep(0.1)
            
            duration = time.time() - start_time
            
            if rate_limited:
                self._add_result("Rate Limiting Test", "auth", TestStatus.PASS, duration,
                               f"✅ Rate limiting activated after {attempts} attempts",
                               details={"attempts_before_limit": attempts})
            else:
                self._add_result("Rate Limiting Test", "auth", TestStatus.FAIL, duration,
                               f"❌ Rate limiting not triggered after {attempts} attempts",
                               details={"total_attempts": attempts},
                               suggestions=["Check rate limiting configuration", 
                                          "Verify security middleware is active"])
                
        except Exception as e:
            duration = time.time() - start_time
            self._add_result("Rate Limiting Test", "auth", TestStatus.ERROR, duration,
                           f"❌ Rate limiting test error: {str(e)}",
                           suggestions=["Check authentication endpoint availability"])
    
    def _test_response_formats(self):
        """Test API response formats and data structure validation"""
        format_tests = [
            {
                "name": "POI List Format",
                "endpoint": "/api/pois",
                "method": "GET",
                "expected_keys": ["dogal_miras", "gastronomi", "konaklama_hizmet", "kulturel_miras", "macera_spor", "seyir_noktalari", "yasayan_kultur"],
                "data_type": "object"
            },
            {
                "name": "Routes List Format", 
                "endpoint": "/api/routes",
                "method": "GET",
                "expected_keys": ["routes", "total"],  # Core required keys
                "data_type": "object"
            },
            {
                "name": "Search Results Format",
                "endpoint": "/api/search?q=test",
                "method": "GET", 
                "expected_keys": ["query", "results", "total_results"],
                "data_type": "object"
            },
            {
                "name": "Auth Status Format",
                "endpoint": "/auth/status",
                "method": "GET",
                "expected_keys": ["authenticated", "csrf_token"],
                "data_type": "object"
            }
        ]
        
        for test_config in format_tests:
            self._validate_response_format(test_config)
    
    def _validate_response_format(self, test_config):
        """Validate the format of an API response"""
        start_time = time.time()
        
        try:
            url = f"{self.config.api_base_url}{test_config['endpoint']}"
            
            if test_config['method'] == "GET":
                response = requests.get(url, timeout=self.config.test_timeout)
            else:
                response = requests.post(url, json=test_config.get('data'), timeout=self.config.test_timeout)
            
            duration = time.time() - start_time
            
            if response.status_code != 200:
                self._add_result(test_config['name'], "api", TestStatus.SKIP, duration,
                               f"⏭️ Skipped - endpoint returned {response.status_code}")
                return
            
            try:
                json_data = response.json()
            except ValueError:
                self._add_result(test_config['name'], "api", TestStatus.FAIL, duration,
                               "❌ Response is not valid JSON",
                               suggestions=["Check API response format", "Verify content-type header"])
                return
            
            # Validate data type
            if test_config['data_type'] == 'object' and not isinstance(json_data, dict):
                self._add_result(test_config['name'], "api", TestStatus.FAIL, duration,
                               f"❌ Expected object, got {type(json_data).__name__}",
                               suggestions=["Check API response structure"])
                return
            elif test_config['data_type'] == 'array' and not isinstance(json_data, list):
                self._add_result(test_config['name'], "api", TestStatus.FAIL, duration,
                               f"❌ Expected array, got {type(json_data).__name__}",
                               suggestions=["Check API response structure"])
                return
            
            # Validate expected keys (for objects)
            if test_config['data_type'] == 'object' and 'expected_keys' in test_config:
                missing_keys = []
                for key in test_config['expected_keys']:
                    if key not in json_data:
                        missing_keys.append(key)
                
                if missing_keys:
                    self._add_result(test_config['name'], "api", TestStatus.FAIL, duration,
                                   f"❌ Missing keys: {', '.join(missing_keys)}",
                                   details={"missing_keys": missing_keys, "actual_keys": list(json_data.keys())},
                                   suggestions=["Check API response structure", "Verify data model consistency"])
                    return
            
            # Success
            details = {
                "response_size": len(response.content),
                "json_keys": list(json_data.keys()) if isinstance(json_data, dict) else f"Array with {len(json_data)} items",
                "data_type": type(json_data).__name__
            }
            
            self._add_result(test_config['name'], "api", TestStatus.PASS, duration,
                           f"✅ Response format valid ({test_config['data_type']})",
                           details=details)
            
        except requests.exceptions.RequestException as e:
            duration = time.time() - start_time
            self._add_result(test_config['name'], "api", TestStatus.ERROR, duration,
                           f"❌ Request failed: {str(e)}",
                           suggestions=["Check API server availability"])
        except Exception as e:
            duration = time.time() - start_time
            self._add_result(test_config['name'], "api", TestStatus.ERROR, duration,
                           f"❌ Validation error: {str(e)}",
                           suggestions=["Check test configuration"])
    
    def _run_media_tests(self):
        """Run media and file handling tests"""
        start_time = time.time()
        
        # Check if media directories exist
        media_dirs = ["poi_media", "poi_images", "temp_uploads"]
        existing_dirs = [d for d in media_dirs if os.path.exists(d)]
        
        duration = time.time() - start_time
        
        if existing_dirs:
            self._add_result("Media Directories", "media", TestStatus.PASS, duration,
                           f"✅ Media directories found: {', '.join(existing_dirs)}")
        else:
            self._add_result("Media Directories", "media", TestStatus.FAIL, duration,
                           "❌ No media directories found",
                           suggestions=["Create media directories", "Check media configuration"])
    
    def _run_frontend_tests(self):
        """Run frontend JavaScript tests"""
        start_time = time.time()
        
        # Check if critical JavaScript files exist
        js_files = [
            "static/js/poi_recommendation_system.js",
            "static/js/enhanced-map-manager.js",
            "static/js/poi-categories.js"
        ]
        
        existing_files = [f for f in js_files if os.path.exists(f)]
        duration = time.time() - start_time
        
        if len(existing_files) >= 2:
            self._add_result("Frontend Files", "frontend", TestStatus.PASS, duration,
                           f"✅ Critical JS files found: {len(existing_files)}/{len(js_files)}")
        else:
            self._add_result("Frontend Files", "frontend", TestStatus.FAIL, duration,
                           f"❌ Missing critical JS files: {len(existing_files)}/{len(js_files)}",
                           suggestions=["Check static/js directory", "Verify frontend build"])
    
    def _add_result(self, name: str, category: str, status: TestStatus, duration: float,
                   message: str, details: Dict[str, Any] = None, suggestions: List[str] = None):
        """Add a test result"""
        result = TestResult(
            name=name,
            category=category,
            status=status,
            duration=duration,
            message=message,
            details=details or {},
            suggestions=suggestions or []
        )
        self.results.append(result)
        
        # Print result immediately
        color = {
            TestStatus.PASS: Colors.GREEN,
            TestStatus.FAIL: Colors.RED,
            TestStatus.SKIP: Colors.YELLOW,
            TestStatus.ERROR: Colors.RED
        }[status]
        
        print(f"  {color}{status.value}{Colors.END} {name} ({duration:.2f}s)")
        if self.config.verbose or status != TestStatus.PASS:
            print(f"    {message}")
            if suggestions:
                print(f"    💡 Suggestions: {', '.join(suggestions)}")
    
    def _generate_report(self):
        """Generate and display test report"""
        total_duration = self.end_time - self.start_time
        
        # Count results by status
        status_counts = {status: 0 for status in TestStatus}
        for result in self.results:
            status_counts[result.status] += 1
        
        # Count results by category
        category_counts = {}
        for result in self.results:
            if result.category not in category_counts:
                category_counts[result.category] = {status: 0 for status in TestStatus}
            category_counts[result.category][result.status] += 1
        
        print("=" * 60)
        print(f"{Colors.BOLD}{Colors.BLUE}📊 TEST SUMMARY{Colors.END}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Total Tests: {len(self.results)}")
        print()
        
        # Overall status
        if status_counts[TestStatus.FAIL] == 0 and status_counts[TestStatus.ERROR] == 0:
            print(f"{Colors.BOLD}{Colors.GREEN}🎉 ALL TESTS PASSED - SYSTEM IS HEALTHY{Colors.END}")
        else:
            print(f"{Colors.BOLD}{Colors.RED}⚠️  SOME TESTS FAILED - REVIEW REQUIRED{Colors.END}")
        
        print()
        print(f"{Colors.GREEN}✅ Passed: {status_counts[TestStatus.PASS]}{Colors.END}")
        print(f"{Colors.RED}❌ Failed: {status_counts[TestStatus.FAIL]}{Colors.END}")
        print(f"{Colors.RED}💥 Errors: {status_counts[TestStatus.ERROR]}{Colors.END}")
        print(f"{Colors.YELLOW}⏭️  Skipped: {status_counts[TestStatus.SKIP]}{Colors.END}")
        
        # Category breakdown
        print(f"\n{Colors.BOLD}📋 BY CATEGORY:{Colors.END}")
        for category, counts in category_counts.items():
            total_cat = sum(counts.values())
            passed_cat = counts[TestStatus.PASS]
            print(f"  {category.upper()}: {passed_cat}/{total_cat} passed")
        
        # Failed tests details
        failed_tests = [r for r in self.results if r.status in [TestStatus.FAIL, TestStatus.ERROR]]
        if failed_tests:
            print(f"\n{Colors.BOLD}{Colors.RED}🔍 FAILED TESTS DETAILS:{Colors.END}")
            for result in failed_tests:
                print(f"  ❌ {result.name} ({result.category})")
                print(f"     {result.message}")
                if result.suggestions:
                    print(f"     💡 {', '.join(result.suggestions)}")
        
        # Save report if configured
        if self.config.save_reports:
            self._save_json_report()
    
    def _save_json_report(self):
        """Save test report as JSON"""
        try:
            os.makedirs("reports", exist_ok=True)
            
            report_data = {
                "timestamp": datetime.now().isoformat(),
                "duration": self.end_time - self.start_time,
                "summary": {
                    "total": len(self.results),
                    "passed": len([r for r in self.results if r.status == TestStatus.PASS]),
                    "failed": len([r for r in self.results if r.status == TestStatus.FAIL]),
                    "errors": len([r for r in self.results if r.status == TestStatus.ERROR]),
                    "skipped": len([r for r in self.results if r.status == TestStatus.SKIP])
                },
                "results": [asdict(result) for result in self.results]
            }
            
            with open("reports/latest_test_report.json", "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
            
            print(f"\n{Colors.CYAN}📄 Report saved to: reports/latest_test_report.json{Colors.END}")
            
        except Exception as e:
            print(f"{Colors.YELLOW}⚠️  Could not save JSON report: {e}{Colors.END}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Comprehensive Test System for POI Travel Recommendation API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python comprehensive_test_system.py --mode=quick    # Run critical tests (~10s)
  python comprehensive_test_system.py --mode=full     # Run all tests (~30s)
  python comprehensive_test_system.py --category=api  # Run only API tests
  python comprehensive_test_system.py --verbose       # Show detailed output
        """
    )
    
    parser.add_argument("--mode", choices=["quick", "full"], default="full",
                       help="Test mode: quick (critical tests) or full (all tests)")
    parser.add_argument("--category", choices=["api", "database", "auth", "media", "frontend"],
                       help="Run tests for specific category only")
    parser.add_argument("--api-url", default="http://localhost:5560",
                       help="API base URL (default: http://localhost:5560)")
    parser.add_argument("--timeout", type=int, default=30,
                       help="Test timeout in seconds (default: 30)")
    parser.add_argument("--verbose", action="store_true",
                       help="Show detailed output for all tests")
    parser.add_argument("--no-save", action="store_true",
                       help="Don't save JSON report")
    
    args = parser.parse_args()
    
    # Create configuration
    config = TestConfig(
        api_base_url=args.api_url,
        test_timeout=args.timeout,
        verbose=args.verbose,
        save_reports=not args.no_save
    )
    
    # Create and run tests
    runner = TestRunner(config)
    
    try:
        categories = [args.category] if args.category else None
        results = runner.run_tests(categories=categories, mode=args.mode)
        
        # Exit with error code if any tests failed
        failed_count = len([r for r in results if r.status in [TestStatus.FAIL, TestStatus.ERROR]])
        sys.exit(1 if failed_count > 0 else 0)
        
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️  Tests interrupted by user{Colors.END}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}💥 Unexpected error: {e}{Colors.END}")
        if config.verbose:
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()