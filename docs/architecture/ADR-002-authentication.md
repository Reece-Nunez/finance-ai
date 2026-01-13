# ADR-002: Authentication with Supabase Auth

## Status
Accepted

## Context
Sterling handles sensitive financial data and requires secure, reliable authentication. We needed a solution that supports:
- Email/password authentication
- Session management
- Mobile app support (Bearer tokens)
- Row-Level Security integration

## Decision
Use Supabase Auth as the authentication provider.

### Implementation Details
- **Web**: Cookie-based sessions via `@supabase/ssr`
- **Mobile**: JWT Bearer tokens via `@supabase/supabase-js`
- **Session timeout**: 5 minutes of inactivity
- **Cross-tab sync**: Logout broadcasts to all tabs

### Code Locations
- `apps/web/src/lib/supabase/client.ts` - Browser client
- `apps/web/src/lib/supabase/server.ts` - Server client
- `apps/web/src/lib/supabase/api.ts` - API route auth
- `apps/web/src/hooks/useSessionTimeout.ts` - Session management

## Consequences

### Positive
- Tight integration with Supabase RLS policies
- Built-in email verification and password reset
- JWT tokens work seamlessly with mobile
- No need to manage auth infrastructure

### Negative
- Vendor lock-in to Supabase
- Limited customization of auth flows
- Must handle both cookie and Bearer token auth in API routes

## Security Measures
1. Session timeout after 5 minutes of inactivity
2. Secure cookie configuration (httpOnly, sameSite, secure)
3. Rate limiting on auth endpoints (5 req/min)
4. Audit logging of auth events
