# AI miễn phí và tạm ngừng Credit

- Web và mobile dùng chung hạn mức AI theo tài khoản: giờ, ngày, tháng; không có ví/số dư hoặc phí người dùng trong luồng đang hoạt động.
- Giữ cấu hình AI_PERSONAL_HOURLY_LIMIT, AI_PERSONAL_DAILY_LIMIT, AI_PERSONAL_MONTHLY_LIMIT hiện tại. Không đặt hạn mức riêng để đổi thiết bị né giới hạn.
- AI_FREE_ENABLED ưu tiên bật/tắt AI; nếu chưa khai báo, dùng cờ AI_PERSONAL_FREE_ENABLED hiện có. OPENROUTER_API_KEY và AI_PERSONAL_MONTHLY_BUDGET_USD vẫn bắt buộc khi bật AI. Ngân sách USD là chi phí vận hành do LuxCare chịu.
- Backend giữ chỗ lượt sử dụng trong transaction MongoDB trước khi gọi AI. Replica set hoặc sharded cluster là điều kiện của cơ chế hạn mức có sẵn.
- Hết hạn mức: trả AI_QUOTA_EXCEEDED (HTTP 429), resetAt và Retry-After. Phòng chat nhận cùng thông báo qua internal_ai_error. Không có yêu cầu nạp hoặc mua thêm lượt.
- Công việc thất bại sau khi giữ chỗ vẫn tính lượt để tránh gọi lặp không giới hạn. Các vòng gọi công cụ trong một yêu cầu dùng cùng lượt; chi phí nhà cung cấp chỉ ghi nhận vào ngân sách vận hành.
- Thông tin doanh nghiệp, quyền truy cập dữ liệu và đồng ý chia sẻ AI vẫn được kiểm tra riêng.

## Credit đang tạm ngừng

shared/features.ts đặt AI_CREDITS_ENABLED=false. Mã nguồn ví, Credit, nạp, callback, kiểm thử và model dữ liệu vẫn được giữ. Không xóa collection hoặc số dư/lịch sử cũ.

Menu, trang ví và SEO không cung cấp điểm truy cập. Tất cả /api/v1/wallet/* và /api/v1/company-wallet/* trả FEATURE_DISABLED (410), bao gồm callback và client cũ. Tác vụ quyết toán giao dịch ví không khởi chạy.

AI_COMPANY_WALLET_ENABLED trong cấu hình cũ không thể tự mở lại tính năng. Muốn dùng lại cần chủ động đổi cờ, cập nhật cả frontend/backend, mô hình phí, điều khoản và yêu cầu App Review trước khi phát hành.

## Kiểm tra trước triển khai

1. Kiểm tra tài khoản mới, thành viên và admin đều dùng được AI trong hạn mức, không cần số dư.
2. Dùng cùng tài khoản trên web/mobile và xác nhận lượt được cộng chung.
3. Hết hạn mức: AI không gọi nhà cung cấp, thông báo có thời điểm dùng lại.
4. Đường dẫn nạp cũ và callback bị chặn. Đăng ký/xác minh email và hồ sơ doanh nghiệp vẫn hoạt động.
5. Deploy backend/web và build mobile mới để áp dụng thay đổi. Mã nguồn local không tự cập nhật build App Store đã nộp.
