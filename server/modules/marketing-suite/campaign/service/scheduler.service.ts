import { getMarketingAppUrl } from "../../shared/runtime-settings";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { facebookPostService } from "../../shared/service/facebook-post.service.ts";
import { MarketingContentModel } from "../model/marketing-content.model.ts";
import { UserModel } from "../../../../model/user.model.ts";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model.ts";
import { companyModuleEnabled } from "../../shared/access";
import { recordFacebookPublication } from "./facebook-publication.service";

export const schedulerService = {
  /** Reconcile Facebook videos that were still processing after the n8n callback. */
  async checkAndPublishPosts() {
    console.log("[Scheduler Service] Bắt đầu quét bài Facebook đang processing...");
    try {
      const processingCards = await MarketingContentModel.find({
        status: "processing", channel: "Facebook",
        facebookPostId: { $exists: true, $ne: "" },
      });
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      const details: any[] = [];
      for (const card of processingCards || []) {
        if (!card.companyCode || !await companyModuleEnabled(card.companyCode, "social-marketing")) continue;
        const cardId = card._id.toString();
        processedCount++;
        try {
          let accessToken: string | undefined;
          let isMock = false;
          if (card.integrationId) {
            const integration = await SocialIntegrationModel.findOne({
              _id: card.integrationId, companyCode: card.companyCode,
              platform: "Facebook", isConnected: true,
            }).lean();
            if (!integration) throw new Error("Liên kết Facebook không còn tồn tại hoặc đã bị ngắt.");
            accessToken = integration.accessToken;
            isMock = !!integration.isMock;
          } else {
            const user = await UserModel.findOne({ _id: card.authorUid, companyCode: card.companyCode }).lean();
            if (!user?.facebookIntegration?.isConnected) throw new Error("Tài khoản chưa liên kết Facebook Page.");
            accessToken = user.facebookIntegration.pageAccessToken;
            isMock = !!user.facebookIntegration.isMock;
          }
          if (!accessToken) throw new Error("Không lấy được access token.");
          const result: { status: string; error?: string } = isMock || accessToken.includes("mock")
            ? { status: "ready" }
            : await facebookPostService.checkVideoStatus(card.facebookPostId!, accessToken, true);
          if (result.status === "failed") throw new Error(result.error || "Facebook video processing failed.");
          if (result.status !== "ready") {
            details.push({ cardId, title: card.title, status: "pending" });
            processedCount--;
            continue;
          }
          const publication = await recordFacebookPublication(cardId, {
            status: "published", postId: card.facebookPostId,
          }, card.companyCode);
          if (!publication) { processedCount--; continue; }
          successCount++;
          details.push({ cardId, title: card.title, status: "success" });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Scheduler Service] Lỗi re-check bài ${cardId}:`, errorMessage);
          // A successful callback can arrive while the provider check is in flight.
          // The shared recorder preserves publication and reconciles slot/statistics.
          const publication = await recordFacebookPublication(cardId, {
            status: "failed", error: errorMessage,
          }, card.companyCode);
          if (!publication) { processedCount--; continue; }
          if (publication.status === "published") {
            successCount++;
            details.push({ cardId, title: card.title, status: "success" });
          } else {
            failedCount++;
            details.push({ cardId, title: card.title, status: "failed", error: errorMessage });
          }
        }
      }
      console.log(`[Scheduler Service] Xong. Tổng: ${processedCount}, Thành công: ${successCount}, Thất bại: ${failedCount}`);
      return { processedCount, successCount, failedCount, details };
    } catch (error: unknown) {
      console.error("[Scheduler Service] Lỗi DB:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  /** Send the post and its schedule to n8n. */
  async sendScheduleToN8n(payload: any) {
    const webhookUrl = process.env.N8N_FB_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error(
        "Cấu hình N8N_FB_WEBHOOK_URL chưa được thiết lập trong biến môi trường."
      );
    }

    const secretToken = process.env.N8N_WEBHOOK_SECRET;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (secretToken) {
      headers["X-Webhook-Token"] = secretToken;
    }

    let n8nPayload = payload;

    if (payload.channel === "Facebook" && payload.integration) {
      let scheduledTimeISO = "";
      if (payload.scheduledDate && payload.scheduledTime) {
        scheduledTimeISO = `${payload.scheduledDate}T${payload.scheduledTime}:00+07:00`;
      }

      let mediaType: "none" | "image" | "video" = "none";
      let mediaUrl = "";
      if (payload.videoUrl) {
        mediaType = "video";
        mediaUrl = payload.videoUrl;
      } else if (payload.imageUrl) {
        mediaType = "image";
        mediaUrl = payload.imageUrl;
      } else if (payload.mediaUrls?.length) {
        mediaType = "image";
        mediaUrl = payload.mediaUrls[0];
      }

      const appUrl = getMarketingAppUrl();
      const callbackUrl = `${appUrl.replace(/\/$/, "")}/api/v1/facebook/n8n-callback`;

      n8nPayload = {
        cardId: payload.cardId,
        platform: "facebook",
        publishType: "scheduled",
        scheduledTime: scheduledTimeISO,
        title: payload.title || "",
        content: payload.bodyText || "",
        mediaType,
        mediaUrl,
        mediaUrls: payload.videoUrl ? [] : payload.mediaUrls || (payload.imageUrl ? [payload.imageUrl] : []),
        pageId: payload.integration.pageId,
        accessToken: payload.integration.pageAccessToken,
        callbackUrl,
      };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(n8nPayload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `n8n Webhook phản hồi lỗi: ${response.status} - ${text}`
        );
      }

      let responseData: any = {};
      const textData = await response.text();
      if (textData.trim()) {
        const contentType = response.headers.get("content-type") || "";
        const firstCharacter = textData.trimStart()[0];
        if (contentType.includes("application/json") || firstCharacter === "{" || firstCharacter === "[") {
          try {
            responseData = JSON.parse(textData);
          } catch {
            throw new Error("n8n trả về JSON không hợp lệ; chưa thể xác nhận lịch đăng.");
          }
        } else {
          responseData = { message: textData };
        }
      }

      const envelopes: unknown[] = [responseData];
      for (let checked = 0; envelopes.length; checked++) {
        if (checked >= 20) throw new Error("Phản hồi n8n quá phức tạp; chưa thể xác nhận lịch đăng.");
        const envelope = envelopes.shift();
        if (Array.isArray(envelope)) {
          if (envelope.length > 20) throw new Error("Phản hồi n8n vượt giới hạn; chưa thể xác nhận lịch đăng.");
          envelopes.push(...envelope); continue;
        }
        if (!envelope || typeof envelope !== "object") continue;
        const data = envelope as Record<string, unknown>;
        if (data.success === false || ["failed", "failure", "error", "rejected"].includes(String(data.status || "").toLowerCase()) || data.error) {
          throw new Error("n8n từ chối yêu cầu lên lịch. Vui lòng kiểm tra workflow trước khi thử lại.");
        }
        if (data.data) envelopes.push(data.data);
      }

      return {
        status: "success",
        message: "Gửi yêu cầu lên lịch bài đăng sang n8n thành công",
        data: responseData,
      };
    } catch (error: any) {
      console.error("[schedulerService.sendScheduleToN8n] Error:", error);
      throw new Error(`Gửi yêu cầu lên lịch sang n8n thất bại: ${error.message}`);
    }
  },
};
