import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { crudRouter } from "./crud.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { chatbotRouter } from "./chatbot.router";
import { resourceRouter } from "./resource.router";
import { studentManagementRouter } from "../modules/student-management/router";
import { workerManagementRouter } from "../modules/worker-management/router";
import { laborPartnerRoutes } from "../modules/worker-management/labor-partners/routes/labor-partner.routes";
import { workerQrAttendancePublicRoutes } from "../modules/worker-management/routes/worker-qr-attendance.routes";
import { timekeepingRouter } from "./timekeeping.router";
import { dashboardRouter } from "./dashboard.router";
import { analyticsRouter } from "./analytics.router";
import { pushRouter } from "./push.router";
import { mediaRouter } from "./media.router";
import { notificationRouter } from "./notification.router";
import { kanbanRouter } from "./kanban.router";
import { requireAuth } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { expensiveApiRateLimiter, publicApiRateLimiter } from "../middleware/rate-limit";
import { superAdminRouter } from "./super-admin.router";
import { faceManagementRouter } from "./face-management.router";
import { payrollRouter } from "./payroll.router";
import { leaveRouter } from "./leave.router";
import { hrContractRouter } from "./hr-contract.router";
import { companyEmailRouter } from "./company-email.router";
import { companyPaymentRouter } from "./company-payment.router";
import { recruitmentRouter } from "./recruitment.router";
import { webhookRouter } from "./webhook.router";
import { resourceImportRouter } from "./resource-import.router";
import { retailRouter } from "../modules/retail/router";
import { productCatalogRouter } from "../modules/inventory/product-catalog/router";
import { receivingRouter } from "../modules/inventory/receiving/router";
import { warehouseRouter } from "../modules/inventory/warehouse/router";
import { inventoryCountRouter } from "../modules/inventory/counting/router";
import { serialUnitRouter } from "../modules/inventory/serials/router";
import { repairRouter } from "../modules/repair/router";
import { repairFeedbackRoutes } from "../modules/repair/repair-feedback.routes";
import { financeRouter } from "../modules/finance/router";
import { customerRouter } from "../modules/customer-management/router";
export const apiRouter = Router();

// Webhooks
apiRouter.use("/webhook", webhookRouter);
/**
 * GET /api/v1/health
 * Health Check API để giám sát trạng thái của hệ thống
 */
apiRouter.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      server: "up",
      database: isDbConnected ? "online (connected via MongoDB)" : "offline",
    },
  });
});

// Gắn kết router phụ của Google Drive Tích hợp cá nhân
apiRouter.use("/integrations/google-drive", googleDriveRouter);

// Quản lý tài nguyên — file explorer nội bộ + tài liệu Google Drive
apiRouter.use("/resources", requireAuth as any, requireModule("resource"), resourceRouter);
apiRouter.use("/resource-imports", requireAuth as any, requireModule("inventory"), resourceImportRouter);

// Gắn kết router phụ của Xác thực JWT
apiRouter.use("/auth", authRouter);
apiRouter.use("/super-admin", superAdminRouter);

// Gắn kết router phụ của Quản lý mã quyền hệ thống
apiRouter.use("/permissions", permissionRouter);

// Gắn kết router phụ của Cấu hình gán quyền cho Role theo doanh nghiệp
apiRouter.use("/role-permissions", rolePermissionRouter);
apiRouter.use("/face-management", faceManagementRouter);


// Gắn kết router CRUD đa năng (MongoDB)
apiRouter.use("/crud", crudRouter);

// Gắn kết router chấm công (GPS Timekeeping)
apiRouter.use("/timekeeping", requireAuth as any, requireModule("hr"), timekeepingRouter);
apiRouter.use("/payroll", payrollRouter);
apiRouter.use("/leave", leaveRouter);
apiRouter.use("/hr-contracts", hrContractRouter);
apiRouter.use("/company-email", companyEmailRouter);
apiRouter.use("/company-payment", companyPaymentRouter);
apiRouter.use("/recruitment", recruitmentRouter);

// Gắn kết router tổng hợp số liệu trang tổng quan
apiRouter.use("/dashboard", dashboardRouter);

// Phân tích & báo cáo doanh thu — chỉ admin/superadmin (gate nằm trong analyticsRouter)
apiRouter.use("/analytics", analyticsRouter);

// Upload/download file qua Cloudinary — dùng chung cho chat, tài nguyên, kho, avatar
apiRouter.use("/media", expensiveApiRateLimiter, mediaRouter);

// Gắn kết router Web Push (thông báo đẩy khi người dùng không mở web)
apiRouter.use("/push", pushRouter);

// Gắn kết router thông báo web
apiRouter.use("/notifications", notificationRouter);

// API chuyên biệt cho giao việc, dự án và audit Kanban
apiRouter.use("/kanban", requireAuth as any, requireModule("hr"), kanbanRouter);

// Gắn kết router chat nội bộ
apiRouter.use("/chat", requireAuth as any, requireModule("chat"), chatRouter);

// Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp
apiRouter.use("/chatbot", expensiveApiRateLimiter, requireAuth as any, requireModule("chat"), chatbotRouter);

// Module Quản lý Học viên
apiRouter.use("/", studentManagementRouter);

// Module Bán lẻ & POS
apiRouter.use("/inventory/catalog", requireAuth as any, requireModule("inventory"), productCatalogRouter);
apiRouter.use("/inventory/receiving", requireAuth as any, requireModule("inventory"), receivingRouter);
apiRouter.use("/inventory/warehouses", requireAuth as any, requireModule("inventory"), warehouseRouter);
apiRouter.use("/inventory/counts", requireAuth as any, requireModule("inventory"), inventoryCountRouter);
apiRouter.use("/inventory/serials", requireAuth as any, requireModule("inventory"), serialUnitRouter);
apiRouter.use("/repair/feedback", publicApiRateLimiter, repairFeedbackRoutes);
apiRouter.use("/repair", requireAuth as any, requireModule("repair"), repairRouter);
apiRouter.use("/customers", requireAuth as any, requireModule("customer"), customerRouter);
apiRouter.use("/", requireAuth as any, requireModule("retail"), retailRouter);
apiRouter.use("/finance", requireAuth as any, requireModule("finance"), financeRouter);


// Public QR attendance routes cho lao động (không yêu cầu đăng nhập)
// Lao động quét mã QR từ điện thoại cá nhân — không có session đăng nhập.
apiRouter.use("/worker-management/qr-attendance", workerQrAttendancePublicRoutes);

apiRouter.use("/worker-management/partners", requireAuth as any, requireModule("partner"), laborPartnerRoutes);
apiRouter.use("/", requireAuth as any, requireModule("worker"), workerManagementRouter);
