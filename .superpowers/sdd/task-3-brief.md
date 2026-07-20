# Task 3 brief: Custom field API and role guard

## Context

Expose Task 2 service through authenticated API. User waived commits. Preserve unrelated dirty files. Scope only six module keys.

## Files

- Create `server/modules/student-management/validations/custom-field.validation.ts`
- Create `server/modules/student-management/controllers/custom-field.controller.ts`
- Create `server/modules/student-management/routes/custom-field.routes.ts`
- Create `server/modules/student-management/routes/custom-field.routes.test.ts`
- Modify `server/modules/student-management/router.ts`

## API

Mounted at `/api/v1/student-management/custom-fields`:

- `GET /:moduleKey` authenticated, all roles; optional `includeArchived=true` only honored for managing roles.
- `POST /:moduleKey` only superadmin/admin/manager.
- `PATCH /:moduleKey/:id` only superadmin/admin/manager.
- `POST /:moduleKey/:id/archive` only superadmin/admin/manager.
- `POST /:moduleKey/:id/restore` only superadmin/admin/manager.

Use existing `authMiddleware`, `requireRoles`, `validate` patterns. Validate `moduleKey` against exact `MODULE_KEYS` and `id` as 24-char Mongo ObjectId. Create/update schemas must reject unknown keys; moduleKey, tenantId, key, createdBy, updatedBy must never be accepted from body.

Controller derives `tenantId = resolveCustomFieldTenant(req.user!)`, `actorId=req.user!.uid`, and moduleKey only from validated params. It calls Task 2 service and returns `{ success: true, data }`; create status 201. Map not-found to 404, input/domain conflict to 400/409, unexpected errors through `next` consistently with repository patterns.

Select type requires nonempty unique `{label,value}` options. Hidden+required payload should be normalized by service, not rejected. Validation supports all Task 1 types and type-specific `validation` keys without accepting arbitrary prototype-polluting keys.

## Tests

Test middleware/handlers without live Mongo: user can GET but gets 403 on mutations; manager/admin/superadmin pass mutations; unauthenticated 401; invalid module/id/body 400; tenant from auth not body; create 201; list includeArchived restriction; archive/restore call correct service method; domain duplicate conflict response.

Run:

```powershell
npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts
npm.cmd run typecheck
```

Write report `.superpowers/sdd/task-3-report.md`. Do not stage or commit.
