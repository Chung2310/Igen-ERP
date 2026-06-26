import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import { cloudinaryService } from "./cloudinary.service";
import { normalizeMediaUrl } from "./remotion.service";

export function resolveLocalPathForRender(src: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  const relativePath = src.startsWith("/") ? src.slice(1) : src;
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  const fileUrl = `file:///${absolutePath.replace(/\\/g, "/")}`;
  console.log(`[Hyperframe] Resolving local asset: ${src} -> ${fileUrl}`);
  return fileUrl;
}

export const hyperframeService = {
  /**
   * Biên dịch JSON Blueprint sang cấu trúc HTML tương thích với Hyperframe
   */
  compileBlueprintToHtml(blueprint: any): string {
    const rawTimeline = blueprint?.timeline || [];
    const timeline = rawTimeline.map((item: any) => {
      if (item.src) {
        return { ...item, src: normalizeMediaUrl(item.src) };
      }
      return item;
    });
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

    // Tính toán thời gian bắt đầu tích lũy cho các video clips, bao gồm cả overlap chuyển cảnh
    let currentTimelineOffset = 0;
    const videoClips = rawVideoClips.map((item: any, idx: number) => {
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

    const videoClipsWithTransitions = videoClips.map((clip: any, idx: number) => {
      const hasNextClip = idx < videoClips.length - 1;
      const nextClip = hasNextClip ? videoClips[idx + 1] : null;
      // Không chuyển tiếp (Clean Cut) nếu là các phân đoạn liên tục của cùng một video nguồn
      const isContinuous = nextClip && nextClip.src === clip.src && Math.abs((clip.end ?? 0) - (nextClip.start ?? 0)) < 0.1;

      const hasExitTransition = hasNextClip && clip.effects?.transition === "fade" && !isContinuous;
      const exitTransitionTime = hasExitTransition ? Math.min(0.2667, clip.duration / 3) : 0;
      const renderDuration = clip.duration + exitTransitionTime;

      return {
        ...clip,
        hasExitTransition,
        transTime: exitTransitionTime,
        renderDuration,
        hasNextClip,
      };
    });

    let elementsHtml = "";
    let stylesHtml = "";

    // 1. Render Video Elements với CSS Keyframes cho Chuyển Cảnh & Thu Phóng
    videoClipsWithTransitions.forEach((clip: any, idx: number) => {
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

      const D_render = clip.renderDuration;
      const D_orig = clip.duration;
      const T_exit = clip.transTime;
      const prevClip = idx > 0 ? videoClipsWithTransitions[idx - 1] : null;
      const T_entry = prevClip ? prevClip.transTime : 0;

      const staticFilters = `brightness(${brightness}) grayscale(${grayscale}) sepia(${sepia}) invert(${invert}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hueRotate}deg)`;

      // Hàm tính toán zoom scale tại thời điểm t
      const getZoomScale = (t: number) => {
        if (D_orig <= 0) return 1.0;
        const ratio = Math.min(1, Math.max(0, t / D_orig));
        if (zoom === "in") {
          return 1.0 + ratio * 0.25;
        } else if (zoom === "out") {
          return 1.25 - ratio * 0.25;
        }
        return 1.0;
      };

      // Tạo các điểm keyframe để đồng bộ hóa với Remotion
      const points: Array<{ pct: number; opacity: number; blurVal: number; scaleVal: number }> = [];

      // Điểm 1: Bắt đầu clip (t = 0)
      const p1_scale_zoom = getZoomScale(0);
      const p1_scale_trans = T_entry > 0 ? 1.15 : 1.0;
      points.push({
        pct: 0,
        opacity: T_entry > 0 ? 0 : 1,
        blurVal: blur + (T_entry > 0 ? 12 : 0),
        scaleVal: p1_scale_zoom * p1_scale_trans,
      });

      // Điểm 2: Kết thúc chuyển cảnh vào (t = T_entry)
      if (T_entry > 0) {
        const p2_scale_zoom = getZoomScale(T_entry);
        points.push({
          pct: (T_entry / D_render) * 100,
          opacity: 1.0,
          blurVal: blur,
          scaleVal: p2_scale_zoom * 1.0,
        });
      }

      // Điểm 3: Bắt đầu chuyển cảnh ra (t = D_orig)
      if (T_exit > 0) {
        const p3_scale_zoom = getZoomScale(D_orig);
        points.push({
          pct: (D_orig / D_render) * 100,
          opacity: 1.0,
          blurVal: blur,
          scaleVal: p3_scale_zoom * 1.0,
        });
      }

      // Điểm 4: Kết thúc toàn bộ thời gian render của clip (t = D_render)
      const p4_scale_zoom = getZoomScale(D_render);
      const p4_scale_trans = T_exit > 0 ? 1.15 : 1.0;
      points.push({
        pct: 100,
        opacity: T_exit > 0 ? 0 : 1,
        blurVal: blur + (T_exit > 0 ? 12 : 0),
        scaleVal: p4_scale_zoom * p4_scale_trans,
      });

      // Sắp xếp các điểm tăng dần theo phần trăm
      points.sort((a, b) => a.pct - b.pct);

      // Sinh cú pháp CSS @keyframes
      let keyframesText = `@keyframes anim-clip-${idx} {\n`;
      points.forEach((pt) => {
        keyframesText += `    ${pt.pct.toFixed(2)}% { opacity: ${pt.opacity}; filter: ${staticFilters} blur(${pt.blurVal}px); transform: scale(${pt.scaleVal}) rotate(${rotate}deg); }\n`;
      });
      keyframesText += `  }\n`;

      stylesHtml += `
  ${keyframesText}
  .clip-anim-${idx} {
    animation: anim-clip-${idx} ${D_render.toFixed(4)}s linear forwards;
    animation-delay: ${clip.startInTimeline.toFixed(4)}s;
  }\n`;

      const speed = clip.playbackRate ?? 1.0;
      const clipVolume = clip.volume ?? 1.0;

      // Render thẻ video có track tăng dần và class hoạt họa CSS
      // LƯU Ý: KHÔNG dùng muted — cần giữ âm thanh gốc của video đầu vào
      elementsHtml += `
    <video
      src="${resolveLocalPathForRender(clip.src)}"
      data-start="${clip.startInTimeline}"
      data-duration="${clip.renderDuration}"
      data-media-start="${clip.start}"
      data-volume="${clipVolume}"
      data-track-index="${idx}"
      class="clip-anim-${idx}"
      onplay="this.playbackRate=${speed}"
      oncanplay="this.volume=${clipVolume}"
      style="width: 100%; height: 100%; object-fit: contain; position: absolute; top: 0; left: 0;"
      playsinline
    ></video>`;
    });

    // 2. Render Text Elements
    textElements.forEach((textItem: any, idx: number) => {
      const style = textItem.style || {};
      const color = style.color || "white";
      const duration = (textItem.end ?? 5) - (textItem.start ?? 0);
      const fontSize = style.fontSize || "36px";

      // BUG-12 fix: escape HTML entities to prevent XSS injection
      const safeContent = String(textItem.content || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      let positionStyles = "";
      if (style.position?.startsWith("top-")) {
        positionStyles += "top: 40px;";
      } else if (style.position === "center") {
        positionStyles += "top: 0; bottom: 0; align-items: center;";
      } else {
        positionStyles += "bottom: 80px;"; // default bottom-center
      }

      if (style.position?.endsWith("-left")) {
        positionStyles += "left: 40px;";
      } else if (style.position?.endsWith("-right")) {
        positionStyles += "right: 40px;";
      } else {
        positionStyles += "left: 0; right: 0; justify-content: center;";
      }

      if (style.position === "center") {
        positionStyles = "top: 0; bottom: 0; left: 0; right: 0; align-items: center; justify-content: center;";
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
        ${safeContent}
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
      src="${resolveLocalPathForRender(imgItem.src)}"
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
      src="${resolveLocalPathForRender(audioItem.src)}"
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
    video {
      opacity: 0;
    }
    ${stylesHtml}
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

    // Chuẩn hóa URLs và thực hiện preflight pre-warm cho Cloudinary assets
    const timeline = blueprint?.timeline || [];
    const normalizedTimeline = timeline.map((item: any) => {
      if (item.src) {
        return { ...item, src: normalizeMediaUrl(item.src) };
      }
      return item;
    });
    const normalizedBlueprint = { ...blueprint, timeline: normalizedTimeline };

    const videoUrls = normalizedTimeline.filter((t: any) => t.type === "video").map((t: any) => t.src);
    const audioUrls = normalizedTimeline.filter((t: any) => t.type === "audio").map((t: any) => t.src);
    const imageUrls = normalizedTimeline.filter((t: any) => t.type === "image").map((t: any) => t.src);

    const allMediaUrls = [...videoUrls, ...audioUrls, ...imageUrls].filter(Boolean);
    if (allMediaUrls.length > 0) {
      console.log(`[Hyperframe] Kiểm tra trước (preflight) và kích hoạt CDN cache cho ${allMediaUrls.length} media URLs...`);
      for (const mediaUrl of allMediaUrls) {
        if (!mediaUrl.startsWith("http")) {
          console.log(`  [SKIP] URL nội bộ/tương đối: ${mediaUrl}`);
          continue;
        }
        if (mediaUrl.includes("localhost") || mediaUrl.includes("127.0.0.1")) {
          console.log(`  [SKIP] URL localhost: ${mediaUrl}`);
          continue;
        }
        try {
          console.log(`  [PRE-WARM] Đang tải xuống để CDN cache hoàn tất: ${mediaUrl}`);
          const startPrewarm = Date.now();
          const res = await fetch(mediaUrl, {
            method: "GET",
            signal: AbortSignal.timeout(90000), // Cho phép tối đa 90 giây để transcode và tải
          });

          if (!res.ok) {
            console.error(`  [❌ HTTP ${res.status}] ${mediaUrl}`);
          } else {
            const buffer = await res.arrayBuffer();
            const elapsed = Date.now() - startPrewarm;
            console.log(`  [✅ READY] ${mediaUrl} | Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB | Thời gian tải/transcode: ${elapsed}ms`);
          }
        } catch (fetchErr: any) {
          console.error(`  [❌ FETCH_ERROR] ${mediaUrl} → ${fetchErr.message}`);
        }
      }
    }

    // Biên dịch blueprint đã chuẩn hóa sang HTML
    if (onProgress) onProgress(45, "[Hyperframe Engine] Đang biên dịch Blueprint sang HTML...");
    const htmlContent = this.compileBlueprintToHtml(normalizedBlueprint);
    fs.writeFileSync(tempHtmlPath, htmlContent);
    console.log(`[Hyperframe] HTML Temp Path: ${tempHtmlPath}`);

    if (onProgress) onProgress(55, "[Hyperframe Engine] Khởi chạy Hyperframe CLI...");

    // Ánh xạ tỷ lệ khung hình sang các preset resolution của Hyperframe CLI
    const aspect = options?.aspectRatio || "16:9";
    let resolutionPreset = "landscape";
    if (aspect === "9:16") {
      resolutionPreset = "portrait";
    } else if (aspect === "1:1") {
      resolutionPreset = "square";
    }

    return new Promise<string>((resolve, reject) => {
      // Chạy render bằng lệnh CLI hyperframes
      // npx hyperframes render -c <comp_html> -o <out_mp4> --resolution <preset> --strict
      const args = ["hyperframes", "render", "-c", tempHtmlPath, "-o", outputPath, "--resolution", resolutionPreset, "--strict"];
      console.log(`[Hyperframe] Executing: npx ${args.join(" ")}`);
      
      const child = spawn("npx", args, { shell: true });
      let stderrAccumulator = "";

      child.stdout.on("data", (data) => {
        const line = data.toString().trim();
        console.log(`[Hyperframe CLI Out] ${line}`);
        
        // Cố gắng parse tiến trình render
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
