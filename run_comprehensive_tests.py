#!/usr/bin/env python3
"""
Comprehensive test runner for authentication system.
Runs all authentication tests and generates a detailed report.
"""

import unittest
import sys
import os
import time
import json
from datetime import datetime
from io import StringIO

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import all test modules with error handling
test_modules_available = {}

try:
    import test_auth_endpoints
    test_modules_available['test_auth_endpoints'] = test_auth_endpoints
except ImportError as e:
    print(f"Warning: Could not import test_auth_endpoints: {e}")

try:
    import test_auth_middleware
    test_modules_available['test_auth_middleware'] = test_auth_middleware
except ImportError as e:
    print(f"Warning: Could not import test_auth_middleware: {e}")

try:
    import test_security_headers
    test_modules_available['test_security_headers'] = test_security_headers
except ImportError as e:
    print(f"Warning: Could not import test_security_headers: {e}")

try:
    import test_session_timeout
    test_modules_available['test_session_timeout'] = test_session_timeout
except ImportError as e:
    print(f"Warning: Could not import test_session_timeout: {e}")

try:
    import test_password_change
    test_modules_available['test_password_change'] = test_password_change
except ImportError as e:
    print(f"Warning: Could not import test_password_change: {e}")

try:
    import test_end_to_end_authentication
    test_modules_available['test_end_to_end_authentication'] = test_end_to_end_authentication
except ImportError as e:
    print(f"Warning: Could not import test_end_to_end_authentication (likely missing selenium): {e}")

try:
    import test_security_validation
    test_modules_available['test_security_validation'] = test_security_validation
except ImportError as e:
    print(f"Warning: Could not import test_security_validation: {e}")

try:
    import test_browser_compatibility
    test_modules_available['test_browser_compatibility'] = test_browser_compatibility
except ImportError as e:
    print(f"Warning: Could not import test_browser_compatibility (likely missing selenium): {e}")

class ComprehensiveTestRunner:
    """Comprehensive test runner for authentication system."""
    
    def __init__(self):
        self.results = {}
        self.start_time = None
        self.end_time = None
        
        # Test modules to run (only available ones)
        self.test_modules = []
        
        module_mapping = [
            ('Authentication Endpoints', 'test_auth_endpoints'),
            ('Authentication Middleware', 'test_auth_middleware'),
            ('Security Headers', 'test_security_headers'),
            ('Session Timeout', 'test_session_timeout'),
            ('Password Change', 'test_password_change'),
            ('End-to-End Authentication', 'test_end_to_end_authentication'),
            ('Security Validation', 'test_security_validation'),
            ('Browser Compatibility', 'test_browser_compatibility'),
        ]
        
        for test_name, module_name in module_mapping:
            if module_name in test_modules_available:
                self.test_modules.append((test_name, test_modules_available[module_name]))
    
    def run_all_tests(self):
        """Run all authentication tests."""
        print("🔐 Comprehensive Authentication System Tests")
        print("=" * 60)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        self.start_time = time.time()
        
        for test_name, test_module in self.test_modules:
            print(f"🧪 Running {test_name} Tests...")
            print("-" * 40)
            
            try:
                result = self._run_test_module(test_module)
                self.results[test_name] = result
                
                # Print immediate results
                self._print_test_result(test_name, result)
                print()
                
            except Exception as e:
                print(f"❌ Failed to run {test_name}: {e}")
                self.results[test_name] = {
                    'error': str(e),
                    'tests_run': 0,
                    'failures': 0,
                    'errors': 1,
                    'skipped': 0,
                    'success_rate': 0
                }
                print()
        
        self.end_time = time.time()
        
        # Generate comprehensive report
        self._generate_report()
    
    def _run_test_module(self, test_module):
        """Run tests from a specific module."""
        # Capture test output
        test_output = StringIO()
        
        # Create test suite from module
        loader = unittest.TestLoader()
        suite = loader.loadTestsFromModule(test_module)
        
        # Run tests
        runner = unittest.TextTestRunner(
            stream=test_output,
            verbosity=2,
            buffer=True
        )
        
        result = runner.run(suite)
        
        # Calculate success rate
        success_rate = 0
        if result.testsRun > 0:
            successful_tests = result.testsRun - len(result.failures) - len(result.errors)
            success_rate = (successful_tests / result.testsRun) * 100
        
        return {
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': success_rate,
            'failure_details': [str(failure[1]) for failure in result.failures],
            'error_details': [str(error[1]) for error in result.errors],
            'output': test_output.getvalue()
        }
    
    def _print_test_result(self, test_name, result):
        """Print immediate test result."""
        if 'error' in result:
            print(f"❌ {test_name}: Failed to run - {result['error']}")
            return
        
        tests_run = result['tests_run']
        failures = result['failures']
        errors = result['errors']
        skipped = result['skipped']
        success_rate = result['success_rate']
        
        # Determine status icon
        if success_rate >= 90:
            status = "✅"
        elif success_rate >= 70:
            status = "⚠️"
        else:
            status = "❌"
        
        print(f"{status} {test_name}:")
        print(f"   Tests run: {tests_run}")
        print(f"   Failures: {failures}")
        print(f"   Errors: {errors}")
        print(f"   Skipped: {skipped}")
        print(f"   Success rate: {success_rate:.1f}%")
        
        # Show failure/error details if any
        if failures > 0:
            print(f"   ⚠️  {failures} test(s) failed")
        if errors > 0:
            print(f"   ❌ {errors} test(s) had errors")
    
    def _generate_report(self):
        """Generate comprehensive test report."""
        print("📊 Comprehensive Test Report")
        print("=" * 60)
        
        # Calculate overall statistics
        total_tests = sum(r.get('tests_run', 0) for r in self.results.values())
        total_failures = sum(r.get('failures', 0) for r in self.results.values())
        total_errors = sum(r.get('errors', 0) for r in self.results.values())
        total_skipped = sum(r.get('skipped', 0) for r in self.results.values())
        
        overall_success_rate = 0
        if total_tests > 0:
            successful_tests = total_tests - total_failures - total_errors
            overall_success_rate = (successful_tests / total_tests) * 100
        
        duration = self.end_time - self.start_time
        
        # Print overall summary
        print(f"Test Duration: {duration:.2f} seconds")
        print(f"Total Tests: {total_tests}")
        print(f"Successful: {total_tests - total_failures - total_errors}")
        print(f"Failed: {total_failures}")
        print(f"Errors: {total_errors}")
        print(f"Skipped: {total_skipped}")
        print(f"Overall Success Rate: {overall_success_rate:.1f}%")
        print()
        
        # Test category breakdown
        print("📋 Test Category Breakdown:")
        print("-" * 40)
        
        for test_name, result in self.results.items():
            if 'error' in result:
                print(f"❌ {test_name}: Failed to run")
                continue
            
            success_rate = result['success_rate']
            
            if success_rate >= 90:
                status = "✅ EXCELLENT"
            elif success_rate >= 80:
                status = "✅ GOOD"
            elif success_rate >= 70:
                status = "⚠️  NEEDS ATTENTION"
            elif success_rate >= 50:
                status = "⚠️  POOR"
            else:
                status = "❌ CRITICAL"
            
            print(f"{status} - {test_name}: {success_rate:.1f}% ({result['tests_run']} tests)")
        
        print()
        
        # Security assessment
        self._generate_security_assessment()
        
        # Recommendations
        self._generate_recommendations()
        
        # Save detailed report to file
        self._save_detailed_report()
    
    def _generate_security_assessment(self):
        """Generate security-specific assessment."""
        print("🛡️  Security Assessment:")
        print("-" * 40)
        
        security_categories = [
            'Security Headers',
            'Security Validation',
            'Authentication Middleware',
            'Password Change'
        ]
        
        security_scores = []
        
        for category in security_categories:
            if category in self.results and 'success_rate' in self.results[category]:
                score = self.results[category]['success_rate']
                security_scores.append(score)
                
                if score >= 90:
                    status = "🔒 SECURE"
                elif score >= 80:
                    status = "🔐 MOSTLY SECURE"
                elif score >= 70:
                    status = "⚠️  SECURITY CONCERNS"
                else:
                    status = "🚨 SECURITY ISSUES"
                
                print(f"{status} - {category}: {score:.1f}%")
        
        if security_scores:
            avg_security_score = sum(security_scores) / len(security_scores)
            print(f"\n🔐 Overall Security Score: {avg_security_score:.1f}%")
            
            if avg_security_score >= 90:
                print("✅ Authentication system has excellent security posture")
            elif avg_security_score >= 80:
                print("✅ Authentication system has good security with minor improvements needed")
            elif avg_security_score >= 70:
                print("⚠️  Authentication system has security concerns that should be addressed")
            else:
                print("🚨 Authentication system has critical security issues requiring immediate attention")
        
        print()
    
    def _generate_recommendations(self):
        """Generate recommendations based on test results."""
        print("💡 Recommendations:")
        print("-" * 40)
        
        recommendations = []
        
        # Check for failed test categories
        for test_name, result in self.results.items():
            if 'error' in result:
                recommendations.append(f"🔧 Fix test infrastructure for {test_name}")
                continue
            
            success_rate = result.get('success_rate', 0)
            failures = result.get('failures', 0)
            errors = result.get('errors', 0)
            
            if success_rate < 80:
                recommendations.append(f"🔍 Review and fix failing tests in {test_name} ({success_rate:.1f}% success rate)")
            
            if errors > 0:
                recommendations.append(f"🐛 Fix {errors} error(s) in {test_name}")
            
            if failures > 0:
                recommendations.append(f"⚠️  Address {failures} test failure(s) in {test_name}")
        
        # Security-specific recommendations
        security_result = self.results.get('Security Validation', {})
        if security_result.get('success_rate', 100) < 90:
            recommendations.append("🛡️  Strengthen security validation mechanisms")
        
        browser_result = self.results.get('Browser Compatibility', {})
        if browser_result.get('success_rate', 100) < 80:
            recommendations.append("🌐 Improve browser compatibility and responsive design")
        
        # General recommendations
        total_tests = sum(r.get('tests_run', 0) for r in self.results.values())
        total_failures = sum(r.get('failures', 0) for r in self.results.values())
        total_errors = sum(r.get('errors', 0) for r in self.results.values())
        
        overall_success_rate = 0
        if total_tests > 0:
            successful_tests = total_tests - total_failures - total_errors
            overall_success_rate = (successful_tests / total_tests) * 100
        
        if overall_success_rate < 90:
            recommendations.append("📈 Increase overall test coverage and fix failing tests")
        
        if not recommendations:
            recommendations.append("🎉 All tests are performing well! Consider adding more edge case tests.")
        
        for i, recommendation in enumerate(recommendations, 1):
            print(f"{i}. {recommendation}")
        
        print()
    
    def _save_detailed_report(self):
        """Save detailed report to JSON file."""
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': self.end_time - self.start_time,
            'overall_stats': {
                'total_tests': sum(r.get('tests_run', 0) for r in self.results.values()),
                'total_failures': sum(r.get('failures', 0) for r in self.results.values()),
                'total_errors': sum(r.get('errors', 0) for r in self.results.values()),
                'total_skipped': sum(r.get('skipped', 0) for r in self.results.values()),
            },
            'test_results': self.results
        }
        
        # Calculate overall success rate
        total_tests = report_data['overall_stats']['total_tests']
        if total_tests > 0:
            successful = total_tests - report_data['overall_stats']['total_failures'] - report_data['overall_stats']['total_errors']
            report_data['overall_stats']['success_rate'] = (successful / total_tests) * 100
        else:
            report_data['overall_stats']['success_rate'] = 0
        
        # Save to file
        report_filename = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        try:
            with open(report_filename, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            
            print(f"📄 Detailed report saved to: {report_filename}")
            
        except Exception as e:
            print(f"⚠️  Could not save detailed report: {e}")
        
        print()


def run_quick_tests():
    """Run a quick subset of critical tests."""
    print("⚡ Quick Authentication Tests")
    print("=" * 40)
    
    # Critical test modules for quick run (only available ones)
    quick_modules = []
    
    quick_module_mapping = [
        ('Authentication Endpoints', 'test_auth_endpoints'),
        ('Authentication Middleware', 'test_auth_middleware'),
        ('Security Headers', 'test_security_headers'),
    ]
    
    for test_name, module_name in quick_module_mapping:
        if module_name in test_modules_available:
            quick_modules.append((test_name, test_modules_available[module_name]))
    
    for test_name, test_module in quick_modules:
        print(f"🧪 {test_name}...")
        
        try:
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromModule(test_module)
            runner = unittest.TextTestRunner(verbosity=1, stream=open(os.devnull, 'w'))
            result = runner.run(suite)
            
            success_rate = 0
            if result.testsRun > 0:
                successful = result.testsRun - len(result.failures) - len(result.errors)
                success_rate = (successful / result.testsRun) * 100
            
            status = "✅" if success_rate >= 80 else "⚠️" if success_rate >= 60 else "❌"
            print(f"   {status} {success_rate:.1f}% ({result.testsRun} tests)")
            
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    print("\n✅ Quick tests completed!")


def main():
    """Main entry point for test runner."""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--quick':
            run_quick_tests()
            return
        elif sys.argv[1] == '--browser-only':
            if 'test_browser_compatibility' in test_modules_available:
                test_modules_available['test_browser_compatibility'].run_browser_compatibility_tests()
            else:
                print("Browser compatibility tests not available (missing selenium dependency)")
            return
        elif sys.argv[1] == '--help':
            print("Authentication Test Runner")
            print("=" * 30)
            print("Usage:")
            print("  python run_comprehensive_tests.py           # Run all tests")
            print("  python run_comprehensive_tests.py --quick   # Run quick tests")
            print("  python run_comprehensive_tests.py --browser-only  # Browser tests only")
            print("  python run_comprehensive_tests.py --help    # Show this help")
            return
    
    # Run comprehensive tests
    runner = ComprehensiveTestRunner()
    runner.run_all_tests()


if __name__ == '__main__':
    main()