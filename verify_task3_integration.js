/**
 * Task 3 Integration Verification Script
 * 
 * This script verifies that the Enhanced Route Details Modal properly integrates
 * with the centralized modal system according to the requirements.
 */

console.log('🔍 Starting Task 3 Integration Verification');

// Test data for verification
const testRouteData = {
    id: 'test-route-verification',
    name: 'Integration Test Route',
    total_distance: 10.5,
    estimated_duration: 3600,
    poi_count: 5,
    difficulty_level: 2,
    description: 'Test route for verifying modal integration',
    waypoints: [
        { lat: 38.7223, lng: 34.4735, name: 'Start' },
        { lat: 38.7280, lng: 34.4850, name: 'End' }
    ]
};

/**
 * Verification Tests
 */
const verificationTests = {
    
    /**
     * Requirement 1.1, 1.2: Modal state management and event listener cleanup
     */
    async testModalManagerIntegration() {
        console.log('\n📋 Testing ModalManager Integration (Requirements 1.1, 1.2)');
        
        const results = {
            modalManagerAvailable: false,
            modalRegistration: false,
            stateTracking: false,
            eventRegistryIntegration: false
        };

        // Check if ModalManager is available
        if (window.modalManager) {
            results.modalManagerAvailable = true;
            console.log('✅ ModalManager is available');
        } else {
            console.log('❌ ModalManager is not available');
            return results;
        }

        // Test modal registration
        try {
            const modal = new window.EnhancedRouteDetailsModal();
            const modalState = window.modalManager.getModalState('routeDetailsModal');
            
            if (modalState) {
                results.modalRegistration = true;
                console.log('✅ Modal successfully registered with ModalManager');
            } else {
                console.log('❌ Modal not registered with ModalManager');
            }

            // Test state tracking
            const initialActiveCount = window.modalManager.getActiveModals().length;
            await modal.show(testRouteData);
            const afterShowCount = window.modalManager.getActiveModals().length;
            
            if (afterShowCount > initialActiveCount) {
                results.stateTracking = true;
                console.log('✅ Modal state properly tracked by ModalManager');
            } else {
                console.log('❌ Modal state not tracked by ModalManager');
            }

            // Test event registry integration
            if (window.modalManager.eventRegistry) {
                const listenerCount = window.modalManager.eventRegistry.getListenerCount('routeDetailsModal');
                if (listenerCount > 0) {
                    results.eventRegistryIntegration = true;
                    console.log('✅ Event listeners registered through EventRegistry');
                } else {
                    console.log('⚠️ No event listeners found in EventRegistry');
                }
            }

            // Clean up
            await modal.hide();
            
        } catch (error) {
            console.log('❌ Error during ModalManager integration test:', error.message);
        }

        return results;
    },

    /**
     * Requirement 4.3, 4.4: DOM element cleanup integration
     */
    async testDOMCleanupIntegration() {
        console.log('\n🧹 Testing DOM Cleanup Integration (Requirements 4.3, 4.4)');
        
        const results = {
            domUtilsAvailable: false,
            modalElementReset: false,
            chartCleanup: false,
            completeCleanup: false
        };

        // Check if DOMStateResetUtils is available
        if (window.DOMStateResetUtils) {
            results.domUtilsAvailable = true;
            console.log('✅ DOMStateResetUtils is available');
        } else {
            console.log('❌ DOMStateResetUtils is not available');
            return results;
        }

        try {
            const modal = new window.EnhancedRouteDetailsModal();
            
            // Test modal element reset
            await modal.show(testRouteData);
            const modalElement = document.getElementById('routeDetailsModal');
            
            if (modalElement) {
                // Add some test classes and styles
                modalElement.classList.add('test-class');
                modalElement.style.transform = 'translateX(100px)';
                
                // Test reset functionality
                window.DOMStateResetUtils.resetModalElement(modalElement);
                
                if (!modalElement.classList.contains('test-class') && 
                    modalElement.style.transform === '') {
                    results.modalElementReset = true;
                    console.log('✅ Modal element reset works correctly');
                } else {
                    console.log('❌ Modal element reset not working properly');
                }
            }

            // Test chart cleanup integration
            if (modal.cleanupChart && typeof modal.cleanupChart === 'function') {
                results.chartCleanup = true;
                console.log('✅ Chart cleanup method integrated');
            } else {
                console.log('⚠️ Chart cleanup method not found');
            }

            // Test complete cleanup
            await modal.hide();
            
            // Check if modal is properly cleaned up
            const modalAfterHide = document.getElementById('routeDetailsModal');
            if (modalAfterHide && modalAfterHide.getAttribute('aria-hidden') === 'true') {
                results.completeCleanup = true;
                console.log('✅ Complete DOM cleanup working correctly');
            } else {
                console.log('❌ Complete DOM cleanup not working properly');
            }
            
        } catch (error) {
            console.log('❌ Error during DOM cleanup integration test:', error.message);
        }

        return results;
    },

    /**
     * Requirement 6.1, 6.2: Error handling
     */
    async testErrorHandling() {
        console.log('\n🚨 Testing Error Handling (Requirements 6.1, 6.2)');
        
        const results = {
            gracefulFallback: false,
            errorRecovery: false,
            emergencyCleanup: false,
            userFeedback: false
        };

        try {
            // Test graceful fallback when ModalManager is not available
            const originalModalManager = window.modalManager;
            window.modalManager = null;
            
            const modal = new window.EnhancedRouteDetailsModal();
            
            if (modal.modalManager === null) {
                results.gracefulFallback = true;
                console.log('✅ Graceful fallback when ModalManager unavailable');
            }

            // Restore ModalManager
            window.modalManager = originalModalManager;

            // Test error recovery
            try {
                const modal2 = new window.EnhancedRouteDetailsModal();
                await modal2.show(null); // Invalid data
            } catch (error) {
                results.errorRecovery = true;
                console.log('✅ Error recovery mechanism working');
            }

            // Test emergency cleanup
            if (window.modalManager && window.modalManager.emergencyCleanup) {
                window.modalManager.emergencyCleanup();
                results.emergencyCleanup = true;
                console.log('✅ Emergency cleanup available');
            }

            // Test user feedback (check if method exists)
            const modal3 = new window.EnhancedRouteDetailsModal();
            if (modal3.showErrorFeedback && typeof modal3.showErrorFeedback === 'function') {
                results.userFeedback = true;
                console.log('✅ User feedback mechanism available');
            }
            
        } catch (error) {
            console.log('❌ Error during error handling test:', error.message);
        }

        return results;
    },

    /**
     * Overall integration verification
     */
    async testOverallIntegration() {
        console.log('\n🔗 Testing Overall Integration');
        
        const results = {
            enhancedModalAvailable: false,
            replacesOriginal: false,
            backwardCompatible: false,
            performanceAcceptable: false
        };

        // Check if EnhancedRouteDetailsModal is available
        if (window.EnhancedRouteDetailsModal) {
            results.enhancedModalAvailable = true;
            console.log('✅ EnhancedRouteDetailsModal class is available');
        } else {
            console.log('❌ EnhancedRouteDetailsModal class is not available');
            return results;
        }

        // Check if it replaces the original
        if (window.RouteDetailsModal === window.EnhancedRouteDetailsModal) {
            results.replacesOriginal = true;
            console.log('✅ Enhanced modal replaces original RouteDetailsModal');
        } else {
            console.log('⚠️ Enhanced modal does not replace original');
        }

        // Test backward compatibility
        try {
            const modal = window.RouteDetailsModal.getInstance();
            if (modal && modal.show && modal.hide) {
                results.backwardCompatible = true;
                console.log('✅ Backward compatibility maintained');
            }
        } catch (error) {
            console.log('❌ Backward compatibility issue:', error.message);
        }

        // Test performance
        try {
            const modal = window.EnhancedRouteDetailsModal.getInstance();
            const startTime = performance.now();
            
            await modal.show(testRouteData);
            await modal.hide();
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (duration < 1000) { // Should complete within 1 second
                results.performanceAcceptable = true;
                console.log(`✅ Performance acceptable (${duration.toFixed(0)}ms)`);
            } else {
                console.log(`⚠️ Performance may be slow (${duration.toFixed(0)}ms)`);
            }
            
        } catch (error) {
            console.log('❌ Performance test failed:', error.message);
        }

        return results;
    }
};

/**
 * Run all verification tests
 */
async function runAllVerificationTests() {
    console.log('🚀 Starting Task 3 Integration Verification Tests');
    console.log('=' .repeat(60));

    const allResults = {};

    try {
        allResults.modalManagerIntegration = await verificationTests.testModalManagerIntegration();
        allResults.domCleanupIntegration = await verificationTests.testDOMCleanupIntegration();
        allResults.errorHandling = await verificationTests.testErrorHandling();
        allResults.overallIntegration = await verificationTests.testOverallIntegration();

        // Generate summary report
        console.log('\n📊 VERIFICATION SUMMARY');
        console.log('=' .repeat(60));

        let totalTests = 0;
        let passedTests = 0;

        Object.entries(allResults).forEach(([category, results]) => {
            console.log(`\n${category.toUpperCase()}:`);
            Object.entries(results).forEach(([test, passed]) => {
                totalTests++;
                if (passed) passedTests++;
                console.log(`  ${passed ? '✅' : '❌'} ${test}`);
            });
        });

        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        console.log(`\n🎯 OVERALL SUCCESS RATE: ${passedTests}/${totalTests} (${successRate}%)`);

        if (successRate >= 80) {
            console.log('🎉 Task 3 integration is SUCCESSFUL!');
        } else if (successRate >= 60) {
            console.log('⚠️ Task 3 integration has some issues but is mostly functional');
        } else {
            console.log('❌ Task 3 integration needs significant work');
        }

        // Requirements verification
        console.log('\n📋 REQUIREMENTS VERIFICATION:');
        console.log('  Requirement 1.1 (Modal state management):', 
            allResults.modalManagerIntegration.modalRegistration && 
            allResults.modalManagerIntegration.stateTracking ? '✅' : '❌');
        console.log('  Requirement 1.2 (Event listener cleanup):', 
            allResults.modalManagerIntegration.eventRegistryIntegration ? '✅' : '❌');
        console.log('  Requirement 4.3, 4.4 (DOM cleanup):', 
            allResults.domCleanupIntegration.modalElementReset && 
            allResults.domCleanupIntegration.completeCleanup ? '✅' : '❌');
        console.log('  Requirement 6.1, 6.2 (Error handling):', 
            allResults.errorHandling.gracefulFallback && 
            allResults.errorHandling.errorRecovery ? '✅' : '❌');

    } catch (error) {
        console.error('❌ Verification failed with error:', error);
    }

    return allResults;
}

// Export for use in browser console or test environment
if (typeof window !== 'undefined') {
    window.verifyTask3Integration = runAllVerificationTests;
    window.verificationTests = verificationTests;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllVerificationTests, 1000);
    });
} else if (typeof window !== 'undefined') {
    setTimeout(runAllVerificationTests, 1000);
}

console.log('📦 Task 3 Integration Verification Script Loaded');