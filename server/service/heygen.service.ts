import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { AIMediaModel } from "../model/ai-media.model";
import { UserModel } from "../model/user.model";

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

type CreateAvatarVideoInput = {
  avatarId: string;
  voiceId: string;
  script: string;
  motionText?: string;
  aspectRatio?: string;
  resolution?: "720p" | "1080p" | "4k";
  engineType?: "avatar_v" | "avatar_iv" | "avatar_iii";
  title?: string;
  description?: string;
};

const HEYGEN_API_BASE = "https://api.heygen.com";
const ACTIVE_VIDEO_STATUSES = new Set(["processing", "pending", "queued", "waiting", "in_progress", "rendering"]);

class HeyGenApiError extends Error {
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

function requireApiKey(overrideApiKey?: string) {
  const apiKey = getApiKey(overrideApiKey);
  if (!apiKey) {
    throw new Error("Chưa cấu hình khóa API HeyGen");
  }
  return apiKey;
}

async function parseHeyGenResponse(response: Response, fallbackMessage: string) {
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

async function requestHeyGenJson(path: string, init?: RequestInit, overrideApiKey?: string) {
  const apiKey = requireApiKey(overrideApiKey);
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      ...(init?.headers || {}),
    },
  });
  return parseHeyGenResponse(response, `Khong the goi HeyGen API: ${path}`);
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
    const dedupeKey = item.id;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
}

function filterCustomAvatars(items: HeyGenLibraryItem[]) {
  const customOnly = items.filter((item) => item.isCustom);
  return customOnly.length > 0 ? customOnly : items;
}

async function getHeyGenAccessContext(userId: string): Promise<HeyGenAccessContext> {
  const user = await UserModel.findById(userId)
    .select("role heygenAccess")
    .lean();

  if (!user) {
    throw new Error("Khong tim thay nguoi dung");
  }

  const avatarId = String(user.heygenAccess?.avatarId || "").trim();
  const voiceId = String(user.heygenAccess?.voiceId || "").trim();
  const apiKey = String(user.heygenAccess?.apiKey || "").trim();
  const warnings: string[] = [];

  const allowFullLibrary = false;
  if (!avatarId || !voiceId) {
    warnings.push("Tài khoản này chưa được gán đủ avatar và giọng đọc HeyGen.");
  }

  return {
    avatarId,
    voiceId,
    apiKey,
    allowFullLibrary,
    warnings,
  };
}

function filterLibraryByAccess(items: HeyGenLibraryItem[], selectedId: string, allowFullLibrary: boolean) {
  if (allowFullLibrary) {
    return items;
  }

  if (!selectedId) {
    return [];
  }

  return items.filter((item) => String(item.id) === selectedId);
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

  throw lastError || new Error(`Khong lay duoc thu vien HeyGen cho ${type}`);
}

async function upsertVideoRecord(userId: string, payload: {
  videoId: string;
  script: string;
  motionText?: string;
  avatarId?: string;
  voiceId?: string;
  aspectRatio?: string;
  status?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
}) {
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
    provider: "heygen",
    status: payload.status || "processing",
    title: payload.title,
    description: payload.motionText ? [payload.description, `Motion: ${payload.motionText}`].filter(Boolean).join(" | ") : payload.description,
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
  const root = data?.data || data;
  const videoUrl = root?.video_url || root?.url || root?.video_url_with_caption || root?.download_url || "";
  const error = root?.failure_message || root?.error?.message || root?.error || "";
  return {
    jobStatus: root?.status || root?.video_status || root?.state || (error ? "failed" : videoUrl ? "completed" : "processing"),
    videoUrl,
    thumbnailUrl: root?.thumbnail_url || root?.cover_url || "",
    error,
    raw: data,
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
    thumbnailUrl: String(video?.thumbnail_url || ""),
    gifUrl: String(video?.gif_url || ""),
    captionedVideoUrl: String(video?.captioned_video_url || ""),
    subtitleUrl: String(video?.subtitle_url || ""),
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

export const heygenService = {
  async getLibrary(userId: string) {
    const accessContext = await getHeyGenAccessContext(userId);
    requireApiKey(accessContext.apiKey);
    const [avatarResult, voiceResult] = await Promise.all([
      fetchLibraryWithCandidates("avatar", accessContext.apiKey),
      fetchLibraryWithCandidates("voice", accessContext.apiKey),
    ]);

    const filteredAvatars = filterLibraryByAccess(
      filterCustomAvatars(avatarResult.items),
      accessContext.avatarId,
      accessContext.allowFullLibrary
    );
    const filteredVoices = filterLibraryByAccess(
      voiceResult.items,
      accessContext.voiceId,
      accessContext.allowFullLibrary
    );

    return {
      status: "success",
      avatars: filteredAvatars,
      voices: filteredVoices,
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
    const accessContext = await getHeyGenAccessContext(userId);
    const apiKey = requireApiKey(accessContext.apiKey);
    const { avatarId, voiceId, script, motionText, aspectRatio, resolution, engineType, title, description } = input;

    if (engineType === "avatar_iii") {
      throw new HeyGenApiError("Avatar III can dung legacy API cua HeyGen; luong v3 hien tai chi ho tro Avatar IV/V.", 400);
    }

    if (!accessContext.allowFullLibrary) {
      const isAllowedAvatar = accessContext.avatarId === avatarId;
      const isAllowedVoice = accessContext.voiceId === voiceId;

      if (!isAllowedAvatar) {
        throw new HeyGenApiError("Avatar này không được cấp cho tài khoản hiện tại.", 403);
      }

      if (!isAllowedVoice) {
        throw new HeyGenApiError("Giọng đọc này không được cấp cho tài khoản hiện tại.", 403);
      }
    }

    const requestBody: Record<string, any> = {
      type: "avatar",
      avatar_id: avatarId,
      script,
      aspect_ratio: aspectRatio || "16:9",
      resolution: resolution || "720p",
      output_format: "mp4",
    };

    if (title?.trim()) {
      requestBody.title = title.trim();
    }

    if (voiceId?.trim()) {
      requestBody.voice_id = voiceId.trim();
    }

    if (motionText?.trim()) {
      requestBody.motion_prompt = motionText.trim();
    }

    if (engineType === "avatar_v") {
      requestBody.engine = { type: "avatar_v" };
    } else if (engineType === "avatar_iv") {
      requestBody.engine = { type: "avatar_iv" };
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

    const data = await parseHeyGenResponse(response, "Không thể tạo video HeyGen");
    const videoId = data?.data?.video_id || data?.video_id || data?.id;

    if (!videoId) {
      throw new Error("HeyGen không trả về video_id");
    }

    const record = await upsertVideoRecord(userId, {
      videoId,
      script,
      motionText,
      avatarId,
      voiceId,
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
      record,
    };
  },

  async getVideoStatus(userId: string, videoId: string, context?: Partial<CreateAvatarVideoInput>) {
    const accessContext = await getHeyGenAccessContext(userId);
    const data = await requestHeyGenJson(`/v3/videos/${encodeURIComponent(videoId)}`, undefined, accessContext.apiKey);
    const normalized = normalizeStatusPayload(data);

    const record = await upsertVideoRecord(userId, {
      videoId,
      videoUrl: normalized.videoUrl || undefined,
      script: context?.script || "Video HeyGen",
      motionText: context?.motionText,
      avatarId: context?.avatarId,
      voiceId: context?.voiceId,
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
    const accessContext = await getHeyGenAccessContext(userId);
    requireApiKey(accessContext.apiKey);
    const localRecords = await AIMediaModel.find({
      userId,
      mediaType: "video",
      $or: [
        { "metadata.provider": "heygen" },
        { "metadata.heygenVideoId": { $exists: true, $ne: "" } },
      ],
    })
      .lean();
    const refreshedHistory = await Promise.all(localRecords.map(async (record: any): Promise<HeyGenRemoteVideo | null> => {
      const localVideoId = String(record?.metadata?.heygenVideoId || record?._id || "");
      const localStatus = String(record?.metadata?.status || "").toLowerCase();

      if (!localVideoId) {
        return normalizeHeyGenVideo(null, record);
      }

      try {
        const remotePayload = await requestHeyGenJson(`/v3/videos/${encodeURIComponent(localVideoId)}`, undefined, accessContext.apiKey);
        const remoteVideo = remotePayload?.data || remotePayload;
        const normalized = normalizeStatusPayload(remotePayload);

        await AIMediaModel.updateOne(
          { _id: record._id },
          {
            $set: {
              url: normalized.videoUrl || record.url || "",
              "metadata.status": normalized.jobStatus,
            },
          }
        );

        return normalizeHeyGenVideo(remoteVideo, {
          ...record,
          url: normalized.videoUrl || record.url || "",
          metadata: {
            ...record.metadata,
            status: normalized.jobStatus,
          },
        });
      } catch (error: any) {
        const message = String(error?.message || "");
        const isAlreadyGone = error?.statusCode === 404 || /not found/i.test(message);

        if (isAlreadyGone && !isActiveLocalVideoStatus(localStatus)) {
          await AIMediaModel.deleteOne({ _id: record._id });
          return null;
        }

        return normalizeHeyGenVideo(null, record);
      }
    }));

    return refreshedHistory.filter(Boolean).sort((a: any, b: any) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });
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
