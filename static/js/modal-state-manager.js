/**
 * Modal State Manager - Task 2: Create centralized modal state management
 * 
 * This module implements centralized modal state management by:
 * 1. Creating simple ModalManager class to track active modals
 * 2. Implementing closeAllModals function to prevent modal conflicts
 * 3. Adding global event listener registry for proper cleanup
 * 4. Creating DOM state reset utility functions
 * 
 * Requirements: 1.3, 1.4, 5.1, 5.2
 */

/**
 * Event Listener Registry - Centralized management of event listeners
 */
class EventListenerRegistry {
    constructor() {
        this.listeners = new Map(); // modalId -> array of listener objects
        this.globalListeners = new Set(); // Set of global listener objects
    }

    /**
     * Register an event listener for a specific modal
     * @param {string} modalId - Unique identifier for the modal
     * @param {Element} element - DOM element to attach listener to
     * @param {string} event - Event type (e.g., 'click', 'keydown')
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     */
    register(modalId, element, event, handler, options = {}) {
        try {
            // Add the event listener
            element.addEventListener(event, handler, options);
            
            // Store listener info for cleanup
            if (!this.listeners.has(modalId)) {
                this.listeners.set(modalId, []);
            }
            
            const listenerInfo = {
                element,
                event,
                handler,
                options,
                timestamp: Date.now()
            };
            
            this.listeners.get(modalId).push(listenerInfo);
            
            console.warn(`📝 Registered ${event} listener for modal: ${modalId}`);
            
        } catch (error) {
            console.error(`Failed to register event listener for ${modalId}:`, error);
            // Continue execution - modal should still function with reduced functionality
        }
    }

    /**
     * Register a global event listener (not tied to specific modal)
     * @param {Element} element - DOM element to attach listener to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     */
    registerGlobal(element, event, handler, options = {}) {
        try {
            element.addEventListener(event, handler, options);
            
            const listenerInfo = {
                element,
                event,
                handler,
                options,
                timestamp: Date.now()
            };
            
            this.globalListeners.add(listenerInfo);
            
            console.warn(`📝 Registered global ${event} listener`);
            
        } catch (error) {
            console.error('Failed to register global event listener:', error);
        }
    }

    /**
     * Unregister all event listeners for a specific modal
     * @param {string} modalId - Modal identifier
     */
    unregister(modalId) {
        const listeners = this.listeners.get(modalId);
        if (!listeners) {
            console.warn(`No listeners found for modal: ${modalId}`);
            return;
        }

        let removedCount = 0;
        listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
                removedCount++;
            } catch (error) {
                console.error(`Failed to remove ${event} listener for ${modalId}:`, error);
                // Continue cleanup for other listeners
            }
        });

        this.listeners.delete(modalId);
        console.warn(`🧹 Removed ${removedCount} listeners for modal: ${modalId}`);
    }

    /**
     * Unregister all event listeners for all modals
     */
    unregisterAll() {
        let totalRemoved = 0;
        
        // Remove modal-specific listeners
        this.listeners.forEach((listeners, modalId) => {
            listeners.forEach(({ element, event, handler, options }) => {
                try {
                    element.removeEventListener(event, handler, options);
                    totalRemoved++;
                } catch (error) {
                    console.error(`Failed to remove ${event} listener for ${modalId}:`, error);
                }
            });
        });

        // Remove global listeners
        this.globalListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
                totalRemoved++;
            } catch (error) {
                console.error('Failed to remove global listener:', error);
            }
        });

        this.listeners.clear();
        this.globalListeners.clear();
        
        console.warn(`🧹 Removed ${totalRemoved} total event listeners`);
    }

    /**
     * Get listener count for debugging
     * @param {string} modalId - Optional modal ID to get specific count
     * @returns {number} Number of listeners
     */
    getListenerCount(modalId = null) {
        if (modalId) {
            return this.listeners.get(modalId)?.length || 0;
        }
        
        let total = this.globalListeners.size;
        this.listeners.forEach(listeners => {
            total += listeners.length;
        });
        
        return total;
    }
}

/**
 * DOM State Reset Utilities
 */
class DOMStateResetUtils {
    /**
     * Reset modal element to clean state
     * @param {Element} modalElement - Modal DOM element
     */
    static resetModalElement(modalElement) {
        if (!modalElement) return;

        console.warn('🔄 Resetting modal element state');

        // Reset CSS classes
        modalElement.classList.remove('show', 'hide', 'animating', 'modal-open');
        
        // Reset inline styles that might interfere
        modalElement.style.display = '';
        modalElement.style.transform = '';
        modalElement.style.transition = '';
        modalElement.style.animation = '';
        modalElement.style.opacity = '';
        modalElement.style.visibility = '';
        modalElement.style.willChange = 'auto';
        
        // Reset ARIA attributes
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
        
        // Force reflow to ensure changes take effect
        modalElement.offsetHeight;
    }

    /**
     * Reset document body state
     */
    static resetBodyState() {
        console.warn('🔄 Resetting document body state');

        // Reset body overflow
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Remove modal-related classes
        document.body.classList.remove('modal-open', 'modal-backdrop-active');
        
        // Remove any modal backdrops
        const backdrops = document.querySelectorAll('.modal-backdrop, .modal-overlay');
        backdrops.forEach(backdrop => {
            backdrop.remove();
        });
    }

    /**
     * Reset focus state
     * @param {Element} previousFocus - Element that had focus before modal opened
     */
    static resetFocusState(previousFocus = null) {
        console.warn('🔄 Resetting focus state');

        // Remove focus from modal elements
        const modalElements = document.querySelectorAll('[role="dialog"], .modal, .modal-content');
        modalElements.forEach(element => {
            if (element.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        });

        // Restore previous focus if available
        if (previousFocus && previousFocus.focus) {
            try {
                previousFocus.focus();
            } catch (error) {
                console.warn('Failed to restore focus:', error);
                // Fallback to body
                document.body.focus();
            }
        }
    }

    /**
     * Stop all media playback
     */
    static stopMediaPlayback() {
        console.warn('🔄 Stopping media playback');

        // Stop videos
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            try {
                video.pause();
                video.currentTime = 0;
            } catch (error) {
                console.warn('Failed to stop video:', error);
            }
        });

        // Stop audio
        const audios = document.querySelectorAll('audio');
        audios.forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                console.warn('Failed to stop audio:', error);
            }
        });
    }

    /**
     * Clean up temporary DOM elements
     */
    static cleanupTemporaryElements() {
        console.warn('🔄 Cleaning up temporary DOM elements');

        // Remove temporary modal elements
        const tempSelectors = [
            '.media-viewer-modal',
            '.temp-modal',
            '.modal-temp',
            '[data-temp-modal]'
        ];

        tempSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                try {
                    element.remove();
                } catch (error) {
                    console.warn(`Failed to remove element ${selector}:`, error);
                }
            });
        });
    }

    /**
     * Complete DOM state reset - combines all reset operations
     * @param {Object} options - Reset options
     */
    static completeReset(options = {}) {
        const {
            resetBody = true,
            resetFocus = true,
            stopMedia = true,
            cleanupTemp = true,
            previousFocus = null
        } = options;

        console.warn('🔄 Performing complete DOM state reset');

        if (resetBody) {
            this.resetBodyState();
        }

        if (resetFocus) {
            this.resetFocusState(previousFocus);
        }

        if (stopMedia) {
            this.stopMediaPlayback();
        }

        if (cleanupTemp) {
            this.cleanupTemporaryElements();
        }

        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
    }
}

/**
 * Simple Modal Manager - Centralized modal state tracking
 */
class ModalManager {
    constructor() {
        this.activeModals = new Map(); // modalId -> modal state object
        this.eventRegistry = new EventListenerRegistry();
        this.domUtils = DOMStateResetUtils;
        this.isInitialized = false;
        this.previousFocus = null;
    }

    /**
     * Initialize the modal manager
     */
    initialize() {
        if (this.isInitialized) {
            console.warn('ModalManager already initialized');
            return;
        }

        console.warn('🚀 Initializing ModalManager');

        // Register global emergency handlers
        this.registerGlobalHandlers();

        this.isInitialized = true;
        console.warn('✅ ModalManager initialized successfully');
    }

    /**
     * Register a modal with the manager
     * @param {string} modalId - Unique modal identifier
     * @param {Object} modalConfig - Modal configuration
     */
    registerModal(modalId, modalConfig = {}) {
        const modalState = {
            id: modalId,
            isVisible: false,
            isAnimating: false,
            element: modalConfig.element || null,
            data: null,
            openedAt: null,
            config: {
                closeOnEscape: modalConfig.closeOnEscape !== false,
                closeOnClickOutside: modalConfig.closeOnClickOutside !== false,
                focusManagement: modalConfig.focusManagement !== false,
                ...modalConfig
            }
        };

        this.activeModals.set(modalId, modalState);
        console.warn(`📝 Registered modal: ${modalId}`);

        return modalState;
    }

    /**
     * Open a modal
     * @param {string} modalId - Modal identifier
     * @param {Object} data - Data to pass to modal
     * @param {Object} options - Opening options
     */
    async openModal(modalId, data = null, options = {}) {
        console.warn(`🚪 Opening modal: ${modalId}`);

        try {
            // Close all existing modals first (requirement 1.4)
            await this.closeAllModals();

            // Get or create modal state
            let modalState = this.activeModals.get(modalId);
            if (!modalState) {
                modalState = this.registerModal(modalId, options);
            }

            // Store previous focus for restoration
            this.previousFocus = document.activeElement;

            // Update modal state
            modalState.isVisible = true;
            modalState.isAnimating = true;
            modalState.data = data;
            modalState.openedAt = Date.now();

            // Reset DOM state before opening
            if (modalState.element) {
                this.domUtils.resetModalElement(modalState.element);
            }

            console.warn(`✅ Modal ${modalId} opened successfully`);
            return modalState;

        } catch (error) {
            console.error(`Failed to open modal ${modalId}:`, error);
            throw error;
        }
    }

    /**
     * Close a specific modal
     * @param {string} modalId - Modal identifier
     */
    async closeModal(modalId) {
        console.warn(`🚪 Closing modal: ${modalId}`);

        const modalState = this.activeModals.get(modalId);
        if (!modalState) {
            console.warn(`Modal ${modalId} not found or already closed`);
            return;
        }

        try {
            // Update state
            modalState.isVisible = false;
            modalState.isAnimating = true;

            // Clean up event listeners for this modal
            this.eventRegistry.unregister(modalId);

            // Reset modal element
            if (modalState.element) {
                this.domUtils.resetModalElement(modalState.element);
            }

            // Remove from active modals
            this.activeModals.delete(modalId);

            // If this was the last modal, reset global state
            if (this.activeModals.size === 0) {
                this.domUtils.completeReset({
                    previousFocus: this.previousFocus
                });
                this.previousFocus = null;
            }

            console.warn(`✅ Modal ${modalId} closed successfully`);

        } catch (error) {
            console.error(`Failed to close modal ${modalId}:`, error);
            // Continue with cleanup even if there was an error
            this.activeModals.delete(modalId);
        }
    }

    /**
     * Close all active modals (requirement 1.3)
     */
    async closeAllModals() {
        if (this.activeModals.size === 0) {
            console.warn('No active modals to close');
            return;
        }

        console.warn(`🚪 Closing all ${this.activeModals.size} active modals`);

        const modalIds = Array.from(this.activeModals.keys());
        
        // Close modals in reverse order (last opened first)
        const sortedModals = modalIds.map(id => ({
            id,
            openedAt: this.activeModals.get(id).openedAt
        })).sort((a, b) => b.openedAt - a.openedAt);

        for (const { id } of sortedModals) {
            try {
                await this.closeModal(id);
            } catch (error) {
                console.error(`Failed to close modal ${id}:`, error);
                // Continue closing other modals
            }
        }

        // Emergency cleanup
        this.emergencyCleanup();

        console.warn('✅ All modals closed');
    }

    /**
     * Emergency cleanup for critical situations
     */
    emergencyCleanup() {
        console.warn('🚨 Performing emergency cleanup');

        try {
            // Clear all event listeners
            this.eventRegistry.unregisterAll();

            // Clear all modal states
            this.activeModals.clear();

            // Complete DOM reset
            this.domUtils.completeReset({
                previousFocus: this.previousFocus
            });

            this.previousFocus = null;

            console.warn('✅ Emergency cleanup completed');

        } catch (error) {
            console.error('Emergency cleanup failed:', error);
        }
    }

    /**
     * Register global event handlers
     */
    registerGlobalHandlers() {
        // Global escape key handler
        this.eventRegistry.registerGlobal(
            document,
            'keydown',
            (event) => {
                if (event.key === 'Escape' && this.activeModals.size > 0) {
                    console.warn('🚨 Global escape key pressed');
                    this.closeAllModals();
                }
            },
            { passive: false }
        );

        // Emergency cleanup on page unload
        this.eventRegistry.registerGlobal(
            window,
            'beforeunload',
            () => {
                this.emergencyCleanup();
            }
        );

        // Cleanup on visibility change (tab switch)
        this.eventRegistry.registerGlobal(
            document,
            'visibilitychange',
            () => {
                if (document.hidden && this.activeModals.size > 0) {
                    console.warn('🚨 Page hidden with active modals, performing cleanup');
                    this.emergencyCleanup();
                }
            }
        );

        console.warn('📝 Global event handlers registered');
    }

    /**
     * Get active modal information
     * @returns {Array} Array of active modal states
     */
    getActiveModals() {
        return Array.from(this.activeModals.values());
    }

    /**
     * Check if a specific modal is active
     * @param {string} modalId - Modal identifier
     * @returns {boolean} True if modal is active
     */
    isModalActive(modalId) {
        const modalState = this.activeModals.get(modalId);
        return modalState ? modalState.isVisible : false;
    }

    /**
     * Get modal state
     * @param {string} modalId - Modal identifier
     * @returns {Object|null} Modal state object or null
     */
    getModalState(modalId) {
        return this.activeModals.get(modalId) || null;
    }

    /**
     * Register event listener for a modal
     * @param {string} modalId - Modal identifier
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(modalId, element, event, handler, options = {}) {
        this.eventRegistry.register(modalId, element, event, handler, options);
    }

    /**
     * Get debug information
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            activeModals: this.activeModals.size,
            totalListeners: this.eventRegistry.getListenerCount(),
            isInitialized: this.isInitialized,
            modalStates: Array.from(this.activeModals.entries()).map(([id, state]) => ({
                id,
                isVisible: state.isVisible,
                isAnimating: state.isAnimating,
                openedAt: state.openedAt
            }))
        };
    }
}

// Create singleton instance
const modalManager = new ModalManager();

// Global functions for backward compatibility and easy access
window.closeAllModals = () => modalManager.closeAllModals();
window.getModalManager = () => modalManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => modalManager.initialize());
} else {
    modalManager.initialize();
}

// Export classes and instance
window.ModalManager = ModalManager;
window.EventListenerRegistry = EventListenerRegistry;
window.DOMStateResetUtils = DOMStateResetUtils;
window.modalManager = modalManager;

console.warn('📦 Modal State Manager module loaded');