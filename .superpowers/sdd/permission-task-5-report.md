# Permission coverage Task 5 report

## Changes

- `POST /api/v1/notifications` now requires canonical `chat:manage`.
- Notification inbox list/read/read-all/delete remain `requireAuth` self-service endpoints; their controller/service calls remain recipient-scoped.
- Notification creation verifies that `recipientUid` belongs to the authenticated caller's company and always persists the authenticated company code, ignoring any request-body `companyCode`.
- Role permission list/detail routes now require `access:read`; save/delete require `access:manage`.
- Superadmin's control-plane company selection is documented at the role router. Non-superadmin scope remains enforced by the controller, which overwrites company scope from the authenticated user.

## Tests added

- `server/router/notification-access-permission.test.ts` asserts the notification creation guard, preserved self-service notification routes, and canonical role-administration guards.
- `server/controller/notification.controller.permission.test.ts` asserts recipient tenant isolation and authenticated company precedence.

## Verification

- `git diff --check` exited 0.
- Focused Vitest command was attempted:
  `npx vitest run server/router/notification-access-permission.test.ts`
- It could not start because this workspace is missing `node_modules/vitest/vitest.mjs` (`MODULE_NOT_FOUND`). `node_modules/typescript/bin/tsc` is also absent, so typecheck was not runnable. Consequently the TDD red/green execution and full focused test verification remain pending dependency restoration.
- `.pnpm-store/` was left untracked and excluded from the commit.
