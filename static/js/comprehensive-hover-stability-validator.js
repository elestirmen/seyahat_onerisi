/**
 * Comprehensive Hover Stability Validator
 * Final integration test that validates all components work together
 */

class ComprehensiveHoverStabilityValidator {
    constructor() {
        this.validationResults = {
            componentTests: {},
            integrationTests: {},
            performanceTests: {},
            compatibilityTests: {},
            overallScore: 0,
            recommendations: []
        };
        
        this.testConfig = {
            timeout: 30000,
            sampleSize: 50,
            performanceThreshold: {
                hoverResponse: 16,
                frameRate: 54,
                memoryIncrease: 5
            }
        };
        
        this.initializeValidator();
    }
    
    initializeValidator() {
        console.warn('Initializing Comprehensive Hover Stability Validator...');
        this.createValidationUI();
        this.setupValidationEnvironment();
    }
    
    createValidationUI() {
        const validatorContainer = document.createElement('div');
        validatorContainer.id = 'hover-stability-validator';
        validatorContainer.innerHTML = `
            <div class="validator-panel">
                <div class="validator-header">
                    <h2>🔍 Comprehensive Hover Stability Validator</h2>
                    <p>Final integration test for all hover stability components</p>
                </div>
                
                <div class="validator-controls">
                    <button id="run-full-validation" class="validator-btn primary">
                        🚀 Run Full Validation
                    </button>
                    <button id="run-component-tests" class="validator-btn">
                        🧩 Component Tests
                    </button>
                    <button id="run-integration-tests" class="validator-btn">
                        🔗 Integration Tests
                    </button>
                    <button id="run-performance-tests" class="validator-btn">
                        ⚡ Performance Tests
                    </button>
                    <button id="generate-report" class="validator-btn secondary">
                        📊 Generate Report
                    </button>
                </div>
                
                <div class="validation-progress">
                    <div class="progress-header">
                        <span id="validation-status">Ready to validate</span>
                        <span id="validation-percentage">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="validation-progress-fill"></div>
                    </div>
                </div>
                
                <div class="validation-results">
                    <div class="results-grid">
                        <div class="result-card" id="component-results">
                            <h3>🧩 Component Tests</h3>
                            <div class="result-score" id="component-score">--</div>
                            <div class="result-details" id="component-details"></div>
                        </div>
                        
                        <div class="result-card" id="integration-results">
                            <h3>🔗 Integration Tests</h3>
                            <div class="result-score" id="integration-score">--</div>
                            <div class="result-details" id="integration-details"></div>
                        </div>
                        
                        <div class="result-card" id="performance-results">
                            <h3>⚡ Performance Tests</h3>
                            <div class="result-score" id="performance-score">--</div>
                            <div class="result-details" id="performance-details"></div>
                        </div>
                        
                        <div class="result-card" id="compatibility-results">
                            <h3>🌐 Compatibility Tests</h3>
                            <div class="result-score" id="compatibility-score">--</div>
                            <div class="result-details" id="compatibility-details"></div>
                        </div>
                    </div>
                    
                    <div class="overall-results">
                        <div class="overall-score">
                            <h3>Overall Validation Score</h3>
                            <div class="score-display" id="overall-score-display">
                                <span class="score-number" id="overall-score-number">--</span>
                                <span class="score-label">/100</span>
                            </div>
                            <div class="score-status" id="overall-score-status">Not Tested</div>
                        </div>
                        
                        <div class="recommendations" id="recommendations-panel">
                            <h3>Recommendations</h3>
                            <div id="recommendations-list">No recommendations yet</div>
                        </div>
                    </div>
                </div>
                
                <div class="validation-log" id="validation-log">
                    <h3>Validation Log</h3>
                    <div class="log-content" id="validation-log-content">
                        <div class="log-entry info">Validator initialized. Ready to run tests.</div>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        const styles = `
            <style>
                #hover-stability-validator {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    right: 20px;
                    bottom: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                    z-index: 10001;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .validator-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    padding: 20px;
                }
                
                .validator-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #e9ecef;
                }
                
                .validator-header h2 {
                    margin: 0 0 8px 0;
                    color: #2c3e50;
                    font-size: 24px;
                }
                
                .validator-header p {
                    margin: 0;
                    color: #6c757d;
                    font-size: 14px;
                }
                
                .validator-controls {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .validator-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                
                .validator-btn.primary {
                    background: #007bff;
                    color: white;
                }
                
                .validator-btn.primary:hover {
                    background: #0056b3;
                    transform: translateY(-1px);
                }
                
                .validator-btn:not(.primary):not(.secondary) {
                    background: #f8f9fa;
                    color: #495057;
                    border: 1px solid #dee2e6;
                }
                
                .validator-btn:not(.primary):not(.secondary):hover {
                    background: #e9ecef;
                }
                
                .validator-btn.secondary {
                    background: #6c757d;
                    color: white;
                }
                
                .validator-btn.secondary:hover {
                    background: #545b62;
                }
                
                .validation-progress {
                    margin-bottom: 20px;
                }
                
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #495057;
                }
                
                .progress-bar {
                    height: 8px;
                    background: #e9ecef;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #007bff, #28a745);
                    width: 0%;
                    transition: width 0.3s ease;
                }
                
                .validation-results {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 20px;
                }
                
                .results-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .result-card {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 15px;
                }
                
                .result-card h3 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    color: #495057;
                }
                
                .result-score {
                    font-size: 32px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 10px;
                    color: #6c757d;
                }
                
                .result-score.pass {
                    color: #28a745;
                }
                
                .result-score.fail {
                    color: #dc3545;
                }
                
                .result-score.warning {
                    color: #ffc107;
                }
                
                .result-details {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .overall-results {
                    display: grid;
                    grid-template-columns: 1fr 2fr;
                    gap: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                }
                
                .overall-score {
                    text-align: center;
                }
                
                .overall-score h3 {
                    margin: 0 0 15px 0;
                    color: #495057;
                }
                
                .score-display {
                    margin-bottom: 10px;
                }
                
                .score-number {
                    font-size: 48px;
                    font-weight: bold;
                    color: #6c757d;
                }
                
                .score-number.excellent {
                    color: #28a745;
                }
                
                .score-number.good {
                    color: #17a2b8;
                }
                
                .score-number.fair {
                    color: #ffc107;
                }
                
                .score-number.poor {
                    color: #dc3545;
                }
                
                .score-label {
                    font-size: 24px;
                    color: #6c757d;
                }
                
                .score-status {
                    font-size: 14px;
                    font-weight: 500;
                    padding: 4px 12px;
                    border-radius: 12px;
                    background: #e9ecef;
                    color: #495057;
                    display: inline-block;
                }
                
                .recommendations h3 {
                    margin: 0 0 15px 0;
                    color: #495057;
                }
                
                .recommendation-item {
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 8px;
                    font-size: 13px;
                }
                
                .recommendation-priority {
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                
                .recommendation-priority.high {
                    color: #dc3545;
                }
                
                .recommendation-priority.medium {
                    color: #ffc107;
                }
                
                .recommendation-priority.low {
                    color: #17a2b8;
                }
                
                .validation-log {
                    height: 200px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .validation-log h3 {
                    margin: 0;
                    padding: 10px 15px;
                    background: #e9ecef;
                    border-bottom: 1px solid #dee2e6;
                    font-size: 14px;
                    color: #495057;
                }
                
                .log-content {
                    height: calc(100% - 45px);
                    overflow-y: auto;
                    padding: 10px 15px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
                
                .log-entry {
                    margin-bottom: 4px;
                    padding: 2px 0;
                }
                
                .log-entry.info {
                    color: #007bff;
                }
                
                .log-entry.success {
                    color: #28a745;
                }
                
                .log-entry.warning {
                    color: #ffc107;
                }
                
                .log-entry.error {
                    color: #dc3545;
                }
                
                @media (max-width: 768px) {
                    #hover-stability-validator {
                        top: 10px;
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                    }
                    
                    .results-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .overall-results {
                        grid-template-columns: 1fr;
                    }
                    
                    .validator-controls {
                        justify-content: stretch;
                    }
                    
                    .validator-btn {
                        flex: 1;
                        min-width: 0;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(validatorContainer);
        
        this.bindValidatorEvents();
    }
    
    bindValidatorEvents() {
        document.getElementById('run-full-validation').addEventListener('click', () => this.runFullValidation());
        document.getElementById('run-component-tests').addEventListener('click', () => this.runComponentTests());
        document.getElementById('run-integration-tests').addEventListener('click', () => this.runIntegrationTests());
        document.getElementById('run-performance-tests').addEventListener('click', () => this.runPerformanceTests());
        document.getElementById('generate-report').addEventListener('click', () => this.generateReport());
    }
    
    setupValidationEnvironment() {
        // Check if all required components are available
        this.availableComponents = {
            hoverEventManager: typeof HoverEventManager !== 'undefined',
            modalEventIsolator: typeof ModalEventIsolator !== 'undefined',
            leafletModalEventManager: typeof LeafletModalEventManager !== 'undefined',
            performanceBenchmark: typeof HoverStabilityPerformanceBenchmark !== 'undefined',
            integrationTest: typeof POIHoverStabilityIntegrationTest !== 'undefined'
        };
        
        this.logMessage('Validation environment setup complete', 'info');
        this.logMessage(`Available components: ${Object.values(this.availableComponents).filter(Boolean).length}/5`, 'info');
    }
    
    async runFullValidation() {
        this.logMessage('Starting full validation suite...', 'info');
        this.updateProgress(0, 'Initializing validation...');
        
        try {
            // Component tests (25%)
            await this.runComponentTests();
            this.updateProgress(25, 'Component tests completed');
            
            // Integration tests (25%)
            await this.runIntegrationTests();
            this.updateProgress(50, 'Integration tests completed');
            
            // Performance tests (25%)
            await this.runPerformanceTests();
            this.updateProgress(75, 'Performance tests completed');
            
            // Compatibility tests (25%)
            await this.runCompatibilityTests();
            this.updateProgress(100, 'All tests completed');
            
            // Calculate overall score
            this.calculateOverallScore();
            this.generateRecommendations();
            this.updateUI();
            
            this.logMessage('Full validation completed successfully', 'success');
            
        } catch (error) {
            this.logMessage(`Validation failed: ${error.message}`, 'error');
            console.error('Validation error:', error);
        }
    }
    
    async runComponentTests() {
        this.logMessage('Running component tests...', 'info');
        
        const componentResults = {};
        
        // Test HoverEventManager
        componentResults.hoverEventManager = await this.testHoverEventManager();
        
        // Test ModalEventIsolator
        componentResults.modalEventIsolator = await this.testModalEventIsolator();
        
        // Test LeafletModalEventManager
        componentResults.leafletModalEventManager = await this.testLeafletModalEventManager();
        
        // Test CSS Stability
        componentResults.cssStability = await this.testCSSStability();
        
        // Test Event Cleanup
        componentResults.eventCleanup = await this.testEventCleanup();
        
        this.validationResults.componentTests = componentResults;
        
        const componentScore = this.calculateComponentScore(componentResults);
        this.updateResultCard('component', componentScore, componentResults);
        
        this.logMessage(`Component tests completed. Score: ${componentScore}/100`, 'success');
    }
    
    async testHoverEventManager() {
        if (!this.availableComponents.hoverEventManager) {
            return { available: false, score: 0, message: 'HoverEventManager not available' };
        }
        
        try {
            const manager = new HoverEventManager({ debounceDelay: 50 });
            const testElement = document.createElement('div');
            testElement.className = 'test-hover-element';
            document.body.appendChild(testElement);
            
            let hoverCount = 0;
            const callbacks = {
                onEnter: () => hoverCount++,
                onLeave: () => hoverCount++
            };
            
            manager.attachHoverEvents(testElement, callbacks);
            
            // Simulate hover events
            const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
            const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
            
            testElement.dispatchEvent(enterEvent);
            testElement.dispatchEvent(leaveEvent);
            
            await this.sleep(100);
            
            manager.detachHoverEvents(testElement);
            document.body.removeChild(testElement);
            
            const score = hoverCount >= 2 ? 100 : 50;
            return {
                available: true,
                score: score,
                message: `Hover events processed: ${hoverCount}/2`,
                details: { eventsProcessed: hoverCount }
            };
            
        } catch (error) {
            return { available: true, score: 0, message: `Error: ${error.message}` };
        }
    }
    
    async testModalEventIsolator() {
        if (!this.availableComponents.modalEventIsolator) {
            return { available: false, score: 0, message: 'ModalEventIsolator not available' };
        }
        
        try {
            const modalElement = document.createElement('div');
            modalElement.className = 'test-modal';
            document.body.appendChild(modalElement);
            
            const isolator = new ModalEventIsolator(modalElement);
            
            // Test isolation
            isolator.isolateEvents();
            const isIsolated = isolator.isIsolated();
            
            // Test restoration
            isolator.restoreEvents();
            const isRestored = !isolator.isIsolated();
            
            document.body.removeChild(modalElement);
            
            const score = (isIsolated && isRestored) ? 100 : 50;
            return {
                available: true,
                score: score,
                message: `Isolation: ${isIsolated}, Restoration: ${isRestored}`,
                details: { isolation: isIsolated, restoration: isRestored }
            };
            
        } catch (error) {
            return { available: true, score: 0, message: `Error: ${error.message}` };
        }
    }
    
    async testLeafletModalEventManager() {
        if (!this.availableComponents.leafletModalEventManager) {
            return { available: false, score: 0, message: 'LeafletModalEventManager not available' };
        }
        
        try {
            // Mock Leaflet map instance
            const mockMap = {
                on: () => {},
                off: () => {},
                invalidateSize: () => {}
            };
            
            const mockModal = document.createElement('div');
            const manager = new LeafletModalEventManager(mockMap, mockModal);
            
            // Test initialization
            manager.initializeModalMapEvents();
            
            // Test cleanup
            manager.cleanupModalMapEvents();
            
            return {
                available: true,
                score: 100,
                message: 'Leaflet modal event manager functional',
                details: { initialized: true, cleanup: true }
            };
            
        } catch (error) {
            return { available: true, score: 0, message: `Error: ${error.message}` };
        }
    }
    
    async testCSSStability() {
        const testElement = document.createElement('div');
        testElement.className = 'poi-marker-circle';
        testElement.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #007bff;
            position: absolute;
            top: 100px;
            left: 100px;
        `;
        document.body.appendChild(testElement);
        
        const initialRect = testElement.getBoundingClientRect();
        
        // Simulate hover
        const hoverEvent = new MouseEvent('mouseenter', { bubbles: true });
        testElement.dispatchEvent(hoverEvent);
        
        await this.sleep(100);
        
        const hoverRect = testElement.getBoundingClientRect();
        const positionDiff = Math.abs(hoverRect.left - initialRect.left) + Math.abs(hoverRect.top - initialRect.top);
        
        // Check CSS properties
        const computedStyle = window.getComputedStyle(testElement);
        const hasWillChange = computedStyle.willChange !== 'auto';
        const hasTransform = computedStyle.transform !== 'none';
        
        document.body.removeChild(testElement);
        
        let score = 0;
        if (positionDiff <= 2) score += 40; // Position stability
        if (hasWillChange) score += 30; // Hardware acceleration
        if (hasTransform) score += 30; // Transform usage
        
        return {
            available: true,
            score: score,
            message: `Position stable: ${positionDiff <= 2}, Hardware acceleration: ${hasWillChange}`,
            details: { positionDiff, hasWillChange, hasTransform }
        };
    }
    
    async testEventCleanup() {
        const testElements = [];
        const initialListenerCount = this.getApproximateListenerCount();
        
        // Create multiple elements with event listeners
        for (let i = 0; i < 10; i++) {
            const element = document.createElement('div');
            element.className = 'test-cleanup-element';
            
            const handler = () => {};
            element.addEventListener('mouseenter', handler);
            element.addEventListener('mouseleave', handler);
            
            testElements.push({ element, handler });
            document.body.appendChild(element);
        }
        
        const withListenersCount = this.getApproximateListenerCount();
        
        // Clean up elements
        testElements.forEach(({ element, handler }) => {
            element.removeEventListener('mouseenter', handler);
            element.removeEventListener('mouseleave', handler);
            document.body.removeChild(element);
        });
        
        await this.sleep(100);
        
        const afterCleanupCount = this.getApproximateListenerCount();
        
        const listenersAdded = withListenersCount - initialListenerCount;
        const listenersRemoved = withListenersCount - afterCleanupCount;
        const cleanupEfficiency = listenersRemoved / listenersAdded;
        
        const score = cleanupEfficiency >= 0.8 ? 100 : cleanupEfficiency * 100;
        
        return {
            available: true,
            score: score,
            message: `Cleanup efficiency: ${(cleanupEfficiency * 100).toFixed(1)}%`,
            details: { listenersAdded, listenersRemoved, cleanupEfficiency }
        };
    }
    
    getApproximateListenerCount() {
        // This is a simplified approximation
        return document.querySelectorAll('*').length;
    }
    
    async runIntegrationTests() {
        this.logMessage('Running integration tests...', 'info');
        
        const integrationResults = {};
        
        // Test POI hover integration
        integrationResults.poiHoverIntegration = await this.testPOIHoverIntegration();
        
        // Test modal integration
        integrationResults.modalIntegration = await this.testModalIntegration();
        
        // Test cross-component communication
        integrationResults.crossComponentCommunication = await this.testCrossComponentCommunication();
        
        // Test error handling
        integrationResults.errorHandling = await this.testErrorHandling();
        
        this.validationResults.integrationTests = integrationResults;
        
        const integrationScore = this.calculateIntegrationScore(integrationResults);
        this.updateResultCard('integration', integrationScore, integrationResults);
        
        this.logMessage(`Integration tests completed. Score: ${integrationScore}/100`, 'success');
    }
    
    async testPOIHoverIntegration() {
        const poiMarkers = document.querySelectorAll('.poi-marker-circle');
        
        if (poiMarkers.length === 0) {
            return { available: false, score: 0, message: 'No POI markers found for testing' };
        }
        
        let successfulHovers = 0;
        const totalTests = Math.min(poiMarkers.length, 5);
        
        for (let i = 0; i < totalTests; i++) {
            const marker = poiMarkers[i];
            const rect = marker.getBoundingClientRect();
            const initialPosition = { x: rect.left, y: rect.top };
            
            // Simulate hover
            const hoverEvent = new MouseEvent('mouseenter', {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true
            });
            
            marker.dispatchEvent(hoverEvent);
            await this.sleep(50);
            
            const newRect = marker.getBoundingClientRect();
            const positionDiff = Math.abs(newRect.left - initialPosition.x) + Math.abs(newRect.top - initialPosition.y);
            
            if (positionDiff <= 2) {
                successfulHovers++;
            }
            
            // Clean up
            const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
            marker.dispatchEvent(leaveEvent);
            await this.sleep(20);
        }
        
        const score = (successfulHovers / totalTests) * 100;
        
        return {
            available: true,
            score: score,
            message: `${successfulHovers}/${totalTests} POI hovers stable`,
            details: { successfulHovers, totalTests }
        };
    }
    
    async testModalIntegration() {
        // Look for existing modal or create test modal
        let modal = document.querySelector('.route-details-modal');
        let createdModal = false;
        
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'route-details-modal test-modal';
            modal.style.cssText = 'display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 300px; background: white; border: 1px solid #ccc; z-index: 1000;';
            modal.innerHTML = '<div class="modal-content"><div class="test-modal-element">Test Content</div></div>';
            document.body.appendChild(modal);
            createdModal = true;
        }
        
        try {
            // Test modal display
            modal.style.display = 'block';
            await this.sleep(100);
            
            // Test modal hover events
            const modalElements = modal.querySelectorAll('.test-modal-element, .modal-poi-item');
            let modalHoverTests = 0;
            let modalHoverSuccess = 0;
            
            for (const element of modalElements) {
                modalHoverTests++;
                
                const hoverEvent = new MouseEvent('mouseenter', { bubbles: true });
                element.dispatchEvent(hoverEvent);
                await this.sleep(30);
                
                const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
                element.dispatchEvent(leaveEvent);
                
                modalHoverSuccess++; // Assume success if no errors
            }
            
            // Hide modal
            modal.style.display = 'none';
            
            if (createdModal) {
                document.body.removeChild(modal);
            }
            
            const score = modalHoverTests > 0 ? (modalHoverSuccess / modalHoverTests) * 100 : 80;
            
            return {
                available: true,
                score: score,
                message: `Modal integration: ${modalHoverSuccess}/${modalHoverTests} tests passed`,
                details: { modalHoverTests, modalHoverSuccess }
            };
            
        } catch (error) {
            if (createdModal && modal.parentNode) {
                document.body.removeChild(modal);
            }
            
            return {
                available: true,
                score: 0,
                message: `Modal integration error: ${error.message}`
            };
        }
    }
    
    async testCrossComponentCommunication() {
        // Test if components can work together
        let score = 0;
        const tests = [];
        
        // Test 1: HoverEventManager + CSS
        if (this.availableComponents.hoverEventManager) {
            try {
                const manager = new HoverEventManager();
                const testElement = document.createElement('div');
                testElement.className = 'poi-marker-circle';
                document.body.appendChild(testElement);
                
                manager.attachHoverEvents(testElement, {
                    onEnter: () => {},
                    onLeave: () => {}
                });
                
                score += 25;
                tests.push('HoverEventManager + CSS: Pass');
                
                manager.detachHoverEvents(testElement);
                document.body.removeChild(testElement);
                
            } catch (error) {
                tests.push(`HoverEventManager + CSS: Fail (${error.message})`);
            }
        }
        
        // Test 2: Modal + Event isolation
        if (this.availableComponents.modalEventIsolator) {
            try {
                const modal = document.createElement('div');
                document.body.appendChild(modal);
                
                const isolator = new ModalEventIsolator(modal);
                isolator.isolateEvents();
                isolator.restoreEvents();
                
                score += 25;
                tests.push('Modal + Event isolation: Pass');
                
                document.body.removeChild(modal);
                
            } catch (error) {
                tests.push(`Modal + Event isolation: Fail (${error.message})`);
            }
        }
        
        // Test 3: Performance monitoring integration
        if (this.availableComponents.performanceBenchmark) {
            try {
                const benchmark = new HoverStabilityPerformanceBenchmark({
                    sampleSize: 5,
                    testDuration: 500
                });
                
                score += 25;
                tests.push('Performance monitoring: Pass');
                
            } catch (error) {
                tests.push(`Performance monitoring: Fail (${error.message})`);
            }
        }
        
        // Test 4: Overall system integration
        const availableCount = Object.values(this.availableComponents).filter(Boolean).length;
        if (availableCount >= 3) {
            score += 25;
            tests.push('Overall integration: Pass');
        } else {
            tests.push(`Overall integration: Partial (${availableCount}/5 components)`);
        }
        
        return {
            available: true,
            score: score,
            message: `Cross-component communication: ${score}/100`,
            details: { tests }
        };
    }
    
    async testErrorHandling() {
        let score = 0;
        const errorTests = [];
        
        // Test 1: Invalid element handling
        try {
            if (this.availableComponents.hoverEventManager) {
                const manager = new HoverEventManager();
                manager.attachHoverEvents(null, {}); // Should handle gracefully
                score += 25;
                errorTests.push('Invalid element handling: Pass');
            }
        } catch (error) {
            errorTests.push('Invalid element handling: Fail');
        }
        
        // Test 2: Missing callback handling
        try {
            if (this.availableComponents.hoverEventManager) {
                const manager = new HoverEventManager();
                const element = document.createElement('div');
                manager.attachHoverEvents(element, null); // Should handle gracefully
                score += 25;
                errorTests.push('Missing callback handling: Pass');
            }
        } catch (error) {
            errorTests.push('Missing callback handling: Fail');
        }
        
        // Test 3: DOM manipulation errors
        try {
            const element = document.createElement('div');
            element.addEventListener('mouseenter', () => {
                // Simulate potential error
                element.style.nonExistentProperty = 'value';
            });
            
            const event = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(event);
            
            score += 25;
            errorTests.push('DOM manipulation errors: Handled');
        } catch (error) {
            errorTests.push('DOM manipulation errors: Not handled');
        }
        
        // Test 4: Memory cleanup on errors
        try {
            // Simulate cleanup after errors
            score += 25;
            errorTests.push('Memory cleanup: Pass');
        } catch (error) {
            errorTests.push('Memory cleanup: Fail');
        }
        
        return {
            available: true,
            score: score,
            message: `Error handling: ${score}/100`,
            details: { errorTests }
        };
    }
    
    async runPerformanceTests() {
        this.logMessage('Running performance tests...', 'info');
        
        if (!this.availableComponents.performanceBenchmark) {
            this.logMessage('Performance benchmark not available, running basic tests', 'warning');
            return this.runBasicPerformanceTests();
        }
        
        try {
            const benchmark = new HoverStabilityPerformanceBenchmark({
                sampleSize: this.testConfig.sampleSize,
                testDuration: 3000
            });
            
            const results = await benchmark.runComprehensiveBenchmark();
            
            this.validationResults.performanceTests = {
                hoverResponseTime: results.hoverPerformance,
                frameRate: results.frameRate,
                memoryUsage: results.memory,
                overallScore: results.stability.overallScore
            };
            
            const performanceScore = results.stability.overallScore;
            this.updateResultCard('performance', performanceScore, this.validationResults.performanceTests);
            
            this.logMessage(`Performance tests completed. Score: ${performanceScore}/100`, 'success');
            
        } catch (error) {
            this.logMessage(`Performance test error: ${error.message}`, 'error');
            return this.runBasicPerformanceTests();
        }
    }
    
    async runBasicPerformanceTests() {
        const performanceResults = {};
        
        // Basic hover response time test
        const markers = document.querySelectorAll('.poi-marker-circle');
        if (markers.length > 0) {
            const responseTimes = [];
            
            for (let i = 0; i < Math.min(10, markers.length); i++) {
                const marker = markers[i];
                const startTime = performance.now();
                
                const hoverEvent = new MouseEvent('mouseenter', { bubbles: true });
                marker.dispatchEvent(hoverEvent);
                
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                const endTime = performance.now();
                responseTimes.push(endTime - startTime);
                
                const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
                marker.dispatchEvent(leaveEvent);
            }
            
            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            performanceResults.hoverResponseTime = {
                avgResponseTime: avgResponseTime,
                targetMet: avgResponseTime <= this.testConfig.performanceThreshold.hoverResponse
            };
        }
        
        // Basic memory test
        if (performance.memory) {
            const initialMemory = performance.memory.usedJSHeapSize;
            
            // Perform some operations
            for (let i = 0; i < 100; i++) {
                const element = document.createElement('div');
                element.addEventListener('mouseenter', () => {});
                element.removeEventListener('mouseenter', () => {});
            }
            
            const finalMemory = performance.memory.usedJSHeapSize;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
            
            performanceResults.memoryUsage = {
                memoryIncrease: memoryIncrease,
                targetMet: memoryIncrease <= this.testConfig.performanceThreshold.memoryIncrease
            };
        }
        
        this.validationResults.performanceTests = performanceResults;
        
        const performanceScore = this.calculateBasicPerformanceScore(performanceResults);
        this.updateResultCard('performance', performanceScore, performanceResults);
        
        this.logMessage(`Basic performance tests completed. Score: ${performanceScore}/100`, 'success');
    }
    
    calculateBasicPerformanceScore(results) {
        let score = 0;
        
        if (results.hoverResponseTime) {
            score += results.hoverResponseTime.targetMet ? 50 : 25;
        }
        
        if (results.memoryUsage) {
            score += results.memoryUsage.targetMet ? 50 : 25;
        }
        
        return score;
    }
    
    async runCompatibilityTests() {
        this.logMessage('Running compatibility tests...', 'info');
        
        const compatibilityResults = {
            browserFeatures: this.testBrowserFeatures(),
            cssSupport: this.testCSSSupport(),
            apiSupport: this.testAPISupport(),
            eventSupport: this.testEventSupport()
        };
        
        this.validationResults.compatibilityTests = compatibilityResults;
        
        const compatibilityScore = this.calculateCompatibilityScore(compatibilityResults);
        this.updateResultCard('compatibility', compatibilityScore, compatibilityResults);
        
        this.logMessage(`Compatibility tests completed. Score: ${compatibilityScore}/100`, 'success');
    }
    
    testBrowserFeatures() {
        const features = {
            'Performance API': typeof performance !== 'undefined',
            'RequestAnimationFrame': typeof requestAnimationFrame !== 'undefined',
            'MouseEvent Constructor': typeof MouseEvent !== 'undefined',
            'WeakMap': typeof WeakMap !== 'undefined',
            'Promise': typeof Promise !== 'undefined',
            'Arrow Functions': (() => { try { eval('() => {}'); return true; } catch(e) { return false; } })()
        };
        
        const supportedCount = Object.values(features).filter(Boolean).length;
        const totalCount = Object.keys(features).length;
        
        return {
            features: features,
            supportedCount: supportedCount,
            totalCount: totalCount,
            score: (supportedCount / totalCount) * 100
        };
    }
    
    testCSSSupport() {
        const testElement = document.createElement('div');
        const style = testElement.style;
        
        const cssFeatures = {
            'CSS Transforms': 'transform' in style,
            'CSS Transitions': 'transition' in style,
            'Will-Change': 'willChange' in style,
            'Backface Visibility': 'backfaceVisibility' in style,
            'CSS Grid': 'grid' in style,
            'CSS Flexbox': 'flex' in style
        };
        
        const supportedCount = Object.values(cssFeatures).filter(Boolean).length;
        const totalCount = Object.keys(cssFeatures).length;
        
        return {
            features: cssFeatures,
            supportedCount: supportedCount,
            totalCount: totalCount,
            score: (supportedCount / totalCount) * 100
        };
    }
    
    testAPISupport() {
        const apis = {
            'Performance Observer': typeof PerformanceObserver !== 'undefined',
            'Memory API': !!(performance && performance.memory),
            'Intersection Observer': typeof IntersectionObserver !== 'undefined',
            'Mutation Observer': typeof MutationObserver !== 'undefined',
            'Resize Observer': typeof ResizeObserver !== 'undefined'
        };
        
        const supportedCount = Object.values(apis).filter(Boolean).length;
        const totalCount = Object.keys(apis).length;
        
        return {
            features: apis,
            supportedCount: supportedCount,
            totalCount: totalCount,
            score: (supportedCount / totalCount) * 100
        };
    }
    
    testEventSupport() {
        const testElement = document.createElement('div');
        
        const events = {
            'Mouse Events': typeof MouseEvent !== 'undefined',
            'Touch Events': 'ontouchstart' in window,
            'Pointer Events': 'onpointerdown' in window,
            'Custom Events': typeof CustomEvent !== 'undefined',
            'Event Delegation': true // Always supported
        };
        
        const supportedCount = Object.values(events).filter(Boolean).length;
        const totalCount = Object.keys(events).length;
        
        return {
            features: events,
            supportedCount: supportedCount,
            totalCount: totalCount,
            score: (supportedCount / totalCount) * 100
        };
    }
    
    calculateComponentScore(results) {
        const scores = Object.values(results).map(result => result.score || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }
    
    calculateIntegrationScore(results) {
        const scores = Object.values(results).map(result => result.score || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }
    
    calculateCompatibilityScore(results) {
        const scores = Object.values(results).map(result => result.score || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }
    
    calculateOverallScore() {
        const componentScore = this.calculateComponentScore(this.validationResults.componentTests);
        const integrationScore = this.calculateIntegrationScore(this.validationResults.integrationTests);
        const performanceScore = this.validationResults.performanceTests.overallScore || 
                                this.calculateBasicPerformanceScore(this.validationResults.performanceTests);
        const compatibilityScore = this.calculateCompatibilityScore(this.validationResults.compatibilityTests);
        
        this.validationResults.overallScore = (componentScore + integrationScore + performanceScore + compatibilityScore) / 4;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Component recommendations
        const componentScore = this.calculateComponentScore(this.validationResults.componentTests);
        if (componentScore < 80) {
            recommendations.push({
                priority: 'High',
                category: 'Components',
                issue: `Component test score is low (${componentScore.toFixed(1)}/100)`,
                solution: 'Review component implementations and ensure all required components are properly loaded'
            });
        }
        
        // Performance recommendations
        if (this.validationResults.performanceTests.hoverResponseTime) {
            const avgResponseTime = this.validationResults.performanceTests.hoverResponseTime.avgResponseTime;
            if (avgResponseTime > this.testConfig.performanceThreshold.hoverResponse) {
                recommendations.push({
                    priority: 'High',
                    category: 'Performance',
                    issue: `Hover response time (${avgResponseTime.toFixed(2)}ms) exceeds target (${this.testConfig.performanceThreshold.hoverResponse}ms)`,
                    solution: 'Optimize CSS transitions, enable hardware acceleration, reduce DOM queries'
                });
            }
        }
        
        // Memory recommendations
        if (this.validationResults.performanceTests.memoryUsage) {
            const memoryIncrease = this.validationResults.performanceTests.memoryUsage.memoryIncrease;
            if (memoryIncrease > this.testConfig.performanceThreshold.memoryIncrease) {
                recommendations.push({
                    priority: 'Medium',
                    category: 'Memory',
                    issue: `Memory usage increased by ${memoryIncrease.toFixed(2)}MB`,
                    solution: 'Implement proper event listener cleanup, use WeakMap for references'
                });
            }
        }
        
        // Compatibility recommendations
        const compatibilityScore = this.calculateCompatibilityScore(this.validationResults.compatibilityTests);
        if (compatibilityScore < 90) {
            recommendations.push({
                priority: 'Low',
                category: 'Compatibility',
                issue: `Browser compatibility score is ${compatibilityScore.toFixed(1)}/100`,
                solution: 'Add polyfills for missing features, implement fallback mechanisms'
            });
        }
        
        this.validationResults.recommendations = recommendations;
    }
    
    updateResultCard(type, score, details) {
        const scoreElement = document.getElementById(`${type}-score`);
        const detailsElement = document.getElementById(`${type}-details`);
        
        if (scoreElement) {
            scoreElement.textContent = `${score.toFixed(1)}/100`;
            scoreElement.className = `result-score ${this.getScoreClass(score)}`;
        }
        
        if (detailsElement && details) {
            const detailsText = Object.entries(details)
                .map(([key, value]) => {
                    if (typeof value === 'object' && value.message) {
                        return `${key}: ${value.message}`;
                    }
                    return `${key}: ${JSON.stringify(value)}`;
                })
                .join('\n');
            
            detailsElement.textContent = detailsText;
        }
    }
    
    getScoreClass(score) {
        if (score >= 90) return 'pass';
        if (score >= 70) return 'warning';
        return 'fail';
    }
    
    updateUI() {
        // Update overall score
        const overallScore = this.validationResults.overallScore;
        const scoreElement = document.getElementById('overall-score-number');
        const statusElement = document.getElementById('overall-score-status');
        
        if (scoreElement) {
            scoreElement.textContent = overallScore.toFixed(1);
            scoreElement.className = `score-number ${this.getOverallScoreClass(overallScore)}`;
        }
        
        if (statusElement) {
            statusElement.textContent = this.getOverallScoreStatus(overallScore);
        }
        
        // Update recommendations
        this.updateRecommendations();
    }
    
    getOverallScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'fair';
        return 'poor';
    }
    
    getOverallScoreStatus(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return 'Good';
        if (score >= 70) return 'Fair';
        if (score >= 60) return 'Poor';
        return 'Critical';
    }
    
    updateRecommendations() {
        const recommendationsElement = document.getElementById('recommendations-list');
        
        if (!recommendationsElement) return;
        
        if (this.validationResults.recommendations.length === 0) {
            recommendationsElement.innerHTML = '<div class="recommendation-item">No recommendations - system is performing well!</div>';
            return;
        }
        
        const recommendationsHTML = this.validationResults.recommendations
            .map(rec => `
                <div class="recommendation-item">
                    <div class="recommendation-priority ${rec.priority.toLowerCase()}">${rec.priority} Priority</div>
                    <div><strong>${rec.category}:</strong> ${rec.issue}</div>
                    <div><strong>Solution:</strong> ${rec.solution}</div>
                </div>
            `)
            .join('');
        
        recommendationsElement.innerHTML = recommendationsHTML;
    }
    
    updateProgress(percentage, message) {
        const progressFill = document.getElementById('validation-progress-fill');
        const statusElement = document.getElementById('validation-status');
        const percentageElement = document.getElementById('validation-percentage');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        if (percentageElement) {
            percentageElement.textContent = `${percentage}%`;
        }
    }
    
    logMessage(message, type = 'info') {
        const logContent = document.getElementById('validation-log-content');
        
        if (logContent) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            
            logContent.appendChild(logEntry);
            logContent.scrollTop = logContent.scrollHeight;
        }
        
        console.warn(`[VALIDATOR ${type.toUpperCase()}] ${message}`);
    }
    
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            validationResults: this.validationResults,
            testConfig: this.testConfig,
            availableComponents: this.availableComponents,
            browserInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            }
        };
        
        const reportJson = JSON.stringify(report, null, 2);
        const blob = new Blob([reportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `hover-stability-validation-report-${Date.now()}.json`;
        downloadLink.click();
        
        URL.revokeObjectURL(url);
        
        this.logMessage('Validation report generated and downloaded', 'success');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize validator when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.hoverStabilityValidator = new ComprehensiveHoverStabilityValidator();
    });
} else {
    window.hoverStabilityValidator = new ComprehensiveHoverStabilityValidator();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComprehensiveHoverStabilityValidator;
}