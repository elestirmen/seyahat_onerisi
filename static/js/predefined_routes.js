(function(){
  // Isolate page-specific bootstrapping for predefined routes
  try {
    // Ensure we favor predefined flows
    window.currentTab = 'predefined-routes';

    // Function to ensure descriptions have content (fallback)
    function ensureRouteDescriptions() {
      const cardDescriptions = document.querySelectorAll('.predefined-routes-list .route-card .route-card-description');
      cardDescriptions.forEach(desc => {
        // Ensure description has content
        if (!desc.textContent || desc.textContent.trim() === '' || desc.textContent === 'Açıklama bulunmuyor.') {
          desc.textContent = 'Bu rota için özel bir açıklama bulunmuyor. Ancak bölgenin en güzel manzaralarını, tarihi ve kültürel zenginliklerini keşfetme fırsatı sunan eşsiz bir deneyim sizi bekliyor. Doğanın kalbinde unutulmaz anılar biriktirmeye hazır mısınız?';
        }
      });
    }

    // Apply on load and after routes are loaded
    window.addEventListener('load', ensureRouteDescriptions);
    
    // Also apply after routes are loaded by hooking into the global function if possible
    // or simply polling a few times
    const originalLoadPredefinedRoutes = window.loadPredefinedRoutes;
    if (originalLoadPredefinedRoutes) {
      window.loadPredefinedRoutes = async function() {
        const result = await originalLoadPredefinedRoutes.apply(this, arguments);
        setTimeout(ensureRouteDescriptions, 100);
        setTimeout(ensureRouteDescriptions, 1000);
        return result;
      };
    }

    // Force on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureRouteDescriptions);
    } else {
      ensureRouteDescriptions();
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
