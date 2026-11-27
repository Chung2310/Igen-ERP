import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { model, Schema } from "mongoose";
import { resolveMediaBinary } from "../modules/marketing-suite/shared/service/media-binary.service";
import { billAiCall, withAiUsage } from "../modules/marketing-suite/shared/service/ai-subscription.service";
import { AssistantError } from "./policy";
import { AI_PROVIDER_TEMPORARY_ERROR } from "../../src/shared/ai-provider-error";

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

function detectDirectAudioFormat(input: Buffer, fileName = ""): "mp3" | "wav" | "m4a" | "flac" | "ogg" | "webm" | null {
  if (input.length >= 12 && input.subarray(0, 4).toString("ascii") === "RIFF" && input.subarray(8, 12).toString("ascii") === "WAVE") return "wav";
  if (input.subarray(0, 4).toString("ascii") === "fLaC") return "flac";
  if (input.subarray(0, 4).toString("ascii") === "OggS") return "ogg";
  if (input.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
  if (input.length >= 12 && input.subarray(4, 8).toString("ascii") === "ftyp") return "m4a";
  if (hasMp3Signature(input) || /\.mp3$/i.test(fileName)) return "mp3";
  return null;
}

function hasSupportedAudioSignature(input: Buffer): boolean {
  return hasMp3Signature(input)
    || (input.length >= 12 && input.subarray(0, 4).toString("ascii") === "RIFF" && input.subarray(8, 12).toString("ascii") === "WAVE")
    || input.subarray(0, 4).toString("ascii") === "fLaC"
    || input.subarray(0, 4).toString("ascii") === "OggS"
    || input.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
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

export async function normalizeStudioAudio(input: Buffer, fileName = ""): Promise<Buffer> {
  if (!hasSupportedAudioSignature(input)) throw new AssistantError("Tệp không chứa âm thanh hợp lệ hoặc sai định dạng.", 422);
  if (/\.mp3$/i.test(fileName) && detectDirectAudioFormat(input, fileName) === "mp3" && input.length <= maxProviderBytes) return input;

  const safeExt = /^\.[a-z0-9]{1,8}$/i.test(extname(fileName)) ? extname(fileName).toLowerCase() : ".audio";
  const tempPath = join(tmpdir(), `igen-stt-${randomUUID()}${safeExt}`);
  await writeFile(tempPath, input);

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(resolveMediaBinary("ffmpeg"), ["-hide_banner", "-loglevel", "error", "-i", tempPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "40k", "-f", "mp3", "pipe:1"], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
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
          ? "Giới hạn tải lên là 50 MB. Máy chủ chưa cài ffmpeg để chuyển đổi tệp này nên hiện chỉ xử lý được MP3 tối đa 20 MB. Hãy dùng MP3 tối đa 20 MB hoặc cài ffmpeg trên máy chủ."
          : "Không thể khởi chạy ffmpeg để xử lý âm thanh.",
        503,
      )));
      child.on("close", (code) => finish(code === 0 && size > 0 ? undefined : new AssistantError("Tệp không chứa âm thanh hợp lệ.", 422)));
    });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

export async function prepareStudioAudioForProvider(input: Buffer, fileName = ""): Promise<{ audio: Buffer; format: string }> {
  if (!hasSupportedAudioSignature(input)) throw new AssistantError("Tệp không chứa âm thanh hợp lệ hoặc sai định dạng.", 422);
  if (/\.mp3$/i.test(fileName) && detectDirectAudioFormat(input, fileName) === "mp3" && input.length <= maxProviderBytes) return { audio: input, format: "mp3" };
  try {
    return { audio: await normalizeStudioAudio(input, fileName), format: "mp3" };
  } catch (error) {
    const directFormat = input.length <= maxProviderBytes ? detectDirectAudioFormat(input, fileName) : null;
    if (error instanceof AssistantError && error.status === 503 && directFormat) {
      return { audio: input, format: directFormat };
    }
    throw error;
  }
}

function isWavBuffer(input: Buffer): boolean {
  return input.length >= 12 && input.subarray(0, 4).toString("ascii") === "RIFF" && input.subarray(8, 12).toString("ascii") === "WAVE";
}

function convertAudioToWav(input: Buffer): Promise<Buffer> {
  if (isWavBuffer(input)) return Promise.resolve(input);
  return new Promise((resolve, reject) => {
    const child = spawn(resolveMediaBinary("ffmpeg"), ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
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
    const timeout = setTimeout(() => { child.kill(); finish(new AssistantError("Chuyển đổi âm thanh sang WAV quá thời gian cho phép.", 504)); }, 120_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 100_000_000) { child.kill(); finish(new AssistantError("Tệp âm thanh quá dài để xử lý trong một lần.", 413)); }
      else chunks.push(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => finish(new AssistantError(
      error.code === "ENOENT"
        ? "Vbee STT yêu cầu tệp WAV và máy chủ chưa cài ffmpeg để tự động chuyển đổi. Hãy tải lên tệp .wav hoặc cài ffmpeg."
        : "Không thể khởi chạy ffmpeg để chuyển đổi tệp sang WAV.",
      503,
    )));
    child.on("close", (code) => finish(code === 0 && size > 0 ? undefined : new AssistantError("Tệp không chứa âm thanh hợp lệ.", 422)));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

async function transcribeWithVbee(input: { buffer: Buffer; fileName: string; companyCode: string; userId: string }, appId: string, token: string): Promise<string> {
  if (!hasSupportedAudioSignature(input.buffer)) throw new AssistantError("Tệp không chứa âm thanh hợp lệ hoặc sai định dạng.", 422);
  const wavBuffer = await convertAudioToWav(input.buffer);
  const wavFileName = input.fileName.replace(/\.[^.]+$/, "") + ".wav";
  return withAiUsage({ companyCode: input.companyCode, userId: input.userId }, () => billAiCall("speech", "vbee-stt", async () => {
    const form = new FormData();
    form.append("audioContent", new Blob([new Uint8Array(wavBuffer)], { type: "audio/wav" }), wavFileName);
    const submitResponse = await fetch("https://api.vbee.vn/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "App-ID": appId },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!submitResponse.ok) {
      const detail = await submitResponse.text().catch(() => "");
      console.error("[assistant stt] Vbee submit error", submitResponse.status, detail);
      throw new AssistantError(`Vbee STT trả về lỗi ${submitResponse.status}.`, submitResponse.status === 429 ? 429 : 502);
    }
    const submitted = await submitResponse.json() as { transcriptId?: string; status?: string; transcript?: string };
    if (submitted.transcript?.trim()) return submitted.transcript.trim();
    const transcriptId = submitted.transcriptId?.trim();
    if (!transcriptId) throw new AssistantError("Vbee STT không trả về mã phiên nhận dạng.", 502);

    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`https://api.vbee.vn/v1/stt/transcripts/${encodeURIComponent(transcriptId)}`, {
        headers: { Authorization: `Bearer ${token}`, "App-ID": appId },
        signal: AbortSignal.timeout(30_000),
      });
      if (!pollResponse.ok) continue;
      const poll = await pollResponse.json() as {
        status?: string;
        transcript?: string;
        utterances?: Array<{ text?: string }>;
        error?: { message?: string };
      };
      const status = String(poll.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "SUCCESS") {
        const text = poll.transcript?.trim() || poll.utterances?.map((u) => u.text?.trim()).filter(Boolean).join(" ").trim() || "";
        if (!text) throw new AssistantError("Không nhận dạng được lời nói trong tệp âm thanh.", 422);
        return text;
      }
      if (status === "FAILED" || status === "ERROR") {
        throw new AssistantError(poll.error?.message || "Vbee STT không thể nhận dạng tệp âm thanh này.", 502);
      }
    }
    throw new AssistantError("Nhận dạng âm thanh trên Vbee quá thời gian chờ.", 504);
  }));
}

export async function transcribeAudioToText(input: { buffer: Buffer; fileName: string; companyCode: string; userId: string }): Promise<string> {
  const vbeeAppId = process.env.VBEE_APP_ID?.trim();
  const vbeeToken = process.env.VBEE_API_TOKEN?.trim();
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (vbeeAppId && vbeeToken) {
    try {
      return await transcribeWithVbee(input, vbeeAppId, vbeeToken);
    } catch (error) {
      if (key) {
        console.warn("[assistant stt] Vbee STT failed, falling back to OpenRouter:", error instanceof Error ? error.message : error);
      } else {
        throw error;
      }
    }
  }
  if (!key) throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  const { audio, format } = await prepareStudioAudioForProvider(input.buffer, input.fileName);
  return withAiUsage({ companyCode: input.companyCode, userId: input.userId }, () => billAiCall("speech", modelName, async () => {
    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, input_audio: { data: audio.toString("base64"), format }, language: "vi", response_format: "json" }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new AssistantError(response.status === 402 ? AI_PROVIDER_TEMPORARY_ERROR : `Dịch vụ nhận dạng âm thanh trả về lỗi ${response.status}.`, response.status === 429 ? 429 : 502);
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
