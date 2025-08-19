"""
Main Flask application for POI Travel Recommendation API.
Entry point for development and testing.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import the application factory
from app import create_app

# Create application instance
app = create_app()

if __name__ == "__main__":
    # Development server
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"Starting POI API server on {host}:{port}")
    print(f"Debug mode: {debug}")
    print(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    
    app.run(
        host=host,
        port=port,
        debug=debug
    )