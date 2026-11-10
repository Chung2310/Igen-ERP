import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, Download, LoaderCircle, Plus, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { StyledSelect } from "./StyledSelect";
import { requestEnhancedStudioImagePrompt, requestStudioImages, studioImageRatios, type StudioImageRequest, type StudioImageResponse } from "./assistantStudioImageApi";

const fieldClass = "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const imagePromptIdeas = [
  { label: "Phong cảnh", color: "border-primary/20 bg-primary/10 text-primary", prompt: "Phong cảnh núi và hồ lúc bình minh, ánh sáng điện ảnh, màu sắc trong trẻo, bố cục rộng." },
  { label: "Ảnh sản phẩm", color: "border-tertiary/20 bg-tertiary-container text-tertiary", prompt: "Ảnh sản phẩm chăm sóc da cao cấp đặt trong studio sáng, nền tối giản, ánh sáng mềm." },
  { label: "Minh họa", color: "border-secondary/20 bg-secondary-container text-secondary", prompt: "Minh họa 3D thân thiện về một nhóm nhân viên cùng làm việc, màu sắc tươi sáng, bố cục gọn gàng." },
];

const ratioDescriptions: Record<StudioImageRequest["aspectRatio"], string> = {
  "1:1": "Vuông",
  "16:9": "Ngang rộng",
  "9:16": "Dọc rộng",
  "4:3": "Ngang",
  "3:4": "Dọc",
  "3:2": "Ngang",
  "2:3": "Dọc",
};

function AspectRatioIcon({ ratio }: { ratio: StudioImageRequest["aspectRatio"] }) {
  const [widthRatio, heightRatio] = ratio.split(":").map(Number);
  const width = widthRatio >= heightRatio ? 18 : 18 * widthRatio / heightRatio;
  const height = heightRatio >= widthRatio ? 18 : 18 * heightRatio / widthRatio;
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x={(24 - width) / 2} y={(24 - height) / 2} width={width} height={height} rx="1.5" />
  </svg>;
}

function MagicWandIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 20 10.5-10.5 2 2L6 22l-2-2Z" />
    <path d="M18 2v2.5M18 8.5V11M14.5 6.5H12M21.5 6.5H24" />
    <path d="M7 3v1.5M7 7.5V9M4 6H2.5M11 6H9.5" />
  </svg>;
}

const aspectRatioOptions = studioImageRatios.map(ratio => ({
  value: ratio,
  label: `${ratio} · ${ratioDescriptions[ratio]}`,
  icon: <AspectRatioIcon ratio={ratio} />,
}));

export function AssistantStudioImage({ onBack }: { onBack: () => void }) {
  const [aspectRatio, setAspectRatio] = useState<StudioImageRequest["aspectRatio"]>("1:1");
  const [count, setCount] = useState(1);
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [promptError, setPromptError] = useState("");
  const [promptStatus, setPromptStatus] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [referenceImage, setReferenceImage] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [result, setResult] = useState<StudioImageResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function optimizePrompt() {
    const source = promptRef.current.trim();
    if (loading || optimizing || source.length < 3) return;
    setPromptError("");
    setPromptStatus("");
    setOptimizing(true);
    try {
      const enhanced = await requestEnhancedStudioImagePrompt(source);
      if (promptRef.current.trim() === source) {
        setOriginalPrompt(source);
        promptRef.current = enhanced;
        setPrompt(enhanced);
        setPromptStatus("Đã gợi ý mô tả. Bạn có thể chỉnh lại trước khi tạo ảnh.");
      }
    } catch (requestError) {
      setPromptError((requestError as Error).message);
    } finally { setOptimizing(false); }
  }

  async function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Chọn ảnh PNG, JPG hoặc WebP không quá 4 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không thể đọc ảnh tham chiếu."));
        reader.readAsDataURL(file);
      });
      setReferenceImage(dataUrl);
      setReferenceName(file.name);
      setError("");
    } catch (readError) { setError((readError as Error).message); }
    event.currentTarget.value = "";
  }

  async function createImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || optimizing || !prompt.trim()) return;
    setError("");
    setLoading(true);
    try {
      setResult(await requestStudioImages({ prompt: prompt.trim(), aspectRatio, count, ...(referenceImage ? { referenceImage } : {}) }));
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }

  return <div className="grid min-h-full min-w-0 lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <form onSubmit={createImages} className="flex min-w-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest p-4 sm:p-5 lg:min-h-full lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Thiết lập tạo hình ảnh">
        <div className="mb-1 flex min-h-9 items-center gap-2 text-sm"><button type="button" onClick={onBack} className={cn("inline-flex items-center gap-1 rounded-md py-1 text-on-surface-variant hover:text-primary", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button><span className="text-on-surface-variant">/</span><h1 className="text-balance font-semibold">Tạo hình ảnh</h1></div>
        <div><span className="mb-1 block text-sm font-medium">Mô hình</span><div className="flex h-10 items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface" aria-label="Mô hình iGenAI"><img src="/igenai.png" alt="" aria-hidden="true" className="size-8 shrink-0 object-contain" />iGenAI</div></div>
        <div><span className="mb-1 block text-sm font-medium">Tỷ lệ khung hình</span><StyledSelect appearance="erp" ariaLabel="Tỷ lệ khung hình" value={aspectRatio} onChange={value => setAspectRatio(value as StudioImageRequest["aspectRatio"])} disabled={loading} options={aspectRatioOptions} className="h-10 rounded-md" menuClassName="rounded-md [&_[role=option]]:rounded-sm" /></div>
        <div>
          <label htmlFor="studio-image-prompt" className="mb-1 block text-sm font-medium">Mô tả hình ảnh</label>
          <div className="relative">
            <textarea id="studio-image-prompt" required minLength={3} maxLength={2000} rows={6} value={prompt} onChange={event => { promptRef.current = event.target.value; setPrompt(event.target.value); setOriginalPrompt(""); setPromptError(""); setPromptStatus(""); }} disabled={loading} aria-describedby="studio-image-prompt-count studio-image-prompt-status" placeholder="Mô tả chủ thể, bối cảnh, ánh sáng, màu sắc và các chi tiết bạn muốn xuất hiện…" className={cn(fieldClass, "min-h-32 resize-none pb-11")} />
            <button type="button" onClick={optimizePrompt} disabled={loading || optimizing || prompt.trim().length < 3} aria-label={optimizing ? "Đang chuẩn hóa mô tả" : "Chuẩn hóa mô tả hình ảnh"} title="Chuẩn hóa mô tả" className="absolute bottom-3 right-2 inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
              {optimizing ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <MagicWandIcon />}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-on-surface-variant"><span id="studio-image-prompt-status" role="status" className="text-pretty">{optimizing ? "Đang chuẩn hóa mô tả…" : promptStatus}</span><span id="studio-image-prompt-count" className="shrink-0 tabular-nums">{prompt.length}/2.000</span></div>
          {originalPrompt && <button type="button" onClick={() => { promptRef.current = originalPrompt; setPrompt(originalPrompt); setOriginalPrompt(""); setPromptStatus(""); }} className="mt-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Khôi phục mô tả gốc</button>}
          {promptError && <p role="alert" className="mt-1 text-pretty text-xs text-error">{promptError}</p>}
        </div>
        <div><span className="mb-1 block text-sm font-medium">Ảnh tham chiếu <span className="font-normal text-on-surface-variant">(không bắt buộc)</span></span>{referenceImage ? <div className="flex items-center gap-2 rounded-lg border border-outline-variant p-1"><img src={referenceImage} alt="Ảnh tham chiếu đã chọn" className="size-10 rounded-md object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{referenceName}</span><button type="button" onClick={() => { setReferenceImage(""); setReferenceName(""); }} aria-label="Xóa ảnh tham chiếu" disabled={loading} className={cn("rounded-md p-2 hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button></div> : <div className="flex items-center gap-2"><label className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant focus-within:border-primary"><Plus className="size-5" aria-hidden="true" /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} disabled={loading} className="sr-only" aria-label="Thêm ảnh tham chiếu" /></label><span className="text-pretty text-xs text-on-surface-variant">PNG, JPG, WebP · tối đa 4 MB</span></div>}</div>
        <div><span className="mb-1 block text-sm font-medium">Số lượng hình ảnh</span><StyledSelect appearance="erp" ariaLabel="Số lượng hình ảnh" value={String(count)} onChange={value => setCount(Number(value))} disabled={loading} options={[1, 2, 3, 4].map(value => ({ value: String(value), label: `${value} ảnh` }))} className="h-10 rounded-md" menuClassName="rounded-md [&_[role=option]]:rounded-sm" /></div>
        <button type="submit" disabled={loading || optimizing || prompt.trim().length < 3} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:sticky lg:bottom-0 lg:z-10 lg:mt-auto", focusClass)}>{loading ? "Đang tạo ảnh…" : "Tạo hình ảnh"}</button>
        {error && <p role="alert" className="text-pretty rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
      </form>
      <section aria-label="Kết quả tạo hình ảnh" aria-busy={loading} className="flex min-h-96 min-w-0 flex-col bg-surface-container-lowest p-4 lg:min-h-full lg:p-6">
        {loading ? <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><div className="size-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary motion-reduce:animate-none" aria-hidden="true" /><p className="text-sm text-on-surface-variant">Đang tạo {count} ảnh. Quá trình này có thể mất một lúc…</p></div>
          : result?.images.length ? <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-balance text-lg font-semibold">Ảnh đã tạo</h2><p className="text-sm text-on-surface-variant">{result.images.length} ảnh · iGenAI · {result.aspectRatio}</p></div></div>{result.warning && <p role="status" className="mb-4 text-sm text-on-surface-variant">{result.warning}</p>}<div className={cn("grid gap-4", result.images.length > 1 && "sm:grid-cols-2")}>{result.images.map((image, index) => <figure key={`${image.url.slice(0, 40)}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low"><img src={image.url} alt={`Ảnh AI đã tạo ${index + 1}`} className="max-h-[34rem] w-full object-contain" /><figcaption className="flex items-center justify-between gap-2 p-3 text-sm"><span>Ảnh {index + 1}</span><a href={image.url} download={`igen-ai-studio-${index + 1}.png`} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10", focusClass)}><Download className="size-4" aria-hidden="true" />Tải ảnh</a></figcaption></figure>)}</div></>
          : <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center lg:py-10"><div className="space-y-2"><h2 className="mx-auto max-w-2xl text-balance text-xl font-semibold leading-tight sm:text-2xl"><span className="text-tertiary">Thỏa sức sáng tạo</span>{" "}<span className="text-on-surface">hình ảnh đa phong cách</span>{" "}<span className="text-primary">cùng AI</span></h2><p className="text-pretty text-sm text-on-surface-variant">Mô tả ý tưởng và chọn khung hình để bắt đầu.</p></div><img src="/ai-studio-image-hero.png" alt="Bộ ảnh phong cảnh, hoa và nội thất được sáng tạo bằng AI" width="1536" height="1024" className="h-auto max-h-[36dvh] w-full max-w-xl object-contain" /><section aria-label="Gợi ý phong cách" className="space-y-2"><h3 className="text-sm font-medium text-on-surface-variant">Gợi ý phong cách</h3><div className="flex flex-wrap justify-center gap-2">{imagePromptIdeas.map(idea => <button key={idea.label} type="button" onClick={() => { setPrompt(idea.prompt); setError(""); }} disabled={loading} className={cn("min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50", idea.color, focusClass)}>{idea.label}</button>)}</div></section></div>}
      </section>
  </div>;
}
