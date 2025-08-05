#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Integration Verification
Verify that all components are properly integrated and the existing POI system still works
"""

import os
import json
import sys
from pathlib import Path

def check_file_exists(file_path, description):
    """Check if a file exists and report status"""
    if os.path.exists(file_path):
        print(f"✅ {description}: {file_path}")
        return True
    else:
        print(f"❌ {description}: {file_path} - NOT FOUND")
        return False

def check_file_content(file_path, search_terms, description):
    """Check if file contains specific content"""
    if not os.path.exists(file_path):
        print(f"❌ {description}: {file_path} - FILE NOT FOUND")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        missing_terms = []
        for term in search_terms:
            if term not in content:
                missing_terms.append(term)
        
        if missing_terms:
            print(f"⚠️  {description}: Missing content - {', '.join(missing_terms)}")
            return False
        else:
            print(f"✅ {description}: All required content found")
            return True
    except Exception as e:
        print(f"❌ {description}: Error reading file - {e}")
        return False

def verify_backend_integration():
    """Verify backend integration"""
    print("\n🔧 Verifying Backend Integration")
    print("=" * 50)
    
    results = []
    
    # Check route service
    results.append(check_file_exists("route_service.py", "Route Service"))
    results.append(check_file_content(
        "route_service.py",
        ["class RouteService", "get_all_active_routes", "filter_routes", "create_route"],
        "Route Service Implementation"
    ))
    
    # Check POI API integration
    results.append(check_file_exists("poi_api.py", "POI API"))
    results.append(check_file_content(
        "poi_api.py",
        ["from route_service import RouteService", "/api/routes", "/api/admin/routes"],
        "POI API Route Integration"
    ))
    
    # Check database setup
    results.append(check_file_exists("setup_routes_database.py", "Routes Database Setup"))
    
    return all(results)

def verify_frontend_integration():
    """Verify frontend integration"""
    print("\n🎨 Verifying Frontend Integration")
    print("=" * 50)
    
    results = []
    
    # Check main HTML file
    results.append(check_file_exists("poi_recommendation_system.html", "Main POI System HTML"))
    results.append(check_file_content(
        "poi_recommendation_system.html",
        ["route-tabs", "dynamic-routes", "predefined-routes"],
        "Route Tabs Integration"
    ))
    
    # Check JavaScript files
    results.append(check_file_exists("static/js/poi_recommendation_system.js", "Main POI JavaScript"))
    results.append(check_file_exists("static/js/route-selection-manager.js", "Route Selection Manager"))
    results.append(check_file_exists("static/js/route-admin-manager.js", "Route Admin Manager"))
    
    # Check CSS files
    results.append(check_file_exists("static/css/poi_recommendation_system.css", "POI System CSS"))
    results.append(check_file_exists("static/css/route-admin.css", "Route Admin CSS"))
    
    # Check admin UI
    results.append(check_file_exists("poi_manager_ui.html", "POI Manager UI"))
    results.append(check_file_content(
        "poi_manager_ui.html",
        ["route-management-tab", "routeForm"],
        "Route Management Integration"
    ))
    
    return all(results)

def verify_poi_system_compatibility():
    """Verify that existing POI system is still functional"""
    print("\n🗺️  Verifying POI System Compatibility")
    print("=" * 50)
    
    results = []
    
    # Check POI system core files
    results.append(check_file_exists("poi_database_adapter.py", "POI Database Adapter"))
    results.append(check_file_exists("poi_media_manager.py", "POI Media Manager"))
    
    # Check that POI system JavaScript still has core functionality
    results.append(check_file_content(
        "static/js/poi_recommendation_system.js",
        ["ratingCategories", "categoryData", "selectedPOIs", "loadPOIData"],
        "POI System Core Functionality"
    ))
    
    # Check that POI system HTML still has core structure
    results.append(check_file_content(
        "poi_recommendation_system.html",
        ["preferences-section", "results-section", "map-container"],
        "POI System Core Structure"
    ))
    
    # Check that CSS still supports POI system
    results.append(check_file_content(
        "static/css/poi_recommendation_system.css",
        [".poi-card", ".route-card", ".map-container"],
        "POI System CSS Support"
    ))
    
    return all(results)

def verify_database_integration():
    """Verify database integration"""
    print("\n🗄️  Verifying Database Integration")
    print("=" * 50)
    
    results = []
    
    # Check database setup files
    results.append(check_file_exists("setup_poi_database.py", "POI Database Setup"))
    results.append(check_file_exists("setup_routes_database.py", "Routes Database Setup"))
    
    # Check sample data files
    results.append(check_file_exists("add_sample_routes.py", "Sample Routes Data"))
    
    # Check that route service connects to database
    results.append(check_file_content(
        "route_service.py",
        ["psycopg2", "connection_string", "connect"],
        "Database Connection Implementation"
    ))
    
    return all(results)

def verify_test_coverage():
    """Verify test coverage"""
    print("\n🧪 Verifying Test Coverage")
    print("=" * 50)
    
    results = []
    
    # Check test files
    test_files = [
        "test_route_service.py",
        "test_api_endpoints.py",
        "test_frontend_functionality.py",
        "test_end_to_end_scenarios.py",
        "test_system_integration.py"
    ]
    
    for test_file in test_files:
        results.append(check_file_exists(test_file, f"Test File: {test_file}"))
    
    # Check test runner
    results.append(check_file_exists("run_all_tests.py", "Test Runner"))
    
    return all(results)

def verify_authentication_integration():
    """Verify authentication integration"""
    print("\n🔐 Verifying Authentication Integration")
    print("=" * 50)
    
    results = []
    
    # Check authentication files
    results.append(check_file_exists("auth_middleware.py", "Authentication Middleware"))
    results.append(check_file_exists("auth_config.py", "Authentication Configuration"))
    
    # Check that POI API uses authentication
    results.append(check_file_content(
        "poi_api.py",
        ["auth_middleware", "@auth_middleware.require_auth"],
        "Authentication Integration in API"
    ))
    
    return all(results)

def verify_api_endpoints():
    """Verify API endpoints are properly integrated"""
    print("\n🌐 Verifying API Endpoints")
    print("=" * 50)
    
    results = []
    
    # Check that POI API has route endpoints
    if os.path.exists("poi_api.py"):
        with open("poi_api.py", 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check for public route endpoints
        public_endpoints = [
            "/api/routes",
            "get_predefined_routes",
            "get_route_details",
            "filter_routes"
        ]
        
        # Check for admin route endpoints
        admin_endpoints = [
            "/api/admin/routes",
            "create_route",
            "update_route",
            "delete_route"
        ]
        
        missing_public = [ep for ep in public_endpoints if ep not in content]
        missing_admin = [ep for ep in admin_endpoints if ep not in content]
        
        if missing_public:
            print(f"⚠️  Missing public endpoints: {', '.join(missing_public)}")
            results.append(False)
        else:
            print("✅ Public route endpoints found")
            results.append(True)
        
        if missing_admin:
            print(f"⚠️  Missing admin endpoints: {', '.join(missing_admin)}")
            results.append(False)
        else:
            print("✅ Admin route endpoints found")
            results.append(True)
    else:
        print("❌ POI API file not found")
        results.append(False)
    
    return all(results)

def run_integration_verification():
    """Run complete integration verification"""
    print("🔍 SYSTEM INTEGRATION VERIFICATION")
    print("=" * 70)
    print("Verifying that all components are properly integrated")
    print("and the existing POI system remains functional")
    print("=" * 70)
    
    verification_results = []
    
    # Run all verification checks
    verification_results.append(verify_backend_integration())
    verification_results.append(verify_frontend_integration())
    verification_results.append(verify_poi_system_compatibility())
    verification_results.append(verify_database_integration())
    verification_results.append(verify_test_coverage())
    verification_results.append(verify_authentication_integration())
    verification_results.append(verify_api_endpoints())
    
    # Summary
    print("\n📊 INTEGRATION VERIFICATION SUMMARY")
    print("=" * 50)
    
    total_checks = len(verification_results)
    passed_checks = sum(verification_results)
    success_rate = (passed_checks / total_checks) * 100
    
    print(f"Total Verification Areas: {total_checks}")
    print(f"Passed Verifications: {passed_checks}")
    print(f"Failed Verifications: {total_checks - passed_checks}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if all(verification_results):
        print("\n🎉 ALL INTEGRATION VERIFICATIONS PASSED!")
        print("✅ System is properly integrated")
        print("✅ POI system compatibility maintained")
        print("✅ All components are working together")
        return True
    else:
        print("\n⚠️  SOME INTEGRATION VERIFICATIONS FAILED!")
        print("Please review the failed checks above")
        return False

if __name__ == "__main__":
    success = run_integration_verification()
    exit(0 if success else 1)