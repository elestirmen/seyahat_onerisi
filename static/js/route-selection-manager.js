/**
 * RouteSelectionManager - Hazır rotalar seçimi ve yönetimi için JavaScript sınıfı
 * Requirements: 1.2, 1.3, 4.2, 7.2
 */

class RouteSelectionManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.predefinedRoutes = [];
        this.filteredRoutes = [];
        this.currentFilters = {
            route_type: '',
            difficulty_level: { min: 1, max: 5 },
            duration: { min: 0, max: 1440 }, // minutes
            distance: { min: 0, max: 100 }, // km
            tags: [],
            season: ''
        };
        this.selectedRoute = null;
        this.isLoading = false;
        
        // API base URL
        this.apiBase = window.apiBase || '/api';
        
        // Initialize
        this.init();
    }

    /**
     * Initialize the route selection manager
     */
    init() {
        console.log('🚀 RouteSelectionManager initializing...');
        this.setupEventListeners();
        this.loadPredefinedRoutes();
    }

    /**
     * Setup event listeners for route selection interface
     */
    setupEventListeners() {
        // Filter change listeners
        const filterElements = this.container.querySelectorAll('.route-filter');
        filterElements.forEach(element => {
            element.addEventListener('change', (e) => {
                this.handleFilterChange(e);
            });
        });

        // Search input listener
        const searchInput = this.container.querySelector('#routeSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Clear filters button
        const clearFiltersBtn = this.container.querySelector('#clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }
    }

    /**
     * Load predefined routes from API
     * Requirements: 1.2, 7.2
     */
    async loadPredefinedRoutes() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();

        try {
            console.log('📥 Loading predefined routes...');
            const data = await window.apiClient.get('/routes');
            
            if (data.success) {
                this.predefinedRoutes = data.routes || [];
                this.filteredRoutes = [...this.predefinedRoutes];
                console.log(`✅ Loaded ${this.predefinedRoutes.length} predefined routes`);
                
                this.renderRoutesList();
                this.updateRouteCount();
            } else {
                throw new Error(data.error?.message || 'Failed to load routes');
            }

        } catch (error) {
            console.error('❌ Error loading predefined routes:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * Filter routes based on criteria
     * Requirements: 7.2
     */
    filterRoutes(criteria = null) {
        const filters = criteria || this.currentFilters;
        
        console.log('🔍 Filtering routes with criteria:', filters);
        
        this.filteredRoutes = this.predefinedRoutes.filter(route => {
            // Route type filter
            if (filters.route_type && route.route_type !== filters.route_type) {
                return false;
            }

            // Difficulty level filter
            if (route.difficulty_level < filters.difficulty_level.min || 
                route.difficulty_level > filters.difficulty_level.max) {
                return false;
            }

            // Duration filter (convert hours to minutes)
            const routeDuration = route.estimated_duration || 0;
            if (routeDuration < filters.duration.min || routeDuration > filters.duration.max) {
                return false;
            }

            // Distance filter
            const routeDistance = route.total_distance || 0;
            if (routeDistance < filters.distance.min || routeDistance > filters.distance.max) {
                return false;
            }

            // Tags filter
            if (filters.tags.length > 0) {
                const routeTags = route.tags ? route.tags.split(',').map(tag => tag.trim()) : [];
                const hasMatchingTag = filters.tags.some(tag => 
                    routeTags.some(routeTag => routeTag.toLowerCase().includes(tag.toLowerCase()))
                );
                if (!hasMatchingTag) {
                    return false;
                }
            }

            // Season filter
            if (filters.season) {
                const seasonAvailability = route.season_availability || [];
                if (!seasonAvailability.includes(filters.season)) {
                    return false;
                }
            }

            return true;
        });

        console.log(`🔍 Filtered to ${this.filteredRoutes.length} routes`);
        this.renderRoutesList();
        this.updateRouteCount();
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(event) {
        const { name, value, type, checked } = event.target;
        
        if (type === 'checkbox') {
            if (name === 'tags') {
                if (checked) {
                    this.currentFilters.tags.push(value);
                } else {
                    this.currentFilters.tags = this.currentFilters.tags.filter(tag => tag !== value);
                }
            }
        } else if (name.includes('.')) {
            // Handle nested properties like difficulty_level.min
            const [parent, child] = name.split('.');
            if (!this.currentFilters[parent]) {
                this.currentFilters[parent] = {};
            }
            this.currentFilters[parent][child] = parseFloat(value) || value;
        } else {
            this.currentFilters[name] = value;
        }

        this.filterRoutes();
    }

    /**
     * Handle search input
     */
    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredRoutes = [...this.predefinedRoutes];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredRoutes = this.predefinedRoutes.filter(route => 
                route.name.toLowerCase().includes(term) ||
                route.description.toLowerCase().includes(term) ||
                (route.tags && route.tags.toLowerCase().includes(term))
            );
        }

        this.renderRoutesList();
        this.updateRouteCount();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.currentFilters = {
            route_type: '',
            difficulty_level: { min: 1, max: 5 },
            duration: { min: 0, max: 1440 },
            distance: { min: 0, max: 100 },
            tags: [],
            season: ''
        };

        // Reset form elements
        const filterElements = this.container.querySelectorAll('.route-filter');
        filterElements.forEach(element => {
            if (element.type === 'checkbox') {
                element.checked = false;
            } else {
                element.value = '';
            }
        });

        const searchInput = this.container.querySelector('#routeSearch');
        if (searchInput) {
            searchInput.value = '';
        }

        this.filteredRoutes = [...this.predefinedRoutes];
        this.renderRoutesList();
        this.updateRouteCount();
    }

    /**
     * Display route details in modal
     * Requirements: 4.2
     */
    async displayRouteDetails(routeId) {
        try {
            console.log(`📋 Loading route details for ID: ${routeId}`);
            
            const data = await window.apiClient.get(`/routes/${routeId}`);
            
            if (data.success) {
                const route = data.route;
                this.showRouteModal(route);
            } else {
                throw new Error(data.error?.message || 'Failed to load route details');
            }

        } catch (error) {
            console.error('❌ Error loading route details:', error);
            this.showNotification('Rota detayları yüklenirken hata oluştu', 'error');
        }
    }

    /**
     * Select a route for navigation
     * Requirements: 1.3
     */
    selectRoute(routeId) {
        const route = this.predefinedRoutes.find(r => r.id === routeId);
        if (!route) {
            console.error('❌ Route not found:', routeId);
            return;
        }

        this.selectedRoute = route;
        console.log('✅ Route selected:', route.name);

        // Trigger route selection event
        const event = new CustomEvent('routeSelected', {
            detail: { route: route }
        });
        document.dispatchEvent(event);

        // Close modal if open
        this.closeRouteModal();

        // Show success notification
        this.showNotification(`"${route.name}" rotası seçildi`, 'success');
    }

    /**
     * Render the routes list
     */
    renderRoutesList() {
        const routesContainer = this.container.querySelector('#routesList');
        if (!routesContainer) {
            console.warn('Routes list container not found');
            return;
        }

        if (this.filteredRoutes.length === 0) {
            routesContainer.innerHTML = `
                <div class="no-routes-message">
                    <i class="fas fa-route" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3>Kriterlere uygun rota bulunamadı</h3>
                    <p>Filtreleri değiştirerek tekrar deneyin</p>
                </div>
            `;
            return;
        }

        const routesHTML = this.filteredRoutes.map(route => this.renderRouteCard(route)).join('');
        routesContainer.innerHTML = routesHTML;

        // Add event listeners to route cards
        this.attachRouteCardListeners();
    }

    /**
     * Render a single route card
     */
    renderRouteCard(route) {
        const difficultyStars = '★'.repeat(route.difficulty_level) + '☆'.repeat(5 - route.difficulty_level);
        const duration = Math.round(route.estimated_duration / 60) || 0;
        const distance = route.total_distance || 0;
        const poiCount = route.poi_count || 0;

        return `
            <div class="route-card" data-route-id="${route.id}">
                <div class="route-card-header">
                    <h3 class="route-name">${route.name}</h3>
                    <div class="route-type-badge">${this.getRouteTypeLabel(route.route_type)}</div>
                </div>
                
                <div class="route-description">
                    ${route.description || 'Açıklama bulunmuyor'}
                </div>
                
                <div class="route-stats">
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${duration} saat</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-route"></i>
                        <span>${distance.toFixed(1)} km</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${poiCount} durak</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-star"></i>
                        <span title="Zorluk: ${route.difficulty_level}/5">${difficultyStars}</span>
                    </div>
                </div>
                
                <div class="route-actions">
                    <button class="btn btn-outline route-details-btn" data-route-id="${route.id}">
                        <i class="fas fa-info-circle"></i> Detaylar
                    </button>
                    <button class="btn btn-primary route-select-btn" data-route-id="${route.id}">
                        <i class="fas fa-check"></i> Seç
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to route cards
     */
    attachRouteCardListeners() {
        // Details buttons
        const detailsButtons = this.container.querySelectorAll('.route-details-btn');
        detailsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = parseInt(btn.dataset.routeId);
                this.displayRouteDetails(routeId);
            });
        });

        // Select buttons
        const selectButtons = this.container.querySelectorAll('.route-select-btn');
        selectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = parseInt(btn.dataset.routeId);
                this.selectRoute(routeId);
            });
        });

        // Card click for details
        const routeCards = this.container.querySelectorAll('.route-card');
        routeCards.forEach(card => {
            card.addEventListener('click', () => {
                const routeId = parseInt(card.dataset.routeId);
                this.displayRouteDetails(routeId);
            });
        });
    }

    /**
     * Show route details modal
     */
    showRouteModal(route) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('routeDetailsModal');
        if (!modal) {
            modal = this.createRouteModal();
            document.body.appendChild(modal);
        }

        // Populate modal content
        this.populateRouteModal(modal, route);

        // Show modal
        modal.classList.add('show');
        document.body.classList.add('modal-open');

        // Add event listeners
        this.attachModalListeners(modal, route);
    }

    /**
     * Create route details modal
     */
    createRouteModal() {
        const modal = document.createElement('div');
        modal.id = 'routeDetailsModal';
        modal.className = 'modal route-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title"></h2>
                        <button type="button" class="modal-close" aria-label="Kapat">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="route-modal-content">
                            <div class="route-info-section">
                                <div class="route-stats-grid"></div>
                                <div class="route-description-full"></div>
                            </div>
                            <div class="route-pois-section">
                                <h3>Duraklar</h3>
                                <div class="route-pois-list"></div>
                            </div>
                            <div class="route-map-section">
                                <h3>Harita</h3>
                                <div class="route-map-placeholder">
                                    <i class="fas fa-map"></i>
                                    <p>Harita yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline modal-cancel">İptal</button>
                        <button type="button" class="btn btn-primary modal-select">Bu Rotayı Seç</button>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    /**
     * Populate route modal with data
     */
    populateRouteModal(modal, route) {
        // Title
        modal.querySelector('.modal-title').textContent = route.name;

        // Stats grid
        const statsGrid = modal.querySelector('.route-stats-grid');
        const duration = Math.round(route.estimated_duration / 60) || 0;
        const distance = route.total_distance || 0;
        const difficultyStars = '★'.repeat(route.difficulty_level) + '☆'.repeat(5 - route.difficulty_level);
        
        statsGrid.innerHTML = `
            <div class="stat-item">
                <i class="fas fa-clock"></i>
                <div>
                    <span class="stat-value">${duration} saat</span>
                    <span class="stat-label">Süre</span>
                </div>
            </div>
            <div class="stat-item">
                <i class="fas fa-route"></i>
                <div>
                    <span class="stat-value">${distance.toFixed(1)} km</span>
                    <span class="stat-label">Mesafe</span>
                </div>
            </div>
            <div class="stat-item">
                <i class="fas fa-star"></i>
                <div>
                    <span class="stat-value">${difficultyStars}</span>
                    <span class="stat-label">Zorluk</span>
                </div>
            </div>
            <div class="stat-item">
                <i class="fas fa-tag"></i>
                <div>
                    <span class="stat-value">${this.getRouteTypeLabel(route.route_type)}</span>
                    <span class="stat-label">Tip</span>
                </div>
            </div>
        `;

        // Description
        const descriptionEl = modal.querySelector('.route-description-full');
        descriptionEl.textContent = route.description || 'Açıklama bulunmuyor';

        // POIs list
        const poisList = modal.querySelector('.route-pois-list');
        if (route.pois && route.pois.length > 0) {
            const poisHTML = route.pois.map((poi, index) => `
                <div class="poi-item">
                    <div class="poi-order">${index + 1}</div>
                    <div class="poi-info">
                        <h4>${poi.name}</h4>
                        <p>${poi.description || 'Açıklama yok'}</p>
                        <span class="poi-category">${poi.category}</span>
                    </div>
                </div>
            `).join('');
            poisList.innerHTML = poisHTML;
        } else {
            poisList.innerHTML = '<p class="no-pois">Bu rotada henüz durak eklenmemiş</p>';
        }
    }

    /**
     * Attach modal event listeners
     */
    attachModalListeners(modal, route) {
        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.closeRouteModal());

        // Cancel button
        const cancelBtn = modal.querySelector('.modal-cancel');
        cancelBtn.addEventListener('click', () => this.closeRouteModal());

        // Select button
        const selectBtn = modal.querySelector('.modal-select');
        selectBtn.addEventListener('click', () => this.selectRoute(route.id));

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeRouteModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeRouteModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Close route details modal
     */
    closeRouteModal() {
        const modal = document.getElementById('routeDetailsModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * Update route count display
     */
    updateRouteCount() {
        const countElement = this.container.querySelector('#routeCount');
        if (countElement) {
            countElement.textContent = this.filteredRoutes.length;
        }

        const totalCountElement = this.container.querySelector('#totalRouteCount');
        if (totalCountElement) {
            totalCountElement.textContent = this.predefinedRoutes.length;
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const routesContainer = this.container.querySelector('#routesList');
        if (routesContainer) {
            routesContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #007bff;"></i>
                    <p>Rotalar yükleniyor...</p>
                </div>
            `;
        }
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        // Loading state will be replaced by renderRoutesList()
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        const routesContainer = this.container.querySelector('#routesList');
        if (routesContainer) {
            routesContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #dc3545; margin-bottom: 1rem;"></i>
                    <h3>Rotalar yüklenemedi</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="routeSelectionManager.loadPredefinedRoutes()">
                        <i class="fas fa-redo"></i> Tekrar Dene
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback notification
            console.log(`${type.toUpperCase()}: ${message}`);
            alert(message);
        }
    }

    /**
     * Get route type label
     */
    getRouteTypeLabel(routeType) {
        const labels = {
            'walking': 'Yürüyüş',
            'hiking': 'Doğa Yürüyüşü',
            'cycling': 'Bisiklet',
            'driving': 'Araç'
        };
        return labels[routeType] || routeType;
    }

    /**
     * Get selected route
     */
    getSelectedRoute() {
        return this.selectedRoute;
    }

    /**
     * Refresh routes list
     */
    refresh() {
        this.loadPredefinedRoutes();
    }
}

// Export for use in other modules
window.RouteSelectionManager = RouteSelectionManager;