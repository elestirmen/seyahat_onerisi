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
                            
                            <div class="route-overview-section" id="routeElevationSection">
                                <h3><i class="fas fa-mountain"></i> Yükseklik Profili</h3>
                                <div class="route-elevation-container">
                                    <canvas id="routeElevationChart" width="400" height="200"></canvas>
                                    <div class="elevation-stats" id="routeElevationStats">
                                        <span>Min: <span id="minElevation">--m</span></span>
                                        <span>Max: <span id="maxElevation">--m</span></span>
                                        <span>↗ <span id="totalAscent">--m</span></span>
                                        <span>↘ <span id="totalDescent">--m</span></span>
                                    </div>
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
            fitBtn.addEventListener('click', () => {
                this.fitMapToRoute();
            });
        }

        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreenMap();
            });
        }
    }

    async show(routeData) {
        console.log('🎯 Showing route details modal with data:', routeData);
        
        this.currentRoute = routeData;
        this.updateHeader(routeData);
        
        // Show modal with animation
        this.modal.classList.add('show');
        this.isVisible = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Load content for current tab
        await this.loadTabContent(this.currentTab);
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
        if (this.elevationChart) {
            this.elevationChart.destroy();
            this.elevationChart = null;
        }
        
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
        
        // Load elevation profile
        await this.loadElevationProfile();
    }

    async loadMapContent() {
        if (this.mapInstance) {
            // Map already initialized, just fit to route
            this.fitMapToRoute();
            return;
        }
        
        const mapContainer = document.getElementById('routeModalMap');
        if (!mapContainer) return;
        
        try {
            // Initialize Leaflet map
            this.mapInstance = L.map('routeModalMap').setView([38.6431, 34.8286], 10);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.mapInstance);
            
            // Display route on map
            await this.displayRouteOnMap();
            
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
            let pois = [];
            
            // Get POIs from route data
            if (this.currentRoute.pois) {
                pois = this.currentRoute.pois;
            } else if (this.currentRoute.waypoints) {
                pois = this.currentRoute.waypoints;
            } else {
                // Fetch POIs from API
                const response = await fetch(`${window.apiBase}/routes/${this.currentRoute.id}`);
                if (response.ok) {
                    const routeDetails = await response.json();
                    pois = routeDetails.pois || [];
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
            const response = await fetch(`${window.apiBase}/admin/routes/${this.currentRoute.id}/media`, {
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
                const mediaUrl = media.url || media.path || media.filename;
                
                let typeIcon = 'fas fa-file';
                if (isVideo) typeIcon = 'fas fa-play';
                else if (isAudio) typeIcon = 'fas fa-volume-up';
                else typeIcon = 'fas fa-image';
                
                return `
                    <div class="route-media-item" onclick="window.routeDetailsModalInstance.showMediaViewer('${mediaUrl}', '${media.media_type || 'image'}')">
                        ${isVideo ? 
                            `<video src="${mediaUrl}" muted></video>` : 
                            `<img src="${mediaUrl}" alt="${media.alt_text || 'Rota medyası'}" loading="lazy">`
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
        if (!this.mapInstance || !this.currentRoute) return;
        
        try {
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
            
            // Add POI markers
            const pois = this.currentRoute.pois || this.currentRoute.waypoints || [];
            pois.forEach((poi, index) => {
                const lat = poi.latitude || poi.lat;
                const lng = poi.longitude || poi.lng;
                
                if (lat && lng) {
                    const categoryStyle = this.getCategoryStyle(poi.category);
                    
                    L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-poi-marker',
                            html: `
                                <div style="
                                    background: ${categoryStyle.color};
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-weight: bold;
                                    border: 3px solid white;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                ">
                                    ${index + 1}
                                </div>
                            `,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    })
                    .bindPopup(`
                        <div>
                            <h6>${poi.name}</h6>
                            <p>${poi.description || ''}</p>
                        </div>
                    `)
                    .addTo(this.mapInstance);
                }
            });
            
            // Fit map to show all markers
            this.fitMapToRoute();
            
        } catch (error) {
            console.error('❌ Error displaying route on map:', error);
        }
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
        if (this.mapInstance) {
            this.switchTab('map');
            setTimeout(() => {
                this.mapInstance.setView([lat, lng], 16);
            }, 300);
        }
    }

    fitMapToRoute() {
        if (!this.mapInstance) return;
        
        const markers = [];
        this.mapInstance.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            }
        });
        
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            this.mapInstance.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    }

    toggleFullscreenMap() {
        // Implementation for fullscreen map
        console.log('Toggle fullscreen map');
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

    async loadElevationProfile() {
        // Implementation for elevation profile loading
        console.log('Load elevation profile');
    }

    showMediaViewer(mediaUrl, mediaType) {
        // Implementation for media viewer
        console.log('Show media viewer:', mediaUrl, mediaType);
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
        // Use existing category style functions from the main app
        if (window.getCategoryStyle) {
            return window.getCategoryStyle(category);
        }
        
        // Fallback styles
        return {
            color: '#6366f1',
            iconClass: 'fas fa-map-marker-alt'
        };
    }

    getCategoryDisplayName(category) {
        // Use existing category display name functions from the main app
        if (window.getCategoryDisplayName) {
            return window.getCategoryDisplayName(category);
        }
        
        // Fallback
        return category || 'Kategori';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal instance
    RouteDetailsModal.getInstance();
});

// Make it globally available
window.RouteDetailsModal = RouteDetailsModal;