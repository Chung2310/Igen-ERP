import { Request, Response, NextFunction } from "express";
import { WebhookService } from "../services/webhook.service";
import { logger } from "../config/logger";

export class WebhookController {
  static async handlePaymentWebhook(req: Request, res: Response, _next: NextFunction) {
    try {
      logger.info("[WebhookController] Received payment webhook request.");

      // 1. Xác thực WEBHOOK_SECRET
      const authHeader = req.headers.authorization;
      const secret =
        req.headers["x-webhook-secret"] ||
        req.query.secret ||
        (authHeader && /^(Bearer|Apikey)\s+/i.test(authHeader)
          ? authHeader.split(" ").slice(1).join(" ")
          : authHeader);

      const expectedSecret = process.env.WEBHOOK_SECRET;
      
      if (!expectedSecret) {
        logger.error("[WebhookController] WEBHOOK_SECRET is not configured on server.");
        return res.status(500).json({
          success: false,
          error: "Cấu hình hệ thống lỗi: Chưa thiết lập WEBHOOK_SECRET trên máy chủ.",
        });
      }

      if (secret !== expectedSecret) {
        logger.warn(`[WebhookController] Unauthorized attempt. Received secret: "${secret}"`);
        return res.status(401).json({
          success: false,
          error: "Xác thực webhook thất bại. Token bí mật không hợp lệ.",
        });
      }

      const payload = req.body;
      const results: { success: boolean; message: string; studentName?: string; amount?: number; [key: string]: unknown }[] = [];

      // 2. Kiểm tra cấu trúc payload: Casso (chứa array data) hay SePay (chứa flat object)
      if (payload && Array.isArray(payload.data)) {
        logger.info(`[WebhookController] Casso format detected. Processing ${payload.data.length} items.`);
        for (const transaction of payload.data) {
          const result = await WebhookService.processIncomingTransaction(transaction);
          results.push(result);
        }
      } else {
        logger.info("[WebhookController] SePay or flat format detected. Processing single item.");
        const result = await WebhookService.processIncomingTransaction(payload);
        results.push(result);
      }

      // Check if all processed successfully
      const hasFailure = results.some((r) => !r.success);
      if (hasFailure && results.length === 1) {
        return res.status(400).json({
          success: false,
          error: results[0].message,
        });
      }

      res.status(200).json({
        success: true,
        message: "Xử lý webhook thanh toán thành công.",
        results,
      });
    } catch (error: unknown) {
      logger.error(`[WebhookController] Error processing webhook: ${error instanceof Error ? error.message : error}`);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Đã xảy ra lỗi máy chủ khi xử lý giao dịch.",
      });
    }
  }
}
