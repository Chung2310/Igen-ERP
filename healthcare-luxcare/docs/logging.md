# Logging và tra cứu lỗi

Backend dùng Pino qua `server/config/logger.ts`. Production xuất **mỗi sự kiện một dòng JSON** ra stdout (info/warn/debug) hoặc stderr (error). Development mặc định là text dễ đọc. Không còn tạo hoặc ghi đồng bộ `logs/combined.log`, `logs/error.log`; những file cũ không bị xóa.

## Cấu hình

| Biến                  | Mặc định                                    | Ý nghĩa                                                                 |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `LOG_LEVEL`           | `info` ở production, `debug` ở development  | `error`, `warn`, `info`, `debug`, `trace`, `fatal`, `silent`            |
| `LOG_FORMAT`          | `json` ở production, `pretty` ở development | Dùng `json` khi thu thập log bằng máy                                   |
| `LOG_SLOW_REQUEST_MS` | `1000`                                      | Request đạt ngưỡng được đánh dấu `slow: true` và ghi ít nhất mức warn   |
| `APP_VERSION`         | `unknown`                                   | Git SHA/release; Docker image do workflow CD build tự nhận `github.sha` |
| `INSTANCE_ID`         | hostname                                    | Phân biệt các instance/container                                        |

Các biến được đọc khi khởi động; cần restart/recreate container sau khi thay đổi. Docker Compose hiện giữ `max-size: 10m`, `max-file: 3` cho mỗi container. Đây là giới hạn dung lượng, không phải số ngày lưu. Log đã xoay ra ngoài giới hạn này sẽ không còn tra cứu được nếu chưa thu thập ra hệ thống lưu trữ khác.

## Trường và sự kiện

Mọi dòng có `time` (ISO UTC), `level`, `service`, `environment`, `version`, `instanceId`, `pid`. Log phát sinh trong HTTP request tự có `requestId`; sau xác thực có thêm `actorId`, `companyCode`/`tenantId`, `branchId` nếu hiện diện trên `req.user`.

- `http.request.completed`: method, path (bỏ toàn bộ query), route template nếu Express đã match, status, durationMs, slow, responseBytes nếu có Content-Length. Route template là đường dẫn trong router, có thể chưa gồm mount prefix; dùng path để xem endpoint đầy đủ.
- `http.request.aborted`: kết nối đóng trước khi response hoàn tất; không gán status thành công giả. Thời gian tính từ lúc middleware nhận request đến lúc kết nối đóng.
- `api_request_failed`: mã lỗi và error.name/message/stack/cause. Log hoàn tất request vẫn được ghi riêng; khi đếm request lỗi, chỉ đếm `http.request.completed` để tránh tính hai lần.
- Các module cũ đã chuyển từ `console.*` sang logger chung; thông điệp cũ nằm trong `msg`, metadata bổ sung có thể nằm trong `data`. Các sự kiện mới nên dùng object để có trường lọc trực tiếp.

Middleware context và access log chạy trước CORS/body parser/rate limiter. Mỗi request chỉ có một sự kiện kết thúc, kể cả JSON hỏng, payload quá lớn, 429 hoặc client ngắt kết nối. Các GET thành công và nhanh đến health, wallet/balance, crud/products dùng debug; lỗi và request chậm vẫn hiện ở production. Log socket thường xuyên cũng dùng debug.

`AsyncLocalStorage` giữ context qua các lời gọi async trong request. Worker/timer độc lập và Socket.IO không tự có HTTP requestId: khi bổ sung sự kiện worker, truyền rõ jobId, attempt, companyCode và requestId gốc nếu job đã lưu nó. Đợt này chưa bổ sung cơ chế truyền context qua hàng đợi.

## Viết log mới

```ts
import { logger } from "../config/logger";

logger.info({ event: "inventory.export.completed", exportId, itemCount });
logger.error({ event: "provider.request.failed", provider: "example", durationMs, error });
```

Truyền Error nguyên bản để giữ stack, cause và code. Tránh nối error.message vào chuỗi. Không ghi req/res, nguyên body, header, webhook, nội dung tài liệu hoặc dữ liệu lương. Logger che các khóa token/password/secret/authorization/cookie/apiKey/OTP và body, xử lý vòng tham chiếu, giới hạn độ sâu/độ dài. Regex che thông tin trong chuỗi chỉ là lớp bổ sung, không bảo đảm nhận ra bí mật được ghép vào văn bản tùy ý.

## Tra cứu trên VPS

Các ví dụ dưới dùng shell trên VPS có `jq`. Với container có tên khác, thay `lux-care`.

```sh
# Tìm toàn bộ sự kiện của một request, bao gồm stderr.
docker logs --since 30m lux-care 2>&1 | jq -R 'fromjson? | select(.requestId == "req-123")'

# Request chậm và lỗi hệ thống.
docker logs --since 30m lux-care 2>&1 | jq -R 'fromjson? | select(.slow == true or .level == "error")'

# Theo dõi request của một công ty.
docker logs -f --since 5m lux-care 2>&1 | jq --unbuffered -R 'fromjson? | select(.companyCode == "COMPANY_A")'

# File Docker json-file đã được xuất/copy ra để phân tích: bóc lớp log bên ngoài.
jq -r '.log' exported-container-json.log | jq -R 'fromjson? | select(.requestId == "req-123")'
```

Không cần sửa hoặc xoay thủ công file do Docker quản lý. Log cũ trước khi triển khai vẫn là text và không có các trường mới; bộ lọc JSON ở trên bỏ qua dòng text cũ và thông báo không phải JSON từ thư viện bên ngoài.

Frontend lấy mã từ error envelope hoặc `X-Request-Id`. Header này được expose qua CORS. Các màn hình dùng `getApiErrorMessage`, đăng nhập và Super Admin hiển thị mã tra cứu khi lỗi có requestId. Các service legacy tự tạo `new Error(...)` vẫn cần chuyển sang `parseApiErrorResponse` để giữ mã; có thể tra header trong Network trong thời gian chuyển đổi.

## Kiểm thử

```sh
node --import tsx --test server/config/logger.test.ts server/middleware/request-context.test.ts server/middleware/request-logger.integration.test.ts server/middleware/api-error-handler.integration.test.ts server/api-error-order.integration.test.ts src/services/apiClientError.test.ts src/utils/errorMessage.test.ts
```

Bao phủ format JSON, che dữ liệu ở các kiểu gọi cũ/mới, Error cause, request song song không lẫn actor/context, lỗi trước controller, request bị ngắt, request chậm và mã tra cứu frontend.
