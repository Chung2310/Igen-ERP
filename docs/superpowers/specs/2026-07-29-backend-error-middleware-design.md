# Backend Error Middleware Design

## Mục tiêu

Xây dựng hệ thống xử lý lỗi thống nhất cho toàn bộ /api/v1, thay thế new Error, status/statusCode, regex thông báo, controller tự trả response và Express default 500. Backend và frontend chuyển sang một contract lỗi duy nhất trong cùng đợt triển khai.

## Phạm vi

Bao gồm toàn bộ router, middleware, controller, service dưới /api/v1; lỗi domain, validation, auth, conflict, upload, database và dịch vụ ngoài; request correlation; structured logging; cập nhật toàn bộ API client/frontend.

Không bao gồm Socket.IO, worker/queue, Sentry và đa ngôn ngữ.

## Contract lỗi duy nhất

Mọi lỗi trả JSON có dạng:

    {
      "ok": false,
      "error": {
        "code": "PARTNER_PHONE_ALREADY_EXISTS",
        "message": "Số điện thoại đã tồn tại cho đối tác trong chi nhánh.",
        "details": { "field": "phone" },
        "requestId": "req_01J..."
      }
    }

Quy tắc:

- Không trả success, status, message hoặc chuỗi error ở top level.
- code ổn định, viết UPPER_SNAKE_CASE.
- message là tiếng Việt an toàn để hiển thị.
- details là object tùy chọn, chỉ chứa dữ liệu an toàn khai báo chủ động.
- requestId luôn có và khớp header X-Request-Id.
- Lỗi 500 production không trả stack, raw database error, query, token, secret hay cause.

## Taxonomy lỗi

AppError có code: ErrorCode, status: number, details tùy chọn, expose: boolean và cause tùy chọn.

Subtype chuẩn:

- BadRequestError: 400
- ValidationError: 400
- UnauthorizedError: 401
- ForbiddenError: 403
- NotFoundError: 404
- ConflictError: 409
- RateLimitError: 429
- ExternalServiceError: 502/503
- InternalError: 500

error-codes.ts là registry typed duy nhất. Các code đầu tiên gồm PARTNER_PHONE_ALREADY_EXISTS, PARTNER_NOT_FOUND, BRANCH_REQUIRED, RESOURCE_VERSION_CONFLICT, VALIDATION_FAILED, AUTH_TOKEN_INVALID, DATABASE_CONFLICT, EXTERNAL_SERVICE_UNAVAILABLE và INTERNAL_ERROR.

Không suy luận loại lỗi bằng regex trên message.

## Ranh giới trách nhiệm

### Domain và service

- Ném AppError typed cho lỗi dự kiến.
- Không biết cấu trúc JSON response.
- Không dùng Object.assign để gắn status.
- Không dùng plain Error cho validation, not found, forbidden hoặc conflict.
- Plain Error chỉ dành cho lỗi bất ngờ và sẽ thành INTERNAL_ERROR.

### Controller

- Luồng thành công giữ nguyên trong phạm vi dự án này.
- Luồng lỗi không tự phân loại và không lặp try/catch.
- Dùng asyncHandler để forward lỗi.
- Chỉ bắt lỗi khi cần cleanup rồi rethrow.

### Error normalizer

normalizeError chuyển:

- Joi thành ValidationError/VALIDATION_FAILED với details theo field.
- Mongoose ValidationError và CastError thành 400.
- Mongo 11000 thành 409/DATABASE_CONFLICT; service nên pre-check để dùng code domain cụ thể.
- JWT expired/invalid thành 401.
- Multer size/type thành 400 hoặc 413.
- Rate limiter thành 429.
- status/statusCode cũ qua adapter migration tạm thời.
- Lỗi không nhận diện thành InternalError.

Adapter không dùng nội dung message để đoán status.

### Terminal error middleware

Middleware duy nhất được mount sau routes và API 404, trước static/Vite. Nó normalize, structured-log và serialize contract. Nếu headers đã gửi thì gọi next(error).

## Request context và logging

requestContextMiddleware chạy trước routes:

- Nhận X-Request-Id hợp lệ hoặc tạo UUID.
- Gắn requestId vào typed request context và response header.
- Không tin actor/tenant metadata từ client.

Log dùng logger hiện có với requestId, method, path, status, errorCode, actorId, companyCode, branchId, errorName, stack và cause.

- 4xx dự kiến log warn; không cần stack.
- 5xx log error; có stack và cause.
- Không log token, password, OTP, cookie, authorization header hoặc raw request body.
- Client dùng requestId để tra cứu hỗ trợ.

## API 404 và lỗi trước router

- Route /api/v1 không tồn tại ném API_ROUTE_NOT_FOUND.
- Invalid JSON, payload quá lớn và body-parser errors đi qua cùng terminal handler ở app level.
- Static/Vite 404 không dùng API error contract.

## Frontend migration đồng thời

Tạo ApiClientError và parser chung cho envelope mới. Tất cả client bỏ fallback payload.error hoặc payload.message.

Frontend:

- Hiển thị error.message.
- Dùng error.code cho hành vi cụ thể.
- Hiển thị requestId khi cần hỗ trợ.
- Không parse message để điều khiển logic.

Phạm vi gồm student apiFetch, auth, super-admin, payroll, recruitment, inventory, chat, resource và fetch trực tiếp trong page/component.

## Chiến lược migration toàn /api/v1

Một đợt phát hành, chia commit:

1. Typed errors, request context, normalizer, middleware và contract tests.
2. Adapter lỗi thư viện, API 404 và body-parser.
3. Chuyển service/domain theo module.
4. Chuyển controller sang asyncHandler.
5. Chuyển frontend sang ApiClientError.
6. Xóa handler cục bộ, regex patch và legacy adapter.
7. Contract audit bảo đảm không endpoint nào trả shape cũ.

Legacy status/statusCode chỉ tồn tại trong migration và phải bị xóa trước bước 6 hoàn tất.

## Kiểm thử

### Unit

- Constructor/subtype AppError.
- Registry code không trùng.
- Normalizer cho Joi, Mongoose, Mongo 11000, JWT, Multer, legacy status và unknown.
- Serializer không rò stack/cause.
- Request ID validation/generation.

### Middleware integration

Dùng Express test app kiểm tra status/envelope, requestId/header, API 404, invalid JSON, payload too large, headers-sent và production 500 che giấu nội dung.

### Domain/controller

- Partner trùng số điện thoại ném ConflictError code cụ thể.
- Service đại diện cho validation/not-found/forbidden/conflict được migrate và test.
- Async controller rejection đến terminal handler.

### Contract audit

Test fail nếu error response có top-level message, string error, success false hoặc status error.

### Frontend

Test parser envelope, malformed/network error, service dùng parser chung và UI hiển thị message/requestId.

## Tiêu chí hoàn thành

- Mọi lỗi /api/v1 dùng đúng một envelope.
- Không regex message để xác định status.
- Không domain error dùng plain Error, status hoặc statusCode.
- Không controller tự map cùng loại lỗi.
- Không lỗi dự kiến trả 500.
- Lỗi 500 production không lộ chi tiết.
- Mọi response lỗi có requestId và log tương ứng.
- Frontend không đọc contract cũ.
- Typecheck, build và test pass trên worktree sạch.
