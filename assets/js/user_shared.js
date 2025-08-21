(function (global) {
  const UserShared = {};

  UserShared.initMap = function initMap(containerId, options) {
    const map = L.map(containerId, options || {});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 20
    }).addTo(map);
    return map;
  };

  UserShared.fetchJSON = async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  UserShared.fitRoute = function fitRoute(map, geojson) {
    const layer = L.geoJSON(geojson).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    return layer;
  };

  global.UserShared = UserShared;
})(window);

// ==== MEDYA İŞARETLERİ ====
// Rota değişiminde eski pinleri temizler, yeni medyayı çeker ve marker ekler.
// Kullanım: await window.updateMediaMarkers(routeId)
;(function () {
  let mediaLayer = null;
  let mediaFetchAbort = null;

  async function updateMediaMarkers(routeId) {
    try {
      const map = window.map;
      if (!map || !routeId) return;

      if (!mediaLayer) mediaLayer = L.layerGroup().addTo(map);
      mediaLayer.clearLayers();

      if (mediaFetchAbort) mediaFetchAbort.abort();
      mediaFetchAbort = new AbortController();

      // fetchJSON projede global ise onu kullan; yoksa basit bir yedek oluştur.
      const fetchJSON =
        window.fetchJSON ||
        (async (url, opts = {}) => {
          const r = await fetch(url, opts);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });

      // TODO: Gerekirse bu endpoint'i projedeki gerçek media kaynağına uyarlayın.
      // Alternatif: /api/routes/${routeId}/pois?has_media=1
      const mediaItems = await fetchJSON(`/api/routes/${routeId}/media`, {
        signal: mediaFetchAbort.signal,
      });

      (mediaItems || []).forEach((m) => {
        const icon =
          window.mediaIcon ||
          L.divIcon({ className: 'media-pin', html: '📷' });
        L.marker([m.lat, m.lng], { icon })
          .bindPopup(
            typeof window.renderMediaPopup === 'function'
              ? window.renderMediaPopup(m)
              : `<strong>${m.title || 'Medya'}</strong>`
          )
          .addTo(mediaLayer);
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Medya yüklenemedi:', err);
    }
  }

  // Global erişim
  window.updateMediaMarkers = updateMediaMarkers;
  // ES module kullanılıyorsa:
  try {
    export { updateMediaMarkers };
  } catch (_) {}
})();

