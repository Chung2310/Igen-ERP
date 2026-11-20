import { creditFeatureRouter } from "./credit-feature.router";
import { supplyInventoryRouter } from "./supply-inventory.router";
import { equipmentRouter } from "./equipment.router";
import { supplyRouter } from "./supply.router";
import { supplierRouter } from "./supplier.router";
import { warehouseRouter } from "./warehouse.router";
import { categoryRouter } from "./category.router";
import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { chatbotRouter } from "./chatbot.router";
import { aiAccessRouter } from "./ai-access.router";
import { assistantKnowledgeRouter } from "./assistant-knowledge.router";
import { resourceRouter } from "./resource.router";
import { timekeepingRouter } from "./timekeeping.router";
import { dashboardRouter } from "./dashboard.router";
import { pushRouter } from "./push.router";
import { mediaRouter } from "./media.router";
import { notificationRouter } from "./notification.router";
import { kanbanRouter } from "./kanban.router";
import { requireAuth } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { superAdminRouter } from "./super-admin.router";
import { faceManagementRouter } from "./face-management.router";
import { payrollRouter } from "./payroll.router";
import { leaveRouter } from "./leave.router";
import { hrContractRouter } from "./hr-contract.router";
import { hrCredentialRouter } from "./hr-credential.router";
import { companyEmailRouter } from "./company-email.router";
import { companyPaymentRouter } from "./company-payment.router";
import { recruitmentRouter } from "./recruitment.router";
import hrDataRouter from "./hr-data.router";
import { hrLeaveRouter } from "./hr-leave.router";
import { departmentRouter } from "./department.router";
import { roomRouter } from "./room.router";
import { customerLeadRouter } from "./customer-lead.router";
import { blogPostRouter } from "./blog-post.router";
import { legalDocumentRouter } from "./legal-document.router";
import { knowledgeLegalReviewRouter } from "./knowledge-legal-review.router";
import { onboardingRouter, companyInvitationsRouter } from "./onboarding.router";
export const apiRouter = Router();
apiRouter.use(creditFeatureRouter);
apiRouter.use("/onboarding", onboardingRouter);
apiRouter.use("/ai", aiAccessRouter);
apiRouter.use("/company-invitations", companyInvitationsRouter);

// Webhooks
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

// Gắn kết router phụ của Xác thực JWT
apiRouter.use("/auth", authRouter);
apiRouter.use("/super-admin", superAdminRouter);

// Gắn kết router phụ của Quản lý mã quyền hệ thống
apiRouter.use("/permissions", permissionRouter);

// Gắn kết router phụ của Cấu hình gán quyền cho Role theo doanh nghiệp
apiRouter.use("/role-permissions", rolePermissionRouter);
apiRouter.use("/face-management", faceManagementRouter);

// Gắn kết router CRUD đa năng (MongoDB)

// Gắn kết router chấm công (GPS Timekeeping)
apiRouter.use("/timekeeping", requireAuth as any, requireModule("hr"), timekeepingRouter);
apiRouter.use("/payroll", payrollRouter);
apiRouter.use("/leave", leaveRouter);
apiRouter.use("/hr-contracts", hrContractRouter);
apiRouter.use("/hr-credentials", hrCredentialRouter);
apiRouter.use("/hr", hrLeaveRouter);
apiRouter.use("/company-email", companyEmailRouter);
apiRouter.use("/company-payment", companyPaymentRouter);
apiRouter.use("/recruitment", recruitmentRouter);
apiRouter.use("/crud", hrDataRouter);

// Gắn kết router tổng hợp số liệu trang tổng quan
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/equipment", equipmentRouter);
apiRouter.use("/supplies", supplyRouter);
apiRouter.use("/supply-inventory", supplyInventoryRouter);
apiRouter.use("/suppliers", supplierRouter);
apiRouter.use("/warehouses", warehouseRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/rooms", roomRouter);
apiRouter.use("/customer-leads", customerLeadRouter);
apiRouter.use("/blogs", blogPostRouter);
apiRouter.use("/legal-documents", legalDocumentRouter);
apiRouter.use("/knowledge-legal-reviews", knowledgeLegalReviewRouter);

// Phân tích & báo cáo doanh thu — chỉ admin/superadmin (gate nằm trong analyticsRouter)

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
apiRouter.use("/assistant/knowledge", expensiveApiRateLimiter, assistantKnowledgeRouter);
