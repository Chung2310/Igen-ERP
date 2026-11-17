import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, ImagePlus, LoaderCircle, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { ArchitectureImageToolKind, ArchitectureProject, ArchitectureRenderAsset, ArchitectureToolId, ArchitectureVideoJob } from "../../shared/architecture-assistant";
import type { ArchitectAssistantApi } from "./api";

type ToolPage = {
  id: ArchitectureImageToolKind;
  title: string;
  description: string;
  action: string;
  reference: "required" | "optional" | "none";
  prompt: string;
};

export const ARCHITECTURE_TOOL_NAV: Array<{ id: ArchitectureToolId; label: string }> = [
  { id: "plan", label: "Mặt bằng" },
  { id: "render", label: "Render" },
  { id: "staging", label: "Virtual staging" },
  { id: "visual", label: "Visual" },
  { id: "texture", label: "Vật liệu PBR" },
  { id: "human", label: "Human enhancer" },
  { id: "enhance", label: "Cải thiện ảnh" },
  { id: "upscale", label: "Phóng to ảnh" },
  { id: "video", label: "Video" },
  { id: "library", label: "Thư viện" },
];

const PAGES: Record<ArchitectureImageToolKind, ToolPage> = {
  render: {
    id: "render", title: "Render kiến trúc", description: "Tạo phối cảnh nội và ngoại thất từ mô tả hoặc ảnh tham chiếu.", action: "Tạo phối cảnh", reference: "optional",
    prompt: "Phối cảnh kiến trúc chân thực, góc máy rộng vừa, ánh sáng tự nhiên, vật liệu có độ chi tiết cao; giữ đúng tỷ lệ, hình khối và bố cục của ảnh tham chiếu.",
  },
  staging: {
    id: "staging", title: "Virtual staging", description: "Bố trí nội thất vào ảnh phòng trống, giữ nguyên góc máy và kiến trúc hiện có.", action: "Bố trí nội thất", reference: "required",
    prompt: "Bố trí nội thất hoàn chỉnh, hợp công năng và tỷ lệ phòng; giữ nguyên tường, cửa, cửa sổ, góc máy và phối cảnh của ảnh tham chiếu.",
  },
  visual: {
    id: "visual", title: "Visual kiến trúc", description: "Tạo hình ảnh ý tưởng với ánh sáng, thời điểm và không khí mong muốn.", action: "Tạo visual", reference: "optional",
    prompt: "Tạo visual kiến trúc có ánh sáng tự nhiên giàu chiều sâu, cân bằng vùng sáng tối và thể hiện rõ vật liệu.",
  },
  texture: {
    id: "texture", title: "Texture Lab", description: "Tạo mẫu vật liệu kiến trúc dạng lặp, dùng cho moodboard và phối cảnh.", action: "Tạo vật liệu", reference: "optional",
    prompt: "Tạo texture vật liệu kiến trúc dạng seamless tileable, nhìn chính diện, ánh sáng phẳng, chi tiết lặp liên tục không lộ đường nối.",
  },
  human: {
    id: "human", title: "Human enhancer", description: "Thêm người vào phối cảnh với tỷ lệ, trang phục và ánh sáng phù hợp bối cảnh.", action: "Thêm nhân vật", reference: "required",
    prompt: "Thêm người vào phối cảnh kiến trúc theo tỷ lệ thực tế, tư thế tự nhiên, ánh sáng và bóng đổ khớp với ảnh; không thay đổi kiến trúc.",
  },
  enhance: {
    id: "enhance", title: "Cải thiện ảnh", description: "Làm sạch chi tiết và ánh sáng của ảnh render mà vẫn giữ nguyên thiết kế.", action: "Cải thiện ảnh", reference: "required",
    prompt: "Cải thiện độ chân thực, ánh sáng, vật liệu và chi tiết của ảnh kiến trúc; giữ nguyên hình khối, đồ đạc, vị trí cửa và góc máy.",
  },
  upscale: {
    id: "upscale", title: "Phóng to ảnh", description: "Tái tạo chi tiết cho ảnh kiến trúc độ phân giải cao hơn.", action: "Phóng to ảnh", reference: "required",
    prompt: "Tăng độ phân giải và độ nét của ảnh kiến trúc, phục hồi chi tiết vật liệu; không đổi bố cục, màu sắc, hình khối hoặc thêm vật thể.",
  },
};

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const kinds: Array<{ value: ArchitectureToolId | "all"; label: string }> = [
  { value: "all", label: "Tất cả" }, { value: "render", label: "Render" }, { value: "staging", label: "Staging" },
  { value: "visual", label: "Visual" }, { value: "texture", label: "Vật liệu" }, { value: "human", label: "Nhân vật" },
  { value: "enhance", label: "Cải thiện" }, { value: "upscale", label: "Phóng to" }, { value: "video", label: "Video" },
];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được ảnh đã chọn."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function imageForUpload(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Ảnh không hợp lệ hoặc không đọc được."));
    image.onload = () => {
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Trình duyệt không thể xử lý ảnh."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.src = dataUrl;
  });
}

function friendlyError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không hoàn tất được yêu cầu.";
}

export function ArchitectureCreativeTools({
  tool, project, api, assetUrls, canUseAi, onProjectUpdated, onNavigate,
}: {
  tool: ArchitectureToolId;
  project: ArchitectureProject;
  api: ArchitectAssistantApi;
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  onProjectUpdated: (project: ArchitectureProject) => void;
  onNavigate: (tool: ArchitectureToolId) => void;
}) {
  if (tool === "library" || tool === "renders") {
    return <ArchitectureAssetLibrary assets={project.renders || []} assetUrls={assetUrls} onNavigate={onNavigate} />;
  }
  if (tool === "video") {
    return <ArchitectureVideoTool project={project} api={api} assetUrls={assetUrls} canUseAi={canUseAi} onProjectUpdated={onProjectUpdated} />;
  }
  if (tool === "plan") return null;
  return <ArchitectureImageTool page={PAGES[tool]} project={project} api={api} assets={project.renders || []} assetUrls={assetUrls} canUseAi={canUseAi} onProjectUpdated={onProjectUpdated} />;
}

function ArchitectureImageTool({ page, project, api, assets, assetUrls, canUseAi, onProjectUpdated }: {
  page: ToolPage;
  project: ArchitectureProject;
  api: ArchitectAssistantApi;
  assets: ArchitectureRenderAsset[];
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  onProjectUpdated: (project: ArchitectureProject) => void;
}) {
  const [prompt, setPrompt] = useState(page.prompt);
  const [style, setStyle] = useState(project.style);
  const [aspectRatio, setAspectRatio] = useState("4:3");
  const [lighting, setLighting] = useState("Ánh sáng tự nhiên");
  const [materialMap, setMaterialMap] = useState("Albedo");
  const [textureBrightness, setTextureBrightness] = useState(50);
  const [textureContrast, setTextureContrast] = useState(65);
  const [peopleCount, setPeopleCount] = useState(2);
  const [ethnicity, setEthnicity] = useState("Châu Á");
  const [outfit, setOutfit] = useState("Trang phục đời thường");
  const [reference, setReference] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [variants, setVariants] = useState(1);
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputId = `architecture-image-${page.id}`;
  const relatedAssets = useMemo(() => assets.filter(asset => (asset.kind || "render") === page.id).slice().reverse(), [assets, page.id]);

  const chooseReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chọn tệp ảnh PNG, JPEG hoặc WebP."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Ảnh phải nhỏ hơn 15 MB."); return; }
    try {
      setReference(await imageForUpload(await readImage(file)));
      setReferenceName(file.name);
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const optimize = async () => {
    setOptimizing(true); setError(""); setNotice("");
    try {
      const result = await api.optimizePrompt(project._id, { tool: page.id, prompt, style });
      if (result.prompt) setPrompt(result.prompt);
      setNotice("Đã tối ưu prompt.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setOptimizing(false); }
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUseAi) { setError("Tài khoản chưa được cấp quyền sử dụng AI kiến trúc."); return; }
    if (page.reference === "required" && !reference) { setError("Tải ảnh tham chiếu lên trước khi tạo."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      for (let index = 0; index < variants; index += 1) {
        const result = await api.generateImage(project._id, {
          kind: page.id,
          prompt: [
            `Phong cách thiết kế: ${style}.`,
            `Diện tích dự án: ${project.areaM2} m², ${project.floors} tầng.`,
            project.requirements ? `Yêu cầu: ${project.requirements}.` : "",
            page.id === "human" ? `Thêm ${peopleCount} người thuộc nhóm ${ethnicity}, trang phục ${outfit}.` : "",
            page.id === "visual" ? `Thiết lập ánh sáng: ${lighting}.` : "",
            page.id === "texture" ? `Bản đồ PBR ${materialMap}, độ sáng ${textureBrightness}%, tương phản ${textureContrast}%, cạnh lặp seamless.` : "",
            prompt,
          ].filter(Boolean).join(" "),
          aspectRatio,
          referenceImage: reference || undefined,
        });
        onProjectUpdated(result.project);
      }
      setNotice(variants > 1 ? `Đã tạo ${variants} phương án và lưu vào thư viện dự án.` : "Đã tạo phương án và lưu vào thư viện dự án.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div>
      <h4 data-typography="section-title" className="text-balance text-lg font-semibold text-on-surface">{page.title}</h4>
      <p className="mt-1 text-pretty text-sm text-on-surface-variant">{page.description}</p>
    </div>
    {!canUseAi && <p className="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant" role="status">Cần quyền `architect-ai:manage` để tạo hình bằng AI.</p>}
    {error && <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-on-surface" role="alert">{error}</p>}
    {notice && <p className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" role="status">{notice}</p>}
    <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]" onSubmit={generate} aria-busy={busy || optimizing}>
      <div className="space-y-4">
        {page.reference !== "none" && <div className="space-y-2">
          <label htmlFor={inputId} className="block text-sm font-medium text-on-surface">Ảnh tham chiếu{page.reference === "required" ? " (bắt buộc)" : " (tùy chọn)"}</label>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-on-primary-container`} aria-describedby={`${inputId}-hint`} />
          <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant">Ảnh được thu nhỏ trước khi gửi để tải nhanh hơn. {referenceName}</p>
          {reference && <img src={reference} alt="Ảnh tham chiếu đã chọn" className="max-h-64 max-w-full rounded-lg border border-outline-variant object-contain" />}
        </div>}
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Mô tả thiết kế</span><textarea required minLength={3} maxLength={1200} rows={7} value={prompt} onChange={event => setPrompt(event.target.value)} className={`${fieldClass} resize-y`} placeholder="Mô tả không gian, vật liệu, ánh sáng và góc nhìn mong muốn." /></label>
        {page.id === "visual" && <label className="block space-y-1.5 text-sm text-on-surface"><span>Preset ánh sáng</span><select value={lighting} onChange={event => setLighting(event.target.value)} className={fieldClass}><option>Ánh sáng tự nhiên</option><option>Golden hour</option><option>Blue hour</option><option>Trời nhiều mây</option><option>Ánh sáng nội thất ấm</option></select></label>}
        {page.id === "texture" && <div className="space-y-3 rounded-lg border border-outline-variant p-3">
          <span className="block text-sm font-medium text-on-surface">Bản đồ PBR</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Chọn loại bản đồ PBR">{["Albedo", "Roughness", "Normal", "Height"].map(value => <button key={value} type="button" aria-pressed={materialMap === value} onClick={() => setMaterialMap(value)} className={`min-h-9 rounded-md px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary ${materialMap === value ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container"}`}>{value}</button>)}</div>
          <label className="block space-y-1 text-xs text-on-surface-variant"><span>Độ sáng <span className="tabular-nums">{textureBrightness}%</span></span><input type="range" min={0} max={100} value={textureBrightness} onChange={event => setTextureBrightness(Number(event.target.value))} className="w-full accent-primary" /></label>
          <label className="block space-y-1 text-xs text-on-surface-variant"><span>Tương phản <span className="tabular-nums">{textureContrast}%</span></span><input type="range" min={0} max={100} value={textureContrast} onChange={event => setTextureContrast(Number(event.target.value))} className="w-full accent-primary" /></label>
        </div>}
        {page.id === "human" && <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5 text-sm text-on-surface"><span>Số người</span><select value={peopleCount} onChange={event => setPeopleCount(Number(event.target.value))} className={fieldClass}>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm text-on-surface"><span>Nhân vật</span><select value={ethnicity} onChange={event => setEthnicity(event.target.value)} className={fieldClass}><option>Châu Á</option><option>Châu Âu</option><option>Châu Phi</option><option>Châu Mỹ</option><option>Đa dạng</option></select></label>
          <label className="block space-y-1.5 text-sm text-on-surface"><span>Trang phục</span><select value={outfit} onChange={event => setOutfit(event.target.value)} className={fieldClass}><option>Trang phục đời thường</option><option>Trang phục công sở</option><option>Trang phục trang trọng</option><option>Trang phục thể thao</option></select></label>
        </div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void optimize()} disabled={!canUseAi || optimizing || busy || prompt.trim().length < 3} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
            {optimizing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-4" aria-hidden="true" />}{optimizing ? "Đang tối ưu…" : "Tối ưu prompt"}
          </button>
          <button type="button" onClick={() => setPrompt(page.prompt)} disabled={busy || optimizing} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><RefreshCw className="size-4" aria-hidden="true" />Khôi phục gợi ý</button>
        </div>
      </div>
      <aside className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Phong cách</span><input value={style} onChange={event => setStyle(event.target.value)} maxLength={100} className={fieldClass} /></label>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Tỷ lệ khung hình</span><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}><option>4:3</option><option>16:9</option><option>1:1</option><option>3:2</option><option>2:3</option><option>9:16</option></select></label>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Số phương án</span><select value={variants} onChange={event => setVariants(Number(event.target.value))} className={fieldClass}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <button type="submit" disabled={!canUseAi || busy || optimizing || (page.reference === "required" && !reference)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{busy ? "Đang tạo…" : page.action}
        </button>
        <p className="text-xs text-on-surface-variant">Kết quả được lưu cùng dự án và tính vào hạn mức AI của doanh nghiệp.</p>
      </aside>
    </form>
    <ArchitectureAssetLibrary assets={relatedAssets} assetUrls={assetUrls} title="Kết quả đã tạo" empty="Chưa có kết quả cho công cụ này." />
  </div>;
}

function ArchitectureVideoTool({ project, api, assetUrls, canUseAi, onProjectUpdated }: {
  project: ArchitectureProject;
  api: ArchitectAssistantApi;
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  onProjectUpdated: (project: ArchitectureProject) => void;
}) {
  const [prompt, setPrompt] = useState("Máy quay tiến chậm qua không gian nội thất, ánh sáng tự nhiên thay đổi nhẹ, cây xanh lay động, giữ nguyên kiến trúc và vật liệu.");
  const [reference, setReference] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<ArchitectureVideoJob | null>(null);
  const latestJob = job || project.videoJobs?.slice().reverse().find(item => item.status === "pending" || item.status === "in_progress") || null;
  const latestVideo = project.renders.slice().reverse().find(asset => asset.kind === "video" && assetUrls[asset.id]);

  const chooseReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chọn tệp ảnh PNG, JPEG hoặc WebP."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Ảnh phải nhỏ hơn 15 MB."); return; }
    try { setReference(await imageForUpload(await readImage(file))); }
    catch (cause) { setError(friendlyError(cause)); }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUseAi) { setError("Tài khoản chưa được cấp quyền sử dụng AI kiến trúc."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.createVideo(project._id, { prompt, aspectRatio, duration, resolution, generateAudio, referenceImage: reference || undefined });
      onProjectUpdated(result.project); setJob(result.job); setNotice("Đã gửi tác vụ video. Có thể mất vài phút để hoàn tất.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const refreshJob = async () => {
    if (!latestJob) return;
    setBusy(true); setError("");
    try {
      const result = await api.videoStatus(project._id, latestJob.id);
      onProjectUpdated(result.project); setJob(result.job);
      setNotice(result.job.status === "completed" ? "Video đã hoàn tất và được lưu vào thư viện." : result.job.status === "failed" ? result.job.error || "Không tạo được video." : "Video vẫn đang được xử lý.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const optimize = async () => {
    setBusy(true); setError("");
    try { const result = await api.optimizePrompt(project._id, { tool: "video", prompt, style: project.style }); if (result.prompt) setPrompt(result.prompt); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5" aria-busy={busy}>
    <div><h4 data-typography="section-title" className="text-balance text-lg font-semibold text-on-surface">Video kiến trúc</h4><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tạo video từ mô tả hoặc biến ảnh phối cảnh thành chuyển động ngắn.</p></div>
    {!canUseAi && <p className="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant" role="status">Cần quyền `architect-ai:manage` để tạo video bằng AI.</p>}
    {error && <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-on-surface" role="alert">{error}</p>}
    {notice && <p className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" role="status">{notice}</p>}
    <form onSubmit={create} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <label htmlFor="architecture-video-image" className="block text-sm font-medium text-on-surface">Ảnh khung hình đầu (tùy chọn)</label>
        <input id="architecture-video-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-on-primary-container`} />
        {reference && <img src={reference} alt="Ảnh đầu vào video" className="max-h-64 max-w-full rounded-lg border border-outline-variant object-contain" />}
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Mô tả chuyển động</span><textarea required minLength={3} maxLength={1200} rows={6} value={prompt} onChange={event => setPrompt(event.target.value)} className={`${fieldClass} resize-y`} /></label>
        <button type="button" onClick={() => void optimize()} disabled={!canUseAi || busy || prompt.trim().length < 3} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><WandSparkles className="size-4" aria-hidden="true" />Tối ưu kịch bản</button>
      </div>
      <aside className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Tỷ lệ video</span><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option></select></label>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Thời lượng</span><select value={duration} onChange={event => setDuration(Number(event.target.value))} className={fieldClass}><option value={4}>4 giây</option><option value={6}>6 giây</option><option value={8}>8 giây</option></select></label>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Độ phân giải</span><select value={resolution} onChange={event => setResolution(event.target.value)} className={fieldClass}><option>720p</option><option>1080p</option></select></label>
        <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface"><input type="checkbox" checked={generateAudio} onChange={event => setGenerateAudio(event.target.checked)} className="size-4 accent-primary" />Tạo âm thanh cùng video</label>
        <button type="submit" disabled={!canUseAi || busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{busy ? "Đang gửi…" : "Tạo video"}</button>
      </aside>
    </form>
    {latestJob && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant p-4">
      <div><p className="text-sm font-medium text-on-surface">Tác vụ gần nhất: {latestJob.status === "in_progress" ? "đang dựng video" : latestJob.status === "pending" ? "đang chờ" : latestJob.status === "completed" ? "đã hoàn tất" : "không thành công"}</p>{latestJob.error && <p className="mt-1 text-sm text-error">{latestJob.error}</p>}</div>
      {(latestJob.status === "pending" || latestJob.status === "in_progress") && <button type="button" onClick={() => void refreshJob()} disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><RefreshCw className="size-4" aria-hidden="true" />Kiểm tra tiến độ</button>}
    </div>}
    {latestVideo && <video src={assetUrls[latestVideo.id]} controls playsInline className="w-full max-w-3xl rounded-xl border border-outline-variant bg-surface" aria-label="Video kiến trúc đã tạo" />}
  </div>;
}

export function ArchitectureAssetLibrary({ assets, assetUrls, title = "Thư viện dự án", empty = "Chưa có hình ảnh hoặc video trong dự án.", onNavigate }: {
  assets: ArchitectureRenderAsset[];
  assetUrls: Record<string, string>;
  title?: string;
  empty?: string;
  onNavigate?: (tool: ArchitectureToolId) => void;
}) {
  const [filter, setFilter] = useState<ArchitectureToolId | "all">("all");
  const visible = assets.slice().reverse().filter(asset => filter === "all" || (asset.kind || "render") === filter);
  return <section className="space-y-4" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 data-typography="section-title" className="text-base font-semibold text-on-surface">{title} <span className="font-normal tabular-nums text-on-surface-variant">({visible.length})</span></h4>
      <label className="flex items-center gap-2 text-sm text-on-surface-variant">Lọc<select aria-label="Lọc nội dung thư viện" value={filter} onChange={event => setFilter(event.target.value as ArchitectureToolId | "all")} className={`${fieldClass} min-h-9 w-auto py-1.5`}>
        {kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
      </select></label>
    </div>
    {!visible.length ? <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant px-4 text-center"><ImagePlus className="mb-2 size-8 text-on-surface-variant" aria-hidden="true" /><p className="text-sm text-on-surface-variant">{empty}</p>{onNavigate && <button type="button" onClick={() => onNavigate("render")} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">Mở công cụ render</button>}</div> : <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {visible.map(asset => <figure key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        {assetUrls[asset.id] ? asset.mimeType === "video/mp4" ? <video src={assetUrls[asset.id]} controls playsInline className="aspect-video w-full bg-surface" aria-label={asset.filename} /> : <img src={assetUrls[asset.id]} alt={asset.filename} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-sm text-on-surface-variant" role="status"><LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />Đang tải tệp…</div>}
        <figcaption className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant"><span>{kinds.find(kind => kind.value === (asset.kind || "render"))?.label || "Render"}</span><span className="tabular-nums">{new Date(asset.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {Math.round(asset.bytes / 1024)} KB</span></div>
          {asset.prompt && <p className="line-clamp-2 text-xs text-on-surface-variant">{asset.prompt}</p>}
          {assetUrls[asset.id] && <a href={assetUrls[asset.id]} download={asset.filename} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-sm text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"><Download className="size-4" aria-hidden="true" />Tải xuống</a>}
        </figcaption>
      </figure>)}
    </div>}
  </section>;
}
