/**
 * Mobile Optimizations for POI Recommendation System
 * Handles mobile-specific interactions, gestures, and UI enhancements
 */

class MobileOptimizations {
    constructor() {
        this.isTouch = 'ontouchstart' in window;
        this.isMobile = window.innerWidth <= 768;
        this.mapFullscreen = false;
        this.currentView = 'map'; // 'map' or 'list'
        this.filterPanelExpanded = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFullscreenMap();
        this.setupFilterPanel();
        this.setupFAB();
        this.setupTouchGestures();
        this.setupQuickActions();
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    }

    onDOMReady() {
        this.optimizeForMobile();
        this.setupResponsiveBreakpoints();
        this.setupLazyLoading();
        this.setupProgressiveEnhancement();
    }

    setupLazyLoading() {
        // Intersection Observer for lazy loading images
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src || img.getAttribute('data-placeholder');
                        
                        if (src && src !== img.src) {
                            img.src = src;
                            img.classList.add('loaded');
                            observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Observe all images with data-src or in route cards
            const observeImages = () => {
                const images = document.querySelectorAll('.route-card img, [data-src]');
                images.forEach(img => imageObserver.observe(img));
            };

            // Initial observation
            observeImages();

            // Re-observe when new content is added
            const routesList = document.getElementById('predefinedRoutesList');
            if (routesList) {
                const listObserver = new MutationObserver(observeImages);
                listObserver.observe(routesList, { childList: true, subtree: true });
            }
        }
    }

    setupProgressiveEnhancement() {
        // WebP support detection
        this.detectWebPSupport();
        
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Setup intersection observer for route cards
        this.setupRouteCardObserver();
        
        // Optimize images for mobile
        this.optimizeImagesForMobile();
    }

    detectWebPSupport() {
        const webpCanvas = document.createElement('canvas');
        webpCanvas.width = 1;
        webpCanvas.height = 1;
        
        const supportsWebP = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        
        if (supportsWebP) {
            document.documentElement.classList.add('webp-support');
        } else {
            document.documentElement.classList.add('no-webp');
        }
    }

    preloadCriticalResources() {
        if (this.isMobile) {
            // Preload mobile-specific CSS
            const mobileCSS = document.createElement('link');
            mobileCSS.rel = 'preload';
            mobileCSS.as = 'style';
            mobileCSS.href = 'static/css/mobile-enhancements.css';
            document.head.appendChild(mobileCSS);
        }
    }

    setupRouteCardObserver() {
        if ('IntersectionObserver' in window) {
            const cardObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        
                        // Add entrance animation
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(20px)';
                        
                        // Trigger animation
                        requestAnimationFrame(() => {
                            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        });
                        
                        cardObserver.unobserve(card);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '20px'
            });

            // Observe route cards when they're added
            const observeRouteCards = () => {
                const cards = document.querySelectorAll('.route-card:not(.observed)');
                cards.forEach(card => {
                    card.classList.add('observed');
                    cardObserver.observe(card);
                });
            };

            // Initial observation
            setTimeout(observeRouteCards, 100);

            // Re-observe when new cards are added
            const routesList = document.getElementById('predefinedRoutesList');
            if (routesList) {
                const listObserver = new MutationObserver(observeRouteCards);
                listObserver.observe(routesList, { childList: true });
            }
        }
    }

    optimizeImagesForMobile() {
        if (this.isMobile) {
            // Replace high-resolution images with mobile-optimized versions
            const images = document.querySelectorAll('.route-card img');
            images.forEach(img => {
                const originalSrc = img.src;
                if (originalSrc.includes('400x200')) {
                    // Replace with smaller mobile version
                    img.src = originalSrc.replace('400x200', '100x120');
                }
            });
        }
    }
    }

    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.handleResize();
        });

        // Orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
    }

    setupFullscreenMap() {
        const fullscreenBtn = document.getElementById('fullscreenMapBtn');
        const mapContainer = document.querySelector('.predefined-map-container');
        
        if (fullscreenBtn && mapContainer) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreenMap(mapContainer);
            });

            // ESC key to exit fullscreen
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.mapFullscreen) {
                    this.exitFullscreenMap(mapContainer);
                }
            });
        }
    }

    toggleFullscreenMap(mapContainer) {
        if (this.mapFullscreen) {
            this.exitFullscreenMap(mapContainer);
        } else {
            this.enterFullscreenMap(mapContainer);
        }
    }

    enterFullscreenMap(mapContainer) {
        mapContainer.classList.add('fullscreen');
        mapContainer.querySelector('.predefined-routes-map').classList.add('fullscreen');
        this.mapFullscreen = true;
        
        // Hide other elements
        document.body.style.overflow = 'hidden';
        
        // Update button icon
        const icon = document.querySelector('#fullscreenMapBtn i');
        if (icon) {
            icon.className = 'fas fa-compress';
        }
    }

    exitFullscreenMap(mapContainer) {
        mapContainer.classList.remove('fullscreen');
        mapContainer.querySelector('.predefined-routes-map').classList.remove('fullscreen');
        this.mapFullscreen = false;
        
        // Restore scrolling
        document.body.style.overflow = '';
        
        // Update button icon
        const icon = document.querySelector('#fullscreenMapBtn i');
        if (icon) {
            icon.className = 'fas fa-expand';
        }
    }

    setupFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        const filterHandle = filterPanel?.querySelector('.mobile-filter-handle');
        const closeBtn = document.getElementById('mobileFilterClose');
        const openBtn = document.getElementById('openFiltersBtn');
        
        if (!filterPanel) return;

        // Handle tap
        filterHandle?.addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Close button
        closeBtn?.addEventListener('click', () => {
            this.closeFilterPanel();
        });

        // Open button
        openBtn?.addEventListener('click', () => {
            this.openFilterPanel();
        });

        // Touch gestures for filter panel
        this.setupFilterPanelGestures(filterPanel);
    }

    setupFilterPanelGestures(filterPanel) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const handle = filterPanel.querySelector('.mobile-filter-handle');
        
        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            filterPanel.style.transition = 'none';
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (this.filterPanelExpanded && deltaY > 0) {
                const translateY = Math.min(deltaY, window.innerHeight * 0.7);
                filterPanel.style.transform = `translateY(${translateY}px)`;
            } else if (!this.filterPanelExpanded && deltaY < 0) {
                const translateY = Math.max(deltaY, -window.innerHeight * 0.7);
                filterPanel.style.transform = `translateY(calc(100% - 60px + ${translateY}px))`;
            }
        }, { passive: true });

        handle.addEventListener('touchend', () => {
            if (!isDragging) return;
            
            const deltaY = currentY - startY;
            const threshold = 50;
            
            filterPanel.style.transition = '';
            
            if (Math.abs(deltaY) > threshold) {
                if (deltaY > 0 && this.filterPanelExpanded) {
                    this.closeFilterPanel();
                } else if (deltaY < 0 && !this.filterPanelExpanded) {
                    this.openFilterPanel();
                }
            } else {
                // Snap back to current state
                if (this.filterPanelExpanded) {
                    filterPanel.style.transform = 'translateY(0)';
                } else {
                    filterPanel.style.transform = 'translateY(calc(100% - 60px))';
                }
            }
            
            isDragging = false;
        }, { passive: true });
    }

    toggleFilterPanel() {
        if (this.filterPanelExpanded) {
            this.closeFilterPanel();
        } else {
            this.openFilterPanel();
        }
    }

    openFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        if (filterPanel) {
            filterPanel.classList.add('expanded');
            this.filterPanelExpanded = true;
        }
    }

    closeFilterPanel() {
        const filterPanel = document.getElementById('mobileFilterPanel');
        if (filterPanel) {
            filterPanel.classList.remove('expanded');
            this.filterPanelExpanded = false;
        }
    }

    setupFAB() {
        const fab = document.getElementById('mapListToggleBtn');
        
        if (fab) {
            fab.addEventListener('click', () => {
                this.toggleMapListView();
            });
        }
    }

    toggleMapListView() {
        const mapView = document.getElementById('mapView');
        const listView = document.getElementById('listView');
        const fab = document.getElementById('mapListToggleBtn');
        
        if (this.currentView === 'map') {
            // Switch to list view
            if (mapView) mapView.style.display = 'none';
            if (listView) listView.style.display = 'block';
            this.currentView = 'list';
            
            // Update FAB icon
            const icon = fab?.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-map';
            }
        } else {
            // Switch to map view
            if (mapView) mapView.style.display = 'block';
            if (listView) listView.style.display = 'none';
            this.currentView = 'map';
            
            // Update FAB icon
            const icon = fab?.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-list';
            }
        }
    }

    setupTouchGestures() {
        const routesList = document.getElementById('predefinedRoutesList');
        
        if (routesList && this.isTouch) {
            this.setupSwipeGestures(routesList);
        }
    }

    setupSwipeGestures(container) {
        let startX = 0;
        let startY = 0;
        let startTime = 0;

        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (!e.changedTouches.length) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const deltaTime = endTime - startTime;
            
            // Check for swipe gesture
            if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
                if (deltaX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            }
        }, { passive: true });
    }

    handleSwipeRight() {
        // Navigate to previous route or action
        console.log('Swipe right detected');
    }

    handleSwipeLeft() {
        // Navigate to next route or action
        console.log('Swipe left detected');
    }

    setupQuickActions() {
        // Setup route quick action buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.route-quick-action')) {
                const action = e.target.closest('.route-quick-action');
                const routeCard = action.closest('.route-card');
                
                if (action.classList.contains('favorite')) {
                    this.handleFavoriteAction(routeCard);
                } else if (action.classList.contains('navigate')) {
                    this.handleNavigateAction(routeCard);
                } else if (action.classList.contains('share')) {
                    this.handleShareAction(routeCard);
                }
            }
        });
    }

    handleFavoriteAction(routeCard) {
        const favoriteBtn = routeCard.querySelector('.route-quick-action.favorite');
        const icon = favoriteBtn.querySelector('i');
        
        // Toggle favorite state
        if (icon.classList.contains('fas')) {
            icon.className = 'far fa-heart';
            favoriteBtn.style.color = '#666';
        } else {
            icon.className = 'fas fa-heart';
            favoriteBtn.style.color = '#f59e0b';
        }
        
        // Add animation
        favoriteBtn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            favoriteBtn.style.transform = '';
        }, 200);
    }

    handleNavigateAction(routeCard) {
        const routeTitle = routeCard.querySelector('.route-card-title')?.textContent;
        
        // Open in navigation app
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const mapsUrl = `https://www.google.com/maps/dir/${latitude},${longitude}/@${latitude},${longitude},15z`;
                window.open(mapsUrl, '_blank');
            });
        }
    }

    handleShareAction(routeCard) {
        const routeTitle = routeCard.querySelector('.route-card-title')?.textContent;
        
        if (navigator.share) {
            navigator.share({
                title: `${routeTitle} - Kapadokya Rotası`,
                text: `Bu harika rotayı inceleyin: ${routeTitle}`,
                url: window.location.href
            });
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('Link kopyalandı');
            });
        }
    }

    optimizeForMobile() {
        if (!this.isMobile) return;

        // Add mobile class to body
        document.body.classList.add('mobile-optimized');
        
        // Optimize touch targets
        this.optimizeTouchTargets();
        
        // Setup viewport meta tag optimization
        this.optimizeViewport();
    }

    optimizeTouchTargets() {
        const buttons = document.querySelectorAll('button, .clickable, .route-card');
        buttons.forEach(btn => {
            if (btn.offsetHeight < 44) {
                btn.style.minHeight = '44px';
            }
        });
    }

    optimizeViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }

    setupResponsiveBreakpoints() {
        const breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024
        };

        // Set CSS custom properties for breakpoints
        document.documentElement.style.setProperty('--mobile-breakpoint', `${breakpoints.mobile}px`);
        document.documentElement.style.setProperty('--tablet-breakpoint', `${breakpoints.tablet}px`);
        document.documentElement.style.setProperty('--desktop-breakpoint', `${breakpoints.desktop}px`);
    }

    handleResize() {
        // Recalculate layout on resize
        this.optimizeForMobile();
        
        // Close filter panel on desktop
        if (!this.isMobile && this.filterPanelExpanded) {
            this.closeFilterPanel();
        }
    }

    handleOrientationChange() {
        // Handle orientation change
        if (this.mapFullscreen) {
            // Refresh map after orientation change
            const mapContainer = document.querySelector('.predefined-routes-map');
            if (mapContainer && window.predefinedRoutesMap) {
                setTimeout(() => {
                    window.predefinedRoutesMap.invalidateSize();
                }, 200);
            }
        }
    }

    showToast(message, duration = 3000) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'mobile-toast';
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInUp 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutDown 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, duration);
    }
}

// CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
    }
`;
document.head.appendChild(style);

// Initialize mobile optimizations
window.mobileOptimizations = new MobileOptimizations();