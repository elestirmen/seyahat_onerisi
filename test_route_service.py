#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route Service Unit Tests
"""

import unittest
import os
import sys
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
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        
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
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
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


if __name__ == '__main__':
    # Test çalıştır
    unittest.main(verbosity=2)