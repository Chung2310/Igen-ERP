import { facebookPostService } from "./facebook-post.service";
import { MarketingContentModel } from "../model/marketing-content.model";
import { UserModel } from "../model/user.model";
import { tiktokService } from "./tiktok.service";
import { SocialIntegrationModel } from "../model/social-integration.model";

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
              let pageId: string | undefined = undefined;
              let accessToken: string | undefined = undefined;
              let isMock = false;

              if (card.integrationId) {
                const fbIntegration = await SocialIntegrationModel.findOne({
                  _id: card.integrationId,
                  platform: "Facebook",
                  isConnected: true,
                }).lean();
                if (!fbIntegration) {
                  throw new Error("Không tìm thấy liên kết Facebook chỉ định hoặc liên kết đã bị ngắt.");
                }
                pageId = fbIntegration.username; // Lưu Page ID ở trường username
                accessToken = fbIntegration.accessToken;
                isMock = !!fbIntegration.isMock;
              } else {
                const facebookIntegration = user.facebookIntegration;
                if (!facebookIntegration || !facebookIntegration.isConnected) {
                  throw new Error("Tài khoản chưa liên kết Facebook Page.");
                }
                pageId = facebookIntegration.pageId;
                accessToken = facebookIntegration.pageAccessToken;
                isMock = !!facebookIntegration.isMock;
              }

              if (!pageId || !accessToken) {
                throw new Error("Thông tin liên kết Facebook Page không đầy đủ.");
              }

              // CHECK NẾU BÀI VIẾT ĐÃ CÓ facebookPostId (Đã được lên lịch từ trước trên Facebook qua n8n)
              if (card.facebookPostId && !isMock && !card.facebookPostId.startsWith("fb_post_") && accessToken !== "mock" && !accessToken.includes("mock")) {
                console.log(`[Scheduler Service] Bài viết đã được lên lịch trực tiếp trên Facebook (ID: ${card.facebookPostId}). Tiến hành kiểm tra trạng thái...`);
                
                const checkResult = await facebookPostService.checkVideoStatus(card.facebookPostId, accessToken, !!card.videoUrl);
                console.log(`[Scheduler Service] Facebook Post check: status = ${checkResult.status}`);
                
                if (checkResult.status === "ready") {
                  await MarketingContentModel.findByIdAndUpdate(cardId, {
                    status: "published",
                    publishedAt: new Date(),
                    publishError: null,
                  });
                  console.log(`[Scheduler Service] Bài đăng Facebook đã active thành công: ${cardId}`);
                  successCount++;
                  details.push({ cardId, title: card.title, channel, status: "success" });
                } else if (checkResult.status === "failed") {
                  throw new Error(`Bài đăng Facebook thất bại: ${checkResult.error || "Không rõ lý do"}`);
                } else {
                  // Đang xử lý hoặc chưa tới giờ đăng thật trên Facebook, bỏ qua lượt này để lần sau quét tiếp
                  console.log(`[Scheduler Service] Bài đăng Facebook (ID: ${card.facebookPostId}) vẫn đang được Facebook xử lý hoặc chưa được publish.`);
                  processedCount--; // Không tính là đã xử lý xong/thành công/thất bại để giữ trạng thái scheduled
                  details.push({ cardId, title: card.title, channel, status: "pending" });
                }
              } else {
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

                // NẾU BÀI VIẾT CÓ VIDEO VÀ KHÔNG PHẢI MOCK -> POLL CHECK TRẠNG THÁI VIDEO TRÊN FACEBOOK
                if (card.videoUrl && !isMock && !facebookPostId.startsWith("fb_post_") && accessToken !== "mock" && !accessToken.includes("mock")) {
                  console.log(`[Scheduler Service] Bài viết Facebook chứa video. Bắt đầu check trạng thái video từ Facebook Graph API...`);
                  let isReady = false;
                  const MAX_POLLS = 10;
                  const POLL_INTERVAL_MS = 3000;
                  let checkError = "";

                  for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
                    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
                    try {
                      const checkResult = await facebookPostService.checkVideoStatus(facebookPostId, accessToken, true);
                      console.log(`[Scheduler Service] Facebook Video check #${attempt}: status = ${checkResult.status}`);
                      if (checkResult.status === "ready") {
                        isReady = true;
                        break;
                      } else if (checkResult.status === "failed") {
                        checkError = checkResult.error || "Video processing failed on Facebook.";
                        throw new Error(`Facebook video processing failed: ${checkError}`);
                      }
                    } catch (pollErr: any) {
                      console.warn(`[Scheduler Service] Poll Facebook Video #${attempt} gặp lỗi:`, pollErr.message);
                      if (attempt === MAX_POLLS) {
                        throw pollErr;
                      }
                    }
                  }

                  if (!isReady) {
                    throw new Error("Quá thời gian chờ xử lý video trên Facebook.");
                  }
                }

                await MarketingContentModel.findByIdAndUpdate(cardId, {
                  status: "published",
                  publishedAt: new Date(),
                  facebookPostId,
                  publishError: null,
                });

                console.log(`[Scheduler Service] Đăng bài Facebook thành công cho Card: ${cardId}`);
                successCount++;
                details.push({ cardId, title: card.title, channel, status: "success" });
              }

            } else if (channel === "TikTok") {
              console.log(`[Scheduler Service] Tự động đăng bài TikTok cho Card: ${cardId}...`);

              let integrationId: string | undefined = undefined;
              let accessToken: string | undefined = undefined;
              let username: string | undefined = undefined;

              if (card.integrationId) {
                integrationId = card.integrationId.toString();
              } else {
                // 1. Tìm tài khoản liên kết cấp công ty trước
                const companyIntegration = await SocialIntegrationModel.findOne({
                  companyCode: card.companyCode,
                  platform: "TikTok",
                  isConnected: true,
                }).lean();

                if (companyIntegration) {
                  integrationId = companyIntegration._id.toString();
                } else {
                  // 2. Fallback: Tài khoản liên kết cá nhân của User
                  const tiktokIntegration = user.tiktokIntegration;
                  if (!tiktokIntegration || !tiktokIntegration.isConnected) {
                    throw new Error("Tài khoản chưa liên kết TikTok (cả cấp Công ty lẫn cấp Cá nhân).");
                  }
                  accessToken = tiktokIntegration.accessToken;
                  username = tiktokIntegration.username;
                }
              }

              // Gọi service đăng bài thật
              const publishResult = await tiktokService.publishVideo(
                cardId,
                card.bodyText || "",
                card.videoUrl || "",
                "SELF_ONLY",
                accessToken,
                username,
                undefined, // Không gửi scheduledTime vì cần đăng ngay khi scheduler trigger
                integrationId,
                card.companyCode
              );

              const tiktokPostId = publishResult.data?.postId || publishResult.data?.publishId || `tiktok_post_${Date.now()}`;
              const tiktokShareUrl = publishResult.data?.shareUrl || "";

              await MarketingContentModel.findByIdAndUpdate(cardId, {
                status: "published",
                publishedAt: new Date(),
                tiktokPostId,
                tiktokShareUrl,
                publishError: null,
              });

              console.log(`[Scheduler Service] Đăng bài TikTok thành công cho Card: ${cardId}`);
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
