import { facebookPostService } from "./facebook-post.service";
import { MarketingContentModel } from "../model/marketing-content.model";
import { UserModel } from "../model/user.model";

export const schedulerService = {
  /**
   * Quét MongoDB tìm các bài đăng đã lên lịch (scheduled) và đến hạn để tự động đăng
   */
  async checkAndPublishPosts() {
    console.log("[Scheduler Service] Bắt đầu quét các bài viết lên lịch...");

    const now = new Date();
    
    // Chuyển đổi sang múi giờ Việt Nam (UTC+7)
    const tzOffset = 7 * 60; // UTC+7 tính bằng phút
    const vnTime = new Date(now.getTime() + tzOffset * 60 * 1000);
    const currentDateStr = vnTime.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentTimeStr = vnTime.toISOString().slice(11, 16); // HH:MM

    console.log(`[Scheduler Service] Thời gian hiện tại (VN): ${currentDateStr} ${currentTimeStr}`);

    try {
      const scheduledContents = await MarketingContentModel.find({ status: "scheduled" });

      if (!scheduledContents || scheduledContents.length === 0) {
        console.log("[Scheduler Service] Không tìm thấy bài viết nào có trạng thái 'scheduled'.");
        return {
          processedCount: 0,
          successCount: 0,
          failedCount: 0,
          details: [],
        };
      }

      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      const details: any[] = [];

      for (const card of scheduledContents) {
        const cardId = card._id.toString();
        const scheduledDate = card.scheduledDate;
        const scheduledTime = card.scheduledTime || "00:00";

        if (!scheduledDate) continue;

        // Kiểm tra xem bài viết đã đến hạn hay chưa
        const isDue =
          scheduledDate < currentDateStr ||
          (scheduledDate === currentDateStr && scheduledTime <= currentTimeStr);

        if (isDue) {
          processedCount++;
          console.log(`[Scheduler Service] Bài viết "${card.title}" (ID: ${cardId}) đã đến hạn đăng!`);
          
          try {
            const authorUid = card.authorUid;
            if (!authorUid) {
              throw new Error("Không có authorUid.");
            }

            // Đọc thông tin kết nối từ hồ sơ người dùng trong MongoDB
            const user = await UserModel.findById(authorUid);
            if (!user) {
              throw new Error(`Không tìm thấy hồ sơ người dùng với ID: ${authorUid}`);
            }

            const channel = card.channel || "Facebook";

            if (channel === "Facebook") {
              const facebookIntegration = user.facebookIntegration;
              if (!facebookIntegration || !facebookIntegration.isConnected) {
                throw new Error("Tài khoản chưa liên kết Facebook Page.");
              }

              const { pageId, pageAccessToken: accessToken } = facebookIntegration;
              if (!pageId || !accessToken) {
                throw new Error("Thông tin liên kết Facebook Page không đầy đủ (thiếu pageId hoặc pageAccessToken).");
              }

              console.log(`[Scheduler Service] Tự động đăng bài Facebook cho Card: ${cardId} qua n8n...`);
              
              // Gọi service gửi qua n8n webhook
              const publishResult = await facebookPostService.publishToPage(
                card.bodyText || "",
                card.imageUrl || "",
                card.videoUrl || "",
                pageId,
                accessToken
              );

              // Cập nhật trạng thái thành công trong MongoDB
              const facebookPostId = publishResult.data?.id || `fb_post_${Date.now()}`;
              await MarketingContentModel.findByIdAndUpdate(cardId, {
                status: "published",
                publishedAt: new Date(),
                facebookPostId,
                publishError: null,
              });

              console.log(`[Scheduler Service] Đăng bài Facebook thành công cho Card: ${cardId}`);
              successCount++;
              details.push({ cardId, title: card.title, channel, status: "success" });

            } else if (channel === "TikTok") {
              const tiktokIntegration = user.tiktokIntegration;
              if (!tiktokIntegration || !tiktokIntegration.isConnected) {
                throw new Error("Tài khoản chưa liên kết TikTok.");
              }

              console.log(`[Scheduler Service] Tự động mock đăng bài TikTok cho Card: ${cardId}...`);

              // Mock TikTok publish
              const mockPostId = `tiktok_mock_scheduled_${Date.now()}`;
              const mockShareUrl = `https://www.tiktok.com/@demo/video/${mockPostId}`;

              await MarketingContentModel.findByIdAndUpdate(cardId, {
                status: "published",
                publishedAt: new Date(),
                tiktokPostId: mockPostId,
                tiktokShareUrl: mockShareUrl,
                publishError: null,
              });

              console.log(`[Scheduler Service] Mock đăng bài TikTok thành công cho Card: ${cardId}`);
              successCount++;
              details.push({ cardId, title: card.title, channel, status: "success" });

            } else {
              throw new Error(`Kênh đăng tải "${channel}" chưa được hỗ trợ đăng tự động.`);
            }
          } catch (err: any) {
            const errMsg = err.message || String(err);
            console.error(`[Scheduler Service] Lỗi xử lý bài đăng ${cardId}:`, errMsg);

            // Cập nhật trạng thái lỗi vào MongoDB để user theo dõi
            await MarketingContentModel.findByIdAndUpdate(cardId, {
              status: "failed",
              publishError: errMsg,
            });

            failedCount++;
            details.push({ cardId, title: card.title, channel: card.channel, status: "failed", error: errMsg });
          }
        }
      }

      console.log(
        `[Scheduler Service] Quét xong. Tổng: ${processedCount}, Thành công: ${successCount}, Thất bại: ${failedCount}`
      );

      return {
        processedCount,
        successCount,
        failedCount,
        details,
      };
    } catch (dbError: any) {
      console.error("[Scheduler Service] Lỗi truy vấn cơ sở dữ liệu MongoDB:", dbError.message);
      throw dbError;
    }
  },

  /**
   * Gửi thông tin bài đăng + lịch hẹn sang n8n Webhook để n8n tự động quản lý độ trễ và tự động đăng bài
   */
  async sendScheduleToN8n(payload: any) {
    const webhookUrl = process.env.N8N_SCHEDULE_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error(
        "Cấu hình N8N_SCHEDULE_WEBHOOK_URL chưa được thiết lập trong biến môi trường."
      );
    }

    const secretToken = process.env.N8N_WEBHOOK_SECRET;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (secretToken) {
      headers["X-Webhook-Token"] = secretToken;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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
        if (contentType.includes("application/json")) {
          try {
            responseData = JSON.parse(textData);
          } catch (err) {
            responseData = { message: textData };
          }
        } else {
          responseData = { message: textData };
        }
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
