/**
 * Toast notification system (standalone global).
 *
 * Exposes:
 *   window.showToast(message, type='info', options={duration, title, persistent})
 *   window.ToastNotificationSystem (class)
 *
 * Safe to load on pages that also include api-client.js: the IIFE guard
 * skips re-initialization when an instance is already on window.
 */
(function () {
    if (window.showToast && typeof window.showToast === 'function') {
        return;
    }

    class ToastNotificationSystem {
        constructor() {
            this.container = null;
            this.toasts = new Map();
            this.maxToasts = 5;
            this.defaultDuration = 5000;
            this.init();
        }

        init() {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
            if (!document.getElementById('toast-styles')) {
                this.addToastStyles();
            }
        }

        addToastStyles() {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; pointer-events: none; }
                .toast { background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 10px; padding: 16px; min-width: 300px; max-width: 400px; pointer-events: auto; transform: translateX(100%); transition: all .3s ease; border-left: 4px solid #007bff; display: flex; align-items: flex-start; gap: 12px; position: relative; }
                .toast.show { transform: translateX(0); }
                .toast.success { border-left-color: #28a745; }
                .toast.error   { border-left-color: #dc3545; }
                .toast.warning { border-left-color: #ffc107; }
                .toast.info    { border-left-color: #17a2b8; }
                .toast-icon { font-size: 18px; margin-top: 2px; flex-shrink: 0; }
                .toast.success .toast-icon { color: #28a745; }
                .toast.error   .toast-icon { color: #dc3545; }
                .toast.warning .toast-icon { color: #ffc107; }
                .toast.info    .toast-icon { color: #17a2b8; }
                .toast-content { flex: 1; }
                .toast-title { font-weight: 600; margin-bottom: 4px; color: #333; }
                .toast-message { color: #666; font-size: 14px; line-height: 1.4; white-space: pre-line; }
                .toast-close { background: none; border: none; color: #999; cursor: pointer; font-size: 16px; padding: 0; margin-left: 8px; flex-shrink: 0; }
                .toast-close:hover { color: #666; }
                .toast-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(0,0,0,0.1); border-radius: 0 0 8px 8px; overflow: hidden; }
                .toast-progress-bar { height: 100%; background: currentColor; transition: width linear; opacity: .7; width: 100%; }
                @media (max-width: 480px) {
                    .toast-container { left: 10px; right: 10px; top: 10px; }
                    .toast { min-width: auto; max-width: none; }
                }
            `;
            document.head.appendChild(style);
        }

        show(message, type = 'info', options = {}) {
            const toastId = this.generateToastId();
            const duration = options.duration ?? this.defaultDuration;
            const title = options.title ?? this.getDefaultTitle(type);
            const persistent = options.persistent || false;

            if (this.toasts.size >= this.maxToasts) {
                this.hide(this.toasts.keys().next().value);
            }

            const toast = this.createToastElement(toastId, message, type, title, persistent);
            this.container.appendChild(toast);
            this.toasts.set(toastId, { element: toast, type, message, title, persistent, duration });

            requestAnimationFrame(() => toast.classList.add('show'));

            if (!persistent && duration > 0) {
                const progressBar = toast.querySelector('.toast-progress-bar');
                if (progressBar) {
                    requestAnimationFrame(() => {
                        progressBar.style.transitionDuration = `${duration}ms`;
                        progressBar.style.width = '0%';
                    });
                }
                setTimeout(() => this.hide(toastId), duration);
            }
            return toastId;
        }

        createToastElement(toastId, message, type, title, persistent) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.dataset.toastId = toastId;

            const iconEl = document.createElement('div');
            iconEl.className = 'toast-icon';
            iconEl.innerHTML = this.getTypeIcon(type);

            const contentEl = document.createElement('div');
            contentEl.className = 'toast-content';
            if (title) {
                const titleEl = document.createElement('div');
                titleEl.className = 'toast-title';
                titleEl.textContent = title;
                contentEl.appendChild(titleEl);
            }
            const msgEl = document.createElement('div');
            msgEl.className = 'toast-message';
            msgEl.textContent = message;
            contentEl.appendChild(msgEl);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.setAttribute('aria-label', 'Kapat');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.addEventListener('click', () => this.hide(toastId));

            toast.append(iconEl, contentEl, closeBtn);

            if (!persistent) {
                const progress = document.createElement('div');
                progress.className = 'toast-progress';
                const bar = document.createElement('div');
                bar.className = 'toast-progress-bar';
                progress.appendChild(bar);
                toast.appendChild(progress);
            }
            return toast;
        }

        hide(toastId) {
            const data = this.toasts.get(toastId);
            if (!data) return;
            data.element.classList.remove('show');
            setTimeout(() => {
                data.element.parentNode?.removeChild(data.element);
                this.toasts.delete(toastId);
            }, 300);
        }

        getTypeIcon(type) {
            const icons = {
                success: '<i class="fas fa-check-circle"></i>',
                error: '<i class="fas fa-exclamation-circle"></i>',
                warning: '<i class="fas fa-exclamation-triangle"></i>',
                info: '<i class="fas fa-info-circle"></i>'
            };
            return icons[type] || icons.info;
        }

        getDefaultTitle(type) {
            return { success: 'Başarılı', error: 'Hata', warning: 'Uyarı', info: 'Bilgi' }[type] || 'Bilgi';
        }

        generateToastId() {
            return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    const toastSystem = new ToastNotificationSystem();

    window.ToastNotificationSystem = ToastNotificationSystem;
    window.appToastSystem = toastSystem;
    window.showToast = (message, type = 'info', options = {}) => toastSystem.show(message, type, options);

    if (!window.showNotification) {
        window.showNotification = window.showToast;
    }
})();
