(function (global) {
    'use strict';

    function resetWorkspaceView() {
        updateMapTitle();

        document.querySelectorAll('.route-item').forEach((item) => {
            item.classList.remove('selected');
        });

        const workspaceContent = document.getElementById('workspaceContent');
        if (workspaceContent) {
            workspaceContent.innerHTML = `
                <div class="empty-workspace">
                    <i class="fas fa-route"></i>
                    <h4>Rota Secin</h4>
                    <p>Detaylari goruntulemek icin sol taraftan bir rota secin</p>
                </div>
            `;
        }

        const workspaceActions = document.getElementById('workspaceActions');
        if (workspaceActions) {
            workspaceActions.style.display = 'none';
        }
    }

    function initializeMap() {
        map = L.map('routeMap').setView([38.7312, 34.4547], 10);
        global.map = map;

        addBaseLayers(map);
        poiMarkersLayer = L.layerGroup().addTo(map);

        if (global.ElevationChart) {
            global.routeElevationChart = new ElevationChart('routeElevationChartContainer', map);
        }

        global.setTimeout(() => {
            try {
                map.invalidateSize();
            } catch (_) {
                // Ignore stale map resize failures.
            }
        }, 100);
    }

    function refreshRoutes() {
        loadRoutes();
    }

    function clearMapRoutes() {
        clearAllRoutesFromMap();

        if (poiMarkersLayer) {
            poiMarkersLayer.clearLayers();
        }

        if (typeof clearAllCoordinateMarkers === 'function') {
            clearAllCoordinateMarkers();
        }

        if (typeof disablePhotoLocationSelection === 'function') {
            disablePhotoLocationSelection();
        }

        selectedRoutes.clear();
        currentRoute = null;
        displayRoutes();
        updateBulkActions();
        resetWorkspaceView();
        showNotification('Harita temizlendi', 'success');
    }

    function generateUniqueRouteName(baseName = 'Yeni Rota') {
        try {
            const existingNames = new Set((allRoutes || []).map((route) => String(route?.name || '').toLowerCase()));
            if (!existingNames.has(baseName.toLowerCase())) {
                return baseName;
            }

            let suffix = 2;
            let candidate = `${baseName} ${suffix}`;
            while (existingNames.has(candidate.toLowerCase())) {
                suffix += 1;
                candidate = `${baseName} ${suffix}`;
            }
            return candidate;
        } catch (_) {
            const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
            return `${baseName} ${timestamp}`;
        }
    }

    async function createAndEditRoute() {
        const routeData = {
            name: generateUniqueRouteName('Yeni Rota'),
            description: '',
            route_type: 'walking',
            difficulty_level: 1,
            is_active: true
        };

        try {
            const response = await fetch(`${apiBase}/admin/routes`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                body: JSON.stringify(routeData)
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || payload?.error || 'Bilinmeyen hata');
            }

            await loadRoutes();
            const routeId = getRouteId(payload) ?? payload.id;
            if (routeId != null) {
                selectRoute(routeId);
            }
            editCurrentRoute();
            showNotification('Yeni rota olusturuldu', 'success');
        } catch (error) {
            console.error('Error creating route:', error);
            showNotification(`Rota olusturulamadi: ${error.message}`, 'error');
        }
    }

    function toggleMapFullscreen() {
        const mapView = document.querySelector('.route-map-view');
        const fullscreenButton = document.getElementById('fullscreenBtn');
        const icon = fullscreenButton?.querySelector('i');

        if (!mapView || !fullscreenButton || !icon) {
            return;
        }

        if (mapView.classList.contains('fullscreen')) {
            mapView.classList.remove('fullscreen');
            document.body.classList.remove('map-fullscreen');
            icon.className = 'fas fa-expand';
            fullscreenButton.title = 'Tam Ekran';
        } else {
            mapView.classList.add('fullscreen');
            document.body.classList.add('map-fullscreen');
            icon.className = 'fas fa-compress';
            fullscreenButton.title = 'Tam Ekrandan Cik';
        }

        global.setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 300);
    }

    function toggleMapLayer(layerType) {
        showNotification(`${layerType} katmani ozelligi yakinda eklenecek`, 'info');
    }

    function exportSelected() {
        if (!selectedRoutes.size) {
            showNotification('Disa aktarim icin rota secin', 'info');
            return;
        }

        const selectedRouteData = allRoutes.filter((route) => selectedRoutes.has(getRouteId(route)));
        downloadFile(
            JSON.stringify(selectedRouteData, null, 2),
            `selected-routes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
            'application/json'
        );
        showNotification(`${selectedRouteData.length} rota JSON olarak disa aktarildi`, 'success');
    }

    function bulkEdit() {
        if (selectedRoutes.size > 0) {
            showNotification(`${selectedRoutes.size} rota toplu duzenleme ozelligi henuz tanimli degil`, 'info');
        }
    }

    function deleteSelected() {
        if (!selectedRoutes.size) {
            return;
        }

        if (confirm(`${selectedRoutes.size} rotayi silmek istediginizden emin misiniz?\n\nBu islem geri alinamaz!`)) {
            deleteSelectedRoutes();
        }
    }

    function removeRouteFromState(routeId) {
        allRoutes = allRoutes.filter((route) => String(getRouteId(route)) !== String(routeId));
        filteredRoutes = filteredRoutes.filter((route) => String(getRouteId(route)) !== String(routeId));

        if (routeLayers[routeId]) {
            map?.removeLayer(routeLayers[routeId]);
            delete routeLayers[routeId];
        }
    }

    async function deleteSelectedRoutes() {
        const routeIds = Array.from(selectedRoutes);
        let successCount = 0;
        let errorCount = 0;
        let deletedCurrentRoute = false;

        showNotification(`${routeIds.length} rota siliniyor...`, 'info');

        for (const routeId of routeIds) {
            try {
                const response = await fetch(`${apiBase}/admin/routes/${routeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        csrf_token: csrfToken || ''
                    })
                });

                if (response.ok || response.status === 404) {
                    successCount += 1;
                    removeRouteFromState(routeId);

                    if (currentRoute && String(getRouteId(currentRoute)) === String(routeId)) {
                        deletedCurrentRoute = true;
                    }
                } else {
                    errorCount += 1;
                    console.error(`HTTP error deleting route ${routeId}:`, response.status);
                }
            } catch (error) {
                errorCount += 1;
                console.error(`Error deleting route ${routeId}:`, error);
            }
        }

        selectedRoutes.clear();

        if (deletedCurrentRoute) {
            currentRoute = null;
            if (poiMarkersLayer) {
                poiMarkersLayer.clearLayers();
            }
            resetWorkspaceView();
        }

        displayRoutes();
        updateBulkActions();

        if (Object.keys(routeLayers).length > 0) {
            fitMapToRoutes();
        } else if (global.routeElevationChart) {
            global.routeElevationChart.hideChart();
        }

        if (successCount > 0 && errorCount === 0) {
            showNotification(`${successCount} rota basariyla silindi`, 'success');
        } else if (successCount > 0 && errorCount > 0) {
            showNotification(`${successCount} rota silindi, ${errorCount} rota silinemedi`, 'warning');
        } else {
            showNotification('Rotalar silinemedi', 'error');
        }
    }

    global.initializeMap = initializeMap;
    global.refreshRoutes = refreshRoutes;
    global.clearMapRoutes = clearMapRoutes;
    global.generateUniqueRouteName = generateUniqueRouteName;
    global.createAndEditRoute = createAndEditRoute;
    global.toggleMapFullscreen = toggleMapFullscreen;
    global.toggleMapLayer = toggleMapLayer;
    global.exportSelected = exportSelected;
    global.bulkEdit = bulkEdit;
    global.deleteSelected = deleteSelected;
    global.deleteSelectedRoutes = deleteSelectedRoutes;
})(window);
