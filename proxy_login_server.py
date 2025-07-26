#!/usr/bin/env python3
"""
Proxy server that serves login page and forwards API requests to POI API.
This solves CORS issues by serving everything from the same origin.
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import webbrowser
import threading
import time

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests - proxy to POI API"""
        if (self.path.startswith('/auth/') or 
            self.path.startswith('/api/') or 
            self.path.startswith('/poi/') or
            self.path.startswith('/categories') or
            self.path.startswith('/upload')):
            self.proxy_to_poi_api()
        else:
            self.send_error(404, "Not Found")
    
    def do_GET(self):
        """Handle GET requests - serve files or proxy to POI API"""
        if self.path.startswith('/auth/'):
            self.proxy_to_poi_api()
        elif self.path == '/' or self.path == '/index.html':
            # Serve poi_manager_ui.html as main page
            try:
                with open('poi_manager_ui.html', 'r', encoding='utf-8') as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except FileNotFoundError:
                self.send_error(404, "poi_manager_ui.html not found")
        elif (self.path.startswith('/api/') or 
              self.path.startswith('/poi_') or 
              self.path.startswith('/categories') or
              self.path.startswith('/upload') or
              self.path.startswith('/media/') or
              self.path.startswith('/static/') or
              self.path.startswith('/maps/') or
              self.path.startswith('/download/')):
            # Proxy all API and static requests to POI server
            self.proxy_to_poi_api()
        else:
            # Serve static files
            super().do_GET()
    
    def proxy_to_poi_api(self):
        """Proxy request to POI API on port 5505"""
        try:
            # Read request body for POST requests
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else None
            
            # Build target URL
            target_url = f'http://localhost:5505{self.path}'
            
            # Create request
            req = urllib.request.Request(target_url, data=post_data, method=self.command)
            
            # Copy headers (except Host)
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    req.add_header(header, value)
            
            # Make request to POI API
            with urllib.request.urlopen(req) as response:
                # Send response status
                self.send_response(response.status)
                
                # Copy response headers
                for header, value in response.headers.items():
                    if header.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header, value)
                
                # Add CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                
                self.end_headers()
                
                # Copy response body
                self.wfile.write(response.read())
                
        except urllib.error.URLError as e:
            print(f"Proxy error: {e}")
            self.send_error(502, f"Bad Gateway: {e}")
        except Exception as e:
            print(f"Proxy error: {e}")
            self.send_error(500, f"Internal Server Error: {e}")
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def start_proxy_server():
    PORT = 3001
    
    # Change to current directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        print(f"🌐 Proxy server started at http://localhost:{PORT}")
        print(f"📁 Serving files from: {os.getcwd()}")
        print(f"🔗 Login page: http://localhost:{PORT}/direct_login.html")
        print(f"🔄 Proxying /auth/* to http://localhost:5505")
        print("Press Ctrl+C to stop")
        
        # Auto-open browser after 1 second
        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://localhost:{PORT}/direct_login.html')
        
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Proxy server stopped")

if __name__ == "__main__":
    start_proxy_server()