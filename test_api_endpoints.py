#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Endpoints Unit Tests
Comprehensive test suite for route API endpoints
"""

import unittest
import json
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from flask import Flask
from werkzeug.test import Client
from werkzeug.wrappers import Response
import werkzeug

# Compatibility for Werkzeug 3 where __version__ attribute was removed
if not hasattr(werkzeug, "__version__"):
    werkzeug.__version__ = "3.1.3"

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the Flask app
import poi_api


class TestRouteAPIEndpoints(unittest.TestCase):
    """Test suite for route API endpoints"""
    
    def setUp(self):
        """Setup test client and mock data"""
        self.app = poi_api.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Mock route data
        self.mock_route = {
            'id': 1,
            'name': 'Test Route',
            'description': 'Test route description',
            'route_type': 'walking',
            'difficulty_level': 2,
            'estimated_duration': 90,
            'total_distance': 5.5,
            'is_circular': True,
            'ratings': {'scenic_beauty': 4, 'family_friendly': 5},
            'poi_count': 3
        }
        
        self.mock_routes = [self.mock_route]
        
        # Mock authentication
        self.auth_headers = {
            'Authorization': 'Bearer test_token',
            'X-CSRF-Token': 'test_csrf_token'
        }
    
    def test_get_predefined_routes_success(self):
        """Test successful retrieval of predefined routes"""
        with patch('poi_api.route_service.get_all_active_routes', return_value=self.mock_routes):
            response = self.client.get('/api/routes')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
            self.assertEqual(data['routes'][0]['name'], 'Test Route')
    
    def test_get_predefined_routes_empty(self):
        """Test retrieval when no routes exist"""
        with patch('poi_api.route_service.get_all_active_routes', return_value=[]):
            response = self.client.get('/api/routes')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 0)
    
    def test_get_predefined_routes_database_error(self):
        """Test handling of database errors"""
        with patch('poi_api.route_service.get_all_active_routes', side_effect=Exception("DB Error")):
            response = self.client.get('/api/routes')
            
            self.assertEqual(response.status_code, 500)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertIn('error', data)
    
    def test_get_route_details_success(self):
        """Test successful retrieval of route details"""
        with patch('poi_api.route_service.get_route_by_id', return_value=self.mock_route):
            response = self.client.get('/api/routes/1')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(data['route']['name'], 'Test Route')
    
    def test_get_route_details_not_found(self):
        """Test retrieval of nonexistent route"""
        with patch('poi_api.route_service.get_route_by_id', return_value=None):
            response = self.client.get('/api/routes/999')
            
            self.assertEqual(response.status_code, 404)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertIn('not found', data['error'].lower())
    
    def test_get_route_details_invalid_id(self):
        """Test retrieval with invalid route ID"""
        response = self.client.get('/api/routes/invalid')
        
        self.assertEqual(response.status_code, 404)
    
    def test_filter_routes_success(self):
        """Test successful route filtering"""
        filter_data = {
            'route_type': 'walking',
            'difficulty_level': {'min': 1, 'max': 3}
        }
        
        with patch('poi_api.route_service.filter_routes', return_value=self.mock_routes):
            response = self.client.post('/api/routes/filter',
                                      data=json.dumps(filter_data),
                                      content_type='application/json')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
    
    def test_filter_routes_empty_filters(self):
        """Test filtering with empty filter criteria"""
        with patch('poi_api.route_service.get_all_active_routes', return_value=self.mock_routes):
            response = self.client.post('/api/routes/filter',
                                      data=json.dumps({}),
                                      content_type='application/json')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
    
    def test_filter_routes_invalid_json(self):
        """Test filtering with invalid JSON"""
        response = self.client.post('/api/routes/filter',
                                  data='invalid json',
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    def test_search_routes_success(self):
        """Test successful route search"""
        with patch('poi_api.route_service.search_routes', return_value=self.mock_routes):
            response = self.client.get('/api/routes/search?q=walking')
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
    
    def test_search_routes_short_term(self):
        """Test search with too short search term"""
        response = self.client.get('/api/routes/search?q=a')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('at least 2 characters', data['error'])
    
    def test_search_routes_missing_query(self):
        """Test search without query parameter"""
        response = self.client.get('/api/routes/search')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])


class TestAdminRouteAPIEndpoints(unittest.TestCase):
    """Test suite for admin route API endpoints"""
    
    def setUp(self):
        """Setup test client and mock data"""
        self.app = poi_api.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Mock route data
        self.mock_route = {
            'id': 1,
            'name': 'Admin Test Route',
            'description': 'Admin test route description',
            'route_type': 'hiking',
            'difficulty_level': 3,
            'estimated_duration': 120,
            'total_distance': 8.5,
            'is_circular': False,
            'ratings': {'scenic_beauty': 5, 'historical': 4}
        }
        
        self.mock_routes = [self.mock_route]
        
        # Mock authentication headers
        self.auth_headers = {
            'Authorization': 'Bearer test_token',
            'X-CSRF-Token': 'test_csrf_token'
        }
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_get_routes_success(self, mock_auth):
        """Test admin route listing"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        with patch('poi_api.route_service.get_all_active_routes', return_value=self.mock_routes):
            response = self.client.get('/api/admin/routes', headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_get_route_details_success(self, mock_auth):
        """Test admin route detail retrieval"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        with patch('poi_api.route_service.get_route_by_id', return_value=self.mock_route):
            response = self.client.get('/api/admin/routes/1', headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(data['route']['name'], 'Admin Test Route')
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_create_route_success(self, mock_auth):
        """Test admin route creation"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        route_data = {
            'name': 'New Admin Route',
            'description': 'New route created by admin',
            'route_type': 'cycling',
            'difficulty_level': 2,
            'csrf_token': 'test_csrf_token'
        }
        
        with patch('poi_api.route_service.create_route', return_value=1):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.post('/api/admin/routes',
                                          data=json.dumps(route_data),
                                          content_type='application/json',
                                          headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 201)
                data = json.loads(response.data)
                self.assertTrue(data['success'])
                self.assertEqual(data['route_id'], 1)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_create_route_missing_required_field(self, mock_auth):
        """Test admin route creation with missing required field"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        route_data = {
            'description': 'Missing name field',
            'route_type': 'walking',
            'csrf_token': 'test_csrf_token'
        }
        
        with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
            response = self.client.post('/api/admin/routes',
                                      data=json.dumps(route_data),
                                      content_type='application/json',
                                      headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertIn('required', data['error'].lower())
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_create_route_invalid_csrf(self, mock_auth):
        """Test admin route creation with invalid CSRF token"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        route_data = {
            'name': 'Test Route',
            'description': 'Test description',
            'route_type': 'walking',
            'csrf_token': 'invalid_token'
        }
        
        with patch('poi_api.auth_middleware.validate_csrf_token', return_value=False):
            response = self.client.post('/api/admin/routes',
                                      data=json.dumps(route_data),
                                      content_type='application/json',
                                      headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 403)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertIn('csrf', data['error'].lower())
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_update_route_success(self, mock_auth):
        """Test admin route update"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        update_data = {
            'name': 'Updated Route Name',
            'difficulty_level': 4,
            'csrf_token': 'test_csrf_token'
        }
        
        with patch('poi_api.route_service.update_route', return_value=True):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.put('/api/admin/routes/1',
                                         data=json.dumps(update_data),
                                         content_type='application/json',
                                         headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 200)
                data = json.loads(response.data)
                self.assertTrue(data['success'])
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_update_route_not_found(self, mock_auth):
        """Test admin route update for nonexistent route"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        update_data = {
            'name': 'Updated Route Name',
            'csrf_token': 'test_csrf_token'
        }
        
        with patch('poi_api.route_service.update_route', return_value=False):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.put('/api/admin/routes/999',
                                         data=json.dumps(update_data),
                                         content_type='application/json',
                                         headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 404)
                data = json.loads(response.data)
                self.assertFalse(data['success'])
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_delete_route_success(self, mock_auth):
        """Test admin route deletion"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        delete_data = {'csrf_token': 'test_csrf_token'}
        
        with patch('poi_api.route_service.delete_route', return_value=True):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.delete('/api/admin/routes/1',
                                            data=json.dumps(delete_data),
                                            content_type='application/json',
                                            headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 200)
                data = json.loads(response.data)
                self.assertTrue(data['success'])
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_delete_route_not_found(self, mock_auth):
        """Test admin route deletion for nonexistent route"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        delete_data = {'csrf_token': 'test_csrf_token'}
        
        with patch('poi_api.route_service.delete_route', return_value=False):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.delete('/api/admin/routes/999',
                                            data=json.dumps(delete_data),
                                            content_type='application/json',
                                            headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 404)
                data = json.loads(response.data)
                self.assertFalse(data['success'])
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_associate_pois_success(self, mock_auth):
        """Test admin POI association with route"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        poi_data = {
            'poi_associations': [
                {
                    'poi_id': 1,
                    'order_in_route': 1,
                    'is_mandatory': True,
                    'estimated_time_at_poi': 20
                },
                {
                    'poi_id': 2,
                    'order_in_route': 2,
                    'is_mandatory': False,
                    'estimated_time_at_poi': 15
                }
            ],
            'csrf_token': 'test_csrf_token'
        }
        
        with patch('poi_api.route_service.associate_pois', return_value=True):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.post('/api/admin/routes/1/pois',
                                          data=json.dumps(poi_data),
                                          content_type='application/json',
                                          headers=self.auth_headers)
                
                self.assertEqual(response.status_code, 200)
                data = json.loads(response.data)
                self.assertTrue(data['success'])

    @patch('poi_api.auth_middleware.is_authenticated', return_value=True)
    def test_admin_associate_pois_with_geometry(self, mock_auth):
        """POI association should forward geometry data"""

        payload = {
            'pois': [
                {'poi_id': 1, 'order_in_route': 1, 'is_mandatory': True}
            ],
            'geometry': [
                {
                    'coordinates': [
                        {'lat': 38.0, 'lng': 34.0},
                        {'lat': 38.1, 'lng': 34.1}
                    ]
                }
            ],
            'total_distance': 1000,
            'estimated_time': 600,
            'waypoints': [
                {'lat': 38.0, 'lng': 34.0},
                {'lat': 38.1, 'lng': 34.1}
            ],
            'csrf_token': 'test_csrf_token'
        }

        with patch('poi_api.route_service.connect', return_value=True):
            with patch('poi_api.route_service.disconnect'):
                with patch('poi_api.route_service.associate_pois', return_value=True) as mock_assoc:
                    with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                        response = self.client.post(
                            '/api/admin/routes/1/pois',
                            data=json.dumps(payload),
                            content_type='application/json',
                            headers=self.auth_headers
                        )

                        self.assertEqual(response.status_code, 200)
                        mock_assoc.assert_called_once()
                        _, kwargs = mock_assoc.call_args
                        self.assertEqual(kwargs['geometry_segments'], payload['geometry'])
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_get_route_pois_success(self, mock_auth):
        """Test admin route POI retrieval"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        mock_pois = [
            {
                'poi_id': 1,
                'name': 'Test POI 1',
                'order_in_route': 1,
                'is_mandatory': True
            }
        ]
        
        with patch('poi_api.route_service.get_route_pois', return_value=mock_pois):
            response = self.client.get('/api/admin/routes/1/pois', headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['pois']), 1)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_search_routes_success(self, mock_auth):
        """Test admin route search"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        with patch('poi_api.route_service.search_routes', return_value=self.mock_routes):
            response = self.client.get('/api/admin/routes/search?q=hiking', headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_filter_routes_success(self, mock_auth):
        """Test admin route filtering"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        filter_data = {
            'route_type': 'hiking',
            'difficulty_level': {'min': 2, 'max': 4}
        }
        
        with patch('poi_api.route_service.filter_routes', return_value=self.mock_routes):
            response = self.client.post('/api/admin/routes/filter',
                                      data=json.dumps(filter_data),
                                      content_type='application/json',
                                      headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['routes']), 1)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_get_statistics_success(self, mock_auth):
        """Test admin route statistics retrieval"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        mock_stats = {
            'total_routes': 10,
            'active_routes': 8,
            'walking_routes': 5,
            'avg_difficulty': 2.5
        }
        
        with patch('poi_api.route_service.get_route_statistics', return_value=mock_stats):
            response = self.client.get('/api/admin/routes/statistics', headers=self.auth_headers)
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(data['statistics']['total_routes'], 10)


class TestAPIRateLimiting(unittest.TestCase):
    """Test suite for API rate limiting"""
    
    def setUp(self):
        """Setup test client"""
        self.app = poi_api.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_public_rate_limiting(self):
        """Test rate limiting on public endpoints"""
        # Mock the rate limiting to trigger after 2 requests
        with patch('poi_api.public_rate_limits', {'127.0.0.1': []}):
            with patch('time.time', return_value=1000):
                # First request should succeed
                response1 = self.client.get('/api/routes')
                self.assertNotEqual(response1.status_code, 429)
                
                # Simulate many requests to trigger rate limit
                poi_api.public_rate_limits['127.0.0.1'] = [1000] * 101  # Exceed limit
                
                response2 = self.client.get('/api/routes')
                self.assertEqual(response2.status_code, 429)
    
    @patch('poi_api.auth_middleware.require_auth')
    def test_admin_rate_limiting(self, mock_auth):
        """Test rate limiting on admin endpoints"""
        mock_auth.return_value = lambda f: f  # Mock decorator
        
        # Mock the rate limiting to trigger after 2 requests
        with patch('poi_api.admin_rate_limits', {'127.0.0.1': []}):
            with patch('time.time', return_value=1000):
                # First request should succeed
                response1 = self.client.get('/api/admin/routes')
                self.assertNotEqual(response1.status_code, 429)
                
                # Simulate many requests to trigger rate limit
                poi_api.admin_rate_limits['127.0.0.1'] = [1000] * 31  # Exceed limit
                
                response2 = self.client.get('/api/admin/routes')
                self.assertEqual(response2.status_code, 429)


class TestAPIInputValidation(unittest.TestCase):
    """Test suite for API input validation"""
    
    def setUp(self):
        """Setup test client"""
        self.app = poi_api.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_route_id_validation(self):
        """Test route ID validation"""
        # Test negative route ID
        response = self.client.get('/api/routes/-1')
        self.assertEqual(response.status_code, 400)
        
        # Test zero route ID
        response = self.client.get('/api/routes/0')
        self.assertEqual(response.status_code, 400)
    
    def test_search_term_validation(self):
        """Test search term validation"""
        # Test too short search term
        response = self.client.get('/api/routes/search?q=a')
        self.assertEqual(response.status_code, 400)
        
        # Test empty search term
        response = self.client.get('/api/routes/search?q=')
        self.assertEqual(response.status_code, 400)
    
    def test_filter_data_validation(self):
        """Test filter data validation"""
        # Test invalid difficulty level
        invalid_filter = {
            'difficulty_level': {'min': 6, 'max': 10}  # Max difficulty is 5
        }
        
        response = self.client.post('/api/routes/filter',
                                  data=json.dumps(invalid_filter),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    def test_route_type_validation(self):
        """Test route type validation"""
        invalid_route_data = {
            'name': 'Test Route',
            'description': 'Test description',
            'route_type': 'invalid_type',  # Invalid route type
            'csrf_token': 'test_token'
        }
        
        with patch('poi_api.auth_middleware.require_auth', return_value=lambda f: f):
            with patch('poi_api.auth_middleware.validate_csrf_token', return_value=True):
                response = self.client.post('/api/admin/routes',
                                          data=json.dumps(invalid_route_data),
                                          content_type='application/json')
                
                self.assertEqual(response.status_code, 400)
                data = json.loads(response.data)
                self.assertFalse(data['success'])


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)