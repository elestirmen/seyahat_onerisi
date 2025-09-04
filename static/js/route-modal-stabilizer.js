/**
 * Route Modal Stabilizer
 * 
 * This module integrates all modal hover stability components to provide
 * a comprehensive solution for route modal hover issues.
 * 
 * Requirements addressed:
 * - 7.1: Route modal elements remain stable during mouse hover
 * - 7.2: POI markers in route modal don't jitter or move erratically
 * - 7.3: Route lines in modal map remain visually stable
 * - 7.4: Modal maintains position stability during mouse movement
 * - 8.1: Modal map hover effects are smooth and controlled
 * - 8.2: Modal map transitions are stable without layout shifts
 * - 8.3: Elevation chart hover indicators move smoothly
 * - 8.4: Hover states reset properly when switching modal tabs
 * - 9.1: Consistent hover behavior across different route modals
 * - 9.2: Hover stability maintained across different content types
 * - 9.3: Hover events continue working after modal resize/reposition
 * - 9.4: Hover functionality fully restored after modal close/reopen
 */

class RouteModalStabilizer {
    constructor(options = {}) {
        this.options = {
            enableDebugLogging: options.enableDebugLogging || false,
            autoInitialize: options.autoInitialize !== false,
            stabilizationDelay: options.stabilizationDelay || 200,
            ...options
        };

        // Component instances
        this.modalHoverIsolation = null;
        this.leafletEventManagers = new Map(); // modalId -> LeafletModalEventManager
        this.activeModals = new Map(); // modalId -> modalData

        // State management
        this.isInitialized = false;
        this.performanceMetrics = {
            modalsStabilized: 0,
            stabilizationErrors: 0,
            totalStabilizations: 0
        };

        // Bind methods
        this.stabilizeModal = this.stabilizeModal.bind(this);
        this.destabilizeModal = this.destabilizeModal.bind(this);
        this.handleModalShow = this.handleModalShow.bind(this);
        this.handleModalHide = this.handleModalHide.bind(this);

        if (this.options.autoInitialize) {
            this.initialize();
        }

        this.log('RouteModalStabilizer initialized', this.options);
    }

    /**
     * Initialize the stabilizer system
     */
    initialize() {
        try {
            if (this.isInitialized) {
                this.log('Already initialized');
                return true;
            }

            // Initialize modal hover isolation
            this.modalHoverIsolation = new ModalHoverIsolation({
                enableDebugLogging: this.options.enableDebugLogging
            });

            // Setup modal event listeners
            this.setupModalEventListeners();

            // Setup automatic modal detection
            this.setupModalDetection();

            this.isInitialized = true;
            this.log('RouteModalStabilizer initialized successfully');
            return true;

        } catch (error) {
            this.handleError('initialize', error);
            return false;
        }
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners() {
        try {
            // Listen for modal show events
            document.addEventListener('modalShow', this.handleModalShow);
            document.addEventListener('modalHide', this.handleModalHide);

            // Listen for route modal specific events
            document.addEventListener('routeModalShow', this.handleModalShow);
            document.addEventListener('routeModalHide', this.handleModalHide);

            // Listen for tab changes within modals
            document.addEventListener('modalTabChange', (event) => {
                this.handleModalTabChange(event.detail);
            });

            this.log('Modal event listeners setup completed');

        } catch (error) {
            this.handleError('setupModalEventListeners', error);
        }
    }

    /**
     * Setup automatic modal detection
     */
    setupModalDetection() {
        try {
            // Use MutationObserver to detect modal creation
            if (window.MutationObserver) {
                this.modalObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.checkForNewModals(node);
                            }
                        });
                    });
                });

                this.modalObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            // Check for existing modals
            this.checkForExistingModals();

            this.log('Modal detection setup completed');

        } catch (error) {
            this.handleError('setupModalDetection', error);
        }
    }

    /**
     * Check for new modals in added nodes
     */
    checkForNewModals(node) {
        try {
            // Check if the node itself is a modal
            if (this.isRouteModal(node)) {
                this.handleModalDetected(node);
            }

            // Check for modals within the node
            const modals = node.querySelectorAll?.('.route-details-modal, [class*="modal"]');
            modals?.forEach(modal => {
                if (this.isRouteModal(modal)) {
                    this.handleModalDetected(modal);
                }
            });

        } catch (error) {
            this.handleError('checkForNewModals', error, { node });
        }
    }

    /**
     * Check for existing modals on page
     */
    checkForExistingModals() {
        try {
            const existingModals = document.querySelectorAll('.route-details-modal, [class*="modal"]');
            
            existingModals.forEach(modal => {
                if (this.isRouteModal(modal)) {
                    this.handleModalDetected(modal);
                }
            });

            this.log('Existing modals checked', existingModals.length);

        } catch (error) {
            this.handleError('checkForExistingModals', error);
        }
    }

    /**
     * Check if element is a route modal
     */
    isRouteModal(element) {
        if (!element || !element.classList) return false;

        return element.classList.contains('route-details-modal') ||
               element.id === 'routeDetailsModal' ||
               (element.querySelector && element.querySelector('.route-details-modal-content'));
    }

    /**
     * Handle modal detection
     */
    handleModalDetected(modalElement) {
        try {
            const modalId = this.getModalId(modalElement);
            
            if (this.activeModals.has(modalId)) {
                this.log('Modal already detected', modalId);
                return;
            }

            // Wait for modal to be fully rendered before stabilizing
            setTimeout(() => {
                if (modalElement.classList.contains('show') || 
                    modalElement.style.display !== 'none') {
                    this.stabilizeModal(modalElement);
                }
            }, this.options.stabilizationDelay);

            this.log('Modal detected', modalId);

        } catch (error) {
            this.handleError('handleModalDetected', error, { modalElement });
        }
    }

    /**
     * Handle modal show event
     */
    handleModalShow(event) {
        try {
            const modalElement = event.detail?.modalElement || event.target;
            
            if (this.isRouteModal(modalElement)) {
                this.stabilizeModal(modalElement);
            }

        } catch (error) {
            this.handleError('handleModalShow', error, { event });
        }
    }

    /**
     * Handle modal hide event
     */
    handleModalHide(event) {
        try {
            const modalElement = event.detail?.modalElement || event.target;
            
            if (this.isRouteModal(modalElement)) {
                this.destabilizeModal(modalElement);
            }

        } catch (error) {
            this.handleError('handleModalHide', error, { event });
        }
    }

    /**
     * Handle modal tab change
     */
    handleModalTabChange(tabChangeData) {
        try {
            const { modalId, newTab, oldTab } = tabChangeData;
            const modalData = this.activeModals.get(modalId);

            if (!modalData) {
                this.log('Modal not found for tab change', modalId);
                return;
            }

            // Handle tab-specific stabilization
            this.handleTabSpecificStabilization(modalData, newTab, oldTab);

            // Dispatch event for Leaflet event manager
            document.dispatchEvent(new CustomEvent('modalTabChange', {
                detail: { modalId, newTab, oldTab }
            }));

            this.log('Modal tab change handled', { modalId, newTab, oldTab });

        } catch (error) {
            this.handleError('handleModalTabChange', error, { tabChangeData });
        }
    }

    /**
     * Handle tab-specific stabilization
     */
    handleTabSpecificStabilization(modalData, newTab, oldTab) {
        try {
            const { element: modalElement, modalId } = modalData;

            // Reset hover states when switching tabs
            this.resetModalHoverStates(modalElement);

            // Handle map tab specific stabilization
            if (newTab === 'map') {
                setTimeout(() => {
                    this.stabilizeMapTab(modalData);
                }, 100);
            }

            // Handle elevation chart stabilization
            if (newTab === 'map' || modalElement.querySelector(`[data-tab="${newTab}"] canvas`)) {
                setTimeout(() => {
                    this.stabilizeElevationCharts(modalData);
                }, 200);
            }

            this.log('Tab-specific stabilization completed', { modalId, newTab });

        } catch (error) {
            this.handleError('handleTabSpecificStabilization', error, { modalData, newTab, oldTab });
        }
    }

    /**
     * Stabilize a modal
     */
    stabilizeModal(modalElement) {
        try {
            const modalId = this.getModalId(modalElement);

            if (this.activeModals.has(modalId)) {
                this.log('Modal already stabilized', modalId);
                return true;
            }

            // Create modal data
            const modalData = {
                modalId,
                element: modalElement,
                stabilizedAt: Date.now(),
                leafletEventManager: null,
                isStabilized: false
            };

            this.activeModals.set(modalId, modalData);

            // Perform stabilization steps
            this.performModalStabilization(modalData);

            this.performanceMetrics.modalsStabilized++;
            this.performanceMetrics.totalStabilizations++;

            this.log('Modal stabilized successfully', modalId);
            return true;

        } catch (error) {
            this.handleError('stabilizeModal', error, { modalElement });
            this.performanceMetrics.stabilizationErrors++;
            return false;
        }
    }

    /**
     * Perform modal stabilization
     */
    performModalStabilization(modalData) {
        try {
            const { element: modalElement, modalId } = modalData;

            // Step 1: Isolate modal events
            this.modalHoverIsolation.isolateModal(modalElement);

            // Step 2: Stabilize modal content
            this.stabilizeModalContent(modalData);

            // Step 3: Setup Leaflet map event management
            this.setupLeafletEventManagement(modalData);

            // Step 4: Stabilize POI markers
            this.stabilizePoiMarkers(modalData);

            // Step 5: Stabilize elevation charts
            this.stabilizeElevationCharts(modalData);

            // Step 6: Setup modal-specific CSS
            this.applyModalStabilizationCSS(modalData);

            modalData.isStabilized = true;
            this.log('Modal stabilization completed', modalId);

        } catch (error) {
            this.handleError('performModalStabilization', error, { modalData });
        }
    }

    /**
     * Stabilize modal content
     */
    stabilizeModalContent(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Apply content stabilization classes
            modalElement.classList.add('modal-stabilized');
            
            const contentAreas = modalElement.querySelectorAll(
                '.route-details-modal-content, .route-details-modal-body, .route-details-tab-content'
            );
            
            contentAreas.forEach(area => {
                area.classList.add('modal-content-stabilized');
            });

            this.log('Modal content stabilized', modalData.modalId);

        } catch (error) {
            this.handleError('stabilizeModalContent', error, { modalData });
        }
    }

    /**
     * Setup Leaflet event management for modal
     */
    setupLeafletEventManagement(modalData) {
        try {
            const { element: modalElement, modalId } = modalData;

            // Find Leaflet maps in modal
            const leafletMaps = modalElement.querySelectorAll('.leaflet-container');
            
            leafletMaps.forEach(mapContainer => {
                const leafletMap = mapContainer._leaflet_map;
                if (leafletMap) {
                    // Create Leaflet event manager for this map
                    const leafletEventManager = new LeafletModalEventManager(
                        leafletMap, 
                        modalData,
                        {
                            enableDebugLogging: this.options.enableDebugLogging
                        }
                    );

                    // Initialize modal map events
                    leafletEventManager.initializeModalMapEvents();

                    // Store for cleanup
                    this.leafletEventManagers.set(`${modalId}_${mapContainer.id}`, leafletEventManager);
                    modalData.leafletEventManager = leafletEventManager;
                }
            });

            this.log('Leaflet event management setup completed', modalId);

        } catch (error) {
            this.handleError('setupLeafletEventManagement', error, { modalData });
        }
    }

    /**
     * Stabilize POI markers in modal
     */
    stabilizePoiMarkers(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Find POI markers in modal
            const poiMarkers = modalElement.querySelectorAll(
                '.poi-marker-circle, .custom-poi-marker, .leaflet-marker-icon'
            );

            poiMarkers.forEach(marker => {
                marker.classList.add('modal-poi-stabilized');
                
                // Remove problematic hover transforms
                marker.style.transition = 'opacity 0.2s ease';
            });

            this.log('POI markers stabilized', { modalId: modalData.modalId, count: poiMarkers.length });

        } catch (error) {
            this.handleError('stabilizePoiMarkers', error, { modalData });
        }
    }

    /**
     * Stabilize elevation charts in modal
     */
    stabilizeElevationCharts(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Find elevation charts in modal
            const elevationCharts = modalElement.querySelectorAll(
                'canvas[id*="elevation"], canvas[id*="chart"]'
            );

            elevationCharts.forEach(chart => {
                chart.classList.add('modal-chart-stabilized');
                
                // Ensure smooth chart interactions
                chart.style.touchAction = 'pan-y';
            });

            this.log('Elevation charts stabilized', { modalId: modalData.modalId, count: elevationCharts.length });

        } catch (error) {
            this.handleError('stabilizeElevationCharts', error, { modalData });
        }
    }

    /**
     * Stabilize map tab specifically
     */
    stabilizeMapTab(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Find map tab content
            const mapTabContent = modalElement.querySelector('[data-tab="map"]');
            if (!mapTabContent) return;

            // Ensure map containers are properly sized
            const mapContainers = mapTabContent.querySelectorAll('.leaflet-container, .route-map');
            mapContainers.forEach(container => {
                container.classList.add('modal-map-stabilized');
                
                // Force proper sizing
                if (container._leaflet_map) {
                    setTimeout(() => {
                        container._leaflet_map.invalidateSize();
                    }, 100);
                }
            });

            this.log('Map tab stabilized', modalData.modalId);

        } catch (error) {
            this.handleError('stabilizeMapTab', error, { modalData });
        }
    }

    /**
     * Apply modal stabilization CSS
     */
    applyModalStabilizationCSS(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Apply CSS custom properties for stabilization
            modalElement.style.setProperty('--modal-stabilization', 'active');
            modalElement.style.contain = 'layout style paint';
            modalElement.style.isolation = 'isolate';

            this.log('Modal stabilization CSS applied', modalData.modalId);

        } catch (error) {
            this.handleError('applyModalStabilizationCSS', error, { modalData });
        }
    }

    /**
     * Reset modal hover states
     */
    resetModalHoverStates(modalElement) {
        try {
            // Remove all hover-active classes
            const hoverElements = modalElement.querySelectorAll(
                '.modal-poi-hover-active, .modal-marker-hover-active'
            );
            
            hoverElements.forEach(element => {
                element.classList.remove('modal-poi-hover-active', 'modal-marker-hover-active');
            });

            this.log('Modal hover states reset');

        } catch (error) {
            this.handleError('resetModalHoverStates', error, { modalElement });
        }
    }

    /**
     * Destabilize a modal
     */
    destabilizeModal(modalElement) {
        try {
            const modalId = this.getModalId(modalElement);
            const modalData = this.activeModals.get(modalId);

            if (!modalData) {
                this.log('Modal not found for destabilization', modalId);
                return true;
            }

            // Perform destabilization steps
            this.performModalDestabilization(modalData);

            // Clean up state
            this.activeModals.delete(modalId);

            this.log('Modal destabilized successfully', modalId);
            return true;

        } catch (error) {
            this.handleError('destabilizeModal', error, { modalElement });
            return false;
        }
    }

    /**
     * Perform modal destabilization
     */
    performModalDestabilization(modalData) {
        try {
            const { element: modalElement, modalId } = modalData;

            // Step 1: Cleanup Leaflet event management
            this.cleanupLeafletEventManagement(modalData);

            // Step 2: Restore modal events
            this.modalHoverIsolation.restoreModal(modalElement);

            // Step 3: Remove stabilization CSS
            this.removeModalStabilizationCSS(modalData);

            // Step 4: Remove stabilization classes
            this.removeStabilizationClasses(modalData);

            this.log('Modal destabilization completed', modalId);

        } catch (error) {
            this.handleError('performModalDestabilization', error, { modalData });
        }
    }

    /**
     * Cleanup Leaflet event management
     */
    cleanupLeafletEventManagement(modalData) {
        try {
            const { modalId } = modalData;

            // Cleanup all Leaflet event managers for this modal
            for (const [managerId, eventManager] of this.leafletEventManagers.entries()) {
                if (managerId.startsWith(modalId)) {
                    eventManager.cleanupModalMapEvents();
                    this.leafletEventManagers.delete(managerId);
                }
            }

            this.log('Leaflet event management cleaned up', modalId);

        } catch (error) {
            this.handleError('cleanupLeafletEventManagement', error, { modalData });
        }
    }

    /**
     * Remove modal stabilization CSS
     */
    removeModalStabilizationCSS(modalData) {
        try {
            const { element: modalElement } = modalData;

            modalElement.style.removeProperty('--modal-stabilization');
            modalElement.style.contain = '';
            modalElement.style.isolation = '';

            this.log('Modal stabilization CSS removed', modalData.modalId);

        } catch (error) {
            this.handleError('removeModalStabilizationCSS', error, { modalData });
        }
    }

    /**
     * Remove stabilization classes
     */
    removeStabilizationClasses(modalData) {
        try {
            const { element: modalElement } = modalData;

            // Remove all stabilization classes
            const stabilizedElements = modalElement.querySelectorAll(
                '.modal-stabilized, .modal-content-stabilized, .modal-poi-stabilized, ' +
                '.modal-map-stabilized, .modal-chart-stabilized, .modal-poi-hover-active, ' +
                '.modal-marker-hover-active'
            );

            stabilizedElements.forEach(element => {
                element.classList.remove(
                    'modal-stabilized', 'modal-content-stabilized', 'modal-poi-stabilized',
                    'modal-map-stabilized', 'modal-chart-stabilized', 'modal-poi-hover-active',
                    'modal-marker-hover-active'
                );
            });

            modalElement.classList.remove('modal-stabilized');

            this.log('Stabilization classes removed', modalData.modalId);

        } catch (error) {
            this.handleError('removeStabilizationClasses', error, { modalData });
        }
    }

    /**
     * Get modal ID from modal element
     */
    getModalId(modalElement) {
        if (modalElement.id) {
            return modalElement.id;
        }
        
        if (modalElement.dataset && modalElement.dataset.modalId) {
            return modalElement.dataset.modalId;
        }
        
        // Generate unique ID
        const uniqueId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        modalElement.dataset.modalId = uniqueId;
        return uniqueId;
    }

    /**
     * Handle errors with logging
     */
    handleError(context, error, data = {}) {
        this.performanceMetrics.stabilizationErrors++;
        console.warn(`RouteModalStabilizer Error [${context}]:`, error, data);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            activeModals: this.activeModals.size,
            leafletEventManagers: this.leafletEventManagers.size,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        try {
            // Destabilize all active modals
            for (const [modalId, modalData] of this.activeModals.entries()) {
                this.performModalDestabilization(modalData);
            }

            // Cleanup modal hover isolation
            if (this.modalHoverIsolation) {
                this.modalHoverIsolation.cleanup();
            }

            // Cleanup modal observer
            if (this.modalObserver) {
                this.modalObserver.disconnect();
            }

            // Remove event listeners
            document.removeEventListener('modalShow', this.handleModalShow);
            document.removeEventListener('modalHide', this.handleModalHide);
            document.removeEventListener('routeModalShow', this.handleModalShow);
            document.removeEventListener('routeModalHide', this.handleModalHide);

            // Clear state
            this.activeModals.clear();
            this.leafletEventManagers.clear();

            this.isInitialized = false;
            this.log('RouteModalStabilizer cleanup completed');

        } catch (error) {
            console.error('Error during RouteModalStabilizer cleanup:', error);
        }
    }

    /**
     * Logging utility
     */
    log(message, data = null) {
        if (this.options.enableDebugLogging) {
            if (data) {
                console.log(`[RouteModalStabilizer] ${message}:`, data);
            } else {
                console.log(`[RouteModalStabilizer] ${message}`);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteModalStabilizer;
} else if (typeof window !== 'undefined') {
    window.RouteModalStabilizer = RouteModalStabilizer;
}