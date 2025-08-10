/**
 * Touch Optimizations for Mobile Devices
 * Enhances slider interactions and map controls for touch devices
 */

class TouchOptimizer {
    constructor() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isSmallScreen = window.innerWidth <= 768;
        this.init();
    }

    init() {
        if (this.isTouchDevice) {
            document.body.classList.add('touch-device');
            this.optimizeSliders();
            this.optimizeMapControls();
            this.addTouchFeedback();
            this.preventZoomOnDoubleTab();
        }

        if (this.isSmallScreen) {
            document.body.classList.add('small-screen');
        }

        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // Listen for resize events
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));
    }

    optimizeSliders() {
        const sliders = document.querySelectorAll('.slider');
        
        sliders.forEach(slider => {
            this.enhanceSliderTouch(slider);
        });
    }

    enhanceSliderTouch(slider) {
        let isDragging = false;
        let startX = 0;
        let startValue = 0;

        // Enhanced touch start
        slider.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startValue = parseInt(slider.value);
            
            // Add visual feedback
            slider.classList.add('slider--dragging');
            
            // Prevent scrolling while dragging
            e.preventDefault();
        }, { passive: false });

        // Enhanced touch move
        slider.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const currentX = e.touches[0].clientX;
            const deltaX = currentX - startX;
            const sliderRect = slider.getBoundingClientRect();
            const sliderWidth = sliderRect.width;
            
            // Calculate new value based on touch movement
            const range = slider.max - slider.min;
            const valueChange = (deltaX / sliderWidth) * range;
            let newValue = startValue + valueChange;
            
            // Clamp value to slider bounds
            newValue = Math.max(slider.min, Math.min(slider.max, newValue));
            
            // For discrete sliders, round to nearest step
            if (slider.classList.contains('discrete-slider')) {
                newValue = Math.round(newValue);
            }
            
            slider.value = newValue;
            
            // Trigger input event to update UI
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            
            e.preventDefault();
        }, { passive: false });

        // Enhanced touch end
        slider.addEventListener('touchend', (e) => {
            isDragging = false;
            slider.classList.remove('slider--dragging');
            
            // Add haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });

        // Add touch-specific styling
        slider.addEventListener('touchstart', () => {
            slider.style.transform = 'scale(1.02)';
        });

        slider.addEventListener('touchend', () => {
            slider.style.transform = '';
        });

        // Improve thumb visibility on touch
        const sliderItem = slider.closest('.slider-item');
        if (sliderItem) {
            slider.addEventListener('touchstart', () => {
                sliderItem.classList.add('slider-item--active');
            });

            slider.addEventListener('touchend', () => {
                setTimeout(() => {
                    sliderItem.classList.remove('slider-item--active');
                }, 200);
            });
        }
    }

    optimizeMapControls() {
        // Wait for map to be initialized
        const checkMap = () => {
            if (typeof map !== 'undefined' && map) {
                this.enhanceMapTouch();
            } else {
                setTimeout(checkMap, 100);
            }
        };
        checkMap();
    }

    enhanceMapTouch() {
        if (typeof L === 'undefined' || !map) return;

        // Add custom touch-friendly zoom controls
        this.addTouchZoomControls();
        
        // Enhance map gestures for mobile
        this.enhanceMapGestures();
        
        // Add touch-friendly legend toggle
        this.addTouchLegendToggle();
    }

    addTouchZoomControls() {
        // Remove default zoom control
        map.zoomControl.remove();

        // Create custom touch-friendly zoom controls
        const zoomControls = L.control({ position: 'topright' });
        
        zoomControls.onAdd = function(map) {
            const container = L.DomUtil.create('div', 'map-controls');
            
            // Zoom in button
            const zoomInBtn = L.DomUtil.create('button', 'map-control-btn', container);
            zoomInBtn.innerHTML = '<i class="fas fa-plus"></i>';
            zoomInBtn.setAttribute('aria-label', 'Yakınlaştır');
            zoomInBtn.type = 'button';
            
            // Zoom out button
            const zoomOutBtn = L.DomUtil.create('button', 'map-control-btn', container);
            zoomOutBtn.innerHTML = '<i class="fas fa-minus"></i>';
            zoomOutBtn.setAttribute('aria-label', 'Uzaklaştır');
            zoomOutBtn.type = 'button';

            // My location button
            const locationBtn = L.DomUtil.create('button', 'map-control-btn', container);
            locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
            locationBtn.setAttribute('aria-label', 'Konumuma git');
            locationBtn.type = 'button';

            // Event handlers
            L.DomEvent.on(zoomInBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                map.zoomIn();
                // Add haptic feedback
                if (navigator.vibrate) navigator.vibrate(10);
            });

            L.DomEvent.on(zoomOutBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                map.zoomOut();
                // Add haptic feedback
                if (navigator.vibrate) navigator.vibrate(10);
            });

            L.DomEvent.on(locationBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (navigator.geolocation) {
                    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            map.setView([lat, lng], 15);
                            locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
                            // Add haptic feedback
                            if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
                        },
                        (error) => {
                            console.error('Geolocation error:', error);
                            locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
                            // Show error feedback
                            if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
                        }
                    );
                }
            });

            // Prevent map events on control container
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            return container;
        };

        zoomControls.addTo(map);
    }

    enhanceMapGestures() {
        // Improve touch gestures for mobile
        if (this.isSmallScreen) {
            // Adjust map options for better mobile experience
            map.options.zoomSnap = 0.5;
            map.options.zoomDelta = 0.5;
            
            // Add momentum scrolling
            map.options.inertia = true;
            map.options.inertiaDeceleration = 2000;
            map.options.inertiaMaxSpeed = 1000;
        }

        // Add double-tap to zoom
        let lastTap = 0;
        map.on('click', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                // Double tap detected
                map.setZoomAround(e.latlng, map.getZoom() + 1);
                // Add haptic feedback
                if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
            }
            
            lastTap = currentTime;
        });

        // Improve pinch-to-zoom sensitivity
        if (map.touchZoom) {
            map.touchZoom.options.bounceAtZoomLimits = true;
        }
    }

    addTouchLegendToggle() {
        // Create touch-friendly legend toggle
        const legendToggle = L.control({ position: 'bottomleft' });
        
        legendToggle.onAdd = function(map) {
            const container = L.DomUtil.create('div', 'map-legend-toggle');
            container.innerHTML = '<i class="fas fa-list"></i><span>Lejant</span>';
            container.setAttribute('role', 'button');
            container.setAttribute('aria-label', 'Harita lejantını aç/kapat');
            container.setAttribute('tabindex', '0');

            L.DomEvent.on(container, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                // Toggle legend visibility (implement based on your legend system)
                const legend = document.querySelector('.map-legend');
                if (legend) {
                    legend.classList.toggle('show');
                }
                // Add haptic feedback
                if (navigator.vibrate) navigator.vibrate(10);
            });

            // Keyboard support
            L.DomEvent.on(container, 'keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    container.click();
                }
            });

            L.DomEvent.disableClickPropagation(container);
            return container;
        };

        legendToggle.addTo(map);
    }

    addTouchFeedback() {
        // Add visual feedback for touch interactions
        const style = document.createElement('style');
        style.textContent = `
            .touch-device .slider--dragging {
                filter: brightness(1.1);
                box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
            }
            
            .touch-device .slider-item--active {
                transform: scale(1.02);
                z-index: 10;
            }
            
            .touch-device .map-control-btn:active,
            .touch-device .map-legend-toggle:active {
                transform: scale(0.95);
                filter: brightness(0.9);
            }
            
            .touch-device .btn:active {
                transform: scale(0.98);
            }
            
            .touch-device .poi-card:active {
                transform: scale(0.98);
            }
        `;
        document.head.appendChild(style);
    }

    preventZoomOnDoubleTab() {
        // Prevent zoom on double-tap for better UX
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    handleOrientationChange() {
        // Recalculate layout after orientation change
        if (typeof map !== 'undefined' && map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }

        // Update screen size class
        this.isSmallScreen = window.innerWidth <= 768;
        if (this.isSmallScreen) {
            document.body.classList.add('small-screen');
        } else {
            document.body.classList.remove('small-screen');
        }
    }

    handleResize() {
        this.handleOrientationChange();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize touch optimizations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TouchOptimizer();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchOptimizer;
}