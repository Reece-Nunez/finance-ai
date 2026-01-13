# Sterling Developer Onboarding Guide

Welcome to Sterling! This guide will help you get up and running with development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Key Concepts](#key-concepts)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Resources](#resources)

---

## Prerequisites

### Required Software
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher (comes with Node.js)
- **Git**: Latest version
- **VS Code**: Recommended IDE

### Accounts Needed
- **GitHub**: Repository access
- **Supabase**: Database dashboard access
- **Vercel**: Deployment dashboard (optional)

### VS Code Extensions (Recommended)
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets

---

## Initial Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/sterling.git
cd sterling
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables

#### Web App
```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` with the following (get values from team lead):
```bash
# Supabase (Development)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Plaid (Sandbox)
PLAID_CLIENT_ID=xxx
PLAID_SECRET=xxx
PLAID_ENV=sandbox

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Anthropic (Optional for AI features)
ANTHROPIC_API_KEY=sk-ant-xxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Mobile App
```bash
cp apps/mobile/.env.example apps/mobile/.env
```

### 4. Start Development Server
```bash
# Start web app
npm run dev --filter=@sterling/web

# Or start all apps
npm run dev
```

### 5. Verify Setup
- Open http://localhost:3000
- You should see the Sterling landing page
- Try creating an account (uses Supabase Auth)

---

## Project Structure

Sterling is a **monorepo** managed by Turborepo.

```
sterling/
├── apps/
│   ├── web/                 # Next.js web application
│   │   ├── src/
│   │   │   ├── app/         # App Router pages & API routes
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utilities & services
│   │   │   └── styles/      # Global styles
│   │   └── public/          # Static assets
│   │
│   └── mobile/              # Expo React Native app
│       └── src/
│           ├── app/         # Expo Router screens
│           ├── components/  # React Native components
│           ├── hooks/       # Custom hooks
│           └── services/    # API clients
│
├── packages/
│   └── shared/              # Shared code between apps
│       ├── types/           # TypeScript types
│       └── utils/           # Shared utilities
│
├── supabase/
│   └── migrations/          # Database migrations
│
└── docs/                    # Documentation
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `apps/web/src/app/` | Next.js App Router - pages, layouts, API routes |
| `apps/web/src/components/` | Reusable UI components |
| `apps/web/src/lib/` | Business logic, API clients, utilities |
| `apps/mobile/src/app/` | Expo Router screens |
| `packages/shared/` | Code shared between web and mobile |
| `supabase/migrations/` | SQL migration files |

---

## Development Workflow

### Branch Naming
```
feature/description    # New features
fix/description        # Bug fixes
refactor/description   # Code refactoring
docs/description       # Documentation
```

### Commit Messages
Follow conventional commits:
```
feat: add transaction categorization
fix: resolve auth token refresh issue
refactor: simplify retry logic
docs: update API documentation
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes, commit frequently
3. Push branch and create PR
4. Ensure CI passes (tests, lint, typecheck)
5. Request review
6. Merge after approval

### Running Checks Locally
```bash
# Run all checks
npm run lint
npm run typecheck
npm run test

# Run specific app
npm run lint --filter=@sterling/web
npm run test --filter=@sterling/mobile
```

---

## Key Concepts

### Authentication Flow
- **Web**: Cookie-based sessions via `@supabase/ssr`
- **Mobile**: JWT Bearer tokens
- **Session timeout**: 5 minutes of inactivity
- See: `apps/web/src/lib/supabase/` for auth utilities

### Database Access
- **ORM**: Direct Supabase client (no Prisma)
- **RLS**: Row-Level Security enforced on all tables
- **User access**: `auth.uid()` automatically scopes queries
- See: `supabase/migrations/` for schema

### API Routes
- Located in `apps/web/src/app/api/`
- Use `createServerClient()` for authenticated routes
- Rate limiting applied per endpoint type
- See: `docs/API.md` for full documentation

### External Services
- **Plaid**: Bank account linking
- **Stripe**: Subscription billing
- **Anthropic**: AI features
- All wrapped with retry logic and circuit breakers
- See: `apps/web/src/lib/resilient-services.ts`

### Error Handling
- Error boundaries at root and dashboard level
- Sentry integration for error tracking
- Circuit breakers prevent cascade failures
- See: `apps/web/src/app/error.tsx`

---

## Common Tasks

### Adding a New Page (Web)
```bash
# Create page file
apps/web/src/app/(dashboard)/dashboard/new-page/page.tsx
```

```typescript
export default function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  )
}
```

### Adding an API Route
```bash
# Create route file
apps/web/src/app/api/new-endpoint/route.ts
```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/api'
import { rateLimit } from '@/lib/rate-limit'

const RATE_LIMIT = { interval: 60000, limit: 30 }

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT)
  if (rateLimitResponse) return rateLimitResponse

  // Auth
  const supabase = await createServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Your logic here
  return NextResponse.json({ data: 'success' })
}
```

### Adding a Database Migration
```bash
# Create migration file
touch supabase/migrations/XXX_description.sql
```

```sql
-- supabase/migrations/XXX_description.sql

-- Add new table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own data"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

### Working with Plaid (Sandbox)
```typescript
// Use test credentials in Plaid sandbox
// Username: user_good
// Password: pass_good
// Any verification code works
```

### Working with Stripe (Test Mode)
```bash
# Test card numbers
4242424242424242  # Visa (success)
4000000000000002  # Declined
4000002500003155  # 3D Secure required
```

---

## Troubleshooting

### "Module not found" Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install
```

### Database Connection Issues
1. Check Supabase project is running
2. Verify environment variables are correct
3. Check if IP is allowed in Supabase settings

### Plaid Link Not Working
1. Ensure `PLAID_ENV=sandbox` for development
2. Use test credentials (see above)
3. Check browser console for errors

### Type Errors After Pulling
```bash
# Regenerate types
npm run typecheck
# Or restart TS server in VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Hot Reload Not Working
```bash
# Restart dev server
npm run dev --filter=@sterling/web
```

---

## Resources

### Internal Documentation
- [API Documentation](./API.md)
- [Deployment Runbook](./DEPLOYMENT.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
- [Architecture Decisions](./architecture/)

### External Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

### Getting Help
- Check existing documentation first
- Search codebase for similar patterns
- Ask in team Slack channel
- Create GitHub issue for bugs

---

## First Week Checklist

- [ ] Complete local setup (this guide)
- [ ] Read through API documentation
- [ ] Review architecture decision records
- [ ] Explore the codebase structure
- [ ] Run the test suite locally
- [ ] Make a small change (typo fix, comment)
- [ ] Create your first PR
- [ ] Set up Sentry access (ask team lead)
- [ ] Get added to Vercel team (for deployments)

Welcome to the team!
