const DEFAULTS = {
  get L() {
    return window.L;
  },
  get addBaseLayers() {
    return typeof window.addBaseLayers === 'function' ? window.addBaseLayers : () => {};
  },
  get ensurePOISearchBar() {
    return typeof window.ensurePOISearchBar === 'function' ? window.ensurePOISearchBar : () => {};
  },
  get createCustomIcon() {
    return typeof window.createCustomIcon === 'function' ? window.createCustomIcon : (() => null);
  },
  get getCategoryDisplayName() {
    return typeof window.getCategoryDisplayName === 'function' ? window.getCategoryDisplayName : (category => category || '');
  },
  get showPOIDetail() {
    return typeof window.showPOIDetail === 'function' ? window.showPOIDetail : (() => {});
  },
  get openInGoogleMaps() {
    return typeof window.openInGoogleMaps === 'function' ? window.openInGoogleMaps : (() => {});
  },
  get addToRoute() {
    return typeof window.addToRoute === 'function' ? window.addToRoute : (() => {});
  },
  addTimeout(fn, delay) {
    return window.setTimeout(fn, delay);
  },
};

function resolveDeps(deps = {}) {
  return {
    L: deps.L || DEFAULTS.L,
    addBaseLayers: deps.addBaseLayers || DEFAULTS.addBaseLayers,
    ensurePOISearchBar: deps.ensurePOISearchBar || DEFAULTS.ensurePOISearchBar,
    createCustomIcon: deps.createCustomIcon || DEFAULTS.createCustomIcon,
    getCategoryDisplayName: deps.getCategoryDisplayName || DEFAULTS.getCategoryDisplayName,
    showPOIDetail: deps.showPOIDetail || DEFAULTS.showPOIDetail,
    openInGoogleMaps: deps.openInGoogleMaps || DEFAULTS.openInGoogleMaps,
    addToRoute: deps.addToRoute || DEFAULTS.addToRoute,
    addTimeout: deps.addTimeout || DEFAULTS.addTimeout,
  };
}

export async function initializeMainMapImpl(state, deps = {}) {
  if (!state) {
    throw new Error('Map state is required');
  }

  const resolved = resolveDeps(deps);

  if (state.mapInitializationPromise) {
    return state.mapInitializationPromise;
  }

  if (state.map && state.map._container && state.mapInitialized) {
    try {
      state.map.invalidateSize();
    } catch (_) {}
    return true;
  }

  const promise = performMainMapInitializationImpl(state, resolved);
  state.mapInitializationPromise = promise;

  try {
    const result = await promise;
    state.mapInitialized = result;
    return result;
  } finally {
    state.mapInitializationPromise = null;
  }
}

export async function performMainMapInitializationImpl(state, deps = {}) {
  if (!state) {
    throw new Error('Map state is required');
  }

  const {
    L,
    addBaseLayers,
    ensurePOISearchBar,
    addTimeout,
  } = resolveDeps(deps);

  const mapContainer = document.getElementById('mapContainer');
  if (!mapContainer) {
    console.error('❌ Map container not found');
    return false;
  }

  const routeSection = document.getElementById('routeSection');
  if (routeSection) {
    routeSection.style.display = 'block';
  }

  await new Promise(resolve => addTimeout(resolve, 50));

  if (state.map) {
    try {
      state.map.remove();
    } catch (error) {
      console.warn('Error removing existing map:', error);
    }
    state.map = null;
  }

  try {
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet library not loaded');
      return false;
    }

    state.map = L.map('mapContainer', {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      tap: true,
      tapTolerance: 15,
      worldCopyJump: false,
      maxBoundsViscosity: 0.0,
      preferCanvas: true,
      renderer: L.canvas(),
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    }).setView([38.632, 34.912], 13);

    addBaseLayers(state.map);

    try {
      if (typeof window.loadPanoramasLayer === 'function') {
        await window.loadPanoramasLayer();
      }
    } catch (error) {
      console.warn('Panorama layer failed to load:', error);
    }

    try {
      if (state.poiCluster && state.map.hasLayer && state.map.hasLayer(state.poiCluster)) {
        state.map.removeLayer(state.poiCluster);
      }
      state.poiCluster = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 25,
        chunkInterval: 200,
        disableClusteringAtZoom: 13,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius(zoom) {
          return zoom >= 13 ? 25 : Math.max(10, 50 - zoom * 3);
        },
      });
      state.map.addLayer(state.poiCluster);
    } catch (error) {
      console.warn('MarkerCluster init failed or not available:', error);
    }

    try {
      ensurePOISearchBar();
    } catch (_) {}

    state.markers = [];

    addTimeout(() => {
      if (state.map && state.map.invalidateSize) {
        state.map.invalidateSize();
      }
    }, 200);

    return true;
  } catch (error) {
    console.error('❌ Error initializing main map:', error);
    return false;
  }
}

function createPopupActionButton(label, iconClass, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'popup-btn';

  const icon = document.createElement('i');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = label;

  button.append(icon, text);
  button.addEventListener('click', onClick);
  return button;
}

export function createPOIPopupElement(poi, options = {}) {
  const popupPOI = poi || {};
  const {
    categoryDisplayName = popupPOI.category || '',
    lat = popupPOI.latitude ?? popupPOI.lat,
    lng = popupPOI.longitude ?? popupPOI.lon ?? popupPOI.lng,
    showPOIDetail = () => {},
    openInGoogleMaps = () => {},
    addToRoute = () => {},
  } = options;

  const popup = document.createElement('div');
  popup.className = 'poi-popup';

  const header = document.createElement('div');
  header.className = 'poi-popup-header';

  const title = document.createElement('h4');
  title.textContent = popupPOI.name ?? '';

  const category = document.createElement('span');
  category.className = 'poi-category-badge';
  category.textContent = categoryDisplayName ?? '';

  header.append(title, category);
  popup.append(header);

  if (popupPOI.description) {
    const description = document.createElement('p');
    description.className = 'poi-description';
    description.textContent = popupPOI.description;
    popup.append(description);
  }

  const actions = document.createElement('div');
  actions.className = 'poi-popup-actions';
  actions.append(
    createPopupActionButton('Detaylar', 'fas fa-info-circle', () => {
      showPOIDetail(popupPOI._id || popupPOI.id, popupPOI);
    }),
    createPopupActionButton('Google Maps', 'fas fa-external-link-alt', () => {
      openInGoogleMaps(lat, lng, popupPOI.name || '');
    }),
    createPopupActionButton('Rotaya Ekle', 'fas fa-plus', () => {
      addToRoute(popupPOI);
    }),
  );
  popup.append(actions);

  return popup;
}

export function updateMapWithPOIsImpl(state, deps = {}, allPOIs = []) {
  if (!state || !state.map) {
    console.error('❌ Map not initialized');
    return;
  }

  const {
    L,
    createCustomIcon,
    getCategoryDisplayName,
    showPOIDetail,
    openInGoogleMaps,
    addToRoute,
  } = resolveDeps(deps);

  (state.markers || []).forEach(marker => {
    try {
      if (state.poiCluster && state.poiCluster.hasLayer && state.poiCluster.hasLayer(marker)) {
        state.poiCluster.removeLayer(marker);
      } else if (marker && typeof marker.remove === 'function') {
        marker.remove();
      }
    } catch (_) {}
  });
  state.markers = [];

  if (state.poiCluster && typeof state.poiCluster.clearLayers === 'function') {
    try {
      state.poiCluster.clearLayers();
    } catch (_) {}
  }

  (allPOIs || []).forEach(poi => {
    try {
      const lat = poi.latitude ?? poi.lat;
      const lng = poi.longitude ?? poi.lon ?? poi.lng;
      if (!lat || !lng) {
        console.warn('⚠️ POI missing coordinates:', poi.name);
        return;
      }

      const customIcon = createCustomIcon(poi.category, poi.recommendationScore || 75, false);
      const marker = L.marker([lat, lng], { icon: customIcon });

      if (state.poiCluster) {
        state.poiCluster.addLayer(marker);
      } else {
        marker.addTo(state.map);
      }

      const popupContent = createPOIPopupElement(poi, {
        categoryDisplayName: getCategoryDisplayName(poi.category),
        lat,
        lng,
        showPOIDetail,
        openInGoogleMaps,
        addToRoute,
      });

      marker.bindPopup(popupContent);
      marker.poiName = poi.name || '';
      marker.poiNameLower = (poi.name || '').toLowerCase();
      marker.poiCategory = poi.category || '';
      marker.poiTags = Array.isArray(poi.tags) ? poi.tags.join(' ').toLowerCase() : (poi.tags || '').toLowerCase();
      marker.poiData = poi;
      state.markers.push(marker);
    } catch (error) {
      console.error('❌ Error creating marker for POI:', poi.name, error);
    }
  });

  if (state.markers.length > 0) {
    try {
      if (state.poiCluster && typeof state.poiCluster.getBounds === 'function' && state.poiCluster.getLayers().length) {
        state.map.fitBounds(state.poiCluster.getBounds().pad(0.1));
      } else {
        const group = new L.featureGroup(state.markers);
        state.map.fitBounds(group.getBounds().pad(0.1));
      }

      const MIN_ZOOM_FOR_REGION = 11;
      if (typeof state.map.getZoom === 'function' && state.map.getZoom() < MIN_ZOOM_FOR_REGION) {
        state.map.setView([38.6436, 34.8128], 13);
      }
    } catch (error) {
      console.error('❌ Error fitting map bounds:', error);
      state.map.setView([38.6436, 34.8128], 13);
    }
  } else {
    state.map.setView([38.6436, 34.8128], 13);
  }
}

export function switchToDynamicMapViewImpl(state, deps = {}) {
  const { addTimeout } = resolveDeps(deps);
  const mapSection = document.getElementById('mapSection');
  if (!mapSection) {
    return;
  }

  mapSection.style.display = 'block';
  addTimeout(() => {
    try {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (state.map && typeof state.map.invalidateSize === 'function') {
        addTimeout(() => state.map.invalidateSize(), 300);
      }
      if (typeof window.loadPanoramasLayer === 'function') {
        window.loadPanoramasLayer();
      }
    } catch (error) {
      console.warn('switchToDynamicMapView failed:', error);
    }
  }, 50);
}

if (typeof window !== 'undefined') {
  window.MapControllerImpl = {
    initializeMainMapImpl,
    performMainMapInitializationImpl,
    createPOIPopupElement,
    updateMapWithPOIsImpl,
    switchToDynamicMapViewImpl,
  };
}

export default {
  initializeMainMapImpl,
  performMainMapInitializationImpl,
  createPOIPopupElement,
  updateMapWithPOIsImpl,
  switchToDynamicMapViewImpl,
};
