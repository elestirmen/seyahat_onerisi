(function (global) {
    'use strict';

    function toNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function toInlineHandlerArg(value) {
        return JSON.stringify(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function getRouteTypeMeta(route) {
        const routeType = route?.route_type;
        return ROUTE_TYPES?.[routeType] || {
            icon: '🗺️',
            name: routeType || 'Rota'
        };
    }

    function getRouteTags(tags) {
        if (Array.isArray(tags)) {
            return tags
                .map((tag) => String(tag || '').trim())
                .filter(Boolean);
        }

        return String(tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
    }

    function buildRouteStatsMarkup(route, cardClass = 'stat-card', gridClass = 'stats-grid') {
        const stats = [
            { icon: 'clock', value: toNumber(route?.estimated_duration), label: 'Dakika' },
            { icon: 'route', value: toNumber(route?.total_distance).toFixed(2), label: 'Kilometre' },
            { icon: 'mountain', value: toNumber(route?.elevation_gain), label: 'Yükselti (m)' },
            { icon: 'map-marker-alt', value: toNumber(route?.poi_count), label: 'POI Sayısı' }
        ];

        return `
            <div class="${gridClass}">
                ${stats.map((stat) => `
                    <div class="${cardClass}">
                        <div class="stat-icon">
                            <i class="fas fa-${stat.icon}"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${stat.value}</div>
                            <div class="stat-label">${stat.label}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function buildRouteTagsMarkup(route, titleTag = 'h5') {
        const tags = getRouteTags(route?.tags);
        if (tags.length === 0) {
            return '';
        }

        return `
            <div class="route-tags-section">
                <${titleTag}><i class="fas fa-tags me-2"></i>Etiketler</${titleTag}>
                <div class="tags-container">
                    ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    function buildRouteMetadataMarkup(route, titleTag = 'h5', popup = false) {
        const gridClass = popup ? 'metadata-grid-popup' : 'metadata-grid';
        return `
            <div class="route-metadata">
                <${titleTag}><i class="fas fa-info me-2"></i>Metadata</${titleTag}>
                <div class="${gridClass}">
                    <div class="metadata-item">
                        <strong>Oluşturulma:</strong>
                        <span>${formatDate(route?.created_at)}</span>
                    </div>
                    <div class="metadata-item">
                        <strong>Güncellenme:</strong>
                        <span>${formatDate(route?.updated_at)}</span>
                    </div>
                    <div class="metadata-item">
                        <strong>Dairesel Rota:</strong>
                        <span>${route?.is_circular ? 'Evet' : 'Hayır'}</span>
                    </div>
                    ${route?.import_source ? `
                        <div class="metadata-item">
                            <strong>Import Kaynağı:</strong>
                            <span>${escapeHtml(route.import_source)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function buildRouteMediaSectionMarkup() {
        return `
            <div class="route-media-section">
                <h5><i class="fas fa-images me-2"></i>Medya Dosyaları</h5>
                <div class="route-media-controls mb-3">
                    <button type="button" class="btn btn-primary btn-sm" onclick="showRouteMediaUploadForm()">
                        <i class="fas fa-plus me-1"></i>Medya Ekle
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="refreshRouteMedia()">
                        <i class="fas fa-sync-alt me-1"></i>Yenile
                    </button>
                </div>
                <div id="routeCurrentMedia" class="current-media-grid">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Medya dosyaları yükleniyor...</p>
                    </div>
                </div>
            </div>
        `;
    }

    function buildRouteDetailMarkup(routeDetails) {
        const routeType = getRouteTypeMeta(routeDetails);
        return `
            <div class="route-detail-view">
                <div class="route-detail-header">
                    <div class="route-type-badge route-type-${routeDetails.route_type}">
                        ${routeType.icon}
                        ${routeType.name}
                    </div>
                    <div class="difficulty-display">
                        <span class="difficulty-stars">${getDifficultyStars(routeDetails.difficulty_level)}</span>
                        <span class="difficulty-text">Zorluk: ${toNumber(routeDetails.difficulty_level)}/5</span>
                    </div>
                </div>

                <div class="route-description-full">
                    <h5><i class="fas fa-info-circle me-2"></i>Açıklama</h5>
                    <p>${escapeHtml(routeDetails.description || 'Açıklama bulunmuyor')}</p>
                </div>

                <div class="route-statistics">
                    <h5><i class="fas fa-chart-bar me-2"></i>İstatistikler</h5>
                    ${buildRouteStatsMarkup(routeDetails)}
                </div>

                ${buildRouteTagsMarkup(routeDetails)}
                ${buildRouteMetadataMarkup(routeDetails)}
                ${buildRouteMediaSectionMarkup()}
            </div>
        `;
    }

    function buildRouteDetailsPopupMarkup(route, routeId) {
        const routeType = getRouteTypeMeta(route);
        return `
            <div class="modal fade" id="routeDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-route me-2"></i>
                                Rota Detayları - ${escapeHtml(route.name || 'İsimsiz Rota')}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="route-detail-popup">
                                <div class="route-detail-header">
                                    <div class="route-type-badge route-type-${route.route_type}">
                                        ${routeType.icon}
                                        ${routeType.name}
                                    </div>
                                    <div class="difficulty-display">
                                        <span class="difficulty-stars">${getDifficultyStars(route.difficulty_level)}</span>
                                        <span class="difficulty-text">Zorluk: ${toNumber(route.difficulty_level)}/5</span>
                                    </div>
                                </div>

                                <div class="route-description-full">
                                    <h6><i class="fas fa-info-circle me-2"></i>Açıklama</h6>
                                    <p>${escapeHtml(route.description || 'Açıklama bulunmuyor')}</p>
                                </div>

                                <div class="route-statistics">
                                    <h6><i class="fas fa-chart-bar me-2"></i>İstatistikler</h6>
                                    ${buildRouteStatsMarkup(route, 'stat-card-popup', 'stats-grid-popup')}
                                </div>

                                ${buildRouteTagsMarkup(route, 'h6')}
                                ${buildRouteMetadataMarkup(route, 'h6', true)}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="selectRouteFromPopup(${toInlineHandlerArg(routeId)})">
                                <i class="fas fa-eye me-1"></i>Rotayı Seç ve Görüntüle
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async function hydrateRouteDetails(route) {
        const routeId = getRouteId(route);
        if (!routeId) {
            return route;
        }

        if (route?.elevation_profile && route?.pois && route?.geometry) {
            return route;
        }

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
            if (response.ok) {
                const detailedRoute = await response.json();
                currentRoute = detailedRoute;
                return detailedRoute;
            }
        } catch (error) {
            console.warn('Rota detayları alınamadı:', error);
        }

        return route;
    }

    function loadRouteElevationChart(routeDetails) {
        if (!global.ElevationChart || !routeDetails) {
            return;
        }

        global.setTimeout(async () => {
            if (!global.routeElevationChart) {
                global.routeElevationChart = new ElevationChart('routeElevationChartContainer', map);
            }

            if (routeDetails.elevation_profile?.points) {
                await global.routeElevationChart.loadElevationProfile(routeDetails.elevation_profile);
                return;
            }

            if (routeDetails.geometry) {
                await global.routeElevationChart.loadRouteElevation({
                    geometry: routeDetails.geometry
                });
                return;
            }

            if (Array.isArray(routeDetails.pois) && routeDetails.pois.length > 0) {
                await global.routeElevationChart.loadRouteElevation({
                    pois: routeDetails.pois.map((poi) => ({
                        name: poi.name,
                        latitude: poi.latitude || poi.lat,
                        longitude: poi.longitude || poi.lng || poi.lon
                    }))
                });
            }
        }, 500);
    }

    function refreshRouteDetailMedia(routeId) {
        global.setTimeout(async () => {
            try {
                await loadRouteMediaForEdit(routeId);
            } catch (error) {
                console.warn('Failed to load media for route details:', error);
            }
        }, 800);
    }

    async function displayRouteDetails(route) {
        const workspaceTitle = document.getElementById('workspaceTitle');
        const workspaceActions = document.getElementById('workspaceActions');
        const workspaceContent = document.getElementById('workspaceContent');
        if (!workspaceTitle || !workspaceActions || !workspaceContent) {
            return;
        }

        const routeDetails = await hydrateRouteDetails(route);
        const routeId = getRouteId(routeDetails);

        workspaceTitle.textContent = routeDetails.name || 'Rota';
        workspaceActions.innerHTML = defaultWorkspaceActionsHTML;
        workspaceActions.style.display = 'flex';
        workspaceContent.innerHTML = buildRouteDetailMarkup(routeDetails);

        addRouteDetailStyles();
        loadRouteElevationChart(routeDetails);
        if (routeId) {
            refreshRouteDetailMedia(routeId);
        }
    }

    async function showRouteDetailsPopup(routeId) {
        let route = allRoutes.find((item) => String(getRouteId(item)) === String(routeId));

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
            if (response.ok) {
                route = await response.json();
            }
        } catch (error) {
            console.warn('Rota detayları alınamadı:', error);
        }

        if (!route) {
            console.error('Route not found:', routeId);
            return;
        }

        const existingModal = document.getElementById('routeDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', buildRouteDetailsPopupMarkup(route, routeId));
        new bootstrap.Modal(document.getElementById('routeDetailsModal')).show();
    }

    function selectRouteFromPopup(routeId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('routeDetailsModal'));
        if (modal) {
            modal.hide();
        }
        selectRoute(routeId);
    }

    function addRouteDetailStyles() {
        if (document.getElementById('routeDetailStyles')) return;

        const style = document.createElement('style');
        style.id = 'routeDetailStyles';
        style.textContent = `
            .route-detail-view {
                padding: 0;
            }

            .route-detail-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid var(--route-border);
            }

            .difficulty-display {
                text-align: right;
            }

            .difficulty-text {
                display: block;
                font-size: 0.85rem;
                color: var(--route-secondary);
                margin-top: 0.25rem;
            }

            .route-description-full {
                margin-bottom: 1.5rem;
            }

            .route-description-full h5 {
                color: var(--route-dark);
                margin-bottom: 0.75rem;
            }

            .route-description-full p {
                color: var(--route-secondary);
                line-height: 1.6;
            }

            .stats-grid,
            .stats-grid-popup {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin-bottom: 1.5rem;
            }

            .stat-card,
            .stat-card-popup {
                background: var(--route-light);
                border-radius: var(--route-radius);
                padding: 1rem;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                border: 2px solid var(--route-border);
                transition: var(--route-transition);
            }

            .stat-card:hover,
            .stat-card-popup:hover {
                border-color: var(--route-primary);
                transform: translateY(-2px);
            }

            .stat-icon {
                width: 40px;
                height: 40px;
                background: var(--route-primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.1rem;
            }

            .stat-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--route-dark);
            }

            .stat-label {
                font-size: 0.8rem;
                color: var(--route-secondary);
            }

            .route-tags-section {
                margin-bottom: 1.5rem;
            }

            .route-tags-section h5,
            .route-tags-section h6,
            .route-metadata h5,
            .route-metadata h6 {
                color: var(--route-dark);
                margin-bottom: 0.75rem;
            }

            .tags-container {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }

            .tag-chip {
                background: var(--route-primary);
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 15px;
                font-size: 0.8rem;
                font-weight: 500;
            }

            .metadata-grid,
            .metadata-grid-popup {
                display: grid;
                gap: 0.5rem;
            }

            .metadata-item {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem;
                background: var(--route-light);
                border-radius: var(--route-radius);
                border: 1px solid var(--route-border);
            }

            .metadata-item strong {
                color: var(--route-dark);
            }

            .metadata-item span {
                color: var(--route-secondary);
            }

            .route-media-section {
                margin-bottom: 1.5rem;
                background: var(--route-light);
                border-radius: var(--route-radius);
                padding: 1.5rem;
                border: 2px solid var(--route-border);
            }

            .route-media-section h5 {
                color: var(--route-dark);
                margin-bottom: 1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .route-media-controls {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
                margin-bottom: 1rem;
            }

            .route-media-controls .btn {
                font-size: 0.85rem;
                padding: 0.375rem 0.75rem;
            }

            .route-media-section .current-media-grid {
                margin-top: 0;
            }
        `;
        document.head.appendChild(style);
    }

    global.displayRouteDetails = displayRouteDetails;
    global.showRouteDetailsPopup = showRouteDetailsPopup;
    global.selectRouteFromPopup = selectRouteFromPopup;
    global.addRouteDetailStyles = addRouteDetailStyles;
})(window);
