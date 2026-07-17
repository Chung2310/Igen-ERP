# CGNAT-Aware DDoS Protection Design

## Mục tiêu

Giữ nhiều lớp chống flood nhưng tránh chặn nhầm văn phòng hoặc nhà mạng CGNAT có hàng trăm người dùng hợp lệ chung một IP public. Danh tính đã xác thực và tài khoản đích là khóa kiểm soát chính; IP chỉ là backstop rộng.

## Phạm vi

- Tách nginx rate-limit zone của auth và Socket.IO.
- Nới giới hạn IP thô tại nginx và backend socket.
- Chuyển limiter login/auth/refresh của Express sang Redis để nhất quán giữa nhiều instance.
- Giới hạn socket handshake và event theo user sau xác thực, đồng thời giữ backstop IP rộng.
- Thêm regression test mô phỏng nhiều user chung IP và kiểm tra cấu hình nginx.

Không triển khai fingerprint phần cứng, CAPTCHA hoặc dịch vụ Cloudflare trả phí trong phạm vi này.

## Kiến trúc giới hạn HTTP

Nginx chỉ chống flood thô trước Node:

- API chung: `100r/s`, burst `200`, tối đa `300` connection/IP.
- Auth: zone riêng `10r/s`, burst `30`, tối đa `100` connection/IP.
- Socket handshake: zone riêng `50r/s`, burst `100`, tối đa `500` connection/IP.
- Endpoint tốn tài nguyên giữ zone riêng nhưng tăng connection/IP lên `100`.

Express tiếp tục dùng JWT đã verify để tạo khóa `u:{userId}` cho request đã đăng nhập. Login dùng hai lớp: `acct:{email}` với giới hạn 10/15 phút và IP backstop 300/15 phút. Refresh token dùng IP backstop 1000/15 phút. Tất cả bộ đếm này dùng `RedisRateLimitStore` với prefix riêng và fail-open giống limiter Redis hiện có.

## Kiến trúc Socket.IO

Trước xác thực, handshake IP limiter chỉ là backstop rộng: 300/phút/IP. Sau khi JWT được xác thực, connection limiter áp dụng đồng thời:

- Tối đa 5 connection/user.
- Tối đa 500 connection/IP.

Event limiter chuyển từ khóa `socketId` sang `userId`, vì nhiều tab/socket của cùng user phải chia sẻ một quota tổng. Bucket event được lưu Redis để nhiều Node instance dùng chung; giới hạn mặc định 120 event/phút/user và ngắt socket sau ba vi phạm liên tiếp tại socket đó.

Nếu Redis lỗi, hệ thống giữ chính sách fail-open hiện tại và ghi log cảnh báo có throttle, tránh biến sự cố Redis thành outage toàn hệ thống.

## Cấu hình

Các mặc định mới:

```text
DDOS_AUTH_IP_LIMIT=300
DDOS_SOCKET_HANDSHAKE_LIMIT=300
DDOS_SOCKET_MAX_PER_USER=5
DDOS_SOCKET_MAX_PER_IP=500
DDOS_SOCKET_EVENT_LIMIT=120
```

Mọi giá trị vẫn có thể override bằng biến môi trường. `.env.example` phải mô tả rõ đây là backstop cho CGNAT, không phải quota nghiệp vụ.

## Quan sát và lỗi

Response HTTP 429 tiếp tục dùng thông báo hiện tại. Log cảnh báo limiter phải ghi lớp bị chặn (`account`, `ip_backstop`, `socket_handshake`, `socket_connection`, `socket_event`) nhưng không ghi token hay mật khẩu. Header chuẩn của `express-rate-limit` vẫn được bật.

## Kiểm thử

- Hai JWT hợp lệ khác user nhưng cùng IP tạo hai key HTTP khác nhau.
- Limiter account chuẩn hóa hoa/thường và không bị ảnh hưởng bởi account khác.
- Auth/refresh sử dụng Redis store với prefix riêng.
- Ít nhất 100 user khác nhau cùng IP có thể giữ một socket mỗi người.
- User thứ sáu bị từ chối khi giới hạn per-user là 5.
- Event từ nhiều socket cùng user cộng vào một bucket user.
- nginx dùng zone auth/socket khác nhau và các backstop đúng ngưỡng.
- Test hiện có về Cloudflare real IP, rollback counter và fail-open tiếp tục đạt.

## Tiêu chí hoàn thành

Một văn phòng 100 người chung IP có thể đăng nhập, gọi API và duy trì một socket mỗi người mà không chạm IP backstop mặc định. Một user đơn lẻ vẫn không thể vượt connection/event quota, và tấn công chưa xác thực từ một IP vẫn bị chặn ở nginx, Express và socket handshake.
