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
