/* eslint-disable @typescript-eslint/no-unused-vars */
import { getAccessToken } from "../../shared/services/authService";
import { ContentApprovalCard } from "../../shared/types/index";
import { geminiApi } from "../../shared/api/gemini";
import type { TikTokPrivacyLevel } from "../../shared/services/socialIntegrationService";

const DEMO_VIDEO_URL_PATTERNS = [
  "w3schools.com/html/mov_bbb.mp4",
  "example.com/video.mp4",
  "example.com/videos/"
];

export function buildFacebookPostUrl(postId?: string | null): string {
  const normalizedPostId = String(postId || "").trim();
  if (!normalizedPostId || normalizedPostId.includes("mock")) {
    return "";
  }

  if (normalizedPostId.includes("_")) {
    const [pageId, storyFbid] = normalizedPostId.split("_");
    if (pageId && storyFbid) {
      return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(storyFbid)}&id=${encodeURIComponent(pageId)}`;
    }
  }

  return `https://www.facebook.com/${encodeURIComponent(normalizedPostId)}`;
}

function normalizePromptBlock(value?: string | null): string {
  return String(value || "").replace(/\r/g, "").trim();
}

export function buildFaithfulMediaPrompt(
  card: Partial<ContentApprovalCard>,
  type: "image" | "video" = "image"
): string {
  const sourceBrief = normalizePromptBlock(card.sourceBrief);
  const title = normalizePromptBlock(card.title);
  const mediaPrompt = normalizePromptBlock(card.mediaPrompt);
  const outline = normalizePromptBlock(card.outline);
  const bodyText = normalizePromptBlock(card.bodyText);
  const channel = normalizePromptBlock(card.channel);
  const contentType = normalizePromptBlock(card.contentType);

  const sourceFacts = [
    sourceBrief ? `Original source brief: ${sourceBrief}` : "",
    title ? `Title: ${title}` : "",
    channel ? `Channel: ${channel}` : "",
    contentType ? `Content type: ${contentType}` : "",
    outline ? `Outline: ${outline}` : "",
    bodyText ? `Body text: ${bodyText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const strictRules = [
    "STRICT SOURCE-OF-TRUTH REQUIREMENT:",
    "Use only the information grounded in the title, outline, body text, and provided reference image.",
    "Do not invent people, products, services, locations, claims, numbers, uniforms, branding details, office scenes, or props that are not explicitly present in the source.",
    "If the source is a recruitment post, the visual must stay in a recruitment/employer-branding context only.",
    "If the source does not mention a product, do not add a product shot.",
    "If the source does not specify a location or character, keep the scene generic and minimal rather than making up details.",
    type === "image"
      ? "Generate one faithful still image that matches the brief exactly."
      : "Generate one faithful video concept that matches the brief exactly.",
  ].join("\n");

  const visualInstruction = mediaPrompt
    ? `Existing visual prompt to preserve and refine faithfully:\n${mediaPrompt}`
    : "No existing visual prompt is available. Derive the visual only from the source facts above without adding new meaning.";

  return [strictRules, sourceFacts ? `SOURCE FACTS:\n${sourceFacts}` : "", visualInstruction]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function stripDemoVideoUrl(videoUrl?: string | null): string | null {
  const value = String(videoUrl || "").trim();
  if (!value) return null;
  const normalized = value.toLowerCase();
  return DEMO_VIDEO_URL_PATTERNS.some((pattern) => normalized.includes(pattern)) ? null : value;
}

function normalizeMarketingCard(item: Record<string, unknown>): ContentApprovalCard {
  return {
    ...item,
    id: String(item._id || item.id || ""),
    videoUrl: stripDemoVideoUrl(typeof item.videoUrl === "string" ? item.videoUrl : null),
  } as unknown as ContentApprovalCard;
}

function sanitizeMarketingPayload<T extends object>(payload: T): T {
  const payloadRecord = payload as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(payloadRecord, "videoUrl")) {
    return payload;
  }
  return {
    ...payload,
    videoUrl: stripDemoVideoUrl(typeof payloadRecord.videoUrl === "string" ? payloadRecord.videoUrl : null),
  };
}

export const marketingService = {
  async getCards(authorUid?: string): Promise<ContentApprovalCard[]> {
    let url = "/api/v1/marketing-contents";
    if (authorUid) {
      url += `?authorUid=${encodeURIComponent(authorUid)}`;
    }
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không thể tải danh sách bài viết duyệt.");
    }
    const json = await res.json();
    return ((json.data || []) as Record<string, unknown>[]).map(normalizeMarketingCard);
  },

  subscribeToContents(
    onUpdate: (cards: ContentApprovalCard[]) => void,
    onError: (error: unknown) => void,
    currentUid?: string,
    currentRole?: string
  ): () => void {
    const isUserRole = currentRole === 'user' || currentRole === 'manager';
    const authorUid = undefined; // Hiá»ƒn thá»‹ vá»›i táº¥t cáº£ nhÃ¢n viÃªn trong doanh nghiá»‡p, khÃ´ng lá»c theo tÃ¡c giáº£


    const fetchCards = async () => {
      try {
        let data = await this.getCards(authorUid);

        // Sáº¯p xáº¿p bÃ i má»›i lÃªn Ä‘áº§u (generatedAt giáº£m dáº§n)
        data.sort((a, b) => {
          const timeA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
          const timeB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
          return timeB - timeA;
        });

        // Tá»± Ä‘á»™ng Ä‘Ã¡nh dáº¥u isNew cho cÃ¡c bÃ i viáº¿t táº¡o má»›i trong vÃ²ng 30 giÃ¢y gáº§n Ä‘Ã¢y
        const nowTime = Date.now();
        data = data.map(card => {
          const isRecent = card.generatedAt && (nowTime - new Date(card.generatedAt).getTime() < 30000);
          if (isRecent) {
            return { ...card, isNew: true };
          }
          return card;
        });

        onUpdate(data);
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          console.error("Lá»—i táº£i danh sÃ¡ch bÃ i Ä‘Äƒng marketing:", err);
        }
      }
    };

    fetchCards();
    const interval = setInterval(fetchCards, 5000);
    return () => clearInterval(interval);
  },

  async updateCardStatus(id: string, newStatus: 'draft' | 'pending' | 'approved' | 'scheduled' | 'published'): Promise<void> {
    const payload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'approved') {
      payload.scheduledDate = "";
      payload.scheduledTime = "";
    }
    await this.updateCard(id, payload);
  },

  async scheduleCard(id: string, scheduledDate: string, scheduledTime: string, integrationId?: string): Promise<void> {
    // 1. Láº¥y dá»¯ liá»‡u bÃ i Ä‘Äƒng Ä‘áº§y Ä‘á»§ trÆ°á»›c
    const cardData = await this.getCardById(id);

    if (!cardData.authorUid) {
      throw new Error("Bài đăng không có thông tin tác giả (authorUid).");
    }

    const channel = cardData.channel || 'Facebook';
    let integrationInfo: Record<string, unknown> | null = null;

    // 2. Äá»c cáº¥u hÃ¬nh liÃªn káº¿t máº¡ng xÃ£ há»™i
    if (integrationId) {
      // Äá»c cáº¥u hÃ¬nh tá»« SocialIntegration cá»¥ thá»ƒ Ä‘Æ°á»£c chá»n
      const res = await fetch(`/api/v1/marketing-campaigns/accounts/${integrationId}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không tìm thấy thông tin tài khoản liên kết được chọn.");
      }
      const json = await res.json();
      const integration = json.data;

      if (channel === 'Facebook') {
        integrationInfo = {
          pageId: integration.username, // Page ID lÆ°u á»Ÿ username
          pageAccessToken: integration.accessToken,
          isMock: !!integration.isMock
        };
      } else if (channel === 'TikTok') {
        integrationInfo = {
          username: integration.username,
          displayName: integration.displayName,
          blotatoAccountId: integration.blotatoAccountId,
          accessToken: integration.accessToken,
          isMock: !!integration.isMock
        };
      } else {
        throw new Error(`Kênh đăng tải "${channel}" chưa hỗ trợ tự động lên lịch.`);
      }
    } else {
      // Fallback: Đọc cấu hình liên kết mạng xã hội cá nhân của tác giả qua user API
      const userRes = await fetch(`/api/v1/marketing-settings/authors/${cardData.authorUid}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!userRes.ok) {
        throw new Error("Không tìm thấy thông tin hồ sơ của tác giả.");
      }
      const userJson = await userRes.json();
      const userProfile = userJson.data;

      if (channel === 'Facebook') {
        const fbInt = userProfile.facebookIntegration;
        if (!fbInt || !fbInt.isConnected) {
          throw new Error("Tác giả chưa liên kết với Facebook Page.");
        }
        integrationInfo = {
          pageId: fbInt.pageId,
          pageAccessToken: fbInt.pageAccessToken,
          isMock: !!fbInt.isMock
        };
      } else if (channel === 'TikTok') {
        const ttInt = userProfile.tiktokIntegration;
        if (!ttInt || !ttInt.isConnected) {
          throw new Error("Tác giả chưa liên kết với tài khoản TikTok.");
        }
        integrationInfo = {
          username: ttInt.username,
          displayName: ttInt.displayName,
          isMock: !!ttInt.isMock
        };
      } else {
        throw new Error(`Kênh đăng tải "${channel}" chưa hỗ trợ tự động lên lịch.`);
      }
    }

    // 3. Gá» i API Express Backend gá»­i yÃªu cáº§u schedule sang n8n
    const response = await fetch('/api/v1/scheduler/schedule-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({
        cardId: id,
        channel,
        title: cardData.title,
        bodyText: cardData.bodyText,
        imageUrl: cardData.imageUrl || '',
        videoUrl: cardData.videoUrl || '',
        scheduledDate,
        scheduledTime,
        integration: integrationInfo,
        integrationId,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lên lịch qua n8n thất bại: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    if (resData.status !== 'success') {
      throw new Error(resData.message || 'Lỗi không xác định từ máy chủ khi lên lịch.');
    }

    // 4. Chá»‰ khi thÃ nh cÃ´ng háº¿t, má»›i lÆ°u thá»i gian Ä‘áº·t lá»‹ch, Ä‘á»•i status sang scheduled vÃ  lÆ°u facebookPostId
    const fbPostId = resData.data?.id || resData.data?.data?.id || '';

    await this.updateCard(id, {
      status: 'scheduled',
      scheduledDate,
      scheduledTime,
      integrationId,
      ...(fbPostId ? { facebookPostId: fbPostId } : {})
    });

    console.log(`[iGen Schedule Service]: Đã lên lịch bài đăng ${id} thành công qua n8n! ID bài viết: ${fbPostId}`);
  },

  async deleteCard(id: string): Promise<void> {
    const res = await fetch(`/api/v1/marketing-contents/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || "Không thể xóa bài đăng.");
    }
  },

  async saveCard(card: ContentApprovalCard): Promise<ContentApprovalCard> {
    const { id, ...postBody } = sanitizeMarketingPayload(card);
    const res = await fetch("/api/v1/marketing-contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(postBody),
    });
    if (!res.ok) {
      throw new Error("Không thể lưu bài đăng.");
    }
    const json = await res.json();
    return normalizeMarketingCard(json.data);
  },

  async saveCards(cards: ContentApprovalCard[]): Promise<ContentApprovalCard[]> {
    const savedCards = await Promise.all(
      cards.map(async (card) => {
        const { id, ...postBody } = sanitizeMarketingPayload(card);
        const res = await fetch("/api/v1/marketing-contents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(postBody),
        });
        if (!res.ok) {
          throw new Error("Không thể lưu bài đăng.");
        }
        const json = await res.json();
        return normalizeMarketingCard(json.data);
      })
    );
    return savedCards;
  },

  async updateCard(id: string, card: Partial<ContentApprovalCard>): Promise<void> {
    const res = await fetch(`/api/v1/marketing-contents/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(sanitizeMarketingPayload(card)),
    });
    if (!res.ok) {
      throw new Error("Không thể cập nhật bài đăng.");
    }
  },

  async getCardById(id: string): Promise<ContentApprovalCard> {
    const res = await fetch(`/api/v1/marketing-contents/${id}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không tìm thấy thông tin bài đăng.");
    }
    const json = await res.json();
    return normalizeMarketingCard(json.data);
  },

  async publishToFacebook(
    id: string, pageId: string, bodyText: string, isMock: boolean, imageUrl?: string, videoUrl?: string
  ): Promise<string> {
    if (isMock) throw new Error("Tài khoản Facebook demo không hỗ trợ đăng bài thật.");
    const response = await fetch("/api/v1/facebook/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ cardId: id, pageId, content: extractDraftContent(bodyText), imageUrl, videoUrl }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(failure.message || failure.details || `Lỗi máy chủ HTTP ${response.status}`);
    }
    const result = await response.json();
    const data = result.data?.data ?? result.data ?? {};
    const publication = result.publication;
    const status = String(publication?.status || data.status || "").toLowerCase();
    if (["failed", "error"].includes(status)) throw new Error(publication?.error || data.error || "Đăng Facebook thất bại.");
    if (["processing", "pending", "queued", "publishing"].includes(status)) return "";
    return String(publication?.postId || data.id || data.post_id || "").trim();
  },

  async developIdea(concept: {
    title: string;
    summary: string;
    suggestedContent: string;
    channels: string[];
    mediaType?: string;
    imageModel?: string;
    imageResolution?: string;
    imageAspectRatio?: string;
    mediaPrompt?: string;
  }) {
    return geminiApi.developMarketingIdea(concept);
  },

  async fetchSuggestions(): Promise<string[]> {
    return geminiApi.fetchMarketingSuggestions();
  },

  async updateCardMedia(mediaUrl: string | null, type: 'image' | 'video', cardIds: string[]): Promise<void> {
    if (cardIds.length === 0) return;
    await Promise.all(
      cardIds.map((id) => {
        const updateData: Record<string, unknown> = {};
        if (type === 'image') {
          updateData.imageUrl = mediaUrl ? mediaUrl : null;
        } else {
          updateData.videoUrl = mediaUrl ? mediaUrl : null;
        }
        return this.updateCard(id, updateData);
      })
    );
  },

  async uploadMediaToStorage(tempUrl: string, filename: string, type: 'image' | 'video'): Promise<string> {
    try {
      const response = await fetch('/api/v1/marketing-media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          file: tempUrl,
          folder: 'igen_erp/marketing',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (e) {
      console.error("[marketingService.uploadMediaToStorage] Error:", e);
      throw e;
    }
  },

  async publishToTikTok(
    id: string,
    caption: string,
    videoUrl: string,
    _isMock: boolean,
    privacyLevel: TikTokPrivacyLevel,
    options?: {
      integrationId?: string;
      allowComment: boolean;
      allowDuet: boolean;
      allowStitch: boolean;
      brandContentToggle: boolean;
      brandContent: boolean;
      brandOrganic: boolean;
      isAigc: boolean;
      videoDurationSeconds: number;
      consentAccepted: boolean;
    }
  ): Promise<{ postId: string; status: "success" | "pending"; shareUrl?: string }> {


    const response = await fetch('/api/v1/tiktok/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        cardId: id,
        caption,
        videoUrl,
        privacyLevel,
        integrationId: options?.integrationId,
        allowComment: options?.allowComment,
        allowDuet: options?.allowDuet,
        allowStitch: options?.allowStitch,
        brandContentToggle: options?.brandContentToggle,
        brandContent: options?.brandContent,
        brandOrganic: options?.brandOrganic,
        isAigc: options?.isAigc,
        videoDurationSeconds: options?.videoDurationSeconds,
        consentAccepted: options?.consentAccepted,
      }),
    });

    if (!response.ok) {
      let errMsg = "";
      try {
        const errData = await response.json();
        errMsg = errData.details || errData.message || `Lỗi máy chủ HTTP ${response.status}`;
      } catch {
        errMsg = `Lỗi máy chủ HTTP ${response.status}`;
      }
      throw new Error(errMsg);
    }

    const resData = await response.json();
    if (resData.status !== 'success' && resData.status !== 'pending') {
      throw new Error(resData.message || 'Lỗi không xác định từ máy chủ khi đăng TikTok.');
    }

    const { postId, shareUrl, publishId } = resData.data || {};
    const normalizedStatus = resData.status === "pending" ? "pending" : "success";

    if (normalizedStatus === "success") {
      await this.updateCard(id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tiktokPostId: postId,
        tiktokShareUrl: shareUrl
      });

      console.log(`[iGen Marketing TikTok]: Đã đăng video thành công. Post ID: ${postId}`);
    } else {
      await this.updateCard(id, {
        status: 'processing',
        tiktokPostId: postId || publishId || '',
        tiktokShareUrl: shareUrl || ''
      });

      console.log(`[iGen Marketing TikTok]: Video đã được TikTok xử lý. Publish ID: ${publishId || postId || "n/a"}`);
    }

    return {
      postId: String(postId || publishId || ""),
      status: normalizedStatus,
      shareUrl: shareUrl || "",
    };
  },

};

export function extractDraftContent(text: string): string {
  if (!text) return "";

  const markers = [
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",

    " NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    " NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    " NỘI DUNG CHI TIẾT:",
    " NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",

    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",

    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);

  let currentText = text.trim();
  let found = true;
  let iterations = 0;

  while (found && iterations < 5) {
    found = false;
    const prefix = currentText.substring(0, 1500);
    const prefixUpper = prefix.toUpperCase();

    for (const marker of sortedMarkers) {
      const index = prefixUpper.indexOf(marker.toUpperCase());
      if (index !== -1) {
        currentText = currentText.substring(index + marker.length).trim();
        found = true;
        iterations++;
        break;
      }
    }
  }

  return currentText;
}

export function splitOutlineAndDraft(text: string): { outline: string; bodyText: string } {
  if (!text) return { outline: "", bodyText: "" };

  const markers = [
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",

    " NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    " NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    " NỘI DUNG CHI TIẾT:",
    " NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",

    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",

    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);

  const prefix = text.substring(0, 1500);
  const prefixUpper = prefix.toUpperCase();

  for (const marker of sortedMarkers) {
    const index = prefixUpper.indexOf(marker.toUpperCase());
    if (index !== -1) {
      const outline = text.substring(0, index).trim();
      const bodyText = extractDraftContent(text.substring(index));
      return { outline, bodyText };
    }
  }

  return { outline: "", bodyText: text.trim() };
}


export function sanitizeVoiceScript(rawText: string): string {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const instructionMarkers = [
    "YÊU CẦU RIÊNG CHO VIDEO NGƯỜI THẬT:",
    "YEU CAU RIENG CHO VIDEO NGUOI THAT:",
  ];

  let cleaned = text;
  for (const marker of instructionMarkers) {
    const markerIndex = cleaned.toUpperCase().indexOf(marker.toUpperCase());
    if (markerIndex !== -1) {
      cleaned = cleaned.slice(0, markerIndex).trim();
      break;
    }
  }

  cleaned = cleaned
    .replace(/^Xin chao,\s*/i, "Xin chào, ")
    .replace(/\bday la\b/gi, "Đây là ")
    .replace(/\bnoi dung gioi thieu ngan gon cho chien dich\b/gi, "Nội dung giới thiệu cho chiến dịch")
    .replace(/\bHay lien he ngay de nhan tu van chi tiet va uu dai phu hop\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export function stripVoiceOutlineSections(rawText: string): string {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const outlineMarkers = [
    "DAN Y CHI TIET",
    "OUTLINE:",
    "(OUTLINE):",
    "[OUTLINE]:",
  ];

  let cleaned = text;
  for (const marker of outlineMarkers) {
    const markerIndex = cleaned.toUpperCase().indexOf(marker);
    if (markerIndex !== -1) {
      cleaned = cleaned.slice(0, markerIndex).trim();
      break;
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}


