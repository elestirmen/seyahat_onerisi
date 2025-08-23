#!/usr/bin/env python3
"""
Simple HTTP server that serves static files and proxies API requests
This avoids CSP issues by serving everything from the same origin
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
from urllib.error import URLError, HTTPError

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='/opt/rehber/seyahat_onerisi', **kwargs)
    
    def do_GET(self):
        # Handle API proxy requests
        if self.path.startswith('/api/'):
            self.proxy_api_request('GET')
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        # Handle API proxy requests
        if self.path.startswith('/api/'):
            self.proxy_api_request('POST')
        else:
            self.send_error(405, "Method not allowed")
    
    def proxy_api_request(self, method):
        """Proxy API requests to the POI API server on port 5560"""
        try:
            # Forward request to the POI API server
            api_url = f'http://localhost:5560{self.path}'
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': self.headers.get('User-Agent', 'ProxyServer/1.0')
            }
            
            data = None
            if method == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    data = self.rfile.read(content_length)
            
            # Make request to POI API
            req = urllib.request.Request(api_url, data=data, headers=headers, method=method)
            
            with urllib.request.urlopen(req, timeout=30) as response:
                # Forward response
                self.send_response(response.status)
                
                # Forward headers
                for header_name, header_value in response.headers.items():
                    if header_name.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header_name, header_value)
                
                self.end_headers()
                
                # Forward response body
                response_data = response.read()
                self.wfile.write(response_data)
                
        except HTTPError as e:
            print(f"❌ API HTTP Error: {e.code} - {e.reason}")
            self.send_error(e.code, f"API Error: {e.reason}")
        except URLError as e:
            print(f"❌ API URL Error: {e.reason}")
            self.send_error(502, f"API server not available: {e.reason}")
        except Exception as e:
            print(f"❌ Proxy Error: {e}")
            self.send_error(500, f"Proxy error: {str(e)}")

def run_server(port=8080):
    """Run the proxy server"""
    try:
        with socketserver.TCPServer(("", port), ProxyHTTPRequestHandler) as httpd:
            print(f"🚀 Proxy server starting on port {port}")
            print(f"📊 POI Recommendation System: http://localhost:{port}/poi_recommendation_system.html")
            print(f"🔌 API requests will be proxied to: http://localhost:5560/api/")
            print(f"📁 Static files served from: /opt/rehber/seyahat_onerisi")
            print("\n🎯 To test the system:")
            print("1. Make sure POI API is running on port 5560")
            print("2. Open http://localhost:8080/poi_recommendation_system.html")
            print("3. The API requests will work without CSP issues")
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✅ Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")

if __name__ == "__main__":
    run_server()