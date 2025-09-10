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
 * Initialize the modal jitter fix system (Enhanced)
 */
function initializeModalJitterFix() {
    if (window.modalJitterFix.isInitialized) {
        console.warn('Modal jitter fix already initialized');
        return;
    }

    console.warn('🔧 Initializing enhanced modal jitter fix system');

    // Wait for modal manager to be available
    if (window.modalManager) {
        window.modalJitterFix.modalManager = window.modalManager;
        console.warn('✅ Connected to centralized ModalManager');
    } else {
        console.warn('ModalManager not available, using fallback system');
    }

    // Enhanced initialization with performance optimizations
    setupPerformanceOptimizations();
    patchExistingModalFunctions();
    installAdvancedViewportHandlers();

    // Add global cleanup handlers (only if no modal manager)
    if (!window.modalJitterFix.modalManager) {
        addGlobalCleanupHandlers();
    }

    // Initialize hardware acceleration monitoring
    setupHardwareAccelerationMonitoring();

    window.modalJitterFix.isInitialized = true;
    console.warn('✅ Enhanced modal jitter fix system initialized');
}

/**
 * Setup performance optimizations for modal operations
 */
function setupPerformanceOptimizations() {
    console.warn('⚡ Setting up performance optimizations');

    // Pre-warm GPU layers for common modal elements
    const warmUpGPU = () => {
        const testElement = document.createElement('div');
        testElement.style.position = 'absolute';
        testElement.style.top = '-9999px';
        testElement.style.left = '-9999px';
        testElement.style.width = '100px';
        testElement.style.height = '100px';
        testElement.style.transform = 'translate3d(0, 0, 0)';
        testElement.style.willChange = 'transform';
        document.body.appendChild(testElement);

        // Force GPU layer creation
        void testElement.offsetHeight;

        setTimeout(() => {
            document.body.removeChild(testElement);
        }, 100);
    };

    // Warm up GPU on first user interaction
    const handleFirstInteraction = () => {
        warmUpGPU();
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
}

/**
 * Setup hardware acceleration monitoring
 */
function setupHardwareAccelerationMonitoring() {
    console.warn('👁️ Setting up hardware acceleration monitoring');

    // Monitor transform3d support and performance
    const testHardwareAcceleration = () => {
        const testElement = document.createElement('div');
        testElement.style.position = 'absolute';
        testElement.style.top = '-9999px';
        testElement.style.left = '-9999px';
        testElement.style.width = '100px';
        testElement.style.height = '100px';

        const startTime = performance.now();

        // Test transform3d performance
        testElement.style.transform = 'translate3d(10px, 10px, 0)';
        void testElement.offsetHeight; // Force reflow

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Store hardware acceleration capability
        window.modalJitterFix.hardwareAcceleration = {
            supported: duration < 5, // If it takes less than 5ms, hardware acceleration is likely working
            duration: duration,
            transform3d: CSS.supports('transform', 'translate3d(0, 0, 0)')
        };

        console.warn('🎮 Hardware acceleration test results:', window.modalJitterFix.hardwareAcceleration);
    };

    // Run test after DOM is ready
    if (document.readyState === 'complete') {
        testHardwareAcceleration();
    } else {
        window.addEventListener('load', testHardwareAcceleration);
    }
}

/**
 * Patch existing modal functions with enhanced jitter fixes
 */
function patchExistingModalFunctions() {
    console.warn('🔧 Patching existing modal functions with enhanced fixes');

    // Patch existing modal functions
    patchRouteDetailsPanel();
    patchRouteDetailsModal();
    patchMediaModalFunctions();

    // Add enhanced modal opening/closing with jitter prevention
    enhanceModalLifecycle();
}

/**
 * Install advanced viewport compensation handlers
 */
function installAdvancedViewportHandlers() {
    console.warn('📐 Installing advanced viewport compensation handlers');

    installViewportCompensationHandlers();

    // Add additional viewport change detection
    let viewportChangeTimeout;

    const handleViewportChange = () => {
        clearTimeout(viewportChangeTimeout);
        viewportChangeTimeout = setTimeout(() => {
            console.warn('📐 Viewport changed, applying compensation');

            // Close any open modals that might be affected
            if (window.modalJitterFix.activeModals.size > 0) {
                closeAllActiveModals();
            }

            // Reapply viewport compensation
            applyViewportCompensation();
        }, 100);
    };

    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    // Handle fullscreen changes
    document.addEventListener('fullscreenchange', handleViewportChange);
}

/**
 * Apply viewport compensation
 */
function applyViewportCompensation() {
    const anyModal = document.querySelector('#routeDetailsModal.show, .modal.show');
    if (!anyModal) return;

    // Apply compensation logic
    const compensationLogic = () => {
        const isRouteModal = anyModal.id === 'routeDetailsModal' || anyModal.classList.contains('route-details-modal');
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

        if (!isRouteModal) {
            safeRefreshModalLayout(anyModal);
        } else {
            safeRefreshModalLayout(anyModal, { willChange: 'opacity' });
        }

        try {
            const modalInstance = window.routeDetailsModalInstance || (window.RouteDetailsModal && window.RouteDetailsModal.getInstance && window.RouteDetailsModal.getInstance());
            if (modalInstance && modalInstance.isVisible) {
                if (modalInstance.mapInstance && typeof modalInstance.mapInstance.invalidateSize === 'function') {
                    modalInstance.mapInstance.invalidateSize();
                }
            }
        } catch (_) { /* noop */ }
    };

    requestAnimationFrame(() => requestAnimationFrame(compensationLogic));
}

/**
 * Enhance modal lifecycle with jitter prevention
 */
function enhanceModalLifecycle() {
    console.warn('🔄 Enhancing modal lifecycle with jitter prevention');

    // Override modal show/hide methods to include jitter fixes
    const originalShowModal = window.showModal || (() => {});
    const originalHideModal = window.hideModal || (() => {});

    window.showModal = function(modalElement, options = {}) {
        console.warn('🚪 Enhanced showModal called with jitter prevention');

        // Apply jitter prevention before showing
        if (modalElement) {
            modalElement.classList.add('modal-jitter-fix');
            resetModalAnimationState(modalElement);
        }

        // Call original function
        const result = originalShowModal.call(this, modalElement, options);

        // Remove jitter prevention after animation starts
        if (modalElement) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    modalElement.classList.remove('modal-jitter-fix');
                });
            });
        }

        return result;
    };

    window.hideModal = function(modalElement, options = {}) {
        console.warn('🚪 Enhanced hideModal called with jitter prevention');

        // Apply jitter prevention before hiding
        if (modalElement) {
            modalElement.classList.add('modal-jitter-fix');
        }

        // Call original function
        const result = originalHideModal.call(this, modalElement, options);

        // Clean up after hiding
        if (modalElement) {
            setTimeout(() => {
                resetModalAnimationState(modalElement);
                modalElement.classList.remove('modal-jitter-fix');
            }, 300); // Wait for animation to complete
        }

        return result;
    };
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
        console.warn('🔧 Enhanced RouteDetailsPanel.show called');
        
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
        console.warn('🔧 Enhanced RouteDetailsPanel.hide called');
        
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
        console.warn('🧹 Cleaning up RouteDetailsPanel event listeners');
        
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

    console.warn('✅ RouteDetailsPanel patched successfully');
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
        console.warn('🔧 Enhanced RouteDetailsModal.show called');
        
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
        console.warn('🔧 Enhanced RouteDetailsModal.hide called');
        
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
        console.warn('🧹 Cleaning up RouteDetailsModal event listeners');
        
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

    console.warn('✅ RouteDetailsModal patched successfully');
}

/**
 * Reset CSS animation state for a modal element
 */
function resetModalAnimationState(modalElement) {
    if (!modalElement) return;
    
    console.warn('🎭 Resetting animation state for modal');
    
    // Use centralized DOM utilities if available
    if (window.DOMStateResetUtils) {
        window.DOMStateResetUtils.resetModalElement(modalElement);
        return;
    }
    
    // Enhanced reset with jitter prevention
    const computedStyle = window.getComputedStyle(modalElement);

    // Force reflow to ensure any pending animations complete
    void modalElement.offsetHeight;

    // Remove animation classes with proper timing
    modalElement.classList.remove('show', 'hide', 'animating', 'modal-opening', 'modal-closing');

    // Add jitter prevention class temporarily
    modalElement.classList.add('modal-jitter-fix');

    // Reset transform and transition properties with stable values
    modalElement.style.transform = 'translate3d(0, 0, 0)';
    modalElement.style.transition = 'none';
    modalElement.style.animation = 'none';
    modalElement.style.opacity = '1';
    modalElement.style.visibility = 'visible';

    // Reset will-change property to prevent unnecessary GPU layers
    modalElement.style.willChange = 'transform, opacity';

    // Force another reflow to ensure changes take effect
    void modalElement.offsetHeight;

    // Remove jitter fix class after a brief moment
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.remove('modal-jitter-fix');
            modalElement.style.willChange = 'auto';
        });
    });

    // Store animation state
    window.modalJitterFix.animationStates.set(modalElement, {
        reset: true,
        timestamp: Date.now(),
        transform: modalElement.style.transform,
        opacity: modalElement.style.opacity
    });
}

/**
 * Close all active modals to prevent conflicts
 */
function closeAllActiveModals() {
    console.warn('🚪 Closing all active modals');
    
    // Use centralized modal manager if available
    if (window.modalJitterFix.modalManager) {
        return window.modalJitterFix.modalManager.closeAllModals();
    }
    
    // Fallback to legacy system
    console.warn('Using fallback modal closing system');
    
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
    console.warn('🧹 Cleaning up orphaned event listeners');
    
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
            console.warn('🚨 Emergency modal close via Escape key');
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
            console.warn('🔧 Enhanced showMediaModal called');
            
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
            console.warn('🔧 Enhanced closeMediaModal called');
            
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
    console.warn('🔄 Resetting global modal state');
    
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
    console.warn('🧹 Cleaning up media modal state');
    
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

console.warn('📦 Modal jitter fix module loaded');

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
