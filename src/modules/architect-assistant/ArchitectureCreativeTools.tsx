import { useMemo, useState, type FormEvent } from "react";
import { Download, ImagePlus, LoaderCircle, Play, RefreshCw, SkipBack, SkipForward, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import type { ArchitectureImageToolKind, ArchitectureProject, ArchitectureRenderAsset, ArchitectureSyncCategory, ArchitectureToolId } from "../../shared/architecture-assistant";
import type { ArchitectAssistantApi } from "./api";
import ArchitectureImageWorkspace from "./ArchitectureImageWorkspace";
import ArchitectureVideoWorkspace from "./ArchitectureVideoWorkspace";

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
  { id: "edit", label: "Chỉnh sửa ảnh" },
  { id: "staging", label: "Virtual staging" },
  { id: "visual", label: "Visual" },
  { id: "texture", label: "Vật liệu PBR" },
  { id: "human", label: "Human enhancer" },
  { id: "enhance", label: "Cải thiện ảnh" },
  { id: "upscale", label: "Phóng to ảnh" },
  { id: "sync", label: "Đồng bộ công trình" },
  { id: "canvas", label: "Canvas / Presentation board" },
  { id: "utilities", label: "Tiện ích khác" },
  { id: "video", label: "Video" },
  { id: "library", label: "Thư viện" },
];

const PAGES: Record<ArchitectureImageToolKind, ToolPage> = {
  render: {
    id: "render", title: "Render kiến trúc", description: "Tạo phối cảnh nội và ngoại thất từ mô tả hoặc ảnh tham chiếu.", action: "Tạo phối cảnh", reference: "optional",
    prompt: "Phối cảnh kiến trúc chân thực, góc máy rộng vừa, ánh sáng tự nhiên, vật liệu có độ chi tiết cao; giữ đúng tỷ lệ, hình khối và bố cục của ảnh tham chiếu.",
  },
  edit: {
    id: "edit", title: "Chỉnh sửa phối cảnh", description: "Chỉnh sửa ảnh kiến trúc theo vùng, thay đổi vật liệu hoặc thêm đối tượng mà vẫn giữ nguyên phần còn lại.", action: "Tạo ảnh đã chỉnh sửa", reference: "required",
    prompt: "Chỉnh sửa ảnh kiến trúc tham chiếu theo yêu cầu. Giữ nguyên góc máy, hình khối, bố cục, ánh sáng và các chi tiết không được yêu cầu thay đổi.",
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
  sync: {
    id: "sync", title: "Đồng bộ công trình", description: "Giữ nhất quán phong cách, vật liệu và ánh sáng giữa các góc nhìn của cùng một dự án.", action: "Tạo góc nhìn đồng bộ", reference: "required",
    prompt: "Tạo góc nhìn kiến trúc mới đồng bộ với ảnh tham chiếu. Giữ chính xác phong cách thiết kế, bảng màu, vật liệu, ánh sáng và đặc điểm nhận diện của công trình; không thêm chữ hoặc watermark.",
  },
  canvas: {
    id: "canvas", title: "Canvas · Presentation board", description: "Biến ảnh render hoặc sketch thành bảng trình bày kiến trúc theo phong cách đồ án.", action: "Tạo presentation board", reference: "required",
    prompt: "Tạo bảng trình bày kiến trúc có phân cấp rõ, giữ chính xác công trình trong ảnh tham chiếu và thể hiện ý tưởng bằng các sơ đồ phù hợp.",
  },
  utilities: {
    id: "utilities", title: "Tiện ích kiến trúc", description: "Tạo mood render, phối cảnh từ ảnh bản đồ, ghép công trình, ghép nội thất, panorama và tô màu mặt bằng.", action: "Xử lý ảnh", reference: "required",
    prompt: "",
  },
};

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const editInstructions: Record<string, string> = {
  "Sửa tổng thể": "Thực hiện đúng mô tả và giữ nguyên thiết kế kiến trúc ngoài phần được yêu cầu.",
  "Crop để sửa": "Chỉ chỉnh nội dung nằm trong vùng đã đánh dấu; bảo toàn pixel và bố cục bên ngoài vùng đó.",
  "Thay thế model": "Thay đối tượng trong ảnh bằng đối tượng được mô tả hoặc ảnh tham chiếu bổ sung; giữ nguyên phối cảnh và ánh sáng.",
  "Thêm đối tượng": "Thêm đối tượng được mô tả vào vị trí phù hợp; giữ nguyên kiến trúc, ánh sáng và bối cảnh còn lại.",
  "Đổi vật liệu": "Chỉ thay vật liệu được yêu cầu; giữ nguyên hình khối, vị trí cấu kiện, góc máy và ánh sáng.",
  "Ghi chú": "Tập trung vào phần được mô tả và giữ nguyên mọi chi tiết không liên quan.",
};
const utilityInstructions: Record<string, string> = {
  mood: "Create four architecture render variations from the uploaded sketch or render, preserving the exact building and layout while changing only the lighting and time of day.",
  "google-map": "Transform the uploaded satellite or map screenshot into a polished aerial 3D architectural visualization. Preserve the visible roads, coastline, terrain and site context.",
  "insert-building": "Composite the building shown in the second reference into the empty site shown in the first reference. Match scale, perspective, lighting and shadows; preserve the surrounding site.",
  "virtual-tour": "Create a seamless equirectangular 360-degree architectural panorama. Keep the horizon level and avoid visible seams at the left and right edges.",
  "merge-interior": "Furnish the room in the first reference using the interior style and furniture cues from the second reference. Preserve the room geometry and camera view.",
  "colorize-floorplan": "Colorize the black and white floor plan with clear room finishes and realistic architectural materials. Preserve all walls, dimensions, symbols and room positions.",
};
const kinds: Array<{ value: ArchitectureToolId | "all"; label: string }> = [
  { value: "all", label: "Tất cả" }, { value: "render", label: "Render" }, { value: "edit", label: "Chỉnh sửa" }, { value: "staging", label: "Staging" },
  { value: "visual", label: "Visual" }, { value: "texture", label: "Vật liệu" }, { value: "human", label: "Nhân vật" },
  { value: "enhance", label: "Cải thiện" }, { value: "upscale", label: "Phóng to" }, { value: "sync", label: "Đồng bộ" },
  { value: "canvas", label: "Canvas" }, { value: "utilities", label: "Tiện ích" }, { value: "video", label: "Video" },
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
      const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Trình duyệt không thể xử lý ảnh."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.src = dataUrl;
  });
}

async function convertRenderPdf(file: File, maxPages: number): Promise<File[]> {
  const [pdfjsLib, pdfWorker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > maxPages) throw new Error(`PDF “${file.name}” có ${pdf.numPages} trang nhưng chỉ còn chỗ cho ${maxPages} ảnh nguồn.`);
  const pages: File[] = [];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không thể chuyển trang PDF thành ảnh.");
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Không thể chuyển trang PDF thành ảnh.")), "image/png"));
    const baseName = file.name.replace(/\.pdf$/i, "");
    pages.push(new File([blob], `${baseName}_page_${pageNumber}.png`, { type: "image/png" }));
  }
  canvas.width = 0;
  canvas.height = 0;
  return pages;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được ảnh nhân vật vừa tạo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function friendlyError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không hoàn tất được yêu cầu.";
}

export function ArchitectureCreativeTools({
  tool, project, api, assetUrls, canUseAi, canManage, onProjectUpdated, onNavigate,
}: {
  tool: ArchitectureToolId;
  project: ArchitectureProject;
  api: ArchitectAssistantApi;
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  canManage: boolean;
  onProjectUpdated: (project: ArchitectureProject) => void;
  onNavigate: (tool: ArchitectureToolId) => void;
}) {
  if (tool === "library" || tool === "renders") {
    return <ArchitectureAssetLibrary assets={project.renders || []} assetUrls={assetUrls} canDelete={canManage} onDeleteAsset={async assetId => {
      const result = await api.removeAsset(project._id, assetId);
      onProjectUpdated(result.project);
      return result.storageDeleted;
    }} onDownloadAsset={async asset => {
      const blob = await api.asset(project._id, asset.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }} onNavigate={onNavigate} />;
  }
  if (tool === "video") {
    return <ArchitectureVideoWorkspace project={project} api={api} assetUrls={assetUrls} canUseAi={canUseAi} onProjectUpdated={onProjectUpdated} />;
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
  const [aspectRatio, setAspectRatio] = useState(page.id === "render" ? "Tự động" : "4:3");
  const [outputResolution, setOutputResolution] = useState("1K");
  const [lighting, setLighting] = useState("Ánh sáng tự nhiên");
  const [renderMode, setRenderMode] = useState("Ngoại thất");
  const [renderSourceImages, setRenderSourceImages] = useState<Array<{ url: string; name: string }>>([]);
  const [renderDescription, setRenderDescription] = useState("");
  const [renderImageStyle, setRenderImageStyle] = useState("Ảnh chụp thực tế công trình");
  const [renderRoomType, setRenderRoomType] = useState("Phòng khách");
  const [interiorStyle, setInteriorStyle] = useState("Hiện đại");
  const [buildingStyle, setBuildingStyle] = useState("Căn hộ");
  const [customCameraAngle, setCustomCameraAngle] = useState("");
  const [renderSpace, setRenderSpace] = useState("Căn hộ");
  const [cameraAngle, setCameraAngle] = useState("Phối cảnh trục đo (Isometric)");
  const [colorTone, setColorTone] = useState("Trung tính tự nhiên");
  const [renderContext, setRenderContext] = useState("");
  const [editMode, setEditMode] = useState("Sửa tổng thể");
  const [materialMap, setMaterialMap] = useState("Albedo");
  const [textureBrightness, setTextureBrightness] = useState(50);
  const [textureContrast, setTextureContrast] = useState(65);
  const [peopleCount, setPeopleCount] = useState(2);
  const [ethnicity, setEthnicity] = useState("Châu Á");
  const [outfit, setOutfit] = useState("Trang phục đời thường");
  const [stagingMode, setStagingMode] = useState<"virtual" | "renovation">("virtual");
  const [stagingRoom, setStagingRoom] = useState("Phòng khách");
  const [stagingStyle, setStagingStyle] = useState("Modern");
  const [stagingCount, setStagingCount] = useState(1);
  const [referenceImages, setReferenceImages] = useState<Array<{ url: string; name: string }>>([]);
  const [syncMode, setSyncMode] = useState<"project" | "character">("project");
  const [characterSource, setCharacterSource] = useState<"upload" | "prompt">("upload");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [canvasTool, setCanvasTool] = useState("Presentation Board");
  const [presentationStyle, setPresentationStyle] = useState("Minimalist (Tối giản)");
  const [utilityTool, setUtilityTool] = useState("mood");
  const [scenePrompts, setScenePrompts] = useState<string[]>([]);
  const [syncCategories, setSyncCategories] = useState<ArchitectureSyncCategory[]>([]);
  const [analyzingSync, setAnalyzingSync] = useState(false);
  const reference = referenceImages[0]?.url || "";
  const referenceName = referenceImages[0]?.name || "";
  const [variants, setVariants] = useState(1);
  const [visualMode, setVisualMode] = useState<"render" | "edit" | "mood">("render");
  const [quality, setQuality] = useState(75);
  const [projectType, setProjectType] = useState("apartment");
  const [seamless, setSeamless] = useState(true);
  const [marking, setMarking] = useState(false);
  const [regionPoints, setRegionPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [regions, setRegions] = useState<Array<{ label: string; points: Array<{ x: number; y: number }> }>>([]);
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const relatedAssets = useMemo(() => assets.filter(asset => (asset.kind || "render") === page.id).slice().reverse(), [assets, page.id]);
  const latestRelatedAsset = relatedAssets.find(asset => assetUrls[asset.id]);
  const sourcePreview = page.id === "texture"
    ? "https://lh3.googleusercontent.com/aida-public/AB6AXuBIBDxF7Cp7oDBmi_tbELFmfkOE_KppALOefn7vumaF7ytm504W_0MkMIW4K3MKpkwRjP7MT3zIX_3R2HJ3vID_KZVqqk9pic5IYHM8mUFsIGlrNMMHpd1bC8miN-PunPtl-MY2PQel2vDewFAK64EdnM2_yHewFHG9xFhRnrnrfAqXFHalp_TyszxfpLO-p-VXroIJlYp01B10U1nfa2_0AUsWOYlH7Uz-5p8UgaTwuensmiDssNmw5USCbTiIaALp5KTzhpV9JGMU"
    : "https://lh3.googleusercontent.com/aida-public/AB6AXuCfYR7ZKVhfzsJEttn28fnSSW-nrS_4k2teL_Ae1_1fir2kRQWnWx5tHFVKKAleOuYgd7m06RaiHhrouViuHC_wYhbkBKBVLVd5h_VH-Jr7ab1WCpw2D2t2Ct384LtSv4qrUaZR6W6PltWAJvEfeuSGoXdWOw_SdgCJsbVu4bM-szqtTOBnV86AWD31b3zY9BKJdWvzqDEFF0qtDMXroYj4rc8S029c86Kx4_8y1f4e5EKP68Nob83rb3SDP_uQ2jzM27XEGtt6pVPW";
  const previewSrc = latestRelatedAsset ? assetUrls[latestRelatedAsset.id] : reference || sourcePreview;

  const chooseReference = async (files: File[]) => {
    setError("");
    if (!files.length) return;
    setSyncCategories([]);
    if (referenceImages.length + files.length + (page.id === "render" ? renderSourceImages.length : 0) > 10) { setError(page.id === "render" ? "Mỗi lần render có thể dùng tối đa 10 ảnh nguồn và tham khảo gộp lại." : "Mỗi lần tạo có thể dùng tối đa 10 ảnh tham chiếu."); return; }
    const invalid = files.find(file => !file.type.startsWith("image/") || file.size > 15 * 1024 * 1024);
    if (invalid) { setError(invalid.size > 15 * 1024 * 1024 ? `Ảnh “${invalid.name}” phải nhỏ hơn 15 MB.` : `Tệp “${invalid.name}” không phải ảnh.`); return; }
    try {
      const processed = await Promise.all(files.map(async file => ({ url: await imageForUpload(await readImage(file)), name: file.name })));
      const nextReferences = [...referenceImages, ...processed];
      const allImages = [...(page.id === "render" ? renderSourceImages : []), ...nextReferences];
      if (allImages.some(image => image.url.length > 2_100_000) || allImages.reduce((total, image) => total + image.url.length, 0) > 21_000_000) {
        setError("Ảnh sau khi thu nhỏ vẫn vượt giới hạn tổng dung lượng. Hãy chọn ảnh có độ phân giải hoặc dung lượng thấp hơn.");
        return;
      }
      setReferenceImages(nextReferences);
      setScenePrompts(current => [...current, ...processed.map((_, index) => current.length === 0 && index === 0 ? "" : "Tạo góc nhìn mới trong bối cảnh đích, giữ nguyên nhận diện nhân vật.")]);
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const chooseRenderSource = async (files: File[]) => {
    setError("");
    if (!files.length) return;
    if (renderSourceImages.length + files.length + referenceImages.length > 10) { setError("Mỗi lần render có thể dùng tối đa 10 ảnh nguồn và tham khảo gộp lại."); return; }
    const invalid = files.find(file => !(file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) || file.size > 15 * 1024 * 1024);
    if (invalid) { setError(invalid.size > 15 * 1024 * 1024 ? `Ảnh “${invalid.name}” phải nhỏ hơn 15 MB.` : `Tệp “${invalid.name}” không phải ảnh.`); return; }
    try {
      const expandedFiles: File[] = [];
      for (const file of files) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          const remaining = 10 - renderSourceImages.length - referenceImages.length - expandedFiles.length;
          expandedFiles.push(...await convertRenderPdf(file, remaining));
        } else expandedFiles.push(file);
      }
      if (renderSourceImages.length + referenceImages.length + expandedFiles.length > 10) { setError("PDF có quá nhiều trang. Mỗi lần render dùng tối đa 10 ảnh nguồn và ảnh tham khảo."); return; }
      const processed = await Promise.all(expandedFiles.map(async file => ({ url: await imageForUpload(await readImage(file)), name: file.name })));
      const next = [...renderSourceImages, ...processed];
      const combined = [...next, ...referenceImages];
      if (combined.some(image => image.url.length > 2_100_000) || combined.reduce((total, image) => total + image.url.length, 0) > 21_000_000) {
        setError("Ảnh đầu vào sau khi thu nhỏ vẫn vượt giới hạn tổng dung lượng."); return;
      }
      setRenderSourceImages(next);
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const useAsReference = async (asset: ArchitectureRenderAsset) => {
    setError(""); setNotice("");
    setSyncCategories([]);
    if (referenceImages.length + (page.id === "render" ? renderSourceImages.length : 0) >= 10) { setError("Mỗi lần tạo có thể dùng tối đa 10 ảnh nguồn và tham khảo gộp lại."); return; }
    try {
      const imageUrl = assetUrls[asset.id];
      if (!imageUrl) throw new Error("Ảnh trong thư viện chưa tải xong.");
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Không đọc được ảnh trong thư viện.");
      const blob = await response.blob();
      const file = new File([blob], asset.filename, { type: asset.mimeType });
      const url = await imageForUpload(await readImage(file));
      const next = [...referenceImages, { url, name: asset.filename }];
      const combined = [...(page.id === "render" ? renderSourceImages : []), ...next];
      if (url.length > 2_100_000 || combined.reduce((total, image) => total + image.url.length, 0) > 21_000_000) {
        throw new Error("Ảnh này vượt giới hạn dung lượng tham chiếu sau khi thu nhỏ.");
      }
      setReferenceImages(next);
      setScenePrompts(current => [...current, current.length === 0 ? "" : "Tạo góc nhìn mới trong bối cảnh đích, giữ nguyên nhận diện nhân vật."]);
      setNotice(`Đã thêm “${asset.filename}” làm ảnh tham chiếu.`);
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const useAsRenderSource = async (asset: ArchitectureRenderAsset) => {
    setError(""); setNotice("");
    if (renderSourceImages.length + referenceImages.length >= 10) { setError("Mỗi lần render có thể dùng tối đa 10 ảnh nguồn và tham khảo gộp lại."); return; }
    try {
      const imageUrl = assetUrls[asset.id];
      if (!imageUrl) throw new Error("Ảnh trong thư viện chưa tải xong.");
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Không đọc được ảnh trong thư viện.");
      const blob = await response.blob();
      const file = new File([blob], asset.filename, { type: asset.mimeType });
      const image = { url: await imageForUpload(await readImage(file)), name: asset.filename };
      const next = [...renderSourceImages, image];
      const combined = [...next, ...referenceImages];
      if (image.url.length > 2_100_000 || combined.reduce((total, item) => total + item.url.length, 0) > 21_000_000) {
        throw new Error("Ảnh này vượt giới hạn dung lượng ảnh nguồn sau khi thu nhỏ.");
      }
      setRenderSourceImages(next);
      setNotice(`Đã thêm “${asset.filename}” làm ảnh nguồn.`);
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const buildRenderPromptInput = () => [
    `Chế độ: ${renderMode}.`,
    `Kiểu thể hiện: ${renderImageStyle}.`,
    `Loại công trình: ${buildingStyle}; không gian: ${renderSpace}; chức năng phòng: ${renderRoomType}; phong cách nội thất: ${interiorStyle}.`,
    `Góc máy: ${customCameraAngle.trim() || cameraAngle}; ánh sáng: ${lighting}; tông màu: ${colorTone}.`,
    renderContext.trim() ? `Bối cảnh: ${renderContext.trim()}.` : "",
    renderDescription.trim() ? `Mô tả ý tưởng: ${renderDescription.trim()}.` : "",
    renderSourceImages.length ? `Dùng ${renderSourceImages.length} ảnh nguồn để khóa bố cục và hình khối.` : "Tạo mới theo mô tả, không có ảnh nguồn.",
    referenceImages.length ? `Dùng ${referenceImages.length} ảnh riêng để tham khảo phong cách, vật liệu và màu sắc.` : "",
    prompt.trim() ? `Yêu cầu bổ sung: ${prompt.trim()}` : "",
  ].filter(Boolean).join("\n").slice(0, 1200);

  const optimize = async () => {
    setOptimizing(true); setError(""); setNotice("");
    try {
      const result = await api.optimizePrompt(project._id, { tool: page.id, prompt: page.id === "render" ? buildRenderPromptInput() : prompt, style: page.id === "render" ? [style, renderImageStyle, interiorStyle].filter(Boolean).join("; ").slice(0, 100) : style, ...(page.id === "render" ? { referenceImages: [...renderSourceImages, ...referenceImages].map(image => image.url), sourceImageCount: renderSourceImages.length } : {}) });
      if (result.prompt) setPrompt(result.prompt);
      setNotice("Đã tối ưu prompt.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setOptimizing(false); }
  };

  const analyzeSync = async () => {
    if (!canUseAi) { setError("Tài khoản chưa được cấp quyền sử dụng AI kiến trúc."); return; }
    if (!reference) { setError("Tải ảnh công trình lên trước khi phân tích."); return; }
    setAnalyzingSync(true); setError(""); setNotice(""); setSyncCategories([]);
    try {
      const result = await api.analyzeSync(project._id, { image: reference, style });
      setSyncCategories(result.categories);
      setNotice("Đã phân tích ảnh. Chọn một gợi ý để điền vào mô tả góc nhìn.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setAnalyzingSync(false); }
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUseAi) { setError("Tài khoản chưa được cấp quyền sử dụng AI kiến trúc."); return; }
    const generatedCharacter = page.id === "sync" && syncMode === "character" && characterSource === "prompt";
    const utilityNeedsPair = page.id === "utilities" && ["insert-building", "merge-interior"].includes(utilityTool);
    const renderNeedsSource = page.id === "render" && ["Floorplan to 3D", "Floorplan to 3D Floorplan", "Masterplan to 3D"].includes(renderMode);
    if (page.reference === "required" && !reference && !generatedCharacter) { setError("Tải ảnh tham chiếu lên trước khi tạo."); return; }
    if (renderNeedsSource && !renderSourceImages.length) { setError("Tải ảnh mặt bằng hoặc tổng thể khu đất lên trước khi tạo."); return; }
    if (utilityNeedsPair && referenceImages.length < 2) { setError("Tải ảnh bối cảnh thứ nhất và ảnh công trình hoặc nội thất tham chiếu thứ hai."); return; }
    if (page.id === "sync" && syncMode === "character" && characterSource === "upload" && referenceImages.length < 2) { setError("Tải một ảnh nhân vật và ít nhất một ảnh bối cảnh đích."); return; }
    if (generatedCharacter && (referenceImages.length < 1 || characterPrompt.trim().length < 3)) { setError("Nhập mô tả nhân vật và tải ít nhất một ảnh bối cảnh đích."); return; }
    if ((page.id === "staging" || (page.id === "edit" && editMode === "Crop để sửa")) && marking) { setError("Hãy hoàn tất hoặc hủy vùng đang đánh dấu trước khi tạo ảnh."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const syncCharacter = page.id === "sync" && syncMode === "character";
      const variantCount = page.id === "staging" ? stagingCount : variants;
      let characterImage = "";
      if (generatedCharacter) {
        const characterResult = await api.generateImage(project._id, {
          kind: "sync",
          prompt: [
            "Create a clean full-body character identity reference image for architectural compositing.",
            `Character description: ${characterPrompt.trim()}`,
            "Show the complete person from head to shoes, standing naturally, with clear face, realistic proportions, simple neutral background, soft even lighting, and no other people, text, logos, or watermark.",
          ].join("\n"),
          aspectRatio: aspectRatio === "Tự động" ? "auto" : aspectRatio,
          resolution: outputResolution,
        });
        onProjectUpdated(characterResult.project);
        const identityAsset = characterResult.project.renders.at(-1);
        if (!identityAsset) throw new Error("Không tìm thấy ảnh nhân vật vừa tạo trong thư viện dự án.");
        characterImage = await blobToDataUrl(await api.asset(project._id, identityAsset.id));
      }
      const sceneImages = generatedCharacter ? referenceImages : referenceImages.slice(1);
      const renderReferences = [...renderSourceImages, ...referenceImages].map(image => image.url);
      const jobs = syncCharacter
        ? sceneImages.map((scene, index) => ({
          references: [generatedCharacter ? characterImage : referenceImages[0].url, scene.url],
          suffix: `Bối cảnh đích ${index + 1}: ${scenePrompts[generatedCharacter ? index : index + 1] || "Tự chọn vị trí và tư thế phù hợp với ảnh bối cảnh."}`,
        }))
        : page.id === "utilities" && utilityTool === "mood"
          ? ["morning", "noon", "afternoon", "night"].map(mood => ({ references: referenceImages.slice(0, 1).map(image => image.url), suffix: `Lighting mood variation: ${mood}.` }))
          : page.id === "utilities"
            ? [{ references: referenceImages.slice(0, utilityNeedsPair ? 2 : 1).map(image => image.url), suffix: utilityInstructions[utilityTool] }]
        : Array.from({ length: variantCount }, () => ({ references: page.id === "render" ? renderReferences : referenceImages.map(image => image.url), suffix: "" }));
      let generatedCount = 0;
      let firstSceneError: unknown;
      for (const job of jobs) {
        try {
          const result = await api.generateImage(project._id, {
            kind: page.id,
            prompt: [
            `Phong cách thiết kế: ${style}.`,
            `Diện tích dự án: ${project.areaM2} m², ${project.floors} tầng.`,
            project.requirements ? `Yêu cầu: ${project.requirements}.` : "",
            page.id === "edit" ? "Ảnh tham chiếu đầu tiên là ảnh nền cần chỉnh. Các ảnh tham chiếu tiếp theo chỉ dùng làm mẫu đối tượng, model hoặc vật liệu." : "",
            page.id === "staging" && referenceImages.length > 1 ? "Ảnh đầu tiên là phòng gốc; các ảnh tham chiếu tiếp theo chỉ làm mẫu phong cách hoặc vật liệu. Giữ nguyên bố cục phòng." : "",
            syncCharacter ? "Ảnh tham chiếu đầu tiên là ảnh nhận diện nhân vật, ảnh thứ hai là bối cảnh kiến trúc đích. Giữ nhất quán khuôn mặt, kiểu tóc, vóc dáng, trang phục và phụ kiện của nhân vật; đặt nhân vật đúng tỷ lệ, ánh sáng và phối cảnh trong bối cảnh đích, không thay đổi công trình." : "",
            page.id === "render" ? `Loại phối cảnh: ${renderMode}; phong cách ảnh: ${renderImageStyle}; công trình: ${buildingStyle}; không gian: ${renderSpace}; loại phòng: ${renderRoomType}; phong cách nội thất: ${interiorStyle}; góc máy: ${customCameraAngle.trim() || cameraAngle}; ánh sáng: ${lighting}; tông màu: ${colorTone}.` : "",
            page.id === "render" && renderDescription.trim() ? `Mô tả ý tưởng: ${renderDescription.trim()}.` : "",
            page.id === "render" && renderSourceImages.length ? `Giữ bố cục và hình khối theo ${renderSourceImages.length} ảnh nguồn đầu tiên; ${referenceImages.length ? "các ảnh còn lại chỉ tham khảo phong cách, vật liệu và bảng màu" : "không tự ý thay đổi cấu trúc công trình"}.` : page.id === "render" ? "Tạo công trình theo mô tả bằng văn bản vì chưa có ảnh nguồn." : "",
            page.id === "render" && renderMode === "Floorplan to 3D" ? `Dựng mặt bằng thành phối cảnh nội thất 3D, không biến thành ảnh bản vẽ tô màu. ${renderImageStyle === "Phối cảnh thực tế" ? `Chụp ở góc ${customCameraAngle.trim() || cameraAngle || "ngang tầm mắt"}; phân tích phòng, đồ đạc, cửa mở và hướng nhìn thực sự có trong bản vẽ, không tự thêm vật dụng đặc thù.` : renderImageStyle === "Phối cảnh 3D" ? "Dùng góc isometric/dollhouse với tường cắt lửng, bỏ trần để thấy rõ bố cục." : "Dùng hiệu ứng mô hình kiến trúc thu nhỏ tilt-shift."} Xóa chữ, nhãn phòng, kích thước, hatch, ký hiệu CAD, mũi tên, watermark và annotation. Bảo toàn tuyệt đối tỷ lệ chiều dài/rộng, tường, cột, cửa, cửa sổ, cầu thang, phòng, lối đi và vị trí đồ đạc; không vuông hóa, thêm, bớt hoặc dịch chuyển.` : "",
            page.id === "render" && renderMode === "Floorplan to 3D Floorplan" ? `Dựng lại bản vẽ mặt bằng kỹ thuật thành mô hình 3D axonometric${cameraAngle === "Top-down View" ? " nhìn từ trên xuống" : " kiểu isometric"}, không tạo ảnh chụp nội thất. Nhận diện đúng công năng và vị trí từng phòng theo nhãn trên bản vẽ; giữ nguyên tuyệt đối tường, cửa, phòng, đồ đạc và tỷ lệ. Xóa chữ, số đo, hatch, nét CAD, mũi tên và khung tên. Mô hình cần có vật liệu, màu sàn, tường và đồ nội thất rõ nét, không dùng kiểu đất sét trắng đơn sắc; đồ vật phải nằm đúng phòng và không xuyên tường.` : "",
            page.id === "render" && renderMode === "Masterplan to 3D" ? "Dựng tổng thể quy hoạch 3D từ masterplan. Giữ nguyên ranh giới khu đất, đường giao thông, khối công trình, cây xanh, mặt nước và quan hệ không gian theo ảnh nguồn." : "",
            page.id === "render" && renderMode === "VR 360" ? "Tạo ảnh panorama equirectangular 360 độ liền mạch, giữ đường chân trời cân bằng và không để lộ đường nối ở hai mép ảnh." : "",
            page.id === "render" && renderContext.trim() ? `Bối cảnh bổ sung: ${renderContext.trim()}.` : "",
            page.id === "canvas" ? `Create a ${canvasTool} architecture presentation board in ${presentationStyle} style. Preserve the subject building and site design exactly. Use the selected board type to choose appropriate plans, diagrams, materials and layout; do not invent factual labels or dimensions.` : "",
            page.id === "utilities" ? utilityInstructions[utilityTool] : "",
            page.id === "edit" ? `Chế độ chỉnh sửa: ${editMode}. ${editInstructions[editMode]}` : "",
            page.id === "human" ? `Thêm ${peopleCount} người thuộc nhóm ${ethnicity}, trang phục ${outfit}.` : "",
            page.id === "staging" && stagingMode === "virtual" ? `Virtual staging cho ${stagingRoom}, phong cách ${stagingStyle}. Bổ sung nội thất phù hợp công năng và tỷ lệ phòng; giữ nguyên tường, cửa, cửa sổ, góc máy và phối cảnh ảnh gốc.` : "",
            page.id === "staging" && stagingMode === "renovation" ? `Renovation ${stagingRoom}, phong cách hoàn thiện ${stagingStyle}. Cải tạo vật liệu và bề mặt theo yêu cầu; giữ nguyên hình khối, vị trí tường, cửa, cửa sổ, góc máy và phối cảnh.` : "",
            page.id === "visual" ? `Chế độ ${visualMode}; loại dự án ${projectType}; chất lượng ${quality}%; thiết lập ánh sáng: ${lighting}.` : "",
            page.id === "texture" ? `Bản đồ PBR ${materialMap}, độ sáng ${textureBrightness}%, tương phản ${textureContrast}%, ${seamless ? "kiểm tra lặp seamless" : "không lặp seamless"}.` : "",
            (page.id === "staging" || (page.id === "edit" && editMode === "Crop để sửa")) && regions.length ? `Các vùng cần chỉnh sửa được đánh dấu: ${regions.map(region => `${region.label} tại ${region.points.map(point => `${Math.round(point.x)}%, ${Math.round(point.y)}%`).join("; ")}`).join(". ")}.` : "",
            page.id === "enhance" ? `Cường độ cải thiện chi tiết ${quality}%.` : "",
            page.id === "upscale" ? `Mức tái tạo chi tiết ${quality}%.` : "",
            page.id === "canvas" ? `Loại board: ${canvasTool}. Phong cách trình bày: ${presentationStyle}.` : "",
            page.id === "utilities" && utilityTool === "virtual-tour" ? "Output aspect ratio must be 21:9 equirectangular panorama." : "",
            job.suffix,
            prompt,
            ].filter(Boolean).join(" "),
            aspectRatio: aspectRatio === "Tự động" ? "auto" : aspectRatio,
            resolution: outputResolution,
            referenceImages: job.references,
          });
          generatedCount += 1;
          onProjectUpdated(result.project);
        } catch (cause) {
          firstSceneError ||= cause;
        }
      }
      if (!generatedCount) throw firstSceneError || new Error("Không tạo được ảnh.");
      setNotice(syncCharacter ? `Đã đồng bộ nhân vật vào ${generatedCount}/${jobs.length} bối cảnh và lưu kết quả vào thư viện dự án.` : page.id === "utilities" && utilityTool === "mood" ? `Đã tạo ${generatedCount}/4 phương án mood và lưu vào thư viện dự án.` : variantCount > 1 ? `Đã tạo ${generatedCount}/${variantCount} phương án và lưu vào thư viện dự án.` : "Đã tạo phương án và lưu vào thư viện dự án.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  return <ArchitectureImageWorkspace
    page={page}
    previewUrl={page.id === "render" ? latestRelatedAsset ? assetUrls[latestRelatedAsset.id] : renderSourceImages[0]?.url || reference || sourcePreview : previewSrc}
    assets={assets.slice().reverse()}
    assetUrls={assetUrls}
    canUseAi={canUseAi}
    busy={busy}
    optimizing={optimizing}
    prompt={prompt}
    setPrompt={setPrompt}
    style={style}
    setStyle={setStyle}
    aspectRatio={aspectRatio}
    setAspectRatio={setAspectRatio}
    outputResolution={outputResolution}
    setOutputResolution={setOutputResolution}
    lighting={lighting}
    setLighting={setLighting}
    renderMode={renderMode}
    setRenderMode={setRenderMode}
    renderSourceImages={renderSourceImages}
    chooseRenderSource={files => { void chooseRenderSource(files); }}
    onUseAsRenderSource={asset => { void useAsRenderSource(asset); }}
    removeRenderSource={index => setRenderSourceImages(current => current.filter((_, itemIndex) => itemIndex !== index))}
    renderDescription={renderDescription}
    setRenderDescription={setRenderDescription}
    renderImageStyle={renderImageStyle}
    setRenderImageStyle={setRenderImageStyle}
    renderRoomType={renderRoomType}
    setRenderRoomType={setRenderRoomType}
    interiorStyle={interiorStyle}
    setInteriorStyle={setInteriorStyle}
    buildingStyle={buildingStyle}
    setBuildingStyle={setBuildingStyle}
    customCameraAngle={customCameraAngle}
    setCustomCameraAngle={setCustomCameraAngle}
    renderSpace={renderSpace}
    setRenderSpace={setRenderSpace}
    cameraAngle={cameraAngle}
    setCameraAngle={setCameraAngle}
    colorTone={colorTone}
    setColorTone={setColorTone}
    renderContext={renderContext}
    setRenderContext={setRenderContext}
    editMode={editMode}
    setEditMode={setEditMode}
    materialMap={materialMap}
    setMaterialMap={setMaterialMap}
    textureBrightness={textureBrightness}
    setTextureBrightness={setTextureBrightness}
    textureContrast={textureContrast}
    setTextureContrast={setTextureContrast}
    peopleCount={peopleCount}
    setPeopleCount={setPeopleCount}
    ethnicity={ethnicity}
    setEthnicity={setEthnicity}
    outfit={outfit}
    setOutfit={setOutfit}
    stagingMode={stagingMode}
    setStagingMode={setStagingMode}
    stagingRoom={stagingRoom}
    setStagingRoom={setStagingRoom}
    stagingStyle={stagingStyle}
    setStagingStyle={setStagingStyle}
    stagingCount={stagingCount}
    setStagingCount={setStagingCount}
    reference={reference}
    referenceName={referenceName}
    referenceImages={referenceImages}
    removeReference={index => { setReferenceImages(current => current.filter((_, itemIndex) => itemIndex !== index)); setScenePrompts(current => current.filter((_, itemIndex) => itemIndex !== index)); setSyncCategories([]); }}
    chooseReference={files => { void chooseReference(files); }}
    syncMode={syncMode}
    setSyncMode={setSyncMode}
    characterSource={characterSource}
    setCharacterSource={setCharacterSource}
    characterPrompt={characterPrompt}
    setCharacterPrompt={setCharacterPrompt}
    canvasTool={canvasTool}
    setCanvasTool={setCanvasTool}
    presentationStyle={presentationStyle}
    setPresentationStyle={setPresentationStyle}
    utilityTool={utilityTool}
    setUtilityTool={setUtilityTool}
    scenePrompts={scenePrompts}
    setScenePrompt={(index, value) => setScenePrompts(current => current.map((promptValue, itemIndex) => itemIndex === index ? value : promptValue))}
    syncCategories={syncCategories}
    analyzingSync={analyzingSync}
    onAnalyzeSync={() => { void analyzeSync(); }}
    variants={variants}
    setVariants={setVariants}
    visualMode={visualMode}
    setVisualMode={setVisualMode}
    quality={quality}
    setQuality={setQuality}
    projectType={projectType}
    setProjectType={setProjectType}
    seamless={seamless}
    setSeamless={setSeamless}
    marking={marking}
    setMarking={setMarking}
    regionPoints={regionPoints}
    setRegionPoints={setRegionPoints}
    regions={regions}
    setRegions={setRegions}
    error={error}
    notice={notice}
    onOptimize={() => { void optimize(); }}
    onGenerate={event => { void generate(event); }}
    onRestore={() => setPrompt(page.prompt)}
    onUseAsReference={asset => { void useAsReference(asset); }}
  />;
}

export function ArchitectureAssetLibrary({ assets, assetUrls, title = "Thư viện dự án", empty = "Chưa có hình ảnh hoặc video trong dự án.", canDelete = false, onDeleteAsset, onDownloadAsset, onNavigate }: {
  assets: ArchitectureRenderAsset[];
  assetUrls: Record<string, string>;
  title?: string;
  empty?: string;
  canDelete?: boolean;
  onDeleteAsset?: (assetId: string) => Promise<boolean>;
  onDownloadAsset?: (asset: ArchitectureRenderAsset) => Promise<void>;
  onNavigate?: (tool: ArchitectureToolId) => void;
}) {
  const [filter, setFilter] = useState<ArchitectureToolId | "all">("all");
  const [assetToDelete, setAssetToDelete] = useState<ArchitectureRenderAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const visible = assets.slice().reverse().filter(asset => filter === "all" || (asset.kind || "render") === filter);
  const downloadAsset = async (asset: ArchitectureRenderAsset) => {
    if (!onDownloadAsset || downloadingId) return;
    setDownloadingId(asset.id); setDownloadError("");
    try { await onDownloadAsset(asset); }
    catch (cause) { setDownloadError(friendlyError(cause)); }
    finally { setDownloadingId(""); }
  };
  const confirmDelete = async () => {
    if (!assetToDelete || !onDeleteAsset) return;
    setDeleting(true); setDeleteError(""); setDeleteNotice("");
    try {
      const storageDeleted = await onDeleteAsset(assetToDelete.id);
      setAssetToDelete(null);
      if (!storageDeleted) setDeleteNotice("Đã xóa kết quả khỏi thư viện; kho tệp chưa xác nhận xóa bản lưu.");
    } catch (cause) { setDeleteError(friendlyError(cause)); }
    finally { setDeleting(false); }
  };
  return <section className="space-y-4" aria-label={title}>
    {deleteNotice && <p className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface" role="status">{deleteNotice}</p>}
    {downloadError && <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-on-surface" role="alert">{downloadError}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 data-typography="section-title" className="text-balance text-base font-semibold text-on-surface">{title} <span className="font-normal tabular-nums text-on-surface-variant">({visible.length})</span></h4>
      <label className="flex items-center gap-2 text-sm text-on-surface-variant">Lọc<select aria-label="Lọc nội dung thư viện" value={filter} onChange={event => setFilter(event.target.value as ArchitectureToolId | "all")} className={`${fieldClass} min-h-9 w-auto py-1.5`}>
        {kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
      </select></label>
    </div>
    {!visible.length ? <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant px-4 text-center"><ImagePlus className="mb-2 size-8 text-on-surface-variant" aria-hidden="true" /><p className="text-sm text-on-surface-variant">{empty}</p>{onNavigate && <button type="button" onClick={() => onNavigate("render")} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">Mở công cụ render</button>}</div> : <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {visible.map(asset => <figure key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        {assetUrls[asset.id] ? asset.mimeType === "video/mp4" ? <video src={assetUrls[asset.id]} controls playsInline className="aspect-video w-full bg-surface" aria-label={asset.filename} /> : <img src={assetUrls[asset.id]} alt={asset.filename} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-sm text-on-surface-variant" role="status"><LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />Đang tải tệp…</div>}
        <figcaption className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant"><span>{kinds.find(kind => kind.value === (asset.kind || "render"))?.label || "Render"}{asset.resolution ? ` · ${asset.resolution}` : ""}</span><span className="tabular-nums">{new Date(asset.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {Math.round(asset.bytes / 1024)} KB</span></div>
          {asset.prompt && <p className="line-clamp-2 text-pretty text-xs text-on-surface-variant">{asset.prompt}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {onDownloadAsset && <button type="button" onClick={() => { void downloadAsset(asset); }} disabled={Boolean(downloadingId)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-sm text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><Download className="size-4" aria-hidden="true" />{downloadingId === asset.id ? "Đang tải…" : "Tải xuống"}</button>}
            {canDelete && <button type="button" onClick={() => { setAssetToDelete(asset); setDeleteError(""); }} aria-label={`Xóa ${asset.filename} khỏi thư viện`} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-sm text-error hover:bg-error-container/20 focus-visible:outline-2 focus-visible:outline-primary"><Trash2 className="size-4" aria-hidden="true" />Xóa</button>}
          </div>
        </figcaption>
      </figure>)}
    </div>}
    <ConfirmDialog appearance="erp" native isOpen={Boolean(assetToDelete)} title="Xóa kết quả này?" description={`“${assetToDelete?.filename || "Kết quả"}” sẽ bị xóa khỏi thư viện dự án.`} error={deleteError || undefined} confirmLabel="Xóa kết quả" isSubmitting={deleting} onClose={() => { if (!deleting) setAssetToDelete(null); }} onConfirm={() => void confirmDelete()} />
  </section>;
}
