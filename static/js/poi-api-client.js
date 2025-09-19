(function (global) {
  const POI_API_CACHE = {
    allPOIs: null,
    lastFetch: null,
    raw: null,
    sliderConfig: null,
  };

  function getApiBase() {
    return global.apiBase || '/api';
  }

  async function handleResponse(response) {
    if (!response.ok) {
      let message = response.statusText;
      try {
        const text = await response.text();
        if (text) message = `${response.status} ${text}`;
      } catch (_) {}
      throw new Error(message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  function normalizePOIs(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.pois)) {
      return data.pois;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }

    if (typeof data === 'object') {
      const flattened = [];
      try {
        Object.entries(data).forEach(([category, list]) => {
          if (!Array.isArray(list)) return;
          list.forEach((poi) => {
            flattened.push({
              ...poi,
              category: poi.category || category,
            });
          });
        });
        return flattened;
      } catch (error) {
        console.warn('POIClient normalize error:', error);
        return [];
      }
    }

    return [];
  }

  async function fetchAllPOIs(options = {}) {
    const { refresh = false, normalize = true } = options;
    if (!refresh && POI_API_CACHE.allPOIs) {
      return normalize ? POI_API_CACHE.allPOIs : POI_API_CACHE.raw;
    }

    const response = await fetch(`${getApiBase()}/pois`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await handleResponse(response);
    const processed = normalize ? normalizePOIs(data) : data;

    POI_API_CACHE.raw = data;
    POI_API_CACHE.allPOIs = normalize ? processed : null;
    POI_API_CACHE.lastFetch = Date.now();

    return processed;
  }

  async function fetchSliderConfig(options = {}) {
    const { refresh = false } = options;
    if (!refresh && POI_API_CACHE.sliderConfig) {
      return POI_API_CACHE.sliderConfig;
    }

    const response = await fetch('static/config/poi_slider_config.json', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await handleResponse(response);
    POI_API_CACHE.sliderConfig = data;
    return data;
  }

  async function fetchPOICategories() {
    const response = await fetch(`${getApiBase()}/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  }

  async function fetchPOIDetails(poiId) {
    if (!poiId) throw new Error('POI ID is required');
    const response = await fetch(`${getApiBase()}/poi/${poiId}`);
    return handleResponse(response);
  }

  async function fetchPOIMedia(poiId) {
    if (!poiId) throw new Error('POI ID is required');
    const response = await fetch(`${getApiBase()}/poi/${poiId}/media`);
    return handleResponse(response);
  }

  global.POIClient = {
    getAllPOIs: fetchAllPOIs,
    getPOICategories: fetchPOICategories,
    getPOIDetails: fetchPOIDetails,
    getPOIMedia: fetchPOIMedia,
    getSliderConfig: fetchSliderConfig,
    normalizePOIs,
  };
})(window);
