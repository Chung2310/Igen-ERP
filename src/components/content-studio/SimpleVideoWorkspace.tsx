import React, { useState, useRef, useEffect } from 'react';
import { useProgress } from '../../hooks/use-progress';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../pages/Toast';
import { 
  Loader2, UploadCloud, Video, Download, Play, Sparkles, 
  Images, Settings, X, Plus, ChevronUp, Wand2, ImageIcon, Trash2 
} from 'lucide-react';
import { marketingService } from '../../services/marketingService';

const MODEL_OPTIONS = [
  { value: 'veo-3.1-generate-preview', label: 'iGen Veo 3.1 Fast', desc: 'Tốc độ nhanh, chất lượng tốt' },
  { value: 'veo-3.1-fast-generate-preview', label: 'iGen Veo 3.1 Fast (Preview)', desc: 'Tối ưu hiệu năng' },
  { value: 'piapi-kling', label: 'PiAPI - Kling AI Video', desc: 'Sinh video Kling AI' },
  { value: 'piapi-luma', label: 'PiAPI - Luma AI Video', desc: 'Sinh video Luma AI' },
];

const DURATION_OPTIONS = [
  { value: '4', label: '4 giây' },
  { value: '6', label: '6 giây' },
  { value: '8', label: '8 giây' },
];

const QUALITY_OPTIONS = [
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '720p', label: '720p (HD)' },
];

const VIDEO_TEMPLATES = [
  { id: 'none', label: 'Tùy chỉnh (Tự nhập)', prompt: '' },
  { id: 'cinematic', label: '🎬 Điện ảnh (Cinematic)', prompt: 'Cảnh quan hùng vĩ, ánh sáng hoàng hôn ấm áp, máy quay bay cao lướt qua những ngọn núi tuyết, phong cách Flycam.' },
  { id: 'product', label: '📦 Quay sản phẩm (Creative)', prompt: 'Quay cận cảnh sản phẩm thời trang, máy quay xoay tròn 360 độ, ánh sáng studio chuyên nghiệp, phông nền tối giản, chuyển động mượt mà.' },
  { id: 'fashion', label: '👗 Fashion Walk', prompt: 'Người mẫu đi bộ trên sàn runway, ánh sáng đèn flash lung linh, bối cảnh studio cao cấp, chuyển động slow-motion.' },
];

export function SimpleVideoWorkspace({ initialPrompt, cardId, onMediaSaved }: {
  initialPrompt?: string;
  cardId?: string;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: 'image' | 'video') => void;
}) {
  const [activeCardId, setActiveCardId] = useState<string | undefined>(cardId);

  useEffect(() => {
    if (cardId) {
      setActiveCardId(cardId);
    }
  }, [cardId]);

  const [activeMode, setActiveMode] = useState<'standard' | 'before-after'>('standard');
  const [prompt, setPrompt] = useState(initialPrompt || '');

  // Image references
  const [standardImage, setStandardImage] = useState<string | null>(null);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);

  // Video Settings
  const [videoModel, setVideoModel] = useState('veo-3.1-generate-preview');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
  const [videoDuration, setVideoDuration] = useState('4');
  const [videoQuality, setVideoQuality] = useState('720p'); // 1080p requires duration >= 6s

  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

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

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await geminiApi.getMediaHistory("video");
      setHistory(response.history || []);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tải lịch sử video");
    } finally {
      setIsLoadingHistory(false);
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

    setIsGeneratingPrompt(true);
    try {
      const imageUris = standardImage ? [standardImage] : [];
      const result = await geminiApi.optimizeVideoPrompt(description, imageUris);

      if (result.optimized_english_prompt) {
        setPrompt(result.optimized_english_prompt);
      } else {
        setPrompt(JSON.stringify(result, null, 2));
      }
      toast.success('Đã tối ưu hóa prompt video bằng AI thành công!');
    } catch (e: any) {
      toast.error(`Lỗi tối ưu prompt video: ${e.message}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateVideo = async () => {
    const promptText = prompt.trim();
    if (!promptText && activeMode === 'standard') {
      toast.warning('Vui lòng nhập prompt hoặc mô tả kịch bản video.');
      return;
    }

    setIsGenerating(true);
    setGeneratedVideoUrl(null);

    try {
      const modelLabel = videoModel.startsWith('piapi-') ? 'PiAPI' : 'Google Veo';
      toast.success(`Đang gửi lệnh tạo video lên ${modelLabel}. Quá trình này có thể mất vài phút...`);
      
      const referenceImageUris = activeMode === 'standard' 
        ? (standardImage ? [standardImage] : undefined)
        : (beforeImage ? [beforeImage] : undefined);

      const response = await geminiApi.generateVideo(promptText || 'Smooth transition between images', parseInt(videoDuration), {
        aspectRatio: videoAspectRatio,
        modelName: videoModel,
        resolution: videoQuality,
        referenceImageUris,
        referenceVideoUri: activeMode === 'before-after' && afterImage ? afterImage : undefined // Pass as special parameter or handle on service
      });

      if (response.url) {
        setGeneratedVideoUrl(response.url);
        
        if (activeCardId) {
          toast.success('Tạo video AI thành công! Đang tải lên Cloudinary...');
          try {
            const filename = `video_${Date.now()}.mp4`;
            const cloudinaryUrl = await marketingService.uploadMediaToStorage(response.url, filename, 'video');
            await marketingService.updateCardMedia(cloudinaryUrl, 'video', [activeCardId]);
            if (onMediaSaved) {
              onMediaSaved(activeCardId, cloudinaryUrl, 'video');
            }
            toast.success('Lưu video lên Cloudinary và gắn link với content thành công!');
          } catch (uploadError: any) {
            console.error('Lỗi upload Cloudinary:', uploadError);
            toast.error('Tạo video thành công nhưng không thể lưu lên Cloudinary hoặc gắn link.');
          }
        } else {
          toast.success('Tạo video AI thành công!');
        }
        
        loadHistory(); // Reload history
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Không thể tạo video: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa video này khỏi lịch sử?")) return;
    try {
       await geminiApi.deleteMediaHistory(id);
       toast.success('Đã xóa video thành công.');
       setHistory(prev => prev.filter(r => r._id !== id && r.id !== id));
       if (generatedVideoUrl && history.find(h => h._id === id || h.id === id)?.url === generatedVideoUrl) {
         setGeneratedVideoUrl(null);
       }
    } catch (e: any) {
       toast.error(`Lỗi khi xóa: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full pb-12" id="video_workspace_wrapper">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-2 flex flex-col gap-6">
           
           {/* Mode selection & Prompt */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3">
                 <h4 className="font-bold text-gray-800 text-sm uppercase flex items-center gap-1.5">
                   <Video className="h-4.5 w-4.5 text-cyan-600" />
                   Cấu hình kịch bản Video
                 </h4>
                 
                 <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeMode === 'standard' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                      }`}
                      onClick={() => setActiveMode('standard')}
                    >
                      Tiêu chuẩn
                    </button>
                    <button
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeMode === 'before-after' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                      }`}
                      onClick={() => setActiveMode('before-after')}
                    >
                      Thời gian trôi (Time-lapse)
                    </button>
                 </div>
              </div>

              {activeMode === 'standard' ? (
                <div className="flex flex-col gap-4">
                   {/* Option Template Quick Selector */}
                   <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">💡 Gợi ý phong cách quay nhanh:</span>
                      <div className="flex flex-wrap gap-2">
                         {VIDEO_TEMPLATES.filter(t => t.id !== 'none').map((t) => (
                            <button
                              key={t.id}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                prompt.includes(t.prompt.substring(0, 10))
                                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                  : 'border-slate-200 bg-white text-gray-650 hover:bg-slate-100'
                              }`}
                              onClick={() => setPrompt(t.prompt)}
                            >
                               {t.label}
                            </button>
                         ))}
                      </div>
                   </div>

                   {/* Script content area */}
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-bold text-gray-750">Mô tả hành động của kịch bản video</label>
                      <textarea
                        placeholder="Mô tả chi tiết chuyển động và bối cảnh (Ví dụ: Một cốc cà phê đặt trên bàn gỗ, hơi nước bốc lên cuồn cuộn mượt mà dưới ánh sáng ban mai nhẹ nhàng, máy quay zoom cận cảnh vào bọt sữa..."
                        className="w-full text-xs p-4 border border-gray-200 rounded-xl h-36 focus:ring-1 focus:ring-cyan-500 focus:outline-none leading-relaxed"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                   </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                   <p className="text-xs text-gray-500 leading-relaxed bg-slate-50 p-3.5 border rounded-xl border-dashed">
                      💡 Chế độ <strong>Thời gian trôi (Time-lapse)</strong> cho phép bạn cung cấp một ảnh đầu (Trước) và một ảnh cuối (Sau) để AI tự động suy đoán chuyển động biến đổi mượt mà giữa hai hình ảnh.
                   </p>
                   
                   <div className="grid grid-cols-2 gap-4">
                      {/* Before image upload */}
                      <div className="flex flex-col gap-2">
                         <span className="text-xs font-bold text-gray-600">🌅 Ảnh lúc đầu (Trước)</span>
                         <div className="border border-slate-200 rounded-xl overflow-hidden aspect-video relative bg-slate-50 flex items-center justify-center group">
                            {beforeImage ? (
                               <>
                                 <img src={beforeImage} alt="Before" className="w-full h-full object-cover" />
                                 <button
                                   onClick={() => setBeforeImage(null)}
                                   className="absolute top-2 right-2 p-1 bg-black/70 text-white rounded-full opacity-90"
                                 >
                                    <X className="h-3 w-3" />
                                 </button>
                               </>
                            ) : (
                               <label className="cursor-pointer flex flex-col items-center p-4">
                                  <UploadCloud className="h-7 w-7 text-gray-400 mb-1" />
                                  <span className="text-[10px] text-gray-500 font-semibold">Tải ảnh đầu</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(e, 'before')} 
                                  />
                               </label>
                            )}
                         </div>
                      </div>

                      {/* After image upload */}
                      <div className="flex flex-col gap-2">
                         <span className="text-xs font-bold text-gray-600">🌄 Ảnh kết quả (Sau)</span>
                         <div className="border border-slate-200 rounded-xl overflow-hidden aspect-video relative bg-slate-50 flex items-center justify-center group">
                            {afterImage ? (
                               <>
                                 <img src={afterImage} alt="After" className="w-full h-full object-cover" />
                                 <button
                                   onClick={() => setAfterImage(null)}
                                   className="absolute top-2 right-2 p-1 bg-black/70 text-white rounded-full opacity-90"
                                 >
                                    <X className="h-3 w-3" />
                                 </button>
                               </>
                            ) : (
                               <label className="cursor-pointer flex flex-col items-center p-4">
                                  <UploadCloud className="h-7 w-7 text-gray-400 mb-1" />
                                  <span className="text-[10px] text-gray-500 font-semibold">Tải ảnh cuối</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(e, 'after')} 
                                  />
                               </label>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-bold text-gray-700">Mô tả chi tiết hiệu ứng biến đổi (Tùy chọn)</label>
                      <input
                        type="text"
                        placeholder="VD: Hoa từ nụ hé nở thành hoa rực rỡ, hoặc bầu trời chuyển từ chiều tà sang ban đêm..."
                        className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                   </div>
                </div>
              )}
           </div>

           {/* Reference Character Image (For standard mode) */}
           {activeMode === 'standard' && (
              <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
                 <label className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                    <ImageIcon className="h-4.5 w-4.5 text-cyan-600" />
                    Hình ảnh khởi nguồn cho hành động (Image-to-Video)
                 </label>
                 
                 <div className="border border-dashed rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center relative">
                    {standardImage ? (
                       <div className="relative aspect-video max-w-sm w-full border rounded-lg overflow-hidden bg-white">
                          <img src={standardImage} alt="Ref source" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setStandardImage(null)}
                            className="absolute top-2 right-2 p-1 bg-black/75 hover:bg-black text-white rounded-full transition-all"
                          >
                             <X className="h-3 w-3" />
                          </button>
                       </div>
                    ) : (
                       <label className="cursor-pointer flex flex-col items-center justify-center p-6 text-center w-full">
                          <UploadCloud className="h-8 w-8 text-gray-400 mb-1.5" />
                          <span className="text-xs font-semibold text-gray-650">Tải lên ảnh chủ thể</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">Hành động của video sẽ bắt đầu từ khung hình này</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'standard')} 
                          />
                       </label>
                    )}
                 </div>
              </div>
           )}

           {/* Prompt translation section */}
           {activeMode === 'standard' && (
             <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b pb-3">
                   <label className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                      <Wand2 className="h-4.5 w-4.5 text-cyan-600" />
                      Tối ưu hóa prompt tiếng Anh bằng AI (Veo 3)
                   </label>
                   <button
                     onClick={handleOptimizePrompt}
                     disabled={isGeneratingPrompt || isGenerating}
                     className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                   >
                      {isGeneratingPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-indigo-500" />}
                      Phát sinh Prompt bằng AI
                   </button>
                </div>

                {isGeneratingPrompt && (
                  <div className="flex flex-col gap-1 p-3.5 bg-indigo-50 border rounded-xl animate-pulse text-[10px] font-bold text-indigo-800 tracking-wider">
                     <span>AI ĐANG LẬP TRÌNH CHUYỂN ĐỘNG VÀ BIÊN DỊCH PROMPT CHO GOOGLE VEO...</span>
                  </div>
                )}

                <textarea
                  placeholder="Prompt tiếng Anh sinh tự động tại đây..."
                  className="w-full text-xs font-mono p-3 border border-gray-200 rounded-xl h-24 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
             </div>
           )}
        </div>

        {/* RIGHT COLUMN: Settings & Outputs */}
        <div className="lg:col-span-1 flex flex-col gap-6">
           
           {/* Settings panel */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5 border-b pb-3">
                 <Settings className="h-4 w-4 text-cyan-600" />
                 Tùy chọn kỹ thuật
              </h4>

              <div className="flex flex-col gap-3.5">
                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Mô hình AI Video</span>
                    <select
                      className="w-full text-xs p-2.5 border rounded-lg bg-white"
                      value={videoModel}
                      onChange={(e) => setVideoModel(e.target.value)}
                    >
                       <optgroup label="Google Veo">
                          <option value="veo-3.1-generate-preview">iGen Veo 3.1 Fast</option>
                          <option value="veo-3.1-fast-generate-preview">iGen Veo 3.1 Fast (Preview)</option>
                       </optgroup>
                       <optgroup label="PiAPI Video (Kling / Luma)">
                          <option value="piapi-kling">PiAPI - Kling AI Video</option>
                          <option value="piapi-luma">PiAPI - Luma AI Video</option>
                       </optgroup>
                    </select>
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Tỉ lệ khung hình</span>
                    <div className="grid grid-cols-2 gap-2">
                       {['16:9', '9:16'].map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => setVideoAspectRatio(ratio)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              videoAspectRatio === ratio
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 bg-white text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                             {ratio === '16:9' ? 'Ngang (16:9)' : 'Dọc (9:16)'}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Thời lượng video</span>
                    <div className="grid grid-cols-3 gap-2">
                       {DURATION_OPTIONS.map((dur) => (
                          <button
                            key={dur.value}
                            onClick={() => handleDurationChange(dur.value)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              videoDuration === dur.value
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 bg-white text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                             {dur.label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Chất lượng video</span>
                    <select
                      className="w-full text-xs p-2.5 border rounded-lg bg-white"
                      value={videoQuality}
                      onChange={(e) => handleQualityChange(e.target.value)}
                    >
                       {QUALITY_OPTIONS.map(opt => (
                         <option key={opt.value} value={opt.value}>{opt.label}</option>
                       ))}
                    </select>
                 </div>
              </div>

              {/* Progress Simulated Bar */}
              {isGenerating && (
                <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 border rounded-xl animate-pulse mt-2">
                   <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 font-mono">
                      <span>DỰNG VIDEO AI (MẤT 1-2 PHÚT)...</span>
                      <span>{generateProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-250 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full transition-all duration-300 rounded-full" 
                        style={{ width: `${generateProgress}%` }}
                      />
                   </div>
                </div>
              )}

              <button
                onClick={handleGenerateVideo}
                disabled={isGenerating || isGeneratingPrompt}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 mt-2 ${
                  isGenerating || isGeneratingPrompt
                    ? "bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-600 text-white active:scale-[0.99] shadow-cyan-500/20"
                }`}
              >
                {isGenerating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Video className="h-4.5 w-4.5" />}
                Tạo video AI
              </button>
           </div>

           {/* Video Output Preview */}
           {generatedVideoUrl && (
              <div className="border border-cyan-200 bg-slate-950 rounded-2xl overflow-hidden shadow-lg flex flex-col">
                 <div className="bg-slate-900 border-b border-slate-800 p-3.5 flex justify-between items-center text-slate-200">
                    <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1">
                       ✓ Video vừa tạo
                    </span>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = generatedVideoUrl;
                        link.download = `igen-video-${Date.now()}.mp4`;
                        link.click();
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                      title="Tải video về máy"
                    >
                       <Download className="h-4.5 w-4.5" />
                    </button>
                 </div>
                 <div className="aspect-video relative flex items-center justify-center bg-slate-900 overflow-hidden">
                    <video src={generatedVideoUrl} controls autoPlay loop className="max-w-full max-h-full" />
                 </div>
              </div>
           )}

           {/* Render History library */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5 border-b pb-3">
                 <Images className="h-4.5 w-4.5 text-cyan-600" />
                 Thư viện video đã tạo
              </h4>

              {isLoadingHistory ? (
                 <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="h-7 w-7 text-cyan-500 animate-spin mb-2" />
                    <span className="text-[11px] uppercase tracking-wider font-mono">Đang đồng bộ...</span>
                 </div>
              ) : history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed rounded-xl">
                    <Video className="h-8 w-8 text-slate-350 mb-1.5" />
                    <span className="text-xs font-semibold">Chưa có video lịch sử nào</span>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-1">
                    {history.map((record) => {
                       const id = record._id || record.id;
                       return (
                          <div 
                            key={id}
                            className="group relative border rounded-xl overflow-hidden bg-slate-950 flex flex-col border-slate-200 shadow-xs hover:shadow-md transition-all"
                          >
                             <div className="aspect-video relative flex items-center justify-center bg-slate-900 overflow-hidden">
                                <video src={record.url} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 text-slate-200">
                                   <div className="flex justify-end gap-1.5">
                                      <button
                                        onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = record.url;
                                          link.download = `igen-video-${id}.mp4`;
                                          link.click();
                                        }}
                                        className="p-1.5 bg-black/40 hover:bg-black text-white rounded-md transition-colors"
                                        title="Tải về máy"
                                      >
                                         <Download className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteHistory(id)}
                                        className="p-1.5 bg-black/40 hover:bg-red-650 text-white rounded-md transition-colors"
                                        title="Xóa khỏi thư viện"
                                      >
                                         <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                   </div>

                                   <p className="text-[10px] text-slate-350 leading-snug line-clamp-3 select-text max-h-[50px] overflow-y-auto font-sans p-1 bg-black/25 rounded">
                                      {record.prompt}
                                   </p>

                                   <button
                                     onClick={() => setGeneratedVideoUrl(record.url)}
                                     className="py-1 px-3 bg-cyan-500 hover:bg-cyan-600 text-slate-950 rounded text-[10px] font-bold w-full mt-1.5 flex items-center justify-center gap-1"
                                   >
                                      Phóng to phát
                                   </button>
                                </div>
                             </div>
                             
                             <div className="bg-white p-2.5 text-[9px] text-gray-400 font-mono flex justify-between items-center border-t border-slate-100">
                                <span>{record.metadata?.durationSeconds ? `${record.metadata.durationSeconds}s` : '4s'} | {record.metadata?.aspectRatio || '16:9'}</span>
                                <span>{new Date(record.createdAt).toLocaleDateString('vi-VN')}</span>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
