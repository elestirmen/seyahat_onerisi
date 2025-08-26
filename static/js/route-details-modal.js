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
                    
                    <div class="route-details-tabs" id="routeModalTabs">
                        <button class="route-details-tab active" data-tab="overview">
                            <i class="fas fa-info-circle"></i>
                            <span>Genel Bilgi</span>
                        </button>
                        <button class="route-details-tab" data-tab="map">
                            <i class="fas fa-map"></i>
                            <span>Harita</span>
                        </button>
                        <button class="route-details-tab" data-tab="pois">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Duraklar</span>
                        </button>
                        <button class="route-details-tab" data-tab="media">
                            <i class="fas fa-camera"></i>
                            <span>Medya</span>
                        </button>
                    </div>
                    
                    <div class="route-details-modal-body" id="routeModalBody">
                        <!-- Overview Tab -->
                        <div class="route-details-tab-content active" data-tab="overview">
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
                        <div class="route-details-tab-content" data-tab="map">
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
                        <div class="route-details-tab-content" data-tab="pois">
                            <div class="route-pois-list" id="routePoisList">
                                <div class="route-details-loading">
                                    <i class="fas fa-spinner"></i>
                                    <p>Duraklar yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Media Tab -->
                        <div class="route-details-tab-content" data-tab="media">
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

        // Attach map control listeners after modal HTML is created
        setTimeout(() => {
            console.log('🎯 Attaching map control listeners after modal show');
            this.attachMapControlListeners();
        }, 100);

        // Load content for current tab
        await this.loadTabContent(this.currentTab);

        // Initialize elevation chart if we're on the map tab
        if (this.currentTab === 'map') {
            setTimeout(() => {
                this.initializeElevationChart();
            }, 200);
        }
    }

    hide() {
        console.log('🎯 Hiding route details modal');
        
        this.modal.classList.remove('show');
        this.isVisible = false;
        
        // Restore body scroll
        document.body.style.overflow = '';
        
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
        
        // Update tab buttons
        document.querySelectorAll('.route-details-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.route-details-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
        
        this.currentTab = tabName;

        // Load content for new tab
        await this.loadTabContent(tabName);

        // Initialize elevation chart if switching to map tab
        if (tabName === 'map' && !this.elevationChart) {
            setTimeout(() => {
                this.initializeElevationChart();
            }, 200);
        }
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
        if (this.mapInstance) {
            // Map already initialized, just fit to route and load elevation
            this.fitMapToRoute();
            await this.loadElevationProfile();
            return;
        }

        const mapContainer = document.getElementById('routeModalMap');
        if (!mapContainer) return;

        try {
            // Initialize Leaflet map
            this.mapInstance = L.map('routeModalMap').setView([38.6431, 34.8286], 10);

            // Initialize base layers
            this.initializeBaseLayers();

            // Display route on map
            await this.displayRouteOnMap();

            // Initialize elevation chart
            await this.initializeElevationChart();

            // Load elevation profile for the map tab
            await this.loadElevationProfile();

        } catch (error) {
            console.error('❌ Error initializing map:', error);
            mapContainer.innerHTML = `
                <div class="route-details-loading">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Harita yüklenirken hata oluştu</p>
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

            // Clear existing layers
            this.mapInstance.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                    this.mapInstance.removeLayer(layer);
                }
            });

            // Add route geometry if available
            if (this.currentRoute.geometry) {
                const geometry = typeof this.currentRoute.geometry === 'string'
                    ? JSON.parse(this.currentRoute.geometry)
                    : this.currentRoute.geometry;

                if (geometry.coordinates) {
                    const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    L.polyline(coordinates, {
                        color: '#4338ca',
                        weight: 4,
                        opacity: 0.8
                    }).addTo(this.mapInstance);
                }
            }

            // Add enhanced POI markers with detailed popups and modal integration
            const pois = this.currentRoute.pois || this.currentRoute.waypoints || [];
            console.log('📍 Processing POIs for markers:', pois);

            if (pois.length === 0) {
                console.log('⚠️ No POIs found to display as markers');
            }

            pois.forEach((poi, index) => {
                console.log(`📍 Processing POI ${index + 1}:`, poi);

                // More flexible coordinate detection
                const lat = poi.latitude || poi.lat || poi.coords?.[1] || poi.location?.lat || poi.position?.lat;
                const lng = poi.longitude || poi.lng || poi.lon || poi.coords?.[0] || poi.location?.lng || poi.position?.lng;

                console.log(`📍 POI ${index + 1} coordinates:`, {
                    lat, lng,
                    hasLat: !!lat,
                    hasLng: !!lng,
                    coordinateFields: {
                        latitude: poi.latitude,
                        lat: poi.lat,
                        longitude: poi.longitude,
                        lng: poi.lng,
                        lon: poi.lon,
                        coords: poi.coords,
                        location: poi.location,
                        position: poi.position
                    }
                });

                if (lat && lng) {
                    console.log(`✅ Creating marker for POI ${index + 1}: ${poi.name} at [${lat}, ${lng}]`);
                    const categoryStyle = this.getCategoryStyle(poi.category);
                    
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-poi-marker',
                            html: `
                                <div class="poi-marker-container" style="background-color: ${categoryStyle.color}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); transition: transform 0.2s ease;">
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
                    
                    // Add hover effects
                    marker.on('mouseover', function() {
                        this.getElement().querySelector('.poi-marker-container').style.transform = 'scale(1.1)';
                    });
                    
                    marker.on('mouseout', function() {
                        this.getElement().querySelector('.poi-marker-container').style.transform = 'scale(1)';
                    });
                }
            });
            
            // Load and display media markers for the route
            await this.loadRouteMediaMarkers();
            
            // Fit map to show all markers
            this.fitMapToRoute();
            
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
        if (event.key === 'Escape' && this.isVisible) {
            this.hide();
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

        const markers = [];
        this.mapInstance.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            }
        });

        console.log(`📍 Found ${markers.length} markers on map`);

        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            const bounds = group.getBounds();
            console.log('🎯 Fitting to bounds:', bounds);
            this.mapInstance.fitBounds(bounds, { padding: [20, 20] });
            console.log('✅ Map fitted to route successfully');
        } else {
            console.warn('⚠️ No markers found to fit to');
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
        if (this.currentRoute) {
            // Open in Google Maps or other navigation app
            const route = this.currentRoute;
            const pois = route.pois || route.waypoints || [];
            
            if (pois.length > 0) {
                const firstPoi = pois[0];
                const lat = firstPoi.latitude || firstPoi.lat;
                const lng = firstPoi.longitude || firstPoi.lng;
                
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                window.open(googleMapsUrl, '_blank');
            }
        }
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
        if (!this.currentRoute) return;

        const container = document.getElementById('routeModalElevationContainer');
        if (!container) {
            console.error('❌ Elevation chart container not found');
            return;
        }

        try {
            console.log('🗺️ Initializing elevation chart for route details modal');

            // Clear any existing content
            container.innerHTML = '';

            // Create the elevation chart structure with proper styling
            container.innerHTML = `
                <div class="route-overview-section">
                    <h3><i class="fas fa-mountain"></i> Yükseklik Profili</h3>
                    <div class="elevation-chart-section">
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
                            <canvas id="modalElevationChart" width="400" height="120"></canvas>
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

            // Load elevation data
            await this.loadElevationProfile();

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

            const canvas = document.getElementById('modalElevationChart');
            if (!canvas) {
                console.error('❌ Elevation chart canvas not found');
                return;
            }

            const ctx = canvas.getContext('2d');

            // Generate elevation data
            let elevationData = [];

            if (this.currentRoute.elevation_profile) {
                console.log('✅ Using pre-calculated elevation profile');
                elevationData = this.currentRoute.elevation_profile.points || [];
            } else {
                console.log('🔄 Generating elevation data from route');
                elevationData = await this.generateElevationData();
            }

            if (!elevationData || elevationData.length === 0) {
                console.warn('⚠️ No elevation data available');
                this.showElevationError('Yükseklik verisi bulunamadı');
                return;
            }

            // Create Chart.js elevation chart
            await this.createElevationChart(ctx, elevationData);

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

                    if (lat && lng) {
                        // Calculate cumulative distance
                        if (i > 0) {
                            const prevPoi = route.pois[i - 1];
                            const distance = this.calculateDistance(
                                prevPoi.latitude || prevPoi.lat,
                                prevPoi.longitude || prevPoi.lng,
                                lat, lng
                            );
                            totalDistance += distance;
                        }

                        const elevation = this.generateSimulatedElevation(lat, lng);

                        elevationData.push({
                            distance: totalDistance,
                            elevation: elevation,
                            name: poi.name
                        });
                    }
                }
            }

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
            return `${(d.distance).toFixed(1)}km`;
        });

        const elevations = elevationData.map(d => d.elevation);
        const names = elevationData.map(d => d.name || `Nokta ${elevationData.indexOf(d) + 1}`);

        // Set canvas dimensions
        const canvas = document.getElementById('modalElevationChart');
        canvas.width = 400;
        canvas.height = 120;
        canvas.style.width = '100%';
        canvas.style.height = '120px';

        // Create Chart.js chart
        this.elevationChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Yükseklik (m)',
                    data: elevations,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
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
                                const elevation = context.parsed.y;
                                const distance = elevationData[context.dataIndex].distance;
                                return [
                                    `Yükseklik: ${elevation}m`,
                                    `Mesafe: ${distance.toFixed(1)}km`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + 'm';
                            }
                        }
                    }
                }
            }
        });

        // Store elevation data for mouse interaction
        this.elevationDataForInteraction = elevationData;

        // Add mouse event handlers for map synchronization
        this.addChartMouseHandlers(canvas, elevationData);

        // Update statistics
        this.updateElevationStats(elevationData);

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

            // Check if mouse is within chart area
            const padding = 40; // Chart.js default padding
            if (x < padding || x > rect.width - padding || y < padding || y > rect.height - padding) {
                this.hideElevationTooltip();
                this.removeMapMarker();
                return;
            }

            // Calculate position along the route based on mouse X position
            const chartWidth = rect.width - (padding * 2);
            const relativeX = (x - padding) / chartWidth;
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
        };

        const handleClick = (event) => {
            if (!this.currentElevationPosition || !this.mapInstance) return;

            // Center map on clicked position
            this.mapInstance.setView(
                [this.currentElevationPosition.lat, this.currentElevationPosition.lng],
                this.mapInstance.getZoom()
            );
        };

        // Add event listeners
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('click', handleClick);

        // Store references for cleanup
        this.chartEventListeners = {
            canvas,
            handleMouseMove,
            handleMouseLeave,
            handleClick
        };
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

    updateElevationStats(elevationData) {
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

        if (minEl) minEl.textContent = `${minElevation}m`;
        if (maxEl) maxEl.textContent = `${maxElevation}m`;
        if (ascentEl) ascentEl.textContent = `+${Math.round(totalAscent)}m`;
        if (descentEl) descentEl.textContent = `-${Math.round(totalDescent)}m`;

        // Update distance labels
        const startLabel = document.querySelector('.distance-start');
        const endLabel = document.querySelector('.distance-end');

        if (startLabel) startLabel.textContent = '0 km';
        if (endLabel && elevationData.length > 0) {
            const maxDistance = Math.max(...elevationData.map(d => d.distance));
            endLabel.textContent = `${maxDistance.toFixed(1)} km`;
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

        document.body.appendChild(viewerModal);
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal instance
    RouteDetailsModal.getInstance();
});

// Make it globally available
window.RouteDetailsModal = RouteDetailsModal;

// Global function to show route details
window.showRouteDetails = function(routeData) {
    console.log('🎯 Global showRouteDetails called with:', routeData);
    const modal = RouteDetailsModal.getInstance();
    if (modal) {
        modal.show(routeData);
    } else {
        console.error('❌ Route details modal not available');
    }
};

// Global function to test elevation chart
window.testElevationChart = function() {
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

// Global function for media type detection (consistent with main system)
window.getMediaTypeFromPath = function(path) {
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
