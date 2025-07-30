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
 * Performance Monitor
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            renderTimes: [],
            interactionTimes: [],
            memoryUsage: []
        };
        this.isMonitoring = false;
    }

    start() {
        this.isMonitoring = true;
        this.monitorFrameRate();
        this.monitorMemory();
    }

    stop() {
        this.isMonitoring = false;
    }

    /**
     * Monitor frame rate
     */
    monitorFrameRate() {
        if (!this.isMonitoring) return;

        let lastTime = performance.now();
        let frameCount = 0;
        
        const measureFrame = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                if (fps < 50) {
                    console.warn(`Low FPS detected: ${fps}fps`);
                    this.optimizePerformance();
                }
                
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
     * Monitor memory usage
     */
    monitorMemory() {
        if (!performance.memory || !this.isMonitoring) return;

        const checkMemory = () => {
            const memory = performance.memory;
            const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
            
            this.metrics.memoryUsage.push(usedMB);
            
            if (usedMB > 100) {
                console.warn(`High memory usage: ${usedMB}MB`);
            }
            
            if (this.isMonitoring) {
                setTimeout(checkMemory, 5000);
            }
        };
        
        checkMemory();
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
     * Optimize performance when issues detected
     */
    optimizePerformance() {
        // Reduce animation complexity
        document.body.classList.add('performance-mode');
        
        // Disable non-essential animations
        const animations = document.querySelectorAll('.loading__skeleton');
        animations.forEach(el => {
            el.style.animation = 'none';
        });
        
        console.log('Performance mode enabled');
    }

    /**
     * Get performance report
     */
    getReport() {
        return {
            averageRenderTime: this.getAverage(this.metrics.renderTimes.map(r => r.time)),
            averageInteractionTime: this.getAverage(this.metrics.interactionTimes.map(i => i.time)),
            currentMemoryUsage: performance.memory ? 
                Math.round(performance.memory.usedJSHeapSize / 1048576) : 'N/A',
            slowRenders: this.metrics.renderTimes.filter(r => r.time > 16),
            slowInteractions: this.metrics.interactionTimes.filter(i => i.time > 100)
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