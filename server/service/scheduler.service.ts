import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../config/firebase";
import { facebookPostService } from "./facebook-post.service";

export const schedulerService = {
  /**
   * Quét Firestore tìm các bài đăng đã lên lịch (scheduled) và đến hạn để tự động đăng
   */
  async checkAndPublishPosts() {
    console.log("[Scheduler Service] Bắt đầu quét các bài viết lên lịch...");
    
    // Đảm bảo đã xác thực với vai trò Super Admin để bypass Firestore Security Rules
    try {
      if (!auth.currentUser) {
        const email = process.env.VITE_SUPERADMIN_EMAIL || "superadmin@igen.com";
        const password = process.env.VITE_SUPERADMIN_PASSWORD || "superadmin123";
        await signInWithEmailAndPassword(auth, email, password);
        console.log("[Scheduler Service] Đăng nhập Super Admin thành công.");
      }
    } catch (authError: any) {
      console.error("[Scheduler Service] Lỗi xác thực Super Admin:", authError.message);
      throw new Error(`Xác thực tài khoản hệ thống thất bại: ${authError.message}`);
    }

    const now = new Date();
    
    // Chuyển đổi sang múi giờ Việt Nam (UTC+7)
    const tzOffset = 7 * 60; // UTC+7 tính bằng phút
    const vnTime = new Date(now.getTime() + tzOffset * 60 * 1000);
    const currentDateStr = vnTime.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentTimeStr = vnTime.toISOString().slice(11, 16); // HH:MM

    console.log(`[Scheduler Service] Thời gian hiện tại (VN): ${currentDateStr} ${currentTimeStr}`);

    const marketingContentsRef = collection(db, "marketingContents");
    const q = query(marketingContentsRef, where("status", "==", "scheduled"));
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
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

    for (const docSnap of snapshot.docs) {
      const card = docSnap.data();
      const cardId = docSnap.id;
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

          // Đọc thông tin kết nối từ hồ sơ người dùng
          const userDocSnap = await getDoc(doc(db, "users", authorUid));
          if (!userDocSnap.exists()) {
            throw new Error(`Không tìm thấy hồ sơ người dùng với UID: ${authorUid}`);
          }

          const userProfile = userDocSnap.data();
          const channel = card.channel || "Facebook";

          if (channel === "Facebook") {
            const facebookIntegration = userProfile?.facebookIntegration;
            if (!facebookIntegration || !facebookIntegration.isConnected) {
              throw new Error("Tài khoản chưa liên kết Facebook Page.");
            }

            const { pageId, accessToken } = facebookIntegration;
            if (!pageId || !accessToken) {
              throw new Error("Thông tin liên kết Facebook Page không đầy đủ (thiếu pageId hoặc accessToken).");
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

            // Cập nhật trạng thái thành công trong Firestore
            const facebookPostId = publishResult.data?.id || `fb_post_${Date.now()}`;
            await updateDoc(doc(db, "marketingContents", cardId), {
              status: "published",
              publishedAt: new Date().toISOString(),
              facebookPostId,
              publishError: null,
            });

            console.log(`[Scheduler Service] Đăng bài Facebook thành công cho Card: ${cardId}`);
            successCount++;
            details.push({ cardId, title: card.title, channel, status: "success" });

          } else if (channel === "TikTok") {
            const tiktokIntegration = userProfile?.tiktokIntegration;
            if (!tiktokIntegration || !tiktokIntegration.isConnected) {
              throw new Error("Tài khoản chưa liên kết TikTok.");
            }

            console.log(`[Scheduler Service] Tự động mock đăng bài TikTok cho Card: ${cardId}...`);

            // Mock TikTok publish
            const mockPostId = `tiktok_mock_scheduled_${Date.now()}`;
            const mockShareUrl = `https://www.tiktok.com/@demo/video/${mockPostId}`;

            await updateDoc(doc(db, "marketingContents", cardId), {
              status: "published",
              publishedAt: new Date().toISOString(),
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

          // Cập nhật trạng thái lỗi vào Firestore để user theo dõi
          await updateDoc(doc(db, "marketingContents", cardId), {
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
      const response = await (globalThis as any).fetch(webhookUrl, {
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
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const textData = await response.text();
        responseData = { message: textData };
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
