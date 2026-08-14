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
