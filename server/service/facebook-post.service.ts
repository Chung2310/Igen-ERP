export const facebookPostService = {
  /**
   * Gửi thông tin bài đăng sang n8n Webhook để tự động đăng lên Facebook Page
   */
  async publishToPage(
    content: string,
    imageUrl: string,
    videoUrl: string,
    pageId: string,
    accessToken: string
  ) {
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

    try {
      const response = await (globalThis as any).fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content,
          imageUrl,
          videoUrl,
          pageId,
          accessToken,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `n8n Webhook phản hồi lỗi: ${response.status} - ${text}`
        );
      }

      // n8n Webhook có thể trả về JSON hoặc text thuần tuý
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
        message: "Gửi yêu cầu đăng bài lên Facebook qua n8n thành công",
        data: responseData,
      };
    } catch (error: any) {
      console.error("[facebookPostService.publishToPage] Error:", error);
      throw new Error(`Gửi yêu cầu đăng bài sang n8n thất bại: ${error.message}`);
    }
  },

  /**
   * Gửi yêu cầu xác thực token kết nối Facebook Page sang n8n Webhook
   * Hỗ trợ xác thực trực tiếp qua Facebook Graph API trước khi fallback qua n8n.
   */
  async validateToken(pageId: string, accessToken: string) {
    // 1. Thử xác thực trực tiếp bằng cách gọi Facebook Graph API
    try {
      console.log(`[Facebook Service] Đang xác thực trực tiếp Page ID ${pageId} qua Graph API...`);
      const url = `https://graph.facebook.com/v19.0/${pageId}?fields=name&access_token=${accessToken}`;
      const response = await (globalThis as any).fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Facebook Service] Xác thực Graph API thành công! Page Name: ${data.name}`);
        return {
          status: "success",
          message: "Xác thực token kết nối Facebook Page trực tiếp thành công",
          valid: true,
          pageName: data.name || "Facebook Page",
        };
      } else {
        const errText = await response.text();
        console.warn(`[Facebook Service] Graph API trả về lỗi: ${response.status} - ${errText}`);
      }
    } catch (err: any) {
      console.warn("[Facebook Service] Lỗi kết nối trực tiếp tới Facebook Graph API:", err.message);
    }

    // 2. Fallback sang xác thực qua n8n (nếu có cấu hình)
    const webhookUrl = process.env.N8N_FB_VALIDATE_URL;
    if (!webhookUrl) {
      throw new Error(
        "Mã Token hoặc Page ID không đúng. Không thể xác thực trực tiếp và N8N_FB_VALIDATE_URL chưa được thiết lập."
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
        body: JSON.stringify({
          pageId,
          accessToken,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `n8n Webhook phản hồi lỗi: ${response.status} - ${text}`
        );
      }

      const data = await response.json();
      const resultData = data.data ?? data;

      if (!resultData.valid) {
        throw new Error(resultData.message || "Token không hợp lệ.");
      }

      return {
        status: "success",
        message: "Xác thực token kết nối Facebook Page qua n8n thành công",
        valid: true,
        pageName: resultData.pageName || "Facebook Page",
      };
    } catch (error: any) {
      console.error("[facebookPostService.validateToken] Error:", error);
      throw new Error(`Xác thực token liên kết qua n8n thất bại: ${error.message}`);
    }
  },

  /**
   * Kiểm tra trạng thái video/bài viết trên Facebook Graph API
   */
  async checkVideoStatus(
    videoId: string,
    accessToken: string,
    isVideo: boolean = false
  ): Promise<{ status: "ready" | "processing" | "failed"; error?: string }> {
    try {
      const fields = isVideo ? "status,is_published" : "is_published";
      const url = `https://graph.facebook.com/v19.0/${videoId}?fields=${fields}&access_token=${accessToken}`;
      const response = await (globalThis as any).fetch(url);
      
      if (!response.ok) {
        const errText = await response.text();
        return { status: "failed", error: `Facebook Graph API error: ${response.status} - ${errText}` };
      }

      const data = await response.json();
      console.log(`[Facebook Service] Trạng thái post/video ${videoId}:`, data);

      if (isVideo && data.status) {
        const videoStatus = data.status.video_status;
        if (videoStatus === "ready") {
          return { status: "ready" };
        } else if (videoStatus === "processing") {
          return { status: "processing" };
        } else {
          return { status: "failed", error: `Video processing failed: ${videoStatus}` };
        }
      }

      if (data.is_published !== false) {
        return { status: "ready" };
      }

      return { status: "processing" };
    } catch (err: any) {
      console.error(`[Facebook Service] Lỗi khi check trạng thái video ${videoId}:`, err);
      return { status: "failed", error: err.message };
    }
  },
};

