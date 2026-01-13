# Sterling Deployment Runbook

## Overview

Sterling consists of:
- **Web App**: Next.js deployed to Vercel
- **Mobile App**: Expo/React Native (iOS & Android)
- **Database**: Supabase (PostgreSQL)
- **External Services**: Plaid, Stripe, Anthropic

---

## Environment Configuration

### Required Environment Variables

#### Web App (`apps/web/.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Plaid
PLAID_CLIENT_ID=xxx
PLAID_SECRET=xxx
PLAID_ENV=sandbox|development|production

# Stripe
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# App
NEXT_PUBLIC_APP_URL=https://joinsterling.com
```

#### Mobile App (`apps/mobile/.env`)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_URL=https://joinsterling.com
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Deployment Process

### Web App (Vercel)

#### Automatic Deployment
1. Push to `main` branch triggers production deployment
2. Pull requests create preview deployments

#### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
cd apps/web
vercel --prod
```

#### Vercel Configuration
- **Framework**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && npm run build --filter=@sterling/web`
- **Install Command**: `npm install`

### Database Migrations (Supabase)

#### Apply Migrations
```bash
# Install Supabase CLI
npm i -g supabase

# Link to project
supabase link --project-ref <project-id>

# Apply migrations
supabase db push

# Or apply specific migration
supabase migration up --target-version <version>
```

#### Migration Files
Located in `supabase/migrations/`:
- `001_initial_schema.sql`
- `020_audit_logs.sql`
- `021_rbac.sql`
- etc.

### Mobile App (EAS Build)

#### Build and Submit
```bash
# Install EAS CLI
npm i -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Pre-Deployment Checklist

### Before Every Deployment
- [ ] All tests pass (`npm run test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] No console errors in development
- [ ] Environment variables are set

### Before Production Deployment
- [ ] Database migrations tested in staging
- [ ] Stripe webhooks configured
- [ ] Plaid environment is `production`
- [ ] Sentry DSN is production
- [ ] Rate limits are appropriate

---

## Rollback Procedures

### Web App (Vercel)
1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Database
```bash
# Rollback last migration
supabase migration down

# Or restore from backup
supabase db restore --timestamp <timestamp>
```

### Mobile App
- iOS: Contact Apple for emergency rollback
- Android: Use staged rollout, halt at low percentage

---

## Health Checks

### Endpoints to Monitor
| Endpoint | Expected Response | Alert Threshold |
|----------|-------------------|-----------------|
| `/api/health` | 200 OK | Any non-200 |
| `/api/health/ready` | 200 OK | 503 or timeout > 5s |
| `/api/health/live` | 200 OK | Any non-200 |

### Monitoring Tools
- **Vercel Analytics**: Performance metrics
- **Sentry**: Error tracking
- **Supabase Dashboard**: Database metrics

---

## Scaling Considerations

### Web App
- Vercel auto-scales serverless functions
- Consider Edge Functions for latency-sensitive routes
- Enable Vercel caching headers

### Database
- Monitor connection pool usage
- Consider read replicas for analytics queries
- Enable pgbouncer in Supabase for connection pooling

### External Services
- Plaid: Monitor API call volume
- Stripe: Use webhooks instead of polling
- Anthropic: Monitor token usage and costs

---

## Troubleshooting

### Common Issues

#### "Rate limit exceeded"
- Check rate limit configuration in `apps/web/src/lib/rate-limit.ts`
- Monitor for abuse patterns in logs

#### "Database connection failed"
- Check Supabase status page
- Verify environment variables
- Check connection pool limits

#### "Plaid sync failed"
- Check circuit breaker status at `/api/health/ready`
- Verify Plaid credentials and environment
- Check for Plaid API incidents

#### "Stripe webhook failed"
- Verify webhook secret in environment
- Check Stripe Dashboard → Webhooks for errors
- Ensure webhook URL is accessible
