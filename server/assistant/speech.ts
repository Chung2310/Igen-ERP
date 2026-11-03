import jwt from "jsonwebtoken";
import { AssistantError } from "./policy";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const VOICE_NAME = "vi-VN-Neural2-A";
const MAX_SYNTHESIS_BYTES = 4500;
const MAX_TOTAL_TEXT_BYTES = 60_000;

let cachedToken: { key: string; value: string; expiresAt: number } | null = null;

function credentials() {
  const projectId = String(process.env.GOOGLE_CLOUD_TTS_PROJECT_ID || process.env.GOOGLE_SHEETS_PROJECT_ID || "").trim();
  const email = String(process.env.GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_CLOUD_TTS_PRIVATE_KEY || process.env.GOOGLE_SHEETS_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!projectId || !email || !privateKey) {
    throw new AssistantError("Google Cloud Text-to-Speech chưa được cấu hình trên máy chủ.", 503);
  }
  return { projectId, email, privateKey };
}

function splitText(text: string): string[] {
  let remaining = text.trim();
  const chunks: string[] = [];
  if (!remaining) throw new AssistantError("Không có nội dung để đọc thành tiếng.");
  if (Buffer.byteLength(remaining, "utf8") > MAX_TOTAL_TEXT_BYTES) {
    throw new AssistantError("Câu trả lời quá dài để đọc thành tiếng.", 413);
  }

  while (remaining) {
    let end = 0;
    let boundary = 0;
    let bytes = 0;
    for (const character of remaining) {
      const characterBytes = Buffer.byteLength(character, "utf8");
      if (bytes + characterBytes > MAX_SYNTHESIS_BYTES) break;
      bytes += characterBytes;
      end += character.length;
      if (/[.!?;:\n\s]/u.test(character)) boundary = end;
    }
    if (!end) throw new AssistantError("Không thể chia nội dung thành đoạn đọc phù hợp.");
    const chunkEnd = end < remaining.length && boundary > 0 ? boundary : end;
    chunks.push(remaining.slice(0, chunkEnd).trim());
    remaining = remaining.slice(chunkEnd).trimStart();
  }
  return chunks.filter(Boolean);
}

async function accessToken() {
  const { projectId, email, privateKey } = credentials();
  const cacheKey = `${projectId}:${email}`;
  if (cachedToken?.key === cacheKey && cachedToken.expiresAt > Date.now() + 60_000) return { projectId, token: cachedToken.value };

  const assertion = jwt.sign({ scope: CLOUD_PLATFORM_SCOPE }, privateKey, {
    algorithm: "RS256",
    issuer: email,
    audience: TOKEN_URL,
    expiresIn: "1h",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    console.error("[assistant speech] Google OAuth token request failed", response.status, result.error_description);
    throw new AssistantError("Không xác thực được tài khoản Google Cloud Text-to-Speech trên máy chủ.", 503);
  }
  cachedToken = { key: cacheKey, value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return { projectId, token: result.access_token };
}

async function synthesizeChunk(text: string, token: string, projectId: string): Promise<string> {
  const response = await fetch(TTS_URL, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": projectId,
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "vi-VN", name: VOICE_NAME },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1 },
    }),
  });
  const result = await response.json().catch(() => ({})) as { audioContent?: string; error?: { message?: string } };
  if (!response.ok || !result.audioContent) {
    console.error("[assistant speech] Google Cloud TTS request failed", response.status, result.error?.message);
    throw new AssistantError(`Google Cloud Text-to-Speech không xử lý được yêu cầu (HTTP ${response.status}). Kiểm tra API, billing và quyền tài khoản dịch vụ.`, 503);
  }
  return result.audioContent;
}

export async function synthesizeVietnameseSpeech(text: string) {
  const chunks = splitText(text);
  const { projectId, token } = await accessToken();
  const audioChunks = await Promise.all(chunks.map(chunk => synthesizeChunk(chunk, token, projectId)));
  return { audioChunks, mimeType: "audio/mpeg" as const };
}
