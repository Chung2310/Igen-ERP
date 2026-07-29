# Backend Error Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Chuyển toàn bộ /api/v1 và frontend sang một hệ thống typed errors, một terminal middleware và một error envelope duy nhất, không còn regex message hoặc lỗi dự kiến trả 500.

**Architecture:** Domain/service ném AppError có ErrorCode ổn định. normalizeError là adapter duy nhất cho lỗi thư viện; requestContextMiddleware tạo correlation ID; apiErrorHandler log có cấu trúc và serialize envelope. Frontend chỉ đọc envelope qua ApiClientError/parser chung.

**Tech Stack:** TypeScript 5.8, Express 4, Joi 18, Mongoose 9, jsonwebtoken, Multer, Node test runner, Vitest 4, React 19.

## Global Constraints

- Áp dụng toàn bộ /api/v1 trong cùng một đợt phát hành.
- Contract mới là breaking change; không giữ top-level message/error/status/success.
- Backend trả ErrorCode ổn định và message tiếng Việt.
- Production 500 chỉ trả message an toàn và requestId.
- Structured log dùng logger hiện có, không thêm Sentry.
- Không dùng regex trên message để xác định HTTP status.
- Không stage hoặc sửa các thay đổi Wallet đang tồn tại trong workspace.
- Thực thi trong worktree sạch được tạo từ commit mới nhất của nhánh feature; không triển khai trực tiếp trong working tree hiện đang bẩn.

---

## File map

### Nền tảng backend mới

- Create server/errors/error-codes.ts: registry ErrorCode.
- Create server/errors/app-error.ts: AppError và subtype HTTP.
- Create server/errors/normalize-error.ts: adapter Joi/Mongoose/Mongo/JWT/Multer/legacy.
- Create server/errors/error-response.ts: type và serializer envelope.
- Create server/middleware/request-context.ts: requestId và Express request augmentation.
- Create server/middleware/api-error-handler.ts: terminal middleware.
- Create server/middleware/api-not-found.ts: 404 cho /api/v1.
- Create server/utils/async-handler.ts: wrapper controller async.
- Modify server/modules/student-management/config/logger.ts: nhận structured object và redact trường nhạy cảm.
- Modify server.ts: thứ tự body parser, request context, API router, 404 và terminal handler.
- Modify server/router/index.ts: bỏ middleware regex tạm.
- Delete server/middleware/api-error.ts sau migration.
- Delete server/middleware/api-error.test.ts sau khi test tương ứng được thay bằng test kiến trúc mới.

### Backend migration

- Modify server/service/*.ts, server/super-admin/*.ts, server/utils/*.ts và server/modules/student-management/services/*.ts được liệt kê bởi audit command trong Task 4-5.
- Modify server/controller/*.ts, server/router/*.ts và server/modules/student-management/controllers/*.ts được liệt kê bởi audit command trong Task 6.

### Frontend

- Create src/services/apiClientError.ts.
- Modify src/modules/student-management/lib/api.ts.
- Modify src/utils/errorMessage.ts.
- Modify các service và fetch trực tiếp được audit trong Task 7.

### Tests

- Create server/errors/app-error.test.ts.
- Create server/errors/normalize-error.test.ts.
- Create server/middleware/request-context.test.ts.
- Create server/middleware/api-error-handler.integration.test.ts.
- Create server/api-error-contract-audit.test.ts.
- Create src/services/apiClientError.test.ts.
- Modify test domain/controller hiện có theo từng module.

---

### Task 1: Typed error foundation and code registry

**Files:**
- Create: server/errors/error-codes.ts
- Create: server/errors/app-error.ts
- Test: server/errors/app-error.test.ts

**Interfaces:**
- Produces ErrorCode, ErrorDetails, AppError và các subtype cho mọi task backend sau.
- Không phụ thuộc Express hoặc database.

- [ ] **Step 1: Write failing tests for immutable error metadata and subtype statuses**

    import assert from "node:assert/strict";
    import test from "node:test";
    import {
      ConflictError,
      InternalError,
      ValidationError,
    } from "./app-error";

    test("typed errors expose stable code, status and safe details", () => {
      const error = new ConflictError(
        "PARTNER_PHONE_ALREADY_EXISTS",
        "Số điện thoại đã tồn tại.",
        { field: "phone" },
      );
      assert.equal(error.status, 409);
      assert.equal(error.code, "PARTNER_PHONE_ALREADY_EXISTS");
      assert.equal(error.expose, true);
      assert.deepEqual(error.details, { field: "phone" });
    });

    test("internal errors are not exposed", () => {
      assert.equal(new InternalError({ cause: new Error("db") }).expose, false);
      assert.equal(new ValidationError("VALIDATION_FAILED", "Sai dữ liệu").status, 400);
    });

- [ ] **Step 2: Run RED**

Run: npx tsx --test server/errors/app-error.test.ts

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement registry and error classes**

error-codes.ts exports an ERROR_CODES const object and ErrorCode union. Initial registry must include generic infrastructure codes plus all codes introduced in later migration tasks.

app-error.ts implements constructor input:

    interface AppErrorOptions {
      code: ErrorCode;
      status: number;
      message: string;
      details?: Record<string, unknown>;
      expose?: boolean;
      cause?: unknown;
    }

Each subtype fixes status; InternalError fixes code INTERNAL_ERROR, status 500 and expose false.

- [ ] **Step 4: Run GREEN and typecheck focused files**

Run: npx tsx --test server/errors/app-error.test.ts
Expected: PASS.

Run: node node_modules/typescript/bin/tsc --noEmit
Expected: no new error from server/errors; record unrelated baseline failures separately.

- [ ] **Step 5: Commit**

    git add server/errors/error-codes.ts server/errors/app-error.ts server/errors/app-error.test.ts
    git commit -m "feat: add typed backend error taxonomy"

---

### Task 2: Error normalization without message guessing

**Files:**
- Create: server/errors/normalize-error.ts
- Test: server/errors/normalize-error.test.ts
- Modify: server/errors/error-codes.ts

**Interfaces:**
- Consumes AppError and ErrorCode from Task 1.
- Produces normalizeError(error: unknown): AppError.

- [ ] **Step 1: Write table-driven failing tests**

Cover:

- Existing AppError is returned unchanged.
- Joi isJoi error becomes VALIDATION_FAILED/400 with details.fields.
- Mongoose ValidationError becomes MODEL_VALIDATION_FAILED/400.
- Mongoose CastError becomes INVALID_IDENTIFIER/400.
- Mongo code 11000 becomes DATABASE_CONFLICT/409 without raw key value.
- TokenExpiredError and JsonWebTokenError become AUTH_TOKEN_EXPIRED/AUTH_TOKEN_INVALID/401.
- Multer LIMIT_FILE_SIZE becomes PAYLOAD_TOO_LARGE/413.
- Legacy numeric status/statusCode is temporarily mapped to LEGACY_HTTP_ERROR.
- Plain Error becomes INTERNAL_ERROR/500 and preserves cause internally.
- No test or implementation parses error.message to choose status.

Example assertion:

    const normalized = normalizeError(Object.assign(new Error("duplicate"), {
      code: 11000,
      keyPattern: { phone: 1 },
    }));
    assert.equal(normalized.status, 409);
    assert.equal(normalized.code, "DATABASE_CONFLICT");
    assert.deepEqual(normalized.details, { fields: ["phone"] });

- [ ] **Step 2: Run RED**

Run: npx tsx --test server/errors/normalize-error.test.ts
Expected: FAIL because normalizeError is missing.

- [ ] **Step 3: Implement adapters using type guards**

Use explicit guards for library name/code/properties. Never import application services. Sanitize details through allowlists; do not include raw error.message for Mongo/JWT/Multer technical errors.

- [ ] **Step 4: Run GREEN**

Run: npx tsx --test server/errors/app-error.test.ts server/errors/normalize-error.test.ts
Expected: all tests PASS.

- [ ] **Step 5: Commit**

    git add server/errors
    git commit -m "feat: normalize backend library errors"

---

### Task 3: Request context, serializer and terminal middleware

**Files:**
- Create: server/middleware/request-context.ts
- Create: server/errors/error-response.ts
- Create: server/middleware/api-error-handler.ts
- Create: server/middleware/api-not-found.ts
- Test: server/middleware/request-context.test.ts
- Test: server/middleware/api-error-handler.integration.test.ts
- Modify: server/modules/student-management/config/logger.ts

**Interfaces:**
- Produces getRequestContext(req), requestContextMiddleware, serializeError(error, requestId), apiNotFound, apiErrorHandler.
- Error envelope exactly matches the approved spec.

- [ ] **Step 1: Write request ID RED tests**

Test accepted request ID pattern, rejection of oversized/control-character input, UUID generation and matching X-Request-Id response header.

- [ ] **Step 2: Write Express integration RED tests**

Build a local Express app with requestContextMiddleware, routes that throw each AppError, apiNotFound and apiErrorHandler.

Assert exact body:

    {
      ok: false,
      error: {
        code: "PARTNER_PHONE_ALREADY_EXISTS",
        message: "Số điện thoại đã tồn tại.",
        details: { field: "phone" },
        requestId: response.headers["x-request-id"],
      },
    }

Also assert production InternalError returns code INTERNAL_ERROR and safe message, while logger receives stack/cause. Assert headers-sent delegates to next.

- [ ] **Step 3: Run RED**

Run: npx tsx --test server/middleware/request-context.test.ts server/middleware/api-error-handler.integration.test.ts
Expected: FAIL because middleware is missing.

- [ ] **Step 4: Implement request context and serializer**

Use crypto.randomUUID. Store context on a declared optional property of Express Request. Serializer includes details only when expose is true and details exists.

- [ ] **Step 5: Upgrade logger with structured fields and redaction**

Preserve existing logger.info/error call compatibility. Add a structured path that JSON-serializes requestId, actor/tenant/branch metadata and strips authorization, cookie, password, token, otp and secrets recursively.

- [ ] **Step 6: Implement terminal middleware**

Normalize once, log warn for expected 4xx and error for 5xx, return the single envelope, and delegate when res.headersSent.

- [ ] **Step 7: Run GREEN**

Run both middleware tests.
Expected: PASS with exact envelope and no secret leakage.

- [ ] **Step 8: Commit**

    git add server/middleware server/errors/error-response.ts server/modules/student-management/config/logger.ts
    git commit -m "feat: add correlated API error middleware"

---

### Task 4: Wire middleware order and body-parser/404 errors

**Files:**
- Modify: server.ts
- Modify: server/router/index.ts
- Create: server/api-error-order.integration.test.ts
- Delete after replacement: server/middleware/api-error.ts
- Delete after replacement: server/middleware/api-error.test.ts

**Interfaces:**
- Consumes middleware from Task 3.
- Produces a single app-level error path for all /api/v1 failures.

- [ ] **Step 1: Write RED integration tests for middleware order**

Test invalid JSON, payload too large, unknown API route and an async rejected route. Verify static non-API 404 is not serialized as API envelope.

- [ ] **Step 2: Run RED**

Run: npx tsx --test server/api-error-order.integration.test.ts
Expected: current payload handler/Express default shape violates the envelope.

- [ ] **Step 3: Refactor server bootstrap**

Mount in this order:

    requestContextMiddleware
    JSON/body parsers
    userActivityMiddleware
    apiRouter
    apiNotFound
    apiErrorHandler
    Vite/static fallback

Remove the payload-only handler. Ensure body-parser errors reach apiErrorHandler. Remove the regex-based temporary classifier.

- [ ] **Step 4: Run GREEN**

Run middleware/order tests and existing rate-limit/body-size tests.
Expected: all API errors share the contract.

- [ ] **Step 5: Commit**

    git add server.ts server/router/index.ts server/middleware server/api-error-order.integration.test.ts
    git commit -m "refactor: centralize API error flow"

---

### Task 5: Migrate domain and service errors

**Files:**
- Modify all files returned by:
  rg -l "throw new Error|Object.assign\(new Error|statusCode\s*=|\.status\s*=" server --glob "*.ts" --glob "!**/*.test.ts"
- Primary groups:
  server/service/*.ts
  server/super-admin/*.ts
  server/utils/*.ts
  server/modules/student-management/services/*.ts
  server/modules/student-management/utils/*.ts
- Modify or create focused tests beside each changed service using the repository's existing `*.test.ts` convention.

**Interfaces:**
- Consumes typed errors from Task 1.
- Every expected failure emits an explicit ErrorCode; plain Error remains only for unexpected infrastructure failures.

- [ ] **Step 1: Generate and save the migration audit**

Run:

    rg -n "throw new Error|Object.assign\(new Error|statusCode\s*=|\.status\s*=" server --glob "*.ts" --glob "!**/*.test.ts"

Copy the baseline count into the task notes. Categorize each occurrence as validation, unauthorized, forbidden, not found, conflict, external service or internal invariant.

- [ ] **Step 2: Add RED tests per module group**

At minimum cover auth, branch scope, CRUD, chat/resource, recruitment, payroll/leave, super-admin, student, course/batch/exam/resource/payment/partner/custom-fields.

Partner test must assert:

    await assert.rejects(
      () => PartnerService.createPartner(...),
      error => error instanceof ConflictError
        && error.code === "PARTNER_PHONE_ALREADY_EXISTS"
        && error.status === 409,
    );

- [ ] **Step 3: Migrate student-management services**

Replace expected plain errors in the student-management files identified by the saved migration audit with subtype/code/message/details. Preserve existing success behavior. Run their focused tests after each service family.

- [ ] **Step 4: Migrate core ERP services**

Migrate auth, CRUD, branch, chat/resource, recruitment, payroll/leave, Google/cloud providers and super-admin services. External provider failures must use ExternalServiceError with cause and safe user message.

- [ ] **Step 5: Run service suites**

Run focused Node/Vitest tests for every touched family. Expected: PASS and no assertion relies on raw library messages.

- [ ] **Step 6: Enforce audit**

Run the audit again. Expected remaining plain Error occurrences only in startup configuration, cryptographic invariants, Redis protocol corruption and other explicitly documented internal errors. No status/statusCode mutation remains in domain/service code.

- [ ] **Step 7: Commit by coherent module family**

Examples:

    git commit -m "refactor: type student management domain errors"
    git commit -m "refactor: type core ERP domain errors"
    git commit -m "refactor: type super admin domain errors"

---

### Task 6: Standardize controllers and routers with asyncHandler

**Files:**
- Create: server/utils/async-handler.ts
- Test: server/utils/async-handler.test.ts
- Modify files returned by:
  rg -l "next\(error\)|catch \(error" server/controller server/router server/modules/student-management/controllers --glob "*.ts" --glob "!**/*.test.ts"
- Modify or create focused controller/router tests beside each changed module using the repository's existing `*.test.ts` convention.

**Interfaces:**
- Produces asyncHandler(handler): Express RequestHandler.
- Controllers no longer map domain errors or return legacy error envelopes.

- [ ] **Step 1: Write asyncHandler RED test**

Assert synchronous throw and rejected promise both call next once; successful handler does not.

- [ ] **Step 2: Implement asyncHandler and run GREEN**

Implementation:

    export const asyncHandler = (handler: AsyncRouteHandler): RequestHandler =>
      (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

- [ ] **Step 3: Convert student-management controllers**

Remove repetitive try/catch. Keep cleanup-specific catch/rethrow. Replace direct error responses with typed errors where validation belongs in controller.

- [ ] **Step 4: Convert core controllers and inline routers**

Remove local toClientError, duplicate-key mapping and status/message shapes from CRUD, Kanban, recruitment, super-admin in every controller and inline router identified by the saved migration audit.

- [ ] **Step 5: Run controller tests**

Update tests to mount controller/router with terminal middleware and assert full HTTP envelope rather than forwarded error objects.

- [ ] **Step 6: Audit**

Expected:

    rg -n "res\.status\([45][0-9][0-9]\).*message|success:\s*false|status:\s*[\"']error" server/controller server/router server/modules/student-management/controllers

returns only explicitly exempt non-/api/v1 code, then zero after exemptions are checked.

- [ ] **Step 7: Commit**

    git commit -m "refactor: route backend failures through error middleware"

---

### Task 7: Migrate frontend to ApiClientError

**Files:**
- Create: src/services/apiClientError.ts
- Test: src/services/apiClientError.test.ts
- Modify: src/modules/student-management/lib/api.ts
- Modify: src/utils/errorMessage.ts
- Modify service files:
  src/services/authService.ts
  src/services/branchService.ts
  src/services/companyWorkCalendarService.ts
  src/services/internalChatService.ts
  src/services/inventoryProductService.ts
  src/services/notificationService.ts
  src/services/resourceService.ts
  src/services/rolePermissionService.ts
  src/services/superAdminRequest.ts
- Modify direct-fetch consumers: `src/components/common/ChatbotWidget.tsx`, `src/components/hr/CalendarTab.tsx`, `src/components/hr/ContractsTab.tsx`, `src/components/notification/NotificationToastContainer.tsx`, `src/components/settings/CompanyDriveConfigCard.tsx`, `src/components/settings/GoogleDriveTab.tsx`, `src/components/settings/WorkShiftsTab.tsx`, `src/modules/student-management/hooks/useRealtimePayment.ts`, `src/modules/student-management/pages/Notifications/NotificationsPage.tsx`, `src/modules/student-management/pages/QRCheckin/QRCheckinPage.tsx`, `src/pages/ChatTab.tsx`, `src/pages/ResourceTab.tsx`, `src/pages/SubmitProofPage.tsx`.

**Interfaces:**
- Produces ApiErrorEnvelope, ApiClientError and parseApiErrorResponse(response).
- All clients throw ApiClientError for HTTP errors.

- [ ] **Step 1: Write parser RED tests**

Cover valid envelope, malformed response, non-JSON response and network error. Assert code, status, details and requestId are preserved.

- [ ] **Step 2: Implement parser**

ApiClientError extends Error and exposes code, status, details and requestId. Malformed server errors use code INVALID_ERROR_RESPONSE and safe message.

- [ ] **Step 3: Migrate shared API clients**

Replace payload.error/payload.message fallback with parser. Change getApiErrorMessage to prefer ApiClientError.message and optionally format requestId for support, without technical-message regex.

- [ ] **Step 4: Migrate direct fetch consumers**

Use a shared checkedFetch helper or call parseApiErrorResponse consistently. No component reads old error shapes.

- [ ] **Step 5: Run frontend tests and audit**

Run parser tests and affected component/service tests.

Audit:

    rg -n "payload\.error|payload\.message|errorData\.error|errorData\.message|success:\s*false|status:\s*[\"']error" src

Expected: no old error-contract parsing.

- [ ] **Step 6: Commit**

    git commit -m "refactor: consume standard API error envelope"

---

### Task 8: Contract audit, legacy removal and release verification

**Files:**
- Create: server/api-error-contract-audit.test.ts
- Modify: server/errors/normalize-error.ts
- Modify any remaining files reported by audits.
- Update: docs/superpowers/specs/2026-07-29-backend-error-middleware-design.md only if implementation revealed an approved clarification.

**Interfaces:**
- Removes legacy status/statusCode adapter.
- Establishes a regression gate preventing old contracts from returning.

- [ ] **Step 1: Write contract audit RED test**

Scan backend response sources and representative Express routes. Fail on top-level error string, top-level message for errors, success false or status error.

- [ ] **Step 2: Remove legacy adapter**

Delete status/statusCode normalization. Any remaining caller now fails tests/typecheck and must be converted to AppError.

- [ ] **Step 3: Run all static audits**

    rg -n "Object\.assign\(new Error|statusCode\s*=|\.status\s*=" server --glob "*.ts" --glob "!**/*.test.ts"
    rg -n "success:\s*false|status:\s*[\"']error" server --glob "*.ts"
    rg -n "payload\.error|payload\.message|errorData\.error|errorData\.message" src --glob "*.{ts,tsx}"

Expected: zero non-exempt matches.

- [ ] **Step 4: Run full verification on a clean worktree**

    npm run typecheck
    npm run build
    npx tsx --test server/errors/*.test.ts server/middleware/*.test.ts server/api-error*.test.ts
    npx vitest run

Expected: all commands exit 0. Do not treat failures caused by unrelated dirty-worktree deletions as acceptable; verification must run from the isolated clean worktree.

- [ ] **Step 5: Smoke test representative HTTP routes**

Verify 400, 401, 403, 404, 409, 413, 429 and 500 envelopes, X-Request-Id, production redaction and corresponding structured logs.

- [ ] **Step 6: Final commit**

    git add server src docs
    git commit -m "feat: standardize API error handling"

- [ ] **Step 7: Push and update PR**

    git push -u origin feat/backend-error-middleware

Summarize the breaking response contract and deployment coordination required for frontend/backend to release together.
