#!/usr/bin/env python3
"""
Execute comprehensive authentication tests and generate detailed report.
This script runs all available tests and creates a comprehensive security assessment.
"""

import unittest
import sys
import os
import time
import json
import subprocess
from datetime import datetime
from io import StringIO

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def run_test_module(module_name, description):
    """Run a specific test module and return results."""
    print(f"🧪 Running {description}...")
    
    try:
        # Import the module dynamically
        module = __import__(module_name)
        
        # Create test suite
        loader = unittest.TestLoader()
        suite = loader.loadTestsFromModule(module)
        
        # Capture output
        test_output = StringIO()
        
        # Run tests
        runner = unittest.TextTestRunner(
            stream=test_output,
            verbosity=2,
            buffer=True
        )
        
        start_time = time.time()
        result = runner.run(suite)
        end_time = time.time()
        
        # Calculate success rate
        success_rate = 0
        if result.testsRun > 0:
            successful_tests = result.testsRun - len(result.failures) - len(result.errors)
            success_rate = (successful_tests / result.testsRun) * 100
        
        return {
            'module': module_name,
            'description': description,
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': success_rate,
            'duration': end_time - start_time,
            'failure_details': [str(failure[1]) for failure in result.failures],
            'error_details': [str(error[1]) for error in result.errors],
            'output': test_output.getvalue(),
            'status': 'success' if success_rate >= 80 else 'warning' if success_rate >= 60 else 'critical'
        }
        
    except ImportError as e:
        return {
            'module': module_name,
            'description': description,
            'error': f"Module not available: {e}",
            'tests_run': 0,
            'failures': 0,
            'errors': 1,
            'skipped': 0,
            'success_rate': 0,
            'duration': 0,
            'status': 'unavailable'
        }
    except Exception as e:
        return {
            'module': module_name,
            'description': description,
            'error': f"Test execution failed: {e}",
            'tests_run': 0,
            'failures': 0,
            'errors': 1,
            'skipped': 0,
            'success_rate': 0,
            'duration': 0,
            'status': 'failed'
        }

def print_test_result(result):
    """Print formatted test result."""
    status_icons = {
        'success': '✅',
        'warning': '⚠️',
        'critical': '❌',
        'unavailable': '⏸️',
        'failed': '💥'
    }
    
    icon = status_icons.get(result['status'], '❓')
    
    if 'error' in result:
        print(f"{icon} {result['description']}: {result['error']}")
        return
    
    print(f"{icon} {result['description']}:")
    print(f"   Tests: {result['tests_run']}")
    print(f"   Failures: {result['failures']}")
    print(f"   Errors: {result['errors']}")
    print(f"   Success Rate: {result['success_rate']:.1f}%")
    print(f"   Duration: {result['duration']:.2f}s")

def generate_security_assessment(results):
    """Generate security assessment based on test results."""
    print("\n🛡️  Security Assessment")
    print("=" * 50)
    
    security_modules = [
        'test_auth_endpoints',
        'test_auth_middleware', 
        'test_security_headers',
        'test_security_validation',
        'test_comprehensive_security'
    ]
    
    security_scores = []
    security_issues = []
    
    for result in results:
        if result['module'] in security_modules and result['status'] != 'unavailable':
            score = result['success_rate']
            security_scores.append(score)
            
            if score < 80:
                security_issues.append({
                    'module': result['description'],
                    'score': score,
                    'severity': 'critical' if score < 50 else 'high' if score < 70 else 'medium'
                })
    
    if security_scores:
        avg_security_score = sum(security_scores) / len(security_scores)
        
        print(f"Overall Security Score: {avg_security_score:.1f}%")
        
        if avg_security_score >= 90:
            print("🔒 EXCELLENT - Authentication system has excellent security posture")
        elif avg_security_score >= 80:
            print("🔐 GOOD - Authentication system has good security with minor improvements needed")
        elif avg_security_score >= 70:
            print("⚠️  MODERATE - Authentication system has security concerns that should be addressed")
        elif avg_security_score >= 50:
            print("🚨 POOR - Authentication system has significant security issues")
        else:
            print("💀 CRITICAL - Authentication system has critical security vulnerabilities")
        
        if security_issues:
            print(f"\n🚨 Security Issues Found ({len(security_issues)}):")
            for issue in security_issues:
                severity_icon = "💀" if issue['severity'] == 'critical' else "🚨" if issue['severity'] == 'high' else "⚠️"
                print(f"   {severity_icon} {issue['module']}: {issue['score']:.1f}% ({issue['severity'].upper()})")
    else:
        print("⚠️  No security test results available")

def generate_recommendations(results):
    """Generate recommendations based on test results."""
    print("\n💡 Recommendations")
    print("=" * 50)
    
    recommendations = []
    
    # Analyze results and generate recommendations
    for result in results:
        if result['status'] == 'unavailable':
            if 'selenium' in result.get('error', '').lower():
                recommendations.append("🌐 Install Selenium WebDriver for browser compatibility testing")
            else:
                recommendations.append(f"🔧 Fix missing dependency for {result['description']}")
        
        elif result['status'] in ['critical', 'failed']:
            recommendations.append(f"🚨 Critical: Fix failing tests in {result['description']} ({result['success_rate']:.1f}% success rate)")
        
        elif result['status'] == 'warning':
            recommendations.append(f"⚠️  Improve test coverage in {result['description']} ({result['success_rate']:.1f}% success rate)")
    
    # Security-specific recommendations
    security_results = [r for r in results if 'security' in r['module'].lower() and r['status'] != 'unavailable']
    if security_results:
        avg_security = sum(r['success_rate'] for r in security_results) / len(security_results)
        if avg_security < 80:
            recommendations.append("🛡️  Strengthen security validation and protection mechanisms")
    
    # Performance recommendations
    slow_tests = [r for r in results if r.get('duration', 0) > 30 and r['status'] != 'unavailable']
    if slow_tests:
        recommendations.append("⚡ Optimize slow-running tests for better performance")
    
    # General recommendations
    total_tests = sum(r['tests_run'] for r in results if r['status'] != 'unavailable')
    total_failures = sum(r['failures'] for r in results if r['status'] != 'unavailable')
    total_errors = sum(r['errors'] for r in results if r['status'] != 'unavailable')
    
    if total_tests > 0:
        overall_success = ((total_tests - total_failures - total_errors) / total_tests) * 100
        if overall_success < 90:
            recommendations.append("📈 Increase overall test coverage and fix failing tests")
    
    if not recommendations:
        recommendations.append("🎉 All tests are performing well! Consider adding more edge case tests.")
    
    for i, recommendation in enumerate(recommendations, 1):
        print(f"{i}. {recommendation}")

def save_detailed_report(results):
    """Save detailed test report to file."""
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'total_duration': sum(r.get('duration', 0) for r in results),
        'summary': {
            'total_modules': len(results),
            'available_modules': len([r for r in results if r['status'] != 'unavailable']),
            'total_tests': sum(r['tests_run'] for r in results),
            'total_failures': sum(r['failures'] for r in results),
            'total_errors': sum(r['errors'] for r in results),
            'total_skipped': sum(r['skipped'] for r in results),
        },
        'results': results
    }
    
    # Calculate overall success rate
    total_tests = report_data['summary']['total_tests']
    if total_tests > 0:
        successful = total_tests - report_data['summary']['total_failures'] - report_data['summary']['total_errors']
        report_data['summary']['overall_success_rate'] = (successful / total_tests) * 100
    else:
        report_data['summary']['overall_success_rate'] = 0
    
    # Save to file
    report_filename = f"authentication_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    try:
        with open(report_filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n📄 Detailed report saved to: {report_filename}")
        return report_filename
        
    except Exception as e:
        print(f"\n⚠️  Could not save detailed report: {e}")
        return None

def main():
    """Main execution function."""
    print("🔐 Comprehensive Authentication System Test Suite")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Define test modules to run
    test_modules = [
        ('test_auth_endpoints', 'Authentication Endpoints'),
        ('test_auth_middleware', 'Authentication Middleware'),
        ('test_security_headers', 'Security Headers'),
        ('test_session_timeout', 'Session Timeout'),
        ('test_password_change', 'Password Change'),
        ('test_comprehensive_security', 'Comprehensive Security'),
        ('test_security_validation', 'Security Validation'),
        ('test_end_to_end_authentication', 'End-to-End Authentication'),
        ('test_browser_compatibility', 'Browser Compatibility'),
    ]
    
    results = []
    start_time = time.time()
    
    # Run each test module
    for module_name, description in test_modules:
        result = run_test_module(module_name, description)
        results.append(result)
        print_test_result(result)
        print()
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    # Generate comprehensive report
    print("📊 Test Execution Summary")
    print("=" * 50)
    
    available_results = [r for r in results if r['status'] != 'unavailable']
    total_tests = sum(r['tests_run'] for r in available_results)
    total_failures = sum(r['failures'] for r in available_results)
    total_errors = sum(r['errors'] for r in available_results)
    total_skipped = sum(r['skipped'] for r in available_results)
    
    overall_success_rate = 0
    if total_tests > 0:
        successful_tests = total_tests - total_failures - total_errors
        overall_success_rate = (successful_tests / total_tests) * 100
    
    print(f"Total Duration: {total_duration:.2f} seconds")
    print(f"Test Modules: {len(available_results)}/{len(results)} available")
    print(f"Total Tests: {total_tests}")
    print(f"Successful: {total_tests - total_failures - total_errors}")
    print(f"Failed: {total_failures}")
    print(f"Errors: {total_errors}")
    print(f"Skipped: {total_skipped}")
    print(f"Overall Success Rate: {overall_success_rate:.1f}%")
    
    # Generate security assessment
    generate_security_assessment(results)
    
    # Generate recommendations
    generate_recommendations(results)
    
    # Save detailed report
    report_file = save_detailed_report(results)
    
    print(f"\n🏁 Test execution completed in {total_duration:.2f} seconds")
    
    # Return appropriate exit code
    if overall_success_rate >= 80:
        print("✅ Overall test results are satisfactory")
        return 0
    elif overall_success_rate >= 60:
        print("⚠️  Test results need attention")
        return 1
    else:
        print("❌ Critical issues found in test results")
        return 2

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)