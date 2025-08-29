#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test POI Suggestion Algorithm
Tests for the POI suggestion backend functionality
"""

import unittest
import json
import os
import sys
from unittest.mock import Mock, patch, MagicMock
import psycopg2
from psycopg2.extras import RealDictCursor

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the POI suggestion engine
from poi_api import POISuggestionEngine


class TestPOISuggestionAlgorithm(unittest.TestCase):
    """Test suite for POI suggestion algorithm"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Mock database connection
        self.mock_db = Mock()
        self.mock_cursor = Mock()
        
        # Mock the cursor context manager properly
        cursor_context = Mock()
        cursor_context.__enter__ = Mock(return_value=self.mock_cursor)
        cursor_context.__exit__ = Mock(return_value=None)
        self.mock_db.cursor.return_value = cursor_context
        
        # Initialize suggestion engine with mock database
        self.suggestion_engine = POISuggestionEngine(self.mock_db)
        
        # Sample route coordinates (Cappadocia area)
        self.sample_route_coordinates = [
            (38.6322, 34.9115),  # Ürgüp center
            (38.6350, 34.9200),  # North of Ürgüp
            (38.6280, 34.9300),  # East of Ürgüp
            (38.6200, 34.9250),  # Southeast
            (38.6150, 34.9100)   # South
        ]
        
        # Sample POI data
        self.sample_pois = [
            {
                'id': 1,
                'name': 'Ürgüp Müzesi',
                'category': 'kulturel',
                'description': 'Yerel tarih müzesi',
                'latitude': 38.6325,
                'longitude': 34.9120,
                'distance': 50.0,  # 50 meters from route
                'avg_rating': 85.0
            },
            {
                'id': 2,
                'name': 'Kapadokya Restaurant',
                'category': 'gastronomik',
                'description': 'Yerel mutfak',
                'latitude': 38.6340,
                'longitude': 34.9180,
                'distance': 120.0,  # 120 meters from route
                'avg_rating': 92.0
            },
            {
                'id': 3,
                'name': 'Uzak POI',
                'category': 'doga_macera',
                'description': 'Çok uzak nokta',
                'latitude': 38.7000,
                'longitude': 35.0000,
                'distance': 15000.0,  # 15km from route - should be filtered out
                'avg_rating': 75.0
            }
        ]
    
    def test_calculate_distance(self):
        """Test distance calculation using Haversine formula"""
        # Test known distance between two points
        lat1, lon1 = 38.6322, 34.9115  # Ürgüp
        lat2, lon2 = 38.6350, 34.9200  # Nearby point
        
        distance = self.suggestion_engine.calculate_distance(lat1, lon1, lat2, lon2)
        
        # Distance should be approximately 700-800 meters
        self.assertGreater(distance, 600)
        self.assertLess(distance, 900)
        
        # Test same point (should be 0)
        distance_same = self.suggestion_engine.calculate_distance(lat1, lon1, lat1, lon1)
        self.assertAlmostEqual(distance_same, 0, places=1)
    
    def test_get_route_coordinates(self):
        """Test route coordinate extraction from database"""
        # Mock database response with LINESTRING geometry
        mock_geometry = "LINESTRING(34.9115 38.6322,34.9200 38.6350,34.9300 38.6280)"
        self.mock_cursor.fetchone.return_value = (mock_geometry,)
        
        coordinates = self.suggestion_engine.get_route_coordinates(1)
        
        # Verify coordinates are parsed correctly
        expected_coordinates = [
            (38.6322, 34.9115),
            (38.6350, 34.9200),
            (38.6280, 34.9300)
        ]
        
        self.assertEqual(len(coordinates), 3)
        for i, (lat, lon) in enumerate(coordinates):
            self.assertAlmostEqual(lat, expected_coordinates[i][0], places=4)
            self.assertAlmostEqual(lon, expected_coordinates[i][1], places=4)
    
    def test_get_route_coordinates_empty(self):
        """Test route coordinate extraction when no route found"""
        self.mock_cursor.fetchone.return_value = None
        
        coordinates = self.suggestion_engine.get_route_coordinates(999)
        self.assertEqual(coordinates, [])
    
    def test_find_nearby_pois(self):
        """Test finding POIs near route coordinates"""
        # Mock database response
        mock_poi_data = [
            {
                'id': 1,
                'name': 'Test POI',
                'category': 'kulturel',
                'description': 'Test description',
                'latitude': 38.6325,
                'longitude': 34.9120,
                'distance': 50.0,
                'avg_rating': 85.0
            }
        ]
        
        # Mock cursor with RealDictCursor behavior
        mock_cursor_dict = Mock()
        mock_cursor_dict.fetchall.return_value = mock_poi_data
        self.mock_db.cursor.return_value.__enter__.return_value = mock_cursor_dict
        
        nearby_pois = self.suggestion_engine.find_nearby_pois(self.sample_route_coordinates)
        
        # Verify database query was called
        self.assertTrue(mock_cursor_dict.execute.called)
        
        # Should return the mocked POI data
        self.assertEqual(len(nearby_pois), 1)
        self.assertEqual(nearby_pois[0]['name'], 'Test POI')
    
    def test_calculate_compatibility_score(self):
        """Test category compatibility scoring"""
        # Test high compatibility (same category)
        score_same = self.suggestion_engine.calculate_compatibility_score('kulturel', ['kulturel'])
        self.assertEqual(score_same, 1.0)
        
        # Test good compatibility (related categories)
        score_related = self.suggestion_engine.calculate_compatibility_score('gastronomik', ['kulturel'])
        self.assertEqual(score_related, 0.8)
        
        # Test default compatibility (unknown category)
        score_unknown = self.suggestion_engine.calculate_compatibility_score('unknown', ['kulturel'])
        self.assertEqual(score_unknown, 0.3)
        
        # Test empty route categories
        score_empty = self.suggestion_engine.calculate_compatibility_score('kulturel', [])
        self.assertEqual(score_empty, 0.5)
    
    def test_calculate_route_position_score(self):
        """Test route position scoring"""
        # Test POI in middle of route (optimal)
        middle_lat, middle_lon = 38.6280, 34.9300  # Middle coordinate
        score_middle = self.suggestion_engine.calculate_route_position_score(
            middle_lat, middle_lon, self.sample_route_coordinates
        )
        self.assertEqual(score_middle, 1.0)
        
        # Test POI at start of route (suboptimal)
        start_lat, start_lon = 38.6322, 34.9115  # First coordinate
        score_start = self.suggestion_engine.calculate_route_position_score(
            start_lat, start_lon, self.sample_route_coordinates
        )
        self.assertEqual(score_start, 0.4)
    
    def test_calculate_overall_score(self):
        """Test overall score calculation"""
        # Mock route categories
        with patch.object(self.suggestion_engine, 'get_route_categories', return_value=['kulturel']):
            poi = self.sample_pois[0]  # Cultural POI close to route
            score = self.suggestion_engine.calculate_overall_score(
                poi, 1, self.sample_route_coordinates
            )
            
            # Score should be high (close distance, good compatibility, good rating)
            self.assertGreater(score, 0.7)
            self.assertLessEqual(score, 1.0)
    
    def test_suggest_pois_for_route(self):
        """Test main POI suggestion method"""
        # Mock all dependencies
        with patch.object(self.suggestion_engine, 'get_route_coordinates', 
                         return_value=self.sample_route_coordinates):
            with patch.object(self.suggestion_engine, 'find_nearby_pois', 
                             return_value=self.sample_pois[:2]):  # Exclude distant POI
                with patch.object(self.suggestion_engine, 'get_route_categories', 
                                 return_value=['kulturel']):
                    # Mock already associated POIs query
                    self.mock_cursor.fetchall.return_value = []  # No associated POIs
                    
                    suggestions = self.suggestion_engine.suggest_pois_for_route(1, limit=5)
                    
                    # Should return suggestions
                    self.assertGreater(len(suggestions), 0)
                    self.assertLessEqual(len(suggestions), 5)
                    
                    # Verify suggestion structure
                    suggestion = suggestions[0]
                    required_fields = [
                        'poi_id', 'name', 'category', 'description',
                        'latitude', 'longitude', 'distance_from_route',
                        'compatibility_score', 'avg_rating', 'suggestion_reason'
                    ]
                    
                    for field in required_fields:
                        self.assertIn(field, suggestion)
                    
                    # Suggestions should be sorted by score (highest first)
                    if len(suggestions) > 1:
                        for i in range(len(suggestions) - 1):
                            self.assertGreaterEqual(
                                suggestions[i]['compatibility_score'],
                                suggestions[i + 1]['compatibility_score']
                            )
    
    def test_suggest_pois_excludes_associated(self):
        """Test that already associated POIs are excluded from suggestions"""
        with patch.object(self.suggestion_engine, 'get_route_coordinates', 
                         return_value=self.sample_route_coordinates):
            with patch.object(self.suggestion_engine, 'find_nearby_pois', 
                             return_value=self.sample_pois[:2]):
                with patch.object(self.suggestion_engine, 'get_route_categories', 
                                 return_value=['kulturel']):
                    # Mock that POI 1 is already associated
                    self.mock_cursor.fetchall.return_value = [(1,)]
                    
                    suggestions = self.suggestion_engine.suggest_pois_for_route(1, limit=5)
                    
                    # Should not include POI 1
                    poi_ids = [s['poi_id'] for s in suggestions]
                    self.assertNotIn(1, poi_ids)
    
    def test_generate_suggestion_reason(self):
        """Test suggestion reason generation"""
        poi = {
            'distance': 100.0,
            'category': 'kulturel',
            'avg_rating': 85.0
        }
        
        # Test high score reason
        reason_high = self.suggestion_engine._generate_suggestion_reason(poi, 0.9)
        self.assertIn('çok yakın', reason_high)
        self.assertIn('yüksek puanlı', reason_high)
        
        # Test medium score reason
        reason_medium = self.suggestion_engine._generate_suggestion_reason(poi, 0.7)
        self.assertIn('yakın', reason_medium)
        self.assertIn('uyumlu', reason_medium)
        
        # Test low score reason
        reason_low = self.suggestion_engine._generate_suggestion_reason(poi, 0.3)
        self.assertIn('alternatif', reason_low)


class TestPOISuggestionAPI(unittest.TestCase):
    """Test suite for POI suggestion API endpoint"""
    
    def setUp(self):
        """Set up test fixtures"""
        # This would require setting up Flask test client
        # For now, we'll focus on the algorithm tests
        pass
    
    def test_api_endpoint_structure(self):
        """Test that the API endpoint has correct structure"""
        # This test verifies the endpoint exists and has proper structure
        # In a real implementation, this would test the Flask route
        
        # Import the Flask app
        from poi_api import app
        
        # Check that the route is registered
        routes = [rule.rule for rule in app.url_map.iter_rules()]
        expected_route = '/api/routes/<int:route_id>/suggest-pois'
        
        # The route should exist (with Flask's internal format)
        route_exists = any('/api/routes/' in route and 'suggest-pois' in route for route in routes)
        self.assertTrue(route_exists, f"POI suggestion route not found in {routes}")


def run_poi_suggestion_tests():
    """Run all POI suggestion algorithm tests"""
    print("🧪 Running POI Suggestion Algorithm Tests...")
    
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add algorithm tests
    test_suite.addTest(unittest.makeSuite(TestPOISuggestionAlgorithm))
    test_suite.addTest(unittest.makeSuite(TestPOISuggestionAPI))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    if result.wasSuccessful():
        print("✅ All POI suggestion tests passed!")
        return True
    else:
        print(f"❌ {len(result.failures)} test(s) failed, {len(result.errors)} error(s)")
        
        # Print failure details
        for test, traceback in result.failures:
            print(f"\n❌ FAILURE: {test}")
            print(traceback)
        
        for test, traceback in result.errors:
            print(f"\n💥 ERROR: {test}")
            print(traceback)
        
        return False


if __name__ == '__main__':
    success = run_poi_suggestion_tests()
    sys.exit(0 if success else 1)