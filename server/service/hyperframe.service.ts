import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import { cloudinaryService } from "./cloudinary.service";

export const hyperframeService = {
  /**
   * Biên dịch JSON Blueprint sang cấu trúc HTML tương thích với Hyperframe
   */
  compileBlueprintToHtml(blueprint: any): string {
    const timeline = blueprint?.timeline || [];
    const aspect = blueprint?.aspectRatio || "16:9";

    let width = 1280;
    let height = 720;

    if (aspect === "9:16") {
      width = 720;
      height = 1280;
    } else if (aspect === "1:1") {
      width = 720;
      height = 720;
    }

    const rawVideoClips = timeline.filter((item: any) => item.type === "video");
    const textElements = timeline.filter((item: any) => item.type === "text");
    const imageElements = timeline.filter((item: any) => item.type === "image");
    const audioElements = timeline.filter((item: any) => item.type === "audio");

    // Tính toán thời gian bắt đầu tích lũy cho các video clips
    let currentTimelineOffset = 0;
    const videoClips = rawVideoClips.map((item: any) => {
      const start = item.start ?? 0;
      const end = item.end ?? 5;
      const rate = item.playbackRate ?? 1;
      const clipDuration = (end - start) / rate;
      const startInTimeline = currentTimelineOffset;
      currentTimelineOffset += clipDuration;
      return {
        ...item,
        startInTimeline,
        duration: clipDuration,
      };
    });

    let elementsHtml = "";

    // 1. Render Video Elements
    videoClips.forEach((clip: any, idx: number) => {
      const filters = clip.filters || {};
      const effects = clip.effects || {};
      const brightness = filters.brightness ?? 1;
      const grayscale = filters.grayscale ?? 0;
      const blur = filters.blur ?? 0;
      const sepia = filters.sepia ?? 0;
      const invert = filters.invert ?? 0;
      const contrast = filters.contrast ?? 1;
      const saturate = filters.saturate ?? 1;
      const hueRotate = filters.hueRotate ?? 0;

      const zoom = effects.zoom ?? "none";
      const rotate = effects.rotate ?? 0;

      const filterString = [
        `brightness(${brightness})`,
        `grayscale(${grayscale})`,
        blur ? `blur(${blur}px)` : "",
        sepia ? `sepia(${sepia})` : "",
        invert ? `invert(${invert})` : "",
        `contrast(${contrast})`,
        `saturate(${saturate})`,
        hueRotate ? `hue-rotate(${hueRotate}deg)` : "",
      ]
        .filter(Boolean)
        .join(" ");

      let transformString = `rotate(${rotate}deg)`;
      if (zoom === "in") {
        transformString += " scale(1.2)";
      } else if (zoom === "out") {
        transformString += " scale(0.85)";
      }

      // playbackRate set via onload/onplay inline JS
      const speed = clip.playbackRate ?? 1.0;

      elementsHtml += `
    <video
      src="${clip.src}"
      data-start="${clip.startInTimeline}"
      data-duration="${clip.duration}"
      data-media-start="${clip.start}"
      data-volume="1.0"
      data-track-index="0"
      onplay="this.playbackRate=${speed}"
      style="width: 100%; height: 100%; object-fit: contain; filter: ${filterString}; transform: ${transformString}; position: absolute; top: 0; left: 0;"
      muted
      playsinline
    ></video>`;
    });

    // 2. Render Text Elements
    textElements.forEach((textItem: any, idx: number) => {
      const style = textItem.style || {};
      const color = style.color || "white";
      const duration = (textItem.end ?? 5) - (textItem.start ?? 0);
      const fontSize = style.fontSize || "36px";

      let positionStyles = "";
      if (style.position?.startsWith("top-")) {
        positionStyles += "top: 40px;";
      } else if (style.position === "center") {
        positionStyles += "top: 50%; transform: translateY(-50%);";
      } else {
        positionStyles += "bottom: 80px;"; // default bottom-center
      }

      if (style.position?.endsWith("-left")) {
        positionStyles += "left: 40px;";
      } else if (style.position?.endsWith("-right")) {
        positionStyles += "right: 40px;";
      } else {
        positionStyles += "left: 50%; transform: translateX(-50%);";
      }

      if (style.position === "center") {
        positionStyles = "top: 50%; left: 50%; transform: translate(-50%, -50%);";
      }

      elementsHtml += `
    <div
      data-start="${textItem.start}"
      data-duration="${duration}"
      data-track-index="10"
      style="position: absolute; display: flex; pointer-events: none; z-index: 10; ${positionStyles}"
    >
      <span
        style="
          background-color: rgba(0,0,0,0.6);
          padding: 8px 18px;
          border-radius: 12px;
          color: ${color};
          font-size: ${fontSize};
          font-weight: bold;
          text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
          text-align: center;
        "
      >
        ${textItem.content || ""}
      </span>
    </div>`;
    });

    // 3. Render Image Elements
    imageElements.forEach((imgItem: any, idx: number) => {
      const style = imgItem.style || {};
      const duration = (imgItem.end ?? 5) - (imgItem.start ?? 0);
      let positionStyles = "top: 20px; right: 20px;"; // default top-right

      if (style.position === "top-left") {
        positionStyles = "top: 20px; left: 20px;";
      } else if (style.position === "bottom-left") {
        positionStyles = "bottom: 20px; left: 20px;";
      } else if (style.position === "bottom-right") {
        positionStyles = "bottom: 20px; right: 20px;";
      }

      elementsHtml += `
    <img
      src="${imgItem.src}"
      data-start="${imgItem.start}"
      data-duration="${duration}"
      data-track-index="20"
      style="position: absolute; z-index: 20; width: ${style.width || 100}px; opacity: ${style.opacity ?? 1}; object-fit: contain; ${positionStyles}"
    />`;
    });

    // 4. Render Audio Elements
    audioElements.forEach((audioItem: any, idx: number) => {
      const duration = (audioItem.end ?? 5) - (audioItem.start ?? 0);
      elementsHtml += `
    <audio
      src="${audioItem.src}"
      data-start="${audioItem.start}"
      data-duration="${duration}"
      data-volume="${audioItem.volume ?? 0.5}"
      data-track-index="5"
    ></audio>`;
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hyperframe Render</title>
  <style>
    body {
      margin: 0;
      background-color: black;
      overflow: hidden;
      font-family: Arial, sans-serif;
    }
    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root" data-composition-id="video-edit" data-width="${width}" data-height="${height}">
    ${elementsHtml}
  </div>
</body>
</html>`;
  },

  /**
   * Kết xuất video bằng Hyperframe CLI cục bộ
   */
  async renderVideo(
    blueprint: any,
    options?: {
      aspectRatio?: string;
      resolution?: string;
    },
    onProgress?: (progress: number, logMessage?: string) => void
  ): Promise<string> {
    const renderJobId = `hyperframe_render_${Date.now()}`;
    const tempHtmlPath = path.join(os.tmpdir(), `hyperframe_comp_${Date.now()}.html`);
    const outputPath = path.join(os.tmpdir(), `hyperframe_out_${Date.now()}.mp4`);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Hyperframe] ▶ BẤT ĐẦU RENDER | Job: ${renderJobId}`);
    console.log(`[Hyperframe] OutputPath : ${outputPath}`);

    // Biên dịch blueprint sang HTML
    if (onProgress) onProgress(45, "[Hyperframe Engine] Đang biên dịch Blueprint sang HTML...");
    const htmlContent = this.compileBlueprintToHtml(blueprint);
    fs.writeFileSync(tempHtmlPath, htmlContent);
    console.log(`[Hyperframe] HTML Temp Path: ${tempHtmlPath}`);

    if (onProgress) onProgress(55, "[Hyperframe Engine] Khởi chạy Hyperframe CLI...");

    return new Promise<string>((resolve, reject) => {
      // Chạy render bằng lệnh CLI hyperframes
      // npx hyperframes render -c <comp_html> -o <out_mp4>
      const args = ["hyperframes", "render", "-c", tempHtmlPath, "-o", outputPath];
      console.log(`[Hyperframe] Executing: npx ${args.join(" ")}`);
      
      const child = spawn("npx", args, { shell: true });
      let stderrAccumulator = "";

      child.stdout.on("data", (data) => {
        const line = data.toString().trim();
        console.log(`[Hyperframe CLI Out] ${line}`);
        
        // Cố gắng parse tiến trình render
        // Tiến trình hiển thị qua các log như "Rendering frame X/Y" hoặc phần trăm
        if (line.includes("Rendered") || line.includes("Rendering")) {
          if (onProgress) {
            onProgress(70, `[Hyperframe CLI] ${line}`);
          }
        }
      });

      child.stderr.on("data", (data) => {
        const line = data.toString().trim();
        stderrAccumulator += line + "\n";
        console.warn(`[Hyperframe CLI Err] ${line}`);
      });

      child.on("close", async (code) => {
        console.log(`[Hyperframe] CLI exited with code ${code}`);
        
        // Dọn dẹp tệp HTML tạm thời
        try {
          fs.unlinkSync(tempHtmlPath);
        } catch {}

        if (code !== 0) {
          reject(new Error(`Hyperframe render failed with code ${code}. Details: ${stderrAccumulator}`));
          return;
        }

        if (!fs.existsSync(outputPath)) {
          reject(new Error("Hyperframe render completed but output file not found."));
          return;
        }

        if (onProgress) onProgress(85, "[Hyperframe Engine] Tải tệp thành phẩm lên Cloudinary...");
        
        try {
          const outputBuffer = fs.readFileSync(outputPath);
          const secureUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");
          console.log(`[Hyperframe] Upload Cloudinary thành công -> ${secureUrl}`);
          
          // Dọn dẹp tệp video tạm
          try {
            fs.unlinkSync(outputPath);
          } catch {}

          resolve(secureUrl);
        } catch (uploadErr: any) {
          reject(new Error(`Failed to upload rendered video: ${uploadErr.message}`));
        }
      });
    });
  }
};
