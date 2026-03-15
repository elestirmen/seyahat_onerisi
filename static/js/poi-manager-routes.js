(function (global) {
    'use strict';

    const POIManagerRouteMethods = {
        async loadRoutesForMap() {
            try {
                const response = await this.authenticatedFetch('/api/routes');
                if (!response.ok) {
                    throw new Error('Rotalar yüklenemedi');
                }
                const data = await response.json();
                this.routes = this.extractRouteCollection(data);
                this.updateRouteLayersOnMap();
            } catch (error) {
                console.warn('Rotalar yüklenemedi:', error);
            }
        },

        updateRouteLayersOnMap() {
            if (!this.map || !Array.isArray(this.routes)) return;

            if (!this.routeLayers) {
                this.routeLayers = {};
            }

            Object.values(this.routeLayers).forEach(layer => {
                try {
                    this.map.removeLayer(layer);
                } catch (_) {
                    // noop
                }
            });
            this.routeLayers = {};

            const routeTypes = {
                walking: { name: 'Yürüyüş', color: '#10b981' },
                hiking: { name: 'Doğa Yürüyüşü', color: '#f59e0b' },
                cycling: { name: 'Bisiklet', color: '#3b82f6' },
                driving: { name: 'Araç', color: '#ef4444' }
            };

            const addedLayers = [];

            this.routes.forEach(route => {
                if (!route || !route.geometry) return;

                try {
                    const geojson = typeof route.geometry === 'string'
                        ? JSON.parse(route.geometry)
                        : route.geometry;

                    const layer = L.geoJSON(geojson, {
                        style: {
                            color: routeTypes[route.route_type]?.color || '#2563eb',
                            weight: 3,
                            opacity: 0.8
                        }
                    }).bindPopup(`
                        <strong>${this.escapeHtml(route.name || 'Rota')}</strong><br>
                        ${this.escapeHtml(routeTypes[route.route_type]?.name || route.route_type || '')}
                    `);

                    layer.addTo(this.map);
                    this.routeLayers[route.id || route._id] = layer;
                    addedLayers.push(layer);
                } catch (error) {
                    console.warn('Rota geometry parse hatası:', error);
                }
            });

            if (addedLayers.length > 0) {
                const group = new L.featureGroup(addedLayers);
                try {
                    this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
                } catch (_) {
                    // noop
                }
            }
        }
    };

    global.POIManagerRouteMethods = POIManagerRouteMethods;
})(window);
