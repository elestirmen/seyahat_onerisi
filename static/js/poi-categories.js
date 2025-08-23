/**
 * Centralized POI Category Configuration
 * This file contains all POI category definitions used across the application
 * Both poi_manager_enhanced.html and poi_recommendation_system.html use this as the single source of truth
 */

// Main category definitions - single source of truth
const POI_CATEGORIES = [
    // Core categories from poi_manager_enhanced.html
    { 
        "name": "gastronomik", 
        "display_name": "🍽️ Gastronomik", 
        "color": "#e74c3c", 
        "icon": "utensils",
        "aliases": ["gastronomi", "yemek", "yemek_icecek"]
    },
    { 
        "name": "kulturel", 
        "display_name": "🏛️ Kültürel", 
        "color": "#3498db", 
        "icon": "landmark",
        "aliases": ["kulturel_miras", "tarihi"]
    },
    { 
        "name": "sanatsal", 
        "display_name": "🎨 Sanatsal", 
        "color": "#2ecc71", 
        "icon": "palette",
        "aliases": ["sanat_kultur"]
    },
    { 
        "name": "doga_macera", 
        "display_name": "🌿 Doğa & Macera", 
        "color": "#f39c12", 
        "icon": "hiking",
        "aliases": ["macera_spor", "doga", "macera", "dogal_miras", "dogal_guzellilk", "seyir_noktalari"]
    },
    { 
        "name": "konaklama", 
        "display_name": "🏨 Konaklama", 
        "color": "#9b59b6", 
        "icon": "bed",
        "aliases": ["konaklama_hizmet"]
    },
    { 
        "name": "alisveris", 
        "display_name": "🛍️ Alışveriş", 
        "color": "#f39c12", 
        "icon": "shopping-cart",
        "aliases": ["alisveris_el_sanatlari"]
    },
    { 
        "name": "eglence", 
        "display_name": "🎪 Eğlence", 
        "color": "#e74c3c", 
        "icon": "music",
        "aliases": ["eglence_aktivite", "gece_hayati"]
    },
    { 
        "name": "spor", 
        "display_name": "⚽ Spor", 
        "color": "#34495e", 
        "icon": "dumbbell"
    },
    // Additional categories for comprehensive coverage
    { 
        "name": "yasayan_kultur", 
        "display_name": "🕌 Yaşayan Kültür", 
        "color": "#8B4513", 
        "icon": "mosque",
        "aliases": ["dini"]
    },
    { 
        "name": "ulasilabilirlik", 
        "display_name": "🚗 Ulaşılabilirlik", 
        "color": "#34495e", 
        "icon": "road"
    }
];

// Rating categories for user preferences (used in poi_recommendation_system)
const RATING_CATEGORIES = {
    'doga': { name: 'Doğa', icon: 'fas fa-tree' },
    'yemek': { name: 'Yemek', icon: 'fas fa-utensils' },
    'tarihi': { name: 'Tarih', icon: 'fas fa-landmark' },
    'eglence': { name: 'Eğlence', icon: 'fas fa-gamepad' },
    'sanat_kultur': { name: 'Sanat & Kültür', icon: 'fas fa-palette' },
    'macera': { name: 'Macera', icon: 'fas fa-mountain' },
    'rahatlatici': { name: 'Rahatlatıcı', icon: 'fas fa-spa' },
    'spor': { name: 'Spor', icon: 'fas fa-running' },
    'alisveris': { name: 'Alışveriş', icon: 'fas fa-shopping-bag' },
    'gece_hayati': { name: 'Gece Hayatı', icon: 'fas fa-moon' }
};

/**
 * Get category by name or alias
 * @param {string} categoryName - The category name or alias to look up
 * @returns {object|null} Category object or null if not found
 */
function getCategoryByName(categoryName) {
    if (!categoryName) return null;
    
    const normalized = categoryName.toLowerCase().trim();
    
    // First try exact name match
    let category = POI_CATEGORIES.find(cat => cat.name === normalized);
    
    // If not found, try alias match
    if (!category) {
        category = POI_CATEGORIES.find(cat => 
            cat.aliases && cat.aliases.includes(normalized)
        );
    }
    
    return category;
}

/**
 * Get category style (color and icon) for POI markers
 * @param {string} categoryName - The category name or alias
 * @returns {object} Style object with color, iconClass, and category name
 */
function getCentralizedCategoryStyle(categoryName) {
    const category = getCategoryByName(categoryName);
    
    if (!category) {
        // Fallback for unknown categories
        return {
            color: '#708090',
            iconClass: 'fas fa-map-marker-alt',
            category: 'unknown',
            displayName: 'Diğer'
        };
    }
    
    return {
        color: category.color,
        iconClass: `fas fa-${category.icon}`,
        category: category.name,
        displayName: category.display_name
    };
}

/**
 * Get display name for category
 * @param {string} categoryName - The category name or alias
 * @returns {string} Display name
 */
function getCentralizedCategoryDisplayName(categoryName) {
    const category = getCategoryByName(categoryName);
    return category ? category.display_name : 'Diğer';
}

/**
 * Get all categories for filter/selection UI
 * @returns {Array} Array of all categories
 */
function getAllCategories() {
    return [...POI_CATEGORIES];
}

/**
 * Get categories formatted for poi_manager_enhanced.html compatibility
 * @returns {Array} Array of categories in the expected format
 */
function getFallbackCategories() {
    return POI_CATEGORIES.map(cat => ({
        name: cat.name,
        display_name: cat.display_name,
        color: cat.color,
        icon: cat.icon
    }));
}

/**
 * Create icon map for poi_recommendation_system compatibility
 * @returns {object} Icon map object
 */
function createIconMap() {
    const iconMap = {};
    
    // Add main categories
    POI_CATEGORIES.forEach(category => {
        iconMap[category.name] = `fas fa-${category.icon}`;
        
        // Add aliases
        if (category.aliases) {
            category.aliases.forEach(alias => {
                iconMap[alias] = `fas fa-${category.icon}`;
            });
        }
    });
    
    // Add rating category mappings
    Object.keys(RATING_CATEGORIES).forEach(key => {
        if (!iconMap[key]) {
            // Map rating categories to main categories
            const mappings = {
                'doga': 'doga_macera',
                'yemek': 'gastronomik',
                'tarihi': 'kulturel',
                'sanat_kultur': 'sanatsal',
                'macera': 'doga_macera',
                'rahatlatici': 'yasayan_kultur',
                'gece_hayati': 'eglence'
            };
            
            const mappedCategory = mappings[key];
            if (mappedCategory) {
                const category = getCategoryByName(mappedCategory);
                if (category) {
                    iconMap[key] = `fas fa-${category.icon}`;
                }
            }
        }
    });
    
    return iconMap;
}

/**
 * Create category color map for poi_recommendation_system compatibility
 * @returns {object} Color map object
 */
function createColorMap() {
    const colorMap = {};
    
    // Add main categories
    POI_CATEGORIES.forEach(category => {
        colorMap[category.name] = { color: category.color };
        
        // Add aliases
        if (category.aliases) {
            category.aliases.forEach(alias => {
                colorMap[alias] = { color: category.color };
            });
        }
    });
    
    return colorMap;
}

/**
 * Create category alias map for poi_recommendation_system compatibility
 * @returns {object} Alias map object
 */
function createAliasMap() {
    const aliasMap = {};
    
    // Add main categories (self-referencing)
    POI_CATEGORIES.forEach(category => {
        aliasMap[category.name] = category.name;
        
        // Add aliases pointing to main category
        if (category.aliases) {
            category.aliases.forEach(alias => {
                aliasMap[alias] = category.name;
            });
        }
    });
    
    // Add rating category mappings
    const ratingMappings = {
        'doga': 'doga_macera',
        'yemek': 'gastronomik',
        'tarihi': 'kulturel',
        'sanat_kultur': 'sanatsal',
        'macera': 'doga_macera',
        'rahatlatici': 'yasayan_kultur',
        'gece_hayati': 'eglence',
        'spor': 'spor',
        'alisveris': 'alisveris'
    };
    
    Object.keys(ratingMappings).forEach(rating => {
        if (!aliasMap[rating]) {
            aliasMap[rating] = ratingMappings[rating];
        }
    });
    
    return aliasMap;
}

// Export all functions and data for use in other modules
// Browser compatibility - no ES6 exports
// export {
//     POI_CATEGORIES,
//     RATING_CATEGORIES,
//     getCategoryByName,
//     getCentralizedCategoryStyle as getCategoryStyle,
//     getCentralizedCategoryDisplayName as getCategoryDisplayName,
//     getAllCategories,
//     getFallbackCategories,
//     createIconMap,
//     createColorMap,
//     createAliasMap
// };

// For backwards compatibility with global usage
if (typeof window !== 'undefined') {
    window.POI_CATEGORIES = POI_CATEGORIES;
    window.RATING_CATEGORIES = RATING_CATEGORIES;
    window.getCategoryByName = getCategoryByName;
    window.getCategoryStyle = getCentralizedCategoryStyle;
    window.getCategoryDisplayName = getCentralizedCategoryDisplayName;
    window.getAllCategories = getAllCategories;
    window.getFallbackCategories = getFallbackCategories;
    window.createIconMap = createIconMap;
    window.createColorMap = createColorMap;
    window.createAliasMap = createAliasMap;
}