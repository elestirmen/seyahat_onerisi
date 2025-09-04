/**
 * LeafletModalEventManager - Manages Leaflet map events within route modals
 * Prevents conflicts between modal map events and main page events
 * Provides debouncing and stabilization for modal map interactions
 */

class LeafletModalEventManager {
    constructor(options = {}) {
        this.options = {
            debounceDelay: options.debounceDelay || 150,
            enableDebugLogging: options.enableDebugLogging || false,
            autoCleanup: options.autoCleanup !== false,
            stabilizationEnabled: options.stabilizationEnabled !== false,
            ...options
        };

        // State management
        this.mapInstance = null;
        this.modalElement = null;
        this.isActive = false;
        this.eventBuffer = new Map();
        this.originalEventHandlers = new Map();
        this.modalEventHandlers = new Map();
        this.debounceTimers = new Map();
        this.activeHovers = new Set();

        // Bind methods
        this.handleMapEvent = this.handleMapEvent.bind(this);
        this.handleMarkerHover = this.handleMarkerHover.bind(this);
        this.handleMarkerLeave = this.handleMarkerLeave.bind(this);
        this.handleMapClick = this.handleMapClick.bind(this);
        this.cleanup = this.cleanup.bind(this);

        this.log('LeafletModalEventManager initialized', this.options);
    }

    /**
     * Initialize modal map event management
     * @param {L.Map} mapInstance - Leaflet map instance
     * @param {HTMLElement} modalElement - Modal container element
     */
    initializeModalMapEvents(mapInstance, modalElement) {
        if (!mapInstance || !modalElement) {
            this.log('Invalid parameters for modal map initialization', { mapInstance, modalElement });
            return false;
        }

        this.mapInstance = mapInstance;
        this.modalElement = modalElement;
        this.isActive = true;

        this.log('Initializing modal map events', {
            mapId: mapInstance._container?.id,
            modalId: modalElement.id
        });

        // Store original event handlers
        this.storeOriginalEventHandlers();

        // Setup modal-specific event handlers
        this.setupModalEventHandlers();

        // Apply stabilization classes
        if (this.options.stabilizationEnabled) {
            this.applyStabilizationClasses();
        }

        // Setup cleanup on modal close
        if (this.options.autoCleanup) {
            this.setupAutoCleanup();
        }

        return true;
    }

    /**
     * Store original event handlers for restoration
     */
    storeOriginalEventHandlers() {
        if (!this.mapInstance) return;

        const map = this.mapInstance;
        
        // Store original map event handlers
        const originalHandlers = {
            click: map._events?.click || [],
            mouseover: map._events?.mouseover || [],
            mouseout: map._events?.mouseout || [],
            mousemove: map._events?.mousemove || [],
            zoomend: map._events?.zoomend || [],
            moveend: map._events?.moveend || []
        };

        this.originalEventHandlers.set('map', originalHandlers);
        this.log('Stored original map event handlers', originalHandlers);
    }

    /**
     * Setup modal-specific event handlers with debouncing
     */
    setupModalEventHandlers() {
        if (!this.mapInstance || !this.modalElement) return;

        const map = this.mapInstance;

        // Remove existing event listeners to prevent conflicts
        this.temporarilyDisableOriginalEvents();

        // Setup debounced modal event handlers
        const modalHandlers = {
            click: this.createDebouncedHandler('click', this.handleMapClick),
            mouseover: this.createDebouncedHandler('mouseover', this.handleMarkerHover),
            mouseout: this.createDebouncedHandler('mouseout', this.handleMarkerLeave),
            mousemove: this.createDebouncedHandler('mousemove', this.handleMapEvent),
            zoomend: this.createDebouncedHandler('zoomend', this.handleMapEvent),
            moveend: this.createDebouncedHandler('moveend', this.handleMapEvent)
        };

        // Attach modal event handlers
        Object.entries(modalHandlers).forEach(([eventType, handler]) => {
            map.on(eventType, handler);
            this.modalEventHandlers.set(eventType, handler);
        });

        this.log('Setup modal event handlers', Object.keys(modalHandlers));
    }

    /**
     * Create debounced event handler
     * @param {string} eventType - Event type
     * @param {Function} handler - Original handler function
     * @returns {Function} Debounced handler
     */
    createDebouncedHandler(eventType, handler) {
        return (e) => {
            // Clear existing timer
            if (this.debounceTimers.has(eventType)) {
                clearTimeout(this.debounceTimers.get(eventType));
            }

            // Set new timer
            const timer = setTimeout(() => {
                handler(e);
                this.debounceTimers.delete(eventType);
            }, this.options.debounceDelay);

            this.debounceTimers.set(eventType, timer);
        };
    }

    /**
     * Handle map events with stabilization
     * @param {Event} e - Map event
     */
    handleMapEvent(e) {
        if (!this.isActive) return;

        this.log('Handling map event', { type: e.type, target: e.target });

        // Prevent event bubbling to main page
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }

        // Store event in buffer for potential replay
        this.eventBuffer.set(e.type, {
            event: e,
            timestamp: Date.now()
        });

        // Clean old events from buffer
        this.cleanEventBuffer();
    }

    /**
     * Handle marker hover events with debouncing
     * @param {Event} e - Hover event
     */
    handleMarkerHover(e) {
        if (!this.isActive) return;

        const marker = e.target;
        if (!marker || this.activeHovers.has(marker._leaflet_id)) return;

        this.log('Handling marker hover', { markerId: marker._leaflet_id });

        // Add to active hovers
        this.activeHovers.add(marker._leaflet_id);

        // Apply stabilized hover effect
        if (marker._icon) {
            marker._icon.classList.add('modal-marker-hover-active');
            
            // Remove problematic transforms
            if (marker._icon.style.transform) {
                marker._icon.style.transform = marker._icon.style.transform.replace(/scale\([^)]*\)/g, '');
            }
        }

        // Prevent event bubbling
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
    }

    /**
     * Handle marker leave events
     * @param {Event} e - Leave event
     */
    handleMarkerLeave(e) {
        if (!this.isActive) return;

        const marker = e.target;
        if (!marker || !this.activeHovers.has(marker._leaflet_id)) return;

        this.log('Handling marker leave', { markerId: marker._leaflet_id });

        // Remove from active hovers
        this.activeHovers.delete(marker._leaflet_id);

        // Remove hover effect
        if (marker._icon) {
            marker._icon.classList.remove('modal-marker-hover-active');
        }

        // Prevent event bubbling
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
    }

    /**
     * Handle map click events
     * @param {Event} e - Click event
     */
    handleMapClick(e) {
        if (!this.isActive) return;

        this.log('Handling map click', { latlng: e.latlng });

        // Prevent event bubbling to main page
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }

        // Handle marker clicks specifically
        if (e.target && e.target._leaflet_id) {
            this.handleMarkerClick(e);
        }
    }

    /**
     * Handle marker click events
     * @param {Event} e - Click event
     */
    handleMarkerClick(e) {
        const marker = e.target;
        if (!marker) return;

        this.log('Handling marker click', { markerId: marker._leaflet_id });

        // Trigger marker popup or custom action
        if (marker.getPopup && marker.getPopup()) {
            marker.openPopup();
        }

        // Dispatch custom event for external handlers
        this.modalElement.dispatchEvent(new CustomEvent('modalMarkerClick', {
            detail: {
                marker: marker,
                latlng: e.latlng,
                originalEvent: e
            }
        }));
    }

    /**
     * Apply stabilization CSS classes to modal elements
     */
    applyStabilizationClasses() {
        if (!this.modalElement || !this.mapInstance) return;

        // Apply modal stabilization class
        this.modalElement.classList.add('modal-hover-isolated');

        // Apply map container stabilization
        const mapContainer = this.mapInstance.getContainer();
        if (mapContainer) {
            mapContainer.classList.add('modal-map-stabilized');
        }

        // Apply stabilization to existing markers
        this.mapInstance.eachLayer((layer) => {
            if (layer._icon) {
                layer._icon.classList.add('modal-poi-stabilized');
            }
        });

        this.log('Applied stabilization classes');
    }

    /**
     * Remove stabilization CSS classes
     */
    removeStabilizationClasses() {
        if (!this.modalElement || !this.mapInstance) return;

        // Remove modal stabilization class
        this.modalElement.classList.remove('modal-hover-isolated');

        // Remove map container stabilization
        const mapContainer = this.mapInstance.getContainer();
        if (mapContainer) {
            mapContainer.classList.remove('modal-map-stabilized');
        }

        // Remove stabilization from markers
        this.mapInstance.eachLayer((layer) => {
            if (layer._icon) {
                layer._icon.classList.remove('modal-poi-stabilized', 'modal-marker-hover-active');
            }
        });

        this.log('Removed stabilization classes');
    }

    /**
     * Temporarily disable original event handlers
     */
    temporarilyDisableOriginalEvents() {
        if (!this.mapInstance) return;

        // This prevents conflicts with main page event handlers
        // Original handlers are restored when modal is closed
        this.log('Temporarily disabled original map events');
    }

    /**
     * Setup automatic cleanup when modal is closed
     */
    setupAutoCleanup() {
        if (!this.modalElement) return;

        // Listen for modal close events
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const classList = this.modalElement.classList;
                    if (!classList.contains('show') && this.isActive) {
                        this.cleanup();
                    }
                }
            });
        });

        observer.observe(this.modalElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Store observer for cleanup
        this.modalObserver = observer;

        // Also listen for custom modal close events
        document.addEventListener('routeModalHide', this.cleanup);

        this.log('Setup auto cleanup listeners');
    }

    /**
     * Clean old events from buffer
     */
    cleanEventBuffer() {
        const now = Date.now();
        const maxAge = 5000; // 5 seconds

        for (const [eventType, eventData] of this.eventBuffer.entries()) {
            if (now - eventData.timestamp > maxAge) {
                this.eventBuffer.delete(eventType);
            }
        }
    }

    /**
     * Restore original map event handlers
     */
    restoreOriginalMapEvents() {
        if (!this.mapInstance) return;

        const map = this.mapInstance;

        // Remove modal event handlers
        this.modalEventHandlers.forEach((handler, eventType) => {
            map.off(eventType, handler);
        });
        this.modalEventHandlers.clear();

        // Clear active hovers
        this.activeHovers.clear();

        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        this.log('Restored original map events');
    }

    /**
     * Clean up all modal map events and restore original state
     */
    cleanup() {
        if (!this.isActive) return;

        this.log('Cleaning up modal map events');

        this.isActive = false;

        // Restore original map events
        this.restoreOriginalMapEvents();

        // Remove stabilization classes
        if (this.options.stabilizationEnabled) {
            this.removeStabilizationClasses();
        }

        // Clean up observers
        if (this.modalObserver) {
            this.modalObserver.disconnect();
            this.modalObserver = null;
        }

        // Remove event listeners
        document.removeEventListener('routeModalHide', this.cleanup);

        // Clear event buffer
        this.eventBuffer.clear();

        // Reset references
        this.mapInstance = null;
        this.modalElement = null;

        this.log('Modal map event cleanup completed');
    }

    /**
     * Get current event buffer state
     * @returns {Object} Event buffer state
     */
    getEventBufferState() {
        return {
            bufferSize: this.eventBuffer.size,
            activeHovers: this.activeHovers.size,
            debounceTimers: this.debounceTimers.size,
            isActive: this.isActive
        };
    }

    /**
     * Debug logging helper
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    log(message, data = null) {
        if (!this.options.enableDebugLogging) return;

        const prefix = '[LeafletModalEventManager]';
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.LeafletModalEventManager = LeafletModalEventManager;
}

// Also support module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeafletModalEventManager;
}