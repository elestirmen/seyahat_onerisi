#!/usr/bin/env python3

import requests
import re
import json

def test_media_overlay():
    """
    Simple test to check if media overlay JavaScript is properly loaded
    """
    print("🚀 Testing media overlay functionality...")
    
    results = {
        "page_accessible": False,
        "js_file_loaded": False,
        "predefined_ids_present": False,
        "test_function_present": False,
        "context_setup_correct": False
    }
    
    try:
        # Test if page is accessible
        print("🌐 Testing page accessibility...")
        response = requests.get("http://localhost:5560/predefined_routes.html", timeout=5)
        results["page_accessible"] = response.status_code == 200
        print(f"✅ Page accessible: {results['page_accessible']}")
        
        if results["page_accessible"]:
            page_content = response.text
            
            # Check if JS file is loaded
            js_loaded = "poi_recommendation_system.js" in page_content
            results["js_file_loaded"] = js_loaded
            print(f"📄 JS file loaded: {js_loaded}")
            
            # Check if predefined button IDs are present
            predefined_ids = "predefinedMediaPrevBtn" in page_content and "predefinedMediaNextBtn" in page_content
            results["predefined_ids_present"] = predefined_ids
            print(f"🎛️ Predefined button IDs present: {predefined_ids}")
            
        # Test JS file content
        print("🔍 Testing JavaScript file...")
        js_response = requests.get("http://localhost:5560/static/js/poi_recommendation_system.js", timeout=5)
        if js_response.status_code == 200:
            js_content = js_response.text
            
            # Check if test function exists
            test_function_exists = "testInModalOverlay" in js_content
            results["test_function_present"] = test_function_exists
            print(f"🧪 Test function present: {test_function_exists}")
            
            # Check if context detection logic exists
            context_logic = "isPredefinedRoutes" in js_content and "predefinedMediaPrevBtn" in js_content
            results["context_setup_correct"] = context_logic
            print(f"🎯 Context detection logic: {context_logic}")
            
        else:
            print(f"❌ JavaScript file not accessible: {js_response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        print("💡 Make sure the server is running on port 5560")
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    
    # Print summary
    print("\n📊 Test Results Summary:")
    print("=" * 30)
    for key, value in results.items():
        status = "✅" if value else "❌"
        print(f"{status} {key.replace('_', ' ').title()}: {value}")
    
    # Diagnosis
    print("\n🩺 Diagnosis:")
    if not results["page_accessible"]:
        print("❌ Server is not running or page is not accessible")
        print("💡 Start server with: python3 -m http.server 5560")
    elif not results["js_file_loaded"]:
        print("❌ JavaScript file is not being loaded in HTML")
    elif not results["predefined_ids_present"]:
        print("❌ Predefined button IDs are missing from HTML")
    elif not results["test_function_present"]:
        print("❌ Test function is not in JavaScript file")
    elif not results["context_setup_correct"]:
        print("❌ Context detection logic is incomplete")
    else:
        print("✅ All checks passed - issue might be in browser execution")
        print("💡 Try opening browser dev tools and checking console")
    
    return results

if __name__ == "__main__":
    test_media_overlay()
