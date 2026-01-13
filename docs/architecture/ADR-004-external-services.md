# ADR-004: External Service Integration Pattern

## Status
Accepted

## Context
Sterling integrates with multiple external services:
- **Plaid**: Bank account linking and transaction syncing
- **Stripe**: Subscription billing
- **Anthropic**: AI features (Claude)

These services can fail, and we need resilient integration patterns.

## Decision
Implement a resilience layer with retry logic and circuit breakers.

### Architecture
```
API Route → Resilient Service Wrapper → Retry Logic → Circuit Breaker → External API
```

### Implementation Files
- `apps/web/src/lib/retry.ts` - Exponential backoff with jitter
- `apps/web/src/lib/circuit-breaker.ts` - Circuit breaker pattern
- `apps/web/src/lib/resilient-services.ts` - Service wrappers

### Service-Specific Configuration

| Service | Max Retries | Base Delay | Circuit Threshold | Recovery Timeout |
|---------|-------------|------------|-------------------|------------------|
| Plaid | 3 | 1000ms | 5 failures | 60s |
| Stripe | 2 | 500ms | 10 failures | 30s |
| Anthropic | 2 | 2000ms | 3 failures | 120s |

### Circuit Breaker States
1. **Closed**: Normal operation, requests pass through
2. **Open**: Too many failures, requests fail fast
3. **Half-Open**: Testing recovery, limited requests allowed

## Consequences

### Positive
- Graceful degradation when services fail
- Prevents cascade failures
- Reduces load on failing services
- Better user experience with retries

### Negative
- Added complexity
- In-memory state (not distributed)
- Delayed failure detection

## Usage Example
```typescript
import { resilientPlaid } from '@/lib/resilient-services'

const response = await resilientPlaid.call(
  'transactionsSync',
  () => plaidClient.transactionsSync({ ... })
)
```
