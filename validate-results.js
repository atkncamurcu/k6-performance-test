#!/usr/bin/env node

/**
 * Script to validate K6 test results based on thresholds
 * 
 * Usage:
 * node validate-results.js <results-file.json> [--ci]
 */

const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
const resultsFile = args[0];
const isCI = args.includes('--ci');

// Exit codes
const SUCCESS = 0;
const FAILURE = 1;

if (!resultsFile) {
  console.error('Please provide a path to results JSON file');
  process.exit(FAILURE);
}

// Default thresholds (can be overridden)
const THRESHOLDS = {
  errorRate: isCI ? 0.20 : 0.10,      // 10% in local, 20% in CI
  responseTime: isCI ? 1000 : 500,    // 500ms in local, 1000ms in CI
};

try {
  const data = fs.readFileSync(resultsFile, 'utf8');
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
  
  console.log('\n===== K6 Test Validation Results =====\n');
  
  // Calculate p95 response time
  const durationValues = metrics['http_req_duration']?.values || [];
  const sorted = [...durationValues].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  
  console.log(`95th percentile response time: ${p95.toFixed(2)}ms (threshold: ${THRESHOLDS.responseTime}ms)`);
  
  // Calculate error rate
  const httpReqs = points.filter(point => point.metric === 'http_reqs');
  const statusCodes = {};
  
  httpReqs.forEach(req => {
    const status = req.data.tags?.status || 'unknown';
    statusCodes[status] = (statusCodes[status] || 0) + 1;
  });
  
  const totalReqs = Object.values(statusCodes).reduce((sum, count) => sum + count, 0);
  const errorReqs = Object.entries(statusCodes)
    .filter(([code]) => code.startsWith('4') || code.startsWith('5'))
    .reduce((sum, [_, count]) => sum + count, 0);
  
  const errorRate = totalReqs > 0 ? (errorReqs / totalReqs) : 0;
  
  console.log(`Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(THRESHOLDS.errorRate * 100).toFixed(2)}%)`);
  
  // Check if thresholds were met
  let failures = 0;
  
  if (p95 > THRESHOLDS.responseTime) {
    console.log(`❌ FAILED: Response time exceeds threshold`);
    failures++;
  }
  
  if (errorRate > THRESHOLDS.errorRate) {
    console.log(`❌ FAILED: Error rate exceeds threshold`);
    failures++;
  }
  
  if (failures === 0) {
    console.log(`✅ PASSED: All thresholds met`);
    process.exit(SUCCESS);
  } else {
    console.log(`❌ FAILED: ${failures} threshold(s) not met`);
    process.exit(FAILURE);
  }
  
} catch (err) {
  console.error('Error reading or parsing the file:', err);
  process.exit(FAILURE);
}
