#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route Service Unit Tests
Comprehensive test suite for route service functionality
"""

import unittest
import os
import sys
import json
from unittest.mock import Mock, patch, MagicMock
from route_service import RouteService


class TestRouteService(unittest.TestCase):
    """Route Service test sınıfı"""
    
    def setUp(self):
        """Test setup"""
        self.service = RouteService("postgresql://test:test@localhost/test_db")
    
    def test_init(self):
        """Initialization test"""
        self.assertIsNotNone(self.service.connection_string)
        self.assertIsNone(self.service.conn)
    
    def test_init_with_env_vars(self):
        """Environment variables ile initialization test"""
        with patch.dict(os.environ, {
            'POI_DB_HOST': 'testhost',
            'POI_DB_PORT': '5433',
            'POI_DB_NAME': 'testdb',
            'POI_DB_USER': 'testuser',
            'POI_DB_PASSWORD': 'testpass'
        }):
            service = RouteService()
            expected = "postgresql://testuser:testpass@testhost:5433/testdb"
            self.assertEqual(service.connection_string, expected)
    
    @patch('route_service.psycopg2.connect')
    def test_connect_success(self, mock_connect):
        """Successful connection test"""
        mock_conn = Mock()
        mock_connect.return_value = mock_conn
        
        result = self.service.connect()
        
        self.assertTrue(result)
        self.assertEqual(self.service.conn, mock_conn)
        mock_connect.assert_called_once_with(self.service.connection_string)
    
    @patch('route_service.psycopg2.connect')
    def test_connect_failure(self, mock_connect):
        """Connection failure test"""
        mock_connect.side_effect = Exception("Connection failed")
        
        result = self.service.connect()
        
        self.assertFalse(result)
        self.assertIsNone(self.service.conn)
    
    def test_disconnect(self):
        """Disconnect test"""
        mock_conn = Mock()
        self.service.conn = mock_conn
        
        self.service.disconnect()
        
        mock_conn.close.assert_called_once()
        self.assertIsNone(self.service.conn)
    
    @patch('route_service.psycopg2.connect')
    def test_execute_query_success(self, mock_connect):
        """Successful query execution test"""
        # Mock connection ve cursor
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = [{'id': 1, 'name': 'Test Route'}]
        
        mock_conn = Mock()
        mock_context_manager = Mock()
        mock_context_manager.__enter__ = Mock(return_value=mock_cursor)
        mock_context_manager.__exit__ = Mock(return_value=None)
        mock_conn.cursor.return_value = mock_context_manager
        
        mock_connect.return_value = mock_conn
        self.service.conn = mock_conn
        
        result = self.service._execute_query("SELECT * FROM routes", fetch_all=True)
        
        self.assertEqual(result, [{'id': 1, 'name': 'Test Route'}])
        mock_cursor.execute.assert_called_once_with("SELECT * FROM routes", None)
    
    @patch('route_service.psycopg2.connect')
    def test_execute_query_failure(self, mock_connect):
        """Query execution failure test"""
        mock_cursor = Mock()
        mock_cursor.execute.side_effect = Exception("Query failed")
        
        mock_conn = Mock()
        mock_context_manager = Mock()
        mock_context_manager.__enter__ = Mock(return_value=mock_cursor)
        mock_context_manager.__exit__ = Mock(return_value=None)
        mock_conn.cursor.return_value = mock_context_manager
        mock_conn.rollback = Mock()
        
        mock_connect.return_value = mock_conn
        self.service.conn = mock_conn
        
        result = self.service._execute_query("SELECT * FROM routes")
        
        self.assertIsNone(result)
        mock_conn.rollback.assert_called_once()
    
    def test_get_all_active_routes(self):
        """Get all active routes test"""
        mock_routes = [
            {'id': 1, 'name': 'Route 1', 'is_active': True},
            {'id': 2, 'name': 'Route 2', 'is_active': True}
        ]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.get_all_active_routes()
            
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0]['name'], 'Route 1')
    
    def test_get_route_by_id(self):
        """Get route by ID test"""
        mock_route = {'id': 1, 'name': 'Test Route', 'is_active': True}
        mock_pois = [{'poi_id': 1, 'name': 'POI 1'}]
        
        with patch.object(self.service, '_execute_query', return_value=mock_route):
            with patch.object(self.service, 'get_route_pois', return_value=mock_pois):
                result = self.service.get_route_by_id(1)
                
                self.assertIsNotNone(result)
                self.assertEqual(result['name'], 'Test Route')
                self.assertEqual(result['pois'], mock_pois)
    
    def test_get_route_by_id_not_found(self):
        """Get route by ID - not found test"""
        with patch.object(self.service, '_execute_query', return_value=None):
            result = self.service.get_route_by_id(999)
            
            self.assertIsNone(result)
    
    def test_filter_routes_by_type(self):
        """Filter routes by type test"""
        filters = {'route_type': 'walking'}
        mock_routes = [{'id': 1, 'route_type': 'walking'}]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.filter_routes(filters)
            
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['route_type'], 'walking')
    
    def test_filter_routes_by_difficulty(self):
        """Filter routes by difficulty test"""
        filters = {'difficulty_level': {'min': 2, 'max': 4}}
        mock_routes = [{'id': 1, 'difficulty_level': 3}]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.filter_routes(filters)
            
            self.assertEqual(len(result), 1)
    
    def test_create_route_success(self):
        """Create route success test"""
        route_data = {
            'name': 'Test Route',
            'description': 'Test Description',
            'route_type': 'walking',
            'difficulty_level': 2
        }
        
        mock_result = {'id': 1}
        
        with patch.object(self.service, '_execute_query', return_value=mock_result):
            with patch.object(self.service, '_add_route_ratings'):
                result = self.service.create_route(route_data)
                
                self.assertEqual(result, 1)
    
    def test_create_route_missing_required_field(self):
        """Create route with missing required field test"""
        route_data = {
            'description': 'Test Description',
            'route_type': 'walking'
            # 'name' eksik
        }
        
        result = self.service.create_route(route_data)
        
        self.assertIsNone(result)
    
    def test_update_route_success(self):
        """Update route success test"""
        route_data = {
            'name': 'Updated Route',
            'difficulty_level': 3
        }
        
        with patch.object(self.service, '_execute_query', return_value=1):
            with patch.object(self.service, '_update_route_ratings'):
                result = self.service.update_route(1, route_data)
                
                self.assertTrue(result)
    
    def test_update_route_no_fields(self):
        """Update route with no valid fields test"""
        route_data = {}
        
        result = self.service.update_route(1, route_data)
        
        self.assertFalse(result)
    
    def test_delete_route_success(self):
        """Delete route success test"""
        with patch.object(self.service, '_execute_query', return_value=1):
            result = self.service.delete_route(1)
            
            self.assertTrue(result)
    
    def test_delete_route_not_found(self):
        """Delete route not found test"""
        with patch.object(self.service, '_execute_query', return_value=0):
            result = self.service.delete_route(999)
            
            self.assertFalse(result)
    
    def test_associate_pois_success(self):
        """Associate POIs success test"""
        poi_associations = [
            {
                'poi_id': 1,
                'order_in_route': 1,
                'is_mandatory': True,
                'estimated_time_at_poi': 20
            }
        ]
        
        with patch.object(self.service, '_execute_query', return_value=1):
            result = self.service.associate_pois(1, poi_associations)
            
            self.assertTrue(result)
    
    def test_associate_pois_empty_list(self):
        """Associate POIs with empty list test"""
        result = self.service.associate_pois(1, [])
        
        self.assertTrue(result)
    
    def test_search_routes(self):
        """Search routes test"""
        mock_routes = [{'id': 1, 'name': 'Walking Route'}]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.search_routes('walking')
            
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['name'], 'Walking Route')
    
    def test_get_route_statistics(self):
        """Get route statistics test"""
        mock_stats = {
            'total_routes': 10,
            'active_routes': 8,
            'walking_routes': 5,
            'avg_difficulty': 2.5
        }
        
        with patch.object(self.service, '_execute_query', return_value=mock_stats):
            result = self.service.get_route_statistics()
            
            self.assertEqual(result['total_routes'], 10)
            self.assertEqual(result['active_routes'], 8)
    
    def test_get_route_pois_success(self):
        """Get route POIs success test"""
        mock_pois = [
            {
                'poi_id': 1,
                'name': 'Test POI 1',
                'order_in_route': 1,
                'is_mandatory': True,
                'lat': 38.7,
                'lon': 34.8
            },
            {
                'poi_id': 2,
                'name': 'Test POI 2',
                'order_in_route': 2,
                'is_mandatory': False,
                'lat': 38.8,
                'lon': 34.9
            }
        ]
        
        with patch.object(self.service, '_execute_query', return_value=mock_pois):
            result = self.service.get_route_pois(1)
            
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0]['name'], 'Test POI 1')
            self.assertEqual(result[1]['order_in_route'], 2)
    
    def test_get_route_pois_empty(self):
        """Get route POIs empty result test"""
        with patch.object(self.service, '_execute_query', return_value=None):
            result = self.service.get_route_pois(1)
            
            self.assertEqual(result, [])
    
    def test_filter_routes_complex(self):
        """Complex route filtering test"""
        filters = {
            'route_type': 'hiking',
            'difficulty_level': {'min': 2, 'max': 4},
            'duration': {'min': 60, 'max': 180},
            'distance': {'min': 5.0, 'max': 15.0},
            'tags': ['mountain', 'scenic'],
            'season': 'summer'
        }
        
        mock_routes = [
            {
                'id': 1,
                'route_type': 'hiking',
                'difficulty_level': 3,
                'estimated_duration': 120,
                'total_distance': 10.5
            }
        ]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.filter_routes(filters)
            
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['route_type'], 'hiking')
    
    def test_create_route_with_ratings(self):
        """Create route with ratings test"""
        route_data = {
            'name': 'Test Route with Ratings',
            'description': 'Test Description',
            'route_type': 'walking',
            'difficulty_level': 2,
            'ratings': {
                'scenic_beauty': 4,
                'historical': 3,
                'family_friendly': 5
            }
        }
        
        mock_result = {'id': 1}
        
        with patch.object(self.service, '_execute_query', return_value=mock_result):
            with patch.object(self.service, '_add_route_ratings') as mock_add_ratings:
                result = self.service.create_route(route_data)
                
                self.assertEqual(result, 1)
                mock_add_ratings.assert_called_once_with(1, route_data['ratings'])
    
    def test_update_route_with_ratings(self):
        """Update route with ratings test"""
        route_data = {
            'name': 'Updated Route',
            'difficulty_level': 4,
            'ratings': {
                'scenic_beauty': 5,
                'cultural': 4
            }
        }
        
        with patch.object(self.service, '_execute_query', return_value=1):
            with patch.object(self.service, '_update_route_ratings') as mock_update_ratings:
                result = self.service.update_route(1, route_data)
                
                self.assertTrue(result)
                mock_update_ratings.assert_called_once_with(1, route_data['ratings'])
    
    def test_associate_pois_with_detailed_data(self):
        """Associate POIs with detailed data test"""
        poi_associations = [
            {
                'poi_id': 1,
                'order_in_route': 1,
                'is_mandatory': True,
                'estimated_time_at_poi': 30,
                'notes': 'Starting point'
            },
            {
                'poi_id': 2,
                'order_in_route': 2,
                'is_mandatory': False,
                'estimated_time_at_poi': 15,
                'notes': 'Optional viewpoint'
            }
        ]
        
        with patch.object(self.service, '_execute_query', return_value=1):
            result = self.service.associate_pois(1, poi_associations)
            
            self.assertTrue(result)
    
    def test_associate_pois_database_error(self):
        """Associate POIs database error test"""
        poi_associations = [{'poi_id': 1, 'order_in_route': 1}]
        
        with patch.object(self.service, '_execute_query', side_effect=Exception("DB Error")):
            result = self.service.associate_pois(1, poi_associations)
            
            self.assertFalse(result)
    
    def test_search_routes_multiple_terms(self):
        """Search routes with multiple terms test"""
        mock_routes = [
            {'id': 1, 'name': 'Mountain Walking Route', 'description': 'Beautiful mountain trail'},
            {'id': 2, 'name': 'City Walking Tour', 'description': 'Urban exploration route'}
        ]
        
        with patch.object(self.service, '_execute_query', return_value=mock_routes):
            result = self.service.search_routes('walking')
            
            self.assertEqual(len(result), 2)
            self.assertIn('Walking', result[0]['name'])
    
    def test_search_routes_no_results(self):
        """Search routes with no results test"""
        with patch.object(self.service, '_execute_query', return_value=None):
            result = self.service.search_routes('nonexistent')
            
            self.assertEqual(result, [])
    
    def test_add_route_ratings(self):
        """Add route ratings test"""
        ratings = {
            'scenic_beauty': 4,
            'historical': 3,
            'family_friendly': 5
        }
        
        with patch.object(self.service, '_execute_query', return_value=1) as mock_query:
            self.service._add_route_ratings(1, ratings)
            
            # Should be called once for each rating
            self.assertEqual(mock_query.call_count, 3)
    
    def test_update_route_ratings(self):
        """Update route ratings test"""
        ratings = {
            'scenic_beauty': 5,
            'cultural': 4
        }
        
        with patch.object(self.service, '_add_route_ratings') as mock_add:
            self.service._update_route_ratings(1, ratings)
            
            mock_add.assert_called_once_with(1, ratings)
    
    def test_connection_retry_logic(self):
        """Test connection retry logic"""
        with patch('route_service.psycopg2.connect') as mock_connect:
            # First call fails, second succeeds
            mock_connect.side_effect = [Exception("Connection failed"), Mock()]
            
            # First attempt should fail
            result1 = self.service.connect()
            self.assertFalse(result1)
            
            # Second attempt should succeed
            result2 = self.service.connect()
            self.assertTrue(result2)
    
    def test_query_parameter_sanitization(self):
        """Test query parameter sanitization"""
        # Test with potentially dangerous input
        dangerous_input = "'; DROP TABLE routes; --"
        
        with patch.object(self.service, '_execute_query', return_value=[]) as mock_query:
            self.service.search_routes(dangerous_input)

            # Verify the query was called with parameterized input
            mock_query.assert_called_once()
            args, kwargs = mock_query.call_args
            # The dangerous input should be passed as a parameter, not concatenated
            self.assertIn('%', args[0])  # Should contain parameter placeholders

    @patch('route_service.ElevationService')
    def test_save_route_geometry_generates_elevation(self, mock_elev):
        """save_route_geometry should generate elevation profile"""
        mock_instance = mock_elev.return_value
        mock_profile = {
            'points': [],
            'stats': {
                'min_elevation': 100,
                'max_elevation': 150,
                'elevation_gain': 50,
                'total_ascent': 50,
                'total_descent': 0
            },
            'total_distance': 1000,
            'point_count': 2,
            'resolution': 10
        }
        mock_instance.generate_elevation_profile_from_geometry.return_value = mock_profile

        geometry_segments = [
            {'coordinates': [
                {'lat': 38.0, 'lng': 34.0},
                {'lat': 38.1, 'lng': 34.1}
            ]}
        ]

        with patch.object(self.service, '_execute_query', side_effect=[1, {'has_geometry': True}]) as mock_exec:
            result = self.service.save_route_geometry(
                1,
                geometry_segments,
                total_distance=1000,
                estimated_time=600,
                waypoints=[{'lat': 38.0, 'lng': 34.0}, {'lat': 38.1, 'lng': 34.1}]
            )

            self.assertTrue(result)
            mock_elev.assert_called_once()
            mock_instance.generate_elevation_profile_from_geometry.assert_called_once()
            first_call = mock_exec.call_args_list[0]
            self.assertIn('elevation_profile', first_call[0][0])


class TestRouteServiceIntegration(unittest.TestCase):
    """Integration tests for RouteService"""
    
    def setUp(self):
        """Setup for integration tests"""
        self.service = RouteService("postgresql://test:test@localhost/test_db")
    
    @patch('route_service.psycopg2.connect')
    def test_full_route_lifecycle(self, mock_connect):
        """Test complete route lifecycle: create, read, update, delete"""
        # Mock database connection
        mock_cursor = Mock()
        mock_conn = Mock()
        mock_context_manager = Mock()
        mock_context_manager.__enter__ = Mock(return_value=mock_cursor)
        mock_context_manager.__exit__ = Mock(return_value=None)
        mock_conn.cursor.return_value = mock_context_manager
        mock_connect.return_value = mock_conn
        
        # Test data
        route_data = {
            'name': 'Integration Test Route',
            'description': 'Test route for integration testing',
            'route_type': 'walking',
            'difficulty_level': 2,
            'estimated_duration': 90,
            'ratings': {'scenic_beauty': 4}
        }
        
        # Mock responses for different operations
        mock_cursor.fetchone.side_effect = [
            {'id': 1},  # create_route response
            {'id': 1, 'name': 'Integration Test Route', 'ratings': {}},  # get_route_by_id response
        ]
        mock_cursor.fetchall.side_effect = [
            [],  # get_route_pois response
        ]
        mock_cursor.rowcount = 1
        
        self.service.conn = mock_conn
        
        # Create route
        route_id = self.service.create_route(route_data)
        self.assertEqual(route_id, 1)
        
        # Read route
        route = self.service.get_route_by_id(route_id)
        self.assertIsNotNone(route)
        self.assertEqual(route['name'], 'Integration Test Route')
        
        # Update route
        update_data = {'difficulty_level': 3}
        result = self.service.update_route(route_id, update_data)
        self.assertTrue(result)
        
        # Delete route
        result = self.service.delete_route(route_id)
        self.assertTrue(result)


class TestRouteServiceErrorHandling(unittest.TestCase):
    """Error handling tests for RouteService"""
    
    def setUp(self):
        """Setup for error handling tests"""
        self.service = RouteService("postgresql://test:test@localhost/test_db")
    
    def test_database_connection_failure(self):
        """Test handling of database connection failures"""
        with patch('route_service.psycopg2.connect', side_effect=Exception("Connection failed")):
            result = self.service.connect()
            self.assertFalse(result)
    
    def test_query_execution_failure(self):
        """Test handling of query execution failures"""
        mock_cursor = Mock()
        mock_cursor.execute.side_effect = Exception("Query failed")
        
        mock_conn = Mock()
        mock_context_manager = Mock()
        mock_context_manager.__enter__ = Mock(return_value=mock_cursor)
        mock_context_manager.__exit__ = Mock(return_value=None)
        mock_conn.cursor.return_value = mock_context_manager
        mock_conn.rollback = Mock()
        
        self.service.conn = mock_conn
        
        result = self.service._execute_query("SELECT * FROM routes")
        self.assertIsNone(result)
        mock_conn.rollback.assert_called_once()
    
    def test_invalid_route_data_handling(self):
        """Test handling of invalid route data"""
        # Missing required fields
        invalid_data = {'description': 'Missing name'}
        result = self.service.create_route(invalid_data)
        self.assertIsNone(result)
        
        # Invalid data types - this should be caught by validation
        invalid_data2 = {
            'name': 'Test',
            'description': 'Test',
            'route_type': 'walking',
            'difficulty_level': 'invalid'  # Should be int
        }
        
        # This should fail during parameter preparation, not query execution
        try:
            result = self.service.create_route(invalid_data2)
            # If it doesn't raise an exception, it should return None
            self.assertIsNone(result)
        except (TypeError, ValueError):
            # This is expected for invalid data types
            pass
    
    def test_nonexistent_route_operations(self):
        """Test operations on nonexistent routes"""
        with patch.object(self.service, '_execute_query', return_value=None):
            # Get nonexistent route
            result = self.service.get_route_by_id(999)
            self.assertIsNone(result)
        
        with patch.object(self.service, '_execute_query', return_value=0):
            # Update nonexistent route
            result = self.service.update_route(999, {'name': 'Updated'})
            self.assertFalse(result)
            
            # Delete nonexistent route
            result = self.service.delete_route(999)
            self.assertFalse(result)


if __name__ == '__main__':
    # Test çalıştır
    unittest.main(verbosity=2)