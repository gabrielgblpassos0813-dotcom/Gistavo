import requests
import sys
import json
from datetime import datetime

class GANOHAPITester:
    def __init__(self, base_url="https://bistro-order-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_order_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response preview: {str(response_data)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error text: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_get_menu(self):
        """Test getting full menu"""
        success, response = self.run_test("Get Full Menu", "GET", "menu", 200)
        if success:
            # Validate response structure
            if 'items' in response and 'categories' in response:
                print(f"   ✅ Menu has {len(response['items'])} items and {len(response['categories'])} categories")
                return True
            else:
                print(f"   ❌ Invalid menu structure")
                return False
        return False

    def test_get_categories(self):
        """Test getting categories"""
        success, response = self.run_test("Get Categories", "GET", "categories", 200)
        if success and 'categories' in response:
            print(f"   ✅ Found {len(response['categories'])} categories")
            return True
        return False

    def test_get_menu_by_category(self):
        """Test getting menu by category"""
        category = "Omeletes, Tapiocas e Crepiocas"
        success, response = self.run_test(
            f"Get Menu by Category: {category}", 
            "GET", 
            f"menu/category/{category}", 
            200
        )
        if success and 'items' in response:
            print(f"   ✅ Found {len(response['items'])} items in category")
            return True
        return False

    def test_create_order(self):
        """Test creating a new order"""
        order_data = {
            "customer_name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "items": [
                {
                    "menu_item_id": "1",
                    "name": "Frango com Requeijão",
                    "price": 25.50,
                    "quantity": 2
                },
                {
                    "menu_item_id": "48",
                    "name": "Café Pequeno",
                    "price": 4.50,
                    "quantity": 1
                }
            ],
            "total": 55.50
        }
        
        success, response = self.run_test("Create Order", "POST", "orders", 200, data=order_data)
        if success and 'id' in response:
            self.created_order_id = response['id']
            print(f"   ✅ Order created with ID: {self.created_order_id}")
            return True
        return False

    def test_create_order_with_pickup_time(self):
        """Test creating a new order with pickup time"""
        pickup_time = "14:30"  # 2:30 PM
        order_data = {
            "customer_name": f"Test Customer Pickup {datetime.now().strftime('%H%M%S')}",
            "items": [
                {
                    "menu_item_id": "2",
                    "name": "Frango, Mussarela, Tomate e Orégano",
                    "price": 26.00,
                    "quantity": 1
                }
            ],
            "total": 26.00,
            "pickup_time": pickup_time
        }
        
        success, response = self.run_test("Create Order with Pickup Time", "POST", "orders", 200, data=order_data)
        if success and 'id' in response:
            # Verify pickup_time is in response
            if response.get('pickup_time') == pickup_time:
                print(f"   ✅ Order created with pickup time: {pickup_time}")
                
                # Store this order ID for pickup time verification test
                self.pickup_order_id = response['id']
                return True
            else:
                print(f"   ❌ Pickup time not set correctly. Expected: {pickup_time}, Got: {response.get('pickup_time')}")
                return False
        return False

    def test_get_orders(self):
        """Test getting all orders"""
        return self.run_test("Get All Orders", "GET", "orders", 200)

    def test_get_order_by_id(self):
        """Test getting specific order by ID"""
        if not self.created_order_id:
            print("   ⚠️  Skipping - No order ID available")
            return True
        
        success, response = self.run_test(
            f"Get Order by ID: {self.created_order_id}", 
            "GET", 
            f"orders/{self.created_order_id}", 
            200
        )
        if success and response.get('id') == self.created_order_id:
            print(f"   ✅ Order retrieved successfully")
            return True
        return False

    def test_update_order_status(self):
        """Test updating order status"""
        if not self.created_order_id:
            print("   ⚠️  Skipping - No order ID available")
            return True
        
        # Test updating to preparing
        success, response = self.run_test(
            f"Update Order Status to Preparing", 
            "PATCH", 
            f"orders/{self.created_order_id}/status", 
            200,
            data={"status": "preparing"}
        )
        if success and response.get('status') == 'preparing':
            print(f"   ✅ Status updated to preparing")
            
            # Test updating to ready
            success2, response2 = self.run_test(
                f"Update Order Status to Ready", 
                "PATCH", 
                f"orders/{self.created_order_id}/status", 
                200,
                data={"status": "ready"}
            )
            if success2 and response2.get('status') == 'ready':
                print(f"   ✅ Status updated to ready")
                return True
        return False

    def test_kitchen_stats(self):
        """Test kitchen statistics endpoint"""
        success, response = self.run_test("Get Kitchen Stats", "GET", "kitchen/stats", 200)
        if success:
            expected_keys = ['pending', 'preparing', 'ready', 'delivered', 'total']
            if all(key in response for key in expected_keys):
                print(f"   ✅ Kitchen stats: {response}")
                return True
            else:
                print(f"   ❌ Missing keys in kitchen stats")
        return False

    def test_delete_order(self):
        """Test deleting an order"""
        if not self.created_order_id:
            print("   ⚠️  Skipping - No order ID available")
            return True
        
        success, response = self.run_test(
            f"Delete Order: {self.created_order_id}", 
            "DELETE", 
            f"orders/{self.created_order_id}", 
            200
        )
        if success:
            print(f"   ✅ Order deleted successfully")
            return True
        return False

def main():
    print("🚀 Starting GANOH Café Bistrô API Tests")
    print("=" * 50)
    
    tester = GANOHAPITester()
    
    # Run all tests
    tests = [
        tester.test_api_root,
        tester.test_get_menu,
        tester.test_get_categories,
        tester.test_get_menu_by_category,
        tester.test_create_order,
        tester.test_get_orders,
        tester.test_get_order_by_id,
        tester.test_update_order_status,
        tester.test_kitchen_stats,
        tester.test_delete_order
    ]
    
    failed_tests = []
    
    for test in tests:
        try:
            if not test():
                failed_tests.append(test.__name__)
        except Exception as e:
            print(f"❌ {test.__name__} failed with exception: {str(e)}")
            failed_tests.append(test.__name__)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())