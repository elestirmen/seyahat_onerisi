"""
Health check routes for POI Travel Recommendation API.
Provides system health monitoring and status information.
"""

from flask import Blueprint, jsonify, current_app
import psutil
import os
import time
from datetime import datetime

# Create Health blueprint
health_bp = Blueprint('health', __name__, url_prefix='/api/health')


@health_bp.route('/', methods=['GET'])
def health_check():
    """
    Basic health check endpoint.
    
    Returns:
        JSON response with system status
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'POI Travel Recommendation API',
        'version': '1.0.0'
    }), 200


@health_bp.route('/detailed', methods=['GET'])
def detailed_health_check():
    """
    Detailed health check with system metrics.
    
    Returns:
        JSON response with detailed system information
    """
    try:
        # System metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Application metrics
        app_config = {
            'environment': current_app.config.get('FLASK_ENV', 'unknown'),
            'debug': current_app.config.get('DEBUG', False),
            'database_configured': bool(current_app.config.get('DB_HOST')),
            'cors_enabled': bool(current_app.config.get('CORS_ORIGINS')),
            'rate_limiting': current_app.config.get('RATE_LIMIT_ENABLED', False)
        }
        
        # Database health (basic check)
        db_status = 'unknown'
        try:
            # Try to import database module
            from app.config.database import get_database_pool
            pool = get_database_pool()
            if pool and pool.pool:
                db_status = 'healthy'
            else:
                db_status = 'unhealthy'
        except Exception as e:
            db_status = f'error: {str(e)}'
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'POI Travel Recommendation API',
            'version': '1.0.0',
            'system': {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_gb': round(memory.available / (1024**3), 2),
                'disk_percent': disk.percent,
                'disk_free_gb': round(disk.free / (1024**3), 2)
            },
            'application': app_config,
            'database': {
                'status': db_status
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check for load balancers and orchestration systems.
    
    Returns:
        JSON response indicating if the service is ready to receive traffic
    """
    try:
        # Check if database is accessible
        from app.config.database import get_database_pool
        pool = get_database_pool()
        
        if not pool or not pool.pool:
            return jsonify({
                'status': 'not_ready',
                'timestamp': datetime.utcnow().isoformat(),
                'reason': 'Database pool not initialized'
            }), 503
        
        # Check if we can get a connection
        try:
            with pool.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
        except Exception as e:
            return jsonify({
                'status': 'not_ready',
                'timestamp': datetime.utcnow().isoformat(),
                'reason': f'Database connection failed: {str(e)}'
            }), 503
        
        return jsonify({
            'status': 'ready',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'POI Travel Recommendation API'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'not_ready',
            'timestamp': datetime.utcnow().isoformat(),
            'reason': f'Service error: {str(e)}'
        }), 503