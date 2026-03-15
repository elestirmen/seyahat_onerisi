(function (global) {
    'use strict';

    function toInlineHandlerArg(value) {
        return JSON.stringify(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function getCurrentRouteId() {
        return currentRoute ? getRouteId(currentRoute) : null;
    }

    function getEditWorkspaceActionsMarkup() {
        return `
            <button class="btn-workspace" onclick="saveRouteChanges()">
                <i class="fas fa-save me-1"></i>
                Kaydet
            </button>
            <button class="btn-workspace" onclick="cancelRouteEdit()">
                <i class="fas fa-times me-1"></i>
                İptal
            </button>
        `;
    }

    function buildRouteEditBasicsSection(route) {
        return `
            <div class="form-section">
                <h5><i class="fas fa-info-circle me-2"></i>Temel Bilgiler</h5>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="editRouteName">Rota Adı *</label>
                        <input type="text" id="editRouteName" class="form-control"
                               value="${escapeHtml(route.name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label for="editRouteType">Rota Türü *</label>
                        <select id="editRouteType" class="form-control" required>
                            <option value="walking" ${route.route_type === 'walking' ? 'selected' : ''}>🚶 Yürüyüş</option>
                            <option value="hiking" ${route.route_type === 'hiking' ? 'selected' : ''}>🥾 Doğa Yürüyüşü</option>
                            <option value="cycling" ${route.route_type === 'cycling' ? 'selected' : ''}>🚴 Bisiklet</option>
                            <option value="driving" ${route.route_type === 'driving' ? 'selected' : ''}>🚗 Araba</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="editRouteDescription">Açıklama</label>
                    <textarea id="editRouteDescription" class="form-control" rows="3">${escapeHtml(route.description || '')}</textarea>
                </div>
            </div>
        `;
    }

    function buildRoutePropertiesSection(route) {
        return `
            <div class="form-section">
                <h5><i class="fas fa-chart-bar me-2"></i>Rota Özellikleri</h5>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="editDifficulty">Zorluk Seviyesi</label>
                        <select id="editDifficulty" class="form-control">
                            <option value="1" ${route.difficulty_level === 1 ? 'selected' : ''}>⭐ Çok Kolay</option>
                            <option value="2" ${route.difficulty_level === 2 ? 'selected' : ''}>⭐⭐ Kolay</option>
                            <option value="3" ${route.difficulty_level === 3 ? 'selected' : ''}>⭐⭐⭐ Orta</option>
                            <option value="4" ${route.difficulty_level === 4 ? 'selected' : ''}>⭐⭐⭐⭐ Zor</option>
                            <option value="5" ${route.difficulty_level === 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐ Çok Zor</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editDuration">Tahmini Süre (dakika)</label>
                        <input type="number" id="editDuration" class="form-control"
                               value="${route.estimated_duration || ''}" min="1">
                    </div>
                    <div class="form-group">
                        <label for="editDistance">Mesafe (km)</label>
                        <input type="number" id="editDistance" class="form-control"
                               value="${route.total_distance || ''}" step="0.1" min="0">
                    </div>
                    <div class="form-group">
                        <label for="editElevation">Yükselti Kazancı (m)</label>
                        <input type="number" id="editElevation" class="form-control"
                               value="${route.elevation_gain || ''}" min="0">
                    </div>
                </div>

                <div class="form-group">
                    <label for="editTags">Etiketler (virgülle ayırın)</label>
                    <input type="text" id="editTags" class="form-control"
                           value="${escapeHtml(route.tags || '')}"
                           placeholder="tarihi, doğa, macera">
                </div>

                <div class="form-group">
                    <div class="form-check">
                        <input type="checkbox" id="editIsCircular" class="form-check-input"
                               ${route.is_circular ? 'checked' : ''}>
                        <label for="editIsCircular" class="form-check-label">
                            Dairesel Rota (Başlangıç = Bitiş)
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    function buildPoiAssociationSection() {
        return `
            <div class="form-section">
                <h5><i class="fas fa-map-marker-alt me-2"></i>POI İlişkilendirme</h5>
                <div class="poi-association-container">
                    <div class="poi-search-section" onsubmit="return false;">
                        <div class="search-container">
                            <i class="fas fa-search search-icon"></i>
                            <input type="text" class="search-input" id="poiSearchInput"
                                   placeholder="POI ara..." oninput="searchPOIs()">
                        </div>
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-outline-primary" onclick="findNearbyPOIs()">
                                <i class="fas fa-search-location me-1"></i>Yakın POI'leri Bul
                            </button>
                            <button type="button" class="btn btn-outline-success" onclick="autoAssociateNearbyPOIs()">
                                <i class="fas fa-magic me-1"></i>Otomatik Ekle
                            </button>
                        </div>
                    </div>

                    <div class="poi-lists-container">
                        <div class="available-pois">
                            <h6>Mevcut POI'ler</h6>
                            <div id="availablePOIsList" class="poi-list">
                                <div class="loading-spinner"><div class="spinner"></div></div>
                            </div>
                        </div>

                        <div class="associated-pois">
                            <h6>İlişkilendirilmiş POI'ler</h6>
                            <div id="associatedPOIsList" class="poi-list"></div>
                        </div>
                    </div>

                    <div class="mt-3">
                        <button type="button" class="btn btn-primary" onclick="buildAndSaveRouteFromAssociatedPOIs()">
                            <i class="fas fa-route me-1"></i>Rota Hesapla
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function buildCoordinateManagementSection() {
        return `
            <div class="form-section">
                <h5><i class="fas fa-map-marker-alt me-2"></i>Koordinat Yönetimi</h5>
                <div class="coordinate-management-container">
                    <div class="coordinate-input-section">
                        <h6><i class="fas fa-plus-circle me-2"></i>Yeni Koordinat Ekle</h6>
                        <div class="coordinate-input-form">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="newCoordinateLat">Enlem (Latitude) *</label>
                                    <input type="number" id="newCoordinateLat" class="form-control"
                                           step="any" placeholder="41.0082" required>
                                    <small class="form-help">Örnek: 41.0082</small>
                                </div>
                                <div class="form-group">
                                    <label for="newCoordinateLng">Boylam (Longitude) *</label>
                                    <input type="number" id="newCoordinateLng" class="form-control"
                                           step="any" placeholder="28.9784" required>
                                    <small class="form-help">Örnek: 28.9784</small>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="newCoordinateName">Nokta Adı</label>
                                <input type="text" id="newCoordinateName" class="form-control"
                                       placeholder="Başlangıç noktası, mola yeri, vb.">
                            </div>

                            <div class="form-group">
                                <label for="newCoordinateDescription">Açıklama</label>
                                <textarea id="newCoordinateDescription" class="form-control" rows="2"
                                          placeholder="Bu nokta hakkında bilgi..."></textarea>
                            </div>

                            <div class="coordinate-actions">
                                <button type="button" class="btn btn-success" onclick="addCoordinateToRoute()">
                                    <i class="fas fa-plus me-1"></i>Koordinat Ekle
                                </button>
                                <button type="button" class="btn btn-outline-info" onclick="getCurrentMapLocation()">
                                    <i class="fas fa-crosshairs me-1"></i>Haritadan Al
                                </button>
                                <button type="button" class="btn btn-outline-warning" onclick="clearCoordinateForm()">
                                    <i class="fas fa-eraser me-1"></i>Temizle
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="coordinate-list-section">
                        <h6><i class="fas fa-list me-2"></i>Mevcut Koordinatlar</h6>
                        <div id="routeCoordinatesList" class="coordinates-list">
                            <div class="loading-spinner">
                                <div class="spinner"></div>
                                <p>Koordinatlar yükleniyor...</p>
                            </div>
                        </div>
                    </div>

                    <div class="coordinate-actions-section">
                        <button type="button" class="btn btn-primary" onclick="reorderCoordinates()">
                            <i class="fas fa-sort me-1"></i>Sıralamayı Düzenle
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="clearAllCoordinates()">
                            <i class="fas fa-trash me-1"></i>Tümünü Temizle
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function buildRouteExportSection(routeId) {
        return `
            <div class="form-section">
                <h5><i class="fas fa-download me-2"></i>Dışa Aktarma Seçenekleri</h5>
                <div class="export-options">
                    <button type="button" class="btn btn-outline-info" onclick="exportRouteAsGPX(${toInlineHandlerArg(routeId)})">
                        <i class="fas fa-file-code me-1"></i>GPX Olarak İndir
                    </button>
                    <button type="button" class="btn btn-outline-info" onclick="exportRouteAsKML(${toInlineHandlerArg(routeId)})">
                        <i class="fas fa-globe me-1"></i>KML Olarak İndir
                    </button>
                    <button type="button" class="btn btn-outline-info" onclick="exportRouteAsJSON(${toInlineHandlerArg(routeId)})">
                        <i class="fas fa-code me-1"></i>JSON Olarak İndir
                    </button>
                    <button type="button" class="btn btn-outline-secondary" onclick="printRouteDetails(${toInlineHandlerArg(routeId)})">
                        <i class="fas fa-print me-1"></i>Yazdır
                    </button>
                </div>
            </div>
        `;
    }

    function buildPhotoLocationControlsSection() {
        return `
            <div class="photo-location-management">
                <h5><i class="fas fa-map-marker-alt me-2"></i>Fotoğraf Konum Yönetimi</h5>
                <div class="photo-location-info">
                    <div class="alert alert-info">
                        <h6><i class="fas fa-info-circle me-2"></i>Fotoğraf Konum Yönetimi</h6>
                        <p class="mb-2">
                            Her fotoğraf için ayrı konum belirleyebilirsiniz. Konum belirlenen fotoğraflar harita ve yükseklik profili üzerinde gösterilecektir.
                        </p>
                    </div>
                </div>

                <div class="photo-location-controls">
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="enablePhotoLocationSelection()" id="enablePhotoLocationBtn">
                        <i class="fas fa-crosshairs me-1"></i>Haritadan Konum Seç
                    </button>
                    <button type="button" class="btn btn-outline-success btn-sm" onclick="batchSetPhotoLocations()" id="batchLocationBtn">
                        <i class="fas fa-layer-group me-1"></i>Toplu Konum Ata
                    </button>
                    <button type="button" class="btn btn-outline-info btn-sm" onclick="autoExtractAllPhotoLocations()" id="autoExtractBtn" title="Tüm fotoğraflar için EXIF konum bilgisi otomatik çıkar">
                        <i class="fas fa-magic me-1"></i>EXIF'ten Otomatik Çıkar
                    </button>
                    <button type="button" class="btn btn-outline-info btn-sm" onclick="exportPhotoLocations()" id="exportLocationsBtn">
                        <i class="fas fa-download me-1"></i>Konumları Dışa Aktar
                    </button>
                    <button type="button" class="btn btn-outline-warning btn-sm" onclick="importPhotoLocations()" id="importLocationsBtn">
                        <i class="fas fa-upload me-1"></i>Konumları İçe Aktar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="clearAllPhotoLocations()" id="clearLocationsBtn">
                        <i class="fas fa-trash me-1"></i>Tüm Konumları Temizle
                    </button>
                </div>
            </div>
        `;
    }

    function buildRouteMediaPanelMarkup() {
        return `
            <div class="route-media-panel flex-grow-1">
                <div class="media-upload-container">
                    <div class="media-upload-form">
                        <h5><i class="fas fa-photo-video me-2"></i>Medya Yönetimi</h5>

                        <div class="form-group">
                            <label class="form-label">
                                <i class="fas fa-file-upload"></i>Medya Dosyası Seç
                            </label>
                            <input type="file" class="form-input" id="routeMediaFile"
                                   accept="image/*,video/*,audio/*,.glb,.gltf,.obj,.fbx,.dae,.ply,.stl" multiple>
                            <small class="form-help">
                                Desteklenen formatlar: görsel, video, ses ve 3D model. Görseller isteğe bağlı olarak WebP formatına dönüştürülür.
                            </small>
                        </div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Medya Türü</label>
                                <select class="form-input" id="routeMediaType">
                                    <option value="auto">🔍 Otomatik Tespit</option>
                                    <option value="panorama">🌀 360° Panorama</option>
                                    <option value="image">📸 Görsel</option>
                                    <option value="video">🎥 Video</option>
                                    <option value="audio">🎵 Ses</option>
                                    <option value="model_3d">🧊 3D Model</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Açıklama</label>
                                <input type="text" class="form-input" id="routeMediaCaption" placeholder="Medya açıklaması">
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="routeMediaPrimary">
                                <label class="form-check-label" for="routeMediaPrimary">
                                    Ana medya olarak ayarla
                                </label>
                            </div>
                        </div>

                        <button type="button" class="btn btn-primary" onclick="uploadRouteMedia()">
                            <i class="fas fa-upload"></i>Medya Yükle
                        </button>
                    </div>

                    ${buildPhotoLocationControlsSection()}

                    <div class="current-media-container">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="mb-0"><i class="fas fa-folder-open"></i> Mevcut Medya Dosyaları</h5>
                            <div class="btn-group" role="group">
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="refreshRouteMedia()" title="Medya listesini yenile">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div id="routeCurrentMedia" class="current-media-grid">
                            <div class="loading-spinner">
                                <div class="spinner"></div>
                                <p>Medya dosyaları yükleniyor...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildRouteEditFormMarkup(route) {
        const routeId = getRouteId(route);
        return `
            <div class="route-edit-form d-flex gap-3">
                <form id="routeEditForm" class="flex-grow-1">
                    ${buildRouteEditBasicsSection(route)}
                    ${buildRoutePropertiesSection(route)}
                    ${buildPoiAssociationSection()}
                    ${buildCoordinateManagementSection()}
                    ${buildRouteExportSection(routeId)}
                </form>
                ${buildRouteMediaPanelMarkup()}
            </div>
        `;
    }

    function initializeEditWorkspace(routeId) {
        loadPOIsForAssociation(routeId);

        if (typeof loadRouteMedia === 'function') {
            loadRouteMedia(routeId);
        }

        if (global.routeAdminManager?.setupMediaHandlers) {
            global.routeAdminManager.setupMediaHandlers();
        }

        const loadMedia = async () => {
            try {
                await loadRouteMediaForEdit(routeId);
            } catch (error) {
                console.warn('Failed to load media for route:', routeId, error);
            }
        };

        global.setTimeout(loadMedia, 500);
        global.setTimeout(async () => {
            const container = document.getElementById('routeCurrentMedia');
            if (container && container.innerHTML.includes('loading-spinner')) {
                await loadMedia();
            }
        }, 1500);

        loadRouteCoordinates(routeId);
        initializeCoordinateManagement();

        global.setTimeout(() => {
            refreshPhotoLocationMarkers();
        }, 500);
    }

    function editCurrentRoute() {
        if (currentRoute) {
            displayRouteEditForm(currentRoute);
        }
    }

    function displayRouteEditForm(route) {
        const workspaceTitle = document.getElementById('workspaceTitle');
        const workspaceActions = document.getElementById('workspaceActions');
        const workspaceContent = document.getElementById('workspaceContent');
        if (!workspaceTitle || !workspaceActions || !workspaceContent) {
            return;
        }

        const routeId = getRouteId(route);
        workspaceTitle.textContent = `${route.name || 'Rota'} - Düzenleme`;
        workspaceActions.innerHTML = getEditWorkspaceActionsMarkup();
        workspaceContent.innerHTML = buildRouteEditFormMarkup(route);

        addRouteEditFormStyles();
        initializeEditWorkspace(routeId);
    }

    async function refreshRouteMedia() {
        const routeId = getCurrentRouteId();
        if (!routeId) {
            showNotification('Önce bir rota seçin', 'warning');
            return;
        }

        const container = document.getElementById('routeCurrentMedia');
        if (container) {
            container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Medya dosyaları yenileniyor...</p></div>';
        }

        try {
            await loadRouteMediaForEdit(routeId);
            showNotification('Medya listesi yenilendi', 'success');
        } catch (error) {
            console.error('Error refreshing media:', error);
            showNotification('Medya yenilenirken hata oluştu', 'error');
        }
    }

    async function saveRouteChanges() {
        const routeId = getCurrentRouteId();
        if (!routeId) return;

        try {
            const formData = {
                name: document.getElementById('editRouteName')?.value || '',
                description: document.getElementById('editRouteDescription')?.value || '',
                route_type: document.getElementById('editRouteType')?.value || 'walking',
                difficulty_level: Number.parseInt(document.getElementById('editDifficulty')?.value, 10) || 1,
                estimated_duration: Number.parseInt(document.getElementById('editDuration')?.value, 10) || null,
                total_distance: Number.parseFloat(document.getElementById('editDistance')?.value) || null,
                elevation_gain: Number.parseInt(document.getElementById('editElevation')?.value, 10) || null,
                tags: document.getElementById('editTags')?.value || '',
                is_circular: Boolean(document.getElementById('editIsCircular')?.checked)
            };

            if (Array.isArray(routeCoordinates) && routeCoordinates.length > 0) {
                formData.coordinates = routeCoordinates.map((coord) => [coord.lng, coord.lat]);
            }

            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch(`${apiBase}/admin/routes/${routeId}`, {
                method: 'PUT',
                headers,
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                let message = 'Rota güncellenemedi';
                try {
                    const errorData = await response.json();
                    if (errorData?.error) {
                        message = errorData.error;
                    }
                } catch (_) {
                    // Ignore malformed error payloads.
                }
                throw new Error(message);
            }

            showNotification('Rota başarıyla güncellendi', 'success');
            Object.assign(currentRoute, formData);
            await loadRoutes();

            const updatedRoute = allRoutes.find((route) => String(getRouteId(route)) === String(routeId)) || currentRoute;
            currentRoute = updatedRoute;
            displayRouteDetails(updatedRoute);
        } catch (error) {
            console.error('Route update error:', error);
            showError(`Rota güncellenirken hata oluştu: ${error.message}`);
        }
    }

    function cancelRouteEdit() {
        if (currentRoute) {
            displayRouteDetails(currentRoute);
        }
    }

    async function exportRouteFile(routeId, format, filename, mimeType) {
        try {
            const response = await fetch(`${apiBase}/routes/${routeId}/export/${format}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`${format.toUpperCase()} export failed`);
            }

            const blob = await response.blob();
            downloadFile(blob, filename, mimeType);
        } catch (error) {
            console.error(`${format.toUpperCase()} export error:`, error);
            showError(`${format.toUpperCase()} dışa aktarımında hata oluştu`);
        }
    }

    async function exportRouteAsGPX(routeId) {
        await exportRouteFile(routeId, 'gpx', `route_${routeId}.gpx`, 'application/gpx+xml');
    }

    async function exportRouteAsKML(routeId) {
        await exportRouteFile(routeId, 'kml', `route_${routeId}.kml`, 'application/vnd.google-earth.kml+xml');
    }

    async function exportRouteAsJSON(routeId) {
        await exportRouteFile(routeId, 'json', `route_${routeId}.json`, 'application/json');
    }

    function printRouteDetails(routeId) {
        const route = allRoutes.find((item) => String(getRouteId(item)) === String(routeId))
            || (currentRoute && String(getRouteId(currentRoute)) === String(routeId) ? currentRoute : null);
        if (!route) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError('Yazdırma penceresi açılamadı');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>${escapeHtml(route.name || 'Rota')} - Rota Detayları</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #2563eb; }
                    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
                    .stat { padding: 10px; background: #f8fafc; border-radius: 8px; }
                    .stat-label { font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(route.name || 'İsimsiz Rota')}</h1>
                <p><strong>Tür:</strong> ${escapeHtml(ROUTE_TYPES?.[route.route_type]?.name || route.route_type || 'Bilinmiyor')}</p>
                <p><strong>Açıklama:</strong> ${escapeHtml(route.description || 'Açıklama bulunmuyor')}</p>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">Süre</div>
                        <div>${route.estimated_duration || 0} dakika</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Mesafe</div>
                        <div>${(Number(route.total_distance) || 0).toFixed(2)} km</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Yükselti</div>
                        <div>${route.elevation_gain || 0} m</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Zorluk</div>
                        <div>${getDifficultyStars(route.difficulty_level)} (${route.difficulty_level || 0}/5)</div>
                    </div>
                </div>

                ${route.tags ? `<p><strong>Etiketler:</strong> ${escapeHtml(route.tags)}</p>` : ''}
                <p><strong>Dairesel Rota:</strong> ${route.is_circular ? 'Evet' : 'Hayır'}</p>
                <p><strong>Oluşturulma:</strong> ${formatDate(route.created_at)}</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    function duplicateCurrentRoute() {
        if (currentRoute) {
            showNotification(`${currentRoute.name} rotası kopyalama özelliği yakında eklenecek`, 'info');
        }
    }

    function exportCurrentRoute() {
        const routeId = getCurrentRouteId();
        if (routeId) {
            exportRouteAsJSON(routeId);
        }
    }

    async function deleteCurrentRoute() {
        const routeId = getCurrentRouteId();
        if (!routeId) return;

        const routeName = currentRoute?.name || 'Rota';
        if (!confirm(`"${routeName}" rotasını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
            return;
        }

        try {
            showNotification('Rota siliniyor...', 'info');

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

            let removed = false;
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                removed = Boolean((data && data.message && !data.error) || data?.success);
                if (!removed) {
                    showNotification(`Rota silinemedi${data?.error ? `: ${data.error}` : ''}`, 'error');
                    return;
                }
            } else if (response.status !== 404) {
                showNotification(`HTTP hatası: ${response.status}`, 'error');
                return;
            } else {
                removed = true;
                showNotification(`"${routeName}" rotası zaten silinmiş`, 'warning');
            }

            if (!removed) return;

            allRoutes = allRoutes.filter((route) => String(getRouteId(route)) !== String(routeId));
            filteredRoutes = filteredRoutes.filter((route) => String(getRouteId(route)) !== String(routeId));
            selectedRoutes.delete(routeId);

            if (routeLayers[routeId]) {
                map.removeLayer(routeLayers[routeId]);
                delete routeLayers[routeId];
            }

            displayRoutes();
            updateBulkActions();

            if (currentRoute && String(getRouteId(currentRoute)) === String(routeId)) {
                currentRoute = null;
                clearRouteSelection();
            }

            showNotification(`"${routeName}" rotası başarıyla silindi`, 'success');
        } catch (error) {
            console.error('Error deleting route:', error);
            showNotification('Rota silinirken hata oluştu', 'error');
        }
    }

    global.editCurrentRoute = editCurrentRoute;
    global.displayRouteEditForm = displayRouteEditForm;
    global.refreshRouteMedia = refreshRouteMedia;
    global.saveRouteChanges = saveRouteChanges;
    global.cancelRouteEdit = cancelRouteEdit;
    global.exportRouteAsGPX = exportRouteAsGPX;
    global.exportRouteAsKML = exportRouteAsKML;
    global.exportRouteAsJSON = exportRouteAsJSON;
    global.printRouteDetails = printRouteDetails;
    global.duplicateCurrentRoute = duplicateCurrentRoute;
    global.exportCurrentRoute = exportCurrentRoute;
    global.deleteCurrentRoute = deleteCurrentRoute;
})(window);
