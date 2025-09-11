from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, Blueprint, abort
from flask_cors import CORS
from poi_database_adapter import POIDatabaseFactory
from poi_media_manager import POIMediaManager
from route_service import RouteService
from route_file_parser import RouteFileParser, RouteParserError
from elevation_service import ElevationService
from psycopg2.extras import RealDictCursor
import psycopg2
import os
import json
import uuid
import unicodedata
import re
import secrets
from datetime import datetime
from werkzeug.utils import secure_filename
from auth_middleware import auth_middleware
from auth_config import auth_config
from session_config import configure_session
import time
from functools import wraps
import tempfile
import hashlib
from werkzeug.datastructures import FileStorage
import threading
import queue
import math
import logging
from typing import List, Tuple, Set, Dict, Any

# Database connection helper
def get_db_conn():
    """
    Create a raw psycopg2 connection using environment variables or a
    connection string. This bypasses the project's custom database wrapper.
    """
    conn_str = os.getenv("POI_DB_CONNECTION")
    if conn_str:
        return psycopg2.connect(conn_str)

    return psycopg2.connect(
        host=os.getenv("POI_DB_HOST", "127.0.0.1"),
        port=int(os.getenv("POI_DB_PORT", "5432")),
        dbname=os.getenv("POI_DB_NAME", "poi_db"),
        user=os.getenv("POI_DB_USER", "poi_user"),
        password=os.getenv("POI_DB_PASSWORD"),
    )

# Setup logger
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app, origins=["*"], supports_credentials=True)

# Configure session management
configure_session(app)

# Initialize authentication middleware
auth_middleware.init_app(app)

# Rate limiting for admin endpoints
admin_rate_limits = {}

def admin_rate_limit(max_requests=30, window_seconds=60):
    """
    Rate limiting decorator for admin endpoints
    
    Args:
        max_requests: Maximum requests allowed in the time window
        window_seconds: Time window in seconds
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            current_time = time.time()
            
            # Clean old entries
            if client_ip in admin_rate_limits:
                admin_rate_limits[client_ip] = [
                    timestamp for timestamp in admin_rate_limits[client_ip]
                    if current_time - timestamp < window_seconds
                ]
            else:
                admin_rate_limits[client_ip] = []
            
            # Check rate limit
            if len(admin_rate_limits[client_ip]) >= max_requests:
                logger.warning(f"Rate limit exceeded for admin endpoint from IP: {client_ip}")
                return jsonify({
                    'success': False,
                    'error': 'Rate limit exceeded. Please try again later.'
                }), 429
            
            # Record this request
            admin_rate_limits[client_ip].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Create authentication blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET'])
def login_page():
    """Serve the login page."""
    if auth_middleware.is_authenticated():
        # Respect optional next parameter for post-login redirect
        next_url = request.args.get('next')
        try:
            if next_url and isinstance(next_url, str):
                # Basic safety check: only allow same-origin relative paths without scheme
                if next_url.startswith('/') and '://' not in next_url and '\\' not in next_url:
                    return redirect(next_url)
        except Exception:
            pass
        return redirect('/')
    
    # Serve embedded login page
    login_html = '''<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>POI Yönetim Paneli - Giriş</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .login-header h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .login-header p {
            color: #666;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: 500;
        }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        .login-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .login-btn:hover {
            transform: translateY(-2px);
        }
        .login-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .message {
            margin-top: 15px;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            font-size: 14px;
        }
        .message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🗺️ POI Yönetim Paneli</h1>
            <p>Devam etmek için giriş yapın</p>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">Şifre</label>
                <input type="password" id="password" name="password" required placeholder="Şifrenizi girin">
            </div>
            
            <button type="submit" class="login-btn" id="loginBtn">
                <span id="btnText">Giriş Yap</span>
                <span id="btnLoading" style="display: none;"><span class="loading"></span> Giriş yapılıyor...</span>
            </button>
        </form>
        
        <div id="message"></div>
    </div>

    <script>
        const loginForm = document.getElementById('loginForm');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const btnText = document.getElementById('btnText');
        const btnLoading = document.getElementById('btnLoading');
        const messageDiv = document.getElementById('message');

        // Read optional next parameter from URL
        const urlParams = new URLSearchParams(window.location.search);
        const nextUrl = urlParams.get('next');
        
        function showMessage(text, type = 'info') {
            messageDiv.innerHTML = `<div class="message ${type}">${text}</div>`;
        }
        
        function setLoading(loading) {
            if (loading) {
                btnText.style.display = 'none';
                btnLoading.style.display = 'inline';
                loginBtn.disabled = true;
            } else {
                btnText.style.display = 'inline';
                btnLoading.style.display = 'none';
                loginBtn.disabled = false;
            }
        }
        
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = passwordInput.value.trim();
            
            if (!password) {
                showMessage('Lütfen şifrenizi girin.', 'error');
                return;
            }
            
            setLoading(true);
            showMessage('Giriş yapılıyor...', 'info');
            
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        password: password,
                        remember_me: false,
                        csrf_token: null
                    }),
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showMessage('✅ Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
                    setTimeout(() => {
                        window.location.href = nextUrl ? nextUrl : '/';
                    }, 1500);
                } else {
                    let errorMessage = data.error || data.message || 'Giriş başarısız';
                    
                    if (response.status === 401) {
                        errorMessage = 'Hatalı şifre. Lütfen tekrar deneyin.';
                    } else if (response.status === 429) {
                        errorMessage = 'Çok fazla deneme. Lütfen bekleyin.';
                    } else if (response.status === 403) {
                        errorMessage = 'Güvenlik hatası. Sayfa yenilenecek.';
                        setTimeout(() => window.location.reload(), 2000);
                    }
                    
                    showMessage(`❌ ${errorMessage}`, 'error');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
                
            } catch (error) {
                console.error('Login error:', error);
                showMessage('❌ Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
            } finally {
                setLoading(false);
            }
        });
        
        // Auto-focus password field
        passwordInput.focus();
    </script>
</body>
</html>'''
    
    return login_html

@auth_bp.route('/debug', methods=['GET'])
def debug_page():
    """Serve the debug page."""
    try:
        with open('static/debug.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return jsonify({'error': 'Debug page not found'}), 404

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Handle user login."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        # Get client IP for rate limiting
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        
        # Check rate limiting
        is_allowed, remaining_attempts, lockout_time, delay_seconds = auth_middleware.check_rate_limit(client_ip)
        
        if not is_allowed:
            if lockout_time:
                return jsonify({
                    'error': 'Too many failed attempts. Account temporarily locked.',
                    'lockout_time': lockout_time,
                    'remaining_attempts': 0
                }), 429
            elif delay_seconds > 0:
                return jsonify({
                    'error': f'Please wait {int(delay_seconds)} seconds before trying again.',
                    'delay_seconds': int(delay_seconds),
                    'remaining_attempts': remaining_attempts
                }), 429
        
        # Get form data
        data = request.get_json() if request.is_json else request.form
        password = data.get('password', '').strip()
        remember_me = data.get('remember_me', False)
        csrf_token = data.get('csrf_token', '')
        
        # Basic validation
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Validate CSRF token if session exists (for subsequent login attempts)
        # Skip CSRF validation for initial login attempt when no session exists
        if session.get('csrf_token') and csrf_token and not auth_middleware.validate_csrf_token(csrf_token):
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        # Validate password
        if not auth_middleware.validate_password(password):
            # Record failed attempt with user agent for security tracking
            user_agent = request.headers.get('User-Agent', 'Unknown')
            auth_middleware.record_failed_attempt(client_ip, user_agent)
            
            # Get updated rate limit info
            _, remaining_attempts, _, _ = auth_middleware.check_rate_limit(client_ip)
            
            return jsonify({
                'error': 'Invalid password',
                'remaining_attempts': remaining_attempts
            }), 401
        
        # Clear failed attempts on successful login
        auth_middleware.clear_failed_attempts(client_ip)
        
        # Create session
        if auth_middleware.create_session(remember_me):
            response_data = {
                'success': True,
                'message': 'Login successful',
                'csrf_token': auth_middleware.get_csrf_token(),
                'session_info': auth_middleware.get_session_info()
            }
            
            response = jsonify(response_data)
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        else:
            error_response = jsonify({'error': 'Failed to create session'})
            error_response.headers.add('Access-Control-Allow-Origin', '*')
            return error_response, 500
            
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Handle user logout."""
    try:
        # Validate CSRF token
        data = request.get_json() if request.is_json else request.form
        csrf_token = data.get('csrf_token', '')
        
        if not auth_middleware.validate_csrf_token(csrf_token):
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        # Destroy session
        if auth_middleware.destroy_session():
            return jsonify({
                'success': True,
                'message': 'Logout successful'
            })
        else:
            return jsonify({'error': 'Failed to logout'}), 500
            
    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/status', methods=['GET'])
def auth_status():
    """Check authentication status."""
    try:
        if auth_middleware.is_authenticated():
            session_info = auth_middleware.get_session_info()
            response_data = {
                'authenticated': True,
                'session_info': session_info,
                'csrf_token': auth_middleware.get_csrf_token()
            }
        else:
            response_data = {
                'authenticated': False,
                'csrf_token': None
            }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Auth status error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/clear-rate-limits', methods=['POST'])
@auth_middleware.require_auth
def clear_rate_limits():
    """Clear rate limiting cache (for testing)."""
    global admin_rate_limits
    admin_rate_limits.clear()
    return jsonify({
        'success': True,
        'message': 'Rate limits cleared'
    })

@auth_bp.route('/csrf-token', methods=['GET'])
def csrf_token():
    """Get CSRF token for forms."""
    try:
        # Generate a CSRF token even for non-authenticated users (for login form)
        if not session.get('csrf_token'):
            session['csrf_token'] = secrets.token_hex(16)
        
        return jsonify({
            'csrf_token': session.get('csrf_token')
        })
        
    except Exception as e:
        print(f"CSRF token error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@auth_middleware.require_auth
def change_password():
    """Handle password change for authenticated users."""
    try:
        # Get form data
        data = request.get_json() if request.is_json else request.form
        current_password = data.get('current_password', '').strip()
        new_password = data.get('new_password', '').strip()
        confirm_password = data.get('confirm_password', '').strip()
        csrf_token = data.get('csrf_token', '')
        
        # Validate CSRF token
        if not auth_middleware.validate_csrf_token(csrf_token):
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        # Basic validation
        if not current_password:
            return jsonify({'error': 'Current password is required'}), 400
        
        if not new_password:
            return jsonify({'error': 'New password is required'}), 400
        
        if not confirm_password:
            return jsonify({'error': 'Password confirmation is required'}), 400
        
        # Check if new password matches confirmation
        if new_password != confirm_password:
            return jsonify({'error': 'New password and confirmation do not match'}), 400
        
        # Validate current password
        if not auth_middleware.validate_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Password strength validation
        password_validation = validate_password_strength(new_password)
        if not password_validation['valid']:
            return jsonify({'error': password_validation['message']}), 400
        
        # Check if new password is different from current
        if current_password == new_password:
            return jsonify({'error': 'New password must be different from current password'}), 400
        
        # Hash the new password
        new_password_hash = auth_config.hash_password(new_password)
        
        # Update password hash in configuration
        # Note: In a production system, this would update a database
        # For this implementation, we'll update the environment variable approach
        if not update_password_hash(new_password_hash):
            return jsonify({'error': 'Failed to update password'}), 500
        
        # Terminate all active sessions (force re-login)
        terminate_all_sessions()
        
        return jsonify({
            'success': True,
            'message': 'Password changed successfully. Please log in again.'
        })
        
    except Exception as e:
        print(f"Change password error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def validate_password_strength(password):
    """
    Validate password strength according to security requirements.
    
    Args:
        password: Password to validate
        
    Returns:
        dict: {'valid': bool, 'message': str}
    """
    if len(password) < 8:
        return {'valid': False, 'message': 'Password must be at least 8 characters long'}
    
    if len(password) > 128:
        return {'valid': False, 'message': 'Password must be less than 128 characters long'}
    
    # Check for at least one uppercase letter
    if not any(c.isupper() for c in password):
        return {'valid': False, 'message': 'Password must contain at least one uppercase letter'}
    
    # Check for at least one lowercase letter
    if not any(c.islower() for c in password):
        return {'valid': False, 'message': 'Password must contain at least one lowercase letter'}
    
    # Check for at least one digit
    if not any(c.isdigit() for c in password):
        return {'valid': False, 'message': 'Password must contain at least one number'}
    
    # Check for at least one special character
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return {'valid': False, 'message': 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'}
    
    # Check for common weak passwords
    weak_passwords = [
        'password', '12345678', 'qwerty123', 'admin123', 'password123',
        'letmein123', 'welcome123', 'changeme123'
    ]
    if password.lower() in weak_passwords:
        return {'valid': False, 'message': 'Password is too common. Please choose a stronger password'}
    
    return {'valid': True, 'message': 'Password is strong'}

def update_password_hash(new_password_hash):
    """
    Update the password hash in the system.
    
    Args:
        new_password_hash: New bcrypt password hash
        
    Returns:
        bool: True if update successful, False otherwise
    """
    try:
        # Update the auth_config instance
        auth_config.PASSWORD_HASH = new_password_hash
        
        # In a production system, you would update a database here
        # For this implementation, we'll write to a config file
        config_file_path = '.env.local'
        
        # Read existing config
        existing_config = {}
        if os.path.exists(config_file_path):
            with open(config_file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and '=' in line and not line.startswith('#'):
                        key, value = line.split('=', 1)
                        existing_config[key] = value
        
        # Update password hash
        existing_config['POI_ADMIN_PASSWORD_HASH'] = new_password_hash
        
        # Write updated config
        with open(config_file_path, 'w') as f:
            f.write("# POI Authentication Configuration\n")
            f.write("# This file is automatically updated when password is changed\n\n")
            for key, value in existing_config.items():
                f.write(f"{key}={value}\n")
        
        print(f"Password hash updated in {config_file_path}")
        return True
        
    except Exception as e:
        print(f"Error updating password hash: {e}")
        return False

def terminate_all_sessions():
    """
    Terminate all active sessions to force re-authentication.
    This is called after password change for security.
    """
    try:
        # Clear current session
        session.clear()
        
        # In a production system with multiple servers, you would:
        # 1. Update a session blacklist in database
        # 2. Increment a global session version number
        # 3. Use Redis to invalidate all sessions
        
        # For this file-based session system, we'll clean up session files
        import tempfile
        import glob
        
        session_dir = os.path.join(tempfile.gettempdir(), 'poi_sessions')
        if os.path.exists(session_dir):
            session_files = glob.glob(os.path.join(session_dir, 'session:*'))
            for session_file in session_files:
                try:
                    os.remove(session_file)
                except Exception as e:
                    print(f"Error removing session file {session_file}: {e}")
        
        print("All sessions terminated after password change")
        
    except Exception as e:
        print(f"Error terminating sessions: {e}")

# Register authentication blueprint
app.register_blueprint(auth_bp)

# JSON verileri için fallback
JSON_FALLBACK = False
JSON_FILE_PATH = 'test_data.json'

# Pre-loaded walking network graph
def load_walking_graph():
    """Load walking GraphML data once and cache it."""
    global WALKING_GRAPH
    if WALKING_GRAPH is None:
        try:
            import osmnx as ox
        except Exception as e:
            raise ImportError(f"OSMnx required for walking routes: {e}")

        if not os.path.exists(WALKING_GRAPH_PATH):
            raise FileNotFoundError(f"GraphML file not found: {WALKING_GRAPH_PATH}")

        print(f"\U0001F4C1 Loading walking network from: {WALKING_GRAPH_PATH}")
        WALKING_GRAPH = ox.load_graphml(WALKING_GRAPH_PATH)
        print(f"\u2705 Network loaded: {len(WALKING_GRAPH.nodes)} nodes, {len(WALKING_GRAPH.edges)} edges")

    return WALKING_GRAPH

# Rating kategorileri (yeni POI puanlama sistemi)
RATING_CATEGORIES = {
    'tarihi': {'name': 'Tarihi', 'description': 'Tarihi önem ve değer', 'icon': 'fa-landmark', 'color': '#8B4513'},
    'sanat_kultur': {'name': 'Sanat ve Kültür', 'description': 'Sanatsal ve kültürel değer', 'icon': 'fa-palette', 'color': '#9B59B6'},
    'doga': {'name': 'Doğa', 'description': 'Doğal güzellik ve çevre', 'icon': 'fa-leaf', 'color': '#27AE60'},
    'eglence': {'name': 'Eğlence', 'description': 'Eğlence ve aktivite değeri', 'icon': 'fa-music', 'color': '#E74C3C'},
    'alisveris': {'name': 'Alışveriş', 'description': 'Alışveriş olanakları', 'icon': 'fa-shopping-cart', 'color': '#F39C12'},
    'spor': {'name': 'Spor', 'description': 'Spor aktiviteleri', 'icon': 'fa-dumbbell', 'color': '#34495E'},
    'macera': {'name': 'Macera', 'description': 'Macera ve heyecan', 'icon': 'fa-mountain', 'color': '#D35400'},
    'rahatlatici': {'name': 'Rahatlatıcı', 'description': 'Huzur ve dinlendirici', 'icon': 'fa-spa', 'color': '#1ABC9C'},
    'yemek': {'name': 'Yemek', 'description': 'Gastronomi ve lezzet', 'icon': 'fa-utensils', 'color': '#E67E22'},
    'gece_hayati': {'name': 'Gece Hayatı', 'description': 'Gece eğlencesi', 'icon': 'fa-moon', 'color': '#6C3483'}
}

# Medya yönetimi (görsel, video, ses, 3D model desteği)
media_manager = POIMediaManager()

# Desteklenen dosya uzantıları (tüm medya türleri)
ALLOWED_EXTENSIONS = set()
for media_type, config in media_manager.SUPPORTED_FORMATS.items():
    for ext in config['extensions']:
        ALLOWED_EXTENSIONS.add(ext[1:])  # nokta olmadan ekle

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def normalize_turkish_text(text):
    """
    Türkçe karakterleri ve büyük/küçük harfleri normalize et
    Arama için kullanılacak
    """
    if not text:
        return ""
    
    # Küçük harfe çevir
    text = text.lower()
    
    # Türkçe karakterleri ASCII karşılıklarıyla değiştir
    turkish_map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    }
    
    for turkish_char, ascii_char in turkish_map.items():
        text = text.replace(turkish_char, ascii_char)
    
    # Ekstra boşlukları temizle
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def fuzzy_search_match(search_term, target_text, threshold=0.6):
    """
    Bulanık arama - kısmi eşleşme ve Türkçe karakter desteği
    """
    if not search_term or not target_text:
        return False
    
    # Her ikisini de normalize et
    norm_search = normalize_turkish_text(search_term)
    norm_target = normalize_turkish_text(target_text)
    
    # Tam eşleşme kontrolü
    if norm_search in norm_target:
        return True
    
    # Kelime kelime arama
    search_words = norm_search.split()
    target_words = norm_target.split()
    
    matched_words = 0
    for search_word in search_words:
        for target_word in target_words:
            if search_word in target_word or target_word in search_word:
                matched_words += 1
                break
    
    # Eşik değerini kontrol et
    match_ratio = matched_words / len(search_words)
    return match_ratio >= threshold

def load_test_data():
    """Test verilerini JSON dosyasından yükle"""
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_test_data(data):
    """Test verilerini JSON dosyasına kaydet"""
    try:
        with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"JSON dosyasına yazma hatası: {e}")
        return False

def get_db():
    global JSON_FALLBACK
    try:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        return db
    except Exception as e:
        print(f"⚠️  Veritabanına bağlanılamadı, JSON verileri kullanılacak: {e}")
        JSON_FALLBACK = True
        return None

@app.route('/')
def index():
    """Genel kullanıcılar için ana sayfa → öneri sistemi sayfasına yönlendir."""
    # Son kullanıcı için giriş istemeden öneri sistemi sayfasına yönlendir
    return redirect('/poi_recommendation_system.html')

@app.route('/admin')
@auth_middleware.require_auth
def admin_panel():
    """Admin paneli - POI yönetim paneline yönlendir."""
    return redirect('/poi_manager_ui.html')

@app.route('/admin-dashboard')
@auth_middleware.require_auth
def admin_dashboard():
    return '''
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>POI Yönetim Sistemi</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
            .container { max-width: 800px; margin: 0 auto; }
            .card { background: white; border-radius: 12px; padding: 30px; margin: 20px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 10px 10px 10px 0; font-weight: 600; transition: all 0.3s ease; }
            .btn-primary { background: #3498db; color: white; }
            .btn-success { background: #27ae60; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
            h1 { color: #2c3e50; margin-bottom: 10px; }
            .subtitle { color: #7f8c8d; margin-bottom: 30px; }
            .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
            .feature-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
            .api-list { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .api-list ul { list-style: none; padding: 0; }
            .api-list li { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
            .api-list li:last-child { border-bottom: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1><i class="fas fa-map-marked-alt"></i> POI Yönetim Sistemi</h1>
                <p class="subtitle">Kapadokya POI'leri ve Rota Haritaları Yönetim Paneli</p>
                
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3><i class="fas fa-cogs"></i> POI Yönetimi</h3>
                        <p>POI'leri ekle, düzenle, sil ve görsellerini yönet</p>
                        <a href="/poi_manager_ui.html" class="btn btn-primary">
                            <i class="fas fa-tools"></i> Yönetim Paneli
                        </a>
                    </div>
                    
                    <div class="feature-card">
                        <h3><i class="fas fa-map"></i> Harita Galerisi</h3>
                        <p>Oluşturulan rota haritalarını görüntüle ve indir</p>
                        <a href="/maps" class="btn btn-success">
                            <i class="fas fa-images"></i> Harita Listesi
                        </a>
                    </div>
                </div>
                
                <div class="api-list">
                    <h3><i class="fas fa-code"></i> API Dokümantasyonu</h3>
                    <h4>📌 POI Yönetimi</h4>
                    <ul>
                        <li><strong>GET</strong> <a href="/api/pois">/api/pois</a> - Tüm POI'leri listele</li>
                        <li><strong>GET</strong> <a href="/api/pois?search=ajwa">/api/pois?search=terim</a> - POI'lerde arama yap</li>
                        <li><strong>GET</strong> <a href="/api/search?q=ürgüp">/api/search?q=terim</a> - Gelişmiş arama (Türkçe karakter desteği)</li>
                        <li><strong>POST</strong> /api/poi - Yeni POI ekle</li>
                        <li><strong>PUT</strong> /api/poi/&lt;id&gt; - POI güncelle</li>
                        <li><strong>DELETE</strong> /api/poi/&lt;id&gt; - POI sil</li>
                    </ul>
                    
                    <h4>⭐ Rating Sistemi (Yeni!)</h4>
                    <ul>
                        <li><strong>GET</strong> <a href="/api/ratings/categories">/api/ratings/categories</a> - Rating kategorilerini listele</li>
                        <li><strong>GET</strong> /api/poi/&lt;id&gt;/ratings - POI rating'lerini getir</li>
                        <li><strong>PUT</strong> /api/poi/&lt;id&gt;/ratings - POI rating'lerini güncelle</li>
                        <li><strong>GET</strong> <a href="/api/pois/by-rating?category=tarihi&min_score=50">/api/pois/by-rating</a> - Rating'e göre POI ara</li>
                        <li><em>Kategoriler:</em> Tarihi, Sanat&Kültür, Doğa, Eğlence, Alışveriş, Spor, Macera, Rahatlatıcı, Yemek, Gece Hayatı</li>
                    </ul>
                    
                    <h4>🎬 Medya Yönetimi (Yeni!)</h4>
                    <ul>
                        <li><strong>GET</strong> /api/poi/&lt;id&gt;/media - POI medya dosyalarını listele</li>
                        <li><strong>POST</strong> /api/poi/&lt;id&gt;/media - POI'ye medya yükle</li>
                        <li><strong>DELETE</strong> /api/poi/&lt;id&gt;/media/&lt;filename&gt; - Medya dosyası sil</li>
                        <li><em>Desteklenen türler:</em> Görsel, Video, Ses, 3D Model</li>
                    </ul>
                    
                    <h4>🖼️ Görsel API (Geriye Uyumlu)</h4>
                    <ul>
                        <li><strong>GET</strong> /api/poi/&lt;id&gt;/images - POI görsellerini listele</li>
                        <li><strong>POST</strong> /api/poi/&lt;id&gt;/images - POI'ye görsel yükle</li>
                        <li><strong>DELETE</strong> /api/poi/&lt;id&gt;/images/&lt;filename&gt; - Görsel sil</li>
                    </ul>
                    
                    <h4>🔧 Sistem Yönetimi</h4>
                    <ul>
                        <li><strong>GET</strong> <a href="/api/system/media-info">/api/system/media-info</a> - Medya sistemi bilgileri</li>
                        <li><strong>POST</strong> /api/system/cleanup-media-folders - Gereksiz klasörleri temizle</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                    <p style="color: #7f8c8d; margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        Harita oluşturmak için: <code>python category_route_planner_with_db.py</code>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    '''

@app.route('/poi_recommendation_system.html')
def serve_poi_recommendation_system():
    """Serve the POI recommendation system HTML file"""
    try:
        if os.path.exists('poi_recommendation_system.html'):
            with open('poi_recommendation_system.html', 'r', encoding='utf-8') as f:
                return f.read()
        else:
            return '<h1>❌ Hata</h1><p>poi_recommendation_system.html dosyası bulunamadı!</p>', 404
    except Exception as e:
        return f'<h1>❌ Hata</h1><p>Dosya okunurken hata oluştu: {str(e)}</p>', 500

@app.route('/poi_manager_ui.html')
@auth_middleware.require_auth
def serve_ui():
    try:
        # HTML dosyasını oku ve görsel desteği ekle
        with open('poi_manager_ui.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Görsel desteği için JavaScript kodlarını ekle
        enhanced_js = """
        // Görsel modal ve yardımcı fonksiyonlar
        function showImageModal(imagePath, poiName, filename) {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold"><i class="fas fa-image me-2"></i>${filename}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center p-4">
                            <img src="${imagePath}" class="img-fluid rounded-3 shadow-lg" alt="${poiName}" style="max-height: 70vh; transition: transform 0.3s ease;" 
                                 onload="this.style.opacity='1'" style="opacity: 0;">
                            <div class="mt-3">
                                <p class="text-muted mb-1"><i class="fas fa-map-marker-alt me-1"></i>${poiName}</p>
                                <small class="text-muted">Görseli büyütmek için tıklayın</small>
                            </div>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <a href="${imagePath}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-external-link-alt me-1"></i> Yeni Sekmede Aç
                            </a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i> Kapat
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });
        }

        function getImageTypeIcon(filename) {
            const name = filename.toLowerCase();
            if (name.includes('exterior') || name.includes('dis')) return '🏢';
            if (name.includes('interior') || name.includes('ic')) return '🏠';
            if (name.includes('food') || name.includes('yemek')) return '🍽️';
            if (name.includes('menu')) return '📋';
            if (name.includes('logo')) return '🏷️';
            return '📷';
        }

        // showPOIDetail fonksiyonunu güncelle
        async function showPOIDetail(poiId) {
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}`);
                if (!response.ok) throw new Error('POI not found');
                const poi = await response.json();

                selectedPOI = poi;

                // Form alanlarını doldur (düzenleme için hazır hale getir)
                document.getElementById('poiId').value = poi._id;
                document.getElementById('poiName').value = poi.name;
                document.getElementById('poiCategory').value = poi.category;
                document.getElementById('poiLat').value = poi.latitude;
                document.getElementById('poiLon').value = poi.longitude;
                document.getElementById('poiDesc').value = poi.description || '';
                document.getElementById('poiTags').value = (poi.tags || []).join(', ');

                // Formu düzenleme moduna geçir
                document.getElementById('saveBtn').innerHTML = '🔄 Güncelle';
                document.getElementById('deleteBtn').classList.remove('d-none');
                document.getElementById('cancelEditBtn').classList.remove('d-none');

                // Panel başlığını güncelle
                document.getElementById('panelTitle').textContent = `📝 ${poi.name}`;
                document.getElementById('newPoiBtn').classList.remove('d-none');

                // Detaylar tab'ını göster ve aktif yap
                document.getElementById('details-tab-container').style.display = 'block';
                
                // Bootstrap tab geçişi
                const detailsTab = new bootstrap.Tab(document.getElementById('details-tab'));
                detailsTab.show();

                let detailHtml = `
                    <div class="poi-detail-header">
                        <h5 class="mb-2 fw-bold">${poi.name}</h5>
                        <span class="badge bg-light text-dark fs-6">${getCategoryDisplayName(poi.category)}</span>
                    </div>
                    
                    <div class="poi-detail-info">
                        <p class="mb-2"><i class="fas fa-map-marker-alt text-danger me-2"></i> <strong>Konum:</strong> ${poi.latitude.toFixed(6)}, ${poi.longitude.toFixed(6)}</p>`;

                if (poi.description) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-info-circle text-info me-2"></i> <strong>Açıklama:</strong> ${poi.description}</p>`;
                }
                if (poi.tags && poi.tags.length > 0) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-tags text-success me-2"></i> <strong>Etiketler:</strong> ${poi.tags.join(', ')}</p>`;
                }
                
                detailHtml += `</div>`;

                // Görselleri yükle ve göster
                try {
                    const imagesResponse = await fetch(`${apiBase}/poi/${poiId}/images`);
                    if (imagesResponse.ok) {
                        const imagesData = await imagesResponse.json();
                        const images = imagesData.images || [];
                        
                        if (images.length > 0) {
                            detailHtml += `
                                <div class="poi-detail-images mt-3">
                                    <h6 class="mb-3"><i class="fas fa-images text-warning"></i> Görseller (${images.length})</h6>
                                    <div class="row g-3">`;
                            
                            images.forEach((image, index) => {
                                const imagePath = image.thumbnail_path || image.path;
                                const fullImagePath = image.path;
                                detailHtml += `
                                    <div class="col-6">
                                        <div class="image-card-enhanced" style="position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                                            <img src="/${imagePath}" 
                                                 class="img-fluid" 
                                                 style="height: 120px; width: 100%; object-fit: cover; cursor: pointer; transition: transform 0.3s ease;" 
                                                 alt="${image.filename}"
                                                 onclick="showImageModal('/${fullImagePath}', '${poi.name}', '${image.filename}')"
                                                 onmouseover="this.style.transform='scale(1.05)'"
                                                 onmouseout="this.style.transform='scale(1)'">
                                            <div class="image-info-overlay" style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 8px 12px;">
                                                <small class="text-white fw-bold">${getImageTypeIcon(image.filename)} ${(image.size / 1024).toFixed(0)}KB</small>
                                            </div>
                                            <button class="image-delete-btn-enhanced btn btn-danger" 
                                                    style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; padding: 0; font-size: 0.9rem; z-index: 10; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220,53,69,0.4); transition: all 0.3s ease;"
                                                    onclick="deletePOIImageWithConfirm('${poi._id}', '${image.filename}', this)"
                                                    title="Görseli sil - ${image.filename}"
                                                    onmouseover="this.style.transform='scale(1.2)'; this.style.boxShadow='0 6px 16px rgba(220,53,69,0.6)'"
                                                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(220,53,69,0.4)'">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>`;
                            });
                            
                            detailHtml += `
                                    </div>
                                </div>`;
                        }
                    }
                } catch (imageError) {
                    console.log('Görseller yüklenemedi:', imageError);
                }


                detailHtml += `
                    <div class="poi-detail-actions">
                        <button class="btn btn-primary btn-sm" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})">
                            <i class="fas fa-crosshairs me-1"></i> Haritada Göster
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="switchToFormTab()">
                            <i class="fas fa-edit me-1"></i> Düzenle
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCurrentPOI()">
                            <i class="fas fa-trash me-1"></i> Sil
                        </button>
                    </div>`;

                document.getElementById('poiDetailContent').innerHTML = detailHtml;

                // Mevcut görselleri form bölümünde de yükle (eğer loadPOIImages fonksiyonu varsa)
                if (typeof loadPOIImages === 'function') {
                    await loadPOIImages(poiId);
                }

            } catch (error) {
                showToast('POI detayları yüklenirken hata oluştu', 'error');
            } finally {
                hideLoading();
            }
        }
        
        // Görsel silme fonksiyonu
        async function deletePOIImage(poiId, filename, imageCardElement) {
            if (!confirm(`'${filename}' adlı görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                return;
            }
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}/images/${filename}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Görsel silinemedi.');
                }

                showToast('Görsel başarıyla silindi', 'success');
                
                // Görsel kartını UI'dan kaldır
                if(imageCardElement) {
                    imageCardElement.remove();
                }
                
                // Eğer hiç görsel kalmadıysa, "Görseller" başlığını da kaldır
                const imageContainer = document.querySelector('.poi-detail-images .row');
                if (imageContainer && imageContainer.childElementCount === 0) {
                    document.querySelector('.poi-detail-images').remove();
                }

            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        }

        // Daha güvenli görsel silme fonksiyonu - event bubbling problemini çözer
        async function deletePOIImageWithConfirm(poiId, filename, buttonElement) {
            // Tüm event propagation'ları durdur
            if (window.event) {
                window.event.stopPropagation();
                window.event.preventDefault();
            }
            
            if (!confirm(`'${filename}' adlı görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                return false;
            }
            
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}/images/${filename}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Görsel silinemedi.');
                }

                showToast('Görsel başarıyla silindi', 'success');
                
                // Görsel kartının parent container'ını bul ve kaldır
                const imageCard = buttonElement.closest('.col-6');
                if (imageCard) {
                    imageCard.remove();
                }
                
                // Eğer hiç görsel kalmadıysa, "Görseller" başlığını da kaldır
                const imageContainer = document.querySelector('.poi-detail-images .row');
                if (imageContainer && imageContainer.childElementCount === 0) {
                    document.querySelector('.poi-detail-images').remove();
                }

            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
            
            return false; // Prevent any further event handling
        }

        // Birleşik panel için yardımcı fonksiyonlar
        function switchToFormTab() {
            const formTab = new bootstrap.Tab(document.getElementById('form-tab'));
            formTab.show();
        }

        function deleteCurrentPOI() {
            const poiId = document.getElementById('poiId').value;
            if (poiId) {
                deletePOI(poiId);
            }
        }
        """
        
        # CSS eklemeleri
        enhanced_css = """
        /* POI Detay Görselleri için CSS */
        .poi-detail-header {
            border-bottom: 1px solid #eee;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }

        .poi-detail-info {
            margin-bottom: 1rem;
        }

        .poi-detail-images .image-card {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            transition: transform 0.2s ease;
        }

        .poi-detail-images .image-card:hover {
            transform: scale(1.05);
        }

        .poi-detail-images .image-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.7));
            padding: 0.25rem;
            font-size: 0.75rem;
        }

        .poi-detail-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        /* Görsel silme butonu için gelişmiş stiller */
        .image-delete-btn {
            border-radius: 50% !important;
            transition: all 0.2s ease;
            background-color: #dc3545 !important;
            border: 2px solid white !important;
        }

        .image-delete-btn:hover {
            background-color: #c82333 !important;
            transform: scale(1.1);
            box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
        }

        .image-card {
            transition: transform 0.2s ease;
        }

        .image-card:hover {
            transform: scale(1.02);
        }

        .image-card:hover .image-delete-btn {
            opacity: 1;
        }

        .image-delete-btn {
            opacity: 0.8;
        }

        /* Enhanced POI Detail Styles */
        .poi-detail-images {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #e9ecef;
        }

        .image-card-enhanced {
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .image-card-enhanced:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.25) !important;
        }

        .image-delete-btn-enhanced {
            background: linear-gradient(135deg, #dc3545, #c82333) !important;
            border: 2px solid white !important;
            opacity: 0.9;
        }

        .image-delete-btn-enhanced:hover {
            background: linear-gradient(135deg, #c82333, #bd2130) !important;
            opacity: 1 !important;
        }

        .poi-detail-header {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 16px;
            border-radius: 12px;
            margin: -1rem -1rem 1rem -1rem;
        }

        .poi-detail-info {
            background: white;
            border-radius: 8px;
            padding: 12px;
            border-left: 4px solid #007bff;
            margin-bottom: 16px;
        }

        .poi-detail-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border-top: 1px solid #e9ecef;
        }

        .poi-detail-actions .btn {
            transition: all 0.2s ease;
        }

        .poi-detail-actions .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        /* Image Modal Improvements */
        .modal-content {
            border: none;
            border-radius: 16px;
            overflow: hidden;
        }

        .modal-header {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            border: none;
        }

        .modal-footer {
            border: none;
            background: #f8f9fa;
        }

        /* Toast Improvements */
        .toast {
            border-radius: 12px;
            border: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .toast-success {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
        }

        .toast-error {
            background: linear-gradient(135deg, #dc3545, #e74c3c);
            color: white;
        }

        .toast-info {
            background: linear-gradient(135deg, #17a2b8, #007bff);
            color: white;
        }
        """
        
        # CSS'i head bölümüne ekle
        html_content = html_content.replace('</style>', enhanced_css + '\n    </style>')
        
        # JavaScript'i script bölümünün başına ekle
        html_content = html_content.replace(
            '// Sayfa yüklendiğinde',
            enhanced_js + '\n\n        // Sayfa yüklendiğinde'
        )
        
        return html_content
        
    except FileNotFoundError:
        return '<h1>❌ Hata</h1><p>poi_manager_ui.html dosyası bulunamadı!</p><p>Dosyanın API ile aynı klasörde olduğundan emin olun.</p>', 404

@app.route('/api/pois', methods=['GET'])
def list_pois():
    # Arama parametrelerini al
    search_query = request.args.get('search', '').strip()
    category = request.args.get('category')
    
    if JSON_FALLBACK:
        test_data = load_test_data()
        
        # Sadece aktif POI'leri filtrele ve integer ID'ler ata
        filtered_data = {}
        for cat, pois in test_data.items():
            if isinstance(pois, list):
                active_pois = []
                for poi in pois:
                    if poi.get('isActive', True):
                        # String _id'yi integer ID'ye çevir
                        if '_id' in poi and isinstance(poi['_id'], str):
                            # String ID'yi hash'leyerek integer ID oluştur
                            poi['id'] = abs(hash(poi['_id'])) % (10**9)  # 9 haneli pozitif integer
                        active_pois.append(poi)
                if active_pois:  # Sadece aktif POI'si olan kategorileri ekle
                    filtered_data[cat] = active_pois
        
        # Arama filtresi uygula
        if search_query:
            search_results = {}
            print(f"🔍 JSON Arama terimi: '{search_query}' - Mode: JSON_FALLBACK")
            for cat, pois in filtered_data.items():
                matched_pois = []
                for poi in pois:
                    # POI adı, açıklama ve etiketlerde ara
                    search_fields = [
                        poi.get('name', ''),
                        poi.get('description', ''),
                        ', '.join(poi.get('tags', []))
                    ]

                    print(f"POI: {poi.get('name', '')}, Tags: {poi.get('tags', [])}")

                    # Herhangi bir alanda eşleşme var mı kontrol et
                    if any(fuzzy_search_match(search_query, field) for field in search_fields):
                        matched_pois.append(poi)

                if matched_pois:
                    search_results[cat] = matched_pois
            
            return jsonify(search_results)
        
        if category and category in filtered_data:
            return jsonify(filtered_data[category])
        return jsonify(filtered_data)
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        if search_query:
            # Veritabanında arama yap
            search_results = perform_database_search(db, search_query, category)
            db.disconnect()
            return jsonify(search_results)
        
        if category:
            # Yeni UI için uyumlu formatta aktif POI'leri getir
            pois = db.list_pois(category)
            db.disconnect()
            return jsonify(pois)
        
        # Tüm kategorilerdeki POI'leri döndür - dinamik kategori listesi
        try:
            with db.conn.cursor() as cur:
                cur.execute("SELECT DISTINCT category FROM pois WHERE is_active = true ORDER BY category")
                categories = [row[0] for row in cur.fetchall()]
            
            all_pois = {}
            for cat in categories:
                pois = db.list_pois(cat)
                if pois:  # Sadece POI'si olan kategorileri ekle
                    all_pois[cat] = pois
            db.disconnect()
            return jsonify(all_pois)
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Category fetch error: {str(e)}'}), 500
        
    except Exception as e:
        db.disconnect()
        return jsonify({'error': f'Search error: {str(e)}'}), 500

def perform_database_search(db, search_query, category_filter=None):
    """
    Veritabanında Türkçe karakter desteği ile POI arama
    """
    # PostgreSQL için Türkçe karakter destekli arama sorgusu
    base_query = """
        SELECT
            id as _id,
            name,
            category,
            ST_Y(location::geometry) as latitude,
            ST_X(location::geometry) as longitude,
            description,
            attributes
        FROM pois
        WHERE is_active = true
        AND (
            LOWER(TRANSLATE(name, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            OR LOWER(TRANSLATE(COALESCE(description, ''), 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            OR LOWER(TRANSLATE(COALESCE(jsonb_extract_path_text(attributes, 'tags'), ''), 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
        )
    """
    
    params = [f'%{search_query}%', f'%{search_query}%', f'%{search_query}%']
    
    if category_filter:
        base_query += " AND category = %s"
        params.append(category_filter)
    
    base_query += " ORDER BY name"
    
    with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(base_query, params)
        results = cur.fetchall()

    # Debug: Arama sonuçlarını göster
    print(f"🔍 Arama terimi: '{search_query}', Sonuç sayısı: {len(results)} - Mode: DATABASE")
    for i, row in enumerate(results):
        attributes = row.get('attributes')
        tags = None
        if attributes:
            if isinstance(attributes, dict):
                tags = attributes.get('tags', 'No tags key')
            else:
                tags = f'Attributes not dict: {type(attributes)} - {attributes}'
        else:
            tags = 'No attributes field'

        print(f"POI {i+1}: {row['name']}, Attributes: {attributes}, Tags: {tags}")

    # Sonuçları kategorilere göre grupla
    search_results = {}
    for row in results:
        category = row['category']
        if category not in search_results:
            search_results[category] = []

        # POI objesini dict'e çevir ve attributes içindeki tags'i çıkar
        poi_dict = dict(row)

        # Attributes içindeki tags'i ana seviyeye çıkar
        if poi_dict.get('attributes') and isinstance(poi_dict['attributes'], dict):
            if 'tags' in poi_dict['attributes']:
                poi_dict['tags'] = poi_dict['attributes']['tags']
            # Diğer attributes alanlarını da çıkarabiliriz
            poi_dict.update(poi_dict['attributes'])

        search_results[category].append(poi_dict)
    
    return search_results

@app.route('/api/search', methods=['GET'])
def search_pois():
    """
    Gelişmiş POI arama endpoint'i - Türkçe karakter desteği ile
    Parametreler:
    - q: Arama terimi
    - category: Kategori filtresi
    - limit: Maksimum sonuç sayısı (varsayılan: 50)
    """
    search_query = request.args.get('q', '').strip()
    category_filter = request.args.get('category')
    limit = int(request.args.get('limit', 50))
    
    if not search_query:
        return jsonify({'error': 'Arama terimi gerekli (q parametresi)'}), 400
    
    if len(search_query) < 2:
        return jsonify({'error': 'Arama terimi en az 2 karakter olmalı'}), 400
    
    try:
        if JSON_FALLBACK:
            # JSON fallback arama
            test_data = load_test_data()
            results = []
            
            for cat, pois in test_data.items():
                if category_filter and cat != category_filter:
                    continue
                    
                if isinstance(pois, list):
                    for poi in pois:
                        if not poi.get('isActive', True):
                            continue
                            
                        # Arama alanları
                        search_fields = [
                            poi.get('name', ''),
                            poi.get('description', ''),
                            ', '.join(poi.get('tags', [])),
                            cat  # Kategori adı da arama kapsamında
                        ]
                        
                        # Herhangi bir alanda eşleşme kontrolü
                        if any(fuzzy_search_match(search_query, field) for field in search_fields):
                            poi_result = dict(poi)
                            poi_result['relevance_score'] = calculate_relevance_score(search_query, poi)
                            results.append(poi_result)
            
            # Relevans skoruna göre sırala
            results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            # Limit uygula
            results = results[:limit]
            
            return jsonify({
                'query': search_query,
                'total_results': len(results),
                'results': results
            })
        
        else:
            # Veritabanı arama
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            try:
                results = perform_advanced_database_search(db, search_query, category_filter, limit)
                db.disconnect()
                
                return jsonify({
                    'query': search_query,
                    'total_results': len(results),
                    'results': results
                })
                
            finally:
                if db:
                    db.disconnect()
                    
    except Exception as e:
        return jsonify({'error': f'Arama hatası: {str(e)}'}), 500

def calculate_relevance_score(search_query, poi):
    """POI için relevans skoru hesapla"""
    score = 0
    norm_query = normalize_turkish_text(search_query)
    
    # İsim eşleşmesi (en yüksek puan)
    poi_name = normalize_turkish_text(poi.get('name', ''))
    if norm_query == poi_name:
        score += 100
    elif norm_query in poi_name:
        score += 80
    elif any(word in poi_name for word in norm_query.split()):
        score += 60
    
    # Açıklama eşleşmesi
    poi_desc = normalize_turkish_text(poi.get('description', ''))
    if norm_query in poi_desc:
        score += 40
    elif any(word in poi_desc for word in norm_query.split()):
        score += 20
    
    # Etiket eşleşmesi
    poi_tags = normalize_turkish_text(', '.join(poi.get('tags', [])))
    if norm_query in poi_tags:
        score += 30
    
    return score

def perform_advanced_database_search(db, search_query, category_filter=None, limit=50):
    """Gelişmiş veritabanı arama"""
    
    # PostgreSQL için gelişmiş arama sorgusu
    base_query = """
        SELECT 
            id as _id,
            name, 
            category, 
            ST_Y(location::geometry) as latitude, 
            ST_X(location::geometry) as longitude, 
            description,
            attributes,
            -- Relevans skoru hesaplama
            (
                CASE 
                    WHEN LOWER(TRANSLATE(name, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
                         = LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) THEN 100
                    WHEN LOWER(TRANSLATE(name, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
                         LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) THEN 80
                    ELSE 0
                END +
                CASE 
                    WHEN LOWER(TRANSLATE(COALESCE(description, ''), 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
                         LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) THEN 40
                    ELSE 0
                END
            ) as relevance_score
        FROM pois
        WHERE is_active = true
        AND (
            LOWER(TRANSLATE(name, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            OR LOWER(TRANSLATE(COALESCE(description, ''), 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
        )
    """
    
    # Parametreler: tam eşleşme, kısmi eşleşme, açıklama, name like, desc like
    params = [search_query, f'%{search_query}%', f'%{search_query}%', f'%{search_query}%', f'%{search_query}%']
    
    if category_filter:
        base_query += " AND category = %s"
        params.append(category_filter)
    
    base_query += " ORDER BY relevance_score DESC, name ASC"
    
    if limit:
        base_query += " LIMIT %s"
        params.append(limit)
    
    with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(base_query, params)
        results = cur.fetchall()
    
    return [dict(row) for row in results]

@app.route('/api/poi/<poi_id>', methods=['GET'])
def get_poi(poi_id):
    if JSON_FALLBACK:
        test_data = load_test_data()
        for category_pois in test_data.values():
            if isinstance(category_pois, list):
                for poi in category_pois:
                    if poi.get('_id') == poi_id and poi.get('isActive', True):
                        return jsonify(poi)
        return jsonify({'error': 'POI not found'}), 404
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    details = db.get_poi_details(poi_id)
    db.disconnect()
    if details:
        return jsonify(details)
    return jsonify({'error': 'POI not found'}), 404

@app.route('/api/poi', methods=['POST'])
@auth_middleware.require_auth
def add_poi():
    if JSON_FALLBACK:
        try:
            poi_data = request.json
            
            # Yeni POI için ID oluştur
            new_id = str(uuid.uuid4())
            
            # Yeni POI objesi oluştur
            new_poi = {
                '_id': new_id,
                'name': poi_data.get('name', ''),
                'category': poi_data.get('category', ''),
                'latitude': float(poi_data.get('latitude', 0)),
                'longitude': float(poi_data.get('longitude', 0)),
                'description': poi_data.get('description', ''),
                'tags': poi_data.get('tags', []),
                'isActive': True,
                'createdAt': datetime.now().isoformat()
            }
            
            # Mevcut verileri yükle
            test_data = load_test_data()
            
            # Kategori yoksa oluştur
            if new_poi['category'] not in test_data:
                test_data[new_poi['category']] = []
            
            # POI'yi ekle
            test_data[new_poi['category']].append(new_poi)
            
            # JSON dosyasına kaydet
            if save_test_data(test_data):
                return jsonify({'id': new_id}), 201
            else:
                return jsonify({'error': 'Failed to save POI'}), 500
                
        except Exception as e:
            return jsonify({'error': f'Error adding POI: {str(e)}'}), 500
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    poi_data = request.json
    poi_id = db.add_poi(poi_data)
    db.disconnect()
    return jsonify({'id': poi_id}), 201

@app.route('/api/poi/<poi_id>', methods=['PUT'])
@auth_middleware.require_auth
def update_poi(poi_id):
    if JSON_FALLBACK:
        try:
            update_data = request.json
            test_data = load_test_data()
            
            # POI'yi bul ve güncelle
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for i, poi in enumerate(pois):
                        if poi.get('_id') == poi_id:
                            # Güncelleme verilerini uygula
                            for key, value in update_data.items():
                                if key != '_id':  # ID değiştirilmemeli
                                    pois[i][key] = value
                            
                            pois[i]['updatedAt'] = datetime.now().isoformat()
                            
                            # Kategori değiştiyse POI'yi taşı
                            if 'category' in update_data and update_data['category'] != category:
                                new_category = update_data['category']
                                if new_category not in test_data:
                                    test_data[new_category] = []
                                
                                # POI'yi yeni kategoriye taşı
                                updated_poi = pois.pop(i)
                                test_data[new_category].append(updated_poi)
                            
                            if save_test_data(test_data):
                                return jsonify({'success': True})
                            else:
                                return jsonify({'error': 'Failed to save changes'}), 500
            
            return jsonify({'error': 'POI not found'}), 404
            
        except Exception as e:
            return jsonify({'error': f'Error updating POI: {str(e)}'}), 500
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    if poi_id == 'undefined' or poi_id is None:
        return jsonify({'error': 'Invalid POI ID'}), 400
    
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    update_data = request.json
    result = db.update_poi(poi_id, update_data)
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Update failed'}), 400

@app.route('/api/poi/<poi_id>', methods=['DELETE'])
@auth_middleware.require_auth
def delete_poi(poi_id):
    if JSON_FALLBACK:
        try:
            test_data = load_test_data()
            
            # POI'yi bul ve sil (soft delete)
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for poi in pois:
                        if poi.get('_id') == poi_id:
                            poi['isActive'] = False
                            poi['deletedAt'] = datetime.now().isoformat()
                            
                            if save_test_data(test_data):
                                return jsonify({'success': True})
                            else:
                                return jsonify({'error': 'Failed to save changes'}), 500
            
            return jsonify({'error': 'POI not found'}), 404
            
        except Exception as e:
            return jsonify({'error': f'Error deleting POI: {str(e)}'}), 500
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    # Silme için isActive = False yapıyoruz (soft delete)
    result = db.update_poi(poi_id, {'isActive': False})
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Delete failed'}), 400

# Rating sistemi endpoint'leri
@app.route('/api/poi/<poi_id>/ratings', methods=['GET'])
@auth_middleware.require_auth
def get_poi_ratings(poi_id):
    """POI'nin rating'lerini getir"""
    if JSON_FALLBACK:
        return jsonify({'error': 'Rating sistemi sadece veritabanı modunda çalışır'}), 400
    
    try:
        poi_id_int = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        poi_details = db.get_poi_details(poi_id_int)
        if not poi_details:
            return jsonify({'error': 'POI not found'}), 404
        
        ratings = poi_details.get('ratings', db.get_default_ratings())
        return jsonify({
            'poi_id': poi_id_int,
            'poi_name': poi_details.get('name', ''),
            'ratings': ratings,
            'rating_categories': RATING_CATEGORIES
        })
        
    except Exception as e:
        return jsonify({'error': f'Error fetching ratings: {str(e)}'}), 500
    finally:
        db.disconnect()

@app.route('/api/poi/<poi_id>/ratings', methods=['PUT'])
@auth_middleware.require_auth
def update_poi_ratings(poi_id):
    """POI rating'lerini güncelle"""
    if JSON_FALLBACK:
        return jsonify({'error': 'Rating sistemi sadece veritabanı modunda çalışır'}), 400
    
    try:
        poi_id_int = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    ratings_data = request.json
    if not ratings_data or 'ratings' not in ratings_data:
        return jsonify({'error': 'Ratings data required'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        # POI'nin var olup olmadığını kontrol et
        poi_details = db.get_poi_details(poi_id_int)
        if not poi_details:
            return jsonify({'error': 'POI not found'}), 404
        
        # Rating'leri güncelle
        result = db.update_poi(poi_id_int, {'ratings': ratings_data['ratings']})
        
        if result:
            # Güncellenmiş rating'leri geri döndür
            updated_poi = db.get_poi_details(poi_id_int)
            return jsonify({
                'success': True,
                'poi_id': poi_id_int,
                'ratings': updated_poi.get('ratings', {}),
                'message': 'Rating\'ler başarıyla güncellendi'
            })
        else:
            return jsonify({'error': 'Failed to update ratings'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Error updating ratings: {str(e)}'}), 500
    finally:
        db.disconnect()

@app.route('/api/ratings/categories', methods=['GET'])
def get_rating_categories():
    """Rating kategorilerini getir"""
    return jsonify({
        'categories': RATING_CATEGORIES,
        'description': 'POI rating kategorileri ve bilgileri'
    })

@app.route('/api/categories', methods=['GET', 'POST', 'PUT', 'DELETE'])
@auth_middleware.require_auth
def manage_categories():
    """Kategori yönetimi - GET, POST, PUT, DELETE"""
    
    if request.method == 'GET':
        # Kategorileri getir
        if JSON_FALLBACK:
            categories = [
                {"name": "gastronomik", "display_name": "🍽️ Gastronomik", "color": "#e74c3c", "icon": "utensils"},
                {"name": "kulturel", "display_name": "🏛️ Kültürel", "color": "#3498db", "icon": "landmark"},
                {"name": "sanatsal", "display_name": "🎨 Sanatsal", "color": "#2ecc71", "icon": "palette"},
                {"name": "doga_macera", "display_name": "🌿 Doğa & Macera", "color": "#f39c12", "icon": "hiking"},
                {"name": "konaklama", "display_name": "🏨 Konaklama", "color": "#9b59b6", "icon": "bed"}
            ]
            return jsonify(categories)
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT name, display_name, color, icon, description FROM categories ORDER BY name")
                categories = [dict(row) for row in cur.fetchall()]
            
            db.disconnect()
            return jsonify(categories)
            
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Categories fetch error: {str(e)}'}), 500
    
    elif request.method == 'POST':
        # Yeni kategori ekle
        if JSON_FALLBACK:
            return jsonify({'error': 'JSON mode does not support category management'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['name', 'display_name', 'color', 'icon']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            with db.conn.cursor() as cur:
                # Kategori adının benzersiz olduğunu kontrol et
                cur.execute("SELECT COUNT(*) FROM categories WHERE name = %s", (data['name'],))
                if cur.fetchone()[0] > 0:
                    db.disconnect()
                    return jsonify({'error': 'Category name already exists'}), 409
                
                # Yeni kategoriyi ekle
                cur.execute("""
                    INSERT INTO categories (name, display_name, color, icon, description)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    data['name'],
                    data['display_name'],
                    data['color'],
                    data['icon'],
                    data.get('description', '')
                ))
                db.conn.commit()
            
            db.disconnect()
            return jsonify({'success': True, 'message': 'Category added successfully'}), 201
            
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Category add error: {str(e)}'}), 500
    
    elif request.method == 'PUT':
        # Kategori güncelle
        if JSON_FALLBACK:
            return jsonify({'error': 'JSON mode does not support category management'}), 400
        
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            with db.conn.cursor() as cur:
                # Kategori var mı kontrol et
                cur.execute("SELECT COUNT(*) FROM categories WHERE name = %s", (data['name'],))
                if cur.fetchone()[0] == 0:
                    db.disconnect()
                    return jsonify({'error': 'Category not found'}), 404
                
                # Güncelleme alanlarını hazırla
                update_fields = []
                update_values = []
                
                for field in ['display_name', 'color', 'icon', 'description']:
                    if field in data:
                        update_fields.append(f"{field} = %s")
                        update_values.append(data[field])
                
                if not update_fields:
                    db.disconnect()
                    return jsonify({'error': 'No fields to update'}), 400
                
                update_values.append(data['name'])
                
                # Kategoriyi güncelle
                cur.execute(f"""
                    UPDATE categories 
                    SET {', '.join(update_fields)}
                    WHERE name = %s
                """, update_values)
                db.conn.commit()
            
            db.disconnect()
            return jsonify({'success': True, 'message': 'Category updated successfully'})
            
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Category update error: {str(e)}'}), 500
    
    elif request.method == 'DELETE':
        # Kategori sil
        if JSON_FALLBACK:
            return jsonify({'error': 'JSON mode does not support category management'}), 400
        
        category_name = request.args.get('name')
        if not category_name:
            return jsonify({'error': 'Category name is required'}), 400
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            with db.conn.cursor() as cur:
                # Bu kategoride POI var mı kontrol et
                cur.execute("SELECT COUNT(*) FROM pois WHERE category = %s", (category_name,))
                poi_count = cur.fetchone()[0]
                
                if poi_count > 0:
                    db.disconnect()
                    return jsonify({
                        'error': f'Cannot delete category. {poi_count} POIs are using this category.'
                    }), 409
                
                # Kategoriyi sil
                cur.execute("DELETE FROM categories WHERE name = %s", (category_name,))
                if cur.rowcount == 0:
                    db.disconnect()
                    return jsonify({'error': 'Category not found'}), 404
                
                db.conn.commit()
            
            db.disconnect()
            return jsonify({'success': True, 'message': 'Category deleted successfully'})
            
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Category delete error: {str(e)}'}), 500

@app.route('/api/pois/by-rating', methods=['GET'])
def search_pois_by_rating():
    """Rating'e göre POI arama"""
    if JSON_FALLBACK:
        return jsonify({'error': 'Rating arama sadece veritabanı modunda çalışır'}), 400
    
    category = request.args.get('category')  # Rating kategorisi (tarihi, doga, vb.)
    min_score = request.args.get('min_score', 0, type=int)  # Minimum puan
    limit = request.args.get('limit', 20, type=int)
    
    if not category or category not in RATING_CATEGORIES:
        return jsonify({
            'error': 'Valid rating category required',
            'valid_categories': list(RATING_CATEGORIES.keys())
        }), 400
    
    if min_score < 0 or min_score > 100:
        return jsonify({'error': 'min_score must be between 0-100'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        # Rating tablosu sorgusu
        query = """
            SELECT
                p.id as _id,
                p.name,
                p.category,
                ST_Y(p.location::geometry) as latitude,
                ST_X(p.location::geometry) as longitude,
                p.description,
                COALESCE(pr.rating, 0) as rating_score
            FROM pois p
            LEFT JOIN poi_ratings pr ON pr.poi_id = p.id AND pr.category = %s
            WHERE p.is_active = true AND COALESCE(pr.rating, 0) >= %s
            ORDER BY rating_score DESC, p.name ASC
            LIMIT %s
        """

        with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (category, min_score, limit))
            results = cur.fetchall()
        
        # Sonuçları formatla
        formatted_results = []
        for row in results:
            poi_data = dict(row)
            # Tüm rating'leri ekle
            poi_data['ratings'] = db.get_poi_ratings(poi_data['_id']) or db.get_default_ratings()
                
            formatted_results.append(poi_data)
        
        return jsonify({
            'category': category,
            'category_info': RATING_CATEGORIES[category],
            'min_score': min_score,
            'total_results': len(formatted_results),
            'results': formatted_results
        })
        
    except Exception as e:
        return jsonify({'error': f'Error searching by rating: {str(e)}'}), 500
    finally:
        db.disconnect()

# Medya yönetimi endpoint'leri (görsel, video, ses, 3D model)
@app.route('/api/poi/<poi_id>/media', methods=['POST'])
@auth_middleware.require_auth
def upload_poi_media(poi_id):
    """POI'ye medya dosyası yükle (görsel, video, ses, 3D model)"""
    if 'media' not in request.files:
        return jsonify({'error': 'No media file provided'}), 400
    
    file = request.files['media']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        supported_formats = []
        for media_type, config in media_manager.SUPPORTED_FORMATS.items():
            supported_formats.extend(config['extensions'])
        return jsonify({'error': f'Invalid file type. Supported formats: {", ".join(supported_formats)}'}), 400
    
    # Medya türünü tespit et
    media_type = media_manager.detect_media_type(file.filename)
    if not media_type:
        return jsonify({'error': 'Unsupported media type'}), 400
    
    # Dosya boyutu kontrolü - medya türüne göre
    max_size = media_manager.SUPPORTED_FORMATS[media_type]['max_size']
    max_size_mb = max_size / (1024 * 1024)
    
    if file.content_length and file.content_length > max_size:
        return jsonify({'error': f'Dosya boyutu {max_size_mb:.0f}MB\'dan küçük olmalıdır.'}), 400
    
    try:
        # POI bilgilerini al
        if JSON_FALLBACK:
            test_data = load_test_data()
            poi = None
            poi_category = None
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for p in pois:
                        if p.get('_id') == poi_id:
                            poi = p
                            poi_category = category
                            break
            if not poi:
                return jsonify({'error': 'POI not found'}), 404
            poi_name = poi['name']
        else:
            try:
                poi_id_int = int(poi_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid POI ID format'}), 400
            
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            poi_details = db.get_poi_details(poi_id_int)
            db.disconnect()
            
            if not poi_details:
                return jsonify({'error': 'POI not found'}), 404
            
            poi_name = poi_details['name']
            poi_category = poi_details['category']
        
        # Geçici dosya kaydet
        filename = secure_filename(file.filename)
        temp_path = f"/tmp/{uuid.uuid4()}_{filename}"
        file.save(temp_path)
        
        # Form verilerini al
        caption = request.form.get('caption', '')
        is_primary = request.form.get('is_primary', 'false').lower() == 'true'
        
        # Medya dosyasını işle ve kaydet - POI ID bazlı klasör yapısı
        result = media_manager.add_poi_media(
            poi_id=poi_id,
            poi_name=poi_name,
            category=poi_category,
            media_file_path=temp_path,
            media_type=media_type,
            caption=caption,
            is_primary=is_primary
        )
        
        # Geçici dosyayı sil
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        if result:
            return jsonify({
                'success': True,
                'media': result
            }), 201
        else:
            return jsonify({'error': 'Failed to process media file'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Error uploading media: {str(e)}'}), 500

@app.route('/api/poi/<poi_id>/media', methods=['GET'])
def get_poi_media(poi_id):
    """POI'nin tüm medya dosyalarını listele"""
    try:
        if JSON_FALLBACK:
            test_data = load_test_data()
            poi = None
            poi_category = None
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for p in pois:
                        if p.get('_id') == poi_id:
                            poi = p
                            poi_category = category
                            break
            if not poi:
                return jsonify({'error': 'POI not found'}), 404
            poi_name = poi['name']
        else:
            try:
                poi_id_int = int(poi_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid POI ID format'}), 400
            
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            poi_details = db.get_poi_details(poi_id_int)
            db.disconnect()
            
            if not poi_details:
                return jsonify({'error': 'POI not found'}), 404
            
            poi_name = poi_details['name']
            poi_category = poi_details['category']
        
        # Medya türünü filtrele (opsiyonel)
        media_type = request.args.get('type')
        
        # Medya dosyalarını getir - POI ID bazlı sistem
        media_files = media_manager.get_poi_media_by_id(poi_id, media_type)
        return jsonify({'media': media_files})
        
    except Exception as e:
        return jsonify({'error': f'Error fetching media: {str(e)}'}), 500

@app.route('/api/poi/<poi_id>/media/<filename>', methods=['DELETE'])
@auth_middleware.require_auth
def delete_poi_media(poi_id, filename):
    """POI'nin belirli bir medya dosyasını sil"""
    try:
        # Dosya adının güvenli olduğundan emin ol
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Invalid filename'}), 400

        # Medya dosyasını sil
        success = media_manager.delete_poi_media_by_id(poi_id, filename)

        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': True, 'message': 'Media file not found or already deleted'}), 200

    except Exception as e:
        return jsonify({'error': f'Error deleting media: {str(e)}'}), 500

# Geriye uyumluluk için eski image endpoint'leri
@app.route('/api/poi/<poi_id>/images', methods=['POST'])
@auth_middleware.require_auth
def upload_poi_image_legacy(poi_id):
    """Geriye uyumluluk için eski görsel yükleme endpoint'i"""
    # Sadece media endpoint'ine yönlendir
    return upload_poi_media(poi_id)

@app.route('/api/poi/<poi_id>/images', methods=['GET'])
def get_poi_images_legacy(poi_id):
    """Geriye uyumluluk için eski görsel listeleme endpoint'i"""
    try:
        # Sadece görsel türündeki medyaları getir
        request.args = request.args.copy()
        request.args['type'] = 'image'
        
        response_data = get_poi_media(poi_id)
        if isinstance(response_data, tuple):
            data, status_code = response_data
        else:
            data = response_data
            status_code = 200
            
        # Response formatını eski API ile uyumlu hale getir
        if hasattr(data, 'get_json'):
            json_data = data.get_json()
        else:
            json_data = data
            
        if 'media' in json_data:
            json_data['images'] = json_data.pop('media')
            
        return jsonify(json_data), status_code
        
    except Exception as e:
        return jsonify({'error': f'Error fetching images: {str(e)}'}), 500

@app.route('/api/poi/<poi_id>/images/<filename>', methods=['DELETE'])
@auth_middleware.require_auth
def delete_poi_image_legacy(poi_id, filename):
    """Geriye uyumluluk için eski görsel silme endpoint'i"""
    return delete_poi_media(poi_id, filename)

# Bağımsız 360° panorama endpoint'leri
@app.route('/api/panoramas', methods=['POST'])
@auth_middleware.require_auth
def upload_panorama():
    """POI'den bağımsız 360° görsel yükle, EXIF'ten konumu al ve sakla"""
    try:
        if 'media' not in request.files:
            return jsonify({'error': 'No media file provided'}), 400
        file = request.files['media']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400

        # Geçici dosya oluştur ve kaydet
        filename = secure_filename(file.filename)
        temp_path = f"/tmp/{uuid.uuid4()}_{filename}"
        file.save(temp_path)

        # Boyut ve tür doğrulaması (daha anlamlı hata kodu için)
        is_valid, message, detected_type = media_manager.validate_file(temp_path, 'image')
        if not is_valid:
            # Geçici dosyayı temizle
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            finally:
                pass
            return jsonify({'error': message}), 400

        caption = request.form.get('caption', '')
        try:
            result = media_manager.add_panorama_image(temp_path, caption)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        if not result:
            return jsonify({'error': 'Failed to process panorama'}), 500
        return jsonify({'success': True, 'panorama': result}), 201
    except Exception as e:
        return jsonify({'error': f'Error uploading panorama: {str(e)}'}), 500


@app.route('/api/panoramas', methods=['GET'])
def list_panoramas():
    """Tüm bağımsız 360° panoramaları listele"""
    try:
        items = media_manager.get_all_panoramas()
        return jsonify({'panoramas': items})
    except Exception as e:
        return jsonify({'error': f'Error fetching panoramas: {str(e)}'}), 500

@app.route('/api/route-panoramas', methods=['GET'])
def list_route_panoramas():
    """Rotalara ait, konumu belirlenmiş görüntü medyalarını listele (360 filtreleme istemci tarafında yapılır)."""
    try:
        conn = get_db_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Sadece konumu olan görselleri getir (video/ses hariç)
        cur.execute(
            """
            SELECT route_id, file_path, thumbnail_path, caption, lat, lng, media_type, uploaded_at
            FROM route_media
            WHERE lat IS NOT NULL
              AND lng IS NOT NULL
              AND (media_type IS NULL OR media_type IN ('image','photo'))
            ORDER BY uploaded_at DESC NULLS LAST
            """
        )

        rows = cur.fetchall() or []
        results = []
        for row in rows:
            raw_path = row.get('file_path') or ''
            rel_path = None
            if isinstance(raw_path, str):
                if raw_path.startswith('/'):
                    # absolute path olabilir; 'poi_media/' segmentini bulup oradan itibaren kırp
                    idx = raw_path.find('poi_media/')
                    if idx != -1:
                        rel_path = raw_path[idx:]
                    else:
                        rel_path = raw_path.lstrip('/')
                else:
                    rel_path = raw_path
            else:
                rel_path = ''

            filename = None
            try:
                filename = rel_path.split('/')[-1] if rel_path else None
            except Exception:
                filename = None

            # Nihai çıktı (istemci 360 tespitini yapacak)
            results.append({
                'route_id': row.get('route_id'),
                'path': rel_path,
                'caption': row.get('caption') or '',
                'lat': float(row['lat']) if row.get('lat') is not None else None,
                'lng': float(row['lng']) if row.get('lng') is not None else None,
                'filename': filename,
                'media_type': (row.get('media_type') or 'image')
            })

        cur.close()
        conn.close()
        return jsonify({'panoramas': results})
    except Exception as e:
        logger.error(f"Error fetching route panoramas: {e}")
        try:
            if cur:
                cur.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass
        return jsonify({'error': f'Error fetching route panoramas: {str(e)}'}), 500


@app.route('/api/panoramas/<pano_id>', methods=['DELETE'])
@auth_middleware.require_auth
def delete_panorama(pano_id):
    """Bağımsız panorama sil"""
    try:
        if not pano_id or len(pano_id) < 6:
            return jsonify({'error': 'Invalid panorama id'}), 400
        success = media_manager.delete_panorama_by_id(pano_id)
        if success:
            return jsonify({'success': True})
        return jsonify({'success': True, 'message': 'Panorama not found or already deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Error deleting panorama: {str(e)}'}), 500

# Medya dosyalarını serve etme endpoint'leri
@app.route('/poi_media/<path:filename>')
def serve_poi_media(filename):
    """POI medya dosyalarını serve et"""
    try:
        return send_from_directory('poi_media', filename)
    except FileNotFoundError:
        return jsonify({'error': 'Media file not found'}), 404

@app.route('/poi_images/<path:filename>')
def serve_poi_image(filename):
    """Geriye uyumluluk için POI görsellerini serve et"""
    try:
        # Önce eski klasörde ara
        if os.path.exists(os.path.join('poi_images', filename)):
            return send_from_directory('poi_images', filename)
        # Yoksa yeni medya klasöründe ara
        else:
            return send_from_directory('poi_media', filename)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404

# Statik HTML dosyalarını serve et
@app.route('/<filename>')
def serve_static_html(filename):
    """Statik HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html') or filename == 'poi_manager_ui.html':
            return jsonify({'error': 'File not found'}), 404
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return jsonify({'error': f'Error serving file: {str(e)}'}), 500

# Maps klasörü altındaki HTML dosyalarını serve et
@app.route('/maps/<filename>')
def serve_maps_html(filename):
    """Maps klasörü altındaki HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html'):
            return jsonify({'error': 'File not found'}), 404
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return jsonify({'error': f'Error serving file: {str(e)}'}), 500

@app.route('/maps')
def list_maps():
    """Mevcut harita dosyalarını listele"""
    try:
        import glob
        html_files = glob.glob('*.html')
        # poi_manager_ui.html'i hariç tut
        map_files = [f for f in html_files if f != 'poi_manager_ui.html']
        
        maps_html = """
        <h1>🗺️ Mevcut Harita Dosyaları</h1>
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        """
        
        if not map_files:
            maps_html += """
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                <h3>📭 Henüz harita dosyası bulunamadı</h3>
                <p>Harita oluşturmak için:</p>
                <code style="background: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; margin: 10px;">
                    python category_route_planner_with_db.py gastronomik
                </code>
            </div>
            """
        else:
            for map_file in sorted(map_files):
                file_size = os.path.getsize(map_file) / 1024  # KB
                maps_html += f"""
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 15px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">
                        <i class="fa fa-map" style="margin-right: 8px; color: #3498db;"></i>
                        {map_file}
                    </h3>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">
                        <i class="fa fa-file" style="margin-right: 5px;"></i>
                        Boyut: {file_size:.1f} KB
                    </p>
                    <div style="margin-top: 15px;">
                        <a href="/maps/{map_file}" target="_blank" 
                           style="background: #3498db; color: white; padding: 10px 20px; border-radius: 5px; 
                                  text-decoration: none; margin-right: 10px; display: inline-block;">
                            <i class="fa fa-external-link-alt" style="margin-right: 5px;"></i>
                            Haritayı Aç
                        </a>
                        <a href="/download/{map_file}" 
                           style="background: #27ae60; color: white; padding: 10px 20px; border-radius: 5px; 
                                  text-decoration: none; display: inline-block;">
                            <i class="fa fa-download" style="margin-right: 5px;"></i>
                            İndir
                        </a>
                    </div>
                </div>
                """
        
        maps_html += """
        </div>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        """
        
        return maps_html
        
    except Exception as e:
        return f'<h1>Hata</h1><p>Harita dosyaları listelenemedi: {str(e)}</p>', 500

@app.route('/maps/<filename>')
def serve_map(filename):
    """Harita HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'Map file not found'}), 404
        
        return send_from_directory('.', filename)
        
    except Exception as e:
        return jsonify({'error': f'Error serving map: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_map(filename):
    """Harita dosyalarını indirme"""
    try:
        # Güvenlik kontrolü
        if not filename.endswith('.html'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
        
        return send_from_directory('.', filename, as_attachment=True)
        
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500

# ===== ROTA YÖNETİMİ ENDPOINT'LERİ =====

# RouteService instance'ı oluştur (removed duplicate)

@app.route('/api/admin/routes', methods=['GET'])
@auth_middleware.require_auth
def get_all_routes():
    """Tüm rotaları getir (admin)"""
    try:
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        routes = route_service.get_all_active_routes()
        route_service.disconnect()
        
        return jsonify(routes)
        
    except Exception as e:
        print(f"❌ Route listing error: {e}")
        return jsonify({'error': f'Failed to fetch routes: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>', methods=['GET'])
@auth_middleware.require_auth
def admin_get_route_details(route_id):
    """Rota detaylarını getir (admin)"""
    try:
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        route = route_service.get_route_by_id(route_id)
        route_service.disconnect()
        
        if route:
            return jsonify(route)
        else:
            return jsonify({'error': 'Route not found'}), 404
            
    except Exception as e:
        print(f"❌ Route details error: {e}")
        return jsonify({'error': f'Failed to fetch route details: {str(e)}'}), 500

@app.route('/api/admin/routes', methods=['POST'])
@auth_middleware.require_auth
# @admin_rate_limit(max_requests=20, window_seconds=60)  # Geliştirme için devre dışı
def admin_create_route():
    """Yeni rota oluştur (admin)"""
    try:
        data = request.get_json()
        
        # Gerekli alanları kontrol et
        required_fields = ['name', 'route_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400

        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500

        existing_route = route_service.get_route_by_name(data['name'])
        if existing_route:
            success = route_service.update_route(existing_route['id'], data)
            route_service.disconnect()
            if success:
                return jsonify({'id': existing_route['id'], 'message': 'Route updated successfully'}), 200
            else:
                return jsonify({'error': 'Failed to update route'}), 500

        route_id = route_service.create_route(data)
        route_service.disconnect()

        if route_id:
            return jsonify({'id': route_id, 'message': 'Route created successfully'}), 201
        else:
            return jsonify({'error': 'Failed to create route'}), 500
            
    except Exception as e:
        print(f"❌ Route creation error: {e}")
        return jsonify({'error': f'Failed to create route: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>', methods=['PUT'])
@auth_middleware.require_auth
# @admin_rate_limit(max_requests=30, window_seconds=60)  # Geliştirme için devre dışı
def admin_update_route(route_id):
    """Rotayı güncelle (admin)"""
    try:
        data = request.get_json()
        
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        success = route_service.update_route(route_id, data)
        route_service.disconnect()
        
        if success:
            return jsonify({'message': 'Route updated successfully'})
        else:
            return jsonify({'error': 'Failed to update route or route not found'}), 404
            
    except Exception as e:
        print(f"❌ Route update error: {e}")
        return jsonify({'error': f'Failed to update route: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>', methods=['DELETE'])
@auth_middleware.require_auth
# Rate limiting removed for testing
# @admin_rate_limit(max_requests=10, window_seconds=60)
def admin_delete_route(route_id):
    """Rotayı sil (admin)"""
    try:
        logger.info(f"🗑️ Delete route request for ID: {route_id}")
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        success = route_service.delete_route(route_id)
        route_service.disconnect()
        
        if success:
            logger.info(f"✅ Route {route_id} deleted successfully")
            return jsonify({'message': 'Route deleted successfully'})
        else:
            logger.warning(f"❌ Route {route_id} not found or already deleted")
            return jsonify({'error': 'Failed to delete route or route not found'}), 404
            
    except Exception as e:
        print(f"❌ Route deletion error: {e}")
        return jsonify({'error': f'Failed to delete route: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>/pois', methods=['GET'])
@auth_middleware.require_auth
def admin_get_route_pois(route_id):
    """Rotaya ait POI'leri getir (admin)"""
    try:
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        pois = route_service.get_route_pois(route_id)
        route_service.disconnect()
        
        return jsonify(pois)
        
    except Exception as e:
        print(f"❌ Route POIs error: {e}")
        return jsonify({'error': f'Failed to fetch route POIs: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>/pois', methods=['POST'])
@auth_middleware.require_auth
def admin_associate_route_pois(route_id):
    """Rotaya POI'leri ilişkilendir (admin)"""
    try:
        data = request.get_json()
        
        # CSRF token kontrolü
        csrf_token = data.get('csrf_token', '')
        if not auth_middleware.validate_csrf_token(csrf_token):
            logger.warning(f"Invalid CSRF token for route POI association: {csrf_token}")
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        poi_associations = data.get('pois', [])

        if not isinstance(poi_associations, list):
            return jsonify({'error': 'POIs must be a list'}), 400

        geometry_segments = data.get('geometry')
        total_distance = data.get('total_distance', 0)
        estimated_time = data.get('estimated_time', 0)
        waypoints = data.get('waypoints', [])

        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500

        success = route_service.associate_pois(
            route_id,
            poi_associations,
            geometry_segments=geometry_segments,
            total_distance=total_distance,
            estimated_time=estimated_time,
            waypoints=waypoints,
        )
        route_service.disconnect()

        if success:
            return jsonify({'message': 'POI associations updated successfully'})
        else:
            return jsonify({'error': 'Failed to update POI associations'}), 500
            
    except Exception as e:
        print(f"❌ Route POI association error: {e}")
        return jsonify({'error': f'Failed to associate POIs: {str(e)}'}), 500

@app.route('/api/admin/routes/<int:route_id>/geometry', methods=['POST'])
@auth_middleware.require_auth
def save_route_geometry(route_id):
    """Rota geometrisini kaydet"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Geometry data is required'}), 400
        
        # Extract geometry data
        geometry_segments = data.get('geometry', [])
        total_distance = data.get('total_distance', 0)
        estimated_time = data.get('estimated_time', 0)
        waypoints = data.get('waypoints', [])
        
        service = get_route_service()
        
        # Save geometry to database
        success = service.save_route_geometry(
            route_id, 
            geometry_segments, 
            total_distance, 
            estimated_time, 
            waypoints
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Route geometry saved for route {route_id}'
            })
        else:
            return jsonify({'error': 'Failed to save route geometry'}), 500
            
    except Exception as e:
        logger.error(f"Error saving route geometry for route {route_id}: {str(e)}")
        return jsonify({'error': f'Failed to save route geometry: {str(e)}'}), 500

@app.route('/api/admin/routes/search', methods=['GET'])
@auth_middleware.require_auth
def admin_search_routes():
    """Rota arama (admin)"""
    try:
        search_term = request.args.get('q', '').strip()
        
        if not search_term:
            return jsonify({'error': 'Search term is required'}), 400
        
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        routes = route_service.search_routes(search_term)
        route_service.disconnect()
        
        return jsonify(routes)
        
    except Exception as e:
        print(f"❌ Route search error: {e}")
        return jsonify({'error': f'Failed to search routes: {str(e)}'}), 500

@app.route('/api/admin/routes/filter', methods=['POST'])
@auth_middleware.require_auth
def admin_filter_routes():
    """Rota filtreleme (admin)"""
    try:
        filters = request.get_json() or {}
        
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        routes = route_service.filter_routes(filters)
        route_service.disconnect()
        
        return jsonify(routes)
        
    except Exception as e:
        print(f"❌ Route filtering error: {e}")
        return jsonify({'error': f'Failed to filter routes: {str(e)}'}), 500

@app.route('/api/admin/routes/statistics', methods=['GET'])
@auth_middleware.require_auth
def admin_get_route_statistics():
    """Rota istatistiklerini getir (admin)"""
    try:
        if not route_service.connect():
            return jsonify({'error': 'Database connection failed'}), 500
        
        stats = route_service.get_route_statistics()
        route_service.disconnect()
        
        return jsonify(stats)
        
    except Exception as e:
        print(f"❌ Route statistics error: {e}")
        return jsonify({'error': f'Failed to fetch route statistics: {str(e)}'}), 500

# Sistem yönetimi endpoint'leri
@app.route('/api/system/cleanup-media-folders', methods=['POST'])
@auth_middleware.require_auth
def cleanup_media_folders():
    """Kullanılmayan medya klasörlerini temizle"""
    try:
        cleaned_folders = media_manager.cleanup_unused_directories()
        
        return jsonify({
            'success': True,
            'message': f'{len(cleaned_folders)} adet kullanılmayan klasör temizlendi',
            'cleaned_folders': cleaned_folders
        })
        
    except Exception as e:
        return jsonify({'error': f'Temizleme hatası: {str(e)}'}), 500

@app.route('/api/system/media-info', methods=['GET'])
@auth_middleware.require_auth
def get_media_system_info():
    """Medya sistemi hakkında bilgi ver"""
    try:
        base_path = media_manager.base_path
        info = {
            'media_structure': 'POI ID bazlı sistem kullanılıyor',
            'base_path': str(base_path),
            'supported_formats': media_manager.SUPPORTED_FORMATS,
            'directories': {
                'main': str(base_path / "by_poi_id"),
                'thumbnails': str(media_manager.thumbnails_path / "by_poi_id"),
                'previews': str(media_manager.previews_path / "by_poi_id")
            }
        }
        
        # Mevcut POI'lerin medya istatistikleri
        by_poi_dir = base_path / "by_poi_id"
        if by_poi_dir.exists():
            poi_count = len([d for d in by_poi_dir.iterdir() if d.is_dir()])
            info['active_pois'] = poi_count
        else:
            info['active_pois'] = 0
            
        return jsonify(info)
        
    except Exception as e:
        return jsonify({'error': f'Bilgi alınamadı: {str(e)}'}), 500

# Graph management for different transport modes
WALKING_GRAPH = None
DRIVING_GRAPH = None
WALKING_GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'urgup_merkez_walking.graphml')
DRIVING_GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'urgup_driving.graphml')

# Ürgüp merkez koordinatları ve sınırları
URGUP_CENTER = (38.6310, 34.9130)
URGUP_BOUNDS = {
    'north': 38.6350,  # Daha dar alan: şehir merkezi yürüme alanı
    'south': 38.6280,
    'east': 34.9180,
    'west': 34.9080
}

def is_within_urgup_center(lat, lon):
    """Check if coordinates are within 3000m radius of Ürgüp center"""
    import math
    
    # Ürgüp merkez koordinatları
    center_lat, center_lon = URGUP_CENTER  # (38.6310, 34.9130)
    
    # Haversine formülü ile mesafe hesapla (metre cinsinden)
    R = 6371000  # Dünya yarıçapı (metre)
    
    lat1 = math.radians(center_lat)
    lat2 = math.radians(lat)
    delta_lat = math.radians(lat - center_lat)
    delta_lon = math.radians(lon - center_lon)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance_meters = R * c
    
    return distance_meters <= 3000

def _estimate_route_center_latlon(route: Dict[str, Any], geometry_data: Dict[str, Any] = None):
    """Estimate a representative (lat, lon) for a route using POIs or geometry.
    Returns a tuple (lat, lon) or None if not available.
    """
    try:
        # Prefer POIs centroid if present
        pois = route.get('pois') or []
        valid_coords = []
        for poi in pois:
            lat = poi.get('lat') if isinstance(poi, dict) else None
            lon = poi.get('lon') if isinstance(poi, dict) else None
            if lat is not None and lon is not None:
                try:
                    lat_f = float(lat)
                    lon_f = float(lon)
                    if -90 <= lat_f <= 90 and -180 <= lon_f <= 180:
                        valid_coords.append((lat_f, lon_f))
                        # Debug: POI'nin merkez içinde mi dışında mı olduğunu logla
                        import math
                        center_lat, center_lon = URGUP_CENTER
                        R = 6371000
                        lat1 = math.radians(center_lat)
                        lat2 = math.radians(lat_f)
                        delta_lat = math.radians(lat_f - center_lat)
                        delta_lon = math.radians(lon_f - center_lon)
                        a = math.sin(delta_lat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon/2)**2
                        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                        distance_meters = R * c
                        
                        is_center = distance_meters <= 3000
                        poi_name = poi.get('name', 'Unnamed POI')
                        logger.info(f"📍 POI: {poi_name} ({lat_f:.4f}, {lon_f:.4f}) -> {distance_meters:.0f}m -> {'MERKEZ' if is_center else 'DIŞ'}")
                except Exception:
                    pass
        if valid_coords:
            avg_lat = sum(lat for lat, _ in valid_coords) / len(valid_coords)
            avg_lon = sum(lon for _, lon in valid_coords) / len(valid_coords)
            return (avg_lat, avg_lon)

        # Fallback: use route geometry centroid/first point
        if geometry_data and isinstance(geometry_data, dict):
            geom = geometry_data.get('geometry') or geometry_data
            try:
                if isinstance(geom, str):
                    import json as _json
                    geom = _json.loads(geom)
            except Exception:
                geom = None

            if isinstance(geom, dict) and geom.get('type') == 'LineString':
                coords = geom.get('coordinates') or []
                if coords:
                    # Compute simple centroid by averaging
                    lats = []
                    lons = []
                    for c in coords:
                        if isinstance(c, (list, tuple)) and len(c) >= 2:
                            lons.append(float(c[0]))
                            lats.append(float(c[1]))
                    if lats and lons:
                        return (sum(lats)/len(lats), sum(lons)/len(lons))
        return None
    except Exception:
        return None

def _is_route_in_urgup_center(route: Dict[str, Any], geometry_data: Dict[str, Any] = None) -> bool:
    """Decide if a route is considered in Ürgüp center using its representative point."""
    center = _estimate_route_center_latlon(route, geometry_data)
    if not center:
        return False
    return is_within_urgup_center(center[0], center[1])

def download_driving_graph():
    """Download and save driving network for wider Ürgüp area"""
    try:
        import osmnx as ox
        print("🚗 Downloading driving network for wider Ürgüp area...")
        
        # Daha geniş bir alan tanımla (Ürgüp merkezi etrafında 20km radius)
        center_point = (38.6310, 34.9130)  # Ürgüp merkezi
        radius = 20000  # 20 km radius
        
        print(f"📍 Center: {center_point}, Radius: {radius/1000} km")
        
        # Araba ağını indir (daha geniş alan)
        G = ox.graph_from_point(center_point, dist=radius, network_type='drive')
        
        # GraphML olarak kaydet
        ox.save_graphml(G, DRIVING_GRAPH_PATH)
        print(f"✅ Driving network saved to: {DRIVING_GRAPH_PATH}")
        print(f"📊 Network stats: {len(G.nodes)} nodes, {len(G.edges)} edges")
        
        # Graph'ın sınırlarını yazdır
        nodes_data = [(data['y'], data['x']) for node, data in G.nodes(data=True)]
        lats = [lat for lat, lon in nodes_data]
        lons = [lon for lat, lon in nodes_data]
        
        print(f"🗺️ Coverage area:")
        print(f"   North: {max(lats):.4f}")
        print(f"   South: {min(lats):.4f}")
        print(f"   East: {max(lons):.4f}")
        print(f"   West: {min(lons):.4f}")
        
        return G
        
    except Exception as e:
        print(f"❌ Error downloading driving network: {e}")
        return None

def load_driving_graph():
    """Load driving GraphML data once and cache it."""
    global DRIVING_GRAPH
    if DRIVING_GRAPH is None:
        try:
            import osmnx as ox
        except Exception as e:
            raise ImportError(f"OSMnx required for driving routes: {e}")

        # Eğer dosya yoksa indir
        if not os.path.exists(DRIVING_GRAPH_PATH):
            print(f"🔄 Driving graph not found, downloading...")
            DRIVING_GRAPH = download_driving_graph()
            if DRIVING_GRAPH is None:
                raise FileNotFoundError(f"Could not download driving network")
        else:
            print(f"📁 Loading driving network from: {DRIVING_GRAPH_PATH}")
            DRIVING_GRAPH = ox.load_graphml(DRIVING_GRAPH_PATH)
            print(f"✅ Driving network loaded: {len(DRIVING_GRAPH.nodes)} nodes, {len(DRIVING_GRAPH.edges)} edges")

    return DRIVING_GRAPH

# Walking route endpoint
@app.route('/api/route/walking', methods=['POST'])
def create_walking_route():
    """Create walking route between POIs using OSMnx"""
    try:
        data = request.get_json()
        waypoints = data.get('waypoints', [])
        
        if len(waypoints) < 2:
            return jsonify({'error': 'At least 2 waypoints required'}), 400
        
        # Import required libraries and load walking graph
        try:
            import networkx as nx

            import osmnx as ox  # Needed for nearest node lookup

            G = load_walking_graph()
            error_msg = None
        except Exception as e:
            error_msg = str(e)
            print(f"OSMnx network error: {error_msg}")
            G = None

        if G:
            route_segments = []
            total_distance = 0

            # Create route segments between consecutive waypoints
            for i in range(len(waypoints) - 1):
                start = waypoints[i]
                end = waypoints[i + 1]

                try:
                    # Find nearest nodes
                    start_node = ox.nearest_nodes(G, start['lng'], start['lat'])
                    end_node = ox.nearest_nodes(G, end['lng'], end['lat'])

                    # Calculate shortest path
                    route_nodes = nx.shortest_path(G, start_node, end_node, weight='length')
                    segment_length = nx.shortest_path_length(G, start_node, end_node, weight='length')

                    # Convert nodes to coordinates
                    segment_coords = []
                    for node in route_nodes:
                        segment_coords.append({
                            'lat': G.nodes[node]['y'],
                            'lng': G.nodes[node]['x']
                        })

                    route_segments.append({
                        'coordinates': segment_coords,
                        'distance': segment_length / 1000.0,  # Convert to km
                        'from': start.get('name', f'Point {i+1}'),
                        'to': end.get('name', f'Point {i+2}')
                    })

                    total_distance += segment_length / 1000.0

                except Exception as e:
                    print(f"Route segment error: {e}")
                    # Fallback to direct line
                    fallback_distance_km = haversine_distance(start['lat'], start['lng'], end['lat'], end['lng'])
                    route_segments.append({
                        'coordinates': [
                            {'lat': start['lat'], 'lng': start['lng']},
                            {'lat': end['lat'], 'lng': end['lng']}
                        ],
                        'distance': fallback_distance_km,
                        'from': start.get('name', f'Point {i+1}'),
                        'to': end.get('name', f'Point {i+2}'),
                        'fallback': True
                    })
                    total_distance += fallback_distance_km

            return jsonify({
                'success': True,
                'route': {
                    'segments': route_segments,
                    'total_distance': round(total_distance, 2),
                    'estimated_time': round(total_distance * 12, 0),  # 12 minutes per km walking
                    'waypoint_count': len(waypoints),
                    'network_type': 'walking'
                }
            })

        else:
            print(f"OSMnx network error or load failure: {error_msg}")
            # Fallback to direct routes
            route_segments = []
            total_distance = 0
            
            for i in range(len(waypoints) - 1):
                start = waypoints[i]
                end = waypoints[i + 1]
                distance = haversine_distance(start['lat'], start['lng'], end['lat'], end['lng'])
                
                route_segments.append({
                    'coordinates': [
                        {'lat': start['lat'], 'lng': start['lng']},
                        {'lat': end['lat'], 'lng': end['lng']}
                    ],
                    'distance': distance,
                    'from': start.get('name', f'Point {i+1}'),
                    'to': end.get('name', f'Point {i+2}'),
                    'fallback': True
                })
                total_distance += distance
            
            return jsonify({
                'success': True,
                'route': {
                    'segments': route_segments,
                    'total_distance': round(total_distance, 2),
                    'estimated_time': round(total_distance * 12, 0),
                    'waypoint_count': len(waypoints),
                    'network_type': 'direct',
                    'warning': 'Walking network not available, using direct routes'
                }
            })
            
    except Exception as e:
        print(f"Walking route error: {e}")
        return jsonify({'error': f'Route calculation failed: {str(e)}'}), 500

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate haversine distance between two points"""
    from math import radians, cos, sin, asin, sqrt
    
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Earth radius in km
    
    return c * r

# Driving route endpoint
@app.route('/api/route/driving', methods=['POST'])
def create_driving_route():
    """Create driving route between POIs using OSMnx"""
    try:
        data = request.get_json()
        waypoints = data.get('waypoints', [])
        
        if len(waypoints) < 2:
            return jsonify({'error': 'At least 2 waypoints required'}), 400
        
        # Import required libraries and load driving graph
        try:
            import networkx as nx
            import osmnx as ox  # Needed for nearest node lookup

            G = load_driving_graph()
            error_msg = None
        except Exception as e:
            error_msg = str(e)
            print(f"OSMnx driving network error: {error_msg}")

        if error_msg:
            return jsonify({
                'error': f'Driving network not available: {error_msg}',
                'fallback_used': True,
                'route': {
                    'coordinates': [[wp['lng'], wp['lat']] for wp in waypoints],
                    'distance': sum(haversine_distance(waypoints[i]['lat'], waypoints[i]['lng'], 
                                                     waypoints[i+1]['lat'], waypoints[i+1]['lng']) 
                                  for i in range(len(waypoints)-1)),
                    'duration': 0,
                    'instructions': [f"Drive to {wp.get('name', f'Point {i+1}')}" for i, wp in enumerate(waypoints)]
                }
            })

        # Find nearest nodes for each waypoint
        route_nodes = []
        for i, wp in enumerate(waypoints):
            try:
                nearest_node = ox.nearest_nodes(G, wp['lng'], wp['lat'])
                route_nodes.append(nearest_node)
                print(f"Waypoint {i+1}: {wp.get('name', 'Unknown')} ({wp['lat']:.4f}, {wp['lng']:.4f}) -> Node {nearest_node}")
            except Exception as e:
                print(f"❌ Error finding nearest node for waypoint {i+1} ({wp['lat']:.4f}, {wp['lng']:.4f}): {e}")
                # Fallback to straight line if node not found
                return jsonify({
                    'error': f'Waypoint {i+1} is outside driving network coverage',
                    'fallback_used': True,
                    'route': {
                        'coordinates': [[wp['lng'], wp['lat']] for wp in waypoints],
                        'distance': sum(haversine_distance(waypoints[j]['lat'], waypoints[j]['lng'], 
                                                         waypoints[j+1]['lat'], waypoints[j+1]['lng']) 
                                      for j in range(len(waypoints)-1)) * 1000,  # convert to meters
                        'duration': 0,
                        'instructions': [f"Direct route to {wp.get('name', f'Point {j+1}')}" for j, wp in enumerate(waypoints)],
                        'transport_mode': 'direct'
                    }
                })

        # Calculate route through all waypoints
        full_route = []
        total_distance = 0
        total_time = 0
        instructions = []
        
        for i in range(len(route_nodes) - 1):
            start_node = route_nodes[i]
            end_node = route_nodes[i + 1]
            
            try:
                # Find shortest path
                path = nx.shortest_path(G, start_node, end_node, weight='length')
                
                # Get coordinates for this segment
                segment_coords = []
                segment_distance = 0
                
                for j, node in enumerate(path):
                    node_data = G.nodes[node]
                    coord = [node_data['x'], node_data['y']]
                    segment_coords.append(coord)
                    
                    # Calculate distance for this edge
                    if j > 0:
                        prev_node = path[j-1]
                        if G.has_edge(prev_node, node):
                            edge_data = G.edges[prev_node, node, 0]
                            segment_distance += edge_data.get('length', 0)
                
                full_route.extend(segment_coords)
                total_distance += segment_distance
                
                # Estimate driving time (assuming average speed based on road type)
                avg_speed_kmh = 50  # Default speed for driving
                segment_time = (segment_distance / 1000) / avg_speed_kmh * 60  # minutes
                total_time += segment_time
                
                # Add instruction
                start_name = waypoints[i].get('name', f'Point {i+1}')
                end_name = waypoints[i+1].get('name', f'Point {i+2}')
                instructions.append(f"Drive from {start_name} to {end_name} ({segment_distance/1000:.1f} km)")
                
                print(f"Segment {i+1}: {len(path)} nodes, {segment_distance/1000:.2f} km")
                
            except nx.NetworkXNoPath:
                print(f"No driving path found between waypoints {i+1} and {i+2}")
                return jsonify({'error': f'No driving route found between waypoints {i+1} and {i+2}'}), 400
            except Exception as e:
                print(f"Error calculating driving route segment {i+1}: {e}")
                return jsonify({'error': f'Route calculation error: {str(e)}'}), 500

        distance_km = round(total_distance / 1000, 2)  # Convert meters to km
        logger.info(f"🚗 Driving route calculated: {total_distance:.0f}m -> {distance_km}km")
        
        return jsonify({
            'route': {
                'coordinates': full_route,
                'distance': distance_km,  # km (fixed)
                'duration': round(total_time, 1),      # minutes
                'instructions': instructions,
                'waypoints_count': len(waypoints),
                'transport_mode': 'driving'
            }
        })

    except Exception as e:
        print(f"Driving route error: {str(e)}")
        return jsonify({'error': f'Driving route error: {str(e)}'}), 500

# Smart route endpoint (automatically chooses walking or driving)
@app.route('/api/route/smart', methods=['POST'])
def create_smart_route():
    """Create route using walking for center POIs, driving for distant ones"""
    try:
        data = request.get_json()
        waypoints = data.get('waypoints', [])
        
        if len(waypoints) < 2:
            return jsonify({'error': 'At least 2 waypoints required'}), 400
        
        # Check if all waypoints are within Ürgüp center
        all_in_center = all(is_within_urgup_center(wp['lat'], wp['lng']) for wp in waypoints)
        
        if all_in_center:
            # Use walking route
            print("🚶 All POIs in center - using walking route")
            # Call walking route logic directly
            try:
                import networkx as nx
                import osmnx as ox
                G = load_walking_graph()
                error_msg = None
            except Exception as e:
                error_msg = str(e)
                print(f"OSMnx walking network error: {error_msg}")

            if error_msg:
                # Try to reload the walking graph before falling back
                try:
                    print("🔄 Attempting to reload walking network...")
                    import osmnx as ox
                    G = ox.load_graphml(WALKING_GRAPH_PATH)
                    error_msg = None
                    print("✅ Walking network successfully reloaded")
                except Exception as reload_error:
                    print(f"❌ Failed to reload walking network: {reload_error}")
                    return jsonify({
                        'error': f'Walking network not available after reload attempt: {error_msg}. Original error: {str(reload_error)}',
                        'suggestions': ['Check if OSMnx is properly installed', 'Verify GraphML file integrity', 'Try using driving route for longer distances'],
                        'fallback_used': False
                    }), 500

            # Walking route logic (simplified version)
            route_nodes = []
            for i, wp in enumerate(waypoints):
                try:
                    nearest_node = ox.nearest_nodes(G, wp['lng'], wp['lat'])
                    route_nodes.append(nearest_node)
                except Exception as e:
                    print(f"Error finding walking node for waypoint {i+1}: {e}")
                    return jsonify({'error': f'Could not find walking route node for waypoint {i+1}'}), 400

            # Calculate walking route
            full_route = []
            total_distance = 0
            
            for i in range(len(route_nodes) - 1):
                try:
                    path = nx.shortest_path(G, route_nodes[i], route_nodes[i + 1], weight='length')
                    segment_coords = []
                    segment_distance = 0
                    
                    for j, node in enumerate(path):
                        node_data = G.nodes[node]
                        coord = {'lat': node_data['y'], 'lng': node_data['x']}
                        segment_coords.append(coord)
                        
                        if j > 0:
                            prev_node = path[j-1]
                            if G.has_edge(prev_node, node):
                                edge_data = G.edges[prev_node, node, 0]
                                segment_distance += edge_data.get('length', 0)
                    
                    full_route.extend(segment_coords)
                    total_distance += segment_distance
                    
                except nx.NetworkXNoPath:
                    return jsonify({'error': f'No walking path found between waypoints {i+1} and {i+2}'}), 400

            distance_km = round(total_distance / 1000, 2)
            logger.info(f"🚶 Smart route calculated: {total_distance:.0f}m -> {distance_km}km")
            
            return jsonify({
                'success': True,
                'route': {
                    'segments': [{
                        'coordinates': full_route,
                        'distance': distance_km,
                        'from': waypoints[0].get('name', 'Start'),
                        'to': waypoints[-1].get('name', 'End')
                    }],
                    'total_distance': distance_km,
                    'estimated_time': round(total_distance / 1000 / 5 * 60, 1),  # 5 km/h walking speed
                    'waypoint_count': len(waypoints),
                    'network_type': 'walking'
                }
            })
        else:
            # Use driving route
            print("🚗 POIs outside center - using driving route")
            # Call driving route logic directly (same as create_driving_route but inline)
            try:
                import networkx as nx
                import osmnx as ox
                G = load_driving_graph()
                error_msg = None
            except Exception as e:
                error_msg = str(e)
                print(f"OSMnx driving network error: {error_msg}")

            if error_msg:
                # Try to reload the driving graph before falling back
                try:
                    print("🔄 Attempting to reload driving network...")
                    import osmnx as ox
                    G = ox.load_graphml(DRIVING_GRAPH_PATH)
                    error_msg = None
                    print("✅ Driving network successfully reloaded")
                except Exception as reload_error:
                    print(f"❌ Failed to reload driving network: {reload_error}")
                    return jsonify({
                        'error': f'Driving network not available after reload attempt: {error_msg}. Original error: {str(reload_error)}',
                        'suggestions': ['Check if OSMnx is properly installed', 'Verify GraphML file integrity', 'Check network coverage area'],
                        'fallback_used': False
                    }), 500

            # Find nearest nodes for each waypoint
            route_nodes = []
            for i, wp in enumerate(waypoints):
                try:
                    nearest_node = ox.nearest_nodes(G, wp['lng'], wp['lat'])
                    route_nodes.append(nearest_node)
                    print(f"Waypoint {i+1}: {wp.get('name', 'Unknown')} ({wp['lat']:.4f}, {wp['lng']:.4f}) -> Node {nearest_node}")
                except Exception as e:
                    print(f"❌ Error finding nearest node for waypoint {i+1} ({wp['lat']:.4f}, {wp['lng']:.4f}): {e}")
                    # Try to find nearest node with larger tolerance
                    try:
                        print(f"🔍 Searching for nearest node with larger radius for waypoint {i+1}...")
                        nearest_node = ox.nearest_nodes(G, wp['lng'], wp['lat'], return_dist=False)
                        route_nodes.append(nearest_node)
                        print(f"✅ Found node {nearest_node} for waypoint {i+1} with expanded search")
                    except Exception as e2:
                        print(f"❌ Failed to find any road network node for waypoint {i+1}: {e2}")
                        return jsonify({
                            'error': f'Waypoint {i+1} ({wp.get("name", "Unknown")}) is completely outside the road network coverage area. Please select points closer to roads.',
                            'waypoint_details': {
                                'index': i+1,
                                'name': wp.get('name', 'Unknown'),
                                'lat': wp['lat'],
                                'lng': wp['lng']
                            },
                            'suggestions': ['Move waypoint closer to a road', 'Use walking route for short distances', 'Check if point is in a restricted area']
                        }), 400

            # Calculate route through all waypoints
            full_route = []
            total_distance = 0
            total_time = 0
            instructions = []
            
            for i in range(len(route_nodes) - 1):
                start_node = route_nodes[i]
                end_node = route_nodes[i + 1]
                
                try:
                    # Find shortest path
                    path = nx.shortest_path(G, start_node, end_node, weight='length')
                    
                    # Get coordinates for this segment with higher resolution
                    segment_coords = []
                    segment_distance = 0
                    
                    for j, node in enumerate(path):
                        node_data = G.nodes[node]
                        coord = [node_data['x'], node_data['y']]
                        segment_coords.append(coord)
                        
                        # Add intermediate points for smoother curves
                        if j > 0:
                            prev_node = path[j-1]
                            if G.has_edge(prev_node, node):
                                edge_data = G.edges[prev_node, node, 0]
                                segment_distance += edge_data.get('length', 0)
                                
                                # Use geometry if available for higher resolution
                                if 'geometry' in edge_data:
                                    try:
                                        # Extract coordinates from geometry
                                        geom = edge_data['geometry']
                                        if hasattr(geom, 'coords'):
                                            # Remove the last coordinate to avoid duplication
                                            geom_coords = list(geom.coords)[:-1]
                                            for geom_coord in geom_coords:
                                                if len(geom_coord) >= 2:
                                                    segment_coords.insert(-1, [geom_coord[0], geom_coord[1]])
                                    except Exception as e:
                                        print(f"Warning: Could not extract geometry: {e}")
                                        # Fallback to interpolation
                                        edge_length = edge_data.get('length', 0)
                                        if edge_length > 100:
                                            prev_node_data = G.nodes[prev_node]
                                            curr_node_data = G.nodes[node]
                                            num_points = min(int(edge_length / 50), 3)
                                            for k in range(1, num_points + 1):
                                                ratio = k / (num_points + 1)
                                                inter_x = prev_node_data['x'] + (curr_node_data['x'] - prev_node_data['x']) * ratio
                                                inter_y = prev_node_data['y'] + (curr_node_data['y'] - prev_node_data['y']) * ratio
                                                segment_coords.insert(-1, [inter_x, inter_y])
                                else:
                                    # Fallback to interpolation for long edges
                                    edge_length = edge_data.get('length', 0)
                                    if edge_length > 100:
                                        prev_node_data = G.nodes[prev_node]
                                        curr_node_data = G.nodes[node]
                                        num_points = min(int(edge_length / 50), 3)
                                        for k in range(1, num_points + 1):
                                            ratio = k / (num_points + 1)
                                            inter_x = prev_node_data['x'] + (curr_node_data['x'] - prev_node_data['x']) * ratio
                                            inter_y = prev_node_data['y'] + (curr_node_data['y'] - prev_node_data['y']) * ratio
                                            segment_coords.insert(-1, [inter_x, inter_y])
                    
                    full_route.extend(segment_coords)
                    total_distance += segment_distance
                    
                    # Estimate driving time (assuming average speed based on road type)
                    avg_speed_kmh = 50  # Default speed for driving
                    segment_time = (segment_distance / 1000) / avg_speed_kmh * 60  # minutes
                    total_time += segment_time
                    
                    # Add instruction
                    start_name = waypoints[i].get('name', f'Point {i+1}')
                    end_name = waypoints[i+1].get('name', f'Point {i+2}')
                    instructions.append(f"Drive from {start_name} to {end_name} ({segment_distance/1000:.1f} km)")
                    
                    print(f"Segment {i+1}: {len(path)} nodes, {segment_distance/1000:.2f} km")
                    
                except nx.NetworkXNoPath:
                    print(f"No direct driving path found between waypoints {i+1} and {i+2}")
                    # Try alternative routing strategies
                    try:
                        # Try using Dijkstra's algorithm instead
                        print(f"🔄 Trying alternative routing for waypoints {i+1} to {i+2}...")
                        path = nx.dijkstra_path(G, start_node, end_node, weight='length')
                        print(f"✅ Found alternative path with {len(path)} nodes")
                        
                        # Process the alternative path same as before
                        segment_coords = []
                        segment_distance = 0
                        
                        for j, node in enumerate(path):
                            node_data = G.nodes[node]
                            coord = [node_data['x'], node_data['y']]
                            segment_coords.append(coord)
                            
                            if j > 0:
                                prev_node = path[j-1]
                                if G.has_edge(prev_node, node):
                                    edge_data = G.edges[prev_node, node, 0]
                                    segment_distance += edge_data.get('length', 0)
                        
                        full_route.extend(segment_coords)
                        total_distance += segment_distance
                        
                        avg_speed_kmh = 50
                        segment_time = (segment_distance / 1000) / avg_speed_kmh * 60
                        total_time += segment_time
                        
                        start_name = waypoints[i].get('name', f'Point {i+1}')
                        end_name = waypoints[i+1].get('name', f'Point {i+2}')
                        instructions.append(f"Drive from {start_name} to {end_name} ({segment_distance/1000:.1f} km) [alternative route]")
                        
                    except Exception as alt_error:
                        print(f"❌ Alternative routing also failed: {alt_error}")
                        return jsonify({
                            'error': f'No driving route found between waypoints {i+1} and {i+2}. The road network may be disconnected at these points.',
                            'details': {
                                'from_waypoint': waypoints[i].get('name', f'Point {i+1}'),
                                'to_waypoint': waypoints[i+1].get('name', f'Point {i+2}'),
                                'suggestion': 'Try selecting waypoints that are connected by roads, or use walking route for short distances'
                            }
                        }), 400
                except Exception as e:
                    print(f"Error calculating driving route segment {i+1}: {e}")
                    return jsonify({'error': f'Route calculation error: {str(e)}'}), 500

            # Convert coordinates to the format expected by JavaScript
            formatted_coordinates = [{'lat': coord[1], 'lng': coord[0]} for coord in full_route]
            
            distance_km = round(total_distance / 1000, 2)
            logger.info(f"🚗 Smart route calculated: {total_distance:.0f}m -> {distance_km}km")
            
            return jsonify({
                'success': True,
                'route': {
                    'segments': [{
                        'coordinates': formatted_coordinates,
                        'distance': distance_km,  # convert to km
                        'from': waypoints[0].get('name', 'Start'),
                        'to': waypoints[-1].get('name', 'End')
                    }],
                    'total_distance': distance_km,  # km
                    'estimated_time': round(total_time, 1),  # minutes
                    'waypoint_count': len(waypoints),
                    'network_type': 'driving',
                    'instructions': instructions
                }
            })
            
    except Exception as e:
        print(f"Smart route error: {str(e)}")
        return jsonify({'error': f'Smart route error: {str(e)}'}), 500





# POI Recommendation System endpoint
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get POI recommendations based on user preferences and optional location.

    Improvements over previous version:
      - Normalized preference vector (relative importance) instead of simple averaging
      - Proximity weighting when location is provided (smooth distance decay)
      - Overall quality factor (average rating across categories)
      - Small category-based bonus mapping POI main category to sliders
    """
    try:
        data = request.get_json(silent=True) or {}

        preferences = data.get('preferences')
        location = data.get('location')  # {'latitude': float, 'longitude': float}
        limit = int(data.get('limit') or 20)

        if preferences is None:
            return jsonify({'error': 'Missing preferences in request body'}), 400

        # Normalize preference keys to match known rating fields
        rating_fields = [
            'tarihi', 'sanat_kultur', 'doga', 'eglence',
            'alisveris', 'spor', 'macera', 'rahatlatici',
            'yemek', 'gece_hayati'
        ]

        # Prepare normalized preference weights (relative weights sum to 1)
        pref_values = {k: max(0, int(preferences.get(k, 0))) for k in rating_fields}
        pref_sum = sum(pref_values.values())
        if pref_sum > 0:
            pref_weights = {k: (v / pref_sum) for k, v in pref_values.items()}
        else:
            pref_weights = {k: 0.0 for k in rating_fields}

        all_zero = pref_sum == 0

        # Optional: parse location
        user_lat = None
        user_lng = None
        if isinstance(location, dict):
            try:
                user_lat = float(location.get('latitude'))
                user_lng = float(location.get('longitude'))
            except Exception:
                user_lat = None
                user_lng = None

        # Get all POIs with ratings
        db = get_db()
        if JSON_FALLBACK:
            with open('poi_data.json', 'r', encoding='utf-8') as f:
                poi_data = json.load(f)
            pois = poi_data.get('pois', [])
        else:
            with db.conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT p.id, p.name, p.category,
                           ST_Y(p.location::geometry) AS latitude,
                           ST_X(p.location::geometry) AS longitude,
                           p.description, '' AS tags,
                           MAX(CASE WHEN r.category = 'tarihi' THEN r.rating END) AS tarihi,
                           MAX(CASE WHEN r.category = 'sanat_kultur' THEN r.rating END) AS sanat_kultur,
                           MAX(CASE WHEN r.category = 'doga' THEN r.rating END) AS doga,
                           MAX(CASE WHEN r.category = 'eglence' THEN r.rating END) AS eglence,
                           MAX(CASE WHEN r.category = 'alisveris' THEN r.rating END) AS alisveris,
                           MAX(CASE WHEN r.category = 'spor' THEN r.rating END) AS spor,
                           MAX(CASE WHEN r.category = 'macera' THEN r.rating END) AS macera,
                           MAX(CASE WHEN r.category = 'rahatlatici' THEN r.rating END) AS rahatlatici,
                           MAX(CASE WHEN r.category = 'yemek' THEN r.rating END) AS yemek,
                           MAX(CASE WHEN r.category = 'gece_hayati' THEN r.rating END) AS gece_hayati
                    FROM pois p
                    LEFT JOIN poi_ratings r ON p.id = r.poi_id
                    WHERE p.location IS NOT NULL
                    GROUP BY p.id, p.name, p.category, p.location, p.description
                    """
                )
                pois = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
            db.disconnect()

        # Compute global field means for missing-rate imputation
        field_sums = {k: 0.0 for k in rating_fields}
        field_counts = {k: 0 for k in rating_fields}
        for p in pois:
            for f in rating_fields:
                v = p.get(f)
                if v is not None and isinstance(v, (int, float)) and v > 0:
                    field_sums[f] += float(v)
                    field_counts[f] += 1
        field_means = {}
        for f in rating_fields:
            if field_counts[f] > 0:
                field_means[f] = field_sums[f] / field_counts[f]
            else:
                field_means[f] = 50.0  # neutral prior when no data

        # Helper: haversine distance in km
        def haversine_km(lat1, lon1, lat2, lon2):
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlambda = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        # Category mapping for bonus (maps POI category -> related preference sliders)
        category_mapping = {
            'doga_macera': ['doga', 'macera', 'spor'],
            'gastronomik': ['yemek'],
            'kulturel': ['tarihi', 'sanat_kultur'],
            'sanatsal': ['sanat_kultur'],
            'konaklama': ['rahatlatici'],
            # Extended mappings observed in dataset
            'kulturel_miras': ['tarihi', 'sanat_kultur'],
            'dogal_miras': ['doga'],
            'macera_spor': ['macera', 'spor'],
            'konaklama_hizmet': ['rahatlatici'],
            'gastronomi': ['yemek'],
            'seyir_noktalari': ['doga'],
            'yasayan_kultur': ['tarihi', 'sanat_kultur'],
            'dogal_guzellilk': ['doga'],
            'yemek_icecek': ['yemek'],
            'alisveris_el_sanatlari': ['alisveris'],
            'eglence_aktivite': ['eglence', 'spor'],
            'ulasilabilirlik': []
        }

        # Weights
        if user_lat is not None and user_lng is not None:
            w_pref, w_dist, w_quality = 0.6, 0.3, 0.1
        else:
            w_pref, w_dist, w_quality = 0.8, 0.0, 0.2

        D0_KM = 3.0  # distance softness parameter for proximity score

        def proximity_score_km(d_km: float) -> float:
            # Smoothly decays: 0km->1.0, 3km->~0.5, 6km->~0.2
            return 1.0 / (1.0 + (max(0.0, d_km) / D0_KM) ** 2)

        # Identify strong user interests for soft gating/boosting
        strong_dims = [k for k, v in pref_values.items() if v >= 75]

        recommendations = []

        for poi in pois:
            # Preference score (0..1) using normalized weights
            pref_score = 0.0
            for field in rating_fields:
                weight = pref_weights.get(field, 0.0)
                rating = poi.get(field)
                if rating is None or rating == 0:
                    rating = field_means.get(field, 50.0)
                r = float(rating) / 100.0
                pref_score += weight * r

            # Quality score (0..1) average across available ratings
            total = 0.0
            cnt = 0
            for field in rating_fields:
                rating = poi.get(field)
                if rating is None or rating == 0:
                    rating = field_means.get(field, 50.0)
                total += float(rating) / 100.0
                cnt += 1
            quality_score = (total / cnt) if cnt > 0 else 0.5  # neutral baseline when unknown

            # Distance score if location available
            dist_km = None
            dist_score = 0.0
            if user_lat is not None and user_lng is not None:
                try:
                    dist_km = haversine_km(user_lat, user_lng, float(poi['latitude']), float(poi['longitude']))
                    dist_score = proximity_score_km(dist_km)
                except Exception:
                    dist_km = None
                    dist_score = 0.0

            # Category bonus (0..0.15)
            bonus = 0.0
            related = category_mapping.get(str(poi.get('category') or '').lower(), [])
            for cat in related:
                pref_val = pref_values.get(cat, 0)
                if pref_val > 50:
                    bonus += (pref_val - 50) * 0.003  # up to 0.15 if 100
            bonus = min(0.15, bonus)

            # Relevance boost based on strong dimensions (soft gating)
            boost = 1.0
            if strong_dims:
                # Any strong dimension rated reasonably by POI?
                matches = 0
                for d in strong_dims:
                    r = poi.get(d)
                    r = (float(r) if r is not None else field_means.get(d, 50.0))
                    if r >= 60.0:
                        matches += 1
                if matches >= 1:
                    boost = 1.12  # small positive boost
                else:
                    boost = 0.85  # penalize weak matches

            # If all preferences are zero, rely more on distance and quality
            if all_zero:
                base = (w_dist * dist_score) + (w_quality * quality_score)
                final_norm = min(1.0, max(0.0, boost * base + bonus))
            else:
                base = (w_pref * pref_score) + (w_dist * dist_score) + (w_quality * quality_score)
                final_norm = min(1.0, max(0.0, boost * base + bonus))

            final_score = round(final_norm * 100.0, 2)

            # Keep recommendations with a non-trivial score
            if final_score > 0:
                rec = {
                    'id': poi['id'],
                    'name': poi['name'],
                    'category': poi['category'],
                    'latitude': poi['latitude'],
                    'longitude': poi['longitude'],
                    'description': poi.get('description', ''),
                    'tags': poi.get('tags', ''),
                    'score': final_score,
                    'ratings': {field: poi.get(field, 0) for field in rating_fields},
                }
                if dist_km is not None:
                    rec['distance_km'] = round(dist_km, 2)
                # Optional detailed components (useful for debugging/tuning)
                rec['components'] = {
                    'preference': round(pref_score * 100.0, 2),
                    'distance': round(dist_score * 100.0, 2),
                    'quality': round(quality_score * 100.0, 2),
                    'bonus': round(bonus * 100.0, 2),
                }
                recommendations.append(rec)

        # Sort by score
        recommendations.sort(key=lambda x: x['score'], reverse=True)

        # Diversify results by category and location proximity
        def inter_km(a, b):
            return haversine_km(float(a['latitude']), float(a['longitude']), float(b['latitude']), float(b['longitude']))

        diversified = []
        cat_counts: Dict[str, int] = {}
        cat_cap = max(3, int(limit * 0.4))
        min_sep_km = 0.2  # 200 meters

        for rec in recommendations:
            cat = str(rec.get('category') or '').lower()
            if cat_counts.get(cat, 0) >= cat_cap:
                continue
            too_close = False
            for chosen in diversified:
                if str(chosen.get('category') or '').lower() == cat:
                    if inter_km(rec, chosen) < min_sep_km:
                        too_close = True
                        break
            if too_close:
                continue
            diversified.append(rec)
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            if len(diversified) >= limit:
                break

        # If diversification under-filled the list, top-up with remaining
        if len(diversified) < limit:
            seen_ids = {d['id'] for d in diversified}
            for rec in recommendations:
                if rec['id'] in seen_ids:
                    continue
                diversified.append(rec)
                if len(diversified) >= limit:
                    break

        recommendations = diversified[:max(1, limit)]

        return jsonify({
            'recommendations': recommendations,
            'total': len(recommendations),
            'preferences_used': pref_values,
            'location_used': {'latitude': user_lat, 'longitude': user_lng} if (user_lat is not None and user_lng is not None) else None
        })

    except Exception as e:
        logger.exception("Recommendation error")
        return jsonify({'error': f'Recommendation error: {str(e)}'}), 500


# ============================================================================
# PREDEFINED ROUTES ENDPOINTS
# ============================================================================

# Initialize route service
route_service = RouteService()

def get_route_service():
    """Get route service instance with connection"""
    if not route_service.conn:
        route_service.connect()
    return route_service

# Rate limiting for public endpoints
public_rate_limits = {}

def public_rate_limit(max_requests=100, window_seconds=60):
    """
    Rate limiting decorator for public endpoints
    
    Args:
        max_requests: Maximum requests allowed in the time window
        window_seconds: Time window in seconds
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            current_time = time.time()
            
            # Clean old entries
            if client_ip in public_rate_limits:
                public_rate_limits[client_ip] = [
                    timestamp for timestamp in public_rate_limits[client_ip]
                    if current_time - timestamp < window_seconds
                ]
            else:
                public_rate_limits[client_ip] = []
            
            # Check rate limit
            if len(public_rate_limits[client_ip]) >= max_requests:
                logger.warning(f"Rate limit exceeded for public endpoint from IP: {client_ip}")
                return jsonify({
                    'success': False,
                    'error': 'Rate limit exceeded. Please try again later.'
                }), 429
            
            # Record this request
            public_rate_limits[client_ip].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Public route endpoints
@app.route('/api/routes', methods=['GET'])
# Rate limit disabled per request
def get_predefined_routes():
    """Get all active predefined routes with pagination support"""
    try:
        service = get_route_service()
        
        # Get pagination parameters
        page = int(request.args.get('page', 0))
        limit = min(int(request.args.get('limit', 20)), 100)  # Max 100 per page
        
        # Get filters if provided
        filters = {}
        if request.args.get('route_type'):
            filters['route_type'] = request.args.get('route_type')
        if request.args.get('difficulty_min'):
            filters['difficulty_level'] = filters.get('difficulty_level', {})
            filters['difficulty_level']['min'] = int(request.args.get('difficulty_min'))
        if request.args.get('difficulty_max'):
            filters['difficulty_level'] = filters.get('difficulty_level', {})
            filters['difficulty_level']['max'] = int(request.args.get('difficulty_max'))
        
        # Use pagination if filters provided, otherwise get all
        if filters or page > 0 or limit != 20:
            result = service.filter_routes(filters, page, limit)
            return jsonify({
                'success': True,
                **result
            })
        else:
            # Fallback to cached get_all for backward compatibility
            routes = service.get_all_active_routes()
            return jsonify({
                'success': True,
                'routes': routes,
                'total': len(routes),
                'page': 0,
                'limit': len(routes),
                'has_more': False
            })
        
    except Exception as e:
        logger.error(f"Error fetching routes: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching routes: {str(e)}'
        }), 500

@app.route('/api/routes/<int:route_id>', methods=['GET'])
# Rate limit disabled per request
def get_route_details(route_id):
    """Get detailed information about a specific route"""
    try:
        # Validate route_id parameter
        if route_id <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid route ID'
            }), 400
        
        service = get_route_service()
        route = service.get_route_by_id(route_id)
        
        if not route:
            return jsonify({
                'success': False,
                'error': 'Route not found'
            }), 404
        
        response = jsonify({
            'success': True,
            'route': route
        })
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching route {route_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching route: {str(e)}'
        }), 500

@app.route('/api/routes/<int:route_id>/geometry', methods=['GET'])
@public_rate_limit(max_requests=100, window_seconds=60)
def get_route_geometry(route_id):
    """Get route geometry for visualization"""
    try:
        # Validate route_id parameter
        if route_id <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid route ID'
            }), 400
        
        service = get_route_service()
        geometry = service.get_route_geometry(route_id)
        
        if not geometry:
            return jsonify({
                'success': False,
                'error': 'Route geometry not found'
            }), 404
        
        response = jsonify({
            'success': True,
            'geometry': geometry
        })
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching route geometry {route_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching route geometry: {str(e)}'
        }), 500

@app.get('/api/routes/<int:route_id>/media')
def get_route_media(route_id: int):
    """Return media items for a route."""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT 1 FROM public.routes WHERE id=%s", (route_id,))
            if cur.fetchone() is None:
                abort(404, description="Route not found")
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Use the media manager to get route media
        media_manager = POIMediaManager()
        route_media = media_manager.get_route_media(route_id)
        
        return jsonify(route_media)
        
    except Exception as e:
        logger.error(f"Error fetching route media {route_id}: {e}")
        abort(500, "Database error")

@app.get('/api/admin/routes/<int:route_id>/media')
def get_admin_route_media(route_id: int):
    """Return media items for a route (admin endpoint)"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT 1 FROM public.routes WHERE id=%s", (route_id,))
            if cur.fetchone() is None:
                abort(404, description="Route not found")
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Use the media manager to get route media
        media_manager = POIMediaManager()
        route_media = media_manager.get_route_media(route_id)
        
        return jsonify(route_media)
        
    except Exception as e:
        logger.error(f"Error fetching admin route media {route_id}: {e}")
        abort(500, "Database error")


# --- Acceptance (manual) tests (do not run automatically) ---
# curl -i http://127.0.0.1:5560/api/routes/153/media
# Expect 404 if route 153 doesn't exist; 200 [] if exists but no media; 200 JSON array otherwise.

@app.post('/api/admin/routes/<int:route_id>/media')
def upload_route_media(route_id: int):
    """Upload media for a route"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id, name FROM public.routes WHERE id=%s", (route_id,))
            route = cur.fetchone()
            if not route:
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
            route_name = route['name']
            
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Get form data
        caption = request.form.get('caption', '')
        is_primary = request.form.get('is_primary', 'false').lower() == 'true'
        
        # Save file temporarily
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, secure_filename(file.filename))
        file.save(temp_file_path)
        
        try:
            # Initialize media manager
            media_manager = POIMediaManager()
            
            # Add route media
            media_info = media_manager.add_route_media(
                route_id=route_id,
                route_name=route_name,
                media_file_path=temp_file_path,
                caption=caption,
                is_primary=is_primary
            )
            
            if not media_info:
                return jsonify({
                    'success': False,
                    'error': 'Failed to process media file'
                }), 500
            
            # Save media info to database
            try:
                conn = get_db_conn()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Insert into route_media table
                db_lat = media_info.get('lat')
                db_lng = media_info.get('lng')
                cur.execute("""
                    INSERT INTO route_media (route_id, file_path, thumbnail_path,
                                           lat, lng, caption, is_primary, media_type, uploaded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    route_id,
                    media_info['file_path'],
                    media_info['thumbnail_path'],
                    db_lat,
                    db_lng,
                    caption,
                    is_primary,
                    media_info['media_type'],
                    datetime.now()
                ))
                
                db_result = cur.fetchone()
                media_info['id'] = str(db_result['id'])
                conn.commit()
                print(f"✅ Media saved to database with ID: {media_info['id']}")
                
            except Exception as db_error:
                print(f"⚠️ Database save failed: {db_error}")
                # Continue anyway - the file is saved to filesystem
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()
            
            # Return success response
            return jsonify({
                'success': True,
                'message': 'Media uploaded successfully',
                'media': media_info
            }), 200
            
        finally:
            # Clean up temporary file
            try:
                os.remove(temp_file_path)
                os.rmdir(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {e}")
        
    except Exception as e:
        logger.error(f"Error uploading route media: {e}")
        return jsonify({
            'success': False,
            'error': f'Error uploading media: {str(e)}'
        }), 500

@app.delete('/api/admin/routes/<int:route_id>/media/<filename>')
def delete_route_media(route_id: int, filename: str):
    """Delete media for a route"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
            if not cur.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
        except Exception as db_error:
            logger.error(f"Database connection error: {db_error}")
            return jsonify({
                'success': False,
                'error': f'Database connection failed: {str(db_error)}'
            }), 500
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Initialize media manager
        try:
            media_manager = POIMediaManager()
        except Exception as manager_error:
            logger.error(f"Error initializing media manager: {manager_error}")
            return jsonify({
                'success': False,
                'error': f'Media manager initialization failed: {str(manager_error)}'
            }), 500
        
        # Delete route media
        try:
            if media_manager.delete_route_media(route_id, filename):
                return jsonify({
                    'success': True,
                    'message': 'Media deleted successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Media not found or could not be deleted'
                }), 404
        except Exception as delete_error:
            logger.error(f"Error deleting route media: {delete_error}")
            return jsonify({
                'success': False,
                'error': f'Error deleting media: {str(delete_error)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Error deleting route media: {e}")
        return jsonify({
            'success': False,
            'error': f'Error deleting media: {str(e)}'
        }), 500

@app.put('/api/admin/routes/<int:route_id>/media/<filename>')
def update_route_media(route_id: int, filename: str):
    """Update route media metadata including location"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
            if not cur.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Initialize media manager
        media_manager = POIMediaManager()
        
        # Get current media info
        route_media = media_manager.get_route_media(route_id)
        media_item = next((m for m in route_media if m['filename'] == filename), None)
        
        if not media_item:
            return jsonify({
                'success': False,
                'error': 'Media not found'
            }), 404
        
        # Update media metadata
        updated_media = {**media_item}
        
        # Update location if provided
        if 'latitude' in data or 'lat' in data:
            lat = data.get('latitude') or data.get('lat')
            if lat is not None:
                try:
                    updated_media['lat'] = float(lat)
                    updated_media['latitude'] = float(lat)
                except ValueError:
                    return jsonify({
                        'success': False,
                        'error': 'Invalid latitude value'
                    }), 400
        
        if 'longitude' in data or 'lng' in data:
            lng = data.get('longitude') or data.get('lng')
            if lng is not None:
                try:
                    updated_media['lng'] = float(lng)
                    updated_media['longitude'] = float(lng)
                except ValueError:
                    return jsonify({
                        'success': False,
                        'error': 'Invalid longitude value'
                    }), 400
        
        # Update caption if provided
        if 'caption' in data:
            updated_media['caption'] = data['caption']
        
        # Update primary flag if provided
        if 'is_primary' in data:
            updated_media['is_primary'] = bool(data['is_primary'])
        
        # Update the media in the database
        if media_manager.update_route_media_metadata(route_id, filename, **data):
            # Get updated media info
            updated_route_media = media_manager.get_route_media(route_id)
            updated_media = next((m for m in updated_route_media if m['filename'] == filename), None)
            
            if updated_media:
                return jsonify({
                    'success': True,
                    'message': 'Media updated successfully',
                    'media': updated_media
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to retrieve updated media'
                }), 500
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update media in database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error updating route media: {e}")
        return jsonify({
            'success': False,
            'error': f'Error updating media: {str(e)}'
        }), 500

@app.post('/api/admin/routes/<int:route_id>/media/<filename>/location/auto')
def auto_route_media_location(route_id: int, filename: str):
    """Extract route media location from EXIF and save it"""
    try:
        media_manager = POIMediaManager()
        coords = media_manager.auto_set_route_media_location(route_id, filename)
        if not coords:
            return jsonify({
                'success': False,
                'error': 'No EXIF location found'
            }), 404

        lat, lng = coords
        return jsonify({
            'success': True,
            'message': 'Media location extracted from EXIF',
            'media': {
                'filename': filename,
                'lat': lat,
                'lng': lng,
                'latitude': lat,
                'longitude': lng
            }
        }), 200
    except Exception as e:
        logger.error(f"Error extracting media location from EXIF: {e}")
        return jsonify({
            'success': False,
            'error': f'Error extracting location: {str(e)}'
        }), 500

@app.put('/api/admin/routes/<int:route_id>/media/<filename>/location')
def update_route_media_location(route_id: int, filename: str):
    """Update only the location of route media"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
            if not cur.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
        except Exception as db_error:
            logger.error(f"Database connection error: {db_error}")
            return jsonify({
                'success': False,
                'error': f'Database connection failed: {str(db_error)}'
            }), 500
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate required fields
        lat = data.get('latitude') or data.get('lat')
        lng = data.get('longitude') or data.get('lng')
        
        if lat is None or lng is None:
            return jsonify({
                'success': False,
                'error': 'Both latitude and longitude are required'
            }), 400
        
        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Invalid coordinate values'
            }), 400
        
        # Initialize media manager
        try:
            media_manager = POIMediaManager()
        except Exception as manager_error:
            logger.error(f"Error initializing media manager: {manager_error}")
            return jsonify({
                'success': False,
                'error': f'Media manager initialization failed: {str(manager_error)}'
            }), 500
        
        # Note: Media existence check is handled by the media manager
        
        # Update location in the database
        try:
            if media_manager.update_route_media_location(route_id, filename, lat, lng):
                return jsonify({
                    'success': True,
                    'message': 'Media location updated successfully',
                    'media': {
                        'filename': filename,
                        'lat': lat,
                        'lng': lng,
                        'latitude': lat,
                        'longitude': lng
                    }
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to update media location in database'
                }), 500
        except Exception as update_error:
            logger.error(f"Error updating media location: {update_error}")
            return jsonify({
                'success': False,
                'error': f'Error updating media location: {str(update_error)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Error updating route media location: {e}")
        return jsonify({
            'success': False,
            'error': f'Error updating media location: {str(e)}'
        }), 500

@app.delete('/api/admin/routes/<int:route_id>/media/<filename>/location')
def delete_route_media_location(route_id: int, filename: str):
    """Delete the location information from route media (set lat/lng to NULL)"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
            if not cur.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
        except Exception as db_error:
            logger.error(f"Database connection error: {db_error}")
            return jsonify({
                'success': False,
                'error': f'Database connection failed: {str(db_error)}'
            }), 500
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Initialize media manager
        try:
            media_manager = POIMediaManager()
        except Exception as manager_error:
            logger.error(f"Error initializing media manager: {manager_error}")
            return jsonify({
                'success': False,
                'error': f'Media manager initialization failed: {str(manager_error)}'
            }), 500
        
        # Remove location from the database
        try:
            if media_manager.remove_route_media_location(route_id, filename):
                return jsonify({
                    'success': True,
                    'message': 'Media location removed successfully',
                    'media': {
                        'filename': filename,
                        'lat': None,
                        'lng': None
                    }
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to remove media location from database'
                }), 500
        except Exception as remove_error:
            logger.error(f"Error removing media location: {remove_error}")
            return jsonify({
                'success': False,
                'error': f'Error removing media location: {str(remove_error)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Error removing route media location: {e}")
        return jsonify({
            'success': False,
            'error': f'Error removing media location: {str(e)}'
        }), 500

@app.patch('/api/admin/routes/<int:route_id>/media/<filename>')
def patch_route_media(route_id: int, filename: str):
    """Update specific fields of route media using PATCH method"""
    try:
        # Check if route exists
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if route exists
            cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
            if not cur.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Route not found'
                }), 404
            
        except Exception as db_error:
            logger.error(f"Database connection error: {db_error}")
            return jsonify({
                'success': False,
                'error': f'Database connection failed: {str(db_error)}'
            }), 500
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate and filter allowed fields
        allowed_fields = ['caption', 'is_primary', 'media_type', 'lat', 'lng']
        filtered_data = {}
        
        for field, value in data.items():
            if field in allowed_fields:
                if field in ['lat', 'lng']:
                    try:
                        filtered_data[field] = float(value) if value is not None else None
                    except (ValueError, TypeError):
                        return jsonify({
                            'success': False,
                            'error': f'Invalid {field} value: {value}'
                        }), 400
                elif field == 'is_primary':
                    if not isinstance(value, bool):
                        return jsonify({
                            'success': False,
                            'error': f'is_primary must be a boolean value'
                        }), 400
                    filtered_data[field] = value
                else:
                    filtered_data[field] = value
        
        if not filtered_data:
            return jsonify({
                'success': False,
                'error': 'No valid fields to update'
            }), 400
        
        # Initialize media manager
        try:
            media_manager = POIMediaManager()
        except Exception as manager_error:
            logger.error(f"Error initializing media manager: {manager_error}")
            return jsonify({
                'success': False,
                'error': f'Media manager initialization failed: {str(manager_error)}'
            }), 500
        
        # Update media metadata
        try:
            if media_manager.update_route_media_metadata(route_id, filename, **filtered_data):
                # Get updated media info
                updated_media = media_manager.get_route_media(route_id)
                updated_item = next((m for m in updated_media if m.get('filename') == filename), None)
                
                return jsonify({
                    'success': True,
                    'message': 'Media updated successfully',
                    'media': updated_item
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to update media in database'
                }), 500
        except Exception as update_error:
            logger.error(f"Error updating media: {update_error}")
            return jsonify({
                'success': False,
                'error': f'Error updating media: {str(update_error)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Error updating route media: {e}")
        return jsonify({
            'success': False,
            'error': f'Error updating media: {str(e)}'
        }), 500

@app.route('/api/routes/filter', methods=['POST'])
@public_rate_limit(max_requests=50, window_seconds=60)
def filter_routes():
    """Filter routes based on criteria"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No filter data provided'
            }), 400
        
        filters = data.get('filters', {})
        
        # Validate filter structure
        if not isinstance(filters, dict):
            return jsonify({
                'success': False,
                'error': 'Filters must be an object'
            }), 400
        
        # Validate route_type filter
        if 'route_type' in filters:
            valid_route_types = ['walking', 'hiking', 'cycling', 'driving']
            if filters['route_type'] not in valid_route_types:
                return jsonify({
                    'success': False,
                    'error': f'Invalid route_type. Must be one of: {", ".join(valid_route_types)}'
                }), 400
        
        # Validate difficulty_level filter
        if 'difficulty_level' in filters:
            difficulty = filters['difficulty_level']
            if isinstance(difficulty, dict):
                if 'min' in difficulty and (not isinstance(difficulty['min'], int) or difficulty['min'] < 1 or difficulty['min'] > 5):
                    return jsonify({
                        'success': False,
                        'error': 'Difficulty level min must be between 1 and 5'
                    }), 400
                if 'max' in difficulty and (not isinstance(difficulty['max'], int) or difficulty['max'] < 1 or difficulty['max'] > 5):
                    return jsonify({
                        'success': False,
                        'error': 'Difficulty level max must be between 1 and 5'
                    }), 400
        
        service = get_route_service()
        routes = service.filter_routes(filters)
        
        response = jsonify({
            'success': True,
            'routes': routes,
            'count': len(routes),
            'filters_applied': filters
        })
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        return response
        
    except Exception as e:
        logger.error(f"Error filtering routes: {e}")
        return jsonify({
            'success': False,
            'error': f'Error filtering routes: {str(e)}'
        }), 500

@app.route('/api/routes/search', methods=['GET'])
@public_rate_limit(max_requests=50, window_seconds=60)
def search_routes():
    """Search routes by name, description, or tags"""
    try:
        search_term = request.args.get('q', '').strip()
        
        if not search_term:
            return jsonify({
                'success': False,
                'error': 'Search term is required'
            }), 400
        
        # Validate search term length
        if len(search_term) < 2:
            return jsonify({
                'success': False,
                'error': 'Search term must be at least 2 characters long'
            }), 400
        
        if len(search_term) > 100:
            return jsonify({
                'success': False,
                'error': 'Search term too long. Maximum 100 characters allowed'
            }), 400
        
        # Basic sanitization - remove potentially dangerous characters
        import re
        search_term = re.sub(r'[<>"\';]', '', search_term)
        
        service = get_route_service()
        routes = service.search_routes(search_term)
        
        response = jsonify({
            'success': True,
            'routes': routes,
            'count': len(routes),
            'search_term': search_term
        })
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        return response
        
    except Exception as e:
        logger.error(f"Error searching routes: {e}")
        return jsonify({
            'success': False,
            'error': f'Error searching routes: {str(e)}'
        }), 500



# ===== FILE UPLOAD AND VALIDATION API ENDPOINTS =====

# Global variables for progress tracking
upload_progress = {}
upload_progress_lock = threading.Lock()

class SecureFileUploader:
    """Secure file upload handler with validation and security checks"""
    
    ALLOWED_EXTENSIONS = {'gpx', 'kml', 'kmz'}
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    UPLOAD_FOLDER = 'temp_uploads'
    
    def __init__(self):
        # Create upload folder if it doesn't exist
        os.makedirs(self.UPLOAD_FOLDER, exist_ok=True)
        self.route_parser = RouteFileParser()
    
    def validate_file(self, file: FileStorage) -> dict:
        """
        Comprehensive file validation
        
        Returns:
            dict: Validation result with success status and details
        """
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'file_info': {}
        }
        
        # Check if file exists
        if not file or not file.filename:
            validation_result['is_valid'] = False
            validation_result['errors'].append('Dosya seçilmedi')
            return validation_result
        
        # Get file info
        filename = file.filename
        file_size = 0
        
        # Calculate file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        validation_result['file_info'] = {
            'filename': filename,
            'size': file_size,
            'size_mb': round(file_size / (1024 * 1024), 2)
        }
        
        # Check file size
        if file_size > self.MAX_FILE_SIZE:
            validation_result['is_valid'] = False
            validation_result['errors'].append(
                f'Dosya çok büyük: {validation_result["file_info"]["size_mb"]}MB (maksimum: 50MB)'
            )
        
        if file_size == 0:
            validation_result['is_valid'] = False
            validation_result['errors'].append('Dosya boş')
            return validation_result
        
        # Check file extension
        file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if file_ext not in self.ALLOWED_EXTENSIONS:
            validation_result['is_valid'] = False
            validation_result['errors'].append(
                f'Desteklenmeyen dosya formatı: .{file_ext}. '
                f'Desteklenen formatlar: {", ".join(self.ALLOWED_EXTENSIONS)}'
            )
        
        validation_result['file_info']['extension'] = file_ext
        
        # Check filename for security
        secure_name = self.sanitize_filename(filename)
        if secure_name != filename:
            validation_result['warnings'].append('Dosya adı güvenlik için değiştirildi')
            validation_result['file_info']['sanitized_filename'] = secure_name
        
        return validation_result
    
    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename for security
        
        Args:
            filename: Original filename
            
        Returns:
            str: Sanitized filename
        """
        # Remove path components
        filename = os.path.basename(filename)
        
        # Remove or replace dangerous characters
        filename = re.sub(r'[^\w\s.-]', '', filename)
        filename = re.sub(r'[-\s]+', '-', filename)
        
        # Limit length
        name, ext = os.path.splitext(filename)
        if len(name) > 100:
            name = name[:100]
        
        return f"{name}{ext}"
    
    def scan_file_content(self, file_path: str) -> dict:
        """
        Scan file content for security issues
        
        Args:
            file_path: Path to uploaded file
            
        Returns:
            dict: Scan results
        """
        scan_result = {
            'is_safe': True,
            'issues': [],
            'file_hash': None
        }
        
        try:
            # Calculate file hash
            hash_sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            scan_result['file_hash'] = hash_sha256.hexdigest()
            
            # Basic content validation - check if it's actually XML/ZIP
            with open(file_path, 'rb') as f:
                header = f.read(1024)
                
                # Check for XML files (GPX, KML)
                if file_path.lower().endswith(('.gpx', '.kml')):
                    try:
                        header_text = header.decode('utf-8', errors='ignore')
                        if not header_text.strip().startswith('<?xml'):
                            scan_result['issues'].append('Dosya XML formatında değil')
                        if '<script' in header_text.lower():
                            scan_result['is_safe'] = False
                            scan_result['issues'].append('Güvenlik riski: Script içeriği tespit edildi')
                    except:
                        scan_result['issues'].append('Dosya içeriği okunamadı')
                
                # Check for ZIP files (KMZ)
                elif file_path.lower().endswith('.kmz'):
                    if not header.startswith(b'PK'):
                        scan_result['issues'].append('Dosya ZIP formatında değil')
            
        except Exception as e:
            scan_result['is_safe'] = False
            scan_result['issues'].append(f'Dosya tarama hatası: {str(e)}')
        
        return scan_result
    
    def save_uploaded_file(self, file: FileStorage, upload_id: str) -> str:
        """
        Save uploaded file to temporary location
        
        Args:
            file: Uploaded file
            upload_id: Unique upload identifier
            
        Returns:
            str: Path to saved file
        """
        filename = self.sanitize_filename(file.filename)
        file_path = os.path.join(self.UPLOAD_FOLDER, f"{upload_id}_{filename}")
        
        file.save(file_path)
        return file_path
    
    def create_route_preview(self, parsed_route):
        """Create optimized route preview coordinates"""
        if parsed_route.points:
            # If we have track points, create a smart sample
            points = parsed_route.points
            total_points = len(points)
            
            if total_points <= 50:
                # If few points, use all
                return [{'lat': p.latitude, 'lng': p.longitude} for p in points]
            else:
                # Smart sampling: take every nth point to get ~100 points
                step = max(1, total_points // 100)
                sampled_points = points[::step]
                
                # Always include first and last point
                if points[0] not in sampled_points:
                    sampled_points.insert(0, points[0])
                if points[-1] not in sampled_points:
                    sampled_points.append(points[-1])
                
                return [{'lat': p.latitude, 'lng': p.longitude} for p in sampled_points]
        else:
            # Use waypoints if no track points
            return [{'lat': wp.latitude, 'lng': wp.longitude} for wp in parsed_route.waypoints]


@app.route('/api/routes/import', methods=['POST'])
@auth_middleware.require_auth
# Rate limit disabled per request
def upload_route_file():
    """
    Upload and validate route file (GPX, KML, KMZ)
    
    Returns:
        JSON response with upload status and validation results
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Dosya bulunamadı',
                'error_code': 'NO_FILE'
            }), 400
        
        file = request.files['file']
        uploader = SecureFileUploader()
        
        # Generate unique upload ID
        upload_id = str(uuid.uuid4())
        
        # Initialize progress tracking
        with upload_progress_lock:
            upload_progress[upload_id] = {
                'status': 'validating',
                'progress': 10,
                'message': 'Dosya doğrulanıyor...',
                'started_at': datetime.now().isoformat()
            }
        
        # Validate file
        validation_result = uploader.validate_file(file)
        
        if not validation_result['is_valid']:
            with upload_progress_lock:
                upload_progress[upload_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'message': 'Dosya doğrulama başarısız',
                    'errors': validation_result['errors']
                }
            
            return jsonify({
                'success': False,
                'upload_id': upload_id,
                'error': 'Dosya doğrulama başarısız',
                'error_code': 'VALIDATION_FAILED',
                'validation_errors': validation_result['errors'],
                'warnings': validation_result.get('warnings', [])
            }), 400
        
        # Update progress
        with upload_progress_lock:
            upload_progress[upload_id]['status'] = 'uploading'
            upload_progress[upload_id]['progress'] = 30
            upload_progress[upload_id]['message'] = 'Dosya yükleniyor...'
        
        # Save file temporarily
        try:
            file_path = uploader.save_uploaded_file(file, upload_id)
        except Exception as e:
            with upload_progress_lock:
                upload_progress[upload_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'message': f'Dosya kaydetme hatası: {str(e)}'
                }
            
            return jsonify({
                'success': False,
                'upload_id': upload_id,
                'error': f'Dosya kaydetme hatası: {str(e)}',
                'error_code': 'SAVE_FAILED'
            }), 500
        
        # Update progress
        with upload_progress_lock:
            upload_progress[upload_id]['status'] = 'scanning'
            upload_progress[upload_id]['progress'] = 50
            upload_progress[upload_id]['message'] = 'Dosya güvenlik taraması...'
        
        # Scan file content
        scan_result = uploader.scan_file_content(file_path)
        
        if not scan_result['is_safe']:
            # Clean up file
            try:
                os.unlink(file_path)
            except:
                pass
            
            with upload_progress_lock:
                upload_progress[upload_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'message': 'Güvenlik taraması başarısız',
                    'errors': scan_result['issues']
                }
            
            return jsonify({
                'success': False,
                'upload_id': upload_id,
                'error': 'Güvenlik taraması başarısız',
                'error_code': 'SECURITY_SCAN_FAILED',
                'security_issues': scan_result['issues']
            }), 400
        
        # Update progress
        with upload_progress_lock:
            upload_progress[upload_id]['status'] = 'parsing'
            upload_progress[upload_id]['progress'] = 70
            upload_progress[upload_id]['message'] = 'Rota dosyası parse ediliyor...'
        
        # Parse route file
        try:
            parsed_route = uploader.route_parser.parse_file(file_path)
            metadata = uploader.route_parser.extract_metadata(parsed_route)
        except RouteParserError as e:
            # Clean up file
            try:
                os.unlink(file_path)
            except:
                pass
            
            with upload_progress_lock:
                upload_progress[upload_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'message': f'Parse hatası: {e.message}',
                    'error_code': e.error_code
                }
            
            # Log the error for debugging
            logger.error(f"Route parsing failed for {file_path}: {e.message} (code: {e.error_code})")
            logger.error(f"Error details: {e.details}")
            
            return jsonify({
                'success': False,
                'upload_id': upload_id,
                'error': f'Rota dosyası parse edilemedi: {e.message}',
                'error_code': e.error_code,
                'error_details': e.details
            }), 400
        except Exception as e:
            # Clean up file
            try:
                os.unlink(file_path)
            except:
                pass
            
            with upload_progress_lock:
                upload_progress[upload_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'message': f'Beklenmeyen hata: {str(e)}'
                }
            
            # Log the unexpected error for debugging
            logger.error(f"Unexpected error during route import for {file_path}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            return jsonify({
                'success': False,
                'upload_id': upload_id,
                'error': f'Beklenmeyen hata: {str(e)}',
                'error_code': 'UNEXPECTED_ERROR'
            }), 500
        
        # Update progress
        with upload_progress_lock:
            upload_progress[upload_id]['status'] = 'completed'
            upload_progress[upload_id]['progress'] = 100
            upload_progress[upload_id]['message'] = 'Dosya başarıyla işlendi'
        
        # Prepare response
        response_data = {
            'success': True,
            'upload_id': upload_id,
            'message': 'Dosya başarıyla yüklendi ve parse edildi',
            'file_info': {
                **validation_result['file_info'],
                'file_hash': scan_result['file_hash'],
                'temp_path': file_path
            },
            'route_data': {
                'metadata': metadata,
                'points_count': len(parsed_route.points),
                'waypoints_count': len(parsed_route.waypoints),
                'coordinates_preview': uploader.create_route_preview(parsed_route)
            },
            'validation_warnings': validation_result.get('warnings', []),
            'security_issues': scan_result.get('issues', [])
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Sunucu hatası: {str(e)}',
            'error_code': 'SERVER_ERROR'
        }), 500


@app.route('/api/routes/import/progress/<upload_id>', methods=['GET'])
@auth_middleware.require_auth
# Rate limit disabled per request
def get_upload_progress(upload_id):
    """
    Get upload progress for a specific upload ID
    
    Args:
        upload_id: Unique upload identifier
        
    Returns:
        JSON response with progress information
    """
    try:
        with upload_progress_lock:
            progress_info = upload_progress.get(upload_id)
        
        if not progress_info:
            return jsonify({
                'success': False,
                'error': 'Upload ID bulunamadı',
                'error_code': 'UPLOAD_NOT_FOUND'
            }), 404
        
        return jsonify({
            'success': True,
            'upload_id': upload_id,
            'progress': progress_info
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Progress bilgisi alınamadı: {str(e)}',
            'error_code': 'PROGRESS_ERROR'
        }), 500


@app.route('/api/routes/import/confirm', methods=['POST'])
@auth_middleware.require_auth
# Rate limit disabled per request
def confirm_route_import():
    """
    Confirm and save imported route to database
    
    Expected JSON payload:
    {
        "upload_id": "uuid",
        "route_name": "string",
        "route_description": "string",
        "route_type": "string",
        "associate_pois": [poi_ids]
    }
    
    Returns:
        JSON response with import confirmation
    """
    try:
        data = request.get_json()
        
        if not data or 'upload_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Upload ID gerekli',
                'error_code': 'MISSING_UPLOAD_ID'
            }), 400
        
        upload_id = data['upload_id']
        
        # Check if upload exists and is completed
        with upload_progress_lock:
            progress_info = upload_progress.get(upload_id)
        
        if not progress_info:
            return jsonify({
                'success': False,
                'error': 'Upload ID bulunamadı',
                'error_code': 'UPLOAD_NOT_FOUND'
            }), 404
        
        if progress_info['status'] != 'completed':
            return jsonify({
                'success': False,
                'error': 'Upload henüz tamamlanmadı',
                'error_code': 'UPLOAD_NOT_COMPLETED'
            }), 400
        
        # Get file path from temp storage
        uploader = SecureFileUploader()
        temp_files = [f for f in os.listdir(uploader.UPLOAD_FOLDER) if f.startswith(upload_id)]
        
        if not temp_files:
            return jsonify({
                'success': False,
                'error': 'Geçici dosya bulunamadı',
                'error_code': 'TEMP_FILE_NOT_FOUND'
            }), 404
        
        file_path = os.path.join(uploader.UPLOAD_FOLDER, temp_files[0])
        
        # Re-parse the file to get complete data
        try:
            parsed_route = uploader.route_parser.parse_file(file_path)
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Dosya tekrar parse edilemedi: {str(e)}',
                'error_code': 'REPARSE_FAILED'
            }), 500
        
        # Prepare route data for database
        distance_meters = parsed_route.metadata.distance or 0
        distance_km = round(distance_meters / 1000, 2)  # Round to 2 decimal places
        logger.info(f"📁 Route import: {distance_meters:.0f}m -> {distance_km:.2f}km")
        
        route_data = {
            'name': data.get('route_name', parsed_route.metadata.name or 'İsimsiz Rota'),
            'description': data.get('route_description', parsed_route.metadata.description or ''),
            'route_type': data.get('route_type', parsed_route.metadata.route_type or 'imported'),
            'difficulty_level': 3,  # Default difficulty (1-5 scale)
            'estimated_duration': int(parsed_route.metadata.duration or 0),  # minutes
            'total_distance': distance_km,  # Convert meters to km
            'elevation_gain': int(parsed_route.metadata.elevation_gain or 0),  # meters
            'tags': f'imported,{parsed_route.original_format}',
            'import_metadata': {
                'file_hash': parsed_route.file_hash,
                'points_count': len(parsed_route.points),
                'waypoints_count': len(parsed_route.waypoints),
                'imported_at': datetime.now().isoformat(),
                'imported_by': session.get('user_id', 'unknown'),
                'original_filename': temp_files[0].split('_', 1)[1],  # Remove upload_id prefix
                'import_source': parsed_route.original_format
            }
        }
        
        # Get database connection
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        db_adapter = POIDatabaseFactory.create_database(db_type, connection_string=connection_string)
        db_adapter.connect()
        
        try:
            # Save route to database
            with db_adapter.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    # Insert route
                    # Convert dict fields to JSON strings
                    route_data_for_db = route_data.copy()
                    route_data_for_db['import_metadata'] = json.dumps(route_data['import_metadata'])
                    
                    cursor.execute("""
                        INSERT INTO routes (
                            name, description, route_type, difficulty_level, 
                            estimated_duration, total_distance, elevation_gain, 
                            tags, created_at, updated_at
                        ) VALUES (
                            %(name)s, %(description)s, %(route_type)s, %(difficulty_level)s, 
                            %(estimated_duration)s, %(total_distance)s, %(elevation_gain)s, 
                            %(tags)s, NOW(), NOW()
                        ) RETURNING id
                    """, route_data_for_db)
                    
                    route_id = cursor.fetchone()['id']
                    
                    # Save waypoints if any
                    if parsed_route.waypoints:
                        waypoints_data = [
                            {
                                'name': wp.name or f'Waypoint {i+1}',
                                'description': wp.description or '',
                                'latitude': wp.latitude,
                                'longitude': wp.longitude,
                                'elevation': wp.elevation
                            }
                            for i, wp in enumerate(parsed_route.waypoints)
                        ]
                        
                        cursor.execute("""
                            UPDATE routes 
                            SET waypoints = %s 
                            WHERE id = %s
                        """, (json.dumps(waypoints_data), route_id))
                    
                    # Create route geometry from points if available
                    if parsed_route.points:
                        # Create LINESTRING geometry from points
                        linestring_coords = ','.join([
                            f"{p.longitude} {p.latitude}" for p in parsed_route.points
                        ])
                        
                        linestring_wkt = f"LINESTRING({linestring_coords})"
                        
                        cursor.execute("""
                            UPDATE routes 
                            SET route_geometry = ST_GeogFromText(%s)
                            WHERE id = %s
                        """, (linestring_wkt, route_id))
                    
                    # Note: route_imports table not created yet, skipping import record
                    
                    # Calculate elevation profile - prefer geometry over waypoints for better accuracy
                    elevation_profile = None
                    elevation_source = None
                    
                    # Try to get geometry coordinates first
                    geometry_coords = None
                    if parsed_route.points:
                        geometry_coords = [[p.longitude, p.latitude] for p in parsed_route.points]
                        elevation_source = "geometry"
                        print(f"🗺️ Using route geometry with {len(geometry_coords)} points for elevation calculation")
                    elif parsed_route.waypoints and len(parsed_route.waypoints) >= 2:
                        elevation_source = "waypoints"
                        print(f"📍 Using waypoints for elevation calculation (no geometry available)")
                    
                    if elevation_source:
                        try:
                            print(f"🏔️ Calculating elevation profile for route: {route_data['name']}")
                            elevation_service = ElevationService()
                            
                            if elevation_source == "geometry" and geometry_coords:
                                # Calculate total distance from geometry for optimal resolution
                                total_distance = 0
                                for i in range(1, len(geometry_coords)):
                                    dist = elevation_service.calculate_distance(
                                        geometry_coords[i-1][1], geometry_coords[i-1][0],  # lat, lng
                                        geometry_coords[i][1], geometry_coords[i][0]
                                    )
                                    total_distance += dist
                                
                                # Determine resolution (fixed ~10m)
                                resolution = 10
                                
                                # Generate elevation profile from geometry
                                elevation_profile = elevation_service.generate_elevation_profile_from_geometry(
                                    geometry_coords, resolution
                                )
                                
                            else:
                                # Fallback to waypoints
                                waypoints_for_elevation = [
                                    {
                                        'lat': wp.latitude,
                                        'lng': wp.longitude,
                                        'name': wp.name or f'Waypoint {i+1}'
                                    }
                                    for i, wp in enumerate(parsed_route.waypoints)
                                ]
                                
                                # Calculate total distance to determine optimal resolution
                                total_distance = 0
                                for i in range(1, len(waypoints_for_elevation)):
                                    dist = elevation_service.calculate_distance(
                                        waypoints_for_elevation[i-1]['lat'], waypoints_for_elevation[i-1]['lng'],
                                        waypoints_for_elevation[i]['lat'], waypoints_for_elevation[i]['lng']
                                    )
                                    total_distance += dist
                                
                                # Determine resolution (fixed ~10m)
                                resolution = 10
                                
                                # Generate elevation profile from waypoints
                                elevation_profile = elevation_service.generate_elevation_profile(
                                    waypoints_for_elevation, resolution
                                )
                            
                            # Update route with elevation data
                            cursor.execute("""
                                UPDATE routes 
                                SET 
                                    elevation_profile = %s,
                                    elevation_resolution = %s,
                                    elevation_gain = %s
                                WHERE id = %s
                            """, (
                                json.dumps(elevation_profile),
                                resolution,
                                elevation_profile['stats']['elevation_gain'],
                                route_id
                            ))
                            
                            print(f"✅ Elevation profile calculated from {elevation_source}: {elevation_profile['point_count']} points, "
                                  f"{elevation_profile['total_distance']:.1f}m distance, {resolution}m resolution")
                                  
                        except Exception as e:
                            print(f"⚠️ Elevation profile calculation failed: {e}")
                            # Continue without elevation data
                    
                    # Associate POIs if requested (using existing route_pois table)
                    poi_ids = data.get('associate_pois', [])
                    if poi_ids:
                        for i, poi_id in enumerate(poi_ids):
                            cursor.execute("""
                                INSERT INTO route_pois (route_id, poi_id, order_in_route, is_mandatory)
                                VALUES (%s, %s, %s, false)
                                ON CONFLICT (route_id, poi_id) DO NOTHING
                            """, (route_id, poi_id, i + 1))
                    
                    db_adapter.conn.commit()
                    
                    # Clean up temporary file
                    try:
                        os.unlink(file_path)
                    except:
                        pass
                    
                    # Clean up progress tracking
                    with upload_progress_lock:
                        if upload_id in upload_progress:
                            del upload_progress[upload_id]
                    
                    # Clear in-memory caches for route listings/details
                    try:
                        from route_service import clear_route_cache
                        clear_route_cache()
                    except Exception as _:
                        pass

                    return jsonify({
                        'success': True,
                        'message': 'Rota başarıyla import edildi',
                        'route_id': route_id,
                        'route_data': {
                            'id': route_id,
                            'name': route_data['name'],
                            'description': route_data['description'],
                            'points_count': len(parsed_route.points),
                            'waypoints_count': len(parsed_route.waypoints),
                            'distance': route_data['total_distance'],
                            'associated_pois': len(poi_ids)
                        }
                    }), 200
                    
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Veritabanı hatası: {str(e)}',
                'error_code': 'DATABASE_ERROR'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Import onaylama hatası: {str(e)}',
            'error_code': 'CONFIRM_ERROR'
        }), 500


@app.route('/api/routes/import/cancel', methods=['POST'])
@auth_middleware.require_auth
# Rate limit disabled per request
def cancel_route_import():
    """
    Cancel route import and clean up temporary files
    
    Expected JSON payload:
    {
        "upload_id": "uuid"
    }
    
    Returns:
        JSON response with cancellation confirmation
    """
    try:
        data = request.get_json()
        
        if not data or 'upload_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Upload ID gerekli',
                'error_code': 'MISSING_UPLOAD_ID'
            }), 400
        
        upload_id = data['upload_id']
        
        # Clean up temporary files
        uploader = SecureFileUploader()
        temp_files = [f for f in os.listdir(uploader.UPLOAD_FOLDER) if f.startswith(upload_id)]
        
        for temp_file in temp_files:
            try:
                os.unlink(os.path.join(uploader.UPLOAD_FOLDER, temp_file))
            except:
                pass
        
        # Clean up progress tracking
        with upload_progress_lock:
            if upload_id in upload_progress:
                del upload_progress[upload_id]
        
        return jsonify({
            'success': True,
            'message': 'Import işlemi iptal edildi',
            'upload_id': upload_id
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Import iptal hatası: {str(e)}',
            'error_code': 'CANCEL_ERROR'
        }), 500


# ===== END FILE UPLOAD ENDPOINTS =====

# ===== POI SUGGESTION ALGORITHM =====

import math
from typing import Set

class POISuggestionEngine:
    """POI suggestion algorithm for routes"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        
        # Scoring weights for different factors
        self.DISTANCE_WEIGHT = 0.4
        self.CATEGORY_COMPATIBILITY_WEIGHT = 0.3
        self.POPULARITY_WEIGHT = 0.2
        self.ROUTE_POSITION_WEIGHT = 0.1
        
        # Maximum distance for POI suggestions (in meters)
        self.MAX_SUGGESTION_DISTANCE = 2000  # 2km
        
        # Category compatibility matrix
        self.CATEGORY_COMPATIBILITY = {
            'gastronomik': {
                'kulturel': 0.8,
                'sanatsal': 0.7,
                'doga_macera': 0.6,
                'konaklama': 0.9,
                'gastronomik': 1.0
            },
            'kulturel': {
                'gastronomik': 0.8,
                'sanatsal': 0.9,
                'doga_macera': 0.5,
                'konaklama': 0.7,
                'kulturel': 1.0
            },
            'sanatsal': {
                'gastronomik': 0.7,
                'kulturel': 0.9,
                'doga_macera': 0.4,
                'konaklama': 0.6,
                'sanatsal': 1.0
            },
            'doga_macera': {
                'gastronomik': 0.6,
                'kulturel': 0.5,
                'sanatsal': 0.4,
                'konaklama': 0.8,
                'doga_macera': 1.0
            },
            'konaklama': {
                'gastronomik': 0.9,
                'kulturel': 0.7,
                'sanatsal': 0.6,
                'doga_macera': 0.8,
                'konaklama': 1.0
            }
        }
    
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def get_route_coordinates(self, route_id: int) -> List[Tuple[float, float]]:
        """Get route coordinates from database"""
        query = """
            SELECT ST_AsText(route_geometry) as geometry_text
            FROM routes 
            WHERE id = %s AND is_active = true
        """
        
        with self.db.cursor() as cur:
            cur.execute(query, (route_id,))
            result = cur.fetchone()
            
            if not result or not result[0]:
                return []
            
            # Parse WKT LINESTRING format
            geometry_text = result[0]
            if geometry_text.startswith('LINESTRING('):
                coords_str = geometry_text[11:-1]  # Remove 'LINESTRING(' and ')'
                coordinates = []
                for coord_pair in coords_str.split(','):
                    lon, lat = map(float, coord_pair.strip().split())
                    coordinates.append((lat, lon))
                return coordinates
            
            return []
    
    def find_nearby_pois(self, route_coordinates: List[Tuple[float, float]]) -> List[Dict[str, Any]]:
        """Find POIs near route coordinates"""
        if not route_coordinates:
            return []
        
        # Create a buffer around the route to find nearby POIs
        nearby_pois = []
        processed_poi_ids: Set[int] = set()
        
        for lat, lon in route_coordinates:
            query = """
                SELECT 
                    p.id,
                    p.name,
                    p.category,
                    p.description,
                    ST_Y(p.location::geometry) as latitude,
                    ST_X(p.location::geometry) as longitude,
                    ST_Distance(p.location, ST_GeogFromText('POINT(%s %s)')) as distance,
                    COALESCE(
                        (SELECT AVG(rating) FROM poi_ratings WHERE poi_id = p.id), 
                        0
                    ) as avg_rating
                FROM pois p
                WHERE 
                    p.is_active = true
                    AND ST_DWithin(p.location, ST_GeogFromText('POINT(%s %s)'), %s)
                ORDER BY distance
            """
            
            with self.db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (lon, lat, lon, lat, self.MAX_SUGGESTION_DISTANCE))
                results = cur.fetchall()
                
                for poi in results:
                    if poi['id'] not in processed_poi_ids:
                        nearby_pois.append(dict(poi))
                        processed_poi_ids.add(poi['id'])
        
        return nearby_pois
    
    def calculate_compatibility_score(self, poi_category: str, route_categories: List[str]) -> float:
        """Calculate compatibility score between POI and route categories"""
        if not route_categories:
            return 0.5  # Default compatibility
        
        max_compatibility = 0.0
        for route_category in route_categories:
            compatibility = self.CATEGORY_COMPATIBILITY.get(poi_category, {}).get(route_category, 0.3)
            max_compatibility = max(max_compatibility, compatibility)
        
        return max_compatibility
    
    def get_route_categories(self, route_id: int) -> List[str]:
        """Get categories of POIs already associated with the route"""
        query = """
            SELECT DISTINCT p.category
            FROM route_pois rp
            JOIN pois p ON rp.poi_id = p.id
            WHERE rp.route_id = %s
        """
        
        with self.db.cursor() as cur:
            cur.execute(query, (route_id,))
            results = cur.fetchall()
            return [row[0] for row in results]
    
    def calculate_route_position_score(self, poi_lat: float, poi_lon: float, 
                                     route_coordinates: List[Tuple[float, float]]) -> float:
        """Calculate score based on POI position relative to route"""
        if not route_coordinates:
            return 0.0
        
        min_distance = float('inf')
        total_route_length = len(route_coordinates)
        best_position_index = 0
        
        for i, (route_lat, route_lon) in enumerate(route_coordinates):
            distance = self.calculate_distance(poi_lat, poi_lon, route_lat, route_lon)
            if distance < min_distance:
                min_distance = distance
                best_position_index = i
        
        # Prefer POIs that are not at the very beginning or end of the route
        position_ratio = best_position_index / max(1, total_route_length - 1)
        if 0.2 <= position_ratio <= 0.8:
            return 1.0  # Optimal position
        elif 0.1 <= position_ratio <= 0.9:
            return 0.7  # Good position
        else:
            return 0.4  # Suboptimal position (too close to start/end)
    
    def calculate_overall_score(self, poi: Dict[str, Any], route_id: int, 
                              route_coordinates: List[Tuple[float, float]]) -> float:
        """Calculate overall suggestion score for a POI"""
        # Distance score (closer is better)
        distance_score = max(0, 1 - (poi['distance'] / self.MAX_SUGGESTION_DISTANCE))
        
        # Category compatibility score
        route_categories = self.get_route_categories(route_id)
        compatibility_score = self.calculate_compatibility_score(poi['category'], route_categories)
        
        # Popularity score (based on average rating)
        avg_rating = float(poi['avg_rating']) if poi['avg_rating'] is not None else 0.0
        popularity_score = min(1.0, avg_rating / 100.0)  # Normalize to 0-1
        
        # Route position score
        position_score = self.calculate_route_position_score(
            poi['latitude'], poi['longitude'], route_coordinates
        )
        
        # Calculate weighted overall score
        overall_score = (
            distance_score * self.DISTANCE_WEIGHT +
            compatibility_score * self.CATEGORY_COMPATIBILITY_WEIGHT +
            popularity_score * self.POPULARITY_WEIGHT +
            position_score * self.ROUTE_POSITION_WEIGHT
        )
        
        return overall_score
    
    def suggest_pois_for_route(self, route_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Main method to suggest POIs for a route"""
        try:
            # Get route coordinates
            route_coordinates = self.get_route_coordinates(route_id)
            if not route_coordinates:
                return []
            
            # Find nearby POIs
            nearby_pois = self.find_nearby_pois(route_coordinates)
            if not nearby_pois:
                return []
            
            # Get already associated POIs to exclude them
            query = "SELECT poi_id FROM route_pois WHERE route_id = %s"
            with self.db.cursor() as cur:
                cur.execute(query, (route_id,))
                associated_poi_ids = {row[0] for row in cur.fetchall()}
            
            # Calculate scores and filter
            suggestions = []
            for poi in nearby_pois:
                # Skip already associated POIs
                if poi['id'] in associated_poi_ids:
                    continue
                
                # Calculate overall score
                score = self.calculate_overall_score(poi, route_id, route_coordinates)
                
                # Add suggestion data
                suggestion = {
                    'poi_id': poi['id'],
                    'name': poi['name'],
                    'category': poi['category'],
                    'description': poi['description'],
                    'latitude': poi['latitude'],
                    'longitude': poi['longitude'],
                    'distance_from_route': round(poi['distance'], 2),
                    'compatibility_score': round(score * 100, 1),
                    'avg_rating': round(poi['avg_rating'], 1),
                    'suggestion_reason': self._generate_suggestion_reason(poi, score)
                }
                
                suggestions.append(suggestion)
            
            # Sort by score (highest first) and limit results
            suggestions.sort(key=lambda x: x['compatibility_score'], reverse=True)
            return suggestions[:limit]
            
        except Exception as e:
            print(f"Error suggesting POIs for route {route_id}: {e}")
            return []
    
    def _generate_suggestion_reason(self, poi: Dict[str, Any], score: float) -> str:
        """Generate human-readable reason for POI suggestion"""
        distance = poi['distance']
        category = poi['category']
        rating = poi['avg_rating']
        
        if score > 0.8:
            return f"Rotaya çok yakın ({int(distance)}m) ve {category} kategorisinde yüksek puanlı"
        elif score > 0.6:
            return f"Rotaya yakın ({int(distance)}m) ve uyumlu kategori ({category})"
        elif score > 0.4:
            return f"Rota üzerinde ({int(distance)}m mesafede) ilginç bir nokta"
        else:
            return f"Rota yakınında ({int(distance)}m) alternatif seçenek"


@app.route('/api/routes/<int:route_id>/suggest-pois', methods=['GET'])
@auth_middleware.require_auth
def suggest_pois_for_route(route_id):
    """
    Suggest POIs for a specific route
    
    Query parameters:
    - limit: Maximum number of suggestions (default: 10, max: 50)
    - min_score: Minimum compatibility score (0-100, default: 30)
    
    Returns:
        JSON response with POI suggestions
    """
    try:
        # Get query parameters
        limit = min(50, max(1, int(request.args.get('limit', 10))))
        min_score = max(0, min(100, float(request.args.get('min_score', 30))))
        
        # Check if route exists
        db = get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Veritabanı bağlantısı yok',
                'error_code': 'DATABASE_CONNECTION_ERROR'
            }), 500
        
        # Verify route exists and is active
        with db.conn.cursor() as cur:
            cur.execute("SELECT id, name FROM routes WHERE id = %s AND is_active = true", (route_id,))
            route = cur.fetchone()
            
            if not route:
                return jsonify({
                    'success': False,
                    'error': 'Rota bulunamadı veya aktif değil',
                    'error_code': 'ROUTE_NOT_FOUND'
                }), 404
        
        # Initialize suggestion engine
        suggestion_engine = POISuggestionEngine(db.conn)
        
        # Get POI suggestions
        suggestions = suggestion_engine.suggest_pois_for_route(route_id, limit)
        
        # Filter by minimum score
        filtered_suggestions = [
            suggestion for suggestion in suggestions 
            if suggestion['compatibility_score'] >= min_score
        ]
        
        # Get route info for response
        route_info = {
            'id': route[0],
            'name': route[1]
        }
        
        return jsonify({
            'success': True,
            'route': route_info,
            'suggestions': filtered_suggestions,
            'total_suggestions': len(filtered_suggestions),
            'parameters': {
                'limit': limit,
                'min_score': min_score
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Geçersiz parametre değeri',
            'error_code': 'INVALID_PARAMETER'
        }), 400
        
    except Exception as e:
        logger.error(f"Error in suggest_pois_for_route: {e}")
        return jsonify({
            'success': False,
            'error': f'POI önerisi hatası: {str(e)}',
            'error_code': 'SUGGESTION_ERROR'
        }), 500


# ===== NEARBY POI AUTO-ASSOCIATION =====

@app.route('/api/routes/<int:route_id>/nearby-pois', methods=['GET'])
@auth_middleware.require_auth
# @admin_rate_limit(max_requests=100, window_seconds=60)  # Geliştirme için devre dışı
def find_nearby_pois_for_route(route_id):
    """
    Rota yakınındaki POI'leri bul
    
    Query parameters:
    - max_distance: Maksimum mesafe (metre, default: 500, max: 2000)
    
    Returns:
        JSON response with nearby POIs
    """
    try:
        # Get query parameters
        max_distance = min(2000, max(50, int(request.args.get('max_distance', 500))))
        
        # Initialize route service
        route_service = RouteService()
        if not route_service.connect():
            return jsonify({
                'success': False,
                'error': 'Veritabanı bağlantısı başarısız',
                'error_code': 'DATABASE_CONNECTION_ERROR'
            }), 500
        
        # Check if route exists and has geometry
        route = route_service.get_route_by_id(route_id)
        if not route:
            return jsonify({
                'success': False,
                'error': 'Rota bulunamadı',
                'error_code': 'ROUTE_NOT_FOUND'
            }), 404
        
        # Dinamik yarıçap uygula: Ürgüp merkezinde 50m, dışında 250m.
        # Kullanıcı bir değer gönderse bile üst sınır olarak dinamik yarıçapı uygula.
        geometry = route_service.get_route_geometry(route_id)
        is_center = _is_route_in_urgup_center(route, geometry)
        dynamic_default = 50 if is_center else 250
        user_supplied = request.args.get('max_distance')
        
        logger.info(f"🔍 Route {route_id} nearby POI request - is_center: {is_center}, dynamic_default: {dynamic_default}m, user_supplied: {user_supplied}")
        
        if user_supplied is not None:
            try:
                user_val = int(user_supplied)
                user_val = min(2000, max(1, user_val))
                max_distance = min(user_val, dynamic_default)
                logger.info(f"🔍 User supplied {user_val}m, limited to {max_distance}m by dynamic default")
            except Exception:
                max_distance = dynamic_default
                logger.info(f"🔍 Invalid user input, using dynamic default: {max_distance}m")
        else:
            max_distance = dynamic_default
            logger.info(f"🔍 No user input, using dynamic default: {max_distance}m")

        # Find nearby POIs with decided radius
        nearby_pois = route_service.find_nearby_pois(route_id, max_distance)
        
        route_service.disconnect()
        
        return jsonify({
            'success': True,
            'route': {
                'id': route['id'],
                'name': route['name']
            },
            'nearby_pois': nearby_pois,
            'total_found': len(nearby_pois),
            'parameters': {
                'max_distance_meters': max_distance,
                'is_center_route': is_center,
                'user_supplied': user_supplied
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Geçersiz parametre değeri',
            'error_code': 'INVALID_PARAMETER'
        }), 400
        
    except Exception as e:
        logger.error(f"Error in find_nearby_pois_for_route: {e}")
        return jsonify({
            'success': False,
            'error': f'Yakın POI arama hatası: {str(e)}',
            'error_code': 'NEARBY_POI_ERROR'
        }), 500


@app.route('/api/routes/<int:route_id>/auto-associate-pois', methods=['POST'])
@auth_middleware.require_auth
# @admin_rate_limit(max_requests=30, window_seconds=60)  # Geliştirme için devre dışı
def auto_associate_nearby_pois(route_id):
    """
    Rota yakınındaki POI'leri otomatik olarak ilişkilendir
    
    Request body:
    {
        "max_distance": 500,  // Maksimum mesafe (metre)
        "auto_confirm": false,  // Otomatik onay
        "categories": ["tarihi", "doga"]  // Sadece belirli kategoriler (opsiyonel)
    }
    
    Returns:
        JSON response with association results
    """
    try:
        data = request.get_json() or {}
        
        # Get parameters (user override if provided)
        user_max_distance = data.get('max_distance')
        max_distance = None
        if user_max_distance is not None:
            try:
                max_distance = min(2000, max(50, int(user_max_distance)))
            except Exception:
                max_distance = None
        auto_confirm = bool(data.get('auto_confirm', False))
        categories = data.get('categories', [])
        
        # Initialize route service
        route_service = RouteService()
        if not route_service.connect():
            return jsonify({
                'success': False,
                'error': 'Veritabanı bağlantısı başarısız',
                'error_code': 'DATABASE_CONNECTION_ERROR'
            }), 500
        
        # Check if route exists
        route = route_service.get_route_by_id(route_id)
        if not route:
            route_service.disconnect()
            return jsonify({
                'success': False,
                'error': 'Rota bulunamadı',
                'error_code': 'ROUTE_NOT_FOUND'
            }), 404
        
        # Dinamik yarıçap uygula (50m merkez, 250m dışı). Kullanıcı değer girdiyse bile üst sınır uygula.
        geometry = route_service.get_route_geometry(route_id)
        is_center = _is_route_in_urgup_center(route, geometry)
        dynamic_default = 50 if is_center else 250
        user_max_distance = max_distance
        
        logger.info(f"🔧 Route {route_id} auto-associate POI request - is_center: {is_center}, dynamic_default: {dynamic_default}m, user_max_distance: {user_max_distance}")
        
        if max_distance is None:
            max_distance = dynamic_default
            logger.info(f"🔧 No user input, using dynamic default: {max_distance}m")
        else:
            max_distance = min(max_distance, dynamic_default)
            logger.info(f"🔧 User supplied {user_max_distance}m, limited to {max_distance}m by dynamic default")

        # Auto-associate nearby POIs with decided radius
        result = route_service.auto_associate_nearby_pois(route_id, max_distance, auto_confirm)
        
        # Filter by categories if specified
        if categories and result.get('found_pois'):
            filtered_pois = [
                poi for poi in result['found_pois'] 
                if poi.get('category') in categories
            ]
            result['found_pois'] = filtered_pois
            result['total_found'] = len(filtered_pois)
        
        route_service.disconnect()
        
        # Add route info to response
        result['route'] = {
            'id': route['id'],
            'name': route['name']
        }
        result['parameters'] = {
            'max_distance_meters': max_distance,
            'auto_confirm': auto_confirm,
            'categories': categories
        }
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Geçersiz parametre değeri',
            'error_code': 'INVALID_PARAMETER'
        }), 400
        
    except Exception as e:
        logger.error(f"Error in auto_associate_nearby_pois: {e}")
        return jsonify({
            'success': False,
            'error': f'Otomatik POI ekleme hatası: {str(e)}',
            'error_code': 'AUTO_ASSOCIATION_ERROR'
        }), 500


# ===== END POI SUGGESTION ALGORITHM =====

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5560))
    print("🚀 POI Yönetim Sistemi başlatılıyor...")
    print(f"📊 Web arayüzü: http://localhost:{port}/poi_manager_ui.html")
    print(f"🔌 API endpoint'leri: http://localhost:{port}/api/")
    
    # Test database connection to show accurate status
    db = get_db()
    if JSON_FALLBACK:
        print("⚠️  JSON fallback modu - tüm işlemler JSON dosyasında yapılacak")
    elif db is not None:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        print(f"✅ {db_type.upper()} veritabanı bağlantısı aktif")
        db.disconnect()
    else:
        print("❌ Veritabanı bağlantısı başarısız")
    
    port = int(os.environ.get('PORT', 5560))
    print(f"🔌 Server starting on port {port}")
    app.run(debug=True, host='0.0.0.0', port=port)
