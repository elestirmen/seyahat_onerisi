/**
 * Compatibility Layer
 * Ensures backward compatibility with existing HTML files
 * Requirements: 1.2, 1.3
 */

(function() {
    'use strict';

    // Wait for app to be ready before setting up compatibility
    document.addEventListener('appReady', function() {
        setupCompatibilityLayer();
    });

    function setupCompatibilityLayer() {
        // Ensure global functions exist for legacy code
        
        // Notification compatibility
        if (!window.showNotification && window.notificationSystem) {
            window.showNotification = function(message, type = 'info', options = {}) {
                return window.notificationSystem.show(message, type, options);
            };
        }

        // Loading compatibility
        if (!window.showLoading && window.loadingManager) {
            window.showLoading = function(text) {
                return window.loadingManager.showGlobal(text);
            };
            
            window.hideLoading = function() {
                return window.loadingManager.hideGlobal();
            };
        }

        // Modal compatibility - only if Modal class exists
        if (window.Modal && !window.showModal) {
            window.showModal = function(options) {
                const modal = new Modal(options);
                modal.show();
                return modal;
            };
            
            window.showConfirm = function(message, title = 'Onay') {
                return Modal.confirm({ title, content: message });
            };
            
            window.showAlert = function(message, title = 'Bilgi') {
                return Modal.alert(message, title);
            };
        }

        // Form compatibility - only if FormBuilder exists
        if (window.FormBuilder && !window.createForm) {
            window.createForm = function(container, options) {
                return new FormBuilder(container, options);
            };
        }

        // DOM Utils compatibility
        if (window.DOMUtils) {
            // Ensure common functions are available globally
            window.escapeHtml = window.DOMUtils.escapeHtml;
            window.formatDate = window.DOMUtils.formatDate;
            window.formatNumber = window.DOMUtils.formatNumber;
        }

        // API Client compatibility
        if (window.apiClient && !window.api) {
            window.api = window.apiClient;
        }

        console.log('✅ Compatibility layer initialized');
    }

    // Immediate compatibility for critical functions
    
    // Ensure console methods exist (for older browsers)
    if (!window.console) {
        window.console = {
            log: function() {},
            error: function() {},
            warn: function() {},
            info: function() {}
        };
    }

    // Polyfill for older browsers
    if (!Element.prototype.closest) {
        Element.prototype.closest = function(selector) {
            let element = this;
            while (element && element.nodeType === 1) {
                if (element.matches(selector)) {
                    return element;
                }
                element = element.parentElement;
            }
            return null;
        };
    }

    if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || 
                                   Element.prototype.webkitMatchesSelector;
    }

    // Promise polyfill for very old browsers
    if (!window.Promise) {
        console.warn('Promise not supported, some features may not work');
    }

    // Fetch polyfill check
    if (!window.fetch) {
        console.warn('Fetch not supported, API calls may not work');
    }

})();