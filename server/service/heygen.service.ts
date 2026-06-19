import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { AIMediaModel } from "../model/ai-media.model";
import { UserModel } from "../model/user.model";
import { broadcastEvent } from "../socket";
import { heygenLegacyService } from "./heygen-legacy.service";

type HeyGenLibraryItem = {
  id: string;
  name: string;
  previewImage?: string;
  gender?: string;
  language?: string;
  accent?: string;
  isDefault?: boolean;
  isCustom?: boolean;
};

type HeyGenAccessContext = {
  avatarIds: string[];
  avatarId: string;
  voiceId: string;
  apiKey: string;
  allowFullLibrary: boolean;
  warnings: string[];
};

type HeyGenRemoteVideo = {
  id: string;
  _id: string;
  videoId: string;
  title: string;
  prompt: string;
  url: string;
  thumbnailUrl: string;
  gifUrl: string;
  captionedVideoUrl: string;
  subtitleUrl: string;
  duration: number;
  status: string;
  createdAt: string | null;
  completedAt: string | null;
  videoPageUrl: string;
  outputLanguage: string;
  failureCode: string;
  failureMessage: string;
  model: string;
};

export type CreateAvatarVideoInput = {
  avatarId: string;
  voiceId?: string;
  audioUrl?: string;
  audioRecordId?: string;
  motionText?: string;
  aspectRatio?: string;
  resolution?: "720p" | "1080p" | "4k";
  engineType?: "avatar_v" | "avatar_iv" | "avatar_iii";
  title?: string;
  description?: string;
  enableCaption?: boolean;
  inputText?: string;
};

type HeyGenWebhookPayload = {
  [key: string]: any;
};

export const HEYGEN_API_BASE = "https://api.heygen.com";
const ACTIVE_VIDEO_STATUSES = new Set(["processing", "pending", "queued", "waiting", "in_progress", "rendering"]);

export class HeyGenApiError extends Error {
  statusCode: number;
  details: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = "HeyGenApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getApiKey(overrideApiKey?: string) {
  return overrideApiKey?.trim() || process.env.HEYGEN_API_KEY?.trim() || "";
}

function getDefaultAvatarId() {
  return String(process.env.HEYGEN_DEFAULT_AVATAR_ID || "").trim();
}

function getDefaultVoiceId() {
  return String(process.env.HEYGEN_DEFAULT_VOICE_ID || "").trim();
}

function getHeyGenWebhookUrl() {
  const baseUrl = String(process.env.APP_URL || "").trim();
  if (!baseUrl) {
    return "";
  }

  try {
    const webhookUrl = new URL("/api/v1/heygen/webhook", baseUrl);
    const secret = String(process.env.HEYGEN_WEBHOOK_SECRET || "").trim();
    if (secret) {
      webhookUrl.searchParams.set("token", secret);
    }
    return webhookUrl.toString();
  } catch {
    return "";
  }
}

function requireApiKey(overrideApiKey?: string) {
  const apiKey = getApiKey(overrideApiKey);
  if (!apiKey) {
    throw new Error("Chưa cấu hình khóa API HeyGen");
  }
  return apiKey;
}

export async function parseHeyGenResponse(response: Response, fallbackMessage: string) {
  const raw = await response.text();
  let parsed: any = null;

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const details = parsed?.error?.message || parsed?.message || raw || fallbackMessage;
    throw new HeyGenApiError(details, response.status, parsed || raw);
  }

  return parsed ?? {};
}

export async function requestHeyGenJson(path: string, init?: RequestInit, overrideApiKey?: string) {
  const apiKey = requireApiKey(overrideApiKey);
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      ...(init?.headers || {}),
    },
  });
  return parseHeyGenResponse(response, `Không thể gọi HeyGen API: ${path}`);
}

function normalizeLibraryItems(payload: any, type: "avatar" | "voice"): HeyGenLibraryItem[] {
  const candidates = [
    payload?.data?.avatars,
    payload?.data?.voices,
    payload?.avatars,
    payload?.voices,
    payload?.data,
    payload,
  ];

  const list = candidates.find((item) => Array.isArray(item));
  if (!Array.isArray(list)) {
    return [];
  }

  const normalized = list
    .map((item: any) => {
      const id = item?.avatar_id || item?.voice_id || item?.id || item?.template_id || item?.value;
      const name = item?.avatar_name || item?.name || item?.title || item?.label;
      if (!id || !name) {
        return null;
      }
      return {
        id: String(id),
        name: String(name),
        previewImage: item?.preview_image_url || item?.preview_url || item?.image_url || item?.thumbnail_url,
        gender: item?.gender,
        language: item?.language || item?.locale,
        accent: item?.accent,
        isDefault: Boolean(item?.is_default || item?.default || false),
        isCustom: Boolean(
          item?.is_custom_avatar ||
          item?.is_user_avatar ||
          item?.is_owner ||
          item?.owned_by_me ||
          item?.created_by_user ||
          item?.avatar_type === "custom" ||
          item?.source === "user" ||
          item?.type === "custom"
        ),
      } satisfies HeyGenLibraryItem;
    })
    .filter(Boolean)
    .slice(0, type === "avatar" ? 200 : 300) as HeyGenLibraryItem[];

  const seen = new Set<string>();
  return normalized.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function filterCustomAvatars(items: HeyGenLibraryItem[]) {
  const customOnly = items.filter((item) => item.isCustom);
  return customOnly.length > 0 ? customOnly : items;
}

export async function getHeyGenAccessContext(userId: string): Promise<HeyGenAccessContext> {
  const user = await UserModel.findById(userId)
    .select("role heygenAccess")
    .lean();

  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  const rawAvatarIds = Array.isArray(user.heygenAccess?.avatarIds)
    ? user.heygenAccess?.avatarIds.map((item: any) => String(item || "").trim()).filter(Boolean)
    : [];
  const legacyAvatarId = String(user.heygenAccess?.avatarId || "").trim();
  const avatarIds = rawAvatarIds.length > 0
    ? rawAvatarIds
    : (legacyAvatarId ? [legacyAvatarId] : []);
  const avatarId = String(legacyAvatarId || avatarIds[0] || getDefaultAvatarId()).trim();
  const voiceId = String(user.heygenAccess?.voiceId || getDefaultVoiceId()).trim();
  const apiKey = String(user.heygenAccess?.apiKey || "").trim();
  const warnings: string[] = [];
  const allowFullLibrary = false;

  if (!avatarId) {
    warnings.push("Tài khoản này chưa được gán avatar HeyGen mặc định.");
  }

  if (!voiceId) {
    warnings.push("Tài khoản này chưa được gán voice HeyGen mặc định.");
  }

  return {
    avatarIds,
    avatarId,
    voiceId,
    apiKey,
    allowFullLibrary,
    warnings,
  };
}

function filterLibraryByAccess(items: HeyGenLibraryItem[], selectedIds: string[], allowFullLibrary: boolean) {
  if (allowFullLibrary) {
    return items;
  }

  if (!selectedIds.length) {
    return [];
  }

  const allowedIds = new Set(selectedIds.map((item) => String(item)));
  return items.filter((item) => allowedIds.has(String(item.id)));
}

async function fetchLibraryWithCandidates(type: "avatar" | "voice", overrideApiKey?: string) {
  const candidates = type === "avatar"
    ? ["/v2/avatars", "/v1/avatars", "/v2/avatar.list", "/v1/avatar.list"]
    : ["/v2/voices", "/v1/voices", "/v2/voice.list", "/v1/voice.list"];

  let lastError: Error | null = null;

  for (const path of candidates) {
    try {
      const payload = await requestHeyGenJson(path, undefined, overrideApiKey);
      const normalized = normalizeLibraryItems(payload, type);
      if (normalized.length > 0) {
        return { items: normalized, source: path };
      }
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Không lấy được thư viện HeyGen cho ${type}`);
}

export async function upsertVideoRecord(userId: string, payload: {
  videoId: string;
  script: string;
  motionText?: string;
  avatarId?: string;
  voiceId?: string;
  audioUrl?: string;
  audioRecordId?: string;
  aspectRatio?: string;
  status?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
  captionedVideoUrl?: string;
  subtitleUrl?: string;
  thumbnailUrl?: string;
}) {
  console.log("[heygenService.upsertVideoRecord] Upserting:", {
    userId,
    videoId: payload.videoId,
    status: payload.status,
    hasVideoUrl: Boolean(payload.videoUrl),
    hasCaptionedVideoUrl: Boolean(payload.captionedVideoUrl),
    title: payload.title,
  });
  const existing = await AIMediaModel.findOne({
    userId,
    mediaType: "video",
    "metadata.heygenVideoId": payload.videoId,
  });

  const metadata = {
    aspectRatio: payload.aspectRatio,
    heygenVideoId: payload.videoId,
    heygenAvatarId: payload.avatarId,
    heygenVoiceId: payload.voiceId,
    heygenAudioUrl: payload.audioUrl,
    heygenAudioRecordId: payload.audioRecordId,
    captionedVideoUrl: payload.captionedVideoUrl,
    subtitleUrl: payload.subtitleUrl,
    thumbnailUrl: payload.thumbnailUrl,
    provider: "heygen",
    status: payload.status || "processing",
    title: payload.title,
    description: payload.motionText
      ? [payload.description, `Motion: ${payload.motionText}`].filter(Boolean).join(" | ")
      : payload.description,
  };
  const fallbackUrl = payload.videoUrl || `pending://heygen/${payload.videoId}`;

  if (existing) {
    existing.url = payload.videoUrl || existing.url || fallbackUrl;
    existing.prompt = payload.script || existing.prompt;
    existing.metadata = {
      ...existing.metadata,
      ...metadata,
    };
    await existing.save();
    return existing.toObject();
  }

  return AIMediaModel.create({
    userId,
    mediaType: "video",
    url: fallbackUrl,
    prompt: payload.script,
    metadata,
  });
}

function normalizeStatusPayload(data: any) {
  const root = data?.data || data?.event_data || data;
  const captionedVideoUrl = root?.captioned_video_url || root?.video_url_with_caption || "";
  const subtitleUrl = root?.subtitle_url || "";
  const videoUrl =
    root?.video_url ||
    root?.url ||
    captionedVideoUrl ||
    root?.download_url ||
    root?.video_page_url ||
    "";
  const error = root?.failure_message || root?.error?.message || root?.error || "";
  return {
    jobStatus: root?.status || root?.video_status || root?.state || (error ? "failed" : videoUrl ? "completed" : "processing"),
    videoUrl,
    captionedVideoUrl,
    subtitleUrl,
    thumbnailUrl: root?.thumbnail_url || root?.cover_url || "",
    error,
    raw: data,
  };
}

function normalizeWebhookPayload(payload: HeyGenWebhookPayload) {
  const root = payload?.data || payload?.video || payload?.event_data || payload;
  const eventType = String(payload?.event_type || payload?.event || payload?.type || "video.updated").trim();
  const videoId = String(
    root?.video_id ||
    root?.id ||
    payload?.video_id ||
    payload?.videoId ||
    payload?.id ||
    ""
  ).trim();
  const normalized = normalizeStatusPayload(payload);
  const eventTypeLower = eventType.toLowerCase();
  const inferredJobStatus =
    (eventTypeLower.includes("fail") || eventTypeLower.includes("error") ? "failed" : "") ||
    (eventTypeLower.includes("complete") || eventTypeLower.includes("success") || eventTypeLower.includes("finish") ? "completed" : "") ||
    normalized.jobStatus ||
    "processing";
  const normalizedJobStatus = String(inferredJobStatus).toLowerCase() === "success" ? "completed" : inferredJobStatus;
  const resolvedVideoUrl =
    normalized.videoUrl ||
    root?.video_page_url ||
    root?.share_url ||
    root?.download_url ||
    root?.captioned_video_url ||
    "";

  return {
    eventType,
    videoId,
    jobStatus: normalizedJobStatus,
    videoUrl: resolvedVideoUrl,
    captionedVideoUrl: normalized.captionedVideoUrl,
    subtitleUrl: normalized.subtitleUrl,
    thumbnailUrl: normalized.thumbnailUrl,
    error: normalized.error,
    title: String(root?.title || payload?.title || "").trim() || undefined,
    duration: Number(root?.duration || payload?.duration || 0) || undefined,
    raw: payload,
  };
}

function toIsoStringFromUnix(value: any) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function normalizeHeyGenVideo(video: any, localRecord?: any): HeyGenRemoteVideo {
  const videoId = String(video?.id || localRecord?.metadata?.heygenVideoId || localRecord?._id || "");
  const fallbackPrompt = localRecord?.prompt || video?.title || "HeyGen video";

  return {
    id: videoId,
    _id: String(localRecord?._id || videoId),
    videoId,
    title: String(video?.title || localRecord?.metadata?.title || fallbackPrompt),
    prompt: String(fallbackPrompt),
    url: String(video?.video_url || localRecord?.url || ""),
    thumbnailUrl: String(video?.thumbnail_url || localRecord?.metadata?.thumbnailUrl || ""),
    gifUrl: String(video?.gif_url || ""),
    captionedVideoUrl: String(video?.captioned_video_url || localRecord?.metadata?.captionedVideoUrl || ""),
    subtitleUrl: String(video?.subtitle_url || localRecord?.metadata?.subtitleUrl || ""),
    duration: Number(video?.duration || localRecord?.metadata?.duration || 0),
    status: String(video?.status || localRecord?.metadata?.status || (video?.video_url ? "completed" : "processing")),
    createdAt: toIsoStringFromUnix(video?.created_at) || (localRecord?.createdAt ? new Date(localRecord.createdAt).toISOString() : null),
    completedAt: toIsoStringFromUnix(video?.completed_at),
    videoPageUrl: String(video?.video_page_url || ""),
    outputLanguage: String(video?.output_language || ""),
    failureCode: String(video?.failure_code || ""),
    failureMessage: String(video?.failure_message || ""),
    model: String(localRecord?.metadata?.title || "Avatar V"),
  };
}

function isActiveLocalVideoStatus(status: any) {
  return ACTIVE_VIDEO_STATUSES.has(String(status || "").toLowerCase());
}

async function deleteLocalVideoRecord(userId: string, videoId: string) {
  const filters: any[] = [{ "metadata.heygenVideoId": videoId }];

  if (mongoose.Types.ObjectId.isValid(videoId)) {
    filters.push({ _id: videoId });
  }

  const result = await AIMediaModel.deleteMany({
    userId,
    mediaType: "video",
    $or: filters,
  });

  return result.deletedCount || 0;
}

async function resolveAudioSource(userId: string, input: CreateAvatarVideoInput) {
  const directAudioUrl = String(input.audioUrl || "").trim();
  if (directAudioUrl) {
    return {
      audioUrl: directAudioUrl,
      audioRecordId: String(input.audioRecordId || "").trim() || undefined,
    };
  }

  const audioRecordId = String(input.audioRecordId || "").trim();
  if (!audioRecordId) {
    return {
      audioUrl: "",
      audioRecordId: undefined,
    };
  }

  const record = await AIMediaModel.findOne({
    _id: audioRecordId,
    userId,
    mediaType: "voice",
  }).lean();

  if (!record?.url) {
    throw new HeyGenApiError("Không tìm thấy audio ElevenLabs đã chọn.", 404);
  }

  return {
    audioUrl: String(record.url),
    audioRecordId,
  };
}

function verifyWebhookToken(token?: string) {
  const expectedToken = String(process.env.HEYGEN_WEBHOOK_SECRET || "").trim();
  if (!expectedToken) {
    return true;
  }

  return String(token || "").trim() === expectedToken;
}

export const heygenService = {
  verifyWebhookToken,

  async getLibrary(userId: string) {
    const accessContext = await getHeyGenAccessContext(userId);
    requireApiKey(accessContext.apiKey);

    const [avatarResult, voiceResult] = await Promise.all([
      fetchLibraryWithCandidates("avatar", accessContext.apiKey),
      fetchLibraryWithCandidates("voice", accessContext.apiKey),
    ]);

    const avatarPool = accessContext.allowFullLibrary
      ? filterCustomAvatars(avatarResult.items)
      : avatarResult.items;

    return {
      status: "success",
      avatars: filterLibraryByAccess(
        avatarPool,
        accessContext.avatarIds.length > 0 ? accessContext.avatarIds : (accessContext.avatarId ? [accessContext.avatarId] : []),
        accessContext.allowFullLibrary
      ),
      voices: voiceResult.items,
      sources: {
        avatars: avatarResult.source,
        voices: voiceResult.source,
      },
      warnings: accessContext.warnings,
      defaults: {
        avatarId: accessContext.avatarId,
        voiceId: accessContext.voiceId,
      },
    };
  },

  async createAvatarVideo(userId: string, input: CreateAvatarVideoInput) {
    if (input.engineType === "avatar_iii") {
      return heygenLegacyService.generateLegacyVideo(userId, input);
    }

    const accessContext = await getHeyGenAccessContext(userId);
    const apiKey = requireApiKey(accessContext.apiKey);
    const { avatarId, voiceId, motionText, aspectRatio, resolution, engineType, title, description } = input;
    const { audioUrl, audioRecordId } = await resolveAudioSource(userId, input);
    const normalizedVoiceId = String(voiceId || "").trim();
    const hasAudioSource = Boolean(audioUrl);

    if (!avatarId?.trim()) {
      throw new HeyGenApiError("Vui lòng chọn avatar HeyGen trước khi tạo video.", 400);
    }

    if (!hasAudioSource) {
      throw new HeyGenApiError("Cần cung cấp audio ElevenLabs để tạo video.", 400);
    }

    const allowedAvatarIds = accessContext.avatarIds.length > 0
      ? accessContext.avatarIds
      : (accessContext.avatarId ? [accessContext.avatarId] : []);

    if (!accessContext.allowFullLibrary && !allowedAvatarIds.includes(avatarId)) {
      throw new HeyGenApiError("Avatar này không được cấp cho tài khoản hiện tại.", 403);
    }

    if (normalizedVoiceId && !accessContext.allowFullLibrary && accessContext.voiceId !== normalizedVoiceId) {
      throw new HeyGenApiError("Giọng đọc này không được cấp cho tài khoản hiện tại.", 403);
    }

    const requestBody: Record<string, any> = {
      type: "avatar",
      avatar_id: avatarId,
      aspect_ratio: aspectRatio || "16:9",
      resolution: resolution || "720p",
      output_format: "mp4",
    };

    const webhookUrl = getHeyGenWebhookUrl();
    if (webhookUrl) {
      requestBody.callback_url = webhookUrl;
    }

    if (input.enableCaption) {
      requestBody.caption = {
        file_format: "srt",
        style: "default",
      };
    }

    requestBody.audio_url = audioUrl;
    if (normalizedVoiceId) {
      requestBody.voice_id = normalizedVoiceId;
    }

    if (title?.trim()) {
      requestBody.title = title.trim();
    }

    if (motionText?.trim()) {
      requestBody.motion_prompt = motionText.trim();
    }

    if (engineType === "avatar_v") {
      requestBody.engine = { type: "avatar_v" };
    } else if (engineType === "avatar_iv") {
      requestBody.engine = { type: "avatar_iv" };
    } else if (engineType === "avatar_iii") {
      requestBody.engine = { type: "avatar_iii" };
    }

    const response = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await parseHeyGenResponse(response, "Không thể tạo video ");
    const videoId = data?.data?.video_id || data?.video_id || data?.id;

    if (!videoId) {
      throw new Error("HeyGen không trả về video_id");
    }

    const record = await upsertVideoRecord(userId, {
      videoId,
      script: title || "HeyGen audio video",
      motionText,
      avatarId,
      voiceId: normalizedVoiceId || undefined,
      audioUrl: audioUrl || undefined,
      audioRecordId,
      aspectRatio,
      status: data?.data?.status || data?.status || "processing",
      title,
      description,
    });

    return {
      status: "success",
      provider: "heygen",
      videoId,
      jobStatus: data?.data?.status || data?.status || "processing",
      requestedAt: new Date().toISOString(),
      audioUrl: audioUrl || undefined,
      audioRecordId,
      record,
    };
  },

  async getVideoStatus(userId: string, videoId: string, context?: Partial<CreateAvatarVideoInput>) {
    const accessContext = await getHeyGenAccessContext(userId);
    let data: any = null;
    try {
      data = await requestHeyGenJson(`/v3/videos/${encodeURIComponent(videoId)}`, undefined, accessContext.apiKey);
    } catch (err) {
      console.log(`[getVideoStatus] v3 endpoint failed, trying v1/video_status.get for video ${videoId}:`, err);
      try {
        data = await heygenLegacyService.getLegacyStatus(videoId, accessContext.apiKey || process.env.HEYGEN_API_KEY?.trim() || "");
      } catch (v1Err) {
        console.error(`[getVideoStatus] Both v3 and v1 status calls failed:`, v1Err);
        throw err;
      }
    }
    const normalized = normalizeStatusPayload(data);
    console.log("[heygenService.getVideoStatus] Normalized status:", {
      userId,
      videoId,
      jobStatus: normalized.jobStatus,
      hasVideoUrl: Boolean(normalized.videoUrl),
      hasThumbnailUrl: Boolean(normalized.thumbnailUrl),
      error: normalized.error || "",
    });

    const record = await upsertVideoRecord(userId, {
      videoId,
      videoUrl: normalized.videoUrl || undefined,
      captionedVideoUrl: normalized.captionedVideoUrl || undefined,
      subtitleUrl: normalized.subtitleUrl || undefined,
      thumbnailUrl: normalized.thumbnailUrl || undefined,
      script: context?.title || "Video người thật",
      motionText: context?.motionText,
      avatarId: context?.avatarId,
      voiceId: context?.voiceId,
      audioUrl: context?.audioUrl,
      audioRecordId: context?.audioRecordId,
      aspectRatio: context?.aspectRatio,
      status: normalized.jobStatus,
      title: context?.title,
      description: context?.description,
    });

    return {
      status: "success",
      videoId,
      jobStatus: normalized.jobStatus,
      videoUrl: normalized.videoUrl,
      thumbnailUrl: normalized.thumbnailUrl,
      error: normalized.error,
      record,
      raw: data,
    };
  },

  async getVideoHistory(userId: string) {
    const localRecords = await AIMediaModel.find({
      userId,
      mediaType: "video",
      $or: [
        { "metadata.provider": "heygen" },
        { "metadata.heygenVideoId": { $exists: true, $ne: "" } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const activeRecords = localRecords.filter((r) =>
      r.metadata?.status && ACTIVE_VIDEO_STATUSES.has(String(r.metadata.status).toLowerCase())
    );

    if (activeRecords.length > 0) {
      try {
        const accessContext = await getHeyGenAccessContext(userId);
        const apiKey = accessContext.apiKey || process.env.HEYGEN_API_KEY?.trim();
        if (apiKey) {
          await Promise.allSettled(
            activeRecords.map(async (record) => {
              try {
                const videoId = record.metadata.heygenVideoId;
                if (!videoId) return;
                let data: any = null;
                try {
                  data = await requestHeyGenJson(`/v3/videos/${encodeURIComponent(videoId)}`, undefined, apiKey);
                } catch (v3Err) {
                  try {
                    data = await heygenLegacyService.getLegacyStatus(videoId, apiKey);
                  } catch (v1Err) {
                    console.error(`[getVideoHistory] Status fetch failed for video ${videoId}:`, v1Err);
                    throw v3Err;
                  }
                }
                const normalized = normalizeStatusPayload(data);
                await upsertVideoRecord(userId, {
                  videoId,
                  videoUrl: normalized.videoUrl || undefined,
                  captionedVideoUrl: normalized.captionedVideoUrl || undefined,
                  subtitleUrl: normalized.subtitleUrl || undefined,
                  thumbnailUrl: normalized.thumbnailUrl || undefined,
                  script: record.prompt || "Video người thật",
                  status: normalized.jobStatus,
                  aspectRatio: record.metadata?.aspectRatio,
                  title: record.metadata?.title,
                  description: record.metadata?.description,
                });
              } catch (e) {
                console.error(`[getVideoHistory] Error polling live status for video ${record._id}:`, e);
              }
            })
          );

          // Refetch updated list from DB
          const updatedRecords = await AIMediaModel.find({
            userId,
            mediaType: "video",
            $or: [
              { "metadata.provider": "heygen" },
              { "metadata.heygenVideoId": { $exists: true, $ne: "" } },
            ],
          })
            .sort({ createdAt: -1 })
            .lean();
          return updatedRecords.map((record) => normalizeHeyGenVideo(null, record));
        }
      } catch (error) {
        console.error("[getVideoHistory] Live sync error:", error);
      }
    }

    return localRecords.map((record) => normalizeHeyGenVideo(null, record));
  },

  async processWebhook(payload: HeyGenWebhookPayload) {
    const normalized = normalizeWebhookPayload(payload);
    console.log("[heygenService.processWebhook] Normalized payload:", {
      videoId: normalized.videoId,
      eventType: normalized.eventType,
      jobStatus: normalized.jobStatus,
      hasVideoUrl: Boolean(normalized.videoUrl),
      hasCaptionedVideoUrl: Boolean(normalized.captionedVideoUrl),
      hasThumbnailUrl: Boolean(normalized.thumbnailUrl),
      error: normalized.error || "",
    });

    if (!normalized.videoId) {
      throw new HeyGenApiError("Webhook HeyGen không có video_id.", 400, payload);
    }

    let resolvedNormalized = normalized;
    const normalizedStatus = String(normalized.jobStatus || "").toLowerCase();
    const needsStatusRefetch =
      (normalizedStatus === "completed" || normalizedStatus === "success") &&
      !String(normalized.videoUrl || "").trim();

    if (needsStatusRefetch) {
      try {
        const recordForLookup = await AIMediaModel.findOne({
          mediaType: "video",
          "metadata.heygenVideoId": normalized.videoId,
        }).lean();

        const userId = String(recordForLookup?.userId || "").trim();
        if (userId) {
          const accessContext = await getHeyGenAccessContext(userId);
          let data: any = null;
          try {
            data = await requestHeyGenJson(`/v3/videos/${encodeURIComponent(normalized.videoId)}`, undefined, accessContext.apiKey);
          } catch {
            data = await heygenLegacyService.getLegacyStatus(
              normalized.videoId,
              accessContext.apiKey || process.env.HEYGEN_API_KEY?.trim() || ""
            );
          }
          const statusNormalized = normalizeStatusPayload(data);
          resolvedNormalized = {
            ...normalized,
            jobStatus: statusNormalized.jobStatus || normalized.jobStatus,
            videoUrl: statusNormalized.videoUrl || normalized.videoUrl,
            captionedVideoUrl: statusNormalized.captionedVideoUrl || normalized.captionedVideoUrl,
            subtitleUrl: statusNormalized.subtitleUrl || normalized.subtitleUrl,
            thumbnailUrl: statusNormalized.thumbnailUrl || normalized.thumbnailUrl,
            error: statusNormalized.error || normalized.error,
          };
        }
      } catch (error) {
        console.error("[heygenService.processWebhook] Fallback status refetch failed:", error);
      }
    }

    const records = await AIMediaModel.find({
      mediaType: "video",
      "metadata.heygenVideoId": resolvedNormalized.videoId,
    });

    if (records.length === 0) {
      return {
        status: "ignored",
        reason: "video_not_found",
        videoId: resolvedNormalized.videoId,
        eventType: resolvedNormalized.eventType,
      };
    }

    const updates = await Promise.all(records.map(async (record) => {
      record.url = resolvedNormalized.videoUrl || record.url || `pending://heygen/${resolvedNormalized.videoId}`;
      record.metadata = {
        ...record.metadata,
        status: resolvedNormalized.jobStatus,
        captionedVideoUrl: resolvedNormalized.captionedVideoUrl || record.metadata?.captionedVideoUrl,
        subtitleUrl: resolvedNormalized.subtitleUrl || record.metadata?.subtitleUrl,
        thumbnailUrl: resolvedNormalized.thumbnailUrl || record.metadata?.thumbnailUrl,
        title: resolvedNormalized.title || record.metadata?.title,
        duration: resolvedNormalized.duration || record.metadata?.duration,
        heygenLastWebhookEvent: resolvedNormalized.eventType,
        heygenWebhookUpdatedAt: new Date().toISOString(),
      };
      await record.save();
      return record.toObject();
    }));

    // Broadcast video status update event to connected socket clients
    broadcastEvent("video_status_updated", {
      videoId: resolvedNormalized.videoId,
      status: resolvedNormalized.jobStatus,
      updates,
    });

    return {
      status: "success",
      videoId: resolvedNormalized.videoId,
      eventType: resolvedNormalized.eventType,
      jobStatus: resolvedNormalized.jobStatus,
      updatedCount: updates.length,
      records: updates,
    };
  },

  async deleteVideoHistory(userId: string, videoId: string) {
    const accessContext = await getHeyGenAccessContext(userId);
    requireApiKey(accessContext.apiKey);

    const localRecord = await AIMediaModel.findOne({
      userId,
      mediaType: "video",
      $or: [
        { "metadata.heygenVideoId": videoId },
        ...(mongoose.Types.ObjectId.isValid(videoId) ? [{ _id: videoId }] : []),
      ],
    }).lean();

    const remoteVideoId = String(localRecord?.metadata?.heygenVideoId || videoId);
    let remoteDeleted = false;

    if (remoteVideoId) {
      try {
        await requestHeyGenJson(`/v3/videos/${encodeURIComponent(remoteVideoId)}`, {
          method: "DELETE",
        }, accessContext.apiKey);
        remoteDeleted = true;
      } catch (error: any) {
        const message = String(error?.message || "");
        const isAlreadyGone = error?.statusCode === 404 || /not found/i.test(message);
        if (!isAlreadyGone) {
          throw error;
        }
      }
    }

    let deletedLocalCount = await deleteLocalVideoRecord(userId, videoId);
    if (remoteVideoId !== videoId) {
      deletedLocalCount += await deleteLocalVideoRecord(userId, remoteVideoId);
    }

    return { status: "success", remoteDeleted, deletedLocalCount };
  },
};
