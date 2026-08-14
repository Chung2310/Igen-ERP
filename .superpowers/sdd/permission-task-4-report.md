# Permission Coverage Plan — Task 4 Report

## Scope

Reviewed and committed the Task 4 permission normalization for recruitment, analytics, and HR contracts.

- Recruitment GET routes use `recruitment:read`; mutations use `recruitment:manage`.
- Analytics reporting reads use `dashboard:read`; operating-expense mutations use `dashboard:manage`; authentication and company-scoped controller queries remain in place.
- HR contract listing and extension listing use `hr:read`; upload, create, update, and extension mutations use `hr:manage`.
- Added focused router permission tests for HR contracts and updated recruitment/analytics coverage.

## Verification

Attempted:

```text
pnpm exec vitest run server/router/analytics.router.test.ts server/router/recruitment.router.test.ts server/router/hr-contract.router.test.ts
```

The command could not start because pnpm attempted dependency reconciliation and failed with `EPERM` while renaming existing `node_modules` packages; it also reported registry metadata fetch failure. No test result was produced.

The generated `.pnpm-store/` directory is intentionally excluded from the commit.

## Review follow-up (P1)

Updated `server/router/analytics.router.test.ts` so `routeMiddlewareNames` filters by HTTP method and collects middleware from all matching route layers. The operating-expense mutation assertions now explicitly inspect POST and DELETE routes, preventing POST `/operating-expenses` from accidentally validating the GET read guard.

Verification was attempted with `npx vitest run server/router/analytics.router.test.ts` and `npm run typecheck`, but the local dependency installation is incomplete: `node_modules/vitest/vitest.mjs` and `node_modules/typescript/bin/tsc` are missing. No test or typecheck result was produced.
