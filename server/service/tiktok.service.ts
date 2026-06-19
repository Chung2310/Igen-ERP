import { broadcastEvent } from "../socket";
import { MarketingContentModel } from "../model/marketing-content.model";
import { SocialIntegrationModel } from "../model/social-integration.model";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

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

async function savePublishTracking(
  cardId: string,
  payload: { publishId?: string; provider?: string; status?: string; shareUrl?: string; postId?: string }
) {
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

async function resolveDirectCredentials(
  integrationId?: string,
  companyCode?: string,
  accessToken?: string,
  username?: string
) {
  let resolvedAccessToken = accessToken;
  let resolvedUsername = username;

  if (integrationId) {
    console.log(`[TikTok Service] Loading TikTok integration from DB: ${integrationId}`);
    const integration = await SocialIntegrationModel.findById(integrationId);

    if (!integration) {
      throw new Error("Khong tim thay tai khoan ket noi TikTok tren he thong.");
    }
    if (companyCode && integration.companyCode !== companyCode) {
      throw new Error("Tai khoan ket noi khong thuoc pham vi cong ty cua ban.");
    }
    if (!integration.isConnected) {
      throw new Error("Tai khoan ket noi TikTok dang bi vo hieu hoa.");
    }
    if (integration.platform !== "TikTok") {
      throw new Error("Tai khoan ket noi duoc chon khong phai TikTok.");
    }
    if (!integration.accessToken) {
      throw new Error("Tai khoan TikTok nay chua co access token de dang bai.");
    }

    resolvedAccessToken = integration.accessToken;
    resolvedUsername = integration.username || resolvedUsername;
  }

  if (!resolvedAccessToken) {
    throw new Error("Thieu accessToken TikTok. Hay ket noi TikTok sandbox hoac truyen integrationId hop le.");
  }

  return {
    accessToken: resolvedAccessToken,
    username: resolvedUsername || "",
  };
}

export const tiktokService = {
  verifyWebhookToken,

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
    void scheduledTime;
    void blotatoAccountId;
    void blotatoApiKey;

    const credentials = await resolveDirectCredentials(integrationId, companyCode, accessToken, username);

    console.log(
      `[TikTok Service -> Direct API] Publishing card ${cardId} for ${credentials.username || "unknown"} with privacy ${privacyLevel}`
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: `Bearer ${credentials.accessToken}`,
    };

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

    let publishId = "";

    try {
      const initResponse = await (globalThis as any).fetch(`${TIKTOK_API_BASE}/v2/post/publish/video/init/`, {
        method: "POST",
        headers,
        body: JSON.stringify(initPayload),
      });

      const initText = await initResponse.text();
      let initData: any = {};
      try {
        initData = JSON.parse(initText);
      } catch {
        throw new Error(`TikTok API response is not JSON: ${initText.slice(0, 200)}`);
      }

      if (!initResponse.ok || initData.error?.code !== "ok") {
        const errCode = initData.error?.code || initResponse.status;
        const errMsg = initData.error?.message || "Unknown TikTok API error";
        throw new Error(`TikTok init failed [${errCode}]: ${errMsg}`);
      }

      publishId = String(initData.data?.publish_id || "").trim();
      if (!publishId) {
        throw new Error("TikTok API did not return publish_id.");
      }
    } catch (error: any) {
      console.error("[tiktokService.publishVideo] Direct init error:", error);
      throw new Error(`Khoi tao bai dang TikTok that bai: ${error.message}`);
    }

    const maxPolls = 10;
    const pollIntervalMs = 3000;

    for (let attempt = 1; attempt <= maxPolls; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      try {
        const statusResponse = await (globalThis as any).fetch(`${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ publish_id: publishId }),
        });

        const statusText = await statusResponse.text();
        let statusData: any = {};
        try {
          statusData = JSON.parse(statusText);
        } catch {
          console.warn(`[TikTok Service] Poll #${attempt}: response is not JSON`);
          continue;
        }

        if (!statusResponse.ok || statusData.error?.code !== "ok") {
          const errCode = statusData.error?.code || statusResponse.status;
          const errMsg = statusData.error?.message || "Unknown TikTok API error";
          throw new Error(`TikTok status failed [${errCode}]: ${errMsg}`);
        }

        const publishStatus = String(statusData.data?.status || "").trim();
        const videoId = String(statusData.data?.publicaly_available_post_id?.[0] || "").trim();
        const shareUrl = videoId
          ? `https://www.tiktok.com/@${credentials.username || "user"}/video/${videoId}`
          : "";

        if (publishStatus === "PUBLISH_COMPLETE") {
          return {
            status: "success",
            message: "Dang video len TikTok thanh cong",
            provider: "tiktok_direct",
            data: {
              publishId,
              postId: videoId,
              shareUrl,
              publishStatus,
              success: true,
            },
          };
        }

        if (publishStatus === "FAILED") {
          const failReason = statusData.data?.fail_reason || "Khong ro ly do";
          throw new Error(`TikTok tu choi dang video: ${failReason}`);
        }
      } catch (error: any) {
        if (String(error.message || "").includes("TikTok")) {
          throw error;
        }
        console.warn(`[TikTok Service] Poll #${attempt} network issue: ${error.message}`);
      }
    }

    return {
      status: "pending",
      message: "Video dang duoc TikTok xu ly. Hay doi webhook callback hoac kiem tra lai sau.",
      provider: "tiktok_direct",
      data: {
        publishId,
        shareUrl: "",
        publishStatus: "PROCESSING",
        success: false,
      },
    };
  },

  async registerPublishTracking(cardId: string, result: any) {
    const provider = String(result?.provider || "").trim();
    const data = result?.data || {};
    const publishId = String(data?.publishId || "").trim();
    const postId = String(data?.postId || "").trim();
    const shareUrl = String(data?.shareUrl || "").trim();
    const publishStatus = String(data?.publishStatus || result?.status || "").trim();

    if (!cardId) return;

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

  async getBlotatoAccounts() {
    return {
      status: "disabled",
      message: "Blotato da duoc tat. He thong hien chi dung TikTok Direct sandbox.",
      data: [],
    };
  },

  async getCreatorInfo(accessToken: string) {
    if (!accessToken) {
      throw new Error("Access Token TikTok khong duoc de trong.");
    }

    try {
      const response = await (globalThis as any).fetch(`${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`TikTok API response is not JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok || data.error?.code !== "ok") {
        const errCode = data.error?.code || response.status;
        const errMsg = data.error?.message || "Unknown TikTok API error";
        throw new Error(`Lay thong tin creator that bai [${errCode}]: ${errMsg}`);
      }

      return {
        status: "success",
        message: "Lay thong tin creator TikTok thanh cong",
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
      throw new Error(`Lay thong tin creator TikTok that bai: ${error.message}`);
    }
  },

  async validateToken(username: string, accessToken: string) {
    if (!accessToken) {
      throw new Error("Thieu access token TikTok de xac thuc sandbox.");
    }

    try {
      console.log(`[TikTok Service] Validating direct TikTok token for "${username || "unknown"}"...`);
      const creatorInfo = await this.getCreatorInfo(accessToken);

      return {
        status: "success",
        message: "Xac thuc Access Token TikTok thanh cong",
        valid: true,
        provider: "tiktok_direct",
        displayName: creatorInfo.data.creatorNickname || creatorInfo.data.creatorUsername || username || "TikTok User",
        avatarUrl: creatorInfo.data.creatorAvatarUrl || "",
        privacyLevelOptions: creatorInfo.data.privacyLevelOptions,
      };
    } catch (error: any) {
      console.error("[tiktokService.validateToken] Error:", error);
      throw new Error(`Xac thuc token TikTok that bai: ${error.message}`);
    }
  },
};
