(function (global) {
    'use strict';

    function getRouteId(route) {
        return route?.id ?? route?._id ?? route?.route_id ?? null;
    }

    function getPoiId(poi) {
        return poi?.id ?? poi?._id ?? poi?.poi_id ?? null;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return 'Bilinmiyor';
        return new Date(dateString).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function showLoading(containerId = 'routeListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
            </div>
        `;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex justify-content-between align-items-center';

        const messageElement = document.createElement('span');
        messageElement.textContent = String(message ?? '');

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close btn-close-white';
        closeButton.addEventListener('click', () => {
            notification.remove();
        });

        wrapper.appendChild(messageElement);
        wrapper.appendChild(closeButton);
        notification.appendChild(wrapper);
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    function downloadFile(blob, filename, mimeType) {
        const payload = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
        const url = global.URL.createObjectURL(payload);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        global.URL.revokeObjectURL(url);
    }

    global.getRouteId = getRouteId;
    global.getPoiId = getPoiId;
    global.escapeHtml = escapeHtml;
    global.formatDate = formatDate;
    global.showLoading = showLoading;
    global.showNotification = showNotification;
    global.showError = showError;
    global.downloadFile = downloadFile;
})(window);
