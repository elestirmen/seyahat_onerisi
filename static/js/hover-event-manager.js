/**
 * POI Hover Event Management System
 * 
 * This module provides a centralized system for managing hover events on POI markers
 * with debouncing, event delegation, memory leak prevention, and error handling.
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

class HoverEventManager {
    constructor(options = {}) {
        // Configuration options
        this.options = {
            debounceDelay: options.debounceDelay || 100,
            hoverDelay: options.hoverDelay || 50,
            leaveDelay: options.leaveDelay || 150,
            maxActiveHovers: options.maxActiveHovers || 50,
            enableDebugLogging: options.enableDebugLogging || false,
            ...options
        };

        // State management
        this.activeHovers = new Map(); // markerId -> hoverState
        this.eventListeners = new Map(); // element -> eventHandlers
        this.debounceTimers = new Map(); // markerId -> timerId
        this.hoverQueue = new Set(); // pending hover operations
        
        // Performance tracking
        this.performanceMetrics = {
            totalHovers: 0,
            totalLeaves: 0,
            totalClicks: 0,
            averageHoverTime: 0,
            memoryLeaks: 0
        };

        // Error handling
        this.errorHandlers = new Map();
        this.fallbackHandlers = new Map();

        // Performance monitoring integration
        this.performanceMonitor = null;
        if (window.PerformanceMonitor) {
            this.performanceMonitor = new window.PerformanceMonitor({
                enableLogging: this.options.enableDebugLogging
            });
        }

        // Bind methods to preserve context
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.cleanup = this.cleanup.bind(this);

        // Initialize cleanup on page unload
        this.initializeCleanup();

        // Listen for performance optimization events
        this.setupPerformanceOptimizationListeners();

        this.log('HoverEventManager initialized', this.options);
    }

    /**
     * Attach hover events to a marker element
     * @param {HTMLElement|L.Marker} marker - The marker element or Leaflet marker
     * @param {Object} callbacks - Event callbacks
     * @param {Function} callbacks.onHoverStart - Called when hover starts
     * @param {Function} callbacks.onHoverEnd - Called when hover ends
     * @param {Function} callbacks.onClick - Called when marker is clicked
     * @param {Object} options - Additional options
     */
    attachHoverEvents(marker, callbacks = {}, options = {}) {
        try {
            const markerId = this.getMarkerId(marker);
            const element = this.getMarkerElement(marker);
            
            if (!element) {
                this.handleError('attachHoverEvents', new Error('Invalid marker element'), { marker, callbacks });
                return false;
            }

            // Prevent duplicate attachments
            if (this.eventListeners.has(element)) {
                this.log('Events already attached to marker', markerId);
                return true;
            }

            // Create event handlers with error handling
            const handlers = this.createEventHandlers(markerId, callbacks, options);
            
            // Attach mouse events
            element.addEventListener('mouseenter', handlers.mouseEnter, { passive: true });
            element.addEventListener('mouseleave', handlers.mouseLeave, { passive: true });
            element.addEventListener('click', handlers.click, { passive: false });

            // Attach touch events for mobile support
            element.addEventListener('touchstart', handlers.touchStart, { passive: true });
            element.addEventListener('touchend', handlers.touchEnd, { passive: false });

            // Store handlers for cleanup
            this.eventListeners.set(element, {
                markerId,
                handlers,
                callbacks,
                options,
                attachedAt: Date.now()
            });

            this.log('Events attached to marker', markerId);
            return true;

        } catch (error) {
            this.handleError('attachHoverEvents', error, { marker, callbacks });
            return false;
        }
    }

    /**
     * Detach hover events from a marker element
     * @param {HTMLElement|L.Marker} marker - The marker element or Leaflet marker
     */
    detachHoverEvents(marker) {
        try {
            const element = this.getMarkerElement(marker);
            const markerId = this.getMarkerId(marker);
            
            if (!element || !this.eventListeners.has(element)) {
                this.log('No events to detach for marker', markerId);
                return true;
            }

            const eventData = this.eventListeners.get(element);
            const { handlers } = eventData;

            // Remove event listeners
            element.removeEventListener('mouseenter', handlers.mouseEnter);
            element.removeEventListener('mouseleave', handlers.mouseLeave);
            element.removeEventListener('click', handlers.click);
            element.removeEventListener('touchstart', handlers.touchStart);
            element.removeEventListener('touchend', handlers.touchEnd);

            // Clean up state
            this.cleanupMarkerState(markerId);
            this.eventListeners.delete(element);

            this.log('Events detached from marker', markerId);
            return true;

        } catch (error) {
            this.handleError('detachHoverEvents', error, { marker });
            return false;
        }
    }

    /**
     * Create event handlers with debouncing and error handling
     */
    createEventHandlers(markerId, callbacks, options) {
        return {
            mouseEnter: (event) => {
                this.handleMouseEnter(event, markerId, callbacks, options);
            },
            mouseLeave: (event) => {
                this.handleMouseLeave(event, markerId, callbacks, options);
            },
            click: (event) => {
                this.handleClick(event, markerId, callbacks, options);
            },
            touchStart: (event) => {
                this.handleTouchStart(event, markerId, callbacks, options);
            },
            touchEnd: (event) => {
                this.handleTouchEnd(event, markerId, callbacks, options);
            }
        };
    }

    /**
     * Handle mouse enter with debouncing
     */
    handleMouseEnter(event, markerId, callbacks, options) {
        try {
            // Performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.markStart(`hover-enter-${markerId}`);
            }

            // Clear any pending leave operation
            this.clearDebounceTimer(markerId, 'leave');

            // Check if already hovering
            if (this.activeHovers.has(markerId)) {
                return;
            }

            // Debounce rapid enter events
            this.clearDebounceTimer(markerId, 'enter');
            const timerId = setTimeout(() => {
                this.executeHoverStart(event, markerId, callbacks, options);
                
                // Mark performance end
                if (this.performanceMonitor) {
                    this.performanceMonitor.markEnd(`hover-enter-${markerId}`);
                }
            }, this.options.hoverDelay);

            this.debounceTimers.set(`${markerId}_enter`, timerId);

        } catch (error) {
            this.handleError('handleMouseEnter', error, { markerId, event });
        }
    }

    /**
     * Handle mouse leave with debouncing
     */
    handleMouseLeave(event, markerId, callbacks, options) {
        try {
            // Performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.markStart(`hover-leave-${markerId}`);
            }

            // Clear any pending enter operation
            this.clearDebounceTimer(markerId, 'enter');

            // Check if not hovering
            if (!this.activeHovers.has(markerId)) {
                return;
            }

            // Debounce rapid leave events
            this.clearDebounceTimer(markerId, 'leave');
            const timerId = setTimeout(() => {
                this.executeHoverEnd(event, markerId, callbacks, options);
                
                // Mark performance end
                if (this.performanceMonitor) {
                    this.performanceMonitor.markEnd(`hover-leave-${markerId}`);
                }
            }, this.options.leaveDelay);

            this.debounceTimers.set(`${markerId}_leave`, timerId);

        } catch (error) {
            this.handleError('handleMouseLeave', error, { markerId, event });
        }
    }

    /**
     * Handle click events with conflict prevention
     */
    handleClick(event, markerId, callbacks, options) {
        try {
            // Prevent event bubbling to avoid conflicts with Leaflet
            event.stopPropagation();

            // Track click metrics
            this.performanceMetrics.totalClicks++;

            // Execute click callback
            if (callbacks.onClick && typeof callbacks.onClick === 'function') {
                // Ensure marker remains clickable during hover state
                const result = callbacks.onClick(event, markerId, {
                    isHovering: this.activeHovers.has(markerId),
                    hoverState: this.activeHovers.get(markerId)
                });

                // Handle async callbacks
                if (result instanceof Promise) {
                    result.catch(error => {
                        this.handleError('onClick callback', error, { markerId, event });
                    });
                }
            }

            this.log('Click handled for marker', markerId);

        } catch (error) {
            this.handleError('handleClick', error, { markerId, event });
        }
    }

    /**
     * Handle touch start for mobile devices
     */
    handleTouchStart(event, markerId, callbacks, options) {
        try {
            // Store touch start time for touch duration calculation
            const touchData = {
                startTime: Date.now(),
                startX: event.touches[0]?.clientX || 0,
                startY: event.touches[0]?.clientY || 0
            };

            this.activeHovers.set(`${markerId}_touch`, touchData);

            // Simulate hover start on touch
            if (callbacks.onHoverStart) {
                setTimeout(() => {
                    this.executeHoverStart(event, markerId, callbacks, options);
                }, 100); // Short delay to distinguish from scroll
            }

        } catch (error) {
            this.handleError('handleTouchStart', error, { markerId, event });
        }
    }

    /**
     * Handle touch end for mobile devices
     */
    handleTouchEnd(event, markerId, callbacks, options) {
        try {
            const touchKey = `${markerId}_touch`;
            const touchData = this.activeHovers.get(touchKey);

            if (touchData) {
                const touchDuration = Date.now() - touchData.startTime;
                const endX = event.changedTouches[0]?.clientX || 0;
                const endY = event.changedTouches[0]?.clientY || 0;
                
                // Calculate touch movement
                const moveDistance = Math.sqrt(
                    Math.pow(endX - touchData.startX, 2) + 
                    Math.pow(endY - touchData.startY, 2)
                );

                // If touch was short and didn't move much, treat as click
                if (touchDuration < 500 && moveDistance < 10) {
                    this.handleClick(event, markerId, callbacks, options);
                }

                // Clean up touch data
                this.activeHovers.delete(touchKey);
            }

            // End hover state
            if (this.activeHovers.has(markerId)) {
                setTimeout(() => {
                    this.executeHoverEnd(event, markerId, callbacks, options);
                }, 200); // Delay to allow for potential click
            }

        } catch (error) {
            this.handleError('handleTouchEnd', error, { markerId, event });
        }
    }

    /**
     * Execute hover start with error handling
     */
    executeHoverStart(event, markerId, callbacks, options) {
        try {
            // Check memory limits
            if (this.activeHovers.size >= this.options.maxActiveHovers) {
                this.cleanupOldestHovers();
            }

            // Create hover state
            const hoverState = {
                markerId,
                startTime: Date.now(),
                element: event.target,
                isActive: true,
                callbacks,
                options
            };

            this.activeHovers.set(markerId, hoverState);
            this.performanceMetrics.totalHovers++;

            // Execute callback
            if (callbacks.onHoverStart && typeof callbacks.onHoverStart === 'function') {
                const result = callbacks.onHoverStart(event, markerId, hoverState);
                
                if (result instanceof Promise) {
                    result.catch(error => {
                        this.handleError('onHoverStart callback', error, { markerId, event });
                    });
                }
            }

            this.log('Hover started for marker', markerId);

        } catch (error) {
            this.handleError('executeHoverStart', error, { markerId, event });
        }
    }

    /**
     * Execute hover end with error handling
     */
    executeHoverEnd(event, markerId, callbacks, options) {
        try {
            const hoverState = this.activeHovers.get(markerId);
            
            if (!hoverState) {
                return;
            }

            // Calculate hover duration
            const hoverDuration = Date.now() - hoverState.startTime;
            this.updateAverageHoverTime(hoverDuration);

            // Mark as inactive
            hoverState.isActive = false;
            hoverState.endTime = Date.now();
            hoverState.duration = hoverDuration;

            // Execute callback
            if (callbacks.onHoverEnd && typeof callbacks.onHoverEnd === 'function') {
                const result = callbacks.onHoverEnd(event, markerId, hoverState);
                
                if (result instanceof Promise) {
                    result.catch(error => {
                        this.handleError('onHoverEnd callback', error, { markerId, event });
                    });
                }
            }

            // Clean up hover state
            this.activeHovers.delete(markerId);
            this.performanceMetrics.totalLeaves++;

            this.log('Hover ended for marker', markerId);

        } catch (error) {
            this.handleError('executeHoverEnd', error, { markerId, event });
        }
    }

    /**
     * Get marker ID from marker element or Leaflet marker
     */
    getMarkerId(marker) {
        if (typeof marker === 'string') {
            return marker;
        }
        
        if (marker && marker._leaflet_id) {
            return `leaflet_${marker._leaflet_id}`;
        }
        
        if (marker && marker.id) {
            return marker.id;
        }
        
        if (marker && marker.dataset && marker.dataset.markerId) {
            return marker.dataset.markerId;
        }
        
        // Generate unique ID if none exists
        const uniqueId = `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (marker && marker.dataset) {
            marker.dataset.markerId = uniqueId;
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
     * Clear debounce timer
     */
    clearDebounceTimer(markerId, type) {
        const timerKey = `${markerId}_${type}`;
        const timerId = this.debounceTimers.get(timerKey);
        
        if (timerId) {
            clearTimeout(timerId);
            this.debounceTimers.delete(timerKey);
        }
    }

    /**
     * Clean up marker state
     */
    cleanupMarkerState(markerId) {
        this.activeHovers.delete(markerId);
        this.clearDebounceTimer(markerId, 'enter');
        this.clearDebounceTimer(markerId, 'leave');
        this.hoverQueue.delete(markerId);
    }

    /**
     * Clean up oldest hovers to prevent memory issues
     */
    cleanupOldestHovers() {
        const sortedHovers = Array.from(this.activeHovers.entries())
            .sort(([, a], [, b]) => a.startTime - b.startTime);
        
        const toRemove = sortedHovers.slice(0, Math.floor(this.options.maxActiveHovers * 0.2));
        
        toRemove.forEach(([markerId, hoverState]) => {
            try {
                if (hoverState.callbacks.onHoverEnd) {
                    hoverState.callbacks.onHoverEnd(null, markerId, hoverState);
                }
            } catch (error) {
                this.handleError('cleanupOldestHovers', error, { markerId });
            }
            
            this.activeHovers.delete(markerId);
        });

        this.log('Cleaned up oldest hovers', toRemove.length);
    }

    /**
     * Update average hover time metric
     */
    updateAverageHoverTime(duration) {
        const totalHovers = this.performanceMetrics.totalHovers;
        const currentAverage = this.performanceMetrics.averageHoverTime;
        
        this.performanceMetrics.averageHoverTime = 
            (currentAverage * (totalHovers - 1) + duration) / totalHovers;
    }

    /**
     * Handle errors with fallback mechanisms
     */
    handleError(context, error, data = {}) {
        this.performanceMetrics.memoryLeaks++;
        
        // Log error
        console.warn(`HoverEventManager Error [${context}]:`, error, data);
        
        // Execute custom error handler if available
        const errorHandler = this.errorHandlers.get(context);
        if (errorHandler && typeof errorHandler === 'function') {
            try {
                errorHandler(error, data);
            } catch (handlerError) {
                console.error('Error handler failed:', handlerError);
            }
        }
        
        // Execute fallback handler
        const fallbackHandler = this.fallbackHandlers.get(context);
        if (fallbackHandler && typeof fallbackHandler === 'function') {
            try {
                fallbackHandler(data);
            } catch (fallbackError) {
                console.error('Fallback handler failed:', fallbackError);
            }
        }
    }

    /**
     * Register custom error handler
     */
    registerErrorHandler(context, handler) {
        if (typeof handler === 'function') {
            this.errorHandlers.set(context, handler);
        }
    }

    /**
     * Register fallback handler
     */
    registerFallbackHandler(context, handler) {
        if (typeof handler === 'function') {
            this.fallbackHandlers.set(context, handler);
        }
    }

    /**
     * Setup performance optimization listeners
     */
    setupPerformanceOptimizationListeners() {
        // Listen for performance optimization events
        document.addEventListener('performanceOptimization', (event) => {
            const { newLevel, oldLevel } = event.detail;
            this.adjustForPerformanceLevel(newLevel, oldLevel);
        });

        // Listen for memory cleanup events
        document.addEventListener('memoryCleanup', (event) => {
            this.performMemoryCleanup();
        });
    }

    /**
     * Adjust hover behavior based on performance level
     */
    adjustForPerformanceLevel(newLevel, oldLevel) {
        this.log(`Adjusting hover behavior for performance level: ${oldLevel} -> ${newLevel}`);

        switch (newLevel) {
            case 0: // Normal performance
                this.options.debounceDelay = 100;
                this.options.hoverDelay = 50;
                this.options.leaveDelay = 150;
                break;
                
            case 1: // Reduced performance
                this.options.debounceDelay = 150;
                this.options.hoverDelay = 100;
                this.options.leaveDelay = 200;
                break;
                
            case 2: // Minimal performance
                this.options.debounceDelay = 200;
                this.options.hoverDelay = 200;
                this.options.leaveDelay = 300;
                // Reduce max active hovers
                this.options.maxActiveHovers = Math.min(this.options.maxActiveHovers, 20);
                break;
        }

        // Clean up excess hovers if needed
        if (this.activeHovers.size > this.options.maxActiveHovers) {
            this.cleanupOldestHovers();
        }
    }

    /**
     * Perform memory cleanup specific to hover events
     */
    performMemoryCleanup() {
        this.log('Performing hover event memory cleanup');

        // Clean up stale hover states
        const now = Date.now();
        const staleThreshold = 30000; // 30 seconds
        
        for (const [markerId, hoverState] of this.activeHovers.entries()) {
            if (now - hoverState.startTime > staleThreshold) {
                this.cleanupMarkerState(markerId);
            }
        }

        // Clear orphaned timers
        for (const [timerKey, timerId] of this.debounceTimers.entries()) {
            if (!timerId || typeof timerId !== 'number') {
                this.debounceTimers.delete(timerKey);
            }
        }

        // Force cleanup of oldest hovers if we have too many
        if (this.activeHovers.size > this.options.maxActiveHovers * 0.8) {
            this.cleanupOldestHovers();
        }
    }

    /**
     * Initialize cleanup mechanisms
     */
    initializeCleanup() {
        // Cleanup on page unload
        window.addEventListener('beforeunload', this.cleanup);
        window.addEventListener('unload', this.cleanup);
        
        // Cleanup on visibility change (mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanup();
            }
        });

        // Periodic cleanup
        setInterval(() => {
            this.performPeriodicCleanup();
        }, 30000); // Every 30 seconds
    }

    /**
     * Perform periodic cleanup
     */
    performPeriodicCleanup() {
        try {
            // Clean up stale hover states
            const now = Date.now();
            const staleThreshold = 60000; // 1 minute
            
            for (const [markerId, hoverState] of this.activeHovers.entries()) {
                if (now - hoverState.startTime > staleThreshold) {
                    this.cleanupMarkerState(markerId);
                }
            }

            // Clean up orphaned timers
            for (const [timerKey, timerId] of this.debounceTimers.entries()) {
                if (timerId && typeof timerId === 'number') {
                    // Timer is still valid, keep it
                    continue;
                }
                this.debounceTimers.delete(timerKey);
            }

            this.log('Periodic cleanup completed');

        } catch (error) {
            this.handleError('performPeriodicCleanup', error);
        }
    }

    /**
     * Complete cleanup of all resources
     */
    cleanup() {
        try {
            // Clear all timers
            for (const timerId of this.debounceTimers.values()) {
                if (timerId) {
                    clearTimeout(timerId);
                }
            }
            this.debounceTimers.clear();

            // End all active hovers
            for (const [markerId, hoverState] of this.activeHovers.entries()) {
                try {
                    if (hoverState.callbacks.onHoverEnd) {
                        hoverState.callbacks.onHoverEnd(null, markerId, hoverState);
                    }
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
            this.activeHovers.clear();

            // Remove all event listeners
            for (const [element, eventData] of this.eventListeners.entries()) {
                try {
                    const { handlers } = eventData;
                    element.removeEventListener('mouseenter', handlers.mouseEnter);
                    element.removeEventListener('mouseleave', handlers.mouseLeave);
                    element.removeEventListener('click', handlers.click);
                    element.removeEventListener('touchstart', handlers.touchStart);
                    element.removeEventListener('touchend', handlers.touchEnd);
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
            this.eventListeners.clear();

            // Clear other state
            this.hoverQueue.clear();
            this.errorHandlers.clear();
            this.fallbackHandlers.clear();

            // Cleanup performance monitor
            if (this.performanceMonitor) {
                this.performanceMonitor.destroy();
                this.performanceMonitor = null;
            }

            this.log('Complete cleanup performed');

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            activeHovers: this.activeHovers.size,
            attachedListeners: this.eventListeners.size,
            pendingTimers: this.debounceTimers.size
        };
    }

    /**
     * Get current hover states
     */
    getActiveHovers() {
        return Array.from(this.activeHovers.entries()).map(([markerId, state]) => ({
            markerId,
            duration: Date.now() - state.startTime,
            isActive: state.isActive
        }));
    }

    /**
     * Check if marker is currently being hovered
     */
    isHovering(markerId) {
        return this.activeHovers.has(markerId);
    }

    /**
     * Force end hover state for a marker
     */
    forceEndHover(markerId) {
        const hoverState = this.activeHovers.get(markerId);
        if (hoverState) {
            this.executeHoverEnd(null, markerId, hoverState.callbacks, hoverState.options);
        }
    }

    /**
     * Logging utility
     */
    log(message, data = null) {
        if (this.options.enableDebugLogging) {
            if (data) {
                console.log(`[HoverEventManager] ${message}:`, data);
            } else {
                console.log(`[HoverEventManager] ${message}`);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HoverEventManager;
} else if (typeof window !== 'undefined') {
    window.HoverEventManager = HoverEventManager;
}