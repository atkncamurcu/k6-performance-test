# K6 Performance Tests for DummyJSON API

This project contains performance test scripts for the [DummyJSON API](https://dummyjson.com/) using [k6](https://k6.io/), an open-source load testing tool.

## Tests Overview

We have created two test scripts:

1. **Basic Test** (`dummyjson-test.js`): Simulates a basic user journey with login, product browsing, and cart operations.
2. **Advanced Test** (`dummyjson-advanced-test.js`): A more comprehensive test with custom metrics, varied user behaviors, and better error handling.

Both scripts simulate a realistic user scenario:
1. User logs in
2. Browses and searches for products
3. Views product details
4. Adds products to cart
5. Proceeds to checkout

## Test Configuration

Both tests include a staged load pattern:
- Ramp-up: 2 minutes to reach 10 users
- Steady load: 5 minutes at 50 users 
- Spike test: 2 minutes at 100 users
- Ramp-down: 2 minutes back to 0 users

The tests also define thresholds:
- 95% of requests should complete under 500ms
- Error rate should be below 10%

## Prerequisites

1. Install k6:

**macOS**:
```
brew install k6
```

**Windows**:
```
winget install k6
```

## Running the Tests

### Basic Test

```bash
k6 run dummyjson-test.js
```

### Advanced Test

```bash
k6 run dummyjson-advanced-test.js
```

### Running with Different Options

**Specify duration**:
```bash
k6 run --duration 30s dummyjson-test.js
```

**Specify VUs (Virtual Users)**:
```bash
k6 run --vus 10 --duration 30s dummyjson-test.js
```

**Output results to a file**:
```bash
k6 run --out json=results.json dummyjson-test.js
```

## Interpreting Results

After running a test, k6 will provide a summary that includes:

- Data transfer statistics
- Request rates
- Response time metrics
- HTTP status code counts
- Custom metric values

Look for:
- `http_req_duration` metrics to understand response times
- `http_req_failed` to see if there are errors
- Custom counters like `product_views` in the advanced test

## Extending the Tests

You can extend these tests by:
1. Adding more user scenarios
2. Updating the user pool with more test accounts
3. Adding more detailed assertions with `check()`
4. Creating additional custom metrics

## Notes

- DummyJSON is a demo API and may have rate limits

## CI/CD Integration

This project includes GitHub Actions workflow configuration to run tests automatically:

- Tests are executed on every push and pull request to main/master branches
- CI environment uses modified thresholds to accommodate test environment differences
- Test results are saved as artifacts for later inspection

To view GitHub Actions results:
1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Find the most recent workflow run
4. Download and inspect test results artifacts
