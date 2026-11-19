import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type Dispatch, type SetStateAction } from "react";
import { Check, Expand, ImagePlus, LoaderCircle, Maximize2, RefreshCw, Sparkles, WandSparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import type { ArchitectureImageToolKind, ArchitectureRenderAsset, ArchitectureSyncCategory } from "../../shared/architecture-assistant";
import { cn } from "../student-management/lib/utils";

type ToolPage = {
  id: ArchitectureImageToolKind;
  title: string;
  description: string;
  action: string;
  reference: "required" | "optional" | "none";
  prompt: string;
};

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const renderModes = [
  { value: "Ngoại thất", label: "Render Ngoại Thất" }, { value: "Nội thất", label: "Render Nội Thất" },
  { value: "VR 360", label: "Render VR 360" }, { value: "Floorplan to 3D", label: "Floorplan to 3D" },
  { value: "Floorplan to 3D Floorplan", label: "Floorplan to 3D Floorplan" }, { value: "Masterplan to 3D", label: "Masterplan to 3D" },
];

export default function ArchitectureImageWorkspace({
  page, previewUrl, assets, assetUrls, canUseAi, busy, optimizing, prompt, setPrompt, style, setStyle, aspectRatio, setAspectRatio,
  outputResolution, setOutputResolution,
  lighting, setLighting, materialMap, setMaterialMap, textureBrightness, setTextureBrightness, textureContrast, setTextureContrast,
  renderMode, setRenderMode, renderSpace, setRenderSpace, cameraAngle, setCameraAngle, colorTone, setColorTone, renderContext, setRenderContext,
  renderSourceImages, chooseRenderSource, removeRenderSource, renderDescription, setRenderDescription, renderImageStyle, setRenderImageStyle,
  renderRoomType, setRenderRoomType, interiorStyle, setInteriorStyle, buildingStyle, setBuildingStyle, customCameraAngle, setCustomCameraAngle,
  editMode, setEditMode,
  peopleCount, setPeopleCount, ethnicity, setEthnicity, outfit, setOutfit, reference, referenceName, referenceImages, removeReference, chooseReference,
  stagingMode, setStagingMode, stagingRoom, setStagingRoom, stagingStyle, setStagingStyle, stagingCount, setStagingCount,
  syncMode, setSyncMode, characterSource, setCharacterSource, characterPrompt, setCharacterPrompt, scenePrompts, setScenePrompt,
  canvasTool, setCanvasTool, presentationStyle, setPresentationStyle, utilityTool, setUtilityTool,
  syncCategories, analyzingSync, onAnalyzeSync,
  variants, setVariants, visualMode, setVisualMode, quality, setQuality, projectType, setProjectType,
  seamless, setSeamless, marking, setMarking, regionPoints, setRegionPoints, regions, setRegions,
  error, notice, onOptimize, onGenerate, onRestore, onUseAsReference, onUseAsRenderSource,
}: {
  page: ToolPage;
  previewUrl: string;
  assets: ArchitectureRenderAsset[];
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  busy: boolean;
  optimizing: boolean;
  prompt: string;
  setPrompt: (value: string) => void;
  style: string;
  setStyle: (value: string) => void;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  outputResolution: string;
  setOutputResolution: (value: string) => void;
  lighting: string;
  setLighting: (value: string) => void;
  renderMode: string;
  setRenderMode: (value: string) => void;
  renderSourceImages: Array<{ url: string; name: string }>;
  chooseRenderSource: (files: File[]) => void;
  removeRenderSource: (index: number) => void;
  renderDescription: string;
  setRenderDescription: (value: string) => void;
  renderImageStyle: string;
  setRenderImageStyle: (value: string) => void;
  renderRoomType: string;
  setRenderRoomType: (value: string) => void;
  interiorStyle: string;
  setInteriorStyle: (value: string) => void;
  buildingStyle: string;
  setBuildingStyle: (value: string) => void;
  customCameraAngle: string;
  setCustomCameraAngle: (value: string) => void;
  renderSpace: string;
  setRenderSpace: (value: string) => void;
  cameraAngle: string;
  setCameraAngle: (value: string) => void;
  colorTone: string;
  setColorTone: (value: string) => void;
  renderContext: string;
  setRenderContext: (value: string) => void;
  editMode: string;
  setEditMode: (value: string) => void;
  materialMap: string;
  setMaterialMap: (value: string) => void;
  textureBrightness: number;
  setTextureBrightness: (value: number) => void;
  textureContrast: number;
  setTextureContrast: (value: number) => void;
  peopleCount: number;
  setPeopleCount: (value: number) => void;
  ethnicity: string;
  setEthnicity: (value: string) => void;
  outfit: string;
  setOutfit: (value: string) => void;
  stagingMode: "virtual" | "renovation";
  setStagingMode: (value: "virtual" | "renovation") => void;
  stagingRoom: string;
  setStagingRoom: (value: string) => void;
  stagingStyle: string;
  setStagingStyle: (value: string) => void;
  stagingCount: number;
  setStagingCount: (value: number) => void;
  reference: string;
  referenceName: string;
  referenceImages: Array<{ url: string; name: string }>;
  removeReference: (index: number) => void;
  chooseReference: (files: File[]) => void;
  syncMode: "project" | "character";
  setSyncMode: (mode: "project" | "character") => void;
  characterSource: "upload" | "prompt";
  setCharacterSource: (mode: "upload" | "prompt") => void;
  characterPrompt: string;
  setCharacterPrompt: (value: string) => void;
  canvasTool: string;
  setCanvasTool: (value: string) => void;
  presentationStyle: string;
  setPresentationStyle: (value: string) => void;
  utilityTool: string;
  setUtilityTool: (value: string) => void;
  scenePrompts: string[];
  setScenePrompt: (index: number, value: string) => void;
  syncCategories: ArchitectureSyncCategory[];
  analyzingSync: boolean;
  onAnalyzeSync: () => void;
  variants: number;
  setVariants: (value: number) => void;
  visualMode: "render" | "edit" | "mood";
  setVisualMode: (value: "render" | "edit" | "mood") => void;
  quality: number;
  setQuality: (value: number) => void;
  projectType: string;
  setProjectType: (value: string) => void;
  seamless: boolean;
  setSeamless: (value: boolean) => void;
  marking: boolean;
  setMarking: (value: boolean | ((current: boolean) => boolean)) => void;
  regionPoints: Array<{ x: number; y: number }>;
  setRegionPoints: Dispatch<SetStateAction<Array<{ x: number; y: number }>>>;
  regions: Array<{ label: string; points: Array<{ x: number; y: number }> }>;
  setRegions: Dispatch<SetStateAction<Array<{ label: string; points: Array<{ x: number; y: number }> }>>>;
  error: string;
  notice: string;
  onOptimize: () => void;
  onGenerate: (event: FormEvent<HTMLFormElement>) => void;
  onRestore: () => void;
  onUseAsReference: (asset: ArchitectureRenderAsset) => void;
  onUseAsRenderSource: (asset: ArchitectureRenderAsset) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const [manualPreview, setManualPreview] = useState("");
  const [comparePosition, setComparePosition] = useState(50);
  useEffect(() => setManualPreview(""), [previewUrl]);
  useEffect(() => setAspectRatio(page.id === "render" ? "Tự động" : "4:3"), [page.id]);
  const activePreview = manualPreview || previewUrl;
  const showingSavedResult = assets.some(asset => assetUrls[asset.id] === activePreview);
  const compareSource = page.id === "render" ? renderSourceImages[0]?.url || "" : reference;
  const canCompare = Boolean(compareSource && showingSavedResult && activePreview !== compareSource);
  const hasRenderInput = page.id === "render" && Boolean(renderSourceImages.length || referenceImages.length);
  const inputId = `architecture-image-${page.id}`;
  const isCropEdit = page.id === "edit" && editMode === "Crop để sửa";
  const syncCharacter = page.id === "sync" && syncMode === "character";
  const utilityNeedsPair = page.id === "utilities" && ["insert-building", "merge-interior"].includes(utilityTool);
  const renderNeedsSource = page.id === "render" && ["Floorplan to 3D", "Floorplan to 3D Floorplan", "Masterplan to 3D"].includes(renderMode);
  const missingRequiredReference = renderNeedsSource && !renderSourceImages.length || page.reference === "required" && (
    syncCharacter
      ? characterSource === "prompt"
        ? !referenceImages.length || characterPrompt.trim().length < 3
        : referenceImages.length < 2
      : !reference || utilityNeedsPair && referenceImages.length < 2
  );
  const actionLabel = page.id === "utilities"
    ? utilityTool === "mood" ? "Tạo 4 moods" : utilityTool === "virtual-tour" ? "Tạo panorama 360°" : "Xử lý ảnh"
    : page.id === "canvas" ? `Tạo ${canvasTool}` : page.action;
  const chooseRenderMode = (value: string) => {
    setRenderMode(value);
    if (value === "VR 360") { setAspectRatio("21:9"); setRenderImageStyle("Ảnh Panorama 360 độ"); }
    else if (value === "Floorplan to 3D") { setAspectRatio("Tự động"); setRenderImageStyle("Phối cảnh thực tế"); setCameraAngle("Góc nhìn ngang tầm mắt"); }
    else if (value === "Floorplan to 3D Floorplan") { setAspectRatio("Tự động"); setRenderImageStyle("Ảnh phối cảnh 3D mặt bằng"); setCameraAngle("Phối cảnh trục đo (Isometric)"); }
    else if (value === "Masterplan to 3D") { setAspectRatio("Tự động"); setRenderImageStyle("Ảnh phối cảnh 3D tổng thể"); }
    else { setAspectRatio("Tự động"); setRenderImageStyle(value === "Nội thất" ? "Ảnh chụp thực tế nội thất" : "Ảnh chụp thực tế công trình"); }
  };
  const pointList = (points: Array<{ x: number; y: number }>) => points.map(point => `${point.x},${point.y}`).join(" ");
  const pointAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };
  const addRegionPoint = (event: PointerEvent<SVGSVGElement>) => {
    setRegionPoints(points => [...points, pointAt(event)]);
  };
  const startCrop = (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = pointAt(event);
    cropStartRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    setRegionPoints([point, point]);
  };
  const moveCrop = (event: PointerEvent<SVGSVGElement>) => {
    const start = cropStartRef.current;
    if (!start) return;
    setRegionPoints([start, pointAt(event)]);
  };
  const endCrop = (event: PointerEvent<SVGSVGElement>) => {
    const start = cropStartRef.current;
    if (!start) return;
    const end = pointAt(event);
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    cropStartRef.current = null;
    if (right - left >= 2 && bottom - top >= 2) {
      setRegions(current => [...current, { label: `Vùng ${current.length + 1}`, points: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }] }]);
      setMarking(false);
    }
    setRegionPoints([]);
  };
  const cancelCrop = () => {
    cropStartRef.current = null;
    setRegionPoints([]);
  };
  const finishRegion = () => {
    if (regionPoints.length < 3) return;
    setRegions(current => [...current, { label: `Vùng ${current.length + 1}`, points: regionPoints }]);
    setRegionPoints([]);
    setMarking(false);
  };

  const settings = <aside className="space-y-5 rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h3 data-typography="section-title" className="text-balance text-lg font-semibold leading-7 text-on-surface">{page.id === "render" ? "2. Mô tả & tùy chọn" : page.id === "visual" ? "Cài đặt Visual" : page.id === "texture" ? "Thông số vật liệu" : page.id === "staging" ? "Bố trí nội thất" : page.id === "human" ? "Nhân vật" : page.title}</h3>
      <WandSparkles className="size-4 text-primary" aria-hidden="true" />
    </div>

    {page.id === "sync" && <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Chế độ đồng bộ</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chế độ đồng bộ hình ảnh">
        {([{ id: "project", label: "Đồng bộ công trình" }, { id: "character", label: "Đồng bộ nhân vật" }] as const).map(mode => <button key={mode.id} type="button" aria-pressed={syncMode === mode.id} onClick={() => setSyncMode(mode.id)} className={cn("min-h-10 rounded-lg border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", syncMode === mode.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{mode.label}</button>)}
      </div>
      {syncMode === "character" && <p className="text-xs text-on-surface-variant">Ảnh đầu tiên dùng nhận diện nhân vật; mỗi ảnh tiếp theo là một bối cảnh đích. Mỗi bối cảnh sẽ tạo một kết quả riêng.</p>}
    </fieldset>}

    {syncCharacter && <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Nguồn nhân vật</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chọn cách cung cấp nhân vật">
        {([{ id: "upload", label: "Tải ảnh nhân vật" }, { id: "prompt", label: "Tạo từ mô tả" }] as const).map(source => <button key={source.id} type="button" aria-pressed={characterSource === source.id} onClick={() => setCharacterSource(source.id)} className={cn("min-h-10 rounded-lg border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", characterSource === source.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{source.label}</button>)}
      </div>
      {characterSource === "prompt" && <label className="block space-y-1.5 text-sm text-on-surface"><span>Mô tả nhân vật</span><textarea value={characterPrompt} onChange={event => setCharacterPrompt(event.target.value)} minLength={3} maxLength={1000} rows={3} required className={`${fieldClass} resize-y`} placeholder="Ví dụ: kiến trúc sư nữ khoảng 30 tuổi, tóc đen ngang vai, áo sơ mi trắng và quần âu…" /></label>}
      <p className="text-xs text-on-surface-variant">{characterSource === "upload" ? "Dùng ảnh chân dung/toàn thân có sẵn làm mẫu nhận diện." : "AI tạo ảnh nhận diện nhân vật trước, rồi ghép lần lượt vào từng bối cảnh đã tải."}</p>
    </fieldset>}

    {page.id === "canvas" && <div className="space-y-3">
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Loại bảng trình bày</span><select value={canvasTool} onChange={event => setCanvasTool(event.target.value)} className={fieldClass}>
        <option>Presentation Board</option><option>Overall</option><option>Layout</option><option>Interior Moodboard</option><option>Advanced Layout</option>
      </select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Phong cách trình bày</span><select value={presentationStyle} onChange={event => setPresentationStyle(event.target.value)} className={fieldClass}>
        <option>Minimalist (Tối giản)</option><option>Technical Blueprint (Bản vẽ kỹ thuật)</option><option>Watercolor Sketch (Màu nước)</option><option>Photorealistic (Thực tế)</option><option>Diagrammatic (Sơ đồ khối)</option><option>Monochrome (Đen trắng)</option>
      </select></label>
    </div>}

    {page.id === "utilities" && <div className="space-y-2">
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Công cụ</span><select value={utilityTool} onChange={event => { setUtilityTool(event.target.value); if (event.target.value === "virtual-tour") setAspectRatio("21:9"); }} className={fieldClass}>
        <option value="mood">Tạo 4 mood cho render</option><option value="google-map">Google Map sang phối cảnh 3D</option><option value="insert-building">Chèn công trình vào hiện trạng</option><option value="virtual-tour">Tạo panorama tham quan ảo</option><option value="merge-interior">Ghép nội thất theo ảnh mẫu</option><option value="colorize-floorplan">Đổ màu floorplan</option>
      </select></label>
      <p className="text-xs text-on-surface-variant">{utilityNeedsPair ? utilityTool === "insert-building" ? "Tải ảnh hiện trạng trước, sau đó tải ảnh công trình cần chèn." : "Tải ảnh phòng trống trước, sau đó tải ảnh nội thất làm mẫu." : utilityTool === "mood" ? "Tạo bốn phương án giữ nguyên thiết kế với ánh sáng sáng sớm, trưa, chiều và ban đêm." : utilityTool === "google-map" ? "Dùng ảnh bản đồ hoặc ảnh chụp hiện trạng khu đất làm tham chiếu." : utilityTool === "virtual-tour" ? "Tạo ảnh panorama 360 độ từ ảnh render kiến trúc." : "Tải ảnh mặt bằng đen trắng để AI giữ nguyên tường và ký hiệu khi tô vật liệu."}</p>
    </div>}

    {page.id === "render" && <fieldset className="space-y-2 rounded-xl border border-outline-variant p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">1. Tải ảnh nguồn · {renderNeedsSource ? "Bắt buộc" : "Tùy chọn"}</legend>
      <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseRenderSource(Array.from(event.dataTransfer.files)); }} className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low px-3 text-center text-xs text-on-surface-variant hover:border-primary hover:text-primary focus-within:border-primary focus-within:text-primary"><ImagePlus className="size-5" aria-hidden="true" /><span>{renderSourceImages.length ? `${renderSourceImages.length}/10 ảnh nguồn` : "Kéo thả hoặc nhấn để tải ảnh công trình / mặt bằng"}</span><input id="architecture-render-source" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; chooseRenderSource(files); }} className="sr-only" aria-describedby="architecture-render-source-hint" /></label>
      <p id="architecture-render-source-hint" className="text-xs text-on-surface-variant">{renderNeedsSource ? "Chế độ này cần ảnh nguồn để giữ đúng bố cục và cấu trúc." : "Có thể render từ mô tả hoặc dùng ảnh nguồn để giữ hình khối và góc nhìn."} PNG, JPG, WEBP hoặc PDF; mỗi trang PDF thành một ảnh. Tối đa 10 ảnh, 15 MB mỗi tệp.</p>
      {!!renderSourceImages.length && <ul className="grid grid-cols-2 gap-2" aria-label="Ảnh nguồn đã tải">{renderSourceImages.map((image, index) => <li key={`${image.name}-${index}`} className="relative overflow-hidden rounded-lg border border-outline-variant"><img src={image.url} alt={`Ảnh nguồn ${index + 1}: ${image.name}`} className="aspect-video w-full object-cover" /><button type="button" onClick={() => removeRenderSource(index)} aria-label={`Xóa ảnh nguồn ${image.name}`} className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface hover:text-error focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button><span className="block truncate px-2 py-1 text-xs text-on-surface-variant">{image.name}</span></li>)}</ul>}
    </fieldset>}

    {page.reference !== "none" && <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">{page.id === "render" ? "Ảnh tham khảo phong cách" : "Ảnh tham chiếu"} · {page.reference === "required" ? "Bắt buộc" : "Tùy chọn"}</label>
      <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseReference(Array.from(event.dataTransfer.files)); }} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low px-3 text-center text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-within:border-primary focus-within:text-primary">
        <ImagePlus className="size-6" aria-hidden="true" />
        <span>{referenceImages.length ? `${referenceImages.length}/10 ảnh · ${referenceName}` : "Kéo thả hoặc nhấn để tải ảnh"}</span>
        <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; chooseReference(files); }} className="sr-only" aria-describedby={`${inputId}-hint`} />
      </label>
      <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant">{page.id === "edit" ? "Ảnh đầu tiên là ảnh nền cần chỉnh; ảnh sau dùng làm mẫu đối tượng hoặc vật liệu. Tối đa 10 ảnh." : page.id === "render" ? "Dùng ảnh để tham khảo phong cách, bảng màu hoặc vật liệu; ảnh nguồn được tải riêng. Tối đa 10 ảnh." : syncCharacter ? characterSource === "upload" ? "Chọn ảnh nhân vật trước, sau đó chọn tối đa 9 ảnh bối cảnh." : "Chọn tối đa 10 ảnh bối cảnh đích; mỗi ảnh có mô tả riêng." : page.id === "utilities" && utilityNeedsPair ? "Chọn đúng thứ tự: ảnh hiện trạng/phòng trước, ảnh công trình/nội thất mẫu sau." : "Chọn tối đa 10 ảnh."} Ảnh được thu nhỏ trước khi gửi; PNG, JPEG hoặc WebP, tối đa 15 MB mỗi ảnh.</p>
      {!!referenceImages.length && <ul className="grid grid-cols-1 gap-2" aria-label="Ảnh tham chiếu đã chọn">{referenceImages.map((item, index) => <li key={`${item.name}-${index}`} className="relative flex min-w-0 items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-2 pr-10"><img src={item.url} alt={item.name} className="size-12 shrink-0 rounded-md object-cover" /><div className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-on-surface">{syncCharacter ? characterSource === "upload" && index === 0 ? `Nhân vật · ${item.name}` : `Bối cảnh ${characterSource === "upload" ? index : index + 1} · ${item.name}` : page.id === "utilities" && utilityNeedsPair ? index === 0 ? `Ảnh hiện trạng · ${item.name}` : `Ảnh mẫu · ${item.name}` : item.name}</span>{syncCharacter && (characterSource === "prompt" || index > 0) && <input aria-label={`Mô tả bối cảnh ${characterSource === "upload" ? index : index + 1}`} value={scenePrompts[characterSource === "upload" ? index : index + 1] || ""} onChange={event => setScenePrompt(characterSource === "upload" ? index : index + 1, event.target.value)} maxLength={1200} placeholder="Góc nhìn hoặc yêu cầu cho bối cảnh này" className={`${fieldClass} mt-1 min-h-8 py-1.5 text-xs`} />}</div><button type="button" onClick={() => removeReference(index)} aria-label={`Xóa ảnh tham chiếu ${item.name}`} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button></li>)}</ul>}
    </div>}

    {page.id === "visual" && <>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Loại dự án</legend>
        <div className="grid gap-2">{[
          ["apartment", "Chung cư cao cấp", "apartment"], ["house", "Nhà phố / Biệt thự", "home"], ["office", "Văn phòng / Studio", "storefront"],
        ].map(([value, label, icon]) => <button key={value} type="button" aria-pressed={projectType === value} onClick={() => setProjectType(value)} className={cn("flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary", projectType === value ? "border border-primary/20 bg-surface-container-low font-semibold text-primary" : "text-on-surface-variant hover:bg-surface-container-low")}>
          <span className="inline-flex items-center gap-3"><span className="material-symbols-outlined text-lg" aria-hidden="true">{icon}</span>{label}</span>{projectType === value && <Check className="size-4" aria-hidden="true" />}
        </button>)}</div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Chất lượng</legend>
        <div className="flex justify-end"><span className="text-xs font-bold text-primary">{quality === 100 ? "MASTER" : quality >= 75 ? "2K QHD" : "DRAFT"}</span></div>
        <input aria-label="Chất lượng visual" type="range" min={25} max={100} step={25} value={quality} onChange={event => setQuality(Number(event.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-[10px] font-bold text-on-surface-variant"><span>DRAFT</span><span>FINAL</span><span>MASTER</span></div>
      </fieldset>
      <label className="block space-y-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant"><span>Preset ánh sáng</span><select value={lighting} onChange={event => setLighting(event.target.value)} className={fieldClass}><option>Ánh sáng tự nhiên</option><option>Golden hour</option><option>Blue hour</option><option>Trời nhiều mây</option><option>Ánh sáng nội thất ấm</option></select></label>
    </>}

    {page.id === "render" && <>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Mô tả ý tưởng</span><textarea value={renderDescription} onChange={event => setRenderDescription(event.target.value)} maxLength={1200} rows={3} className={`${fieldClass} resize-y`} placeholder="Mô tả công trình, vật liệu, cảnh quan hoặc thay đổi cần thể hiện…" /></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Kiểu thể hiện</span><select value={renderImageStyle} onChange={event => setRenderImageStyle(event.target.value)} className={fieldClass}>
        {(renderMode === "Floorplan to 3D" ? ["Phối cảnh thực tế", "Phối cảnh 3D", "Mô hình thu nhỏ"] : renderMode === "Floorplan to 3D Floorplan" ? ["Ảnh phối cảnh 3D mặt bằng", "Mô hình axonometric", "Mô hình thu nhỏ"] : renderMode === "Masterplan to 3D" ? ["Ảnh phối cảnh 3D tổng thể", "Ảnh chụp thực tế trên không", "Mô hình quy hoạch 3D"] : renderMode === "VR 360" ? ["Ảnh Panorama 360 độ"] : renderMode === "Nội thất" ? ["Ảnh chụp thực tế nội thất", "Phối cảnh 3D nội thất", "Mô hình thu nhỏ"] : ["Ảnh chụp thực tế công trình", "Phối cảnh 3D", "Phác thảo kiến trúc", "Mô hình thu nhỏ"]).map(value => <option key={value}>{value}</option>)}
      </select></label>
      {renderMode !== "Floorplan to 3D Floorplan" && <label className="block space-y-1.5 text-sm text-on-surface"><span>Không gian / công trình</span><select value={renderSpace} onChange={event => setRenderSpace(event.target.value)} className={fieldClass}><option>Căn hộ</option><option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option><option>Phòng tắm</option><option>Nhà phố</option><option>Biệt thự</option><option>Văn phòng</option><option>Quán cà phê</option><option>Khu nghỉ dưỡng</option><option>Khu đô thị</option></select></label>}
      {(renderMode === "Floorplan to 3D" || renderMode === "Nội thất") && <>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Chức năng phòng</span><select value={renderRoomType} onChange={event => setRenderRoomType(event.target.value)} className={fieldClass}><option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option><option>Phòng ăn</option><option>Phòng tắm</option><option>Phòng làm việc</option><option>Không gian sinh hoạt chung</option></select></label>
        <label className="block space-y-1.5 text-sm text-on-surface"><span>Phong cách nội thất</span><select value={interiorStyle} onChange={event => setInteriorStyle(event.target.value)} className={fieldClass}>{["Hiện đại", "Bắc Âu", "Tối giản", "Japandi", "Công nghiệp", "Đương đại", "Cổ điển", "Sang trọng", "Wabi Sabi", "Mid-century Modern"].map(value => <option key={value}>{value}</option>)}</select></label>
      </>}
      {["Ngoại thất", "VR 360", "Masterplan to 3D", "Floorplan to 3D Floorplan"].includes(renderMode) && <label className="block space-y-1.5 text-sm text-on-surface"><span>Loại công trình</span><select value={buildingStyle} onChange={event => setBuildingStyle(event.target.value)} className={fieldClass}><option>Căn hộ</option><option>Nhà phố</option><option>Biệt thự</option><option>Văn phòng</option><option>Quán cà phê</option><option>Khu nghỉ dưỡng</option><option>Khu đô thị</option></select></label>}
      <label className="block space-y-1.5 text-sm text-on-surface"><span>{renderMode === "Floorplan to 3D Floorplan" ? "Kiểu góc nhìn mặt bằng" : "Góc máy"}</span><select value={cameraAngle} onChange={event => setCameraAngle(event.target.value)} className={fieldClass}>{renderMode === "Floorplan to 3D Floorplan" ? <><option>Phối cảnh trục đo (Isometric)</option><option>Top-down View</option></> : <><option>Phối cảnh trục đo (Isometric)</option><option>Góc nhìn ngang tầm mắt</option><option>Góc rộng từ trên cao</option><option>Góc nhìn chính diện</option><option>Góc nhìn 3/4</option><option>Toàn cảnh trên không</option><option>Panorama 360 độ</option><option>Tùy chỉnh</option></>}</select></label>
      {cameraAngle === "Tùy chỉnh" && renderMode !== "Floorplan to 3D Floorplan" && <label className="block space-y-1.5 text-sm text-on-surface"><span>Mô tả góc máy</span><input value={customCameraAngle} onChange={event => setCustomCameraAngle(event.target.value)} maxLength={160} className={fieldClass} placeholder="Ví dụ: nhìn chéo từ cổng chính, máy ngang tầm mắt" /></label>}
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Ánh sáng</span><select value={lighting} onChange={event => setLighting(event.target.value)} className={fieldClass}><option>Ánh sáng tự nhiên</option><option>Nắng ban mai</option><option>Golden hour</option><option>Blue hour</option><option>Trời nhiều mây</option><option>Ánh sáng nội thất ấm</option><option>Ánh sáng studio</option></select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Tông màu</span><select value={colorTone} onChange={event => setColorTone(event.target.value)} className={fieldClass}><option>Trung tính tự nhiên</option><option>Tông ấm</option><option>Tông lạnh</option><option>Trắng sáng</option><option>Đậm tương phản</option><option>Pastel nhẹ</option></select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Bối cảnh bổ sung</span><textarea value={renderContext} onChange={event => setRenderContext(event.target.value)} maxLength={400} rows={2} className={`${fieldClass} resize-y`} placeholder="Cây xanh, cảnh quan, thời tiết…" /></label>
    </>}

    {page.id === "texture" && <>
      <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Bản đồ PBR</legend><div className="grid grid-cols-2 gap-2" role="group" aria-label="Chọn bản đồ PBR">{["Albedo", "Roughness", "Normal", "Height"].map(value => <button key={value} type="button" aria-pressed={materialMap === value} onClick={() => setMaterialMap(value)} className={cn("min-h-10 rounded-lg text-xs font-bold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-primary", materialMap === value ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface")}>{value}</button>)}</div></fieldset>
      <label className="block space-y-2 text-xs font-semibold text-on-surface-variant"><span className="flex justify-between"><span>Độ sáng</span><span className="tabular-nums text-primary">{textureBrightness}%</span></span><input aria-label="Độ sáng texture" type="range" min={0} max={100} value={textureBrightness} onChange={event => setTextureBrightness(Number(event.target.value))} className="w-full accent-primary" /></label>
      <label className="block space-y-2 text-xs font-semibold text-on-surface-variant"><span className="flex justify-between"><span>Độ tương phản</span><span className="tabular-nums text-primary">{textureContrast}%</span></span><input aria-label="Độ tương phản texture" type="range" min={0} max={100} value={textureContrast} onChange={event => setTextureContrast(Number(event.target.value))} className="w-full accent-primary" /></label>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 text-sm text-on-surface"><span><span className="block font-semibold">Kiểm tra Seamless</span><span className="mt-0.5 block text-xs text-on-surface-variant">Tạo cạnh lặp liên tục</span></span><input type="checkbox" checked={seamless} onChange={event => setSeamless(event.target.checked)} className="size-4 accent-primary" /></label>
    </>}

    {page.id === "human" && <div className="space-y-3">
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Số người</span><select value={peopleCount} onChange={event => setPeopleCount(Number(event.target.value))} className={fieldClass}>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Đặc điểm nhân vật</span><select value={ethnicity} onChange={event => setEthnicity(event.target.value)} className={fieldClass}><option>Châu Á</option><option>Châu Âu</option><option>Châu Phi</option><option>Châu Mỹ</option><option>Đa dạng</option></select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Trang phục</span><select value={outfit} onChange={event => setOutfit(event.target.value)} className={fieldClass}><option>Trang phục đời thường</option><option>Trang phục công sở</option><option>Trang phục trang trọng</option><option>Trang phục thể thao</option><option>Trang phục mùa đông</option></select></label>
    </div>}

    {page.id === "staging" && <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Loại hình xử lý</legend>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Loại hình xử lý ảnh">
          {([{ id: "virtual", label: "Virtual staging" }, { id: "renovation", label: "Renovation" }] as const).map(mode => <button key={mode.id} type="button" aria-pressed={stagingMode === mode.id} onClick={() => setStagingMode(mode.id)} className={cn("min-h-10 rounded-lg border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", stagingMode === mode.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{mode.label}</button>)}
        </div>
      </fieldset>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Công năng phòng</span><select value={stagingRoom} onChange={event => setStagingRoom(event.target.value)} className={fieldClass}><option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option><option>Phòng ăn</option><option>Phòng làm việc</option></select></label>
      <label className="block space-y-1.5 text-sm text-on-surface"><span>Phong cách thiết kế</span><select value={stagingStyle} onChange={event => setStagingStyle(event.target.value)} className={fieldClass}>{["Scandinavian", "Modern", "Minimalist", "Japandi", "Industrial", "Contemporary", "Classic", "Luxury", "Wabi Sabi", "Mid-century Modern"].map(styleName => <option key={styleName}>{styleName}</option>)}</select></label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Số phương án</legend>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Số phương án virtual staging">{[1, 2, 4].map(count => <button key={count} type="button" aria-pressed={stagingCount === count} onClick={() => setStagingCount(count)} className={cn("min-h-9 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", stagingCount === count ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{count}</button>)}</div>
      </fieldset>
    </div>}

    {page.id === "sync" && syncMode === "project" && <section className="space-y-3" aria-label="Phân tích ảnh đồng bộ">
      <button type="button" onClick={onAnalyzeSync} disabled={!canUseAi || !reference || busy || optimizing || analyzingSync} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
        {analyzingSync ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-4" aria-hidden="true" />}
        {analyzingSync ? "Đang phân tích ảnh…" : "Phân tích ảnh và gợi ý góc nhìn"}
      </button>
      {!!syncCategories.length && <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-surface-container-low p-3">
        {syncCategories.map(category => <fieldset key={category.name} className="space-y-1.5">
          <legend className="pb-1 text-xs font-semibold text-on-surface">{category.name}</legend>
          <div className="grid gap-1.5" role="group" aria-label={`Gợi ý ${category.name}`}>
            {category.suggestions.map(suggestion => <button key={suggestion.id} type="button" aria-pressed={prompt === suggestion.text} onClick={() => setPrompt(suggestion.text)} className={cn("min-h-9 rounded-lg border px-2.5 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary", prompt === suggestion.text ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface hover:bg-surface-container-lowest")}>
              <span className="block font-semibold">{suggestion.title}</span><span className="mt-0.5 line-clamp-2 block text-on-surface-variant">{suggestion.text}</span>
            </button>)}
          </div>
        </fieldset>)}
      </div>}
    </section>}

    {page.id === "edit" && <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Chế độ chỉnh sửa</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chế độ chỉnh sửa ảnh">
        {["Sửa tổng thể", "Crop để sửa", "Thay thế model", "Thêm đối tượng", "Đổi vật liệu", "Ghi chú"].map(mode => <button key={mode} type="button" aria-pressed={editMode === mode} onClick={() => { setEditMode(mode); if (mode !== "Crop để sửa") { setMarking(false); setRegionPoints([]); } }} className={cn("min-h-10 rounded-lg border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", editMode === mode ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface hover:bg-surface-container")}>{mode}</button>)}
      </div>
    </fieldset>}

    {(page.id === "enhance" || page.id === "upscale") && <label className="block space-y-2 text-xs font-semibold text-on-surface-variant"><span className="flex justify-between"><span>{page.id === "upscale" ? "Mức tái tạo chi tiết" : "Cường độ cải thiện"}</span><span className="tabular-nums text-primary">{quality}%</span></span><input aria-label="Chất lượng xử lý ảnh" type="range" min={25} max={100} step={25} value={quality} onChange={event => setQuality(Number(event.target.value))} className="w-full accent-primary" /></label>}

    {(page.id === "staging" || (page.id === "edit" && editMode === "Crop để sửa")) && <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
      <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{page.id === "staging" ? "Vùng nội thất" : "Vùng cần chỉnh sửa"}</h4><button type="button" onClick={() => { setMarking(value => !value); setRegionPoints([]); }} aria-pressed={marking} disabled={!reference} className={cn("min-h-8 rounded-lg px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50", marking ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface")}>{marking ? "Đang đánh dấu" : "Vẽ vùng"}</button></div>
      <p className="text-pretty text-xs text-on-surface-variant">{isCropEdit ? "Chọn “Vẽ vùng”, rồi kéo để tạo khung chữ nhật quanh phần cần chỉnh. Hoặc nhấn Enter để tạo khung mặc định ở giữa ảnh." : "Chọn “Vẽ vùng”, sau đó nhấp ít nhất 3 điểm trên ảnh tham chiếu."}</p>
      {!!regionPoints.length && <div className="flex gap-2"><button type="button" onClick={finishRegion} disabled={regionPoints.length < 3} className="min-h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary disabled:opacity-50">Hoàn tất vùng</button><button type="button" onClick={() => setRegionPoints([])} className="min-h-8 rounded-lg px-3 text-xs text-on-surface-variant hover:bg-surface-container">Xóa điểm</button></div>}
      {!!regions.length && <ul className="space-y-1 text-xs text-on-surface">{regions.map((region, index) => <li key={index} className="flex items-center justify-between gap-2"><span>{region.label} · {region.points.length} điểm</span><button type="button" onClick={() => setRegions(items => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded px-2 py-1 text-on-surface-variant hover:text-error focus-visible:outline-2 focus-visible:outline-primary">Xóa</button></li>)}</ul>}
    </div>}

    <label className="block space-y-1.5 text-sm text-on-surface"><span>{page.id === "render" ? "Prompt kiến trúc" : page.id === "human" ? "Mô tả thêm (tùy chọn)" : page.id === "staging" ? "Ghi chú yêu cầu" : page.id === "utilities" ? "Yêu cầu bổ sung (tùy chọn)" : "Mô tả thiết kế"}</span><textarea required={page.id !== "human" && page.id !== "utilities"} minLength={page.id === "human" || page.id === "utilities" ? 0 : 3} maxLength={1200} rows={4} value={prompt} onChange={event => setPrompt(event.target.value)} className={`${fieldClass} resize-y`} placeholder={page.id === "render" ? "Tạo prompt bằng AI hoặc nhập yêu cầu render chi tiết…" : page.id === "human" ? "Ví dụ: một gia đình đang đi bộ, cầm túi xách…" : page.id === "utilities" ? "Thêm yêu cầu về vật liệu, cảnh quan hoặc phong cách…" : "Mô tả không gian, vật liệu, ánh sáng và góc nhìn mong muốn."} /></label>
    <label className="block space-y-1.5 text-sm text-on-surface"><span>Phong cách</span><input value={style} onChange={event => setStyle(event.target.value)} maxLength={100} className={fieldClass} /></label>
    {page.id === "render" ? <label className="block space-y-1.5 text-sm text-on-surface"><span>Tỷ lệ khung hình</span><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}><option value="Tự động">Tự động</option><option value="1:1">1:1 · Vuông</option><option value="16:9">16:9 · Ngang</option><option value="9:16">9:16 · Dọc</option><option value="4:3">4:3 · Ngang</option><option value="3:4">3:4 · Dọc</option><option value="21:9">21:9 · Panorama</option></select></label> : <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Tỷ lệ khung hình</legend><div className="grid grid-cols-3 gap-2" role="group" aria-label="Tỷ lệ khung hình">{["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "1:4", "4:1", "1:8", "8:1", "21:9"].map(value => <button key={value} type="button" aria-pressed={aspectRatio === value} onClick={() => setAspectRatio(value)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary", aspectRatio === value ? "border-primary text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/50")}><span className="material-symbols-outlined text-base" aria-hidden="true">{value === "1:1" ? "crop_square" : ["16:9", "3:2", "5:4", "4:1", "8:1", "21:9"].includes(value) ? "crop_landscape" : "crop_portrait"}</span>{value}</button>)}</div></fieldset>}
    {["render", "staging", "visual", "human", "enhance", "upscale"].includes(page.id) && <label className="block space-y-1.5 text-sm text-on-surface"><span>Độ phân giải</span><select value={outputResolution} onChange={event => setOutputResolution(event.target.value)} className={fieldClass}><option value="1K">1K · tiêu chuẩn</option><option value="2K">2K · cao</option><option value="4K">4K · tối đa</option></select></label>}
    {page.id === "render" && <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Số phương án</legend><div className="grid grid-cols-3 gap-2" role="group" aria-label="Số phương án rendering">{[1, 2, 4].map(value => <button key={value} type="button" aria-pressed={variants === value} onClick={() => setVariants(value)} className={cn("min-h-10 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", variants === value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{value}</button>)}</div></fieldset>}
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={onOptimize} disabled={!canUseAi || optimizing || busy || (page.id !== "render" && prompt.trim().length < 3)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">{optimizing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-4" aria-hidden="true" />}{optimizing ? "Đang tối ưu…" : page.id === "render" ? prompt.trim() ? "Tối ưu prompt AI" : "Tạo prompt bằng AI" : "Tối ưu prompt"}</button>
      <button type="button" onClick={onRestore} disabled={busy || optimizing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><RefreshCw className="size-4" aria-hidden="true" />Khôi phục</button>
    </div>
    {syncCharacter && missingRequiredReference && <p className="text-xs text-on-surface-variant" role="status">{characterSource === "prompt" ? "Mô tả nhân vật và tải ít nhất một ảnh bối cảnh đích để tiếp tục." : "Cần một ảnh nhân vật và ít nhất một ảnh bối cảnh để tạo kết quả đồng bộ."}</p>}
    <button type="submit" disabled={!canUseAi || busy || optimizing || analyzingSync || missingRequiredReference} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-bold text-surface-container-lowest shadow-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{busy ? "Đang tạo…" : actionLabel}</button>
    <p className="text-center text-[10px] leading-relaxed text-on-surface-variant">Kết quả được lưu vào thư viện dự án và tính vào hạn mức AI của doanh nghiệp.</p>
  </aside>;

  return <form onSubmit={onGenerate} aria-busy={busy || optimizing} className="space-y-5">
    {!canUseAi && <p className="text-pretty rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant" role="status">Cần quyền `architect-ai:manage` để tạo hình bằng AI.</p>}
    <header className="flex flex-col justify-between gap-3 border-b border-outline-variant/50 pb-4 sm:flex-row sm:items-end"><div><h2 data-typography="page-title" className="text-balance text-lg font-semibold leading-7 text-on-surface">{page.title}</h2><p className="mt-1 max-w-2xl text-pretty text-sm text-on-surface-variant">{page.description}</p></div><span className="text-xs font-semibold uppercase tracking-widest text-primary">iGen Architecture Studio</span></header>
    {page.id === "render" && <nav className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-low p-1.5" aria-label="Chế độ rendering"><div className="flex min-w-max gap-1" role="group">{renderModes.map(mode => <button key={mode.value} type="button" aria-pressed={renderMode === mode.value} onClick={() => chooseRenderMode(mode.value)} className={cn("min-h-10 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary sm:px-4", renderMode === mode.value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface")}>{mode.label}</button>)}</div></nav>}
    <div className={cn("grid min-h-[620px] gap-6", page.id === "texture" ? "lg:grid-cols-[20rem_minmax(0,1fr)]" : page.id === "render" ? "lg:grid-cols-[22rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
      {(page.id === "texture" || page.id === "render") && settings}
      <div className="flex min-w-0 flex-col gap-5">
        {page.id === "visual" && <div className="flex justify-center"><div className="flex items-center gap-1 rounded-full bg-surface-container-low p-1.5 shadow-sm" role="group" aria-label="Chế độ visual">{(["render", "edit", "mood"] as const).map(mode => <button key={mode} type="button" aria-pressed={visualMode === mode} onClick={() => setVisualMode(mode)} className={cn("min-h-10 rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary", visualMode === mode ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface")}>{mode === "mood" ? "Mood" : mode === "edit" ? "Edit" : "Render"}</button>)}</div></div>}
        <div ref={previewRef} className={cn("architect-preview relative isolate flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-on-surface", (page.id === "texture" || page.id === "render") && "min-h-[620px]")}>
          <img src={activePreview} alt={showingSavedResult ? `Kết quả đã tạo cho ${page.title}` : compareSource ? "Ảnh tham chiếu kiến trúc" : "Ảnh xem trước studio kiến trúc"} className="absolute inset-0 size-full object-cover opacity-80 transition-transform duration-300" style={{ transform: `scale(${zoom})` }} referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/30" aria-hidden="true" />
          {canCompare && <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={compareSource} alt="" className="size-full object-cover" style={{ transform: `scale(${zoom})` }} /><span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">Ảnh gốc</span></div>}
          {(page.id === "staging" || isCropEdit) && (marking || regions.length > 0 || regionPoints.length > 0) && <svg viewBox="0 0 100 100" preserveAspectRatio="none" role={marking ? "button" : "img"} tabIndex={marking ? 0 : -1} aria-label={marking ? isCropEdit ? "Ảnh tham chiếu. Kéo để đánh dấu khung crop, hoặc nhấn Enter để tạo khung giữa ảnh." : "Ảnh tham chiếu. Nhấp để đánh dấu vùng cần chỉnh sửa." : "Các vùng cần chỉnh sửa đã đánh dấu"} onPointerDown={marking ? isCropEdit ? startCrop : addRegionPoint : undefined} onPointerMove={marking && isCropEdit ? moveCrop : undefined} onPointerUp={marking && isCropEdit ? endCrop : undefined} onPointerCancel={marking && isCropEdit ? cancelCrop : undefined} onKeyDown={event => { if (!marking || (event.key !== "Enter" && event.key !== " ")) return; event.preventDefault(); if (isCropEdit) { setRegions(current => [...current, { label: `Vùng ${current.length + 1}`, points: [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }] }]); setMarking(false); setRegionPoints([]); } else setRegionPoints(points => [...points, { x: 35 + (points.length % 4) * 8, y: 40 + (points.length % 3) * 7 }]); }} className={cn("absolute inset-0 z-20 size-full touch-none", marking ? "cursor-crosshair" : "pointer-events-none")}>
            {regions.map((region, index) => <polygon key={index} points={pointList(region.points)} fill="color-mix(in srgb, var(--color-primary) 22%, transparent)" stroke="var(--color-primary)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />)}
            {!!regionPoints.length && isCropEdit && regionPoints.length > 1 ? <polygon points={pointList([{ x: Math.min(regionPoints[0].x, regionPoints[1].x), y: Math.min(regionPoints[0].y, regionPoints[1].y) }, { x: Math.max(regionPoints[0].x, regionPoints[1].x), y: Math.min(regionPoints[0].y, regionPoints[1].y) }, { x: Math.max(regionPoints[0].x, regionPoints[1].x), y: Math.max(regionPoints[0].y, regionPoints[1].y) }, { x: Math.min(regionPoints[0].x, regionPoints[1].x), y: Math.max(regionPoints[0].y, regionPoints[1].y) }])} fill="color-mix(in srgb, var(--color-primary) 22%, transparent)" stroke="white" strokeWidth="0.7" vectorEffect="non-scaling-stroke" /> : !!regionPoints.length && <><polyline points={pointList(regionPoints)} fill="none" stroke="white" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />{regionPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="0.9" fill="var(--color-primary)" vectorEffect="non-scaling-stroke" />)}</>}
          </svg>}
          {!reference && !hasRenderInput && !showingSavedResult && <div className="absolute inset-0 flex items-center justify-center px-6 text-center"><div className="max-w-md space-y-3 text-white"><span className="material-symbols-outlined text-4xl" aria-hidden="true">{page.id === "texture" ? "texture" : page.id === "human" ? "groups" : page.id === "staging" ? "chair" : "light_mode"}</span><p className="text-xl font-bold">{page.id === "texture" ? "Texture Lab" : page.id === "staging" ? "Sắp xếp không gian" : page.id === "human" ? "Human enhancer" : "AI Visual Engine Active"}</p><p className="text-sm text-white/75">Tải ảnh tham chiếu hoặc mô tả yêu cầu để bắt đầu tạo hình ảnh.</p></div></div>}
          <div className="absolute left-5 top-5 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md"><span className={cn("size-2 rounded-full", busy ? "animate-pulse bg-primary" : "bg-emerald-400")} />{busy ? "Đang xử lý" : showingSavedResult ? "Kết quả đã tạo" : page.id === "render" && renderSourceImages.length ? "Ảnh nguồn" : reference ? "Ảnh tham chiếu" : "AI Architecture Studio"}</div>
          {canCompare && <label className="absolute bottom-[4.5rem] left-5 right-5 z-30 flex items-center gap-3 rounded-full bg-black/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md"><span>Gốc</span><input type="range" min={0} max={100} value={comparePosition} onChange={event => setComparePosition(Number(event.target.value))} aria-label="So sánh ảnh gốc và kết quả" className="w-full accent-primary" /><span>Kết quả</span></label>}
          {page.id === "texture" && seamless && <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30"><span className="border-b border-r border-white" /><span className="border-b border-white" /><span className="border-r border-white" /><span /></div>}
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" aria-label="Thu nhỏ ảnh xem trước" onClick={() => setZoom(value => Math.max(1, value - 0.1))} className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><ZoomOut className="size-4" aria-hidden="true" /></button>
              <button type="button" aria-label="Phóng to ảnh xem trước" onClick={() => setZoom(value => Math.min(1.5, value + 0.1))} className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><ZoomIn className="size-4" aria-hidden="true" /></button>
              <button type="button" aria-label="Đặt lại tỷ lệ ảnh" onClick={() => setZoom(1)} className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><Maximize2 className="size-4" aria-hidden="true" /></button>
              <button type="button" aria-label="Mở ảnh toàn màn hình" onClick={() => { const preview = previewRef.current; if (preview && document.fullscreenEnabled) void preview.requestFullscreen(); }} className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><Expand className="size-4" aria-hidden="true" /></button>
            </div>
            <span className="max-w-[60%] truncate rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-medium text-white/85 backdrop-blur-md">{page.id === "render" && renderSourceImages[0] ? renderSourceImages[0].name : referenceName || `Camera 01: ${page.title}`}</span>
          </div>
        </div>
        {!!assets.filter(asset => assetUrls[asset.id]).length && <div className="flex items-center gap-2 overflow-x-auto rounded-xl bg-surface-container-low p-2" role="group" aria-label="Thư viện ảnh của dự án"><span className="shrink-0 px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Thư viện dự án</span>{assets.filter(asset => assetUrls[asset.id]).slice(0, 8).map(asset => <div key={asset.id} className="flex shrink-0 flex-col items-center gap-1"><button type="button" onClick={() => setManualPreview(assetUrls[asset.id])} aria-pressed={activePreview === assetUrls[asset.id]} aria-label={`Xem ${asset.filename}`} className={cn("size-14 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-primary", activePreview === assetUrls[asset.id] ? "border-primary" : "border-transparent")}>{asset.mimeType === "video/mp4" ? <span className="flex size-full items-center justify-center bg-on-surface text-[9px] font-bold text-on-primary">VIDEO</span> : <img src={assetUrls[asset.id]} alt="" className="size-full object-cover" />}</button>{page.id === "render" && asset.mimeType !== "video/mp4" && <><button type="button" onClick={() => onUseAsRenderSource(asset)} aria-label={`Dùng ${asset.filename} làm ảnh nguồn`} className="min-h-7 rounded-md px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">Dùng làm ảnh nguồn</button><button type="button" onClick={() => onUseAsReference(asset)} aria-label={`Dùng ${asset.filename} làm ảnh tham khảo phong cách`} className="min-h-7 rounded-md px-1.5 text-[10px] font-semibold text-on-surface-variant hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">Dùng làm ảnh tham khảo</button></>}{page.id !== "render" && page.reference !== "none" && asset.mimeType !== "video/mp4" && <button type="button" onClick={() => onUseAsReference(asset)} aria-label={`Dùng ${asset.filename} làm ảnh tham chiếu`} className="min-h-7 rounded-md px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">Dùng làm tham chiếu</button>}</div>)}</div>}
        {error && <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-on-surface" role="alert">{error}</p>}
        {notice && <p className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface" role="status"><Check className="size-4 text-primary" aria-hidden="true" />{notice}</p>}
      </div>
      {page.id !== "texture" && page.id !== "render" && settings}
    </div>
  </form>;
}
