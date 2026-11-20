import { Router } from "express";
import * as controller from "../controller/customer-lead.controller";
import { requireAuth } from "../middleware/auth";
import { publicApiRateLimiter } from "../middleware/rate-limit";
import {
  validateBody,
  publicCustomerLeadSchema,
  externalCustomerLeadSchema,
  createCustomerLeadSchema,
  updateCustomerLeadSchema,
} from "../validation/customer-lead.validation";

export const customerLeadRouter = Router();

// ==================== CÁC ENDPOINT CÔNG KHAI (QUÉT MÃ QR & TÍCH HỢP NGOÀI) ====================
customerLeadRouter.get("/public/info", controller.getPublicCompanyInfo);
customerLeadRouter.post(
  "/public/submit",
  publicApiRateLimiter,
  validateBody(publicCustomerLeadSchema),
  controller.submitPublicLead,
);

// API dành riêng cho ứng dụng khác gửi thông tin khách hàng sang (SĐT, tên, ...)
customerLeadRouter.post(
  "/external",
  publicApiRateLimiter,
  validateBody(externalCustomerLeadSchema),
  controller.ingestExternalLead,
);

// Alias webhook
customerLeadRouter.post(
  "/webhook",
  publicApiRateLimiter,
  validateBody(externalCustomerLeadSchema),
  controller.ingestExternalLead,
);

// ==================== CÁC ENDPOINT NỘI BỘ (YÊU CẦU ĐĂNG NHẬP) ====================
customerLeadRouter.get("/", requireAuth as any, controller.listLeads as any);
customerLeadRouter.get("/stats", requireAuth as any, controller.getStats as any);
customerLeadRouter.post(
  "/",
  requireAuth as any,
  validateBody(createCustomerLeadSchema),
  controller.createLead as any,
);
customerLeadRouter.get("/:id", requireAuth as any, controller.getLead as any);
customerLeadRouter.patch(
  "/:id",
  requireAuth as any,
  validateBody(updateCustomerLeadSchema),
  controller.updateLead as any,
);
customerLeadRouter.delete("/:id", requireAuth as any, controller.deleteLead as any);
