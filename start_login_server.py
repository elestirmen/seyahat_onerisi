#!/usr/bin/env python3
"""
Simple HTTP server to serve login page without CORS issues.
"""

import http.server
import socketserver
import os
import webbrowser
import threading
import time

class LoginHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def start_server():
    PORT = 3000
    
    # Change to current directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), LoginHandler) as httpd:
        print(f"🌐 Login server started at http://localhost:{PORT}")
        print(f"📁 Serving files from: {os.getcwd()}")
        print(f"🔗 Login page: http://localhost:{PORT}/direct_login.html")
        print("Press Ctrl+C to stop")
        
        # Auto-open browser after 1 second
        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://localhost:{PORT}/direct_login.html')
        
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    start_server()