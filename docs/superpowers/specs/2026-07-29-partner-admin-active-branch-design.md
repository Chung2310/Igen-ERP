# Partner Admin Active-Branch Scope Design

**Date:** 2026-07-29

## Goal

Khi admin đổi chi nhánh trên giao diện, mọi thao tác Partner phải dùng chi nhánh đang chọn. Manager, branch_owner và user tiếp tục bị giới hạn vào chi nhánh được gán.

## Root cause

Request đã mang `x-branch-id` và middleware xác thực đã resolve thành `req.user.branchId`. Tuy nhiên Partner create vẫn dùng `req.user.uid` làm `ownerId`, trong khi Partner list tạo tập owner theo những user thuộc chi nhánh. Admin có thể tạo thành công một bản ghi mang `branchId` đúng nhưng `ownerId` không nằm trong tập owner của chi nhánh, khiến bản ghi không xuất hiện ở bất kỳ danh sách chi nhánh nào. `PartnersPage` cũng chưa phụ thuộc `activeBranchId`, nên đổi chi nhánh không đảm bảo tải lại danh sách.

## Design

- Partner create và commission-level create dùng `resolveCreateOwnerId(req.user)` cho admin/manager; superadmin vẫn resolve theo công ty được chọn.
- `branchId` tiếp tục lấy từ `req.user.branchId`, tức giá trị đã được backend xác thực từ `x-branch-id` đối với admin.
- Partner list/detail/update/delete/payout tiếp tục truyền `req.user.branchId` vào service, giữ cách ly dữ liệu.
- `PartnersPage` đọc `activeBranchId`, đưa nó vào dependency tải danh sách và gửi `x-branch-id` rõ ràng cho các thao tác Partner.
- `AddPartnerModal` gửi `x-branch-id` rõ ràng khi create/update để không phụ thuộc timing của global fetch interceptor.
- Branch selector lưu chi nhánh mặc định đã resolve vào localStorage để request đầu tiên và giao diện dùng cùng một phạm vi.

## Tests

- Controller test: admin create resolves owner within active branch instead of using admin uid trực tiếp.
- UI/service test: Partner request carries active branch and list reloads when branch changes.
- Existing branch isolation tests must remain green.

## Non-goals

- Không cho admin xem trộn nhiều chi nhánh cùng lúc.
- Không thay đổi quyền chuyển chi nhánh của manager, branch_owner hoặc user.
- Không tự động migration Partner cũ trong thay đổi này.