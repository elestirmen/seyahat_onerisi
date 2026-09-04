(function(){
  // Isolate page-specific bootstrapping for predefined routes
  try {
    const MESSAGE_ORIGIN = window.location.origin;

    // Ensure we favor predefined flows
    window.currentTab = 'predefined-routes';

    // Function to ensure descriptions have content (fallback)
    // We avoid filler/marketing text. If a real description is missing, build
    // a short honest summary from the card's meta (difficulty, distance,
    // duration, stops). If meta is missing too, use a neutral one-liner.
    function ensureRouteDescriptions() {
      const cards = document.querySelectorAll('.predefined-routes-list .route-card');
      cards.forEach(card => {
        const desc = card.querySelector('.route-card-description');
        if (!desc) return;
        const current = (desc.textContent || '').trim();
        if (current && current !== 'Açıklama bulunmuyor.') return;

        const pick = (sel) => {
          const el = card.querySelector(sel);
          if (!el) return '';
          const txt = (el.textContent || '').trim();
          // Reject empty/placeholder values like "0 km", "0 dk", "0 durak"
          if (!txt || /^0\s/.test(txt) || /^-+$/.test(txt)) return '';
          return txt;
        };

        const parts = [
          pick('.route-difficulty'),
          pick('.route-distance'),
          pick('.route-duration'),
          pick('.route-stops')
        ].filter(Boolean);

        desc.textContent = parts.length
          ? parts.join(' · ')
          : 'Detaylar için bu rotaya tıklayın.';
      });
    }

    // Apply on load and after routes are loaded
    window.addEventListener('load', ensureRouteDescriptions);
    
    // Also apply after routes are loaded by hooking into the global function if possible
    // or simply polling a few times
    const originalLoadPredefinedRoutes = window.loadPredefinedRoutes;
    if (originalLoadPredefinedRoutes) {
      window.loadPredefinedRoutes = function() {
        if (!window.__predefinedRoutesDataLoadPromise) {
          const context = this;
          const args = arguments;
          const pendingLoad = (async () => {
            const result = await originalLoadPredefinedRoutes.apply(context, args);
            setTimeout(ensureRouteDescriptions, 100);
            setTimeout(ensureRouteDescriptions, 1000);
            return result;
          })();

          window.__predefinedRoutesDataLoadPromise = pendingLoad;
          pendingLoad.then(
            () => {
              if (window.__predefinedRoutesDataLoadPromise === pendingLoad) {
                window.__predefinedRoutesDataLoadPromise = null;
              }
            },
            () => {
              if (window.__predefinedRoutesDataLoadPromise === pendingLoad) {
                window.__predefinedRoutesDataLoadPromise = null;
              }
            }
          );
        }

        return window.__predefinedRoutesDataLoadPromise;
      };
    }

    // Force on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureRouteDescriptions);
    } else {
      ensureRouteDescriptions();
    }

    // Wire the "Filtreleri Sıfırla" button on the empty state card.
    // We use event delegation so this works even if the message is
    // re-rendered later.
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('#noRoutesResetBtn');
      if (!btn) return;
      e.preventDefault();
      if (typeof window.clearAllFilters === 'function') {
        window.clearAllFilters();
      } else if (typeof clearAllFilters === 'function') {
        clearAllFilters();
      }
    });

    // Notify parent shell this iframe is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'predefined:ready' }, MESSAGE_ORIGIN);
    }

    const PENDING_FILTER_KEY = 'pendingPredefinedIntentFilters';

    function setFilterChip(groupId, value) {
      const group = document.getElementById(groupId);
      if (!group) return;

      const chips = group.querySelectorAll('.filter-chip');
      let matched = false;
      chips.forEach(chip => {
        const isActive = chip.dataset.value === (value || '');
        chip.classList.toggle('active', isActive);
        if (isActive) matched = true;
      });

      if (!matched && chips[0]) {
        chips.forEach(chip => chip.classList.remove('active'));
        chips[0].classList.add('active');
      }
    }

    async function applyIncomingRouteFilters(filters = {}) {
      try {
        if (typeof predefinedRoutes !== 'undefined' && Array.isArray(predefinedRoutes) && predefinedRoutes.length === 0 && typeof loadPredefinedRoutes === 'function') {
          await loadPredefinedRoutes();
        }

        if (filters.routeType !== undefined) {
          setFilterChip('routeTypeChips', filters.routeType);
        }
        if (filters.difficulty !== undefined) {
          setFilterChip('difficultyChips', filters.difficulty);
        }
        if (filters.duration !== undefined) {
          setFilterChip('durationChips', filters.duration);
        }
        if (filters.favorites !== undefined) {
          setFilterChip('favoriteChips', filters.favorites);
        }

        const searchInput = document.getElementById('routeSearchInput');
        if (searchInput && filters.keepSearch !== true) {
          searchInput.value = '';
        }

        if (typeof applyRouteFilters === 'function') {
          applyRouteFilters();
        }

        const list = document.getElementById('predefinedRoutesList');
        if (list) {
          setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
      } catch (error) {
        console.error('Could not apply incoming route filters:', error);
      }
    }

    function consumePendingRouteFilters() {
      let payload = null;
      try {
        payload = JSON.parse(localStorage.getItem(PENDING_FILTER_KEY) || 'null');
      } catch (_) {
        payload = null;
      }

      if (!payload || payload.type !== 'intent:predefined-filter') return;
      if (payload.ts && Date.now() - payload.ts > 60000) {
        try { localStorage.removeItem(PENDING_FILTER_KEY); } catch (_) {}
        return;
      }

      try { localStorage.removeItem(PENDING_FILTER_KEY); } catch (_) {}
      applyIncomingRouteFilters(payload.filters || {});
    }

    window.addEventListener('message', function(e){
      if (
        window.parent === window ||
        e.origin !== MESSAGE_ORIGIN ||
        e.source !== window.parent ||
        !e.data ||
        typeof e.data !== 'object'
      ) {
        return;
      }

      const message = e.data;
      if (message.type === 'predefined:apply-filters') {
        applyIncomingRouteFilters(message.filters || {});
      }
    });

    // The main application owns listener and map initialization. In split-page
    // mode this small wrapper only ensures that route data is loaded once.
    document.addEventListener('DOMContentLoaded', function(){
      (async () => {
        try {
          if (typeof loadPredefinedRoutes === 'function') {
            await loadPredefinedRoutes();
          }
        } catch (e) {
          console.error('loadPredefinedRoutes failed:', e);
        }
      })();

      setTimeout(consumePendingRouteFilters, 400);
      setTimeout(consumePendingRouteFilters, 1400);
    });
  } catch (err) {
    console.error('predefined_routes bootstrap error:', err);
  }
})();
