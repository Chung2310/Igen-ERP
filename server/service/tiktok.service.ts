import { broadcastEvent } from "../socket";
import { MarketingContentModel } from "../model/marketing-content.model";
import { SocialIntegrationModel } from "../model/social-integration.model";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";
const BLOTATO_API_BASE = "https://backend.blotato.com";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Gọi Blotato API (giải pháp tạm thời khi TikTok app chưa được audit)
// Blotato đã được TikTok approve → không cần app audit riêng.
// Docs: https://help.blotato.com/api/start
// ─────────────────────────────────────────────────────────────────────────────
const callBlotatoPublish = async (
  caption: string,
  videoUrl: string,
  accountId: string,
  scheduledTime?: string,
  blotatoApiKeyInput?: string
): Promise<{ postSubmissionId: string }> => {
  const blotatoApiKey = blotatoApiKeyInput || process.env.BLOTATO_API_KEY;
  if (!blotatoApiKey) {
    throw new Error(
      "BLOTATO_API_KEY chưa được thiết lập. " +
      "Vui lòng cấu hình biến môi trường hoặc cung cấp qua API request."
    );
  }
  if (!accountId) {
    throw new Error(
      "accountId không được để trống khi đăng video qua Blotato."
    );
  }

  const payload: Record<string, any> = {
    post: {
      accountId,
      content: {
        text: caption || "",
        mediaUrls: [videoUrl],
        platform: "tiktok",
      },
      target: {
        targetType: "tiktok",
      },
    },
  };

  // Nếu có scheduledTime → lịch đăng, không có → đăng ngay
  if (scheduledTime) {
    payload.scheduledTime = scheduledTime;
  }

  const response = await (globalThis as any).fetch(`${BLOTATO_API_BASE}/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "blotato-api-key": blotatoApiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Blotato API phản hồi không phải JSON: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const errMsg = data.message || data.error || text.slice(0, 300);
    throw new Error(`Blotato API lỗi [${response.status}]: ${errMsg}`);
  }

  const postSubmissionId = data.postSubmissionId || data.id || "";
  if (!postSubmissionId) {
    console.warn("[Blotato] Không nhận được postSubmissionId trong response:", data);
  }

  return { postSubmissionId };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Lấy danh sách tài khoản TikTok đã kết nối trên Blotato
// ─────────────────────────────────────────────────────────────────────────────
const getBlotatoAccounts = async (platform = "tiktok", blotatoApiKeyInput?: string) => {
  const blotatoApiKey = blotatoApiKeyInput || process.env.BLOTATO_API_KEY;
  if (!blotatoApiKey) {
    throw new Error("BLOTATO_API_KEY chưa được thiết lập.");
  }

  const response = await (globalThis as any).fetch(
    `${BLOTATO_API_BASE}/v2/users/me/accounts?platform=${platform}`,
    {
      method: "GET",
      headers: {
        "blotato-api-key": blotatoApiKey,
      },
    }
  );

  const text = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Blotato API phản hồi không phải JSON: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`Lấy danh sách tài khoản Blotato thất bại [${response.status}]: ${data.message || text}`);
  }

  return data;
};

function verifyWebhookToken(token?: string) {
  const expectedToken = String(process.env.TIKTOK_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || "").trim();
  if (!expectedToken) {
    return true;
  }
  return String(token || "").trim() === expectedToken;
}

function extractWebhookIdentifiers(payload: any) {
  const event = payload?.event || payload?.data?.event || payload?.type || payload?.event_type || "unknown";
  const data = payload?.data || payload;
  return {
    eventType: String(event || "unknown"),
    cardId: String(data?.cardId || data?.metadata?.cardId || payload?.cardId || "").trim(),
    publishId: String(
      data?.publishId ||
      data?.publish_id ||
      data?.postSubmissionId ||
      data?.post_submission_id ||
      payload?.publishId ||
      payload?.publish_id ||
      payload?.postSubmissionId ||
      payload?.post_submission_id ||
      ""
    ).trim(),
    postId: String(
      data?.postId ||
      data?.post_id ||
      data?.videoId ||
      data?.video_id ||
      data?.publicaly_available_post_id?.[0] ||
      payload?.postId ||
      payload?.post_id ||
      ""
    ).trim(),
    shareUrl: String(data?.shareUrl || data?.share_url || payload?.shareUrl || payload?.share_url || "").trim(),
    status: String(
      data?.status ||
      data?.publishStatus ||
      data?.publish_status ||
      payload?.status ||
      payload?.publishStatus ||
      payload?.publish_status ||
      ""
    ).trim(),
    messageText: String(data?.message?.text || data?.text || payload?.text || "").trim(),
    conversationId: String(data?.conversationId || data?.conversation_id || payload?.conversationId || "").trim(),
    senderId: String(data?.senderId || data?.sender_id || payload?.senderId || "").trim(),
    raw: payload,
  };
}

function mapWebhookStatusToCardStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return null;
  if (["publish_complete", "completed", "success", "published", "posted"].includes(normalized)) {
    return "published";
  }
  if (["failed", "error", "rejected", "canceled", "cancelled"].includes(normalized)) {
    return "failed";
  }
  if (["processing", "pending", "queued", "scheduled", "submitted"].includes(normalized)) {
    return "processing";
  }
  return null;
}

async function savePublishTracking(cardId: string, payload: {
  publishId?: string;
  provider?: string;
  status?: string;
  shareUrl?: string;
  postId?: string;
}) {
  const updateData: Record<string, any> = {
    tiktokWebhookUpdatedAt: new Date(),
  };

  if (payload.publishId) updateData.tiktokPublishId = payload.publishId;
  if (payload.provider) updateData.tiktokProvider = payload.provider;
  if (payload.shareUrl) updateData.tiktokShareUrl = payload.shareUrl;
  if (payload.postId) updateData.tiktokPostId = payload.postId;

  const mappedStatus = mapWebhookStatusToCardStatus(payload.status || "");
  if (mappedStatus) {
    updateData.status = mappedStatus;
    if (mappedStatus === "published") {
      updateData.publishedAt = new Date();
    }
  }

  await MarketingContentModel.findByIdAndUpdate(cardId, { $set: updateData });
}

export const tiktokService = {
  verifyWebhookToken,
  /**
   * Đăng video lên TikTok.
   *
   * Chiến lược ưu tiên (tự động chọn):
   *   1. BLOTATO (mặc định tạm thời): Nếu `BLOTATO_API_KEY` + `BLOTATO_TIKTOK_ACCOUNT_ID` đã cấu hình
   *      → dùng Blotato API (đã được TikTok approve, không cần audit app riêng).
   *   2. TIKTOK DIRECT: Nếu `accessToken` được truyền vào body
   *      → gọi trực tiếp TikTok Content Posting API v2 (PULL_FROM_URL).
   *      Lưu ý: App TikTok phải được audit để post PUBLIC; chưa audit chỉ SELF_ONLY.
   */
  async publishVideo(
    cardId: string,
    caption: string,
    videoUrl: string,
    privacyLevel: string = "SELF_ONLY",
    accessToken?: string,
    username?: string,
    scheduledTime?: string,
    blotatoAccountId?: string,
    blotatoApiKey?: string,
    integrationId?: string,
    companyCode?: string
  ) {
    let currentBlotatoApiKey = blotatoApiKey;
    let currentBlotatoAccountId = blotatoAccountId;
    let currentAccessToken = accessToken;
    let currentUsername = username;

    // 1. Nạp cấu hình từ cơ sở dữ liệu nếu có integrationId
    if (integrationId) {
      console.log(`[TikTok Service] Đang nạp cấu hình tài khoản kết nối từ DB (ID: ${integrationId})`);
      const integration = await SocialIntegrationModel.findById(integrationId);
      if (!integration) {
        throw new Error("Không tìm thấy thông tin tài khoản kết nối trên hệ thống.");
      }
      if (companyCode && integration.companyCode !== companyCode) {
        throw new Error("Tài khoản kết nối không thuộc phạm vi quản lý của công ty bạn.");
      }
      if (!integration.isConnected) {
        throw new Error("Tài khoản kết nối này đã bị vô hiệu hóa.");
      }
      if (integration.platform !== "TikTok") {
        throw new Error("Tài khoản kết nối được chọn không phải là tài khoản TikTok.");
      }

      if (integration.blotatoAccountId) {
        currentBlotatoAccountId = integration.blotatoAccountId;
        currentBlotatoApiKey = integration.accessToken;
      } else {
        currentAccessToken = integration.accessToken;
        currentUsername = integration.username || currentUsername;
      }
    }

    // 2. Định tuyến theo phương thức (Direct TikTok API hoặc Blotato)
    if (currentAccessToken) {
      console.log(
        `[TikTok Service → Direct API] Đang đăng video cho card ${cardId} (user: ${currentUsername || "unknown"}). Privacy: ${privacyLevel}`
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json; charset=UTF-8",
        Authorization: `Bearer ${currentAccessToken}`,
      };

      // BƯỚC 1: Init Post
      const initPayload = {
        post_info: {
          title: caption || "",
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      };

      let publishId: string;
      try {
        const initResponse = await (globalThis as any).fetch(
          `${TIKTOK_API_BASE}/v2/post/publish/video/init/`,
          { method: "POST", headers, body: JSON.stringify(initPayload) }
        );

        const initText = await initResponse.text();
        let initData: any = {};
        try { initData = JSON.parse(initText); } catch {
          throw new Error(`TikTok API phản hồi không phải JSON: ${initText.slice(0, 200)}`);
        }

        if (!initResponse.ok || initData.error?.code !== "ok") {
          const errCode = initData.error?.code || initResponse.status;
          const errMsg = initData.error?.message || "Lỗi không xác định từ TikTok API";
          throw new Error(`TikTok Init thất bại [${errCode}]: ${errMsg}`);
        }

        publishId = initData.data?.publish_id;
        if (!publishId) throw new Error("TikTok API không trả về publish_id.");
        console.log(`[TikTok Service → Direct] Init OK. publish_id: ${publishId}`);
      } catch (error: any) {
        console.error("[tiktokService.publishVideo → Direct] Init error:", error);
        throw new Error(`Khởi tạo bài đăng TikTok thất bại: ${error.message}`);
      }

      // BƯỚC 2: Poll status (tối đa 10 lần × 3s)
      const MAX_POLLS = 10;
      const POLL_INTERVAL_MS = 3000;

      for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const statusResponse = await (globalThis as any).fetch(
            `${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
            { method: "POST", headers, body: JSON.stringify({ publish_id: publishId }) }
          );

          const statusText = await statusResponse.text();
          let statusData: any = {};
          try { statusData = JSON.parse(statusText); } catch {
            console.warn(`[TikTok Service] Poll #${attempt}: không phải JSON, thử lại...`);
            continue;
          }

          if (!statusResponse.ok || statusData.error?.code !== "ok") {
            const errCode = statusData.error?.code || statusResponse.status;
            const errMsg = statusData.error?.message || "Lỗi không xác định";
            throw new Error(`TikTok Status thất bại [${errCode}]: ${errMsg}`);
          }

          const publishStatus: string = statusData.data?.status || "";
          const videoId = statusData.data?.publicaly_available_post_id?.[0] || "";
          const shareUrl = videoId
            ? `https://www.tiktok.com/@${currentUsername || "user"}/video/${videoId}`
            : "";

          console.log(`[TikTok Service → Direct] Poll #${attempt}: status = ${publishStatus}`);

          if (publishStatus === "PUBLISH_COMPLETE") {
          return {
            status: "success",
            message: "Đăng video lên TikTok trực tiếp thành công",
            provider: "tiktok_direct",
            data: { publishId, shareUrl, publishStatus, success: true },
          };
          }

          if (publishStatus === "FAILED") {
            const failReason = statusData.data?.fail_reason || "Không rõ lý do";
            throw new Error(`TikTok từ chối đăng video: ${failReason}`);
          }
        } catch (error: any) {
          if (error.message.includes("TikTok")) throw error;
          console.warn(`[TikTok Service] Poll #${attempt} lỗi mạng: ${error.message}`);
        }
      }

      return {
        status: "pending",
        message: "Video đang được TikTok xử lý. Vui lòng kiểm tra tài khoản sau vài phút.",
        provider: "tiktok_direct",
        data: { publishId, shareUrl: "", publishStatus: "PROCESSING", success: false },
      };
    } else {
      // ── LUỒNG BLOTATO ──────────────────────────────────────────────────────────
      const blotatoApiKeyToUse = currentBlotatoApiKey || process.env.BLOTATO_API_KEY;
      const blotatoAccountIdToUse = currentBlotatoAccountId || process.env.BLOTATO_TIKTOK_ACCOUNT_ID;

      if (blotatoApiKeyToUse) {
        const accountId = blotatoAccountIdToUse || "";
        console.log(
          `[TikTok Service → Blotato] Đang đăng video cho card ${cardId} qua Blotato API. accountId: ${accountId || "(chưa cấu hình)"}`
        );

        try {
          const { postSubmissionId } = await callBlotatoPublish(
            caption,
            videoUrl,
            accountId,
            scheduledTime,
            blotatoApiKeyToUse
          );

          return {
            status: "success",
            message: scheduledTime
              ? `Đã lên lịch đăng TikTok qua Blotato thành công (${scheduledTime})`
              : "Đăng video lên TikTok qua Blotato thành công",
            provider: "blotato",
            data: {
              postSubmissionId,
              shareUrl: "",
              publishStatus: scheduledTime ? "SCHEDULED" : "SUBMITTED",
              success: true,
            },
          };
        } catch (err: any) {
          console.error("[TikTok Service → Blotato] Lỗi:", err.message);
          throw err;
        }
      }

      throw new Error(
        "Chưa cấu hình BLOTATO_API_KEY hoặc tài khoản kết nối TikTok (integrationId/accessToken). Vui lòng cấu hình tài khoản kết nối trước khi đăng bài."
      );
    }
  },

  async registerPublishTracking(cardId: string, result: any) {
    const provider = String(result?.provider || "").trim();
    const data = result?.data || {};
    const publishId = String(data?.publishId || data?.postSubmissionId || "").trim();
    const postId = String(data?.postId || "").trim();
    const shareUrl = String(data?.shareUrl || "").trim();
    const publishStatus = String(data?.publishStatus || result?.status || "").trim();

    if (!cardId) {
      return;
    }

    await savePublishTracking(cardId, {
      publishId,
      provider,
      status: publishStatus,
      shareUrl,
      postId,
    });
  },

  async processWebhook(payload: any) {
    const parsed = extractWebhookIdentifiers(payload);
    const normalizedEvent = parsed.eventType.toLowerCase();

    const matchedCard = parsed.cardId
      ? await MarketingContentModel.findById(parsed.cardId)
      : await MarketingContentModel.findOne({
        $or: [
          ...(parsed.publishId ? [{ tiktokPublishId: parsed.publishId }] : []),
          ...(parsed.postId ? [{ tiktokPostId: parsed.postId }] : []),
        ],
      });

    if (normalizedEvent.includes("message")) {
      const messageEvent = {
        platform: "tiktok",
        conversationId: parsed.conversationId,
        senderId: parsed.senderId,
        text: parsed.messageText,
        cardId: matchedCard?._id?.toString() || parsed.cardId || "",
        raw: parsed.raw,
      };

      broadcastEvent("tiktok_message_received", messageEvent);

      return {
        status: "success",
        type: "message",
        matchedCardId: matchedCard?._id?.toString() || null,
      };
    }

    if (!matchedCard) {
      return {
        status: "ignored",
        type: "publish",
        reason: "card_not_found",
        publishId: parsed.publishId,
        postId: parsed.postId,
      };
    }

    const mappedStatus = mapWebhookStatusToCardStatus(parsed.status);
    const updateData: Record<string, any> = {
      tiktokLastWebhookEvent: parsed.eventType,
      tiktokWebhookUpdatedAt: new Date(),
    };

    if (parsed.publishId) updateData.tiktokPublishId = parsed.publishId;
    if (parsed.postId) updateData.tiktokPostId = parsed.postId;
    if (parsed.shareUrl) updateData.tiktokShareUrl = parsed.shareUrl;
    if (mappedStatus) updateData.status = mappedStatus;
    if (mappedStatus === "published") updateData.publishedAt = new Date();

    const updatedCard = await MarketingContentModel.findByIdAndUpdate(
      matchedCard._id,
      { $set: updateData },
      { new: true }
    ).lean();

    broadcastEvent("tiktok_post_updated", {
      cardId: String(matchedCard._id),
      publishId: parsed.publishId,
      postId: parsed.postId,
      status: mappedStatus || parsed.status || "updated",
      shareUrl: parsed.shareUrl,
      eventType: parsed.eventType,
      card: updatedCard,
    });

    return {
      status: "success",
      type: "publish",
      cardId: String(matchedCard._id),
      eventType: parsed.eventType,
      publishStatus: parsed.status,
    };
  },

  /**
   * Lấy danh sách tài khoản TikTok đã kết nối trên Blotato.
   * Dùng để lấy `accountId` cần thiết cho việc đăng bài.
   * GET https://backend.blotato.com/v2/users/me/accounts?platform=tiktok
   */
  async getBlotatoAccounts(blotatoApiKey?: string) {
    try {
      const data = await getBlotatoAccounts("tiktok", blotatoApiKey);
      return {
        status: "success",
        message: "Lấy danh sách tài khoản TikTok từ Blotato thành công",
        data,
      };
    } catch (error: any) {
      console.error("[tiktokService.getBlotatoAccounts] Error:", error);
      throw new Error(`Lấy tài khoản Blotato thất bại: ${error.message}`);
    }
  },

  /**
   * Lấy thông tin creator (privacy options) từ TikTok API trực tiếp.
   * Chỉ dùng khi có accessToken hợp lệ (TikTok Direct mode).
   */
  async getCreatorInfo(accessToken: string) {
    if (!accessToken) {
      throw new Error("Access Token TikTok không được để trống.");
    }

    try {
      const response = await (globalThis as any).fetch(
        `${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {
        throw new Error(`TikTok API phản hồi không phải JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok || data.error?.code !== "ok") {
        const errCode = data.error?.code || response.status;
        const errMsg = data.error?.message || "Lỗi không xác định từ TikTok API";
        throw new Error(`Lấy thông tin creator thất bại [${errCode}]: ${errMsg}`);
      }

      return {
        status: "success",
        message: "Lấy thông tin creator TikTok thành công",
        data: {
          creatorAvatarUrl: data.data?.creator_avatar_url || "",
          creatorNickname: data.data?.creator_nickname || "",
          creatorUsername: data.data?.creator_username || "",
          privacyLevelOptions: data.data?.privacy_level_options || [],
          commentDisabled: data.data?.comment_disabled ?? false,
          duetDisabled: data.data?.duet_disabled ?? false,
          stitchDisabled: data.data?.stitch_disabled ?? false,
        },
      };
    } catch (error: any) {
      console.error("[tiktokService.getCreatorInfo] Error:", error);
      throw new Error(`Lấy thông tin creator TikTok thất bại: ${error.message}`);
    }
  },

  /**
   * Xác thực kết nối TikTok.
   * - Nếu BLOTATO_API_KEY đã config → kiểm tra bằng cách gọi /v2/users/me/accounts
   * - Nếu không → thử Creator Info Query với accessToken (TikTok Direct)
   * - Fallback cuối: n8n Webhook nếu N8N_TT_VALIDATE_URL có cấu hình
   */
  async validateToken(username: string, accessToken: string, blotatoApiKey?: string) {
    // 1. Nếu BLOTATO_API_KEY đã cấu hình → xác thực qua Blotato
    const currentBlotatoApiKey = blotatoApiKey || process.env.BLOTATO_API_KEY;
    if (currentBlotatoApiKey) {
      try {
        console.log("[TikTok Service] Xác thực tài khoản TikTok qua Blotato...");
        const accounts = await getBlotatoAccounts("tiktok", currentBlotatoApiKey);
        const accountList = Array.isArray(accounts) ? accounts : accounts.accounts || accounts.data || [];

        return {
          status: "success",
          message: "Kết nối TikTok qua Blotato hợp lệ",
          valid: true,
          provider: "blotato",
          displayName: accountList[0]?.name || username || "TikTok User",
          avatarUrl: accountList[0]?.avatarUrl || "",
          accounts: accountList,
        };
      } catch (blotatoErr: any) {
        console.warn(`[TikTok Service] Blotato validate thất bại: ${blotatoErr.message}`);
      }
    }

    // 2. TikTok Direct: Creator Info Query
    if (accessToken) {
      try {
        console.log(`[TikTok Service] Xác thực trực tiếp Access Token cho "${username}"...`);
        const creatorInfo = await tiktokService.getCreatorInfo(accessToken);
        return {
          status: "success",
          message: "Xác thực Access Token TikTok trực tiếp thành công",
          valid: true,
          provider: "tiktok_direct",
          displayName: creatorInfo.data.creatorNickname || creatorInfo.data.creatorUsername || username,
          avatarUrl: creatorInfo.data.creatorAvatarUrl || "",
          privacyLevelOptions: creatorInfo.data.privacyLevelOptions,
        };
      } catch (directErr: any) {
        console.warn(`[TikTok Service] Direct validate thất bại: ${directErr.message}`);
      }
    }

    // 3. Fallback: n8n webhook
    const webhookUrl = process.env.N8N_TT_VALIDATE_URL;
    if (!webhookUrl) {
      throw new Error(
        "Không thể xác thực: Chưa cấu hình BLOTATO_API_KEY, accessToken không hợp lệ, và N8N_TT_VALIDATE_URL chưa được thiết lập."
      );
    }

    const secretToken = process.env.N8N_WEBHOOK_SECRET;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secretToken) headers["X-Webhook-Token"] = secretToken;

    try {
      const response = await (globalThis as any).fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ username, accessToken }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`n8n Webhook phản hồi lỗi: ${response.status} - ${text}`);
      }

      const data = await response.json();
      const resultData = data.data ?? data;
      if (!resultData.valid) {
        throw new Error(resultData.message || "Token không hợp lệ.");
      }

      return {
        status: "success",
        message: "Xác thực token TikTok qua n8n thành công",
        valid: true,
        provider: "n8n",
        displayName: resultData.displayName || "TikTok User",
        avatarUrl: resultData.avatarUrl || "",
        privacyLevelOptions: [],
      };
    } catch (error: any) {
      console.error("[tiktokService.validateToken] Error:", error);
      throw new Error(`Xác thực token thất bại: ${error.message}`);
    }
  },
};
