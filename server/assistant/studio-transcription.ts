import { spawn } from "node:child_process";
import { model, Schema } from "mongoose";
import { resolveMediaBinary } from "../modules/marketing-suite/shared/service/media-binary.service";
import { billAiCall, withAiUsage } from "../modules/marketing-suite/shared/service/ai-subscription.service";
import { AssistantError } from "./policy";

const modelName = process.env.OPENROUTER_CAPTION_STT_MODEL?.trim() || "openai/whisper-large-v3";
const maxProviderBytes = 20_000_000;

const transcriptSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
transcriptSchema.index({ companyCode: 1, userId: 1, createdAt: -1 });
const Transcript = model("AssistantStudioTranscript", transcriptSchema);

export function normalizeStudioAudio(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveMediaBinary("ffmpeg"), ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(Buffer.concat(chunks));
    };
    const timeout = setTimeout(() => { child.kill(); finish(new AssistantError("Xử lý âm thanh quá thời gian cho phép.", 504)); }, 120_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxProviderBytes) { child.kill(); finish(new AssistantError("Tệp âm thanh quá dài để xử lý trong một lần.", 413)); }
      else chunks.push(chunk);
    });
    child.on("error", () => finish(new AssistantError("Máy chủ chưa sẵn sàng xử lý âm thanh.", 503)));
    child.on("close", (code) => finish(code === 0 && size > 0 ? undefined : new AssistantError("Tệp không chứa âm thanh hợp lệ.", 422)));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

export async function transcribeStudioAudio(input: { buffer: Buffer; fileName: string; companyCode: string; userId: string }) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  const audio = await normalizeStudioAudio(input.buffer);
  const text = await withAiUsage({ companyCode: input.companyCode, userId: input.userId }, () => billAiCall("speech", modelName, async () => {
    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, input_audio: { data: audio.toString("base64"), format: "mp3" }, language: "vi", response_format: "json" }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new AssistantError(response.status === 402 ? "Tài khoản OpenRouter không đủ số dư." : `Dịch vụ nhận dạng âm thanh trả về lỗi ${response.status}.`, response.status === 429 ? 429 : 502);
    const payload = await response.json() as { text?: string };
    if (!payload.text?.trim()) throw new AssistantError("Không nhận dạng được lời nói trong tệp âm thanh.", 422);
    return payload.text.trim();
  }));
  const saved = await Transcript.create({ companyCode: input.companyCode, userId: input.userId, fileName: input.fileName, text });
  return { id: String(saved._id), fileName: saved.fileName, text: saved.text, createdAt: saved.createdAt };
}

export async function listStudioTranscripts(companyCode: string, userId: string) {
  const items = await Transcript.find({ companyCode, userId }).sort({ createdAt: -1 }).limit(30).select("fileName text createdAt").lean();
  return items.map((item) => ({ id: String(item._id), fileName: item.fileName, text: item.text, createdAt: item.createdAt }));
}
