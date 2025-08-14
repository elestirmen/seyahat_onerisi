"""
Route Planning Service for POI Travel Recommendation API.
Handles route calculation, optimization, and navigation between POIs.
"""

import math
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from app.middleware.error_handler import APIError, bad_request, internal_error

logger = logging.getLogger(__name__)


class RoutePlanningService:
    """Service class for route planning and calculation operations."""
    
    def __init__(self):
        self.urgup_center_bounds = {
            'north': 38.637,
            'south': 38.615,
            'east': 34.923,
            'west': 34.897
        }
        self.walking_speed_kmh = 5  # km/h
        self.driving_speed_kmh = 40  # km/h in city
        self.max_walking_distance_km = 5  # Maximum walking distance
    
    def create_route(self, waypoints: List[Dict[str, Any]], 
                    route_type: str = 'smart') -> Dict[str, Any]:
        """
        Create route between waypoints.
        
        Args:
            waypoints: List of waypoint dictionaries with lat, lng, name
            route_type: Route type ('walking', 'driving', 'smart')
            
        Returns:
            Route data with coordinates, distance, duration, instructions
        """
        try:
            if len(waypoints) < 2:
                raise bad_request("At least 2 waypoints required")
            
            # Validate waypoints
            for i, wp in enumerate(waypoints):
                if 'lat' not in wp or 'lng' not in wp:
                    raise bad_request(f"Waypoint {i+1} missing lat/lng coordinates")
                
                try:
                    lat, lng = float(wp['lat']), float(wp['lng'])
                    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                        raise ValueError("Invalid coordinates")
                except (ValueError, TypeError):
                    raise bad_request(f"Invalid coordinates for waypoint {i+1}")
            
            # Determine route type
            if route_type == 'smart':
                route_type = self._determine_optimal_route_type(waypoints)
            
            # Calculate route based on type
            if route_type == 'walking':
                return self._create_walking_route(waypoints)
            elif route_type == 'driving':
                return self._create_driving_route(waypoints)
            else:
                raise bad_request(f"Unsupported route type: {route_type}")
                
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Route creation error: {e}")
            raise APIError("Failed to create route", "ROUTE_CREATE_ERROR", 500)
    
    def create_walking_route(self, waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create walking route between waypoints.
        
        Args:
            waypoints: List of waypoint dictionaries
            
        Returns:
            Walking route data
        """
        try:
            # Try OSMnx-based routing first
            try:
                return self._create_osmnx_walking_route(waypoints)
            except Exception as osmnx_error:
                logger.warning(f"OSMnx walking route failed: {osmnx_error}")
                # Fallback to simple routing
                return self._create_simple_route(waypoints, 'walking')
                
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Walking route error: {e}")
            raise APIError("Failed to create walking route", "WALKING_ROUTE_ERROR", 500)
    
    def create_driving_route(self, waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create driving route between waypoints.
        
        Args:
            waypoints: List of waypoint dictionaries
            
        Returns:
            Driving route data
        """
        try:
            # Try OSMnx-based routing first
            try:
                return self._create_osmnx_driving_route(waypoints)
            except Exception as osmnx_error:
                logger.warning(f"OSMnx driving route failed: {osmnx_error}")
                # Fallback to simple routing
                return self._create_simple_route(waypoints, 'driving')
                
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Driving route error: {e}")
            raise APIError("Failed to create driving route", "DRIVING_ROUTE_ERROR", 500)
    
    def optimize_route(self, waypoints: List[Dict[str, Any]], 
                      start_point: Dict[str, Any] = None,
                      end_point: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Optimize route order using traveling salesman approach.
        
        Args:
            waypoints: List of POI waypoints to visit
            start_point: Fixed starting point (optional)
            end_point: Fixed ending point (optional)
            
        Returns:
            Optimized waypoint order
        """
        try:
            if len(waypoints) <= 2:
                return waypoints
            
            # For small number of waypoints, use simple nearest neighbor
            if len(waypoints) <= 10:
                return self._nearest_neighbor_optimization(waypoints, start_point, end_point)
            else:
                # For larger sets, use a more sophisticated approach
                return self._genetic_algorithm_optimization(waypoints, start_point, end_point)
                
        except Exception as e:
            logger.error(f"Route optimization error: {e}")
            # Return original order on error
            return waypoints
    
    def calculate_route_statistics(self, route_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate comprehensive route statistics.
        
        Args:
            route_data: Route data from create_route
            
        Returns:
            Route statistics
        """
        try:
            stats = {
                'total_distance_km': 0,
                'total_duration_minutes': 0,
                'waypoint_count': 0,
                'segment_count': 0,
                'route_type': route_data.get('network_type', 'unknown'),
                'estimated_cost': {
                    'walking': {'calories': 0, 'time_minutes': 0},
                    'driving': {'fuel_liters': 0, 'time_minutes': 0}
                },
                'difficulty': 'unknown',
                'poi_categories': []
            }
            
            # Extract route information
            if 'route' in route_data:
                route = route_data['route']
                stats['total_distance_km'] = route.get('total_distance', 0)
                stats['total_duration_minutes'] = route.get('estimated_time', 0)
                stats['waypoint_count'] = route.get('waypoint_count', 0)
                
                if 'segments' in route:
                    stats['segment_count'] = len(route['segments'])
            
            # Calculate costs based on route type
            if stats['route_type'] == 'walking':
                # Walking costs
                distance_km = stats['total_distance_km']
                stats['estimated_cost']['walking']['calories'] = int(distance_km * 50)  # ~50 cal/km
                stats['estimated_cost']['walking']['time_minutes'] = int(distance_km / self.walking_speed_kmh * 60)
                
                # Determine difficulty
                if distance_km < 2:
                    stats['difficulty'] = 'easy'
                elif distance_km < 5:
                    stats['difficulty'] = 'moderate'
                else:
                    stats['difficulty'] = 'challenging'
            
            elif stats['route_type'] == 'driving':
                # Driving costs
                distance_km = stats['total_distance_km']
                stats['estimated_cost']['driving']['fuel_liters'] = round(distance_km * 0.08, 2)  # ~8L/100km
                stats['estimated_cost']['driving']['time_minutes'] = int(distance_km / self.driving_speed_kmh * 60)
                stats['difficulty'] = 'easy'  # Driving is generally easy
            
            return stats
            
        except Exception as e:
            logger.error(f"Route statistics calculation error: {e}")
            return {'error': str(e)}
    
    def _determine_optimal_route_type(self, waypoints: List[Dict[str, Any]]) -> str:
        """Determine optimal route type based on waypoint locations and distances."""
        try:
            # Check if all waypoints are within Ürgüp center
            all_in_center = all(self._is_within_urgup_center(wp['lat'], wp['lng']) for wp in waypoints)
            
            if all_in_center:
                # Calculate total distance
                total_distance = self._calculate_total_distance(waypoints)
                
                # Use walking if distance is reasonable
                if total_distance <= self.max_walking_distance_km:
                    return 'walking'
            
            return 'driving'
            
        except Exception as e:
            logger.warning(f"Route type determination error: {e}")
            return 'driving'  # Safe default
    
    def _is_within_urgup_center(self, lat: float, lng: float) -> bool:
        """Check if coordinates are within Ürgüp city center."""
        bounds = self.urgup_center_bounds
        return (bounds['south'] <= lat <= bounds['north'] and 
                bounds['west'] <= lng <= bounds['east'])
    
    def _calculate_total_distance(self, waypoints: List[Dict[str, Any]]) -> float:
        """Calculate total distance between consecutive waypoints."""
        total_distance = 0
        for i in range(len(waypoints) - 1):
            distance = self._haversine_distance(
                waypoints[i]['lat'], waypoints[i]['lng'],
                waypoints[i+1]['lat'], waypoints[i+1]['lng']
            )
            total_distance += distance
        return total_distance
    
    def _haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula."""
        # Convert to radians
        lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371  # Earth radius in km
        
        return c * r
    
    def _create_osmnx_walking_route(self, waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create walking route using OSMnx (simplified mock implementation)."""
        try:
            # In real implementation, would use OSMnx and NetworkX
            # For now, create a mock response based on the API structure we saw
            
            full_route = []
            total_distance = 0
            
            # Generate mock route coordinates between waypoints
            for i in range(len(waypoints) - 1):
                start = waypoints[i]
                end = waypoints[i + 1]
                
                # Create interpolated points between waypoints
                segment_coords = self._interpolate_coordinates(start, end, num_points=10)
                full_route.extend(segment_coords)
                
                # Calculate segment distance
                segment_distance = self._haversine_distance(
                    start['lat'], start['lng'], end['lat'], end['lng']
                )
                total_distance += segment_distance
            
            # Calculate estimated time
            estimated_time_minutes = (total_distance / self.walking_speed_kmh) * 60
            
            return {
                'success': True,
                'route': {
                    'segments': [{
                        'coordinates': full_route,
                        'distance': round(total_distance, 2),
                        'from': waypoints[0].get('name', 'Start'),
                        'to': waypoints[-1].get('name', 'End')
                    }],
                    'total_distance': round(total_distance, 2),
                    'estimated_time': round(estimated_time_minutes, 1),
                    'waypoint_count': len(waypoints),
                    'network_type': 'walking'
                },
                'fallback_used': False
            }
            
        except Exception as e:
            raise APIError(f"OSMnx walking route error: {str(e)}", "OSMNX_WALKING_ERROR", 500)
    
    def _create_osmnx_driving_route(self, waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create driving route using OSMnx (simplified mock implementation)."""
        try:
            # Similar to walking route but with different speed and interpolation
            
            full_route = []
            total_distance = 0
            
            for i in range(len(waypoints) - 1):
                start = waypoints[i]
                end = waypoints[i + 1]
                
                # Create road-like route between waypoints
                segment_coords = self._interpolate_coordinates(start, end, num_points=5)
                full_route.extend(segment_coords)
                
                segment_distance = self._haversine_distance(
                    start['lat'], start['lng'], end['lat'], end['lng']
                )
                total_distance += segment_distance
            
            # Calculate estimated time for driving
            estimated_time_minutes = (total_distance / self.driving_speed_kmh) * 60
            
            return {
                'success': True,
                'route': {
                    'segments': [{
                        'coordinates': full_route,
                        'distance': round(total_distance, 2),
                        'from': waypoints[0].get('name', 'Start'),
                        'to': waypoints[-1].get('name', 'End')
                    }],
                    'total_distance': round(total_distance, 2),
                    'estimated_time': round(estimated_time_minutes, 1),
                    'waypoint_count': len(waypoints),
                    'network_type': 'driving'
                },
                'fallback_used': False
            }
            
        except Exception as e:
            raise APIError(f"OSMnx driving route error: {str(e)}", "OSMNX_DRIVING_ERROR", 500)
    
    def _create_simple_route(self, waypoints: List[Dict[str, Any]], route_type: str) -> Dict[str, Any]:
        """Create simple route with straight lines (fallback)."""
        try:
            coordinates = []
            total_distance = 0
            
            # Create simple point-to-point route
            for wp in waypoints:
                coordinates.append({'lat': wp['lat'], 'lng': wp['lng']})
            
            # Calculate total distance
            for i in range(len(waypoints) - 1):
                distance = self._haversine_distance(
                    waypoints[i]['lat'], waypoints[i]['lng'],
                    waypoints[i+1]['lat'], waypoints[i+1]['lng']
                )
                total_distance += distance
            
            # Calculate estimated time based on route type
            speed = self.walking_speed_kmh if route_type == 'walking' else self.driving_speed_kmh
            estimated_time_minutes = (total_distance / speed) * 60
            
            return {
                'success': True,
                'route': {
                    'coordinates': [[wp['lng'], wp['lat']] for wp in waypoints],
                    'distance': round(total_distance, 2),
                    'duration': round(estimated_time_minutes, 1),
                    'instructions': [f"Go to {wp.get('name', f'Point {i+1}')}" 
                                   for i, wp in enumerate(waypoints)],
                    'total_distance': round(total_distance, 2),
                    'estimated_time': round(estimated_time_minutes, 1),
                    'waypoint_count': len(waypoints),
                    'network_type': route_type
                },
                'fallback_used': True
            }
            
        except Exception as e:
            raise APIError(f"Simple route error: {str(e)}", "SIMPLE_ROUTE_ERROR", 500)
    
    def _interpolate_coordinates(self, start: Dict[str, Any], end: Dict[str, Any], 
                               num_points: int = 10) -> List[Dict[str, Any]]:
        """Interpolate coordinates between two points."""
        coords = []
        
        for i in range(num_points):
            ratio = i / (num_points - 1) if num_points > 1 else 0
            
            lat = start['lat'] + (end['lat'] - start['lat']) * ratio
            lng = start['lng'] + (end['lng'] - start['lng']) * ratio
            
            coords.append({'lat': lat, 'lng': lng})
        
        return coords
    
    def _nearest_neighbor_optimization(self, waypoints: List[Dict[str, Any]], 
                                     start_point: Dict[str, Any] = None,
                                     end_point: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Optimize route using nearest neighbor algorithm."""
        try:
            if not waypoints:
                return []
            
            # Start with the first waypoint or provided start point
            optimized_route = []
            remaining_points = waypoints.copy()
            
            if start_point:
                current_point = start_point
                optimized_route.append(current_point)
            else:
                current_point = remaining_points.pop(0)
                optimized_route.append(current_point)
            
            # Find nearest neighbor for each step
            while remaining_points:
                nearest_point = None
                nearest_distance = float('inf')
                
                for point in remaining_points:
                    distance = self._haversine_distance(
                        current_point['lat'], current_point['lng'],
                        point['lat'], point['lng']
                    )
                    
                    if distance < nearest_distance:
                        nearest_distance = distance
                        nearest_point = point
                
                if nearest_point:
                    optimized_route.append(nearest_point)
                    remaining_points.remove(nearest_point)
                    current_point = nearest_point
            
            # Add end point if specified
            if end_point and end_point != optimized_route[-1]:
                optimized_route.append(end_point)
            
            return optimized_route
            
        except Exception as e:
            logger.error(f"Nearest neighbor optimization error: {e}")
            return waypoints
    
    def _genetic_algorithm_optimization(self, waypoints: List[Dict[str, Any]], 
                                      start_point: Dict[str, Any] = None,
                                      end_point: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Optimize route using simplified genetic algorithm (placeholder)."""
        # For now, fall back to nearest neighbor for complex cases
        return self._nearest_neighbor_optimization(waypoints, start_point, end_point)


# Global route planning service instance
route_planning_service = RoutePlanningService()
