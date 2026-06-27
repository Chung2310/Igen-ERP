import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import { cloudinaryService } from "../cloudinary.service";
import { normalizeMediaUrl } from "./remotion";

export function resolveLocalPathForRender(src: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const relativePath = src.startsWith("/") ? src.slice(1) : src;
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  const fileUrl = `file:///${absolutePath.replace(/\\/g, "/")}`;
  console.log(`[Hyperframe] Resolving local asset: ${src} -> ${fileUrl}`);
  return fileUrl;
}

export const hyperframeService = {
  /**
   * Biên dịch JSON Blueprint sang HTML tương thích với Hyperframe CLI.
   */
  compileBlueprintToHtml(blueprint: any): string {
    const rawTimeline = blueprint?.timeline || [];
    const timeline = rawTimeline.map((item: any) =>
      item.src ? { ...item, src: normalizeMediaUrl(item.src) } : item
    );
    const aspect = blueprint?.aspectRatio || "16:9";
    const resolution = blueprint?.resolution || "720p";
    const is1080p = resolution === "1080p";

    let width = 1280;
    let height = 720;
    if (aspect === "9:16") { width = 720; height = 1280; }
    else if (aspect === "1:1") { width = 720; height = 720; }

    // Nâng lên 1080p nếu được yêu cầu
    if (is1080p) {
      if (aspect === "16:9") { width = 1920; height = 1080; }
      else if (aspect === "9:16") { width = 1080; height = 1920; }
      else if (aspect === "1:1") { width = 1080; height = 1080; }
    }

    const rawVideoClips = timeline.filter((item: any) => item.type === "video");
    const textElements = timeline.filter((item: any) => item.type === "text");
    const imageElements = timeline.filter((item: any) => item.type === "image");
    const audioElements = timeline.filter((item: any) => item.type === "audio");

    let currentTimelineOffset = 0;
    const videoClips = rawVideoClips.map((item: any) => {
      const start = item.start ?? 0;
      const end = item.end ?? 5;
      const rate = item.playbackRate ?? 1;
      const clipDuration = (end - start) / rate;
      const startInTimeline = currentTimelineOffset;
      currentTimelineOffset += clipDuration;
      return { ...item, startInTimeline, duration: clipDuration };
    });

    const videoClipsWithTransitions = videoClips.map((clip: any, idx: number) => {
      const hasNextClip = idx < videoClips.length - 1;
      const nextClip = hasNextClip ? videoClips[idx + 1] : null;
      const isContinuous = nextClip && nextClip.src === clip.src && Math.abs((clip.end ?? 0) - (nextClip.start ?? 0)) < 0.1;
      const hasExitTransition = hasNextClip && clip.effects?.transition === "fade" && !isContinuous;
      const exitTransitionTime = hasExitTransition ? Math.min(0.2667, clip.duration / 3) : 0;
      return { ...clip, hasExitTransition, transTime: exitTransitionTime, renderDuration: clip.duration + exitTransitionTime, hasNextClip };
    });

    let elementsHtml = "";
    let stylesHtml = "";

    // 1. Video Elements
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
      const objectFit = effects.objectFit || "contain";

      const D_render = clip.renderDuration;
      const D_orig = clip.duration;
      const T_exit = clip.transTime;
      const prevClip = idx > 0 ? videoClipsWithTransitions[idx - 1] : null;
      const T_entry = prevClip ? prevClip.transTime : 0;

      const staticFilters = `brightness(${brightness}) grayscale(${grayscale}) sepia(${sepia}) invert(${invert}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hueRotate}deg)`;

      const getZoomScale = (t: number) => {
        if (D_orig <= 0) return 1.0;
        const ratio = Math.min(1, Math.max(0, t / D_orig));
        if (zoom === "in") return 1.0 + ratio * 0.25;
        if (zoom === "out") return 1.25 - ratio * 0.25;
        return 1.0;
      };

      const points: Array<{ pct: number; opacity: number; blurVal: number; scaleVal: number }> = [];
      points.push({ pct: 0, opacity: T_entry > 0 ? 0 : 1, blurVal: blur + (T_entry > 0 ? 12 : 0), scaleVal: getZoomScale(0) * (T_entry > 0 ? 1.15 : 1.0) });
      if (T_entry > 0) points.push({ pct: (T_entry / D_render) * 100, opacity: 1.0, blurVal: blur, scaleVal: getZoomScale(T_entry) });
      if (T_exit > 0) points.push({ pct: (D_orig / D_render) * 100, opacity: 1.0, blurVal: blur, scaleVal: getZoomScale(D_orig) });
      points.push({ pct: 100, opacity: T_exit > 0 ? 0 : 1, blurVal: blur + (T_exit > 0 ? 12 : 0), scaleVal: getZoomScale(D_render) * (T_exit > 0 ? 1.15 : 1.0) });
      points.sort((a, b) => a.pct - b.pct);

      let keyframesText = `@keyframes anim-clip-${idx} {\n`;
      points.forEach((pt) => {
        keyframesText += `    ${pt.pct.toFixed(2)}% { opacity: ${pt.opacity}; filter: ${staticFilters} blur(${pt.blurVal}px); transform: scale(${pt.scaleVal}) rotate(${rotate}deg); }\n`;
      });
      keyframesText += `  }\n`;

      stylesHtml += `\n  ${keyframesText}  .clip-anim-${idx} { animation: anim-clip-${idx} ${D_render.toFixed(4)}s linear forwards; animation-delay: ${clip.startInTimeline.toFixed(4)}s; }\n`;

      const speed = clip.playbackRate ?? 1.0;
      const clipVolume = clip.volume ?? 1.0;

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
      style="width: 100%; height: 100%; object-fit: ${objectFit}; position: absolute; top: 0; left: 0;"
      playsinline
    ></video>`;
    });

    // 2. Text Elements
    textElements.forEach((textItem: any, idx: number) => {
      const style = textItem.style || {};
      const color = style.color || "white";
      const duration = (textItem.end ?? 5) - (textItem.start ?? 0);
      const fontSize = style.fontSize || "36px";
      const fontWeight = style.fontWeight || "bold";
      const fontFamily = style.fontFamily || "Arial, sans-serif";
      const letterSpacing = style.letterSpacing || "normal";
      const textTransform = style.textTransform || "none";
      const opacity = style.opacity !== undefined ? style.opacity : 1.0;
      const bgColor = style.background === "none" ? "transparent" : (style.background || "rgba(0,0,0,0.6)");
      const animation = style.animation || "none";
      const hasBg = bgColor !== "transparent";
      const textShadow = hasBg ? "none" : "2px 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)";
      const padding = hasBg ? "8px 18px" : "4px 8px";
      const borderRadius = hasBg ? "12px" : "0";
      const animId = `text_anim_${idx}`;
      const safeContent = String(textItem.content || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

      let positionStyles = "";
      if (style.position?.startsWith("top-")) positionStyles += "top: 40px;";
      else if (style.position === "center") positionStyles += "top: 0; bottom: 0; align-items: center;";
      else positionStyles += "bottom: 80px;";

      if (style.position?.endsWith("-left")) positionStyles += "left: 40px;";
      else if (style.position?.endsWith("-right")) positionStyles += "right: 40px;";
      else positionStyles += "left: 0; right: 0; justify-content: center;";

      if (style.position === "center") positionStyles = "top: 0; bottom: 0; left: 0; right: 0; align-items: center; justify-content: center;";

      // CSS keyframes — hỗ trợ thêm: slide-up, slide-down, scale-in, typewriter
      let animCss = "";
      let animStyle = "";
      const fadeDur = Math.min(0.5, duration / 3);
      if (animation === "fade-in") {
        animCss = `@keyframes ${animId} { from { opacity: 0; } to { opacity: ${opacity}; } }`;
        animStyle = `animation: ${animId} ${fadeDur}s ease-out forwards;`;
      } else if (animation === "fade-out") {
        animCss = `@keyframes ${animId} { from { opacity: ${opacity}; } to { opacity: 0; } }`;
        animStyle = `animation: ${animId} ${fadeDur}s ease-in ${Math.max(0, duration - fadeDur)}s forwards;`;
      } else if (animation === "fade-in-out") {
        animCss = `@keyframes ${animId} { 0% { opacity: 0; } ${Math.round(fadeDur / duration * 100)}% { opacity: ${opacity}; } ${Math.round((1 - fadeDur / duration) * 100)}% { opacity: ${opacity}; } 100% { opacity: 0; } }`;
        animStyle = `animation: ${animId} ${duration}s linear forwards;`;
      } else if (animation === "slide-up") {
        const slideDur = Math.min(0.5, duration / 3);
        animCss = `@keyframes ${animId} { from { opacity: 0; transform: translateY(30px); } to { opacity: ${opacity}; transform: translateY(0); } }`;
        animStyle = `animation: ${animId} ${slideDur}s cubic-bezier(0.25,0.46,0.45,0.94) forwards;`;
      } else if (animation === "slide-down") {
        const slideDur = Math.min(0.5, duration / 3);
        animCss = `@keyframes ${animId} { from { opacity: 0; transform: translateY(-30px); } to { opacity: ${opacity}; transform: translateY(0); } }`;
        animStyle = `animation: ${animId} ${slideDur}s cubic-bezier(0.25,0.46,0.45,0.94) forwards;`;
      } else if (animation === "scale-in") {
        const scaleDur = Math.min(0.4, duration / 3);
        animCss = `@keyframes ${animId} { from { opacity: 0; transform: scale(0.6); } to { opacity: ${opacity}; transform: scale(1); } }`;
        animStyle = `animation: ${animId} ${scaleDur}s cubic-bezier(0.34,1.56,0.64,1) forwards;`;
      } else if (animation === "typewriter") {
        animCss = `@keyframes ${animId} { from { width: 0; } to { width: 100%; } } @keyframes ${animId}_cursor { from, to { border-right-color: transparent; } 50% { border-right-color: ${color}; } }`;
        animStyle = `animation: ${animId} ${Math.min(2, duration * 0.6)}s steps(${safeContent.length || 10}, end) forwards, ${animId}_cursor 0.75s step-end infinite; overflow: hidden; white-space: nowrap; border-right: 2px solid transparent;`;
      }
      if (animCss) stylesHtml += animCss + "\n";

      const initialOpacity = ["fade-in", "fade-in-out", "slide-up", "slide-down", "scale-in"].includes(animation) ? 0 : opacity;

      elementsHtml += `
    <div data-start="${textItem.start}" data-duration="${duration}" data-track-index="10"
      style="position: absolute; display: flex; pointer-events: none; z-index: 10; ${positionStyles}">
      <span style="background-color: ${bgColor}; padding: ${padding}; border-radius: ${borderRadius}; color: ${color}; font-size: ${fontSize}; font-weight: ${fontWeight}; font-family: ${fontFamily}; letter-spacing: ${letterSpacing}; text-transform: ${textTransform}; text-shadow: ${textShadow}; text-align: center; opacity: ${initialOpacity}; ${animStyle}">
        ${safeContent}
      </span>
    </div>`;
    });

    // 3. Image Elements
    imageElements.forEach((imgItem: any, imgIdx: number) => {
      const style = imgItem.style || {};
      const duration = (imgItem.end ?? 5) - (imgItem.start ?? 0);
      const imgOpacity = style.opacity ?? 1;
      const imgWidth = style.width || 100;
      const animId = `img_anim_${imgIdx}`;
      const imgAnimation = style.animation || "none";
      let imgAnimCss = "";
      let imgAnimStyle = "";

      if (imgAnimation === "fade-in") {
        const fadeDur = Math.min(0.5, duration / 3);
        imgAnimCss = `@keyframes ${animId} { from { opacity: 0; } to { opacity: ${imgOpacity}; } }`;
        imgAnimStyle = `animation: ${animId} ${fadeDur}s ease-out forwards;`;
      } else if (imgAnimation === "slide-up") {
        const slideDur = Math.min(0.4, duration / 3);
        imgAnimCss = `@keyframes ${animId} { from { opacity: 0; transform: translateY(20px); } to { opacity: ${imgOpacity}; transform: translateY(0); } }`;
        imgAnimStyle = `animation: ${animId} ${slideDur}s ease-out forwards;`;
      }
      if (imgAnimCss) stylesHtml += imgAnimCss + "\n";

      let positionStyles = "top: 20px; right: 20px;";
      if (style.position === "top-left") positionStyles = "top: 20px; left: 20px;";
      else if (style.position === "bottom-left") positionStyles = "bottom: 20px; left: 20px;";
      else if (style.position === "bottom-right") positionStyles = "bottom: 20px; right: 20px;";
      else if (style.position === "center") positionStyles = "top: 50%; left: 50%; transform: translate(-50%,-50%);";

      elementsHtml += `
    <img src="${resolveLocalPathForRender(imgItem.src)}" data-start="${imgItem.start}" data-duration="${duration}" data-track-index="20"
      style="position: absolute; z-index: 20; width: ${imgWidth}px; opacity: ${imgOpacity}; object-fit: contain; ${positionStyles} ${imgAnimStyle}" />`;
    });

    // 4. Audio Elements
    audioElements.forEach((audioItem: any) => {
      const duration = (audioItem.end ?? 5) - (audioItem.start ?? 0);
      elementsHtml += `
    <audio src="${resolveLocalPathForRender(audioItem.src)}" data-start="${audioItem.start}" data-duration="${duration}" data-volume="${audioItem.volume ?? 0.5}" data-track-index="5"></audio>`;
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hyperframe Render</title>
  <style>
    body { margin: 0; background-color: black; overflow: hidden; font-family: Arial, sans-serif; }
    #root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
    video { opacity: 0; }
    ${stylesHtml}
  </style>
</head>
<body>
  <div id="root" data-composition-id="video-edit" data-width="${width}" data-height="${height}" data-resolution="${resolution}">
    ${elementsHtml}
  </div>
</body>
</html>`;
  },

  /**
   * Kết xuất video bằng Hyperframe CLI và upload lên Cloudinary.
   */
  async renderVideo(
    blueprint: any,
    options?: { aspectRatio?: string; resolution?: string },
    onProgress?: (progress: number, logMessage?: string) => void
  ): Promise<string> {
    const renderJobId = `hyperframe_render_${Date.now()}`;
    // HyperFrames CLI requires files inside the project directory
    const tmpDir = path.join(process.cwd(), ".hyperframe-tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tempHtmlPath = path.join(tmpDir, `hyperframe_comp_${Date.now()}.html`);
    const outputPath = path.join(tmpDir, `hyperframe_out_${Date.now()}.mp4`);
    const resolution = options?.resolution || "720p";

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Hyperframe] ▶ BẤT ĐẦU RENDER | Job: ${renderJobId}`);
    console.log(`[Hyperframe] OutputPath: ${outputPath} | Resolution: ${resolution}`);

    // Preflight / pre-warm CDN cache
    const timeline = blueprint?.timeline || [];
    const normalizedTimeline = timeline.map((item: any) =>
      item.src ? { ...item, src: normalizeMediaUrl(item.src) } : item
    );
    const normalizedBlueprint = {
      ...blueprint,
      timeline: normalizedTimeline,
      resolution,                              // truyền resolution vào blueprint cho compileBlueprintToHtml
    };

    const allMediaUrls = normalizedTimeline
      .filter((t: any) => t.src)
      .map((t: any) => t.src)
      .filter(Boolean);

    for (const mediaUrl of allMediaUrls) {
      if (!mediaUrl.startsWith("http") || mediaUrl.includes("localhost") || mediaUrl.includes("127.0.0.1")) continue;
      try {
        const startPrewarm = Date.now();
        const res = await fetch(mediaUrl, { method: "GET", signal: AbortSignal.timeout(90000) });
        if (!res.ok) {
          console.error(`  [❌ HTTP ${res.status}] ${mediaUrl}`);
        } else {
          const buffer = await res.arrayBuffer();
          console.log(`  [✅ READY] ${mediaUrl} | ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB | ${Date.now() - startPrewarm}ms`);
        }
      } catch (fetchErr: any) {
        console.error(`  [❌ FETCH_ERROR] ${mediaUrl} → ${fetchErr.message}`);
      }
    }

    if (onProgress) onProgress(45, "[Hyperframe Engine] Đang biên dịch Blueprint sang HTML...");
    const htmlContent = this.compileBlueprintToHtml(normalizedBlueprint);
    fs.writeFileSync(tempHtmlPath, htmlContent);

    if (onProgress) onProgress(55, "[Hyperframe Engine] Khởi chạy Hyperframe CLI...");

    const aspect = options?.aspectRatio || "16:9";
    let resolutionPreset = "landscape";
    if (aspect === "9:16") resolutionPreset = "portrait";
    else if (aspect === "1:1") resolutionPreset = "square";

    return new Promise<string>((resolve, reject) => {
      // Quote paths to handle spaces on Windows (shell:true concats args without escaping)
      const cmd = `npx hyperframes render -c "${tempHtmlPath}" -o "${outputPath}" --resolution ${resolutionPreset} --strict`;
      console.log(`[Hyperframe] Executing: ${cmd}`);

      const child = spawn(cmd, [], { shell: true });
      let stderrAccumulator = "";

      child.stdout.on("data", (data) => {
        const line = data.toString().trim();
        console.log(`[Hyperframe CLI Out] ${line}`);
        if ((line.includes("Rendered") || line.includes("Rendering")) && onProgress) {
          onProgress(70, `[Hyperframe CLI] ${line}`);
        }
      });

      child.stderr.on("data", (data) => {
        const line = data.toString().trim();
        stderrAccumulator += line + "\n";
        console.warn(`[Hyperframe CLI Err] ${line}`);
      });

      child.on("close", async (code) => {
        console.log(`[Hyperframe] CLI exited with code ${code}`);
        try { fs.unlinkSync(tempHtmlPath); } catch {}

        if (code !== 0) {
          reject(new Error(`Hyperframe render failed with code ${code}. Details: ${stderrAccumulator}`));
          return;
        }
        if (!fs.existsSync(outputPath)) {
          reject(new Error("Hyperframe render completed but output file not found."));
          return;
        }

        if (onProgress) onProgress(85, "[Hyperframe Engine] Đang tải lên Cloudinary...");
        try {
          const outputBuffer = fs.readFileSync(outputPath);
          const secureUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");
          console.log(`[Hyperframe] Upload Cloudinary thành công -> ${secureUrl}`);
          try { fs.unlinkSync(outputPath); } catch {}
          resolve(secureUrl);
        } catch (uploadErr: any) {
          reject(new Error(`Failed to upload rendered video: ${uploadErr.message}`));
        }
      });
    });
  }
};
