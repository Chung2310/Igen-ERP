import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronDown, Download, Expand, ImagePlus, LoaderCircle, Maximize2, RefreshCw, Sparkles, WandSparkles, X, ZoomIn, ZoomOut } from "lucide-react";
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

const fieldClass =
  "h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";

const textareaClass =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-xs leading-relaxed text-on-surface focus:border-primary focus:outline-none disabled:opacity-60 resize-y";

const labelClass = "flex flex-col gap-1.5 text-xs font-medium text-on-surface-variant";

const renderModes = [
  { value: "Ngoại thất", label: "Ngoại thất" },
  { value: "Nội thất", label: "Nội thất" },
  { value: "VR 360", label: "VR 360" },
  { value: "Floorplan to 3D", label: "Floorplan → 3D" },
  { value: "Floorplan to 3D Floorplan", label: "3D Floorplan" },
  { value: "Masterplan to 3D", label: "Masterplan → 3D" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 (Vuông)" },
  { value: "4:3", label: "4:3 (Ngang)" },
  { value: "16:9", label: "16:9 (Rộng)" },
  { value: "3:4", label: "3:4 (Dọc)" },
  { value: "9:16", label: "9:16 (Đứng)" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "21:9", label: "21:9 (Panorama)" },
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
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);

  useEffect(() => setManualPreview(""), [previewUrl]);
  useEffect(() => setAspectRatio(page.id === "render" ? "Tự động" : "4:3"), [page.id]);

  const activePreview = manualPreview || previewUrl;
  const activeAsset = assets.find(asset => assetUrls[asset.id] === activePreview);
  const showingSavedResult = Boolean(activeAsset);
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
    ? utilityTool === "mood" ? "Tạo 4 mood" : utilityTool === "virtual-tour" ? "Tạo panorama 360°" : "Xử lý ảnh"
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
  const addRegionPoint = (event: PointerEvent<SVGSVGElement>) => setRegionPoints(points => [...points, pointAt(event)]);
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
  const cancelCrop = () => { cropStartRef.current = null; setRegionPoints([]); };
  const finishRegion = () => {
    if (regionPoints.length < 3) return;
    setRegions(current => [...current, { label: `Vùng ${current.length + 1}`, points: regionPoints }]);
    setRegionPoints([]);
    setMarking(false);
  };

  const compactRefHint = page.id === "edit"
    ? "Ảnh 1: ảnh nền · Ảnh sau: mẫu (≤10)"
    : syncCharacter
      ? characterSource === "upload" ? "Ảnh 1: nhân vật · Ảnh sau: bối cảnh" : "Tối đa 10 ảnh bối cảnh đích"
      : page.id === "utilities" && utilityNeedsPair
        ? utilityTool === "insert-building" ? "Ảnh 1: hiện trạng · Ảnh 2: công trình" : "Ảnh 1: phòng trống · Ảnh 2: nội thất mẫu"
        : "PNG, JPG, WebP · ≤10 ảnh (15 MB)";

  const showResolution = ["render", "staging", "visual", "human", "enhance", "upscale"].includes(page.id);
  const visibleAssets = assets.filter(asset => assetUrls[asset.id]).slice(0, 8);

  return (
    <form onSubmit={onGenerate} aria-busy={busy || optimizing} aria-label={page.title} className="space-y-3">
      {!canUseAi && (
        <p className="rounded-md border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface-variant" role="status">
          Cần quyền `architect-ai:manage` để tạo hình bằng AI.
        </p>
      )}

      {page.id === "visual" && (
        <div className="flex justify-end">
          <div className="flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest p-0.5" role="group" aria-label="Chế độ visual">
            {(["render", "edit", "mood"] as const).map(mode => (
              <button
                key={mode}
                type="button"
                aria-pressed={visualMode === mode}
                onClick={() => setVisualMode(mode)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  visualMode === mode ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {mode === "mood" ? "Mood" : mode === "edit" ? "Edit" : "Render"}
              </button>
            ))}
          </div>
        </div>
      )}

      {page.id === "render" && (
        <nav className="flex gap-1 overflow-x-auto border-b border-outline-variant" aria-label="Chế độ rendering">
          {renderModes.map(mode => {
            const active = renderMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={active}
                onClick={() => chooseRenderMode(mode.value)}
                className={cn(
                  "shrink-0 cursor-pointer border-b-2 px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Studio 2-column split: compact scrollable controls on left, spacious preview on right */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[23.5rem_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-2xs lg:max-h-[calc(100dvh-10.5rem)]">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* Render: Side-by-side compact upload zones */}
            {page.id === "render" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="flex items-center justify-between text-xs font-medium text-on-surface">
                      <span>Ảnh nguồn</span>
                      {renderNeedsSource && (
                        <span className="text-[11px] font-semibold text-primary">
                          Bắt buộc
                        </span>
                      )}
                    </span>
                    <label
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); chooseRenderSource(Array.from(event.dataTransfer.files)); }}
                      className="flex min-h-[68px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/70 px-2 py-2 text-center text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-within:border-primary focus-within:text-primary"
                    >
                      <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium">
                        {renderSourceImages.length ? `${renderSourceImages.length}/10 ảnh nguồn` : "Tải ảnh / PDF"}
                      </span>
                      <span className="text-[10px] opacity-75">Giữ hình khối</span>
                      <input
                        id="architecture-render-source"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        multiple
                        onChange={event => {
                          const files = Array.from(event.currentTarget.files || []);
                          event.currentTarget.value = "";
                          chooseRenderSource(files);
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-on-surface">
                      Ảnh phong cách
                    </span>
                    <label
                      htmlFor={inputId}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); chooseReference(Array.from(event.dataTransfer.files)); }}
                      className="flex min-h-[68px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/70 px-2 py-2 text-center text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-within:border-primary focus-within:text-primary"
                    >
                      <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium">
                        {referenceImages.length ? `${referenceImages.length}/10 ảnh mẫu` : "Tải ảnh mẫu"}
                      </span>
                      <span className="text-[10px] opacity-75">Vật liệu, màu sắc</span>
                      <input
                        id={inputId}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={event => {
                          const files = Array.from(event.currentTarget.files || []);
                          event.currentTarget.value = "";
                          chooseReference(files);
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                {(renderSourceImages.length > 0 || referenceImages.length > 0) && (
                  <div className="space-y-1.5">
                    {renderSourceImages.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Ảnh nguồn đã tải">
                        {renderSourceImages.map((image, index) => (
                          <li key={`${image.name}-${index}`} className="relative size-12 overflow-hidden rounded-md border border-primary/40">
                            <img src={image.url} alt={`Ảnh nguồn ${index + 1}: ${image.name}`} className="size-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeRenderSource(index)}
                              aria-label={`Xóa ảnh nguồn ${image.name}`}
                              className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-error focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              <X className="size-3" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {referenceImages.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Ảnh tham chiếu đã chọn">
                        {referenceImages.map((item, index) => (
                          <li key={`${item.name}-${index}`} className="relative size-12 overflow-hidden rounded-md border border-outline-variant">
                            <img src={item.url} alt={item.name} className="size-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeReference(index)}
                              aria-label={`Xóa ảnh tham chiếu ${item.name}`}
                              className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-error focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              <X className="size-3" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Non-render: Mode selectors that appear before upload */}
            {page.id === "sync" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Chế độ đồng bộ hình ảnh">
                  {([{ id: "project", label: "Đồng bộ công trình" }, { id: "character", label: "Đồng bộ nhân vật" }] as const).map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={syncMode === mode.id}
                      onClick={() => setSyncMode(mode.id)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        syncMode === mode.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {syncCharacter && (
                  <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Nguồn nhân vật">
                    {([{ id: "upload", label: "Tải ảnh nhân vật" }, { id: "prompt", label: "Tạo từ mô tả" }] as const).map(source => (
                      <button
                        key={source.id}
                        type="button"
                        aria-pressed={characterSource === source.id}
                        onClick={() => setCharacterSource(source.id)}
                        className={cn(
                          "min-h-8 cursor-pointer rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          characterSource === source.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                        )}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                )}
                {syncCharacter && characterSource === "prompt" && (
                  <label className={labelClass}>
                    <span>Mô tả nhân vật</span>
                    <textarea
                      value={characterPrompt}
                      onChange={event => setCharacterPrompt(event.target.value)}
                      minLength={3}
                      maxLength={1000}
                      rows={2}
                      required
                      className={textareaClass}
                      placeholder="VD: kiến trúc sư nữ 30 tuổi, sơ mi trắng, quần âu…"
                    />
                  </label>
                )}
              </div>
            )}

            {page.id === "utilities" && (
              <label className={labelClass}>
                <span>Công cụ tiện ích</span>
                <select
                  value={utilityTool}
                  onChange={event => {
                    setUtilityTool(event.target.value);
                    if (event.target.value === "virtual-tour") setAspectRatio("21:9");
                  }}
                  className={fieldClass}
                >
                  <option value="mood">Tạo 4 mood ánh sáng</option>
                  <option value="google-map">Google Map → 3D</option>
                  <option value="insert-building">Chèn công trình vào hiện trạng</option>
                  <option value="virtual-tour">Panorama 360° tham quan ảo</option>
                  <option value="merge-interior">Ghép nội thất theo ảnh mẫu</option>
                  <option value="colorize-floorplan">Tô màu mặt bằng</option>
                </select>
              </label>
            )}

            {/* Non-render: Compact horizontal upload dropzone */}
            {page.id !== "render" && page.reference !== "none" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor={inputId} className="font-medium text-on-surface">
                    Ảnh tham chiếu
                  </label>
                  {page.reference === "required" && (
                    <span className="text-[11px] font-semibold text-primary">
                      Bắt buộc
                    </span>
                  )}
                </div>
                <label
                  htmlFor={inputId}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => { event.preventDefault(); chooseReference(Array.from(event.dataTransfer.files)); }}
                  className="flex min-h-[54px] cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/70 px-3 py-2 text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-within:border-primary focus-within:text-primary"
                >
                  <ImagePlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">
                      {referenceImages.length ? `${referenceImages.length}/10 ảnh · ${referenceName}` : "Kéo thả hoặc nhấn để tải ảnh"}
                    </span>
                    <span className="block truncate text-[11px] text-on-surface-variant">{compactRefHint}</span>
                  </span>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={event => {
                      const files = Array.from(event.currentTarget.files || []);
                      event.currentTarget.value = "";
                      chooseReference(files);
                    }}
                    className="sr-only"
                  />
                </label>
                {referenceImages.length > 0 && (
                  <ul className="space-y-1.5" aria-label="Ảnh tham chiếu đã chọn">
                    {referenceImages.map((item, index) => (
                      <li key={`${item.name}-${index}`} className="relative flex min-w-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-1.5 pr-8">
                        <img src={item.url} alt={item.name} className="size-9 shrink-0 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-on-surface">
                            {syncCharacter
                              ? characterSource === "upload" && index === 0
                                ? `Nhân vật · ${item.name}`
                                : `Bối cảnh ${characterSource === "upload" ? index : index + 1} · ${item.name}`
                              : page.id === "utilities" && utilityNeedsPair
                                ? index === 0 ? `Hiện trạng · ${item.name}` : `Ảnh mẫu · ${item.name}`
                                : item.name}
                          </span>
                          {syncCharacter && (characterSource === "prompt" || index > 0) && (
                            <input
                              aria-label={`Mô tả bối cảnh ${characterSource === "upload" ? index : index + 1}`}
                              value={scenePrompts[characterSource === "upload" ? index : index + 1] || ""}
                              onChange={event => setScenePrompt(characterSource === "upload" ? index : index + 1, event.target.value)}
                              maxLength={1200}
                              placeholder="Yêu cầu cho bối cảnh này…"
                              className="mt-1 h-7 w-full rounded border border-outline-variant bg-surface-container-lowest px-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReference(index)}
                          aria-label={`Xóa ảnh tham chiếu ${item.name}`}
                          className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Tool-specific compact controls */}
            {page.id === "render" && (
              <>
                <label className={labelClass}>
                  <span>Mô tả ý tưởng</span>
                  <textarea
                    value={renderDescription}
                    onChange={event => setRenderDescription(event.target.value)}
                    maxLength={1200}
                    rows={2}
                    className={textareaClass}
                    placeholder="Công trình, vật liệu, cảnh quan cần thể hiện…"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    <span>Kiểu thể hiện</span>
                    <select value={renderImageStyle} onChange={event => setRenderImageStyle(event.target.value)} className={fieldClass}>
                      {(renderMode === "Floorplan to 3D"
                        ? ["Phối cảnh thực tế", "Phối cảnh 3D", "Mô hình thu nhỏ"]
                        : renderMode === "Floorplan to 3D Floorplan"
                          ? ["Ảnh phối cảnh 3D mặt bằng", "Mô hình axonometric", "Mô hình thu nhỏ"]
                          : renderMode === "Masterplan to 3D"
                            ? ["Ảnh phối cảnh 3D tổng thể", "Ảnh chụp thực tế trên không", "Mô hình quy hoạch 3D"]
                            : renderMode === "VR 360"
                              ? ["Ảnh Panorama 360 độ"]
                              : renderMode === "Nội thất"
                                ? ["Ảnh chụp thực tế nội thất", "Phối cảnh 3D nội thất", "Mô hình thu nhỏ"]
                                : ["Ảnh chụp thực tế công trình", "Phối cảnh 3D", "Phác thảo kiến trúc", "Mô hình thu nhỏ"]
                      ).map(value => <option key={value}>{value}</option>)}
                    </select>
                  </label>

                  {["Ngoại thất", "VR 360", "Masterplan to 3D", "Floorplan to 3D Floorplan"].includes(renderMode) ? (
                    <label className={labelClass}>
                      <span>Loại công trình</span>
                      <select value={buildingStyle} onChange={event => setBuildingStyle(event.target.value)} className={fieldClass}>
                        <option>Căn hộ</option><option>Nhà phố</option><option>Biệt thự</option>
                        <option>Văn phòng</option><option>Quán cà phê</option><option>Khu nghỉ dưỡng</option><option>Khu đô thị</option>
                      </select>
                    </label>
                  ) : (
                    <label className={labelClass}>
                      <span>Chức năng phòng</span>
                      <select value={renderRoomType} onChange={event => setRenderRoomType(event.target.value)} className={fieldClass}>
                        <option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option>
                        <option>Phòng ăn</option><option>Phòng tắm</option><option>Phòng làm việc</option><option>Không gian sinh hoạt chung</option>
                      </select>
                    </label>
                  )}

                  {(renderMode === "Floorplan to 3D" || renderMode === "Nội thất") && (
                    <label className={labelClass}>
                      <span>Phong cách nội thất</span>
                      <select value={interiorStyle} onChange={event => setInteriorStyle(event.target.value)} className={fieldClass}>
                        {["Hiện đại", "Bắc Âu", "Tối giản", "Japandi", "Công nghiệp", "Đương đại", "Cổ điển", "Sang trọng", "Wabi Sabi", "Mid-century Modern"].map(value => <option key={value}>{value}</option>)}
                      </select>
                    </label>
                  )}

                  {renderMode !== "Floorplan to 3D Floorplan" && (
                    <label className={labelClass}>
                      <span>Không gian</span>
                      <select value={renderSpace} onChange={event => setRenderSpace(event.target.value)} className={fieldClass}>
                        <option>Căn hộ</option><option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option>
                        <option>Phòng tắm</option><option>Nhà phố</option><option>Biệt thự</option><option>Văn phòng</option>
                        <option>Quán cà phê</option><option>Khu nghỉ dưỡng</option><option>Khu đô thị</option>
                      </select>
                    </label>
                  )}

                  <label className={labelClass}>
                    <span>{renderMode === "Floorplan to 3D Floorplan" ? "Góc nhìn" : "Góc máy"}</span>
                    <select value={cameraAngle} onChange={event => setCameraAngle(event.target.value)} className={fieldClass}>
                      {renderMode === "Floorplan to 3D Floorplan" ? (
                        <><option>Phối cảnh trục đo (Isometric)</option><option>Top-down View</option></>
                      ) : (
                        <>
                          <option>Phối cảnh trục đo (Isometric)</option><option>Góc nhìn ngang tầm mắt</option>
                          <option>Góc rộng từ trên cao</option><option>Góc nhìn chính diện</option>
                          <option>Góc nhìn 3/4</option><option>Toàn cảnh trên không</option>
                          <option>Panorama 360 độ</option><option>Tùy chỉnh</option>
                        </>
                      )}
                    </select>
                  </label>

                  <label className={labelClass}>
                    <span>Ánh sáng</span>
                    <select value={lighting} onChange={event => setLighting(event.target.value)} className={fieldClass}>
                      <option>Ánh sáng tự nhiên</option><option>Nắng ban mai</option><option>Golden hour</option>
                      <option>Blue hour</option><option>Trời nhiều mây</option><option>Ánh sáng nội thất ấm</option><option>Ánh sáng studio</option>
                    </select>
                  </label>

                  <label className={labelClass}>
                    <span>Tông màu</span>
                    <select value={colorTone} onChange={event => setColorTone(event.target.value)} className={fieldClass}>
                      <option>Trung tính tự nhiên</option><option>Tông ấm</option><option>Tông lạnh</option>
                      <option>Trắng sáng</option><option>Đậm tương phản</option><option>Pastel nhẹ</option>
                    </select>
                  </label>
                </div>

                {cameraAngle === "Tùy chỉnh" && renderMode !== "Floorplan to 3D Floorplan" && (
                  <label className={labelClass}>
                    <span>Mô tả góc máy</span>
                    <input value={customCameraAngle} onChange={event => setCustomCameraAngle(event.target.value)} maxLength={160} className={fieldClass} placeholder="VD: nhìn chéo từ cổng chính, ngang tầm mắt" />
                  </label>
                )}

                <div className="rounded-lg border border-outline-variant/80 bg-surface-container-low/40">
                  <button
                    type="button"
                    aria-expanded={showAdvancedPrompt}
                    onClick={() => setShowAdvancedPrompt(value => !value)}
                    className="flex w-full cursor-pointer items-center justify-between px-2.5 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span>Prompt chi tiết &amp; bối cảnh</span>
                    <ChevronDown className={cn("size-3.5 transition-transform duration-150", showAdvancedPrompt && "rotate-180")} aria-hidden="true" />
                  </button>
                  {showAdvancedPrompt && (
                    <div className="space-y-2 border-t border-outline-variant/60 px-2.5 pb-2.5 pt-2">
                      <label className={labelClass}>
                        <span>Bối cảnh bổ sung</span>
                        <input value={renderContext} onChange={event => setRenderContext(event.target.value)} maxLength={400} className={fieldClass} placeholder="Cây xanh, cảnh quan, thời tiết…" />
                      </label>
                      <label className={labelClass}>
                        <span>Prompt kiến trúc</span>
                        <textarea maxLength={1200} rows={3} value={prompt} onChange={event => setPrompt(event.target.value)} className={textareaClass} placeholder="Tạo bằng AI hoặc nhập yêu cầu chi tiết…" />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}

            {page.id === "canvas" && (
              <div className="grid grid-cols-2 gap-2">
                <label className={labelClass}>
                  <span>Loại board</span>
                  <select value={canvasTool} onChange={event => setCanvasTool(event.target.value)} className={fieldClass}>
                    <option>Presentation Board</option><option>Overall</option><option>Layout</option><option>Interior Moodboard</option><option>Advanced Layout</option>
                  </select>
                </label>
                <label className={labelClass}>
                  <span>Phong cách</span>
                  <select value={presentationStyle} onChange={event => setPresentationStyle(event.target.value)} className={fieldClass}>
                    <option>Minimalist (Tối giản)</option><option>Technical Blueprint (Bản vẽ kỹ thuật)</option><option>Watercolor Sketch (Màu nước)</option>
                    <option>Photorealistic (Thực tế)</option><option>Diagrammatic (Sơ đồ khối)</option><option>Monochrome (Đen trắng)</option>
                  </select>
                </label>
              </div>
            )}

            {page.id === "visual" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Loại công trình">
                  {[["apartment", "Chung cư"], ["house", "Nhà phố"], ["office", "Văn phòng"]].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={projectType === value}
                      onClick={() => setProjectType(value)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        projectType === value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    <span>Ánh sáng</span>
                    <select value={lighting} onChange={event => setLighting(event.target.value)} className={fieldClass}>
                      <option>Ánh sáng tự nhiên</option><option>Golden hour</option><option>Blue hour</option><option>Trời nhiều mây</option><option>Ánh sáng nội thất ấm</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className="flex justify-between">
                      <span>Chất lượng</span>
                      <span className="font-semibold text-primary">{quality === 100 ? "MASTER" : quality >= 75 ? "2K" : "DRAFT"}</span>
                    </span>
                    <input aria-label="Chất lượng visual" type="range" min={25} max={100} step={25} value={quality} onChange={event => setQuality(Number(event.target.value))} className="mt-2 w-full accent-primary" />
                  </label>
                </div>
              </div>
            )}

            {page.id === "texture" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Chọn bản đồ PBR">
                  {["Albedo", "Roughness", "Normal", "Height"].map(value => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={materialMap === value}
                      onClick={() => setMaterialMap(value)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-lg border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        materialMap === value ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    <span className="flex justify-between"><span>Độ sáng</span><span className="tabular-nums text-primary">{textureBrightness}%</span></span>
                    <input aria-label="Độ sáng texture" type="range" min={0} max={100} value={textureBrightness} onChange={event => setTextureBrightness(Number(event.target.value))} className="w-full accent-primary" />
                  </label>
                  <label className={labelClass}>
                    <span className="flex justify-between"><span>Tương phản</span><span className="tabular-nums text-primary">{textureContrast}%</span></span>
                    <input aria-label="Độ tương phản texture" type="range" min={0} max={100} value={textureContrast} onChange={event => setTextureContrast(Number(event.target.value))} className="w-full accent-primary" />
                  </label>
                </div>
                <label className="flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container-low/60 px-2.5 text-xs font-medium text-on-surface">
                  <span>Lặp liền mạch (Seamless)</span>
                  <input type="checkbox" checked={seamless} onChange={event => setSeamless(event.target.checked)} className="size-4 accent-primary" />
                </label>
              </div>
            )}

            {page.id === "human" && (
              <div className="grid grid-cols-2 gap-2">
                <label className={labelClass}>
                  <span>Số người</span>
                  <select value={peopleCount} onChange={event => setPeopleCount(Number(event.target.value))} className={fieldClass}>
                    {Array.from({ length: 8 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} người</option>)}
                  </select>
                </label>
                <label className={labelClass}>
                  <span>Đặc điểm</span>
                  <select value={ethnicity} onChange={event => setEthnicity(event.target.value)} className={fieldClass}>
                    <option>Châu Á</option><option>Châu Âu</option><option>Châu Phi</option><option>Châu Mỹ</option><option>Đa dạng</option>
                  </select>
                </label>
                <label className={cn(labelClass, "col-span-2")}>
                  <span>Trang phục</span>
                  <select value={outfit} onChange={event => setOutfit(event.target.value)} className={fieldClass}>
                    <option>Trang phục đời thường</option><option>Trang phục công sở</option><option>Trang phục trang trọng</option>
                    <option>Trang phục thể thao</option><option>Trang phục mùa đông</option>
                  </select>
                </label>
              </div>
            )}

            {page.id === "staging" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Loại hình xử lý ảnh">
                  {([{ id: "virtual", label: "Virtual staging" }, { id: "renovation", label: "Cải tạo (Renovation)" }] as const).map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={stagingMode === mode.id}
                      onClick={() => setStagingMode(mode.id)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        stagingMode === mode.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    <span>Phòng</span>
                    <select value={stagingRoom} onChange={event => setStagingRoom(event.target.value)} className={fieldClass}>
                      <option>Phòng khách</option><option>Phòng ngủ</option><option>Phòng bếp</option><option>Phòng ăn</option><option>Phòng làm việc</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span>Phong cách</span>
                    <select value={stagingStyle} onChange={event => setStagingStyle(event.target.value)} className={fieldClass}>
                      {["Scandinavian", "Modern", "Minimalist", "Japandi", "Industrial", "Contemporary", "Classic", "Luxury", "Wabi Sabi", "Mid-century Modern"].map(styleName => <option key={styleName}>{styleName}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-on-surface-variant">Số phương án</span>
                  <div className="flex gap-1" role="group" aria-label="Số phương án virtual staging">
                    {[1, 2, 4].map(count => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={stagingCount === count}
                        onClick={() => setStagingCount(count)}
                        className={cn(
                          "min-h-8 min-w-9 cursor-pointer rounded-lg border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          stagingCount === count ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {page.id === "sync" && syncMode === "project" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onAnalyzeSync}
                  disabled={!canUseAi || !reference || busy || optimizing || analyzingSync}
                  className="inline-flex min-h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-outline-variant px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {analyzingSync ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-3.5 text-primary" aria-hidden="true" />}
                  {analyzingSync ? "Đang phân tích…" : "Gợi ý góc nhìn từ ảnh"}
                </button>
                {!!syncCategories.length && (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-2">
                    {syncCategories.map(category => (
                      <div key={category.name} className="space-y-1">
                        <p className="text-[11px] font-semibold text-on-surface-variant">{category.name}</p>
                        <div className="grid gap-1">
                          {category.suggestions.map(suggestion => (
                            <button
                              key={suggestion.id}
                              type="button"
                              aria-pressed={prompt === suggestion.text}
                              onClick={() => setPrompt(suggestion.text)}
                              className={cn(
                                "cursor-pointer rounded-md border px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                                prompt === suggestion.text ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/40",
                              )}
                            >
                              <span className="block truncate font-medium">{suggestion.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {page.id === "edit" && (
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Chế độ chỉnh sửa ảnh">
                {["Sửa tổng thể", "Crop để sửa", "Thay thế model", "Thêm đối tượng", "Đổi vật liệu", "Ghi chú"].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={editMode === mode}
                    onClick={() => {
                      setEditMode(mode);
                      if (mode !== "Crop để sửa") { setMarking(false); setRegionPoints([]); }
                    }}
                    className={cn(
                      "min-h-8 cursor-pointer rounded-lg border px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                      editMode === mode ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface hover:bg-surface-container",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            {(page.id === "enhance" || page.id === "upscale") && (
              <label className={labelClass}>
                <span className="flex justify-between">
                  <span>{page.id === "upscale" ? "Tái tạo chi tiết" : "Cường độ cải thiện"}</span>
                  <span className="font-semibold tabular-nums text-primary">{quality}%</span>
                </span>
                <input aria-label="Chất lượng xử lý ảnh" type="range" min={25} max={100} step={25} value={quality} onChange={event => setQuality(Number(event.target.value))} className="w-full accent-primary" />
              </label>
            )}

            {(page.id === "staging" || isCropEdit) && (
              <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container-low/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-on-surface">
                    {page.id === "staging" ? "Đánh dấu vùng nội thất" : "Khoanh vùng chỉnh sửa"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMarking(value => !value); setRegionPoints([]); }}
                    aria-pressed={marking}
                    disabled={!reference}
                    className={cn(
                      "min-h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50",
                      marking ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
                    )}
                  >
                    {marking ? "Đang vẽ…" : "Vẽ vùng"}
                  </button>
                </div>
                {!!regionPoints.length && (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={finishRegion} disabled={regionPoints.length < 3} className="min-h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-on-primary disabled:opacity-50">Xong</button>
                    <button type="button" onClick={() => setRegionPoints([])} className="min-h-7 rounded-md px-2 text-xs text-on-surface-variant hover:bg-surface-container">Hủy điểm</button>
                  </div>
                )}
                {!!regions.length && (
                  <ul className="space-y-1 text-xs text-on-surface">
                    {regions.map((region, index) => (
                      <li key={index} className="flex items-center justify-between gap-2">
                        <span>{region.label} ({region.points.length} điểm)</span>
                        <button type="button" onClick={() => setRegions(items => items.filter((_, i) => i !== index))} className="text-xs text-on-surface-variant hover:text-error">Xóa</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Prompt textarea for non-render tools */}
            {page.id !== "render" && (
              <label className={labelClass}>
                <span>{page.id === "human" ? "Mô tả thêm" : page.id === "staging" ? "Ghi chú yêu cầu" : page.id === "utilities" ? "Yêu cầu bổ sung" : "Mô tả thiết kế"}</span>
                <textarea
                  required={page.id !== "human" && page.id !== "utilities"}
                  minLength={page.id === "human" || page.id === "utilities" ? 0 : 3}
                  maxLength={1200}
                  rows={3}
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  className={textareaClass}
                  placeholder={page.id === "human" ? "VD: gia đình đang đi bộ…" : "Mô tả vật liệu, ánh sáng, góc nhìn…"}
                />
              </label>
            )}

            {/* Output config row: Aspect ratio + Resolution (+ Style for non-render) */}
            <div className="grid grid-cols-2 gap-2">
              {page.id !== "render" && (
                <label className={cn(labelClass, !showResolution && "col-span-2")}>
                  <span>Phong cách</span>
                  <input value={style} onChange={event => setStyle(event.target.value)} maxLength={100} className={fieldClass} />
                </label>
              )}

              <label className={labelClass}>
                <span>Tỷ lệ</span>
                {page.id === "render" ? (
                  <select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}>
                    <option value="Tự động">Tự động</option>
                    <option value="1:1">1:1 · Vuông</option>
                    <option value="16:9">16:9 · Ngang</option>
                    <option value="9:16">9:16 · Dọc</option>
                    <option value="4:3">4:3 · Ngang</option>
                    <option value="3:4">3:4 · Dọc</option>
                    <option value="21:9">21:9 · Panorama</option>
                  </select>
                ) : (
                  <select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}>
                    {ASPECT_RATIO_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                )}
              </label>

              {showResolution && (
                <label className={labelClass}>
                  <span>Độ phân giải</span>
                  <select value={outputResolution} onChange={event => setOutputResolution(event.target.value)} className={fieldClass}>
                    <option value="1K">1K · Tiêu chuẩn</option>
                    <option value="2K">2K · Cao</option>
                    <option value="4K">4K · Tối đa</option>
                  </select>
                </label>
              )}
            </div>

            {page.id === "render" && (
              <div className="grid grid-cols-2 items-end gap-2">
                <label className={labelClass}>
                  <span>Phong cách</span>
                  <input value={style} onChange={event => setStyle(event.target.value)} maxLength={100} className={fieldClass} />
                </label>
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-on-surface-variant">Số phương án</span>
                  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Số phương án rendering">
                    {[1, 2, 4].map(value => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={variants === value}
                        onClick={() => setVariants(value)}
                        className={cn(
                          "h-9 cursor-pointer rounded-lg border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          variants === value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky bottom action bar: always visible without scrolling */}
          <div className="space-y-2 border-t border-outline-variant bg-surface-container-lowest p-3">
            {syncCharacter && missingRequiredReference && (
              <p className="text-[11px] text-on-surface-variant" role="status">
                {characterSource === "prompt" ? "Nhập mô tả nhân vật & tải ≥1 ảnh bối cảnh." : "Cần 1 ảnh nhân vật & ≥1 ảnh bối cảnh."}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (page.id === "render") setShowAdvancedPrompt(true);
                  onOptimize();
                }}
                disabled={!canUseAi || optimizing || busy || (page.id !== "render" && prompt.trim().length < 3)}
                className="inline-flex min-h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-outline-variant px-2.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {optimizing ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-3.5 text-primary" aria-hidden="true" />}
                {optimizing ? "Đang tối ưu…" : page.id === "render" ? "Tối ưu prompt AI" : "Tối ưu prompt"}
              </button>
              <button
                type="button"
                onClick={onRestore}
                disabled={busy || optimizing}
                aria-label="Khôi phục prompt mặc định"
                title="Khôi phục mặc định"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!canUseAi || busy || optimizing || analyzingSync || missingRequiredReference}
              className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {busy ? "Đang tạo…" : actionLabel}
            </button>
          </div>
        </aside>

        {/* Right preview canvas + compact history strip */}
        <div className="flex min-w-0 flex-col gap-2.5">
          {error && (
            <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-xs text-on-surface" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface" role="status">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {notice}
            </p>
          )}

          <div
            ref={previewRef}
            className="architect-preview relative isolate flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-on-surface lg:min-h-[calc(100dvh-15rem)]"
          >
            <img
              src={activePreview}
              alt={showingSavedResult ? `Kết quả đã tạo cho ${page.title}` : compareSource ? "Ảnh tham chiếu kiến trúc" : "Ảnh xem trước studio kiến trúc"}
              className="absolute inset-0 size-full object-cover opacity-85 transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/25" aria-hidden="true" />

            {canCompare && (
              <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                <img src={compareSource} alt="" className="size-full object-cover" style={{ transform: `scale(${zoom})` }} />
                <span className="absolute left-3.5 top-14 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">Ảnh gốc</span>
              </div>
            )}

            {(page.id === "staging" || isCropEdit) && (marking || regions.length > 0 || regionPoints.length > 0) && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role={marking ? "button" : "img"}
                tabIndex={marking ? 0 : -1}
                aria-label={marking ? (isCropEdit ? "Kéo để đánh dấu khung crop" : "Nhấp để đánh dấu vùng chỉnh sửa") : "Vùng đã đánh dấu"}
                onPointerDown={marking ? (isCropEdit ? startCrop : addRegionPoint) : undefined}
                onPointerMove={marking && isCropEdit ? moveCrop : undefined}
                onPointerUp={marking && isCropEdit ? endCrop : undefined}
                onPointerCancel={marking && isCropEdit ? cancelCrop : undefined}
                onKeyDown={event => {
                  if (!marking || (event.key !== "Enter" && event.key !== " ")) return;
                  event.preventDefault();
                  if (isCropEdit) {
                    setRegions(current => [...current, { label: `Vùng ${current.length + 1}`, points: [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }] }]);
                    setMarking(false);
                    setRegionPoints([]);
                  } else {
                    setRegionPoints(points => [...points, { x: 35 + (points.length % 4) * 8, y: 40 + (points.length % 3) * 7 }]);
                  }
                }}
                className={cn("absolute inset-0 z-20 size-full touch-none", marking ? "cursor-crosshair" : "pointer-events-none")}
              >
                {regions.map((region, index) => (
                  <polygon key={index} points={pointList(region.points)} fill="color-mix(in srgb, var(--color-primary) 22%, transparent)" stroke="var(--color-primary)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
                ))}
                {!!regionPoints.length && isCropEdit && regionPoints.length > 1 ? (
                  <polygon
                    points={pointList([
                      { x: Math.min(regionPoints[0].x, regionPoints[1].x), y: Math.min(regionPoints[0].y, regionPoints[1].y) },
                      { x: Math.max(regionPoints[0].x, regionPoints[1].x), y: Math.min(regionPoints[0].y, regionPoints[1].y) },
                      { x: Math.max(regionPoints[0].x, regionPoints[1].x), y: Math.max(regionPoints[0].y, regionPoints[1].y) },
                      { x: Math.min(regionPoints[0].x, regionPoints[1].x), y: Math.max(regionPoints[0].y, regionPoints[1].y) },
                    ])}
                    fill="color-mix(in srgb, var(--color-primary) 22%, transparent)"
                    stroke="white"
                    strokeWidth="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : !!regionPoints.length && (
                  <>
                    <polyline points={pointList(regionPoints)} fill="none" stroke="white" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                    {regionPoints.map((point, index) => (
                      <circle key={index} cx={point.x} cy={point.y} r="0.9" fill="var(--color-primary)" vectorEffect="non-scaling-stroke" />
                    ))}
                  </>
                )}
              </svg>
            )}

            {!reference && !hasRenderInput && !showingSavedResult && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
                <div className="max-w-xs space-y-1.5 text-white">
                  <Sparkles className="mx-auto size-7 text-primary" aria-hidden="true" />
                  <p className="text-base font-semibold">{page.title}</p>
                  <p className="text-xs text-white/80">Tải ảnh hoặc nhập mô tả ở cột trái để tạo hình.</p>
                </div>
              </div>
            )}

            <div className="absolute left-3.5 top-3.5 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
              <span className={cn("size-2 rounded-full", busy ? "animate-pulse bg-primary" : "bg-emerald-400")} />
              {busy ? "Đang xử lý…" : showingSavedResult ? "Kết quả" : page.id === "render" && renderSourceImages.length ? "Ảnh nguồn" : reference ? "Ảnh tham chiếu" : "Sẵn sàng"}
            </div>

            {canCompare && (
              <label className="absolute bottom-14 left-3.5 right-3.5 z-30 flex items-center gap-3 rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                <span>Gốc</span>
                <input type="range" min={0} max={100} value={comparePosition} onChange={event => setComparePosition(Number(event.target.value))} aria-label="So sánh ảnh gốc và kết quả" className="w-full accent-primary" />
                <span>Kết quả</span>
              </label>
            )}

            {page.id === "texture" && seamless && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30">
                <span className="border-b border-r border-white" /><span className="border-b border-white" />
                <span className="border-r border-white" /><span />
              </div>
            )}

            <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => setZoom(value => Math.max(1, value - 0.1))} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><ZoomOut className="size-3.5" aria-hidden="true" /></button>
                <button type="button" aria-label="Phóng to" title="Phóng to" onClick={() => setZoom(value => Math.min(1.5, value + 0.1))} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><ZoomIn className="size-3.5" aria-hidden="true" /></button>
                <button type="button" aria-label="Đặt lại tỷ lệ" title="Đặt lại tỷ lệ" onClick={() => setZoom(1)} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><Maximize2 className="size-3.5" aria-hidden="true" /></button>
                <button type="button" aria-label="Toàn màn hình" title="Toàn màn hình" onClick={() => { const preview = previewRef.current; if (preview && document.fullscreenEnabled) void preview.requestFullscreen(); }} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"><Expand className="size-3.5" aria-hidden="true" /></button>
                {activeAsset && activePreview && (
                  <a href={activePreview} download={activeAsset.filename} aria-label="Tải ảnh kết quả" title="Tải ảnh kết quả" className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-white">
                    <Download className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
              <span className="max-w-[55%] truncate rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                {page.id === "render" && renderSourceImages[0] ? renderSourceImages[0].name : referenceName || page.title}
              </span>
            </div>
          </div>

          {visibleAssets.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-2" role="group" aria-label="Ảnh đã tạo gần đây">
              <span className="shrink-0 px-1.5 text-xs font-medium text-on-surface-variant">Gần đây</span>
              {visibleAssets.map(asset => (
                <div key={asset.id} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/50 p-1">
                  <button
                    type="button"
                    onClick={() => setManualPreview(assetUrls[asset.id])}
                    aria-pressed={activePreview === assetUrls[asset.id]}
                    aria-label={`Xem ${asset.filename}`}
                    className={cn(
                      "size-11 cursor-pointer overflow-hidden rounded-md border-2 focus-visible:outline-2 focus-visible:outline-primary",
                      activePreview === assetUrls[asset.id] ? "border-primary" : "border-transparent",
                    )}
                  >
                    {asset.mimeType === "video/mp4" ? (
                      <span className="flex size-full items-center justify-center bg-on-surface text-[9px] font-bold text-on-primary">VIDEO</span>
                    ) : (
                      <img src={assetUrls[asset.id]} alt="" className="size-full object-cover" />
                    )}
                  </button>
                  {asset.mimeType !== "video/mp4" && page.id === "render" && (
                    <div className="flex flex-col gap-0.5 pr-1">
                      <button type="button" onClick={() => onUseAsRenderSource(asset)} className="cursor-pointer rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/10">Làm nguồn</button>
                      <button type="button" onClick={() => onUseAsReference(asset)} className="cursor-pointer rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-on-surface-variant hover:bg-surface-container">Làm mẫu</button>
                    </div>
                  )}
                  {asset.mimeType !== "video/mp4" && page.id !== "render" && page.reference !== "none" && (
                    <button type="button" onClick={() => onUseAsReference(asset)} className="cursor-pointer rounded px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10">Tham chiếu</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
