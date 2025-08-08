/**
 * Authentication JavaScript Module
 * Handles login form functionality, validation, and user interactions
 */

class AuthManager {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.passwordToggleIcon = document.getElementById('passwordToggleIcon');
        this.rememberMeCheckbox = document.getElementById('rememberMe');
        this.loginBtn = document.getElementById('loginBtn');
        this.toastContainer = document.getElementById('toastContainer');
        
        this.failedAttempts = 0;
        this.maxAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
        this.isLocked = false;
        this.lockoutTimer = null;
        
        // Session timeout management
        this.sessionCheckInterval = null;
        this.sessionWarningShown = false;
        this.sessionTimeoutWarning = null;
        this.sessionExtendTimer = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadCSRFToken();
        this.checkLockoutStatus();
        this.setupFormValidation();
    }
    
    setupEventListeners() {
        // Form submission
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Password visibility toggle
        this.passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
        
        // Real-time validation
        this.passwordInput.addEventListener('input', () => this.validatePassword());
        this.passwordInput.addEventListener('blur', () => this.validatePassword());
        
        // Enter key handling
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLocked) {
                this.handleLogin(e);
            }
        });
        
        // Remember me checkbox accessibility
        this.rememberMeCheckbox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.rememberMeCheckbox.checked = !this.rememberMeCheckbox.checked;
            }
        });
    }
    
    async loadCSRFToken() {
        try {
            const response = await fetch('/auth/csrf-token', {
                method: 'GET',
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                const csrfTokenElement = document.getElementById('csrfToken');
                if (csrfTokenElement && data.csrf_token) {
                    csrfTokenElement.value = data.csrf_token;
                }
            }
        } catch (error) {
            console.warn('CSRF token yüklenemedi:', error);
            // İlk login için CSRF token gerekli değil, bu yüzden hata vermiyoruz
        }
    }
    
    setupFormValidation() {
        // Bootstrap form validation setup
        this.loginForm.classList.add('needs-validation');
    }
    
    validatePassword() {
        const password = this.passwordInput.value.trim();
        const errorElement = document.getElementById('passwordError');
        
        if (password.length === 0) {
            this.passwordInput.classList.add('is-invalid');
            this.passwordInput.classList.remove('is-valid');
            errorElement.textContent = 'Lütfen şifrenizi girin.';
            return false;
        } else {
            this.passwordInput.classList.remove('is-invalid');
            this.passwordInput.classList.add('is-valid');
            return true;
        }
    }
    
    togglePasswordVisibility() {
        const isPassword = this.passwordInput.type === 'password';
        
        this.passwordInput.type = isPassword ? 'text' : 'password';
        this.passwordToggleIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        
        // Update aria-label for accessibility
        this.passwordToggle.setAttribute('aria-label', 
            isPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
        );
        
        // Focus back to input
        this.passwordInput.focus();
    }
    
    async handleLogin(event) {
        event.preventDefault();
        
        if (this.isLocked) {
            this.showToast('Çok fazla başarısız deneme. Lütfen bekleyin.', 'warning');
            return;
        }
        
        if (!this.validatePassword()) {
            this.showToast('Lütfen geçerli bir şifre girin.', 'danger');
            return;
        }
        
        this.setLoadingState(true);
        
        try {
            // Prepare JSON data instead of FormData
            const csrfTokenElement = document.getElementById('csrfToken');
            const csrfTokenValue = csrfTokenElement ? csrfTokenElement.value || null : null;
            
            console.log('Login attempt:', {
                password_length: this.passwordInput.value.trim().length,
                remember_me: this.rememberMeCheckbox.checked,
                csrf_token: csrfTokenValue
            });
            
            const loginData = {
                password: this.passwordInput.value.trim(),
                remember_me: this.rememberMeCheckbox.checked,
                csrf_token: csrfTokenValue
            };
            
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            console.log('Login response:', {
                status: response.status,
                ok: response.ok,
                data: data
            });
            
            if (response.ok && data.success) {
                this.handleLoginSuccess(data);
            } else {
                this.handleLoginError(data, response.status);
            }
        } catch (error) {
            console.error('Giriş hatası:', error);
            this.showToast('Bağlantı hatası. Lütfen tekrar deneyin.', 'danger');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    handleLoginSuccess(data) {
        this.failedAttempts = 0;
        this.clearLockout();
        
        this.showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
        
        // Start session monitoring for authenticated users
        this.startSessionMonitoring();
        
        // Determine redirect target
        const params = new URLSearchParams(window.location.search);
        const nextParam = params.get('next');
        let redirectUrl = data.redirect_url || '/';

        if (nextParam) {
            try {
                const parsed = new URL(nextParam, window.location.origin);
                if (parsed.origin === window.location.origin) {
                    redirectUrl = parsed.pathname + parsed.search + parsed.hash;
                }
            } catch (e) {}
        }

        // Redirect after short delay
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
    }
    
    handleLoginError(data, status) {
        this.failedAttempts++;
        
        let message = data.error || data.message || 'Giriş başarısız.';
        
        if (status === 401) {
            message = 'Hatalı şifre. Lütfen tekrar deneyin.';
            // Show remaining attempts if provided
            if (data.remaining_attempts !== undefined) {
                this.showToast(`${data.remaining_attempts} deneme hakkınız kaldı.`, 'warning');
            }
        } else if (status === 429) {
            // Handle different types of rate limiting
            if (data.delay_seconds) {
                // Progressive delay
                message = `Lütfen ${data.delay_seconds} saniye bekleyin.`;
                this.handleProgressiveDelay(data.delay_seconds);
            } else if (data.lockout_time) {
                // Full lockout
                message = 'Çok fazla başarısız deneme. Hesap geçici olarak kilitlendi.';
                this.handleRateLimit(data);
            } else {
                message = 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.';
            }
        } else if (status === 403) {
            message = 'Güvenlik hatası. Sayfa yenilenecek.';
            setTimeout(() => window.location.reload(), 2000);
        }
        
        this.showToast(message, 'danger');
        
        // Clear password field
        this.passwordInput.value = '';
        this.passwordInput.focus();
        this.validatePassword();
    }
    
    handleRateLimit(data) {
        if (data.lockout_time) {
            this.lockUser(data.lockout_time * 1000);
        } else if (data.retry_after) {
            this.lockUser(data.retry_after * 1000);
        }
    }
    
    handleProgressiveDelay(delaySeconds) {
        // Temporarily disable the form for the delay period
        this.setFormDisabled(true);
        
        // Show countdown
        this.showProgressiveDelayWarning(delaySeconds);
        
        // Re-enable after delay
        setTimeout(() => {
            this.setFormDisabled(false);
            this.clearProgressiveDelayWarning();
        }, delaySeconds * 1000);
    }
    
    showProgressiveDelayWarning(seconds) {
        const warningHtml = `
            <div class="progressive-delay-warning alert alert-warning d-flex align-items-center">
                <i class="fas fa-clock me-2"></i>
                <span>Lütfen <span class="delay-countdown">${seconds}</span> saniye bekleyin...</span>
            </div>
        `;
        
        this.loginForm.insertAdjacentHTML('afterbegin', warningHtml);
        
        // Start countdown
        this.startDelayCountdown(seconds);
    }
    
    startDelayCountdown(seconds) {
        const countdownElement = document.querySelector('.delay-countdown');
        if (!countdownElement) return;
        
        let remaining = seconds;
        const interval = setInterval(() => {
            remaining--;
            if (countdownElement) {
                countdownElement.textContent = remaining;
            }
            
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);
    }
    
    clearProgressiveDelayWarning() {
        const warningElement = document.querySelector('.progressive-delay-warning');
        if (warningElement) {
            warningElement.remove();
        }
    }
    
    lockUser(duration = this.lockoutDuration) {
        this.isLocked = true;
        this.setFormDisabled(true);
        
        const lockoutEnd = Date.now() + duration;
        localStorage.setItem('authLockoutEnd', lockoutEnd.toString());
        
        this.startLockoutTimer(duration);
        this.showLockoutWarning(duration);
    }
    
    startLockoutTimer(duration) {
        this.lockoutTimer = setTimeout(() => {
            this.clearLockout();
        }, duration);
        
        this.updateLockoutDisplay(duration);
    }
    
    updateLockoutDisplay(remainingTime) {
        const minutes = Math.ceil(remainingTime / (60 * 1000));
        const warningElement = document.querySelector('.rate-limit-warning');
        
        if (warningElement) {
            const timerElement = warningElement.querySelector('.rate-limit-timer');
            if (timerElement) {
                timerElement.textContent = `${minutes} dakika`;
            }
        }
        
        if (remainingTime > 0) {
            setTimeout(() => {
                this.updateLockoutDisplay(remainingTime - 1000);
            }, 1000);
        }
    }
    
    showLockoutWarning(duration) {
        const minutes = Math.ceil(duration / (60 * 1000));
        const warningHtml = `
            <div class="rate-limit-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Hesap geçici olarak kilitlendi</strong><br>
                <span class="rate-limit-timer">${minutes} dakika</span> sonra tekrar deneyebilirsiniz.
            </div>
        `;
        
        this.loginForm.insertAdjacentHTML('afterbegin', warningHtml);
    }
    
    clearLockout() {
        this.isLocked = false;
        this.failedAttempts = 0;
        this.setFormDisabled(false);
        
        localStorage.removeItem('authLockoutEnd');
        
        if (this.lockoutTimer) {
            clearTimeout(this.lockoutTimer);
            this.lockoutTimer = null;
        }
        
        const warningElement = document.querySelector('.rate-limit-warning');
        if (warningElement) {
            warningElement.remove();
        }
    }
    
    checkLockoutStatus() {
        const lockoutEnd = localStorage.getItem('authLockoutEnd');
        if (lockoutEnd) {
            const remaining = parseInt(lockoutEnd) - Date.now();
            if (remaining > 0) {
                this.lockUser(remaining);
            } else {
                this.clearLockout();
            }
        }
    }
    
    setFormDisabled(disabled) {
        this.passwordInput.disabled = disabled;
        this.rememberMeCheckbox.disabled = disabled;
        this.loginBtn.disabled = disabled;
        this.passwordToggle.disabled = disabled;
        
        if (disabled) {
            this.loginForm.classList.add('disabled');
        } else {
            this.loginForm.classList.remove('disabled');
        }
    }
    
    setLoadingState(loading) {
        if (loading) {
            this.loginBtn.classList.add('loading');
            this.loginBtn.disabled = true;
            document.querySelector('.auth-container').classList.add('loading');
        } else {
            this.loginBtn.classList.remove('loading');
            this.loginBtn.disabled = this.isLocked;
            document.querySelector('.auth-container').classList.remove('loading');
        }
    }
    
    showToast(message, type = 'info', duration = 5000) {
        const toastId = 'toast-' + Date.now();
        const iconMap = {
            success: 'fa-check-circle',
            danger: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const toastHtml = `
            <div class="toast bg-${type}" role="alert" aria-live="assertive" aria-atomic="true" id="${toastId}">
                <div class="toast-header bg-${type} text-white border-0">
                    <i class="fas ${iconMap[type]} me-2"></i>
                    <strong class="me-auto">POI Yönetim Paneli</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Kapat"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        this.toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            delay: duration
        });
        
        toast.show();
        
        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    // Session timeout management methods
    startSessionMonitoring() {
        // Check session status every 30 seconds
        this.sessionCheckInterval = setInterval(() => {
            this.checkSessionTimeout();
        }, 30000);
    }
    
    stopSessionMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        this.clearSessionWarnings();
    }
    
    async checkSessionTimeout() {
        try {
            const response = await fetch('/auth/status', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                this.handleSessionExpired();
                return;
            }
            
            const data = await response.json();
            
            if (!data.authenticated) {
                this.handleSessionExpired();
                return;
            }
            
            if (data.session_info && data.session_info.expires_at) {
                const expiresAt = new Date(data.session_info.expires_at);
                const now = new Date();
                const timeLeft = expiresAt - now;
                
                // Show warning if less than 10 minutes left
                if (timeLeft < 10 * 60 * 1000 && timeLeft > 0) {
                    this.showSessionTimeoutWarning(timeLeft);
                } else if (timeLeft <= 0) {
                    this.handleSessionExpired();
                } else {
                    this.clearSessionWarnings();
                }
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }
    
    showSessionTimeoutWarning(timeLeft) {
        if (this.sessionWarningShown) {
            // Update existing warning
            this.updateSessionWarning(timeLeft);
            return;
        }
        
        const minutes = Math.ceil(timeLeft / (60 * 1000));
        const warningId = 'session-timeout-warning';
        
        const warningHtml = `
            <div class="alert alert-warning alert-dismissible fade show position-fixed" 
                 id="${warningId}" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 350px;">
                <div class="d-flex align-items-center">
                    <i class="fas fa-clock me-2"></i>
                    <div class="flex-grow-1">
                        <strong>Oturum Uyarısı</strong><br>
                        <span class="session-time-left">Oturumunuz ${minutes} dakika içinde sona erecek.</span>
                    </div>
                </div>
                <div class="mt-2">
                    <button type="button" class="btn btn-sm btn-warning me-2" onclick="authManager.extendSession()">
                        <i class="fas fa-refresh me-1"></i>Oturumu Uzat
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="authManager.dismissSessionWarning()">
                        Kapat
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', warningHtml);
        this.sessionWarningShown = true;
        this.sessionTimeoutWarning = document.getElementById(warningId);
        
        // Auto-dismiss after 30 seconds if no action taken
        this.sessionExtendTimer = setTimeout(() => {
            this.dismissSessionWarning();
        }, 30000);
    }
    
    updateSessionWarning(timeLeft) {
        if (!this.sessionTimeoutWarning) return;
        
        const minutes = Math.ceil(timeLeft / (60 * 1000));
        const timeLeftElement = this.sessionTimeoutWarning.querySelector('.session-time-left');
        
        if (timeLeftElement) {
            if (minutes <= 1) {
                timeLeftElement.innerHTML = `Oturumunuz <strong class="text-danger">${Math.max(0, Math.ceil(timeLeft / 1000))} saniye</strong> içinde sona erecek.`;
                this.sessionTimeoutWarning.classList.remove('alert-warning');
                this.sessionTimeoutWarning.classList.add('alert-danger');
            } else {
                timeLeftElement.textContent = `Oturumunuz ${minutes} dakika içinde sona erecek.`;
            }
        }
    }
    
    async extendSession() {
        try {
            // Make a simple authenticated request to extend session
            const response = await fetch('/auth/status', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (response.ok) {
                this.dismissSessionWarning();
                this.showToast('Oturum başarıyla uzatıldı.', 'success', 3000);
            } else {
                this.showToast('Oturum uzatılamadı. Lütfen yeniden giriş yapın.', 'danger');
                this.handleSessionExpired();
            }
        } catch (error) {
            console.error('Session extend failed:', error);
            this.showToast('Oturum uzatılırken hata oluştu.', 'danger');
        }
    }
    
    dismissSessionWarning() {
        this.clearSessionWarnings();
    }
    
    clearSessionWarnings() {
        if (this.sessionTimeoutWarning) {
            this.sessionTimeoutWarning.remove();
            this.sessionTimeoutWarning = null;
        }
        
        if (this.sessionExtendTimer) {
            clearTimeout(this.sessionExtendTimer);
            this.sessionExtendTimer = null;
        }
        
        this.sessionWarningShown = false;
    }
    
    handleSessionExpired() {
        this.stopSessionMonitoring();
        this.clearSessionWarnings();
        
        this.showToast('Oturum süresi doldu. Yeniden giriş yapılıyor...', 'warning', 3000);
        
        setTimeout(() => {
            window.location.href = '/auth/login';
        }, 2000);
    }
}

// Global auth manager instance
let authManager = null;

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
    
    // Make globally accessible
    window.authManager = authManager;
});

// Export for potential external use
window.AuthManager = AuthManager;