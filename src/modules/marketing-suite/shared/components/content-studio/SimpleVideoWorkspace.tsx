/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import { useProgress } from '../../hooks/use-progress';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../../../../pages/Toast';
import {
  Loader2, UploadCloud, Video, Download, Play, Sparkles,
  Images, Settings, X, Trash2, Wand2,
  ChevronLeft, ChevronRight, Package, Shirt
} from 'lucide-react';
import { marketingService } from '../../../campaign/services/marketingService';
import { VeoSettingsPanel } from './VeoSettingsPanel';
import { getAccessToken } from '../../services/authService';
import { StyledSelect } from '../../../../../components/common/StyledSelect';
import { ConfirmDialog } from '../../../../../components/common/ConfirmDialog';

const VIDEO_TEMPLATES = [
  { id: 'none', label: 'Tùy chỉnh (Tự nhập)', prompt: '', icon: Wand2 },
  { id: 'cinematic', label: 'Điện ảnh (Cinematic)', prompt: 'Cảnh quan hùng vĩ, ánh sáng hoàng hôn ấm áp, máy quay bay cao lướt qua những ngọn núi tuyết, phong cách Flycam.', icon: Video },
  { id: 'product', label: 'Quay sản phẩm (Creative)', prompt: 'Quay cận cảnh sản phẩm thời trang, máy quay xoay tròn 360 độ, ánh sáng studio chuyên nghiệp, phông nền tối giản, chuyển động mượt mà.', icon: Package },
  { id: 'fashion', label: 'Fashion Walk', prompt: 'Người mẫu đi bộ trên sàn runway, ánh sáng đèn flash lung linh, bối cảnh studio cao cấp, chuyển động slow-motion.', icon: Shirt },
];

export function SimpleVideoWorkspace({ initialPrompt, cardId, onMediaSaved, onEditVideo, initialImage, autoTrigger }: {
  initialPrompt?: string;
  cardId?: string;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: 'image' | 'video' | 'audio') => void;
  onEditVideo?: (url: string) => void;
  initialImage?: string;
  autoTrigger?: boolean;
}) {
  const [activeCardId, setActiveCardId] = useState<string | undefined>(cardId);

  useEffect(() => {
    if (cardId) {
      setActiveCardId(cardId);
    }
  }, [cardId]);

  const [activeMode, setActiveMode] = useState<'standard' | 'before-after'>('standard');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [optimizedData, setOptimizedData] = useState<{
    optimized_english_prompt: string;
    motion_analysis?: string;
    camera_movement?: string;
  } | null>(null);

  // Image references
  const [standardImage, setStandardImage] = useState<string | null>(initialImage || null);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);

  useEffect(() => {
    if (initialImage) {
      setStandardImage(initialImage);
    }
  }, [initialImage]);

  // Video Settings
  const [videoModel, setVideoModel] = useState('google/veo-3.1-fast');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
  const [videoDuration, setVideoDuration] = useState('8');
  const [videoQuality, setVideoQuality] = useState('720p'); // 1080p requires duration >= 6s
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const historySliderRef = useRef<HTMLDivElement>(null);

  const handleDownloadVideo = async (uri?: string) => {
    const targetUri = uri || generatedVideoUrl;
    if (!targetUri) return;

    toast.info("Đang tải video về máy...");
    try {
      const fileName = `igen-video-${Date.now()}.mp4`;
      const proxyUrl = `/api/v1/media/download?url=${encodeURIComponent(targetUri)}&filename=${encodeURIComponent(fileName)}`;
      
      const response = await fetch(proxyUrl, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Tải video thành công!");
    } catch (error) {
      console.error("Direct video download failed, falling back:", error);
      const link = document.createElement('a');
      link.href = targetUri;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.warning("Không thể tải trực tiếp. Video đã được mở trong tab mới để bạn tải xuống.");
    }
  };

  // Progress simulation helpers
  const optimizeProgress = useProgress(isGeneratingPrompt, 4);
  const generateProgress = useProgress(isGenerating, 50);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Smart duration handler: enforce API constraints (1080p requires >= 6s)
  const handleDurationChange = (newDuration: string) => {
    setVideoDuration(newDuration);
    const dur = parseInt(newDuration);
    if (dur <= 4 && videoQuality === '1080p') {
      setVideoQuality('720p');
      toast.warning('1080p yêu cầu tối thiểu 6 giây. Đã tự động chuyển sang 720p.');
    }
  };

  // Smart quality handler: enforce API constraints
  const handleQualityChange = (newQuality: string) => {
    if (newQuality === '1080p' && parseInt(videoDuration) <= 4) {
      toast.warning('1080p không hỗ trợ cho video 4 giây. Hãy chọn 6 giây hoặc 8 giây trước.');
      return; // Block invalid selection
    }
    setVideoQuality(newQuality);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const hasPending = history.some(item => item.url && item.url.startsWith('pending://'));
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const response = await geminiApi.getMediaHistory('video');
        setHistory(response.history || []);
      } catch (error) {
        console.error('[SimpleVideoWorkspace] Silent history polling failed', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [history]);

  useEffect(() => {
    if (!generatedVideoUrl || !generatedVideoUrl.startsWith('pending://openrouter/')) {
      return;
    }

    const pendingJobId = generatedVideoUrl.replace('pending://openrouter/', '');
    const matchedRecord = history.find((item) => item?.metadata?.openrouterVideoJobId === pendingJobId);

    if (!matchedRecord) {
      return;
    }

    if (matchedRecord.url && !matchedRecord.url.startsWith('pending://')) {
      setGeneratedVideoUrl(matchedRecord.url);
      return;
    }

    if (matchedRecord.metadata?.status === 'failed' || matchedRecord.metadata?.status === 'timeout') {
      setGeneratedVideoUrl(null);
      toast.error('Video render không thành công. Vui lòng thử lại với prompt khác.');
    }
  }, [generatedVideoUrl, history]);

  const loadHistory = async (showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoadingHistory(true);
    }
    try {
      const response = await geminiApi.getMediaHistory("video");
      setHistory(response.history || []);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tải lịch sử video");
    } finally {
      if (showLoading) {
        setIsLoadingHistory(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'standard' | 'before' | 'after') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      if (target === 'standard') setStandardImage(b64);
      else if (target === 'before') setBeforeImage(b64);
      else if (target === 'after') setAfterImage(b64);
      toast.success("Tải ảnh tham chiếu thành công!");
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOptimizePrompt = async () => {
    const description = prompt.trim();
    if (!description) {
      toast.warning('Vui lòng nhập mô tả kịch bản video trước.');
      return;
    }
    if (activeMode === 'before-after' && (!beforeImage || !afterImage)) {
      toast.warning('Vui lòng tải cả ảnh trước và ảnh sau để tối ưu kịch bản chuyển cảnh.');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      console.log("[SimpleVideoWorkspace] Sending optimize request with prompt:", description);
      const imageUris = activeMode === 'standard'
        ? (standardImage ? [standardImage] : [])
        : [beforeImage, afterImage].filter(Boolean) as string[];
      const result = await geminiApi.optimizeVideoPrompt(description, imageUris);
      console.log("[SimpleVideoWorkspace] Optimization result received:", result);

      setOptimizedData(result);
      toast.success('Đã tối ưu hóa prompt video bằng AI thành công!');
    } catch (e: any) {
      console.error("[SimpleVideoWorkspace] Optimization failed:", e);
      toast.error(`Lỗi tối ưu prompt: ${e.message}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateVideo = async () => {
    const finalPrompt = optimizedData 
      ? JSON.stringify(optimizedData)
      : prompt.trim();
    if (!finalPrompt) {
      toast.warning('Vui lòng nhập kịch bản hoặc chọn gợi ý phong cách.');
      return;
    }
    if (activeMode === 'before-after' && (!beforeImage || !afterImage)) {
      toast.warning('Vui lòng tải cả ảnh trước và ảnh sau để tạo video chuyển cảnh.');
      return;
    }

    setIsGenerating(true);
    setGeneratedVideoUrl(null);

    try {
      toast.success('Đang gửi lệnh tạo video. Quá trình này có thể mất vài phút...');

      const inputImageUris = activeMode === 'standard'
        ? (standardImage ? [standardImage] : undefined)
        : [beforeImage, afterImage].filter((image): image is string => Boolean(image));

      const response = await geminiApi.generateVideo(finalPrompt, parseInt(videoDuration), {
        referenceImageUris: inputImageUris,
        frameMode: activeMode === 'before-after' ? 'first_last' : 'standard',
        modelName: videoModel,
        aspectRatio: videoAspectRatio,
        resolution: videoQuality,
        activeCardId: activeCardId || undefined,
      });

      if (response.url) {
        setGeneratedVideoUrl(response.url);
        setIsGenerating(false);

        if (response.url.startsWith('pending://')) {
          toast.success('Yêu cầu tạo video đã gửi! Đang xử lý ở chế độ nền.');
        } else if (activeCardId) {
          toast.success('Tạo video thành công! Đang lưu trữ lên Cloudinary...');
          try {
            const filename = `video_${Date.now()}.mp4`;
            const cloudinaryUrl = await marketingService.uploadMediaToStorage(response.url, filename, 'video');
            await marketingService.updateCardMedia(cloudinaryUrl, 'video', [activeCardId]);
            if (onMediaSaved) {
              onMediaSaved(activeCardId, cloudinaryUrl, 'video');
            }
            toast.success('Đã lưu trữ và đồng bộ hóa video thành công!');
          } catch (uploadError: any) {
            console.error('Cloudinary error:', uploadError);
            toast.error('Tạo video thành công nhưng không thể đồng bộ hóa lưu trữ.');
          }
        } else {
          toast.success('Tạo video AI thành công!');
        }

        loadHistory(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Không thể tạo video: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const cacheKey = `autotrigger_video_${activeCardId}`;
    if (autoTrigger && prompt.trim() && !isGenerating && !generatedVideoUrl && !sessionStorage.getItem(cacheKey)) {
      sessionStorage.setItem(cacheKey, 'true');
      void handleGenerateVideo();
    }
  }, [autoTrigger, activeCardId]);

  const handleDeleteHistory = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteHistory = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeletingHistory(true);
    try {
      await geminiApi.deleteMediaHistory(id);
      toast.success('Đã xóa video thành công.');
      setHistory(prev => prev.filter(r => r._id !== id && r.id !== id));
      if (generatedVideoUrl && history.find(h => h._id === id || h.id === id)?.url === generatedVideoUrl) {
        setGeneratedVideoUrl(null);
      }
      setPendingDeleteId(null);
    } catch (e: any) {
      toast.error(`Lỗi khi xóa: ${e.message}`);
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const currentPreset = VIDEO_TEMPLATES.find(t => t.prompt === prompt) || VIDEO_TEMPLATES[0];
  const focusRingClass =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
  const templateOptions = VIDEO_TEMPLATES.map((t) => {
    const Icon = t.icon;
    return {
      value: t.id,
      label: t.label,
      icon: <Icon className="size-4 text-on-surface-variant" aria-hidden="true" />,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-6" id="video_workspace_wrapper">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">

        {/* LEFT COLUMN: Input & Settings (lg:col-span-5) */}
        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 lg:col-span-5">

          {/* Toggle modes */}
          <div
            role="tablist"
            aria-label="Chế độ tạo video"
            className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container-low p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'standard'}
              className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                activeMode === 'standard'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => setActiveMode('standard')}
            >
              Tiêu chuẩn
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'before-after'}
              className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                activeMode === 'before-after'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => setActiveMode('before-after')}
            >
              Trước / Sau
            </button>
          </div>

          {/* Input Image Title & Button */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-on-surface">
                Ảnh đầu vào <span className="font-normal text-on-surface-variant">(không bắt buộc)</span>
              </span>
              <button
                type="button"
                onClick={() => toast.info('Thư viện ảnh đang được đồng bộ')}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/15 cursor-pointer ${focusRingClass}`}
              >
                <Images className="size-3.5" aria-hidden="true" />
                Thư viện ảnh
              </button>
            </div>

            {/* Image upload box */}
            {activeMode === 'standard' ? (
              <div className="relative flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 p-4 transition-colors duration-150 hover:border-primary hover:bg-primary/5">
                {standardImage ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
                    <img src={standardImage} alt="Ảnh tham chiếu đầu vào" className="size-full object-cover" />
                    <button
                      type="button"
                      aria-label="Xóa ảnh đầu vào"
                      onClick={() => setStandardImage(null)}
                      className={`absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/65 text-white transition-colors duration-150 hover:bg-black/85 cursor-pointer ${focusRingClass}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label className="flex w-full cursor-pointer flex-col items-center justify-center py-2 text-center focus-within:outline-none">
                    <span className="mb-2.5 inline-flex size-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant">
                      <UploadCloud className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-on-surface">Kéo thả hoặc nhấp để tải ảnh lên</span>
                    <span className="mt-1 text-xs text-on-surface-variant">PNG, JPG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleFileUpload(e, 'standard')}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Before Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-on-surface-variant">Bắt đầu (Trước)</span>
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 transition-colors duration-150 hover:border-primary hover:bg-primary/5">
                    {beforeImage ? (
                      <>
                        <img src={beforeImage} alt="Ảnh bắt đầu" className="size-full object-cover" />
                        <button
                          type="button"
                          aria-label="Xóa ảnh trước"
                          onClick={() => setBeforeImage(null)}
                          className={`absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-black/65 text-white transition-colors duration-150 hover:bg-black/85 cursor-pointer ${focusRingClass}`}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <label className="flex size-full cursor-pointer flex-col items-center justify-center p-3 text-center">
                        <UploadCloud className="mb-1.5 size-6 text-on-surface-variant" aria-hidden="true" />
                        <span className="text-xs font-medium text-on-surface">Tải ảnh trước</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleFileUpload(e, 'before')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* After Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-on-surface-variant">Kết quả (Sau)</span>
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 transition-colors duration-150 hover:border-primary hover:bg-primary/5">
                    {afterImage ? (
                      <>
                        <img src={afterImage} alt="Ảnh kết quả" className="size-full object-cover" />
                        <button
                          type="button"
                          aria-label="Xóa ảnh sau"
                          onClick={() => setAfterImage(null)}
                          className={`absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-black/65 text-white transition-colors duration-150 hover:bg-black/85 cursor-pointer ${focusRingClass}`}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <label className="flex size-full cursor-pointer flex-col items-center justify-center p-3 text-center">
                        <UploadCloud className="mb-1.5 size-6 text-on-surface-variant" aria-hidden="true" />
                        <span className="text-xs font-medium text-on-surface">Tải ảnh sau</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleFileUpload(e, 'after')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* "Ý tưởng của bạn" Section */}
          <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="simple-video-prompt" className="text-sm font-medium text-on-surface">
                Ý tưởng của bạn
              </label>
              <div className="w-48">
                <StyledSelect
                  appearance="erp"
                  ariaLabel="Mẫu gợi ý kịch bản video"
                  value={currentPreset.id}
                  onChange={(value) => {
                    const matched = VIDEO_TEMPLATES.find((t) => t.id === value);
                    if (matched) {
                      setPrompt(matched.prompt);
                      setOptimizedData(null);
                    }
                  }}
                  options={templateOptions}
                  className="h-9 rounded-md text-xs"
                  menuClassName="rounded-md [&_[role=option]]:rounded-sm"
                />
              </div>
            </div>

            <textarea
              id="simple-video-prompt"
              placeholder="Mô tả ngắn gọn nội dung, bối cảnh và chuyển động bạn muốn…"
              rows={4}
              className="w-full min-h-24 resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* AI Optimize Box */}
          <div className="flex flex-col gap-2.5 border-t border-outline-variant pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-on-surface">Tối ưu prompt và thông số</span>
              <span className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                iGen 3 flash
              </span>
            </div>
            <button
              type="button"
              onClick={handleOptimizePrompt}
              disabled={isGeneratingPrompt || isGenerating || !prompt.trim()}
              className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary/15 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${focusRingClass}`}
            >
              {isGeneratingPrompt ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Wand2 className="size-4" aria-hidden="true" />
              )}
              Phân tích và hoàn thiện prompt
            </button>

            {optimizedData && (
              <div className="mt-1 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                    <span>Kịch bản tối ưu bởi AI</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOptimizedData(null)}
                    className={`rounded-md px-2 py-1 text-xs font-medium text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-lowest hover:text-on-surface cursor-pointer ${focusRingClass}`}
                  >
                    Xóa tối ưu
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="simple-video-opt-prompt" className="text-xs font-medium text-on-surface-variant">
                    Prompt tiếng Anh chi tiết
                  </label>
                  <textarea
                    id="simple-video-opt-prompt"
                    rows={3}
                    className="w-full min-h-20 resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm leading-relaxed text-on-surface focus:border-primary focus:outline-none"
                    value={optimizedData.optimized_english_prompt}
                    onChange={(e) => setOptimizedData({
                      ...optimizedData,
                      optimized_english_prompt: e.target.value
                    })}
                    placeholder="Prompt tiếng Anh chi tiết..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="simple-video-opt-motion" className="text-xs font-medium text-on-surface-variant">
                      Chuyển động (Motion)
                    </label>
                    <input
                      id="simple-video-opt-motion"
                      type="text"
                      className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                      value={optimizedData.motion_analysis || ''}
                      onChange={(e) => setOptimizedData({
                        ...optimizedData,
                        motion_analysis: e.target.value
                      })}
                      placeholder="Không có phân tích chuyển động"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="simple-video-opt-camera" className="text-xs font-medium text-on-surface-variant">
                      Góc máy (Camera)
                    </label>
                    <input
                      id="simple-video-opt-camera"
                      type="text"
                      className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                      value={optimizedData.camera_movement || ''}
                      onChange={(e) => setOptimizedData({
                        ...optimizedData,
                        camera_movement: e.target.value
                      })}
                      placeholder="Không có chuyển động camera"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <VeoSettingsPanel
            videoModel={videoModel}
            videoAspectRatio={videoAspectRatio}
            videoDuration={videoDuration}
            videoQuality={videoQuality}
            onVideoModelChange={setVideoModel}
            onAspectRatioChange={setVideoAspectRatio}
            onDurationChange={handleDurationChange}
            onQualityChange={handleQualityChange}
          />

          {/* Submit Button */}
          <div className="border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={handleGenerateVideo}
              disabled={isGenerating || isGeneratingPrompt || !prompt.trim()}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${focusRingClass}`}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {isGenerating ? 'Đang tạo video…' : 'Tạo video ngay'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Canvas & History (lg:col-span-7) */}
        <div className="flex flex-col gap-5 lg:col-span-7">

          {/* Preview Stage Card */}
          <section
            aria-label="Khung xem trước video"
            aria-busy={isGenerating}
            className="flex min-h-[420px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
              <h2 className="text-balance text-sm font-semibold text-on-surface">Khung xem trước</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-on-surface-variant">
                <span className="rounded-md bg-surface-container-low px-2 py-0.5">{videoAspectRatio}</span>
                <span className="rounded-md bg-surface-container-low px-2 py-0.5">{videoDuration} giây</span>
                <span className="rounded-md bg-surface-container-low px-2 py-0.5">{videoQuality}</span>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center">
              {isGenerating ? (
                <div role="status" className="flex flex-col items-center gap-3 p-8 text-center">
                  <Loader2 className="size-9 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-on-surface">
                      Đang dựng video AI ({generateProgress}%)…
                    </span>
                    <span className="text-pretty text-xs text-on-surface-variant">
                      Quá trình này có thể mất 1–2 phút để kết xuất các khung hình.
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                </div>
              ) : generatedVideoUrl ? (
                <div className="flex w-full flex-col gap-3">
                  <div className="relative flex aspect-video max-h-[400px] w-full items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-black">
                    {generatedVideoUrl.startsWith('pending://') ? (() => {
                      const matchedRecord = history.find(h => h.url === generatedVideoUrl);
                      const progressVal = matchedRecord?.metadata?.progress;
                      return (
                        <div role="status" className="flex size-full flex-col items-center justify-center bg-surface-container-low p-6 text-center">
                          <Loader2 className="mb-3 size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                          <span className="text-sm font-semibold text-on-surface">Video đang được xử lý…</span>
                          {progressVal !== undefined && (
                            <div className="mt-2.5 flex w-52 flex-col items-center gap-1.5">
                              <span className="text-xs font-medium tabular-nums text-primary">Tiến độ: {progressVal}%</span>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${progressVal}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <span className="mt-2 text-pretty text-xs text-on-surface-variant">
                            Hệ thống đang xử lý ở chế độ nền, không cần tải lại trang.
                          </span>
                        </div>
                      );
                    })() : (
                      <video
                        src={generatedVideoUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        crossOrigin="anonymous"
                        className="size-full object-contain"
                        id="canvas_video_player"
                      />
                    )}
                  </div>

                  {!generatedVideoUrl.startsWith('pending://') && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadVideo()}
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-low cursor-pointer ${focusRingClass}`}
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Tải video
                      </button>
                      {onEditVideo && (
                        <button
                          type="button"
                          onClick={() => onEditVideo(generatedVideoUrl)}
                          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary/90 cursor-pointer ${focusRingClass}`}
                        >
                          <Wand2 className="size-4" aria-hidden="true" />
                          Chỉnh sửa tiếp
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex w-full flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-12 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Video className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-balance text-sm font-semibold text-on-surface">Sẵn sàng sáng tạo video</h3>
                  <p className="mt-1 max-w-sm text-pretty text-sm text-on-surface-variant">
                    Tải ảnh tham chiếu hoặc nhập mô tả ở cột bên trái để bắt đầu.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Video Render History Card */}
          <section
            aria-label="Lịch sử tạo video"
            className="flex flex-col gap-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-outline-variant pb-3">
              <div>
                <h2 className="text-balance text-sm font-semibold text-on-surface">Lịch sử tạo video</h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Hiển thị tối đa 20 kết quả gần nhất, từ mới đến cũ.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">
                {history.slice(0, 20).length}/20
              </span>
            </div>

            {isLoadingHistory ? (
              <div role="status" className="flex flex-col items-center justify-center gap-2 py-8 text-on-surface-variant">
                <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                <span className="text-xs">Đang tải lịch sử…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-8 text-center">
                <Video className="size-5 text-on-surface-variant" aria-hidden="true" />
                <span className="text-sm text-on-surface-variant">Chưa có video nào được tạo</span>
              </div>
            ) : (
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Cuộn lịch sử sang trái"
                  onClick={() => {
                    if (historySliderRef.current) historySliderRef.current.scrollLeft -= 220;
                  }}
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>

                <div
                  ref={historySliderRef}
                  id="history_slider"
                  className="flex flex-1 gap-3 overflow-x-auto pb-1 scroll-smooth"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {history.map((record, index) => {
                    const id = record._id || record.id;
                    const isActive = generatedVideoUrl === record.url;
                    const label = `Render ${history.length - index}`;
                    return (
                      <div
                        key={id}
                        className={`group/item relative aspect-[16/10] w-36 shrink-0 overflow-hidden rounded-lg border-2 bg-black transition-colors duration-150 ${
                          isActive ? 'border-primary' : 'border-outline-variant hover:border-outline'
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Xem ${label}`}
                          onClick={() => setGeneratedVideoUrl(record.url)}
                          className={`block size-full cursor-pointer text-left ${focusRingClass}`}
                        >
                          {record.url && (record.url.startsWith('http') || record.url.startsWith('blob:') || record.url.startsWith('data:')) ? (
                            <video src={record.url} className="size-full object-cover" muted preload="metadata" playsInline crossOrigin="anonymous" />
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center bg-surface-container-low p-2 text-center text-xs font-medium text-primary">
                              <Loader2 className="mb-1 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              <span className="tabular-nums">
                                Đang dựng {record.metadata?.progress !== undefined ? `${record.metadata.progress}%` : ''}
                              </span>
                            </div>
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-80 transition-opacity duration-150 group-hover/item:opacity-100">
                            <span className="flex size-7 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xs">
                              <Play className="ml-0.5 size-3 fill-current" aria-hidden="true" />
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Xóa ${label} khỏi lịch sử`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(id);
                          }}
                          className={`absolute right-1.5 top-1.5 z-10 inline-flex size-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity duration-150 hover:bg-error focus-visible:opacity-100 group-hover/item:opacity-100 cursor-pointer ${focusRingClass}`}
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>

                        <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                          <span className="truncate">{label}</span>
                          <span>{record.metadata?.aspectRatio || '16:9'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  aria-label="Cuộn lịch sử sang phải"
                  onClick={() => {
                    if (historySliderRef.current) historySliderRef.current.scrollLeft += 220;
                  }}
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </section>

        </div>
      </div>

      <ConfirmDialog
        appearance="erp"
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeletingHistory}
        title="Xóa video khỏi lịch sử"
        description="Bạn có chắc chắn muốn xóa video này khỏi danh sách lịch sử tạo video?"
        confirmLabel="Xóa video"
        cancelLabel="Hủy"
        tone="danger"
        onClose={() => {
          if (!isDeletingHistory) setPendingDeleteId(null);
        }}
        onConfirm={confirmDeleteHistory}
      />
    </div>
  );
}
