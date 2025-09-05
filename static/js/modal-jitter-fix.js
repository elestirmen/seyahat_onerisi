/**
 * Modal Jitter Fix - Task 1: Fix immediate jitter issues in existing modals
 * 
 * This module implements immediate fixes for modal jitter issues by:
 * 1. Adding proper event listener cleanup in modal functions
 * 2. Implementing modal state reset before opening new modals
 * 3. Fixing RouteDetailsPanel event listener duplication
 * 4. Adding CSS animation state reset for modal transitions
 * 
 * Requirements: 1.1, 1.2, 3.1, 3.2
 */

// Global modal state tracking - now using centralized ModalManager
window.modalJitterFix = {
    activeModals: new Set(), // Kept for backward compatibility
    eventListeners: new Map(), // Kept for backward compatibility
    animationStates: new Map(),
    isInitialized: false,
    // Reference to centralized modal manager
    modalManager: null
};

/**
 * Initialize the modal jitter fix system
 */
function initializeModalJitterFix() {
    if (window.modalJitterFix.isInitialized) {
        console.log('Modal jitter fix already initialized');
        return;
    }

    console.log('🔧 Initializing modal jitter fix system');
    
    // Wait for modal manager to be available
    if (window.modalManager) {
        window.modalJitterFix.modalManager = window.modalManager;
        console.log('✅ Connected to centralized ModalManager');
    } else {
        console.warn('ModalManager not available, using fallback system');
    }
    
    // Patch existing modal functions
    patchRouteDetailsPanel();
    patchRouteDetailsModal();
    installViewportCompensationHandlers();
    
    // Add global cleanup handlers (only if no modal manager)
    if (!window.modalJitterFix.modalManager) {
        addGlobalCleanupHandlers();
    }
    
    window.modalJitterFix.isInitialized = true;
    console.log('✅ Modal jitter fix system initialized');
}

/**
 * Patch RouteDetailsPanel to fix event listener duplication
 */
function patchRouteDetailsPanel() {
    if (!window.RouteDetailsPanel) {
        console.warn('RouteDetailsPanel not found, skipping patch');
        return;
    }

    const originalShow = window.RouteDetailsPanel.prototype.show;
    const originalHide = window.RouteDetailsPanel.prototype.hide;

    // Enhanced show method with proper cleanup
    window.RouteDetailsPanel.prototype.show = function(routeData) {
        console.log('🔧 Enhanced RouteDetailsPanel.show called');
        
        // Use centralized modal manager if available
        if (window.modalJitterFix.modalManager) {
            // Register with modal manager
            window.modalJitterFix.modalManager.registerModal('routeDetailsPanel', {
                element: this.panel,
                closeOnEscape: true,
                closeOnClickOutside: true
            });
            
            // Open modal through manager
            window.modalJitterFix.modalManager.openModal('routeDetailsPanel', routeData);
        }
        
        // Pre-show cleanup: remove any existing event listeners
        this.cleanupEventListeners();
        
        // Reset animation state
        resetModalAnimationState(this.panel);
        
        // Call original show method
        originalShow.call(this, routeData);
        
        // Track this modal as active (backward compatibility)
        window.modalJitterFix.activeModals.add('routeDetailsPanel');
        
        // Store event listeners for proper cleanup
        this.storeEventListeners();
    };

    // Enhanced hide method with thorough cleanup
    window.RouteDetailsPanel.prototype.hide = function() {
        console.log('🔧 Enhanced RouteDetailsPanel.hide called');
        
        // Use centralized modal manager if available
        if (window.modalJitterFix.modalManager) {
            window.modalJitterFix.modalManager.closeModal('routeDetailsPanel');
        }
        
        // Pre-hide cleanup
        this.cleanupEventListeners();
        
        // Call original hide method
        originalHide.call(this);
        
        // Remove from active modals (backward compatibility)
        window.modalJitterFix.activeModals.delete('routeDetailsPanel');
        
        // Reset animation state
        resetModalAnimationState(this.panel);
    };

    // Add cleanup methods to RouteDetailsPanel prototype
    window.RouteDetailsPanel.prototype.cleanupEventListeners = function() {
        console.log('🧹 Cleaning up RouteDetailsPanel event listeners');
        
        // Use centralized event registry if available
        if (window.modalJitterFix.modalManager) {
            window.modalJitterFix.modalManager.eventRegistry.unregister('routeDetailsPanel');
            return;
        }
        
        // Fallback to legacy cleanup
        // Remove existing event listeners if they exist
        if (this.boundKeydownHandler) {
            document.removeEventListener('keydown', this.boundKeydownHandler);
            this.boundKeydownHandler = null;
        }
        if (this.boundClickOutsideHandler) {
            document.removeEventListener('click', this.boundClickOutsideHandler);
            this.boundClickOutsideHandler = null;
        }
        
        // Clean up any stored event listeners
        const panelId = 'routeDetailsPanel';
        if (window.modalJitterFix.eventListeners.has(panelId)) {
            const listeners = window.modalJitterFix.eventListeners.get(panelId);
            listeners.forEach(({ element, event, handler, options }) => {
                try {
                    element.removeEventListener(event, handler, options);
                } catch (error) {
                    console.warn('Failed to remove event listener:', error);
                }
            });
            window.modalJitterFix.eventListeners.delete(panelId);
        }
    };

    // Add method to store event listeners for tracking
    window.RouteDetailsPanel.prototype.storeEventListeners = function() {
        const panelId = 'routeDetailsPanel';
        
        // Use centralized event registry if available
        if (window.modalJitterFix.modalManager) {
            if (this.boundKeydownHandler) {
                window.modalJitterFix.modalManager.addEventListener(
                    panelId, document, 'keydown', this.boundKeydownHandler
                );
            }
            if (this.boundClickOutsideHandler) {
                window.modalJitterFix.modalManager.addEventListener(
                    panelId, document, 'click', this.boundClickOutsideHandler
                );
            }
            return;
        }
        
        // Fallback to legacy system
        const listeners = [];
        
        if (this.boundKeydownHandler) {
            listeners.push({
                element: document,
                event: 'keydown',
                handler: this.boundKeydownHandler,
                options: undefined
            });
        }
        
        if (this.boundClickOutsideHandler) {
            listeners.push({
                element: document,
                event: 'click',
                handler: this.boundClickOutsideHandler,
                options: undefined
            });
        }
        
        window.modalJitterFix.eventListeners.set(panelId, listeners);
    };

    console.log('✅ RouteDetailsPanel patched successfully');
}

/**
 * Patch RouteDetailsModal to fix event listener issues
 */
function patchRouteDetailsModal() {
    if (!window.RouteDetailsModal) {
        console.warn('RouteDetailsModal not found, skipping patch');
        return;
    }

    const originalShow = window.RouteDetailsModal.prototype.show;
    const originalHide = window.RouteDetailsModal.prototype.hide;

    // Enhanced show method with proper cleanup
    window.RouteDetailsModal.prototype.show = function(routeData) {
        console.log('🔧 Enhanced RouteDetailsModal.show called');
        
        // Close any existing modals first
        closeAllActiveModals();
        
        // Use centralized modal manager if available
        if (window.modalJitterFix.modalManager) {
            // Register with modal manager
            window.modalJitterFix.modalManager.registerModal('routeDetailsModal', {
                element: this.modal,
                closeOnEscape: true,
                closeOnClickOutside: true
            });
            
            // Open modal through manager
            window.modalJitterFix.modalManager.openModal('routeDetailsModal', routeData);
        }
        
        // Pre-show cleanup
        this.cleanupEventListeners();
        
        // Reset animation state
        resetModalAnimationState(this.modal);
        
        // Call original show method
        return originalShow.call(this, routeData);
    };

    // Enhanced hide method with thorough cleanup
    window.RouteDetailsModal.prototype.hide = function() {
        console.log('🔧 Enhanced RouteDetailsModal.hide called');
        
        // Use centralized modal manager if available
        if (window.modalJitterFix.modalManager) {
            window.modalJitterFix.modalManager.closeModal('routeDetailsModal');
        }
        
        // Pre-hide cleanup
        this.cleanupEventListeners();
        
        // Call original hide method
        originalHide.call(this);
        
        // Remove from active modals (backward compatibility)
        window.modalJitterFix.activeModals.delete('routeDetailsModal');
        
        // Reset animation state
        resetModalAnimationState(this.modal);
    };

    // Add cleanup methods to RouteDetailsModal prototype
    window.RouteDetailsModal.prototype.cleanupEventListeners = function() {
        console.log('🧹 Cleaning up RouteDetailsModal event listeners');
        
        // Use centralized event registry if available
        if (window.modalJitterFix.modalManager) {
            window.modalJitterFix.modalManager.eventRegistry.unregister('routeDetailsModal');
        }
        
        // Legacy cleanup for backward compatibility
        // Clean up keyboard event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        
        // Clean up modal-specific event listeners
        if (this.modal) {
            this.modal.removeEventListener('click', this.handleBackdropClick);
        }
        
        // Clean up chart event listeners
        if (this.chartEventListeners) {
            const { canvas, handleMouseMove, handleMouseLeave, handleClick } = this.chartEventListeners;
            if (canvas) {
                canvas.removeEventListener('mousemove', handleMouseMove);
                canvas.removeEventListener('mouseleave', handleMouseLeave);
                canvas.removeEventListener('click', handleClick);
            }
            this.chartEventListeners = null;
        }
        
        // Clean up media viewer event listeners
        const mediaViewer = this.modal?.querySelector('.media-viewer-modal');
        if (mediaViewer) {
            mediaViewer.remove();
        }
        
        // Remove from active modals tracking (backward compatibility)
        window.modalJitterFix.activeModals.delete('routeDetailsModal');
    };

    console.log('✅ RouteDetailsModal patched successfully');
}

/**
 * Reset CSS animation state for a modal element
 */
function resetModalAnimationState(modalElement) {
    if (!modalElement) return;
    
    console.log('🎭 Resetting animation state for modal');
    
    // Use centralized DOM utilities if available
    if (window.DOMStateResetUtils) {
        window.DOMStateResetUtils.resetModalElement(modalElement);
        return;
    }
    
    // Fallback to legacy reset
    // Force reflow to ensure any pending animations complete
    modalElement.offsetHeight;
    
    // Remove animation classes
    modalElement.classList.remove('show', 'hide', 'animating');
    
    // Reset transform and transition properties
    modalElement.style.transform = '';
    modalElement.style.transition = '';
    modalElement.style.animation = '';
    
    // Reset will-change property to auto
    modalElement.style.willChange = 'auto';
    
    // Force another reflow
    modalElement.offsetHeight;
    
    // Store animation state
    window.modalJitterFix.animationStates.set(modalElement, {
        reset: true,
        timestamp: Date.now()
    });
}

/**
 * Close all active modals to prevent conflicts
 */
function closeAllActiveModals() {
    console.log('🚪 Closing all active modals');
    
    // Use centralized modal manager if available
    if (window.modalJitterFix.modalManager) {
        return window.modalJitterFix.modalManager.closeAllModals();
    }
    
    // Fallback to legacy system
    console.log('Using fallback modal closing system');
    
    // Close RouteDetailsPanel if active
    if (window.modalJitterFix.activeModals.has('routeDetailsPanel')) {
        const panelInstance = window.RouteDetailsPanel?.getInstance();
        if (panelInstance && panelInstance.isVisible) {
            panelInstance.hide();
        }
    }
    
    // Close RouteDetailsModal if active
    if (window.modalJitterFix.activeModals.has('routeDetailsModal')) {
        const modalInstance = window.RouteDetailsModal?.getInstance();
        if (modalInstance && modalInstance.isVisible) {
            modalInstance.hide();
        }
    }
    
    // Close any media viewers
    const mediaViewers = document.querySelectorAll('.media-viewer-modal');
    mediaViewers.forEach(viewer => viewer.remove());
    
    // Clear active modals set
    window.modalJitterFix.activeModals.clear();
    
    // Clean up any orphaned event listeners
    cleanupOrphanedEventListeners();
}

/**
 * Clean up orphaned event listeners
 */
function cleanupOrphanedEventListeners() {
    console.log('🧹 Cleaning up orphaned event listeners');
    
    // Clear all tracked event listeners
    window.modalJitterFix.eventListeners.forEach((listeners, modalId) => {
        listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn(`Failed to remove event listener for ${modalId}:`, error);
            }
        });
    });
    
    window.modalJitterFix.eventListeners.clear();
}

/**
 * Add global cleanup handlers for emergency situations
 */
function addGlobalCleanupHandlers() {
    // Emergency cleanup on page unload
    window.addEventListener('beforeunload', () => {
        closeAllActiveModals();
    });
    
    // Emergency cleanup on visibility change (tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Clean up when tab becomes hidden
            cleanupOrphanedEventListeners();
        }
    });
    
    // Global escape key handler as fallback
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && window.modalJitterFix.activeModals.size > 0) {
            console.log('🚨 Emergency modal close via Escape key');
            closeAllActiveModals();
        }
    }, { passive: false });
}

/**
 * Enhanced media modal functions (if they exist)
 */
function patchMediaModalFunctions() {
    // Check if showMediaModal exists and patch it
    if (typeof window.showMediaModal === 'function') {
        const originalShowMediaModal = window.showMediaModal;
        
        window.showMediaModal = function(...args) {
            console.log('🔧 Enhanced showMediaModal called');
            
            // Close existing modals first
            closeAllActiveModals();
            
            // Reset modal state
            resetGlobalModalState();
            
            // Call original function
            return originalShowMediaModal.apply(this, args);
        };
    }
    
    // Check if closeMediaModal exists and patch it
    if (typeof window.closeMediaModal === 'function') {
        const originalCloseMediaModal = window.closeMediaModal;
        
        window.closeMediaModal = function(...args) {
            console.log('🔧 Enhanced closeMediaModal called');
            
            // Enhanced cleanup
            cleanupMediaModalState();
            
            // Call original function
            const result = originalCloseMediaModal.apply(this, args);
            
            // Additional cleanup after original function
            resetGlobalModalState();
            
            return result;
        };
    }
}

/**
 * Reset global modal state
 */
function resetGlobalModalState() {
    console.log('🔄 Resetting global modal state');
    
    // Use centralized DOM utilities if available
    if (window.DOMStateResetUtils) {
        window.DOMStateResetUtils.completeReset();
    }
    
    // Legacy reset for backward compatibility
    // Clear active modals
    window.modalJitterFix.activeModals.clear();
    
    // Clear animation states
    window.modalJitterFix.animationStates.clear();
    
    // Reset body overflow
    document.body.style.overflow = '';
    
    // Remove modal backdrop classes
    document.body.classList.remove('modal-open');
    
    // Remove any modal backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
}

/**
 * Clean up media modal specific state
 */
function cleanupMediaModalState() {
    console.log('🧹 Cleaning up media modal state');
    
    // Stop any playing media
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
    
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    // Remove media viewer modals
    const mediaViewers = document.querySelectorAll('.media-viewer-modal');
    mediaViewers.forEach(viewer => viewer.remove());
    
    // Clean up media-related event listeners
    cleanupMediaEventListeners();
}

/**
 * Clean up media-specific event listeners
 */
function cleanupMediaEventListeners() {
    // Remove keyboard event listeners that might be attached to media modals
    const mediaKeydownHandlers = ['handleMediaKeydown', 'mediaKeydownHandler'];
    
    mediaKeydownHandlers.forEach(handlerName => {
        if (window[handlerName]) {
            document.removeEventListener('keydown', window[handlerName]);
        }
    });
    
    // Remove click event listeners from media elements
    const mediaElements = document.querySelectorAll('.media-item, .route-media-item');
    mediaElements.forEach(element => {
        // Clone and replace to remove all event listeners
        const newElement = element.cloneNode(true);
        element.parentNode?.replaceChild(newElement, element);
    });
}

/**
 * Initialize the modal jitter fix when DOM is ready
 */
function initializeWithModalManager() {
    // Wait for modal manager to be available
    if (window.modalManager && window.modalManager.isInitialized) {
        initializeModalJitterFix();
    } else {
        // Retry after a short delay
        setTimeout(initializeWithModalManager, 100);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithModalManager);
} else {
    initializeWithModalManager();
}

// Export for global access
window.initializeModalJitterFix = initializeModalJitterFix;
window.closeAllActiveModals = closeAllActiveModals;
window.resetModalAnimationState = resetModalAnimationState;

console.log('📦 Modal jitter fix module loaded');

/**
 * Viewport/Scrollbar compensation after visibility/resize
 * Prevents jitter when returning to tab or when viewport metrics change.
 */
function installViewportCompensationHandlers() {
    const applyCompensation = () => {
        try {
            // Detect if any modal is visible
            const anyModal = document.querySelector('#routeDetailsModal.show, .modal.show');
            if (!anyModal) return;

            const isRouteModal = anyModal.id === 'routeDetailsModal' || anyModal.classList.contains('route-details-modal');

            // If Bootstrap modal is open, apply body compensation; for route modal, do not toggle body overflow
            const isBootstrapModal = anyModal.classList.contains('modal') && !anyModal.id?.includes('routeDetailsModal');
            if (isBootstrapModal) {
                const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
                document.body.style.overflow = 'hidden';
                if (scrollbarWidth > 0) {
                    document.body.style.paddingRight = scrollbarWidth + 'px';
                } else {
                    document.body.style.paddingRight = '';
                }
            }

            // Safely refresh layout without toggling transform on route modal
            if (!isRouteModal) {
                safeRefreshModalLayout(anyModal);
            } else {
                // For route modal, avoid transient GPU promotions that can cause subpixel drift
                safeRefreshModalLayout(anyModal, { willChange: 'opacity' });
            }

            // If RouteDetailsModal is open, trigger a light layout refresh
            try {
                const modalInstance = window.routeDetailsModalInstance || (window.RouteDetailsModal && window.RouteDetailsModal.getInstance && window.RouteDetailsModal.getInstance());
                if (modalInstance && modalInstance.isVisible) {
                    // Invalidate map size if exists
                    if (modalInstance.mapInstance && typeof modalInstance.mapInstance.invalidateSize === 'function') {
                        modalInstance.mapInstance.invalidateSize();
                    }
                }
            } catch (_) { /* noop */ }
        } catch (_) { /* noop */ }
    };

    // On tab visibility return
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Wait for a couple of frames to ensure layout is stable after tab switch
            requestAnimationFrame(() => requestAnimationFrame(applyCompensation));
        }
    });

    // On resize (might switch overlay scrollbar behavior)
    window.addEventListener('resize', () => {
        applyCompensation();
    });

    // Remove pointer/focus compensation to avoid hover-induced reflows
}

/**
 * Safely refresh modal layout/composite state without removing 'show'.
 */
function safeRefreshModalLayout(modalEl, options = {}) {
    try {
        const content = modalEl.querySelector('.route-details-modal-content') || modalEl.querySelector('.modal-content') || modalEl;
        const prevWillChange = content.style.willChange;
        const wc = options.willChange || 'transform, opacity';
        content.style.willChange = wc;
        // Force reflow
        void content.offsetHeight;
        // DO NOT override transform; desktop centering uses CSS transform
        // Release will-change next frame
        requestAnimationFrame(() => {
            content.style.willChange = prevWillChange || 'auto';
        });
    } catch (_) { /* noop */ }
}
