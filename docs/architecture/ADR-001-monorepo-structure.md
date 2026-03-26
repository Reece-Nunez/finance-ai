# ADR-001: Project Structure

## Status
Accepted (revised)

## Context
Sterling is a web-only finance application built with Next.js.

## Decision
Use an npm workspace with the following structure:

```
sterling/
├── apps/
│   └── web/          # Next.js web application
└── package.json      # Root workspace config
```

## Consequences

### Positive
- Consistent tooling (ESLint, TypeScript, Prettier)
- Room to add packages if needed in the future

### Negative
- Workspace adds slight indirection vs a flat project

## History
- Originally used Turborepo monorepo with shared packages for planned mobile app
- Mobile app abandoned; Turborepo removed as unnecessary for single-app setup
