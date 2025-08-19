/**
 * Elevation Chart Component
 * Interactive elevation profile with map synchronization
 */

class ElevationChart {
    constructor(containerId, mapInstance) {
        this.containerId = containerId;
        this.map = mapInstance;
        this.chart = null;
        this.canvas = null;
        this.ctx = null;
        this.routeData = null;
        this.elevationData = [];
        this.mediaOverlayPoints = [];
        this.pendingMediaMarkers = null;
        this.mapMarker = null;
        this.isMouseOver = false;
        
        this.init();
    }

    init() {
        this.createChartContainer();
        this.setupEventListeners();
    }

    createChartContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Elevation chart container not found:', this.containerId);
            return;
        }

        // Create elevation section HTML
        container.innerHTML = `
            <div class="elevation-chart-section">
                <div class="elevation-header">
                    <h4><i class="fas fa-mountain"></i> Yükseklik Profili</h4>
                    <div class="elevation-stats">
                        <span class="elevation-stat">
                            <i class="fas fa-arrow-up"></i>
                            <span id="minElevation">--m</span>
                        </span>
                        <span class="elevation-stat">
                            <i class="fas fa-arrow-down"></i>
                            <span id="maxElevation">--m</span>
                        </span>
                        <span class="elevation-stat">
                            <i class="fas fa-trending-up"></i>
                            <span id="totalAscent">+--m</span>
                        </span>
                        <span class="elevation-stat">
                            <i class="fas fa-trending-down"></i>
                            <span id="totalDescent">---m</span>
                        </span>
                    </div>
                </div>
                <div class="elevation-chart-container">
                    <canvas id="elevationCanvas" width="400" height="120"></canvas>
                    <div class="elevation-tooltip" id="elevationTooltip"></div>
                </div>
                <div class="elevation-distance-labels">
                    <span class="distance-start">0 km</span>
                    <span class="distance-end">-- km</span>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('elevationCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Add CSS styles
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('elevation-chart-styles')) return;

        const style = document.createElement('style');
        style.id = 'elevation-chart-styles';
        style.textContent = `
            .elevation-chart-section {
                background: white;
                border-radius: 12px;
                padding: 1rem;
                margin: 1rem 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                border: 1px solid #e2e8f0;
            }

            .elevation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #e2e8f0;
            }

            .elevation-header h4 {
                margin: 0;
                color: #2563eb;
                font-size: 1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .elevation-stats {
                display: flex;
                gap: 1rem;
                font-size: 0.8rem;
            }

            .elevation-stat {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                color: #64748b;
                font-weight: 500;
            }

            .elevation-stat i {
                color: #2563eb;
            }

            .elevation-chart-container {
                position: relative;
                background: #f8fafc;
                border-radius: 8px;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
            }

            #elevationCanvas {
                width: 100%;
                height: 120px;
                cursor: crosshair;
                border-radius: 6px;
            }

            .elevation-tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 0.5rem;
                border-radius: 6px;
                font-size: 0.8rem;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                z-index: 1000;
                white-space: nowrap;
            }

            .elevation-tooltip.show {
                opacity: 1;
            }

            .elevation-distance-labels {
                display: flex;
                justify-content: space-between;
                font-size: 0.75rem;
                color: #64748b;
                margin-top: 0.25rem;
            }

            .elevation-chart-hidden {
                display: none;
            }

            /* Map marker for elevation position */
            .elevation-position-marker {
                background: #3b82f6 !important;
                border: 3px solid white !important;
                border-radius: 50% !important;
                width: 12px !important;
                height: 12px !important;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseenter', () => this.isMouseOver = true);
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    async loadElevationProfile(elevationProfile) {
        /**
         * Load pre-calculated elevation profile from database
         * @param {Object} elevationProfile - Pre-calculated elevation profile
         */
        try {
            console.log('🏔️ Loading pre-calculated elevation profile:', elevationProfile);
            
            if (!elevationProfile || !elevationProfile.points || elevationProfile.points.length === 0) {
                console.warn('No elevation profile data available');
                this.hideChart();
                return;
            }
            
            // Convert database format to chart format
            this.elevationData = elevationProfile.points.map(point => ({
                distance: point.distance / 1000, // Convert to km
                elevation: point.elevation,
                lat: point.lat,
                lng: point.lng,
                name: point.name || '',
                type: point.type || 'interpolated'
            }));
            
            // Store stats
            this.elevationStats = elevationProfile.stats || {};
            
            console.log(`✅ Loaded ${this.elevationData.length} elevation points from database`);
            console.log(`📊 Elevation range: ${this.elevationStats.min_elevation || 'unknown'}m - ${this.elevationStats.max_elevation || 'unknown'}m`);
            
            this.updateChart();
            this.updateStats();
            this.showChart();
            // If media markers were provided before elevation was ready, render them now
            if (this.pendingMediaMarkers) {
                this.setMediaMarkers(this.pendingMediaMarkers);
                this.pendingMediaMarkers = null;
            }
            
        } catch (error) {
            console.error('Error loading elevation profile:', error);
            this.hideChart();
        }
    }

    async loadRouteElevation(routeData) {
        this.routeData = routeData;
        
        try {
            // Generate elevation data from route geometry
            if (routeData.geometry && routeData.geometry.coordinates) {
                await this.generateElevationFromGeometry(routeData.geometry.coordinates);
            } else if (routeData.pois && routeData.pois.length > 0) {
                await this.generateElevationFromPOIs(routeData.pois);
            } else {
                console.warn('No geometry or POIs found for elevation profile');
                this.hideChart();
                return;
            }

            this.updateChart();
            this.updateStats();
            this.showChart();
            // If media markers were provided before elevation was ready, render them now
            if (this.pendingMediaMarkers) {
                this.setMediaMarkers(this.pendingMediaMarkers);
                this.pendingMediaMarkers = null;
            }
        } catch (error) {
            console.error('Error loading elevation data:', error);
            this.hideChart();
        }
    }

    async generateElevationFromGeometry(coordinates) {
        this.elevationData = [];
        let totalDistance = 0;

        for (let i = 0; i < coordinates.length; i++) {
            const [lng, lat] = coordinates[i];
            
            // Calculate distance from start
            if (i > 0) {
                const prevCoord = coordinates[i - 1];
                const distance = this.calculateDistance(
                    prevCoord[1], prevCoord[0], lat, lng
                );
                totalDistance += distance;
            }

            // Get elevation (simulate for now, can be replaced with real elevation API)
            const elevation = await this.getElevation(lat, lng);
            
            this.elevationData.push({
                distance: totalDistance,
                elevation: elevation,
                lat: lat,
                lng: lng,
                index: i
            });
        }
    }

    async generateElevationFromPOIs(pois) {
        this.elevationData = [];
        let totalDistance = 0;

        for (let i = 0; i < pois.length; i++) {
            const poi = pois[i];
            
            // Calculate distance from start
            if (i > 0) {
                const prevPoi = pois[i - 1];
                const distance = this.calculateDistance(
                    prevPoi.latitude, prevPoi.longitude,
                    poi.latitude, poi.longitude
                );
                totalDistance += distance;
            }

            // Get elevation
            const elevation = await this.getElevation(poi.latitude, poi.longitude);
            
            this.elevationData.push({
                distance: totalDistance,
                elevation: elevation,
                lat: poi.latitude,
                lng: poi.longitude,
                poi: poi,
                index: i
            });
        }
    }

    async getElevation(lat, lng) {
        // Simulate elevation data based on coordinates
        // In a real implementation, you would call an elevation API like:
        // - Google Elevation API
        // - Open Elevation API
        // - SRTM data
        
        // For Cappadocia region, simulate realistic elevations
        const baseElevation = 1000; // Base elevation for Cappadocia
        const variation = Math.sin(lat * 100) * Math.cos(lng * 100) * 200;
        const noise = (Math.random() - 0.5) * 50;
        
        return Math.round(baseElevation + variation + noise);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    updateChart() {
        if (!this.ctx || !this.elevationData.length) return;

        const canvas = this.canvas;
        const ctx = this.ctx;
        
        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = rect.width;
        const height = rect.height;
        const padding = 20;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Get data ranges
        const maxDistance = Math.max(...this.elevationData.map(d => d.distance));
        const minElevation = Math.min(...this.elevationData.map(d => d.elevation));
        const maxElevation = Math.max(...this.elevationData.map(d => d.elevation));
        const elevationRange = maxElevation - minElevation;

        // Draw background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let i = 0; i <= 4; i++) {
            const x = padding + (chartWidth / 4) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }

        // Draw elevation profile
        if (this.elevationData.length > 1) {
            // Create gradient
            const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

            // Draw filled area
            ctx.beginPath();
            ctx.moveTo(padding, height - padding);
            
            this.elevationData.forEach((point, index) => {
                const x = padding + (point.distance / maxDistance) * chartWidth;
                const y = height - padding - ((point.elevation - minElevation) / elevationRange) * chartHeight;
                
                if (index === 0) {
                    ctx.lineTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.lineTo(width - padding, height - padding);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            // Draw elevation line
            ctx.beginPath();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            
            this.elevationData.forEach((point, index) => {
                const x = padding + (point.distance / maxDistance) * chartWidth;
                const y = height - padding - ((point.elevation - minElevation) / elevationRange) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw POI markers if available
            this.elevationData.forEach((point, index) => {
                if (point.poi) {
                    const x = padding + (point.distance / maxDistance) * chartWidth;
                    const y = height - padding - ((point.elevation - minElevation) / elevationRange) * chartHeight;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });

            // Draw media markers if provided
            if (Array.isArray(this.mediaOverlayPoints) && this.mediaOverlayPoints.length > 0) {
                this.mediaOverlayPoints.forEach(mediaPoint => {
                    const x = padding + (mediaPoint.distance / maxDistance) * chartWidth;
                    const y = height - padding - ((mediaPoint.elevation - minElevation) / elevationRange) * chartHeight;
                    // Camera-style diamond marker
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(Math.PI / 4);
                    ctx.fillStyle = '#f59e0b'; // amber
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.rect(-4, -4, 8, 8);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                });
            }
        }

        // Update distance label
        const distanceEndLabel = document.querySelector('.distance-end');
        if (distanceEndLabel) {
            distanceEndLabel.textContent = `${maxDistance.toFixed(1)} km`;
        }
    }

    updateStats() {
        if (!this.elevationData.length) return;

        let minElevation, maxElevation, totalAscent, totalDescent;
        
        // Use pre-calculated stats if available
        if (this.elevationStats && Object.keys(this.elevationStats).length > 0) {
            console.log('📊 Using pre-calculated elevation stats');
            minElevation = this.elevationStats.min_elevation;
            maxElevation = this.elevationStats.max_elevation;
            totalAscent = this.elevationStats.total_ascent || 0;
            totalDescent = this.elevationStats.total_descent || 0;
        } else {
            // Calculate stats from elevation data
            console.log('📊 Calculating elevation stats from data');
            const elevations = this.elevationData.map(d => d.elevation);
            minElevation = Math.min(...elevations);
            maxElevation = Math.max(...elevations);
            
            totalAscent = 0;
            totalDescent = 0;
            
            for (let i = 1; i < this.elevationData.length; i++) {
                const diff = this.elevationData[i].elevation - this.elevationData[i - 1].elevation;
                if (diff > 0) {
                    totalAscent += diff;
                } else {
                    totalDescent += Math.abs(diff);
                }
            }
        }

        // Update stats display
        const minElevationEl = document.getElementById('minElevation');
        const maxElevationEl = document.getElementById('maxElevation');
        const totalAscentEl = document.getElementById('totalAscent');
        const totalDescentEl = document.getElementById('totalDescent');
        
        if (minElevationEl) minElevationEl.textContent = `${minElevation}m`;
        if (maxElevationEl) maxElevationEl.textContent = `${maxElevation}m`;
        if (totalAscentEl) totalAscentEl.textContent = `+${Math.round(totalAscent)}m`;
        if (totalDescentEl) totalDescentEl.textContent = `-${Math.round(totalDescent)}m`;
    }

    handleMouseMove(e) {
        if (!this.elevationData.length || !this.isMouseOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const padding = 20;
        const chartWidth = rect.width - (padding * 2);
        const chartHeight = rect.height - (padding * 2);
        
        if (x < padding || x > rect.width - padding || y < padding || y > rect.height - padding) {
            return;
        }

        // Calculate position along route (X)
        const maxDistance = Math.max(...this.elevationData.map(d => d.distance));
        const relativeX = (x - padding) / chartWidth;
        const targetDistance = relativeX * maxDistance;

        // Find closest point to X position
        let closestPoint = null;
        let minDiff = Infinity;
        
        this.elevationData.forEach(point => {
            const diff = Math.abs(point.distance - targetDistance);
            if (diff < minDiff) {
                minDiff = diff;
                closestPoint = point;
            }
        });

        // Use graph elevation at this X (nearest point on the polyline)
        const cursorElevation = closestPoint ? Math.round(closestPoint.elevation) : null;

        // Redraw chart base and draw crosshair overlay with inline label pinned to graph line
        this.updateChart();
        this.drawCrosshair(x, cursorElevation);

        if (closestPoint) {
            this.showTooltip(e.clientX, e.clientY, closestPoint, cursorElevation);
            this.updateMapMarker(closestPoint);
        }
    }

    handleMouseLeave() {
        this.isMouseOver = false;
        this.hideTooltip();
        this.removeMapMarker();
        // Clear overlays by redrawing chart
        this.updateChart();
    }

    handleClick(e) {
        if (!this.elevationData.length) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = 20;
        const chartWidth = rect.width - (padding * 2);
        
        if (x < padding || x > rect.width - padding) return;

        // Calculate position and find closest point
        const maxDistance = Math.max(...this.elevationData.map(d => d.distance));
        const relativeX = (x - padding) / chartWidth;
        const targetDistance = relativeX * maxDistance;

        let closestPoint = null;
        let minDiff = Infinity;
        
        this.elevationData.forEach(point => {
            const diff = Math.abs(point.distance - targetDistance);
            if (diff < minDiff) {
                minDiff = diff;
                closestPoint = point;
            }
        });

        if (closestPoint && this.map) {
            // Center map on clicked position
            this.map.setView([closestPoint.lat, closestPoint.lng], this.map.getZoom());
            
            // Show popup if POI exists
            if (closestPoint.poi) {
                const popup = L.popup()
                    .setLatLng([closestPoint.lat, closestPoint.lng])
                    .setContent(`
                        <div class="elevation-poi-popup">
                            <h6>${closestPoint.poi.name}</h6>
                            <p><strong>Yükseklik:</strong> ${closestPoint.elevation}m</p>
                            <p><strong>Mesafe:</strong> ${closestPoint.distance.toFixed(1)}km</p>
                        </div>
                    `)
                    .openOn(this.map);
            }
        }
    }

    showTooltip(x, y, point, cursorElevation) {
        const tooltip = document.getElementById('elevationTooltip');
        if (!tooltip) return;

        const cursorLine = typeof cursorElevation === 'number' 
            ? `<br><span style="opacity:.8">İmleç: ${cursorElevation}m</span>` 
            : '';
        const content = point.poi 
            ? `<strong>${point.poi.name}</strong><br>Yükseklik: ${point.elevation}m<br>Mesafe: ${point.distance.toFixed(1)}km${cursorLine}`
            : `Yükseklik: ${point.elevation}m<br>Mesafe: ${point.distance.toFixed(1)}km${cursorLine}`;

        tooltip.innerHTML = content;
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${y - 10}px`;
        tooltip.classList.add('show');
    }

    drawCrosshair(x, cursorElevation) {
        const rect = this.canvas.getBoundingClientRect();
        const padding = 20;
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, rect.height - padding);
        ctx.stroke();
        // Horizontal line aligned with graph elevation (if available)
        let yGraph = null;
        if (typeof cursorElevation === 'number') {
            const elevations = this.elevationData.map(d => d.elevation);
            const minElevation = Math.min(...elevations);
            const maxElevation = Math.max(...elevations);
            const elevationRange = Math.max(1, maxElevation - minElevation);
            const chartHeight = rect.height - (padding * 2);
            yGraph = rect.height - padding - ((cursorElevation - minElevation) / elevationRange) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding, yGraph);
            ctx.lineTo(rect.width - padding, yGraph);
            ctx.stroke();
        }

        // Inline elevation label next to cursor (always over the graph)
        if (typeof cursorElevation === 'number') {
            const label = `${cursorElevation} m`;
            ctx.setLineDash([]);
            ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
            const textMetrics = ctx.measureText(label);
            const textWidth = Math.ceil(textMetrics.width);
            const textHeight = 16; // approx
            const boxPaddingX = 6;
            const boxPaddingY = 4;
            let boxX = x + 8;
            const desiredY = (yGraph !== null ? yGraph : rect.height / 2);
            let boxY = desiredY - (textHeight + 8);
            const boxW = textWidth + boxPaddingX * 2;
            const boxH = textHeight + boxPaddingY * 2;

            // Keep label inside chart area
            if (boxX + boxW > rect.width - padding) boxX = x - boxW - 8;
            if (boxX < padding) boxX = padding;
            if (boxY < padding) boxY = desiredY + 8;
            if (boxY + boxH > rect.height - padding) boxY = rect.height - padding - boxH;

            // Draw background box with halo to stay visible over graph
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, boxX + boxPaddingX, boxY + boxH / 2);
        }
        ctx.restore();
    }

    hideTooltip() {
        const tooltip = document.getElementById('elevationTooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    /**
     * Provide media items with coordinates to be shown as markers over the chart.
     * Each item should have {lat, lng, ...}
     */
    setMediaMarkers(mediaItems) {
        if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
            this.mediaOverlayPoints = [];
            this.updateChart();
            return;
        }

        // If elevation data is not ready yet, defer processing
        if (!this.elevationData || this.elevationData.length === 0) {
            this.pendingMediaMarkers = mediaItems;
            return;
        }

        const overlay = [];
        mediaItems.forEach(item => {
            const lat = parseFloat(item.lat ?? item.latitude);
            const lng = parseFloat(item.lng ?? item.longitude ?? item.lon);
            if (isNaN(lat) || isNaN(lng)) return;

            const closest = this.findClosestElevationPoint(lat, lng);
            if (closest) {
                overlay.push({
                    lat: lat,
                    lng: lng,
                    elevation: closest.elevation,
                    distance: closest.distance,
                    media: item
                });
            }
        });

        this.mediaOverlayPoints = overlay;
        this.updateChart();
    }

    findClosestElevationPoint(lat, lng) {
        if (!this.elevationData || this.elevationData.length === 0) return null;
        let min = Infinity;
        let closest = null;
        for (const p of this.elevationData) {
            const d = this.calculateDistance(lat, lng, p.lat, p.lng);
            if (d < min) {
                min = d;
                closest = p;
            }
        }
        return closest;
    }

    updateMapMarker(point) {
        if (!this.map) return;

        this.removeMapMarker();

        this.mapMarker = L.circleMarker([point.lat, point.lng], {
            radius: 6,
            fillColor: '#3b82f6',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            className: 'elevation-position-marker'
        }).addTo(this.map);
    }

    removeMapMarker() {
        if (this.mapMarker && this.map) {
            this.map.removeLayer(this.mapMarker);
            this.mapMarker = null;
        }
    }

    showChart() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.classList.remove('elevation-chart-hidden');
        }
    }

    hideChart() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.classList.add('elevation-chart-hidden');
        }
    }

    destroy() {
        this.removeMapMarker();
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mouseenter', () => this.isMouseOver = true);
            this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
            this.canvas.removeEventListener('click', this.handleClick);
        }
    }
}

// Export for global use
window.ElevationChart = ElevationChart;