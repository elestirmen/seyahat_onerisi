/**
 * Modal Hover Stability Integration System
 * Integrates LeafletModalEventManager and ModalHoverIsolation
 * Provides comprehensive modal hover stability and cleanup
 */

class ModalHoverStabilityIntegration {
    constructor(options = {}) {
        this.options = {
            enableDebugLogging: options.enableDebugLogging || false,
            autoInitialize: options.autoInitialize !== false,
            debounceDelay: options.debounceDelay || 150,
            cleanupDelay: options.cleanupDelay || 100,
            ...options
        };

        // Component instances
        this.leafletEventManager = null;
        this.hoverIsolation = null;
        this.isInitialized = false;
        this.activeModal = null;
        this.cleanupCallbacks = new Set();

        // Bind methods
        this.handleModalShow = this.handleModalShow.bind(this);
        this.handleModalHide = this.handleModalHide.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
        this.cleanup = this.cleanup.bind(this);

        if (this.options.autoInitialize) {
            this.initialize();
        }

        this.log('ModalHoverStabilityIntegration initialized', this.options);
    }

    /**
     * Initialize the integration system
     */
    initialize() {
        if (this.isInitialized) {
            this.log('Already initialized');
            return;
        }

        this.log('Initializing modal hover stability integration');

        // Initialize component instances
        this.initializeComponents();

        // Setup event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        this.log('Modal hover stability integration initialized successfully');
    }

    /**
     * Initialize component instances
     */
    initializeComponents() {
        // Initialize LeafletModalEventManager
        if (typeof LeafletModalEventManager !== 'undefined') {
            this.leafletEventManager = new LeafletModalEventManager({
                debounceDelay: this.options.debounceDelay,
                enableDebugLogging: this.options.enableDebugLogging,
                autoCleanup: false, // We'll handle cleanup manually
                stabilizationEnabled: true
            });
            this.log('LeafletModalEventManager initialized');
        } else {
            console.warn('[ModalHoverStabilityIntegration] LeafletModalEventManager not available');
        }

        // Initialize ModalHoverIsolation
        if (typeof ModalHoverIsolation !== 'undefined') {
            this.hoverIsolation = new ModalHoverIsolation({
                debounceDelay: this.options.debounceDelay,
                enableDebugLogging: this.options.enableDebugLogging,
                autoRestore: false, // We'll handle restoration manually
                isolationEnabled: true
            });
            this.log('ModalHoverIsolation initialized');
        } else {
            console.warn('[ModalHoverStabilityIntegration] ModalHoverIsolation not available');
        }
    }

    /**
     * Setup event listeners for modal lifecycle
     */
    setupEventListeners() {
        // Listen for modal show events
        document.addEventListener('routeModalShow', this.handleModalShow);

        // Listen for modal hide events
        document.addEventListener('routeModalHide', this.handleModalHide);

        // Listen for tab change events
        document.addEventListener('modalTabChange', this.handleTabChange);

        // Listen for window beforeunload for cleanup
        window.addEventListener('beforeunload', this.cleanup);

        // Store cleanup callbacks
        this.cleanupCallbacks.add(() => {
            document.removeEventListener('routeModalShow', this.handleModalShow);
            document.removeEventListener('routeModalHide', this.handleModalHide);
            document.removeEventListener('modalTabChange', this.handleTabChange);
            window.removeEventListener('beforeunload', this.cleanup);
        });

        this.log('Event listeners setup completed');
    }

    /**
     * Handle modal show event
     * @param {CustomEvent} event - Modal show event
     */
    handleModalShow(event) {
        const { modalElement, routeData } = event.detail || {};
        
        if (!modalElement) {
            this.log('No modal element in show event');
            return;
        }

        this.log('Handling modal show', { modalId: modalElement.id });

        this.activeModal = modalElement;

        // Apply stabilization classes immediately
        this.applyStabilizationClasses(modalElement);

        // Initialize hover isolation
        if (this.hoverIsolation) {
            setTimeout(() => {
                this.hoverIsolation.isolateEvents(modalElement);
                this.log('Hover isolation activated');
            }, 50);
        }

        // Setup map event management when map tab is accessed
        this.setupMapEventManagement(modalElement);
    }

    /**
     * Handle modal hide event
     * @param {CustomEvent} event - Modal hide event
     */
    handleModalHide(event) {
        const { modalElement } = event.detail || {};
        
        this.log('Handling modal hide', { modalId: modalElement?.id });

        // Cleanup with delay to ensure smooth animation
        setTimeout(() => {
            this.performCleanup();
        }, this.options.cleanupDelay);
    }

    /**
     * Handle tab change event
     * @param {CustomEvent} event - Tab change event
     */
    handleTabChange(event) {
        const { modalId, newTab, oldTab } = event.detail || {};
        
        this.log('Handling tab change', { modalId, newTab, oldTab });

        // Special handling for map tab
        if (newTab === 'map') {
            this.initializeMapTab();
        } else if (oldTab === 'map') {
            this.cleanupMapTab();
        }
    }

    /**
     * Setup map event management for modal
     * @param {HTMLElement} modalElement - Modal element
     */
    setupMapEventManagement(modalElement) {
        if (!this.leafletEventManager || !modalElement) return;

        // Wait for map to be available
        const checkForMap = () => {
            const mapContainer = modalElement.querySelector('#routeModalMap');
            
            if (mapContainer && window.routeModalMap) {
                this.log('Map found, initializing event management');
                
                // Initialize map event management
                this.leafletEventManager.initializeModalMapEvents(
                    window.routeModalMap,
                    modalElement
                );
                
                return true;
            }
            
            return false;
        };

        // Check immediately
        if (!checkForMap()) {
            // Poll for map availability
            let attempts = 0;
            const maxAttempts = 20;
            
            const pollForMap = () => {
                attempts++;
                
                if (checkForMap() || attempts >= maxAttempts) {
                    return;
                }
                
                setTimeout(pollForMap, 200);
            };
            
            setTimeout(pollForMap, 200);
        }
    }

    /**
     * Initialize map tab specific functionality
     */
    initializeMapTab() {
        if (!this.activeModal) return;

        this.log('Initializing map tab');

        // Apply map-specific stabilization
        const mapContainer = this.activeModal.querySelector('.route-map-container');
        if (mapContainer) {
            mapContainer.classList.add('modal-map-stabilized');
        }

        const mapElement = this.activeModal.querySelector('#routeModalMap');
        if (mapElement) {
            mapElement.classList.add('modal-map-stabilized');
        }

        // Apply chart stabilization
        const chartContainer = this.activeModal.querySelector('.elevation-chart-container');
        if (chartContainer) {
            chartContainer.classList.add('modal-chart-stabilized');
        }

        const chartCanvas = this.activeModal.querySelector('#modalElevationChart');
        if (chartCanvas) {
            chartCanvas.classList.add('modal-chart-stabilized');
        }
    }

    /**
     * Cleanup map tab specific functionality
     */
    cleanupMapTab() {
        if (!this.activeModal) return;

        this.log('Cleaning up map tab');

        // Remove map-specific stabilization classes
        const elementsToCleanup = this.activeModal.querySelectorAll(`
            .modal-map-stabilized,
            .modal-chart-stabilized
        `);

        elementsToCleanup.forEach(element => {
            element.classList.remove('modal-map-stabilized', 'modal-chart-stabilized');
        });
    }

    /**
     * Apply stabilization classes to modal
     * @param {HTMLElement} modalElement - Modal element
     */
    applyStabilizationClasses(modalElement) {
        if (!modalElement) return;

        this.log('Applying stabilization classes');

        // Apply modal stabilization
        modalElement.classList.add('modal-stabilized');

        // Apply content stabilization
        const modalContent = modalElement.querySelector('.route-details-modal-content');
        if (modalContent) {
            modalContent.classList.add('modal-content-jitter-fix');
        }

        // Apply body stabilization
        const modalBody = modalElement.querySelector('.route-details-modal-body');
        if (modalBody) {
            modalBody.classList.add('modal-content-stabilized', 'scroll-stabilized');
        }

        // Apply tab content stabilization
        const tabContents = modalElement.querySelectorAll('.route-details-tab-content');
        tabContents.forEach(tabContent => {
            tabContent.classList.add('modal-tab-stabilized');
        });
    }

    /**
     * Remove stabilization classes from modal
     * @param {HTMLElement} modalElement - Modal element
     */
    removeStabilizationClasses(modalElement) {
        if (!modalElement) return;

        this.log('Removing stabilization classes');

        // Remove all stabilization classes
        const classesToRemove = [
            'modal-stabilized',
            'modal-content-jitter-fix',
            'modal-content-stabilized',
            'scroll-stabilized',
            'modal-tab-stabilized',
            'modal-map-stabilized',
            'modal-chart-stabilized',
            'modal-marker-hover-active'
        ];

        // Remove from modal element
        modalElement.classList.remove(...classesToRemove);

        // Remove from all child elements
        const allElements = modalElement.querySelectorAll('*');
        allElements.forEach(element => {
            element.classList.remove(...classesToRemove);
        });
    }

    /**
     * Perform comprehensive cleanup
     */
    performCleanup() {
        this.log('Performing comprehensive cleanup');

        // Cleanup Leaflet event manager
        if (this.leafletEventManager) {
            this.leafletEventManager.cleanup();
        }

        // Cleanup hover isolation
        if (this.hoverIsolation) {
            this.hoverIsolation.restoreEvents();
        }

        // Remove stabilization classes
        if (this.activeModal) {
            this.removeStabilizationClasses(this.activeModal);
        }

        // Reset active modal
        this.activeModal = null;

        this.log('Cleanup completed');
    }

    /**
     * Get current system state
     * @returns {Object} System state
     */
    getSystemState() {
        return {
            isInitialized: this.isInitialized,
            activeModalId: this.activeModal?.id || null,
            leafletEventManagerState: this.leafletEventManager?.getEventBufferState() || null,
            hoverIsolationState: this.hoverIsolation?.getIsolationState() || null,
            cleanupCallbacksCount: this.cleanupCallbacks.size
        };
    }

    /**
     * Manual cleanup method
     */
    cleanup() {
        this.log('Manual cleanup initiated');

        // Perform cleanup
        this.performCleanup();

        // Execute cleanup callbacks
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('[ModalHoverStabilityIntegration] Cleanup callback error:', error);
            }
        });
        this.cleanupCallbacks.clear();

        // Destroy component instances
        if (this.leafletEventManager) {
            this.leafletEventManager.cleanup();
            this.leafletEventManager = null;
        }

        if (this.hoverIsolation) {
            this.hoverIsolation.destroy();
            this.hoverIsolation = null;
        }

        this.isInitialized = false;
        this.activeModal = null;

        this.log('Manual cleanup completed');
    }

    /**
     * Debug logging helper
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    log(message, data = null) {
        if (!this.options.enableDebugLogging) return;

        const prefix = '[ModalHoverStabilityIntegration]';
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    // Make available globally
    window.ModalHoverStabilityIntegration = ModalHoverStabilityIntegration;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.modalHoverStabilityIntegration = new ModalHoverStabilityIntegration({
                enableDebugLogging: false,
                autoInitialize: true
            });
        });
    } else {
        // DOM already loaded
        window.modalHoverStabilityIntegration = new ModalHoverStabilityIntegration({
            enableDebugLogging: false,
            autoInitialize: true
        });
    }
}

// Also support module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalHoverStabilityIntegration;
}