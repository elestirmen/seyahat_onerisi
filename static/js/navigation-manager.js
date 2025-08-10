/**
 * NavigationManager - Shared navigation component for admin panel
 * Handles active page detection, responsive navigation, breadcrumbs, and user session display
 */
class NavigationManager {
    constructor(options = {}) {
        this.options = {
            containerSelector: '.main-navigation',
            sessionSelector: '.session-info',
            breadcrumbSelector: '.breadcrumb-nav',
            mobileBreakpoint: 768,
            ...options
        };
        
        this.currentPage = this.detectCurrentPage();
        this.navigationItems = this.getNavigationItems();
        this.userSession = this.getUserSession();
        
        this.init();
    }

    /**
     * Initialize the navigation manager
     */
    init() {
        this.createNavigationStructure();
        this.updateActiveNavigation();
        this.setupEventListeners();
        this.updateSessionDisplay();
        this.updateBreadcrumbs();
        this.handleResponsiveNavigation();
    }

    /**
     * Detect current page from URL
     */
    detectCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        // Map filenames to page identifiers
        const pageMap = {
            'poi_manager_enhanced.html': 'poi-management',
            'route_manager_enhanced.html': 'route-management', 
            'file_import_manager.html': 'file-import',
            'index.html': 'dashboard',
            '': 'dashboard'
        };
        
        return pageMap[filename] || 'unknown';
    }

    /**
     * Get navigation items configuration
     */
    getNavigationItems() {
        return [
            {
                id: 'poi-management',
                title: 'POI Yönetimi',
                url: 'poi_manager_enhanced.html',
                icon: 'fas fa-map-marker-alt',
                description: 'İlgi noktalarını yönet'
            },
            {
                id: 'route-management', 
                title: 'Rota Yönetimi',
                url: 'route_manager_enhanced.html',
                icon: 'fas fa-route',
                description: 'Rotaları yönet ve düzenle'
            },
            {
                id: 'file-import',
                title: 'Dosya Import',
                url: 'file_import_manager.html', 
                icon: 'fas fa-file-import',
                description: 'Rota dosyalarını içe aktar'
            }
        ];
    }

    /**
     * Get user session information
     */
    getUserSession() {
        // In a real application, this would come from authentication system
        return {
            username: 'Admin',
            role: 'Administrator',
            loginTime: new Date().toLocaleString('tr-TR'),
            status: 'online'
        };
    }

    /**
     * Create navigation structure
     */
    createNavigationStructure() {
        const container = document.querySelector(this.options.containerSelector);
        if (!container) return;

        // Clear existing navigation
        container.innerHTML = '';

        // Create navigation items
        this.navigationItems.forEach(item => {
            const navLink = this.createNavigationLink(item);
            container.appendChild(navLink);
        });

        // Add mobile menu toggle if needed
        this.addMobileMenuToggle();
    }

    /**
     * Create individual navigation link
     */
    createNavigationLink(item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.className = 'nav-link';
        link.dataset.page = item.id;
        link.title = item.description;
        
        // Add icon if specified
        if (item.icon) {
            const icon = document.createElement('i');
            icon.className = item.icon;
            link.appendChild(icon);
            link.appendChild(document.createTextNode(' '));
        }
        
        link.appendChild(document.createTextNode(item.title));
        
        return link;
    }

    /**
     * Update active navigation state
     */
    updateActiveNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === this.currentPage) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nav-link') || e.target.closest('.nav-link')) {
                this.handleNavigationClick(e);
            }
        });

        // Handle window resize for responsive navigation
        window.addEventListener('resize', () => {
            this.handleResponsiveNavigation();
        });

        // Handle mobile menu toggle
        document.addEventListener('click', (e) => {
            if (e.target.matches('.mobile-menu-toggle')) {
                this.toggleMobileMenu();
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.main-navigation') && !e.target.matches('.mobile-menu-toggle')) {
                this.closeMobileMenu();
            }
        });
    }

    /**
     * Handle navigation link clicks
     */
    handleNavigationClick(e) {
        const link = e.target.closest('.nav-link');
        if (!link) return;

        // Add loading state
        this.showNavigationLoading(link);
        
        // Close mobile menu if open
        this.closeMobileMenu();
    }

    /**
     * Show loading state on navigation
     */
    showNavigationLoading(link) {
        link.classList.add('loading');
        
        // Remove loading state after a short delay (page will likely load before this)
        setTimeout(() => {
            link.classList.remove('loading');
        }, 1000);
    }

    /**
     * Update session display
     */
    updateSessionDisplay() {
        const sessionContainer = document.querySelector(this.options.sessionSelector);
        if (!sessionContainer) return;

        sessionContainer.innerHTML = this.createSessionHTML();
    }

    /**
     * Create session display HTML
     */
    createSessionHTML() {
        const statusClass = this.userSession.status === 'online' ? 'bg-success' : 'bg-warning';
        
        return `
            <div class="session-user">
                <i class="fas fa-user-circle"></i>
                <span class="session-username">${this.userSession.username}</span>
                <span class="badge ${statusClass}">${this.userSession.status}</span>
            </div>
            <div class="session-meta">
                <small class="text-muted">
                    <i class="fas fa-clock"></i>
                    ${this.userSession.loginTime}
                </small>
            </div>
        `;
    }

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumbs() {
        const breadcrumbContainer = document.querySelector(this.options.breadcrumbSelector);
        if (!breadcrumbContainer) return;

        const breadcrumbs = this.generateBreadcrumbs();
        breadcrumbContainer.innerHTML = this.createBreadcrumbHTML(breadcrumbs);
    }

    /**
     * Generate breadcrumb items
     */
    generateBreadcrumbs() {
        const currentItem = this.navigationItems.find(item => item.id === this.currentPage);
        
        const breadcrumbs = [
            { title: 'Ana Sayfa', url: 'index.html', icon: 'fas fa-home' }
        ];

        if (currentItem && currentItem.id !== 'dashboard') {
            breadcrumbs.push({
                title: currentItem.title,
                url: currentItem.url,
                icon: currentItem.icon,
                active: true
            });
        }

        return breadcrumbs;
    }

    /**
     * Create breadcrumb HTML
     */
    createBreadcrumbHTML(breadcrumbs) {
        const items = breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const classes = isLast ? 'breadcrumb-item active' : 'breadcrumb-item';
            
            if (isLast) {
                return `
                    <li class="${classes}">
                        <i class="${item.icon}"></i>
                        ${item.title}
                    </li>
                `;
            } else {
                return `
                    <li class="${classes}">
                        <a href="${item.url}">
                            <i class="${item.icon}"></i>
                            ${item.title}
                        </a>
                    </li>
                `;
            }
        }).join('');

        return `<ol class="breadcrumb">${items}</ol>`;
    }

    /**
     * Handle responsive navigation
     */
    handleResponsiveNavigation() {
        const isMobile = window.innerWidth <= this.options.mobileBreakpoint;
        const navigation = document.querySelector(this.options.containerSelector);
        
        if (!navigation) return;

        if (isMobile) {
            navigation.classList.add('mobile-nav');
            this.ensureMobileMenuToggle();
        } else {
            navigation.classList.remove('mobile-nav', 'mobile-nav-open');
            this.removeMobileMenuToggle();
        }
    }

    /**
     * Add mobile menu toggle button
     */
    addMobileMenuToggle() {
        if (window.innerWidth <= this.options.mobileBreakpoint) {
            this.ensureMobileMenuToggle();
        }
    }

    /**
     * Ensure mobile menu toggle exists
     */
    ensureMobileMenuToggle() {
        if (document.querySelector('.mobile-menu-toggle')) return;

        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle';
        toggle.innerHTML = '<i class="fas fa-bars"></i>';
        toggle.setAttribute('aria-label', 'Menüyü aç/kapat');
        
        const header = document.querySelector('.poi-header, .route-header, .import-header');
        if (header) {
            header.appendChild(toggle);
        }
    }

    /**
     * Remove mobile menu toggle
     */
    removeMobileMenuToggle() {
        const toggle = document.querySelector('.mobile-menu-toggle');
        if (toggle) {
            toggle.remove();
        }
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        const navigation = document.querySelector(this.options.containerSelector);
        if (navigation) {
            navigation.classList.toggle('mobile-nav-open');
        }
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        const navigation = document.querySelector(this.options.containerSelector);
        if (navigation) {
            navigation.classList.remove('mobile-nav-open');
        }
    }

    /**
     * Refresh navigation (useful for dynamic updates)
     */
    refresh() {
        this.currentPage = this.detectCurrentPage();
        this.updateActiveNavigation();
        this.updateBreadcrumbs();
        this.updateSessionDisplay();
    }

    /**
     * Update user session information
     */
    updateUserSession(sessionData) {
        this.userSession = { ...this.userSession, ...sessionData };
        this.updateSessionDisplay();
    }

    /**
     * Add custom navigation item
     */
    addNavigationItem(item) {
        this.navigationItems.push(item);
        this.createNavigationStructure();
        this.updateActiveNavigation();
    }

    /**
     * Remove navigation item
     */
    removeNavigationItem(itemId) {
        this.navigationItems = this.navigationItems.filter(item => item.id !== itemId);
        this.createNavigationStructure();
        this.updateActiveNavigation();
    }

    /**
     * Get current page information
     */
    getCurrentPageInfo() {
        return this.navigationItems.find(item => item.id === this.currentPage);
    }

    /**
     * Navigate to specific page
     */
    navigateTo(pageId) {
        const item = this.navigationItems.find(item => item.id === pageId);
        if (item) {
            window.location.href = item.url;
        }
    }
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.navigationManager === 'undefined') {
            window.navigationManager = new NavigationManager();
        }
    });
} else {
    if (typeof window.navigationManager === 'undefined') {
        window.navigationManager = new NavigationManager();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
}