
// Optimized route loading with pagination and caching
class OptimizedRouteLoader {
    constructor() {
        this.cache = new Map();
        this.loadingStates = new Set();
        this.batchSize = 20;
        this.debounceTimeout = null;
    }
    
    // Debounced search to reduce API calls
    debouncedSearch(searchTerm, callback, delay = 300) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            callback(searchTerm);
        }, delay);
    }
    
    // Batch load routes with pagination
    async loadRoutesBatch(page = 0, filters = {}) {
        const cacheKey = JSON.stringify({ page, filters });
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Prevent duplicate requests
        if (this.loadingStates.has(cacheKey)) {
            return null;
        }
        
        this.loadingStates.add(cacheKey);
        
        try {
            const params = new URLSearchParams({
                page: page,
                limit: this.batchSize,
                ...filters
            });
            
            const response = await fetch(`/api/routes?${params}`);
            const data = await response.json();
            
            // Cache the result
            this.cache.set(cacheKey, data);
            
            // Implement cache size limit
            if (this.cache.size > 100) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            return data;
        } catch (error) {
            console.error('Error loading routes:', error);
            return null;
        } finally {
            this.loadingStates.delete(cacheKey);
        }
    }
    
    // Preload next batch for smooth scrolling
    preloadNextBatch(currentPage, filters) {
        setTimeout(() => {
            this.loadRoutesBatch(currentPage + 1, filters);
        }, 100);
    }
    
    // Clear cache when needed
    clearCache() {
        this.cache.clear();
    }
}

// Optimized image loading with lazy loading
class OptimizedImageLoader {
    constructor() {
        this.observer = null;
        this.imageCache = new Map();
        this.initIntersectionObserver();
    }
    
    initIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });
        }
    }
    
    observeImage(img) {
        if (this.observer) {
            this.observer.observe(img);
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadImage(img);
        }
    }
    
    async loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;
        
        // Check cache first
        if (this.imageCache.has(src)) {
            img.src = src;
            img.classList.add('loaded');
            return;
        }
        
        try {
            // Preload image
            const imageLoader = new Image();
            imageLoader.onload = () => {
                img.src = src;
                img.classList.add('loaded');
                this.imageCache.set(src, true);
            };
            imageLoader.onerror = () => {
                img.classList.add('error');
            };
            imageLoader.src = src;
        } catch (error) {
            console.error('Error loading image:', error);
            img.classList.add('error');
        }
    }
}

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            routeLoadTime: [],
            searchTime: [],
            renderTime: []
        };
    }
    
    startTimer(operation) {
        return performance.now();
    }
    
    endTimer(operation, startTime) {
        const duration = performance.now() - startTime;
        if (this.metrics[operation]) {
            this.metrics[operation].push(duration);
            
            // Keep only last 100 measurements
            if (this.metrics[operation].length > 100) {
                this.metrics[operation].shift();
            }
        }
        return duration;
    }
    
    getAverageTime(operation) {
        const times = this.metrics[operation];
        if (!times || times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }
    
    logPerformanceStats() {
        console.log('Performance Stats:', {
            avgRouteLoadTime: this.getAverageTime('routeLoadTime').toFixed(2) + 'ms',
            avgSearchTime: this.getAverageTime('searchTime').toFixed(2) + 'ms',
            avgRenderTime: this.getAverageTime('renderTime').toFixed(2) + 'ms'
        });
    }
}

// Initialize optimized components
const optimizedRouteLoader = new OptimizedRouteLoader();
const optimizedImageLoader = new OptimizedImageLoader();
const performanceMonitor = new PerformanceMonitor();

// Export for global use
window.OptimizedRouteLoader = OptimizedRouteLoader;
window.OptimizedImageLoader = OptimizedImageLoader;
window.PerformanceMonitor = PerformanceMonitor;
