/**
 * POI Hover Integration Module
 * 
 * Integrates the HoverEventManager with the existing POI recommendation system.
 * Provides seamless hover event management for POI markers with Leaflet compatibility.
 * 
 * Requirements addressed:
 * - 1.3: POI markers remain clickable during hover
 * - 1.4: Rapid mouse movements handled smoothly  
 * - 3.1: Click events registered successfully
 * - 3.2: Modal opens without delay after hover
 * - 3.3: Hover state maintains clickability
 * - 6.1: Event listeners properly managed
 * - 6.2: Event listeners cleaned up
 * - 6.3: No event listener conflicts
 */

class POIHoverIntegration {
    constructor(options = {}) {
        this.options = {
            enableHoverEffects: options.enableHoverEffects !== false,
            enableClickHandling: options.enableClickHandling !== false,
            enableTouchSupport: options.enableTouchSupport !== false,
            debounceDelay: options.debounceDelay || 100,
            hoverDelay: options.hoverDelay || 50,
            enableDebugLogging: options.enableDebugLogging || false,
            ...options
        };

        // Initialize managers
        this.hoverManager = null;
        this.delegationManager = null;
        this.isInitialized = false;

        // State tracking
        this.registeredMarkers = new Map(); // markerId -> markerData
        this.activePopups = new Map(); // markerId -> popup
        this.hoverStates = new Map(); // markerId -> hoverState

        // Performance tracking
        this.metrics = {
            markersRegistered: 0,
            hoversProcessed: 0,
            clicksProcessed: 0,
            errorsHandled: 0
        };

        // Bind methods
        this.handleMarkerHoverStart = this.handleMarkerHoverStart.bind(this);
        this.handleMarkerHoverEnd = this.handleMarkerHoverEnd.bind(this);
        this.handleMarkerClick = this.handleMarkerClick.bind(this);
        this.cleanup = this.cleanup.bind(this);

        this.log('POIHoverIntegration initialized');
    }

    /**
     * Initialize the integration system
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                this.log('Already initialized');
                return true;
            }

            // Wait for dependencies
            await this.waitForDependencies();

            // Initialize hover manager
            this.hoverManager = new HoverEventManager({
                debounceDelay: this.options.debounceDelay,
                hoverDelay: this.options.hoverDelay,
                enableDebugLogging: this.options.enableDebugLogging,
                maxActiveHovers: 100
            });

            // Initialize delegation manager
            this.delegationManager = new EventDelegationManager({
                debugMode: this.options.enableDebugLogging,
                stopPropagation: true
            });

            // Setup conflict resolvers
            this.setupConflictResolvers();

            // Setup cleanup
            this.setupCleanup();

            this.isInitialized = true;
            this.log('POIHoverIntegration initialized successfully');
            return true;

        } catch (error) {
            this.handleError('initialize', error);
            return false;
        }
    }

    /**
     * Wait for required dependencies to be available
     */
    async waitForDependencies() {
        const maxWaitTime = 10000; // 10 seconds
        const checkInterval = 100; // 100ms
        let waitTime = 0;

        return new Promise((resolve, reject) => {
            const checkDependencies = () => {
                if (waitTime >= maxWaitTime) {
                    reject(new Error('Dependencies not available within timeout'));
                    return;
                }

                // Check for required classes
                if (typeof HoverEventManager !== 'undefined' && 
                    typeof EventDelegationManager !== 'undefined') {
                    resolve();
                    return;
                }

                waitTime += checkInterval;
                setTimeout(checkDependencies, checkInterval);
            };

            checkDependencies();
        });
    }

    /**
     * Setup conflict resolvers for Leaflet integration
     */
    setupConflictResolvers() {
        // Click event resolver
        this.delegationManager.registerConflictResolver('click', (event) => {
            const target = event.target;
            
            // Allow clicks on POI markers to propagate to both systems
            if (this.isPOIMarker(target)) {
                return true; // Allow event to continue
            }
            
            return true;
        });

        // Mouse event resolver
        this.delegationManager.registerConflictResolver('mouseenter', (event) => {
            const target = event.target;
            
            // Handle POI marker hover carefully
            if (this.isPOIMarker(target)) {
                // Don't stop propagation for POI markers
                return true;
            }
            
            return true;
        });

        this.log('Conflict resolvers setup completed');
    }

    /**
     * Register a POI marker for hover management
     */
    registerPOIMarker(marker, poiData, options = {}) {
        try {
            if (!this.isInitialized) {
                this.log('Not initialized, queuing marker registration');
                // Queue for later registration
                setTimeout(() => this.registerPOIMarker(marker, poiData, options), 100);
                return false;
            }

            // Check if device is touch-only (no hover support)
            const isTouchDevice = 'ontouchstart' in window && !window.matchMedia('(hover: hover)').matches;
            if (isTouchDevice) {
                // For touch devices, disable hover effects and use touch-only interactions
                this.options.enableHoverEffects = false;
                this.log('Touch device detected, disabling hover effects');
            }

            const markerId = this.getMarkerId(marker);
            const element = this.getMarkerElement(marker);

            if (!element) {
                this.handleError('registerPOIMarker', new Error('Invalid marker element'), { marker, poiData });
                return false;
            }

            // Store marker data
            const markerData = {
                marker,
                poiData,
                element,
                options,
                registeredAt: Date.now()
            };

            this.registeredMarkers.set(markerId, markerData);

            // Register with Leaflet conflict resolution
            if (marker._leaflet_id) {
                this.delegationManager.registerLeafletMarker(marker);
            }

            // Setup hover events
            const success = this.hoverManager.attachHoverEvents(marker, {
                onHoverStart: (event, id) => this.handleMarkerHoverStart(event, id, markerData),
                onHoverEnd: (event, id) => this.handleMarkerHoverEnd(event, id, markerData),
                onClick: (event, id, context) => this.handleMarkerClick(event, id, markerData, context)
            }, {
                priority: 10,
                stopPropagation: false // Allow Leaflet events to work
            });

            if (success) {
                this.metrics.markersRegistered++;
                this.log('POI marker registered', markerId);
                return true;
            } else {
                this.registeredMarkers.delete(markerId);
                return false;
            }

        } catch (error) {
            this.handleError('registerPOIMarker', error, { marker, poiData });
            return false;
        }
    }

    /**
     * Unregister a POI marker
     */
    unregisterPOIMarker(marker) {
        try {
            const markerId = this.getMarkerId(marker);
            const markerData = this.registeredMarkers.get(markerId);

            if (!markerData) {
                this.log('Marker not registered', markerId);
                return true;
            }

            // Remove hover events
            this.hoverManager.detachHoverEvents(marker);

            // Unregister from delegation manager
            if (marker._leaflet_id) {
                this.delegationManager.unregisterLeafletMarker(marker);
            }

            // Clean up state
            this.registeredMarkers.delete(markerId);
            this.activePopups.delete(markerId);
            this.hoverStates.delete(markerId);

            this.log('POI marker unregistered', markerId);
            return true;

        } catch (error) {
            this.handleError('unregisterPOIMarker', error, { marker });
            return false;
        }
    }

    /**
     * Handle marker hover start
     */
    handleMarkerHoverStart(event, markerId, markerData) {
        try {
            this.metrics.hoversProcessed++;

            // Store hover state
            const hoverState = {
                markerId,
                startTime: Date.now(),
                element: event.target,
                markerData
            };
            this.hoverStates.set(markerId, hoverState);

            // Apply hover CSS class for visual feedback
            if (this.options.enableHoverEffects) {
                this.applyHoverStyles(markerData.element);
            }

            // Execute custom hover start callback if provided
            if (markerData.options.onHoverStart) {
                markerData.options.onHoverStart(event, markerId, markerData.poiData);
            }

            // Emit custom event for other systems to listen to
            this.emitCustomEvent('poi-hover-start', {
                markerId,
                poiData: markerData.poiData,
                element: markerData.element,
                originalEvent: event
            });

            this.log('Marker hover started', markerId);

        } catch (error) {
            this.handleError('handleMarkerHoverStart', error, { markerId, markerData });
        }
    }

    /**
     * Handle marker hover end
     */
    handleMarkerHoverEnd(event, markerId, markerData) {
        try {
            const hoverState = this.hoverStates.get(markerId);
            
            if (hoverState) {
                const hoverDuration = Date.now() - hoverState.startTime;
                this.hoverStates.delete(markerId);

                // Remove hover CSS class
                if (this.options.enableHoverEffects) {
                    this.removeHoverStyles(markerData.element);
                }

                // Execute custom hover end callback if provided
                if (markerData.options.onHoverEnd) {
                    markerData.options.onHoverEnd(event, markerId, markerData.poiData, hoverDuration);
                }

                // Emit custom event
                this.emitCustomEvent('poi-hover-end', {
                    markerId,
                    poiData: markerData.poiData,
                    element: markerData.element,
                    duration: hoverDuration,
                    originalEvent: event
                });

                this.log('Marker hover ended', markerId, `Duration: ${hoverDuration}ms`);
            }

        } catch (error) {
            this.handleError('handleMarkerHoverEnd', error, { markerId, markerData });
        }
    }

    /**
     * Handle marker click with hover state awareness
     */
    handleMarkerClick(event, markerId, markerData, context) {
        try {
            this.metrics.clicksProcessed++;

            // Ensure click works even during hover state
            const isHovering = context.isHovering;
            const hoverState = context.hoverState;

            // Execute custom click callback if provided
            if (markerData.options.onClick) {
                const result = markerData.options.onClick(event, markerId, markerData.poiData, {
                    isHovering,
                    hoverState
                });

                // Handle async callbacks
                if (result instanceof Promise) {
                    result.catch(error => {
                        this.handleError('onClick callback', error, { markerId });
                    });
                }
            } else {
                // Default click behavior - open POI detail modal
                this.openPOIDetailModal(markerData.poiData, markerId);
            }

            // Emit custom event
            this.emitCustomEvent('poi-click', {
                markerId,
                poiData: markerData.poiData,
                element: markerData.element,
                isHovering,
                originalEvent: event
            });

            this.log('Marker clicked', markerId, isHovering ? '(while hovering)' : '');

        } catch (error) {
            this.handleError('handleMarkerClick', error, { markerId, markerData });
        }
    }

    /**
     * Apply hover styles to marker element
     */
    applyHoverStyles(element) {
        try {
            // Add hover class
            element.classList.add('poi-marker-hovering');

            // Find marker container
            const container = element.querySelector('.poi-marker-container') || 
                            element.closest('.poi-marker-container') ||
                            element;

            if (container) {
                container.classList.add('poi-marker-container-hovering');
            }

        } catch (error) {
            this.handleError('applyHoverStyles', error, { element });
        }
    }

    /**
     * Remove hover styles from marker element
     */
    removeHoverStyles(element) {
        try {
            // Remove hover class
            element.classList.remove('poi-marker-hovering');

            // Find marker container
            const container = element.querySelector('.poi-marker-container') || 
                            element.closest('.poi-marker-container') ||
                            element;

            if (container) {
                container.classList.remove('poi-marker-container-hovering');
            }

        } catch (error) {
            this.handleError('removeHoverStyles', error, { element });
        }
    }

    /**
     * Open POI detail modal (default click behavior)
     */
    openPOIDetailModal(poiData, markerId) {
        try {
            // Check if modal function exists in global scope
            if (typeof window.showPOIDetailModal === 'function') {
                window.showPOIDetailModal(poiData);
            } else if (typeof window.openPOIModal === 'function') {
                window.openPOIModal(poiData);
            } else {
                // Fallback - emit event for other systems to handle
                this.emitCustomEvent('poi-modal-request', {
                    markerId,
                    poiData
                });
                this.log('POI modal requested via event', markerId);
            }

        } catch (error) {
            this.handleError('openPOIDetailModal', error, { poiData, markerId });
        }
    }

    /**
     * Check if element is a POI marker
     */
    isPOIMarker(element) {
        return element.classList.contains('custom-poi-marker') ||
               element.classList.contains('poi-marker-container') ||
               element.classList.contains('poi-marker-circle') ||
               element.closest('.custom-poi-marker') !== null ||
               element.closest('.poi-marker-container') !== null;
    }

    /**
     * Get marker ID from various marker types
     */
    getMarkerId(marker) {
        if (typeof marker === 'string') {
            return marker;
        }
        
        if (marker && marker._leaflet_id) {
            return `leaflet_${marker._leaflet_id}`;
        }
        
        if (marker && marker.options && marker.options.markerId) {
            return marker.options.markerId;
        }
        
        if (marker && marker._icon && marker._icon.dataset && marker._icon.dataset.markerId) {
            return marker._icon.dataset.markerId;
        }
        
        // Generate unique ID
        const uniqueId = `poi_marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store ID for future reference
        if (marker && marker._icon && marker._icon.dataset) {
            marker._icon.dataset.markerId = uniqueId;
        }
        
        return uniqueId;
    }

    /**
     * Get DOM element from marker
     */
    getMarkerElement(marker) {
        if (marker instanceof HTMLElement) {
            return marker;
        }
        
        if (marker && marker._icon) {
            return marker._icon; // Leaflet marker icon element
        }
        
        if (marker && marker.getElement) {
            return marker.getElement();
        }
        
        return null;
    }

    /**
     * Emit custom event for integration with other systems
     */
    emitCustomEvent(eventName, detail) {
        try {
            const customEvent = new CustomEvent(eventName, {
                detail,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(customEvent);

        } catch (error) {
            this.handleError('emitCustomEvent', error, { eventName, detail });
        }
    }

    /**
     * Setup cleanup mechanisms
     */
    setupCleanup() {
        // Cleanup on page unload
        window.addEventListener('beforeunload', this.cleanup);
        window.addEventListener('unload', this.cleanup);
        
        // Cleanup on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.performPartialCleanup();
            }
        });
    }

    /**
     * Perform partial cleanup (for visibility changes)
     */
    performPartialCleanup() {
        try {
            // End all active hovers
            for (const [markerId, hoverState] of this.hoverStates.entries()) {
                const markerData = this.registeredMarkers.get(markerId);
                if (markerData) {
                    this.handleMarkerHoverEnd(null, markerId, markerData);
                }
            }

            this.log('Partial cleanup completed');

        } catch (error) {
            this.handleError('performPartialCleanup', error);
        }
    }

    /**
     * Handle errors with metrics tracking
     */
    handleError(context, error, data = {}) {
        this.metrics.errorsHandled++;
        console.warn(`POIHoverIntegration Error [${context}]:`, error, data);
    }

    /**
     * Get integration metrics
     */
    getMetrics() {
        const baseMetrics = this.hoverManager ? this.hoverManager.getPerformanceMetrics() : {};
        const delegationStats = this.delegationManager ? this.delegationManager.getStats() : {};

        return {
            ...this.metrics,
            registeredMarkers: this.registeredMarkers.size,
            activeHovers: this.hoverStates.size,
            activePopups: this.activePopups.size,
            hoverManager: baseMetrics,
            delegation: delegationStats
        };
    }

    /**
     * Complete cleanup
     */
    cleanup() {
        try {
            // Unregister all markers
            for (const [markerId, markerData] of this.registeredMarkers.entries()) {
                this.unregisterPOIMarker(markerData.marker);
            }

            // Cleanup managers
            if (this.hoverManager) {
                this.hoverManager.cleanup();
            }

            if (this.delegationManager) {
                this.delegationManager.cleanup();
            }

            // Clear state
            this.registeredMarkers.clear();
            this.activePopups.clear();
            this.hoverStates.clear();

            this.isInitialized = false;
            this.log('Complete cleanup performed');

        } catch (error) {
            this.handleError('cleanup', error);
        }
    }

    /**
     * Logging utility
     */
    log(message, ...args) {
        if (this.options.enableDebugLogging) {
            console.log(`[POIHoverIntegration] ${message}`, ...args);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = POIHoverIntegration;
} else if (typeof window !== 'undefined') {
    window.POIHoverIntegration = POIHoverIntegration;
}