/**
 * Test local render: HyperFrames + Remotion + FFmpeg
 * Chạy: npx tsx test-local-render.ts [hyperframe|remotion|ffmpeg|both]
 */

import "dotenv/config";
import * as path from "path";
import * as fs from "fs";

// Engine arg
const ENGINE = (process.argv[2] || "both").toLowerCase();

// Cloudinary URL của video Tết (đã upload)
const TET_VIDEO_URL =
  "https://res.cloudinary.com/dxukxjf6w/video/upload/v1782550049/igen_erp/test/wgo1no8a6ulymdumsbjs.mp4";

// ─── Blueprint Tết video ─────────────────────────────────────────────────────
// Cắt video thành 4 đoạn + text overlay cho mỗi đoạn
const TET_BLUEPRINT = {
  aspectRatio: "9:16",       // dọc — phù hợp Reels/Shorts
  resolution: "720p",
  timeline: [
    // ── Clip 1: Intro 0-12s ──────────────────────────────────────────────
    {
      type: "video",
      src: TET_VIDEO_URL,
      start: 0,
      end: 12,
      playbackRate: 1.0,
      volume: 0.9,
      effects: { zoom: "in", transition: "fade", objectFit: "cover" },
    },
    // ── Text: Tiêu đề chính ──────────────────────────────────────────────
    {
      type: "text",
      content: "3 MÓN ĂN TẾT",
      start: 0,
      end: 5,
      style: {
        position: "center",
        fontSize: "52px",
        fontWeight: "800",
        color: "#FFD700",
        textShadow: "0 0 30px rgba(255,215,0,0.6)",
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: "12px 28px",
        borderRadius: "8px",
        animation: "slide-up",
      },
    },
    {
      type: "text",
      content: "mang ý nghĩa Trường Thọ - Dư Dả",
      start: 1.5,
      end: 6.5,
      style: {
        position: "bottom-center",
        fontSize: "20px",
        fontWeight: "600",
        color: "#FFFFFF",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: "8px 20px",
        borderRadius: "6px",
        animation: "fade-in",
      },
    },

    // ── Clip 2: Bánh Chưng 12-28s ────────────────────────────────────────
    {
      type: "video",
      src: TET_VIDEO_URL,
      start: 12,
      end: 28,
      playbackRate: 1.0,
      volume: 0.9,
      effects: { zoom: "none", transition: "fade", objectFit: "cover" },
    },
    {
      type: "text",
      content: "🍃 MÓN 1: BÁNH CHƯNG / BÁNH TÉT",
      start: 12,
      end: 17,
      style: {
        position: "top-center",
        fontSize: "22px",
        fontWeight: "700",
        color: "#00CC66",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: "10px 22px",
        borderRadius: "8px",
        animation: "slide-up",
      },
    },
    {
      type: "text",
      content: "Trường Thọ — sống lâu, vuông tròn",
      start: 13.5,
      end: 20,
      style: {
        position: "bottom-center",
        fontSize: "18px",
        fontWeight: "600",
        color: "#FFFFFF",
        backgroundColor: "rgba(0,102,51,0.7)",
        padding: "8px 20px",
        borderRadius: "6px",
        animation: "fade-in",
      },
    },
    {
      type: "text",
      content: "Hình vuông = Đất | Hình dài = Trường thọ",
      start: 21,
      end: 27.5,
      style: {
        position: "bottom-center",
        fontSize: "16px",
        color: "rgba(255,255,255,0.85)",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: "7px 16px",
        borderRadius: "5px",
        animation: "fade-in",
      },
    },

    // ── Clip 3: Thịt Đông 28-44s ─────────────────────────────────────────
    {
      type: "video",
      src: TET_VIDEO_URL,
      start: 28,
      end: 44,
      playbackRate: 1.0,
      volume: 0.9,
      effects: { zoom: "out", transition: "fade", objectFit: "cover" },
    },
    {
      type: "text",
      content: "🥩 MÓN 2: THỊT ĐÔNG / GIÒ CHẢ",
      start: 28,
      end: 33,
      style: {
        position: "top-center",
        fontSize: "22px",
        fontWeight: "700",
        color: "#FF8C00",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: "10px 22px",
        borderRadius: "8px",
        animation: "slide-up",
      },
    },
    {
      type: "text",
      content: "Dư Dả — no đủ quanh năm",
      start: 29.5,
      end: 36,
      style: {
        position: "bottom-center",
        fontSize: "18px",
        fontWeight: "600",
        color: "#FFFFFF",
        backgroundColor: "rgba(120,60,0,0.7)",
        padding: "8px 20px",
        borderRadius: "6px",
        animation: "fade-in",
      },
    },
    {
      type: "text",
      content: "Đông đặc = Tài lộc đông cứng 💰",
      start: 37,
      end: 43.5,
      style: {
        position: "bottom-center",
        fontSize: "16px",
        color: "rgba(255,255,255,0.85)",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: "7px 16px",
        borderRadius: "5px",
        animation: "fade-in",
      },
    },

    // ── Clip 4: Canh Măng / CTA 44-60s ───────────────────────────────────
    {
      type: "video",
      src: TET_VIDEO_URL,
      start: 44,
      end: 60,
      playbackRate: 1.0,
      volume: 0.9,
      effects: { zoom: "in", transition: "fade", objectFit: "cover" },
    },
    {
      type: "text",
      content: "🌿 MÓN 3: CANH MĂNG / BÓNG BÌ",
      start: 44,
      end: 49,
      style: {
        position: "top-center",
        fontSize: "22px",
        fontWeight: "700",
        color: "#00D4FF",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: "10px 22px",
        borderRadius: "8px",
        animation: "slide-up",
      },
    },
    {
      type: "text",
      content: "Mâm cỗ hoàn chỉnh — Cầu chúc sung túc",
      start: 50,
      end: 56,
      style: {
        position: "bottom-center",
        fontSize: "17px",
        color: "#FFFFFF",
        backgroundColor: "rgba(0,80,100,0.7)",
        padding: "8px 20px",
        borderRadius: "6px",
        animation: "fade-in",
      },
    },
    // CTA cuối
    {
      type: "text",
      content: "CHÚC MỪNG NĂM MỚI 🏮",
      start: 57,
      end: 60,
      style: {
        position: "center",
        fontSize: "36px",
        fontWeight: "800",
        color: "#FFD700",
        textShadow: "0 0 40px rgba(255,215,0,0.8)",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: "14px 30px",
        borderRadius: "10px",
        animation: "scale-in",
      },
    },
    {
      type: "text",
      content: "An Khang Thịnh Vượng ✨ Tag người thân cùng xem!",
      start: 57.5,
      end: 60,
      style: {
        position: "bottom-center",
        fontSize: "15px",
        color: "rgba(255,255,255,0.9)",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: "8px 18px",
        borderRadius: "6px",
        animation: "fade-in",
      },
    },
  ],
};

// ─── Progress logger ──────────────────────────────────────────────────────────
function makeLogger(engine: string) {
  return async (progress: number, msg?: string) => {
    const ts = new Date().toTimeString().slice(0, 8);
    console.log(`[${ts}] [${engine}] ${progress}% ${msg ? `| ${msg}` : ""}`);
  };
}

// ─── Run HyperFrames ─────────────────────────────────────────────────────────
async function testHyperframes() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST: HyperFrames — Video 3 Món Ăn Tết");
  console.log("═══════════════════════════════════════════════\n");

  // Dynamic import to avoid issues with module resolution
  const { hyperframeService } = await import("./server/service/video-edit/hyperframe");
  const logger = makeLogger("Hyperframe");

  const t0 = Date.now();
  try {
    const url = await hyperframeService.renderVideo(
      TET_BLUEPRINT,
      { aspectRatio: "9:16", resolution: "720p" },
      logger
    );
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ HyperFrames XONG! (${elapsed}s)`);
    console.log(`   URL: ${url}`);
    return url;
  } catch (e: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n❌ HyperFrames thất bại (${elapsed}s): ${e.message}`);
    return null;
  }
}

// ─── Run Remotion ─────────────────────────────────────────────────────────────
async function testRemotion() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST: Remotion — Video 3 Món Ăn Tết");
  console.log("═══════════════════════════════════════════════\n");

  const { remotionService } = await import("./server/service/video-edit/remotion");
  const logger = makeLogger("Remotion");

  const t0 = Date.now();
  try {
    const url = await remotionService.renderVideo(
      TET_BLUEPRINT,
      { aspectRatio: "9:16", resolution: "720p" },
      logger
    );
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ Remotion XONG! (${elapsed}s)`);
    console.log(`   URL: ${url}`);
    return url;
  } catch (e: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n❌ Remotion thất bại (${elapsed}s): ${e.message}`);
    return null;
  }
}

// ─── Run FFmpeg ───────────────────────────────────────────────────────────────
async function testFfmpeg() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST: FFmpeg — Video 3 Món Ăn Tết");
  console.log("═══════════════════════════════════════════════\n");

  const { runFFmpegFallback } = await import("./server/service/video-edit/ffmpeg");
  const logger = makeLogger("FFmpeg");
  const recordId = `test_tet_${Date.now()}`;

  const t0 = Date.now();
  try {
    const url = await runFFmpegFallback(
      recordId,
      TET_VIDEO_URL,
      TET_BLUEPRINT,
      { aspectRatio: "9:16", resolution: "720p", targetWidth: 720, targetHeight: 1280 },
      logger
    );
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ FFmpeg XONG! (${elapsed}s)`);
    console.log(`   URL: ${url}`);
    return url;
  } catch (e: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n❌ FFmpeg thất bại (${elapsed}s): ${e.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  LOCAL RENDER TEST — Engine: ${ENGINE.toUpperCase()}`);
  console.log(`  Blueprint: ${TET_BLUEPRINT.timeline.filter(t => t.type === "video").length} video clips, ${TET_BLUEPRINT.timeline.filter(t => t.type === "text").length} text overlays`);
  console.log(`  Aspect: ${TET_BLUEPRINT.aspectRatio} | Resolution: ${TET_BLUEPRINT.resolution}`);
  console.log(`${"═".repeat(50)}\n`);

  if (ENGINE === "hyperframe" || ENGINE === "both") {
    await testHyperframes();
  }

  if (ENGINE === "remotion" || ENGINE === "both") {
    await testRemotion();
  }

  if (ENGINE === "ffmpeg" || ENGINE === "both") {
    await testFfmpeg();
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("  TEST KẾT THÚC");
  console.log(`${"═".repeat(50)}\n`);
})();
