# Sterling API Documentation

## Overview

Sterling exposes a RESTful API for the web and mobile applications. All endpoints are located under `/api/`.

## Authentication

Most endpoints require authentication via one of two methods:

### Cookie-based (Web)
- Automatically handled by Supabase auth cookies
- Used by the Next.js web application

### Bearer Token (Mobile)
```
Authorization: Bearer <access_token>
```
- Used by the React Native mobile app
- Token obtained from Supabase auth

## Rate Limiting

All endpoints are rate limited. Headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 | 1 minute |
| Authentication | 5 | 1 minute |
| AI Features | 20 | 1 minute |
| Plaid Operations | 10 | 1 minute |
| Stripe Operations | 30 | 1 minute |

---

## Endpoints

### Health Checks

#### GET /api/health
Basic liveness check.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /api/health/ready
Readiness check with database connectivity.

**Response:** `200 OK` or `503 Service Unavailable`
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTimeMs": 45
    },
    "services": {
      "plaid": { "state": "closed", "failures": 0 },
      "stripe": { "state": "closed", "failures": 0 },
      "anthropic": { "state": "closed", "failures": 0 }
    }
  },
  "responseTimeMs": 52
}
```

#### GET /api/health/live
Kubernetes liveness probe.

**Response:** `200 OK`
```json
{
  "status": "alive",
  "uptime": 3600.5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### User Management

#### GET /api/user/profile
Get the current user's profile.

**Response:** `200 OK`
```json
{
  "profile": {
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "currency": "USD",
    "timezone": "America/New_York"
  },
  "email": "john@example.com"
}
```

#### PATCH /api/user/profile
Update user profile.

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "currency": "USD",
  "timezone": "America/New_York"
}
```

#### DELETE /api/user/delete
Delete user account (GDPR right to be forgotten).

**Request Body:**
```json
{
  "confirmation": "DELETE"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Your account has been permanently deleted."
}
```

---

### Accounts

#### GET /api/accounts
Get all linked bank accounts.

**Response:** `200 OK`
```json
{
  "accounts": [
    {
      "id": "acc_123",
      "name": "Checking Account",
      "type": "depository",
      "subtype": "checking",
      "mask": "1234",
      "balance_current": 5000.00,
      "balance_available": 4800.00,
      "institution_name": "Chase",
      "is_hidden": false
    }
  ]
}
```

---

### Transactions

#### GET /api/transactions
Get transactions with optional filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |
| `filter` | string | `all`, `income`, `expense` |
| `period` | string | `this_month`, `last_month`, `last_3_months`, etc. |
| `search` | string | Search term |

**Response:** `200 OK`
```json
{
  "transactions": [
    {
      "id": "txn_123",
      "name": "Amazon",
      "amount": -49.99,
      "date": "2024-01-15",
      "category": "Shopping",
      "merchant_name": "Amazon.com",
      "pending": false
    }
  ],
  "total": 150,
  "hasMore": true
}
```

#### PATCH /api/transactions
Update a transaction.

**Request Body:**
```json
{
  "id": "txn_123",
  "category": "Entertainment",
  "display_name": "Netflix Subscription"
}
```

---

### Budgets

#### GET /api/budgets
Get all budgets.

**Response:** `200 OK`
```json
{
  "budgets": [
    {
      "id": "bgt_123",
      "category": "Food & Dining",
      "amount": 500,
      "spent": 350,
      "remaining": 150
    }
  ]
}
```

#### POST /api/budgets
Create a new budget.

**Request Body:**
```json
{
  "category": "Food & Dining",
  "amount": 500
}
```

#### DELETE /api/budgets?id={budget_id}
Delete a budget.

---

### Spending Analytics

#### GET /api/spending
Get spending summary and analytics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `this_month`, `last_month`, etc. |

**Response:** `200 OK`
```json
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "summary": {
    "income": 5000,
    "bills": 1200,
    "spending": 2300,
    "spendingChange": -5.2
  },
  "categories": [
    {
      "category": "Food & Dining",
      "amount": 450,
      "percentage": 19.5,
      "change": 12.3,
      "transactionCount": 28
    }
  ]
}
```

---

### Recurring Transactions

#### GET /api/recurring
Get detected recurring transactions.

**Response:** `200 OK`
```json
{
  "subscriptions": [...],
  "income": [...],
  "bills": [...],
  "stats": {
    "totalMonthlySubscriptions": 89.97,
    "totalMonthlyIncome": 5000,
    "totalMonthlyBills": 1200
  }
}
```

---

### AI Features

#### POST /api/ai/chat
Send a message to the AI assistant.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "How much did I spend on food?" }
  ],
  "session_id": "session_123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Based on your transactions...",
  "session_id": "session_123"
}
```

#### GET /api/ai/insights
Get AI-generated financial insights.

**Response:** `200 OK`
```json
{
  "healthScore": 78,
  "healthStatus": "good",
  "insights": [...],
  "suggestions": [...]
}
```

#### POST /api/ai/categorize
Auto-categorize transactions using AI.

#### GET /api/ai/search
Natural language transaction search.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Natural language query |

---

### Plaid Integration

#### POST /api/plaid/create-link-token
Create a Plaid Link token for account linking.

#### POST /api/plaid/exchange-token
Exchange public token after Plaid Link.

**Request Body:**
```json
{
  "public_token": "public-xxx",
  "metadata": { ... }
}
```

#### POST /api/plaid/sync-transactions
Sync transactions from Plaid.

#### POST /api/plaid/disconnect
Disconnect a bank account.

---

### Stripe Billing

#### GET /api/subscription
Get current subscription status.

**Response:** `200 OK`
```json
{
  "tier": "pro",
  "status": "active",
  "currentPeriodEnd": "2024-02-15T00:00:00.000Z",
  "cancelAtPeriodEnd": false
}
```

#### POST /api/stripe/checkout
Create a Stripe Checkout session.

#### POST /api/stripe/portal
Create a Stripe Customer Portal session.

---

### Anomaly Detection

#### GET /api/anomalies
Get detected anomalies.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `pending`, `dismissed`, `confirmed` |

#### PATCH /api/anomalies
Update anomaly status.

---

### Cash Flow

#### GET /api/cash-flow/forecast
Get 30-day cash flow forecast.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | number | Forecast days (default: 30) |

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Webhooks

### POST /api/stripe/webhook
Handles Stripe webhook events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
