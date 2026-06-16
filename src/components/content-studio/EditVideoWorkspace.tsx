import React, { useEffect, useRef, useState } from 'react';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../pages/Toast';
import { Film, Loader2, Play, Sparkles, Video, X, Wand2, UploadCloud } from 'lucide-react';
import { Player } from '@remotion/player';
import { VideoComposition } from './video-composition';

const MODEL_OPTIONS = [
  { value: 'piapi-veo31-video-fast-audio', label: 'iGen video 3.1 Fast' },
  { value: 'piapi-veo31-video-audio', label: 'iGen video 3.1' },
  { value: 'piapi-veo31-video-fast-no-audio', label: 'iGen video 3.1 Fast Silent' },
];

const ASPECT_OPTIONS = [
  { value: '16:9', label: '16:9 Ngang' },
  { value: '9:16', label: '9:16 Dọc' },
  { value: '1:1', label: '1:1 Vuông' },
];

const DURATION_OPTIONS = [
  { value: '4', label: '4 giây' },
  { value: '6', label: '6 giây' },
  { value: '8', label: '8 giây' },

];

const QUALITY_OPTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const STYLE_PRESETS = [
  { label: 'Trending Reels', prompt: 'Chỉnh video thành clip TikTok 15s, cut nhanh theo nhạc, text pop-up, tone sáng.' },
  { label: 'Product Demo', prompt: 'Làm video review sản phẩm chuyên nghiệp, highlight tính năng, chuyển cảnh mượt.' },
  { label: 'Travel Vlog', prompt: 'Biên tập clip travel cinematic, màu ấm, chuyển cảnh mềm, nhạc nhẹ.' },
  { label: 'Before / After', prompt: 'So sánh trước sau, giữ rõ nội dung chính và nhấn mạnh diệu màu, hiệu ứng zoom.' },
];

export function EditVideoWorkspace({
  initialVideoUrl,
  onClearInitialVideoUrl
}: {
  initialVideoUrl?: string | null;
  onClearInitialVideoUrl?: () => void;
} = {}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [videoInputs, setVideoInputs] = useState<Array<{ url: string; duration: number; file?: File }>>([]);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [optimizedData, setOptimizedData] = useState<{
    optimized_english_prompt: string;
    motion_analysis?: string;
    camera_movement?: string;
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_OPTIONS[0].value);
  const [duration, setDuration] = useState(DURATION_OPTIONS[0].value);
  const [resolution, setResolution] = useState(QUALITY_OPTIONS[0].value);
  const [history, setHistory] = useState<any[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<any | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragover") setIsDragging(true);
    else setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newInputs = [...videoInputs];
    const maxSize = 200 * 1024 * 1024; // 200MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        toast.warning(`Video "${file.name}" vượt quá giới hạn 200MB và bị bỏ qua.`);
        continue;
      }
      
      const previewUrl = URL.createObjectURL(file);
      
      const tempVideo = document.createElement('video');
      tempVideo.src = previewUrl;
      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration || 0;
        setVideoInputs(prev => prev.map(item => item.url === previewUrl ? { ...item, duration } : item));
      };

      newInputs.push({
        url: previewUrl,
        duration: 0,
        file
      });
    }
    setVideoInputs(newInputs);
  };

  useEffect(() => {
    if (initialVideoUrl) {
      setVideoInputs(prev => {
        if (prev.some(item => item.url === initialVideoUrl)) {
          return prev;
        }
        return [...prev, { url: initialVideoUrl, duration: 0 }];
      });
      setPrompt('');
      setOptimizedData(null);
      setBlueprint(null);
      setOutputUrl(null);
      if (onClearInitialVideoUrl) {
        onClearInitialVideoUrl();
      }
    }
  }, [initialVideoUrl, onClearInitialVideoUrl]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const uploadVideoFile = async (file: File): Promise<string> => {
    const base64 = await fileToBase64(file);
    const response = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("accessToken")}`
      },
      body: JSON.stringify({
        file: base64,
        folder: 'igen_erp/marketing'
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload video failed: ${response.status} - ${errText}`);
    }
    
    const json = await response.json();
    return json.url;
  };

  useEffect(() => {
    loadVideoHistory();
  }, []);

  useEffect(() => {
    const hasPending = (outputUrl && outputUrl.startsWith('pending://')) || history.some(item => item.url && item.url.startsWith('pending://'));
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const response = await geminiApi.getMediaHistory('video');
        setHistory(response.history || []);
      } catch (error) {
        console.error('[EditVideoWorkspace] Silent history polling failed', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [history, outputUrl]);

  useEffect(() => {
    if (!outputUrl || !outputUrl.startsWith('pending://')) return;
    
    const matched = history.find(h => h._id === currentRecordId || h.id === currentRecordId);
    if (matched && matched.url && !matched.url.startsWith('pending://')) {
      setOutputUrl(matched.url);
      console.log("[EditVideoWorkspace] Dynamic sync: outputUrl updated to completed URL:", matched.url);
    }
  }, [history, outputUrl, currentRecordId]);

  const loadVideoHistory = async () => {
    try {
      const response = await geminiApi.getMediaHistory('video');
      setHistory(response.history || []);
    } catch (error) {
      console.error('[EditVideoWorkspace] loadVideoHistory failed', error);
    }
  };

  const handleMultipleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newInputs = [...videoInputs];
    const maxSize = 200 * 1024 * 1024; // 200MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        toast.warning(`Video "${file.name}" vượt quá giới hạn 200MB và bị bỏ qua.`);
        continue;
      }
      
      const previewUrl = URL.createObjectURL(file);
      
      const tempVideo = document.createElement('video');
      tempVideo.src = previewUrl;
      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration || 0;
        setVideoInputs(prev => prev.map(item => item.url === previewUrl ? { ...item, duration } : item));
      };

      newInputs.push({
        url: previewUrl,
        duration: 0,
        file
      });
    }
    setVideoInputs(newInputs);
    event.target.value = '';
  };

  const handleRemoveVideo = (indexToRemove: number) => {
    setVideoInputs(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectPreset = (presetPrompt: string) => {
    setPrompt(presetPrompt);
    setOptimizedData(null);
  };

  const handleOptimizePrompt = async () => {
    const description = prompt.trim();
    if (!description) {
      toast.warning('Vui lòng nhập nội dung prompt trước khi tối ưu hóa.');
      return;
    }
    setOptimizedData(null);
    setIsOptimizing(true);
    try {
      console.log("[EditVideoWorkspace] Sending optimize request with prompt:", description);
      const result = await geminiApi.optimizeVideoPrompt(description, []);
      console.log("[EditVideoWorkspace] Optimization result received:", result);
      setOptimizedData(result);
      toast.success('Đã tối ưu prompt video bằng AI.');
    } catch (error: any) {
      console.error("[EditVideoWorkspace] Optimization failed:", error);
      toast.error(`Lỗi khi tối ưu prompt: ${error?.message || 'Không xác định'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      toast.warning('Vui lòng nhập prompt ý tưởng biên tập video.');
      return;
    }
    if (videoInputs.length === 0) {
      toast.warning('Vui lòng chọn hoặc tải lên ít nhất một video nguồn để chỉnh sửa.');
      return;
    }

    setIsGenerating(true);
    setBlueprint(null);
    setCurrentRecordId(null);
    setOutputUrl(null);

    try {
      const uploadedUrls: string[] = [];
      const updatedInputs = [...videoInputs];
      let hasUploads = false;

      // Check if there are local files to upload
      for (const input of videoInputs) {
        if (input.file) {
          hasUploads = true;
          break;
        }
      }

      if (hasUploads) {
        setIsUploadingVideo(true);
        toast.info('Đang tải các video nguồn lên Cloudinary...');
      }

      for (let i = 0; i < videoInputs.length; i++) {
        const input = videoInputs[i];
        if (input.file) {
          try {
            toast.info(`Đang tải video ${i + 1}/${videoInputs.length} lên Cloudinary...`);
            const url = await uploadVideoFile(input.file);
            uploadedUrls.push(url);
            updatedInputs[i] = { ...input, url, file: undefined };
          } catch (uploadErr: any) {
            console.error('[Upload source video error]', uploadErr);
            toast.error(`Không thể tải video nguồn ${i + 1} lên Cloudinary: ${uploadErr.message}`);
            setIsGenerating(false);
            setIsUploadingVideo(false);
            return;
          }
        } else {
          uploadedUrls.push(input.url);
        }
      }

      if (hasUploads) {
        setVideoInputs(updatedInputs);
        setIsUploadingVideo(false);
        toast.success('Tải các video gốc thành công.');
      }

      const jointVideoUrl = uploadedUrls.join(',');
      const totalDuration = videoInputs.reduce((sum, v) => sum + (v.duration || 0), 0);

      toast.info('Đang gửi yêu cầu biên tập video đến AI...');
      const finalPrompt = optimizedData?.optimized_english_prompt
        ? optimizedData.optimized_english_prompt
        : prompt.trim();

      const response = await geminiApi.editVideo(jointVideoUrl, finalPrompt, {
        modelName: selectedModel,
        aspectRatio,
        resolution,
        duration: totalDuration || undefined,
      });

      if (response.record) {
        setBlueprint(response.blueprint);
        setCurrentRecordId(response.record._id || response.record.id);
        setOutputUrl(response.record.url);
        toast.success('Đã tạo kịch bản biên tập AI. Bắt đầu kết xuất video...');
        await loadVideoHistory();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Lỗi khi biên tập video: ${error?.message || 'Không xác định'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-5">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
           
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Chỉnh sửa Video </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Chỉnh sửa video gốc bằng prompt AI, thêm style, tự động cắt ghép, và xem preview nhanh.
            </p>
          </div>
        
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">Video đầu vào</label>
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(true)}
                  className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 bg-cyan-50 px-2.5 py-1 rounded-lg transition-all"
                >
                  <Video className="h-3.5 w-3.5" />
                 Thư viện video
                </button>
              </div>
              <div
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-4 flex flex-col transition-all bg-slate-50/50 ${
                  isDragging ? 'border-cyan-500 bg-cyan-50/50' : 'border-slate-250 hover:border-cyan-400'
                }`}
              >
                {videoInputs.length > 0 ? (
                  <div className="flex flex-wrap gap-2 w-full">
                    {videoInputs.map((video, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSelectedPreviewUrl(video.url);
                          setShowPreviewModal(true);
                        }}
                        className="relative w-28 h-28 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs group cursor-pointer hover:border-cyan-400 hover:ring-1 hover:ring-cyan-400/50 transition-all"
                      >
                        <video
                          src={video.url}
                          className="w-full h-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="h-6 w-6 text-white fill-white" />
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white bg-black/50 px-1 rounded">
                          Video {idx + 1} ({video.duration ? `${Math.round(video.duration)}s` : '0s'})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVideo(idx);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all z-10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    <label className="cursor-pointer border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center w-28 h-28 hover:bg-slate-100 transition-all bg-white">
                      <UploadCloud className="h-5 w-5 text-gray-400" />
                      <span className="text-[9px] text-gray-500 font-semibold mt-1">Thêm</span>
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleMultipleFilesChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center text-center w-full min-h-[140px]">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                      <Video className="h-5 w-5 text-slate-500" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Kéo thả hoặc nhấp để tải video lên</span>
                    <span className="text-[10px] text-slate-400 mt-1 font-medium">MP4, MOV, WEBM. Tối đa 200MB. Hỗ trợ chọn nhiều video.</span>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleMultipleFilesChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ý tưởng của bạn</p>
                  <p className="mt-1 text-sm text-slate-500">Mô tả đoạn video bạn muốn AI chỉnh sửa.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt('');
                    setOptimizedData(null);
                  }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Xóa
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setOptimizedData(null);
                }}
                rows={6}
                placeholder="Nhập ý tưởng video: ví dụ 'Chỉnh video review sản phẩm thành reel 15s, cut nhanh theo nhạc EDM, text pop-up, tone sáng.'"
                className="min-h-[160px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleOptimizePrompt}
                className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isOptimizing}
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tối ưu prompt...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Phân tích và hoàn thiện prompt
                  </>
                )}
              </button>

              {optimizedData && (
                <div className="p-4 rounded-2xl border border-cyan-100 bg-cyan-50/50 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-250">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-cyan-800 text-sm font-bold">
                      <Sparkles className="h-4 w-4 text-cyan-500 animate-pulse" />
                      <span>Kịch bản tối ưu bởi AI</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptimizedData(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      Xóa tối ưu
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prompt Tiếng Anh chi tiết</span>
                    <textarea
                      className="w-full text-xs p-3 border border-cyan-200/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-white resize-none font-medium text-slate-700 leading-relaxed min-h-[70px]"
                      value={optimizedData.optimized_english_prompt}
                      onChange={(e) => setOptimizedData({
                        ...optimizedData,
                        optimized_english_prompt: e.target.value
                      })}
                      placeholder="Prompt tiếng Anh chi tiết..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chuyển động (Motion)</span>
                      <input
                        type="text"
                        className="w-full text-xs px-3 py-2 border border-cyan-200/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-white font-medium text-slate-700"
                        value={optimizedData.motion_analysis || ''}
                        onChange={(e) => setOptimizedData({
                          ...optimizedData,
                          motion_analysis: e.target.value
                        })}
                        placeholder="Không có phân tích chuyển động"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Camera (Movement)</span>
                      <input
                        type="text"
                        className="w-full text-xs px-3 py-2 border border-cyan-200/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-white font-medium text-slate-700"
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

        

        

            <div className="mt-2">
              <button
                type="button"
                onClick={handleGenerateVideo}
                className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo video...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Tạo video ngay
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Sẵn sàng sáng tạo</p>
                  <p className="mt-1 text-sm text-slate-500">Tải video gốc và nhập ý tưởng để bắt đầu.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Preview</div>
              </div>
              <div className={`mt-6 rounded-[28px] border bg-slate-50 p-6 text-center text-slate-500 ${
                outputUrl && (outputUrl.startsWith('pending://local-render/') || (history.find(h => h.url === outputUrl)?.metadata?.provider === 'local-render'))
                  ? 'border-solid border-slate-250' 
                  : 'border-dashed border-slate-300 flex h-[380px] items-center justify-center'
              }`}>
                {outputUrl ? (
                  outputUrl.startsWith('pending://') ? (() => {
                    const matchedRecord = history.find(h => h.url === outputUrl || h._id === currentRecordId || h.id === currentRecordId);
                    const isLocalRender = (matchedRecord?.metadata?.provider === 'local-render') || (outputUrl ? outputUrl.includes('local-render') : false);
                    
                    if (isLocalRender) {
                      const progressVal = matchedRecord?.metadata?.progress ?? 0;
                      const statusVal = matchedRecord?.metadata?.status ?? 'processing';
                      const errorVal = matchedRecord?.metadata?.error;
                      
                      let currentBlueprint: any = null;
                      try {
                        if (blueprint) {
                          currentBlueprint = blueprint;
                        } else if (matchedRecord?.metadata?.blueprint) {
                          currentBlueprint = typeof matchedRecord.metadata.blueprint === 'string'
                            ? JSON.parse(matchedRecord.metadata.blueprint)
                            : matchedRecord.metadata.blueprint;
                        }
                      } catch (e) {
                        console.error('Lỗi parse blueprint:', e);
                      }
                      
                      return (
                        <div className="w-full flex flex-col gap-4 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến trình Biên tập AI</span>
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                              {statusVal === 'completed' ? 'HOÀN THÀNH' : statusVal === 'failed' ? 'THẤT BẠI' : `ĐANG XỬ LÝ (${progressVal}%)`}
                            </span>
                          </div>

                          {currentBlueprint && (
                            <div className="w-full flex flex-col gap-2 p-4 rounded-3xl border border-slate-200 bg-slate-50/50 shadow-inner">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-700">
                                  <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
                                  <span>Bản Xem Trước Thời Gian Thực (Client Preview)</span>
                                </div>
                                <span className="text-[10px] text-slate-400">Remotion Player</span>
                              </div>
                              <div className="w-full overflow-hidden rounded-2xl bg-black border border-slate-200 flex items-center justify-center">
                                <Player
                                  component={VideoComposition}
                                  inputProps={{ blueprint: currentBlueprint }}
                                  durationInFrames={(() => {
                                    const timeline = currentBlueprint.timeline || [];
                                    const videoClips = timeline.filter((item: any) => item.type === "video");
                                    let durationSeconds = 0;
                                    if (videoClips.length > 0) {
                                      durationSeconds = videoClips.reduce((sum: number, item: any) => {
                                        const clipDuration = (item.end ?? 5) - (item.start ?? 0);
                                        const rate = item.playbackRate ?? 1;
                                        return sum + (clipDuration / rate);
                                      }, 0);
                                    } else {
                                      durationSeconds = 10;
                                    }
                                    return Math.max(30, Math.round(durationSeconds * 30));
                                  })()}
                                  fps={30}
                                  compositionWidth={aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 720 : 1280}
                                  compositionHeight={aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 720 : 720}
                                  style={{
                                    width: '100%',
                                    aspectRatio: aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9',
                                  }}
                                  controls
                                  loop
                                />
                              </div>
                              <p className="text-[10px] text-slate-500 italic text-center">
                                Bạn có thể phát thử, tua thanh thời gian để xem trước vị trí chữ chạy trên trình duyệt ngay lập tức.
                              </p>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                              <span>Tiến độ kết xuất MP4</span>
                              <span className="text-cyan-600 font-mono text-xs">{progressVal}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${statusVal === 'failed' ? 'bg-rose-500' : 'bg-cyan-600'}`}
                                style={{ width: `${progressVal}%` }}
                              />
                            </div>
                          </div>

                          {errorVal && (
                            <p className="text-xs text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">
                              Lỗi render: {errorVal}
                            </p>
                          )}

                          {statusVal === 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetUrl = (matchedRecord && matchedRecord.url && !matchedRecord.url.startsWith('pending://'))
                                  ? matchedRecord.url
                                  : (outputUrl && !outputUrl.startsWith('pending://') ? outputUrl : undefined);
                                if (targetUrl) {
                                  setVideoInputs(prev => {
                                    if (prev.some(item => item.url === targetUrl)) {
                                      return prev;
                                    }
                                    return [...prev, { url: targetUrl, duration: 0 }];
                                  });
                                }
                                setPrompt('');
                                setOptimizedData(null);
                                setBlueprint(null);
                                setOutputUrl(null);
                                toast.success('Đã đặt video kết quả thành video đầu vào. Hãy nhập ý tưởng mới để tiếp tục chỉnh sửa!');
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 cursor-pointer shadow-sm shadow-cyan-155 mt-2"
                            >
                              <Wand2 className="h-4 w-4" />
                              Chỉnh sửa tiếp
                            </button>
                          )}
                        </div>
                      );
                    }

                    const progressVal = matchedRecord?.metadata?.progress;
                    return (
                      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center animate-pulse">
                        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Video đang được tạo ngầm...</p>
                          {progressVal !== undefined && (
                            <div className="flex flex-col items-center gap-1.5 mt-2 w-48 mx-auto">
                              <span className="text-xs text-cyan-600 font-semibold font-mono">Tiến độ: {progressVal}%</span>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-cyan-600 h-full transition-all duration-300 rounded-full"
                                  style={{ width: `${progressVal}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-slate-500">Tiến trình đang xử lý ở chế độ nền. Theo dõi trong Lịch sử render bên dưới.</p>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="w-full h-full flex flex-col gap-4">
                      <video controls src={outputUrl} className="w-full rounded-[24px] object-contain max-h-[300px] shadow-sm border border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          if (outputUrl) {
                            setVideoInputs(prev => {
                              if (prev.some(item => item.url === outputUrl)) {
                                return prev;
                              }
                              return [...prev, { url: outputUrl, duration: 0 }];
                            });
                          }
                          setPrompt('');
                          setOptimizedData(null);
                          setBlueprint(null);
                          setOutputUrl(null);
                          toast.success('Đã thêm video kết quả vào danh sách video đầu vào. Hãy nhập ý tưởng mới để tiếp tục chỉnh sửa!');
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 cursor-pointer shadow-sm shadow-cyan-155"
                      >
                        <Wand2 className="h-4 w-4" />
                        Chỉnh sửa tiếp
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex max-w-[320px] flex-col items-center gap-4">
                    <Film className="h-12 w-12" />
                    <p className="text-lg font-semibold text-slate-900">Sẵn sàng chỉnh sửa</p>
                    <p className="text-sm leading-6 text-slate-500">Video preview sẽ hiện sau khi hoàn thành render.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Lịch sử tạo video</p>
                  <p className="mt-1 text-sm text-slate-500">Hiển thị tối đa 20 kết quả gần nhất, từ mới đến cũ.</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">{history.length}/20</span>
              </div>

              <div className="space-y-4">
                {history.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                    Chưa có lịch sử tạo video.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.slice(0, 20).map((item) => (
                      <button
                        key={item._id || item.id || item.url}
                        type="button"
                        onClick={() => {
                          setOutputUrl(item.url);
                          setCurrentRecordId(item._id || item.id);
                          if (item.metadata?.blueprint) {
                            try {
                              const parsed = typeof item.metadata.blueprint === 'string'
                                ? JSON.parse(item.metadata.blueprint)
                                : item.metadata.blueprint;
                              setBlueprint(parsed);
                            } catch (e) {
                              console.error('Lỗi parse blueprint lịch sử:', e);
                              setBlueprint(null);
                            }
                          } else {
                            setBlueprint(null);
                          }
                        }}
                        className="w-full flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
                      >
                        <div className="relative h-20 w-28 overflow-hidden rounded-3xl bg-slate-100">
                          {item.url && (item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')) ? (
                            <>
                              <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
                                <Play className="h-5 w-5 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center text-[8px] font-bold text-cyan-500 uppercase tracking-wider p-1 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mb-1 text-cyan-500" />
                              ĐANG DỰNG {item.metadata?.progress !== undefined ? `${item.metadata.progress}%` : ''}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 line-clamp-2">{item.prompt || 'Video AI đã tạo'}</p>
                          <p className="mt-1 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.aspectRatio || '16:9'}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.resolution || '720p'}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Optimized prompt is rendered contextually inside the edit form */}

        {showLibraryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
            <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Thư viện video</p>
                  <p className="mt-1 text-sm text-slate-500">Chọn video đã tải lên để dùng làm nguồn đầu vào.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(false)}
                  className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[560px] space-y-4 overflow-y-auto px-5 py-6">
                {history.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                    Chưa có video trong thư viện. Vui lòng tạo hoặc tải video lên trước.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {history.map((item) => (
                      <button
                        key={item._id || item.id || item.url}
                        type="button"
                        onClick={() => {
                          const duration = item.metadata?.duration ? Number(item.metadata.duration) : 0;
                          setVideoInputs(prev => [...prev, { url: item.url, duration }]);
                          setShowLibraryModal(false);
                        }}
                        className="group rounded-3xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
                          {item.url && (item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')) ? (
                            <>
                              <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                              <div className="absolute inset-0 bg-slate-950/20"></div>
                            </>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-[10px] font-bold text-cyan-450 uppercase tracking-widest">
                              <Loader2 className="h-5 w-5 animate-spin mb-1 text-cyan-500" />
                              Đang xử lý
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
                          <p className="font-semibold text-slate-900 line-clamp-2">{item.prompt || 'Video đã tải lên'}</p>
                          <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showPreviewModal && selectedPreviewUrl && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4 py-6"
            onClick={() => setShowPreviewModal(false)}
          >
            <div 
              className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <div>
                  <p className="text-lg font-semibold text-white">Video đầu vào</p>
                  <p className="mt-1 text-xs text-slate-400">Xem trước video gốc của bạn.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="rounded-full border border-slate-800 bg-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 bg-black flex items-center justify-center">
                <video 
                  src={selectedPreviewUrl} 
                  controls 
                  autoPlay
                  className="max-h-[500px] w-full rounded-2xl object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
