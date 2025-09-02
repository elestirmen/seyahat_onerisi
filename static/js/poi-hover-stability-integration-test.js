/**
 * POI Hover Stability Integration Test Suite
 * 
 * Comprehensive testing system for POI hover stability components.
 * Tests integration between all components, cross-browser compatibility,
 * performance benchmarks, and memory leak detection.
 * 
 * Requirements addressed:
 * - 1.1, 1.2, 1.3, 1.4: Hover stability and clickability
 * - 2.1, 2.2, 2.3, 2.4: Screen stability and mobile support
 * - 3.1, 3.2, 3.3, 3.4: Click handling and modal functionality
 * - 5.1, 5.2, 5.3, 5.4: Cross-browser and device compatibility
 * - 6.1, 6.2, 6.3, 6.4: Event management and memory stability
 */

class POIHoverStabilityIntegrationTest {
    constructor(options = {}) {
        this.options = {
            enableLogging: options.enableLogging !== false,
            enablePerformanceBenchmarks: options.enablePerformanceBenchmarks !== false,
            enableMemoryLeakDetection: options.enableMemoryLeakDetection !== false,
            enableCrossBrowserTests: options.enableCrossBrowserTests !== false,
            testTimeout: options.testTimeout || 30000,
            performanceThreshold: options.performanceThreshold || 100, // ms
            memoryThreshold: options.memoryThreshold || 50 * 1024 * 1024, // 50MB
            ...options
        };

        // Test state
        this.testResults = new Map();
        this.performanceMetrics = new Map();
        this.memorySnapshots = [];
        this.testStartTime = 0;
        this.isRunning = false;

        // Component instances
        this.hoverManager = null;
        this.integrationManager = null;
        this.delegationManager = null;
        this.performanceMonitor = null;
        this.mobileOptimizations = null;

        // Test environment detection
        this.browserInfo = this.detectBrowser();
        this.deviceInfo = this.detectDevice();
        this.featureSupport = this.detectFeatureSupport();

        this.log('POI Hover Stability Integration Test Suite initialized');
    }

    /**
     * Run complete integration test suite
     */
    async runCompleteTestSuite() {
        try {
            this.isRunning = true;
            this.testStartTime = Date.now();
            
            this.log('Starting complete integration test suite...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Run test phases
            await this.runComponentIntegrationTests();
            await this.runHoverStabilityTests();
            await this.runClickabilityTests();
            await this.runPerformanceTests();
            await this.runMemoryLeakTests();
            await this.runCrossBrowserTests();
            await this.runMobileCompatibilityTests();
            
            // Generate comprehensive report
            const report = this.generateComprehensiveReport();
            
            this.log('Integration test suite completed successfully');
            return report;
            
        } catch (error) {
            this.handleTestError('runCompleteTestSuite', error);
            throw error;
        } finally {
            this.isRunning = false;
            await this.cleanup();
        }
    }

    /**
     * Initialize all components for testing
     */
    async initializeComponents() {
        this.log('Initializing components for testing...');
        
        try {
            // Initialize HoverEventManager
            this.hoverManager = new HoverEventManager({
                enableDebugLogging: this.options.enableLogging,
                debounceDelay: 50, // Faster for testing
                hoverDelay: 25,
                leaveDelay: 75
            });

            // Initialize POIHoverIntegration
            this.integrationManager = new POIHoverIntegration({
                enableDebugLogging: this.options.enableLogging,
                debounceDelay: 50,
                hoverDelay: 25
            });

            await this.integrationManager.initialize();

            // Initialize EventDelegationManager
            this.delegationManager = new EventDelegationManager({
                debugMode: this.options.enableLogging,
                stopPropagation: true
            });

            // Initialize PerformanceMonitor
            if (this.options.enablePerformanceBenchmarks) {
                this.performanceMonitor = new PerformanceMonitor({
                    enableLogging: this.options.enableLogging,
                    memoryThreshold: this.options.memoryThreshold
                });
            }

            // Initialize MobileOptimizations
            if (this.deviceInfo.isMobile || this.deviceInfo.isTouch) {
                this.mobileOptimizations = new MobileOptimizations();
            }

            this.recordTestResult('componentInitialization', true, 'All components initialized successfully');
            
        } catch (error) {
            this.recordTestResult('componentInitialization', false, `Component initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test component integration
     */
    async runComponentIntegrationTests() {
        this.log('Running component integration tests...');
        
        const tests = [
            () => this.testHoverManagerIntegration(),
            () => this.testEventDelegationIntegration(),
            () => this.testPerformanceMonitorIntegration(),
            () => this.testMobileOptimizationIntegration()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('componentIntegration', error);
            }
        }
    }

    /**
     * Test hover stability across different scenarios
     */
    async runHoverStabilityTests() {
        this.log('Running hover stability tests...');
        
        const tests = [
            () => this.testBasicHoverStability(),
            () => this.testRapidHoverMovements(),
            () => this.testHoverWithoutJittering(),
            () => this.testHoverTransitionSmoothness(),
            () => this.testHoverStateConsistency()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('hoverStability', error);
            }
        }
    }

    /**
     * Test clickability during hover states
     */
    async runClickabilityTests() {
        this.log('Running clickability tests...');
        
        const tests = [
            () => this.testClickDuringHover(),
            () => this.testModalOpeningAfterHover(),
            () => this.testClickEventRegistration(),
            () => this.testMultipleClickHandling(),
            () => this.testTouchClickCompatibility()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('clickability', error);
            }
        }
    }

    /**
     * Run performance benchmarks
     */
    async runPerformanceTests() {
        if (!this.options.enablePerformanceBenchmarks) {
            this.log('Performance tests skipped (disabled)');
            return;
        }

        this.log('Running performance tests...');
        
        const tests = [
            () => this.benchmarkHoverResponseTime(),
            () => this.benchmarkEventProcessingTime(),
            () => this.benchmarkAnimationPerformance(),
            () => this.benchmarkMemoryUsage(),
            () => this.benchmarkCPUUsage()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('performance', error);
            }
        }
    }

    /**
     * Test for memory leaks
     */
    async runMemoryLeakTests() {
        if (!this.options.enableMemoryLeakDetection) {
            this.log('Memory leak tests skipped (disabled)');
            return;
        }

        this.log('Running memory leak tests...');
        
        const tests = [
            () => this.testEventListenerCleanup(),
            () => this.testHoverStateCleanup(),
            () => this.testComponentMemoryUsage(),
            () => this.testLongRunningMemoryStability()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('memoryLeak', error);
            }
        }
    }

    /**
     * Test cross-browser compatibility
     */
    async runCrossBrowserTests() {
        if (!this.options.enableCrossBrowserTests) {
            this.log('Cross-browser tests skipped (disabled)');
            return;
        }

        this.log('Running cross-browser compatibility tests...');
        
        const tests = [
            () => this.testCSSCompatibility(),
            () => this.testJavaScriptFeatureSupport(),
            () => this.testEventHandlingCompatibility(),
            () => this.testAnimationCompatibility()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('crossBrowser', error);
            }
        }
    }

    /**
     * Test mobile device compatibility
     */
    async runMobileCompatibilityTests() {
        this.log('Running mobile compatibility tests...');
        
        const tests = [
            () => this.testTouchEventHandling(),
            () => this.testMobileViewportHandling(),
            () => this.testMobilePerformanceOptimizations(),
            () => this.testResponsiveDesignCompatibility()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.handleTestError('mobileCompatibility', error);
            }
        }
    }

    // Individual Test Methods

    /**
     * Test hover manager integration
     */
    async testHoverManagerIntegration() {
        const testName = 'hoverManagerIntegration';
        
        try {
            // Create test marker
            const testMarker = this.createTestMarker('integration-test-marker');
            
            // Test attachment
            const attachResult = this.hoverManager.attachHoverEvents(testMarker, {
                onHoverStart: () => {},
                onHoverEnd: () => {},
                onClick: () => {}
            });
            
            if (!attachResult) {
                throw new Error('Failed to attach hover events');
            }
            
            // Test detachment
            const detachResult = this.hoverManager.detachHoverEvents(testMarker);
            
            if (!detachResult) {
                throw new Error('Failed to detach hover events');
            }
            
            this.recordTestResult(testName, true, 'Hover manager integration successful');
            
        } catch (error) {
            this.recordTestResult(testName, false, `Hover manager integration failed: ${error.message}`);
        }
    }

    /**
     * Test basic hover stability
     */
    async testBasicHoverStability() {
        const testName = 'basicHoverStability';
        
        try {
            const testMarker = this.createTestMarker('stability-test-marker');
            let hoverStarted = false;
            let hoverEnded = false;
            
            // Attach hover events
            this.hoverManager.attachHoverEvents(testMarker, {
                onHoverStart: () => { hoverStarted = true; },
                onHoverEnd: () => { hoverEnded = true; }
            });
            
            // Simulate hover
            await this.simulateHover(testMarker);
            
            // Wait for debouncing
            await this.wait(200);
            
            if (!hoverStarted) {
                throw new Error('Hover start event not triggered');
            }
            
            // Simulate hover end
            await this.simulateHoverEnd(testMarker);
            
            // Wait for debouncing
            await this.wait(200);
            
            if (!hoverEnded) {
                throw new Error('Hover end event not triggered');
            }
            
            this.recordTestResult(testName, true, 'Basic hover stability test passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, `Basic hover stability test failed: ${error.message}`);
        }
    }

    /**
     * Test rapid hover movements
     */
    async testRapidHoverMovements() {
        const testName = 'rapidHoverMovements';
        
        try {
            const testMarkers = [];
            const hoverCounts = [];
            
            // Create multiple test markers
            for (let i = 0; i < 5; i++) {
                const marker = this.createTestMarker(`rapid-test-marker-${i}`);
                let hoverCount = 0;
                
                this.hoverManager.attachHoverEvents(marker, {
                    onHoverStart: () => { hoverCount++; },
                    onHoverEnd: () => {}
                });
                
                testMarkers.push(marker);
                hoverCounts.push(() => hoverCount);
            }
            
            // Simulate rapid movements
            for (let i = 0; i < 10; i++) {
                const randomMarker = testMarkers[Math.floor(Math.random() * testMarkers.length)];
                await this.simulateHover(randomMarker);
                await this.wait(50); // Rapid movement
            }
            
            // Wait for all events to settle
            await this.wait(500);
            
            // Check that hover events were properly debounced
            const totalHovers = hoverCounts.reduce((sum, getCount) => sum + getCount(), 0);
            
            if (totalHovers > 15) { // Should be less due to debouncing
                throw new Error(`Too many hover events triggered: ${totalHovers}`);
            }
            
            this.recordTestResult(testName, true, `Rapid hover movements handled correctly (${totalHovers} events)`);
            
        } catch (error) {
            this.recordTestResult(testName, false, `Rapid hover movements test failed: ${error.message}`);
        }
    }

    /**
     * Test click during hover
     */
    async testClickDuringHover() {
        const testName = 'clickDuringHover';
        
        try {
            const testMarker = this.createTestMarker('click-hover-test-marker');
            let clickTriggered = false;
            let clickContext = null;
            
            this.hoverManager.attachHoverEvents(testMarker, {
                onHoverStart: () => {},
                onHoverEnd: () => {},
                onClick: (event, markerId, context) => {
                    clickTriggered = true;
                    clickContext = context;
                }
            });
            
            // Start hover
            await this.simulateHover(testMarker);
            await this.wait(100);
            
            // Click during hover
            await this.simulateClick(testMarker);
            await this.wait(100);
            
            if (!clickTriggered) {
                throw new Error('Click event not triggered during hover');
            }
            
            if (!clickContext || !clickContext.isHovering) {
                throw new Error('Click context does not indicate hovering state');
            }
            
            this.recordTestResult(testName, true, 'Click during hover test passed');
            
        } catch (error) {
            this.recordTestResult(testName, false, `Click during hover test failed: ${error.message}`);
        }
    }

    /**
     * Benchmark hover response time
     */
    async benchmarkHoverResponseTime() {
        const testName = 'hoverResponseTimeBenchmark';
        
        try {
            const testMarker = this.createTestMarker('benchmark-marker');
            const responseTimes = [];
            
            for (let i = 0; i < 10; i++) {
                let startTime = 0;
                let endTime = 0;
                
                this.hoverManager.attachHoverEvents(testMarker, {
                    onHoverStart: () => { endTime = performance.now(); }
                });
                
                startTime = performance.now();
                await this.simulateHover(testMarker);
                await this.wait(100);
                
                if (endTime > startTime) {
                    responseTimes.push(endTime - startTime);
                }
                
                this.hoverManager.detachHoverEvents(testMarker);
                await this.wait(50);
            }
            
            const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            
            this.performanceMetrics.set('hoverResponseTime', {
                average: averageResponseTime,
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                samples: responseTimes.length
            });
            
            const passed = averageResponseTime < this.options.performanceThreshold;
            
            this.recordTestResult(testName, passed, 
                `Average hover response time: ${averageResponseTime.toFixed(2)}ms`);
            
        } catch (error) {
            this.recordTestResult(testName, false, `Hover response time benchmark failed: ${error.message}`);
        }
    }

    /**
     * Test event listener cleanup
     */
    async testEventListenerCleanup() {
        const testName = 'eventListenerCleanup';
        
        try {
            const initialMemory = this.getMemoryUsage();
            const testMarkers = [];
            
            // Create many markers and attach events
            for (let i = 0; i < 100; i++) {
                const marker = this.createTestMarker(`cleanup-test-marker-${i}`);
                this.hoverManager.attachHoverEvents(marker, {
                    onHoverStart: () => {},
                    onHoverEnd: () => {},
                    onClick: () => {}
                });
                testMarkers.push(marker);
            }
            
            const afterAttachMemory = this.getMemoryUsage();
            
            // Clean up all markers
            testMarkers.forEach(marker => {
                this.hoverManager.detachHoverEvents(marker);
            });
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            await this.wait(1000); // Wait for cleanup
            
            const afterCleanupMemory = this.getMemoryUsage();
            
            const memoryIncrease = afterCleanupMemory - initialMemory;
            const memoryLeakThreshold = 5 * 1024 * 1024; // 5MB
            
            const passed = memoryIncrease < memoryLeakThreshold;
            
            this.recordTestResult(testName, passed, 
                `Memory increase after cleanup: ${this.formatBytes(memoryIncrease)}`);
            
        } catch (error) {
            this.recordTestResult(testName, false, `Event listener cleanup test failed: ${error.message}`);
        }
    }

    /**
     * Test CSS compatibility across browsers
     */
    async testCSSCompatibility() {
        const testName = 'cssCompatibility';
        
        try {
            const testMarker = this.createTestMarker('css-test-marker');
            const computedStyle = window.getComputedStyle(testMarker);
            
            const checks = [
                {
                    property: 'transform',
                    expected: 'translateZ(0px)',
                    description: 'Hardware acceleration transform'
                },
                {
                    property: 'transition',
                    expected: /transform.*opacity/,
                    description: 'Smooth transitions'
                },
                {
                    property: 'will-change',
                    expected: 'transform, opacity',
                    description: 'Will-change optimization'
                }
            ];
            
            const results = [];
            
            for (const check of checks) {
                const value = computedStyle.getPropertyValue(check.property);
                const matches = typeof check.expected === 'string' 
                    ? value.includes(check.expected)
                    : check.expected.test(value);
                
                results.push({
                    property: check.property,
                    expected: check.expected,
                    actual: value,
                    matches,
                    description: check.description
                });
            }
            
            const allPassed = results.every(result => result.matches);
            
            this.recordTestResult(testName, allPassed, 
                `CSS compatibility: ${results.filter(r => r.matches).length}/${results.length} checks passed`);
            
        } catch (error) {
            this.recordTestResult(testName, false, `CSS compatibility test failed: ${error.message}`);
        }
    }

    /**
     * Test touch event handling
     */
    async testTouchEventHandling() {
        const testName = 'touchEventHandling';
        
        try {
            if (!this.deviceInfo.isTouch) {
                this.recordTestResult(testName, true, 'Touch events not applicable (non-touch device)');
                return;
            }
            
            const testMarker = this.createTestMarker('touch-test-marker');
            let touchStartTriggered = false;
            let touchEndTriggered = false;
            
            this.hoverManager.attachHoverEvents(testMarker, {
                onHoverStart: () => { touchStartTriggered = true; },
                onHoverEnd: () => { touchEndTriggered = true; }
            });
            
            // Simulate touch events
            await this.simulateTouch(testMarker);
            await this.wait(200);
            
            const passed = touchStartTriggered && touchEndTriggered;
            
            this.recordTestResult(testName, passed, 
                `Touch events: start=${touchStartTriggered}, end=${touchEndTriggered}`);
            
        } catch (error) {
            this.recordTestResult(testName, false, `Touch event handling test failed: ${error.message}`);
        }
    }

    // Utility Methods

    /**
     * Create a test marker element
     */
    createTestMarker(id) {
        const marker = document.createElement('div');
        marker.id = id;
        marker.className = 'poi-marker-container test-marker';
        marker.style.cssText = `
            width: 30px;
            height: 30px;
            background: #007bff;
            border-radius: 50%;
            position: absolute;
            top: 100px;
            left: 100px;
            cursor: pointer;
        `;
        
        document.body.appendChild(marker);
        return marker;
    }

    /**
     * Simulate hover event
     */
    async simulateHover(element) {
        const event = new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            clientX: 115,
            clientY: 115
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Simulate hover end event
     */
    async simulateHoverEnd(element) {
        const event = new MouseEvent('mouseleave', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 200
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Simulate click event
     */
    async simulateClick(element) {
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: 115,
            clientY: 115
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Simulate touch events
     */
    async simulateTouch(element) {
        const touchStart = new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [{
                clientX: 115,
                clientY: 115,
                target: element
            }]
        });
        
        const touchEnd = new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            changedTouches: [{
                clientX: 115,
                clientY: 115,
                target: element
            }]
        });
        
        element.dispatchEvent(touchStart);
        await this.wait(100);
        element.dispatchEvent(touchEnd);
    }

    /**
     * Wait for specified milliseconds
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return performance.memory.usedJSHeapSize;
        }
        return 0;
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
     * Detect browser information
     */
    detectBrowser() {
        const userAgent = navigator.userAgent;
        
        return {
            isChrome: /Chrome/.test(userAgent),
            isFirefox: /Firefox/.test(userAgent),
            isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
            isEdge: /Edge/.test(userAgent),
            isIE: /MSIE|Trident/.test(userAgent),
            userAgent
        };
    }

    /**
     * Detect device information
     */
    detectDevice() {
        return {
            isMobile: window.innerWidth <= 768,
            isTouch: 'ontouchstart' in window,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    /**
     * Detect feature support
     */
    detectFeatureSupport() {
        return {
            intersectionObserver: 'IntersectionObserver' in window,
            performanceObserver: 'PerformanceObserver' in window,
            performanceMemory: 'memory' in performance,
            webGL: !!window.WebGLRenderingContext,
            webP: this.detectWebPSupport(),
            css3DTransforms: this.detectCSS3DTransforms()
        };
    }

    /**
     * Detect WebP support
     */
    detectWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    /**
     * Detect CSS 3D transforms support
     */
    detectCSS3DTransforms() {
        const div = document.createElement('div');
        div.style.transform = 'translateZ(0)';
        return div.style.transform !== '';
    }

    /**
     * Record test result
     */
    recordTestResult(testName, passed, message) {
        this.testResults.set(testName, {
            passed,
            message,
            timestamp: Date.now(),
            duration: Date.now() - this.testStartTime
        });
        
        this.log(`Test ${testName}: ${passed ? 'PASSED' : 'FAILED'} - ${message}`);
    }

    /**
     * Handle test errors
     */
    handleTestError(context, error) {
        this.log(`Test error in ${context}: ${error.message}`, error);
        this.recordTestResult(`${context}_error`, false, error.message);
    }

    /**
     * Generate comprehensive test report
     */
    generateComprehensiveReport() {
        const totalTests = this.testResults.size;
        const passedTests = Array.from(this.testResults.values()).filter(result => result.passed).length;
        const failedTests = totalTests - passedTests;
        
        const report = {
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) + '%' : '0%',
                totalDuration: Date.now() - this.testStartTime,
                timestamp: new Date().toISOString()
            },
            environment: {
                browser: this.browserInfo,
                device: this.deviceInfo,
                features: this.featureSupport
            },
            testResults: Object.fromEntries(this.testResults),
            performanceMetrics: Object.fromEntries(this.performanceMetrics),
            memorySnapshots: this.memorySnapshots,
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Check performance metrics
        const hoverResponseTime = this.performanceMetrics.get('hoverResponseTime');
        if (hoverResponseTime && hoverResponseTime.average > this.options.performanceThreshold) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: `Hover response time (${hoverResponseTime.average.toFixed(2)}ms) exceeds threshold. Consider optimizing event handling.`
            });
        }
        
        // Check failed tests
        const failedTests = Array.from(this.testResults.entries())
            .filter(([, result]) => !result.passed);
        
        if (failedTests.length > 0) {
            recommendations.push({
                type: 'functionality',
                priority: 'high',
                message: `${failedTests.length} tests failed. Review implementation for: ${failedTests.map(([name]) => name).join(', ')}`
            });
        }
        
        // Check browser compatibility
        if (!this.featureSupport.css3DTransforms) {
            recommendations.push({
                type: 'compatibility',
                priority: 'medium',
                message: 'CSS 3D transforms not supported. Consider fallback animations.'
            });
        }
        
        return recommendations;
    }

    /**
     * Clean up test resources
     */
    async cleanup() {
        try {
            // Remove test markers
            const testMarkers = document.querySelectorAll('.test-marker');
            testMarkers.forEach(marker => {
                if (marker.parentNode) {
                    marker.parentNode.removeChild(marker);
                }
            });
            
            // Clean up component instances
            if (this.hoverManager) {
                this.hoverManager.cleanup();
            }
            
            if (this.integrationManager) {
                this.integrationManager.cleanup();
            }
            
            if (this.delegationManager) {
                this.delegationManager.cleanup();
            }
            
            if (this.performanceMonitor) {
                this.performanceMonitor.destroy();
            }
            
            this.log('Test cleanup completed');
            
        } catch (error) {
            this.log('Error during cleanup:', error);
        }
    }

    /**
     * Logging utility
     */
    log(message, data = null) {
        if (this.options.enableLogging) {
            const timestamp = new Date().toISOString();
            if (data) {
                console.log(`[POIHoverStabilityIntegrationTest ${timestamp}] ${message}:`, data);
            } else {
                console.log(`[POIHoverStabilityIntegrationTest ${timestamp}] ${message}`);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = POIHoverStabilityIntegrationTest;
} else if (typeof window !== 'undefined') {
    window.POIHoverStabilityIntegrationTest = POIHoverStabilityIntegrationTest;
}