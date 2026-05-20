// Global variables
let routingControl = null;
let selectedPOIs = [];
let mediaCache = {};
let userLocation = null;
let startLocation = null;
const apiBase = '/api';
window.apiBase = apiBase; // Make it globally accessible

// Media display configuration
const MEDIA_CONFIG = {
    useFallbackContent: true,  // Show custom fallback content instead of placeholder images
    fallbackTimeout: 10000,    // 10 seconds timeout for media loading
    showPlaceholderImages: false // Use external placeholder images as fallback
};

// CSP-safe inline SVG placeholders (data: URIs)
const ROUTE_PLACEHOLDER_400x200 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e5e7eb'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='Arial,sans-serif' font-size='20'>Rota</text></svg>";
const ROUTE_PLACEHOLDER_100x120 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='120'><rect width='100%' height='100%' fill='%23e5e7eb'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='Arial,sans-serif' font-size='14'>Rota</text></svg>";

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

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Hover event management system
let poiHoverIntegration = null;

/**
 * Initialize the hover event management system
 */
async function initializeHoverSystem() {
    try {
        if (poiHoverIntegration) {
            console.warn('Hover system already initialized');
            return true;
        }

        // Initialize POI hover integration
        poiHoverIntegration = new POIHoverIntegration({
            enableDebugLogging: false, // Set to true for debugging
            debounceDelay: 100,
            hoverDelay: 50,
            leaveDelay: 150,
            enableHoverEffects: true,
            enableClickHandling: true,
            enableTouchSupport: true
        });

        const success = await poiHoverIntegration.initialize();
        
        if (success) {
            console.warn('POI hover event system initialized successfully');
            
            // Setup custom event listeners for integration
            setupHoverEventListeners();
            
            return true;
        } else {
            console.error('Failed to initialize POI hover event system');
            return false;
        }

    } catch (error) {
        console.error('Error initializing hover system:', error);
        return false;
    }
}

/**
 * Setup custom event listeners for hover system integration
 */
function setupHoverEventListeners() {
    // Listen for POI modal requests
    document.addEventListener('poi-modal-request', (event) => {
        const { markerId, poiData } = event.detail;
        
        // Use existing modal function if available
        if (typeof showPOIDetailModal === 'function') {
            showPOIDetailModal(poiData);
        } else if (typeof openPOIModal === 'function') {
            openPOIModal(poiData);
        } else {
            console.warn('No POI modal function available');
        }
    });

    // Listen for hover events for additional processing
    document.addEventListener('poi-hover-start', (event) => {
        const { markerId, poiData } = event.detail;
        // Additional hover start processing can be added here
    });

    document.addEventListener('poi-hover-end', (event) => {
        const { markerId, poiData, duration } = event.detail;
        // Additional hover end processing can be added here
    });
}

// Import centralized category configuration
// Note: This will be loaded via script tag in HTML for browser compatibility

// Rating categories with their display names and icons (from centralized config)
const ratingCategories = window.RATING_CATEGORIES || {
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

const CATEGORY_CONFIG_FALLBACK = {
    displayNames: {
        gastronomik: '🍽️ Gastronomik',
        kulturel: '🏛️ Kültürel',
        sanatsal: '🎨 Sanatsal',
        doga_macera: '🌿 Doğa & Macera',
        konaklama: '🏨 Konaklama',
        alisveris: '🛍️ Alışveriş',
        eglence: '🎪 Eğlence',
        spor: '⚽ Spor',
        diger: 'Diğer',
        kulturel_miras: '🏛️ Kültürel Miras',
        dogal_miras: '🍃 Doğal Miras',
        macera_spor: '⛰️ Macera & Spor',
        konaklama_hizmet: '🏨 Konaklama & Hizmet',
        gastronomi: '🍽️ Gastronomi',
        seyir_noktalari: '⛰️ Seyir Noktaları',
        yasayan_kultur: '🕌 Yaşayan Kültür',
        dogal_guzellilk: '🌿 Doğal Güzellik',
        yemek_icecek: '🍽️ Yemek & İçecek',
        alisveris_el_sanatlari: '🛍️ Alışveriş & El Sanatları',
        eglence_aktivite: '🎪 Eğlence & Aktivite',
        ulasilabilirlik: '🚗 Ulaşılabilirlik'
    },
    styles: {
        gastronomik: { color: '#e74c3c' },
        kulturel: { color: '#3498db' },
        sanatsal: { color: '#2ecc71' },
        doga_macera: { color: '#f39c12' },
        konaklama: { color: '#9b59b6' },
        alisveris: { color: '#f39c12' },
        eglence: { color: '#e74c3c' },
        spor: { color: '#34495e' },
        diger: { color: '#708090' },
        kulturel_miras: { color: '#3498db' },
        dogal_miras: { color: '#16a085' },
        macera_spor: { color: '#e67e22' },
        konaklama_hizmet: { color: '#9b59b6' },
        gastronomi: { color: '#e74c3c' },
        seyir_noktalari: { color: '#2ecc71' },
        yasayan_kultur: { color: '#8B4513' },
        dogal_guzellilk: { color: '#27ae60' },
        yemek_icecek: { color: '#e74c3c' },
        alisveris_el_sanatlari: { color: '#f39c12' },
        eglence_aktivite: { color: '#e91e63' },
        ulasilabilirlik: { color: '#34495e' }
    },
    icons: {
        gastronomik: 'fas fa-utensils',
        kulturel: 'fas fa-landmark',
        sanatsal: 'fas fa-palette',
        doga_macera: 'fas fa-hiking',
        konaklama: 'fas fa-bed',
        alisveris: 'fas fa-shopping-cart',
        eglence: 'fas fa-music',
        spor: 'fas fa-dumbbell',
        diger: 'fas fa-map-marker-alt',
        kulturel_miras: 'fas fa-landmark',
        dogal_miras: 'fas fa-leaf',
        macera_spor: 'fas fa-hiking',
        konaklama_hizmet: 'fas fa-bed',
        gastronomi: 'fas fa-utensils',
        seyir_noktalari: 'fas fa-mountain',
        yasayan_kultur: 'fas fa-mosque',
        dogal_guzellilk: 'fas fa-tree',
        yemek_icecek: 'fas fa-utensils',
        alisveris_el_sanatlari: 'fas fa-shopping-cart',
        eglence_aktivite: 'fas fa-music',
        ulasilabilirlik: 'fas fa-road'
    },
    aliases: {
        gastronomik: 'gastronomik',
        kulturel: 'kulturel',
        sanatsal: 'sanatsal',
        doga_macera: 'doga_macera',
        konaklama: 'konaklama',
        alisveris: 'alisveris',
        eglence: 'eglence',
        spor: 'spor',
        kulturel_miras: 'kulturel_miras',
        dogal_miras: 'dogal_miras',
        macera_spor: 'macera_spor',
        konaklama_hizmet: 'konaklama_hizmet',
        gastronomi: 'gastronomi',
        seyir_noktalari: 'seyir_noktalari',
        yasayan_kultur: 'yasayan_kultur',
        dogal_guzellilk: 'dogal_guzellilk',
        yemek_icecek: 'yemek_icecek',
        alisveris_el_sanatlari: 'alisveris_el_sanatlari',
        eglence_aktivite: 'eglence_aktivite',
        ulasilabilirlik: 'ulasilabilirlik'
    }
};

// Dynamic category data (will be loaded from API or centralized config)
let categoryData = {};

// Use centralized category configuration if available
const fallbackCategoryNames = {};
const fallbackCategoryStyles = {};
const iconMap = {};
const categoryIconAliases = {};

function buildCategoryDisplayNameMap(categories) {
    const displayNames = {};

    categories.forEach(category => {
        displayNames[category.name] = category.display_name;
        if (Array.isArray(category.aliases)) {
            category.aliases.forEach(alias => {
                displayNames[alias] = category.display_name;
            });
        }
    });

    return displayNames;
}

function applyCategoryConfig(config) {
    Object.assign(fallbackCategoryNames, config.displayNames || {});
    Object.assign(fallbackCategoryStyles, config.styles || {});
    Object.assign(iconMap, config.icons || {});
    Object.assign(categoryIconAliases, config.aliases || {});
}

function loadCentralizedCategoryConfig() {
    if (typeof window === 'undefined') {
        return false;
    }

    const requiredFactories = [
        'createIconMap',
        'createColorMap',
        'createAliasMap',
        'getAllCategories'
    ];

    if (!requiredFactories.every(factoryName => typeof window[factoryName] === 'function')) {
        return false;
    }

    applyCategoryConfig({
        displayNames: buildCategoryDisplayNameMap(window.getAllCategories()),
        styles: window.createColorMap(),
        icons: window.createIconMap(),
        aliases: window.createAliasMap()
    });

    return true;
}

if (!loadCentralizedCategoryConfig()) {
    console.warn('⚠️ Centralized POI category configuration not available, using fallback configuration');
    applyCategoryConfig(CATEGORY_CONFIG_FALLBACK);
}

/**
 * Get category style (color and icon) for POI markers
 * @param {string} category - The category key
 * @returns {object} Style object with color and icon
 */
function getCategoryStyle(category) {
    // Log removed for cleaner console
    
    // Use centralized category configuration if available and not the same function
    if (typeof window !== 'undefined' && window.getCategoryStyle && window.getCategoryStyle !== getCategoryStyle) {
        // Log removed for cleaner console
        const result = window.getCategoryStyle(category);
        // Log removed for cleaner console
        return {
            color: result.color,
            iconClass: result.iconClass,
            category: result.category
        };
    }
    
    // Log removed for cleaner console
    
    // Fallback to local configuration
    // Normalize category key
    const normalizedCategory = category ? category.toLowerCase().trim() : 'diger';
    // Log removed for cleaner console
    
    // Check if it's a rating category that needs alias mapping
    const mappedCategory = categoryIconAliases[normalizedCategory] || normalizedCategory;
    // Log removed for cleaner console
    
    // Get style from fallback styles
    const style = fallbackCategoryStyles[mappedCategory] || fallbackCategoryStyles['diger'] || { color: '#708090' };
    // Log removed for cleaner console
    
    // Get Font Awesome icon class
    const iconClass = iconMap[mappedCategory] || iconMap['diger'] || 'fas fa-map-marker-alt';
    // Log removed for cleaner console
    
    const result = {
        color: style.color,
        iconClass: iconClass,
        category: mappedCategory
    };
    
    // Log removed for cleaner console
    return result;
}

/**
 * Get display name for category
 * @param {string} category - The category key
 * @returns {string} Display name
 */
function getCategoryDisplayName(category) {
    // Use centralized category configuration if available and not the same function
    if (typeof window !== 'undefined' && window.getCategoryDisplayName && window.getCategoryDisplayName !== getCategoryDisplayName) {
        return window.getCategoryDisplayName(category);
    }
    
    // Fallback to local configuration
    const normalizedCategory = category ? category.toLowerCase().trim() : 'diger';
    const mappedCategory = categoryIconAliases[normalizedCategory] || normalizedCategory;
    
    // Check rating categories first
    if (ratingCategories[normalizedCategory]) {
        return ratingCategories[normalizedCategory].name;
    }
    
    // Check fallback category names
    return fallbackCategoryNames[mappedCategory] || fallbackCategoryNames['diger'] || 'Diğer';
}

/**
 * Create enhanced POI marker with category-specific styling - Matching poi_manager_enhanced style
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} poi - POI data
 * @param {number} index - POI index
 * @returns {L.Marker} Leaflet marker
 */
function createCategoryMarker(lat, lng, poi, index = 0) {
    // Log removed for cleaner console
    
    const categoryStyle = getCategoryStyle(poi.category || 'diger');
    // Log removed for cleaner console
    
    // Create custom marker with poi_manager_enhanced styling: EXACT same approach
    const categoryColor = categoryStyle.color;
    const categoryIcon = categoryStyle.iconClass.replace('fas fa-', ''); // Remove fas fa- prefix
    
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'custom-poi-marker',
            html: `
                <div class="poi-marker-container" style="background-color: ${categoryColor}">
                    <i class="fas fa-${categoryIcon}"></i>
                </div>
                <div class="poi-marker-number" style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: #ff4757;
                    color: white;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                    z-index: 1001;
                ">${index + 1}</div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        })
    });

    // Register marker with hover system if available
    if (poiHoverIntegration && poiHoverIntegration.isInitialized) {
        poiHoverIntegration.registerPOIMarker(marker, poi, {
            onHoverStart: (event, markerId, poiData) => {
                // Optional: Add custom hover start behavior
            },
            onHoverEnd: (event, markerId, poiData, duration) => {
                // Optional: Add custom hover end behavior
            },
            onClick: (event, markerId, poiData, context) => {
                // Use existing POI detail modal functionality
                if (typeof showPOIDetailModal === 'function') {
                    showPOIDetailModal(poiData);
                } else {
                    // Fallback to basic popup
                    const popupContent = createDetailedPOIPopup(poiData, index + 1);
                    marker.bindPopup(popupContent, {
                        maxWidth: 300,
                        minWidth: 250,
                        className: 'poi-popup-enhanced'
                    }).openPopup();
                }
            }
        });
    }
    
    return marker;
}

// Load categories from API
async function loadCategories() {
    try {
        // Log removed for cleaner console
        const response = await fetch(`${apiBase}/categories`);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const categories = await response.json();
                // Log removed for cleaner console
                
                // Global kategori verilerini güncelle
                categoryData = {};
                categories.forEach(category => {
                    // Font Awesome icon class kullan
                    const iconClass = iconMap[category.name] || iconMap['diger'];
                    
                    categoryData[category.name] = {
                        display_name: category.display_name,
                        color: category.color,
                        iconClass: iconClass,
                        description: category.description
                    };
                });
                
                // Log removed for cleaner console
                return true;
            } else {
                console.warn('⚠️ API yanıtı JSON değil, fallback kullanılacak');
                return false;
            }
        } else {
            console.warn('⚠️ Kategoriler yüklenemedi (HTTP ' + response.status + '), fallback kullanılacak');
            return false;
        }
    } catch (error) {
        console.warn('⚠️ Kategori API\'sine erişilemiyor, fallback kullanılacak:', error.message);
        return false;
    }
}

// Get category color (dynamic)
function getCategoryColor(category) {
    if (categoryData[category]) {
        return categoryData[category].color;
    }
    const mapped = categoryIconAliases[category] || category;
    return fallbackCategoryStyles[mapped]?.color || '#666666';
}

// Get category icon (dynamic) - returns Font Awesome class
function getCategoryIcon(category) {
    let iconClass;

    // Önce API'den yüklenen kategori ikonunu kullan
    if (categoryData[category] && categoryData[category].iconClass) {
        iconClass = categoryData[category].iconClass;
    } else {
        const mapped = categoryIconAliases[category] || category;
        iconClass = iconMap[mapped] || iconMap['diger'];
    }

    return `<i class="${iconClass}"></i>`;
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
        // Log removed for cleaner console

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
        // Log removed for cleaner console

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

        // Show/hide map view button for predefined routes
        const showInMapBtn = document.getElementById('showInMapBtn');
        if (routeData.is_predefined && showInMapBtn) {
            showInMapBtn.style.display = 'flex';
        } else if (showInMapBtn) {
            showInMapBtn.style.display = 'none';
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
                            <div class="stop-icon" style="background: #28a745; color: white; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-flag-checkered"></i>
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
                            <div class="stop-icon" style="background: ${categoryStyle.color}; color: white; display: flex; align-items: center; justify-content: center;">
                                <i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i>
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
        // Log removed for cleaner console

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
                    // Use CSS class instead of inline styles for better performance
                    markerElement.classList.add('poi-marker-highlighted');

                    setTimeout(() => {
                        markerElement.classList.remove('poi-marker-highlighted');
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
                    // Log removed for cleaner console
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
                        // Log removed for cleaner console

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

    static showInFullscreenMap() {
        // Log removed for cleaner console
        const instance = RouteDetailsPanel.getInstance();
        
        if (!instance.currentRoute) {
            console.error('❌ No current route to show in map');
            showNotification('Önce bir rota seçin.', 'error');
            return;
        }

        const route = instance.currentRoute;
        // Log removed for cleaner console

        // Hide the route details panel
        instance.hide();

        // Switch to predefined routes tab if not already there
        if (typeof currentTab !== 'undefined' && currentTab !== 'predefined-routes') {
            if (typeof switchTab === 'function') {
                switchTab('predefined-routes');
            }
        }

        // Wait a moment for tab switch, then make existing map fullscreen
        setTimeout(() => {
            RouteDetailsPanel.makeExistingMapFullscreen(route);
        }, 300);
    }

    static makeExistingMapFullscreen(route) {
        // Find the existing map container
        const mapContainer = document.querySelector('.routes-map-container');
        const routesList = document.getElementById('predefinedRoutesList');
        
        if (!mapContainer) {
            console.error('❌ Map container not found');
            showNotification('Harita bulunamadı', 'error');
            return;
        }

        // Create fullscreen overlay
        const fullscreenOverlay = document.createElement('div');
        fullscreenOverlay.id = 'fullscreenMapOverlay';
        fullscreenOverlay.className = 'fullscreen-map-overlay';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'fullscreen-map-header';
        header.innerHTML = `
            <div class="fullscreen-map-title">
                <i class="fas fa-map"></i>
                <span>${route.route_name || 'Rota Haritası'}</span>
            </div>
            <div class="fullscreen-map-controls">
                <button class="fullscreen-control-btn" onclick="RouteDetailsPanel.toggleFullscreenMapInfo()" title="Rota Bilgilerini Göster/Gizle">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button class="fullscreen-control-btn" onclick="RouteDetailsPanel.exitFullscreenMap()" title="Tam Ekrandan Çık">
                    <i class="fas fa-compress"></i>
                </button>
            </div>
        `;

        // Create info panel
        const infoPanel = document.createElement('div');
        infoPanel.id = 'fullscreenMapInfo';
        infoPanel.className = 'fullscreen-map-info';
        infoPanel.innerHTML = `
            <div class="fullscreen-route-stats">
                <div class="fullscreen-stat-item">
                    <i class="fas fa-route"></i>
                    <span>${route.total_distance || '0'} km</span>
                </div>
                <div class="fullscreen-stat-item">
                    <i class="fas fa-clock"></i>
                    <span>${Math.round((route.estimated_time || 0) / 60)} saat</span>
                </div>
                <div class="fullscreen-stat-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${route.waypoints ? route.waypoints.length : 0} durak</span>
                </div>
            </div>
        `;

        // Add elements to overlay
        fullscreenOverlay.appendChild(header);
        fullscreenOverlay.appendChild(infoPanel);
        
        // Add overlay to body
        document.body.appendChild(fullscreenOverlay);

        // Hide routes list and make map container fullscreen
        if (routesList) {
            routesList.style.display = 'none';
        }
        
        // Store original styles
        const originalMapStyles = {
            position: mapContainer.style.position,
            top: mapContainer.style.top,
            left: mapContainer.style.left,
            right: mapContainer.style.right,
            bottom: mapContainer.style.bottom,
            width: mapContainer.style.width,
            height: mapContainer.style.height,
            zIndex: mapContainer.style.zIndex,
            gridTemplateColumns: mapContainer.style.gridTemplateColumns
        };
        
        // Store for restoration
        window.originalMapStyles = originalMapStyles;

        // Apply fullscreen styles to map container
        mapContainer.style.position = 'fixed';
        mapContainer.style.top = '60px'; // Below header
        mapContainer.style.left = '0';
        mapContainer.style.right = '0';
        mapContainer.style.bottom = '0';
        mapContainer.style.width = '100%';
        mapContainer.style.height = 'calc(100vh - 60px)';
        mapContainer.style.zIndex = '9999';
        mapContainer.style.gridTemplateColumns = '1fr'; // Show only map, hide routes list
        mapContainer.style.background = '#fff';

        // Show overlay with animation
        setTimeout(() => {
            fullscreenOverlay.classList.add('show');
        }, 10);

        // Invalidate map size after transition
        setTimeout(() => {
            if (predefinedMap) {
                predefinedMap.invalidateSize();
                
                // Fit to current route if layers exist
                if (predefinedMapLayers && predefinedMapLayers.length > 0) {
                    try {
                        const group = new L.featureGroup(predefinedMapLayers);
                        if (group.getBounds().isValid()) {
                            predefinedMap.fitBounds(group.getBounds(), { padding: [20, 20] });
                        }
                    } catch (e) {
                        console.warn('Could not fit bounds:', e);
                    }
                }
            }
        }, 300);

        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                RouteDetailsPanel.exitFullscreenMap();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Store escape handler for cleanup
        window.fullscreenEscapeHandler = escapeHandler;

        showNotification('Harita tam ekran modunda', 'success');
    }

    static exitFullscreenMap() {
        const overlay = document.getElementById('fullscreenMapOverlay');
        const mapContainer = document.querySelector('.routes-map-container');
        const routesList = document.getElementById('predefinedRoutesList');

        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }

        // Restore original map container styles
        if (mapContainer && window.originalMapStyles) {
            const styles = window.originalMapStyles;
            mapContainer.style.position = styles.position || '';
            mapContainer.style.top = styles.top || '';
            mapContainer.style.left = styles.left || '';
            mapContainer.style.right = styles.right || '';
            mapContainer.style.bottom = styles.bottom || '';
            mapContainer.style.width = styles.width || '';
            mapContainer.style.height = styles.height || '';
            mapContainer.style.zIndex = styles.zIndex || '';
            mapContainer.style.gridTemplateColumns = styles.gridTemplateColumns || '';
            mapContainer.style.background = '';
        }

        // Show routes list again
        if (routesList) {
            routesList.style.display = '';
        }

        // Remove escape handler
        if (window.fullscreenEscapeHandler) {
            document.removeEventListener('keydown', window.fullscreenEscapeHandler);
            window.fullscreenEscapeHandler = null;
        }

        // Invalidate map size after restoration
        setTimeout(() => {
            if (predefinedMap) {
                predefinedMap.invalidateSize();
            }
        }, 300);

        showNotification('Tam ekran modundan çıkıldı', 'info');
    }

    static createFullscreenMapModal(route) {
        // Remove existing fullscreen modal if any
        const existingModal = document.getElementById('fullscreenMapModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create fullscreen modal HTML
        const modalHTML = `
            <div id="fullscreenMapModal" class="fullscreen-map-modal">
                <div class="fullscreen-map-header">
                    <div class="fullscreen-map-title">
                        <i class="fas fa-map"></i>
                        <span>${route.route_name || 'Rota Haritası'}</span>
                    </div>
                    <div class="fullscreen-map-controls">
                        <button class="fullscreen-control-btn" onclick="RouteDetailsPanel.toggleFullscreenMapInfo()" title="Rota Bilgilerini Göster/Gizle">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="fullscreen-control-btn" onclick="RouteDetailsPanel.closeFullscreenMap()" title="Kapat">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="fullscreen-map-container">
                    <div id="fullscreenMap" class="fullscreen-map"></div>
                    <div id="fullscreenMapInfo" class="fullscreen-map-info">
                        <div class="fullscreen-route-stats">
                            <div class="fullscreen-stat-item">
                                <i class="fas fa-route"></i>
                                <span>${route.total_distance || '0'} km</span>
                            </div>
                            <div class="fullscreen-stat-item">
                                <i class="fas fa-clock"></i>
                                <span>${Math.round((route.estimated_time || 0) / 60)} saat</span>
                            </div>
                            <div class="fullscreen-stat-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${route.waypoints ? route.waypoints.length : 0} durak</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal with animation
        const modal = document.getElementById('fullscreenMapModal');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Initialize fullscreen map
        setTimeout(() => {
            RouteDetailsPanel.initializeFullscreenMap(route);
        }, 300);

        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                RouteDetailsPanel.closeFullscreenMap();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    static async initializeFullscreenMap(route) {
        try {
            // Log removed for cleaner console

            // Create new map instance for fullscreen
            const fullscreenMap = L.map('fullscreenMap', {
                center: [38.6436, 34.8128], // Ürgüp center
                zoom: 12,
                zoomControl: true,
                attributionControl: true
            });

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(fullscreenMap);

            // Store map reference
            window.fullscreenMapInstance = fullscreenMap;

            // Load and display the route
            if (route.predefined_route) {
                await RouteDetailsPanel.displayRouteOnFullscreenMap(fullscreenMap, route.predefined_route);
            }

            // Invalidate size after modal is fully shown
            setTimeout(() => {
                fullscreenMap.invalidateSize();
            }, 100);

        } catch (error) {
            console.error('Error initializing fullscreen map:', error);
            showNotification('Tam ekran harita başlatılırken hata oluştu', 'error');
        }
    }

    static async displayRouteOnFullscreenMap(map, route) {
        try {
            // Log removed for cleaner console

            // Create layer group for route
            const routeLayerGroup = L.layerGroup().addTo(map);

            // Load route geometry if available
            if (route.id) {
                try {
                    const geometryResponse = await fetch(`${apiBase}/routes/${route.id}/geometry`);
                    if (geometryResponse.ok) {
                        const geometryData = await geometryResponse.json();
                        let geometry = geometryData.geometry || geometryData;

                        if (typeof geometry === 'string') {
                            geometry = JSON.parse(geometry);
                        }

                        if (geometry && geometry.coordinates) {
                            // Create polyline from geometry
                            const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            const polyline = L.polyline(coordinates, {
                                color: '#667eea',
                                weight: 4,
                                opacity: 0.8
                            }).addTo(routeLayerGroup);

                            // Fit map to route bounds
                            map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
                        }
                    }
                } catch (error) {
                    console.warn('Could not load route geometry:', error);
                }
            }

            // Add POI markers if available
            if (route.pois && route.pois.length > 0) {
                route.pois.forEach((poi, index) => {
                    const lat = poi.lat || poi.latitude;
                    const lng = poi.lng || poi.lon || poi.longitude;

                    if (lat && lng) {
                        const categoryStyle = getCategoryStyle(poi.category || 'diger');

                        const marker = L.marker([lat, lng], {
                            icon: L.divIcon({
                                className: 'route-poi-marker',
                                html: `<div style="
                                    background: ${categoryStyle.color};
                                    color: white;
                                    width: 30px;
                                    height: 30px;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 14px;
                                    border: 3px solid white;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                    transition: transform 0.2s ease;
                                "><i class="${categoryStyle.iconClass}" style="font-size: 14px; color: white;"></i></div>`,
                                iconSize: [30, 30],
                                iconAnchor: [15, 15],
                                popupAnchor: [0, -15]
                            })
                        }).addTo(routeLayerGroup);

                        const popupContent = `
                            <div class="poi-popup">
                                <h4>${poi.name || `Durak ${index + 1}`}</h4>
                                <p>${poi.description || 'Açıklama bulunmuyor'}</p>
                                <small>Kategori: ${getCategoryDisplayName(poi.category || 'diger')}</small>
                            </div>
                        `;
                        marker.bindPopup(popupContent);
                    }
                });

                // If no geometry, fit to POI bounds
                if (route.pois.length > 0) {
                    const group = new L.featureGroup(routeLayerGroup.getLayers());
                    if (group.getBounds().isValid()) {
                        map.fitBounds(group.getBounds(), { padding: [20, 20] });
                    }
                }
            }

            showNotification('Rota tam ekran haritada gösteriliyor', 'success');

        } catch (error) {
            console.error('Error displaying route on fullscreen map:', error);
            showNotification('Rota gösterilirken hata oluştu', 'error');
        }
    }

    static toggleFullscreenMapInfo() {
        const infoPanel = document.getElementById('fullscreenMapInfo');
        if (infoPanel) {
            infoPanel.classList.toggle('show');
        }
    }

    static closeFullscreenMap() {
        // Check if we're in overlay mode or modal mode
        const overlay = document.getElementById('fullscreenMapOverlay');
        const modal = document.getElementById('fullscreenMapModal');
        
        if (overlay) {
            // Exit overlay mode
            RouteDetailsPanel.exitFullscreenMap();
        } else if (modal) {
            // Exit modal mode
            modal.classList.remove('show');
            
            // Clean up map instance
            if (window.fullscreenMapInstance) {
                window.fullscreenMapInstance.remove();
                window.fullscreenMapInstance = null;
            }
            
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    static exportToGoogleMaps() {
        // Log removed for cleaner console
        const instance = RouteDetailsPanel.getInstance();
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console

        if (!instance.currentRoute) {
            // Log removed for cleaner console
            showNotification('❌ Aktif rota bulunamadı', 'error');
            return;
        }

        let waypoints = [];
        let waypointNames = [];

        if (selectedPOIs.length === 0) {
            // Try to use route data from panel if available
            if (instance.currentRoute && instance.currentRoute.waypoints && instance.currentRoute.waypoints.length > 0) {
                // Use route panel data instead of selectedPOIs
                // Log removed for cleaner console
                waypoints = instance.currentRoute.waypoints.map(wp => `${wp.latitude},${wp.longitude}`);
                waypointNames = instance.currentRoute.waypoints.map(wp => wp.name || 'POI');
            } else if (instance.currentRoute && instance.currentRoute.is_predefined) {
                // For predefined routes, use the current selected route data
                // Log removed for cleaner console

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
                    // Log removed for cleaner console
                    const routeId = routeToExport.id || routeToExport._id;
                    exportPredefinedRouteToGoogleMaps(routeId);
                    return;
                } else {
                    // Log removed for cleaner console
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

                // Log removed for cleaner console
                window.open(url, '_blank');
                showNotification('🗺️ Varsayılan Kapadokya rotası Google Maps\'te açıldı!', 'info');
                return;
            }
        } else {
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

        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console

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

        // Log removed for cleaner console
    }
}
// Create custom marker icons - EXACTLY matching poi_manager_enhanced style
function createCustomIcon(category, score, isLowScore = false) {
    const style = getCategoryStyle(category);

    // Use EXACT same approach as poi_manager_enhanced.html
    const categoryColor = style.color;
    const categoryIcon = style.iconClass.replace('fas fa-', ''); // Remove fas fa- prefix
    const opacity = isLowScore ? '0.8' : '1';
    const scoreBackgroundColor = '#ff4757';
    const scoreTextColor = 'white';

    // Create marker HTML exactly like poi_manager_enhanced.html
    return L.divIcon({
        className: 'custom-poi-marker',
        html: `
            <div class="poi-marker-container" style="background-color: ${categoryColor}; opacity: ${opacity};">
                <i class="fas fa-${categoryIcon}"></i>
            </div>
            <div class="poi-marker-score" style="
                position: absolute;
                top: -6px;
                right: -6px;
                background: ${scoreBackgroundColor};
                color: ${scoreTextColor};
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 10;
            ">${score}</div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
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
                // Log removed for cleaner console
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

// Normalize media paths to avoid double "/poi_media/" prefixes
function normalizeMediaPath(p) {
    if (!p || typeof p !== 'string') return '';
    // Keep absolute and full URLs as-is
    if (p.startsWith('/') || /^https?:\/\//i.test(p)) return p;
    // If already starts with "poi_media/" or "static/poi_media/", just add leading slash
    if (p.startsWith('poi_media/') || p.startsWith('static/poi_media/')) return `/${p}`;
    // Otherwise, ensure it is under /poi_media
    return `/poi_media/${p.replace(/^\/+/, '')}`;
}

// Attach EXIF-based orientation fix to an <img> element. Works after lazy load as well.
function attachEXIFOrientationFix(imgEl) {
    if (!imgEl) return;
    const isPlaceholder = (src) => typeof src === 'string' && src.startsWith('data:image');

    const applyOrientation = () => {
        try {
            if (typeof EXIF === 'undefined') return;
            EXIF.getData(imgEl, function () {
                const orientation = EXIF.getTag(this, 'Orientation');
                if (orientation && (orientation === 3 || orientation === 6 || orientation === 8)) {
                    imgEl.setAttribute('data-orientation', String(orientation));
                }
            });
        } catch (_) { /* no-op */ }
    };

    // If image already loaded with real src
    if (imgEl.complete && imgEl.naturalWidth > 0 && !isPlaceholder(imgEl.src)) {
        applyOrientation();
    }

    // On load (after lazy loader swaps src)
    imgEl.addEventListener('load', () => {
        if (!isPlaceholder(imgEl.src)) applyOrientation();
    }, { passive: true });
}

// Create media gallery HTML
function createMediaGallery(media, poi = {}) {
    // Log removed for cleaner console
    if (!media || (!media.images?.length && !media.videos?.length && !media.audio?.length && !media.models?.length)) {
        // Log removed for cleaner console
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

    // Add models to media items
    if (media.models && media.models.length > 0) {
        media.models.forEach((model, index) => {
            allMediaItems.push({
                type: 'model',
                path: model.path || model.filename,
                title: model.description || `Model ${index + 1}`,
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
            const fullPath = normalizeMediaPath(image.path || image.filename || '');
            const previewPath = image.preview_path ? normalizeMediaPath(image.preview_path) : '';
            const finalImagePath = previewPath || fullPath;
            const mediaItemIndex = allMediaItems.findIndex(item =>
                item.type === 'image' && item.originalIndex === index
            );

            const dataAttrs = [fullPath ? `data-full-src="${fullPath}"` : ''];
            if (previewPath && previewPath !== fullPath) {
                dataAttrs.push(`data-preview-src="${previewPath}"`);
            }
            const dataAttrStr = dataAttrs.filter(Boolean).length ? ` ${dataAttrs.filter(Boolean).join(' ')}` : '';

            galleryHTML += `
                        <img src="${finalImagePath}"${dataAttrStr}
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

    // Models
    if (media.models && media.models.length > 0) {
        galleryHTML += '<div style="margin-bottom: 8px;">';
        galleryHTML += '<div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 6px;">🧩 3D Modeller</div>';
        galleryHTML += '<div style="display: flex; gap: 4px;">';

        media.models.slice(0, 2).forEach((model, index) => {
            const mediaItemIndex = allMediaItems.findIndex(item =>
                item.type === 'model' && item.originalIndex === index
            );

            galleryHTML += `
                        <div style="background: #f0f0f0; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; border: 1px solid #ddd;"
                             onclick="showPOIMediaFromCache('${poiCacheKey}', ${mediaItemIndex})">
                             🧩 ${model.description || 'Model'}
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
        const mediaPath = normalizeMediaPath(mediaItem.path);
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
        } else if (mediaItem.type === 'model') {
            content = `
                        <div class="media-display">
                            <model-viewer src="${mediaPath}" camera-controls auto-rotate style="width: 100%; max-height: 70vh;"></model-viewer>
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
            thumb.src = normalizeMediaPath(item.path);
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
    // Log removed for cleaner console
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

    const mediaPath = normalizeMediaPath(mediaItem.path);

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
    // Log removed for cleaner console
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

    // Log removed for cleaner console
    return clampedElevation;
}

// Open in Google Maps with place name
function openInGoogleMaps(lat, lng, name) {
    // Use coordinates for reliable location finding
    const coords = `${lat},${lng}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${coords}`;

    // Log removed for cleaner console
    window.open(url, '_blank');
}

// Add to route with throttling
function addToRoute(poi) {
    // Log removed for cleaner console
    const poiId = poi.id || poi._id;
    if (!selectedPOIs.find(p => (p.id || p._id) === poiId)) {
        poi.id = poiId; // Normalize ID
        selectedPOIs.push(poi);
        // Log removed for cleaner console
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
        // Log removed for cleaner console
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
    // Log removed for cleaner console

    if (selectedPOIs.length < 1) {
        // Log removed for cleaner console
        return;
    }

    if (routingControl) {
        // Log removed for cleaner console
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
        // Log removed for cleaner console
    }

    selectedPOIs.forEach((poi, index) => {
        waypoints.push({
            lat: poi.latitude,
            lng: poi.longitude,
            name: poi.name
        });
        // Log removed for cleaner console
    });

    // Log removed for cleaner console

    if (waypoints.length < 2) {
        // Log removed for cleaner console
        return;
    }

    // Add start and end markers
    addStartEndMarkers(waypoints);

    try {
        // Log removed for cleaner console

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
        // Log removed for cleaner console

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
        // Log removed for cleaner console

        // Fallback to simple line connections
        await createSimpleRoute(waypoints);
    }
}

// Create simple route with straight lines (fallback)
async function createSimpleRoute(waypoints) {
    // Log removed for cleaner console

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

    // Log removed for cleaner console

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
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        ${getFloatingNotificationShellStyles(type)}
        font-size: 14px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.transform = isCompactNotificationViewport() ? 'translateY(0)' : 'translateX(0)';
    });

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
    const compact = isCompactNotificationViewport();

    notification.style.cssText = `
        ${getFloatingNotificationShellStyles(type, true)}
        transition: transform 0.35s ease, opacity 0.35s ease;
        opacity: 0;
    `;

    const actionId = 'action_' + Math.random().toString(36).substr(2, 9);
    const actionId2 = actionText2 ? 'action2_' + Math.random().toString(36).substr(2, 9) : null;

    const buttonBaseStyle = compact
        ? 'width: 100%;'
        : '';

    const buttonsHtml = `
        <button id="${actionId}" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                       color: white; cursor: pointer; padding: 6px 12px; border-radius: 6px; ${buttonBaseStyle}
                       font-size: 12px; font-weight: 500; transition: all 0.2s ease;">
            ${actionText}
        </button>
        ${actionText2 ? `
        <button id="${actionId2}" 
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                       color: white; cursor: pointer; padding: 6px 12px; border-radius: 6px; ${buttonBaseStyle}
                       font-size: 12px; font-weight: 500; transition: all 0.2s ease;">
            ${actionText2}
        </button>` : ''}
        <button onclick="this.closest('.notification').remove()" 
                style="background: none; border: none; color: white; cursor: pointer; padding: 5px;">
            <i class="fas fa-times"></i>
        </button>
    `;

    notification.innerHTML = `
        <div style="display: flex; ${compact ? 'flex-direction: column;' : 'align-items: center; justify-content: space-between;'} gap: 15px;">
            <span style="flex: 1; line-height: 1.45;">${message}</span>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; ${compact ? 'width: 100%; flex-direction: column; align-items: stretch;' : ''}">
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
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = compact ? 'translateY(0)' : 'translateX(0)';
    });

    // Auto remove after 8 seconds (longer for action notifications)
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = compact ? 'translateY(18px)' : 'translateX(400px)';
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

    // Log removed for cleaner console
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

    // Log removed for cleaner console
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

function getPointCoordinates(point) {
    if (!point || typeof point !== 'object') {
        return null;
    }

    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat, lng };
}

// Helper function to calculate total distance across mixed POI/waypoint shapes
function calculateTotalDistance(points) {
    if (!Array.isArray(points) || points.length < 2) {
        return 0;
    }

    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const current = getPointCoordinates(points[i]);
        const next = getPointCoordinates(points[i + 1]);
        if (!current || !next) {
            continue;
        }

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

    const routeDistanceKm = calculateTotalDistance(route.pois || []);
    const totalDistance = routeDistanceKm.toFixed(2);
    const estimatedTime = Math.round(routeDistanceKm / 5 * 60); // 5 km/h walking speed, in minutes
    const routeType = route.route_type === 'walking' ? 'Yürüyüş' : 
                      route.route_type === 'hiking' ? 'Doğa Yürüyüşü' :
                      route.route_type === 'cycling' ? 'Bisiklet' : 
                      route.route_type === 'driving' ? 'Araç' : 'Bilinmeyen';

    // Create waypoints for the panel
    const waypoints = route.pois ? route.pois.map(poi => {
        const coordinates = getPointCoordinates(poi);
        return {
            id: poi.id || poi._id,
            name: poi.name,
            latitude: coordinates ? coordinates.lat : null,
            longitude: coordinates ? coordinates.lng : null,
            category: poi.category || 'diger'
        };
    }) : [];

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
                
                // Log removed for cleaner console
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
            
            // Log removed for cleaner console
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
            // Log removed for cleaner console
        } else if (foundLocations.length === 1) {
            // Single location found, create a small route around it
            origin = foundLocations[0];
            const [lat, lng] = foundLocations[0].split(',').map(parseFloat);
            destination = `${lat + 0.01},${lng + 0.01}`; // Small offset
            waypoints = [origin, destination];
            // Log removed for cleaner console
        } else {
            // Default: Central Cappadocia area
            origin = '38.6427,34.8283'; // Göreme
            destination = '38.6436,34.8128'; // Ürgüp
            waypoints = [origin, destination];
            // Log removed for cleaner console
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
    
    // SIMPLE AND WORKING: Just use basic Google Maps directions
    let travelMode = 'walking';
    if (route.route_type === 'driving') travelMode = 'driving';
    else if (route.route_type === 'cycling') travelMode = 'bicycling';
    else if (route.route_type === 'transit') travelMode = 'transit';

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}&travelmode=${travelMode}`;
    
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    
    showNotification(`🗺️ "${route.name}" Google Maps'te açıldı!`, 'success');

    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console

    window.open(url, '_blank');
}

// Add navigation route from current location to route start
async function addNavigationToRoute(route) {
    // Log removed for cleaner console
    
    // Check if route has valid geometry or POIs for start point
    let routeStartCoord = null;
    
    if (route.geometry && route.geometry.coordinates && route.geometry.coordinates.length > 0) {
        const startCoord = route.geometry.coordinates[0];
        routeStartCoord = [startCoord[1], startCoord[0]]; // lat, lng
        // Log removed for cleaner console
    } else if (route.pois && route.pois.length > 0) {
        const firstPoi = route.pois[0];
        if (firstPoi.lat && (firstPoi.lng || firstPoi.lon)) {
            routeStartCoord = [firstPoi.lat, firstPoi.lng || firstPoi.lon];
            // Log removed for cleaner console
        }
    }
    
    if (!routeStartCoord) {
        // Log removed for cleaner console
        return;
    }
    
    // Request user location
    try {
        showNotification('📍 Konumunuz alınıyor...', 'info');
        const currentLocation = await getCurrentLocation({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
        });
        const userLocation = [currentLocation.latitude, currentLocation.longitude];

        // Calculate distance to route start
        const distance = getDistance(userLocation[0], userLocation[1], routeStartCoord[0], routeStartCoord[1]);
        const distanceKm = (distance / 1000).toFixed(1);

        if (distance < 100) { // Less than 100 meters
            return;
        }

        // Get navigation route from current location to route start
        await createNavigationRoute(userLocation, routeStartCoord, route.name, distanceKm);
    } catch (error) {
        console.error('❌ Navigation error:', error);
        showNotification('❌ Navigasyon rotası oluşturulamadı: ' + (error && error.message ? error.message : 'Konum alınamadı'), 'error');
    }
}

// Create navigation route on map
async function createNavigationRoute(fromCoord, toCoord, routeName, distanceKm) {
    if (!predefinedMap) {
        console.error('❌ Map not initialized for navigation route');
        return;
    }
    
    try {
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        
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
                    // Log removed for cleaner console
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

// Refresh media markers for a given route
async function refreshMediaMarkers(routeId = window.currentRouteId) {
    const targetId = routeId ?? window.currentRouteId;
    // Log removed for cleaner console

    if (!predefinedMap || !predefinedMapInitialized) {
        console.warn('⚠️ Predefined map not initialized');
        showNotification('Harita henüz yüklenmedi', 'warning');
        return false;
    }

    if (!targetId) {
        console.warn('⚠️ No route id specified for media refresh');
        showNotification('Rota belirlenemedi', 'warning');

        return false;
    }

    try {
        const route = predefinedRoutes.find(r => (r.id || r._id) === targetId);
        if (!route) {
            console.error('❌ Route not found:', targetId);
            return false;
        }

        const mediaResp = await fetch(`${apiBase}/routes/${targetId}/media`);

        if (!mediaResp.ok) {
            console.error('❌ Failed to load route media:', mediaResp.status);
            showNotification('Medya işaretleri yenilenirken hata oluştu', 'error');
            return false;
        }

        const mediaJson = await mediaResp.json();
        const mediaItems = Array.isArray(mediaJson) ? mediaJson : (mediaJson.media || []);
        const locatedMedia = mediaItems.filter(m => (m.lat || m.latitude) && (m.lng || m.longitude || m.lon));

        // Log removed for cleaner console


        const existingMediaMarkers = predefinedMapLayers.filter(layer =>
            layer.options && layer.options.className === 'media-marker'
        );
        existingMediaMarkers.forEach(marker => {
            predefinedMap.removeLayer(marker);
            const index = predefinedMapLayers.indexOf(marker);
            if (index > -1) {
                predefinedMapLayers.splice(index, 1);
            }
        });

        if (locatedMedia.length > 0) {
            // Log removed for cleaner console
            locatedMedia.forEach((media, index) => {
                const lat = parseFloat(media.lat ?? media.latitude);
                const lng = parseFloat(media.lng ?? media.longitude ?? media.lon);
                if (!isFinite(lat) || !isFinite(lng)) return;

                const mediaType = media.media_type || 'image';
                const mediaIcon = createMediaMarkerIcon(mediaType, media);

                const mediaMarker = L.marker([lat, lng], {
                    icon: mediaIcon,
                    title: media.caption || `Medya ${index + 1}`
                }).addTo(predefinedMap);
                mediaMarker.routeId = route.id || route._id;

                const popupContent = createMediaPopupContent(media);
                mediaMarker.bindPopup(popupContent, {
                    maxWidth: 300,
                    minWidth: 250,
                    className: 'media-popup'
                });

                predefinedMapLayers.push(mediaMarker);
            });

            if (predefinedElevationChart) {
                predefinedElevationChart.setMediaMarkers(locatedMedia);
            }


            showNotification('Medya işaretleri başarıyla yenilendi', 'success');
            return true;
        } else {
            // Log removed for cleaner console
            showNotification('Bu rota için konumlu medya bulunamadı', 'info');

            return false;
        }

    } catch (error) {
        console.error('❌ Error refreshing media markers:', error);
        showNotification('Medya işaretleri yenilenirken hata oluştu', 'error');
        return false;
    }
}

window.refreshMediaMarkers = refreshMediaMarkers;


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
                // Log removed for cleaner console
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
            // Log removed for cleaner console
        }
    }
    
    // Default fallback
    if (waypoints.length < 2) {
        waypoints = ['38.6427,34.8283', '38.6436,34.8128']; // Göreme to Ürgüp
        // Log removed for cleaner console
    }

    // Google Earth Web link with multiple waypoints
    // Note: Google Earth Web supports more complex KML-like data
    const firstPoint = waypoints[0];
    const earthUrl = `https://earth.google.com/web/search/${firstPoint}/@${firstPoint},1000d/data=CgIgAQ%3D%3D`;
    
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    
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
    if (!route || !predefinedMap) {
        showNotification('❌ Rota bulunamadı', 'error');
        return;
    }

    const layers = predefinedMapLayers.filter(layer => {
        const id = layer.routeData ? (layer.routeData.id || layer.routeData._id) : layer.routeId;
        return id === routeId;
    });

    if (layers.length > 0) {
        const group = new L.featureGroup(layers);
        predefinedMap.fitBounds(group.getBounds(), {
            padding: [30, 30],
            maxZoom: 14,
            animate: true,
            duration: 0.8
        });
        showNotification(`🎯 "${route.name}" rotasına odaklanıldı`, 'success');
    } else {
        showNotification('❌ Rota haritada bulunamadı', 'error');
    }
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
    // Log removed for cleaner console

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

    // Log removed for cleaner console
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

        // Log removed for cleaner console
    } else {
        // Fallback to coordinates only
        originParam = `${startCoord.lat},${startCoord.lng}`;
        destinationParam = `${endCoord.lat},${endCoord.lng}`;
        // Log removed for cleaner console
    }

    // Use coordinates for reliable routing
    const originCoords = `${startCoord.lat},${startCoord.lng}`;
    const destCoords = `${endCoord.lat},${endCoord.lng}`;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}${waypoints}&travelmode=walking`;

    // Log removed for cleaner console
    // Log removed for cleaner console
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
        
        // Log removed for cleaner console
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

    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console

    window.open(url, '_blank');
    showNotification('🗺️ Google Maps\'te navigasyon başlatıldı!', 'success');
}

// Export full route to Google Maps with names (legacy function)
function exportFullRoute() {
    exportToGoogleMaps(); // Use the enhanced function
}


// Show route information
function showRouteInfo(routeInfo) {
    // Log removed for cleaner console

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
    // Log removed for cleaner console
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
        // Log removed for cleaner console

        if (permission.state === 'denied') {
            const nativeLocation = resolveNativeLocation();
            if (nativeLocation) {
                if (window.locationPermissionResolve) {
                    window.locationPermissionResolve(nativeLocation);
                }
                return;
            }

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

const DEFAULT_GEOLOCATION_OPTIONS = Object.freeze({
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 300000
});

function normalizeGeolocationOptions(options = {}) {
    return {
        ...DEFAULT_GEOLOCATION_OPTIONS,
        ...(options && typeof options === 'object' ? options : {})
    };
}

function shouldPreferNativeCachedLocation(options = {}) {
    return Boolean(options && options.preferNativeCached === true);
}

function isSecureLocationContext() {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
}

function createResolvedLocation(latitude, longitude, accuracy, timestamp, provider, source) {
    return {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
        provider: typeof provider === 'string' && provider ? provider : null,
        source: source || 'browser'
    };
}

function storeResolvedLocation(location) {
    userLocation = location;
    return location;
}

function getNativeLocationBridge() {
    if (!window.APDAndroid || typeof window.APDAndroid.getLastKnownLocation !== 'function') {
        return null;
    }
    return window.APDAndroid;
}

function hasNativeLocationFallback() {
    return !!getNativeLocationBridge();
}

function getNativeLastKnownLocation(options = {}) {
    const bridge = getNativeLocationBridge();
    if (!bridge) return null;

    const normalizedOptions = normalizeGeolocationOptions(options);

    try {
        const rawPayload = bridge.getLastKnownLocation(String(normalizedOptions.maximumAge));
        if (!rawPayload) return null;

        const payload = JSON.parse(String(rawPayload));
        if (!payload || typeof payload !== 'object') return null;

        const latitude = Number(payload.latitude);
        const longitude = Number(payload.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
        }

        return createResolvedLocation(
            latitude,
            longitude,
            Number(payload.accuracy),
            Number(payload.timestamp),
            payload.provider,
            payload.source || 'android-last-known'
        );
    } catch (error) {
        console.warn('Native location bridge returned invalid payload:', error);
        return null;
    }
}

function buildLocationError(error) {
    if (error instanceof Error && typeof error.code !== 'number') {
        return error;
    }

    console.error('❌ Geolocation error:', error);
    let errorMessage = 'Konum alınamadı';
    let helpText = '';
    const errorCode = error && typeof error.code === 'number' ? error.code : null;

    switch (errorCode) {
        case 1:
            errorMessage = 'Konum izni reddedildi';
            helpText = `Konum iznini açmak için:
1. Chrome'da adres çubuğundaki kilit simgesine tıklayın
2. "Konum" seçeneğini "İzin ver" yapın
3. Sayfayı yenileyin (F5)

Alternatif: chrome://settings/content/location adresinden site izinlerini kontrol edin`;
            break;
        case 2:
            errorMessage = 'Konum bilgisi mevcut değil';
            helpText = 'GPS\'inizi açın, WiFi\'ye bağlanın veya açık alanda olduğunuzdan emin olun.';
            break;
        case 3:
            errorMessage = 'Konum alma zaman aşımı';
            helpText = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
            break;
        default:
            if (error && typeof error.message === 'string' && error.message) {
                errorMessage = error.message;
            } else if (error && typeof error.code !== 'undefined') {
                errorMessage = 'Konum hatası (Kod: ' + error.code + ')';
            }
            helpText = 'Tarayıcınızı yenileyin ve tekrar deneyin.';
    }

    if (error && typeof error.message === 'string' && error.message.toLowerCase().includes('permissions policy')) {
        errorMessage = 'Bu sayfa için konum özelliğine izin verilmiyor';
        helpText = 'Sayfayı doğrudan açın veya ebeveyn sayfadaki iframe\'e geolocation izni verildiğinden emin olun (ör. allow="geolocation").';
    }

    const fullError = new Error(errorMessage);
    if (helpText) {
        fullError.helpText = helpText;
    }
    return fullError;
}

function shouldTryNativeLocationFallback(error) {
    if (hasNativeLocationFallback()) {
        return true;
    }
    return !error || error.code !== 1;
}

function requestBrowserCurrentLocation(options = {}) {
    const normalizedOptions = normalizeGeolocationOptions(options);

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve(storeResolvedLocation(createResolvedLocation(
                    position.coords.latitude,
                    position.coords.longitude,
                    position.coords.accuracy,
                    position.timestamp,
                    null,
                    'browser'
                )));
            },
            reject,
            normalizedOptions
        );
    });
}

function resolveNativeLocation(options = {}) {
    const nativeLocation = getNativeLastKnownLocation(options);
    if (!nativeLocation) return null;
    return storeResolvedLocation(nativeLocation);
}

// Request actual location from browser
function requestActualLocation(options = {}) {
    const normalizedOptions = normalizeGeolocationOptions(options);
    const resolveLocation = (location) => {
        if (window.locationPermissionResolve) {
            window.locationPermissionResolve(location);
        }
    };
    const rejectLocation = (error) => {
        if (window.locationPermissionReject) {
            window.locationPermissionReject(error);
        }
    };

    if (!isSecureLocationContext()) {
        const nativeLocation = resolveNativeLocation(normalizedOptions);
        if (nativeLocation) {
            resolveLocation(nativeLocation);
            return;
        }

        const error = new Error('Konum servisleri güvenli bağlantı gerektiriyor');
        error.helpText = 'Sayfayı HTTPS üzerinden açın veya localhost kullanın.';
        if (typeof showNotification === 'function') {
            showNotification('Konum servisleri için HTTPS gerekli. Lütfen siteyi güvenli bağlantı ile açın.', 'error');
        }
        rejectLocation(error);
        return;
    }

    if (!navigator.geolocation) {
        const nativeLocation = resolveNativeLocation(normalizedOptions);
        if (nativeLocation) {
            resolveLocation(nativeLocation);
            return;
        }

        const error = new Error('Bu tarayıcı konum hizmetlerini desteklemiyor');
        error.helpText = 'Lütfen güncel bir tarayıcı kullanın (Chrome, Firefox, Safari, Edge)';
        rejectLocation(error);
        return;
    }

    requestBrowserCurrentLocation(normalizedOptions)
        .then(resolveLocation)
        .catch((error) => {
            const nativeLocation = shouldTryNativeLocationFallback(error)
                ? resolveNativeLocation(normalizedOptions)
                : null;
            if (nativeLocation) {
                resolveLocation(nativeLocation);
                return;
            }

            rejectLocation(buildLocationError(error));
        });
}

// Get user's current location with native browser dialog
async function getCurrentLocation(options = {}) {
    const normalizedOptions = normalizeGeolocationOptions(options);
    if (shouldPreferNativeCachedLocation(options)) {
        const nativeLocation = resolveNativeLocation(normalizedOptions);
        if (nativeLocation) {
            return nativeLocation;
        }
    }

    if (!navigator.geolocation) {
        console.error('❌ Geolocation not supported');
        const fallbackLocation = resolveNativeLocation(normalizedOptions);
        if (fallbackLocation) {
            return fallbackLocation;
        }
        const error = new Error('Bu tarayıcı konum hizmetlerini desteklemiyor');
        error.helpText = 'Lütfen güncel bir tarayıcı kullanın (Chrome, Firefox, Safari, Edge)';
        throw error;
    }

    if (!isSecureLocationContext()) {
        console.error('❌ Not secure context');
        const fallbackLocation = resolveNativeLocation(normalizedOptions);
        if (fallbackLocation) {
            return fallbackLocation;
        }
        const error = new Error('Konum servisleri güvenli bağlantı gerektiriyor');
        error.helpText = 'Sayfayı HTTPS üzerinden açın veya localhost kullanın';
        throw error;
    }

    try {
        await navigator.permissions.query({ name: 'geolocation' });
    } catch (e) {
        console.warn('Permission API not supported');
    }

    try {
        return await requestBrowserCurrentLocation(normalizedOptions);
    } catch (error) {
        const fallbackLocation = shouldTryNativeLocationFallback(error)
            ? resolveNativeLocation(normalizedOptions)
            : null;
        if (fallbackLocation) {
            return fallbackLocation;
        }

        throw buildLocationError(error);
    }
}

// Set start location for route
async function setStartLocation() {
    // Log removed for cleaner console

    try {
        // Log removed for cleaner console
        const location = await getCurrentLocation();
        // Log removed for cleaner console

        startLocation = {
            name: 'Mevcut Konumum',
            latitude: location.latitude,
            longitude: location.longitude,
            id: 'current_location'
        };

        // Add start location marker to map
        if (map) {
            // Log removed for cleaner console

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
            // Log removed for cleaner console
        }

        updateRouteDisplay();

        // Create route if POIs are selected
        if (selectedPOIs.length > 0) {
            createRoute();
        }

        const _locMsg = `Konum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\nDoğruluk: ±${Math.round(location.accuracy)}m`;
        if (typeof window.showToast === 'function') {
            window.showToast(_locMsg, 'success', { title: 'Başlangıç noktası belirlendi' });
        } else {
            alert('Başlangıç noktası belirlendi!\n' + _locMsg);
        }

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
        const _optMsg = 'Optimize etmek için en az 3 POI seçmelisiniz.';
        if (typeof window.showToast === 'function') {
            window.showToast(_optMsg, 'warning');
        } else {
            alert(_optMsg);
        }
        return;
    }

    // Log removed for cleaner console

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
                    // Log removed for cleaner console
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
    // Log removed for cleaner console
    
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
    
    // Log removed for cleaner console
}
async function switchTab(tabName) {
    // Log removed for cleaner console
    
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

        const searchInput = document.getElementById('routeSearchInput');
        if (searchInput) {
            searchInput.focus();
        }

        // Load predefined routes if not already loaded
        if (predefinedRoutes.length === 0) {
            await loadPredefinedRoutes();
        }
        
        // Initialize predefined routes map if not already initialized (lazy loading)
        addTimeout(async () => {
            if (!predefinedMapInitialized) {
                // Log removed for cleaner console
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
    
    // Log removed for cleaner console
    
    if (tabName === 'dynamic-routes') {
        // Clean up dynamic routes state if needed
        // Keep the main map and markers for later use
        if (dynamicElevationChart) {
            dynamicElevationChart.destroy();
            dynamicElevationChart = null;
        }
    } else if (tabName === 'predefined-routes') {
        // Clean up predefined routes state
        // Close route detail modal but NOT POI detail modal
        const routeModal = document.getElementById('routeDetailModal');
        if (routeModal && routeModal.classList.contains('show')) {
            closeRouteDetailModal();
        }
        
        // DON'T close POI detail modal - it should work across tabs
        // const poiModal = document.getElementById('poiDetailModal');
        // if (poiModal && poiModal.classList.contains('show')) {
        //     // Keep POI modal open
        // }
        
        // Keep the predefined map instance but clear temporary highlights
        if (predefinedElevationChart) {
            predefinedElevationChart.destroy();
            predefinedElevationChart = null;
        }
    }
}

function initializePredefinedRoutes() {
    // Log removed for cleaner console
    
    // Initialize filter chips if available
    if (typeof initializeFilterChips === 'function') {
        initializeFilterChips();
    }

    // Initialize filter event listeners
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyRouteFilters);
    }
    
    if (clearFiltersBtn) {
        // Determine which clear function to use based on what UI elements exist
        if (document.getElementById('routeTypeChips')) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        } else {
            clearFiltersBtn.addEventListener('click', clearRouteFilters);
        }
    }

    // Legacy filter listeners (fallback)
    const routeTypeFilter = document.getElementById('routeTypeFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const durationFilter = document.getElementById('durationFilter');
    
    if (routeTypeFilter) {
        routeTypeFilter.addEventListener('change', applyRouteFilters);
    }
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', applyRouteFilters);
    }
    if (durationFilter) {
        durationFilter.addEventListener('change', applyRouteFilters);
    }
    
    // Initialize map control event listeners
    const clearMapBtn = document.getElementById('clearMapBtn');
    const fitMapBtn = document.getElementById('fitMapBtn');
    const fullscreenMapBtn = document.getElementById('fullscreenMapBtn');
    const mapViewEl = document.getElementById('mapView');
    const mapCanvasEl = document.getElementById('predefinedRoutesMap');
    
    if (clearMapBtn) {
        clearMapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearPredefinedMapContent();
            showNotification('Harita temizlendi', 'success');
        });
    }
    if (fitMapBtn) {
        fitMapBtn.addEventListener('click', fitMapToRoutes);
    }

    // Fullscreen toggle (especially for mobile)
    if (fullscreenMapBtn && mapViewEl && mapCanvasEl) {
        let prevScrollY = 0;

        const exitOnEscape = (e) => {
            if (e.key === 'Escape' && mapViewEl.classList.contains('fullscreen')) {
                toggleFullscreen(false);
            }
        };

        function toggleFullscreen(forceState) {
            const entering = forceState !== undefined
                ? forceState
                : !mapViewEl.classList.contains('fullscreen');

            if (entering) {
                // Save scroll and prevent background scroll
                prevScrollY = window.scrollY || window.pageYOffset || 0;
                document.body.style.overflow = 'hidden';

                // Apply fullscreen classes
                mapViewEl.classList.add('fullscreen');
                mapCanvasEl.classList.add('fullscreen');

                // Ensure on top for safety
                mapViewEl.style.zIndex = '9999';

                // Resize Leaflet map after layout settles
                setTimeout(() => { if (typeof predefinedMap !== 'undefined' && predefinedMap) predefinedMap.invalidateSize(); }, 50);
                setTimeout(() => { if (typeof predefinedMap !== 'undefined' && predefinedMap) predefinedMap.invalidateSize(); }, 250);

                // Bind escape to exit
                document.addEventListener('keydown', exitOnEscape);
            } else {
                // Remove fullscreen classes
                mapViewEl.classList.remove('fullscreen');
                mapCanvasEl.classList.remove('fullscreen');

                // Restore styles and scroll
                mapViewEl.style.removeProperty('z-index');
                document.body.style.overflow = '';
                if (prevScrollY) window.scrollTo({ top: prevScrollY, behavior: 'instant' in window ? 'instant' : 'auto' });

                // Resize map back
                setTimeout(() => { if (typeof predefinedMap !== 'undefined' && predefinedMap) predefinedMap.invalidateSize(); }, 50);

                // Unbind escape
                document.removeEventListener('keydown', exitOnEscape);
            }
        }

        fullscreenMapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen();
        });

        // Handle orientation/resize while in fullscreen
        window.addEventListener('resize', () => {
            if (mapViewEl.classList.contains('fullscreen') && typeof predefinedMap !== 'undefined' && predefinedMap) {
                setTimeout(() => predefinedMap.invalidateSize(), 100);
            }
        });
    }
    
    // Log removed for cleaner console
}

// Predefined routes map management
let predefinedMap = null;
let predefinedMapLayers = [];
let predefinedMapInitialized = false;

// Map initialization state management
const mapState = {
    map: null,
    markers: [],
    poiCluster: null,
    mapInitializationPromise: null,
    mapInitialized: false,
};

let map = mapState.map;
let markers = mapState.markers;
let poiCluster = mapState.poiCluster;
let mapInitializationPromise = mapState.mapInitializationPromise;
let mapInitialized = mapState.mapInitialized;

async function initializePredefinedMap() {
    // Log removed for cleaner console
    
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
            // Load standalone and route panoramas on predefined map too
            try {
                if (typeof window.loadPanoramasLayer === 'function') {
                    await window.loadPanoramasLayer();
                }
            } catch (e) {
                console.warn('Panorama layer failed to load on predefined map:', e);
            }

            // Log removed for cleaner console
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
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    
    if (!predefinedMap || !predefinedMapInitialized) {
        console.warn('⚠️ Predefined map not initialized, initializing now...');
        initializePredefinedMap().then(async () => {
            if (predefinedMapInitialized) {
                await displayRouteOnMap(route);
            }
        });
        return;
    }
    
    // Log removed for cleaner console
    console.warn('🔍 Map state:', {
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
        // Log removed for cleaner console
        console.warn('🔍 Map container dimensions:', {
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
            // Log removed for cleaner console
            let geometryData = route.geometry;
            if (typeof geometryData === 'string') {
                try {
                    geometryData = JSON.parse(geometryData);
                    // Log removed for cleaner console
                } catch (e) {
                    console.warn('⚠️ Could not parse route geometry:', e);
                    return;
                }
            }
            
            // Log removed for cleaner console
            
            if (geometryData.coordinates || geometryData.geometry) {
                const coords = geometryData.coordinates || geometryData.geometry.coordinates;
                // Log removed for cleaner console
                if (coords && coords.length > 0) {
                    // Create route polyline
                    const routeLine = L.polyline(coords.map(coord => [coord[1], coord[0]]), {
                        color: routeColor,
                        weight: 4,
                        opacity: 0.8,
                        className: 'route-on-map predefined-route-line'
                    }).addTo(predefinedMap);

                    // Store route data for reference
                    routeLine.routeData = route;
                    routeLine.routeId = route.id || route._id;
                    
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
                    startMarker.routeId = route.id || route._id;
                    
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
                    endMarker.routeId = route.id || route._id;
                    
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
                        // Log removed for cleaner console
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
                                        width: 30px; 
                                        height: 30px; 
                                        border-radius: 50%; 
                                        display: flex; 
                                        align-items: center; 
                                        justify-content: center; 
                                        font-weight: bold;
                                        border: 3px solid white;
                                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                        font-size: 14px;
                                        position: relative;
                                        transition: transform 0.2s ease;
                                    ">
                                        <i class="${categoryStyle.iconClass}" style="color: white; font-size: 14px;"></i>
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
                                            z-index: 10;
                                        ">${index + 1}</span>
                                    </div>`,
                                    iconSize: [30, 30],
                                    iconAnchor: [15, 15],
                                    popupAnchor: [0, -15]
                                })
                            }).addTo(predefinedMap);
                            marker.routeId = route.id || route._id;

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
                        
                        // Log removed for cleaner console
                    }
                    
                    // Fit map to combined bounds (route + POIs)
                    predefinedMap.fitBounds(bounds, { padding: [20, 20] });
                    
                    // Log removed for cleaner console
                    
                    // Create elevation chart for predefined route with geometry
                    if (window.ElevationChart && coords && coords.length > 1) {
                        if (predefinedElevationChart) {
                            predefinedElevationChart.destroy();
                        }
                        predefinedElevationChart = new ElevationChart('predefinedElevationChartContainer', predefinedMap);

                        // Use elevation_profile from database if available
                        if (route.elevation_profile && route.elevation_profile.points) {
                            // Log removed for cleaner console
                            await predefinedElevationChart.loadElevationProfile(route.elevation_profile);
                        } else {
                            // Log removed for cleaner console
                            await predefinedElevationChart.loadRouteElevation({
                                geometry: {
                                    coordinates: coords
                                }
                            });
                        }
                    }

                    window.currentRouteId = route.id || route._id;
                    await refreshMediaMarkers(window.currentRouteId);
                    return;
                }
            }
        }
        // If no geometry, try to display POI markers
        // Log removed for cleaner console
        if (route.pois && route.pois.length > 0) {
            // Log removed for cleaner console
            const validPois = route.pois.filter(poi => poi.lat && (poi.lng || poi.lon));
            // Log removed for cleaner console

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
                                width: 30px; 
                                height: 30px; 
                                border-radius: 50%; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-weight: bold;
                                border: 3px solid white;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                font-size: 14px;
                                position: relative;
                                transition: transform 0.2s ease;
                            ">
                                <i class="${categoryStyle.iconClass}" style="color: white; font-size: 14px;"></i>
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
                                    z-index: 10;
                                ">${index + 1}</span>
                            </div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15],
                            popupAnchor: [0, -15]
                        })
                    }).addTo(predefinedMap);
                    marker.routeId = route.id || route._id;

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
                    // Log removed for cleaner console

                    const routeLine = L.polyline(routeCoordinates, {
                        color: routeColor,
                        weight: 4,
                        opacity: 0.7,
                        className: 'route-connecting-line',
                        dashArray: '10, 5' // Dashed line to indicate estimated route
                    }).addTo(predefinedMap);

                    // Store route data for reference
                    routeLine.routeData = route;
                    routeLine.routeId = route.id || route._id;

                    // Attach standard route interaction handlers
                    attachPredefinedRouteEvents(routeLine, route);


                    predefinedMapLayers.push(routeLine);

                    // Log removed for cleaner console
                } else {
                    // Log removed for cleaner console
                }
                
                // Fit map to POI bounds
                if (bounds.isValid()) {
                    predefinedMap.fitBounds(bounds, { padding: [30, 30] });
                }
                
                // Log removed for cleaner console
                
                // Create elevation chart for predefined route
                if (window.ElevationChart && validPois.length > 1) {
                    if (predefinedElevationChart) {
                        predefinedElevationChart.destroy();
                    }
                    predefinedElevationChart = new ElevationChart('predefinedElevationChartContainer', predefinedMap);

                    // Use elevation_profile from database if available
                    if (route.elevation_profile && route.elevation_profile.points) {
                        // Log removed for cleaner console
                        await predefinedElevationChart.loadElevationProfile(route.elevation_profile);
                    } else {
                        // Log removed for cleaner console
                        await predefinedElevationChart.loadRouteElevation({
                            pois: validPois.map(poi => ({
                                name: poi.name,
                                latitude: poi.lat,
                                longitude: poi.lng || poi.lon
                            }))
                        });
                    }
                }

                window.currentRouteId = route.id || route._id;
                await refreshMediaMarkers(window.currentRouteId);
                return;
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
    // Log removed for cleaner console
    
    if (predefinedMap && predefinedMapLayers.length > 0) {
        predefinedMapLayers.forEach(layer => {
            try {
                predefinedMap.removeLayer(layer);
            } catch (e) {
                // Layer already removed
            }
        });
        predefinedMapLayers = [];
        // Log removed for cleaner console
    }
    
}

// Create enhanced media marker icon based on media type
function createMediaMarkerIcon(mediaType, media) {
    const iconSize = [24, 24];
    const iconAnchor = [12, 12];

    // Define icons and classes for different media types (matching enhanced route manager)
    const iconMap = {
        'image': { icon: 'fa-camera', cls: 'image' },
        'video': { icon: 'fa-video', cls: 'video' },
        'audio': { icon: 'fa-music', cls: 'audio' },
        'model_3d': { icon: 'fa-cube', cls: 'model_3d' },
        'unknown': { icon: 'fa-file', cls: 'image' }
    };

    const cfg = iconMap[mediaType] || iconMap.unknown;

    // Create HTML for the marker using Font Awesome icons (matching enhanced route manager)
    const html = `<div class="media-marker ${cfg.cls}"><i class="fas ${cfg.icon}"></i></div>`;

    return L.divIcon({
        html: html,
        className: '',
        iconSize: iconSize,
        iconAnchor: iconAnchor,
        popupAnchor: [0, -12]
    });
}

// Create enhanced media popup content
function createMediaPopupContent(media) {
    const mediaType = media.media_type || 'image';
    const mediaTypeNames = {
        'image': 'Fotoğraf',
        'video': 'Video',
        'audio': 'Ses',
        'model_3d': '3D Model',
        'unknown': 'Medya'
    };
    
    let popupHTML = `
        <div class="media-popup-content" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 280px;">
            <div class="media-popup-header" style="display: flex; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                <div class="media-popup-icon" style="
                    background: ${mediaType === 'image' ? '#f59e0b' : mediaType === 'video' ? '#ef4444' : mediaType === 'audio' ? '#10b981' : '#6366f1'};
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    margin-right: 10px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                ">
                    <i class="fas ${mediaType === 'image' ? 'fa-camera' : mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : 'fa-cube'}"></i>
                </div>
                <div class="media-popup-title-section" style="flex: 1;">
                    <h4 class="media-popup-title" style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">${mediaTypeNames[mediaType]}</h4>
                    <p class="media-popup-location" style="margin: 2px 0 0 0; font-size: 11px; color: #666;">${media.lat?.toFixed(4)}, ${(media.lng || media.lon || media.longitude)?.toFixed(4)}</p>
                </div>
            </div>
            
            <div class="media-popup-content" style="line-height: 1.4;">
    `;
    
    // Add caption if available
    if (media.caption) {
        popupHTML += `
            <div class="media-popup-caption" style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.3;">${escapeHTML(media.caption)}</p>
            </div>
        `;
    }
    
    // Add media preview if available
    if (media.preview_path || media.thumbnail_path || media.file_path) {
        const imagePath = media.preview_path || media.thumbnail_path || media.file_path;
        popupHTML += `
            <div class="media-popup-preview" style="margin-bottom: 8px;">
                <img src="/${imagePath}" alt="${escapeHTML(media.caption || 'Medya önizlemesi')}" style="width: 100%; border-radius: 6px; max-height: 150px; object-fit: cover;" />
            </div>
        `;
    }
    
    // Add file info if available
    if (media.file_size || media.duration) {
        popupHTML += `
            <div class="media-popup-info" style="display: flex; justify-content: space-between; font-size: 11px; color: #777; margin-top: 8px;">
        `;
        
        if (media.file_size) {
            const sizeKB = Math.round(media.file_size / 1024);
            const sizeMB = (media.file_size / (1024 * 1024)).toFixed(1);
            const sizeText = sizeKB > 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
            popupHTML += `<span>Boyut: ${sizeText}</span>`;
        }
        
        if (media.duration) {
            popupHTML += `<span>Süre: ${media.duration}s</span>`;
        }
        
        popupHTML += `</div>`;
    }
    
    popupHTML += `
            </div>
        </div>
    `;
    
    return popupHTML;
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
                <button class="poi-popup-btn poi-popup-btn--primary" onclick="showPOIDetail('${poi.poi_id || poi.id || poi._id}'); event.stopPropagation();" style="
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
    // Haritada ilgili POI'ye odaklan
    const marker = markers.find(m => m.poiData && (m.poiData.id === poiId || m.poiData._id === poiId));
    if (marker && marker.poiData) {
        const lat = marker.poiData.latitude || marker.poiData.lat;
        const lng = marker.poiData.longitude || marker.poiData.lng;
        focusOnMap(lat, lng);
    }

    // Use the new unified POI detail function
    showPOIDetail(poiId);
}

// Load detailed POI information (similar to recommendation system)
async function loadDetailedPOIInfo(poiId, poiName) {
    try {
        // Log removed for cleaner console

        // Show loading notification
        showNotification('POI detayları yükleniyor...', 'info');

        // Fetch detailed POI data
        const response = await fetch(`${apiBase}/poi/${poiId}`);
        if (response.ok) {
            const poiData = await response.json();
            // Log removed for cleaner console

            // Load media for POI
            const media = await loadPOIMedia(poiId);

            // Create and show detailed POI modal
            showDetailedPOIModal(poiData, media);
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
function showDetailedPOIModal(poi, media = { images: [], videos: [], audio: [], models: [] }) {
    const categoryStyle = getCategoryStyle(poi.category || 'diger');
    const mediaGallery = createMediaGallery(media, poi);

    // Create modal HTML (similar to route detail modal)
    const modalHTML = `
        <div id="poiDetailModal" class="route-detail-modal" style="display: flex;">
            <div class="route-detail-modal-content">
                <div class="route-detail-modal-header">
                    <h3 class="route-detail-modal-title">
                        <span style="background: ${categoryStyle.color}; padding: 4px 8px; border-radius: 50%; margin-right: 8px;">
                            <i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i>
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

                        ${mediaGallery}

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
    
    // Check if Bootstrap modal exists, if not create a fallback
    const existingModal = document.getElementById('poiDetailModal');
    if (existingModal) {
        // Log removed for cleaner console
        return;
    }
    
    console.warn('⚠️ Bootstrap modal not found, creating fallback modal');
    // Add modal to page only if it doesn't exist
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
        // Use Bootstrap modal hide instead of removing
        try {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            } else {
                modal.style.display = 'none';
                modal.classList.remove('show');
            }
        } catch (error) {
            console.warn('Error closing modal:', error);
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }
}
// Fallback function for route display when standard method fails
function displayRouteOnMapFallback(route) {
    // Log removed for cleaner console
    // Log removed for cleaner console
    
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
            // Log removed for cleaner console
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
                                font-size: 12px;
                                position: relative;
                            ">
                                <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px;"><i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i></span>
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
                            iconAnchor: [15, 15],
                            popupAnchor: [0, -15]
                        })
                    }).addTo(predefinedMap);
                    marker.routeId = route.id || route._id;

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
                    // Log removed for cleaner console
                    
                    const routeLine = L.polyline(routeCoordinates, {
                        color: '#2563eb',
                        weight: 3,
                        opacity: 0.6,
                        className: 'fallback-route-line',
                        dashArray: '15, 10' // More dashed to indicate estimated route
                    }).addTo(predefinedMap);

                    // Store route data for reference and attach handlers
                    routeLine.routeData = route;
                    routeLine.routeId = route.id || route._id;
                    attachPredefinedRouteEvents(routeLine, route);

                    predefinedMapLayers.push(routeLine);
                    // Log removed for cleaner console
                }
                
                if (bounds.isValid()) {
                    predefinedMap.fitBounds(bounds, { padding: [30, 30] });
                }
                
                // Log removed for cleaner console
                showNotification(`Rota POI'leri ve bağlantı çizgisi görüntülendi (${validPois.length} nokta)`, 'success');
                return;
            }
        }
        
        // If still no success, show a center marker
        // Log removed for cleaner console
        const centerMarker = L.marker([38.6436, 34.8128]).addTo(predefinedMap);
        centerMarker.routeId = route.id || route._id;
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
        // Log removed for cleaner console
        
    } catch (error) {
        console.error('❌ Fallback display also failed:', error);
        showNotification('Rota gösterilemedi, lütfen sayfayı yenileyin', 'error');
    }
}

function fitMapToRoutes() {
    // Log removed for cleaner console

    if (!predefinedMap || !predefinedMapInitialized) {
        console.warn('⚠️ Predefined map not initialized');
        return;
    }

    if (predefinedMapLayers.length === 0) {
        predefinedMap.setView([38.6436, 34.8128], 12);
        showNotification('Görüntülenecek rota bulunamadı', 'warning');
        return;
    }

    const routeIds = new Set();
    predefinedMapLayers.forEach(layer => {
        const id = layer.routeData ? (layer.routeData.id || layer.routeData._id) : layer.routeId;
        if (id) routeIds.add(id);
    });

    let layersToFit = [];
    if (routeIds.size === 1) {
        const targetId = Array.from(routeIds)[0];
        layersToFit = predefinedMapLayers.filter(layer => {
            const id = layer.routeData ? (layer.routeData.id || layer.routeData._id) : layer.routeId;
            return id === targetId;
        });
        const route = predefinedRoutes.find(r => (r.id || r._id) === targetId);
        if (route) {
            showNotification(`${route.name} rotasına odaklanıldı`, 'info');
        }
    } else {
        layersToFit = predefinedMapLayers.filter(l => l.getBounds && l.getBounds().isValid());
        showNotification('Tüm rotalara odaklanıldı', 'info');
    }

    try {
        const group = L.featureGroup(layersToFit);
        predefinedMap.fitBounds(group.getBounds(), {
            padding: [20, 20],
            maxZoom: 14,
            animate: true,
            duration: 0.8
        });
    } catch (error) {
        console.error('❌ Error fitting map to routes:', error);
        predefinedMap.setView([38.6436, 34.8128], 12);
    }
}

// Calculate distance of a polyline geometry in kilometers
function calculatePolylineDistance(geometry) {
    if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) return 0;
    let total = 0;
    const coords = geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        total += getDistance(lat1, lon1, lat2, lon2);
    }
    return total;
}

// Ensure a route has a distance value, calculating from geometry when missing
function ensureRouteDistance(route) {
    if (route.total_distance || route.distance || route.length) {
        route.total_distance = route.total_distance || route.distance || route.length;
    } else if (route.geometry && route.geometry.coordinates) {
        route.total_distance = calculatePolylineDistance(route.geometry);
    } else {
        route.total_distance = 0;
    }
    return route.total_distance;
}

async function loadPredefinedRoutes() {
    // Log removed for cleaner console
    
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
            // Log removed for cleaner console
            
            // API returns {success: true, routes: [...], count: ...}
            const routes = data.routes || [];
            routes.forEach(ensureRouteDistance);

            predefinedRoutes = routes;
            filteredRoutes = [...routes];
            
            displayPredefinedRoutes(filteredRoutes);
            updateRouteStats();
            
            // Load media for all routes in the background
            // Log removed for cleaner console
            routes.forEach(route => {
                // Load media asynchronously without blocking the UI
                loadRouteMediaForCard(route).catch(error => {
                    console.warn(`Failed to load media for route ${route.id}:`, error);
                });
            });
            
            // Initialize media display mode button
            initializeMediaDisplayModeButton();
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

    // Load media for each route card
    routes.forEach(route => {
        loadRouteMediaForCard(route);
    });

    // Add event listeners to route cards and favorite buttons
    routesList.querySelectorAll('.route-card').forEach((card, index) => {
        const route = routes[index];

        // Route card click -> show mobile-friendly modal
        card.addEventListener('click', async () => {
            // Add loading state to clicked card
            card.classList.add('loading');

            try {
                // For mobile devices, show the new modal directly
                if (window.innerWidth <= 768) {
                    // Always load detailed route data first (geometry + POIs)
                    await selectPredefinedRoute(route);
                    const fullRoute = window.currentSelectedRoute || route;
                    if (window.RouteDetailsModal) {
                        const modal = RouteDetailsModal.getInstance();
                        await modal.show(fullRoute);
                    } else {
                        // Fallback to existing panel
                        showPredefinedRouteDetailsPanel(fullRoute);
                    }
                } else {
                    // For desktop, keep existing behavior or use modal
                    await selectPredefinedRoute(route);
                    // Use new modal instead of side panel if available
                    if (window.RouteDetailsModal) {
                        const modal = RouteDetailsModal.getInstance();
                        await modal.show(window.currentSelectedRoute || route);
                    } else {
                        showPredefinedRouteDetailsPanel(window.currentSelectedRoute || route);
                    }
                }
            } catch (error) {
                console.error('Error showing route details:', error);
            } finally {
                card.classList.remove('loading');
            }
        });

        // Favorite button click -> toggle favorite state
        const favBtn = card.querySelector('.favorite-btn');
        if (favBtn) {
            // Initialize button state from storage
            if (isRouteFavorite(route.id)) {
                favBtn.classList.add('active');
            }

            favBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                toggleFavoriteRoute(route.id);
                favBtn.classList.toggle('active');

                // Re-apply filters if favorites filter is active
                const favoriteChip = document.querySelector('#favoriteChips .filter-chip.active');
                if (favoriteChip && favoriteChip.dataset.value === 'favorites') {
                    applyRouteFilters();
                }
            });
        }
    });

    // Render mini maps for each route
    renderRouteMiniMaps(routes);

    // Update route statistics
    updateRouteStats();
}

function createRouteCard(route) {
    const difficultyLevel = route.difficulty_level || 1;
    const difficultyStars = createDifficultyStars(difficultyLevel);
    const duration = Math.round((route.estimated_duration || 0) / 60);
    const stopCount = route.poi_count || (route.waypoints ? route.waypoints.length : 0);
    const distance = ensureRouteDistance(route).toFixed(1);
    const placeholderImage = ROUTE_PLACEHOLDER_400x200;
    const imageUrl = route.preview_image || placeholderImage;
    const rid = route.id || route._id;
    
    console.warn('🏷️ Creating route card:', {
        name: route.name,
        stopCount: stopCount,
        rawPoiCount: route.poi_count
    });

    return `
        <div class="route-card" data-route-id="${rid}">
            <div class="route-card-image">
                <img src="${imageUrl}" alt="${route.name || 'Rota görseli'}" data-placeholder="${placeholderImage}" onerror="handleImageError(event)" class="route-card-main-image" loading="lazy">
                <div class="route-card-media-overlay" id="route-media-overlay-${rid}" style="display:none;">
                    <div class="route-card-media-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Medya yükleniyor...</span>
                    </div>
                </div>
                <div class="route-mini-map mini-map-overlay" id="mini-map-${rid}" aria-label="Rota önizleme haritası"></div>
            </div>
            <div class="route-card-header">
                <h3 class="route-card-title">${route.name || 'İsimsiz Rota'}</h3>
                <div class="route-card-actions">
                    <button class="favorite-btn" data-route-id="${route.id}" aria-label="Favorilere ekle">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                <p class="route-card-description">${(route.description && route.description.trim() !== '') ? route.description : 'Bu rota için özel bir açıklama bulunmuyor. Ancak bölgenin en güzel manzaralarını, tarihi ve kültürel zenginliklerini keşfetme fırsatı sunan eşsiz bir deneyim sizi bekliyor. Doğanın kalbinde unutulmaz anılar biriktirmeye hazır mısınız?'}</p>
            </div>
            <div class="route-card-meta">
                <div class="route-meta-item" aria-label="Mesafe: ${distance} km">
                    <span class="route-distance">${distance} km</span>
                </div>
                <div class="route-meta-item" aria-label="Süre: ${duration} saat">
                    <i class="fas fa-clock" aria-hidden="true"></i>
                    <span>${duration} saat</span>
                </div>
                <div class="route-meta-item" aria-label="Durak sayısı: ${stopCount}">
                    <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                    <span>${stopCount} durak</span>
                </div>
                <div class="route-meta-item route-difficulty" aria-label="Zorluk seviyesi: ${difficultyLevel}">
                    <i class="fas fa-mountain" aria-hidden="true"></i>
                    <div class="difficulty-stars">${difficultyStars}</div>
                </div>
            </div>
        </div>
    `;
}

// Load route media for display in route cards
async function loadRouteMediaForCard(route) {
    const rid = route && (route.id || route._id);
    if (!route || !rid) {
        console.warn('loadRouteMediaForCard: Invalid route data');
        // Show fallback immediately to avoid indefinite overlay
        if (route) {
            showRouteCardFallback(route.id || route._id);
        }
        return;
    }

    // Log removed for cleaner console
    
    // Set a timeout to prevent indefinite loading
    const timeoutId = setTimeout(() => {
        console.warn(`Media loading timeout for route ${rid}, showing fallback`);
        if (MEDIA_CONFIG.useFallbackContent) {
            showRouteCardFallback(rid);
        } else if (MEDIA_CONFIG.showPlaceholderImages) {
            showRouteCardPlaceholder(rid);
        }
    }, MEDIA_CONFIG.fallbackTimeout);
    
    try {
        let response = await fetch(`${apiBase}/admin/routes/${rid}/media`, {
            credentials: 'include'
        });
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // Try public endpoint if admin requires auth
            if (response.status === 401 || response.status === 403) {
                try {
                    response = await fetch(`${apiBase}/routes/${rid}/media`);
                } catch (e) { /* ignore */ }
            }
        }
        if (!response.ok) {
            console.warn(`Failed to load media for route ${rid}:`, response.status);
            if (MEDIA_CONFIG.useFallbackContent) {
                showRouteCardFallback(rid);
            } else if (MEDIA_CONFIG.showPlaceholderImages) {
                showRouteCardPlaceholder(rid);
            }
            return;
        }

        const data = await response.json();
        // Log removed for cleaner console
        
        // Handle different possible response formats
        let mediaFiles = [];
        if (Array.isArray(data)) {
            mediaFiles = data;
        } else if (Array.isArray(data.media)) {
            mediaFiles = data.media;
        } else if (Array.isArray(data.files)) {
            mediaFiles = data.files;
        } else if (data && typeof data === 'object') {
            // Try to find any array in the response
            Object.values(data).forEach(value => {
                if (Array.isArray(value)) {
                    mediaFiles = value;
                }
            });
        }

        if (mediaFiles.length > 0) {
            // Find the primary image or first image
            const primaryImage = mediaFiles.find(media => 
                media.is_primary || 
                media.media_type === 'image' || 
                (media.path && media.path.match(/\.(jpg|jpeg|png|gif|webp)$/i))
            ) || mediaFiles[0];

            if (primaryImage) {
                updateRouteCardImage(rid, primaryImage);
            } else {
                // No suitable image found, show fallback
                if (MEDIA_CONFIG.useFallbackContent) {
                    showRouteCardFallback(rid);
                } else if (MEDIA_CONFIG.showPlaceholderImages) {
                    showRouteCardPlaceholder(rid);
                }
            }
        } else {
            // No media files at all, show fallback
            // Log removed for cleaner console
            if (MEDIA_CONFIG.useFallbackContent) {
                showRouteCardFallback(rid);
            } else if (MEDIA_CONFIG.showPlaceholderImages) {
                showRouteCardPlaceholder(rid);
            }
        }
    } catch (error) {
        // Clear the timeout since we got an error
        clearTimeout(timeoutId);
        console.error(`Error loading media for route ${rid}:`, error);
        if (MEDIA_CONFIG.useFallbackContent) {
            showRouteCardFallback(rid);
        } else if (MEDIA_CONFIG.showPlaceholderImages) {
            showRouteCardPlaceholder(rid);
        }
    }
}

// Update route card image with loaded media
function updateRouteCardImage(routeId, mediaFile) {
    const card = document.querySelector(`[data-route-id="${routeId}"]`);
    if (!card) {
        console.warn(`Route card not found for ID: ${routeId}`);
        return;
    }

    const imageContainer = card.querySelector('.route-card-image');
    const mainImage = card.querySelector('.route-card-main-image');
    const mediaOverlay = card.querySelector(`#route-media-overlay-${routeId}`);
    
    if (!imageContainer || !mainImage || !mediaOverlay) {
        console.warn(`Image elements not found for route: ${routeId}`);
        return;
    }

    // Get the image path
    const imagePath = mediaFile.path || mediaFile.file_path || mediaFile.url || '';
    if (!imagePath) {
        console.warn(`No image path found for media:`, mediaFile);
        return;
    }

    // Resolve to absolute or relative URL correctly
    let resolvedSrc = imagePath;
    if (!/^https?:\/\//i.test(resolvedSrc)) {
        resolvedSrc = resolvedSrc.startsWith('/') ? resolvedSrc : `/${resolvedSrc}`;
    }
    // Update the main image
    mainImage.src = resolvedSrc;
    mainImage.alt = mediaFile.caption || `Rota görseli - ${mediaFile.filename || ''}`;
    
    // Show the main image
    mainImage.style.display = 'block';
    
    // Hide the loading overlay
    mediaOverlay.style.display = 'none';
    
    // Hide any existing fallback content
    const fallbackElement = imageContainer.querySelector('.route-card-fallback');
    if (fallbackElement) {
        fallbackElement.style.display = 'none';
    }
    
    // Log removed for cleaner console
}

// Show fallback content when no media is available
function showRouteCardFallback(routeId) {
    const card = document.querySelector(`[data-route-id="${routeId}"]`);
    if (!card) {
        console.warn(`Route card not found for ID: ${routeId}`);
        return;
    }

    const imageContainer = card.querySelector('.route-card-image');
    const mainImage = card.querySelector('.route-card-main-image');
    const mediaOverlay = card.querySelector(`#route-media-overlay-${routeId}`);
    
    if (!imageContainer || !mainImage || !mediaOverlay) {
        console.warn(`Image elements not found for route: ${routeId}`);
        return;
    }

    // Hide the loading overlay
    mediaOverlay.style.display = 'none';
    
    // Create fallback content based on route type
    const route = predefinedRoutes.find(r => String(r.id || r._id) === String(routeId));
    if (route) {
        const fallbackContent = createRouteFallbackContent(route);
        mainImage.style.display = 'none';
        
        // Add fallback content to the image container
        let fallbackElement = imageContainer.querySelector('.route-card-fallback');
        if (!fallbackElement) {
            fallbackElement = document.createElement('div');
            fallbackElement.className = 'route-card-fallback';
            imageContainer.appendChild(fallbackElement);
        }
        fallbackElement.innerHTML = fallbackContent;
        fallbackElement.style.display = 'flex';
    }
    
    // Log removed for cleaner console
}

// Create fallback content based on route type
function createRouteFallbackContent(route) {
    const routeType = route.route_type || 'walking';
    const routeName = route.name || 'Rota';
    
    // Define fallback content for different route types
    const fallbackConfigs = {
        'walking': {
            icon: 'fas fa-walking',
            color: '#059669',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            text: 'Yürüyüş Rotası'
        },
        'hiking': {
            icon: 'fas fa-mountain',
            color: '#d97706',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            text: 'Doğa Yürüyüşü'
        },
        'cycling': {
            icon: 'fas fa-bicycle',
            color: '#2563eb',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            text: 'Bisiklet Rotası'
        },
        'driving': {
            icon: 'fas fa-car',
            color: '#dc2626',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            text: 'Araç Rotası'
        }
    };
    
    const config = fallbackConfigs[routeType] || fallbackConfigs['walking'];
    
    return `
        <div class="route-fallback-content" style="background: ${config.background};">
            <div class="route-fallback-icon">
                <i class="${config.icon}" style="color: white; font-size: 2.5rem;"></i>
            </div>
            <div class="route-fallback-text">
                <h4 style="color: white; margin: 0; font-size: 1rem; font-weight: 600;">${routeName}</h4>
                <p style="color: rgba(255,255,255,0.9); margin: 0.5rem 0 0 0; font-size: 0.85rem;">${config.text}</p>
            </div>
        </div>
    `;
}

// Toggle between fallback content and placeholder images
window.toggleMediaDisplayMode = function() {
    MEDIA_CONFIG.useFallbackContent = !MEDIA_CONFIG.useFallbackContent;
    MEDIA_CONFIG.showPlaceholderImages = !MEDIA_CONFIG.useFallbackContent;
    
    // Log removed for cleaner console
    
    // Update the toggle button text
    const toggleBtn = document.querySelector('.btn-outline-info[onclick="toggleMediaDisplayMode()"]');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        const span = toggleBtn.querySelector('span');
        if (MEDIA_CONFIG.useFallbackContent) {
            icon.className = 'fas fa-toggle-on';
            span.textContent = 'Özel İçerik';
        } else {
            icon.className = 'fas fa-toggle-off';
            span.textContent = 'Varsayılan';
        }
    }
    
    // Refresh all route media to apply the new mode
    if (predefinedRoutes && predefinedRoutes.length > 0) {
        predefinedRoutes.forEach(route => {
            if (MEDIA_CONFIG.useFallbackContent) {
                showRouteCardFallback(route.id);
            } else if (MEDIA_CONFIG.showPlaceholderImages) {
                showRouteCardPlaceholder(route.id);
            }
        });
    }
    
    showNotification(`Medya görüntüleme modu değiştirildi: ${MEDIA_CONFIG.useFallbackContent ? 'Özel İçerik' : 'Varsayılan Görseller'}`, 'info');
};

// Show current media display mode
window.showMediaDisplayMode = function() {
    const currentMode = MEDIA_CONFIG.useFallbackContent ? 'Özel İçerik' : 'Varsayılan Görseller';
    const description = MEDIA_CONFIG.useFallbackContent 
        ? 'Rotada medya yoksa özel tasarlanmış içerik gösterilir'
        : 'Rotada medya yoksa varsayılan görseller gösterilir';
    
    showNotification(`Mevcut Mod: ${currentMode}\n${description}`, 'info');
};

// Initialize media display mode button
function initializeMediaDisplayModeButton() {
    const toggleBtn = document.querySelector('.btn-outline-info[onclick="toggleMediaDisplayMode()"]');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        const span = toggleBtn.querySelector('span');
        if (MEDIA_CONFIG.useFallbackContent) {
            icon.className = 'fas fa-toggle-on';
            span.textContent = 'Özel İçerik';
        } else {
            icon.className = 'fas fa-toggle-off';
            span.textContent = 'Varsayılan';
        }
    }
}

// Alternative: Show a default placeholder image
function showRouteCardPlaceholder(routeId) {
    const card = document.querySelector(`[data-route-id="${routeId}"]`);
    if (!card) return;

    const imageContainer = card.querySelector('.route-card-image');
    const mainImage = card.querySelector('.route-card-main-image');
    const mediaOverlay = card.querySelector(`#route-media-overlay-${routeId}`);
    
    if (!imageContainer || !mainImage || !mediaOverlay) return;

    // Hide the loading overlay
    mediaOverlay.style.display = 'none';
    
    // Show a default placeholder image
    const route = predefinedRoutes.find(r => r.id === routeId);
    if (route) {
        // Use CSP-safe inline placeholder to avoid external image loads
        mainImage.src = ROUTE_PLACEHOLDER_400x200;
        mainImage.alt = `${route.name} - Varsayılan görsel`;
        mainImage.style.display = 'block';
        
        // Hide any existing fallback content
        const fallbackElement = imageContainer.querySelector('.route-card-fallback');
        if (fallbackElement) {
            fallbackElement.style.display = 'none';
        }
    }
}

// Manual refresh function for route media
window.refreshRouteMedia = async function(routeId) {
    if (!routeId) {
        console.warn('refreshRouteMedia: No route ID provided');
        return;
    }
    
    // Log removed for cleaner console
    
    const route = predefinedRoutes.find(r => r.id === routeId);
    if (!route) {
        console.warn(`Route not found for ID: ${routeId}`);
        return;
    }
    
    try {
        // Show loading state first
        const mediaOverlay = document.querySelector(`#route-media-overlay-${routeId}`);
        if (mediaOverlay) {
            mediaOverlay.style.display = 'flex';
        }
        
        await loadRouteMediaForCard(route);
        // Log removed for cleaner console
    } catch (error) {
        console.error(`❌ Failed to refresh media for route ${routeId}:`, error);
        // If refresh fails, show fallback
        showRouteCardFallback(routeId);
    }
};

// Global refresh function for all route media
window.refreshAllRouteMedia = async function() {
    // Log removed for cleaner console
    
    if (!predefinedRoutes || predefinedRoutes.length === 0) {
        console.warn('No routes available to refresh');
        return;
    }
    
    const refreshPromises = predefinedRoutes.map(route => 
        loadRouteMediaForCard(route).catch(error => {
            console.warn(`Failed to refresh media for route ${route.id}:`, error);
            return null;
        })
    );
    
    try {
        await Promise.allSettled(refreshPromises);
        // Log removed for cleaner console
    } catch (error) {
        console.error('❌ Error during global media refresh:', error);
    }
};

function renderRouteMiniMapFor(container, route) {
    (async () => {
        try {
            if (container.__miniMapInitialized) return;
            // Ensure container is visible for Leaflet sizing
            container.style.display = 'block';
            container.style.visibility = 'visible';
            let geometry = route.geometry;
            if (!geometry) {
                try {
                    const rid = route.id || route._id;
                    const response = await fetch(`${apiBase}/routes/${rid}/geometry`);
                    if (response.ok) {
                        const data = await response.json();
                        geometry = data && data.geometry;
                    }
                } catch (_) {
                    // ignore; fallback below
                }
            }
            if (!geometry) {
                // Fallback mini preview content if geometry missing
                container.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eef2ff 0%,#e2e8f0 100%);color:#334155;font-weight:600;font-size:.8rem;border:1px solid rgba(0,0,0,0.1)"><i class='fas fa-route' style='margin-right:6px;'></i>Önizleme</div>`;
                return;
            }
            if (typeof geometry === 'string') {
                try { geometry = JSON.parse(geometry); } catch { return; }
            }
            const coords = geometry.coordinates || (geometry.geometry && geometry.geometry.coordinates);
            if (!coords || coords.length === 0) {
                container.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eef2ff 0%,#e2e8f0 100%);color:#334155;font-weight:600;font-size:.8rem;border:1px solid rgba(0,0,0,0.1)"><i class='fas fa-route' style='margin-right:6px;'></i>Önizleme</div>`;
                return;
            }

            const latlngs = coords.map(c => [c[1], c[0]]);
            const map = L.map(container, {
                attributionControl: false,
                dragging: false,
                zoomControl: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                touchZoom: false
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
            const line = L.polyline(latlngs, { interactive: false, color: '#4B5563', weight: 3 }).addTo(map);
            map.fitBounds(line.getBounds());
            // Fix sizing issues in overlays
            setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 50);
            setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 250);
            container.__miniMapInitialized = true;
        } catch (e) {
            // Silent fail for mini map
            container.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eef2ff 0%,#e2e8f0 100%);color:#334155;font-weight:600;font-size:.8rem;border:1px solid rgba(0,0,0,0.1)"><i class='fas fa-route' style='margin-right:6px;'></i>Önizleme</div>`;
        }
    })();
}

function renderRouteMiniMaps(routes) {
    const supportsIO = 'IntersectionObserver' in window;
    let observer = null;
    if (supportsIO && !window.__miniMapObserver) {
        window.__miniMapObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const id = el.dataset.routeId || el.getAttribute('data-route-id');
                    const route = (window.predefinedRoutes || []).find(r => String(r.id || r._id) === String(id));
                    if (route) {
                        renderRouteMiniMapFor(el, route);
                        obs.unobserve(el);
                    }
                }
            });
        }, { rootMargin: '200px 0px' });
    }
    observer = window.__miniMapObserver || null;

    // Eagerly render first 10 mini-maps for immediate feedback
    const eager = routes.slice(0, 10);
    eager.forEach(route => {
        const rid = route.id || route._id;
        const container = document.getElementById(`mini-map-${rid}`);
        if (!container) return;
        container.dataset.routeId = rid;
        renderRouteMiniMapFor(container, route);
    });

    // Lazily render the rest using IntersectionObserver when available
    const rest = routes.slice(10);
    rest.forEach(route => {
        const rid = route.id || route._id;
        const container = document.getElementById(`mini-map-${rid}`);
        if (!container) return;
        container.dataset.routeId = rid;
        if (observer) {
            observer.observe(container);
        } else {
            renderRouteMiniMapFor(container, route);
        }
    });
}

function handleImageError(event) {
    const img = event.target;
    const placeholder = img.dataset.placeholder;
    if (placeholder && img.src !== placeholder) {
        img.onerror = null;
        img.src = placeholder;
    }
}

// Favori rota yönetimi
function getFavoriteRoutes() {
    try {
        const stored = localStorage.getItem('favoriteRoutes');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('Favorite routes could not be loaded:', e);
        return [];
    }
}

function saveFavoriteRoutes(routes) {
    localStorage.setItem('favoriteRoutes', JSON.stringify(routes));
}

function isRouteFavorite(routeId) {
    return getFavoriteRoutes().includes(routeId);
}

function toggleFavoriteRoute(routeId) {
    const favorites = getFavoriteRoutes();
    const index = favorites.indexOf(routeId);
    if (index === -1) {
        favorites.push(routeId);
    } else {
        favorites.splice(index, 1);
    }
    saveFavoriteRoutes(favorites);
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
    // Log removed for cleaner console
    
    // Get filter values from chips (new system) or fallback to old selects
    let filters;
    
    if (document.getElementById('routeTypeChips')) {
        // New chip system
        filters = getActiveFilterValues();
    } else {
        // Fallback to old system
        const routeTypeFilter = document.getElementById('routeTypeFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');
        const durationFilter = document.getElementById('durationFilter');
        
        filters = {
            routeType: routeTypeFilter ? routeTypeFilter.value : '',
            difficulty: difficultyFilter ? difficultyFilter.value : '',
            duration: durationFilter ? durationFilter.value : ''
        };
    }
    
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

        // Favorites filter
        if (filters.favorites === 'favorites' && !isRouteFavorite(route.id)) {
            return false;
        }

        return true;
    });
    
    // Log removed for cleaner console
    displayPredefinedRoutes(filteredRoutes);
    updateRouteStats();
}

function clearRouteFilters() {
    // Log removed for cleaner console
    
    const routeTypeFilter = document.getElementById('routeTypeFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const durationFilter = document.getElementById('durationFilter');
    
    if (routeTypeFilter) routeTypeFilter.value = '';
    if (difficultyFilter) difficultyFilter.value = '';
    if (durationFilter) durationFilter.value = '';
    
    filteredRoutes = [...predefinedRoutes];
    displayPredefinedRoutes(filteredRoutes);
}

function setupRouteSearch() {
    const searchInput = document.getElementById('routeSearchInput');
    if (!searchInput) return;

    // Ensure the search input is always editable
    searchInput.removeAttribute('disabled');
    searchInput.removeAttribute('readonly');
    searchInput.style.pointerEvents = 'auto';

    const handleRouteSearch = () => {
        const query = searchInput.value.trim().toLowerCase();
        filteredRoutes = predefinedRoutes.filter(route =>
            route.name && route.name.toLowerCase().includes(query)
        );
        displayPredefinedRoutes(filteredRoutes);
        updateRouteStats();
    };

    // React to input events so the list updates as the user types
    searchInput.addEventListener('input', handleRouteSearch);
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
    // Log removed for cleaner console
    
    // Use new RouteDetailsModal if available
    if (typeof window.RouteDetailsModal !== 'undefined') {
        // Log removed for cleaner console
        const modal = window.RouteDetailsModal.getInstance();
        if (modal) {
            modal.show(route);
            return;
        }
    }
    
    // Log removed for cleaner console
    
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
    // Log removed for cleaner console
    
    try {
        // Fetch detailed route information including POIs
        const url = `${apiBase}/routes/${route.id}`;
        // Log removed for cleaner console
        
        const response = await fetch(url);
        // Log removed for cleaner console

        if (response.ok) {
            const detailedRoute = await response.json();
            // Log removed for cleaner console
            console.warn('🔍 Route details inspection:', {
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
    
    console.warn('📊 Displaying route details:', {
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
            // Log removed for cleaner console
            initializeRoutePreviewMap(previewMapId, route.id, pois);
        } else {
            console.error('❌ Preview map container still not found after timeout:', previewMapId);
            // Biraz daha bekle ve tekrar dene
            setTimeout(() => {
                const retryContainer = document.getElementById(previewMapId);
                if (retryContainer) {
                    // Log removed for cleaner console
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
        // Log removed for cleaner console
        return;
    }
    
    const chartContainerId = `elevationPreview_${route.id}`;
    const statsContainerId = `elevationStats_${route.id}`;
    
    const chartContainer = document.getElementById(chartContainerId);
    const statsContainer = document.getElementById(statsContainerId);
    
    if (!chartContainer || !statsContainer) {
        // Log removed for cleaner console
        return;
    }
    
    try {
        // Log removed for cleaner console
        
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
    // Log removed for cleaner console
    
    // Store the route globally for panel access
    window.currentSelectedRoute = route;
    // Log removed for cleaner console
    console.warn('🔍 Initial route data check:', {
        hasId: !!route.id,
        hasName: !!route.name,
        hasGeometry: !!route.geometry,
        hasPois: !!(route.pois && route.pois.length > 0),
        poisCount: route.pois ? route.pois.length : 0
    });

    // Ensure detailed data is present before displaying
    if (!route.geometry || !route.pois || route.pois.length === 0) {
        try {
            // Log removed for cleaner console
            // Log removed for cleaner console
            
            // Try multiple methods to get route data
            let detailedRoute = null;
            
            // Method 1: Standard route details API + geometry API (same as preview)
            try {
                const detailed = await loadRouteDetails(route);
                detailedRoute = detailed && (detailed.success ? detailed.route : detailed);
                
                if (detailedRoute) {
                    // Log removed for cleaner console
                    
                    // CRITICAL: Load actual route geometry (same as preview map)
                    try {
                        // Log removed for cleaner console
                        const geometryResponse = await fetch(`${apiBase}/routes/${route.id}/geometry`);
                        if (geometryResponse.ok) {
                            const geometryData = await geometryResponse.json();
                            // Log removed for cleaner console
                            
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
                                // Log removed for cleaner console
                            } else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
                                detailedRoute.geometry = geometry.geometry;
                                // Log removed for cleaner console
                            } else if (geometryData.success && geometryData.geometry) {
                                detailedRoute.geometry = geometryData.geometry;
                                // Log removed for cleaner console
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
                // Log removed for cleaner console
                
                // Try to extract geographical information from route name
                const routeName = route.name || 'Bilinmeyen Rota';
                // Log removed for cleaner console
                
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
                
                // Log removed for cleaner console
            }
            
            if (detailedRoute) {
                // Log removed for cleaner console
                
                // If still no geometry but we have POIs, try smart routing API (same as preview)
                if (!detailedRoute.geometry && detailedRoute.pois && detailedRoute.pois.length > 1) {
                    try {
                        // Log removed for cleaner console
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
                                    // Log removed for cleaner console
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
            // Log removed for cleaner console
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
         
        // Add navigation route from current location to route start
        addNavigationToRoute(route);
        
        // Refresh route media for the selected route
        try {
            // Log removed for cleaner console
            await loadRouteMediaForCard(route);
        } catch (mediaError) {
            console.warn('⚠️ Could not refresh route media:', mediaError);
        }
    
    // Ensure predefined map is initialized with multiple attempts
    let mapInitAttempts = 0;
    const maxAttempts = 3;
    
    while (!predefinedMapInitialized && mapInitAttempts < maxAttempts) {
        mapInitAttempts++;
        // Log removed for cleaner console
        
        try {
            const success = await initializePredefinedMap();
            if (success) {
                // Log removed for cleaner console
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
        // Log removed for cleaner console
        
        // Approach 1: Standard display with delays
        setTimeout(async () => {
            try {
                // Log removed for cleaner console
                
                // Force map container visibility
                const mapContainer = document.getElementById('predefinedRoutesMap');
                if (mapContainer) {
                    mapContainer.style.display = 'block';
                    mapContainer.style.visibility = 'visible';
                    mapContainer.style.opacity = '1';
                    // Log removed for cleaner console
                }
                
                // Force map size refresh
                if (predefinedMap) {
                    predefinedMap.invalidateSize();
                    setTimeout(() => predefinedMap.invalidateSize(), 100);
                    setTimeout(() => predefinedMap.invalidateSize(), 500);
                    // Log removed for cleaner console
                }
                
                // Display route
                await displayRouteOnMap(route);
                
                // Verify display after a moment
                setTimeout(() => {
                    // Log removed for cleaner console
                    // Log removed for cleaner console
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

    // Store current route id globally and refresh its media markers
    window.currentRouteId = route.id || route._id;
    await refreshMediaMarkers(window.currentRouteId);


    // Store selected route for reference
    window.currentSelectedRoute = route;
    window.currentRouteId = route.id || route._id;
    await refreshMediaMarkers(window.currentRouteId);

    // Log removed for cleaner console
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
    // Log removed for cleaner console
    
    // Ensure map is initialized
    if (!map) {
        // Log removed for cleaner console
        await initializeEmptyMap();
        if (!map) {
            console.error('❌ Failed to initialize map');
            return;
        }
    }
    
    // Clear existing markers
    markers.forEach(marker => {
        try {
            if (poiCluster && poiCluster.hasLayer && poiCluster.hasLayer(marker)) {
                poiCluster.removeLayer(marker);
            } else if (marker && marker.remove) {
                marker.remove();
            }
        } catch (_) {}
    });
    markers = [];
    mapState.markers = markers;
    
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
                            <span style="transform: rotate(45deg);"><i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i></span>
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
                
                // Log removed for cleaner console
            } catch (error) {
                console.error(`❌ Error adding marker for POI ${poi.name}:`, error);
            }
        } else {
            console.warn(`POI ${poi.name} has no coordinates: lat=${poi.lat}, lon=${poi.lon}`);
        }
    }
    
    // Log removed for cleaner console
    
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
    
    // Log removed for cleaner console
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
            // Log removed for cleaner console
            map.setView([lat, lon], 15);
        } else {
            // Multiple POIs - fit bounds
            const coordinates = validPOIs.map(poi => [parseFloat(poi.lat), parseFloat(poi.lon)]);
            const bounds = L.latLngBounds(coordinates);
            // Log removed for cleaner console
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
    if (!window.MapControllerImpl) {
        console.error('MapControllerImpl module is not available');
        return false;
    }

    const result = await window.MapControllerImpl.initializeMainMapImpl(mapState, {
        L,
        addBaseLayers,
        ensurePOISearchBar,
        addTimeout,
    });

    map = mapState.map;
    markers = mapState.markers;
    poiCluster = mapState.poiCluster;
    mapInitializationPromise = mapState.mapInitializationPromise;
    mapInitialized = mapState.mapInitialized;

    return result;
}

// Backward compatibility - keep the old function name
async function initializeMapForRoute() {
    return await initializeMainMap();
}

// --------- Standalone 360° Panoramas on User Map ---------
let panoramaLayer;
const panoramaMarkersByAlertId = new Map();
let lastOpenedPanoramaDeepLinkKey = '';

function normalizePanoramaMediaPath(path) {
    if (!path || typeof path !== 'string') return '';
    return path.startsWith('/') ? path : `/${path}`;
}

function sanitizePanoramaAlertIdSegment(value) {
    const normalized = String(value || '')
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || '';
}

function getPanoramaFallbackStem(panorama) {
    const rawPath = String(panorama?.filename || panorama?.path || panorama?.original_path || '').trim();
    if (!rawPath) return 'panorama';

    const pathWithoutQuery = rawPath.split(/[?#]/, 1)[0];
    const filename = pathWithoutQuery.split('/').pop() || pathWithoutQuery;
    const stem = filename.replace(/\.[^.]+$/, '');
    return sanitizePanoramaAlertIdSegment(stem) || 'panorama';
}

function derivePanoramaAlertId(panorama, resolvedSourceType) {
    const existingId = String(panorama?.alert_id || panorama?.id || panorama?._id || '').trim();
    if (existingId.startsWith('panorama:') || existingId.startsWith('route-panorama:')) {
        return existingId;
    }

    if (resolvedSourceType === 'route') {
        const routeId = sanitizePanoramaAlertIdSegment(String(panorama?.route_id || '').trim()) || 'unknown';
        return `route-panorama:${routeId}:${getPanoramaFallbackStem(panorama)}`;
    }

    const standaloneId = sanitizePanoramaAlertIdSegment(existingId) || getPanoramaFallbackStem(panorama);
    return `panorama:${standaloneId}`;
}

function createPanoramaAlertRecord(panorama, sourceType = '') {
    const resolvedSourceType = String(sourceType || panorama?.source_type || (panorama?.route_id != null ? 'route' : 'standalone')).trim() || 'standalone';
    const lat = typeof panorama?.lat === 'number' ? panorama.lat : parseFloat(panorama?.lat ?? panorama?.latitude);
    const lng = typeof panorama?.lng === 'number' ? panorama.lng : parseFloat(panorama?.lng ?? panorama?.longitude);
    const caption = String(panorama?.caption || panorama?.name || '').trim();
    const alertId = derivePanoramaAlertId(panorama, resolvedSourceType);

    return {
        ...(panorama && typeof panorama === 'object' ? panorama : {}),
        id: alertId,
        _id: alertId,
        name: caption || '360° Panorama',
        caption,
        entity_type: 'panorama',
        source_type: resolvedSourceType,
        kind_label: '360° Panorama',
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        path: String(panorama?.path || '').trim(),
        original_path: String(panorama?.original_path || '').trim(),
        pyramid_levels: Array.isArray(panorama?.pyramid_levels) ? panorama.pyramid_levels : [],
    };
}

function buildPanoramaDeepLink(panorama) {
    const alertItem = createPanoramaAlertRecord(panorama);
    if (!alertItem.id) return '';

    const targetUrl = new URL('/personal_routes.html', window.location.origin);
    targetUrl.searchParams.set('panorama', alertItem.id);
    if (alertItem.source_type) {
        targetUrl.searchParams.set('panoramaSource', alertItem.source_type);
    }
    if (alertItem.path) {
        targetUrl.searchParams.set('panoramaPath', alertItem.path);
    }
    if (alertItem.original_path) {
        targetUrl.searchParams.set('panoramaOriginalPath', alertItem.original_path);
    }
    if (alertItem.caption || alertItem.name) {
        targetUrl.searchParams.set('panoramaTitle', alertItem.caption || alertItem.name);
    }

    return targetUrl.toString();
}

function buildPanoramaQueryFallback(params) {
    const panoramaPath = String(params?.get('panoramaPath') || '').trim();
    if (!panoramaPath) return null;

    const panoramaId = String(params?.get('panorama') || '').trim();
    const sourceType = String(params?.get('panoramaSource') || '').trim() || 'standalone';
    const panoramaOriginalPath = String(params?.get('panoramaOriginalPath') || '').trim();
    const panoramaTitle = String(params?.get('panoramaTitle') || '').trim() || '360° Panorama';

    return createPanoramaAlertRecord({
        id: panoramaId,
        alert_id: panoramaId,
        source_type: sourceType,
        path: panoramaPath,
        original_path: panoramaOriginalPath,
        caption: panoramaTitle,
        name: panoramaTitle,
    }, sourceType);
}

async function fetchPanoramaAlertItemById(alertId, preferredSourceType = '') {
    const normalizedAlertId = String(alertId || '').trim();
    if (!normalizedAlertId) return null;

    const sourceOrder = preferredSourceType === 'route'
        ? [
            { endpoint: '/api/route-panoramas', sourceType: 'route' },
            { endpoint: '/api/panoramas', sourceType: 'standalone' },
        ]
        : preferredSourceType === 'standalone'
            ? [
                { endpoint: '/api/panoramas', sourceType: 'standalone' },
                { endpoint: '/api/route-panoramas', sourceType: 'route' },
            ]
            : [
                { endpoint: '/api/panoramas', sourceType: 'standalone' },
                { endpoint: '/api/route-panoramas', sourceType: 'route' },
            ];

    for (const source of sourceOrder) {
        try {
            const response = await fetch(source.endpoint, { credentials: 'include' });
            if (!response.ok) continue;

            const payload = await response.json();
            const items = Array.isArray(payload) ? payload : (payload.panoramas || []);
            const matchedItem = items
                .map((item) => createPanoramaAlertRecord(item, source.sourceType))
                .find((item) => item.id === normalizedAlertId);

            if (matchedItem) {
                return matchedItem;
            }
        } catch (error) {
            console.warn('Panorama deep-link source could not be loaded:', source.endpoint, error);
        }
    }

    return null;
}

async function openPanoramaDeepLinkById(alertId, preferredSourceType = '', { focusMap = true } = {}) {
    const normalizedAlertId = String(alertId || '').trim();
    if (!normalizedAlertId) return false;

    const normalizedSourceType = String(preferredSourceType || '').trim();
    const deepLinkKey = `${normalizedSourceType}:${normalizedAlertId}`;
    if (lastOpenedPanoramaDeepLinkKey === deepLinkKey) {
        return true;
    }

    const panorama = await fetchPanoramaAlertItemById(normalizedAlertId, normalizedSourceType);
    if (!panorama) return false;

    lastOpenedPanoramaDeepLinkKey = deepLinkKey;

    try {
        return await openPanoramaAlertItem(panorama, { focusMap });
    } catch (error) {
        if (lastOpenedPanoramaDeepLinkKey === deepLinkKey) {
            lastOpenedPanoramaDeepLinkKey = '';
        }
        throw error;
    }
}

async function focusPanoramaOnMap(panorama) {
    const alertItem = createPanoramaAlertRecord(panorama);
    const lat = parseFloat(alertItem.latitude ?? alertItem.lat);
    const lng = parseFloat(alertItem.longitude ?? alertItem.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const mapSection = document.getElementById('mapSection');
    if (mapSection) {
        mapSection.style.display = 'block';
    }

    try {
        if ((!map || !map._loaded) && document.getElementById('mapContainer') && typeof initializeMainMap === 'function') {
            await initializeMainMap();
        }
    } catch (error) {
        console.warn('Panorama map initialization failed:', error);
    }

    const targetMap = (typeof predefinedMap !== 'undefined' && predefinedMap) ? predefinedMap : map;
    if (!targetMap) return;

    try {
        if (!panoramaLayer || !panoramaMarkersByAlertId.has(alertItem.id)) {
            await loadPanoramasLayer();
        }
    } catch (error) {
        console.warn('Panorama markers could not be refreshed:', error);
    }

    try {
        targetMap.setView([lat, lng], 16, { animate: true });
    } catch (_) {
        targetMap.setView([lat, lng], 16);
    }

    try {
        const marker = panoramaMarkersByAlertId.get(alertItem.id);
        if (marker) marker.openPopup();
    } catch (_) {}

    try {
        if (mapSection) {
            mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (_) {}
}

async function openPanoramaAlertItem(panorama, { focusMap = true } = {}) {
    const alertItem = createPanoramaAlertRecord(panorama);
    const imageUrl = normalizePanoramaMediaPath(alertItem.path);
    if (!imageUrl || typeof openPanoramaViewer !== 'function') return false;

    const originalUrl = normalizePanoramaMediaPath(alertItem.original_path);
    const pyramidEncoded = encodeURIComponent(JSON.stringify(Array.isArray(alertItem.pyramid_levels) ? alertItem.pyramid_levels : []));
    openPanoramaViewer(imageUrl, alertItem.caption || alertItem.name || '360° Panorama', pyramidEncoded, originalUrl);

    if (focusMap) {
        try {
            await focusPanoramaOnMap(alertItem);
        } catch (error) {
            console.warn('Panorama map focus failed:', error);
        }
    }

    return true;
}

window.fetchPanoramaAlertItemById = fetchPanoramaAlertItemById;
window.openPanoramaDeepLinkById = openPanoramaDeepLinkById;
window.focusPanoramaOnMap = focusPanoramaOnMap;
window.openPanoramaAlertItem = openPanoramaAlertItem;

async function loadPanoramasLayer() {
    try {
        // Support both dynamic map (`map`) and predefined routes map (`predefinedMap`)
        const targetMap = (typeof predefinedMap !== 'undefined' && predefinedMap) ? predefinedMap : map;
        if (!targetMap) return;
        // Create layer if needed
        if (!panoramaLayer) {
            panoramaLayer = L.layerGroup();
            targetMap.addLayer(panoramaLayer);
        } else {
            panoramaLayer.clearLayers();
        }
        panoramaMarkersByAlertId.clear();

        // Simple heuristic to detect 360° image by filename keywords
        const isPanoramicCandidate = (name) => {
            if (!name || typeof name !== 'string') return false;
            const lower = name.toLowerCase();
            return /(\b|[_-])(360|pano|panorama|equirect|spherical)(\b|[_-]|\.)/.test(lower);
        };

        const res = await fetch('/api/panoramas', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.panoramas || []);

        items.forEach(pano => {
            const panoramaItem = createPanoramaAlertRecord(pano, 'standalone');
            const lat = typeof panoramaItem.lat === 'number' ? panoramaItem.lat : parseFloat(panoramaItem.lat);
            const lng = typeof panoramaItem.lng === 'number' ? panoramaItem.lng : parseFloat(panoramaItem.lng);
            if (isNaN(lat) || isNaN(lng)) return;

            const icon = L.divIcon({
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

            const mediaPath = normalizePanoramaMediaPath(panoramaItem.path);
            const caption = panoramaItem.caption || '360° Panorama';
            const pyramidEncoded = encodeURIComponent(JSON.stringify(Array.isArray(panoramaItem.pyramid_levels) ? panoramaItem.pyramid_levels : []));
            const originalPath = normalizePanoramaMediaPath(panoramaItem.original_path);

            const marker = L.marker([lat, lng], { icon })
                .bindPopup(`
                    <div style="min-width:180px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:10px;font-weight:800;">360°</span>
                            <strong>360° Panorama</strong>
                        </div>
                        ${caption ? `<div style=\"color:#444;font-size:0.9rem;margin-bottom:6px;\">${caption}</div>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="openPanoramaViewer('${mediaPath.replace(/'/g, "\\'")}', '${(caption || '').replace(/'/g, "\\'")}', '${pyramidEncoded.replace(/'/g, "\\'")}', '${(originalPath || '').replace(/'/g, "\\'")}')">
                            <i class="fas fa-vr-cardboard"></i> Aç
                        </button>
                    </div>
                `);
            marker.panoramaData = panoramaItem;
            if (panoramaItem.id) {
                panoramaMarkersByAlertId.set(panoramaItem.id, marker);
            }
            panoramaLayer.addLayer(marker);
        });

        // Also load route media with coordinates and show only true 360° (server marks is_pano)
        try {
            const res2 = await fetch('/api/route-panoramas', { credentials: 'include' });
            if (res2.ok) {
                const data2 = await res2.json();
                const items2 = Array.isArray(data2) ? data2 : (data2.panoramas || []);
                items2.forEach(p => {
                    const panoramaItem = createPanoramaAlertRecord(p, 'route');
                    const lat = typeof panoramaItem.lat === 'number' ? panoramaItem.lat : parseFloat(panoramaItem.lat);
                    const lng = typeof panoramaItem.lng === 'number' ? panoramaItem.lng : parseFloat(panoramaItem.lng);
                    if (isNaN(lat) || isNaN(lng)) return;
                    // Prefer server-side flag; fallback to name heuristic
                    if (p && p.is_pano !== undefined) {
                        if (!p.is_pano) return;
                    } else if (p && p.media_type === 'panorama') {
                        // accept
                    } else {
                        if (!isPanoramicCandidate(p.filename)) return;
                    }

                    const icon = L.divIcon({
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

                    const mediaPath = normalizePanoramaMediaPath(panoramaItem.path);
                    const caption = panoramaItem.caption || 'Rota Medyası 360°';
                    const pyramidEncoded = encodeURIComponent(JSON.stringify(Array.isArray(panoramaItem.pyramid_levels) ? panoramaItem.pyramid_levels : []));
                    const originalPath = normalizePanoramaMediaPath(panoramaItem.original_path);

                    const marker = L.marker([lat, lng], { icon })
                        .bindPopup(`
                            <div style="min-width:180px;">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                                    <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:10px;font-weight:800;">360°</span>
                                    <strong>360° Panorama</strong>
                                </div>
                                ${caption ? `<div style=\"color:#444;font-size:0.9rem;margin-bottom:6px;\">${caption}</div>` : ''}
                                <button class="btn btn-sm btn-primary" onclick="openPanoramaViewer('${mediaPath.replace(/'/g, "\\'")}', '${(caption || '').replace(/'/g, "\\'")}', '${pyramidEncoded.replace(/'/g, "\\'")}', '${(originalPath || '').replace(/'/g, "\\'")}')">
                                    <i class="fas fa-vr-cardboard"></i> Aç
                                </button>
                            </div>
                        `);
                    marker.panoramaData = panoramaItem;
                    if (panoramaItem.id) {
                        panoramaMarkersByAlertId.set(panoramaItem.id, marker);
                    }
                    panoramaLayer.addLayer(marker);
                });
            }
        } catch (e2) {
            console.warn('Route panoramas load error:', e2);
        }
    } catch (e) {
        console.warn('Panoramas load error:', e);
    }
}

window.loadPanoramasLayer = loadPanoramasLayer;

function openPanoramaViewer(imageUrl, caption, pyramidEncoded = '', originalUrl = '') {
    try {
        const normalContainerStyle = 'position:relative;width:90vw;max-width:1200px;height:75vh;border-radius:12px;overflow:hidden;background:#000;';
        const vrContainerStyle = 'position:relative;width:100vw;max-width:none;height:100vh;border-radius:0;overflow:hidden;background:#000;';
        const eyeOffset = 1.6;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

        const container = document.createElement('div');
        container.style.cssText = normalContainerStyle;

        const actions = document.createElement('div');
        actions.style.cssText = 'position:absolute;top:10px;right:10px;z-index:10000;display:flex;gap:8px;';

        const vrBtn = document.createElement('button');
        vrBtn.innerHTML = '<i class="fas fa-vr-cardboard"></i> VR';
        vrBtn.className = 'btn btn-light btn-sm';
        vrBtn.title = 'Cardboard modu';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.className = 'btn btn-light btn-sm';

        const title = document.createElement('div');
        title.textContent = caption || '360° Panorama';
        title.style.cssText = 'position:absolute;left:16px;top:12px;color:#fff;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.6);z-index:10000;';

        const viewerDiv = document.createElement('div');
        viewerDiv.style.cssText = 'width:100%;height:100%;';

        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(17,24,39,.82);color:#fff;font-size:12px;z-index:10000;display:none;text-align:center;max-width:90%;';

        actions.appendChild(vrBtn);
        actions.appendChild(closeBtn);
        container.appendChild(viewerDiv);
        container.appendChild(actions);
        container.appendChild(title);
        container.appendChild(hint);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        const originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        let isClosing = false;
        let isVrMode = false;
        let hintTimer = null;
        let normalViewer = null;
        let stereoLeftViewer = null;
        let stereoRightViewer = null;
        let stereoSyncRafId = null;
        let stereoGestureCleanup = null;
        let stereoOrientationActive = false;
        let usingOfficialStereo = false;
        let officialViewer = null;
        let officialStereoPlugin = null;
        let officialModules = null;
        let sourceWatchTimer = null;
        let sourceSwitchInFlight = false;
        let sourceSwitchCooldownUntil = 0;
        let currentPanoramaUrl = '';
        let activeVariant = null;
        let nativeVrBridgeActive = false;

        const getFullscreenElement = () => (
            document.fullscreenElement
            || document.webkitFullscreenElement
            || document.mozFullScreenElement
            || document.msFullscreenElement
            || null
        );

        const requestElementFullscreen = async (element) => {
            if (!element) return false;
            if (getFullscreenElement()) return true;
            const requestFn = element.requestFullscreen
                || element.webkitRequestFullscreen
                || element.mozRequestFullScreen
                || element.msRequestFullscreen;
            if (typeof requestFn !== 'function') return false;
            try {
                const result = requestFn.call(element);
                if (result && typeof result.then === 'function') {
                    await result;
                }
                return !!getFullscreenElement();
            } catch (_) {
                return false;
            }
        };

        const exitAnyFullscreen = async () => {
            const exitFn = document.exitFullscreen
                || document.webkitExitFullscreen
                || document.mozCancelFullScreen
                || document.msExitFullscreen;
            if (typeof exitFn !== 'function' || !getFullscreenElement()) return false;
            try {
                const result = exitFn.call(document);
                if (result && typeof result.then === 'function') {
                    await result;
                }
                return !getFullscreenElement();
            } catch (_) {
                return false;
            }
        };

        const setViewerPresentation = (immersive) => {
            overlay.style.alignItems = immersive ? 'stretch' : 'center';
            overlay.style.justifyContent = immersive ? 'stretch' : 'center';
            overlay.style.padding = immersive ? '0' : '16px';
            overlay.style.background = immersive ? '#000' : 'rgba(0,0,0,.88)';
            container.style.cssText = immersive ? vrContainerStyle : normalContainerStyle;
        };

        const normalizePanoramaUrl = (value) => {
            if (!value || typeof value !== 'string') return '';
            if (/^(https?:)?\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
                return value;
            }
            return value.startsWith('/') ? value : `/${value}`;
        };

        const hasNativeVrBridge = () => (
            !!window.APDAndroid
            && typeof window.APDAndroid.enterVrMode === 'function'
            && typeof window.APDAndroid.exitVrMode === 'function'
        );

        const decodePyramidLevels = (raw) => {
            if (!raw || typeof raw !== 'string') return [];
            try {
                const decoded = decodeURIComponent(raw);
                const arr = JSON.parse(decoded);
                return Array.isArray(arr) ? arr : [];
            } catch (_) {
                return [];
            }
        };

        const normalizedImageUrl = normalizePanoramaUrl(imageUrl);
        const normalizedOriginalUrl = normalizePanoramaUrl(originalUrl);
        const providedLevels = decodePyramidLevels(pyramidEncoded);
        const variantMap = new Map();
        const pushVariant = (item, fallbackLabel = 'level') => {
            if (!item || typeof item !== 'object') return;
            const rawPath = typeof item.path === 'string' ? item.path : '';
            const url = normalizePanoramaUrl(rawPath);
            if (!url) return;
            const width = Number(item.width) || null;
            const height = Number(item.height) || null;
            const maxEdge = Number(item.max_edge) || Math.max(width || 0, height || 0) || 0;
            const existing = variantMap.get(url);
            if (existing) {
                variantMap.set(url, {
                    ...existing,
                    label: existing.label || item.label || fallbackLabel,
                    width: width || existing.width || null,
                    height: height || existing.height || null,
                    max_edge: Math.max(Number(existing.max_edge) || 0, maxEdge),
                    role: existing.role || item.role || null,
                });
                return;
            }
            variantMap.set(url, {
                url,
                label: item.label || fallbackLabel,
                width,
                height,
                max_edge: maxEdge,
                role: item.role || null,
            });
        };
        providedLevels.forEach((lvl) => pushVariant(lvl, 'pyramid'));
        if (normalizedImageUrl) {
            pushVariant({ path: normalizedImageUrl, label: 'base' }, 'base');
        }
        if (normalizedOriginalUrl) {
            pushVariant({ path: normalizedOriginalUrl, label: 'original', role: 'original' }, 'original');
        }
        const sourceVariants = Array.from(variantMap.values()).sort((a, b) => {
            const da = Number(a.max_edge) || 0;
            const db = Number(b.max_edge) || 0;
            if (da !== db) return da - db;
            if (a.role === 'original' && b.role !== 'original') return 1;
            if (b.role === 'original' && a.role !== 'original') return -1;
            return String(a.label || '').localeCompare(String(b.label || ''));
        });
        activeVariant = sourceVariants.find((v) => v.url === normalizedImageUrl) || sourceVariants[0] || null;
        currentPanoramaUrl = (activeVariant && activeVariant.url) || normalizedImageUrl || imageUrl;

        const MIN_HFOV = 8;
        const MAX_HFOV = 130;

        const clampHfov = (value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return null;
            return Math.max(MIN_HFOV, Math.min(MAX_HFOV, numeric));
        };

        const chooseVariantByHfov = (hfov, mode = 'normal') => {
            if (!Array.isArray(sourceVariants) || sourceVariants.length === 0) return null;
            if (!Number.isFinite(hfov)) return activeVariant || sourceVariants[0];
            const clamped = clampHfov(hfov);
            if (!Number.isFinite(clamped)) return activeVariant || sourceVariants[0];
            const vpW = Math.max(1, viewerDiv.clientWidth || window.innerWidth || 1);
            const vpH = Math.max(1, viewerDiv.clientHeight || window.innerHeight || 1);
            const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
            const viewportEdge = Math.max(vpW, vpH);
            const modeQualityBoost = mode === 'vr' ? 1.08 : 1.45;
            const baseRequiredEdge = viewportEdge * dpr * 3.8 * modeQualityBoost;
            const zoomFactor = MAX_HFOV / clamped;
            const requiredEdge = baseRequiredEdge * Math.max(1, zoomFactor);

            const sorted = [...sourceVariants].sort((a, b) => (Number(a.max_edge) || 0) - (Number(b.max_edge) || 0));
            const picked = sorted.find((v) => (Number(v.max_edge) || 0) >= requiredEdge);
            if (picked) return picked;
            return sorted[sorted.length - 1] || sourceVariants[sourceVariants.length - 1];
        };

        const stopAdaptiveSourceMonitor = () => {
            if (sourceWatchTimer !== null) {
                clearInterval(sourceWatchTimer);
                sourceWatchTimer = null;
            }
        };

        const setVrButtonState = (enabled) => {
            isVrMode = !!enabled;
            if (enabled) {
                vrBtn.classList.remove('btn-light');
                vrBtn.classList.add('btn-success');
                vrBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i> Normal';
                vrBtn.title = 'Normal moda dön';
                title.style.display = 'none';
            } else {
                vrBtn.classList.remove('btn-success');
                vrBtn.classList.add('btn-light');
                vrBtn.innerHTML = '<i class="fas fa-vr-cardboard"></i> VR';
                vrBtn.title = 'Cardboard modu';
                title.style.display = 'block';
            }
        };

        const normalizeYaw = (yaw) => {
            if (!Number.isFinite(yaw)) return yaw;
            let out = yaw;
            while (out > 180) out -= 360;
            while (out < -180) out += 360;
            return out;
        };

        const showHint = (text, ms = 2600) => {
            hint.textContent = text;
            hint.style.display = 'block';
            if (hintTimer) clearTimeout(hintTimer);
            hintTimer = setTimeout(() => {
                hint.style.display = 'none';
                hintTimer = null;
            }, ms);
        };

        const lockLandscapeOrientation = async () => {
            try {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    await screen.orientation.lock('landscape');
                    return true;
                }
            } catch (_) {}
            return false;
        };

        const enterNativeVrMode = async () => {
            if (!hasNativeVrBridge()) return false;
            try {
                const result = window.APDAndroid.enterVrMode();
                nativeVrBridgeActive = result !== false;
                return nativeVrBridgeActive;
            } catch (_) {
                nativeVrBridgeActive = false;
                return false;
            }
        };

        const exitNativeVrMode = async () => {
            if (!nativeVrBridgeActive || !hasNativeVrBridge()) {
                nativeVrBridgeActive = false;
                return false;
            }
            try {
                window.APDAndroid.exitVrMode();
                nativeVrBridgeActive = false;
                return true;
            } catch (_) {
                nativeVrBridgeActive = false;
                return false;
            }
        };

        const describeVrState = (immersiveState, baseText) => {
            if (!immersiveState || immersiveState.fullscreenActive === false) {
                return `${baseText} Tam ekran açılamadı; görünüm sayfaya sabitlendi.`;
            }
            if (immersiveState.orientationLocked === false) {
                return `${baseText} En iyi sonuç için telefonu yatay kullanın.`;
            }
            return baseText;
        };

        const enterVrImmersiveMode = async () => {
            setViewerPresentation(true);
            const nativeVrActive = await enterNativeVrMode();
            const fullscreenRequested = await requestElementFullscreen(container);
            const fullscreenActive = fullscreenRequested || nativeVrActive;
            const orientationLocked = nativeVrActive || await lockLandscapeOrientation();
            return {
                fullscreenActive,
                orientationLocked,
                nativeVrActive,
            };
        };

        const readCurrentHfov = () => {
            try {
                if (usingOfficialStereo && officialViewer && typeof officialViewer.getZoomLevel === 'function') {
                    const zoomLevel = Number(officialViewer.getZoomLevel());
                    if (Number.isFinite(zoomLevel)) {
                        // PSV zoom level (0..100) -> yaklaşık hfov (MAX_HFOV..MIN_HFOV)
                        const ratio = Math.max(0, Math.min(100, zoomLevel)) / 100;
                        return MAX_HFOV - (ratio * (MAX_HFOV - MIN_HFOV));
                    }
                }
            } catch (_) {}
            try {
                if (!isVrMode && officialViewer && typeof officialViewer.getZoomLevel === 'function') {
                    const zoomLevel = Number(officialViewer.getZoomLevel());
                    if (Number.isFinite(zoomLevel)) {
                        const ratio = Math.max(0, Math.min(100, zoomLevel)) / 100;
                        return MAX_HFOV - (ratio * (MAX_HFOV - MIN_HFOV));
                    }
                }
            } catch (_) {}
            try {
                if (isVrMode && stereoLeftViewer && typeof stereoLeftViewer.getHfov === 'function') {
                    return Number(stereoLeftViewer.getHfov());
                }
            } catch (_) {}
            try {
                if (!isVrMode && normalViewer && typeof normalViewer.getHfov === 'function') {
                    return Number(normalViewer.getHfov());
                }
            } catch (_) {}
            return null;
        };

        const setPannellumPanorama = (viewer, nextUrl) => new Promise((resolve, reject) => {
            if (!viewer || typeof viewer.setPanorama !== 'function') {
                reject(new Error('setPanorama is unavailable'));
                return;
            }
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                resolve(true);
            };
            const fail = (err) => {
                if (settled) return;
                settled = true;
                reject(err || new Error('setPanorama failed'));
            };
            const timeout = setTimeout(done, 1800);
            try {
                viewer.setPanorama(nextUrl, () => {
                    clearTimeout(timeout);
                    done();
                });
            } catch (err) {
                clearTimeout(timeout);
                fail(err);
            }
        });

        const switchPanoramaSource = async (nextVariant) => {
            if (!nextVariant || !nextVariant.url) return false;
            if (nextVariant.url === currentPanoramaUrl) {
                activeVariant = nextVariant;
                return false;
            }
            if (sourceSwitchInFlight || Date.now() < sourceSwitchCooldownUntil) return false;
            if (usingOfficialStereo && officialViewer) {
                // Official stereo plugin ile runtime source switch kararsız olabildiği için skip.
                return false;
            }

            sourceSwitchInFlight = true;
            sourceSwitchCooldownUntil = Date.now() + 480;
            try {
                if (isVrMode && stereoLeftViewer && stereoRightViewer) {
                    const yaw = (typeof stereoLeftViewer.getYaw === 'function') ? stereoLeftViewer.getYaw() : 0;
                    const pitch = (typeof stereoLeftViewer.getPitch === 'function') ? stereoLeftViewer.getPitch() : 0;
                    const hfov = (typeof stereoLeftViewer.getHfov === 'function') ? stereoLeftViewer.getHfov() : 100;
                    await Promise.all([
                        setPannellumPanorama(stereoLeftViewer, nextVariant.url),
                        setPannellumPanorama(stereoRightViewer, nextVariant.url),
                    ]);
                    currentPanoramaUrl = nextVariant.url;
                    activeVariant = nextVariant;
                    applyStereoLook(yaw, pitch, hfov);
                    return true;
                }

                if (!isVrMode && officialViewer && !usingOfficialStereo && typeof officialViewer.setPanorama === 'function') {
                    let currentPos = null;
                    let currentZoom = null;
                    try {
                        if (typeof officialViewer.getPosition === 'function') {
                            currentPos = officialViewer.getPosition();
                        }
                    } catch (_) {}
                    try {
                        if (typeof officialViewer.getZoomLevel === 'function') {
                            const z = Number(officialViewer.getZoomLevel());
                            currentZoom = Number.isFinite(z) ? z : null;
                        }
                    } catch (_) {}

                    const panoOpts = {
                        transition: false,
                    };
                    if (currentPos && Number.isFinite(currentPos.yaw) && Number.isFinite(currentPos.pitch)) {
                        panoOpts.position = { yaw: currentPos.yaw, pitch: currentPos.pitch };
                    }
                    if (Number.isFinite(currentZoom)) {
                        panoOpts.zoom = currentZoom;
                    }

                    await officialViewer.setPanorama(nextVariant.url, panoOpts);
                    currentPanoramaUrl = nextVariant.url;
                    activeVariant = nextVariant;
                    return true;
                }

                if (!isVrMode && normalViewer) {
                    const yaw = (typeof normalViewer.getYaw === 'function') ? normalViewer.getYaw() : 0;
                    const pitch = (typeof normalViewer.getPitch === 'function') ? normalViewer.getPitch() : 0;
                    const hfov = (typeof normalViewer.getHfov === 'function') ? normalViewer.getHfov() : 100;
                    await setPannellumPanorama(normalViewer, nextVariant.url);
                    currentPanoramaUrl = nextVariant.url;
                    activeVariant = nextVariant;
                    if (typeof normalViewer.lookAt === 'function') {
                        normalViewer.lookAt(pitch, yaw, hfov, false);
                    }
                    return true;
                }
            } catch (err) {
                console.warn('Panorama source switch failed:', err);
            } finally {
                sourceSwitchInFlight = false;
            }
            return false;
        };

        const startAdaptiveSourceMonitor = () => {
            stopAdaptiveSourceMonitor();
            if (!Array.isArray(sourceVariants) || sourceVariants.length < 2) return;
            sourceWatchTimer = setInterval(async () => {
                if (isClosing || sourceSwitchInFlight) return;
                const hfov = readCurrentHfov();
                if (!Number.isFinite(hfov)) return;
                const mode = isVrMode ? 'vr' : 'normal';
                const nextVariant = chooseVariantByHfov(hfov, mode);
                if (!nextVariant || nextVariant.url === currentPanoramaUrl) return;
                const switched = await switchPanoramaSource(nextVariant);
                if (switched && nextVariant.label) {
                    showHint(`Detay seviyesi: ${nextVariant.label}`, 1100);
                }
            }, 280);
        };

        const loadScript = (src) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1') return resolve();
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`script load failed: ${src}`)), { once: true });
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.dataset.dynamicSrc = src;
            s.onload = () => { s.dataset.loaded = '1'; resolve(); };
            s.onerror = () => reject(new Error(`script load failed: ${src}`));
            document.head.appendChild(s);
        });

        const loadCss = (href) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`link[data-dynamic-href="${href}"]`);
            if (existing) return resolve();
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            l.dataset.dynamicHref = href;
            l.onload = resolve;
            l.onerror = () => reject(new Error(`css load failed: ${href}`));
            document.head.appendChild(l);
        });

        const ensurePannellum = async () => {
            if (window.pannellum) return true;
            try {
                await loadCss('https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css');
                await loadScript('https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js');
                return !!window.pannellum;
            } catch (_) {
                return false;
            }
        };

        const ensureOfficialModules = async () => {
            if (window.__PSV_STEREO_MODULES__) return window.__PSV_STEREO_MODULES__;
            try {
                await loadCss('https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.css');
                const [coreMod, gyroMod, stereoMod] = await Promise.all([
                    import('https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/+esm'),
                    import('https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/gyroscope-plugin@5/+esm'),
                    import('https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/stereo-plugin@5/+esm'),
                ]);
                const modules = {
                    Viewer: coreMod.Viewer,
                    GyroscopePlugin: gyroMod.GyroscopePlugin,
                    StereoPlugin: stereoMod.StereoPlugin,
                };
                window.__PSV_STEREO_MODULES__ = modules;
                return modules;
            } catch (e) {
                console.warn('Official PSV module load failed:', e);
                return null;
            }
        };

        const stopStereoLoop = () => {
            if (stereoSyncRafId !== null) {
                cancelAnimationFrame(stereoSyncRafId);
                stereoSyncRafId = null;
            }
        };

        const stopStereoOrientation = () => {
            stereoOrientationActive = false;
            if (stereoLeftViewer) {
                try { if (typeof stereoLeftViewer.stopOrientation === 'function') stereoLeftViewer.stopOrientation(); } catch (_) {}
            }
            if (stereoRightViewer) {
                try { if (typeof stereoRightViewer.stopOrientation === 'function') stereoRightViewer.stopOrientation(); } catch (_) {}
            }
        };

        const destroyStereo = () => {
            stopStereoLoop();
            stopStereoOrientation();
            if (stereoGestureCleanup) {
                try { stereoGestureCleanup(); } catch (_) {}
                stereoGestureCleanup = null;
            }
            if (stereoLeftViewer) {
                try { stereoLeftViewer.destroy(); } catch (_) {}
                stereoLeftViewer = null;
            }
            if (stereoRightViewer) {
                try { stereoRightViewer.destroy(); } catch (_) {}
                stereoRightViewer = null;
            }
        };

        const destroyOfficialStereo = () => {
            usingOfficialStereo = false;
            if (officialStereoPlugin) {
                try {
                    if (typeof officialStereoPlugin.isEnabled === 'function' && officialStereoPlugin.isEnabled()) {
                        officialStereoPlugin.stop();
                    }
                } catch (_) {}
                officialStereoPlugin = null;
            }
            if (officialViewer) {
                try { officialViewer.destroy(); } catch (_) {}
                officialViewer = null;
            }
            officialModules = null;
        };

        const destroyNormal = () => {
            if (normalViewer) {
                try { normalViewer.destroy(); } catch (_) {}
                normalViewer = null;
            }
        };

        const destroyAllViewers = () => {
            stopAdaptiveSourceMonitor();
            destroyOfficialStereo();
            destroyStereo();
            destroyNormal();
            viewerDiv.innerHTML = '';
        };

        const unlockOrientation = () => {
            try {
                if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                    screen.orientation.unlock();
                }
            } catch (_) {}
        };

        const exitVrImmersiveMode = async () => {
            unlockOrientation();
            await exitAnyFullscreen();
            await exitNativeVrMode();
            setViewerPresentation(false);
        };

        const closeViewer = () => {
            if (isClosing) return;
            isClosing = true;
            destroyAllViewers();
            if (hintTimer) {
                clearTimeout(hintTimer);
                hintTimer = null;
            }
            exitVrImmersiveMode().catch(() => {});
            document.removeEventListener('keydown', onEsc);
            overlay.removeEventListener('click', onOverlayClick);
            document.body.style.overflow = originalBodyOverflow;
            if (window.__APDClosePanoramaViewer === closeViewer) {
                delete window.__APDClosePanoramaViewer;
            }
            try { document.body.removeChild(overlay); } catch (_) {}
        };

        function onEsc(e) {
            if (e.key === 'Escape') closeViewer();
        }

        function onOverlayClick(e) {
            if (e.target === overlay) closeViewer();
        }

        closeBtn.onclick = closeViewer;
        window.__APDClosePanoramaViewer = closeViewer;
        document.addEventListener('keydown', onEsc);
        overlay.addEventListener('click', onOverlayClick);

        const initNormalViewer = async () => {
            if (isClosing) return false;
            const preferredNormalVariant = sourceVariants[sourceVariants.length - 1] || chooseVariantByHfov(90, 'normal');
            if (preferredNormalVariant && preferredNormalVariant.url) {
                activeVariant = preferredNormalVariant;
                currentPanoramaUrl = preferredNormalVariant.url;
            }
            await exitVrImmersiveMode();
            setVrButtonState(false);
            destroyAllViewers();

            const modules = await ensureOfficialModules();
            if (modules && !isClosing) {
                try {
                    officialModules = modules;
                    officialViewer = new officialModules.Viewer({
                        container: viewerDiv,
                        panorama: currentPanoramaUrl,
                        minFov: MIN_HFOV,
                        maxFov: MAX_HFOV,
                        mousewheel: true,
                        touchmoveTwoFingers: false,
                        navbar: ['zoom', 'fullscreen'],
                    });
                    usingOfficialStereo = false;
                    startAdaptiveSourceMonitor();
                    return true;
                } catch (e) {
                    console.warn('Normal official viewer init failed, fallback pannellum:', e);
                    destroyOfficialStereo();
                    viewerDiv.innerHTML = '';
                }
            }

            if (await ensurePannellum()) {
                if (isClosing) return false;
                try {
                    normalViewer = window.pannellum.viewer(viewerDiv, {
                        container: viewerDiv,
                        type: 'equirectangular',
                        panorama: currentPanoramaUrl,
                        autoLoad: true,
                        showZoomCtrl: true,
                        hfov: 100,
                        minHfov: MIN_HFOV,
                        maxHfov: MAX_HFOV,
                        compass: false,
                    });
                    startAdaptiveSourceMonitor();
                    return true;
                } catch (e) {
                    console.warn('Normal pannellum init failed:', e);
                }
            }

            const img = document.createElement('img');
            img.src = currentPanoramaUrl;
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
            viewerDiv.appendChild(img);
            stopAdaptiveSourceMonitor();
            showHint('Etkileşimli panorama başlatılamadı. Statik görsel gösteriliyor.', 2800);
            return false;
        };

        const requestMotionPermission = async () => {
            try {
                if (typeof DeviceOrientationEvent !== 'undefined'
                    && typeof DeviceOrientationEvent.requestPermission === 'function') {
                    const res = await DeviceOrientationEvent.requestPermission();
                    return res === 'granted';
                }
            } catch (_) {
                return false;
            }
            return true;
        };

        const startViewerOrientation = async (viewer) => {
            if (!viewer || typeof viewer.startOrientation !== 'function') {
                return false;
            }
            try {
                const result = viewer.startOrientation();
                if (result && typeof result.then === 'function') {
                    await result;
                }
                return !!(
                    typeof viewer.isOrientationActive === 'function'
                        ? viewer.isOrientationActive()
                        : true
                );
            } catch (_) {
                return false;
            }
        };

        const applyStereoLook = (yaw, pitch, hfov) => {
            if (!stereoLeftViewer || !stereoRightViewer) return;
            const y = normalizeYaw(yaw);
            const p = Math.max(-85, Math.min(85, pitch));
            const z = clampHfov(hfov);
            if (!Number.isFinite(z)) return;
            try {
                if (typeof stereoLeftViewer.lookAt === 'function') {
                    stereoLeftViewer.lookAt(p, y, z, false);
                } else {
                    if (typeof stereoLeftViewer.setPitch === 'function') stereoLeftViewer.setPitch(p, false);
                    if (typeof stereoLeftViewer.setYaw === 'function') stereoLeftViewer.setYaw(y, false);
                    if (typeof stereoLeftViewer.setHfov === 'function') stereoLeftViewer.setHfov(z, false);
                }
            } catch (_) {}
            try {
                const rightYaw = normalizeYaw(y + eyeOffset);
                if (typeof stereoRightViewer.lookAt === 'function') {
                    stereoRightViewer.lookAt(p, rightYaw, z, false);
                } else {
                    if (typeof stereoRightViewer.setPitch === 'function') stereoRightViewer.setPitch(p, false);
                    if (typeof stereoRightViewer.setYaw === 'function') stereoRightViewer.setYaw(rightYaw, false);
                    if (typeof stereoRightViewer.setHfov === 'function') stereoRightViewer.setHfov(z, false);
                }
            } catch (_) {}
        };

        const setupStereoGestures = (leftGesture, rightGesture) => {
            const pointers = new Map();
            let lastPinchDistance = null;
            let lastSingle = null;

            const getPairDistance = () => {
                const pts = Array.from(pointers.values());
                if (pts.length !== 2) return null;
                const dx = pts[0].x - pts[1].x;
                const dy = pts[0].y - pts[1].y;
                return Math.sqrt(dx * dx + dy * dy);
            };

            const onPointerDown = (e) => {
                if (!isVrMode) return;
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.size === 1) lastSingle = { x: e.clientX, y: e.clientY };
                if (pointers.size === 2) lastPinchDistance = getPairDistance();
            };

            const onPointerMove = (e) => {
                if (!isVrMode || !pointers.has(e.pointerId)) return;
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

                if (pointers.size === 1 && lastSingle && !stereoOrientationActive) {
                    const dx = e.clientX - lastSingle.x;
                    const dy = e.clientY - lastSingle.y;
                    lastSingle = { x: e.clientX, y: e.clientY };

                    const yaw = (typeof stereoLeftViewer.getYaw === 'function') ? stereoLeftViewer.getYaw() : 0;
                    const pitch = (typeof stereoLeftViewer.getPitch === 'function') ? stereoLeftViewer.getPitch() : 0;
                    const hfov = (typeof stereoLeftViewer.getHfov === 'function') ? stereoLeftViewer.getHfov() : 100;
                    const yawDelta = (dx / Math.max(1, viewerDiv.clientWidth)) * hfov * 0.9;
                    const pitchDelta = (dy / Math.max(1, viewerDiv.clientHeight)) * hfov * 0.65;
                    applyStereoLook(yaw - yawDelta, pitch + pitchDelta, hfov);
                    e.preventDefault();
                    return;
                }

                if (pointers.size === 2) {
                    const dist = getPairDistance();
                    if (Number.isFinite(dist) && Number.isFinite(lastPinchDistance)) {
                        const deltaPx = dist - lastPinchDistance;
                        if (Math.abs(deltaPx) > 1.2) {
                            const hfov = (typeof stereoLeftViewer.getHfov === 'function') ? stereoLeftViewer.getHfov() : 100;
                            const nextHfov = hfov - (deltaPx * 0.08);
                            const yaw = (typeof stereoLeftViewer.getYaw === 'function') ? stereoLeftViewer.getYaw() : 0;
                            const pitch = (typeof stereoLeftViewer.getPitch === 'function') ? stereoLeftViewer.getPitch() : 0;
                            applyStereoLook(yaw, pitch, nextHfov);
                        }
                    }
                    lastPinchDistance = dist;
                    e.preventDefault();
                }
            };

            const onPointerUpOrCancel = (e) => {
                pointers.delete(e.pointerId);
                if (pointers.size < 2) lastPinchDistance = null;
                if (pointers.size === 0) lastSingle = null;
            };

            const targets = [leftGesture, rightGesture];
            targets.forEach((target) => {
                target.addEventListener('pointerdown', onPointerDown, { passive: true });
                target.addEventListener('pointermove', onPointerMove, { passive: false });
                target.addEventListener('pointerup', onPointerUpOrCancel, { passive: true });
                target.addEventListener('pointercancel', onPointerUpOrCancel, { passive: true });
                target.addEventListener('pointerleave', onPointerUpOrCancel, { passive: true });
            });

            stereoGestureCleanup = () => {
                targets.forEach((target) => {
                    target.removeEventListener('pointerdown', onPointerDown);
                    target.removeEventListener('pointermove', onPointerMove);
                    target.removeEventListener('pointerup', onPointerUpOrCancel);
                    target.removeEventListener('pointercancel', onPointerUpOrCancel);
                    target.removeEventListener('pointerleave', onPointerUpOrCancel);
                });
            };
        };

        const startStereoSync = () => {
            stopStereoLoop();
            const tick = () => {
                if (!isVrMode || !stereoLeftViewer || !stereoRightViewer) return;
                try {
                    const yaw = (typeof stereoLeftViewer.getYaw === 'function') ? stereoLeftViewer.getYaw() : 0;
                    const pitch = (typeof stereoLeftViewer.getPitch === 'function') ? stereoLeftViewer.getPitch() : 0;
                    const hfov = (typeof stereoLeftViewer.getHfov === 'function') ? stereoLeftViewer.getHfov() : 100;
                    applyStereoLook(yaw, pitch, hfov);
                } catch (_) {}
                stereoSyncRafId = requestAnimationFrame(tick);
            };
            stereoSyncRafId = requestAnimationFrame(tick);
        };

        const initStereoViewer = async (immersivePromise = null) => {
            if (isClosing) return false;
            const settledImmersivePromise = immersivePromise || enterVrImmersiveMode();
            let seedHfov = 100;
            if (normalViewer && typeof normalViewer.getHfov === 'function') {
                try { seedHfov = Number(normalViewer.getHfov()) || 100; } catch (_) {}
            }
            const preferredVrVariant = chooseVariantByHfov(seedHfov, 'vr');
            if (preferredVrVariant && preferredVrVariant.url) {
                activeVariant = preferredVrVariant;
                currentPanoramaUrl = preferredVrVariant.url;
            }
            const initOfficialStereo = async () => {
                const modules = await ensureOfficialModules();
                if (!modules || isClosing) return false;

                destroyAllViewers();
                setViewerPresentation(true);
                try {
                    officialModules = modules;
                    officialViewer = new officialModules.Viewer({
                        container: viewerDiv,
                        panorama: currentPanoramaUrl,
                        zoomSpeed: 2.5,
                        minFov: MIN_HFOV,
                        maxFov: MAX_HFOV,
                        touchmoveTwoFingers: true,
                        mousewheel: true,
                        navbar: ['zoom', 'fullscreen'],
                        plugins: [
                            [officialModules.GyroscopePlugin, { touchmove: false, moveMode: 'fast' }],
                            [officialModules.StereoPlugin, {}],
                        ],
                    });

                    officialStereoPlugin = officialViewer.getPlugin(officialModules.StereoPlugin) || officialViewer.getPlugin('stereo');
                    if (!officialStereoPlugin) throw new Error('Stereo plugin not available');

                    const officialGyroPlugin = officialViewer.getPlugin(officialModules.GyroscopePlugin) || officialViewer.getPlugin('gyroscope');
                    if (officialGyroPlugin && typeof officialGyroPlugin.start === 'function' && !officialGyroPlugin.__softStartPatched) {
                        const originalGyroStart = officialGyroPlugin.start.bind(officialGyroPlugin);
                        officialGyroPlugin.start = (...args) => {
                            return originalGyroStart(...args).catch((err) => {
                                console.warn('Gyroscope start failed, continuing stereo touch-only:', err);
                                return Promise.resolve();
                            });
                        };
                        officialGyroPlugin.__softStartPatched = true;
                    }

                    if (typeof officialStereoPlugin.handleEvent === 'function' && !officialStereoPlugin.__patchedNoClickExit) {
                        const originalHandleEvent = officialStereoPlugin.handleEvent.bind(officialStereoPlugin);
                        officialStereoPlugin.handleEvent = (evt) => {
                            if (evt && evt.type === 'click') return;
                            return originalHandleEvent(evt);
                        };
                        officialStereoPlugin.__patchedNoClickExit = true;
                    }

                    await officialStereoPlugin.start();
                    const immersiveState = await settledImmersivePromise;
                    usingOfficialStereo = true;
                    setVrButtonState(true);
                    startAdaptiveSourceMonitor();
                    showHint(
                        describeVrState(immersiveState, 'VR aktif: stereo plugin + sensör/dokunmatik hazır.'),
                        3400
                    );
                    return true;
                } catch (e) {
                    console.warn('Official stereo start failed, fallback to manual stereo:', e);
                    destroyOfficialStereo();
                    viewerDiv.innerHTML = '';
                    return false;
                }
            };

            if (await initOfficialStereo()) return true;
            if (!await ensurePannellum()) return false;

            let initialYaw = 0;
            let initialPitch = 0;
            let initialHfov = 100;
            if (normalViewer) {
                try { if (typeof normalViewer.getYaw === 'function') initialYaw = normalViewer.getYaw(); } catch (_) {}
                try { if (typeof normalViewer.getPitch === 'function') initialPitch = normalViewer.getPitch(); } catch (_) {}
                try { if (typeof normalViewer.getHfov === 'function') initialHfov = normalViewer.getHfov(); } catch (_) {}
            }

            destroyAllViewers();
            setViewerPresentation(true);
            viewerDiv.innerHTML = '';
            viewerDiv.style.display = 'flex';

            const makeHalf = () => {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'position:relative;flex:1 1 50%;height:100%;overflow:hidden;';
                const host = document.createElement('div');
                host.style.cssText = 'width:100%;height:100%;pointer-events:none;';
                const gesture = document.createElement('div');
                gesture.style.cssText = 'position:absolute;inset:0;z-index:30;background:transparent;touch-action:none;';
                wrap.appendChild(host);
                wrap.appendChild(gesture);
                return { wrap, host, gesture };
            };

            const left = makeHalf();
            const right = makeHalf();
            left.wrap.style.borderRight = '1px solid rgba(255,255,255,.12)';
            viewerDiv.appendChild(left.wrap);
            viewerDiv.appendChild(right.wrap);

            try {
                stereoLeftViewer = window.pannellum.viewer(left.host, {
                    type: 'equirectangular',
                    panorama: currentPanoramaUrl,
                    autoLoad: true,
                    showZoomCtrl: false,
                    hfov: initialHfov,
                    minHfov: MIN_HFOV,
                    maxHfov: MAX_HFOV,
                    compass: false,
                    mouseZoom: false
                });
                stereoRightViewer = window.pannellum.viewer(right.host, {
                    type: 'equirectangular',
                    panorama: currentPanoramaUrl,
                    autoLoad: true,
                    showZoomCtrl: false,
                    hfov: initialHfov,
                    minHfov: MIN_HFOV,
                    maxHfov: MAX_HFOV,
                    compass: false,
                    mouseZoom: false
                });

                applyStereoLook(initialYaw, initialPitch, initialHfov);
                setupStereoGestures(left.gesture, right.gesture);

                const motionGranted = await requestMotionPermission();
                if (motionGranted) {
                    try {
                        const [leftOrientationActive, rightOrientationActive] = await Promise.all([
                            startViewerOrientation(stereoLeftViewer),
                            startViewerOrientation(stereoRightViewer),
                        ]);
                        stereoOrientationActive = leftOrientationActive || rightOrientationActive;
                    } catch (_) {
                        stereoOrientationActive = false;
                    }
                }

                const immersiveState = await settledImmersivePromise;
                if (stereoOrientationActive) {
                    showHint(
                        describeVrState(immersiveState, 'VR aktif: sensör + iki tarafta pinch/zoom kullanılabilir.'),
                        3800
                    );
                } else {
                    showHint(
                        describeVrState(immersiveState, 'VR aktif: sensör yok/izin verilmedi; iki tarafta dokunmatik kontrol aktif.'),
                        4000
                    );
                }

                startStereoSync();
                setVrButtonState(true);
                startAdaptiveSourceMonitor();
                return true;
            } catch (e) {
                console.warn('Stereo pannellum init failed:', e);
                destroyStereo();
                return false;
            }
        };

        const exitStereoViewer = async () => {
            if (usingOfficialStereo) {
                destroyOfficialStereo();
            }
            await initNormalViewer();
        };

        vrBtn.addEventListener('click', async () => {
            if (isClosing) return;
            vrBtn.disabled = true;
            try {
                if (isVrMode) {
                    await exitStereoViewer();
                } else {
                    const immersivePromise = enterVrImmersiveMode();
                    const ok = await initStereoViewer(immersivePromise);
                    if (!ok) {
                        await initNormalViewer();
                        showHint('VR modu açılamadı. Normal panoramaya dönüldü.', 2800);
                    }
                }
            } finally {
                vrBtn.disabled = false;
            }
        });

        (async () => {
            await initNormalViewer();
        })();

    } catch (e) {
        console.warn('Panorama viewer error:', e);
    }
}
window.openPanoramaViewer = openPanoramaViewer;

function clearMapMarkers() {
    markers.forEach(marker => {
        if (map && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    markers = [];
    mapState.markers = markers;
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

// Route preview map functionality
let previewMaps = new Map(); // Store multiple preview maps

async function initializeRoutePreviewMap(mapId, routeId, pois) {
    // Log removed for cleaner console
    
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
            // Log removed for cleaner console
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
                // Log removed for cleaner console
                const response = await (window.rateLimitedFetch || fetch)(`${apiBase}/routes/${routeId}/geometry`);
                if (response.ok) {
                    const geometryData = await response.json();
                    // Log removed for cleaner console
                    
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
                        // Log removed for cleaner console
                    } else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
                        // Nested geometry
                        geometryLatLngs = geometry.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        // Log removed for cleaner console
                    } else if (geometryData.success && geometryData.geometry) {
                        // Standard API response
                        const geo = geometryData.geometry;
                        if (geo.type === 'LineString' && geo.coordinates) {
                            geometryLatLngs = geo.coordinates.map(coord => [coord[1], coord[0]]);
                            // Log removed for cleaner console
                        }
                    }
                    
                    if (geometryLatLngs && geometryLatLngs.length > 0) {
                        L.polyline(geometryLatLngs, {
                            color: '#4ecdc4',
                            weight: 3,
                            opacity: 0.8,
                            className: 'saved-route'
                        }).addTo(previewMap);
                        // Log removed for cleaner console
                    } else {
                        // Log removed for cleaner console
                    }
                } else {
                    // Log removed for cleaner console
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
            // Log removed for cleaner console
        } else if (validPOIs.length === 1) {
            const poi = validPOIs[0];
            previewMap.setView([parseFloat(poi.lat), parseFloat(poi.lon)], 14);
            // Log removed for cleaner console
        } else if (routeCoordinates.length > 0) {
            const bounds = L.latLngBounds(routeCoordinates);
            previewMap.fitBounds(bounds, { padding: [10, 10] });
            // Log removed for cleaner console
        } else {
            // POI'ler de geometri de yoksa varsayılan konum (Ürgüp)
            previewMap.setView([38.6322, 34.9115], 12);
            // Log removed for cleaner console
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
        
        // Log removed for cleaner console
        
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
        // Log removed for cleaner console
        
        const response = await (window.rateLimitedFetch || fetch)(`${apiBase}/routes/${routeId}/geometry`);
        
        if (response.ok) {
            const geometryData = await response.json();
            // Log removed for cleaner console
            // Log removed for cleaner console
            // Log removed for cleaner console
            // Log removed for cleaner console

            // Hibrit yaklaşım - farklı response formatlarını destekle
            let processed = false;
            
            if (geometryData.success && geometryData.geometry) {
                // Log removed for cleaner console
                displaySavedRouteGeometry(geometryData);
                processed = true;
            } else if (geometryData.geometry) {
                // Log removed for cleaner console
                displaySavedRouteGeometry(geometryData);
                processed = true;
            } else if (geometryData.type === 'LineString') {
                // Log removed for cleaner console
                displaySavedRouteGeometry({ geometry: geometryData });
                processed = true;
            } else {
                // Log removed for cleaner console
                
                // Tüm olası alanları kontrol et
                for (const [key, value] of Object.entries(geometryData)) {
                    // Log removed for cleaner console
                    
                    if (value && typeof value === 'object') {
                        if (value.type === 'LineString' && value.coordinates) {
                            // Log removed for cleaner console
                            displaySavedRouteGeometry({ geometry: value });
                            processed = true;
                            break;
                        } else if (value.geometry && value.geometry.type === 'LineString') {
                            // Log removed for cleaner console
                            displaySavedRouteGeometry(value);
                            processed = true;
                            break;
                        }
                    }
                }
                
                if (!processed) {
                    // Log removed for cleaner console
                    showNotification('⚠️ Rota geometrisi bulunamadı. POI\'ler arası düz çizgiler gösteriliyor.', 'warning');
                }
            }
            
            return processed;
        } else {
            // Log removed for cleaner console
            const errorText = await response.text();
            // Log removed for cleaner console
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
    
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    // Log removed for cleaner console
    
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
        // Log removed for cleaner console
        // Log removed for cleaner console
        
        // String ise parse et
        if (typeof geometry === 'string') {
            // Log removed for cleaner console
            try {
                geometry = JSON.parse(geometry);
                // Log removed for cleaner console
            } catch (e) {
                console.warn('❌ Geometry JSON parse hatası:', e);
                return;
            }
        }
        
        let latlngs = null;
        let routeType = 'unknown';
        
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        
        // YAKLAŞIM 1: Statik LineString geometrisi (klasik)
        if (geometry && geometry.type === 'LineString' && geometry.coordinates && geometry.coordinates.length > 0) {
            // Log removed for cleaner console
            // Log removed for cleaner console
            // Log removed for cleaner console
            latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            routeType = 'static';
            // Log removed for cleaner console
        }
        // YAKLAŞIM 2: API response formatı (nested geometry)
        else if (geometry && geometry.geometry && geometry.geometry.type === 'LineString') {
            // Log removed for cleaner console
            const coords = geometry.geometry.coordinates;
            if (coords && coords.length > 0) {
                // Log removed for cleaner console
                latlngs = coords.map(coord => [coord[1], coord[0]]);
                routeType = 'nested';
            }
        }
        // YAKLAŞIM 3: POI-based dinamik rota (waypoints)
        else if (geometry && geometry.waypoints && Array.isArray(geometry.waypoints) && geometry.waypoints.length > 0) {
            // Log removed for cleaner console
            latlngs = geometry.waypoints.map(wp => [wp.lat || wp.latitude, wp.lng || wp.longitude]);
            routeType = 'waypoints';
        }
        // YAKLAŞIM 4: Koordinat dizisi (basit format)
        else if (Array.isArray(geometry) && geometry.length > 0 && geometry[0] && geometry[0].length === 2) {
            // Log removed for cleaner console
            latlngs = geometry;
            routeType = 'simple';
        }
        
        // Rota çizgisini oluştur
        if (latlngs && latlngs.length > 1) {
            // Log removed for cleaner console
            // Log removed for cleaner console
            // Log removed for cleaner console
            
            // Rota tipine göre stil belirle
            const routeStyles = {
                'static': { color: '#4ecdc4', weight: 4, opacity: 0.8, dashArray: null },
                'nested': { color: '#4ecdc4', weight: 4, opacity: 0.8, dashArray: null },
                'waypoints': { color: '#ff6b6b', weight: 4, opacity: 0.8, dashArray: '8,4' },
                'simple': { color: '#95a5a6', weight: 3, opacity: 0.7, dashArray: '5,5' }
            };
            
            const style = routeStyles[routeType] || routeStyles['simple'];
            // Log removed for cleaner console
            
            // Create route line
            let routeLine = null;
            try {
                routeLine = L.polyline(latlngs, {
                    ...style,
                    className: 'saved-route'
                }).addTo(map);
                
                // Log removed for cleaner console
                
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
                
                // Log removed for cleaner console
                
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
    // Log removed for cleaner console
    
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
            // Log removed for cleaner console
            await initializePredefinedMap();
        }
        
        // Show route on predefined routes map (left side)
        await displayRouteOnMap(route);
        
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
    // Log removed for cleaner console
    
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
            mapState.map = null;
        }

        if (predefinedMap) {
            predefinedMap.remove();
            predefinedMap = null;
        }
        
        // Clear caches
        mediaCache = {};
        
        // Clean up hover system
        if (poiHoverIntegration) {
            poiHoverIntegration.cleanup();
            poiHoverIntegration = null;
        }
        
        // Reset state variables
        markers = [];
        mapState.markers = markers;
        poiCluster = null;
        mapState.poiCluster = null;
        mapInitializationPromise = null;
        mapState.mapInitializationPromise = null;
        mapInitialized = false;
        mapState.mapInitialized = false;
        selectedPOIs = [];
        predefinedRoutes = [];
        filteredRoutes = [];
        predefinedMapLayers = [];
        predefinedMapInitialized = false;
        
        // Log removed for cleaner console
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

// Initialize everything when DOM is loaded

function initializeSliders() {
    // Log removed for cleaner console

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

        // Log removed for cleaner console

        // Add both input and change events for better compatibility
        const handleSliderChange = function () {
            const value = parseInt(this.value);
            // Log removed for cleaner console
            updatePreferenceValue(category, value, valueDisplay, preferenceItem);
        };

        slider.addEventListener('input', handleSliderChange);
        slider.addEventListener('change', handleSliderChange);

        // Initialize state
        const initialValue = parseInt(slider.value);
        // Log removed for cleaner console
        updatePreferenceValue(category, initialValue, valueDisplay, preferenceItem);
    });

    // Initialize quick selection buttons
    initializeQuickSelection();

    // Log removed for cleaner console
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

// Quick selection presets (aligned with 6 primary personas)
const quickPresets = {
    // Doğa & Manzara: çok yüksek doğa, yüksek macera; diğerleri sıfır/aşağı
    nature: {
        doga: 4,
        macera: 3,
        spor: 2,
        rahatlatici: 1,
        yemek: 0,
        tarihi: 0,
        sanat_kultur: 0,
        eglence: 0,
        alisveris: 0,
        gece_hayati: 0
    },
    // Kültür & Tarih: çok yüksek tarih/sanat; diğerleri düşük/sıfır
    culture: {
        tarihi: 4,
        sanat_kultur: 4,
        doga: 1,
        yemek: 1,
        macera: 0,
        rahatlatici: 0,
        spor: 0,
        eglence: 0,
        alisveris: 0,
        gece_hayati: 0
    },
    // Gastronomi: çok yüksek yemek; gece hayatı ikincil; diğerleri sıfır
    food: {
        yemek: 4,
        gece_hayati: 2,
        eglence: 1,
        doga: 0,
        tarihi: 0,
        sanat_kultur: 0,
        rahatlatici: 0,
        macera: 0,
        spor: 0,
        alisveris: 0
    },
    // Dinlenme & Wellness: çok yüksek rahatlatıcı; doğa destek
    relax: {
        rahatlatici: 4,
        doga: 2,
        yemek: 1,
        tarihi: 0,
        sanat_kultur: 0,
        eglence: 0,
        macera: 0,
        spor: 0,
        alisveris: 0,
        gece_hayati: 0
    },
    // Macera & Spor: çok yüksek macera/spor; doğa destek; diğerleri sıfır
    adventure: {
        macera: 4,
        spor: 4,
        doga: 3,
        eglence: 0,
        yemek: 0,
        gece_hayati: 0,
        tarihi: 0,
        sanat_kultur: 0,
        rahatlatici: 0,
        alisveris: 0
    },
    // Gece Hayatı: çok yüksek gece hayatı/eğlence; yemek ikincil
    nightlife: {
        gece_hayati: 4,
        eglence: 4,
        yemek: 2,
        spor: 0,
        macera: 0,
        doga: 0,
        tarihi: 0,
        sanat_kultur: 0,
        alisveris: 0,
        rahatlatici: 0
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
        
        // Log removed for cleaner console
    }
}

function initializeQuickSelection() {
    // Log removed for cleaner console
    
    const quickButtons = document.querySelectorAll('.quick-btn');
    quickButtons.forEach(button => {
        button.addEventListener('click', function() {
            const preset = this.getAttribute('data-preset');
            // Log removed for cleaner console
            
            if (preset === 'reset') {
                resetAllPreferences();
            } else if (quickPresets[preset]) {
                // Preset application is handled in personal_routes.js; just trigger recommendations
                // Auto-trigger recommendations after selecting a quick preset
                try {
                    const recommendBtn = document.getElementById('recommendBtn');
                    if (recommendBtn && !recommendBtn.disabled && typeof getRecommendations === 'function') {
                        // Slight delay to ensure UI updates and change events settle (allow slider animation)
                        setTimeout(() => {
                            // Double-check still not loading
                            if (!recommendBtn.disabled) {
                                getRecommendations();
                            }
                        }, 600);
                    }
                } catch (e) {
                    // Silent fallback if not available
                }
            }
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    
    // Log removed for cleaner console
}

function applyPreset(preset) {
    // Log removed for cleaner console
    // High-contrast: first reset all preferences to zero
    resetAllPreferences();

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
    
    // Log removed for cleaner console
}

function resetAllPreferences() {
    // Log removed for cleaner console
    
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
    
    // Log removed for cleaner console
}

function setupEventListeners() {
    // Log removed for cleaner console

    const recommendBtn = document.getElementById('recommendBtn');
    if (recommendBtn) {
        // Log removed for cleaner console
        recommendBtn.addEventListener('click', function (e) {
            // Log removed for cleaner console
            e.preventDefault();
            getRecommendations();
        });
    } else {
        console.error('❌ Recommend button not found!');
        // Try to find it with a different approach
        const allButtons = document.querySelectorAll('button');
        // Log removed for cleaner console
        allButtons.forEach((btn, index) => {
            // Log removed for cleaner console
        });
    }

    // Log removed for cleaner console
}

async function getRecommendations() {
    // Log removed for cleaner console

    const button = document.getElementById('recommendBtn');
    const resultsSection = document.getElementById('resultsSection');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('recommendationResults');

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
            if (window.loadingManager && typeof window.loadingManager.resetIndicator === 'function') {
                window.loadingManager.resetIndicator('loadingIndicator');
            }
            if (loadingIndicator) {
                loadingIndicator.style.display = 'block';
                loadingIndicator.style.visibility = 'visible';
                loadingIndicator.style.opacity = '1';
            }
        }
    } else {
        // Fallback - show basic loading
        if (window.loadingManager && typeof window.loadingManager.resetIndicator === 'function') {
            window.loadingManager.resetIndicator('loadingIndicator');
        }
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.style.visibility = 'visible';
            loadingIndicator.style.opacity = '1';
        }
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
            // Log removed for cleaner console

            // Check for both old and new slider types
            if (slider.classList.contains('discrete-slider')) {
                // Convert discrete slider value to actual preference value (old interface)
                preferences[category] = discreteValues[sliderValue].value;
                // Log removed for cleaner console
            } else if (slider.classList.contains('preference-slider')) {
                // Convert preference slider value to actual preference value (new interface)
                preferences[category] = preferenceValues[sliderValue].value;
                // Log removed for cleaner console
            } else {
                // Fallback for direct values
                preferences[category] = sliderValue;
                // Log removed for cleaner console
            }
        });

        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        // Log removed for cleaner console
        
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
        // Log removed for cleaner console
        // Log removed for cleaner console
        
        // Determine best available location to improve recommendations
        let reqLocation = null;
        try {
            if (startLocation && typeof startLocation.latitude === 'number' && typeof startLocation.longitude === 'number') {
                reqLocation = { latitude: startLocation.latitude, longitude: startLocation.longitude };
            } else if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
                reqLocation = { latitude: userLocation.latitude, longitude: userLocation.longitude };
            }
        } catch (e) {
            // ignore
        }

        const response = await fetch(`${apiBase}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences, location: reqLocation })
        });
        
        // Log removed for cleaner console
        // Log removed for cleaner console
        
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
        // Log removed for cleaner console

        // Debug: Log all unique categories from API response
        const allPOIs = [...(apiData.highScore || []), ...(apiData.lowScore || [])];
        const uniqueCategories = [...new Set(allPOIs.map(poi => poi.category).filter(Boolean))];
        // Log removed for cleaner console
        
        // Debug: Check which categories are falling back to 'diger'
        uniqueCategories.forEach(category => {
            const style = getCategoryStyle(category);
            if (style.category === 'diger' && category !== 'diger') {
                console.warn(`⚠️ Category '${category}' is falling back to 'diger'`);
            }
        });

        if (window.loadingManager && typeof window.loadingManager.updateProgress === 'function') {
            try {
                window.loadingManager.updateProgress('loadingIndicator', 70);
            } catch (error) {
                console.warn('Progress update error:', error);
            }
        }

        // Transform API response to match our display format
        // Build recommendation buckets
        let high = apiData.recommendations
            .filter(poi => poi.score >= 45)
            .map(poi => ({ ...poi, recommendationScore: Math.round(poi.score), ratings: poi.ratings || {}, tier: 'high' }));
        let low = apiData.recommendations
            .filter(poi => poi.score < 45)
            .map(poi => ({ ...poi, recommendationScore: Math.round(poi.score), ratings: poi.ratings || {}, tier: 'low' }));

        // If there are no high-score items, promote top alternatives to primary list for better UX
        if (high.length === 0 && low.length > 0) {
            // Sort low by score desc just in case
            low.sort((a, b) => b.recommendationScore - a.recommendationScore);
            const promoteCount = Math.min(6, low.length);
            const promoted = low.slice(0, promoteCount).map(p => ({ ...p, tier: 'high' }));
            high = promoted;
            low = low.slice(promoteCount);
        }

        const recommendationData = {
            highScore: high,
            lowScore: low,
            all: apiData.recommendations.map(poi => ({ ...poi, recommendationScore: Math.round(poi.score), ratings: poi.ratings || {} }))
        };

        // Log removed for cleaner console
        
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
            // Log removed for cleaner console
            await initializeMap(recommendationData);
        } else {
            // Log removed for cleaner console
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
        // Log removed for cleaner console
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

    // Log removed for cleaner console

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

    // Log removed for cleaner console
    // Log removed for cleaner console

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
        const noPrimary = recommendationData.highScore.length === 0;
        html += `
            <div class="recommendation-category secondary">
                <div class="category-header">
                    <div class="category-title">
                        <i class="fas fa-compass"></i>
                        <h3>Keşfedebileceğiniz Yerler</h3>
                        <span class="category-badge secondary">${recommendationData.lowScore.length}</span>
                    </div>
                    <p class="category-description">Farklı deneyimler için alternatif seçenekler</p>
                    <button class="toggle-category-btn ${noPrimary ? 'active' : ''}" onclick="toggleAlternativeRecommendations()">
                        <span class="toggle-text">${noPrimary ? 'Gizle' : 'Göster'}</span>
                        <i class="fas fa-chevron-down toggle-icon" style="transform: ${noPrimary ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
                    </button>
                </div>
                <div class="recommendations-grid alternative" id="alternativeRecommendations" style="display: ${noPrimary ? 'grid' : 'none'};">
                    ${createModernPOICards(recommendationData.lowScore, 'secondary')}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    container.innerHTML = html;
    
    // Initialize POI card event listeners and media loading
    initializePOICardsMedia();
    
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
        if (window.loadingManager && typeof window.loadingManager.safeHideIndicator === 'function') {
            window.loadingManager.safeHideIndicator(loadingIndicator || 'loadingIndicator', { fadeDuration: 500 });
            return;
        }

        if (loadingIndicator) {
            loadingIndicator.style.transition = 'opacity 0.5s ease-out';
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
                loadingIndicator.style.visibility = 'hidden';
                loadingIndicator.style.opacity = '';
                loadingIndicator.style.transition = '';
                loadingIndicator.classList.remove('d-none');
                loadingIndicator.removeAttribute('hidden');
            }, 500);
        }
    }, 2000);

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
                    const fullSrc = normalizeMediaPath(mainImage.path || mainImage.filename || '');
                    const previewSrc = mainImage.preview_path ? normalizeMediaPath(mainImage.preview_path) : '';
                    // Prefer full image for correct orientation; keep preview as fallback
                    const displaySrc = fullSrc || previewSrc;
                    if (displaySrc) img.dataset.src = displaySrc;
                    if (fullSrc) img.dataset.fullSrc = fullSrc;
                    if (previewSrc && previewSrc !== fullSrc) img.dataset.previewSrc = previewSrc;
                    img.className = 'poi-card__image lazy-image';
                    img.alt = poi.name;
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
                    imageContainer.insertBefore(img, placeholder);
                    placeholder.style.display = 'none';
                    // Orientation fallback using EXIF (run when real image loads)
                    try { attachEXIFOrientationFix(img); } catch (_) {}
                    if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
                        window.lazyLoader.setupImageLazyLoading();
                    }
                }

                const previewContainer = card.querySelector('.poi-media-preview');
                const cacheKey = `poi_card_${poi.id || poi._id}`;
                const allMediaItems = [];

                if (media.images) {
                    media.images.forEach((image, idx) => {
                        const imgFull = normalizeMediaPath(image.path || image.filename || '');
                        const imgPreview = image.preview_path ? normalizeMediaPath(image.preview_path) : '';
                        allMediaItems.push({
                            type: 'image',
                            path: imgFull,
                            previewPath: imgPreview,
                            title: image.description || `Görsel ${idx + 1}`,
                            originalIndex: idx
                        });
                    });
                }

                if (media.videos) {
                    media.videos.forEach((video, idx) => {
                        allMediaItems.push({
                            type: 'video',
                            path: normalizeMediaPath(video.path || video.filename || ''),
                            previewPath: '',
                            title: video.description || `Video ${idx + 1}`,
                            originalIndex: idx
                        });
                    });
                }

                if (media.audio) {
                    media.audio.forEach((audio, idx) => {
                        allMediaItems.push({
                            type: 'audio',
                            path: normalizeMediaPath(audio.path || audio.filename || ''),
                            previewPath: '',
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
                            const thumb = (item.previewPath && item.previewPath.startsWith('/')) ? item.previewPath
                                         : (item.previewPath ? `/${item.previewPath}` : (item.path.startsWith('/') ? item.path : `/${item.path}`));
                            const ds = [];
                            if (item.path) ds.push(`data-full-src="${item.path}"`);
                            if (item.previewPath && item.previewPath !== item.path) ds.push(`data-preview-src="${item.previewPath}"`);
                            const dsStr = ds.length ? ` ${ds.join(' ')}` : '';
                            mediaPreviewHTML += `<img data-src="${thumb}"${dsStr} class="poi-media-thumb lazy-image" onclick="showPOIMediaFromCache('${cacheKey}', ${idx})" title="${item.title}" alt="${item.title}" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4uLi48L3RleHQ+PC9zdmc+" />`;
                        } else {
                            const icon = item.type === 'video' ? '🎥' : '🎵';
                            mediaPreviewHTML += `<div class="poi-media-count" onclick="showPOIMediaFromCache('${cacheKey}', ${idx})" title="${item.title}">${icon}</div>`;
                        }
                    });

                    if (allMediaItems.length > 3) {
                        mediaPreviewHTML += `<div class="poi-media-count" onclick="showPOIMediaFromCache('${cacheKey}', 0)">+${allMediaItems.length - 3}</div>`;
                    }

                    previewContainer.innerHTML = mediaPreviewHTML;
                    // Apply EXIF orientation fix to thumbs once they load
                    try {
                        const thumbs = previewContainer.querySelectorAll('img.poi-media-thumb');
                        thumbs.forEach(t => attachEXIFOrientationFix(t));
                    } catch (_) {}
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

    // Log removed for cleaner console

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
        mapState.map = null;
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

    mapState.map = map;

        // Add base layers
        addBaseLayers(map);

        // Load standalone panoramas as a separate layer
        try {
            if (typeof window.loadPanoramasLayer === 'function') {
                await window.loadPanoramasLayer();
            }
        } catch (e) {
            console.warn('Panorama layer failed to load (empty map init):', e);
        }

        // Ensure POI search bar exists on dynamic map
        try { ensurePOISearchBar(); } catch (_) {}

    // Add map controls
    if (L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
        // Hide route planner text while in fullscreen via plugin
        try {
            const routeSection = document.getElementById('routeSection');
            const exploreBottomSection = document.querySelector('.explore-bottom-section');
            let prevDisplay = '';
            let prevExploreDisplay = '';
            map.on('enterFullscreen', () => {
                document.body.classList.add('personal-routes-map-fullscreen');
                if (routeSection) {
                    prevDisplay = routeSection.style.display;
                    routeSection.style.display = 'none';
                }
                if (exploreBottomSection) {
                    prevExploreDisplay = exploreBottomSection.style.display;
                    exploreBottomSection.style.display = 'none';
                    exploreBottomSection.setAttribute('aria-hidden', 'true');
                }
            });
            map.on('exitFullscreen', () => {
                document.body.classList.remove('personal-routes-map-fullscreen');
                if (routeSection) {
                    routeSection.style.display = prevDisplay || '';
                }
                if (exploreBottomSection) {
                    exploreBottomSection.style.display = prevExploreDisplay || '';
                    exploreBottomSection.removeAttribute('aria-hidden');
                }
            });
        } catch (_) { /* noop */ }
    }

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];
    mapState.markers = markers;

    // If only low score results exist, focus and open the top one
    if (showLowByDefault && recommendationData.lowScore.length > 0) {
        try {
            const top = recommendationData.lowScore[0];
            // Focus map smoothly and open popup for top item
            setTimeout(() => {
                if (map) {
                    map.setView([top.latitude, top.longitude], 15);
                    const m = markers.find(mk => {
                        const id = (mk.poiData && (mk.poiData.poi_id || mk.poiData.id || mk.poiData._id));
                        const tid = (top.poi_id || top.id || top._id);
                        return String(id) === String(tid);
                    });
                    if (m) {
                        try { m.openPopup(); } catch (_) {}
                    }
                }
            }, 700);
        } catch (_) { /* noop */ }
    }

    // Remove loading state after map is fully loaded
    setTimeout(() => {
        mapContainer.classList.remove('loading');
        // Fix map size issues
        if (map) {
            map.invalidateSize();
        }
        // Log removed for cleaner console
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
    if (mapContainer) {
        mapContainer.classList.add('loading');
    }

    // Clear existing map
    if (map) {
        map.remove();
        mapState.map = null;
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

    mapState.map = map;

    // Add base layers
    addBaseLayers(map);

    // Initialize marker clustering for performance
    try {
        if (poiCluster && map.hasLayer(poiCluster)) {
            map.removeLayer(poiCluster);
        }
        poiCluster = L.markerClusterGroup({
            chunkedLoading: true,
            chunkDelay: 25,
            chunkInterval: 200,
            // Even less aggressive clustering
            disableClusteringAtZoom: 13,
            spiderfyOnMaxZoom: true,
            removeOutsideVisibleBounds: true,
            maxClusterRadius: function (zoom) {
                // Split clusters sooner as zoom increases
                return zoom >= 13 ? 25 : Math.max(10, 50 - zoom * 3);
            }
        });
        map.addLayer(poiCluster);
        mapState.poiCluster = poiCluster;
    } catch (e) {
        console.warn('MarkerCluster init failed or not available:', e);
        mapState.poiCluster = poiCluster;
    }

    // Add map controls
    if (L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
        // Hide route planner text while in fullscreen via plugin
        try {
            const routeSection = document.getElementById('routeSection');
            const exploreBottomSection = document.querySelector('.explore-bottom-section');
            let prevDisplay = '';
            let prevExploreDisplay = '';
            map.on('enterFullscreen', () => {
                document.body.classList.add('personal-routes-map-fullscreen');
                if (routeSection) {
                    prevDisplay = routeSection.style.display;
                    routeSection.style.display = 'none';
                }
                if (exploreBottomSection) {
                    prevExploreDisplay = exploreBottomSection.style.display;
                    exploreBottomSection.style.display = 'none';
                    exploreBottomSection.setAttribute('aria-hidden', 'true');
                }
            });
            map.on('exitFullscreen', () => {
                document.body.classList.remove('personal-routes-map-fullscreen');
                if (routeSection) {
                    routeSection.style.display = prevDisplay || '';
                }
                if (exploreBottomSection) {
                    exploreBottomSection.style.display = prevExploreDisplay || '';
                    exploreBottomSection.removeAttribute('aria-hidden');
                }
            });
        } catch (_) { /* noop */ }
    }

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    // Add markers for all recommendations (high and low score)
    const allPOIs = [...recommendationData.highScore, ...recommendationData.lowScore];
    const showLowByDefault = (recommendationData.highScore.length === 0 && recommendationData.lowScore.length > 0);

    for (const [index, poi] of allPOIs.entries()) {
        // Treat items in highScore bucket as primary even if score < 45 (promoted)
        const isLowScore = (poi.tier === 'high') ? false : (poi.recommendationScore < 45);
        
        // Debug: Log POI category
        if (index < 3) { // Only log first 3 POIs to avoid spam
            // Log removed for cleaner console
        }
        
        let customIcon;
        try {
            customIcon = createCustomIcon(poi.category, poi.recommendationScore, isLowScore);
            if (index < 3) {
                // Log removed for cleaner console
            }
        } catch (error) {
            console.error(`❌ Error creating custom icon for POI ${poi.name}:`, error);
            // Fallback to a simple default icon if custom icon creation fails
            customIcon = L.divIcon({
                className: 'fallback-poi-marker',
                html: `<div style="background: #666; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">📍</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
        }
        
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
                                    <span style="margin-right: 8px; font-size: 18px;"><i class="${categoryStyle.iconClass}" style="font-size: 14px;"></i></span> ${poi.name}
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
                                    <button onclick="showPOIDetail('${poi.poi_id || poi.id || poi._id}')" 
                                            style="background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        ℹ️ Detaylar
                                    </button>
                                    <button onclick="openInGoogleMaps(${poi.lat || poi.latitude}, ${poi.lon || poi.lng || poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')" 
                                            style="background: #4285f4; color: white; border: none; padding: 6px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        🗺️ Google Maps
                                    </button>
                                    <button onclick="addToRoute({id: '${poi.poi_id || poi.id || poi._id}', name: '${poi.name.replace(/'/g, "\\'")}', latitude: ${poi.lat || poi.latitude}, longitude: ${poi.lon || poi.lng || poi.longitude}, category: '${poi.category}'})" 
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

        if (isLowScore && !showLowByDefault) {
            marker.setOpacity(0); // Başlangıçta gizli
            if (marker._icon) marker._icon.style.display = 'none';
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
        if (mapContainer) {
            mapContainer.classList.remove('loading');
        }
        if (map) {
            map.invalidateSize();
        }
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
            let popupOpened = false;
            try {
                (markers || []).forEach(marker => {
                    const markerLatLng = marker.getLatLng();
                    if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lng) < 0.0001) {
                        marker.openPopup();
                        popupOpened = true;
                    }
                });
            } catch (_) {}

            // Also try nearby-layer markers (Yakınımda POIs)
            if (!popupOpened) {
                try {
                    if (typeof nearbyPOIState !== 'undefined' && nearbyPOIState && nearbyPOIState.layer && typeof nearbyPOIState.layer.getLayers === 'function') {
                        nearbyPOIState.layer.getLayers().forEach(layerMarker => {
                            if (popupOpened || !layerMarker || typeof layerMarker.getLatLng !== 'function') return;
                            const p = layerMarker.getLatLng();
                            if (Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001) {
                                try { layerMarker.openPopup(); } catch (_) {}
                                popupOpened = true;
                            }
                        });
                    }
                } catch (_) {}
            }
        }, 500);
    }
}

// Helper function to create POI cards HTML
function createPOICards(pois, options = {}) {
    const formatDistance = (meters) => {
        const m = typeof meters === 'number' ? meters : parseFloat(meters);
        if (isNaN(m)) return '';
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        return `${Math.round(m)} m`;
    };

    return pois.map(poi => {
        const poiId = poi.poi_id || poi.id || poi._id;
        const lat = poi.lat || poi.latitude;
        const lng = poi.lon || poi.lng || poi.longitude;
        const categoryKey = poi.category || 'diger';
        const score = (typeof poi.recommendationScore === 'number') ? poi.recommendationScore : null;
        const distanceLabel = (options.showDistance || score === null) ? formatDistance(poi.distance_m) : '';

        const scoreHtml = (score !== null)
            ? `<div class="poi-card__score ${score >= 45 ? 'high-score' : 'low-score'}">${score}% Uygun</div>`
            : (distanceLabel ? `<div class="poi-card__score high-score">${distanceLabel} uzaklık</div>` : '');

        return `
        <div class="poi-card poi-card--interactive" data-poi-id="${poiId}" data-poi-category="${String(categoryKey).replace(/"/g, '&quot;')}">
            <div class="poi-card__image-container">
                <div class="poi-card__image-placeholder loading__skeleton">
                    <i class="fas fa-image"></i>
                </div>
                <div class="poi-card__image-overlay"></div>
                <span class="poi-card__category">${getCategoryDisplayName(categoryKey)}</span>
            </div>

            <div class="poi-card__content">
                <div class="poi-card__header">
                    <h3 class="poi-card__title">${poi.name}</h3>
                    ${scoreHtml}
                </div>
                <div class="poi-media-preview"></div>
                <div class="poi-card__actions">
                    <button class="btn btn--info btn--sm" onclick="event.stopPropagation(); showPOIDetail('${poiId}')">
                        <i class="fas fa-info-circle"></i> Detaylar
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="event.stopPropagation(); focusOnMap(${lat}, ${lng})">
                        <i class="fas fa-map-marker-alt"></i> Haritada Göster
                    </button>
                    <button class="btn btn--success btn--sm" onclick="event.stopPropagation(); addToRoute({id: '${poiId}', name: '${String(poi.name || '').replace(/'/g, "\\'")}', latitude: ${lat}, longitude: ${lng}, category: '${String(categoryKey).replace(/'/g, "\\'")}'})">
                        <i class="fas fa-plus"></i> Rotaya Ekle
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// Modern POI Cards for improved UX
function createModernPOICards(pois, type = 'primary') {
    return pois.map(poi => {
        const icon = getCategoryIcon(poi.category);
        const iconElement = icon.includes('<i') ? icon : `<span>${icon}</span>`;
        return `
        <div class="modern-poi-card poi-card ${type}" data-poi-id="${poi.id || poi._id}" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})">
            <div class="poi-card__image-container">
                <div class="poi-card__image-placeholder loading__skeleton">
                    <i class="fas fa-image"></i>
                </div>
                <div class="poi-card__image-overlay"></div>
                <span class="poi-card__category">${getCategoryDisplayName(poi.category)}</span>
            </div>
            
            <div class="poi-card-header">
                <div class="poi-category-badge">
                    ${iconElement}
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
                <div class="poi-media-preview"></div>
            </div>

            <div class="poi-card-actions">
                <button class="action-btn primary" onclick="event.stopPropagation(); focusOnMap(${poi.latitude}, ${poi.longitude})" title="Haritada Göster">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="action-btn secondary" onclick="event.stopPropagation(); openInGoogleMaps(${poi.lat || poi.latitude}, ${poi.lon || poi.lng || poi.longitude}, '${poi.name.replace(/'/g, "\\'")}')" title="Google Maps'te Aç">
                    <i class="fab fa-google"></i>
                </button>
                <button class="action-btn success" onclick="event.stopPropagation(); addToRoute({id: '${poi.poi_id || poi.id || poi._id}', name: '${poi.name.replace(/'/g, "\\'")}', latitude: ${poi.lat || poi.latitude}, longitude: ${poi.lon || poi.lng || poi.longitude}, category: '${poi.category}'})" title="Rotaya Ekle">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="action-btn info" onclick="event.stopPropagation(); showPOIDetails('${poi.poi_id || poi.id || poi._id}')" title="Detayları Göster">
                    <i class="fas fa-info"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
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
                        marker._icon.classList.add('poi-marker-low-score-visible');
                        marker.setOpacity(0.7); // Silik ama görünür
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

        // Log removed for cleaner console

    } else {
        // Hide low score POIs
        lowScorePOIs.style.transition = 'all 0.3s ease-in';
        lowScorePOIs.style.opacity = '0';
        lowScorePOIs.style.transform = 'translateY(-20px)';

        // Hide low score markers on map with animation
        if (markers && markers.length > 0) {
            markers.forEach(marker => {
                if (marker.isLowScore) {
                    marker._icon.classList.add('poi-marker-low-score-hidden');
                    marker.setOpacity(0);

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

        // Log removed for cleaner console
    }
}
async function initializeApp() {
    // Log removed for cleaner console

    if (typeof loadCategories === 'function') {
        try {
            await loadCategories();
        } catch (err) {
            console.error('Category loading failed:', err);
        }
    }

    if (typeof initializeTouchSupport === 'function') {
        try {
            initializeTouchSupport();
        } catch (err) {
            console.error('Touch support initialization failed:', err);
        }
    }

    const dynamicTab = document.getElementById('dynamicRoutesTab');
    const predefinedTab = document.getElementById('predefinedRoutesTab');
    const hasTabs = dynamicTab && predefinedTab;
    const hasPredefined = document.getElementById('predefinedRoutesList');
    const hasDynamic = document.querySelector('.preference-slider');

    if (hasTabs && typeof initializeRouteTabs === 'function') {
        try {
            initializeRouteTabs();
        } catch (err) {
            console.error('Route tabs initialization failed:', err);
        }
    } else if (hasPredefined && typeof initializePredefinedRoutes === 'function') {
        try {
            initializePredefinedRoutes();
            currentTab = 'predefined-routes';
        } catch (err) {
            console.error('Predefined routes initialization failed:', err);
        }
        if (typeof initializePredefinedMap === 'function') {
            try {
                await initializePredefinedMap();
            } catch (err) {
                console.error('Predefined map initialization failed:', err);
            }
        }
        const params = new URLSearchParams(window.location.search);
        const routeIdParam = params.get('routeId');
        if (routeIdParam && typeof selectPredefinedRoute === 'function') {
            const trySelect = async () => {
                const route = predefinedRoutes.find(r => String(r.id || r._id) === routeIdParam);
                if (route) {
                    try {
                        await selectPredefinedRoute(route);
                    } catch (e) {
                        console.warn('⚠️ selectPredefinedRoute failed:', e);
                    }
                    // Open Route Details Modal automatically for deep links
                    try {
                        const modal = (window.RouteDetailsModal && window.RouteDetailsModal.getInstance && window.RouteDetailsModal.getInstance())
                                     || window.routeDetailsModalInstance;
                        if (modal && typeof modal.show === 'function') {
                            modal.show(route);
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not open RouteDetailsModal:', e);
                    }
                } else {
                    setTimeout(trySelect, 500);
                }
            };
            trySelect();
        }
    }

    if (hasDynamic) {
        if (typeof initializeSliders === 'function') {
            try {
                initializeSliders();
            } catch (err) {
                console.error('Slider initialization failed:', err);
            }
        }
        if (typeof setupEventListeners === 'function') {
            try {
                setupEventListeners();
            } catch (err) {
                console.error('Event listener setup failed:', err);
            }
        }
    }

    if (document.getElementById('mapContainer') && typeof initializeMainMap === 'function') {
        try {
            await initializeMainMap();
        } catch (err) {
            console.error('Main map initialization failed:', err);
        }
    }

    // Initialize "Nearby POIs" UI (only on pages that include the section)
    try {
        initializeNearbyPOIsUI();
    } catch (err) {
        console.warn('Nearby POIs initialization skipped:', err);
    }

    if (document.getElementById('routeTypeChips')) {
        try {
            initializeEnhancedFilters();
        } catch (err) {
            console.error('Enhanced filters initialization failed:', err);
        }
    }

    // Initialize hover event management system
    if (typeof POIHoverIntegration !== 'undefined') {
        try {
            await initializeHoverSystem();
        } catch (err) {
            console.error('Hover system initialization failed:', err);
        }
    }

    // Deep-link: open POI detail when ?poi=<id> present
    try {
        const params = new URLSearchParams(window.location.search);
        const poiParam = params.get('poi');
        if (poiParam) {
            // Ensure Bootstrap/modal is ready, then show POI detail
            try {
                // Pre-fetch POI to optionally focus the map after showing
                const resp = await fetch(`${apiBase}/poi/${poiParam}`);
                if (resp.ok) {
                    const poi = await resp.json();
                    // Show detail modal with data to avoid double fetch
                    try { await showPOIDetail(poiParam, poi); } catch (_) { await showPOIDetail(poiParam); }
                    // Focus map if available and coordinates are valid
                    const lat = parseFloat(poi.latitude || poi.lat);
                    const lng = parseFloat(poi.longitude || poi.lng || poi.lon);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        try {
                            // Initialize map if container exists but map is not ready
                            if (document.getElementById('mapContainer') && typeof initializeMainMap === 'function' && (!window.map || !window.map._loaded)) {
                                await initializeMainMap();
                            }
                            if (typeof focusOnMap === 'function') {
                                focusOnMap(lat, lng);
                            }
                            // Ensure map section visible on pages that hide it initially
                            const mapSection = document.getElementById('mapSection');
                            if (mapSection) mapSection.style.display = 'block';
                        } catch (e) { console.warn('POI map focus skipped:', e); }
                    }
                } else {
                    // Fallback: at least attempt to open the modal
                    await showPOIDetail(poiParam);
                }
            } catch (e) {
                console.warn('Deep-link POI load failed:', e);
                try { await showPOIDetail(poiParam); } catch (_) {}
            }
        }
    } catch (e) {
        console.warn('POI deep-link handling error:', e);
    }

    // Deep-link: open panorama viewer when ?panorama=<id> present
    try {
        const params = new URLSearchParams(window.location.search);
        const panoramaParam = params.get('panorama');
        const panoramaSourceParam = params.get('panoramaSource') || '';
        if (panoramaParam) {
            try {
                const opened = await openPanoramaDeepLinkById(panoramaParam, panoramaSourceParam, { focusMap: true });
                if (!opened) {
                    const fallbackPanorama = buildPanoramaQueryFallback(params);
                    if (fallbackPanorama) {
                        await openPanoramaAlertItem(fallbackPanorama, { focusMap: true });
                    }
                }
            } catch (error) {
                console.warn('Panorama deep-link open failed:', error);
            }
        }
    } catch (e) {
        console.warn('Panorama deep-link handling error:', e);
    }

    // Log removed for cleaner console
}

// -------------------- Nearby POIs ("Yakınımda") --------------------
const nearbyPOIState = {
    activeLatLng: null,
    pendingLatLng: null,
    pickingMode: false,
    mapClickHandler: null,
    centerMarker: null,
    pendingMarker: null,
    radiusCircle: null,
    layer: null,
    poiMarkersById: new Map(),
    liveAlertWatchId: null,
    liveAlertMode: null,
    liveAlertStatesById: new Map(),
    liveAlertFeed: [],
    liveAlertFeedById: new Map(),
    liveAlertScanInFlight: false,
    lastLiveAlertScanAt: 0,
    lastLiveAlertScanLatLng: null,
    liveAlertRecentDeliveries: new Map(),
    liveAlertVisibilityPaused: false,
    liveAlertAutoResumeRequested: false,
};

const NEARBY_ALERT_PREFERENCES_STORAGE_KEY = 'nearby_poi_preferences_v1';
const NEARBY_ALERT_POI_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const NEARBY_ALERT_HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_ALERT_DUPLICATE_SUPPRESSION_MS = 10 * 1000;

function getDefaultNearbyAlertPreferences() {
    return {
        searchRadiusKm: '1',
        searchCategory: '',
        alertRadiusM: '250',
        alertAllCategories: true,
        alertCategories: [],
        alertPanoramas: true,
        mutedPoiIds: [],
        alertHistoryByPoiId: {},
    };
}

function normalizeNearbyAlertPoiId(poiId) {
    return String(poiId ?? '').trim();
}

function dispatchNearbyAlertMuteStateChanged() {
    try {
        window.dispatchEvent(new CustomEvent('nearby-alert-mutes-changed'));
    } catch (_) {}
}

function loadStoredNearbyAlertPreferences() {
    const defaults = getDefaultNearbyAlertPreferences();

    try {
        const rawValue = localStorage.getItem(NEARBY_ALERT_PREFERENCES_STORAGE_KEY);
        if (!rawValue) return { ...defaults };

        const parsed = JSON.parse(rawValue);
        const nextPreferences = {
            ...defaults,
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
        };

        nextPreferences.alertCategories = Array.isArray(nextPreferences.alertCategories)
            ? nextPreferences.alertCategories
            : [];
        nextPreferences.alertPanoramas = nextPreferences.alertPanoramas !== false;
        nextPreferences.mutedPoiIds = Array.isArray(nextPreferences.mutedPoiIds)
            ? nextPreferences.mutedPoiIds.map((poiId) => normalizeNearbyAlertPoiId(poiId)).filter(Boolean)
            : [];
        nextPreferences.alertHistoryByPoiId =
            nextPreferences.alertHistoryByPoiId && typeof nextPreferences.alertHistoryByPoiId === 'object'
                ? { ...nextPreferences.alertHistoryByPoiId }
                : {};

        return nextPreferences;
    } catch (error) {
        console.warn('Nearby preferences could not be loaded:', error);
        return { ...defaults };
    }
}

function saveStoredNearbyAlertPreferences(nextPreferences) {
    const defaults = getDefaultNearbyAlertPreferences();
    const preferences = {
        ...defaults,
        ...(nextPreferences && typeof nextPreferences === 'object' ? nextPreferences : {}),
        alertCategories: Array.isArray(nextPreferences?.alertCategories) ? nextPreferences.alertCategories : [],
        alertPanoramas: nextPreferences?.alertPanoramas !== false,
        mutedPoiIds: Array.isArray(nextPreferences?.mutedPoiIds)
            ? nextPreferences.mutedPoiIds.map((poiId) => normalizeNearbyAlertPoiId(poiId)).filter(Boolean)
            : [],
        alertHistoryByPoiId:
            nextPreferences?.alertHistoryByPoiId && typeof nextPreferences.alertHistoryByPoiId === 'object'
                ? { ...nextPreferences.alertHistoryByPoiId }
                : {},
    };

    try {
        localStorage.setItem(NEARBY_ALERT_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
        console.warn('Nearby preferences could not be saved:', error);
    }
}

function pruneStoredNearbyAlertHistory() {
    const preferences = loadStoredNearbyAlertPreferences();
    const now = Date.now();
    const nextHistory = {};
    let changed = false;

    Object.entries(preferences.alertHistoryByPoiId || {}).forEach(([poiId, timestamp]) => {
        const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
        const normalizedTimestamp = Number(timestamp);
        if (!normalizedPoiId || !Number.isFinite(normalizedTimestamp) || normalizedTimestamp <= 0) {
            changed = true;
            return;
        }

        if ((now - normalizedTimestamp) > NEARBY_ALERT_HISTORY_MAX_AGE_MS) {
            changed = true;
            return;
        }

        nextHistory[normalizedPoiId] = normalizedTimestamp;
    });

    if (changed) {
        preferences.alertHistoryByPoiId = nextHistory;
        saveStoredNearbyAlertPreferences(preferences);
    }
}

function getStoredPoiAlertTimestamp(poiId) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return 0;

    const preferences = loadStoredNearbyAlertPreferences();
    const timestamp = Number(preferences.alertHistoryByPoiId?.[normalizedPoiId] || 0);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function setStoredPoiAlertTimestamp(poiId, timestamp = Date.now()) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return;

    const preferences = loadStoredNearbyAlertPreferences();
    preferences.alertHistoryByPoiId = {
        ...(preferences.alertHistoryByPoiId || {}),
        [normalizedPoiId]: Number(timestamp) || Date.now(),
    };
    saveStoredNearbyAlertPreferences(preferences);
}

function isPoiNotificationMutedLocally(poiId) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return false;

    const preferences = loadStoredNearbyAlertPreferences();
    return (preferences.mutedPoiIds || []).includes(normalizedPoiId);
}

function setPoiNotificationMutedLocally(poiId, muted) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return;

    const preferences = loadStoredNearbyAlertPreferences();
    const mutedPoiIds = new Set(
        (preferences.mutedPoiIds || []).map((storedPoiId) => normalizeNearbyAlertPoiId(storedPoiId)).filter(Boolean),
    );

    if (muted) {
        mutedPoiIds.add(normalizedPoiId);
    } else {
        mutedPoiIds.delete(normalizedPoiId);
    }

    preferences.mutedPoiIds = Array.from(mutedPoiIds);
    saveStoredNearbyAlertPreferences(preferences);
}

function getStoredMutedPoiIds() {
    const preferences = loadStoredNearbyAlertPreferences();
    let mutedPoiIds = Array.isArray(preferences.mutedPoiIds)
        ? preferences.mutedPoiIds.map((poiId) => normalizeNearbyAlertPoiId(poiId)).filter(Boolean)
        : [];

    try {
        if (window.APDAndroid && typeof window.APDAndroid.getMutedPoiIds === 'function') {
            const nativeMutedIdsRaw = window.APDAndroid.getMutedPoiIds();
            const nativeMutedIds = JSON.parse(String(nativeMutedIdsRaw || '[]'));
            if (Array.isArray(nativeMutedIds)) {
                mutedPoiIds = nativeMutedIds.map((poiId) => normalizeNearbyAlertPoiId(poiId)).filter(Boolean);
                preferences.mutedPoiIds = mutedPoiIds;
                saveStoredNearbyAlertPreferences(preferences);
            }
        }
    } catch (error) {
        console.warn('Native muted alert list could not be read:', error);
    }

    return mutedPoiIds;
}

function isPoiNotificationMutedForCurrentDevice(poiId) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return false;

    try {
        if (window.APDAndroid && typeof window.APDAndroid.isPoiNotificationMuted === 'function') {
            const result = window.APDAndroid.isPoiNotificationMuted(normalizedPoiId);
            const isMuted = result === true || result === 'true';
            setPoiNotificationMutedLocally(normalizedPoiId, isMuted);
            return isMuted;
        }
    } catch (error) {
        console.warn('Native POI mute state could not be read:', error);
    }

    return isPoiNotificationMutedLocally(normalizedPoiId);
}

function setPoiNotificationMutedForCurrentDevice(poiId, muted) {
    const normalizedPoiId = normalizeNearbyAlertPoiId(poiId);
    if (!normalizedPoiId) return;

    setPoiNotificationMutedLocally(normalizedPoiId, muted);

    try {
        if (window.APDAndroid && typeof window.APDAndroid.setPoiNotificationMuted === 'function') {
            window.APDAndroid.setPoiNotificationMuted(normalizedPoiId, Boolean(muted));
        }
    } catch (error) {
        console.warn('Native POI mute state could not be updated:', error);
    }

    dispatchNearbyAlertMuteStateChanged();
}

function clearAllMutedPoiNotificationsForCurrentDevice() {
    const mutedPoiIds = getStoredMutedPoiIds();
    if (!mutedPoiIds.length) return 0;

    const preferences = loadStoredNearbyAlertPreferences();
    preferences.mutedPoiIds = [];
    saveStoredNearbyAlertPreferences(preferences);

    try {
        if (window.APDAndroid && typeof window.APDAndroid.clearAllMutedPoiNotifications === 'function') {
            window.APDAndroid.clearAllMutedPoiNotifications();
        } else if (window.APDAndroid && typeof window.APDAndroid.setPoiNotificationMuted === 'function') {
            mutedPoiIds.forEach((poiId) => {
                try {
                    window.APDAndroid.setPoiNotificationMuted(poiId, false);
                } catch (_) {}
            });
        }
    } catch (error) {
        console.warn('Native muted alert state could not be reset:', error);
    }

    dispatchNearbyAlertMuteStateChanged();
    return mutedPoiIds.length;
}

function hasPoiAlertCooldownActive(poiId, now = Date.now()) {
    const lastAlertAt = getStoredPoiAlertTimestamp(poiId);
    return Boolean(lastAlertAt && (now - lastAlertAt) < NEARBY_ALERT_POI_COOLDOWN_MS);
}

function isCompactNotificationViewport() {
    if (typeof window.matchMedia === 'function') {
        try {
            return window.matchMedia('(max-width: 768px)').matches;
        } catch (_) {}
    }

    return window.innerWidth <= 768;
}

function shouldPauseWebLiveAlertsWhenHidden() {
    if (window.APDAndroid) {
        return true;
    }

    try {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
            return navigator.userAgentData.mobile;
        }
    } catch (_) {}

    const userAgent = String(navigator.userAgent || '');
    if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
        return true;
    }

    try {
        return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches;
    } catch (_) {
        return false;
    }
}

function getFloatingNotificationShellStyles(type = 'info', interactive = false) {
    const backgroundByType = {
        success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        error: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
        warning: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
        info: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
    };
    const compact = isCompactNotificationViewport();

    return `
        position: fixed;
        z-index: 10000;
        background: ${backgroundByType[type] || backgroundByType.info};
        color: white;
        border-radius: ${compact ? '14px' : '10px'};
        box-shadow: 0 10px 28px rgba(0,0,0,0.24);
        max-width: ${compact ? 'calc(100vw - 24px)' : '450px'};
        ${compact
            ? 'left: 12px; right: 12px; bottom: 12px; top: auto; transform: translateY(18px);'
            : 'top: 20px; right: 20px; transform: translateX(400px);'}
        ${interactive ? 'padding: 16px 18px;' : 'padding: 12px 18px;'}
    `;
}

function registerLiveAlertDelivery(alertItemId, channel = 'in-app') {
    const normalizedAlertId = normalizeNearbyAlertPoiId(alertItemId);
    if (!normalizedAlertId) return;

    nearbyPOIState.liveAlertRecentDeliveries.set(normalizedAlertId, {
        at: Date.now(),
        channel,
    });
}

function shouldSuppressLiveAlertDelivery(alertItemId, now = Date.now()) {
    const normalizedAlertId = normalizeNearbyAlertPoiId(alertItemId);
    if (!normalizedAlertId) return false;

    const lastDelivery = nearbyPOIState.liveAlertRecentDeliveries.get(normalizedAlertId);
    return Boolean(lastDelivery && (now - lastDelivery.at) < LIVE_ALERT_DUPLICATE_SUPPRESSION_MS);
}

function clearLiveAlertDeliveryHistory() {
    nearbyPOIState.liveAlertRecentDeliveries.clear();
}

function initializeNearbyPOIsUI() {
    const section = document.getElementById('nearbyPOISection');
    if (!section) return;

    const locateBtn = document.getElementById('nearbyLocateBtn');
    const pickBtn = document.getElementById('nearbyPickBtn');
    const useBtn = document.getElementById('nearbyUseLocationBtn');
    const radiusSelect = document.getElementById('nearbyRadiusKm');
    const categorySelect = document.getElementById('nearbyCategoryFilter');
    const statusEl = document.getElementById('nearbyStatus');
    const resultsEl = document.getElementById('nearbyResults');
    const alertDistanceSelect = document.getElementById('nearbyAlertDistanceM');
    const alertToggleBtn = document.getElementById('nearbyAlertToggleBtn');
    const alertStatusEl = document.getElementById('nearbyAlertStatus');
    const alertFeedEl = document.getElementById('nearbyAlertFeed');
    const alertPreferencesBtn = document.getElementById('nearbyAlertPreferencesBtn');
    const alertPreferencesPanel = document.getElementById('nearbyAlertPreferencesPanel');
    const alertPreferenceSummaryEl = document.getElementById('nearbyAlertPreferenceSummary');
    const alertAllCategoriesToggle = document.getElementById('nearbyAlertAllCategoriesToggle');
    const alertPanoramaToggle = document.getElementById('nearbyAlertPanoramasToggle');
    const alertCategoryToolsEl = document.getElementById('nearbyAlertCategoryTools');
    const alertCategoryListEl = document.getElementById('nearbyAlertCategoryList');
    const alertSelectAllBtn = document.getElementById('nearbyAlertSelectAllBtn');
    const alertClearBtn = document.getElementById('nearbyAlertClearBtn');
    const alertResetMutedBtn = document.getElementById('nearbyAlertResetMutedBtn');

    if (!locateBtn || !pickBtn || !useBtn || !radiusSelect || !statusEl || !resultsEl) return;
    const canRunLiveAlerts = Boolean(alertDistanceSelect && alertToggleBtn && alertStatusEl && alertFeedEl);
    const defaultNearbyPreferences = getDefaultNearbyAlertPreferences();
    let nearbyCategoryOptions = [];

    const loadNearbyPreferences = () => {
        const preferences = loadStoredNearbyAlertPreferences();
        return {
            ...defaultNearbyPreferences,
            ...preferences,
            alertAllCategories: preferences.alertAllCategories !== false,
        };
    };

    const persistNearbyPreferences = (nextPreferences) => {
        const latestPreferences = loadStoredNearbyAlertPreferences();
        const mergedPreferences = {
            ...latestPreferences,
            ...nextPreferences,
            mutedPoiIds: Array.isArray(latestPreferences.mutedPoiIds) ? latestPreferences.mutedPoiIds : [],
            alertHistoryByPoiId:
                latestPreferences.alertHistoryByPoiId && typeof latestPreferences.alertHistoryByPoiId === 'object'
                    ? latestPreferences.alertHistoryByPoiId
                    : {},
        };

        saveStoredNearbyAlertPreferences(mergedPreferences);
    };

    const nearbyPreferences = loadNearbyPreferences();
    pruneStoredNearbyAlertHistory();

    const setSelectValue = (selectEl, preferredValue, fallbackValue = '') => {
        if (!selectEl) return;

        const options = Array.from(selectEl.options || []);
        const normalizedPreferred = String(preferredValue ?? '').trim();
        const normalizedFallback = String(fallbackValue ?? '').trim();

        if (normalizedPreferred && options.some((option) => option.value === normalizedPreferred)) {
            selectEl.value = normalizedPreferred;
            return;
        }

        if (options.some((option) => option.value === normalizedFallback)) {
            selectEl.value = normalizedFallback;
        }
    };

    const getCategoryLabelByName = (categoryName) => {
        const normalizedName = String(categoryName || '').trim();
        if (!normalizedName) return 'Tüm türler';

        const matchedCategory = nearbyCategoryOptions.find((category) => category.name === normalizedName);
        if (matchedCategory?.display_name) {
            return matchedCategory.display_name;
        }

        if (typeof getCategoryDisplayName === 'function') {
            return getCategoryDisplayName(normalizedName) || normalizedName;
        }

        return normalizedName;
    };

    const getNormalizedAlertCategoryNames = () => {
        const selectedNames = Array.isArray(nearbyPreferences.alertCategories) ? nearbyPreferences.alertCategories : [];
        const validNames = nearbyCategoryOptions.length
            ? new Set(nearbyCategoryOptions.map((category) => category.name))
            : null;
        const normalized = [];

        selectedNames.forEach((categoryName) => {
            const normalizedName = String(categoryName || '').trim();
            if (!normalizedName || normalized.includes(normalizedName)) return;
            if (validNames && !validNames.has(normalizedName)) return;
            normalized.push(normalizedName);
        });

        return normalized;
    };

    const getSelectedAlertCategories = () => (
        nearbyPreferences.alertAllCategories ? [] : getNormalizedAlertCategoryNames()
    );

    const isPanoramaAlertsEnabled = () => nearbyPreferences.alertPanoramas !== false;

    const hasPoiAlertSelection = () => (
        nearbyPreferences.alertAllCategories || getSelectedAlertCategories().length > 0
    );

    const getAlertCategorySummary = () => {
        const summaryParts = [];

        if (nearbyPreferences.alertAllCategories) {
            summaryParts.push('Tüm POI türleri');
        } else {
            const selectedCategories = getSelectedAlertCategories();
            if (selectedCategories.length) {
                const labels = selectedCategories.map((categoryName) => getCategoryLabelByName(categoryName));
                summaryParts.push(labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`);
            }
        }

        if (isPanoramaAlertsEnabled()) {
            summaryParts.push('360° görüntüler');
        }

        if (!summaryParts.length) return 'Henüz içerik seçilmedi';
        return summaryParts.join(' + ');
    };

    const syncAlertPreferenceSummary = () => {
        if (!alertPreferenceSummaryEl) return;
        alertPreferenceSummaryEl.textContent = `Uyarı türleri: ${getAlertCategorySummary()}`;
    };

    const syncMutedAlertResetButton = () => {
        if (!alertResetMutedBtn) return;

        const mutedCount = getStoredMutedPoiIds().length;
        alertResetMutedBtn.hidden = mutedCount === 0;
        alertResetMutedBtn.disabled = mutedCount === 0;
        alertResetMutedBtn.innerHTML = `<i class="fas fa-bell"></i> Sessizleri Aç${mutedCount > 0 ? ` (${mutedCount})` : ''}`;

        if (alertCategoryToolsEl) {
            const hasVisibleTool = [alertSelectAllBtn, alertClearBtn, alertResetMutedBtn].some((button) => button && !button.hidden);
            alertCategoryToolsEl.hidden = !hasVisibleTool;
        }
    };

    const syncAlertCategoryInputs = () => {
        if (!canRunLiveAlerts || !alertCategoryListEl) return;

        const useAllCategories = nearbyPreferences.alertAllCategories;
        const checkboxes = Array.from(alertCategoryListEl.querySelectorAll('input[data-alert-category]'));
        const hasEmptyState = Boolean(alertCategoryListEl.querySelector('.nearby-alert-category-empty'));
        const showCategorySelectionTools = !useAllCategories && checkboxes.length > 0;
        const hasMutedAlerts = getStoredMutedPoiIds().length > 0;

        checkboxes.forEach((input) => {
            const label = input.closest('.nearby-alert-category-option');
            const isChecked = Boolean(input.checked);
            if (label) {
                label.classList.toggle('is-checked', isChecked);
            }
            input.disabled = useAllCategories;
        });

        alertCategoryListEl.hidden = checkboxes.length > 0 ? useAllCategories : !hasEmptyState;

        if (alertSelectAllBtn) {
            alertSelectAllBtn.hidden = !showCategorySelectionTools;
            alertSelectAllBtn.disabled = !showCategorySelectionTools;
        }

        if (alertClearBtn) {
            alertClearBtn.hidden = !showCategorySelectionTools;
            alertClearBtn.disabled = !showCategorySelectionTools;
        }

        if (alertResetMutedBtn) {
            alertResetMutedBtn.hidden = !hasMutedAlerts;
            alertResetMutedBtn.disabled = !hasMutedAlerts;
        }

        if (alertCategoryToolsEl) {
            const hasVisibleTool = [alertSelectAllBtn, alertClearBtn, alertResetMutedBtn].some((button) => button && !button.hidden);
            alertCategoryToolsEl.hidden = !hasVisibleTool;
        }

        if (alertAllCategoriesToggle) {
            alertAllCategoriesToggle.checked = useAllCategories;
        }

        if (alertPanoramaToggle) {
            alertPanoramaToggle.checked = isPanoramaAlertsEnabled();
        }
    };

    const renderAlertCategoryPreferences = (categories) => {
        if (!canRunLiveAlerts || !alertCategoryListEl) return;

        nearbyCategoryOptions = Array.isArray(categories) ? categories.slice() : [];
        nearbyPreferences.alertCategories = getNormalizedAlertCategoryNames();

        if (!nearbyCategoryOptions.length) {
            alertCategoryListEl.innerHTML = '<p class="nearby-alert-category-empty">Kategori listesi şu anda yüklenemedi. Mevcut canlı uyarı türleri korunuyor.</p>';
            syncAlertCategoryInputs();
            syncAlertPreferenceSummary();
            return;
        }

        const selectedCategories = new Set(getNormalizedAlertCategoryNames());
        alertCategoryListEl.innerHTML = nearbyCategoryOptions.map((category) => `
            <label class="nearby-alert-category-option${selectedCategories.has(category.name) ? ' is-checked' : ''}">
                <input
                    type="checkbox"
                    data-alert-category="true"
                    value="${escapeHtml(category.name)}"
                    ${selectedCategories.has(category.name) ? 'checked' : ''}
                >
                <span>${escapeHtml(category.display_name || getCategoryLabelByName(category.name))}</span>
            </label>
        `).join('');

        syncAlertCategoryInputs();
        syncAlertPreferenceSummary();
        persistNearbyPreferences(nearbyPreferences);
    };

    const persistSearchPreferences = () => {
        nearbyPreferences.searchRadiusKm = String(radiusSelect?.value || defaultNearbyPreferences.searchRadiusKm);
        nearbyPreferences.searchCategory = getSelectedCategory();
        if (canRunLiveAlerts) {
            syncAlertDistanceSelection();
        }
        persistNearbyPreferences(nearbyPreferences);
    };

    const persistAlertPreferences = () => {
        if (canRunLiveAlerts) {
            syncAlertDistanceSelection();
        } else {
            nearbyPreferences.alertRadiusM = String(alertDistanceSelect?.value || defaultNearbyPreferences.alertRadiusM);
        }
        nearbyPreferences.alertCategories = getNormalizedAlertCategoryNames();
        nearbyPreferences.alertPanoramas = isPanoramaAlertsEnabled();
        persistNearbyPreferences(nearbyPreferences);
        syncAlertPreferenceSummary();
    };

    setSelectValue(radiusSelect, nearbyPreferences.searchRadiusKm, defaultNearbyPreferences.searchRadiusKm);
    if (alertDistanceSelect) {
        setSelectValue(alertDistanceSelect, nearbyPreferences.alertRadiusM, defaultNearbyPreferences.alertRadiusM);
    }

    const setStatus = (text, kind = '') => {
        statusEl.textContent = text || '';
        statusEl.classList.remove('error', 'success');
        if (kind) statusEl.classList.add(kind);
    };

    const setAlertStatus = (text, kind = '') => {
        if (!canRunLiveAlerts) return;
        alertStatusEl.textContent = text || '';
        alertStatusEl.classList.remove('error', 'success');
        if (kind) alertStatusEl.classList.add(kind);
    };

    const getRadiusMeters = () => {
        const km = parseFloat(radiusSelect.value);
        if (isNaN(km) || km <= 0) return 1000;
        return Math.round(km * 1000);
    };

    const getRequestedAlertRadiusMeters = () => {
        if (!alertDistanceSelect) return 250;
        const meters = parseInt(alertDistanceSelect.value, 10);
        if (!Number.isFinite(meters) || meters <= 0) return 250;
        return meters;
    };

    const getNearestAllowedAlertRadiusMeters = (requestedMeters = getRequestedAlertRadiusMeters()) => {
        if (!alertDistanceSelect) return Math.min(requestedMeters, getRadiusMeters());

        const searchRadiusMeters = getRadiusMeters();
        const allowedOptionValues = Array.from(alertDistanceSelect.options || [])
            .map((option) => parseInt(option.value, 10))
            .filter((value) => Number.isFinite(value) && value > 0 && value <= searchRadiusMeters)
            .sort((left, right) => left - right);

        if (!allowedOptionValues.length) {
            return Math.min(requestedMeters, searchRadiusMeters);
        }

        const cappedValues = allowedOptionValues.filter((value) => value <= requestedMeters);
        return cappedValues.length
            ? cappedValues[cappedValues.length - 1]
            : allowedOptionValues[0];
    };

    const syncAlertDistanceSelection = () => {
        if (!alertDistanceSelect) {
            const effectiveMeters = Math.min(250, getRadiusMeters());
            nearbyPreferences.alertRadiusM = String(effectiveMeters);
            return {
                changed: false,
                requestedMeters: effectiveMeters,
                effectiveMeters,
            };
        }

        const requestedMeters = getRequestedAlertRadiusMeters();
        const effectiveMeters = getNearestAllowedAlertRadiusMeters(requestedMeters);
        const nextValue = String(effectiveMeters);
        const changed = alertDistanceSelect.value !== nextValue;

        if (changed && Array.from(alertDistanceSelect.options || []).some((option) => option.value === nextValue)) {
            alertDistanceSelect.value = nextValue;
        }

        nearbyPreferences.alertRadiusM = nextValue;
        return {
            changed,
            requestedMeters,
            effectiveMeters,
        };
    };

    const getAlertRadiusMeters = () => getNearestAllowedAlertRadiusMeters();

    if (canRunLiveAlerts) {
        syncAlertDistanceSelection();
    }
    syncAlertPreferenceSummary();

    const getSelectedCategory = () => {
        if (!categorySelect || typeof categorySelect.value !== 'string') return '';
        return categorySelect.value.trim();
    };

    const getSelectedCategoryLabel = () => {
        if (!categorySelect) return 'Tüm türler';
        const option = categorySelect.selectedOptions && categorySelect.selectedOptions[0];
        const text = option && option.textContent ? option.textContent.trim() : '';
        return text || 'Tüm türler';
    };

    const getPoiKey = (poi) => String(
        poi?._id ||
        poi?.id ||
        poi?.poi_id ||
        `${poi?.name || 'poi'}:${poi?.latitude || poi?.lat}:${poi?.longitude || poi?.lng || poi?.lon}`
    );

    const isPanoramaAlertItem = (item) => (
        String(item?.entity_type || item?.source_type || '').toLowerCase() === 'panorama' ||
        String(item?.kind_label || '').toLowerCase().includes('360')
    );

    const getAlertItemKey = (item) => (
        isPanoramaAlertItem(item)
            ? String(item?.id || item?._id || item?.path || item?.name || '').trim()
            : getPoiKey(item)
    );

    const getAlertItemDisplayName = (item) => (
        isPanoramaAlertItem(item)
            ? (String(item?.caption || item?.name || '').trim() || '360° Panorama')
            : (item?.name || 'POI')
    );

    const getAlertItemTypeLabel = (item) => (
        isPanoramaAlertItem(item)
            ? '360° Panorama'
            : getCategoryDisplayName(item?.category || 'diger')
    );

    const buildPoiAlertTargetUrl = (poi) => {
        const poiId = String(poi?._id || poi?.id || poi?.poi_id || '').trim();
        if (!poiId) return '';
        return `${window.location.origin}${window.location.pathname}?poi=${encodeURIComponent(poiId)}`;
    };

    const buildAlertTargetUrl = (item) => (
        isPanoramaAlertItem(item)
            ? buildPanoramaDeepLink(item)
            : buildPoiAlertTargetUrl(item)
    );

    const ensureMapReadyAndVisible = async () => {
        const resultsSection = document.getElementById('resultsSection');
        const mapSection = document.getElementById('mapSection');
        if (resultsSection && (resultsSection.style.display === 'none')) {
            resultsSection.style.display = 'block';
        }
        if (mapSection) {
            mapSection.style.display = 'block';
        }

        try {
            if ((!map || !map._loaded) && (typeof window.initializeMainMap === 'function' || typeof initializeMainMap === 'function')) {
                await (window.initializeMainMap || initializeMainMap)();
            }
        } catch (e) {
            console.warn('Map init failed:', e);
        }

        if (!map || !window.L) {
            throw new Error('Harita hazır değil');
        }

        // Best-effort: fix sizing when section was previously hidden
        try { setTimeout(() => map.invalidateSize(), 50); } catch (_) {}

        if (!nearbyPOIState.layer) {
            nearbyPOIState.layer = L.layerGroup().addTo(map);
        }
    };

    const clearPickingMode = () => {
        nearbyPOIState.pendingLatLng = null;
        if (nearbyPOIState.pendingMarker && map) {
            try { map.removeLayer(nearbyPOIState.pendingMarker); } catch (_) {}
        }
        nearbyPOIState.pendingMarker = null;
        nearbyPOIState.pickingMode = false;
        if (nearbyPOIState.mapClickHandler && map) {
            try { map.off('click', nearbyPOIState.mapClickHandler); } catch (_) {}
        }
        nearbyPOIState.mapClickHandler = null;
        pickBtn.classList.remove('active');
        pickBtn.innerHTML = '<i class="fas fa-hand-pointer"></i> Haritadan Seç';
        useBtn.disabled = true;
    };

    const setCenterOverlays = (lat, lng, { pending = false } = {}) => {
        const latlng = L.latLng(lat, lng);
        const radiusM = getRadiusMeters();

        if (pending) {
            if (!nearbyPOIState.pendingMarker) {
                const icon = L.divIcon({
                    className: 'nearby-pending-location-marker',
                    html: `<div style="background:#2563eb;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(37,99,235,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;">◎</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                });
                nearbyPOIState.pendingMarker = L.marker(latlng, { icon }).addTo(map);
            } else {
                nearbyPOIState.pendingMarker.setLatLng(latlng);
            }
            return;
        }

        if (nearbyPOIState.pendingMarker) {
            try { map.removeLayer(nearbyPOIState.pendingMarker); } catch (_) {}
            nearbyPOIState.pendingMarker = null;
        }

        // Active center marker
        if (!nearbyPOIState.centerMarker) {
            const icon = L.divIcon({
                className: 'nearby-center-location-marker',
                html: `<div style="background:#111827;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(17,24,39,0.30);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;">📍</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            nearbyPOIState.centerMarker = L.marker(latlng, { icon }).addTo(map);
        } else {
            nearbyPOIState.centerMarker.setLatLng(latlng);
        }

        // Radius circle
        if (!nearbyPOIState.radiusCircle) {
            nearbyPOIState.radiusCircle = L.circle(latlng, {
                radius: radiusM,
                color: '#3b82f6',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
            }).addTo(map);
        } else {
            nearbyPOIState.radiusCircle.setLatLng(latlng);
            nearbyPOIState.radiusCircle.setRadius(radiusM);
        }
    };

    const formatDistance = (meters) => {
        const m = typeof meters === 'number' ? meters : parseFloat(meters);
        if (isNaN(m)) return '';
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        return `${Math.round(m)} m`;
    };

    const formatAlertTime = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (_) {
            return '';
        }
    };

    const renderAlertFeed = () => {
        if (!canRunLiveAlerts) return;

        if (!nearbyPOIState.liveAlertFeed.length) {
            alertFeedEl.innerHTML = '';
            return;
        }

        alertFeedEl.innerHTML = nearbyPOIState.liveAlertFeed.map((item) => `
            <div class="nearby-alert-item">
                <div class="nearby-alert-item-header">
                    <div>
                        <p class="nearby-alert-item-title">${escapeHtml(item.name)}</p>
                        <div class="nearby-alert-item-meta">
                            <span class="nearby-poi-chip">${escapeHtml(item.typeLabel)}</span>
                            <span class="nearby-poi-chip secondary">${escapeHtml(item.distanceLabel)}</span>
                            <span class="nearby-poi-chip secondary">${escapeHtml(item.timeLabel)}</span>
                        </div>
                    </div>
                </div>
                <div class="nearby-alert-item-actions">
                    <button class="nearby-alert-feed-btn" type="button" data-nearby-alert-action="map" data-alert-item-id="${escapeHtml(item.alertItemId)}">
                        Haritada Göster
                    </button>
                    <button class="nearby-alert-feed-btn secondary" type="button" data-nearby-alert-action="detail" data-alert-item-id="${escapeHtml(item.alertItemId)}">
                        ${escapeHtml(item.detailLabel)}
                    </button>
                </div>
            </div>
        `).join('');
    };

    const addAlertFeedItem = (item, distanceM) => {
        if (!canRunLiveAlerts) return;

        const alertItemId = getAlertItemKey(item);
        const nextItem = {
            alertItemId,
            name: getAlertItemDisplayName(item),
            typeLabel: getAlertItemTypeLabel(item),
            distanceLabel: formatDistance(distanceM || item.distance_m),
            timeLabel: formatAlertTime(Date.now()),
            detailLabel: isPanoramaAlertItem(item) ? '360° Aç' : 'Detay Aç',
        };

        nearbyPOIState.liveAlertFeedById.set(alertItemId, item);
        nearbyPOIState.liveAlertFeed = [
            nextItem,
            ...nearbyPOIState.liveAlertFeed.filter((feedItem) => feedItem.alertItemId !== alertItemId),
        ].slice(0, 5);

        const activeIds = new Set(nearbyPOIState.liveAlertFeed.map((feedItem) => feedItem.alertItemId));
        Array.from(nearbyPOIState.liveAlertFeedById.keys()).forEach((itemIdKey) => {
            if (!activeIds.has(itemIdKey)) {
                nearbyPOIState.liveAlertFeedById.delete(itemIdKey);
            }
        });

        renderAlertFeed();
    };

    const updateAlertToggleButton = () => {
        if (!canRunLiveAlerts) return;
        const isActive = nearbyPOIState.liveAlertMode === 'native' || nearbyPOIState.liveAlertWatchId != null;
        alertToggleBtn.classList.toggle('active', isActive);
        alertToggleBtn.innerHTML = isActive
            ? `<i class="fas fa-bell-slash"></i> ${nearbyPOIState.liveAlertMode === 'native' ? 'Arka Plan Takibini Durdur' : 'Canlı Uyarıyı Durdur'}`
            : '<i class="fas fa-bell"></i> Canlı Uyarıyı Başlat';
    };

    const resetLiveAlertState = () => {
        nearbyPOIState.liveAlertStatesById.clear();
        nearbyPOIState.liveAlertScanInFlight = false;
        nearbyPOIState.lastLiveAlertScanAt = 0;
        nearbyPOIState.lastLiveAlertScanLatLng = null;
    };

    const requestLiveAlertPermissions = async () => {
        const hasNativeNotificationBridge = Boolean(
            window.APDAndroid &&
            (
                typeof window.APDAndroid.requestNotificationPermission === 'function' ||
                typeof window.APDAndroid.showNearbyAlertNotification === 'function' ||
                typeof window.APDAndroid.showPoiNotification === 'function'
            )
        );

        try {
            if (window.APDAndroid && typeof window.APDAndroid.requestNotificationPermission === 'function') {
                window.APDAndroid.requestNotificationPermission();
            }
        } catch (error) {
            console.warn('Android notification permission request failed:', error);
        }

        if (hasNativeNotificationBridge) {
            return;
        }

        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.warn('Browser notification permission request failed:', error);
            }
        }
    };

    const hasNativePoiTrackingService = () => {
        return Boolean(
            window.APDAndroid &&
            typeof window.APDAndroid.startPoiTrackingService === 'function' &&
            typeof window.APDAndroid.stopPoiTrackingService === 'function'
        );
    };

    const isNativePoiTrackingServiceRunning = () => {
        if (!hasNativePoiTrackingService()) return false;

        try {
            const result = window.APDAndroid.isPoiTrackingServiceRunning?.();
            return result === true || result === 'true';
        } catch (error) {
            console.warn('Native tracking service state could not be read:', error);
            return false;
        }
    };

    const getNativePoiTrackingServiceStartStatus = () => {
        if (!hasNativePoiTrackingService()) return 'unavailable';

        try {
            const result = window.APDAndroid.getPoiTrackingServiceStartStatus?.();
            return typeof result === 'string' && result.trim() ? result.trim() : 'idle';
        } catch (error) {
            console.warn('Native tracking service start status could not be read:', error);
            return 'idle';
        }
    };

    const getNativePoiTrackingServiceLastError = () => {
        if (!hasNativePoiTrackingService()) return '';

        try {
            const result = window.APDAndroid.getPoiTrackingServiceLastError?.();
            return typeof result === 'string' ? result.trim() : '';
        } catch (error) {
            console.warn('Native tracking service error could not be read:', error);
            return '';
        }
    };

    const waitForNativePoiTrackingServiceStart = async ({ timeoutMs = 45000, intervalMs = 300 } = {}) => {
        const startedAt = Date.now();

        while ((Date.now() - startedAt) < timeoutMs) {
            if (isNativePoiTrackingServiceRunning()) {
                return;
            }

            const status = getNativePoiTrackingServiceStartStatus();
            const errorMessage = getNativePoiTrackingServiceLastError();

            if (status === 'error') {
                throw new Error(errorMessage || 'Android arka plan takibi başlatılamadı.');
            }

            if (status !== 'pending_location_permission' && status !== 'pending_background_permission' && status !== 'starting') {
                if (errorMessage) {
                    throw new Error(errorMessage);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        throw new Error(
            getNativePoiTrackingServiceLastError() ||
            'Android arka plan takibi zamanında başlatılamadı. Konum ve bildirim izinlerini kontrol edin.',
        );
    };

    const renderResults = (payload) => {
        const pois = Array.isArray(payload?.pois) ? payload.pois : [];
        if (pois.length === 0) {
            resultsEl.innerHTML = '';
            const categoryMessage = getSelectedCategory() ? ` (${getSelectedCategoryLabel()})` : '';
            setStatus(`Bu mesafede POI bulunamadı${categoryMessage}.`, 'error');
            return;
        }

        const categoryMessage = getSelectedCategory() ? ` • Tür: ${getSelectedCategoryLabel()}` : '';
        setStatus(`${pois.length} POI bulundu (mesafeye göre sıralı${categoryMessage}).`, 'success');

        // Reuse the same POI card UI used elsewhere (recommendations / all POIs)
        resultsEl.innerHTML = `
            <div class="poi-grid">
                ${createPOICards(pois, { showDistance: true })}
            </div>
        `;

        // Ensure card media and click handlers are wired (same behavior as other lists)
        try { initializePOICardsMedia(); } catch (_) {}
        try { updatePOICardClickHandlers(); } catch (_) {}
    };

    const findExistingMarker = (poi) => {
        const pid = String(poi._id || poi.id || poi.poi_id || '');
        if (!pid) return null;
        return (markers || []).find(mk => {
            const id = mk && mk.poiData && (mk.poiData.poi_id || mk.poiData.id || mk.poiData._id);
            return id != null && String(id) === pid;
        }) || null;
    };

    const createNearbyMarker = (poi) => {
        const lat = parseFloat(poi.latitude || poi.lat);
        const lng = parseFloat(poi.longitude || poi.lng || poi.lon);
        if (isNaN(lat) || isNaN(lng)) return null;

        const category = poi.category || '';
        const style = typeof getCategoryStyle === 'function' ? getCategoryStyle(category) : { color: '#3b82f6', iconClass: 'fas fa-map-marker-alt' };

        const icon = L.divIcon({
            className: 'nearby-poi-marker',
            html: `
                <div style="
                    background:${style.color};
                    width:30px;height:30px;border-radius:50%;
                    border:3px solid white;
                    box-shadow:0 4px 14px rgba(0,0,0,0.25);
                    display:flex;align-items:center;justify-content:center;
                    color:white;
                ">
                    <i class="${style.iconClass}" style="font-size: 13px;"></i>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -14],
        });

        const distanceLabel = formatDistance(poi.distance_m);
        const popupHtml = `
            <div style="min-width:220px;font-family:'Segoe UI',sans-serif;">
                <div style="font-weight:800;margin-bottom:6px;">${escapeHtml(poi.name || 'POI')}</div>
                <div style="color:#64748b;font-size:12px;margin-bottom:8px;">${escapeHtml(getCategoryDisplayName(category) || 'POI')}</div>
                ${distanceLabel ? `<div style="font-size:12px;color:#111827;"><strong>Mesafe:</strong> ${escapeHtml(distanceLabel)}</div>` : ''}
                <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="showPOIDetail('${String(poi._id || poi.id || poi.poi_id || '').replace(/'/g, "\\'")}')" style="background:#17a2b8;color:#fff;border:none;padding:6px 10px;border-radius:12px;font-size:11px;cursor:pointer;">ℹ️ Detaylar</button>
                    <button onclick="openInGoogleMaps(${lat}, ${lng}, '${String(poi.name || '').replace(/'/g, "\\'")}')" style="background:#4285f4;color:#fff;border:none;padding:6px 10px;border-radius:12px;font-size:11px;cursor:pointer;">🗺️ Google Maps</button>
                    <button onclick="addToRoute({id: '${String(poi._id || poi.id || poi.poi_id || '').replace(/'/g, "\\'")}', name: '${String(poi.name || '').replace(/'/g, "\\'")}', latitude: ${lat}, longitude: ${lng}, category: '${String(category).replace(/'/g, "\\'")}'})" style="background:var(--primary-color);color:#fff;border:none;padding:6px 10px;border-radius:12px;font-size:11px;cursor:pointer;">➕ Rotaya Ekle</button>
                </div>
            </div>
        `;

        const marker = L.marker([lat, lng], { icon }).bindPopup(popupHtml, { maxWidth: 320, autoPan: true });
        marker.poiData = poi;
        return marker;
    };

    const focusPOIOnMap = async (poi) => {
        await ensureMapReadyAndVisible();

        const lat = parseFloat(poi.latitude || poi.lat);
        const lng = parseFloat(poi.longitude || poi.lng || poi.lon);
        if (isNaN(lat) || isNaN(lng)) return;

        // Prefer existing markers if they exist (recommendations / exploration)
        const existing = findExistingMarker(poi);
        let marker = existing;

        if (!marker) {
            const pid = String(poi._id || poi.id || poi.poi_id || '');
            marker = nearbyPOIState.poiMarkersById.get(pid) || null;
            if (!marker) {
                marker = createNearbyMarker(poi);
                if (marker) {
                    nearbyPOIState.layer.addLayer(marker);
                    if (pid) nearbyPOIState.poiMarkersById.set(pid, marker);
                }
            }
        }

        // Focus + open popup
        try {
            map.setView([lat, lng], 16, { animate: true });
        } catch (_) {
            map.setView([lat, lng], 16);
        }
        try { marker && marker.openPopup(); } catch (_) {}

        // Bring map into view
        try {
            const mapSection = document.getElementById('mapSection');
            if (mapSection) mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
    };

    const populateCategoryOptions = async () => {
        if (!categorySelect) return;

        const previousValue = categorySelect.value || '';
        let categories = [];

        try {
            if (window.POIClient && typeof window.POIClient.getPOICategories === 'function') {
                const payload = await window.POIClient.getPOICategories();
                if (Array.isArray(payload)) {
                    categories = payload;
                }
            }
        } catch (error) {
            console.warn('Category list could not be loaded from API:', error);
        }

        if (!categories.length && window.CATEGORIES && Array.isArray(window.CATEGORIES)) {
            categories = window.CATEGORIES.map((category) => ({
                name: category.name,
                display_name: category.displayName,
            }));
        }

        categories = categories
            .map((category) => ({
                name: String(category.name || '').trim(),
                display_name: String(category.display_name || getCategoryDisplayName(category.name || '') || category.name || '').trim(),
            }))
            .filter((category) => category.name)
            .sort((left, right) => left.display_name.localeCompare(right.display_name, 'tr'));

        categorySelect.innerHTML = [
            '<option value="">Tüm türler</option>',
            ...categories.map((category) => (
                `<option value="${escapeHtml(category.name)}">${escapeHtml(category.display_name || category.name)}</option>`
            )),
        ].join('');

        setSelectValue(categorySelect, nearbyPreferences.searchCategory || previousValue, '');
        renderAlertCategoryPreferences(categories);
    };

    const fetchNearby = async (lat, lng, options = {}) => {
        const radiusM = Number.isFinite(options.radiusM) ? options.radiusM : getRadiusMeters();
        const limit = Number.isFinite(options.limit) ? options.limit : 50;
        const hasCategoryOverride = Object.prototype.hasOwnProperty.call(options, 'category');
        const hasCategoriesOverride = Object.prototype.hasOwnProperty.call(options, 'categories');
        const category = hasCategoryOverride
            ? (typeof options.category === 'string' ? options.category.trim() : '')
            : (hasCategoriesOverride ? '' : getSelectedCategory());
        const categories = Array.isArray(options.categories)
            ? options.categories.map((value) => String(value || '').trim()).filter(Boolean)
            : [];

        const searchParams = new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            radius_m: String(radiusM),
            limit: String(limit),
        });

        if (categories.length) {
            categories.forEach((categoryName) => {
                searchParams.append('categories', categoryName);
            });
        } else if (category) {
            searchParams.set('category', category);
        }

        const res = await fetch(`${apiBase}/pois/nearby?${searchParams.toString()}`, { credentials: 'include' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Yakın POI API hatası: ${res.status}${text ? ` - ${text}` : ''}`);
        }
        return await res.json();
    };

    const fetchNearbyPanoramas = async (lat, lng, options = {}) => {
        const radiusM = Number.isFinite(options.radiusM) ? options.radiusM : getAlertRadiusMeters();
        const limit = Number.isFinite(options.limit) ? options.limit : 20;
        const searchParams = new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            radius_m: String(radiusM),
            limit: String(limit),
        });

        const res = await fetch(`/api/panoramas/nearby?${searchParams.toString()}`, { credentials: 'include' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Yakın panorama API hatası: ${res.status}${text ? ` - ${text}` : ''}`);
        }

        return await res.json();
    };

    const runNearbySearch = async (lat, lng, { source = 'active' } = {}) => {
        setStatus('Yakındaki POI\'ler aranıyor...', '');
        resultsEl.innerHTML = '';

        await ensureMapReadyAndVisible();

        // clear layer for fresh results
        try { nearbyPOIState.layer.clearLayers(); } catch (_) {}
        nearbyPOIState.poiMarkersById.clear();

        // keep center marker/circle on map (not inside layer)
        if (source !== 'pending') {
            setCenterOverlays(lat, lng, { pending: false });
        }

        const payload = await fetchNearby(lat, lng, {
            radiusM: getRadiusMeters(),
            limit: 50,
            category: getSelectedCategory(),
        });
        renderResults(payload);

        // Add result markers (so "popup" is instant)
        try {
            (payload.pois || []).forEach(poi => {
                const pid = String(poi._id || poi.id || poi.poi_id || '');
                if (pid && findExistingMarker(poi)) return;
                const mk = createNearbyMarker(poi);
                if (!mk) return;
                nearbyPOIState.layer.addLayer(mk);
                if (pid) nearbyPOIState.poiMarkersById.set(pid, mk);
            });
        } catch (_) {}

        // Focus on center a bit
        try { map.setView([lat, lng], 15, { animate: true }); } catch (_) { map.setView([lat, lng], 15); }
    };

    const shouldRunLiveAlertScan = (lat, lng, { force = false } = {}) => {
        if (force) return true;
        if (!nearbyPOIState.lastLiveAlertScanLatLng) return true;

        const now = Date.now();
        const elapsedMs = now - nearbyPOIState.lastLiveAlertScanAt;
        const movedMeters = getDistance(
            nearbyPOIState.lastLiveAlertScanLatLng.lat,
            nearbyPOIState.lastLiveAlertScanLatLng.lng,
            lat,
            lng,
        ) * 1000;

        return movedMeters >= 50 || elapsedMs >= 30000;
    };

    const triggerLiveAlert = (item, distanceM) => {
        const alertItemId = getAlertItemKey(item);
        const isPanorama = isPanoramaAlertItem(item);
        const itemTypeLabel = getAlertItemTypeLabel(item);
        const itemName = getAlertItemDisplayName(item);
        const distanceLabel = formatDistance(distanceM || item.distance_m);
        const title = isPanorama ? '360° panorama yakınınızda' : `${itemTypeLabel} POI yakınınızda`;
        const message = `${itemName} ${distanceLabel ? `${distanceLabel} mesafede.` : 'yakınınızda.'}`;
        const now = Date.now();

        if (shouldSuppressLiveAlertDelivery(alertItemId, now)) {
            return;
        }

        registerLiveAlertDelivery(alertItemId, 'scan');

        setAlertStatus(message, 'success');
        addAlertFeedItem(item, distanceM || item.distance_m);

        try {
            if (typeof showNotificationWithAction === 'function') {
                showNotificationWithAction(
                    message,
                    'success',
                    'Bildirimi Sustur',
                    () => {
                        setPoiNotificationMutedForCurrentDevice(alertItemId, true);
                        setStoredPoiAlertTimestamp(alertItemId, Date.now());
                        if (!isPanorama && currentPOIData && getCurrentPOIAlertIdentifier(currentPOIData) === alertItemId) {
                            updatePOIAlertMuteButton(currentPOIData);
                        }
                        setAlertStatus(`"${itemName}" için bildirimler kapatıldı.`, 'success');
                    },
                    isPanorama ? '360° Aç' : 'Detayı Aç',
                    async () => {
                        if (isPanorama) {
                            try { await openPanoramaAlertItem(item); } catch (_) {}
                            return;
                        }
                        try { await showPOIDetail(String(item._id || item.id || item.poi_id || alertItemId), item); } catch (_) {}
                    },
                );
            } else if (typeof showNotification === 'function') {
                showNotification(message, 'success');
            }
        } catch (_) {}

        let nativeNotificationSent = false;
        try {
            const targetUrl = buildAlertTargetUrl(item);
            if (window.APDAndroid && typeof window.APDAndroid.showNearbyAlertNotification === 'function') {
                window.APDAndroid.showNearbyAlertNotification(title, message, alertItemId, targetUrl);
                nativeNotificationSent = true;
            } else if (!isPanorama && window.APDAndroid && typeof window.APDAndroid.showPoiNotification === 'function') {
                window.APDAndroid.showPoiNotification(title, message, alertItemId);
                nativeNotificationSent = true;
            }
        } catch (error) {
            console.warn('Android notification bridge failed:', error);
        }

        if (!nativeNotificationSent && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, {
                    body: message,
                    tag: `nearby-alert-${alertItemId}`,
                    renotify: false,
                    data: {
                        alertItemId,
                        type: isPanorama ? 'panorama' : 'poi',
                    },
                });

                notification.onclick = async () => {
                    try { window.focus(); } catch (_) {}
                    if (isPanorama) {
                        try { await openPanoramaAlertItem(item); } catch (_) {}
                        return;
                    }
                    try { await showPOIDetail(String(item._id || item.id || item.poi_id || alertItemId), item); } catch (_) {}
                    try { focusPOIOnMap(item); } catch (_) {}
                };
            } catch (error) {
                console.warn('Browser notification failed:', error);
            }
        }
    };

    const hasValidAlertSelection = () => (
        hasPoiAlertSelection() || isPanoramaAlertsEnabled()
    );

    const ensureValidAlertSelection = () => {
        if (hasValidAlertSelection()) return;
        throw new Error('Canlı uyarı için en az bir POI türü seçin veya 360° görüntü uyarısını açık tutun.');
    };

    const applyAlertPreferenceChanges = async () => {
        syncAlertCategoryInputs();
        persistAlertPreferences();

        if (!hasValidAlertSelection()) {
            if (nearbyPOIState.liveAlertMode === 'native' || nearbyPOIState.liveAlertWatchId != null) {
                stopLiveAlerts();
                setAlertStatus('Canlı uyarı durduruldu. En az bir POI türü veya 360° görüntü seçin.', 'error');
                return;
            }

            setAlertStatus('Canlı uyarı için en az bir POI türü veya 360° görüntü seçin.', 'error');
            return;
        }

        if (nearbyPOIState.liveAlertMode === 'native') {
            await restartNativePoiTrackingService();
            return;
        }

        if (nearbyPOIState.liveAlertWatchId != null && nearbyPOIState.activeLatLng) {
            resetLiveAlertState();
            const { lat, lng } = nearbyPOIState.activeLatLng;
            await processLiveAlertPosition(lat, lng, { force: true });
            return;
        }

        setAlertStatus(`Uyarı türleri ${getAlertCategorySummary()} olarak ayarlandı.`, '');
    };

    const processLiveAlertPosition = async (lat, lng, { force = false } = {}) => {
        if (!canRunLiveAlerts) return;
        if (nearbyPOIState.liveAlertScanInFlight && !force) return;
        if (!shouldRunLiveAlertScan(lat, lng, { force })) return;
        if (document.hidden && nearbyPOIState.liveAlertMode === 'web' && shouldPauseWebLiveAlertsWhenHidden() && !force) return;
        ensureValidAlertSelection();

        nearbyPOIState.liveAlertScanInFlight = true;
        nearbyPOIState.lastLiveAlertScanAt = Date.now();
        nearbyPOIState.lastLiveAlertScanLatLng = { lat, lng };

        try {
            const shouldFetchPois = hasPoiAlertSelection();
            const shouldFetchPanoramas = isPanoramaAlertsEnabled();
            const [poiResult, panoramaResult] = await Promise.allSettled([
                shouldFetchPois
                    ? fetchNearby(lat, lng, {
                        radiusM: getAlertRadiusMeters(),
                        limit: 20,
                        categories: getSelectedAlertCategories(),
                    })
                    : Promise.resolve({ pois: [] }),
                shouldFetchPanoramas
                    ? fetchNearbyPanoramas(lat, lng, {
                        radiusM: getAlertRadiusMeters(),
                        limit: 20,
                    })
                    : Promise.resolve({ panoramas: [] }),
            ]);

            if (poiResult.status === 'rejected' && shouldFetchPois) {
                console.warn('Live alert POI scan failed:', poiResult.reason);
            }
            if (panoramaResult.status === 'rejected' && shouldFetchPanoramas) {
                console.warn('Live alert panorama scan failed:', panoramaResult.reason);
            }

            const poiPayload = poiResult.status === 'fulfilled' ? poiResult.value : { pois: [] };
            const panoramaPayload = panoramaResult.status === 'fulfilled' ? panoramaResult.value : { panoramas: [] };
            const successfulSourceCount = [poiResult, panoramaResult].filter((result) => result.status === 'fulfilled').length;
            const requestedSourceCount = (shouldFetchPois ? 1 : 0) + (shouldFetchPanoramas ? 1 : 0);

            if (requestedSourceCount > 0 && successfulSourceCount === 0) {
                const failureReason = poiResult.status === 'rejected' ? poiResult.reason : panoramaResult.status === 'rejected' ? panoramaResult.reason : null;
                throw failureReason || new Error('Canlı uyarı taraması yapılamadı.');
            }

            const nearbyAlertItems = [
                ...(Array.isArray(poiPayload?.pois) ? poiPayload.pois : []),
                ...(Array.isArray(panoramaPayload?.panoramas) ? panoramaPayload.panoramas.map((panorama) => createPanoramaAlertRecord(panorama, panorama?.source_type || 'standalone')) : []),
            ].sort((left, right) => {
                const leftDistance = typeof left?.distance_m === 'number' ? left.distance_m : parseFloat(left?.distance_m || 0);
                const rightDistance = typeof right?.distance_m === 'number' ? right.distance_m : parseFloat(right?.distance_m || 0);
                return leftDistance - rightDistance;
            });

            const visibleItemIds = new Set();
            const now = Date.now();

            nearbyAlertItems.forEach((item) => {
                const alertItemId = getAlertItemKey(item);
                const storedLastAlertAt = getStoredPoiAlertTimestamp(alertItemId);
                const distanceM = typeof item.distance_m === 'number' ? item.distance_m : parseFloat(item.distance_m || 0);
                const existing = nearbyPOIState.liveAlertStatesById.get(alertItemId) || {
                    inside: false,
                    lastAlertAt: storedLastAlertAt,
                };

                visibleItemIds.add(alertItemId);

                if (isPoiNotificationMutedForCurrentDevice(alertItemId)) {
                    existing.inside = true;
                    existing.lastAlertAt = Math.max(existing.lastAlertAt || 0, storedLastAlertAt);
                    nearbyPOIState.liveAlertStatesById.set(alertItemId, existing);
                    return;
                }

                const effectiveLastAlertAt = Math.max(existing.lastAlertAt || 0, storedLastAlertAt);
                existing.lastAlertAt = effectiveLastAlertAt;

                if (!existing.inside && (!effectiveLastAlertAt || (now - effectiveLastAlertAt) >= NEARBY_ALERT_POI_COOLDOWN_MS)) {
                    triggerLiveAlert(item, distanceM);
                    existing.lastAlertAt = now;
                    setStoredPoiAlertTimestamp(alertItemId, now);
                }

                existing.inside = true;
                nearbyPOIState.liveAlertStatesById.set(alertItemId, existing);
            });

            Array.from(nearbyPOIState.liveAlertStatesById.entries()).forEach(([alertItemId, state]) => {
                if (visibleItemIds.has(alertItemId)) return;
                state.inside = false;
                if (state.lastAlertAt && (now - state.lastAlertAt) > NEARBY_ALERT_HISTORY_MAX_AGE_MS) {
                    nearbyPOIState.liveAlertStatesById.delete(alertItemId);
                    return;
                }
                nearbyPOIState.liveAlertStatesById.set(alertItemId, state);
            });

            if (nearbyAlertItems.length > 0) {
                const nearest = nearbyAlertItems[0];
                setAlertStatus(
                    `Canlı uyarı açık. ${getAlertCategorySummary()} için en yakın içerik: ${getAlertItemDisplayName(nearest)} (${getAlertItemTypeLabel(nearest)}, ${formatDistance(nearest.distance_m)}).`,
                    'success',
                );
            } else {
                setAlertStatus(
                    `Canlı uyarı açık. ${getAlertCategorySummary()} için ${formatDistance(getAlertRadiusMeters())} içinde uygun içerik yok.`,
                    '',
                );
            }
        } catch (error) {
            console.warn('Live alert scan failed:', error);
            setAlertStatus(error.message || 'Canlı uyarı taraması yapılamadı.', 'error');
        } finally {
            nearbyPOIState.liveAlertScanInFlight = false;
        }
    };

    const stopLiveAlerts = ({ preserveFeed = true, preserveDeliveryHistory = false, preserveVisibilityState = false } = {}) => {
        if (nearbyPOIState.liveAlertMode === 'native' && hasNativePoiTrackingService()) {
            try {
                window.APDAndroid.stopPoiTrackingService();
            } catch (error) {
                console.warn('Native tracking service could not be stopped:', error);
            }
        }

        if (nearbyPOIState.liveAlertWatchId != null) {
            try { navigator.geolocation.clearWatch(nearbyPOIState.liveAlertWatchId); } catch (_) {}
        }

        nearbyPOIState.liveAlertWatchId = null;
        nearbyPOIState.liveAlertMode = null;
        resetLiveAlertState();

        if (!preserveDeliveryHistory) {
            clearLiveAlertDeliveryHistory();
        }

        if (!preserveVisibilityState) {
            nearbyPOIState.liveAlertVisibilityPaused = false;
            nearbyPOIState.liveAlertAutoResumeRequested = false;
        }

        if (!preserveFeed) {
            nearbyPOIState.liveAlertFeed = [];
            nearbyPOIState.liveAlertFeedById.clear();
            renderAlertFeed();
        }

        updateAlertToggleButton();
    };

    const pauseWebLiveAlertsForVisibility = () => {
        if (!shouldPauseWebLiveAlertsWhenHidden()) {
            return;
        }

        if (nearbyPOIState.liveAlertMode !== 'web' || nearbyPOIState.liveAlertWatchId == null) {
            return;
        }

        nearbyPOIState.liveAlertVisibilityPaused = true;
        nearbyPOIState.liveAlertAutoResumeRequested = true;
        stopLiveAlerts({
            preserveFeed: true,
            preserveDeliveryHistory: true,
            preserveVisibilityState: true,
        });
        setAlertStatus('Sekme arka plana alındı, canlı uyarı geçici olarak duraklatıldı.', '');
    };

    const resumeWebLiveAlertsAfterVisibility = async () => {
        if (!nearbyPOIState.liveAlertVisibilityPaused || !nearbyPOIState.liveAlertAutoResumeRequested) {
            return;
        }

        nearbyPOIState.liveAlertVisibilityPaused = false;
        nearbyPOIState.liveAlertAutoResumeRequested = false;

        if (nearbyPOIState.liveAlertMode != null || nearbyPOIState.liveAlertWatchId != null) {
            return;
        }

        try {
            await startLiveAlerts({ allowNativeTracking: false, preserveDeliveryHistory: true });
            if (nearbyPOIState.liveAlertMode === 'web') {
                setAlertStatus('Sekme yeniden görünür oldu, canlı uyarı devam ediyor.', 'success');
            }
        } catch (error) {
            console.warn('Live alerts could not be resumed after visibility change:', error);
            setAlertStatus(error.message || 'Canlı uyarı yeniden başlatılamadı.', 'error');
        }
    };

    const restartNativePoiTrackingService = async () => {
        if (!hasNativePoiTrackingService()) return;
        ensureValidAlertSelection();

        await requestLiveAlertPermissions();
        window.APDAndroid.startPoiTrackingService(
            nearbyPreferences.alertAllCategories ? '' : JSON.stringify(getSelectedAlertCategories()),
            String(getAlertRadiusMeters()),
            String(isPanoramaAlertsEnabled()),
            String(nearbyPreferences.alertAllCategories),
        );
        await waitForNativePoiTrackingServiceStart();
        nearbyPOIState.liveAlertMode = 'native';
        updateAlertToggleButton();
        setAlertStatus(
            `Android foreground service aktif. Türler: ${getAlertCategorySummary()}, eşik: ${formatDistance(getAlertRadiusMeters())}.`,
            'success',
        );
    };

    const startLiveAlerts = async ({ allowNativeTracking = true, preserveDeliveryHistory = false } = {}) => {
        if (!canRunLiveAlerts) return;
        if (nearbyPOIState.liveAlertMode === 'native' || nearbyPOIState.liveAlertWatchId != null) return;
        ensureValidAlertSelection();
        clearPickingMode();
        nearbyPOIState.liveAlertVisibilityPaused = false;
        nearbyPOIState.liveAlertAutoResumeRequested = false;

        if (!preserveDeliveryHistory) {
            clearLiveAlertDeliveryHistory();
        }

        let nativeStartError = null;

        if (allowNativeTracking && hasNativePoiTrackingService()) {
            try {
                await restartNativePoiTrackingService();
                return;
            } catch (error) {
                nativeStartError = error;
                nearbyPOIState.liveAlertMode = null;
                updateAlertToggleButton();
                console.warn('Native tracking service could not be started, falling back to web live alerts:', error);
            }
        }

        if (!navigator.geolocation) {
            throw new Error('Bu cihazda canlı konum takibi desteklenmiyor');
        }

        setAlertStatus('Canlı uyarı başlatılıyor...', '');
        await requestLiveAlertPermissions();

        const location = await getCurrentLocation();
        const lat = location.latitude;
        const lng = location.longitude;

        nearbyPOIState.activeLatLng = { lat, lng };
        await ensureMapReadyAndVisible();
        setCenterOverlays(lat, lng, { pending: false });

        try {
            await runNearbySearch(lat, lng);
        } catch (error) {
            console.warn('Initial nearby search during live alerts failed:', error);
        }

        await processLiveAlertPosition(lat, lng, { force: true });

        nearbyPOIState.liveAlertWatchId = navigator.geolocation.watchPosition(
            async (position) => {
                const nextLat = position.coords.latitude;
                const nextLng = position.coords.longitude;
                nearbyPOIState.activeLatLng = { lat: nextLat, lng: nextLng };

                try {
                    if (map && map._loaded) {
                        setCenterOverlays(nextLat, nextLng, { pending: false });
                    }
                } catch (_) {}

                await processLiveAlertPosition(nextLat, nextLng);
            },
            (error) => {
                let message = 'Canlı konum takibi durdu';
                if (error && error.code === error.PERMISSION_DENIED) {
                    message = 'Konum izni reddedildi, canlı uyarı durduruldu';
                    stopLiveAlerts();
                    setAlertStatus(message, 'error');
                    return;
                } else if (error && error.code === error.TIMEOUT) {
                    message = 'Konum güncellemesi zaman aşımına uğradı';
                    setAlertStatus(message, '');
                    return;
                }

                setAlertStatus(`${message}. Takip yeniden denenecek.`, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000,
            },
        );

        nearbyPOIState.liveAlertMode = 'web';
        updateAlertToggleButton();
        if (nativeStartError) {
            setAlertStatus(
                `Android arka plan takibi başlatılamadı (${nativeStartError.message || 'bilinmeyen hata'}). Uygulama açıkken canlı uyarı açık: ${getAlertCategorySummary()}.`,
                'success',
            );
            try {
                if (typeof showNotification === 'function') {
                    showNotification('Arka plan takibi başlatılamadı, uygulama açıkken canlı uyarı ile devam ediliyor.', 'warning');
                }
            } catch (_) {}
            return;
        }

        setAlertStatus(`Canlı uyarı açık. İzlenen türler: ${getAlertCategorySummary()}.`, 'success');
    };

    // (Results are rendered with the shared POI card UI; card buttons already call focusOnMap/showPOIDetail.)

    // Radius change: re-run search if we have an active location
    radiusSelect.addEventListener('change', async () => {
        const alertRadiusSync = canRunLiveAlerts ? syncAlertDistanceSelection() : { changed: false, effectiveMeters: 0 };
        persistSearchPreferences();
        try {
            if (nearbyPOIState.activeLatLng) {
                const { lat, lng } = nearbyPOIState.activeLatLng;
                setCenterOverlays(lat, lng, { pending: false });
                await runNearbySearch(lat, lng);
            }

            if (canRunLiveAlerts && alertRadiusSync.changed) {
                if (nearbyPOIState.liveAlertMode === 'native') {
                    await restartNativePoiTrackingService();
                } else if (nearbyPOIState.liveAlertWatchId != null && nearbyPOIState.activeLatLng) {
                    resetLiveAlertState();
                    const { lat, lng } = nearbyPOIState.activeLatLng;
                    await processLiveAlertPosition(lat, lng, { force: true });
                } else {
                    setAlertStatus(
                        `Arama mesafesi ${formatDistance(getRadiusMeters())} olduğu için uyarı eşiği ${formatDistance(alertRadiusSync.effectiveMeters)} olarak ayarlandı.`,
                        '',
                    );
                }
            }
        } catch (e) {
            setStatus(e.message || 'Mesafe güncellenemedi.', 'error');
        }
    });

    if (categorySelect) {
        categorySelect.addEventListener('change', async () => {
            persistSearchPreferences();
            try {
                if (nearbyPOIState.activeLatLng) {
                    const { lat, lng } = nearbyPOIState.activeLatLng;
                    await runNearbySearch(lat, lng);
                }
            } catch (error) {
                setStatus(error.message || 'Tür filtresi güncellenemedi.', 'error');
            }
        });
    }

    locateBtn.addEventListener('click', async () => {
        clearPickingMode();

        try {
            setStatus('Konumunuz alınıyor...', '');
            const location = await getCurrentLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
            const lat = location.latitude;
            const lng = location.longitude;
            nearbyPOIState.activeLatLng = { lat, lng };
            await ensureMapReadyAndVisible();
            setCenterOverlays(lat, lng, { pending: false });
            await runNearbySearch(lat, lng);
        } catch (e) {
            const help = e && e.helpText ? ` ${e.helpText}` : '';
            setStatus((e && e.message ? e.message : 'Konum alınamadı.') + help, 'error');
            try { if (typeof showNotification === 'function') showNotification('❌ Konum alınamadı', 'error'); } catch (_) {}
        }
    });

    pickBtn.addEventListener('click', async () => {
        try {
            await ensureMapReadyAndVisible();
        } catch (e) {
            setStatus(e.message || 'Harita hazır değil.', 'error');
            return;
        }

        if (nearbyPOIState.pickingMode) {
            clearPickingMode();
            setStatus('Haritadan seçim iptal edildi.', '');
            return;
        }

        nearbyPOIState.pickingMode = true;
        pickBtn.classList.add('active');
        pickBtn.innerHTML = '<i class="fas fa-times"></i> Seçimi İptal';
        setStatus('Haritaya tıklayın, sonra “Bu konumu kullan”a basın.', '');
        nearbyPOIState.pendingLatLng = null;
        useBtn.disabled = true;

        const handler = (ev) => {
            const latlng = ev?.latlng;
            if (!latlng) return;
            nearbyPOIState.pendingLatLng = { lat: latlng.lat, lng: latlng.lng };
            setCenterOverlays(latlng.lat, latlng.lng, { pending: true });
            useBtn.disabled = false;
            setStatus(`Seçilen konum: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}. “Bu konumu kullan” ile ara.`, '');
        };

        nearbyPOIState.mapClickHandler = handler;
        try { map.on('click', handler); } catch (_) {}
    });

    useBtn.addEventListener('click', async () => {
        if (!nearbyPOIState.pendingLatLng) return;
        const { lat, lng } = nearbyPOIState.pendingLatLng;
        clearPickingMode();

        // Move pending -> active
        nearbyPOIState.activeLatLng = { lat, lng };

        try {
            await ensureMapReadyAndVisible();
            setCenterOverlays(lat, lng, { pending: false });
            await runNearbySearch(lat, lng);
        } catch (e) {
            setStatus(e.message || 'Yakın POI araması başarısız.', 'error');
        }
    });

    if (canRunLiveAlerts) {
        const setAlertPreferencesPanelVisible = (visible) => {
            if (!alertPreferencesPanel || !alertPreferencesBtn) return;

            if (visible) {
                alertPreferencesPanel.removeAttribute('hidden');
                alertPreferencesBtn.innerHTML = '<i class="fas fa-times"></i> Tercihleri Gizle';
                return;
            }

            alertPreferencesPanel.setAttribute('hidden', 'hidden');
            alertPreferencesBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Uyarı Tercihleri';
        };

        if (alertPreferencesBtn) {
            alertPreferencesBtn.addEventListener('click', () => {
                const isVisible = alertPreferencesPanel && !alertPreferencesPanel.hasAttribute('hidden');
                setAlertPreferencesPanelVisible(!isVisible);
            });
        }

        if (alertAllCategoriesToggle) {
            alertAllCategoriesToggle.checked = nearbyPreferences.alertAllCategories;
            alertAllCategoriesToggle.addEventListener('change', async () => {
                nearbyPreferences.alertAllCategories = Boolean(alertAllCategoriesToggle.checked);
                try {
                    await applyAlertPreferenceChanges();
                } catch (error) {
                    setAlertStatus(error.message || 'Uyarı tercihleri güncellenemedi.', 'error');
                }
            });
        }

        if (alertPanoramaToggle) {
            alertPanoramaToggle.checked = isPanoramaAlertsEnabled();
            alertPanoramaToggle.addEventListener('change', async () => {
                nearbyPreferences.alertPanoramas = Boolean(alertPanoramaToggle.checked);
                try {
                    await applyAlertPreferenceChanges();
                } catch (error) {
                    setAlertStatus(error.message || 'Uyarı tercihleri güncellenemedi.', 'error');
                }
            });
        }

        if (alertCategoryListEl) {
            alertCategoryListEl.addEventListener('change', async (event) => {
                const input = event.target.closest('input[data-alert-category]');
                if (!input) return;

                nearbyPreferences.alertCategories = Array.from(
                    alertCategoryListEl.querySelectorAll('input[data-alert-category]:checked'),
                ).map((checkbox) => checkbox.value);

                try {
                    await applyAlertPreferenceChanges();
                } catch (error) {
                    setAlertStatus(error.message || 'Uyarı tercihleri güncellenemedi.', 'error');
                }
            });
        }

        if (alertSelectAllBtn) {
            alertSelectAllBtn.addEventListener('click', async () => {
                if (!alertCategoryListEl) return;
                alertCategoryListEl.querySelectorAll('input[data-alert-category]').forEach((input) => {
                    input.checked = true;
                });
                nearbyPreferences.alertCategories = Array.from(
                    alertCategoryListEl.querySelectorAll('input[data-alert-category]'),
                ).map((checkbox) => checkbox.value);

                try {
                    await applyAlertPreferenceChanges();
                } catch (error) {
                    setAlertStatus(error.message || 'Uyarı tercihleri güncellenemedi.', 'error');
                }
            });
        }

        if (alertClearBtn) {
            alertClearBtn.addEventListener('click', async () => {
                if (!alertCategoryListEl) return;
                alertCategoryListEl.querySelectorAll('input[data-alert-category]').forEach((input) => {
                    input.checked = false;
                });
                nearbyPreferences.alertCategories = [];

                try {
                    await applyAlertPreferenceChanges();
                } catch (error) {
                    setAlertStatus(error.message || 'Uyarı tercihleri güncellenemedi.', 'error');
                }
            });
        }

        if (alertResetMutedBtn) {
            const handleNearbyAlertMuteStateChanged = () => {
                syncMutedAlertResetButton();
                if (currentPOIData) {
                    try { updatePOIAlertMuteButton(currentPOIData); } catch (_) {}
                }
            };

            syncMutedAlertResetButton();
            window.addEventListener('nearby-alert-mutes-changed', handleNearbyAlertMuteStateChanged);

            alertResetMutedBtn.addEventListener('click', () => {
                const clearedCount = clearAllMutedPoiNotificationsForCurrentDevice();
                syncMutedAlertResetButton();
                if (!clearedCount) {
                    setAlertStatus('Susturulmuş canlı uyarı bulunmuyor.', '');
                    return;
                }

                setAlertStatus(
                    `${clearedCount} içerik için susturma kaldırıldı. Yeni girişte bildirimler tekrar gösterilecek.`,
                    'success',
                );
            });
        }

        alertDistanceSelect.addEventListener('change', async () => {
            const alertRadiusSync = syncAlertDistanceSelection();
            persistAlertPreferences();
            try {
                if (nearbyPOIState.liveAlertMode === 'native') {
                    await restartNativePoiTrackingService();
                    return;
                }

                if (!nearbyPOIState.liveAlertWatchId || !nearbyPOIState.activeLatLng) {
                    const message = alertRadiusSync.changed
                        ? `Uyarı eşiği arama mesafesini aşamayacağı için ${formatDistance(alertRadiusSync.effectiveMeters)} olarak ayarlandı.`
                        : `Uyarı eşiği ${formatDistance(getAlertRadiusMeters())} olarak ayarlandı.`;
                    setAlertStatus(message, '');
                    return;
                }

                resetLiveAlertState();
                const { lat, lng } = nearbyPOIState.activeLatLng;
                await processLiveAlertPosition(lat, lng, { force: true });
            } catch (error) {
                setAlertStatus(error.message || 'Uyarı eşiği güncellenemedi.', 'error');
            }
        });

        alertToggleBtn.addEventListener('click', async () => {
            if (nearbyPOIState.liveAlertMode === 'native' || nearbyPOIState.liveAlertWatchId != null) {
                const activeMode = nearbyPOIState.liveAlertMode;
                stopLiveAlerts();
                setAlertStatus(activeMode === 'native' ? 'Arka plan takibi kapatıldı.' : 'Canlı uyarı kapatıldı.', '');
                return;
            }

            try {
                await startLiveAlerts();
            } catch (error) {
                stopLiveAlerts();
                const help = error && error.helpText ? ` ${error.helpText}` : '';
                setAlertStatus((error && error.message ? error.message : 'Canlı uyarı başlatılamadı.') + help, 'error');
                try {
                    if (typeof showNotification === 'function') {
                        showNotification('Canlı uyarı başlatılamadı', 'error');
                    }
                } catch (_) {}
            }
        });

        alertFeedEl.addEventListener('click', async (event) => {
            const actionButton = event.target.closest('[data-nearby-alert-action]');
            if (!actionButton) return;

            const alertItemId = actionButton.getAttribute('data-alert-item-id') || '';
            const item = nearbyPOIState.liveAlertFeedById.get(alertItemId);
            if (!item) return;

            if (actionButton.getAttribute('data-nearby-alert-action') === 'map') {
                if (isPanoramaAlertItem(item)) {
                    await focusPanoramaOnMap(item);
                    return;
                }
                await focusPOIOnMap(item);
                return;
            }

            if (isPanoramaAlertItem(item)) {
                try {
                    await openPanoramaAlertItem(item);
                } catch (error) {
                    console.warn('Panorama viewer could not be opened from alert feed:', error);
                }
                return;
            }

            try {
                await showPOIDetail(String(item._id || item.id || item.poi_id || alertItemId));
            } catch (error) {
                console.warn('POI detail modal could not be opened from alert feed:', error);
            }
        });

        if (isNativePoiTrackingServiceRunning()) {
            nearbyPOIState.liveAlertMode = 'native';
            updateAlertToggleButton();
            setAlertStatus('Android foreground service aktif. Arka planda yakın içerik uyarıları sürüyor.', 'success');
        } else {
            updateAlertToggleButton();
            setAlertStatus('Canlı uyarı kapalı. Uyarı türlerini seçip başlatabilirsiniz.', '');
        }

        setAlertPreferencesPanelVisible(false);
    }

    populateCategoryOptions().catch((error) => {
        console.warn('Nearby category filter initialization failed:', error);
    });

    const handleLiveAlertVisibilityChange = async () => {
        if (document.hidden) {
            if (shouldPauseWebLiveAlertsWhenHidden()) {
                pauseWebLiveAlertsForVisibility();
            }
            return;
        }

        await resumeWebLiveAlertsAfterVisibility();
    };

    document.addEventListener('visibilitychange', () => {
        void handleLiveAlertVisibilityChange();
    });

    window.addEventListener('pagehide', () => {
        if (document.hidden && shouldPauseWebLiveAlertsWhenHidden()) {
            pauseWebLiveAlertsForVisibility();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (nearbyPOIState.liveAlertMode === 'native') {
            nearbyPOIState.liveAlertMode = null;
            nearbyPOIState.liveAlertWatchId = null;
            nearbyPOIState.liveAlertVisibilityPaused = false;
            nearbyPOIState.liveAlertAutoResumeRequested = false;
            return;
        }

        stopLiveAlerts();
    });

    // Initial hint
    setStatus('Başlamak için “Konumumu Bul” veya “Haritadan Seç”.', '');
}

function escapeHtml(value) {
    const s = String(value ?? '');
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Enhanced Filter System
function initializeEnhancedFilters() {
    // Log removed for cleaner console
    
    // Filter toggle functionality
    const openFiltersBtn = document.getElementById('openFiltersBtn');
    const filtersToggleBtn = document.getElementById('filtersToggleBtn');
    const filtersContent = document.getElementById('filtersContent');

    if (openFiltersBtn && filtersContent) {
        openFiltersBtn.addEventListener('click', () => {
            filtersContent.classList.add('expanded');
            openFiltersBtn.style.display = 'none';
        });
    }

    if (filtersToggleBtn && filtersContent) {
        filtersToggleBtn.addEventListener('click', () => {
            filtersContent.classList.remove('expanded');
            if (openFiltersBtn) {
                openFiltersBtn.style.display = '';
            }
        });
    }
    
    // Filter chip functionality
    initializeFilterChips();
    
    // Filter action buttons
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyRouteFilters);
    }

    // Update route counts
    updateRouteStats();

    // Initialize route search
    setupRouteSearch();
}

function initializeFilterChips() {
    // Debounced auto-apply so that switching chips quickly doesn't thrash the list
    let _chipApplyTimer = null;
    const scheduleAutoApply = () => {
        if (_chipApplyTimer) clearTimeout(_chipApplyTimer);
        _chipApplyTimer = setTimeout(() => {
            _chipApplyTimer = null;
            if (typeof applyRouteFilters === 'function') applyRouteFilters();
        }, 180);
    };

    const wireChipGroup = (selector) => {
        const chips = document.querySelectorAll(selector + ' .filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                // Auto-apply on every device (desktop + mobile) for instant feedback.
                scheduleAutoApply();
            });
        });
    };

    wireChipGroup('#routeTypeChips');
    wireChipGroup('#difficultyChips');
    wireChipGroup('#durationChips');
    wireChipGroup('#favoriteChips');
}

function clearAllFilters() {
    // Log removed for cleaner console
    
    // Reset all filter chips to default (first chip active)
    const chipGroups = ['#routeTypeChips', '#difficultyChips', '#durationChips', '#favoriteChips'];
    
    chipGroups.forEach(groupSelector => {
        const chips = document.querySelectorAll(`${groupSelector} .filter-chip`);
        chips.forEach((chip, index) => {
            if (index === 0) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    });
    
    // Apply filters to show all routes
    applyRouteFilters();
}

function getActiveFilterValues() {
    const routeTypeChip = document.querySelector('#routeTypeChips .filter-chip.active');
    const difficultyChip = document.querySelector('#difficultyChips .filter-chip.active');
    const durationChip = document.querySelector('#durationChips .filter-chip.active');
    const favoriteChip = document.querySelector('#favoriteChips .filter-chip.active');

    return {
        routeType: routeTypeChip ? routeTypeChip.dataset.value : '',
        difficulty: difficultyChip ? difficultyChip.dataset.value : '',
        duration: durationChip ? durationChip.dataset.value : '',
        favorites: favoriteChip ? favoriteChip.dataset.value : ''
    };
}

function updateRouteStats() {
    const totalRoutesCount = document.getElementById('totalRoutesCount');
    const filteredRoutesCount = document.getElementById('filteredRoutesCount');
    
    if (totalRoutesCount) {
        totalRoutesCount.textContent = predefinedRoutes.length;
    }
    
    if (filteredRoutesCount) {
        filteredRoutesCount.textContent = filteredRoutes.length;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Log removed for cleaner console
    initializeApp();

    // Toggle map visibility on mobile
    if (window.innerWidth < 992) {
        const mapView = document.getElementById('mapView');
        const container = document.querySelector('.routes-map-container');

        if (mapView && container) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'toggleMapBtn';
            toggleBtn.className = 'btn btn-outline-primary w-100 mb-3';
            toggleBtn.textContent = 'Haritayı Göster';
            container.insertBefore(toggleBtn, mapView);

            toggleBtn.addEventListener('click', () => {
                const isHidden = mapView.style.display === 'none' || getComputedStyle(mapView).display === 'none';
                if (isHidden) {
                    mapView.style.display = 'block';
                    toggleBtn.textContent = 'Haritayı Gizle';
                    if (typeof predefinedMap !== 'undefined' && predefinedMap) {
                        predefinedMap.invalidateSize();
                    }
                } else {
                    mapView.style.display = 'none';
                    toggleBtn.textContent = 'Haritayı Göster';
                }
            });
        }
    }
    
    // Dynamic map fullscreen (mobile FAB)
    (function setupDynamicMapFullscreen() {
        const btn = document.getElementById('dynamicMapFullscreenBtn');
        const container = document.getElementById('mapContainer');
        const exploreBottomSection = document.querySelector('.explore-bottom-section');
        if (!btn || !container) return;

        let prevScrollY = 0;
        let previousRouteSectionDisplay = '';
        let previousExploreSectionDisplay = '';
        const routeSection = document.getElementById('routeSection');
        const escHandler = (e) => {
            if (e.key === 'Escape' && container.classList.contains('fullscreen')) toggle(false);
        };

        function toggle(force) {
            const entering = force !== undefined ? force : !container.classList.contains('fullscreen');
            const isMobile = window.innerWidth <= 768;

            if (entering) {
                prevScrollY = window.scrollY || window.pageYOffset || 0;

                // Mobile-specific optimizations
                if (isMobile) {
                    // Use more aggressive overflow hiding for mobile
                    document.body.style.overflow = 'hidden';
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    document.body.style.top = `-${prevScrollY}px`;

                    // Add viewport meta tag update for mobile
                    const viewport = document.querySelector('meta[name="viewport"]');
                    if (viewport) {
                        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                    }
                } else {
                    document.body.style.overflow = 'hidden';
                }

                container.classList.add('fullscreen');
                document.body.classList.add('personal-routes-map-fullscreen');
                if (exploreBottomSection) {
                    previousExploreSectionDisplay = exploreBottomSection.style.display;
                    exploreBottomSection.style.display = 'none';
                    exploreBottomSection.setAttribute('aria-hidden', 'true');
                }

                // Hide route planner section to avoid overlaying text
                if (routeSection) {
                    previousRouteSectionDisplay = routeSection.style.display;
                    routeSection.style.display = 'none';
                }

                // Hide POI search bar if visible
                const poiSearchBar = document.getElementById('poiSearchBar');
                if (poiSearchBar) {
                    poiSearchBar.style.display = 'none';
                }

                // Create fullscreen exit button for mobile
                if (isMobile) {
                    const exitBtn = document.createElement('button');
                    exitBtn.id = 'fullscreenExitBtn';
                    exitBtn.innerHTML = '<i class="fas fa-times"></i>';
                    exitBtn.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 10000;
                        background: rgba(0, 0, 0, 0.7);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        font-size: 18px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                        transition: all 0.2s ease;
                    `;
                    exitBtn.title = 'Tam Ekrandan Çık';
                    exitBtn.addEventListener('click', () => toggle(false));
                    document.body.appendChild(exitBtn);
                }

                // Resize Leaflet map after layout change with multiple attempts
                const invalidateMap = () => {
                    if (typeof map !== 'undefined' && map) {
                        map.invalidateSize();
                    } else if (typeof dynamicMap !== 'undefined' && dynamicMap) {
                        dynamicMap.invalidateSize();
                    }
                };

                setTimeout(invalidateMap, 50);
                setTimeout(invalidateMap, 150);
                setTimeout(invalidateMap, 300);
                setTimeout(invalidateMap, 500);

                const icon = btn.querySelector('i');
                if (icon && icon.classList.contains('fa-expand')) {
                    icon.classList.remove('fa-expand');
                    icon.classList.add('fa-compress');
                }
                document.addEventListener('keydown', escHandler);

                // Add haptic feedback for mobile
                if (isMobile && navigator.vibrate) {
                    navigator.vibrate(50);
                }

            } else {
                // Exit fullscreen
                container.classList.remove('fullscreen');
                document.body.classList.remove('personal-routes-map-fullscreen');
                if (exploreBottomSection) {
                    exploreBottomSection.style.display = previousExploreSectionDisplay || '';
                    exploreBottomSection.removeAttribute('aria-hidden');
                }

                // Mobile-specific cleanup
                if (isMobile) {
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    document.body.style.top = '';

                    // Restore viewport meta tag
                    const viewport = document.querySelector('meta[name="viewport"]');
                    if (viewport) {
                        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
                    }
                } else {
                    document.body.style.overflow = '';
                }

                // Restore route planner section
                if (routeSection) {
                    routeSection.style.display = previousRouteSectionDisplay || '';
                }

                // Restore POI search bar
                const poiSearchBar = document.getElementById('poiSearchBar');
                if (poiSearchBar) {
                    poiSearchBar.style.display = '';
                }

                // Remove fullscreen exit button
                const exitBtn = document.getElementById('fullscreenExitBtn');
                if (exitBtn) {
                    exitBtn.remove();
                }

                // Resize map back to normal
                setTimeout(() => {
                    if (typeof map !== 'undefined' && map) {
                        map.invalidateSize();
                    } else if (typeof dynamicMap !== 'undefined' && dynamicMap) {
                        dynamicMap.invalidateSize();
                    }
                }, 50);

                const icon = btn.querySelector('i');
                if (icon && icon.classList.contains('fa-compress')) {
                    icon.classList.remove('fa-compress');
                    icon.classList.add('fa-expand');
                }
                document.removeEventListener('keydown', escHandler);
                if (prevScrollY) window.scrollTo({ top: prevScrollY, behavior: 'auto' });
            }
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });

        window.addEventListener('resize', () => {
            if (container.classList.contains('fullscreen') && typeof map !== 'undefined' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    })();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    // Log removed for cleaner console
} else {
    // DOM is already loaded
    // Log removed for cleaner console
    initializeApp();
}

// Show All POIs function - displays all POIs regardless of preferences
async function showAllPOIs() {
    // Log removed for cleaner console

    const button = document.getElementById('showAllBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('recommendationResults');

    // Show enhanced loading state
    button.disabled = true;
    button.classList.add('btn--loading');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tüm POI\'ler Yükleniyor...';
    resultsSection.style.display = 'block';

    // Show skeleton loading
    if (window.loadingManager && typeof window.loadingManager.showPOISkeletons === 'function') {
        try {
            window.loadingManager.showPOISkeletons('recommendationResults', 8);
        } catch (error) {
            console.warn('Loading manager error, using fallback:', error);
            showFallbackLoading();
        }
    } else {
        showFallbackLoading();
    }

    function showFallbackLoading() {
        const skeletonHTML = Array(6).fill(0).map(() => `
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
                    </div>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = `
            <div class="poi-grid">
                ${skeletonHTML}
            </div>
        `;
    }

    try {
        // Log removed for cleaner console
        
        if (!window.POIClient) {
            throw new Error('POIClient module is not available');
        }

        const poisData = await window.POIClient.getAllPOIs({ normalize: true, refresh: true });

        const allPOIs = (Array.isArray(poisData) ? poisData : []).map(poi => ({
            ...poi,
            category: poi.category || (Array.isArray(poi.categories) ? poi.categories[0] : poi.primary_category) || 'diger',
            recommendationScore: typeof poi.recommendationScore === 'number' ? poi.recommendationScore : 75
        }));

        // Log removed for cleaner console

        // Debug: Log all unique categories
        const uniqueCategories = [...new Set(allPOIs.map(poi => poi.category).filter(Boolean))];
        // Log removed for cleaner console

        if (allPOIs.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <h3>Henüz POI Bulunamadı</h3>
                    <p>Sistemde kayıtlı POI bulunmuyor. Lütfen daha sonra tekrar deneyin.</p>
                </div>
            `;
            return;
        }

        // Sort POIs by name for better organization
        allPOIs.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        // Display all POIs
        await displayAllPOIs(allPOIs);

        // Ensure map is initialized and visible, then update with POIs
        await initializeMainMap();
        updateMapWithPOIs(allPOIs);

        // Switch UI to map view and focus it
        switchToDynamicMapView();
        ensurePOISearchBar(allPOIs);

        // Show success notification
        showNotification(`🌍 ${allPOIs.length} POI haritada gösteriliyor`, 'success');

    } catch (error) {
        console.error('❌ Error fetching all POIs:', error);
        
        resultsContainer.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Hata Oluştu</h3>
                <p>POI'ler yüklenirken bir hata oluştu: ${error.message}</p>
                <button class="retry-btn" onclick="showAllPOIs()">
                    <i class="fas fa-redo"></i> Tekrar Dene
                </button>
            </div>
        `;
        
        showNotification('POI\'ler yüklenirken hata oluştu', 'error');
    } finally {
        // Reset button state
        button.disabled = false;
        button.classList.remove('btn--loading');
        button.innerHTML = '<i class="fas fa-globe btn-icon"></i><span class="btn-text">Tüm POI\'leri Göster</span>';
        
        // Log removed for cleaner console
    }
}

// Display all POIs in the results container
async function displayAllPOIs(allPOIs) {
    // Log removed for cleaner console
    
    const resultsContainer = document.getElementById('recommendationResults');
    
    // Group POIs by category (canonicalized) to avoid duplicate headers for aliases
    const poiByCategory = {};
    allPOIs.forEach(poi => {
        const raw = (poi.category || 'diger').toLowerCase().trim();
        let canonical = raw;
        try {
            if (typeof window !== 'undefined' && window.getCategoryByName) {
                const cat = window.getCategoryByName(raw);
                if (cat && cat.name) canonical = cat.name; // canonical category key
            } else if (typeof categoryIconAliases !== 'undefined' && categoryIconAliases[raw]) {
                canonical = categoryIconAliases[raw];
            }
        } catch (_) {}

        if (!poiByCategory[canonical]) {
            poiByCategory[canonical] = [];
        }
        // Keep original POI but normalize category for display consistency
        poiByCategory[canonical].push({ ...poi, category: canonical });
    });

    let resultsHTML = `
        <div class="all-pois-header">
            <h2 class="results-title">
                <i class="fas fa-globe"></i>
                Tüm POI'ler (${allPOIs.length})
            </h2>
            <p class="results-subtitle">
                Sistemdeki tüm ilgi noktaları kategorilere göre gruplandırılmış şekilde gösteriliyor.
            </p>
        </div>
    `;

    // Display POIs grouped by category
    for (const [category, pois] of Object.entries(poiByCategory)) {
        const categoryDisplayName = getCategoryDisplayName(category);
        const categoryStyle = getCategoryStyle(category);
        
        resultsHTML += `
            <div class="category-section">
                <div class="category-header">
                    <div class="category-info">
                        <i class="${categoryStyle.iconClass}" style="color: ${categoryStyle.color}"></i>
                        <h3>${categoryDisplayName}</h3>
                        <span class="category-count">${pois.length} POI</span>
                    </div>
                </div>
                <div class="poi-grid">
        `;

        // Display POIs in this category
        const poiCardsHTML = createPOICards(pois);
        resultsHTML += poiCardsHTML;

        resultsHTML += `
                </div>
            </div>
        `;
    }

    resultsContainer.innerHTML = resultsHTML;
    
    // Initialize any interactive elements (load media for POI cards)
    initializePOICardsMedia();
    
    // Log removed for cleaner console
}

// Update map with all POIs
function updateMapWithPOIs(allPOIs) {
    if (!window.MapControllerImpl) {
        console.error('MapControllerImpl module is not available');
        return;
    }

    window.MapControllerImpl.updateMapWithPOIsImpl(mapState, {
        L,
        createCustomIcon,
        getCategoryDisplayName,
        showPOIDetail,
        openInGoogleMaps,
        addToRoute,
    }, allPOIs);

    map = mapState.map;
    markers = mapState.markers;
    poiCluster = mapState.poiCluster;
}

// Ensure the dynamic map section is visible and focused
function switchToDynamicMapView() {
    if (!window.MapControllerImpl) {
        console.error('MapControllerImpl module is not available');
        return;
    }

    window.MapControllerImpl.switchToDynamicMapViewImpl(mapState, { addTimeout });
}

// Create a simple search UI to filter POI markers on the map
function ensurePOISearchBar(allPOIs = []) {
    // Check if mobile device
    const isMobile = window.innerWidth <= 768;

    let container;
    if (isMobile) {
        // On mobile, place search bar outside map container to avoid overlap
        container = document.getElementById('mapSection');
        if (!container) return;
    } else {
        // On desktop, place inside map container
        container = document.getElementById('mapContainer');
        if (!container) return;

        // Ensure container is positioned for overlay
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
    }

    // If exists, just show
    let bar = document.getElementById('poiSearchBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'poiSearchBar';

        if (isMobile) {
            // Mobile: Place above map section
            bar.style.cssText = `
                position: relative; margin-bottom: 10px; z-index: 100;
                background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0; border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;
                padding: 8px 10px; backdrop-filter: blur(6px); width: 100%; max-width: 100%;
            `;
        } else {
            // Desktop: Place inside map as overlay
            bar.style.cssText = `
                position: absolute; top: 12px; left: 12px; right: auto; z-index: 9999;
                background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0; border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;
                padding: 8px 10px; backdrop-filter: blur(6px);
            `;
        }

        bar.innerHTML = `
            <i class="fas fa-search" style="color:#64748b"></i>
            <input id="poiSearchInput" type="text" placeholder="POI ara..." style="
                border:none; outline:none; background:transparent; width: 200px; max-width: 60vw; color:#111827; font-size: 14px;" />
            <button id="poiSearchClear" title="Temizle" style="
                border:none; background:#f1f5f9; color:#334155; border-radius:8px; padding:4px 8px; cursor:pointer;">Temizle</button>
        `;
        container.appendChild(bar);

        const input = bar.querySelector('#poiSearchInput');
        const clearBtn = bar.querySelector('#poiSearchClear');
        const handler = () => filterPOIMarkers(input.value || '');
        input.addEventListener('input', handler);
        clearBtn.addEventListener('click', () => { input.value = ''; handler(); });

        // Mobile-friendly sizing
        const applyResponsiveSearchBar = () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                // Mobile: Already configured for full width above map
                input.style.width = '100%';
                input.style.maxWidth = '100%';
            } else {
                // Desktop: Overlay mode
                input.style.width = '240px';
                input.style.maxWidth = '60vw';
            }
        };
        applyResponsiveSearchBar();
        window.addEventListener('resize', applyResponsiveSearchBar);
    } else {
        bar.style.display = 'flex';
        // Ensure visibility and responsive layout on re-show
        const input = bar.querySelector('#poiSearchInput');
        if (input) {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                // Mobile: Ensure it's positioned correctly above map
                bar.style.position = 'relative';
                bar.style.marginBottom = '10px';
                bar.style.zIndex = '100';
                bar.style.width = '100%';
                bar.style.maxWidth = '100%';
                input.style.width = '100%';
                input.style.maxWidth = '100%';
            } else {
                // Desktop: Overlay mode
                bar.style.position = 'absolute';
                bar.style.top = '12px';
                bar.style.left = '12px';
                bar.style.right = 'auto';
                bar.style.zIndex = '9999';
                input.style.width = '240px';
                input.style.maxWidth = '60vw';
            }
        }
    }

    // Register hotkey: '/' focuses the POI search when map section is visible
    if (!window.__poiSearchHotkeyAdded) {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const mapSection = document.getElementById('mapSection');
                const input = document.getElementById('poiSearchInput');
                if (mapSection && input && mapSection.offsetParent !== null) {
                    e.preventDefault();
                    input.focus();
                }
            }
        });
        window.__poiSearchHotkeyAdded = true;
    }
}

// Filter current markers by query (name/category/tags)
function filterPOIMarkers(query) {
    const q = (query || '').trim().toLowerCase();
    if (!markers || !Array.isArray(markers)) return;

    console.warn(`🔍 Harita arama: "${q}"`);

    markers.forEach(marker => {
        try {
            const name = marker.poiNameLower || '';
            const cat = (marker.poiCategory || '').toLowerCase();
            const tags = marker.poiTags || '';
            const match = !q || name.includes(q) || cat.includes(q) || tags.includes(q);

            // Debug: Arama eşleşmelerini göster
            if (q && match) {
                console.warn(`✅ POI eşleşti: "${marker.poiName}" - Tags: "${tags}" - Query: "${q}"`);
            }
            const inCluster = poiCluster && poiCluster.hasLayer && poiCluster.hasLayer(marker);
            if (match && !inCluster) {
                poiCluster ? poiCluster.addLayer(marker) : marker.addTo(map);
            } else if (!match && inCluster) {
                poiCluster ? poiCluster.removeLayer(marker) : map.removeLayer(marker);
            }
        } catch (e) { /* ignore per-marker errors */ }
    });

    // Optionally refit bounds if query narrowed results
    const visible = poiCluster && poiCluster.getLayers ? poiCluster.getLayers() : markers.filter(m => map.hasLayer(m));
    if (visible.length > 0) {
        try {
            if (poiCluster && poiCluster.getLayers) {
                map.fitBounds(poiCluster.getBounds().pad(0.1));
            } else {
                const group = new L.featureGroup(visible);
                map.fitBounds(group.getBounds().pad(0.1));
            }
        } catch (_) {}
    }
}

// Initialize POI cards media loading
function initializePOICardsMedia() {
    // Log removed for cleaner console
    
    const poiCards = document.querySelectorAll('.poi-card[data-poi-id]');
    // Log removed for cleaner console
    
    poiCards.forEach((card, index) => {
        const poiId = card.dataset.poiId;
        if (!poiId) return;

        // Ensure we always show a decent cover even if there is no image media
        try { applyPOICardFallbackCover(card); } catch (_) {}
        
        // Make card clickable to open detail modal
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            // Prevent triggering if clicking on action buttons
            if (e.target.closest('.poi-card__actions')) return;
            
            showPOIDetail(poiId);
        };
        
        // Load media for this POI card with a small delay to prevent overwhelming the server
        setTimeout(() => {
            loadPOICardMedia(poiId, card);
        }, index * 100); // Stagger requests by 100ms
    });
}

// Load media for a specific POI card
async function loadPOICardMedia(poiId, cardElement) {
    try {
        const mediaPreview = cardElement.querySelector('.poi-media-preview');
        if (!mediaPreview) return;
        
        // Check if media is already cached
        if (mediaCache[poiId]) {
            try { applyPOICardMainImage(mediaCache[poiId], cardElement); } catch (_) {}
            displayPOICardMedia(mediaCache[poiId], mediaPreview);
            return;
        }
        
        // Fetch media from API
        const response = await fetch(`${apiBase}/poi/${poiId}/media`);
        if (!response.ok) {
            // Log removed for cleaner console
            return;
        }
        
        const mediaData = await response.json();
        const mediaItems = Array.isArray(mediaData) ? mediaData : (mediaData.media || []);
        
        if (mediaItems.length > 0) {
            // Cache the media
            mediaCache[poiId] = mediaItems;
            try { applyPOICardMainImage(mediaItems, cardElement); } catch (_) {}
            displayPOICardMedia(mediaItems, mediaPreview);
        } else {
            // No media: keep fallback cover
            try { applyPOICardFallbackCover(cardElement); } catch (_) {}
        }
        
    } catch (error) {
        // Log removed for cleaner console
        // Don't show error to user, just skip media loading
    }
}

// Display media in POI card preview
function displayPOICardMedia(mediaItems, previewElement) {
    if (!mediaItems || mediaItems.length === 0) return;
    
    // Show first image if available
    const firstImage = mediaItems.find(item => 
        item.type === 'image' || 
        (item.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.filename))
    );
    
    if (firstImage) {
        const imagePath = firstImage.thumbnail_path || firstImage.path;
        const finalImagePath = normalizeMediaPath(imagePath);
        previewElement.innerHTML = `
            <div class="poi-card-media-thumb">
                <img src="${finalImagePath}" alt="POI Preview" loading="lazy" 
                     style="width: 100%; height: 60px; object-fit: cover; border-radius: 6px;">
                ${mediaItems.length > 1 ? `<span class="media-count">+${mediaItems.length - 1}</span>` : ''}
            </div>
        `;
    } else {
        // Show media count if no images
        previewElement.innerHTML = `
            <div class="poi-card-media-info">
                <i class="fas fa-photo-video"></i>
                <span>${mediaItems.length} medya</span>
            </div>
        `;
    }
}

// Apply first image as the main card image (fills the big image area)
function applyPOICardMainImage(mediaItems, cardElement) {
    if (!cardElement) return;
    const imageContainer = cardElement.querySelector('.poi-card__image-container');
    if (!imageContainer) return;

    // Don't duplicate if an image is already applied
    if (imageContainer.querySelector('img.poi-card__image')) return;

    const placeholder = imageContainer.querySelector('.poi-card__image-placeholder');
    const firstImage = (mediaItems || []).find(item =>
        item.type === 'image' ||
        (item.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.filename))
    );
    if (!firstImage) {
        try { applyPOICardFallbackCover(cardElement); } catch (_) {}
        return;
    }

    const imagePath = firstImage.path || firstImage.preview_path || firstImage.thumbnail_path || firstImage.filename || '';
    const finalImagePath = normalizeMediaPath(imagePath);
    if (!finalImagePath) return;

    const img = document.createElement('img');
    img.className = 'poi-card__image lazy-image';
    img.alt = (cardElement.querySelector('.poi-card__title')?.textContent || 'POI');
    img.loading = 'lazy';
    img.decoding = 'async';
    // Use dataset for existing lazy loader infra (if present)
    img.dataset.src = finalImagePath;
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';

    imageContainer.insertBefore(img, placeholder || imageContainer.firstChild);
    if (placeholder) placeholder.style.display = 'none';

    try { if (typeof attachEXIFOrientationFix === 'function') attachEXIFOrientationFix(img); } catch (_) {}
    try {
        if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
            window.lazyLoader.setupImageLazyLoading();
        } else {
            // Fallback: if no lazy loader, set src directly
            img.src = finalImagePath;
        }
    } catch (_) {
        img.src = finalImagePath;
    }
}

function applyPOICardFallbackCover(cardElement) {
    if (!cardElement) return;
    const imageContainer = cardElement.querySelector('.poi-card__image-container');
    if (!imageContainer) return;

    // If a real image exists, do nothing
    if (imageContainer.querySelector('img.poi-card__image')) return;

    const placeholder = imageContainer.querySelector('.poi-card__image-placeholder');
    if (!placeholder) return;
    if (placeholder.dataset && placeholder.dataset.coverApplied === '1') return;

    const categoryKey = (cardElement.dataset && cardElement.dataset.poiCategory) ? cardElement.dataset.poiCategory : 'diger';
    let categoryStyle = { color: '#64748b', iconClass: 'fas fa-map-marker-alt' };
    try {
        if (typeof getCategoryStyle === 'function') {
            categoryStyle = getCategoryStyle(categoryKey) || categoryStyle;
        }
    } catch (_) {}

    const categoryLabel = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(categoryKey) : 'POI';

    placeholder.classList.remove('loading__skeleton');
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.flexDirection = 'column';
    placeholder.style.gap = '8px';
    placeholder.style.background = `linear-gradient(135deg, ${categoryStyle.color}33 0%, rgba(255,255,255,0.0) 100%)`;
    placeholder.style.color = '#0f172a';

    placeholder.innerHTML = `
        <div style="
            width: 54px; height: 54px; border-radius: 16px;
            display:flex; align-items:center; justify-content:center;
            background: ${categoryStyle.color};
            color: white;
            box-shadow: 0 10px 26px rgba(0,0,0,0.18);
        ">
            <i class="${categoryStyle.iconClass}" style="font-size: 20px;"></i>
        </div>
        <div style="font-weight: 800; font-size: 12px; opacity: 0.95; text-align:center; padding: 0 10px;">
            ${escapeHtml(categoryLabel)}
        </div>
    `;

    placeholder.dataset.coverApplied = '1';
}

// POI Detail Modal System
let currentPOIData = null;
// Note: currentMediaItems and currentMediaIndex are already declared above

function getCurrentPOIAlertIdentifier(poi = currentPOIData) {
    return normalizeNearbyAlertPoiId(poi?._id || poi?.id || poi?.poi_id || '');
}

function updatePOIAlertMuteButton(poi = currentPOIData) {
    const toggleBtn = document.getElementById('togglePoiAlertMuteBtn');
    const helpText = document.getElementById('poiAlertMuteHelp');
    if (!toggleBtn || !helpText) return;

    const poiId = getCurrentPOIAlertIdentifier(poi);
    if (!poiId) {
        toggleBtn.style.display = 'none';
        helpText.textContent = '';
        return;
    }

    const isMuted = isPoiNotificationMutedForCurrentDevice(poiId);
    toggleBtn.style.display = '';
    toggleBtn.dataset.poiId = poiId;
    toggleBtn.dataset.muted = isMuted ? 'true' : 'false';

    if (isMuted) {
        toggleBtn.className = 'btn btn-outline-secondary btn-sm w-100 mt-2';
        toggleBtn.innerHTML = '<i class="fas fa-bell me-2"></i> Bu POI İçin Bildirimleri Aç';
        helpText.textContent = 'Bu cihazda bu POI için bildirimler kapalı. İsterseniz tekrar açabilirsiniz.';
        return;
    }

    toggleBtn.className = 'btn btn-outline-danger btn-sm w-100 mt-2';
    toggleBtn.innerHTML = '<i class="fas fa-bell-slash me-2"></i> Bu POI İçin Bildirim Gönderme';
    helpText.textContent = 'Bu ayar sadece sizin cihazınız için geçerlidir. Gösterilen bildirimler de en az 6 saat tekrar etmez.';
}

window.updatePOIAlertMuteButton = updatePOIAlertMuteButton;

// Wait for Bootstrap to be loaded
function waitForBootstrap() {
    return new Promise((resolve) => {
        if (typeof bootstrap !== 'undefined') {
            resolve();
            return;
        }
        
        // Check every 100ms for Bootstrap
        const checkBootstrap = setInterval(() => {
            if (typeof bootstrap !== 'undefined') {
                clearInterval(checkBootstrap);
                resolve();
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkBootstrap);
            console.warn('Bootstrap not loaded after 5 seconds, proceeding anyway');
            resolve();
        }, 5000);
    });
}

// Ensure POI modal exists
function ensurePOIModalExists() {
    let modalElement = document.getElementById('poiDetailModal');
    
    if (!modalElement) {
        console.error('❌ POI modal not found in DOM! Modal should be in HTML.');
        return null;
    }
    
    // Log removed for cleaner console
    return modalElement;
}

// Show POI detail modal
async function showPOIDetail(poiId, poiData = null) {
    // Log removed for cleaner console
    
    // Wait for Bootstrap to be loaded
    await waitForBootstrap();
    
    try {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Ensure modal exists and get reference
        const modalElement = ensurePOIModalExists();
        if (!modalElement) {
            console.error('❌ Failed to create or find modal element');
            throw new Error('POI detail modal element could not be created');
        }
        
        // Log removed for cleaner console
        
        // Try Bootstrap 5 first, then fallback to manual show
        let modal;
        try {
            // Log removed for cleaner console
            modal = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            modal.show();
            // Log removed for cleaner console
        } catch (bootstrapError) {
            console.warn('Bootstrap Modal failed, using fallback:', bootstrapError);
            // Fallback: manually show modal
            modalElement.classList.add('show');
            modalElement.style.display = 'block';
            modalElement.style.zIndex = '10100';
            modalElement.setAttribute('aria-modal', 'true');
            modalElement.removeAttribute('aria-hidden');
            
            // Add backdrop
            let backdrop = document.getElementById('poiModalBackdrop');
            if (backdrop) {
                backdrop.remove();
            }
            backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'poiModalBackdrop';
            backdrop.style.zIndex = '10099';
            document.body.appendChild(backdrop);
            
            // Prevent body scroll
            document.body.classList.add('modal-open');
            // Log removed for cleaner console
        }
        
        // Hide mobile filter panel if open
        const mobileFilterPanel = document.getElementById('mobileFilterPanel');
        if (mobileFilterPanel && mobileFilterPanel.classList.contains('active')) {
            // Log removed for cleaner console
            mobileFilterPanel.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Hide any other high z-index elements that might interfere
        const highZIndexElements = document.querySelectorAll('[style*="z-index: 10000"], [style*="z-index:10000"]');
        highZIndexElements.forEach(element => {
            if (element.id !== 'poiDetailModal' && element.id !== 'poiModalBackdrop') {
                // Log removed for cleaner console
                element.style.zIndex = '999';
            }
        });
        
        // Force modal visibility
        setTimeout(() => {
            const modalCheck = document.getElementById('poiDetailModal');
            if (modalCheck) {
                console.warn('🔍 Modal visibility check:', {
                    display: modalCheck.style.display,
                    visibility: modalCheck.style.visibility,
                    zIndex: modalCheck.style.zIndex,
                    classList: modalCheck.classList.toString(),
                    offsetHeight: modalCheck.offsetHeight,
                    offsetWidth: modalCheck.offsetWidth
                });
                
                // Force show if hidden
                if (modalCheck.style.display === 'none' || !modalCheck.classList.contains('show')) {
                    // Log removed for cleaner console
                    modalCheck.style.display = 'block';
                    modalCheck.style.zIndex = '10100';
                    modalCheck.classList.add('show');
                }
            }
        }, 100);
        
        // Set loading state
        document.getElementById('poiDetailModalLabel').textContent = 'Yükleniyor...';
        document.getElementById('mediaGalleryMain').innerHTML = `
            <div class="media-loading">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Yükleniyor...</span>
                </div>
            </div>
        `;
        
        // Fetch POI data if not provided
        let poi = poiData;
        if (!poi) {
            // Log removed for cleaner console
            const response = await fetch(`${apiBase}/poi/${poiId}`);
            if (!response.ok) {
                console.error('❌ POI API response not OK:', response.status, response.statusText);
                throw new Error('POI bulunamadı');
            }
            poi = await response.json();
            // Log removed for cleaner console
        }
        
        currentPOIData = poi;
        
        // Update modal content
        updatePOIModalContent(poi);
        
        // Load media
        await loadPOIModalMedia(poiId);
        
        // Setup event listeners
        setupPOIModalEventListeners();
        
        // Log removed for cleaner console
        
    } catch (error) {
        console.error('❌ Error loading POI detail:', error);
        showPOIModalError('POI detayları yüklenirken hata oluştu: ' + error.message);
    }
}

// Update POI modal content
function updatePOIModalContent(poi) {
    // Update title and category
    document.getElementById('poiDetailModalLabel').textContent = poi.name;
    
    const categoryBadge = document.getElementById('poiModalCategory');
    const categoryDisplayName = getCategoryDisplayName(poi.category);
    const categoryStyle = getCategoryStyle(poi.category);
    
    categoryBadge.innerHTML = `
        <i class="${categoryStyle.iconClass}" style="color: ${categoryStyle.color}; margin-right: 6px;"></i>
        ${categoryDisplayName}
    `;
    categoryBadge.style.background = `linear-gradient(135deg, ${categoryStyle.color}20, ${categoryStyle.color}40)`;
    categoryBadge.style.color = categoryStyle.color;
    categoryBadge.style.border = `1px solid ${categoryStyle.color}40`;
    
    // Update description
    const descriptionContent = document.getElementById('poiDescriptionContent');
    if (poi.description && poi.description.trim()) {
        descriptionContent.innerHTML = `<p>${escapeHTML(poi.description)}</p>`;
    } else {
        descriptionContent.innerHTML = '<p class="text-muted">Bu POI için açıklama bulunmuyor.</p>';
    }
    
    // Update features/tags
    const featuresSection = document.getElementById('poiFeaturesSection');
    const featuresTags = document.getElementById('poiFeaturesTags');
    
    if (poi.tags && poi.tags.length > 0) {
        featuresSection.style.display = 'block';
        featuresTags.innerHTML = poi.tags.map(tag => 
            `<span class="feature-tag">${escapeHTML(tag)}</span>`
        ).join('');
    } else {
        featuresSection.style.display = 'none';
    }
    
    // Update ratings
    const ratingsSection = document.getElementById('poiRatingsSection');
    const ratingsGrid = document.getElementById('poiRatingsGrid');
    
    if (poi.ratings && Object.keys(poi.ratings).length > 0) {
        ratingsSection.style.display = 'block';
        ratingsGrid.innerHTML = Object.entries(poi.ratings).map(([category, value]) => {
            const categoryInfo = ratingCategories[category];
            if (!categoryInfo || value === 0) return '';
            
            return `
                <div class="rating-item">
                    <div class="rating-label">
                        <i class="${categoryInfo.icon}"></i>
                        ${categoryInfo.name}
                    </div>
                    <div class="rating-bar">
                        <div class="rating-fill" style="width: ${value}%"></div>
                    </div>
                    <div class="rating-value">${value}/100</div>
                </div>
            `;
        }).filter(Boolean).join('');
    } else {
        ratingsSection.style.display = 'none';
    }
    
    // Update coordinates
    document.getElementById('poiCoordinates').textContent = 
        `${poi.latitude.toFixed(6)}, ${poi.longitude.toFixed(6)}`;
    
    // Update category info
    document.getElementById('poiCategoryInfo').textContent = categoryDisplayName;
    
    // Update recommendation score if available
    const scoreSection = document.getElementById('poiRecommendationScore');
    const scoreBadge = document.getElementById('poiScoreBadge');
    
    if (poi.recommendationScore !== undefined) {
        scoreSection.style.display = 'block';
        scoreBadge.textContent = `${poi.recommendationScore}%`;
        scoreBadge.className = `badge ${poi.recommendationScore >= 70 ? 'bg-success' : poi.recommendationScore >= 40 ? 'bg-warning' : 'bg-secondary'}`;
    } else {
        scoreSection.style.display = 'none';
    }

    updatePOIAlertMuteButton(poi);
}

// Load POI modal media with robust error handling and fallbacks
async function loadPOIModalMedia(poiId) {
    // Reset gallery state for fresh load
    poiThumbnailsInitialized = false;
    poiMediaElementCache.clear();
    
    try {
        console.warn(`🔍 Loading media for POI ${poiId}...`);
        
        const response = await fetch(`${apiBase}/poi/${poiId}/media`);
        if (!response.ok) {
            console.warn(`⚠️ Media API returned ${response.status}: ${response.statusText}`);
            showNoMediaPlaceholder();
            return;
        }
        
        const mediaData = await response.json();
        console.warn('📦 Raw media data received:', mediaData);
        
        // Handle different API response formats with validation
        let mediaItems = [];
        
        if (Array.isArray(mediaData)) {
            mediaItems = mediaData;
        } else if (mediaData.media && Array.isArray(mediaData.media)) {
            mediaItems = mediaData.media;
        } else if (mediaData.images || mediaData.videos || mediaData.audio || mediaData.models) {
            // Legacy grouped format - flatten all types
            mediaItems = [
                ...(mediaData.images || []).map(item => ({ ...item, type: 'image' })),
                ...(mediaData.videos || []).map(item => ({ ...item, type: 'video' })),
                ...(mediaData.audio || []).map(item => ({ ...item, type: 'audio' })),
                ...(mediaData.models || []).map(item => ({ ...item, type: 'model_3d' }))
            ];
        }
        
        // Validate and normalize media items
        const validatedItems = await validateAndNormalizeMediaItems(mediaItems, poiId);
        
        if (validatedItems.length === 0) {
            console.warn('⚠️ No valid media items found after validation');
            showNoMediaPlaceholder();
            return;
        }
        
        currentMediaItems = validatedItems;
        currentMediaIndex = 0;
        
        console.warn(`✅ Successfully loaded ${validatedItems.length} media items`);
        
        // Display media gallery
        displayMediaGallery();
        
    } catch (error) {
        console.error('❌ Error loading media:', error);
        showMediaLoadError(`Medya yüklenirken hata: ${error.message}`, true);
    }
}

// Media validation and normalization system
async function validateAndNormalizeMediaItems(mediaItems, poiId) {
    if (!Array.isArray(mediaItems)) {
        console.warn('❌ Media items is not an array:', mediaItems);
        return [];
    }
    
    const validItems = [];
    const pathValidationPromises = [];
    
    for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        
        // Basic validation
        if (!item || typeof item !== 'object') {
            console.warn(`⚠️ Invalid media item at index ${i}:`, item);
            continue;
        }
        
        // Normalize the item
        const normalizedItem = await normalizeMediaItem(item, poiId, i);
        if (normalizedItem) {
            // Validate file existence asynchronously
            pathValidationPromises.push(
                validateMediaPath(normalizedItem).then(isValid => ({
                    item: normalizedItem,
                    isValid,
                    index: i
                }))
            );
        }
    }
    
    // Wait for all path validations
    const validationResults = await Promise.all(pathValidationPromises);
    
    for (const result of validationResults) {
        if (result.isValid) {
            validItems.push(result.item);
        } else {
            console.warn(`⚠️ Media file not accessible for item ${result.index}:`, result.item.path);
            // Add with fallback placeholder
            validItems.push({
                ...result.item,
                hasError: true,
                fallbackPath: '/static/images/media-placeholder.png'
            });
        }
    }
    
    console.warn(`📊 Media validation complete: ${validItems.length} valid items from ${mediaItems.length} total`);
    return validItems;
}

async function normalizeMediaItem(item, poiId, index) {
    try {
        // Extract path from various possible fields
        let path = item.path || item.url || item.filename || item.file_path || item.original_path;
        
        if (!path) {
            console.warn(`⚠️ No path found for media item ${index}:`, item);
            return null;
        }
        
        // Clean and normalize path
        path = path.trim();
        
        // Handle different path formats
        const normalizedPaths = generatePathVariants(path, poiId);
        
        // Determine media type
        const type = item.type || item.media_type || getMediaTypeFromPath(path);
        
        return {
            type,
            path: normalizedPaths.primary,
            fallbackPaths: normalizedPaths.alternatives,
            title: item.title || item.caption || item.description || item.alt_text || `${type} ${index + 1}`,
            caption: item.caption || item.description || '',
            originalItem: item
        };
    } catch (error) {
        console.warn(`⚠️ Error normalizing media item ${index}:`, error);
        return null;
    }
}

function generatePathVariants(originalPath, poiId) {
    const variants = [];
    
    // Remove leading slashes for consistency
    const cleanPath = originalPath.replace(/^\/+/, '');
    
    // Primary path strategies
    const primaryCandidates = [
        `/${cleanPath}`,                           // Original path with single leading slash
        `/poi_media/${cleanPath}`,                 // New media directory
        `/poi_images/${cleanPath}`,                // Legacy images directory
        `/uploads/${cleanPath}`,                   // Generic uploads
        `/static/poi_media/${cleanPath}`,          // Static media
        `poi_media/${cleanPath}`,                  // Relative path
    ];
    
    // If we have POI ID, add POI-specific paths
    if (poiId) {
        primaryCandidates.push(
            `/poi_media/poi_${poiId}/${cleanPath}`,
            `/poi_images/poi_${poiId}/${cleanPath}`
        );
    }
    
    return {
        primary: primaryCandidates[0],
        alternatives: primaryCandidates.slice(1)
    };
}

async function validateMediaPath(normalizedItem) {
    // Quick validation using a head request
    try {
        const response = await fetch(normalizedItem.path, { method: 'HEAD' });
        if (response.ok) {
            return true;
        }
        
        // Try alternative paths
        for (const altPath of normalizedItem.fallbackPaths || []) {
            try {
                const altResponse = await fetch(altPath, { method: 'HEAD' });
                if (altResponse.ok) {
                    // Update the primary path to the working one
                    normalizedItem.path = altPath;
                    return true;
                }
            } catch (e) {
                // Continue to next alternative
            }
        }
        
        return false;
    } catch (error) {
        console.warn('⚠️ Path validation failed:', error);
        return false;
    }
}

// Optimized POI media gallery state
let poiThumbnailsInitialized = false;
const poiMediaElementCache = new Map(); // key: index or path -> DOM element

// Display media gallery (optimized: build thumbs once, reuse elements)
function displayMediaGallery() {
    if (currentMediaItems.length === 0) {
        showNoMediaPlaceholder();
        return;
    }

    // Display or swap main media
    displayMainMedia(currentMediaIndex);

    // Build thumbnails only once per gallery open
    if (!poiThumbnailsInitialized) {
        buildPOIMediaThumbnailsOnce();
        poiThumbnailsInitialized = true;
    } else {
        // Only update active state if already built
        updateActivePOIThumbnail();
    }

    // Update navigation buttons
    updateMediaNavigation();

    // Preload neighbors for snappy navigation
    preloadAdjacentPOIMedia();
}

// Display main media with robust error handling
function getOrCreatePOIMediaElement(mediaItem, index) {
    const mediaPath = mediaItem.path || mediaItem.url;
    const key = `${mediaItem.type || getMediaTypeFromPath(mediaPath)}|${mediaPath}`;
    
    if (poiMediaElementCache.has(key)) {
        return poiMediaElementCache.get(key);
    }

    const mediaType = mediaItem.type || getMediaTypeFromPath(mediaPath);
    let el;
    
    // Check if this item has known errors and show fallback
    if (mediaItem.hasError && mediaItem.fallbackPath) {
        el = createFallbackMediaElement(mediaItem, index);
        poiMediaElementCache.set(key, el);
        return el;
    }
    
    switch (mediaType) {
        case 'image': {
            el = createRobustImageElement(mediaItem, index);
            break;
        }
        case 'video': {
            el = createRobustVideoElement(mediaItem, index);
            break;
        }
        case 'audio': {
            el = createRobustAudioElement(mediaItem, index);
            break;
        }
        case 'model_3d': {
            el = createRobust3DModelElement(mediaItem, index);
            break;
        }
        default: {
            el = createUnknownMediaElement(mediaItem, index);
        }
    }
    
    poiMediaElementCache.set(key, el);
    return el;
}

function createRobustImageElement(mediaItem, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-image-wrapper';
    wrapper.style.position = 'relative';
    
    const img = new Image();
    img.alt = mediaItem.caption || mediaItem.title || 'POI Görseli';
    img.decoding = 'async';
    img.loading = 'eager';
    img.style.cursor = 'zoom-in';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.transition = 'opacity 0.3s ease';
    
    // Loading placeholder
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'media-loading-placeholder';
    loadingDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; background: #f8f9fa; border-radius: 8px;">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Yükleniyor...</span>
            </div>
            <p class="mt-2 text-muted">Görsel yükleniyor...</p>
        </div>
    `;
    
    wrapper.appendChild(loadingDiv);
    
    img.onload = () => {
        img.style.opacity = '1';
        loadingDiv.remove();
        wrapper.appendChild(img);
        console.warn(`✅ Image loaded successfully: ${mediaItem.path}`);
    };
    
    img.onerror = () => {
        console.warn(`❌ Image load failed: ${mediaItem.path}`);
        loadingDiv.remove();
        
        // Try fallback paths if available
        if (mediaItem.fallbackPaths && mediaItem.fallbackPaths.length > 0) {
            const nextPath = mediaItem.fallbackPaths.shift();
            console.warn(`🔄 Trying fallback path: ${nextPath}`);
            img.src = nextPath.startsWith('/') ? nextPath : `/poi_media/${nextPath}`;
        } else {
            // Show error placeholder
            const errorDiv = createErrorPlaceholder('Görsel yüklenemedi', mediaItem.title);
            wrapper.appendChild(errorDiv);
        }
    };
    
    img.addEventListener('click', () => openMediaFullscreen(index));
    
    // Start loading
    const mediaPath = mediaItem.path;
    img.src = mediaPath.startsWith('/') ? mediaPath : `/poi_media/${mediaPath}`;
    
    return wrapper;
}

function createRobustVideoElement(mediaItem, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-video-wrapper';
    
    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.borderRadius = '8px';
    
    // Add multiple source formats
    const mediaPath = mediaItem.path.startsWith('/') ? mediaItem.path : `/poi_media/${mediaItem.path}`;
    const sources = [
        { src: mediaPath, type: 'video/mp4' },
        { src: mediaPath, type: 'video/webm' },
        { src: mediaPath, type: 'video/ogg' }
    ];
    
    sources.forEach(source => {
        const sourceEl = document.createElement('source');
        sourceEl.src = source.src;
        sourceEl.type = source.type;
        video.appendChild(sourceEl);
    });
    
    video.addEventListener('error', () => {
        console.warn(`❌ Video load failed: ${mediaItem.path}`);
        const errorDiv = createErrorPlaceholder('Video yüklenemedi', mediaItem.title);
        wrapper.innerHTML = '';
        wrapper.appendChild(errorDiv);
    });
    
    video.addEventListener('loadeddata', () => {
        console.warn(`✅ Video loaded successfully: ${mediaItem.path}`);
    });
    
    wrapper.appendChild(video);
    return wrapper;
}

function createRobustAudioElement(mediaItem, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'audio-player-container';
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '20px';
    wrapper.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.color = 'white';
    
    wrapper.innerHTML = `
        <i class="fas fa-music fa-4x mb-3" style="color: rgba(255,255,255,0.9);"></i>
        <h5 style="margin-bottom: 16px;">${mediaItem.title || 'Ses Dosyası'}</h5>
    `;
    
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.style.width = '100%';
    audio.style.maxWidth = '400px';
    
    const mediaPath = mediaItem.path.startsWith('/') ? mediaItem.path : `/poi_media/${mediaItem.path}`;
    const sources = [
        { src: mediaPath, type: 'audio/mpeg' },
        { src: mediaPath, type: 'audio/wav' },
        { src: mediaPath, type: 'audio/ogg' }
    ];
    
    sources.forEach(source => {
        const sourceEl = document.createElement('source');
        sourceEl.src = source.src;
        sourceEl.type = source.type;
        audio.appendChild(sourceEl);
    });
    
    audio.addEventListener('error', () => {
        console.warn(`❌ Audio load failed: ${mediaItem.path}`);
        const errorText = document.createElement('p');
        errorText.textContent = 'Ses dosyası yüklenemedi';
        errorText.style.color = '#ffcccb';
        errorText.style.marginTop = '16px';
        wrapper.appendChild(errorText);
    });
    
    wrapper.appendChild(audio);
    return wrapper;
}

function createRobust3DModelElement(mediaItem, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'model-3d-container';
    wrapper.style.textAlign = 'center';
    wrapper.style.background = '#1a1a1a';
    wrapper.style.borderRadius = '8px';
    wrapper.style.padding = '20px';
    wrapper.style.color = 'white';
    
    wrapper.innerHTML = `
        <i class="fas fa-cube fa-4x mb-3" style="color: #00d4aa;"></i>
        <h5>${mediaItem.title || '3D Model'}</h5>
        <p>3D model yükleniyor...</p>
    `;
    
    if (typeof window.customElements !== 'undefined' && window.customElements.get('model-viewer')) {
        const mv = document.createElement('model-viewer');
        const mediaPath = mediaItem.path.startsWith('/') ? mediaItem.path : `/poi_media/${mediaItem.path}`;
        mv.setAttribute('src', mediaPath);
        mv.setAttribute('alt', '3D Model');
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('camera-controls', '');
        mv.style.width = '100%';
        mv.style.height = '300px';
        mv.style.borderRadius = '8px';
        
        mv.addEventListener('error', () => {
            console.warn(`❌ 3D Model load failed: ${mediaItem.path}`);
            wrapper.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-3x mb-3" style="color: #ff6b6b;"></i>
                <h5>3D Model Yüklenemedi</h5>
                <p>Model dosyası bulunamadı veya desteklenmiyor.</p>
            `;
        });
        
        wrapper.appendChild(mv);
    } else {
        wrapper.innerHTML += '<p><em>3D model görüntüleyici yüklenemedi</em></p>';
    }
    
    return wrapper;
}

function createUnknownMediaElement(mediaItem, index) {
    const div = document.createElement('div');
    div.className = 'unknown-media';
    div.style.textAlign = 'center';
    div.style.padding = '40px';
    div.style.background = '#f8f9fa';
    div.style.borderRadius = '8px';
    div.style.color = '#6c757d';
    
    div.innerHTML = `
        <i class="fas fa-file fa-4x mb-3"></i>
        <h5>${mediaItem.title || 'Medya Dosyası'}</h5>
        <p>Bu medya türü desteklenmiyor.</p>
        <small>Dosya: ${mediaItem.path}</small>
    `;
    
    return div;
}

function createFallbackMediaElement(mediaItem, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-fallback';
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '30px';
    wrapper.style.background = 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.color = '#2d3436';
    
    wrapper.innerHTML = `
        <i class="fas fa-exclamation-circle fa-3x mb-3" style="color: #e17055;"></i>
        <h5>Medya Yüklenemedi</h5>
        <p>${mediaItem.title || 'Bu medya dosyası'} şu anda erişilebilir değil.</p>
        <button class="btn btn-outline-dark btn-sm mt-2" onclick="retryMediaLoad(${index})">
            <i class="fas fa-redo"></i> Tekrar Dene
        </button>
    `;
    
    return wrapper;
}

function createErrorPlaceholder(message, title) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'media-error-placeholder';
    errorDiv.style.display = 'flex';
    errorDiv.style.flexDirection = 'column';
    errorDiv.style.alignItems = 'center';
    errorDiv.style.justifyContent = 'center';
    errorDiv.style.height = '200px';
    errorDiv.style.background = '#f8d7da';
    errorDiv.style.border = '1px solid #f5c6cb';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.color = '#721c24';
    
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle fa-3x mb-2"></i>
        <h6>${message}</h6>
        ${title ? `<small>${title}</small>` : ''}
    `;
    
    return errorDiv;
}

// Retry media loading
function retryMediaLoad(index) {
    if (index >= 0 && index < currentMediaItems.length) {
        // Clear cache for this item
        const mediaItem = currentMediaItems[index];
        const mediaPath = mediaItem.path || mediaItem.url;
        const key = `${mediaItem.type || getMediaTypeFromPath(mediaPath)}|${mediaPath}`;
        poiMediaElementCache.delete(key);
        
        // Reload the media
        selectMedia(index);
    }
}

function displayMainMedia(index) {
    const mainContainer = document.getElementById('mediaGalleryMain');
    const mediaItem = currentMediaItems[index];

    if (!mediaItem) {
        showNoMediaPlaceholder();
        return;
    }

    const element = getOrCreatePOIMediaElement(mediaItem, index);

    // Swap content without rebuilding siblings
    mainContainer.innerHTML = '';
    mainContainer.appendChild(element);
}

// Display media thumbnails
function buildPOIMediaThumbnailsOnce() {
    const thumbnailsContainer = document.getElementById('mediaGalleryThumbnails');

    if (currentMediaItems.length <= 1) {
        thumbnailsContainer.style.display = 'none';
        return;
    }

    thumbnailsContainer.style.display = 'flex';
    thumbnailsContainer.innerHTML = '';

    currentMediaItems.forEach((mediaItem, index) => {
        const mediaPath = mediaItem.thumbnail_path || mediaItem.path || mediaItem.url;
        const mediaType = mediaItem.type || getMediaTypeFromPath(mediaPath);
        const thumb = document.createElement('div');
        thumb.className = 'media-thumbnail' + (index === currentMediaIndex ? ' active' : '');
        thumb.dataset.index = String(index);
        thumb.addEventListener('click', () => selectMedia(index));

        if (mediaType === 'image') {
            const img = document.createElement('img');
            // Use lazy loader
            img.dataset.src = mediaPath.startsWith('/') ? mediaPath : `/poi_media/${mediaPath}`;
            img.alt = `Thumbnail ${index + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.classList.add('lazy-image');
            thumb.appendChild(img);
        } else {
            const iconMap = { video: 'fas fa-play', audio: 'fas fa-music', model_3d: 'fas fa-cube' };
            const icon = iconMap[mediaType] || 'fas fa-file';
            const placeholder = document.createElement('div');
            placeholder.className = 'media-thumbnail-icon';
            placeholder.innerHTML = `<i class="${icon}"></i>`;
            thumb.appendChild(placeholder);
        }

        thumbnailsContainer.appendChild(thumb);
    });

    // Observe lazy images using the correct loader
    if (window.loadingManager && typeof window.loadingManager.observeLazyImages === 'function') {
        window.loadingManager.observeLazyImages();
    } else if (window.lazyLoader && typeof window.lazyLoader.setupImageLazyLoading === 'function') {
        window.lazyLoader.setupImageLazyLoading();
    } else {
        // Ultimate fallback: set src immediately
        thumbnailsContainer.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            delete img.dataset.src;
        });
    }
}

function updateActivePOIThumbnail() {
    const container = document.getElementById('mediaGalleryThumbnails');
    if (!container) return;
    const prev = container.querySelector('.media-thumbnail.active');
    if (prev) prev.classList.remove('active');
    const next = container.querySelector(`.media-thumbnail[data-index="${currentMediaIndex}"]`);
    if (next) next.classList.add('active');
}

function preloadAdjacentPOIMedia() {
    if (currentMediaItems.length <= 1) return;
    const preload = (i) => {
        if (i < 0 || i >= currentMediaItems.length) return;
        const item = currentMediaItems[i];
        const type = item.type || getMediaTypeFromPath(item.path || item.url);
        if (type !== 'image') return; // preload images only
        // Create off-DOM image to warm cache
        const img = new Image();
        img.decoding = 'async';
        const mediaPath = item.path || item.url;
        img.src = mediaPath.startsWith('/') ? mediaPath : `/poi_media/${mediaPath}`;
    };
    preload(currentMediaIndex + 1);
    preload(currentMediaIndex - 1);
}

// Update media navigation
function updateMediaNavigation() {
    // Determine which page we're on and use appropriate selectors
    const isPersonalRoutes = window.location.pathname.includes('personal_routes') || window.currentTab === 'dynamic-routes';
    const isPredefinedRoutes = window.location.pathname.includes('predefined_routes') || window.currentTab === 'predefined-routes';
    
    let prevBtn, nextBtn;
    
    if (isPersonalRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn');
    } else if (isPredefinedRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    } else {
        // Fallback - try both and use whichever exists
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    }
    
    if (!prevBtn || !nextBtn) {
        console.warn('⚠️ Media navigation buttons not found for current page context');
        return;
    }
    
    prevBtn.disabled = currentMediaIndex === 0;
    nextBtn.disabled = currentMediaIndex === currentMediaItems.length - 1;
    
    if (currentMediaItems.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    }
}

// Select media by index
function selectMedia(index) {
    if (index >= 0 && index < currentMediaItems.length) {
        currentMediaIndex = index;
        displayMainMedia(index);
        updateActivePOIThumbnail();
        updateMediaNavigation();
        preloadAdjacentPOIMedia();
    }
}

// Navigate to previous media
function previousMedia() {
    if (currentMediaIndex > 0) {
        selectMedia(currentMediaIndex - 1);
    }
}

// Navigate to next media
function nextMedia() {
    if (currentMediaIndex < currentMediaItems.length - 1) {
        selectMedia(currentMediaIndex + 1);
    }
}

// Open media in fullscreen
function openMediaFullscreen(index) {
    // Desktop: Create in-modal overlay for better UX (no modal-over-modal)
    // Mobile: Keep current behavior as it works well
    if (!Array.isArray(currentMediaItems) || index < 0 || index >= currentMediaItems.length) return;
    
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    
    if (isMobile) {
        // Mobile: Open in separate lightbox modal (works well on mobile)
        try {
            showMediaModal(
                currentMediaItems.map(item => {
                    const mediaPath = item.path || item.url;
                    const finalPath = mediaPath.startsWith('/') ? mediaPath : `/poi_media/${mediaPath}`;
                    return {
                        type: item.type || getMediaTypeFromPath(mediaPath),
                        path: finalPath,
                        title: item.caption || item.title || ''
                    };
                }),
                index,
                (typeof currentPOIData !== 'undefined' && currentPOIData && currentPOIData.name) ? currentPOIData.name : null
            );
        } catch (e) {
            console.warn('Mobile lightbox fallback failed:', e);
        }
    } else {
        // Desktop: Create in-modal overlay for better UX
        createInModalMediaOverlay(index);
    }
}

// Create in-modal media overlay for desktop (no modal-over-modal)
function createInModalMediaOverlay(index) {
    const mediaItem = currentMediaItems[index];
    if (!mediaItem) return;
    
    // Get the POI modal container
    const poiModal = document.getElementById('poiDetailModal');
    if (!poiModal) return;
    
    // Remove any existing overlay
    const existingOverlay = poiModal.querySelector('.in-modal-media-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create overlay within the POI modal
    const overlay = document.createElement('div');
    overlay.className = 'in-modal-media-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create navigation and controls
    const navControls = createInModalNavControls(index);
    overlay.appendChild(navControls);
    
    // Create media content
    const mediaContent = createInModalMediaContent(mediaItem, index);
    overlay.appendChild(mediaContent);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'in-modal-close-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        z-index: 12;
        transition: all 0.3s ease;
        color: #333;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 1)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    closeBtn.onclick = closeInModalOverlay;
    overlay.appendChild(closeBtn);
    
    // Add to POI modal
    poiModal.appendChild(overlay);
    
    // Keyboard navigation
    setupInModalKeyboardNav();
    
    console.warn(`🖼️ Opened in-modal overlay for media ${index + 1}/${currentMediaItems.length}`);
}

function createInModalNavControls(currentIndex) {
    const navContainer = document.createElement('div');
    navContainer.className = 'in-modal-nav-controls';
    navContainer.style.cssText = `
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        transform: translateY(-50%);
        display: flex;
        justify-content: space-between;
        padding: 0 20px;
        pointer-events: none;
        z-index: 12;
    `;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'in-modal-nav-btn prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentIndex === 0;
    prevBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.9);
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.3s ease;
        color: #333;
        ${currentIndex === 0 ? 'opacity: 0.3; cursor: not-allowed;' : ''}
    `;
    if (currentIndex > 0) {
        prevBtn.onclick = () => navigateInModalMedia(currentIndex - 1);
        prevBtn.onmouseover = () => prevBtn.style.background = 'rgba(255, 255, 255, 1)';
        prevBtn.onmouseout = () => prevBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'in-modal-nav-btn next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentIndex === currentMediaItems.length - 1;
    nextBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.9);
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.3s ease;
        color: #333;
        ${currentIndex === currentMediaItems.length - 1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}
    `;
    if (currentIndex < currentMediaItems.length - 1) {
        nextBtn.onclick = () => navigateInModalMedia(currentIndex + 1);
        nextBtn.onmouseover = () => nextBtn.style.background = 'rgba(255, 255, 255, 1)';
        nextBtn.onmouseout = () => nextBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    }
    
    // Counter
    const counter = document.createElement('div');
    counter.className = 'in-modal-counter';
    counter.textContent = `${currentIndex + 1} / ${currentMediaItems.length}`;
    counter.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        pointer-events: auto;
    `;
    
    navContainer.appendChild(prevBtn);
    navContainer.appendChild(nextBtn);
    navContainer.appendChild(counter);
    
    return navContainer;
}

function createInModalMediaContent(mediaItem, index) {
    const contentContainer = document.createElement('div');
    contentContainer.className = 'in-modal-media-content';
    contentContainer.style.cssText = `
        max-width: 90%;
        max-height: 85%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    `;
    
    const mediaType = mediaItem.type || getMediaTypeFromPath(mediaItem.path);

    if (mediaType === 'image') {
        const img = document.createElement('img');
        const mediaPath = mediaItem.path;
        img.src = mediaPath.startsWith('/') ? mediaPath : `/poi_media/${mediaPath}`;
        img.alt = mediaItem.title || 'POI Görseli';
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        
        // Add zoom functionality
        let currentZoom = 1;
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let imgPosition = { x: 0, y: 0 };
        
        img.style.cursor = 'zoom-in';
        img.onclick = (e) => {
            e.stopPropagation();
            if (currentZoom === 1) {
                currentZoom = 2;
                img.style.cursor = 'grab';
                img.style.transform = `scale(${currentZoom}) translate(${imgPosition.x}px, ${imgPosition.y}px)`;
            } else {
                currentZoom = 1;
                imgPosition = { x: 0, y: 0 };
                img.style.cursor = 'zoom-in';
                img.style.transform = 'scale(1) translate(0, 0)';
            }
        };
        
        // Drag functionality when zoomed
        img.onmousedown = (e) => {
            if (currentZoom > 1) {
                isDragging = true;
                img.style.cursor = 'grabbing';
                dragStart = { x: e.clientX - imgPosition.x, y: e.clientY - imgPosition.y };
                e.preventDefault();
            }
        };
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging && currentZoom > 1) {
                imgPosition = {
                    x: (e.clientX - dragStart.x) / currentZoom,
                    y: (e.clientY - dragStart.y) / currentZoom
                };
                img.style.transform = `scale(${currentZoom}) translate(${imgPosition.x}px, ${imgPosition.y}px)`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = currentZoom > 1 ? 'grab' : 'zoom-in';
            }
        });
        
        contentContainer.appendChild(img);
    } else {
        // For non-images, show a message
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
            text-align: center;
            color: white;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            border: 2px dashed rgba(255, 255, 255, 0.3);
        `;
        placeholder.innerHTML = `
            <i class="fas fa-expand fa-3x mb-3"></i>
            <h5>Tam Ekran Görüntüleme</h5>
            <p>Bu medya türü için tam ekran görüntüleme şu anda sadece görseller için destekleniyor.</p>
            <small>Medya: ${mediaItem.title || mediaItem.path}</small>
        `;
        contentContainer.appendChild(placeholder);
    }
    
    return contentContainer;
}

function navigateInModalMedia(newIndex) {
    if (newIndex >= 0 && newIndex < currentMediaItems.length) {
        createInModalMediaOverlay(newIndex);
    }
}

function closeInModalOverlay() {
    const overlay = document.querySelector('.in-modal-media-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            overlay.remove();
            removeInModalKeyboardNav();
        }, 300);
    }
}

let inModalKeyboardHandler = null;

function setupInModalKeyboardNav() {
    removeInModalKeyboardNav(); // Remove any existing handler
    
    inModalKeyboardHandler = (e) => {
        const overlay = document.querySelector('.in-modal-media-overlay');
        if (!overlay) return;
        
        switch (e.key) {
            case 'Escape':
                closeInModalOverlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const currentIndex = getCurrentInModalIndex();
                if (currentIndex > 0) navigateInModalMedia(currentIndex - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                const currentIdx = getCurrentInModalIndex();
                if (currentIdx < currentMediaItems.length - 1) navigateInModalMedia(currentIdx + 1);
                break;
        }
    };
    
    document.addEventListener('keydown', inModalKeyboardHandler);
}

function removeInModalKeyboardNav() {
    if (inModalKeyboardHandler) {
        document.removeEventListener('keydown', inModalKeyboardHandler);
        inModalKeyboardHandler = null;
    }
}

function getCurrentInModalIndex() {
    const counter = document.querySelector('.in-modal-counter');
    if (counter) {
        const text = counter.textContent;
        const match = text.match(/(\d+) \/ \d+/);
        return match ? parseInt(match[1]) - 1 : 0;
    }
    return 0;
}

// Close media fullscreen (legacy)
function closeMediaFullscreen() {
    const fullscreenDiv = document.querySelector('.media-fullscreen');
    if (fullscreenDiv) {
        fullscreenDiv.remove();
        document.body.style.overflow = '';
    }
}

// Show media loading error with retry option
function showMediaLoadError(message, canRetry = true) {
    const retryButton = canRetry ? `
        <button class="btn btn-primary btn-sm mt-3" onclick="location.reload()">
            <i class="fas fa-redo"></i> Sayfayı Yenile
        </button>
    ` : '';
    
    document.getElementById('mediaGalleryMain').innerHTML = `
        <div class="media-load-error" style="text-align: center; padding: 40px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; color: #856404;">
            <i class="fas fa-exclamation-triangle fa-3x mb-3" style="color: #dc3545;"></i>
            <h5>Medya Yükleme Hatası</h5>
            <p>${message}</p>
            ${retryButton}
        </div>
    `;
    document.getElementById('mediaGalleryThumbnails').style.display = 'none';
    const prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn');
    const nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
}

// Show no media placeholder
function showNoMediaPlaceholder() {
    document.getElementById('mediaGalleryMain').innerHTML = `
        <div class="no-media-placeholder" style="text-align: center; padding: 60px 20px; background: #f8f9fa; border-radius: 8px; color: #6c757d;">
            <i class="fas fa-image fa-4x mb-4" style="opacity: 0.5;"></i>
            <h5>Medya Bulunamadı</h5>
            <p>Bu POI için henüz medya dosyası eklenmemiş.</p>
            <small class="text-muted">Medya dosyaları yöneticiler tarafından eklenebilir.</small>
        </div>
    `;
    document.getElementById('mediaGalleryThumbnails').style.display = 'none';
    
    // Hide navigation buttons based on context
    const isPersonalRoutes = window.location.pathname.includes('personal_routes') || window.currentTab === 'dynamic-routes';
    const isPredefinedRoutes = window.location.pathname.includes('predefined_routes') || window.currentTab === 'predefined-routes';
    
    let prevBtn, nextBtn;
    
    if (isPersonalRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn');
    } else if (isPredefinedRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    } else {
        // Try both
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    }
    
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
}

// Show POI modal error
function showPOIModalError(message) {
    const titleElement = document.getElementById('poiDetailModalLabel');
    const mainElement = document.getElementById('mediaGalleryMain');
    
    if (titleElement) {
        titleElement.textContent = 'Hata';
    }
    
    if (mainElement) {
        mainElement.innerHTML = `
            <div class="no-media-placeholder">
                <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                <p class="text-danger mt-2">${message}</p>
            </div>
        `;
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, 'error');
    } else {
        alert('Hata: ' + message);
    }
}

// Get media type from file path
function getMediaTypeFromPath(path) {
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
}

// Setup POI modal event listeners
function setupPOIModalEventListeners() {
    // Media navigation (scoped to POI modal to avoid ID conflicts)
    // Determine context and use appropriate selectors
    const isPersonalRoutes = window.location.pathname.includes('personal_routes') || window.currentTab === 'dynamic-routes';
    const isPredefinedRoutes = window.location.pathname.includes('predefined_routes') || window.currentTab === 'predefined-routes';
    
    let prevBtn, nextBtn;
    
    if (isPersonalRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn');
    } else if (isPredefinedRoutes) {
        prevBtn = document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    } else {
        // Fallback - try both
        prevBtn = document.querySelector('#poiDetailModal #poiMediaPrevBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaPrevBtn');
        nextBtn = document.querySelector('#poiDetailModal #poiMediaNextBtn') || 
                  document.querySelector('#poiDetailModal #predefinedMediaNextBtn');
    }
    
    if (prevBtn) prevBtn.onclick = previousMedia;
    if (nextBtn) nextBtn.onclick = nextMedia;
    
    // Action buttons
    document.getElementById('showOnMapBtn').onclick = () => {
        if (currentPOIData) {
            focusOnMap(currentPOIData.latitude, currentPOIData.longitude);
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('poiDetailModal')).hide();
        }
    };
    
    document.getElementById('addToRouteBtn').onclick = () => {
        if (currentPOIData) {
            addToRoute(currentPOIData);
            showNotification(`"${currentPOIData.name}" rotaya eklendi`, 'success');
        }
    };
    
    document.getElementById('openInGoogleMapsBtn').onclick = () => {
        if (currentPOIData) {
            openInGoogleMaps(currentPOIData.latitude, currentPOIData.longitude, currentPOIData.name);
        }
    };
    
    document.getElementById('sharePoiBtn').onclick = () => {
        if (currentPOIData) {
            sharePOI(currentPOIData);
        }
    };

    const togglePoiAlertMuteBtn = document.getElementById('togglePoiAlertMuteBtn');
    if (togglePoiAlertMuteBtn) {
        togglePoiAlertMuteBtn.onclick = () => {
            const poiId = getCurrentPOIAlertIdentifier();
            if (!poiId || !currentPOIData) return;

            const nextMutedState = !isPoiNotificationMutedForCurrentDevice(poiId);
            setPoiNotificationMutedForCurrentDevice(poiId, nextMutedState);

            if (nextMutedState) {
                setStoredPoiAlertTimestamp(poiId, Date.now());
                showNotification(`"${currentPOIData.name}" için bildirimler kapatıldı`, 'success');
            } else {
                showNotification(`"${currentPOIData.name}" için bildirimler yeniden açıldı`, 'success');
            }

            updatePOIAlertMuteButton(currentPOIData);
        };
    }
    
    // Keyboard navigation
    const handleModalKeydown = (e) => {
        if (document.getElementById('poiDetailModal').classList.contains('show')) {
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    previousMedia();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextMedia();
                    break;
                case 'Escape':
                    closeMediaFullscreen();
                    break;
            }
        }
    };
    
    document.addEventListener('keydown', handleModalKeydown);
}

// Focus on map location
function focusOnMap(lat, lng) {
    if (map) {
        map.setView([lat, lng], Math.max(map.getZoom(), 16), {
            animate: true,
            duration: 1
        });
        
        // Add temporary highlight marker
        const highlightMarker = L.circleMarker([lat, lng], {
            color: '#ff0000',
            fillColor: '#ff0000',
            fillOpacity: 0.3,
            radius: 20,
            weight: 3
        }).addTo(map);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            map.removeLayer(highlightMarker);
        }, 3000);
    }
}

// Share POI
function sharePOI(poi) {
    const shareData = {
        title: poi.name,
        text: `${poi.name} - ${getCategoryDisplayName(poi.category)}`,
        url: `${window.location.origin}${window.location.pathname}?poi=${poi._id || poi.id}`
    };
    
    if (navigator.share) {
        navigator.share(shareData).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
        navigator.clipboard.writeText(shareText).then(() => {
            showNotification('POI bilgileri panoya kopyalandı', 'success');
        }).catch(() => {
            showNotification('Paylaşım başarısız', 'error');
        });
    }
}

// Update POI card click handlers to open detail modal
function updatePOICardClickHandlers() {
    // Update existing POI cards to open detail modal
    document.querySelectorAll('.poi-card[data-poi-id]').forEach(card => {
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            // Prevent triggering if clicking on action buttons
            if (e.target.closest('.poi-card__actions')) return;
            
            const poiId = card.dataset.poiId;
            showPOIDetail(poiId);
        };
    });
}

// Close POI detail modal
function closePOIDetailModal() {
    const modalElement = document.getElementById('poiDetailModal');
    if (!modalElement) return;
    
    try {
        // Try Bootstrap 5 first
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        } else {
            throw new Error('No Bootstrap modal instance');
        }
    } catch (error) {
        console.warn('Bootstrap modal close failed, using fallback:', error);
        // Fallback: manually hide modal
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
        
        // Remove backdrop
        const backdrop = document.getElementById('poiModalBackdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // Restore body scroll
        document.body.classList.remove('modal-open');
    }

    // Reset POI media gallery state/caches
    poiThumbnailsInitialized = false;
    poiMediaElementCache.clear();
}

// Add close button event listener when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const modalElement = document.getElementById('poiDetailModal');
    // Log removed for cleaner console
    
    if (modalElement) {
        // Log removed for cleaner console
        
        const closeBtn = modalElement.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePOIDetailModal);
        }
        
        // Close on backdrop click
        modalElement.addEventListener('click', function(e) {
            if (e.target === modalElement) {
                closePOIDetailModal();
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modalElement.classList.contains('show')) {
                closePOIDetailModal();
            }
        });
    } else {
        console.error('❌ POI Modal element not found on page load!');
        console.warn('Available elements with "modal" in id:', 
            Array.from(document.querySelectorAll('[id*="modal"]')).map(el => el.id));
    }
});
