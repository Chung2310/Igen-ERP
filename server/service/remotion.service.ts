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
      "Tính năng tạo video Remotion chưa sẵn sàng trên máy này. Hay cài đặt đầy đủ các gói Remotion trước khi sử dụng."
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
    const entryPoint = path.join(process.cwd(), "server/remotion/entry.tsx");
    const outputPath = path.join(os.tmpdir(), `remotion_out_${Date.now()}.mp4`);

    if (onProgress) onProgress(45, "[Remotion Engine] Dang dong goi ma React...");

    try {
      const { bundler, renderer } = await loadRemotionDependencies();
      const { bundle } = bundler;
      const { renderMedia, selectComposition } = renderer;

      const bundleLocation = await bundle(entryPoint);

      if (onProgress) {
        onProgress(55, "[Remotion Engine] Da dong goi xong. Khoi chay Chromium headless...");
      }

      const inputProps = {
        blueprint: {
          ...blueprint,
          aspectRatio: options?.aspectRatio || "16:9",
        },
      };

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "video-edit",
        inputProps,
      });

      if (onProgress) {
        onProgress(65, "[Remotion Engine] Bat dau ket xuat tung khung hinh...");
      }

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
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

      if (onProgress) {
        onProgress(85, "[Remotion Engine] Hoan tat xuat MP4. Dang tai len Cloudinary...");
      }

      const outputBuffer = fs.readFileSync(outputPath);
      const secureUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");

      try {
        fs.unlinkSync(outputPath);
      } catch {}

      return secureUrl;
    } catch (error: any) {
      console.error("[remotionService.renderVideo] Loi trong tien trinh render:", error);
      throw error;
    }
  },
};
