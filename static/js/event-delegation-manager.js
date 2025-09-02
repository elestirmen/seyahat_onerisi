/**
 * Event Delegation Manager
 * 
 * Handles event delegation to prevent conflicts between Leaflet and DOM events.
 * Provides a centralized system for managing event propagation and delegation.
 */

class EventDelegationManager {
    constructor(options = {}) {
        this.options = {
            stopPropagation: options.stopPropagation !== false, // Default true
            preventDefault: options.preventDefault || false,
            enableCapture: options.enableCapture || false,
            debugMode: options.debugMode || false,
            ...options
        };

        // Event delegation registry
        this.delegatedEvents = new Map(); // eventType -> Set of handlers
        this.elementHandlers = new WeakMap(); // element -> handlers
        this.leafletMarkers = new WeakSet(); // Track Leaflet markers
        
        // Conflict resolution
        this.conflictResolvers = new Map();
        this.eventPriorities = new Map();
        
        // Initialize delegation
        this.initializeDelegation();
        
        this.log('EventDelegationManager initialized');
    }

    /**
     * Initialize event delegation system
     */
    initializeDelegation() {
        // Common events that need delegation
        const delegatedEventTypes = [
            'click', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
            'touchstart', 'touchend', 'touchmove', 'contextmenu'
        ];

        delegatedEventTypes.forEach(eventType => {
            this.setupEventDelegation(eventType);
        });
    }

    /**
     * Setup event delegation for a specific event type
     */
    setupEventDelegation(eventType) {
        const handlers = new Set();
        this.delegatedEvents.set(eventType, handlers);

        // Create master event handler
        const masterHandler = (event) => {
            this.handleDelegatedEvent(eventType, event);
        };

        // Attach to document with capture phase if needed
        document.addEventListener(
            eventType, 
            masterHandler, 
            {
                capture: this.options.enableCapture,
                passive: eventType.startsWith('touch') ? true : false
            }
        );

        this.log(`Event delegation setup for: ${eventType}`);
    }

    /**
     * Handle delegated events with conflict resolution
     */
    handleDelegatedEvent(eventType, event) {
        try {
            const target = event.target;
            const handlers = this.delegatedEvents.get(eventType);
            
            if (!handlers || handlers.size === 0) {
                return;
            }

            // Check for Leaflet marker conflicts
            if (this.isLeafletMarker(target) || this.isInsideLeafletMarker(target)) {
                this.resolveLeafletConflict(eventType, event);
            }

            // Find matching handlers
            const matchingHandlers = this.findMatchingHandlers(eventType, target);
            
            if (matchingHandlers.length === 0) {
                return;
            }

            // Sort by priority
            matchingHandlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            // Execute handlers
            this.executeHandlers(eventType, event, matchingHandlers);

        } catch (error) {
            this.handleError('handleDelegatedEvent', error, { eventType, event });
        }
    }

    /**
     * Register a delegated event handler
     */
    registerHandler(selector, eventType, handler, options = {}) {
        try {
            const handlerData = {
                selector,
                handler,
                priority: options.priority || 0,
                stopPropagation: options.stopPropagation !== false,
                preventDefault: options.preventDefault || false,
                once: options.once || false,
                condition: options.condition || null,
                id: options.id || this.generateHandlerId(),
                registeredAt: Date.now()
            };

            // Get or create handlers set for this event type
            let handlers = this.delegatedEvents.get(eventType);
            if (!handlers) {
                handlers = new Set();
                this.delegatedEvents.set(eventType, handlers);
                this.setupEventDelegation(eventType);
            }

            handlers.add(handlerData);
            
            this.log(`Handler registered: ${eventType} -> ${selector}`, handlerData.id);
            return handlerData.id;

        } catch (error) {
            this.handleError('registerHandler', error, { selector, eventType });
            return null;
        }
    }

    /**
     * Unregister a delegated event handler
     */
    unregisterHandler(eventType, handlerId) {
        try {
            const handlers = this.delegatedEvents.get(eventType);
            if (!handlers) {
                return false;
            }

            for (const handlerData of handlers) {
                if (handlerData.id === handlerId) {
                    handlers.delete(handlerData);
                    this.log(`Handler unregistered: ${eventType} -> ${handlerId}`);
                    return true;
                }
            }

            return false;

        } catch (error) {
            this.handleError('unregisterHandler', error, { eventType, handlerId });
            return false;
        }
    }

    /**
     * Register a Leaflet marker for conflict resolution
     */
    registerLeafletMarker(marker) {
        if (marker && marker._icon) {
            this.leafletMarkers.add(marker._icon);
            this.log('Leaflet marker registered for conflict resolution');
        }
    }

    /**
     * Unregister a Leaflet marker
     */
    unregisterLeafletMarker(marker) {
        if (marker && marker._icon) {
            this.leafletMarkers.delete(marker._icon);
            this.log('Leaflet marker unregistered');
        }
    }

    /**
     * Check if element is a Leaflet marker
     */
    isLeafletMarker(element) {
        return this.leafletMarkers.has(element) || 
               element.classList.contains('leaflet-marker-icon') ||
               element.classList.contains('leaflet-div-icon') ||
               element.closest('.leaflet-marker-icon') !== null;
    }

    /**
     * Check if element is inside a Leaflet marker
     */
    isInsideLeafletMarker(element) {
        let current = element;
        while (current && current !== document.body) {
            if (this.isLeafletMarker(current)) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Resolve conflicts with Leaflet events
     */
    resolveLeafletConflict(eventType, event) {
        const resolver = this.conflictResolvers.get(eventType);
        
        if (resolver && typeof resolver === 'function') {
            try {
                const result = resolver(event);
                if (result === false) {
                    // Resolver decided to cancel the event
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                }
            } catch (error) {
                this.handleError('resolveLeafletConflict', error, { eventType, event });
            }
        }

        // Default conflict resolution
        if (eventType === 'click') {
            // Allow click events to propagate to Leaflet
            return true;
        } else if (eventType.startsWith('mouse')) {
            // Handle mouse events carefully to avoid interference
            if (this.options.stopPropagation) {
                event.stopPropagation();
            }
            return true;
        }

        return true;
    }

    /**
     * Register a conflict resolver for specific event types
     */
    registerConflictResolver(eventType, resolver) {
        if (typeof resolver === 'function') {
            this.conflictResolvers.set(eventType, resolver);
            this.log(`Conflict resolver registered for: ${eventType}`);
        }
    }

    /**
     * Find handlers that match the current target
     */
    findMatchingHandlers(eventType, target) {
        const handlers = this.delegatedEvents.get(eventType);
        if (!handlers) {
            return [];
        }

        const matchingHandlers = [];

        for (const handlerData of handlers) {
            if (this.elementMatches(target, handlerData.selector)) {
                // Check additional conditions
                if (handlerData.condition && !handlerData.condition(target, eventType)) {
                    continue;
                }

                matchingHandlers.push(handlerData);
            }
        }

        return matchingHandlers;
    }

    /**
     * Check if element matches selector
     */
    elementMatches(element, selector) {
        try {
            if (typeof selector === 'string') {
                return element.matches(selector) || element.closest(selector) !== null;
            } else if (typeof selector === 'function') {
                return selector(element);
            } else if (selector instanceof HTMLElement) {
                return element === selector || selector.contains(element);
            }
            return false;
        } catch (error) {
            this.handleError('elementMatches', error, { element, selector });
            return false;
        }
    }

    /**
     * Execute matching handlers
     */
    executeHandlers(eventType, event, handlers) {
        let propagationStopped = false;

        for (const handlerData of handlers) {
            try {
                // Check if propagation was stopped by previous handler
                if (propagationStopped && handlerData.priority <= 0) {
                    break;
                }

                // Execute handler
                const result = handlerData.handler(event, event.target);

                // Handle result
                if (result === false) {
                    event.preventDefault();
                    if (handlerData.stopPropagation) {
                        event.stopPropagation();
                        propagationStopped = true;
                    }
                }

                // Handle preventDefault option
                if (handlerData.preventDefault) {
                    event.preventDefault();
                }

                // Handle stopPropagation option
                if (handlerData.stopPropagation) {
                    event.stopPropagation();
                    propagationStopped = true;
                }

                // Remove handler if it's a one-time handler
                if (handlerData.once) {
                    const handlers = this.delegatedEvents.get(eventType);
                    if (handlers) {
                        handlers.delete(handlerData);
                    }
                }

            } catch (error) {
                this.handleError('executeHandlers', error, { eventType, handlerData });
            }
        }
    }

    /**
     * Generate unique handler ID
     */
    generateHandlerId() {
        return `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Set event priority for conflict resolution
     */
    setEventPriority(eventType, priority) {
        this.eventPriorities.set(eventType, priority);
    }

    /**
     * Get event priority
     */
    getEventPriority(eventType) {
        return this.eventPriorities.get(eventType) || 0;
    }

    /**
     * Handle errors
     */
    handleError(context, error, data = {}) {
        console.warn(`EventDelegationManager Error [${context}]:`, error, data);
    }

    /**
     * Get delegation statistics
     */
    getStats() {
        const stats = {
            totalEventTypes: this.delegatedEvents.size,
            totalHandlers: 0,
            handlersByType: {}
        };

        for (const [eventType, handlers] of this.delegatedEvents.entries()) {
            const count = handlers.size;
            stats.totalHandlers += count;
            stats.handlersByType[eventType] = count;
        }

        return stats;
    }

    /**
     * Clean up all delegated events
     */
    cleanup() {
        try {
            // Clear all handlers
            this.delegatedEvents.clear();
            this.elementHandlers = new WeakMap();
            this.leafletMarkers = new WeakSet();
            this.conflictResolvers.clear();
            this.eventPriorities.clear();

            this.log('EventDelegationManager cleanup completed');

        } catch (error) {
            this.handleError('cleanup', error);
        }
    }

    /**
     * Logging utility
     */
    log(message, data = null) {
        if (this.options.debugMode) {
            if (data) {
                console.log(`[EventDelegationManager] ${message}:`, data);
            } else {
                console.log(`[EventDelegationManager] ${message}`);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventDelegationManager;
} else if (typeof window !== 'undefined') {
    window.EventDelegationManager = EventDelegationManager;
}