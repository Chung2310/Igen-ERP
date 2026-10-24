import { getMarketingAppUrl } from "../../shared/runtime-settings";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { facebookPostService } from "../../shared/service/facebook-post.service.ts";
import { MarketingContentModel } from "../model/marketing-content.model.ts";
import { UserModel } from "../../../../model/user.model.ts";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model.ts";
import { companyModuleEnabled } from "../../shared/access";

export const schedulerService = {
  /**
   * Re-check các bài Facebook �ang �x trạng thái "processing" (video chưa encode xong sau khi n8n callback).
   * n8n workflow m�:i �ã tự �Ēng bài và check status ngay sau 20s.
   * Hàm này ch�0 cần xử lý trường hợp video vẫn chưa ready sau lần check �ó.
   */
  async checkAndPublishPosts() {
    console.log("[Scheduler Service] Bắt �ầu quét bài Facebook �ang processing...");

    try {
      const processingCards = await MarketingContentModel.find({
        status: "processing",
        channel: "Facebook",
        facebookPostId: { $exists: true, $ne: "" },
      });

      if (!processingCards || processingCards.length === 0) {
        console.log("[Scheduler Service] Không có bài Facebook nào �ang processing.");
        return { processedCount: 0, successCount: 0, failedCount: 0, details: [] };
      }

      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      const details: any[] = [];

      for (const card of processingCards) {
        if (!card.companyCode || !await companyModuleEnabled(card.companyCode, "social-marketing")) continue;
        const cardId = card._id.toString();
        processedCount++;

        try {
          let accessToken: string | undefined = undefined;
          let isMock = false;

          if (card.integrationId) {
            const fbIntegration = await SocialIntegrationModel.findOne({
              _id: card.integrationId,
              companyCode: card.companyCode,
              platform: "Facebook",
              isConnected: true,
            }).lean();
            if (!fbIntegration) {
              throw new Error("Liên kết Facebook không còn t�n tại hoặc �ã b�9 ngắt.");
            }
            accessToken = fbIntegration.accessToken;
            isMock = !!fbIntegration.isMock;
          } else {
            const user = await UserModel.findOne({ _id: card.authorUid, companyCode: card.companyCode }).lean();
            const fbInt = user?.facebookIntegration;
            if (!fbInt?.isConnected) {
              throw new Error("Tài khoản chưa liên kết Facebook Page.");
            }
            accessToken = fbInt.pageAccessToken;
            isMock = !!fbInt.isMock;
          }

          if (!accessToken) throw new Error("Không lấy �ược access token.");

          if (isMock || accessToken.includes("mock")) {
            await MarketingContentModel.findByIdAndUpdate(cardId, {
              status: "published",
              publishedAt: new Date(),
              publishError: null,
            });
            successCount++;
            details.push({ cardId, title: card.title, status: "success" });
            continue;
          }

          const checkResult = await facebookPostService.checkVideoStatus(
            card.facebookPostId!,
            accessToken,
            true
          );

          console.log(`[Scheduler Service] Re-check video ${card.facebookPostId}: ${checkResult.status}`);

          if (checkResult.status === "ready") {
            await MarketingContentModel.findByIdAndUpdate(cardId, {
              status: "published",
              publishedAt: new Date(),
              publishError: null,
            });
            successCount++;
            details.push({ cardId, title: card.title, status: "success" });
          } else if (checkResult.status === "failed") {
            throw new Error(checkResult.error || "Facebook video processing failed.");
          } else {
            // Vẫn processing � bỏ qua, lần sau quét tiếp
            details.push({ cardId, title: card.title, status: "pending" });
            processedCount--;
          }
        } catch (err: any) {
          const errMsg = err.message || String(err);
          console.error(`[Scheduler Service] L�i re-check bài ${cardId}:`, errMsg);
          await MarketingContentModel.findByIdAndUpdate(cardId, {
            status: "failed",
            publishError: errMsg,
          });
          failedCount++;
          details.push({ cardId, title: card.title, status: "failed", error: errMsg });
        }
      }

      console.log(`[Scheduler Service] Xong. T�"ng: ${processedCount}, Thành công: ${successCount}, Thất bại: ${failedCount}`);
      return { processedCount, successCount, failedCount, details };
    } catch (dbError: any) {
      console.error("[Scheduler Service] L�i DB:", dbError.message);
      throw dbError;
    }
  },

  /**
   * Gửi thông tin bài �Ēng + l�9ch hẹn sang n8n Webhook �Ồ n8n tự ��"ng quản lý ��" tr�& và tự ��"ng �Ēng bài
   */
  async sendScheduleToN8n(payload: any) {
    const webhookUrl = process.env.N8N_FB_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error(
        "Cấu hình N8N_FB_WEBHOOK_URL chưa �ược thiết lập trong biến môi trường."
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
          `n8n Webhook phản h�i l�i: ${response.status} - ${text}`
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
        message: "Gửi yêu cầu lên l�9ch bài �Ēng sang n8n thành công",
        data: responseData,
      };
    } catch (error: any) {
      console.error("[schedulerService.sendScheduleToN8n] Error:", error);
      throw new Error(`Gửi yêu cầu lên l�9ch sang n8n thất bại: ${error.message}`);
    }
  },
};
