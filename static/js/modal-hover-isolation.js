/**
 * Modal Hover Isolation System
 * Isolates modal hover events from main page events to prevent conflicts
 * Provides debouncing and stabilization for modal interactions
 */

class ModalHoverIsolation {
    constructor(options = {}) {
        this.options = {
            debounceDelay: options.debounceDelay || 100,
            enableDebugLogging: options.enableDebugLogging || false,
            isolationEnabled: options.isolationEnabled !== false,
            autoRestore: options.autoRestore !== false,
            ...options
        };

        // State management
        this.isIsolated = false;
        this.modalElement = null;
        this.isolatedElements = new Set();
        this.originalEventHandlers = new Map();
        this.debounceTimers = new Map();
        this.activeHovers = new Set();

        // Bind methods
        this.isolateEvents = this.isolateEvents.bind(this);
        this.restoreEvents = this.restoreEvents.bind(this);
        this.handleModalHover = this.handleModalHover.bind(this);
        this.handleModalLeave = this.handleModalLeave.bind(this);

        this.log('ModalHoverIsolation initialized', this.options);
    }

    /**
     * Isolate modal events from main page
     * @param {HTMLElement} modalElement - Modal container element
     */
    isolateEvents(modalElement) {
        if (!modalElement || this.isIsolated) {
            this.log('Cannot isolate events', { modalElement, isIsolated: this.isIsolated });
            return false;
        }

        this.modalElement = modalElement;
        this.isIsolated = true;

        this.log('Isolating modal events', { modalId: modalElement.id });

        // Disable main page hover events
        this.disableMainPageEvents();

        // Enable modal-specific hover events
        this.enableModalEvents();

        // Apply isolation CSS classes
        this.applyIsolationClasses();

        // Setup auto-restore if enabled
        if (this.options.autoRestore) {
            this.setupAutoRestore();
        }

        return true;
    }

    /**
     * Restore main page events and clean up modal isolation
     */
    restoreEvents() {
        if (!this.isIsolated) {
            this.log('Events not isolated, nothing to restore');
            return false;
        }

        this.log('Restoring main page events');

        // Enable main page hover events
        this.enableMainPageEvents();

        // Clean up modal events
        this.cleanupModalEvents();

        // Remove isolation CSS classes
        this.removeIsolationClasses();

        // Reset state
        this.isIsolated = false;
        this.modalElement = null;
        this.isolatedElements.clear();
        this.activeHovers.clear();

        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        this.log('Event restoration completed');
        return true;
    }

    /**
     * Disable main page hover events to prevent conflicts
     */
    disableMainPageEvents() {
        // Find main page interactive elements
        const mainPageElements = document.querySelectorAll(`
            .poi-marker-container:not(.route-details-modal *),
            .custom-poi-marker:not(.route-details-modal *),
            .leaflet-marker-icon:not(.route-details-modal *),
            .leaflet-interactive:not(.route-details-modal *)
        `);

        mainPageElements.forEach(element => {
            // Store original event handlers
            const originalHandlers = {
                mouseenter: element.onmouseenter,
                mouseleave: element.onmouseleave,
                mouseover: element.onmouseover,
                mouseout: element.onmouseout,
                click: element.onclick
            };

            this.originalEventHandlers.set(element, originalHandlers);

            // Disable events by adding CSS class
            element.classList.add('modal-hover-disabled');
            
            // Store reference for cleanup
            this.isolatedElements.add(element);
        });

        this.log('Disabled main page events', { count: mainPageElements.length });
    }

    /**
     * Enable main page hover events
     */
    enableMainPageEvents() {
        this.isolatedElements.forEach(element => {
            // Remove disabled class
            element.classList.remove('modal-hover-disabled');

            // Restore original event handlers if they existed
            const originalHandlers = this.originalEventHandlers.get(element);
            if (originalHandlers) {
                Object.entries(originalHandlers).forEach(([eventType, handler]) => {
                    if (handler) {
                        element[`on${eventType}`] = handler;
                    }
                });
            }
        });

        this.originalEventHandlers.clear();
        this.log('Enabled main page events');
    }

    /**
     * Enable modal-specific hover events with debouncing
     */
    enableModalEvents() {
        if (!this.modalElement) return;

        // Find modal interactive elements
        const modalElements = this.modalElement.querySelectorAll(`
            .poi-marker-container,
            .custom-poi-marker,
            .leaflet-marker-icon,
            .leaflet-interactive,
            .elevation-poi-icon,
            .elevation-media-icon
        `);

        modalElements.forEach(element => {
            // Add stabilization class
            element.classList.add('modal-content-stabilized');

            // Setup debounced hover events
            this.setupDebouncedHoverEvents(element);
        });

        this.log('Enabled modal events', { count: modalElements.length });
    }

    /**
     * Setup debounced hover events for modal elements
     * @param {HTMLElement} element - Element to setup events for
     */
    setupDebouncedHoverEvents(element) {
        const elementId = this.getElementId(element);

        // Debounced mouseenter handler
        const handleMouseEnter = this.createDebouncedHandler(
            `mouseenter_${elementId}`,
            () => this.handleModalHover(element)
        );

        // Debounced mouseleave handler
        const handleMouseLeave = this.createDebouncedHandler(
            `mouseleave_${elementId}`,
            () => this.handleModalLeave(element)
        );

        // Attach event listeners
        element.addEventListener('mouseenter', handleMouseEnter, { passive: true });
        element.addEventListener('mouseleave', handleMouseLeave, { passive: true });

        // Store handlers for cleanup
        element._modalHoverHandlers = {
            mouseenter: handleMouseEnter,
            mouseleave: handleMouseLeave
        };
    }

    /**
     * Create debounced event handler
     * @param {string} timerId - Timer identifier
     * @param {Function} handler - Handler function
     * @returns {Function} Debounced handler
     */
    createDebouncedHandler(timerId, handler) {
        return (e) => {
            // Clear existing timer
            if (this.debounceTimers.has(timerId)) {
                clearTimeout(this.debounceTimers.get(timerId));
            }

            // Set new timer
            const timer = setTimeout(() => {
                handler(e);
                this.debounceTimers.delete(timerId);
            }, this.options.debounceDelay);

            this.debounceTimers.set(timerId, timer);
        };
    }

    /**
     * Handle modal element hover with stabilization
     * @param {HTMLElement} element - Hovered element
     */
    handleModalHover(element) {
        if (!this.isIsolated) return;

        const elementId = this.getElementId(element);
        if (this.activeHovers.has(elementId)) return;

        this.log('Modal hover start', { elementId });

        // Add to active hovers
        this.activeHovers.add(elementId);

        // Apply stabilized hover effect
        element.classList.add('modal-marker-hover-active');

        // Remove problematic CSS transforms that cause jitter
        if (element.style.transform) {
            const transform = element.style.transform;
            // Remove scale transforms but keep others
            element.style.transform = transform.replace(/scale\([^)]*\)/g, '');
        }

        // Dispatch custom event for external handlers
        if (this.modalElement) {
            this.modalElement.dispatchEvent(new CustomEvent('modalElementHover', {
                detail: {
                    element: element,
                    elementId: elementId,
                    action: 'enter'
                }
            }));
        }
    }

    /**
     * Handle modal element leave
     * @param {HTMLElement} element - Element being left
     */
    handleModalLeave(element) {
        if (!this.isIsolated) return;

        const elementId = this.getElementId(element);
        if (!this.activeHovers.has(elementId)) return;

        this.log('Modal hover end', { elementId });

        // Remove from active hovers
        this.activeHovers.delete(elementId);

        // Remove hover effect
        element.classList.remove('modal-marker-hover-active');

        // Dispatch custom event for external handlers
        if (this.modalElement) {
            this.modalElement.dispatchEvent(new CustomEvent('modalElementHover', {
                detail: {
                    element: element,
                    elementId: elementId,
                    action: 'leave'
                }
            }));
        }
    }

    /**
     * Clean up modal events
     */
    cleanupModalEvents() {
        if (!this.modalElement) return;

        const modalElements = this.modalElement.querySelectorAll('.modal-content-stabilized');

        modalElements.forEach(element => {
            // Remove stabilization class
            element.classList.remove('modal-content-stabilized', 'modal-marker-hover-active');

            // Remove event listeners
            if (element._modalHoverHandlers) {
                Object.entries(element._modalHoverHandlers).forEach(([eventType, handler]) => {
                    element.removeEventListener(eventType, handler);
                });
                delete element._modalHoverHandlers;
            }
        });

        this.log('Cleaned up modal events');
    }

    /**
     * Apply isolation CSS classes
     */
    applyIsolationClasses() {
        if (!this.modalElement) return;

        // Apply modal isolation class
        this.modalElement.classList.add('modal-hover-isolated');

        // Apply stabilization to modal content
        const modalContent = this.modalElement.querySelector('.route-details-modal-content');
        if (modalContent) {
            modalContent.classList.add('modal-content-stabilized');
        }

        // Apply stabilization to modal body
        const modalBody = this.modalElement.querySelector('.route-details-modal-body');
        if (modalBody) {
            modalBody.classList.add('modal-content-stabilized');
        }

        this.log('Applied isolation classes');
    }

    /**
     * Remove isolation CSS classes
     */
    removeIsolationClasses() {
        if (!this.modalElement) return;

        // Remove modal isolation class
        this.modalElement.classList.remove('modal-hover-isolated');

        // Remove stabilization classes
        const stabilizedElements = this.modalElement.querySelectorAll('.modal-content-stabilized');
        stabilizedElements.forEach(element => {
            element.classList.remove('modal-content-stabilized');
        });

        this.log('Removed isolation classes');
    }

    /**
     * Setup automatic restoration when modal is closed
     */
    setupAutoRestore() {
        if (!this.modalElement) return;

        // Listen for modal close events
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const classList = this.modalElement.classList;
                    if (!classList.contains('show') && this.isIsolated) {
                        this.restoreEvents();
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
        const handleModalHide = () => {
            if (this.isIsolated) {
                this.restoreEvents();
            }
        };

        document.addEventListener('routeModalHide', handleModalHide);

        // Store cleanup function
        this.cleanupAutoRestore = () => {
            if (this.modalObserver) {
                this.modalObserver.disconnect();
                this.modalObserver = null;
            }
            document.removeEventListener('routeModalHide', handleModalHide);
        };

        this.log('Setup auto restore');
    }

    /**
     * Get unique identifier for element
     * @param {HTMLElement} element - Element to get ID for
     * @returns {string} Unique identifier
     */
    getElementId(element) {
        if (element.id) return element.id;
        if (element._leaflet_id) return `leaflet_${element._leaflet_id}`;
        if (element.dataset && element.dataset.poiId) return `poi_${element.dataset.poiId}`;
        
        // Generate unique ID based on element properties
        const rect = element.getBoundingClientRect();
        return `element_${Math.round(rect.left)}_${Math.round(rect.top)}_${element.tagName}`;
    }

    /**
     * Get current isolation state
     * @returns {Object} Isolation state
     */
    getIsolationState() {
        return {
            isIsolated: this.isIsolated,
            isolatedElementsCount: this.isolatedElements.size,
            activeHoversCount: this.activeHovers.size,
            debounceTimersCount: this.debounceTimers.size,
            modalElementId: this.modalElement?.id || null
        };
    }

    /**
     * Debug logging helper
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    log(message, data = null) {
        if (!this.options.enableDebugLogging) return;

        const prefix = '[ModalHoverIsolation]';
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    /**
     * Cleanup all resources
     */
    destroy() {
        this.log('Destroying ModalHoverIsolation');

        // Restore events if isolated
        if (this.isIsolated) {
            this.restoreEvents();
        }

        // Cleanup auto restore
        if (this.cleanupAutoRestore) {
            this.cleanupAutoRestore();
        }

        // Clear all references
        this.modalElement = null;
        this.isolatedElements.clear();
        this.originalEventHandlers.clear();
        this.activeHovers.clear();
        
        // Clear timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        this.log('ModalHoverIsolation destroyed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ModalHoverIsolation = ModalHoverIsolation;
}

// Also support module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalHoverIsolation;
}