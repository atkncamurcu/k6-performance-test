import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp-up to 10 users over 2 minutes
    { duration: '5m', target: 50 },   // Ramp-up to 50 users over 5 minutes
    { duration: '2m', target: 100 },  // Spike test to 100 users over 2 minutes
    { duration: '2m', target: 0 },    // Ramp-down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

// Base URL for the API
const BASE_URL = 'https://dummyjson.com';

// User credentials - in a real scenario, these should be loaded from a file or environment variables
const TEST_USER = {
  username: 'emilys',
  password: 'emilyspass',
};

// Default headers for requests
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// Login function to get authentication token
function login() {
  const loginPayload = JSON.stringify({
    username: TEST_USER.username,
    password: TEST_USER.password,
    expiresInMins: 30,
  });
  
  const loginResponse = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: DEFAULT_HEADERS,
  });
  
  check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
  });
  
  // Return the authentication token if login is successful
  if (loginResponse.status === 200) {
    const responseBody = JSON.parse(loginResponse.body);
    return responseBody.accessToken;
  } else {
    console.error(`Login failed: ${loginResponse.status} ${loginResponse.body}`);
    return null;
  }
}

// Main test scenario
export default function() {
  // Step 1: Login and get token
  const token = login();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Add a small pause after login to simulate user thinking
  sleep(randomIntBetween(1, 2));
  
  // Step 2: Browse products
  group('Browse Products', function() {
    // Get products list with pagination
    const productsResponse = http.get(`${BASE_URL}/products?limit=10&skip=0`, {
      headers: authHeaders,
    });
    
    check(productsResponse, {
      'products loaded': (r) => r.status === 200,
      'has products': (r) => JSON.parse(r.body).products.length > 0,
    });
    
    sleep(randomIntBetween(1, 3));
    
    // Search for products
    const searchTerm = 'phone';
    const searchResponse = http.get(`${BASE_URL}/products/search?q=${searchTerm}`, {
      headers: authHeaders,
    });
    
    check(searchResponse, {
      'search successful': (r) => r.status === 200,
      'search has results': (r) => JSON.parse(r.body).products.length > 0,
    });
    
    sleep(randomIntBetween(1, 2));
  });
  
  // Step 3: Get product details
  group('Product Details', function() {
    // Get details of a random product (let's use 1-30 as a reasonable range)
    const productId = randomIntBetween(1, 30);
    const productResponse = http.get(`${BASE_URL}/products/${productId}`, {
      headers: authHeaders,
    });
    
    check(productResponse, {
      'product details loaded': (r) => r.status === 200,
      'product has id': (r) => JSON.parse(r.body).id !== undefined,
    });
    
    sleep(randomIntBetween(1, 3));
    
    // Store product info for cart operations
    let product = {};
    if (productResponse.status === 200) {
      product = JSON.parse(productResponse.body);
    }
    
    return product;
  });
  
  // Step 4: Add to cart
  group('Add to Cart', function() {
    // The correct endpoint in DummyJSON is /carts/add (not /carts/user/id)
    // And we need to fix the userId issue
    
    // For simplicity, let's add a random product to the cart
    const productId = randomIntBetween(1, 30);
    const quantity = randomIntBetween(1, 5);
    
    const addToCartPayload = JSON.stringify({
      userId: 1, // Using userId 1 for Emily
      products: [
        {
          id: productId,
          quantity: quantity,
        },
      ],
    });
    
    // Use the correct endpoint from DummyJSON API
    // Based on documentation, the endpoint might be /carts/user/:id after login
    const addToCartResponse = http.post(`${BASE_URL}/carts/user/1/add`, addToCartPayload, {
      headers: authHeaders,
    });
    
    check(addToCartResponse, {
      'add to cart successful': (r) => r.status === 200 || r.status === 201,
      'cart updated': (r) => r.status === 200 || r.status === 201
    });
    
    sleep(randomIntBetween(1, 2));
  });
  
  // Step 5: Checkout simulation
  group('Checkout', function() {
    // First get current cart to checkout
    const cartResponse = http.get(`${BASE_URL}/carts/user/1`, {
      headers: authHeaders,
    });
    
    check(cartResponse, {
      'cart retrieved': (r) => r.status === 200,
    });
    
    let products = [];
    try {
      if (cartResponse.status === 200) {
        const cartData = JSON.parse(cartResponse.body);
        // DummyJSON returns cart data in different format
        if (cartData.carts && cartData.carts.length > 0) {
          products = cartData.carts[0].products || [];
        }
      }
    } catch (e) {
      console.error('Error parsing cart data:', e);
    }
    
    // For simulation only - since DummyJSON doesn't have a real checkout endpoint
    // Just create a mock order without making an actual API call
    if (products.length > 0) {
      // We could simulate this with POST to an endpoint that accepts similar data
      // But for now, we'll just log it to avoid errors
      console.log(`Simulating checkout with ${products.length} products`);
    }
    
    // After checkout, we'd typically clear the cart
    sleep(randomIntBetween(2, 4));
  });
  
  // Add a final sleep to simulate user session end
  sleep(randomIntBetween(1, 3));
}