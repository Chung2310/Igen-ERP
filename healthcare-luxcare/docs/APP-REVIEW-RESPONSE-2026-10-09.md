> TÀI LIỆU LỊCH SỬ — mô hình cá nhân/miễn phí ngày 09/10 đã được thay bằng B2B. Không dùng nội dung đăng ký cá nhân hoặc phản hồi cũ để submit. Đọc [APP-REVIEW-B2B.md](APP-REVIEW-B2B.md) cho release hiện tại. Trạng thái server trong tài liệu này chỉ có giá trị tại ngày kiểm tra.

# LuxCare: bản nháp phản hồi Apple ngày 09/10/2026

Bản nháp để đọc và chỉnh trước khi gửi; chưa được gửi vào App Store Connect. Chỉ gửi các khẳng định về tính năng đang hoạt động sau khi backend/web và build review cùng phản ánh mô hình miễn phí. Không ghi đã xóa đăng ký: đăng ký cá nhân và đơn doanh nghiệp vẫn được giữ trong code.

Apple đang hỏi năm câu về mô hình phí theo **2.1(b)** và yêu cầu gỡ đăng ký doanh nghiệp theo **3.1.1**. Cần làm rõ màn/luồng nào bị xem là dẫn đến mua dịch vụ. Phản hồi mới không tự chứng minh vấn đề phân phối **3.2** trước đó đã được chấp thuận.

## English draft

Hello App Review Team,

Thank you for your feedback. We would like to clarify LuxCare's current business model and the purpose of its registration flows.

LuxCare is a workforce and operations management platform available to users from independent organizations. It is not restricted to employees of LuxCare or one specific organization. Account creation and the features and services available in LuxCare are free on both our website and mobile app. We do not sell digital content, subscriptions, feature upgrades, or AI credits on either platform.

Our answers to the questions under Guideline 2.1(b) are as follows:

1. Who are the users that will use the paid content, subscriptions, features, and services in the app?
There are no paid content, subscriptions, features, or services in LuxCare. Users can register independently to use a private workspace. Members of approved organizations can use their organization's workspace according to their assigned permissions.

2. Where can users purchase the content, subscriptions, features, and services that can be accessed in the app?
There is nowhere to purchase these items. Neither our website nor the mobile app offers purchases or subscriptions for access to LuxCare or its features.

3. What specific types of previously purchased content, subscriptions, features, and services can a user access in the app?
None. Access does not depend on any previous purchase, subscription, or payment agreement.

4. What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase?
None. No paid entitlement is unlocked in the app. AI assistance is free within configured usage limits, and our company covers all AI provider costs. When a usage limit is reached, AI requests are unavailable until the allowance resets. Users cannot pay to increase the allowance or purchase additional requests.

5. How do users obtain an account? Do users have to pay a fee to create an account?
Users tap “Đăng ký tài khoản” (Create account) on the login screen, enter their name, email address and password, and verify an email code. Registration is free and does not require an invitation or existing company membership. After verification, the user receives a private workspace. Creating an account does not make the user an administrator of an approved organization.

A separate “Đăng ký doanh nghiệp” (Organization application) flow lets a user request an organization workspace. This is an administrative review of organization information and workspace permissions; it does not start a purchase, subscription, payment agreement or paid upgrade. If approved, the applicant becomes that organization's administrator. Users may also join an existing organization by accepting an email invitation. Neither process requires a fee.

Regarding Guideline 3.1.1, could you please identify the specific screen, link or action that was considered access to an external purchase or subscription mechanism? As there are no purchases or subscriptions on either platform, we would appreciate clarification on whether the removal request concerns the organization application flow only, or also the free individual account registration flow described above.

We intend to retain public individual registration so that people who do not already belong to an organization can discover and use LuxCare. Please let us know what specific changes are required in light of this free business model.

Kind regards,
LuxCare Team

## Trước khi gửi

- Nghiệm thu backend công khai và build TestFlight đang được chọn. Không dùng kết quả local để mô tả build 1.0 (23) đã thay đổi.
- Điền tài khoản reviewer đã xác minh email, còn hạn mức AI trong Sign-In Information; không lưu mật khẩu vào repository.
- Nếu một mục chưa đúng với bản đã triển khai, sửa bản nháp hoặc triển khai/kiểm tra trước khi khẳng định.
- Tham chiếu: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Contact App Review](https://developer.apple.com/contact/app-store/).
