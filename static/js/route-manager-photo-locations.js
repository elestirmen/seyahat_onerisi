(function (global) {
    'use strict';

    global.pendingExifLocation = null;

    document.addEventListener('change', (event) => {
        if (event.target && event.target.id === 'routeMediaFile' && event.target.files && event.target.files.length > 0) {
            global.pendingExifLocation = null;
        }
    }, true);

    let photoLocationMode = false;
    let selectedPhotoForLocation = null;
    let photoLocationMarkers = {};

    function encodeMediaFilename(filename) {
        return encodeURIComponent(String(filename || ''));
    }

    function normalizeMediaItems(payload) {
        const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.media) ? payload.media : []);

        items.forEach((media) => {
            if (media.media_type) return;

            const path = String(media.filename || media.file_path || media.path || '').toLowerCase();
            if (path.match(/\.(webp|jpg|jpeg|png|gif|bmp|tiff)$/)) media.media_type = 'image';
            else if (path.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) media.media_type = 'video';
            else if (path.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) media.media_type = 'audio';
            else if (path.match(/\.(glb|gltf|obj|fbx|dae|ply|stl)$/)) media.media_type = 'model_3d';
            else media.media_type = 'unknown';
        });

        return items;
    }

    function getCurrentRouteId() {
        return currentRoute ? getRouteId(currentRoute) : null;
    }

    function getMediaFilename(media) {
        return media?.filename || media?.name || media?.path?.split('/')?.pop() || 'Unknown';
    }

    function getMediaCoordinates(media) {
        const lat = Number.parseFloat(media?.lat ?? media?.latitude);
        const lng = Number.parseFloat(media?.lng ?? media?.longitude ?? media?.lon);
        return {
            lat,
            lng,
            valid: Number.isFinite(lat) && Number.isFinite(lng)
        };
    }

    function getRoutePathCoordinates(route) {
        if (Array.isArray(route?.coordinates)) {
            return route.coordinates.map((coord) => ({
                lat: Number(coord?.[1] ?? coord?.lat ?? coord?.latitude),
                lng: Number(coord?.[0] ?? coord?.lng ?? coord?.longitude)
            })).filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));
        }

        const geometryCoordinates =
            route?.geometry?.coordinates
            || route?.geometry?.geometry?.coordinates
            || null;

        if (Array.isArray(geometryCoordinates)) {
            return geometryCoordinates.map((coord) => ({
                lat: Number(coord?.[1] ?? coord?.lat ?? coord?.latitude),
                lng: Number(coord?.[0] ?? coord?.lng ?? coord?.longitude)
            })).filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));
        }

        return [];
    }

    async function fetchRouteMedia(routeId) {
        const response = await fetch(`${apiBase}/admin/routes/${routeId}/media`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Medya dosyalari alinamadi');
        }
        return normalizeMediaItems(await response.json());
    }

    async function fetchRouteDetail(routeId) {
        const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Rota bilgileri alinamadi');
        }
        return response.json();
    }

    function logLocationOperation(operation, filename, routeId, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            operation,
            filename,
            routeId,
            apiBase,
            csrfToken: csrfToken ? 'present' : 'missing',
            userAgent: navigator.userAgent,
            ...details
        };

        console.group(`Location Operation: ${operation}`);
        console.log('Details:', logData);
        console.groupEnd();

        try {
            const logs = JSON.parse(localStorage.getItem('locationOperationLogs') || '[]');
            logs.push(logData);
            if (logs.length > 100) {
                logs.shift();
            }
            localStorage.setItem('locationOperationLogs', JSON.stringify(logs));
        } catch (_) {
            // Ignore localStorage failures.
        }
    }

    async function extractExifLocation(file) {
        return new Promise((resolve) => {
            try {
                EXIF.getData(file, function () {
                    const latitude = EXIF.getTag(this, 'GPSLatitude');
                    const longitude = EXIF.getTag(this, 'GPSLongitude');
                    const latitudeRef = EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
                    const longitudeRef = EXIF.getTag(this, 'GPSLongitudeRef') || 'E';

                    if (!latitude || !longitude) {
                        resolve(null);
                        return;
                    }

                    const toFloat = (value) => (value?.numerator ? value.numerator / value.denominator : value);
                    const dmsToDecimal = (value, ref) => {
                        const decimal = toFloat(value[0]) + toFloat(value[1]) / 60 + toFloat(value[2]) / 3600;
                        return (ref === 'S' || ref === 'W') ? -decimal : decimal;
                    };

                    resolve({
                        lat: dmsToDecimal(latitude, latitudeRef),
                        lng: dmsToDecimal(longitude, longitudeRef)
                    });
                });
            } catch (_) {
                resolve(null);
            }
        });
    }

    function inferMediaTypeForFilename(filename) {
        try {
            if (!filename) return 'image';

            const lowered = String(filename).toLowerCase();
            const cachedMedia = (global.currentRouteMediaFilesCache || []).find((item) => {
                const itemName = String(item?.filename || item?.name || item?.path?.split('/')?.pop() || '').toLowerCase();
                return itemName === lowered;
            });

            if (!cachedMedia) return 'image';
            if (cachedMedia.media_type === 'panorama' || cachedMedia.is_pano === true) {
                return 'panorama';
            }
            return cachedMedia.media_type || 'image';
        } catch (_) {
            return 'image';
        }
    }

    function isLikelyPanoramaName(name) {
        try {
            return /(\b|[_-])(360|pano|panorama|equirect|spherical)(\b|[_-]|\.)/.test(String(name || '').toLowerCase());
        } catch (_) {
            return false;
        }
    }

    function enablePhotoLocationSelection() {
        const button = document.getElementById('enablePhotoLocationBtn');
        if (!button) return;

        if (photoLocationMode) {
            disablePhotoLocationSelection();
            return;
        }

        photoLocationMode = true;
        button.innerHTML = '<i class="fas fa-times me-1"></i>Konum Secimi Iptal';
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-danger');

        if (map) {
            map.getContainer().classList.add('select-location');
            map.once('click', handleMapClickForPhotoLocation);
        }

        showNotification('Haritaya tiklayarak fotograf konumu secin', 'info');
    }

    function disablePhotoLocationSelection() {
        const button = document.getElementById('enablePhotoLocationBtn');
        photoLocationMode = false;

        if (button) {
            button.innerHTML = '<i class="fas fa-crosshairs me-1"></i>Haritadan Konum Sec';
            button.classList.remove('btn-danger');
            button.classList.add('btn-outline-primary');
        }

        if (map) {
            map.getContainer().classList.remove('select-location');
            map.off('click', handleMapClickForPhotoLocation);
        }

        selectedPhotoForLocation = null;
    }

    function handleMapClickForPhotoLocation(event) {
        if (!photoLocationMode || !selectedPhotoForLocation) {
            return;
        }

        updatePhotoLocation(selectedPhotoForLocation, event.latlng.lat, event.latlng.lng);
        disablePhotoLocationSelection();
    }

    async function addPhotoLocation(filename) {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodeMediaFilename(filename)}/location/auto`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const payload = await response.json();
                const coords = getMediaCoordinates(payload?.media || {});
                if (coords.valid) {
                    showNotification(`Konum otomatik eklendi: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, 'success');
                    await loadRouteMediaForEdit(routeId);
                    await refreshPhotoLocationMarkers();
                    return;
                }
            }
        } catch (error) {
            console.warn('Otomatik konum eklenemedi:', error);
        }

        selectedPhotoForLocation = filename;
        enablePhotoLocationSelection();
        showNotification(`"${filename}" icin konum secimi aktif. Haritaya tiklayin.`, 'info');
    }

    function editPhotoLocation(filename) {
        selectedPhotoForLocation = filename;
        enablePhotoLocationSelection();
        showNotification(`"${filename}" icin yeni konum secimi aktif. Haritaya tiklayin.`, 'info');
    }

    async function removePhotoLocation(filename) {
        if (!confirm(`"${filename}" icin konum bilgisini kaldirmak istediginizden emin misiniz?`)) {
            return;
        }

        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        const encodedFilename = encodeMediaFilename(filename);
        logLocationOperation('remove_location_start', filename, routeId);

        try {
            if (photoLocationMarkers[filename]) {
                poiMarkersLayer?.removeLayer(photoLocationMarkers[filename]);
                delete photoLocationMarkers[filename];
            }

            let response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodedFilename}/location`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                credentials: 'include'
            });

            logLocationOperation('delete_endpoint_response', filename, routeId, { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                const mediaItems = await fetchRouteMedia(routeId);
                const mediaItem = mediaItems.find((item) => getMediaFilename(item) === filename);
                if (!mediaItem) {
                    throw new Error('Medya dosyasi bulunamadi');
                }

                const updatedMedia = {
                    ...mediaItem,
                    lat: null,
                    lng: null,
                    latitude: null,
                    longitude: null
                };
                delete updatedMedia.filename;

                response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodedFilename}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    credentials: 'include',
                    body: JSON.stringify(updatedMedia)
                });

                if (!response.ok) {
                    response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodedFilename}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken || ''
                        },
                        credentials: 'include',
                        body: JSON.stringify(updatedMedia)
                    });
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Konum kaldirilamadi (HTTP ${response.status}): ${errorText}`);
            }

            showNotification(`"${filename}" icin konum kaldirildi`, 'success');
            await loadRouteMediaForEdit(routeId);
            await refreshPhotoLocationMarkers();
        } catch (error) {
            logLocationOperation('remove_location_error', filename, routeId, { error: error.message });
            console.error('Error removing photo location:', error);
            showNotification(`Konum kaldirilirken hata olustu: ${error.message}`, 'error');
        }
    }

    async function updatePhotoLocation(filename, lat, lng) {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        const encodedFilename = encodeMediaFilename(filename);

        try {
            let response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodedFilename}/location`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                credentials: 'include',
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lng,
                    filename
                })
            });

            if (!response.ok && response.status === 404) {
                const mediaItems = await fetchRouteMedia(routeId);
                const mediaItem = mediaItems.find((item) => getMediaFilename(item) === filename);

                if (mediaItem) {
                    const updatedMedia = {
                        ...mediaItem,
                        lat,
                        lng,
                        latitude: lat,
                        longitude: lng
                    };
                    delete updatedMedia.filename;

                    response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodedFilename}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken || ''
                        },
                        credentials: 'include',
                        body: JSON.stringify(updatedMedia)
                    });
                }
            }

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || 'Konum guncellenemedi');
            }

            showNotification(`"${filename}" icin konum guncellendi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
            await loadRouteMediaForEdit(routeId);
            updatePhotoLocationMarker(filename, lat, lng, inferMediaTypeForFilename(filename));
            await refreshPhotoLocationMarkers();
        } catch (error) {
            console.error('Error updating photo location:', error);
            showNotification(`Konum guncellenirken hata olustu: ${error.message}`, 'error');
        }
    }

    function updatePhotoLocationMarker(filename, lat, lng, mediaType = 'image') {
        if (!poiMarkersLayer || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        if (photoLocationMarkers[filename]) {
            poiMarkersLayer.removeLayer(photoLocationMarkers[filename]);
            delete photoLocationMarkers[filename];
        }

        let effectiveType = mediaType || 'image';
        if (effectiveType === 'image' && isLikelyPanoramaName(filename)) {
            effectiveType = 'panorama';
        }

        const labels = {
            panorama: '360° Panorama',
            image: 'Fotograf',
            video: 'Video',
            audio: 'Ses',
            model_3d: '3D Model'
        };

        const marker = L.marker([lat, lng], {
            icon: getMediaMarkerIcon(effectiveType),
            filename
        }).bindPopup(`
            <div style="min-width:180px">
                <strong>${escapeHtml(labels[effectiveType] || 'Medya')}: ${escapeHtml(filename)}</strong>
                <div style="margin-top:4px;color:#666">Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            </div>
        `);

        photoLocationMarkers[filename] = marker;
        poiMarkersLayer.addLayer(marker);
    }

    async function refreshPhotoLocationMarkers() {
        const routeId = getCurrentRouteId();
        if (!routeId || !poiMarkersLayer) {
            return;
        }

        try {
            const mediaItems = await fetchRouteMedia(routeId);

            Object.values(photoLocationMarkers).forEach((marker) => {
                poiMarkersLayer.removeLayer(marker);
            });
            photoLocationMarkers = {};

            const locatedMedia = mediaItems.filter((media) => getMediaCoordinates(media).valid);
            locatedMedia.forEach((media) => {
                const filename = getMediaFilename(media);
                const coords = getMediaCoordinates(media);
                let mediaType = (media.media_type === 'panorama' || media.is_pano === true) ? 'panorama' : (media.media_type || 'image');
                if (mediaType === 'image' && isLikelyPanoramaName(filename)) {
                    mediaType = 'panorama';
                }
                updatePhotoLocationMarker(filename, coords.lat, coords.lng, mediaType);
            });

            if (global.routeElevationChart) {
                global.routeElevationChart.setMediaMarkers(locatedMedia);
            }
        } catch (error) {
            console.error('Error refreshing photo location markers:', error);
        }
    }

    async function batchSetPhotoLocations() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        try {
            const mediaItems = await fetchRouteMedia(routeId);
            const routePayload = await fetchRouteDetail(routeId);
            const route = routePayload.route || routePayload;
            const coordinates = getRoutePathCoordinates(route);

            if (!coordinates.length) {
                showNotification('Rota koordinatlari bulunamadi', 'warning');
                return;
            }

            const photosWithoutLocation = mediaItems.filter((media) => !getMediaCoordinates(media).valid);
            if (!photosWithoutLocation.length) {
                showNotification('Konum belirlenmemis fotograf bulunamadi', 'info');
                return;
            }

            const step = Math.max(1, Math.floor(coordinates.length / photosWithoutLocation.length));
            let assignedCount = 0;

            for (let index = 0; index < photosWithoutLocation.length && index * step < coordinates.length; index += 1) {
                const coord = coordinates[index * step];
                const photo = photosWithoutLocation[index];
                await updatePhotoLocation(getMediaFilename(photo), coord.lat, coord.lng);
                assignedCount += 1;
            }

            showNotification(`${assignedCount} fotograf icin konum atandi`, 'success');
            await loadRouteMediaForEdit(routeId);
            await refreshPhotoLocationMarkers();
        } catch (error) {
            console.error('Error in batch location assignment:', error);
            showNotification(`Toplu konum atama hatasi: ${error.message}`, 'error');
        }
    }

    function exportPhotoLocations() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        const mediaCards = document.querySelectorAll('.media-item-card.has-location');
        const locations = [];

        mediaCards.forEach((card) => {
            const filename = card.dataset.mediaId;
            const lat = Number.parseFloat(card.dataset.lat);
            const lng = Number.parseFloat(card.dataset.lng);

            if (filename && Number.isFinite(lat) && Number.isFinite(lng)) {
                locations.push({
                    filename,
                    latitude: lat,
                    longitude: lng,
                    coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                });
            }
        });

        if (!locations.length) {
            showNotification('Konum bulunamadi', 'warning');
            return;
        }

        const csvContent = [
            'Dosya Adi,Enlem,Boylam,Koordinatlar',
            ...locations.map((location) => `${location.filename},${location.latitude},${location.longitude},"${location.coordinates}"`)
        ].join('\n');

        downloadFile(csvContent, `route_${routeId}_photo_locations.csv`, 'text/csv;charset=utf-8;');
        showNotification(`${locations.length} konum CSV olarak disa aktarildi`, 'success');
    }

    function importPhotoLocations() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const lines = text.split('\n');
                const headers = lines[0].split(',');
                const filenameIndex = headers.findIndex((header) => header.includes('Dosya') || header.includes('File'));
                const latIndex = headers.findIndex((header) => header.includes('Enlem') || header.includes('Latitude') || header.includes('Lat'));
                const lngIndex = headers.findIndex((header) => header.includes('Boylam') || header.includes('Longitude') || header.includes('Lng'));

                if (filenameIndex === -1 || latIndex === -1 || lngIndex === -1) {
                    throw new Error('CSV formati taninmadi. Gerekli sutunlar: Dosya Adi, Enlem, Boylam');
                }

                let importedCount = 0;
                let errorCount = 0;

                for (let index = 1; index < lines.length; index += 1) {
                    if (!lines[index].trim()) continue;

                    const values = lines[index].split(',');
                    const filename = values[filenameIndex]?.trim().replace(/"/g, '');
                    const lat = Number.parseFloat(values[latIndex]);
                    const lng = Number.parseFloat(values[lngIndex]);

                    if (filename && Number.isFinite(lat) && Number.isFinite(lng)) {
                        try {
                            await updatePhotoLocation(filename, lat, lng);
                            importedCount += 1;
                        } catch (_) {
                            errorCount += 1;
                        }
                    }
                }

                if (importedCount > 0) {
                    showNotification(`${importedCount} konum basariyla ice aktarildi${errorCount > 0 ? `, ${errorCount} hata` : ''}`, 'success');
                } else {
                    showNotification('Hicbir konum ice aktarilamadi', 'warning');
                }
            } catch (error) {
                console.error('CSV import error:', error);
                showNotification(`CSV ice aktarma hatasi: ${error.message}`, 'error');
            }
        };

        input.click();
    }

    async function autoExtractAllPhotoLocations() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        try {
            showNotification('Tum fotograflar icin EXIF konum bilgisi araniyor...', 'info');
            const mediaItems = await fetchRouteMedia(routeId);
            const imagesWithoutLocation = mediaItems.filter((media) =>
                media.media_type === 'image'
                && !getMediaCoordinates(media).valid
            );

            if (!imagesWithoutLocation.length) {
                showNotification('Konum belirlenmemis fotograf bulunamadi', 'info');
                return;
            }

            let extractedCount = 0;
            let failedCount = 0;

            for (const media of imagesWithoutLocation) {
                const filename = getMediaFilename(media);

                try {
                    const response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodeMediaFilename(filename)}/location/auto`, {
                        method: 'POST',
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const payload = await response.json();
                        if (getMediaCoordinates(payload?.media || {}).valid) {
                            extractedCount += 1;
                        } else {
                            failedCount += 1;
                        }
                    } else {
                        failedCount += 1;
                    }
                } catch (error) {
                    failedCount += 1;
                    console.error(`Error extracting location for ${filename}:`, error);
                }

                await new Promise((resolve) => global.setTimeout(resolve, 100));
            }

            if (extractedCount > 0) {
                showNotification(`${extractedCount} fotograf icin EXIF konum bilgisi cikarildi${failedCount > 0 ? ` (${failedCount} basarisiz)` : ''}`, 'success');
                await loadRouteMediaForEdit(routeId);
                await refreshPhotoLocationMarkers();
            } else {
                showNotification(`Hicbir fotograf icin EXIF konum bilgisi cikarilamadi (${failedCount} basarisiz)`, 'warning');
            }
        } catch (error) {
            console.error('Error in auto EXIF extraction:', error);
            showNotification(`Otomatik EXIF cikarma hatasi: ${error.message}`, 'error');
        }
    }

    async function clearAllPhotoLocations() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Aktif rota bulunamadi', 'error');
            return;
        }

        if (!confirm('Tum fotograf konumlarini kaldirmak istediginizden emin misiniz? Bu islem geri alinamaz.')) {
            return;
        }

        try {
            const mediaItems = await fetchRouteMedia(routeId);

            Object.values(photoLocationMarkers).forEach((marker) => {
                poiMarkersLayer?.removeLayer(marker);
            });
            photoLocationMarkers = {};

            let clearedCount = 0;

            for (const media of mediaItems) {
                if (!getMediaCoordinates(media).valid) {
                    continue;
                }

                const updatedMedia = {
                    ...media,
                    lat: null,
                    lng: null,
                    latitude: null,
                    longitude: null
                };
                delete updatedMedia.filename;

                const filename = getMediaFilename(media);
                const response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodeMediaFilename(filename)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    credentials: 'include',
                    body: JSON.stringify(updatedMedia)
                });

                if (response.ok) {
                    clearedCount += 1;
                }
            }

            showNotification(`${clearedCount} fotograf konumu kaldirildi`, 'success');
            await loadRouteMediaForEdit(routeId);
            await refreshPhotoLocationMarkers();
        } catch (error) {
            console.error('Error clearing photo locations:', error);
            showNotification(`Fotograf konumlari kaldirilirken hata olustu: ${error.message}`, 'error');
        }
    }

    global.extractExifLocation = extractExifLocation;
    global.logLocationOperation = logLocationOperation;
    global.enablePhotoLocationSelection = enablePhotoLocationSelection;
    global.disablePhotoLocationSelection = disablePhotoLocationSelection;
    global.handleMapClickForPhotoLocation = handleMapClickForPhotoLocation;
    global.addPhotoLocation = addPhotoLocation;
    global.editPhotoLocation = editPhotoLocation;
    global.removePhotoLocation = removePhotoLocation;
    global.inferMediaTypeForFilename = inferMediaTypeForFilename;
    global.isLikelyPanoramaName = isLikelyPanoramaName;
    global.updatePhotoLocation = updatePhotoLocation;
    global.updatePhotoLocationMarker = updatePhotoLocationMarker;
    global.refreshPhotoLocationMarkers = refreshPhotoLocationMarkers;
    global.batchSetPhotoLocations = batchSetPhotoLocations;
    global.exportPhotoLocations = exportPhotoLocations;
    global.importPhotoLocations = importPhotoLocations;
    global.autoExtractAllPhotoLocations = autoExtractAllPhotoLocations;
    global.clearAllPhotoLocations = clearAllPhotoLocations;
})(window);
