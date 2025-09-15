(function(){
  function initPOIFix() {
    if (typeof window.initializeModalJitterFix === 'function') {
      // Enable only POI/media-focused patches
      window.initializeModalJitterFix({ enablePOI: true });
      return true;
    }
    return false;
  }

  // Try immediately, then retry until core is ready
  if (!initPOIFix()) {
    const tryInit = () => {
      if (!initPOIFix()) setTimeout(tryInit, 100);
    };
    tryInit();
  }
})();

