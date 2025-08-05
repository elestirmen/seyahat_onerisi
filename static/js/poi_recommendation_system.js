// Global variables
let map = null;
let markers = [];
let routingControl = null;
let selectedPOIs = [];
let mediaCache = {};
let userLocation = null;
let startLocation = null;
const apiBase = '/api';
window.apiBase = apiBase; // Make it globally accessible

// Route tabs management
let currentTab = 'dynamic-routes';
let predefinedRoutes = [];
let filteredRoutes = [];

// Rating categories with their display names and icons
const ratingCategories = {
    'doga': { name: 'Doğa', icon: 'fas fa-tree' },
    'yemek': { name: 'Yemek', icon: 'fas fa-utensils' },
    'tarihi': { name: 'Tarih', icon: 'fas fa-landmark' },
    'eglence': { name: 'Eğlence', icon: 'fas fa-gamepad' },
    'sanat_kultur': { name: 'Sanat & Kültür', icon: 'fas fa-palette' },
    'macera': { name: 'Macera', icon: 'fas fa-mountain' },
    'rahatlatici': { name: 'Rahatlatıcı', icon: 'fas fa-spa' },
    'spor': { name: 'Spor', icon: 'fas fa-running' },
    'alisveris': { name: 'Alışveriş', icon: 'fas fa-shopping-bag' },
    'gece_hayati': { name: 'Gece Hayatı', icon: 'fas fa-moon' }
};

// Dynamic category data (will be loaded from API)
let categoryData = {};

// Fallback category display names
const fallbackCategoryNames = {
    'doga_macera': 'Doğa & Macera',
    'gastronomik': 'Gastronomi',
    'konaklama': 'Konaklama',
    'kulturel': 'Kültürel',
    'sanatsal': 'Sanatsal',
    'dini': 'Dini Yapılar',
    'tarihi': 'Tarihi Yapılar',
    'mimari': 'Mimari Yapılar',
    'mezarlik': 'Mezarlık Alanları',
    'saray_kale': 'Saray ve Kaleler',
    'diger': 'Diğer'
};

// Fallback category colors and icons for markers
const fallbackCategoryStyles = {
    'doga_macera': { color: '#2ecc71', icon: '🌿' },
    'gastronomik': { color: '#e74c3c', icon: '🍽️' },
    'konaklama': { color: '#9b59b6', icon: '🏨' },
    'kulturel': { color: '#3498db', icon: '🏛️' },
    'sanatsal': { color: '#f39c12', icon: '🎨' },
    'dini': { color: '#8B4513', icon: '🕌' },
    'tarihi': { color: '#CD853F', icon: '🏛️' },
    'mimari': { color: '#4682B4', icon: '🏗️' },
    'mezarlik': { color: '#696969', icon: '⚰️' },
    'saray_kale': { color: '#B8860B', icon: '🏰' },
    'diger': { color: '#708090', icon: '📍' }
};

// Load categories from API
async function loadCategories() {
    try {
        console.log('📋 Kategoriler API\'den yükleniyor...');
        const response = await fetch(`${apiBase}/categories`);
        
        if (response.ok) {
            const categories = await response.json();
            console.log('✅ Kategoriler yüklendi:', categories);
            
            // Global kategori verilerini güncelle
            categoryData = {};
            categories.forEach(category => {
                // İkon için emoji çıkar (eğer varsa)
                let iconEmoji = category.display_name.match(/^[\u{1F300}-\u{1F9FF}]/u);
                if (!iconEmoji) {
                    // Fallback emoji'leri kullan
                    iconEmoji = fallbackCategoryStyles[category.name]?.icon || '📍';
                } else {
                    iconEmoji = iconEmoji[0];
                }
                
                categoryData[category.name] = {
                    display_name: category.display_name,
                    color: category.color,
                    icon: iconEmoji,
                    description: category.description
                };
            });
            
            console.log('✅ Kategori verileri güncellendi:', categoryData);
            return true;
        } else {
            console.warn('⚠️ Kategoriler yüklenemedi, fallback kullanılacak');
            return false;
        }
    } catch (error) {
        console.error('❌ Kategori yükleme hatası:', error);
        return false;
    }
}

// Get category display name (dynamic)
function getCategoryDisplayName(category) {
    if (categoryData[category]) {
        return categoryData[category].display_name;
    }
    return fallbackCategoryNames[category] || category;
}

// Get category color (dynamic)
function getCategoryColor(category) {
    if (categoryData[category]) {
        return categoryData[category].color;
    }
    return fallbackCategoryStyles[category]?.color || '#666666';
}

// Get category icon (dynamic)
function getCategoryIcon(category) {
    if (categoryData[category]) {
        return categoryData[category].icon;
    }
    return fallbackCategoryStyles[category]?.icon || '📍';
}

// Get category style (dynamic)
function getCategoryStyle(category) {
    return {
        color: getCategoryColor(category),
        icon: getCategoryIcon(category)
    };
}

// Route Details Panel Class
class RouteDetailsPanel {
    constructor() {
        this.panel = document.getElementById('routeDetailsPanel');
        this.currentRoute = null;
        this.elevationChart = null;
        this.isVisible = false;
    }

    static getInstance() {
        if (!window.routeDetailsPanelInstance) {
            window.routeDetailsPanelInstance = new RouteDetailsPanel();
        }
        return window.routeDetailsPanelInstance;
    }

    show(routeData) {
        console.log('🎯 Showing route details panel with data:', routeData);

        this.currentRoute = routeData;
        this.updateSummary(routeData);
        this.updateStopsList(routeData);
        this.updateSegmentsList(routeData);
        this.loadElevationProfile(routeData);

        this.panel.classList.add('show');
        this.isVisible = true;

        // Store bound functions for proper removal
        this.boundKeydownHandler = this.handleKeydown.bind(this);
        this.boundClickOutsideHandler = this.handleClickOutside.bind(this);

        // Add keyboard event listener for Escape key
        document.addEventListener('keydown', this.boundKeydownHandler);

        // Add click outside to close
        document.addEventListener('click', this.boundClickOutsideHandler);
    }

    hide() {
        console.log('🎯 Hiding route details panel');

        this.panel.classList.remove('show');
        this.isVisible = false;
        this.currentRoute = null;

        // Remove event listeners
        if (this.boundKeydownHandler) {
            document.removeEventListener('keydown', this.boundKeydownHandler);
            this.boundKeydownHandler = null;
        }
        if (this.boundClickOutsideHandler) {
            document.removeEventListener('click', this.boundClickOutsideHandler);
            this.boundClickOutsideHandler = null;
        }

        // Destroy chart if exists
        if (this.elevationChart) {
            this.elevationChart.destroy();
            this.elevationChart = null;
        }
    }

    handleKeydown(event) {
        if (event.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    }

    handleClickOutside(event) {
        if (this.isVisible && !this.panel.contains(event.target)) {
            // Don't close if clicking on route lines
            if (!event.target.closest('.leaflet-interactive')) {
                this.hide();
            }
        }
    }

    updateSummary(routeData) {
        const distance = routeData.total_distance || '0';
        const duration = routeData.estimated_time || '0';
        const stops = routeData.waypoints ? routeData.waypoints.length : selectedPOIs.length;
        const routeType = routeData.route_type || 'yürüyüş';

        document.getElementById('routeDistance').textContent = `${distance} km`;
        document.getElementById('routeDuration').textContent = `${Math.round(duration / 60)} saat`;
        document.getElementById('routeStops').textContent = `${stops} durak`;
        document.getElementById('routeType').textContent = routeType;
    }

    updateStopsList(routeData) {
        const stopsList = document.getElementById('stopsList');
        let stopsHTML = '';
        let stopIndex = 1;

        // Add start location if exists
        if (startLocation) {
            stopsHTML += `
                        <div class="stop-item" onclick="RouteDetailsPanel.highlightStop(${startLocation.latitude}, ${startLocation.longitude})">
                            <div class="stop-icon" style="background: #28a745;">
                                🏁
                            </div>
                            <div class="stop-info">
                                <div class="stop-name">${startLocation.name || 'Başlangıç Noktası'}</div>
                                <div class="stop-category">Başlangıç Noktası</div>
                                <div class="stop-coordinates">${startLocation.latitude.toFixed(4)}, ${startLocation.longitude.toFixed(4)}</div>
                            </div>
                            <div class="stop-number">${stopIndex}</div>
                        </div>
                    `;
            stopIndex++;
        }

        // Add all POI stops from routeData waypoints or selectedPOIs
        const waypoints = routeData.waypoints || selectedPOIs;
        waypoints.forEach((poi, index) => {
            const categoryStyle = getCategoryStyle(poi.category);
            const lat = poi.lat || poi.latitude;
            const lng = poi.lng || poi.longitude;

            stopsHTML += `
                        <div class="stop-item" onclick="RouteDetailsPanel.highlightStop(${lat}, ${lng})">
                            <div class="stop-icon" style="background: ${categoryStyle.color};">
                                ${categoryStyle.icon}
                            </div>
                            <div class="stop-info">
                                <div class="stop-name">${poi.name}</div>
                                <div class="stop-category">${getCategoryDisplayName(poi.category)}</div>
                                <div class="stop-coordinates">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                            </div>
                            <div class="stop-number">${stopIndex}</div>
                        </div>
                    `;
            stopIndex++;
        });

        // If no waypoints in routeData, show message
        if (waypoints.length === 0 && !startLocation) {
            stopsHTML = `
                        <div style="text-align: center; padding: 20px; color: #666; font-style: italic;">
                            <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                            <p>Henüz durak eklenmemiş</p>
                        </div>
                    `;
        }

        stopsList.innerHTML = stopsHTML;

        // Update stops counter
        const totalStops = (startLocation ? 1 : 0) + waypoints.length;
        const stopsCounter = document.getElementById('stopsCount');
        if (stopsCounter) {
            stopsCounter.textContent = totalStops;
        }
    }

    updateSegmentsList(routeData) {
        const segmentsSection = document.getElementById('segmentsSection');
        const segmentsList = document.getElementById('segmentsList');

        if (!routeData.segments || routeData.segments.length === 0) {
            segmentsSection.style.display = 'none';
            return;
        }

        segmentsSection.style.display = 'block';
        let segmentsHTML = '';

        routeData.segments.forEach((segment, index) => {
            const isWalking = !segment.fallback;
            const iconClass = isWalking ? 'walking' : 'fallback';
            const icon = isWalking ? '🚶' : '📏';
            const routeType = isWalking ? 'Yürüyüş' : 'Düz çizgi';

            segmentsHTML += `
                        <div class="segment-item" onclick="RouteDetailsPanel.focusOnSegment(${index})">
                            <div class="segment-icon ${iconClass}">
                                ${icon}
                            </div>
                            <div class="segment-info">
                                <div class="segment-route">${segment.from} → ${segment.to}</div>
                                <div class="segment-details">
                                    <span>📏 ${segment.distance.toFixed(2)} km</span>
                                    <span>⏱️ ${Math.round(segment.distance * 12)} dk</span>
                                    <span>${routeType}</span>
                                </div>
                            </div>
                        </div>
                    `;
        });

        segmentsList.innerHTML = segmentsHTML;
    }

    static highlightStop(lat, lng) {
        console.log('🎯 Highlighting stop at:', lat, lng);

        // Find and highlight the marker
        markers.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lng) < 0.0001) {
                // Center map on marker and open popup
                map.setView([lat, lng], 16);
                marker.openPopup();

                // Add temporary highlight effect
                const markerElement = marker.getElement();
                if (markerElement) {
                    markerElement.style.transform += ' scale(1.2)';
                    markerElement.style.transition = 'transform 0.3s ease';

                    setTimeout(() => {
                        markerElement.style.transform = markerElement.style.transform.replace(' scale(1.2)', '');
                    }, 1000);
                }
            }
        });
    }

    async loadElevationProfile(routeData) {
        try {
            // Show loading state
            this.showElevationLoading();

            // Collect elevation data for all waypoints
            const elevationData = await this.collectElevationData(routeData);

            // Calculate statistics
            const stats = this.calculateElevationStats(elevationData);

            // Update statistics display
            this.updateElevationStats(stats);

            // Create interactive chart
            this.createElevationChart(elevationData);

        } catch (error) {
            console.error('Error loading elevation profile:', error);
            this.showElevationError();
        }
    }

    showElevationLoading() {
        document.getElementById('minElevation').textContent = 'Min: Yükleniyor...';
        document.getElementById('maxElevation').textContent = 'Max: Yükleniyor...';
        document.getElementById('totalAscent').textContent = '↗ Yükleniyor...';
        document.getElementById('totalDescent').textContent = '↘ Yükleniyor...';
    }

    showElevationError() {
        document.getElementById('minElevation').textContent = 'Min: Hata';
        document.getElementById('maxElevation').textContent = 'Max: Hata';
        document.getElementById('totalAscent').textContent = '↗ Hata';
        document.getElementById('totalDescent').textContent = '↘ Hata';

        // Show error chart
        const ctx = document.getElementById('elevationChart').getContext('2d');
        if (this.elevationChart) {
            this.elevationChart.destroy();
        }

        this.elevationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Veri Yüklenemedi'],
                datasets: [{
                    label: 'Yükseklik (m)',
                    data: [0],
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    async collectElevationData(routeData) {
        const waypoints = [];
        let cumulativeDistance = 0;

        // Add start location
        if (routeData.start) {
            waypoints.push({
                lat: routeData.start.lat,
                lng: routeData.start.lng,
                name: 'Başlangıç',
                distance: 0
            });
        }

        // Add all POI waypoints with distance calculation
        if (routeData.waypoints && routeData.waypoints.length > 0) {
            for (let i = 0; i < routeData.waypoints.length; i++) {
                const poi = routeData.waypoints[i];
                const prevPoint = i === 0 ? routeData.start : routeData.waypoints[i - 1];

                if (prevPoint) {
                    const segmentDistance = this.calculateDistance(
                        prevPoint.lat || prevPoint.latitude,
                        prevPoint.lng || prevPoint.longitude,
                        poi.lat || poi.latitude,
                        poi.lng || poi.longitude
                    );
                    cumulativeDistance += segmentDistance;
                }

                waypoints.push({
                    lat: poi.lat || poi.latitude,
                    lng: poi.lng || poi.longitude,
                    name: poi.name,
                    distance: cumulativeDistance
                });
            }
        }

        // Collect elevation data with caching
        const elevationPromises = waypoints.map(async (point, index) => {
            const elevation = await this.getElevationWithCache(point.lat, point.lng);
            return {
                distance: point.distance,
                elevation: elevation,
                name: point.name,
                pointIndex: index,
                lat: point.lat,
                lng: point.lng
            };
        });

        return Promise.all(elevationPromises);
    }

    async getElevationWithCache(lat, lng) {
        const cacheKey = `elevation_${lat.toFixed(4)}_${lng.toFixed(4)}`;

        // Check localStorage cache first
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                const now = Date.now();
                // Cache for 1 hour to reduce API calls
                if (now - cacheData.timestamp < 60 * 60 * 1000) {
                    console.log(`📦 Using cached elevation for ${lat.toFixed(4)}, ${lng.toFixed(4)}: ${cacheData.elevation}m`);
                    return cacheData.elevation;
                }
            }
        } catch (error) {
            console.warn('Error reading elevation cache:', error);
        }

        // Get fresh elevation data
        const elevation = await getElevation(lat, lng);

        // Cache the result
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                elevation: elevation,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Error caching elevation data:', error);
        }

        return elevation;
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000; // Return in meters
    }

    calculateElevationStats(elevationData) {
        if (!elevationData || elevationData.length === 0) {
            return {
                minElevation: 0,
                maxElevation: 0,
                avgElevation: 0,
                totalAscent: 0,
                totalDescent: 0,
                elevationGain: 0
            };
        }

        const elevations = elevationData.map(d => d.elevation);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const avgElevation = Math.round(elevations.reduce((sum, e) => sum + e, 0) / elevations.length);

        let totalAscent = 0;
        let totalDescent = 0;

        // Calculate ascent and descent
        for (let i = 1; i < elevationData.length; i++) {
            const elevationDiff = elevationData[i].elevation - elevationData[i - 1].elevation;
            if (elevationDiff > 0) {
                totalAscent += elevationDiff;
            } else {
                totalDescent += Math.abs(elevationDiff);
            }
        }

        const elevationGain = maxElevation - minElevation;

        return {
            minElevation,
            maxElevation,
            avgElevation,
            totalAscent: Math.round(totalAscent),
            totalDescent: Math.round(totalDescent),
            elevationGain: Math.round(elevationGain)
        };
    }

    updateElevationStats(stats) {
        document.getElementById('minElevation').textContent = `Min: ${stats.minElevation}m`;
        document.getElementById('maxElevation').textContent = `Max: ${stats.maxElevation}m`;
        document.getElementById('totalAscent').textContent = `↗ ${stats.totalAscent}m`;
        document.getElementById('totalDescent').textContent = `↘ ${stats.totalDescent}m`;
    }

    createElevationChart(elevationData) {
        const ctx = document.getElementById('elevationChart').getContext('2d');

        if (this.elevationChart) {
            this.elevationChart.destroy();
        }

        // Set fixed canvas dimensions
        const canvas = document.getElementById('elevationChart');
        canvas.width = 300;
        canvas.height = 120;
        canvas.style.width = '100%';
        canvas.style.height = '120px';

        // Prepare chart data
        const labels = elevationData.map(d => {
            if (d.distance === 0) return 'Başlangıç';
            return `${(d.distance / 1000).toFixed(1)}km`;
        });

        const elevations = elevationData.map(d => d.elevation);
        const names = elevationData.map(d => d.name);

        this.elevationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Yükseklik (m)',
                    data: elevations,
                    borderColor: '#4285f4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4285f4',
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
                                return names[index] || `Nokta ${index + 1}`;
                            },
                            label: function (context) {
                                const elevation = context.parsed.y;
                                const distance = elevationData[context.dataIndex].distance;
                                return [
                                    `Yükseklik: ${elevation}m`,
                                    `Mesafe: ${(distance / 1000).toFixed(1)}km`
                                ];
                            }
                        },
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#4285f4',
                        borderWidth: 1,
                        titleFont: { size: 11 },
                        bodyFont: { size: 10 }
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Yükseklik (m)',
                            color: '#666',
                            font: { size: 10 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#666',
                            font: { size: 9 },
                            maxTicksLimit: 5
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mesafe',
                            color: '#666',
                            font: { size: 10 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#666',
                            font: { size: 9 },
                            maxRotation: 45,
                            maxTicksLimit: 6
                        }
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                },
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const point = elevationData[index];
                        console.log(`Clicked on elevation point: ${point.name} at ${point.elevation}m`);

                        // Highlight corresponding stop in the stops list
                        const stopItems = document.querySelectorAll('.stop-item');
                        stopItems.forEach((item, i) => {
                            item.classList.toggle('highlighted', i === index);
                        });

                        // Scroll to highlighted stop
                        const highlightedStop = document.querySelector('.stop-item.highlighted');
                        if (highlightedStop) {
                            highlightedStop.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    }
                }
            }
        });
    }

    static exportToGoogleMaps() {
        const instance = RouteDetailsPanel.getInstance();
        if (!instance.currentRoute) {
            showNotification('❌ Aktif rota bulunamadı', 'error');
            return;
        }

        if (selectedPOIs.length === 0) {
            showNotification('❌ Önce POI seçin', 'error');
            return;
        }

        let waypoints = [];
        let waypointNames = [];

        // Add start location with name
        if (startLocation) {
            waypoints.push(`${startLocation.latitude},${startLocation.longitude}`);
            waypointNames.push(encodeURIComponent(startLocation.name || 'Başlangıç Noktası'));
        }

        // Add all POIs with names
        selectedPOIs.forEach(poi => {
            waypoints.push(`${poi.latitude},${poi.longitude}`);
            waypointNames.push(encodeURIComponent(poi.name));
        });

        if (waypoints.length < 2) {
            showNotification('❌ En az 2 nokta gerekli', 'error');
            return;
        }

        // Use simple coordinate-based approach for reliability
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];

        let waypointParam = '';
        if (waypoints.length > 2) {
            const middleWaypoints = waypoints.slice(1, -1);
            const maxWaypoints = Math.min(middleWaypoints.length, 23);
            const selectedWaypoints = middleWaypoints.slice(0, maxWaypoints);
            waypointParam = '&waypoints=' + selectedWaypoints.join('|');
        }

        // Create URL with coordinates (most reliable)
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}&travelmode=walking`;

        console.log('🗺️ Exporting route to Google Maps:');
        console.log('Origin:', origin, startLocation ? `(${startLocation.name})` : '');
        console.log('Destination:', destination, selectedPOIs.length > 0 ? `(${selectedPOIs[selectedPOIs.length - 1].name})` : '');
        console.log('Waypoints:', waypoints.slice(1, -1));
        console.log('URL:', url);

        window.open(url, '_blank');

        showNotification('✅ Google Maps\'te rota açıldı (isimlerle)!', 'success');
    }

    static show(routeData) {
        const instance = RouteDetailsPanel.getInstance();
        instance.show(routeData);
    }

    static hide() {
        const instance = RouteDetailsPanel.getInstance();
        instance.hide();
    }

    static focusOnSegment(segmentIndex) {
        const instance = RouteDetailsPanel.getInstance();
        if (!instance.currentRoute || !instance.currentRoute.segments) {
            return;
        }

        const segment = instance.currentRoute.segments[segmentIndex];
        if (!segment || !segment.coordinates || segment.coordinates.length === 0) {
            return;
        }

        // Focus map on segment with smooth animation
        const coordinates = segment.coordinates;
        const bounds = L.latLngBounds(coordinates.map(coord => [coord.lat, coord.lng]));

        if (map) {
            // Smooth zoom to segment
            map.fitBounds(bounds, {
                padding: [30, 30],
                animate: true,
                duration: 0.8
            });

            // Create highlighted route overlay
            const highlightedRoute = L.polyline(
                coordinates.map(coord => [coord.lat, coord.lng]),
                {
                    color: '#ff6b35',
                    weight: 8,
                    opacity: 0.9,
                    dashArray: segment.fallback ? '15, 10' : null,
                    className: 'highlighted-segment'
                }
            ).addTo(map);

            // Add pulsing effect
            let pulseCount = 0;
            const pulseInterval = setInterval(() => {
                if (pulseCount < 6) {
                    highlightedRoute.setStyle({
                        weight: pulseCount % 2 === 0 ? 12 : 8,
                        opacity: pulseCount % 2 === 0 ? 1 : 0.7
                    });
                    pulseCount++;
                } else {
                    clearInterval(pulseInterval);
                }
            }, 300);

            // Highlight segment in list with enhanced styling
            const segmentItems = document.querySelectorAll('.segment-item');
            segmentItems.forEach((item, i) => {
                if (i === segmentIndex) {
                    item.classList.add('segment-highlighted', 'segment-pulse');
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    item.classList.remove('segment-highlighted', 'segment-pulse');
                }
            });

            // Show segment info popup
            const midPoint = coordinates[Math.floor(coordinates.length / 2)];
            const segmentPopup = L.popup({
                closeButton: false,
                autoClose: true,
                closeOnEscapeKey: true,
                className: 'segment-highlight-popup'
            })
                .setLatLng([midPoint.lat, midPoint.lng])
                .setContent(`
                <div style="text-align: center; padding: 10px;">
                    <h4 style="margin: 0 0 8px 0; color: #ff6b35; font-size: 1.1rem;">
                        ${segment.fallback ? '📏' : '🚶'} Segment ${segmentIndex + 1}
                    </h4>
                    <p style="margin: 0 0 5px 0; font-weight: 600;">
                        ${segment.from} → ${segment.to}
                    </p>
                    <div style="display: flex; gap: 15px; justify-content: center; font-size: 0.9rem;">
                        <span>📏 ${segment.distance.toFixed(2)} km</span>
                        <span>⏱️ ${Math.round(segment.distance * 12)} dk</span>
                        <span>${segment.fallback ? 'Düz çizgi' : 'Yürüyüş'}</span>
                    </div>
                </div>
            `)
                .openOn(map);

            // Remove highlights after 4 seconds
            setTimeout(() => {
                if (map.hasLayer(highlightedRoute)) {
                    map.removeLayer(highlightedRoute);
                }
                if (map.hasLayer(segmentPopup)) {
                    map.closePopup(segmentPopup);
                }
                segmentItems.forEach(item => {
                    item.classList.remove('segment-highlighted', 'segment-pulse');
                });
            }, 4000);

            // Add click handler to highlighted route for Google Maps
            highlightedRoute.on('click', () => {
                openRouteInGoogleMaps(segment);
            });
        }

        console.log(`🎯 Focused on segment ${segmentIndex + 1}: ${segment.from} → ${segment.to}`);
    }
}

// Create custom marker icons
function createCustomIcon(category, score, isLowScore = false) {
    const style = getCategoryStyle(category);

    // Düşük puanlı POI'ler için daha silik ama renkli stil
    const markerColor = isLowScore ? style.color : style.color;
    const opacity = isLowScore ? '0.7' : '1';
    const boxShadow = isLowScore ? '0 2px 6px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.3)';
    const borderColor = isLowScore ? '#e5e7eb' : 'white';
    const scoreBackgroundColor = isLowScore ? '#f9fafb' : 'white';
    const scoreTextColor = isLowScore ? style.color : style.color;

    return L.divIcon({
        html: `
            <div style="
                background: ${markerColor};
                width: 40px;
                height: 40px;
                border-radius: 50% 50% 50% 0;
                border: 3px solid ${borderColor};
                box-shadow: ${boxShadow};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transform: rotate(-45deg);
                position: relative;
                opacity: ${opacity};
                ${isLowScore ? 'filter: grayscale(0.2) brightness(0.9);' : ''}
            ">
                <span style="transform: rotate(45deg); opacity: ${isLowScore ? '0.8' : '1'};">${style.icon}</span>
                <div style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: ${scoreBackgroundColor};
                    color: ${scoreTextColor};
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: bold;
                    border: 2px solid ${markerColor};
                    transform: rotate(45deg);
                    opacity: ${isLowScore ? '0.8' : '1'};
                ">${score}</div>
            </div>
        `,
        className: `custom-poi-marker ${isLowScore ? 'low-score-marker' : 'high-score-marker'}`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
}

// Load POI media files
async function loadPOIMedia(poiId) {
    if (mediaCache[poiId]) {
        return mediaCache[poiId];
    }

    try {
        const response = await fetch(`${apiBase}/poi/${poiId}/media`);
        if (response.ok) {
            const apiData = await response.json();

            // Convert API format to expected format
            const mediaData = {
                images: [],
                videos: [],
                audio: [],
                models: []
            };

            if (apiData.media && Array.isArray(apiData.media)) {
                console.log('Processing media for POI:', poiId, apiData.media);
                apiData.media.forEach(item => {
                    switch (item.media_type) {
                        case 'image':
                            mediaData.images.push({
                                filename: item.filename,
                                description: item.description || '',
                                path: item.path,
                                preview_path: item.preview_path
                            });
                            break;
                        case 'video':
                            mediaData.videos.push({
                                filename: item.filename,
                                description: item.description || '',
                                path: item.path
                            });
                            break;
                        case 'audio':
                            mediaData.audio.push({
                                filename: item.filename,
                                description: item.description || '',
                                path: item.path
                            });
                            break;
                        case 'model':
                            mediaData.models.push({
                                filename: item.filename,
                                description: item.description || '',
                                path: item.path
                            });
                            break;
                    }
                });
            }

            mediaCache[poiId] = mediaData;
            return mediaData;
        }
    } catch (error) {
        console.error('Error loading POI media:', error);
    }

    return { images: [], videos: [], audio: [], models: [] };
}

// Create media gallery HTML
function createMediaGallery(media, poi = {}) {
    console.log('Creating media gallery with:', media);
    if (!media || (!media.images?.length && !media.videos?.length && !media.audio?.length)) {
        console.log('No media found or empty arrays');
        return '';
    }

    let galleryHTML = '<div style="margin-top: 12px; border-top: 1px solid #eee; padding-top: 12px;">';

    // Prepare all media items for navigation and cache them
    const allMediaItems = [];
    const poiCacheKey = `poi_${poi.id || poi.name || Date.now()}`;

    // Add images to media items
    if (media.images && media.images.length > 0) {
        media.images.forEach((image, index) => {
            allMediaItems.push({
                type: 'image',
                path: image.path || image.filename,
                title: image.description || `Görsel ${index + 1}`,
                originalIndex: index
            });
        });
    }

    // Add videos to media items
    if (media.videos && media.videos.length > 0) {
        media.videos.forEach((video, index) => {
            allMediaItems.push({
                type: 'video',
                path: video.path || video.filename,
                title: video.description || `Video ${index + 1}`,
                originalIndex: index
            });
        });
    }

    // Add audio to media items
    if (media.audio && media.audio.length > 0) {
        media.audio.forEach((audio, index) => {
            allMediaItems.push({
                type: 'audio',
                path: audio.path || audio.filename,
                title: audio.description || `Ses ${index + 1}`,
                originalIndex: index
            });
        });
    }

    // Cache the media items
    poiMediaCache[poiCacheKey] = {
        items: allMediaItems,
        poiName: poi.name || 'POI'
    };

    // Images
    if (media.images && media.images.length > 0) {
        galleryHTML += '<div style="margin-bottom: 8px;">';
        galleryHTML += '<div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 6px;">📸 Görseller</div>';
        galleryHTML += '<div style="display: flex; gap: 4px; overflow-x: auto; padding: 2px;">';

        media.images.slice(0, 3).forEach((image, index) => {
            const imagePath = image.preview_path || image.path || `poi_media/${image.filename}`;
            const mediaItemIndex = allMediaItems.findIndex(item =>
                item.type === 'image' && item.originalIndex === index
            );

            galleryHTML += `
                        <img src="/${imagePath}"
                             style="width: 60px; height: 45px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
                             onclick="showPOIMediaFromCache('${poiCacheKey}', ${mediaItemIndex})"
                             title="${image.description || 'Görsel'}" />
                    `;
        });

        if (media.images.length > 3) {
            const firstImageIndex = allMediaItems.findIndex(item => item.type === 'image');
            galleryHTML += `
                        <div style="width: 60px; height: 45px; background: rgba(0,0,0,0.7); color: white; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;"
                             onclick="showPOIMediaFromCache('${poiCacheKey}', ${firstImageIndex})">
                        +${media.images.length - 3}
                        </div>
                    `;
        }

        galleryHTML += '</div></div>';
    }

    // Videos
    if (media.videos && media.videos.length > 0) {
        galleryHTML += '<div style="margin-bottom: 8px;">';
        galleryHTML += '<div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 6px;">🎥 Videolar</div>';
        galleryHTML += '<div style="display: flex; gap: 4px;">';

        media.videos.slice(0, 2).forEach((video, index) => {
            const mediaItemIndex = allMediaItems.findIndex(item =>
                item.type === 'video' && item.originalIndex === index
            );

            galleryHTML += `
                        <div style="background: #f0f0f0; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; border: 1px solid #ddd;"
                             onclick="showPOIMediaFromCache('${poiCacheKey}', ${mediaItemIndex})">
                             🎥 ${video.description || 'Video'}
                        </div>
                    `;
        });

        galleryHTML += '</div></div>';
    }

    // Audio
    if (media.audio && media.audio.length > 0) {
        galleryHTML += '<div style="margin-bottom: 8px;">';
        galleryHTML += '<div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 6px;">🎵 Ses Dosyaları</div>';
        galleryHTML += '<div style="display: flex; gap: 4px;">';

        media.audio.slice(0, 2).forEach((audio, index) => {
            const mediaItemIndex = allMediaItems.findIndex(item =>
                item.type === 'audio' && item.originalIndex === index
            );

            galleryHTML += `
                        <div style="background: #f0f0f0; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; border: 1px solid #ddd;"
                             onclick="showPOIMediaFromCache('${poiCacheKey}', ${mediaItemIndex})">
                             🎵 ${audio.description || 'Ses'}
                        </div>
                    `;
        });

        galleryHTML += '</div></div>';
    }

    galleryHTML += '</div>';
    return galleryHTML;
}

// Open media modal
// Enhanced media modal with navigation functionality
let currentMediaItems = [];
let currentMediaIndex = 0;
let currentPOIId = null;
let poiMediaCache = {}; // Cache for POI media items

function showMediaModal(mediaItems, startIndex = 0, poiId = null) {
    if (!mediaItems || mediaItems.length === 0) {
        console.warn('No media items provided');
        return;
    }

    currentMediaItems = mediaItems;
    currentMediaIndex = startIndex;
    currentPOIId = poiId;

    const modal = document.getElementById('mediaModal');
    const modalTitle = document.getElementById('mediaModalTitle');
    const modalBody = document.getElementById('mediaModalBody');
    const modalClose = document.getElementById('mediaModalClose');
    const prevBtn = document.getElementById('mediaPrevBtn');
    const nextBtn = document.getElementById('mediaNextBtn');
    const counter = document.getElementById('mediaCounter');
    const thumbnails = document.getElementById('mediaThumbnails');

    // Show modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Update navigation visibility
    updateNavigationControls();

    // Load current media
    loadCurrentMedia();

    // Setup event handlers
    modalClose.onclick = closeMediaModal;
    prevBtn.onclick = showPreviousMedia;
    nextBtn.onclick = showNextMedia;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeMediaModal();
        }
    };

    // Setup keyboard handlers
    document.addEventListener('keydown', handleModalKeydown);

    // Accessibility: Focus management
    setTimeout(() => {
        modalClose.focus();
    }, 100);

    // Accessibility: Announce to screen readers
    announceToScreenReader(`Medya görüntüleyici açıldı. ${currentMediaItems.length} medya öğesi mevcut.`);
}

function loadCurrentMedia() {
    if (currentMediaIndex < 0 || currentMediaIndex >= currentMediaItems.length) {
        return;
    }

    const mediaItem = currentMediaItems[currentMediaIndex];
    const modalTitle = document.getElementById('mediaModalTitle');
    const modalBody = document.getElementById('mediaModalBody');

    // Set title
    modalTitle.textContent = mediaItem.title || `Medya ${currentMediaIndex + 1}`;

    // Show loading state
    modalBody.innerHTML = `
                <div class="loading">
                    <div class="loading__spinner"></div>
                    <p class="loading__text">Medya yükleniyor...</p>
                </div>
            `;

    // Load media content
    setTimeout(() => {
        const mediaPath = mediaItem.path.startsWith('/') ? mediaItem.path : `/${mediaItem.path}`;
        let content = '';

        if (mediaItem.type === 'image') {
            content = `
                        <div class="media-display">
                            <div class="media-image-container">
                                <img id="currentMediaImage"
                                     class="media-image-zoomable"
                                     src="${mediaPath}"
                                     alt="${mediaItem.title || 'Görsel'}"
                                     onload="onImageLoad(this)"
                                     onerror="handleMediaError(this, 'Görsel')"
                                     style="opacity: 0; transition: opacity 0.3s ease;" />
                                <div class="image-zoom-controls">
                                    <button class="zoom-btn" id="zoomInBtn" onclick="zoomImage(1.2)" title="Yakınlaştır">
                                        <i class="fas fa-search-plus"></i>
                                    </button>
                                    <button class="zoom-btn" id="zoomOutBtn" onclick="zoomImage(0.8)" title="Uzaklaştır">
                                        <i class="fas fa-search-minus"></i>
                                    </button>
                                    <button class="zoom-btn" id="zoomResetBtn" onclick="resetImageZoom()" title="Sıfırla">
                                        <i class="fas fa-expand-arrows-alt"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        } else if (mediaItem.type === 'video') {
            content = `
                        <div class="media-display">
                            <div class="media-video-container">
                                <video id="currentMediaVideo"
                                       controls preload="metadata"
                                       onloadeddata="onVideoLoad(this)"
                                       onerror="handleMediaError(this, 'Video')"
                                       ontimeupdate="updateVideoProgress(this)"
                                       style="opacity: 0; transition: opacity 0.3s ease; max-width: 100%; max-height: 70vh; border-radius: 8px;">
                                    <source src="${mediaPath}" type="video/mp4">
                                    <source src="${mediaPath}" type="video/webm">
                                    <source src="${mediaPath}" type="video/ogg">
                                    Video formatı desteklenmiyor.
                                </video>
                                <div class="media-progress">
                                    <div class="media-progress-bar" id="videoProgressBar"></div>
                                </div>
                            </div>
                        </div>
                    `;
        } else if (mediaItem.type === 'audio') {
            content = `
                        <div class="media-display">
                            <div class="media-audio-container">
                                <div class="audio-info">
                                    <i class="fas fa-music" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 16px;"></i>
                                    <h4>${mediaItem.title || 'Ses Dosyası'}</h4>
                                    <div class="audio-meta">
                                        <span id="audioFormat">Yükleniyor...</span>
                                    </div>
                                </div>
                                <audio id="currentMediaAudio"
                                       controls preload="metadata"
                                       style="width: 100%; max-width: 500px; opacity: 0; transition: opacity 0.3s ease;"
                                       onloadeddata="onAudioLoad(this)"
                                       onerror="handleMediaError(this, 'Ses')"
                                       ontimeupdate="updateAudioProgress(this)">
                                    <source src="${mediaPath}" type="audio/mpeg">
                                    <source src="${mediaPath}" type="audio/wav">
                                    <source src="${mediaPath}" type="audio/ogg">
                                    Ses formatı desteklenmiyor.
                                </audio>
                                <div class="media-progress">
                                    <div class="media-progress-bar" id="audioProgressBar"></div>
                                </div>
                            </div>
                        </div>
                    `;
        }

        modalBody.innerHTML = content;
        updateNavigationControls();
    }, 300);
}

function updateNavigationControls() {
    const prevBtn = document.getElementById('mediaPrevBtn');
    const nextBtn = document.getElementById('mediaNextBtn');
    const counter = document.getElementById('mediaCounter');
    const thumbnails = document.getElementById('mediaThumbnails');

    // Update navigation buttons
    prevBtn.disabled = currentMediaIndex <= 0;
    nextBtn.disabled = currentMediaIndex >= currentMediaItems.length - 1;

    // Show/hide navigation based on media count
    if (currentMediaItems.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        counter.style.display = 'block';
        counter.textContent = `${currentMediaIndex + 1} / ${currentMediaItems.length}`;

        // Update thumbnails if there are images
        updateThumbnails();
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        counter.style.display = 'none';
        thumbnails.style.display = 'none';
    }
}

function updateThumbnails() {
    const thumbnails = document.getElementById('mediaThumbnails');

    // Only show thumbnails for images
    const imageItems = currentMediaItems.filter(item => item.type === 'image');
    if (imageItems.length <= 1) {
        thumbnails.style.display = 'none';
        return;
    }

    thumbnails.style.display = 'flex';
    thumbnails.innerHTML = '';

    currentMediaItems.forEach((item, index) => {
        if (item.type === 'image') {
            const thumb = document.createElement('img');
            thumb.className = 'media-thumbnail';
            thumb.src = item.path.startsWith('/') ? item.path : `/${item.path}`;
            thumb.alt = item.title || `Görsel ${index + 1}`;

            if (index === currentMediaIndex) {
                thumb.classList.add('active');
            }

            thumb.onclick = () => {
                currentMediaIndex = index;
                loadCurrentMedia();
            };

            thumbnails.appendChild(thumb);
        }
    });
}

function showPreviousMedia() {
    if (currentMediaIndex > 0) {
        currentMediaIndex--;
        loadCurrentMedia();
    }
}

function showNextMedia() {
    if (currentMediaIndex < currentMediaItems.length - 1) {
        currentMediaIndex++;
        loadCurrentMedia();
    }
}

function closeMediaModal() {
    const modal = document.getElementById('mediaModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalKeydown);

    // Reset state
    currentMediaItems = [];
    currentMediaIndex = 0;
    currentPOIId = null;
}

function handleModalKeydown(e) {
    switch (e.key) {
        case 'Escape':
            closeMediaModal();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            showPreviousMedia();
            break;
        case 'ArrowRight':
            e.preventDefault();
            showNextMedia();
            break;
        case ' ':
            // Spacebar for play/pause on videos and audio
            e.preventDefault();
            const video = document.querySelector('.media-display video');
            const audio = document.querySelector('.media-display audio');
            if (video) {
                video.paused ? video.play() : video.pause();
            } else if (audio) {
                audio.paused ? audio.play() : audio.pause();
            }
            break;
    }
}

// Touch gesture support for mobile navigation
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function setupTouchGestures() {
    const modal = document.getElementById('mediaModal');

    modal.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    });

    modal.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipeGesture();
    });
}

function handleSwipeGesture() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;

    // Only handle horizontal swipes that are longer than vertical swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
            // Swipe right - show previous
            showPreviousMedia();
        } else {
            // Swipe left - show next
            showNextMedia();
        }
    }
}

// Initialize touch gestures when modal is shown
function initializeTouchSupport() {
    if ('ontouchstart' in window) {
        setupTouchGestures();
        document.body.classList.add('touch-device');
    }
}

// Call on page load - REMOVED (merged below)

// Check if page is served over HTTPS
function checkSecurityContext() {
    const isSecure = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

    if (!isSecure && location.hostname !== '127.0.0.1') {
        console.warn('⚠️ Page not served over HTTPS - geolocation may not work');

        // Show a subtle warning
        const warning = document.createElement('div');
        warning.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                color: white;
                padding: 12px 16px;
                border-radius: 10px;
                font-size: 0.9rem;
                z-index: 9999;
                box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
                max-width: 300px;
                font-family: 'Segoe UI', sans-serif;
            `;

        warning.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 1.2rem; margin-right: 8px;">🔒</span>
                    <strong>Güvenlik Uyarısı</strong>
                </div>
                <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
                    Konum servisleri için HTTPS gerekli. Manuel konum seçimini kullanabilirsiniz.
                </p>
            `;

        document.body.appendChild(warning);

        // Auto remove after 8 seconds
        setTimeout(() => {
            if (warning.parentNode) {
                warning.style.opacity = '0';
                warning.style.transform = 'translateX(100%)';
                setTimeout(() => warning.remove(), 300);
            }
        }, 8000);
    }
}

// Show location permission explanation dialog
function showLocationPermissionDialog() {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    font-family: 'Segoe UI', sans-serif;
                `;

        dialog.innerHTML = `
                    <div style="
                        background: white;
                        border-radius: 20px;
                        padding: 35px;
                        max-width: 450px;
                        margin: 20px;
                        text-align: center;
                        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
                        animation: modalSlideIn 0.4s ease-out;
                    ">
                        <div style="font-size: 4rem; margin-bottom: 20px;">📍</div>
                        <h3 style="color: #333; margin: 0 0 16px 0; font-size: 1.4rem;">Konum İzni Gerekli</h3>
                        <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6; font-size: 1rem;">
                            Size en yakın POI'leri önerebilmek için konumunuza ihtiyacımız var.
                        </p>
                        
                        <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <span style="font-size: 1.3rem; margin-right: 10px;">🔒</span>
                                <strong style="color: #333;">Gizlilik Güvencesi</strong>
                            </div>
                            <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 0.9rem; line-height: 1.5;">
                                <li>Konumunuz sadece öneriler için kullanılır</li>
                                <li>Hiçbir yerde saklanmaz veya paylaşılmaz</li>
                                <li>İstediğiniz zaman iptal edebilirsiniz</li>
                            </ul>
                        </div>

                        <div style="background: #e3f2fd; padding: 16px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <span style="font-size: 1.3rem; margin-right: 10px;">💡</span>
                                <strong style="color: #1976d2;">Sonraki Adım</strong>
                            </div>
                            <p style="margin: 0; color: #1565c0; font-size: 0.9rem; line-height: 1.5;">
                                \"İzin Ver\" butonuna tıkladıktan sonra tarayıcınız konum izni isteyecek.
                                Lütfen <strong>\"İzin Ver\"</strong> veya <strong>\"Allow\"</strong> seçeneğini seçin.
                            </p>
                        </div>

                        <div style="display: flex; gap: 15px; justify-content: center;">
                            <button onclick="resolveLocationDialog(false)"
                                    style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;">
                                İptal
                            </button>
                            <button onclick="resolveLocationDialog(true)"
                                    style="background: linear-gradient(135deg, var(--primary-color) 0%, #5a6fd8 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                                📍 İzin Ver
                            </button>
                        </div>
                        </div>
                    `;

        // Add resolve function to global scope temporarily
        window.resolveLocationDialog = (accepted) => {
            dialog.remove();
            delete window.resolveLocationDialog;
            resolve(accepted);
        };

        document.body.appendChild(dialog);
    });
}

// Accessibility helper
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

//         // Debug and testing helper
//         function testMediaModal() {
//             const testMedia = [
//                 { type: 'image', path: '/test-image.jpg', title: 'Test Görsel' },
//                 { type: 'video', path: '/test-video.mp4', title: 'Test Video' },
//                 { type: 'audio', path: '/test-audio.mp3', title: 'Test Ses' }
//             ];
// 
//             console.log('Testing media modal with sample data...');
//             showMediaModal(testMedia, 0, 'Test POI');
//         }
// 
//         // Expose test function globally for debugging
//         window.testMediaModal = testMediaModal;

function showMediaError(message, canRetry = true) {
    const modalBody = document.getElementById('mediaModalBody');
    const retryButton = canRetry ? `<button onclick="retryLoadMedia()" style="margin-right: 10px;">Tekrar Dene</button>` : '';

    modalBody.innerHTML = `
                <div class="media-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Medya Yüklenemedi</h3>
                    <p>${message}</p>
                    <div style="margin-top: 20px;">
                        ${retryButton}
                        <button onclick="closeMediaModal()">Kapat</button>
                    </div>
                </div>
            `;
}

function retryLoadMedia() {
    console.log('Retrying media load...');
    loadCurrentMedia();
}

// Enhanced error handling for different media types
function handleMediaError(mediaElement, mediaType) {
    console.error(`${mediaType} load error:`, mediaElement.error);

    let errorMessage = 'Medya dosyası yüklenemedi';
    if (mediaElement.error) {
        switch (mediaElement.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Medya yükleme iptal edildi';
                break;
            case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Ağ hatası nedeniyle medya yüklenemedi';
                break;
            case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Medya dosyası bozuk veya desteklenmiyor';
                break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Medya formatı desteklenmiyor';
                break;
            default:
                errorMessage = 'Bilinmeyen medya hatası';
        }
    }

    showMediaError(errorMessage, true);
}

// Performance optimization: Preload adjacent media
function preloadAdjacentMedia() {
    if (currentMediaItems.length <= 1) return;

    const preloadNext = currentMediaIndex < currentMediaItems.length - 1;
    const preloadPrev = currentMediaIndex > 0;

    if (preloadNext) {
        const nextItem = currentMediaItems[currentMediaIndex + 1];
        preloadMediaItem(nextItem);
    }

    if (preloadPrev) {
        const prevItem = currentMediaItems[currentMediaIndex - 1];
        preloadMediaItem(prevItem);
    }
}

function preloadMediaItem(mediaItem) {
    if (!mediaItem) return;

    const mediaPath = mediaItem.path.startsWith("/") ? mediaItem.path : `/${mediaItem.path}`;

    if (mediaItem.type === 'image') {
        const img = new Image();
        img.src = mediaPath;
    } else if (mediaItem.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = mediaPath;
    }
    // Audio preloading is less critical for performance
}

// Helper function for POI media modal from cache
function showPOIMediaFromCache(cacheKey, startIndex) {
    const cachedData = poiMediaCache[cacheKey];
    if (cachedData && cachedData.items) {
        showMediaModal(cachedData.items, startIndex, cachedData.poiName);
    } else {
        console.error('Media cache not found for key:', cacheKey);
        showMediaError('Medya verileri bulunamadı');
    }
}

// Image zoom functionality
let currentZoom = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let imagePosition = { x: 0, y: 0 };

function onImageLoad(img) {
    img.style.opacity = '1';
    resetImageZoom();
    setupImageDrag(img);
    // Preload adjacent media after current media loads
    setTimeout(preloadAdjacentMedia, 500);
}

function zoomImage(factor) {
    const img = document.getElementById('currentMediaImage');
    if (!img) return;

    currentZoom *= factor;
    currentZoom = Math.max(0.5, Math.min(currentZoom, 3)); // Limit zoom between 0.5x and 3x

    img.style.transform = `scale(${currentZoom}) translate(${imagePosition.x}px, ${imagePosition.y}px)`;

    // Update zoom button states
    document.getElementById('zoomInBtn').disabled = currentZoom >= 3;
    document.getElementById('zoomOutBtn').disabled = currentZoom <= 0.5;

    // Add/remove zoom class for cursor
    if (currentZoom > 1) {
        img.classList.add('media-image-zoomed');
    } else {
        img.classList.remove('media-image-zoomed');
    }
}

function resetImageZoom() {
    const img = document.getElementById('currentMediaImage');
    if (!img) return;

    currentZoom = 1;
    imagePosition = { x: 0, y: 0 };
    img.style.transform = 'scale(1) translate(0px, 0px)';
    img.classList.remove('media-image-zoomed');

    // Reset button states
    document.getElementById('zoomInBtn').disabled = false;
    document.getElementById('zoomOutBtn').disabled = false;
}

function setupImageDrag(img) {
    img.addEventListener('mousedown', (e) => {
        if (currentZoom <= 1) return;
        isDragging = true;
        dragStart.x = e.clientX - imagePosition.x;
        dragStart.y = e.clientY - imagePosition.y;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || currentZoom <= 1) return;
        imagePosition.x = e.clientX - dragStart.x;
        imagePosition.y = e.clientY - dragStart.y;
        img.style.transform = `scale(${currentZoom}) translate(${imagePosition.x}px, ${imagePosition.y}px)`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch support for mobile
    img.addEventListener('touchstart', (e) => {
        if (currentZoom <= 1) return;
        isDragging = true;
        const touch = e.touches[0];
        dragStart.x = touch.clientX - imagePosition.x;
        dragStart.y = touch.clientY - imagePosition.y;
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || currentZoom <= 1) return;
        const touch = e.touches[0];
        imagePosition.x = touch.clientX - dragStart.x;
        imagePosition.y = touch.clientY - dragStart.y;
        img.style.transform = `scale(${currentZoom}) translate(${imagePosition.x}px, ${imagePosition.y}px)`;
        e.preventDefault();
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// Video load handler
function onVideoLoad(video) {
    video.style.opacity = '1';
    console.log('Video loaded:', video.duration, 'seconds');
    // Preload adjacent media after current media loads
    setTimeout(preloadAdjacentMedia, 500);
}

function updateVideoProgress(video) {
    const progressBar = document.getElementById('videoProgressBar');
    if (progressBar && video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.style.width = progress + '%';
    }
}

// Audio load handler
function onAudioLoad(audio) {
    audio.style.opacity = '1';
    const formatSpan = document.getElementById('audioFormat');
    if (formatSpan) {
        const duration = audio.duration;
        if (duration && !isNaN(duration)) {
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            formatSpan.textContent = `Süre: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            formatSpan.textContent = 'Ses dosyası hazır';
        }
    }
    // Preload adjacent media after current media loads
    setTimeout(preloadAdjacentMedia, 500);
}

function updateAudioProgress(audio) {
    const progressBar = document.getElementById('audioProgressBar');
    if (progressBar && audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = progress + '%';
    }
}

// Backward compatibility function
function openMediaModal(filePath, type, title = 'Medya Görüntüleyici') {
    const mediaItem = {
        path: filePath,
        type: type,
        title: title
    };
    showMediaModal([mediaItem], 0);
}

// Elevation cache to prevent repeated API calls
const elevationCache = new Map();
let elevationRequestCount = 0;
const MAX_ELEVATION_REQUESTS = 10; // Limit API requests

// Get elevation data with improved fallback and caching
async function getElevation(lat, lng) {
    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

    // Check cache first
    if (elevationCache.has(cacheKey)) {
        return elevationCache.get(cacheKey);
    }

    // Skip API call if we've made too many requests
    if (elevationRequestCount >= MAX_ELEVATION_REQUESTS) {
        const estimatedElevation = getEstimatedElevation(lat, lng);
        elevationCache.set(cacheKey, estimatedElevation);
        return estimatedElevation;
    }

    try {
        elevationRequestCount++;

        // Use a CORS proxy or alternative approach
        // For now, skip external API and use estimation
        throw new Error('Skipping external API to avoid CORS issues');

    } catch (error) {
        // Always use estimated elevation to avoid CORS and rate limiting issues
        const estimatedElevation = getEstimatedElevation(lat, lng);
        elevationCache.set(cacheKey, estimatedElevation);
        return estimatedElevation;
    }
}

// Improved elevation estimation for Cappadocia region
function getEstimatedElevation(lat, lng) {
    // Cappadocia elevation varies by location
    // Ürgüp: ~1100m, Göreme: ~1000m, Avanos: ~950m

    // Base elevation for the region
    let baseElevation = 1050;

    // Adjust based on approximate location
    if (lat > 38.65) {
        baseElevation += 50; // Northern areas slightly higher
    }
    if (lng > 34.92) {
        baseElevation += 30; // Eastern areas slightly higher
    }

    // Add some realistic variation based on coordinates
    const latVariation = (lat - 38.6) * 1000; // Small variation based on latitude
    const lngVariation = (lng - 34.9) * 500;  // Small variation based on longitude
    const randomVariation = (Math.random() - 0.5) * 100; // ±50m random variation

    const estimatedElevation = Math.round(baseElevation + latVariation + lngVariation + randomVariation);

    // Ensure reasonable bounds for the region (900-1300m)
    const clampedElevation = Math.max(900, Math.min(1300, estimatedElevation));

    console.log(`📏 Estimated elevation for ${lat.toFixed(4)}, ${lng.toFixed(4)}: ${clampedElevation}m`);
    return clampedElevation;
}

// Open in Google Maps with place name
function openInGoogleMaps(lat, lng, name) {
    // Use coordinates for reliable location finding
    const coords = `${lat},${lng}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${coords}`;

    console.log('🗺️ Opening POI in Google Maps:', name, 'at', coords);
    window.open(url, '_blank');
}

// Add to route with throttling
function addToRoute(poi) {
    console.log('➕ Adding POI to route:', poi.name);
    const poiId = poi.id || poi._id;
    if (!selectedPOIs.find(p => (p.id || p._id) === poiId)) {
        poi.id = poiId; // Normalize ID
        selectedPOIs.push(poi);
        console.log('📝 Updated selectedPOIs:', selectedPOIs.length);
        updateRouteDisplay();

        // Throttle route creation to prevent rapid requests
        clearTimeout(window.routeTimeout);
        window.routeTimeout = setTimeout(() => {
            // Create route if we have enough points
            if (selectedPOIs.length >= 1 && (startLocation || selectedPOIs.length >= 2)) {
                createRoute();
            }
        }, 1000); // 1 second delay

    } else {
        console.log('⚠️ POI already in route');
        showNotification('Bu POI zaten rotada mevcut', 'info');
    }
}

// Remove from route
function removeFromRoute(poiId) {
    selectedPOIs = selectedPOIs.filter(p => (p.id || p._id) !== poiId);
    updateRouteDisplay();
    if (selectedPOIs.length > 1) {
        createRoute();
    } else if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
}

// Update route display
function updateRouteDisplay() {
    const routeContainer = document.getElementById('routeContainer');
    if (!routeContainer) return;

    let routeHTML = '';

    // Start location section
    routeHTML += `
                <div style="margin-bottom: 15px; padding: 12px; background: rgba(231, 76, 60, 0.1); border-radius: 12px; border-left: 4px solid #e74c3c;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h6 style="margin: 0; color: #e74c3c; font-size: 14px;">📍 Başlangıç Noktası</h6>
                        ${!startLocation ? `<button onclick="setStartLocation()" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 8px; font-size: 11px; cursor: pointer;">📍 Konumu Al</button>` : ''}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${startLocation ? '✅ ' + startLocation.name : '❌ Başlangıç noktası belirlenmedi'}
                    </div>
                </div>
            `;

    if (selectedPOIs.length === 0) {
        routeHTML += '<p style="text-align: center; color: #666; font-style: italic;">Rota oluşturmak için POI\'leri seçin</p>';
        routeContainer.innerHTML = routeHTML;
        return;
    }

    routeHTML += '<div style="margin-bottom: 15px;"><h6 style="margin: 0; color: var(--primary-color);">🗺️ Seçilen Rotanız</h6></div>';

    // Show start location in route if available
    if (startLocation) {
        routeHTML += `
                    <div style="display: flex; align-items: center; padding: 8px; background: rgba(231, 76, 60, 0.1); border-radius: 8px; margin-bottom: 6px; border-left: 3px solid #e74c3c;">
                        <div style="background: #e74c3c; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 10px;">
                            🏁
                        </div>
                        <div style="flex: 1; font-size: 13px;">
                            <div style="font-weight: 600;">${startLocation.name}</div>
                            <div style="color: #666; font-size: 11px;">Başlangıç</div>
                        </div>
                    </div>
                `;
    }

    selectedPOIs.forEach((poi, index) => {
        const categoryStyle = getCategoryStyle(poi.category);
        const stepNumber = startLocation ? index + 2 : index + 1;
        routeHTML += `
                    <div style="display: flex; align-items: center; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 6px;">
                        <div style="background: ${categoryStyle.color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 10px;">
                            ${stepNumber}
                        </div>
                        <div style="flex: 1; font-size: 13px;">
                            <div style="font-weight: 600;">${poi.name}</div>
                            <div style="color: #666; font-size: 11px;">${getCategoryDisplayName(poi.category)}</div>
                        </div>
                        <button onclick="removeFromRoute('${poi.id || poi._id}')" style="background: #e74c3c; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">×</button>
                    </div>
                `;
    });

    // Route statistics
    const stats = getRouteStatistics();
    if (stats && selectedPOIs.length > 1) {
        routeHTML += `
                    <div style="margin: 15px 0; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 12px; border-left: 4px solid var(--primary-color);">
                        <h6 style="margin: 0 0 8px 0; color: var(--primary-color); font-size: 13px;">📊 Rota İstatistikleri</h6>
                        <div style="font-size: 11px; color: #666; line-height: 1.4;">
                            📏 <strong>Toplam Mesafe:</strong> ${stats.totalDistance.toFixed(2)} km<br>
                            ⏱️ <strong>Tahmini Süre:</strong> ${Math.round(stats.estimatedTime)} dakika<br>
                            📍 <strong>Durak Sayısı:</strong> ${stats.pointCount} nokta<br>
                            🏷️ <strong>Kategoriler:</strong> ${stats.categories.length} farklı kategori
                        </div>
                    </div>
                `;
    }

    if (selectedPOIs.length > 1) {
        routeHTML += `
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="clearRoute()" style="background: #95a5a6; color: white; border: none; padding: 8px 12px; border-radius: 15px; font-size: 12px; cursor: pointer;">🗑️ Rotayı Temizle</button>
                        <button onclick="optimizeRoute()" style="background: var(--accent-color); color: white; border: none; padding: 8px 12px; border-radius: 15px; font-size: 12px; cursor: pointer;">⚡ Optimize Et</button>
                        ${startLocation ? `<button onclick="startLocation = null; updateRouteDisplay();" style="background: #f39c12; color: white; border: none; padding: 8px 12px; border-radius: 15px; font-size: 12px; cursor: pointer;">📍 Başlangıcı Sıfırla</button>` : ''}
                    </div>
                `;
    }

    routeContainer.innerHTML = routeHTML;
}

// Create route using walking paths
async function createRoute() {
    console.log('🚶 Creating walking route with selectedPOIs:', selectedPOIs.length, 'startLocation:', startLocation);

    if (selectedPOIs.length < 1) {
        console.log('❌ Not enough POIs for route');
        return;
    }

    if (routingControl) {
        console.log('🗑️ Removing existing route control');
        map.removeControl(routingControl);
        routingControl = null;
    }

    // Remove existing walking route layers
    map.eachLayer(function (layer) {
        if (layer.options && layer.options.className === 'walking-route') {
            map.removeLayer(layer);
        }
    });

    // Build waypoints including start location
    let waypoints = [];

    if (startLocation) {
        waypoints.push({
            lat: startLocation.latitude,
            lng: startLocation.longitude,
            name: startLocation.name
        });
        console.log('📍 Added start location to waypoints');
    }

    selectedPOIs.forEach((poi, index) => {
        waypoints.push({
            lat: poi.latitude,
            lng: poi.longitude,
            name: poi.name
        });
        console.log(`📍 Added POI ${index + 1}: ${poi.name}`);
    });

    console.log('🗺️ Total waypoints:', waypoints.length);

    if (waypoints.length < 2) {
        console.log('❌ Need at least 2 waypoints for routing');
        return;
    }

    try {
        console.log('🚶 Requesting walking route from API...');

        // Call smart route API (automatically chooses walking or driving)
        const response = await fetch(`${apiBase}/route/smart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                waypoints: waypoints
            })
        });

        if (!response.ok) {
            throw new Error(`Route API error: ${response.status}`);
        }

        const routeData = await response.json();
        console.log('🗺️ Walking route received:', routeData);

        if (routeData.success && routeData.route) {
            // Draw walking route on map
            drawWalkingRoute(routeData.route);

            // Show route info
            showRouteInfo(routeData.route);
        } else {
            throw new Error('Invalid route data received');
        }

    } catch (error) {
        console.error('Walking route error:', error);
        console.log('🔄 Fallback: Using simple line connections...');

        // Fallback to simple line connections
        createSimpleRoute(waypoints);
    }
}

// Create simple route with straight lines (fallback)
function createSimpleRoute(waypoints) {
    console.log('📏 Creating simple route with straight lines');

    if (waypoints.length < 2) return;

    // Remove any existing simple route
    if (window.simpleRouteLayer) {
        map.removeLayer(window.simpleRouteLayer);
    }

    // Create polyline with waypoints
    const latlngs = waypoints.map(wp => [wp.lat, wp.lng]);

    window.simpleRouteLayer = L.polyline(latlngs, {
        color: '#667eea',
        weight: window.innerWidth <= 768 ? 7 : 5, // Thicker on mobile
        opacity: 0.7,
        dashArray: '10, 5' // Dashed line to indicate it's not a real route
    }).addTo(map);

    // Add popup to explain this is a simple route
    window.simpleRouteLayer.bindPopup(
        `
                <div style="text-align: center; font-family: 'Segoe UI', sans-serif;">
                    <h6 style="margin: 0 0 8px 0; color: #667eea;">📏 Basit Rota</h6>
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        Düz çizgi bağlantıları<br>
                        <small>(Gerçek yol rotası değil)</small>
                    </p>
                </div>
                `,
        { autoPan: false }
    );

    // Add route details panel click event
    // Enhanced click/touch event for simple route
    window.simpleRouteLayer.on('click', function (e) {
        // Prevent popup from opening
        e.originalEvent.stopPropagation();

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            totalDistance += getDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
        }

        // Show route details panel
        RouteDetailsPanel.show({
            total_distance: totalDistance.toFixed(2),
            estimated_time: Math.round(totalDistance * 12 * 60), // 12 minutes per km in seconds
            route_type: 'düz çizgi',
            waypoints: selectedPOIs,
            segments: []
        });
    });

    // Add touch support for mobile devices
    window.simpleRouteLayer.on('touchstart', function (e) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
    });

    window.simpleRouteLayer.on('touchend', function (e) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            totalDistance += getDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
        }

        // Show route details panel on touch
        RouteDetailsPanel.show({
            total_distance: totalDistance.toFixed(2),
            estimated_time: Math.round(totalDistance * 12 * 60), // 12 minutes per km in seconds
            route_type: 'düz çizgi',
            waypoints: selectedPOIs,
            segments: []
        });
    });

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        totalDistance += getDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
    }

    console.log(`📏 Basit rota oluşturuldu: ${totalDistance.toFixed(2)} km (düz çizgi mesafesi)`);

    // Show notification
    showNotification(`📏 Basit rota oluşturuldu (${totalDistance.toFixed(2)} km düz çizgi mesafesi)`, 'info');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px;
            `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Clear route
function clearRoute() {
    selectedPOIs = [];
    startLocation = null;
    updateRouteDisplay();

    // Remove routing control
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    // Remove simple route layer
    if (window.simpleRouteLayer) {
        map.removeLayer(window.simpleRouteLayer);
        window.simpleRouteLayer = null;
    }

    // Remove start location marker
    if (map) {
        map.eachLayer(function (layer) {
            if (layer.options && layer.options.icon && layer.options.icon.options.className === 'start-location-marker') {
                map.removeLayer(layer);
            }
        });
    }

    console.log('🗑️ Route cleared');
}

// Optimize route (wrapper for backward compatibility)
function optimizeRoute() {
    optimizeRouteAdvanced();
}

// Calculate distance between two points
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Draw walking route on map
function drawWalkingRoute(routeInfo) {
    console.log('🎨 Drawing walking route:', routeInfo);

    // Remove existing route layers
    map.eachLayer(function (layer) {
        if (layer.options && layer.options.className === 'walking-route') {
            map.removeLayer(layer);
        }
    });

    const routeColor = '#27ae60'; // Green for walking
    const fallbackColor = '#e74c3c'; // Red for fallback
    const routeWeight = window.innerWidth <= 768 ? 8 : 6; // Thicker on mobile
    const routeOpacity = 0.8;

    // Draw each segment
    routeInfo.segments.forEach((segment, index) => {
        const coordinates = segment.coordinates.map(coord => [coord.lat, coord.lng]);

        const polyline = L.polyline(coordinates, {
            color: segment.fallback ? fallbackColor : routeColor,
            weight: routeWeight,
            opacity: routeOpacity,
            dashArray: segment.fallback ? '10, 5' : null,
            className: 'walking-route'
        }).addTo(map);

        // Remove individual segment popups - use unified route details panel instead

        // Add route details panel click event
        // Enhanced click/touch event for route details
        polyline.on('click', function (e) {
            // Prevent popup from opening
            e.originalEvent.stopPropagation();

            // Show route details panel
            RouteDetailsPanel.show({
                total_distance: routeInfo.total_distance,
                estimated_time: routeInfo.estimated_time,
                route_type: 'yürüyüş',
                waypoints: selectedPOIs,
                segments: routeInfo.segments
            });
        });

        // Add touch support for mobile devices
        polyline.on('touchstart', function (e) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
        });

        polyline.on('touchend', function (e) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();

            // Show route details panel on touch
            RouteDetailsPanel.show({
                total_distance: routeInfo.total_distance,
                estimated_time: routeInfo.estimated_time,
                route_type: 'yürüyüş',
                waypoints: selectedPOIs,
                segments: routeInfo.segments
            });
        });

        // Add simple hover tooltip
        if (coordinates.length > 1) {
            const tooltipContent = `${segment.from} → ${segment.to} (${segment.distance.toFixed(2)} km)`;
            polyline.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'center',
                className: 'route-tooltip'
            });
        }
    });

    console.log('✅ Walking route drawn successfully');
}

// Removed createRoutePopupContent - now using unified route details panel

// Open route segment in Google Maps
function openRouteInGoogleMaps(segment) {
    const startCoord = segment.coordinates[0];
    const endCoord = segment.coordinates[segment.coordinates.length - 1];

    // Try to use segment names if available
    const originName = segment.from ? encodeURIComponent(segment.from) : `${startCoord.lat},${startCoord.lng}`;
    const destinationName = segment.to ? encodeURIComponent(segment.to) : `${endCoord.lat},${endCoord.lng}`;

    // Create waypoints for Google Maps (max 25 waypoints)
    let waypoints = '';
    if (segment.coordinates.length > 2) {
        const middlePoints = segment.coordinates.slice(1, -1);
        const maxWaypoints = Math.min(middlePoints.length, 23); // Leave room for start/end
        const step = Math.max(1, Math.floor(middlePoints.length / maxWaypoints));

        const selectedWaypoints = [];
        for (let i = 0; i < middlePoints.length; i += step) {
            selectedWaypoints.push(middlePoints[i]);
        }

        if (selectedWaypoints.length > 0) {
            waypoints = '&waypoints=' + selectedWaypoints.map(coord => `${coord.lat},${coord.lng}`).join('|');
        }
    }

    // Format with place names and coordinates for better recognition
    let originParam, destinationParam;

    if (segment.from && segment.to) {
        // Use place names with coordinates for better recognition
        const originCoords = `${startCoord.lat},${startCoord.lng}`;
        const destCoords = `${endCoord.lat},${endCoord.lng}`;

        originParam = encodeURIComponent(`${segment.from}, Ürgüp`) + '+' + originCoords;
        destinationParam = encodeURIComponent(`${segment.to}, Ürgüp`) + '+' + destCoords;

        console.log('�️ Openming segment with place names:', segment.from, '→', segment.to);
    } else {
        // Fallback to coordinates only
        originParam = `${startCoord.lat},${startCoord.lng}`;
        destinationParam = `${endCoord.lat},${endCoord.lng}`;
        console.log('🗺️ Opening segment with coordinates only');
    }

    // Use coordinates for reliable routing
    const originCoords = `${startCoord.lat},${startCoord.lng}`;
    const destCoords = `${endCoord.lat},${endCoord.lng}`;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}${waypoints}&travelmode=walking`;

    console.log('🗺️ Opening segment:', segment.from || 'Start', '→', segment.to || 'End');
    console.log('🗺️ Segment URL:', url);
    window.open(url, '_blank');
    showNotification('🗺️ Segment Google Maps\'te açıldı!', 'success');
}

// Copy route coordinates to clipboard
function copyRouteCoordinates(coordinates) {
    const coordText = coordinates.map(coord => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`).join('\n');

    if (navigator.clipboard) {
        navigator.clipboard.writeText(coordText).then(() => {
            showNotification('✅ Koordinatlar panoya kopyalandı!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(coordText);
        });
    } else {
        fallbackCopyToClipboard(coordText);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        showNotification('✅ Koordinatlar panoya kopyalandı!', 'success');
    } catch (err) {
        showNotification('❌ Kopyalama başarısız', 'error');
    }

    document.body.removeChild(textArea);
}

// Export full route to Google Maps with names
function exportFullRoute() {
    if (selectedPOIs.length === 0) {
        showNotification('❌ Önce POI seçin', 'error');
        return;
    }

    let waypoints = [];
    let waypointNames = [];

    // Add start location
    if (startLocation) {
        waypoints.push(`${startLocation.latitude},${startLocation.longitude}`);
        waypointNames.push(encodeURIComponent(startLocation.name || 'Başlangıç Noktası'));
    }

    // Add all POIs with names
    selectedPOIs.forEach(poi => {
        waypoints.push(`${poi.latitude},${poi.longitude}`);
        waypointNames.push(encodeURIComponent(poi.name));
    });

    if (waypoints.length < 2) {
        showNotification('❌ En az 2 nokta gerekli', 'error');
        return;
    }

    // Use simple coordinate-based approach for reliability
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];

    let waypointParam = '';
    if (waypoints.length > 2) {
        const middleWaypoints = waypoints.slice(1, -1);
        const maxWaypoints = Math.min(middleWaypoints.length, 23);
        const selectedWaypoints = middleWaypoints.slice(0, maxWaypoints);
        waypointParam = '&waypoints=' + selectedWaypoints.join('|');
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}&travelmode=walking`;

    console.log('🗺️ Exporting full route:');
    console.log('Origin:', origin, startLocation ? `(${startLocation.name})` : selectedPOIs[0] ? `(${selectedPOIs[0].name})` : '');
    console.log('Destination:', destination, selectedPOIs.length > 0 ? `(${selectedPOIs[selectedPOIs.length - 1].name})` : '');
    console.log('Waypoints:', waypoints.slice(1, -1));
    console.log('URL:', url);

    window.open(url, '_blank');
    showNotification('🗺️ Google Maps\'te rota açıldı!', 'success');
}


// Show route information
function showRouteInfo(routeInfo) {
    console.log('📊 Showing route info:', routeInfo);

    let routeInfoDiv = document.getElementById('routeInfo');
    if (!routeInfoDiv) {
        // Create route info div if it doesn't exist
        const routeSection = document.getElementById('routeSection');
        if (routeSection) {
            const infoDiv = document.createElement('div');
            infoDiv.id = 'routeInfo';
            infoDiv.style.cssText = `
                        margin-top: 15px;
                        padding: 15px;
                        background: rgba(39, 174, 96, 0.1);
                        border-radius: 12px;
                        border-left: 4px solid #27ae60;
                    `;
            routeSection.appendChild(infoDiv);
        }
        routeInfoDiv = document.getElementById('routeInfo');
    }

    if (routeInfoDiv) {
        const networkIcon = routeInfo.network_type === 'walking' ? '🚶' : '🚗';
        const networkName = routeInfo.network_type === 'walking' ? 'Yürüyüş Rotası' : 'Araba Rotası';

        routeInfoDiv.innerHTML = `
                    <h6 style="margin: 0 0 10px 0; color: #27ae60; font-size: 14px;">
                        ${networkIcon} ${networkName} Bilgileri
                    </h6>
                    <div style="font-size: 12px; color: #666; line-height: 1.5;">
                        📏 <strong>Toplam Mesafe:</strong> ${routeInfo.total_distance} km<br>
                        ⏱️ <strong>Tahmini Süre:</strong> ${routeInfo.estimated_time} dakika<br>
                        🎯 <strong>Durak Sayısı:</strong> ${routeInfo.waypoint_count} nokta<br>
                        🛤️ <strong>Segment Sayısı:</strong> ${routeInfo.segments.length} bölüm
                        ${routeInfo.warning ? `<br><span style="color: #f39c12;">⚠️ ${routeInfo.warning}</span>` : ''}
                    </div>
                `;
    }
}

// Location permission storage
const LocationPermission = {
    STORAGE_KEY: 'poi_location_permission',

    save(preference) {
        try {
            localStorage.setItem(this.STORAGE_KEY, preference);
        } catch (e) {
            console.warn('Could not save location preference:', e);
        }
    },

    get() {
        try {
            return localStorage.getItem(this.STORAGE_KEY);
        } catch (e) {
            console.warn('Could not read location preference:', e);
            return null;
        }
    },

    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (e) {
            console.warn('Could not clear location preference:', e);
        }
    }
};

// Show location permission dialog
function showLocationDialog() {
    return new Promise((resolve, reject) => {
        const overlay = document.getElementById('locationPermissionOverlay');
        overlay.classList.add('show');

        // Store resolve/reject for later use
        window.locationPermissionResolve = resolve;
        window.locationPermissionReject = reject;
    });
}

// Close location permission dialog
function closeLocationDialog() {
    const overlay = document.getElementById('locationPermissionOverlay');
    overlay.classList.remove('show');

    if (window.locationPermissionReject) {
        window.locationPermissionReject(new Error('Kullanıcı dialog\'u kapattı'));
    }
}

// Show browser permission help
function showBrowserPermissionHelp() {
    const browserName = getBrowserName();
    let instructions = '';

    switch (browserName) {
        case 'Chrome':
            instructions = `
                        <strong>Chrome'da konum iznini açmak için:</strong><br>
                        1. Adres çubuğunun solundaki <strong>🔒 kilit simgesine</strong> tıklayın<br>
                        2. "Konum" seçeneğini <strong>"İzin ver"</strong> yapın<br>
                        3. Sayfayı yenileyin (F5)
                    `;
            break;
        case 'Firefox':
            instructions = `
                        <strong>Firefox'ta konum iznini açmak için:</strong><br>
                        1. Adres çubuğunun solundaki <strong>🛡️ kalkan simgesine</strong> tıklayın<br>
                        2. "Konum" iznini <strong>"İzin ver"</strong> yapın<br>
                        3. Sayfayı yenileyin (F5)
                    `;
            break;
        case 'Safari':
            instructions = `
                        <strong>Safari'de konum iznini açmak için:</strong><br>
                        1. Safari menüsünden <strong>"Tercihler"</strong> açın<br>
                        2. <strong>"Web Siteleri"</strong> sekmesine gidin<br>
                        3. Sol taraftan <strong>"Konum"</strong> seçin<br>
                        4. Bu siteyi <strong>"İzin ver"</strong> yapın
                    `;
            break;
        default:
            instructions = `
                        <strong>Konum iznini açmak için:</strong><br>
                        1. Adres çubuğundaki <strong>kilit/bilgi simgesine</strong> tıklayın<br>
                        2. Konum iznini <strong>"İzin ver"</strong> yapın<br>
                        3. Sayfayı yenileyin (F5)
                    `;
    }

    showNotification(
        `
                <div style="text-align: left; line-height: 1.6;">
                    <h4 style="color: #d93025; margin-bottom: 12px;">⚠️ Konum İzni Gerekli</h4>
                    <p style="margin-bottom: 16px;">Tarayıcınızda konum izni reddedilmiş durumda.</p>
                    ${instructions}
                    <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #4285f4;">
                        <strong>💡 İpucu:</strong> İzni açtıktan sonra sayfayı yenilemeyi unutmayın!
                    </div>
                </div>
                `,
        'error', 10000);

    if (window.locationPermissionReject) {
        window.locationPermissionReject(new Error('Tarayıcı konum izni reddedilmiş'));
    }
}

// Get browser name for specific instructions
function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
}

// Handle location permission choice
async function handleLocationPermission(choice) {
    console.log('🎯 User chose:', choice);
    const overlay = document.getElementById('locationPermissionOverlay');
    overlay.classList.remove('show');

    if (choice === 'never') {
        LocationPermission.save('never');
        if (window.locationPermissionReject) {
            window.locationPermissionReject(new Error('Kullanıcı konum iznini reddetti'));
        }
        return;
    }

    if (choice === 'always') {
        LocationPermission.save('always');
    }

    // Check browser permission state before requesting
    try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('🔍 Browser permission state:', permission.state);

        if (permission.state === 'denied') {
            // Browser has denied permission, show detailed instructions
            showBrowserPermissionHelp();
            return;
        }
    } catch (e) {
        console.warn('Permission API not supported:', e);
    }

    // Proceed with actual geolocation request
    requestActualLocation();
}

// Request actual location from browser
function requestActualLocation() {
    console.log('📱 Requesting actual location from browser...');
    const options = {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('✅ Position received:', position);
            const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            userLocation = location;
            console.log('📍 User location set:', location);

            if (window.locationPermissionResolve) {
                window.locationPermissionResolve(location);
            }
        },
        (error) => {
            console.error('❌ Geolocation error:', error);
            let errorMessage = 'Konum alınamadı';
            let helpText = '';

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Konum izni reddedildi';
                    helpText = 'Konum iznini açmak için: 1. Adres çubuğundaki kilit simgesine tıklayın 2. Konum seçeneğini İzin ver yapın 3. Sayfayı yenileyin';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Konum bilgisi mevcut değil';
                    helpText = 'GPS\'inizi açın, WiFi\'ye bağlanın veya açık alanda olduğunuzdan emin olun.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Konum alma zaman aşımı';
                    helpText = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
                    break;
                default:
                    errorMessage = 'Konum hatası (Kod: ' + error.code + ')';
                    helpText = 'Tarayıcınızı yenileyin ve tekrar deneyin.';
            }

            const fullError = new Error(errorMessage);
            fullError.helpText = helpText;

            if (window.locationPermissionReject) {
                window.locationPermissionReject(fullError);
            }
        },
        options
    );
}

// Get user's current location with native browser dialog
async function getCurrentLocation() {
    return new Promise(async (resolve, reject) => {
        console.log('🔍 Checking geolocation support...');

        // First check if we're on HTTPS or localhost
        const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
        console.log('🔒 Secure context:', isSecureContext);

        if (!navigator.geolocation) {
            console.error('❌ Geolocation not supported');
            const error = new Error('Bu tarayıcı konum hizmetlerini desteklemiyor');
            error.helpText = 'Lütfen güncel bir tarayıcı kullanın (Chrome, Firefox, Safari, Edge)';
            reject(error);
            return;
        }

        if (!isSecureContext) {
            console.error('❌ Not secure context');
            const error = new Error('Konum servisleri güvenli bağlantı gerektiriyor');
            error.helpText = 'Sayfayı HTTPS üzerinden açın veya localhost kullanın';
            reject(error);
            return;
        }

        // Check permission state for debugging
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            console.log('🔍 Permission state:', permission.state);
        } catch (e) {
            console.warn('Permission API not supported');
        }

        // Always try getCurrentPosition - even if permission state is 'denied'
        // This allows the native dialog to show if user has changed browser settings
        console.log('📱 Requesting geolocation permission...');

        const options = {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Position received:', position);
                const location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                userLocation = location;
                console.log('📍 User location set:', location);
                resolve(location);
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
                let errorMessage = 'Konum alınamadı';
                let helpText = '';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Konum izni reddedildi';
                        helpText = `Konum iznini açmak için:
1. Chrome'da adres çubuğundaki kilit simgesine tıklayın
2. "Konum" seçeneğini "İzin ver" yapın
3. Sayfayı yenileyin (F5)

Alternatif: chrome://settings/content/location adresinden site izinlerini kontrol edin`;
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Konum bilgisi mevcut değil';
                        helpText = 'GPS\'inizi açın, WiFi\'ye bağlanın veya açık alanda olduğunuzdan emin olun.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Konum alma zaman aşımı';
                        helpText = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
                        break;
                    default:
                        errorMessage = 'Konum hatası (Kod: ' + error.code + ')';
                        helpText = 'Tarayıcınızı yenileyin ve tekrar deneyin.';
                }

                const fullError = new Error(errorMessage);
                fullError.helpText = helpText;
                reject(fullError);
            },
            options
        );
    });
}

// Set start location for route
async function setStartLocation() {
    console.log('📍 Requesting user location...');

    try {
        console.log('🔍 Checking geolocation support...');
        if (!navigator.geolocation) {
            throw new Error('Bu tarayıcı konum hizmetlerini desteklemiyor');
        }

        console.log('📱 Getting current position...');
        const location = await getCurrentLocation();
        console.log('✅ Location received:', location);

        startLocation = {
            name: 'Mevcut Konumum',
            latitude: location.latitude,
            longitude: location.longitude,
            id: 'current_location'
        };

        // Add start location marker to map
        if (map) {
            console.log('📍 Adding start location marker to map');

            // Remove existing start location markers
            map.eachLayer(function (layer) {
                if (layer.options && layer.options.icon && layer.options.icon.options.className === 'start-location-marker') {
                    map.removeLayer(layer);
                }
            });

            const startIcon = L.divIcon({
                html: `
                            <div style="
                                background: #e74c3c;
                                width: 30px;
                                height: 30px;
                                border-radius: 50%;
                                border: 3px solid white;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 14px;
                                color: white;
                            ">
                                📍
                            </div>
                        `,
                className: 'start-location-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const startMarker = L.marker([location.latitude, location.longitude], { icon: startIcon })
                .addTo(map)
                .bindPopup(
                    `
                            <div style="text-align: center; font-family: 'Segoe UI', sans-serif;">
                                <h6 style="margin: 0 0 8px 0; color: #e74c3c;">📍 Başlangıç Noktası</h6>
                                <p style="margin: 0; font-size: 12px; color: #666;">Mevcut Konumunuz</p>
                                <div style="margin-top: 8px; font-size: 10px; color: #888;">
                                    ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
                                </div>
                                <div style="margin-top: 8px; font-size: 10px; color: #888;">
                                    Doğruluk: ±${Math.round(location.accuracy)}m
                                </div>
                            </div>
                            `,
                    { autoPan: false }
                );

            // Center map on user location
            map.setView([location.latitude, location.longitude], 15);
            console.log('🗺️ Map centered on user location');
        }

        updateRouteDisplay();

        // Create route if POIs are selected
        if (selectedPOIs.length > 0) {
            createRoute();
        }

        alert(`✅ Başlangıç noktası belirlendi!\nKonum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\nDoğruluk: ±${Math.round(location.accuracy)}m`);

    } catch (error) {
        console.error('❌ Location error:', error);

        // Create a better error dialog
        const errorDialog = document.createElement('div');
        errorDialog.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    font-family: 'Segoe UI', sans-serif;
                `;

        errorDialog.innerHTML = `
                    <div style="
                        background: white;
                        border-radius: 20px;
                        padding: 35px;
                        max-width: 500px;
                        margin: 20px;
                        text-align: center;
                        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
                        animation: modalSlideIn 0.4s ease-out;
                    ">
                        <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
                        <h3 style="color: #e74c3c; margin: 0 0 16px 0; font-size: 1.4rem;">Konum Hatası</h3>
                        <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6; font-size: 1rem;">
                            ${error.message}
                        </p>
                        ${error.helpText ? `
                            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 18px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                    <span style="font-size: 1.4rem; margin-right: 10px;">🔧</span>
                                    <strong style="color: #856404; font-size: 1.1rem;">Nasıl Düzeltilir?</strong>
                                </div>
                                <div style="color: #856404; font-size: 0.95rem; line-height: 1.6;">
                                    ${error.helpText}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div style="background: #e8f5e8; border: 1px solid #c3e6c3; padding: 18px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <span style="font-size: 1.4rem; margin-right: 10px;">🗺️</span>
                                <strong style="color: #2d5a2d; font-size: 1.1rem;">Alternatif Çözüm</strong>
                            </div>
                            <p style="margin: 0; color: #2d5a2d; font-size: 0.95rem; line-height: 1.6;">
                                Konum izni vermek istemiyorsanız, haritadan manuel olarak başlangıç noktanızı seçebilirsiniz. 
                                Haritayı açtıktan sonra istediğiniz noktaya tıklayın.
                            </p>
                        </div>
                        
                        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;">
                                Anladım
                            </button>
                            <button onclick="setStartLocation(); this.parentElement.parentElement.parentElement.remove();" 
                                    style="background: var(--primary-color); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                                🔄 Tekrar Dene
                            </button>
                            <button onclick="showManualLocationHelp(); this.parentElement.parentElement.parentElement.remove();" 
                                    style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                                🗺️ Manuel Seçim
                            </button>
                        </div>
                    </div>
                `;

        document.body.appendChild(errorDialog);
    }
}

// Show manual location selection help
function showManualLocationHelp() {
    const helpDialog = document.createElement('div');
    helpDialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
                font-family: 'Segoe UI', sans-serif;
            `;

    helpDialog.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 20px;
                    padding: 35px;
                    max-width: 500px;
                    margin: 20px;
                    text-align: center;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
                    animation: modalSlideIn 0.4s ease-out;
                ">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🗺️</div>
                    <h3 style="color: #28a745; margin: 0 0 16px 0; font-size: 1.4rem;">Manuel Konum Seçimi</h3>
                    <p style="color: #666; margin: 0 0 25px 0; line-height: 1.6; font-size: 1rem;">
                        Haritadan başlangıç noktanızı manuel olarak seçebilirsiniz.
                    </p>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                        <h4 style="color: #333; margin: 0 0 15px 0; font-size: 1.1rem;">📋 Adımlar:</h4>
                        <ol style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                            <li>Önce \"Önerilerimi Getir\" butonuna tıklayın</li>
                            <li>Harita açıldığında istediğiniz noktaya tıklayın</li>
                            <li>O nokta başlangıç noktanız olarak ayarlanacak</li>
                            <li>Rota planlaması bu noktadan başlayacak</li>
                        </ol>
                    </div>

                    <div style="background: #e3f2fd; padding: 18px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="font-size: 1.3rem; margin-right: 10px;">💡</span>
                            <strong style="color: #1976d2;">İpucu</strong>
                        </div>
                        <p style="margin: 0; color: #1565c0; font-size: 0.9rem; line-height: 1.5;">
                            Otel, ev veya herhangi bir merkezi nokta seçebilirsiniz.
                            Öneriler bu noktaya yakınlığa göre sıralanacak.
                        </p>
                    </div>

                    <button onclick="this.parentElement.parentElement.remove()"
                            style="background: var(--primary-color); color: white; border: none; padding: 12px 30px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                        ✅ Anladım
                    </button>
                </div>
            `;

    document.body.appendChild(helpDialog);
}

// Advanced route optimization using 2-opt algorithm
function optimizeRouteAdvanced() {
    if (selectedPOIs.length < 3) {
        alert('Optimize etmek için en az 3 POI seçmelisiniz.');
        return;
    }

    console.log('🔄 Rota optimize ediliyor...');

    // Include start location if available
    let allPoints = [...selectedPOIs];
    if (startLocation) {
        allPoints.unshift(startLocation);
    }

    // Apply 2-opt optimization
    let bestRoute = [...allPoints];
    let bestDistance = calculateTotalDistance(bestRoute);
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 1; i < bestRoute.length - 2; i++) {
            for (let j = i + 1; j < bestRoute.length; j++) {
                if (j - i === 1) continue; // Skip adjacent edges

                // Create new route by reversing the segment between i and j
                let newRoute = [...bestRoute];
                let segment = newRoute.slice(i, j + 1).reverse();
                newRoute.splice(i, j - i + 1, ...segment);

                let newDistance = calculateTotalDistance(newRoute);

                if (newDistance < bestDistance) {
                    bestRoute = newRoute;
                    bestDistance = newDistance;
                    improved = true;
                    console.log(`📈 İyileştirme bulundu! Yeni mesafe: ${bestDistance.toFixed(2)} km`);
                }
            }
        }
    }

    // Update selected POIs (excluding start location)
    if (startLocation && bestRoute[0].id === 'current_location') {
        selectedPOIs = bestRoute.slice(1);
    } else {
        selectedPOIs = bestRoute;
    }

    updateRouteDisplay();

    // Throttle route creation after optimization
    clearTimeout(window.routeTimeout);
    window.routeTimeout = setTimeout(() => {
        createRoute();
    }, 1500); // 1.5 second delay for optimization

    const improvement = ((calculateTotalDistance(allPoints) - bestDistance) / calculateTotalDistance(allPoints) * 100);
    showNotification(`✅ Rota optimize edildi! ${iterations} iterasyon, ${bestDistance.toFixed(2)} km, %${improvement.toFixed(1)} iyileştirme`, 'success');
}

// Calculate total distance of a route
function calculateTotalDistance(route) {
    if (route.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += getDistance(
            route[i].latitude, route[i].longitude,
            route[i + 1].latitude, route[i + 1].longitude
        );
    }
    return totalDistance;
}

// Get route statistics
function getRouteStatistics() {
    if (selectedPOIs.length < 2) return null;

    let allPoints = [...selectedPOIs];
    if (startLocation) {
        allPoints.unshift(startLocation);
    }

    const totalDistance = calculateTotalDistance(allPoints);
    const estimatedTime = totalDistance * 0.75; // Assume 45 minutes per km (walking + visit time)

    return {
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        pointCount: allPoints.length,
        categories: [...new Set(selectedPOIs.map(poi => poi.category))]
    };
}

// Route Tab Management Functions
function initializeRouteTabs() {
    console.log('🔄 Initializing route tabs...');
    
    const dynamicTab = document.getElementById('dynamicRoutesTab');
    const predefinedTab = document.getElementById('predefinedRoutesTab');
    const dynamicContent = document.getElementById('dynamicRoutesContent');
    const predefinedContent = document.getElementById('predefinedRoutesContent');
    
    if (!dynamicTab || !predefinedTab || !dynamicContent || !predefinedContent) {
        console.error('❌ Route tab elements not found');
        return;
    }
    
    // Add click event listeners
    dynamicTab.addEventListener('click', () => switchTab('dynamic-routes'));
    predefinedTab.addEventListener('click', () => switchTab('predefined-routes'));
    
    // Initialize predefined routes functionality
    initializePredefinedRoutes();
    
    console.log('✅ Route tabs initialized');
}

function switchTab(tabName) {
    console.log(`🔄 Switching to tab: ${tabName}`);
    
    currentTab = tabName;
    
    // Update tab buttons
    const dynamicTab = document.getElementById('dynamicRoutesTab');
    const predefinedTab = document.getElementById('predefinedRoutesTab');
    const dynamicContent = document.getElementById('dynamicRoutesContent');
    const predefinedContent = document.getElementById('predefinedRoutesContent');
    
    // Remove active classes
    dynamicTab.classList.remove('active');
    predefinedTab.classList.remove('active');
    dynamicContent.classList.remove('active');
    predefinedContent.classList.remove('active');
    
    // Add active class to selected tab
    if (tabName === 'dynamic-routes') {
        dynamicTab.classList.add('active');
        dynamicContent.classList.add('active');
        
        // Keep map visible if it exists and has content
        const mapSection = document.getElementById('mapSection');
        if (mapSection && map && (markers.length > 0 || selectedPOIs.length > 0)) {
            mapSection.style.display = 'block';
            // Refresh map size in case it was hidden
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 100);
        }
    } else if (tabName === 'predefined-routes') {
        predefinedTab.classList.add('active');
        predefinedContent.classList.add('active');
        
        // Load predefined routes if not already loaded
        if (predefinedRoutes.length === 0) {
            loadPredefinedRoutes();
        }
        
        // Initialize map for predefined routes if not already initialized
        setTimeout(async () => {
            const mapSection = document.getElementById('mapSection');
            if (mapSection && !map) {
                console.log('🗺️ Initializing map for predefined routes tab...');
                mapSection.style.display = 'block';
                await initializeEmptyMap();
            } else if (mapSection && map) {
                // Just show the map section if map already exists
                mapSection.style.display = 'block';
                // Refresh map size in case it was hidden
                setTimeout(() => {
                    if (map) {
                        map.invalidateSize();
                    }
                }, 100);
            }
        }, 100);
    }
}

function initializePredefinedRoutes() {
    console.log('🔄 Initializing predefined routes functionality...');
    
    // Initialize filter event listeners
    const routeTypeFilter = document.getElementById('routeTypeFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const durationFilter = document.getElementById('durationFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    if (routeTypeFilter) {
        routeTypeFilter.addEventListener('change', applyRouteFilters);
    }
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', applyRouteFilters);
    }
    if (durationFilter) {
        durationFilter.addEventListener('change', applyRouteFilters);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearRouteFilters);
    }
    
    console.log('✅ Predefined routes functionality initialized');
}

async function loadPredefinedRoutes() {
    console.log('📋 Loading predefined routes...');
    
    const loadingIndicator = document.getElementById('routesLoadingIndicator');
    const routesList = document.getElementById('predefinedRoutesList');
    const noRoutesMessage = document.getElementById('noRoutesMessage');
    
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (routesList) routesList.style.display = 'none';
    if (noRoutesMessage) noRoutesMessage.style.display = 'none';
    
    try {
        const response = await fetch(`${apiBase}/routes`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Predefined routes loaded:', data);
            
            // API returns {success: true, routes: [...], count: ...}
            const routes = data.routes || [];
            
            predefinedRoutes = routes;
            filteredRoutes = [...routes];
            
            displayPredefinedRoutes(filteredRoutes);
        } else {
            console.error('❌ Failed to load predefined routes:', response.status);
            showNoRoutesMessage('Rotalar yüklenirken hata oluştu.');
        }
    } catch (error) {
        console.error('❌ Error loading predefined routes:', error);
        showNoRoutesMessage('Rotalar yüklenirken hata oluştu.');
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function displayPredefinedRoutes(routes) {
    const routesList = document.getElementById('predefinedRoutesList');
    const noRoutesMessage = document.getElementById('noRoutesMessage');
    
    if (!routesList) return;
    
    if (routes.length === 0) {
        routesList.style.display = 'none';
        if (noRoutesMessage) noRoutesMessage.style.display = 'block';
        return;
    }
    
    routesList.style.display = 'grid';
    if (noRoutesMessage) noRoutesMessage.style.display = 'none';
    
    routesList.innerHTML = routes.map(route => createRouteCard(route)).join('');
    
    // Add click event listeners to route cards
    routesList.querySelectorAll('.route-card').forEach((card, index) => {
        card.addEventListener('click', () => showRouteDetails(routes[index]));
    });
}

function createRouteCard(route) {
    const difficultyStars = createDifficultyStars(route.difficulty_level || 1);
    const duration = Math.round((route.estimated_duration || 0) / 60);
    const distance = (route.total_distance || 0).toFixed(1);
    const poiCount = route.poi_count || 0;
    
    console.log('🏷️ Creating route card:', {
        name: route.name,
        poiCount: poiCount,
        rawPoiCount: route.poi_count
    });
    
    return `
        <div class="route-card" data-route-id="${route.id}">
            <div class="route-card-header">
                <h3 class="route-card-title">${route.name || 'İsimsiz Rota'}</h3>
                <p class="route-card-description">${route.description || 'Açıklama bulunmuyor.'}</p>
            </div>
            <div class="route-card-meta">
                <div class="route-meta-item">
                    <i class="fas fa-route"></i>
                    <span>${getRouteTypeDisplayName(route.route_type)}</span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-clock"></i>
                    <span>${duration} saat</span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${distance} km</span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-map-marked-alt"></i>
                    <span>${poiCount} yer</span>
                </div>
                <div class="route-meta-item route-difficulty">
                    <i class="fas fa-mountain"></i>
                    <div class="difficulty-stars">${difficultyStars}</div>
                </div>
            </div>
        </div>
    `;
}

function createDifficultyStars(level) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= level ? 'filled' : '';
        stars += `<div class="difficulty-star ${filled}"></div>`;
    }
    return stars;
}

function getRouteTypeDisplayName(routeType) {
    const types = {
        'walking': 'Yürüyüş',
        'hiking': 'Doğa Yürüyüşü',
        'cycling': 'Bisiklet',
        'driving': 'Araç'
    };
    return types[routeType] || routeType || 'Bilinmiyor';
}

function applyRouteFilters() {
    console.log('🔍 Applying route filters...');
    
    const routeTypeFilter = document.getElementById('routeTypeFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const durationFilter = document.getElementById('durationFilter');
    
    const filters = {
        routeType: routeTypeFilter ? routeTypeFilter.value : '',
        difficulty: difficultyFilter ? difficultyFilter.value : '',
        duration: durationFilter ? durationFilter.value : ''
    };
    
    filteredRoutes = predefinedRoutes.filter(route => {
        // Route type filter
        if (filters.routeType && route.route_type !== filters.routeType) {
            return false;
        }
        
        // Difficulty filter
        if (filters.difficulty && route.difficulty_level !== parseInt(filters.difficulty)) {
            return false;
        }
        
        // Duration filter
        if (filters.duration) {
            const duration = route.estimated_duration || 0;
            const [min, max] = filters.duration.split('-').map(Number);
            if (duration < min || (max !== 999 && duration > max)) {
                return false;
            }
        }
        
        return true;
    });
    
    console.log(`✅ Filtered routes: ${filteredRoutes.length}/${predefinedRoutes.length}`);
    displayPredefinedRoutes(filteredRoutes);
}

function clearRouteFilters() {
    console.log('🧹 Clearing route filters...');
    
    const routeTypeFilter = document.getElementById('routeTypeFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const durationFilter = document.getElementById('durationFilter');
    
    if (routeTypeFilter) routeTypeFilter.value = '';
    if (difficultyFilter) difficultyFilter.value = '';
    if (durationFilter) durationFilter.value = '';
    
    filteredRoutes = [...predefinedRoutes];
    displayPredefinedRoutes(filteredRoutes);
}

function showNoRoutesMessage(message = 'Seçilen kriterlere uygun rota bulunamadı.') {
    const routesList = document.getElementById('predefinedRoutesList');
    const noRoutesMessage = document.getElementById('noRoutesMessage');
    
    if (routesList) routesList.style.display = 'none';
    if (noRoutesMessage) {
        noRoutesMessage.style.display = 'block';
        const messageP = noRoutesMessage.querySelector('p');
        if (messageP) messageP.textContent = message;
    }
}

function showRouteDetails(route) {
    console.log('📋 Showing route details for:', route);
    
    const modal = document.getElementById('routeDetailModal');
    const modalTitle = document.getElementById('routeDetailModalTitle');
    const modalBody = document.getElementById('routeDetailModalBody');
    const selectBtn = document.getElementById('routeSelectBtn');
    
    if (!modal || !modalTitle || !modalBody || !selectBtn) {
        console.error('❌ Route detail modal elements not found');
        return;
    }
    
    // Set modal title
    modalTitle.textContent = route.name || 'Rota Detayları';
    
    // Show loading state
    modalBody.innerHTML = `
        <div class="loading">
            <div class="loading__spinner"></div>
            <p class="loading__text">Rota detayları yükleniyor...</p>
        </div>
    `;
    
    // Show modal
    modal.classList.add('show');
    
    // Load route details
    loadRouteDetails(route, modalBody);
    
    // Setup select button
    selectBtn.onclick = () => selectPredefinedRoute(route);
    
    // Setup close functionality
    const closeBtn = document.getElementById('routeDetailModalClose');
    if (closeBtn) {
        closeBtn.onclick = () => closeRouteDetailModal();
    }
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeRouteDetailModal();
        }
    };
    
    // Close on Escape key
    document.addEventListener('keydown', handleRouteModalKeydown);
}

function handleRouteModalKeydown(e) {
    if (e.key === 'Escape') {
        closeRouteDetailModal();
    }
}

function closeRouteDetailModal() {
    const modal = document.getElementById('routeDetailModal');
    if (modal) {
        modal.classList.remove('show');
        document.removeEventListener('keydown', handleRouteModalKeydown);
        
        // Clean up preview maps
        cleanupPreviewMaps();
    }
}

async function loadRouteDetails(route, container) {
    try {
        // Fetch detailed route information including POIs
        const response = await fetch(`${apiBase}/routes/${route.id}`);
        
        if (response.ok) {
            const detailedRoute = await response.json();
            displayRouteDetails(detailedRoute, container);
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error loading route details:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px; color: #f56565;"></i>
                <p>Rota detayları yüklenirken hata oluştu.</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Lütfen daha sonra tekrar deneyin.</p>
            </div>
        `;
    }
}

function displayRouteDetails(routeData, container) {
    // Handle API response structure - API returns {success: true, route: {...}}
    const route = routeData.success ? routeData.route : routeData;
    
    const duration = Math.round((route.estimated_duration || 0) / 60);
    const distance = (route.total_distance || 0).toFixed(1);
    const difficultyStars = createDifficultyStars(route.difficulty_level || 1);
    const pois = route.pois || [];
    const poiCount = pois.length;
    
    console.log('📊 Displaying route details:', {
        routeName: route.name,
        poiCount: poiCount,
        pois: pois
    });
    
    // Generate unique ID for this modal's map
    const previewMapId = `routePreviewMap_${route.id}`;
    
    container.innerHTML = `
        <div class="route-detail-content">
            <div class="route-detail-summary">
                <div class="route-summary-grid">
                    <div class="summary-item">
                        <i class="fas fa-route"></i>
                        <div>
                            <span class="summary-label">Rota Tipi</span>
                            <span class="summary-value">${getRouteTypeDisplayName(route.route_type)}</span>
                        </div>
                    </div>
                    <div class="summary-item">
                        <i class="fas fa-clock"></i>
                        <div>
                            <span class="summary-label">Süre</span>
                            <span class="summary-value">${duration} saat</span>
                        </div>
                    </div>
                    <div class="summary-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <span class="summary-label">Mesafe</span>
                            <span class="summary-value">${distance} km</span>
                        </div>
                    </div>
                    <div class="summary-item">
                        <i class="fas fa-mountain"></i>
                        <div>
                            <span class="summary-label">Zorluk</span>
                            <div class="difficulty-stars">${difficultyStars}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${poiCount > 0 ? `
            <div class="route-preview-section">
                <h4><i class="fas fa-map"></i> Rota Ön İzlemesi</h4>
                <div class="route-preview-map-container" onclick="expandRoutePreview('${route.id}', '${route.name}')" style="cursor: pointer;" title="Büyük haritada görüntülemek için tıklayın">
                    <div id="${previewMapId}" class="route-preview-map"></div>
                    <div class="route-preview-overlay">
                        <div class="route-preview-info">
                            <span><i class="fas fa-map-marked-alt"></i> ${poiCount} durak</span>
                            <span><i class="fas fa-route"></i> ${distance} km</span>
                        </div>
                        <div class="route-preview-expand-hint">
                            <i class="fas fa-expand-alt"></i>
                            <span>Büyütmek için tıklayın</span>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="route-detail-description">
                <h4><i class="fas fa-info-circle"></i> Açıklama</h4>
                <p>${route.description || 'Bu rota için açıklama bulunmuyor.'}</p>
            </div>
            
            <div class="route-detail-pois">
                <h4><i class="fas fa-map-marked-alt"></i> Rota Üzerindeki Yerler (${poiCount})</h4>
                ${poiCount > 0 ? createPOIList(pois) : '<p style="color: #666; font-style: italic;">Bu rotada henüz POI tanımlanmamış.</p>'}
            </div>
        </div>
    `;
    
    // Initialize preview map if POIs exist
    if (poiCount > 0) {
        // Show loading state initially
        const previewMapContainer = document.getElementById(previewMapId);
        if (previewMapContainer) {
            previewMapContainer.innerHTML = `
                <div class="route-preview-loading">
                    <i class="fas fa-spinner"></i>
                    Harita yükleniyor...
                </div>
            `;
        }
        
        setTimeout(() => {
            initializeRoutePreviewMap(previewMapId, pois);
        }, 200);
    }
}

function createPOIList(pois) {
    if (!pois || pois.length === 0) {
        return '<p style="color: #666; font-style: italic;">Bu rotada POI bulunmuyor.</p>';
    }
    
    return `
        <div class="route-pois-list">
            ${pois.map((poi, index) => `
                <div class="route-poi-item">
                    <div class="poi-order">${index + 1}</div>
                    <div class="poi-info">
                        <div class="poi-name">${poi.name}</div>
                        <div class="poi-category">${getCategoryDisplayName(poi.category)}</div>
                        ${poi.notes ? `<div class="poi-notes">${poi.notes}</div>` : ''}
                    </div>
                    <div class="poi-time">
                        ${poi.estimated_time_at_poi ? `${poi.estimated_time_at_poi} dk` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function selectPredefinedRoute(route) {
    console.log('✅ Selecting predefined route:', route);
    
    // Close modal
    closeRouteDetailModal();
    
    // Switch to dynamic routes tab to show the selected route
    switchTab('dynamic-routes');
    
    // Show notification
    showNotification(`✅ "${route.name}" rotası seçildi!`, 'success');
    
    // Show loading state and ensure sections are visible
    const resultsSection = document.getElementById('resultsSection');
    const routeSection = document.getElementById('routeSection');
    const mapSection = document.getElementById('mapSection');
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
        
        const recommendationResults = document.getElementById('recommendationResults');
        if (recommendationResults) {
            recommendationResults.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <div class="loading">
                        <div class="loading__spinner"></div>
                        <p class="loading__text">Rota POI'leri yükleniyor...</p>
                    </div>
                </div>
            `;
        }
    }
    
    // Make sure route section (which contains the map) is visible
    if (routeSection) {
        routeSection.style.display = 'block';
    }
    
    // Make sure map section is visible and initialize map if needed
    if (mapSection) {
        mapSection.style.display = 'block';
        
        // Initialize map immediately if it doesn't exist
        if (!map) {
            console.log('🗺️ Initializing map for predefined route...');
            await initializeEmptyMap();
        }
    }
    
    try {
        // Load route POIs from API
        console.log('📍 Loading POIs for route:', route.id);
        const response = await fetch(`${apiBase}/routes/${route.id}`);
        
        if (response.ok) {
            const routeData = await response.json();
            console.log('✅ Route data loaded:', routeData);
            
            // Extract POIs from route data - API returns {success: true, route: {...}}
            const routePOIs = routeData.route?.pois || [];
            console.log('📍 Route POIs:', routePOIs);
            
            if (routePOIs.length > 0) {
                // Display route info and POIs
                displaySelectedRoute(route, routePOIs);
                
                // Show POIs on map with a small delay to ensure everything is ready
                setTimeout(async () => {
                    await displayRoutePOIsOnMap(routePOIs);
                    
                    // Try to load and display saved route geometry
                    await loadAndDisplayRouteGeometry(route.id);
                    
                    // Fit map to show all POIs
                    setTimeout(() => {
                        fitMapToRoutePOIs(routePOIs);
                    }, 300);
                }, 200);
            } else {
                // No POIs found, show message
                displayRouteWithoutPOIs(route);
            }
        } else {
            console.error('❌ Failed to load route data:', response.status);
            showNotification('Rota detayları yüklenirken hata oluştu', 'error');
            displayRouteWithoutPOIs(route);
        }
    } catch (error) {
        console.error('❌ Error loading route POIs:', error);
        showNotification('Rota yüklenirken hata oluştu', 'error');
        displayRouteWithoutPOIs(route);
    }
}

function displaySelectedRoute(route, pois) {
    const recommendationResults = document.getElementById('recommendationResults');
    if (!recommendationResults) return;
    
    const poisHtml = pois.map((poi, index) => `
        <div class="route-poi-item" style="display: flex; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
            <div class="poi-order" style="background: var(--primary-color); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px;">
                ${poi.order_in_route || index + 1}
            </div>
            <div class="poi-info" style="flex: 1;">
                <div style="font-weight: 500; color: var(--text-color);">${poi.name}</div>
                <div style="font-size: 12px; color: #666;">
                    ${poi.category} • ${poi.estimated_time_at_poi || 15} dakika
                    ${poi.is_mandatory ? ' • <span style="color: #dc3545;">Zorunlu</span>' : ' • <span style="color: #28a745;">İsteğe bağlı</span>'}
                </div>
            </div>
        </div>
    `).join('');
    
    recommendationResults.innerHTML = `
        <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden;">
            <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-route" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 12px;"></i>
                    <h3 style="margin: 0 0 8px 0; color: var(--text-color);">${route.name}</h3>
                    <p style="color: #666; margin: 0 0 16px 0;">${route.description || 'Hazır rota'}</p>
                    <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                        <span style="color: #666;"><i class="fas fa-clock"></i> ${Math.round((route.estimated_duration || 0) / 60)} saat</span>
                        <span style="color: #666;"><i class="fas fa-map-marker-alt"></i> ${(route.total_distance || 0).toFixed(1)} km</span>
                        <span style="color: #666;"><i class="fas fa-route"></i> ${getRouteTypeDisplayName(route.route_type)}</span>
                        <span style="color: #666;"><i class="fas fa-star"></i> Zorluk: ${getDifficultyStars(route.difficulty_level)}</span>
                    </div>
                </div>
            </div>
            <div style="padding: 20px;">
                <h4 style="margin: 0 0 16px 0; color: var(--text-color); display: flex; align-items: center;">
                    <i class="fas fa-map-marked-alt" style="margin-right: 8px; color: var(--primary-color);"></i>
                    Rota Durakları (${pois.length})
                </h4>
                <div class="route-pois-list">
                    ${poisHtml}
                </div>
            </div>
        </div>
    `;
}

function displayRouteWithoutPOIs(route) {
    const recommendationResults = document.getElementById('recommendationResults');
    if (!recommendationResults) return;
    
    recommendationResults.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <i class="fas fa-route" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 16px;"></i>
            <h3 style="margin: 0 0 12px 0; color: var(--text-color);">${route.name}</h3>
            <p style="color: #666; margin: 0 0 20px 0;">${route.description || 'Seçilen rota'}</p>
            <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-bottom: 20px;">
                <span style="color: #666;"><i class="fas fa-clock"></i> ${Math.round((route.estimated_duration || 0) / 60)} saat</span>
                <span style="color: #666;"><i class="fas fa-map-marker-alt"></i> ${(route.total_distance || 0).toFixed(1)} km</span>
                <span style="color: #666;"><i class="fas fa-route"></i> ${getRouteTypeDisplayName(route.route_type)}</span>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; color: #856404;">
                <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                Bu rota için henüz POI bilgileri tanımlanmamış.
            </div>
        </div>
    `;
}

async function displayRoutePOIsOnMap(pois) {
    console.log('🗺️ Displaying route POIs on map:', pois);
    
    // Ensure map is initialized
    if (!map) {
        console.log('🗺️ Map not initialized, initializing now...');
        await initializeEmptyMap();
        if (!map) {
            console.error('❌ Failed to initialize map');
            return;
        }
    }
    
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];
    
    // Add POI markers to map
    const routeCoordinates = [];
    let markersAdded = 0;
    
    for (let i = 0; i < pois.length; i++) {
        const poi = pois[i];
        
        if (poi.lat && poi.lon) {
            try {
                const lat = parseFloat(poi.lat);
                const lon = parseFloat(poi.lon);
                
                // Validate coordinates
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    console.warn(`Invalid coordinates for POI ${poi.name}: ${lat}, ${lon}`);
                    continue;
                }
                
                const coordinates = [lat, lon];
                routeCoordinates.push(coordinates);
                
                // Create custom marker icon with category style and order number
                const categoryStyle = getCategoryStyle(poi.category || 'diger');
                const markerColor = poi.is_mandatory ? '#dc3545' : categoryStyle.color;
                
                const markerIcon = L.divIcon({
                    className: 'route-poi-marker',
                    html: `
                        <div style="
                            background: ${markerColor};
                            width: 40px;
                            height: 40px;
                            border-radius: 50% 50% 50% 0;
                            border: 3px solid white;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 18px;
                            transform: rotate(-45deg);
                            position: relative;
                        ">
                            <span style="transform: rotate(45deg);">${categoryStyle.icon}</span>
                            <div style="
                                position: absolute;
                                top: -8px;
                                right: -8px;
                                background: white;
                                color: ${markerColor};
                                border-radius: 50%;
                                width: 20px;
                                height: 20px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 10px;
                                font-weight: bold;
                                border: 2px solid ${markerColor};
                                transform: rotate(45deg);
                            ">${poi.order_in_route || i + 1}</div>
                        </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                });
                
                // Create marker
                const marker = L.marker(coordinates, { icon: markerIcon }).addTo(map);
                
                // Create popup content
                const popupContent = `
                    <div style="min-width: 200px;">
                        <h6 style="margin: 0 0 8px 0; color: var(--primary-color);">
                            ${poi.order_in_route || i + 1}. ${poi.name}
                        </h6>
                        <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">
                            ${poi.description || poi.category}
                        </p>
                        <div style="font-size: 12px; color: #666;">
                            <div><i class="fas fa-clock"></i> ${poi.estimated_time_at_poi || 15} dakika</div>
                            <div><i class="fas fa-tag"></i> ${poi.category}</div>
                            <div>
                                <i class="fas fa-${poi.is_mandatory ? 'exclamation-circle' : 'info-circle'}"></i> 
                                ${poi.is_mandatory ? 'Zorunlu durak' : 'İsteğe bağlı durak'}
                            </div>
                        </div>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                markers.push(marker);
                markersAdded++;
                
                console.log(`✅ Added marker ${markersAdded} for POI: ${poi.name} at [${lat}, ${lon}]`);
            } catch (error) {
                console.error(`❌ Error adding marker for POI ${poi.name}:`, error);
            }
        } else {
            console.warn(`POI ${poi.name} has no coordinates: lat=${poi.lat}, lon=${poi.lon}`);
        }
    }
    
    console.log(`📍 Added ${markersAdded} markers to map out of ${pois.length} POIs`);
    
    // Draw route line if we have multiple POIs
    if (routeCoordinates.length > 1) {
        // Remove existing simple route layer if present
        if (window.simpleRouteLayer) {
            map.removeLayer(window.simpleRouteLayer);
            window.simpleRouteLayer = null;
        }

        // Create polyline for the route and store globally
        window.simpleRouteLayer = L.polyline(routeCoordinates, {
            color: '#007bff',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 5',
            className: 'simple-route-layer'
        }).addTo(map);

        markers.push(window.simpleRouteLayer);

        // If route is circular, connect last point to first
        const route = predefinedRoutes.find(r => r.pois && r.pois.length > 0);
        if (route && route.is_circular && routeCoordinates.length > 2) {
            const circularLine = L.polyline([
                routeCoordinates[routeCoordinates.length - 1],
                routeCoordinates[0]
            ], {
                color: '#28a745',
                weight: 4,
                opacity: 0.7,
                dashArray: '5, 10'
            }).addTo(map);

            markers.push(circularLine);
        }
    }
    
    console.log('✅ Route POIs displayed on map');
}

function fitMapToRoutePOIs(pois) {
    if (!map || !pois || pois.length === 0) {
        console.warn('Cannot fit map: map not initialized or no POIs');
        return;
    }
    
    const validPOIs = pois.filter(poi => {
        const lat = parseFloat(poi.lat);
        const lon = parseFloat(poi.lon);
        return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    });
    
    if (validPOIs.length === 0) {
        console.warn('No valid POIs with coordinates found');
        return;
    }
    
    try {
        if (validPOIs.length === 1) {
            // Single POI - center on it
            const poi = validPOIs[0];
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            console.log(`🎯 Centering map on single POI: ${poi.name} at [${lat}, ${lon}]`);
            map.setView([lat, lon], 15);
        } else {
            // Multiple POIs - fit bounds
            const coordinates = validPOIs.map(poi => [parseFloat(poi.lat), parseFloat(poi.lon)]);
            const bounds = L.latLngBounds(coordinates);
            console.log(`🎯 Fitting map to ${validPOIs.length} POIs`);
            map.fitBounds(bounds, { 
                padding: [20, 20],
                maxZoom: 16
            });
        }
        
        // Force map to update
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error fitting map to POIs:', error);
    }
}

async function initializeMainMap() {
    console.log('🗺️ Initializing main map...');
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
        console.error('❌ Map container not found');
        return false;
    }
    
    // Make sure map container is visible
    const routeSection = document.getElementById('routeSection');
    if (routeSection) {
        routeSection.style.display = 'block';
    }
    
    // Wait a bit for the container to be visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clear existing map
    if (map) {
        try {
            map.remove();
        } catch (e) {
            console.warn('Error removing existing map:', e);
        }
        map = null;
    }
    
    try {
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            console.error('❌ Leaflet library not loaded');
            return false;
        }
        
        // Initialize map
        map = L.map('mapContainer', {
            zoomControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            dragging: true,
            tap: true,
            tapTolerance: 15,
            worldCopyJump: false,
            maxBoundsViscosity: 0.0
        }).setView([38.632, 34.912], 13);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Clear markers array
        markers = [];
        
        // Force map to resize after initialization
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 200);
        
        console.log('✅ Main map initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing main map:', error);
        return false;
    }
}

// Backward compatibility - keep the old function name
async function initializeMapForRoute() {
    return await initializeMainMap();
}

function clearMapMarkers() {
    markers.forEach(marker => {
        if (map && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    markers = [];
}

function getDifficultyStars(level) {
    const stars = '★'.repeat(level || 1) + '☆'.repeat(5 - (level || 1));
    return stars;
}

function getRouteTypeDisplayName(type) {
    const typeNames = {
        'walking': 'Yürüyüş',
        'hiking': 'Doğa Yürüyüşü',
        'cycling': 'Bisiklet',
        'driving': 'Araç'
    };
    return typeNames[type] || type;
}

// Debug function for testing route selection
window.testRouteSelection = async function(routeId) {
    console.log('🧪 Testing route selection for route ID:', routeId);
    
    try {
        const response = await fetch(`${apiBase}/routes/${routeId}`);
        console.log('📡 API Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📊 API Response data:', data);
            
            if (data.success && data.route) {
                console.log('✅ Route found:', data.route.name);
                console.log('📍 Route POIs:', data.route.pois?.length || 0);
                console.log('📊 Route POI count field:', data.route.poi_count);
                
                // Log POI details
                if (data.route.pois && data.route.pois.length > 0) {
                    data.route.pois.forEach((poi, index) => {
                        console.log(`  POI ${index + 1}: ${poi.name} at [${poi.lat}, ${poi.lon}]`);
                    });
                }
                
                // Test the selection function
                await selectPredefinedRoute(data.route);
            } else {
                console.error('❌ Route not found or API error');
            }
        } else {
            console.error('❌ API request failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Error testing route selection:', error);
    }
};

// Debug function for testing route list
window.testRouteList = async function() {
    console.log('🧪 Testing route list loading...');
    
    try {
        const response = await fetch(`${apiBase}/routes`);
        console.log('📡 Routes API Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📊 Routes API Response data:', data);
            
            if (data.success && data.routes) {
                console.log('✅ Routes found:', data.routes.length);
                
                data.routes.forEach((route, index) => {
                    console.log(`  Route ${index + 1}: ${route.name} - POI count: ${route.poi_count}`);
                });
            } else {
                console.error('❌ Routes not found or API error');
            }
        } else {
            console.error('❌ Routes API request failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Error testing route list:', error);
    }
};

// Debug function for testing map initialization
window.testMapInit = async function() {
    console.log('🧪 Testing map initialization...');
    
    const success = await initializeMainMap();
    if (success) {
        console.log('✅ Map initialization successful');
        
        // Test adding a sample marker
        if (map) {
            const testMarker = L.marker([38.632, 34.912]).addTo(map);
            testMarker.bindPopup('Test marker').openPopup();
            console.log('✅ Test marker added');
        }
    } else {
        console.error('❌ Map initialization failed');
    }
};

// Route preview map functionality
let previewMaps = new Map(); // Store multiple preview maps

async function initializeRoutePreviewMap(mapId, pois) {
    console.log('🗺️ Initializing route preview map:', mapId, 'with', pois.length, 'POIs');
    
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) {
        console.error('❌ Preview map container not found:', mapId);
        return;
    }
    
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet library not loaded');
        return;
    }
    
    try {
        // Clean up existing map if any
        if (previewMaps.has(mapId)) {
            previewMaps.get(mapId).remove();
            previewMaps.delete(mapId);
        }
        
        // Initialize preview map
        const previewMap = L.map(mapId, {
            zoomControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            dragging: false,
            tap: false,
            boxZoom: false,
            keyboard: false,
            attributionControl: false
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ''
        }).addTo(previewMap);
        
        // Store the map
        previewMaps.set(mapId, previewMap);
        
        // Add POI markers
        const validPOIs = pois.filter(poi => {
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
        });
        
        if (validPOIs.length === 0) {
            console.warn('No valid POIs for preview map');
            return;
        }
        
        const routeCoordinates = [];
        
        validPOIs.forEach((poi, index) => {
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            const coordinates = [lat, lon];
            routeCoordinates.push(coordinates);
            
            // Create small marker for preview
            const markerIcon = L.divIcon({
                className: 'route-preview-marker',
                html: `
                    <div style="
                        background: ${poi.is_mandatory ? '#dc3545' : '#28a745'};
                        color: white;
                        border-radius: 50%;
                        width: 16px;
                        height: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 10px;
                        border: 2px solid white;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                    ">
                        ${poi.order_in_route || index + 1}
                    </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            
            L.marker(coordinates, { icon: markerIcon }).addTo(previewMap);
        });
        
        // Draw route line
        if (routeCoordinates.length > 1) {
            L.polyline(routeCoordinates, {
                color: '#007bff',
                weight: 2,
                opacity: 0.8
            }).addTo(previewMap);
        }
        
        // Fit map to show all POIs
        if (validPOIs.length === 1) {
            const poi = validPOIs[0];
            previewMap.setView([parseFloat(poi.lat), parseFloat(poi.lon)], 14);
        } else {
            const bounds = L.latLngBounds(routeCoordinates);
            previewMap.fitBounds(bounds, { padding: [10, 10] });
        }
        
        // Force map to resize
        setTimeout(() => {
            previewMap.invalidateSize();
            
            // Clear loading state
            const loadingElement = mapContainer.querySelector('.route-preview-loading');
            if (loadingElement) {
                loadingElement.remove();
            }
        }, 100);
        
        console.log('✅ Route preview map initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing route preview map:', error);
    }
}

// Clean up preview maps when modal is closed
function cleanupPreviewMaps() {
    previewMaps.forEach((map, mapId) => {
        try {
            map.remove();
        } catch (e) {
            console.warn('Error removing preview map:', mapId, e);
        }
    });
    previewMaps.clear();
}

// Load and display saved route geometry
async function loadAndDisplayRouteGeometry(routeId) {
    try {
        console.log('🗺️ Loading saved route geometry for route:', routeId);
        
        const response = await fetch(`${apiBase}/routes/${routeId}/geometry`);
        
        if (response.ok) {
            const geometryData = await response.json();
            console.log('✅ Route geometry loaded:', geometryData);
            
            if (geometryData.success && geometryData.geometry) {
                displaySavedRouteGeometry(geometryData.geometry);
                return true;
            }
        } else {
            console.log('ℹ️ No saved geometry found for route:', routeId);
        }
    } catch (error) {
        console.error('❌ Error loading route geometry:', error);
    }
    
    return false;
}

// Display saved route geometry on map
function displaySavedRouteGeometry(geometryData) {
    if (!map || !geometryData.geometry) return;
    
    console.log('🎨 Displaying saved route geometry');
    
    // Remove existing route layers
    map.eachLayer(function(layer) {
        if (layer.options && (layer.options.className === 'saved-route' || layer.options.className === 'walking-route')) {
            map.removeLayer(layer);
        }
    });
    
    // Remove simple route layer if it exists to avoid overlap
    if (window.simpleRouteLayer) {
        map.removeLayer(window.simpleRouteLayer);
        window.simpleRouteLayer = null;
    }
    
    try {
        const geometry = geometryData.geometry;
        
        if (geometry.type === 'LineString' && geometry.coordinates) {
            // Convert GeoJSON coordinates to Leaflet format
            const latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lng, lat] to [lat, lng]
            
            // Create route line
            const routeLine = L.polyline(latlngs, {
                color: '#4ecdc4',
                weight: 4,
                opacity: 0.8,
                className: 'saved-route'
            }).addTo(map);
            
            // Add popup with route info
            const distance = geometryData.total_distance ? `${geometryData.total_distance.toFixed(1)} km` : 'Bilinmiyor';
            const duration = geometryData.estimated_duration ? `${geometryData.estimated_duration} dk` : 'Bilinmiyor';
            
            routeLine.bindPopup(`
                <div style="text-align: center;">
                    <strong>📍 Kaydedilmiş Rota</strong><br>
                    <small>Mesafe: ${distance}</small><br>
                    <small>Süre: ${duration}</small><br>
                    <small style="color: #4ecdc4;">✅ Gerçek yol ağı</small>
                </div>
            `);
            
            console.log('✅ Saved route geometry displayed successfully');
            
            // Show success notification
            showNotification('✅ Kaydedilmiş rota yolu gösteriliyor', 'success');
            
        } else {
            console.warn('⚠️ Invalid geometry format:', geometry);
        }
        
    } catch (error) {
        console.error('❌ Error displaying saved route geometry:', error);
    }
}

// Expand route preview to full screen
async function expandRoutePreview(routeId, routeName) {
    console.log('🔍 Expanding route preview for:', routeName);
    
    try {
        // Fetch route details
        const response = await fetch(`${apiBase}/routes/${routeId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const route = data.success ? data.route : data;
        const pois = route.pois || [];
        
        if (pois.length === 0) {
            showNotification('Bu rotada görüntülenecek POI bulunmuyor', 'warning');
            return;
        }
        
        // Close current modal
        closeRouteDetailModal();
        
        // Switch to dynamic routes tab
        switchTab('dynamic-routes');
        
        // Ensure main map is initialized before showing route
        if (!map) {
            console.log('🗺️ Main map not initialized, initializing for route preview...');
            const mapInitialized = await initializeMainMap();
            if (!mapInitialized) {
                showNotification('Harita başlatılamadı', 'error');
                return;
            }
        }
        
        // Show route on main map
        await selectPredefinedRoute(route);
        
        // Show notification
        showNotification(`📍 "${routeName}" rotası haritada gösteriliyor`, 'success');
        
    } catch (error) {
        console.error('❌ Error expanding route preview:', error);
        showNotification('Rota haritada gösterilirken hata oluştu', 'error');
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 DOM loaded, initializing...');

    // Load categories first
    await loadCategories();

    // Initialize route tabs
    initializeRouteTabs();
    
    // Initialize main map early so it's ready for route selection
    setTimeout(async () => {
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            console.log('🗺️ Pre-initializing main map for better UX...');
            await initializeMainMap();
        }
    }, 1000); // Wait 1 second after page load

    // Feature detection for touch support
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (supportsTouch) {
        document.body.classList.add('touch-device');
    }

    // Initialize all components
    try {
        initializeTouchSupport();
        checkSecurityContext();

        // Wait for loading manager to be available
        const initializeLoadingManager = () => {
            if (window.loadingManager) {
                console.log('✅ Loading manager initialized');
                // Setup lazy loading for any existing images
                if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
                    try {
                        window.lazyLoader.setupImageLazyLoading();
                    } catch (error) {
                        console.warn('Lazy loading setup error:', error);
                    }
                }
            } else {
                console.log('⏳ Loading manager not yet available, will use fallbacks');
            }
        };

        // Listen for loading manager ready event
        window.addEventListener('loadingManagerReady', initializeLoadingManager);

        // Also try immediately in case it's already loaded
        setTimeout(initializeLoadingManager, 100);

        // Location dialog click outside to close
        const locationOverlay = document.getElementById('locationPermissionOverlay');
        if (locationOverlay) {
            locationOverlay.addEventListener('click', function (e) {
                if (e.target === locationOverlay) {
                    closeLocationDialog();
                }
            });
        }
        initializeSliders();
        setupEventListeners();
        console.log('✅ All components initialized');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }

    //             // Debug function - remove after fixing
    //             setTimeout(function () {
    //                 try {
    //                     debugElements();
    //                 } catch (error) {
    //                     console.error('❌ Debug error:', error);
    //                 }
    //             }, 1000);
});

//         // Debug function to check elements
//         function debugElements() {
//             // Check loading manager availability
//             console.log('Loading Manager Status:', {
//                 available: !!window.loadingManager,
//                 showPOISkeletons: !!(window.loadingManager && window.loadingManager.showPOISkeletons),
//                 lazyLoader: !!window.lazyLoader
//             });
//             console.log('� DEBUGE: Checking elements...');
// 
//             // Check sliders
//             Object.keys(ratingCategories).forEach(category => {
//                 const slider = document.getElementById(category);
//                 const valueDisplay = document.getElementById(category + '-value');
//                 console.log(`Slider ${category}:`, {
//                     slider: !!slider,
//                     valueDisplay: !!valueDisplay,
//                     sliderValue: slider ? slider.value : 'N/A',
//                     displayValue: valueDisplay ? valueDisplay.textContent : 'N/A'
//                 });
//             });
// 
//             // Check recommend button
//             const recommendBtn = document.getElementById('recommendBtn');
//             console.log('Recommend button:', {
//                 found: !!recommendBtn,
//                 hasEventListener: recommendBtn ? recommendBtn.onclick !== null : false,
//                 text: recommendBtn ? recommendBtn.textContent : 'N/A'
//             });
//         }

function initializeSliders() {
    console.log('🎚️ Initializing sliders...');

    Object.keys(ratingCategories).forEach(category => {
        const slider = document.getElementById(category);
        const valueDisplay = document.getElementById(category + '-value');

        if (!slider) {
            console.error(`❌ Slider not found: ${category}`);
            return;
        }

        if (!valueDisplay) {
            console.error(`❌ Value display not found: ${category}-value`);
            return;
        }

        const sliderItem = slider.closest('.slider-item');
        if (!sliderItem) {
            console.error(`❌ Slider item not found for: ${category}`);
            return;
        }

        console.log(`✅ Setting up slider: ${category}`);

        // Add both input and change events for better compatibility
        const handleSliderChange = function () {
            const value = parseInt(this.value);
            console.log(`🎚️ Slider ${category} changed to: ${value}`);
            valueDisplay.textContent = value;
            updateSliderBackground(this);
            updateSliderItemState(sliderItem, valueDisplay, value);
        };

        slider.addEventListener('input', handleSliderChange);
        slider.addEventListener('change', handleSliderChange);

        // Initialize background and state
        const initialValue = parseInt(slider.value);
        console.log(`ℹ️ Initial value for ${category}: ${initialValue}`);
        valueDisplay.textContent = initialValue;
        updateSliderBackground(slider);
        updateSliderItemState(sliderItem, valueDisplay, initialValue);
    });

    console.log('✅ All sliders initialized');
}

function updateSliderBackground(slider) {
    const sliderItem = slider.closest('.slider-item');
    const category = sliderItem ? sliderItem.getAttribute('data-category') : null;

    // Get category-specific color
    let categoryColor = 'var(--primary-color)';
    if (category) {
        categoryColor = `var(--${category.replace('_', '-')}-color)`;
    }

    if (slider.classList.contains('discrete-slider')) {
        // For discrete sliders, create step-based background
        const value = parseInt(slider.value);
        const percentage = (value / 4) * 100;

        const gradient = `linear-gradient(to right,
                    ${categoryColor} 0%,
                    ${categoryColor} ${percentage}%,
                    rgba(255, 255, 255, 0.9) ${percentage}%,
                    rgba(255, 255, 255, 0.9) 100%)`;
        slider.style.background = gradient;
    } else {
        // Original logic for continuous sliders
        const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        const gradient = `linear-gradient(to right,
                    ${categoryColor} 0%,
                    ${categoryColor} ${value}%,
                    rgba(255, 255, 255, 0.9) ${value}%,
                    rgba(255, 255, 255, 0.9) 100%)`;
        slider.style.background = gradient;
    }
}

// Discrete slider value mapping
const discreteValues = {
    0: { text: 'İlgilenmiyorum', value: 0 },
    1: { text: 'Az Meraklıyım', value: 25 },
    2: { text: 'Nötrüm', value: 50 },
    3: { text: 'İlgileniyorum', value: 75 },
    4: { text: 'Kesinlikle İhtiyacım Var', value: 100 }
};

function updateSliderItemState(sliderItem, valueDisplay, value) {
    // Remove existing classes
    sliderItem.classList.remove('active');
    valueDisplay.classList.remove('zero', 'high');

    // For discrete sliders, use the mapping
    if (sliderItem.querySelector('.discrete-slider')) {
        const discreteValue = discreteValues[value];
        if (discreteValue) {
            valueDisplay.textContent = discreteValue.text;

            if (value === 0) {
                valueDisplay.classList.add('zero');
            } else if (value >= 3) {
                sliderItem.classList.add('active');
                valueDisplay.classList.add('high');
            } else if (value > 0) {
                sliderItem.classList.add('active');
            }
        }
    } else {
        // Original logic for non-discrete sliders
        if (value === 0) {
            valueDisplay.classList.add('zero');
        } else if (value >= 70) {
            sliderItem.classList.add('active');
            valueDisplay.classList.add('high');
        } else if (value > 0) {
            sliderItem.classList.add('active');
        }
    }
}

function setupEventListeners() {
    console.log('🔗 Setting up event listeners...');

    const recommendBtn = document.getElementById('recommendBtn');
    if (recommendBtn) {
        console.log('✅ Recommend button found, adding event listener');
        recommendBtn.addEventListener('click', function (e) {
            console.log('🔥 Recommend button clicked!');
            e.preventDefault();
            getRecommendations();
        });
    } else {
        console.error('❌ Recommend button not found!');
        // Try to find it with a different approach
        const allButtons = document.querySelectorAll('button');
        console.log('🔍 All buttons found:', allButtons.length);
        allButtons.forEach((btn, index) => {
            console.log(`Button ${index}:`, btn.id, btn.className, btn.textContent.substring(0, 20));
        });
    }

    console.log('✅ Event listeners setup complete');
}

async function getRecommendations() {
    console.log('🚀 getRecommendations function called');

    const button = document.getElementById('recommendBtn');
    const resultsSection = document.getElementById('resultsSection');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('recommendationResults');

    console.log('Elements found:', {
        button: !!button,
        resultsSection: !!resultsSection,
        loadingIndicator: !!loadingIndicator,
        resultsContainer: !!resultsContainer
    });

    // Show enhanced loading state
    button.disabled = true;
    button.classList.add('btn--loading');
    button.innerHTML = 'Öneriler Hazırlanıyor...';
    resultsSection.style.display = 'block';

    // Show skeleton loading for POI cards (with fallback)
    if (window.loadingManager && typeof window.loadingManager.showPOISkeletons === 'function') {
        try {
            window.loadingManager.showPOISkeletons('recommendationResults', 6);
        } catch (error) {
            console.warn('Loading manager error, using fallback:', error);
            showFallbackLoading();
        }
    } else {
        showFallbackLoading();
    }

    function showFallbackLoading() {
        // Create skeleton loading manually
        const skeletonHTML = Array(3).fill(0).map(() => `
                    <div class="poi-card-skeleton">
                        <div class="poi-card-skeleton__image loading__skeleton"></div>
                        <div class="poi-card-skeleton__content">
                            <div class="poi-card-skeleton__header">
                                <div class="poi-card-skeleton__title loading__skeleton"></div>
                                <div class="poi-card-skeleton__score loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__description">
                                <div class="skeleton-card__text loading__skeleton"></div>
                                <div class="skeleton-card__text loading__skeleton"></div>
                                <div class="skeleton-card__text loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__meta">
                                <div class="poi-card-skeleton__category loading__skeleton"></div>
                            </div>
                            <div class="poi-card-skeleton__actions">
                                <div class="poi-card-skeleton__action loading__skeleton"></div>
                                <div class="poi-card-skeleton__action loading__skeleton"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
        resultsContainer.innerHTML = skeletonHTML;
    }

    // Show progress loading (with fallback)
    if (window.loadingManager && typeof window.loadingManager.showLoading === 'function') {
        try {
            window.loadingManager.showLoading('loadingIndicator', {
                type: 'progress',
                text: 'Tercihleriniz analiz ediliyor...',
                progress: 0
            });
        } catch (error) {
            console.warn('Loading manager error, using fallback:', error);
            loadingIndicator.style.display = 'block';
        }
    } else {
        // Fallback - show basic loading
        loadingIndicator.style.display = 'block';
    }

    try {
        // Get user preferences with progress update
        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 20);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        const preferences = {};
        Object.keys(ratingCategories).forEach(category => {
            const sliderValue = parseInt(document.getElementById(category).value);
            const slider = document.getElementById(category);

            if (slider.classList.contains('discrete-slider')) {
                // Convert discrete slider value to actual preference value
                preferences[category] = discreteValues[sliderValue].value;
            } else {
                preferences[category] = sliderValue;
            }
        });

        console.log('User preferences:', preferences);

        // Update progress
        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 40);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Use lazy loader for POI data or fallback to regular fetch
        let poisData;
        if (window.lazyLoader && typeof window.lazyLoader.loadPOIData === 'function') {
            try {
                poisData = await window.lazyLoader.loadPOIData(preferences, {
                    showProgress: false // We're handling progress manually
                });
            } catch (error) {
                console.warn('Lazy loader error, using fallback fetch:', error);
                // Fallback to regular fetch
                const response = await fetch(`${apiBase}/pois`);
                if (!response.ok) {
                    throw new Error('POI verisi alınamadı');
                }
                poisData = await response.json();
            }
        } else {
            // Fallback to regular fetch
            const response = await fetch(`${apiBase}/pois`);
            if (!response.ok) {
                throw new Error('POI verisi alınamadı');
            }
            poisData = await response.json();
        }

        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 70);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Calculate recommendations with performance monitoring
        let recommendationData;
        if (window.loadingManager && window.loadingManager.performanceMonitor && typeof window.loadingManager.performanceMonitor.measureRender === 'function') {
            try {
                recommendationData = window.loadingManager.performanceMonitor.measureRender(
                    'calculateRecommendations',
                    () => calculateRecommendations(poisData, preferences)
                );
            } catch (error) {
                console.warn('Performance monitoring error:', error);
                recommendationData = calculateRecommendations(poisData, preferences);
            }
        } else {
            // Fallback without performance monitoring
            recommendationData = calculateRecommendations(poisData, preferences);
        }

        console.log('Calculated recommendation data:', recommendationData);
        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 90);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        if (recommendationData.highScore.length === 0 && recommendationData.lowScore.length === 0) {
            console.warn('No recommendations found');
        }

        // Display results with animation - start with high score POIs
        await displayRecommendations(recommendationData);

        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 100);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Initialize map with all recommendations (high and low score)
        if (recommendationData.highScore.length > 0 || recommendationData.lowScore.length > 0) {
            console.log('Initializing map with all recommendations...');
            await initializeMap(recommendationData);
        } else {
            console.log('Skipping map initialization - no recommendations');
        }

    } catch (error) {
        console.error('Recommendation error:', error);
        resultsContainer.innerHTML = `
                    <div class="no-results animate-fade-in">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Bir hata oluştu</h3>
                        <p>Öneriler alınırken bir sorun yaşandı. Lütfen tekrar deneyin.</p>
                        <button class="btn btn--primary" onclick="getRecommendations()">
                            <i class="fas fa-redo"></i> Tekrar Dene
                        </button>
                    </div>
                `;
    } finally {
        // Reset button state immediately
        button.disabled = false;
        button.classList.remove('btn--loading');
        button.innerHTML = '<i class="fas fa-magic"></i> Önerilerimi Getir';

        // Reset button state only - loading indicator will be handled by displayRecommendations
        console.log('✅ Finally block executed - button reset');
    }
}

function calculateRecommendations(poisData, preferences) {
    const allPois = [];

    // Flatten POI data
    Object.keys(poisData).forEach(category => {
        if (Array.isArray(poisData[category])) {
            poisData[category].forEach(poi => {
                allPois.push({
                    ...poi,
                    category: category
                });
            });
        }
    });

    console.log('All POIs:', allPois.length);

    // Calculate scores for each POI
    const scoredPois = allPois.map(poi => {
        let totalScore = 0;
        let matchingCategories = 0;
        let baseScore = 30; // Base score for all POIs

        // Calculate weighted score based on user preferences
        Object.keys(preferences).forEach(category => {
            const userWeight = preferences[category] / 100; // Convert to 0-1 scale
            const poiRating = poi.ratings[category] || 0;

            if (userWeight > 0) {
                if (poiRating > 0) {
                    // Use actual rating if available
                    totalScore += (poiRating / 100) * userWeight;
                } else {
                    // Use base score if no rating available
                    totalScore += (baseScore / 100) * userWeight;
                }
                matchingCategories++;
            }
        });

        // Normalize score (0-100 scale)
        let finalScore = matchingCategories > 0 ? (totalScore / matchingCategories) * 100 : baseScore;

        // Add category bonus if POI matches user's preferred categories
        const categoryBonus = getCategoryBonus(poi.category, preferences);
        finalScore += categoryBonus;

        // Ensure score is within bounds
        finalScore = Math.min(100, Math.max(0, finalScore));

        return {
            ...poi,
            recommendationScore: Math.round(finalScore),
            matchingCategories: matchingCategories
        };
    });

    // Sort all POIs by score
    const allSortedPois = scoredPois
        .filter(poi => poi.recommendationScore > 0)
        .sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Separate high and low scoring POIs
    const highScorePois = allSortedPois.filter(poi => poi.recommendationScore >= 45);
    const lowScorePois = allSortedPois.filter(poi => poi.recommendationScore < 45);

    console.log('High score POIs (≥45):', highScorePois.length);
    console.log('Low score POIs (<45):', lowScorePois.length);

    return {
        highScore: highScorePois.slice(0, 15), // Top 15 high-scoring
        lowScore: lowScorePois.slice(0, 20),   // Top 20 low-scoring
        all: allSortedPois.slice(0, 35)        // All POIs for fallback
    };
}

// Get category bonus based on POI category and user preferences
function getCategoryBonus(poiCategory, preferences) {
    const categoryMapping = {
        'doga_macera': ['doga', 'macera', 'spor'],
        'gastronomik': ['yemek'],
        'kulturel': ['tarihi', 'sanat_kultur'],
        'sanatsal': ['sanat_kultur'],
        'konaklama': ['rahatlatici']
    };

    const relatedCategories = categoryMapping[poiCategory] || [];
    let bonus = 0;

    relatedCategories.forEach(category => {
        if (preferences[category] && preferences[category] > 50) {
            bonus += (preferences[category] - 50) * 0.2; // Max 10 point bonus
        }
    });

    return Math.min(15, bonus); // Max 15 point category bonus
}

async function displayRecommendations(recommendationData) {
    const container = document.getElementById('recommendationResults');
    const routeSection = document.getElementById('routeSection');

    // Check if we have any recommendations
    if (recommendationData.highScore.length === 0 && recommendationData.lowScore.length === 0) {
        container.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <h3>Öneri bulunamadı</h3>
                        <p>Tercihlerinize uygun POI bulunamadı. Slider değerlerini değiştirerek tekrar deneyin.</p>
                    </div>
                `;
        routeSection.style.display = 'none';
        return;
    }

    // Show route section
    routeSection.style.display = 'block';

    // Create HTML for high score POIs
    let html = '';

    if (recommendationData.highScore.length > 0) {
        html += `
            <div class="recommendation-section">
                <h4 style="color: #28a745; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-star"></i>
                    En Uygun Öneriler (${recommendationData.highScore.length} adet)
                </h4>
                <div class="high-score-pois">
                    ${createPOICards(recommendationData.highScore)}
                </div>
            </div>
        `;
    }

    // Add low score POIs section if available
    if (recommendationData.lowScore.length > 0) {
        html += `
            <div class="recommendation-section" style="margin-top: 30px;">
                <div class="low-score-header" style="text-align: center; margin-bottom: 20px;">
                    <h4 style="color: #6c757d; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-eye-slash"></i>
                        Diğer Seçenekler (${recommendationData.lowScore.length} adet)
                    </h4>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">
                        Tercihlerinize daha az uygun olan ancak keşfetmek isteyebileceğiniz yerler
                    </p>
                    <button id="showLowScoreBtn" class="btn btn--secondary btn--sm" onclick="toggleLowScorePOIs()">
                        <i class="fas fa-eye"></i> Diğer Seçenekleri Göster
                    </button>
                </div>
                <div id="lowScorePOIs" style="display: none;">
                    ${createPOICards(recommendationData.lowScore)}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    container.style.opacity = '0';
    setTimeout(() => {
        container.style.transition = 'opacity 0.3s ease';
        container.style.opacity = '1';
    }, 100);

    if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
        try {
            window.lazyLoader.setupImageLazyLoading();
        } catch (error) {
            console.warn('Lazy loading setup error:', error);
        }
    }

    const newCards = container.querySelectorAll('.poi-card');
    newCards.forEach(card => {
        card.classList.add('gpu-accelerated');
    });

    // Hide loading indicator after a reasonable delay for better UX
    const loadingIndicator = document.getElementById('loadingIndicator');
    setTimeout(() => {
        if (loadingIndicator) {
            // Smooth fade out transition
            loadingIndicator.style.transition = 'opacity 0.5s ease-out';
            loadingIndicator.style.opacity = '0';

            // Hide completely after fade out
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
                loadingIndicator.style.visibility = 'hidden';
                loadingIndicator.classList.add('d-none');
                loadingIndicator.setAttribute('hidden', 'true');

                if (window.loadingManager && typeof window.loadingManager.hideLoading === 'function') {
                    try {
                        window.loadingManager.hideLoading('loadingIndicator');
                    } catch (error) {
                        console.warn('Hide loading error:', error);
                    }
                }

                console.log('✅ Loading indicator hidden with smooth transition');
            }, 500); // Wait for fade out to complete
        }
    }, 2000); // Show loading for at least 2 seconds

    // Asynchronously load media for each card in background (don't block UI)
    const allPOIs = [...recommendationData.highScore, ...recommendationData.lowScore];
    allPOIs.forEach(poi => {
        // Use setTimeout to make this truly non-blocking
        setTimeout(async () => {
            try {
                const media = await loadPOIMedia(poi.id || poi._id);
                const card = container.querySelector(`.poi-card[data-poi-id='${poi.id || poi._id}']`);
                if (!card) return;

                const imageContainer = card.querySelector('.poi-card__image-container');
                const placeholder = imageContainer.querySelector('.poi-card__image-placeholder');

                if (media.images && media.images.length > 0) {
                    const mainImage = media.images[0];
                    const img = document.createElement('img');
                    img.dataset.src = `/${mainImage.preview_path || mainImage.path || `poi_media/${mainImage.filename}`}`;
                    img.className = 'poi-card__image lazy-image';
                    img.alt = poi.name;
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
                    imageContainer.insertBefore(img, placeholder);
                    placeholder.style.display = 'none';
                    if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
                        window.lazyLoader.setupImageLazyLoading();
                    }
                }

                const previewContainer = card.querySelector('.poi-media-preview');
                const cacheKey = `poi_card_${poi.id || poi._id}`;
                const allMediaItems = [];

                if (media.images) {
                    media.images.forEach((image, idx) => {
                        allMediaItems.push({
                            type: 'image',
                            path: image.preview_path || image.path || `poi_media/${image.filename}`,
                            title: image.description || `Görsel ${idx + 1}`,
                            originalIndex: idx
                        });
                    });
                }

                if (media.videos) {
                    media.videos.forEach((video, idx) => {
                        allMediaItems.push({
                            type: 'video',
                            path: video.path || `poi_media/${video.filename}`,
                            title: video.description || `Video ${idx + 1}`,
                            originalIndex: idx
                        });
                    });
                }

                if (media.audio) {
                    media.audio.forEach((audio, idx) => {
                        allMediaItems.push({
                            type: 'audio',
                            path: audio.path || `poi_media/${audio.filename}`,
                            title: audio.description || `Ses ${idx + 1}`,
                            originalIndex: idx
                        });
                    });
                }

                poiMediaCache[cacheKey] = { items: allMediaItems, poiName: poi.name };

                if (allMediaItems.length > 0) {
                    const previewItems = allMediaItems.slice(0, 3);
                    let mediaPreviewHTML = '';

                    previewItems.forEach((item, idx) => {
                        if (item.type === 'image') {
                            const imagePath = item.path.startsWith('/') ? item.path : `/${item.path}`;
                            mediaPreviewHTML += `<img data-src="${imagePath}" class="poi-media-thumb lazy-image" onclick="showPOIMediaFromCache('${cacheKey}', ${idx})" title="${item.title}" alt="${item.title}" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4uLi48L3RleHQ+PC9zdmc+" />`;
                        } else {
                            const icon = item.type === 'video' ? '🎥' : '🎵';
                            mediaPreviewHTML += `<div class="poi-media-count" onclick="showPOIMediaFromCache('${cacheKey}', ${idx})" title="${item.title}">${icon}</div>`;
                        }
                    });

                    if (allMediaItems.length > 3) {
                        mediaPreviewHTML += `<div class="poi-media-count" onclick="showPOIMediaFromCache('${cacheKey}', 0)">+${allMediaItems.length - 3}</div>`;
                    }

                    previewContainer.innerHTML = mediaPreviewHTML;
                    if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
                        window.lazyLoader.setupImageLazyLoading();
                    }
                }
            } catch (err) {
                console.warn('Could not load media for POI:', poi.name, err);
            }
        }, 0); // Execute immediately but asynchronously
    });
}

// Initialize empty map for predefined routes
async function initializeEmptyMap() {
    const mapContainer = document.getElementById('mapContainer');
    const mapSection = document.getElementById('mapSection');

    console.log('🗺️ Initializing empty map...');

    // Show map section with animation
    if (mapSection) {
        mapSection.style.display = 'block';
        mapSection.style.opacity = '0';
        mapSection.style.transform = 'translateY(20px)';

        setTimeout(() => {
            mapSection.style.transition = 'all 0.6s ease-out';
            mapSection.style.opacity = '1';
            mapSection.style.transform = 'translateY(0)';
        }, 100);
    }

    // Add loading state to map container
    mapContainer.classList.add('loading');

    // Clear existing map
    if (map) {
        map.remove();
    }

    // Initialize map with better options
    map = L.map('mapContainer', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true,
        tap: true,
        tapTolerance: 15,
        worldCopyJump: false,
        maxBoundsViscosity: 0.0
    }).setView([38.632, 34.912], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add map controls
    if (L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
    }

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    // Remove loading state after map is fully loaded
    setTimeout(() => {
        mapContainer.classList.remove('loading');
        // Fix map size issues
        if (map) {
            map.invalidateSize();
        }
        console.log('🗺️ Empty map initialized and ready');
    }, 1000);
}

async function initializeMap(recommendationData) {
    const mapContainer = document.getElementById('mapContainer');
    const mapSection = document.getElementById('mapSection');

    // Check if we have any recommendations
    if (recommendationData.highScore.length === 0 && recommendationData.lowScore.length === 0) {
        if (mapSection) mapSection.style.display = 'none';
        return;
    }

    // Show map section with animation
    if (mapSection) {
        mapSection.style.display = 'block';
        mapSection.style.opacity = '0';
        mapSection.style.transform = 'translateY(20px)';

        setTimeout(() => {
            mapSection.style.transition = 'all 0.6s ease-out';
            mapSection.style.opacity = '1';
            mapSection.style.transform = 'translateY(0)';
        }, 100);
    }

    // Add loading state to map container
    mapContainer.classList.add('loading');

    // Clear existing map
    if (map) {
        map.remove();
    }

    // Initialize map with better options
    map = L.map('mapContainer', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true,
        tap: true,
        tapTolerance: 15,
        worldCopyJump: false,
        maxBoundsViscosity: 0.0
    }).setView([38.632, 34.912], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add map controls
    if (L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
    }

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    // Add markers for all recommendations (high and low score)
    const allPOIs = [...recommendationData.highScore, ...recommendationData.lowScore];

    for (const [index, poi] of allPOIs.entries()) {
        const isLowScore = poi.recommendationScore < 45;
        const customIcon = createCustomIcon(poi.category, poi.recommendationScore, isLowScore);
        const categoryStyle = getCategoryStyle(poi.category);

        // Load media and elevation data (with error handling)
        let media = { images: [], videos: [], audio: [], models: [] };
        let elevation = 0;

        try {
            media = await loadPOIMedia(poi.id || poi._id);
        } catch (error) {
            console.warn('Could not load media for POI:', poi.name, error);
        }

        try {
            elevation = await getElevation(poi.latitude, poi.longitude);
        } catch (error) {
            console.warn('Could not get elevation for POI:', poi.name, error);
        }

        // Düşük puanlı POI'ler için farklı popup renkleri
        const popupHeaderColor = isLowScore ? '#9ca3af' : categoryStyle.color;
        const popupScoreBackground = isLowScore ?
            'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' :
            'linear-gradient(135deg, var(--accent-color) 0%, #20c997 100%)';
        const popupOpacity = isLowScore ? '0.8' : '1';

        const marker = L.marker([poi.latitude, poi.longitude], {
            icon: customIcon,
            interactive: true,
            bubblingMouseEvents: true
        })
            .addTo(map)
            .bindPopup(
                `
                        <div style="min-width: 280px; max-width: 350px; font-family: 'Segoe UI', sans-serif; opacity: ${popupOpacity};">
                            <div style="
                                background: linear-gradient(135deg, ${popupHeaderColor} 0%, ${popupHeaderColor}dd 100%);
                                color: white;
                                padding: 12px;
                                margin: -10px -10px 10px -10px;
                                border-radius: 8px 8px 0 0;
                                ${isLowScore ? 'opacity: 0.9;' : ''}
                            ">
                                <h6 style="margin: 0; font-size: 16px; font-weight: 600;">
                                    ${categoryStyle.icon} ${poi.name}
                                    ${isLowScore ? ' <small style="opacity: 0.7;">(Düşük Uygunluk)</small>' : ''}
                                </h6>
                                <small style="opacity: 0.9; font-size: 12px;">
                                    ${getCategoryDisplayName(poi.category)}
                                </small>
                            </div>
                            
                            <div style="padding: 0 5px;">
                                <div style="margin-bottom: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
                                    <span style="
                                        background: ${popupScoreBackground};
                                        color: white;
                                        padding: 4px 10px;
                                        border-radius: 15px;
                                        font-size: 12px;
                                        font-weight: 600;
                                        box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
                                        ${isLowScore ? 'opacity: 0.8;' : ''}
                                    ">
                                        ${isLowScore ? '⚪' : '⭐'} ${poi.recommendationScore}% Uygun
                                    </span>
                                    ${elevation > 0 ? `
                                        <span style="
                                            background: #3498db;
                                            color: white;
                                            padding: 4px 8px;
                                            border-radius: 12px;
                                            font-size: 11px;
                                            font-weight: 600;
                                        ">
                                            🏔️ ${elevation}m
                                        </span>
                                    ` : ''}
                                </div>
                                
                                ${poi.description ? `
                                    <p style="
                                        margin: 8px 0 10px 0;
                                        font-size: 13px;
                                        line-height: 1.4;
                                        color: #555;
                                    ">${poi.description}</p>
                                ` : ''}

                                ${createMediaGallery(media, poi)}
                                
                                <div style="
                                    margin-top: 12px;
                                    padding-top: 10px;
                                    border-top: 1px solid #eee;
                                    display: flex;
                                    gap: 6px;
                                    flex-wrap: wrap;
                                ">
                                    <button onclick="openInGoogleMaps(${poi.latitude}, ${poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')" 
                                            style="background: #4285f4; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        🗺️ Google Maps
                                    </button>
                                    <button onclick="addToRoute({id: '${poi.id || poi._id}', name: '${poi.name.replace(/'/g, "\\'")}', latitude: ${poi.latitude}, longitude: ${poi.longitude}, category: '${poi.category}'})" 
                                            style="background: var(--primary-color); color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        ➕ Rotaya Ekle
                                    </button>
                                </div>
                                
                                <div style="
                                    margin-top: 8px;
                                    font-size: 10px;
                                    color: #888;
                                    text-align: center;
                                ">
                                    📍 ${poi.latitude.toFixed(4)}, ${poi.longitude.toFixed(4)}
                                </div>
                                </div>
                            </div>
                        `, {
                maxWidth: 400,
                className: 'custom-popup',
                autoPan: false
            });

        // Marker'ı listeye ekle ve düşük puanlı ise başlangıçta gizle
        marker.isLowScore = isLowScore;
        marker.poiData = poi;

        if (isLowScore) {
            marker.setOpacity(0); // Başlangıçta gizli
            marker._icon.style.display = 'none';
        }

        markers.push(marker);
    }

    // Fit map to show all markers
    const totalPOIs = recommendationData.highScore.length + recommendationData.lowScore.length;
    if (totalPOIs > 1) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    // Remove loading state after map is fully loaded
    setTimeout(() => {
        mapContainer.classList.remove('loading');
        // Fix map size issues
        if (map) {
            map.invalidateSize();
        }
        console.log('🗺️ Map fully loaded and displayed');
    }, 1000);
}

function focusOnMap(lat, lng) {
    if (map) {
        // Smooth scroll to map section
        const mapSection = document.getElementById('mapSection');
        if (mapSection) {
            mapSection.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        // Highlight the map section briefly
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.style.transform = 'scale(1.02)';
            mapContainer.style.transition = 'transform 0.3s ease';

            setTimeout(() => {
                mapContainer.style.transform = 'scale(1)';
            }, 600);
        }

        // Focus on the specific location
        setTimeout(() => {
            map.setView([lat, lng], 16);

            // Find and open the popup for this location
            markers.forEach(marker => {
                const markerLatLng = marker.getLatLng();
                if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lng) < 0.0001) {
                    marker.openPopup();
                }
            });
        }, 500);
    }
}

// Helper function to create POI cards HTML
function createPOICards(pois) {
    return pois.map(poi => `
        <div class="poi-card poi-card--interactive" data-poi-id="${poi.id || poi._id}">
            <div class="poi-card__image-container">
                <div class="poi-card__image-placeholder loading__skeleton">
                    <i class="fas fa-image"></i>
                </div>
                <div class="poi-card__image-overlay"></div>
                <span class="poi-card__category">${getCategoryDisplayName(poi.category)}</span>
            </div>

            <div class="poi-card__content">
                <div class="poi-card__header">
                    <h3 class="poi-card__title">${poi.name}</h3>
                    <div class="poi-card__score ${poi.recommendationScore >= 45 ? 'high-score' : 'low-score'}">${poi.recommendationScore}% Uygun</div>
                </div>
                <div class="poi-media-preview"></div>
                <div class="poi-card__actions">
                    <button class="btn btn--secondary btn--sm" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})">
                        <i class="fas fa-map-marker-alt"></i> Haritada Göster
                    </button>
                    <button class="btn btn--primary btn--sm" onclick="openInGoogleMaps(${poi.latitude}, ${poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')">
                        <i class="fab fa-google"></i> Google Maps
                    </button>
                    <button class="btn btn--success btn--sm" onclick="addToRoute({id: '${poi.id || poi._id}', name: '${poi.name.replace(/'/g, "\\'")}', latitude: ${poi.latitude}, longitude: ${poi.longitude}, category: '${poi.category}'})">
                        <i class="fas fa-plus"></i> Rotaya Ekle
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle low score POIs visibility
function toggleLowScorePOIs() {
    const lowScorePOIs = document.getElementById('lowScorePOIs');
    const toggleBtn = document.getElementById('showLowScoreBtn');

    if (lowScorePOIs.style.display === 'none') {
        // Show low score POIs
        lowScorePOIs.style.display = 'block';
        lowScorePOIs.style.opacity = '0';
        lowScorePOIs.style.transform = 'translateY(20px)';

        setTimeout(() => {
            lowScorePOIs.style.transition = 'all 0.5s ease-out';
            lowScorePOIs.style.opacity = '1';
            lowScorePOIs.style.transform = 'translateY(0)';
        }, 50);

        // Show low score markers on map with animation
        if (markers && markers.length > 0) {
            markers.forEach(marker => {
                if (marker.isLowScore) {
                    marker._icon.style.display = 'block';
                    marker.setOpacity(0);

                    // Animate marker appearance
                    setTimeout(() => {
                        marker._icon.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
                        marker.setOpacity(0.7); // Silik ama görünür
                        marker._icon.style.transform += ' scale(1)';
                    }, 100);
                }
            });
        }

        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Diğer Seçenekleri Gizle';
        toggleBtn.classList.remove('btn--secondary');
        toggleBtn.classList.add('btn--warning');

        // Load media for newly visible POIs
        if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
            setTimeout(() => {
                window.lazyLoader.setupImageLazyLoading();
            }, 500);
        }

        // Scroll to map section and stay there
        setTimeout(() => {
            const mapSection = document.getElementById('mapSection');
            if (mapSection) {
                mapSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 300);

        // Highlight map section briefly
        setTimeout(() => {
            const mapContainer = document.getElementById('mapContainer');
            if (mapContainer) {
                mapContainer.style.transition = 'all 0.5s ease';
                mapContainer.style.transform = 'scale(1.02)';
                mapContainer.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.3)';

                setTimeout(() => {
                    mapContainer.style.transform = 'scale(1)';
                    mapContainer.style.boxShadow = '';
                }, 1000);
            }
        }, 1200);

        console.log('🗺️ Low score POIs shown on map');

    } else {
        // Hide low score POIs
        lowScorePOIs.style.transition = 'all 0.3s ease-in';
        lowScorePOIs.style.opacity = '0';
        lowScorePOIs.style.transform = 'translateY(-20px)';

        // Hide low score markers on map with animation
        if (markers && markers.length > 0) {
            markers.forEach(marker => {
                if (marker.isLowScore) {
                    marker._icon.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-in';
                    marker.setOpacity(0);
                    marker._icon.style.transform += ' scale(0.8)';

                    setTimeout(() => {
                        marker._icon.style.display = 'none';
                    }, 300);
                }
            });
        }

        setTimeout(() => {
            lowScorePOIs.style.display = 'none';
        }, 300);

        toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Diğer Seçenekleri Göster';
        toggleBtn.classList.remove('btn--warning');
        toggleBtn.classList.add('btn--secondary');

        console.log('🗺️ Low score POIs hidden on map');
    }
}
// Enhanced Recommend Button Functionality
document.addEventListener('DOMContentLoaded', function() {
    const recommendBtn = document.getElementById('recommendBtn');
    
    if (recommendBtn) {
        recommendBtn.addEventListener('click', async function() {
            // Prevent multiple clicks
            if (recommendBtn.disabled) return;
            
            const btnIcon = recommendBtn.querySelector('.btn-icon');
            const btnText = recommendBtn.querySelector('.btn-text');
            
            // Set loading state
            recommendBtn.disabled = true;
            recommendBtn.classList.add('loading');
            if (btnIcon) btnIcon.className = 'fas fa-spinner btn-icon';
            if (btnText) btnText.textContent = 'Öneriler Hazırlanıyor...';
            
            try {
                // Get user preferences
                const preferences = {};
                const sliders = document.querySelectorAll('.slider');
                sliders.forEach(slider => {
                    preferences[slider.id] = parseInt(slider.value);
                });
                
                // Validate preferences
                if (Object.values(preferences).every(val => val === 0)) {
                    showNotification('⚠️ Lütfen en az bir kategori için tercih belirtin!', 'warning');
                    resetButton();
                    return;
                }
                
                // Make API request
                const response = await fetch(`${apiBase}/recommendations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preferences })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Success state
                recommendBtn.classList.remove('loading');
                recommendBtn.classList.add('success');
                if (btnIcon) btnIcon.className = 'fas fa-check btn-icon';
                if (btnText) btnText.textContent = 'Öneriler Hazır!';
                
                // Show results
                displayResults(data);
                
                // Reset button after delay
                setTimeout(resetButton, 2000);
                
            } catch (error) {
                console.error('Error getting recommendations:', error);
                
                // Error state
                recommendBtn.classList.remove('loading');
                recommendBtn.classList.add('error');
                if (btnIcon) btnIcon.className = 'fas fa-exclamation-triangle btn-icon';
                if (btnText) btnText.textContent = 'Tekrar Deneyin';
                
                showNotification('❌ Öneriler alınırken bir hata oluştu. Lütfen tekrar deneyin.', 'error');
                
                // Reset button after delay
                setTimeout(resetButton, 3000);
            }
        });
    }
    
    function resetButton() {
        const recommendBtn = document.getElementById('recommendBtn');
        if (!recommendBtn) return;
        
        const btnIcon = recommendBtn.querySelector('.btn-icon');
        const btnText = recommendBtn.querySelector('.btn-text');
        
        recommendBtn.disabled = false;
        recommendBtn.classList.remove('loading', 'success', 'error');
        if (btnIcon) btnIcon.className = 'fas fa-magic btn-icon';
        if (btnText) btnText.textContent = 'Önerilerimi Getir';
    }
    
    function displayResults(data) {
        const resultsSection = document.getElementById('resultsSection');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        showNotification(`✅ ${data.recommendations ? data.recommendations.length : 0} öneri bulundu!`, 'success');
    }
    
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${getNotificationColor(type)}; color: white;
            padding: 15px 20px; border-radius: 10px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            transform: translateX(400px);
            transition: all 0.4s ease; max-width: 400px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; cursor: pointer; padding: 5px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        
        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 400);
        }, 5000);
    }
    
    function getNotificationColor(type) {
        const colors = {
            'success': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            'error': 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            'warning': 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
            'info': 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)'
        };
        return colors[type] || colors.info;
    }
});