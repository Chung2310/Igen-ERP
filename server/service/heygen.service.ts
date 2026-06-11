import { AIMediaModel } from "../model/ai-media.model";

type HeyGenLibraryItem = {
  id: string;
  name: string;
  previewImage?: string;
  gender?: string;
  language?: string;
  accent?: string;
  isDefault?: boolean;
};

type CreateAvatarVideoInput = {
  avatarId: string;
  voiceId: string;
  script: string;
  aspectRatio?: string;
  title?: string;
  description?: string;
};

const HEYGEN_API_BASE = "https://api.heygen.com";

const MOCK_AVATARS: HeyGenLibraryItem[] = [
  { id: "demo-avatar-01", name: "Linh Host", language: "vi", accent: "VI - Bac", isDefault: true },
  { id: "demo-avatar-02", name: "Mia Seller", language: "en", accent: "EN - US" },
  { id: "demo-avatar-03", name: "Ken Coach", language: "vi", accent: "VI - Nam" },
];

const MOCK_VOICES: HeyGenLibraryItem[] = [
  { id: "demo-voice-01", name: "Warm Narrator", language: "vi", accent: "VI - Bac", isDefault: true },
  { id: "demo-voice-02", name: "Energetic Host", language: "en", accent: "EN - US" },
  { id: "demo-voice-03", name: "Studio Presenter", language: "vi", accent: "VI - Nam" },
];

function getApiKey() {
  return process.env.HEYGEN_API_KEY?.trim() || "";
}

function getDimension(aspectRatio?: string) {
  switch (aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
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
    throw new Error(details);
  }

  return parsed ?? {};
}

async function requestHeyGenJson(path: string, init?: RequestInit) {
  const apiKey = getApiKey();
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey,
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

  return list
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
      } satisfies HeyGenLibraryItem;
    })
    .filter(Boolean)
    .slice(0, type === "avatar" ? 100 : 200) as HeyGenLibraryItem[];
}

function getDefaultLibraryItems(type: "avatar" | "voice"): HeyGenLibraryItem[] {
  if (type === "avatar") {
    const envAvatarId = process.env.HEYGEN_DEFAULT_AVATAR_ID?.trim();
    if (envAvatarId) {
      return [{
        id: envAvatarId,
        name: process.env.HEYGEN_DEFAULT_AVATAR_NAME?.trim() || "Default Avatar",
        isDefault: true,
      }];
    }
    return [];
  }

  const envVoiceId = process.env.HEYGEN_DEFAULT_VOICE_ID?.trim();
  if (envVoiceId) {
    return [{
      id: envVoiceId,
      name: process.env.HEYGEN_DEFAULT_VOICE_NAME?.trim() || "Default Voice",
      isDefault: true,
    }];
  }
  return [];
}

async function fetchLibraryWithCandidates(type: "avatar" | "voice") {
  const candidates = type === "avatar"
    ? ["/v2/avatars", "/v1/avatars", "/v2/avatar.list", "/v1/avatar.list"]
    : ["/v2/voices", "/v1/voices", "/v2/voice.list", "/v1/voice.list"];

  let lastError: Error | null = null;

  for (const path of candidates) {
    try {
      const payload = await requestHeyGenJson(path);
      const normalized = normalizeLibraryItems(payload, type);
      if (normalized.length > 0) {
        return { items: normalized, source: path };
      }
    } catch (error: any) {
      lastError = error;
    }
  }

  return {
    items: getDefaultLibraryItems(type),
    source: "env",
    error: lastError?.message,
  };
}

async function upsertVideoRecord(userId: string, payload: {
  videoId: string;
  script: string;
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
    description: payload.description,
  };

  if (existing) {
    existing.url = payload.videoUrl || existing.url;
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
    url: payload.videoUrl || "",
    prompt: payload.script,
    metadata,
  });
}

function normalizeStatusPayload(data: any) {
  const root = data?.data || data;
  return {
    jobStatus: root?.status || root?.video_status || root?.state || "processing",
    videoUrl: root?.video_url || root?.url || root?.video_url_with_caption || root?.download_url || "",
    thumbnailUrl: root?.thumbnail_url || root?.cover_url || "",
    error: root?.error?.message || root?.error || "",
    raw: data,
  };
}

export const heygenService = {
  async getLibrary() {
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        status: "success",
        mock: true,
        avatars: MOCK_AVATARS,
        voices: MOCK_VOICES,
      };
    }

    const [avatarResult, voiceResult] = await Promise.all([
      fetchLibraryWithCandidates("avatar"),
      fetchLibraryWithCandidates("voice"),
    ]);

    return {
      status: "success",
      mock: false,
      avatars: avatarResult.items.length > 0 ? avatarResult.items : MOCK_AVATARS,
      voices: voiceResult.items.length > 0 ? voiceResult.items : getDefaultLibraryItems("voice"),
      sources: {
        avatars: avatarResult.source,
        voices: voiceResult.source,
      },
      warnings: [avatarResult.error, voiceResult.error].filter(Boolean),
    };
  },

  async createAvatarVideo(userId: string, input: CreateAvatarVideoInput) {
    const apiKey = getApiKey();
    const { avatarId, voiceId, script, aspectRatio, title, description } = input;

    if (!apiKey) {
      const mockVideoId = `mock-heygen-${Date.now()}`;
      const record = await upsertVideoRecord(userId, {
        videoId: mockVideoId,
        script,
        avatarId,
        voiceId,
        aspectRatio,
        status: "processing",
        title,
        description,
      });

      return {
        status: "success",
        mock: true,
        videoId: mockVideoId,
        provider: "heygen",
        jobStatus: "processing",
        requestedAt: new Date().toISOString(),
        record,
      };
    }

    const response = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        type: "avatar",
        avatar_id: avatarId,
        voice_id: voiceId,
        script,
        dimension: getDimension(aspectRatio),
        engine: { type: "avatar_v" },
      }),
    });

    const data = await parseHeyGenResponse(response, "Khong the tao HeyGen avatar video");
    const videoId = data?.data?.video_id || data?.video_id || data?.id;

    if (!videoId) {
      throw new Error("HeyGen khong tra ve video_id");
    }

    const record = await upsertVideoRecord(userId, {
      videoId,
      script,
      avatarId,
      voiceId,
      aspectRatio,
      status: data?.data?.status || data?.status || "processing",
      title,
      description,
    });

    return {
      status: "success",
      mock: false,
      provider: "heygen",
      videoId,
      jobStatus: data?.data?.status || data?.status || "processing",
      requestedAt: new Date().toISOString(),
      record,
    };
  },

  async getVideoStatus(userId: string, videoId: string, context?: Partial<CreateAvatarVideoInput>) {
    const apiKey = getApiKey();

    if (!apiKey) {
      const mockUrl = `https://example.com/mock-heygen-video/${videoId}.mp4`;
      const record = await upsertVideoRecord(userId, {
        videoId,
        videoUrl: mockUrl,
        script: context?.script || "Mock HeyGen video",
        avatarId: context?.avatarId,
        voiceId: context?.voiceId,
        aspectRatio: context?.aspectRatio,
        status: "completed",
        title: context?.title,
        description: context?.description,
      });
      return {
        status: "success",
        mock: true,
        videoId,
        jobStatus: "completed",
        videoUrl: mockUrl,
        record,
      };
    }

    const candidates = [
      `${HEYGEN_API_BASE}/v3/videos/${encodeURIComponent(videoId)}`,
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    ];

    let lastError: Error | null = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: { "X-Api-Key": apiKey },
        });
        const data = await parseHeyGenResponse(response, "Khong the lay trang thai video HeyGen");
        const normalized = normalizeStatusPayload(data);

        const record = await upsertVideoRecord(userId, {
          videoId,
          videoUrl: normalized.videoUrl || undefined,
          script: context?.script || "HeyGen avatar video",
          avatarId: context?.avatarId,
          voiceId: context?.voiceId,
          aspectRatio: context?.aspectRatio,
          status: normalized.jobStatus,
          title: context?.title,
          description: context?.description,
        });

        return {
          status: "success",
          mock: false,
          videoId,
          jobStatus: normalized.jobStatus,
          videoUrl: normalized.videoUrl,
          thumbnailUrl: normalized.thumbnailUrl,
          error: normalized.error,
          record,
          raw: data,
        };
      } catch (error: any) {
        lastError = error;
      }
    }

    throw lastError || new Error("Khong the lay trang thai video HeyGen");
  },

  async getVideoHistory(userId: string) {
    return AIMediaModel.find({
      userId,
      mediaType: "video",
      "metadata.provider": "heygen",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  },
};
