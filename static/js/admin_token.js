(function () {
  'use strict';

  const TOKEN_KEY = 'poi_admin_token';

  function readStorage(storage) {
    try {
      return (storage.getItem(TOKEN_KEY) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function safeGetToken() {
    const sessionToken = readStorage(window.sessionStorage);
    if (sessionToken) {
      return sessionToken;
    }

    const legacyToken = readStorage(window.localStorage);
    if (legacyToken) {
      try {
        sessionStorage.setItem(TOKEN_KEY, legacyToken);
      } catch (_) {}
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
    }

    return legacyToken;
  }

  function safeSetToken(token) {
    try {
      const value = String(token || '').trim();
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  function safeClearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  function isSameOrigin(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function getPathname(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.pathname || '';
    } catch (_) {
      return '';
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') return;

  window.fetch = async function (input, init) {
    let request;
    try {
      request = new Request(input, init);
    } catch (_) {
      return originalFetch(input, init);
    }

    const url = request.url || '';
    const pathname = getPathname(url);
    const token = safeGetToken();

    if (token && isSameOrigin(url)) {
      const headers = new Headers(request.headers);
      if (!headers.has('X-Admin-Token') && !headers.has('Authorization')) {
        headers.set('X-Admin-Token', token);
      }
      request = new Request(request, { headers });
    }

    const response = await originalFetch(request);

    if (isSameOrigin(url) && pathname === '/auth/logout' && response && response.ok) {
      safeClearToken();
    }

    return response;
  };

  window.poiAdminAuth = {
    getToken: safeGetToken,
    setToken: safeSetToken,
    clearToken: safeClearToken,
  };
})();
