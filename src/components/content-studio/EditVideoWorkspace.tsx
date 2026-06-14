import React, { useEffect, useRef, useState } from 'react';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../pages/Toast';
import { Film, Loader2, Play, Sparkles, Video, X } from 'lucide-react';

const MODEL_OPTIONS = [
  { value: 'piapi-veo31-video-fast-audio', label: 'PiAPI Veo 3.1 Fast' },
  { value: 'piapi-veo31-video-audio', label: 'PiAPI Veo 3.1' },
  { value: 'piapi-veo31-video-fast-no-audio', label: 'PiAPI Veo 3.1 Fast Silent' },
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

export function EditVideoWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
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

  useEffect(() => {
    loadVideoHistory();
  }, []);

  useEffect(() => {
    const hasPending = history.some(item => item.url && item.url.startsWith('pending://'));
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
  }, [history]);

  const loadVideoHistory = async () => {
    try {
      const response = await geminiApi.getMediaHistory('video');
      setHistory(response.history || []);
    } catch (error) {
      console.error('[EditVideoWorkspace] loadVideoHistory failed', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setVideoFile(file);
    const preview = URL.createObjectURL(file);
    setVideoPreviewUrl(preview);
    event.target.value = '';
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
    setIsOptimizing(true);
    try {
      const result = await geminiApi.optimizeVideoPrompt(description, []);
      setOptimizedData(result);
      toast.success('Đã tối ưu prompt video bằng AI.');
    } catch (error: any) {
      console.error(error);
      toast.error(`Lỗi khi tối ưu prompt: ${error?.message || 'Không xác định'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateVideo = async () => {
    const finalPrompt = optimizedData 
      ? JSON.stringify(optimizedData)
      : prompt.trim();
    if (!finalPrompt.trim()) {
      toast.warning('Vui lòng nhập prompt hoặc chọn preset trước khi tạo video.');
      return;
    }
    setIsGenerating(true);
    setOutputUrl(null);
    try {
      const response = await geminiApi.generateVideo(finalPrompt, parseInt(duration, 10), {
        aspectRatio,
        modelName: selectedModel,
        resolution,
      });
      if (response.url) {
        setOutputUrl(response.url);
        toast.success('Yêu cầu tạo video đã được gửi. Vui lòng đợi kết quả.');
        await loadVideoHistory();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Lỗi khi tạo video: ${error?.message || 'Không xác định'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-5">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Video Studio</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Edit Video </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Chỉnh sửa video gốc bằng prompt AI, thêm style, tự động cắt ghép, và xem preview nhanh.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
            Igen ERP
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Video đầu vào</p>
                  <p className="mt-1 text-sm text-slate-500">Upload video gốc hoặc dùng video đã tạo trước đó.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Video className="h-4 w-4" />
                 Thư viện video
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {videoPreviewUrl ? (
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="mx-auto h-[220px] w-full rounded-3xl object-contain"
                  />
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-500">
                    <Video className="h-10 w-10" />
                    <p className="text-sm font-semibold">Kéo thả hoặc nhấp vào khu vực để tải video lên</p>
                    <p className="text-xs text-slate-400">MP4, MOV, WEBM. Dung lượng tối đa 200MB.</p>
                  </div>
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
                  onClick={() => setPrompt('')}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Xóa
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-900">Mô hình tạo video</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900">Khung hình</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  {ASPECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-900">Thời lượng</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <p className="block text-sm font-semibold text-slate-900">Độ phân giải</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setResolution(option.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${resolution === option.value ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <div className="mt-6 flex h-[380px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                {outputUrl ? (
                  outputUrl.startsWith('pending://') ? (() => {
                    const matchedRecord = history.find(h => h.url === outputUrl);
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
                    <video controls src={outputUrl} className="h-full w-full rounded-[24px] object-contain" />
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
                  <p className="text-sm font-semibold text-slate-900">Lịch sử render video</p>
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
                        onClick={() => setOutputUrl(item.url)}
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
                          setVideoPreviewUrl(item.url);
                          setVideoFile(null);
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
      </div>
    </div>
  );
}
