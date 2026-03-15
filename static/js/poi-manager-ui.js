(function (global) {
    'use strict';

    const POIManagerUIMethods = {
        renderCategoryFilter() {
            const categoryFilter = document.getElementById('categoryFilter');
            if (!categoryFilter) return;

            categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>';

            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id || category.name;
                option.textContent = category.display_name || category.name;
                categoryFilter.appendChild(option);
            });
        },

        renderCategoryChips() {
            const categoryChips = document.getElementById('categoryChips');
            if (!categoryChips) return;

            categoryChips.innerHTML = '';

            this.categories.forEach(category => {
                const chip = document.createElement('div');
                chip.className = 'category-chip';
                chip.textContent = category.display_name || category.name;
                chip.dataset.categoryId = category.id || category.name;

                if (this.currentFilters.category === (category.id || category.name)) {
                    chip.classList.add('active');
                }

                chip.addEventListener('click', () => this.toggleCategoryChip(category.id || category.name));
                categoryChips.appendChild(chip);
            });
        },

        toggleCategoryChip(categoryId) {
            if (this.currentFilters.category === categoryId) {
                this.currentFilters.category = '';
            } else {
                this.currentFilters.category = categoryId;
            }

            document.querySelectorAll('#categoryChips .category-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.categoryId === this.currentFilters.category);
            });

            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.value = this.currentFilters.category;
            }

            this.currentPage = 1;
            this.loadPOIs();
        },

        sortPOIs() {
            const sortOption = this.currentFilters.sort;
            const getDate = (poi) => new Date(poi.created_at || poi.createdAt || poi.created || 0);

            switch (sortOption) {
                case 'name_asc':
                    this.pois.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    break;
                case 'name_desc':
                    this.pois.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
                    break;
                case 'category_asc':
                    this.pois.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
                    break;
                case 'created_desc':
                    this.pois.sort((a, b) => getDate(b) - getDate(a));
                    break;
                case 'created_asc':
                    this.pois.sort((a, b) => getDate(a) - getDate(b));
                    break;
                default:
                    break;
            }
        },

        renderPOIList() {
            const container = document.getElementById('poiListContainer');
            if (!container) return;

            if (!Array.isArray(this.pois)) {
                console.warn('POIs is not an array:', this.pois);
                this.pois = [];
            }

            if (this.pois.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h4>POI Bulunamadı</h4>
                        <p>Arama kriterlerinize uygun POI bulunamadı</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            this.pois.forEach(poi => {
                const poiElement = this.createPOIElement(poi);
                container.appendChild(poiElement);
            });
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = String(text ?? '');
            return div.innerHTML;
        },

        renderPagination() {
            const paginationContainer = document.getElementById('paginationContainer');
            const paginationInfo = document.getElementById('paginationInfo');
            const paginationControls = document.getElementById('paginationControls');

            if (!paginationContainer || !paginationInfo || !paginationControls) return;

            if (this.totalPages <= 1) {
                paginationContainer.style.display = 'none';
                return;
            }

            paginationContainer.style.display = 'block';

            const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
            const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
            paginationInfo.textContent = `${startItem}-${endItem} / ${this.totalItems} POI`;

            paginationControls.innerHTML = '';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'pagination-btn';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
            paginationControls.appendChild(prevBtn);

            const startPage = Math.max(1, this.currentPage - 2);
            const endPage = Math.min(this.totalPages, this.currentPage + 2);

            for (let page = startPage; page <= endPage; page++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'pagination-btn';
                pageBtn.textContent = page;

                if (page === this.currentPage) {
                    pageBtn.classList.add('active');
                }

                pageBtn.addEventListener('click', () => this.goToPage(page));
                paginationControls.appendChild(pageBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtn.className = 'pagination-btn';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.disabled = this.currentPage === this.totalPages;
            nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
            paginationControls.appendChild(nextBtn);
        },

        goToPage(page) {
            if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
                this.currentPage = page;
                this.loadPOIs();
            }
        },

        setupEventListeners() {
            const searchInput = document.getElementById('poiSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        this.currentFilters.search = event.target.value;
                        this.currentPage = 1;
                        this.loadPOIs();
                    }, 800);
                });
            }

            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.addEventListener('change', (event) => {
                    this.currentFilters.category = event.target.value;
                    document.querySelectorAll('#categoryChips .category-chip').forEach(chip => {
                        chip.classList.toggle('active', chip.dataset.categoryId === this.currentFilters.category);
                    });
                    this.currentPage = 1;
                    this.loadPOIs();
                });
            }

            const sortFilter = document.getElementById('sortFilter');
            if (sortFilter) {
                sortFilter.addEventListener('change', (event) => {
                    this.currentFilters.sort = event.target.value;
                    this.currentPage = 1;
                    this.loadPOIs();
                });
            }

            const editPOIBtn = document.getElementById('editPOIBtn');
            if (editPOIBtn) {
                editPOIBtn.addEventListener('click', async () => {
                    if (this.selectedPOI) {
                        await this.showEditForm(this.selectedPOI);
                    }
                });
            }

            const deletePOIBtn = document.getElementById('deletePOIBtn');
            if (deletePOIBtn) {
                deletePOIBtn.addEventListener('click', () => {
                    this.deletePOI();
                });
            }

            const cancelEditBtn = document.getElementById('cancelEditBtn');
            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => {
                    if (this.selectedPOI) {
                        this.showPOIDetails(this.selectedPOI);
                    } else {
                        this.hideWorkspace();
                    }
                });
            }

            const cancelFormBtn = document.getElementById('cancelFormBtn');
            if (cancelFormBtn) {
                cancelFormBtn.addEventListener('click', () => {
                    if (this.selectedPOI) {
                        this.showPOIDetails(this.selectedPOI);
                    } else {
                        this.hideWorkspace();
                    }
                });
            }

            const deleteFormBtn = document.getElementById('deleteFormBtn');
            if (deleteFormBtn) {
                deleteFormBtn.addEventListener('click', () => {
                    this.deletePOI();
                });
            }

            const editForm = document.getElementById('editForm');
            if (editForm) {
                editForm.addEventListener('submit', (event) => {
                    event.preventDefault();
                    this.savePOI();
                });
            }

            const togglePanos = document.getElementById('togglePanoramas');
            if (togglePanos) {
                togglePanos.addEventListener('change', async (event) => {
                    if (event.target.checked) {
                        await this.loadPanoramas();
                    } else if (this.panoramaLayer) {
                        this.panoramaLayer.clearLayers();
                    }
                });
            }

            const uploadPanoBtn = document.getElementById('uploadPanoBtn');
            if (uploadPanoBtn) {
                uploadPanoBtn.addEventListener('click', () => this.uploadPanorama());
            }
        },

        showLoading(show) {
            const loadingState = document.getElementById('loadingState');
            const poiListContainer = document.getElementById('poiListContainer');

            if (!loadingState || !poiListContainer) return;

            if (show) {
                loadingState.style.display = 'flex';
                Array.from(poiListContainer.children).forEach(child => {
                    if (child !== loadingState) {
                        child.style.display = 'none';
                    }
                });
                return;
            }

            loadingState.style.display = 'none';
            Array.from(poiListContainer.children).forEach(child => {
                if (child !== loadingState) {
                    child.style.display = '';
                }
            });
        },

        showError(message) {
            const container = document.getElementById('poiListContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Hata</h4>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        },

        showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;

            switch (type) {
                case 'success':
                    toast.style.background = 'var(--poi-success)';
                    break;
                case 'warning':
                    toast.style.background = 'var(--poi-warning, #f59e0b)';
                    break;
                case 'error':
                    toast.style.background = 'var(--poi-danger)';
                    break;
                default:
                    toast.style.background = 'var(--poi-info)';
                    break;
            }

            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    };

    global.POIManagerUIMethods = POIManagerUIMethods;
})(window);
