(function(){
  function initRouteFix() {
    if (typeof window.initializeModalJitterFix === 'function') {
      // Enable only route-focused patches
      window.initializeModalJitterFix({ enableRoute: true });
      return true;
    }
    return false;
  }

  // Try immediately, then retry until core is ready
  if (!initRouteFix()) {
    const tryInit = () => {
      if (!initRouteFix()) setTimeout(tryInit, 100);
    };
    tryInit();
  }
})();

