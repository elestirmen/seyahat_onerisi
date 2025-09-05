(function(){
  // Isolate page-specific bootstrapping for predefined routes
  try {
    // Ensure we favor predefined flows
    window.currentTab = 'predefined-routes';

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
