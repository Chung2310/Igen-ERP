import React, { useState, useRef, useEffect } from 'react';
import { useProgress } from '../../hooks/use-progress';
import { geminiApi } from '../../api/gemini';
import { toast } from '../../pages/Toast';
import { 
  Loader2, Mic, Play, Download, Volume2, Pause, Wand2, 
  Trash2, Clock, MicOff, Headphones, Library, Settings2 
} from 'lucide-react';
import { estimateAudioDuration } from '../../utils/usage-tracker';

const VOICE_STYLE_TEMPLATES = [
  { id: 'none', label: 'Tùy chỉnh (Tự nhập)', prompt: '' },
  { id: 'news', label: '🎙️ BTV thời sự', prompt: 'Đọc dõng dạc, nghiêm túc, rõ ràng và mạch lạc như một biên tập viên truyền hình.' },
  { id: 'story', label: '🌙 Kể chuyện', prompt: 'Đọc chậm rãi, ấm áp, truyền cảm như đang kể chuyện cho trẻ em nghe.' },
  { id: 'excited', label: '🎉 Hào hứng', prompt: 'Đọc thật hào hứng, bùng nổ, vui tươi và tràn đầy nhiệt huyết.' },
  { id: 'prof', label: '📊 Chuyên gia', prompt: 'Đọc điềm đạm, tốc độ vừa phải, chuyên nghiệp và đầy tính thuyết phục.' },
  { id: 'sad', label: '🥀 Sâu lắng', prompt: 'Đọc với giọng trầm buồn, nghẹn ngào, tốc độ chậm rãi thể hiện sự đồng cảm.' },
  { id: 'urgent', label: '🚨 Khẩn cấp', prompt: 'Đọc dứt khoát, nhanh, âm lượng lớn và tập trung vào sự quan trọng của thông tin.' },
];

const ALL_VOICES = [
  { id: 'Aoede', gender: 'female', age: 'young', label: 'Cô gái (~25t)', description: 'Nhẹ nhàng, truyền cảm (Middle)' },
  { id: 'Kore', gender: 'female', age: 'child', label: 'Bé gái (~12t)', description: 'Trong trẻo, dễ thương' },
  { id: 'Puck', gender: 'male', age: 'child', label: 'Bé trai (~12t)', description: 'Năng động, hoạt bát' },
  { id: 'Charon', gender: 'male', age: 'adult', label: 'Đàn ông (~45t)', description: 'Trầm ấm, mạnh mẽ' },
  { id: 'Fenrir', gender: 'male', age: 'young', label: 'Chàng trai (~25t)', description: 'Sắc sảo, rõ ràng' },
  { id: 'Leda', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Trong trẻo, tự nhiên' },
  { id: 'Orus', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Trầm ấm, vang' },
  { id: 'Callirrhoe', gender: 'female', age: 'adult', label: 'Trung niên', description: 'Mềm mại, ấm áp' },
  { id: 'Autonoe', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Thanh thoát, rõ lời' },
  { id: 'Enceladus', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Mạnh mẽ, dứt khoát' },
  { id: 'Iapetus', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Sâu trầm, chững chạc' },
  { id: 'Umbriel', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Nhẹ nhàng, từ tốn' },
  { id: 'Algieba', gender: 'female', age: 'adult', label: 'Trung niên', description: 'Dày, sang trọng' },
  { id: 'Despina', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Cao, nhí nhảnh' },
  { id: 'Erinome', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Rõ ràng, cao độ trung bình' },
  { id: 'Algenib', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Khàn, cao độ thấp' },
  { id: 'Rasalgethi', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Truyền đạt thông tin, cao độ trung bình' },
  { id: 'Laomedeia', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Sôi nổi, cao độ cao' },
  { id: 'Achernar', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Sáng, lôi cuốn' },
  { id: 'Zephyr', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Mượt mà, cao độ trung bình' },
  { id: 'Alnilam', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Dày, mạnh mẽ' },
  { id: 'Schedar', gender: 'female', age: 'adult', label: 'Trung niên', description: 'Đầm ấm, chững chạc' },
  { id: 'Gacrux', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Sâu lắng, ấm áp' },
  { id: 'Pulcherrima', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Tự nhiên, rành mạch' },
  { id: 'Achird', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Nhịp vang, linh hoạt' },
  { id: 'Zubenelgenubi', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Chậm rãi, thuyết phục' },
  { id: 'Vindemiatrix', gender: 'female', age: 'adult', label: 'Trung niên', description: 'Thanh tao, điềm tĩnh' },
  { id: 'Sadachbia', gender: 'female', age: 'young', label: 'Thanh niên', description: 'Tươi tắn, truyền cảm' },
  { id: 'Sadaltager', gender: 'male', age: 'adult', label: 'Trung niên', description: 'Trầm ấm, độc đáo' },
  { id: 'Sulafat', gender: 'male', age: 'young', label: 'Thanh niên', description: 'Hoạt bát, tươi sáng' }
];

export function VoiceGenerationWorkspace() {
  const [text, setText] = useState('');
  const [model, setModel] = useState('gemini-2.5-pro-preview-tts');
  
  // Custom states
  const [customStyleInstructions, setCustomStyleInstructions] = useState('');
  const [selectedStylePrompt, setSelectedStylePrompt] = useState('');
  const [selectedRegionPrompt, setSelectedRegionPrompt] = useState('');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [temperature, setTemperature] = useState(1.05);

  // Voice selection state
  const [voiceId, setVoiceId] = useState('Sadaltager');
  const [speakerA, setSpeakerA] = useState('Aoede');
  const [speakerB, setSpeakerB] = useState('Puck');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const optimizeProgress = useProgress(isOptimizing, 4);
  const generateProgress = useProgress(isGenerating, 10);
  
  // Dictation state (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Preview State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Custom audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const styleInstructions = [customStyleInstructions.trim(), selectedStylePrompt.trim(), selectedRegionPrompt.trim()]
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    loadHistory();
    // Cleanup speech recognition on unmount
    return () => {
       if (recognitionRef.current && isListening) {
          recognitionRef.current.stop();
       }
       if (previewAudioRef.current) previewAudioRef.current.pause();
       if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await geminiApi.getMediaHistory("voice");
      setHistory(response.history || []);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tải lịch sử giọng nói");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getSelectedVoice = () => {
     return ALL_VOICES.find(v => v.id === voiceId) || ALL_VOICES[0];
  };

  const handlePreviewVoice = async () => {
    const currentVoice = getSelectedVoice();
    
    // Check cache
    if (previewCache[currentVoice.id]) {
       playPreviewAudio(previewCache[currentVoice.id]);
       return;
    }

    setIsPreviewing(true);
    try {
        const previewText = currentVoice.gender === 'female' 
          ? `Xin chào, đây là giọng nói của tôi. Rất vui được gặp bạn.`
          : `Xin chào, đây là giọng nói của tôi. Chúc bạn một ngày tốt lành.`;
          
        const result = await geminiApi.generateVoice({
          textToSpeak: previewText,
          mode: 'single',
          temperature: 1.0,
          speakerA: 'Aoede',
          speakerB: 'Puck',
          modelName: 'gemini-2.5-flash-preview-tts', // Fast flash model
          voiceName: currentVoice.id,
        });

        if (result.record?.url) {
          setPreviewCache(prev => ({ ...prev, [currentVoice.id]: result.record.url }));
          playPreviewAudio(result.record.url);
        }
    } catch (e: any) {
        toast.error(`Lỗi phát thử: ${e.message}`);
    } finally {
        setIsPreviewing(false);
    }
  };

  const playPreviewAudio = (uri: string) => {
     if (previewAudioRef.current) {
        previewAudioRef.current.pause();
     }
     const audio = new Audio(uri);
     previewAudioRef.current = audio;
     audio.play().catch(e => console.error("Preview play failed", e));
  };

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error("Trình duyệt của bạn không hỗ trợ thu âm Microphone.");
      return;
    }
    
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
        toast.success('Đã dừng thu âm');
        return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let startText = text;
    if (startText.length > 0 && !startText.endsWith(' ')) startText += ' ';
    
    recognition.onstart = () => {
      setIsListening(true);
      toast.success('Đang lắng nghe... Hãy nói vào Microphone.');
    };

    recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
           currentTranscript += event.results[i][0].transcript;
        }
        setText(startText + currentTranscript);
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    
    try { recognition.start(); } catch (e) { setIsListening(false); }
  };

  const handleOptimizeScript = async () => {
    if (!text.trim()) {
      toast.warning('Vui lòng nhập kịch bản cần tối ưu.');
      return;
    }
    setIsOptimizing(true);
    try {
      toast.success('AI đang tối ưu hóa kịch bản...');
      const result = await geminiApi.optimizeScript(text, styleInstructions || 'hấp dẫn, lôi cuốn');
      if (result.optimizedText) {
        setText(result.optimizedText);
        toast.success('Tối ưu hóa kịch bản thành công!');
      }
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.warning('Vui lòng nhập văn bản cần đọc.');
      return;
    }

    setIsGenerating(true);
    setAudioUri(null);
    setIsPlaying(false);
    
    try {
      toast.success('Đang bắt đầu tạo giọng nói AI...');
      
      const result = await geminiApi.generateVoice({
        textToSpeak: text,
        styleInstructions,
        mode,
        temperature,
        modelName: model,
        voiceName: voiceId,
        speakerA,
        speakerB,
      });

      if (result.record?.url) {
        setAudioUri(result.record.url);
        toast.success('Tạo giọng nói thành công!');
        loadHistory(); // Reload history
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Lỗi sinh giọng nói: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bản thu âm này?")) return;
    try {
       await geminiApi.deleteMediaHistory(id);
       toast.success('Đã xóa bản thu âm khỏi lịch sử.');
       setHistory(prev => prev.filter(r => r._id !== id && r.id !== id));
    } catch (e: any) {
       toast.error(`Lỗi khi xóa: ${e.message}`);
       loadHistory(); 
    }
  };

  const handlePlayHistory = (url: string) => {
    setAudioUri(url);
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { if (audioRef.current) audioRef.current.play(); }, 100);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = (uri?: string, customName?: string) => {
    const targetUri = uri || audioUri;
    if (!targetUri) return;
    const link = document.createElement('a');
    link.href = targetUri;
    link.download = customName || `igen-voice-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full pb-12" id="voice_workspace_wrapper">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Controls & Settings */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-5">
             <h4 className="font-bold text-gray-800 text-sm tracking-wide flex items-center gap-1.5 uppercase border-b pb-3">
               <Settings2 className="h-4 w-4 text-cyan-600 animate-spin" />
               Cấu hình giọng đọc
             </h4>

             {/* 1. Style instructions & Templates */}
             <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-gray-700">Chỉ dẫn phong cách tự do</label>
                  <input 
                    type="text"
                    placeholder="VD: Đọc chậm rãi, ấm áp thiết tha..." 
                    value={customStyleInstructions}
                    onChange={(e) => setCustomStyleInstructions(e.target.value)}
                    disabled={isGenerating}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-2 mt-1">
                   <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">🎭 Tông giọng nhanh</span>
                   <div className="flex flex-wrap gap-1.5">
                     {VOICE_STYLE_TEMPLATES.filter(t => t.id !== 'none').map(t => (
                        <button
                          key={t.id}
                          className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all border ${
                            selectedStylePrompt === t.prompt 
                              ? "bg-cyan-500 border-cyan-500 text-white" 
                              : "bg-white hover:bg-slate-100 border-gray-200 text-gray-650"
                          }`}
                          onClick={() => setSelectedStylePrompt(t.prompt === selectedStylePrompt ? '' : t.prompt)}
                          disabled={isGenerating}
                          title={t.prompt}
                        >
                          {t.label}
                        </button>
                     ))}
                   </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-2">
                   <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">🗺️ Vùng miền</span>
                   <div className="flex flex-wrap gap-1.5">
                      <button 
                        className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all border ${
                          selectedRegionPrompt.includes('Giọng Hà Nội') 
                            ? "bg-cyan-500 border-cyan-500 text-white" 
                            : "bg-white border-gray-250 text-gray-600"
                        }`}
                        onClick={() => setSelectedRegionPrompt(selectedRegionPrompt === 'Giọng Hà Nội, phát âm chuẩn Bắc bộ' ? '' : 'Giọng Hà Nội, phát âm chuẩn Bắc bộ')}
                        disabled={isGenerating}
                      >
                         Bắc Bộ (Hà Nội)
                      </button>
                      <button 
                        className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all border ${
                          selectedRegionPrompt.includes('Giọng Huế') 
                            ? "bg-cyan-500 border-cyan-500 text-white" 
                            : "bg-white border-gray-250 text-gray-600"
                        }`}
                        onClick={() => setSelectedRegionPrompt(selectedRegionPrompt === 'Giọng Huế, miền Trung trầm ngọt ấm' ? '' : 'Giọng Huế, miền Trung trầm ngọt ấm')}
                        disabled={isGenerating}
                      >
                         Miền Trung (Huế)
                      </button>
                      <button 
                        className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all border ${
                          selectedRegionPrompt.includes('Giọng Sài Gòn') 
                            ? "bg-cyan-500 border-cyan-500 text-white" 
                            : "bg-white border-gray-250 text-gray-600"
                        }`}
                        onClick={() => setSelectedRegionPrompt(selectedRegionPrompt === 'Giọng Sài Gòn, trẻ trung Nam Bộ' ? '' : 'Giọng Sài Gòn, trẻ trung Nam Bộ')}
                        disabled={isGenerating}
                      >
                         Nam Bộ (Sài Gòn)
                      </button>
                   </div>
                </div>
             </div>

             {/* 2. Choose Mode (Single / Dialogue) */}
             <div className="flex flex-col gap-2">
                <label className="text-[12px] font-bold text-gray-700">Chế độ hội thoại</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                   <button
                     className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                       mode === 'single' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                     }`}
                     onClick={() => setMode('single')}
                   >
                     Đơn thoại (1 người)
                   </button>
                   <button
                     className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                       mode === 'multi' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500'
                     }`}
                     onClick={() => setMode('multi')}
                   >
                     Hội thoại (2 người)
                   </button>
                </div>
             </div>

             {/* 3. Speaker Selection */}
             {mode === 'single' ? (
                <div className="flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <label className="text-[12px] font-bold text-gray-700">Nhân vật giọng đọc</label>
                     <button
                       className="text-[10px] text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1"
                       onClick={handlePreviewVoice}
                       disabled={isPreviewing || isGenerating}
                     >
                       {isPreviewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                       Nghe thử giọng
                     </button>
                   </div>
                   
                   <select
                     className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-white"
                     value={voiceId}
                     onChange={(e) => setVoiceId(e.target.value)}
                     disabled={isGenerating}
                   >
                     {ALL_VOICES.map((v) => (
                       <option key={v.id} value={v.id}>
                         {v.id} - {v.gender === 'male' ? 'Nam' : 'Nữ'} ({v.label})
                       </option>
                     ))}
                   </select>
                   <p className="text-[10px] text-gray-400 italic font-mono mt-0.5">
                      Đặc điểm: {getSelectedVoice().description}
                   </p>
                </div>
             ) : (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-dashed">
                   <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-gray-600">🗣️ Người nói A</span>
                      <select
                        className="w-full text-[11px] p-2 border border-gray-250 bg-white rounded-lg"
                        value={speakerA}
                        onChange={(e) => setSpeakerA(e.target.value)}
                        disabled={isGenerating}
                      >
                         {ALL_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.id} ({v.gender === 'male' ? 'Nam' : 'Nữ'})</option>
                         ))}
                      </select>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-gray-600">🗣️ Người nói B</span>
                      <select
                        className="w-full text-[11px] p-2 border border-gray-250 bg-white rounded-lg"
                        value={speakerB}
                        onChange={(e) => setSpeakerB(e.target.value)}
                        disabled={isGenerating}
                      >
                         {ALL_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.id} ({v.gender === 'male' ? 'Nam' : 'Nữ'})</option>
                         ))}
                      </select>
                   </div>
                </div>
             )}

             {/* 4. Advanced Settings Toggle */}
             <details className="text-xs text-gray-500 border-t pt-4">
                <summary className="cursor-pointer font-bold hover:text-gray-700 select-none flex items-center justify-between">
                   <span>⚙️ Cấu hình kỹ thuật nâng cao</span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                   <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-600">Engine / AI Model</span>
                      <select
                        className="w-full text-[11px] p-2 border rounded-lg bg-white"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                         <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro TTS (Đọc truyền cảm - Chậm)</option>
                         <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS (Xử lý nhanh)</option>
                      </select>
                   </div>
                   
                   <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                         <span className="text-[11px] font-semibold text-gray-600">Độ biến thiên giọng đọc (Temperature)</span>
                         <span className="text-[10px] font-bold text-cyan-600 font-mono">{temperature}</span>
                      </div>
                      <input 
                        type="range"
                        min="0.3"
                        max="1.8"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                   </div>
                </div>
             </details>
          </div>
        </div>

        {/* RIGHT COLUMN: Text Input & History */}
        <div className="lg:col-span-2 flex flex-col gap-6">
           
           {/* Text Editor Canvas */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3">
                 <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5">
                   <Headphones className="h-4 w-4 text-cyan-600" />
                   Soạn thảo kịch bản kịch nói
                 </h4>
                 <div className="flex gap-2">
                    <button
                      onClick={toggleDictation}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isListening 
                          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      <span>{isListening ? 'Đang ghi âm...' : 'Micro'}</span>
                    </button>
                    
                    <button
                      onClick={handleOptimizeScript}
                      disabled={isOptimizing || isGenerating || !text.trim()}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-indigo-500" />}
                      Tối ưu văn bản AI
                    </button>
                 </div>
              </div>

              <div className="relative">
                 <textarea
                   placeholder={
                     mode === 'single'
                       ? 'Nhập văn bản bạn muốn chuyển đổi thành giọng nói tại đây... (Ví dụ: Chào mừng quý khách đã ghé thăm showroom của iGen ERP)'
                       : 'Nhập kịch bản đối thoại phân vai nói (Bắt đầu mỗi câu bằng tên vai để AI dễ nhận dạng):\n[Aoede]: Chào anh Fenrir, hôm nay công việc thế nào?\n[Fenrir]: Chào Leda, mọi thứ vận hành rất trơn tru nhờ module iGen forecast.'
                   }
                   className="w-full text-xs p-4 border border-gray-200 rounded-xl h-44 focus:ring-1 focus:ring-cyan-500 focus:outline-none leading-relaxed font-sans"
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                   disabled={isGenerating}
                 />
                 <div className="absolute bottom-3 right-3 text-[10px] text-gray-400 font-mono">
                    {text.length} ký tự (~{estimateAudioDuration(text)} giây phát)
                 </div>
              </div>

              {/* Progress Simulated Bar */}
              {(isGenerating || isOptimizing) && (
                <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 border rounded-xl animate-pulse">
                   <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 font-mono">
                      <span>{isOptimizing ? 'AI ĐANG BIÊN SOẠN LẠI VĂN BẢN...' : 'AI ĐANG MÃ HÓA GIỌNG ĐỌC...'}</span>
                      <span>{isOptimizing ? optimizeProgress : generateProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full transition-all duration-300 rounded-full" 
                        style={{ width: `${isOptimizing ? optimizeProgress : generateProgress}%` }}
                      />
                   </div>
                </div>
              )}

              {/* Action Button Trigger */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isOptimizing || !text.trim()}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 ${
                  isGenerating || isOptimizing || !text.trim()
                    ? "bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-600 text-white active:scale-[0.99] shadow-cyan-500/20"
                }`}
              >
                {isGenerating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Volume2 className="h-4.5 w-4.5" />}
                Tạo giọng đọc AI
              </button>

              {/* Interactive Custom WAV Player */}
              {audioUri && (
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl flex flex-col gap-3 border border-slate-800 shadow-lg mt-2">
                   <audio 
                     ref={audioRef} 
                     src={audioUri} 
                     onTimeUpdate={handleTimeUpdate}
                     onLoadedMetadata={handleLoadedMetadata}
                     onEnded={() => setIsPlaying(false)}
                     className="hidden"
                   />
                   <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-transform active:scale-95"
                      >
                         {isPlaying ? <Pause className="h-5 w-5 fill-slate-950" /> : <Play className="h-5 w-5 fill-slate-950 ml-0.5" />}
                      </button>
                      
                      <div className="flex-1 flex flex-col gap-1">
                         <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400 font-mono">Bản thu phát âm mới nhất</span>
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">{formatTime(currentTime)}</span>
                            <div className="flex-1 relative group cursor-pointer h-1 bg-slate-700 rounded-full">
                               <div 
                                 className="absolute left-0 top-0 h-full bg-cyan-500 rounded-full" 
                                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                               />
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{formatTime(duration)}</span>
                         </div>
                      </div>

                      <button
                        onClick={() => handleDownload()}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                        title="Tải âm thanh WAV về máy"
                      >
                         <Download className="h-4.5 w-4.5" />
                      </button>
                   </div>
                </div>
              )}
           </div>

           {/* Audio library list */}
           <div className="border border-gray-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5 border-b pb-3">
                 <Library className="h-4.5 w-4.5 text-cyan-600" />
                 Thư viện âm thanh đã tạo
              </h4>

              {isLoadingHistory ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Loader2 className="h-8 w-8 text-cyan-500 animate-spin mb-2" />
                    <span className="text-xs font-semibold uppercase tracking-wider font-mono">Đang đồng bộ dữ liệu...</span>
                 </div>
              ) : history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed rounded-xl">
                    <Volume2 className="h-10 w-10 text-slate-300 mb-2" />
                    <span className="text-xs font-semibold">Chưa có lịch sử tạo giọng nói nào</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Nhập kịch bản ở trên để lưu bản thu của bạn</span>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                    {history.map((record) => {
                       const id = record._id || record.id;
                       return (
                          <div 
                            key={id}
                            className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl hover:shadow-sm transition-all flex flex-col gap-2.5 relative"
                          >
                             <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-md text-[9px] font-bold font-mono">
                                   🎙️ {record.metadata?.voiceName || 'Giọng AI'}
                                </span>
                                <div className="flex items-center gap-1">
                                   <button
                                     onClick={() => handleDownload(record.url, `igen-voice-${id}.wav`)}
                                     className="p-1.5 text-gray-500 hover:bg-slate-200 rounded-md transition-colors"
                                     title="Tải về file WAV"
                                   >
                                      <Download className="h-3.5 w-3.5" />
                                   </button>
                                   <button
                                     onClick={() => handleDeleteHistory(id)}
                                     className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                     title="Xóa bản thu"
                                   >
                                      <Trash2 className="h-3.5 w-3.5" />
                                   </button>
                                </div>
                             </div>

                             <p className="text-[11px] text-gray-650 font-sans leading-relaxed line-clamp-3 select-text max-h-[60px] overflow-y-auto">
                                {record.prompt}
                             </p>

                             <div className="flex items-center justify-between border-t pt-2 text-[9px] text-gray-400 font-mono">
                                <span className="flex items-center gap-1">
                                   <Clock className="h-3 w-3" />
                                   {record.metadata?.duration ? `${record.metadata.duration}s` : 'N/A'}
                                </span>
                                <span>{new Date(record.createdAt).toLocaleDateString('vi-VN')}</span>
                             </div>

                             <button
                               onClick={() => handlePlayHistory(record.url)}
                               className="absolute bottom-3 right-3 py-1 px-2.5 bg-white hover:bg-slate-200 text-slate-800 border rounded-lg text-[9px] font-bold transition-all shadow-xs"
                             >
                                Phóng to phát
                             </button>
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
