import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { Counter } from 'k6/metrics';

// Custom metrics
const productViewsCounter = new Counter('product_views');
const cartAddCounter = new Counter('cart_adds');
const searchesCounter = new Counter('searches');
const checkoutCounter = new Counter('checkouts');

// Test configuration with more detailed options
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp-up to 10 users over 2 minutes
    { duration: '5m', target: 50 },   // Steady at 50 users for 5 minutes
    { duration: '2m', target: 100 },  // Spike test to 100 users over 2 minutes
    { duration: '2m', target: 0 },    // Ramp-down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],      // Error rate must be less than 10%
    'checks{type:login}': ['rate>0.9'], // 90% of login checks must pass
    'checks{type:products}': ['rate>0.9'], // 90% of product checks must pass
    'checks{type:cart}': ['rate>0.9'],  // 90% of cart checks must pass
  },
};

// Base URL for the API
const BASE_URL = 'https://dummyjson.com';

// User credentials pool - for a more realistic test scenario
const USER_POOL = [
  { username: 'emilys', password: 'emilyspass', id: 1 },
  // Add more users if available...
];

// Product categories for more varied testing
const PRODUCT_CATEGORIES = ['smartphones', 'laptops', 'fragrances', 'skincare', 'groceries', 'home-decoration'];

// Search terms for variety in search requests
const SEARCH_TERMS = ['phone', 'laptop', 'watch', 'perfume', 'furniture', 'food'];

// Helper function to select random item from an array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Login function to get authentication token
function login() {
  const user = getRandomItem(USER_POOL);
  
  const loginPayload = JSON.stringify({
    username: user.username,
    password: user.password,
    expiresInMins: 30,
  });
  
  const loginResponse = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'login' },
  });
  
  check(loginResponse, {
    'login status 200': (r) => r.status === 200,
    'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
  }, { type: 'login' });
  
  // Return user info and token if login is successful
  if (loginResponse.status === 200) {
    const responseBody = JSON.parse(loginResponse.body);
    return { 
      token: responseBody.accessToken, 
      userId: responseBody.id,
      username: responseBody.username
    };
  } else {
    console.error(`Login failed: ${loginResponse.status} ${loginResponse.body}`);
    return { token: null, userId: user.id, username: user.username };
  }
}

// Main test scenario
export default function() {
  // Step 1: Login and get user information
  const userSession = login();
  
  // Set up authentication headers
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userSession.token}`,
  };
  
  // Add a small pause after login to simulate user behavior
  sleep(randomIntBetween(1, 2));
  
  // Step 2: Browse products with various patterns
  group('Browse Products', function() {
    // Either browse all products or a specific category
    let productsUrl;
    if (Math.random() > 0.5) {
      productsUrl = `${BASE_URL}/products?limit=20&skip=${randomIntBetween(0, 5) * 20}`;
    } else {
      const category = getRandomItem(PRODUCT_CATEGORIES);
      productsUrl = `${BASE_URL}/products/category/${category}`;
    }
    
    const productsResponse = http.get(productsUrl, {
      headers: authHeaders,
      tags: { type: 'products' },
    });
    
    check(productsResponse, {
      'products status 200': (r) => r.status === 200,
      'products data valid': (r) => JSON.parse(r.body).products?.length > 0,
    }, { type: 'products' });
    
    sleep(randomIntBetween(1, 3));
    
    // Search for products (50% of the time)
    if (Math.random() > 0.5) {
      const searchTerm = getRandomItem(SEARCH_TERMS);
      const searchResponse = http.get(`${BASE_URL}/products/search?q=${searchTerm}`, {
        headers: authHeaders,
        tags: { type: 'search' },
      });
      
      check(searchResponse, {
        'search status 200': (r) => r.status === 200,
      }, { type: 'products' });
      
      searchesCounter.add(1);
      sleep(randomIntBetween(1, 2));
    }
  });
  
  // Step 3: Get specific product details
  let selectedProduct = null;
  group('Product Details', function() {
    // Get details of a random product 
    const productId = randomIntBetween(1, 100);
    const productResponse = http.get(`${BASE_URL}/products/${productId}`, {
      headers: authHeaders,
      tags: { type: 'product_detail' },
    });
    
    check(productResponse, {
      'product detail status 200': (r) => r.status === 200,
      'product detail has id': (r) => JSON.parse(r.body).id !== undefined,
    }, { type: 'products' });
    
    if (productResponse.status === 200) {
      selectedProduct = JSON.parse(productResponse.body);
      productViewsCounter.add(1);
    }
    
    sleep(randomIntBetween(2, 4));
  });
  
  // Step 4: Add to cart (only if we have a valid product)
  if (selectedProduct) {
    group('Cart Operations', function() {
      // Add the selected product to cart
      const quantity = randomIntBetween(1, 3);
      
      const addToCartPayload = JSON.stringify({
        userId: userSession.userId,
        products: [
          {
            id: selectedProduct.id,
            quantity: quantity,
          },
        ],
      });
      
      const addToCartResponse = http.post(`${BASE_URL}/carts/add`, addToCartPayload, {
        headers: authHeaders,
        tags: { type: 'cart' },
      });
      
      check(addToCartResponse, {
        'add to cart status 200': (r) => r.status === 200,
        'cart contains products': (r) => JSON.parse(r.body).products?.length > 0,
      }, { type: 'cart' });
      
      cartAddCounter.add(1);
      sleep(randomIntBetween(1, 3));
      
      // View cart contents
      const cartResponse = http.get(`${BASE_URL}/carts/user/${userSession.userId}`, {
        headers: authHeaders,
        tags: { type: 'cart' },
      });
      
      check(cartResponse, {
        'view cart status 200': (r) => r.status === 200,
      }, { type: 'cart' });
      
      sleep(randomIntBetween(1, 2));
    });
  }
  
  // Step 5: Checkout (70% of users with items in cart proceed to checkout)
  if (selectedProduct && Math.random() < 0.7) {
    group('Checkout Process', function() {
      // Simulate checkout process
      // Note: DummyJSON doesn't have a direct checkout endpoint, so we'll simulate it
      
      // First, get the user's cart
      const cartResponse = http.get(`${BASE_URL}/carts/user/${userSession.userId}`, {
        headers: authHeaders,
        tags: { type: 'checkout' },
      });
      
      let cartItems = [];
      if (cartResponse.status === 200) {
        const cartData = JSON.parse(cartResponse.body);
        if (cartData.carts && cartData.carts.length > 0) {
          cartItems = cartData.carts[0].products || [];
        }
      }
      
      // Simulate an order creation (this endpoint doesn't really exist in DummyJSON)
      // Using POST to products as a stand-in for demonstration purposes
      if (cartItems.length > 0) {
        const orderPayload = JSON.stringify({
          userId: userSession.userId,
          products: cartItems,
          totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          shippingAddress: "123 Test Street",
          paymentMethod: "Credit Card"
        });
        
        // This is a simulation
        const checkoutResponse = http.post(`${BASE_URL}/carts`, orderPayload, {
          headers: authHeaders,
          tags: { type: 'checkout' },
        });
        
        check(checkoutResponse, {
          'checkout process completed': (r) => r.status < 500, // Just checking it doesn't completely fail
        }, { type: 'checkout' });
        
        checkoutCounter.add(1);
        
        // After successful checkout, cart would typically be cleared
        // but DummyJSON doesn't have this endpoint
      }
      
      sleep(randomIntBetween(2, 5));
    });
  }
  
  // Final sleep to simulate end of user session
  sleep(randomIntBetween(1, 3));
}
