/**
 * Mobile-Specific Enhancements for Route Details Modal
 * Revolutionary mobile map tab experience
 */

class MobileRouteDetailsEnhancer {
    constructor() {
        this.isInitialized = false;
        this.bottomPanel = null;
        this.mapHeader = null;
        this.elevationStats = {};
        
        this.init();
    }

    init() {
        if (window.innerWidth > 768) return;
        
        console.warn('📱 Initializing Mobile Route Details Enhancer');
        
        // Wait for route modal to be available
        this.waitForModal();
    }

    waitForModal() {
        const checkModal = () => {
            const modal = document.getElementById('routeDetailsModal');
            if (modal) {
                this.setupMobileEnhancements();
            } else {
                setTimeout(checkModal, 100);
            }
        };
        checkModal();
    }

    setupMobileEnhancements() {
        if (this.isInitialized) return;
        
        console.warn('🚀 Setting up mobile enhancements');
        
        // Override map tab behavior
        this.overrideMapTabBehavior();
        
        // Setup gesture controls
        this.setupGestureControls();
        
        // Setup performance optimizations
        this.setupPerformanceOptimizations();
        
        // If map tab is already active (e.g., last tab restored), apply mobile layout now
        const activeMapContent = document.querySelector('.route-details-tab-content[data-tab="map"].active');
        if (activeMapContent) {
            this.activateMobileMapTab();
        }

        this.isInitialized = true;
    }

    overrideMapTabBehavior() {
        const mapTabButton = document.querySelector('.route-details-tab[data-tab="map"]');
        if (!mapTabButton) return;

        // Remove existing listeners and add new mobile-optimized one
        const newMapTabButton = mapTabButton.cloneNode(true);
        mapTabButton.parentNode.replaceChild(newMapTabButton, mapTabButton);

        newMapTabButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.warn('📱 Mobile map tab clicked');
            
            // Switch to map tab with mobile enhancements
            this.activateMobileMapTab();
        });
    }

    activateMobileMapTab() {
        console.warn('📱 Activating mobile map tab');
        
        // Update tab states
        document.querySelectorAll('.route-details-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });

        document.querySelectorAll('.route-details-tab-content').forEach(content => {
            content.classList.remove('active');
            content.setAttribute('aria-hidden', 'true');
        });

        // Activate map tab
        const mapTab = document.querySelector('.route-details-tab[data-tab="map"]');
        const mapContent = document.querySelector('.route-details-tab-content[data-tab="map"]');
        const modalBody = document.querySelector('.route-details-modal-body');
        const modal = document.querySelector('.route-details-modal');

        if (mapTab && mapContent) {
            mapTab.classList.add('active');
            mapTab.setAttribute('aria-selected', 'true');
            
            mapContent.classList.add('active');
            mapContent.setAttribute('aria-hidden', 'false');

            // Add full screen class to modal for map tab
            if (modal) {
                modal.classList.add('map-tab-active');
            }

            // Ensure modal body allows scrolling
            if (modalBody) {
                modalBody.style.overflowY = 'auto';
                modalBody.style.webkitOverflowScrolling = 'touch';
                modalBody.style.scrollBehavior = 'smooth';
            }

            // Ensure map content is properly displayed and scrollable
            mapContent.style.display = 'block';
            mapContent.style.position = 'relative';
            mapContent.style.overflow = 'visible';
            mapContent.style.height = 'auto';
            mapContent.style.minHeight = 'auto';

            // Ensure elevation chart is scrollable
            this.ensureElevationScrollable();

            // Initialize map with delay
            setTimeout(() => {
                this.initializeMobileMap();
            }, 300);
        }
    }

    createMobileMapInterface(mapContent) {
        // Check if already created
        if (mapContent.querySelector('.mobile-map-header')) {
            console.warn('📱 Mobile interface already exists');
            return;
        }

        console.warn('🏗️ Creating mobile map interface');

        // Create mobile header
        this.mapHeader = document.createElement('div');
        this.mapHeader.className = 'mobile-map-header';
        this.mapHeader.innerHTML = `
            <button class="mobile-map-back" data-action="back">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h3 class="mobile-map-title">
                <i class="fas fa-map"></i>
                Harita & Yükseklik
            </h3>
            <button class="mobile-map-fullscreen" data-action="fullscreen">
                <i class="fas fa-expand"></i>
            </button>
        `;

        // Find existing map container
        const existingMapContainer = mapContent.querySelector('.route-map-container');
        
        // Create bottom panel (disabled by default when overlay mode is used)
        this.bottomPanel = document.createElement('div');
        this.bottomPanel.className = 'mobile-bottom-panel';
        this.bottomPanel.style.display = 'none';
        this.bottomPanel.innerHTML = `
            <div class="mobile-panel-handle"></div>
            <div class="mobile-panel-content">
                <div class="mobile-elevation-header">
                    <div class="mobile-elevation-title">
                        <div class="mobile-elevation-icon">
                            <i class="fas fa-mountain"></i>
                        </div>
                        Yükseklik Profili
                    </div>
                    <button class="mobile-elevation-toggle" data-action="toggle-elevation">
                        <i class="fas fa-expand-alt"></i>
                    </button>
                </div>
                <div id="mobileElevationContent"></div>
            </div>
        `;

        // Insert header at the beginning
        if (existingMapContainer) {
            mapContent.insertBefore(this.mapHeader, existingMapContainer);
        } else {
            mapContent.insertBefore(this.mapHeader, mapContent.firstChild);
        }
        
        // Append bottom panel at the end
        mapContent.appendChild(this.bottomPanel);

        console.warn('✅ Mobile interface elements created');

        // Setup event listeners
        this.setupMobileEventListeners();

        // Move elevation content (will no-op when overlay is active)
        this.moveElevationContent();
    }

    setupMobileEventListeners() {
        // Back button
        const backBtn = this.mapHeader.querySelector('[data-action="back"]');
        backBtn?.addEventListener('click', () => {
            this.goBackToOverview();
        });

        // Fullscreen button
        const fullscreenBtn = this.mapHeader.querySelector('[data-action="fullscreen"]');
        fullscreenBtn?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Elevation toggle
        const elevationToggle = this.bottomPanel.querySelector('[data-action="toggle-elevation"]');
        elevationToggle?.addEventListener('click', () => {
            this.toggleElevationView();
        });

        // Panel handle
        const panelHandle = this.bottomPanel.querySelector('.mobile-panel-handle');
        panelHandle?.addEventListener('click', () => {
            this.toggleBottomPanel();
        });

        // Touch gestures for panel
        this.setupPanelGestures();
    }

    setupPanelGestures() {
        let startY = 0;
        let isDragging = false;

        const panelHandle = this.bottomPanel.querySelector('.mobile-panel-handle');
        
        panelHandle?.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const currentY = e.touches[0].clientY;
            const diff = startY - currentY;

            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.bottomPanel.classList.add('expanded');
                } else {
                    this.bottomPanel.classList.remove('expanded');
                }
                isDragging = false;
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isDragging = false;
        }, { passive: true });
    }

    moveElevationContent() {
        const elevationContainer = document.getElementById('routeModalElevationContainer');
        const mobileContent = document.getElementById('mobileElevationContent');

        if (!elevationContainer || !mobileContent) return;

        // Check if elevation container is already overlayed inside the map container
        const isOverlay = !!elevationContainer.closest('.route-map-container');
        if (isOverlay) {
            // MOVE elevation container OUT of map container to make it scrollable
            const mapContent = document.querySelector('.route-details-tab-content[data-tab="map"]');
            if (mapContent && elevationContainer.parentElement !== mapContent) {
                // Remove from map container and append to map content
                elevationContainer.remove();
                mapContent.appendChild(elevationContainer);
                elevationContainer.classList.remove('mobile-overlay');
                
                console.warn('📱 Moved elevation container out of map for scrollability');
            }
            
            // Keep bottom panel hidden since we're using inline elevation
            if (this.bottomPanel) this.bottomPanel.style.display = 'none';
            
            // Style the elevation section for mobile scrollability
            const elevationSection = elevationContainer.querySelector('.elevation-chart-section');
            if (elevationSection) {
                elevationSection.style.background = '#f8fafc';
                elevationSection.style.borderRadius = '12px';
                elevationSection.style.padding = '16px';
                elevationSection.style.margin = '16px 12px 24px 12px';
                elevationSection.style.border = '1px solid #e2e8f0';
                elevationSection.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                elevationSection.style.position = 'relative';
                elevationSection.style.zIndex = '1';
                elevationSection.style.transform = 'none';
                elevationSection.style.willChange = 'auto';
            }
            
            // Ensure elevation container is scrollable
            elevationContainer.style.position = 'relative';
            elevationContainer.style.zIndex = '1';
            elevationContainer.style.transform = 'none';
            elevationContainer.style.willChange = 'auto';
            elevationContainer.style.overflow = 'visible';
            
            // Still refresh simple route info if needed
            this.updateRouteInfo();
            return;
        }

        // Otherwise, build the bottom-panel UI and move chart (desktop/tablet fallback)
        this.createMobileElevationStats(mobileContent);

        const elevationSection = elevationContainer.querySelector('.elevation-chart-section');
        const chartWrapper = mobileContent.querySelector('.elevation-chart-wrapper');
        if (elevationSection && chartWrapper) {
            const chartContainer = elevationSection.querySelector('.elevation-chart-container');
            if (chartContainer) {
                chartWrapper.appendChild(chartContainer);
                // Enhanced styling for mobile
                chartContainer.style.background = 'white';
                chartContainer.style.border = '1px solid #e5e7eb';
                chartContainer.style.borderRadius = '12px';
                chartContainer.style.boxShadow = 'none';
                chartContainer.style.padding = '8px';
                chartContainer.style.margin = '0';
            }
        }

        this.updateRouteInfo();
    }

    updateRouteInfo() {
        // Get current route data from the modal instance
        const routeInstance = window.routeDetailsModalInstance;
        if (!routeInstance || !routeInstance.currentRoute) return;

        const route = routeInstance.currentRoute;
        
        // Update distance
        const distanceEl = document.getElementById('mobileRouteDistance');
        if (distanceEl && route.total_distance) {
            distanceEl.textContent = `${(route.total_distance).toFixed(1)} km`;
        }

        // Update duration
        const durationEl = document.getElementById('mobileRouteDuration');
        if (durationEl && route.estimated_duration) {
            const hours = Math.floor(route.estimated_duration / 3600);
            const minutes = Math.floor((route.estimated_duration % 3600) / 60);
            durationEl.textContent = hours > 0 ? `${hours}s ${minutes}dk` : `${minutes} dk`;
        }

        // Update elevation gain
        const elevationEl = document.getElementById('mobileRouteElevation');
        if (elevationEl) {
            // Calculate elevation gain from elevation profile if available
            if (route.elevation_profile && route.elevation_profile.points) {
                const points = route.elevation_profile.points;
                let totalGain = 0;
                
                for (let i = 1; i < points.length; i++) {
                    const diff = points[i].elevation - points[i-1].elevation;
                    if (diff > 0) totalGain += diff;
                }
                
                elevationEl.textContent = `${Math.round(totalGain)} m`;
            } else {
                elevationEl.textContent = '-- m';
            }
        }

        // Store route data for map interactions
        this.routeData = route;
    }

    createMobileElevationStats(container) {
        // Create Google Maps style route info and elevation chart
        const googleMapsStyleHTML = `
            <!-- Route Summary Info -->
            <div class="mobile-route-info">
                <div class="route-info-item">
                    <div class="route-info-value" id="mobileRouteDistance">--</div>
                    <div class="route-info-label">Mesafe</div>
                </div>
                <div class="route-info-item">
                    <div class="route-info-value" id="mobileRouteDuration">--</div>
                    <div class="route-info-label">Süre</div>
                </div>
                <div class="route-info-item">
                    <div class="route-info-value" id="mobileRouteElevation">--m</div>
                    <div class="route-info-label">Yükseliş</div>
                </div>
            </div>

            <!-- Google Maps Style Elevation Chart -->
            <div class="google-maps-elevation-container">
                <div class="elevation-chart-header">
                    <div class="elevation-chart-title">
                        <i class="fas fa-chart-area"></i>
                        Yükseklik Profili
                    </div>
                    <div class="elevation-chart-controls">
                        <button class="elevation-control-btn active" data-mode="elevation">
                            <i class="fas fa-mountain"></i>
                        </button>
                        <button class="elevation-control-btn" data-mode="gradient">
                            <i class="fas fa-chart-line"></i>
                        </button>
                    </div>
                </div>
                <div class="elevation-chart-wrapper">
                    <div class="elevation-position-indicator" id="elevationPositionIndicator"></div>
                    <!-- Chart will be moved here -->
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', googleMapsStyleHTML);

        // Setup elevation chart interactions
        this.setupElevationChartInteractions();
    }

    setupElevationChartInteractions() {
        // Setup chart hover interactions for map synchronization
        document.addEventListener('mousemove', (e) => {
            this.handleElevationChartHover(e);
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.elevation-control-btn')) {
                this.handleElevationModeChange(e.target.closest('.elevation-control-btn'));
            }
        });

        // Setup chart touch interactions for mobile
        document.addEventListener('touchmove', (e) => {
            this.handleElevationChartTouch(e);
        }, { passive: true });
    }

    handleElevationChartHover(e) {
        const chart = document.getElementById('modalElevationChart');
        const indicator = document.getElementById('elevationPositionIndicator');
        
        if (!chart || !indicator) return;
        
        const chartRect = chart.getBoundingClientRect();
        const isOverChart = e.clientX >= chartRect.left && 
                           e.clientX <= chartRect.right && 
                           e.clientY >= chartRect.top && 
                           e.clientY <= chartRect.bottom;

        if (isOverChart) {
            const relativeX = e.clientX - chartRect.left;
            const percentage = relativeX / chartRect.width;
            
            // Show position indicator
            indicator.style.left = `${relativeX}px`;
            indicator.classList.add('active');
            
            // Update map marker position if route data is available
            this.updateMapElevationMarker(percentage);
        } else {
            indicator.classList.remove('active');
            this.hideMapElevationMarker();
        }
    }

    handleElevationChartTouch(e) {
        if (e.touches.length !== 1) return;
        
        const chart = document.getElementById('modalElevationChart');
        const indicator = document.getElementById('elevationPositionIndicator');
        
        if (!chart || !indicator) return;
        
        const touch = e.touches[0];
        const chartRect = chart.getBoundingClientRect();
        const isOverChart = touch.clientX >= chartRect.left && 
                           touch.clientX <= chartRect.right && 
                           touch.clientY >= chartRect.top && 
                           touch.clientY <= chartRect.bottom;

        if (isOverChart) {
            const relativeX = touch.clientX - chartRect.left;
            const percentage = relativeX / chartRect.width;
            
            // Show position indicator
            indicator.style.left = `${relativeX}px`;
            indicator.classList.add('active');
            
            // Update map marker position
            this.updateMapElevationMarker(percentage);
            
            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(5);
            }
        }
    }

    handleElevationModeChange(button) {
        // Remove active class from all buttons
        document.querySelectorAll('.elevation-control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        const mode = button.dataset.mode;
        
        // Update chart display mode
        if (mode === 'elevation') {
            this.showElevationMode();
        } else if (mode === 'gradient') {
            this.showGradientMode();
        }
        
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
    }

    updateMapElevationMarker(percentage) {
        // This will be implemented to show position on map
        // For now, just store the position
        this.currentElevationPosition = percentage;
        
        // If we have route data and map instance, show marker
        if (window.routeModalMap && this.routeData) {
            this.showElevationPositionOnMap(percentage);
        }
    }

    showElevationPositionOnMap(percentage) {
        // Remove existing elevation marker
        if (this.elevationMarker) {
            window.routeModalMap.removeLayer(this.elevationMarker);
        }
        
        // Calculate position along route
        if (this.routeData && this.routeData.geometry) {
            const coordinates = this.routeData.geometry.coordinates;
            const index = Math.floor(percentage * (coordinates.length - 1));
            const coord = coordinates[index];
            
            if (coord && coord.length >= 2) {
                // Create elevation position marker
                this.elevationMarker = L.marker([coord[1], coord[0]], {
                    icon: L.divIcon({
                        className: 'map-elevation-marker',
                        html: '',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(window.routeModalMap);
            }
        }
    }

    hideMapElevationMarker() {
        if (this.elevationMarker && window.routeModalMap) {
            window.routeModalMap.removeLayer(this.elevationMarker);
            this.elevationMarker = null;
        }
    }

    showElevationMode() {
        // Show elevation profile
        const chart = document.getElementById('modalElevationChart');
        if (chart) {
            chart.style.background = '#fafbfc';
            // Update chart to show elevation data
        }
    }

    showGradientMode() {
        // Show gradient/slope profile
        const chart = document.getElementById('modalElevationChart');
        if (chart) {
            chart.style.background = '#fff5f5';
            // Update chart to show gradient data
        }
    }

    animateStatCard(statElement) {
        statElement.style.transform = 'scale(0.95)';
        setTimeout(() => {
            statElement.style.transform = '';
        }, 150);

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
    }

    initializeMobileMap() {
        console.warn('🗺️ Initializing mobile map');

        // Ensure map container is properly sized
        const mapContainer = document.getElementById('routeModalMap');
        if (mapContainer) {
            mapContainer.style.width = '100%';
            mapContainer.style.height = '100%';
        }

        // Invalidate map size multiple times for mobile
        if (window.routeModalMap && typeof window.routeModalMap.invalidateSize === 'function') {
            setTimeout(() => window.routeModalMap.invalidateSize(), 100);
            setTimeout(() => window.routeModalMap.invalidateSize(), 300);
            setTimeout(() => window.routeModalMap.invalidateSize(), 600);
        }

        // Enable two-finger scroll mode on map to allow page scrolling
        this.setupTwoFingerScroll(mapContainer);
        
        // Optimize elevation chart for mobile after map initialization
        setTimeout(() => {
            this.optimizeElevationChartForMobile();
        }, 800);
    }

    optimizeElevationChartForMobile() {
        const elevationChart = document.getElementById('modalElevationChart');
        const chartContainer = document.querySelector('.elevation-chart-container');
        
        if (!elevationChart) return;

        // Get proper container width
        const containerWidth = chartContainer ? chartContainer.offsetWidth - 16 : 350;

        // Ensure proper canvas sizing for mobile
        elevationChart.style.cssText = `
            width: 100% !important;
            height: 120px !important;
            min-height: 120px !important;
            display: block !important;
            border-radius: 6px !important;
            max-width: 100% !important;
            touch-action: pan-y !important;
        `;

        // Set canvas dimensions for Chart.js
        elevationChart.width = containerWidth;
        elevationChart.height = 120;

        // Hide POI and media markers on mobile for cleaner view
        this.hidePOIAndMediaMarkersOnMobile();

        // Force chart redraw if chart instance exists
        if (window.routeDetailsModalInstance?.elevationChartInstance) {
            try {
                window.routeDetailsModalInstance.elevationChartInstance.resize();
                window.routeDetailsModalInstance.elevationChartInstance.update();
                console.warn('📱 Chart resized for mobile:', {
                    canvasWidth: elevationChart.width,
                    canvasHeight: elevationChart.height,
                    containerWidth: containerWidth
                });
            } catch (e) {
                console.warn('Chart resize failed:', e);
            }
        }

        // Add touch-friendly interactions
        this.addMobileTouchInteractions(elevationChart);
    }

    hidePOIAndMediaMarkersOnMobile() {
        // Hide POI and media markers on elevation chart for cleaner mobile view
        const poiIcons = document.querySelectorAll('.elevation-poi-icon');
        const mediaIcons = document.querySelectorAll('.elevation-media-icon');
        
        poiIcons.forEach(icon => {
            icon.style.display = 'none';
        });
        
        mediaIcons.forEach(icon => {
            icon.style.display = 'none';
        });
    }

    ensureElevationScrollable() {
        // Ensure the elevation section is properly scrollable on mobile
        const elevationContainer = document.getElementById('routeModalElevationContainer');
        const mapContent = document.querySelector('.route-details-tab-content[data-tab="map"]');
        const modalBody = document.querySelector('.route-details-modal-body');
        
        if (!elevationContainer || !mapContent) return;

        // Ensure elevation container is in the correct position (not inside map container)
        const mapContainer = document.querySelector('.route-map-container');
        if (mapContainer && mapContainer.contains(elevationContainer)) {
            // Move elevation container out of map container
            mapContainer.parentNode.appendChild(elevationContainer);
            console.warn('📱 Moved elevation container out of map container');
        }

        // Make sure elevation container is positioned for scrolling
        elevationContainer.style.position = 'relative';
        elevationContainer.style.zIndex = '1';
        elevationContainer.style.width = '100%';
        elevationContainer.style.overflow = 'visible';
        elevationContainer.style.display = 'block';
        
        // Ensure map content allows scrolling
        mapContent.style.overflow = 'visible';
        mapContent.style.height = 'auto';
        mapContent.style.minHeight = 'auto';
        mapContent.style.position = 'relative';
        
        // Ensure modal body allows proper scrolling
        if (modalBody) {
            modalBody.style.overflowY = 'auto';
            modalBody.style.webkitOverflowScrolling = 'touch';
            modalBody.style.scrollBehavior = 'smooth';
        }
        
        // Style elevation section for mobile
        const elevationSection = elevationContainer.querySelector('.elevation-chart-section');
        if (elevationSection) {
            elevationSection.style.position = 'relative';
            elevationSection.style.zIndex = '1';
            elevationSection.style.display = 'block';
            elevationSection.style.margin = '20px 12px';
            elevationSection.style.padding = '16px';
            elevationSection.style.background = '#f8fafc';
            elevationSection.style.borderRadius = '12px';
            elevationSection.style.border = '1px solid #e2e8f0';
            elevationSection.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
        }
        
        const elevationChart = document.getElementById('modalElevationChart');
        if (elevationChart) {
            elevationChart.style.position = 'relative';
            elevationChart.style.zIndex = '1';
            elevationChart.style.touchAction = 'pan-y';
            elevationChart.style.display = 'block';
            elevationChart.style.width = '100%';
            elevationChart.style.height = '120px';
        }
        
        console.warn('📱 Elevation chart made scrollable on mobile');
    }

    addMobileTouchInteractions(chartElement) {
        if (!chartElement) return;

        // Add touch feedback
        chartElement.addEventListener('touchstart', (e) => {
            chartElement.style.opacity = '0.9';
            if ('vibrate' in navigator) {
                navigator.vibrate(5);
            }
        }, { passive: true });

        chartElement.addEventListener('touchend', () => {
            chartElement.style.opacity = '1';
        }, { passive: true });

        // Improve touch responsiveness - allow vertical scrolling
        chartElement.style.touchAction = 'pan-y pinch-zoom';
        
        // Prevent chart from blocking scroll
        chartElement.addEventListener('touchmove', (e) => {
            // Only prevent default if it's a horizontal gesture
            const touch = e.touches[0];
            if (touch && this.lastTouchY !== undefined) {
                const deltaY = Math.abs(touch.clientY - this.lastTouchY);
                const deltaX = Math.abs(touch.clientX - this.lastTouchX);
                
                // If it's more vertical than horizontal, allow scrolling
                if (deltaY > deltaX) {
                    return; // Allow default scroll behavior
                }
            }
            
            this.lastTouchY = touch?.clientY;
            this.lastTouchX = touch?.clientX;
        }, { passive: true });
        
        chartElement.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.lastTouchY = touch?.clientY;
            this.lastTouchX = touch?.clientX;
        }, { passive: true });
    }

    setupTwoFingerScroll(mapContainer) {
        if (!mapContainer) return;
        const map = window.routeModalMap;
        let twoFingerMode = false;
        let leafletContainer = mapContainer.querySelector('.leaflet-container') || mapContainer;

        const enable = () => {
            twoFingerMode = true;
            leafletContainer.classList.add('two-finger-scroll');
            mapContainer.classList.add('two-finger-scroll');
            try { map?.dragging?.disable(); } catch (_) {}
            try { map?.touchZoom?.disable(); } catch (_) {}
        };
        const disable = () => {
            twoFingerMode = false;
            leafletContainer.classList.remove('two-finger-scroll');
            mapContainer.classList.remove('two-finger-scroll');
            try { map?.dragging?.enable(); } catch (_) {}
            try { map?.touchZoom?.enable(); } catch (_) {}
        };

        // Touch handlers (passive to allow native scroll)
        const onStart = (e) => {
            if (e.touches && e.touches.length >= 2) enable();
        };
        const onEnd = (e) => {
            if (!e.touches || e.touches.length < 2) {
                // Small delay to avoid flicker when fingers leave staggered
                setTimeout(disable, 120);
            }
        };
        const onCancel = () => setTimeout(disable, 0);

        mapContainer.addEventListener('touchstart', onStart, { passive: true });
        mapContainer.addEventListener('touchend', onEnd, { passive: true });
        mapContainer.addEventListener('touchcancel', onCancel, { passive: true });
        mapContainer.addEventListener('touchmove', () => { /* allow native vertical scroll */ }, { passive: true });
    }

    setupGestureControls() {
        // Swipe right to go back
        let startX = 0;
        let startY = 0;

        document.addEventListener('touchstart', (e) => {
            const mapTab = e.target.closest('.route-details-tab-content[data-tab="map"]');
            if (!mapTab?.classList.contains('active')) return;

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const mapTab = e.target.closest('.route-details-tab-content[data-tab="map"]');
            if (!mapTab?.classList.contains('active')) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = Math.abs(endY - startY);

            // Swipe right to go back
            if (diffX > 100 && diffY < 50) {
                this.goBackToOverview();
            }
        }, { passive: true });
    }

    setupPerformanceOptimizations() {
        // Optimize scroll performance
        // Keep default scrolling behavior for better UX

        // Optimize touch interactions
        document.addEventListener('touchstart', () => {}, { passive: true });
        document.addEventListener('touchmove', () => {}, { passive: true });
    }

    // Action methods
    goBackToOverview() {
        const overviewTab = document.querySelector('.route-details-tab[data-tab="overview"]');
        const modalBody = document.querySelector('.route-details-modal-body');
        
        if (overviewTab) {
            // Restore modal body styles
            if (modalBody) {
                modalBody.style.padding = '';
                modalBody.style.overflow = '';
            }
            
            // Add exit animation
            const mapContent = document.querySelector('.route-details-tab-content[data-tab="map"]');
            if (mapContent) {
                mapContent.style.transform = 'translateY(20px)';
                mapContent.style.opacity = '0';
                setTimeout(() => {
                    overviewTab.click();
                    mapContent.style.transform = '';
                    mapContent.style.opacity = '';
                }, 200);
            } else {
                overviewTab.click();
            }
        }
    }

    toggleFullscreen() {
        const modal = document.getElementById('routeDetailsModal');
        if (!modal) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            modal.requestFullscreen().catch(err => {
                console.warn('Fullscreen not supported:', err);
            });
        }
    }

    toggleBottomPanel() {
        if (this.bottomPanel) {
            this.bottomPanel.classList.toggle('expanded');
            
            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(15);
            }
        }
    }

    toggleElevationView() {
        const toggle = this.bottomPanel?.querySelector('[data-action="toggle-elevation"]');
        const container = document.querySelector('.elevation-chart-container');
        
        if (!toggle || !container) return;

        toggle.classList.toggle('active');
        
        if (toggle.classList.contains('active')) {
            container.style.height = '300px';
            toggle.innerHTML = '<i class="fas fa-compress-alt"></i>';
        } else {
            container.style.height = '200px';
            toggle.innerHTML = '<i class="fas fa-expand-alt"></i>';
        }

        // Refresh chart
        setTimeout(() => {
            if (window.routeDetailsModalInstance?.elevationChartInstance) {
                window.routeDetailsModalInstance.elevationChartInstance.resize();
            }
        }, 300);
    }

    updateElevationStats(stats) {
        this.elevationStats = stats;
        
        const statsElements = {
            max: document.querySelector('[data-stat="max"] .mobile-elevation-stat-value'),
            min: document.querySelector('[data-stat="min"] .mobile-elevation-stat-value'),
            ascent: document.querySelector('[data-stat="ascent"] .mobile-elevation-stat-value'),
            descent: document.querySelector('[data-stat="descent"] .mobile-elevation-stat-value')
        };

        if (statsElements.max) statsElements.max.textContent = `${stats.max || '--'}m`;
        if (statsElements.min) statsElements.min.textContent = `${stats.min || '--'}m`;
        if (statsElements.ascent) statsElements.ascent.textContent = `${stats.ascent || '--'}m`;
        if (statsElements.descent) statsElements.descent.textContent = `${stats.descent || '--'}m`;
    }

    ensureElevationScrollable() {
        // Ensure the modal body and map content allow scrolling to elevation chart
        const modalBody = document.querySelector('.route-details-modal-body');
        const mapContent = document.querySelector('.route-details-tab-content[data-tab="map"]');
        
        if (modalBody) {
            modalBody.style.overflowY = 'auto';
            modalBody.style.webkitOverflowScrolling = 'touch';
            modalBody.style.height = 'auto';
            modalBody.style.maxHeight = 'calc(95vh - 160px)';
        }
        
        if (mapContent) {
            mapContent.style.height = 'auto';
            mapContent.style.minHeight = 'calc(100vh - 200px)';
            mapContent.style.overflowY = 'visible';
            mapContent.style.paddingBottom = '40px';
        }
        
        // Ensure elevation container is positioned correctly and visible
        setTimeout(() => {
            const elevationContainer = document.getElementById('routeModalElevationContainer');
            if (elevationContainer) {
                // Remove any overlay classes
                elevationContainer.classList.remove('mobile-overlay');
                
                // Ensure it's in the correct parent (map content, not map container)
                const mapContainer = document.querySelector('.route-map-container');
                if (elevationContainer.parentElement === mapContainer) {
                    mapContent.appendChild(elevationContainer);
                    console.warn('📱 Moved elevation container to map content for scrollability');
                }
                
                // Apply mobile-friendly styling
                elevationContainer.style.cssText = `
                    position: relative !important;
                    z-index: 1 !important;
                    margin: 16px 12px 24px 12px !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                `;
                
                // Style the elevation section
                const elevationSection = elevationContainer.querySelector('.elevation-chart-section');
                if (elevationSection) {
                    elevationSection.style.cssText = `
                        background: #f8fafc !important;
                        border: 1px solid #e2e8f0 !important;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
                        border-radius: 12px !important;
                        padding: 16px !important;
                        margin: 0 !important;
                        display: block !important;
                        visibility: visible !important;
                    `;
                }
                
                // Style the chart container
                const chartContainer = elevationContainer.querySelector('.elevation-chart-container');
                if (chartContainer) {
                    chartContainer.style.cssText = `
                        padding: 8px !important;
                        margin: 0 !important;
                        background: white !important;
                        border-radius: 8px !important;
                        border: 1px solid #e2e8f0 !important;
                        display: block !important;
                        visibility: visible !important;
                    `;
                }
                
                // Style the chart canvas
                const chart = elevationContainer.querySelector('#modalElevationChart');
                if (chart) {
                    // Get container width for proper canvas sizing
                    const containerWidth = chartContainer ? chartContainer.offsetWidth - 16 : 350; // subtract padding
                    
                    chart.style.cssText = `
                        height: 140px !important;
                        min-height: 140px !important;
                        border-radius: 6px !important;
                        display: block !important;
                        visibility: visible !important;
                        width: 100% !important;
                    `;
                    
                    // Set canvas dimensions properly for Chart.js
                    chart.width = containerWidth;
                    chart.height = 140;
                    
                    // Force Chart.js to resize if instance exists
                    if (window.routeDetailsModalInstance?.elevationChartInstance) {
                        setTimeout(() => {
                            try {
                                window.routeDetailsModalInstance.elevationChartInstance.resize();
                                window.routeDetailsModalInstance.elevationChartInstance.update();
                            } catch (e) {
                                console.warn('Chart resize failed:', e);
                            }
                        }, 100);
                    }
                }
                
                console.warn('📱 Elevation chart styled for mobile visibility');
            }
        }, 800);
    }

    destroy() {
        // Clean up mobile enhancements
        if (this.mapHeader) {
            this.mapHeader.remove();
            this.mapHeader = null;
        }
        
        if (this.bottomPanel) {
            this.bottomPanel.remove();
            this.bottomPanel = null;
        }
        
        this.isInitialized = false;
    }
}

// Initialize mobile enhancer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 768) {
        window.mobileRouteDetailsEnhancer = new MobileRouteDetailsEnhancer();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
        if (!window.mobileRouteDetailsEnhancer) {
            window.mobileRouteDetailsEnhancer = new MobileRouteDetailsEnhancer();
        }
    } else {
        if (window.mobileRouteDetailsEnhancer) {
            window.mobileRouteDetailsEnhancer.destroy();
            window.mobileRouteDetailsEnhancer = null;
        }
    }
});
