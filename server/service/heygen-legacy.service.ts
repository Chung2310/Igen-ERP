import {
  requestHeyGenJson,
  upsertVideoRecord,
  getHeyGenAccessContext,
  parseHeyGenResponse,
  HeyGenApiError,
  CreateAvatarVideoInput
} from "./heygen.service";

const HEYGEN_API_BASE = "https://api.heygen.com";

export const heygenLegacyService = {
  async generateLegacyVideo(userId: string, input: CreateAvatarVideoInput) {
    const accessContext = await getHeyGenAccessContext(userId);
    const apiKey = accessContext.apiKey || process.env.HEYGEN_API_KEY?.trim() || "";
    if (!apiKey) {
      throw new Error("Chưa cấu hình khóa API HeyGen");
    }

    const { avatarId, voiceId, inputText, aspectRatio, title, description } = input;

    if (!avatarId?.trim()) {
      throw new HeyGenApiError("Vui lòng chọn avatar HeyGen trước khi tạo video.", 400);
    }

    if (!inputText?.trim()) {
      throw new HeyGenApiError("Vui lòng nhập kịch bản phát thanh cho Avatar III.", 400);
    }

    if (!voiceId?.trim()) {
      throw new HeyGenApiError("Vui lòng chọn giọng nói HeyGen cho Avatar III.", 400);
    }

    let width = 1280;
    let height = 720;
    if (aspectRatio === "9:16") {
      width = 720;
      height = 1280;
    } else if (aspectRatio === "1:1") {
      width = 720;
      height = 720;
    }

    const requestBody = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: inputText.trim(),
            voice_id: voiceId.trim(),
          },
        },
      ],
      dimension: {
        width,
        height,
      },
    };

    const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await parseHeyGenResponse(response, "Không thể tạo video với API v2");
    const videoId = data?.data?.video_id || data?.video_id || data?.id;

    if (!videoId) {
      throw new Error("HeyGen API v2 không trả về video_id");
    }

    const record = await upsertVideoRecord(userId, {
      videoId,
      script: inputText.trim(),
      avatarId,
      voiceId,
      aspectRatio,
      status: data?.data?.status || data?.status || "processing",
      title: title || "Video Avatar III",
      description: description || "Tạo từ kịch bản văn bản",
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

  async getLegacyStatus(videoId: string, apiKey: string) {
    const data = await requestHeyGenJson(
      `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      undefined,
      apiKey
    );
    return data;
  }
};
