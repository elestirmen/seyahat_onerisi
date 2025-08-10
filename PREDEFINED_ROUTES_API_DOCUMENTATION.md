# Predefined Routes System API Documentation

## Overview

The Predefined Routes System extends the existing POI recommendation system with pre-defined routes created by administrators. This system provides both public endpoints for tourists to browse and select routes, and admin endpoints for route management.

## Table of Contents

1. [Authentication](#authentication)
2. [Public API Endpoints](#public-api-endpoints)
3. [Admin API Endpoints](#admin-api-endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Performance Features](#performance-features)

## Authentication

Admin endpoints require authentication using the existing POI system authentication middleware.

### Authentication Headers
```
Authorization: Bearer <session_token>
X-CSRF-Token: <csrf_token>
```

## Public API Endpoints

### Get All Routes
Get all active predefined routes with optional pagination and filtering.

**Endpoint:** `GET /api/routes`

**Parameters:**
- `page` (optional): Page number (default: 0)
- `limit` (optional): Items per page (default: 20, max: 100)
- `route_type` (optional): Filter by route type (walking, hiking, cycling, driving)
- `difficulty_min` (optional): Minimum difficulty level (1-5)
- `difficulty_max` (optional): Maximum difficulty level (1-5)

**Example Request:**
```bash
GET /api/routes?page=0&limit=10&route_type=walking&difficulty_min=1&difficulty_max=3
```

**Response:**
```json
{
  "success": true,
  "routes": [
    {
      "id": 1,
      "name": "Kapadokya Yürüyüş Rotası",
      "description": "Güzel manzaralı yürüyüş rotası",
      "route_type": "walking",
      "difficulty_level": 2,
      "estimated_duration": 120,
      "total_distance": 5.5,
      "elevation_gain": 200,
      "is_circular": true,
      "season_availability": ["spring", "summer", "autumn"],
      "tags": "scenic, historical",
      "poi_count": 4,
      "ratings": {
        "scenic_beauty": 5,
        "family_friendly": 4,
        "historical": 3
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "page": 0,
  "limit": 10,
  "has_more": true
}
```

### Get Route Details
Get detailed information about a specific route including POIs.

**Endpoint:** `GET /api/routes/{route_id}`

**Example Request:**
```bash
GET /api/routes/1
```

**Response:**
```json
{
  "success": true,
  "route": {
    "id": 1,
    "name": "Kapadokya Yürüyüş Rotası",
    "description": "Güzel manzaralı yürüyüş rotası",
    "route_type": "walking",
    "difficulty_level": 2,
    "estimated_duration": 120,
    "total_distance": 5.5,
    "elevation_gain": 200,
    "is_circular": true,
    "season_availability": ["spring", "summer", "autumn"],
    "tags": "scenic, historical",
    "ratings": {
      "scenic_beauty": 5,
      "family_friendly": 4,
      "historical": 3
    },
    "pois": [
      {
        "poi_id": 1,
        "name": "Başlangıç Noktası",
        "order_in_route": 1,
        "is_mandatory": true,
        "estimated_time_at_poi": 30,
        "notes": "Rota başlangıç noktası",
        "lat": 38.7,
        "lon": 34.8,
        "category": "landmark",
        "description": "Rota başlangıç noktası"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Search Routes
Search routes by name, description, or tags.

**Endpoint:** `GET /api/routes/search`

**Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 0)
- `limit` (optional): Items per page (default: 20)

**Example Request:**
```bash
GET /api/routes/search?q=kapadokya&page=0&limit=10
```

**Response:**
```json
{
  "success": true,
  "routes": [...],
  "total": 5,
  "page": 0,
  "limit": 10,
  "has_more": false,
  "query": "kapadokya"
}
```

## Admin API Endpoints

All admin endpoints require authentication and are rate-limited.

### Get Admin Routes
Get all routes for admin management.

**Endpoint:** `GET /api/admin/routes`

**Response:** Same format as public routes endpoint but includes inactive routes.

### Create Route
Create a new route.

**Endpoint:** `POST /api/admin/routes`

**Request Body:**
```json
{
  "name": "Yeni Rota",
  "description": "Rota açıklaması",
  "route_type": "walking",
  "difficulty_level": 2,
  "estimated_duration": 120,
  "total_distance": 5.5,
  "elevation_gain": 200,
  "is_circular": true,
  "season_availability": ["spring", "summer", "autumn", "winter"],
  "tags": "scenic, family-friendly",
  "ratings": {
    "scenic_beauty": 4,
    "family_friendly": 5,
    "historical": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "route_id": 15,
  "message": "Route created successfully"
}
```

### Update Route
Update an existing route.

**Endpoint:** `PUT /api/admin/routes/{route_id}`

**Request Body:** Same as create route (partial updates supported)

**Response:**
```json
{
  "success": true,
  "message": "Route updated successfully"
}
```

### Delete Route
Delete a route (soft delete).

**Endpoint:** `DELETE /api/admin/routes/{route_id}`

**Response:**
```json
{
  "success": true,
  "message": "Route deleted successfully"
}
```

### Associate POIs with Route
Associate POIs with a route.

**Endpoint:** `POST /api/admin/routes/{route_id}/pois`

**Request Body:**
```json
{
  "pois": [
    {
      "poi_id": 1,
      "order_in_route": 1,
      "is_mandatory": true,
      "estimated_time_at_poi": 30,
      "notes": "Başlangıç noktası"
    },
    {
      "poi_id": 2,
      "order_in_route": 2,
      "is_mandatory": false,
      "estimated_time_at_poi": 20,
      "notes": "İsteğe bağlı mola"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "POIs associated successfully"
}
```

### Get Route Statistics
Get system-wide route statistics.

**Endpoint:** `GET /api/admin/routes/statistics`

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_routes": 25,
    "active_routes": 23,
    "walking_routes": 15,
    "hiking_routes": 5,
    "cycling_routes": 3,
    "driving_routes": 2,
    "avg_difficulty": 2.4,
    "avg_duration": 135.5,
    "avg_distance": 6.2
  }
}
```

## Data Models

### Route Model
```typescript
interface Route {
  id: number;
  name: string;
  description: string;
  route_type: 'walking' | 'hiking' | 'cycling' | 'driving';
  difficulty_level: number; // 1-5
  estimated_duration: number; // minutes
  total_distance: number; // kilometers
  elevation_gain?: number; // meters
  is_circular: boolean;
  season_availability: string[]; // ['spring', 'summer', 'autumn', 'winter']
  tags: string;
  is_active: boolean;
  poi_count?: number;
  ratings: {
    [category: string]: number; // 1-5
  };
  pois?: RoutePOI[];
  created_at: string;
  updated_at: string;
}
```

### Route POI Model
```typescript
interface RoutePOI {
  poi_id: number;
  name: string;
  order_in_route: number;
  is_mandatory: boolean;
  estimated_time_at_poi: number; // minutes
  notes: string;
  lat: number;
  lon: number;
  category: string;
  description: string;
}
```

### Filter Model
```typescript
interface RouteFilters {
  route_type?: string;
  difficulty_level?: {
    min?: number;
    max?: number;
  };
  duration?: {
    min?: number; // minutes
    max?: number;
  };
  distance?: {
    min?: number; // kilometers
    max?: number;
  };
  tags?: string[];
  season?: string;
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `ROUTE_NOT_FOUND`: Route with specified ID not found
- `INVALID_PARAMETERS`: Invalid request parameters
- `AUTHENTICATION_REQUIRED`: Authentication required for admin endpoints
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `DATABASE_ERROR`: Database operation failed
- `VALIDATION_ERROR`: Data validation failed

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (route not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting

### Public Endpoints
- General endpoints: 100 requests per minute
- Search endpoints: 50 requests per minute

### Admin Endpoints
- General admin operations: 50 requests per minute
- Route details/POI operations: 100 requests per minute
- Statistics: 20 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Performance Features

### Caching
- Route data is cached for 5 minutes (300 seconds)
- Route details are cached for 10 minutes (600 seconds)
- Cache is automatically invalidated when routes are modified

### Pagination
- Default page size: 20 items
- Maximum page size: 100 items
- Efficient database queries with LIMIT/OFFSET

### Database Optimizations
- Optimized SQL queries with proper JOINs
- Database indexes on frequently queried columns
- Batch operations for POI associations

### Frontend Optimizations
- Lazy loading for images
- Debounced search (300ms delay)
- Intersection Observer for smooth scrolling
- Performance monitoring and metrics

## Usage Examples

### JavaScript Client Example
```javascript
// Get routes with pagination
async function loadRoutes(page = 0, filters = {}) {
  const params = new URLSearchParams({
    page: page,
    limit: 20,
    ...filters
  });
  
  const response = await fetch(`/api/routes?${params}`);
  const data = await response.json();
  
  if (data.success) {
    return data;
  } else {
    throw new Error(data.error);
  }
}

// Get route details
async function getRouteDetails(routeId) {
  const response = await fetch(`/api/routes/${routeId}`);
  const data = await response.json();
  
  if (data.success) {
    return data.route;
  } else {
    throw new Error(data.error);
  }
}

// Search routes
async function searchRoutes(query, page = 0) {
  const params = new URLSearchParams({
    q: query,
    page: page,
    limit: 20
  });
  
  const response = await fetch(`/api/routes/search?${params}`);
  const data = await response.json();
  
  if (data.success) {
    return data;
  } else {
    throw new Error(data.error);
  }
}
```

### Admin Operations Example
```javascript
// Create a new route (requires authentication)
async function createRoute(routeData) {
  const response = await fetch('/api/admin/routes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken()
    },
    body: JSON.stringify(routeData),
    credentials: 'same-origin'
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.route_id;
  } else {
    throw new Error(data.error);
  }
}

// Associate POIs with route
async function associatePOIs(routeId, pois) {
  const response = await fetch(`/api/admin/routes/${routeId}/pois`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken()
    },
    body: JSON.stringify({ pois }),
    credentials: 'same-origin'
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
}
```

## Migration and Compatibility

The Predefined Routes System is designed to be fully compatible with the existing POI system:

- Existing POI functionality remains unchanged
- Database schema extends existing tables without modifications
- Frontend integration uses tabs to separate dynamic and predefined routes
- All existing API endpoints continue to work

## Security Considerations

- Admin endpoints require proper authentication
- CSRF protection for all state-changing operations
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- Rate limiting to prevent abuse
- Secure session management

## Monitoring and Logging

The system includes comprehensive logging and monitoring:

- Performance metrics for database queries
- Cache hit/miss ratios
- API response times
- Error tracking and reporting
- Rate limiting statistics

For production deployment, consider integrating with monitoring tools like:
- Application Performance Monitoring (APM)
- Log aggregation systems
- Database performance monitoring
- Frontend performance monitoring