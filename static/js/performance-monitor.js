/**
 * Performance Monitor for POI Hover Stability System
 * 
 * Provides comprehensive performance monitoring, memory tracking,
 * and automatic optimization adjustments for the POI recommendation system.
 * 
 * Requirements addressed:
 * - 5.4: Interface degrades gracefully on limited performance
 * - 6.4: Memory usage remains stable over time
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            memoryThreshold: options.memoryThreshold || 50 * 1024 * 1024, // 50MB
            fpsThreshold: options.fpsThreshold || 30,
            cleanupInterval: options.cleanupInterval || 60000, // 1 minute
            monitoringInterval: options.monitoringInterval || 5000, // 5 seconds
            enableLogging: options.enableLogging || false,
            ...options
        };

        // Performance metrics
        this.metrics = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0,
            memoryPeak: 0,
            gcCount: 0,
            longTasks: 0,
            eventLatency: 0,
            renderTime: 0,
            startTime: Date.now()
        };

        // Frame rate monitoring
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.frameTimes = [];
        this.maxFrameTimeHistory = 60; // Keep last 60 frame times

        // Memory monitoring
        this.memoryHistory = [];
        this.maxMemoryHistory = 20; // Keep last 20 memory readings
        this.lastGCTime = Date.now();

        // Performance observers
        this.observers = new Map();
        this.isMonitoring = false;

        // Optimization state
        this.optimizationLevel = 0; // 0 = normal, 1 = reduced, 2 = minimal
        this.lastOptimizationChange = Date.now();

        this.init();
    }

    /**
     * Initialize performance monitoring
     */
    init() {
        this.setupFrameRateMonitoring();
        this.setupMemoryMonitoring();
        this.setupPerformanceObservers();
        this.startMonitoring();
        
        this.log('Performance monitoring initialized');
    }

    /**
     * Setup frame rate monitoring
     */
    setupFrameRateMonitoring() {
        const measureFrameRate = (timestamp) => {
            this.frameCount++;
            const currentTime = timestamp || performance.now();
            
            // Calculate frame time
            const frameTime = currentTime - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            
            // Keep only recent frame times
            if (this.frameTimes.length > this.maxFrameTimeHistory) {
                this.frameTimes.shift();
            }
            
            // Calculate FPS every second
            if (currentTime - this.lastFrameTime >= 1000) {
                this.metrics.fps = this.frameCount;
                this.metrics.frameTime = this.getAverageFrameTime();
                
                this.frameCount = 0;
                this.lastFrameTime = currentTime;
                
                // Check if performance adjustment is needed
                this.checkPerformanceThresholds();
            }
            
            if (this.isMonitoring) {
                requestAnimationFrame(measureFrameRate);
            }
        };
        
        requestAnimationFrame(measureFrameRate);
    }

    /**
     * Setup memory monitoring
     */
    setupMemoryMonitoring() {
        if (!('memory' in performance)) {
            this.log('Memory monitoring not available in this browser');
            return;
        }

        setInterval(() => {
            this.updateMemoryMetrics();
        }, this.options.monitoringInterval);
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics() {
        if (!('memory' in performance)) return;

        const memory = performance.memory;
        const currentUsage = memory.usedJSHeapSize;
        
        this.metrics.memoryUsage = currentUsage;
        this.metrics.memoryPeak = Math.max(this.metrics.memoryPeak, currentUsage);
        
        // Track memory history
        this.memoryHistory.push({
            usage: currentUsage,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        if (this.memoryHistory.length > this.maxMemoryHistory) {
            this.memoryHistory.shift();
        }
        
        // Detect potential memory leaks
        this.detectMemoryLeaks();
        
        // Check if cleanup is needed
        if (currentUsage > this.options.memoryThreshold) {
            this.triggerMemoryCleanup();
        }
    }

    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        if (!('PerformanceObserver' in window)) {
            this.log('PerformanceObserver not available');
            return;
        }

        // Long task observer
        try {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.metrics.longTasks++;
                    
                    if (entry.duration > 50) {
                        this.log(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                        
                        // Trigger performance optimization for very long tasks
                        if (entry.duration > 100) {
                            this.adjustOptimizationLevel(1);
                        }
                    }
                });
            });
            
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.set('longtask', longTaskObserver);
        } catch (error) {
            this.log('Long task monitoring not supported');
        }

        // Measure observer for custom metrics
        try {
            const measureObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.name.startsWith('hover-')) {
                        this.metrics.eventLatency = entry.duration;
                    } else if (entry.name.startsWith('render-')) {
                        this.metrics.renderTime = entry.duration;
                    }
                });
            });
            
            measureObserver.observe({ entryTypes: ['measure'] });
            this.observers.set('measure', measureObserver);
        } catch (error) {
            this.log('Measure monitoring not supported');
        }
    }

    /**
     * Start monitoring
     */
    startMonitoring() {
        this.isMonitoring = true;
        
        // Periodic performance check
        setInterval(() => {
            this.performPeriodicCheck();
        }, this.options.monitoringInterval);
        
        // Periodic cleanup
        setInterval(() => {
            this.performPeriodicCleanup();
        }, this.options.cleanupInterval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        // Disconnect all observers
        this.observers.forEach((observer) => {
            observer.disconnect();
        });
        this.observers.clear();
    }

    /**
     * Get average frame time
     */
    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        
        const sum = this.frameTimes.reduce((a, b) => a + b, 0);
        return sum / this.frameTimes.length;
    }

    /**
     * Check performance thresholds and adjust optimization
     */
    checkPerformanceThresholds() {
        const now = Date.now();
        
        // Don't adjust too frequently
        if (now - this.lastOptimizationChange < 5000) {
            return;
        }

        if (this.metrics.fps < this.options.fpsThreshold) {
            // Poor performance - increase optimization
            this.adjustOptimizationLevel(Math.min(this.optimizationLevel + 1, 2));
        } else if (this.metrics.fps > this.options.fpsThreshold + 20) {
            // Good performance - reduce optimization
            this.adjustOptimizationLevel(Math.max(this.optimizationLevel - 1, 0));
        }
    }

    /**
     * Adjust optimization level
     */
    adjustOptimizationLevel(newLevel) {
        if (newLevel === this.optimizationLevel) return;
        
        const oldLevel = this.optimizationLevel;
        this.optimizationLevel = newLevel;
        this.lastOptimizationChange = Date.now();
        
        this.log(`Optimization level changed: ${oldLevel} -> ${newLevel}`);
        
        // Apply optimizations
        this.applyOptimizations(newLevel);
        
        // Notify other systems
        this.dispatchOptimizationEvent(newLevel, oldLevel);
    }

    /**
     * Apply performance optimizations
     */
    applyOptimizations(level) {
        const body = document.body;
        
        // Remove previous optimization classes
        body.classList.remove('perf-normal', 'perf-reduced', 'perf-minimal');
        
        switch (level) {
            case 0: // Normal performance
                body.classList.add('perf-normal');
                this.enableFullFeatures();
                break;
                
            case 1: // Reduced performance
                body.classList.add('perf-reduced');
                this.enableReducedFeatures();
                break;
                
            case 2: // Minimal performance
                body.classList.add('perf-minimal');
                this.enableMinimalFeatures();
                break;
        }
    }

    /**
     * Enable full features (normal performance)
     */
    enableFullFeatures() {
        // Enable all animations and effects
        this.updateCSSOptimizations(`
            .poi-marker-circle {
                transition: all 0.3s ease;
                will-change: transform, opacity;
            }
            .poi-marker-circle:hover {
                transform: translateZ(0) scale(1.1);
                filter: brightness(1.2);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
        `);
    }

    /**
     * Enable reduced features (reduced performance)
     */
    enableReducedFeatures() {
        // Reduce animation complexity
        this.updateCSSOptimizations(`
            .poi-marker-circle {
                transition: transform 0.2s ease;
                will-change: transform;
            }
            .poi-marker-circle:hover {
                transform: translateZ(0) scale(1.05);
            }
        `);
    }

    /**
     * Enable minimal features (minimal performance)
     */
    enableMinimalFeatures() {
        // Disable most animations
        this.updateCSSOptimizations(`
            .poi-marker-circle {
                transition: none;
                will-change: auto;
            }
            .poi-marker-circle:hover {
                opacity: 0.8;
            }
        `);
    }

    /**
     * Update CSS optimizations
     */
    updateCSSOptimizations(css) {
        let styleElement = document.getElementById('performance-optimizations');
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'performance-optimizations';
            document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = css;
    }

    /**
     * Dispatch optimization event
     */
    dispatchOptimizationEvent(newLevel, oldLevel) {
        const event = new CustomEvent('performanceOptimization', {
            detail: {
                newLevel,
                oldLevel,
                metrics: this.getMetrics()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Detect potential memory leaks
     */
    detectMemoryLeaks() {
        if (this.memoryHistory.length < 5) return;
        
        // Check if memory is consistently increasing
        const recent = this.memoryHistory.slice(-5);
        const isIncreasing = recent.every((entry, index) => {
            return index === 0 || entry.usage >= recent[index - 1].usage;
        });
        
        if (isIncreasing) {
            const increase = recent[recent.length - 1].usage - recent[0].usage;
            const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
            const rate = increase / timeSpan; // bytes per ms
            
            if (rate > 1000) { // More than 1KB per ms increase
                this.log('Potential memory leak detected');
                this.triggerMemoryCleanup();
            }
        }
    }

    /**
     * Trigger memory cleanup
     */
    triggerMemoryCleanup() {
        this.log('Triggering memory cleanup');
        
        // Dispatch cleanup event
        const event = new CustomEvent('memoryCleanup', {
            detail: {
                memoryUsage: this.metrics.memoryUsage,
                threshold: this.options.memoryThreshold
            }
        });
        
        document.dispatchEvent(event);
        
        // Force garbage collection if available (development only)
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
            this.metrics.gcCount++;
        }
    }

    /**
     * Perform periodic check
     */
    performPeriodicCheck() {
        this.updateMemoryMetrics();
        
        // Log metrics if enabled
        if (this.options.enableLogging) {
            this.logMetrics();
        }
    }

    /**
     * Perform periodic cleanup
     */
    performPeriodicCleanup() {
        // Clean up old performance entries
        if ('performance' in window && performance.clearMeasures) {
            performance.clearMeasures();
        }
        
        // Trim history arrays
        if (this.frameTimes.length > this.maxFrameTimeHistory) {
            this.frameTimes = this.frameTimes.slice(-this.maxFrameTimeHistory);
        }
        
        if (this.memoryHistory.length > this.maxMemoryHistory) {
            this.memoryHistory = this.memoryHistory.slice(-this.maxMemoryHistory);
        }
    }

    /**
     * Mark performance measurement start
     */
    markStart(name) {
        if ('performance' in window && performance.mark) {
            performance.mark(`${name}-start`);
        }
    }

    /**
     * Mark performance measurement end and measure
     */
    markEnd(name) {
        if ('performance' in window && performance.mark && performance.measure) {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            optimizationLevel: this.optimizationLevel,
            uptime: Date.now() - this.metrics.startTime,
            memoryUsageFormatted: this.formatBytes(this.metrics.memoryUsage),
            memoryPeakFormatted: this.formatBytes(this.metrics.memoryPeak)
        };
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        const metrics = this.getMetrics();
        const memoryTrend = this.getMemoryTrend();
        
        return {
            metrics,
            memoryTrend,
            recommendations: this.getPerformanceRecommendations(),
            optimizationHistory: this.getOptimizationHistory()
        };
    }

    /**
     * Get memory trend analysis
     */
    getMemoryTrend() {
        if (this.memoryHistory.length < 2) {
            return { trend: 'unknown', rate: 0 };
        }
        
        const first = this.memoryHistory[0];
        const last = this.memoryHistory[this.memoryHistory.length - 1];
        const timeDiff = last.timestamp - first.timestamp;
        const memoryDiff = last.usage - first.usage;
        const rate = memoryDiff / timeDiff; // bytes per ms
        
        let trend = 'stable';
        if (rate > 100) trend = 'increasing';
        else if (rate < -100) trend = 'decreasing';
        
        return { trend, rate: rate * 1000 }; // bytes per second
    }

    /**
     * Get performance recommendations
     */
    getPerformanceRecommendations() {
        const recommendations = [];
        
        if (this.metrics.fps < 30) {
            recommendations.push('Consider reducing animation complexity');
        }
        
        if (this.metrics.memoryUsage > this.options.memoryThreshold) {
            recommendations.push('High memory usage detected - cleanup recommended');
        }
        
        if (this.metrics.longTasks > 10) {
            recommendations.push('Multiple long tasks detected - consider code splitting');
        }
        
        if (this.optimizationLevel > 0) {
            recommendations.push('Performance optimizations are currently active');
        }
        
        return recommendations;
    }

    /**
     * Get optimization history
     */
    getOptimizationHistory() {
        // This would be implemented with a history tracking system
        return {
            currentLevel: this.optimizationLevel,
            lastChange: this.lastOptimizationChange,
            totalChanges: 0 // Would track this in a full implementation
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

    /**
     * Log metrics
     */
    logMetrics() {
        const metrics = this.getMetrics();
        console.log('Performance Metrics:', {
            fps: metrics.fps,
            frameTime: `${metrics.frameTime.toFixed(2)}ms`,
            memory: metrics.memoryUsageFormatted,
            optimizationLevel: metrics.optimizationLevel,
            longTasks: metrics.longTasks
        });
    }

    /**
     * Log message with timestamp
     */
    log(message, data = null) {
        if (this.options.enableLogging) {
            const timestamp = new Date().toISOString();
            if (data) {
                console.log(`[PerformanceMonitor ${timestamp}] ${message}:`, data);
            } else {
                console.log(`[PerformanceMonitor ${timestamp}] ${message}`);
            }
        }
    }

    /**
     * Cleanup and destroy monitor
     */
    destroy() {
        this.stopMonitoring();
        
        // Remove CSS optimizations
        const styleElement = document.getElementById('performance-optimizations');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Remove optimization classes
        document.body.classList.remove('perf-normal', 'perf-reduced', 'perf-minimal');
        
        this.log('Performance monitor destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
} else if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
}