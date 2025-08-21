export function initElevationMediaMarkers({
  map,
  elevationControl,
  trackCoords = [],
  mediaList = [],
  createOrGetMarker
}) {
  if (!elevationControl || !Array.isArray(trackCoords) || trackCoords.length === 0) {
    console.warn('initElevationMediaMarkers: Missing elevation data');
    return;
  }
  if (!Array.isArray(mediaList) || mediaList.length === 0) {
    return;
  }

  // Helper: haversine distance in km
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const toRad = x => x * Math.PI / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) / 1000; // return in km
  }

  // Pre-compute cumulative distances
  const cumDistances = [0];
  for (let i = 1; i < trackCoords.length; i++) {
    const prev = trackCoords[i - 1];
    const curr = trackCoords[i];
    const d = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    cumDistances[i] = cumDistances[i - 1] + d;
  }

  function nearestPoint(lat, lng) {
    let best = 0;
    let min = Infinity;
    for (let i = 0; i < trackCoords.length; i++) {
      const p = trackCoords[i];
      const dist = haversine(lat, lng, p.lat, p.lng);
      if (dist < min) {
        min = dist;
        best = i;
      }
    }
    return {
      index: best,
      distance: cumDistances[best],
      elevation: trackCoords[best].elev || trackCoords[best].elevation || 0
    };
  }

  // Access underlying d3 chart
  const container = elevationControl._container || elevationControl.container || null;
  if (!container) return;
  const svgNode = container.querySelector('svg');
  if (!svgNode) return;
  const svg = d3.select(svgNode);

  // Remove existing markers
  svg.select('g.elevation-media-markers').remove();
  const layer = svg.append('g').attr('class', 'elevation-media-markers');

  const chart = elevationControl._chart || elevationControl.chart || {};
  const xScale = chart.x || (d => d);
  const yScale = chart.y || (d => d);

  const iconMap = new Map();

  // To avoid overlap on same x
  const xUsage = {};

  mediaList.forEach(media => {
    const lat = parseFloat(media.lat ?? media.latitude);
    const lng = parseFloat(media.lng ?? media.longitude ?? media.lon);
    if (!isFinite(lat) || !isFinite(lng)) {
      console.warn('Media without coordinates', media);
      return;
    }
    const info = nearestPoint(lat, lng);
    const x = xScale(info.distance);
    let y = yScale(info.elevation);
    const key = Math.round(x);
    const offset = (xUsage[key] || 0) * 8;
    xUsage[key] = (xUsage[key] || 0) + 1;
    y -= offset;

    const g = layer.append('g')
      .attr('class', 'elevation-media-marker')
      .attr('transform', `translate(${x},${y})`);

    g.append('text')
      .attr('class', 'camera-icon')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 16)
      .text('\uD83D\uDCF7');

    if (media.id) {
      iconMap.set(media.id, g);
    }

    // Interaction with map markers
    const getMarker = () => createOrGetMarker ? createOrGetMarker(media) : null;

    const showThumbnail = () => {
      const marker = getMarker();
      if (marker) {
        marker.openPopup();
      }
      if (media.thumbnailUrl) {
        const popup = L.popup({ autoPan: false, closeButton: false, className: 'elevation-media-popup' })
          .setLatLng(marker ? marker.getLatLng() : [lat, lng])
          .setContent(`<img src="${media.thumbnailUrl}" style="max-width:120px;max-height:80px;"/>`)
          .openOn(map);
        g.on('mouseout', () => map.closePopup(popup));
      }
    };

    g.on('mouseenter', () => {
      g.classed('active', true);
      showThumbnail();
    });
    g.on('mouseleave', () => {
      g.classed('active', false);
    });
    g.on('click', () => {
      const marker = getMarker();
      if (marker) marker.openPopup();
    });

    const marker = getMarker();
    if (marker) {
      marker.on('mouseover', () => g.classed('active', true));
      marker.on('mouseout', () => g.classed('active', false));
    }
  });

  function reposition() {
    const xScale = chart.x || (d => d);
    const yScale = chart.y || (d => d);
    const usage = {};
    mediaList.forEach(media => {
      const icon = media.id ? iconMap.get(media.id) : null;
      if (!icon) return;
      const lat = parseFloat(media.lat ?? media.latitude);
      const lng = parseFloat(media.lng ?? media.longitude ?? media.lon);
      const info = nearestPoint(lat, lng);
      const x = xScale(info.distance);
      let y = yScale(info.elevation);
      const key = Math.round(x);
      const off = (usage[key] || 0) * 8;
      usage[key] = (usage[key] || 0) + 1;
      y -= off;
      icon.attr('transform', `translate(${x},${y})`);
    });
  }

  // listen to chart resize/redraw
  if (elevationControl.on) {
    elevationControl.on('elechart_resize', reposition);
    elevationControl.on('elechart_redraw', reposition);
  }
  window.addEventListener('resize', reposition);
}

if (typeof window !== 'undefined') {
  window.initElevationMediaMarkers = initElevationMediaMarkers;
}
