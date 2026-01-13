# Sterling Incident Response Procedures

## Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Service down, data breach | 15 minutes | Full outage, security breach |
| **P2 - High** | Major feature broken | 1 hour | Payments failing, auth broken |
| **P3 - Medium** | Degraded performance | 4 hours | Slow API, partial feature failure |
| **P4 - Low** | Minor issues | 24 hours | UI bugs, non-critical errors |

---

## Incident Response Process

### 1. Detection
Incidents can be detected via:
- **Sentry Alerts**: Error spike, new error type
- **Health Check Failures**: `/api/health/ready` returns 503
- **User Reports**: Support tickets, social media
- **Monitoring**: Vercel Analytics, Supabase Dashboard

### 2. Triage
1. Assess severity level (P1-P4)
2. Identify affected systems
3. Determine scope (all users, subset, single user)
4. Document initial findings

### 3. Communication
- **P1/P2**: Notify stakeholders immediately
- **All levels**: Create incident channel/thread
- **Public**: Update status page if user-facing

### 4. Resolution
1. Identify root cause
2. Implement fix or workaround
3. Deploy fix
4. Verify resolution
5. Monitor for recurrence

### 5. Post-Incident
1. Document timeline
2. Write post-mortem (for P1/P2)
3. Create follow-up tasks
4. Update runbooks if needed

---

## Common Incident Playbooks

### Playbook: Full Service Outage (P1)

**Symptoms:**
- `/api/health` returns non-200
- Users cannot access app

**Steps:**
1. Check Vercel status: https://vercel-status.com
2. Check Supabase status: https://status.supabase.com
3. Check recent deployments in Vercel
4. If recent deploy, rollback immediately
5. Check Sentry for error patterns
6. If database issue, check Supabase Dashboard

**Rollback:**
```bash
# Vercel Dashboard → Deployments → Previous → Promote to Production
```

---

### Playbook: Database Connection Issues (P1/P2)

**Symptoms:**
- `/api/health/ready` shows database unhealthy
- "Connection refused" or timeout errors

**Steps:**
1. Check Supabase Dashboard → Database
2. Check connection pool usage
3. Look for long-running queries
4. Check if migrations are running
5. Verify environment variables

**Quick Fixes:**
- Restart Supabase project (Dashboard → Settings → Restart)
- Kill long-running queries via SQL Editor

---

### Playbook: Authentication Failures (P2)

**Symptoms:**
- Users cannot log in
- 401 errors on authenticated endpoints

**Steps:**
1. Check Supabase Auth settings
2. Verify JWT secret hasn't changed
3. Check for rate limiting on auth endpoints
4. Look for session cookie issues

**Verify Auth:**
```bash
curl -X POST https://xxx.supabase.co/auth/v1/token \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"xxx"}'
```

---

### Playbook: Payment Processing Failure (P2)

**Symptoms:**
- Checkout fails
- Subscription updates fail
- Webhook errors in Stripe Dashboard

**Steps:**
1. Check Stripe Dashboard → Webhooks
2. Verify webhook secret in environment
3. Check Stripe API status: https://status.stripe.com
4. Look for circuit breaker open on Stripe

**Verify Stripe:**
```bash
curl https://api.stripe.com/v1/customers \
  -u sk_xxx:
```

---

### Playbook: Plaid Sync Failures (P3)

**Symptoms:**
- Transactions not updating
- "Plaid error" in logs
- Circuit breaker open

**Steps:**
1. Check Plaid status: https://status.plaid.com
2. Check circuit breaker status at `/api/health/ready`
3. Look for specific error codes in logs
4. Check if access tokens need refresh

**Common Plaid Errors:**
- `ITEM_LOGIN_REQUIRED`: User needs to re-authenticate
- `RATE_LIMIT_EXCEEDED`: Too many API calls
- `INSTITUTION_DOWN`: Bank's systems unavailable

---

### Playbook: AI Features Unavailable (P3)

**Symptoms:**
- Chat returns errors
- Categorization fails
- Circuit breaker open for Anthropic

**Steps:**
1. Check Anthropic status
2. Check API key validity
3. Check rate limits/usage quotas
4. Look for circuit breaker state

**Graceful Degradation:**
- AI features should fail gracefully
- Core app functionality unaffected
- Users see "AI temporarily unavailable" message

---

### Playbook: Security Incident (P1)

**Symptoms:**
- Unauthorized access detected
- Data breach suspected
- Unusual audit log entries

**Immediate Actions:**
1. DO NOT delete evidence
2. Preserve all logs
3. Identify affected scope
4. If data breach confirmed:
   - Notify legal/compliance
   - Prepare user notification
   - Document everything

**Investigation:**
1. Check audit_logs for suspicious activity
2. Review Sentry for unusual errors
3. Check Supabase logs
4. Review recent deployments

---

## Contact Information

### Internal
| Role | Contact |
|------|---------|
| On-call Engineer | [TBD] |
| Engineering Lead | [TBD] |
| Product Manager | [TBD] |

### External Services
| Service | Support |
|---------|---------|
| Vercel | https://vercel.com/support |
| Supabase | https://supabase.com/support |
| Stripe | https://support.stripe.com |
| Plaid | https://dashboard.plaid.com/support |

---

## Post-Incident Template

```markdown
# Incident Post-Mortem: [Title]

## Summary
Brief description of what happened.

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause
What caused the incident.

## Impact
- Users affected: X
- Duration: X minutes
- Data loss: Yes/No

## Resolution
What was done to fix it.

## Follow-up Actions
- [ ] Action item 1
- [ ] Action item 2

## Lessons Learned
What can we do to prevent this in the future.
```
