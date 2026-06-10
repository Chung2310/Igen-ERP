import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProgress } from '../../hooks/use-progress';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../pages/Toast';
import { 
  Loader2, ImageIcon, X, Wand2, UploadCloud, Download, 
  Images, ZoomIn, Check, Sparkles, Trash2, Settings 
} from 'lucide-react';
import { formatAiModelName } from '../../utils/usage-tracker';
import { marketingService } from '../../services/marketingService';

const DESIGN_FIELDS = [
  { id: 'streetwear', label: 'Streetwear / Đời sống', icon: '👟' },
  { id: 'office', label: 'Công sở / Elegant', icon: '💼' },
  { id: 'sportswear', label: 'Thể thao / Sportswear', icon: '🚴' },
  { id: 'highfashion', label: 'High Fashion / Editorial', icon: '💎' },
  { id: 'accessories', label: 'Phụ kiện / Trang sức', icon: '💍' },
  { id: 'landscape', label: 'Ngoại cảnh / Cảnh quan', icon: '🌳' },
  { id: 'interior', label: 'Trong nhà / Studio', icon: '🛋️' },
  { id: 'other', label: 'Khác', icon: '📋' },
];

const DESIGN_OPTION_GROUPS = [
  {
    key: 'renderStyle',
    title: 'Phong cách Chụp ảnh',
    color: 'blue',
    placeholder: 'VD: "chụp kiểu vintage", "ánh sáng tạp chí"...',
    items: [
      { id: 'studio', label: 'Studio Professional', icon: '💡' },
      { id: 'street', label: 'Street Snapshot', icon: '📸' },
      { id: 'cinematic', label: 'Cinematic Film', icon: '🎞️' },
      { id: 'editorial', label: 'Editorial / Magazine', icon: '📰' },
      { id: 'polaroid', label: 'Vintage Polaroid', icon: '🖼️' },
      { id: '3dfashion', label: '3D Fashion Render', icon: '👕' },
    ],
  },
  {
    key: 'viewAngle',
    title: 'Góc chụp & Pose',
    color: 'sky',
    placeholder: 'VD: "đang đi bộ", "ngồi thư giãn"...',
    items: [
      { id: 'fullbody', label: 'Toàn cảnh (Full Body)', icon: '🧍' },
      { id: 'closeup', label: 'Cận cảnh (Detail)', icon: '🔍' },
      { id: 'medium', label: 'Bán thân (Waist up)', icon: '🧥' },
      { id: 'dynamic', label: 'Hành động (Action)', icon: '🏃' },
      { id: 'birdseye', label: 'Góc cao (Top down)', icon: '🦅' },
      { id: 'lowangle', label: 'Góc thấp (Heroic)', icon: '📐' },
    ],
  },
  {
    key: 'style',
    title: 'Phong cách Thời trang',
    color: 'violet',
    placeholder: 'VD: "phong cách Y2K", "gothic"...',
    items: [
      { id: 'modern', label: 'Hiện đại', icon: '✨' },
      { id: 'minimalist', label: 'Tối giản', icon: '⬜' },
      { id: 'vintage', label: 'Vintage / Retro', icon: '🏛️' },
      { id: 'bohemian', label: 'Bohemian / Boho', icon: '🌿' },
      { id: 'cyberpunk', label: 'Cyberpunk', icon: '🎋' },
      { id: 'luxury', label: 'Luxury', icon: '👑' },
    ],
  },
  {
    key: 'materials',
    title: 'Chất liệu & Họa tiết',
    multi: true,
    color: 'amber',
    placeholder: 'VD: "vải lụa bóng", "da cá sấu", "họa tiết hoa"...',
    items: [
      { id: 'silk', label: 'Lụa / Satin', icon: '🧵' },
      { id: 'denim', label: 'Denim / Jean', icon: '👖' },
      { id: 'leather', label: 'Da / Suede', icon: '👢' },
      { id: 'linen', label: 'Linen / Cotton', icon: '🪡' },
      { id: 'wool', label: 'Len / Knitwear', icon: '🧶' },
      { id: 'lace', label: 'Lace / Mesh', icon: '🕸️' },
    ],
  },
  {
    key: 'lighting',
    title: 'Ánh sáng',
    color: 'orange',
    placeholder: 'VD: "ánh sáng neon ban đêm", "backlight"...',
    items: [
      { id: 'natural', label: 'Tự nhiên (Sunlight)', icon: '☀️' },
      { id: 'goldenhour', label: 'Hoàng hôn', icon: '🌅' },
      { id: 'softbox', label: 'Softbox (Dịu)', icon: '💡' },
      { id: 'neon', label: 'Neon / Cyber', icon: '🌈' },
    ],
  },
];

export function ImageGenerationWorkspace({ initialPrompt, cardId, onMediaSaved }: {
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

  const [selectedTemplate, setSelectedTemplate] = useState<'fashion_expert' | 'simple'>(initialPrompt ? 'simple' : 'fashion_expert');
  const [simplePrompt, setSimplePrompt] = useState(initialPrompt || '');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageModel, setImageModel] = useState('imagen-4.0-generate-001');
  const [resolution, setResolution] = useState('1K');
  
  // Design selections
  const [designField, setDesignField] = useState('streetwear');
  const [designFieldCustom, setDesignFieldCustom] = useState('');
  const [designSelections, setDesignSelections] = useState<Record<string, string[]>>({});
  const [designCustomTexts, setDesignCustomTexts] = useState<Record<string, string>>({});
  const [archNote, setArchNote] = useState('');

  // Input reference image list (base64 data URIs)
  const [inputImageUrls, setInputImageUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // States for processing
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Progress helpers
  const generateProgress = useProgress(isGenerating, 12);
  const optimizeProgress = useProgress(isGeneratingPrompt, 4);

  useEffect(() => {
    if (initialPrompt) {
      setSimplePrompt(initialPrompt);
      setPrompt(initialPrompt);
      setSelectedTemplate('simple');
    }
  }, [initialPrompt]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await geminiApi.getMediaHistory("image");
      setHistory(response.history || []);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tải lịch sử hình ảnh");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const readers = (Array.from(files) as File[]).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then((urls) => {
        setInputImageUrls((prev) => [...prev, ...urls].slice(0, 3));
        toast.success(`Đã thêm ${urls.length} ảnh tham chiếu thành công!`);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể xử lý ảnh tải lên");
      })
      .finally(() => {
        setIsUploading(false);
        e.target.value = '';
      });
  };

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
    
    setIsUploading(true);
    const readers = (Array.from(files) as File[]).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then((urls) => {
        setInputImageUrls((prev) => [...prev, ...urls].slice(0, 3));
        toast.success(`Đã thêm ${urls.length} ảnh tham chiếu!`);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải ảnh");
      })
      .finally(() => setIsUploading(false));
  };

  const buildFashionExpertPrompt = useCallback(() => {
    const parts: string[] = [];
    const fieldLabel = DESIGN_FIELDS.find(f => f.id === designField)?.label;
    const fieldText = fieldLabel || designFieldCustom.trim() || '';
    
    parts.push(`[CHUYÊN GIA THỜI TRANG & LIFESTYLE - Lĩnh vực: ${fieldText || 'Đa ngành'}]`);
    parts.push('Giữ nguyên các đặc điểm đặc thù của sản phẩm trong ảnh tham chiếu. Thiết kế phong cách bối cảnh quảng cáo thời trang chuyên nghiệp.');

    for (const group of DESIGN_OPTION_GROUPS) {
      const selected = designSelections[group.key] || [];
      const custom = designCustomTexts[group.key]?.trim() || '';
      const selectedLabels = selected
        .map(id => group.items.find(item => item.id === id)?.label)
        .filter(Boolean);
      
      const combined = [...selectedLabels];
      if (custom) combined.push(custom);
      if (combined.length > 0) {
        parts.push(`${group.title}: ${combined.join(', ')}.`);
      }
    }

    if (archNote.trim()) {
      parts.push(`Mô tả kịch bản: ${archNote.trim()}`);
    }

    return parts.join(' ');
  }, [designField, designFieldCustom, designSelections, designCustomTexts, archNote]);

  const handleGenerateOptimalPrompt = async () => {
    const isFashion = selectedTemplate === 'fashion_expert';
    const activeDescription = isFashion ? buildFashionExpertPrompt() : simplePrompt;

    if (!activeDescription.trim()) {
      toast.warning('Vui lòng nhập mô tả kịch bản hoặc chọn cấu hình thời trang trước.');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const result = await geminiApi.optimizeImagePrompt(activeDescription, inputImageUrls);
      
      // JSON prompt optimization format or simple string
      if (result.optimized_english_prompt) {
        setPrompt(result.optimized_english_prompt);
        if (result.negative_prompt) setNegativePrompt(result.negative_prompt);
      } else {
        setPrompt(JSON.stringify(result, null, 2));
      }
      toast.success('Đã tối ưu hóa prompt bằng AI thành công!');
    } catch (e: any) {
      toast.error(`Lỗi tối ưu prompt: ${e.message}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    let finalPrompt = prompt.trim();
    if (!finalPrompt) {
      finalPrompt = selectedTemplate === 'fashion_expert' ? buildFashionExpertPrompt() : simplePrompt;
    }

    if (!finalPrompt.trim()) {
      toast.warning('Vui lòng nhập prompt hoặc tối ưu hóa prompt trước khi tạo ảnh.');
      return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);

    try {
      toast.success('Bắt đầu gửi lệnh sinh ảnh lên Google Imagen...');
      const response = await geminiApi.generateImage(finalPrompt, {
        aspectRatio,
        modelName: imageModel,
        resolution,
        existingImageUris: inputImageUrls,
      });

      if (response.url) {
        setGeneratedImageUrl(response.url);
        
        if (activeCardId) {
          toast.success('Tạo ảnh AI thành công! Đang tải lên Cloudinary...');
          try {
            const filename = `image_${Date.now()}.png`;
            const cloudinaryUrl = await marketingService.uploadMediaToStorage(response.url, filename, 'image');
            await marketingService.updateCardMedia(cloudinaryUrl, 'image', [activeCardId]);
            if (onMediaSaved) {
              onMediaSaved(activeCardId, cloudinaryUrl, 'image');
            }
            toast.success('Lưu ảnh lên Cloudinary và gắn link với content thành công!');
          } catch (uploadError: any) {
            console.error('Lỗi upload Cloudinary:', uploadError);
            toast.error('Tạo ảnh thành công nhưng không thể lưu lên Cloudinary hoặc gắn link.');
          }
        } else {
          toast.success('Tạo ảnh AI và đồng bộ hóa thành công!');
        }
        
        loadHistory(); // Reload history
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Không thể tạo ảnh: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa hình ảnh này khỏi lịch sử?")) return;
    try {
       await geminiApi.deleteMediaHistory(id);
       toast.success('Đã xóa hình ảnh thành công.');
       setHistory(prev => prev.filter(r => r._id !== id && r.id !== id));
       if (generatedImageUrl && history.find(h => h._id === id || h.id === id)?.url === generatedImageUrl) {
         setGeneratedImageUrl(null);
       }
    } catch (e: any) {
       toast.error(`Lỗi khi xóa: ${e.message}`);
    }
  };

  const toggleSelection = (groupKey: string, id: string, multi = false) => {
    setDesignSelections((prev) => {
      const current = prev[groupKey] || [];
      if (current.includes(id)) {
        return { ...prev, [groupKey]: current.filter(x => x !== id) };
      }
      return { ...prev, [groupKey]: multi ? [...current, id] : [id] };
    });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full pb-12" id="image_workspace_wrapper">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Controls & Selections */}
        <div className="lg:col-span-2 flex flex-col gap-6">
           
           {/* Template Switcher */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3">
                 <h4 className="font-bold text-gray-800 text-sm uppercase flex items-center gap-1.5">
                   <ImageIcon className="h-4 w-4 text-cyan-600" />
                   Cấu hình thiết kế hình ảnh
                 </h4>
                 <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        selectedTemplate === 'fashion_expert' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                      }`}
                      onClick={() => setSelectedTemplate('fashion_expert')}
                    >
                      Studio Đa ngành
                    </button>
                    <button
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        selectedTemplate === 'simple' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                      }`}
                      onClick={() => setSelectedTemplate('simple')}
                    >
                      Prompt thủ công
                    </button>
                 </div>
              </div>

              {selectedTemplate === 'fashion_expert' ? (
                <div className="space-y-5">
                   {/* Industry Field */}
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-bold text-gray-700">Lĩnh vực sản phẩm</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                         {DESIGN_FIELDS.map((field) => (
                            <button
                              key={field.id}
                              onClick={() => setDesignField(field.id)}
                              className={`p-2.5 text-xs font-medium rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                                designField === field.id
                                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold ring-1 ring-cyan-500/20'
                                  : 'border-slate-200 bg-white text-gray-650 hover:bg-slate-50'
                              }`}
                            >
                               <span className="text-lg">{field.icon}</span>
                               <span>{field.label.split('/')[0]}</span>
                            </button>
                         ))}
                      </div>
                   </div>

                   {/* Options Groups */}
                   {DESIGN_OPTION_GROUPS.map((group) => (
                      <div key={group.key} className="flex flex-col gap-1.5 border-t pt-3">
                         <label className="text-[12px] font-bold text-gray-700">{group.title}</label>
                         <div className="flex flex-wrap gap-1.5">
                            {group.items.map((item) => {
                               const isSel = (designSelections[group.key] || []).includes(item.id);
                               return (
                                  <button
                                    key={item.id}
                                    onClick={() => toggleSelection(group.key, item.id, group.multi)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1 ${
                                      isSel
                                        ? 'border-cyan-500 bg-cyan-500 text-white font-semibold'
                                        : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-100'
                                    }`}
                                  >
                                     <span>{item.icon}</span>
                                     <span>{item.label}</span>
                                  </button>
                               );
                            })}
                         </div>
                      </div>
                   ))}

                   {/* Custom Note */}
                   <div className="flex flex-col gap-1.5 border-t pt-3">
                      <label className="text-[12px] font-bold text-gray-700">Ý tưởng/Kịch bản bối cảnh chi tiết</label>
                      <textarea
                        placeholder="Nhập thêm chi tiết kịch bản, ví dụ: 'Người mẫu nam đứng nghiêng góc 45 độ, tay cầm bàn phím cơ iGen, phông nền văn phòng hiện đại với hiệu ứng bokeh ánh sáng vàng..."
                        className="w-full text-xs p-3 border border-gray-200 rounded-xl h-24 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                        value={archNote}
                        onChange={(e) => setArchNote(e.target.value)}
                      />
                   </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                   <label className="text-[12px] font-bold text-gray-700">Mô tả kịch bản hình ảnh chi tiết</label>
                   <textarea
                     placeholder="Mô tả chi tiết bằng tiếng Việt hoặc tiếng Anh. Ví dụ: Chụp ảnh quảng cáo chất lượng cao cho sản phẩm giày sneaker chạy bộ ngoài trời nắng chiều hoàng hôn..."
                     className="w-full text-xs p-4 border border-gray-200 rounded-xl h-44 focus:ring-1 focus:ring-cyan-500 focus:outline-none leading-relaxed"
                     value={simplePrompt}
                     onChange={(e) => setSimplePrompt(e.target.value)}
                   />
                </div>
              )}
           </div>

           {/* Reference Images panel */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <label className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                 <Images className="h-4.5 w-4.5 text-cyan-600" />
                 Hình ảnh mẫu sản phẩm / Concept tham chiếu (Tối đa 3 ảnh)
              </label>

              <div 
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${
                  isDragging ? 'border-cyan-500 bg-cyan-50/50' : 'border-gray-300 hover:border-cyan-400 bg-slate-50/50'
                }`}
              >
                 <UploadCloud className="h-10 w-10 text-gray-400 mb-2" />
                 <span className="text-xs font-semibold text-gray-600 text-center">Kéo thả các ảnh sản phẩm vào đây</span>
                 <span className="text-[10px] text-gray-400 mt-1">Hoặc nhấp vào nút bên dưới để duyệt tệp</span>
                 <input 
                   type="file" 
                   multiple 
                   accept="image/*" 
                   onChange={handleFileUpload} 
                   className="hidden" 
                   id="image_ref_file_input" 
                 />
                 <label 
                   htmlFor="image_ref_file_input"
                   className="mt-3 px-4 py-2 bg-white hover:bg-slate-150 text-slate-800 border rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                 >
                    Duyệt ảnh trên máy
                 </label>
              </div>

              {inputImageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-2 bg-slate-50 p-3 rounded-xl border border-dashed">
                   {inputImageUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden bg-white group">
                         <img src={url} alt="Ref source" className="w-full h-full object-cover" />
                         <button
                           onClick={() => setInputImageUrls(prev => prev.filter((_, i) => i !== idx))}
                           className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all opacity-90"
                         >
                            <X className="h-3 w-3" />
                         </button>
                      </div>
                   ))}
                </div>
              )}
           </div>

           {/* Prompt Engineer Editor */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3">
                 <label className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                    <Wand2 className="h-4.5 w-4.5 text-cyan-600" />
                    Bản dịch & Tối ưu prompt tiếng Anh bằng AI (Imagen 4)
                 </label>
                 <button
                   onClick={handleGenerateOptimalPrompt}
                   disabled={isGeneratingPrompt || isGenerating}
                   className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                 >
                    {isGeneratingPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-indigo-500" />}
                    Phát sinh Prompt bằng AI
                 </button>
              </div>

              {isGeneratingPrompt && (
                <div className="flex flex-col gap-1 p-3.5 bg-indigo-50 border rounded-xl animate-pulse text-[10px] font-bold text-indigo-800 tracking-wider">
                   <span>ĐANG PHÂN TÍCH VÀ BIÊN DỊCH PROMPT SANG TIẾNG ANH CHUẨN IMAGEN...</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                 <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Mô tả ảnh tiếng Anh (Prompt)</span>
                    <textarea
                      placeholder="Prompt tiếng Anh sẽ được sinh tự động tại đây..."
                      className="w-full text-xs font-mono p-3 border border-gray-200 rounded-xl h-24 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chi tiết loại bỏ (Negative Prompt)</span>
                    <input
                      type="text"
                      placeholder="ugly, blurry, deformed hands, duplicate, low quality..."
                      className="w-full text-xs font-mono p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: Output Preview & History */}
        <div className="lg:col-span-1 flex flex-col gap-6">
           
           {/* Actions & Settings Panel */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5 border-b pb-3">
                 <Settings className="h-4 w-4 text-cyan-600" />
                 Tùy chọn kỹ thuật
              </h4>

              <div className="flex flex-col gap-3.5">
                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Mô hình AI</span>
                    <select
                      className="w-full text-xs p-2.5 border rounded-lg bg-white"
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                    >
                       <option value="imagen-4.0-generate-001">Google Imagen 4.0 Pro</option>
                       <option value="gemini-2.5-flash">Gemini 2.5 Flash Image Modal</option>
                    </select>
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Tỉ lệ khung hình</span>
                    <div className="grid grid-cols-3 gap-2">
                       {['1:1', '4:3', '16:9', '9:16', '3:4'].map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              aspectRatio === ratio
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 bg-white text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                             {ratio}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">Độ phân giải</span>
                    <div className="grid grid-cols-2 gap-2">
                       {['1K', '2K'].map((res) => (
                          <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              resolution === res
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 bg-white text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                             {res === '1K' ? '1K (Standard)' : '2K (HD Ultra)'}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Progress Simulated Bar */}
              {isGenerating && (
                <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 border rounded-xl animate-pulse mt-2">
                   <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 font-mono">
                      <span>DỰNG KHUNG HÌNH AI...</span>
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
                onClick={handleGenerateImage}
                disabled={isGenerating || isGeneratingPrompt}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 mt-2 ${
                  isGenerating || isGeneratingPrompt
                    ? "bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-600 text-white active:scale-[0.99] shadow-cyan-500/20"
                }`}
              >
                {isGenerating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ImageIcon className="h-4.5 w-4.5" />}
                Tạo hình ảnh AI
              </button>
           </div>

           {/* Generated Output Preview */}
           {generatedImageUrl && (
              <div className="border border-cyan-200 bg-slate-950 rounded-2xl overflow-hidden shadow-lg flex flex-col">
                 <div className="bg-slate-900 border-b border-slate-800 p-3.5 flex justify-between items-center text-slate-200">
                    <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1">
                       <Check className="h-4 w-4 text-emerald-500" /> Kết quả mới nhất
                    </span>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = generatedImageUrl;
                        link.download = `igen-image-${Date.now()}.png`;
                        link.click();
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                      title="Tải ảnh về máy"
                    >
                       <Download className="h-4.5 w-4.5" />
                    </button>
                 </div>
                 <div className="aspect-square relative flex items-center justify-center bg-slate-900 overflow-hidden max-h-[350px]">
                    <img src={generatedImageUrl} alt="Generated AI illustration" className="max-w-full max-h-full object-contain" />
                 </div>
              </div>
           )}

           {/* Render History library */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5 border-b pb-3">
                 <Images className="h-4.5 w-4.5 text-cyan-600" />
                 Thư viện hình ảnh đã tạo
              </h4>

              {isLoadingHistory ? (
                 <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="h-7 w-7 text-cyan-500 animate-spin mb-2" />
                    <span className="text-[11px] uppercase tracking-wider font-mono">Đang đồng bộ...</span>
                 </div>
              ) : history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed rounded-xl">
                    <ImageIcon className="h-8 w-8 text-slate-350 mb-1.5" />
                    <span className="text-xs font-semibold">Chưa có ảnh lịch sử nào</span>
                 </div>
              ) : (
                 <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                    {history.map((record) => {
                       const id = record._id || record.id;
                       return (
                          <div 
                            key={id}
                            className="group relative border rounded-xl overflow-hidden aspect-square bg-slate-900 shadow-xs hover:shadow-md transition-all border-slate-100"
                          >
                             <img src={record.url} alt="Historic AI art" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                             
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                <div className="flex justify-end gap-1">
                                   <button
                                     onClick={() => {
                                       const link = document.createElement('a');
                                       link.href = record.url;
                                       link.download = `igen-image-${id}.png`;
                                       link.click();
                                     }}
                                     className="p-1 bg-black/40 hover:bg-black text-white rounded-md transition-colors"
                                     title="Tải về máy"
                                   >
                                      <Download className="h-3.5 w-3.5" />
                                   </button>
                                   <button
                                     onClick={() => handleDeleteHistory(id)}
                                     className="p-1 bg-black/40 hover:bg-red-650 text-white rounded-md transition-colors"
                                     title="Xóa khỏi thư viện"
                                   >
                                      <Trash2 className="h-3.5 w-3.5" />
                                   </button>
                                </div>

                                <p className="text-[9px] text-slate-300 leading-snug line-clamp-3 select-text max-h-[42px] overflow-y-auto font-sans p-1 bg-black/35 rounded border border-dashed border-slate-800">
                                   {record.prompt}
                                </p>

                                <button
                                  onClick={() => setGeneratedImageUrl(record.url)}
                                  className="py-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 rounded text-[9px] font-bold w-full mt-1.5 flex items-center justify-center gap-1"
                                >
                                   <ZoomIn className="h-3 w-3" /> Phóng to xem
                                </button>
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
