/**
 * Mobile Optimizations for POI Recommendation System
 * Handles mobile-specific interactions, gestures, UI enhancements,
 * viewport-based rendering, performance monitoring, and memory management
 * 
 * Requirements addressed:
 * - 2.3: Mobile touch interactions work properly
 * - 2.4: Interface responds smoothly on mobile
 * - 3.4: POI markers remain clickable on touch devices
 * - 5.2: Touch devices work properly
 * - 5.3: Different screen sizes scale appropriately
 * - 5.4: Interface degrades gracefully on limited performance
 * - 6.4: Memory usage remains stable over time
 */

class MobileOptimizations {
    constructor() {
        this.isTouch = 'ontouchstart' in window;
        this.isMobile = window.innerWidth <= 768;
        this.mapFullscreen = false;
        this.currentView = 'map'; // 'map' or 'list'
        this.filterPanelExpanded = false;
        
        // Performance monitoring
        this.performanceMetrics = {
            renderTime: 0,
            memoryUsage: 0,
            eventCount: 0,
            throttledEvents: 0,
            viewportRenders: 0,
            touchEvents: 0,
            lastCleanup: Date.now()
        };
        
        // Viewport-based rendering
        this.viewportObserver = null;
        this.visibleElements = new Set();
        this.renderQueue = new Set();
        this.isRendering = false;
        
        // Event throttling
        this.throttledEvents = new Map();
        this.eventThrottleDelay = 16; // ~60fps
        
        // Memory management
        this.memoryThreshold = 50 * 1024 * 1024; // 50MB
        this.cleanupInterval = 60000; // 1 minute
        this.memoryCheckInterval = 30000; // 30 seconds
        
        // Touch event handling
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchThreshold = 10; // pixels
        this.tapTimeout = 300; // ms
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFullscreenMap();
        this.setupFilterPanel();
        this.setupFAB();
        this.setupTouchGestures();
        this.setupQuickActions();
        
        // Performance and mobile-specific features
        this.setupViewportBasedRendering();
        this.setupEventThrottling();
        this.setupPerformanceMonitoring();
        this.setupMemoryManagement();
        this.setupTouchEventHandling();
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    }

    onDOMReady() {
        this.optimizeForMobile();
        this.setupResponsiveBreakpoints();
        this.setupLazyLoading();
        this.setupProgressiveEnhancement();
        this.startPerformanceMonitoring();
        this.startMemoryTracking();
    }

    /**
     * Setup viewport-based rendering for better performance
     * Only render elements that are visible or about to be visible
     */
    setupViewportBasedRendering() {
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported, falling back to standard rendering');
            return;
        }

        this.viewportObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                
                if (entry.isIntersecting) {
                    this.visibleElements.add(element);
                    this.queueElementForRendering(element);
                } else {
                    this.visibleElements.delete(element);
                    this.unloadElementResources(element);
                }
            });
            
            this.processRenderQueue();
        }, {
            root: null,
            rootMargin: '50px', // Start loading 50px before element enters viewport
            threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for fine-grained control
        });

        // Observe POI markers and route cards
        this.observeRenderableElements();
    }

    /**
     * Observe elements that should use viewport-based rendering
     */
    observeRenderableElements() {
        const selectors = [
            '.poi-marker-circle',
            '.route-card',
            '.poi-detail-card',
            '.route-media-item',
            '.elevation-chart'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (!element.dataset.viewportObserved) {
                    this.viewportObserver.observe(element);
                    element.dataset.viewportObserved = 'true';
                }
            });
        });
    }

    /**
     * Queue element for rendering
     */
    queueElementForRendering(element) {
        this.renderQueue.add(element);
        this.performanceMetrics.viewportRenders++;
    }

    /**
     * Process render queue with throttling
     */
    processRenderQueue() {
        if (this.isRendering || this.renderQueue.size === 0) {
            return;
        }

        this.isRendering = true;
        const startTime = performance.now();

        requestAnimationFrame(() => {
            const elementsToRender = Array.from(this.renderQueue).slice(0, 5); // Process max 5 elements per frame
            
            elementsToRender.forEach(element => {
                this.renderElement(element);
                this.renderQueue.delete(element);
            });

            const renderTime = performance.now() - startTime;
            this.performanceMetrics.renderTime = (this.performanceMetrics.renderTime + renderTime) / 2; // Moving average

            this.isRendering = false;

            // Continue processing if queue not empty
            if (this.renderQueue.size > 0) {
                setTimeout(() => this.processRenderQueue(), 16); // ~60fps
            }
        });
    }

    /**
     * Render individual element with optimizations
     */
    renderElement(element) {
        try {
            // Enable hardware acceleration for smooth animations
            if (!element.style.willChange) {
                element.style.willChange = 'transform, opacity';
                element.style.transform = 'translateZ(0)';
            }

            // Load high-quality images for visible elements
            const images = element.querySelectorAll('img[data-src]');
            images.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                }
            });

            // Initialize interactive features for visible elements
            if (element.classList.contains('poi-marker-circle')) {
                this.initializePOIMarker(element);
            } else if (element.classList.contains('route-card')) {
                this.initializeRouteCard(element);
            }

        } catch (error) {
            console.warn('Error rendering element:', error, element);
        }
    }

    /**
     * Unload resources for elements outside viewport
     */
    unloadElementResources(element) {
        try {
            // Remove hardware acceleration to save memory
            element.style.willChange = '';
            
            // Replace high-quality images with placeholders
            const images = element.querySelectorAll('img.loaded');
            images.forEach(img => {
                if (img.dataset.placeholder) {
                    img.src = img.dataset.placeholder;
                    img.classList.remove('loaded');
                }
            });

        } catch (error) {
            console.warn('Error unloading element resources:', error, element);
        }
    }

    /**
     * Setup event throttling for better performance
     */
    setupEventThrottling() {
        // Throttle scroll events
        this.throttleEvent('scroll', () => {
            this.handleThrottledScroll();
        });

        // Throttle resize events
        this.throttleEvent('resize', () => {
            this.handleThrottledResize();
        });

        // Throttle mouse move events on mobile
        if (this.isMobile) {
            this.throttleEvent('mousemove', (event) => {
                this.handleThrottledMouseMove(event);
            });
        }
    }

    /**
     * Throttle event with specified delay
     */
    throttleEvent(eventName, handler, delay = this.eventThrottleDelay) {
        let lastCall = 0;
        
        const throttledHandler = (event) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                this.performanceMetrics.eventCount++;
                handler(event);
            } else {
                this.performanceMetrics.throttledEvents++;
            }
        };

        this.throttledEvents.set(eventName, throttledHandler);
        
        if (eventName === 'scroll' || eventName === 'resize') {
            window.addEventListener(eventName, throttledHandler, { passive: true });
        } else {
            document.addEventListener(eventName, throttledHandler, { passive: true });
        }
    }

    /**
     * Handle throttled scroll events
     */
    handleThrottledScroll() {
        // Update viewport-based rendering
        this.observeRenderableElements();
        
        // Hide/show elements based on scroll direction
        const scrollY = window.scrollY;
        const scrollDirection = scrollY > (this.lastScrollY || 0) ? 'down' : 'up';
        this.lastScrollY = scrollY;

        // Optimize UI based on scroll direction
        if (this.isMobile) {
            const header = document.querySelector('.header');
            if (header) {
                if (scrollDirection === 'down' && scrollY > 100) {
                    header.style.transform = 'translateY(-100%)';
                } else {
                    header.style.transform = 'translateY(0)';
                }
            }
        }
    }

    /**
     * Handle throttled resize events
     */
    handleThrottledResize() {
        this.isMobile = window.innerWidth <= 768;
        this.optimizeForMobile();
        this.observeRenderableElements();
    }

    /**
     * Handle throttled mouse move events
     */
    handleThrottledMouseMove(event) {
        // Only process if not on touch device or if mouse is being used
        if (!this.isTouch || event.sourceCapabilities?.firesTouchEvents === false) {
            // Update hover states efficiently
            this.updateHoverStates(event);
        }
    }

    /**
     * Setup enhanced touch event handling
     */
    setupTouchEventHandling() {
        if (!this.isTouch) return;

        // Enhanced touch handling for POI markers
        document.addEventListener('touchstart', (event) => {
            this.handleEnhancedTouchStart(event);
        }, { passive: true });

        document.addEventListener('touchend', (event) => {
            this.handleEnhancedTouchEnd(event);
        }, { passive: false });

        document.addEventListener('touchmove', (event) => {
            this.handleEnhancedTouchMove(event);
        }, { passive: true });

        // Prevent zoom on double tap for better UX
        document.addEventListener('touchend', (event) => {
            this.preventDoubleZoom(event);
        });
    }

    /**
     * Handle enhanced touch start events
     */
    handleEnhancedTouchStart(event) {
        this.performanceMetrics.touchEvents++;
        this.touchStartTime = Date.now();
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.touchStartPos = { x: touch.clientX, y: touch.clientY };
            
            // Add visual feedback for touch
            const target = event.target.closest('.poi-marker-circle, .route-card, .clickable');
            if (target) {
                this.addTouchFeedback(target);
            }
        }
    }

    /**
     * Handle enhanced touch end events
     */
    handleEnhancedTouchEnd(event) {
        const touchDuration = Date.now() - this.touchStartTime;
        
        if (event.changedTouches.length === 1) {
            const touch = event.changedTouches[0];
            const touchEndPos = { x: touch.clientX, y: touch.clientY };
            
            // Calculate touch movement
            const moveDistance = Math.sqrt(
                Math.pow(touchEndPos.x - this.touchStartPos.x, 2) + 
                Math.pow(touchEndPos.y - this.touchStartPos.y, 2)
            );

            // Determine if this is a tap, long press, or swipe
            if (moveDistance < this.touchThreshold) {
                if (touchDuration < this.tapTimeout) {
                    this.handleTap(event, touch);
                } else {
                    this.handleLongPress(event, touch);
                }
            } else {
                this.handleSwipe(event, this.touchStartPos, touchEndPos);
            }
            
            // Remove visual feedback
            const target = event.target.closest('.poi-marker-circle, .route-card, .clickable');
            if (target) {
                this.removeTouchFeedback(target);
            }
        }
    }

    /**
     * Handle enhanced touch move events
     */
    handleEnhancedTouchMove(event) {
        // Prevent default behavior for certain elements to improve scrolling
        const target = event.target.closest('.map-container, .poi-marker-circle');
        if (target && event.touches.length === 1) {
            // Allow native scrolling but prevent interference with map interactions
            return;
        }
    }

    /**
     * Handle tap events with improved accuracy
     */
    handleTap(event, touch) {
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const clickableTarget = target?.closest('.poi-marker-circle, .route-card, .clickable, button, a');
        
        if (clickableTarget) {
            // Prevent ghost clicks
            event.preventDefault();
            
            // Simulate click with proper event properties
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            
            clickableTarget.dispatchEvent(clickEvent);
        }
    }

    /**
     * Handle long press events
     */
    handleLongPress(event, touch) {
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const longPressTarget = target?.closest('.poi-marker-circle, .route-card');
        
        if (longPressTarget) {
            // Trigger context menu or additional options
            const contextEvent = new CustomEvent('longpress', {
                bubbles: true,
                detail: { clientX: touch.clientX, clientY: touch.clientY }
            });
            
            longPressTarget.dispatchEvent(contextEvent);
        }
    }

    /**
     * Add visual feedback for touch interactions
     */
    addTouchFeedback(element) {
        element.classList.add('touch-active');
        
        // Create ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'touch-ripple';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.3s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;
        
        element.style.position = 'relative';
        element.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 300);
    }

    /**
     * Remove visual feedback for touch interactions
     */
    removeTouchFeedback(element) {
        element.classList.remove('touch-active');
    }

    /**
     * Prevent double-tap zoom for better UX
     */
    preventDoubleZoom(event) {
        const now = Date.now();
        const timeSinceLastTap = now - (this.lastTapTime || 0);
        
        if (timeSinceLastTap < 300) {
            event.preventDefault();
        }
        
        this.lastTapTime = now;
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor frame rate
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        
        const monitorFrameRate = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastFrameTime >= 1000) {
                const fps = this.frameCount;
                this.frameCount = 0;
                this.lastFrameTime = currentTime;
                
                // Adjust performance based on FPS
                this.adjustPerformanceSettings(fps);
            }
            
            requestAnimationFrame(monitorFrameRate);
        };
        
        requestAnimationFrame(monitorFrameRate);
    }

    /**
     * Adjust performance settings based on current performance
     */
    adjustPerformanceSettings(fps) {
        if (fps < 30) {
            // Poor performance - reduce quality
            this.eventThrottleDelay = 32; // ~30fps
            this.reduceAnimationQuality();
        } else if (fps > 50) {
            // Good performance - increase quality
            this.eventThrottleDelay = 16; // ~60fps
            this.increaseAnimationQuality();
        }
    }

    /**
     * Reduce animation quality for better performance
     */
    reduceAnimationQuality() {
        document.documentElement.classList.add('reduced-motion');
        
        // Disable expensive CSS effects
        const style = document.createElement('style');
        style.id = 'performance-optimization';
        style.textContent = `
            .reduced-motion * {
                animation-duration: 0.1s !important;
                transition-duration: 0.1s !important;
            }
            .reduced-motion .poi-marker-circle:hover {
                transform: none !important;
                filter: none !important;
            }
        `;
        
        if (!document.getElementById('performance-optimization')) {
            document.head.appendChild(style);
        }
    }

    /**
     * Increase animation quality when performance allows
     */
    increaseAnimationQuality() {
        document.documentElement.classList.remove('reduced-motion');
        
        const perfStyle = document.getElementById('performance-optimization');
        if (perfStyle) {
            perfStyle.remove();
        }
    }

    /**
     * Setup memory management and tracking
     */
    setupMemoryManagement() {
        // Start periodic cleanup
        setInterval(() => {
            this.performMemoryCleanup();
        }, this.cleanupInterval);
        
        // Monitor memory usage if available
        if ('memory' in performance) {
            setInterval(() => {
                this.checkMemoryUsage();
            }, this.memoryCheckInterval);
        }
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Log initial performance metrics
        console.log('Mobile Optimizations Performance Monitoring Started');
        
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.duration > 50) {
                            console.warn('Long task detected:', entry.duration + 'ms');
                        }
                    });
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Long task monitoring not supported');
            }
        }
    }

    /**
     * Start memory tracking
     */
    startMemoryTracking() {
        if ('memory' in performance) {
            this.initialMemory = performance.memory.usedJSHeapSize;
            console.log('Initial memory usage:', this.formatBytes(this.initialMemory));
        }
    }

    /**
     * Check current memory usage
     */
    checkMemoryUsage() {
        if ('memory' in performance) {
            const currentMemory = performance.memory.usedJSHeapSize;
            this.performanceMetrics.memoryUsage = currentMemory;
            
            if (currentMemory > this.memoryThreshold) {
                console.warn('High memory usage detected:', this.formatBytes(currentMemory));
                this.performMemoryCleanup();
            }
        }
    }

    /**
     * Perform memory cleanup
     */
    performMemoryCleanup() {
        try {
            // Clean up viewport observer
            if (this.viewportObserver) {
                // Re-observe only visible elements
                const allObserved = document.querySelectorAll('[data-viewport-observed]');
                allObserved.forEach(element => {
                    if (!this.visibleElements.has(element)) {
                        this.viewportObserver.unobserve(element);
                        element.removeAttribute('data-viewport-observed');
                    }
                });
            }

            // Clear render queue
            this.renderQueue.clear();

            // Clean up throttled events
            this.throttledEvents.forEach((handler, eventName) => {
                // Events are cleaned up automatically by garbage collection
            });

            // Force garbage collection if available (development only)
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
            }

            this.performanceMetrics.lastCleanup = Date.now();
            console.log('Memory cleanup performed');

        } catch (error) {
            console.warn('Error during memory cleanup:', error);
        }
    }

    /**
     * Initialize POI marker with mobile optimizations
     */
    initializePOIMarker(marker) {
        if (marker.dataset.mobileInitialized) return;
        
        // Add touch-friendly hover alternatives
        if (this.isTouch) {
            marker.addEventListener('touchstart', (event) => {
                // Show hover state on touch
                marker.classList.add('touch-hover');
            }, { passive: true });
            
            marker.addEventListener('touchend', (event) => {
                // Remove hover state after delay
                setTimeout(() => {
                    marker.classList.remove('touch-hover');
                }, 1000);
            }, { passive: true });
        }
        
        marker.dataset.mobileInitialized = 'true';
    }

    /**
     * Initialize route card with mobile optimizations
     */
    initializeRouteCard(card) {
        if (card.dataset.mobileInitialized) return;
        
        // Add swipe gestures for route cards
        if (this.isTouch) {
            this.setupCardSwipeGestures(card);
        }
        
        card.dataset.mobileInitialized = 'true';
    }

    /**
     * Setup swipe gestures for route cards
     */
    setupCardSwipeGestures(card) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        card.addEventListener('touchstart', (event) => {
            startX = event.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        card.addEventListener('touchmove', (event) => {
            if (!isDragging) return;
            
            currentX = event.touches[0].clientX;
            const deltaX = currentX - startX;
            
            // Apply transform for visual feedback
            if (Math.abs(deltaX) > 10) {
                card.style.transform = `translateX(${deltaX * 0.3}px)`;
            }
        }, { passive: true });
        
        card.addEventListener('touchend', (event) => {
            if (!isDragging) return;
            
            const deltaX = currentX - startX;
            isDragging = false;
            
            // Reset transform
            card.style.transform = '';
            
            // Handle swipe actions
            if (Math.abs(deltaX) > 100) {
                if (deltaX > 0) {
                    this.handleCardSwipeRight(card);
                } else {
                    this.handleCardSwipeLeft(card);
                }
            }
        }, { passive: true });
    }

    /**
     * Handle card swipe right
     */
    handleCardSwipeRight(card) {
        // Add to favorites or similar action
        const favoriteBtn = card.querySelector('.route-quick-action.favorite');
        if (favoriteBtn) {
            favoriteBtn.click();
        }
    }

    /**
     * Handle card swipe left
     */
    handleCardSwipeLeft(card) {
        // Share or similar action
        const shareBtn = card.querySelector('.route-quick-action.share');
        if (shareBtn) {
            shareBtn.click();
        }
    }

    /**
     * Update hover states efficiently
     */
    updateHoverStates(event) {
        const target = event.target.closest('.poi-marker-circle');
        if (target && !this.isTouch) {
            // Only update if not already in hover state
            if (!target.classList.contains('hover-active')) {
                target.classList.add('hover-active');
                
                // Remove hover state after delay
                setTimeout(() => {
                    target.classList.remove('hover-active');
                }, 2000);
            }
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            visibleElements: this.visibleElements.size,
            renderQueueSize: this.renderQueue.size,
            throttledEventsCount: this.throttledEvents.size,
            memoryUsageFormatted: this.formatBytes(this.performanceMetrics.memoryUsage)
        };
    }

    /**
     * Format bytes for display
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setupLazyLoading() {
        // Intersection Observer for lazy loading images
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const img = entry.target;
                    // Only act on images explicitly marked for lazy loading
                    const src = img.dataset.src;
                    if (src && img.src !== src) {
                        img.src = src;
                        img.classList.add('loaded');
                    }
                    observer.unobserve(img);
                });
            }, { rootMargin: '50px' });

            // Observe only images that opt-in to lazy loading
            const observeImages = () => {
                const images = document.querySelectorAll('img[data-src], .lazy-image');
                images.forEach(img => imageObserver.observe(img));
            };

            // Initial observation
            observeImages();

            // Re-observe when new content is added
            const routesList = document.getElementById('predefinedRoutesList');
            if (routesList) {
                const listObserver = new MutationObserver(observeImages);
                listObserver.observe(routesList, { childList: true, subtree: true });
            }
        }
    }

    setupProgressiveEnhancement() {
        // WebP support detection
        this.detectWebPSupport();
        
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Setup intersection observer for route cards
        this.setupRouteCardObserver();
        
        // Optimize images for mobile
        this.optimizeImagesForMobile();
    }

    detectWebPSupport() {
        const webpCanvas = document.createElement('canvas');
        webpCanvas.width = 1;
        webpCanvas.height = 1;
        
        const supportsWebP = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        
        if (supportsWebP) {
            document.documentElement.classList.add('webp-support');
        } else {
            document.documentElement.classList.add('no-webp');
        }
    }

    preloadCriticalResources() {
        if (this.isMobile) {
            // Load mobile-specific CSS immediately
            const mobileCSS = document.createElement('link');
            mobileCSS.rel = 'stylesheet';
            mobileCSS.href = 'static/css/mobile-enhancements.css';
            mobileCSS.onload = () => {
                console.log('Mobile enhancements CSS loaded');
            };
            mobileCSS.onerror = () => {
                console.warn('Mobile enhancements CSS failed to load');
            };
            document.head.appendChild(mobileCSS);
        }
    }

    setupRouteCardObserver() {
        if ('IntersectionObserver' in window) {
            const cardObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        
                        // Add entrance animation
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(20px)';
                        
                        // Trigger animation
                        requestAnimationFrame(() => {
                            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        });
                        
                        cardObserver.unobserve(card);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '20px'
            });

            // Observe route cards when they're added
            const observeRouteCards = () => {
                const cards = document.querySelectorAll('.route-card:not(.observed)');
                cards.forEach(card => {
                    card.classList.add('observed');
                    cardObserver.observe(card);
                });
            };

            // Initial observation
            setTimeout(observeRouteCards, 100);

            // Re-observe when new cards are added
            const routesList = document.getElementById('predefinedRoutesList');
            if (routesList) {
                const listObserver = new MutationObserver(observeRouteCards);
                listObserver.observe(routesList, { childList: true });
            }
        }
    }

    optimizeImagesForMobile() {
        if (this.isMobile) {
            // Replace high-resolution images with mobile-optimized versions
            const images = document.querySelectorAll('.route-card img');
            images.forEach(img => {
                const originalSrc = img.src;
                if (originalSrc.includes('400x200')) {
                    // Replace with smaller mobile version
                    img.src = originalSrc.replace('400x200', '100x120');
                }
            });
        }
    }

    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.handleResize();
        });

        // Orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
    }

    setupFullscreenMap() {
        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        const mapContainer = document.querySelector('.predefined-map-container');
        
        if (fullscreenBtn && mapContainer) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreenMap(mapContainer);
            });

            // ESC key to exit fullscreen
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.mapFullscreen) {
                    this.exitFullscreenMap(mapContainer);
                }
            });
        }
    }

    toggleFullscreenMap(mapContainer) {
        if (this.mapFullscreen) {
            this.exitFullscreenMap(mapContainer);
        } else {
            this.enterFullscreenMap(mapContainer);
        }
    }

    enterFullscreenMap(mapContainer) {
        mapContainer.classList.add('fullscreen');
        mapContainer.querySelector('.predefined-routes-map').classList.add('fullscreen');
        this.mapFullscreen = true;
        
        // Hide other elements
        document.body.style.overflow = 'hidden';
        
        // Update button icon
        const icon = document.querySelector('#fullscreenMapBtn i');
        if (icon) {
            icon.className = 'fas fa-compress';
        }
    }

    exitFullscreenMap(mapContainer) {
        mapContainer.classList.remove('fullscreen');
        mapContainer.querySelector('.predefined-routes-map').classList.remove('fullscreen');
        this.mapFullscreen = false;
        
        // Restore scrolling
        document.body.style.overflow = '';
        
        // Update button icon
        const icon = document.querySelector('#fullscreenMapBtn i');
        if (icon) {
            icon.className = 'fas fa-expand';
        }
    }

    setupFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        const filterHandle = filterPanel?.querySelector('.mobile-filter-handle');
        const closeBtn = document.getElementById('mobileFilterClose');
        const openBtn = document.getElementById('openFiltersBtn');
        
        if (!filterPanel) return;

        // Handle tap
        filterHandle?.addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Close button
        closeBtn?.addEventListener('click', () => {
            this.closeFilterPanel();
        });

        // Open button
        openBtn?.addEventListener('click', () => {
            this.openFilterPanel();
        });

        // Touch gestures for filter panel
        this.setupFilterPanelGestures(filterPanel);
    }

    setupFilterPanelGestures(filterPanel) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const handle = filterPanel.querySelector('.mobile-filter-handle');
        
        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            filterPanel.style.transition = 'none';
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (this.filterPanelExpanded && deltaY > 0) {
                const translateY = Math.min(deltaY, window.innerHeight * 0.7);
                filterPanel.style.transform = `translateY(${translateY}px)`;
            } else if (!this.filterPanelExpanded && deltaY < 0) {
                const translateY = Math.max(deltaY, -window.innerHeight * 0.7);
                filterPanel.style.transform = `translateY(calc(100% - 60px + ${translateY}px))`;
            }
        }, { passive: true });

        handle.addEventListener('touchend', () => {
            if (!isDragging) return;
            
            const deltaY = currentY - startY;
            const threshold = 50;
            
            filterPanel.style.transition = '';
            
            if (Math.abs(deltaY) > threshold) {
                if (deltaY > 0 && this.filterPanelExpanded) {
                    this.closeFilterPanel();
                } else if (deltaY < 0 && !this.filterPanelExpanded) {
                    this.openFilterPanel();
                }
            } else {
                // Snap back to current state
                if (this.filterPanelExpanded) {
                    filterPanel.style.transform = 'translateY(0)';
                } else {
                    filterPanel.style.transform = 'translateY(calc(100% - 60px))';
                }
            }
            
            isDragging = false;
        }, { passive: true });
    }

    toggleFilterPanel() {
        if (this.filterPanelExpanded) {
            this.closeFilterPanel();
        } else {
            this.openFilterPanel();
        }
    }

    openFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        if (filterPanel) {
            filterPanel.classList.add('expanded');
            this.filterPanelExpanded = true;
        }
    }

    closeFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        if (filterPanel) {
            filterPanel.classList.remove('expanded');
            this.filterPanelExpanded = false;
        }
    }

    setupFAB() {
        const fab = document.getElementById('mapListToggleBtn');
        
        if (fab) {
            fab.addEventListener('click', () => {
                this.toggleMapListView();
            });
        }
    }

    toggleMapListView() {
        const mapView = document.getElementById('mapView');
        const listView = document.getElementById('listView');
        const fab = document.getElementById('mapListToggleBtn');
        
        if (this.currentView === 'map') {
            // Switch to list view
            if (mapView) mapView.style.display = 'none';
            if (listView) listView.style.display = 'block';
            this.currentView = 'list';
            
            // Update FAB icon
            const icon = fab?.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-map';
            }
        } else {
            // Switch to map view
            if (mapView) mapView.style.display = 'block';
            if (listView) listView.style.display = 'none';
            this.currentView = 'map';
            
            // Update FAB icon
            const icon = fab?.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-list';
            }
        }
    }

    setupTouchGestures() {
        const routesList = document.getElementById('predefinedRoutesList');
        
        if (routesList && this.isTouch) {
            this.setupSwipeGestures(routesList);
        }
    }

    setupSwipeGestures(container) {
        let startX = 0;
        let startY = 0;
        let startTime = 0;

        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (!e.changedTouches.length) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const deltaTime = endTime - startTime;
            
            // Check for swipe gesture
            if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
                if (deltaX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            }
        }, { passive: true });
    }

    handleSwipeRight() {
        // Navigate to previous route or action
        // Log removed for cleaner console
    }

    handleSwipeLeft() {
        // Navigate to next route or action
        // Log removed for cleaner console
    }

    setupQuickActions() {
        // Setup route quick action buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.route-quick-action')) {
                const action = e.target.closest('.route-quick-action');
                const routeCard = action.closest('.route-card');
                
                if (action.classList.contains('favorite')) {
                    this.handleFavoriteAction(routeCard);
                } else if (action.classList.contains('navigate')) {
                    this.handleNavigateAction(routeCard);
                } else if (action.classList.contains('share')) {
                    this.handleShareAction(routeCard);
                }
            }
        });
    }

    handleFavoriteAction(routeCard) {
        const favoriteBtn = routeCard.querySelector('.route-quick-action.favorite');
        const icon = favoriteBtn.querySelector('i');
        
        // Toggle favorite state
        if (icon.classList.contains('fas')) {
            icon.className = 'far fa-heart';
            favoriteBtn.style.color = '#666';
        } else {
            icon.className = 'fas fa-heart';
            favoriteBtn.style.color = '#f59e0b';
        }
        
        // Add animation
        favoriteBtn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            favoriteBtn.style.transform = '';
        }, 200);
    }

    handleNavigateAction(routeCard) {
        const routeTitle = routeCard.querySelector('.route-card-title')?.textContent;
        
        // Open in navigation app
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const mapsUrl = `https://www.google.com/maps/dir/${latitude},${longitude}/@${latitude},${longitude},15z`;
                window.open(mapsUrl, '_blank');
            });
        }
    }

    handleShareAction(routeCard) {
        const routeTitle = routeCard.querySelector('.route-card-title')?.textContent;
        
        if (navigator.share) {
            navigator.share({
                title: `${routeTitle} - Kapadokya Rotası`,
                text: `Bu harika rotayı inceleyin: ${routeTitle}`,
                url: window.location.href
            });
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('Link kopyalandı');
            });
        }
    }

    optimizeForMobile() {
        if (!this.isMobile) return;

        // Add mobile class to body
        document.body.classList.add('mobile-optimized');
        
        // Optimize touch targets
        this.optimizeTouchTargets();
        
        // Setup viewport meta tag optimization
        this.optimizeViewport();
    }

    optimizeTouchTargets() {
        const buttons = document.querySelectorAll('button, .clickable, .route-card');
        buttons.forEach(btn => {
            if (btn.offsetHeight < 44) {
                btn.style.minHeight = '44px';
            }
        });
    }

    optimizeViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }

    setupResponsiveBreakpoints() {
        const breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024
        };

        // Set CSS custom properties for breakpoints
        document.documentElement.style.setProperty('--mobile-breakpoint', `${breakpoints.mobile}px`);
        document.documentElement.style.setProperty('--tablet-breakpoint', `${breakpoints.tablet}px`);
        document.documentElement.style.setProperty('--desktop-breakpoint', `${breakpoints.desktop}px`);
    }

    handleResize() {
        // Recalculate layout on resize
        this.optimizeForMobile();
        
        // Close filter panel on desktop
        if (!this.isMobile && this.filterPanelExpanded) {
            this.closeFilterPanel();
        }
    }

    handleOrientationChange() {
        // Handle orientation change
        if (this.mapFullscreen) {
            // Refresh map after orientation change
            const mapContainer = document.querySelector('.predefined-routes-map');
            if (mapContainer && window.predefinedRoutesMap) {
                setTimeout(() => {
                    window.predefinedRoutesMap.invalidateSize();
                }, 200);
            }
        }
    }

    showToast(message, duration = 3000) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'mobile-toast';
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInUp 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutDown 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, duration);
    }
}

// CSS animations for mobile optimizations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
    }
    
    @keyframes ripple {
        from {
            transform: scale(0);
            opacity: 1;
        }
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
    
    /* Touch feedback styles */
    .touch-active {
        background-color: rgba(0, 0, 0, 0.1) !important;
        transform: scale(0.98) !important;
    }
    
    .touch-hover {
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-color: #3b82f6 !important;
    }
    
    .hover-active {
        background-color: rgba(59, 130, 246, 0.05) !important;
        transform: translateZ(0) scale(1.02) !important;
    }
    
    /* Performance optimizations */
    .reduced-motion * {
        animation-duration: 0.1s !important;
        transition-duration: 0.1s !important;
    }
    
    /* Viewport-based rendering optimizations */
    [data-viewport-observed] {
        will-change: transform, opacity;
        transform: translateZ(0);
    }
    
    /* Mobile-specific optimizations */
    @media (max-width: 768px) {
        .poi-marker-circle {
            min-width: 44px !important;
            min-height: 44px !important;
            touch-action: manipulation;
        }
        
        .route-card {
            touch-action: pan-y;
        }
        
        .clickable {
            min-width: 44px !important;
            min-height: 44px !important;
            touch-action: manipulation;
        }
    }
    
    /* Hardware acceleration for smooth animations */
    .poi-marker-circle,
    .route-card,
    .mobile-toast {
        backface-visibility: hidden;
        perspective: 1000px;
    }
`;
document.head.appendChild(style);

// Initialize mobile optimizations
window.mobileOptimizations = new MobileOptimizations();
