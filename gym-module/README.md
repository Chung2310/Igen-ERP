# Quản lý phòng Gym

Gym giữ frontend và nghiệp vụ trong `gym-module/3s`, nhưng khi dùng trong ERP, backend Gym chạy trong **cùng process ERP**. Trình duyệt chỉ dùng ERP tại cổng `3000`: giao diện Gym ở `/chuoi-gym/`, API ở `/api/v1/gym/*`. ERP kiểm tra đăng nhập và quyền rồi chuyển yêu cầu vào ứng dụng Gym nội bộ. Điểm `/internal-gym/*` chỉ chấp nhận token cầu nối do ERP ký.

## Database

Gym dùng cùng `MONGODB_URI`, `MONGODB_USER`, `MONGODB_PASSWORD` và `MONGODB_AUTH_SOURCE` của ERP. Để tránh xung đột với các model ERP như `User`, collection Gym có tiền tố `gym_` trong database ERP. Không cần `GYM_MONGODB_URI` hoặc MongoDB riêng. **Cấu hình này dành cho trường hợp không có dữ liệu Gym cũ cần chuyển.** Nếu đã có dữ liệu Gym ở database khác, cần di chuyển dữ liệu trước khi sử dụng.

Tài khoản đăng nhập và quyền được giữ trong ERP. Hồ sơ nghiệp vụ PT, khách tập, lịch tập và dữ liệu Gym nằm trong các collection `gym_*` của cùng database. Ví Credit, lịch sử giao dịch và thao tác giữ/trừ/hoàn Credit cho AI đều dùng ERP; Gym chỉ giữ nhật ký tác vụ AI của mình. Các API, trang quản trị và cổng thanh toán Credit riêng của Gym đã được gỡ bỏ.

## Cấu hình và chạy

Đặt `GYM_BRIDGE_SECRET` tối thiểu 32 ký tự trong `.env`. Gym có thể dùng các cấu hình `GYM_AI_*`, `GYM_OPENROUTER_*` và `GYM_CLOUDINARY_*`; cấu hình chưa khai báo sẽ dùng giá trị tương ứng của ERP khi có.

Chạy `npm run dev` tại thư mục ERP để phát triển. Chạy `npm run build` rồi `npm start` cho production. Không cần khởi động backend Gym, profile Docker hay cổng `3018` riêng. Docker Compose chỉ publish `3000`.

Frontend Gym vẫn được build riêng vào `dist/chuoi-gym`; backend Gym được build vào `gym-module/3s/dist/backend` và nạp trong process ERP. Gym không làm ERP ngừng chạy nếu khởi động module Gym thất bại; lúc đó API Gym trả `503` và lỗi được ghi vào log.
