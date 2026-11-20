> TÀI LIỆU LỊCH SỬ — mô hình cá nhân/miễn phí ngày 09/10 đã được thay bằng B2B. Không dùng nội dung đăng ký cá nhân hoặc phản hồi cũ để submit. Đọc [APP-REVIEW-B2B.md](APP-REVIEW-B2B.md) cho release hiện tại. Trạng thái server trong tài liệu này chỉ có giá trị tại ngày kiểm tra.

# LuxCare: trạng thái App Review ngày 09/10/2026

## Kết luận

**Đã hoàn tất thay đổi source local; chưa sẵn sàng khẳng định bản đang chạy đã bỏ Credit.** Server công khai còn báo companyWalletEnabled=true và chưa có aiQuotaEnabled. Chưa deploy backend/web, tạo build EAS/TestFlight mới hoặc gửi phản hồi/cập nhật metadata App Store Connect trong tác vụ này.

Apple đang review bản 1.0 (23), submission 647eec74-4a46-47ae-b450-dc6adf8ad356. Phản hồi mới nêu 3.1.1 và 2.1(b). Cần trả lời mô hình miễn phí và hỏi màn/luồng nào bị xem là mua dịch vụ; không tự suy ra 3.2 đã được duyệt hoặc xóa toàn bộ đăng ký.

## Source hiện tại

- Web ẩn các menu/trang Credit/nạp. Credit/model/số dư/lịch sử cũ được giữ; AI_CREDITS_ENABLED=false và toàn bộ API ví/callback trả 410 FEATURE_DISABLED. Worker giao dịch ví không khởi chạy.
- AI miễn phí trong hạn mức theo tài khoản dùng chung web/mobile; không phụ thuộc số dư, không mua thêm lượt. LuxCare chịu chi phí provider. Hết hạn mức trả lỗi và thời điểm thử lại; quyền tenant và consent vẫn được kiểm tra.
- Mobile không có màn Credit/nạp; đã cập nhật điều khoản AI miễn phí. API backend mới phải triển khai để mobile dùng đúng cơ chế quota. Chưa kiểm tra thay đổi này trên thiết bị TestFlight thật.
- Đăng ký cá nhân vẫn giữ: xác minh email tạo role trial_user/workspace riêng, không tự thành admin doanh nghiệp đã duyệt. Đơn doanh nghiệp/lời mời vẫn được giữ để chờ làm rõ yêu cầu Apple.
- Docs onboarding hai repository đã sửa đúng luồng workspace riêng. Review notes không còn hướng dẫn mô tả app chỉ dành cho nhân viên LuxCare hoặc ghi năm câu 2.1(b) thành 3.2.

## Kiểm tra local

- Typecheck web/backend và mobile: PASS trong lần kiểm tra này.
- Test mobile consent AI + review preflight: 3 files / 20 tests PASS.
- Test backend quota/Credit và onboarding: 5 files / 50 tests PASS trong lần kiểm tra này.
- Lint web: 0 errors; còn một warning React Hook userProfile có sẵn ở App.tsx.
- Lần triển khai source trước đó đã qua web/backend typecheck, build Vite/esbuild và 13 files / 91 tests liên quan. Không dùng build local này làm bằng chứng native/TestFlight.

## Server công khai: GET kiểm tra ngày 09/10

Địa chỉ https://luxcare.igentechnology.net. Không đăng nhập, đăng ký, gửi email, gọi provider AI hoặc tạo giao dịch trong lần kiểm tra.

| Probe | Kết quả | Ý nghĩa |
| --- | --- | --- |
| health | 200 | Server hoạt động |
| onboarding/capabilities | 200, registrationEnabled=true, personalAiEnabled=true, companyWalletEnabled=true, thiếu aiQuotaEnabled | FAIL: cấu hình/source mới chưa được phục vụ đầy đủ |
| privacy-policy, terms-of-service, user-data-deletion | 200 | Cần kiểm tra nội dung render, không chỉ status |
| ai/consent/company, blogs/blocks, ai/status | 401 | Cổng xác thực từ chối anonymous; chưa chứng minh chức năng đã đăng nhập |
| wallet/balance | 401 thay vì 410 | FAIL: chưa xác nhận Credit tạm ngừng |
| company-wallet/status | 401 thay vì 410 | FAIL: chưa xác nhận Credit tạm ngừng |

review:preflight đã được bổ sung để kiểm tra cờ quota/Credit và 10 đường dẫn. Lần chạy server công khai trả exit code 1 đúng với các vấn đề trên. Không dùng kết quả preflight cũ chỉ kiểm tra health/đăng ký làm bằng chứng sẵn sàng review.

## Việc còn lại trước khi gửi bản sửa

1. Deploy backend/web đã sửa; xác nhận capability miễn phí, Credit disabled và trang pháp lý phản ánh nội dung mới.
2. Chạy lại preflight rồi nghiệm thu đăng nhập/đăng ký/email/AI consent/quota bằng reviewer account. Kiểm tra chung hạn mức giữa web/mobile và thông báo khi hết hạn mức.
3. Tạo build iOS mới lớn hơn 23 và kiểm tra TestFlight trên iPhone thật; chọn đúng build trong App Store Connect.
4. Điền reviewer credentials trong Sign-In Information, cập nhật mô tả/Review Notes/App Privacy tương ứng. Chưa thực hiện các thay đổi online này.
5. Đọc [bản nháp trả lời Apple](APP-REVIEW-RESPONSE-2026-10-09.md). Bản nháp có đủ năm câu 2.1(b) và câu hỏi làm rõ 3.1.1; kiểm tra đúng trạng thái release trước khi gửi các khẳng định.

Hướng dẫn mobile: APP-REVIEW-RELEASE.md trong repository LuxCareMobile/docs. Không xóa dữ liệu Credit, không đóng đăng ký hoặc đổi kiểu phân phối trong lần chỉnh này.
