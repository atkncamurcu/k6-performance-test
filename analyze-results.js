#!/usr/bin/env node

/**
 * Simple utility script to analyze K6 JSON output
 * Save K6 results to a JSON file with: k6 run --out json=results.json your-test.js
 * Then run: node analyze-results.js results.json
 */

const fs = require('fs');

if (process.argv.length < 3) {
  console.error('Please provide the path to a k6 JSON results file');
  console.error('Usage: node analyze-results.js results.json');
  process.exit(1);
}

const filePath = process.argv[2];

try {
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.trim().split('\n');
  
  // K6 JSON output format is NDJSON (each line is a separate JSON object)
  const metrics = {};
  const points = [];
  
  lines.forEach(line => {
    const entry = JSON.parse(line);
    
    if (entry.type === 'Point') {
      points.push(entry);
      
      if (!metrics[entry.metric]) {
        metrics[entry.metric] = {
          values: [],
          tags: entry.tags
        };
      }
      
      metrics[entry.metric].values.push(entry.data.value);
    }
  });
  
  console.log('\n===== K6 Performance Test Analysis =====\n');
  
  // Calculate stats for each metric
  Object.keys(metrics).forEach(metricName => {
    const values = metrics[metricName].values;
    const tags = metrics[metricName].tags;
    
    // Skip metrics with no values
    if (values.length === 0) return;
    
    // Calculate statistics
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log(`Metric: ${metricName}`);
    
    // Print tags if they exist
    if (tags && Object.keys(tags).length > 0) {
      console.log(`  Tags: ${JSON.stringify(tags)}`);
    }
    
    console.log(`  Count: ${values.length}`);
    console.log(`  Min: ${min?.toFixed(2) || 'N/A'}`);
    console.log(`  Max: ${max?.toFixed(2) || 'N/A'}`);
    console.log(`  Avg: ${avg?.toFixed(2) || 'N/A'}`);
    console.log(`  p95: ${p95?.toFixed(2) || 'N/A'}`);
    console.log(`  p99: ${p99?.toFixed(2) || 'N/A'}`);
    console.log('');
  });
  
  // Analyze HTTP status codes
  const statusCodes = {};
  const httpReqs = points.filter(point => point.metric === 'http_reqs');
  
  httpReqs.forEach(req => {
    const status = req.data.tags?.status || 'unknown';
    statusCodes[status] = (statusCodes[status] || 0) + 1;
  });
  
  console.log('HTTP Status Code Distribution:');
  Object.entries(statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });
  
  // Calculate error rate
  const totalReqs = Object.values(statusCodes).reduce((sum, count) => sum + count, 0);
  const errorReqs = Object.entries(statusCodes)
    .filter(([code]) => code.startsWith('4') || code.startsWith('5'))
    .reduce((sum, [_, count]) => sum + count, 0);
  
  const errorRate = totalReqs > 0 ? (errorReqs / totalReqs) * 100 : 0;
  
  console.log(`\nTotal Requests: ${totalReqs}`);
  console.log(`Error Requests: ${errorReqs}`);
  console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
  
  // Check if thresholds were met
  console.log('\nThreshold Analysis:');
  
  // Common thresholds to check
  const p95Duration = metrics['http_req_duration']?.values.sort((a, b) => a - b)[Math.floor(metrics['http_req_duration']?.values.length * 0.95)] || 0;
  console.log(`  95% of requests completed in: ${p95Duration.toFixed(2)}ms (threshold: <500ms)`);
  console.log(`  Error rate: ${errorRate.toFixed(2)}% (threshold: <10%)`);
  
  if (p95Duration > 500) {
    console.log('  ❌ Warning: 95th percentile response time exceeds 500ms threshold');
  } else {
    console.log('  ✅ 95th percentile response time is within threshold');
  }
  
  if (errorRate > 10) {
    console.log('  ❌ Warning: Error rate exceeds 10% threshold');
  } else {
    console.log('  ✅ Error rate is within threshold');
  }
  
} catch (err) {
  console.error('Error reading or parsing the file:', err);
  process.exit(1);
}
