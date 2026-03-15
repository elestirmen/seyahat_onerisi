(function (global) {
    'use strict';

    function withPOIManager(callback) {
        if (global.poiManager) {
            callback(global.poiManager);
        }
    }

    function showPasswordChangeModal() {
        const existing = document.getElementById('passwordChangeModal');
        if (existing) {
            const modal = new bootstrap.Modal(existing);
            modal.show();
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'passwordChangeModal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-key me-2"></i>Şifre Değiştir</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="passwordChangeForm">
                            <div class="mb-3">
                                <label for="currentPassword" class="form-label"><i class="fas fa-lock me-1"></i>Mevcut Şifre</label>
                                <div class="input-group">
                                    <input type="password" class="form-control" id="currentPassword" name="current_password" required>
                                    <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility('currentPassword', this)"><i class="fas fa-eye"></i></button>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="newPassword" class="form-label"><i class="fas fa-key me-1"></i>Yeni Şifre</label>
                                <div class="input-group">
                                    <input type="password" class="form-control" id="newPassword" name="new_password" required>
                                    <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility('newPassword', this)"><i class="fas fa-eye"></i></button>
                                </div>
                                <small class="text-muted d-block mt-1">Şifre en az 8 karakter olmalı ve büyük/küçük harf, rakam ve özel karakter içermelidir.</small>
                                <div id="passwordStrength" class="mt-2"></div>
                            </div>
                            <div class="mb-3">
                                <label for="confirmPassword" class="form-label"><i class="fas fa-check me-1"></i>Yeni Şifre Tekrar</label>
                                <div class="input-group">
                                    <input type="password" class="form-control" id="confirmPassword" name="confirm_password" required>
                                    <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility('confirmPassword', this)"><i class="fas fa-eye"></i></button>
                                </div>
                                <div id="passwordMatch" class="mt-1"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" id="changePasswordSubmitBtn" class="btn btn-primary" onclick="changePassword()"><i class="fas fa-save me-1"></i>Değiştir</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const newPasswordInput = modal.querySelector('#newPassword');
        const confirmPasswordInput = modal.querySelector('#confirmPassword');
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', () => validatePasswordStrength(newPasswordInput.value));
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        }
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
        const form = document.getElementById('passwordChangeForm');
        const submitBtn = document.getElementById('changePasswordSubmitBtn');
        if (!form || !submitBtn) return;

        const formData = new FormData(form);
        const currentPassword = formData.get('current_password');
        const newPassword = formData.get('new_password');
        const confirmPassword = formData.get('confirm_password');

        if (!currentPassword || !newPassword || !confirmPassword) {
            global.poiManager?.showToast('Lütfen tüm alanları doldurun', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            global.poiManager?.showToast('Yeni şifre ve tekrarı eşleşmiyor', 'error');
            return;
        }
        if (newPassword.length < 8) {
            global.poiManager?.showToast('Yeni şifre en az 8 karakter olmalıdır', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Değiştiriliyor...';

        try {
            const response = await fetch('/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': global.poiManager?.csrfToken || ''
                },
                credentials: 'include',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            if (response.ok) {
                global.poiManager?.showToast('Şifre başarıyla değiştirildi. Yeniden giriş yapılıyor...', 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('passwordChangeModal'));
                if (modal) {
                    modal.hide();
                }
                setTimeout(() => {
                    global.location.href = '/auth/login';
                }, 1200);
                return;
            }

            const data = await response.json().catch(() => ({}));
            global.poiManager?.showToast('Şifre değiştirilemedi: ' + (data.error || response.statusText), 'error');
        } catch (error) {
            global.poiManager?.showToast('İstek hatası: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Değiştir';
        }
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
