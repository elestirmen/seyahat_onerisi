/**
 * RouteAdminManager - Admin rota yönetimi için JavaScript sınıfı
 * Requirements: 2.4, 3.3, 6.3
 */

class RouteAdminManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.routes = [];
        this.availablePOIs = [];
        this.selectedPOIs = [];
        this.currentRoute = null;
        this.isLoading = false;
        this.isDirty = false; // Track unsaved changes

        // Route media management
        this.pendingMediaData = null; // {file, caption, isPrimary}
        this.routeMedia = [];
        this.mediaMarkers = [];
        this.handleMapClickBound = null;
        this.map = null;
        this.escHandler = null;
        
        // API client setup
        // Use explicit API base path to avoid relative URL issues when the admin
        // panel is served from subdirectories (e.g. /admin)
        this.apiBase = window.apiBase || '/api';
        // Create a dedicated API client instance without a default base URL so
        // that we can explicitly prefix requests with this.apiBase
        this.apiClient = new window.APIClient('');

        // Form validation rules
        this.validationRules = {
            name: { required: true, minLength: 3, maxLength: 100 },
            description: { required: true, minLength: 10, maxLength: 500 },
            route_type: { required: true },
            difficulty_level: { required: true, min: 1, max: 5 },
            estimated_duration: { required: true, min: 30, max: 1440 }
        };
        
        // Initialize
        this.init();
    }

    ensureMap() {
        if (!this.map && window.map) {
            this.map = window.map;
            this.handleMapClickBound = this.handleMapClick.bind(this);
            this.map.on('click', this.handleMapClickBound);
        }
    }

    /**
     * Initialize the route admin manager
     */
    init() {
        console.log('🚀 RouteAdminManager initializing...');
        this.setupEventListeners();
        this.loadRoutes();
        this.loadAvailablePOIs();
    }

    /**
     * Setup event listeners for admin interface
     */
    setupEventListeners() {
        // New route button
        const newRouteBtn = this.container.querySelector('#newRouteBtn');
        if (newRouteBtn) {
            newRouteBtn.addEventListener('click', () => this.showCreateRouteForm());
        }

        // Form submission
        const routeForm = this.container.querySelector('#routeForm');
        if (routeForm) {
            routeForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Form input validation
        const formInputs = this.container.querySelectorAll('#routeForm input, #routeForm textarea, #routeForm select');
        formInputs.forEach(input => {
            input.addEventListener('input', () => this.validateField(input));
            input.addEventListener('blur', () => this.validateField(input));
        });

        // Cancel form button
        const cancelBtn = this.container.querySelector('#cancelRouteForm');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelForm());
        }

        // POI search
        const poiSearch = this.container.querySelector('#poiSearch');
        if (poiSearch) {
            poiSearch.addEventListener('input', (e) => this.filterPOIs(e.target.value));
        }

        // Warn about unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = 'Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinizden emin misiniz?';
            }
        });
    }

    /**
     * Load all routes for admin management
     * Requirements: 2.4
     */
    async loadRoutes() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showRoutesLoadingState();

        try {
            console.log('📥 Loading routes for admin...');
            const data = await this.apiClient.get(`${this.apiBase}/admin/routes`);


            if (data && Array.isArray(data.routes)) {
                this.routes = data.routes;
                console.log(`✅ Loaded ${this.routes.length} routes for admin`);

                this.renderRoutesTable();
            } else {
                const errorMsg = data?.error?.message || 'Failed to load routes';
                throw new Error(errorMsg);
            }

        } catch (error) {
            console.error('❌ Error loading routes:', error);
            this.showRoutesErrorState(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load available POIs for route creation
     * Requirements: 6.3
     */
    async loadAvailablePOIs() {
        try {
            console.log('📥 Loading available POIs...');
            const data = await this.apiClient.get(`${this.apiBase}/pois`);


            const poiData = data?.pois || data;
            if (poiData) {
                if (Array.isArray(poiData)) {
                    this.availablePOIs = poiData;
                } else if (typeof poiData === 'object') {
                    this.availablePOIs = Object.values(poiData).flat();
                } else {
                    this.availablePOIs = [];
                }

                console.log(`✅ Loaded ${this.availablePOIs.length} available POIs`);
                this.renderPOIsList();
            } else {
                throw new Error('Failed to load POIs');
            }

        } catch (error) {
            console.error('❌ Error loading POIs:', error);
            this.showNotification('POI\'ler yüklenirken hata oluştu', 'error');
        }
    }

    /**
     * Create a new route
     * Requirements: 2.4, 3.3
     */
    async createRoute(routeData) {
        try {
            console.log('➕ Creating new route:', routeData);
            
            const data = await this.apiClient.post(`${this.apiBase}/admin/routes`, routeData);
            
            if (data.success) {
                console.log('✅ Route created successfully:', data.route);
                this.showNotification('Rota başarıyla oluşturuldu', 'success');
                
                // Add to local routes array
                this.routes.unshift(data.route);
                this.renderRoutesTable();
                
                // Clear form
                this.clearForm();
                this.isDirty = false;
                
                return data.route;
            } else {
                throw new Error(data.error?.message || 'Failed to create route');
            }

        } catch (error) {
            console.error('❌ Error creating route:', error);
            this.showNotification(`Rota oluşturulurken hata: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update an existing route
     * Requirements: 2.4, 3.3
     */
    async updateRoute(routeId, routeData) {
        try {
            console.log('✏️ Updating route:', routeId, routeData);
            
            const data = await this.apiClient.put(`${this.apiBase}/admin/routes/${routeId}`, routeData);
            
            if (data.success) {
                console.log('✅ Route updated successfully:', data.route);
                this.showNotification('Rota başarıyla güncellendi', 'success');
                
                // Update local routes array
                const index = this.routes.findIndex(r => r.id === routeId);
                if (index !== -1) {
                    this.routes[index] = data.route;
                    this.renderRoutesTable();
                }
                
                // Clear form
                this.clearForm();
                this.isDirty = false;
                
                return data.route;
            } else {
                throw new Error(data.error?.message || 'Failed to update route');
            }

        } catch (error) {
            console.error('❌ Error updating route:', error);
            this.showNotification(`Rota güncellenirken hata: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete a route
     * Requirements: 2.4
     */
    async deleteRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) {
            this.showNotification('Rota bulunamadı', 'error');
            return;
        }

        // Confirm deletion
        if (!confirm(`"${route.name}" rotasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }

        try {
            console.log('🗑️ Deleting route:', routeId);
            
            const data = await this.apiClient.delete(`${this.apiBase}/admin/routes/${routeId}`);
            
            if (data.success) {
                console.log('✅ Route deleted successfully');
                this.showNotification('Rota başarıyla silindi', 'success');
                
                // Remove from local routes array
                this.routes = this.routes.filter(r => r.id !== routeId);
                this.renderRoutesTable();
                
            } else {
                throw new Error(data.error?.message || 'Failed to delete route');
            }

        } catch (error) {
            console.error('❌ Error deleting route:', error);
            this.showNotification(`Rota silinirken hata: ${error.message}`, 'error');
        }
    }

    /**
     * Associate POIs with a route
     * Requirements: 6.3
     */
    async managePOIAssociations(routeId, poiAssociations) {
        try {
            console.log('🔗 Managing POI associations for route:', routeId, poiAssociations);
            
            const data = await this.apiClient.post(`${this.apiBase}/admin/routes/${routeId}/pois`, { pois: poiAssociations });
            
            if (data.success) {
                console.log('✅ POI associations updated successfully');
                this.showNotification('POI ilişkilendirmeleri güncellendi', 'success');
                return true;
            } else {
                throw new Error(data.error?.message || 'Failed to update POI associations');
            }

        } catch (error) {
            console.error('❌ Error managing POI associations:', error);
            this.showNotification(`POI ilişkilendirme hatası: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Show create route form
     */
    showCreateRouteForm() {
        this.currentRoute = null;
        this.selectedPOIs = [];
        this.clearForm();
        this.showForm();
        this.renderSelectedPOIs();
    }

    /**
     * Show edit route form
     */
    showEditRouteForm(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) {
            this.showNotification('Rota bulunamadı', 'error');
            return;
        }

        this.currentRoute = route;
        this.selectedPOIs = route.pois || [];
        this.populateForm(route);
        this.showForm();
        this.renderSelectedPOIs();
        this.setupMediaHandlers();
        this.loadRouteMedia(routeId);
        if (this.handleMapClickBound && this.map) {
            this.map.off('click', this.handleMapClickBound);
        }
        if (window.map) {
            this.map = window.map;
            this.handleMapClickBound = this.handleMapClick.bind(this);
            this.map.on('click', this.handleMapClickBound);
        }
    }

    /**
     * Setup media upload handlers
     */
    setupMediaHandlers() {
        const addBtn = this.container.querySelector('#addRouteImageBtn');
        const modalEl = document.getElementById('routeMediaModal');
        const fileInput = document.getElementById('routeMediaFile');
        const captionInput = document.getElementById('routeMediaCaption');
        const primaryInput = document.getElementById('routeMediaPrimary');
        const startBtn = document.getElementById('routeMediaStartBtn');

        if (addBtn && modalEl && fileInput && startBtn) {
            const modal = new bootstrap.Modal(modalEl);
            addBtn.addEventListener('click', () => {
                fileInput.value = '';
                captionInput.value = '';
                primaryInput.checked = false;
                modal.show();
            });

            startBtn.addEventListener('click', () => {
                if (!fileInput.files.length) {
                    this.showNotification('Lütfen bir fotoğraf seçin', 'error');
                    return;
                }
                this.pendingMediaData = {
                    file: fileInput.files[0],
                    caption: captionInput.value,
                    isPrimary: primaryInput.checked
                };
                startBtn.blur();
                modalEl.addEventListener('hidden.bs.modal', () => {
                    this.showNotification('Fotoğraf konumu için haritadan bir nokta seçin. İptal için ESC', 'info');
                    this.startCoordinateSelection();
                }, { once: true });
                modal.hide();

            });
        }
    }

    startCoordinateSelection() {
        this.ensureMap();
        if (!this.map) return;
        const mapContainer = this.map.getContainer();
        mapContainer.classList.add('select-location');
        mapContainer.focus();

        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.cancelCoordinateSelection();
                this.showNotification('Fotoğraf konumu seçimi iptal edildi', 'warning');
            }
        };
        document.addEventListener('keydown', this.escHandler);
    }

    cancelCoordinateSelection() {
        if (this.map) {
            const mapContainer = this.map.getContainer();
            mapContainer.classList.remove('select-location');
            mapContainer.blur();

        }
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        this.pendingMediaData = null;
        const fileInput = document.getElementById('routeMediaFile');
        if (fileInput) fileInput.value = '';
    }

    /**
     * Handle map click for media placement
     */
    async handleMapClick(e) {
        if (!this.pendingMediaData || !this.currentRoute) return;
        const { file, caption, isPrimary } = this.pendingMediaData;
        const routeId = this.currentRoute.id;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', caption);
        formData.append('is_primary', isPrimary);
        formData.append('lat', e.latlng.lat);
        formData.append('lng', e.latlng.lng);
        try {
            const data = await this.apiClient.upload(`${this.apiBase}/admin/routes/${routeId}/media`, formData);

            if (data && (data.media || data)) {
                const media = data.media || data;
                this.routeMedia.push(media);
                this.addMediaMarker(media);
                this.renderMediaList();
            }
        } catch (err) {
            console.error('Media upload error:', err);
            this.showNotification('Medya yüklenemedi', 'error');
        } finally {
            this.cancelCoordinateSelection();
        }
    }

    /**
     * Load existing media for a route
     */
    async loadRouteMedia(routeId) {
        const url = `${this.apiBase}/routes/${routeId}/media`;
        try {
            const data = await this.apiClient.get(url);
            const mediaList = data.media || data || [];
            this.routeMedia = Array.isArray(mediaList) ? mediaList : [];
        } catch (err) {
            if (err.status !== 404) {
                console.error('Media load error:', err);
            }
            this.routeMedia = [];
        }

        this.mediaMarkers.forEach(m => this.map && this.map.removeLayer(m.marker));
        this.mediaMarkers = [];
        this.routeMedia.forEach(m => this.addMediaMarker(m));
        this.renderMediaList();
    }

    /**
     * Add marker for media item
     */
    addMediaMarker(media) {
        if (!this.map) return;
        const lat = media.lat ?? media.latitude;
        const lng = media.lng ?? media.longitude;
        if (lat == null || lng == null) return;

        const marker = L.marker([lat, lng]).addTo(this.map);
        const imageUrl = media.url || `/${media.thumbnail_path || media.file_path}`;
        if (imageUrl) {
            marker.bindPopup(`<img src="${imageUrl}" alt="route media" style="max-width:150px;">`);
        }
        this.mediaMarkers.push({ id: media.id, marker });
    }

    /**
     * Render media list panel
     */
    renderMediaList() {
        const container = this.container.querySelector('#routeMediaList');
        if (!container) return;
        container.innerHTML = '';
        if (this.routeMedia.length === 0) {
            container.innerHTML = '<div class="text-muted">Henüz fotoğraf eklenmemiş.</div>';
            return;
        }
        this.routeMedia.forEach(media => {
            const item = document.createElement('div');
            item.className = 'route-media-card';
            const imageUrl = media.thumbnail_path ? `/${media.thumbnail_path}` : (media.url || '');
            const name = media.caption || media.filename || media.id;
            item.innerHTML = `
                ${imageUrl ? `<img src="${imageUrl}" class="route-media-thumb" alt="${name}">` : ''}
                <div class="p-2 small text-truncate">${name}</div>
                <div class="route-media-delete" data-id="${media.id}"><i class="fas fa-trash"></i></div>
            `;
            container.appendChild(item);
        });
        container.querySelectorAll('.route-media-delete').forEach(el => {
            el.addEventListener('click', () => this.deleteMedia(el.dataset.id));
        });
    }

    /**
     * Delete media item
     */
    async deleteMedia(mediaId) {
        if (!this.currentRoute) return;
        try {
            await this.apiClient.delete(`${this.apiBase}/admin/routes/${this.currentRoute.id}/media/${mediaId}`);
            this.routeMedia = this.routeMedia.filter(m => m.id !== mediaId);
            const markerObj = this.mediaMarkers.find(m => m.id == mediaId);
            if (markerObj && this.map) {
                this.map.removeLayer(markerObj.marker);
                this.mediaMarkers = this.mediaMarkers.filter(m => m.id != mediaId);
            }
            this.renderMediaList();
        } catch (err) {
            console.error('Delete media error:', err);
        }
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            this.showNotification('Lütfen tüm gerekli alanları doğru şekilde doldurun', 'error');
            return;
        }

        const formData = this.getFormData();
        
        try {
            if (this.currentRoute) {
                // Update existing route
                await this.updateRoute(this.currentRoute.id, formData);
            } else {
                // Create new route
                await this.createRoute(formData);
            }
            
            this.hideForm();
            
        } catch (error) {
            // Error already handled in create/update methods
        }
    }

    /**
     * Get form data
     */
    getFormData() {
        const form = this.container.querySelector('#routeForm');
        const formData = new FormData(form);
        
        const data = {
            name: formData.get('name').trim(),
            description: formData.get('description').trim(),
            route_type: formData.get('route_type'),
            difficulty_level: parseInt(formData.get('difficulty_level')),
            estimated_duration: parseInt(formData.get('estimated_duration')),
            total_distance: parseFloat(formData.get('total_distance')) || 0,
            elevation_gain: parseInt(formData.get('elevation_gain')) || 0,
            is_circular: formData.get('is_circular') === 'on',
            season_availability: this.getSelectedSeasons(),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
            pois: this.selectedPOIs.map((poi, index) => ({
                poi_id: poi.id,
                order_in_route: index + 1,
                is_mandatory: poi.is_mandatory || true,
                estimated_time_at_poi: poi.estimated_time_at_poi || 30,
                notes: poi.notes || ''
            }))
        };
        
        return data;
    }

    /**
     * Get selected seasons from checkboxes
     */
    getSelectedSeasons() {
        const seasonCheckboxes = this.container.querySelectorAll('input[name="season_availability"]:checked');
        return Array.from(seasonCheckboxes).map(cb => cb.value);
    }

    /**
     * Validate entire form
     */
    validateForm() {
        let isValid = true;
        
        // Validate each field
        const formInputs = this.container.querySelectorAll('#routeForm input, #routeForm textarea, #routeForm select');
        formInputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        // Validate POI selection
        if (this.selectedPOIs.length === 0) {
            this.showFieldError('pois', 'En az bir POI seçmelisiniz');
            isValid = false;
        } else {
            this.clearFieldError('pois');
        }
        
        return isValid;
    }

    /**
     * Validate individual field
     */
    validateField(input) {
        const fieldName = input.name;
        const value = input.value.trim();
        const rules = this.validationRules[fieldName];
        
        if (!rules) return true;
        
        // Required validation
        if (rules.required && !value) {
            this.showFieldError(fieldName, 'Bu alan zorunludur');
            return false;
        }
        
        // Length validation
        if (rules.minLength && value.length < rules.minLength) {
            this.showFieldError(fieldName, `En az ${rules.minLength} karakter olmalıdır`);
            return false;
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
            this.showFieldError(fieldName, `En fazla ${rules.maxLength} karakter olmalıdır`);
            return false;
        }
        
        // Numeric validation
        if (rules.min !== undefined || rules.max !== undefined) {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                this.showFieldError(fieldName, 'Geçerli bir sayı giriniz');
                return false;
            }
            
            if (rules.min !== undefined && numValue < rules.min) {
                this.showFieldError(fieldName, `En az ${rules.min} olmalıdır`);
                return false;
            }
            
            if (rules.max !== undefined && numValue > rules.max) {
                this.showFieldError(fieldName, `En fazla ${rules.max} olmalıdır`);
                return false;
            }
        }
        
        // Clear error if validation passes
        this.clearFieldError(fieldName);
        return true;
    }

    /**
     * Show field validation error
     */
    showFieldError(fieldName, message) {
        const field = this.container.querySelector(`[name="${fieldName}"]`);
        if (!field) return;
        
        field.classList.add('error');
        
        // Remove existing error message
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = message;
        field.parentNode.appendChild(errorEl);
    }

    /**
     * Clear field validation error
     */
    clearFieldError(fieldName) {
        const field = this.container.querySelector(`[name="${fieldName}"]`);
        if (!field) return;
        
        field.classList.remove('error');
        
        const errorEl = field.parentNode.querySelector('.field-error');
        if (errorEl) {
            errorEl.remove();
        }
    }

    /**
     * Populate form with route data
     */
    populateForm(route) {
        const form = this.container.querySelector('#routeForm');
        if (!form) return;
        
        // Basic fields
        form.querySelector('[name="name"]').value = route.name || '';
        form.querySelector('[name="description"]').value = route.description || '';
        form.querySelector('[name="route_type"]').value = route.route_type || '';
        form.querySelector('[name="difficulty_level"]').value = route.difficulty_level || 1;
        form.querySelector('[name="estimated_duration"]').value = route.estimated_duration || '';
        form.querySelector('[name="total_distance"]').value = route.total_distance || '';
        form.querySelector('[name="elevation_gain"]').value = route.elevation_gain || '';
        form.querySelector('[name="is_circular"]').checked = route.is_circular || false;
        form.querySelector('[name="tags"]').value = Array.isArray(route.tags) ? route.tags.join(', ') : (route.tags || '');
        
        // Season availability checkboxes
        const seasonCheckboxes = form.querySelectorAll('[name="season_availability"]');
        seasonCheckboxes.forEach(cb => {
            cb.checked = route.season_availability && route.season_availability.includes(cb.value);
        });
        
        // Update form title
        const formTitle = this.container.querySelector('#routeFormTitle');
        if (formTitle) {
            formTitle.textContent = `Rota Düzenle: ${route.name}`;
        }
        
        // Update submit button
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Rotayı Güncelle';
        }
    }

    /**
     * Clear form
     */
    clearForm() {
        const form = this.container.querySelector('#routeForm');
        if (!form) return;
        
        form.reset();
        
        // Clear validation errors
        const errorElements = form.querySelectorAll('.field-error');
        errorElements.forEach(el => el.remove());
        
        const errorFields = form.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
        
        // Update form title
        const formTitle = this.container.querySelector('#routeFormTitle');
        if (formTitle) {
            formTitle.textContent = 'Yeni Rota Oluştur';
        }
        
        // Update submit button
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Rotayı Oluştur';
        }
        
        this.isDirty = false;
    }

    /**
     * Show form
     */
    showForm() {
        const formSection = this.container.querySelector('#routeFormSection');
        const listSection = this.container.querySelector('#routeListSection');
        
        if (formSection) formSection.style.display = 'block';
        if (listSection) listSection.style.display = 'none';
    }

    /**
     * Hide form
     */
    hideForm() {
        const formSection = this.container.querySelector('#routeFormSection');
        const listSection = this.container.querySelector('#routeListSection');
        
        if (formSection) formSection.style.display = 'none';
        if (listSection) listSection.style.display = 'block';
    }

    /**
     * Cancel form
     */
    cancelForm() {
        if (this.isDirty) {
            if (!confirm('Kaydedilmemiş değişiklikler var. İptal etmek istediğinizden emin misiniz?')) {
                return;
            }
        }
        
        this.clearForm();
        this.hideForm();
        this.selectedPOIs = [];
        this.currentRoute = null;
    }

    /**
     * Render routes table
     */
    renderRoutesTable() {
        const tableContainer = this.container.querySelector('#routesTableContainer');
        if (!tableContainer) return;
        
        if (this.routes.length === 0) {
            tableContainer.innerHTML = `
                <div class="no-routes-message">
                    <i class="fas fa-route" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3>Henüz rota eklenmemiş</h3>
                    <p>İlk rotanızı oluşturmak için "Yeni Rota Ekle" butonuna tıklayın</p>
                </div>
            `;
            return;
        }
        
        const tableHTML = `
            <table class="routes-table">
                <thead>
                    <tr>
                        <th>Rota Adı</th>
                        <th>Tip</th>
                        <th>Zorluk</th>
                        <th>Süre</th>
                        <th>Mesafe</th>
                        <th>POI Sayısı</th>
                        <th>Durum</th>
                        <th>İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.routes.map(route => this.renderRouteRow(route)).join('')}
                </tbody>
            </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
        this.attachTableListeners();
    }

    /**
     * Render single route row
     */
    renderRouteRow(route) {
        const duration = Math.round(route.estimated_duration / 60) || 0;
        const distance = route.total_distance || 0;
        const poiCount = route.poi_count || 0;
        const difficultyStars = '★'.repeat(route.difficulty_level) + '☆'.repeat(5 - route.difficulty_level);
        
        return `
            <tr data-route-id="${route.id}">
                <td>
                    <div class="route-name">${route.name}</div>
                    <div class="route-description-short">${this.truncateText(route.description, 50)}</div>
                </td>
                <td>
                    <span class="route-type-badge">${this.getRouteTypeLabel(route.route_type)}</span>
                </td>
                <td>
                    <span title="Zorluk: ${route.difficulty_level}/5">${difficultyStars}</span>
                </td>
                <td>${duration} saat</td>
                <td>${distance.toFixed(2)} km</td>
                <td>${poiCount}</td>
                <td>
                    <span class="status-badge ${route.is_active ? 'active' : 'inactive'}">
                        ${route.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline edit-route-btn" data-route-id="${route.id}" title="Düzenle">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline preview-route-btn" data-route-id="${route.id}" title="Önizle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-route-btn" data-route-id="${route.id}" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Attach table event listeners
     */
    attachTableListeners() {
        // Edit buttons
        const editButtons = this.container.querySelectorAll('.edit-route-btn');
        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = parseInt(btn.dataset.routeId);
                this.showEditRouteForm(routeId);
            });
        });

        // Delete buttons
        const deleteButtons = this.container.querySelectorAll('.delete-route-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = parseInt(btn.dataset.routeId);
                this.deleteRoute(routeId);
            });
        });

        // Preview buttons
        const previewButtons = this.container.querySelectorAll('.preview-route-btn');
        previewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = parseInt(btn.dataset.routeId);
                this.previewRoute(routeId);
            });
        });
    }

    /**
     * Render POIs list for selection
     */
    renderPOIsList() {
        const poisContainer = this.container.querySelector('#availablePOIsList');
        if (!poisContainer) return;
        
        if (this.availablePOIs.length === 0) {
            poisContainer.innerHTML = '<p class="no-pois">POI bulunamadı</p>';
            return;
        }
        
        const poisHTML = this.availablePOIs.map(poi => `
            <div class="poi-item" data-poi-id="${poi.id}">
                <div class="poi-info">
                    <h4>${poi.name}</h4>
                    <p>${poi.description || 'Açıklama yok'}</p>
                    <span class="poi-category">${poi.category}</span>
                </div>
                <button class="btn btn-sm btn-primary add-poi-btn" data-poi-id="${poi.id}">
                    <i class="fas fa-plus"></i> Ekle
                </button>
            </div>
        `).join('');
        
        poisContainer.innerHTML = poisHTML;
        this.attachPOIListeners();
    }

    /**
     * Render selected POIs with drag-and-drop ordering
     */
    renderSelectedPOIs() {
        const selectedContainer = this.container.querySelector('#selectedPOIsList');
        if (!selectedContainer) return;
        
        if (this.selectedPOIs.length === 0) {
            selectedContainer.innerHTML = '<p class="no-selected-pois">Henüz POI seçilmemiş</p>';
            return;
        }
        
        const selectedHTML = this.selectedPOIs.map((poi, index) => `
            <div class="selected-poi-item" data-poi-id="${poi.id}" draggable="true">
                <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="poi-order">${index + 1}</div>
                <div class="poi-info">
                    <h4>${poi.name}</h4>
                    <span class="poi-category">${poi.category}</span>
                </div>
                <div class="poi-controls">
                    <input type="number" class="poi-time-input" value="${poi.estimated_time_at_poi || 30}" 
                           min="5" max="300" title="Tahmini süre (dakika)">
                    <button class="btn btn-sm btn-danger remove-poi-btn" data-poi-id="${poi.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        selectedContainer.innerHTML = selectedHTML;
        this.attachSelectedPOIListeners();
        this.setupDragAndDrop();
    }

    /**
     * Attach POI list event listeners
     */
    attachPOIListeners() {
        const addButtons = this.container.querySelectorAll('.add-poi-btn');
        addButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const poiId = parseInt(btn.dataset.poiId);
                this.addPOIToRoute(poiId);
            });
        });
    }

    /**
     * Attach selected POI event listeners
     */
    attachSelectedPOIListeners() {
        // Remove buttons
        const removeButtons = this.container.querySelectorAll('.remove-poi-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const poiId = parseInt(btn.dataset.poiId);
                this.removePOIFromRoute(poiId);
            });
        });

        // Time inputs
        const timeInputs = this.container.querySelectorAll('.poi-time-input');
        timeInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const poiId = parseInt(e.target.closest('.selected-poi-item').dataset.poiId);
                const time = parseInt(e.target.value);
                this.updatePOITime(poiId, time);
            });
        });
    }

    /**
     * Setup drag and drop for POI ordering
     */
    setupDragAndDrop() {
        const selectedContainer = this.container.querySelector('#selectedPOIsList');
        if (!selectedContainer) return;

        let draggedElement = null;

        selectedContainer.addEventListener('dragstart', (e) => {
            draggedElement = e.target.closest('.selected-poi-item');
            e.dataTransfer.effectAllowed = 'move';
            draggedElement.classList.add('dragging');
        });

        selectedContainer.addEventListener('dragend', (e) => {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
                draggedElement = null;
            }
        });

        selectedContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        selectedContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!draggedElement) return;
            
            const dropTarget = e.target.closest('.selected-poi-item');
            if (!dropTarget || dropTarget === draggedElement) return;
            
            // Reorder POIs
            const draggedId = parseInt(draggedElement.dataset.poiId);
            const targetId = parseInt(dropTarget.dataset.poiId);
            
            this.reorderPOIs(draggedId, targetId);
        });
    }

    /**
     * Add POI to route
     */
    addPOIToRoute(poiId) {
        const poi = this.availablePOIs.find(p => p.id === poiId);
        if (!poi) return;
        
        // Check if already selected
        if (this.selectedPOIs.find(p => p.id === poiId)) {
            this.showNotification('Bu POI zaten seçilmiş', 'warning');
            return;
        }
        
        // Add with default values
        const poiWithDefaults = {
            ...poi,
            estimated_time_at_poi: 30,
            is_mandatory: true,
            notes: ''
        };
        
        this.selectedPOIs.push(poiWithDefaults);
        this.renderSelectedPOIs();
        this.isDirty = true;
        
        console.log('✅ POI added to route:', poi.name);
    }

    /**
     * Remove POI from route
     */
    removePOIFromRoute(poiId) {
        this.selectedPOIs = this.selectedPOIs.filter(p => p.id !== poiId);
        this.renderSelectedPOIs();
        this.isDirty = true;
        
        console.log('➖ POI removed from route:', poiId);
    }

    /**
     * Update POI estimated time
     */
    updatePOITime(poiId, time) {
        const poi = this.selectedPOIs.find(p => p.id === poiId);
        if (poi) {
            poi.estimated_time_at_poi = time;
            this.isDirty = true;
        }
    }

    /**
     * Reorder POIs via drag and drop
     */
    reorderPOIs(draggedId, targetId) {
        const draggedIndex = this.selectedPOIs.findIndex(p => p.id === draggedId);
        const targetIndex = this.selectedPOIs.findIndex(p => p.id === targetId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        // Move dragged item to target position
        const [draggedPOI] = this.selectedPOIs.splice(draggedIndex, 1);
        this.selectedPOIs.splice(targetIndex, 0, draggedPOI);
        
        this.renderSelectedPOIs();
        this.isDirty = true;
        
        console.log('🔄 POIs reordered');
    }

    /**
     * Filter POIs by search term
     */
    filterPOIs(searchTerm) {
        const poisItems = this.container.querySelectorAll('#availablePOIsList .poi-item');
        const term = searchTerm.toLowerCase();
        
        poisItems.forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            const description = item.querySelector('p').textContent.toLowerCase();
            const category = item.querySelector('.poi-category').textContent.toLowerCase();
            
            const matches = name.includes(term) || description.includes(term) || category.includes(term);
            item.style.display = matches ? 'block' : 'none';
        });
    }

    /**
     * Preview route
     */
    previewRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        
        // Use RouteSelectionManager to show route details
        if (window.RouteSelectionManager) {
            const routeManager = new RouteSelectionManager('routePreviewContainer');
            routeManager.displayRouteDetails(routeId);
        } else {
            this.showNotification('Rota önizleme özelliği yüklenemedi', 'error');
        }
    }

    /**
     * Show loading state for routes table
     */
    showRoutesLoadingState() {
        const tableContainer = this.container.querySelector('#routesTableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #007bff;"></i>
                    <p>Rotalar yükleniyor...</p>
                </div>
            `;
        }
    }

    /**
     * Show error state for routes table
     */
    showRoutesErrorState(message) {
        const tableContainer = this.container.querySelector('#routesTableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #dc3545; margin-bottom: 1rem;"></i>
                    <h3>Rotalar yüklenemedi</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="routeAdminManager.loadRoutes()">
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
     * Truncate text
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * Refresh routes list
     */
    refresh() {
        this.loadRoutes();
    }
}

// Export for use in other modules
window.RouteAdminManager = RouteAdminManager;
