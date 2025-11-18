#!/usr/bin/env python3
import requests
import time
import sys
import subprocess
import os
import socket
import json
import random

# Configuration
PORT = 5560
BASE_URL = f"http://localhost:{PORT}"
SERVER_SCRIPT = "poi_api.py"
START_WAIT_TIME = 5  # seconds to wait for server start
TIMEOUT = 3 # seconds for request timeout - increased slightly
SLOW_THRESHOLD = 0.5 # seconds

# ANSI colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(name, status, details="", duration=0):
    status_color = Colors.OKGREEN if status == "PASS" else Colors.FAIL
    if status == "PASS" and duration > SLOW_THRESHOLD:
        duration_str = f"{Colors.WARNING}{duration:.3f}s (SLOW){Colors.ENDC}"
    else:
        duration_str = f"{duration:.3f}s"
        
    print(f"{name:<50} {status_color}{status:<10}{Colors.ENDC} {duration_str}  {details}")

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_server():
    print(f"{Colors.HEADER}Starting server on port {PORT}...{Colors.ENDC}")
    python_exe = sys.executable
    process = subprocess.Popen(
        [python_exe, SERVER_SCRIPT], 
        stdout=subprocess.PIPE, 
        stderr=subprocess.PIPE,
        start_new_session=True
    )
    
    start = time.time()
    while time.time() - start < START_WAIT_TIME:
        if is_port_in_use(PORT):
            print(f"{Colors.OKGREEN}Server started successfully!{Colors.ENDC}")
            return process
        time.sleep(0.5)
    
    print(f"{Colors.FAIL}Failed to start server within {START_WAIT_TIME} seconds.{Colors.ENDC}")
    if process:
        process.kill()
    sys.exit(1)

def validate_schema(data, schema_desc):
    """Simple schema validation helper"""
    try:
        if schema_desc == "list":
            return isinstance(data, list)
        if schema_desc == "dict":
            return isinstance(data, dict)
        if schema_desc == "route_list":
            if not isinstance(data, (list, dict)): return False
            # Handle paginated response format from filter_routes
            if isinstance(data, dict) and 'routes' in data:
                return isinstance(data['routes'], list)
            return True
        return True
    except:
        return False

def check_endpoint(name, url, method="GET", expected_status=200, expected_content_type=None, validate_json=None, headers=None):
    full_url = f"{BASE_URL}{url}"
    start_time = time.time()
    
    if headers is None:
        headers = {}
    
    try:
        if method == "GET":
            response = requests.get(full_url, timeout=TIMEOUT, headers=headers)
        else:
            response = requests.request(method, full_url, timeout=TIMEOUT, headers=headers)
        
        duration = time.time() - start_time
        
        # Check status code
        if response.status_code != expected_status:
             content_preview = response.text[:100] if response.text else "Empty"
             print_status(name, "FAIL", f"Status: {response.status_code} != {expected_status} | Content: {content_preview}", duration)
             return False, None
        
        # Check content type
        if expected_content_type and expected_content_type not in response.headers.get('Content-Type', ''):
             print_status(name, "FAIL", f"Content-Type: {response.headers.get('Content-Type')} != {expected_content_type}", duration)
             return False, response

        # Validate JSON
        data = None
        if validate_json:
            try:
                data = response.json()
                if not validate_json(data):
                    print_status(name, "FAIL", "JSON validation failed", duration)
                    print(f"   {Colors.WARNING}Received type: {type(data)}{Colors.ENDC}")
                    return False, response
            except json.JSONDecodeError:
                print_status(name, "FAIL", "Invalid JSON response", duration)
                return False, response

        print_status(name, "PASS", "", duration)
        return True, response
        
    except requests.exceptions.ConnectionError:
        print_status(name, "FAIL", "Connection Refused", time.time() - start_time)
        return False, None
    except requests.exceptions.Timeout:
         print_status(name, "FAIL", "Timeout", time.time() - start_time)
         return False, None
    except Exception as e:
        print_status(name, "FAIL", str(e), time.time() - start_time)
        return False, None

def main():
    print(f"{Colors.HEADER}{Colors.BOLD}Running Extended Smoke Tests for Seyahat Öneri Sistemi{Colors.ENDC}")
    print(f"Target: {BASE_URL}")
    print("-" * 80)

    server_process = None
    server_was_running = is_port_in_use(PORT)
    
    if not server_was_running:
        server_process = start_server()
    else:
        print(f"{Colors.OKBLUE}Server is already running.{Colors.ENDC}")
    
    if server_process:
        time.sleep(2)

    failed_count = 0
    
    # --- 1. Static File Checks ---
    print(f"\n{Colors.HEADER}--- Static Files & Pages ---{Colors.ENDC}")
    static_checks = [
        {"name": "Static: Tab Controller", "url": "/static/js/poi-tabs/tab-controller.js", "expected_content_type": "javascript"},
        {"name": "Static: Predefined Routes CSS", "url": "/static/css/predefined_routes.css", "expected_content_type": "css"},
        {"name": "Static: Predefined Routes JS", "url": "/static/js/predefined_routes.js", "expected_content_type": "javascript"},
        {"name": "Static: POI Recommendation JS", "url": "/static/js/poi_recommendation_system.js", "expected_content_type": "javascript"},
        {"name": "Page: Predefined Routes HTML", "url": "/predefined_routes.html", "expected_status": 200},
    ]
    for check in static_checks:
        success, _ = check_endpoint(**check)
        if not success: failed_count += 1

    # --- 2. Basic API Checks ---
    print(f"\n{Colors.HEADER}--- Basic API Endpoints ---{Colors.ENDC}")
    
    # 2.1 Routes List
    success, resp = check_endpoint(
        name="API: Get All Routes",
        url="/api/routes",
        validate_json=lambda d: validate_schema(d, "route_list")
    )
    if not success: failed_count += 1
    
    # Helper to extract a valid route ID for later tests
    sample_route_id = None
    if success and resp:
        try:
            data = resp.json()
            routes_list = data.get('routes', []) if isinstance(data, dict) else data
            if routes_list and len(routes_list) > 0:
                sample_route_id = routes_list[0].get('id')
        except: pass

    # 2.2 Categories (Auth Protected)
    success, _ = check_endpoint(
        name="API: Categories (Auth Check)",
        url="/api/categories",
        expected_status=401,
        headers={"Content-Type": "application/json"}
    )
    if not success: failed_count += 1

    # 2.3 POIs List
    success, resp = check_endpoint(
        name="API: Get POIs",
        url="/api/pois?limit=5",
        validate_json=lambda d: validate_schema(d, "route_list") # POIs endpoint might return pagination dict too
    )
    if not success: failed_count += 1
    
    sample_poi_id = None
    if success and resp:
        try:
            data = resp.json()
            # Handle list or pagination dict
            pois_list = data.get('data', []) if isinstance(data, dict) and 'data' in data else (data.get('pois', []) if isinstance(data, dict) and 'pois' in data else (data if isinstance(data, list) else []))
            if pois_list and len(pois_list) > 0:
                sample_poi_id = pois_list[0].get('id')
        except: pass

    # --- 3. Detailed API Checks (Data Integrity) ---
    print(f"\n{Colors.HEADER}--- Data Integrity & Details ---{Colors.ENDC}")
    
    if sample_route_id:
        success, _ = check_endpoint(
            name=f"API: Route Details (ID: {sample_route_id})",
            url=f"/api/routes/{sample_route_id}", 
            # The structure is basically the route dict, so validating it has 'id' is safe enough
            # Also allowing for paginated/wrapped response format just in case
            validate_json=lambda d: (isinstance(d, dict) and ('id' in d or 'route' in d))
        )
        if not success: failed_count += 1
    else:
        print(f"{Colors.WARNING}Skipping Route Details test (no route ID found){Colors.ENDC}")

    if sample_poi_id:
        success, _ = check_endpoint(
            name=f"API: POI Details (ID: {sample_poi_id})",
            url=f"/api/poi/{sample_poi_id}",
            validate_json=lambda d: isinstance(d, dict) and 'name' in d
        )
        if not success: failed_count += 1
    else:
        print(f"{Colors.WARNING}Skipping POI Details test (no POI ID found){Colors.ENDC}")

    # --- 4. Logic & Filter Checks ---
    print(f"\n{Colors.HEADER}--- Logic & Filters ---{Colors.ENDC}")
    
    # 4.1 Route Filtering
    filter_url = "/api/routes?type=walking"
    success, resp = check_endpoint(
        name="API: Filter Routes (type=walking)",
        url=filter_url,
        validate_json=lambda d: validate_schema(d, "route_list")
    )
    if not success: failed_count += 1
    
    # 4.2 Search (Simulated)
    # Assuming search works via q param or similar, checking response isn't an error
    success, _ = check_endpoint(
        name="API: POI Search",
        url="/api/pois?q=museum", # Assuming q param
        expected_status=200 # Should return 200 even if empty list
    )
    if not success: failed_count += 1

    # --- 5. Error Handling Checks ---
    print(f"\n{Colors.HEADER}--- Error Handling ---{Colors.ENDC}")
    
    # 5.1 404 Resource
    success, _ = check_endpoint(
        name="API: Non-existent Route (404 Check)",
        url="/api/route/999999999",
        expected_status=404
    )
    if not success: failed_count += 1

    # 5.2 Invalid Filter Data
    # Sending garbage data to filter endpoint
    # This depends on API robustness, might return 200 with empty list or 400
    # We'll accept either, but ensure it doesn't 500 crash
    success, _ = check_endpoint(
        name="API: Invalid Filter (Robustness)",
        url="/api/routes?difficulty=veryhard",
        expected_status=200 # Usually returns empty list or ignores invalid param
    )
    if not success: failed_count += 1

    # --- Summary ---
    try:
        pass
    except KeyboardInterrupt:
        print("\nTests interrupted.")
    finally:
        print("-" * 80)
        if failed_count == 0:
            print(f"{Colors.OKGREEN}{Colors.BOLD}All Extended Smoke Tests Passed! 🚀{Colors.ENDC}")
        else:
            print(f"{Colors.FAIL}{Colors.BOLD}{failed_count} Tests Failed! 💥{Colors.ENDC}")

        if server_process:
            print(f"{Colors.HEADER}Stopping temporary server...{Colors.ENDC}")
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_process.kill()

if __name__ == "__main__":
    main()
