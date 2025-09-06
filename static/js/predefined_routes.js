(function(){
  // Isolate page-specific bootstrapping for predefined routes
  try {
    // Ensure we favor predefined flows
    window.currentTab = 'predefined-routes';

    // FORCE MOBILE ROUTE CARD LAYOUT
    function forceMobileRouteCards() {
      if (window.innerWidth <= 768) {
        console.log('🔧 Forcing mobile route card layout...');

        // Force list layout
        const routesList = document.querySelector('.predefined-routes-list');
        if (routesList) {
          routesList.style.display = 'flex';
          routesList.style.flexDirection = 'column';
          routesList.style.gap = '16px';
          routesList.style.padding = '0 8px';
        }

        // Force card layout
        const routeCards = document.querySelectorAll('.predefined-routes-list .route-card');
        routeCards.forEach(card => {
          card.style.display = 'block';
          card.style.minHeight = '280px';
          card.style.width = '100%';
          card.style.margin = '0';
          card.style.borderRadius = '16px';
          card.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
          card.style.overflow = 'hidden';
        });

        // Force image layout
        const cardImages = document.querySelectorAll('.predefined-routes-list .route-card .route-card-image');
        cardImages.forEach(img => {
          img.style.height = '180px';
          img.style.width = '100%';
          img.style.borderRadius = '16px 16px 0 0';
          img.style.backgroundColor = '#f3f4f6';
        });

        // Force header layout
        const cardHeaders = document.querySelectorAll('.predefined-routes-list .route-card .route-card-header');
        cardHeaders.forEach(header => {
          header.style.padding = '16px';
        });

        // Force meta layout
        const cardMetas = document.querySelectorAll('.predefined-routes-list .route-card .route-card-meta');
        cardMetas.forEach(meta => {
          meta.style.padding = '0 16px 16px 16px';
          meta.style.display = 'grid';
          meta.style.gridTemplateColumns = '1fr 1fr';
          meta.style.gap = '8px';
        });

        console.log('✅ Mobile route card layout forced successfully');
      }
    }

    // Apply on load and resize
    window.addEventListener('load', forceMobileRouteCards);
    window.addEventListener('resize', forceMobileRouteCards);

    // Also apply after routes are loaded
    const originalLoadPredefinedRoutes = window.loadPredefinedRoutes;
    if (originalLoadPredefinedRoutes) {
      window.loadPredefinedRoutes = async function() {
        const result = await originalLoadPredefinedRoutes.apply(this, arguments);
        setTimeout(forceMobileRouteCards, 100);
        return result;
      };
    }

    // Optional: parent ↔ iframe bridge (skeleton)
    window.addEventListener('message', function(e){
      // Reserved for future cross-frame communication
      // e.data && e.data.type === 'parent:ping'
    });

    // Notify parent shell this iframe is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'predefined:ready' }, '*');
    }

    // In split-page mode, there are no tabs; proactively load routes
    document.addEventListener('DOMContentLoaded', function(){
      try {
        if (typeof initializePredefinedRoutes === 'function') {
          initializePredefinedRoutes();
        }
      } catch (e) {
        console.error('initializePredefinedRoutes failed:', e);
      }

      (async () => {
        try {
          if (typeof loadPredefinedRoutes === 'function') {
            await loadPredefinedRoutes();
          }
        } catch (e) {
          console.error('loadPredefinedRoutes failed:', e);
        }
        try {
          if (typeof initializePredefinedMap === 'function') {
            await initializePredefinedMap();
          }
        } catch (e) {
          console.error('initializePredefinedMap failed:', e);
        }
      })();
    });
  } catch (err) {
    console.error('predefined_routes bootstrap error:', err);
  }
})();
