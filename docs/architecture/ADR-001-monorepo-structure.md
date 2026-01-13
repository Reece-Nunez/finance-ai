# ADR-001: Monorepo Structure with Turborepo

## Status
Accepted

## Context
Sterling needs to support multiple platforms (web and mobile) while sharing business logic and types. We needed a way to manage multiple packages efficiently.

## Decision
Use a Turborepo monorepo with the following structure:

```
sterling/
├── apps/
│   ├── web/          # Next.js web application
│   └── mobile/       # Expo React Native app
├── packages/
│   └── shared/       # Shared types, utilities, constants
└── package.json      # Root workspace config
```

## Consequences

### Positive
- Shared code between web and mobile via `@sterling/shared`
- Single CI/CD pipeline for all packages
- Consistent tooling (ESLint, TypeScript, Prettier)
- Turborepo caching speeds up builds significantly
- Atomic commits across packages

### Negative
- Initial setup complexity
- Need to manage workspace dependencies carefully
- Some Next.js-specific code can't be shared with mobile

## Alternatives Considered
1. **Separate repositories**: Rejected due to code duplication and sync issues
2. **Nx**: Considered but Turborepo is simpler and sufficient for our needs
3. **Lerna**: Outdated compared to Turborepo's caching capabilities
