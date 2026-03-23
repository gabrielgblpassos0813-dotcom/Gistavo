import requests
import sys
import json
from datetime import datetime
import base64

class GANOHAPITester:
    def __init__(self, base_url="https://ganoh-manager.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_order_ids = {}  # Store order IDs by store
        self.gestor_auth = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, auth=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            kwargs = {'headers': headers}
            if params:
                kwargs['params'] = params
            if data:
                kwargs['json'] = data
            if auth:
                kwargs['auth'] = auth

            if method == 'GET':
                response = requests.get(url, **kwargs)
            elif method == 'POST':
                response = requests.post(url, **kwargs)
            elif method == 'PATCH':
                response = requests.patch(url, **kwargs)
            elif method == 'PUT':
                response = requests.put(url, **kwargs)
            elif method == 'DELETE':
                response = requests.delete(url, **kwargs)

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

    def test_get_stores(self):
        """Test getting stores list"""
        success, response = self.run_test("Get Stores", "GET", "stores", 200)
        if success and 'stores' in response:
            stores = response['stores']
            if 'runner' in stores and 'gym-londres' in stores:
                print(f"   ✅ Found both stores: Runner and GYM Londres")
                return True
            else:
                print(f"   ❌ Missing required stores")
                return False
        return False

    def test_get_menu_runner(self):
        """Test getting menu for Runner store"""
        success, response = self.run_test("Get Runner Menu", "GET", "menu/runner", 200)
        if success and 'items' in response and 'store' in response:
            print(f"   ✅ Runner menu has {len(response['items'])} items")
            print(f"   ✅ Store info: {response['store']['name']}")
            return True
        return False

    def test_get_menu_gym_londres(self):
        """Test getting menu for GYM Londres store"""
        success, response = self.run_test("Get GYM Londres Menu", "GET", "menu/gym-londres", 200)
        if success and 'items' in response and 'store' in response:
            print(f"   ✅ GYM Londres menu has {len(response['items'])} items")
            print(f"   ✅ Store info: {response['store']['name']}")
            return True
        return False

    def test_create_order_with_payment_method(self):
        """Test creating orders with different payment methods"""
        payment_methods = ["pix", "debit", "credit", "cash"]
        stores = ["runner", "gym-londres"]
        
        for store in stores:
            for payment_method in payment_methods:
                order_data = {
                    "store": store,
                    "customer_name": f"Test Customer {payment_method.upper()}",
                    "items": [
                        {
                            "menu_item_id": "2",  # Use item 2 instead of 1 (which has 0 stock)
                            "name": "Frango, Mussarela, Tomate e Orégano",
                            "price": 26.00,
                            "quantity": 1
                        }
                    ],
                    "total": 26.00,
                    "payment_method": payment_method
                }
                
                success, response = self.run_test(
                    f"Create Order - {store} - {payment_method.upper()}", 
                    "POST", 
                    "orders", 
                    200, 
                    data=order_data
                )
                
                if success and 'id' in response:
                    if store not in self.created_order_ids:
                        self.created_order_ids[store] = []
                    self.created_order_ids[store].append(response['id'])
                    
                    # Verify payment method is stored
                    if response.get('payment_method') == payment_method:
                        print(f"   ✅ Order created with payment method: {payment_method}")
                    else:
                        print(f"   ❌ Payment method not stored correctly")
                        return False
                else:
                    return False
        return True

    def test_get_orders_by_store(self):
        """Test getting orders by store"""
        stores = ["runner", "gym-londres"]
        
        for store in stores:
            success, response = self.run_test(f"Get Orders - {store}", "GET", f"orders/{store}", 200)
            if success and 'orders' in response:
                orders = response['orders']
                print(f"   ✅ {store} has {len(orders)} orders")
                
                # Check if orders have payment_method field
                if orders:
                    first_order = orders[0]
                    if 'payment_method' in first_order:
                        print(f"   ✅ Orders include payment_method: {first_order['payment_method']}")
                    else:
                        print(f"   ❌ Orders missing payment_method field")
                        return False
            else:
                return False
        return True

    def test_gestor_login(self):
        """Test gestor authentication"""
        auth = ('gestor', 'ganoh2024')
        success, response = self.run_test(
            "Gestor Login", 
            "GET", 
            "gestor/dashboard", 
            200, 
            auth=auth
        )
        
        if success:
            self.gestor_auth = auth
            print(f"   ✅ Gestor login successful")
            return True
        return False

    def test_gestor_dashboard(self):
        """Test gestor dashboard data"""
        if not self.gestor_auth:
            print("   ⚠️  Skipping - No gestor auth available")
            return True
            
        success, response = self.run_test(
            "Gestor Dashboard", 
            "GET", 
            "gestor/dashboard", 
            200, 
            auth=self.gestor_auth
        )
        
        if success and 'stores' in response:
            stores = response['stores']
            
            # Check both stores are present
            if 'runner' in stores and 'gym-londres' in stores:
                print(f"   ✅ Dashboard shows both stores")
                
                # Check payment method breakdown
                for store_key, store_data in stores.items():
                    if 'today' in store_data and 'by_payment_method' in store_data['today']:
                        payment_methods = store_data['today']['by_payment_method']
                        expected_methods = ['pix', 'debit', 'credit', 'cash']
                        
                        if all(method in payment_methods for method in expected_methods):
                            print(f"   ✅ {store_key} has all payment methods in dashboard")
                        else:
                            print(f"   ❌ {store_key} missing payment methods")
                            return False
                    
                    # Check top/low products
                    if 'top_products' in store_data and 'low_products' in store_data:
                        print(f"   ✅ {store_key} has top/low products data")
                    else:
                        print(f"   ❌ {store_key} missing products analytics")
                        return False
                
                return True
            else:
                print(f"   ❌ Dashboard missing stores")
                return False
        return False

    def test_stock_initialization(self):
        """Test stock initialization for both stores"""
        stores = ["runner", "gym-londres"]
        
        for store in stores:
            success, response = self.run_test(
                f"Initialize Stock - {store}", 
                "POST", 
                f"stock/{store}/initialize", 
                200
            )
            
            if success:
                print(f"   ✅ Stock initialized for {store}")
            else:
                return False
        return True

    def test_get_stock(self):
        """Test getting stock for both stores"""
        stores = ["runner", "gym-londres"]
        
        for store in stores:
            success, response = self.run_test(f"Get Stock - {store}", "GET", f"stock/{store}", 200)
            
            if success and 'stock' in response:
                stock_items = response['stock']
                print(f"   ✅ {store} has {len(stock_items)} stock items")
                
                # Check stock item structure
                if stock_items:
                    first_item = stock_items[0]
                    required_fields = ['menu_item_id', 'quantity', 'name', 'category']
                    
                    if all(field in first_item for field in required_fields):
                        print(f"   ✅ Stock items have required fields")
                    else:
                        print(f"   ❌ Stock items missing required fields")
                        return False
            else:
                return False
        return True

    def test_update_stock(self):
        """Test updating stock quantities"""
        # Test updating stock for runner store
        success, response = self.run_test(
            "Update Stock Quantity", 
            "PUT", 
            "stock/runner/1", 
            200,
            data={"quantity": 0}
        )
        
        if success:
            print(f"   ✅ Stock updated successfully")
            return True
        return False

    def test_menu_availability_with_zero_stock(self):
        """Test that products with 0 stock don't appear as available in menu"""
        # First set item 1 to 0 stock
        self.run_test("Set Item 1 to Zero Stock", "PUT", "stock/runner/1", 200, data={"quantity": 0})
        
        # Then check menu
        success, response = self.run_test("Check Menu Availability", "GET", "menu/runner", 200)
        
        if success and 'items' in response:
            items = response['items']
            
            # Find item with ID "1"
            item_1 = next((item for item in items if item['id'] == '1'), None)
            
            if item_1:
                if item_1.get('available') == False and item_1.get('stock') == 0:
                    print(f"   ✅ Item with 0 stock is marked as unavailable")
                    return True
                else:
                    print(f"   ❌ Item with 0 stock is still available: {item_1}")
                    return False
            else:
                print(f"   ❌ Could not find item 1 in menu")
                return False
        return False

    def test_kitchen_stats(self):
        """Test kitchen statistics for both stores"""
        stores = ["runner", "gym-londres"]
        
        for store in stores:
            success, response = self.run_test(f"Kitchen Stats - {store}", "GET", f"kitchen/{store}/stats", 200)
            
            if success:
                expected_keys = ['pending', 'preparing', 'ready']
                if all(key in response for key in expected_keys):
                    print(f"   ✅ {store} kitchen stats: {response}")
                else:
                    print(f"   ❌ Missing keys in {store} kitchen stats")
                    return False
            else:
                return False
        return True

def main():
    print("🚀 Starting GANOH Café Bistrô API Tests")
    print("Testing digital menu system for 2 stores with payment methods and stock management")
    print("=" * 80)
    
    tester = GANOHAPITester()
    
    # Run all tests in logical order
    tests = [
        tester.test_api_root,
        tester.test_get_stores,
        tester.test_get_menu_runner,
        tester.test_get_menu_gym_londres,
        tester.test_stock_initialization,
        tester.test_get_stock,
        tester.test_update_stock,
        tester.test_menu_availability_with_zero_stock,
        tester.test_create_order_with_payment_method,
        tester.test_get_orders_by_store,
        tester.test_kitchen_stats,
        tester.test_gestor_login,
        tester.test_gestor_dashboard,
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
    print("\n" + "=" * 80)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())