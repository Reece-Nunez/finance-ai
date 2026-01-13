/**
 * Sterling Finance - API Load Test
 *
 * Run with k6:
 *   k6 run api-load-test.js
 *
 * With environment variables:
 *   k6 run -e BASE_URL=https://staging.example.com -e AUTH_TOKEN=xxx api-load-test.js
 *
 * Generate HTML report:
 *   k6 run --out json=results.json api-load-test.js
 *   # Then use k6-reporter or k6-html-reporter
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const accountsLatency = new Trend('accounts_latency')
const spendingLatency = new Trend('spending_latency')
const budgetsLatency = new Trend('budgets_latency')
const healthLatency = new Trend('health_latency')

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

// Test options
export const options = {
  // Ramp up to 100 concurrent users over 5 minutes
  stages: [
    { duration: '1m', target: 20 },   // Warm up
    { duration: '2m', target: 50 },   // Ramp to 50 users
    { duration: '3m', target: 100 },  // Ramp to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],

  // Performance thresholds
  thresholds: {
    // Overall HTTP request duration
    http_req_duration: ['p(95)<500', 'p(99)<1000'],

    // Error rate should be below 1%
    errors: ['rate<0.01'],

    // Individual endpoint thresholds
    accounts_latency: ['p(95)<400'],
    spending_latency: ['p(95)<600'],
    budgets_latency: ['p(95)<500'],
    health_latency: ['p(95)<100'],
  },
}

// Helper to make authenticated requests
function authHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
  }

  return headers
}

// Main test function
export default function () {
  // Health check (public, no auth)
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/api/health`)

    const success = check(res, {
      'health: status is 200': (r) => r.status === 200,
      'health: response time < 100ms': (r) => r.timings.duration < 100,
    })

    healthLatency.add(res.timings.duration)
    errorRate.add(!success)
  })

  sleep(0.5)

  // Authenticated endpoints (skip if no auth token)
  if (AUTH_TOKEN) {
    group('Accounts API', function () {
      const res = http.get(`${BASE_URL}/api/accounts`, {
        headers: authHeaders(),
      })

      const success = check(res, {
        'accounts: status is 200': (r) => r.status === 200,
        'accounts: has data': (r) => {
          try {
            const body = JSON.parse(r.body)
            return Array.isArray(body.accounts) || body.accounts !== undefined
          } catch {
            return false
          }
        },
        'accounts: response time < 500ms': (r) => r.timings.duration < 500,
      })

      accountsLatency.add(res.timings.duration)
      errorRate.add(!success)
    })

    sleep(0.5)

    group('Spending API', function () {
      const res = http.get(`${BASE_URL}/api/spending`, {
        headers: authHeaders(),
      })

      const success = check(res, {
        'spending: status is 200': (r) => r.status === 200,
        'spending: has categories': (r) => {
          try {
            const body = JSON.parse(r.body)
            return body.categories !== undefined || body.spending !== undefined
          } catch {
            return false
          }
        },
        'spending: response time < 800ms': (r) => r.timings.duration < 800,
      })

      spendingLatency.add(res.timings.duration)
      errorRate.add(!success)
    })

    sleep(0.5)

    group('Budgets API', function () {
      const res = http.get(`${BASE_URL}/api/budgets`, {
        headers: authHeaders(),
      })

      const success = check(res, {
        'budgets: status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'budgets: response time < 600ms': (r) => r.timings.duration < 600,
      })

      budgetsLatency.add(res.timings.duration)
      errorRate.add(res.status >= 500)
    })

    sleep(0.5)

    group('Budgets Analytics API', function () {
      const res = http.get(`${BASE_URL}/api/budgets/analytics`, {
        headers: authHeaders(),
      })

      const success = check(res, {
        'analytics: status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'analytics: response time < 700ms': (r) => r.timings.duration < 700,
      })

      errorRate.add(res.status >= 500)
    })

    sleep(0.5)

    group('Subscription API', function () {
      const res = http.get(`${BASE_URL}/api/subscription`, {
        headers: authHeaders(),
      })

      const success = check(res, {
        'subscription: status is 200': (r) => r.status === 200,
        'subscription: response time < 400ms': (r) => r.timings.duration < 400,
      })

      errorRate.add(!success)
    })
  }

  // Random sleep between iterations (1-3 seconds)
  sleep(Math.random() * 2 + 1)
}

// Setup function - runs once before tests
export function setup() {
  console.log(`Load test starting against: ${BASE_URL}`)
  console.log(`Auth token provided: ${AUTH_TOKEN ? 'Yes' : 'No'}`)

  // Verify health endpoint is accessible
  const res = http.get(`${BASE_URL}/api/health`)
  if (res.status !== 200) {
    console.error(`Health check failed! Status: ${res.status}`)
    console.error('Make sure the application is running and accessible.')
  }

  return {
    baseUrl: BASE_URL,
    hasAuth: !!AUTH_TOKEN,
  }
}

// Teardown function - runs once after tests
export function teardown(data) {
  console.log('Load test completed')
  console.log(`Tested URL: ${data.baseUrl}`)
  console.log(`Authenticated: ${data.hasAuth}`)
}

// Handle test summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    duration: data.state.testRunDurationMs,
    vus: {
      max: data.metrics.vus_max ? data.metrics.vus_max.values.max : 0,
    },
    requests: {
      total: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
      rate: data.metrics.http_reqs ? data.metrics.http_reqs.values.rate : 0,
    },
    latency: {
      avg: data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0,
      p95: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0,
      p99: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0,
    },
    errors: {
      rate: data.metrics.errors ? data.metrics.errors.values.rate : 0,
    },
    thresholds: {
      passed: Object.values(data.root_group.checks || {}).every((c) => c.passes > 0),
    },
  }

  console.log('\n=== Load Test Summary ===')
  console.log(JSON.stringify(summary, null, 2))

  return {
    'load-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextSummary(data),
  }
}

function generateTextSummary(data) {
  const metrics = data.metrics

  let summary = `
╔══════════════════════════════════════════════════════════════╗
║              STERLING FINANCE - LOAD TEST RESULTS            ║
╠══════════════════════════════════════════════════════════════╣
║ Target: ${BASE_URL.padEnd(50)} ║
║ Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s                                                   ║
╠══════════════════════════════════════════════════════════════╣
║ REQUESTS                                                     ║
║   Total:     ${metrics.http_reqs?.values.count || 0}                                               ║
║   Rate:      ${(metrics.http_reqs?.values.rate || 0).toFixed(2)}/s                                         ║
╠══════════════════════════════════════════════════════════════╣
║ LATENCY (http_req_duration)                                  ║
║   Average:   ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms                                       ║
║   P95:       ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms                                       ║
║   P99:       ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms                                       ║
╠══════════════════════════════════════════════════════════════╣
║ ERRORS                                                       ║
║   Rate:      ${((metrics.errors?.values.rate || 0) * 100).toFixed(2)}%                                           ║
╠══════════════════════════════════════════════════════════════╣
║ THRESHOLDS                                                   ║
`

  // Add threshold results
  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? '✓ PASS' : '✗ FAIL'
    summary += `║   ${name}: ${status}`.padEnd(63) + '║\n'
  }

  summary += `╚══════════════════════════════════════════════════════════════╝
`

  return summary
}
