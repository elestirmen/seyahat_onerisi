/**
 * Mobile-friendly Route Details Modal with Tabbed Interface
 * Replaces the side panel with a fullscreen modal optimized for mobile UX
 */

class RouteDetailsModal {
    constructor() {
        this.modal = null;
        this.currentRoute = null;
        this.currentTab = 'overview';
        this.mapInstance = null;
        this.canvasRenderer = null;
        this.isVisible = false;
        this.hasFittedBounds = false;
        this.userHasInteracted = false;
        this._resizeTimer = null;
        this.elevationChart = null;
        this.elevationChartInstance = null;
        this.elevationDataForInteraction = null;
        this.elevationMediaOverlayPoints = [];
        this.pendingElevationMediaMarkers = null;
        this.elevationMediaScreenPoints = [];
        // POI overlays for elevation chart
        this.elevationPoiOverlayPoints = [];
        this.pendingElevationPoiMarkers = null;
        this.elevationPoiScreenPoints = [];
        // Elevation UX state
        this.showElevationMediaMarkers = true;
        this.useElevationGradient = true;
        this.elevZoomEnabled = false;
        this.elevZoomRange = null; // {min, max} in km
        this._elevMouseX = null;
        this._elevDragStart = null;
        // Throttling variables to prevent modal jitter
        this.lastElevationMouseMoveTime = null;
        this.lastElevationDrawnX = null;
        this.lastElevationMarkerPoint = null;
        // Media viewer optimization caches/state
        this.mediaElementCache = new Map(); // url -> DOM element
        this.currentMediaList = []; // {url,type}
        this.currentMediaIndex = 0;
        // Bind methods
        this.hide = this.hide.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleBackdropClick = this.handleBackdropClick.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.lockMapContainerLayout = this.lockMapContainerLayout.bind(this);
        this.unlockMapContainerLayout = this.unlockMapContainerLayout.bind(this);

        this.init();
    }

    static getInstance() {
        if (!window.routeDetailsModalInstance) {
            window.routeDetailsModalInstance = new RouteDetailsModal();
        }
        return window.routeDetailsModalInstance;
    }

    init() {
        // Create modal HTML structure
        this.createModalHTML();
        this.attachEventListeners();
    }

    createModalHTML() {
        // Remove existing modal if present
        const existingModal = document.getElementById('routeDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="routeDetailsModal" class="route-details-modal">
                <div class="route-details-modal-content">
                    <div class="route-details-modal-header">
                        <h2 class="route-details-modal-title" id="routeModalTitle">Rota Detayları</h2>
                        <p class="route-details-modal-subtitle" id="routeModalSubtitle">Rota bilgileri yükleniyor...</p>
                        <button class="route-details-modal-close" id="routeModalClose" aria-label="Kapat">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="route-details-tabs" id="routeModalTabs" role="tablist" aria-label="Rota detay sekmeleri">
                        <button class="route-details-tab active" data-tab="overview" role="tab" aria-selected="true">
                            <i class="fas fa-info-circle"></i>
                            <span>Genel Bilgi</span>
                        </button>
                        <button class="route-details-tab" data-tab="map" role="tab" aria-selected="false">
                            <i class="fas fa-map"></i>
                            <span>Harita</span>
                        </button>
                        <button class="route-details-tab" data-tab="pois" role="tab" aria-selected="false">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Duraklar</span>
                        </button>
                        <button class="route-details-tab" data-tab="media" role="tab" aria-selected="false">
                            <i class="fas fa-camera"></i>
                            <span>Medya</span>
                        </button>
                    </div>
                    
                    <div class="route-details-modal-body" id="routeModalBody">
                        <!-- Overview Tab -->
                        <div class="route-details-tab-content active" data-tab="overview" role="tabpanel" aria-hidden="false">
                            <div class="route-overview-section">
                                <h3><i class="fas fa-chart-bar"></i> Rota İstatistikleri</h3>
                                <div class="route-stats-grid" id="routeStatsGrid">
                                    <div class="route-stat-item">
                                        <div class="route-stat-icon">📏</div>
                                        <span class="route-stat-value" id="routeStatDistance">-- km</span>
                                        <div class="route-stat-label">Mesafe</div>
                                    </div>
                                    <div class="route-stat-item">
                                        <div class="route-stat-icon">⏱️</div>
                                        <span class="route-stat-value" id="routeStatDuration">-- saat</span>
                                        <div class="route-stat-label">Süre</div>
                                    </div>
                                    <div class="route-stat-item">
                                        <div class="route-stat-icon">📍</div>
                                        <span class="route-stat-value" id="routeStatStops">-- durak</span>
                                        <div class="route-stat-label">Durak Sayısı</div>
                                    </div>
                                    <div class="route-stat-item">
                                        <div class="route-stat-icon">⛰️</div>
                                        <span class="route-stat-value" id="routeStatDifficulty">--</span>
                                        <div class="route-stat-label">Zorluk</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="route-overview-section">
                                <h3><i class="fas fa-align-left"></i> Açıklama</h3>
                                <div class="route-description" id="routeDescription">
                                    Rota açıklaması yükleniyor...
                                </div>
                            </div>
                        </div>
                        
                        <!-- Map Tab -->
                        <div class="route-details-tab-content" data-tab="map" role="tabpanel" aria-hidden="true">
                            <div class="route-map-container">
                                <div id="routeModalMap" class="route-map"></div>
                                <div class="route-map-controls">
                                    <button class="route-map-control-btn" id="fitMapBtn" title="Rotaya Odakla">
                                        <i class="fas fa-expand-arrows-alt"></i>
                                    </button>
                                    <button class="route-map-control-btn" id="fullscreenMapBtn" title="Tam Ekran">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Elevation Profile in Map Tab -->
                            <div id="routeModalElevationContainer" class="route-elevation-container">
                                <!-- Elevation chart will be created here by Chart.js -->
                            </div>
                        </div>
                        
                        <!-- POIs Tab -->
                        <div class="route-details-tab-content" data-tab="pois" role="tabpanel" aria-hidden="true">
                            <div class="route-pois-list" id="routePoisList">
                                <div class="route-details-loading">
                                    <i class="fas fa-spinner"></i>
                                    <p>Duraklar yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Media Tab -->
                        <div class="route-details-tab-content" data-tab="media" role="tabpanel" aria-hidden="true">
                            <div class="route-details-loading">
                                <i class="fas fa-spinner"></i>
                                <p>Medya yükleniyor...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="route-details-actions">
                        <button class="route-action-btn primary" id="startNavigationBtn" aria-label="Navigasyonu Başlat" title="Navigasyonu Başlat">
                            <i class="fas fa-location-arrow"></i>
                            <span>Navigasyonu Başlat</span>
                        </button>
                        <button class="route-action-btn secondary" id="exportRouteBtn" aria-label="Dışa Aktar" title="Dışa Aktar">
                            <i class="fas fa-download"></i>
                            <span>Dışa Aktar</span>
                        </button>
                        <button class="route-action-btn secondary" id="shareRouteBtn" aria-label="Paylaş" title="Paylaş">
                            <i class="fas fa-share-alt"></i>
                            <span>Paylaş</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('routeDetailsModal');
    }

    attachEventListeners() {
        // Close button
        const closeBtn = document.getElementById('routeModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.hide);
        }

        // Backdrop click
        this.modal.addEventListener('click', this.handleBackdropClick);

        // Tab switching
        const tabs = document.querySelectorAll('.route-details-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Action buttons
        this.attachActionButtonListeners();

        // Keyboard events
        document.addEventListener('keydown', this.handleKeydown);

        // Swipe navigation for tabs on mobile
        this.attachSwipeNavigation();

        // Swipe down to close on mobile (from header)
        this.attachSwipeToClose();
    }

    attachSwipeNavigation() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const contentEl = this.modal.querySelector('.route-details-modal-content');
        if (!contentEl) return;

        let startX = 0, startY = 0, tracking = false, startedInMap = false;

        const onTouchStart = (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            tracking = true;
            // Don't interfere with map panning
            startedInMap = !!(e.target.closest && (e.target.closest('#routeModalMap') || e.target.closest('.leaflet-container')));
        };

        const onTouchEnd = (e) => {
            if (!tracking) return;
            tracking = false;
            if (!e.changedTouches || e.changedTouches.length !== 1) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            // Ignore mostly vertical or short gestures
            if (Math.abs(dy) > 40 || Math.abs(dx) < 60) return;
            if (startedInMap) return; // let the map handle it

            const tabs = ['overview', 'map', 'pois', 'media'];
            let idx = tabs.indexOf(this.currentTab);
            if (idx === -1) idx = 0;

            if (dx < 0 && idx < tabs.length - 1) {
                // Swipe left -> next tab
                this.switchTab(tabs[idx + 1]);
            } else if (dx > 0 && idx > 0) {
                // Swipe right -> previous tab
                this.switchTab(tabs[idx - 1]);
            }
        };

        contentEl.addEventListener('touchstart', onTouchStart, { passive: true });
        contentEl.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    attachSwipeToClose() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const headerEl = this.modal.querySelector('.route-details-modal-header');
        const bodyEl = document.getElementById('routeModalBody');
        if (!headerEl || !bodyEl) return;

        let startX = 0, startY = 0, tracking = false;

        const onTouchStart = (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            tracking = true;
        };

        const onTouchEnd = (e) => {
            if (!tracking) return;
            tracking = false;
            if (!e.changedTouches || e.changedTouches.length !== 1) return;
            if (bodyEl.scrollTop > 0) return; // only when scrolled to top
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (Math.abs(dy) > 80 && Math.abs(dx) < 60 && dy > 0) {
                // swipe down to close
                this.hide();
            }
        };

        headerEl.addEventListener('touchstart', onTouchStart, { passive: true });
        headerEl.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    attachMapControlListeners() {
        console.warn('🔧 Attaching map control listeners');

        // Check if modal exists
        if (!this.modal) {
            console.error('❌ Modal not found, cannot attach map control listeners');
            return;
        }

        // Map controls
        const fitBtn = document.getElementById('fitMapBtn');
        if (fitBtn) {
            console.warn('✅ Fit map button found, adding event listener');
            fitBtn.addEventListener('click', (e) => {
                console.warn('🔍 Fit map button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.fitMapToRoute();
            });
            console.warn('✅ Fit map button event listener attached successfully');
        } else {
            console.error('❌ Fit map button not found');
        }

        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        if (fullscreenBtn) {
            console.warn('✅ Fullscreen button found, adding event listener');
            fullscreenBtn.addEventListener('click', (e) => {
                console.warn('🔍 Fullscreen button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreenMap();
            });
            console.warn('✅ Fullscreen button event listener attached successfully');
        } else {
            console.error('❌ Fullscreen button not found');
        }

        console.warn('🔧 Map control listeners attachment completed');
    }

    attachActionButtonListeners() {
        // Navigation button
        const navBtn = document.getElementById('startNavigationBtn');
        if (navBtn) {
            navBtn.addEventListener('click', () => {
                this.startNavigation();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportRouteBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportRoute();
            });
        }

        // Share button
        const shareBtn = document.getElementById('shareRouteBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.shareRoute();
            });
        }

        // Map controls
        const fitBtn = document.getElementById('fitMapBtn');
        if (fitBtn) {
            console.warn('✅ Fit map button found, adding event listener');
            fitBtn.addEventListener('click', (e) => {
                console.warn('🔍 Fit map button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.fitMapToRoute();
            });
        } else {
            console.error('❌ Fit map button not found');
        }

        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        if (fullscreenBtn) {
            console.warn('✅ Fullscreen button found, adding event listener');
            fullscreenBtn.addEventListener('click', (e) => {
                console.warn('🔍 Fullscreen button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreenMap();
            });
        } else {
            console.error('❌ Fullscreen button not found');
        }
    }

    async show(routeData) {
        console.warn('🎯 Showing route details modal with data:', routeData);
        console.warn('📊 Modal element exists:', !!this.modal);
        console.warn('📊 Route data structure inspection:', {
            hasId: !!routeData.id,
            hasName: !!routeData.name,
            hasPois: !!(routeData.pois && routeData.pois.length > 0),
            poisCount: routeData.pois ? routeData.pois.length : 0,
            hasWaypoints: !!(routeData.waypoints && routeData.waypoints.length > 0),
            waypointsCount: routeData.waypoints ? routeData.waypoints.length : 0,
            hasGeometry: !!routeData.geometry,
            hasElevationProfile: !!routeData.elevation_profile,
            allKeys: Object.keys(routeData)
        });

        // Log POI structure if available
        if (routeData.pois && routeData.pois.length > 0) {
            console.warn('📍 First POI structure:', routeData.pois[0]);
        }
        if (routeData.waypoints && routeData.waypoints.length > 0) {
            console.warn('📍 First waypoint structure:', routeData.waypoints[0]);
        }

        this.currentRoute = routeData;
        this.updateHeader(routeData);

        // Reset fit/user interaction state for a fresh session
        this.hasFittedBounds = false;
        this.userHasInteracted = false;

        // Show modal with animation
        this.modal.classList.add('show');
        this.isVisible = true;

        // Use scroll lock to keep page position without toggling body scrollbars
        ScrollLock.enable(this.modal);

        // Reset modal scroll to top for better UX
        const bodyEl = document.getElementById('routeModalBody');
        if (bodyEl) bodyEl.scrollTop = 0;

        // Attach map control listeners after modal HTML is created
        setTimeout(() => {
            console.warn('🎯 Attaching map control listeners after modal show');
            this.attachMapControlListeners();
        }, 100);

        // Determine preferred initial tab (remember last or default to overview)
        const savedTab = localStorage.getItem('rdm:lastTab');
        if (savedTab && ['overview','map','pois','media'].includes(savedTab) && savedTab !== this.currentTab) {
            // Initialize UI to saved tab
            await this.switchTab(savedTab);
        }

        // Load content for current tab with mobile-specific delays
        const isMobile = window.innerWidth <= 768;
        const delay = isMobile ? 500 : 100;

            setTimeout(async () => {
                await this.loadTabContent(this.currentTab);

            // ALWAYS pre-load map content on mobile (critical fix)
            if (isMobile) {
                console.warn('📱 Pre-loading map content for mobile (critical fix)');
                // Force map tab to be temporarily visible for initialization
                const mapTab = document.querySelector('.route-details-tab-content[data-tab="map"]');
                if (mapTab) {
                    const originalStyle = mapTab.style.cssText;
                    mapTab.style.cssText = 'display: block !important; position: relative !important; visibility: visible !important; opacity: 1 !important; left: 0 !important; z-index: 1 !important;';

                    // Load map content
                    setTimeout(async () => {
                        await this.loadMapContent();

                        // Restore original visibility if not on map tab
                        if (this.currentTab !== 'map') {
                            setTimeout(() => {
                                mapTab.style.cssText = originalStyle;
                            }, 500);
                        }
                    }, 200);
                }
            }

            // Initialize elevation chart if we're on the map tab with additional mobile delay
                if (this.currentTab === 'map') {
                    const chartDelay = isMobile ? 1200 : 200;
                    setTimeout(() => {
                        this.initializeElevationChart();
                    }, chartDelay);
                    // Lock map container layout to integer px after initial content
                    setTimeout(() => { this.lockMapContainerLayout(); }, chartDelay + 50);
                }
            }, delay);

        // Add resize listener for responsive behavior
        this.addResizeListener();
    }

    hide() {
        console.warn('🎯 Hiding route details modal');

        this.modal.classList.remove('show');
        this.isVisible = false;

        // Release scroll lock
        ScrollLock.disable();

        // Remove visibility listener and unlock layout
        try { document.removeEventListener('visibilitychange', this.handleVisibilityChange); } catch (_) {}
        this.unlockMapContainerLayout();

        // Clean up resize listener
        this.removeResizeListener();

        // Close media viewer if open
        const openViewer = this.modal.querySelector('.media-viewer-modal');
        if (openViewer) openViewer.remove();

        // Clean up map instance
        if (this.mapInstance) {
            this.mapInstance.remove();
            this.mapInstance = null;
        }

        // Clean up elevation chart
        if (this.elevationChartInstance && typeof this.elevationChartInstance.destroy === 'function') {
            this.elevationChartInstance.destroy();
            this.elevationChartInstance = null;
        }

        // Clean up chart event listeners
        if (this.chartEventListeners) {
            const { canvas, handleMouseMove, handleMouseLeave, handleClick } = this.chartEventListeners;
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.removeEventListener('click', handleClick);
            this.chartEventListeners = null;
        }

        // Clean up map marker
        this.removeMapMarker();

        // Clear elevation data
        this.elevationDataForInteraction = null;
        this.currentElevationPosition = null;

        this.currentRoute = null;
    }

    // Ensure map container uses integer pixel dimensions to avoid sub-pixel drift
    lockMapContainerLayout() {
        try {
            const mapEl = document.getElementById('routeModalMap');
            const wrapper = mapEl ? mapEl.closest('.route-map-container') : null;
            if (!mapEl || !wrapper) return;
            const rect = wrapper.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));
            wrapper.style.width = w + 'px';
            wrapper.style.height = h + 'px';
            mapEl.style.width = w + 'px';
            mapEl.style.height = h + 'px';
        } catch (_) { /* noop */ }
    }

    unlockMapContainerLayout() {
        try {
            const mapEl = document.getElementById('routeModalMap');
            const wrapper = mapEl ? mapEl.closest('.route-map-container') : null;
            if (wrapper) {
                wrapper.style.width = '';
                wrapper.style.height = '';
            }
            if (mapEl) {
                mapEl.style.width = '';
                mapEl.style.height = '';
            }
        } catch (_) { /* noop */ }
    }

    handleVisibilityChange() {
        if (document.hidden) return;
        if (!(this.isVisible && this.currentTab === 'map' && this.mapInstance)) return;
        // On tab return, lock container to integer px and only invalidate size.
        this.lockMapContainerLayout();
        try { this.mapInstance.invalidateSize(); } catch (_) {}
        // Do not refit unless initial fit missing
        if (!this.hasFittedBounds && !this.userHasInteracted) {
            this.fitMapToRoute(true);
        }
    }

    updateHeader(routeData) {
        const title = document.getElementById('routeModalTitle');
        const subtitle = document.getElementById('routeModalSubtitle');

        if (title) {
            title.textContent = routeData.name || 'Rota Detayları';
        }

        if (subtitle) {
            const duration = Math.round((routeData.estimated_duration || 0) / 60);
            const distance = (routeData.total_distance || 0).toFixed(1);
            const stopCount = routeData.poi_count || (routeData.waypoints ? routeData.waypoints.length : 0);

            subtitle.textContent = `${distance} km • ${duration} saat • ${stopCount} durak`;
        }
    }

    async switchTab(tabName) {
        if (this.currentTab === tabName) return;

        console.warn('🔄 Switching to tab:', tabName);

        const prevTab = this.currentTab;

        // Update tab buttons
        document.querySelectorAll('.route-details-tab').forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        // Handle mobile full screen for map tab
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            const modal = document.querySelector('.route-details-modal');
            if (modal) {
                if (tabName === 'map') {
                    modal.classList.add('map-tab-active');
                } else {
                    modal.classList.remove('map-tab-active');
                }
            }
        }

        // Close media viewer if leaving media tab
        if (this.currentTab === 'media' && tabName !== 'media') {
            const openViewer = this.modal.querySelector('.media-viewer-modal');
            if (openViewer) openViewer.remove();
        }

        // Update tab content
        document.querySelectorAll('.route-details-tab-content').forEach(content => {
            const isActive = content.dataset.tab === tabName;
            content.classList.toggle('active', isActive);
            content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        // If leaving map tab on mobile, aggressively clear any forced inline styles
        if (isMobile && prevTab === 'map' && tabName !== 'map') {
            try {
                const mapTab = document.querySelector('.route-details-tab-content[data-tab="map"]');
                const mapContainer = document.getElementById('routeModalMap');
                const mapSection = mapContainer ? mapContainer.closest('.route-map-container') : null;

                if (mapTab) {
                    // Clear previously injected inline styles that forced visibility
                    mapTab.style.cssText = '';
                    // Ensure it's hidden immediately to prevent overlap
                    mapTab.style.display = 'none';
                    mapTab.style.visibility = 'hidden';
                }
                if (mapSection) {
                    mapSection.style.cssText = '';
                }
                if (mapContainer) {
                    mapContainer.style.cssText = '';
                    // Also disable interactions while hidden
                    mapContainer.style.pointerEvents = 'none';
                }
                // Unlock any locked layout
                this.unlockMapContainerLayout();
            } catch (_) { /* noop */ }
        }

        this.currentTab = tabName;

        // Scroll content to top when switching tabs for better UX
        const bodyEl = document.getElementById('routeModalBody');
        if (bodyEl) {
            try {
                bodyEl.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (_) {
                bodyEl.scrollTop = 0;
            }
        }

        // Force layout reflow on mobile before loading content
        if (isMobile && tabName === 'map') {
            const mapTab = document.querySelector('.route-details-tab-content[data-tab="map"]');
            const mapContainer = document.getElementById('routeModalMap');

            if (mapTab && mapContainer) {
                // Force tab and container to be visible and properly sized
                mapTab.style.cssText = 'display: block !important; position: relative !important; visibility: visible !important; opacity: 1 !important; left: 0 !important; z-index: 1 !important;';

                mapContainer.style.cssText = `
                    width: 100% !important;
                    height: 300px !important;
                    min-height: 300px !important;
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                `;

                // Re-enable interactions now that it's visible
                mapContainer.style.pointerEvents = 'auto';

                // Force multiple reflows
                mapContainer.offsetHeight;
                mapContainer.getBoundingClientRect();
                mapTab.offsetHeight;

                console.warn('📱 Forced map container sizing before content load:', {
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight,
                    tabVisible: mapTab.style.visibility,
                    tabDisplay: mapTab.style.display
                });
            }
        }

        // Load content for new tab
        await this.loadTabContent(tabName);

        // Special handling for map tab to ensure proper rendering with mobile optimization
        if (tabName === 'map') {
            const delay = isMobile ? 500 : 300;

            setTimeout(() => {
                if (this.mapInstance) {
                    console.warn('🗺️ Invalidating map size after tab switch');
                    this.mapInstance.invalidateSize();
                    if (!this.hasFittedBounds && !this.userHasInteracted) {
                        this.fitMapToRoute(true);
                    }

                    // Additional mobile-specific map refresh
                    if (isMobile) {
                        setTimeout(() => {
                            this.mapInstance.invalidateSize();
                            if (!this.hasFittedBounds && !this.userHasInteracted) {
                                this.fitMapToRoute(true);
                            }
                        }, 200);
                }
                }

                // Initialize elevation chart if elevation container exists but chart doesn't
                const elevationContainer = document.getElementById('routeModalElevationContainer');
                const elevationCanvas = document.getElementById('modalElevationChart');

                if (elevationContainer && !elevationCanvas) {
                    console.warn('🏔️ Initializing elevation chart after tab switch');
                    const chartDelay = isMobile ? 400 : 100;
                    setTimeout(() => {
                        this.initializeElevationChart();
                    }, chartDelay);
                }
            }, delay);
        }

        // Persist last selected tab for next open
        try { localStorage.setItem('rdm:lastTab', this.currentTab); } catch (_) {}
    }

    async loadTabContent(tabName) {
        if (!this.currentRoute) return;

        switch (tabName) {
            case 'overview':
                await this.loadOverviewContent();
                break;
            case 'map':
                await this.loadMapContent();
                break;
            case 'pois':
                await this.loadPoisContent();
                break;
            case 'media':
                await this.loadMediaContent();
                break;
        }
    }

    async loadOverviewContent() {
        const route = this.currentRoute;

        // Update statistics
        const distance = (route.total_distance || 0).toFixed(1);
        const duration = Math.round((route.estimated_duration || 0) / 60);
        const stopCount = route.poi_count || (route.waypoints ? route.waypoints.length : 0);
        const difficulty = this.createDifficultyStars(route.difficulty_level || 1);

        document.getElementById('routeStatDistance').textContent = `${distance} km`;
        document.getElementById('routeStatDuration').textContent = `${duration} saat`;
        document.getElementById('routeStatStops').textContent = `${stopCount}`;
        document.getElementById('routeStatDifficulty').innerHTML = difficulty;

        // Update description
        const descriptionEl = document.getElementById('routeDescription');
        if (descriptionEl) {
            descriptionEl.textContent = route.description || 'Bu rota için açıklama bulunmuyor.';
        }

        // Elevation profile is now loaded in the map tab
    }

    async loadMapContent() {
        const mapContainer = document.getElementById('routeModalMap');
        if (!mapContainer) {
            console.error('❌ Map container not found');
            return;
        }

        // Force container to be visible and sized properly
        const isMobile = window.innerWidth <= 768;
        // Device type detection (log removed for cleaner console)

        // Ensure container has proper dimensions and is visible - MOBILE FIX
        if (isMobile) {
            // Force the parent tab to be visible first
            const mapTab = document.querySelector('.route-details-tab-content[data-tab="map"]');
            if (mapTab) {
                mapTab.style.display = 'block';
                mapTab.style.visibility = 'visible';
                mapTab.style.position = 'relative';
                mapTab.style.width = '100%';
                mapTab.style.height = 'auto';
            }

            // MOBILE map sizing based on parent container width
            const viewportHeight = window.innerHeight || 667;
            const mapHeight = Math.max(500, viewportHeight * 0.6); // 60% of screen or min 500px

            // Force parent containers to be large too (reuse existing mapTab)
            const mapSection = mapContainer.closest('.route-map-container');

            // Update existing mapTab with more aggressive styling
            if (mapTab) {
                mapTab.style.cssText = `
                    display: block !important;
                    position: relative !important;
                    visibility: visible !important;
                    width: 100% !important;
                    height: auto !important;
                    min-height: ${mapHeight + 100}px !important;
                `;
            }

            if (mapSection) {
                mapSection.style.cssText = `
                    width: 100% !important;
                    height: ${mapHeight}px !important;
                    min-height: ${mapHeight}px !important;
                    display: block !important;
                    position: relative !important;
                `;
            }

            // Force container styling with parent-relative width
            mapContainer.style.cssText = `
                width: 100% !important;
                height: ${mapHeight}px !important;
                min-height: ${mapHeight}px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                background: #e0e0e0 !important;
                border: 3px solid #007bff !important;
                margin: 10px auto !important;
                border-radius: 8px !important;
                z-index: 1000 !important;
            `;

            // Mobile map sizing applied (log removed for cleaner console)

            // Force reflow multiple times
            mapContainer.offsetHeight;
            mapContainer.getBoundingClientRect();

            // Wait for container to be ready with more aggressive checking
            let attempts = 0;
            while (mapContainer.offsetWidth === 0 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));

                // Re-apply styles each attempt
                mapContainer.style.width = '100%';
                mapContainer.style.height = '300px';
                mapContainer.style.display = 'block';
                mapContainer.offsetHeight; // Force reflow

                attempts++;
                // Container readiness check (log removed for cleaner console)
            }

            if (mapContainer.offsetWidth === 0) {
                console.error('❌ Map container still has 0 width after 20 attempts');
                // Last resort: keep percentage width and set a safe height
                mapContainer.style.width = '100%';
                mapContainer.style.height = '300px';
                mapContainer.offsetHeight;

                if (mapContainer.offsetWidth === 0) {
                    console.error('❌ Even fixed width failed, aborting map initialization');
                    return;
                }
            }

            // Container ready (log removed for cleaner console)
        }

        // Additional debug info
        // Container state logged (removed for cleaner console)

        if (this.mapInstance) {
            // Map already initialized, invalidate size for responsive behavior
            // Map refresh (log removed for cleaner console)
            const delay = isMobile ? 500 : 100;

            setTimeout(() => {
                // Container dimensions logged (removed for cleaner console)

                this.mapInstance.invalidateSize();
                if (!this.hasFittedBounds && !this.userHasInteracted) {
                    this.fitMapToRoute(true);
                }

                // Force additional resize on mobile with multiple attempts
                if (isMobile) {
                    setTimeout(() => {
                        this.mapInstance.invalidateSize();
                        if (!this.hasFittedBounds && !this.userHasInteracted) {
                            this.fitMapToRoute(true);
                        }
                    }, 300);

                    setTimeout(() => {
                        this.mapInstance.invalidateSize();
                        if (!this.hasFittedBounds && !this.userHasInteracted) {
                            this.fitMapToRoute(true);
                        }
                    }, 600);
                }
            }, delay);

            // Check if elevation chart needs to be initialized
            const elevationContainer = document.getElementById('routeModalElevationContainer');
            const elevationCanvas = document.getElementById('modalElevationChart');

            if (!elevationContainer || !elevationCanvas) {
                console.warn('🏔️ Elevation chart missing, initializing...');
                const chartDelay = isMobile ? 800 : 200;
                setTimeout(() => {
                    this.initializeElevationChart();
                }, chartDelay);
            } else {
                await this.loadElevationProfile();
            }
            return;
        }

        try {
            console.warn('🗺️ Initializing new map instance for modal');
            console.warn('📏 Container dimensions before map init:', {
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight,
                style: mapContainer.style.cssText
            });

            // Wait for container to be properly sized on mobile
            if (isMobile) {
                await new Promise(resolve => setTimeout(resolve, 300));
                console.warn('📏 Container dimensions after wait:', {
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight
                });
            }

            // Initialize Leaflet map with proper sizing
            console.warn('🗺️ Creating Leaflet map instance...');
            this.mapInstance = L.map('routeModalMap', {
                preferCanvas: true,
                zoomControl: true,
                attributionControl: true,
                // Stabilize rendering to avoid visible lateral shifts
                zoomAnimation: false,
                fadeAnimation: false,
                updateWhenZooming: false,
                updateWhenIdle: true,
                inertia: false,
                scrollWheelZoom: 'center'
            }).setView([38.6431, 34.8286], 10);

            console.warn('✅ Map instance created successfully');
            console.warn('📊 Map container info after creation:', {
                mapSize: this.mapInstance.getSize(),
                mapCenter: this.mapInstance.getCenter(),
                mapZoom: this.mapInstance.getZoom(),
                containerSize: this.mapInstance.getContainer().getBoundingClientRect()
            });

            // Initialize base layers
            this.initializeBaseLayers();

            // Track user interaction to avoid auto-fit after user moves map
            try {
                this.mapInstance.on('dragstart zoomstart', () => { this.userHasInteracted = true; });
            } catch (_) { /* noop */ }

            // Wait for map to be ready, then display route with mobile-specific delays
            const mapDelay = isMobile ? 800 : 200;

            setTimeout(async () => {
                console.warn('🗺️ Map ready, invalidating size and displaying route');
                console.warn('📏 Final container dimensions:', {
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight
                });

                this.mapInstance.invalidateSize();

                // Display route on map
                await this.displayRouteOnMap();

                // Force multiple resize attempts on mobile
                if (isMobile) {
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            console.warn(`🔄 Mobile resize attempt ${i + 1}`);
                            this.mapInstance.invalidateSize();
                            if (i === 2) this.fitMapToRoute();
                        }, (i + 1) * 200);
                    }
                } else {
                    this.fitMapToRoute(true);
                }

                // Initialize elevation chart with mobile delay
                const chartDelay = isMobile ? 1200 : 400;
                setTimeout(() => {
                    this.initializeElevationChart();
                }, chartDelay);
            }, mapDelay);

        } catch (error) {
            console.error('❌ Error initializing map:', error);
            mapContainer.innerHTML = `
                <div class="route-details-loading">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Harita yüklenirken hata oluştu: ${error.message}</p>
                </div>
            `;
        }
    }

    async loadPoisContent() {
        const poisContainer = document.getElementById('routePoisList');
        if (!poisContainer) return;

        try {
            console.warn('🏛️ Loading POIs content for route:', this.currentRoute.name);
            console.warn('📊 POI data in currentRoute:', {
                hasPois: !!(this.currentRoute.pois && this.currentRoute.pois.length > 0),
                poisCount: this.currentRoute.pois ? this.currentRoute.pois.length : 0,
                hasWaypoints: !!(this.currentRoute.waypoints && this.currentRoute.waypoints.length > 0),
                waypointsCount: this.currentRoute.waypoints ? this.currentRoute.waypoints.length : 0
            });

            let pois = [];

            // Get POIs from route data
            if (this.currentRoute.pois) {
                pois = this.currentRoute.pois;
                console.warn('✅ Using POIs from currentRoute.pois:', pois.length);
            } else if (this.currentRoute.waypoints) {
                pois = this.currentRoute.waypoints;
                console.warn('✅ Using waypoints from currentRoute.waypoints:', pois.length);
            } else {
                // Fetch POIs from API
                const apiBase = window.apiBase || '/api';
                console.warn('📡 Fetching POIs from API:', `${apiBase}/routes/${this.currentRoute.id}`);

                const response = await fetch(`${apiBase}/routes/${this.currentRoute.id}`);
                console.warn('📡 POIs API response status:', response.status, response.statusText);

                if (response.ok) {
                    const routeDetails = await response.json();
                    pois = routeDetails.pois || [];
                    console.warn('✅ Fetched POIs from API:', pois.length);
                } else {
                    console.warn('❌ Failed to fetch POIs from API:', response.status);
                }
            }

            if (pois.length === 0) {
                poisContainer.innerHTML = `
                    <div class="route-media-empty">
                        <i class="fas fa-map-marker-alt"></i>
                        <p>Bu rota için durak bilgisi bulunmuyor</p>
                    </div>
                `;
                return;
            }

            // Render POIs
            const poisHTML = pois.map((poi, index) => {
                const categoryStyle = this.getCategoryStyle(poi.category);
                return `
                    <div class="route-poi-item" onclick="window.routeDetailsModalInstance.focusOnPoi(${poi.latitude || poi.lat}, ${poi.longitude || poi.lng})">
                        <div class="route-poi-icon" style="background-color: ${categoryStyle.color}">
                            <i class="${categoryStyle.iconClass}"></i>
                        </div>
                        <div class="route-poi-info">
                            <div class="route-poi-name">${poi.name}</div>
                            <div class="route-poi-category">${this.getCategoryDisplayName(poi.category)}</div>
                            <div class="route-poi-description">${poi.description || 'Açıklama bulunmuyor'}</div>
                        </div>
                        <div class="route-poi-index">${index + 1}</div>
                    </div>
                `;
            }).join('');

            poisContainer.innerHTML = poisHTML;

            // Also reflect POIs on the elevation chart as overlay icons
            try {
                if (this.elevationChartInstance) {
                    this.updateElevationPoiMarkers(pois);
                } else {
                    this.pendingElevationPoiMarkers = pois;
                }
            } catch (_) { /* ignore */ }

        } catch (error) {
            console.error('❌ Error loading POIs:', error);
            poisContainer.innerHTML = `
                <div class="route-media-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Duraklar yüklenirken hata oluştu</p>
                </div>
            `;
        }
    }

    async loadMediaContent() {
        const mediaTabContent = document.querySelector('.route-details-tab-content[data-tab="media"]');
        if (!mediaTabContent) return;

        try {
            console.warn('🎬 Loading media content for route:', this.currentRoute.name);

            const apiBase = window.apiBase || '/api';
            console.warn('📡 Fetching media content from:', `${apiBase}/admin/routes/${this.currentRoute.id}/media`);

            const response = await fetch(`${apiBase}/admin/routes/${this.currentRoute.id}/media`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            let mediaFiles = [];

            // Handle different response formats
            if (Array.isArray(data)) {
                mediaFiles = data;
            } else if (Array.isArray(data.media)) {
                mediaFiles = data.media;
            } else if (Array.isArray(data.files)) {
                mediaFiles = data.files;
            }

            if (mediaFiles.length === 0) {
                mediaTabContent.innerHTML = `
                    <div class="route-media-empty">
                        <i class="fas fa-camera"></i>
                        <h4>Medya Bulunamadı</h4>
                        <p>Bu rota için henüz medya dosyası eklenmemiş</p>
                    </div>
                `;
                return;
            }

            // Create enhanced media strip layout
            const mediaStripHTML = `
                <div class="route-media-container">
                    <div class="media-strip-header">
                        <h3 class="media-strip-title">
                            <i class="fas fa-camera"></i>
                            Rota Medyaları (${mediaFiles.length})
                        </h3>
                        <div class="media-strip-controls">
                            <button class="media-nav-btn" id="mediaPrevBtn" title="Önceki">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="media-nav-btn" id="mediaNextBtn" title="Sonraki">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    <div class="route-media-grid" id="routeMediaGrid">
                        ${this.renderMediaItems(mediaFiles)}
                    </div>
                </div>
            `;

            mediaTabContent.innerHTML = mediaStripHTML;

            // Initialize media navigation
            this.initializeMediaNavigation();

        } catch (error) {
            console.error('❌ Error loading media content:', error);
            const mediaContainer = document.getElementById('routeMediaGrid');
            if (mediaContainer) {
                mediaContainer.innerHTML = `
                    <div class="route-media-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Medya Yüklenemedi</h4>
                        <p>Medya dosyaları yüklenirken bir hata oluştu</p>
                    </div>
                `;
            }
        }
    }

    renderMediaItems(mediaFiles) {
        return mediaFiles.map((media, index) => {
            const isVideo = media.media_type === 'video' || media.path?.includes('.mp4');
            const isAudio = media.media_type === 'audio' || media.path?.includes('.mp3');
            const is3D = media.media_type === 'model_3d' || media.path?.includes('.glb');

            // Debug media URL construction
            console.warn('🎬 Media item URL construction:', {
                mediaId: media.id || media._id,
                url: media.url,
                path: media.path,
                thumbnail_path: media.thumbnail_path,
                file_path: media.file_path,
                original_path: media.original_path,
                full_path: media.full_path,
                filename: media.filename,
                mediaKeys: Object.keys(media)
            });

            // Construct proper media URL - prioritize full resolution over thumbnails
            let mediaUrl = media.url || media.path || media.filename;
            if (mediaUrl && !mediaUrl.startsWith('http')) {
                // Prioritize full-resolution paths over thumbnails
                if (media.original_path) {
                    mediaUrl = `/${media.original_path}`;
                    console.warn('🎯 Using original_path for full resolution');
                } else if (media.full_path) {
                    mediaUrl = `/${media.full_path}`;
                    console.warn('🎯 Using full_path for full resolution');
                } else if (media.file_path) {
                    mediaUrl = `/${media.file_path}`;
                    console.warn('🎯 Using file_path for full resolution');
                } else if (media.path) {
                    mediaUrl = media.path.startsWith('/') ? media.path : `/${media.path}`;
                    console.warn('🎯 Using path for full resolution');
                } else if (media.filename) {
                    // For files served from root domain (like the error shows)
                    mediaUrl = `/${media.filename}`;
                    console.warn('🎯 Using filename for full resolution');
                } else {
                    // Last resort - serve from uploads directory
                    mediaUrl = `/uploads/${mediaUrl}`;
                    console.warn('🎯 Using uploads directory as fallback');
                }
            }

            console.warn('🎬 Final media URL for display:', mediaUrl);

            let typeIcon = 'fas fa-file';
            if (isVideo) typeIcon = 'fas fa-play';
            else if (isAudio) typeIcon = 'fas fa-volume-up';
            else if (is3D) typeIcon = 'fas fa-cube';
            else typeIcon = 'fas fa-image';

            const mediaTitle = media.caption || media.alt_text || `Medya ${index + 1}`;
            const mediaInfo = `${media.media_type || 'image'} • ${this.formatFileSize(media.file_size)}`;

            return `
                <div class="route-media-item" data-media-index="${index}" onclick="window.routeDetailsModalInstance.showMediaViewer('${mediaUrl}', '${media.media_type || 'image'}', ${index})">
                    ${isVideo ?
                    `<video src="${mediaUrl}" muted preload="metadata" onloadeddata="this.classList.add('loaded')" onerror="console.error('Failed to load video:', '${mediaUrl}'); this.parentElement.style.display='none';"></video>
                     <div class="route-media-play-btn">
                         <i class="fas fa-play"></i>
                     </div>` :
                    isAudio ?
                    `<div class="route-media-audio-placeholder">
                         <i class="fas fa-music"></i>
                     </div>` :
                    is3D ?
                    `<div class="route-media-3d-placeholder">
                         <i class="fas fa-cube"></i>
                     </div>` :
                    `<img src="${mediaUrl}" alt="${media.alt_text || 'Rota medyası'}" loading="lazy" onload="this.classList.add('loaded')" onerror="console.error('Failed to load image:', '${mediaUrl}'); this.parentElement.style.display='none';">`
                    }
                    <div class="route-media-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div class="route-media-overlay">
                        <div class="route-media-title">${mediaTitle}</div>
                        <div class="route-media-info">
                            <i class="fas fa-info-circle"></i>
                            ${mediaInfo}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    initializeMediaNavigation() {
        const mediaGrid = document.getElementById('routeMediaGrid');
        const prevBtn = document.getElementById('mediaPrevBtn');
        const nextBtn = document.getElementById('mediaNextBtn');

        if (!mediaGrid || !prevBtn || !nextBtn) return;

        const scrollAmount = 340; // Width of one media item + gap

        // Update button states
        const updateButtonStates = () => {
            const scrollLeft = mediaGrid.scrollLeft;
            const maxScroll = mediaGrid.scrollWidth - mediaGrid.clientWidth;

            prevBtn.disabled = scrollLeft <= 0;
            nextBtn.disabled = scrollLeft >= maxScroll - 1;
        };

        // Navigation handlers
        prevBtn.addEventListener('click', () => {
            mediaGrid.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        });

        nextBtn.addEventListener('click', () => {
            mediaGrid.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        });

        // Update button states on scroll
        mediaGrid.addEventListener('scroll', updateButtonStates);

        // Initial button state
        setTimeout(updateButtonStates, 100);

        // Keyboard navigation
        mediaGrid.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevBtn.click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextBtn.click();
            }
        });

        // Make grid focusable for keyboard navigation
        mediaGrid.setAttribute('tabindex', '0');
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Bilinmiyor';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async displayRouteOnMap() {
        if (!this.mapInstance || !this.currentRoute) {
            console.warn('❌ Cannot display route on map - missing map instance or route data');
            return;
        }

        try {
            console.warn('🗺️ Displaying enhanced route on modal map:', this.currentRoute.name);
            console.warn('📊 Route data structure:', {
                hasPois: !!(this.currentRoute.pois && this.currentRoute.pois.length > 0),
                poisCount: this.currentRoute.pois ? this.currentRoute.pois.length : 0,
                hasWaypoints: !!(this.currentRoute.waypoints && this.currentRoute.waypoints.length > 0),
                waypointsCount: this.currentRoute.waypoints ? this.currentRoute.waypoints.length : 0,
                routeKeys: Object.keys(this.currentRoute)
            });

            // Ensure map is properly sized before adding content
            console.warn('🗺️ Invalidating map size before displaying route');
            this.mapInstance.invalidateSize();

            // Clear existing layers
            this.mapInstance.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                    this.mapInstance.removeLayer(layer);
                }
            });

            // Add route geometry if available
            if (this.currentRoute.geometry) {
                console.warn('🛣️ Adding route geometry to map');
                const geometry = typeof this.currentRoute.geometry === 'string'
                    ? JSON.parse(this.currentRoute.geometry)
                    : this.currentRoute.geometry;

                if (geometry.coordinates) {
                    const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    // Ensure a dedicated canvas renderer to avoid SVG flicker/jitter
                    if (!this.canvasRenderer) {
                        try { this.canvasRenderer = L.canvas(); } catch (_) { this.canvasRenderer = null; }
                    }

                    const routeLine = L.polyline(coordinates, {
                        color: '#4338ca',
                        weight: 4,
                        opacity: 0.8,
                        interactive: false, // avoid hover-induced repaints on the route line
                        lineCap: 'round',
                        lineJoin: 'round',
                        renderer: this.canvasRenderer || undefined
                    }).addTo(this.mapInstance);

                    console.warn('✅ Route geometry added successfully');
                }
            }

            // Add enhanced POI markers with detailed popups and modal integration
            const pois = this.currentRoute.pois || this.currentRoute.waypoints || [];
            console.warn('📍 Processing POIs for markers:', pois.length, 'POIs found');

            if (pois.length === 0) {
                console.warn('⚠️ No POIs found to display as markers');
            } else {
                console.warn('📍 Adding POI markers to map...');
            }

            let markersAdded = 0;
            pois.forEach((poi, index) => {
                console.warn(`📍 Processing POI ${index + 1}:`, poi.name || `POI ${index + 1}`);

                // More flexible coordinate detection
                const lat = poi.latitude || poi.lat || poi.coords?.[1] || poi.location?.lat || poi.position?.lat;
                const lng = poi.longitude || poi.lng || poi.lon || poi.coords?.[0] || poi.location?.lng || poi.position?.lng;

                console.warn(`📍 POI ${index + 1} coordinates:`, {
                    lat, lng,
                    hasLat: !!lat,
                    hasLng: !!lng,
                    isValidLat: !isNaN(parseFloat(lat)),
                    isValidLng: !isNaN(parseFloat(lng))
                });

                if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    console.warn(`✅ Creating marker for POI ${index + 1}: ${poi.name} at [${lat}, ${lng}]`);
                    const categoryStyle = this.getCategoryStyle(poi.category);

                    try {
                        const marker = L.marker([parseFloat(lat), parseFloat(lng)], {
                            icon: L.divIcon({
                                className: 'custom-poi-marker',
                                html: `
                                    <div class="poi-marker-container" style="background-color: ${categoryStyle.color}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">
                                        <i class="${categoryStyle.iconClass}"></i>
                                    </div>
                                    <div class="poi-marker-score" style="position: absolute; top: -6px; right: -6px; background: #2563eb; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">${index + 1}</div>
                                `,
                                iconSize: [32, 32],
                                iconAnchor: [16, 16],
                                popupAnchor: [0, -16]
                            })
                        })
                            .addTo(this.mapInstance);

                        // Create detailed popup with POI detail modal integration
                        const popupContent = this.createDetailedPOIPopup(poi, index + 1);
                        marker.bindPopup(popupContent, {
                            maxWidth: 300,
                            minWidth: 250,
                            className: 'custom-poi-popup'
                        });

                        // Hover effects removed to prevent jitter on some browsers

                        markersAdded++;
                        console.warn(`✅ POI marker ${index + 1} added successfully`);
                    } catch (markerError) {
                        console.error(`❌ Error creating marker for POI ${index + 1}:`, markerError);
                    }
                } else {
                    console.warn(`⚠️ Skipping POI ${index + 1} - invalid coordinates:`, { lat, lng });
                }
            });

            console.warn(`📍 Total markers added: ${markersAdded} out of ${pois.length} POIs`);

            // Load and display media markers for the route
            await this.loadRouteMediaMarkers();

            // Fit map once after marker creation to initial bounds
            setTimeout(() => {
                console.warn('🎯 Fitting map to route after marker creation');
                this.fitMapToRoute(true);
            }, 100);

        } catch (error) {
            console.error('❌ Error displaying route on map:', error);
        }
    }

    // Enhanced POI popup creation with modal integration
    createDetailedPOIPopup(poi, stopNumber) {
        const categoryStyle = this.getCategoryStyle(poi.category || 'diger');
        const categoryName = this.getCategoryDisplayName(poi.category || 'diger');

        // Basic info that's always available
        let popupHTML = `
            <div class="poi-popup-detailed" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 280px;">
                <div class="poi-popup-header" style="display: flex; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                    <div class="poi-popup-icon" style="background: ${categoryStyle.color}; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                        <i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i>
                    </div>
                    <div class="poi-popup-title-section" style="flex: 1;">
                        <h4 class="poi-popup-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">${poi.name}</h4>
                        <p class="poi-popup-category" style="margin: 2px 0 0 0; font-size: 12px; color: #666;">${categoryName} • Durak ${stopNumber}</p>
                    </div>
                </div>
                
                <div class="poi-popup-content" style="line-height: 1.4;">
        `;

        // Add description if available
        if (poi.description) {
            popupHTML += `
                <div class="poi-popup-description" style="margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.3;">${poi.description.length > 120 ? poi.description.substring(0, 120) + '...' : poi.description}</p>
                </div>
            `;
        }

        // Add coordinates info
        const lat = poi.lat || poi.latitude;
        const lng = poi.lng || poi.lon || poi.longitude;
        if (lat && lng) {
            popupHTML += `
                <div class="poi-popup-coordinates" style="display: flex; align-items: center; margin-bottom: 6px; font-size: 11px; color: #777;">
                    <i class="fas fa-map-marker-alt" style="margin-right: 6px; width: 12px;"></i>
                    <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
                </div>
            `;
        }

        // Action buttons with POI detail modal integration
        popupHTML += `
                <div class="poi-popup-actions" style="display: flex; gap: 6px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee;">
                    <button class="poi-popup-btn poi-popup-btn--secondary" onclick="openInGoogleMaps(${lat}, ${lng}, '${poi.name.replace(/'/g, "\\")}'); event.stopPropagation();" style="flex: 1; padding: 6px 8px; font-size: 11px; border: 1px solid #6c757d; background: white; color: #6c757d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fab fa-google" style="font-size: 10px;"></i> Maps
                    </button>
                    <button class="poi-popup-btn poi-popup-btn--primary" onclick="showPOIDetail('${poi.poi_id || poi.id || poi._id}'); event.stopPropagation();" style="flex: 1; padding: 6px 8px; font-size: 11px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fas fa-info-circle" style="font-size: 10px;"></i> Detay
                    </button>
                </div>
            </div>
        `;

        return popupHTML;
    }

    // Load and display media markers for the route
    async loadRouteMediaMarkers() {
        if (!this.mapInstance || !this.currentRoute) {
            console.warn('❌ Cannot load media markers - missing map instance or route data');
            return;
        }

        try {
            console.warn('🎬 Loading media markers for route:', this.currentRoute.id || this.currentRoute._id);

            const routeId = this.currentRoute.id || this.currentRoute._id;
            if (!routeId) {
                console.warn('❌ No route ID available for media markers');
                return;
            }

            const apiBase = window.apiBase || '/api';
            console.warn('📡 Fetching media from:', `${apiBase}/admin/routes/${routeId}/media`);

            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media`, {
                credentials: 'include'
            });

            console.warn('📡 Media API response status:', response.status, response.statusText);

            if (!response.ok) {
                console.warn('ℹ️ No media found for route or access denied:', response.status);
                return;
            }

            const data = await response.json();
            console.warn('📊 Raw media API response:', data);

            let mediaFiles = [];

            // Handle different response formats
            if (Array.isArray(data)) {
                mediaFiles = data;
            } else if (Array.isArray(data.media)) {
                mediaFiles = data.media;
            } else if (Array.isArray(data.files)) {
                mediaFiles = data.files;
            }

            console.warn(`📊 Found ${mediaFiles.length} media files total`);

            // Filter media items that have location data
            const locatedMedia = mediaFiles.filter(media => {
                // More flexible coordinate detection
                const lat = media.latitude || media.lat || media.coords?.[1] || media.location?.lat || media.position?.lat;
                const lng = media.longitude || media.lng || media.lon || media.coords?.[0] || media.location?.lng || media.position?.lng;
                const hasLocation = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

                console.warn(`📍 Media item location check:`, {
                    mediaId: media.id || media._id,
                    caption: media.caption || media.filename,
                    lat, lng, hasLocation,
                    coordinateFields: {
                        latitude: media.latitude,
                        lat: media.lat,
                        longitude: media.longitude,
                        lng: media.lng,
                        lon: media.lon,
                        coords: media.coords,
                        location: media.location,
                        position: media.position
                    }
                });
                return hasLocation;
            });

            console.warn(`📍 Found ${locatedMedia.length} media items with location data out of ${mediaFiles.length} total`);

            if (locatedMedia.length === 0) {
                console.warn('ℹ️ No media with location data found for this route');
                return;
            }

            console.warn(`📍 Found ${locatedMedia.length} media items with location data`);

            // Also add image media markers to elevation chart overlay
            try {
                const imageOnly = locatedMedia.filter(m => {
                    const t = (m.media_type || '').toLowerCase();
                    const url = m.url || m.path || m.file_path || '';
                    return t === 'image' || t === 'panorama' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
                }).map(m => ({
                    lat: m.latitude || m.lat || m.coords?.[1] || m.location?.lat || m.position?.lat,
                    lng: m.longitude || m.lng || m.lon || m.coords?.[0] || m.location?.lng || m.position?.lng,
                    media_type: ((m.media_type && m.media_type.toLowerCase()) || 'image'),
                    is_pano: m.is_pano === true,
                    url: m.url || m.path || m.file_path || m.full_path || m.original_path || ''
                }));

                if (imageOnly.length) {
                    if (this.elevationChartInstance && this.elevationDataForInteraction && this.elevationDataForInteraction.length) {
                        this.updateElevationMediaMarkers(imageOnly, { onlyImages: true });
                    } else {
                        // Defer until chart is ready
                        this.pendingElevationMediaMarkers = imageOnly;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Could not set elevation media markers:', e);
            }

            // Add media markers to map
            locatedMedia.forEach((media, index) => {
                // Use the same flexible coordinate detection
                const lat = parseFloat(media.latitude || media.lat || media.coords?.[1] || media.location?.lat || media.position?.lat);
                const lng = parseFloat(media.longitude || media.lng || media.lon || media.coords?.[0] || media.location?.lng || media.position?.lng);

                console.warn(`🎯 Creating media marker ${index + 1} at [${lat}, ${lng}]:`, media.caption || media.filename);

                // Create media marker icon
                const mediaMarker = L.marker([lat, lng], {
                    icon: this.createMediaMarkerIcon(media.media_type || 'image', media),
                    title: media.caption || `Medya ${index + 1}`
                }).addTo(this.mapInstance);

                // Create media popup content
                const popupContent = this.createMediaPopupContent(media);
                mediaMarker.bindPopup(popupContent, {
                    maxWidth: 300,
                    minWidth: 250,
                    className: 'media-popup'
                });

                console.warn(`✅ Media marker ${index + 1} created successfully`);
            });

            console.warn('✅ Media markers loaded successfully');

        } catch (error) {
            console.error('❌ Error loading media markers:', error);
        }
    }

    // Create media marker icon
    createMediaMarkerIcon(mediaType, media) {
        const iconSize = [24, 24];
        const iconAnchor = [12, 12];

        // 360° panoramas use a distinct circular marker
        try {
            if ((mediaType && String(mediaType).toLowerCase() === 'panorama') || (media && media.is_pano === true)) {
                return L.divIcon({
                    className: 'pano-marker-wrapper',
                    html: `
                        <div class="pano-marker-circle" aria-label="360 derece panorama işareti">
                            <span class="pano-360">360°</span>
                        </div>
                    `,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                    popupAnchor: [0, -16]
                });
            }
        } catch (_) { /* ignore */ }

        // Define icons and classes for different media types
        const iconMap = {
            'image': { icon: 'fa-camera', cls: 'image' },
            'video': { icon: 'fa-video', cls: 'video' },
            'audio': { icon: 'fa-music', cls: 'audio' },
            'model_3d': { icon: 'fa-cube', cls: 'model_3d' },
            'unknown': { icon: 'fa-file', cls: 'image' }
        };

        const cfg = iconMap[mediaType] || iconMap.unknown;

        // Create HTML for the marker using Font Awesome icons
        const html = `<div class="media-marker ${cfg.cls}"><i class="fas ${cfg.icon}"></i></div>`;

        return L.divIcon({
            html: html,
            className: '',
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: [0, -12]
        });
    }

    // Create media popup content
    createMediaPopupContent(media) {
        console.warn('🎬 Creating media popup content for:', media);

        // Get raw media URL
        const rawMediaUrl = media.url || media.path || media.filename || '';
        const caption = media.caption || media.alt_text || 'Medya';
        const mediaType = media.media_type || 'image';

        console.warn('🎬 Media popup details:', {
            rawMediaUrl,
            url: media.url,
            path: media.path,
            thumbnail_path: media.thumbnail_path,
            file_path: media.file_path,
            filename: media.filename,
            caption,
            mediaType,
            mediaKeys: Object.keys(media)
        });

        if (!rawMediaUrl) {
            console.warn('❌ No media URL found for media item');
            return `
                <div class="media-popup-content" style="font-family: 'Segoe UI', sans-serif; max-width: 250px;">
                    <div class="media-info">
                        <h6 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${caption}</h6>
                        <p style="margin: 0; font-size: 12px; color: #666;">Medya dosyası bulunamadı</p>
                    </div>
                </div>
            `;
        }

        // Construct proper media URL
        let mediaUrl = rawMediaUrl;
        if (mediaUrl && !mediaUrl.startsWith('http')) {
            // Try different URL patterns based on common media serving approaches
            if (media.thumbnail_path) {
                mediaUrl = `/${media.thumbnail_path}`;
            } else if (media.file_path) {
                mediaUrl = `/${media.file_path}`;
            } else if (media.path) {
                mediaUrl = media.path.startsWith('/') ? media.path : `/${media.path}`;
            } else if (media.filename) {
                // For files served from root domain (like the error shows)
                mediaUrl = `/${media.filename}`;
            } else {
                // Last resort - serve from uploads directory
                mediaUrl = `/uploads/${mediaUrl}`;
            }
        }

        console.warn('🎬 Final media popup URL:', mediaUrl);

        let mediaPreview = '';
        if (mediaType === 'image') {
            mediaPreview = `<img src="${mediaUrl}" alt="${caption}" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="console.error('Failed to load image:', '${mediaUrl}')">`;
        } else if (mediaType === 'video') {
            mediaPreview = `<video src="${mediaUrl}" controls style="width: 100%; max-height: 150px; border-radius: 4px; margin-bottom: 8px;" onerror="console.error('Failed to load video:', '${mediaUrl}')"></video>`;
        } else if (mediaType === 'audio') {
            mediaPreview = `<audio src="${mediaUrl}" controls style="width: 100%; margin-bottom: 8px;" onerror="console.error('Failed to load audio:', '${mediaUrl}')"></audio>`;
        } else {
            mediaPreview = `<div style="width: 100%; height: 100px; background: #f3f4f6; border-radius: 4px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-file" style="font-size: 24px; color: #9ca3af;"></i></div>`;
        }

        return `
            <div class="media-popup-content" style="font-family: 'Segoe UI', sans-serif; max-width: 250px;">
                ${mediaPreview}
                <div class="media-info">
                    <h6 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${caption}</h6>
                    <p style="margin: 0; font-size: 12px; color: #666; text-transform: capitalize;">${mediaType} • Rota Medyası</p>
                </div>
            </div>
        `;
    }

    // Helper methods
    handleKeydown(event) {
        if (!this.isVisible) return;
        if (event.key === 'Escape') {
            this.hide();
            return;
        }
        const tabs = ['overview', 'map', 'pois', 'media'];
        const idx = tabs.indexOf(this.currentTab);
        if (event.key === 'ArrowRight' && idx < tabs.length - 1) {
            this.switchTab(tabs[idx + 1]);
        } else if (event.key === 'ArrowLeft' && idx > 0) {
            this.switchTab(tabs[idx - 1]);
        } else if (/^[1-4]$/.test(event.key)) {
            const target = tabs[parseInt(event.key, 10) - 1];
            if (target) this.switchTab(target);
        }
    }

    handleBackdropClick(event) {
        if (event.target === this.modal) {
            this.hide();
        }
    }

    focusOnPoi(lat, lng) {
        console.warn('🎯 Focusing on POI at:', lat, lng);

        if (this.mapInstance) {
            this.switchTab('map');
            setTimeout(() => {
                if (lat && lng) {
                    console.warn('✅ Setting map view to:', [lat, lng]);
                    this.mapInstance.setView([lat, lng], 16);
                } else {
                    console.warn('❌ Invalid coordinates for focusOnPoi:', lat, lng);
                }
            }, 300);
        } else {
            console.warn('❌ Map instance not available for focusOnPoi');
        }
    }

    fitMapToRoute(force = false) {
        // Avoid repeated refits or overriding user intention
        if (this.userHasInteracted && !force) {
            return;
        }
        if (this.hasFittedBounds && !force) {
            return;
        }

        console.warn('🔄 Fitting map to route', { force, hasFittedBounds: this.hasFittedBounds, userHasInteracted: this.userHasInteracted });

        if (!this.mapInstance) {
            console.error('❌ No map instance available');
            return;
        }

        // Invalidate size first to ensure proper rendering
        this.mapInstance.invalidateSize();

        const markers = [];
        const polylines = [];

        this.mapInstance.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            } else if (layer instanceof L.Polyline) {
                polylines.push(layer);
            }
        });

        console.warn(`📍 Found ${markers.length} markers and ${polylines.length} polylines on map`);

        // Collect all layers for bounds calculation
        const allLayers = [...markers, ...polylines];

        if (allLayers.length > 0) {
            try {
                const group = new L.featureGroup(allLayers);
                const bounds = group.getBounds();

                // Check if bounds are valid
                if (bounds.isValid()) {
                    console.warn('🎯 Fitting to bounds:', bounds);

                    // Use different padding for mobile vs desktop
                    const isMobile = window.innerWidth <= 768;
                    const padding = isMobile ? [10, 10] : [20, 20];

                    this.mapInstance.fitBounds(bounds, {
                        padding: padding,
                        maxZoom: 16 // Prevent zooming too close
                    });
                    console.warn('✅ Map fitted to route successfully');
                    this.hasFittedBounds = true;
                } else {
                    console.warn('⚠️ Invalid bounds, using default view');
                    this.mapInstance.setView([38.6431, 34.8286], 12);
                    this.hasFittedBounds = true;
                }
            } catch (error) {
                console.error('❌ Error fitting bounds:', error);
                this.mapInstance.setView([38.6431, 34.8286], 12);
                this.hasFittedBounds = true;
            }
        } else {
            console.warn('⚠️ No markers or polylines found to fit to, using default view');
            this.mapInstance.setView([38.6431, 34.8286], 12);
            this.hasFittedBounds = true;
        }
    }

    toggleFullscreenMap() {
        console.warn('🔄 Toggling fullscreen map');

        const modalContent = document.querySelector('.route-details-modal-content');
        const modal = document.getElementById('routeDetailsModal');

        if (!modalContent || !modal) {
            console.error('❌ Modal elements not found for fullscreen');
            return;
        }

        // Check if already in fullscreen
        if (document.fullscreenElement) {
            // Exit fullscreen
            document.exitFullscreen().then(() => {
                console.warn('✅ Exited fullscreen mode');
                modalContent.style.position = '';
                modalContent.style.width = '';
                modalContent.style.height = '';
                modalContent.style.zIndex = '';
            }).catch(err => {
                console.error('❌ Error exiting fullscreen:', err);
            });
        } else {
            // Enter fullscreen
            modalContent.requestFullscreen().then(() => {
                console.warn('✅ Entered fullscreen mode');
                modalContent.style.position = 'fixed';
                modalContent.style.width = '100vw';
                modalContent.style.height = '100vh';
                modalContent.style.zIndex = '9999';
                modalContent.style.top = '0';
                modalContent.style.left = '0';
            }).catch(err => {
                console.error('❌ Error entering fullscreen:', err);
                // Fallback: try to make it fullscreen-like
                this.fallbackFullscreen(modalContent);
            });
        }
    }

    fallbackFullscreen(modalContent) {
        console.warn('🔄 Using fallback fullscreen mode');

        // Fallback for browsers that don't support fullscreen API
        modalContent.style.position = 'fixed';
        modalContent.style.width = '100vw';
        modalContent.style.height = '100vh';
        modalContent.style.zIndex = '9999';
        modalContent.style.top = '0';
        modalContent.style.left = '0';
        modalContent.style.background = 'white';

        // Add escape key listener for fallback
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modalContent.style.position = '';
                modalContent.style.width = '';
                modalContent.style.height = '';
                modalContent.style.zIndex = '';
                modalContent.style.background = '';
                document.removeEventListener('keydown', escapeHandler);
                console.warn('✅ Exited fallback fullscreen mode');
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    startNavigation() {
        if (!this.currentRoute) return;

        const route = this.currentRoute;

        // 1) Prefer geometry start [lng, lat]
        let startLat = undefined, startLng = undefined;
        if (route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length) {
            const first = route.geometry.coordinates[0];
            if (Array.isArray(first) && first.length >= 2) {
                startLng = parseFloat(first[0]);
                startLat = parseFloat(first[1]);
            }
        }

        // 2) Fallback to elevation profile first point
        if ((!Number.isFinite(startLat) || !Number.isFinite(startLng)) && route.elevation_profile && Array.isArray(route.elevation_profile.points) && route.elevation_profile.points.length) {
            const p = route.elevation_profile.points[0];
            startLat = parseFloat(p.lat ?? p.latitude);
            startLng = parseFloat(p.lng ?? p.longitude ?? p.lon);
        }

        // 3) Fallback to POIs or waypoints
        if ((!Number.isFinite(startLat) || !Number.isFinite(startLng))) {
            const pois = route.pois || route.waypoints || [];
            if (pois.length) {
                const f = pois[0];
                startLat = parseFloat(f.latitude ?? f.lat);
                startLng = parseFloat(f.longitude ?? f.lng ?? f.lon);
            }
        }

        if (!Number.isFinite(startLat) || !Number.isFinite(startLng)) {
            alert('Rota başlangıç konumu bulunamadı.');
            return;
        }

        // Choose travel mode based on route type
        const type = (route.route_type || route.type || '').toLowerCase();
        let travelMode = 'walking';
        if (type.includes('drive') || type.includes('car') || type.includes('araba')) travelMode = 'driving';
        else if (type.includes('bike') || type.includes('cycle') || type.includes('bisik')) travelMode = 'bicycling';
        else if (type.includes('transit') || type.includes('otob')) travelMode = 'transit';

        // Build Google Maps Directions link.
        // Omitting origin lets Google use current location on mobile/desktop.
        const lat = startLat.toFixed(6);
        const lng = startLng.toFixed(6);
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${encodeURIComponent(travelMode)}&dir_action=navigate`;

        window.open(googleMapsUrl, '_blank');
    }

    exportRoute() {
        console.warn('Export route');
        // Implementation for route export
    }

    shareRoute() {
        try {
            if (!this.currentRoute) {
                console.warn('❌ No route to share');
                try { (window.showNotification || window.notificationSystem?.show)?.('Paylaşılacak rota bulunamadı', 'warning'); } catch (_) {}
                return;
            }

            const route = this.currentRoute;
            const title = route.name || 'Ürgüp Rotası';
            const text = `"${title}" rotasını keşfet!`;

            // Prefer deep link by routeId when available (supported by predefined_routes.html)
            const routeId = route.id || route._id;

            // Decide base URL: use current predefined page if already there; otherwise fallback to predefined_routes.html
            const isOnPredefinedPage = typeof window !== 'undefined' && window.location?.pathname?.includes('predefined_routes');
            // Preserve current directory for correct sub-paths
            const currentDir = (() => {
                const p = window.location.pathname || '/';
                if (p.endsWith('/')) return p;
                const idx = p.lastIndexOf('/');
                return idx >= 0 ? p.substring(0, idx + 1) : '/';
            })();
            const baseUrl = isOnPredefinedPage
                ? `${window.location.origin}${window.location.pathname}`
                : `${window.location.origin}${currentDir}predefined_routes.html`;

            let shareUrl = baseUrl;

            if (routeId) {
                shareUrl = `${baseUrl}?routeId=${encodeURIComponent(String(routeId))}`;
            } else {
                // Fallback: encode minimal route data into URL (may not be auto-consumed yet, but still useful)
                try {
                    const pois = (route.pois || route.waypoints || []).map(p => ({
                        id: p.id || p._id,
                        name: p.name,
                        latitude: p.latitude || p.lat,
                        longitude: p.longitude || p.lng || p.lon,
                        category: p.category
                    }));
                    const data = { name: title, pois };
                    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
                    // Prefer dynamic routes page if present; otherwise stick to current page
                    const dynamicPage = `${window.location.origin}/poi_recommendation_system.html`;
                    shareUrl = `${dynamicPage}?route=${encoded}`;
                } catch (e) {
                    console.warn('⚠️ Could not encode fallback route data:', e);
                    shareUrl = `${window.location.origin}${window.location.pathname}`;
                }
            }

            const notify = (msg, type = 'info') => {
                try {
                    // Try shared notifier if available
                    if (typeof window.showNotification === 'function') return window.showNotification(msg, type);
                    if (window.notificationSystem?.show) return window.notificationSystem.show(msg, type);
                } catch (_) { /* noop */ }
                // Minimal fallback
                if (type === 'error') {
                    console.error(msg);
                } else {
                    console.log(msg);
                }
            };

            // Try Web Share API first
            if (navigator.share && (!navigator.canShare || navigator.canShare({ url: shareUrl }))) {
                navigator.share({ title, text, url: shareUrl })
                    .then(() => notify('Rota başarıyla paylaşıldı', 'success'))
                    .catch(err => {
                        if (err && err.name === 'AbortError') return; // user cancelled
                        console.warn('Web Share failed, falling back to clipboard:', err);
                        if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(shareUrl)
                                .then(() => notify('Rota linki panoya kopyalandı', 'success'))
                                .catch(() => {
                                    window.prompt('Rota linkini kopyalayın:', shareUrl);
                                });
                        } else {
                            window.prompt('Rota linkini kopyalayın:', shareUrl);
                        }
                    });
                return;
            }

            // Fallback to clipboard copy
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(shareUrl)
                    .then(() => notify('Rota linki panoya kopyalandı', 'success'))
                    .catch(() => {
                        window.prompt('Rota linkini kopyalayın:', shareUrl);
                    });
            } else {
                window.prompt('Rota linkini kopyalayın:', shareUrl);
            }
        } catch (error) {
            console.error('❌ Error in shareRoute:', error);
            try { (window.showNotification || window.notificationSystem?.show)?.('Paylaşım sırasında hata oluştu', 'error'); } catch (_) {}
        }
    }

    // Initialize elevation chart using Chart.js
    async initializeElevationChart() {
        if (!this.currentRoute) {
            console.warn('❌ Cannot initialize elevation chart - no route data');
            return;
        }

        console.warn('🏔️ Attempting to initialize elevation chart...');

        const container = document.getElementById('routeModalElevationContainer');
        if (!container) {
            console.error('❌ Elevation chart container not found');
            console.warn('🔍 Available elements with "elevation" in ID:',
                Array.from(document.querySelectorAll('[id*="elevation"]')).map(el => el.id));
            return;
        }

        console.warn('✅ Elevation chart container found:', container);

        try {
            console.warn('🗺️ Initializing elevation chart for route details modal');

            // Clear any existing content
            container.innerHTML = '';

            // Create the elevation chart structure only (no title or stats)
            container.innerHTML = `
                <div class="elevation-chart-section">
                    <div class="elevation-chart-container">
                        <div class="elevation-top-value" id="modalElevationTopValue" style="display:none">-- m</div>
                        <canvas id="modalElevationChart" width="800" height="280"></canvas>
                        <div class="elevation-overlay-layer" id="modalElevationOverlayLayer"></div>
                    </div>
                </div>
            `;

            console.warn('✅ Elevation chart HTML structure created successfully');

            // Wait for DOM to update before loading elevation data
            setTimeout(async () => {
                console.warn('🏔️ DOM updated, checking for canvas...');
                const canvas = document.getElementById('modalElevationChart');
                console.warn('🏔️ Canvas found:', !!canvas);

                // ULTRA AGGRESSIVE mobile canvas sizing
                const isMobile = window.innerWidth <= 768;
                if (canvas && isMobile) {
                    // Keep the elevation chart compact on mobile
                    const canvasContainer = canvas.closest('.elevation-chart-container');
                    const chartSection = canvas.closest('.elevation-chart-section');

                    if (chartSection) {
                        chartSection.style.cssText = `
                            width: 100% !important;
                            display: block !important;
                            margin: 8px 0 !important;
                            padding: 10px !important;
                        `;
                    }

                    if (canvasContainer) {
                        canvasContainer.style.cssText = `
                            width: 100% !important;
                            height: auto !important;
                            min-height: 0 !important;
                            display: block !important;
                            position: relative !important;
                        `;
                    }

                    canvas.style.cssText = `
                        width: 100% !important;
                        height: 110px !important;
                        max-width: 100% !important;
                        display: block !important;
                        margin: 0 !important;
                        border: 0 !important;
                        border-radius: 4px !important;
                    `;

                    // Let Chart.js manage resolution; avoid forcing attrs here
                    canvas.removeAttribute('width');
                    canvas.removeAttribute('height');
                }

                if (canvas) {
                    console.warn('🏔️ Canvas details:', {
                        id: canvas.id,
                        width: canvas.width,
                        height: canvas.height,
                        offsetWidth: canvas.offsetWidth,
                        offsetHeight: canvas.offsetHeight
                    });
                }
                // Attach elevation toolbar handlers
                this.attachElevationToolbarHandlers();
                await this.loadElevationProfile();
            }, 100);

        } catch (error) {
            console.error('❌ Error initializing elevation chart:', error);
            container.innerHTML = `
                <div class="route-overview-section">
                    <h3><i class="fas fa-mountain"></i> Yükseklik Profili</h3>
                    <div class="elevation-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Yükseklik profili yüklenirken hata oluştu</span>
                    </div>
                </div>
            `;
        }
    }

    async loadElevationProfile() {
        if (!this.currentRoute) {
            console.warn('❌ Cannot load elevation profile - missing route data');
            return;
        }

        try {
            console.warn('🗺️ Loading elevation profile for route:', this.currentRoute.name);

            // Wait for canvas to be available with retry mechanism
            let canvas = document.getElementById('modalElevationChart');
            let retries = 0;
            const maxRetries = 20;

            while (!canvas && retries < maxRetries) {
                console.warn(`🔄 Waiting for elevation canvas... attempt ${retries + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 150));
                canvas = document.getElementById('modalElevationChart');
                retries++;
            }

            if (!canvas) {
                console.error('❌ Elevation chart canvas not found after retries');
                return;
            }

            // Ensure only a single canvas exists inside the container
            try {
                const cont = document.querySelector('#routeModalElevationContainer .elevation-chart-container');
                if (cont) {
                    const list = cont.querySelectorAll('canvas');
                    if (list.length > 1) {
                        for (let i = 1; i < list.length; i++) {
                            list[i].remove();
                        }
                    }
                }
            } catch (_) { /* ignore */ }

            console.warn('✅ Elevation canvas found, proceeding with chart creation');

            const ctx = canvas.getContext('2d');

            // Generate elevation data
            let elevationData = [];

            if (this.currentRoute.elevation_profile) {
                console.warn('✅ Using pre-calculated elevation profile');
                // Normalize DB distances (meters) to km for the chart
                const points = this.currentRoute.elevation_profile.points || [];
                elevationData = points.map(p => {
                    const rawDist = (p.distance !== undefined ? p.distance : p.dist);
                    const distNum = typeof rawDist === 'number' ? rawDist : parseFloat(rawDist);
                    const latRaw = (p.lat !== undefined ? p.lat : p.latitude);
                    const lngRaw = (p.lng !== undefined ? p.lng : (p.longitude ?? p.lon));
                    const latNum = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
                    const lngNum = typeof lngRaw === 'number' ? lngRaw : parseFloat(lngRaw);
                    return {
                        distance: isNaN(distNum) ? 0 : (distNum / 1000),
                        elevation: p.elevation,
                        lat: latNum,
                        lng: lngNum,
                        name: p.name || null
                    };
                });
                // Sanitize series: remove invalids, sort, ensure monotonicity
                elevationData = this._sanitizeElevationData(elevationData);
            } else {
                console.warn('🔄 Generating elevation data from route');
                elevationData = await this.generateElevationData();
            }

            if (!elevationData || elevationData.length === 0) {
                console.warn('⚠️ No elevation data available, creating fallback data');
                // Create fallback elevation data based on route distance
                const distance = this.currentRoute.total_distance || 10;
                const points = Math.max(10, Math.min(50, Math.floor(distance)));

                elevationData = [];
                for (let i = 0; i < points; i++) {
                    const progress = i / (points - 1);
                    const distanceKm = distance * progress;
                    // Simulate elevation for Cappadocia region (1000-1400m)
                    const baseElevation = 1200;
                    const variation = Math.sin(progress * Math.PI * 2) * 100 + Math.random() * 50;
                    const elevation = baseElevation + variation;

                    elevationData.push({
                        // Keep distance in km throughout Chart.js usage
                        distance: distanceKm,
                        elevation: elevation,
                        lat: 38.6431 + (Math.random() - 0.5) * 0.1,
                        lng: 34.8286 + (Math.random() - 0.5) * 0.1,
                        name: i === 0 ? 'Başlangıç' : i === points - 1 ? 'Bitiş' : null
                    });
                }
                console.warn(`✅ Created ${elevationData.length} fallback elevation points`);
            }

            // Optionally extend last point to route end if there is a small gap
            try {
                const routeKm = this._estimateRouteTotalKm(elevationData);
                if (typeof routeKm === 'number' && elevationData.length > 0) {
                    const maxKm = Math.max(...elevationData.map(d => d.distance || 0));
                    const gap = routeKm - maxKm;
                    // Only extend when the gap is small (50m–300m) to avoid misleading long tails
                    if (gap > 0.05 && gap <= 0.3) {
                        const last = elevationData[elevationData.length - 1];
                        elevationData.push({
                            distance: routeKm,
                            elevation: last.elevation,
                            lat: last.lat,
                            lng: last.lng,
                            name: last.name || 'Bitiş'
                        });
                    }
                }
            } catch (_) { /* ignore */ }

            // Create Chart.js elevation chart
            await this.createElevationChart(ctx, elevationData);

            // If media markers were fetched earlier, apply them now
            if (this.pendingElevationMediaMarkers && this.pendingElevationMediaMarkers.length) {
                this.updateElevationMediaMarkers(this.pendingElevationMediaMarkers, { onlyImages: true });
                this.pendingElevationMediaMarkers = null;
            }

            // If POIs were queued before chart readiness, apply them now
            if (this.pendingElevationPoiMarkers && this.pendingElevationPoiMarkers.length) {
                this.updateElevationPoiMarkers(this.pendingElevationPoiMarkers);
                this.pendingElevationPoiMarkers = null;
            }

            // Also map POIs/waypoints onto the elevation chart
            try {
                const pois = (this.currentRoute && (this.currentRoute.pois || this.currentRoute.waypoints)) || [];
                if (pois && pois.length) {
                    this.updateElevationPoiMarkers(pois);
                }
            } catch (_) { /* ignore */ }

            console.warn('✅ Elevation profile loaded successfully');

        } catch (error) {
            console.error('❌ Error loading elevation profile:', error);
            this.showElevationError('Yükseklik profili yüklenirken hata oluştu');
        }
    }

    async generateElevationData() {
        const route = this.currentRoute;
        const elevationData = [];

        try {
            // Use geometry coordinates if available
            if (route.geometry && route.geometry.coordinates) {
                const coordinates = route.geometry.coordinates;
                let totalDistance = 0;

                for (let i = 0; i < coordinates.length; i++) {
                    const [lng, lat] = coordinates[i];

                    // Calculate cumulative distance
                    if (i > 0) {
                        const prevCoord = coordinates[i - 1];
                        const distance = this.calculateDistance(prevCoord[1], prevCoord[0], lat, lng);
                        totalDistance += distance;
                    }

                    // Generate simulated elevation for Cappadocia region
                    const elevation = this.generateSimulatedElevation(lat, lng);

                    elevationData.push({
                        distance: totalDistance,
                        elevation: elevation,
                        lat: lat,
                        lng: lng,
                        name: i === 0 ? 'Başlangıç' : i === coordinates.length - 1 ? 'Bitiş' : null
                    });
                }
            }
            // Use POIs if no geometry
            else if (route.pois && route.pois.length > 0) {
                let totalDistance = 0;

                for (let i = 0; i < route.pois.length; i++) {
                    const poi = route.pois[i];
                    const lat = poi.latitude || poi.lat;
                    const lng = poi.longitude || poi.lng;

                    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                        // Calculate cumulative distance
                        if (i > 0) {
                            const prevPoi = route.pois[i - 1];
                            const prevLat = prevPoi.latitude || prevPoi.lat;
                            const prevLng = prevPoi.longitude || prevPoi.lng;

                            if (prevLat && prevLng) {
                                const distance = this.calculateDistance(prevLat, prevLng, lat, lng);
                                totalDistance += distance;
                            }
                        }

                        const elevation = this.generateSimulatedElevation(lat, lng);

                        elevationData.push({
                            distance: totalDistance,
                            elevation: elevation,
                            lat: parseFloat(lat),
                            lng: parseFloat(lng),
                            name: poi.name
                        });
                    }
                }
            }
            // Use waypoints if available
            else if (route.waypoints && route.waypoints.length > 0) {
                let totalDistance = 0;

                for (let i = 0; i < route.waypoints.length; i++) {
                    const waypoint = route.waypoints[i];
                    const lat = waypoint.latitude || waypoint.lat;
                    const lng = waypoint.longitude || waypoint.lng;

                    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                        // Calculate cumulative distance
                        if (i > 0) {
                            const prevWaypoint = route.waypoints[i - 1];
                            const prevLat = prevWaypoint.latitude || prevWaypoint.lat;
                            const prevLng = prevWaypoint.longitude || prevWaypoint.lng;

                            if (prevLat && prevLng) {
                                const distance = this.calculateDistance(prevLat, prevLng, lat, lng);
                                totalDistance += distance;
                            }
                        }

                        const elevation = this.generateSimulatedElevation(lat, lng);

                        elevationData.push({
                            distance: totalDistance,
                            elevation: elevation,
                            lat: parseFloat(lat),
                            lng: parseFloat(lng),
                            name: waypoint.name || `Durak ${i + 1}`
                        });
                    }
                }
            }

            console.warn('📊 Generated elevation data points:', elevationData.length);
            return elevationData;

        } catch (error) {
            console.error('❌ Error generating elevation data:', error);
            return [];
        }
    }

    generateSimulatedElevation(lat, lng) {
        // Simulate realistic elevation for Cappadocia region
        const baseElevation = 1000; // Base elevation for Cappadocia
        const variation = Math.sin(lat * 100) * Math.cos(lng * 100) * 200;
        const noise = (Math.random() - 0.5) * 50;

        return Math.round(baseElevation + variation + noise);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    async createElevationChart(ctx, elevationData) {
        // Destroy existing chart if it exists
        if (this.elevationChartInstance) {
            this.elevationChartInstance.destroy();
        }

        // Prepare chart data
        const labels = elevationData.map(d => {
            if (d.distance === 0) return 'Başlangıç';
            return `${(d.distance).toFixed(2)}km`;
        });

        const elevations = elevationData.map(d => d.elevation);
        const names = elevationData.map(d => d.name || `Nokta ${elevationData.indexOf(d) + 1}`);

        // Set canvas dimensions
        const canvas = document.getElementById('modalElevationChart');
        canvas.width = 400;
        canvas.height = 120;
        canvas.style.width = '100%';
        canvas.style.height = '120px';

        // Estimate full route distance (km) from metadata (for labels only)
        const routeTotalKm = this._estimateRouteTotalKm(elevationData);
        // Data-driven max distance (km) to clamp the axis so it doesn't extend to a "nice" 15km when data ends at ~12km
        const dataMaxKm = Math.max(...elevationData.map(d => d.distance || 0));

        // Create Chart.js chart
        const self = this;

        // Make elevation data available for plugins/hit-testing before chart render
        this.elevationDataForInteraction = elevationData;

        // Chart-level plugin to draw media markers on top of the elevation line
        const mediaMarkersPlugin = {
            id: 'modalMediaMarkers',
            afterDatasetsDraw(chart) {
                try {
                    // Draw drag selection overlay
                    if (self.elevZoomEnabled && self._elevDragStart != null && self._elevMouseX != null) {
                        const area = chart.chartArea;
                        const ctx = chart.ctx;
                        const x1 = Math.min(self._elevDragStart, self._elevMouseX);
                        const x2 = Math.max(self._elevDragStart, self._elevMouseX);
                        const left = Math.max(area.left, x1);
                        const right = Math.min(area.right, x2);
                        ctx.save();
                        ctx.fillStyle = 'rgba(59,130,246,0.15)';
                        ctx.fillRect(left, area.top, Math.max(0, right - left), area.bottom - area.top);
                        ctx.restore();
                    }

                    // Crosshair line + metric labels (distance bottom, elevation top)
                    if (self._elevMouseX != null) {
                        const area = chart.chartArea;
                        const ctx = chart.ctx;
                        const x = Math.max(area.left, Math.min(area.right, self._elevMouseX));
                        ctx.save();
                        ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(x + 0.5, area.top);
                        ctx.lineTo(x + 0.5, area.bottom);
                        ctx.stroke();

                        // Find nearest data point by distance for label values
                        const xScale = chart.scales.x;
                        const yScale = chart.scales.y;
                        if (xScale && yScale && Array.isArray(self.elevationDataForInteraction)) {
                            const distAtX = xScale.getValueForPixel(x);
                            let nearest = null, minDiff = Infinity, nearestIndex = 0;
                            self.elevationDataForInteraction.forEach((p, i) => {
                                const d = Math.abs((p.distance || 0) - distAtX);
                                if (d < minDiff) { minDiff = d; nearest = p; nearestIndex = i; }
                            });

                            if (nearest) {
                                const px = x;
                                const py = chart.getDatasetMeta(0)?.data?.[nearestIndex]?.y ?? yScale.getPixelForValue(nearest.elevation);

                                // Bottom distance label (blue capsule)
                                const distLabel = `${(nearest.distance || 0).toFixed(1)} km`;
                                const padX = 6, padY = 3;
                                ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                const w = ctx.measureText(distLabel).width + padX * 2;
                                const h = 18;
                                const bx = Math.max(area.left + w / 2 + 2, Math.min(area.right - w / 2 - 2, px));
                                const by = Math.min(area.bottom - h / 2 - 2, area.bottom - 10);
                                ctx.fillStyle = '#2563eb';
                                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                const r = 6;
                                // rounded rect
                                ctx.moveTo(bx - w/2 + r, by - h/2);
                                ctx.lineTo(bx + w/2 - r, by - h/2);
                                ctx.quadraticCurveTo(bx + w/2, by - h/2, bx + w/2, by - h/2 + r);
                                ctx.lineTo(bx + w/2, by + h/2 - r);
                                ctx.quadraticCurveTo(bx + w/2, by + h/2, bx + w/2 - r, by + h/2);
                                ctx.lineTo(bx - w/2 + r, by + h/2);
                                ctx.quadraticCurveTo(bx - w/2, by + h/2, bx - w/2, by + h/2 - r);
                                ctx.lineTo(bx - w/2, by - h/2 + r);
                                ctx.quadraticCurveTo(bx - w/2, by - h/2, bx - w/2 + r, by - h/2);
                                ctx.closePath();
                                ctx.fill();
                                ctx.stroke();
                                ctx.fillStyle = '#ffffff';
                                ctx.fillText(distLabel, bx, by + 0.5);

                                // Update DOM top label outside the canvas
                                try {
                                    const topEl = document.getElementById('modalElevationTopValue');
                                    if (topEl) {
                                        topEl.style.display = 'block';
                                        topEl.textContent = `${Math.round(nearest.elevation)} m`;
                                        const cont = chart.canvas.parentElement;
                                        const contRect = cont.getBoundingClientRect();
                                        const canvasRect = chart.canvas.getBoundingClientRect();
                                        // x is relative to canvas; convert to container and center via translateX(-50%)
                                        const left = canvasRect.left + px - contRect.left;
                                        // Clamp inside container bounds a bit
                                        const clamped = Math.max(8, Math.min(contRect.width - 8, left));
                                        topEl.style.left = clamped + 'px';
                                    }
                                } catch (_) { /* ignore */ }
                            }
                        }
                        // Draw small blue selection dot at nearest point
                        try {
                            const xScale = chart.scales.x;
                            const distAtX2 = xScale ? xScale.getValueForPixel(x) : null;
                            if (distAtX2 != null && Array.isArray(self.elevationDataForInteraction)) {
                                let nearest2 = null, min2 = Infinity, idx2 = 0;
                                self.elevationDataForInteraction.forEach((p, i) => {
                                    const d = Math.abs((p.distance || 0) - distAtX2);
                                    if (d < min2) { min2 = d; nearest2 = p; idx2 = i; }
                                });
                                const py2 = chart.getDatasetMeta(0)?.data?.[idx2]?.y ?? chart.scales.y.getPixelForValue(nearest2.elevation);
                                ctx.beginPath();
                                ctx.arc(x + 0.5, py2, 4, 0, Math.PI * 2);
                                ctx.fillStyle = '#0ea5e9';
                                ctx.strokeStyle = '#ffffff';
                                ctx.lineWidth = 2;
                                ctx.fill();
                                ctx.stroke();
                            }
                        } catch (_) {}
                        ctx.restore();
                    }

                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data) return;
                    const distances = (self.elevationDataForInteraction || []).map(d => d.distance);

                    // Position POI icons as DOM overlays matching their map icons
                    const poiScreen = [];
                    if (Array.isArray(self.elevationPoiOverlayPoints) && self.elevationPoiOverlayPoints.length) {
                        const positions = [];
                        self.elevationPoiOverlayPoints.forEach(poi => {
                            let nearestIndex = 0;
                            let minDiff = Infinity;
                            for (let i = 0; i < distances.length; i++) {
                                const diff = Math.abs(distances[i] - poi.distance);
                                if (diff < minDiff) { minDiff = diff; nearestIndex = i; }
                            }
                            const pt = meta.data[nearestIndex];
                            if (!pt) return;
                            const x = pt.x;
                            const y = pt.y - 6;
                            positions.push({ x, y, poi: poi.poi });
                            poiScreen.push({ x, y, poi: poi.poi });
                        });
                        self.updateElevationPoiDom(positions, chart);
                        self.elevationPoiScreenPoints = poiScreen;
                    } else {
                        self.elevationPoiScreenPoints = [];
                        self.updateElevationPoiDom([], chart);
                    }

                    // Draw media markers
                    if (!self.showElevationMediaMarkers || !self.elevationMediaOverlayPoints || self.elevationMediaOverlayPoints.length === 0) {
                        self.elevationMediaScreenPoints = [];
                        return;
                    }
                    const screenPoints = [];
                    const mediaPositions = [];
                    self.elevationMediaOverlayPoints.forEach((mp) => {
                        let nearestIndex = 0;
                        let minDiff = Infinity;
                        for (let i = 0; i < distances.length; i++) {
                            const diff = Math.abs(distances[i] - mp.distance);
                            if (diff < minDiff) { minDiff = diff; nearestIndex = i; }
                        }
                        const pt = meta.data[nearestIndex];
                        if (!pt) return;
                        const x = pt.x;
                        const y = pt.y - 12;
                        const type = (mp.media && (mp.media.media_type || (mp.media.url||mp.media.path))) ? self.getMediaTypeFromUrl(mp.media.url || mp.media.path || '') : 'image';
                        screenPoints.push({ x, y, media: mp.media, type });
                        mediaPositions.push({ x, y, media: mp.media, type });
                    });
                    self.elevationMediaScreenPoints = screenPoints;
                    self.updateElevationMediaDom(mediaPositions, chart);
                } catch (e) {
                    console.warn('mediaMarkersPlugin draw error:', e);
                }
            }
        };

        this.elevationChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Yükseklik (m)',
                    data: elevationData.map(d => ({ x: d.distance, y: d.elevation })),
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    backgroundColor: (c) => {
                        const area = c.chart && c.chart.chartArea;
                        if (!area) return 'rgba(34, 197, 94, 0.25)';
                        const g = c.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
                        g.addColorStop(0, 'rgba(163, 230, 53, 0.45)');   // green-400
                        g.addColorStop(1, 'rgba(34, 197, 94, 0.15)');   // green-500
                        return g;
                    },
                    fill: true,
                    spanGaps: true,
                    tension: 0.25,
                    pointBackgroundColor: '#fde047', // yellow points
                    pointBorderColor: '#a16207',
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 8,
                        bottom: 6,
                        left: 0,
                        right: 0
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest',
                    axis: 'x'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        min: 0,
                        max: dataMaxKm,
                        title: {
                            display: false
                        },
                        ticks: { display: false },
                        grid: { display: false },
                        border: { display: false },
                        offset: false,
                        bounds: 'ticks'
                    },
                    y: {
                        display: true,
                        title: {
                            display: false
                        },
                        ticks: { display: false },
                        grid: { display: false },
                        border: { display: false },
                        offset: false,
                        bounds: 'ticks'
                    }
                }
            },
            plugins: [mediaMarkersPlugin]
        });

        // Store elevation data for mouse interaction (ensure set)
        this.elevationDataForInteraction = elevationData;

        // Add mouse event handlers for map synchronization
        this.addChartMouseHandlers(canvas, elevationData);

        // Bridge overlay events to canvas so hover/click still work when not on icons
        try {
            const overlay = document.getElementById('modalElevationOverlayLayer');
            if (overlay) {
                const relay = (type) => (e) => {
                    // If clicked on an icon, its handler will run; only relay when target is the overlay background
                    if (e.target !== overlay) return;
                    const evt = new MouseEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    canvas.dispatchEvent(evt);
                };
                overlay.addEventListener('mousemove', relay('mousemove'));
                overlay.addEventListener('mouseleave', relay('mouseleave'));
                overlay.addEventListener('click', relay('click'));
            }
        } catch (_) { /* ignore */ }

        // Update statistics
        this.updateElevationStats(elevationData, routeTotalKm);

        console.warn('✅ Chart.js elevation chart created successfully');
    }

    addChartMouseHandlers(canvas, elevationData) {
        let isHovering = false;

        const handleMouseMove = (event) => {
            if (!this.mapInstance || !elevationData.length) return;

            // Throttle mouse move events to prevent modal jitter
            const now = Date.now();
            if (this.lastElevationMouseMoveTime && now - this.lastElevationMouseMoveTime < 16) { // ~60fps
                return;
            }
            this.lastElevationMouseMoveTime = now;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Only redraw if position significantly changed
            const currentX = Math.round(x / 5) * 5; // Round to nearest 5px
            if (this.lastElevationDrawnX !== currentX) {
                this.lastElevationDrawnX = currentX;
                
                // Save for crosshair rendering
                this._elevMouseX = x;
                if (this.elevationChartInstance) this.elevationChartInstance.draw();
            }

            // Check if mouse is within chart area
            const chart = this.elevationChartInstance;
            const area = chart && chart.chartArea ? chart.chartArea : {left: 40, right: rect.width - 40, top: 20, bottom: rect.height - 20};
            if (x < area.left || x > area.right || y < area.top || y > area.bottom) {
                this.removeMapMarker();
                return;
            }

            // Calculate position along the route based on mouse X position (using chart area)
            const chartWidth = area.right - area.left;
            const relativeX = (x - area.left) / chartWidth;
            const maxDistance = Math.max(...elevationData.map(d => d.distance));
            const targetDistance = relativeX * maxDistance;

            // Find closest data point
            let closestPoint = null;
            let minDiff = Infinity;

            elevationData.forEach(point => {
                const diff = Math.abs(point.distance - targetDistance);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPoint = point;
                }
            });

            if (closestPoint) {
                // Only update map marker if point significantly changed
                const pointKey = `${closestPoint.lat.toFixed(4)},${closestPoint.lng.toFixed(4)}`;
                if (this.lastElevationMarkerPoint !== pointKey) {
                    this.lastElevationMarkerPoint = pointKey;
                    
                    // Update map marker
                    this.updateMapMarkerForElevation(closestPoint);
                }

                // Store current position for cleanup
                this.currentElevationPosition = closestPoint;
            }
        };

        const handleMouseLeave = () => {
            this.removeMapMarker();
            this.currentElevationPosition = null;
            this._elevMouseX = null;
            this.lastElevationDrawnX = null;
            this.lastElevationMarkerPoint = null;
            this.lastElevationMouseMoveTime = null;
            const topEl = document.getElementById('modalElevationTopValue');
            if (topEl) topEl.style.display = 'none';
            if (this.elevationChartInstance) this.elevationChartInstance.draw();
        };

        const handleClick = (event) => {
            const rect = canvas.getBoundingClientRect();
            const cx = event.clientX - rect.left;
            const cy = event.clientY - rect.top;

            // First: try POI marker hit-test (focus on POI)
            if (Array.isArray(this.elevationPoiScreenPoints) && this.elevationPoiScreenPoints.length) {
                const hitPoi = this.elevationPoiScreenPoints.find(p => {
                    const dx = p.x - cx;
                    const dy = p.y - cy;
                    return (dx*dx + dy*dy) <= (10*10); // 10px radius
                });
                if (hitPoi && hitPoi.poi) {
                    const poi = hitPoi.poi;
                    const lat = poi.latitude || poi.lat;
                    const lng = poi.longitude || poi.lng || poi.lon;
                    if (lat && lng) {
                        this.focusOnPoi(lat, lng);
                        return;
                    }
                }
            }

            // Next: try media marker hit-test (open viewer)
            if (Array.isArray(this.elevationMediaScreenPoints) && this.elevationMediaScreenPoints.length) {
                const hit = this.elevationMediaScreenPoints.find(p => {
                    const dx = p.x - cx;
                    const dy = p.y - cy;
                    return (dx*dx + dy*dy) <= (14*14); // 14px radius
                });
                if (hit && hit.media) {
                    const media = hit.media;
                    const url = media.url || media.path || media.file_path || media.full_path || media.original_path || '';
                    const type = (media.media_type && media.media_type.toLowerCase()) || this.getMediaTypeFromUrl(url);
                    if (url) {
                        this.showMediaViewer(url, type);
                        return; // don't also pan the map
                    }
                }
            }

            // Otherwise: center + zoom map to the clicked elevation position
            if (!this.mapInstance || !this.elevationChartInstance) return;

            // Derive closest data point at click X (don't rely on prior mousemove)
            const chart = this.elevationChartInstance;
            const area = chart.chartArea;
            const x = cx;
            if (x < area.left || x > area.right) return;
            const chartWidth = area.right - area.left;
            const relativeX = (x - area.left) / chartWidth;
            const data = this.elevationDataForInteraction || elevationData || [];
            if (!data.length) return;
            const maxDistance = Math.max(...data.map(d => d.distance));
            const targetDistance = relativeX * maxDistance;
            let closestPoint = null, minDiff = Infinity;
            for (const p of data) {
                const d = Math.abs(p.distance - targetDistance);
                if (d < minDiff) { minDiff = d; closestPoint = p; }
            }
            if (!closestPoint) return;
            this.currentElevationPosition = closestPoint;

            // Zoom in to level ~16 (or keep higher), animate
            const zoomTarget = Math.max(16, this.mapInstance.getZoom() || 13);
            if (typeof this.mapInstance.flyTo === 'function') {
                this.mapInstance.flyTo([closestPoint.lat, closestPoint.lng], zoomTarget, { duration: 0.7 });
            } else {
                this.mapInstance.setView([closestPoint.lat, closestPoint.lng], zoomTarget);
            }
        };

        // Add event listeners
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('click', handleClick);

        // Drag-zoom interactions
        canvas.addEventListener('mousedown', (e) => {
            if (!this.elevZoomEnabled || !this.elevationChartInstance) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const area = this.elevationChartInstance.chartArea;
            if (x >= area.left && x <= area.right) {
                this._elevDragStart = x;
            }
        });
        window.addEventListener('mouseup', () => {
            if (!this.elevZoomEnabled) {
                this._elevDragStart = null;
            }
        });

        // Store references for cleanup
        this.chartEventListeners = {
            canvas,
            handleMouseMove,
            handleMouseLeave,
            handleClick
        };
    }

    // Map POIs/waypoints onto elevation chart distances for overlay icons
    updateElevationPoiMarkers(pois) {
        try {
            // Hide POI markers on mobile for cleaner view
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.elevationPoiOverlayPoints = [];
                if (this.elevationChartInstance) this.elevationChartInstance.update();
                return;
            }

            const items = Array.isArray(pois) ? pois : [];
            if (!items.length) {
                this.elevationPoiOverlayPoints = [];
                if (this.elevationChartInstance) this.elevationChartInstance.update();
                return;
            }
            if (!this.elevationDataForInteraction || !this.elevationDataForInteraction.length) {
                this.pendingElevationPoiMarkers = items;
                return;
            }

            const overlay = [];
            items.forEach(poi => {
                const lat = parseFloat(poi.latitude ?? poi.lat);
                const lng = parseFloat(poi.longitude ?? poi.lng ?? poi.lon);
                if (isNaN(lat) || isNaN(lng)) return;
                let closest = null;
                let min = Infinity;
                for (const d of this.elevationDataForInteraction) {
                    const dx = this.calculateDistance(lat, lng, d.lat, d.lng);
                    if (dx < min) { min = dx; closest = d; }
                }
                if (closest) overlay.push({ distance: closest.distance, elevation: closest.elevation, poi });
            });

            this.elevationPoiOverlayPoints = overlay;
            if (this.elevationChartInstance) this.elevationChartInstance.update();
        } catch (e) {
            console.warn('updateElevationPoiMarkers failed:', e);
        }
    }

    // Create DOM overlays for POI icons with same icon/color as map markers
    updateElevationPoiDom(positions, chart) {
        try {
            const layer = document.getElementById('modalElevationOverlayLayer');
            if (!layer) return;
            // Remove only existing POI icons (do not touch media icons)
            Array.from(layer.querySelectorAll('.elevation-poi-icon')).forEach(el => el.remove());
            positions.forEach(pos => {
                const poi = pos.poi || {};
                const cat = this.getCategoryStyle(poi.category || 'diger');
                const el = document.createElement('div');
                el.className = 'elevation-poi-icon';
                el.style.backgroundColor = cat.color || '#666';
                el.style.left = `${pos.x}px`;
                el.style.top = `${pos.y}px`;
                el.title = poi.name || 'Durak';
                const i = document.createElement('i');
                i.className = cat.iconClass || 'fas fa-map-marker-alt';
                el.appendChild(i);
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openPoiPopupOnMap(poi);
                });
                layer.appendChild(el);
            });
        } catch (_) { /* ignore */ }
    }

    // Create DOM overlays for media icons; clicking opens media viewer
    updateElevationMediaDom(positions, chart) {
        try {
            const layer = document.getElementById('modalElevationOverlayLayer');
            if (!layer) return;
            // Remove only existing media icons (do not touch POI icons)
            Array.from(layer.querySelectorAll('.elevation-media-icon')).forEach(el => el.remove());
            positions.forEach(pos => {
                const media = pos.media || {};
                const rawUrl = media.url || media.path || media.file_path || media.full_path || media.original_path || '';
                const type = (media.media_type && media.media_type.toLowerCase()) || this.getMediaTypeFromUrl(rawUrl);
                const el = document.createElement('div');
                el.className = 'elevation-media-icon';
                el.style.left = `${pos.x}px`;
                el.style.top = `${pos.y}px`;
                el.title = media.caption || media.alt_text || 'Medya';
                // Color + icon per type
                let bg = '#f59e0b', icon = 'fas fa-camera';
                if (type === 'panorama' || (media && media.is_pano === true)) { bg = '#111827'; icon = 'fas fa-vr-cardboard'; }
                else if (type === 'video') { bg = '#ef4444'; icon = 'fas fa-play'; }
                else if (type === 'audio') { bg = '#10b981'; icon = 'fas fa-volume-up'; }
                else if (type === 'model_3d') { bg = '#6366f1'; icon = 'fas fa-cube'; }
                el.style.backgroundColor = bg;
                const i = document.createElement('i');
                i.className = icon;
                el.appendChild(i);
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (rawUrl) this.showMediaViewer(rawUrl, type);
                });
                layer.appendChild(el);
            });
        } catch (_) { /* ignore */ }
    }

    // Open the same POI popup used on map markers, from elevation overlay clicks
    openPoiPopupOnMap(poi) {
        try {
            if (!poi) return;
            const lat = parseFloat(poi.latitude ?? poi.lat);
            const lng = parseFloat(poi.longitude ?? poi.lng ?? poi.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            // Determine stop number from current route order
            const list = (this.currentRoute && (this.currentRoute.pois || this.currentRoute.waypoints)) || [];
            let stopIndex = -1;
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (p === poi || (p.id && poi.id && p.id === poi.id) || (p.poi_id && poi.poi_id && p.poi_id === poi.poi_id)) {
                    stopIndex = i; break;
                }
            }
            const stopNumber = stopIndex >= 0 ? (stopIndex + 1) : 1;

            // Build same popup HTML
            const html = this.createDetailedPOIPopup(poi, stopNumber);

            // Ensure map tab visible, then show popup
            this.switchTab('map');
            setTimeout(() => {
                if (!this.mapInstance) return;
                this.mapInstance.setView([lat, lng], Math.max(14, this.mapInstance.getZoom() || 13));
                const popup = L.popup({
                    maxWidth: 300,
                    minWidth: 250,
                    className: 'custom-poi-popup'
                })
                    .setLatLng([lat, lng])
                    .setContent(html);
                popup.openOn(this.mapInstance);
            }, 250);
        } catch (_) { /* ignore */ }
    }

    attachElevationToolbarHandlers() {
        const gradBtn = document.getElementById('elevToggleGradient');
        const markBtn = document.getElementById('elevToggleMarkers');
        const zoomBtn = document.getElementById('elevEnableZoom');
        const resetBtn = document.getElementById('elevResetZoom');
        const expandBtn = document.getElementById('elevExpand');

        if (gradBtn) gradBtn.addEventListener('click', () => {
            this.useElevationGradient = !this.useElevationGradient;
            if (this.elevationChartInstance) this.elevationChartInstance.update();
        });

        if (markBtn) markBtn.addEventListener('click', () => {
            this.showElevationMediaMarkers = !this.showElevationMediaMarkers;
            if (this.elevationChartInstance) this.elevationChartInstance.update();
        });

        if (zoomBtn) zoomBtn.addEventListener('click', () => {
            this.elevZoomEnabled = !this.elevZoomEnabled;
            zoomBtn.classList.toggle('active', this.elevZoomEnabled);
            if (!this.elevZoomEnabled) this._elevDragStart = null;
            if (this.elevationChartInstance) this.elevationChartInstance.draw();
        });

        if (resetBtn) resetBtn.addEventListener('click', () => {
            this.elevZoomRange = null;
            if (this.elevationChartInstance) {
                this.elevationChartInstance.options.scales.x.min = undefined;
                this.elevationChartInstance.options.scales.x.max = undefined;
                this.elevationChartInstance.update();
            }
        });

        if (expandBtn) expandBtn.addEventListener('click', () => {
            const container = document.querySelector('.elevation-chart-container');
            if (container) {
                container.classList.toggle('expanded');
                setTimeout(() => { if (this.elevationChartInstance) this.elevationChartInstance.resize(); }, 150);
            }
        });
    }

    showElevationTooltip(x, y, point) {
        const tooltip = document.getElementById('modalElevationTooltip');
        if (!tooltip) return;

        const name = point.name || `Konum ${this.elevationDataForInteraction.indexOf(point) + 1}`;
        tooltip.innerHTML = `
            <strong>${name}</strong><br>
            Yükseklik: ${point.elevation}m<br>
            Mesafe: ${point.distance.toFixed(1)}km
        `;

        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${y - 10}px`;
        tooltip.classList.add('show');
    }

    hideElevationTooltip() {
        const tooltip = document.getElementById('modalElevationTooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    updateMapMarkerForElevation(point) {
        if (!this.mapInstance) return;

        // Remove existing marker
        this.removeMapMarker();

        // Create new marker
        this.elevationMapMarker = L.circleMarker(
            [point.lat, point.lng],
            {
                radius: 8,
                fillColor: '#3b82f6',
                color: 'white',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8,
                className: 'elevation-position-marker'
            }
        ).addTo(this.mapInstance);

        // Add popup
        const popupContent = `
            <div class="elevation-map-popup">
                <strong>${point.name || 'Konum'}</strong><br>
                Yükseklik: ${point.elevation}m<br>
                Mesafe: ${point.distance.toFixed(1)}km
            </div>
        `;
        this.elevationMapMarker.bindPopup(popupContent);
    }

    removeMapMarker() {
        if (this.elevationMapMarker && this.mapInstance) {
            this.mapInstance.removeLayer(this.elevationMapMarker);
            this.elevationMapMarker = null;
        }
    }

    // Map media items onto elevation chart distances and trigger redraw
    updateElevationMediaMarkers(mediaItems, options = {}) {
        try {
            // Hide media markers on mobile for cleaner view
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.elevationMediaOverlayPoints = [];
                if (this.elevationChartInstance) this.elevationChartInstance.update();
                return;
            }

            const onlyImages = options.onlyImages === true;
            const items = Array.isArray(mediaItems) ? mediaItems : [];
            if (!items.length) {
                this.elevationMediaOverlayPoints = [];
                if (this.elevationChartInstance) this.elevationChartInstance.update();
                return;
            }

            // Prepare items with lat/lng
            const prepared = items
                .filter(m => {
                    if (!onlyImages) return true;
                    const t = (m.media_type || '').toLowerCase();
                    const url = m.url || m.path || '';
                    return t === 'image' || t === 'panorama' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
                })
                .map(m => {
                    const lat = parseFloat(m.lat ?? m.latitude);
                    const lng = parseFloat(m.lng ?? m.longitude ?? m.lon);
                    return isNaN(lat) || isNaN(lng) ? null : { lat, lng, media: m };
                })
                .filter(Boolean);

            if (!this.elevationDataForInteraction || !this.elevationDataForInteraction.length) {
                // Chart not ready yet, defer
                this.pendingElevationMediaMarkers = prepared;
                return;
            }

            // Map to closest elevation sample
            const overlay = prepared.map(p => {
                let closest = null;
                let min = Infinity;
                for (const d of this.elevationDataForInteraction) {
                    const dx = this.calculateDistance(p.lat, p.lng, d.lat, d.lng);
                    if (dx < min) { min = dx; closest = d; }
                }
                return closest ? { distance: closest.distance, elevation: closest.elevation, media: p.media } : null;
            }).filter(Boolean);

            this.elevationMediaOverlayPoints = overlay;
            if (this.elevationChartInstance) this.elevationChartInstance.update();
        } catch (e) {
            console.warn('updateElevationMediaMarkers failed:', e);
        }
    }

    updateElevationStats(elevationData, routeTotalKmOverride) {
        if (!elevationData || elevationData.length === 0) return;

        const elevations = elevationData.map(d => d.elevation);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);

        let totalAscent = 0;
        let totalDescent = 0;

        for (let i = 1; i < elevationData.length; i++) {
            const diff = elevationData[i].elevation - elevationData[i - 1].elevation;
            if (diff > 0) {
                totalAscent += diff;
            } else {
                totalDescent += Math.abs(diff);
            }
        }

        // Update display elements
        const minEl = document.getElementById('modalMinElevation');
        const maxEl = document.getElementById('modalMaxElevation');
        const ascentEl = document.getElementById('modalTotalAscent');
        const descentEl = document.getElementById('modalTotalDescent');

        if (minEl) minEl.textContent = `${Number(minElevation).toFixed(2)}m`;
        if (maxEl) maxEl.textContent = `${Number(maxElevation).toFixed(2)}m`;
        if (ascentEl) ascentEl.textContent = `+${Number(totalAscent).toFixed(2)}m`;
        if (descentEl) descentEl.textContent = `-${Number(totalDescent).toFixed(2)}m`;

        // Update distance labels (scope to modal container to avoid clashes)
        const container = document.getElementById('routeModalElevationContainer');
        const startLabel = container ? container.querySelector('.distance-start') : null;
        const endLabel = container ? container.querySelector('.distance-end') : null;

        if (startLabel) startLabel.textContent = '0.00 km';
        if (endLabel && elevationData.length > 0) {
            const dataMaxKm = Math.max(...elevationData.map(d => d.distance));
            let finalKm = dataMaxKm;
            if (typeof routeTotalKmOverride === 'number' && routeTotalKmOverride > 0) {
                const diff = Math.abs(routeTotalKmOverride - dataMaxKm);
                // Only show route total if it is very close (<= 0.3 km) to data max
                if (diff <= 0.3) finalKm = routeTotalKmOverride;
            }
            endLabel.textContent = `${finalKm.toFixed(2)} km`;
        }
    }

    // Estimate full route distance in km from geometry/metadata or fall back to data
    _estimateRouteTotalKm(elevationData) {
        // Prefer elevation_profile.total_distance (meters) if present
        try {
            if (this.currentRoute && this.currentRoute.elevation_profile && typeof this.currentRoute.elevation_profile.total_distance === 'number') {
                const td = this.currentRoute.elevation_profile.total_distance;
                if (td > 0) return td / 1000;
            }
        } catch (e) { /* ignore */ }

        // Prefer geometry if available
        try {
            if (this.currentRoute && this.currentRoute.geometry && Array.isArray(this.currentRoute.geometry.coordinates)) {
                const coords = this.currentRoute.geometry.coordinates;
                let total = 0;
                for (let i = 1; i < coords.length; i++) {
                    const [lng1, lat1] = coords[i - 1];
                    const [lng2, lat2] = coords[i];
                    total += this.calculateDistance(lat1, lng1, lat2, lng2); // returns km
                }
                if (total > 0) return total;
            }
        } catch (e) { /* ignore */ }

        // Use route.total_distance when available; normalize units
        try {
            const td = this.currentRoute && this.currentRoute.total_distance;
            if (typeof td === 'number' && td > 0) {
                // Heuristic: values > 100 => meters, else km
                return td > 100 ? (td / 1000) : td;
            }
        } catch (e) { /* ignore */ }

        // Fallback: use data max distance
        if (Array.isArray(elevationData) && elevationData.length) {
            return Math.max(...elevationData.map(d => d.distance || 0));
        }
        return undefined;
    }

    // Clean and sort elevation data
    _sanitizeElevationData(data) {
        try {
            const cleaned = (data || [])
                .filter(d => Number.isFinite(d.distance) && Number.isFinite(d.elevation))
                .sort((a, b) => a.distance - b.distance);
            const eps = 1e-6;
            const result = [];
            let last = -Infinity;
            for (const d of cleaned) {
                if (d.distance + eps <= last) continue; // drop non-monotonic
                result.push(d);
                last = d.distance;
            }
            return result;
        } catch (_) {
            return data || [];
        }
    }

    showElevationError(message) {
        const container = document.getElementById('routeModalElevationContainer');
        if (container) {
            container.innerHTML = `
                <div class="elevation-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
            `;
        }
    }

    showMediaViewer(mediaUrl, mediaType, mediaIndex = 0) {
        console.warn('🎬 Show media viewer:', mediaUrl, mediaType, 'index:', mediaIndex);

        if (!mediaUrl) {
            console.error('❌ No media URL provided to showMediaViewer');
            return;
        }

        // Ensure media list is available
        if (!this.currentMediaList || this.currentMediaList.length === 0) {
            this.currentMediaList = this.buildCurrentMediaList();
        }

        // If viewer is already open, just swap content without rebuilding
        if (this.currentMediaViewer && document.contains(this.currentMediaViewer)) {
            this.setViewerIndex(mediaIndex);
            return;
        }

        // Store current media index for navigation
        this.currentMediaIndex = mediaIndex;

        // Test the media URL to see if it's accessible (only on first open)
        this.testMediaUrl(mediaUrl).then(isAccessible => {
            if (!isAccessible) {
                console.warn('⚠️ Media URL not accessible, trying alternative patterns...');
                return this.findWorkingMediaUrl(mediaUrl);
            }
            return mediaUrl;
        }).then(workingUrl => {
            if (workingUrl) {
                this.createMediaViewerModal(workingUrl, mediaType, mediaIndex);
            } else {
                console.error('❌ Could not find working media URL');
                alert('Medya dosyası yüklenemiyor. Lütfen daha sonra tekrar deneyin.');
            }
        }).catch(error => {
            console.error('❌ Error testing media URL:', error);
            alert('Medya görüntülenirken hata oluştu.');
        });
    }

    async testMediaUrl(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn('❌ Media URL test failed:', url, error);
            return false;
        }
    }

    async findWorkingMediaUrl(originalUrl) {
        console.warn('🔍 Finding working media URL for:', originalUrl);

        // Extract filename from original URL
        const filename = originalUrl.split('/').pop();
        if (!filename) {
            console.error('❌ Could not extract filename from URL:', originalUrl);
            return null;
        }

        // Try different URL patterns
        const urlPatterns = [
            `/${filename}`,                    // Root domain
            `/uploads/${filename}`,           // Uploads directory
            `/media/${filename}`,             // Media directory
            `/static/media/${filename}`,      // Static media
            `${window.location.origin}/${filename}`, // Full URL with origin
            `${window.apiBase}/media/${filename}`    // API media endpoint
        ];

        for (const pattern of urlPatterns) {
            console.warn('🔍 Testing URL pattern:', pattern);
            if (await this.testMediaUrl(pattern)) {
                console.warn('✅ Found working URL:', pattern);
                return pattern;
            }
        }

        console.warn('❌ No working URL pattern found');
        return null;
    }

    createMediaViewerModal(mediaUrl, mediaType, mediaIndex) {
        // Get all media items for navigation
        const mediaItems = document.querySelectorAll('.route-media-item');
        const totalMedia = mediaItems.length;
        const hasPrevious = mediaIndex > 0;
        const hasNext = mediaIndex < totalMedia - 1;

        // Create enhanced media viewer modal with navigation
        const viewerModal = document.createElement('div');
        viewerModal.className = 'media-viewer-modal';
        viewerModal.innerHTML = `
            <div class="media-viewer-overlay" onclick="this.parentElement.remove()"></div>
            <div class="media-viewer-content">
                <div class="media-viewer-header">
                    <div class="media-viewer-info">
                        <span class="media-counter">${mediaIndex + 1} / ${totalMedia}</span>
                        <span class="media-type-badge">${this.getMediaTypeName(mediaType)}</span>
                    </div>
                    <div class="media-viewer-toolbar">
                        <button class="media-viewer-tool" title="Yeni Sekmede Aç" aria-label="Yeni Sekmede Aç" onclick="window.routeDetailsModalInstance.openCurrentMediaInNewTab()">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <button class="media-viewer-tool" title="Bağlantıyı Kopyala" aria-label="Bağlantıyı Kopyala" onclick="window.routeDetailsModalInstance.copyCurrentMediaLink()">
                            <i class="fas fa-link"></i>
                        </button>
                        <button class="media-viewer-tool" title="İndir" aria-label="İndir" onclick="window.routeDetailsModalInstance.downloadCurrentMedia()">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="media-viewer-close" onclick="this.parentElement.parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                ${hasPrevious ? `
                <button class="media-nav-btn media-nav-prev" onclick="window.routeDetailsModalInstance.navigateMedia(-1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                ` : ''}
                
                ${hasNext ? `
                <button class="media-nav-btn media-nav-next" onclick="window.routeDetailsModalInstance.navigateMedia(1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
                ` : ''}
                
                <div class="media-viewer-body">
                    <div class="media-viewer-loading">
                        <div class="media-viewer-spinner"></div>
                        <p>Medya yükleniyor...</p>
                    </div>
                    <div class="media-viewer-content-wrapper" style="display: none;">
                        ${this.createMediaElement(mediaUrl, mediaType)}
                    </div>
                </div>
                
                <div class="media-viewer-footer">
                    <div class="media-thumbnails">
                        ${this.createMediaThumbnails(mediaItems, mediaIndex)}
                    </div>
                </div>
            </div>
        `;

        // Store reference for navigation
        this.currentMediaViewer = viewerModal;

        // Prefer to contain the viewer within the media tab content so tabs remain clickable
        const mediaTab = this.modal.querySelector('.route-details-tab-content[data-tab="media"]');
        if (mediaTab) {
            mediaTab.appendChild(viewerModal);
        } else {
            document.body.appendChild(viewerModal);
        }

        // Add keyboard navigation
        this.addMediaViewerKeyboardNavigation(viewerModal);

        console.warn('✅ Enhanced media viewer modal created with URL:', mediaUrl);

        // Build/stash current media list for fast navigation
        this.currentMediaList = this.buildCurrentMediaList();

        // Ensure lazy loader observes new thumbnails
        if (window.loadingManager && typeof window.loadingManager.observeLazyImages === 'function') {
            window.loadingManager.observeLazyImages();
        } else if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
            window.lazyLoader.setupImageLazyLoading();
        }
        // Auto-hide controls on inactivity and enable swipe navigation
        this.setupAutoHideControls(viewerModal);
        this.addViewerSwipeNavigation(viewerModal);
    }

    createMediaElement(mediaUrl, mediaType) {
        switch (mediaType) {
            case 'video':
                return `<video src="${mediaUrl}" controls autoplay style="max-width: 100%; max-height: 80vh;" 
                        onloadeddata="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" 
                        onerror="console.error('Failed to load video in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Video yüklenemedi</p>'"></video>`;
            case 'audio':
                return `<audio src="${mediaUrl}" controls autoplay style="width: 100%;" 
                        onloadeddata="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" 
                        onerror="console.error('Failed to load audio in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Ses dosyası yüklenemedi</p>'"></audio>`;
            case 'model_3d':
                return `<model-viewer src="${mediaUrl}" alt="3D Model" auto-rotate camera-controls 
                        style="width: 100%; height: 80vh;" 
                        onload="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" 
                        onerror="console.error('Failed to load 3D model in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>3D model yüklenemedi</p>'"></model-viewer>`;
            default:
                return `<img src="${mediaUrl}" alt="Media" style="max-width: 100%; max-height: 80vh; object-fit: contain;" 
                        onload="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" 
                        onerror="console.error('Failed to load image in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Resim yüklenemedi</p>'">`;
        }
    }

    createMediaThumbnails(mediaItems, currentIndex) {
        return Array.from(mediaItems).map((item, index) => {
            const isActive = index === currentIndex;
            const img = item.querySelector('img, video');
            const src = img ? (img.src || img.poster) : '';

            const imgHTML = src
                ? `<img data-src="${src}" alt="Thumbnail ${index + 1}" loading="lazy" class="lazy-image">`
                : `<div class="thumbnail-placeholder"><i class="fas fa-file"></i></div>`;

            return `
                <div class="media-thumbnail ${isActive ? 'active' : ''}" data-index="${index}" 
                     onclick="window.routeDetailsModalInstance.jumpToMedia(${index})">
                    ${imgHTML}
                </div>
            `;
        }).join('');
    }

    getMediaTypeName(mediaType) {
        const typeNames = {
            'image': 'Resim',
            'video': 'Video',
            'audio': 'Ses',
            'model_3d': '3D Model'
        };
        return typeNames[mediaType] || 'Medya';
    }

    navigateMedia(direction) {
        const newIndex = this.currentMediaIndex + direction;
        if (this.currentMediaViewer && this.currentMediaList.length) {
            if (newIndex >= 0 && newIndex < this.currentMediaList.length) {
                this.setViewerIndex(newIndex);
            }
        } else {
            // Fallback (no viewer?)
            const mediaItems = document.querySelectorAll('.route-media-item');
            if (newIndex >= 0 && newIndex < mediaItems.length) {
                mediaItems[newIndex].click();
            }
        }
    }

    jumpToMedia(index) {
        if (this.currentMediaViewer && this.currentMediaList.length) {
            if (index >= 0 && index < this.currentMediaList.length) {
                this.setViewerIndex(index);
            }
            return;
        }
        const mediaItems = document.querySelectorAll('.route-media-item');
        if (index >= 0 && index < mediaItems.length) {
            mediaItems[index].click();
        }
    }

    buildCurrentMediaList() {
        const items = Array.from(document.querySelectorAll('.route-media-item'));
        return items.map((item) => {
            const imgOrVideo = item.querySelector('img, video');
            const url = imgOrVideo ? (imgOrVideo.src || imgOrVideo.poster) : '';
            const type = window.getMediaTypeFromPath ? window.getMediaTypeFromPath(url) : 'image';
            return { url, type };
        });
    }

    setViewerIndex(newIndex) {
        if (newIndex < 0 || newIndex >= this.currentMediaList.length) return;
        this.currentMediaIndex = newIndex;
        this.updateViewerContent();
        this.preloadNeighborMedia();
    }

    getOrCreateMediaElement(url, type) {
        if (this.mediaElementCache.has(url)) return this.mediaElementCache.get(url);
        let el;
        switch (type) {
            case 'video': {
                const v = document.createElement('video');
                v.controls = true;
                v.preload = 'metadata';
                v.style.maxWidth = '100%';
                v.style.maxHeight = '80vh';
                v.src = url;
                el = v; break;
            }
            case 'audio': {
                const a = document.createElement('audio');
                a.controls = true;
                a.preload = 'metadata';
                a.style.width = '100%';
                a.src = url;
                el = a; break;
            }
            case 'model_3d': {
                const mv = document.createElement('model-viewer');
                mv.setAttribute('src', url);
                mv.setAttribute('auto-rotate', '');
                mv.setAttribute('camera-controls', '');
                mv.style.width = '100%';
                mv.style.height = '80vh';
                el = mv; break;
            }
            default: {
                const img = new Image();
                img.src = url;
                img.alt = 'Media';
                img.decoding = 'async';
                img.style.maxWidth = '100%';
                img.style.maxHeight = '80vh';
                img.style.objectFit = 'contain';
                el = img; break;
            }
        }
        this.mediaElementCache.set(url, el);
        return el;
    }

    updateViewerContent() {
        if (!this.currentMediaViewer) return;
        const wrapper = this.currentMediaViewer.querySelector('.media-viewer-content-wrapper');
        const loading = this.currentMediaViewer.querySelector('.media-viewer-loading');
        const counter = this.currentMediaViewer.querySelector('.media-counter');
        const typeBadge = this.currentMediaViewer.querySelector('.media-type-badge');
        const total = this.currentMediaList.length;
        const { url, type } = this.currentMediaList[this.currentMediaIndex];

        // Update header UI
        if (counter) counter.textContent = `${this.currentMediaIndex + 1} / ${total}`;
        if (typeBadge) typeBadge.textContent = this.getMediaTypeName(type);

        // Swap element
        const el = this.getOrCreateMediaElement(url, type);
        if (wrapper) {
            loading.style.display = 'none';
            wrapper.style.display = 'block';
            wrapper.innerHTML = '';
            wrapper.appendChild(el);
        }

        // Update active thumbnail highlight
        const thumbs = this.currentMediaViewer.querySelectorAll('.media-thumbnail');
        thumbs.forEach(t => t.classList.remove('active'));
        const active = this.currentMediaViewer.querySelector(`.media-thumbnail[data-index="${this.currentMediaIndex}"]`);
        if (active) active.classList.add('active');

        // Update nav buttons enabled visibility
        const prevBtn = this.currentMediaViewer.querySelector('.media-nav-prev');
        const nextBtn = this.currentMediaViewer.querySelector('.media-nav-next');
        if (prevBtn) prevBtn.style.display = this.currentMediaIndex > 0 ? 'block' : 'none';
        if (nextBtn) nextBtn.style.display = this.currentMediaIndex < total - 1 ? 'block' : 'none';

        // Ensure active thumbnail is visible
        const thumbsWrapper = this.currentMediaViewer.querySelector('.media-thumbnails');
        if (thumbsWrapper && active) {
            active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        // Enable basic zoom/pan for images
        if (el && el.tagName === 'IMG') {
            this.attachImageZoomPan(el);
        }
    }

    preloadNeighborMedia() {
        const preload = (idx) => {
            if (idx < 0 || idx >= this.currentMediaList.length) return;
            const { url, type } = this.currentMediaList[idx];
            if (type !== 'image') return;
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
        };
        preload(this.currentMediaIndex + 1);
        preload(this.currentMediaIndex - 1);
    }

    // UX actions: toolbar
    getCurrentMedia() {
        return this.currentMediaList[this.currentMediaIndex] || null;
    }

    openCurrentMediaInNewTab() {
        const cur = this.getCurrentMedia();
        if (cur && cur.url) window.open(cur.url, '_blank', 'noopener');
    }

    async copyCurrentMediaLink() {
        const cur = this.getCurrentMedia();
        if (!cur || !cur.url) return;
        try {
            await navigator.clipboard.writeText(cur.url);
        } catch (_) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = cur.url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    downloadCurrentMedia() {
        const cur = this.getCurrentMedia();
        if (!cur || !cur.url) return;
        const a = document.createElement('a');
        a.href = cur.url;
        const name = cur.url.split('/').pop() || 'media';
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Auto-hide header/controls on inactivity
    setupAutoHideControls(viewerModal) {
        let hideTimer = null;
        const resetTimer = () => {
            viewerModal.classList.remove('controls-hidden');
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                viewerModal.classList.add('controls-hidden');
            }, 2000);
        };
        ['mousemove','touchstart','keydown'].forEach(evt => {
            viewerModal.addEventListener(evt, resetTimer, { passive: true });
        });
        resetTimer();
    }

    // Swipe navigation for mobile
    addViewerSwipeNavigation(viewerModal) {
        let startX = null;
        let startY = null;
        const onTouchStart = (e) => {
            const t = e.touches && e.touches[0];
            if (!t) return;
            startX = t.clientX; startY = t.clientY;
        };
        const onTouchEnd = (e) => {
            if (startX === null) return;
            const t = e.changedTouches && e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            // Horizontal swipe dominant
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) this.navigateMedia(1); else this.navigateMedia(-1);
            }
            startX = startY = null;
        };
        viewerModal.addEventListener('touchstart', onTouchStart, { passive: true });
        viewerModal.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    // Simple image zoom and pan
    attachImageZoomPan(img) {
        let scale = 1;
        let originX = 0; let originY = 0;
        let lastX = 0; let lastY = 0;
        let dragging = false;

        const apply = () => {
            img.style.transform = `translate(${lastX}px, ${lastY}px) scale(${scale})`;
            img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
            img.style.transition = dragging ? 'none' : 'transform 0.15s ease';
        };

        const reset = () => { scale = 1; lastX = 0; lastY = 0; apply(); };

        // Double click / double tap to toggle zoom
        let lastTap = 0;
        img.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                // double tap
                scale = scale > 1 ? 1 : 2.5;
                lastX = lastY = 0;
                apply();
                e.preventDefault();
            }
            lastTap = now;
        });

        img.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.metaKey) return; // prevent accidental zoom; require ctrl/cmd
            e.preventDefault();
            const delta = -Math.sign(e.deltaY) * 0.2;
            scale = Math.min(4, Math.max(1, scale + delta));
            apply();
        }, { passive: false });

        img.addEventListener('pointerdown', (e) => {
            if (scale === 1) return;
            dragging = true;
            originX = e.clientX - lastX;
            originY = e.clientY - lastY;
            img.setPointerCapture(e.pointerId);
            apply();
        });
        img.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            lastX = e.clientX - originX;
            lastY = e.clientY - originY;
            apply();
        });
        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            img.releasePointerCapture(e.pointerId);
            apply();
        };
        img.addEventListener('pointerup', endDrag);
        img.addEventListener('pointercancel', endDrag);

        // Reset on escape
        const onKey = (e) => { if (e.key === 'Escape') reset(); };
        document.addEventListener('keydown', onKey);
        // Clean-up when viewer closes
        const obs = new MutationObserver((muts) => {
            muts.forEach(m => {
                m.removedNodes.forEach(node => {
                    if (node === this.currentMediaViewer) {
                        document.removeEventListener('keydown', onKey);
                        obs.disconnect();
                    }
                });
            });
        });
        obs.observe(document.body, { childList: true, subtree: true });

        apply();
    }

    addMediaViewerKeyboardNavigation(viewerModal) {
        const handleKeydown = (e) => {
            switch (e.key) {
                case 'Escape':
                    viewerModal.remove();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateMedia(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateMedia(1);
                    break;
            }
        };

        document.addEventListener('keydown', handleKeydown);
        
        // Clean up event listener when modal is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach((node) => {
                        if (node === viewerModal) {
                            document.removeEventListener('keydown', handleKeydown);
                            observer.disconnect();
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    createDifficultyStars(level) {
        const maxStars = 5;
        let starsHTML = '';

        for (let i = 1; i <= maxStars; i++) {
            const isFilled = i <= level;
            starsHTML += `<i class="fas fa-star" style="color: ${isFilled ? '#fbbf24' : '#e5e7eb'}"></i>`;
        }

        return starsHTML;
    }

    getCategoryStyle(category) {
        // Use the global POI_CATEGORIES if available, otherwise fallback to basic styles
        if (typeof POI_CATEGORIES !== 'undefined' && POI_CATEGORIES[category]) {
            const cat = POI_CATEGORIES[category];
            return {
                color: cat.color,
                iconClass: `fas fa-${cat.icon}`
            };
        }

        // Use existing category style functions from the main app
        if (window.getCategoryStyle) {
            return window.getCategoryStyle(category);
        }

        // Fallback category styles
        const fallbackStyles = {
            'doga': { color: '#16a085', iconClass: 'fas fa-tree' },
            'yemek': { color: '#e74c3c', iconClass: 'fas fa-utensils' },
            'tarihi': { color: '#8e44ad', iconClass: 'fas fa-landmark' },
            'eglence': { color: '#f39c12', iconClass: 'fas fa-gamepad' },
            'sanat_kultur': { color: '#9b59b6', iconClass: 'fas fa-palette' },
            'macera': { color: '#e67e22', iconClass: 'fas fa-mountain' },
            'rahatlatici': { color: '#1abc9c', iconClass: 'fas fa-spa' },
            'spor': { color: '#27ae60', iconClass: 'fas fa-running' },
            'alisveris': { color: '#3498db', iconClass: 'fas fa-shopping-bag' },
            'gece_hayati': { color: '#2c3e50', iconClass: 'fas fa-moon' },
            'konaklama': { color: '#34495e', iconClass: 'fas fa-bed' },
            'ulasim': { color: '#95a5a6', iconClass: 'fas fa-car' },
            'saglik': { color: '#e74c3c', iconClass: 'fas fa-hospital' },
            'egitim': { color: '#f1c40f', iconClass: 'fas fa-graduation-cap' },
            'diger': { color: '#7f8c8d', iconClass: 'fas fa-map-marker-alt' }
        };

        return fallbackStyles[category] || fallbackStyles['diger'];
    }

    getCategoryDisplayName(category) {
        // Use the global POI_CATEGORIES if available
        if (typeof POI_CATEGORIES !== 'undefined' && POI_CATEGORIES[category]) {
            return POI_CATEGORIES[category].display_name || POI_CATEGORIES[category].name;
        }

        // Use existing category display name functions from the main app
        if (window.getCategoryDisplayName) {
            return window.getCategoryDisplayName(category);
        }

        // Fallback display names
        const fallbackNames = {
            'doga': 'Doğa',
            'yemek': 'Yemek',
            'tarihi': 'Tarih',
            'eglence': 'Eğlence',
            'sanat_kultur': 'Sanat & Kültür',
            'macera': 'Macera',
            'rahatlatici': 'Rahatlatıcı',
            'spor': 'Spor',
            'alisveris': 'Alışveriş',
            'gece_hayati': 'Gece Hayatı',
            'konaklama': 'Konaklama',
            'ulasim': 'Ulaşım',
            'saglik': 'Sağlık',
            'egitim': 'Eğitim',
            'diger': 'Diğer'
        };

        return fallbackNames[category] || 'Diğer';
    }

    getMediaTypeFromUrl(url) {
        if (!url) return 'image';

        // Use global function if available
        if (typeof window.getMediaTypeFromPath === 'function') {
            const type = window.getMediaTypeFromPath(url);
            return type === 'unknown' ? 'image' : type;
        }

        // Fallback implementation
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) {
            return 'video';
        } else if (lowerUrl.includes('.mp3') || lowerUrl.includes('.wav') || lowerUrl.includes('.ogg')) {
            return 'audio';
        } else if (lowerUrl.includes('.glb') || lowerUrl.includes('.gltf')) {
            return 'model_3d';
        }
        return 'image';
    }

    getMediaMarkerStyle(mediaType) {
        const styles = {
            image: { color: '#f59e0b', icon: 'fas fa-camera' },
            video: { color: '#ef4444', icon: 'fas fa-video' },
            audio: { color: '#10b981', icon: 'fas fa-volume-up' },
            model_3d: { color: '#6366f1', icon: 'fas fa-cube' }
        };

        return styles[mediaType] || styles.image;
    }

    getMediaTypeDisplayName(mediaType) {
        const names = {
            image: 'Resim',
            video: 'Video',
            audio: 'Ses',
            model_3d: '3D Model'
        };

        return names[mediaType] || 'Medya';
    }

    // Initialize base layers for modal map
    initializeBaseLayers() {
        console.warn('🗺️ Initializing base layers for modal map');

        // Define available base layers (same as main map)
        const commonTileOpts = {
            maxZoom: 19,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 3,
            crossOrigin: true
        };
        const baseLayers = {
            "🗺️ OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxNativeZoom: 19,
                ...commonTileOpts
            }),
            "🛰️ Uydu Görüntüsü": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, Earthstar Geographics',
                ...commonTileOpts
            }),
            "🏔️ Topografik": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap (CC-BY-SA)',
                maxZoom: 17,
                ...commonTileOpts
            }),
            "🎨 CartoDB Positron": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CartoDB',
                ...commonTileOpts
            }),
            "🌙 CartoDB Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CartoDB',
                ...commonTileOpts
            })
        };

        // Add default layer to map and create layer control
        baseLayers["🗺️ OpenStreetMap"].addTo(this.mapInstance);
        L.control.layers(baseLayers).addTo(this.mapInstance);

        console.warn('✅ Base layers initialized successfully');
    }

    // Add resize listener for responsive behavior
    addResizeListener() {
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
        }
        if (this.orientationListener) {
            window.removeEventListener('orientationchange', this.orientationListener);
        }

        this.resizeListener = () => {
            if (!(this.mapInstance && this.isVisible && this.currentTab === 'map')) return;

            const isMobile = window.innerWidth <= 768;
            const delay = isMobile ? 250 : 80;

            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                // Only invalidate size; do NOT refit unless initial fit hasn't happened
                try { this.mapInstance.invalidateSize(); } catch (_) { /* noop */ }

                if (!this.hasFittedBounds && !this.userHasInteracted) {
                    this.fitMapToRoute(true);
                }

                if (isMobile && this.elevationChartInstance) {
                    try { this.elevationChartInstance.resize(); } catch (_) { /* noop */ }
                }
            }, delay);
        };

        // Handle orientation changes on mobile devices
        this.orientationListener = () => {
            console.warn('📱 Orientation changed, refreshing map and chart');
            setTimeout(() => {
                if (!(this.mapInstance && this.isVisible && this.currentTab === 'map')) return;

                try { this.mapInstance.invalidateSize(); } catch (_) { /* noop */ }
                if (!this.userHasInteracted) {
                    this.fitMapToRoute(true);
                }
                if (this.elevationChartInstance) {
                    try { this.elevationChartInstance.resize(); } catch (_) { /* noop */ }
                }
            }, 500);
        };

        window.addEventListener('resize', this.resizeListener);
        window.addEventListener('orientationchange', this.orientationListener);
    }

    // Remove resize listener on cleanup
    removeResizeListener() {
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
        if (this.orientationListener) {
            window.removeEventListener('orientationchange', this.orientationListener);
            this.orientationListener = null;
        }
    }
}

// Lightweight scroll lock that prevents background scrolling without changing body overflow
const ScrollLock = (() => {
    let locked = false;
    let lockEl = null;
    const wheelHandler = (e) => {
        if (!lockEl) return;
        // Allow scroll if the event target is inside a scrollable area within the modal
        const pathEl = e.target.closest('.route-details-modal-content');
        if (pathEl) {
            // Determine if can scroll inside
            const delta = e.deltaY;
            const scroller = e.target.closest('.route-details-modal-body, .route-details-tab-content, .route-map-container');
            if (scroller) {
                const { scrollTop, scrollHeight, clientHeight } = scroller;
                const atTop = scrollTop <= 0;
                const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
                if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
                    // Let it scroll inside modal
                    return;
                }
            }
        }
        e.preventDefault();
    };
    const touchMoveHandler = (e) => {
        if (!lockEl) return;
        if (e.target && e.target.closest && e.target.closest('#routeDetailsModal')) {
            // Allow default; modal body has its own scrolling
            return;
        }
        e.preventDefault();
    };
    const keydownHandler = (e) => {
        if (!lockEl) return;
        const keys = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Space',' '];
        if (keys.includes(e.key)) {
            // If focus is inside modal, allow; else prevent
            if (document.activeElement && lockEl.contains(document.activeElement)) return;
            e.preventDefault();
        }
    };
    return {
        enable(el) {
            if (locked) return; locked = true; lockEl = el;
            window.addEventListener('wheel', wheelHandler, { passive: false });
            window.addEventListener('touchmove', touchMoveHandler, { passive: false });
            window.addEventListener('keydown', keydownHandler, { passive: false });
        },
        disable() {
            if (!locked) return; locked = false; lockEl = null;
            window.removeEventListener('wheel', wheelHandler, { passive: false });
            window.removeEventListener('touchmove', touchMoveHandler, { passive: false });
            window.removeEventListener('keydown', keydownHandler, { passive: false });
        }
    };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal instance
    RouteDetailsModal.getInstance();
});

// Make it globally available
window.RouteDetailsModal = RouteDetailsModal;

// Global function to show route details
window.showRouteDetails = function (routeData) {
    console.warn('🎯 Global showRouteDetails called with:', routeData);
    const modal = RouteDetailsModal.getInstance();
    if (modal) {
        modal.show(routeData);
    } else {
        console.error('❌ Route details modal not available');
    }
};

// Global function to test elevation chart
window.testElevationChart = function () {
    console.warn('🧪 Testing elevation chart functionality');

    // Check for any duplicate elevation canvases
    const canvases = document.querySelectorAll('canvas[id*="levation"]');
    console.warn(`📊 Found ${canvases.length} elevation-related canvases:`, canvases);

    if (canvases.length > 1) {
        console.warn('⚠️ Multiple elevation canvases detected! This might cause issues.');
        canvases.forEach((canvas, index) => {
            console.warn(`Canvas ${index + 1}:`, canvas.id, canvas);
        });
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js is not loaded! Elevation chart will not work.');
        return;
    } else {
        console.warn('✅ Chart.js is loaded and available');
    }

    // Sample route data with geometry for testing
    const testRouteData = {
        id: 'test-route-1',
        name: 'Test Route with Elevation',
        description: 'This is a test route to verify elevation chart functionality',
        total_distance: 15.2,
        estimated_duration: 240, // 4 hours in minutes
        poi_count: 5,
        difficulty_level: 2,
        geometry: {
            type: 'LineString',
            coordinates: [
                [34.8, 38.6],
                [34.82, 38.62],
                [34.84, 38.64],
                [34.86, 38.66],
                [34.88, 38.68],
                [34.90, 38.70],
                [34.92, 38.72],
                [34.94, 38.74],
                [34.96, 38.76],
                [34.98, 38.78]
            ]
        },
        pois: [
            {
                id: 1,
                name: 'Starting Point',
                latitude: 38.6,
                longitude: 34.8,
                category: 'diger',
                description: 'Route starting point'
            },
            {
                id: 2,
                name: 'Mid Point',
                latitude: 38.66,
                longitude: 34.86,
                category: 'doga',
                description: 'Beautiful viewpoint'
            },
            {
                id: 3,
                name: 'End Point',
                latitude: 38.78,
                longitude: 34.98,
                category: 'tarihi',
                description: 'Historical site'
            }
        ]
    };

    // Show the test route
    window.showRouteDetails(testRouteData);
    console.warn('✅ Test route loaded, switch to Map tab to see elevation chart');
    console.warn('💡 Tip: The elevation chart will show simulated elevation data for the Cappadocia region');
    console.warn('🔍 Check browser console for canvas count and debug info');
    console.warn('🎯 To test synchronization: Move your mouse over the elevation chart and watch the blue dot move on the map!');
    console.warn('🖱️ Click on the elevation chart to center the map on that position');
};

// Global function for showing route details (main entry point)
window.showRouteDetails = async function (routeIdOrData) {
    console.warn('🎯 showRouteDetails called with:', routeIdOrData);

    try {
        let routeData;

        // If it's a number/string, fetch route data from API
        if (typeof routeIdOrData === 'string' || typeof routeIdOrData === 'number') {
            const routeId = routeIdOrData;
            console.warn('📡 Fetching route data for ID:', routeId);

            const apiBase = window.apiBase || '/api';
            const response = await fetch(`${apiBase}/routes/${routeId}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            routeData = data.route || data;
        // Listen tab visibility to re-stabilize layout when returning from another tab
        try { document.addEventListener('visibilitychange', this.handleVisibilityChange); } catch (_) {}
            console.warn('✅ Route data fetched successfully:', routeData.name);
        }
        // If it's already an object, use it directly
        else if (typeof routeIdOrData === 'object' && routeIdOrData !== null) {
            routeData = routeIdOrData;
            console.warn('✅ Using provided route data:', routeData.name);
        }
        else {
            throw new Error('Invalid route data provided');
        }

        // Validate route data
        if (!routeData || !routeData.id) {
            throw new Error('Invalid route data: missing ID');
        }

        // Get modal instance and show
        const modal = RouteDetailsModal.getInstance();
        if (modal) {
            console.warn('✅ Showing route modal for:', routeData.name);
            await modal.show(routeData);
        } else {
            throw new Error('Route details modal not available');
        }

    } catch (error) {
        console.error('❌ Error showing route details:', error);
        alert(`Rota detayları yüklenirken hata oluştu: ${error.message}`);
    }
};

// Global function for media type detection (consistent with main system)
window.getMediaTypeFromPath = function (path) {
    if (!path) return 'unknown';

    const extension = path.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
        return 'image';
    } else if (['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(extension)) {
        return 'video';
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension)) {
        return 'audio';
    } else if (['glb', 'gltf', 'obj', 'fbx', 'dae', 'ply', 'stl'].includes(extension)) {
        return 'model_3d';
    }

    return 'unknown';
};
