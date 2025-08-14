"""
WSGI entry point for POI Travel Recommendation API.
This file serves as the main entry point for production deployment.
"""

import os
import sys

# Add project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import the application factory
from app import create_app

# Create application instance
application = create_app()

# For compatibility, also expose as 'app'
app = application

if __name__ == "__main__":
    # Development server
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    application.run(
        host=host,
        port=port,
        debug=debug
    )
