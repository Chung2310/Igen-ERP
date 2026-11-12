import { AssistantError } from "./policy";
import { defaultAssistantSpeechVoice, isAssistantSpeechVoice, type AssistantSpeechVoice } from "../../src/shared/assistant-speech-voices";
import type { AssistantSpeechControls } from "../../src/shared/assistant-speech";

const SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
const SPEECH_MODEL = "elevenlabs/eleven-flash-v2.5";
const MAX_AUDIO_BYTES = 20_000_000;

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

export async function synthesizeVietnameseSpeech(text: string, signal?: AbortSignal, voice?: AssistantSpeechVoice, controls?: AssistantSpeechControls): Promise<Buffer> {
  const rawInput = text.trim();
  const input = controls ? applySpeechControls(rawInput, controls) : rawInput;
  if (!input) throw new AssistantError("Không có nội dung để đọc thành tiếng.");
  const selectedVoice = voice || process.env.OPENROUTER_TTS_VOICE?.trim() || defaultAssistantSpeechVoice;
  if (!isAssistantSpeechVoice(selectedVoice)) throw new AssistantError("Giọng đọc đã chọn không hợp lệ.");
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new AssistantError("OpenRouter chưa được cấu hình trên máy chủ.", 503);

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
        voice: selectedVoice,
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
    if (response.status === 402) throw new AssistantError("Tài khoản OpenRouter không đủ số dư để tạo giọng nói.", 402);
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
