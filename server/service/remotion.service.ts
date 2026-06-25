import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { cloudinaryService } from "./cloudinary.service";

type RemotionRendererModule = typeof import("@remotion/renderer");
type RemotionBundlerModule = typeof import("@remotion/bundler");

async function loadRemotionDependencies(): Promise<{
  bundler: RemotionBundlerModule;
  renderer: RemotionRendererModule;
}> {
  try {
    const [bundler, renderer] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);

    return { bundler, renderer };
  } catch (error: any) {
    const wrappedError: any = new Error(
      "Tính năng tạo video Remotion chưa sẵn sàng trên máy này. Hãy cài đặt đầy đủ các gói Remotion trước khi sử dụng."
    );
    wrappedError.statusCode = 503;
    wrappedError.cause = error;
    throw wrappedError;
  }
}

export const remotionService = {
  /**
   * Render video bang Remotion tren server
   */
  async renderVideo(
    blueprint: any,
    options?: {
      aspectRatio?: string;
      resolution?: string;
    },
    onProgress?: (progress: number, logMessage?: string) => void
  ): Promise<string> {
    const renderJobId = `render_${Date.now()}`;
    const entryPoint = path.join(process.cwd(), "server/remotion/entry.tsx");
    const outputPath = path.join(os.tmpdir(), `remotion_out_${Date.now()}.mp4`);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Remotion] ▶ BẤT ĐẦU RENDER | Job: ${renderJobId}`);
    console.log(`[Remotion] EntryPoint : ${entryPoint} | Tồn tại: ${fs.existsSync(entryPoint)}`);
    console.log(`[Remotion] OutputPath : ${outputPath}`);
    console.log(`[Remotion] Options    : aspect=${options?.aspectRatio || "16:9"}, res=${options?.resolution || "720p"}`);

    // Log tất cả URLs media trong blueprint để phát hiện nguồn gây 403
    const timeline = blueprint?.timeline || [];
    const videoUrls = timeline.filter((t: any) => t.type === "video").map((t: any) => t.src);
    const audioUrls = timeline.filter((t: any) => t.type === "audio").map((t: any) => t.src);
    const imageUrls = timeline.filter((t: any) => t.type === "image").map((t: any) => t.src);

    console.log(`[Remotion] Blueprint timeline: ${timeline.length} items`);
    console.log(`[Remotion] Video URLs (${videoUrls.length}):`);
    videoUrls.forEach((url: string, i: number) => console.log(`  [${i + 1}] ${url || "(EMPTY)"}`));
    console.log(`[Remotion] Audio URLs (${audioUrls.length}):`);
    audioUrls.forEach((url: string, i: number) => console.log(`  [${i + 1}] ${url || "(EMPTY)"}`));
    console.log(`[Remotion] Image URLs (${imageUrls.length}):`);
    imageUrls.forEach((url: string, i: number) => console.log(`  [${i + 1}] ${url || "(EMPTY)"}`));

    // Kiểm tra trước (preflight) tất cả media URLs — phát hiện 403 trước khi Chromium render
    const allMediaUrls = [...videoUrls, ...audioUrls, ...imageUrls].filter(Boolean);
    if (allMediaUrls.length > 0) {
      console.log(`[Remotion] Kiểm tra trước (preflight) ${allMediaUrls.length} media URLs...`);
      for (const mediaUrl of allMediaUrls) {
        if (!mediaUrl.startsWith("http")) {
          console.log(`  [SKIP] URL nội bộ/tương đối: ${mediaUrl}`);
          continue;
        }
        try {
          const headRes = await fetch(mediaUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(8000),
          });
          const status = headRes.status;
          const contentType = headRes.headers.get("content-type") || "unknown";
          const corsHeader = headRes.headers.get("access-control-allow-origin") || "(không có)";
          const corpHeader = headRes.headers.get("cross-origin-resource-policy") || "(không có)";
          if (status >= 400) {
            console.error(`  [❌ HTTP ${status}] ${mediaUrl}`);
            console.error(`    Content-Type : ${contentType}`);
            console.error(`    CORS header  : ${corsHeader}`);
            console.error(`    CORP header  : ${corpHeader}`);
          } else {
            console.log(`  [✅ HTTP ${status}] ${mediaUrl}`);
            console.log(`    Content-Type: ${contentType} | CORS: ${corsHeader}`);
          }
        } catch (fetchErr: any) {
          console.error(`  [❌ FETCH_ERROR] ${mediaUrl} → ${fetchErr.message}`);
        }
      }
    }

    if (onProgress) onProgress(45, "[Remotion Engine] Dang dong goi ma React...");

    try {
      console.log(`[Remotion] Load dependencies (@remotion/bundler, @remotion/renderer)...`);
      const { bundler, renderer } = await loadRemotionDependencies();
      const { bundle } = bundler;
      const { renderMedia, selectComposition } = renderer;
      console.log(`[Remotion] ✅ Dependencies loaded.`);

      console.log(`[Remotion] Đang bundle entry point: ${entryPoint}`);
      const bundleStart = Date.now();
      const bundleLocation = await bundle(entryPoint);
      console.log(`[Remotion] ✅ Bundle hoàn tất trong ${Date.now() - bundleStart}ms | serveUrl: ${bundleLocation}`);

      if (onProgress) {
        onProgress(55, "[Remotion Engine] Da dong goi xong. Khoi chay Chromium headless...");
      }

      const inputProps = {
        blueprint: {
          ...blueprint,
          aspectRatio: options?.aspectRatio || "16:9",
        },
      };

      console.log(`[Remotion] Đang chọn composition id="video-edit"...`);
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "video-edit",
        inputProps,
      });
      console.log(`[Remotion] ✅ Composition: ${composition.durationInFrames} frames @ ${composition.fps}fps | ${composition.width}x${composition.height}`);

      if (onProgress) {
        onProgress(65, "[Remotion Engine]   Bắt đầu kết xuất...");
      }

      console.log(`[Remotion] Bắt đầu renderMedia (codec: h264)...`);
      const renderStart = Date.now();

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: {
          // Required for Docker/Alpine containers
          enableMultiProcessOnLinux: true,
        },
        onBrowserLog: (log) => {
          // Bắt tất cả log từ Chromium headless — nguồn chính xác của lỗi 403/CORS
          const level = log.type;
          const msg = log.text;
          const msgLower = msg.toLowerCase();
          if (
            level === "error" ||
            msgLower.includes("403") ||
            msgLower.includes("forbidden") ||
            msgLower.includes("cors") ||
            msgLower.includes("net::err") ||
            msgLower.includes("failed to load") ||
            msgLower.includes("blocked")
          ) {
            console.error(`[Remotion:Chromium:${level.toUpperCase()}] ${msg}`);
          } else if (msgLower.includes("warn") || msgLower.includes("deprecated")) {
            console.warn(`[Remotion:Chromium:${level}] ${msg}`);
          }
        },
        onProgress: (progressData) => {
          const percent = Math.round(65 + progressData.progress * 20);
          if (onProgress) {
            onProgress(
              percent,
              `[Remotion Engine] Render tien trinh: ${percent}% (Khung hinh ${progressData.renderedFrames}/${composition.durationInFrames})`
            );
          }
        },
      });

      const renderDuration = Date.now() - renderStart;
      console.log(`[Remotion] ✅ renderMedia hoàn tất trong ${(renderDuration / 1000).toFixed(1)}s`);
      console.log(`[Remotion] OutputPath size: ${fs.existsSync(outputPath) ? `${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB` : "FILE NOT FOUND ❌"}`);

      if (onProgress) {
        onProgress(85, "[Remotion Engine] Hoan tat xuat MP4. Dang tai len Cloudinary...");
      }

      console.log(`[Remotion] Đang upload lên Cloudinary...`);
      const uploadStart = Date.now();
      const outputBuffer = fs.readFileSync(outputPath);
      const secureUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");
      console.log(`[Remotion] ✅ Upload Cloudinary hoàn tất trong ${Date.now() - uploadStart}ms → ${secureUrl}`);

      try {
        fs.unlinkSync(outputPath);
        console.log(`[Remotion] 🗑 Đã xóa file tạm: ${outputPath}`);
      } catch {}

      console.log(`[Remotion] ✅ RENDER HOÀN TẤT | Job: ${renderJobId} | URL: ${secureUrl}`);
      console.log(`${"=".repeat(60)}\n`);
      return secureUrl;
    } catch (error: any) {
      console.error(`${"=".repeat(60)}`);
      console.error(`[Remotion] ❌ LỖI TRONG TIẾN TRÌNH RENDER | Job: ${renderJobId}`);
      console.error(`[Remotion] Error name   : ${error?.name}`);
      console.error(`[Remotion] Error message: ${error?.message}`);
      console.error(`[Remotion] Status code  : ${error?.statusCode || error?.status || "N/A"}`);
      if (error?.cause) {
        console.error(`[Remotion] Caused by   : ${error.cause?.message || error.cause}`);
      }
      console.error(`[Remotion] Stack trace  :\n${error?.stack}`);
      console.error(`${"=".repeat(60)}\n`);
      throw error;
    }
  },
};
