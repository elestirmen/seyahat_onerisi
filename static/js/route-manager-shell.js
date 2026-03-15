(function (global) {
    'use strict';

    function setupEventListeners() {
        const routeSearch = document.getElementById('routeSearch');
        const typeFilter = document.getElementById('typeFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');
        const durationFilter = document.getElementById('durationFilter');
        const sortFilter = document.getElementById('sortFilter');

        if (!routeSearch || routeSearch.dataset.listenersBound === 'true') {
            return;
        }

        routeSearch.dataset.listenersBound = 'true';
        typeFilter.dataset.listenersBound = 'true';
        difficultyFilter.dataset.listenersBound = 'true';
        durationFilter.dataset.listenersBound = 'true';
        sortFilter.dataset.listenersBound = 'true';

        routeSearch.addEventListener('input', handleSearch);
        typeFilter.addEventListener('change', applyFilters);
        difficultyFilter.addEventListener('change', applyFilters);
        durationFilter.addEventListener('change', applyFilters);
        sortFilter.addEventListener('change', applyFilters);
    }

    function setupResizableMap() {
        const resizeHandle = document.getElementById('resizeHandle');
        const container = document.getElementById('routeContainer');
        if (!resizeHandle || !container || resizeHandle.dataset.resizeBound === 'true') {
            return;
        }

        resizeHandle.dataset.resizeBound = 'true';
        let isResizing = false;
        let startX = 0;
        let startMapWidth = 600;

        function getCurrentMapWidth() {
            const computedStyle = global.getComputedStyle(container);
            const columns = computedStyle.gridTemplateColumns.split(' ');
            return Number.parseInt(columns[2], 10) || 600;
        }

        resizeHandle.addEventListener('mousedown', (event) => {
            isResizing = true;
            startX = event.clientX;
            startMapWidth = getCurrentMapWidth();
            resizeHandle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!isResizing) {
                return;
            }

            const deltaX = startX - event.clientX;
            const newMapWidth = Math.max(400, Math.min(800, startMapWidth + deltaX));
            container.style.gridTemplateColumns = `380px 1fr ${newMapWidth}px`;
            resizeHandle.style.right = `${newMapWidth + 20}px`;

            if (map) {
                global.setTimeout(() => map.invalidateSize(), 10);
            }
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) {
                return;
            }

            isResizing = false;
            resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if (map) {
                global.setTimeout(() => map.invalidateSize(), 100);
            }
        });
    }

    function fitMapToRoutes() {
        if (!map || Object.keys(routeLayers).length === 0) {
            showNotification('Görüntülenecek rota bulunamadı', 'warning');
            return;
        }

        if (currentRoute && routeLayers[getRouteId(currentRoute)]) {
            const selectedLayer = routeLayers[getRouteId(currentRoute)];
            const layers = [selectedLayer];

            if (poiMarkersLayer && poiMarkersLayer.getLayers().length > 0) {
                layers.push(poiMarkersLayer);
            }

            const group = new L.featureGroup(layers);
            map.fitBounds(group.getBounds(), {
                padding: [30, 30],
                maxZoom: 14,
                animate: true,
                duration: 0.8
            });
            showNotification(`${currentRoute.name} rotasına odaklanıldı`, 'info');
            return;
        }

        const group = new L.featureGroup(Object.values(routeLayers));
        map.fitBounds(group.getBounds(), {
            padding: [20, 20],
            animate: true,
            duration: 0.8
        });
        showNotification('Tüm rotalara odaklanıldı', 'info');
    }

    function addRouteEditFormStyles() {
        if (document.getElementById('routeEditFormStyles')) return;

        const style = document.createElement('style');
        style.id = 'routeEditFormStyles';
        style.textContent = `
            .route-edit-form {
                padding: 0;
            }

            .form-section {
                margin-bottom: 2rem;
                padding-bottom: 1.5rem;
                border-bottom: 2px solid var(--route-border);
            }

            .form-section:last-child {
                border-bottom: none;
            }

            .form-section h5 {
                color: var(--route-dark);
                margin-bottom: 1rem;
                font-weight: 600;
            }

            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .form-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .form-group label {
                font-weight: 600;
                color: var(--route-dark);
                font-size: 0.9rem;
            }

            .form-control {
                padding: 0.75rem;
                border: 2px solid var(--route-border);
                border-radius: var(--route-radius);
                font-size: 0.9rem;
                transition: var(--route-transition);
            }

            .form-control:focus {
                outline: none;
                border-color: var(--route-primary);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }

            .form-check {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }

            .form-check-input {
                width: 18px;
                height: 18px;
            }

            .media-upload-container {
                background: white;
                border-radius: var(--route-radius);
                padding: 1.5rem;
                box-shadow: var(--route-shadow);
            }

            .media-upload-form h5 {
                color: var(--route-dark);
                margin-bottom: 1.5rem;
                font-weight: 600;
                border-bottom: 2px solid var(--route-border);
                padding-bottom: 0.5rem;
            }

            .form-input {
                padding: 0.75rem;
                border: 2px solid var(--route-border);
                border-radius: var(--route-radius);
                font-size: 0.9rem;
                transition: var(--route-transition);
                width: 100%;
            }

            .form-input:focus {
                outline: none;
                border-color: var(--route-primary);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }

            .form-label {
                font-weight: 600;
                color: var(--route-dark);
                font-size: 0.9rem;
                margin-bottom: 0.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .form-help {
                color: var(--route-secondary);
                font-size: 0.8rem;
                margin-top: 0.25rem;
            }

            .current-media-container {
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 2px solid var(--route-border);
            }

            .current-media-container h5 {
                color: var(--route-dark);
                margin-bottom: 1rem;
                font-weight: 600;
            }

            .current-media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }

            .media-item-card {
                position: relative;
                background: white;
                border: 2px solid var(--route-border);
                border-radius: var(--route-radius);
                padding: 0.75rem;
                text-align: center;
                transition: var(--route-transition);
                cursor: pointer;
            }

            .media-item-card:hover {
                border-color: var(--route-primary);
                box-shadow: var(--route-shadow-hover);
                transform: translateY(-2px);
            }

            .media-preview {
                width: 100%;
                height: 80px;
                object-fit: cover;
                border-radius: calc(var(--route-radius) - 4px);
                margin-bottom: 0.5rem;
                image-rendering: -webkit-optimize-contrast;
                image-rendering: crisp-edges;
            }

            .media-placeholder {
                width: 100%;
                height: 80px;
                background: var(--route-light);
                border: 2px dashed var(--route-border);
                border-radius: calc(var(--route-radius) - 4px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin-bottom: 0.5rem;
                font-size: 1.5rem;
            }

            .media-format {
                font-size: 0.7rem;
                color: var(--route-secondary);
                margin-top: 0.25rem;
            }

            .media-delete-btn {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--route-danger);
                color: white;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8rem;
                transition: var(--route-transition);
            }

            .media-delete-btn:hover {
                background: #b91c1c;
                transform: scale(1.1);
            }

            .media-type-badge {
                position: absolute;
                top: 0.5rem;
                left: 0.5rem;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
            }

            .media-item-info {
                margin-top: 0.5rem;
            }

            .media-item-name {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--route-dark);
                margin-bottom: 0.25rem;
                word-break: break-word;
            }

            .media-type-section {
                margin-bottom: 1.5rem;
            }

            .media-type-title {
                color: var(--route-dark);
                margin-bottom: 1rem;
                font-weight: 600;
                font-size: 0.9rem;
                border-bottom: 1px solid var(--route-border);
                padding-bottom: 0.5rem;
            }

            .media-item-size {
                font-size: 0.7rem;
                color: var(--route-secondary);
            }

            .media-compression {
                font-size: 0.7rem;
                color: #059669;
                font-weight: 500;
            }

            .loading-spinner {
                text-align: center;
                padding: 2rem;
                color: var(--route-secondary);
            }

            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid var(--route-border);
                border-top: 4px solid var(--route-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .coordinate-management-container {
                background: white;
                border-radius: var(--route-radius);
                padding: 1.5rem;
                box-shadow: var(--route-shadow);
            }

            .coordinate-input-section h6,
            .coordinate-list-section h6 {
                color: var(--route-dark);
                margin-bottom: 1rem;
                font-weight: 600;
                border-bottom: 1px solid var(--route-border);
                padding-bottom: 0.5rem;
            }

            .coordinate-input-form {
                background: var(--route-light);
                border-radius: var(--route-radius);
                padding: 1rem;
                margin-bottom: 1.5rem;
            }

            .coordinate-actions {
                display: flex;
                gap: 0.75rem;
                margin-top: 1rem;
                flex-wrap: wrap;
            }

            .coordinate-actions .btn {
                flex: 1;
                min-width: 120px;
            }

            .coordinates-list {
                background: var(--route-light);
                border-radius: var(--route-radius);
                padding: 1rem;
                margin-bottom: 1rem;
                max-height: 300px;
                overflow-y: auto;
            }

            .coordinate-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 0.75rem;
                background: white;
                border: 1px solid var(--route-border);
                border-radius: calc(var(--route-radius) - 4px);
                margin-bottom: 0.5rem;
                transition: var(--route-transition);
            }

            .coordinate-item:hover {
                border-color: var(--route-primary);
                box-shadow: var(--route-shadow);
            }

            .coordinate-item:last-child {
                margin-bottom: 0;
            }

            .coordinate-number {
                background: var(--route-primary);
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8rem;
                font-weight: 600;
                flex-shrink: 0;
            }

            .coordinate-info {
                flex: 1;
            }

            .coordinate-name {
                font-weight: 600;
                color: var(--route-dark);
                margin-bottom: 0.25rem;
            }

            .coordinate-coords {
                font-family: monospace;
                font-size: 0.8rem;
                color: var(--route-secondary);
                margin-bottom: 0.25rem;
            }

            .coordinate-description {
                font-size: 0.8rem;
                color: var(--route-secondary);
                font-style: italic;
            }

            .coordinate-actions-item {
                display: flex;
                gap: 0.5rem;
                flex-shrink: 0;
            }

            .coordinate-actions-section {
                display: flex;
                gap: 1rem;
                justify-content: center;
                padding-top: 1rem;
                border-top: 1px solid var(--route-border);
            }

            .coordinate-actions-section .btn {
                min-width: 150px;
            }

            .coordinate-item.reorderable {
                cursor: grab;
                user-select: none;
            }

            .coordinate-item.reorderable:active {
                cursor: grabbing;
            }

            .coordinate-item.reorderable:hover {
                background: var(--route-light);
                border-color: var(--route-primary);
            }

            .coordinate-item.reorderable.dragging {
                opacity: 0.5;
                transform: rotate(2deg);
            }

            .poi-association-container {
                background: var(--route-light);
                border-radius: var(--route-radius);
                padding: 1rem;
                border: 2px solid var(--route-border);
            }

            .poi-search-section {
                display: flex;
                gap: 1rem;
                align-items: center;
                margin-bottom: 1rem;
            }

            .poi-search-section .search-container {
                flex: 1;
            }

            .poi-lists-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
            }

            .available-pois,
            .associated-pois {
                background: white;
                border-radius: var(--route-radius);
                padding: 1rem;
                border: 2px solid var(--route-border);
            }

            .available-pois h6,
            .associated-pois h6 {
                margin-bottom: 0.75rem;
                color: var(--route-dark);
                font-weight: 600;
            }

            .poi-list {
                max-height: 200px;
                overflow-y: auto;
            }

            .poi-item-small {
                background: var(--route-light);
                border: 1px solid var(--route-border);
                border-radius: var(--route-radius);
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: var(--route-transition);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .poi-item-small:hover {
                border-color: var(--route-primary);
                background: white;
            }

            .poi-item-info {
                flex: 1;
            }

            .poi-item-name {
                font-weight: 600;
                color: var(--route-dark);
                font-size: 0.9rem;
            }

            .poi-item-category {
                font-size: 0.8rem;
                color: var(--route-secondary);
            }

            .poi-item-actions {
                display: flex;
                gap: 0.25rem;
            }

            .btn-poi-action {
                padding: 0.25rem 0.5rem;
                border: none;
                border-radius: 15px;
                font-size: 0.75rem;
                cursor: pointer;
                transition: var(--route-transition);
            }

            .btn-add-poi {
                background: var(--route-success);
                color: white;
            }

            .btn-remove-poi {
                background: var(--route-danger);
                color: white;
            }

            .poi-order-badge {
                display: inline-block;
                background: var(--route-primary);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                text-align: center;
                line-height: 20px;
                font-size: 0.7rem;
                font-weight: bold;
                margin-right: 0.5rem;
            }

            .export-options {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem;
            }

            .export-options .btn {
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 500;
            }

            .current-media-container .btn-group {
                gap: 0.25rem;
            }

            .current-media-container .btn-group .btn {
                min-width: auto;
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
            }

            @media (max-width: 768px) {
                .form-grid {
                    grid-template-columns: 1fr;
                }

                .poi-lists-container {
                    grid-template-columns: 1fr;
                }

                .poi-search-section {
                    flex-direction: column;
                    align-items: stretch;
                }

                .export-options {
                    flex-direction: column;
                }
            }
        `;

        document.head.appendChild(style);
    }

    global.setupEventListeners = setupEventListeners;
    global.setupResizableMap = setupResizableMap;
    global.fitMapToRoutes = fitMapToRoutes;
    global.addRouteEditFormStyles = addRouteEditFormStyles;
})(window);
