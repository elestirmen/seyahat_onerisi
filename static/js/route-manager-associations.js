(function (global) {
    'use strict';

    global.associatedPoiIdSet = global.associatedPoiIdSet instanceof Set
        ? global.associatedPoiIdSet
        : new Set();
    global.associatedPoiOrderedIds = Array.isArray(global.associatedPoiOrderedIds)
        ? global.associatedPoiOrderedIds
        : [];
    global.allPoisForAssociation = Array.isArray(global.allPoisForAssociation)
        ? global.allPoisForAssociation
        : [];

    function normalizePoiId(value) {
        const source = value && typeof value === 'object' ? getPoiId(value) : value;
        const parsed = Number.parseInt(source, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getCurrentRouteId() {
        return currentRoute ? getRouteId(currentRoute) : null;
    }

    function requireCurrentRoute() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Önce bir rota seçin', 'warning');
            return null;
        }
        return routeId;
    }

    function getAssociatedPoiOrder() {
        return Array.isArray(global.associatedPoiOrderedIds)
            ? global.associatedPoiOrderedIds.slice()
            : [];
    }

    function setAssociatedPoiOrder(ids) {
        const normalizedIds = ids
            .map(normalizePoiId)
            .filter((id) => id !== null);

        global.associatedPoiOrderedIds = normalizedIds;
        global.associatedPoiIdSet = new Set(normalizedIds);
    }

    function getAssociatedPoiSet() {
        if (!(global.associatedPoiIdSet instanceof Set)) {
            global.associatedPoiIdSet = new Set(getAssociatedPoiOrder());
        }
        return global.associatedPoiIdSet;
    }

    function setAllPoisForAssociation(pois) {
        global.allPoisForAssociation = Array.isArray(pois) ? pois.slice() : [];
    }

    function getAllPoisForAssociation() {
        return Array.isArray(global.allPoisForAssociation)
            ? global.allPoisForAssociation
            : [];
    }

    function findPoiById(pois, id) {
        const normalizedId = normalizePoiId(id);
        if (normalizedId === null) return null;
        return (pois || []).find((poi) => normalizePoiId(poi) === normalizedId) || null;
    }

    function normalizePoiCollection(raw) {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.pois)) return raw.pois;
        if (Array.isArray(raw?.results)) return raw.results;

        const flattened = [];
        Object.values(raw || {}).forEach((value) => {
            if (Array.isArray(value)) {
                flattened.push(...value);
            }
        });
        return flattened;
    }

    function getPoiCategoryConfig(categoryKey) {
        const category = POI_CATEGORIES?.[categoryKey];
        return {
            icon: category?.icon || 'map-marker-alt',
            color: category?.color || '#2563eb',
            name: category?.name || categoryKey || 'Kategori yok'
        };
    }

    function getOrderedAssociatedPois(allPois, associatedPois) {
        const assocList = (associatedPois || []).slice().sort(
            (a, b) => (a.order_in_route || 0) - (b.order_in_route || 0)
        );

        const orderedIds = assocList
            .map((poi) => normalizePoiId(poi) ?? normalizePoiId(poi?.poi))
            .filter((id) => id !== null);

        setAssociatedPoiOrder(orderedIds);

        return orderedIds
            .map((id) => findPoiById(allPois, id) || findPoiById(assocList, id))
            .filter(Boolean);
    }

    function renderAvailablePoiItem(poi) {
        const poiId = normalizePoiId(poi);
        if (poiId === null) return '';

        const category = getPoiCategoryConfig(poi.category);
        return `
            <div class="poi-item-small" data-poi-id="${poiId}">
                <div class="poi-item-info">
                    <div class="poi-item-name">
                        <i class="fas fa-${category.icon}" style="color: ${category.color}; margin-right: 0.5rem;"></i>
                        ${escapeHtml(poi.name || 'İsimsiz POI')}
                    </div>
                    <div class="poi-item-category">${escapeHtml(category.name)}</div>
                </div>
                <div class="poi-item-actions">
                    <button type="button" class="btn-poi-action btn-add-poi" onclick="associatePOI(${poiId})" title="POI'yi rotaya ekle">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function renderAssociatedPoiItem(poi, index, totalCount) {
        const poiId = normalizePoiId(poi);
        if (poiId === null) return '';

        const category = getPoiCategoryConfig(poi.category);
        return `
            <div class="poi-item-small" data-poi-id="${poiId}">
                <div class="poi-item-info">
                    <div class="poi-item-name">
                        <span class="poi-order-badge">${index + 1}</span>
                        <i class="fas fa-${category.icon}" style="color: ${category.color}; margin-right: 0.5rem;"></i>
                        ${escapeHtml(poi.name || 'İsimsiz POI')}
                    </div>
                    <div class="poi-item-category">${escapeHtml(category.name)}</div>
                </div>
                <div class="poi-item-actions">
                    <button type="button" class="btn-poi-action btn-remove-poi" onclick="disassociatePOI(${poiId})" title="POI'yi rotadan çıkar">
                        <i class="fas fa-times"></i>
                    </button>
                    ${index > 0 ? `<button type="button" class="btn-poi-action" title="Yukarı taşı" onclick="reorderAssociatedPOI(${poiId}, -1)"><i class="fas fa-arrow-up"></i></button>` : ''}
                    ${index < totalCount - 1 ? `<button type="button" class="btn-poi-action" title="Aşağı taşı" onclick="reorderAssociatedPOI(${poiId}, 1)"><i class="fas fa-arrow-down"></i></button>` : ''}
                </div>
            </div>
        `;
    }

    function displayAvailablePOIs(pois) {
        const container = document.getElementById('availablePOIsList');
        if (!container) return;

        if (!Array.isArray(pois) || pois.length === 0) {
            container.innerHTML = '<p class="text-muted">İlişkilendirilecek POI bulunamadı</p>';
            return;
        }

        container.innerHTML = pois
            .map(renderAvailablePoiItem)
            .filter(Boolean)
            .join('');
    }

    function displayAssociatedPOIs(pois) {
        const container = document.getElementById('associatedPOIsList');
        if (!container) return;

        if (!Array.isArray(pois) || pois.length === 0) {
            container.innerHTML = '<p class="text-muted">İlişkilendirilmiş POI bulunmuyor</p>';
            return;
        }

        container.innerHTML = pois
            .map((poi, index) => renderAssociatedPoiItem(poi, index, pois.length))
            .filter(Boolean)
            .join('');
    }

    async function persistAssociatedPois(routeId, orderedIds) {
        const headers = { 'Content-Type': 'application/json' };
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        }

        const payloadPois = orderedIds.map((id, index) => ({
            poi_id: id,
            order_in_route: index + 1
        }));

        const response = await fetch(`${apiBase}/admin/routes/${routeId}/pois`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
                csrf_token: csrfToken || '',
                pois: payloadPois
            })
        });

        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (_) {
                errorData = { error: await response.text().catch(() => '') };
            }
            throw new Error(errorData.error || 'POI listesi kaydedilemedi');
        }

        return response.json().catch(() => ({}));
    }

    async function refreshAssociationViews(routeId, options = {}) {
        const { refreshMap = true, refreshRoutePois = false } = options;

        await loadPOIsForAssociation(routeId);

        if (refreshMap && currentRoute) {
            await showSelectedRouteOnMap(currentRoute);
            return;
        }

        if (refreshRoutePois) {
            await loadAndDisplayRoutePOIs(routeId);
        }
    }

    async function loadPOIsForAssociation(routeId) {
        const availableContainer = document.getElementById('availablePOIsList');
        const associatedContainer = document.getElementById('associatedPOIsList');

        if (availableContainer) {
            availableContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        }
        if (associatedContainer) {
            associatedContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        }

        try {
            const [poisResponse, routeResponse] = await Promise.all([
                fetch(`${apiBase}/pois`, { credentials: 'include' }),
                fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' })
            ]);

            if (!poisResponse.ok) {
                throw new Error('POI\'ler yüklenemedi');
            }

            const allPois = normalizePoiCollection(await poisResponse.json());
            setAllPoisForAssociation(allPois);

            let associatedPois = [];
            if (routeResponse.ok) {
                const routeDetail = await routeResponse.json();
                associatedPois = Array.isArray(routeDetail?.pois) ? routeDetail.pois : [];
            }

            const orderedAssociatedPois = getOrderedAssociatedPois(allPois, associatedPois);
            const associatedIds = new Set(getAssociatedPoiOrder());
            const availablePois = allPois.filter((poi) => {
                const poiId = normalizePoiId(poi);
                return poiId !== null && !associatedIds.has(poiId);
            });

            displayAvailablePOIs(availablePois);
            displayAssociatedPOIs(orderedAssociatedPois);
        } catch (error) {
            console.error('Error loading POIs for association:', error);
            showNotification(`POI'ler yüklenirken hata oluştu: ${error.message}`, 'error');

            if (availableContainer) {
                availableContainer.innerHTML = '<p class="text-danger">POI\'ler yüklenemedi</p>';
            }
            if (associatedContainer) {
                associatedContainer.innerHTML = '<p class="text-danger">İlişkili POI\'ler yüklenemedi</p>';
            }
        }
    }

    function searchPOIs() {
        const searchInput = document.getElementById('poiSearchInput');
        if (!searchInput) return;

        const searchTerm = searchInput.value.toLowerCase();
        const items = document.querySelectorAll('#availablePOIsList .poi-item-small, #associatedPOIsList .poi-item-small');

        items.forEach((item) => {
            const name = item.querySelector('.poi-item-name')?.textContent.toLowerCase() || '';
            const category = item.querySelector('.poi-item-category')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(searchTerm) || category.includes(searchTerm) ? 'flex' : 'none';
        });
    }

    async function associatePOI(poiId) {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        const normalizedPoiId = normalizePoiId(poiId);
        if (normalizedPoiId === null) {
            showNotification('Geçersiz POI ID', 'error');
            return;
        }

        const originalIds = getAssociatedPoiOrder();
        if (getAssociatedPoiSet().has(normalizedPoiId)) {
            showNotification('POI zaten rotada', 'info');
            return;
        }

        const nextIds = [...originalIds, normalizedPoiId];
        setAssociatedPoiOrder(nextIds);

        try {
            await persistAssociatedPois(routeId, nextIds);
            showNotification('POI başarıyla ilişkilendirildi', 'success');
            await refreshAssociationViews(routeId);
        } catch (error) {
            setAssociatedPoiOrder(originalIds);
            console.error('POI association error:', error);
            showNotification(`POI ilişkilendirilirken hata oluştu: ${error.message}`, 'error');
        }
    }

    async function disassociatePOI(poiId) {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        const normalizedPoiId = normalizePoiId(poiId);
        if (normalizedPoiId === null) {
            showNotification('Geçersiz POI ID', 'error');
            return;
        }

        const originalIds = getAssociatedPoiOrder();
        const nextIds = originalIds.filter((id) => id !== normalizedPoiId);

        if (nextIds.length === originalIds.length) {
            return;
        }

        setAssociatedPoiOrder(nextIds);

        try {
            await persistAssociatedPois(routeId, nextIds);
            showNotification('POI başarıyla kaldırıldı', 'success');
            await refreshAssociationViews(routeId);
        } catch (error) {
            setAssociatedPoiOrder(originalIds);
            console.error('POI disassociation error:', error);
            showNotification(`POI kaldırılırken hata oluştu: ${error.message}`, 'error');
        }
    }

    async function reorderAssociatedPOI(poiId, delta) {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        const normalizedPoiId = normalizePoiId(poiId);
        if (normalizedPoiId === null) return;

        const originalIds = getAssociatedPoiOrder();
        const currentIndex = originalIds.indexOf(normalizedPoiId);
        const targetIndex = currentIndex + delta;

        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= originalIds.length) {
            return;
        }

        const nextIds = originalIds.slice();
        [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];
        setAssociatedPoiOrder(nextIds);

        try {
            await persistAssociatedPois(routeId, nextIds);
            showNotification('POI sıralaması güncellendi', 'success');
            await refreshAssociationViews(routeId);
        } catch (error) {
            setAssociatedPoiOrder(originalIds);
            console.error('POI reorder error:', error);
            showNotification(`Sıralama hatası: ${error.message}`, 'error');
        }
    }

    function getOrderedRoutePois() {
        return getAssociatedPoiOrder()
            .map((id) => findPoiById(getAllPoisForAssociation(), id))
            .filter(Boolean);
    }

    function getValidWaypointPois() {
        return getOrderedRoutePois().filter((poi) => {
            const lat = Number.parseFloat(poi.latitude || poi.lat);
            const lng = Number.parseFloat(poi.longitude || poi.lng || poi.lon);
            return Number.isFinite(lat) && Number.isFinite(lng);
        });
    }

    async function buildAndSaveRouteFromAssociatedPOIs() {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        const orderedPois = getValidWaypointPois();
        if (orderedPois.length < 2) {
            showNotification('Rota için en az 2 geçerli POI seçin', 'warning');
            return;
        }

        const waypoints = orderedPois.map((poi, index) => ({
            lat: poi.latitude || poi.lat,
            lng: poi.longitude || poi.lng || poi.lon,
            name: poi.name,
            order: index + 1
        }));

        let segments = [];
        let totalMeters = 0;
        let estimatedSeconds = 0;

        try {
            try {
                const smartResponse = await fetch('/api/route/smart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ waypoints })
                });

                if (!smartResponse.ok) {
                    throw new Error('smart route failed');
                }

                const routeData = await smartResponse.json();
                const smartSegments = routeData?.route?.segments || [];
                segments = smartSegments.map((segment) => ({
                    coordinates: segment.coordinates || segment
                }));
                totalMeters = Math.round((routeData.route?.total_distance || routeData.total_distance || 0) * 1000);
                estimatedSeconds = Math.round((routeData.route?.estimated_time || routeData.estimated_time || 0) * 60);
            } catch (error) {
                console.warn('Smart routing failed, falling back to straight lines:', error);

                const coordinates = waypoints.map((waypoint) => ({
                    lat: waypoint.lat,
                    lng: waypoint.lng
                }));
                segments = [{ coordinates }];

                const earthRadius = 6371000;
                const toRad = (value) => value * Math.PI / 180;

                for (let index = 1; index < coordinates.length; index += 1) {
                    const a = coordinates[index - 1];
                    const b = coordinates[index];
                    const dLat = toRad(b.lat - a.lat);
                    const dLng = toRad(b.lng - a.lng);
                    const lat1 = toRad(a.lat);
                    const lat2 = toRad(b.lat);
                    const haversine = Math.sin(dLat / 2) ** 2
                        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
                    totalMeters += 2 * earthRadius * Math.asin(Math.sqrt(haversine));
                }

                estimatedSeconds = Math.round(totalMeters / 1.2);
            }

            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch(`${apiBase}/admin/routes/${routeId}/geometry`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    geometry: segments,
                    total_distance: totalMeters,
                    estimated_time: estimatedSeconds,
                    waypoints
                })
            });

            if (!response.ok) {
                throw new Error('Geometri kaydedilemedi');
            }

            showNotification('Rota geometri kaydedildi', 'success');
            await loadRoutes();
            await showSelectedRouteOnMap(
                allRoutes.find((route) => getRouteId(route) === routeId) || currentRoute
            );
        } catch (error) {
            console.error('Build route error:', error);
            showNotification('Rota oluşturma/kaydetme hatası', 'error');
        }
    }

    function previewRouteFromAssociatedPOIs() {
        const orderedPois = getValidWaypointPois();
        if (orderedPois.length < 2) {
            showNotification('Önizleme için en az 2 geçerli POI seçin', 'warning');
            return;
        }

        if (!map) return;

        const latlngs = orderedPois.map((poi) => [poi.latitude || poi.lat, poi.longitude || poi.lng || poi.lon]);

        if (routeLayers.__preview__) {
            try {
                map.removeLayer(routeLayers.__preview__);
            } catch (_) {
                // Ignore stale preview layers.
            }
        }

        const layer = L.polyline(latlngs, {
            color: '#10b981',
            weight: 4,
            opacity: 0.9,
            dashArray: '6,4'
        }).addTo(map);

        routeLayers.__preview__ = layer;
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }

    async function findNearbyPOIs() {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        try {
            showNotification('Yakın POI\'ler aranıyor...', 'info');

            const response = await fetch(`${apiBase}/routes/${routeId}/nearby-pois`, {
                credentials: 'include'
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Yakın POI\'ler bulunamadı');
            }

            const nearbyPois = Array.isArray(data.nearby_pois) ? data.nearby_pois : [];
            const maxDistance = data.parameters?.max_distance_meters || '';

            if (nearbyPois.length === 0) {
                showNotification('Rota yakınında POI bulunamadı', 'info');
                return;
            }

            showNotification(
                `${nearbyPois.length} yakın POI bulundu${maxDistance ? ` (${maxDistance}m)` : ''}`,
                'success'
            );
            displayNearbyPOIsModal(nearbyPois, maxDistance);
        } catch (error) {
            console.error('Nearby POI search error:', error);
            showError(`Yakın POI'ler aranırken hata oluştu: ${error.message}`);
        }
    }

    async function autoAssociateNearbyPOIs() {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        try {
            showNotification('Yakın POI\'ler otomatik ekleniyor...', 'info');

            const response = await fetch(`${apiBase}/routes/${routeId}/auto-associate-pois`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ auto_confirm: true })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Otomatik POI ekleme başarısız');
            }

            const associatedCount = data.associated_count || 0;
            if (associatedCount === 0) {
                showNotification('Eklenecek yakın POI bulunamadı', 'info');
                return;
            }

            showNotification(`${associatedCount} POI otomatik olarak rotaya eklendi`, 'success');
            await loadPOIsForAssociation(routeId);
            await loadAndDisplayRoutePOIs(routeId);
        } catch (error) {
            console.error('Auto-associate POI error:', error);
            showError(`Otomatik POI ekleme hatası: ${error.message}`);
        }
    }

    function displayNearbyPOIsModal(nearbyPois, maxDistance) {
        const titleSuffix = maxDistance ? ` (${escapeHtml(String(maxDistance))}m içinde)` : '';
        const modalHtml = `
            <div class="modal fade" id="nearbyPoisModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-map-marker-alt me-2"></i>
                                Yakın POI'ler${titleSuffix}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                ${nearbyPois.map((poi) => {
                                    const poiId = normalizePoiId(poi);
                                    if (poiId === null) return '';
                                    const category = getPoiCategoryConfig(poi.category);
                                    return `
                                        <div class="col-md-6 mb-3">
                                            <div class="card h-100">
                                                <div class="card-body">
                                                    <h6 class="card-title">
                                                        <i class="fas fa-map-pin me-1"></i>
                                                        ${escapeHtml(poi.name || 'İsimsiz POI')}
                                                    </h6>
                                                    <p class="card-text small text-muted mb-2">
                                                        ${escapeHtml(poi.description || 'Açıklama yok')}
                                                    </p>
                                                    <div class="d-flex justify-content-between align-items-center">
                                                        <span class="badge bg-primary">${escapeHtml(category.name)}</span>
                                                        <span class="text-muted small">
                                                            ${Math.round(poi.distance_meters || 0)}m
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="card-footer">
                                                    <button class="btn btn-success btn-sm w-100"
                                                            onclick="associatePOI(${poiId}); bootstrap.Modal.getInstance(document.getElementById('nearbyPoisModal')).hide();">
                                                        <i class="fas fa-plus me-1"></i>
                                                        Rotaya Ekle
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                            <button type="button" class="btn btn-success" onclick="addAllNearbyPOIs([${nearbyPois.map((poi) => normalizePoiId(poi)).filter((id) => id !== null).join(',')}])">
                                <i class="fas fa-plus-circle me-1"></i>
                                Tümünü Ekle
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('nearbyPoisModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('nearbyPoisModal')).show();
    }

    async function addAllNearbyPOIs(poiIds) {
        const routeId = requireCurrentRoute();
        if (!routeId) return;

        const normalizedIds = poiIds
            .map(normalizePoiId)
            .filter((id) => id !== null);

        if (normalizedIds.length === 0) {
            return;
        }

        const originalIds = getAssociatedPoiOrder();
        const existingIds = new Set(originalIds);
        const idsToAdd = normalizedIds.filter((id) => !existingIds.has(id));

        if (idsToAdd.length === 0) {
            showNotification('Eklenecek yeni POI bulunamadı', 'info');
            return;
        }

        const nextIds = [...originalIds, ...idsToAdd];
        setAssociatedPoiOrder(nextIds);

        try {
            showNotification(`${idsToAdd.length} POI rotaya ekleniyor...`, 'info');
            await persistAssociatedPois(routeId, nextIds);
            showNotification(`${idsToAdd.length} POI başarıyla eklendi`, 'success');

            const modalElement = document.getElementById('nearbyPoisModal');
            const modal = modalElement ? bootstrap.Modal.getInstance(modalElement) : null;
            if (modal) {
                modal.hide();
            }

            await loadPOIsForAssociation(routeId);
            await loadAndDisplayRoutePOIs(routeId);
            if (currentRoute) {
                await showSelectedRouteOnMap(currentRoute);
            }
        } catch (error) {
            setAssociatedPoiOrder(originalIds);
            console.error('Bulk POI add error:', error);
            showError('POI\'ler eklenirken hata oluştu');
        }
    }

    global.loadPOIsForAssociation = loadPOIsForAssociation;
    global.displayAvailablePOIs = displayAvailablePOIs;
    global.displayAssociatedPOIs = displayAssociatedPOIs;
    global.searchPOIs = searchPOIs;
    global.associatePOI = associatePOI;
    global.disassociatePOI = disassociatePOI;
    global.reorderAssociatedPOI = reorderAssociatedPOI;
    global.buildAndSaveRouteFromAssociatedPOIs = buildAndSaveRouteFromAssociatedPOIs;
    global.previewRouteFromAssociatedPOIs = previewRouteFromAssociatedPOIs;
    global.findNearbyPOIs = findNearbyPOIs;
    global.autoAssociateNearbyPOIs = autoAssociateNearbyPOIs;
    global.displayNearbyPOIsModal = displayNearbyPOIsModal;
    global.addAllNearbyPOIs = addAllNearbyPOIs;
})(window);
