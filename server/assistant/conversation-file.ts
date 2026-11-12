import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AuthenticatedRequest } from "../middleware/auth";
import { resolveMediaBinary } from "../modules/marketing-suite/shared/service/media-binary.service";
import { AssistantError } from "./policy";
import { extractSpeechDocument } from "./studio-speech-document";
import { transcribeAudioToText } from "./studio-transcription";

const MAX_TEXT_FILE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const MAX_VIDEO_FRAMES = 4;

export interface AssistantConversationFileContext {
  fileName: string;
  documentContext: { title: string; version: number; content: unknown };
  visualAttachments?: Array<{ fileName: string; dataUrl: string }>;
  fileSummary: string;
}

export function isAssistantConversationFileName(fileName: string): boolean {
  return /\.(?:pdf|docx|txt|png|jpe?g|webp|mp4|mov|webm|m4v)$/i.test(fileName);
}

export function assistantConversationFileFilter(fileName: string, callback: (error: Error | null, acceptFile?: boolean) => void): void {
  if (!isAssistantConversationFileName(fileName)) {
    callback(new Error("Unsupported conversation attachment"));
    return;
  }
  callback(null, true);
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[\\/\u0000-\u001f]/g, "_").slice(-180) || "tep-dinh-kem";
}

function runFfmpeg(input: Buffer | string, args: string[], options: { allowFailure?: boolean; maxOutputBytes?: number } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    const isFilePath = typeof input === "string";
    try {
      child = spawn(resolveMediaBinary("ffmpeg"), ["-hide_banner", "-loglevel", "error", "-i", isFilePath ? input : "pipe:0", ...args], {
        shell: false,
        windowsHide: true,
        stdio: [isFilePath ? "ignore" : "pipe", "pipe", "ignore"],
      });
    } catch {
      reject(new AssistantError("Máy chủ chưa cài FFmpeg để đọc video.", 503));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error, output?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(output || Buffer.alloc(0));
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(new AssistantError("Đọc video mất quá nhiều thời gian. Hãy cắt video ngắn hơn rồi thử lại.", 504));
    }, 90_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > (options.maxOutputBytes || 8 * 1024 * 1024)) {
        child.kill();
        finish(new AssistantError("Dữ liệu trích xuất từ video vượt giới hạn xử lý.", 413));
      } else chunks.push(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => finish(new AssistantError(
      error.code === "ENOENT" ? "Máy chủ chưa cài FFmpeg để đọc video." : "Không thể khởi chạy FFmpeg để đọc video.",
      503,
    )));
    child.on("close", code => {
      if (settled) return;
      const output = Buffer.concat(chunks);
      if (code === 0 || (options.allowFailure && output.length === 0)) finish(undefined, output);
      else finish(new AssistantError("Không đọc được video. Hãy kiểm tra tệp MP4, MOV hoặc WebM rồi thử lại.", 422));
    });
    if (!isFilePath && child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(input);
    }
  });
}

function splitJpegFrames(buffer: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let start = -1;
  for (let index = 0; index < buffer.length - 1; index += 1) {
    if (start < 0 && buffer[index] === 0xff && buffer[index + 1] === 0xd8) start = index;
    else if (start >= 0 && buffer[index] === 0xff && buffer[index + 1] === 0xd9) {
      frames.push(buffer.subarray(start, index + 2));
      start = -1;
      index += 1;
      if (frames.length >= MAX_VIDEO_FRAMES) break;
    }
  }
  return frames;
}

async function readImage(input: { buffer: Buffer; fileName: string }): Promise<AssistantConversationFileContext> {
  let image: Buffer;
  try {
    const metadata = await sharp(input.buffer, { failOn: "error" }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Unsupported image format");
    image = await sharp(input.buffer, { failOn: "error" })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new AssistantError("Ảnh đính kèm không hợp lệ hoặc không đọc được. Hỗ trợ JPG, PNG và WebP.", 422);
  }
  const fileName = safeFileName(input.fileName);
  return {
    fileName,
    fileSummary: `Ảnh ${fileName}`,
    documentContext: { title: fileName, version: 1, content: { type: "uploaded-image", fileName } },
    visualAttachments: [{ fileName, dataUrl: `data:image/jpeg;base64,${image.toString("base64")}` }],
  };
}

async function readVideo(input: { buffer: Buffer; fileName: string; req: AuthenticatedRequest }): Promise<AssistantConversationFileContext> {
  if (input.buffer.length > MAX_VIDEO_FILE_BYTES) throw new AssistantError("Video không được vượt quá 50 MB.", 413);
  const fileName = safeFileName(input.fileName);
  const directory = await mkdtemp(join(tmpdir(), "igen-assistant-video-"));
  const videoPath = join(directory, `${randomUUID()}.${extensionOf(fileName)}`);
  try {
    await writeFile(videoPath, input.buffer, { flag: "wx", mode: 0o600 });
    const framesOutput = await runFfmpeg(videoPath, [
      "-t", String(MAX_VIDEO_SECONDS), "-vf", "fps=1/15,scale=960:960:force_original_aspect_ratio=decrease",
      "-frames:v", String(MAX_VIDEO_FRAMES), "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1",
    ]);
    const frames = splitJpegFrames(framesOutput);
    if (!frames.length) throw new AssistantError("Không trích xuất được khung hình từ video. Hãy kiểm tra định dạng video rồi thử lại.", 422);

    const visualAttachments = frames.map((frame, index) => ({
      fileName: `${fileName} · khung hình ${index + 1}`,
      dataUrl: `data:image/jpeg;base64,${frame.toString("base64")}`,
    }));
    const audio = await runFfmpeg(videoPath, [
      "-t", String(MAX_VIDEO_SECONDS), "-map", "0:a:0?", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1",
    ], { allowFailure: true, maxOutputBytes: 8 * 1024 * 1024 });
    let transcript = "";
    if (audio.length) {
      if (!input.req.user?.companyCode || !input.req.user.id) throw new AssistantError("Cần chọn doanh nghiệp để nhận dạng lời nói trong video.", 403);
      try {
        transcript = await transcribeAudioToText({
          buffer: audio,
          fileName: `${fileName.replace(/\.[^.]+$/, "")}.mp3`,
          companyCode: input.req.user.companyCode,
          userId: input.req.user.id,
        });
      } catch (error) {
        if (!(error instanceof AssistantError) || error.status !== 422) throw error;
      }
    }
    const fileSummary = `Video ${fileName}; đã lấy tối đa ${frames.length} khung hình trong 60 giây đầu${transcript ? " và chép lời phần âm thanh" : "; không nhận được lời nói để chép"}.`;
    return {
      fileName,
      fileSummary,
      documentContext: {
        title: fileName,
        version: 1,
        content: { type: "uploaded-video", fileName, sampledSeconds: MAX_VIDEO_SECONDS, frameCount: frames.length, transcript },
      },
      visualAttachments,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function readAssistantConversationFile(input: { buffer: Buffer; fileName: string; req: AuthenticatedRequest }): Promise<AssistantConversationFileContext> {
  const fileName = safeFileName(input.fileName);
  if (!input.buffer.length) throw new AssistantError("Tệp đính kèm đang trống.", 400);
  const extension = extensionOf(fileName);
  if (["pdf", "docx", "txt"].includes(extension)) {
    if (input.buffer.length > MAX_TEXT_FILE_BYTES) throw new AssistantError("Tệp PDF, DOCX hoặc TXT không được vượt quá 20 MB.", 413);
    const extracted = await extractSpeechDocument({ buffer: input.buffer, fileName });
    return {
      fileName,
      fileSummary: `Tài liệu ${fileName} đã được trích xuất văn bản.`,
      documentContext: { title: fileName, version: 1, content: { type: "uploaded-document", text: extracted.text } },
    };
  }
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return readImage({ buffer: input.buffer, fileName });
  if (["mp4", "mov", "webm", "m4v"].includes(extension)) return readVideo({ buffer: input.buffer, fileName, req: input.req });
  throw new AssistantError("Định dạng tệp này chưa được hỗ trợ trong Trò chuyện.", 415);
}
