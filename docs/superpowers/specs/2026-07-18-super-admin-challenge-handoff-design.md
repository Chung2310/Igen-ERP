# Thiết kế bàn giao challenge Google Authenticator cho Super Admin

Ngày: 2026-07-18

## Mục tiêu

Khi Super Admin đăng nhập từ màn ERP thông thường, giao diện phải chuyển sang khu vực `/super-admin` và tiếp tục đúng challenge Google Authenticator đang dở dang, không yêu cầu nhập lại email và mật khẩu.

## Nguyên nhân hiện tại

`AuthContext.loginWithEmail` nhận response `challenge_required` gồm `challengeId`, `enrollmentRequired` và `expiresAt`, nhưng chỉ redirect sang `/super-admin`. `SuperAdminShell` không nhận được challenge nên khởi tạo lại ở bước nhập mật khẩu.

## Kiến trúc

Client lưu một bản ghi challenge ngắn hạn trong `sessionStorage` trước khi redirect:

```ts
interface PendingSuperAdminChallenge {
  challengeId: string;
  enrollmentRequired: boolean;
  expiresAt: string;
}
```

Sử dụng một helper duy nhất để đọc, validate và xóa bản ghi. Dữ liệu không chứa mật khẩu, token truy cập hoặc TOTP secret. `sessionStorage` được chọn để challenge còn tồn tại khi refresh nhưng tự mất khi đóng tab.

## Luồng dữ liệu

1. Người dùng nhập email và mật khẩu tại màn ERP.
2. `/api/v1/auth/login` trả `challenge_required`.
3. `AuthContext` validate response, lưu challenge vào `sessionStorage`, rồi redirect tới `/super-admin`.
4. `SuperAdminShell` đọc challenge khi khởi tạo:
   - `enrollmentRequired = false`: mở ngay bước nhập mã TOTP.
   - `enrollmentRequired = true`: gọi endpoint bắt đầu enrollment, hiển thị QR và ô nhập mã.
5. Xác minh thành công: service lưu access token, giao diện xóa pending challenge và vào tầng quản trị hệ thống.
6. Người dùng có thể chuyển từ tầng quản trị hệ thống sang ERP vận hành bằng điều hướng riêng; việc chọn tenant/impersonation thuộc thiết kế hai tầng tiếp theo, không nằm trong bản sửa lỗi này.

## Xử lý lỗi

- Challenge thiếu trường, sai định dạng hoặc đã hết hạn: xóa khỏi `sessionStorage`, hiển thị thông báo phiên xác thực đã hết hạn và quay về bước nhập mật khẩu.
- Endpoint enrollment/TOTP trả lỗi: giữ challenge nếu còn hạn để người dùng nhập lại; backend tiếp tục kiểm soát số lần thử.
- Xác minh thành công hoặc đăng xuất: luôn xóa pending challenge.
- Không dùng `localStorage` để tránh challenge tồn tại qua các phiên trình duyệt lâu dài.

## Thành phần thay đổi

- Helper mới phía client quản lý pending challenge trong `sessionStorage`.
- `AuthContext.tsx`: lưu challenge trước khi redirect.
- `SuperAdminShell.tsx`: hydrate stage/challenge từ pending challenge và tự bắt đầu enrollment khi cần.
- Không thay đổi protocol hoặc endpoint backend hiện có.

## Kiểm thử

- Unit test helper: lưu/đọc challenge hợp lệ; loại challenge hết hạn/sai dữ liệu; xóa challenge.
- Unit test logic chọn stage: enrollment, TOTP và password fallback.
- Typecheck và production build.
- Smoke test thủ công:
  1. Super Admin đã đăng ký Authenticator đăng nhập từ ERP → tới thẳng ô mã 6 số.
  2. Super Admin chưa đăng ký → thấy QR và ô mã.
  3. Refresh khi đang nhập mã → vẫn ở đúng bước.
  4. Challenge hết hạn → trở về bước mật khẩu với thông báo rõ ràng.
  5. Xác minh thành công → challenge tạm bị xóa.

## Ngoài phạm vi

- Thiết kế chọn tenant và impersonation khi vào tầng ERP vận hành.
- Thay đổi chính sách TOTP, thời hạn challenge hoặc giới hạn số lần thử phía backend.
- Lưu mật khẩu hoặc mã TOTP ở client.
