/**
 * API Client - Merkezi API çağrıları ve error handling
 * Requirements: 1.4, 2.5, 3.4
 */

class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultTimeout = 30000; // 30 seconds
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Loading state management
        this.activeRequests = new Set();
        this.loadingCallbacks = new Set();
        
        // Error handlers
        this.errorHandlers = new Map();
        
        // Setup default error handlers
        this.setupDefaultErrorHandlers();
    }

    /**
     * Setup default error handlers
     */
    setupDefaultErrorHandlers() {
        // Network errors
        this.addErrorHandler('NetworkError', (error) => {
            console.error('🌐 Network error:', error);
            this.showNotification('İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edin.', 'error');
            return { retry: true };
        });

        // Authentication errors
        this.addErrorHandler(401, (error) => {
            console.error('🔐 Authentication error:', error);
            this.showNotification('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.', 'error');
            
            // Redirect to login after a delay
            setTimeout(() => {
                window.location.href = '/auth/login';
            }, 2000);
            
            return { retry: false };
        });

        // Authorization errors
        this.addErrorHandler(403, (error) => {
            console.error('🚫 Authorization error:', error);
            this.showNotification('Bu işlem için yetkiniz bulunmuyor.', 'error');
            return { retry: false };
        });

        // Not found errors
        this.addErrorHandler(404, (error) => {
            console.error('🔍 Resource not found:', error);
            this.showNotification('İstenen kaynak bulunamadı.', 'error');
            return { retry: false };
        });

        // Server errors
        this.addErrorHandler(500, (error) => {
            console.error('🔥 Server error:', error);
            
            // Try to extract more detailed error information
            let errorMessage = 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
            
            if (error.data) {
                if (typeof error.data === 'string') {
                    // If response is HTML (login page), user needs to authenticate
                    if (error.data.includes('<title>') && error.data.includes('Giriş')) {
                        errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
                        setTimeout(() => {
                            window.location.href = '/auth/login?next=' + encodeURIComponent(window.location.pathname);
                        }, 2000);
                        return { retry: false };
                    }
                } else if (error.data.error) {
                    errorMessage = error.data.error;
                } else if (error.data.message) {
                    errorMessage = error.data.message;
                }
            }
            
            this.showNotification(errorMessage, 'error');
            return { retry: true };
        });

        // Rate limiting
        this.addErrorHandler(429, (error) => {
            console.error('⏱️ Rate limit exceeded:', error);
            this.showNotification('Çok fazla istek gönderildi. Lütfen biraz bekleyin.', 'warning');
            return { retry: true, delay: 5000 };
        });

        // Validation errors
        this.addErrorHandler('ValidationError', (error) => {
            console.error('✅ Validation error:', error);
            const message = error.details ? 
                Object.values(error.details).flat().join(', ') : 
                'Girilen veriler geçersiz.';
            this.showNotification(message, 'error');
            return { retry: false };
        });
    }

    /**
     * Add error handler for specific error type or status code
     */
    addErrorHandler(errorType, handler) {
        this.errorHandlers.set(errorType, handler);
    }

    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * Add loading state callback
     */
    addLoadingCallback(callback) {
        this.loadingCallbacks.add(callback);
    }

    /**
     * Remove loading state callback
     */
    removeLoadingCallback(callback) {
        this.loadingCallbacks.delete(callback);
    }

    /**
     * Update loading state
     */
    updateLoadingState() {
        const isLoading = this.activeRequests.size > 0;
        this.loadingCallbacks.forEach(callback => {
            try {
                callback(isLoading, this.activeRequests.size);
            } catch (error) {
                console.error('Loading callback error:', error);
            }
        });
    }

    /**
     * Make HTTP request with error handling and retry logic
     */
    async request(url, options = {}) {
        const requestId = this.generateRequestId();
        const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
        
        // Default options
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include',
            redirect: 'manual', // Handle redirects manually
            timeout: this.defaultTimeout
        };

        // Merge options
        const requestOptions = { ...defaultOptions, ...options };
        
        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            try {
                await interceptor(requestOptions);
            } catch (error) {
                console.error('Request interceptor error:', error);
            }
        }

        // Add to active requests
        this.activeRequests.add(requestId);
        this.updateLoadingState();

        let lastError = null;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`🌐 API Request [${requestId}] (attempt ${attempt}/${this.retryAttempts}):`, requestOptions.method, fullURL);
                
                const response = await this.fetchWithTimeout(fullURL, requestOptions);
                
                // Apply response interceptors
                for (const interceptor of this.responseInterceptors) {
                    try {
                        await interceptor(response);
                    } catch (error) {
                        console.error('Response interceptor error:', error);
                    }
                }

                // Handle response
                const result = await this.handleResponse(response, requestId);
                
                // Remove from active requests
                this.activeRequests.delete(requestId);
                this.updateLoadingState();
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`❌ API Request failed [${requestId}] (attempt ${attempt}/${this.retryAttempts}):`, error);
                
                // Handle error and check if retry is needed
                const errorResult = await this.handleError(error, attempt, this.retryAttempts);
                
                if (!errorResult.retry || attempt === this.retryAttempts) {
                    break;
                }
                
                // Wait before retry
                const delay = errorResult.delay || this.retryDelay * attempt;
                console.log(`⏳ Retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }

        // Remove from active requests
        this.activeRequests.delete(requestId);
        this.updateLoadingState();
        
        // Throw the last error if all retries failed
        throw lastError;
    }

    /**
     * Fetch with timeout support
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * Handle HTTP response
     */
    async handleResponse(response, requestId) {
        const contentType = response.headers.get('content-type');
        
        // Handle different content types
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Handle opaque redirects (when redirect: 'manual' is used)
        if (response.status === 0 && response.type === 'opaqueredirect') {
            const error = new Error('Authentication required - opaque redirect detected');
            error.status = 401; // Treat as authentication error
            error.statusText = 'Unauthorized';
            error.data = 'Opaque redirect';
            error.response = response;
            error.isLoginRequired = true;
            throw error;
        }

        // Handle redirects to login page (302 status)
        if (response.status === 302) {
            const location = response.headers.get('location');
            if (location && location.includes('/auth/login')) {
                const error = new Error('Authentication required - redirected to login');
                error.status = 401; // Treat as authentication error
                error.statusText = 'Unauthorized';
                error.data = data;
                error.response = response;
                error.isLoginRequired = true;
                throw error;
            }
        }

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = data;
            error.response = response;
            
            // Special handling for HTML responses (usually login pages or redirects)
            if (typeof data === 'string') {
                if (data.includes('<html>') && (data.includes('Giriş') || data.includes('login'))) {
                    error.isLoginRequired = true;
                    error.message = 'Authentication required';
                } else if (data.includes('Redirecting') && data.includes('/auth/login')) {
                    error.isLoginRequired = true;
                    error.message = 'Authentication required - redirected to login';
                }
            }
            
            throw error;
        }

        console.log(`✅ API Response [${requestId}]:`, response.status, data);
        return data;
    }

    /**
     * Handle API errors
     */
    async handleError(error, attempt, maxAttempts) {
        // Determine error type
        let errorType = 'UnknownError';
        
        if (error.isLoginRequired) {
            errorType = 401; // Treat as authentication error
        } else if (error.status) {
            errorType = error.status;
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = 'NetworkError';
        } else if (error.data && error.data.error && error.data.error.code) {
            errorType = error.data.error.code;
        }

        // Find appropriate error handler
        const handler = this.errorHandlers.get(errorType) || this.errorHandlers.get('UnknownError');
        
        if (handler) {
            try {
                const result = await handler(error, attempt, maxAttempts);
                return result || { retry: false };
            } catch (handlerError) {
                console.error('Error handler failed:', handlerError);
            }
        }

        // Default error handling
        console.error('Unhandled API error:', error);
        this.showNotification('Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.', 'error');
        
        return { retry: attempt < maxAttempts };
    }

    /**
     * GET request
     */
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullURL = queryString ? `${url}?${queryString}` : url;
        
        return this.request(fullURL, {
            method: 'GET'
        });
    }

    /**
     * POST request
     */
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(url) {
        return this.request(url, {
            method: 'DELETE'
        });
    }

    /**
     * Upload file
     */
    async upload(url, formData) {
        return this.request(url, {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set Content-Type for FormData
        });
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Show notification (fallback implementation)
     */
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // Fallback to console and alert for critical errors
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }
    }

    /**
     * Get active requests count
     */
    getActiveRequestsCount() {
        return this.activeRequests.size;
    }

    /**
     * Check if any requests are active
     */
    isLoading() {
        return this.activeRequests.size > 0;
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        // Note: This is a simplified implementation
        // In a real scenario, you'd need to track AbortControllers
        this.activeRequests.clear();
        this.updateLoadingState();
    }
}

/**
 * Toast Notification System
 * Requirements: 1.4, 2.5, 3.4
 */
class ToastNotificationSystem {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.maxToasts = 5;
        this.defaultDuration = 5000;
        
        this.init();
    }

    /**
     * Initialize toast container
     */
    init() {
        // Create toast container if it doesn't exist
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }

        // Add CSS if not already present
        if (!document.getElementById('toast-styles')) {
            this.addToastStyles();
        }
    }

    /**
     * Add toast CSS styles
     */
    addToastStyles() {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            }

            .toast {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 10px;
                padding: 16px;
                min-width: 300px;
                max-width: 400px;
                pointer-events: auto;
                transform: translateX(100%);
                transition: all 0.3s ease;
                border-left: 4px solid #007bff;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .toast.show {
                transform: translateX(0);
            }

            .toast.success {
                border-left-color: #28a745;
            }

            .toast.error {
                border-left-color: #dc3545;
            }

            .toast.warning {
                border-left-color: #ffc107;
            }

            .toast.info {
                border-left-color: #17a2b8;
            }

            .toast-icon {
                font-size: 18px;
                margin-top: 2px;
                flex-shrink: 0;
            }

            .toast.success .toast-icon {
                color: #28a745;
            }

            .toast.error .toast-icon {
                color: #dc3545;
            }

            .toast.warning .toast-icon {
                color: #ffc107;
            }

            .toast.info .toast-icon {
                color: #17a2b8;
            }

            .toast-content {
                flex: 1;
            }

            .toast-title {
                font-weight: 600;
                margin-bottom: 4px;
                color: #333;
            }

            .toast-message {
                color: #666;
                font-size: 14px;
                line-height: 1.4;
            }

            .toast-close {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                margin-left: 8px;
                flex-shrink: 0;
            }

            .toast-close:hover {
                color: #666;
            }

            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 0 0 8px 8px;
                overflow: hidden;
            }

            .toast-progress-bar {
                height: 100%;
                background: currentColor;
                transition: width linear;
                opacity: 0.7;
            }

            @media (max-width: 480px) {
                .toast-container {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                }

                .toast {
                    min-width: auto;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show toast notification
     */
    show(message, type = 'info', options = {}) {
        const toastId = this.generateToastId();
        const duration = options.duration || this.defaultDuration;
        const title = options.title || this.getDefaultTitle(type);
        const persistent = options.persistent || false;

        // Remove oldest toast if we have too many
        if (this.toasts.size >= this.maxToasts) {
            const oldestToast = this.toasts.keys().next().value;
            this.hide(oldestToast);
        }

        // Create toast element
        const toast = this.createToastElement(toastId, message, type, title, persistent);
        
        // Add to container
        this.container.appendChild(toast);
        
        // Store toast reference
        this.toasts.set(toastId, {
            element: toast,
            type,
            message,
            title,
            persistent,
            duration
        });

        // Show toast with animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide if not persistent
        if (!persistent && duration > 0) {
            const progressBar = toast.querySelector('.toast-progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.style.transitionDuration = `${duration}ms`;
            }

            setTimeout(() => {
                this.hide(toastId);
            }, duration);
        }

        return toastId;
    }

    /**
     * Create toast element
     */
    createToastElement(toastId, message, type, title, persistent) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.dataset.toastId = toastId;

        const icon = this.getTypeIcon(type);
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Kapat">
                <i class="fas fa-times"></i>
            </button>
            ${!persistent ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
        `;

        // Add close button listener
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.hide(toastId);
        });

        return toast;
    }

    /**
     * Hide toast
     */
    hide(toastId) {
        const toastData = this.toasts.get(toastId);
        if (!toastData) return;

        const toast = toastData.element;
        toast.classList.remove('show');

        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toastId);
        }, 300);
    }

    /**
     * Hide all toasts
     */
    hideAll() {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.hide(id));
    }

    /**
     * Get type icon
     */
    getTypeIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Get default title for type
     */
    getDefaultTitle(type) {
        const titles = {
            success: 'Başarılı',
            error: 'Hata',
            warning: 'Uyarı',
            info: 'Bilgi'
        };
        return titles[type] || titles.info;
    }

    /**
     * Generate unique toast ID
     */
    generateToastId() {
        return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Loading Indicator System
 */
class LoadingIndicatorSystem {
    constructor() {
        this.overlay = null;
        this.activeLoaders = new Set();
        this.init();
    }

    /**
     * Initialize loading system
     */
    init() {
        this.createOverlay();
        this.addLoadingStyles();
    }

    /**
     * Create loading overlay
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'loading-overlay';
        this.overlay.className = 'loading-overlay';
        this.overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Yükleniyor...</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
    }

    /**
     * Add loading CSS styles
     */
    addLoadingStyles() {
        if (document.getElementById('loading-styles')) return;

        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .loading-overlay.show {
                opacity: 1;
                visibility: visible;
            }

            .loading-spinner {
                text-align: center;
            }

            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }

            .loading-text {
                color: #666;
                font-size: 16px;
                font-weight: 500;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show loading indicator
     */
    show(loaderId = 'default') {
        this.activeLoaders.add(loaderId);
        this.overlay.classList.add('show');
    }

    /**
     * Hide loading indicator
     */
    hide(loaderId = 'default') {
        this.activeLoaders.delete(loaderId);
        
        if (this.activeLoaders.size === 0) {
            this.overlay.classList.remove('show');
        }
    }

    /**
     * Hide all loading indicators
     */
    hideAll() {
        this.activeLoaders.clear();
        this.overlay.classList.remove('show');
    }
}

// Initialize global instances
const apiClient = new APIClient();
const toastSystem = new ToastNotificationSystem();
const loadingSystem = new LoadingIndicatorSystem();

// Setup global loading indicator
apiClient.addLoadingCallback((isLoading, activeCount) => {
    if (isLoading) {
        loadingSystem.show('api');
    } else {
        loadingSystem.hide('api');
    }
});

// Global notification function
window.showNotification = (message, type = 'info', options = {}) => {
    return toastSystem.show(message, type, options);
};

// Global loading functions
window.showLoading = (loaderId) => loadingSystem.show(loaderId);
window.hideLoading = (loaderId) => loadingSystem.hide(loaderId);

// Export for use in other modules
window.APIClient = APIClient;
window.apiClient = apiClient;
window.ToastNotificationSystem = ToastNotificationSystem;
window.LoadingIndicatorSystem = LoadingIndicatorSystem;