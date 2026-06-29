/**
 * Test script: Professional mode cho video "3 món ăn Tết"
 * Chạy: npx tsx <path>/test-professional-tet.ts
 */

import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = "dxukxjf6w";
const CLOUDINARY_API_KEY    = "524459436645847";
const CLOUDINARY_API_SECRET = "bZlbyH8VUisIYAAIdRe3O5zYKY4";
const VPS_URL   = "http://14.225.224.205:8644";
const VPS_KEY   = "chungtestclauderendervideo27062026";
const VIDEO_PATH = "C:\\Users\\PC\\Downloads\\3 món ăn trên mâm cỗ Tết mang ý nghĩa _Trường Thọ - Dư Dả_.mp4";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// ─── Scene specs cho Tết food video ──────────────────────────────────────────
const TET_SCENES = [
  {
    type: "hook",
    label: "HOOK",
    title: "3 MÓN ĂN TẾT",
    subtitle: "mang ý nghĩa Trường Thọ - Dư Dả",
    titleColor: "gold",
    highlightWords: ["Trường Thọ", "Dư Dả"],
    duration: 10,
  },
  {
    type: "story",
    label: "Ý NGHĨA",
    title: "MÂM CỖ TẾT VIỆT NAM",
    subtitle: "Mỗi món ăn là một lời cầu chúc",
    titleColor: "red",
    items: [
      { icon: "🏮", title: "Truyền thống ngàn năm", description: "Mâm cỗ Tết không chỉ là bữa ăn — đó là văn hóa, là tâm linh", variant: "danger" },
      { icon: "📿", title: "Ý nghĩa tâm linh", description: "Mỗi món mang lời cầu chúc sức khỏe, tài lộc cho cả năm", variant: "danger" },
    ],
    duration: 12,
  },
  {
    type: "insight",
    label: "MÓN 1",
    title: "BÁNH CHƯNG / BÁNH TÉT",
    subtitle: "Trường Thọ — sống lâu, vuông tròn",
    titleColor: "green",
    items: [
      { icon: "🍃", title: "Bánh chưng (miền Bắc)", description: "Hình vuông tượng trưng cho đất, lòng biết ơn tổ tiên", variant: "success" },
      { icon: "🎋", title: "Bánh tét (miền Nam)", description: "Hình trụ dài — cầu mong trường thọ, sống lâu khỏe mạnh", variant: "success" },
    ],
    duration: 12,
  },
  {
    type: "pipeline",
    label: "MÓN 2",
    title: "THỊT ĐÔNG / GIÒ CHẢ",
    subtitle: "Dư Dả — no đủ quanh năm",
    titleColor: "cyan",
    steps: [
      { step: "THỊT ĐÔNG", icon: "🥩", title: "Miền Bắc", description: "Đông đặc = tài lộc đông cứng, tiết kiệm dư dả", tag: "LẠNH" },
      { step: "GIÒ LỤA", icon: "🍖", title: "Miền Nam", description: "Tròn đẹp = cuộc đời tròn vẹn, sung túc viên mãn", tag: "TƯƠI" },
      { step: "NEM RÁN", icon: "🥢", title: "Cả nước", description: "Vàng ruộm = tiền vàng, năm mới phú quý bội thu", tag: "VÀNG" },
    ],
    duration: 14,
  },
  {
    type: "before_after",
    label: "MÓN 3",
    title: "CANH MĂNG / BÓNG BÌ",
    subtitle: "Mâm cỗ hoàn chỉnh — cầu chúc sung túc",
    titleColor: "gold",
    before: { label: "CANH MĂNG (miền Bắc)", duration: "Trường thọ" },
    after: { label: "CANH KHỔ QUA (miền Nam)", badge: "THUẬN LỢI" },
    metric: { from: "Vị ngọt", to: "Tài lộc", label: "ý nghĩa" },
    duration: 12,
  },
  {
    type: "cta",
    label: "CTA",
    title: "CHÚC MỪNG NĂM MỚI",
    subtitle: "An Khang Thịnh Vượng — Vạn Sự Như Ý",
    titleColor: "gold",
    ctaButton: "Bình luận món Tết yêu thích của bạn",
    ctaPrompt: "Tag người thân cùng xem nhé!",
    duration: 8,
  },
];

// ─── Rich outline (style guide cô đọng cho VPS) ───────────────────────────────
const RICH_OUTLINE = `
# PROFESSIONAL VIDEO GENERATION SPEC
Brand: VietFood Culture
Color Scheme: dark-gold
Total Scenes: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LAYOUT (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Each scene: 1280×720px HTML, 16:9
- Content LEFT 68% (870px). RIGHT 32% = facecam (DO NOT use)
- Background: #0a0a0a with 140 star particles
- Separator line at left:870px (1px rgba(255,255,255,0.08))

## COLOR PALETTE
- Background: #0a0a0a | Text: #FFFFFF
- Gold: #FFD700 | Green: #00CC66 | Red: #FF4444 | Cyan: #00D4FF
- Card border success: rgba(0,204,102,0.35) bg: rgba(0,204,102,0.05)
- Card border danger: rgba(255,68,68,0.35) bg: rgba(255,68,68,0.05)
- Card border default: rgba(255,255,255,0.12) bg: rgba(255,255,255,0.03)

## TYPOGRAPHY
- Hero title: 52px weight:800 color:#FFD700
- Subtitle: 15px opacity:0.6
- Scene label: 10px letter-spacing:3px font:monospace color:rgba(255,215,0,0.65)
- Card title: 17px weight:600 | Card desc: 13px opacity:0.55

## STAR PARTICLES (mandatory on every scene)
\`\`\`javascript
(function(){var bg=document.getElementById('star-bg');for(var i=0;i<140;i++){var s=document.createElement('div');var sz=Math.random()*2.2+0.4;s.style.cssText='position:absolute;border-radius:50%;background:#fff;pointer-events:none;width:'+sz+'px;height:'+sz+'px;left:'+(Math.random()*100)+'%;top:'+(Math.random()*100)+'%;opacity:'+(Math.random()*0.45+0.08)+';';bg.appendChild(s);}})();
\`\`\`

## GSAP (mandatory — load CDN then animate)
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
- Titles: gsap.from('.hero-title',{y:-30,opacity:0,duration:0.7})
- Cards: gsap.from('.card',{x:-50,opacity:0,duration:0.55,stagger:0.18,delay:0.3})
- Steps: gsap.from('.step',{y:30,opacity:0,duration:0.5,stagger:0.2,delay:0.4})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SCENE SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Scene 01 / 06 — HOOK
Scene label: "SCENE 01 / 06 — HOOK"
Title: "3 MÓN ĂN TẾT" (color:#FFD700, 60px weight:800)
Subtitle: "mang ý nghĩa Trường Thọ - Dư Dả" (highlight "Trường Thọ" and "Dư Dả" in gold)
Add decorative red lantern emojis 🏮 subtly positioned
Duration: 10s

### Scene 02 / 06 — Ý NGHĨA
Scene label: "SCENE 02 / 06 — Ý NGHĨA"
Title: "MÂM CỖ TẾT VIỆT NAM" (color:#FF4444)
Subtitle: "Mỗi món ăn là một lời cầu chúc"
Cards (danger variant):
  1. 🏮 "Truyền thống ngàn năm" / "Mâm cỗ Tết không chỉ là bữa ăn — đó là văn hóa, là tâm linh"
  2. 📿 "Ý nghĩa tâm linh" / "Mỗi món mang lời cầu chúc sức khỏe, tài lộc cho cả năm"
GSAP stagger cards from left
Duration: 12s

### Scene 03 / 06 — MÓN 1
Scene label: "SCENE 03 / 06 — MÓN 1"
Title: "BÁNH CHƯNG / BÁNH TÉT" (color:#00CC66)
Subtitle: "Trường Thọ — sống lâu, vuông tròn"
Cards (success variant):
  1. 🍃 "Bánh chưng (miền Bắc)" / "Hình vuông tượng trưng cho đất, lòng biết ơn tổ tiên"
  2. 🎋 "Bánh tét (miền Nam)" / "Hình trụ dài — cầu mong trường thọ, sống lâu khỏe mạnh"
Duration: 12s

### Scene 04 / 06 — MÓN 2
Scene label: "SCENE 04 / 06 — MÓN 2"
Title: "THỊT ĐÔNG / GIÒ CHẢ" (color:#00D4FF)
Subtitle: "Dư Dả — no đủ quanh năm"
Pipeline steps (horizontal, 3 steps):
  Step 1 [active]: icon:🥩 label:"THỊT ĐÔNG" title:"Miền Bắc" desc:"Đông đặc = tài lộc đông cứng, tiết kiệm dư dả" tag:"LẠNH"
  Step 2 [active]: icon:🍖 label:"GIÒ LỤA" title:"Miền Nam" desc:"Tròn đẹp = cuộc đời tròn vẹn, sung túc viên mãn" tag:"TƯƠI"
  Step 3 [active]: icon:🥢 label:"NEM RÁN" title:"Cả nước" desc:"Vàng ruộm = tiền vàng, năm mới phú quý bội thu" tag:"VÀNG"
Duration: 14s

### Scene 05 / 06 — MÓN 3
Scene label: "SCENE 05 / 06 — MÓN 3"
Title: "CANH MĂNG / BÓNG BÌ" (color:#FFD700)
Subtitle: "Mâm cỗ hoàn chỉnh — cầu chúc sung túc"
Before/After comparison:
  BEFORE: label:"CANH MĂNG (miền Bắc)" note:"Trường thọ"
  AFTER: label:"CANH KHỔ QUA (miền Nam)" badge:"THUẬN LỢI"
  Metric: "Vị ngọt" → "Tài lộc" (ý nghĩa)
Duration: 12s

### Scene 06 / 06 — CTA
Scene label: "SCENE 06 / 06 — CTA"
Title: "CHÚC MỪNG NĂM MỚI" (color:#FFD700, large 60px)
Subtitle: "An Khang Thịnh Vượng — Vạn Sự Như Ý"
Center of content area: big decorated CTA button "Bình luận món Tết yêu thích của bạn"
Below: "Tag người thân cùng xem nhé!" in muted text
Add gold/red festive decorations (🏮🎊🧧) around title
Duration: 8s

## GENERATION RULES
1. ONE HTML file per scene, standalone with all CSS inlined
2. Every scene MUST have star-bg div + star particle JS
3. Content only in LEFT 68% (870px) — right 32% empty
4. Load GSAP from CDN, animate ALL elements
5. Use Vietnamese text throughout
6. Brand: VietFood Culture
7. Background: #0a0a0a
8. Font: system-ui, Arial, sans-serif (NO Google Fonts CDN)
`;

async function uploadToCloudinary(filePath: string): Promise<string> {
  console.log(`\n[Upload] Đang upload video (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)}MB)...`);
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "video",
    folder: "igen_erp/test",
    timeout: 600000,
  });
  console.log(`[Upload] ✅ Cloudinary URL: ${result.secure_url}`);
  return result.secure_url;
}

async function checkVpsHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${VPS_URL}/health`);
    const data = await res.json() as any;
    console.log(`[VPS Health] status=${data.status} | anthropic_key=${data.anthropic_key_set} | version=${data.version || 'unknown'}`);
    return data.status === "ok";
  } catch (e: any) {
    console.error(`[VPS Health] Không kết nối được VPS: ${e.message}`);
    return false;
  }
}

async function submitRenderJob(facecamUrl: string): Promise<string> {
  console.log(`\n[Render] Gửi job lên VPS...`);
  const payload = {
    facecam_url: facecamUrl,
    outline: RICH_OUTLINE,
    scenes: TET_SCENES.map(s => s.type),
    brand_name: "VietFood Culture",
    bg_music_url: "",
    webhook_url: "",
    user_id: "test-user",
    record_id: `test-tet-${Date.now()}`,
  };

  const res = await fetch(`${VPS_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": VPS_KEY },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`VPS submit failed ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const taskId = data.task_id;
  console.log(`[Render] ✅ Job queued: ${taskId}`);
  return taskId;
}

async function pollResult(taskId: string): Promise<void> {
  console.log(`\n[Poll] Bắt đầu poll job ${taskId} (interval 12s, max 40 phút)...\n`);
  const maxPolls = 200;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, 12_000));
    try {
      const res = await fetch(`${VPS_URL}/status/${taskId}`, {
        headers: { "X-API-Key": VPS_KEY },
      });
      const data = await res.json() as any;
      const elapsed = ((i + 1) * 12 / 60).toFixed(1);
      console.log(`[Poll ${String(i+1).padStart(3, '0')}] ${elapsed}m | status=${data.status} | progress=${data.progress ?? '?'}% | ${data.current_step || ''}`);

      if (data.status === "done") {
        console.log(`\n🎉 HOÀN THÀNH! Video URL: ${data.result_url}`);
        return;
      }
      if (data.status === "failed") {
        console.error(`\n❌ THẤT BẠI: ${data.error}`);
        return;
      }
    } catch (e: any) {
      console.warn(`[Poll ${i+1}] Lỗi kết nối: ${e.message} — thử lại...`);
    }
  }
  console.error("\n⏰ Timeout sau 40 phút.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log("═══════════════════════════════════════════════════");
  console.log("  TEST: Professional Mode — Video 3 Món Ăn Tết");
  console.log("═══════════════════════════════════════════════════\n");

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Không tìm thấy video: ${VIDEO_PATH}`);
    process.exit(1);
  }

  // 1. Kiểm tra VPS
  const healthy = await checkVpsHealth();
  if (!healthy) {
    console.error("❌ VPS không khỏe. Dừng test.");
    process.exit(1);
  }

  // 2. Upload Cloudinary
  let facecamUrl: string;
  try {
    facecamUrl = await uploadToCloudinary(VIDEO_PATH);
  } catch (e: any) {
    console.error(`❌ Upload thất bại: ${e.message}`);
    process.exit(1);
  }

  // 3. Submit render job
  let taskId: string;
  try {
    taskId = await submitRenderJob(facecamUrl);
  } catch (e: any) {
    console.error(`❌ Submit thất bại: ${e.message}`);
    process.exit(1);
  }

  // 4. Poll result
  await pollResult(taskId);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST KẾT THÚC");
  console.log("═══════════════════════════════════════════════════");
})();
