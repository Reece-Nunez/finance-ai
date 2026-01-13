# ADR-003: Database Security with Row-Level Security

## Status
Accepted

## Context
Financial data requires strict access controls. Users should only access their own data, and we need to prevent data leaks even if application code has bugs.

## Decision
Implement Row-Level Security (RLS) on all user data tables in Supabase.

### RLS Policy Pattern
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only modify their own data
CREATE POLICY "Users can update own data"
  ON table_name FOR UPDATE
  USING (auth.uid() = user_id);
```

### Role-Based Access (RBAC)
Four roles with escalating permissions:
1. **user**: Standard access to own data
2. **support**: Read access to user data for support
3. **admin**: Write access to user data, system settings
4. **super_admin**: Full access including role management

### Implementation
- `supabase/migrations/021_rbac.sql` - RBAC schema
- `apps/web/src/lib/rbac.ts` - Application-level checks

## Consequences

### Positive
- Defense in depth - even SQL injection can't access other users' data
- Permissions enforced at database level
- Audit trail preserved (audit_logs use SET NULL on delete)
- Support staff can help users without full access

### Negative
- More complex queries (must always consider RLS)
- Performance overhead on every query
- Debugging requires service role key

## Tables with RLS (25 total)
All user data tables have RLS enabled with CASCADE DELETE to auth.users, except:
- `audit_logs`: Uses SET NULL to preserve compliance records
