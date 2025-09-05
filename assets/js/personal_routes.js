(function(){
  // Isolate page-specific bootstrapping for personal (dynamic) routes
  try {
    // Hint main script which mode we're in
    window.currentTab = 'dynamic-routes';

    // Optional: parent ↔ iframe bridge (skeleton)
    window.addEventListener('message', function(e){
      // Reserved for future cross-frame communication
      // e.data && e.data.type === 'parent:ping'
    });

    // Notify parent shell this iframe is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'personal:ready' }, '*');
    }
  } catch (err) {
    console.error('personal_routes bootstrap error:', err);
  }
})();

