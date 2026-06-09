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
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const textData = await response.text();
        responseData = { message: textData };
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
   */
  async validateToken(pageId: string, accessToken: string) {
    const webhookUrl = process.env.N8N_FB_VALIDATE_URL;
    if (!webhookUrl) {
      throw new Error(
        "Cấu hình N8N_FB_VALIDATE_URL chưa được thiết lập trong biến môi trường."
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
};
