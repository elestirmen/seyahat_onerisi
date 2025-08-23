/*
 * Tab Controller for POI Recommendation System
 * Manages tab switching, component lifecycle, and state isolation
 */

class TabController {
    constructor() {
        this.activeTab = null;
        this.tabComponents = new Map();
        this.tabInstances = new Map();
        this.isInitialized = false;
        this.pendingRegistrations = [];
        
        // Cleanup tracking
        this.activeRequests = new Set();
        this.activeTimeouts = new Set();
        this.activeIntervals = new Set();
        
        this.initialize();
    }

    /**
     * Initialize the tab controller
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupTabButtons();
        
        // Process any pending tab registrations
        this.processPendingRegistrations();
        
        this.setupBeforeUnloadCleanup();
        
        this.isInitialized = true;
        console.log('🎛️ Tab Controller initialized');
    }

    /**
     * Process any tab registrations that were queued before initialization
     */
    processPendingRegistrations() {
        this.pendingRegistrations.forEach(({ tabName, componentClass, options }) => {
            this.registerTab(tabName, componentClass, options);
        });
        this.pendingRegistrations = [];
    }

    /**
     * Register a tab component
     */
    registerTab(tabName, componentClass, options = {}) {
        this.tabComponents.set(tabName, {
            componentClass,
            options,
            loaded: false,
            stylesheets: options.stylesheets || [],
            scripts: options.scripts || []
        });
        
        console.log(`📝 Registered tab: ${tabName}`);
    }

    /**
     * Setup tab button event listeners
     */
    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Load initial tab (dynamic-routes by default)
     */
    async loadInitialTab() {
        const activeButton = document.querySelector('.route-tab.active[data-tab]');
        const initialTab = activeButton ? activeButton.getAttribute('data-tab') : 'dynamic-routes';
        
        // Check if tab is registered before trying to switch
        if (this.tabComponents.has(initialTab)) {
            await this.switchTab(initialTab);
            console.log(`✅ Initial tab '${initialTab}' loaded successfully`);
        } else {
            console.warn(`⚠️ Initial tab '${initialTab}' not registered yet`);
            // Don't try again automatically - let the caller handle it
        }
    }

    /**
     * Switch to a different tab
     */
    async switchTab(tabName) {
        if (this.activeTab === tabName) return;

        console.log(`🔄 Switching from ${this.activeTab || 'none'} to ${tabName}`);

        try {
            // Cleanup current tab
            if (this.activeTab) {
                await this.cleanupTab(this.activeTab);
            }

            // Load and initialize new tab
            await this.loadTab(tabName);
            
            // Update UI
            this.updateTabButtons(tabName);
            this.updateTabContent(tabName);
            
            this.activeTab = tabName;
            
            console.log(`✅ Successfully switched to tab: ${tabName}`);
            
        } catch (error) {
            console.error(`❌ Error switching to tab ${tabName}:`, error);
            window.uiComponents?.showToast('Tab yüklenirken bir hata oluştu', 'error');
        }
    }

    /**
     * Load tab component and its dependencies
     */
    async loadTab(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        
        if (!tabConfig) {
            throw new Error(`Tab '${tabName}' is not registered`);
        }

        // Load stylesheets if not already loaded
        if (!tabConfig.loaded) {
            await this.loadTabStylesheets(tabConfig.stylesheets);
            await this.loadTabScripts(tabConfig.scripts);
            tabConfig.loaded = true;
        }

        // Initialize component instance
        if (!this.tabInstances.has(tabName)) {
            const ComponentClass = tabConfig.componentClass;
            const instance = new ComponentClass(tabConfig.options);
            this.tabInstances.set(tabName, instance);
        }

        // Initialize/activate the tab component
        const instance = this.tabInstances.get(tabName);
        if (instance && typeof instance.activate === 'function') {
            await instance.activate();
        }
    }

    /**
     * Load CSS stylesheets for a tab
     */
    async loadTabStylesheets(stylesheets) {
        const loadPromises = stylesheets.map(href => {
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (document.querySelector(`link[href="${href}"]`)) {
                    resolve();
                    return;
                }

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.onload = resolve;
                link.onerror = reject;
                document.head.appendChild(link);
            });
        });

        await Promise.all(loadPromises);
    }

    /**
     * Load JavaScript modules for a tab
     */
    async loadTabScripts(scripts) {
        const loadPromises = scripts.map(async (src) => {
            // Use dynamic import for ES modules
            if (src.endsWith('.js')) {
                try {
                    await import(src);
                } catch (error) {
                    console.warn(`Failed to load module: ${src}`, error);
                }
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Cleanup a tab when switching away
     */
    async cleanupTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.deactivate === 'function') {
            await instance.deactivate();
        }

        // Cancel any pending requests
        this.cancelActiveRequests();
        
        // Clear timeouts and intervals
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        console.log(`🧹 Cleaned up tab: ${tabName}`);
    }

    /**
     * Update tab button states
     */
    updateTabButtons(activeTabName) {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            const tabName = button.getAttribute('data-tab');
            button.classList.toggle('active', tabName === activeTabName);
        });
    }

    /**
     * Update tab content visibility
     */
    updateTabContent(activeTabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabContents.forEach(content => {
            const isActive = content.id === `${activeTabName}Content`;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    /**
     * Track and manage active requests
     */
    trackRequest(requestPromise) {
        this.activeRequests.add(requestPromise);
        
        requestPromise.finally(() => {
            this.activeRequests.delete(requestPromise);
        });
        
        return requestPromise;
    }

    /**
     * Track timeouts for cleanup
     */
    trackTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Track intervals for cleanup
     */
    trackInterval(intervalId) {
        this.activeIntervals.add(intervalId);
        return intervalId;
    }

    /**
     * Cancel all active requests
     */
    cancelActiveRequests() {
        this.activeRequests.forEach(request => {
            if (request && typeof request.abort === 'function') {
                request.abort();
            }
        });
        this.activeRequests.clear();
    }

    /**
     * Clear all active timeouts
     */
    clearActiveTimeouts() {
        this.activeTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.activeTimeouts.clear();
    }

    /**
     * Clear all active intervals
     */
    clearActiveIntervals() {
        this.activeIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.activeIntervals.clear();
    }

    /**
     * Get current active tab
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Get tab component instance
     */
    getTabInstance(tabName) {
        return this.tabInstances.get(tabName);
    }

    /**
     * Check if tab is loaded
     */
    isTabLoaded(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        return tabConfig ? tabConfig.loaded : false;
    }

    /**
     * Destroy tab instance
     */
    destroyTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
        }
        
        this.tabInstances.delete(tabName);
        
        // Mark as not loaded to force reload next time
        const tabConfig = this.tabComponents.get(tabName);
        if (tabConfig) {
            tabConfig.loaded = false;
        }
        
        console.log(`🗑️ Destroyed tab: ${tabName}`);
    }

    /**
     * Reload a tab component
     */
    async reloadTab(tabName) {
        this.destroyTab(tabName);
        
        if (this.activeTab === tabName) {
            await this.loadTab(tabName);
        }
    }

    /**
     * Setup cleanup on page unload
     */
    setupBeforeUnloadCleanup() {
        window.addEventListener('beforeunload', () => {
            this.cleanupAll();
        });
    }

    /**
     * Clean up all resources
     */
    cleanupAll() {
        console.log('🧹 Cleaning up all tab resources...');
        
        this.cancelActiveRequests();
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        // Cleanup all tab instances
        this.tabInstances.forEach((instance, tabName) => {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
        
        this.tabInstances.clear();
        this.activeTab = null;
    }

    /**
     * Get memory usage information
     */
    getMemoryInfo() {
        return {
            activeTab: this.activeTab,
            loadedTabs: Array.from(this.tabComponents.keys()).filter(tab => 
                this.tabComponents.get(tab).loaded
            ),
            activeInstances: this.tabInstances.size,
            activeRequests: this.activeRequests.size,
            activeTimeouts: this.activeTimeouts.size,
            activeIntervals: this.activeIntervals.size
        };
    }
}

// Export for module usage
export default TabController;
export { TabController };/*
 * Tab Controller for POI Recommendation System
 * Manages tab switching, component lifecycle, and state isolation
 */

class TabController {
    constructor() {
        this.activeTab = null;
        this.tabComponents = new Map();
        this.tabInstances = new Map();
        this.isInitialized = false;
        this.pendingRegistrations = [];
        
        // Cleanup tracking
        this.activeRequests = new Set();
        this.activeTimeouts = new Set();
        this.activeIntervals = new Set();
        
        this.initialize();
    }

    /**
     * Initialize the tab controller
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupTabButtons();
        
        // Process any pending tab registrations
        this.processPendingRegistrations();
        
        this.setupBeforeUnloadCleanup();
        
        this.isInitialized = true;
        console.log('🎛️ Tab Controller initialized');
    }

    /**
     * Process any tab registrations that were queued before initialization
     */
    processPendingRegistrations() {
        this.pendingRegistrations.forEach(({ tabName, componentClass, options }) => {
            this.registerTab(tabName, componentClass, options);
        });
        this.pendingRegistrations = [];
    }

    /**
     * Register a tab component
     */
    registerTab(tabName, componentClass, options = {}) {
        // If not initialized yet, queue the registration
        if (!this.isInitialized) {
            this.pendingRegistrations.push({ tabName, componentClass, options });
            console.log(`📋 Queued tab registration: ${tabName}`);
            return;
        }
        
        this.tabComponents.set(tabName, {
            componentClass,
            options,
            loaded: false,
            stylesheets: options.stylesheets || [],
            scripts: options.scripts || []
        });
        
        console.log(`📝 Registered tab: ${tabName}`);
    }

    /**
     * Setup tab button event listeners
     */
    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Load initial tab (dynamic-routes by default)
     */
    async loadInitialTab() {
        const activeButton = document.querySelector('.route-tab.active[data-tab]');
        const initialTab = activeButton ? activeButton.getAttribute('data-tab') : 'dynamic-routes';
        
        // Check if tab is registered before trying to switch
        if (this.tabComponents.has(initialTab)) {
            await this.switchTab(initialTab);
            console.log(`✅ Initial tab '${initialTab}' loaded successfully`);
        } else {
            console.warn(`⚠️ Initial tab '${initialTab}' not registered yet`);
            // Don't try again automatically - let the caller handle it
        }
    }

    /**
     * Switch to a different tab
     */
    async switchTab(tabName) {
        if (this.activeTab === tabName) return;

        console.log(`🔄 Switching from ${this.activeTab || 'none'} to ${tabName}`);

        try {
            // Cleanup current tab
            if (this.activeTab) {
                await this.cleanupTab(this.activeTab);
            }

            // Load and initialize new tab
            await this.loadTab(tabName);
            
            // Update UI
            this.updateTabButtons(tabName);
            this.updateTabContent(tabName);
            
            this.activeTab = tabName;
            
            console.log(`✅ Successfully switched to tab: ${tabName}`);
            
        } catch (error) {
            console.error(`❌ Error switching to tab ${tabName}:`, error);
            window.uiComponents?.showToast('Tab yüklenirken bir hata oluştu', 'error');
        }
    }

    /**
     * Load tab component and its dependencies
     */
    async loadTab(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        
        if (!tabConfig) {
            throw new Error(`Tab '${tabName}' is not registered`);
        }

        // Load stylesheets if not already loaded
        if (!tabConfig.loaded) {
            await this.loadTabStylesheets(tabConfig.stylesheets);
            await this.loadTabScripts(tabConfig.scripts);
            tabConfig.loaded = true;
        }

        // Initialize component instance
        if (!this.tabInstances.has(tabName)) {
            const ComponentClass = tabConfig.componentClass;
            const instance = new ComponentClass(tabConfig.options);
            this.tabInstances.set(tabName, instance);
        }

        // Initialize/activate the tab component
        const instance = this.tabInstances.get(tabName);
        if (instance && typeof instance.activate === 'function') {
            await instance.activate();
        }
    }

    /**
     * Load CSS stylesheets for a tab
     */
    async loadTabStylesheets(stylesheets) {
        const loadPromises = stylesheets.map(href => {
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (document.querySelector(`link[href="${href}"]`)) {
                    resolve();
                    return;
                }

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.onload = resolve;
                link.onerror = reject;
                document.head.appendChild(link);
            });
        });

        await Promise.all(loadPromises);
    }

    /**
     * Load JavaScript modules for a tab
     */
    async loadTabScripts(scripts) {
        const loadPromises = scripts.map(async (src) => {
            // Use dynamic import for ES modules
            if (src.endsWith('.js')) {
                try {
                    await import(src);
                } catch (error) {
                    console.warn(`Failed to load module: ${src}`, error);
                }
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Cleanup a tab when switching away
     */
    async cleanupTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.deactivate === 'function') {
            await instance.deactivate();
        }

        // Cancel any pending requests
        this.cancelActiveRequests();
        
        // Clear timeouts and intervals
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        console.log(`🧹 Cleaned up tab: ${tabName}`);
    }

    /**
     * Update tab button states
     */
    updateTabButtons(activeTabName) {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            const tabName = button.getAttribute('data-tab');
            button.classList.toggle('active', tabName === activeTabName);
        });
    }

    /**
     * Update tab content visibility
     */
    updateTabContent(activeTabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabContents.forEach(content => {
            const isActive = content.id === `${activeTabName}Content`;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    /**
     * Track and manage active requests
     */
    trackRequest(requestPromise) {
        this.activeRequests.add(requestPromise);
        
        requestPromise.finally(() => {
            this.activeRequests.delete(requestPromise);
        });
        
        return requestPromise;
    }

    /**
     * Track timeouts for cleanup
     */
    trackTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Track intervals for cleanup
     */
    trackInterval(intervalId) {
        this.activeIntervals.add(intervalId);
        return intervalId;
    }

    /**
     * Cancel all active requests
     */
    cancelActiveRequests() {
        this.activeRequests.forEach(request => {
            if (request && typeof request.abort === 'function') {
                request.abort();
            }
        });
        this.activeRequests.clear();
    }

    /**
     * Clear all active timeouts
     */
    clearActiveTimeouts() {
        this.activeTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.activeTimeouts.clear();
    }

    /**
     * Clear all active intervals
     */
    clearActiveIntervals() {
        this.activeIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.activeIntervals.clear();
    }

    /**
     * Get current active tab
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Get tab component instance
     */
    getTabInstance(tabName) {
        return this.tabInstances.get(tabName);
    }

    /**
     * Check if tab is loaded
     */
    isTabLoaded(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        return tabConfig ? tabConfig.loaded : false;
    }

    /**
     * Destroy tab instance
     */
    destroyTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
        }
        
        this.tabInstances.delete(tabName);
        
        // Mark as not loaded to force reload next time
        const tabConfig = this.tabComponents.get(tabName);
        if (tabConfig) {
            tabConfig.loaded = false;
        }
        
        console.log(`🗑️ Destroyed tab: ${tabName}`);
    }

    /**
     * Reload a tab component
     */
    async reloadTab(tabName) {
        this.destroyTab(tabName);
        
        if (this.activeTab === tabName) {
            await this.loadTab(tabName);
        }
    }

    /**
     * Setup cleanup on page unload
     */
    setupBeforeUnloadCleanup() {
        window.addEventListener('beforeunload', () => {
            this.cleanupAll();
        });
    }

    /**
     * Clean up all resources
     */
    cleanupAll() {
        console.log('🧹 Cleaning up all tab resources...');
        
        this.cancelActiveRequests();
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        // Cleanup all tab instances
        this.tabInstances.forEach((instance, tabName) => {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
        
        this.tabInstances.clear();
        this.activeTab = null;
    }

    /**
     * Get memory usage information
     */
    getMemoryInfo() {
        return {
            activeTab: this.activeTab,
            loadedTabs: Array.from(this.tabComponents.keys()).filter(tab => 
                this.tabComponents.get(tab).loaded
            ),
            activeInstances: this.tabInstances.size,
            activeRequests: this.activeRequests.size,
            activeTimeouts: this.activeTimeouts.size,
            activeIntervals: this.activeIntervals.size
        };
    }
}

// Export for module usage
export default TabController;
export { TabController };// Create global instance
window.tabController = new TabController();

// Export for module usage
export default TabController;
export { TabController };// Create global instance
window.tabController = new TabController();

// Export for module usage
export default TabController;
export { TabController };/**
 * Tab Controller for POI Recommendation System
 * Manages tab switching, component lifecycle, and state isolation
 */

class TabController {
    constructor() {
        this.activeTab = null;
        this.tabComponents = new Map();
        this.tabInstances = new Map();
        this.isInitialized = false;
        this.pendingRegistrations = [];
        
        // Cleanup tracking
        this.activeRequests = new Set();
        this.activeTimeouts = new Set();
        this.activeIntervals = new Set();
        
        this.initialize();
    }

    /**
     * Initialize the tab controller
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupTabButtons();
        
        // Process any pending tab registrations
        this.processPendingRegistrations();
        
        this.setupBeforeUnloadCleanup();
        
        this.isInitialized = true;
        console.log('🎛️ Tab Controller initialized');
    }

    /**
     * Process any tab registrations that were queued before initialization
     */
    processPendingRegistrations() {
        this.pendingRegistrations.forEach(({ tabName, componentClass, options }) => {
            this.registerTab(tabName, componentClass, options);
        });
        this.pendingRegistrations = [];
    }

    /**
     * Register a tab component
     */
    registerTab(tabName, componentClass, options = {}) {
        // If not initialized yet, queue the registration
        if (!this.isInitialized) {
            this.pendingRegistrations.push({ tabName, componentClass, options });
            console.log(`📋 Queued tab registration: ${tabName}`);
            return;
        }
        
        this.tabComponents.set(tabName, {
            componentClass,
            options,
            loaded: false,
            stylesheets: options.stylesheets || [],
            scripts: options.scripts || []
        });
        
        console.log(`📝 Registered tab: ${tabName}`);
    }

    /**
     * Setup tab button event listeners
     */
    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Load initial tab (dynamic-routes by default)
     */
    async loadInitialTab() {
        const activeButton = document.querySelector('.route-tab.active[data-tab]');
        const initialTab = activeButton ? activeButton.getAttribute('data-tab') : 'dynamic-routes';
        
        // Check if tab is registered before trying to switch
        if (this.tabComponents.has(initialTab)) {
            await this.switchTab(initialTab);
            console.log(`✅ Initial tab '${initialTab}' loaded successfully`);
        } else {
            console.warn(`⚠️ Initial tab '${initialTab}' not registered yet`);
            // Don't try again automatically - let the caller handle it
        }
    }

    /**
     * Switch to a different tab
     */
    async switchTab(tabName) {
        if (this.activeTab === tabName) return;

        console.log(`🔄 Switching from ${this.activeTab || 'none'} to ${tabName}`);

        try {
            // Cleanup current tab
            if (this.activeTab) {
                await this.cleanupTab(this.activeTab);
            }

            // Load and initialize new tab
            await this.loadTab(tabName);
            
            // Update UI
            this.updateTabButtons(tabName);
            this.updateTabContent(tabName);
            
            this.activeTab = tabName;
            
            console.log(`✅ Successfully switched to tab: ${tabName}`);
            
        } catch (error) {
            console.error(`❌ Error switching to tab ${tabName}:`, error);
            window.uiComponents?.showToast('Tab yüklenirken bir hata oluştu', 'error');
        }
    }

    /**
     * Load tab component and its dependencies
     */
    async loadTab(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        
        if (!tabConfig) {
            throw new Error(`Tab '${tabName}' is not registered`);
        }

        // Load stylesheets if not already loaded
        if (!tabConfig.loaded) {
            await this.loadTabStylesheets(tabConfig.stylesheets);
            await this.loadTabScripts(tabConfig.scripts);
            tabConfig.loaded = true;
        }

        // Initialize component instance
        if (!this.tabInstances.has(tabName)) {
            const ComponentClass = tabConfig.componentClass;
            const instance = new ComponentClass(tabConfig.options);
            this.tabInstances.set(tabName, instance);
        }

        // Initialize/activate the tab component
        const instance = this.tabInstances.get(tabName);
        if (instance && typeof instance.activate === 'function') {
            await instance.activate();
        }
    }

    /**
     * Load CSS stylesheets for a tab
     */
    async loadTabStylesheets(stylesheets) {
        const loadPromises = stylesheets.map(href => {
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (document.querySelector(`link[href="${href}"]`)) {
                    resolve();
                    return;
                }

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.onload = resolve;
                link.onerror = reject;
                document.head.appendChild(link);
            });
        });

        await Promise.all(loadPromises);
    }

    /**
     * Load JavaScript modules for a tab
     */
    async loadTabScripts(scripts) {
        const loadPromises = scripts.map(async (src) => {
            // Use dynamic import for ES modules
            if (src.endsWith('.js')) {
                try {
                    await import(src);
                } catch (error) {
                    console.warn(`Failed to load module: ${src}`, error);
                }
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Cleanup a tab when switching away
     */
    async cleanupTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.deactivate === 'function') {
            await instance.deactivate();
        }

        // Cancel any pending requests
        this.cancelActiveRequests();
        
        // Clear timeouts and intervals
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        console.log(`🧹 Cleaned up tab: ${tabName}`);
    }

    /**
     * Update tab button states
     */
    updateTabButtons(activeTabName) {
        const tabButtons = document.querySelectorAll('.route-tab[data-tab]');
        
        tabButtons.forEach(button => {
            const tabName = button.getAttribute('data-tab');
            button.classList.toggle('active', tabName === activeTabName);
        });
    }

    /**
     * Update tab content visibility
     */
    updateTabContent(activeTabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabContents.forEach(content => {
            const isActive = content.id === `${activeTabName}Content`;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    /**
     * Track and manage active requests
     */
    trackRequest(requestPromise) {
        this.activeRequests.add(requestPromise);
        
        requestPromise.finally(() => {
            this.activeRequests.delete(requestPromise);
        });
        
        return requestPromise;
    }

    /**
     * Track timeouts for cleanup
     */
    trackTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Track intervals for cleanup
     */
    trackInterval(intervalId) {
        this.activeIntervals.add(intervalId);
        return intervalId;
    }

    /**
     * Cancel all active requests
     */
    cancelActiveRequests() {
        this.activeRequests.forEach(request => {
            if (request && typeof request.abort === 'function') {
                request.abort();
            }
        });
        this.activeRequests.clear();
    }

    /**
     * Clear all active timeouts
     */
    clearActiveTimeouts() {
        this.activeTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.activeTimeouts.clear();
    }

    /**
     * Clear all active intervals
     */
    clearActiveIntervals() {
        this.activeIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.activeIntervals.clear();
    }

    /**
     * Get current active tab
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Get tab component instance
     */
    getTabInstance(tabName) {
        return this.tabInstances.get(tabName);
    }

    /**
     * Check if tab is loaded
     */
    isTabLoaded(tabName) {
        const tabConfig = this.tabComponents.get(tabName);
        return tabConfig ? tabConfig.loaded : false;
    }

    /**
     * Destroy tab instance
     */
    destroyTab(tabName) {
        const instance = this.tabInstances.get(tabName);
        
        if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
        }
        
        this.tabInstances.delete(tabName);
        
        // Mark as not loaded to force reload next time
        const tabConfig = this.tabComponents.get(tabName);
        if (tabConfig) {
            tabConfig.loaded = false;
        }
        
        console.log(`🗑️ Destroyed tab: ${tabName}`);
    }

    /**
     * Reload a tab component
     */
    async reloadTab(tabName) {
        this.destroyTab(tabName);
        
        if (this.activeTab === tabName) {
            await this.loadTab(tabName);
        }
    }

    /**
     * Setup cleanup on page unload
     */
    setupBeforeUnloadCleanup() {
        window.addEventListener('beforeunload', () => {
            this.cleanupAll();
        });
    }

    /**
     * Clean up all resources
     */
    cleanupAll() {
        console.log('🧹 Cleaning up all tab resources...');
        
        this.cancelActiveRequests();
        this.clearActiveTimeouts();
        this.clearActiveIntervals();
        
        // Cleanup all tab instances
        this.tabInstances.forEach((instance, tabName) => {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
        
        this.tabInstances.clear();
        this.activeTab = null;
    }

    /**
     * Get memory usage information
     */
    getMemoryInfo() {
        return {
            activeTab: this.activeTab,
            loadedTabs: Array.from(this.tabComponents.keys()).filter(tab => 
                this.tabComponents.get(tab).loaded
            ),
            activeInstances: this.tabInstances.size,
            activeRequests: this.activeRequests.size,
            activeTimeouts: this.activeTimeouts.size,
            activeIntervals: this.activeIntervals.size
        };
    }
}

// Export for module usage
export default TabController;
export { TabController };// Create global instance
window.tabController = new TabController();

// Export for module usage
export default TabController;
export { TabController };// Create global instance
window.tabController = new TabController();

// Export for module usage
export default TabController;
export { TabController };