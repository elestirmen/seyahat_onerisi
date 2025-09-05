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
      if (typeof loadPredefinedRoutes === 'function') {
        try { loadPredefinedRoutes(); } catch (e) { console.error('loadPredefinedRoutes failed:', e); }
      }
    });
  } catch (err) {
    console.error('predefined_routes bootstrap error:', err);
  }
})();
