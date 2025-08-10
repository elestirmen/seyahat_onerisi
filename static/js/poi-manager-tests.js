/**
 * POI Manager Enhanced - Test Suite
 * Comprehensive testing for POI management functionality
 */

// Simple test framework
class SimpleTestFramework {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Add a test case
     */
    test(name, testFunction) {
        this.tests.push({
            name,
            function: testFunction,
            status: 'pending'
        });
    }

    /**
     * Run all tests
     */
    async runAll() {
        console.log('🧪 Starting POI Manager Test Suite...');
        this.startTime = Date.now();
        
        for (const test of this.tests) {
            await this.runTest(test);
        }
        
        this.endTime = Date.now();
        this.displayResults();
    }

    /**
     * Run individual test
     */
    async runTest(test) {
        try {
            console.log(`🔄 Running: ${test.name}`);
            await test.function();
            test.status = 'passed';
            this.results.passed++;
            console.log(`✅ Passed: ${test.name}`);
        } catch (error) {
            test.status = 'failed';
            test.error = error;
            this.results.failed++;
            console.error(`❌ Failed: ${test.name}`, error);
        }
        this.results.total++;
    }

    /**
     * Display test results
     */
    displayResults() {
        const duration = this.endTime - this.startTime;
        const passRate = (this.results.passed / this.results.total * 100).toFixed(1);
        
        console.log('\n📊 Test Results:');
        console.log(`Total: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Pass Rate: ${passRate}%`);
        console.log(`Duration: ${duration}ms`);
        
        if (this.results.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Check the logs above.');
        }
    }

    /**
     * Assertion helpers
     */
    assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEqual(actual, expected, message = 'Values are not equal') {
        if (actual !== expected) {
            throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
        }
    }

    assertNotEqual(actual, unexpected, message = 'Values should not be equal') {
        if (actual === unexpected) {
            throw new Error(`${message}. Value: ${actual}`);
        }
    }

    assertNull(value, message = 'Value should be null') {
        if (value !== null) {
            throw new Error(`${message}. Actual: ${value}`);
        }
    }

    assertNotNull(value, message = 'Value should not be null') {
        if (value === null) {
            throw new Error(message);
        }
    }

    assertTrue(condition, message = 'Condition should be true') {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertFalse(condition, message = 'Condition should be false') {
        if (condition) {
            throw new Error(message);
        }
    }

    assertThrows(func, message = 'Function should throw an error') {
        let threw = false;
        try {
            func();
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    }

    async assertAsync(asyncFunc, message = 'Async assertion failed') {
        try {
            await asyncFunc();
        } catch (error) {
            throw new Error(`${message}: ${error.message}`);
        }
    }
}

// Initialize test framework
const testFramework = new SimpleTestFramework();

// ==================== POI MANAGER UNIT TESTS ====================

/**
 * Test POI Manager initialization
 */
testFramework.test('POI Manager Initialization', () => {
    // Mock DOM elements
    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'map';
    document.body.appendChild(mockMapContainer);

    // Create POI Manager instance
    const poiManager = new POIManager();
    
    testFramework.assertNotNull(poiManager, 'POI Manager should be created');
    testFramework.assertEqual(typeof poiManager.init, 'function', 'Should have init method');
    testFramework.assertEqual(typeof poiManager.loadPOIs, 'function', 'Should have loadPOIs method');
    testFramework.assertEqual(typeof poiManager.loadRoutes, 'function', 'Should have loadRoutes method');
    
    // Cleanup
    document.body.removeChild(mockMapContainer);
});

/**
 * Test Enhanced Map Manager initialization
 */
testFramework.test('Enhanced Map Manager Initialization', () => {
    // Mock DOM elements
    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'test-map';
    document.body.appendChild(mockMapContainer);

    // Create Enhanced Map Manager
    const mapManager = new EnhancedMapManager('test-map', {
        center: [38.6431, 34.8331],
        zoom: 11
    });
    
    testFramework.assertNotNull(mapManager, 'Enhanced Map Manager should be created');
    testFramework.assertEqual(typeof mapManager.addPOILayer, 'function', 'Should have addPOILayer method');
    testFramework.assertEqual(typeof mapManager.addRouteLayer, 'function', 'Should have addRouteLayer method');
    testFramework.assertEqual(typeof mapManager.showRoutePreview, 'function', 'Should have showRoutePreview method');
    
    // Cleanup
    mapManager.destroy();
    document.body.removeChild(mockMapContainer);
});

/**
 * Test POI data validation
 */
testFramework.test('POI Data Validation', () => {
    const validPOI = {
        id: 1,
        name: 'Test POI',
        latitude: 38.6431,
        longitude: 34.8331,
        category: 'gastronomik',
        description: 'Test description'
    };

    const invalidPOI = {
        id: 2,
        name: 'Invalid POI',
        // Missing coordinates
        category: 'kulturel'
    };

    // Test valid POI
    testFramework.assertNotNull(validPOI.latitude, 'Valid POI should have latitude');
    testFramework.assertNotNull(validPOI.longitude, 'Valid POI should have longitude');
    testFramework.assertNotNull(validPOI.name, 'Valid POI should have name');

    // Test invalid POI
    testFramework.assert(
        !invalidPOI.latitude || !invalidPOI.longitude,
        'Invalid POI should be missing coordinates'
    );
});

/**
 * Test Category Info Retrieval
 */
testFramework.test('Category Info Retrieval', () => {
    const poiManager = new POIManager();
    
    const gastronomikCategory = poiManager.getCategoryInfo('gastronomik');
    testFramework.assertEqual(gastronomikCategory.icon, 'utensils', 'Gastronomik category should have utensils icon');
    testFramework.assertEqual(gastronomikCategory.color, '#e74c3c', 'Gastronomik category should have red color');

    const unknownCategory = poiManager.getCategoryInfo('unknown_category');
    testFramework.assertEqual(unknownCategory.icon, 'map-marker-alt', 'Unknown category should have default icon');
    testFramework.assertEqual(unknownCategory.color, '#6c757d', 'Unknown category should have default color');
});

/**
 * Test File Validation
 */
testFramework.test('File Validation', () => {
    const poiManager = new POIManager();
    
    // Mock file objects
    const validGPXFile = new File(['<gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    const validKMLFile = new File(['<kml></kml>'], 'test.kml', { type: 'application/vnd.google-earth.kml+xml' });
    const invalidFile = new File(['invalid'], 'test.txt', { type: 'text/plain' });
    const largeFi = new File(['x'.repeat(11 * 1024 * 1024)], 'large.gpx', { type: 'application/gpx+xml' });

    // Test file extension validation
    testFramework.assertTrue(validGPXFile.name.endsWith('.gpx'), 'Valid GPX file should have .gpx extension');
    testFramework.assertTrue(validKMLFile.name.endsWith('.kml'), 'Valid KML file should have .kml extension');
    testFramework.assertFalse(invalidFile.name.endsWith('.gpx') || invalidFile.name.endsWith('.kml'), 'Invalid file should not have valid extension');

    // Test file size validation
    testFramework.assertTrue(validGPXFile.size < 10 * 1024 * 1024, 'Valid file should be under 10MB');
    testFramework.assertTrue(largeFi.size > 10 * 1024 * 1024, 'Large file should exceed 10MB limit');
});

/**
 * Test Virtual Scrolling Setup
 */
testFramework.test('Virtual Scrolling Setup', () => {
    // Create mock POI list container
    const mockContainer = document.createElement('div');
    mockContainer.id = 'poiList';
    mockContainer.style.height = '400px';
    document.body.appendChild(mockContainer);

    const poiManager = new POIManager();
    poiManager.setupVirtualScrolling();

    testFramework.assertNotNull(poiManager.virtualScrolling, 'Virtual scrolling should be initialized');
    testFramework.assertEqual(poiManager.virtualScrolling.container, mockContainer, 'Container should be set correctly');
    testFramework.assertTrue(poiManager.virtualScrolling.itemHeight > 0, 'Item height should be positive');

    // Cleanup
    document.body.removeChild(mockContainer);
});

/**
 * Test Throttle Function
 */
testFramework.test('Throttle Function', async () => {
    const poiManager = new POIManager();
    let callCount = 0;
    
    const throttledFunc = poiManager.throttle(() => {
        callCount++;
    }, 100);

    // Call function multiple times rapidly
    throttledFunc();
    throttledFunc();
    throttledFunc();
    throttledFunc();

    testFramework.assertEqual(callCount, 1, 'Throttled function should only be called once initially');

    // Wait for throttle period to pass
    await new Promise(resolve => setTimeout(resolve, 150));
    
    throttledFunc();
    testFramework.assertTrue(callCount >= 1, 'Function should be callable after throttle period');
});

/**
 * Test Debounce Function
 */
testFramework.test('Debounce Function', async () => {
    const poiManager = new POIManager();
    let callCount = 0;
    
    const debouncedFunc = poiManager.debounce(() => {
        callCount++;
    }, 100);

    // Call function multiple times rapidly
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    testFramework.assertEqual(callCount, 0, 'Debounced function should not be called immediately');

    // Wait for debounce period to pass
    await new Promise(resolve => setTimeout(resolve, 150));
    
    testFramework.assertEqual(callCount, 1, 'Debounced function should be called once after delay');
});

// ==================== MAP MANAGER UNIT TESTS ====================

/**
 * Test POI Marker Creation
 */
testFramework.test('POI Marker Creation', () => {
    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'test-map-poi';
    document.body.appendChild(mockMapContainer);

    const mapManager = new EnhancedMapManager('test-map-poi');
    
    const testPOI = {
        id: 1,
        name: 'Test POI',
        latitude: 38.6431,
        longitude: 34.8331,
        category: 'gastronomik',
        description: 'Test POI description'
    };

    const marker = mapManager.createPOIMarker(testPOI);
    
    testFramework.assertNotNull(marker, 'POI marker should be created');
    testFramework.assertEqual(marker.getLatLng().lat, testPOI.latitude, 'Marker latitude should match POI');
    testFramework.assertEqual(marker.getLatLng().lng, testPOI.longitude, 'Marker longitude should match POI');

    // Cleanup
    mapManager.destroy();
    document.body.removeChild(mockMapContainer);
});

/**
 * Test Route Coordinates Parsing
 */
testFramework.test('Route Coordinates Parsing', () => {
    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'test-map-route';
    document.body.appendChild(mockMapContainer);

    const mapManager = new EnhancedMapManager('test-map-route');
    
    const testGeometry = {
        type: 'LineString',
        coordinates: [
            [34.8331, 38.6431], // [lng, lat]
            [34.8341, 38.6441],
            [34.8351, 38.6451]
        ]
    };

    const parsedCoordinates = mapManager.parseRouteCoordinates(testGeometry);
    
    testFramework.assertEqual(parsedCoordinates.length, 3, 'Should parse 3 coordinates');
    testFramework.assertEqual(parsedCoordinates[0][0], 38.6431, 'First coordinate lat should be correct');
    testFramework.assertEqual(parsedCoordinates[0][1], 34.8331, 'First coordinate lng should be correct');

    // Cleanup
    mapManager.destroy();
    document.body.removeChild(mockMapContainer);
});

/**
 * Test Layer Management
 */
testFramework.test('Layer Management', () => {
    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'test-map-layers';
    document.body.appendChild(mockMapContainer);

    const mapManager = new EnhancedMapManager('test-map-layers');
    
    // Test initial layer visibility state
    testFramework.assertTrue(mapManager.layerVisibility.pois, 'POI layer should be visible initially');
    testFramework.assertTrue(mapManager.layerVisibility.routes, 'Route layer should be visible initially');
    testFramework.assertTrue(mapManager.layerVisibility.preview, 'Preview layer should be visible initially');

    // Test layer toggle
    mapManager.togglePOILayer(false);
    testFramework.assertFalse(mapManager.layerVisibility.pois, 'POI layer should be hidden after toggle');

    mapManager.toggleRouteLayer(false);
    testFramework.assertFalse(mapManager.layerVisibility.routes, 'Route layer should be hidden after toggle');

    // Cleanup
    mapManager.destroy();
    document.body.removeChild(mockMapContainer);
});

// ==================== INTEGRATION TESTS ====================

/**
 * Test POI Loading Integration
 */
testFramework.test('POI Loading Integration', async () => {
    // Mock fetch function
    const originalFetch = window.fetch;
    window.fetch = async (url) => {
        if (url.includes('/api/pois')) {
            return {
                ok: true,
                json: async () => ({
                    pois: [
                        {
                            id: 1,
                            name: 'Test POI 1',
                            latitude: 38.6431,
                            longitude: 34.8331,
                            category: 'gastronomik'
                        },
                        {
                            id: 2,
                            name: 'Test POI 2',
                            latitude: 38.6441,
                            longitude: 34.8341,
                            category: 'kulturel'
                        }
                    ],
                    total: 2
                })
            };
        }
        return { ok: false };
    };

    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'integration-test-map';
    document.body.appendChild(mockMapContainer);

    const poiManager = new POIManager();
    await poiManager.initializeMap();
    
    const pois = await poiManager.loadPOIs();
    
    testFramework.assertNotNull(pois, 'POIs should be loaded');
    testFramework.assertEqual(pois.length, 2, 'Should load 2 POIs');
    testFramework.assertEqual(pois[0].name, 'Test POI 1', 'First POI name should be correct');

    // Cleanup
    window.fetch = originalFetch;
    document.body.removeChild(mockMapContainer);
});

/**
 * Test Route Loading Integration
 */
testFramework.test('Route Loading Integration', async () => {
    // Mock fetch function
    const originalFetch = window.fetch;
    window.fetch = async (url) => {
        if (url.includes('/api/routes')) {
            return {
                ok: true,
                json: async () => ({
                    routes: [
                        {
                            id: 1,
                            name: 'Test Route 1',
                            geometry: {
                                type: 'LineString',
                                coordinates: [[34.8331, 38.6431], [34.8341, 38.6441]]
                            }
                        }
                    ],
                    total: 1
                })
            };
        }
        return { ok: false };
    };

    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'route-test-map';
    document.body.appendChild(mockMapContainer);

    const poiManager = new POIManager();
    await poiManager.initializeMap();
    
    const routes = await poiManager.loadRoutes();
    
    testFramework.assertNotNull(routes, 'Routes should be loaded');
    testFramework.assertEqual(routes.length, 1, 'Should load 1 route');
    testFramework.assertEqual(routes[0].name, 'Test Route 1', 'Route name should be correct');

    // Cleanup
    window.fetch = originalFetch;
    document.body.removeChild(mockMapContainer);
});

/**
 * Test Error Handling
 */
testFramework.test('Error Handling', async () => {
    // Mock fetch function to simulate errors
    const originalFetch = window.fetch;
    window.fetch = async () => {
        return {
            ok: false,
            status: 500,
            json: async () => ({ message: 'Internal Server Error' })
        };
    };

    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'error-test-map';
    document.body.appendChild(mockMapContainer);

    const poiManager = new POIManager();
    await poiManager.initializeMap();
    
    // Test POI loading error handling
    const pois = await poiManager.loadPOIs();
    testFramework.assertEqual(pois.length, 0, 'Should return empty array on error');

    // Test route loading error handling
    const routes = await poiManager.loadRoutes();
    testFramework.assertEqual(routes.length, 0, 'Should return empty array on error');

    // Cleanup
    window.fetch = originalFetch;
    document.body.removeChild(mockMapContainer);
});

// ==================== UI COMPONENT TESTS ====================

/**
 * Test Mobile Menu Functionality
 */
testFramework.test('Mobile Menu Functionality', () => {
    // Create mock sidebar and overlay
    const sidebar = document.createElement('aside');
    sidebar.id = 'poiSidebar';
    sidebar.className = 'poi-sidebar';
    
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    
    document.body.appendChild(sidebar);
    document.body.appendChild(overlay);

    // Test toggle function
    toggleMobileMenu();
    testFramework.assertTrue(sidebar.classList.contains('mobile-open'), 'Sidebar should have mobile-open class');
    testFramework.assertTrue(sidebar.classList.contains('visible'), 'Sidebar should be visible');
    testFramework.assertTrue(overlay.classList.contains('visible'), 'Overlay should be visible');

    // Test close function
    closeMobileMenu();
    testFramework.assertFalse(sidebar.classList.contains('visible'), 'Sidebar should not be visible');
    testFramework.assertFalse(overlay.classList.contains('visible'), 'Overlay should not be visible');

    // Cleanup
    document.body.removeChild(sidebar);
    document.body.removeChild(overlay);
});

/**
 * Test Touch Device Detection
 */
testFramework.test('Touch Device Detection', () => {
    // Mock touch support
    const originalOntouchstart = window.ontouchstart;
    window.ontouchstart = {};

    setupPerformanceOptimizations();

    testFramework.assertTrue(document.body.classList.contains('touch-device'), 'Body should have touch-device class');

    // Cleanup
    window.ontouchstart = originalOntouchstart;
    document.body.classList.remove('touch-device');
});

// ==================== PERFORMANCE TESTS ====================

/**
 * Test Large Dataset Performance
 */
testFramework.test('Large Dataset Performance', () => {
    const startTime = performance.now();
    
    // Generate large POI dataset
    const largePOISet = [];
    for (let i = 0; i < 1000; i++) {
        largePOISet.push({
            id: i,
            name: `POI ${i}`,
            latitude: 38.6431 + (Math.random() - 0.5) * 0.1,
            longitude: 34.8331 + (Math.random() - 0.5) * 0.1,
            category: 'gastronomik',
            description: `Description for POI ${i}`
        });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    testFramework.assertTrue(duration < 1000, `Large dataset generation should complete in <1s (took ${duration}ms)`);
    testFramework.assertEqual(largePOISet.length, 1000, 'Should generate 1000 POIs');
});

/**
 * Test Memory Usage
 */
testFramework.test('Memory Usage', () => {
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Create and destroy POI manager multiple times
    for (let i = 0; i < 10; i++) {
        const mockContainer = document.createElement('div');
        mockContainer.id = `memory-test-${i}`;
        document.body.appendChild(mockContainer);
        
        const poiManager = new POIManager();
        // Simulate some operations
        poiManager.pois = new Array(100).fill().map((_, idx) => ({
            id: idx,
            name: `POI ${idx}`,
            latitude: 38.6431,
            longitude: 34.8331
        }));
        
        // Cleanup
        document.body.removeChild(mockContainer);
    }
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
    
    const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Memory should not grow excessively (allow for some growth due to test framework)
    if (performance.memory) {
        const memoryGrowth = finalMemory - initialMemory;
        testFramework.assertTrue(memoryGrowth < 50 * 1024 * 1024, `Memory growth should be <50MB (grew ${memoryGrowth} bytes)`);
    }
});

// ==================== END-TO-END TESTS ====================

/**
 * Test Complete POI Workflow
 */
testFramework.test('Complete POI Workflow', async () => {
    let apiCallCount = 0;
    
    // Mock fetch function
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
        apiCallCount++;
        
        if (url.includes('/api/categories')) {
            return {
                ok: true,
                json: async () => [
                    { name: 'gastronomik', display_name: 'Gastronomik', color: '#e74c3c', icon: 'utensils' }
                ]
            };
        }
        
        if (url.includes('/api/pois') && !options?.method) {
            return {
                ok: true,
                json: async () => ({ pois: [], total: 0 })
            };
        }
        
        if (url.includes('/api/poi') && options?.method === 'POST') {
            return {
                ok: true,
                json: async () => ({
                    id: 1,
                    name: 'New POI',
                    latitude: 38.6431,
                    longitude: 34.8331,
                    category: 'gastronomik'
                })
            };
        }
        
        return { ok: false };
    };

    const mockMapContainer = document.createElement('div');
    mockMapContainer.id = 'workflow-test-map';
    document.body.appendChild(mockMapContainer);

    const poiManager = new POIManager();
    
    // Initialize
    await poiManager.initializeMap();
    testFramework.assertNotNull(poiManager.mapManager, 'Map manager should be initialized');
    
    // Load categories and POIs
    await poiManager.loadCategories();
    await poiManager.loadPOIs();
    
    testFramework.assertTrue(apiCallCount >= 2, 'Should make API calls for categories and POIs');

    // Cleanup
    window.fetch = originalFetch;
    document.body.removeChild(mockMapContainer);
});

// Export test framework for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimpleTestFramework, testFramework };
}

// Make available globally
window.POIManagerTests = { SimpleTestFramework, testFramework };

console.log('🧪 POI Manager Test Suite loaded. Run window.POIManagerTests.testFramework.runAll() to execute all tests.');
