(function (global) {
    'use strict';

    const POIManagerMediaMethods = {
        escapeJsSingleQuoted(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n');
        },

        normalizeMediaPath(path) {
            const raw = String(path || '').trim();
            if (!raw) return '';
            if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
            return raw.startsWith('/') ? raw : `/${raw}`;
        },

        getMediaAssetPaths(media) {
            return {
                fullPath: this.normalizeMediaPath(media?.path),
                previewPath: this.normalizeMediaPath(media?.preview_path || media?.thumbnail_path || media?.path),
            };
        },

        resolveBestPanoramaPath(item) {
            const candidates = [];
            const pushCandidate = (obj, fallbackLabel = 'level') => {
                if (!obj || typeof obj !== 'object') return;
                const path = this.normalizeMediaPath(obj.path);
                if (!path) return;
                const width = Number(obj.width) || 0;
                const height = Number(obj.height) || 0;
                const maxEdge = Number(obj.max_edge) || Math.max(width, height) || 0;
                candidates.push({
                    path,
                    max_edge: maxEdge,
                    label: obj.label || fallbackLabel,
                    role: obj.role || null,
                });
            };

            const levels = Array.isArray(item?.pyramid_levels) ? item.pyramid_levels : [];
            levels.forEach((level) => pushCandidate(level, 'pyramid'));
            if (item?.original_path) {
                pushCandidate({ path: item.original_path, role: 'original', label: 'original' }, 'original');
            }
            if (item?.path) {
                pushCandidate({ path: item.path, label: 'base' }, 'base');
            }

            if (candidates.length === 0) return '';

            candidates.sort((left, right) => {
                const leftEdge = Number(left.max_edge) || 0;
                const rightEdge = Number(right.max_edge) || 0;
                if (leftEdge !== rightEdge) return rightEdge - leftEdge;
                if (left.role === 'original' && right.role !== 'original') return -1;
                if (right.role === 'original' && left.role !== 'original') return 1;
                return 0;
            });

            return candidates[0].path;
        },

        async loadPanoramas() {
            try {
                const response = await this.authenticatedFetch('/api/panoramas');
                if (!response.ok) return;
                const data = await response.json();
                const items = data.panoramas || [];

                if (!this.panoramaLayer) this.panoramaLayer = L.layerGroup().addTo(this.map);
                this.panoramaLayer.clearLayers();

                items.forEach((panorama) => {
                    if (typeof panorama.lat !== 'number' || typeof panorama.lng !== 'number') return;
                    const icon = L.divIcon({
                        className: 'pano-marker-wrapper',
                        html: `
                            <div class="pano-marker-circle" aria-label="360 derece panorama işareti">
                                <span class="pano-360">360°</span>
                            </div>
                        `,
                        iconSize: [34, 34],
                        iconAnchor: [17, 17],
                        popupAnchor: [0, -16]
                    });

                    const mediaPath = this.resolveBestPanoramaPath(panorama) || this.normalizeMediaPath(panorama.path);
                    const safeMediaPath = String(mediaPath).replace(/'/g, "\\'");
                    const safeFilename = String(panorama.filename || 'panorama').replace(/'/g, "\\'");
                    const safePanoId = String(panorama.id || '').replace(/'/g, "\\'");
                    const canDeleteStandalone = safePanoId.length >= 6;

                    const marker = L.marker([panorama.lat, panorama.lng], { icon })
                        .bindPopup(`
                            <div class="poi-popup">
                                <div class="poi-popup-header" style="display:flex;align-items:center;gap:8px;">
                                    <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:10px;font-weight:800;">360°</span>
                                    <strong>360° Panorama</strong>
                                </div>
                                ${panorama.caption ? `<div class="poi-popup-description">${panorama.caption}</div>` : ''}
                                <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;">
                                    <button class="btn btn-sm btn-primary" onclick="showMediaModal('${safeMediaPath}', '${safeFilename}', 'image')">
                                        <i class="fas fa-vr-cardboard"></i> Aç
                                    </button>
                                    ${canDeleteStandalone ? `
                                        <button class="btn btn-sm btn-danger" onclick="deleteStandalonePanorama('${safePanoId}')">
                                            <i class="fas fa-trash-alt"></i> Sil
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `);
                    this.panoramaLayer.addLayer(marker);
                });

                try {
                    const routeResponse = await this.authenticatedFetch('/api/route-panoramas');
                    if (routeResponse.ok) {
                        const routeData = await routeResponse.json();
                        const routeItems = routeData.panoramas || [];
                        routeItems.forEach((panorama) => {
                            if (typeof panorama.lat !== 'number' || typeof panorama.lng !== 'number') return;
                            if (Object.prototype.hasOwnProperty.call(panorama, 'is_pano')) {
                                if (!panorama.is_pano) return;
                            } else if (!this.isPanoramaFilename(panorama.filename)) {
                                return;
                            }

                            const icon = L.divIcon({
                                className: 'pano-marker-wrapper',
                                html: `
                                    <div class="pano-marker-circle" aria-label="360 derece panorama işareti">
                                        <span class="pano-360">360°</span>
                                    </div>
                                `,
                                iconSize: [34, 34],
                                iconAnchor: [17, 17],
                                popupAnchor: [0, -16]
                            });
                            const caption = panorama.caption || 'Rota Medyası 360°';
                            const mediaPath = this.resolveBestPanoramaPath(panorama) || this.normalizeMediaPath(panorama.path);
                            const safeMediaPath = String(mediaPath).replace(/'/g, "\\'");
                            const rawFilename = typeof panorama.filename === 'string' ? panorama.filename : '';
                            const safeFilename = String(rawFilename || 'route-panorama').replace(/'/g, "\\'");
                            const routeId = Number(panorama.route_id);
                            const canDeleteRoute = Number.isFinite(routeId) && routeId > 0 && rawFilename.trim().length > 0;

                            const marker = L.marker([panorama.lat, panorama.lng], { icon })
                                .bindPopup(`
                                    <div class="poi-popup">
                                        <div class="poi-popup-header" style="display:flex;align-items:center;gap:8px;">
                                            <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:10px;font-weight:800;">360°</span>
                                            <strong>360° Panorama</strong>
                                        </div>
                                        ${caption ? `<div class="poi-popup-description">${caption}</div>` : ''}
                                        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;">
                                            <button class="btn btn-sm btn-primary" onclick="showMediaModal('${safeMediaPath}', '${safeFilename}', 'image')">
                                                <i class="fas fa-vr-cardboard"></i> Aç
                                            </button>
                                            ${canDeleteRoute ? `
                                                <button class="btn btn-sm btn-danger" onclick="deleteRoutePanorama(${routeId}, '${safeFilename}')">
                                                    <i class="fas fa-trash-alt"></i> Sil
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `);
                            this.panoramaLayer.addLayer(marker);
                        });
                    }
                } catch (error) {
                    console.warn('Rota panoramaları yüklenemedi:', error);
                }
            } catch (error) {
                console.warn('Panorama yüklenemedi:', error);
            }
        },

        async uploadPanorama() {
            try {
                const fileInput = document.getElementById('panoFile');
                const captionInput = document.getElementById('panoCaption');
                const uploadButton = document.getElementById('uploadPanoBtn');
                if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                    this.showToast('Lütfen bir 360° görsel seçin', 'error');
                    return;
                }

                const files = Array.from(fileInput.files);
                const form = new FormData();
                files.forEach(file => form.append('media', file));
                if (captionInput && captionInput.value) form.append('caption', captionInput.value);

                if (uploadButton) {
                    uploadButton.disabled = true;
                    uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
                }

                const response = await this.authenticatedFetch('/api/panoramas', { method: 'POST', body: form });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Yükleme başarısız');
                }

                const result = await response.json();
                const panoramas = Array.isArray(result?.panoramas)
                    ? result.panoramas
                    : (result?.panorama ? [result.panorama] : []);
                const duplicateCount = Number.isFinite(Number(result?.duplicate_count))
                    ? Number(result.duplicate_count)
                    : panoramas.filter(item => item && item.is_duplicate).length;
                const uploadedCount = Number.isFinite(Number(result?.uploaded_count))
                    ? Number(result.uploaded_count)
                    : Math.max(0, panoramas.length - duplicateCount);
                const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;

                let summary = `360° yükleme tamamlandı: ${uploadedCount} yeni`;
                if (duplicateCount > 0) summary += `, ${duplicateCount} mükerrer`;
                if (errorCount > 0) summary += `, ${errorCount} hatalı`;
                this.showToast(summary, errorCount > 0 ? 'error' : 'success');

                fileInput.value = '';
                if (captionInput) captionInput.value = '';

                const missingGeoCount = panoramas.filter(item =>
                    !item?.is_duplicate && !(typeof item.lat === 'number' && typeof item.lng === 'number')
                ).length;
                if (missingGeoCount > 0) {
                    this.showToast(`${missingGeoCount} görselde EXIF konumu bulunamadı, haritaya eklenmedi.`, 'info');
                }

                const toggle = document.getElementById('togglePanoramas');
                if (toggle && toggle.checked) await this.loadPanoramas();
            } catch (error) {
                console.error('Panorama upload error:', error);
                this.showToast('Panorama yükleme hatası: ' + error.message, 'error');
            } finally {
                const uploadButton = document.getElementById('uploadPanoBtn');
                if (uploadButton) {
                    uploadButton.disabled = false;
                    uploadButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Yükle';
                }
            }
        },

        async deleteStandalonePanorama(panoramaId) {
            const id = String(panoramaId || '').trim();
            if (!id || id.length < 6) {
                this.showToast('Geçersiz panorama kimliği', 'error');
                return;
            }
            if (!confirm('Bu bağımsız 360° panoramayı silmek istediğinizden emin misiniz?')) {
                return;
            }

            try {
                const response = await this.authenticatedFetch(`/api/panoramas/${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Panorama silinemedi');
                }

                this.showToast('360° panorama silindi', 'success');
                const toggle = document.getElementById('togglePanoramas');
                if (toggle && toggle.checked) {
                    await this.loadPanoramas();
                } else if (this.panoramaLayer) {
                    this.panoramaLayer.clearLayers();
                }
            } catch (error) {
                console.error('Standalone panorama delete error:', error);
                this.showToast('Panorama silme hatası: ' + error.message, 'error');
            }
        },

        async deleteRoutePanorama(routeId, filename) {
            const numericRouteId = Number(routeId);
            const normalizedFilename = String(filename || '').trim();
            if (!Number.isFinite(numericRouteId) || numericRouteId <= 0 || !normalizedFilename) {
                this.showToast('Geçersiz rota panorama bilgisi', 'error');
                return;
            }
            if (!confirm(`'${normalizedFilename}' rota panoramasını silmek istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                const response = await this.authenticatedFetch(`/api/admin/routes/${numericRouteId}/media/${encodeURIComponent(normalizedFilename)}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Rota panoraması silinemedi');
                }

                this.showToast('Rota panoraması silindi', 'success');
                const toggle = document.getElementById('togglePanoramas');
                if (toggle && toggle.checked) {
                    await this.loadPanoramas();
                } else if (this.panoramaLayer) {
                    this.panoramaLayer.clearLayers();
                }
            } catch (error) {
                console.error('Route panorama delete error:', error);
                this.showToast('Rota panoraması silme hatası: ' + error.message, 'error');
            }
        },

        async loadPOIMedia(poiId) {
            if (!poiId) return;

            try {
                const response = await this.authenticatedFetch(`/api/poi/${poiId}/media`);
                if (!response.ok) return;

                const data = await response.json();
                const mediaFiles = data.media || [];

                this.displayMediaGallery(mediaFiles);
                this.displayCurrentMedia(mediaFiles, poiId);
            } catch (error) {
                console.error('Error loading POI media:', error);
            }
        },

        displayMediaGallery(mediaFiles) {
            const mediaSection = document.getElementById('poiMediaSection');
            const mediaGallery = document.getElementById('poiMediaGallery');

            if (!mediaSection || !mediaGallery) return;

            if (mediaFiles.length === 0) {
                mediaSection.style.display = 'none';
                return;
            }

            mediaSection.style.display = 'block';

            mediaGallery.innerHTML = mediaFiles.map((media) => {
                const { fullPath, previewPath } = this.getMediaAssetPaths(media);
                const isImage = media.media_type === 'image';
                const isPano = isImage && this.isPanoramaFilename(media.filename);
                const safeMediaPath = this.escapeJsSingleQuoted(fullPath);
                const safeFilename = this.escapeJsSingleQuoted(media.filename || '');
                const safeMediaType = this.escapeJsSingleQuoted(media.media_type || 'unknown');
                const escapedFilename = this.escapeHtml(media.filename || '');

                return `
                    <div class="media-gallery-item" onclick="showMediaModal('${safeMediaPath}', '${safeFilename}', '${safeMediaType}')">
                        ${isPano ? `<div class="media-360-badge">360°</div>` : ''}
                        ${isImage
                            ? `<img src="${this.escapeHtml(previewPath)}" class="media-gallery-preview" alt="${escapedFilename}">`
                            : `<div class="media-gallery-placeholder">
                                    ${this.getMediaTypeIcon(media.media_type)}
                                </div>`
                        }
                        <div class="media-type-badge">${this.getMediaTypeIcon(media.media_type)}</div>
                    </div>
                `;
            }).join('');
        },

        displayCurrentMedia(mediaFiles, poiId) {
            const container = document.getElementById('currentMedia');
            if (!container) return;

            if (mediaFiles.length === 0) {
                container.innerHTML = '<div class="text-center text-muted py-3">Henüz medya dosyası eklenmemiş.</div>';
                return;
            }

            const groupedMedia = {};
            mediaFiles.forEach((media) => {
                const type = media.media_type || 'unknown';
                if (!groupedMedia[type]) groupedMedia[type] = [];
                groupedMedia[type].push(media);
            });

            let mediaHtml = '';
            Object.keys(groupedMedia).forEach((mediaType) => {
                const typeIcon = this.getMediaTypeIcon(mediaType);
                const typeLabel = {
                    image: 'Görseller',
                    video: 'Videolar',
                    audio: 'Ses Dosyaları',
                    model_3d: '3D Modeller',
                    unknown: 'Diğer'
                }[mediaType] || mediaType.toUpperCase();

                mediaHtml += `
                    <div class="media-type-section">
                        <h6 class="media-type-title">${typeIcon} ${typeLabel} (${groupedMedia[mediaType].length})</h6>
                        <div class="current-media-grid">
                `;

                groupedMedia[mediaType].forEach((media) => {
                    const { fullPath, previewPath } = this.getMediaAssetPaths(media);
                    const isImage = mediaType === 'image';
                    const isPano = isImage && this.isPanoramaFilename(media.filename);
                    const safePoiId = this.escapeJsSingleQuoted(poiId);
                    const safeFilename = this.escapeJsSingleQuoted(media.filename || '');
                    const safeMediaPath = this.escapeJsSingleQuoted(fullPath);
                    const safeMediaType = this.escapeJsSingleQuoted(mediaType);
                    const escapedPreviewPath = this.escapeHtml(previewPath);
                    const escapedFilename = this.escapeHtml(media.filename || '');
                    const formatLabel = this.escapeHtml(media.format?.toUpperCase() || '');
                    const sizeValue = Number(media.size);
                    const sizeLabel = Number.isFinite(sizeValue) ? `${(sizeValue / 1024).toFixed(0)}KB` : '';

                    mediaHtml += `
                        <div class="media-item-card">
                            <button class="media-delete-btn" onclick="deleteMediaFile('${safePoiId}', '${safeFilename}')" title="Sil">
                                <i class="fas fa-times"></i>
                            </button>
                            ${isPano ? `<div class="media-360-badge">360°</div>` : ''}
                            ${isImage
                                ? `<img src="${escapedPreviewPath}" class="media-preview" alt="${escapedFilename}"
                                      onclick="showMediaModal('${safeMediaPath}', '${safeFilename}', '${safeMediaType}')">`
                                : `<div class="media-placeholder" onclick="showMediaModal('${safeMediaPath}', '${safeFilename}', '${safeMediaType}')">
                                        ${this.getMediaTypeIcon(mediaType)}
                                        <div class="media-format">${formatLabel}</div>
                                   </div>`
                            }
                            <div class="media-type-badge">${this.getMediaTypeIcon(mediaType)}</div>
                            <div class="media-item-info">
                                <div class="media-item-name">${escapedFilename}</div>
                                <div class="media-item-size">${sizeLabel}</div>
                            </div>
                        </div>
                    `;
                });

                mediaHtml += `
                        </div>
                    </div>
                `;
            });

            container.innerHTML = mediaHtml;
        },

        getMediaTypeIcon(mediaType) {
            const icons = {
                image: '📸',
                video: '🎥',
                audio: '🎵',
                model_3d: '🧊',
                unknown: '📄'
            };
            return icons[mediaType] || '📄';
        },

        isPanoramaFilename(filename) {
            if (!filename) return false;
            const name = String(filename).toLowerCase();
            return /(\b|[_-])(360|pano|panorama|equirect|spherical)(\b|[_-]|\.)/.test(name);
        },

        getMediaMaxSize(mediaType) {
            const sizes = {
                image: 15,
                video: 100,
                audio: 50,
                model_3d: 50
            };
            return sizes[mediaType] || 15;
        },

        async uploadPOIMedia() {
            if (!this.selectedPOI) {
                this.showToast('Önce bir POI seçin', 'error');
                return;
            }

            const fileInput = document.getElementById('mediaFile');
            const mediaTypeSelect = document.getElementById('mediaType');
            const mediaCaption = document.getElementById('mediaCaption').value;
            const isPrimary = document.getElementById('isPrimaryMedia').checked;

            if (!fileInput.files || fileInput.files.length === 0) {
                this.showToast('Lütfen bir medya dosyası seçin', 'error');
                return;
            }

            const file = fileInput.files[0];
            const filename = file.name.toLowerCase();
            let mediaType = mediaTypeSelect.value;
            if (mediaType === 'auto') {
                if (filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/)) {
                    mediaType = 'image';
                } else if (filename.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) {
                    mediaType = 'video';
                } else if (filename.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
                    mediaType = 'audio';
                } else if (filename.match(/\.(glb|gltf|obj|fbx|dae|ply|stl)$/)) {
                    mediaType = 'model_3d';
                } else {
                    this.showToast('Dosya türü tespit edilemedi. Lütfen medya türünü manuel olarak seçin.', 'error');
                    return;
                }
            }

            const maxSize = this.getMediaMaxSize(mediaType) * 1024 * 1024;
            if (file.size > maxSize) {
                this.showToast(`Dosya boyutu ${this.getMediaMaxSize(mediaType)}MB'dan küçük olmalıdır.\n\nSeçilen dosya: ${(file.size / 1024 / 1024).toFixed(1)}MB`, 'error');
                return;
            }

            const formData = new FormData();
            formData.append('media', file);
            formData.append('caption', mediaCaption);
            formData.append('is_primary', isPrimary);

            try {
                const response = await this.authenticatedFetch(`/api/poi/${this.selectedPOI.id}/media`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Medya yükleme başarısız');
                }

                const result = await response.json();
                if (result.media && result.media.compression_ratio && result.media.compression_ratio !== '0%') {
                    this.showToast(`${this.getMediaTypeIcon(mediaType)} ${mediaType.toUpperCase()} başarıyla yüklendi!\nBoyut azalması: ${result.media.compression_ratio}`, 'success');
                } else {
                    this.showToast(`${this.getMediaTypeIcon(mediaType)} ${mediaType.toUpperCase()} başarıyla yüklendi!`, 'success');
                }

                fileInput.value = '';
                document.getElementById('mediaCaption').value = '';
                document.getElementById('isPrimaryMedia').checked = false;
                mediaTypeSelect.value = 'auto';

                await this.loadPOIMedia(this.selectedPOI.id);
            } catch (error) {
                console.error('Media upload error:', error);
                this.showToast('Medya yükleme hatası: ' + error.message, 'error');
            }
        },

        showMediaModal(mediaPath, filename, mediaType) {
            const normalizedMediaPath = this.normalizeMediaPath(mediaPath);
            const escapedFilename = this.escapeHtml(filename || '');
            const escapedMediaPath = this.escapeHtml(normalizedMediaPath);
            const modal = document.createElement('div');
            modal.className = 'modal fade';

            let modalContent = '';
            if (mediaType === 'image') {
                const isPanoByName = this.isPanoramaFilename(filename);
                if (isPanoByName) {
                    const viewerId = `pano_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    modalContent = `
                        <div id="${viewerId}" style="width: 100%; height: 70vh; border-radius: 12px; overflow: hidden; background:#000;"></div>
                    `;
                    modal.dataset.panoViewerId = viewerId;
                    modal.dataset.panoImage = normalizedMediaPath;
                } else {
                    modalContent = `<img id="panoCheck" src="${escapedMediaPath}" class="img-fluid rounded-3 shadow-lg" alt="${escapedFilename}" style="max-height: 70vh;">`;
                }
            } else if (mediaType === 'video') {
                modalContent = `
                    <video controls class="w-100 rounded-3 shadow-lg" style="max-height: 70vh;">
                        <source src="${escapedMediaPath}" type="video/mp4">
                        Tarayıcınız video oynatmayı desteklemiyor.
                    </video>`;
            } else if (mediaType === 'audio') {
                modalContent = `
                    <div class="text-center p-4">
                        <i class="fas fa-music fa-3x text-primary mb-3"></i>
                        <h5>${escapedFilename}</h5>
                        <audio controls class="w-100 mt-3">
                            <source src="${escapedMediaPath}">
                            Tarayıcınız ses oynatmayı desteklemiyor.
                        </audio>
                    </div>`;
            } else if (mediaType === 'model_3d') {
                modalContent = `
                    <div class="text-center p-4">
                        <i class="fas fa-cube fa-3x text-primary mb-3"></i>
                        <h5>${escapedFilename}</h5>
                        <p class="text-muted">3D model dosyası. İndirip uygun bir uygulamada görüntüleyebilirsiniz.</p>
                    </div>`;
            } else {
                modalContent = `
                    <div class="text-center p-4">
                        <i class="fas fa-file fa-3x text-primary mb-3"></i>
                        <h5>${escapedFilename}</h5>
                        <p class="text-muted">Medya dosyası</p>
                    </div>`;
            }

            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold"><i class="fas fa-file me-2"></i>${escapedFilename}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center p-4">
                            ${modalContent}
                        </div>
                        <div class="modal-footer justify-content-center">
                            <a href="${escapedMediaPath}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-external-link-alt me-1"></i> Yeni Sekmede Aç/İndir
                            </a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i> Kapat
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();

            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });

            modal.addEventListener('shown.bs.modal', () => {
                try {
                    const viewerId = modal.dataset.panoViewerId;
                    const panoramaImage = modal.dataset.panoImage;
                    if (viewerId && panoramaImage && global.PhotoSphereViewer && global.THREE) {
                        new PhotoSphereViewer.Viewer({
                            container: document.getElementById(viewerId),
                            panorama: panoramaImage,
                            touchmoveTwoFingers: true,
                            mousewheel: true,
                            navbar: ['zoom', 'fullscreen'],
                        });
                        return;
                    }

                    const imageElement = modal.querySelector('#panoCheck');
                    if (imageElement && global.PhotoSphereViewer && global.THREE) {
                        const testImage = new Image();
                        testImage.onload = () => {
                            const ratio = testImage.naturalWidth / testImage.naturalHeight;
                            if (ratio > 1.95 && ratio < 2.05) {
                                const viewerDiv = document.createElement('div');
                                viewerDiv.style.cssText = 'width:100%; height:70vh; border-radius:12px; overflow:hidden; background:#000;';
                                imageElement.replaceWith(viewerDiv);
                                new PhotoSphereViewer.Viewer({
                                    container: viewerDiv,
                                    panorama: imageElement.src,
                                    touchmoveTwoFingers: true,
                                    mousewheel: true,
                                    navbar: ['zoom', 'fullscreen'],
                                });
                            }
                        };
                        testImage.src = imageElement.src;
                    }
                } catch (error) {
                    console.warn('360° viewer başlatılamadı:', error);
                }
            });
        },

        async deleteMediaFile(poiId, filename) {
            if (!confirm(`'${filename}' dosyasını silmek istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                const response = await this.authenticatedFetch(`/api/poi/${poiId}/media/${encodeURIComponent(filename)}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Dosya silinemedi');
                }

                this.showToast('Medya dosyası başarıyla silindi', 'success');
                await this.loadPOIMedia(poiId);
            } catch (error) {
                console.error('Media delete error:', error);
                this.showToast('Medya silme hatası: ' + error.message, 'error');
            }
        }
    };

    global.POIManagerMediaMethods = POIManagerMediaMethods;
})(window);
