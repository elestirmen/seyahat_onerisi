(function (global) {
    'use strict';

    global.routeCoordinates = global.routeCoordinates || [];
    let coordinateMarkers = [];

    function getRouteCoordinates() {
        if (!Array.isArray(global.routeCoordinates)) {
            global.routeCoordinates = [];
        }
        return global.routeCoordinates;
    }

    function setRouteCoordinates(coordinates) {
        global.routeCoordinates = coordinates;
    }

    function nextCoordinateId() {
        return getRouteCoordinates().reduce((maxId, coordinate) => Math.max(maxId, Number(coordinate?.id) || 0), 0) + 1;
    }

    function normalizeCoordinateEntry(coordinate, fallbackName, id) {
        const lat = Number(coordinate?.[1] ?? coordinate?.lat ?? coordinate?.latitude);
        const lng = Number(coordinate?.[0] ?? coordinate?.lng ?? coordinate?.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }

        return {
            id,
            lat,
            lng,
            name: coordinate?.name || fallbackName,
            description: coordinate?.description || ''
        };
    }

    function getCoordinateFormButton() {
        return document.querySelector('.coordinate-actions .btn-success');
    }

    function resetCoordinateFormButton() {
        const addButton = getCoordinateFormButton();
        if (!addButton) return;

        addButton.innerHTML = '<i class="fas fa-plus me-1"></i>Koordinat Ekle';
        addButton.onclick = addCoordinateToRoute;
    }

    function renderCoordinatePopup(coordinate) {
        return `
            <div class="coordinate-popup">
                <h6>${escapeHtml(coordinate.name)}</h6>
                <p class="mb-1"><strong>Koordinat:</strong> ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}</p>
                ${coordinate.description ? `<p class="mb-0"><em>${escapeHtml(coordinate.description)}</em></p>` : ''}
            </div>
        `;
    }

    async function loadRouteCoordinates(routeId) {
        if (!routeId) return;

        try {
            const response = await fetch(`${apiBase}/admin/routes/${routeId}`, {
                credentials: 'include'
            });
            if (!response.ok) return;

            const payload = await response.json();
            const route = payload.route || payload;
            const coordinates = [];

            clearAllCoordinateMarkers();
            setRouteCoordinates([]);

            if (Array.isArray(route.coordinates)) {
                route.coordinates.forEach((coordinate, index) => {
                    const normalized = normalizeCoordinateEntry(coordinate, `Nokta ${index + 1}`, nextCoordinateId() + index);
                    if (normalized) {
                        coordinates.push(normalized);
                    }
                });
            } else if (Array.isArray(route.segments)) {
                route.segments.forEach((segment, segmentIndex) => {
                    if (!Array.isArray(segment?.coordinates)) return;
                    segment.coordinates.forEach((coordinate, coordinateIndex) => {
                        const normalized = normalizeCoordinateEntry(
                            coordinate,
                            `Segment ${segmentIndex + 1} - Nokta ${coordinateIndex + 1}`,
                            nextCoordinateId() + coordinates.length
                        );
                        if (normalized) {
                            coordinates.push(normalized);
                        }
                    });
                });
            }

            setRouteCoordinates(coordinates);
            displayRouteCoordinates();
            coordinates.forEach((coordinate) => addCoordinateMarker(coordinate));
            resetCoordinateFormButton();
        } catch (error) {
            console.error('Error loading route coordinates:', error);
        }
    }

    function displayRouteCoordinates() {
        const container = document.getElementById('routeCoordinatesList');
        if (!container) return;

        const coordinates = getRouteCoordinates();
        if (!coordinates.length) {
            container.innerHTML = '<div class="text-center text-muted py-3">Henuz koordinat eklenmemis.</div>';
            return;
        }

        container.innerHTML = coordinates.map((coordinate, index) => `
            <div class="coordinate-item" data-index="${index}">
                <div class="coordinate-number">${index + 1}</div>
                <div class="coordinate-info">
                    <div class="coordinate-name">${escapeHtml(coordinate.name)}</div>
                    <div class="coordinate-coords">${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}</div>
                    ${coordinate.description ? `<div class="coordinate-description">${escapeHtml(coordinate.description)}</div>` : ''}
                </div>
                <div class="coordinate-actions-item">
                    <button class="btn btn-sm btn-outline-primary" onclick="editCoordinate(${index})" title="Duzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeCoordinate(${index})" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function addCoordinateToRoute() {
        const lat = Number.parseFloat(document.getElementById('newCoordinateLat')?.value);
        const lng = Number.parseFloat(document.getElementById('newCoordinateLng')?.value);
        const name = (document.getElementById('newCoordinateName')?.value || '').trim();
        const description = (document.getElementById('newCoordinateDescription')?.value || '').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            showNotification('Lutfen gecerli enlem ve boylam degerleri girin', 'error');
            return;
        }
        if (lat < -90 || lat > 90) {
            showNotification('Enlem degeri -90 ile 90 arasinda olmalidir', 'error');
            return;
        }
        if (lng < -180 || lng > 180) {
            showNotification('Boylam degeri -180 ile 180 arasinda olmalidir', 'error');
            return;
        }

        const coordinates = getRouteCoordinates();
        const newCoordinate = {
            id: nextCoordinateId(),
            lat,
            lng,
            name: name || `Nokta ${coordinates.length + 1}`,
            description
        };

        coordinates.push(newCoordinate);
        displayRouteCoordinates();
        addCoordinateMarker(newCoordinate);
        clearCoordinateForm();

        showNotification('Koordinat basariyla eklendi', 'success');
    }

    function getCurrentMapLocation() {
        if (!map?.getCenter) {
            showNotification('Harita henuz yuklenmemis', 'error');
            return;
        }

        const center = map.getCenter();
        document.getElementById('newCoordinateLat').value = center.lat.toFixed(6);
        document.getElementById('newCoordinateLng').value = center.lng.toFixed(6);
        showNotification('Harita merkezi koordinatlari alindi', 'info');
    }

    function clearCoordinateForm() {
        document.getElementById('newCoordinateLat').value = '';
        document.getElementById('newCoordinateLng').value = '';
        document.getElementById('newCoordinateName').value = '';
        document.getElementById('newCoordinateDescription').value = '';
        resetCoordinateFormButton();
    }

    function editCoordinate(index) {
        const coordinate = getRouteCoordinates()[index];
        if (!coordinate) return;

        document.getElementById('newCoordinateLat').value = coordinate.lat;
        document.getElementById('newCoordinateLng').value = coordinate.lng;
        document.getElementById('newCoordinateName').value = coordinate.name;
        document.getElementById('newCoordinateDescription').value = coordinate.description;

        const addButton = getCoordinateFormButton();
        if (addButton) {
            addButton.innerHTML = '<i class="fas fa-save me-1"></i>Guncelle';
            addButton.onclick = () => updateCoordinate(index);
        }

        showNotification('Koordinat duzenleme moduna gecildi', 'info');
    }

    function updateCoordinate(index) {
        const coordinates = getRouteCoordinates();
        const currentCoordinate = coordinates[index];
        if (!currentCoordinate) return;

        const lat = Number.parseFloat(document.getElementById('newCoordinateLat')?.value);
        const lng = Number.parseFloat(document.getElementById('newCoordinateLng')?.value);
        const name = (document.getElementById('newCoordinateName')?.value || '').trim();
        const description = (document.getElementById('newCoordinateDescription')?.value || '').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            showNotification('Lutfen gecerli enlem ve boylam degerleri girin', 'error');
            return;
        }

        coordinates[index] = {
            ...currentCoordinate,
            lat,
            lng,
            name: name || currentCoordinate.name,
            description
        };

        displayRouteCoordinates();
        updateCoordinateMarker(coordinates[index]);
        clearCoordinateForm();
        showNotification('Koordinat basariyla guncellendi', 'success');
    }

    function removeCoordinate(index) {
        if (!confirm('Bu koordinati silmek istediginizden emin misiniz?')) {
            return;
        }

        const coordinates = getRouteCoordinates();
        const coordinate = coordinates[index];
        if (!coordinate) return;

        coordinates.splice(index, 1);
        displayRouteCoordinates();
        removeCoordinateMarker(coordinate);
        resetCoordinateFormButton();
        showNotification('Koordinat basariyla silindi', 'success');
    }

    function reorderCoordinates() {
        const coordinates = getRouteCoordinates();
        if (coordinates.length < 2) {
            showNotification('Siralama icin en az 2 koordinat gerekli', 'info');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Koordinat Siralamasini Duzenle</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">Koordinatlari surukleyip birakarak siralayin:</p>
                        <div id="reorderCoordinatesList" class="coordinates-list">
                            ${coordinates.map((coordinate, index) => `
                                <div class="coordinate-item reorderable" data-index="${index}" draggable="true">
                                    <div class="coordinate-number">${index + 1}</div>
                                    <div class="coordinate-info">
                                        <div class="coordinate-name">${escapeHtml(coordinate.name)}</div>
                                        <div class="coordinate-coords">${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}</div>
                                    </div>
                                    <div class="coordinate-actions-item">
                                        <i class="fas fa-grip-vertical text-muted"></i>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Iptal</button>
                        <button type="button" class="btn btn-primary" onclick="saveCoordinateOrder()">Siralamayi Kaydet</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        setupDragAndDrop();
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    function setupDragAndDrop() {
        const reorderList = document.getElementById('reorderCoordinatesList');
        if (!reorderList || reorderList.dataset.dragBound === 'true') return;

        reorderList.dataset.dragBound = 'true';

        let draggedElement = null;

        reorderList.addEventListener('dragstart', (event) => {
            draggedElement = event.target.closest('.reorderable');
            if (!draggedElement) return;

            draggedElement.style.opacity = '0.5';
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/html', draggedElement.outerHTML);
        });

        reorderList.addEventListener('dragend', () => {
            if (draggedElement) {
                draggedElement.style.opacity = '';
                draggedElement = null;
            }
        });

        reorderList.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        });

        reorderList.addEventListener('drop', (event) => {
            event.preventDefault();
            if (!draggedElement) return;

            const targetElement = event.target.closest('.reorderable');
            if (!targetElement || targetElement === draggedElement) return;

            const coordinates = getRouteCoordinates();
            const draggedIndex = Number.parseInt(draggedElement.dataset.index, 10);
            const targetIndex = Number.parseInt(targetElement.dataset.index, 10);
            const [movedCoordinate] = coordinates.splice(draggedIndex, 1);
            coordinates.splice(targetIndex, 0, movedCoordinate);
            updateReorderDisplay();
        });
    }

    function updateReorderDisplay() {
        const reorderList = document.getElementById('reorderCoordinatesList');
        if (!reorderList) return;

        reorderList.innerHTML = getRouteCoordinates().map((coordinate, index) => `
            <div class="coordinate-item reorderable" data-index="${index}" draggable="true">
                <div class="coordinate-number">${index + 1}</div>
                <div class="coordinate-info">
                    <div class="coordinate-name">${escapeHtml(coordinate.name)}</div>
                    <div class="coordinate-coords">${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}</div>
                </div>
                <div class="coordinate-actions-item">
                    <i class="fas fa-grip-vertical text-muted"></i>
                </div>
            </div>
        `).join('');

        setupDragAndDrop();
    }

    function saveCoordinateOrder() {
        displayRouteCoordinates();
        showNotification('Koordinat siralamasi guncellendi', 'success');

        const modal = document.querySelector('.modal.show');
        if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            bootstrapModal?.hide();
        }
    }

    function clearAllCoordinates() {
        if (!confirm('Tum koordinatlari silmek istediginizden emin misiniz? Bu islem geri alinamaz.')) {
            return;
        }

        setRouteCoordinates([]);
        displayRouteCoordinates();
        clearAllCoordinateMarkers();
        clearCoordinateForm();
        showNotification('Tum koordinatlar temizlendi', 'success');
    }

    function addCoordinateMarker(coordinate) {
        if (!map || !coordinate) return;

        const marker = L.marker([coordinate.lat, coordinate.lng], {
            title: coordinate.name,
            draggable: true
        }).addTo(map);

        marker.bindPopup(renderCoordinatePopup(coordinate));

        coordinateMarkers.push({
            coordinateId: coordinate.id,
            marker
        });

        marker.on('dragend', (event) => {
            const draggedCoordinate = getRouteCoordinates().find((item) => item.id === coordinate.id);
            if (!draggedCoordinate) return;

            const latlng = event.target.getLatLng();
            draggedCoordinate.lat = latlng.lat;
            draggedCoordinate.lng = latlng.lng;
            displayRouteCoordinates();
            updateCoordinateMarker(draggedCoordinate);
            showNotification('Koordinat haritada guncellendi', 'info');
        });
    }

    function updateCoordinateMarker(coordinate) {
        const markerData = coordinateMarkers.find((item) => item.coordinateId === coordinate.id);
        if (!markerData) return;

        markerData.marker.setLatLng([coordinate.lat, coordinate.lng]);
        markerData.marker.getPopup()?.setContent(renderCoordinatePopup(coordinate));
    }

    function removeCoordinateMarker(coordinate) {
        const markerData = coordinateMarkers.find((item) => item.coordinateId === coordinate.id);
        if (!markerData) return;

        map?.removeLayer(markerData.marker);
        coordinateMarkers = coordinateMarkers.filter((item) => item.coordinateId !== coordinate.id);
    }

    function clearAllCoordinateMarkers() {
        coordinateMarkers.forEach((markerData) => {
            map?.removeLayer(markerData.marker);
        });
        coordinateMarkers = [];
    }

    function setupMapClickForCoordinates() {
        if (!map) return;

        if (map._coordinateClickHandler) {
            map.off('click', map._coordinateClickHandler);
        }

        map._coordinateClickHandler = (event) => {
            const coordinateForm = document.querySelector('.coordinate-input-form');
            if (!coordinateForm || coordinateForm.style.display === 'none') {
                return;
            }

            document.getElementById('newCoordinateLat').value = event.latlng.lat.toFixed(6);
            document.getElementById('newCoordinateLng').value = event.latlng.lng.toFixed(6);
            showNotification('Haritadan koordinat alindi. Nokta adi ve aciklama ekleyip "Koordinat Ekle" butonuna tiklayin.', 'info');
        };

        map.on('click', map._coordinateClickHandler);
    }

    function initializeCoordinateManagement() {
        setupMapClickForCoordinates();

        if (currentRoute && getRouteCoordinates().length === 0) {
            loadRouteCoordinates(getRouteId(currentRoute));
        }
    }

    global.loadRouteCoordinates = loadRouteCoordinates;
    global.displayRouteCoordinates = displayRouteCoordinates;
    global.addCoordinateToRoute = addCoordinateToRoute;
    global.getCurrentMapLocation = getCurrentMapLocation;
    global.clearCoordinateForm = clearCoordinateForm;
    global.editCoordinate = editCoordinate;
    global.updateCoordinate = updateCoordinate;
    global.removeCoordinate = removeCoordinate;
    global.reorderCoordinates = reorderCoordinates;
    global.setupDragAndDrop = setupDragAndDrop;
    global.updateReorderDisplay = updateReorderDisplay;
    global.saveCoordinateOrder = saveCoordinateOrder;
    global.clearAllCoordinates = clearAllCoordinates;
    global.addCoordinateMarker = addCoordinateMarker;
    global.updateCoordinateMarker = updateCoordinateMarker;
    global.removeCoordinateMarker = removeCoordinateMarker;
    global.clearAllCoordinateMarkers = clearAllCoordinateMarkers;
    global.setupMapClickForCoordinates = setupMapClickForCoordinates;
    global.initializeCoordinateManagement = initializeCoordinateManagement;
})(window);
