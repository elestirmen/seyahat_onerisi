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
        this.isVisible = false;
        this.elevationChart = null;
        this.elevationChartInstance = null;
        this.elevationDataForInteraction = null;
        this.elevationMediaOverlayPoints = [];
        this.pendingElevationMediaMarkers = null;
        this.elevationMediaScreenPoints = [];
        // Elevation UX state
        this.showElevationMediaMarkers = true;
        this.useElevationGradient = true;
        this.elevZoomEnabled = false;
        this.elevZoomRange = null; // {min, max} in km
        this._elevMouseX = null;
        this._elevDragStart = null;
        // Bind methods
        this.hide = this.hide.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleBackdropClick = this.handleBackdropClick.bind(this);

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
                            <div class="route-media-grid" id="routeMediaGrid">
                                <div class="route-details-loading">
                                    <i class="fas fa-spinner"></i>
                                    <p>Medya yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="route-details-actions">
                        <button class="route-action-btn primary" id="startNavigationBtn">
                            <i class="fas fa-navigation"></i>
                            <span>Navigasyonu Başlat</span>
                        </button>
                        <button class="route-action-btn secondary" id="exportRouteBtn">
                            <i class="fas fa-download"></i>
                            <span>Dışa Aktar</span>
                        </button>
                        <button class="route-action-btn secondary" id="shareRouteBtn">
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
        console.log('🔧 Attaching map control listeners');

        // Check if modal exists
        if (!this.modal) {
            console.error('❌ Modal not found, cannot attach map control listeners');
            return;
        }

        // Map controls
        const fitBtn = document.getElementById('fitMapBtn');
        if (fitBtn) {
            console.log('✅ Fit map button found, adding event listener');
            fitBtn.addEventListener('click', (e) => {
                console.log('🔍 Fit map button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.fitMapToRoute();
            });
            console.log('✅ Fit map button event listener attached successfully');
        } else {
            console.error('❌ Fit map button not found');
        }

        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        if (fullscreenBtn) {
            console.log('✅ Fullscreen button found, adding event listener');
            fullscreenBtn.addEventListener('click', (e) => {
                console.log('🔍 Fullscreen button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreenMap();
            });
            console.log('✅ Fullscreen button event listener attached successfully');
        } else {
            console.error('❌ Fullscreen button not found');
        }

        console.log('🔧 Map control listeners attachment completed');
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
            console.log('✅ Fit map button found, adding event listener');
            fitBtn.addEventListener('click', (e) => {
                console.log('🔍 Fit map button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.fitMapToRoute();
            });
        } else {
            console.error('❌ Fit map button not found');
        }

        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        if (fullscreenBtn) {
            console.log('✅ Fullscreen button found, adding event listener');
            fullscreenBtn.addEventListener('click', (e) => {
                console.log('🔍 Fullscreen button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreenMap();
            });
        } else {
            console.error('❌ Fullscreen button not found');
        }
    }

    async show(routeData) {
        console.log('🎯 Showing route details modal with data:', routeData);
        console.log('📊 Modal element exists:', !!this.modal);
        console.log('📊 Route data structure inspection:', {
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
            console.log('📍 First POI structure:', routeData.pois[0]);
        }
        if (routeData.waypoints && routeData.waypoints.length > 0) {
            console.log('📍 First waypoint structure:', routeData.waypoints[0]);
        }

        this.currentRoute = routeData;
        this.updateHeader(routeData);

        // Show modal with animation
        this.modal.classList.add('show');
        this.isVisible = true;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Reset modal scroll to top for better UX
        const bodyEl = document.getElementById('routeModalBody');
        if (bodyEl) bodyEl.scrollTop = 0;

        // Attach map control listeners after modal HTML is created
        setTimeout(() => {
            console.log('🎯 Attaching map control listeners after modal show');
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
                console.log('📱 Pre-loading map content for mobile (critical fix)');
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
            }
        }, delay);

        // Add resize listener for responsive behavior
        this.addResizeListener();
    }

    hide() {
        console.log('🎯 Hiding route details modal');

        this.modal.classList.remove('show');
        this.isVisible = false;

        // Restore body scroll
        document.body.style.overflow = '';

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

        console.log('🔄 Switching to tab:', tabName);

        // Update tab buttons
        document.querySelectorAll('.route-details-tab').forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

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
        const isMobile = window.innerWidth <= 768;
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

                // Force multiple reflows
                mapContainer.offsetHeight;
                mapContainer.getBoundingClientRect();
                mapTab.offsetHeight;

                console.log('📱 Forced map container sizing before content load:', {
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
            const isMobile = window.innerWidth <= 768;
            const delay = isMobile ? 500 : 300;

            setTimeout(() => {
                if (this.mapInstance) {
                    console.log('🗺️ Invalidating map size after tab switch');
                    this.mapInstance.invalidateSize();
                    this.fitMapToRoute();

                    // Additional mobile-specific map refresh
                    if (isMobile) {
                        setTimeout(() => {
                            this.mapInstance.invalidateSize();
                            this.fitMapToRoute();
                        }, 200);
                    }
                }

                // Initialize elevation chart if elevation container exists but chart doesn't
                const elevationContainer = document.getElementById('routeModalElevationContainer');
                const elevationCanvas = document.getElementById('modalElevationChart');

                if (elevationContainer && !elevationCanvas) {
                    console.log('🏔️ Initializing elevation chart after tab switch');
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
                this.fitMapToRoute();

                // Force additional resize on mobile with multiple attempts
                if (isMobile) {
                    setTimeout(() => {
                        this.mapInstance.invalidateSize();
                        // Second invalidateSize (log removed)
                    }, 300);

                    setTimeout(() => {
                        this.mapInstance.invalidateSize();
                        // Third invalidateSize (log removed)
                    }, 600);
                }
            }, delay);

            // Check if elevation chart needs to be initialized
            const elevationContainer = document.getElementById('routeModalElevationContainer');
            const elevationCanvas = document.getElementById('modalElevationChart');

            if (!elevationContainer || !elevationCanvas) {
                console.log('🏔️ Elevation chart missing, initializing...');
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
            console.log('🗺️ Initializing new map instance for modal');
            console.log('📏 Container dimensions before map init:', {
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight,
                style: mapContainer.style.cssText
            });

            // Wait for container to be properly sized on mobile
            if (isMobile) {
                await new Promise(resolve => setTimeout(resolve, 300));
                console.log('📏 Container dimensions after wait:', {
                    width: mapContainer.offsetWidth,
                    height: mapContainer.offsetHeight
                });
            }

            // Initialize Leaflet map with proper sizing
            console.log('🗺️ Creating Leaflet map instance...');
            this.mapInstance = L.map('routeModalMap', {
                preferCanvas: true,
                zoomControl: true,
                attributionControl: true
            }).setView([38.6431, 34.8286], 10);

            console.log('✅ Map instance created successfully');
            console.log('📊 Map container info after creation:', {
                mapSize: this.mapInstance.getSize(),
                mapCenter: this.mapInstance.getCenter(),
                mapZoom: this.mapInstance.getZoom(),
                containerSize: this.mapInstance.getContainer().getBoundingClientRect()
            });

            // Initialize base layers
            this.initializeBaseLayers();

            // Wait for map to be ready, then display route with mobile-specific delays
            const mapDelay = isMobile ? 800 : 200;

            setTimeout(async () => {
                console.log('🗺️ Map ready, invalidating size and displaying route');
                console.log('📏 Final container dimensions:', {
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
                            console.log(`🔄 Mobile resize attempt ${i + 1}`);
                            this.mapInstance.invalidateSize();
                            if (i === 2) this.fitMapToRoute();
                        }, (i + 1) * 200);
                    }
                } else {
                    this.fitMapToRoute();
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
            console.log('🏛️ Loading POIs content for route:', this.currentRoute.name);
            console.log('📊 POI data in currentRoute:', {
                hasPois: !!(this.currentRoute.pois && this.currentRoute.pois.length > 0),
                poisCount: this.currentRoute.pois ? this.currentRoute.pois.length : 0,
                hasWaypoints: !!(this.currentRoute.waypoints && this.currentRoute.waypoints.length > 0),
                waypointsCount: this.currentRoute.waypoints ? this.currentRoute.waypoints.length : 0
            });

            let pois = [];

            // Get POIs from route data
            if (this.currentRoute.pois) {
                pois = this.currentRoute.pois;
                console.log('✅ Using POIs from currentRoute.pois:', pois.length);
            } else if (this.currentRoute.waypoints) {
                pois = this.currentRoute.waypoints;
                console.log('✅ Using waypoints from currentRoute.waypoints:', pois.length);
            } else {
                // Fetch POIs from API
                const apiBase = window.apiBase || '/api';
                console.log('📡 Fetching POIs from API:', `${apiBase}/routes/${this.currentRoute.id}`);

                const response = await fetch(`${apiBase}/routes/${this.currentRoute.id}`);
                console.log('📡 POIs API response status:', response.status, response.statusText);

                if (response.ok) {
                    const routeDetails = await response.json();
                    pois = routeDetails.pois || [];
                    console.log('✅ Fetched POIs from API:', pois.length);
                } else {
                    console.log('❌ Failed to fetch POIs from API:', response.status);
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
        const mediaContainer = document.getElementById('routeMediaGrid');
        if (!mediaContainer) return;

        try {
            console.log('🎬 Loading media content for route:', this.currentRoute.name);

            const apiBase = window.apiBase || '/api';
            console.log('📡 Fetching media content from:', `${apiBase}/admin/routes/${this.currentRoute.id}/media`);

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
                mediaContainer.innerHTML = `
                    <div class="route-media-empty">
                        <i class="fas fa-camera"></i>
                        <p>Bu rota için medya bulunmuyor</p>
                    </div>
                `;
                return;
            }

            // Render media items
            const mediaHTML = mediaFiles.map(media => {
                const isVideo = media.media_type === 'video' || media.path?.includes('.mp4');
                const isAudio = media.media_type === 'audio' || media.path?.includes('.mp3');

                // Debug media URL construction
                console.log('🎬 Media item URL construction:', {
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
                        console.log('🎯 Using original_path for full resolution');
                    } else if (media.full_path) {
                        mediaUrl = `/${media.full_path}`;
                        console.log('🎯 Using full_path for full resolution');
                    } else if (media.file_path) {
                        mediaUrl = `/${media.file_path}`;
                        console.log('🎯 Using file_path for full resolution');
                    } else if (media.path) {
                        mediaUrl = media.path.startsWith('/') ? media.path : `/${media.path}`;
                        console.log('🎯 Using path for full resolution');
                    } else if (media.filename) {
                        // For files served from root domain (like the error shows)
                        mediaUrl = `/${media.filename}`;
                        console.log('🎯 Using filename for full resolution');
                    } else {
                        // Last resort - serve from uploads directory
                        mediaUrl = `/uploads/${mediaUrl}`;
                        console.log('🎯 Using uploads directory as fallback');
                    }
                }

                console.log('🎬 Final media URL for display:', mediaUrl);

                let typeIcon = 'fas fa-file';
                if (isVideo) typeIcon = 'fas fa-play';
                else if (isAudio) typeIcon = 'fas fa-volume-up';
                else typeIcon = 'fas fa-image';

                return `
                    <div class="route-media-item" onclick="window.routeDetailsModalInstance.showMediaViewer('${mediaUrl}', '${media.media_type || 'image'}')">
                        ${isVideo ?
                        `<video src="${mediaUrl}" muted onload="this.classList.add('loaded')" onerror="console.error('Failed to load video:', '${mediaUrl}'); this.parentElement.style.display='none';"></video>` :
                        `<img src="${mediaUrl}" alt="${media.alt_text || 'Rota medyası'}" loading="lazy" onload="this.classList.add('loaded')" onerror="console.error('Failed to load image:', '${mediaUrl}'); this.parentElement.style.display='none';">`
                    }
                        <div class="route-media-type-icon">
                            <i class="${typeIcon}"></i>
                        </div>
                        <div class="route-media-overlay">
                            ${media.caption || media.alt_text || 'Medya'}
                        </div>
                    </div>
                `;
            }).join('');

            mediaContainer.innerHTML = mediaHTML;

        } catch (error) {
            console.error('❌ Error loading media:', error);
            mediaContainer.innerHTML = `
                <div class="route-media-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Medya yüklenirken hata oluştu</p>
                </div>
            `;
        }
    }

    async displayRouteOnMap() {
        if (!this.mapInstance || !this.currentRoute) {
            console.log('❌ Cannot display route on map - missing map instance or route data');
            return;
        }

        try {
            console.log('🗺️ Displaying enhanced route on modal map:', this.currentRoute.name);
            console.log('📊 Route data structure:', {
                hasPois: !!(this.currentRoute.pois && this.currentRoute.pois.length > 0),
                poisCount: this.currentRoute.pois ? this.currentRoute.pois.length : 0,
                hasWaypoints: !!(this.currentRoute.waypoints && this.currentRoute.waypoints.length > 0),
                waypointsCount: this.currentRoute.waypoints ? this.currentRoute.waypoints.length : 0,
                routeKeys: Object.keys(this.currentRoute)
            });

            // Ensure map is properly sized before adding content
            console.log('🗺️ Invalidating map size before displaying route');
            this.mapInstance.invalidateSize();

            // Clear existing layers
            this.mapInstance.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                    this.mapInstance.removeLayer(layer);
                }
            });

            // Add route geometry if available
            if (this.currentRoute.geometry) {
                console.log('🛣️ Adding route geometry to map');
                const geometry = typeof this.currentRoute.geometry === 'string'
                    ? JSON.parse(this.currentRoute.geometry)
                    : this.currentRoute.geometry;

                if (geometry.coordinates) {
                    const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    const routeLine = L.polyline(coordinates, {
                        color: '#4338ca',
                        weight: 4,
                        opacity: 0.8
                    }).addTo(this.mapInstance);

                    console.log('✅ Route geometry added successfully');
                }
            }

            // Add enhanced POI markers with detailed popups and modal integration
            const pois = this.currentRoute.pois || this.currentRoute.waypoints || [];
            console.log('📍 Processing POIs for markers:', pois.length, 'POIs found');

            if (pois.length === 0) {
                console.log('⚠️ No POIs found to display as markers');
            } else {
                console.log('📍 Adding POI markers to map...');
            }

            let markersAdded = 0;
            pois.forEach((poi, index) => {
                console.log(`📍 Processing POI ${index + 1}:`, poi.name || `POI ${index + 1}`);

                // More flexible coordinate detection
                const lat = poi.latitude || poi.lat || poi.coords?.[1] || poi.location?.lat || poi.position?.lat;
                const lng = poi.longitude || poi.lng || poi.lon || poi.coords?.[0] || poi.location?.lng || poi.position?.lng;

                console.log(`📍 POI ${index + 1} coordinates:`, {
                    lat, lng,
                    hasLat: !!lat,
                    hasLng: !!lng,
                    isValidLat: !isNaN(parseFloat(lat)),
                    isValidLng: !isNaN(parseFloat(lng))
                });

                if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    console.log(`✅ Creating marker for POI ${index + 1}: ${poi.name} at [${lat}, ${lng}]`);
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
                        console.log(`✅ POI marker ${index + 1} added successfully`);
                    } catch (markerError) {
                        console.error(`❌ Error creating marker for POI ${index + 1}:`, markerError);
                    }
                } else {
                    console.warn(`⚠️ Skipping POI ${index + 1} - invalid coordinates:`, { lat, lng });
                }
            });

            console.log(`📍 Total markers added: ${markersAdded} out of ${pois.length} POIs`);

            // Load and display media markers for the route
            await this.loadRouteMediaMarkers();

            // Fit map to show all markers with a delay to ensure everything is rendered
            setTimeout(() => {
                console.log('🎯 Fitting map to route after marker creation');
                this.fitMapToRoute();
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
            console.log('❌ Cannot load media markers - missing map instance or route data');
            return;
        }

        try {
            console.log('🎬 Loading media markers for route:', this.currentRoute.id || this.currentRoute._id);

            const routeId = this.currentRoute.id || this.currentRoute._id;
            if (!routeId) {
                console.log('❌ No route ID available for media markers');
                return;
            }

            const apiBase = window.apiBase || '/api';
            console.log('📡 Fetching media from:', `${apiBase}/admin/routes/${routeId}/media`);

            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media`, {
                credentials: 'include'
            });

            console.log('📡 Media API response status:', response.status, response.statusText);

            if (!response.ok) {
                console.log('ℹ️ No media found for route or access denied:', response.status);
                return;
            }

            const data = await response.json();
            console.log('📊 Raw media API response:', data);

            let mediaFiles = [];

            // Handle different response formats
            if (Array.isArray(data)) {
                mediaFiles = data;
            } else if (Array.isArray(data.media)) {
                mediaFiles = data.media;
            } else if (Array.isArray(data.files)) {
                mediaFiles = data.files;
            }

            console.log(`📊 Found ${mediaFiles.length} media files total`);

            // Filter media items that have location data
            const locatedMedia = mediaFiles.filter(media => {
                // More flexible coordinate detection
                const lat = media.latitude || media.lat || media.coords?.[1] || media.location?.lat || media.position?.lat;
                const lng = media.longitude || media.lng || media.lon || media.coords?.[0] || media.location?.lng || media.position?.lng;
                const hasLocation = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

                console.log(`📍 Media item location check:`, {
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

            console.log(`📍 Found ${locatedMedia.length} media items with location data out of ${mediaFiles.length} total`);

            if (locatedMedia.length === 0) {
                console.log('ℹ️ No media with location data found for this route');
                return;
            }

            console.log(`📍 Found ${locatedMedia.length} media items with location data`);

            // Also add image media markers to elevation chart overlay
            try {
                const imageOnly = locatedMedia.filter(m => {
                    const t = (m.media_type || '').toLowerCase();
                    const url = m.url || m.path || m.file_path || '';
                    return t === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
                }).map(m => ({
                    lat: m.latitude || m.lat || m.coords?.[1] || m.location?.lat || m.position?.lat,
                    lng: m.longitude || m.lng || m.lon || m.coords?.[0] || m.location?.lng || m.position?.lng,
                    media_type: (m.media_type || 'image'),
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

                console.log(`🎯 Creating media marker ${index + 1} at [${lat}, ${lng}]:`, media.caption || media.filename);

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

                console.log(`✅ Media marker ${index + 1} created successfully`);
            });

            console.log('✅ Media markers loaded successfully');

        } catch (error) {
            console.error('❌ Error loading media markers:', error);
        }
    }

    // Create media marker icon
    createMediaMarkerIcon(mediaType, media) {
        const iconSize = [24, 24];
        const iconAnchor = [12, 12];

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
        console.log('🎬 Creating media popup content for:', media);

        // Get raw media URL
        const rawMediaUrl = media.url || media.path || media.filename || '';
        const caption = media.caption || media.alt_text || 'Medya';
        const mediaType = media.media_type || 'image';

        console.log('🎬 Media popup details:', {
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
            console.log('❌ No media URL found for media item');
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

        console.log('🎬 Final media popup URL:', mediaUrl);

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
        console.log('🎯 Focusing on POI at:', lat, lng);

        if (this.mapInstance) {
            this.switchTab('map');
            setTimeout(() => {
                if (lat && lng) {
                    console.log('✅ Setting map view to:', [lat, lng]);
                    this.mapInstance.setView([lat, lng], 16);
                } else {
                    console.log('❌ Invalid coordinates for focusOnPoi:', lat, lng);
                }
            }, 300);
        } else {
            console.log('❌ Map instance not available for focusOnPoi');
        }
    }

    fitMapToRoute() {
        console.log('🔄 Fitting map to route');

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

        console.log(`📍 Found ${markers.length} markers and ${polylines.length} polylines on map`);

        // Collect all layers for bounds calculation
        const allLayers = [...markers, ...polylines];

        if (allLayers.length > 0) {
            try {
                const group = new L.featureGroup(allLayers);
                const bounds = group.getBounds();

                // Check if bounds are valid
                if (bounds.isValid()) {
                    console.log('🎯 Fitting to bounds:', bounds);

                    // Use different padding for mobile vs desktop
                    const isMobile = window.innerWidth <= 768;
                    const padding = isMobile ? [10, 10] : [20, 20];

                    this.mapInstance.fitBounds(bounds, {
                        padding: padding,
                        maxZoom: 16 // Prevent zooming too close
                    });
                    console.log('✅ Map fitted to route successfully');
                } else {
                    console.warn('⚠️ Invalid bounds, using default view');
                    this.mapInstance.setView([38.6431, 34.8286], 12);
                }
            } catch (error) {
                console.error('❌ Error fitting bounds:', error);
                this.mapInstance.setView([38.6431, 34.8286], 12);
            }
        } else {
            console.warn('⚠️ No markers or polylines found to fit to, using default view');
            this.mapInstance.setView([38.6431, 34.8286], 12);
        }
    }

    toggleFullscreenMap() {
        console.log('🔄 Toggling fullscreen map');

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
                console.log('✅ Exited fullscreen mode');
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
                console.log('✅ Entered fullscreen mode');
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
        console.log('🔄 Using fallback fullscreen mode');

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
                console.log('✅ Exited fallback fullscreen mode');
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
        console.log('Export route');
        // Implementation for route export
    }

    shareRoute() {
        console.log('Share route');
        // Implementation for route sharing
    }

    // Initialize elevation chart using Chart.js
    async initializeElevationChart() {
        if (!this.currentRoute) {
            console.log('❌ Cannot initialize elevation chart - no route data');
            return;
        }

        console.log('🏔️ Attempting to initialize elevation chart...');

        const container = document.getElementById('routeModalElevationContainer');
        if (!container) {
            console.error('❌ Elevation chart container not found');
            console.log('🔍 Available elements with "elevation" in ID:',
                Array.from(document.querySelectorAll('[id*="elevation"]')).map(el => el.id));
            return;
        }

        console.log('✅ Elevation chart container found:', container);

        try {
            console.log('🗺️ Initializing elevation chart for route details modal');

            // Clear any existing content
            container.innerHTML = '';

            // Create the elevation chart structure with proper styling
            container.innerHTML = `
                <div class="route-overview-section">
                    <h3><i class="fas fa-mountain"></i> Yükseklik Profili</h3>
                    <div class="elevation-chart-section">
                        <div class="elevation-toolbar" id="modalElevationToolbar">
                            <button class="elev-btn" id="elevToggleGradient" title="Renkli dolguyu aç/kapat">
                                <i class="fas fa-fill-drip"></i>
                                <span>Renk</span>
                            </button>
                            <button class="elev-btn" id="elevToggleMarkers" title="Medya işaretlerini aç/kapat">
                                <i class="fas fa-camera"></i>
                                <span>İşaretler</span>
                            </button>
                            <button class="elev-btn" id="elevEnableZoom" title="Sürükleyerek yakınlaştır">
                                <i class="fas fa-search-plus"></i>
                                <span>Yakınlaştır</span>
                            </button>
                            <button class="elev-btn" id="elevResetZoom" title="Yakınlaştırmayı sıfırla">
                                <i class="fas fa-compress-arrows-alt"></i>
                                <span>Sıfırla</span>
                            </button>
                            <button class="elev-btn" id="elevExpand" title="Grafiği genişlet">
                                <i class="fas fa-arrows-alt-v"></i>
                                <span>Genişlet</span>
                            </button>
                        </div>
                        <div class="elevation-header">
                            <div class="elevation-stats">
                                <span class="elevation-stat">
                                    <i class="fas fa-arrow-up"></i>
                                    <span id="modalMinElevation">--m</span>
                                </span>
                                <span class="elevation-stat">
                                    <i class="fas fa-arrow-down"></i>
                                    <span id="modalMaxElevation">--m</span>
                                </span>
                                <span class="elevation-stat">
                                    <i class="fas fa-trending-up"></i>
                                    <span id="modalTotalAscent">+--m</span>
                                </span>
                                <span class="elevation-stat">
                                    <i class="fas fa-trending-down"></i>
                                    <span id="modalTotalDescent">---m</span>
                                </span>
                            </div>
                        </div>
                        <div class="elevation-chart-container">
                            <canvas id="modalElevationChart" width="800" height="280"></canvas>
                            <div class="elevation-tooltip" id="modalElevationTooltip"></div>
                        </div>
                        <div class="elevation-distance-labels">
                            <span class="distance-start">0 km</span>
                            <span class="distance-end">-- km</span>
                        </div>
                    </div>
                </div>
            `;

            console.log('✅ Elevation chart HTML structure created successfully');

            // Wait for DOM to update before loading elevation data
            setTimeout(async () => {
                console.log('🏔️ DOM updated, checking for canvas...');
                const canvas = document.getElementById('modalElevationChart');
                console.log('🏔️ Canvas found:', !!canvas);

                // ULTRA AGGRESSIVE mobile canvas sizing
                const isMobile = window.innerWidth <= 768;
                if (canvas && isMobile) {
                    const viewportWidth = window.innerWidth || 375;
                    const viewportHeight = window.innerHeight || 667;
                    const canvasWidth = viewportWidth - 40;
                    const canvasHeight = Math.max(350, viewportHeight * 0.4);

                    // Force canvas container to be large
                    const canvasContainer = canvas.closest('.elevation-chart-container');
                    const chartSection = canvas.closest('.elevation-chart-section');

                    if (chartSection) {
                        chartSection.style.cssText = `
                            width: 100% !important;
                            min-height: ${canvasHeight + 100}px !important;
                            height: auto !important;
                            display: block !important;
                            background: #f8f9fa !important;
                            border: 3px solid #28a745 !important;
                            border-radius: 8px !important;
                            padding: 20px !important;
                            margin: 20px 0 !important;
                        `;
                    }

                    if (canvasContainer) {
                        canvasContainer.style.cssText = `
                            width: 100% !important;
                            height: ${canvasHeight}px !important;
                            min-height: ${canvasHeight}px !important;
                            display: block !important;
                            position: relative !important;
                        `;
                    }

                    // Force canvas size
                    canvas.style.cssText = `
                        width: ${canvasWidth}px !important;
                        height: ${canvasHeight}px !important;
                        max-width: 100% !important;
                        display: block !important;
                        margin: 0 auto !important;
                        border: 2px solid #007bff !important;
                        border-radius: 4px !important;
                    `;

                    // Set canvas attributes for high DPI
                    canvas.width = canvasWidth * 2;
                    canvas.height = canvasHeight * 2;

                    // Canvas sizing applied (log removed for cleaner console)
                }

                if (canvas) {
                    console.log('🏔️ Canvas details:', {
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
            console.log('❌ Cannot load elevation profile - missing route data');
            return;
        }

        try {
            console.log('🗺️ Loading elevation profile for route:', this.currentRoute.name);

            // Wait for canvas to be available with retry mechanism
            let canvas = document.getElementById('modalElevationChart');
            let retries = 0;
            const maxRetries = 20;

            while (!canvas && retries < maxRetries) {
                console.log(`🔄 Waiting for elevation canvas... attempt ${retries + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 150));
                canvas = document.getElementById('modalElevationChart');
                retries++;
            }

            if (!canvas) {
                console.error('❌ Elevation chart canvas not found after retries');
                // Try to create the canvas fallback
                const cont = document.querySelector('#routeModalElevationContainer .elevation-chart-container');
                if (cont) {
                    const fallback = document.createElement('canvas');
                    fallback.id = 'modalElevationChart';
                    fallback.width = 800;
                    fallback.height = 280;
                    cont.appendChild(fallback);
                    canvas = fallback;
                } else {
                    return;
                }
            }

            console.log('✅ Elevation canvas found, proceeding with chart creation');

            const ctx = canvas.getContext('2d');

            // Generate elevation data
            let elevationData = [];

            if (this.currentRoute.elevation_profile) {
                console.log('✅ Using pre-calculated elevation profile');
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
                console.log('🔄 Generating elevation data from route');
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
                console.log(`✅ Created ${elevationData.length} fallback elevation points`);
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

            console.log('✅ Elevation profile loaded successfully');

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

            console.log('📊 Generated elevation data points:', elevationData.length);
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

                    // Crosshair line
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
                        ctx.restore();
                    }

                    if (!self.showElevationMediaMarkers || !self.elevationMediaOverlayPoints || self.elevationMediaOverlayPoints.length === 0) {
                        self.elevationMediaScreenPoints = [];
                        return;
                    }

                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data) return;
                    const distances = (self.elevationDataForInteraction || []).map(d => d.distance);
                    const ctx2 = chart.ctx;
                    const screenPoints = [];

                    self.elevationMediaOverlayPoints.forEach((mp) => {
                        // Find nearest index by distance
                        let nearestIndex = 0;
                        let minDiff = Infinity;
                        for (let i = 0; i < distances.length; i++) {
                            const diff = Math.abs(distances[i] - mp.distance);
                            if (diff < minDiff) { minDiff = diff; nearestIndex = i; }
                        }
                        const pt = meta.data[nearestIndex];
                        if (!pt) return;
                        const x = pt.x;
                        const y = pt.y - 10;
                        const type = (mp.media && (mp.media.media_type || (mp.media.url||mp.media.path))) ? self.getMediaTypeFromUrl(mp.media.url || mp.media.path || '') : 'image';
                        const iconMap = { image: '📷', video: '🎥', audio: '🎵', model_3d: '🧊', unknown: '📍' };
                        const iconChar = iconMap[type] || iconMap.unknown;
                        ctx2.save();
                        ctx2.font = '16px sans-serif';
                        ctx2.textAlign = 'center';
                        ctx2.textBaseline = 'middle';
                        ctx2.fillText(iconChar, x, y);
                        ctx2.restore();
                        screenPoints.push({ x, y, media: mp.media, type });
                    });
                    self.elevationMediaScreenPoints = screenPoints;
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
                    borderColor: '#3b82f6',
                    backgroundColor: (c) => {
                        if (!self.useElevationGradient || !self.elevationDataForInteraction) return 'rgba(59, 130, 246, 0.1)';
                        const area = c.chart && c.chart.chartArea;
                        if (!area) return 'rgba(59, 130, 246, 0.1)';
                        const g = c.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
                        g.addColorStop(0, '#bde7bd');
                        g.addColorStop(0.5, '#ffd27f');
                        g.addColorStop(1, '#ff9b8e');
                        return g;
                    },
                    fill: true,
                    spanGaps: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const index = context[0].dataIndex;
                                return names[index];
                            },
                            label: function (context) {
                                const elevation = Number(context.parsed.y);
                                const distance = Number(context.parsed.x);
                                return [
                                    `Yükseklik: ${elevation.toFixed(2)}m`,
                                    `Mesafe: ${distance.toFixed(2)}km`
                                ];
                            }
                        }
                    }
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
                        ticks: {
                            maxTicksLimit: 6,
                            callback: (val) => `${Number(val).toFixed(2)}km`
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: false
                        },
                        ticks: {
                            callback: function (value) {
                                return value + 'm';
                            }
                        }
                    }
                }
            },
            plugins: [mediaMarkersPlugin]
        });

        // Store elevation data for mouse interaction (ensure set)
        this.elevationDataForInteraction = elevationData;

        // Add mouse event handlers for map synchronization
        this.addChartMouseHandlers(canvas, elevationData);

        // Update statistics
        this.updateElevationStats(elevationData, routeTotalKm);

        console.log('✅ Chart.js elevation chart created successfully');
    }

    addChartMouseHandlers(canvas, elevationData) {
        const tooltip = document.getElementById('modalElevationTooltip');
        let isHovering = false;

        const handleMouseMove = (event) => {
            if (!this.mapInstance || !elevationData.length) return;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Save for crosshair rendering
            this._elevMouseX = x;
            if (this.elevationChartInstance) this.elevationChartInstance.draw();

            // Check if mouse is within chart area
            const chart = this.elevationChartInstance;
            const area = chart && chart.chartArea ? chart.chartArea : {left: 40, right: rect.width - 40, top: 20, bottom: rect.height - 20};
            if (x < area.left || x > area.right || y < area.top || y > area.bottom) {
                this.hideElevationTooltip();
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
                // Show tooltip
                this.showElevationTooltip(event.clientX, event.clientY, closestPoint);

                // Update map marker
                this.updateMapMarkerForElevation(closestPoint);

                // Store current position for cleanup
                this.currentElevationPosition = closestPoint;
            }
        };

        const handleMouseLeave = () => {
            this.hideElevationTooltip();
            this.removeMapMarker();
            this.currentElevationPosition = null;
            this._elevMouseX = null;
            if (this.elevationChartInstance) this.elevationChartInstance.draw();
        };

        const handleClick = (event) => {
            const rect = canvas.getBoundingClientRect();
            const cx = event.clientX - rect.left;
            const cy = event.clientY - rect.top;

            // First: try media marker hit-test (open viewer)
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

            // Otherwise: center map on current elevation position
            if (!this.currentElevationPosition || !this.mapInstance) return;
            this.mapInstance.setView(
                [this.currentElevationPosition.lat, this.currentElevationPosition.lng],
                this.mapInstance.getZoom()
            );
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
                    return t === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
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

    showMediaViewer(mediaUrl, mediaType) {
        console.log('🎬 Show media viewer:', mediaUrl, mediaType);

        if (!mediaUrl) {
            console.error('❌ No media URL provided to showMediaViewer');
            return;
        }

        // Test the media URL to see if it's accessible
        this.testMediaUrl(mediaUrl).then(isAccessible => {
            if (!isAccessible) {
                console.warn('⚠️ Media URL not accessible, trying alternative patterns...');
                return this.findWorkingMediaUrl(mediaUrl);
            }
            return mediaUrl;
        }).then(workingUrl => {
            if (workingUrl) {
                this.createMediaViewerModal(workingUrl, mediaType);
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
            console.log('❌ Media URL test failed:', url, error);
            return false;
        }
    }

    async findWorkingMediaUrl(originalUrl) {
        console.log('🔍 Finding working media URL for:', originalUrl);

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
            console.log('🔍 Testing URL pattern:', pattern);
            if (await this.testMediaUrl(pattern)) {
                console.log('✅ Found working URL:', pattern);
                return pattern;
            }
        }

        console.log('❌ No working URL pattern found');
        return null;
    }

    createMediaViewerModal(mediaUrl, mediaType) {
        // Create a media viewer modal with loading state
        const viewerModal = document.createElement('div');
        viewerModal.className = 'media-viewer-modal';
        viewerModal.innerHTML = `
            <div class="media-viewer-overlay" onclick="this.parentElement.remove()"></div>
            <div class="media-viewer-content">
                <button class="media-viewer-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="media-viewer-body">
                    <div class="media-viewer-loading">
                        <div class="media-viewer-spinner"></div>
                        <p>Medya yükleniyor...</p>
                    </div>
                    <div class="media-viewer-content-wrapper" style="display: none;">
                        ${mediaType === 'video' ?
                `<video src="${mediaUrl}" controls autoplay style="max-width: 100%; max-height: 80vh;" onload="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" onerror="console.error('Failed to load video in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Video yüklenemedi</p>'"></video>` :
                mediaType === 'audio' ?
                    `<audio src="${mediaUrl}" controls autoplay style="width: 100%;" onload="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" onerror="console.error('Failed to load audio in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Ses dosyası yüklenemedi</p>'"></audio>` :
                    `<img src="${mediaUrl}" alt="Media" style="max-width: 100%; max-height: 80vh; object-fit: contain;" onload="this.parentElement.style.display='block'; this.parentElement.previousElementSibling.style.display='none';" onerror="console.error('Failed to load image in viewer:', '${mediaUrl}'); this.parentElement.innerHTML='<p>Resim yüklenemedi</p>'">`
            }
                    </div>
                </div>
            </div>
        `;

        // Prefer to contain the viewer within the media tab content so tabs remain clickable
        const mediaTab = this.modal.querySelector('.route-details-tab-content[data-tab="media"]');
        if (mediaTab) {
            mediaTab.appendChild(viewerModal);
        } else {
            document.body.appendChild(viewerModal);
        }
        console.log('✅ Media viewer modal created with URL:', mediaUrl);
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
        console.log('🗺️ Initializing base layers for modal map');

        // Define available base layers (same as main map)
        const baseLayers = {
            "🗺️ OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 20
            }),
            "🛰️ Uydu Görüntüsü": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, Earthstar Geographics',
                maxZoom: 19
            }),
            "🏔️ Topografik": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap (CC-BY-SA)',
                maxZoom: 17
            }),
            "🎨 CartoDB Positron": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CartoDB',
                maxZoom: 19
            }),
            "🌙 CartoDB Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CartoDB',
                maxZoom: 19
            })
        };

        // Add default layer to map and create layer control
        baseLayers["🗺️ OpenStreetMap"].addTo(this.mapInstance);
        L.control.layers(baseLayers).addTo(this.mapInstance);

        console.log('✅ Base layers initialized successfully');
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
            if (this.mapInstance && this.isVisible && this.currentTab === 'map') {
                console.log('🔄 Window resized, invalidating map size');
                const isMobile = window.innerWidth <= 768;
                const delay = isMobile ? 300 : 100;

                setTimeout(() => {
                    this.mapInstance.invalidateSize();
                    this.fitMapToRoute();

                    // Force elevation chart refresh on mobile
                    if (isMobile && this.elevationChartInstance) {
                        setTimeout(() => {
                            this.elevationChartInstance.resize();
                        }, 200);
                    }
                }, delay);
            }
        };

        // Handle orientation changes on mobile devices
        this.orientationListener = () => {
            console.log('📱 Orientation changed, refreshing map and chart');
            setTimeout(() => {
                if (this.mapInstance && this.isVisible && this.currentTab === 'map') {
                    this.mapInstance.invalidateSize();
                    this.fitMapToRoute();

                    // Refresh elevation chart after orientation change
                    if (this.elevationChartInstance) {
                        setTimeout(() => {
                            this.elevationChartInstance.resize();
                        }, 300);
                    }
                }
            }, 500); // Longer delay for orientation change
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal instance
    RouteDetailsModal.getInstance();
});

// Make it globally available
window.RouteDetailsModal = RouteDetailsModal;

// Global function to show route details
window.showRouteDetails = function (routeData) {
    console.log('🎯 Global showRouteDetails called with:', routeData);
    const modal = RouteDetailsModal.getInstance();
    if (modal) {
        modal.show(routeData);
    } else {
        console.error('❌ Route details modal not available');
    }
};

// Global function to test elevation chart
window.testElevationChart = function () {
    console.log('🧪 Testing elevation chart functionality');

    // Check for any duplicate elevation canvases
    const canvases = document.querySelectorAll('canvas[id*="levation"]');
    console.log(`📊 Found ${canvases.length} elevation-related canvases:`, canvases);

    if (canvases.length > 1) {
        console.warn('⚠️ Multiple elevation canvases detected! This might cause issues.');
        canvases.forEach((canvas, index) => {
            console.log(`Canvas ${index + 1}:`, canvas.id, canvas);
        });
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js is not loaded! Elevation chart will not work.');
        return;
    } else {
        console.log('✅ Chart.js is loaded and available');
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
    console.log('✅ Test route loaded, switch to Map tab to see elevation chart');
    console.log('💡 Tip: The elevation chart will show simulated elevation data for the Cappadocia region');
    console.log('🔍 Check browser console for canvas count and debug info');
    console.log('🎯 To test synchronization: Move your mouse over the elevation chart and watch the blue dot move on the map!');
    console.log('🖱️ Click on the elevation chart to center the map on that position');
};

// Global function for showing route details (main entry point)
window.showRouteDetails = async function (routeIdOrData) {
    console.log('🎯 showRouteDetails called with:', routeIdOrData);

    try {
        let routeData;

        // If it's a number/string, fetch route data from API
        if (typeof routeIdOrData === 'string' || typeof routeIdOrData === 'number') {
            const routeId = routeIdOrData;
            console.log('📡 Fetching route data for ID:', routeId);

            const apiBase = window.apiBase || '/api';
            const response = await fetch(`${apiBase}/routes/${routeId}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            routeData = data.route || data;
            console.log('✅ Route data fetched successfully:', routeData.name);
        }
        // If it's already an object, use it directly
        else if (typeof routeIdOrData === 'object' && routeIdOrData !== null) {
            routeData = routeIdOrData;
            console.log('✅ Using provided route data:', routeData.name);
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
            console.log('✅ Showing route modal for:', routeData.name);
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
