(function (global) {
    'use strict';

    function toInlineHandlerArg(value) {
        return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
    }

    function getDifficultyStars(level) {
        return '⭐'.repeat(level || 0) + '☆'.repeat(5 - (level || 0));
    }

    function normalizeRoutesPayload(data) {
        if (Array.isArray(data)) {
            return data;
        }
        if (Array.isArray(data?.routes)) {
            return data.routes;
        }
        if (Array.isArray(data?.results)) {
            return data.results;
        }

        const routes = [];
        Object.values(data || {}).forEach((value) => {
            if (Array.isArray(value)) {
                routes.push(...value);
            }
        });
        return routes;
    }

    function routeText(value, fallback = '') {
        return escapeHtml(value || fallback);
    }

    function routeTypeLabel(route) {
        return routeText(ROUTE_TYPES?.[route?.route_type]?.name || route?.route_type, 'Rota');
    }

    function routePopupHtml(route, extraLine = '') {
        const extra = extraLine ? `<br>${extraLine}` : '';
        return `
            <strong>${routeText(route?.name, 'Rota')}</strong><br>
            ${routeTypeLabel(route)}<br>
            ${route?.estimated_duration || 0} dakika${extra}
        `;
    }

    function normalizeGeometry(geometry) {
        let parsedGeometry = geometry;
        if (typeof parsedGeometry === 'string') {
            try {
                parsedGeometry = JSON.parse(parsedGeometry);
            } catch (error) {
                console.warn('Geometri parse edilemedi:', error);
                return null;
            }
        }

        if (parsedGeometry?.geometry?.type && parsedGeometry?.geometry?.coordinates) {
            return parsedGeometry.geometry;
        }

        return parsedGeometry && typeof parsedGeometry === 'object' ? parsedGeometry : null;
    }

    function createLayerFromGeometry(geometry, color) {
        if (!geometry) return null;

        if (geometry.type && geometry.coordinates) {
            return L.geoJSON(geometry, {
                style: { color, weight: 3, opacity: 0.7 }
            });
        }

        if (Array.isArray(geometry)) {
            const latlngs = geometry
                .map((point) => {
                    if (Array.isArray(point)) {
                        const first = Number(point[0]);
                        const second = Number(point[1]);
                        if (!Number.isFinite(first) || !Number.isFinite(second)) {
                            return null;
                        }
                        if (first >= -180 && first <= 180 && second >= -90 && second <= 90) {
                            return [second, first];
                        }
                        return [first, second];
                    }

                    const lat = Number(point?.lat ?? point?.latitude);
                    const lng = Number(point?.lng ?? point?.longitude ?? point?.lon);
                    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
                })
                .filter(Boolean);

            if (latlngs.length >= 2) {
                return L.polyline(latlngs, { color, weight: 3, opacity: 0.7 });
            }
        }

        return null;
    }

    async function fetchRouteDetail(routeId) {
        const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
        if (!response.ok) {
            return null;
        }
        return response.json();
    }

    async function fetchRouteGeometry(routeId) {
        const response = await fetch(`${apiBase}/routes/${routeId}/geometry`, { credentials: 'include' });
        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        return normalizeGeometry(payload?.geometry);
    }

    function extractWaypointsFromPois(pois) {
        return (pois || [])
            .slice()
            .sort((a, b) => (a.order_in_route || 0) - (b.order_in_route || 0))
            .map((poi) => ({
                lat: Number(poi?.lat ?? poi?.latitude),
                lng: Number(poi?.lon ?? poi?.longitude),
                name: poi?.name || ''
            }))
            .filter((waypoint) => Number.isFinite(waypoint.lat) && Number.isFinite(waypoint.lng));
    }

    function extractCoordinatesFromSmartRoute(routeData, fallbackWaypoints) {
        const coordinates = [];

        if (routeData?.route && Array.isArray(routeData.route.segments) && routeData.route.segments.length > 0) {
            routeData.route.segments.forEach((segment) => {
                if (Array.isArray(segment?.coordinates)) {
                    segment.coordinates.forEach((point) => {
                        const lat = Number(point?.lat);
                        const lng = Number(point?.lng);
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            coordinates.push([lat, lng]);
                        }
                    });
                } else if (Array.isArray(segment)) {
                    coordinates.push(...segment);
                }
            });
        } else if (Array.isArray(routeData?.route?.geometry)) {
            coordinates.push(...routeData.route.geometry);
        } else if (Array.isArray(routeData?.route?.coordinates)) {
            coordinates.push(...routeData.route.coordinates);
        } else if (Array.isArray(routeData?.segments)) {
            routeData.segments.forEach((segment) => {
                if (Array.isArray(segment)) {
                    coordinates.push(...segment);
                }
            });
        }

        if (coordinates.length >= 2) {
            return coordinates;
        }

        return (fallbackWaypoints || []).map((waypoint) => [waypoint.lat, waypoint.lng]);
    }

    async function requestSmartRouteCoordinates(waypoints) {
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            return null;
        }

        const response = await fetch('/api/route/smart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ waypoints })
        });

        if (!response.ok) {
            throw new Error('Smart route API failed');
        }

        const routeData = await response.json();
        const coordinates = extractCoordinatesFromSmartRoute(routeData, waypoints);
        if (coordinates.length < 2) {
            return null;
        }

        return {
            coordinates,
            routeData
        };
    }

    async function createPoiFallbackLayer(route, color) {
        const routeId = getRouteId(route);
        if (!routeId) {
            return null;
        }

        const routeDetail = await fetchRouteDetail(routeId);
        const waypoints = extractWaypointsFromPois(routeDetail?.pois);
        if (waypoints.length < 2) {
            return null;
        }

        try {
            const smartRoute = await requestSmartRouteCoordinates(waypoints);
            if (smartRoute?.coordinates?.length >= 2) {
                return {
                    layer: L.polyline(smartRoute.coordinates, { color, weight: 4, opacity: 0.8 }),
                    popupHtml: `
                        <strong>${routeText(route?.name, 'Rota')}</strong><br>
                        ${routeTypeLabel(route)}<br>
                        ${Math.round(smartRoute.routeData?.total_distance || 0)} km<br>
                        ${Math.round(smartRoute.routeData?.estimated_time || 0)} dakika<br>
                        <small>Yol ağından hesaplandı</small>
                    `
                };
            }
        } catch (error) {
            console.warn('Smart route failed, simple polyline kullanılacak:', error);
        }

        return {
            layer: L.polyline(
                waypoints.map((waypoint) => [waypoint.lat, waypoint.lng]),
                { color, weight: 4, opacity: 0.8 }
            ),
            popupHtml: routePopupHtml(route, '<small>Düz çizgi (yol ağı bulunamadı)</small>')
        };
    }

    function addRouteLayer(route, layer, popupHtml) {
        const routeId = getRouteId(route);
        if (!routeId || !layer) {
            return;
        }

        layer.bindPopup(popupHtml || routePopupHtml(route));
        routeLayers[routeId] = layer;
        layer.addTo(map);
    }

    async function buildRouteLayer(route) {
        const routeId = getRouteId(route);
        if (!routeId) {
            return null;
        }

        const color = ROUTE_TYPES?.[route?.route_type]?.color || '#2563eb';
        let geometry = normalizeGeometry(route?.geometry);

        if (!geometry) {
            const fallback = await createPoiFallbackLayer(route, color);
            if (fallback) {
                return fallback;
            }

            geometry = await fetchRouteGeometry(routeId);
            if (geometry) {
                route.geometry = geometry;
            }
        }

        const layer = createLayerFromGeometry(geometry, color);
        if (!layer) {
            return null;
        }

        return {
            layer,
            popupHtml: routePopupHtml(route)
        };
    }

    function fitMapToVisibleRoutes() {
        if (Object.keys(routeLayers).length > 0) {
            const group = new L.featureGroup(Object.values(routeLayers));
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
            return;
        }

        global.setTimeout(() => {
            try {
                map.invalidateSize();
            } catch (_) {
                // Ignore stale map resize errors.
            }
        }, 100);
    }

    async function loadRoutes() {
        try {
            showLoading();
            const response = await rateLimitedFetch(`${apiBase}/admin/routes`, { credentials: 'include' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || 'Rotalar yüklenemedi');
            }

            allRoutes = normalizeRoutesPayload(data);
            filteredRoutes = [...allRoutes];
            displayRoutes();
        } catch (error) {
            console.error('Routes load error:', error);
            showError(`Rotalar yüklenirken hata oluştu: ${error.message}`);
        }
    }

    function displayRoutes() {
        const container = document.getElementById('routeListContainer');
        if (!container) return;

        if (!filteredRoutes.length) {
            container.innerHTML = `
                <div class="empty-workspace">
                    <i class="fas fa-route"></i>
                    <h5>Rota bulunamadı</h5>
                    <p>Arama kriterlerinizi değiştirin veya yeni rota oluşturun</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredRoutes.map((route) => {
            const routeId = getRouteId(route);
            const routeIdArg = toInlineHandlerArg(routeId);
            const routeType = ROUTE_TYPES?.[route?.route_type];
            const routeTags = route?.tags ? `<div class="route-tags">${routeText(route.tags)}</div>` : '';

            return `
                <div class="route-item ${selectedRoutes.has(routeId) ? 'selected' : ''}"
                     data-route-id="${escapeHtml(routeId)}" role="button" tabindex="0"
                     onclick="selectRoute(${routeIdArg}); return false;"
                     ondblclick="showRouteDetailsPopup(${routeIdArg}); return false;">
                    <input type="checkbox" class="route-checkbox"
                           ${selectedRoutes.has(routeId) ? 'checked' : ''}
                           onclick="toggleRouteSelection(event, ${routeIdArg}); return false;">

                    <div class="route-item-header">
                        <h4 class="route-item-title">${routeText(route?.name, 'İsimsiz Rota')}</h4>
                        <div class="route-item-actions">
                            ${(!route?.geometry || (!route.geometry?.geometry && !route.geometry?.type)) ? '<span class="badge bg-warning" title="Harita geometrisi yok">Geometri Yok</span>' : ''}
                            <button class="btn-route-info" onclick="showRouteDetailsPopup(${routeIdArg}); event.stopPropagation(); return false;" title="Rota Detayları">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                    </div>

                    <div class="route-type-badge route-type-${escapeHtml(route?.route_type || 'unknown')}">
                        ${routeType?.icon || '🗺️'}
                        ${routeText(routeType?.name || route?.route_type, 'Rota')}
                    </div>

                    <div class="route-description">
                        ${routeText(route?.description, 'Açıklama bulunmuyor')}
                    </div>

                    <div class="route-stats">
                        <div class="route-stat">
                            <i class="fas fa-clock route-stat-icon"></i>
                            <span>${route?.estimated_duration || 0} dk</span>
                        </div>
                        <div class="route-stat">
                            <i class="fas fa-route route-stat-icon"></i>
                            <span>${(route?.total_distance || 0).toFixed(2)} km</span>
                        </div>
                        <div class="route-stat">
                            <i class="fas fa-mountain route-stat-icon"></i>
                            <span>${route?.elevation_gain || 0} m</span>
                        </div>
                        <div class="route-stat">
                            <i class="fas fa-star route-stat-icon"></i>
                            <span class="difficulty-stars">${getDifficultyStars(route?.difficulty_level)}</span>
                        </div>
                    </div>

                    ${route?.is_circular ? '<div class="badge bg-info">Dairesel</div>' : ''}
                    ${routeTags}
                </div>
            `;
        }).join('');

        updateBulkActions();
    }

    function handleSearch() {
        global.clearTimeout(searchTimeout);
        searchTimeout = global.setTimeout(() => {
            applyFilters();
        }, 800);
    }

    async function applyFilters() {
        const searchTerm = (document.getElementById('routeSearch')?.value || '').toLowerCase();
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const difficultyFilter = document.getElementById('difficultyFilter')?.value || '';
        const durationFilter = document.getElementById('durationFilter')?.value || '';
        const sortFilter = document.getElementById('sortFilter')?.value || '';

        filteredRoutes = allRoutes.filter((route) => {
            const routeName = String(route?.name || '').toLowerCase();
            const routeDescription = String(route?.description || '').toLowerCase();
            const routeTags = String(route?.tags || '').toLowerCase();

            if (searchTerm && !routeName.includes(searchTerm) && !routeDescription.includes(searchTerm) && !routeTags.includes(searchTerm)) {
                return false;
            }
            if (typeFilter && route?.route_type !== typeFilter) {
                return false;
            }
            if (difficultyFilter && route?.difficulty_level != difficultyFilter) {
                return false;
            }
            if (durationFilter && (route?.estimated_duration || 0) > Number.parseInt(durationFilter, 10)) {
                return false;
            }
            return true;
        });

        filteredRoutes.sort((left, right) => {
            switch (sortFilter) {
                case 'name_asc':
                    return String(left?.name || '').localeCompare(String(right?.name || ''));
                case 'name_desc':
                    return String(right?.name || '').localeCompare(String(left?.name || ''));
                case 'created_desc':
                    return new Date(right?.created_at || 0) - new Date(left?.created_at || 0);
                case 'created_asc':
                    return new Date(left?.created_at || 0) - new Date(right?.created_at || 0);
                case 'difficulty_asc':
                    return (left?.difficulty_level || 0) - (right?.difficulty_level || 0);
                case 'difficulty_desc':
                    return (right?.difficulty_level || 0) - (left?.difficulty_level || 0);
                case 'duration_asc':
                    return (left?.estimated_duration || 0) - (right?.estimated_duration || 0);
                case 'duration_desc':
                    return (right?.estimated_duration || 0) - (left?.estimated_duration || 0);
                default:
                    return 0;
            }
        });

        displayRoutes();
    }

    function selectRoute(routeId) {
        currentRoute = allRoutes.find((route) => String(getRouteId(route)) === String(routeId));
        if (!currentRoute) {
            return;
        }

        document.querySelectorAll('.route-item').forEach((item) => {
            item.classList.remove('selected');
        });

        const selectedElement = document.querySelector(`[data-route-id="${CSS.escape(String(routeId))}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }

        displayRouteDetails(currentRoute);
        highlightAndFocusRoute(currentRoute);

        global.setTimeout(async () => {
            try {
                await loadRouteMediaForEdit(routeId);
            } catch (error) {
                console.warn('Failed to initialize media for selected route:', error);
            }
        }, 1000);
    }

    function toggleRouteSelection(event, routeId) {
        event?.stopPropagation?.();

        if (selectedRoutes.has(routeId)) {
            selectedRoutes.delete(routeId);
        } else {
            selectedRoutes.add(routeId);
        }

        updateBulkActions();
        displayRoutes();
        updateMapRoutes();
    }

    function updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const bulkCount = document.getElementById('bulkCount');
        if (!bulkActions || !bulkCount) return;

        if (selectedRoutes.size > 0) {
            bulkActions.classList.add('show');
            bulkCount.textContent = `${selectedRoutes.size} rota seçildi`;
            return;
        }

        bulkActions.classList.remove('show');
    }

    function clearSelection() {
        selectedRoutes.clear();
        updateBulkActions();
        displayRoutes();
    }

    function clearRouteSelection() {
        currentRoute = null;
        updateMapTitle();

        document.querySelectorAll('.route-item').forEach((item) => {
            item.classList.remove('selected');
        });

        Object.entries(routeLayers).forEach(([routeId, layer]) => {
            const route = allRoutes.find((item) => String(getRouteId(item)) === String(routeId));
            if (!route || typeof layer?.setStyle !== 'function') {
                return;
            }

            layer.setStyle({
                color: ROUTE_TYPES?.[route.route_type]?.color || '#2563eb',
                weight: 3,
                opacity: 0.7
            });
        });

        if (poiMarkersLayer) {
            poiMarkersLayer.clearLayers();
        }

        const workspaceContent = document.getElementById('workspaceContent');
        if (workspaceContent) {
            workspaceContent.innerHTML = `
                <div class="empty-workspace">
                    <i class="fas fa-route"></i>
                    <h4>Rota Seçin</h4>
                    <p>Detayları görüntülemek için sol taraftan bir rota seçin</p>
                </div>
            `;
        }

        const workspaceActions = document.getElementById('workspaceActions');
        if (workspaceActions) {
            workspaceActions.style.display = 'none';
        }

        fitMapToRoutes();
    }

    async function updateMapRoutes() {
        if (!map) {
            return;
        }

        Object.values(routeLayers).forEach((layer) => {
            try {
                map.removeLayer(layer);
            } catch (_) {
                // Ignore stale layer cleanup failures.
            }
        });
        routeLayers = {};

        for (const route of filteredRoutes) {
            try {
                const resolvedRoute = await buildRouteLayer(route);
                if (!resolvedRoute?.layer) {
                    continue;
                }
                addRouteLayer(route, resolvedRoute.layer, resolvedRoute.popupHtml);
            } catch (error) {
                console.warn(`Rota haritada çizilemedi: ${route?.name || 'Bilinmeyen rota'}`, error);
            }
        }

        fitMapToVisibleRoutes();
    }

    global.getDifficultyStars = getDifficultyStars;
    global.loadRoutes = loadRoutes;
    global.displayRoutes = displayRoutes;
    global.handleSearch = handleSearch;
    global.applyFilters = applyFilters;
    global.selectRoute = selectRoute;
    global.toggleRouteSelection = toggleRouteSelection;
    global.updateBulkActions = updateBulkActions;
    global.clearSelection = clearSelection;
    global.clearRouteSelection = clearRouteSelection;
    global.updateMapRoutes = updateMapRoutes;
})(window);
