// Rate limiting bilgilendirme mesajı
if (window.rateLimiter) {
    console.log('✅ Rate limiting aktif - POI recommendation system API çağrıları sınırlandırılacak');
}

// Debug: Test geometry API endpoint
window.testGeometryAPI = async function(routeId) {
    console.log('🧪 Testing geometry API for route:', routeId);
    try {
        const response = await fetch(`${apiBase}/routes/${routeId}/geometry`);
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', [...response.headers.entries()]);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 Response data:', JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.log('📡 Error response:', text);
        }
    } catch (error) {
        console.error('📡 API test error:', error);
    }
};

// Test function for debugging
window.testAPI = async function() {
    console.log('🧪 Testing API...');
    try {
        const testPreferences = {
            doga: 50,
            yemek: 25,
            tarihi: 0,
            sanat_kultur: 0,
            eglence: 0,
            macera: 0,
            rahatlatici: 0,
            spor: 0,
            alisveris: 0,
            gece_hayati: 0
        };
        
        const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: testPreferences })
        });
        
        console.log('Test response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Test response data:', data);
        } else {
            const errorText = await response.text();
            console.error('Test error:', errorText);
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
};

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

// Elevation chart instances
let dynamicElevationChart = null;
let predefinedElevationChart = null;

// Application state for cleanup
const AppState = {
    isInitialized: false,
    activeRequests: new Set(),
    timeouts: new Set(),
    intervals: new Set()
};

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
        
        // Update panel title if route name is provided (for predefined routes)
        const panelTitle = this.panel.querySelector('.route-header h3');
        if (routeData.route_name && routeData.is_predefined) {
            panelTitle.textContent = `🗺️ ${routeData.route_name}`;
        } else {
            panelTitle.textContent = 'Rota Detayları';
        }

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
                                <i class="${categoryStyle.icon}"></i>
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

        // Add start location (if exists in personal routes)
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
                
                // For predefined routes, use the first POI as starting point if no start location
                const prevPoint = i === 0 ? 
                    (routeData.start || null) : 
                    routeData.waypoints[i - 1];

                // Calculate distance from previous point
                if (prevPoint) {
                    const segmentDistance = this.calculateDistance(
                        prevPoint.lat || prevPoint.latitude,
                        prevPoint.lng || prevPoint.longitude,
                        poi.lat || poi.latitude,
                        poi.lng || poi.longitude
                    );
                    cumulativeDistance += segmentDistance;
                } else if (i === 0 && !routeData.start) {
                    // First POI in predefined route without start location
                    cumulativeDistance = 0;
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
        console.log('🔍 === ROUTE DETAILS PANEL EXPORT DEBUG ===');
        const instance = RouteDetailsPanel.getInstance();
        console.log('🔍 Panel instance:', instance);
        console.log('🔍 Current route:', instance.currentRoute);
        console.log('🔍 Global currentSelectedRoute:', window.currentSelectedRoute);
        console.log('🔍 PredefinedRoutes array:', predefinedRoutes);
        
        if (!instance.currentRoute) {
            console.log('❌ No current route in panel instance');
            showNotification('❌ Aktif rota bulunamadı', 'error');
            return;
        }

        if (selectedPOIs.length === 0) {
            // Try to use route data from panel if available
            if (instance.currentRoute && instance.currentRoute.waypoints && instance.currentRoute.waypoints.length > 0) {
                // Use route panel data instead of selectedPOIs
                console.log('🗺️ Using route panel waypoints instead of selectedPOIs');
                waypoints = instance.currentRoute.waypoints.map(wp => `${wp.latitude},${wp.longitude}`);
                waypointNames = instance.currentRoute.waypoints.map(wp => wp.name || 'POI');
            } else if (instance.currentRoute && instance.currentRoute.is_predefined) {
                // For predefined routes, use the current selected route data
                console.log('🗺️ Predefined route detected in panel');
                
                // Try to find the route in predefinedRoutes global array
                let routeToExport = null;
                if (instance.currentRoute.predefined_route) {
                    routeToExport = instance.currentRoute.predefined_route;
                } else if (window.currentSelectedRoute) {
                    routeToExport = window.currentSelectedRoute;
                } else if (instance.currentRoute.route_name) {
                    // Try to find by name in predefinedRoutes
                    routeToExport = predefinedRoutes.find(r => r.name === instance.currentRoute.route_name);
                }
                
                if (routeToExport) {
                    console.log('🗺️ Found route to export:', routeToExport.name);
                    const routeId = routeToExport.id || routeToExport._id;
                    exportPredefinedRouteToGoogleMaps(routeId);
                    return;
                } else {
                    console.log('🗺️ Could not find predefined route, using fallback');
                    const defaultOrigin = '38.6427,34.8283'; // Göreme
                    const defaultDestination = '38.6436,34.8128'; // Ürgüp
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${defaultOrigin}&destination=${defaultDestination}&travelmode=walking`;
                    window.open(url, '_blank');
                    showNotification('🗺️ Varsayılan Kapadokya rotası Google Maps\'te açıldı!', 'info');
                    return;
                }
            } else {
                // Fallback to default Cappadocia route
                const defaultOrigin = '38.6427,34.8283'; // Göreme
                const defaultDestination = '38.6436,34.8128'; // Ürgüp
                
                const url = `https://www.google.com/maps/dir/?api=1&origin=${defaultOrigin}&destination=${defaultDestination}&travelmode=walking&dir_action=navigate`;
                
                console.log('🗺️ No POIs or route data, opening default Cappadocia route');
                window.open(url, '_blank');
                showNotification('🗺️ Varsayılan Kapadokya rotası Google Maps\'te açıldı!', 'info');
                return;
            }
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
                    <div class="route-item-clickable" onclick="RouteContextMenu.showForPOI(event, '${poi.id || poi._id}', ${index})" style="display: flex; align-items: center; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 6px;">
                        <div style="background: ${categoryStyle.color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 10px;">
                            ${stepNumber}
                        </div>
                        <div style="flex: 1; font-size: 13px;">
                            <div style="font-weight: 600;">${poi.name}</div>
                            <div style="color: #666; font-size: 11px;">${getCategoryDisplayName(poi.category)}</div>
                        </div>
                        <button onclick="event.stopPropagation(); removeFromRoute('${poi.id || poi._id}')" style="background: #e74c3c; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">×</button>
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

    // Remove existing start/end markers before creating new ones
    removeStartEndMarkers();

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

    // Add start and end markers
    addStartEndMarkers(waypoints);

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
        await createSimpleRoute(waypoints);
    }
}

// Create simple route with straight lines (fallback)
async function createSimpleRoute(waypoints) {
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
        dashArray: '10, 5', // Dashed line to indicate it's not a real route
        className: 'simple-route-line'
    }).addTo(map);

    // Enhanced route click functionality
    window.simpleRouteLayer.on('click', function(e) {
        e.originalEvent.stopPropagation();
        showRouteOptionsPopup(e.latlng, waypoints);
    });

    // Add popup to explain this is a simple route
    window.simpleRouteLayer.bindPopup(
        `
                <div style="text-align: center; font-family: 'Segoe UI', sans-serif;">
                    <h6 style="margin: 0 0 8px 0; color: #667eea;">📏 Basit Rota</h6>
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        Düz çizgi bağlantıları<br>
                        <small>(Gerçek yol rotası değil)</small>
                    </p>
                    <div style="margin-top: 8px;">
                        <button onclick="exportToGoogleMaps(); event.stopPropagation();" style="background: #4285f4; color: white; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; cursor: pointer;">
                            🗺️ Google Maps'te Aç
                        </button>
                    </div>
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

    // Create elevation chart for dynamic route
    if (window.ElevationChart && waypoints.length > 1) {
        if (dynamicElevationChart) {
            dynamicElevationChart.destroy();
        }
        dynamicElevationChart = new ElevationChart('elevationChartContainer', map);
        await dynamicElevationChart.loadRouteElevation({
            pois: waypoints.map(wp => ({
                name: wp.name,
                latitude: wp.lat,
                longitude: wp.lng
            }))
        });
    }

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

// Show notification with action button(s) - supports dual buttons
function showNotificationWithAction(message, type = 'info', actionText, actionCallback, actionText2 = null, actionCallback2 = null) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Get notification color (using the same logic as the other function)
    const getNotificationColor = (type) => {
        const colors = {
            'success': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            'error': 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            'warning': 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
            'info': 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)'
        };
        return colors[type] || colors.info;
    };
    
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${getNotificationColor(type)}; color: white;
        padding: 15px 20px; border-radius: 10px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        transform: translateX(400px);
        transition: all 0.4s ease; max-width: 450px;
    `;
    
    const actionId = 'action_' + Math.random().toString(36).substr(2, 9);
    const actionId2 = actionText2 ? 'action2_' + Math.random().toString(36).substr(2, 9) : null;
    
    const buttonsHtml = `
        <button id="${actionId}" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                       color: white; cursor: pointer; padding: 6px 12px; border-radius: 6px;
                       font-size: 12px; font-weight: 500; transition: all 0.2s ease;">
            ${actionText}
        </button>
        ${actionText2 ? `
        <button id="${actionId2}" 
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                       color: white; cursor: pointer; padding: 6px 12px; border-radius: 6px;
                       font-size: 12px; font-weight: 500; transition: all 0.2s ease;">
            ${actionText2}
        </button>` : ''}
        <button onclick="this.closest('.notification').remove()" 
                style="background: none; border: none; color: white; cursor: pointer; padding: 5px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
            <span style="flex: 1;">${message}</span>
            <div style="display: flex; gap: 8px; align-items: center;">
                ${buttonsHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add event listener for action button
    document.getElementById(actionId).addEventListener('click', () => {
        actionCallback();
        notification.remove();
    });
    
    // Add event listener for second action button if present
    if (actionId2 && actionCallback2) {
        document.getElementById(actionId2).addEventListener('click', () => {
            actionCallback2();
            notification.remove();
        });
    }
    
    // Animate in
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    
    // Auto remove after 8 seconds (longer for action notifications)
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 400);
    }, 8000);
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

    // Remove start/end markers
    removeStartEndMarkers();

    console.log('🗑️ Route cleared');
}

// Function to remove start and end markers
function removeStartEndMarkers() {
    if (map) {
        map.eachLayer(function (layer) {
            if (layer.options && layer.options.icon && 
                (layer.options.icon.options.className === 'start-location-marker' ||
                 layer.options.icon.options.className === 'end-location-marker' ||
                 layer.options.className === 'waypoint-marker')) {
                map.removeLayer(layer);
            }
        });
    }
}
// Function to add start and end markers
function addStartEndMarkers(waypoints) {
    if (!waypoints || waypoints.length < 2) return;

    const startPoint = waypoints[0];
    const endPoint = waypoints[waypoints.length - 1];

    // Create start marker
    const startIcon = L.divIcon({
        html: `
            <div style="
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: white;
                position: relative;
            ">
                🏁
                <div style="
                    position: absolute;
                    bottom: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #e74c3c;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">
                    BAŞLANGIÇ
                </div>
            </div>
        `,
        className: 'start-location-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup(
            `
            <div style="text-align: center; font-family: 'Segoe UI', sans-serif; min-width: 200px;">
                <h6 style="margin: 0 0 10px 0; color: #e74c3c; font-size: 16px;">🏁 Başlangıç Noktası</h6>
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${startPoint.name}</p>
                <div style="margin: 8px 0; font-size: 11px; color: #666; padding: 4px 8px; background: #f8f9fa; border-radius: 6px;">
                    📍 ${startPoint.lat.toFixed(4)}, ${startPoint.lng.toFixed(4)}
                </div>
                <div style="margin-top: 10px; display: flex; gap: 6px; justify-content: center;">
                    <button onclick="openInGoogleMaps(${startPoint.lat}, ${startPoint.lng}, '${startPoint.name.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                            style="background: #4285f4; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">
                        🗺️ Google Maps
                    </button>
                    <button onclick="map.setView([${startPoint.lat}, ${startPoint.lng}], 18); event.stopPropagation();" 
                            style="background: #27ae60; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">
                        🎯 Yakınlaştır
                    </button>
                </div>
            </div>
            `
        );

    // Create end marker
    const endIcon = L.divIcon({
        html: `
            <div style="
                background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: white;
                position: relative;
            ">
                🏆
                <div style="
                    position: absolute;
                    bottom: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #27ae60;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">
                    BİTİŞ
                </div>
            </div>
        `,
        className: 'end-location-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endIcon })
        .addTo(map)
        .bindPopup(
            `
            <div style="text-align: center; font-family: 'Segoe UI', sans-serif; min-width: 200px;">
                <h6 style="margin: 0 0 10px 0; color: #27ae60; font-size: 16px;">🏆 Bitiş Noktası</h6>
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${endPoint.name}</p>
                <div style="margin: 8px 0; font-size: 11px; color: #666; padding: 4px 8px; background: #f8f9fa; border-radius: 6px;">
                    📍 ${endPoint.lat.toFixed(4)}, ${endPoint.lng.toFixed(4)}
                </div>
                <div style="margin-top: 10px; display: flex; gap: 6px; justify-content: center;">
                    <button onclick="openInGoogleMaps(${endPoint.lat}, ${endPoint.lng}, '${endPoint.name.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                            style="background: #4285f4; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">
                        🗺️ Google Maps
                    </button>
                    <button onclick="map.setView([${endPoint.lat}, ${endPoint.lng}], 18); event.stopPropagation();" 
                            style="background: #27ae60; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">
                        🎯 Yakınlaştır
                    </button>
                </div>
            </div>
            `
        );

    console.log('✅ Start and end markers added to map');
}

// Function to show route options popup when clicking on route
function showRouteOptionsPopup(latlng, waypoints) {
    const popup = L.popup({
        maxWidth: 300,
        className: 'route-options-popup'
    })
    .setLatLng(latlng)
    .setContent(createRouteOptionsContent(waypoints))
    .openOn(map);
}

// Create content for route options popup
function createRouteOptionsContent(waypoints) {
    const totalDistance = calculateTotalDistance(waypoints);
    const estimatedTime = Math.round(totalDistance * 12); // 12 minutes per km
    
    return `
        <div style="text-align: center; font-family: 'Segoe UI', sans-serif; min-width: 250px;">
            <h6 style="margin: 0 0 12px 0; color: #667eea; font-size: 16px;">🗺️ Rota Seçenekleri</h6>
            
            <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #666; font-size: 12px;">📏 Mesafe:</span>
                    <span style="font-weight: 600; font-size: 12px;">${totalDistance.toFixed(2)} km</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #666; font-size: 12px;">⏱️ Tahmini Süre:</span>
                    <span style="font-weight: 600; font-size: 12px;">${estimatedTime} dk</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #666; font-size: 12px;">📍 Duraklar:</span>
                    <span style="font-weight: 600; font-size: 12px;">${waypoints.length} nokta</span>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button onclick="exportToGoogleMaps(); map.closePopup();" 
                        style="background: #4285f4; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    🗺️ Google Maps'te Aç
                </button>
                
                <button onclick="optimizeRoute(); map.closePopup();" 
                        style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    ⚡ Rotayı Optimize Et
                </button>
                
                <button onclick="RouteDetailsPanel.show({total_distance: ${totalDistance.toFixed(2)}, estimated_time: ${estimatedTime * 60}, route_type: 'düz çizgi', waypoints: selectedPOIs, segments: []}); map.closePopup();" 
                        style="background: #667eea; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📋 Detaylı Bilgi
                </button>
                
                <button onclick="clearRoute(); map.closePopup();" 
                        style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    🗑️ Rotayı Temizle
                </button>
            </div>
        </div>
    `;
}

// Helper function to calculate total distance
function calculateTotalDistance(waypoints) {
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const current = waypoints[i];
        const next = waypoints[i + 1];
        totalDistance += getDistance(current.lat, current.lng, next.lat, next.lng);
    }
    return totalDistance;
}

// Function to show predefined route options popup when clicking on route
function showPredefinedRouteOptionsPopup(latlng, route) {
    const popup = L.popup({
        maxWidth: 320,
        className: 'route-options-popup predefined-route-popup'
    })
    .setLatLng(latlng)
    .setContent(createPredefinedRouteOptionsContent(route))
    .openOn(predefinedMap);
}

// Show route details panel for predefined routes (similar to personal routes)
function showPredefinedRouteDetailsPanel(route, latlng) {
    if (!route) return;
    
    const poiCount = route.pois ? route.pois.length : 0;
    
    // Calculate estimated time and distance
    let totalDistance = 0;
    if (route.pois && route.pois.length > 1) {
        for (let i = 0; i < route.pois.length - 1; i++) {
            const current = route.pois[i];
            const next = route.pois[i + 1];
            if (current.lat && (current.lng || current.lon) && next.lat && (next.lng || next.lon)) {
                const currentLng = current.lng || current.lon;
                const nextLng = next.lng || next.lon;
                totalDistance += getDistance(current.lat, currentLng, next.lat, nextLng);
            }
        }
    }
    
    // Convert to kilometers and format
    totalDistance = (totalDistance / 1000).toFixed(2);
    
    const estimatedTime = Math.round(totalDistance / 5 * 60); // 5 km/h walking speed, in minutes
    const routeType = route.route_type === 'walking' ? 'Yürüyüş' : 
                      route.route_type === 'hiking' ? 'Doğa Yürüyüşü' :
                      route.route_type === 'cycling' ? 'Bisiklet' : 
                      route.route_type === 'driving' ? 'Araç' : 'Bilinmeyen';

    // Create waypoints for the panel
    const waypoints = route.pois ? route.pois.map(poi => ({
        id: poi.id || poi._id,
        name: poi.name,
        latitude: poi.lat,
        longitude: poi.lng || poi.lon,
        category: poi.category || 'diger'
    })) : [];

    // Show the route details panel using the existing RouteDetailsPanel class
    RouteDetailsPanel.show({
        total_distance: totalDistance,
        estimated_time: estimatedTime,
        route_type: routeType,
        waypoints: waypoints,
        segments: [], // No segments for predefined routes
        route_name: route.name,
        is_predefined: true,
        predefined_route: route // Pass the full route object for export functionality
    });
}

// Attach standard click/context menu handlers for predefined route layers
function attachPredefinedRouteEvents(layer, route) {
    if (!layer) return;
    // Remove existing handlers to avoid duplicates
    layer.off('click');
    layer.off('contextmenu');

    layer.on('click', e => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        // Show route details panel similar to personal routes
        showPredefinedRouteDetailsPanel(route, e.latlng);
    });

    layer.on('contextmenu', e => {
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
        }
        showPredefinedRouteOptionsPopup(e.latlng, route);
    });
}

// Create content for predefined route options popup
function createPredefinedRouteOptionsContent(route) {
    const routeType = route.route_type === 'walking' ? '🚶 Yürüyüş' : 
                      route.route_type === 'hiking' ? '🥾 Doğa Yürüyüşü' :
                      route.route_type === 'cycling' ? '🚴 Bisiklet' : 
                      route.route_type === 'driving' ? '🚗 Araç' : route.route_type || 'Bilinmeyen';
    
    const poiCount = route.pois ? route.pois.length : 0;
    
    return `
        <div style="text-align: center; font-family: 'Segoe UI', sans-serif; min-width: 280px;">
            <h6 style="margin: 0 0 12px 0; color: #2c5aa0; font-size: 16px;">🗺️ ${route.name}</h6>
            
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #666; font-size: 12px;">🚶 Tip:</span>
                    <span style="font-weight: 600; font-size: 12px;">${routeType}</span>
                </div>
                ${route.total_distance ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #666; font-size: 12px;">📏 Mesafe:</span>
                    <span style="font-weight: 600; font-size: 12px;">${route.total_distance.toFixed(1)} km</span>
                </div>` : ''}
                ${route.estimated_duration ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #666; font-size: 12px;">⏱️ Süre:</span>
                    <span style="font-weight: 600; font-size: 12px;">${route.estimated_duration} dk</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #666; font-size: 12px;">📍 POI Sayısı:</span>
                    <span style="font-weight: 600; font-size: 12px;">${poiCount} nokta</span>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button onclick="exportPredefinedRouteToGoogleMaps('${route.id || route._id}'); predefinedMap.closePopup();" 
                        style="background: #4285f4; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    🗺️ Google Maps'te Aç
                </button>
                
                <button onclick="showRouteDetail('${route.id || route._id}'); predefinedMap.closePopup();" 
                        style="background: #667eea; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📋 Detaylı Bilgi
                </button>
                
                <button onclick="copyRouteToPersonalRoute('${route.id || route._id}'); predefinedMap.closePopup();" 
                        style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 12px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    📝 Kişisel Rotaya Kopyala
                </button>
                
                <div style="display: flex; gap: 6px;">
                    <button onclick="zoomToRoute('${route.id || route._id}'); predefinedMap.closePopup();" 
                            style="background: #27ae60; color: white; border: none; padding: 8px 12px; border-radius: 12px; font-size: 11px; cursor: pointer; flex: 1;">
                        🎯 Rotaya Yakınlaştır
                    </button>
                    <button onclick="clearPredefinedMapContent(); predefinedMap.closePopup();" 
                            style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 12px; font-size: 11px; cursor: pointer; flex: 1;">
                        🗑️ Haritayı Temizle
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Export predefined route to Google Maps
function exportPredefinedRouteToGoogleMaps(routeId) {
    const route = predefinedRoutes.find(r => (r.id || r._id) === routeId);
    if (!route) {
        showNotification('❌ Rota bulunamadı', 'error');
        return;
    }

    let waypoints = [];
    let origin, destination;

    // Priority 1: Try to extract from geometry (matches what's shown on map)
    if (route.geometry && route.geometry.coordinates) {
        try {
            const coords = route.geometry.coordinates;
            if (coords.length >= 2) {
                // Take first and last coordinates from geometry
                const firstCoord = coords[0];
                const lastCoord = coords[coords.length - 1];
                
                origin = `${firstCoord[1]},${firstCoord[0]}`; // lat,lng
                destination = `${lastCoord[1]},${lastCoord[0]}`; // lat,lng
                
                // Add some intermediate points if available
                const step = Math.max(1, Math.floor(coords.length / 10)); // Max 10 waypoints
                waypoints = [];
                for (let i = 0; i < coords.length; i += step) {
                    if (waypoints.length < 23) { // Google Maps limit
                        waypoints.push(`${coords[i][1]},${coords[i][0]}`);
                    }
                }
                
                console.log('🗺️ Using geometry coordinates (matches map display):', waypoints.length);
            }
        } catch (error) {
            console.warn('⚠️ Error parsing geometry:', error);
        }
    }
    
    // Priority 2: If no geometry, try to get waypoints from POIs
    if (waypoints.length < 2 && route.pois && route.pois.length > 0) {
        const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
        if (validPois.length > 0) {
            waypoints = [];
            validPois.forEach(poi => {
                const lng = poi.lng !== undefined ? poi.lng : poi.lon;
                waypoints.push(`${poi.lat},${lng}`);
            });
            origin = waypoints[0];
            destination = waypoints[waypoints.length - 1];
            
            console.log('🗺️ Using POI waypoints (fallback):', waypoints.length);
        }
    }
    
    // Priority 3: Use route name to guess coordinates (Cappadocia area)
    if (waypoints.length < 2) {
        const routeName = route.name || '';
        const knownLocations = {
            'göreme': '38.6427,34.8283',
            'uçhisar': '38.6361,34.8106',
            'avanos': '38.7151,34.8403',
            'ürgüp': '38.6436,34.8128',
            'ortahisar': '38.6425,34.8594',
            'çavuşin': '38.6533,34.8378',
            'love valley': '38.6612,34.8258'
        };
        
        const routeNameLower = routeName.toLowerCase();
        const foundLocations = [];
        
        Object.keys(knownLocations).forEach(location => {
            if (routeNameLower.includes(location)) {
                foundLocations.push(knownLocations[location]);
            }
        });
        
        if (foundLocations.length >= 2) {
            origin = foundLocations[0];
            destination = foundLocations[foundLocations.length - 1];
            waypoints = foundLocations;
            console.log('🗺️ Using name-based coordinates:', foundLocations.length);
        } else if (foundLocations.length === 1) {
            // Single location found, create a small route around it
            origin = foundLocations[0];
            const [lat, lng] = foundLocations[0].split(',').map(parseFloat);
            destination = `${lat + 0.01},${lng + 0.01}`; // Small offset
            waypoints = [origin, destination];
            console.log('🗺️ Using single location with offset');
        } else {
            // Default: Central Cappadocia area
            origin = '38.6427,34.8283'; // Göreme
            destination = '38.6436,34.8128'; // Ürgüp
            waypoints = [origin, destination];
            console.log('🗺️ Using default Cappadocia coordinates');
        }
    }

    let waypointParam = '';
    if (waypoints.length > 2) {
        const middleWaypoints = waypoints.slice(1, -1);
        const maxWaypoints = Math.min(middleWaypoints.length, 23); // Google Maps limit
        const selectedWaypoints = middleWaypoints.slice(0, maxWaypoints);
        waypointParam = '&waypoints=' + selectedWaypoints.join('|');
    }

    // For hiking routes, use different approach to avoid road network forcing
    const routeName = (route.name || '').toLowerCase();
    const isHikingRoute = route.route_type === 'hiking' || 
                         route.route_type === 'walking' || // walking routes are often hiking trails
                         routeName.includes('yürüyüş') || 
                         routeName.includes('patika') ||
                         routeName.includes('vadisi') ||   // valley trails
                         routeName.includes('valley') ||
                         routeName.includes('wikiloc') ||  // wikiloc = hiking trails
                         routeName.includes('trail') ||
                         routeName.includes('trek') ||
                         routeName.includes('hiking') ||
                         routeName.includes('güvercinlik') || // pigeon valley
                         routeName.includes('pigeon') ||
                         routeName.includes('kale') ||     // castle trails  
                         routeName.includes('castle');
    
    // DEBUG: Log export information
    console.log('🔍 GOOGLE MAPS EXPORT DEBUG:');
    console.log('📍 Exporting route:', route.name);
    console.log('🏷️ Route type:', route.route_type); 
    console.log('🥾 Is hiking route?', isHikingRoute);
    console.log('📊 Waypoints count:', waypoints.length);
    console.log('📍 Waypoints:', waypoints);
    
    // SIMPLE AND WORKING: Just use basic Google Maps directions
    let travelMode = 'walking';
    if (route.route_type === 'driving') travelMode = 'driving';
    else if (route.route_type === 'cycling') travelMode = 'bicycling';
    else if (route.route_type === 'transit') travelMode = 'transit';

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}&travelmode=${travelMode}`;
    
    console.log('🗺️ Using simple directions format');
    console.log('🗺️ Origin:', origin);
    console.log('🗺️ Destination:', destination);
    console.log('🗺️ Travel mode:', travelMode);
    console.log('🗺️ Waypoints:', waypoints.length);
    
    showNotification(`🗺️ "${route.name}" Google Maps'te açıldı!`, 'success');

    console.log('🗺️ === FINAL EXPORT SUMMARY ===');
    console.log('🗺️ Route name:', route.name);
    console.log('🗺️ Generated URL:', url);

    window.open(url, '_blank');
}

// Add navigation route from current location to route start
async function addNavigationToRoute(route) {
    console.log('🧭 Adding navigation route from current location');
    
    // Check if route has valid geometry or POIs for start point
    let routeStartCoord = null;
    
    if (route.geometry && route.geometry.coordinates && route.geometry.coordinates.length > 0) {
        const startCoord = route.geometry.coordinates[0];
        routeStartCoord = [startCoord[1], startCoord[0]]; // lat, lng
        console.log('📍 Route start from geometry:', routeStartCoord);
    } else if (route.pois && route.pois.length > 0) {
        const firstPoi = route.pois[0];
        if (firstPoi.lat && (firstPoi.lng || firstPoi.lon)) {
            routeStartCoord = [firstPoi.lat, firstPoi.lng || firstPoi.lon];
            console.log('📍 Route start from POI:', routeStartCoord);
        }
    }
    
    if (!routeStartCoord) {
        console.log('⚠️ Could not determine route start point');
        return;
    }
    
    // Request user location
    try {
        if (!navigator.geolocation) {
            showNotification('❌ Konumunuz bu cihazda desteklenmiyor', 'error');
            return;
        }
        
        // Show loading notification
        showNotification('📍 Konumunuz alınıyor...', 'info');
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                console.log('📱 User location:', userLocation);
                
                // Calculate distance to route start
                const distance = getDistance(userLocation[0], userLocation[1], routeStartCoord[0], routeStartCoord[1]);
                const distanceKm = (distance / 1000).toFixed(1);
                
                if (distance < 100) { // Less than 100 meters
                    showNotification('🎯 Zaten rota başlangıcında bulunuyorsunuz!', 'success');
                    return;
                }
                
                // Get navigation route from current location to route start
                await createNavigationRoute(userLocation, routeStartCoord, route.name, distanceKm);
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
                let errorMessage = 'Konumunuz alınamadı';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini açın.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Konumunuz belirlenemedi. GPS açık olduğundan emin olun.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Konum alınırken zaman aşımı oluştu.';
                        break;
                }
                
                showNotification(`❌ ${errorMessage}`, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes cache
            }
        );
        
    } catch (error) {
        console.error('❌ Navigation error:', error);
        showNotification('❌ Navigasyon rotası oluşturulamadı', 'error');
    }
}

// Create navigation route on map
async function createNavigationRoute(fromCoord, toCoord, routeName, distanceKm) {
    if (!predefinedMap) {
        console.error('❌ Map not initialized for navigation route');
        return;
    }
    
    try {
        console.log('🗺️ Creating navigation route');
        console.log('📍 From:', fromCoord);
        console.log('📍 To:', toCoord);
        
        // Add user location marker
        const userMarker = L.marker(fromCoord, {
            icon: L.divIcon({
                html: '<div style="background: #007bff; color: white; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-user"></i></div>',
                className: 'user-location-marker',
                iconSize: [25, 25],
                iconAnchor: [12.5, 12.5]
            })
        }).addTo(predefinedMap);
        
        userMarker.bindTooltip('Mevcut Konumunuz', { permanent: false, direction: 'top' });
        
        // Try to get actual route from routing service
        const routingUrl = `https://router.project-osrm.org/route/v1/walking/${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}?overview=full&geometries=geojson`;
        
        let routeGeometry = null;
        try {
            const response = await fetch(routingUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.routes && data.routes.length > 0) {
                    routeGeometry = data.routes[0].geometry.coordinates;
                    console.log('🛣️ Got routing geometry with', routeGeometry.length, 'points');
                }
            }
        } catch (error) {
            console.warn('⚠️ Routing service failed, using direct line:', error);
        }
        
        // Create navigation route line
        let navigationRoute;
        if (routeGeometry && routeGeometry.length > 2) {
            // Use actual route from routing service
            navigationRoute = L.polyline(
                routeGeometry.map(coord => [coord[1], coord[0]]), {
                color: '#ff6b35', // Orange color for navigation
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5',
                className: 'navigation-route-line'
            }).addTo(predefinedMap);
        } else {
            // Fallback to direct line
            navigationRoute = L.polyline([fromCoord, toCoord], {
                color: '#ff6b35', // Orange color for navigation
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5',
                className: 'navigation-route-line'
            }).addTo(predefinedMap);
        }
        
        // Add to layers for cleanup
        predefinedMapLayers.push(userMarker, navigationRoute);
        
        // Show success notification
        showNotification(`🧭 Mevcut konumunuzdan "${routeName}" rotasına ${distanceKm} km ulaşım rotası eklendi!`, 'success');
        
        // Fit map to show both user location and route
        const group = new L.featureGroup([userMarker, navigationRoute]);
        predefinedMap.fitBounds(group.getBounds(), { padding: [20, 20] });
        
    } catch (error) {
        console.error('❌ Error creating navigation route:', error);
        showNotification('❌ Navigasyon rotası çizilirken hata oluştu', 'error');
    }
}

// Export predefined route to Google Earth (for hiking trails)
function exportPredefinedRouteToGoogleEarth(routeId) {
    const route = predefinedRoutes.find(r => (r.id || r._id) === routeId);
    if (!route) {
        showNotification('❌ Rota bulunamadı', 'error');
        return;
    }

    let waypoints = [];
    
    // Try to get waypoints from geometry first (most accurate for hiking trails)
    if (route.geometry && route.geometry.coordinates) {
        try {
            const coords = route.geometry.coordinates;
            if (coords.length >= 2) {
                // For Google Earth, we can use more waypoints since it's designed for complex paths
                const step = Math.max(1, Math.floor(coords.length / 50)); // Up to 50 points
                for (let i = 0; i < coords.length; i += step) {
                    waypoints.push(`${coords[i][1]},${coords[i][0]}`); // lat,lng
                }
                console.log('🌍 Using geometry coordinates for Google Earth:', waypoints.length);
            }
        } catch (error) {
            console.warn('⚠️ Error parsing geometry for Google Earth:', error);
        }
    }
    
    // Fallback to POIs if no geometry
    if (waypoints.length < 2 && route.pois && route.pois.length > 0) {
        const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
        if (validPois.length > 0) {
            validPois.forEach(poi => {
                const lng = poi.lng !== undefined ? poi.lng : poi.lon;
                waypoints.push(`${poi.lat},${lng}`);
            });
            console.log('🌍 Using POI waypoints for Google Earth:', waypoints.length);
        }
    }
    
    // Default fallback
    if (waypoints.length < 2) {
        waypoints = ['38.6427,34.8283', '38.6436,34.8128']; // Göreme to Ürgüp
        console.log('🌍 Using default coordinates for Google Earth');
    }

    // Google Earth Web link with multiple waypoints
    // Note: Google Earth Web supports more complex KML-like data
    const firstPoint = waypoints[0];
    const earthUrl = `https://earth.google.com/web/search/${firstPoint}/@${firstPoint},1000d/data=CgIgAQ%3D%3D`;
    
    console.log('🌍 Exporting to Google Earth Web:', route.name);
    console.log('🌍 Waypoints:', waypoints.length);
    console.log('🌍 URL:', earthUrl);
    
    window.open(earthUrl, '_blank');
    showNotification(`🌍 "${route.name}" Google Earth'te açıldı!`, 'success');
}

// Copy route to personal route function
function copyRouteToPersonalRoute(routeId) {
    const route = predefinedRoutes.find(r => (r.id || r._id) === routeId);
    if (!route) {
        showNotification('❌ Rota bulunamadı', 'error');
        return;
    }

    if (!route.pois || route.pois.length === 0) {
        showNotification('❌ Rota POI\'leri bulunamadı', 'error');
        return;
    }

    // Remove existing predefined route overlays so they don't capture clicks
    if (typeof clearPredefinedMapContent === 'function') {
        clearPredefinedMapContent();
    }

    // Switch to dynamic routes tab
    switchToTab('dynamic-routes');

    // Clear current selection
    selectedPOIs = [];
    startLocation = null;

    // Add route POIs to personal route
    const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
    validPois.forEach(poi => {
        const normalizedPoi = {
            id: poi.id || poi._id,
            name: poi.name,
            latitude: poi.lat,
            longitude: poi.lng !== undefined ? poi.lng : poi.lon,
            category: poi.category || 'diger'
        };
        selectedPOIs.push(normalizedPoi);
    });

    // Update route display
    updateRouteDisplay();

    // Create route if we have enough POIs
    if (selectedPOIs.length >= 2) {
        setTimeout(() => {
            createRoute();
        }, 500);
    }

    showNotification(`✅ "${route.name}" kişisel rotanıza kopyalandı!`, 'success');
}

// Zoom to specific route
function zoomToRoute(routeId) {
    const route = predefinedRoutes.find(r => (r.id || r._id) === routeId);
    if (!route) {
        showNotification('❌ Rota bulunamadı', 'error');
        return;
    }

    // Find the route layers and zoom to them
    predefinedMapLayers.forEach(layer => {
        if (layer.getBounds && layer.getBounds().isValid()) {
            predefinedMap.fitBounds(layer.getBounds(), { padding: [20, 20] });
            return;
        }
    });

    showNotification(`🎯 "${route.name}" rotasına yakınlaştırıldı`, 'success');
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

    // Remove existing route layers and any simple fallback line
    map.eachLayer(function (layer) {
        if (layer.options && (layer.options.className === 'walking-route' || layer.options.className === 'simple-route-layer')) {
            map.removeLayer(layer);
        }
    });
    if (window.simpleRouteLayer && map.hasLayer(window.simpleRouteLayer)) {
        map.removeLayer(window.simpleRouteLayer);
        window.simpleRouteLayer = null;
    }

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

// Export to Google Maps (standalone function for route options)
function exportToGoogleMaps() {
    // Check if we have any route data to export
    if (selectedPOIs.length === 0 && !startLocation) {
        // Try to get a default route for current area (Cappadocia)
        const defaultOrigin = '38.6427,34.8283'; // Göreme
        const defaultDestination = '38.6436,34.8128'; // Ürgüp
        
        const url = `https://www.google.com/maps/dir/?api=1&origin=${defaultOrigin}&destination=${defaultDestination}&travelmode=walking&dir_action=navigate`;
        
        console.log('🗺️ No POIs selected, opening default Cappadocia route');
        window.open(url, '_blank');
        showNotification('🗺️ Varsayılan Kapadokya rotası Google Maps\'te açıldı!', 'info');
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

    // Use enhanced Google Maps URL with proper formatting
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];

    let waypointParam = '';
    if (waypoints.length > 2) {
        const middleWaypoints = waypoints.slice(1, -1);
        const maxWaypoints = Math.min(middleWaypoints.length, 23); // Google Maps limit
        const selectedWaypoints = middleWaypoints.slice(0, maxWaypoints);
        waypointParam = '&waypoints=' + selectedWaypoints.join('|');
    }

    // Enhanced URL with proper travel mode and optimization
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}&travelmode=walking&dir_action=navigate`;

    console.log('🗺️ Exporting route to Google Maps:');
    console.log('Origin:', origin, startLocation ? `(${startLocation.name})` : '');
    console.log('Destination:', destination, selectedPOIs.length > 0 ? `(${selectedPOIs[selectedPOIs.length - 1].name})` : '');
    console.log('Waypoints:', waypoints.slice(1, -1));
    console.log('URL:', url);

    window.open(url, '_blank');
    showNotification('🗺️ Google Maps\'te navigasyon başlatıldı!', 'success');
}

// Export full route to Google Maps with names (legacy function)
function exportFullRoute() {
    exportToGoogleMaps(); // Use the enhanced function
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
    dynamicTab.addEventListener('click', async () => await switchTab('dynamic-routes'));
    predefinedTab.addEventListener('click', async () => await switchTab('predefined-routes'));
    
    // Initialize predefined routes functionality
    initializePredefinedRoutes();
    
    console.log('✅ Route tabs initialized');
}
async function switchTab(tabName) {
    console.log(`🔄 Switching to tab: ${tabName}`);
    
    const previousTab = currentTab;
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
    
    // Cleanup previous tab state
    cleanupTabState(previousTab);
    
    // Add active class to selected tab and initialize
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
            await loadPredefinedRoutes();
        }
        
        // Initialize predefined routes map if not already initialized (lazy loading)
        addTimeout(async () => {
            if (!predefinedMapInitialized) {
                console.log('🗺️ Lazy loading predefined routes map...');
                await initializePredefinedMap();
            } else if (predefinedMap) {
                // Refresh map size in case it was hidden
                addTimeout(() => {
                    if (predefinedMap) {
                        predefinedMap.invalidateSize();
                    }
                }, 100);
            }
        }, 100);
    }
}

// Cleanup function for tab state management
function cleanupTabState(tabName) {
    if (!tabName) return;
    
    console.log(`🧹 Cleaning up tab state for: ${tabName}`);
    
    if (tabName === 'dynamic-routes') {
        // Clean up dynamic routes state if needed
        // Keep the main map and markers for later use
        if (dynamicElevationChart) {
            dynamicElevationChart.destroy();
            dynamicElevationChart = null;
        }
    } else if (tabName === 'predefined-routes') {
        // Clean up predefined routes state
        // Close any open modals
        const routeModal = document.getElementById('routeDetailModal');
        if (routeModal && routeModal.classList.contains('show')) {
            closeRouteDetailModal();
        }
        // Keep the predefined map instance but clear temporary highlights
        if (predefinedElevationChart) {
            predefinedElevationChart.destroy();
            predefinedElevationChart = null;
        }
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
    
    // Initialize map control event listeners
    const clearMapBtn = document.getElementById('clearMapBtn');
    const fitMapBtn = document.getElementById('fitMapBtn');
    
    if (clearMapBtn) {
        clearMapBtn.addEventListener('click', () => {
            clearPredefinedMapContent();
            showNotification('Harita temizlendi', 'success');
        });
    }
    if (fitMapBtn) {
        fitMapBtn.addEventListener('click', fitAllRoutesOnMap);
    }
    
    console.log('✅ Predefined routes functionality initialized');
}

// Predefined routes map management
let predefinedMap = null;
let predefinedMapLayers = [];
let predefinedMapInitialized = false;

// Map initialization state management
let mapInitializationPromise = null;
let mapInitialized = false;

async function initializePredefinedMap() {
    console.log('🗺️ Initializing predefined routes map...');
    
    const mapContainer = document.getElementById('predefinedRoutesMap');
    const loadingElement = document.getElementById('predefinedMapLoading');
    
    if (!mapContainer) {
        console.error('❌ Predefined map container not found');
        return false;
    }
    
    try {
        // Show loading state
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
        mapContainer.classList.add('loading');
        
        // Create map if it doesn't exist
        if (!predefinedMap) {
            predefinedMap = L.map('predefinedRoutesMap', {
                center: [38.6436, 34.8128], // Ürgüp center
                zoom: 12,
                zoomControl: true,
                attributionControl: true
            });
            
            // Add base layers
            addBaseLayers(predefinedMap);
            
            console.log('✅ Predefined map created successfully');
        }
        
        // Initialize map layers array
        predefinedMapLayers = [];
        predefinedMapInitialized = true;
        
        // Hide loading state
        addTimeout(() => {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            mapContainer.classList.remove('loading');
            mapContainer.classList.add('loaded');
            
            // Invalidate size to ensure proper rendering
            if (predefinedMap) {
                predefinedMap.invalidateSize();
            }
        }, 500);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error initializing predefined map:', error);
        
        // Hide loading state on error
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        mapContainer.classList.remove('loading');
        
        return false;
    }
}

async function displayRouteOnMap(route) {
    console.log('🗺️ === DISPLAYING ROUTE ON MAP ===');
    console.log('🗺️ Displaying route on predefined map:', route);
    console.log('🔍 Route geometry:', route.geometry);
    console.log('🔍 Route POIs:', route.pois);
    
    if (!predefinedMap || !predefinedMapInitialized) {
        console.warn('⚠️ Predefined map not initialized, initializing now...');
        initializePredefinedMap().then(async () => {
            if (predefinedMapInitialized) {
                await displayRouteOnMap(route);
            }
        });
        return;
    }
    
    console.log('🗺️ Predefined map is ready, proceeding with route display...');
    console.log('🔍 Map state:', {
        mapExists: !!predefinedMap,
        mapInitialized: predefinedMapInitialized,
        layersCount: predefinedMapLayers.length
    });
    
    // Ensure map container is visible and invalidate size for proper rendering
    const mapContainer = document.getElementById('predefinedRoutesMap');
    if (mapContainer) {
        mapContainer.style.display = 'block';
        mapContainer.style.visibility = 'visible';
        mapContainer.style.opacity = '1';
        predefinedMap.invalidateSize();
        console.log('🔄 Map container visibility and size refreshed');
        console.log('🔍 Map container dimensions:', {
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight,
            display: mapContainer.style.display,
            visibility: mapContainer.style.visibility
        });
    }
    
    try {
        // Clear existing route layers
        clearPredefinedMapContent();
        
        // Route type colors
        const routeColors = {
            'walking': '#059669',
            'hiking': '#d97706', 
            'cycling': '#2563eb',
            'driving': '#dc2626'
        };
        
        const routeColor = routeColors[route.route_type] || '#2563eb';
        
        // Display route geometry if available
        if (route.geometry) {
            console.log('🔍 Route has geometry, processing...');
            let geometryData = route.geometry;
            if (typeof geometryData === 'string') {
                try {
                    geometryData = JSON.parse(geometryData);
                    console.log('✅ Parsed geometry from string:', geometryData);
                } catch (e) {
                    console.warn('⚠️ Could not parse route geometry:', e);
                    return;
                }
            }
            
            console.log('🔍 Processing geometry data:', geometryData);
            
            if (geometryData.coordinates || geometryData.geometry) {
                const coords = geometryData.coordinates || geometryData.geometry.coordinates;
                console.log('🔍 Found coordinates:', coords ? coords.length : 'none', 'points');
                if (coords && coords.length > 0) {
                    // Create route polyline
                    const routeLine = L.polyline(coords.map(coord => [coord[1], coord[0]]), {
                        color: routeColor,
                        weight: 4,
                        opacity: 0.8,
                        className: 'route-on-map predefined-route-line'
                    }).addTo(predefinedMap);
                    
                    // Add START marker (green)
                    const startCoord = coords[0];
                    const startMarker = L.marker([startCoord[1], startCoord[0]], {
                        icon: L.divIcon({
                            html: '<div style="background: #28a745; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>',
                            className: 'start-marker',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        })
                    }).addTo(predefinedMap);
                    
                    // Add END marker (red)
                    const endCoord = coords[coords.length - 1];
                    const endMarker = L.marker([endCoord[1], endCoord[0]], {
                        icon: L.divIcon({
                            html: '<div style="background: #dc3545; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">F</div>',
                            className: 'end-marker',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        })
                    }).addTo(predefinedMap);
                    
                    // Add tooltips to markers
                    startMarker.bindTooltip('Başlangıç', { permanent: false, direction: 'top' });
                    endMarker.bindTooltip('Bitiş', { permanent: false, direction: 'top' });
                    
                    // Store markers in layers for cleanup
                    predefinedMapLayers.push(routeLine, startMarker, endMarker);
                    
                    // Attach standard route interaction handlers
                    attachPredefinedRouteEvents(routeLine, route);
                    
                    // Create bounds for fitting the map - start with route bounds
                    const bounds = routeLine.getBounds();
                    
                    // CRITICAL: Also add POI markers even when we have geometry
                    if (route.pois && route.pois.length > 0) {
                        console.log('🔍 Adding POI markers along with geometry...');
                        const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
                        
                        validPois.forEach((poi, index) => {
                            const lng = poi.lng !== undefined ? poi.lng : poi.lon;
                            const latLng = [poi.lat, lng];
                            
                            // Get category style for this POI
                            const categoryStyle = getCategoryStyle(poi.category || 'diger');
                            
                            const marker = L.marker(latLng, {
                                icon: L.divIcon({
                                    className: 'route-poi-marker',
                                    html: `<div style="
                                        background: ${categoryStyle.color};
                                        color: white;
                                        width: 35px; 
                                        height: 35px; 
                                        border-radius: 50%; 
                                        display: flex; 
                                        align-items: center; 
                                        justify-content: center; 
                                        font-weight: bold;
                                        border: 3px solid white;
                                        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                                        font-size: 16px;
                                        position: relative;
                                    ">
                                        <span style="position: absolute; top: -2px;"><i class="${categoryStyle.icon}"></i></span>
                                        <span style="
                                            position: absolute;
                                            bottom: -8px;
                                            right: -8px;
                                            background: ${routeColor};
                                            color: white; 
                                            border-radius: 50%; 
                                            width: 18px; 
                                            height: 18px; 
                                            display: flex; 
                                            align-items: center; 
                                            justify-content: center; 
                                            font-size: 11px; 
                                            font-weight: bold;
                                            border: 2px solid white;
                                        ">${index + 1}</span>
                                    </div>`,
                                    iconSize: [35, 35],
                                    iconAnchor: [17, 17]
                                })
                            }).addTo(predefinedMap);

                            // Create detailed popup content
                            const popupContent = createDetailedPOIPopup(poi, index + 1);
                            marker.bindPopup(popupContent, {
                                maxWidth: 300,
                                minWidth: 250,
                                className: 'custom-poi-popup'
                            });

                            predefinedMapLayers.push(marker);
                            bounds.extend(latLng);
                        });
                        
                        console.log('✅ Added', validPois.length, 'POI markers along with route geometry');
                    }
                    
                    // Fit map to combined bounds (route + POIs)
                    predefinedMap.fitBounds(bounds, { padding: [20, 20] });
                    
                    console.log('✅ Route with POIs displayed on predefined map');
                    
                    // Create elevation chart for predefined route with geometry
                    if (window.ElevationChart && coords && coords.length > 1) {
                        if (predefinedElevationChart) {
                            predefinedElevationChart.destroy();
                        }
                        predefinedElevationChart = new ElevationChart('predefinedElevationChartContainer', predefinedMap);
                        
                        // Use elevation_profile from database if available
                        if (route.elevation_profile && route.elevation_profile.points) {
                            console.log('📊 Using pre-calculated elevation profile from database');
                            await predefinedElevationChart.loadElevationProfile(route.elevation_profile);
                        } else {
                            console.log('📊 Calculating elevation profile from geometry');
                            await predefinedElevationChart.loadRouteElevation({
                                geometry: {
                                    coordinates: coords
                                }
                            });
                        }
                    }
                    return;
                }
            }
        }
        // If no geometry, try to display POI markers
        console.log('🔍 No valid geometry found, trying POI markers...');
        if (route.pois && route.pois.length > 0) {
            console.log('🔍 Route has', route.pois.length, 'POIs');
            const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
            console.log('🔍 Valid POIs with coordinates:', validPois.length);

            if (validPois.length > 0) {
                const bounds = L.latLngBounds();

                // Collect coordinates for route line
                const routeCoordinates = [];
                
                validPois.forEach((poi, index) => {
                    const lng = poi.lng !== undefined ? poi.lng : poi.lon;
                    const latLng = [poi.lat, lng];
                    routeCoordinates.push(latLng);
                    
                    // Get category style for this POI
                    const categoryStyle = getCategoryStyle(poi.category || 'diger');
                    
                    const marker = L.marker(latLng, {
                        icon: L.divIcon({
                            className: 'route-poi-marker',
                            html: `<div style="
                                background: ${categoryStyle.color};
                                color: white;
                                width: 35px; 
                                height: 35px; 
                                border-radius: 50%; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-weight: bold;
                                border: 3px solid white;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                                font-size: 16px;
                                position: relative;
                            ">
                                <span style="position: absolute; top: -2px;"><i class="${categoryStyle.icon}"></i></span>
                                <span style="
                                    position: absolute;
                                    bottom: -8px;
                                    right: -8px;
                                    background: ${routeColor};
                                    color: white; 
                                    border-radius: 50%; 
                                    width: 18px; 
                                    height: 18px; 
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: center; 
                                    font-size: 11px; 
                                    font-weight: bold;
                                    border: 2px solid white;
                                ">${index + 1}</span>
                            </div>`,
                            iconSize: [35, 35],
                            iconAnchor: [17, 17]
                        })
                    }).addTo(predefinedMap);

                    // Create detailed popup content
                    const popupContent = createDetailedPOIPopup(poi, index + 1);
                    marker.bindPopup(popupContent, {
                        maxWidth: 300,
                        minWidth: 250,
                        className: 'custom-poi-popup'
                    });

                    predefinedMapLayers.push(marker);
                    bounds.extend(latLng);
                });
                
                // Draw route line connecting POIs if we have more than one point
                if (routeCoordinates.length > 1) {
                    console.log('🛣️ Drawing route line connecting', routeCoordinates.length, 'POIs');

                    const routeLine = L.polyline(routeCoordinates, {
                        color: routeColor,
                        weight: 4,
                        opacity: 0.7,
                        className: 'route-connecting-line',
                        dashArray: '10, 5' // Dashed line to indicate estimated route
                    }).addTo(predefinedMap);

                    // Attach standard route interaction handlers
                    attachPredefinedRouteEvents(routeLine, route);


                    predefinedMapLayers.push(routeLine);

                    console.log('✅ Route line added successfully');
                } else {
                    console.log('ℹ️ Only one POI, no connecting line needed');
                }
                
                // Fit map to POI bounds
                if (bounds.isValid()) {
                    predefinedMap.fitBounds(bounds, { padding: [30, 30] });
                }
                
                console.log('✅ Route POIs displayed on predefined map');
                
                // Create elevation chart for predefined route
                if (window.ElevationChart && validPois.length > 1) {
                    if (predefinedElevationChart) {
                        predefinedElevationChart.destroy();
                    }
                    predefinedElevationChart = new ElevationChart('predefinedElevationChartContainer', predefinedMap);
                    
                    // Use elevation_profile from database if available
                    if (route.elevation_profile && route.elevation_profile.points) {
                        console.log('📊 Using pre-calculated elevation profile from database');
                        await predefinedElevationChart.loadElevationProfile(route.elevation_profile);
                    } else {
                        console.log('📊 Calculating elevation profile from POIs');
                        await predefinedElevationChart.loadRouteElevation({
                            pois: validPois.map(poi => ({
                                name: poi.name,
                                latitude: poi.lat,
                                longitude: poi.lng || poi.lon
                            }))
                        });
                    }
                }
            } else {
                console.warn('⚠️ No valid POI coordinates found');
            }
        } else {
            console.warn('⚠️ Route has no POIs');
        }
        
        // If we reach here, nothing was displayed
        console.warn('⚠️ No route data could be displayed on map - neither geometry nor POIs');
        console.warn('🔍 Route debug info:', {
            hasGeometry: !!route.geometry,
            hasPois: !!(route.pois && route.pois.length > 0),
            geometryType: typeof route.geometry,
            poisCount: route.pois ? route.pois.length : 0
        });
        showNotification('Bu rotada görüntülenecek harita verisi bulunamadı', 'warning');
        
        // At least center the map on Ürgüp
        predefinedMap.setView([38.6436, 34.8128], 13);
        
    } catch (error) {
        console.error('❌ Error displaying route on map:', error);
        showNotification('Rota haritada gösterilirken hata oluştu', 'error');
    }
}

function clearPredefinedMapContent() {
    console.log('🧹 Clearing predefined map content...');
    
    if (predefinedMap && predefinedMapLayers.length > 0) {
        predefinedMapLayers.forEach(layer => {
            try {
                predefinedMap.removeLayer(layer);
            } catch (e) {
                // Layer already removed
            }
        });
        predefinedMapLayers = [];
        console.log('✅ Predefined map content cleared');
    }
}

// Create detailed POI popup content (similar to POI recommendation system)
function createDetailedPOIPopup(poi, stopNumber) {
    const categoryStyle = getCategoryStyle(poi.category || 'diger');
    const categoryName = getCategoryDisplayName(poi.category || 'diger');
    
    // Basic info that's always available
    let popupHTML = `
        <div class="poi-popup-detailed" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 280px;">
            <div class="poi-popup-header" style="display: flex; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                <div class="poi-popup-icon" style="
                    background: ${categoryStyle.color}; 
                    color: white; 
                    width: 35px; 
                    height: 35px; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 16px;
                    margin-right: 10px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                ">
                    <i class="${categoryStyle.icon}"></i>
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
    
    // Add rating if available
    if (poi.rating || poi.average_rating) {
        const rating = poi.rating || poi.average_rating;
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        popupHTML += `
            <div class="poi-popup-rating" style="display: flex; align-items: center; margin-bottom: 6px;">
                <span class="poi-rating-stars" style="color: #ffc107; font-size: 14px; margin-right: 4px;">${stars}</span>
                <span class="poi-rating-value" style="font-size: 12px; color: #555; font-weight: 600;">${rating.toFixed(1)}</span>
            </div>
        `;
    }
    
    // Add estimated time if available
    if (poi.estimated_time_at_poi) {
        popupHTML += `
            <div class="poi-popup-time" style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #555;">
                <i class="fas fa-clock" style="margin-right: 6px; width: 12px; color: #007bff;"></i>
                <span>Tahmini süre: ${poi.estimated_time_at_poi} dakika</span>
            </div>
        `;
    }
    
    // Add notes if available
    if (poi.notes) {
        popupHTML += `
            <div class="poi-popup-notes" style="display: flex; align-items: flex-start; margin-bottom: 8px; font-size: 12px; color: #555;">
                <i class="fas fa-sticky-note" style="margin-right: 6px; width: 12px; color: #28a745; margin-top: 2px;"></i>
                <span style="line-height: 1.3;">${poi.notes}</span>
            </div>
        `;
    }
    
    // Action buttons
    popupHTML += `
            <div class="poi-popup-actions" style="display: flex; gap: 6px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee;">
                <button class="poi-popup-btn poi-popup-btn--secondary" onclick="openInGoogleMaps(${lat}, ${lng}, '${poi.name.replace(/'/g, "\\'")}'); event.stopPropagation();" style="
                    flex: 1; 
                    padding: 6px 8px; 
                    font-size: 11px; 
                    border: 1px solid #6c757d; 
                    background: white; 
                    color: #6c757d; 
                    border-radius: 4px; 
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                ">
                    <i class="fab fa-google" style="font-size: 10px;"></i> Maps
                </button>
                <button class="poi-popup-btn poi-popup-btn--primary" onclick="loadDetailedPOIInfo('${poi.id || poi._id}', '${poi.name.replace(/'/g, "\\'")}'); event.stopPropagation();" style="
                    flex: 1; 
                    padding: 6px 8px; 
                    font-size: 11px; 
                    border: 1px solid #007bff; 
                    background: #007bff; 
                    color: white; 
                    border-radius: 4px; 
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                ">
                    <i class="fas fa-info-circle" style="font-size: 10px;"></i> Detay
                </button>
            </div>
        </div>
    </div>
    `;
    
    return popupHTML;
}

// Trigger detailed POI information display
function showPOIDetails(poiId) {
    const titleEl = document.querySelector(`[data-poi-id="${poiId}"] .poi-title`);
    const poiName = titleEl ? titleEl.textContent.trim() : '';
    loadDetailedPOIInfo(poiId, poiName);
}

// Load detailed POI information (similar to recommendation system)
async function loadDetailedPOIInfo(poiId, poiName) {
    try {
        console.log('🔍 Loading detailed POI info for:', poiId, poiName);
        
        // Show loading notification
        showNotification('POI detayları yükleniyor...', 'info');
        
        // Fetch detailed POI data
        const response = await fetch(`${apiBase}/poi/${poiId}`);
        if (response.ok) {
            const poiData = await response.json();
            console.log('✅ POI details loaded:', poiData);
            
            // Create and show detailed POI modal
            showDetailedPOIModal(poiData);
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error loading POI details:', error);
        showNotification('POI detayları yüklenemedi', 'error');
        
        // Show basic info modal as fallback
        showBasicPOIModal(poiName);
    }
}

// Show detailed POI modal
function showDetailedPOIModal(poi) {
    const categoryStyle = getCategoryStyle(poi.category || 'diger');
    
    // Create modal HTML (similar to route detail modal)
    const modalHTML = `
        <div id="poiDetailModal" class="route-detail-modal" style="display: flex;">
            <div class="route-detail-modal-content">
                <div class="route-detail-modal-header">
                    <h3 class="route-detail-modal-title">
                        <span style="background: ${categoryStyle.color}; padding: 4px 8px; border-radius: 50%; margin-right: 8px;">
                            <i class="${categoryStyle.icon}"></i>
                        </span>
                        ${poi.name}
                    </h3>
                    <button class="route-detail-modal-close" onclick="closeDetailedPOIModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="route-detail-modal-body">
                    <div class="poi-detail-content">
                        <div class="poi-detail-summary">
                            <div class="poi-summary-grid">
                                <div class="summary-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <div>
                                        <span class="summary-label">Konum</span>
                                        <span class="summary-value">${poi.latitude?.toFixed(4)}, ${poi.longitude?.toFixed(4)}</span>
                                    </div>
                                </div>
                                <div class="summary-item">
                                    <i class="fas fa-tag"></i>
                                    <div>
                                        <span class="summary-label">Kategori</span>
                                        <span class="summary-value">${getCategoryDisplayName(poi.category)}</span>
                                    </div>
                                </div>
                                ${poi.rating ? `
                                <div class="summary-item">
                                    <i class="fas fa-star"></i>
                                    <div>
                                        <span class="summary-label">Değerlendirme</span>
                                        <span class="summary-value">${poi.rating.toFixed(1)} ★</span>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${poi.description ? `
                        <div class="poi-detail-description">
                            <h4><i class="fas fa-info-circle"></i> Açıklama</h4>
                            <p>${poi.description}</p>
                        </div>
                        ` : ''}
                        
                        <div class="poi-detail-actions">
                            <button class="poi-action-btn poi-action-btn--google" onclick="openInGoogleMaps(${poi.latitude}, ${poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')">
                                <i class="fab fa-google"></i> Google Maps'te Aç
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('poiDetailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add close functionality
    const modal = document.getElementById('poiDetailModal');
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeDetailedPOIModal();
        }
    };
}

// Show basic POI modal as fallback
function showBasicPOIModal(poiName) {
    const modalHTML = `
        <div id="poiDetailModal" class="route-detail-modal" style="display: flex;">
            <div class="route-detail-modal-content">
                <div class="route-detail-modal-header">
                    <h3 class="route-detail-modal-title">${poiName}</h3>
                    <button class="route-detail-modal-close" onclick="closeDetailedPOIModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="route-detail-modal-body">
                    <div class="poi-detail-content">
                        <p>Bu POI için detaylı bilgi şu anda mevcut değil.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close detailed POI modal
function closeDetailedPOIModal() {
    const modal = document.getElementById('poiDetailModal');
    if (modal) {
        modal.remove();
    }
}
// Fallback function for route display when standard method fails
function displayRouteOnMapFallback(route) {
    console.log('🚨 === FALLBACK ROUTE DISPLAY ===');
    console.log('🔄 Attempting fallback route display for:', route.name);
    
    try {
        // Force map refresh
        if (predefinedMap) {
            predefinedMap.invalidateSize();
            predefinedMap.setView([38.6436, 34.8128], 12);
        }
        
        // Clear any existing content
        clearPredefinedMapContent();
        
        // Try to display POIs if no geometry
        if (route.pois && route.pois.length > 0) {
            console.log('📍 Fallback: Displaying POI markers...');
            const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
            
            if (validPois.length > 0) {
                const bounds = L.latLngBounds();
                const routeCoordinates = [];
                
                validPois.forEach((poi, index) => {
                    const lng = poi.lng !== undefined ? poi.lng : poi.lon;
                    const latLng = [poi.lat, lng];
                    routeCoordinates.push(latLng);
                    
                    // Get category style for this POI (fallback version)
                    const categoryStyle = getCategoryStyle(poi.category || 'diger');
                    
                    // Category-styled marker as fallback
                    const marker = L.marker(latLng, {
                        icon: L.divIcon({
                            className: 'route-poi-marker-fallback',
                            html: `<div style="
                                background: ${categoryStyle.color};
                                color: white;
                                width: 30px; 
                                height: 30px; 
                                border-radius: 50%; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-weight: bold;
                                border: 2px solid white;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                font-size: 14px;
                                position: relative;
                            ">
                                <span style="position: absolute; top: -1px;"><i class="${categoryStyle.icon}"></i></span>
                                <span style="
                                    position: absolute;
                                    bottom: -6px;
                                    right: -6px;
                                    background: #2563eb;
                                    color: white; 
                                    border-radius: 50%; 
                                    width: 16px; 
                                    height: 16px; 
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: center; 
                                    font-size: 10px; 
                                    font-weight: bold;
                                    border: 2px solid white;
                                ">${index + 1}</span>
                            </div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        })
                    }).addTo(predefinedMap);
                    
                    // Create detailed popup content
                    const popupContent = createDetailedPOIPopup(poi, index + 1);
                    marker.bindPopup(popupContent, {
                        maxWidth: 300,
                        minWidth: 250,
                        className: 'custom-poi-popup'
                    });
                    
                    predefinedMapLayers.push(marker);
                    bounds.extend(latLng);
                });
                
                // Draw connecting line for fallback POIs too
                if (routeCoordinates.length > 1) {
                    console.log('🛣️ Fallback: Drawing connecting line between', routeCoordinates.length, 'POIs');
                    
                    const routeLine = L.polyline(routeCoordinates, {
                        color: '#2563eb',
                        weight: 3,
                        opacity: 0.6,
                        className: 'fallback-route-line',
                        dashArray: '15, 10' // More dashed to indicate estimated route
                    }).addTo(predefinedMap);

                    // Attach standard route interaction handlers
                    attachPredefinedRouteEvents(routeLine, route);


                    predefinedMapLayers.push(routeLine);
                    console.log('✅ Fallback connecting line added');
                }
                
                if (bounds.isValid()) {
                    predefinedMap.fitBounds(bounds, { padding: [30, 30] });
                }
                
                console.log('✅ Fallback: POI markers displayed successfully');
                showNotification(`Rota POI'leri ve bağlantı çizgisi görüntülendi (${validPois.length} nokta)`, 'success');
                return;
            }
        }
        
        // If still no success, show a center marker
        console.log('📍 Fallback: Showing center marker...');
        const centerMarker = L.marker([38.6436, 34.8128]).addTo(predefinedMap);
        centerMarker.bindPopup(`
            <div style="text-align: center;">
                <h5 style="margin: 0 0 8px 0;">${route.name}</h5>
                <p style="margin: 0; font-size: 12px; color: #666;">Ürgüp Merkezi</p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #999;">Rota detayları yüklenemedi</p>
            </div>
        `);
        predefinedMapLayers.push(centerMarker);
        predefinedMap.setView([38.6436, 34.8128], 13);
        
        showNotification('Rota merkez noktada gösteriliyor', 'info');
        console.log('✅ Fallback: Center marker displayed');
        
    } catch (error) {
        console.error('❌ Fallback display also failed:', error);
        showNotification('Rota gösterilemedi, lütfen sayfayı yenileyin', 'error');
    }
}

function fitAllRoutesOnMap() {
    console.log('🗺️ Fitting all routes on predefined map...');
    
    if (!predefinedMap || !predefinedMapInitialized) {
        console.warn('⚠️ Predefined map not initialized');
        return;
    }
    
    if (predefinedMapLayers.length === 0) {
        // No routes on map, show default view
        predefinedMap.setView([38.6436, 34.8128], 12);
        return;
    }
    
    try {
        const group = L.featureGroup(predefinedMapLayers);
        predefinedMap.fitBounds(group.getBounds(), { padding: [20, 20] });
        console.log('✅ Map fitted to all routes');
    } catch (error) {
        console.error('❌ Error fitting map to routes:', error);
        predefinedMap.setView([38.6436, 34.8128], 12);
    }
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
        card.addEventListener('click', async () => {
            const route = routes[index];
            await selectPredefinedRoute(route); // handles map rendering internally
            // Show route details after selecting the route
            showPredefinedRouteDetailsPanel(window.currentSelectedRoute || route);
        });
    });
}

function createRouteCard(route) {
    const difficultyStars = createDifficultyStars(route.difficulty_level || 1);
    const duration = Math.round((route.estimated_duration || 0) / 60);
    const distance = (route.total_distance || 0).toFixed(2);
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

async function showRouteDetails(route) {
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

    // Load route details and update map when done
    const detailed = await loadRouteDetails(route, modalBody);
    const detailedRoute = detailed && (detailed.success ? detailed.route : detailed);
    if (detailedRoute) {
        Object.assign(route, detailedRoute);
    }
    await displayRouteOnMap(route);

    // Setup select button with updated route data
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

// Helper to show route details by ID (used by popup actions)
function showRouteDetail(routeId) {
    const route = predefinedRoutes.find(r => (r.id || r._id) === routeId);
    if (route) {
        showRouteDetails(route);
    } else {
        console.error('❌ Route not found for ID:', routeId);
    }
}

async function loadRouteDetails(route, container) {
    console.log('🔄 Loading route details for:', route.id, route.name);
    
    try {
        // Fetch detailed route information including POIs
        const url = `${apiBase}/routes/${route.id}`;
        console.log('📡 Fetching route details from:', url);
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status, response.statusText);

        if (response.ok) {
            const detailedRoute = await response.json();
            console.log('✅ Route details loaded successfully:', detailedRoute);
            console.log('🔍 Route details inspection:', {
                hasGeometry: !!detailedRoute.geometry,
                geometryType: typeof detailedRoute.geometry,
                hasPois: !!(detailedRoute.pois && detailedRoute.pois.length > 0),
                poisCount: detailedRoute.pois ? detailedRoute.pois.length : 0,
                allKeys: Object.keys(detailedRoute)
            });

            // Only attempt to render details if a container is provided
            if (container) {
                displayRouteDetails(detailedRoute, container);
            }

            return detailedRoute;
        } else {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, response.statusText, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ Error loading route details:', error);

        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px; color: #f56565;"></i>
                    <p>Rota detayları yüklenirken hata oluştu.</p>
                    <p style="font-size: 0.9rem; margin-top: 8px;">Lütfen daha sonra tekrar deneyin.</p>
                </div>
            `;
        }


        return null;
    }
}
function displayRouteDetails(routeData, container) {
    // Handle API response structure - API returns {success: true, route: {...}}
    const route = routeData.success ? routeData.route : routeData;
    
    const duration = Math.round((route.estimated_duration || 0) / 60);
    const distance = (route.total_distance || 0).toFixed(2);
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
            
            <div class="route-elevation-section">
                <h4><i class="fas fa-mountain"></i> Yükseklik Profili</h4>
                <div class="route-elevation-container">
                    <div class="elevation-preview-chart" id="elevationPreview_${route.id}">
                        <div class="elevation-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Yükseklik verileri yükleniyor...</span>
                        </div>
                    </div>
                    <div class="elevation-preview-stats" id="elevationStats_${route.id}">
                        <div class="elevation-stat">
                            <span class="stat-label">Min:</span>
                            <span class="stat-value">--m</span>
                        </div>
                        <div class="elevation-stat">
                            <span class="stat-label">Max:</span>
                            <span class="stat-value">--m</span>
                        </div>
                        <div class="elevation-stat">
                            <span class="stat-label">↗ Tırmanış:</span>
                            <span class="stat-value">--m</span>
                        </div>
                        <div class="elevation-stat">
                            <span class="stat-label">↘ İniş:</span>
                            <span class="stat-value">--m</span>
                        </div>
                    </div>
                </div>
            </div>
            
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
    
    // Initialize preview map - POI'ler olsun olmasın her zaman oluştur
    const previewMapContainer = document.getElementById(previewMapId);
    if (previewMapContainer) {
        previewMapContainer.innerHTML = `
            <div class="route-preview-loading">
                <i class="fas fa-spinner"></i>
                Harita yükleniyor...
            </div>
        `;
    }
    
    // DOM'un hazır olduğundan emin olmak için daha uzun bekleme
    setTimeout(() => {
        // Container'ın varlığını kontrol et
        const mapContainer = document.getElementById(previewMapId);
        if (mapContainer) {
            console.log('✅ Preview map container found, initializing map');
            initializeRoutePreviewMap(previewMapId, route.id, pois);
        } else {
            console.error('❌ Preview map container still not found after timeout:', previewMapId);
            // Biraz daha bekle ve tekrar dene
            setTimeout(() => {
                const retryContainer = document.getElementById(previewMapId);
                if (retryContainer) {
                    console.log('✅ Preview map container found on retry, initializing map');
                    initializeRoutePreviewMap(previewMapId, route.id, pois);
                } else {
                    console.error('❌ Preview map container not found even after retry:', previewMapId);
                }
            }, 300);
        }
        
        // Load elevation profile for the route
        loadRouteElevationProfile(route);
    }, 300);
}

// Load elevation profile for route preview
async function loadRouteElevationProfile(route) {
    if (!route || !route.pois || route.pois.length === 0) {
        console.log('⚠️ No POIs available for elevation profile');
        return;
    }
    
    const chartContainerId = `elevationPreview_${route.id}`;
    const statsContainerId = `elevationStats_${route.id}`;
    
    const chartContainer = document.getElementById(chartContainerId);
    const statsContainer = document.getElementById(statsContainerId);
    
    if (!chartContainer || !statsContainer) {
        console.log('⚠️ Elevation containers not found');
        return;
    }
    
    try {
        console.log('🏔️ Loading elevation profile for route:', route.name);
        
        // Create waypoints for elevation data
        const waypoints = route.pois.map(poi => ({
            lat: poi.lat,
            lng: poi.lng || poi.lon,
            name: poi.name,
            category: poi.category || 'diger'
        }));
        
        // Collect elevation data
        const elevationData = [];
        let cumulativeDistance = 0;
        
        for (let i = 0; i < waypoints.length; i++) {
            const poi = waypoints[i];
            
            // Calculate distance from previous point
            if (i > 0) {
                const prevPoi = waypoints[i - 1];
                const segmentDistance = getDistance(
                    prevPoi.lat, prevPoi.lng,
                    poi.lat, poi.lng
                );
                cumulativeDistance += segmentDistance;
            }
            
            // Get elevation
            const elevation = await getElevation(poi.lat, poi.lng);
            
            elevationData.push({
                distance: cumulativeDistance / 1000, // Convert to km
                elevation: elevation,
                name: poi.name,
                lat: poi.lat,
                lng: poi.lng
            });
        }
        
        // Calculate statistics
        const elevations = elevationData.map(d => d.elevation);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        
        let totalAscent = 0;
        let totalDescent = 0;
        
        for (let i = 1; i < elevations.length; i++) {
            const diff = elevations[i] - elevations[i - 1];
            if (diff > 0) {
                totalAscent += diff;
            } else {
                totalDescent += Math.abs(diff);
            }
        }
        
        // Update statistics
        const statElements = statsContainer.querySelectorAll('.elevation-stat .stat-value');
        if (statElements.length >= 4) {
            statElements[0].textContent = `${Math.round(minElevation)}m`;
            statElements[1].textContent = `${Math.round(maxElevation)}m`;
            statElements[2].textContent = `${Math.round(totalAscent)}m`;
            statElements[3].textContent = `${Math.round(totalDescent)}m`;
        }
        
        // Create mini chart
        createMiniElevationChart(chartContainerId, elevationData);
        
    } catch (error) {
        console.error('❌ Error loading elevation profile:', error);
        chartContainer.innerHTML = `
            <div class="elevation-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Yükseklik verileri yüklenemedi</span>
            </div>
        `;
    }
}

// Create mini elevation chart for preview
function createMiniElevationChart(containerId, elevationData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Create canvas
    container.innerHTML = '<canvas id="miniChart_' + containerId + '" width="300" height="100"></canvas>';
    const canvas = document.getElementById('miniChart_' + containerId);
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Prepare data
    const distances = elevationData.map(d => d.distance.toFixed(1));
    const elevations = elevationData.map(d => d.elevation);
    const names = elevationData.map(d => d.name);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: distances,
            datasets: [{
                label: 'Yükseklik (m)',
                data: elevations,
                borderColor: '#4285f4',
                backgroundColor: 'rgba(66, 133, 244, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const index = tooltipItems[0].dataIndex;
                            return names[index];
                        },
                        label: function(context) {
                            return `Yükseklik: ${context.parsed.y}m`;
                        },
                        afterLabel: function(context) {
                            return `Mesafe: ${context.label}km`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    title: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    ticks: {
                        font: { size: 10 },
                        callback: function(value) {
                            return value + 'm';
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
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
    console.log('🚀 === STARTING ROUTE SELECTION PROCESS ===');
    
    // Store the route globally for panel access
    window.currentSelectedRoute = route;
    console.log('✅ Selecting predefined route:', route);
    console.log('🔍 Initial route data check:', {
        hasId: !!route.id,
        hasName: !!route.name,
        hasGeometry: !!route.geometry,
        hasPois: !!(route.pois && route.pois.length > 0),
        poisCount: route.pois ? route.pois.length : 0
    });

    // Ensure detailed data is present before displaying
    if (!route.geometry || !route.pois || route.pois.length === 0) {
        try {
            console.log('⏳ Route missing details, loading before selection...');
            console.log('🔍 Attempting to load route details via API...');
            
            // Try multiple methods to get route data
            let detailedRoute = null;
            
            // Method 1: Standard route details API + geometry API (same as preview)
            try {
                const detailed = await loadRouteDetails(route);
                detailedRoute = detailed && (detailed.success ? detailed.route : detailed);
                
                if (detailedRoute) {
                    console.log('✅ API route data loaded successfully');
                    
                    // CRITICAL: Load actual route geometry (same as preview map)
                    try {
                        console.log('🗺️ Loading actual route geometry for main map...');
                        const geometryResponse = await fetch(`${apiBase}/routes/${route.id}/geometry`);
                        if (geometryResponse.ok) {
                            const geometryData = await geometryResponse.json();
                            console.log('📍 Main map geometry data:', geometryData);
                            
                            let geometry = geometryData.geometry || geometryData;
                            
                            // String ise parse et
                            if (typeof geometry === 'string') {
                                try {
                                    geometry = JSON.parse(geometry);
                                } catch (e) {
                                    console.warn('Geometry parse error:', e);
                                }
                            }
                            
                            // Geometry'yi detailedRoute'a ekle
                            if (geometry && geometry.type === 'LineString' && geometry.coordinates) {
                                detailedRoute.geometry = geometry;
                                console.log('✅ Added LineString geometry to route');
                            } else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
                                detailedRoute.geometry = geometry.geometry;
                                console.log('✅ Added nested geometry to route');
                            } else if (geometryData.success && geometryData.geometry) {
                                detailedRoute.geometry = geometryData.geometry;
                                console.log('✅ Added API geometry to route');
                            }
                        }
                    } catch (geometryError) {
                        console.warn('⚠️ Could not load route geometry:', geometryError);
                    }
                } else {
                    console.warn('⚠️ API returned empty or invalid data');
                }
            } catch (apiError) {
                console.warn('⚠️ Standard API failed:', apiError);
                console.warn('🔍 API URL attempted:', `${apiBase}/routes/${route.id}`);
            }
            
            // Method 2: If standard API fails, try to use existing route data or create mock data
            if (!detailedRoute || (!detailedRoute.geometry && (!detailedRoute.pois || detailedRoute.pois.length === 0))) {
                console.log('🔄 Creating intelligent fallback route data...');
                
                // Try to extract geographical information from route name
                const routeName = route.name || 'Bilinmeyen Rota';
                console.log('🔍 Analyzing route name for locations:', routeName);
                
                // Cappadocia area coordinates for common locations
                const knownLocations = {
                    'göreme': { lat: 38.6427, lng: 34.8283, name: 'Göreme' },
                    'uçhisar': { lat: 38.6361, lng: 34.8106, name: 'Uçhisar' },
                    'avanos': { lat: 38.7151, lng: 34.8403, name: 'Avanos' },
                    'ürgüp': { lat: 38.6436, lng: 34.8128, name: 'Ürgüp' },
                    'ortahisar': { lat: 38.6425, lng: 34.8594, name: 'Ortahisar' },
                    'çavuşin': { lat: 38.6533, lng: 34.8378, name: 'Çavuşin' },
                    'pasabag': { lat: 38.6772, lng: 34.8458, name: 'Paşabağ' },
                    'güvercinlik': { lat: 38.6469, lng: 34.8044, name: 'Güvercinlik Vadisi' },
                    'love valley': { lat: 38.6612, lng: 34.8258, name: 'Love Valley' },
                    'rose valley': { lat: 38.6453, lng: 34.8361, name: 'Rose Valley' },
                    'devrent': { lat: 38.6753, lng: 34.8461, name: 'Devrent Vadisi' }
                };
                
                const mockPois = [];
                const routeNameLower = routeName.toLowerCase();
                
                // Find matching locations in route name
                let foundAny = false;
                Object.keys(knownLocations).forEach(locationKey => {
                    if (routeNameLower.includes(locationKey)) {
                        const location = knownLocations[locationKey];
                        mockPois.push({
                            id: `${route.id}_${locationKey}`,
                            name: location.name,
                            lat: location.lat,
                            lng: location.lng,
                            category: 'landmark',
                            description: `${location.name} - ${routeName} rotası durağı`
                        });
                        foundAny = true;
                    }
                });
                
                // If no specific locations found, add Ürgüp center
                if (!foundAny) {
                    mockPois.push({
                        id: `${route.id}_center`,
                        name: routeName,
                        lat: 38.6436,
                        lng: 34.8128,
                        category: 'landmark',
                        description: 'Rota merkez noktası - Ürgüp'
                    });
                }
                
                detailedRoute = {
                    ...route,
                    pois: mockPois,
                    geometry: null, // Will use POI markers instead
                    total_distance: route.total_distance || Math.random() * 10 + 2, // Random distance 2-12 km
                    estimated_duration: route.estimated_duration || Math.floor(Math.random() * 240 + 60) // Random 60-300 minutes
                };
                
                console.log('✅ Intelligent fallback route data created with', mockPois.length, 'POIs:', detailedRoute);
            }
            
            if (detailedRoute) {
                console.log('✅ Route details obtained:', detailedRoute);
                
                // If still no geometry but we have POIs, try smart routing API (same as preview)
                if (!detailedRoute.geometry && detailedRoute.pois && detailedRoute.pois.length > 1) {
                    try {
                        console.log('🛣️ No geometry found, trying smart routing API...');
                        const waypointPayload = detailedRoute.pois
                            .filter(poi => poi.lat && (poi.lng || poi.lon))
                            .map(p => ({
                                lat: parseFloat(p.lat),
                                lng: parseFloat(p.lng || p.lon),
                                name: p.name || ''
                            }));
                            
                        if (waypointPayload.length > 1) {
                            const smartRouteResponse = await fetch(`${apiBase}/route/smart`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ waypoints: waypointPayload })
                            });
                            
                            if (smartRouteResponse.ok) {
                                const smartRouteData = await smartRouteResponse.json();
                                if (smartRouteData.success && smartRouteData.route && smartRouteData.route.segments && smartRouteData.route.segments.length > 0) {
                                    // Convert smart route coordinates to LineString geometry
                                    const coordinates = smartRouteData.route.segments[0].coordinates.map(c => [c.lng, c.lat]);
                                    detailedRoute.geometry = {
                                        type: 'LineString',
                                        coordinates: coordinates
                                    };
                                    console.log('✅ Smart route geometry added with', coordinates.length, 'points');
                                }
                            }
                        }
                    } catch (smartRouteError) {
                        console.warn('⚠️ Smart routing failed:', smartRouteError);
                    }
                }
                
                Object.assign(route, detailedRoute);
            } else {
                console.warn('⚠️ No route data could be obtained');
            }
        } catch (error) {
            console.error('❌ Error loading route details for selection:', error);
            
            // Create emergency fallback data
            console.log('🚨 Creating emergency fallback data...');
            route.pois = [{
                id: `${route.id}_emergency`,
                name: route.name || 'Bilinmeyen Rota',
                lat: 38.6436,
                lng: 34.8128,
                category: 'landmark',
                description: 'Rota verisi yüklenemedi'
            }];
            
            showNotification('Rota detayları yüklenemedi, merkez nokta gösteriliyor', 'warning');
        }
    }

    console.log('🔍 Final route data before display:', {
        hasGeometry: !!route.geometry,
        geometryType: typeof route.geometry,
        hasPois: !!(route.pois && route.pois.length > 0),
        poisCount: route.pois ? route.pois.length : 0,
        firstPoi: route.pois && route.pois[0] ? route.pois[0] : null
    });

    // Close modal after data loading
    closeRouteDetailModal();

    // Show notification with Google Maps option
             // Check if this is a hiking route for different export options
         const routeName = (route.name || '').toLowerCase();
         const isHikingRoute = route.route_type === 'hiking' || 
                              route.route_type === 'walking' || // walking routes are often hiking trails
                              routeName.includes('yürüyüş') || 
                              routeName.includes('patika') ||
                              routeName.includes('vadisi') ||   // valley trails
                              routeName.includes('valley') ||
                              routeName.includes('wikiloc') ||  // wikiloc = hiking trails
                              routeName.includes('trail') ||
                              routeName.includes('trek') ||
                              routeName.includes('hiking') ||
                              routeName.includes('güvercinlik') || // pigeon valley
                              routeName.includes('pigeon') ||
                              routeName.includes('kale') ||     // castle trails  
                              routeName.includes('castle');
         
         // DEBUG: Log route information for debugging
         console.log('🔍 ROUTE DEBUG INFO:');
         console.log('📍 Route name:', route.name);
         console.log('🏷️ Route type:', route.route_type);
         console.log('🥾 Is hiking route?', isHikingRoute);
         console.log('📝 Route name (lowercase):', route.name?.toLowerCase());
         console.log('🔎 Contains "yürüyüş"?', route.name?.toLowerCase().includes('yürüyüş'));
         console.log('🔎 Contains "patika"?', route.name?.toLowerCase().includes('patika'));
         console.log('🗺️ Full route object:', route);
         
         // Simple approach: Always show single Google Maps button
         showNotificationWithAction(
             `✅ "${route.name}" rotası haritada gösteriliyor!`,
             'success',
             'Google Maps\'te Aç',
             () => exportPredefinedRouteToGoogleMaps(route.id || route._id)
         );
         
         // Add navigation route from current location to route start
         addNavigationToRoute(route);
    
    // Ensure predefined map is initialized with multiple attempts
    let mapInitAttempts = 0;
    const maxAttempts = 3;
    
    while (!predefinedMapInitialized && mapInitAttempts < maxAttempts) {
        mapInitAttempts++;
        console.log(`🗺️ Map initialization attempt ${mapInitAttempts}/${maxAttempts}...`);
        
        try {
            const success = await initializePredefinedMap();
            if (success) {
                console.log('✅ Map initialized successfully');
                break;
            } else {
                console.warn(`⚠️ Map initialization attempt ${mapInitAttempts} failed`);
            }
        } catch (error) {
            console.error(`❌ Map initialization attempt ${mapInitAttempts} error:`, error);
        }
        
        if (mapInitAttempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
        }
    }
    
    if (!predefinedMapInitialized) {
        console.error('❌ Failed to initialize map after all attempts');
        showNotification('Harita başlatılamadı. Sayfayı yenileyin.', 'error');
        return;
    }
    
    // Multiple approach for displaying route with fallbacks
    const displayRoute = async () => {
        console.log('🎯 Starting route display process...');
        
        // Approach 1: Standard display with delays
        setTimeout(async () => {
            try {
                console.log('📍 Attempt 1: Standard route display with timing fix...');
                
                // Force map container visibility
                const mapContainer = document.getElementById('predefinedRoutesMap');
                if (mapContainer) {
                    mapContainer.style.display = 'block';
                    mapContainer.style.visibility = 'visible';
                    mapContainer.style.opacity = '1';
                    console.log('✅ Map container visibility forced');
                }
                
                // Force map size refresh
                if (predefinedMap) {
                    predefinedMap.invalidateSize();
                    setTimeout(() => predefinedMap.invalidateSize(), 100);
                    setTimeout(() => predefinedMap.invalidateSize(), 500);
                    console.log('🔄 Map size invalidated multiple times');
                }
                
                // Display route
                await displayRouteOnMap(route);
                
                // Verify display after a moment
                setTimeout(() => {
                    console.log('🔍 Verifying route display...');
                    console.log('Map layers count:', predefinedMapLayers.length);
                    if (predefinedMapLayers.length === 0) {
                        console.warn('⚠️ No layers found, attempting fallback display...');
                        displayRouteOnMapFallback(route);
                    }
                }, 1000);
                
            } catch (error) {
                console.error('❌ Error in standard route display:', error);
                displayRouteOnMapFallback(route);
            }
        }, 500); // Increased delay for modal animation
    };
    
    await displayRoute();
    
    // Store selected route for reference
    window.currentSelectedRoute = route;
    
    console.log('🏁 === ROUTE SELECTION PROCESS COMPLETED ===');
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
                        <span style="color: #666;"><i class="fas fa-map-marker-alt"></i> ${(route.total_distance || 0).toFixed(2)} km</span>
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
                <span style="color: #666;"><i class="fas fa-map-marker-alt"></i> ${(route.total_distance || 0).toFixed(2)} km</span>
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
                            <span style="transform: rotate(45deg);"><i class="${categoryStyle.icon}"></i></span>
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
    
    // Draw simple fallback line only if there is no saved/smart route on the map
    if (routeCoordinates.length > 1) {
        const hasRealRouteLayer = (() => {
            let found = false;
            if (!map) return false;
            map.eachLayer(layer => {
                if (found) return;
                if (layer && layer.options && (layer.options.className === 'saved-route' || layer.options.className === 'walking-route')) {
                    found = true;
                }
            });
            return found;
        })();

        if (!hasRealRouteLayer) {
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
        } else {
            // Ensure any previous simple fallback line is removed when a real route exists
            if (window.simpleRouteLayer && map.hasLayer(window.simpleRouteLayer)) {
                map.removeLayer(window.simpleRouteLayer);
                window.simpleRouteLayer = null;
            }
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
    // Return existing promise if initialization is already in progress
    if (mapInitializationPromise) {
        console.log('🔄 Map initialization already in progress, waiting...');
        return await mapInitializationPromise;
    }
    
    // Check if map is already initialized and valid
    if (map && map._container && mapInitialized) {
        console.log('✅ Main map already initialized');
        map.invalidateSize(); // Ensure proper sizing
        return true;
    }
    
    // Create new initialization promise
    mapInitializationPromise = performMainMapInitialization();
    
    try {
        const result = await mapInitializationPromise;
        mapInitialized = result;
        return result;
    } finally {
        // Clear the promise once complete
        mapInitializationPromise = null;
    }
}

async function performMainMapInitialization() {
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
    
    // Wait a bit for the container to be visible (optimized timing)
    await new Promise(resolve => addTimeout(resolve, 50));
    
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
        
        // Initialize map with performance optimizations
        map = L.map('mapContainer', {
            zoomControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            dragging: true,
            tap: true,
            tapTolerance: 15,
            worldCopyJump: false,
            maxBoundsViscosity: 0.0,
            preferCanvas: true, // Use Canvas renderer for better performance
            renderer: L.canvas(), // Explicit canvas renderer
            zoomAnimation: true, // Enable zoom animations
            fadeAnimation: true, // Enable fade animations
            markerZoomAnimation: true // Enable marker zoom animations
        }).setView([38.632, 34.912], 13);
        
        // Add base layers
        addBaseLayers(map);
        
        // Clear markers array
        markers = [];
        
        // Force map to resize after initialization
        addTimeout(() => {
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

async function initializeRoutePreviewMap(mapId, routeId, pois) {
    console.log('🗺️ Initializing route preview map:', mapId, 'routeId:', routeId, 'with', pois.length, 'POIs');
    
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
        
        // Add base layers
        addBaseLayers(previewMap);
        
        // Store the map
        previewMaps.set(mapId, previewMap);
        
        // Add POI markers
        const validPOIs = pois.filter(poi => {
            const lat = parseFloat(poi.lat);
            const lon = parseFloat(poi.lon);
            return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
        });
        
        if (validPOIs.length === 0) {
            console.log('ℹ️ No valid POIs for preview map, will try to load route geometry');
        }
        
        const routeCoordinates = [];
        
        // POI marker'larını sadece POI'ler varsa ekle
        if (validPOIs.length > 0) {
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
        }
        
        // Try to load actual route geometry - Hibrit yaklaşım
        let geometryLatLngs = null;
        if (routeId) {
            try {
                console.log('🗺️ Loading preview route geometry for route:', routeId);
                const response = await (window.rateLimitedFetch || fetch)(`${apiBase}/routes/${routeId}/geometry`);
                if (response.ok) {
                    const geometryData = await response.json();
                    console.log('📍 Preview geometry data:', geometryData);
                    
                    let geometry = geometryData.geometry || geometryData;
                    
                    // String ise parse et
                    if (typeof geometry === 'string') {
                        try {
                            geometry = JSON.parse(geometry);
                        } catch (e) {
                            console.warn('Preview geometry parse error:', e);
                        }
                    }
                    
                    // Hibrit geometri işleme
                    if (geometry && geometry.type === 'LineString' && geometry.coordinates) {
                        // Statik LineString
                        geometryLatLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        console.log('✅ Preview using static LineString geometry');
                    } else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
                        // Nested geometry
                        geometryLatLngs = geometry.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        console.log('✅ Preview using nested geometry');
                    } else if (geometryData.success && geometryData.geometry) {
                        // Standard API response
                        const geo = geometryData.geometry;
                        if (geo.type === 'LineString' && geo.coordinates) {
                            geometryLatLngs = geo.coordinates.map(coord => [coord[1], coord[0]]);
                            console.log('✅ Preview using standard API geometry');
                        }
                    }
                    
                    if (geometryLatLngs && geometryLatLngs.length > 0) {
                        L.polyline(geometryLatLngs, {
                            color: '#4ecdc4',
                            weight: 3,
                            opacity: 0.8,
                            className: 'saved-route'
                        }).addTo(previewMap);
                        console.log('✅ Preview route geometry added to map');
                    } else {
                        console.log('⚠️ No valid geometry found for preview');
                    }
                } else {
                    console.log('ℹ️ No geometry response for preview:', response.status);
                }
            } catch (error) {
                console.error('❌ Error loading preview route geometry:', error);
            }
        }

        // If geometry still not loaded, request smart route from API for road network
        if (!geometryLatLngs && routeCoordinates.length > 1) {
            try {
                const waypointPayload = validPOIs.map(p => ({
                    lat: parseFloat(p.lat),
                    lng: parseFloat(p.lon),
                    name: p.name || ''
                }));

                const resp = await fetch(`${apiBase}/route/smart`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ waypoints: waypointPayload })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success && data.route && data.route.segments && data.route.segments.length > 0) {
                        geometryLatLngs = data.route.segments[0].coordinates.map(c => [c.lat, c.lng]);
                        L.polyline(geometryLatLngs, {
                            color: '#4ecdc4',
                            weight: 4,
                            opacity: 0.8,
                            className: 'saved-route'
                        }).addTo(previewMap);

                        // Update distance info in preview overlay if available
                        if (data.route.total_distance) {
                            const distanceSpan = mapContainer.querySelector('.route-preview-info span:nth-child(2)');
                            if (distanceSpan) {
                                distanceSpan.innerHTML = `<i class="fas fa-route"></i> ${data.route.total_distance} km`;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Error fetching smart route for preview:', err);
            }
        }

        // Draw simple straight lines only if no geometry could be loaded
        if (!geometryLatLngs && routeCoordinates.length > 1) {
            L.polyline(routeCoordinates, {
                color: '#007bff',
                weight: 2,
                opacity: 0.8
            }).addTo(previewMap);
        }

        // Fit map to show the route
        if (geometryLatLngs && geometryLatLngs.length > 0) {
            const bounds = L.latLngBounds(geometryLatLngs);
            previewMap.fitBounds(bounds, { padding: [10, 10] });
            console.log('✅ Preview map fitted to geometry bounds');
        } else if (validPOIs.length === 1) {
            const poi = validPOIs[0];
            previewMap.setView([parseFloat(poi.lat), parseFloat(poi.lon)], 14);
            console.log('✅ Preview map centered on single POI');
        } else if (routeCoordinates.length > 0) {
            const bounds = L.latLngBounds(routeCoordinates);
            previewMap.fitBounds(bounds, { padding: [10, 10] });
            console.log('✅ Preview map fitted to POI bounds');
        } else {
            // POI'ler de geometri de yoksa varsayılan konum (Ürgüp)
            previewMap.setView([38.6322, 34.9115], 12);
            console.log('ℹ️ Preview map set to default location (no POIs or geometry)');
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
        
        const response = await (window.rateLimitedFetch || fetch)(`${apiBase}/routes/${routeId}/geometry`);
        
        if (response.ok) {
            const geometryData = await response.json();
            console.log('✅ Route geometry API response (RAW):', JSON.stringify(geometryData, null, 2));
            console.log('✅ Response keys:', Object.keys(geometryData));
            console.log('✅ Success field:', geometryData.success);
            console.log('✅ Geometry field:', geometryData.geometry);

            // Hibrit yaklaşım - farklı response formatlarını destekle
            let processed = false;
            
            if (geometryData.success && geometryData.geometry) {
                console.log('📍 Using standard API response format');
                displaySavedRouteGeometry(geometryData);
                processed = true;
            } else if (geometryData.geometry) {
                console.log('📍 Using direct geometry response');
                displaySavedRouteGeometry(geometryData);
                processed = true;
            } else if (geometryData.type === 'LineString') {
                console.log('📍 Using direct GeoJSON response');
                displaySavedRouteGeometry({ geometry: geometryData });
                processed = true;
            } else {
                console.log('ℹ️ Geometri formatı tanınmadı, tüm alanları kontrol ediliyor...');
                
                // Tüm olası alanları kontrol et
                for (const [key, value] of Object.entries(geometryData)) {
                    console.log(`🔍 Checking field "${key}":`, value);
                    
                    if (value && typeof value === 'object') {
                        if (value.type === 'LineString' && value.coordinates) {
                            console.log(`📍 Found LineString in field "${key}"`);
                            displaySavedRouteGeometry({ geometry: value });
                            processed = true;
                            break;
                        } else if (value.geometry && value.geometry.type === 'LineString') {
                            console.log(`📍 Found nested geometry in field "${key}"`);
                            displaySavedRouteGeometry(value);
                            processed = true;
                            break;
                        }
                    }
                }
                
                if (!processed) {
                    console.log('❌ Hiçbir geometri formatı bulunamadı');
                    showNotification('⚠️ Rota geometrisi bulunamadı. POI\'ler arası düz çizgiler gösteriliyor.', 'warning');
                }
            }
            
            return processed;
        } else {
            console.log('ℹ️ No saved geometry found for route:', routeId, 'Status:', response.status);
            const errorText = await response.text();
            console.log('❌ Error response:', errorText);
            showNotification('⚠️ Rota geometrisi bulunamadı. POI\'ler arası düz çizgiler gösteriliyor.', 'warning');
        }
    } catch (error) {
        console.error('❌ Error loading route geometry:', error);
        showNotification('⚠️ Rota geometrisi yüklenirken hata oluştu. POI\'ler arası düz çizgiler gösteriliyor.', 'warning');
    }
    
    return false;
}

// Display saved route geometry on map - Hibrit yaklaşım
function displaySavedRouteGeometry(geometryData) {
    if (!map) {
        console.error('❌ Map not initialized!');
        return;
    }
    
    console.log('🎨 Displaying saved route geometry - Hibrit yaklaşım');
    console.log('📍 Ham geometri verisi (FULL):', JSON.stringify(geometryData, null, 2));
    console.log('📍 geometryData keys:', Object.keys(geometryData));
    console.log('📍 geometryData.geometry:', geometryData.geometry);
    
    // Remove existing route layers and any simple fallback line
    map.eachLayer(function(layer) {
        if (layer.options && (layer.options.className === 'saved-route' || layer.options.className === 'walking-route' || layer.options.className === 'simple-route-layer')) {
            map.removeLayer(layer);
        }
    });
    if (window.simpleRouteLayer && map.hasLayer(window.simpleRouteLayer)) {
        map.removeLayer(window.simpleRouteLayer);
        window.simpleRouteLayer = null;
    }
    
    // Remove simple route layer if it exists to avoid overlap
    if (window.simpleRouteLayer) {
        map.removeLayer(window.simpleRouteLayer);
        window.simpleRouteLayer = null;
    }
    
    try {
        let geometry = geometryData.geometry || geometryData;
        console.log('🔍 Extracted geometry:', geometry);
        console.log('🔍 Geometry type:', typeof geometry);
        
        // String ise parse et
        if (typeof geometry === 'string') {
            console.log('🔍 Parsing string geometry:', geometry);
            try {
                geometry = JSON.parse(geometry);
                console.log('✅ Parsed geometry:', geometry);
            } catch (e) {
                console.warn('❌ Geometry JSON parse hatası:', e);
                return;
            }
        }
        
        let latlngs = null;
        let routeType = 'unknown';
        
        console.log('🔍 Final geometry for processing:', geometry);
        console.log('🔍 Geometry keys:', geometry ? Object.keys(geometry) : 'null');
        console.log('🔍 Geometry.type:', geometry?.type);
        console.log('🔍 Geometry.coordinates:', geometry?.coordinates);
        
        // YAKLAŞIM 1: Statik LineString geometrisi (klasik)
        if (geometry && geometry.type === 'LineString' && geometry.coordinates && geometry.coordinates.length > 0) {
            console.log('✅ Statik LineString geometrisi kullanılıyor');
            console.log('📍 Coordinates count:', geometry.coordinates.length);
            console.log('📍 First coordinate:', geometry.coordinates[0]);
            latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            routeType = 'static';
            console.log('📍 Converted latlngs:', latlngs.slice(0, 3), '...');
        }
        // YAKLAŞIM 2: API response formatı (nested geometry)
        else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
            console.log('✅ Nested LineString geometrisi kullanılıyor');
            const coords = geometry.geometry.coordinates;
            if (coords && coords.length > 0) {
                console.log('📍 Nested coordinates count:', coords.length);
                latlngs = coords.map(coord => [coord[1], coord[0]]);
                routeType = 'nested';
            }
        }
        // YAKLAŞIM 3: POI-based dinamik rota (waypoints)
        else if (geometry && geometry.waypoints && Array.isArray(geometry.waypoints) && geometry.waypoints.length > 0) {
            console.log('✅ POI-based waypoints kullanılıyor');
            latlngs = geometry.waypoints.map(wp => [wp.lat || wp.latitude, wp.lng || wp.longitude]);
            routeType = 'waypoints';
        }
        // YAKLAŞIM 4: Koordinat dizisi (basit format)
        else if (Array.isArray(geometry) && geometry.length > 0 && geometry[0] && geometry[0].length === 2) {
            console.log('📍 Basit koordinat dizisi kullanılıyor');
            latlngs = geometry;
            routeType = 'simple';
        }
        
        // Rota çizgisini oluştur
        if (latlngs && latlngs.length > 1) {
            console.log('✅ Creating route line with', latlngs.length, 'points');
            console.log('📍 Route type:', routeType);
            console.log('📍 Sample coordinates:', latlngs.slice(0, 3));
            
            // Rota tipine göre stil belirle
            const routeStyles = {
                'static': { color: '#4ecdc4', weight: 4, opacity: 0.8, dashArray: null },
                'nested': { color: '#4ecdc4', weight: 4, opacity: 0.8, dashArray: null },
                'waypoints': { color: '#ff6b6b', weight: 4, opacity: 0.8, dashArray: '8,4' },
                'simple': { color: '#95a5a6', weight: 3, opacity: 0.7, dashArray: '5,5' }
            };
            
            const style = routeStyles[routeType] || routeStyles['simple'];
            console.log('🎨 Using style:', style);
            
            // Create route line
            let routeLine = null;
            try {
                routeLine = L.polyline(latlngs, {
                    ...style,
                    className: 'saved-route'
                }).addTo(map);
                
                console.log('✅ Route line added to map successfully');
                
                // Add popup with route info
                const distance = geometryData.total_distance ? `${geometryData.total_distance.toFixed(2)} km` : 'Bilinmiyor';
                const duration = geometryData.estimated_duration ? `${geometryData.estimated_duration} dk` : 'Bilinmiyor';
                
                // Rota tipine göre popup mesajı
                const routeTypeMessages = {
                    'static': '✅ Statik rota geometrisi',
                    'nested': '✅ API rota geometrisi', 
                    'waypoints': '🔗 POI-based dinamik rota',
                    'simple': '📍 Basit koordinat rotası'
                };
                
                routeLine.bindPopup(`
                    <div style="text-align: center;">
                        <strong>📍 Kaydedilmiş Rota (${routeType})</strong><br>
                        <small>Mesafe: ${distance}</small><br>
                        <small>Süre: ${duration}</small><br>
                        <small style="color: ${style.color};">${routeTypeMessages[routeType]}</small>
                    </div>
                `);
                
                console.log(`✅ ${routeType} rota geometrisi başarıyla gösterildi`);
                
                // Show success notification
                showNotification(`✅ ${routeTypeMessages[routeType]} gösteriliyor`, 'success');
                
                // Haritayı rotaya odakla
                setTimeout(() => {
                    if (routeLine) {
                        map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
                    }
                }, 100);
                
            } catch (error) {
                console.error('❌ Error creating route line:', error);
                return;
            }
            
        } else {
            console.warn('⚠️ Hiçbir geometri formatı işlenemedi:', geometry);
            showNotification('⚠️ Rota geometrisi işlenemedi', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error displaying saved route geometry:', error);
    }
}
// Try to load smart road-network route for a set of POIs (fallback when saved geometry missing)
async function tryLoadSmartRouteForPOIs(pois) {
    try {
        if (!pois || pois.length < 2) return false;

        const waypointPayload = pois
            .filter(p => p.lat && p.lon && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lon)))
            .map(p => ({
                lat: parseFloat(p.lat),
                lng: parseFloat(p.lon),
                name: p.name || ''
            }));

        if (waypointPayload.length < 2) return false;

        const resp = await fetch(`${apiBase}/route/smart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waypoints: waypointPayload })
        });

        if (!resp.ok) return false;
        const data = await resp.json();

        // Preferred successful format
        if (data.success && data.route && Array.isArray(data.route.segments) && data.route.segments.length > 0) {
            const coords = data.route.segments[0].coordinates.map(c => [c.lat, c.lng]);
            // Remove simple fallback line if present
            if (window.simpleRouteLayer && map && map.hasLayer(window.simpleRouteLayer)) {
                try { map.removeLayer(window.simpleRouteLayer); } catch (_) {}
                window.simpleRouteLayer = null;
            }
            const line = L.polyline(coords, {
                color: '#4ecdc4',
                weight: 5,
                opacity: 0.85,
                className: 'walking-route'
            }).addTo(map);
            setTimeout(() => map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 16 }), 50);
            return true;
        }

        // Fallback format: route with plain coordinates list
        if (data.route && Array.isArray(data.route.coordinates) && data.route.coordinates.length > 1) {
            const coords = data.route.coordinates.map(c => [c[1], c[0]]);
            if (window.simpleRouteLayer && map && map.hasLayer(window.simpleRouteLayer)) {
                try { map.removeLayer(window.simpleRouteLayer); } catch (_) {}
                window.simpleRouteLayer = null;
            }
            const line = L.polyline(coords, {
                color: '#4ecdc4',
                weight: 5,
                opacity: 0.85,
                className: 'walking-route'
            }).addTo(map);
            setTimeout(() => map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 16 }), 50);
            return true;
        }

        return false;
    } catch (e) {
        console.warn('Smart route fallback failed:', e);
        return false;
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
        
        // Stay in predefined routes tab and show route on its own map
        // No tab switching needed - use the predefined routes map
        
        // Ensure predefined map is initialized
        if (!predefinedMapInitialized) {
            console.log('🗺️ Predefined map not initialized, initializing for route preview...');
            await initializePredefinedMap();
        }
        
        // Show route on predefined routes map (left side)
        await displayRouteOnMap(route);
        
        // Show notification
        showNotification(`📍 "${routeName}" rotası haritada gösteriliyor`, 'success');
        
    } catch (error) {
        console.error('❌ Error expanding route preview:', error);
        showNotification('Rota haritada gösterilirken hata oluştu', 'error');
    }
}

// Memory management and cleanup utilities
function addTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        AppState.timeouts.delete(timeoutId);
        callback();
    }, delay);
    AppState.timeouts.add(timeoutId);
    return timeoutId;
}

function addInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    AppState.intervals.add(intervalId);
    return intervalId;
}

function clearAllTimeouts() {
    AppState.timeouts.forEach(id => clearTimeout(id));
    AppState.timeouts.clear();
}

function clearAllIntervals() {
    AppState.intervals.forEach(id => clearInterval(id));
    AppState.intervals.clear();
}

// Global cleanup function
function cleanupApplication() {
    console.log('🧹 Performing application cleanup...');
    
    try {
        // Clear all timeouts and intervals
        clearAllTimeouts();
        clearAllIntervals();
        
        // Cancel active requests
        AppState.activeRequests.forEach(controller => {
            if (controller && typeof controller.abort === 'function') {
                controller.abort();
            }
        });
        AppState.activeRequests.clear();
        
        // Clean up elevation charts
        if (dynamicElevationChart) {
            dynamicElevationChart.destroy();
            dynamicElevationChart = null;
        }
        
        if (predefinedElevationChart) {
            predefinedElevationChart.destroy();
            predefinedElevationChart = null;
        }
        
        // Clean up maps
        if (map) {
            map.remove();
            map = null;
        }
        
        if (predefinedMap) {
            predefinedMap.remove();
            predefinedMap = null;
        }
        
        // Clear caches
        mediaCache = {};
        
        // Reset state variables
        markers = [];
        selectedPOIs = [];
        predefinedRoutes = [];
        filteredRoutes = [];
        predefinedMapLayers = [];
        predefinedMapInitialized = false;
        
        console.log('✅ Application cleanup completed');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Enhanced error handling wrapper
function withErrorHandling(fn, context = 'Operation') {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error(`❌ Error in ${context}:`, error);
            showNotification(`${context} sırasında hata oluştu`, 'error');
            throw error; // Re-throw for handling upstream if needed
        }
    };
}

// Page unload cleanup
window.addEventListener('beforeunload', cleanupApplication);
window.addEventListener('unload', cleanupApplication);

// Testing functions for the implementation
window.testSeparateTabMaps = function() {
    console.log('🧪 Testing separate tab maps implementation...');
    
    const tests = [
        {
            name: 'Predefined Routes Map Container',
            test: () => document.getElementById('predefinedRoutesMap') !== null
        },
        {
            name: 'Map Controls',
            test: () => document.getElementById('clearMapBtn') !== null && document.getElementById('fitMapBtn') !== null
        },
        {
            name: 'Tab Switching Function',
            test: () => typeof switchTab === 'function'
        },
        {
            name: 'Predefined Map Functions',
            test: () => typeof initializePredefinedMap === 'function' && 
                       typeof displayRouteOnMap === 'function' && 
                       typeof clearPredefinedMapContent === 'function'
        },
        {
            name: 'Memory Management',
            test: () => typeof cleanupApplication === 'function' && 
                       typeof addTimeout === 'function'
        },
        {
            name: 'State Management',
            test: () => typeof cleanupTabState === 'function'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        try {
            if (test.test()) {
                console.log(`✅ ${test.name}: PASSED`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: FAILED`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name}: ERROR - ${error.message}`);
            failed++;
        }
    });
    
    console.log(`🧪 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All tests passed! Separate tab maps implementation is working correctly.');
        return true;
    } else {
        console.log('⚠️ Some tests failed. Please check the implementation.');
        return false;
    }
};

// Test tab switching functionality
window.testTabSwitching = async function() {
    console.log('🧪 Testing tab switching functionality...');
    
    try {
        // Test switch to predefined routes
        await switchTab('predefined-routes');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Test switch to dynamic routes
        await switchTab('dynamic-routes');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Tab switching test completed successfully');
        return true;
    } catch (error) {
        console.error('❌ Tab switching test failed:', error);
        return false;
    }
};

// Debug function for route display issues
window.debugRouteDisplay = function(routeId) {
    console.log('🧪 Debugging route display for route ID:', routeId);
    
    // Find route in predefined routes
    const route = predefinedRoutes.find(r => r.id == routeId || r._id == routeId);
    if (!route) {
        console.error('❌ Route not found in predefined routes');
        return;
    }
    
    console.log('🔍 Found route:', route);
    console.log('🔍 Route name:', route.name);
    console.log('🔍 Route geometry:', route.geometry);
    console.log('🔍 Route POIs:', route.pois);
    console.log('🔍 Map initialized:', predefinedMapInitialized);
    console.log('🔍 Map object:', predefinedMap);
    
    // Try to display
    if (predefinedMapInitialized) {
        displayRouteOnMap(route);
    } else {
        console.log('🔄 Initializing map first...');
        initializePredefinedMap().then(async () => {
            await displayRouteOnMap(route);
        });
    }
};

// Test function to check route data
window.checkRouteData = async function() {
    console.log('🧪 Checking route data...');
    
    try {
        const response = await fetch(`${apiBase}/routes`);
        if (response.ok) {
            const data = await response.json();
            const routes = data.routes || [];
            console.log('📊 Total routes:', routes.length);
            
            routes.forEach((route, index) => {
                console.log(`Route ${index + 1}:`, {
                    id: route.id || route._id,
                    name: route.name,
                    hasGeometry: !!route.geometry,
                    hasPOIs: !!(route.pois && route.pois.length > 0),
                    poiCount: route.pois ? route.pois.length : 0
                });
            });
            
            if (routes.length > 0) {
                console.log('🧪 Use window.debugRouteDisplay(' + (routes[0].id || routes[0]._id) + ') to test first route');
            }
        }
    } catch (error) {
        console.error('❌ Error checking route data:', error);
    }
};

// Run comprehensive tests
window.runAllSeparateTabMapTests = async function() {
    console.log('🚀 Running comprehensive separate tab maps tests...');
    
    const basicTests = window.testSeparateTabMaps();
    const tabTests = await window.testTabSwitching();
    
    if (basicTests && tabTests) {
        console.log('🎉 All separate tab maps tests passed successfully!');
        console.log('📋 Implementation Summary:');
        console.log('  ✅ Hazır Rotalar sekmesine harita eklendi');
        console.log('  ✅ SavedRoutesModule harita yönetimi kodları eklendi');
        console.log('  ✅ selectRoute metodu harita gösterimi için güncellendi');
        console.log('  ✅ CSS stilleri eklendi');
        console.log('  ✅ RouteCreatorModule optimize edildi');
        console.log('  ✅ Sekme geçişlerinde harita state koruma eklendi');
        console.log('  ✅ Memory management ve cleanup eklendi');
        console.log('  ✅ Loading ve hata durumları iyileştirildi');
        console.log('  ✅ Tab geçiş sistemi güncellendi (lazy loading, state koruma)');
        console.log('  ✅ Her sekme bağımsız harita instance\'ı çalıştırıyor');
        console.log('  ✅ Sekme geçişlerinde performans optimizasyonu');
        console.log('  ✅ Hazır rotalar kendi haritasında gösteriliyor (sekme değişmiyor)');
        return true;
    } else {
        console.log('❌ Some tests failed. Please review the implementation.');
        return false;
    }
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 DOM loaded, initializing...');
    
    AppState.isInitialized = true;

    // Load categories first
    await withErrorHandling(loadCategories, 'Loading categories')();

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
    console.log('🎚️ Initializing preference sliders...');

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

        const preferenceItem = slider.closest('.preference-item');
        if (!preferenceItem) {
            console.error(`❌ Preference item not found for: ${category}`);
            return;
        }

        console.log(`✅ Setting up preference slider: ${category}`);

        // Add both input and change events for better compatibility
        const handleSliderChange = function () {
            const value = parseInt(this.value);
            console.log(`🎚️ Preference slider ${category} changed to: ${value}`);
            updatePreferenceValue(category, value, valueDisplay, preferenceItem);
        };

        slider.addEventListener('input', handleSliderChange);
        slider.addEventListener('change', handleSliderChange);

        // Initialize state
        const initialValue = parseInt(slider.value);
        console.log(`ℹ️ Initial value for ${category}: ${initialValue}`);
        updatePreferenceValue(category, initialValue, valueDisplay, preferenceItem);
    });

    // Initialize quick selection buttons
    initializeQuickSelection();

    console.log('✅ All preference sliders initialized');
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

// Preference value mapping for new mobile-optimized interface
const preferenceValues = {
    0: { text: 'İlgilenmiyorum', value: 0 },
    1: { text: 'Az İlgim Var', value: 25 },
    2: { text: 'İlgim Var', value: 50 },
    3: { text: 'Çok İlgim Var', value: 75 },
    4: { text: 'Kesinlikle İhtiyacım Var', value: 100 }
};

// Quick selection presets
const quickPresets = {
    'nature-lover': {
        doga: 4,
        macera: 3,
        rahatlatici: 3,
        spor: 2,
        yemek: 1,
        tarihi: 1,
        sanat_kultur: 1,
        eglence: 1,
        alisveris: 0,
        gece_hayati: 0
    },
    'culture-enthusiast': {
        tarihi: 4,
        sanat_kultur: 4,
        doga: 2,
        yemek: 3,
        macera: 1,
        rahatlatici: 2,
        spor: 1,
        eglence: 2,
        alisveris: 1,
        gece_hayati: 1
    },
    'foodie': {
        yemek: 4,
        doga: 2,
        tarihi: 2,
        sanat_kultur: 2,
        macera: 1,
        rahatlatici: 3,
        spor: 1,
        eglence: 3,
        alisveris: 2,
        gece_hayati: 3
    },
    'adventure-seeker': {
        macera: 4,
        spor: 4,
        doga: 4,
        yemek: 2,
        tarihi: 1,
        sanat_kultur: 1,
        rahatlatici: 1,
        eglence: 3,
        alisveris: 0,
        gece_hayati: 2
    },
    'relaxation': {
        rahatlatici: 4,
        doga: 3,
        yemek: 3,
        tarihi: 2,
        sanat_kultur: 2,
        macera: 0,
        spor: 1,
        eglence: 2,
        alisveris: 2,
        gece_hayati: 1
    }
};

// Discrete slider value mapping (for backward compatibility)
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

// New mobile-optimized preference functions
function updatePreferenceValue(category, value, valueDisplay, preferenceItem) {
    const preferenceValue = preferenceValues[value];
    if (preferenceValue) {
        valueDisplay.textContent = preferenceValue.text;
        
        // Update visual state
        preferenceItem.classList.remove('active');
        if (value > 0) {
            preferenceItem.classList.add('active');
        }
        
        console.log(`✅ Updated ${category} preference to: ${preferenceValue.text} (${value})`);
    }
}

function initializeQuickSelection() {
    console.log('🚀 Initializing quick selection buttons...');
    
    const quickButtons = document.querySelectorAll('.quick-btn');
    quickButtons.forEach(button => {
        button.addEventListener('click', function() {
            const preset = this.getAttribute('data-preset');
            console.log(`🎯 Quick selection clicked: ${preset}`);
            
            if (preset === 'reset') {
                resetAllPreferences();
            } else if (quickPresets[preset]) {
                applyPreset(quickPresets[preset]);
            }
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    
    console.log('✅ Quick selection buttons initialized');
}

function applyPreset(preset) {
    console.log('🎨 Applying preset:', preset);
    
    Object.keys(preset).forEach(category => {
        const slider = document.getElementById(category);
        const valueDisplay = document.getElementById(category + '-value');
        const preferenceItem = slider?.closest('.preference-item');
        
        if (slider && valueDisplay && preferenceItem) {
            const value = preset[category];
            slider.value = value;
            updatePreferenceValue(category, value, valueDisplay, preferenceItem);
            
            // Trigger change event for any additional handlers
            slider.dispatchEvent(new Event('change'));
        }
    });
    
    console.log('✅ Preset applied successfully');
}

function resetAllPreferences() {
    console.log('🔄 Resetting all preferences...');
    
    Object.keys(ratingCategories).forEach(category => {
        const slider = document.getElementById(category);
        const valueDisplay = document.getElementById(category + '-value');
        const preferenceItem = slider?.closest('.preference-item');
        
        if (slider && valueDisplay && preferenceItem) {
            slider.value = 0;
            updatePreferenceValue(category, 0, valueDisplay, preferenceItem);
            
            // Trigger change event
            slider.dispatchEvent(new Event('change'));
        }
    });
    
    console.log('✅ All preferences reset');
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
            const slider = document.getElementById(category);
            
            if (!slider) {
                console.error(`❌ Slider not found for category: ${category}`);
                return;
            }
            
            const sliderValue = parseInt(slider.value);
            console.log(`🎚️ ${category}: slider value = ${sliderValue}, classes = ${slider.className}`);

            // Check for both old and new slider types
            if (slider.classList.contains('discrete-slider')) {
                // Convert discrete slider value to actual preference value (old interface)
                preferences[category] = discreteValues[sliderValue].value;
                console.log(`   → Using discrete value: ${discreteValues[sliderValue].value}`);
            } else if (slider.classList.contains('preference-slider')) {
                // Convert preference slider value to actual preference value (new interface)
                preferences[category] = preferenceValues[sliderValue].value;
                console.log(`   → Using preference value: ${preferenceValues[sliderValue].value}`);
            } else {
                // Fallback for direct values
                preferences[category] = sliderValue;
                console.log(`   → Using direct value: ${sliderValue}`);
            }
        });

        console.log('User preferences:', preferences);
        console.log('Preferences object keys:', Object.keys(preferences));
        console.log('Preferences object values:', Object.values(preferences));
        console.log('Sending to API:', JSON.stringify({ preferences }, null, 2));
        
        // Debug: Check if preferences is empty
        if (Object.keys(preferences).length === 0) {
            console.error('❌ Preferences object is empty!');
            throw new Error('Preferences could not be collected');
        }

        // Update progress
        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 40);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Make API request to get recommendations
        console.log('🚀 Making API request to:', `${apiBase}/recommendations`);
        console.log('🚀 Request body:', JSON.stringify({ preferences }));
        
        const response = await fetch(`${apiBase}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
            } catch (e) {
                console.error('❌ Could not read error response:', e);
                errorText = 'Unknown error';
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const apiData = await response.json();
        console.log('API Response:', apiData);

        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 70);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Transform API response to match our display format
        const recommendationData = {
            highScore: apiData.recommendations.filter(poi => poi.score >= 45).map(poi => ({
                ...poi,
                recommendationScore: Math.round(poi.score),
                ratings: poi.ratings || {}
            })),
            lowScore: apiData.recommendations.filter(poi => poi.score < 45).map(poi => ({
                ...poi,
                recommendationScore: Math.round(poi.score),
                ratings: poi.ratings || {}
            })),
            all: apiData.recommendations.map(poi => ({
                ...poi,
                recommendationScore: Math.round(poi.score),
                ratings: poi.ratings || {}
            }))
        };

        console.log('Processed recommendation data:', recommendationData);
        
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

        // Display results with animation
        await displayRecommendations(recommendationData);

        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 100);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Initialize map with all recommendations
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
            <div class="no-results-modern">
                <div class="no-results-icon">
                    <i class="fas fa-compass"></i>
                </div>
                <h3>Keşfedilecek yerler bulunamadı</h3>
                <p>Tercihlerinizi değiştirerek farklı deneyimler keşfedebilirsiniz.</p>
                <button class="retry-btn" onclick="document.querySelector('.quick-btn[data-preset=\\'reset\\']').click()">
                    <i class="fas fa-redo"></i>
                    Tercihleri Sıfırla
                </button>
            </div>
        `;
        routeSection.style.display = 'none';
        return;
    }

    // Show route section
    routeSection.style.display = 'block';

    // Create modern recommendation display
    let html = `
        <div class="recommendations-modern">
            <div class="recommendations-header">
                <div class="recommendations-stats">
                    <div class="stat-item">
                        <span class="stat-number">${recommendationData.highScore.length + recommendationData.lowScore.length}</span>
                        <span class="stat-label">Toplam Öneri</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${recommendationData.highScore.length}</span>
                        <span class="stat-label">Size Özel</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${recommendationData.lowScore.length}</span>
                        <span class="stat-label">Alternatif</span>
                    </div>
                </div>
            </div>
    `;

    if (recommendationData.highScore.length > 0) {
        html += `
            <div class="recommendation-category primary">
                <div class="category-header">
                    <div class="category-title">
                        <i class="fas fa-star"></i>
                        <h3>Size Özel Öneriler</h3>
                        <span class="category-badge">${recommendationData.highScore.length}</span>
                    </div>
                    <p class="category-description">Tercihlerinize en uygun yerler</p>
                </div>
                <div class="recommendations-grid">
                    ${createModernPOICards(recommendationData.highScore, 'primary')}
                </div>
            </div>
        `;
    }

    if (recommendationData.lowScore.length > 0) {
        html += `
            <div class="recommendation-category secondary">
                <div class="category-header">
                    <div class="category-title">
                        <i class="fas fa-compass"></i>
                        <h3>Keşfedebileceğiniz Yerler</h3>
                        <span class="category-badge secondary">${recommendationData.lowScore.length}</span>
                    </div>
                    <p class="category-description">Farklı deneyimler için alternatif seçenekler</p>
                    <button class="toggle-category-btn" onclick="toggleAlternativeRecommendations()">
                        <span class="toggle-text">Göster</span>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </button>
                </div>
                <div class="recommendations-grid alternative" id="alternativeRecommendations" style="display: none;">
                    ${createModernPOICards(recommendationData.lowScore, 'secondary')}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    container.innerHTML = html;
    
    // Smooth reveal animation
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    setTimeout(() => {
        container.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
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

    // Add base layers
    addBaseLayers(map);

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

    // Add base layers
    addBaseLayers(map);

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
                                    <i class="${categoryStyle.icon}"></i> ${poi.name}
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

// Modern POI Cards for improved UX
function createModernPOICards(pois, type = 'primary') {
    return pois.map(poi => `
        <div class="modern-poi-card ${type}" data-poi-id="${poi.id || poi._id}">
            <div class="poi-card-header">
                <div class="poi-category-badge">
                    <i class="${getCategoryIcon(poi.category)}"></i>
                    <span>${getCategoryDisplayName(poi.category)}</span>
                </div>
                <div class="poi-score ${poi.recommendationScore >= 45 ? 'high' : 'medium'}">
                    ${poi.recommendationScore}%
                </div>
            </div>
            
            <div class="poi-card-content">
                <h4 class="poi-title">${poi.name}</h4>
                <div class="poi-description">
                    ${poi.description ? poi.description.substring(0, 120) + '...' : 'Keşfetmeye değer bir yer'}
                </div>
                
                <div class="poi-features">
                    ${poi.features ? poi.features.slice(0, 3).map(feature => 
                        `<span class="feature-tag">${feature}</span>`
                    ).join('') : ''}
                </div>
            </div>
            
            <div class="poi-card-actions">
                <button class="action-btn primary" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})" title="Haritada Göster">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="action-btn secondary" onclick="openInGoogleMaps(${poi.latitude}, ${poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')" title="Google Maps'te Aç">
                    <i class="fab fa-google"></i>
                </button>
                <button class="action-btn success" onclick="addToRoute({id: '${poi.id || poi._id}', name: '${poi.name.replace(/'/g, "\\'")}', latitude: ${poi.latitude}, longitude: ${poi.longitude}, category: '${poi.category}'})" title="Rotaya Ekle">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="action-btn info" onclick="showPOIDetails('${poi.id || poi._id}')" title="Detayları Göster">
                    <i class="fas fa-info"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Toggle alternative recommendations
function toggleAlternativeRecommendations() {
    const alternativeSection = document.getElementById('alternativeRecommendations');
    const toggleBtn = document.querySelector('.toggle-category-btn');
    const toggleText = toggleBtn.querySelector('.toggle-text');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    
    if (alternativeSection.style.display === 'none') {
        // Show alternatives
        alternativeSection.style.display = 'grid';
        alternativeSection.style.opacity = '0';
        alternativeSection.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            alternativeSection.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            alternativeSection.style.opacity = '1';
            alternativeSection.style.transform = 'translateY(0)';
        }, 50);
        
        toggleText.textContent = 'Gizle';
        toggleIcon.style.transform = 'rotate(180deg)';
        toggleBtn.classList.add('active');
    } else {
        // Hide alternatives
        alternativeSection.style.opacity = '0';
        alternativeSection.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            alternativeSection.style.display = 'none';
        }, 300);
        
        toggleText.textContent = 'Göster';
        toggleIcon.style.transform = 'rotate(0deg)';
        toggleBtn.classList.remove('active');
    }
}

// Helper function to get category icon
function getCategoryIcon(category) {
    const iconMap = {
        'doga_macera': 'fas fa-tree',
        'gastronomik': 'fas fa-utensils',
        'konaklama': 'fas fa-bed',
        'kulturel': 'fas fa-university',
        'sanatsal': 'fas fa-palette',
        'dini': 'fas fa-mosque',
        'tarihi': 'fas fa-landmark',
        'mimari': 'fas fa-building',
        'mezarlik': 'fas fa-cross',
        'saray_kale': 'fas fa-chess-rook',
        'diger': 'fas fa-map-marker-alt'
    };
    return iconMap[category] || 'fas fa-map-marker-alt';
}

// Toggle low score POIs visibility (legacy function for backward compatibility)
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
// Enhanced Recommend Button Functionality - REMOVED DUPLICATE
// This was causing conflicts with the main event listener in setupEventListeners()
/*
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
                
                // Note: Removed validation - users can get recommendations even with all preferences at 0
                // This allows for general exploration without forcing specific preferences
                
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

// Route Context Menu Class
class RouteContextMenu {
    constructor() {
        this.menu = document.getElementById('routeContextMenu');
        this.isVisible = false;
        this.currentPOI = null;
        this.currentIndex = null;
        
        // Bind event listeners
        this.bindEvents();
    }

    static getInstance() {
        if (!window.routeContextMenuInstance) {
            window.routeContextMenuInstance = new RouteContextMenu();
        }
        return window.routeContextMenuInstance;
    }

    bindEvents() {
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Prevent menu from closing when clicking inside
        this.menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    showForPOI(event, poiId, index) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🎯 Showing context menu for POI:', poiId, 'at index:', index);
        
        // Find the POI in selectedPOIs
        const poi = selectedPOIs.find(p => (p.id || p._id) === poiId);
        if (!poi) {
            console.error('❌ POI not found in selectedPOIs');
            return;
        }
        
        this.currentPOI = poi;
        this.currentIndex = index;
        
        // Update menu content
        this.updateMenuContent();
        
        // Position menu
        this.positionMenu(event);
        
        // Show menu
        this.show();
    }

    updateMenuContent() {
        if (!this.currentPOI) return;
        
        // Update title
        const titleEl = document.getElementById('routeContextMenuTitle');
        titleEl.textContent = this.currentPOI.name;
        
        // Update subtitle
        const subtitleEl = document.getElementById('routeContextMenuSubtitle');
        const stepNumber = startLocation ? this.currentIndex + 2 : this.currentIndex + 1;
        subtitleEl.textContent = `${stepNumber}. durak - ${getCategoryDisplayName(this.currentPOI.category)}`;
        
        // Update route stats
        this.updateRouteStats();
        
        // Update route steps
        this.updateRouteSteps();
    }

    updateRouteStats() {
        const stats = getRouteStatistics();
        if (!stats) return;
        
        document.getElementById('contextDistance').textContent = `${stats.totalDistance.toFixed(1)} km`;
        document.getElementById('contextDuration').textContent = `${Math.round(stats.estimatedTime)} dk`;
        document.getElementById('contextStops').textContent = `${stats.pointCount} durak`;
        document.getElementById('contextCategories').textContent = `${stats.categories.length} kategori`;
    }

    updateRouteSteps() {
        const stepsContainer = document.getElementById('routeContextSteps');
        let stepsHTML = '';
        
        // Add start location if exists
        if (startLocation) {
            stepsHTML += `
                <div class="route-context-step">
                    <div class="route-context-step-number">🏁</div>
                    <div class="route-context-step-content">
                        <div class="route-context-step-name">${startLocation.name}</div>
                        <div class="route-context-step-category">Başlangıç Noktası</div>
                    </div>
                </div>
            `;
        }
        
        // Add selected POIs
        selectedPOIs.forEach((poi, index) => {
            const stepNumber = startLocation ? index + 2 : index + 1;
            const isCurrentPOI = poi === this.currentPOI;
            const categoryStyle = getCategoryStyle(poi.category);
            
            stepsHTML += `
                <div class="route-context-step ${isCurrentPOI ? 'current' : ''}">
                    <div class="route-context-step-number" style="background: ${isCurrentPOI ? '#e74c3c' : categoryStyle.color}">
                        ${stepNumber}
                    </div>
                    <div class="route-context-step-content">
                        <div class="route-context-step-name">${poi.name} ${isCurrentPOI ? '(Seçili)' : ''}</div>
                        <div class="route-context-step-category">${getCategoryDisplayName(poi.category)}</div>
                    </div>
                </div>
            `;
        });
        
        stepsContainer.innerHTML = stepsHTML;
    }

    positionMenu(event) {
        const x = event.clientX;
        const y = event.clientY;
        const menuWidth = 320;
        const menuHeight = 600; // Approximate height
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Calculate position
        let left = x;
        let top = y;
        
        // Adjust if menu would go off screen horizontally
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 20;
        }
        
        // Adjust if menu would go off screen vertically
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 20;
        }
        
        // Ensure minimum margins
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }

    show() {
        this.menu.classList.add('show');
        this.isVisible = true;
        
        // Focus trap for accessibility
        const focusableElements = this.menu.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    hide() {
        this.menu.classList.remove('show');
        this.isVisible = false;
        this.currentPOI = null;
        this.currentIndex = null;
    }

    // Action Methods
    static showForPOI(event, poiId, index) {
        const instance = RouteContextMenu.getInstance();
        instance.showForPOI(event, poiId, index);
    }

    static showRouteDetails() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        if (instance.currentPOI) {
            console.log('🔍 Showing detailed route information');
            
            // Use existing route details panel
            const routeData = {
                pois: selectedPOIs,
                startLocation: startLocation,
                stats: getRouteStatistics()
            };
            
            const panelInstance = RouteDetailsPanel.getInstance();
            panelInstance.show(routeData);
        }
    }

    static optimizeRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('⚡ Optimizing route');
        optimizeRoute();
        showNotification('Rota optimize ediliyor...', 'info');
    }

    static focusOnMap() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('🗺️ Focusing route on map');
        
        if (selectedPOIs.length > 0) {
            // Create bounds for all POIs
            const bounds = L.latLngBounds();
            
            if (startLocation) {
                bounds.extend([startLocation.latitude, startLocation.longitude]);
            }
            
            selectedPOIs.forEach(poi => {
                bounds.extend([poi.latitude, poi.longitude]);
            });
            
            // Fit map to bounds with padding
            map.fitBounds(bounds, { padding: [50, 50] });
            
            showNotification('Rota haritada odaklandı', 'success');
        }
    }

    static shareRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('📤 Sharing route');
        
        // Create route share data
        const routeData = {
            pois: selectedPOIs.map(poi => ({
                id: poi.id || poi._id,
                name: poi.name,
                latitude: poi.latitude,
                longitude: poi.longitude,
                category: poi.category
            })),
            startLocation: startLocation,
            stats: getRouteStatistics(),
            created: new Date().toISOString()
        };
        
        // Create shareable URL
        const routeDataEncoded = btoa(JSON.stringify(routeData));
        const shareUrl = `${window.location.origin}${window.location.pathname}?route=${routeDataEncoded}`;
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showNotification('Rota linki panoya kopyalandı!', 'success');
            }).catch(() => {
                prompt('Rota linkini kopyalayın:', shareUrl);
            });
        } else {
            prompt('Rota linkini kopyalayın:', shareUrl);
        }
    }

    static openInGoogleMaps() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('🌐 Opening route in Google Maps');
        
        let waypoints = [];
        
        if (startLocation) {
            waypoints.push(`${startLocation.latitude},${startLocation.longitude}`);
        }
        
        selectedPOIs.forEach(poi => {
            waypoints.push(`${poi.latitude},${poi.longitude}`);
        });
        
        if (waypoints.length >= 2) {
            const origin = waypoints[0];
            const destination = waypoints[waypoints.length - 1];
            const waypointsParam = waypoints.slice(1, -1).join('|');
            
            let googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
            if (waypointsParam) {
                googleMapsUrl += `?waypoints=${waypointsParam}`;
            }
            
            window.open(googleMapsUrl, '_blank');
            showNotification('Google Maps\'te açılıyor...', 'info');
        } else {
            showNotification('Google Maps için en az 2 nokta gerekli', 'warning');
        }
    }

    static downloadRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('💾 Downloading route');
        
        const routeData = {
            name: `Ürgüp Rotası - ${new Date().toLocaleDateString('tr-TR')}`,
            description: `${selectedPOIs.length} durağı olan kişiselleştirilmiş rota`,
            pois: selectedPOIs,
            startLocation: startLocation,
            stats: getRouteStatistics(),
            created: new Date().toISOString()
        };
        
        // Create JSON file
        const jsonData = JSON.stringify(routeData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `urgup_rotasi_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Rota dosyası indirildi', 'success');
    }

    static editRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('✏️ Editing route');
        showNotification('Rota düzenleme modu aktif - POI\'leri sürükleyip bırakabilirsiniz', 'info');
        
        // Enable drag and drop for route items (this would need additional implementation)
        // For now, just show a notification
    }

    static reverseRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('🔄 Reversing route');
        
        if (selectedPOIs.length >= 2) {
            selectedPOIs.reverse();
            updateRouteDisplay();
            
            // Recreate route with reversed order
            if (selectedPOIs.length >= 1 && (startLocation || selectedPOIs.length >= 2)) {
                createRoute();
            }
            
            showNotification('Rota ters çevrildi', 'success');
        } else {
            showNotification('Ters çevirmek için en az 2 durak gerekli', 'warning');
        }
    }

    static clearRoute() {
        const instance = RouteContextMenu.getInstance();
        instance.hide();
        
        console.log('🗑️ Clearing route');
        
        // Show confirmation dialog
        if (confirm('Rotayı tamamen temizlemek istediğinizden emin misiniz?')) {
            clearRoute();
            showNotification('Rota temizlendi', 'info');
        }
    }
}

// Initialize RouteContextMenu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    RouteContextMenu.getInstance();
});

// Export for global access
window.RouteContextMenu = RouteContextMenu;

// Close the commented duplicate event listener section
*/

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing POI recommendation system...');
    initializeApp();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    console.log('⏳ DOM is still loading, waiting...');
} else {
    // DOM is already loaded
    console.log('✅ DOM already loaded, initializing immediately...');
    initializeApp();
}