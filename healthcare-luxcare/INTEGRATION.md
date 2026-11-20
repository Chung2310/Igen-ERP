# LuxCare vật tư và thiết bị trong Igen ERP

Nguồn chuyển: `https://github.com/Chung2310/LuxCare`, commit `05bae2a9b6422abf4c160502e38d9d27eda78ca4` (19/11/2026). Mã nguồn LuxCare được giữ trong thư mục này để bảo toàn các luồng nghiệp vụ và phụ thuộc gốc; Igen chỉ hiển thị hai màn hình Vật tư và Thiết bị.

## Điểm nối

- Giao diện: `src/pages/SupplyTab.tsx`, `src/pages/EquipmentTab.tsx` được tải trong `src/modules/healthcare/LuxcareLogisticsPage.tsx`.
- Xác thực và chi nhánh: `src/context/AuthContext.tsx` và `src/context/BranchContext.tsx` trong thư mục này dùng context Igen.
- API: `feature-server.ts` chạy các router LuxCare trong tiến trình nội bộ. `server/modules/healthcare/luxcare-proxy.ts` chuyển tiếp yêu cầu từ `/api/v1` của Igen.
- Quyền Igen: `healthcare-supplies:read/manage` và `healthcare-equipment:read/manage`. Quyền Y tế hiện có (`healthcare:read/manage`) cũng mở hai mục để tài khoản đang dùng phân hệ nhìn thấy và sử dụng ngay. Quyền `manage` được ánh xạ vào các quyền nghiệp vụ tương ứng của LuxCare.
- Danh mục nhà cung cấp, kho và nhóm của LuxCare có collection riêng để không ghi vào dữ liệu kho bán hàng hiện có của Igen.

## Phạm vi nguồn

Vật tư gồm danh mục, nhóm, nhà cung cấp, kho, nhập/xuất theo lô, chứng từ, tồn kho V2, tài liệu, thống kê và xuất dữ liệu. Thiết bị gồm danh mục, hồ sơ pháp lý, kiểm định, mượn/trả, phê duyệt, lịch sử và nhập/xuất Excel. Chế độ tồn kho V2 vẫn tuân theo cấu hình và quy trình chuyển đổi của LuxCare; xem `docs/supply`.

## Chạy và kiểm tra

`npm run build:luxcare` tạo `dist-feature/server.cjs`. Build chính chạy bước này và Docker image mang theo bundle. Tiến trình nội bộ chỉ lắng nghe `127.0.0.1` trên cổng ngẫu nhiên và được khởi động khi có yêu cầu đầu tiên.

Các API sử dụng cùng `MONGODB_URI`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_AUTH_SOURCE`, `JWT_ACCESS_SECRET` và cấu hình Cloudinary như Igen. MongoDB phải hỗ trợ transaction cho các thao tác tồn kho V2, đúng với yêu cầu từ LuxCare.
