import { spawn } from "node:child_process";
import { model, Schema } from "mongoose";
import { resolveMediaBinary } from "../modules/marketing-suite/shared/service/media-binary.service";
import { billAiCall, withAiUsage } from "../modules/marketing-suite/shared/service/ai-subscription.service";
import { AssistantError } from "./policy";

const modelName = process.env.OPENROUTER_CAPTION_STT_MODEL?.trim() || "openai/whisper-large-v3";
const maxProviderBytes = 20_000_000;

function hasMp3Signature(input: Buffer): boolean {
  if (input.subarray(0, 3).toString("ascii") === "ID3") return true;
  const searchEnd = Math.min(input.length - 1, 4096);
  for (let index = 0; index < searchEnd; index += 1) {
    if (input[index] === 0xff && (input[index + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

function hasSupportedAudioSignature(input: Buffer): boolean {
  return hasMp3Signature(input)
    || (input.length >= 12 && input.subarray(0, 4).toString("ascii") === "RIFF" && input.subarray(8, 12).toString("ascii") === "WAVE")
    || input.subarray(0, 4).toString("ascii") === "fLaC"
    || input.subarray(0, 4).toString("ascii") === "OggS"
    || (input.length >= 12 && input.subarray(4, 8).toString("ascii") === "ftyp");
}

const transcriptSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
transcriptSchema.index({ companyCode: 1, userId: 1, createdAt: -1 });
const Transcript = model("AssistantStudioTranscript", transcriptSchema);

export function normalizeStudioAudio(input: Buffer, fileName = ""): Promise<Buffer> {
  if (!hasSupportedAudioSignature(input)) return Promise.reject(new AssistantError("Tệp không chứa âm thanh hợp lệ hoặc sai định dạng.", 422));
  if (/\.mp3$/i.test(fileName) && hasMp3Signature(input) && input.length <= maxProviderBytes) return Promise.resolve(input);

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
    child.on("error", (error: NodeJS.ErrnoException) => finish(new AssistantError(
      error.code === "ENOENT"
        ? "Máy chủ chưa cài ffmpeg để chuyển đổi tệp âm thanh này. Hãy dùng MP3 dưới 20 MB hoặc cài ffmpeg."
        : "Không thể khởi chạy ffmpeg để xử lý âm thanh.",
      503,
    )));
    child.on("close", (code) => finish(code === 0 && size > 0 ? undefined : new AssistantError("Tệp không chứa âm thanh hợp lệ.", 422)));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

export async function transcribeAudioToText(input: { buffer: Buffer; fileName: string; companyCode: string; userId: string }): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  const audio = await normalizeStudioAudio(input.buffer, input.fileName);
  return withAiUsage({ companyCode: input.companyCode, userId: input.userId }, () => billAiCall("speech", modelName, async () => {
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
}

export async function transcribeStudioAudio(input: { buffer: Buffer; fileName: string; companyCode: string; userId: string }) {
  const text = await transcribeAudioToText(input);
  const saved = await Transcript.create({ companyCode: input.companyCode, userId: input.userId, fileName: input.fileName, text });
  return { id: String(saved._id), fileName: saved.fileName, text: saved.text, createdAt: saved.createdAt };
}

export async function listStudioTranscripts(companyCode: string, userId: string) {
  const items = await Transcript.find({ companyCode, userId }).sort({ createdAt: -1 }).limit(30).select("fileName text createdAt").lean();
  return items.map((item) => ({ id: String(item._id), fileName: item.fileName, text: item.text, createdAt: item.createdAt }));
}
