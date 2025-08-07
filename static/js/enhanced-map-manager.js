/**
 * Enhanced Map Manager
 * Comprehensive map management for POI and Route administration
 * Supports layer management, import preview, and touch optimizations
 */

class EnhancedMapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.layers = {
            pois: new Map(),
            routes: new Map(),
            preview: null,
            clusters: null
        };
        this.markers = {
            pois: new Map(),
            routes: new Map(),
            preview: []
        };
        this.controls = {};
        this.options = {
            center: [38.6431, 34.8331],
            zoom: 11,
            enableClustering: true,
            enableTouch: true,
            maxZoom: 18,
            minZoom: 8,
            ...options
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        
        // Touch optimization instance
        this.touchOptimizer = null;
        
        // Layer visibility state
        this.layerVisibility = {
            pois: true,
            routes: true,
            preview: true
        };
        
        this.init();
    }

    /**
     * Initialize the map and all components
     */
    async init() {
        try {
            await this.initializeMap();
            this.setupLayers();
            this.setupControls();
            
            if (this.options.enableTouch) {
                this.initializeTouchOptimizations();
            }
            
            this.setupEventListeners();
            console.log('EnhancedMapManager initialized successfully');
        } catch (error) {
            console.error('Error initializing EnhancedMapManager:', error);
            throw error;
        }
    }

    /**
     * Initialize the Leaflet map
     */
    async initializeMap() {
        if (!document.getElementById(this.containerId)) {
            throw new Error(`Map container '${this.containerId}' not found`);
        }

        this.map = L.map(this.containerId, {
            center: this.options.center,
            zoom: this.options.zoom,
            maxZoom: this.options.maxZoom,
            minZoom: this.options.minZoom,
            zoomControl: false, // We'll add custom controls
            attributionControl: true
        });

        // Add base tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.options.maxZoom
        }).addTo(this.map);

        // Wait for map to be ready
        return new Promise((resolve) => {
            this.map.whenReady(() => {
                resolve();
            });
        });
    }

    /**
     * Setup layer groups for different data types
     */
    setupLayers() {
        // POI layer with clustering if enabled
        if (this.options.enableClustering && typeof L.markerClusterGroup === 'function') {
            try {
                this.layers.clusters = L.markerClusterGroup({
                    chunkedLoading: true,
                    maxClusterRadius: 50,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true
                });
                this.map.addLayer(this.layers.clusters);
            } catch (error) {
                console.warn('MarkerCluster not available, falling back to regular layer:', error);
                this.options.enableClustering = false;
                this.layers.pois = L.layerGroup().addTo(this.map);
            }
        }

        // Route layer group
        this.layers.routes = L.layerGroup().addTo(this.map);
        
        // Preview layer group (for import preview)
        this.layers.preview = L.layerGroup().addTo(this.map);
        
        // POI layer group (if clustering is disabled or failed)
        if (!this.options.enableClustering) {
            this.layers.pois = L.layerGroup().addTo(this.map);
        }
    }

    /**
     * Setup custom map controls
     */
    setupControls() {
        // Custom zoom control
        this.controls.zoom = L.control.zoom({
            position: 'topright'
        }).addTo(this.map);

        // Layer control
        this.controls.layers = this.createLayerControl();
        
        // Fullscreen control
        this.controls.fullscreen = this.createFullscreenControl();
        
        // Location control
        this.controls.location = this.createLocationControl();
    }

    /**
     * Create layer visibility control
     */
    createLayerControl() {
        const layerControl = L.control({ position: 'topleft' });
        
        layerControl.onAdd = (map) => {
            const container = L.DomUtil.create('div', 'map-layer-control');
            container.innerHTML = `
                <div class="layer-control-header">
                    <i class="fas fa-layer-group"></i>
                    <span>Katmanlar</span>
                </div>
                <div class="layer-control-content">
                    <label class="layer-toggle">
                        <input type="checkbox" id="toggle-pois" checked>
                        <span>POI'ler</span>
                    </label>
                    <label class="layer-toggle">
                        <input type="checkbox" id="toggle-routes" checked>
                        <span>Rotalar</span>
                    </label>
                    <label class="layer-toggle">
                        <input type="checkbox" id="toggle-preview" checked>
                        <span>Önizleme</span>
                    </label>
                </div>
            `;

            // Event listeners for layer toggles
            container.querySelector('#toggle-pois').addEventListener('change', (e) => {
                this.togglePOILayer(e.target.checked);
            });
            
            container.querySelector('#toggle-routes').addEventListener('change', (e) => {
                this.toggleRouteLayer(e.target.checked);
            });
            
            container.querySelector('#toggle-preview').addEventListener('change', (e) => {
                this.togglePreviewLayer(e.target.checked);
            });

            L.DomEvent.disableClickPropagation(container);
            return container;
        };

        return layerControl.addTo(this.map);
    }

    /**
     * Create fullscreen control
     */
    createFullscreenControl() {
        const fullscreenControl = L.control({ position: 'topright' });
        
        fullscreenControl.onAdd = (map) => {
            const container = L.DomUtil.create('div', 'map-fullscreen-control');
            const button = L.DomUtil.create('button', 'map-control-btn', container);
            button.innerHTML = '<i class="fas fa-expand"></i>';
            button.title = 'Tam Ekran';
            
            button.addEventListener('click', () => {
                this.toggleFullscreen();
            });

            L.DomEvent.disableClickPropagation(container);
            return container;
        };

        return fullscreenControl.addTo(this.map);
    }

    /**
     * Create location control
     */
    createLocationControl() {
        const locationControl = L.control({ position: 'topright' });
        
        locationControl.onAdd = (map) => {
            const container = L.DomUtil.create('div', 'map-location-control');
            const button = L.DomUtil.create('button', 'map-control-btn', container);
            button.innerHTML = '<i class="fas fa-location-arrow"></i>';
            button.title = 'Konumuma Git';
            
            button.addEventListener('click', () => {
                this.goToUserLocation();
            });

            L.DomEvent.disableClickPropagation(container);
            return container;
        };

        return locationControl.addTo(this.map);
    }

    /**
     * Initialize touch optimizations
     */
    initializeTouchOptimizations() {
        // Check if device supports touch
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouchDevice) {
            // Enhance map options for touch
            this.map.options.zoomSnap = 0.5;
            this.map.options.zoomDelta = 0.5;
            this.map.options.inertia = true;
            this.map.options.inertiaDeceleration = 3000;
            
            // Add touch-specific styles
            document.getElementById(this.containerId).classList.add('touch-optimized');
            
            // Initialize touch optimizer if available
            if (typeof TouchOptimizer !== 'undefined') {
                this.touchOptimizer = new TouchOptimizer();
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Map events
        this.map.on('click', (e) => {
            this.emit('mapClick', e);
        });
        
        this.map.on('dblclick', (e) => {
            this.emit('mapDoubleClick', e);
        });
        
        this.map.on('zoomend', (e) => {
            this.emit('zoomChange', this.map.getZoom());
        });
        
        this.map.on('moveend', (e) => {
            this.emit('viewChange', {
                center: this.map.getCenter(),
                zoom: this.map.getZoom(),
                bounds: this.map.getBounds()
            });
        });
    }

    /**
     * POI Layer Management
     */
    
    /**
     * Add POI layer with markers
     */
    addPOILayer(pois, options = {}) {
        if (!Array.isArray(pois)) {
            console.error('POIs must be an array');
            return;
        }

        // Clear existing POI markers
        this.clearPOILayer();

        pois.forEach(poi => {
            const marker = this.createPOIMarker(poi, options);
            if (marker) {
                this.markers.pois.set(poi.id, marker);
                
                if (this.options.enableClustering && this.layers.clusters) {
                    this.layers.clusters.addLayer(marker);
                } else if (this.layers.pois) {
                    this.layers.pois.addLayer(marker);
                }
            }
        });

        this.emit('poisLoaded', { count: pois.length });
    }

    /**
     * Create POI marker with popup and styling
     */
    createPOIMarker(poi, options = {}) {
        if (!poi.latitude || !poi.longitude) {
            console.warn('POI missing coordinates:', poi);
            return null;
        }

        // Get category info for styling
        const category = this.getCategoryInfo(poi.category);
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'poi-marker',
            html: `
                <div class="poi-marker-inner" style="background-color: ${category.color}">
                    <i class="fas fa-${category.icon}"></i>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });

        const marker = L.marker([poi.latitude, poi.longitude], { icon });
        
        // Create popup content
        const popupContent = this.createPOIPopupContent(poi);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'poi-popup'
        });

        // Add event listeners
        marker.on('click', () => {
            this.emit('poiClick', poi);
        });

        marker.on('dblclick', () => {
            this.emit('poiDoubleClick', poi);
        });

        return marker;
    }

    /**
     * Create POI popup content
     */
    createPOIPopupContent(poi) {
        const category = this.getCategoryInfo(poi.category);
        
        return `
            <div class="poi-popup-content">
                <div class="poi-popup-header">
                    <div class="poi-category" style="background-color: ${category.color}">
                        <i class="fas fa-${category.icon}"></i>
                        ${category.display_name}
                    </div>
                </div>
                <h4 class="poi-title">${poi.name || 'İsimsiz POI'}</h4>
                ${poi.description ? `<p class="poi-description">${poi.description}</p>` : ''}
                <div class="poi-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.mapManager.editPOI(${poi.id})">
                        <i class="fas fa-edit"></i> Düzenle
                    </button>
                    <button class="btn btn-sm btn-info" onclick="window.mapManager.viewPOIDetails(${poi.id})">
                        <i class="fas fa-info"></i> Detaylar
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Update POI marker
     */
    updatePOIMarker(poiId, updatedPOI) {
        const marker = this.markers.pois.get(poiId);
        if (marker) {
            // Update marker position if coordinates changed
            if (updatedPOI.latitude && updatedPOI.longitude) {
                marker.setLatLng([updatedPOI.latitude, updatedPOI.longitude]);
            }
            
            // Update popup content
            const popupContent = this.createPOIPopupContent(updatedPOI);
            marker.setPopupContent(popupContent);
            
            this.emit('poiUpdated', updatedPOI);
        }
    }

    /**
     * Remove POI marker
     */
    removePOIMarker(poiId) {
        const marker = this.markers.pois.get(poiId);
        if (marker) {
            if (this.options.enableClustering && this.layers.clusters) {
                this.layers.clusters.removeLayer(marker);
            } else if (this.layers.pois) {
                this.layers.pois.removeLayer(marker);
            }
            
            this.markers.pois.delete(poiId);
            this.emit('poiRemoved', poiId);
        }
    }

    /**
     * Clear all POI markers
     */
    clearPOILayer() {
        if (this.options.enableClustering && this.layers.clusters) {
            this.layers.clusters.clearLayers();
        }
        
        if (this.layers.pois) {
            this.layers.pois.clearLayers();
        }
        
        this.markers.pois.clear();
    }

    /**
     * Toggle POI layer visibility
     */
    togglePOILayer(visible) {
        this.layerVisibility.pois = visible;
        
        if (this.options.enableClustering && this.layers.clusters) {
            if (visible) {
                this.map.addLayer(this.layers.clusters);
            } else {
                this.map.removeLayer(this.layers.clusters);
            }
        } else if (this.layers.pois) {
            if (visible) {
                this.map.addLayer(this.layers.pois);
            } else {
                this.map.removeLayer(this.layers.pois);
            }
        }
        
        this.emit('layerToggled', { layer: 'pois', visible });
    }

    /**
     * Route Layer Management
     */
    
    /**
     * Add route layer with polylines
     */
    addRouteLayer(routes, options = {}) {
        if (!Array.isArray(routes)) {
            console.error('Routes must be an array');
            return;
        }

        // Clear existing route markers
        this.clearRouteLayer();

        routes.forEach(route => {
            const routeLayer = this.createRouteLayer(route, options);
            if (routeLayer) {
                this.markers.routes.set(route.id, routeLayer);
                this.layers.routes.addLayer(routeLayer);
            }
        });

        this.emit('routesLoaded', { count: routes.length });
    }

    /**
     * Create route layer with polyline and markers
     */
    createRouteLayer(route, options = {}) {
        if (!route.geometry || !route.geometry.coordinates) {
            console.warn('Route missing geometry:', route);
            return null;
        }

        const layerGroup = L.layerGroup();
        
        // Create polyline from coordinates
        const coordinates = this.parseRouteCoordinates(route.geometry);
        if (coordinates.length === 0) {
            console.warn('No valid coordinates found for route:', route);
            return null;
        }

        // Create polyline
        const polyline = L.polyline(coordinates, {
            color: route.color || '#3388ff',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1
        });

        // Add popup to polyline
        const popupContent = this.createRoutePopupContent(route);
        polyline.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'route-popup'
        });

        layerGroup.addLayer(polyline);

        // Add start and end markers
        if (coordinates.length > 0) {
            const startMarker = L.marker(coordinates[0], {
                icon: this.createRouteMarkerIcon('start')
            });
            startMarker.bindPopup(`<strong>Başlangıç:</strong> ${route.name}`);
            layerGroup.addLayer(startMarker);

            if (coordinates.length > 1) {
                const endMarker = L.marker(coordinates[coordinates.length - 1], {
                    icon: this.createRouteMarkerIcon('end')
                });
                endMarker.bindPopup(`<strong>Bitiş:</strong> ${route.name}`);
                layerGroup.addLayer(endMarker);
            }
        }

        // Add event listeners
        polyline.on('click', () => {
            this.emit('routeClick', route);
        });

        return layerGroup;
    }

    /**
     * Parse route coordinates from different formats
     */
    parseRouteCoordinates(geometry) {
        const coordinates = [];
        
        try {
            if (geometry.type === 'LineString') {
                geometry.coordinates.forEach(coord => {
                    if (Array.isArray(coord) && coord.length >= 2) {
                        coordinates.push([coord[1], coord[0]]); // [lat, lng]
                    }
                });
            } else if (geometry.type === 'MultiLineString') {
                geometry.coordinates.forEach(lineString => {
                    lineString.forEach(coord => {
                        if (Array.isArray(coord) && coord.length >= 2) {
                            coordinates.push([coord[1], coord[0]]); // [lat, lng]
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Error parsing route coordinates:', error);
        }
        
        return coordinates;
    }

    /**
     * Create route marker icons
     */
    createRouteMarkerIcon(type) {
        const iconConfig = {
            start: { color: '#28a745', icon: 'play' },
            end: { color: '#dc3545', icon: 'stop' }
        };
        
        const config = iconConfig[type] || iconConfig.start;
        
        return L.divIcon({
            className: 'route-marker',
            html: `
                <div class="route-marker-inner" style="background-color: ${config.color}">
                    <i class="fas fa-${config.icon}"></i>
                </div>
            `,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    }

    /**
     * Create route popup content
     */
    createRoutePopupContent(route) {
        return `
            <div class="route-popup-content">
                <h4 class="route-title">${route.name || 'İsimsiz Rota'}</h4>
                ${route.description ? `<p class="route-description">${route.description}</p>` : ''}
                <div class="route-info">
                    ${route.distance ? `<span class="route-distance"><i class="fas fa-route"></i> ${route.distance} km</span>` : ''}
                    ${route.difficulty ? `<span class="route-difficulty"><i class="fas fa-mountain"></i> ${route.difficulty}</span>` : ''}
                    ${route.duration ? `<span class="route-duration"><i class="fas fa-clock"></i> ${route.duration}</span>` : ''}
                </div>
                <div class="route-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.mapManager.editRoute(${route.id})">
                        <i class="fas fa-edit"></i> Düzenle
                    </button>
                    <button class="btn btn-sm btn-info" onclick="window.mapManager.viewRouteDetails(${route.id})">
                        <i class="fas fa-info"></i> Detaylar
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Clear all route layers
     */
    clearRouteLayer() {
        if (this.layers.routes && typeof this.layers.routes.clearLayers === 'function') {
            this.layers.routes.clearLayers();
        }
        this.markers.routes.clear();
    }

    /**
     * Toggle route layer visibility
     */
    toggleRouteLayer(visible) {
        this.layerVisibility.routes = visible;
        
        if (visible) {
            this.map.addLayer(this.layers.routes);
        } else {
            this.map.removeLayer(this.layers.routes);
        }
        
        this.emit('layerToggled', { layer: 'routes', visible });
    }   
 /**
     * Import Preview Functionality
     */
    
    /**
     * Show route preview for import
     */
    showRoutePreview(routeData, options = {}) {
        // Clear existing preview
        this.clearPreview();
        
        if (!routeData || !routeData.geometry) {
            console.warn('Invalid route data for preview');
            return;
        }

        const coordinates = this.parseRouteCoordinates(routeData.geometry);
        if (coordinates.length === 0) {
            console.warn('No valid coordinates for preview');
            return;
        }

        // Create preview polyline with distinct styling
        const previewPolyline = L.polyline(coordinates, {
            color: '#ff6b35',
            weight: 5,
            opacity: 0.9,
            dashArray: '10, 5',
            className: 'route-preview'
        });

        // Add preview popup
        const popupContent = `
            <div class="preview-popup-content">
                <h4><i class="fas fa-eye"></i> Rota Önizlemesi</h4>
                <p><strong>Dosya:</strong> ${routeData.filename || 'Bilinmeyen'}</p>
                <p><strong>Nokta Sayısı:</strong> ${coordinates.length}</p>
                ${routeData.name ? `<p><strong>Rota Adı:</strong> ${routeData.name}</p>` : ''}
                ${routeData.distance ? `<p><strong>Mesafe:</strong> ${routeData.distance} km</p>` : ''}
                <div class="preview-actions">
                    <button class="btn btn-sm btn-success" onclick="window.mapManager.confirmImport()">
                        <i class="fas fa-check"></i> İçe Aktar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.mapManager.clearPreview()">
                        <i class="fas fa-times"></i> İptal
                    </button>
                </div>
            </div>
        `;
        
        previewPolyline.bindPopup(popupContent, {
            maxWidth: 350,
            className: 'preview-popup'
        });

        this.layers.preview.addLayer(previewPolyline);
        this.markers.preview.push(previewPolyline);

        // Add start/end markers for preview
        const startMarker = L.marker(coordinates[0], {
            icon: this.createPreviewMarkerIcon('start')
        });
        startMarker.bindPopup('<strong>Önizleme Başlangıcı</strong>');
        
        const endMarker = L.marker(coordinates[coordinates.length - 1], {
            icon: this.createPreviewMarkerIcon('end')
        });
        endMarker.bindPopup('<strong>Önizleme Bitişi</strong>');

        this.layers.preview.addLayer(startMarker);
        this.layers.preview.addLayer(endMarker);
        this.markers.preview.push(startMarker, endMarker);

        // Fit map to preview bounds
        const bounds = L.latLngBounds(coordinates);
        this.map.fitBounds(bounds, { padding: [20, 20] });

        // Show waypoints if available
        if (routeData.waypoints && Array.isArray(routeData.waypoints)) {
            this.showPreviewWaypoints(routeData.waypoints);
        }

        this.emit('previewShown', { routeData, coordinates: coordinates.length });
    }

    /**
     * Show waypoints in preview
     */
    showPreviewWaypoints(waypoints) {
        waypoints.forEach((waypoint, index) => {
            if (waypoint.latitude && waypoint.longitude) {
                const waypointMarker = L.marker([waypoint.latitude, waypoint.longitude], {
                    icon: this.createPreviewMarkerIcon('waypoint')
                });
                
                const popupContent = `
                    <div class="waypoint-preview-popup">
                        <h5><i class="fas fa-map-pin"></i> Waypoint ${index + 1}</h5>
                        ${waypoint.name ? `<p><strong>Ad:</strong> ${waypoint.name}</p>` : ''}
                        ${waypoint.description ? `<p><strong>Açıklama:</strong> ${waypoint.description}</p>` : ''}
                        <small>POI olarak eklenebilir</small>
                    </div>
                `;
                
                waypointMarker.bindPopup(popupContent);
                this.layers.preview.addLayer(waypointMarker);
                this.markers.preview.push(waypointMarker);
            }
        });
    }

    /**
     * Create preview marker icons
     */
    createPreviewMarkerIcon(type) {
        const iconConfig = {
            start: { color: '#28a745', icon: 'play', size: 30 },
            end: { color: '#dc3545', icon: 'stop', size: 30 },
            waypoint: { color: '#ffc107', icon: 'map-pin', size: 25 }
        };
        
        const config = iconConfig[type] || iconConfig.waypoint;
        
        return L.divIcon({
            className: 'preview-marker',
            html: `
                <div class="preview-marker-inner" style="background-color: ${config.color}">
                    <i class="fas fa-${config.icon}"></i>
                </div>
            `,
            iconSize: [config.size, config.size],
            iconAnchor: [config.size / 2, config.size / 2],
            popupAnchor: [0, -config.size / 2]
        });
    }

    /**
     * Clear preview layer
     */
    clearPreview() {
        this.layers.preview.clearLayers();
        this.markers.preview = [];
        this.emit('previewCleared');
    }

    /**
     * Toggle preview layer visibility
     */
    togglePreviewLayer(visible) {
        this.layerVisibility.preview = visible;
        
        if (visible) {
            this.map.addLayer(this.layers.preview);
        } else {
            this.map.removeLayer(this.layers.preview);
        }
        
        this.emit('layerToggled', { layer: 'preview', visible });
    }

    /**
     * Utility Methods
     */
    
    /**
     * Get category information for POI styling
     */
    getCategoryInfo(categoryName) {
        const defaultCategories = {
            gastronomik: { display_name: "🍽️ Gastronomik", color: "#e74c3c", icon: "utensils" },
            kulturel: { display_name: "🏛️ Kültürel", color: "#3498db", icon: "landmark" },
            sanatsal: { display_name: "🎨 Sanatsal", color: "#2ecc71", icon: "palette" },
            doga_macera: { display_name: "🌿 Doğa & Macera", color: "#f39c12", icon: "hiking" },
            konaklama: { display_name: "🏨 Konaklama", color: "#9b59b6", icon: "bed" },
            alisveris: { display_name: "🛍️ Alışveriş", color: "#f39c12", icon: "shopping-cart" },
            eglence: { display_name: "🎪 Eğlence", color: "#e74c3c", icon: "music" },
            spor: { display_name: "⚽ Spor", color: "#34495e", icon: "dumbbell" }
        };
        
        return defaultCategories[categoryName] || {
            display_name: "📍 Genel",
            color: "#6c757d",
            icon: "map-marker-alt"
        };
    }

    /**
     * Fit map to show all POIs
     */
    fitToPOIs() {
        if (this.markers.pois.size === 0) {
            return;
        }

        const group = new L.featureGroup(Array.from(this.markers.pois.values()));
        this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }

    /**
     * Fit map to show all routes
     */
    fitToRoutes() {
        if (this.markers.routes.size === 0) {
            return;
        }

        const group = new L.featureGroup(Array.from(this.markers.routes.values()));
        this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }

    /**
     * Fit map to show all layers
     */
    fitToAll() {
        const allLayers = [];
        
        // Add POI markers
        if (this.options.enableClustering && this.layers.clusters) {
            allLayers.push(this.layers.clusters);
        } else {
            this.markers.pois.forEach(marker => allLayers.push(marker));
        }
        
        // Add route layers
        this.markers.routes.forEach(layer => allLayers.push(layer));
        
        // Add preview layers
        this.markers.preview.forEach(layer => allLayers.push(layer));

        if (allLayers.length > 0) {
            const group = new L.featureGroup(allLayers);
            this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    }

    /**
     * Go to user's current location
     */
    goToUserLocation() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return;
        }

        const button = document.querySelector('.map-location-control button');
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 15);
                
                // Add temporary marker for user location
                const userMarker = L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="user-location-inner"><i class="fas fa-user"></i></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                });
                
                userMarker.addTo(this.map);
                userMarker.bindPopup('Mevcut Konumunuz').openPopup();
                
                // Remove marker after 5 seconds
                setTimeout(() => {
                    this.map.removeLayer(userMarker);
                }, 5000);

                if (button) {
                    button.innerHTML = '<i class="fas fa-location-arrow"></i>';
                }
                
                this.emit('locationFound', { latitude, longitude });
            },
            (error) => {
                console.error('Geolocation error:', error);
                if (button) {
                    button.innerHTML = '<i class="fas fa-location-arrow"></i>';
                }
                this.emit('locationError', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const mapContainer = document.getElementById(this.containerId);
        
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(() => {
                mapContainer.classList.add('fullscreen-map');
                this.map.invalidateSize();
                
                // Update fullscreen button icon
                const button = document.querySelector('.map-fullscreen-control button');
                if (button) {
                    button.innerHTML = '<i class="fas fa-compress"></i>';
                    button.title = 'Tam Ekrandan Çık';
                }
            }).catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                mapContainer.classList.remove('fullscreen-map');
                this.map.invalidateSize();
                
                // Update fullscreen button icon
                const button = document.querySelector('.map-fullscreen-control button');
                if (button) {
                    button.innerHTML = '<i class="fas fa-expand"></i>';
                    button.title = 'Tam Ekran';
                }
            });
        }
    }

    /**
     * Event Management
     */
    
    /**
     * Add event listener
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Remove event listener
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Public API Methods for external access
     */
    
    /**
     * Edit POI (to be called from popup buttons)
     */
    editPOI(poiId) {
        this.emit('editPOI', poiId);
    }

    /**
     * View POI details
     */
    viewPOIDetails(poiId) {
        this.emit('viewPOIDetails', poiId);
    }

    /**
     * Edit route
     */
    editRoute(routeId) {
        this.emit('editRoute', routeId);
    }

    /**
     * View route details
     */
    viewRouteDetails(routeId) {
        this.emit('viewRouteDetails', routeId);
    }

    /**
     * Confirm import (for preview)
     */
    confirmImport() {
        this.emit('confirmImport');
    }

    /**
     * Get map instance for external access
     */
    getMap() {
        return this.map;
    }

    /**
     * Get current map bounds
     */
    getBounds() {
        return this.map.getBounds();
    }

    /**
     * Get current map center
     */
    getCenter() {
        return this.map.getCenter();
    }

    /**
     * Get current zoom level
     */
    getZoom() {
        return this.map.getZoom();
    }

    /**
     * Set map view
     */
    setView(center, zoom) {
        this.map.setView(center, zoom);
    }

    /**
     * Invalidate map size (useful after container resize)
     */
    invalidateSize() {
        this.map.invalidateSize();
    }

    /**
     * Destroy map instance
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.eventHandlers.clear();
        this.markers.pois.clear();
        this.markers.routes.clear();
        this.markers.preview = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedMapManager;
}

// Make available globally
window.EnhancedMapManager = EnhancedMapManager;