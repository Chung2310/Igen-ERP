import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { analyticsController } from "../controller/analytics.controller";

export const analyticsRouter = Router();

/**
 * Khu vực Phân tích & Báo cáo — chỉ dành cho admin/superadmin.
 *
 * Gate đặt ở cấp router (không phải từng route) để mọi endpoint thêm về sau đều
 * được bảo vệ mặc định, không phụ thuộc việc người viết có nhớ gắn middleware hay không.
 *
 * Vì chỉ admin/superadmin truy cập được, mọi truy vấn bên trong luôn ở phạm vi
 * toàn công ty (companyCode lấy từ token). `branchId` nếu có chỉ là bộ lọc hiển
 * thị, không phải ranh giới bảo mật — khác với các module dùng chung cho
 * branch_owner. Xem docs/admin-analytics/research.md mục 3.3.
 */
analyticsRouter.use(requireAuth as any, requireRole(["admin", "superadmin"]) as any);

// Metadata: báo cáo nào đang dùng được, nguồn dữ liệu nào còn thiếu điều kiện
analyticsRouter.get("/meta", analyticsController.getMeta as any);
