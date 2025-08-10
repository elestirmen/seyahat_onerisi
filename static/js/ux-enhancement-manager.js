/**
 * UX Enhancement Manager
 * Coordinates all UX improvements and integrates with existing DOM elements
 */

class UXEnhancementManager {
    constructor(options = {}) {
        this.options = {
            enableFeatureFlags: true,
            enablePerformanceMonitoring: true,
            enableSmartNotifications: true,
            enableEnhancedPreferences: true,
            enableMediaViewer: true,
            enableMapEnhancements: true,
            enableMobileOptimizations: true,
            enableAccessibility: true,
            ...options
        };

        this.featureFlags = new Map();
        this.components = new Map();
        this.eventListeners = new Map();
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * Initialize the UX Enhancement Manager
     */
    async init() {
        try {
            console.log('🚀 Initializing UX Enhancement Manager...');
            
            // Setup feature flags
            this.setupFeatureFlags();
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                });
            }
            
            // Initialize core components
            await this.initializeComponents();
            
            // Setup global event handlers
            this.setupGlobalEventHandlers();
            
            // Setup performance monitoring
            if (this.isFeatureEnabled('performanceMonitoring')) {
                this.setupPerformanceMonitoring();
            }
            
            // Setup accessibility enhancements
            if (this.isFeatureEnabled('accessibility')) {
                this.setupAccessibilityEnhancements();
            }
            
            this.isInitialized = true;
            console.log('✅ UX Enhancement Manager initialized successfully');
            
            // Dispatch initialization event
            this.dispatchEvent('uxManagerReady', { manager: this });
            
        } catch (error) {
            console.error('❌ Failed to initialize UX Enhancement Manager:', error);
            throw error;
        }
    }

    /**
     * Setup feature flags system
     */
    setupFeatureFlags() {
        // Default feature flags
        const defaultFlags = {
            enhancedPreferences: this.options.enableEnhancedPreferences,
            smartNotifications: this.options.enableSmartNotifications,
            enhancedMediaViewer: this.options.enableMediaViewer,
            interactiveMapController: this.options.enableMapEnhancements,
            performanceMonitoring: this.options.enablePerformanceMonitoring,
            mobileOptimizations: this.options.enableMobileOptimizations,
            accessibility: this.options.enableAccessibility,
            reducedMotion: false, // Will be set based on user preference
            darkMode: false,
            experimentalFeatures: false
        };

        // Load feature flags from localStorage if available
        try {
            const savedFlags = localStorage.getItem('uxEnhancementFlags');
            if (savedFlags) {
                const parsedFlags = JSON.parse(savedFlags);
                Object.assign(defaultFlags, parsedFlags);
            }
        } catch (error) {
            console.warn('Could not load saved feature flags:', error);
        }

        // Set feature flags
        Object.entries(defaultFlags).forEach(([key, value]) => {
            this.featureFlags.set(key, value);
        });

        // Detect user preferences
        this.detectUserPreferences();
        
        console.log('🏁 Feature flags initialized:', Object.fromEntries(this.featureFlags));
    }

    /**
     * Detect user preferences from system
     */
    detectUserPreferences() {
        // Detect reduced motion preference
        if (window.matchMedia) {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.setFeatureFlag('reducedMotion', prefersReducedMotion.matches);
            
            // Listen for changes
            prefersReducedMotion.addEventListener('change', (e) => {
                this.setFeatureFlag('reducedMotion', e.matches);
                this.applyReducedMotionSettings(e.matches);
            });

            // Detect dark mode preference
            const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
            this.setFeatureFlag('darkMode', prefersDarkMode.matches);
            
            prefersDarkMode.addEventListener('change', (e) => {
                this.setFeatureFlag('darkMode', e.matches);
                this.applyDarkModeSettings(e.matches);
            });
        }

        // Apply initial settings
        this.applyReducedMotionSettings(this.isFeatureEnabled('reducedMotion'));
        this.applyDarkModeSettings(this.isFeatureEnabled('darkMode'));
    }

    /**
     * Initialize core components
     */
    async initializeComponents() {
        const initPromises = [];

        // Initialize components based on feature flags
        if (this.isFeatureEnabled('enhancedPreferences')) {
            initPromises.push(this.initializeEnhancedPreferences());
        }

        if (this.isFeatureEnabled('smartNotifications')) {
            initPromises.push(this.initializeSmartNotifications());
        }

        if (this.isFeatureEnabled('enhancedMediaViewer')) {
            initPromises.push(this.initializeEnhancedMediaViewer());
        }

        if (this.isFeatureEnabled('interactiveMapController')) {
            initPromises.push(this.initializeInteractiveMapController());
        }

        if (this.isFeatureEnabled('mobileOptimizations')) {
            initPromises.push(this.initializeMobileOptimizations());
        }

        // Wait for all components to initialize
        await Promise.allSettled(initPromises);
    }

    /**
     * Initialize Enhanced Preferences component
     */
    async initializeEnhancedPreferences() {
        try {
            // Check if preferences container exists
            const preferencesContainer = document.querySelector('.preferences-section');
            if (!preferencesContainer) {
                console.warn('Preferences container not found, skipping enhanced preferences');
                return;
            }

            // Enhanced preferences will be implemented in later tasks
            console.log('📊 Enhanced Preferences component ready for implementation');
            this.components.set('enhancedPreferences', { status: 'ready' });
            
        } catch (error) {
            console.error('Failed to initialize Enhanced Preferences:', error);
        }
    }

    /**
     * Initialize Smart Notifications component
     */
    async initializeSmartNotifications() {
        try {
            // Smart notifications will be implemented in later tasks
            console.log('🔔 Smart Notifications component ready for implementation');
            this.components.set('smartNotifications', { status: 'ready' });
            
        } catch (error) {
            console.error('Failed to initialize Smart Notifications:', error);
        }
    }

    /**
     * Initialize Enhanced Media Viewer component
     */
    async initializeEnhancedMediaViewer() {
        try {
            // Check if media modal exists
            const mediaModal = document.getElementById('mediaModal');
            if (!mediaModal) {
                console.warn('Media modal not found, skipping enhanced media viewer');
                return;
            }

            // Enhanced media viewer will be implemented in later tasks
            console.log('🖼️ Enhanced Media Viewer component ready for implementation');
            this.components.set('enhancedMediaViewer', { status: 'ready' });
            
        } catch (error) {
            console.error('Failed to initialize Enhanced Media Viewer:', error);
        }
    }

    /**
     * Initialize Interactive Map Controller component
     */
    async initializeInteractiveMapController() {
        try {
            // Wait for map to be available
            const mapContainer = document.getElementById('mapContainer');
            if (!mapContainer) {
                console.warn('Map container not found, skipping interactive map controller');
                return;
            }

            // Interactive map controller will be implemented in later tasks
            console.log('🗺️ Interactive Map Controller component ready for implementation');
            this.components.set('interactiveMapController', { status: 'ready' });
            
        } catch (error) {
            console.error('Failed to initialize Interactive Map Controller:', error);
        }
    }

    /**
     * Initialize Mobile Optimizations
     */
    async initializeMobileOptimizations() {
        try {
            // Check if we're on a mobile device
            const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
            if (!isMobile) {
                console.log('Desktop device detected, skipping mobile optimizations');
                return;
            }

            // Mobile optimizations will be implemented in later tasks
            console.log('📱 Mobile Optimizations component ready for implementation');
            this.components.set('mobileOptimizations', { status: 'ready' });
            
        } catch (error) {
            console.error('Failed to initialize Mobile Optimizations:', error);
        }
    }

    /**
     * Setup global event handlers
     */
    setupGlobalEventHandlers() {
        // Handle window resize
        const resizeHandler = this.debounce(() => {
            this.handleResize();
        }, 250);
        
        window.addEventListener('resize', resizeHandler);
        this.eventListeners.set('resize', resizeHandler);

        // Handle visibility change
        const visibilityHandler = () => {
            this.handleVisibilityChange();
        };
        
        document.addEventListener('visibilitychange', visibilityHandler);
        this.eventListeners.set('visibilitychange', visibilityHandler);

        // Handle orientation change
        const orientationHandler = () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        };
        
        window.addEventListener('orientationchange', orientationHandler);
        this.eventListeners.set('orientationchange', orientationHandler);

        // Handle keyboard shortcuts
        const keyboardHandler = (e) => {
            this.handleKeyboardShortcuts(e);
        };
        
        document.addEventListener('keydown', keyboardHandler);
        this.eventListeners.set('keydown', keyboardHandler);
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Integration with existing LoadingManager performance monitor
        if (window.loadingManager && window.loadingManager.performanceMonitor) {
            this.performanceMonitor = window.loadingManager.performanceMonitor;
            console.log('📊 Performance monitoring integrated with existing LoadingManager');
        } else {
            console.warn('LoadingManager not available, performance monitoring limited');
        }
    }

    /**
     * Setup accessibility enhancements
     */
    setupAccessibilityEnhancements() {
        // Add ARIA labels to interactive elements
        this.enhanceAriaLabels();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Setup focus management
        this.setupFocusManagement();
        
        console.log('♿ Accessibility enhancements applied');
    }

    /**
     * Enhance ARIA labels
     */
    enhanceAriaLabels() {
        // Add ARIA labels to sliders
        const sliders = document.querySelectorAll('.slider');
        sliders.forEach((slider, index) => {
            if (!slider.getAttribute('aria-label')) {
                const category = slider.id || `slider-${index}`;
                slider.setAttribute('aria-label', `${category} tercih seviyesi`);
            }
            
            if (!slider.getAttribute('role')) {
                slider.setAttribute('role', 'slider');
            }
        });

        // Add ARIA labels to buttons
        const buttons = document.querySelectorAll('button:not([aria-label])');
        buttons.forEach(button => {
            const text = button.textContent.trim() || button.innerHTML.replace(/<[^>]*>/g, '').trim();
            if (text && !button.getAttribute('aria-label')) {
                button.setAttribute('aria-label', text);
            }
        });
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        // Ensure all interactive elements are focusable
        const interactiveElements = document.querySelectorAll(
            'button, input, select, textarea, [role="button"], [tabindex]'
        );
        
        interactiveElements.forEach(element => {
            if (!element.hasAttribute('tabindex') && element.tagName !== 'INPUT') {
                element.setAttribute('tabindex', '0');
            }
        });
    }

    /**
     * Setup focus management
     */
    setupFocusManagement() {
        // Add focus indicators
        const style = document.createElement('style');
        style.textContent = `
            .ux-enhanced *:focus {
                outline: 2px solid #4285f4;
                outline-offset: 2px;
            }
            
            .ux-enhanced *:focus:not(:focus-visible) {
                outline: none;
            }
            
            .ux-enhanced *:focus-visible {
                outline: 2px solid #4285f4;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
        
        // Add class to body for enhanced focus styles
        document.body.classList.add('ux-enhanced');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update mobile/desktop classes
        if (width <= 768) {
            document.body.classList.add('mobile-view');
            document.body.classList.remove('desktop-view');
        } else {
            document.body.classList.add('desktop-view');
            document.body.classList.remove('mobile-view');
        }

        // Notify components of resize
        this.dispatchEvent('uxResize', { width, height });
    }

    /**
     * Handle visibility change
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause non-essential operations
            this.dispatchEvent('uxPageHidden');
        } else {
            // Page is visible, resume operations
            this.dispatchEvent('uxPageVisible');
        }
    }

    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        // Invalidate map size if available
        if (window.map && typeof window.map.invalidateSize === 'function') {
            window.map.invalidateSize();
        }

        this.dispatchEvent('uxOrientationChange');
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // ESC key - close modals/overlays
        if (e.key === 'Escape') {
            this.dispatchEvent('uxEscapePressed', { originalEvent: e });
        }

        // Ctrl/Cmd + K - focus search (if available)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.dispatchEvent('uxSearchShortcut', { originalEvent: e });
        }
    }

    /**
     * Apply reduced motion settings
     */
    applyReducedMotionSettings(enabled) {
        if (enabled) {
            document.body.classList.add('reduced-motion');
        } else {
            document.body.classList.remove('reduced-motion');
        }
        
        this.dispatchEvent('uxReducedMotionChanged', { enabled });
    }

    /**
     * Apply dark mode settings
     */
    applyDarkModeSettings(enabled) {
        if (enabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        this.dispatchEvent('uxDarkModeChanged', { enabled });
    }

    /**
     * Feature flag management
     */
    isFeatureEnabled(flagName) {
        return this.featureFlags.get(flagName) === true;
    }

    setFeatureFlag(flagName, value) {
        this.featureFlags.set(flagName, value);
        
        // Save to localStorage
        try {
            const flags = Object.fromEntries(this.featureFlags);
            localStorage.setItem('uxEnhancementFlags', JSON.stringify(flags));
        } catch (error) {
            console.warn('Could not save feature flags:', error);
        }
        
        this.dispatchEvent('uxFeatureFlagChanged', { flagName, value });
    }

    toggleFeatureFlag(flagName) {
        const currentValue = this.isFeatureEnabled(flagName);
        this.setFeatureFlag(flagName, !currentValue);
        return !currentValue;
    }

    /**
     * Component management
     */
    getComponent(name) {
        return this.components.get(name);
    }

    registerComponent(name, component) {
        this.components.set(name, component);
        this.dispatchEvent('uxComponentRegistered', { name, component });
    }

    unregisterComponent(name) {
        const component = this.components.get(name);
        if (component && typeof component.destroy === 'function') {
            component.destroy();
        }
        this.components.delete(name);
        this.dispatchEvent('uxComponentUnregistered', { name });
    }

    /**
     * Event system
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(`ux:${eventName}`, { 
            detail,
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(event);
        return event;
    }

    addEventListener(eventName, handler) {
        document.addEventListener(`ux:${eventName}`, handler);
    }

    removeEventListener(eventName, handler) {
        document.removeEventListener(`ux:${eventName}`, handler);
    }

    /**
     * Utility methods
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach((handler, event) => {
            if (event === 'resize' || event === 'orientationchange') {
                window.removeEventListener(event, handler);
            } else {
                document.removeEventListener(event, handler);
            }
        });

        // Destroy components
        this.components.forEach((component, name) => {
            this.unregisterComponent(name);
        });

        // Clear maps
        this.featureFlags.clear();
        this.components.clear();
        this.eventListeners.clear();

        this.isInitialized = false;
        console.log('🧹 UX Enhancement Manager destroyed');
    }
}

// Auto-initialize if not in module environment
if (typeof module === 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.uxManager = new UXEnhancementManager();
        });
    } else {
        window.uxManager = new UXEnhancementManager();
    }
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UXEnhancementManager;
}