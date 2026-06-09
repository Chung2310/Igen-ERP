export const tiktokService = {
  /**
   * Giả lập đăng bài lên TikTok (MOCK) do chưa tích hợp TikTok Developer App thật.
   */
  async publishVideo(
    cardId: string,
    caption: string,
    videoUrl: string,
    privacyLevel: string = "SELF_ONLY"
  ) {
    // Giả lập độ trễ mạng 1.5 giây giống như Cloud Function cũ
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log(
      `[TikTok Service MOCK] Đang đăng video cho card ${cardId}. Video URL: ${videoUrl}, Privacy: ${privacyLevel}`
    );

    const mockPostId = `tiktok_mock_${Date.now()}`;
    const shareUrl = `https://www.tiktok.com/@demo/video/${mockPostId}`;

    return {
      status: "success",
      message: "Đăng video lên TikTok thành công (MOCK)",
      data: {
        postId: mockPostId,
        shareUrl,
        success: true,
      },
    };
  },

  /**
   * Gửi yêu cầu xác thực token kết nối TikTok sang n8n Webhook
   */
  async validateToken(username: string, accessToken: string) {
    const webhookUrl = process.env.N8N_TT_VALIDATE_URL;
    if (!webhookUrl) {
      throw new Error(
        "Cấu hình N8N_TT_VALIDATE_URL chưa được thiết lập trong biến môi trường."
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
          username,
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
        message: "Xác thực token kết nối TikTok qua n8n thành công",
        valid: true,
        displayName: resultData.displayName || "TikTok User",
        avatarUrl: resultData.avatarUrl || "",
      };
    } catch (error: any) {
      console.error("[tiktokService.validateToken] Error:", error);
      throw new Error(`Xác thực token liên kết qua n8n thất bại: ${error.message}`);
    }
  },
};
