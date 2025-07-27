# Design Document

## Overview

Bu tasarım, mevcut POI öneri sistemine gelişmiş rota detayları ekler. Kullanıcılar rota çizgisine tıkladığında açılan detay panelinde elevation profili, durak listesi ve gelişmiş Google Maps entegrasyonu görecekler.

## Architecture

### Component Structure
```
RouteDetailsPanel
├── RouteHeader (Özet bilgiler)
├── ElevationProfile (Yükseklik grafiği)
├── StopsList (Durak listesi)
└── ExportActions (Google Maps aktarım)
```

### Integration Points
- Mevcut `createRoute()` fonksiyonu ile entegrasyon
- Leaflet harita click event'leri
- Google Maps URL API'si
- Open Elevation API (mevcut)

## Components and Interfaces

### 1. RouteDetailsPanel Class

```javascript
class RouteDetailsPanel {
    constructor(mapContainer) {
        this.panel = null;
        this.currentRoute = null;
        this.elevationData = [];
    }

    show(routeData) {
        // Panel'i göster ve veri yükle
    }

    hide() {
        // Panel'i gizle
    }

    loadElevationProfile(waypoints) {
        // Elevation verilerini yükle ve grafik oluştur
    }

    renderStopsList(stops) {
        // Durak listesini render et
    }
}
```

### 2. ElevationProfile Component

```javascript
class ElevationProfile {
    constructor(container) {
        this.container = container;
        this.chart = null;
    }

    render(elevationData) {
        // Chart.js ile elevation profili çiz
    }

    calculateStats(data) {
        // Min, max, ortalama, toplam yükselme/alçalma hesapla
    }
}
```

### 3. Enhanced Google Maps Export

```javascript
function exportToGoogleMaps(routeData) {
    const origin = routeData.start;
    const destination = routeData.waypoints[routeData.waypoints.length - 1];
    const waypoints = routeData.waypoints.slice(0, -1);
    
    const url = `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${waypoints.map(w => `${w.lat},${w.lng}`).join('/')}/${destination.lat},${destination.lng}`;
    
    window.open(url, '_blank');
}
```

## User Interface Design

### Route Details Panel Layout
```html
<div class="route-details-panel">
    <div class="route-header">
        <h3>Rota Detayları</h3>
        <button class="close-btn">×</button>
    </div>
    
    <div class="route-summary">
        <div class="summary-item">
            <i class="fas fa-route"></i>
            <span>12.5 km</span>
        </div>
        <div class="summary-item">
            <i class="fas fa-clock"></i>
            <span>2.5 saat</span>
        </div>
        <div class="summary-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>5 durak</span>
        </div>
    </div>
    
    <div class="elevation-section">
        <h4>Yükseklik Profili</h4>
        <canvas id="elevationChart"></canvas>
        <div class="elevation-stats">
            <span>Min: 1050m</span>
            <span>Max: 1250m</span>
            <span>↗ +180m</span>
            <span>↘ -120m</span>
        </div>
    </div>
    
    <div class="stops-section">
        <h4>Duraklar</h4>
        <div class="stops-list">
            <!-- Durak listesi buraya -->
        </div>
    </div>
    
    <div class="export-section">
        <button class="export-btn google-maps">
            <i class="fab fa-google"></i>
            Google Maps'e Aktar
        </button>
    </div>
</div>
```

### CSS Design System

#### Panel Styling
```css
.route-details-panel {
    position: fixed;
    right: 20px;
    top: 20px;
    width: 350px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    overflow-y: auto;
    z-index: 1000;
}

.elevation-section canvas {
    width: 100%;
    height: 200px;
    margin: 10px 0;
}

.stops-list {
    max-height: 300px;
    overflow-y: auto;
}

.stop-item {
    display: flex;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background 0.2s;
}

.stop-item:hover {
    background: #f8f9fa;
}
```

## Data Models

### Route Data Model
```javascript
const RouteData = {
    id: 'route_123',
    start: {
        lat: 38.6288,
        lng: 34.9199,
        name: 'Başlangıç Noktası'
    },
    waypoints: [
        {
            lat: 38.6341,
            lng: 34.9103,
            name: 'AJWA Cappadocia',
            category: 'konaklama',
            icon: '🏨'
        }
    ],
    distance: 12500, // meters
    duration: 9000, // seconds
    elevationData: [
        { distance: 0, elevation: 1050 },
        { distance: 100, elevation: 1055 },
        // ...
    ],
    routeType: 'walking' // or 'driving'
};
```

### Elevation Stats Model
```javascript
const ElevationStats = {
    minElevation: 1050,
    maxElevation: 1250,
    avgElevation: 1150,
    totalAscent: 180,
    totalDescent: 120,
    elevationGain: 60
};
```

## Implementation Strategy

### Phase 1: Panel Infrastructure
1. Route click detection
2. Basic panel HTML/CSS
3. Show/hide functionality

### Phase 2: Elevation Profile
1. Chart.js integration
2. Elevation data collection
3. Statistics calculation
4. Interactive chart features

### Phase 3: Stops List
1. Stop rendering
2. Click-to-highlight functionality
3. Category icons and styling

### Phase 4: Google Maps Integration
1. Enhanced URL generation
2. Single-route export
3. Waypoint optimization

## Technical Implementation

### Route Click Detection
```javascript
// Rota çizgisine click event ekle
routeLayer.on('click', function(e) {
    const routeData = this.routeData;
    RouteDetailsPanel.show(routeData);
});
```

### Elevation Data Collection
```javascript
async function collectElevationData(waypoints) {
    const elevationPromises = waypoints.map(async (point, index) => {
        const elevation = await getElevation(point.lat, point.lng);
        return {
            distance: calculateDistance(waypoints[0], point),
            elevation: elevation,
            pointIndex: index
        };
    });
    
    return Promise.all(elevationPromises);
}
```

### Chart.js Integration
```javascript
function createElevationChart(data) {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => `${(d.distance / 1000).toFixed(1)}km`),
            datasets: [{
                label: 'Yükseklik (m)',
                data: data.map(d => d.elevation),
                borderColor: '#4285f4',
                backgroundColor: 'rgba(66, 133, 244, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Yükseklik (m)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mesafe (km)'
                    }
                }
            }
        }
    });
}
```

### Enhanced Google Maps Export
```javascript
function exportFullRouteToGoogleMaps() {
    if (selectedPOIs.length === 0) {
        showNotification('❌ Önce POI seçin', 'error');
        return;
    }

    let waypoints = [];

    // Başlangıç noktası
    if (startLocation) {
        waypoints.push(`${startLocation.latitude},${startLocation.longitude}`);
    }

    // Tüm POI'ler
    selectedPOIs.forEach(poi => {
        waypoints.push(`${poi.latitude},${poi.longitude}`);
    });

    if (waypoints.length < 2) {
        showNotification('❌ En az 2 nokta gerekli', 'error');
        return;
    }

    // Google Maps directions URL - tüm rota tek seferde
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);

    let url = `https://www.google.com/maps/dir/${origin}`;
    
    // Ara durakları ekle
    intermediateWaypoints.forEach(waypoint => {
        url += `/${waypoint}`;
    });
    
    // Son durağı ekle
    url += `/${destination}`;

    // Yeni sekmede aç
    window.open(url, '_blank');
    
    showNotification('✅ Google Maps\'te açılıyor...', 'success');
}
```

## Performance Considerations

### Elevation Data Caching
- Elevation verilerini localStorage'da cache'le
- Aynı koordinatlar için tekrar API çağrısı yapma

### Chart Rendering Optimization
- Chart.js lazy loading
- Data point optimization (çok fazla nokta varsa örnekle)

### Panel State Management
- Tek seferde bir panel açık tut
- Memory leak'leri önlemek için event listener'ları temizle

## Error Handling

### Elevation API Failures
- Fallback elevation değerleri kullan
- Kullanıcıya bilgi ver ama işlemi durdurma

### Chart Rendering Errors
- Chart.js yüklenemezse basit tablo göster
- Graceful degradation

### Google Maps Export Errors
- URL uzunluk limitlerini kontrol et
- Çok fazla waypoint varsa optimize et

## Testing Strategy

### Unit Tests
1. Elevation data calculation
2. Statistics computation
3. URL generation logic

### Integration Tests
1. Panel show/hide functionality
2. Chart rendering
3. Google Maps integration

### User Experience Tests
1. Panel responsiveness
2. Chart interactivity
3. Export functionality