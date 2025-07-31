/**
 * Loading States and Performance Utilities
 * Implements skeleton loading, lazy loading, and 60fps animations
 */

class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
        this.observers = new Map();
        this.performanceMonitor = new PerformanceMonitor();
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupPerformanceOptimizations();
    }

    /**
     * Show loading state for a specific element
     */
    showLoading(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const config = {
            type: 'spinner', // 'spinner', 'skeleton', 'dots', 'progress'
            text: 'Loading...',
            size: 'md', // 'sm', 'md', 'lg'
            overlay: false,
            ...options
        };

        this.loadingStates.set(elementId, config);

        if (config.overlay) {
            this.showOverlayLoading(element, config);
        } else {
            this.showInlineLoading(element, config);
        }
    }

    /**
     * Hide loading state
     */
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const config = this.loadingStates.get(elementId);
        if (!config) return;

        if (config.overlay) {
            this.hideOverlayLoading(element);
        } else {
            this.hideInlineLoading(element);
        }

        this.loadingStates.delete(elementId);
    }

    /**
     * Show overlay loading
     */
    showOverlayLoading(element, config) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay active';
        overlay.innerHTML = `
            <div class="loading">
                ${this.getLoadingContent(config)}
            </div>
        `;
        
        element.style.position = 'relative';
        element.appendChild(overlay);
    }

    /**
     * Hide overlay loading
     */
    hideOverlayLoading(element) {
        const overlay = element.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    /**
     * Show inline loading
     */
    showInlineLoading(element, config) {
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        
        element.innerHTML = `
            <div class="loading loading--inline">
                ${this.getLoadingContent(config)}
            </div>
        `;
    }

    /**
     * Hide inline loading
     */
    hideInlineLoading(element) {
        const originalContent = element.dataset.originalContent;
        if (originalContent) {
            element.innerHTML = originalContent;
            delete element.dataset.originalContent;
        }
    }

    /**
     * Get loading content based on type
     */
    getLoadingContent(config) {
        const sizeClass = config.size !== 'md' ? `loading__spinner--${config.size}` : '';
        
        switch (config.type) {
            case 'spinner':
                return `
                    <div class="loading__spinner ${sizeClass}"></div>
                    <p class="loading__text">${config.text}</p>
                `;
            
            case 'dots':
                return `
                    <div class="loading__dots"></div>
                    <p class="loading__text">${config.text}</p>
                `;
            
            case 'progress':
                return `
                    <div class="loading__progress">
                        <div class="loading__progress-bar" style="width: ${config.progress || 0}%"></div>
                    </div>
                    <p class="loading__text">${config.text}</p>
                `;
            
            case 'skeleton':
                return this.getSkeletonContent(config.skeletonType || 'card');
            
            default:
                return `
                    <div class="loading__spinner ${sizeClass}"></div>
                    <p class="loading__text">${config.text}</p>
                `;
        }
    }

    /**
     * Get skeleton content
     */
    getSkeletonContent(type) {
        switch (type) {
            case 'poi-card':
                return `
                    <div class="poi-card-skeleton">
                        <div class="poi-card-skeleton__image loading__skeleton"></div>
                        <div class="poi-card-skeleton__content">
                            <div class="poi-card-skeleton__header">
                                <div class="poi-card-skeleton__title loading__skeleton"></div>
                                <div class="poi-card-skeleton__score loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__description">
                                <div class="skeleton-card__text loading__skeleton"></div>
                                <div class="skeleton-card__text loading__skeleton"></div>
                                <div class="skeleton-card__text loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__meta">
                                <div class="poi-card-skeleton__category loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__ratings">
                                <div class="poi-card-skeleton__rating loading__skeleton"></div>
                                <div class="poi-card-skeleton__rating loading__skeleton"></div>
                                <div class="poi-card-skeleton__rating loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__actions">
                                <div class="poi-card-skeleton__action loading__skeleton"></div>
                                <div class="poi-card-skeleton__action loading__skeleton"></div>
                            </div>
                        </div>
                    </div>
                `;
            
            case 'card':
            default:
                return `
                    <div class="skeleton-card">
                        <div class="skeleton-card__image loading__skeleton"></div>
                        <div class="skeleton-card__content">
                            <div class="skeleton-card__header">
                                <div class="skeleton-card__title loading__skeleton"></div>
                                <div class="skeleton-card__score loading__skeleton"></div>
                            </div>
                            <div class="skeleton-card__text loading__skeleton"></div>
                            <div class="skeleton-card__text loading__skeleton"></div>
                            <div class="skeleton-card__text loading__skeleton"></div>
                            <div class="skeleton-card__meta">
                                <div class="skeleton-card__category loading__skeleton"></div>
                            </div>
                            <div class="skeleton-card__actions">
                                <div class="skeleton-card__action loading__skeleton"></div>
                                <div class="skeleton-card__action loading__skeleton"></div>
                            </div>
                        </div>
                    </div>
                `;
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(elementId, progress) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const progressBar = element.querySelector('.loading__progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }

    /**
     * Setup intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            // Fallback for older browsers
            this.loadAllImages();
            return;
        }

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    imageObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });

        this.observers.set('images', imageObserver);

        // Observe existing lazy images
        this.observeLazyImages();
    }

    /**
     * Observe lazy images
     */
    observeLazyImages() {
        const lazyImages = document.querySelectorAll('img[data-src], .lazy-image');
        const observer = this.observers.get('images');
        
        if (observer) {
            lazyImages.forEach(img => observer.observe(img));
        }
    }

    /**
     * Load image with lazy loading
     */
    loadImage(img) {
        return new Promise((resolve, reject) => {
            const src = img.dataset.src || img.src;
            if (!src) {
                reject(new Error('No image source found'));
                return;
            }

            // Show loading state
            img.classList.add('loading');
            
            const imageLoader = new Image();
            imageLoader.onload = () => {
                // Smooth transition
                requestAnimationFrame(() => {
                    img.src = src;
                    img.classList.remove('loading');
                    img.classList.add('loaded', 'animate-fade-in');
                    
                    // Clean up data attribute
                    if (img.dataset.src) {
                        delete img.dataset.src;
                    }
                    
                    resolve(img);
                });
            };
            
            imageLoader.onerror = () => {
                img.classList.remove('loading');
                img.classList.add('error');
                reject(new Error('Failed to load image'));
            };
            
            imageLoader.src = src;
        });
    }

    /**
     * Load all images (fallback)
     */
    loadAllImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
        });
    }

    /**
     * Setup performance optimizations
     */
    setupPerformanceOptimizations() {
        // Enable GPU acceleration for animated elements
        this.enableGPUAcceleration();
        
        // Setup reduced motion support
        this.setupReducedMotion();
        
        // Setup performance monitoring
        this.performanceMonitor.start();
    }

    /**
     * Enable GPU acceleration
     */
    enableGPUAcceleration() {
        const animatedElements = document.querySelectorAll(
            '.poi-card, .btn, .slider-item, .loading__spinner, .loading__skeleton'
        );
        
        animatedElements.forEach(element => {
            element.classList.add('gpu-accelerated');
        });
    }

    /**
     * Setup reduced motion support
     */
    setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleReducedMotion = (e) => {
            if (e.matches) {
                document.body.classList.add('reduced-motion');
            } else {
                document.body.classList.remove('reduced-motion');
            }
        };
        
        prefersReducedMotion.addListener(handleReducedMotion);
        handleReducedMotion(prefersReducedMotion);
    }

    /**
     * Create skeleton loading for POI list
     */
    createPOISkeletons(count = 3) {
        const skeletons = [];
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'poi-card-skeleton';
            skeleton.innerHTML = this.getSkeletonContent('poi-card');
            skeletons.push(skeleton);
        }
        return skeletons;
    }

    /**
     * Show POI loading skeletons
     */
    showPOISkeletons(containerId, count = 3) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        // Add skeletons
        const skeletons = this.createPOISkeletons(count);
        skeletons.forEach((skeleton, index) => {
            // Stagger the animation
            skeleton.style.animationDelay = `${index * 0.1}s`;
            container.appendChild(skeleton);
        });
    }

    /**
     * Animate element entrance
     */
    animateIn(element, animationType = 'fadeIn', delay = 0) {
        if (!element) return;

        element.style.animationDelay = `${delay}ms`;
        element.classList.add(`animate-${animationType}`);
        
        // Clean up after animation
        element.addEventListener('animationend', () => {
            element.classList.remove(`animate-${animationType}`);
            element.style.animationDelay = '';
        }, { once: true });
    }

    /**
     * Animate list with stagger effect
     */
    animateList(container, animationType = 'fade-in') {
        if (!container) return;

        container.classList.add('animate-stagger');
        
        // Trigger staggered animation
        requestAnimationFrame(() => {
            container.classList.add('active');
        });
    }
}

/**
 * Enhanced Performance Monitor
 * Integrated with UX Enhancement Manager for automatic optimization
 */
class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            fpsThreshold: 50,
            memoryThreshold: 100, // MB
            renderTimeThreshold: 16, // ms (60fps)
            interactionTimeThreshold: 100, // ms
            enableAutoOptimization: true,
            enableDetailedMetrics: true,
            ...options
        };

        this.metrics = {
            renderTimes: [],
            interactionTimes: [],
            memoryUsage: [],
            fpsHistory: [],
            performanceEvents: []
        };

        this.currentFPS = 60;
        this.isMonitoring = false;
        this.optimizationLevel = 0; // 0 = normal, 1 = optimized, 2 = high performance mode
        this.uxManager = null;
        
        // Performance thresholds for automatic optimization
        this.thresholds = {
            fps: {
                good: 55,
                warning: 45,
                critical: 30
            },
            memory: {
                good: 50,
                warning: 100,
                critical: 150
            },
            renderTime: {
                good: 8,
                warning: 16,
                critical: 32
            }
        };

        this.setupUXManagerIntegration();
    }

    setupUXManagerIntegration() {
        // Wait for UX Manager to be available
        const checkUXManager = () => {
            if (window.uxManager) {
                this.uxManager = window.uxManager;
                this.uxManager.addEventListener('uxManagerReady', () => {
                    console.log('📊 Performance Monitor integrated with UX Manager');
                });
            } else {
                setTimeout(checkUXManager, 100);
            }
        };
        checkUXManager();
    }

    start() {
        this.isMonitoring = true;
        this.monitorFrameRate();
        this.monitorMemory();
        this.monitorNetworkPerformance();
        this.setupPerformanceObserver();
        
        console.log('📊 Enhanced Performance Monitor started');
    }

    stop() {
        this.isMonitoring = false;
        console.log('📊 Performance Monitor stopped');
    }

    /**
     * Enhanced frame rate monitoring with automatic optimization
     */
    monitorFrameRate() {
        if (!this.isMonitoring) return;

        let lastTime = performance.now();
        let frameCount = 0;
        let fpsHistory = [];
        
        const measureFrame = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                this.currentFPS = fps;
                
                // Store FPS history for trend analysis
                fpsHistory.push({
                    fps: fps,
                    timestamp: currentTime,
                    optimizationLevel: this.optimizationLevel
                });
                
                // Keep only last 30 seconds of data
                if (fpsHistory.length > 30) {
                    fpsHistory.shift();
                }
                
                this.metrics.fpsHistory = fpsHistory;
                
                // Analyze performance and trigger optimizations
                this.analyzeFPSPerformance(fps);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            if (this.isMonitoring) {
                requestAnimationFrame(measureFrame);
            }
        };
        
        requestAnimationFrame(measureFrame);
    }

    /**
     * Analyze FPS performance and trigger optimizations
     */
    analyzeFPSPerformance(fps) {
        const { good, warning, critical } = this.thresholds.fps;
        
        if (fps <= critical) {
            this.logPerformanceEvent('fps', 'critical', fps);
            if (this.options.enableAutoOptimization) {
                this.triggerOptimization('critical');
            }
        } else if (fps <= warning) {
            this.logPerformanceEvent('fps', 'warning', fps);
            if (this.options.enableAutoOptimization) {
                this.triggerOptimization('warning');
            }
        } else if (fps >= good && this.optimizationLevel > 0) {
            // Performance improved, consider reducing optimization level
            this.considerOptimizationReduction();
        }

        // Notify UX Manager of FPS changes
        if (this.uxManager) {
            this.uxManager.dispatchEvent('performanceFPSUpdate', { 
                fps, 
                level: this.getPerformanceLevel(fps, 'fps') 
            });
        }
    }

    /**
     * Enhanced memory usage monitoring
     */
    monitorMemory() {
        if (!performance.memory || !this.isMonitoring) return;

        const checkMemory = () => {
            const memory = performance.memory;
            const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
            const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
            const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
            
            const memoryData = {
                used: usedMB,
                total: totalMB,
                limit: limitMB,
                percentage: Math.round((usedMB / limitMB) * 100),
                timestamp: performance.now()
            };
            
            this.metrics.memoryUsage.push(memoryData);
            
            // Keep only last 60 measurements (5 minutes at 5-second intervals)
            if (this.metrics.memoryUsage.length > 60) {
                this.metrics.memoryUsage.shift();
            }
            
            // Analyze memory performance
            this.analyzeMemoryPerformance(memoryData);
            
            if (this.isMonitoring) {
                setTimeout(checkMemory, 5000);
            }
        };
        
        checkMemory();
    }

    /**
     * Analyze memory performance and trigger optimizations
     */
    analyzeMemoryPerformance(memoryData) {
        const { good, warning, critical } = this.thresholds.memory;
        const usedMB = memoryData.used;
        
        if (usedMB >= critical) {
            this.logPerformanceEvent('memory', 'critical', usedMB);
            if (this.options.enableAutoOptimization) {
                this.triggerOptimization('critical');
                this.triggerMemoryCleanup();
            }
        } else if (usedMB >= warning) {
            this.logPerformanceEvent('memory', 'warning', usedMB);
            if (this.options.enableAutoOptimization) {
                this.triggerOptimization('warning');
            }
        }

        // Notify UX Manager of memory changes
        if (this.uxManager) {
            this.uxManager.dispatchEvent('performanceMemoryUpdate', { 
                memory: memoryData, 
                level: this.getPerformanceLevel(usedMB, 'memory') 
            });
        }
    }

    /**
     * Monitor network performance
     */
    monitorNetworkPerformance() {
        if (!navigator.connection) return;

        const connection = navigator.connection;
        const networkData = {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };

        // Adjust optimization based on network conditions
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            this.triggerOptimization('network-slow');
        }

        // Listen for network changes
        connection.addEventListener('change', () => {
            const newNetworkData = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };

            if (this.uxManager) {
                this.uxManager.dispatchEvent('performanceNetworkUpdate', { 
                    network: newNetworkData 
                });
            }
        });
    }

    /**
     * Setup Performance Observer for detailed metrics
     */
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            // Observe paint metrics
            const paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.logPerformanceEvent('paint', 'info', {
                        name: entry.name,
                        startTime: entry.startTime
                    });
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });

            // Observe navigation metrics
            const navigationObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.logPerformanceEvent('navigation', 'info', {
                        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                        loadComplete: entry.loadEventEnd - entry.loadEventStart
                    });
                }
            });
            navigationObserver.observe({ entryTypes: ['navigation'] });

            // Observe long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) {
                        this.logPerformanceEvent('longTask', 'warning', {
                            duration: entry.duration,
                            startTime: entry.startTime
                        });
                        
                        if (this.options.enableAutoOptimization) {
                            this.triggerOptimization('longTask');
                        }
                    }
                }
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });

        } catch (error) {
            console.warn('Performance Observer setup failed:', error);
        }
    }

    /**
     * Measure render time
     */
    measureRender(name, renderFn) {
        const start = performance.now();
        const result = renderFn();
        const end = performance.now();
        
        const renderTime = end - start;
        this.metrics.renderTimes.push({ name, time: renderTime });
        
        if (renderTime > 16) {
            console.warn(`Slow render detected: ${name} took ${renderTime.toFixed(2)}ms`);
        }
        
        return result;
    }

    /**
     * Measure interaction time
     */
    measureInteraction(name, interactionFn) {
        return new Promise((resolve) => {
            const start = performance.now();
            
            const result = interactionFn();
            
            if (result instanceof Promise) {
                result.then((value) => {
                    const end = performance.now();
                    const interactionTime = end - start;
                    
                    this.metrics.interactionTimes.push({ name, time: interactionTime });
                    
                    if (interactionTime > 100) {
                        console.warn(`Slow interaction: ${name} took ${interactionTime.toFixed(2)}ms`);
                    }
                    
                    resolve(value);
                });
            } else {
                const end = performance.now();
                const interactionTime = end - start;
                
                this.metrics.interactionTimes.push({ name, time: interactionTime });
                resolve(result);
            }
        });
    }

    /**
     * Trigger performance optimization based on severity
     */
    triggerOptimization(severity) {
        const currentTime = performance.now();
        
        // Prevent too frequent optimizations
        if (this.lastOptimization && currentTime - this.lastOptimization < 5000) {
            return;
        }
        
        this.lastOptimization = currentTime;
        
        switch (severity) {
            case 'critical':
                this.applyHighPerformanceMode();
                break;
            case 'warning':
                this.applyOptimizedMode();
                break;
            case 'network-slow':
                this.applyNetworkOptimizations();
                break;
            case 'longTask':
                this.applyTaskOptimizations();
                break;
        }
        
        this.logPerformanceEvent('optimization', 'info', { 
            severity, 
            level: this.optimizationLevel 
        });
    }

    /**
     * Apply high performance mode (level 2)
     */
    applyHighPerformanceMode() {
        if (this.optimizationLevel >= 2) return;
        
        this.optimizationLevel = 2;
        document.body.classList.add('high-performance-mode');
        
        // Disable all animations
        const style = document.createElement('style');
        style.id = 'performance-optimizations';
        style.textContent = `
            .high-performance-mode * {
                animation-duration: 0.01ms !important;
                animation-delay: 0.01ms !important;
                transition-duration: 0.01ms !important;
                transition-delay: 0.01ms !important;
            }
            
            .high-performance-mode .loading__skeleton {
                animation: none !important;
            }
            
            .high-performance-mode .poi-card {
                transform: none !important;
                box-shadow: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Reduce image quality
        this.reduceImageQuality();
        
        // Disable non-essential features
        this.disableNonEssentialFeatures();
        
        console.log('🚀 High performance mode activated');
    }

    /**
     * Apply optimized mode (level 1)
     */
    applyOptimizedMode() {
        if (this.optimizationLevel >= 1) return;
        
        this.optimizationLevel = 1;
        document.body.classList.add('performance-mode');
        
        // Reduce animation complexity
        const animations = document.querySelectorAll('.loading__skeleton');
        animations.forEach(el => {
            el.style.animationDuration = '2s';
        });
        
        // Reduce shadow complexity
        const cards = document.querySelectorAll('.poi-card');
        cards.forEach(card => {
            card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        
        console.log('⚡ Optimized performance mode activated');
    }

    /**
     * Apply network-specific optimizations
     */
    applyNetworkOptimizations() {
        // Reduce image quality for slow networks
        this.reduceImageQuality();
        
        // Disable auto-loading of media
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            img.classList.add('manual-load');
        });
        
        console.log('📶 Network optimizations applied');
    }

    /**
     * Apply task-specific optimizations for long tasks
     */
    applyTaskOptimizations() {
        // Break up long-running tasks
        if (window.requestIdleCallback) {
            // Use idle time for non-critical operations
            this.scheduleIdleTasks();
        }
        
        // Reduce batch sizes for data processing
        if (window.lazyLoader) {
            window.lazyLoader.options = {
                ...window.lazyLoader.options,
                batchSize: 5,
                delay: 200
            };
        }
    }

    /**
     * Consider reducing optimization level when performance improves
     */
    considerOptimizationReduction() {
        const recentFPS = this.metrics.fpsHistory.slice(-5);
        const avgFPS = recentFPS.reduce((sum, entry) => sum + entry.fps, 0) / recentFPS.length;
        
        if (avgFPS > 55 && this.optimizationLevel > 0) {
            setTimeout(() => {
                this.reduceOptimizationLevel();
            }, 10000); // Wait 10 seconds before reducing optimization
        }
    }

    /**
     * Reduce optimization level
     */
    reduceOptimizationLevel() {
        if (this.optimizationLevel <= 0) return;
        
        this.optimizationLevel--;
        
        if (this.optimizationLevel === 1) {
            document.body.classList.remove('high-performance-mode');
            const perfStyle = document.getElementById('performance-optimizations');
            if (perfStyle) perfStyle.remove();
        } else if (this.optimizationLevel === 0) {
            document.body.classList.remove('performance-mode');
            this.restoreNormalPerformance();
        }
        
        console.log(`📈 Performance optimization reduced to level ${this.optimizationLevel}`);
    }

    /**
     * Restore normal performance settings
     */
    restoreNormalPerformance() {
        // Remove performance classes
        document.body.classList.remove('performance-mode', 'high-performance-mode');
        
        // Remove performance styles
        const perfStyle = document.getElementById('performance-optimizations');
        if (perfStyle) perfStyle.remove();
        
        // Restore image quality
        this.restoreImageQuality();
        
        // Re-enable features
        this.enableNonEssentialFeatures();
    }

    /**
     * Reduce image quality for performance
     */
    reduceImageQuality() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && !img.dataset.originalSrc) {
                img.dataset.originalSrc = img.src;
                // Replace with lower quality version if available
                if (img.src.includes('/poi_media/')) {
                    img.src = img.src.replace('/poi_media/', '/poi_media/previews/');
                }
            }
        });
    }

    /**
     * Restore image quality
     */
    restoreImageQuality() {
        const images = document.querySelectorAll('img[data-original-src]');
        images.forEach(img => {
            if (img.dataset.originalSrc) {
                img.src = img.dataset.originalSrc;
                delete img.dataset.originalSrc;
            }
        });
    }

    /**
     * Disable non-essential features
     */
    disableNonEssentialFeatures() {
        // Disable auto-refresh of data
        if (window.autoRefreshInterval) {
            clearInterval(window.autoRefreshInterval);
        }
        
        // Disable hover effects
        document.body.classList.add('no-hover-effects');
    }

    /**
     * Enable non-essential features
     */
    enableNonEssentialFeatures() {
        document.body.classList.remove('no-hover-effects');
    }

    /**
     * Trigger memory cleanup
     */
    triggerMemoryCleanup() {
        // Clear old metrics
        if (this.metrics.renderTimes.length > 100) {
            this.metrics.renderTimes = this.metrics.renderTimes.slice(-50);
        }
        
        if (this.metrics.interactionTimes.length > 100) {
            this.metrics.interactionTimes = this.metrics.interactionTimes.slice(-50);
        }
        
        // Clear image cache if available
        if (window.mediaCache) {
            const cacheKeys = Object.keys(window.mediaCache);
            if (cacheKeys.length > 20) {
                // Keep only the 10 most recent items
                const recentKeys = cacheKeys.slice(-10);
                const newCache = {};
                recentKeys.forEach(key => {
                    newCache[key] = window.mediaCache[key];
                });
                window.mediaCache = newCache;
            }
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        console.log('🧹 Memory cleanup performed');
    }

    /**
     * Schedule tasks during idle time
     */
    scheduleIdleTasks() {
        const idleTasks = [];
        
        // Add tasks that can be deferred
        idleTasks.push(() => {
            // Preload next batch of images
            this.preloadNextImages();
        });
        
        idleTasks.push(() => {
            // Clean up old performance data
            this.cleanupOldMetrics();
        });
        
        // Schedule tasks
        idleTasks.forEach(task => {
            if (window.requestIdleCallback) {
                window.requestIdleCallback(task, { timeout: 5000 });
            } else {
                setTimeout(task, 100);
            }
        });
    }

    /**
     * Preload next batch of images during idle time
     */
    preloadNextImages() {
        const lazyImages = document.querySelectorAll('img[data-src]:not(.loading)');
        const imagesToPreload = Array.from(lazyImages).slice(0, 3);
        
        imagesToPreload.forEach(img => {
            if (window.loadingManager) {
                window.loadingManager.loadImage(img);
            }
        });
    }

    /**
     * Clean up old metrics during idle time
     */
    cleanupOldMetrics() {
        const maxAge = 5 * 60 * 1000; // 5 minutes
        const now = performance.now();
        
        // Clean up FPS history
        this.metrics.fpsHistory = this.metrics.fpsHistory.filter(
            entry => now - entry.timestamp < maxAge
        );
        
        // Clean up performance events
        this.metrics.performanceEvents = this.metrics.performanceEvents.filter(
            event => now - event.timestamp < maxAge
        );
    }

    /**
     * Log performance events
     */
    logPerformanceEvent(type, level, data) {
        const event = {
            type,
            level,
            data,
            timestamp: performance.now(),
            optimizationLevel: this.optimizationLevel
        };
        
        this.metrics.performanceEvents.push(event);
        
        // Keep only last 100 events
        if (this.metrics.performanceEvents.length > 100) {
            this.metrics.performanceEvents.shift();
        }
        
        // Log to console based on level
        const message = `Performance ${type}: ${JSON.stringify(data)}`;
        switch (level) {
            case 'critical':
                console.error(`🔴 ${message}`);
                break;
            case 'warning':
                console.warn(`🟡 ${message}`);
                break;
            case 'info':
                if (this.options.enableDetailedMetrics) {
                    console.log(`🔵 ${message}`);
                }
                break;
        }
    }

    /**
     * Get performance level for a metric
     */
    getPerformanceLevel(value, metricType) {
        const thresholds = this.thresholds[metricType];
        if (!thresholds) return 'unknown';
        
        if (metricType === 'fps') {
            if (value >= thresholds.good) return 'good';
            if (value >= thresholds.warning) return 'warning';
            return 'critical';
        } else {
            if (value <= thresholds.good) return 'good';
            if (value <= thresholds.warning) return 'warning';
            return 'critical';
        }
    }

    /**
     * Get comprehensive performance report
     */
    getReport() {
        const memoryData = this.metrics.memoryUsage.length > 0 ? 
            this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] : null;
        
        const recentFPS = this.metrics.fpsHistory.slice(-10);
        const avgFPS = recentFPS.length > 0 ? 
            Math.round(recentFPS.reduce((sum, entry) => sum + entry.fps, 0) / recentFPS.length) : 0;

        return {
            // Basic metrics
            currentFPS: this.currentFPS,
            averageFPS: avgFPS,
            averageRenderTime: this.getAverage(this.metrics.renderTimes.map(r => r.time)),
            averageInteractionTime: this.getAverage(this.metrics.interactionTimes.map(i => i.time)),
            
            // Memory metrics
            currentMemoryUsage: memoryData ? memoryData.used : 'N/A',
            memoryPercentage: memoryData ? memoryData.percentage : 'N/A',
            
            // Performance levels
            fpsLevel: this.getPerformanceLevel(this.currentFPS, 'fps'),
            memoryLevel: memoryData ? this.getPerformanceLevel(memoryData.used, 'memory') : 'unknown',
            
            // Optimization status
            optimizationLevel: this.optimizationLevel,
            optimizationActive: this.optimizationLevel > 0,
            
            // Issues
            slowRenders: this.metrics.renderTimes.filter(r => r.time > 16),
            slowInteractions: this.metrics.interactionTimes.filter(i => i.time > 100),
            recentEvents: this.metrics.performanceEvents.slice(-10),
            
            // Trends
            fpsHistory: this.metrics.fpsHistory.slice(-20),
            memoryHistory: this.metrics.memoryUsage.slice(-20),
            
            // Recommendations
            recommendations: this.getPerformanceRecommendations()
        };
    }

    /**
     * Get performance recommendations
     */
    getPerformanceRecommendations() {
        const recommendations = [];
        
        if (this.currentFPS < 45) {
            recommendations.push({
                type: 'fps',
                severity: 'high',
                message: 'Frame rate is low. Consider reducing visual effects.',
                action: 'Enable performance mode'
            });
        }
        
        const memoryData = this.metrics.memoryUsage.length > 0 ? 
            this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] : null;
        
        if (memoryData && memoryData.used > 100) {
            recommendations.push({
                type: 'memory',
                severity: 'high',
                message: 'Memory usage is high. Consider clearing cache.',
                action: 'Trigger memory cleanup'
            });
        }
        
        const slowRenders = this.metrics.renderTimes.filter(r => r.time > 16).length;
        if (slowRenders > 5) {
            recommendations.push({
                type: 'render',
                severity: 'medium',
                message: 'Multiple slow renders detected.',
                action: 'Optimize rendering pipeline'
            });
        }
        
        return recommendations;
    }

    /**
     * Get current performance status
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            currentFPS: this.currentFPS,
            optimizationLevel: this.optimizationLevel,
            performanceMode: this.optimizationLevel > 0 ? 'optimized' : 'normal'
        };
    }

    getAverage(numbers) {
        return numbers.length > 0 ? 
            Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length * 100) / 100 : 0;
    }
}

/**
 * Lazy Loading Utilities
 */
class LazyLoader {
    constructor() {
        this.loadingManager = new LoadingManager();
    }

    /**
     * Lazy load POI data
     */
    async loadPOIData(preferences, options = {}) {
        const config = {
            batchSize: 10,
            delay: 100,
            showProgress: true,
            ...options
        };

        try {
            if (config.showProgress) {
                this.loadingManager.showLoading('recommendationResults', {
                    type: 'progress',
                    text: 'POI verileri yükleniyor...',
                    progress: 0
                });
            }

            // Simulate progressive loading
            const apiBase = window.apiBase || '/api';
            console.log('🔍 LazyLoader using API base:', apiBase);
            const response = await fetch(`${apiBase}/pois`);
            if (!response.ok) throw new Error('Failed to fetch POI data');

            const poisData = await response.json();
            
            if (config.showProgress) {
                this.loadingManager.updateProgress('recommendationResults', 50);
            }

            // Process data in batches for better performance
            const processedData = await this.processPOIDataInBatches(poisData, preferences, config);
            
            if (config.showProgress) {
                this.loadingManager.updateProgress('recommendationResults', 100);
                setTimeout(() => {
                    this.loadingManager.hideLoading('recommendationResults');
                }, 500);
            }

            return processedData;

        } catch (error) {
            this.loadingManager.hideLoading('recommendationResults');
            throw error;
        }
    }

    /**
     * Process POI data in batches
     */
    async processPOIDataInBatches(poisData, preferences, config) {
        // Return the original data structure for compatibility with existing calculateRecommendations function
        return poisData;
    }

    /**
     * Lazy load images for POI cards
     */
    setupImageLazyLoading() {
        // Setup intersection observer for images
        this.loadingManager.observeLazyImages();
        
        // Add loading states to images
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            img.classList.add('lazy-image');
            
            // Add loading placeholder
            if (!img.src) {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
            }
        });
    }
}

// Initialize loading manager
console.log('🚀 Loading performance script started');

try {
    window.loadingManager = new LoadingManager();
    window.lazyLoader = new LazyLoader();
    console.log('✅ Loading manager and lazy loader initialized successfully');
    
    // Dispatch a custom event to notify that loading manager is ready
    window.dispatchEvent(new CustomEvent('loadingManagerReady'));
} catch (error) {
    console.error('❌ Failed to initialize loading manager:', error);
    // Provide fallback objects
    window.loadingManager = {
        showLoading: () => console.warn('Loading manager not available'),
        hideLoading: () => console.warn('Loading manager not available'),
        showPOISkeletons: () => console.warn('Loading manager not available'),
        updateProgress: () => console.warn('Loading manager not available'),
        animateList: () => console.warn('Loading manager not available'),
        performanceMonitor: {
            measureRender: (name, fn) => fn()
        }
    };
    window.lazyLoader = {
        setupImageLazyLoading: () => console.warn('Lazy loader not available'),
        loadPOIData: async (preferences) => {
            // Fallback to regular fetch
            const apiBase = window.apiBase || '/api';
            const response = await fetch(`${apiBase}/pois`);
            if (!response.ok) throw new Error('Failed to fetch POI data');
            return await response.json();
        }
    };
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingManager, PerformanceMonitor, LazyLoader };
}