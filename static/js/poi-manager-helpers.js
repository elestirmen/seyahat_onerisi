(function (global) {
    'use strict';

    const POIManagerHelperMethods = {
        getRatingCategories() {
            return {
                tarihi: { icon: 'fas fa-landmark', label: 'Tarihi', displayName: '🏛️ Tarihi', color: '#8B4513' },
                sanat_kultur: { icon: 'fas fa-palette', label: 'Sanat & Kültür', displayName: '🎨 Sanat ve Kültür', color: '#9B59B6' },
                doga: { icon: 'fas fa-leaf', label: 'Doğa', displayName: '🌿 Doğa', color: '#27AE60' },
                eglence: { icon: 'fas fa-music', label: 'Eğlence', displayName: '🎪 Eğlence', color: '#E74C3C' },
                alisveris: { icon: 'fas fa-shopping-cart', label: 'Alışveriş', displayName: '🛍️ Alışveriş', color: '#F39C12' },
                spor: { icon: 'fas fa-dumbbell', label: 'Spor', displayName: '⚽ Spor', color: '#34495E' },
                macera: { icon: 'fas fa-mountain', label: 'Macera', displayName: '🏔️ Macera', color: '#D35400' },
                rahatlatici: { icon: 'fas fa-spa', label: 'Rahatlatıcı', displayName: '😌 Rahatlatıcı', color: '#16A085' },
                yemek: { icon: 'fas fa-utensils', label: 'Yemek', displayName: '🍽️ Yemek', color: '#E67E22' },
                gece_hayati: { icon: 'fas fa-moon', label: 'Gece Hayatı', displayName: '🌙 Gece Hayatı', color: '#8E44AD' }
            };
        },

        getRatingKeys() {
            return Object.keys(this.getRatingCategories());
        },

        normalizeRatingsPayload(payload) {
            const normalizedRatings = Object.fromEntries(
                this.getRatingKeys().map(key => [key, 0])
            );

            const source = payload && typeof payload === 'object' && !Array.isArray(payload)
                ? ((payload.ratings && typeof payload.ratings === 'object' && !Array.isArray(payload.ratings))
                    ? payload.ratings
                    : payload)
                : null;

            if (!source) {
                return normalizedRatings;
            }

            this.getRatingKeys().forEach(key => {
                const numericValue = Number.parseInt(source[key], 10);
                normalizedRatings[key] = Number.isFinite(numericValue)
                    ? Math.max(0, Math.min(100, numericValue))
                    : 0;
            });

            return normalizedRatings;
        },

        calculateAverageRating(ratings) {
            let totalRating = 0;
            let ratingCount = 0;

            Object.values(this.normalizeRatingsPayload(ratings)).forEach(rating => {
                if (rating > 0) {
                    totalRating += rating;
                    ratingCount++;
                }
            });

            return ratingCount > 0 ? Math.round(totalRating / ratingCount) : 0;
        },

        getFallbackCategories() {
            if (typeof global.getFallbackCategories === 'function') {
                return global.getFallbackCategories();
            }

            return [
                { name: 'gastronomik', display_name: '🍽️ Gastronomik', color: '#e74c3c', icon: 'utensils' },
                { name: 'kulturel', display_name: '🏛️ Kültürel', color: '#3498db', icon: 'landmark' },
                { name: 'sanatsal', display_name: '🎨 Sanatsal', color: '#2ecc71', icon: 'palette' },
                { name: 'doga_macera', display_name: '🌿 Doğa & Macera', color: '#f39c12', icon: 'hiking' },
                { name: 'konaklama', display_name: '🏨 Konaklama', color: '#9b59b6', icon: 'bed' },
                { name: 'alisveris', display_name: '🛍️ Alışveriş', color: '#f39c12', icon: 'shopping-cart' },
                { name: 'eglence', display_name: '🎪 Eğlence', color: '#e74c3c', icon: 'music' },
                { name: 'spor', display_name: '⚽ Spor', color: '#34495e', icon: 'dumbbell' }
            ];
        },

        extractCategoryCollection(data) {
            if (Array.isArray(data)) {
                return data;
            }

            if (data && Array.isArray(data.categories)) {
                return data.categories;
            }

            if (data && typeof data === 'object') {
                console.warn('Unexpected categories response format:', data);
            }

            return [];
        },

        extractPOICollection(data) {
            if (Array.isArray(data)) {
                return data;
            }

            if (!data || typeof data !== 'object') {
                return [];
            }

            if (Array.isArray(data.pois)) {
                return data.pois;
            }

            if (Array.isArray(data.results)) {
                return data.results;
            }

            return Object.values(data).flatMap(value => Array.isArray(value) ? value : []);
        },

        extractRouteCollection(data) {
            if (Array.isArray(data)) {
                return data;
            }

            if (!data || typeof data !== 'object') {
                return [];
            }

            if (Array.isArray(data.routes)) {
                return data.routes;
            }

            if (Array.isArray(data.results)) {
                return data.results;
            }

            return [];
        },

        populateCategorySelect(selectElement, selectedValue = '') {
            if (!selectElement) {
                return false;
            }

            selectElement.innerHTML = '<option value="">Seçiniz</option>';
            if (!Array.isArray(this.categories) || this.categories.length === 0) {
                return false;
            }

            this.categories.forEach(category => {
                const option = document.createElement('option');
                const value = category.id || category.name;
                option.value = value;
                option.textContent = category.display_name || category.name;
                option.selected = value === selectedValue;
                selectElement.appendChild(option);
            });

            return true;
        },

        getCategoryByName(categoryName) {
            if (typeof global.getCategoryByName === 'function') {
                return global.getCategoryByName(categoryName);
            }

            return this.categories.find(cat =>
                cat.name === categoryName ||
                (cat.aliases && cat.aliases.includes(categoryName))
            );
        },

        async checkAuthStatus() {
            try {
                const response = await fetch('/auth/status');

                if (response.ok) {
                    const data = await response.json();

                    if (data.authenticated) {
                        this.csrfToken = data.csrf_token;
                        this.updateSessionStatus(data.session_info);
                        return true;
                    }
                }

                const currentPath = window.location.pathname + window.location.search;
                const loginUrl = `/auth/login?next=${encodeURIComponent(currentPath)}`;
                const lastRedirectAt = Number(sessionStorage.getItem('authRedirectAt') || 0);
                const now = Date.now();
                if (now - lastRedirectAt > 10000) {
                    sessionStorage.setItem('authRedirectAt', String(now));
                    window.location.href = loginUrl;
                } else {
                    console.warn('⏳ Suppressing repeated login redirect to avoid loop.');
                    this.showError('Oturum doğrulaması başarısız. Lütfen tekrar giriş yapın.');
                }
                return false;
            } catch (error) {
                console.error('🔐 Auth status check failed:', error);
                const currentPath = window.location.pathname + window.location.search;
                const loginUrl = `/auth/login?next=${encodeURIComponent(currentPath)}`;
                const lastRedirectAt = Number(sessionStorage.getItem('authRedirectAt') || 0);
                const now = Date.now();
                if (now - lastRedirectAt > 10000) {
                    sessionStorage.setItem('authRedirectAt', String(now));
                    window.location.href = loginUrl;
                } else {
                    this.showError('Oturum kontrolü başarısız. Lütfen daha sonra tekrar deneyin.');
                }
                return false;
            }
        },

        updateSessionStatus(sessionInfo) {
            let statusElement = document.getElementById('sessionStatus');
            if (!statusElement) {
                try {
                    const container = document.querySelector('.session-info') || document.querySelector('.header-actions');
                    if (container) {
                        const wrapper = document.createElement('span');
                        wrapper.id = 'sessionStatus';
                        wrapper.className = 'badge bg-secondary';
                        wrapper.textContent = 'Bilinmiyor';
                        container.appendChild(wrapper);
                        statusElement = wrapper;
                    }
                } catch (error) {
                    console.warn('Session status container not found, skipping status update');
                }
            }

            if (!statusElement) {
                return;
            }

            if (sessionInfo) {
                statusElement.textContent = 'Aktif';
                statusElement.className = 'badge bg-success';

                if (sessionInfo.expires_at) {
                    const expiresAt = new Date(sessionInfo.expires_at);
                    const now = new Date();
                    const timeLeft = expiresAt - now;

                    if (timeLeft <= 0) {
                        statusElement.textContent = 'Süresi Doldu';
                        statusElement.className = 'badge bg-danger';
                        setTimeout(() => {
                            const currentPath = window.location.pathname + window.location.search;
                            const loginUrl = `/auth/login?next=${encodeURIComponent(currentPath)}`;
                            const lastRedirectAt = Number(sessionStorage.getItem('authRedirectAt') || 0);
                            const redirectNow = Date.now();
                            if (redirectNow - lastRedirectAt > 10000) {
                                sessionStorage.setItem('authRedirectAt', String(redirectNow));
                                window.location.href = loginUrl;
                            }
                        }, 1000);
                    } else if (timeLeft < 5 * 60 * 1000) {
                        statusElement.textContent = 'Yakında Dolacak';
                        statusElement.className = 'badge bg-warning';
                    }
                }
            } else {
                statusElement.textContent = 'Bilinmiyor';
                statusElement.className = 'badge bg-secondary';
            }
        },

        async logout() {
            try {
                const response = await fetch('/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    }
                });

                if (response.ok) {
                    this.showToast('Başarıyla çıkış yapıldı', 'success');
                    setTimeout(() => {
                        window.location.href = '/auth/login';
                    }, 1000);
                } else {
                    throw new Error('Logout failed');
                }
            } catch (error) {
                console.error('🔐 Logout failed:', error);
                this.showToast('Çıkış yapılırken hata oluştu', 'error');
                setTimeout(() => {
                    window.location.href = '/auth/login';
                }, 2000);
            }
        },

        async refreshCSRFToken() {
            try {
                const response = await fetch('/auth/csrf-token');
                if (response.ok) {
                    const data = await response.json();
                    this.csrfToken = data.csrf_token;
                    return this.csrfToken;
                }
            } catch (error) {
                console.error('CSRF token refresh failed:', error);
            }
            return null;
        },

        async authenticatedFetch(url, options = {}) {
            if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
                if (!this.csrfToken) {
                    await this.refreshCSRFToken();
                }

                options.headers = {
                    ...options.headers,
                    'X-CSRFToken': this.csrfToken
                };
            }

            options.credentials = 'include';

            const response = await fetch(url, options);

            if (response.status === 401) {
                this.showToast('Oturum süresi doldu, yeniden giriş yapılıyor...', 'warning');
                setTimeout(() => {
                    const currentPath = window.location.pathname + window.location.search;
                    const loginUrl = `/auth/login?next=${encodeURIComponent(currentPath)}`;
                    const lastRedirectAt = Number(sessionStorage.getItem('authRedirectAt') || 0);
                    const now = Date.now();
                    if (now - lastRedirectAt > 10000) {
                        sessionStorage.setItem('authRedirectAt', String(now));
                        window.location.href = loginUrl;
                    }
                }, 2000);
                throw new Error('Authentication required');
            }

            return response;
        }
    };

    global.POIManagerHelperMethods = POIManagerHelperMethods;
})(window);
