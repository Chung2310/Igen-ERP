> TÀI LIỆU LỊCH SỬ — mô hình cá nhân/miễn phí ngày 09/10 đã được thay bằng B2B. Không dùng nội dung đăng ký cá nhân hoặc phản hồi cũ để submit. Đọc [APP-REVIEW-B2B.md](APP-REVIEW-B2B.md) cho release hiện tại. Trạng thái server trong tài liệu này chỉ có giá trị tại ngày kiểm tra.

# App Review: onboarding và mô hình miễn phí

Cập nhật 09/10/2026. Apple đã review bản **1.0 (23)** trên iPhone 17 Pro Max, submission **647eec74-4a46-47ae-b450-dc6adf8ad356**. Các chỉnh sửa hiện tại ở local; chưa tự cập nhật server, TestFlight hoặc App Store Connect.

## Yêu cầu cần làm rõ

- **3.1.1:** Apple xem đăng ký doanh nghiệp/tổ chức là lối vào mua dịch vụ ngoài app và yêu cầu gỡ. Không suy diễn rằng Apple yêu cầu xóa cả đăng ký cá nhân miễn phí. Hỏi cụ thể màn/luồng nào gây nhận định này và phạm vi cần gỡ.
- **2.1(b):** trả lời đầy đủ năm câu về mô hình phí: không có nội dung/dịch vụ trả phí, không có nơi mua trên web/mobile, không có quyền mua trước, không có mở khóa trả phí ngoài IAP; tài khoản tạo miễn phí qua email.
- **3.2 trước đó:** giải thích nền tảng phục vụ nhiều tổ chức độc lập và người dùng tự đăng ký được. Việc phản hồi mới không nhắc 3.2 chưa đủ để kết luận Apple đã chấp thuận phân phối public.

Đọc [bản nháp trả lời Apple](APP-REVIEW-RESPONSE-2026-10-09.md) trước khi gửi. Chưa gửi phản hồi bằng tác vụ sửa code/docs này.

## Luồng hiện tại đã đối chiếu code

1. Đăng nhập → **Đăng ký tài khoản**: nhập tên/email/mật khẩu và đồng ý điều khoản. Backend lưu đăng ký chờ xác minh; chưa cấp tài khoản workspace hoàn chỉnh.
2. Xác minh mã email 6 chữ số, hiệu lực 15 phút. Backend tạo tài khoản role **trial_user** và workspace riêng có Company/chi nhánh MAIN. Người dùng vào workspace riêng, không tự thành admin doanh nghiệp đã được duyệt.
3. Hồ sơ → **Doanh nghiệp & lời mời** → **Đăng ký doanh nghiệp**: gửi đơn, theo dõi/bổ sung/hủy. Đây là quy trình xét duyệt thông tin và quyền quản trị, không phải mua dịch vụ.
4. Duyệt đơn nâng workspace riêng lên active, giữ mã/dữ liệu và nâng chủ tài khoản thành admin. Superadmin chọn module phù hợp.
5. Admin → **Mời nhân viên qua email**; người nhận xác nhận tham gia. Nếu tham gia tổ chức khác, workspace riêng được archive; dữ liệu riêng không tự chuyển sang tổ chức đích.

## AI và Credit

- Web/mobile dùng chung hạn mức AI theo tài khoản. LuxCare chịu chi phí nhà cung cấp; người dùng/doanh nghiệp không trả phí hoặc mua thêm lượt. Hết hạn mức thì tạm ngừng đến thời điểm reset; giữ bước xin phép chia sẻ dữ liệu.
- Credit/nạp tiền tạm ngừng bằng AI_CREDITS_ENABLED=false. Giữ code/model/dữ liệu cũ. Web ẩn điểm truy cập; API ví và callback chặn client cũ bằng 410 FEATURE_DISABLED.
- Mobile hiện không có màn số dư Credit hay nạp tiền. Đã cập nhật điều khoản AI miễn phí. Mobile dùng trợ lý trong Chat; không mô tả một màn AI cá nhân hoặc bảng số lượt còn lại nếu build đó không có.
- Xem [AI-ACCESS-ROLLOUT.md](AI-ACCESS-ROLLOUT.md) về cấu hình backend và nghiệm thu hạn mức dùng chung.

## Review Notes sau khi nghiệm thu

- Build mới: [version/build; lớn hơn build 23, kiểm tra số thực tế trong App Store Connect].
- Public registration: Login → “Đăng ký tài khoản” → email verification → private workspace; no invitation or purchase required.
- Organization application: Profile → “Doanh nghiệp & lời mời” → “Đăng ký doanh nghiệp”. Approval controls workspace administration, not a paid entitlement.
- AI: open Chat and the assistant conversation available to the account; review and accept the data-sharing notice before sending. AI is free within configured limits; no paid allowance.
- Reviewer account for a verified private workspace: [credentials entered only in App Store Connect Sign-In Information].
- Reviewer account for an approved organization, if needed: [credentials]. List only modules enabled for that account.
- Account deletion: Profile/account security → Delete account. A sole workspace administrator can initiate a deletion request, see its deadline and cancel it.
- Privacy URL: https://luxcare.igentechnology.net/privacy-policy; terms and support must match the released app.

## Metadata và triển khai

Mô tả/screenshots/support site phản ánh nền tảng nhiều tổ chức, đăng ký công khai, workspace riêng và xét duyệt doanh nghiệp. Không ghi chỉ dành cho nhân viên LuxCare, không quảng cáo mua gói/nạp AI. Không mô tả tên nội bộ trial_user như một gói dùng thử trả phí.

Deploy backend/web, chạy preflight mobile, build/TestFlight mới và kiểm tra bằng tài khoản reviewer trước khi gửi bản sửa. Metadata và câu trả lời App Store Connect cần được cập nhật thủ công; tài liệu local không thực hiện việc gửi.

## AI sharing, moderation and privacy notes for the new build

- The personal/company assistants and Knowledge uploads show a data-sharing notice before any provider request. Reviewers can read the actual model processors and privacy links, accept, decline or withdraw permission. Refusal keeps other account features available.
- Provider metadata is read from OpenRouter's public catalog. Permission is bound to the account, assistant scope, company workspace, models, processors and disclosure version. Background indexing rechecks permission and company scope before OCR/embedding; revoked permission prevents pending work from sharing data. No extra AI model environment variable is needed. Disclosed provider routing is enforced at the backend.
- Chat sends and edits, plus blog publishing, use a local prohibited-text/link/attachment-metadata filter. This does not inspect pixels or audio inside files; report/block mechanisms and human handling remain necessary for media and missed violations.
- Report handling requires company administrator/superadmin authorization and company scope. Assign an operator to handle reports promptly before submission.
- Privacy URL: https://luxcare.igentechnology.net/privacy-policy
- Terms URL: https://luxcare.igentechnology.net/terms-of-service
- Deletion URL: https://luxcare.igentechnology.net/user-data-deletion
- Existing support mailbox retained: support@luxdefa.vn. Confirm that it is monitored.
- App Privacy: reconcile account identifiers/contact data, user content (chat/AI prompts/documents/photos/voice), usage/security data and attendance location with actual enabled features. Do not mark all data as uncollected; AI processing consent does not replace these declarations.
- Store review requires the deployed backend and a new TestFlight build. Local tests/export do not demonstrate readiness of the reviewed build 1.0 (23) or the public server.

## Account management before email verification and Blog safety

- Unverified users: Email verification → small **Account** entry in the header → **Delete account** → password confirmation. The verification form still has only Verify and Resend code. Account management also allows signing out to correct a registration/login mistake.
- Blog on mobile: Post menu (**…**) → **Report post** or **Block author**. Web has equivalent actions on each other author's post. Blocking hides the author's posts in the feed, search and pins; **Blocked users** allows reversing the block. Chat and Blog use the same user block records.
- Reports are linked to a stored `postId`, not a chat room. Reporter/author/company identities are derived from the authenticated account and stored post. Repeated reporting does not overwrite an existing moderator decision.
- Platform moderation: Super Admin → **Blog reports**. The queue requires a real platform administrator and the existing privileged session/device check. Company admins and publishing accounts do not receive access to the global reporting queue. Review the full post and supported image/video/audio/PDF previews, record a decision and notes, and confirm removal before hiding a post for all readers. Other document formats require internal inspection before deciding.
- Publishing authors manage their own posts; platform administrators and blog editors can manage the shared feed. Permission checks are enforced server-side.
- Deleted accounts have their Blog report snapshots and user block records removed through the account cleanup flow. Reports made by or about that account are removed; moderator references in other reports are cleared.
- Startup creates the new Blog report collection and indexes, including the unique post/reporter index. This change does not reassign existing company/user data.
- `npm run review:preflight` (in `LuxCareMobile/mobile`) checks public registration, shared free AI capability, anonymous protected AI/Blog endpoints and disabled Credit routes (410 FEATURE_DISABLED). It makes only GET requests. A `401` checks the authentication gate; TestFlight testing with reviewer accounts is still required to verify the actual authenticated feature behavior.
- Before submission: deploy the API/web and check the proxy paths; enable actual public registration/free AI with working SMTP, provider and operating budget; update rendered legal pages and App Store metadata; upload/select the new build and verify registration, verification, AI permission/quota, deletion and Blog report/block flows. Do not submit claims based on local source changes alone.
