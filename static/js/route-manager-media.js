(function (global) {
    'use strict';

    const IMAGE_EXTENSIONS = /\.(webp|jpg|jpeg|png|gif|bmp|tiff)$/i;
    const VIDEO_EXTENSIONS = /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i;
    const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
    const MODEL_EXTENSIONS = /\.(glb|gltf|obj|fbx|dae|ply|stl)$/i;

    global.currentRouteMediaFilesCache = global.currentRouteMediaFilesCache || [];

    function wait(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function getPendingExifLocation() {
        return global.pendingExifLocation || null;
    }

    function clearPendingExifLocation() {
        global.pendingExifLocation = null;
    }

    function normalizeMediaPath(path) {
        const value = String(path || '');
        if (!value) return '';
        if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) {
            return value;
        }
        return value.startsWith('/') ? value : `/${value}`;
    }

    function encodePathSegment(value) {
        return encodeURIComponent(String(value || '')).replace(/[!'()*]/g, (char) =>
            `%${char.charCodeAt(0).toString(16).toUpperCase()}`
        );
    }

    function toInlineHandlerArg(value) {
        return JSON.stringify(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function getMediaFilename(media) {
        const rawPath = getMediaRawPath(media);
        return media?.filename || media?.name || (rawPath ? rawPath.split('/').pop() : 'Unknown file');
    }

    function getMediaRawPath(media) {
        return media?.path || media?.file_path || media?.url || '';
    }

    function getMediaPreviewPath(media) {
        return normalizeMediaPath(
            media?.thumbnail_path || media?.preview_path || media?.thumb_path || getMediaRawPath(media)
        );
    }

    function detectMediaTypeFromFilename(filename, selectedType = 'auto') {
        if (selectedType && selectedType !== 'auto') {
            return selectedType;
        }

        const lowerName = String(filename || '').toLowerCase();
        if (IMAGE_EXTENSIONS.test(lowerName)) return 'image';
        if (VIDEO_EXTENSIONS.test(lowerName)) return 'video';
        if (AUDIO_EXTENSIONS.test(lowerName)) return 'audio';
        if (MODEL_EXTENSIONS.test(lowerName)) return 'model_3d';
        return null;
    }

    function normalizeMediaType(media) {
        let type = media?.media_type || media?.type || 'unknown';
        const checkPath = getMediaFilename(media) || getMediaRawPath(media);

        if ((!type || type === 'unknown') && checkPath) {
            type = detectMediaTypeFromFilename(checkPath, 'auto') || 'unknown';
        }

        if ((type === 'image' || type === 'unknown') && media?.is_pano === true) {
            type = 'panorama';
        }

        return type;
    }

    function ensureMediaTypes(mediaFiles) {
        mediaFiles.forEach((media) => {
            if (!media) return;
            media.media_type = normalizeMediaType(media);
        });
    }

    function extractMediaFiles(data) {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.media)) return data.media;
        if (Array.isArray(data?.files)) return data.files;

        if (data && typeof data === 'object') {
            for (const value of Object.values(data)) {
                if (Array.isArray(value)) {
                    return value;
                }
            }
        }

        return [];
    }

    function getMediaTypeLabel(mediaType) {
        return {
            panorama: '360° Panoramalar',
            image: 'Görseller',
            video: 'Videolar',
            audio: 'Ses Dosyaları',
            model_3d: '3D Modeller',
            unknown: 'Diğer'
        }[mediaType] || String(mediaType || '').toUpperCase();
    }

    function isImageMedia(mediaType, filename) {
        return mediaType === 'image' || mediaType === 'panorama' || IMAGE_EXTENSIONS.test(String(filename || ''));
    }

    function formatMediaSize(fileSize) {
        return fileSize ? `${(fileSize / 1024).toFixed(0)}KB` : '';
    }

    function getRouteMediaContainer() {
        return document.getElementById('routeCurrentMedia');
    }

    async function findRouteMediaContainer() {
        let container = getRouteMediaContainer();
        if (container) return container;

        await wait(500);
        container = getRouteMediaContainer();
        if (container) return container;

        const editForm = document.getElementById('routeEditForm');
        return editForm?.querySelector('[id*="media"]') || null;
    }

    function buildMediaPopupPreview(media, mediaType) {
        const mediaPath = normalizeMediaPath(media?.preview_path || media?.thumbnail_path || media?.file_path || media?.path);
        if (!mediaPath) return '';

        const safePath = escapeHtml(mediaPath);
        if (mediaType === 'image' || mediaType === 'panorama') {
            return `<div style="margin-top:8px"><img src="${safePath}" alt="media" style="width:100%;border-radius:6px;"></div>`;
        }
        if (mediaType === 'video') {
            return `<div style="margin-top:8px"><video src="${safePath}" controls style="width:100%;border-radius:6px;max-height:200px"></video></div>`;
        }
        if (mediaType === 'audio') {
            return `<div style="margin-top:8px"><audio controls style="width:100%"><source src="${safePath}"></audio></div>`;
        }
        return '';
    }

    async function uploadRouteMediaFiles({ files, caption, isPrimary, getSelectedType }) {
        const progressModal = showUploadProgressModal(files.length);
        let uploadedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        try {
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                updateUploadProgress(progressModal, index + 1, files.length, file.name, successCount, errorCount);

                const mediaType = detectMediaTypeFromFilename(file.name, getSelectedType(file));
                if (!mediaType) {
                    showNotification(`Dosya türü tespit edilemedi: ${file.name}`, 'error');
                    errorCount += 1;
                    continue;
                }

                const maxSize = getMediaMaxSize(mediaType) * 1024 * 1024;
                if (file.size > maxSize) {
                    showNotification(
                        `Dosya boyutu ${getMediaMaxSize(mediaType)}MB'dan küçük olmalıdır.\n\nSeçilen dosya: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
                        'error'
                    );
                    errorCount += 1;
                    continue;
                }

                let exifLocation = null;
                if (mediaType === 'image' || mediaType === 'panorama') {
                    try {
                        exifLocation = await extractExifLocation(file);
                    } catch (error) {
                        console.warn('EXIF extraction failed:', error);
                    }
                }

                let fileToUpload = file;
                if ((mediaType === 'image' || mediaType === 'panorama') && !String(file.name).toLowerCase().endsWith('.webp')) {
                    try {
                        updateUploadProgress(
                            progressModal,
                            index + 1,
                            files.length,
                            `${file.name} (WebP'ye dönüştürülüyor...)`,
                            successCount,
                            errorCount
                        );
                        fileToUpload = await convertImageToWebP(file);
                    } catch (error) {
                        console.warn('WebP conversion failed, using original file:', error);
                        fileToUpload = file;
                    }
                }

                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('caption', caption);
                formData.append('media_type', mediaType);
                formData.append('is_primary', index === 0 && isPrimary);

                try {
                    const response = await fetch(`${apiBase}/admin/routes/${getRouteId(currentRoute)}/media`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });

                    if (!response.ok) {
                        let errorMessage = 'Medya yükleme başarısız';
                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.error || errorMessage;
                        } catch (_) {
                            // Ignore malformed error payloads.
                        }
                        throw new Error(errorMessage);
                    }

                    const result = await response.json();
                    if (mediaType === 'image' || mediaType === 'panorama') {
                        const uploadedFilename = result.media?.filename || fileToUpload.name;
                        const location = exifLocation || getPendingExifLocation();
                        if (location) {
                            try {
                                updatePhotoLocationMarker(uploadedFilename, location.lat, location.lng, mediaType);
                                await updatePhotoLocation(uploadedFilename, location.lat, location.lng);
                                refreshPhotoLocationMarkers();
                            } catch (error) {
                                console.warn('EXIF location update failed:', error);
                            }
                            clearPendingExifLocation();
                        }
                    }

                    uploadedCount += 1;
                    successCount += 1;
                } catch (error) {
                    console.error('Media upload error:', error);
                    errorCount += 1;
                }
            }
        } finally {
            closeUploadProgressModal(progressModal);
        }

        return { uploadedCount, successCount, errorCount };
    }

    function showUploadSummary(successCount, errorCount) {
        if (errorCount === 0) {
            showNotification(`Tüm dosyalar başarıyla yüklendi (${successCount} dosya)`, 'success');
            return;
        }

        if (successCount === 0) {
            showNotification(`Hiçbir dosya yüklenemedi (${errorCount} hata)`, 'error');
            return;
        }

        showNotification(`Kısmi başarı: ${successCount} başarılı, ${errorCount} hatalı`, 'warning');
    }

    async function reloadRouteMediaWithRetry(routeId, maxRetries = 5) {
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                await loadRouteMediaForEdit(routeId);
                return;
            } catch (error) {
                retryCount += 1;
                if (retryCount >= maxRetries) {
                    throw error;
                }
                await wait(1000 * retryCount);
            }
        }
    }

    function showRouteMediaUploadForm() {
        if (!currentRoute) {
            showNotification('Önce bir rota seçin', 'error');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="routeMediaUploadModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-upload me-2"></i>
                                Medya Dosyası Ekle - ${escapeHtml(currentRoute.name)}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="routeMediaUploadForm">
                                <div class="mb-3">
                                    <label for="routeMediaFile" class="form-label">Medya Dosyası</label>
                                    <input type="file" class="form-control" id="routeMediaFile" accept="image/*,video/*,audio/*" multiple required>
                                    <div class="form-text">
                                        Desteklenen formatlar: JPG, PNG, GIF, MP4, MP3, vb.<br>
                                        <small class="text-info">Resimler isteğe bağlı olarak WebP formatına dönüştürülür.</small>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="routeMediaCaption" class="form-label">Açıklama (Opsiyonel)</label>
                                    <input type="text" class="form-control" id="routeMediaCaption" placeholder="Medya dosyası açıklaması">
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="routeMediaPrimary">
                                        <label class="form-check-label" for="routeMediaPrimary">
                                            Ana görsel olarak ayarla
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                            <button type="button" class="btn btn-primary" onclick="uploadRouteMediaFromModal()">
                                <i class="fas fa-upload me-1"></i>Yükle
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('routeMediaUploadModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('routeMediaUploadModal')).show();
    }

    async function uploadRouteMediaFromModal() {
        if (!currentRoute) {
            showNotification('Önce bir rota seçin', 'error');
            return;
        }

        const fileInput = document.getElementById('routeMediaFile');
        const captionInput = document.getElementById('routeMediaCaption');
        const primaryInput = document.getElementById('routeMediaPrimary');

        if (!fileInput?.files?.length) {
            showNotification('Lütfen bir medya dosyası seçin', 'error');
            return;
        }

        const files = Array.from(fileInput.files);
        const { uploadedCount, successCount, errorCount } = await uploadRouteMediaFiles({
            files,
            caption: captionInput?.value || '',
            isPrimary: Boolean(primaryInput?.checked),
            getSelectedType: () => 'auto'
        });

        if (uploadedCount === 0) {
            showNotification('Hiçbir dosya yüklenemedi', 'error');
            return;
        }

        showUploadSummary(successCount, errorCount);

        const modalElement = document.getElementById('routeMediaUploadModal');
        const modal = modalElement ? bootstrap.Modal.getInstance(modalElement) : null;
        if (modal) {
            modal.hide();
        }

        if (fileInput) fileInput.value = '';
        if (captionInput) captionInput.value = '';
        if (primaryInput) primaryInput.checked = false;

        await wait(1000);
        await loadRouteMediaForEdit(getRouteId(currentRoute));
    }

    async function convertImageToWebP(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const image = new Image();

            image.onload = function onImageLoad() {
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = image;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                context.fillStyle = '#FFFFFF';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('WebP conversion failed'));
                        return;
                    }

                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                        type: 'image/webp',
                        lastModified: Date.now()
                    }));
                }, 'image/webp', 0.85);
            };

            image.onerror = () => reject(new Error('Image loading failed'));
            image.src = URL.createObjectURL(file);
        });
    }

    function showUploadProgressModal(totalFiles) {
        const modalId = 'uploadProgressModal';
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-upload me-2"></i>
                                Medya Dosyaları Yükleniyor
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="upload-progress-container">
                                <div class="progress mb-3">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated"
                                         role="progressbar"
                                         style="width: 0%"
                                         id="uploadProgressBar">
                                        0%
                                    </div>
                                </div>

                                <div class="upload-stats mb-3">
                                    <div class="row text-center">
                                        <div class="col-4">
                                            <div class="stat-item">
                                                <div class="stat-number text-primary" id="currentFileNumber">0</div>
                                                <div class="stat-label">Mevcut Dosya</div>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="stat-item">
                                                <div class="stat-number text-success" id="successCount">0</div>
                                                <div class="stat-label">Başarılı</div>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="stat-item">
                                                <div class="stat-number text-danger" id="errorCount">0</div>
                                                <div class="stat-label">Hatalı</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="current-file-info">
                                    <div class="alert alert-info">
                                        <i class="fas fa-file me-2"></i>
                                        <span id="currentFileName">Dosya hazırlanıyor...</span>
                                    </div>
                                </div>

                                <div class="upload-log" id="uploadLog" style="max-height: 200px; overflow-y: auto;"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeUploadProgressModal('${modalId}')" id="cancelUploadBtn">
                                <i class="fas fa-times me-1"></i>İptal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

        return { modalId, modal, totalFiles };
    }

    function updateUploadProgress(progressModal, currentFile, totalFiles, fileName, successCount, errorCount) {
        const progressBar = document.getElementById('uploadProgressBar');
        const currentFileNumber = document.getElementById('currentFileNumber');
        const successCountElement = document.getElementById('successCount');
        const errorCountElement = document.getElementById('errorCount');
        const currentFileName = document.getElementById('currentFileName');
        const uploadLog = document.getElementById('uploadLog');

        if (!progressBar || !currentFileNumber || !successCountElement || !errorCountElement || !currentFileName || !uploadLog) {
            return;
        }

        const progress = Math.round((currentFile / totalFiles) * 100);
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${progress}%`;
        currentFileNumber.textContent = String(currentFile);
        successCountElement.textContent = String(successCount);
        errorCountElement.textContent = String(errorCount);
        currentFileName.textContent = String(fileName || '');

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry mb-2';

        const timeElement = document.createElement('small');
        timeElement.className = 'text-muted';
        timeElement.textContent = new Date().toLocaleTimeString();

        const fileElement = document.createElement('span');
        fileElement.className = 'ms-2';
        fileElement.textContent = String(fileName || '');

        logEntry.appendChild(timeElement);
        logEntry.appendChild(fileElement);
        uploadLog.appendChild(logEntry);
        uploadLog.scrollTop = uploadLog.scrollHeight;
    }

    function closeUploadProgressModal(progressModalOrId) {
        const modalId = typeof progressModalOrId === 'string'
            ? progressModalOrId
            : progressModalOrId?.modalId;

        if (!modalId) return;

        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;

        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        modalElement.remove();
    }

    async function convertImageUrlToWebP(imageUrl, filename) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const image = new Image();

            image.crossOrigin = 'anonymous';
            image.onload = function onImageLoad() {
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = image;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                context.fillStyle = '#FFFFFF';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('WebP conversion failed'));
                        return;
                    }

                    resolve(new File([blob], filename.replace(/\.[^/.]+$/, '.webp'), {
                        type: 'image/webp',
                        lastModified: Date.now()
                    }));
                }, 'image/webp', 0.85);
            };

            image.onerror = () => reject(new Error('Image loading failed'));
            image.src = imageUrl;
        });
    }

    async function convertExistingImageToWebP(filename, imagePath) {
        if (!currentRoute) {
            showNotification('Aktif rota bulunamadı', 'error');
            return;
        }

        const routeId = getRouteId(currentRoute);
        if (!routeId) {
            showNotification('Rota ID bulunamadı', 'error');
            return;
        }

        if (!confirm(`"${filename}" dosyasını WebP formatına dönüştürmek istediğinizden emin misiniz?\n\nBu işlem orijinal dosya ile değiştirilecektir.`)) {
            return;
        }

        try {
            showNotification('Resim WebP formatına dönüştürülüyor...', 'info');

            const webpFile = await convertImageUrlToWebP(normalizeMediaPath(imagePath), filename);
            const formData = new FormData();
            formData.append('file', webpFile);
            formData.append('caption', `WebP dönüştürülmüş: ${filename}`);
            formData.append('replace_existing', 'true');

            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'WebP dönüştürme başarısız');
            }

            showNotification(`"${filename}" başarıyla WebP formatına dönüştürüldü`, 'success');
            await wait(1000);
            await loadRouteMediaForEdit(routeId);
        } catch (error) {
            console.error('WebP conversion error:', error);
            showNotification(`WebP dönüştürme hatası: ${error.message}`, 'error');
        }
    }

    async function uploadRouteMedia() {
        if (!currentRoute) {
            showNotification('Önce bir rota seçin', 'error');
            return;
        }

        const fileInput = document.getElementById('routeMediaFile');
        const typeSelect = document.getElementById('routeMediaType');
        const captionInput = document.getElementById('routeMediaCaption');
        const primaryInput = document.getElementById('routeMediaPrimary');

        if (!fileInput?.files?.length) {
            showNotification('Lütfen bir medya dosyası seçin', 'error');
            return;
        }

        const routeId = getRouteId(currentRoute);
        const { uploadedCount, successCount, errorCount } = await uploadRouteMediaFiles({
            files: Array.from(fileInput.files),
            caption: captionInput?.value || '',
            isPrimary: Boolean(primaryInput?.checked),
            getSelectedType: () => typeSelect?.value || 'auto'
        });

        if (uploadedCount === 0) {
            showNotification('Hiçbir dosya yüklenemedi', 'error');
            return;
        }

        showUploadSummary(successCount, errorCount);

        fileInput.value = '';
        if (captionInput) captionInput.value = '';
        if (primaryInput) primaryInput.checked = false;
        if (typeSelect) typeSelect.value = 'auto';

        await wait(1000);
        try {
            await reloadRouteMediaWithRetry(routeId);
        } catch (error) {
            console.error('All media reload attempts failed:', error);
        }

        if (typeof global.loadRouteMedia === 'function' && global.loadRouteMedia !== loadRouteMediaForEdit) {
            try {
                await global.loadRouteMedia(routeId);
            } catch (error) {
                console.warn('Fallback loadRouteMedia failed:', error);
            }
        }
    }

    function getMediaTypeIcon(mediaType) {
        return {
            image: '📸',
            panorama: '🌀',
            video: '🎥',
            audio: '🎵',
            model_3d: '🧊',
            unknown: '📄'
        }[mediaType] || '📄';
    }

    function getMediaMaxSize(mediaType) {
        return {
            image: 15,
            panorama: 15,
            video: 100,
            audio: 50,
            model_3d: 50
        }[mediaType] || 15;
    }

    async function loadRouteMediaForEdit(routeId) {
        if (!routeId) {
            console.warn('loadRouteMediaForEdit: No routeId provided');
            return;
        }

        const container = await findRouteMediaContainer();
        if (!container) {
            console.warn('Route media container could not be found');
            return;
        }

        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Medya dosyaları yükleniyor...</p></div>';

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media`, {
                credentials: 'include'
            });

            if (!response.ok) {
                container.innerHTML = `<div class="text-center text-muted py-3">Medya bilgileri yüklenemedi. HTTP: ${response.status}</div>`;
                return;
            }

            const data = await response.json();
            const mediaFiles = extractMediaFiles(data);
            ensureMediaTypes(mediaFiles);

            global.currentRouteMediaFilesCache = mediaFiles;
            displayRouteCurrentMedia(mediaFiles, routeId);

            try {
                const locatedMedia = mediaFiles.filter((media) => {
                    const lat = parseFloat(media?.lat ?? media?.latitude);
                    const lng = parseFloat(media?.lng ?? media?.longitude ?? media?.lon);
                    return Number.isFinite(lat) && Number.isFinite(lng);
                });

                if (locatedMedia.length > 0 && global.L && global.map && global.poiMarkersLayer) {
                    const typeLabels = {
                        panorama: '360° Panorama',
                        image: 'Fotoğraf',
                        video: 'Video',
                        audio: 'Ses',
                        model_3d: '3D Model',
                        unknown: 'Medya'
                    };

                    locatedMedia.forEach((media) => {
                        const lat = parseFloat(media?.lat ?? media?.latitude);
                        const lng = parseFloat(media?.lng ?? media?.longitude ?? media?.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                        const mediaType = normalizeMediaType(media);
                        const label = typeLabels[mediaType] || 'Medya';
                        const preview = buildMediaPopupPreview(media, mediaType);
                        const caption = media?.caption ? `<div style="margin-top:4px;color:#666">${escapeHtml(media.caption)}</div>` : '';
                        const marker = global.L.marker([lat, lng], { icon: getMediaMarkerIcon(mediaType) })
                            .bindPopup(`<div style="min-width:180px"><strong>${label}</strong>${caption}${preview}</div>`)
                            .addTo(global.map);
                        global.poiMarkersLayer.addLayer(marker);
                    });

                    if (global.routeElevationChart) {
                        global.routeElevationChart.setMediaMarkers(locatedMedia);
                    }
                } else if (global.routeElevationChart) {
                    global.routeElevationChart.setMediaMarkers([]);
                }
            } catch (error) {
                console.warn('Medya konumları haritaya eklenemedi:', error);
            }
        } catch (error) {
            console.error('Error loading route media:', error);
            container.innerHTML = `<div class="text-center text-danger py-3">Medya yüklenirken hata oluştu: ${escapeHtml(error.message)}</div>`;
        }
    }

    function displayRouteCurrentMedia(mediaFiles, routeId) {
        const container = getRouteMediaContainer();
        if (!container) {
            console.error('Media container not found in displayRouteCurrentMedia');
            return;
        }

        if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Henüz medya dosyası eklenmemiş.</div>';
            return;
        }

        const groupedMedia = {};
        mediaFiles.forEach((media) => {
            if (!media) return;
            const mediaType = normalizeMediaType(media);
            if (!groupedMedia[mediaType]) {
                groupedMedia[mediaType] = [];
            }
            groupedMedia[mediaType].push(media);
        });

        let mediaHtml = '';
        Object.keys(groupedMedia).forEach((mediaType) => {
            mediaHtml += `
                <div class="media-type-section">
                    <h6 class="media-type-title">${getMediaTypeIcon(mediaType)} ${getMediaTypeLabel(mediaType)} (${groupedMedia[mediaType].length})</h6>
                    <div class="current-media-grid">
            `;

            groupedMedia[mediaType].forEach((media) => {
                const rawPath = getMediaRawPath(media);
                const normalizedPath = normalizeMediaPath(rawPath);
                const previewPath = getMediaPreviewPath(media);
                const filename = getMediaFilename(media);
                const filenameLabel = escapeHtml(filename);
                const mediaTypeValue = normalizeMediaType(media);
                const imageMedia = isImageMedia(mediaTypeValue, filename);
                const lat = parseFloat(media?.lat ?? media?.latitude);
                const lng = parseFloat(media?.lng ?? media?.longitude ?? media?.lon);
                const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
                const safePreviewPath = escapeHtml(previewPath);
                const cardDataLat = hasLocation ? lat : '';
                const cardDataLng = hasLocation ? lng : '';

                mediaHtml += `
                    <div class="media-item-card ${hasLocation ? 'has-location' : ''}" data-media-id="${filenameLabel}" data-lat="${cardDataLat}" data-lng="${cardDataLng}">
                        <button class="media-delete-btn" onclick="deleteRouteMediaFile(${toInlineHandlerArg(routeId)}, ${toInlineHandlerArg(filename)})" title="Sil">
                            <i class="fas fa-times"></i>
                        </button>

                        ${imageMedia && previewPath ? `
                            <img src="${safePreviewPath}" class="media-preview" alt="${filenameLabel}"
                                 onclick="showRouteMediaModal(${toInlineHandlerArg(normalizedPath)}, ${toInlineHandlerArg(filename)}, ${toInlineHandlerArg(mediaTypeValue)})"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                 style="display: block;">` : ''}

                        <div class="media-placeholder" onclick="showRouteMediaModal(${toInlineHandlerArg(normalizedPath)}, ${toInlineHandlerArg(filename)}, ${toInlineHandlerArg(mediaTypeValue)})" style="display: ${imageMedia && previewPath ? 'none' : 'flex'};">
                            ${getMediaTypeIcon(mediaTypeValue)}
                            <div class="media-format">${escapeHtml(filename.split('.').pop()?.toUpperCase() || '')}</div>
                        </div>

                        <div class="media-type-badge">${getMediaTypeIcon(mediaTypeValue)}</div>

                        <div class="media-item-info">
                            <div class="media-item-name">${filenameLabel}</div>
                            <div class="media-item-size">${formatMediaSize(media?.file_size)}</div>
                            ${media?.compression_ratio && media.compression_ratio !== '0%' ? `<div class="media-compression">📦 ${escapeHtml(media.compression_ratio)}</div>` : ''}

                            <div class="media-location-info">
                                ${hasLocation ? `
                                    <div class="location-badge location-set">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
                                        <div class="location-actions">
                                            <button class="btn-location-edit" onclick="editPhotoLocation(${toInlineHandlerArg(filename)}, ${lat}, ${lng})" title="Konumu Düzenle">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-location-remove" onclick="removePhotoLocation(${toInlineHandlerArg(filename)})" title="Konumu Kaldır">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                        <div class="location-source-info">
                                            <small class="text-success">
                                                <i class="fas fa-check-circle"></i> Konum otomatik olarak EXIF'ten çıkarıldı
                                            </small>
                                        </div>
                                    </div>` : `
                                    <div class="location-badge location-missing">
                                        <i class="fas fa-map-marker-alt text-muted"></i>
                                        <span class="text-muted">Konum yok</span>
                                        <div class="location-actions">
                                            <button class="btn-location-add" onclick="addPhotoLocation(${toInlineHandlerArg(filename)})" title="EXIF'ten Konum Çıkar">
                                                <i class="fas fa-magic"></i>
                                            </button>
                                            <button class="btn-location-edit" onclick="addPhotoLocation(${toInlineHandlerArg(filename)})" title="Manuel Konum Ekle">
                                                <i class="fas fa-plus"></i>
                                            </button>
                                        </div>
                                        <div class="location-source-info">
                                            <small class="text-muted">
                                                <i class="fas fa-info-circle"></i> EXIF konum bilgisi yok veya çıkarılamadı
                                            </small>
                                        </div>
                                    </div>`
                                }

                                ${imageMedia && !filename.toLowerCase().endsWith('.webp') ? `
                                    <div class="webp-conversion-actions mt-2">
                                        <button class="btn btn-sm btn-outline-info" onclick="convertExistingImageToWebP(${toInlineHandlerArg(filename)}, ${toInlineHandlerArg(normalizedPath || rawPath)})" title="WebP formatına dönüştür">
                                            <i class="fas fa-compress"></i> WebP'ye Dönüştür
                                        </button>
                                    </div>` : ''
                                }
                            </div>
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
    }

    async function deleteRouteMediaFile(routeId, filename) {
        if (!confirm(`'${filename}' dosyasını silmek istediğinizden emin misiniz?`)) {
            return;
        }

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}/media/${encodePathSegment(filename)}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Dosya silinemedi');
            }

            showNotification('Medya dosyası başarıyla silindi', 'success');
            await loadRouteMediaForEdit(routeId);
        } catch (error) {
            console.error('Media delete error:', error);
            showNotification(`Medya silme hatası: ${error.message}`, 'error');
        }
    }

    function showRouteMediaModal(mediaPath, filename, mediaType) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';

        const safePath = escapeHtml(normalizeMediaPath(mediaPath));
        const safeFilename = escapeHtml(filename);
        const effectiveType = mediaType === 'panorama' ? 'image' : mediaType;

        let modalContent = '';
        if (effectiveType === 'image') {
            modalContent = `<img src="${safePath}" class="img-fluid rounded-3 shadow-lg" alt="${safeFilename}" style="max-height: 70vh;">`;
        } else if (effectiveType === 'video') {
            modalContent = `
                <video controls class="w-100 rounded-3 shadow-lg" style="max-height: 70vh;">
                    <source src="${safePath}" type="video/mp4">
                    Tarayıcınız video oynatmayı desteklemiyor.
                </video>`;
        } else if (effectiveType === 'audio') {
            modalContent = `
                <div class="text-center p-4">
                    <i class="fas fa-music fa-3x text-primary mb-3"></i>
                    <h5>${safeFilename}</h5>
                    <audio controls class="w-100 mt-3">
                        <source src="${safePath}">
                        Tarayıcınız ses oynatmayı desteklemiyor.
                    </audio>
                </div>`;
        } else if (effectiveType === 'model_3d') {
            modalContent = `
                <div class="text-center p-4">
                    <i class="fas fa-cube fa-3x text-primary mb-3"></i>
                    <h5>${safeFilename}</h5>
                    <p class="text-muted">3D model dosyası. Uygun bir görüntüleyici ile açabilirsiniz.</p>
                </div>`;
        } else {
            modalContent = `
                <div class="text-center p-4">
                    <i class="fas fa-file fa-3x text-primary mb-3"></i>
                    <h5>${safeFilename}</h5>
                    <p class="text-muted">Medya dosyası</p>
                </div>`;
        }

        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold"><i class="fas fa-file me-2"></i>${safeFilename}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center p-4">
                        ${modalContent}
                    </div>
                    <div class="modal-footer justify-content-center">
                        <a href="${safePath}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
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
    }

    function getMediaMarkerIcon(mediaType) {
        const normalizedType = String(mediaType || '').toLowerCase();
        if (normalizedType === 'panorama' || normalizedType === 'image_360' || normalizedType === 'photo_360' || normalizedType === 'pano') {
            return L.divIcon({
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
        }

        const iconMap = {
            image: { icon: 'fa-camera', cls: 'image' },
            video: { icon: 'fa-video', cls: 'video' },
            audio: { icon: 'fa-music', cls: 'audio' },
            model_3d: { icon: 'fa-cube', cls: 'model_3d' }
        };
        const iconConfig = iconMap[normalizedType] || { icon: 'fa-file', cls: 'image' };
        return L.divIcon({
            html: `<div class="media-marker ${iconConfig.cls}"><i class="fas ${iconConfig.icon}"></i></div>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    global.showRouteMediaUploadForm = showRouteMediaUploadForm;
    global.uploadRouteMediaFromModal = uploadRouteMediaFromModal;
    global.convertImageToWebP = convertImageToWebP;
    global.showUploadProgressModal = showUploadProgressModal;
    global.updateUploadProgress = updateUploadProgress;
    global.closeUploadProgressModal = closeUploadProgressModal;
    global.convertImageUrlToWebP = convertImageUrlToWebP;
    global.convertExistingImageToWebP = convertExistingImageToWebP;
    global.uploadRouteMedia = uploadRouteMedia;
    global.getMediaTypeIcon = getMediaTypeIcon;
    global.getMediaMaxSize = getMediaMaxSize;
    global.loadRouteMediaForEdit = loadRouteMediaForEdit;
    global.displayRouteCurrentMedia = displayRouteCurrentMedia;
    global.deleteRouteMediaFile = deleteRouteMediaFile;
    global.showRouteMediaModal = showRouteMediaModal;
    global.getMediaMarkerIcon = getMediaMarkerIcon;
})(window);
