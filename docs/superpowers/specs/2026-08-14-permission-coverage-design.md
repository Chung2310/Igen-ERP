# Permission Coverage Design

**Goal:** Bảo đảm mọi API mutation và read có dữ liệu nhạy cảm trong dự án đều được bảo vệ nhất quán bằng catalog quyền chuẩn `module:read` / `module:manage`, đồng thời frontend chỉ phản ánh quyền chứ không thay thế enforcement backend.

## Quyết định kiến trúc

- Giữ catalog hai cấp: `read` cho đọc/xem và `manage` cho tạo, sửa, xóa, duyệt, cấu hình.
- `manage` tiếp tục bao hàm `read` qua `expandEffectivePermissions`; không thêm lại các quyền thao tác chi tiết vào catalog canonical.
- Mọi router backend phải có `requireAuth` và permission guard tương ứng; module guard và tenant/branch/object scope là lớp độc lập, không thay thế permission guard.
- Legacy permission names chỉ được normalize về mã canonical; route mới không được dùng mã legacy.
- Các endpoint webhook/OAuth callback/public QR được ghi rõ là ngoại lệ công khai và phải có chữ ký, token hoặc giới hạn phạm vi riêng.

## Phạm vi sửa

1. Bịt các route CRUD có mutation nhưng thiếu mapping quyền (`training-*`, `workflows`, leave models), đồng thời giữ các ngoại lệ nộp đơn nghỉ phép chỉ cho chính người dùng.
2. Bảo vệ notification creation, Google Drive mutations/reads và các route media/proxy theo phân loại dữ liệu; không cấp quyền module rộng hơn cần thiết.
3. Chuẩn hóa recruitment read/manage, analytics, HR contracts và user/role administration về cùng catalog.
4. Đồng bộ frontend sidebar, workspace guards và permission UI với canonical catalog; loại các mapping trùng/sai.
5. Thêm route-permission inventory test để route mới thiếu `requireAuth`/permission bị phát hiện trong CI.

## Quy tắc quyền theo nhóm

| Nhóm | Read | Manage |
|---|---|---|
| Recruitment | `recruitment:read` | `recruitment:manage` |
| Google Drive/resources | `resource:read` | `resource:manage` |
| Notifications | `chat:read` hoặc permission nghiệp vụ của caller | `chat:manage`/permission nghiệp vụ tùy loại gửi |
| HR contracts | `hr:read` | `hr:manage` |
| Analytics | `dashboard:read` | `dashboard:manage` nếu có mutation |
| User/role access | `access:read` | `access:manage` |
| CRUD HR/inventory/work | mapping explicit theo model | mapping explicit theo model |

Notification nội bộ của chính user, push subscription, media proxy và các thao tác cá nhân được giữ dưới `requireAuth` nếu controller đã khóa đúng user/tenant; các API phát sinh dữ liệu cho người khác phải có permission manage.

## Data-flow và scope

Permission check chạy sau authentication và trước controller. Module enablement, company scope, branch scope, hierarchy scope và resource ownership vẫn chạy riêng. Không dùng frontend `locked`, role name hoặc `enabledModules` làm cơ chế bảo mật.

## Kiểm thử và tiêu chí hoàn thành

- Unit tests cho từng permission mapping và alias normalization.
- Route source/inventory tests xác nhận mọi mutation protected router có auth + permission, và mọi public exception nằm trong allowlist có lý do.
- Integration tests chứng minh user chỉ có `*:read` đọc được nhưng không mutate; `*:manage` đọc và mutate được; tenant/branch khác bị từ chối.
- Frontend tests xác nhận sidebar/tab/action dùng đúng canonical permission và không hiện action manage cho read-only user.
- Chạy toàn bộ permission/access tests, route tests và typecheck trước khi merge.

## Không thuộc phạm vi

- Không đổi mô hình role hierarchy hoặc cách tính union giữa custom permissions và role permissions trong đợt này.
- Không xóa alias legacy khỏi dữ liệu đã lưu.
- Không mở quyền mới cho webhook/OAuth/public QR nếu chưa có cơ chế xác thực tương ứng.
