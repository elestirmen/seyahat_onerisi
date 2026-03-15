(function (global) {
    'use strict';

    const normalizeTags = (tags) => {
        if (!tags) return [];
        if (Array.isArray(tags)) return tags.map(tag => String(tag).trim()).filter(Boolean);
        if (typeof tags === 'string') return tags.split(',').map(tag => tag.trim()).filter(Boolean);
        return [String(tags).trim()].filter(Boolean);
    };

    const findCategory = (categories, categoryValue) => (
        Array.isArray(categories)
            ? categories.find(category =>
                (category.id && category.id === categoryValue) || category.name === categoryValue
            )
            : null
    );

    const formatCoordinate = (value) => {
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric.toFixed(6) : '0.000000';
    };

    const buildRatingSliderMarkup = (ratingCategories, values, prefix) => (
        Object.entries(ratingCategories).map(([key, category]) => {
            const numericValue = Number.isFinite(Number(values[key])) ? Number(values[key]) : 0;
            return `
                <div class="rating-item-edit">
                    <div class="rating-label" style="color: ${category.color}">
                        <i class="${category.icon}"></i>
                        ${category.label}
                    </div>
                    <div class="rating-slider-container">
                        <input type="range" class="rating-slider" min="0" max="100"
                               value="${numericValue}" id="${prefix}_${key}"
                               style="background: linear-gradient(to right, ${category.color} 0%, ${category.color} ${numericValue}%, var(--poi-border) ${numericValue}%, var(--poi-border) 100%);">
                        <span class="rating-display" id="${prefix}_${key}_display">${numericValue}</span>
                    </div>
                </div>
            `;
        }).join('')
    );

    const attachRatingSliderListeners = (keys, prefix, onInput) => {
        keys.forEach(key => {
            const slider = document.getElementById(`${prefix}_${key}`);
            if (slider) {
                slider.addEventListener('input', (event) => {
                    onInput(key, event.target.value);
                });
            }
        });
    };

    const collectRatings = (keys, prefix) => keys.reduce((ratings, key) => {
        const ratingElement = document.getElementById(`${prefix}_${key}`);
        if (ratingElement) {
            ratings[key] = Number.parseInt(ratingElement.value, 10) || 0;
        }
        return ratings;
    }, {});

    const getPOIIdentifier = (poi) => poi?.id || poi?._id || poi?.poi_id || null;

    const normalizeSelectedPOI = (poi) => {
        if (!poi || typeof poi !== 'object') return null;
        const id = getPOIIdentifier(poi);
        return id ? { ...poi, id } : { ...poi };
    };

    const getPOIText = (value, fallback = '') => String(value ?? fallback);

    const POIManagerPOIMethods = {
        createPOIElement(poi) {
            if (!poi) {
                console.warn('Invalid POI data:', poi);
                return document.createElement('div');
            }

            const element = document.createElement('div');
            const poiId = getPOIIdentifier(poi) || '';
            element.className = 'poi-item';
            element.dataset.poiId = poiId;

            const category = findCategory(this.categories, poi.category);
            const categoryName = category ? (category.display_name || category.name) : (poi.category || 'Kategori yok');
            const categoryIcon = category ? category.icon : 'map-marker-alt';
            const categoryColor = category ? category.color : '#6c757d';
            const averageRating = this.calculateAverageRating(poi.ratings);
            const safeName = this.escapeHtml(getPOIText(poi.name, 'İsimsiz POI'));
            const safeCategoryName = this.escapeHtml(getPOIText(categoryName, 'Kategori yok'));
            const safeTags = normalizeTags(poi.tags);

            element.innerHTML = `
                <div class="poi-item-header">
                    <div class="poi-item-title-section">
                        <i class="fas fa-${categoryIcon} poi-category-icon" style="color: ${categoryColor}"></i>
                        <h4 class="poi-item-title">${safeName}</h4>
                    </div>
                    <span class="poi-item-category" style="color: ${categoryColor}">${safeCategoryName}</span>
                </div>
                <div class="poi-item-meta">
                    <div class="poi-item-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${formatCoordinate(poi.latitude)}, ${formatCoordinate(poi.longitude)}</span>
                    </div>
                    ${averageRating > 0 ? `
                        <div class="poi-item-rating">
                            <i class="fas fa-star"></i>
                            <span>${averageRating}/100</span>
                            <div class="rating-bar">
                                <div class="rating-fill" style="width: ${averageRating}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${safeTags.length > 0 ? `
                        <div class="poi-item-tags">
                            ${safeTags.slice(0, 3).map(tag => `<span class="poi-tag">${this.escapeHtml(tag)}</span>`).join('')}
                            ${safeTags.length > 3 ? `<span class="poi-tag">+${safeTags.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;

            element.addEventListener('click', () => this.selectPOI(poi));
            return element;
        },

        selectPOI(poi) {
            if (!poi) return;

            document.querySelectorAll('.poi-item.selected').forEach(item => {
                item.classList.remove('selected');
            });

            const normalizedPOI = normalizeSelectedPOI(poi);
            const poiId = getPOIIdentifier(normalizedPOI);
            const poiElement = poiId ? document.querySelector(`[data-poi-id="${poiId}"]`) : null;
            if (poiElement) {
                poiElement.classList.add('selected');
            }

            this.selectedPOI = normalizedPOI;

            if (this.map) {
                const latitude = Number.parseFloat(poi.latitude);
                const longitude = Number.parseFloat(poi.longitude);
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    this.map.setView([latitude, longitude], 15);

                    Object.values(this.markers).forEach(marker => {
                        marker.setOpacity(0.6);
                    });

                    const marker = poiId ? this.markers[poiId] : null;
                    if (marker) {
                        marker.setOpacity(1);
                    }
                }
            }

            this.showPOIDetails(this.selectedPOI);
        },

        updateMapMarkers() {
            if (!this.map) return;

            Object.values(this.markers).forEach(marker => {
                this.map.removeLayer(marker);
            });
            this.markers = {};

            if (!Array.isArray(this.pois)) {
                console.warn('POIs is not an array in updateMapMarkers:', this.pois);
                return;
            }

            this.pois.forEach(poi => {
                const latitude = Number.parseFloat(poi?.latitude);
                const longitude = Number.parseFloat(poi?.longitude);
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    return;
                }

                const category = findCategory(this.categories, poi.category);
                const categoryIcon = category ? category.icon : 'map-marker-alt';
                const categoryColor = category ? category.color : '#2563eb';
                const categoryName = category ? (category.display_name || category.name) : (poi.category || 'Kategori yok');
                const poiName = this.escapeHtml(getPOIText(poi.name, 'İsimsiz POI'));
                const description = getPOIText(poi.description);
                const descriptionSnippet = description.length > 100 ? `${description.slice(0, 100)}...` : description;
                const has360 = this.poiHas360Tag(poi);

                const customIcon = L.divIcon({
                    className: 'custom-poi-marker',
                    html: `
                        <div class="poi-marker-container" style="background-color: ${categoryColor}">
                            <i class="fas fa-${categoryIcon}"></i>
                            ${has360 ? '<div class="poi-badge-360">360°</div>' : ''}
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15]
                });

                const marker = L.marker([latitude, longitude], { icon: customIcon })
                    .bindPopup(`
                        <div class="poi-popup">
                            <div class="poi-popup-header">
                                <i class="fas fa-${categoryIcon}" style="color: ${categoryColor}"></i>
                                <strong>${poiName}</strong>
                            </div>
                            <div class="poi-popup-category">${this.escapeHtml(categoryName)}</div>
                            ${descriptionSnippet ? `<div class="poi-popup-description">${this.escapeHtml(descriptionSnippet)}</div>` : ''}
                            ${this.generatePopupRating(poi)}
                        </div>
                    `)
                    .addTo(this.map);

                marker.on('click', () => this.selectPOI(poi));
                const markerKey = getPOIIdentifier(poi);
                if (markerKey) {
                    this.markers[markerKey] = marker;
                }
            });
        },

        poiHas360Tag(poi) {
            try {
                return normalizeTags(poi?.tags).some(tag => /(360|pano|panorama)/i.test(tag));
            } catch (_) {
                return false;
            }
        },

        showPOIDetails(poi) {
            if (!poi) return;

            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('poiDetailView').classList.add('active');
            document.getElementById('poiEditForm').classList.remove('active');

            this.populatePOIDetails(poi);

            const poiId = getPOIIdentifier(poi);
            if (poiId) {
                this.loadPOIMedia(poiId);
                this.loadPOIRatings(poiId);
            }
        },

        populatePOIDetails(poi) {
            const category = findCategory(this.categories, poi.category);
            const categoryName = category ? (category.display_name || category.name) : (poi.category || 'Kategori yok');
            const safeName = getPOIText(poi.name, 'İsimsiz POI');

            document.getElementById('poiDetailTitle').textContent = safeName;
            document.getElementById('poiDetailCategory').textContent = categoryName;

            const basicInfo = document.getElementById('poiBasicInfo');
            basicInfo.innerHTML = `
                <div class="poi-info-item">
                    <div class="poi-info-label">
                        <i class="fas fa-map-marker-alt"></i>
                        Konum
                    </div>
                    <div class="poi-info-value">${formatCoordinate(poi.latitude)}, ${formatCoordinate(poi.longitude)}</div>
                </div>
                <div class="poi-info-item">
                    <div class="poi-info-label">
                        <i class="fas fa-list"></i>
                        Kategori
                    </div>
                    <div class="poi-info-value">${this.escapeHtml(categoryName)}</div>
                </div>
                ${poi.description ? `
                    <div class="poi-info-item" style="grid-column: 1 / -1;">
                        <div class="poi-info-label">
                            <i class="fas fa-align-left"></i>
                            Açıklama
                        </div>
                        <div class="poi-info-value">${this.escapeHtml(getPOIText(poi.description))}</div>
                    </div>
                ` : ''}
            `;

            const tagsSection = document.getElementById('poiTagsSection');
            const tagsContainer = document.getElementById('poiTagsContainer');
            const tags = normalizeTags(poi.tags);

            if (tags.length > 0) {
                tagsSection.style.display = 'block';
                tagsContainer.innerHTML = tags.map(tag => (
                    `<span class="poi-tag-large">${this.escapeHtml(tag)}</span>`
                )).join('');
            } else {
                tagsSection.style.display = 'none';
            }

            this.displayPOIRatings(poi);
        },

        async loadPOIRatings(poiId) {
            if (!poiId) return;

            try {
                const response = await this.authenticatedFetch(`/api/poi/${poiId}/ratings`);
                if (response.ok) {
                    const payload = await response.json();
                    this.renderPOIRatings(payload);
                }
            } catch (error) {
                console.error('Error loading POI ratings:', error);
            }
        },

        renderPOIRatings(payload) {
            const normalizedRatings = this.normalizeRatingsPayload(payload);
            if (this.selectedPOI) {
                this.selectedPOI = { ...this.selectedPOI, ratings: normalizedRatings };
                this.displayPOIRatings(this.selectedPOI);
                return;
            }
            this.displayPOIRatings({ ratings: normalizedRatings });
        },

        async showEditForm(poi) {
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('poiDetailView').classList.remove('active');
            document.getElementById('poiEditForm').classList.add('active');

            await this.populateEditForm(poi);
        },

        async populateEditForm(poi) {
            document.getElementById('editName').value = poi.name || '';
            document.getElementById('editLatitude').value = poi.latitude || '';
            document.getElementById('editLongitude').value = poi.longitude || '';
            document.getElementById('editDescription').value = poi.description || '';
            document.getElementById('editTags').value = normalizeTags(poi.tags).join(', ');

            if (!this.categories || this.categories.length === 0) {
                await this.loadCategories();
            }

            const categorySelect = document.getElementById('editCategory');
            if (!categorySelect) {
                console.error('editCategory element not found');
                return;
            }

            if (!this.populateCategorySelect(categorySelect, poi.category)) {
                console.warn('No categories available after loading');
                return;
            }

            const poiId = getPOIIdentifier(poi);
            if (poiId) {
                this.loadPOIRatingsForEdit(poiId);
                this.loadPOIMedia(poiId);
            } else {
                console.warn('POI has no ID, showing empty ratings');
                this.renderEditRatings({});
            }
        },

        async loadPOIRatingsForEdit(poiId) {
            try {
                if (this.selectedPOI && this.selectedPOI.ratings) {
                    this.renderEditRatings(this.selectedPOI.ratings);
                    return;
                }

                const response = await this.authenticatedFetch(`/api/poi/${poiId}/ratings`);
                if (response.ok) {
                    const data = await response.json();
                    const ratings = this.normalizeRatingsPayload(data);
                    if (this.selectedPOI) {
                        this.selectedPOI = { ...this.selectedPOI, ratings };
                    }
                    this.renderEditRatings(ratings);
                } else {
                    console.warn('Ratings API failed, using empty ratings');
                    this.renderEditRatings({});
                }
            } catch (error) {
                console.error('Error loading POI ratings for edit:', error);
                this.renderEditRatings({});
            }
        },

        renderEditRatings(ratings) {
            const ratingsGrid = document.getElementById('editRatingsGrid');
            const normalizedRatings = this.normalizeRatingsPayload(ratings);
            const ratingCategories = this.getRatingCategories();

            if (!ratingsGrid) {
                console.error('editRatingsGrid element not found');
                return;
            }

            ratingsGrid.innerHTML = buildRatingSliderMarkup(ratingCategories, normalizedRatings, 'rating');
            attachRatingSliderListeners(this.getRatingKeys(), 'rating', (key, value) => {
                this.updateRatingDisplay(key, value);
            });
        },

        hideWorkspace() {
            document.getElementById('emptyState').style.display = 'flex';
            document.getElementById('poiDetailView').classList.remove('active');
            document.getElementById('poiEditForm').classList.remove('active');
            this.selectedPOI = null;
        },

        async savePOI() {
            const selectedPOIId = getPOIIdentifier(this.selectedPOI);
            if (!selectedPOIId) {
                console.error('savePOI called without a valid selectedPOI.id', this.selectedPOI);
                this.showToast('Geçersiz POI seçimi. Lütfen listeden bir POI seçin.', 'error');
                return;
            }

            const formData = {
                name: document.getElementById('editName').value.trim(),
                category: document.getElementById('editCategory').value,
                latitude: Number.parseFloat(document.getElementById('editLatitude').value),
                longitude: Number.parseFloat(document.getElementById('editLongitude').value),
                description: document.getElementById('editDescription').value,
                tags: normalizeTags(document.getElementById('editTags').value)
            };

            if (!formData.name || !formData.category || !Number.isFinite(formData.latitude) || !Number.isFinite(formData.longitude)) {
                this.showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
                return;
            }

            const ratings = collectRatings(this.getRatingKeys(), 'rating');

            try {
                const poiResponse = await this.authenticatedFetch(`/api/poi/${selectedPOIId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (!poiResponse.ok) {
                    throw new Error('POI güncellenemedi');
                }

                const ratingsResponse = await this.authenticatedFetch(`/api/poi/${selectedPOIId}/ratings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ratings })
                });

                if (!ratingsResponse.ok) {
                    const ratingsError = await ratingsResponse.text();
                    console.warn('Ratings could not be updated:', ratingsError);
                    this.showToast('POI güncellendi ama puanlar kaydedilemedi', 'warning');
                }

                await this.loadPOIs();

                const updatedPOI = {
                    ...this.selectedPOI,
                    ...formData,
                    id: selectedPOIId,
                    ratings: this.normalizeRatingsPayload(ratings)
                };
                this.selectedPOI = updatedPOI;
                this.showPOIDetails(updatedPOI);

                this.showToast('POI başarıyla güncellendi', 'success');
            } catch (error) {
                console.error('Error saving POI:', error);
                this.showToast('POI güncellenirken hata oluştu', 'error');
            }
        },

        async deletePOI() {
            const selectedPOIId = getPOIIdentifier(this.selectedPOI);
            if (!selectedPOIId) return;

            if (!confirm(`"${this.selectedPOI.name}" POI'sini silmek istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                const response = await this.authenticatedFetch(`/api/poi/${selectedPOIId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('POI silinemedi');
                }

                await this.loadPOIs();
                this.hideWorkspace();
                this.showToast('POI başarıyla silindi', 'success');
            } catch (error) {
                console.error('Error deleting POI:', error);
                this.showToast('POI silinirken hata oluştu', 'error');
            }
        },

        showCreatePOIModal() {
            this.populateCreateCategoryDropdown();
            this.setupCreateRatingSliders();

            const modal = new bootstrap.Modal(document.getElementById('createPOIModal'));
            modal.show();
        },

        showCreatePOIModalWithCoordinates(lat, lng) {
            this.populateCreateCategoryDropdown();
            this.setupCreateRatingSliders();

            document.getElementById('createLatitude').value = formatCoordinate(lat);
            document.getElementById('createLongitude').value = formatCoordinate(lng);

            const modal = new bootstrap.Modal(document.getElementById('createPOIModal'));
            modal.show();

            this.showToast('Koordinatlar otomatik dolduruldu. POI bilgilerini tamamlayın.', 'info');
        },

        populateCreateCategoryDropdown() {
            const categorySelect = document.getElementById('createCategory');
            this.populateCategorySelect(categorySelect);
        },

        setupCreateRatingSliders() {
            const ratingsGrid = document.getElementById('createRatingsGrid');
            const ratingCategories = this.getRatingCategories();

            if (!ratingsGrid) return;

            ratingsGrid.innerHTML = buildRatingSliderMarkup(ratingCategories, {}, 'create_rating');
            attachRatingSliderListeners(this.getRatingKeys(), 'create_rating', (key, value) => {
                this.updateCreateRatingDisplay(key, value);
            });
        },

        updateCreateRatingDisplay(category, value) {
            const displayElement = document.getElementById(`create_rating_${category}_display`);
            const sliderElement = document.getElementById(`create_rating_${category}`);

            if (displayElement) {
                displayElement.textContent = value;
            }

            if (sliderElement) {
                const color = this.getRatingCategories()[category]?.color || 'var(--poi-primary)';
                sliderElement.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${value}%, var(--poi-border) ${value}%, var(--poi-border) 100%)`;
            }
        },

        async createPOI() {
            const formData = {
                name: document.getElementById('createName').value.trim(),
                category: document.getElementById('createCategory').value,
                latitude: Number.parseFloat(document.getElementById('createLatitude').value),
                longitude: Number.parseFloat(document.getElementById('createLongitude').value),
                description: document.getElementById('createDescription').value,
                tags: normalizeTags(document.getElementById('createTags').value)
            };

            if (!formData.name || !formData.category || !Number.isFinite(formData.latitude) || !Number.isFinite(formData.longitude)) {
                this.showToast('Lütfen tüm zorunlu alanları doldurun', 'error');
                return;
            }

            const ratings = collectRatings(this.getRatingKeys(), 'create_rating');

            try {
                const poiResponse = await this.authenticatedFetch('/api/poi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (!poiResponse.ok) {
                    throw new Error('POI oluşturulamadı');
                }

                const newPOI = await poiResponse.json();
                if (newPOI.id) {
                    try {
                        await this.authenticatedFetch(`/api/poi/${newPOI.id}/ratings`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ ratings })
                        });
                    } catch (error) {
                        console.warn('Ratings could not be saved:', error);
                    }
                }

                const modal = bootstrap.Modal.getInstance(document.getElementById('createPOIModal'));
                if (modal) {
                    modal.hide();
                }

                document.getElementById('createPOIForm').reset();
                this.setupCreateRatingSliders();
                await this.loadPOIs();

                this.showToast('POI başarıyla oluşturuldu!', 'success');
            } catch (error) {
                console.error('POI creation error:', error);
                this.showToast('POI oluşturulurken hata oluştu: ' + error.message, 'error');
            }
        },

        displayPOIRatings(poi) {
            const ratingsSection = document.getElementById('poiRatingsSection');
            const ratingsContainer = document.getElementById('poiRatingsContainer');
            const ratingCategories = this.getRatingCategories();
            const ratings = this.normalizeRatingsPayload(poi);

            if (!ratingsSection || !ratingsContainer) return;
            ratingsSection.style.display = 'block';

            const ratingsHTML = Object.entries(ratingCategories).map(([key, category]) => {
                const rating = ratings[key] || 0;
                return `
                    <div class="rating-item-display">
                        <div class="rating-label" style="color: ${category.color}">
                            ${category.displayName}
                        </div>
                        <div class="rating-bar-container">
                            <div class="rating-bar-bg">
                                <div class="rating-bar-fill" style="width: ${rating}%; background: ${category.color}"></div>
                            </div>
                            <span class="rating-value">${rating}</span>
                        </div>
                    </div>
                `;
            }).join('');

            const averageRating = this.calculateAverageRating(ratings);
            const summaryLabel = averageRating > 0 ? 'Ortalama Puan' : 'Henüz Puanlanmamış';

            ratingsContainer.innerHTML = `
                <div class="ratings-summary">
                    <div class="average-rating">
                        <div class="average-score">${averageRating}</div>
                        <div class="average-label">${summaryLabel}</div>
                        <div class="rating-stars">
                            ${this.generateStars(averageRating)}
                        </div>
                    </div>
                </div>
                <div class="ratings-breakdown">
                    ${ratingsHTML}
                </div>
            `;
        },

        generateStars(rating) {
            const starCount = Math.round(rating / 20);
            let starsHTML = '';

            for (let i = 1; i <= 5; i++) {
                starsHTML += i <= starCount ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            }

            return starsHTML;
        },

        generatePopupRating(poi) {
            const averageRating = this.calculateAverageRating(poi);
            if (averageRating === 0) {
                return '';
            }

            return `
                <div class="poi-popup-rating">
                    <span class="poi-popup-stars">${this.generateStars(averageRating)}</span>
                    <span>${averageRating}/100</span>
                </div>
            `;
        },

        updateRatingDisplay(category, value) {
            const displayElement = document.getElementById(`rating_${category}_display`);
            const sliderElement = document.getElementById(`rating_${category}`);

            if (displayElement) {
                displayElement.textContent = value;
            }

            if (sliderElement) {
                const color = this.getRatingCategories()[category]?.color || 'var(--poi-primary)';
                sliderElement.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${value}%, var(--poi-border) ${value}%, var(--poi-border) 100%)`;
            }
        }
    };

    global.POIManagerPOIMethods = POIManagerPOIMethods;
})(window);
