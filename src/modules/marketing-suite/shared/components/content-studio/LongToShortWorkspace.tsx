/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import {
  Scissors,
  Sparkles,
  Copy,
  Download,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Check,
  Flame,
  Clock,
  Play,
  Film,
  ChevronRight,
  Info,
  Upload,
} from "lucide-react";
import { opusclipService, OpusClipProject } from "../../services/opusclipService";
import { socketService } from "../../../../../services/socketService";
import { toast } from "../../../../../pages/Toast";
import { getAccessToken } from "../../services/authService";
import { StyledSelect } from "../../../../../components/common/StyledSelect";

const LENGTH_OPTIONS = [
  { value: "auto", label: "Tự động (Auto)" },
  { value: "<30s", label: "< 30 giây" },
  { value: "30s-60s", label: "30s – 60s" },
  { value: "60s-90s", label: "60s – 90s" },
  { value: "90s-3m", label: "90s – 3 phút" },
];

const SOURCE_LANG_OPTIONS = [
  { value: "auto", label: "Tự nhận diện (Auto)" },
  { value: "vi", label: "Tiếng Việt (vi)" },
  { value: "en", label: "Tiếng Anh (en)" },
];

export default function LongToShortTab() {
  const [videoUrl, setVideoUrl] = useState("");
  const [name, setName] = useState("");
  const [lengthOption, setLengthOption] = useState("auto");
  const [sourceLang, setSourceLang] = useState("auto");
  const [brandTemplateId, setBrandTemplateId] = useState("");

  const [projects, setProjects] = useState<OpusClipProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<OpusClipProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  // Load projects list
  const fetchProjects = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await opusclipService.getProjects(1, 20);
      setProjects(res.list || []);
      
      // Update selected project if active
      if (selectedProject) {
        const updated = (res.list || []).find((p) => p.projectId === selectedProject.projectId);
        if (updated) {
          setSelectedProject(updated);
        }
      }
    } catch (err: any) {
      console.error("Lỗi lấy danh sách dự án:", err);
      toast.error(err.message || "Không thể tải danh sách dự án.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Đăng ký nhận sự kiện realtime qua Socket.IO khi Opus xử lý xong
    const unsubComplete = socketService.on("opusclip:completed", (data: any) => {
      console.log("[Socket] OpusClip project completed:", data);
      toast.success(`Dự án video ngắn #${data.projectId} đã xử lý hoàn tất!`);
      fetchProjects(true);
    });

    const unsubFailed = socketService.on("opusclip:failed", (data: any) => {
      console.error("[Socket] OpusClip project failed:", data);
      toast.error(`Dự án #${data.projectId} xử lý thất bại: ${data.error}`);
      fetchProjects(true);
    });

    return () => {
      unsubComplete();
      unsubFailed();
    };
  }, [selectedProject?.projectId]);

  // Handle upload local video file in chunks directly to Cloudinary
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Giới hạn dung lượng video tối đa 1.5GB cho video dài 20-30 phút
    const MAX_SIZE = 1500 * 1024 * 1024; // 1.5GB
    if (file.size > MAX_SIZE) {
      toast.error("Dung lượng video không được vượt quá 1.5GB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Tạo các tham số cần ký
      const timestamp = Math.round(Date.now() / 1000).toString();
      const folder = "igen_erp/opusclip";
      const paramsToSign = {
        timestamp,
        folder,
      };

      // 2. Gọi backend lấy chữ ký bảo mật
      const signRes = await fetch('/api/v1/media/sign-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ paramsToSign }),
      });

      if (!signRes.ok) {
        const errText = await signRes.text();
        throw new Error(`Không thể lấy chữ ký tải lên từ máy chủ: ${errText}`);
      }

      const { signature, apiKey, cloudName } = await signRes.json();

      // 3. Tiến hành tải lên theo phân đoạn (Chunked Upload) trực tiếp sang Cloudinary
      // Sử dụng chunk 6MB (Cloudinary yêu cầu từ 5MB - 100MB cho mỗi chunk)
      const chunkSize = 6 * 1024 * 1024; 
      const totalSize = file.size;
      const uniqueUploadId = 'igen_upload_' + Math.random().toString(36).substring(2, 15);

      let start = 0;
      let secureUrl = "";

      while (start < totalSize) {
        const end = Math.min(start + chunkSize, totalSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("file", chunk);
        formData.append("api_key", apiKey);
        formData.append("timestamp", timestamp);
        formData.append("signature", signature);
        formData.append("folder", folder);

        const headers: Record<string, string> = {
          "X-Unique-Upload-Id": uniqueUploadId,
          "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
        };

        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
        
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: headers,
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Lỗi tải lên phân đoạn sang Cloudinary: ${errText}`);
        }

        const data = await response.json();
        
        // Cập nhật phần trăm tiến trình
        const progress = Math.round((end / totalSize) * 100);
        setUploadProgress(progress);

        if (end === totalSize) {
          secureUrl = data.secure_url;
        }

        start = end;
      }

      if (secureUrl) {
        setVideoUrl(secureUrl);
        toast.success("Tải video lên Cloudinary thành công!");
      } else {
        throw new Error("Tải lên hoàn tất nhưng không nhận được URL video.");
      }
    } catch (err: any) {
      console.error("Lỗi tải video chunked:", err);
      toast.error(err.message || "Tải video thất bại. Vui lòng thử lại.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle submit new project
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      toast.error("Vui lòng nhập link video.");
      return;
    }

    setSubmitting(true);
    try {
      const newProj = await opusclipService.createProject({
        videoUrl,
        name: name || undefined,
        lengthOption,
        sourceLang,
        brandTemplateId: brandTemplateId || undefined,
      });

      toast.success("Khởi tạo dự án cắt video AI thành công! Video đang được phân tích.");
      setVideoUrl("");
      setName("");
      
      // Reload list and set as selected
      await fetchProjects(true);
      setSelectedProject(newProj);
    } catch (err: any) {
      toast.error(err.message || "Khởi tạo dự án thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectProject = async (proj: OpusClipProject) => {
    setSelectedProject(proj);
    // Nếu project đang xử lý, fetch chi tiết để sync trạng thái mới từ API
    if (proj.status === "processing") {
      try {
        const detail = await opusclipService.getProjectDetail(proj.projectId);
        setSelectedProject(detail);
        // Cập nhật lại vào list cục bộ
        setProjects((prev) => prev.map((p) => (p.projectId === proj.projectId ? detail : p)));
      } catch (err) {
        console.warn("Lỗi đồng bộ trạng thái dự án:", err);
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  // Helper render badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <Check className="size-3" aria-hidden="true" /> Hoàn thành
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-error/25 bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
            <AlertCircle className="size-3" aria-hidden="true" /> Thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Clock className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Đang cắt…
          </span>
        );
    }
  };

  const getViralScoreColor = (score: number) => {
    if (score >= 85) return "border-emerald-500/30 bg-emerald-50 text-emerald-700";
    if (score >= 70) return "border-amber-500/30 bg-amber-50 text-amber-700";
    return "border-rose-500/30 bg-rose-50 text-rose-700";
  };

  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
  const inputClass =
    "block h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-6 font-sans" id="long_to_short_root">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">

        {/* COLUMN LEFT: Form + History (5 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-5">

          {/* Submit Box */}
          <section
            aria-label="Tạo dự án cắt video mới"
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-outline-variant pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Scissors className="size-4" aria-hidden="true" />
                </div>
                <h2 className="text-balance text-sm font-semibold text-on-surface">Cắt video mới</h2>
              </div>
              <button
                type="button"
                onClick={() => fetchProjects()}
                disabled={loading}
                aria-label="Làm mới danh sách dự án"
                title="Cập nhật danh sách"
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer disabled:opacity-50 ${focusRingClass}`}
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lts-video-url" className="text-sm font-medium text-on-surface">
                  Đường dẫn video <span className="text-error">*</span>
                </label>
                <input
                  id="lts-video-url"
                  type="url"
                  required
                  placeholder="Dán link YouTube, Google Drive hoặc URL trực tiếp…"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={inputClass}
                  disabled={uploading}
                />

                {/* Tải lên video cục bộ */}
                <label className="mt-1 flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 px-3 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:border-primary hover:bg-primary/5">
                  {uploading ? (
                    <>
                      <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      <span className="tabular-nums">Đang tải tệp lên: {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" aria-hidden="true" />
                      <span>Tải tệp video từ máy tính (&lt; 1.5 GB)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lts-project-name" className="text-sm font-medium text-on-surface">
                  Tên dự án <span className="font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <input
                  id="lts-project-name"
                  type="text"
                  placeholder="Ví dụ: Review công nghệ số 01"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-on-surface">Độ dài clip ngắn</span>
                  <StyledSelect
                    appearance="erp"
                    ariaLabel="Độ dài clip ngắn"
                    value={lengthOption}
                    onChange={setLengthOption}
                    options={LENGTH_OPTIONS}
                    className="h-10 rounded-md"
                    menuClassName="rounded-md [&_[role=option]]:rounded-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-on-surface">Ngôn ngữ gốc</span>
                  <StyledSelect
                    appearance="erp"
                    ariaLabel="Ngôn ngữ gốc"
                    value={sourceLang}
                    onChange={setSourceLang}
                    options={SOURCE_LANG_OPTIONS}
                    className="h-10 rounded-md"
                    menuClassName="rounded-md [&_[role=option]]:rounded-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lts-brand-template" className="text-sm font-medium text-on-surface">
                  Brand Template ID <span className="font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <input
                  id="lts-brand-template"
                  type="text"
                  placeholder="Nhập Template ID nếu có"
                  value={brandTemplateId}
                  onChange={(e) => setBrandTemplateId(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="border-t border-outline-variant pt-4">
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${focusRingClass}`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      <span>Đang khởi tạo dự án…</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="size-4" aria-hidden="true" />
                      <span>Bắt đầu cắt video AI</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* History List */}
          <section
            aria-label="Lịch sử video đã cắt"
            className="flex max-h-[440px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-outline-variant pb-3">
              <h2 className="flex items-center gap-2 text-balance text-sm font-semibold text-on-surface">
                <Film className="size-4 text-on-surface-variant" aria-hidden="true" />
                Lịch sử video đã cắt
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">
                {projects.length}
              </span>
            </div>

            {loading && projects.length === 0 ? (
              <div role="status" className="py-10 text-center text-sm text-on-surface-variant">
                Đang tải lịch sử…
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-10 text-center text-sm text-on-surface-variant">
                Chưa có dự án nào được tạo.
              </div>
            ) : (
              <ul className="flex-1 space-y-2 overflow-y-auto pr-1">
                {projects.map((proj) => {
                  const isActive = selectedProject?.projectId === proj.projectId;
                  return (
                    <li key={proj._id}>
                      <button
                        type="button"
                        onClick={() => handleSelectProject(proj)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface" title={proj.name}>
                            {proj.name || `Video #${proj.projectId}`}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs tabular-nums text-on-surface-variant">
                              {new Date(proj.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                            {getStatusBadge(proj.status)}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* COLUMN RIGHT: Selected Project Details (7 cols) */}
        <div className="lg:col-span-7">
          {selectedProject ? (
            <section
              aria-label="Chi tiết dự án cắt video"
              className="flex min-h-[540px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
            >
              {/* Selected Project Header */}
              <div className="mb-5 flex flex-col justify-between gap-3 border-b border-outline-variant pb-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h2 className="truncate text-balance text-base font-semibold text-on-surface">
                    {selectedProject.name || `Dự án #${selectedProject.projectId}`}
                  </h2>
                  <a
                    href={selectedProject.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ${focusRingClass}`}
                  >
                    <span>Xem video gốc</span>
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedProject.status)}
                  {selectedProject.status === "processing" && (
                    <button
                      type="button"
                      aria-label="Đồng bộ trạng thái dự án"
                      onClick={() => handleSelectProject(selectedProject)}
                      className={`inline-flex size-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
                      title="Đồng bộ trạng thái"
                    >
                      <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Processing View */}
              {selectedProject.status === "processing" && (
                <div role="status" className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-5 flex size-14 items-center justify-center">
                    <div className="size-14 animate-spin rounded-full border-2 border-outline-variant border-t-primary motion-reduce:animate-none" />
                    <Scissors className="absolute size-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-balance text-sm font-semibold text-on-surface">AI đang tiến hành cắt video dài…</h3>
                  <p className="mt-2 max-w-sm text-pretty text-xs leading-relaxed text-on-surface-variant">
                    Hệ thống đang phân tích nội dung, trích xuất phụ đề và dựng các clip ngắn dọc 9:16. Quá trình này thường mất 3–8 phút và sẽ tự động cập nhật khi hoàn tất.
                  </p>
                </div>
              )}

              {/* Failed View */}
              {selectedProject.status === "failed" && (
                <div role="alert" className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-error/10 text-error">
                    <AlertCircle className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-balance text-sm font-semibold text-error">Xử lý video AI thất bại</h3>
                  <p className="mt-1.5 max-w-sm text-pretty text-xs leading-relaxed text-on-surface-variant">
                    {selectedProject.error || "Không rõ nguyên nhân. Vui lòng kiểm tra lại chất lượng hoặc đường dẫn video nguồn."}
                  </p>
                </div>
              )}

              {/* Completed Clips Grid View */}
              {selectedProject.status === "completed" && (
                <div className="flex-1 space-y-5">
                  {(!selectedProject.clips || selectedProject.clips.length === 0) ? (
                    <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-16 text-center text-sm text-on-surface-variant">
                      AI không tìm thấy phân cảnh ngắn phù hợp trong video này.
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-sm text-on-surface">
                        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          AI đã tạo <strong className="font-semibold text-primary tabular-nums">{selectedProject.clips.length} clip ngắn</strong> nổi bật từ video gốc.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {selectedProject.clips.map((clip) => {
                          const copyIdTitle = `${clip.clipId}-title`;
                          const copyIdDesc = `${clip.clipId}-desc`;

                          return (
                            <article
                              key={clip.clipId}
                              className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest"
                            >
                              {/* 9:16 Video Player Area */}
                              <div className="relative flex aspect-[9/16] max-h-[360px] w-full items-center justify-center overflow-hidden bg-black">
                                <video
                                  src={clip.videoUrl}
                                  controls
                                  preload="metadata"
                                  className="size-full object-contain"
                                />
                                <div className={`absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums shadow-xs ${getViralScoreColor(clip.viralityScore)}`}>
                                  <Flame className="size-3.5 fill-current" aria-hidden="true" />
                                  <span>{clip.viralityScore}/100</span>
                                </div>
                              </div>

                              {/* Details Info */}
                              <div className="flex flex-1 flex-col gap-3.5 p-4">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-on-surface-variant">Tiêu đề đề xuất</span>
                                    <button
                                      type="button"
                                      aria-label="Sao chép tiêu đề"
                                      onClick={() => copyToClipboard(clip.title, copyIdTitle)}
                                      className={`inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-primary cursor-pointer ${focusRingClass}`}
                                      title="Sao chép tiêu đề"
                                    >
                                      {copiedTextId === copyIdTitle ? (
                                        <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                                      ) : (
                                        <Copy className="size-3.5" aria-hidden="true" />
                                      )}
                                    </button>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
                                    {clip.title || "Không có tiêu đề"}
                                  </p>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-on-surface-variant">Nội dung đăng tải & Hashtags</span>
                                    <button
                                      type="button"
                                      aria-label="Sao chép mô tả và hashtags"
                                      onClick={() => copyToClipboard(`${clip.description}\n\n${clip.hashtags}`, copyIdDesc)}
                                      className={`inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-primary cursor-pointer ${focusRingClass}`}
                                      title="Sao chép mô tả"
                                    >
                                      {copiedTextId === copyIdDesc ? (
                                        <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                                      ) : (
                                        <Copy className="size-3.5" aria-hidden="true" />
                                      )}
                                    </button>
                                  </div>
                                  <p className="mt-1 line-clamp-3 rounded-lg border border-outline-variant bg-surface-container-low/60 p-2.5 text-xs leading-relaxed text-on-surface">
                                    {clip.description || "Không có mô tả."}
                                    {clip.hashtags && <span className="mt-1.5 block font-medium text-primary">{clip.hashtags}</span>}
                                  </p>
                                </div>

                                <div>
                                  <span className="block text-xs font-medium text-on-surface-variant">Phân tích điểm nổi bật</span>
                                  <p className="mt-1 rounded-lg border border-outline-variant bg-surface-container-low/60 p-2.5 text-pretty text-xs leading-relaxed text-on-surface-variant">
                                    {clip.viralReason || "Không có phân tích."}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 border-t border-outline-variant pt-3 text-xs tabular-nums text-on-surface-variant">
                                  <div>Thời lượng: <span className="font-semibold text-on-surface">{clip.duration}s</span></div>
                                  <div>Mốc thời gian: <span className="font-semibold text-on-surface">{clip.startTime}s – {clip.endTime}s</span></div>
                                </div>

                                <a
                                  href={clip.videoUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors duration-150 hover:border-primary hover:text-primary ${focusRingClass}`}
                                >
                                  <Download className="size-4" aria-hidden="true" />
                                  <span>Tải clip xuống</span>
                                </a>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section
              aria-label="Khung kết quả cắt video"
              className="flex min-h-[540px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
            >
              <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-3">
                <h2 className="text-balance text-sm font-semibold text-on-surface">Kết quả clip ngắn</h2>
                <span className="rounded-md bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">9:16 Dọc</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Scissors className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-balance text-sm font-semibold text-on-surface">Chưa chọn dự án</h3>
                <p className="mt-1 max-w-sm text-pretty text-sm text-on-surface-variant">
                  Chọn một dự án trong danh sách lịch sử hoặc tạo dự án cắt video mới ở cột bên trái để xem các clip ngắn AI.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
