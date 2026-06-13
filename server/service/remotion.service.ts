import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { cloudinaryService } from "./cloudinary.service";

export const remotionService = {
  /**
   * Render video bằng Remotion trên Server
   */
  async renderVideo(
    blueprint: any,
    options?: {
      aspectRatio?: string;
      resolution?: string;
    },
    onProgress?: (progress: number, logMessage?: string) => void
  ): Promise<string> {
    const entryPoint = path.join(process.cwd(), "server/remotion/entry.tsx");
    const outputPath = path.join(os.tmpdir(), `remotion_out_${Date.now()}.mp4`);

    if (onProgress) onProgress(45, "[Remotion Engine] Đang đóng gói (bundling) mã React...");

    try {
      // 1. Đóng gói mã React
      const bundleLocation = await bundle(entryPoint);

      if (onProgress) onProgress(55, "[Remotion Engine] Đã đóng gói xong. Khởi chạy trình duyệt headless Chromium...");

      const inputProps = {
        blueprint: {
          ...blueprint,
          aspectRatio: options?.aspectRatio || "16:9",
        }
      };

      // 2. Lựa chọn Composition và truyền tham số JSON Blueprint
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "video-edit",
        inputProps,
      });

      if (onProgress) onProgress(65, "[Remotion Engine] Bắt đầu kết xuất từng khung hình (Frame-by-Frame)...");

      // 3. Thực hiện Render Media
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: (progressData) => {
          const percent = Math.round(65 + progressData.progress * 20); // Scale từ 65% đến 85%
          if (onProgress) {
            onProgress(
              percent,
              `[Remotion Engine] Render tiến trình: ${percent}% (Khung hình ${progressData.renderedFrames}/${composition.durationInFrames})`
            );
          }
        },
      });

      if (onProgress) onProgress(85, "[Remotion Engine] Hoàn tất kết xuất file MP4. Đang tải lên Cloudinary...");

      // 4. Tải lên Cloudinary
      const outputBuffer = fs.readFileSync(outputPath);
      const secureUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");

      // Dọn dẹp tệp tạm
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {}

      return secureUrl;
    } catch (error: any) {
      console.error("[remotionService.renderVideo] Lỗi trong tiến trình render:", error);
      throw error;
    }
  },
};
