from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, Blueprint
from flask_cors import CORS
from poi_database_adapter import POIDatabaseFactory
from poi_media_manager import POIMediaManager
from psycopg2.extras import RealDictCursor
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

app = Flask(__name__)
CORS(app, origins=["*"], supports_credentials=True)

# Configure session management
configure_session(app)

# Initialize authentication middleware
auth_middleware.init_app(app)

# Create authentication blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET'])
def login_page():
    """Serve the login page."""
    if auth_middleware.is_authenticated():
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
                        window.location.href = '/';
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
WALKING_GRAPH = None
WALKING_GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                  'urgup_merkez_walking.graphml')

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
    """Ana sayfa - POI öneri sistemi."""
    try:
        with open('poi_recommendation_system.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return '<h1>❌ Hata</h1><p>poi_recommendation_system.html dosyası bulunamadı!</p>', 404

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
        
        # Sadece aktif POI'leri filtrele
        filtered_data = {}
        for cat, pois in test_data.items():
            if isinstance(pois, list):
                active_pois = [poi for poi in pois if poi.get('isActive', True)]
                if active_pois:  # Sadece aktif POI'si olan kategorileri ekle
                    filtered_data[cat] = active_pois
        
        # Arama filtresi uygula
        if search_query:
            search_results = {}
            for cat, pois in filtered_data.items():
                matched_pois = []
                for poi in pois:
                    # POI adı, açıklama ve etiketlerde ara
                    search_fields = [
                        poi.get('name', ''),
                        poi.get('description', ''),
                        ', '.join(poi.get('tags', []))
                    ]
                    
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
            description
        FROM pois
        WHERE is_active = true
        AND (
            LOWER(TRANSLATE(name, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
            OR LOWER(TRANSLATE(COALESCE(description, ''), 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu')) 
            LIKE LOWER(TRANSLATE(%s, 'çÇğĞıİöÖşŞüÜ', 'ccggiiooSSuu'))
        )
    """
    
    params = [f'%{search_query}%', f'%{search_query}%']
    
    if category_filter:
        base_query += " AND category = %s"
        params.append(category_filter)
    
    base_query += " ORDER BY name"
    
    with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(base_query, params)
        results = cur.fetchall()
    
    # Sonuçları kategorilere göre grupla
    search_results = {}
    for row in results:
        category = row['category']
        if category not in search_results:
            search_results[category] = []
        search_results[category].append(dict(row))
    
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
                    route_segments.append({
                        'coordinates': [
                            {'lat': start['lat'], 'lng': start['lng']},
                            {'lat': end['lat'], 'lng': end['lng']}
                        ],
                        'distance': haversine_distance(start['lat'], start['lng'], end['lat'], end['lng']),
                        'from': start.get('name', f'Point {i+1}'),
                        'to': end.get('name', f'Point {i+2}'),
                        'fallback': True
                    })
                    total_distance += haversine_distance(start['lat'], start['lng'], end['lat'], end['lng'])

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

# POI Recommendation System endpoint
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get POI recommendations based on user preferences"""
    try:
        data = request.get_json()
        preferences = data.get('preferences', {})
        
        if not preferences:
            return jsonify({'error': 'No preferences provided'}), 400
        
        # Get all POIs with their ratings
        db = get_db()
        if JSON_FALLBACK:
            # JSON fallback mode
            with open('poi_data.json', 'r', encoding='utf-8') as f:
                poi_data = json.load(f)
            pois = poi_data.get('pois', [])
        else:
            # Database mode
            with db.conn.cursor() as cursor:
                # Get POIs with their ratings pivoted
                cursor.execute("""
                    SELECT p.id, p.name, p.category, 
                           ST_Y(p.location::geometry) as latitude,
                           ST_X(p.location::geometry) as longitude,
                           p.description, '' as tags,
                           MAX(CASE WHEN r.category = 'tarihi' THEN r.rating END) as tarihi,
                           MAX(CASE WHEN r.category = 'sanat_kultur' THEN r.rating END) as sanat_kultur,
                           MAX(CASE WHEN r.category = 'doga' THEN r.rating END) as doga,
                           MAX(CASE WHEN r.category = 'eglence' THEN r.rating END) as eglence,
                           MAX(CASE WHEN r.category = 'alisveris' THEN r.rating END) as alisveris,
                           MAX(CASE WHEN r.category = 'spor' THEN r.rating END) as spor,
                           MAX(CASE WHEN r.category = 'macera' THEN r.rating END) as macera,
                           MAX(CASE WHEN r.category = 'rahatlatici' THEN r.rating END) as rahatlatici,
                           MAX(CASE WHEN r.category = 'yemek' THEN r.rating END) as yemek,
                           MAX(CASE WHEN r.category = 'gece_hayati' THEN r.rating END) as gece_hayati
                    FROM pois p
                    LEFT JOIN poi_ratings r ON p.id = r.poi_id
                    WHERE p.location IS NOT NULL
                    GROUP BY p.id, p.name, p.category, p.location, p.description
                """)
                pois = [dict(zip([col[0] for col in cursor.description], row)) 
                       for row in cursor.fetchall()]
            db.disconnect()
        
        # Calculate recommendation scores
        recommendations = []
        for poi in pois:
            score = 0
            rating_count = 0
            
            # Calculate score based on user preferences and POI ratings
            rating_fields = ['tarihi', 'sanat_kultur', 'doga', 'eglence', 
                           'alisveris', 'spor', 'macera', 'rahatlatici', 
                           'yemek', 'gece_hayati']
            
            for field in rating_fields:
                user_pref = preferences.get(field, 0)
                poi_rating = poi.get(field, 0) if poi.get(field) is not None else 0
                
                if user_pref > 0 and poi_rating > 0:
                    # Normalize both values to 0-1 range and calculate weighted score
                    normalized_pref = user_pref / 100.0
                    normalized_rating = poi_rating / 100.0
                    score += normalized_pref * normalized_rating
                    rating_count += 1
            
            # Only include POIs that have some matching preferences
            if score > 0 and rating_count > 0:
                # Average the score
                final_score = (score / rating_count) * 100
                
                recommendations.append({
                    'id': poi['id'],
                    'name': poi['name'],
                    'category': poi['category'],
                    'latitude': poi['latitude'],
                    'longitude': poi['longitude'],
                    'description': poi.get('description', ''),
                    'tags': poi.get('tags', ''),
                    'score': round(final_score, 2),
                    'ratings': {field: poi.get(field, 0) for field in rating_fields}
                })
        
        # Sort by score (highest first) and limit to top 20
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations = recommendations[:20]
        
        return jsonify({
            'recommendations': recommendations,
            'total': len(recommendations),
            'preferences_used': preferences
        })
        
    except Exception as e:
        print(f"Recommendation error: {str(e)}")
        return jsonify({'error': f'Recommendation error: {str(e)}'}), 500

if __name__ == '__main__':
    print("🚀 POI Yönetim Sistemi başlatılıyor...")
    print("📊 Web arayüzü: http://localhost:5505/poi_manager_ui.html")
    print("🔌 API endpoint'leri: http://localhost:5505/api/")
    
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
    
    app.run(debug=True, host='0.0.0.0', port=5505)