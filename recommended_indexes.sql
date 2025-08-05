-- Recommended Database Indexes for Route System

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_active ON routes(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_type_active ON routes(route_type, is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_difficulty ON routes(difficulty_level) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_duration ON routes(estimated_duration) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_distance ON routes(total_distance) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_tags ON routes USING gin(to_tsvector('english', tags)) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_pois_route_id ON route_pois(route_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_pois_poi_id ON route_pois(poi_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_pois_order ON route_pois(route_id, order_in_route);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_ratings_route_id ON route_ratings(route_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_ratings_category ON route_ratings(category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pois_location ON pois USING gist(location);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pois_category ON pois(category);
