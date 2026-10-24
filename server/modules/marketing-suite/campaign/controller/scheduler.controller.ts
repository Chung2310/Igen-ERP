/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { schedulerService } from "../service/scheduler.service.ts";
import type { AuthenticatedRequest } from "../../shared/middleware/auth";
import { MarketingContentModel } from "../model/marketing-content.model";
import { scheduleCampaignFacebookContent } from "../service/campaign-content-schedule";

export const schedulerController = {
  /**
   * POST /api/v1/scheduler/check-and-publish
   * API Endpoint được trigger từ n8n Scheduler để quét và tự động đăng bài viết đến hạn
   */
  async checkAndPublish(req: Request, res: Response) {
    try {
      // Xác thực token gửi từ n8n webhook nếu được cấu hình trong biến môi trường
      const secretToken = process.env.N8N_WEBHOOK_SECRET;
      const requestToken = req.headers["x-webhook-token"];

      if (secretToken && requestToken !== secretToken) {
        return res.status(401).json({
          status: "error",
          message: "Không có quyền truy cập endpoint này (Token xác thực không chính xác).",
        });
      }

      const result = await schedulerService.checkAndPublishPosts();
      
      return res.status(200).json({
        status: "success",
        message: "Thực thi tác vụ kiểm tra bài đăng định kỳ thành công",
        data: result,
      });
    } catch (error: any) {
      console.error("[schedulerController.checkAndPublish] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Gặp lỗi khi xử lý tác vụ Scheduler kiểm tra đăng bài viết",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/scheduler/schedule-post
   * Nhận yêu cầu lên lịch bài đăng từ frontend và gửi sang n8n
   */
  async schedulePost(req: Request, res: Response) {
    try {
      const actor = (req as AuthenticatedRequest).user;
      if (!actor?.companyCode) return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp." });
      const card = await MarketingContentModel.findOne({ _id: req.body.cardId, companyCode: actor.companyCode }).lean();
      if (!card) return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập bài đăng này." });
      if (card.campaignId || card.campaignSlotId) {
        const data = await scheduleCampaignFacebookContent({
          companyCode: actor.companyCode, contentId: String(card._id), approvedBy: actor.id,
          scheduledDate: req.body.scheduledDate, scheduledTime: req.body.scheduledTime,
          integrationId: req.body.integrationId || undefined,
        });
        return res.status(200).json({ status: "success", message: "Đã cập nhật lịch đăng của Campaign.", data });
      }
      if (["published", "processing"].includes(card.status)) {
        return res.status(409).json({ status: "error", message: "Bài đã được gửi đăng. Hãy kiểm tra kết quả trước khi lên lịch lại." });
      }
      const result = await schedulerService.sendScheduleToN8n(req.body);
      if (result?.status === "success") {
        const schedule = {
          scheduledDate: req.body.scheduledDate,
          scheduledTime: req.body.scheduledTime,
          integrationId: req.body.integrationId || null,
        };
        const postId = result.data?.id || result.data?.data?.id;
        // A callback may finish before n8n returns. Only change the status if
        // the original card version is still current; never regress its result.
        const committed = await MarketingContentModel.updateOne(
          { _id: card._id, companyCode: actor.companyCode, status: card.status, updatedAt: card.updatedAt },
          { $set: { ...schedule, status: "scheduled", ...(postId ? { facebookPostId: postId } : {}) }, $unset: { publishError: 1 } },
        );
        if (!committed.matchedCount) {
          await MarketingContentModel.updateOne(
            { _id: card._id, companyCode: actor.companyCode },
            { $set: schedule },
          );
        }
      }
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[schedulerController.schedulePost] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý gửi yêu cầu lên lịch sang n8n",
        details: error.message,
      });
    }
  },
};
