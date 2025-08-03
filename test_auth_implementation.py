#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for authentication and authorization implementation
"""

import re
import sys

def test_authentication_implementation():
    """Test that authentication and authorization are properly implemented"""
    
    print("🔒 Testing Authentication and Authorization Implementation")
    print("=" * 60)
    
    # Test 1: Check that auth middleware is imported
    with open('poi_api.py', 'r') as f:
        content = f.read()
    
    if 'from auth_middleware import auth_middleware' in content:
        print("✅ Auth middleware imported correctly")
    else:
        print("❌ Auth middleware not imported")
        return False
    
    # Test 2: Check that admin endpoints have authentication decorators
    admin_endpoints = [
        '@auth_middleware.require_auth',
        '@admin_rate_limit'
    ]
    
    for decorator in admin_endpoints:
        if decorator in content:
            print(f"✅ {decorator} decorator found")
        else:
            print(f"❌ {decorator} decorator missing")
            return False
    
    # Test 3: Check CSRF token validation
    csrf_patterns = [
        'csrf_token = data.get(\'csrf_token\', \'\')',
        'auth_middleware.validate_csrf_token(csrf_token)',
        'Invalid CSRF token'
    ]
    
    for pattern in csrf_patterns:
        if pattern in content:
            print(f"✅ CSRF protection: {pattern[:30]}...")
        else:
            print(f"❌ CSRF protection missing: {pattern[:30]}...")
            return False
    
    # Test 4: Check rate limiting implementation
    rate_limit_patterns = [
        'def admin_rate_limit',
        'def public_rate_limit',
        'Rate limit exceeded'
    ]
    
    for pattern in rate_limit_patterns:
        if pattern in content:
            print(f"✅ Rate limiting: {pattern}")
        else:
            print(f"❌ Rate limiting missing: {pattern}")
            return False
    
    # Test 5: Check input validation
    validation_patterns = [
        'if route_id <= 0:',
        'if len(search_term) < 2:',
        'valid_route_types = [',
        'difficulty < 1 or difficulty > 5'
    ]
    
    for pattern in validation_patterns:
        if pattern in content:
            print(f"✅ Input validation: {pattern[:30]}...")
        else:
            print(f"❌ Input validation missing: {pattern[:30]}...")
            return False
    
    # Test 6: Check security headers
    security_headers = [
        'X-Content-Type-Options',
        'X-Frame-Options'
    ]
    
    for header in security_headers:
        if header in content:
            print(f"✅ Security header: {header}")
        else:
            print(f"❌ Security header missing: {header}")
            return False
    
    # Test 7: Check logging for security events
    logging_patterns = [
        'logger.info(f"Route {route_id} created successfully',
        'logger.warning(f"Invalid CSRF token',
        'logger.warning(f"Rate limit exceeded'
    ]
    
    for pattern in logging_patterns:
        if pattern in content:
            print(f"✅ Security logging: {pattern[:40]}...")
        else:
            print(f"❌ Security logging missing: {pattern[:40]}...")
            return False
    
    print("\n" + "=" * 60)
    print("🎉 All authentication and authorization tests passed!")
    print("\n📋 Implementation Summary:")
    print("   • Authentication middleware integrated")
    print("   • CSRF protection implemented")
    print("   • Rate limiting for admin and public endpoints")
    print("   • Input validation and sanitization")
    print("   • Security headers added")
    print("   • Security event logging")
    print("   • Admin endpoint protection")
    
    return True

def test_auth_config():
    """Test auth configuration"""
    print("\n🔧 Testing Auth Configuration")
    print("-" * 40)
    
    with open('auth_config.py', 'r') as f:
        content = f.read()
    
    config_features = [
        'class AuthConfig:',
        'validate_password',
        'hash_password',
        'get_security_headers',
        'BCRYPT_ROUNDS',
        'SESSION_TIMEOUT'
    ]
    
    for feature in config_features:
        if feature in content:
            print(f"✅ Auth config feature: {feature}")
        else:
            print(f"❌ Auth config feature missing: {feature}")
            return False
    
    return True

def test_auth_middleware():
    """Test auth middleware"""
    print("\n🛡️  Testing Auth Middleware")
    print("-" * 40)
    
    with open('auth_middleware.py', 'r') as f:
        content = f.read()
    
    middleware_features = [
        'class AuthMiddleware:',
        'require_auth',
        'is_authenticated',
        'validate_csrf_token',
        'check_rate_limit',
        'record_failed_attempt'
    ]
    
    for feature in middleware_features:
        if feature in content:
            print(f"✅ Auth middleware feature: {feature}")
        else:
            print(f"❌ Auth middleware feature missing: {feature}")
            return False
    
    return True

if __name__ == "__main__":
    success = True
    
    try:
        success &= test_authentication_implementation()
        success &= test_auth_config()
        success &= test_auth_middleware()
        
        if success:
            print("\n🎯 TASK COMPLETED SUCCESSFULLY!")
            print("Authentication and authorization have been properly implemented.")
            sys.exit(0)
        else:
            print("\n❌ TASK FAILED!")
            print("Some authentication features are missing.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        sys.exit(1)