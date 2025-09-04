# Modal Hover Stability Fix - Design Document

## Overview

Route details modal'ında yaşanan hover jitter sorunları, CSS transform efektlerinin layout'u etkilemesi, scrollbar davranışları ve Leaflet map'in boyut hesaplamalarındaki sorunlardan kaynaklanmaktadır. Bu tasarım, sorunları kök nedenlerinden çözerek stabil bir kullanıcı deneyimi sağlayacaktır.

## Root Cause Analysis

### 1. CSS Transform Scale Jitter
**Problem:** Hover efektlerinde `transform: scale()` kullanımı element boyutlarını değiştiriyor ve parent container'ların layout'unu bozuyor.

**Affected Elements:**
- `.route-details-modal-close:hover` - `transform: translateY(-50%) scale(1.1)`
- `.route-media-item:hover` - `transform: translateY(-6px) scale(1.02)`
- `.media-viewer-close:hover` - `transform: scale(1.1)`
- `.media-nav-btn:hover` - `transform: translateY(-50%) scale(1.1)`
- `.media-thumbnail:hover` - `transform: scale(1.05)`

### 2. Layout-Affecting Properties
**Problem:** Hover efektlerinde `translateY()` ve `scale()` kombinasyonu parent container'ların boyutlarını etkileyebiliyor.

### 3. Scrollbar Gutter Issues
**Problem:** `scrollbar-gutter: stable both-edges` kullanılmış ancak bazı durumlarda scrollbar'ın görünüp kaybolması content shift'e neden oluyor.

### 4. Leaflet Map Container Instability
**Problem:** Map container'ının boyutları hover sırasında değişebiliyor ve Leaflet'in internal sizing hesaplamalarını bozuyor.

## Architecture

### 1. CSS Containment Strategy
```css
/* Container isolation to prevent layout propagation */
.route-details-modal-content {
    contain: layout style paint;
    isolation: isolate;
}

.route-map-container {
    contain: size layout;
    isolation: isolate;
}
```

### 2. Hardware Acceleration Layer
```css
/* Force GPU acceleration for smooth animations */
.hover-optimized {
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    will-change: transform, opacity;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
}
```

### 3. Stable Transform Patterns
```css
/* Use only transform properties that don't affect layout */
.stable-hover {
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.stable-hover:hover {
    transform: translateZ(0) scale(1.05);
    /* Alternative: use box-shadow for elevation effect */
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
```

## Components and Interfaces

### 1. Hover Stability Manager
```javascript
class HoverStabilityManager {
    constructor() {
        this.activeHovers = new Set();
        this.stabilityObserver = null;
    }

    // Prevent multiple simultaneous hover effects
    registerHover(element, callback) {
        if (this.activeHovers.has(element)) return;
        this.activeHovers.add(element);
        callback();
    }

    unregisterHover(element) {
        this.activeHovers.delete(element);
    }

    // Monitor for layout shifts
    initStabilityObserver() {
        if ('ResizeObserver' in window) {
            this.stabilityObserver = new ResizeObserver(entries => {
                entries.forEach(entry => {
                    if (entry.contentBoxSize) {
                        this.handleUnexpectedResize(entry.target);
                    }
                });
            });
        }
    }
}
```

### 2. CSS Transform Optimizer
```css
/* Optimized hover patterns */
.modal-element-hover {
    position: relative;
    transform: translateZ(0);
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-element-hover:hover {
    /* Use 3D transforms to avoid layout recalculation */
    transform: translate3d(0, -2px, 0);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Disable problematic scale transforms */
.modal-element-hover:hover {
    /* Instead of scale, use box-shadow for visual emphasis */
    box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.2),
                0 4px 12px rgba(0, 0, 0, 0.15);
}
```

### 3. Leaflet Map Stabilizer
```javascript
class LeafletMapStabilizer {
    constructor(mapInstance) {
        this.mapInstance = mapInstance;
        this.containerObserver = null;
        this.lastKnownSize = null;
    }

    stabilizeContainer() {
        const container = this.mapInstance.getContainer();
        
        // Lock container dimensions during hover interactions
        const rect = container.getBoundingClientRect();
        this.lastKnownSize = {
            width: rect.width,
            height: rect.height
        };

        // Apply fixed dimensions
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
        container.style.minWidth = `${rect.width}px`;
        container.style.minHeight = `${rect.height}px`;
    }

    preventHoverResize() {
        const container = this.mapInstance.getContainer();
        
        // Add hover-stable class to prevent size changes
        container.classList.add('leaflet-hover-stable');
        
        // Monitor for unexpected size changes
        if ('ResizeObserver' in window) {
            this.containerObserver = new ResizeObserver(() => {
                // Restore stable size if changed unexpectedly
                if (this.lastKnownSize) {
                    this.stabilizeContainer();
                }
            });
            this.containerObserver.observe(container);
        }
    }
}
```

## Data Models

### 1. Hover State Model
```javascript
const HoverState = {
    element: HTMLElement,
    isActive: boolean,
    startTime: number,
    transform: {
        x: number,
        y: number,
        scale: number,
        rotation: number
    },
    containmentBox: DOMRect,
    preventPropagation: boolean
};
```

### 2. Stability Metrics
```javascript
const StabilityMetrics = {
    layoutShifts: number,
    transformDuration: number,
    frameDrops: number,
    containerResizes: number,
    scrollbarChanges: number
};
```

## Error Handling

### 1. Layout Shift Detection
```javascript
// Detect and prevent cumulative layout shifts
function detectLayoutShift() {
    if ('LayoutShift' in window) {
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.value > 0.1) { // Significant shift
                    console.warn('Layout shift detected:', entry.value);
                    // Apply emergency stabilization
                    applyEmergencyStabilization();
                }
            }
        }).observe({entryTypes: ['layout-shift']});
    }
}
```

### 2. Fallback Hover Patterns
```css
/* Fallback for browsers with poor transform support */
@supports not (transform: translate3d(0, 0, 0)) {
    .modal-element-hover:hover {
        /* Use opacity and box-shadow only */
        opacity: 0.9;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: none;
    }
}
```

### 3. Mobile Touch Optimization
```css
/* Disable hover effects on touch devices */
@media (hover: none) and (pointer: coarse) {
    .modal-element-hover:hover {
        transform: none;
        box-shadow: none;
    }
    
    /* Use :active for touch feedback instead */
    .modal-element-hover:active {
        transform: translate3d(0, 1px, 0);
        opacity: 0.9;
    }
}
```

## Testing Strategy

### 1. Visual Regression Tests
- Capture screenshots before/after hover interactions
- Measure container position stability
- Verify no unexpected element movements

### 2. Performance Tests
```javascript
// Measure hover performance
function measureHoverPerformance(element) {
    const startTime = performance.now();
    
    element.addEventListener('mouseenter', () => {
        requestAnimationFrame(() => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (duration > 16) { // More than one frame
                console.warn(`Slow hover effect: ${duration}ms`);
            }
        });
    });
}
```

### 3. Stability Tests
```javascript
// Test container stability during interactions
function testContainerStability() {
    const modal = document.querySelector('.route-details-modal');
    const initialRect = modal.getBoundingClientRect();
    
    // Simulate hover interactions
    const elements = modal.querySelectorAll('[class*="hover"]');
    elements.forEach(el => {
        el.dispatchEvent(new MouseEvent('mouseenter'));
        
        setTimeout(() => {
            const currentRect = modal.getBoundingClientRect();
            const shift = Math.abs(currentRect.left - initialRect.left) + 
                         Math.abs(currentRect.top - initialRect.top);
            
            if (shift > 1) { // More than 1px shift
                console.error(`Container shifted by ${shift}px`);
            }
            
            el.dispatchEvent(new MouseEvent('mouseleave'));
        }, 100);
    });
}
```

## Implementation Phases

### Phase 1: CSS Transform Optimization
1. Replace problematic scale transforms with box-shadow effects
2. Add CSS containment to critical containers
3. Implement hardware acceleration layers

### Phase 2: JavaScript Hover Management
1. Create HoverStabilityManager class
2. Add hover state tracking
3. Implement hover conflict resolution

### Phase 3: Leaflet Map Stabilization
1. Lock map container dimensions during interactions
2. Add resize observers for stability monitoring
3. Implement emergency stabilization fallbacks

### Phase 4: Mobile Touch Optimization
1. Disable hover effects on touch devices
2. Add touch-specific interaction patterns
3. Optimize for mobile viewport changes

### Phase 5: Performance Monitoring
1. Add layout shift detection
2. Implement performance metrics collection
3. Create automated stability tests

## Browser Compatibility

### Modern Browsers (Chrome 80+, Firefox 75+, Safari 13+)
- Full CSS containment support
- Hardware acceleration
- ResizeObserver API
- LayoutShift API

### Legacy Browsers
- Fallback to opacity/box-shadow effects
- Polyfills for ResizeObserver
- Manual stability monitoring

## Performance Considerations

### 1. GPU Acceleration
- Use `transform3d()` instead of `transform()`
- Apply `will-change` strategically
- Remove `will-change` after animations

### 2. Debouncing
```javascript
// Debounce hover effects to prevent rapid triggering
const debouncedHover = debounce((element, action) => {
    if (action === 'enter') {
        element.classList.add('hover-active');
    } else {
        element.classList.remove('hover-active');
    }
}, 16); // One frame delay
```

### 3. Memory Management
- Clean up event listeners on modal close
- Remove ResizeObserver instances
- Clear hover state tracking

This design addresses all identified hover stability issues while maintaining smooth user interactions and optimal performance across devices.