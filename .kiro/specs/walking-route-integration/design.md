# Walking Route Integration - Design Document

## Overview

Bu tasarım, POI öneri sisteminde gerçek yürüyüş yolları kullanarak rota hesaplama özelliğinin teknik implementasyonunu detaylandırır. Sistem OSMnx ve NetworkX kütüphanelerini kullanarak Ürgüp bölgesindeki sokaklar ve yürüyüş yolları üzerinden optimal rotalar hesaplayacak.

## Architecture

### High-Level Architecture

```
Frontend (JavaScript)          Backend (Flask)              External APIs
┌─────────────────────┐        ┌──────────────────────┐     ┌─────────────────┐
│ POI Recommendation  │        │ Walking Route API    │     │ OpenStreetMap   │
│ System              │◄──────►│ /api/route/walking   │◄───►│ Overpass API    │
│                     │        │                      │     │                 │
│ - Route Display     │        │ OSMnx Integration    │     └─────────────────┘
│ - User Interface    │        │ NetworkX Routing     │
│ - Error Handling    │        │ Cache Management     │
└─────────────────────┘        └──────────────────────┘
```

### Component Architecture

```
Walking Route System
├── Route Calculator
│   ├── OSMnx Network Downloader
│   ├── NetworkX Path Finder
│   └── Distance Calculator
├── Cache Manager
│   ├── Network Cache
│   ├── Route Cache
│   └── Cleanup Service
├── Fallback Handler
│   ├── Direct Line Calculator
│   ├── Error Recovery
│   └── User Notification
└── API Interface
    ├── Request Validator
    ├── Response Formatter
    └── Error Handler
```

## Components and Interfaces

### 1. OSMnx Network Manager

```python
class OSMnxNetworkManager:
    def __init__(self):
        self.cache_dir = "cache/osmnx_networks"
        self.cache_timeout = 24 * 3600  # 24 hours
        
    def get_walking_network(self, bbox):
        """Download or load cached walking network for bounding box"""
        
    def is_cache_valid(self, cache_file):
        """Check if cached network is still valid"""
        
    def download_network(self, north, south, east, west):
        """Download walking network from OSM"""
```

### 2. Route Calculator

```python
class WalkingRouteCalculator:
    def __init__(self, network_manager):
        self.network_manager = network_manager
        
    def calculate_route(self, waypoints):
        """Calculate walking route between waypoints"""
        
    def find_shortest_path(self, graph, start_node, end_node):
        """Find shortest path using NetworkX"""
        
    def get_route_coordinates(self, graph, route_nodes):
        """Convert route nodes to lat/lng coordinates"""
```

### 3. Cache Management

```python
class RouteCacheManager:
    def __init__(self):
        self.cache_dir = "cache/routes"
        self.max_cache_size = 100  # MB
        
    def get_cached_route(self, waypoints_hash):
        """Get cached route if available"""
        
    def cache_route(self, waypoints_hash, route_data):
        """Cache calculated route"""
        
    def cleanup_old_cache(self):
        """Remove old cache files"""
```

### 4. API Endpoint Design

```python
@app.route('/api/route/walking', methods=['POST'])
def create_walking_route():
    """
    Request Format:
    {
        "waypoints": [
            {"lat": 38.632, "lng": 34.912, "name": "Start"},
            {"lat": 38.634, "lng": 34.915, "name": "POI 1"}
        ]
    }
    
    Response Format:
    {
        "success": true,
        "route": {
            "segments": [
                {
                    "coordinates": [{"lat": 38.632, "lng": 34.912}, ...],
                    "distance": 0.5,
                    "from": "Start",
                    "to": "POI 1",
                    "fallback": false
                }
            ],
            "total_distance": 2.3,
            "estimated_time": 28,
            "waypoint_count": 3,
            "network_type": "walking"
        }
    }
    """
```

## Data Models

### Network Cache Model

```python
@dataclass
class NetworkCache:
    bbox: Tuple[float, float, float, float]  # north, south, east, west
    file_path: str
    created_at: datetime
    size_mb: float
    node_count: int
    edge_count: int
```

### Route Segment Model

```python
@dataclass
class RouteSegment:
    coordinates: List[Dict[str, float]]
    distance_km: float
    from_name: str
    to_name: str
    is_fallback: bool
    estimated_time_minutes: int
```

### Route Response Model

```python
@dataclass
class WalkingRoute:
    segments: List[RouteSegment]
    total_distance_km: float
    estimated_time_minutes: int
    waypoint_count: int
    network_type: str  # "walking" or "direct"
    warning: Optional[str]
```

## Error Handling

### Error Types and Responses

1. **OSMnx Import Error**
   ```python
   {
       "success": false,
       "error": "OSMnx not available",
       "fallback": "direct_routes",
       "message": "Using direct line connections"
   }
   ```

2. **Network Download Error**
   ```python
   {
       "success": true,
       "route": {...},
       "warning": "Walking network not available, using direct routes"
   }
   ```

3. **Route Calculation Error**
   ```python
   {
       "success": false,
       "error": "Route calculation failed",
       "details": "No path found between waypoints"
   }
   ```

### Fallback Strategy

```
Route Request
     ↓
Try OSMnx Network
     ↓
Network Available? ──No──→ Direct Line Fallback
     ↓ Yes
Calculate Walking Route
     ↓
Route Found? ──No──→ Direct Line Fallback
     ↓ Yes
Return Walking Route
```

## Testing Strategy

### Unit Tests

1. **OSMnx Network Manager Tests**
   - Network download functionality
   - Cache validation
   - Bounding box calculations

2. **Route Calculator Tests**
   - Shortest path calculation
   - Coordinate conversion
   - Error handling

3. **Cache Manager Tests**
   - Cache storage and retrieval
   - Cache expiration
   - Cleanup functionality

### Integration Tests

1. **API Endpoint Tests**
   - Valid waypoint requests
   - Invalid input handling
   - Response format validation

2. **End-to-End Tests**
   - Complete route calculation flow
   - Fallback mechanism testing
   - Performance benchmarks

### Performance Tests

1. **Network Download Performance**
   - Download time for Ürgüp region
   - Cache hit/miss ratios
   - Memory usage monitoring

2. **Route Calculation Performance**
   - Calculation time for various waypoint counts
   - Memory usage during calculation
   - Concurrent request handling

## Implementation Plan

### Phase 1: Core Infrastructure
- OSMnx integration setup
- Basic network download functionality
- Cache management system

### Phase 2: Route Calculation
- NetworkX shortest path implementation
- Coordinate conversion utilities
- Basic API endpoint

### Phase 3: Error Handling & Fallback
- Comprehensive error handling
- Direct line fallback implementation
- User notification system

### Phase 4: Optimization & Caching
- Route caching implementation
- Performance optimizations
- Cache cleanup automation

### Phase 5: Testing & Documentation
- Comprehensive test suite
- Performance benchmarking
- User documentation

## Configuration

### Environment Variables

```bash
# OSMnx Configuration
OSMNX_CACHE_DIR=cache/osmnx_networks
OSMNX_CACHE_TIMEOUT=86400  # 24 hours
OSMNX_DOWNLOAD_TIMEOUT=30  # 30 seconds

# Route Configuration
ROUTE_CACHE_DIR=cache/routes
ROUTE_CACHE_SIZE_MB=100
ROUTE_CALCULATION_TIMEOUT=10  # 10 seconds

# Ürgüp Bounding Box
URGUP_BBOX_NORTH=38.65
URGUP_BBOX_SOUTH=38.61
URGUP_BBOX_EAST=34.93
URGUP_BBOX_WEST=34.89
```

### Dependencies

```txt
osmnx>=1.6.0
networkx>=3.0
geopandas>=0.13.0
shapely>=2.0.0
requests>=2.28.0
```

## Security Considerations

1. **Input Validation**
   - Waypoint coordinate validation
   - Bounding box limits
   - Request rate limiting

2. **Cache Security**
   - Secure cache directory permissions
   - Cache file integrity checks
   - Automatic cleanup of sensitive data

3. **External API Security**
   - OSM API rate limiting compliance
   - Error message sanitization
   - Timeout configurations

## Monitoring and Logging

### Metrics to Track

1. **Performance Metrics**
   - Route calculation time
   - Network download time
   - Cache hit ratio
   - API response time

2. **Error Metrics**
   - OSMnx import failures
   - Network download failures
   - Route calculation failures
   - Fallback usage rate

3. **Usage Metrics**
   - Route requests per hour
   - Average waypoint count
   - Most requested areas
   - User satisfaction (route quality)

### Logging Strategy

```python
import logging

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Log examples
logger.info("Network download started", extra={
    "bbox": bbox,
    "cache_available": cache_exists
})

logger.error("Route calculation failed", extra={
    "waypoints": waypoint_count,
    "error": str(exception)
})
```