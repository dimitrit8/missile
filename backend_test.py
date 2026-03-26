import requests
import sys
from datetime import datetime

class MissileTrackingAPITester:
    def __init__(self, base_url="https://war-stats-live.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, expected_fields=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Check response structure if expected_fields provided
                if expected_fields and response.status_code == 200:
                    try:
                        json_data = response.json()
                        if isinstance(json_data, list) and len(json_data) > 0:
                            # Check first item in list
                            item = json_data[0]
                            for field in expected_fields:
                                if field not in item:
                                    print(f"⚠️  Warning: Missing field '{field}' in response")
                        elif isinstance(json_data, dict):
                            # Check dict fields
                            for field in expected_fields:
                                if field not in json_data:
                                    print(f"⚠️  Warning: Missing field '{field}' in response")
                        
                        print(f"   Response size: {len(json_data) if isinstance(json_data, list) else 'single object'}")
                    except Exception as e:
                        print(f"⚠️  Warning: Could not parse JSON response: {e}")
                        
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "url": url
                })

            return success, response.json() if success and response.status_code == 200 else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.failed_tests.append({"test": name, "error": "timeout", "url": url})
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            self.failed_tests.append({"test": name, "error": "connection_error", "url": url})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"test": name, "error": str(e), "url": url})
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        return success

    def test_conflicts_endpoint(self):
        """Test conflicts endpoint"""
        success, response = self.run_test(
            "Get Conflicts",
            "GET",
            "conflicts",
            200,
            expected_fields=["id", "name", "regions", "start_date", "total_missiles", "total_intercepted", "total_casualties", "total_deceased", "total_cost"]
        )
        
        if success and response:
            print(f"   Found {len(response)} conflicts")
            expected_conflicts = ["russia-ukraine", "israel-hamas", "iran-israel"]
            found_conflicts = [c["id"] for c in response]
            for expected in expected_conflicts:
                if expected in found_conflicts:
                    print(f"   ✅ Found conflict: {expected}")
                else:
                    print(f"   ❌ Missing conflict: {expected}")
        
        return success

    def test_strikes_endpoint(self):
        """Test strikes endpoint"""
        success, response = self.run_test(
            "Get All Strikes",
            "GET",
            "strikes",
            200,
            expected_fields=["id", "conflict_id", "date", "location", "country", "latitude", "longitude", "missile_type", "missile_cost", "intercepted", "casualties", "deceased", "description"]
        )
        
        if success and response:
            print(f"   Found {len(response)} strikes")
            
            # Test filtering by conflict
            success2, response2 = self.run_test(
                "Get Strikes by Conflict",
                "GET",
                "strikes?conflict_id=russia-ukraine",
                200
            )
            
            if success2 and response2:
                print(f"   Found {len(response2)} Russia-Ukraine strikes")
        
        return success

    def test_missile_types_endpoint(self):
        """Test missile types endpoint"""
        success, response = self.run_test(
            "Get Missile Types",
            "GET",
            "missile-types",
            200,
            expected_fields=["id", "name", "type", "country", "cost"]
        )
        
        if success and response:
            print(f"   Found {len(response)} missile types")
            offensive_types = [mt for mt in response if mt["type"] != "Interceptor"]
            interceptor_types = [mt for mt in response if mt["type"] == "Interceptor"]
            print(f"   Offensive missiles: {len(offensive_types)}")
            print(f"   Interceptors: {len(interceptor_types)}")
        
        return success

    def test_statistics_endpoint(self):
        """Test statistics endpoint"""
        success, response = self.run_test(
            "Get Statistics",
            "GET",
            "statistics",
            200,
            expected_fields=["total_conflicts", "total_strikes", "total_intercepted", "interception_rate", "total_casualties", "total_deceased", "total_missile_cost", "total_defense_cost", "strikes_by_conflict", "strikes_by_month"]
        )
        
        if success and response:
            print(f"   Total conflicts: {response.get('total_conflicts', 'N/A')}")
            print(f"   Total strikes: {response.get('total_strikes', 'N/A')}")
            print(f"   Interception rate: {response.get('interception_rate', 'N/A')}%")
            print(f"   Total casualties: {response.get('total_casualties', 'N/A')}")
            print(f"   Total deceased: {response.get('total_deceased', 'N/A')}")
            print(f"   Missile cost: ${response.get('total_missile_cost', 0) / 1e9:.2f}B")
            print(f"   Defense cost: ${response.get('total_defense_cost', 0) / 1e9:.2f}B")
            
            # Validate statistics make sense
            if response.get('total_intercepted', 0) > response.get('total_strikes', 0):
                print(f"   ⚠️  Warning: More intercepted than total strikes")
            
            if response.get('interception_rate', 0) > 100:
                print(f"   ⚠️  Warning: Interception rate over 100%")
        
        return success

def main():
    print("🚀 Starting Missile Tracking API Tests")
    print("=" * 50)
    
    # Setup
    tester = MissileTrackingAPITester()
    
    # Run all tests
    tests = [
        tester.test_root_endpoint,
        tester.test_conflicts_endpoint,
        tester.test_strikes_endpoint,
        tester.test_missile_types_endpoint,
        tester.test_statistics_endpoint
    ]
    
    for test in tests:
        test()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed tests:")
        for failed in tester.failed_tests:
            error_msg = failed.get('error', f"Expected {failed.get('expected')}, got {failed.get('actual')}")
            print(f"   - {failed['test']}: {error_msg}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())