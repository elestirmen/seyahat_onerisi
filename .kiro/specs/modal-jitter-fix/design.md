# Modal Jitter Fix - Design Document

## Overview

Bu design dokümanı, POI recommendation system'deki modal açma/kapama işlemleri sırasında oluşan jitter sorununu çözmek için kapsamlı bir çözüm sunar. Sorunun kök nedenleri analiz edilmiş ve her bir nedene yönelik spesifik çözümler tasarlanmıştır.

## Root Cause Analysis

### 1. Event Listener Çakışması
**Problem:** Modal açılırken önceki modal'ın event listener'ları tam olarak temizlenmemiş olabilir.
- `showMediaModal` fonksiyonunda her çağrıda yeni event listener'lar ekleniyor
- `closeMediaModal` sadece `keydown` event'ini kaldırıyor, diğer event'ler kalıyor
- Multiple event listener'lar aynı event'e tepki veriyor

### 2. CSS Animation State Çakışması
**Problem:** CSS animasyonları önceki modal'dan kalan state ile çakışıyor.
- Modal `show` class'ı kaldırılıyor ama animation state reset edilmiyor
- Yeni modal açılırken önceki animation henüz tamamlanmamış olabilir
- CSS transition'lar birbirine karışıyor

### 3. DOM Element State Pollution
**Problem:** Modal DOM element'lerinin state'i düzgün temizlenmiyor.
- Modal content'i önceki modal'dan kalıyor
- Focus state ve accessibility attributes temizlenmiyor
- Body overflow style'ı çakışıyor

### 4. Global Variable State Çakışması
**Problem:** Global değişkenler modal geçişlerinde düzgün yönetilmiyor.
- `currentMediaItems`, `currentMediaIndex` değişkenleri
- `currentPOIId` ve cache state'leri
- Async işlemler tamamlanmadan yeni modal açılıyor

## Architecture

### 1. Modal State Manager
Tüm modal state'lerini merkezi olarak yöneten bir singleton class:

```javascript
class ModalStateManager {
    constructor() {
        this.activeModals = new Map();
        this.eventListeners = new Map();
        this.animationStates = new Map();
        this.cleanupTasks = new Map();
    }
    
    registerModal(modalId, config) { /* ... */ }
    openModal(modalId, data) { /* ... */ }
    closeModal(modalId) { /* ... */ }
    closeAllModals() { /* ... */ }
    cleanup() { /* ... */ }
}
```

### 2. Event Listener Registry
Event listener'ları merkezi olarak yöneten sistem:

```javascript
class EventListenerRegistry {
    constructor() {
        this.listeners = new Map();
    }
    
    register(modalId, element, event, handler, options) { /* ... */ }
    unregister(modalId) { /* ... */ }
    unregisterAll() { /* ... */ }
}
```

### 3. Animation Controller
CSS animasyonlarını yöneten controller:

```javascript
class AnimationController {
    constructor() {
        this.activeAnimations = new Map();
    }
    
    startAnimation(element, animationName, config) { /* ... */ }
    stopAnimation(element) { /* ... */ }
    waitForAnimation(element) { /* ... */ }
    resetAnimationState(element) { /* ... */ }
}
```

## Components and Interfaces

### 1. Enhanced Modal Base Class

```javascript
class EnhancedModal {
    constructor(modalId, config = {}) {
        this.modalId = modalId;
        this.config = config;
        this.isVisible = false;
        this.isAnimating = false;
        this.eventRegistry = new EventListenerRegistry();
        this.animationController = new AnimationController();
        this.cleanupTasks = [];
    }
    
    async show(data) {
        // Pre-show cleanup
        await this.preShowCleanup();
        
        // Show modal with proper state management
        await this.performShow(data);
        
        // Post-show setup
        await this.postShowSetup();
    }
    
    async hide() {
        // Pre-hide cleanup
        await this.preHideCleanup();
        
        // Hide modal with proper animation
        await this.performHide();
        
        // Post-hide cleanup
        await this.postHideCleanup();
    }
    
    async preShowCleanup() {
        // Close any existing modals
        await ModalStateManager.getInstance().closeAllModals();
        
        // Reset DOM state
        this.resetDOMState();
        
        // Clear any pending animations
        this.animationController.stopAnimation(this.element);
    }
    
    async performShow(data) {
        // Set modal data
        this.setModalData(data);
        
        // Setup DOM
        this.setupDOM();
        
        // Add CSS classes with animation
        await this.animationController.startAnimation(
            this.element, 
            'modalShow', 
            { duration: 300 }
        );
        
        // Update state
        this.isVisible = true;
        this.isAnimating = false;
    }
    
    async postShowSetup() {
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup accessibility
        this.setupAccessibility();
        
        // Register with state manager
        ModalStateManager.getInstance().registerModal(this.modalId, this);
    }
}
```

### 2. Media Modal Implementation

```javascript
class MediaModal extends EnhancedModal {
    constructor() {
        super('mediaModal', {
            closeOnEscape: true,
            closeOnClickOutside: true,
            focusManagement: true
        });
        
        this.currentMediaItems = [];
        this.currentMediaIndex = 0;
        this.currentPOIId = null;
    }
    
    async show(mediaItems, startIndex = 0, poiId = null) {
        // Validate input
        if (!mediaItems || mediaItems.length === 0) {
            throw new Error('No media items provided');
        }
        
        // Set media data
        this.currentMediaItems = mediaItems;
        this.currentMediaIndex = startIndex;
        this.currentPOIId = poiId;
        
        // Call parent show method
        await super.show({ mediaItems, startIndex, poiId });
        
        // Load current media
        await this.loadCurrentMedia();
    }
    
    async hide() {
        // Stop any media playback
        this.stopMediaPlayback();
        
        // Clear media data
        this.clearMediaData();
        
        // Call parent hide method
        await super.hide();
    }
    
    setupEventListeners() {
        const modalElement = this.getElement();
        
        // Register all event listeners with registry
        this.eventRegistry.register(
            this.modalId,
            document,
            'keydown',
            this.handleKeydown.bind(this),
            { passive: false }
        );
        
        this.eventRegistry.register(
            this.modalId,
            modalElement,
            'click',
            this.handleModalClick.bind(this),
            { passive: true }
        );
        
        // Navigation buttons
        const prevBtn = modalElement.querySelector('#mediaPrevBtn');
        const nextBtn = modalElement.querySelector('#mediaNextBtn');
        const closeBtn = modalElement.querySelector('#mediaModalClose');
        
        if (prevBtn) {
            this.eventRegistry.register(
                this.modalId,
                prevBtn,
                'click',
                this.showPreviousMedia.bind(this)
            );
        }
        
        if (nextBtn) {
            this.eventRegistry.register(
                this.modalId,
                nextBtn,
                'click',
                this.showNextMedia.bind(this)
            );
        }
        
        if (closeBtn) {
            this.eventRegistry.register(
                this.modalId,
                closeBtn,
                'click',
                this.hide.bind(this)
            );
        }
    }
    
    clearMediaData() {
        this.currentMediaItems = [];
        this.currentMediaIndex = 0;
        this.currentPOIId = null;
    }
    
    stopMediaPlayback() {
        const modalElement = this.getElement();
        
        // Stop videos
        const videos = modalElement.querySelectorAll('video');
        videos.forEach(video => {
            video.pause();
            video.currentTime = 0;
        });
        
        // Stop audio
        const audios = modalElement.querySelectorAll('audio');
        audios.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }
}
```

### 3. Route Details Panel Enhancement

```javascript
class EnhancedRouteDetailsPanel extends EnhancedModal {
    constructor() {
        super('routeDetailsPanel', {
            closeOnEscape: true,
            closeOnClickOutside: true,
            focusManagement: true
        });
        
        this.currentRoute = null;
        this.elevationChart = null;
    }
    
    async show(routeData) {
        // Set route data
        this.currentRoute = routeData;
        
        // Call parent show method
        await super.show(routeData);
        
        // Update panel content
        this.updateSummary(routeData);
        this.updateStopsList(routeData);
        this.updateSegmentsList(routeData);
        
        // Load elevation profile asynchronously
        this.loadElevationProfile(routeData);
    }
    
    async hide() {
        // Destroy chart
        if (this.elevationChart) {
            this.elevationChart.destroy();
            this.elevationChart = null;
        }
        
        // Clear route data
        this.currentRoute = null;
        
        // Call parent hide method
        await super.hide();
    }
}
```

## Data Models

### 1. Modal Configuration

```javascript
interface ModalConfig {
    closeOnEscape: boolean;
    closeOnClickOutside: boolean;
    focusManagement: boolean;
    animationDuration: number;
    zIndex: number;
    backdrop: boolean;
    keyboard: boolean;
}
```

### 2. Modal State

```javascript
interface ModalState {
    modalId: string;
    isVisible: boolean;
    isAnimating: boolean;
    data: any;
    element: HTMLElement;
    eventListeners: EventListener[];
    cleanupTasks: Function[];
}
```

### 3. Animation Config

```javascript
interface AnimationConfig {
    name: string;
    duration: number;
    easing: string;
    fillMode: string;
    direction: string;
}
```

## Error Handling

### 1. Modal Opening Errors

```javascript
class ModalOpenError extends Error {
    constructor(modalId, reason, originalError) {
        super(`Failed to open modal ${modalId}: ${reason}`);
        this.modalId = modalId;
        this.reason = reason;
        this.originalError = originalError;
    }
}
```

### 2. Graceful Degradation

```javascript
async function safeModalOperation(operation, fallback) {
    try {
        return await operation();
    } catch (error) {
        console.error('Modal operation failed:', error);
        
        // Attempt cleanup
        try {
            await ModalStateManager.getInstance().emergencyCleanup();
        } catch (cleanupError) {
            console.error('Emergency cleanup failed:', cleanupError);
        }
        
        // Execute fallback
        if (fallback) {
            return await fallback();
        }
        
        throw error;
    }
}
```

### 3. Event Listener Error Recovery

```javascript
class EventListenerRegistry {
    register(modalId, element, event, handler, options) {
        try {
            element.addEventListener(event, handler, options);
            
            // Store for cleanup
            if (!this.listeners.has(modalId)) {
                this.listeners.set(modalId, []);
            }
            
            this.listeners.get(modalId).push({
                element,
                event,
                handler,
                options
            });
            
        } catch (error) {
            console.error(`Failed to register event listener for ${modalId}:`, error);
            
            // Continue without this listener
            // Modal should still function with reduced functionality
        }
    }
    
    unregister(modalId) {
        const listeners = this.listeners.get(modalId);
        if (!listeners) return;
        
        listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.error('Failed to remove event listener:', error);
                // Continue cleanup for other listeners
            }
        });
        
        this.listeners.delete(modalId);
    }
}
```

## Testing Strategy

### 1. Unit Tests

```javascript
describe('ModalStateManager', () => {
    test('should close existing modal before opening new one', async () => {
        const manager = ModalStateManager.getInstance();
        
        // Open first modal
        await manager.openModal('modal1', {});
        expect(manager.getActiveModals()).toHaveLength(1);
        
        // Open second modal
        await manager.openModal('modal2', {});
        expect(manager.getActiveModals()).toHaveLength(1);
        expect(manager.getActiveModals()[0].modalId).toBe('modal2');
    });
    
    test('should clean up all event listeners on modal close', async () => {
        const modal = new MediaModal();
        const spy = jest.spyOn(modal.eventRegistry, 'unregister');
        
        await modal.show([{ type: 'image', path: 'test.jpg' }]);
        await modal.hide();
        
        expect(spy).toHaveBeenCalledWith('mediaModal');
    });
});
```

### 2. Integration Tests

```javascript
describe('Modal Jitter Prevention', () => {
    test('should not jitter when opening modal after closing another', async () => {
        // Open first modal
        const mediaModal = new MediaModal();
        await mediaModal.show([{ type: 'image', path: 'test1.jpg' }]);
        
        // Close first modal
        await mediaModal.hide();
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Open second modal
        const routeModal = new EnhancedRouteDetailsPanel();
        const startTime = performance.now();
        await routeModal.show({ route_name: 'Test Route' });
        const endTime = performance.now();
        
        // Should open smoothly within expected time
        expect(endTime - startTime).toBeLessThan(500);
        
        // Should not have multiple event listeners
        const keydownListeners = document.getEventListeners?.('keydown') || [];
        expect(keydownListeners.length).toBeLessThanOrEqual(1);
    });
});
```

### 3. Performance Tests

```javascript
describe('Modal Performance', () => {
    test('should complete modal operations within performance budget', async () => {
        const modal = new MediaModal();
        
        // Measure show performance
        const showStart = performance.now();
        await modal.show([{ type: 'image', path: 'test.jpg' }]);
        const showEnd = performance.now();
        
        expect(showEnd - showStart).toBeLessThan(300);
        
        // Measure hide performance
        const hideStart = performance.now();
        await modal.hide();
        const hideEnd = performance.now();
        
        expect(hideEnd - hideStart).toBeLessThan(300);
    });
});
```

## Implementation Notes

### 1. Backward Compatibility
- Mevcut modal fonksiyonları wrapper'lar ile korunacak
- Gradual migration stratejisi uygulanacak
- Legacy kod kademeli olarak yeni sisteme geçirilecek

### 2. Performance Considerations
- Event listener'lar passive olarak işaretlenecek
- DOM manipülasyonları batch'lenecek
- Animation'lar CSS transform kullanacak
- Memory leak'ler önlenecek

### 3. Accessibility
- Focus management otomatik olarak yapılacak
- Screen reader announcements eklenecek
- Keyboard navigation desteklenecek
- ARIA attributes düzgün yönetilecek

### 4. Mobile Optimization
- Touch gesture'lar desteklenecek
- Viewport meta tag kontrolleri eklenecek
- Mobile-specific animation optimizasyonları yapılacak
- Performance budget'ı mobile cihazlar için ayarlanacak