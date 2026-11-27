import { AssistantError } from "./policy";
import { AI_PROVIDER_TEMPORARY_ERROR } from "../../src/shared/ai-provider-error";
import {
  assistantSpeechVoiceProfiles,
  assistantSpeechVoices,
  defaultAssistantSpeechVoice,
  getPortraitIndexForGender,
  isAssistantSpeechVoice,
  type AssistantSpeechVoice,
  type AssistantSpeechVoiceOption,
} from "../../src/shared/assistant-speech-voices";
import type { AssistantSpeechControls } from "../../src/shared/assistant-speech";

const SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
const SPEECH_MODEL = "elevenlabs/eleven-flash-v2.5";
const VBEE_TTS_URL = "https://vbee.vn/api/v1/tts";
const VBEE_VOICES_URL = "https://vbee.vn/api/public/v1/voices?voice_ownership=VBEE&language_code=vi-VN&limit=100";
const MAX_AUDIO_BYTES = 20_000_000;
const VOICE_CACHE_TTL_MS = 10 * 60 * 1000;

const LEGACY_TO_VBEE_VOICE_MAP: Record<string, string> = {
  sarah: "hn_female_ngochuyen_full_48k-fhg",
  george: "hn_male_manhdung_news_48k-fhg",
  adam: "sg_male_trungkien_vdts_48k-fhg",
  alice: "sg_female_lantrinh_vdts_48k-fhg",
  bella: "hue_female_huonggiang_full_48k-fhg",
  bill: "hue_male_duyphuong_full_48k-fhg",
  brian: "sg_male_minhhoang_full_48k-fhg",
  callum: "hn_male_phuthang_news65dt_44k-fhg",
  charlie: "sg_male_chidat_ebook_48k-phg",
  chris: "hn_male_minhquan_yt-stable",
  daniel: "sg_male_anhtu_yt_24k-pre",
  eric: "hn_male_manhdung_full_24k-st",
  harry: "hn_male_thanhlong_talk_48k-fhg",
  jessica: "sg_female_thaotrinh_full_48k-fhg",
  laura: "sg_female_tuongvy_call_44k-fhg",
  liam: "hn_male_minhquan_yt_24k-pre",
  lily: "hn_female_hermer_stor_48k-fhg",
  matilda: "hn_female_maiphuong_vdts_48k-fhg",
  river: "hn_female_ngochuyen_full_24k-st",
  roger: "hn_male_quochuy_yt_24k-pre",
  will: "hn_male_thanhlong_talk_24k-stl",
};

let cachedVbeeVoices: { expiresAt: number; voices: AssistantSpeechVoiceOption[] } | null = null;

export async function listSpeechVoices(): Promise<{
  provider: "vbee" | "openrouter";
  voices: AssistantSpeechVoiceOption[];
}> {
  const appId = process.env.VBEE_APP_ID?.trim();
  const token = process.env.VBEE_API_TOKEN?.trim();
  if (appId && token) {
    if (cachedVbeeVoices && cachedVbeeVoices.expiresAt > Date.now() && cachedVbeeVoices.voices.length > 0) {
      return { provider: "vbee", voices: cachedVbeeVoices.voices };
    }
    try {
      const response = await fetch(VBEE_VOICES_URL, {
        headers: { Authorization: `Bearer ${token}`, "App-Id": appId },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const payload = await response.json() as {
          status?: number;
          result?: {
            voices?: Array<{ code?: string; name?: string; gender?: string; demo?: string }>;
          };
        };
        const rawVoices = payload.result?.voices ?? [];
        let femaleCount = 0;
        let maleCount = 0;
        const seenNames = new Set<string>();
        const mapped: AssistantSpeechVoiceOption[] = rawVoices
          .filter((v): v is { code: string; name: string; gender?: string; demo?: string } => {
            const code = v.code?.trim();
            const name = v.name?.trim();
            if (!code || !name) return false;
            if (/\bbeta\b/i.test(name)) return false;
            const key = name.toLowerCase();
            if (seenNames.has(key)) return false;
            seenNames.add(key);
            return true;
          })
          .map((v) => {
            const gender: "Nam" | "Nữ" = String(v.gender || "").toLowerCase() === "male" ? "Nam" : "Nữ";
            const portraitIndex = gender === "Nữ"
              ? getPortraitIndexForGender("Nữ", femaleCount++)
              : getPortraitIndexForGender("Nam", maleCount++);
            return {
              id: v.code.trim(),
              name: v.name.trim(),
              gender,
              portraitIndex,
              ...(v.demo?.trim() ? { demoUrl: v.demo.trim() } : {}),
              provider: "vbee" as const,
            };
          });
        if (mapped.length > 0) {
          cachedVbeeVoices = { expiresAt: Date.now() + VOICE_CACHE_TTL_MS, voices: mapped };
          return { provider: "vbee", voices: mapped };
        }
      } else {
        console.warn("[assistant speech] Vbee voices API returned HTTP", response.status);
      }
    } catch (error) {
      console.warn("[assistant speech] Failed to fetch Vbee voices, falling back to OpenRouter:", error);
    }
  }
  return { provider: "openrouter", voices: [...assistantSpeechVoiceProfiles] };
}

function pauseTag(seconds: number): string {
  return seconds > 0 ? `<break time="${Number(seconds.toFixed(2))}s" />` : "";
}

function applySpeechControls(text: string, controls: AssistantSpeechControls): string {
  const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n?/g, "\n");
  return safeText
    .replace(/\.(?=\s|$)/g, (period) => `${period}${pauseTag(controls.pausePeriod)}`)
    .replace(/,(?=\s|$)/g, (comma) => `${comma}${pauseTag(controls.pauseComma)}`)
    .replace(/;(?=\s|$)/g, (semicolon) => `${semicolon}${pauseTag(controls.pauseSemicolon)}`)
    .replace(/\n/g, pauseTag(controls.pauseNewline));
}

function resolveVbeeVoiceCode(voice: string): string {
  return LEGACY_TO_VBEE_VOICE_MAP[voice] || voice;
}

function resolveOpenRouterFallbackVoice(voice: string): string {
  if (assistantSpeechVoices.includes(voice)) return voice;
  if (voice.toLowerCase().includes("_male_")) return "george";
  return defaultAssistantSpeechVoice;
}

async function synthesizeWithVbee(
  text: string,
  voice: AssistantSpeechVoice,
  appId: string,
  token: string,
  signal?: AbortSignal,
  controls?: AssistantSpeechControls,
): Promise<Buffer> {
  const speedRate = controls ? Math.min(2.0, Math.max(0.5, Number(controls.speed) || 1.0)) : 1.0;
  let response: Response;
  try {
    response = await fetch(VBEE_TTS_URL, {
      method: "POST",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        response_type: "direct",
        voice_code: resolveVbeeVoiceCode(voice),
        input_text: text,
        audio_type: "mp3",
        bitrate: 128,
        speed_rate: speedRate,
      }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AssistantError("Không kết nối được dịch vụ tạo giọng nói Vbee.", 503);
  }

  if (!response.ok) {
    throw new AssistantError(`Vbee TTS trả về lỗi HTTP ${response.status}.`, response.status === 429 ? 429 : 503);
  }

  const payload = await response.json() as {
    status?: number;
    error_message?: string;
    result?: { audio_link?: string; status?: string; request_id?: string };
  };
  let audioLink = payload.result?.audio_link?.trim();

  if (!audioLink && payload.result?.request_id) {
    const requestId = payload.result.request_id;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (signal?.aborted) throw new Error("Aborted");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const poll = await fetch(`${VBEE_TTS_URL}/${encodeURIComponent(requestId)}`, {
        headers: { Authorization: `Bearer ${token}`, "App-Id": appId },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      });
      if (!poll.ok) continue;
      const pollData = await poll.json() as { result?: { audio_link?: string; status?: string } };
      if (pollData.result?.audio_link?.trim()) {
        audioLink = pollData.result.audio_link.trim();
        break;
      }
      if (pollData.result?.status === "FAILURE" || pollData.result?.status === "FAILED") {
        break;
      }
    }
  }

  if (!audioLink) {
    throw new AssistantError(payload.error_message || "Vbee không trả về đường dẫn âm thanh hợp lệ.", 502);
  }

  const audioResponse = await fetch(audioLink, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
  });
  if (!audioResponse.ok) {
    throw new AssistantError("Không tải được tệp âm thanh từ Vbee.", 502);
  }
  const contentLength = Number(audioResponse.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES) throw new AssistantError("Tệp âm thanh vượt quá dung lượng cho phép.", 502);
  const audio = Buffer.from(await audioResponse.arrayBuffer());
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new AssistantError("Tệp âm thanh trả về không hợp lệ.", 502);
  return audio;
}

async function synthesizeWithOpenRouter(
  rawInput: string,
  selectedVoice: AssistantSpeechVoice,
  apiKey: string,
  signal?: AbortSignal,
  controls?: AssistantSpeechControls,
): Promise<Buffer> {
  const input = controls ? applySpeechControls(rawInput, controls) : rawInput;
  const fallbackVoice = resolveOpenRouterFallbackVoice(selectedVoice);

  let response: Response;
  try {
    response = await fetch(SPEECH_URL, {
      method: "POST",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        input,
        voice: fallbackVoice,
        response_format: "mp3",
        provider: { options: { elevenlabs: { language_code: "vi", ...(controls ? { voice_settings: { speed: controls.speed } } : {}) } } },
      }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("[assistant speech] OpenRouter request failed", error);
    throw new AssistantError("Không kết nối được dịch vụ tạo giọng nói. Hãy thử lại sau.", 503);
  }

  if (!response.ok) {
    console.error("[assistant speech] OpenRouter returned HTTP", response.status);
    if (response.status === 402) throw new AssistantError(AI_PROVIDER_TEMPORARY_ERROR, 503);
    if (response.status === 429) throw new AssistantError("Dịch vụ tạo giọng nói đang quá tải. Hãy thử lại sau.", 429);
    throw new AssistantError("OpenRouter không tạo được giọng nói. Hãy kiểm tra khóa API và giọng đã chọn.", 503);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mimeType !== "audio/mpeg" && mimeType !== "audio/mp3" && mimeType !== "application/octet-stream") {
    throw new AssistantError("OpenRouter không trả về tệp âm thanh MP3 hợp lệ.", 502);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES) throw new AssistantError("Tệp âm thanh vượt quá dung lượng cho phép.", 502);
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new AssistantError("Tệp âm thanh trả về không hợp lệ.", 502);
  return audio;
}

export async function synthesizeVietnameseSpeech(text: string, signal?: AbortSignal, voice?: AssistantSpeechVoice, controls?: AssistantSpeechControls): Promise<Buffer> {
  const rawInput = text.trim();
  if (!rawInput) throw new AssistantError("Không có nội dung để đọc thành tiếng.");
  const selectedVoice = voice || process.env.OPENROUTER_TTS_VOICE?.trim() || defaultAssistantSpeechVoice;
  if (!isAssistantSpeechVoice(selectedVoice)) throw new AssistantError("Giọng đọc đã chọn không hợp lệ.");

  const vbeeAppId = process.env.VBEE_APP_ID?.trim();
  const vbeeToken = process.env.VBEE_API_TOKEN?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();

  if (vbeeAppId && vbeeToken) {
    try {
      return await synthesizeWithVbee(rawInput, selectedVoice, vbeeAppId, vbeeToken, signal, controls);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (openRouterKey) {
        console.warn("[assistant speech] Vbee TTS failed, falling back to OpenRouter:", error instanceof Error ? error.message : error);
        return synthesizeWithOpenRouter(rawInput, selectedVoice, openRouterKey, signal, controls);
      }
      throw error;
    }
  }

  if (!openRouterKey) throw new AssistantError("OpenRouter chưa được cấu hình trên máy chủ.", 503);
  return synthesizeWithOpenRouter(rawInput, selectedVoice, openRouterKey, signal, controls);
}
