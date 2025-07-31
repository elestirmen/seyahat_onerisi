/**
 * Accessibility Enhancement JavaScript
 * Handles keyboard navigation, ARIA updates, and screen reader support
 */

class AccessibilityManager {
    constructor() {
        this.isKeyboardUser = false;
        this.focusableElements = [];
        this.currentFocusIndex = -1;
        this.announcements = {
            polite: document.getElementById('polite-announcements'),
            assertive: document.getElementById('assertive-announcements'),
            loading: document.getElementById('loading-announcements'),
            error: document.getElementById('error-announcements'),
            success: document.getElementById('success-announcements')
        };
        
        this.init();
    }

    init() {
        this.setupKeyboardDetection();
        this.setupSliderAccessibility();
        this.setupFocusManagement();
        this.setupAriaLiveRegions();
        this.setupSkipLinks();
        this.setupReducedMotion();
        this.setupHighContrast();
    }

    /**
     * Detect keyboard usage and add appropriate classes
     */
    setupKeyboardDetection() {
        // Detect keyboard usage
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.isKeyboardUser = true;
                document.body.classList.add('keyboard-user');
            }
        });

        // Detect mouse usage
        document.addEventListener('mousedown', () => {
            this.isKeyboardUser = false;
            document.body.classList.remove('keyboard-user');
        });

        // Handle focus visibility
        document.addEventListener('focusin', (e) => {
            if (this.isKeyboardUser) {
                e.target.classList.add('keyboard-focused');
            }
        });

        document.addEventListener('focusout', (e) => {
            e.target.classList.remove('keyboard-focused');
        });
    }

    /**
     * Enhanced slider accessibility with keyboard navigation
     */
    setupSliderAccessibility() {
        const sliders = document.querySelectorAll('.slider');
        
        sliders.forEach(slider => {
            // Enhanced keyboard navigation
            slider.addEventListener('keydown', (e) => {
                const currentValue = parseInt(slider.value);
                const min = parseInt(slider.min);
                const max = parseInt(slider.max);
                const step = parseInt(slider.step) || 1;
                
                let newValue = currentValue;
                let handled = false;

                switch (e.key) {
                    case 'ArrowLeft':
                    case 'ArrowDown':
                        newValue = Math.max(min, currentValue - step);
                        handled = true;
                        break;
                    case 'ArrowRight':
                    case 'ArrowUp':
                        newValue = Math.min(max, currentValue + step);
                        handled = true;
                        break;
                    case 'Home':
                        newValue = min;
                        handled = true;
                        break;
                    case 'End':
                        newValue = max;
                        handled = true;
                        break;
                    case 'PageDown':
                        newValue = Math.max(min, currentValue - step * 2);
                        handled = true;
                        break;
                    case 'PageUp':
                        newValue = Math.min(max, currentValue + step * 2);
                        handled = true;
                        break;
                }

                if (handled) {
                    e.preventDefault();
                    slider.value = newValue;
                    
                    // Update ARIA attributes
                    this.updateSliderAria(slider, newValue);
                    
                    // Trigger change event
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Announce change to screen readers
                    this.announceSliderChange(slider, newValue);
                }
            });

            // Update ARIA on input
            slider.addEventListener('input', (e) => {
                this.updateSliderAria(slider, parseInt(e.target.value));
            });

            // Focus management
            slider.addEventListener('focus', () => {
                this.announceSliderFocus(slider);
            });
        });
    }

    /**
     * Update slider ARIA attributes
     */
    updateSliderAria(slider, value) {
        const valueTexts = [
            'İlgilenmiyorum',
            'Az ilgiliyim', 
            'Orta düzeyde ilgiliyim',
            'Çok ilgiliyim',
            'Kesinlikle istiyorum'
        ];
        
        const valueText = valueTexts[value] || 'Bilinmeyen';
        
        slider.setAttribute('aria-valuenow', value);
        slider.setAttribute('aria-valuetext', valueText);
        
        // Update the visual value display
        const valueDisplay = document.getElementById(slider.id + '-value');
        if (valueDisplay) {
            valueDisplay.textContent = valueText;
            valueDisplay.setAttribute('aria-live', 'polite');
        }
    }

    /**
     * Announce slider changes to screen readers
     */
    announceSliderChange(slider, value) {
        const label = slider.getAttribute('aria-label') || slider.id;
        const valueText = slider.getAttribute('aria-valuetext');
        const message = `${label}: ${valueText}`;
        
        this.announce(message, 'polite');
    }

    /**
     * Announce slider focus to screen readers
     */
    announceSliderFocus(slider) {
        const label = slider.getAttribute('aria-label') || slider.id;
        const valueText = slider.getAttribute('aria-valuetext');
        const message = `${label} ayarı. Mevcut değer: ${valueText}. Ok tuşları ile değiştirebilirsiniz.`;
        
        this.announce(message, 'polite');
    }

    /**
     * Setup focus management for complex interactions
     */
    setupFocusManagement() {
        // Focus trap for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey(e);
            }
            
            if (e.key === 'Tab') {
                this.handleTabKey(e);
            }
        });

        // Focus restoration
        this.setupFocusRestoration();
    }

    /**
     * Handle Escape key for closing modals and dropdowns
     */
    handleEscapeKey(e) {
        // Close media modal
        const mediaModal = document.getElementById('mediaModal');
        if (mediaModal && mediaModal.classList.contains('show')) {
            const closeBtn = document.getElementById('mediaModalClose');
            if (closeBtn) {
                closeBtn.click();
            }
            return;
        }

        // Close any other open overlays
        const overlays = document.querySelectorAll('.overlay.show, .modal.show, .dropdown.show');
        overlays.forEach(overlay => {
            overlay.classList.remove('show');
        });
    }

    /**
     * Handle Tab key for focus management
     */
    handleTabKey(e) {
        const activeModal = document.querySelector('.modal.show, .overlay.show');
        if (activeModal) {
            this.trapFocus(e, activeModal);
        }
    }

    /**
     * Trap focus within a container
     */
    trapFocus(e, container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Setup focus restoration for dynamic content
     */
    setupFocusRestoration() {
        let lastFocusedElement = null;

        // Store focus before opening modals
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-modal-trigger]')) {
                lastFocusedElement = e.target;
            }
        });

        // Restore focus when modals close
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('modal') && !target.classList.contains('show')) {
                        if (lastFocusedElement) {
                            lastFocusedElement.focus();
                            lastFocusedElement = null;
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class']
        });
    }

    /**
     * Setup ARIA live regions for dynamic announcements
     */
    setupAriaLiveRegions() {
        // Monitor loading states
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    this.handleContentChanges(mutation);
                }
            });
        });

        // Observe results section for dynamic content
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            observer.observe(resultsSection, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    /**
     * Handle content changes and announce them appropriately
     */
    handleContentChanges(mutation) {
        const target = mutation.target;
        
        // Announce loading states
        if (target.classList && target.classList.contains('loading')) {
            this.announce('İçerik yükleniyor...', 'polite');
        }
        
        // Announce new POI cards
        if (target.classList && target.classList.contains('poi-card')) {
            const poiName = target.querySelector('.poi-card__title')?.textContent;
            if (poiName) {
                this.announce(`Yeni öneri eklendi: ${poiName}`, 'polite');
            }
        }
        
        // Announce errors
        if (target.classList && target.classList.contains('error')) {
            const errorMessage = target.textContent;
            this.announce(`Hata: ${errorMessage}`, 'assertive');
        }
    }

    /**
     * Setup skip links functionality
     */
    setupSkipLinks() {
        const skipLinks = document.querySelectorAll('.skip-links a');
        
        skipLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                
                if (target) {
                    target.focus();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Make target focusable if it isn't already
                    if (!target.hasAttribute('tabindex')) {
                        target.setAttribute('tabindex', '-1');
                        target.addEventListener('blur', () => {
                            target.removeAttribute('tabindex');
                        }, { once: true });
                    }
                    
                    this.announce(`Geçiş yapıldı: ${target.textContent || target.getAttribute('aria-label')}`, 'polite');
                }
            });
        });
    }

    /**
     * Setup reduced motion preferences
     */
    setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleReducedMotion = (mediaQuery) => {
            if (mediaQuery.matches) {
                document.body.classList.add('reduced-motion');
                this.announce('Azaltılmış hareket modu etkin', 'polite');
            } else {
                document.body.classList.remove('reduced-motion');
            }
        };

        prefersReducedMotion.addListener(handleReducedMotion);
        handleReducedMotion(prefersReducedMotion);
    }

    /**
     * Setup high contrast mode support
     */
    setupHighContrast() {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        
        const handleHighContrast = (mediaQuery) => {
            if (mediaQuery.matches) {
                document.body.classList.add('high-contrast');
                this.announce('Yüksek kontrast modu etkin', 'polite');
            } else {
                document.body.classList.remove('high-contrast');
            }
        };

        prefersHighContrast.addListener(handleHighContrast);
        handleHighContrast(prefersHighContrast);
    }

    /**
     * Announce messages to screen readers
     */
    announce(message, priority = 'polite') {
        const region = this.announcements[priority];
        if (region) {
            region.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    /**
     * Announce loading states
     */
    announceLoading(message) {
        this.announce(message, 'loading');
    }

    /**
     * Announce errors
     */
    announceError(message) {
        this.announce(message, 'error');
    }

    /**
     * Announce success messages
     */
    announceSuccess(message) {
        this.announce(message, 'success');
    }

    /**
     * Update page title for screen readers
     */
    updatePageTitle(newTitle) {
        document.title = newTitle;
        this.announce(`Sayfa başlığı güncellendi: ${newTitle}`, 'polite');
    }

    /**
     * Setup POI card accessibility
     */
    setupPOICardAccessibility() {
        const poiCards = document.querySelectorAll('.poi-card');
        
        poiCards.forEach((card, index) => {
            // Make cards keyboard accessible
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            
            // Add role and labels
            card.setAttribute('role', 'article');
            
            const title = card.querySelector('.poi-card__title')?.textContent;
            const score = card.querySelector('.poi-card__score')?.textContent;
            const description = card.querySelector('.poi-card__description')?.textContent;
            
            if (title) {
                const ariaLabel = `${title}${score ? `, puan: ${score}` : ''}${description ? `, açıklama: ${description.substring(0, 100)}` : ''}`;
                card.setAttribute('aria-label', ariaLabel);
            }
            
            // Handle keyboard interaction
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
            
            // Announce when focused
            card.addEventListener('focus', () => {
                const cardNumber = index + 1;
                const totalCards = poiCards.length;
                this.announce(`POI kartı ${cardNumber} / ${totalCards}`, 'polite');
            });
        });
    }

    /**
     * Setup button accessibility enhancements
     */
    setupButtonAccessibility() {
        const buttons = document.querySelectorAll('button');
        
        buttons.forEach(button => {
            // Ensure buttons have proper labels
            if (!button.hasAttribute('aria-label') && !button.textContent.trim()) {
                const icon = button.querySelector('i');
                if (icon) {
                    const iconClass = icon.className;
                    let label = 'Buton';
                    
                    // Map common icon classes to labels
                    if (iconClass.includes('fa-close') || iconClass.includes('fa-times')) {
                        label = 'Kapat';
                    } else if (iconClass.includes('fa-play')) {
                        label = 'Oynat';
                    } else if (iconClass.includes('fa-pause')) {
                        label = 'Duraklat';
                    } else if (iconClass.includes('fa-download')) {
                        label = 'İndir';
                    }
                    
                    button.setAttribute('aria-label', label);
                }
            }
            
            // Handle loading states
            const originalText = button.textContent;
            button.addEventListener('click', () => {
                if (button.classList.contains('btn--loading')) {
                    button.setAttribute('aria-busy', 'true');
                    this.announce('İşlem başlatıldı', 'polite');
                }
            });
            
            // Monitor for loading state changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (!button.classList.contains('btn--loading')) {
                            button.removeAttribute('aria-busy');
                        }
                    }
                });
            });
            
            observer.observe(button, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /**
     * Initialize all accessibility features
     */
    initializeAll() {
        this.setupPOICardAccessibility();
        this.setupButtonAccessibility();
        
        // Re-initialize when new content is added
        const observer = new MutationObserver(() => {
            this.setupPOICardAccessibility();
            this.setupButtonAccessibility();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize accessibility manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.accessibilityManager = new AccessibilityManager();
    window.accessibilityManager.initializeAll();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}