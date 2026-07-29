# Student and Worker Branch Visibility Design

**Date:** 2026-07-29

## Goal

Khôi phục cách ly dữ liệu theo chi nhánh cho phần quản lý học viên/lao động: admin xem toàn bộ dữ liệu của chi nhánh đang chọn; các role bị ghim chi nhánh chỉ xem chi nhánh được cấp; dữ liệu legacy chưa gán chi nhánh có một luồng quản trị riêng.

## Scope rules

- Admin phải chọn một chi nhánh active thuộc công ty trước khi đọc, tạo hoặc sửa dữ liệu thông thường.
- Manager, branch_owner và user dùng branchId từ hồ sơ xác thực; header hoặc body không được mở rộng phạm vi.
- Superadmin giữ cơ chế company/tenant hiện tại và không thuộc phạm vi thay đổi này.
- Không có chế độ gộp “Tất cả chi nhánh” trong danh sách học viên/lao động.
- Bản ghi không có branchId không xuất hiện trong bất kỳ danh sách chi nhánh nào.
- Admin có bộ lọc riêng `scope=unassigned` để xem bản ghi legacy chưa gán chi nhánh của đúng công ty và gán chúng vào một chi nhánh hợp lệ.

## Backend design

`requireAuth` tiếp tục là nơi duy nhất xác thực header `x-branch-id` cho admin bằng `companyCode` và `isActive=true`. Student-management auth middleware yêu cầu branchId cho admin, manager và branch_owner trên route thông thường.

Luồng legacy dùng middleware/route riêng cho admin. Backend tự dựng query `branchId: { $exists: false }` hoặc null trong owner scope của công ty; không biến request branchless thành quyền xem tất cả.

Khi admin gán chi nhánh cho bản ghi legacy, backend tải Branch theo `_id + companyCode + isActive`, sau đó cập nhật bằng query đồng thời yêu cầu bản ghi hiện vẫn chưa có branchId. Request không được đổi trực tiếp branchId của bản ghi đã thuộc một chi nhánh qua PATCH student thông thường.

Create endpoints cho student, course, batch, exam, resource, partner và category tiếp tục fail closed nếu thiếu branchId. Owner được resolve trong active branch trước khi lưu.

## Frontend design

Header bỏ lựa chọn “Tất cả chi nhánh”. BranchContext luôn resolve và lưu một active branch hợp lệ cho admin. StudentsPage tải lại khi activeBranchId đổi và gửi header rõ ràng.

StudentsPage có filter “Chưa gán chi nhánh” chỉ dành cho admin. Filter này gọi endpoint legacy riêng, hiển thị badge, và mở thao tác gán chi nhánh. EditStudentModal thông thường không cho sửa branchId để tránh biến PATCH chung thành API chuyển phạm vi.

## Error handling

- Thiếu active branch: 400 `BRANCH_REQUIRED`.
- Branch đích không thuộc công ty hoặc inactive: 403 `BRANCH_SCOPE_FORBIDDEN`.
- Legacy record không tồn tại hoặc đã được gán: 404/409 typed error.
- Mọi lỗi đi qua terminal API error middleware; không trả envelope riêng tại controller mới.

## Tests

- Admin chọn A đọc/create dữ liệu A; chọn B đọc/create dữ liệu B.
- Manager/branch_owner không thể override branch bằng header/body.
- Danh sách A/B không chứa record legacy.
- Admin-only legacy endpoint chỉ trả record chưa gán thuộc công ty.
- Gán legacy record chỉ chấp nhận branch active thuộc công ty và chống concurrent reassignment.
- UI bỏ “Tất cả chi nhánh”, reload khi đổi branch và gọi endpoint legacy đúng filter.

## Non-goals

- Không migration tự động dữ liệu legacy.
- Không cho admin xem dữ liệu nhiều chi nhánh trong một request.
- Không thay đổi cách ly các module ngoài student/worker management.