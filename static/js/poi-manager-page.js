(function (global) {
    'use strict';

    function withPOIManager(callback) {
        if (global.poiManager) {
            callback(global.poiManager);
        }
    }

    function showPasswordChangeModal() {
        const message = 'Bu panel parola ile değil yönetici tokeni ile korunuyor. Token değişikliği sunucuda POI_ADMIN_TOKEN ortam değişkeni üzerinden yapılır.';
        if (global.poiManager?.showToast) {
            global.poiManager.showToast(message, 'info');
            return;
        }
        global.alert(message);
    }

    function togglePasswordVisibility(inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('i');
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
            return;
        }

        input.type = 'password';
        icon.className = 'fas fa-eye';
    }

    function validatePasswordStrength(password) {
        const strengthDiv = document.getElementById('passwordStrength');
        if (!strengthDiv) return;

        let score = 0;
        const feedback = [];

        if (password.length >= 8) score += 1; else feedback.push('En az 8 karakter');
        if (/[A-Z]/.test(password)) score += 1; else feedback.push('Büyük harf');
        if (/[a-z]/.test(password)) score += 1; else feedback.push('Küçük harf');
        if (/\d/.test(password)) score += 1; else feedback.push('Rakam');
        if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) score += 1; else feedback.push('Özel karakter');

        let strengthText = '';
        let strengthClass = '';

        if (score === 5) {
            strengthText = '<i class="fas fa-check-circle text-success me-1"></i>Güçlü şifre';
            strengthClass = 'text-success';
        } else if (score >= 3) {
            strengthText = '<i class="fas fa-exclamation-circle text-warning me-1"></i>Orta güçlükte';
            strengthClass = 'text-warning';
        } else {
            strengthText = '<i class="fas fa-times-circle text-danger me-1"></i>Zayıf şifre';
            strengthClass = 'text-danger';
        }

        strengthDiv.className = strengthClass;
        strengthDiv.innerHTML = strengthText + (feedback.length ? ` <small class="text-muted">(${feedback.join(', ')})</small>` : '');
        checkPasswordMatch();
    }

    function checkPasswordMatch() {
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const matchDiv = document.getElementById('passwordMatch');

        if (!matchDiv || confirmPassword === undefined) return;
        if (!confirmPassword) {
            matchDiv.innerHTML = '';
            return;
        }

        if (newPassword === confirmPassword) {
            matchDiv.className = 'text-success';
            matchDiv.innerHTML = '<i class="fas fa-check-circle me-1"></i>Eşleşti';
            return;
        }

        matchDiv.className = 'text-danger';
        matchDiv.innerHTML = '<i class="fas fa-times-circle me-1"></i>Eşleşmiyor';
    }

    async function changePassword() {
        showPasswordChangeModal();
    }

    function initMapResizer() {
        const resizer = document.getElementById('mapResizer');
        const root = document.documentElement;
        if (!resizer) return;

        let startX = 0;
        let startWidth = Number.parseInt(getComputedStyle(root).getPropertyValue('--map-width'), 10);

        const onMouseMove = (event) => {
            const dx = startX - event.clientX;
            let newWidth = startWidth + dx;
            if (newWidth < 300) newWidth = 300;
            root.style.setProperty('--map-width', `${newWidth}px`);
            if (global.poiManager?.map) {
                global.poiManager.map.invalidateSize();
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        resizer.addEventListener('mousedown', (event) => {
            startX = event.clientX;
            startWidth = Number.parseInt(getComputedStyle(root).getPropertyValue('--map-width'), 10);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    function toggleMapFullscreen() {
        const mapEl = document.getElementById('map');
        const btn = document.getElementById('toggleFullscreenBtn');
        if (!mapEl) return;

        mapEl.classList.toggle('fullscreen');
        document.body.classList.toggle('map-fullscreen');

        if (global.poiManager?.map) {
            setTimeout(() => {
                global.poiManager.map.invalidateSize();
            }, 200);
        }

        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-expand');
                icon.classList.toggle('fa-compress');
            }
        }
    }

    global.logout = function logout() {
        withPOIManager((poiManager) => poiManager.logout());
    };

    global.showPasswordChangeModal = showPasswordChangeModal;
    global.togglePasswordVisibility = togglePasswordVisibility;
    global.validatePasswordStrength = validatePasswordStrength;
    global.checkPasswordMatch = checkPasswordMatch;
    global.changePassword = changePassword;

    global.showCreatePOIModal = function showCreatePOIModal() {
        withPOIManager((poiManager) => poiManager.showCreatePOIModal());
    };

    global.createPOI = function createPOI() {
        withPOIManager((poiManager) => poiManager.createPOI());
    };

    global.uploadPOIMedia = function uploadPOIMedia() {
        withPOIManager((poiManager) => poiManager.uploadPOIMedia());
    };

    global.showMediaModal = function showMediaModal(mediaPath, filename, mediaType) {
        withPOIManager((poiManager) => poiManager.showMediaModal(mediaPath, filename, mediaType));
    };

    global.deleteMediaFile = function deleteMediaFile(poiId, filename) {
        withPOIManager((poiManager) => poiManager.deleteMediaFile(poiId, filename));
    };

    global.deleteStandalonePanorama = function deleteStandalonePanorama(panoId) {
        withPOIManager((poiManager) => poiManager.deleteStandalonePanorama(panoId));
    };

    global.deleteRoutePanorama = function deleteRoutePanorama(routeId, filename) {
        withPOIManager((poiManager) => poiManager.deleteRoutePanorama(routeId, filename));
    };

    global.toggleMapFullscreen = toggleMapFullscreen;

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof POIManager !== 'function') {
            console.error('POIManager sınıfı yüklenemedi');
            return;
        }

        global.poiManager = new POIManager();
        initMapResizer();

        if (global.navigationManager) {
            global.navigationManager.currentPage = 'poi-management';
            global.navigationManager.refresh();
        }
    });
})(window);
