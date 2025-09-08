/**
 * Hover Stability Performance Benchmark
 * 
 * Specialized performance benchmarking tool for POI hover stability system.
 * Measures response times, memory usage, CPU utilization, and animation performance.
 * 
 * Requirements addressed:
 * - 5.4: Interface degrades gracefully on limited performance
 * - 6.4: Memory usage remains stable over time
 */

class HoverStabilityPerformanceBenchmark {
    constructor(options = {}) {
        this.options = {
            sampleSize: options.sampleSize || 100,
            warmupRuns: options.warmupRuns || 10,
            enableMemoryTracking: options.enableMemoryTracking !== false,
            enableCPUTracking: options.enableCPUTracking !== false,
            enableAnimationTracking: options.enableAnimationTracking !== false,
            enableLogging: options.enableLogging || false,
            ...options
        };

        // Benchmark results
        this.results = {
            hoverResponseTimes: [],
            clickResponseTimes: [],
            animationFrameTimes: [],
            memorySnapshots: [],
            cpuUsageSnapshots: [],
            eventProcessingTimes: [],
            renderingTimes: []
        };

        // Performance monitoring
        this.performanceObserver = null;
        this.animationFrameId = null;
        this.isRunning = false;
        this.startTime = 0;

        // Test components
        this.hoverManager = null;
        this.testMarkers = [];

        this.log('Hover Stability Performance Benchmark initialized');
    }

    /**
     * Run complete performance benchmark suite
     */
    async runBenchmarkSuite() {
        try {
            this.isRunning = true;
            this.startTime = performance.now();
            
            this.log('Starting performance benchmark suite...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Run benchmarks
            await this.benchmarkHoverResponseTime();
            await this.benchmarkClickResponseTime();
            await this.benchmarkEventProcessingTime();
            await this.benchmarkRenderingPerformance();
            await this.benchmarkMemoryUsage();
            await this.benchmarkAnimationPerformance();
            await this.benchmarkCPUUsage();
            
            // Generate comprehensive report
            const report = this.generateBenchmarkReport();
            
            this.log('Performance benchmark suite completed');
            return report;
            
        } catch (error) {
            this.handleBenchmarkError('runBenchmarkSuite', error);
            throw error;
        } finally {
            this.isRunning = false;
            await this.cleanup();
        }
    }

    /**
     * Initialize components for benchmarking
     */
    async initializeComponents() {
        this.log('Initializing components for benchmarking...');
        
        // Initialize hover manager with optimized settings for benchmarking
        this.hoverManager = new HoverEventManager({
            enableDebugLogging: false, // Disable logging for accurate measurements
            debounceDelay: 50,
            hoverDelay: 25,
            leaveDelay: 75
        });

        // Create test markers
        this.createTestMarkers();
        
        // Setup performance observers
        this.setupPerformanceObservers();
        
        this.log('Components initialized for benchmarking');
    }

    /**
     * Create test markers for benchmarking
     */
    createTestMarkers() {
        const markerCount = Math.min(this.options.sampleSize, 50); // Limit for performance
        
        for (let i = 0; i < markerCount; i++) {
            const marker = document.createElement('div');
            marker.id = `benchmark-marker-${i}`;
            marker.className = 'poi-marker-container benchmark-marker';
            marker.style.cssText = `
                width: 30px;
                height: 30px;
                background: #007bff;
                border-radius: 50%;
                position: absolute;
                top: ${100 + (i % 10) * 40}px;
                left: ${100 + Math.floor(i / 10) * 40}px;
                cursor: pointer;
                will-change: transform, opacity;
                transform: translateZ(0);
            `;
            
            document.body.appendChild(marker);
            this.testMarkers.push(marker);
        }
        
        this.log(`Created ${markerCount} test markers`);
    }

    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        if (!('PerformanceObserver' in window)) {
            this.log('PerformanceObserver not available');
            return;
        }

        try {
            // Measure observer for custom metrics
            this.performanceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.name.startsWith('hover-benchmark-')) {
                        this.results.eventProcessingTimes.push(entry.duration);
                    } else if (entry.name.startsWith('render-benchmark-')) {
                        this.results.renderingTimes.push(entry.duration);
                    }
                });
            });
            
            this.performanceObserver.observe({ entryTypes: ['measure'] });
            
        } catch (error) {
            this.log('Performance observer setup failed:', error);
        }
    }

    /**
     * Benchmark hover response time
     */
    async benchmarkHoverResponseTime() {
        this.log('Benchmarking hover response time...');
        
        const responseTimes = [];
        
        // Warmup runs
        for (let i = 0; i < this.options.warmupRuns; i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            await this.measureHoverResponse(marker);
        }
        
        // Actual benchmark runs
        for (let i = 0; i < this.options.sampleSize; i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            const responseTime = await this.measureHoverResponse(marker);
            
            if (responseTime > 0) {
                responseTimes.push(responseTime);
            }
            
            // Small delay between measurements
            await this.wait(10);
        }
        
        this.results.hoverResponseTimes = responseTimes;
        
        const stats = this.calculateStatistics(responseTimes);
        this.log(`Hover response time benchmark completed: avg=${stats.average.toFixed(2)}ms, min=${stats.min.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms`);
    }

    /**
     * Measure individual hover response time
     */
    async measureHoverResponse(marker) {
        return new Promise((resolve) => {
            let startTime = 0;
            let endTime = 0;
            
            const cleanup = () => {
                this.hoverManager.detachHoverEvents(marker);
            };
            
            this.hoverManager.attachHoverEvents(marker, {
                onHoverStart: () => {
                    endTime = performance.now();
                    cleanup();
                    resolve(endTime - startTime);
                }
            });
            
            startTime = performance.now();
            
            // Simulate hover
            const event = new MouseEvent('mouseenter', {
                bubbles: true,
                cancelable: true,
                clientX: parseInt(marker.style.left) + 15,
                clientY: parseInt(marker.style.top) + 15
            });
            
            marker.dispatchEvent(event);
            
            // Timeout fallback
            setTimeout(() => {
                cleanup();
                resolve(0);
            }, 1000);
        });
    }

    /**
     * Benchmark click response time
     */
    async benchmarkClickResponseTime() {
        this.log('Benchmarking click response time...');
        
        const responseTimes = [];
        
        for (let i = 0; i < this.options.sampleSize; i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            const responseTime = await this.measureClickResponse(marker);
            
            if (responseTime > 0) {
                responseTimes.push(responseTime);
            }
            
            await this.wait(10);
        }
        
        this.results.clickResponseTimes = responseTimes;
        
        const stats = this.calculateStatistics(responseTimes);
        this.log(`Click response time benchmark completed: avg=${stats.average.toFixed(2)}ms`);
    }

    /**
     * Measure individual click response time
     */
    async measureClickResponse(marker) {
        return new Promise((resolve) => {
            let startTime = 0;
            let endTime = 0;
            
            const cleanup = () => {
                this.hoverManager.detachHoverEvents(marker);
            };
            
            this.hoverManager.attachHoverEvents(marker, {
                onClick: () => {
                    endTime = performance.now();
                    cleanup();
                    resolve(endTime - startTime);
                }
            });
            
            startTime = performance.now();
            
            // Simulate click
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: parseInt(marker.style.left) + 15,
                clientY: parseInt(marker.style.top) + 15
            });
            
            marker.dispatchEvent(event);
            
            // Timeout fallback
            setTimeout(() => {
                cleanup();
                resolve(0);
            }, 1000);
        });
    }

    /**
     * Benchmark event processing time
     */
    async benchmarkEventProcessingTime() {
        this.log('Benchmarking event processing time...');
        
        const marker = this.testMarkers[0];
        
        for (let i = 0; i < this.options.sampleSize; i++) {
            performance.mark(`hover-benchmark-${i}-start`);
            
            // Simulate rapid events
            const events = ['mouseenter', 'mouseleave', 'mouseenter', 'mouseleave'];
            
            for (const eventType of events) {
                const event = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true
                });
                
                marker.dispatchEvent(event);
            }
            
            performance.mark(`hover-benchmark-${i}-end`);
            performance.measure(`hover-benchmark-${i}`, `hover-benchmark-${i}-start`, `hover-benchmark-${i}-end`);
            
            await this.wait(5);
        }
        
        this.log('Event processing time benchmark completed');
    }

    /**
     * Benchmark rendering performance
     */
    async benchmarkRenderingPerformance() {
        if (!this.options.enableAnimationTracking) {
            this.log('Animation tracking disabled, skipping rendering benchmark');
            return;
        }
        
        this.log('Benchmarking rendering performance...');
        
        const frameTimes = [];
        let frameCount = 0;
        let lastFrameTime = performance.now();
        
        const measureFrame = (timestamp) => {
            const frameTime = timestamp - lastFrameTime;
            frameTimes.push(frameTime);
            lastFrameTime = timestamp;
            frameCount++;
            
            // Trigger hover animations during measurement
            if (frameCount % 10 === 0) {
                const marker = this.testMarkers[frameCount % this.testMarkers.length];
                marker.style.transform = `translateZ(0) scale(${1 + Math.sin(frameCount * 0.1) * 0.1})`;
            }
            
            if (frameCount < this.options.sampleSize) {
                this.animationFrameId = requestAnimationFrame(measureFrame);
            } else {
                this.results.animationFrameTimes = frameTimes;
                
                const stats = this.calculateStatistics(frameTimes);
                this.log(`Rendering performance benchmark completed: avg=${stats.average.toFixed(2)}ms per frame`);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(measureFrame);
        
        // Wait for completion
        await new Promise(resolve => {
            const checkCompletion = () => {
                if (frameCount >= this.options.sampleSize) {
                    resolve();
                } else {
                    setTimeout(checkCompletion, 100);
                }
            };
            checkCompletion();
        });
    }

    /**
     * Benchmark memory usage
     */
    async benchmarkMemoryUsage() {
        if (!this.options.enableMemoryTracking || !('memory' in performance)) {
            this.log('Memory tracking not available, skipping memory benchmark');
            return;
        }
        
        this.log('Benchmarking memory usage...');
        
        const initialMemory = performance.memory.usedJSHeapSize;
        this.results.memorySnapshots.push({
            timestamp: Date.now(),
            usage: initialMemory,
            phase: 'initial'
        });
        
        // Create many hover interactions to stress test memory
        for (let i = 0; i < 50; i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            
            // Attach and detach events multiple times
            for (let j = 0; j < 10; j++) {
                this.hoverManager.attachHoverEvents(marker, {
                    onHoverStart: () => {},
                    onHoverEnd: () => {},
                    onClick: () => {}
                });
                
                // Simulate events
                marker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                marker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                
                this.hoverManager.detachHoverEvents(marker);
            }
            
            // Take memory snapshot every 10 iterations
            if (i % 10 === 0) {
                this.results.memorySnapshots.push({
                    timestamp: Date.now(),
                    usage: performance.memory.usedJSHeapSize,
                    phase: `iteration-${i}`
                });
            }
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        await this.wait(1000); // Wait for cleanup
        
        const finalMemory = performance.memory.usedJSHeapSize;
        this.results.memorySnapshots.push({
            timestamp: Date.now(),
            usage: finalMemory,
            phase: 'final'
        });
        
        const memoryIncrease = finalMemory - initialMemory;
        this.log(`Memory usage benchmark completed: increase=${this.formatBytes(memoryIncrease)}`);
    }

    /**
     * Benchmark animation performance
     */
    async benchmarkAnimationPerformance() {
        if (!this.options.enableAnimationTracking) {
            this.log('Animation tracking disabled, skipping animation benchmark');
            return;
        }
        
        this.log('Benchmarking animation performance...');
        
        const animationTimes = [];
        
        for (let i = 0; i < Math.min(this.options.sampleSize, 20); i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            const animationTime = await this.measureAnimationPerformance(marker);
            
            if (animationTime > 0) {
                animationTimes.push(animationTime);
            }
        }
        
        const stats = this.calculateStatistics(animationTimes);
        this.log(`Animation performance benchmark completed: avg=${stats.average.toFixed(2)}ms`);
    }

    /**
     * Measure animation performance for a single marker
     */
    async measureAnimationPerformance(marker) {
        return new Promise((resolve) => {
            const startTime = performance.now();
            let animationCompleted = false;
            
            // Apply hover animation
            marker.style.transition = 'transform 0.2s ease';
            marker.style.transform = 'translateZ(0) scale(1.1)';
            
            // Listen for transition end
            const handleTransitionEnd = () => {
                if (!animationCompleted) {
                    animationCompleted = true;
                    const endTime = performance.now();
                    marker.removeEventListener('transitionend', handleTransitionEnd);
                    
                    // Reset marker
                    marker.style.transform = 'translateZ(0) scale(1)';
                    
                    resolve(endTime - startTime);
                }
            };
            
            marker.addEventListener('transitionend', handleTransitionEnd);
            
            // Timeout fallback
            setTimeout(() => {
                if (!animationCompleted) {
                    animationCompleted = true;
                    marker.removeEventListener('transitionend', handleTransitionEnd);
                    marker.style.transform = 'translateZ(0) scale(1)';
                    resolve(0);
                }
            }, 1000);
        });
    }

    /**
     * Benchmark CPU usage (simplified estimation)
     */
    async benchmarkCPUUsage() {
        if (!this.options.enableCPUTracking) {
            this.log('CPU tracking disabled, skipping CPU benchmark');
            return;
        }
        
        this.log('Benchmarking CPU usage...');
        
        const cpuSamples = [];
        const sampleCount = 10;
        
        for (let i = 0; i < sampleCount; i++) {
            const cpuUsage = await this.estimateCPUUsage();
            cpuSamples.push(cpuUsage);
            
            // Perform intensive hover operations
            await this.performIntensiveHoverOperations();
            
            await this.wait(100);
        }
        
        this.results.cpuUsageSnapshots = cpuSamples;
        
        const stats = this.calculateStatistics(cpuSamples);
        this.log(`CPU usage benchmark completed: avg=${stats.average.toFixed(2)}% estimated`);
    }

    /**
     * Estimate CPU usage (simplified method)
     */
    async estimateCPUUsage() {
        const iterations = 100000;
        const startTime = performance.now();
        
        // Perform CPU-intensive task
        let result = 0;
        for (let i = 0; i < iterations; i++) {
            result += Math.sin(i) * Math.cos(i);
        }
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Estimate CPU usage based on execution time
        // This is a rough approximation
        const baselineTime = 10; // Expected time for this operation on a fast CPU
        const cpuUsage = Math.min((executionTime / baselineTime) * 100, 100);
        
        return cpuUsage;
    }

    /**
     * Perform intensive hover operations for CPU testing
     */
    async performIntensiveHoverOperations() {
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
            const marker = this.testMarkers[i % this.testMarkers.length];
            
            promises.push(new Promise(resolve => {
                this.hoverManager.attachHoverEvents(marker, {
                    onHoverStart: () => resolve(),
                    onHoverEnd: () => {},
                    onClick: () => {}
                });
                
                // Simulate rapid hover events
                marker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                
                setTimeout(() => {
                    this.hoverManager.detachHoverEvents(marker);
                    resolve();
                }, 50);
            }));
        }
        
        await Promise.all(promises);
    }

    /**
     * Calculate statistics for an array of numbers
     */
    calculateStatistics(values) {
        if (values.length === 0) {
            return { average: 0, min: 0, max: 0, median: 0, stdDev: 0 };
        }
        
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const average = sum / values.length;
        
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            average,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted[Math.floor(sorted.length / 2)],
            stdDev,
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    /**
     * Generate comprehensive benchmark report
     */
    generateBenchmarkReport() {
        const report = {
            summary: {
                totalDuration: performance.now() - this.startTime,
                sampleSize: this.options.sampleSize,
                timestamp: new Date().toISOString()
            },
            hoverPerformance: {
                responseTime: this.calculateStatistics(this.results.hoverResponseTimes),
                sampleCount: this.results.hoverResponseTimes.length
            },
            clickPerformance: {
                responseTime: this.calculateStatistics(this.results.clickResponseTimes),
                sampleCount: this.results.clickResponseTimes.length
            },
            eventProcessing: {
                processingTime: this.calculateStatistics(this.results.eventProcessingTimes),
                sampleCount: this.results.eventProcessingTimes.length
            },
            rendering: {
                frameTime: this.calculateStatistics(this.results.animationFrameTimes),
                sampleCount: this.results.animationFrameTimes.length
            },
            memory: {
                snapshots: this.results.memorySnapshots,
                analysis: this.analyzeMemoryUsage()
            },
            cpu: {
                usage: this.calculateStatistics(this.results.cpuUsageSnapshots),
                sampleCount: this.results.cpuUsageSnapshots.length
            },
            recommendations: this.generatePerformanceRecommendations()
        };
        
        return report;
    }

    /**
     * Analyze memory usage patterns
     */
    analyzeMemoryUsage() {
        if (this.results.memorySnapshots.length < 2) {
            return { trend: 'insufficient_data' };
        }
        
        const initial = this.results.memorySnapshots[0].usage;
        const final = this.results.memorySnapshots[this.results.memorySnapshots.length - 1].usage;
        const peak = Math.max(...this.results.memorySnapshots.map(s => s.usage));
        
        const totalIncrease = final - initial;
        const peakIncrease = peak - initial;
        
        return {
            initialUsage: this.formatBytes(initial),
            finalUsage: this.formatBytes(final),
            peakUsage: this.formatBytes(peak),
            totalIncrease: this.formatBytes(totalIncrease),
            peakIncrease: this.formatBytes(peakIncrease),
            trend: totalIncrease > 1024 * 1024 ? 'increasing' : 'stable' // 1MB threshold
        };
    }

    /**
     * Generate performance recommendations
     */
    generatePerformanceRecommendations() {
        const recommendations = [];
        
        // Check hover response time
        const hoverStats = this.calculateStatistics(this.results.hoverResponseTimes);
        if (hoverStats.average > 100) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                metric: 'hover_response_time',
                value: hoverStats.average,
                threshold: 100,
                message: 'Hover response time is slow. Consider reducing debounce delays or optimizing event handlers.'
            });
        }
        
        // Check animation performance
        const frameStats = this.calculateStatistics(this.results.animationFrameTimes);
        if (frameStats.average > 16.67) { // 60fps threshold
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                metric: 'frame_time',
                value: frameStats.average,
                threshold: 16.67,
                message: 'Animation frame time is high. Consider using hardware acceleration or reducing animation complexity.'
            });
        }
        
        // Check memory usage
        const memoryAnalysis = this.analyzeMemoryUsage();
        if (memoryAnalysis.trend === 'increasing') {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                metric: 'memory_usage',
                message: 'Memory usage is increasing. Check for memory leaks in event listeners or hover state management.'
            });
        }
        
        return recommendations;
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
     * Wait for specified milliseconds
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Handle benchmark errors
     */
    handleBenchmarkError(context, error) {
        this.log(`Benchmark error in ${context}: ${error.message}`, error);
    }

    /**
     * Clean up benchmark resources
     */
    async cleanup() {
        try {
            // Cancel animation frame
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            
            // Disconnect performance observer
            if (this.performanceObserver) {
                this.performanceObserver.disconnect();
            }
            
            // Remove test markers
            this.testMarkers.forEach(marker => {
                if (marker.parentNode) {
                    marker.parentNode.removeChild(marker);
                }
            });
            this.testMarkers = [];
            
            // Clean up hover manager
            if (this.hoverManager) {
                this.hoverManager.cleanup();
            }
            
            this.log('Benchmark cleanup completed');
            
        } catch (error) {
            this.log('Error during benchmark cleanup:', error);
        }
    }

    /**
     * Logging utility
     */
    log(message, data = null) {
        if (this.options.enableLogging) {
            const timestamp = new Date().toISOString();
            if (data) {
                console.warn(`[HoverStabilityPerformanceBenchmark ${timestamp}] ${message}:`, data);
            } else {
                console.warn(`[HoverStabilityPerformanceBenchmark ${timestamp}] ${message}`);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HoverStabilityPerformanceBenchmark;
} else if (typeof window !== 'undefined') {
    window.HoverStabilityPerformanceBenchmark = HoverStabilityPerformanceBenchmark;
}