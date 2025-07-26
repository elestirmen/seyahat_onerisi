# Design Document

## Overview

Bu tasarım, mevcut POI yönetim paneline şifre tabanlı kimlik doğrulama sistemi ekler. Sistem, Flask-Session kullanarak güvenli oturum yönetimi sağlar ve bcrypt ile şifre hash'leme yapar. Mevcut Flask API'ye minimal değişikliklerle entegre olacak şekilde tasarlanmıştır.

## Architecture

### High-Level Architecture

```
Browser -> Login Page -> Flask API (Auth Middleware) -> POI Management UI
                              |
                              v
                         Session Store
                              |
                              v
                         Password Hash Storage
```

### Authentication Flow

1. **Initial Access**: Kullanıcı yönetim paneli URL'sine erişir
2. **Auth Check**: Middleware oturum kontrolü yapar
3. **Login Redirect**: Oturum yoksa login sayfasına yönlendirir
4. **Credential Validation**: Şifre hash karşılaştırması yapılır
5. **Session Creation**: Başarılı girişte güvenli oturum oluşturulur
6. **Access Grant**: Yönetim paneline erişim sağlanır

## Components and Interfaces

### 1. Authentication Middleware

**File**: `auth_middleware.py`

```python
class AuthMiddleware:
    def __init__(self, app, password_hash):
        self.app = app
        self.password_hash = password_hash
    
    def require_auth(self, f):
        """Decorator for protected routes"""
        pass
    
    def check_session(self):
        """Check if user is authenticated"""
        pass
    
    def validate_password(self, password):
        """Validate password against hash"""
        pass
```

### 2. Login Page Component

**File**: `login.html`

- Responsive tasarım (Bootstrap 5)
- Şifre gizleme/gösterme toggle
- "Beni Hatırla" seçeneği
- Hata mesajları için toast sistemi
- CSRF koruması

### 3. Session Management

**Technology**: Flask-Session with secure cookies

**Configuration**:
- Session timeout: 2 saat (varsayılan), "Beni Hatırla" ile 7 gün
- Secure cookies (HTTPS)
- HttpOnly cookies
- SameSite=Strict

### 4. Password Management

**Hashing**: bcrypt (cost factor: 12)
**Storage**: Environment variable veya config file
**Default Password**: Güvenli rastgele oluşturulmuş şifre

## Data Models

### Session Data Structure

```python
session = {
    'authenticated': True,
    'login_time': datetime,
    'last_activity': datetime,
    'remember_me': False,
    'csrf_token': str
}
```

### Configuration Model

```python
auth_config = {
    'password_hash': str,  # bcrypt hash
    'session_timeout': int,  # seconds
    'remember_timeout': int,  # seconds
    'max_login_attempts': int,
    'lockout_duration': int  # seconds
}
```

## Error Handling

### Authentication Errors

1. **Invalid Password**: 
   - HTTP 401 with user-friendly message
   - Rate limiting after failed attempts
   - Temporary lockout after max attempts

2. **Session Expired**:
   - Automatic redirect to login
   - Clear expired session data
   - Preserve intended destination

3. **CSRF Token Mismatch**:
   - HTTP 403 with error message
   - Force re-authentication

### Security Measures

1. **Brute Force Protection**:
   - Max 5 attempts per 15 minutes
   - Progressive delays between attempts
   - IP-based rate limiting

2. **Session Security**:
   - Secure session cookies
   - Session regeneration after login
   - Automatic logout on browser close

## Testing Strategy

### Unit Tests

1. **Password Validation Tests**:
   - Correct password acceptance
   - Incorrect password rejection
   - Hash generation and verification

2. **Session Management Tests**:
   - Session creation and validation
   - Session expiration handling
   - Remember me functionality

3. **Middleware Tests**:
   - Protected route access control
   - Authentication bypass attempts
   - CSRF token validation

### Integration Tests

1. **Login Flow Tests**:
   - Complete authentication workflow
   - Error handling scenarios
   - Session persistence across requests

2. **Security Tests**:
   - Brute force protection
   - Session hijacking prevention
   - CSRF attack prevention

### Manual Testing Scenarios

1. **User Experience Tests**:
   - Login page responsiveness
   - Error message clarity
   - Navigation flow

2. **Security Validation**:
   - Password strength requirements
   - Session timeout behavior
   - Multi-tab session handling

## Implementation Details

### File Structure

```
├── auth_middleware.py          # Authentication middleware
├── templates/
│   └── login.html             # Login page template
├── static/
│   ├── css/
│   │   └── auth.css          # Authentication styles
│   └── js/
│       └── auth.js           # Client-side auth logic
└── config/
    └── auth_config.py        # Authentication configuration
```

### Environment Variables

```bash
# Authentication Configuration
POI_ADMIN_PASSWORD_HASH=<bcrypt_hash>
POI_SESSION_SECRET_KEY=<random_secret>
POI_SESSION_TIMEOUT=7200  # 2 hours
POI_REMEMBER_TIMEOUT=604800  # 7 days
```

### API Endpoints

```python
# New authentication endpoints
POST /auth/login          # User login
POST /auth/logout         # User logout
GET  /auth/status         # Check auth status
POST /auth/change-password # Change password (authenticated)

# Modified existing endpoint
GET  /                    # Redirect to login if not authenticated
```

### Security Headers

```python
# Security headers to be added
'X-Content-Type-Options': 'nosniff'
'X-Frame-Options': 'DENY'
'X-XSS-Protection': '1; mode=block'
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
```

## Migration Strategy

### Phase 1: Core Authentication
- Implement basic login/logout functionality
- Add session management
- Create login page

### Phase 2: Security Enhancements
- Add brute force protection
- Implement CSRF protection
- Add security headers

### Phase 3: User Experience
- Add "Remember Me" functionality
- Implement password change feature
- Add session management UI

### Backward Compatibility

- Mevcut API endpoints değişmez
- Yalnızca yönetim paneli korunur
- Public API endpoints etkilenmez