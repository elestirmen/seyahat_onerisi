(function (global) {
    'use strict';

    function getRouteTypeColor(route) {
        return ROUTE_TYPES?.[route?.route_type]?.color || '#2563eb';
    }

    function getPoiCategoryConfig(categoryKey) {
        const category = POI_CATEGORIES?.[categoryKey];
        return {
            icon: category?.icon || 'map-marker-alt',
            color: category?.color || '#2563eb',
            name: category?.name || categoryKey || 'Kategori yok'
        };
    }

    function sortPoisByOrder(pois) {
        return (pois || []).slice().sort((a, b) => (a.order_in_route || 0) - (b.order_in_route || 0));
    }

    function createCustomPoiMarker(poi, index) {
        const lat = Number(poi?.lat || poi?.latitude);
        const lng = Number(poi?.lon || poi?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }

        const category = getPoiCategoryConfig(poi.category);
        const customIcon = L.divIcon({
            className: 'custom-poi-marker',
            html: `
                <div class="poi-marker-container" style="background-color: ${category.color}">
                    <i class="fas fa-${category.icon}"></i>
                    <div class="poi-order-number">${poi.order_in_route || index + 1}</div>
                </div>
            `,
            iconSize: [35, 35],
            iconAnchor: [17, 35],
            popupAnchor: [0, -35]
        });

        const marker = L.marker([lat, lng], {
            icon: customIcon,
            title: poi.name || `POI ${index + 1}`
        });

        marker.bindPopup(`
            <div class="poi-popup">
                <div class="poi-popup-header">
                    <i class="fas fa-${category.icon}" style="color: ${category.color}"></i>
                    <strong>${escapeHtml(poi.name || 'POI')}</strong>
                </div>
                <div class="poi-popup-category">${escapeHtml(category.name)}</div>
                ${poi.description ? `<div class="poi-popup-description">${escapeHtml(poi.description.substring(0, 100))}${poi.description.length > 100 ? '...' : ''}</div>` : ''}
                <div class="poi-popup-order">Sıra: ${poi.order_in_route || index + 1}</div>
            </div>
        `);

        return marker;
    }

    function clearAllRoutesFromMap() {
        Object.values(routeLayers).forEach((layer) => {
            try {
                map.removeLayer(layer);
            } catch (error) {
                console.warn('Layer removal error:', error);
            }
        });

        routeLayers = {};

        if (global.routeElevationChart) {
            global.routeElevationChart.hideChart();
        }
    }

    async function createRouteFromPOIs(route, color) {
        const routeId = getRouteId(route);
        if (!routeId) return;

        try {
            let routeDetails = route;
            if (!route.elevation_profile) {
                try {
                    const detailResponse = await rateLimitedFetch(`${apiBase}/admin/routes/${routeId}`, {
                        credentials: 'include'
                    });
                    if (detailResponse.ok) {
                        routeDetails = await detailResponse.json();
                    }
                } catch (error) {
                    console.warn('Rota detayları alınamadı:', error);
                }
            }

            const response = await rateLimitedFetch(`${apiBase}/admin/routes/${routeId}/pois`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('POI listesi alınamadı');
            }

            const data = await response.json();
            const pois = data.pois || data.results || [];
            const latlngs = pois
                .filter((poi) => poi.latitude && poi.longitude)
                .map((poi) => [parseFloat(poi.latitude), parseFloat(poi.longitude)]);

            if (latlngs.length <= 1) {
                showNotification('Bu rotada yeterli POI koordinatı bulunamadı', 'warning');
                return;
            }

            const layer = L.polyline(latlngs, {
                color,
                weight: 4,
                opacity: 0.8,
                dashArray: '8,4'
            }).addTo(map);

            routeLayers[routeId] = layer;

            pois.forEach((poi, index) => {
                if (poi.latitude && poi.longitude) {
                    const marker = L.marker([parseFloat(poi.latitude), parseFloat(poi.longitude)])
                        .bindPopup(`
                            <strong>${escapeHtml(poi.name || 'POI')}</strong><br>
                            <small>Sıra: ${index + 1}</small>
                        `);
                    poiMarkersLayer.addLayer(marker);
                }
            });

            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            showNotification(`${pois.length} POI ile dinamik rota oluşturuldu`, 'success');

            if (global.routeElevationChart) {
                if (routeDetails.elevation_profile?.points) {
                    await global.routeElevationChart.loadElevationProfile(routeDetails.elevation_profile);
                } else {
                    await global.routeElevationChart.loadRouteElevation({
                        pois: pois.map((poi) => ({
                            latitude: poi.latitude || poi.lat,
                            longitude: poi.longitude || poi.lng || poi.lon,
                            name: poi.name || ''
                        }))
                    });
                }
            }
        } catch (error) {
            console.error('POI-based rota oluşturma hatası:', error);
            showNotification('Dinamik rota oluşturulamadı', 'error');
        }
    }

    async function showSingleRouteOnMap(route) {
        const routeId = getRouteId(route);
        if (!routeId) {
            console.warn('Route ID bulunamadı:', route);
            return;
        }

        try {
            let routeDetails = route;
            if (!route.elevation_profile || !route.geometry) {
                try {
                    const detailResponse = await rateLimitedFetch(`${apiBase}/admin/routes/${routeId}`, {
                        credentials: 'include'
                    });
                    if (detailResponse.ok) {
                        routeDetails = await detailResponse.json();
                    }
                } catch (error) {
                    console.warn('Rota detayları alınamadı:', error);
                }
            }

            let geometry = route.geometry || routeDetails.geometry;
            if (!geometry || typeof geometry === 'string') {
                try {
                    const response = await rateLimitedFetch(`${apiBase}/routes/${routeId}/geometry`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.geometry) {
                            geometry = data.geometry;
                        }
                    }
                } catch (error) {
                    console.warn('Geometri API çağrısı başarısız:', error);
                }
            }

            if (!geometry) {
                showNotification('Bu rotanın geometrisi bulunamadı', 'warning');
                return;
            }

            if (typeof geometry === 'string') {
                try {
                    geometry = JSON.parse(geometry);
                } catch (error) {
                    console.warn('Geometry JSON parse hatası:', error);
                    return;
                }
            }

            const color = getRouteTypeColor(routeDetails);
            let layer = null;

            if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
                layer = L.polyline(geometry.coordinates.map((coord) => [coord[1], coord[0]]), {
                    color,
                    weight: 4,
                    opacity: 0.8
                });
            } else if (geometry.geometry?.type === 'LineString') {
                const coordinates = geometry.geometry.coordinates || [];
                if (coordinates.length > 0) {
                    layer = L.polyline(coordinates.map((coord) => [coord[1], coord[0]]), {
                        color,
                        weight: 4,
                        opacity: 0.8
                    });
                }
            } else if (Array.isArray(geometry.waypoints) && geometry.waypoints.length > 0) {
                const latlngs = geometry.waypoints.map((waypoint) => [waypoint.lat || waypoint.latitude, waypoint.lng || waypoint.longitude]);
                if (latlngs.length > 1) {
                    layer = L.polyline(latlngs, {
                        color,
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '5,5'
                    });
                }
            } else {
                await createRouteFromPOIs(routeDetails, color);
                return;
            }

            if (!layer) {
                showNotification('Rota geometrisi işlenemedi', 'warning');
                return;
            }

            layer.addTo(map);
            routeLayers[routeId] = layer;
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });

            if (global.routeElevationChart) {
                if (routeDetails.elevation_profile?.points) {
                    await global.routeElevationChart.loadElevationProfile(routeDetails.elevation_profile);
                } else if (geometry.type === 'LineString' && geometry.coordinates) {
                    await global.routeElevationChart.loadRouteElevation({ geometry });
                } else if (geometry.geometry?.type === 'LineString') {
                    await global.routeElevationChart.loadRouteElevation({ geometry: geometry.geometry });
                } else if (Array.isArray(geometry.waypoints) && geometry.waypoints.length > 0) {
                    await global.routeElevationChart.loadRouteElevation({
                        pois: geometry.waypoints.map((waypoint) => ({
                            latitude: waypoint.lat || waypoint.latitude,
                            longitude: waypoint.lng || waypoint.longitude,
                            name: waypoint.name || ''
                        }))
                    });
                }
            }

            try {
                const mediaResponse = await fetch(`${apiBase}/admin/routes/${routeId}/media`, { credentials: 'include' });
                if (mediaResponse.ok) {
                    const mediaJson = await mediaResponse.json();
                    const mediaItems = Array.isArray(mediaJson)
                        ? mediaJson
                        : (Array.isArray(mediaJson.media) ? mediaJson.media : []);

                    mediaItems.forEach((media) => {
                        if (!media.media_type) {
                            const path = (media.filename || media.file_path || media.path || '').toLowerCase();
                            if (path.match(/\.(webp|jpg|jpeg|png|gif|bmp|tiff)$/)) media.media_type = 'image';
                            else if (path.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) media.media_type = 'video';
                            else if (path.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) media.media_type = 'audio';
                            else if (path.match(/\.(glb|gltf|obj|fbx|dae|ply|stl)$/)) media.media_type = 'model_3d';
                            else media.media_type = 'unknown';
                        }
                    });

                    const locatedMedia = mediaItems.filter((media) => (media.lat || media.latitude) && (media.lng || media.longitude || media.lon));
                    const typeLabels = {
                        panorama: '360° Panorama',
                        image: 'Fotoğraf',
                        video: 'Video',
                        audio: 'Ses',
                        model_3d: '3D Model',
                        unknown: 'Medya'
                    };

                    locatedMedia.forEach((media) => {
                        const lat = parseFloat(media.lat ?? media.latitude);
                        const lng = parseFloat(media.lng ?? media.longitude ?? media.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                        let effectiveType = (media.media_type === 'panorama' || media.is_pano === true) ? 'panorama' : (media.media_type || 'image');
                        const filename = media.filename || media.name || media.path?.split('/')?.pop() || '';
                        if (effectiveType === 'image' && typeof isLikelyPanoramaName === 'function' && isLikelyPanoramaName(filename)) {
                            effectiveType = 'panorama';
                        }

                        const label = typeLabels[effectiveType] || 'Medya';
                        let preview = '';
                        const mediaPath = media.preview_path || media.thumbnail_path || media.file_path;
                        if (mediaPath) {
                            if (effectiveType === 'image' || effectiveType === 'panorama') {
                                preview = `<div style=\"margin-top:8px\"><img src='/${mediaPath}' alt='media' style='width:100%;border-radius:6px;'/></div>`;
                            } else if (effectiveType === 'video') {
                                preview = `<div style=\"margin-top:8px\"><video src='/${mediaPath}' controls style='width:100%;border-radius:6px;max-height:200px'></video></div>`;
                            } else if (media.media_type === 'audio') {
                                preview = `<div style=\"margin-top:8px\"><audio controls style='width:100%'><source src='/${mediaPath}'></audio></div>`;
                            }
                        }

                        const marker = L.marker([lat, lng], { icon: getMediaMarkerIcon(effectiveType) })
                            .bindPopup(`<div style=\"min-width:180px\"><strong>${label}</strong>${media.caption ? `<div style=\\\"margin-top:4px;color:#666\\\">${media.caption}</div>` : ''}${preview}</div>`)
                            .addTo(map);
                        poiMarkersLayer.addLayer(marker);
                    });

                    if (global.routeElevationChart) {
                        global.routeElevationChart.setMediaMarkers(locatedMedia);
                        if (locatedMedia.length > 0) {
                            global.routeElevationChart.setPhotoLocations(locatedMedia);
                        }
                    }
                }
            } catch (error) {
                console.warn('Rota medyası yüklenemedi:', error);
            }
        } catch (error) {
            console.error('Rota yükleme hatası:', error);
            showNotification(`Rota yüklenirken hata oluştu: ${error.message}`, 'error');
        }
    }

    function updateMapTitle(route = null) {
        const mapTitle = document.getElementById('mapTitle');
        if (!mapTitle) return;

        if (route) {
            mapTitle.innerHTML = `
                <i class="fas fa-map me-2"></i>
                <span style="color: ${getRouteTypeColor(route)}">
                    ${escapeHtml(route.name)}
                </span>
            `;
            return;
        }

        mapTitle.innerHTML = `
            <i class="fas fa-map me-2"></i>
            Harita Görünümü
        `;
    }

    async function highlightAndFocusRoute(route) {
        const routeId = getRouteId(route);
        if (!routeId) {
            console.warn('No route ID found');
            return;
        }

        updateMapTitle(route);
        clearAllRoutesFromMap();
        await showSingleRouteOnMap(route);

        global.setTimeout(async () => {
            await loadAndDisplayRoutePOIs(routeId);
            refreshPhotoLocationMarkers();
        }, 100);
    }

    async function loadAndDisplayRoutePOIs(routeId) {
        if (!poiMarkersLayer) return;
        poiMarkersLayer.clearLayers();

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
            if (!response.ok) {
                return;
            }

            const routeDetail = await response.json();
            const pois = sortPoisByOrder(Array.isArray(routeDetail?.pois) ? routeDetail.pois : []);
            pois.forEach((poi, index) => {
                const marker = createCustomPoiMarker(poi, index);
                if (marker) {
                    poiMarkersLayer.addLayer(marker);
                }
            });
        } catch (error) {
            console.error('Error loading route POIs:', error);
        }
    }

    async function showSelectedRouteOnMap(route) {
        const routeId = getRouteId(route);
        if (!routeId) {
            console.warn('No route ID found');
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

        if (poiMarkersLayer) {
            poiMarkersLayer.clearLayers();
        }

        let routeLayer = null;
        const color = getRouteTypeColor(route);

        try {
            if (route.geometry) {
                let geometry = route.geometry;
                if (typeof geometry === 'string') {
                    try {
                        geometry = JSON.parse(geometry);
                    } catch (error) {
                        console.warn('geometry not JSON:', error);
                    }
                }

                if (geometry && typeof geometry === 'object' && geometry.type && geometry.coordinates) {
                    routeLayer = L.geoJSON(geometry, {
                        style: { color, weight: 4, opacity: 0.9 }
                    });
                }
            }

            if (!routeLayer) {
                const response = await fetch(`${apiBase}/admin/routes/${routeId}`, { credentials: 'include' });
                if (response.ok) {
                    const routeDetail = await response.json();
                    const pois = sortPoisByOrder(Array.isArray(routeDetail?.pois) ? routeDetail.pois : []);

                    if (pois.length >= 2) {
                        const waypoints = pois
                            .map((poi) => ({
                                lat: Number(poi.lat || poi.latitude),
                                lng: Number(poi.lon || poi.longitude),
                                name: poi.name
                            }))
                            .filter((waypoint) => Number.isFinite(waypoint.lat) && Number.isFinite(waypoint.lng));

                        if (waypoints.length >= 2) {
                            try {
                                const routeResponse = await fetch('/api/route/smart', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ waypoints })
                                });

                                if (routeResponse.ok) {
                                    const routeData = await routeResponse.json();
                                    const coordinates = [];

                                    if (routeData.route && Array.isArray(routeData.route.segments)) {
                                        routeData.route.segments.forEach((segment) => {
                                            if (Array.isArray(segment?.coordinates)) {
                                                segment.coordinates.forEach((point) => {
                                                    const lat = Number(point.lat);
                                                    const lng = Number(point.lng);
                                                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                                        coordinates.push([lat, lng]);
                                                    }
                                                });
                                            }
                                        });
                                    }

                                    if (coordinates.length >= 2) {
                                        routeLayer = L.polyline(coordinates, {
                                            color,
                                            weight: 4,
                                            opacity: 0.9
                                        });
                                    }
                                }
                            } catch (error) {
                                console.warn('Smart routing failed:', error);
                            }

                            if (!routeLayer) {
                                routeLayer = L.polyline(waypoints.map((waypoint) => [waypoint.lat, waypoint.lng]), {
                                    color,
                                    weight: 4,
                                    opacity: 0.9
                                });
                            }
                        }

                        pois.forEach((poi, index) => {
                            const marker = createCustomPoiMarker(poi, index);
                            if (marker) {
                                poiMarkersLayer.addLayer(marker);
                            }
                        });
                    }
                }
            }

            if (!routeLayer) {
                showNotification('Rota haritada görüntülenemedi', 'warning');
                return;
            }

            routeLayer.bindPopup(`
                <strong>${escapeHtml(route.name)}</strong><br>
                ${escapeHtml(ROUTE_TYPES?.[route.route_type]?.name || route.route_type)}<br>
                ${route.estimated_duration || 0} dakika
            `);

            routeLayers[routeId] = routeLayer;
            routeLayer.addTo(map);

            try {
                const layers = [routeLayer];
                if (poiMarkersLayer.getLayers().length > 0) {
                    layers.push(poiMarkersLayer);
                }
                const group = new L.featureGroup(layers);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
            } catch (error) {
                console.warn('Failed to fit bounds:', error);
            }
        } catch (error) {
            console.error('Error showing route on map:', error);
            showNotification('Rota görüntülenirken hata oluştu', 'error');
        }
    }

    async function renderRoutePoisOnMap(routeId) {
        if (!poiMarkersLayer) return;
        try {
            poiMarkersLayer.clearLayers();
        } catch (_) {
            // Ignore stale marker cleanup failures.
        }

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}/pois`, { credentials: 'include' });
            if (!response.ok) {
                return;
            }

            const data = await response.json();
            const pois = sortPoisByOrder(Array.isArray(data?.pois) ? data.pois : (Array.isArray(data) ? data : []));
            pois.forEach((poi, index) => {
                const lat = Number(poi.lat || poi.latitude);
                const lng = Number(poi.lon || poi.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                const marker = L.marker([lat, lng], {
                    title: poi.name || `POI ${index + 1}`
                });
                marker.bindPopup(`
                    <strong>${escapeHtml(poi.name || 'POI')}</strong><br/>
                    ${poi.category ? escapeHtml(poi.category) : ''}<br/>
                    <small>Sıra: ${poi.order_in_route || index + 1}</small>
                `);
                poiMarkersLayer.addLayer(marker);
            });
        } catch (error) {
            console.warn('renderRoutePoisOnMap failed:', error);
        }
    }

    global.clearAllRoutesFromMap = clearAllRoutesFromMap;
    global.createRouteFromPOIs = createRouteFromPOIs;
    global.showSingleRouteOnMap = showSingleRouteOnMap;
    global.updateMapTitle = updateMapTitle;
    global.highlightAndFocusRoute = highlightAndFocusRoute;
    global.loadAndDisplayRoutePOIs = loadAndDisplayRoutePOIs;
    global.showSelectedRouteOnMap = showSelectedRouteOnMap;
    global.renderRoutePoisOnMap = renderRoutePoisOnMap;
})(window);
